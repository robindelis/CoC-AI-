"""
AI Training Telemetry Collector & Local LLM Diagnostic Feedback Engine
for the Clash of Clans TH18 Deep RL Trainer.

Supports two local AI backends:
  1. `opencode_argon`: OpenCode CLI (`google-vertex/gemini-4-argon#medium`)
  2. `agy_flash`:      AGY CLI (`gemini-3.8-flash-medium`)
"""

import json
import math
import os
import re
import shutil
import subprocess
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import torch

from .envs import CoCAttackerEnv

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
LAST_FEEDBACK_PATH = os.path.join(REPO_ROOT, "trained_models", "last_ai_feedback.json")

AI_PROVIDERS: Dict[str, Dict[str, str]] = {
    "opencode_argon": {
        "id": "opencode_argon",
        "label": "Argon 4 • OpenCode",
        "model": "google-vertex/gemini-4-argon#medium",
        "cli": "opencode",
    },
    "agy_flash": {
        "id": "agy_flash",
        "label": "Flash 3.8 • AGY",
        "model": "gemini-3.8-flash-medium",
        "cli": "agy",
    },
}


def _linear_slope_per_100(values: List[float]) -> float:
    n = len(values)
    if n < 3:
        return 0.0
    x = np.arange(n, dtype=np.float64)
    y = np.asarray(values, dtype=np.float64)
    x_mean = x.mean()
    denom = float(np.sum((x - x_mean) ** 2))
    if denom < 1e-9:
        return 0.0
    slope = float(np.sum((x - x_mean) * (y - y.mean())) / denom)
    return round(slope * 100.0, 3)


def _summarize_slice(records: List[Dict[str, Any]], label: str) -> Dict[str, Any]:
    if not records:
        return {"window": label, "episodes": 0}
    n = len(records)
    pcts = [float(r.get("destruction_pct", 0.0)) for r in records]
    stars = [int(r.get("stars", 0)) for r in records]
    rews = [float(r.get("reward", 0.0)) for r in records]
    noops = [float(r.get("noop_pct", 0.0)) for r in records]
    steps = [float(r.get("steps", 0.0)) for r in records]
    deploys = [float(r.get("deploy_steps", 0.0)) for r in records]
    spells = [float(r.get("spell_steps", 0.0)) for r in records]
    abilities = [float(r.get("ability_steps", 0.0)) for r in records]
    ploss = [float(r.get("policy_loss", 0.0)) for r in records]
    vloss = [float(r.get("value_loss", 0.0)) for r in records]
    ents = [float(r.get("entropy", 0.0)) for r in records]
    kls = [float(r.get("approx_kl", 0.0)) for r in records]
    clips = [float(r.get("clip_fraction", 0.0)) for r in records if "clip_fraction" in r]
    gnorms = [float(r.get("grad_norm", 0.0)) for r in records if "grad_norm" in r]
    expvars = [float(r.get("explained_variance", 0.0)) for r in records if "explained_variance" in r]

    s0 = round(100.0 * sum(1 for s in stars if s == 0) / n, 1)
    s1 = round(100.0 * sum(1 for s in stars if s >= 1) / n, 1)
    s2 = round(100.0 * sum(1 for s in stars if s >= 2) / n, 1)
    s3 = round(100.0 * sum(1 for s in stars if s >= 3) / n, 1)

    out: Dict[str, Any] = {
        "window": label,
        "ep_start": int(records[0].get("episode", 1)),
        "ep_end": int(records[-1].get("episode", n)),
        "episodes": n,
        "mean_pct": round(float(np.mean(pcts)), 2),
        "std_pct": round(float(np.std(pcts)), 2),
        "min_pct": int(min(pcts)),
        "max_pct": int(max(pcts)),
        "mean_stars": round(float(np.mean(stars)), 2),
        "zero_star_rate_pct": s0,
        "one_plus_star_rate_pct": s1,
        "two_plus_star_th_rate_pct": s2,
        "three_star_triple_rate_pct": s3,
        "mean_reward": round(float(np.mean(rews)), 2),
        "mean_noop_pct": round(float(np.mean(noops)), 2),
        "mean_steps": round(float(np.mean(steps)), 1),
        "mean_deploy_steps": round(float(np.mean(deploys)), 1),
        "mean_spell_steps": round(float(np.mean(spells)), 1),
        "mean_ability_steps": round(float(np.mean(abilities)), 1),
        "mean_policy_loss": round(float(np.mean(ploss)), 4),
        "mean_value_loss": round(float(np.mean(vloss)), 3),
        "mean_entropy": round(float(np.mean(ents)), 3),
        "mean_approx_kl": round(float(np.mean(kls)), 4),
    }
    if clips:
        out["mean_clip_fraction"] = round(float(np.mean(clips)), 4)
    if gnorms:
        out["mean_grad_norm"] = round(float(np.mean(gnorms)), 4)
    if expvars:
        out["mean_explained_variance"] = round(float(np.mean(expvars)), 4)
    return out


def probe_live_model_diagnostics(
    device: torch.device,
    model_file: Optional[str] = None,
    empirical_recent_return: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Runs a live forward-pass and 1-episode rollout probe on the current `CoCActorCritic`
    model to decompose factorized head entropies, check critic calibration V(s0),
    inspect parameter weight norms, and measure spatial deployment dispersion & action timing.
    """
    from train_ai import get_meta_presets, load_attacker_model, masks_np_to_torch

    t0 = time.perf_counter()
    live_attacker, ckpt_meta = load_attacker_model(
        device, attacker_model_file=model_file or "latest_attacker.pt"
    )
    live_attacker.eval()

    # 1. Module weight L2 norms & NaN check
    module_norms: Dict[str, float] = {}
    has_nan_or_inf = False
    for name, mod in (
        ("spatial_stem", live_attacker.encoder.spatial_stem),
        ("context_res", live_attacker.encoder.context_res),
        ("global_tower", live_attacker.encoder.global_tower),
        ("army_context_proj", live_attacker.army_context_proj),
        ("slot_type_head", live_attacker.slot_type_head),
        ("slot_idx_head", live_attacker.slot_idx_head),
        ("deploy_fraction_head", live_attacker.deploy_fraction_head),
        ("tile_conv_head", live_attacker.tile_conv_head),
        ("critic_head", live_attacker.critic_head),
    ):
        if mod is None:
            continue
        sq = 0.0
        for p in mod.parameters():
            if torch.isnan(p).any() or torch.isinf(p).any():
                has_nan_or_inf = True
            sq += float(p.detach().float().norm(2).item() ** 2)
        module_norms[name] = round(math.sqrt(sq), 3)

    # 2. Live rollout probe on default layout & army
    layouts, armies = get_meta_presets()
    if ckpt_meta.get("villages"):
        layouts = ckpt_meta["villages"]
    if ckpt_meta.get("armies"):
        armies = ckpt_meta["armies"]

    env = CoCAttackerEnv(
        layout_json=json.dumps(layouts[0]),
        army_json=json.dumps(armies[0]),
        ticks_per_step=8,
    )
    obs_np, info = env.reset()
    valid_green_count = int(np.sum(info["action_masks"]["tile"]))
    max_tile_ent = math.log(max(2, valid_green_count))
    max_type_ent = math.log(7.0)
    max_idx_ent = math.log(10.0)
    max_frac_ent = math.log(5.0)

    def _ent(probs: torch.Tensor) -> float:
        p = probs.clamp(min=1e-12)
        return float(-(p * p.log()).sum().item())

    h_types: List[float] = []
    max_types: List[float] = []
    h_idxs: List[float] = []
    max_idxs: List[float] = []
    h_fracs: List[float] = []
    h_tiles: List[float] = []
    max_tiles: List[float] = []
    top5_tile_masses: List[float] = []
    values_pred: List[float] = []
    tile_coords: List[Tuple[int, int]] = []
    troop_ticks: List[int] = []
    spell_ticks: List[int] = []
    ability_ticks: List[int] = []
    init_type_probs: List[float] = []
    init_frac_probs: List[float] = []

    for step_i in range(120):
        obs_t = torch.as_tensor(obs_np, dtype=torch.float32, device=device).unsqueeze(0)
        ctx_t = torch.as_tensor(info["army_context"], dtype=torch.float32, device=device).unsqueeze(0)
        masks_t = masks_np_to_torch(
            info["action_masks"], device, prevent_early_noop=(step_i == 0)
        )
        with torch.no_grad():
            act_t, _, _, val_t, diag = live_attacker.get_action_and_value(
                obs_t, masks=masks_t, army_context=ctx_t
            )
            tp = diag["slot_type_probs"].squeeze(0)
            ip = diag["slot_idx_probs"].squeeze(0)
            fp = diag.get("deploy_fraction_probs", torch.ones(1, 5, device=device) / 5.0).squeeze(0)
            tile_p = diag["tile_heatmap"].reshape(-1)

            if step_i == 0:
                init_type_probs = [round(float(x), 3) for x in tp.cpu().tolist()]
                init_frac_probs = [round(float(x), 3) for x in fp.cpu().tolist()]

            act_preview = act_t.squeeze(0)
            st_preview = int(act_preview[0].item())
            active_type_count = int((tp > 1e-6).sum().item())
            if active_type_count >= 2:
                h_types.append(_ent(tp))
                max_types.append(math.log(active_type_count))
            if st_preview in (1, 2, 3, 6):
                active_idx_count = int((ip > 1e-6).sum().item())
                if active_idx_count >= 2:
                    h_idxs.append(_ent(ip))
                    max_idxs.append(math.log(active_idx_count))
            if st_preview == 1:
                h_fracs.append(_ent(fp))
            if st_preview in (1, 2, 4, 6):
                active_tile_count = int((tile_p > 1e-7).sum().item())
                step_max_tile_ent = math.log(max(2, active_tile_count))
                h_tiles.append(min(step_max_tile_ent, _ent(tile_p)))
                max_tiles.append(step_max_tile_ent)
                top5_tile_masses.append(
                    float(tile_p.topk(min(5, tile_p.numel())).values.sum().item())
                )
            values_pred.append(float(val_t.item()))

        act = act_t.squeeze(0).cpu().numpy()
        st, _si, tx, ty = int(act[0]), int(act[1]), int(act[2]), int(act[3])
        tick = int(info.get("tick", step_i * 8))
        if st in (1, 2, 4):
            tile_coords.append((tx, ty))
            troop_ticks.append(tick)
        elif st == 6:
            spell_ticks.append(tick)
        elif st in (3, 5):
            ability_ticks.append(tick)

        obs_np, _, term, trunc, info = env.step(act)
        has_active = bool(
            info.get(
                "has_remaining_inventory",
                info["action_masks"]["slot_type"][1:].any(),
            )
        )
        if term or trunc or not has_active:
            if not (term or trunc):
                obs_np, _, _, info = env.finish_battle()
            break

    coords_arr = np.asarray(tile_coords, dtype=np.float32) if tile_coords else np.zeros((1, 2))
    spatial_spread_std = (
        round(float(np.mean(np.std(coords_arr, axis=0))), 2) if len(tile_coords) > 1 else 0.0
    )
    unique_tiles_ratio = (
        round(len(set(tile_coords)) / max(1, len(tile_coords)), 3) if tile_coords else 0.0
    )

    mean_h_type = round(float(np.mean(h_types)), 3) if h_types else 0.0
    eff_max_type = round(float(np.mean(max_types)), 3) if max_types else round(max_type_ent, 3)
    mean_h_idx = round(float(np.mean(h_idxs)), 3) if h_idxs else 0.0
    eff_max_idx = round(float(np.mean(max_idxs)), 3) if max_idxs else round(max_idx_ent, 3)
    mean_h_frac = round(float(np.mean(h_fracs)), 3) if h_fracs else 0.0
    mean_h_tile = round(float(np.mean(h_tiles)), 3) if h_tiles else 0.0
    eff_max_tile = round(float(np.mean(max_tiles)), 3) if max_tiles else round(max_tile_ent, 3)

    v_s0 = round(values_pred[0], 2) if values_pred else 0.0
    cal_gap = (
        round(v_s0 - float(empirical_recent_return), 2)
        if empirical_recent_return is not None
        else None
    )

    return {
        "probe_duration_ms": round((time.perf_counter() - t0) * 1000.0, 1),
        "head_entropy_breakdown": {
            "slot_type": {
                "entropy": mean_h_type,
                "max_possible": eff_max_type,
                "saturation_pct": round(100.0 * mean_h_type / max(1e-6, eff_max_type), 1),
            },
            "slot_idx": {
                "entropy": mean_h_idx,
                "max_possible": eff_max_idx,
                "saturation_pct": round(100.0 * mean_h_idx / max(1e-6, eff_max_idx), 1),
            },
            "deploy_fraction": {
                "entropy": mean_h_frac,
                "max_possible": round(max_frac_ent, 3),
                "saturation_pct": round(100.0 * mean_h_frac / max_frac_ent, 1),
            },
            "tile_xy": {
                "entropy": mean_h_tile,
                "max_possible": eff_max_tile,
                "saturation_pct": round(100.0 * mean_h_tile / max(1e-6, eff_max_tile), 1),
                "top5_tile_prob_mass_pct": round(100.0 * float(np.mean(top5_tile_masses)), 2) if top5_tile_masses else 0.0,
            },
        },
        "initial_step_probs": {
            "slot_type_probs": init_type_probs,
            "deploy_fraction_probs": init_frac_probs,
        },
        "critic_calibration": {
            "predicted_v_s0": v_s0,
            "pred_value_min": round(min(values_pred, default=0.0), 2),
            "pred_value_max": round(max(values_pred, default=0.0), 2),
            "empirical_recent50_return": (
                round(float(empirical_recent_return), 2)
                if empirical_recent_return is not None
                else None
            ),
            "calibration_gap_v0_minus_return": cal_gap,
        },
        "tactical_rollout_behavior": {
            "probe_steps_before_exhaustion": len(values_pred),
            "probe_destruction_pct": int(info.get("destruction_pct", 0)),
            "probe_stars": int(info.get("stars", 0)),
            "spatial_deploy_spread_std_tiles": spatial_spread_std,
            "unique_deploy_tiles_ratio": unique_tiles_ratio,
            "troop_deploy_tick_span": [
                int(min(troop_ticks, default=0)),
                int(max(troop_ticks, default=0)),
            ],
            "spell_cast_tick_span": [
                int(min(spell_ticks, default=0)),
                int(max(spell_ticks, default=0)),
            ],
            "hero_ability_tick_span": [
                int(min(ability_ticks, default=0)),
                int(max(ability_ticks, default=0)),
            ],
        },
        "weight_norms_l2": module_norms,
        "has_nan_or_inf_weights": has_nan_or_inf,
    }


def gather_training_telemetry(
    training_state: Dict[str, Any],
    device: torch.device,
    model_file: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Collects and distills all training history, trend slopes, plateau metrics,
    matchup matrices, live neural policy diagnostics, and deterministic anomaly flags.
    """
    history: List[Dict[str, Any]] = list(training_state.get("history") or [])
    n = len(history)
    active_ckpt_file = (
        model_file
        or training_state.get("saved_filename")
        or training_state.get("resume_from")
        or "latest_attacker.pt"
    )

    from train_ai import resolve_model_path

    ckpt_hyperparams: Dict[str, Any] = {}
    resolved = resolve_model_path(active_ckpt_file)
    if resolved and os.path.exists(resolved):
        try:
            ckpt_obj = torch.load(resolved, map_location="cpu", weights_only=False)
            if isinstance(ckpt_obj.get("hyperparams"), dict):
                ckpt_hyperparams = ckpt_obj["hyperparams"]
        except Exception:
            pass

    # 1. Chronological Phases (up to 5 quintiles)
    phases: List[Dict[str, Any]] = []
    if n > 0:
        num_phases = min(5, max(1, n // 10 if n >= 20 else 1))
        for p_idx in range(num_phases):
            s_i = int(p_idx * n / num_phases)
            e_i = int((p_idx + 1) * n / num_phases)
            slice_recs = history[s_i:e_i]
            if slice_recs:
                phases.append(_summarize_slice(slice_recs, f"Phase {p_idx + 1}/{num_phases}"))

    # 2. Rolling Window Comparisons
    windows: Dict[str, Any] = {}
    if n > 0:
        windows["first_50"] = _summarize_slice(history[: min(50, n)], "First 50 Eps")
        if n > 100:
            windows["prev_100"] = _summarize_slice(
                history[max(0, n - 150) : max(1, n - 50)], "Prev 100 Eps (-150..-50)"
            )
        windows["recent_50"] = _summarize_slice(history[-min(50, n) :], "Recent 50 Eps")
        windows["recent_10"] = _summarize_slice(history[-min(10, n) :], "Recent 10 Eps")

    # 3. Slopes & Plateau Diagnostics
    trends: Dict[str, Any] = {}
    if n >= 5:
        all_pcts = [float(r.get("destruction_pct", 0.0)) for r in history]
        all_rews = [float(r.get("reward", 0.0)) for r in history]
        all_ents = [float(r.get("entropy", 0.0)) for r in history]
        all_vloss = [float(r.get("value_loss", 0.0)) for r in history]
        all_noops = [float(r.get("noop_pct", 0.0)) for r in history]

        rec_window_len = max(10, min(300, n // 4))
        rec_slice = history[-rec_window_len:]

        # Rolling 50 peak detection
        rolling50 = [
            float(r.get("avg_pct_50") or r.get("destruction_pct", 0.0)) for r in history
        ]
        peak_r50_val = round(float(max(rolling50)), 2)
        peak_r50_idx = int(np.argmax(rolling50))
        eps_since_r50_peak = (n - 1) - peak_r50_idx

        best_pct_val = int(max(all_pcts))
        best_pct_first_idx = next(
            (i for i, v in enumerate(all_pcts) if int(v) >= best_pct_val), 0
        )
        eps_since_best_pct = (n - 1) - best_pct_first_idx

        trends = {
            "full_run_pct_slope_per_100ep": _linear_slope_per_100(all_pcts),
            "recent_window_episodes": rec_window_len,
            "recent_pct_slope_per_100ep": _linear_slope_per_100(
                [float(r.get("destruction_pct", 0.0)) for r in rec_slice]
            ),
            "recent_reward_slope_per_100ep": _linear_slope_per_100(
                [float(r.get("reward", 0.0)) for r in rec_slice]
            ),
            "recent_entropy_slope_per_100ep": _linear_slope_per_100(
                [float(r.get("entropy", 0.0)) for r in rec_slice]
            ),
            "recent_value_loss_slope_per_100ep": _linear_slope_per_100(
                [float(r.get("value_loss", 0.0)) for r in rec_slice]
            ),
            "recent_noop_slope_per_100ep": _linear_slope_per_100(
                [float(r.get("noop_pct", 0.0)) for r in rec_slice]
            ),
            "rolling50_peak_pct": peak_r50_val,
            "rolling50_peak_at_episode": int(history[peak_r50_idx].get("episode", peak_r50_idx + 1)),
            "episodes_since_rolling50_peak": eps_since_r50_peak,
            "current_rolling50_pct": round(rolling50[-1], 2),
            "drawdown_from_rolling50_peak_pct": round(rolling50[-1] - peak_r50_val, 2),
            "best_single_ep_pct": best_pct_val,
            "best_pct_first_at_episode": int(
                history[best_pct_first_idx].get("episode", best_pct_first_idx + 1)
            ),
            "episodes_since_best_pct": eps_since_best_pct,
        }

    # 4. Live Model Probe
    recent50_mean_rew = (
        windows.get("recent_50", {}).get("mean_reward") if "recent_50" in windows else None
    )
    live_probe = probe_live_model_diagnostics(
        device=device,
        model_file=active_ckpt_file,
        empirical_recent_return=recent50_mean_rew,
    )

    # 5. Matchup Breakdown
    matchup_stats = training_state.get("matchup_stats") or {}
    army_stats = matchup_stats.get("army_stats", [])
    village_stats = matchup_stats.get("village_stats", [])

    # 6. Automated Quantitative Signals (Grounded evidence for both UI and LLM)
    signals: List[Dict[str, str]] = []
    rec50 = windows.get("recent_50", {})
    hb = live_probe.get("head_entropy_breakdown", {})
    tact = live_probe.get("tactical_rollout_behavior", {})

    if n >= 100 and abs(trends.get("recent_pct_slope_per_100ep", 0.0)) < 0.35 and trends.get("episodes_since_rolling50_peak", 0) > 150:
        signals.append({
            "id": "destruction_plateau",
            "severity": "warning",
            "metric": f"Slope {trends.get('recent_pct_slope_per_100ep', 0):+.2f}%/100ep • Peak {trends.get('rolling50_peak_pct')}% at Ep {trends.get('rolling50_peak_at_episode')}",
            "detail": (
                f"50-episode rolling destruction peaked {trends.get('episodes_since_rolling50_peak')} episodes ago "
                f"({trends.get('rolling50_peak_pct')}% vs current {trends.get('current_rolling50_pct')}%)."
            ),
        })

    if rec50 and rec50.get("mean_noop_pct", 50.0) < 3.0 and rec50.get("mean_steps", 100.0) < 48.0:
        ab_span = tact.get("hero_ability_tick_span", [0, 0])
        sp_span = tact.get("spell_cast_tick_span", [0, 0])
        signals.append({
            "id": "action_dump_zero_noop",
            "severity": "critical",
            "metric": f"NoOp {rec50.get('mean_noop_pct')}% • Mean Steps {rec50.get('mean_steps')} • Abilities t={ab_span[0]}..{ab_span[1]}",
            "detail": (
                "Policy has collapsed NoOp (Wait) to ~0%, dumping all troops, spells, and hero abilities in the "
                "first ~30s of battle (due to +0.035 step action bonus / -0.04 NoOp penalty and immediate finish_battle() "
                "reward realization) instead of timing spells and abilities when units reach core defenses."
            ),
        })

    tile_sat = hb.get("tile_xy", {}).get("saturation_pct", 0.0)
    type_sat = hb.get("slot_type", {}).get("saturation_pct", 100.0)
    idx_sat = hb.get("slot_idx", {}).get("saturation_pct", 100.0)
    if tile_sat > 82.0 and (type_sat < 35.0 or idx_sat < 25.0):
        signals.append({
            "id": "head_entropy_imbalance",
            "severity": "critical",
            "metric": f"H(tile)={tile_sat}% max vs H(type)={type_sat}% • H(idx)={idx_sat}% • Spread σ={tact.get('spatial_deploy_spread_std_tiles')}t",
            "detail": (
                "Single shared ent_coef across summed head entropies allows the 2500-tile spatial pointer head to stay "
                "near-uniform (scattering units across the perimeter) while discrete heads (slot_type, slot_idx, deploy_fraction) "
                "collapse to near-deterministic distributions."
            ),
        })

    if rec50 and rec50.get("three_star_triple_rate_pct", 0.0) == 0.0 and rec50.get("two_plus_star_th_rate_pct", 100.0) < 20.0:
        signals.append({
            "id": "low_th_takedown_rate",
            "severity": "warning",
            "metric": f"2★+ (TH Takedown) {rec50.get('two_plus_star_th_rate_pct')}% • 3★ Rate {rec50.get('three_star_triple_rate_pct')}%",
            "detail": (
                "Policy reliably clears perimeter trash buildings for 1★ (>50% destruction) but rarely funnels concentrated "
                "power into the Town Hall 18 core."
            ),
        })

    if len(army_stats) >= 2:
        army_pcts = [float(a.get("recent_avg_pct") or a.get("avg_pct", 0.0)) for a in army_stats]
        gap = round(max(army_pcts) - min(army_pcts), 1)
        if gap >= 8.0:
            best_a = max(army_stats, key=lambda a: float(a.get("recent_avg_pct") or a.get("avg_pct", 0.0)))
            worst_a = min(army_stats, key=lambda a: float(a.get("recent_avg_pct") or a.get("avg_pct", 0.0)))
            signals.append({
                "id": "cross_army_interference",
                "severity": "info",
                "metric": f"{best_a.get('name')} ({best_a.get('recent_avg_pct')}%) vs {worst_a.get('name')} ({worst_a.get('recent_avg_pct')}%)",
                "detail": (
                    f"{gap}% destruction gap across meta armies indicates multi-army policy interference between "
                    "ground smash and air/spell strategies."
                ),
            })

    return {
        "collected_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "session": {
            "is_training": bool(training_state.get("is_training", False)),
            "matchup_mode": training_state.get("matchup_mode", "random"),
            "active_checkpoint": active_ckpt_file,
            "current_episode": int(training_state.get("current_episode", n)),
            "cumulative_episode": int(training_state.get("cumulative_episode", n)),
            "total_episodes": int(training_state.get("total_episodes", n)),
            "history_length": n,
            "best_pct": int(training_state.get("best_pct", 0)),
            "best_stars": int(training_state.get("best_stars", 0)),
            "hyperparams": ckpt_hyperparams or {
                "lr": 3e-4,
                "batch_episodes": 4,
                "minibatch_size": 64,
                "ppo_epochs": 4,
                "ticks_per_step": 8,
                "clip_coef": 0.2,
                "ent_coef": 0.015,
                "vf_coef": 0.5,
                "target_kl": 0.03,
                "gamma": 0.99,
                "gae_lambda": 0.95,
            },
        },
        "trends": trends,
        "windows": windows,
        "phases": phases,
        "matchups": {
            "army_stats": army_stats,
            "village_stats": village_stats,
        },
        "live_model_probe": live_probe,
        "detected_signals": signals,
    }


def _build_Diagnostic_prompt(telemetry: Dict[str, Any]) -> str:
    compact_json = json.dumps(telemetry, indent=2)
    return f"""CRITICAL INSTRUCTION: Respond immediately in a single turn with ZERO tool calls (do NOT call read, grep, glob, shell, or any other tool). All required metrics and architectural context are included below. Output ONLY the raw JSON object (no markdown fences, no commentary outside the JSON).

You are an expert Deep Reinforcement Learning & PPO Diagnostics Architect analyzing a live Clash of Clans Town Hall 18 (TH18) combat RL training run (`CoCActorCritic` + PPO + GAE).

### Architecture & Environment Context
- **Observation**: `(10, 50, 50)` spatial grid (building HP, defense DPS, TH18, walls, red-zone mask, ground/air unit density, spells, allied/enemy unit types) + `64-D` army inventory context.
- **Factorized Action Space**: `MultiDiscrete([7, 10, 50, 50, 5])` -> `slot_type` (0=NoOp, 1=Troop, 2=Hero, 3=HeroAbility, 4=Siege, 5=PopSiege, 6=Spell), `slot_idx` (0..9), `tile_x` (0..49), `tile_y` (0..49), `deploy_fraction_bin` (0%, 25%, 50%, 75%, 100%).
- **Two-Phase Tactical Pacing & Reward Shaping**:
  - Calibrated 100-point scale: 35 pts for 100% destruction + 15 pts for continuous building/core HP damage + 36 pts for 3 stars (12 pts/star) + 14 pts milestone bonus for Town Hall 18 takedown + spatial funnel cohesion bonus.
  - Phase 1 (Deployment): Deploys core troop waves along the exterior cardinal funnel before deploying Siege and Heroes; avoids interior teaser killzone holes.
  - Phase 2 (Mid-Battle Spell & Ability Pacing): Unlocks spells (`tick >= 40`) and hero abilities (`tick >= 64`) with tactical cooldown spacing and `NoOp (Wait)` interleaving while units push into core defenses; excludes the Town Hall footprint from Overgrowth/Invisibility spell masks.
- **PPO Objective**:
  - Normalized per-head entropy regularization (`reg_entropy`) weights discrete heads (`slot_type`, `slot_idx`, `deploy_fraction`) separately from the 2,500-tile spatial pointer head (`tile_xy`), with FiLM-style multiplicative spatial conditioning and decoupled Critic learning rate (`2.5x` actor LR).

### Live Training Telemetry JSON
{compact_json}

### Required JSON Output Schema
Return ONLY a raw JSON object matching this exact schema:
{{
  "health_status": "progressing" | "plateaued" | "degrading" | "unstable" | "early_stage",
  "health_score": <integer 0..100>,
  "is_progressing": <boolean>,
  "headline": "<concise 1-sentence verdict on training health and progression>",
  "progression_summary": "<2-3 sentences citing exact episode numbers, destruction %, star rates, and slopes to explain whether training is progressing or plateaued>",
  "what_is_going_wrong": [
    {{
      "title": "<short diagnostic title>",
      "severity": "critical" | "warning" | "info",
      "symptom": "<exact quantitative evidence from the telemetry showing what is going wrong>",
      "root_cause": "<precise technical explanation of WHY this happens in the PPO update, reward shaping, credit assignment, or factorized head architecture>"
    }}
  ],
  "recommendations": [
    {{
      "action": "<specific code or hyperparameter fix>",
      "target": "<component or hyperparameter name, e.g. step reward shaping / per-head entropy / lr>",
      "rationale": "<how this directly resolves the root cause>"
    }}
  ]
}}"""


def _extract_json_object(raw_text: str) -> Dict[str, Any]:
    cleaned = raw_text.strip()
    # Strip markdown ```json ... ``` if present
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = cleaned[start : end + 1]
        return json.loads(candidate)
    return json.loads(cleaned)


def _call_opencode_argon(prompt: str, timeout_sec: int = 90) -> Tuple[str, str]:
    opencode_bin = "/home/robin/.opencode/bin/opencode"
    if not os.path.exists(opencode_bin):
        opencode_bin = shutil.which("opencode") or "opencode"

    work_dir = "/tmp/opencode" if os.path.isdir("/tmp/opencode") else "/tmp"
    cmd = [
        opencode_bin,
        "run",
        "-m",
        "google-vertex/gemini-4-argon#medium",
        "--format",
        "json",
        prompt,
    ]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=work_dir,
        timeout=timeout_sec,
    )
    if proc.returncode != 0 and not proc.stdout.strip():
        raise RuntimeError(
            f"opencode exited with code {proc.returncode}: {(proc.stderr or '').strip()[:400]}"
        )

    text_parts: List[str] = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line or not line.startswith("{"):
            continue
        try:
            evt = json.loads(line)
            if evt.get("type") == "text" and isinstance(evt.get("part"), dict):
                txt = evt["part"].get("text", "")
                if txt:
                    text_parts.append(txt)
        except Exception:
            continue

    combined = "".join(text_parts).strip()
    if not combined:
        combined = proc.stdout.strip()
    return combined, "google-vertex/gemini-4-argon#medium"


def _call_agy_flash(prompt: str, timeout_sec: int = 90) -> Tuple[str, str]:
    agy_bin = "/home/robin/.local/bin/agy"
    if not os.path.exists(agy_bin):
        agy_bin = shutil.which("agy") or "agy"

    work_dir = "/tmp/opencode" if os.path.isdir("/tmp/opencode") else "/tmp"
    cmd = [
        agy_bin,
        "--model",
        "gemini-3.8-flash-medium",
        "--disable-slash-commands",
        f"-p={prompt}",
    ]
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=work_dir,
        timeout=timeout_sec,
    )
    if proc.returncode != 0 and not proc.stdout.strip():
        raise RuntimeError(
            f"agy exited with code {proc.returncode}: {(proc.stderr or '').strip()[:400]}"
        )
    return proc.stdout.strip(), "gemini-3.8-flash-medium"


def generate_ai_training_feedback(
    training_state: Dict[str, Any],
    device: torch.device,
    provider: str = "opencode_argon",
    model_file: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Gathers full training telemetry, invokes the requested local AI model
    (`opencode_argon` or `agy_flash`), parses the structured diagnostic report,
    and saves a snapshot to `trained_models/last_ai_feedback.json`.
    """
    t0 = time.perf_counter()
    provider_key = provider if provider in AI_PROVIDERS else "opencode_argon"
    telemetry = gather_training_telemetry(
        training_state=training_state,
        device=device,
        model_file=model_file,
    )
    prompt = _build_Diagnostic_prompt(telemetry)

    raw_response = ""
    model_used = AI_PROVIDERS[provider_key]["model"]
    error_msg: Optional[str] = None
    parsed_feedback: Optional[Dict[str, Any]] = None

    try:
        if provider_key == "agy_flash":
            raw_response, model_used = _call_agy_flash(prompt)
        else:
            raw_response, model_used = _call_opencode_argon(prompt)
        parsed_feedback = _extract_json_object(raw_response)
    except Exception as exc:
        error_msg = str(exc)

    # Fallback synthesis if LLM returned non-JSON or encountered an error
    if not isinstance(parsed_feedback, dict) or "headline" not in parsed_feedback:
        signals = telemetry.get("detected_signals", [])
        trends = telemetry.get("trends", {})
        rec50 = telemetry.get("windows", {}).get("recent_50", {})
        slope = float(trends.get("recent_pct_slope_per_100ep", 0.0))
        is_prog = slope > 0.35
        parsed_feedback = {
            "health_status": "progressing" if is_prog else "plateaued",
            "health_score": 72 if is_prog else 44,
            "is_progressing": is_prog,
            "headline": (
                raw_response[:220]
                if raw_response and not error_msg
                else f"Training {'progressing' if is_prog else 'plateaued'} at {rec50.get('mean_pct', 0)}% mean destruction ({slope:+.2f}%/100ep)."
            ),
            "progression_summary": (
                f"Across {telemetry['session']['history_length']} episodes, recent 50-ep average destruction is "
                f"{rec50.get('mean_pct', 0)}% (peak rolling-50: {trends.get('rolling50_peak_pct', 0)}% at Ep "
                f"{trends.get('rolling50_peak_at_episode', 0)}) with {rec50.get('two_plus_star_th_rate_pct', 0)}% 2★+ rate."
            ),
            "what_is_going_wrong": [
                {
                    "title": s["id"].replace("_", " ").title(),
                    "severity": s["severity"],
                    "symptom": s["metric"],
                    "root_cause": s["detail"],
                }
                for s in signals
            ],
            "recommendations": [
                {
                    "action": "Decouple per-head entropy coefficients and remove per-step action dump bonus",
                    "target": "python/coc_rl/ppo.py & python/train_ai.py",
                    "rationale": "Prevents premature discrete head collapse and stops immediate 0%-NoOp spell/ability dumping.",
                }
            ],
        }

    elapsed_s = round(time.perf_counter() - t0, 2)
    result = {
        "success": error_msg is None,
        "error": error_msg,
        "provider": provider_key,
        "provider_label": AI_PROVIDERS[provider_key]["label"],
        "model": model_used,
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "latency_sec": elapsed_s,
        "feedback": parsed_feedback,
        "telemetry": telemetry,
    }

    try:
        os.makedirs(os.path.dirname(LAST_FEEDBACK_PATH), exist_ok=True)
        provider_cache_path = os.path.join(
            os.path.dirname(LAST_FEEDBACK_PATH),
            f"last_ai_feedback_{provider_key}.json",
        )
        with open(provider_cache_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
        with open(LAST_FEEDBACK_PATH, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2)
    except Exception:
        pass

    return result


def load_cached_ai_feedback(provider: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if provider and provider in AI_PROVIDERS:
        provider_cache_path = os.path.join(
            os.path.dirname(LAST_FEEDBACK_PATH),
            f"last_ai_feedback_{provider}.json",
        )
        if os.path.exists(provider_cache_path):
            try:
                with open(provider_cache_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
    if not os.path.exists(LAST_FEEDBACK_PATH):
        return None
    try:
        with open(LAST_FEEDBACK_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None
