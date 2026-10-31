#!/usr/bin/env python3
"""
Clash of Clans TH18 — Deep RL Attacker Trainer, Checkpoint Manager & Benchmark:
  - CoCActorCritic: Village Layout (10×50×50) -> Live Placement / NoOp for a Single Army Composition
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
    CoCActorCritic,
    CoCAttackerEnv,
    CoCVecAttackerEnv,
    compress_training_history,
    compute_custom_reward,
    compute_custom_reward_components,
    compute_gae,
    decompress_training_history,
    ensure_architecture_diagrams,
    get_compressed_history_meta,
    ppo_minibatch_update,
    ppo_update_step,
)

if torch.cuda.is_available():
    torch.backends.cudnn.benchmark = True
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    torch.set_float32_matmul_precision("high")

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
TRAINED_MODELS_DIR = os.path.join(REPO_ROOT, "trained_models")

DEFAULT_CKPT_PATH = os.path.join(TRAINED_MODELS_DIR, "latest_attacker.pt")
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


def army_name_to_slug(name: str) -> str:
    s = (name or "army").strip()
    s = re.sub(r"(?i)^th\d+\s*", "", s)
    s = re.sub(r"(?i)\s*\(meta\)\s*$", "", s)
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", s.lower()).strip("_")
    return slug or "army"


def build_default_model_filename(
    army_name: str, episode: int, best_pct: int, best_stars: int
) -> str:
    slug = army_name_to_slug(army_name)
    return f"{slug}_ep{episode}_{best_pct}pct_{best_stars}star.pt"


def ensure_trained_models_dir() -> None:
    os.makedirs(TRAINED_MODELS_DIR, exist_ok=True)


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


_CATALOG_CACHE: Optional[Dict[str, Any]] = None


def _get_cached_catalog() -> Dict[str, Any]:
    global _CATALOG_CACHE
    if _CATALOG_CACHE is None:
        _CATALOG_CACHE = json.loads(coc_py.get_catalog_json())
    return _CATALOG_CACHE


def get_all_army_presets() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    cat = _get_cached_catalog()
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


_MODEL_META_CACHE: Dict[str, Tuple[float, float, Dict[str, Any]]] = {}
_MODEL_HISTORY_CACHE: Dict[str, Tuple[float, float, Dict[str, Any]]] = {}


def list_trained_models() -> List[Dict[str, Any]]:
    ensure_trained_models_dir()
    items: List[Dict[str, Any]] = []
    default_layouts, default_armies = get_meta_presets()
    default_single_army = default_armies[0]
    for fname in os.listdir(TRAINED_MODELS_DIR):
        if not fname.endswith(".pt"):
            continue
        fpath = os.path.join(TRAINED_MODELS_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        mtime = os.path.getmtime(fpath)
        size_kb = round(os.path.getsize(fpath) / 1024.0, 1)
        cached = _MODEL_META_CACHE.get(fname)
        if cached and cached[0] == mtime and cached[1] == size_kb:
            items.append(cached[2])
            continue
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
            "army": default_single_army,
            "army_name": default_single_army.get("name", "Army #1"),
            "army_slug": army_name_to_slug(default_single_army.get("name", "army")),
            "armies": [default_single_army],
            "villages": default_layouts,
            "army_names": [default_single_army.get("name", "Army #1")],
            "village_names": [v.get("name", f"Village #{i+1}") for i, v in enumerate(default_layouts)],
            "has_history": False,
            "history_episodes": 0,
            "compressed_kb": 0.0,
            "raw_kb": 0.0,
            "compression_ratio": 1.0,
            "session_boundaries": [],
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
            if "army" in ckpt and isinstance(ckpt["army"], dict):
                trained_army = ckpt["army"]
            elif "armies" in ckpt and isinstance(ckpt["armies"], list) and len(ckpt["armies"]) > 0:
                trained_army = ckpt["armies"][0]
            else:
                trained_army = default_single_army
            meta["army"] = trained_army
            meta["army_name"] = trained_army.get("name", "Army #1")
            meta["army_slug"] = ckpt.get("army_slug") or army_name_to_slug(meta["army_name"])
            meta["armies"] = [trained_army]
            if "villages" in ckpt and isinstance(ckpt["villages"], list) and len(ckpt["villages"]) > 0:
                meta["villages"] = ckpt["villages"]
            meta["army_names"] = [meta["army_name"]]
            meta["village_names"] = [v.get("name", f"Village #{i+1}") for i, v in enumerate(meta["villages"])]
            hist_blob = ckpt.get("history_compressed") or ckpt.get("history")
            hist_meta = get_compressed_history_meta(hist_blob)
            meta.update(hist_meta)
        except Exception:
            pass
        _MODEL_META_CACHE[fname] = (mtime, size_kb, meta)
        items.append(meta)

    items.sort(key=lambda x: x["mtime"], reverse=True)
    return items


def get_model_training_history(model_file: str) -> Dict[str, Any]:
    """
    Loads and decompresses the full training progression history embedded in `model_file`.
    """
    ensure_trained_models_dir()
    fpath = resolve_model_path(model_file)
    if not fpath or not os.path.exists(fpath):
        return {
            "filename": model_file,
            "found": False,
            "history": [],
            "matchup_stats": compute_matchup_stats(history=[]),
            "compression": get_compressed_history_meta(None),
        }

    fname = os.path.basename(fpath)
    mtime = os.path.getmtime(fpath)
    size_kb = round(os.path.getsize(fpath) / 1024.0, 1)
    cached = _MODEL_HISTORY_CACHE.get(fname)
    if cached and cached[0] == mtime and cached[1] == size_kb:
        return cached[2]

    default_layouts, default_armies = get_meta_presets()
    ckpt = torch.load(fpath, map_location="cpu", weights_only=False)
    if "army" in ckpt and isinstance(ckpt["army"], dict):
        trained_army = ckpt["army"]
    elif isinstance(ckpt.get("armies"), list) and ckpt.get("armies"):
        trained_army = ckpt["armies"][0]
    else:
        trained_army = default_armies[0]
    armies = [trained_army]
    villages = ckpt.get("villages") if isinstance(ckpt.get("villages"), list) and ckpt.get("villages") else default_layouts
    army_names = [trained_army.get("name", "Army #1")]
    village_names = [v.get("name", f"Village #{i+1}") for i, v in enumerate(villages)]

    hist_blob = ckpt.get("history_compressed") or ckpt.get("history")
    decompressed = decompress_training_history(hist_blob, army_names=army_names, village_names=village_names)
    comp_meta = get_compressed_history_meta(hist_blob)
    matchups = compute_matchup_stats(history=decompressed, layouts=villages, armies=armies)

    result = {
        "filename": fname,
        "found": True,
        "episode": int(ckpt.get("episode", len(decompressed))),
        "best_pct": int(ckpt.get("best_pct", 0)),
        "best_stars": int(ckpt.get("best_stars", 0)),
        "best_reward": round(float(ckpt.get("best_reward", 0.0)), 2),
        "hyperparams": ckpt.get("hyperparams", {}),
        "army": trained_army,
        "army_name": trained_army.get("name", "Army #1"),
        "army_slug": ckpt.get("army_slug") or army_name_to_slug(trained_army.get("name", "army")),
        "armies": armies,
        "villages": villages,
        "army_names": army_names,
        "village_names": village_names,
        "compression": comp_meta,
        "matchup_stats": matchups,
        "history": decompressed,
    }
    _MODEL_HISTORY_CACHE[fname] = (mtime, size_kb, result)
    return result


def resolve_model_path(model_file: Optional[str]) -> Optional[str]:
    ensure_trained_models_dir()
    if model_file in ("scratch", "none", "new"):
        return None
    if model_file and model_file not in ("latest", "latest_attacker.pt"):
        candidate = os.path.join(TRAINED_MODELS_DIR, os.path.basename(model_file))
        if os.path.exists(candidate):
            return candidate
        if os.path.exists(model_file):
            return model_file
    if os.path.exists(DEFAULT_CKPT_PATH):
        return DEFAULT_CKPT_PATH
    pt_files = [
        os.path.join(TRAINED_MODELS_DIR, f)
        for f in os.listdir(TRAINED_MODELS_DIR)
        if f.endswith(".pt") and os.path.isfile(os.path.join(TRAINED_MODELS_DIR, f))
    ]
    if pt_files:
        pt_files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
        return pt_files[0]
    return None


def load_attacker_model(
    device: torch.device,
    attacker_model_file: Optional[str] = None,
) -> Tuple[CoCActorCritic, Dict[str, Any]]:
    ensure_trained_models_dir()
    attacker_ckpt_meta: Dict[str, Any] = {}
    atk_path = resolve_model_path(attacker_model_file)
    if atk_path and os.path.exists(atk_path):
        try:
            attacker_ckpt_meta = torch.load(atk_path, map_location=device, weights_only=False)
        except Exception:
            attacker_ckpt_meta = {}

    in_channels = 59
    if "model_state_dict" in attacker_ckpt_meta and isinstance(attacker_ckpt_meta["model_state_dict"], dict):
        stem_w = (
            attacker_ckpt_meta["model_state_dict"].get("encoder.enc1.block.0.weight")
            or attacker_ckpt_meta["model_state_dict"].get("encoder.spatial_stem.0.weight")
        )
        if stem_w is not None and hasattr(stem_w, "shape"):
            in_channels = int(stem_w.shape[1])

    live_attacker = CoCActorCritic(in_channels=in_channels, army_context_dim=64).to(device)

    if "model_state_dict" in attacker_ckpt_meta and isinstance(attacker_ckpt_meta["model_state_dict"], dict):
        try:
            live_attacker.load_state_dict(attacker_ckpt_meta["model_state_dict"])
        except Exception:
            pass

    return live_attacker, attacker_ckpt_meta


def get_meta_presets() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    cat = _get_cached_catalog()
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


def compute_matchup_stats(
    history: Optional[List[Dict[str, Any]]] = None,
    layouts: Optional[List[Dict[str, Any]]] = None,
    armies: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Computes empirical performance breakdowns for the model's army and per village layout:
      - Usage %, recent 50-ep destruction %, overall avg %, peak %, and star rates.
    """
    default_layouts, default_armies = get_meta_presets()
    if layouts is None or len(layouts) == 0:
        layouts = default_layouts
    if armies is None or len(armies) == 0:
        armies = [default_armies[0]]

    hist = history or []
    total_eps = len(hist)

    army_names = [a.get("name", f"Army #{i+1}") for i, a in enumerate(armies)]
    village_names = [v.get("name", f"Village #{i+1}") for i, v in enumerate(layouts)]

    army_stats = []
    for a_idx in range(len(armies)):
        recs = [r for r in hist if r.get("army_idx", 0) == a_idx] if len(armies) > 1 else list(hist)
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
        army_stats.append(
            {
                "army_idx": a_idx,
                "name": army_names[a_idx],
                "full_name": army_names[a_idx],
                "episodes": n,
                "usage_pct": usage_pct,
                "avg_pct": avg_pct,
                "recent_avg_pct": recent_pct,
                "peak_pct": peak_pct,
                "avg_stars": avg_stars,
                "avg_reward": avg_rew,
                "triple_rate": round(100.0 * triples / max(1, n), 1) if n else 0.0,
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
        peak_pct = int(max((r["destruction_pct"] for r in recs), default=0))
        avg_stars = round(float(np.mean([r["stars"] for r in recs])), 2) if n else 0.0
        triples = sum(1 for r in recs if r["stars"] == 3)
        usage_pct = round(100.0 * n / max(1, total_eps), 1) if total_eps > 0 else round(100.0 / max(1, len(layouts)), 1)
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
                "avg_pct": avg_pct,
                "recent_avg_pct": recent_pct,
                "peak_pct": peak_pct,
                "avg_stars": avg_stars,
                "triple_rate": round(100.0 * triples / max(1, n), 1) if n else 0.0,
            }
        )

    return {
        "armies": army_names,
        "villages": village_names,
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
    Runs a trained model from `trained_models/` on the specified Village using
    the model's trained army composition (or `army_json` fallback) and returns
    the full schedule of actions and telemetry so the frontend can replay and test
    the exact neural network policy on the interactive village canvas.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    live_attacker, ckpt_meta = load_attacker_model(
        device, attacker_model_file=model_file
    )
    live_attacker.eval()

    ckpt_army = ckpt_meta.get("army")
    if not isinstance(ckpt_army, dict):
        ckpt_armies = ckpt_meta.get("armies")
        if isinstance(ckpt_armies, list) and len(ckpt_armies) > 0 and isinstance(ckpt_armies[0], dict):
            ckpt_army = ckpt_armies[0]

    if isinstance(ckpt_army, dict):
        army_dict = ckpt_army
        effective_army_json = json.dumps(army_dict)
    else:
        army_dict = json.loads(army_json)
        effective_army_json = army_json

    remaining_slot_counts = [int(c) for _, c in army_dict.get("troops", [])]
    fraction_bins = (0.0, 0.25, 0.50, 0.75, 1.00)
    env = CoCAttackerEnv(
        layout_json=layout_json,
        army_json=effective_army_json,
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
        frac_bin = int(act[4])
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

        has_active_actions = bool(
            next_info.get(
                "has_remaining_inventory",
                next_info["action_masks"]["slot_type"][1:].any(),
            )
        )
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
        "model_file": model_file or "",
        "model_episode": int(ckpt_meta.get("episode", 0)),
        "ticks_per_step": ticks_per_step,
        "steps_run": steps_run,
        "final_tick": int(info.get("tick", steps_run * ticks_per_step)),
        "destruction_pct": int(info["destruction_pct"]),
        "stars": int(info["stars"]),
        "total_reward": round(float(total_reward), 2),
        "noop_pct": round(100.0 * noop_steps / max(1, steps_run), 1),
        "actions_schedule": actions_schedule,
        "army": army_dict,
        "army_name": army_dict.get("name", "Army"),
        "armies": [army_dict],
        "villages": ckpt_meta.get("villages", []),
        "hyperparams": ckpt_meta.get("hyperparams", {}),
    }


def train_pytorch_ppo(
    episodes: int = 24,
    ticks_per_step: int = 8,
    max_steps_per_ep: int = 120,
    batch_episodes: int = 12,
    minibatch_size: int = 128,
    lr: float = 3e-4,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
    clip_coef: float = 0.2,
    ent_coef: float = 0.015,
    ppo_epochs: int = 4,
    curriculum_deploy: bool = True,
    matchup_mode: str = "random",
    resume_from: Optional[str] = "scratch",
    save_name: Optional[str] = None,
    layout_json: Optional[str] = None,
    army_json: Optional[str] = None,
    armies_json: Optional[Any] = None,
    villages_json: Optional[Any] = None,
    on_episode_callback: Optional[Callable[[Dict[str, Any]], bool]] = None,
) -> Dict[str, Any]:
    """
    Trains the TH18 Attacker AI (`CoCActorCritic`) for a single dedicated army composition
    with full checkpoint resume & save support in `trained_models/`.
    """
    ensure_trained_models_dir()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    default_layouts, default_armies = get_meta_presets()
    layouts = default_layouts
    trained_army: Dict[str, Any] = default_armies[0]

    is_resuming = bool(resume_from and resume_from not in ("scratch", "none", "new"))
    loaded_ckpt: Dict[str, Any] = {}
    resume_resolved_path = resolve_model_path(resume_from) if is_resuming else None

    if is_resuming and resume_resolved_path and os.path.exists(resume_resolved_path):
        try:
            loaded_ckpt = torch.load(resume_resolved_path, map_location=device, weights_only=False)
        except Exception:
            loaded_ckpt = {}

        if "army" in loaded_ckpt and isinstance(loaded_ckpt["army"], dict):
            trained_army = loaded_ckpt["army"]
        elif "armies" in loaded_ckpt and isinstance(loaded_ckpt["armies"], list) and len(loaded_ckpt["armies"]) > 0:
            trained_army = loaded_ckpt["armies"][0]
        if "villages" in loaded_ckpt and isinstance(loaded_ckpt["villages"], list) and len(loaded_ckpt["villages"]) > 0:
            layouts = loaded_ckpt["villages"]
    else:
        if army_json:
            try:
                parsed_army = json.loads(army_json) if isinstance(army_json, str) else army_json
                if isinstance(parsed_army, dict) and parsed_army.get("troops") is not None:
                    trained_army = parsed_army
            except Exception:
                pass
        elif armies_json:
            try:
                parsed_armies = json.loads(armies_json) if isinstance(armies_json, str) else armies_json
                if isinstance(parsed_armies, list) and len(parsed_armies) > 0 and isinstance(parsed_armies[0], dict):
                    trained_army = parsed_armies[0]
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

    armies = [trained_army]
    trained_army_name = trained_army.get("name", "Army #1")
    army_slug = army_name_to_slug(trained_army_name)

    live_attacker, loaded_ckpt = load_attacker_model(
        device,
        attacker_model_file=resume_from if is_resuming else "scratch",
    )
    ensure_architecture_diagrams(live_attacker)

    critic_param_ids = {id(p) for p in live_attacker.critic_head.parameters()}
    actor_params = [p for p in live_attacker.parameters() if id(p) not in critic_param_ids]
    critic_params = list(live_attacker.critic_head.parameters())
    opt_live = torch.optim.Adam(
        [
            {"params": actor_params, "lr": lr},
            {"params": critic_params, "lr": lr * 2.5},
        ],
        eps=1e-5,
    )
    if loaded_ckpt and "optimizer_state_dict" in loaded_ckpt:
        try:
            opt_live.load_state_dict(loaded_ckpt["optimizer_state_dict"])
            if len(opt_live.param_groups) >= 2:
                opt_live.param_groups[0]["lr"] = lr
                opt_live.param_groups[1]["lr"] = lr * 2.5
            else:
                for pg in opt_live.param_groups:
                    pg["lr"] = lr
        except Exception:
            pass

    base_trained_episodes = int(loaded_ckpt.get("episode", 0)) if loaded_ckpt else 0
    best_pct = int(loaded_ckpt.get("best_pct", 0)) if loaded_ckpt else 0
    best_stars = int(loaded_ckpt.get("best_stars", 0)) if loaded_ckpt else 0
    best_reward = float(loaded_ckpt.get("best_reward", -1e9)) if loaded_ckpt else -1e9

    army_names = [trained_army_name]
    village_names = [v.get("name", f"Village #{i+1}") for i, v in enumerate(layouts)]

    base_history: List[Dict[str, Any]] = []
    session_boundaries: List[Dict[str, Any]] = []
    if is_resuming and loaded_ckpt:
        raw_base_hist = loaded_ckpt.get("history_compressed") or loaded_ckpt.get("history")
        if raw_base_hist:
            base_history = decompress_training_history(
                raw_base_hist, army_names=army_names, village_names=village_names
            )
        prev_bounds = (
            loaded_ckpt.get("history_compressed", {}).get("session_boundaries")
            if isinstance(loaded_ckpt.get("history_compressed"), dict)
            else None
        )
        if isinstance(prev_bounds, list):
            session_boundaries = list(prev_bounds)
        if base_trained_episodes > 0:
            session_boundaries.append(
                {
                    "session_id": len(session_boundaries) + 1,
                    "start_ep": base_trained_episodes,
                    "resumed_from": resume_from,
                }
            )

    trained_army_json = json.dumps(trained_army)
    layouts_json_list = [json.dumps(l) for l in layouts]
    b_eps = max(1, batch_episodes)
    cpu_threads = max(1, os.cpu_count() or 12)
    num_parallel_envs = min(cpu_threads, b_eps, max(1, episodes))
    vec_env = CoCVecAttackerEnv(
        num_envs=num_parallel_envs,
        layouts_json=layouts_json_list,
        armies_json=[trained_army_json],
        ticks_per_step=ticks_per_step,
    )

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

    last_metrics = {
        "policy_loss": float(base_history[-1].get("policy_loss", 0.0)) if base_history else 0.0,
        "value_loss": float(base_history[-1].get("value_loss", 0.0)) if base_history else 0.0,
        "entropy": float(base_history[-1].get("entropy", 0.0)) if base_history else 0.0,
        "approx_kl": float(base_history[-1].get("approx_kl", 0.0)) if base_history else 0.0,
        "clip_fraction": float(base_history[-1].get("clip_fraction", 0.0)) if base_history else 0.0,
        "grad_norm": float(base_history[-1].get("grad_norm", 0.0)) if base_history else 0.0,
        "explained_variance": float(base_history[-1].get("explained_variance", 0.0)) if base_history else 0.0,
    }

    hyperparams_meta = {
        "lr": lr,
        "batch_episodes": batch_episodes,
        "minibatch_size": minibatch_size,
        "ppo_epochs": ppo_epochs,
        "episodes": episodes,
        "ticks_per_step": ticks_per_step,
        "matchup_mode": matchup_mode,
        "resumed_from": resume_from or "scratch",
        "army_name": trained_army_name,
        "army_slug": army_slug,
    }

    strat_villages = list(range(len(layouts)))
    prev_intermediate_path: Optional[str] = None
    last_saved_ep = 0

    def _get_ckpt_filename(ep_total: int) -> str:
        if save_name and save_name.strip():
            return sanitize_model_filename(save_name)
        return build_default_model_filename(trained_army_name, ep_total, best_pct, best_stars)

    def _save_attacker_ckpt(ep_total: int) -> str:
        nonlocal prev_intermediate_path, last_saved_ep
        fname = _get_ckpt_filename(ep_total)
        path = os.path.join(TRAINED_MODELS_DIR, fname)
        compressed_hist = compress_training_history(
            base_history + history, session_boundaries=session_boundaries
        )
        payload = {
            "model_state_dict": live_attacker.state_dict(),
            "optimizer_state_dict": opt_live.state_dict(),
            "episode": ep_total,
            "best_pct": best_pct,
            "best_stars": best_stars,
            "best_reward": best_reward,
            "model_type": "live_attacker",
            "hyperparams": hyperparams_meta,
            "army": trained_army,
            "army_name": trained_army_name,
            "army_slug": army_slug,
            "armies": armies,
            "villages": layouts,
            "army_names": army_names,
            "village_names": village_names,
            "history_compressed": compressed_hist,
        }
        torch.save(payload, path)
        last_saved_ep = ep_total
        try:
            mtime = os.path.getmtime(path)
            size_kb = round(os.path.getsize(path) / 1024.0, 1)
            hist_meta = get_compressed_history_meta(compressed_hist)
            meta_entry = {
                "filename": fname,
                "size_kb": size_kb,
                "updated_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(mtime)),
                "mtime": mtime,
                "episode": int(ep_total),
                "best_pct": int(best_pct),
                "best_stars": int(best_stars),
                "best_reward": round(float(best_reward), 2),
                "model_type": "live_attacker",
                "hyperparams": hyperparams_meta,
                "army": trained_army,
                "army_name": trained_army_name,
                "army_slug": army_slug,
                "armies": armies,
                "villages": layouts,
                "army_names": army_names,
                "village_names": village_names,
                **hist_meta,
            }
            _MODEL_META_CACHE[fname] = (mtime, size_kb, meta_entry)
        except Exception:
            pass
        if (
            prev_intermediate_path
            and prev_intermediate_path != path
            and prev_intermediate_path != resume_resolved_path
            and os.path.exists(prev_intermediate_path)
        ):
            try:
                os.remove(prev_intermediate_path)
                _MODEL_META_CACHE.pop(os.path.basename(prev_intermediate_path), None)
                _MODEL_HISTORY_CACHE.pop(os.path.basename(prev_intermediate_path), None)
            except Exception:
                pass
        prev_intermediate_path = path
        return path

    live_attacker.train()
    fixed_layout_obj = json.loads(layout_json) if (matchup_mode == "fixed_current" and layout_json) else layouts[0]
    fixed_village_idx = next(
        (i for i, l in enumerate(layouts) if l.get("name") == fixed_layout_obj.get("name")),
        0,
    )

    ep_cursor = 0
    stop_training = False

    while ep_cursor < episodes and not stop_training:
        t0 = time.perf_counter()
        wave_size = min(
            num_parallel_envs,
            b_eps - buf_eps_count,
            episodes - ep_cursor,
        )

        # ---------------------------------------------------------------------
        # Parallel Wave Village Selection (Single Army Composition)
        # ---------------------------------------------------------------------
        wave_village_indices: List[int] = []
        for w in range(wave_size):
            ep_num = ep_cursor + w + 1
            if matchup_mode == "round_robin":
                v_idx = (ep_num - 1) % len(layouts)
            elif matchup_mode == "fixed_current":
                v_idx = fixed_village_idx
            else:
                if (ep_num - 1) % max(1, len(layouts)) == 0:
                    random.shuffle(strat_villages)
                v_idx = strat_villages[(ep_num - 1) % len(layouts)]
            wave_village_indices.append(v_idx)

        obs_all, ctx_all, masks_all = vec_env.reset_batch(
            wave_village_indices, [0] * wave_size
        )

        # ---------------------------------------------------------------------
        # Batched Parallel Rollout (`CoCVecAttackerEnv` + Batched GPU Forward)
        # ---------------------------------------------------------------------
        w_obs: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_ctx: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_act: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_lp: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_val: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_rew: List[List[float]] = [[] for _ in range(wave_size)]
        w_done: List[List[float]] = [[] for _ in range(wave_size)]
        w_m_type: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_m_idx: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_m_tile: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_ent: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_h_type: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_h_idx: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_h_frac: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]
        w_h_tile: List[List[torch.Tensor]] = [[] for _ in range(wave_size)]

        ep_custom_reward = [0.0] * wave_size
        ep_r_destr = [0.0] * wave_size
        ep_r_stars = [0.0] * wave_size
        ep_r_damage = [0.0] * wave_size
        steps_run = [0] * wave_size
        noop_steps = [0] * wave_size
        deploy_steps = [0] * wave_size
        spell_steps = [0] * wave_size
        ability_steps = [0] * wave_size
        final_pct = [0] * wave_size
        final_stars = [0] * wave_size
        final_tick = [0] * wave_size

        active = list(range(wave_size))

        for step_i in range(max_steps_per_ep):
            if not active:
                break

            obs_t = torch.as_tensor(
                obs_all[active], dtype=torch.float32, device=device
            )
            ctx_t = torch.as_tensor(
                ctx_all[active], dtype=torch.float32, device=device
            )
            st_t = torch.as_tensor(
                masks_all["slot_type"][active], dtype=torch.bool, device=device
            )
            si_t = torch.as_tensor(
                masks_all["slot_idx"][active], dtype=torch.bool, device=device
            )
            tile_t = torch.as_tensor(
                masks_all["tile"][active], dtype=torch.bool, device=device
            )

            if curriculum_deploy and step_i == 0:
                has_non_noop = st_t[:, 1:].any(dim=-1)
                if has_non_noop.any():
                    st_t = st_t.clone()
                    st_t[has_non_noop, 0] = False

            masks_t = {
                "slot_type": st_t,
                "slot_idx": si_t,
                "tile": tile_t,
            }

            with torch.no_grad():
                action_t, logprob_t, entropy_t, value_t, step_diag = (
                    live_attacker.get_action_and_value(
                        obs_t, masks=masks_t, army_context=ctx_t
                    )
                )

            actions_np = action_t.cpu().numpy()

            (
                obs_all,
                ctx_all,
                masks_all,
                (crews, rds, rss, rdms, dones, pcts, stars_out, ticks_out),
            ) = vec_env.step_active(
                active,
                actions_np,
                is_last_step=(step_i == max_steps_per_ep - 1),
                gamma=gamma,
            )

            next_active: List[int] = []
            for pos, w in enumerate(active):
                chosen_slot_type = int(actions_np[pos, 0])
                if chosen_slot_type == 0:
                    noop_steps[w] += 1
                elif chosen_slot_type in (1, 2, 4):
                    deploy_steps[w] += 1
                elif chosen_slot_type == 6:
                    spell_steps[w] += 1
                elif chosen_slot_type in (3, 5):
                    ability_steps[w] += 1

                custom_r = float(crews[pos])
                r_destr = float(rds[pos])
                r_stars = float(rss[pos])
                r_dmg = float(rdms[pos])
                done = bool(dones[pos])

                if chosen_slot_type == 0 and deploy_steps[w] == 0 and step_i < 4:
                    custom_r -= 0.02
                    r_dmg -= 0.02

                ep_custom_reward[w] += custom_r
                ep_r_destr[w] += r_destr
                ep_r_stars[w] += r_stars
                ep_r_damage[w] += r_dmg
                steps_run[w] += 1
                final_pct[w] = int(pcts[pos])
                final_stars[w] = int(stars_out[pos])
                final_tick[w] = int(ticks_out[pos])

                w_obs[w].append(obs_t[pos])
                w_ctx[w].append(ctx_t[pos])
                w_act[w].append(action_t[pos])
                w_lp[w].append(logprob_t[pos])
                w_val[w].append(value_t[pos])
                w_rew[w].append(custom_r)
                w_done[w].append(1.0 if done else 0.0)
                w_m_type[w].append(st_t[pos])
                w_m_idx[w].append(si_t[pos])
                w_m_tile[w].append(tile_t[pos])
                w_ent[w].append(entropy_t[pos])
                if "h_type" in step_diag:
                    w_h_type[w].append(step_diag["h_type"][pos])
                if "h_idx" in step_diag:
                    w_h_idx[w].append(step_diag["h_idx"][pos])
                if "h_frac" in step_diag:
                    w_h_frac[w].append(step_diag["h_frac"][pos])
                if "h_tile" in step_diag:
                    w_h_tile[w].append(step_diag["h_tile"][pos])

                if not done:
                    next_active.append(w)

            active = next_active

        # ---------------------------------------------------------------------
        # Batched Next-Value Estimation, GAE, and Shuffled Minibatch PPO Update
        # ---------------------------------------------------------------------
        with torch.no_grad():
            next_obs_t = torch.as_tensor(
                obs_all[:wave_size], dtype=torch.float32, device=device
            )
            next_ctx_t = torch.as_tensor(
                ctx_all[:wave_size], dtype=torch.float32, device=device
            )
            _, _, _, next_vals_t, _ = live_attacker.get_action_and_value(
                next_obs_t, army_context=next_ctx_t
            )

        wave_elapsed = max(1e-6, time.perf_counter() - t0)
        total_wave_ticks = sum(
            final_tick[w] if final_tick[w] > 0 else steps_run[w] * ticks_per_step
            for w in range(wave_size)
        )
        wave_fps_ticks = total_wave_ticks / wave_elapsed

        for w in range(wave_size):
            ep = ep_cursor + w + 1
            cumulative_ep = base_trained_episodes + ep
            village_idx = wave_village_indices[w]
            pct = final_pct[w]
            stars = final_stars[w]

            rewards_t = torch.tensor(w_rew[w], dtype=torch.float32, device=device)
            values_t = torch.stack(w_val[w])
            dones_t = torch.tensor(w_done[w], dtype=torch.float32, device=device)

            advantages_t, returns_t = compute_gae(
                rewards=rewards_t,
                values=values_t,
                dones=dones_t,
                next_value=next_vals_t[w],
                gamma=gamma,
                gae_lambda=gae_lambda,
            )

            buf_obs.append(torch.stack(w_obs[w]))
            buf_ctx.append(torch.stack(w_ctx[w]))
            buf_act.append(torch.stack(w_act[w]))
            buf_lp.append(torch.stack(w_lp[w]))
            buf_adv.append(advantages_t)
            buf_ret.append(returns_t)
            buf_m_type.append(torch.stack(w_m_type[w]))
            buf_m_idx.append(torch.stack(w_m_idx[w]))
            buf_m_tile.append(torch.stack(w_m_tile[w]))
            buf_eps_count += 1

            new_best = False
            if pct > best_pct or (pct == best_pct and ep_custom_reward[w] > best_reward):
                best_pct = max(best_pct, pct)
                best_stars = max(best_stars, stars)
                best_reward = max(best_reward, ep_custom_reward[w])
                new_best = True

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

                # Backfill initial episodes before the first optimizer step so curves have no 0-spike
                if ep <= b_eps:
                    for prev_rec in history:
                        if abs(float(prev_rec.get("value_loss", 0.0))) < 1e-6:
                            prev_rec["policy_loss"] = round(last_metrics.get("policy_loss", 0.0), 4)
                            prev_rec["value_loss"] = round(last_metrics.get("value_loss", 0.0), 4)
                            prev_rec["approx_kl"] = round(last_metrics.get("approx_kl", 0.0), 4)
                            prev_rec["clip_fraction"] = round(last_metrics.get("clip_fraction", 0.0), 4)
                            prev_rec["grad_norm"] = round(last_metrics.get("grad_norm", 0.0), 4)
                            prev_rec["explained_variance"] = round(last_metrics.get("explained_variance", 0.0), 4)

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

                save_interval = max(b_eps, 48 if (len(base_history) + len(history)) >= 1000 else b_eps)
                if new_best or ep == episodes or (cumulative_ep - last_saved_ep) >= save_interval:
                    _save_attacker_ckpt(cumulative_ep)
            elif new_best:
                _save_attacker_ckpt(cumulative_ep)

            recent_rewards = [h["reward"] for h in history[-9:]] + [ep_custom_reward[w]]
            avg_reward_10 = float(np.mean(recent_rewards))
            recent_pcts = [h["destruction_pct"] for h in history[-9:]] + [pct]
            avg_pct_10 = float(np.mean(recent_pcts))
            recent_pcts_50 = [h["destruction_pct"] for h in history[-49:]] + [pct]
            avg_pct_50 = float(np.mean(recent_pcts_50))
            noop_pct = round(100.0 * noop_steps[w] / max(1, steps_run[w]), 1)

            with torch.no_grad():
                rollout_ent = (
                    float(torch.stack(w_ent[w]).mean().item())
                    if w_ent[w]
                    else last_metrics.get("entropy", 0.0)
                )
                eff_ent = (
                    last_metrics.get("entropy", 0.0)
                    if last_metrics.get("entropy", 0.0) > 1e-5
                    else rollout_ent
                )
                v_s0_val = float(values_t[0].item()) if values_t.numel() > 0 else 0.0
                h_type_val = float(torch.stack(w_h_type[w]).mean().item()) if w_h_type[w] else 0.95
                h_idx_t = torch.stack(w_h_idx[w]) if w_h_idx[w] else None
                h_idx_pos = h_idx_t[h_idx_t > 0] if h_idx_t is not None else None
                h_idx_val = float(h_idx_pos.mean().item()) if (h_idx_pos is not None and h_idx_pos.numel() > 0) else 1.15
                h_frac_t = torch.stack(w_h_frac[w]) if w_h_frac[w] else None
                h_frac_pos = h_frac_t[h_frac_t > 0] if h_frac_t is not None else None
                h_frac_val = float(h_frac_pos.mean().item()) if (h_frac_pos is not None and h_frac_pos.numel() > 0) else 0.85
                h_tile_t = torch.stack(w_h_tile[w]) if w_h_tile[w] else None
                h_tile_pos = h_tile_t[h_tile_t > 0] if h_tile_t is not None else None
                h_tile_val = float(h_tile_pos.mean().item()) if (h_tile_pos is not None and h_tile_pos.numel() > 0) else 3.80

            ep_record = {
                "episode": ep,
                "cumulative_episode": cumulative_ep,
                "total_episodes": episodes,
                "army_idx": 0,
                "army_name": trained_army_name,
                "village_idx": village_idx,
                "village_name": (
                    VILLAGE_SHORT_NAMES[village_idx]
                    if village_idx < len(VILLAGE_SHORT_NAMES)
                    else f"Village {village_idx}"
                ),
                "reward": round(float(ep_custom_reward[w]), 3),
                "reward_destr": round(float(ep_r_destr[w]), 3),
                "reward_stars": round(float(ep_r_stars[w]), 3),
                "reward_damage": round(float(ep_r_damage[w]), 3),
                "v_s0": round(v_s0_val, 2),
                "avg_reward_10": round(avg_reward_10, 3),
                "destruction_pct": pct,
                "avg_pct_10": round(avg_pct_10, 1),
                "avg_pct_50": round(avg_pct_50, 1),
                "stars": stars,
                "best_pct": best_pct,
                "best_stars": best_stars,
                "noop_pct": noop_pct,
                "deploy_steps": deploy_steps[w],
                "spell_steps": spell_steps[w],
                "ability_steps": ability_steps[w],
                "policy_loss": round(last_metrics.get("policy_loss", 0.0), 4),
                "value_loss": round(last_metrics.get("value_loss", 0.0), 4),
                "entropy": round(eff_ent, 3),
                "approx_kl": round(last_metrics.get("approx_kl", 0.0), 4),
                "clip_fraction": round(last_metrics.get("clip_fraction", 0.0), 4),
                "grad_norm": round(last_metrics.get("grad_norm", 0.0), 4),
                "explained_variance": round(last_metrics.get("explained_variance", 0.0), 4),
                "entropy_type": round(h_type_val, 3),
                "entropy_idx": round(h_idx_val, 3),
                "entropy_frac": round(h_frac_val, 3),
                "entropy_tile": round(h_tile_val, 3),
                "fps_ticks": round(wave_fps_ticks, 0),
                "steps": steps_run[w],
            }
            history.append(ep_record)

            if on_episode_callback is not None:
                should_continue = on_episode_callback(ep_record)
                if not should_continue:
                    stop_training = True
                    break

        ep_cursor += wave_size

    final_cum_ep = base_trained_episodes + len(history)
    named_path = _save_attacker_ckpt(final_cum_ep)
    named_file = os.path.basename(named_path)

    # Automatically update the Obsidian Vault & Canvas with the new training results
    if not named_file.startswith("_"):
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
            )
        except Exception as e:
            print(f"[vault_generator] Note: could not update obsidian vault: {e}")

    matchup_stats = compute_matchup_stats(
        history=history, layouts=layouts, armies=armies
    )
    return {
        "history": history,
        "best_pct": best_pct,
        "best_stars": best_stars,
        "checkpoint_path": named_path,
        "saved_filename": named_file,
        "matchup_stats": matchup_stats,
        "army": trained_army,
        "army_name": trained_army_name,
        "army_slug": army_slug,
        "armies": armies,
        "villages": layouts,
        "army_names": army_names,
        "village_names": village_names,
    }


def run_attacker_benchmark() -> None:
    print("=== Attacker Gymnasium RL Environment Benchmark ===")
    env = CoCAttackerEnv(ticks_per_step=5)
    obs, info = env.reset()
    valid_tiles = env.valid_deploy_tiles()
    print(f"Observation tensor shape: {obs.shape} (dtype={obs.dtype})")
    print(f"Valid deployment tiles outside village red-zone: {len(valid_tiles)} / 2500")

    t0 = time.perf_counter()
    total_steps = 0
    total_reward = 0.0

    west_breach_tiles = [(x, y) for (x, y) in valid_tiles if x == 1 and 17 <= y <= 31]
    for step_idx in range(360):
        tx, ty = random.choice(west_breach_tiles)
        if step_idx < 36:
            slot_type = 1
            action = np.array([slot_type, step_idx % 6, tx, ty, 4], dtype=np.int64)
        elif 36 <= step_idx < 40:
            action = np.array([2, step_idx - 36, 1, 21 + (step_idx - 36) * 2, 4], dtype=np.int64)
        elif step_idx == 40:
            action = np.array([4, 0, 1, 24, 4], dtype=np.int64)
        elif step_idx in (48, 60, 75, 90, 105, 120):
            action = np.array([6, (step_idx // 15) % 4, 21, 24, 4], dtype=np.int64)
        elif step_idx in (65, 66, 67, 68):
            action = np.array([3, step_idx - 65, 24, 24, 4], dtype=np.int64)
        else:
            action = np.array([0, 0, 0, 0, 0], dtype=np.int64)

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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CoC TH18 Deep RL Attacker Trainer & Benchmark")
    parser.add_argument("--train-ppo", action="store_true", help="Run PyTorch GPU PPO training loop")
    parser.add_argument("--episodes", type=int, default=20, help="Number of training episodes")
    parser.add_argument("--lr", type=float, default=3e-4, help="Learning rate")
    parser.add_argument(
        "--matchup",
        type=str,
        default="random",
        choices=["random", "round_robin", "fixed_current"],
        help="Matchup sampling mode for training",
    )
    parser.add_argument(
        "--resume-from",
        type=str,
        default="scratch",
        help="Checkpoint file in trained_models/ to resume from (or 'scratch')",
    )
    parser.add_argument(
        "--army-idx",
        type=int,
        default=0,
        help="Index of preset army (0..2) to train on when starting from scratch",
    )
    parser.add_argument(
        "--save-name",
        type=str,
        default=None,
        help="Optional filename to save in trained_models/",
    )
    args = parser.parse_args()

    if args.train_ppo:
        device_str = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"
        _, preset_armies = get_meta_presets()
        chosen_army = preset_armies[max(0, min(len(preset_armies) - 1, args.army_idx))]
        print(
            f"=== Training TH18 Attacker AI (army={chosen_army['name']} | matchup={args.matchup} | resume={args.resume_from}) on {device_str} ==="
        )

        def log_ep(rec: Dict[str, Any]) -> bool:
            print(
                f"Ep {rec['episode']:02d}/{rec['total_episodes']:02d} (Cum {rec['cumulative_episode']}) | "
                f"{rec['village_name'][:18]:18s} vs {rec['army_name'][:18]:18s} | "
                f"Destr: {rec['destruction_pct']:3d}% ({rec['stars']}★) | "
                f"Rew: {rec['reward']:+6.2f} | NoOp: {rec['noop_pct']:4.1f}% | "
                f"{rec['fps_ticks']:.0f} t/s"
            )
            return True

        train_pytorch_ppo(
            episodes=args.episodes,
            lr=args.lr,
            matchup_mode=args.matchup,
            resume_from=args.resume_from,
            save_name=args.save_name,
            army_json=json.dumps(chosen_army),
            on_episode_callback=log_ep,
        )
    else:
        run_attacker_benchmark()

