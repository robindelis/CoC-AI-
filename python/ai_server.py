#!/usr/bin/env python3
"""
FastAPI AI Training & Inference Server for Clash of Clans TH18 AI Studio.
Manages the Attacker AI (`CoCActorCritic`), `trained_models/` checkpoint library, and live rollout testing.
"""

import json
import os
import shutil
import sys
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import coc_py
from coc_rl import (
    AI_PROVIDERS,
    CoCActorCritic,
    CoCAttackerEnv,
    apply_config_patch,
    capture_pre_change_snapshot,
    compress_training_history,
    decompress_training_history,
    diagnose_and_propose_solutions,
    ensure_architecture_diagrams,
    execute_opencode_argon_code_edit,
    extract_compact_metrics_from_telemetry,
    format_reward_formula,
    gather_training_telemetry,
    generate_ai_training_feedback,
    get_compressed_history_meta,
    get_default_experiment_config,
    load_active_experiment_config,
    load_cached_ai_feedback,
    load_recursive_loop_state,
    merge_selected_solutions,
    run_recursive_improvement_cycle,
    save_active_experiment_config,
    save_recursive_loop_state,
    sync_recursive_loop_to_vault,
    transfer_compatible_weights,
    trigger_model_visualizer_agent,
    verify_solution_outcome,
)
from train_ai import (
    ARCHIVES_DIR,
    ARMY_SHORT_NAMES,
    CHECKPOINTS_DIR,
    DEFAULT_CKPT_PATH,
    STATE_DIR,
    VILLAGE_SHORT_NAMES,
    army_name_to_slug,
    compute_matchup_stats,
    delete_custom_army,
    ensure_trained_models_dir,
    get_all_army_presets,
    get_model_training_history,
    list_custom_armies,
    list_trained_models,
    load_attacker_model,
    masks_np_to_torch,
    rename_trained_model,
    sanitize_model_filename,
    save_custom_army,
    simulate_model_rollout,
    train_pytorch_ppo,
)

app = FastAPI(title="CoC TH18 AI Studio Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
DEVICE_NAME = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU"

ensure_trained_models_dir()
_LAST_STATE_PATH = os.path.join(STATE_DIR, "last_training_state.json")

_train_lock = threading.Lock()
_training_state: Dict[str, Any] = {
    "is_training": False,
    "stop_requested": False,
    "matchup_mode": "random",
    "resume_from": "scratch",
    "saved_filename": "",
    "army_name": "",
    "army": None,
    "current_episode": 0,
    "cumulative_episode": 0,
    "total_episodes": 0,
    "best_pct": 0,
    "best_stars": 0,
    "matchup_stats": None,
    "history": [],
}

if os.path.exists(_LAST_STATE_PATH):
    try:
        with open(_LAST_STATE_PATH, "r", encoding="utf-8") as _f:
            _saved_st = json.load(_f)
        if isinstance(_saved_st, dict):
            for _k in list(_training_state.keys()):
                if _k in _saved_st and _k != "history":
                    _training_state[_k] = _saved_st[_k]
            if "history_compressed" in _saved_st:
                _training_state["history"] = decompress_training_history(_saved_st["history_compressed"])
                _training_state["compression"] = get_compressed_history_meta(_saved_st["history_compressed"])
            elif "history" in _saved_st and isinstance(_saved_st["history"], list):
                _training_state["history"] = decompress_training_history(_saved_st["history"])
            _training_state["is_training"] = False
            _training_state["stop_requested"] = False
    except Exception:
        pass


class InspectRequest(BaseModel):
    layout_json: Optional[str] = None
    army_json: Optional[str] = None
    model_file: Optional[str] = None


class RolloutRequest(BaseModel):
    model_file: Optional[str] = None
    layout_json: str
    army_json: str
    ticks_per_step: int = 8
    deterministic: bool = False


class TrainStartRequest(BaseModel):
    episodes: int = 24
    batch_episodes: int = 12
    minibatch_size: int = 128
    ppo_epochs: int = 4
    lr: float = 3e-4
    ticks_per_step: int = 8
    matchup_mode: str = "random"
    resume_from: Optional[str] = "scratch"
    save_name: Optional[str] = None
    layout_json: Optional[str] = None
    army_json: Optional[str] = None
    armies_json: Optional[str] = None
    villages_json: Optional[str] = None


class RenameModelRequest(BaseModel):
    old_filename: str
    new_filename: str


class FeedbackRequest(BaseModel):
    provider: str = "opencode_argon"
    model_file: Optional[str] = None


class LoopConfigureRequest(BaseModel):
    enabled: Optional[bool] = None
    interval_seconds: Optional[int] = None
    auto_apply_and_test: Optional[bool] = None
    test_episodes_per_cycle: Optional[int] = None
    provider: Optional[str] = None


class LoopRunCycleRequest(BaseModel):
    selected_solution_id: Optional[str] = None
    selected_solution_ids: Optional[List[str]] = None
    run_code_agent: bool = True
    auto_test: bool = True
    use_llm: bool = True
    trigger: str = "manual_trigger"


class LoopApplySolutionRequest(BaseModel):
    cycle_id: Optional[int] = None
    solution_id: Optional[str] = None
    solution_ids: Optional[List[str]] = None
    run_code_agent: bool = True
    auto_test: bool = True
    test_episodes: Optional[int] = None


class LoopUpdateConfigRequest(BaseModel):
    arch_config: Optional[Dict[str, Any]] = None
    reward_config: Optional[Dict[str, Any]] = None
    hyperparams: Optional[Dict[str, Any]] = None
    restart_or_morph_model: bool = False
    auto_test: bool = False
    test_episodes: Optional[int] = None


_loop_state: Dict[str, Any] = load_recursive_loop_state()
if "remaining_training_seconds" not in _loop_state:
    _loop_state["remaining_training_seconds"] = int(_loop_state.get("interval_seconds", 600))


def _compute_fast_telemetry_compact() -> Optional[Dict[str, Any]]:
    hist = _training_state.get("history") or []
    if not hist:
        cycles = _loop_state.get("cycles") or []
        if cycles:
            return (cycles[-1].get("pre_change_snapshot") or {}).get("baseline_metrics")
        return None
    w = hist[-300:]
    n = max(1, len(w))
    pcts = [float(r.get("destruction_pct", 0.0)) for r in w]
    stars = [int(r.get("stars", 0)) for r in w]
    rews = [float(r.get("reward", 0.0)) for r in w]
    mean_pct = round(sum(pcts) / n, 2)
    s1 = round(sum(1 for s in stars if s >= 1) * 100.0 / n, 1)
    s2 = round(sum(1 for s in stars if s >= 2) * 100.0 / n, 1)
    s3 = round(sum(1 for s in stars if s >= 3) * 100.0 / n, 1)
    p2_given_1 = round((s2 / max(1.0, s1)) * 100.0, 1) if s1 > 0 else 0.0
    p3_given_2 = round((s3 / max(1.0, s2)) * 100.0, 1) if s2 > 0 else 0.0
    last50 = hist[-50:]
    n50 = max(1, len(last50))
    ev50 = round(sum(float(r.get("explained_variance", 0.0)) for r in last50) / n50, 4)
    kl50 = round(sum(float(r.get("approx_kl", 0.0)) for r in last50) / n50, 4)
    noop50 = round(sum(float(r.get("noop_pct", 0.0)) for r in last50) / n50, 1)
    v0_50 = round(sum(float(r.get("v_s0", 0.0)) for r in last50) / n50, 2)
    rew50 = round(sum(float(r.get("reward", 0.0)) for r in last50) / n50, 2)
    cum_ep = int(_training_state.get("cumulative_episode", 0) or _training_state.get("current_episode", len(hist)))
    return {
        "episode": cum_ep,
        "history_length": len(hist),
        "eval_window_episodes": n,
        "mean_pct_300": mean_pct,
        "mean_pct_50": mean_pct,
        "one_star_rate_50": s1,
        "two_star_th_rate_50": s2,
        "three_star_triple_rate_50": s3,
        "mean_reward_50": round(sum(rews) / n, 2),
        "explained_variance_50": ev50,
        "approx_kl_50": kl50,
        "mean_noop_pct_50": noop50,
        "critic_v_s0": v0_50,
        "calibration_gap": round(v0_50 - rew50, 2),
        "star_funnel": {
            "p_1star_pct": s1,
            "p_2star_given_1star_pct": p2_given_1,
            "p_3star_given_2star_pct": p3_given_2,
            "near_miss_85_to_99_pct_rate": round(sum(1 for p, s in zip(pcts, stars) if 85.0 <= p < 100.0 and s < 3) * 100.0 / n, 1),
        },
    }


def _get_loop_status_payload() -> Dict[str, Any]:
    interval = max(60, int(_loop_state.get("interval_seconds", 600)))
    is_training_now = bool(_training_state.get("is_training", False))
    rem_sec = max(
        0,
        min(
            interval,
            int(round(float(_loop_state.get("remaining_training_seconds", interval)))),
        ),
    )
    horizon_eps = max(12, int(_loop_state.get("test_episodes_per_cycle", 5000)))
    cum_ep = int(_training_state.get("cumulative_episode", 0) or _training_state.get("current_episode", 0))
    active_hyp = _loop_state.get("active_hypothesis")
    if isinstance(active_hyp, dict):
        base_ep = int(active_hyp.get("baseline_episode", 0))
        target_ep = base_ep + int(active_hyp.get("target_episodes", horizon_eps))
    else:
        base_ep = int(_loop_state.get("last_cycle_episode", 0))
        target_ep = base_ep + horizon_eps
    eps_until_next = max(0, target_ep - cum_ep)
    _loop_state["last_cycle_episode"] = base_ep
    _loop_state["next_cycle_target_episode"] = target_ep
    _loop_state["episodes_until_next_cycle"] = eps_until_next

    active_cfg = _loop_state.get("active_config") or load_active_experiment_config()
    paused_waiting = bool(_loop_state.get("enabled", False) and not is_training_now and not _loop_state.get("is_running_cycle", False))
    effective_phase = (
        "standby_waiting_for_training"
        if paused_waiting and _loop_state.get("phase") in ("idle", "monitoring")
        else _loop_state.get("phase", "idle")
    )
    return {
        **_loop_state,
        "phase": effective_phase,
        "paused_waiting_for_training": paused_waiting,
        "active_config": active_cfg,
        "reward_formula": format_reward_formula(active_cfg.get("reward_config")),
        "seconds_until_next_check": rem_sec,
        "episodes_until_next_cycle": eps_until_next,
        "next_cycle_target_episode": target_ep,
        "live_telemetry_compact": _compute_fast_telemetry_compact(),
    }


_ARCH_MANIFEST_CACHE: Tuple[float, str, Dict[str, Any]] = (0.0, "", {})


def _get_fresh_architecture_manifest(force: bool = False) -> Dict[str, Any]:
    global _ARCH_MANIFEST_CACHE
    import importlib
    import coc_rl.networks as _net_mod

    net_file = getattr(_net_mod, "__file__", "")
    mtime = os.path.getmtime(net_file) if net_file and os.path.exists(net_file) else 0.0
    active_arch_cfg = load_active_experiment_config().get("arch_config", {})
    arch_sig = json.dumps(active_arch_cfg, sort_keys=True)
    if (
        not force
        and _ARCH_MANIFEST_CACHE[2]
        and _ARCH_MANIFEST_CACHE[0] == mtime
        and _ARCH_MANIFEST_CACHE[1] == arch_sig
    ):
        return _ARCH_MANIFEST_CACHE[2]

    importlib.reload(_net_mod)
    fresh_model = _net_mod.CoCActorCritic(arch_config=active_arch_cfg)
    manifest = ensure_architecture_diagrams(fresh_model, force=force)
    if isinstance(manifest.get("live_spec"), dict):
        manifest["live_spec"]["arch_config"] = fresh_model.get_arch_config()
    _ARCH_MANIFEST_CACHE = (mtime, arch_sig, manifest)
    return manifest


@app.get("/api/ai/status")
def get_ai_status() -> Dict[str, Any]:
    arch_manifest = _get_fresh_architecture_manifest(force=False)
    live_params = int(arch_manifest.get("total_params") or 1360000)
    saved_models = list_trained_models()

    ckpt_meta: Dict[str, Any] = {}
    if saved_models:
        latest = saved_models[0]
        ckpt_meta = {
            "episode": latest.get("episode", 0),
            "best_pct": latest.get("best_pct", 0),
            "best_stars": latest.get("best_stars", 0),
            "best_reward": round(float(latest.get("best_reward", 0.0)), 3),
        }

    if not _training_state.get("matchup_stats") or not _training_state["matchup_stats"].get("army_stats"):
        _training_state["matchup_stats"] = compute_matchup_stats(
            history=_training_state.get("history", []),
        )

    return {
        "online": True,
        "device": str(DEVICE),
        "device_name": DEVICE_NAME,
        "param_count": live_params,
        "saved_models": saved_models,
        "architecture_hash": arch_manifest.get("architecture_hash"),
        "architecture_files": arch_manifest.get("files"),
        "architecture_spec": arch_manifest.get("live_spec"),
        "checkpoint": ckpt_meta,
        "training": _training_state,
        "recursive_loop": _get_loop_status_payload(),
    }


@app.get("/api/ai/architecture/spec")
def get_architecture_spec(force: bool = False) -> Dict[str, Any]:
    manifest = _get_fresh_architecture_manifest(force=force)
    return {
        "architecture_hash": manifest.get("architecture_hash"),
        "regenerated": manifest.get("regenerated", False),
        "spec": manifest.get("live_spec"),
    }


@app.get("/api/ai/models")
def get_saved_models() -> Dict[str, Any]:
    return {"models": list_trained_models()}


@app.get("/api/ai/models/history")
def get_saved_model_history_query(model_file: str = "latest_attacker.pt") -> Dict[str, Any]:
    return get_model_training_history(model_file)


@app.get("/api/ai/models/{model_file}/history")
def get_saved_model_history_path(model_file: str) -> Dict[str, Any]:
    return get_model_training_history(model_file)


@app.post("/api/ai/models/rename")
def rename_model(req: RenameModelRequest) -> Dict[str, Any]:
    try:
        updated_models = rename_trained_model(req.old_filename, req.new_filename)
        new_name = sanitize_model_filename(req.new_filename)
        with _train_lock:
            if _training_state.get("resume_from") == req.old_filename:
                _training_state["resume_from"] = new_name
            if _training_state.get("saved_filename") == req.old_filename:
                _training_state["saved_filename"] = new_name
        return {"success": True, "models": updated_models, "new_filename": new_name}
    except Exception as e:
        return {"success": False, "error": str(e), "models": list_trained_models()}


@app.get("/api/ai/presets/armies")
def get_army_presets() -> Dict[str, Any]:
    all_armies, custom_armies = get_all_army_presets()
    return {"all_armies": all_armies, "custom_armies": custom_armies}


@app.post("/api/ai/presets/armies")
def add_custom_army_preset(army: Dict[str, Any]) -> Dict[str, Any]:
    updated_custom = save_custom_army(army)
    all_armies, _ = get_all_army_presets()
    return {"success": True, "custom_armies": updated_custom, "all_armies": all_armies}


@app.delete("/api/ai/presets/armies/{name}")
def remove_custom_army_preset(name: str) -> Dict[str, Any]:
    updated_custom = delete_custom_army(name)
    all_armies, _ = get_all_army_presets()
    return {"success": True, "custom_armies": updated_custom, "all_armies": all_armies}


@app.get("/api/ai/architecture.svg")
def get_architecture_svg(detail: str = "overview", force: bool = False) -> FileResponse:
    manifest = _get_fresh_architecture_manifest(force=force)
    key = "detailed" if detail == "detailed" else "overview"
    rel_path = manifest["files"][key]["svg"]
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return FileResponse(
        os.path.join(repo_root, rel_path),
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
        },
    )


@app.post("/api/ai/inspect")
def inspect_policy_and_tensors(req: InspectRequest) -> Dict[str, Any]:
    live_attacker, atk_ckpt = load_attacker_model(
        DEVICE, attacker_model_file=req.model_file
    )
    live_attacker.eval()

    ckpt_army = atk_ckpt.get("army")
    if not isinstance(ckpt_army, dict):
        ckpt_armies = atk_ckpt.get("armies")
        if isinstance(ckpt_armies, list) and len(ckpt_armies) > 0 and isinstance(ckpt_armies[0], dict):
            ckpt_army = ckpt_armies[0]

    effective_army_json = json.dumps(ckpt_army) if isinstance(ckpt_army, dict) else req.army_json

    env = CoCAttackerEnv(
        layout_json=req.layout_json,
        army_json=effective_army_json,
        ticks_per_step=5,
    )
    obs_np, info = env.reset()

    obs_t = torch.as_tensor(obs_np, dtype=torch.float32, device=DEVICE).unsqueeze(0)
    army_ctx_t = torch.as_tensor(
        info["army_context"], dtype=torch.float32, device=DEVICE
    ).unsqueeze(0)
    masks_t = masks_np_to_torch(info["action_masks"], DEVICE, prevent_early_noop=False)

    with torch.no_grad():
        action_t, _, entropy_t, value_t, diag = live_attacker.get_action_and_value(
            obs_t, masks=masks_t, army_context=army_ctx_t
        )

    act = action_t.squeeze(0).cpu().tolist()

    fraction_bins = (0.0, 0.25, 0.50, 0.75, 1.00)
    frac_bin = int(act[4])
    deploy_fraction = fraction_bins[max(0, min(len(fraction_bins) - 1, frac_bin))]

    model_armies = [ckpt_army] if isinstance(ckpt_army, dict) else atk_ckpt.get("armies", [])
    model_villages = atk_ckpt.get("villages", [])
    model_army_name = ckpt_army.get("name", "Army") if isinstance(ckpt_army, dict) else ""

    return {
        "channels": obs_np.tolist(),
        "tile_heatmap": diag["tile_heatmap"].squeeze(0).cpu().tolist(),
        "slot_type_probs": diag["slot_type_probs"].squeeze(0).cpu().tolist(),
        "slot_idx_probs": diag["slot_idx_probs"].squeeze(0).cpu().tolist(),
        "deploy_fraction_probs": diag["deploy_fraction_probs"].squeeze(0).cpu().tolist(),
        "value": round(float(value_t.item()), 4),
        "entropy": round(float(entropy_t.item()), 4),
        "suggested_action": {
            "slot_type": int(act[0]),
            "slot_idx": int(act[1]),
            "tile_x": int(act[2]),
            "tile_y": int(act[3]),
            "deploy_fraction": round(float(deploy_fraction), 2),
        },
        "model_meta": {
            "filename": req.model_file or "",
            "episode": int(atk_ckpt.get("episode", 0)),
            "best_pct": int(atk_ckpt.get("best_pct", 0)),
            "best_stars": int(atk_ckpt.get("best_stars", 0)),
            "best_reward": round(float(atk_ckpt.get("best_reward", 0.0)), 2),
            "hyperparams": atk_ckpt.get("hyperparams", {}),
            "army": ckpt_army,
            "army_name": model_army_name,
            "army_slug": atk_ckpt.get("army_slug") or (army_name_to_slug(model_army_name) if model_army_name else ""),
            "armies": model_armies,
            "villages": model_villages,
            "army_names": [a.get("name") for a in model_armies if isinstance(a, dict)],
            "village_names": [v.get("name") for v in model_villages if isinstance(v, dict)],
        },
    }


@app.post("/api/ai/rollout")
def run_trained_model_rollout(req: RolloutRequest) -> Dict[str, Any]:
    return simulate_model_rollout(
        model_file=req.model_file,
        layout_json=req.layout_json,
        army_json=req.army_json,
        ticks_per_step=req.ticks_per_step,
        deterministic=req.deterministic,
    )


@app.post("/api/ai/train/start")
def start_ppo_training(req: TrainStartRequest) -> Dict[str, Any]:
    with _train_lock:
        if _training_state["is_training"]:
            return {
                "started": False,
                "reason": "Training already in progress",
                "training": _training_state,
            }
        _training_state["is_training"] = True
        _training_state["stop_requested"] = False
        _training_state["matchup_mode"] = req.matchup_mode
        _training_state["resume_from"] = req.resume_from or "scratch"
        _training_state["current_episode"] = 0
        _training_state["total_episodes"] = req.episodes
        _training_state["history"] = []

        # Reset episode horizon for this training session
        horizon = max(12, int(_loop_state.get("test_episodes_per_cycle", 5000)))
        _loop_state["is_running_cycle"] = False

        # Only reset loop history if starting manually from scratch (not during a progressive arch morph)
        is_scratch = not req.resume_from or str(req.resume_from).strip().lower() in ("scratch", "none", "")
        preserve_loop = bool(_loop_state.pop("preserve_loop_on_scratch_start", False))
        if is_scratch and not preserve_loop:
            _loop_state["cycles"] = []
            _loop_state["current_cycle_id"] = 0
            _loop_state["active_hypothesis"] = None
            _loop_state["last_cycle_episode"] = 0
            _loop_state["next_cycle_target_episode"] = horizon
            _loop_state["episodes_until_next_cycle"] = horizon
            _loop_state["phase"] = "monitoring" if _loop_state.get("enabled", False) else "idle"
            default_cfg = get_default_experiment_config()
            save_active_experiment_config(default_cfg)
            _loop_state["active_config"] = default_cfg
            _loop_state["last_model_visualizer_sync"] = trigger_model_visualizer_agent(
                arch_config=default_cfg.get("arch_config"),
                reason="reset_to_gen0_baseline_on_scratch_start",
            )
            _get_fresh_architecture_manifest(force=True)
        else:
            if _loop_state.get("phase") in ("analyzing", "documenting_baseline", "applying_solution"):
                _loop_state["phase"] = "testing_solution" if _loop_state.get("active_hypothesis") else ("monitoring" if _loop_state.get("enabled", False) else "idle")

        save_recursive_loop_state(_loop_state)
        sync_recursive_loop_to_vault(_loop_state)

    def _worker() -> None:
        def _on_ep(rec: Dict[str, Any]) -> bool:
            ep_copy = dict(rec)
            _training_state["current_episode"] = ep_copy["episode"]
            _training_state["cumulative_episode"] = ep_copy.get(
                "cumulative_episode", ep_copy["episode"]
            )
            _training_state["best_pct"] = ep_copy["best_pct"]
            _training_state["best_stars"] = ep_copy["best_stars"]
            _training_state["history"].append(ep_copy)

            stats_stride = max(2, int(req.batch_episodes))
            if ep_copy["episode"] % stats_stride == 0 or ep_copy["episode"] == ep_copy["total_episodes"]:
                try:
                    _training_state["matchup_stats"] = compute_matchup_stats(
                        history=_training_state["history"]
                    )
                except Exception:
                    pass

            return not bool(_training_state["stop_requested"])

        try:
            res = train_pytorch_ppo(
                episodes=req.episodes,
                batch_episodes=req.batch_episodes,
                minibatch_size=req.minibatch_size,
                ppo_epochs=req.ppo_epochs,
                lr=req.lr,
                ticks_per_step=req.ticks_per_step,
                matchup_mode=req.matchup_mode,
                resume_from=req.resume_from,
                save_name=req.save_name,
                layout_json=req.layout_json,
                army_json=req.army_json,
                armies_json=req.armies_json,
                villages_json=req.villages_json,
                on_episode_callback=_on_ep,
            )
            if "matchup_stats" in res:
                _training_state["matchup_stats"] = res["matchup_stats"]
            if "saved_filename" in res:
                _training_state["saved_filename"] = res["saved_filename"]
            if "army" in res:
                _training_state["army"] = res["army"]
            if "army_name" in res:
                _training_state["army_name"] = res["army_name"]
            if "armies" in res:
                _training_state["armies"] = res["armies"]
            if "villages" in res:
                _training_state["villages"] = res["villages"]
        finally:
            with _train_lock:
                _training_state["is_training"] = False
                _training_state["stop_requested"] = False
                try:
                    os.makedirs(os.path.dirname(_LAST_STATE_PATH), exist_ok=True)
                    compressed_blob = compress_training_history(_training_state.get("history", []))
                    _training_state["compression"] = get_compressed_history_meta(compressed_blob)
                    state_to_save = {
                        k: v for k, v in _training_state.items() if k != "history"
                    }
                    state_to_save["history_compressed"] = compressed_blob
                    with open(_LAST_STATE_PATH, "w", encoding="utf-8") as _f:
                        json.dump(state_to_save, _f)
                except Exception:
                    pass

            # If a Recursive Improvement Loop hypothesis was being tested, verify it automatically!
            if (
                _loop_state.get("active_hypothesis")
                and not _loop_state.get("is_running_cycle")
                and not _loop_state.get("suppress_post_stop_auto_verify")
            ):
                def _verify_after_train() -> None:
                    try:
                        run_recursive_improvement_cycle(
                            loop_state=_loop_state,
                            training_state=_training_state,
                            device=DEVICE,
                            trigger="post_test_verification",
                            use_llm=False,
                            start_training_callback=(
                                (lambda cfg: _launch_verification_training(cfg))
                                if _loop_state.get("auto_apply_and_test", True)
                                else None
                            ),
                            restart_new_arch_callback=(
                                (lambda cfg, cid: _stop_and_restart_new_architecture_training(cfg, cid))
                                if _loop_state.get("auto_apply_and_test", True)
                                else None
                            ),
                        )
                    except Exception:
                        pass

                threading.Thread(target=_verify_after_train, daemon=True).start()

    threading.Thread(target=_worker, daemon=True).start()
    return {"started": True, "training": _training_state}


def _launch_verification_training(active_cfg: Dict[str, Any], test_episodes_override: Optional[int] = None) -> bool:
    """
    Launches a verification training burst resuming from the latest checkpoint
    using the updated `active_cfg` (arch_config, reward_config, hyperparams).
    """
    if _training_state.get("is_training"):
        return False
    saved = [m for m in list_trained_models() if m.get("model_type") != "archived_attacker"]
    resume_target = (
        _training_state.get("saved_filename")
        or (saved[0]["filename"] if saved else "scratch")
    )
    hp = active_cfg.get("hyperparams", {})
    eps_to_run = int(
        test_episodes_override
        or _loop_state.get("test_episodes_per_cycle")
        or 300
    )
    req = TrainStartRequest(
        episodes=max(12, eps_to_run),
        batch_episodes=int(hp.get("batch_episodes", 12)),
        minibatch_size=int(hp.get("minibatch_size", 128)),
        ppo_epochs=int(hp.get("ppo_epochs", 4)),
        lr=float(hp.get("lr", 3e-4)),
        ticks_per_step=int(hp.get("ticks_per_step", 8)),
        matchup_mode=str(hp.get("matchup_mode", "random")),
        resume_from=resume_target,
    )
    res = start_ppo_training(req)
    return bool(res.get("started"))


def _stop_and_restart_new_architecture_training(
    active_cfg: Dict[str, Any],
    cycle_id: int,
    test_episodes_override: Optional[int] = None,
) -> bool:
    """
    Stops the currently running model (if active), archives existing checkpoints
    from `trained_models/checkpoints/` into `trained_models/archives/` to keep
    `trained_models/` clean, regenerates the architecture diagrams for the new
    architecture, and restarts PPO training from scratch (`resume_from='scratch'`)
    for at least 300 episodes.
    """
    ensure_trained_models_dir()
    if _training_state.get("is_training"):
        _loop_state["suppress_post_stop_auto_verify"] = True
        _training_state["stop_requested"] = True
        waited = 0.0
        while _training_state.get("is_training") and waited < 45.0:
            time.sleep(0.25)
            waited += 0.25
        _loop_state["suppress_post_stop_auto_verify"] = False

    # Determine whether the Argon 4 agent selected warm_start weight transfer or scratch_restart
    arch_cfg = active_cfg.get("arch_config", {})
    weight_mode = str(arch_cfg.get("weight_transfer_mode", "warm_start"))
    saved = [m for m in list_trained_models() if m.get("model_type") != "archived_attacker"]
    latest_ckpt = _training_state.get("saved_filename") or (saved[0]["filename"] if saved else "")

    if weight_mode == "scratch_restart" or not latest_ckpt:
        # Archive existing active checkpoints into `trained_models/archives/`
        if os.path.isdir(CHECKPOINTS_DIR):
            for fname in list(os.listdir(CHECKPOINTS_DIR)):
                if not fname.endswith(".pt"):
                    continue
                src = os.path.join(CHECKPOINTS_DIR, fname)
                if not os.path.isfile(src):
                    continue
                dst_name = f"cycle_{cycle_id:03d}_{fname}"
                dst = os.path.join(ARCHIVES_DIR, dst_name)
                try:
                    shutil.move(src, dst)
                except Exception:
                    pass
        resume_target = "scratch"
    else:
        # Warm-start compatible weights from latest_ckpt via transfer_compatible_weights()
        resume_target = latest_ckpt

    with _train_lock:
        if resume_target == "scratch":
            _training_state["saved_filename"] = ""
            _training_state["resume_from"] = "scratch"
            _training_state["current_episode"] = 0
            _training_state["cumulative_episode"] = 0
            _training_state["best_pct"] = 0
            _training_state["best_stars"] = 0
            _training_state["history"] = []
        else:
            _training_state["resume_from"] = resume_target

    # Trigger model-visualizer agent and refresh the live architecture manifest so Model Trainer showcases the new model
    _loop_state["last_model_visualizer_sync"] = trigger_model_visualizer_agent(
        arch_config=arch_cfg,
        reason=f"cycle_{cycle_id}_arch_morph_{arch_cfg.get('arch_version', 'v4.0')}",
    )
    try:
        _get_fresh_architecture_manifest(force=True)
    except Exception:
        pass

    hp = active_cfg.get("hyperparams", {})
    eps_to_run = max(
        300,
        int(
            test_episodes_override
            or _loop_state.get("test_episodes_per_cycle")
            or 5000
        ),
    )
    _loop_state["preserve_loop_on_scratch_start"] = True
    req = TrainStartRequest(
        episodes=eps_to_run,
        batch_episodes=int(hp.get("batch_episodes", 12)),
        minibatch_size=int(hp.get("minibatch_size", 128)),
        ppo_epochs=int(hp.get("ppo_epochs", 4)),
        lr=float(hp.get("lr", 3e-4)),
        ticks_per_step=int(hp.get("ticks_per_step", 8)),
        matchup_mode=str(hp.get("matchup_mode", "round_robin")),
        resume_from=resume_target,
    )
    res = start_ppo_training(req)
    return bool(res.get("started"))


@app.post("/api/ai/train/stop")
def stop_ppo_training() -> Dict[str, Any]:
    _training_state["stop_requested"] = True
    return {"stopping": True, "training": _training_state}


@app.get("/api/ai/loop/status")
def get_recursive_loop_status() -> Dict[str, Any]:
    return _get_loop_status_payload()


@app.post("/api/ai/loop/configure")
def configure_recursive_loop(req: LoopConfigureRequest) -> Dict[str, Any]:
    if req.enabled is not None:
        _loop_state["enabled"] = bool(req.enabled)
        if req.enabled:
            now_ts = time.time()
            interval = max(60, int(req.interval_seconds or _loop_state.get("interval_seconds", 600)))
            _loop_state["remaining_training_seconds"] = interval
            _loop_state["next_check_ts"] = now_ts + interval
            _loop_state["next_check_at"] = time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime(now_ts + interval)
            )
            if _loop_state.get("phase") == "idle":
                _loop_state["phase"] = "monitoring"
        else:
            if _loop_state.get("phase") == "monitoring":
                _loop_state["phase"] = "idle"
    if req.interval_seconds is not None:
        interval = max(60, int(req.interval_seconds))
        _loop_state["interval_seconds"] = interval
        _loop_state["remaining_training_seconds"] = interval
        now_ts = time.time()
        _loop_state["next_check_ts"] = now_ts + interval
        _loop_state["next_check_at"] = time.strftime(
            "%Y-%m-%d %H:%M:%S", time.localtime(now_ts + interval)
        )
    if req.auto_apply_and_test is not None:
        _loop_state["auto_apply_and_test"] = bool(req.auto_apply_and_test)
    if req.test_episodes_per_cycle is not None:
        _loop_state["test_episodes_per_cycle"] = max(12, int(req.test_episodes_per_cycle))
    if req.provider and req.provider in AI_PROVIDERS:
        _loop_state["provider"] = req.provider

    save_recursive_loop_state(_loop_state)
    sync_recursive_loop_to_vault(_loop_state)
    return _get_loop_status_payload()


@app.post("/api/ai/loop/run-cycle")
def trigger_recursive_loop_cycle(req: LoopRunCycleRequest) -> Dict[str, Any]:
    hist_len = len(_training_state.get("history", []))
    cum_ep = int(_training_state.get("cumulative_episode", 0) or _training_state.get("current_episode", 0))
    if hist_len == 0 and cum_ep == 0:
        return {
            "error": "Cannot run diagnostic: No training episodes completed yet. Please allow training to run for at least 10 minutes to gather telemetry.",
            **_get_loop_status_payload(),
        }
    prev_auto = _loop_state.get("auto_apply_and_test", True)
    _loop_state["auto_apply_and_test"] = bool(req.auto_test)
    try:
        run_recursive_improvement_cycle(
            loop_state=_loop_state,
            training_state=_training_state,
            device=DEVICE,
            trigger=req.trigger or "manual_trigger",
            selected_solution_id=req.selected_solution_id,
            selected_solution_ids=req.selected_solution_ids,
            run_code_agent=req.run_code_agent,
            use_llm=req.use_llm,
            start_training_callback=(
                (lambda cfg: _launch_verification_training(cfg))
                if req.auto_test
                else None
            ),
            restart_new_arch_callback=(
                (lambda cfg, cid: _stop_and_restart_new_architecture_training(cfg, cid))
                if req.auto_test
                else None
            ),
        )
    finally:
        _loop_state["auto_apply_and_test"] = prev_auto
        save_recursive_loop_state(_loop_state)
    return _get_loop_status_payload()


@app.post("/api/ai/loop/restart-new-arch")
def trigger_stop_and_restart_new_arch(req: LoopRunCycleRequest) -> Dict[str, Any]:
    """
    Explicitly triggers the 'Stop Model & Restart with New Architecture' decision:
    diagnoses the issues in the current/previous run over the last 300 episodes,
    documents the pre-change baseline snapshot, stops the active model (archiving it
    to `trained_models/archives/`), applies the new architecture designed to solve
    those issues, and restarts training from scratch for 300 episodes.
    """
    prev_auto = _loop_state.get("auto_apply_and_test", True)
    _loop_state["auto_apply_and_test"] = True
    try:
        run_recursive_improvement_cycle(
            loop_state=_loop_state,
            training_state=_training_state,
            device=DEVICE,
            trigger="restart_new_arch",
            run_code_agent=req.run_code_agent,
            use_llm=req.use_llm,
            start_training_callback=(lambda cfg: _launch_verification_training(cfg)),
            restart_new_arch_callback=(
                lambda cfg, cid: _stop_and_restart_new_architecture_training(cfg, cid)
            ),
        )
    finally:
        _loop_state["auto_apply_and_test"] = prev_auto
        save_recursive_loop_state(_loop_state)
    return _get_loop_status_payload()


@app.post("/api/ai/loop/apply-solution")
def apply_specific_loop_solution(req: LoopApplySolutionRequest) -> Dict[str, Any]:
    """
    Applies 1 or MORE candidate solutions from the specified or latest cycle
    (ensuring the Pre-Change Baseline Snapshot is documented first), merges
    their config patches, invokes the OpenCode `google-vertex/gemini-4-argon#medium`
    code agent if any selected solution requires code edits, logs to the Obsidian
    Vault, and either launches an in-place verification run or stops the current
    model and restarts from scratch with a new architecture.
    """
    req_ids = list(req.solution_ids or ([] if not req.solution_id else [req.solution_id]))
    cycles = list(_loop_state.get("cycles") or [])
    if not cycles:
        return {
            "error": "No diagnostic cycle available to apply solutions from yet. A diagnostic must run first.",
            **_get_loop_status_payload(),
        }

    target_cycle = cycles[-1]
    if req.cycle_id is not None:
        found = next((c for c in cycles if c.get("cycle_id") == req.cycle_id), None)
        if found:
            target_cycle = found

    candidates = target_cycle.get("candidate_solutions", [])
    id_set = set(req_ids)
    chosen_list = [c for c in candidates if c.get("solution_id") in id_set]
    if not chosen_list and candidates:
        chosen_list = [candidates[0]]
    if not chosen_list:
        return _get_loop_status_payload()

    cycle_num = int(target_cycle.get("cycle_id", len(cycles)))

    # Ensure pre-change baseline snapshot is documented before applying change
    active_config = load_active_experiment_config()
    telemetry = gather_training_telemetry(_training_state, DEVICE)
    pre_snap = capture_pre_change_snapshot(
        cycle_id=cycle_num,
        telemetry=telemetry,
        active_config=active_config,
    )
    target_cycle["pre_change_snapshot"] = pre_snap

    new_cfg, _, composite_sol = merge_selected_solutions(
        active_config, chosen_list
    )
    active_config = save_active_experiment_config(new_cfg)
    composite_sol["applied_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    restarted_from_scratch = bool(
        composite_sol.get("requires_restart_from_scratch")
        or composite_sol.get("decision_type") == "stop_and_restart_new_arch"
        or composite_sol.get("category") == "new_architecture_restart"
    )
    target_cycle["restarted_from_scratch"] = restarted_from_scratch
    target_cycle["selected_solutions"] = chosen_list
    target_cycle["selected_solution"] = composite_sol
    target_cycle["verification_result"] = None

    if (
        req.run_code_agent
        and composite_sol.get("requires_code_edit")
        and composite_sol.get("code_edit_instructions")
    ):
        target_cycle["code_agent_execution"] = execute_opencode_argon_code_edit(
            instructions=str(composite_sol["code_edit_instructions"]),
            target_files=list(
                composite_sol.get("target_files")
                or ["python/coc_rl/networks.py", "python/coc_rl/ppo.py"]
            ),
            cycle_id=cycle_num,
            allow_architecture_redesign=restarted_from_scratch,
            arch_config=active_config.get("arch_config"),
        )

    # If arch_config changed, start the model-visualizer agent and refresh the Model Trainer spec
    arch_changed = (
        restarted_from_scratch
        or bool((composite_sol.get("config_patch") or {}).get("arch_config"))
        or any(d.get("section") == "arch_config" for d in (composite_sol.get("diffs") or []))
    )
    if arch_changed:
        _loop_state["last_model_visualizer_sync"] = trigger_model_visualizer_agent(
            arch_config=active_config.get("arch_config"),
            reason=f"apply_solution_cycle_{cycle_num}",
        )
        try:
            _get_fresh_architecture_manifest(force=True)
        except Exception:
            pass

    test_eps = int(req.test_episodes or _loop_state.get("test_episodes_per_cycle", 5000))
    if restarted_from_scratch:
        test_eps = max(500, test_eps)
    base_ep = 0 if (restarted_from_scratch and active_config.get("arch_config", {}).get("weight_transfer_mode") == "scratch_restart") else pre_snap["cumulative_episode"]
    _loop_state["active_config"] = active_config
    _loop_state["phase"] = "testing_solution"
    _loop_state["last_cycle_episode"] = base_ep
    _loop_state["next_cycle_target_episode"] = base_ep + test_eps
    _loop_state["episodes_until_next_cycle"] = test_eps
    _loop_state["active_hypothesis"] = {
        "cycle_id": cycle_num,
        "solution": composite_sol,
        "baseline_episode": base_ep,
        "pre_restart_episode": pre_snap["cumulative_episode"],
        "restarted_from_scratch": restarted_from_scratch,
        "weight_transfer_mode": (active_config.get("arch_config") or {}).get("weight_transfer_mode", "warm_start"),
        "target_episodes": test_eps,
        "baseline_metrics": pre_snap["baseline_metrics"],
    }
    sync_recursive_loop_to_vault(_loop_state)
    save_recursive_loop_state(_loop_state)

    if req.auto_test:
        if restarted_from_scratch:
            _stop_and_restart_new_architecture_training(active_config, cycle_num, test_eps)
        elif not _training_state.get("is_training", False):
            _launch_verification_training(active_config, test_eps)

    return _get_loop_status_payload()


@app.post("/api/ai/loop/update-config")
def update_active_loop_config_parameters(req: LoopUpdateConfigRequest) -> Dict[str, Any]:
    """
    Directly updates any parameters across `arch_config`, `reward_config`, and `hyperparams`
    guided by the live telemetry data. If `arch_config` is modified, automatically starts the
    `model-visualizer` agent (`agy --agent model-visualizer --model gemini-3.8-flash-medium`)
    and refreshes the live architecture manifest so the Model Trainer immediately showcases
    the updated model.
    """
    active_config = load_active_experiment_config()
    patch = {
        "arch_config": req.arch_config or {},
        "reward_config": req.reward_config or {},
        "hyperparams": req.hyperparams or {},
    }
    new_cfg, diffs = apply_config_patch(active_config, patch)
    saved_cfg = save_active_experiment_config(new_cfg)
    _loop_state["active_config"] = saved_cfg

    arch_diffs = [d for d in diffs if d.get("section") == "arch_config"]
    if arch_diffs or req.restart_or_morph_model:
        _loop_state["last_model_visualizer_sync"] = trigger_model_visualizer_agent(
            arch_config=saved_cfg.get("arch_config"),
            reason="interactive_parameter_studio_arch_update",
        )
        try:
            _get_fresh_architecture_manifest(force=True)
        except Exception:
            pass

    save_recursive_loop_state(_loop_state)
    sync_recursive_loop_to_vault(_loop_state)

    test_eps = int(req.test_episodes or _loop_state.get("test_episodes_per_cycle", 5000))
    if req.restart_or_morph_model:
        cid = int(_loop_state.get("current_cycle_id", 0)) + 1
        _stop_and_restart_new_architecture_training(saved_cfg, cid, test_eps)
    elif req.auto_test and not _training_state.get("is_training", False):
        _launch_verification_training(saved_cfg, test_eps)

    return _get_loop_status_payload()


@app.post("/api/ai/loop/verify")
def verify_current_loop_solution() -> Dict[str, Any]:
    """
    Immediately verifies the currently active solution against the Pre-Change Baseline Snapshot
    over the last 300 episodes and logs the Before vs After empirical verification dossier.
    """
    cycles = list(_loop_state.get("cycles") or [])
    if not cycles:
        return _get_loop_status_payload()
    last_cycle = cycles[-1]
    if not last_cycle.get("selected_solution"):
        return _get_loop_status_payload()

    telemetry = gather_training_telemetry(_training_state, DEVICE)
    active_cfg = load_active_experiment_config()
    ver_res, next_cfg = verify_solution_outcome(
        cycle=last_cycle,
        post_telemetry=telemetry,
        current_config=active_cfg,
        past_cycles=cycles,
    )
    last_cycle["verification_result"] = ver_res
    last_cycle["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    _loop_state["active_hypothesis"] = None
    _loop_state["active_config"] = next_cfg
    _loop_state["phase"] = "monitoring" if _loop_state.get("enabled") else "idle"
    if next_cfg.get("arch_config") != active_cfg.get("arch_config"):
        _loop_state["last_model_visualizer_sync"] = trigger_model_visualizer_agent(
            arch_config=next_cfg.get("arch_config"),
            reason="post_verification_arch_sync",
        )
        try:
            _get_fresh_architecture_manifest(force=True)
        except Exception:
            pass
    sync_recursive_loop_to_vault(_loop_state)
    save_recursive_loop_state(_loop_state)

    if ver_res.get("trigger_new_arch_restart") and _loop_state.get("auto_apply_and_test", True):
        cid = int(last_cycle.get("cycle_id", len(cycles)))
        _stop_and_restart_new_architecture_training(next_cfg, cid)

    return _get_loop_status_payload()


@app.post("/api/ai/loop/reset")
def reset_recursive_loop() -> Dict[str, Any]:
    """
    Clears all progressive evolution cycles, cancels active hypotheses,
    restores the Stage 0 (`v4.0-Gen0-TinyCNN`) baseline experiment configuration,
    and triggers `model-visualizer` so the Model Trainer reflects Gen 0.
    """
    horizon = max(12, int(_loop_state.get("test_episodes_per_cycle", 5000)))
    _loop_state["cycles"] = []
    _loop_state["current_cycle_id"] = 0
    _loop_state["active_hypothesis"] = None
    _loop_state["last_cycle_episode"] = 0
    _loop_state["next_cycle_target_episode"] = horizon
    _loop_state["episodes_until_next_cycle"] = horizon
    _loop_state["phase"] = "monitoring" if _loop_state.get("enabled", False) else "idle"
    _loop_state["is_running_cycle"] = False
    default_cfg = get_default_experiment_config()
    save_active_experiment_config(default_cfg)
    _loop_state["active_config"] = default_cfg
    _loop_state["last_model_visualizer_sync"] = trigger_model_visualizer_agent(
        arch_config=default_cfg.get("arch_config"),
        reason="reset_loop_to_gen0_baseline",
    )
    try:
        _get_fresh_architecture_manifest(force=True)
    except Exception:
        pass
    save_recursive_loop_state(_loop_state)
    sync_recursive_loop_to_vault(_loop_state)
    return _get_loop_status_payload()


def _init_and_start_recursive_loop_daemon() -> None:
    """
    Background Episode-Horizon Progressive Evolution Daemon (replaces the legacy 10m timer loop).
    Monitors cumulative training episodes while `enabled=True` and `is_training=True`; whenever
    the episode horizon (`test_episodes_per_cycle`, default 5,000 episodes) is reached, automatically
    runs AGY CoC strategy research, plateau diagnosis, parameter tuning or OpenCode Argon 4 progressive
    architecture morphing, and `model-visualizer` synchronization.
    """
    horizon = max(12, int(_loop_state.get("test_episodes_per_cycle", 5000)))
    if "next_cycle_target_episode" not in _loop_state or int(_loop_state.get("next_cycle_target_episode", 0)) <= 0:
        _loop_state["last_cycle_episode"] = 0
        _loop_state["next_cycle_target_episode"] = horizon
        _loop_state["episodes_until_next_cycle"] = horizon

    def _daemon() -> None:
        while True:
            time.sleep(2.0)
            try:
                if not _loop_state.get("enabled", False):
                    continue
                if _loop_state.get("is_running_cycle", False):
                    continue
                if not _training_state.get("is_training", False):
                    continue

                cum_ep = int(_training_state.get("cumulative_episode", 0) or _training_state.get("current_episode", 0))
                if cum_ep <= 0 and len(_training_state.get("history", [])) == 0:
                    continue

                horizon_eps = max(12, int(_loop_state.get("test_episodes_per_cycle", 5000)))
                active_hyp = _loop_state.get("active_hypothesis")
                if isinstance(active_hyp, dict):
                    base_ep = int(active_hyp.get("baseline_episode", 0))
                    target_ep = base_ep + int(active_hyp.get("target_episodes", horizon_eps))
                else:
                    base_ep = int(_loop_state.get("last_cycle_episode", 0))
                    target_ep = base_ep + horizon_eps

                rem_eps = max(0, target_ep - cum_ep)
                _loop_state["episodes_until_next_cycle"] = rem_eps
                _loop_state["next_cycle_target_episode"] = target_ep

                if cum_ep >= target_ep and cum_ep > base_ep:
                    _loop_state["last_cycle_episode"] = cum_ep
                    _loop_state["next_cycle_target_episode"] = cum_ep + horizon_eps
                    _loop_state["episodes_until_next_cycle"] = horizon_eps
                    run_recursive_improvement_cycle(
                        loop_state=_loop_state,
                        training_state=_training_state,
                        device=DEVICE,
                        trigger=f"episode_horizon_{horizon_eps}",
                        use_llm=True,
                        start_training_callback=(
                            (lambda cfg: _launch_verification_training(cfg))
                            if _loop_state.get("auto_apply_and_test", True)
                            else None
                        ),
                        restart_new_arch_callback=(
                            (lambda cfg, cid: _stop_and_restart_new_architecture_training(cfg, cid))
                            if _loop_state.get("auto_apply_and_test", True)
                            else None
                        ),
                    )
            except Exception as exc:
                print(f"[progressive_evolution_loop] Daemon tick error: {exc}")

    threading.Thread(target=_daemon, daemon=True).start()


_init_and_start_recursive_loop_daemon()



@app.get("/api/ai/feedback")
def get_training_feedback(
    provider: Optional[str] = None,
    refresh_telemetry: bool = False,
) -> Dict[str, Any]:
    cached = load_cached_ai_feedback(provider=provider)
    if cached and not refresh_telemetry:
        return {
            **cached,
            "providers": AI_PROVIDERS,
        }
    telemetry = gather_training_telemetry(_training_state, DEVICE)
    if cached:
        cached["telemetry"] = telemetry
        return {
            **cached,
            "providers": AI_PROVIDERS,
        }
    prov_key = provider if provider in AI_PROVIDERS else "opencode_argon"
    return {
        "success": True,
        "provider": prov_key,
        "provider_label": AI_PROVIDERS[prov_key]["label"],
        "model": AI_PROVIDERS[prov_key]["model"],
        "generated_at": None,
        "latency_sec": 0.0,
        "feedback": None,
        "telemetry": telemetry,
        "providers": AI_PROVIDERS,
    }


@app.post("/api/ai/feedback")
def run_training_feedback(req: FeedbackRequest) -> Dict[str, Any]:
    res = generate_ai_training_feedback(
        training_state=_training_state,
        device=DEVICE,
        provider=req.provider,
        model_file=req.model_file,
    )
    return {
        **res,
        "providers": AI_PROVIDERS,
    }


@app.post("/api/ai/vault/regenerate")
def trigger_vault_regeneration(force: bool = False) -> Dict[str, Any]:
    """Manually triggers a full re-evaluation, chart generation, and canvas rebuild."""
    try:
        from coc_rl.vault_generator import rebuild_entire_vault
        res = rebuild_entire_vault(force_eval=force)
        return {"success": True, "result": res}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/ai/vault/status")
def get_vault_status() -> Dict[str, Any]:
    """Returns the current registry status of models and canvas."""
    try:
        from coc_rl.vault_generator import load_registry, CANVAS_FILE
        reg = load_registry()
        return {
            "canvas_exists": os.path.exists(CANVAS_FILE),
            "canvas_path": CANVAS_FILE,
            "models_count": len(reg.get("models", {})),
            "models": list(reg.get("models", {}).keys()),
            "updated_at": reg.get("updated_at"),
        }
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
