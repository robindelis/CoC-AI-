#!/usr/bin/env python3
"""
FastAPI AI Training & Inference Server for Clash of Clans TH18 AI Studio.
Provides GPU PyTorch PPO training, live spatial tensor & policy heatmap inspection,
neural policy battle stepping, and Rayon multi-core defender base evolution.
"""

import json
import os
import threading
from typing import Any, Dict, List, Optional

import numpy as np
import torch
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import coc_py
from coc_rl import (
    CoCActorCritic,
    CoCAttackerEnv,
    CoCDefenderEvolution,
    ensure_architecture_diagrams,
)
from train_ai import DEFAULT_CKPT_PATH, masks_np_to_torch, train_pytorch_ppo

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

_train_lock = threading.Lock()
_training_state: Dict[str, Any] = {
    "is_training": False,
    "stop_requested": False,
    "current_episode": 0,
    "total_episodes": 0,
    "best_pct": 0,
    "best_stars": 0,
    "history": [],
}


def _load_model() -> CoCActorCritic:
    model = CoCActorCritic(in_channels=8).to(DEVICE)
    if os.path.exists(DEFAULT_CKPT_PATH):
        try:
            ckpt = torch.load(DEFAULT_CKPT_PATH, map_location=DEVICE, weights_only=False)
            if "model_state_dict" in ckpt:
                model.load_state_dict(ckpt["model_state_dict"], strict=False)
        except Exception:
            pass
    model.eval()
    return model


class InspectRequest(BaseModel):
    layout_json: Optional[str] = None
    army_json: Optional[str] = None


class TrainStartRequest(BaseModel):
    episodes: int = 20
    lr: float = 3e-4
    ticks_per_step: int = 8
    layout_json: Optional[str] = None
    army_json: Optional[str] = None


class EvolveRequest(BaseModel):
    generations: int = 3
    population_size: int = 12
    base_layout_json: Optional[str] = None


@app.get("/api/ai/status")
def get_ai_status() -> Dict[str, Any]:
    model = _load_model()
    arch_manifest = ensure_architecture_diagrams(model)
    param_count = sum(p.numel() for p in model.parameters())
    ckpt_meta: Dict[str, Any] = {}
    if os.path.exists(DEFAULT_CKPT_PATH):
        try:
            ckpt = torch.load(DEFAULT_CKPT_PATH, map_location="cpu", weights_only=False)
            ckpt_meta = {
                "episode": ckpt.get("episode", 0),
                "best_pct": ckpt.get("best_pct", 0),
                "best_stars": ckpt.get("best_stars", 0),
                "best_reward": round(float(ckpt.get("best_reward", 0.0)), 3),
            }
        except Exception:
            pass

    return {
        "online": True,
        "device": str(DEVICE),
        "device_name": DEVICE_NAME,
        "param_count": param_count,
        "architecture_hash": arch_manifest.get("architecture_hash"),
        "architecture_files": arch_manifest.get("files"),
        "checkpoint": ckpt_meta,
        "training": _training_state,
    }


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
    model = _load_model()

    obs_t = torch.as_tensor(obs_np, dtype=torch.float32, device=DEVICE).unsqueeze(0)
    masks_t = masks_np_to_torch(info["action_masks"], DEVICE, prevent_early_noop=True)

    with torch.no_grad():
        action_t, _, entropy_t, value_t, diag = model.get_action_and_value(
            obs_t, masks=masks_t
        )

    act = action_t.squeeze(0).cpu().tolist()
    return {
        "channels": obs_np.tolist(),
        "tile_heatmap": diag["tile_heatmap"].squeeze(0).cpu().tolist(),
        "slot_type_probs": diag["slot_type_probs"].squeeze(0).cpu().tolist(),
        "slot_idx_probs": diag["slot_idx_probs"].squeeze(0).cpu().tolist(),
        "value": round(float(value_t.item()), 4),
        "entropy": round(float(entropy_t.item()), 4),
        "suggested_action": {
            "slot_type": int(act[0]),
            "slot_idx": int(act[1]),
            "tile_x": int(act[2]),
            "tile_y": int(act[3]),
        },
    }


@app.post("/api/ai/train/start")
def start_ppo_training(req: TrainStartRequest) -> Dict[str, Any]:
    with _train_lock:
        if _training_state["is_training"]:
            return {"started": False, "reason": "Training already in progress", "training": _training_state}
        _training_state["is_training"] = True
        _training_state["stop_requested"] = False
        _training_state["current_episode"] = 0
        _training_state["total_episodes"] = req.episodes
        _training_state["history"] = []

    def _worker() -> None:
        def _on_ep(rec: Dict[str, Any]) -> bool:
            _training_state["current_episode"] = rec["episode"]
            _training_state["best_pct"] = rec["best_pct"]
            _training_state["best_stars"] = rec["best_stars"]
            _training_state["history"].append(rec)
            return not bool(_training_state["stop_requested"])

        try:
            train_pytorch_ppo(
                episodes=req.episodes,
                lr=req.lr,
                ticks_per_step=req.ticks_per_step,
                layout_json=req.layout_json,
                army_json=req.army_json,
                on_episode_callback=_on_ep,
            )
        finally:
            with _train_lock:
                _training_state["is_training"] = False
                _training_state["stop_requested"] = False

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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
