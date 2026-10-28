#!/usr/bin/env python3
"""
Clash of Clans TH18 — 3-Model Deep RL Trainer, Checkpoint Manager & Benchmark:
  1. Attacker Model 1 (`AttackerArmySelectorNet`): Village Layout (8×50×50) -> Top 3 Meta Armies
  2. Attacker Model 2 (`CoCActorCritic`): Village Layout + Full Army Context (64) -> Live Placement / NoOp
  3. Defender Model   (`DefenderVillageSelectorNet`): Incoming Army Context (64) -> Top 5 Meta Villages
"""
import argparse
import json
import os
import random
import re
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import torch

import coc_py
from coc_rl import (
    AttackerArmySelectorNet,
    CoCActorCritic,
    CoCAttackerEnv,
    CoCDefenderEvolution,
    DefenderVillageSelectorNet,
    compute_custom_reward,
    compute_gae,
    ensure_architecture_diagrams,
    ppo_minibatch_update,
    ppo_update_step,
    selector_ppo_update_step,
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
TRAINED_MODELS_DIR = os.path.join(REPO_ROOT, "trained_models")
CHECKPOINT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "checkpoints")

DEFAULT_CKPT_PATH = os.path.join(TRAINED_MODELS_DIR, "latest_attacker.pt")
ARMY_SELECTOR_CKPT_PATH = os.path.join(TRAINED_MODELS_DIR, "latest_army_selector.pt")
DEFENDER_SELECTOR_CKPT_PATH = os.path.join(TRAINED_MODELS_DIR, "latest_defender_selector.pt")
CUSTOM_ARMIES_PATH = os.path.join(TRAINED_MODELS_DIR, "custom_armies.json")

ARMY_SHORT_NAMES = [
    "Thrower + Healer Smash",
    "Dragon Duke Hydra",
    "Fireball Super Bowlers",
]

VILLAGE_SHORT_NAMES = [
    "Central Box Legends",
    "Offset Diamond (Hot Candle)",
    "Anti-Hydra Air Ring",
    "Anti-Fireball Wide Spread",
    "Teaser War Killzone",
]


def ensure_trained_models_dir() -> None:
    os.makedirs(TRAINED_MODELS_DIR, exist_ok=True)
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    legacy_latest = os.path.join(CHECKPOINT_DIR, "latest_attacker.pt")
    if os.path.exists(legacy_latest) and not os.path.exists(DEFAULT_CKPT_PATH):
        try:
            import shutil

            shutil.copy2(legacy_latest, DEFAULT_CKPT_PATH)
        except Exception:
            pass


def list_custom_armies() -> List[Dict[str, Any]]:
    ensure_trained_models_dir()
    if not os.path.exists(CUSTOM_ARMIES_PATH):
        return []
    try:
        with open(CUSTOM_ARMIES_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception:
        return []


def save_custom_army(army: Dict[str, Any]) -> List[Dict[str, Any]]:
    ensure_trained_models_dir()
    name = (army.get("name") or "").strip() or "Custom Army"
    army["name"] = name
    existing = list_custom_armies()
    updated = [a for a in existing if a.get("name") != name]
    updated.insert(0, army)
    with open(CUSTOM_ARMIES_PATH, "w", encoding="utf-8") as f:
        json.dump(updated, f, indent=2)
    return updated


def delete_custom_army(name: str) -> List[Dict[str, Any]]:
    ensure_trained_models_dir()
    existing = list_custom_armies()
    updated = [a for a in existing if a.get("name") != name]
    with open(CUSTOM_ARMIES_PATH, "w", encoding="utf-8") as f:
        json.dump(updated, f, indent=2)
    return updated


def get_all_army_presets() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    cat = json.loads(coc_py.get_catalog_json())
    builtin = cat.get("preset_armies", [])
    custom = list_custom_armies()
    custom_names = {a.get("name") for a in custom}
    all_armies = list(custom) + [a for a in builtin if a.get("name") not in custom_names]
    return all_armies, custom


def rename_trained_model(old_filename: str, new_filename: str) -> List[Dict[str, Any]]:
    ensure_trained_models_dir()
    old_base = os.path.basename(old_filename)
    new_base = sanitize_model_filename(os.path.basename(new_filename))
    old_path = os.path.join(TRAINED_MODELS_DIR, old_base)
    new_path = os.path.join(TRAINED_MODELS_DIR, new_base)
    if not os.path.exists(old_path):
        raise FileNotFoundError(f"Source model file '{old_base}' does not exist.")
    if old_base != new_base and os.path.exists(new_path):
        raise FileExistsError(f"Target model file '{new_base}' already exists.")
    if old_base != new_base:
        os.rename(old_path, new_path)
    return list_trained_models()


def sanitize_model_filename(name: str) -> str:
    clean = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", name.strip())
    if not clean.endswith(".pt"):
        clean += ".pt"
    return clean


def list_trained_models() -> List[Dict[str, Any]]:
    ensure_trained_models_dir()
    items: List[Dict[str, Any]] = []
    default_layouts, default_armies = get_meta_presets()
    for fname in os.listdir(TRAINED_MODELS_DIR):
        if not fname.endswith(".pt"):
            continue
        fpath = os.path.join(TRAINED_MODELS_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        mtime = os.path.getmtime(fpath)
        size_kb = round(os.path.getsize(fpath) / 1024.0, 1)
        meta: Dict[str, Any] = {
            "filename": fname,
            "size_kb": size_kb,
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime)),
            "mtime": mtime,
            "episode": 0,
            "best_pct": 0,
            "best_stars": 0,
            "best_reward": 0.0,
            "model_type": "live_attacker",
            "hyperparams": {},
            "armies": default_armies,
            "villages": default_layouts,
            "army_names": [a.get("name", f"Army #{i+1}") for i, a in enumerate(default_armies)],
            "village_names": [v.get("name", f"Village #{i+1}") for i, v in enumerate(default_layouts)],
        }
        try:
            ckpt = torch.load(fpath, map_location="cpu", weights_only=False)
            meta["episode"] = int(ckpt.get("episode", 0))
            meta["best_pct"] = int(ckpt.get("best_pct", 0))
            meta["best_stars"] = int(ckpt.get("best_stars", 0))
            meta["best_reward"] = round(float(ckpt.get("best_reward", 0.0)), 2)
            meta["model_type"] = str(ckpt.get("model_type", "live_attacker"))
            if "hyperparams" in ckpt and isinstance(ckpt["hyperparams"], dict):
                meta["hyperparams"] = ckpt["hyperparams"]
            if "armies" in ckpt and isinstance(ckpt["armies"], list) and len(ckpt["armies"]) > 0:
                meta["armies"] = ckpt["armies"]
            if "villages" in ckpt and isinstance(ckpt["villages"], list) and len(ckpt["villages"]) > 0:
                meta["villages"] = ckpt["villages"]
            meta["army_names"] = [a.get("name", f"Army #{i+1}") for i, a in enumerate(meta["armies"])]
            meta["village_names"] = [v.get("name", f"Village #{i+1}") for i, v in enumerate(meta["villages"])]
        except Exception:
            pass
        items.append(meta)

    items.sort(key=lambda x: (x["filename"] == "latest_attacker.pt", x["mtime"]), reverse=True)
    return items


def resolve_model_path(model_file: Optional[str]) -> Optional[str]:
    ensure_trained_models_dir()
    if not model_file or model_file in ("scratch", "none", "new"):
        return None
    candidate = os.path.join(TRAINED_MODELS_DIR, os.path.basename(model_file))
    if os.path.exists(candidate):
        return candidate
    if os.path.exists(model_file):
        return model_file
    if os.path.exists(DEFAULT_CKPT_PATH):
        return DEFAULT_CKPT_PATH
    return None


def _load_state_dict_flexible(model: torch.nn.Module, saved_sd: Dict[str, Any]) -> None:
    """
    Loads `saved_sd` into `model` while migrating any legacy 8-channel stem conv weights
    (`(32, 8, 3, 3)`) into the first 8 channels of the 10-channel stem (`(32, 10, 3, 3)`).
    """
    current_sd = model.state_dict()
    filtered_sd: Dict[str, Any] = {}
    for k, v in saved_sd.items():
        if k not in current_sd:
            continue
        cur_t = current_sd[k]
        if hasattr(v, "shape") and v.shape == cur_t.shape:
            filtered_sd[k] = v
        elif (
            hasattr(v, "shape")
            and len(v.shape) == 4
            and len(cur_t.shape) == 4
            and v.shape[0] == cur_t.shape[0]
            and v.shape[2:] == cur_t.shape[2:]
            and v.shape[1] < cur_t.shape[1]
        ):
            migrated = cur_t.clone()
            migrated[:, : v.shape[1], :, :] = v.to(migrated.device, dtype=migrated.dtype)
            filtered_sd[k] = migrated
    model.load_state_dict(filtered_sd, strict=False)


def load_all_models(
    device: torch.device,
    attacker_model_file: Optional[str] = "latest_attacker.pt",
    num_armies: Optional[int] = None,
    num_villages: Optional[int] = None,
) -> Tuple[CoCActorCritic, AttackerArmySelectorNet, DefenderVillageSelectorNet, Dict[str, Any]]:
    ensure_trained_models_dir()
    attacker_ckpt_meta: Dict[str, Any] = {}
    atk_path = resolve_model_path(attacker_model_file)
    if atk_path and os.path.exists(atk_path):
        try:
            attacker_ckpt_meta = torch.load(atk_path, map_location=device, weights_only=False)
        except Exception:
            attacker_ckpt_meta = {}

    live_attacker = CoCActorCritic(in_channels=10, army_context_dim=64).to(device)

    if "model_state_dict" in attacker_ckpt_meta and isinstance(attacker_ckpt_meta["model_state_dict"], dict):
        try:
            _load_state_dict_flexible(live_attacker, attacker_ckpt_meta["model_state_dict"])
        except Exception:
            pass

    if num_armies is None:
        if "armies" in attacker_ckpt_meta and isinstance(attacker_ckpt_meta["armies"], list):
            num_armies = max(1, len(attacker_ckpt_meta["armies"]))
        else:
            num_armies = 3
    if num_villages is None:
        if "villages" in attacker_ckpt_meta and isinstance(attacker_ckpt_meta["villages"], list):
            num_villages = max(1, len(attacker_ckpt_meta["villages"]))
        else:
            num_villages = 5

    army_selector = AttackerArmySelectorNet(in_channels=10, num_armies=num_armies).to(device)
    defender_selector = DefenderVillageSelectorNet(army_context_dim=64, num_villages=num_villages).to(device)

    for model, path in (
        (army_selector, ARMY_SELECTOR_CKPT_PATH),
        (defender_selector, DEFENDER_SELECTOR_CKPT_PATH),
    ):
        if os.path.exists(path):
            try:
                ckpt = torch.load(path, map_location=device, weights_only=False)
                if "model_state_dict" in ckpt and isinstance(ckpt["model_state_dict"], dict):
                    _load_state_dict_flexible(model, ckpt["model_state_dict"])
            except Exception:
                pass

    return live_attacker, army_selector, defender_selector, attacker_ckpt_meta


def get_meta_presets() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    cat = json.loads(coc_py.get_catalog_json())
    layouts = cat["preset_layouts"][:5]
    armies = cat["preset_armies"][:3]
    return layouts, armies


def masks_np_to_torch(
    masks_np: Dict[str, np.ndarray], device: torch.device, prevent_early_noop: bool = False
) -> Dict[str, torch.Tensor]:
    slot_type = torch.as_tensor(masks_np["slot_type"], dtype=torch.bool, device=device).unsqueeze(0)
    slot_idx = torch.as_tensor(masks_np["slot_idx"], dtype=torch.bool, device=device).unsqueeze(0)
    tile = torch.as_tensor(masks_np["tile"], dtype=torch.bool, device=device).unsqueeze(0)

    if prevent_early_noop and slot_type[0, 1:].any():
        slot_type = slot_type.clone()
        slot_type[0, 0] = False

    return {
        "slot_type": slot_type,
        "slot_idx": slot_idx,
        "tile": tile,
    }


def compute_selector_matrices(
    army_selector: AttackerArmySelectorNet,
    defender_selector: DefenderVillageSelectorNet,
    device: torch.device,
    history: Optional[List[Dict[str, Any]]] = None,
    layouts: Optional[List[Dict[str, Any]]] = None,
    armies: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Computes live policy probability matrices and empirical performance breakdowns for:
      - Attacker Model 1 (Villages -> Armies probability matrix & per-army stats)
      - Defender Model   (Armies -> Villages probability matrix & per-village stats)
      - Empirical usage %, recent 50-ep destruction %, overall avg %, peak %, and star rates.
    """
    default_layouts, default_armies = get_meta_presets()
    if layouts is None or len(layouts) == 0:
        layouts = default_layouts
    if armies is None or len(armies) == 0:
        armies = default_armies

    army_selector.eval()
    defender_selector.eval()

    env = CoCAttackerEnv(ticks_per_step=8)

    layout_obs_list = []
    for lay in layouts:
        obs_np, _ = env.reset(
            options={"layout_json": json.dumps(lay), "army_json": json.dumps(armies[0])}
        )
        layout_obs_list.append(obs_np)
    layout_obs_t = torch.as_tensor(
        np.stack(layout_obs_list), dtype=torch.float32, device=device
    )

    army_ctx_list = []
    for arm in armies:
        _, info = env.reset(
            options={"layout_json": json.dumps(layouts[0]), "army_json": json.dumps(arm)}
        )
        army_ctx_list.append(info["army_context"])
    army_ctx_t = torch.as_tensor(
        np.stack(army_ctx_list), dtype=torch.float32, device=device
    )

    with torch.no_grad():
        _, _, _, layout_vals, army_probs_t = army_selector.get_action_and_value(
            layout_obs_t, deterministic=True
        )
        _, _, _, def_vals, village_probs_t = defender_selector.get_action_and_value(
            army_ctx_t, deterministic=True
        )

    village_to_army_probs = army_probs_t.cpu().numpy().round(4).tolist()
    army_to_village_probs = village_probs_t.cpu().numpy().round(4).tolist()

    hist = history or []
    total_eps = len(hist)

    army_names = [a.get("name", f"Army #{i+1}") for i, a in enumerate(armies)]
    village_names = [v.get("name", f"Village #{i+1}") for i, v in enumerate(layouts)]

    army_stats = []
    for a_idx in range(len(armies)):
        recs = [r for r in hist if r.get("army_idx") == a_idx]
        n = len(recs)
        recent_recs = recs[-50:]
        avg_pct = round(float(np.mean([r["destruction_pct"] for r in recs])), 1) if n else 0.0
        recent_pct = (
            round(float(np.mean([r["destruction_pct"] for r in recent_recs])), 1)
            if recent_recs
            else 0.0
        )
        peak_pct = int(max((r["destruction_pct"] for r in recs), default=0))
        avg_stars = round(float(np.mean([r["stars"] for r in recs])), 2) if n else 0.0
        avg_rew = round(float(np.mean([r["reward"] for r in recs])), 2) if n else 0.0
        triples = sum(1 for r in recs if r["stars"] == 3)
        usage_pct = round(100.0 * n / max(1, total_eps), 1) if total_eps > 0 else round(100.0 / max(1, len(armies)), 1)
        sel_prob = round(
            float(np.mean([village_to_army_probs[v][a_idx] for v in range(len(layouts))]))
            * 100.0,
            1,
        )
        army_stats.append(
            {
                "army_idx": a_idx,
                "name": (
                    ARMY_SHORT_NAMES[a_idx]
                    if a_idx < len(ARMY_SHORT_NAMES)
                    else army_names[a_idx]
                ),
                "full_name": army_names[a_idx],
                "episodes": n,
                "usage_pct": usage_pct,
                "avg_pct": avg_pct,
                "recent_avg_pct": recent_pct,
                "peak_pct": peak_pct,
                "avg_stars": avg_stars,
                "avg_reward": avg_rew,
                "triple_rate": round(100.0 * triples / max(1, n), 1) if n else 0.0,
                "mean_selector_prob": usage_pct if total_eps > 0 else sel_prob,
                "selector_model_prob": sel_prob,
            }
        )

    village_stats = []
    for v_idx in range(len(layouts)):
        recs = [r for r in hist if r.get("village_idx") == v_idx]
        n = len(recs)
        recent_recs = recs[-50:]
        avg_pct = round(float(np.mean([r["destruction_pct"] for r in recs])), 1) if n else 0.0
        recent_pct = (
            round(float(np.mean([r["destruction_pct"] for r in recent_recs])), 1)
            if recent_recs
            else 0.0
        )
        avg_stars = round(float(np.mean([r["stars"] for r in recs])), 2) if n else 0.0
        holds = sum(1 for r in recs if r["stars"] < 3)
        usage_pct = round(100.0 * n / max(1, total_eps), 1) if total_eps > 0 else round(100.0 / max(1, len(layouts)), 1)
        sel_prob = round(
            float(np.mean([army_to_village_probs[a][v_idx] for a in range(len(armies))]))
            * 100.0,
            1,
        )
        village_stats.append(
            {
                "village_idx": v_idx,
                "name": (
                    VILLAGE_SHORT_NAMES[v_idx]
                    if v_idx < len(VILLAGE_SHORT_NAMES)
                    else village_names[v_idx]
                ),
                "full_name": village_names[v_idx],
                "episodes": n,
                "usage_pct": usage_pct,
                "avg_pct_allowed": avg_pct,
                "recent_avg_pct_allowed": recent_pct,
                "avg_stars_allowed": avg_stars,
                "hold_rate": round(100.0 * holds / max(1, n), 1) if n else 100.0,
                "mean_selector_prob": usage_pct if total_eps > 0 else sel_prob,
                "selector_model_prob": sel_prob,
            }
        )

    return {
        "armies": army_names,
        "villages": village_names,
        "village_to_army_probs": village_to_army_probs,
        "army_to_village_probs": army_to_village_probs,
        "layout_values": [round(float(x), 3) for x in layout_vals.cpu().tolist()],
        "defender_values": [round(float(x), 3) for x in def_vals.cpu().tolist()],
        "army_stats": army_stats,
        "village_stats": village_stats,
    }


def _discrete_action_to_battle_action_dict(
    army_dict: Dict[str, Any],
    slot_type: int,
    slot_idx: int,
    tile_x: int,
    tile_y: int,
    deploy_count: int = 1,
    deploy_fraction: float = 1.0,
) -> Optional[Any]:
    x = min(49, max(0, int(tile_x))) + 0.5
    y = min(49, max(0, int(tile_y))) + 0.5
    troops = army_dict.get("troops", [])
    heroes = army_dict.get("heroes", [])
    spells = army_dict.get("spells", [])

    if slot_type == 1 and 0 <= slot_idx < len(troops):
        cnt = max(1, int(deploy_count))
        if cnt > 1:
            return {
                "DeployTroopBatch": {
                    "troop_id": troops[slot_idx][0],
                    "x": x,
                    "y": y,
                    "count": cnt,
                }
            }
        return {
            "DeployTroop": {
                "troop_id": troops[slot_idx][0],
                "x": x,
                "y": y,
            }
        }
    if slot_type == 2 and 0 <= slot_idx < len(heroes):
        return {"DeployHero": {"hero_id": heroes[slot_idx][0], "x": x, "y": y}}
    if slot_type == 3 and 0 <= slot_idx < len(heroes):
        return {"ActivateHeroAbility": {"hero_id": heroes[slot_idx][0]}}
    if slot_type == 4:
        return {"DeploySiege": {"x": x, "y": y}}
    if slot_type == 5:
        return "PopSiegeMachine"
    if slot_type == 6 and 0 <= slot_idx < len(spells):
        return {"CastSpell": {"spell_id": spells[slot_idx][0], "x": x, "y": y}}
    return None


def simulate_model_rollout(
    model_file: Optional[str],
    layout_json: str,
    army_json: str,
    ticks_per_step: int = 8,
    max_steps: int = 120,
    deterministic: bool = False,
) -> Dict[str, Any]:
    """
    Runs a trained model from `trained_models/` on the specified (Village, Army)
    and returns the full schedule of actions and telemetry so the frontend can replay
    and test the exact neural network policy on the interactive village canvas.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    live_attacker, _, _, ckpt_meta = load_all_models(
        device, attacker_model_file=model_file
    )
    live_attacker.eval()

    army_dict = json.loads(army_json)
    remaining_slot_counts = [int(c) for _, c in army_dict.get("troops", [])]
    fraction_bins = (0.0, 0.25, 0.50, 0.75, 1.00)
    env = CoCAttackerEnv(
        layout_json=layout_json,
        army_json=army_json,
        ticks_per_step=ticks_per_step,
    )
    obs_np, info = env.reset()

    actions_schedule: List[Dict[str, Any]] = []
    noop_steps = 0
    steps_run = 0
    total_reward = 0.0

    for step_i in range(max_steps):
        current_tick = int(info.get("tick", step_i * ticks_per_step))
        obs_t = torch.as_tensor(obs_np, dtype=torch.float32, device=device).unsqueeze(0)
        army_ctx_t = torch.as_tensor(
            info["army_context"], dtype=torch.float32, device=device
        ).unsqueeze(0)
        masks_t = masks_np_to_torch(
            info["action_masks"], device, prevent_early_noop=(step_i == 0)
        )

        with torch.no_grad():
            action_t, _, entropy_t, value_t, diag = live_attacker.get_action_and_value(
                obs_t,
                masks=masks_t,
                deterministic=deterministic,
                army_context=army_ctx_t,
            )

        act = action_t.squeeze(0).cpu().tolist()
        s_type, s_idx, tx, ty = int(act[0]), int(act[1]), int(act[2]), int(act[3])
        frac_bin = int(act[4]) if len(act) >= 5 else 4
        deploy_fraction = fraction_bins[max(0, min(len(fraction_bins) - 1, frac_bin))]
        deploy_count = 1
        if s_type == 1 and 0 <= s_idx < len(remaining_slot_counts):
            avail = remaining_slot_counts[s_idx]
            if avail > 0:
                deploy_count = max(1, min(avail, int(round(avail * deploy_fraction))))
                remaining_slot_counts[s_idx] = max(0, avail - deploy_count)

        if s_type == 0:
            noop_steps += 1

        battle_action_obj = _discrete_action_to_battle_action_dict(
            army_dict,
            s_type,
            s_idx,
            tx,
            ty,
            deploy_count=deploy_count,
            deploy_fraction=deploy_fraction,
        )
        slot_probs = [
            round(float(p), 3) for p in diag["slot_type_probs"].squeeze(0).cpu().tolist()
        ]

        actions_schedule.append(
            {
                "step": step_i,
                "tick": current_tick,
                "slot_type": s_type,
                "slot_idx": s_idx,
                "tile_x": tx,
                "tile_y": ty,
                "deploy_fraction": round(float(deploy_fraction), 2),
                "deploy_count": int(deploy_count),
                "battle_action": battle_action_obj,
                "value": round(float(value_t.item()), 3),
                "entropy": round(float(entropy_t.item()), 3),
                "noop_prob": round(float(slot_probs[0]) * 100.0, 1),
            }
        )

        next_obs_np, _, terminated, truncated, next_info = env.step(
            np.array([s_type, s_idx, tx, ty, frac_bin], dtype=np.int64)
        )
        done = bool(terminated or truncated)
        total_reward += compute_custom_reward(next_info)
        steps_run += 1

        has_active_actions = bool(next_info["action_masks"]["slot_type"][1:].any())
        if not done and (not has_active_actions or step_i == max_steps - 1):
            next_obs_np, _, ff_done, ff_info = env.finish_battle()
            total_reward += compute_custom_reward(ff_info)
            next_info = ff_info
            done = bool(ff_done)

        obs_np = next_obs_np
        info = next_info
        if done:
            break

    return {
        "model_file": model_file or "latest_attacker.pt",
        "model_episode": int(ckpt_meta.get("episode", 0)),
        "ticks_per_step": ticks_per_step,
        "steps_run": steps_run,
        "final_tick": int(info.get("tick", steps_run * ticks_per_step)),
        "destruction_pct": int(info["destruction_pct"]),
        "stars": int(info["stars"]),
        "total_reward": round(float(total_reward), 2),
        "noop_pct": round(100.0 * noop_steps / max(1, steps_run), 1),
        "actions_schedule": actions_schedule,
        "armies": ckpt_meta.get("armies", []),
        "villages": ckpt_meta.get("villages", []),
        "hyperparams": ckpt_meta.get("hyperparams", {}),
    }


def train_pytorch_ppo(
    episodes: int = 24,
    ticks_per_step: int = 8,
    max_steps_per_ep: int = 120,
    batch_episodes: int = 4,
    minibatch_size: int = 64,
    lr: float = 3e-4,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
    clip_coef: float = 0.2,
    ent_coef: float = 0.015,
    ppo_epochs: int = 4,
    use_reference: bool = False,
    curriculum_deploy: bool = True,
    co_evolve_defender: bool = False,
    training_mode: str = "live_attacker",
    matchup_mode: str = "random",
    resume_from: Optional[str] = "latest_attacker.pt",
    save_name: Optional[str] = None,
    layout_json: Optional[str] = None,
    army_json: Optional[str] = None,
    armies_json: Optional[Any] = None,
    villages_json: Optional[Any] = None,
    on_episode_callback: Optional[Callable[[Dict[str, Any]], bool]] = None,
) -> Dict[str, Any]:
    """
    Trains the 3-Model TH18 AI System with full checkpoint resume & save support in `trained_models/`.
    """
    ensure_trained_models_dir()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    default_layouts, default_armies = get_meta_presets()
    layouts = default_layouts
    armies = default_armies

    is_resuming = bool(resume_from and resume_from not in ("scratch", "none", "new"))
    loaded_ckpt: Dict[str, Any] = {}

    if is_resuming:
        atk_path = resolve_model_path(resume_from)
        if atk_path and os.path.exists(atk_path):
            try:
                loaded_ckpt = torch.load(atk_path, map_location=device, weights_only=False)
            except Exception:
                loaded_ckpt = {}

        # Strictly enforce and retrieve the bundled villages and attack compositions from checkpoint
        if "armies" in loaded_ckpt and isinstance(loaded_ckpt["armies"], list) and len(loaded_ckpt["armies"]) > 0:
            armies = loaded_ckpt["armies"]
        if "villages" in loaded_ckpt and isinstance(loaded_ckpt["villages"], list) and len(loaded_ckpt["villages"]) > 0:
            layouts = loaded_ckpt["villages"]
    else:
        # Fresh training: parse selected attack compositions and villages
        if armies_json:
            try:
                parsed_armies = json.loads(armies_json) if isinstance(armies_json, str) else armies_json
                if isinstance(parsed_armies, list) and len(parsed_armies) > 0:
                    armies = parsed_armies
            except Exception:
                pass
        elif army_json:
            try:
                parsed_army = json.loads(army_json) if isinstance(army_json, str) else army_json
                armies = [parsed_army]
            except Exception:
                pass

        if villages_json:
            try:
                parsed_layouts = json.loads(villages_json) if isinstance(villages_json, str) else villages_json
                if isinstance(parsed_layouts, list) and len(parsed_layouts) > 0:
                    layouts = parsed_layouts
            except Exception:
                pass
        elif layout_json:
            try:
                parsed_layout = json.loads(layout_json) if isinstance(layout_json, str) else layout_json
                layouts = [parsed_layout]
            except Exception:
                pass

    live_attacker, army_selector, defender_selector, loaded_ckpt = load_all_models(
        device,
        attacker_model_file=resume_from if is_resuming else None,
        num_armies=len(armies),
        num_villages=len(layouts),
    )
    ensure_architecture_diagrams(live_attacker)

    opt_live = torch.optim.Adam(live_attacker.parameters(), lr=lr, eps=1e-5)
    # Restore optimizer momentum if resuming from a checkpoint, while applying the new LR!
    if loaded_ckpt and "optimizer_state_dict" in loaded_ckpt:
        try:
            opt_live.load_state_dict(loaded_ckpt["optimizer_state_dict"])
            for pg in opt_live.param_groups:
                pg["lr"] = lr
        except Exception:
            pass

    opt_army_sel = torch.optim.Adam(army_selector.parameters(), lr=lr, eps=1e-5)
    opt_def_sel = torch.optim.Adam(defender_selector.parameters(), lr=lr, eps=1e-5)

    base_trained_episodes = int(loaded_ckpt.get("episode", 0)) if loaded_ckpt else 0
    best_pct = int(loaded_ckpt.get("best_pct", 0)) if loaded_ckpt else 0
    best_stars = int(loaded_ckpt.get("best_stars", 0)) if loaded_ckpt else 0
    best_reward = float(loaded_ckpt.get("best_reward", -1e9)) if loaded_ckpt else -1e9

    env = CoCAttackerEnv(
        layout_json=json.dumps(layouts[0]),
        army_json=json.dumps(armies[0]),
        ticks_per_step=ticks_per_step,
    )

    evolver: Optional[CoCDefenderEvolution] = None
    defender_pop: List[Dict[str, Any]] = []
    defender_gen = 0
    defender_fitness = 0.0
    best_defender_layout: Optional[Dict[str, Any]] = None
    if co_evolve_defender:
        base_layout_obj = json.loads(layout_json) if layout_json else layouts[0]
        evolver = CoCDefenderEvolution(base_layout=base_layout_obj)
        best_defender_layout = evolver.base_layout
        defender_pop = [evolver.base_layout] + [
            evolver.mutate_layout(evolver.base_layout, num_swaps=6) for _ in range(11)
        ]

    history: List[Dict[str, Any]] = []

    buf_obs: List[torch.Tensor] = []
    buf_ctx: List[torch.Tensor] = []
    buf_act: List[torch.Tensor] = []
    buf_lp: List[torch.Tensor] = []
    buf_adv: List[torch.Tensor] = []
    buf_ret: List[torch.Tensor] = []
    buf_m_type: List[torch.Tensor] = []
    buf_m_idx: List[torch.Tensor] = []
    buf_m_tile: List[torch.Tensor] = []
    buf_eps_count = 0

    atk_sel_inputs: List[torch.Tensor] = []
    atk_sel_acts: List[torch.Tensor] = []
    atk_sel_lps: List[torch.Tensor] = []
    atk_sel_rets: List[float] = []

    def_sel_inputs: List[torch.Tensor] = []
    def_sel_acts: List[torch.Tensor] = []
    def_sel_lps: List[torch.Tensor] = []
    def_sel_rets: List[float] = []

    last_metrics = {
        "policy_loss": 0.0,
        "value_loss": 0.0,
        "entropy": 0.0,
        "approx_kl": 0.0,
        "clip_fraction": 0.0,
    }

    b_eps = max(1, batch_episodes)
    cycle_block = (
        ["live_attacker"] * b_eps
        + ["defender_selector"] * 3
        + ["attacker_selector"] * 3
    )

    hyperparams_meta = {
        "lr": lr,
        "batch_episodes": batch_episodes,
        "minibatch_size": minibatch_size,
        "ppo_epochs": ppo_epochs,
        "episodes": episodes,
        "ticks_per_step": ticks_per_step,
        "training_mode": training_mode,
        "matchup_mode": matchup_mode,
        "co_evolve_defender": co_evolve_defender,
        "resumed_from": resume_from or "scratch",
    }

    army_names = [a.get("name", f"Army #{i+1}") for i, a in enumerate(armies)]
    village_names = [v.get("name", f"Village #{i+1}") for i, v in enumerate(layouts)]

    def _save_attacker_ckpt(path: str, ep_total: int) -> None:
        payload = {
            "model_state_dict": live_attacker.state_dict(),
            "optimizer_state_dict": opt_live.state_dict(),
            "episode": ep_total,
            "best_pct": best_pct,
            "best_stars": best_stars,
            "best_reward": best_reward,
            "model_type": "live_attacker",
            "hyperparams": hyperparams_meta,
            "armies": armies,
            "villages": layouts,
            "army_names": army_names,
            "village_names": village_names,
            "use_reference": use_reference,
        }
        torch.save(payload, path)

    for ep in range(1, episodes + 1):
        t0 = time.perf_counter()
        cumulative_ep = base_trained_episodes + ep

        if training_mode == "cycle":
            active_model = cycle_block[(ep - 1) % len(cycle_block)]
        elif training_mode in ("live_attacker", "attacker_selector", "defender_selector"):
            active_model = training_mode
        else:
            active_model = "live_attacker"

        live_attacker.train(active_model == "live_attacker")
        army_selector.train(active_model == "attacker_selector")
        defender_selector.train(active_model == "defender_selector")

        if co_evolve_defender and evolver is not None and (ep == 1 or ep % 6 == 0):
            defender_pop, ranked_scores = evolver.evolve_generation(defender_pop, elite_k=4)
            defender_gen += 1
            _, _, best_fit = ranked_scores[0]
            defender_fitness = round(float(best_fit), 2)
            best_defender_layout = defender_pop[0]

        # ---------------------------------------------------------------------
        # Pre-Battle Phase: Defender Village Selection & Attacker Army Selection
        # ---------------------------------------------------------------------
        if active_model == "defender_selector":
            army_idx = len(def_sel_inputs) % len(armies)
            chosen_army_dict = armies[army_idx]
            _, init_info = env.reset(
                options={
                    "layout_json": json.dumps(layouts[0]),
                    "army_json": json.dumps(chosen_army_dict),
                }
            )
            init_army_ctx_t = torch.as_tensor(
                init_info["army_context"], dtype=torch.float32, device=device
            ).unsqueeze(0)
            with torch.no_grad():
                def_act_t, def_logprob_t, _, _, def_probs_t = (
                    defender_selector.get_action_and_value(init_army_ctx_t)
                )
            if random.random() < 0.35:
                village_idx = (ep + len(def_sel_inputs)) % len(layouts)
                def_act_t = torch.tensor([village_idx], dtype=torch.long, device=device)
                with torch.no_grad():
                    _, def_logprob_t, _, _, _ = defender_selector.get_action_and_value(
                        init_army_ctx_t, action=def_act_t
                    )
            else:
                village_idx = int(def_act_t.item()) % len(layouts)

            chosen_layout_dict = layouts[village_idx]
            obs_np, info = env.reset(
                options={
                    "layout_json": json.dumps(chosen_layout_dict),
                    "army_json": json.dumps(chosen_army_dict),
                }
            )
            with torch.no_grad():
                init_layout_obs_t = torch.as_tensor(
                    obs_np, dtype=torch.float32, device=device
                ).unsqueeze(0)
                _, _, _, _, army_probs_t = army_selector.get_action_and_value(init_layout_obs_t)

        elif active_model == "attacker_selector":
            village_idx = ((ep - 1) // 3) % len(layouts)
            chosen_layout_dict = layouts[village_idx]
            obs_init, _ = env.reset(
                options={
                    "layout_json": json.dumps(chosen_layout_dict),
                    "army_json": json.dumps(armies[0]),
                }
            )
            init_layout_obs_t = torch.as_tensor(
                obs_init, dtype=torch.float32, device=device
            ).unsqueeze(0)
            army_idx = len(atk_sel_inputs) % len(armies)
            atk_sel_act_t = torch.tensor([army_idx], dtype=torch.long, device=device)
            with torch.no_grad():
                _, atk_sel_logprob_t, _, _, army_probs_t = (
                    army_selector.get_action_and_value(
                        init_layout_obs_t, action=atk_sel_act_t
                    )
                )
            chosen_army_dict = armies[army_idx]

            obs_np, info = env.reset(
                options={
                    "layout_json": json.dumps(chosen_layout_dict),
                    "army_json": json.dumps(chosen_army_dict),
                }
            )
            with torch.no_grad():
                init_army_ctx_t = torch.as_tensor(
                    info["army_context"], dtype=torch.float32, device=device
                ).unsqueeze(0)
                _, _, _, _, def_probs_t = defender_selector.get_action_and_value(init_army_ctx_t)

        else:
            if matchup_mode == "random":
                village_idx = random.randrange(len(layouts))
                army_idx = random.randrange(len(armies))
                chosen_layout_dict = layouts[village_idx]
                chosen_army_dict = armies[army_idx]
            elif matchup_mode == "round_robin":
                village_idx = (ep - 1) % len(layouts)
                army_idx = ((ep - 1) // len(layouts)) % len(armies)
                chosen_layout_dict = layouts[village_idx]
                chosen_army_dict = armies[army_idx]
            elif matchup_mode == "fixed_current":
                chosen_layout_dict = (
                    json.loads(layout_json) if layout_json else layouts[0]
                )
                chosen_army_dict = json.loads(army_json) if army_json else armies[0]
                village_idx = next(
                    (
                        i
                        for i, l in enumerate(layouts)
                        if l.get("name") == chosen_layout_dict.get("name")
                    ),
                    0,
                )
                army_idx = next(
                    (
                        i
                        for i, a in enumerate(armies)
                        if a.get("name") == chosen_army_dict.get("name")
                    ),
                    0,
                )
            else:
                army_idx = random.randrange(len(armies))
                _, tmp_info = env.reset(
                    options={
                        "layout_json": json.dumps(layouts[0]),
                        "army_json": json.dumps(armies[army_idx]),
                    }
                )
                with torch.no_grad():
                    tmp_ctx_t = torch.as_tensor(
                        tmp_info["army_context"], dtype=torch.float32, device=device
                    ).unsqueeze(0)
                    def_act, _, _, _, _ = defender_selector.get_action_and_value(tmp_ctx_t)
                    village_idx = int(def_act.item()) % len(layouts)
                    obs_init, _ = env.reset(
                        options={
                            "layout_json": json.dumps(layouts[village_idx]),
                            "army_json": json.dumps(armies[0]),
                        }
                    )
                    init_layout_obs_t = torch.as_tensor(
                        obs_init, dtype=torch.float32, device=device
                    ).unsqueeze(0)
                    atk_act, _, _, _, _ = army_selector.get_action_and_value(
                        init_layout_obs_t
                    )
                    army_idx = int(atk_act.item()) % len(armies)
                chosen_layout_dict = layouts[village_idx]
                chosen_army_dict = armies[army_idx]

            if co_evolve_defender and best_defender_layout is not None and ep % 3 == 0:
                chosen_layout_dict = best_defender_layout

            obs_np, info = env.reset(
                options={
                    "layout_json": json.dumps(chosen_layout_dict),
                    "army_json": json.dumps(chosen_army_dict),
                }
            )
            with torch.no_grad():
                init_layout_obs_t = torch.as_tensor(
                    obs_np, dtype=torch.float32, device=device
                ).unsqueeze(0)
                _, _, _, _, army_probs_t = army_selector.get_action_and_value(init_layout_obs_t)
                init_army_ctx_t = torch.as_tensor(
                    info["army_context"], dtype=torch.float32, device=device
                ).unsqueeze(0)
                _, _, _, _, def_probs_t = defender_selector.get_action_and_value(init_army_ctx_t)

        # ---------------------------------------------------------------------
        # Live Battle Rollout using Model 2 (`CoCActorCritic` with full army_context)
        # ---------------------------------------------------------------------
        obs_list: List[torch.Tensor] = []
        army_ctx_list: List[torch.Tensor] = []
        actions_list: List[torch.Tensor] = []
        logprobs_list: List[torch.Tensor] = []
        values_list: List[torch.Tensor] = []
        rewards_list: List[float] = []
        dones_list: List[float] = []
        mask_type_list: List[torch.Tensor] = []
        mask_idx_list: List[torch.Tensor] = []
        mask_tile_list: List[torch.Tensor] = []

        ep_custom_reward = 0.0
        steps_run = 0
        noop_steps = 0
        deploy_steps = 0
        spell_steps = 0
        ability_steps = 0

        for step_i in range(max_steps_per_ep):
            obs_t = torch.as_tensor(obs_np, dtype=torch.float32, device=device).unsqueeze(0)
            army_ctx_t = torch.as_tensor(
                info["army_context"], dtype=torch.float32, device=device
            ).unsqueeze(0)

            prevent_noop = curriculum_deploy and (step_i == 0)
            masks_t = masks_np_to_torch(
                info["action_masks"], device, prevent_early_noop=prevent_noop
            )

            with torch.no_grad():
                action_t, logprob_t, _, value_t, _ = live_attacker.get_action_and_value(
                    obs_t, masks=masks_t, army_context=army_ctx_t
                )

            action_np = action_t.squeeze(0).cpu().numpy()
            chosen_slot_type = int(action_np[0])
            if chosen_slot_type == 0:
                noop_steps += 1
            elif chosen_slot_type in (1, 2, 4):
                deploy_steps += 1
            elif chosen_slot_type == 6:
                spell_steps += 1
            elif chosen_slot_type in (3, 5):
                ability_steps += 1

            next_obs_np, _engine_rew, terminated, truncated, next_info = env.step(action_np)
            done = bool(terminated or truncated)

            custom_r = compute_custom_reward(next_info)
            if chosen_slot_type == 0:
                if next_info["army_context"][3] == 0.0 and bool(
                    next_info["action_masks"]["slot_type"][1:].any()
                ):
                    custom_r -= 0.04
            elif not next_info.get("invalid_action", False):
                custom_r += 0.035

            has_active_actions = bool(next_info["action_masks"]["slot_type"][1:].any())
            if not done and (not has_active_actions or step_i == max_steps_per_ep - 1):
                next_obs_np, _ff_rew, ff_done, ff_info = env.finish_battle()
                custom_r += compute_custom_reward(ff_info)
                next_info = ff_info
                done = bool(ff_done)

            ep_custom_reward += custom_r
            steps_run += 1

            obs_list.append(obs_t.squeeze(0))
            army_ctx_list.append(army_ctx_t.squeeze(0))
            actions_list.append(action_t.squeeze(0))
            logprobs_list.append(logprob_t.squeeze(0))
            values_list.append(value_t.squeeze(0))
            rewards_list.append(custom_r)
            dones_list.append(1.0 if done else 0.0)
            mask_type_list.append(masks_t["slot_type"].squeeze(0))
            mask_idx_list.append(masks_t["slot_idx"].squeeze(0))
            mask_tile_list.append(masks_t["tile"].squeeze(0))

            obs_np = next_obs_np
            info = next_info
            if done:
                break

        pct = int(info["destruction_pct"])
        stars = int(info["stars"])
        # 50/50 complementary defender score (0..100 total)
        defender_reward = (
            (100.0 - float(pct)) * 0.50
            + (3.0 - float(stars)) * (50.0 / 3.0)
        )

        # ---------------------------------------------------------------------
        # Rollout Buffer Accumulation & Shuffled Minibatch PPO Updates
        # ---------------------------------------------------------------------
        if active_model == "live_attacker":
            with torch.no_grad():
                next_obs_t = torch.as_tensor(
                    obs_np, dtype=torch.float32, device=device
                ).unsqueeze(0)
                next_ctx_t = torch.as_tensor(
                    info["army_context"], dtype=torch.float32, device=device
                ).unsqueeze(0)
                _, _, _, next_val_t, _ = live_attacker.get_action_and_value(
                    next_obs_t, army_context=next_ctx_t
                )

            rewards_t = torch.tensor(rewards_list, dtype=torch.float32, device=device)
            values_t = torch.stack(values_list)
            dones_t = torch.tensor(dones_list, dtype=torch.float32, device=device)

            advantages_t, returns_t = compute_gae(
                rewards=rewards_t,
                values=values_t,
                dones=dones_t,
                next_value=next_val_t.squeeze(0),
                gamma=gamma,
                gae_lambda=gae_lambda,
            )

            buf_obs.append(torch.stack(obs_list))
            buf_ctx.append(torch.stack(army_ctx_list))
            buf_act.append(torch.stack(actions_list))
            buf_lp.append(torch.stack(logprobs_list))
            buf_adv.append(advantages_t)
            buf_ret.append(returns_t)
            buf_m_type.append(torch.stack(mask_type_list))
            buf_m_idx.append(torch.stack(mask_idx_list))
            buf_m_tile.append(torch.stack(mask_tile_list))
            buf_eps_count += 1

            if buf_eps_count >= b_eps or ep == episodes:
                obs_b = torch.cat(buf_obs, dim=0)
                army_ctx_b = torch.cat(buf_ctx, dim=0)
                actions_b = torch.cat(buf_act, dim=0)
                old_logprobs_b = torch.cat(buf_lp, dim=0)
                adv_b = torch.cat(buf_adv, dim=0)
                ret_b = torch.cat(buf_ret, dim=0)
                masks_b = {
                    "slot_type": torch.cat(buf_m_type, dim=0),
                    "slot_idx": torch.cat(buf_m_idx, dim=0),
                    "tile": torch.cat(buf_m_tile, dim=0),
                }

                last_metrics = ppo_minibatch_update(
                    model=live_attacker,
                    optimizer=opt_live,
                    obs_b=obs_b,
                    actions_b=actions_b,
                    old_logprobs_b=old_logprobs_b,
                    advantages_b=adv_b,
                    returns_b=ret_b,
                    masks_b=masks_b,
                    army_context_b=army_ctx_b,
                    ppo_epochs=ppo_epochs,
                    minibatch_size=minibatch_size,
                    clip_coef=clip_coef,
                    ent_coef=ent_coef,
                )

                buf_obs.clear()
                buf_ctx.clear()
                buf_act.clear()
                buf_lp.clear()
                buf_adv.clear()
                buf_ret.clear()
                buf_m_type.clear()
                buf_m_idx.clear()
                buf_m_tile.clear()
                buf_eps_count = 0

                # Periodically sync latest weights so live inspection reflects ongoing training
                _save_attacker_ckpt(DEFAULT_CKPT_PATH, cumulative_ep)

        elif active_model == "defender_selector":
            def_sel_inputs.append(init_army_ctx_t.squeeze(0))
            def_sel_acts.append(def_act_t.squeeze(0).detach())
            def_sel_lps.append(def_logprob_t.squeeze(0).detach())
            def_sel_rets.append(defender_reward)

            if len(def_sel_inputs) >= 3 or ep == episodes:
                inp_b = torch.stack(def_sel_inputs)
                act_b = torch.stack(def_sel_acts)
                lp_b = torch.stack(def_sel_lps)
                ret_b = torch.tensor(def_sel_rets, dtype=torch.float32, device=device)
                for _ in range(ppo_epochs):
                    last_metrics = selector_ppo_update_step(
                        model=defender_selector,
                        optimizer=opt_def_sel,
                        inputs_b=inp_b,
                        actions_b=act_b,
                        old_logprobs_b=lp_b,
                        returns_b=ret_b,
                        ent_coef=0.05,
                    )
                def_sel_inputs.clear()
                def_sel_acts.clear()
                def_sel_lps.clear()
                def_sel_rets.clear()

        elif active_model == "attacker_selector":
            atk_sel_inputs.append(init_layout_obs_t.squeeze(0))
            atk_sel_acts.append(atk_sel_act_t.squeeze(0).detach())
            atk_sel_lps.append(atk_sel_logprob_t.squeeze(0).detach())
            atk_sel_rets.append(ep_custom_reward)

            if len(atk_sel_inputs) >= 3 or ep == episodes:
                inp_b = torch.stack(atk_sel_inputs)
                act_b = torch.stack(atk_sel_acts)
                lp_b = torch.stack(atk_sel_lps)
                ret_b = torch.tensor(atk_sel_rets, dtype=torch.float32, device=device)
                for _ in range(ppo_epochs):
                    last_metrics = selector_ppo_update_step(
                        model=army_selector,
                        optimizer=opt_army_sel,
                        inputs_b=inp_b,
                        actions_b=act_b,
                        old_logprobs_b=lp_b,
                        returns_b=ret_b,
                        ent_coef=0.05,
                    )
                atk_sel_inputs.clear()
                atk_sel_acts.clear()
                atk_sel_lps.clear()
                atk_sel_rets.clear()

        elapsed = max(1e-6, time.perf_counter() - t0)
        sim_ticks = info.get("tick", steps_run * ticks_per_step)
        fps_ticks = sim_ticks / elapsed

        if pct > best_pct or (pct == best_pct and ep_custom_reward > best_reward):
            best_pct = max(best_pct, pct)
            best_stars = max(best_stars, stars)
            best_reward = max(best_reward, ep_custom_reward)
            _save_attacker_ckpt(DEFAULT_CKPT_PATH, cumulative_ep)

        if active_model == "attacker_selector":
            torch.save(
                {
                    "model_state_dict": army_selector.state_dict(),
                    "episode": cumulative_ep,
                    "model_type": "attacker_selector",
                },
                ARMY_SELECTOR_CKPT_PATH,
            )
        elif active_model == "defender_selector":
            torch.save(
                {
                    "model_state_dict": defender_selector.state_dict(),
                    "episode": cumulative_ep,
                    "model_type": "defender_selector",
                },
                DEFENDER_SELECTOR_CKPT_PATH,
            )

        recent_rewards = [h["reward"] for h in history[-9:]] + [ep_custom_reward]
        avg_reward_10 = float(np.mean(recent_rewards))
        recent_pcts = [h["destruction_pct"] for h in history[-9:]] + [pct]
        avg_pct_10 = float(np.mean(recent_pcts))
        recent_pcts_50 = [h["destruction_pct"] for h in history[-49:]] + [pct]
        avg_pct_50 = float(np.mean(recent_pcts_50))
        noop_pct = round(100.0 * noop_steps / max(1, steps_run), 1)

        ep_record = {
            "episode": ep,
            "cumulative_episode": cumulative_ep,
            "total_episodes": episodes,
            "active_model": active_model,
            "army_idx": army_idx,
            "army_name": (
                ARMY_SHORT_NAMES[army_idx]
                if army_idx < len(ARMY_SHORT_NAMES)
                else f"Army {army_idx}"
            ),
            "village_idx": village_idx,
            "village_name": (
                VILLAGE_SHORT_NAMES[village_idx]
                if village_idx < len(VILLAGE_SHORT_NAMES)
                else f"Village {village_idx}"
            ),
            "reward": round(float(ep_custom_reward), 3),
            "avg_reward_10": round(avg_reward_10, 3),
            "defender_reward": round(float(defender_reward), 3),
            "destruction_pct": pct,
            "avg_pct_10": round(avg_pct_10, 1),
            "avg_pct_50": round(avg_pct_50, 1),
            "stars": stars,
            "best_pct": best_pct,
            "best_stars": best_stars,
            "noop_pct": noop_pct,
            "deploy_steps": deploy_steps,
            "spell_steps": spell_steps,
            "ability_steps": ability_steps,
            "policy_loss": round(last_metrics.get("policy_loss", 0.0), 4),
            "value_loss": round(last_metrics.get("value_loss", 0.0), 4),
            "entropy": round(last_metrics.get("entropy", 0.0), 3),
            "approx_kl": round(last_metrics.get("approx_kl", 0.0), 4),
            "fps_ticks": round(fps_ticks, 0),
            "steps": steps_run,
            "defender_gen": defender_gen,
            "defender_fitness": defender_fitness,
            "army_probs": [round(float(x), 3) for x in army_probs_t.squeeze(0).cpu().tolist()],
            "village_probs": [round(float(x), 3) for x in def_probs_t.squeeze(0).cpu().tolist()],
            "evolved_layout": best_defender_layout,
        }
        history.append(ep_record)

        if on_episode_callback is not None:
            should_continue = on_episode_callback(ep_record)
            if not should_continue:
                break

    final_cum_ep = base_trained_episodes + len(history)
    _save_attacker_ckpt(DEFAULT_CKPT_PATH, final_cum_ep)

    # Also save a snapshot in `trained_models/` with either custom `save_name` or auto-snapshot name
    if save_name and save_name.strip():
        named_file = sanitize_model_filename(save_name)
    else:
        named_file = f"attacker_ep{final_cum_ep}_{best_pct}pct_{best_stars}star.pt"
    named_path = os.path.join(TRAINED_MODELS_DIR, named_file)
    _save_attacker_ckpt(named_path, final_cum_ep)

    # Automatically update the Obsidian Vault & Canvas with the new training results
    try:
        from coc_rl.vault_generator import update_or_register_training_run
        update_or_register_training_run(
            checkpoint_path=named_path,
            resumed_from=resume_from,
            base_episodes=base_trained_episodes,
            new_episodes=len(history),
            history=history,
            hyperparams=hyperparams_meta,
            best_pct=best_pct,
            best_stars=best_stars,
            best_reward=best_reward,
            training_mode=training_mode,
        )
    except Exception as e:
        print(f"[vault_generator] Note: could not update obsidian vault: {e}")

    selector_matrices = compute_selector_matrices(
        army_selector, defender_selector, device, history=history, layouts=layouts, armies=armies
    )
    return {
        "history": history,
        "best_pct": best_pct,
        "best_stars": best_stars,
        "checkpoint_path": named_path,
        "saved_filename": named_file,
        "evolved_layout": best_defender_layout,
        "selector_matrices": selector_matrices,
        "armies": armies,
        "villages": layouts,
        "army_names": army_names,
        "village_names": village_names,
    }


def run_attacker_benchmark() -> None:
    print("=== 1. Attacker Gymnasium RL Environment Benchmark ===")
    env = CoCAttackerEnv(ticks_per_step=5)
    obs, info = env.reset()
    valid_tiles = env.valid_deploy_tiles()
    print(f"Observation tensor shape: {obs.shape} (dtype={obs.dtype})")
    print(f"Army context vector shape: {info['army_context'].shape}")
    print(f"Valid deployment tiles outside village red-zone: {len(valid_tiles)} / 2500")

    t0 = time.perf_counter()
    total_steps = 0
    total_reward = 0.0

    west_breach_tiles = [(x, y) for (x, y) in valid_tiles if x == 1 and 17 <= y <= 31]
    for step_idx in range(360):
        tx, ty = random.choice(west_breach_tiles)
        if step_idx < 36:
            slot_type = 1
            action = np.array([slot_type, step_idx % 6, tx, ty], dtype=np.int64)
        elif 36 <= step_idx < 40:
            action = np.array([2, step_idx - 36, 1, 21 + (step_idx - 36) * 2], dtype=np.int64)
        elif step_idx == 40:
            action = np.array([4, 0, 1, 24], dtype=np.int64)
        elif step_idx in (48, 60, 75, 90, 105, 120):
            action = np.array([6, (step_idx // 15) % 4, 21, 24], dtype=np.int64)
        elif step_idx in (65, 66, 67, 68):
            action = np.array([3, step_idx - 65, 24, 24], dtype=np.int64)
        else:
            action = np.array([0, 0, 0, 0], dtype=np.int64)

        obs, reward, terminated, truncated, info = env.step(action)
        total_reward += reward
        total_steps += 1
        if terminated or truncated:
            break

    elapsed = time.perf_counter() - t0
    sim_ticks = total_steps * env.ticks_per_step
    print(
        f"Completed Episode in {elapsed * 1000:.2f} ms "
        f"({sim_ticks / elapsed:,.0f} sim ticks/sec)"
    )
    print(
        f"Result -> Destruction: {info['destruction_pct']}% | "
        f"Stars: {info['stars']}★ | Total Dense Reward: {total_reward:.2f}\n"
    )


def run_defender_evolution() -> None:
    print("=== 2. Defender Base-Layout Evolution (Rayon Multi-Core) ===")
    evolver = CoCDefenderEvolution()
    population = [evolver.base_layout] + [
        evolver.mutate_layout(evolver.base_layout, num_swaps=6) for _ in range(11)
    ]

    t0 = time.perf_counter()
    for gen in range(1, 4):
        population, ranked_scores = evolver.evolve_generation(population, elite_k=4)
        best_pct, best_stars, best_fitness = ranked_scores[0]
        print(
            f"Generation {gen} | Best Village Defense -> "
            f"Avg Attacker Destruction: {best_pct}% | Avg Stars Allowed: {best_stars}★ | "
            f"Defense Fitness: {best_fitness:.1f}"
        )

    elapsed = time.perf_counter() - t0
    print(f"Evaluated 3 generations × 12 layouts × 3 meta armies = 108 full TH18 battles in {elapsed:.2f}s")

    val = json.loads(coc_py.validate_layout_json(json.dumps(population[0])))
    print(
        f"Best Evolved Layout Validation: is_valid={val['is_valid']} "
        f"(Buildings={val['total_buildings']}, Walls={val['total_walls']}/325, Traps={val['total_traps']}/48)"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CoC TH18 3-Model AI Trainer & Benchmark")
    parser.add_argument("--train-ppo", action="store_true", help="Run 3-model PyTorch GPU PPO training loop")
    parser.add_argument("--episodes", type=int, default=20, help="Number of training episodes")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate")
    parser.add_argument(
        "--mode",
        type=str,
        default="live_attacker",
        choices=["live_attacker", "cycle", "attacker_selector", "defender_selector"],
        help="Training schedule: train live_attacker (default), cycle all 3 models, or train a selector",
    )
    parser.add_argument(
        "--matchup",
        type=str,
        default="random",
        choices=["random", "round_robin", "fixed_current", "selectors"],
        help="Matchup sampling mode for live_attacker training",
    )
    parser.add_argument(
        "--resume-from",
        type=str,
        default="latest_attacker.pt",
        help="Checkpoint file in trained_models/ to resume from (or 'scratch')",
    )
    parser.add_argument(
        "--save-name",
        type=str,
        default=None,
        help="Optional filename to save in trained_models/",
    )
    parser.add_argument("--use-reference", action="store_true", help="Use reference_solution.py")
    args = parser.parse_args()

    if args.train_ppo:
        device_str = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
        print(
            f"=== Training TH18 AI ({args.mode} | matchup={args.matchup} | resume={args.resume_from}) on {device_str} ==="
        )

        def log_ep(rec: Dict[str, Any]) -> bool:
            print(
                f"Ep {rec['episode']:02d}/{rec['total_episodes']:02d} (Cum {rec['cumulative_episode']}) [{rec['active_model']:17s}] | "
                f"{rec['village_name'][:18]:18s} vs {rec['army_name'][:18]:18s} | "
                f"Destr: {rec['destruction_pct']:3d}% ({rec['stars']}★) | "
                f"Rew: {rec['reward']:+6.2f} | NoOp: {rec['noop_pct']:4.1f}% | "
                f"{rec['fps_ticks']:.0f} t/s"
            )
            return True

        train_pytorch_ppo(
            episodes=args.episodes,
            lr=args.lr,
            training_mode=args.mode,
            matchup_mode=args.matchup,
            resume_from=args.resume_from,
            save_name=args.save_name,
            use_reference=args.use_reference,
            on_episode_callback=log_ep,
        )
    else:
        run_attacker_benchmark()
        run_defender_evolution()
