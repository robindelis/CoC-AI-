#!/usr/bin/env python3
"""
FastAPI AI Training & Inference Server for Clash of Clans TH18 AI Studio.
Manages the Attacker AI (`CoCActorCritic`), `trained_models/` checkpoint library, and live rollout testing.
"""

import json
import os
import sys
import threading
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
    CoCAttackerEnv,
    compress_training_history,
    decompress_training_history,
    ensure_architecture_diagrams,
    gather_training_telemetry,
    generate_ai_training_feedback,
    get_compressed_history_meta,
    load_cached_ai_feedback,
)
from train_ai import (
    ARMY_SHORT_NAMES,
    DEFAULT_CKPT_PATH,
    VILLAGE_SHORT_NAMES,
    army_name_to_slug,
    compute_matchup_stats,
    delete_custom_army,
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

_LAST_STATE_PATH = os.path.join(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
    "trained_models",
    "last_training_state.json",
)

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


_ARCH_MANIFEST_CACHE: Tuple[float, Dict[str, Any]] = (0.0, {})


def _get_fresh_architecture_manifest(force: bool = False) -> Dict[str, Any]:
    global _ARCH_MANIFEST_CACHE
    import importlib
    import coc_rl.networks as _net_mod

    net_file = getattr(_net_mod, "__file__", "")
    mtime = os.path.getmtime(net_file) if net_file and os.path.exists(net_file) else 0.0
    if not force and _ARCH_MANIFEST_CACHE[1] and _ARCH_MANIFEST_CACHE[0] == mtime:
        return _ARCH_MANIFEST_CACHE[1]

    importlib.reload(_net_mod)
    fresh_model = _net_mod.CoCActorCritic()
    manifest = ensure_architecture_diagrams(fresh_model, force=force)
    _ARCH_MANIFEST_CACHE = (mtime, manifest)
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

    threading.Thread(target=_worker, daemon=True).start()
    return {"started": True, "training": _training_state}


@app.post("/api/ai/train/stop")
def stop_ppo_training() -> Dict[str, Any]:
    _training_state["stop_requested"] = True
    return {"stopping": True, "training": _training_state}



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
