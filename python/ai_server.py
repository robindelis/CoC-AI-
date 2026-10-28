#!/usr/bin/env python3
"""
FastAPI AI Training & Inference Server for Clash of Clans TH18 AI Studio.
Manages all 3 Models + `trained_models/` checkpoint library + live rollout testing:
  1. Attacker Model 1 (`AttackerArmySelectorNet`): Village Layout (8×50×50) -> Top 3 Meta Armies
  2. Attacker Model 2 (`CoCActorCritic`): Village Layout + Full Army Context (64) -> Live Placement / NoOp
  3. Defender Model   (`DefenderVillageSelectorNet`): Incoming Army Context (64) -> Top 5 Meta Villages
"""

import json
import os
import sys
import threading
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import torch
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import coc_py
from coc_rl import (
    CoCAttackerEnv,
    CoCDefenderEvolution,
    ensure_architecture_diagrams,
)
from train_ai import (
    ARMY_SHORT_NAMES,
    DEFAULT_CKPT_PATH,
    VILLAGE_SHORT_NAMES,
    compute_selector_matrices,
    delete_custom_army,
    get_all_army_presets,
    list_custom_armies,
    list_trained_models,
    load_all_models,
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
    "training_mode": "live_attacker",
    "matchup_mode": "random",
    "resume_from": "latest_attacker.pt",
    "saved_filename": "latest_attacker.pt",
    "active_model": "live_attacker",
    "current_episode": 0,
    "cumulative_episode": 0,
    "total_episodes": 0,
    "best_pct": 0,
    "best_stars": 0,
    "co_evolve_defender": False,
    "defender_gen": 0,
    "defender_fitness": 0.0,
    "evolved_layout": None,
    "selector_matrices": None,
    "history": [],
}

if os.path.exists(_LAST_STATE_PATH):
    try:
        with open(_LAST_STATE_PATH, "r", encoding="utf-8") as _f:
            _saved_st = json.load(_f)
        if isinstance(_saved_st, dict):
            _training_state.update(_saved_st)
            _training_state["is_training"] = False
            _training_state["stop_requested"] = False
    except Exception:
        pass



class InspectRequest(BaseModel):
    layout_json: Optional[str] = None
    army_json: Optional[str] = None
    model_file: Optional[str] = "latest_attacker.pt"


class RolloutRequest(BaseModel):
    model_file: Optional[str] = "latest_attacker.pt"
    layout_json: str
    army_json: str
    ticks_per_step: int = 8
    deterministic: bool = False


class TrainStartRequest(BaseModel):
    episodes: int = 24
    batch_episodes: int = 4
    minibatch_size: int = 64
    ppo_epochs: int = 4
    lr: float = 3e-4
    ticks_per_step: int = 8
    training_mode: str = "live_attacker"
    matchup_mode: str = "random"
    resume_from: Optional[str] = "latest_attacker.pt"
    save_name: Optional[str] = None
    co_evolve_defender: bool = False
    layout_json: Optional[str] = None
    army_json: Optional[str] = None
    armies_json: Optional[str] = None
    villages_json: Optional[str] = None


class RenameModelRequest(BaseModel):
    old_filename: str
    new_filename: str


class EvolveRequest(BaseModel):
    generations: int = 3
    population_size: int = 12
    base_layout_json: Optional[str] = None


@app.get("/api/ai/status")
def get_ai_status() -> Dict[str, Any]:
    live_attacker, army_selector, defender_selector, ckpt = load_all_models(DEVICE)
    arch_manifest = ensure_architecture_diagrams(live_attacker)
    live_params = sum(p.numel() for p in live_attacker.parameters())
    army_sel_params = sum(p.numel() for p in army_selector.parameters())
    def_sel_params = sum(p.numel() for p in defender_selector.parameters())

    ckpt_meta: Dict[str, Any] = {}
    if ckpt:
        ckpt_meta = {
            "episode": ckpt.get("episode", 0),
            "best_pct": ckpt.get("best_pct", 0),
            "best_stars": ckpt.get("best_stars", 0),
            "best_reward": round(float(ckpt.get("best_reward", 0.0)), 3),
        }

    if _training_state["selector_matrices"] is None:
        _training_state["selector_matrices"] = compute_selector_matrices(
            army_selector,
            defender_selector,
            DEVICE,
            history=_training_state["history"],
        )

    return {
        "online": True,
        "device": str(DEVICE),
        "device_name": DEVICE_NAME,
        "param_count": live_params + army_sel_params + def_sel_params,
        "models_info": {
            "attacker_selector": {
                "name": "Attacker 1: Army Selector (8×50×50 → 3 Armies)",
                "params": army_sel_params,
            },
            "live_attacker": {
                "name": "Attacker 2: Live Controller (CNN+64d → 7×10×5×50×50)",
                "params": live_params,
            },
            "defender_selector": {
                "name": "Defender: Village Selector (64d Army → 5 Villages)",
                "params": def_sel_params,
            },
        },
        "saved_models": list_trained_models(),
        "architecture_hash": arch_manifest.get("architecture_hash"),
        "architecture_files": arch_manifest.get("files"),
        "checkpoint": ckpt_meta,
        "training": _training_state,
    }


@app.get("/api/ai/models")
def get_saved_models() -> Dict[str, Any]:
    return {"models": list_trained_models()}


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
def get_architecture_svg(detail: str = "overview") -> FileResponse:
    manifest = ensure_architecture_diagrams()
    key = "detailed" if detail == "detailed" else "overview"
    rel_path = manifest["files"][key]["svg"]
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    return FileResponse(os.path.join(repo_root, rel_path), media_type="image/svg+xml")


@app.post("/api/ai/inspect")
def inspect_policy_and_tensors(req: InspectRequest) -> Dict[str, Any]:
    env = CoCAttackerEnv(
        layout_json=req.layout_json,
        army_json=req.army_json,
        ticks_per_step=5,
    )
    obs_np, info = env.reset()
    live_attacker, army_selector, defender_selector, atk_ckpt = load_all_models(
        DEVICE, attacker_model_file=req.model_file
    )
    live_attacker.eval()
    army_selector.eval()
    defender_selector.eval()

    obs_t = torch.as_tensor(obs_np, dtype=torch.float32, device=DEVICE).unsqueeze(0)
    army_ctx_t = torch.as_tensor(
        info["army_context"], dtype=torch.float32, device=DEVICE
    ).unsqueeze(0)
    masks_t = masks_np_to_torch(info["action_masks"], DEVICE, prevent_early_noop=False)

    with torch.no_grad():
        action_t, _, entropy_t, value_t, diag = live_attacker.get_action_and_value(
            obs_t, masks=masks_t, army_context=army_ctx_t
        )
        chosen_army_t, _, _, army_val_t, army_probs_t = army_selector.get_action_and_value(
            obs_t, deterministic=True
        )
        chosen_vil_t, _, _, def_val_t, vil_probs_t = defender_selector.get_action_and_value(
            army_ctx_t, deterministic=True
        )

    act = action_t.squeeze(0).cpu().tolist()
    army_idx = int(chosen_army_t.item())
    vil_idx = int(chosen_vil_t.item())

    fraction_bins = (0.0, 0.25, 0.50, 0.75, 1.00)
    frac_bin = int(act[4]) if len(act) >= 5 else 4
    deploy_fraction = fraction_bins[max(0, min(len(fraction_bins) - 1, frac_bin))]

    model_armies = atk_ckpt.get("armies", [])
    model_villages = atk_ckpt.get("villages", [])

    return {
        "channels": obs_np.tolist(),
        "tile_heatmap": diag["tile_heatmap"].squeeze(0).cpu().tolist(),
        "slot_type_probs": diag["slot_type_probs"].squeeze(0).cpu().tolist(),
        "slot_idx_probs": diag["slot_idx_probs"].squeeze(0).cpu().tolist(),
        "deploy_fraction_probs": (
            diag["deploy_fraction_probs"].squeeze(0).cpu().tolist()
            if "deploy_fraction_probs" in diag
            else [0.1, 0.15, 0.25, 0.2, 0.3]
        ),
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
            "filename": req.model_file or "latest_attacker.pt",
            "episode": int(atk_ckpt.get("episode", 0)),
            "best_pct": int(atk_ckpt.get("best_pct", 0)),
            "best_stars": int(atk_ckpt.get("best_stars", 0)),
            "best_reward": round(float(atk_ckpt.get("best_reward", 0.0)), 2),
            "hyperparams": atk_ckpt.get("hyperparams", {}),
            "armies": model_armies,
            "villages": model_villages,
            "army_names": [a.get("name") for a in model_armies if isinstance(a, dict)],
            "village_names": [v.get("name") for v in model_villages if isinstance(v, dict)],
        },
        "attacker_selector": {
            "recommended_army_idx": army_idx,
            "recommended_army_name": (
                model_armies[army_idx]["name"]
                if army_idx < len(model_armies) and isinstance(model_armies[army_idx], dict) and "name" in model_armies[army_idx]
                else ARMY_SHORT_NAMES[army_idx % len(ARMY_SHORT_NAMES)]
            ),
            "army_probs": [round(float(x), 4) for x in army_probs_t.squeeze(0).cpu().tolist()],
            "value": round(float(army_val_t.item()), 3),
        },
        "defender_selector": {
            "recommended_village_idx": vil_idx,
            "recommended_village_name": (
                model_villages[vil_idx]["name"]
                if vil_idx < len(model_villages) and isinstance(model_villages[vil_idx], dict) and "name" in model_villages[vil_idx]
                else VILLAGE_SHORT_NAMES[vil_idx % len(VILLAGE_SHORT_NAMES)]
            ),
            "village_probs": [round(float(x), 4) for x in vil_probs_t.squeeze(0).cpu().tolist()],
            "value": round(float(def_val_t.item()), 3),
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
        _training_state["training_mode"] = req.training_mode
        _training_state["matchup_mode"] = req.matchup_mode
        _training_state["resume_from"] = req.resume_from or "scratch"
        _training_state["active_model"] = (
            "live_attacker" if req.training_mode == "cycle" else req.training_mode
        )
        _training_state["current_episode"] = 0
        _training_state["total_episodes"] = req.episodes
        _training_state["co_evolve_defender"] = req.co_evolve_defender
        _training_state["defender_gen"] = 0
        _training_state["defender_fitness"] = 0.0
        _training_state["evolved_layout"] = None
        _training_state["history"] = []

    def _worker() -> None:
        def _on_ep(rec: Dict[str, Any]) -> bool:
            ep_copy = dict(rec)
            evolved = ep_copy.pop("evolved_layout", None)
            _training_state["current_episode"] = ep_copy["episode"]
            _training_state["cumulative_episode"] = ep_copy.get(
                "cumulative_episode", ep_copy["episode"]
            )
            _training_state["active_model"] = ep_copy.get("active_model", "live_attacker")
            _training_state["best_pct"] = ep_copy["best_pct"]
            _training_state["best_stars"] = ep_copy["best_stars"]
            _training_state["defender_gen"] = ep_copy.get("defender_gen", 0)
            _training_state["defender_fitness"] = ep_copy.get("defender_fitness", 0.0)
            if evolved is not None:
                _training_state["evolved_layout"] = evolved
            _training_state["history"].append(ep_copy)

            if ep_copy["episode"] % 2 == 0 or ep_copy["episode"] == ep_copy["total_episodes"]:
                try:
                    _, army_sel, def_sel, _ = load_all_models(DEVICE)
                    _training_state["selector_matrices"] = compute_selector_matrices(
                        army_sel, def_sel, DEVICE, history=_training_state["history"]
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
                training_mode=req.training_mode,
                matchup_mode=req.matchup_mode,
                resume_from=req.resume_from,
                save_name=req.save_name,
                co_evolve_defender=req.co_evolve_defender,
                layout_json=req.layout_json,
                army_json=req.army_json,
                armies_json=req.armies_json,
                villages_json=req.villages_json,
                on_episode_callback=_on_ep,
            )
            if "selector_matrices" in res:
                _training_state["selector_matrices"] = res["selector_matrices"]
            if "saved_filename" in res:
                _training_state["saved_filename"] = res["saved_filename"]
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
                    with open(_LAST_STATE_PATH, "w", encoding="utf-8") as _f:
                        json.dump(_training_state, _f)
                except Exception:
                    pass

    threading.Thread(target=_worker, daemon=True).start()
    return {"started": True, "training": _training_state}


@app.post("/api/ai/train/stop")
def stop_ppo_training() -> Dict[str, Any]:
    _training_state["stop_requested"] = True
    return {"stopping": True, "training": _training_state}


@app.post("/api/ai/evolve")
def evolve_defender_base(req: EvolveRequest) -> Dict[str, Any]:
    base_layout = json.loads(req.base_layout_json) if req.base_layout_json else None
    evolver = CoCDefenderEvolution(base_layout=base_layout)
    pop_size = max(4, min(32, req.population_size))
    population = [evolver.base_layout] + [
        evolver.mutate_layout(evolver.base_layout, num_swaps=6) for _ in range(pop_size - 1)
    ]
    generations_log: List[Dict[str, Any]] = []
    for gen in range(1, max(1, min(15, req.generations)) + 1):
        population, ranked_scores = evolver.evolve_generation(population, elite_k=4)
        best_pct, best_stars, best_fitness = ranked_scores[0]
        generations_log.append(
            {
                "generation": gen,
                "best_attacker_pct": int(best_pct),
                "best_attacker_stars": int(best_stars),
                "defense_fitness": round(float(best_fitness), 2),
            }
        )
    best_layout = population[0]
    validation = json.loads(coc_py.validate_layout_json(json.dumps(best_layout)))
    return {
        "best_layout": best_layout,
        "generations": generations_log,
        "validation": validation,
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
