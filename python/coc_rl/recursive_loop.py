"""
Recursive AI Self-Improvement Loop for Clash of Clans TH18 Deep RL.

Every 10 minutes (configurable), or on demand / after a verification burst:
  1. Analyses live training telemetry (including reward decomposition, star conversion funnel,
     village layout bottlenecks, per-head entropy trajectories, and critic/trust-region health).
  2. If a solution from the previous cycle was being tested, verifies whether the problem it
     targeted was solved (comparing Before vs After metrics), keeping successful changes or
     rolling back regressions, and logs the empirical result to the Obsidian Vault.
  3. Determines whether training is healthy/progressing or plateaued, and identifies exact
     quantitative root causes from the available stats.
  4. Proposes 3–4 concrete candidate solutions across Network Architecture (`arch_config`),
     Reward Shaping (`reward_config`), and PPO Hyperparameters (`hyperparams`).
  5. BEFORE applying any change, captures and documents a complete Pre-Change Baseline Snapshot
     (current architecture, reward formula & weights, hyperparameters, and telemetry) into
     both the loop ledger and the Obsidian Vault (`obsidian_vault/experiments/Recursive_AI_Improvement_Loop.md`).
  6. Applies the selected solution and launches/continues verification training, repeating the loop.
"""

from __future__ import annotations

import copy
import json
import os
import subprocess
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch

from .networks import CoCActorCritic, DEFAULT_ARCH_CONFIG
from .ppo import DEFAULT_HYPERPARAMS, DEFAULT_REWARD_CONFIG, format_reward_formula
from .training_feedback import (
    AI_PROVIDERS,
    _call_agy_flash,
    _call_opencode_argon,
    _extract_json_object,
    gather_training_telemetry,
)

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
TRAINED_MODELS_DIR = os.path.join(REPO_ROOT, "trained_models")
VAULT_DIR = os.path.join(REPO_ROOT, "obsidian_vault")
EXPERIMENTS_DIR = os.path.join(VAULT_DIR, "experiments")
DECISIONS_DIR = os.path.join(VAULT_DIR, "decisions")
CHARTS_DIR = os.path.join(VAULT_DIR, "assets", "charts")

ACTIVE_CONFIG_PATH = os.path.join(TRAINED_MODELS_DIR, "active_experiment_config.json")
LOOP_STATE_PATH = os.path.join(TRAINED_MODELS_DIR, "recursive_improvement_loop.json")
VAULT_LOOP_NOTE_PATH = os.path.join(EXPERIMENTS_DIR, "Recursive_AI_Improvement_Loop.md")
VAULT_LOOP_CHART_PATH = os.path.join(CHARTS_DIR, "recursive_improvement_loop_tracker.png")

_config_lock = threading.Lock()
_loop_lock = threading.Lock()


def _get_git_short_sha() -> str:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=REPO_ROOT,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=3,
        ).strip()
        return out or "working-tree"
    except Exception:
        return "working-tree"


# ---------------------------------------------------------------------------
# Active Experiment Config (Architecture + Reward Function + Hyperparameters)
# ---------------------------------------------------------------------------

def get_default_experiment_config() -> Dict[str, Any]:
    return {
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "arch_config": dict(DEFAULT_ARCH_CONFIG),
        "reward_config": dict(DEFAULT_REWARD_CONFIG),
        "hyperparams": dict(DEFAULT_HYPERPARAMS),
    }


def load_active_experiment_config() -> Dict[str, Any]:
    os.makedirs(TRAINED_MODELS_DIR, exist_ok=True)
    default_cfg = get_default_experiment_config()
    if os.path.exists(ACTIVE_CONFIG_PATH):
        try:
            with open(ACTIVE_CONFIG_PATH, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if isinstance(loaded, dict):
                for section in ("arch_config", "reward_config", "hyperparams"):
                    if isinstance(loaded.get(section), dict):
                        default_cfg[section].update(
                            {k: v for k, v in loaded[section].items() if v is not None}
                        )
                if "updated_at" in loaded:
                    default_cfg["updated_at"] = loaded["updated_at"]
        except Exception:
            pass
    return default_cfg


def save_active_experiment_config(cfg: Dict[str, Any]) -> Dict[str, Any]:
    os.makedirs(TRAINED_MODELS_DIR, exist_ok=True)
    with _config_lock:
        merged = get_default_experiment_config()
        for section in ("arch_config", "reward_config", "hyperparams"):
            if isinstance(cfg.get(section), dict):
                merged[section].update(
                    {k: v for k, v in cfg[section].items() if v is not None}
                )
        merged["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        with open(ACTIVE_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2)
        return merged


def apply_config_patch(
    base_cfg: Dict[str, Any], patch: Dict[str, Any]
) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """
    Applies a config_patch dictionary across `arch_config`, `reward_config`, and `hyperparams`,
    returning `(new_config, list_of_diffs)`.
    """
    next_cfg = copy.deepcopy(base_cfg)
    diffs: List[Dict[str, Any]] = []
    for section in ("arch_config", "reward_config", "hyperparams"):
        sec_patch = patch.get(section)
        if not isinstance(sec_patch, dict):
            continue
        sec_target = next_cfg.setdefault(section, {})
        for k, new_val in sec_patch.items():
            if new_val is None:
                continue
            old_val = sec_target.get(k)
            if old_val != new_val:
                sec_target[k] = new_val
                diffs.append(
                    {
                        "section": section,
                        "parameter": k,
                        "before": old_val,
                        "after": new_val,
                    }
                )
    next_cfg["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    return next_cfg, diffs


# ---------------------------------------------------------------------------
# Pre-Change Baseline Snapshot Builder
# ---------------------------------------------------------------------------

def extract_compact_metrics_from_telemetry(telemetry: Dict[str, Any]) -> Dict[str, Any]:
    session = telemetry.get("session", {})
    trends = telemetry.get("trends", {})
    rec50 = telemetry.get("windows", {}).get("recent_50", {})
    rew_dec = telemetry.get("reward_decomposition", {})
    opt_h = telemetry.get("optimization_health", {})
    funnel = telemetry.get("star_conversion_funnel", {})
    vb = telemetry.get("village_bottlenecks", {})
    probe = telemetry.get("live_model_probe", {})
    hb = probe.get("head_entropy_breakdown", {})
    cal = probe.get("critic_calibration", {})
    tact = probe.get("tactical_rollout_behavior", {})

    return {
        "episode": int(session.get("cumulative_episode") or session.get("history_length", 0)),
        "history_length": int(session.get("history_length", 0)),
        "mean_pct_50": float(rec50.get("mean_pct", 0.0)),
        "std_pct_50": float(rec50.get("std_pct", 0.0)),
        "rolling50_peak_pct": float(trends.get("rolling50_peak_pct", rec50.get("mean_pct", 0.0))),
        "episodes_since_peak": int(trends.get("episodes_since_rolling50_peak", 0)),
        "drawdown_from_peak_pct": float(trends.get("drawdown_from_rolling50_peak_pct", 0.0)),
        "best_pct": int(session.get("best_pct", rec50.get("max_pct", 0))),
        "best_stars": int(session.get("best_stars", 0)),
        "one_star_rate_50": float(rec50.get("one_plus_star_rate_pct", 0.0)),
        "two_star_th_rate_50": float(rec50.get("two_plus_star_th_rate_pct", 0.0)),
        "three_star_triple_rate_50": float(rec50.get("three_star_triple_rate_pct", 0.0)),
        "mean_reward_50": float(rec50.get("mean_reward", 0.0)),
        "reward_snr": float(rew_dec.get("signal_to_noise_ratio", 0.0)),
        "destr_share_pct": float(rew_dec.get("destr_share_pct", 35.0)),
        "stars_th_share_pct": float(rew_dec.get("stars_th_share_pct", 50.0)),
        "damage_funnel_share_pct": float(rew_dec.get("damage_funnel_share_pct", 15.0)),
        "pct_slope_per_100ep": float(trends.get("recent_pct_slope_per_100ep", 0.0)),
        "reward_slope_per_100ep": float(trends.get("recent_reward_slope_per_100ep", 0.0)),
        "entropy_slope_per_100ep": float(trends.get("recent_entropy_slope_per_100ep", 0.0)),
        "mean_noop_pct_50": float(rec50.get("mean_noop_pct", 0.0)),
        "mean_steps_50": float(rec50.get("mean_steps", 0.0)),
        "explained_variance_50": float(opt_h.get("explained_variance_recent50", rec50.get("mean_explained_variance", 0.0))),
        "approx_kl_50": float(opt_h.get("mean_approx_kl_recent50", rec50.get("mean_approx_kl", 0.0))),
        "kl_saturation_rate_pct": float(opt_h.get("kl_saturation_rate_pct", 0.0)),
        "clip_fraction_50": float(opt_h.get("mean_clip_fraction_recent50", rec50.get("mean_clip_fraction", 0.0))),
        "grad_norm_50": float(opt_h.get("mean_grad_norm_recent50", rec50.get("mean_grad_norm", 0.0))),
        "critic_v_s0": float(cal.get("predicted_v_s0", 0.0)),
        "calibration_gap": float(cal.get("calibration_gap_v0_minus_return") or 0.0),
        "head_saturation_pct": {
            "slot_type": float(hb.get("slot_type", {}).get("saturation_pct", 50.0)),
            "slot_idx": float(hb.get("slot_idx", {}).get("saturation_pct", 50.0)),
            "deploy_fraction": float(hb.get("deploy_fraction", {}).get("saturation_pct", 50.0)),
            "tile_xy": float(hb.get("tile_xy", {}).get("saturation_pct", 60.0)),
        },
        "top5_tile_mass_pct": float(hb.get("tile_xy", {}).get("top5_tile_prob_mass_pct", 20.0)),
        "spatial_spread_std": float(tact.get("spatial_deploy_spread_std_tiles", 5.0)),
        "star_funnel": {
            "p_1star_pct": float(funnel.get("p_1star_pct", rec50.get("one_plus_star_rate_pct", 0.0))),
            "p_2star_given_1star_pct": float(funnel.get("p_2star_given_1star_pct", 0.0)),
            "p_3star_given_2star_pct": float(funnel.get("p_3star_given_2star_pct", 0.0)),
            "near_miss_85_to_99_pct_rate": float(funnel.get("near_miss_85_to_99_pct_rate", 0.0)),
        },
        "worst_village": vb.get("worst_village") or {"name": "N/A", "recent_avg_pct": 0.0},
        "best_village": vb.get("best_village") or {"name": "N/A", "recent_avg_pct": 0.0},
        "inter_village_gap_pct": float(vb.get("inter_village_gap_pct", 0.0)),
    }


def capture_pre_change_snapshot(
    cycle_id: int,
    telemetry: Dict[str, Any],
    active_config: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Captures and documents the complete state of the model Architecture, Reward Function,
    Hyperparameters, and Baseline Telemetry BEFORE any modification is applied.
    """
    session = telemetry.get("session", {})
    arch_cfg = dict(DEFAULT_ARCH_CONFIG)
    arch_cfg.update(active_config.get("arch_config", {}))

    rew_cfg = dict(DEFAULT_REWARD_CONFIG)
    rew_cfg.update(active_config.get("reward_config", {}))

    hp_cfg = dict(DEFAULT_HYPERPARAMS)
    if isinstance(session.get("hyperparams"), dict):
        hp_cfg.update(session["hyperparams"])
    hp_cfg.update(active_config.get("hyperparams", {}))

    model_tmp = CoCActorCritic(
        in_channels=int(arch_cfg.get("in_channels", 59)),
        army_context_dim=64,
        arch_config=arch_cfg,
    )
    arch_spec = model_tmp.get_arch_config()
    baseline_metrics = extract_compact_metrics_from_telemetry(telemetry)

    return {
        "snapshot_id": f"snapshot_cycle_{cycle_id:03d}_{int(time.time())}",
        "cycle_id": cycle_id,
        "documented_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "git_commit": _get_git_short_sha(),
        "checkpoint_file": session.get("active_checkpoint", "latest_attacker.pt"),
        "cumulative_episode": baseline_metrics["episode"],
        "arch_config": arch_spec,
        "reward_config": rew_cfg,
        "reward_formula": format_reward_formula(rew_cfg),
        "hyperparams": hp_cfg,
        "baseline_metrics": baseline_metrics,
        "detected_signals": telemetry.get("detected_signals", []),
    }


# ---------------------------------------------------------------------------
# Quantitative Diagnosis & Multi-Domain Candidate Solutions Synthesis
# ---------------------------------------------------------------------------

def _build_deterministic_diagnosis_and_solutions(
    telemetry: Dict[str, Any],
    active_config: Dict[str, Any],
    past_cycles: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Synthesizes grounded quantitative plateau diagnosis and 4 concrete candidate solutions
    (spanning Architecture, Reward Function, Hyperparameters, and Combined) tailored to
    the exact bottlenecks observed in `telemetry`, while avoiding any solution_id that
    was recently rolled back.
    """
    metrics = extract_compact_metrics_from_telemetry(telemetry)
    arch_cfg = active_config.get("arch_config", DEFAULT_ARCH_CONFIG)
    rew_cfg = active_config.get("reward_config", DEFAULT_REWARD_CONFIG)
    hp_cfg = active_config.get("hyperparams", DEFAULT_HYPERPARAMS)

    slope = metrics["pct_slope_per_100ep"]
    eps_since_peak = metrics["episodes_since_peak"]
    mean_pct = metrics["mean_pct_50"]
    th_rate = metrics["two_star_th_rate_50"]
    triple_rate = metrics["three_star_triple_rate_50"]
    p2_given_1 = metrics["star_funnel"]["p_2star_given_1star_pct"]
    p3_given_2 = metrics["star_funnel"]["p_3star_given_2star_pct"]
    near_miss = metrics["star_funnel"]["near_miss_85_to_99_pct_rate"]
    v_gap = metrics["inter_village_gap_pct"]
    worst_v = metrics["worst_village"]
    noop_pct = metrics["mean_noop_pct_50"]
    ev_50 = metrics["explained_variance_50"]
    cal_gap = abs(metrics["calibration_gap"])
    tile_sat = metrics["head_saturation_pct"]["tile_xy"]
    type_sat = metrics["head_saturation_pct"]["slot_type"]

    # Determine health & plateau status
    is_plateaued = (
        (metrics["history_length"] >= 40 and slope < 0.45 and eps_since_peak >= 35)
        or (mean_pct < 78.0 and slope < 0.65)
        or (triple_rate < 25.0 and slope < 0.80)
        or len(telemetry.get("detected_signals", [])) >= 1
    )

    if not is_plateaued and slope >= 0.65 and mean_pct >= 75.0:
        status = "healthy_progressing"
        health_score = min(95, int(74 + slope * 6 + triple_rate * 0.3))
    elif slope < -0.60:
        status = "degrading"
        health_score = max(28, int(52 + slope * 5))
        is_plateaued = True
    else:
        status = "plateaued"
        health_score = max(38, min(72, int(45 + mean_pct * 0.25 + slope * 4)))
        is_plateaued = True

    reasons: List[Dict[str, Any]] = []

    # Reason 1: Core TH18 Penetration / 2-Star Conversion or 2-Star -> 3-Star Cleanup
    if th_rate < 65.0 or p2_given_1 < 68.0:
        reasons.append({
            "id": "th18_core_penetration_ceiling",
            "title": "Town Hall 18 Core Breach Bottleneck",
            "severity": "critical" if th_rate < 45.0 else "warning",
            "category": "reward_function",
            "symptom": (
                f"2★+ TH18 takedown rate is {th_rate:.1f}% (conditional P(2★|1★) = {p2_given_1:.1f}%) "
                f"with recent 50-ep destruction at {mean_pct:.1f}% (slope {slope:+.2f}%/100ep)."
            ),
            "root_cause": (
                "Exterior building destruction rewards (0.35 pts/%) provide easier immediate gradient signal than "
                "chewing through high-HP core defenses (Monolith, Multi-Archer, Hot Candle, TH18 Guardian), causing "
                "units to drift around the perimeter instead of committing to a deep core funnel."
            ),
        })
    elif triple_rate < 30.0 or p3_given_2 < 35.0:
        reasons.append({
            "id": "late_battle_3star_cleanup_stall",
            "title": "2★ → 3★ Back-End Cleanup Plateau",
            "severity": "warning",
            "category": "reward_function",
            "symptom": (
                f"Policy achieves {th_rate:.1f}% 2★ TH18 takedowns, but only converts P(3★|2★) = {p3_given_2:.1f}% "
                f"into full 3★ triples ({triple_rate:.1f}% overall; {near_miss:.1f}% near-miss finishes at 85–99%)."
            ),
            "root_cause": (
                "Once the 2nd star and TH18 bonus are secured around 65–75% destruction, marginal reward per surviving "
                "defense drops, giving insufficient late-battle gradient incentive to preserve spell/ability sustain for "
                "75%→90%→100% back-end compartment cleanup."
            ),
        })

    # Reason 2: Spatial Funnel & Head Conditioning / Entropy Balance
    if tile_sat > 62.0 or metrics["top5_tile_mass_pct"] < 28.0 or type_sat < 45.0:
        reasons.append({
            "id": "spatial_pointer_dispersion_vs_head_focus",
            "title": "Spatial Breach Focus & Factorized Head Conditioning Imbalance",
            "severity": "warning",
            "category": "architecture",
            "symptom": (
                f"Tile pointer saturation is {tile_sat:.1f}% (Top-5 tile mass {metrics['top5_tile_mass_pct']:.1f}%, "
                f"spread σ={metrics['spatial_spread_std']:.2f}t) while Action Type saturation is {type_sat:.1f}%."
            ),
            "root_cause": (
                f"Current spatial breach attraction (`th_threat_weight={arch_cfg.get('th_threat_weight', 6.0)}`, "
                f"`breach_prior_weight={arch_cfg.get('breach_prior_weight', 8.0)}`) and FiLM conditioning scale "
                f"(`film_cond_scale={arch_cfg.get('film_cond_scale', 0.5)}`) allow troop drops to spread too widely "
                "along the border rather than concentrating on the shortest breach vector to TH18."
            ),
        })

    # Reason 3: Village Geometry Variance or Critic Calibration / PPO Step Size
    if v_gap >= 10.0:
        reasons.append({
            "id": "asymmetric_village_generalization_gap",
            "title": f"High Cross-Village Performance Gap ({v_gap:.1f}% Spread)",
            "severity": "warning",
            "category": "hyperparameters",
            "symptom": (
                f"Worst base `{worst_v.get('name')}` averages {worst_v.get('recent_avg_pct')}% vs "
                f"Best base `{metrics['best_village'].get('name')}` at {metrics['best_village'].get('recent_avg_pct')}% "
                f"(Δ={v_gap:.1f}%)."
            ),
            "root_cause": (
                "Random village sampling with high variance across compartment geometries causes PPO minibatches to "
                "overfit easier symmetrical bases while under-updating on harder anti-3★ layouts."
            ),
        })
    elif cal_gap >= 5.0 or ev_50 < 0.35 or abs(slope) < 0.45:
        reasons.append({
            "id": "critic_calibration_and_trust_region_stagnation",
            "title": "Critic Baseline Lag & PPO Trust-Region Plateau",
            "severity": "info",
            "category": "hyperparameters",
            "symptom": (
                f"Critic calibration gap |V(s₀)−R̄| = {cal_gap:.2f} pts, Explained Variance = {ev_50*100:.1f}%, "
                f"Approx KL = {metrics['approx_kl_50']:.4f} (Slope {slope:+.2f}%/100ep, {eps_since_peak} eps since peak)."
            ),
            "root_cause": (
                "As policy returns shift into higher destruction regimes, the Critic value head lags behind the new "
                "return distribution, increasing GAE advantage noise and causing small policy updates to stall."
            ),
        })

    if not reasons:
        reasons.append({
            "id": "local_optimum_consolidation",
            "title": "Rolling Destruction Consolidation Plateau",
            "severity": "info",
            "category": "combined",
            "symptom": (
                f"Rolling 50-ep destruction is {mean_pct:.1f}% (Peak {metrics['rolling50_peak_pct']:.1f}% "
                f"{eps_since_peak} eps ago, slope {slope:+.2f}%/100ep)."
            ),
            "root_cause": (
                "Policy has converged on a stable 2★ core entry pattern and requires sharper late-game milestone "
                "rewards and refined learning rate / spatial conditioning to break through to consistent 3★ wipes."
            ),
        })

    # Track recently failed solution IDs so we don't repeat them
    failed_ids = {
        c.get("selected_solution", {}).get("solution_id")
        for c in past_cycles[-3:]
        if isinstance(c.get("verification_result"), dict)
        and c["verification_result"].get("verdict") == "NOT_SOLVED_ROLLED_BACK"
    }

    # Build 4 concrete candidate solutions across Reward Function, Architecture, Hyperparameters, and Combined
    cur_th_bonus = float(rew_cfg.get("th_bonus", 14.0))
    cur_dmg_w = float(rew_cfg.get("damage_weight", 15.0))
    cur_funnel_w = float(rew_cfg.get("funnel_weight", 0.08))
    cur_m75 = float(rew_cfg.get("high_pct_milestone_75", 0.0))
    cur_m90 = float(rew_cfg.get("high_pct_milestone_90", 0.0))
    cur_3s_bonus = float(rew_cfg.get("triple_wipe_bonus", 0.0))

    cur_th_threat = float(arch_cfg.get("th_threat_weight", 6.0))
    cur_breach_w = float(arch_cfg.get("breach_prior_weight", 8.0))
    cur_spell_w = float(arch_cfg.get("spell_combat_prior_weight", 7.5))
    cur_film = float(arch_cfg.get("film_cond_scale", 0.5))
    cur_tile_scale = float(arch_cfg.get("tile_logit_scale", 2.2))
    cur_reg_tile = float(arch_cfg.get("reg_ent_tile_weight", 0.12))
    cur_reg_type = float(arch_cfg.get("reg_ent_type_weight", 2.2))

    cur_lr = float(hp_cfg.get("lr", 0.0003))
    cur_critic_mult = float(hp_cfg.get("critic_lr_mult", 2.5))
    cur_ent = float(hp_cfg.get("ent_coef", 0.015))
    cur_vf = float(hp_cfg.get("vf_coef", 0.5))
    cur_kl = float(hp_cfg.get("target_kl", 0.03))

    candidates: List[Dict[str, Any]] = [
        {
            "solution_id": f"sol_reward_milestone_push_v{len(past_cycles)+1}",
            "rank": 1,
            "category": "reward_function",
            "title": "High-Destruction Milestone & Core HP Shaping Boost",
            "target_problem": reasons[0]["title"],
            "rationale": (
                "Adds explicit progressive milestone bonuses at ≥75% (+4.5 pts) and ≥90% (+6.0 pts) destruction plus "
                "a +8.0 pt 3★ wipe bonus and elevated Core HP & TH18 takedown weights so GAE advantages strongly "
                "reward pushing through the TH18 core into back-end cleanup."
            ),
            "config_patch": {
                "reward_config": {
                    "th_bonus": round(min(22.0, cur_th_bonus + 2.5), 2),
                    "damage_weight": round(min(22.0, cur_dmg_w + 2.5), 2),
                    "funnel_weight": round(min(0.16, cur_funnel_w + 0.03), 3),
                    "high_pct_milestone_75": round(min(8.0, max(4.5, cur_m75 + 2.5)), 2),
                    "high_pct_milestone_90": round(min(10.0, max(6.0, cur_m90 + 3.0)), 2),
                    "triple_wipe_bonus": round(min(14.0, max(8.0, cur_3s_bonus + 4.0)), 2),
                }
            },
            "expected_verification_criteria": (
                "Improve recent 50-ep Mean Destruction % by ≥ +0.5% or increase 2★+ TH18 / 3★ Triple conversion rate."
            ),
        },
        {
            "solution_id": f"sol_arch_spatial_breach_and_film_v{len(past_cycles)+1}",
            "rank": 2,
            "category": "architecture",
            "title": "U-Net FiLM Conditioning & TH18 Spatial Breach Attraction Amplification",
            "target_problem": (
                reasons[1]["title"] if len(reasons) > 1 else "Spatial Breach Focus & Spell Placement Conditioning"
            ),
            "rationale": (
                "Increases the U-Net decoder's FiLM multiplicative conditioning scale (`film_cond_scale`), "
                "strengthens the 15×15 cascaded Town Hall 18 breach attraction field (`th_threat_weight`, "
                "`breach_prior_weight`) and mid-battle spell combat focus (`spell_combat_prior_weight`), and "
                "tightens spatial tile entropy regularization so troops funnel into a concentrated breach corridor."
            ),
            "config_patch": {
                "arch_config": {
                    "th_threat_weight": round(min(9.5, cur_th_threat + 1.0), 2),
                    "breach_prior_weight": round(min(11.5, cur_breach_w + 1.0), 2),
                    "spell_combat_prior_weight": round(min(10.5, cur_spell_w + 0.8), 2),
                    "film_cond_scale": round(min(0.85, cur_film + 0.12), 2),
                    "tile_logit_scale": round(min(3.0, cur_tile_scale + 0.2), 2),
                    "reg_ent_tile_weight": round(max(0.06, cur_reg_tile - 0.02), 3),
                    "reg_ent_type_weight": round(min(2.8, cur_reg_type + 0.2), 2),
                }
            },
            "expected_verification_criteria": (
                "Increase Top-5 Tile Probability Mass %, reduce perimeter scatter σ, and improve 2★+ TH18 breach rate."
            ),
        },
        {
            "solution_id": f"sol_hyperparams_critic_and_round_robin_v{len(past_cycles)+1}",
            "rank": 3,
            "category": "hyperparameters",
            "title": "Critic Calibration Acceleration, Trust-Region Fine-Tuning & Round-Robin Sampling",
            "target_problem": (
                reasons[-1]["title"]
            ),
            "rationale": (
                "Refines actor learning rate for fine-grained late-stage convergence while boosting `critic_lr_mult` "
                "and `vf_coef` to eliminate V(s₀) calibration lag, and enforces `round_robin` village sampling so "
                "every PPO batch receives equal gradient weight from the hardest TH18 layout."
            ),
            "config_patch": {
                "hyperparams": {
                    "lr": round(max(1.5e-4, cur_lr * 0.85), 6),
                    "critic_lr_mult": round(min(4.0, cur_critic_mult + 0.5), 2),
                    "vf_coef": round(min(0.75, cur_vf + 0.1), 2),
                    "ent_coef": round(max(0.010, min(0.022, cur_ent * 0.95)), 4),
                    "target_kl": round(max(0.022, min(0.035, cur_kl)), 4),
                    "matchup_mode": "round_robin",
                }
            },
            "expected_verification_criteria": (
                "Reduce inter-village destruction gap, improve Critic Explained Variance, and resume positive destruction slope."
            ),
        },
        {
            "solution_id": f"sol_combined_synergy_breakthrough_v{len(past_cycles)+1}",
            "rank": 4,
            "category": "combined",
            "title": "Synergistic Architecture + Milestone Reward + Critic Calibration Upgrade",
            "target_problem": reasons[0]["title"],
            "rationale": (
                "Combines sharper U-Net TH18 breach conditioning (`th_threat_weight`, `film_cond_scale`), "
                "progressive 75%/90%/3★ reward milestones (`high_pct_milestone_75`, `high_pct_milestone_90`), "
                "and Critic LR calibration (`critic_lr_mult`, `round_robin` village balance) to simultaneously "
                "improve spatial entry, core sustain, and value baseline accuracy."
            ),
            "config_patch": {
                "arch_config": {
                    "th_threat_weight": round(min(9.5, cur_th_threat + 0.8), 2),
                    "breach_prior_weight": round(min(11.0, cur_breach_w + 0.8), 2),
                    "film_cond_scale": round(min(0.80, cur_film + 0.10), 2),
                },
                "reward_config": {
                    "th_bonus": round(min(20.0, cur_th_bonus + 2.0), 2),
                    "high_pct_milestone_75": round(min(8.0, max(4.0, cur_m75 + 2.0)), 2),
                    "high_pct_milestone_90": round(min(10.0, max(5.0, cur_m90 + 2.5)), 2),
                    "triple_wipe_bonus": round(min(12.0, max(6.0, cur_3s_bonus + 3.0)), 2),
                },
                "hyperparams": {
                    "critic_lr_mult": round(min(3.8, cur_critic_mult + 0.4), 2),
                    "matchup_mode": "round_robin",
                },
            },
            "expected_verification_criteria": (
                "Simultaneously lift recent 50-ep Destruction %, 2★+ TH18 rate, and worst-village performance."
            ),
        },
    ]

    # Rotate ranking based on cycle history so each cycle tests the most relevant untried lever
    cycle_mod = len(past_cycles) % len(candidates)
    if cycle_mod > 0:
        candidates = candidates[cycle_mod:] + candidates[:cycle_mod]
        for idx, c in enumerate(candidates):
            c["rank"] = idx + 1

    # Deprioritize any solution_id in failed_ids
    candidates.sort(key=lambda c: (1 if c["solution_id"] in failed_ids else 0, c["rank"]))
    for idx, c in enumerate(candidates):
        c["rank"] = idx + 1

    headline = (
        f"Training {'PLATEAUED' if is_plateaued else 'PROGRESSING'} at {mean_pct:.1f}% recent destruction "
        f"({slope:+.2f}%/100ep, {th_rate:.1f}% 2★ TH18, {triple_rate:.1f}% 3★) — "
        f"{reasons[0]['title']}."
    )

    return {
        "status": status,
        "health_score": health_score,
        "is_plateaued": is_plateaued,
        "headline": headline,
        "progression_summary": (
            f"At cumulative episode {metrics['episode']:,}, recent 50-ep average destruction is {mean_pct:.1f}% "
            f"(peak rolling-50: {metrics['rolling50_peak_pct']:.1f}% {eps_since_peak} eps ago; slope {slope:+.2f}%/100ep). "
            f"Star conversion funnel: 1★={metrics['one_star_rate_50']:.1f}% → P(2★|1★)={p2_given_1:.1f}% → "
            f"P(3★|2★)={p3_given_2:.1f}% (Worst village: {worst_v.get('name')} at {worst_v.get('recent_avg_pct')}%)."
        ),
        "reasons": reasons,
        "candidate_solutions": candidates,
    }


def _build_recursive_loop_llm_prompt(
    telemetry: Dict[str, Any],
    active_config: Dict[str, Any],
    past_cycles: List[Dict[str, Any]],
    deterministic_draft: Dict[str, Any],
) -> str:
    past_summary = [
        {
            "cycle_id": c.get("cycle_id"),
            "episode": c.get("episode_at_analysis"),
            "status": c.get("health_verdict", {}).get("status"),
            "applied_solution": (c.get("selected_solution") or {}).get("title"),
            "category": (c.get("selected_solution") or {}).get("category"),
            "verification_verdict": (c.get("verification_result") or {}).get("verdict"),
            "deltas": (c.get("verification_result") or {}).get("metric_deltas"),
            "lesson_learned": (c.get("verification_result") or {}).get("analysis_summary"),
        }
        for c in past_cycles[-5:]
    ]
    payload = {
        "active_config": active_config,
        "compact_metrics": extract_compact_metrics_from_telemetry(telemetry),
        "detected_signals": telemetry.get("detected_signals", []),
        "past_cycles_memory": past_summary,
        "candidate_solutions_baseline": deterministic_draft["candidate_solutions"],
    }
    return f"""CRITICAL INSTRUCTION: Respond immediately in a single turn with ZERO tool calls. Output ONLY the raw JSON object (no markdown fences).

You are the Autonomous Recursive Self-Improvement Architect for the Clash of Clans Town Hall 18 (TH18) Deep RL Attacker (`CoCActorCritic` + PPO + GAE).
Every 10 minutes you analyze training telemetry, determine if training is healthy or plateaued, identify quantitative root causes, and propose 3–4 concrete candidate solutions across `architecture`, `reward_function`, `hyperparameters`, and `combined`.

### Live Telemetry, Active Configuration & Past Cycles Memory
{json.dumps(payload, indent=2)}

### Required JSON Schema
Return ONLY a raw JSON object with this structure:
{{
  "status": "healthy_progressing" | "plateaued" | "degrading",
  "health_score": <int 0..100>,
  "is_plateaued": <boolean>,
  "headline": "<1-sentence quantitative verdict>",
  "progression_summary": "<2-3 sentences citing exact metrics, star funnel rates, slopes, and village bottlenecks>",
  "reasons": [
    {{
      "id": "<snake_case_id>",
      "title": "<short diagnostic title>",
      "severity": "critical" | "warning" | "info",
      "category": "architecture" | "reward_function" | "hyperparameters" | "tactical_pacing",
      "symptom": "<exact numbers from telemetry>",
      "root_cause": "<why this happens mathematically in the network, reward shaping, or PPO update>"
    }}
  ],
  "recommended_solution_index": <int 0..3 choosing the best candidate from candidate_solutions_baseline>
}}"""


def diagnose_and_propose_solutions(
    telemetry: Dict[str, Any],
    active_config: Dict[str, Any],
    past_cycles: List[Dict[str, Any]],
    provider: str = "opencode_argon",
    use_llm: bool = True,
) -> Dict[str, Any]:
    """
    Runs quantitative + LLM root-cause diagnosis and generates ranked candidate solutions
    with exact `diff_summary` previews against `active_config`.
    """
    draft = _build_deterministic_diagnosis_and_solutions(
        telemetry=telemetry,
        active_config=active_config,
        past_cycles=past_cycles,
    )

    llm_used = "deterministic_hybrid"
    if use_llm:
        prompt = _build_recursive_loop_llm_prompt(
            telemetry=telemetry,
            active_config=active_config,
            past_cycles=past_cycles,
            deterministic_draft=draft,
        )
        try:
            if provider == "agy_flash":
                raw_txt, llm_used = _call_agy_flash(prompt, timeout_sec=45)
            else:
                raw_txt, llm_used = _call_opencode_argon(prompt, timeout_sec=45)
            parsed = _extract_json_object(raw_txt)
            if isinstance(parsed, dict) and "headline" in parsed:
                draft["headline"] = str(parsed.get("headline") or draft["headline"])
                draft["progression_summary"] = str(
                    parsed.get("progression_summary") or draft["progression_summary"]
                )
                if "health_score" in parsed and isinstance(parsed["health_score"], (int, float)):
                    draft["health_score"] = int(max(0, min(100, parsed["health_score"])))
                if "is_plateaued" in parsed and isinstance(parsed["is_plateaued"], bool):
                    draft["is_plateaued"] = parsed["is_plateaued"]
                if "status" in parsed and parsed["status"] in ("healthy_progressing", "plateaued", "degrading"):
                    draft["status"] = parsed["status"]
                if isinstance(parsed.get("reasons"), list) and len(parsed["reasons"]) > 0:
                    valid_reasons = [
                        r for r in parsed["reasons"]
                        if isinstance(r, dict) and r.get("title") and r.get("symptom")
                    ]
                    if valid_reasons:
                        draft["reasons"] = valid_reasons
                rec_idx = parsed.get("recommended_solution_index")
                if isinstance(rec_idx, int) and 0 <= rec_idx < len(draft["candidate_solutions"]):
                    chosen = draft["candidate_solutions"].pop(rec_idx)
                    draft["candidate_solutions"].insert(0, chosen)
                    for i, c in enumerate(draft["candidate_solutions"]):
                        c["rank"] = i + 1
        except Exception:
            pass

    # Attach exact diff summaries to each candidate solution
    for cand in draft["candidate_solutions"]:
        _, diffs = apply_config_patch(active_config, cand.get("config_patch", {}))
        cand["diffs"] = diffs
        cand["diff_summary"] = [
            f"{d['section']}.{d['parameter']}: {d['before']} → {d['after']}"
            for d in diffs
        ]

    draft["model_used"] = llm_used
    return draft


# ---------------------------------------------------------------------------
# Solution Verification Engine (Before vs After Analysis)
# ---------------------------------------------------------------------------

def verify_solution_outcome(
    cycle: Dict[str, Any],
    post_telemetry: Dict[str, Any],
    current_config: Dict[str, Any],
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Compares the `pre_change_snapshot` baseline metrics against `post_telemetry` metrics
    to verify whether the applied solution solved the problem it targeted.
    Returns `(verification_result, updated_active_config)`.
    """
    pre_snap = cycle.get("pre_change_snapshot", {})
    base_m = pre_snap.get("baseline_metrics", {})
    post_m = extract_compact_metrics_from_telemetry(post_telemetry)
    selected_sol = cycle.get("selected_solution") or {}

    delta_pct = round(post_m["mean_pct_50"] - float(base_m.get("mean_pct_50", 0.0)), 2)
    delta_2s = round(post_m["two_star_th_rate_50"] - float(base_m.get("two_star_th_rate_50", 0.0)), 2)
    delta_3s = round(post_m["three_star_triple_rate_50"] - float(base_m.get("three_star_triple_rate_50", 0.0)), 2)
    delta_rew = round(post_m["mean_reward_50"] - float(base_m.get("mean_reward_50", 0.0)), 2)
    delta_slope = round(post_m["pct_slope_per_100ep"] - float(base_m.get("pct_slope_per_100ep", 0.0)), 2)
    delta_noop = round(post_m["mean_noop_pct_50"] - float(base_m.get("mean_noop_pct_50", 0.0)), 2)
    delta_ev = round(post_m["explained_variance_50"] - float(base_m.get("explained_variance_50", 0.0)), 4)

    base_wv = float((base_m.get("worst_village") or {}).get("recent_avg_pct", 0.0))
    post_wv = float((post_m.get("worst_village") or {}).get("recent_avg_pct", 0.0))
    delta_wv = round(post_wv - base_wv, 2)
    delta_v_gap = round(post_m["inter_village_gap_pct"] - float(base_m.get("inter_village_gap_pct", 0.0)), 2)

    eps_tested = max(0, int(post_m["episode"]) - int(base_m.get("episode", 0)))

    # Evaluate if the target problem was solved or improved
    significant_regression = (delta_pct <= -2.5 and delta_2s <= -4.0)
    strong_solve = (
        delta_pct >= 0.8
        or delta_2s >= 2.5
        or delta_3s >= 1.5
        or (delta_wv >= 1.5 and delta_pct >= -0.3)
        or (post_m["pct_slope_per_100ep"] >= 0.50 and delta_pct >= 0.2)
    )
    moderate_improvement = (
        not significant_regression
        and (
            delta_pct >= 0.0
            or delta_2s >= 0.5
            or delta_3s >= 0.5
            or delta_rew >= 0.5
            or delta_ev >= 0.02
            or delta_v_gap <= -1.0
        )
    )

    next_active_cfg = copy.deepcopy(current_config)
    if significant_regression:
        verdict = "NOT_SOLVED_ROLLED_BACK"
        problem_solved = False
        decision_taken = "rolled_back_to_baseline"
        # Roll back to pre-change snapshot config
        next_active_cfg = {
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "arch_config": copy.deepcopy(pre_snap.get("arch_config", DEFAULT_ARCH_CONFIG)),
            "reward_config": copy.deepcopy(pre_snap.get("reward_config", DEFAULT_REWARD_CONFIG)),
            "hyperparams": copy.deepcopy(pre_snap.get("hyperparams", DEFAULT_HYPERPARAMS)),
        }
        save_active_experiment_config(next_active_cfg)
        summary = (
            f"Tested `{selected_sol.get('title', 'Solution')}` over +{eps_tested} episodes "
            f"(Ep {base_m.get('episode', 0):,} → {post_m['episode']:,}). "
            f"Mean destruction shifted by {delta_pct:+.2f}% ({base_m.get('mean_pct_50', 0):.1f}% → {post_m['mean_pct_50']:.1f}%) "
            f"and 2★+ TH18 rate by {delta_2s:+.1f}%. Rolled back to the pre-change baseline configuration "
            f"and recorded this parameter combination to avoid in future cycles."
        )
    elif strong_solve:
        verdict = "SOLVED"
        problem_solved = True
        decision_taken = "kept_and_promoted"
        summary = (
            f"Verified `{selected_sol.get('title', 'Solution')}` over +{eps_tested} episodes "
            f"(Ep {base_m.get('episode', 0):,} → {post_m['episode']:,}): "
            f"Mean 50-ep destruction improved by {delta_pct:+.2f}% ({base_m.get('mean_pct_50', 0):.1f}% → {post_m['mean_pct_50']:.1f}%), "
            f"2★+ TH18 rate {delta_2s:+.1f}% ({post_m['two_star_th_rate_50']:.1f}%), "
            f"3★ triple rate {delta_3s:+.1f}% ({post_m['three_star_triple_rate_50']:.1f}%), "
            f"and worst village moved {delta_wv:+.1f}%. Promoted configuration as the new baseline."
        )
    else:
        verdict = "IMPROVED" if moderate_improvement else "PARTIAL"
        problem_solved = bool(moderate_improvement)
        decision_taken = "kept_and_continuing"
        summary = (
            f"Evaluated `{selected_sol.get('title', 'Solution')}` over +{eps_tested} episodes "
            f"(Ep {base_m.get('episode', 0):,} → {post_m['episode']:,}): "
            f"Destruction Δ={delta_pct:+.2f}% ({post_m['mean_pct_50']:.1f}%), "
            f"2★+ TH18 Δ={delta_2s:+.1f}% ({post_m['two_star_th_rate_50']:.1f}%), "
            f"3★ Δ={delta_3s:+.1f}% ({post_m['three_star_triple_rate_50']:.1f}%), "
            f"Return Δ={delta_rew:+.2f} pts. Retained configuration for continued consolidation."
        )

    verification_result = {
        "verified_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "start_episode": int(base_m.get("episode", 0)),
        "end_episode": int(post_m["episode"]),
        "episodes_tested": eps_tested,
        "problem_solved": problem_solved,
        "verdict": verdict,
        "decision_taken": decision_taken,
        "post_change_metrics": post_m,
        "metric_deltas": {
            "delta_mean_pct_50": delta_pct,
            "delta_two_star_th_rate": delta_2s,
            "delta_three_star_rate": delta_3s,
            "delta_mean_reward": delta_rew,
            "delta_pct_slope": delta_slope,
            "delta_noop_pct": delta_noop,
            "delta_explained_variance": delta_ev,
            "delta_worst_village_pct": delta_wv,
            "delta_inter_village_gap_pct": delta_v_gap,
        },
        "analysis_summary": summary,
    }
    return verification_result, next_active_cfg


# ---------------------------------------------------------------------------
# Obsidian Vault Long-Term Memory & Tracker Chart Generation
# ---------------------------------------------------------------------------

def generate_recursive_loop_chart(loop_state: Dict[str, Any], out_png_path: str) -> str:
    """
    Renders a 2x2 dark-mode publication-grade chart tracking the Recursive Improvement Loop's
    cycles, before/after destruction & star rates, health scores, and parameter interventions.
    """
    os.makedirs(os.path.dirname(out_png_path), exist_ok=True)
    cycles = loop_state.get("cycles", [])

    fig, axes = plt.subplots(2, 2, figsize=(14, 8.2), facecolor="#0b1324")
    plt.subplots_adjust(wspace=0.24, hspace=0.34)
    fig.suptitle(
        "Recursive AI Self-Improvement Loop — 10-Minute Autonomous Diagnosis, Intervention & Verification Ledger",
        color="#fde047",
        fontsize=12.5,
        fontweight="bold",
        y=0.97,
    )

    for row in axes:
        for ax in row:
            ax.set_facecolor("#111c33")
            ax.tick_params(colors="#cbd5e1", labelsize=8.5)
            for spine in ax.spines.values():
                spine.set_color("#293b59")
            ax.grid(True, color="#1e293b", linestyle="--", alpha=0.6)

    if not cycles:
        axes[0, 0].text(0.5, 0.5, "No Recursive Improvement Cycles Yet", ha="center", va="center", color="#cbd5e1")
        fig.savefig(out_png_path, dpi=180, bbox_inches="tight")
        plt.close(fig)
        return out_png_path

    c_labels = [f"C#{c.get('cycle_id', i+1)}\n(Ep {c.get('episode_at_analysis', 0)})" for i, c in enumerate(cycles)]
    x = np.arange(len(cycles))

    pre_pcts = [
        float(c.get("pre_change_snapshot", {}).get("baseline_metrics", {}).get("mean_pct_50", 0.0))
        for c in cycles
    ]
    post_pcts = [
        float(
            (c.get("verification_result") or {})
            .get("post_change_metrics", {})
            .get("mean_pct_50", pre_pcts[i])
        )
        for i, c in enumerate(cycles)
    ]

    pre_2s = [
        float(c.get("pre_change_snapshot", {}).get("baseline_metrics", {}).get("two_star_th_rate_50", 0.0))
        for c in cycles
    ]
    post_2s = [
        float(
            (c.get("verification_result") or {})
            .get("post_change_metrics", {})
            .get("two_star_th_rate_50", pre_2s[i])
        )
        for i, c in enumerate(cycles)
    ]

    pre_3s = [
        float(c.get("pre_change_snapshot", {}).get("baseline_metrics", {}).get("three_star_triple_rate_50", 0.0))
        for c in cycles
    ]
    post_3s = [
        float(
            (c.get("verification_result") or {})
            .get("post_change_metrics", {})
            .get("three_star_triple_rate_50", pre_3s[i])
        )
        for i, c in enumerate(cycles)
    ]

    scores = [int(c.get("health_verdict", {}).get("health_score", 60)) for c in cycles]

    # Panel 1: Before vs After Mean Destruction % per Cycle
    ax = axes[0, 0]
    bw = 0.34
    ax.bar(x - bw / 2, pre_pcts, width=bw, color="#38bdf8", alpha=0.85, label="Pre-Change Baseline %")
    ax.bar(x + bw / 2, post_pcts, width=bw, color="#4ade80", alpha=0.9, label="Post-Test Verified %")
    ax.set_xticks(x)
    ax.set_xticklabels(c_labels, fontsize=8)
    ax.set_ylim(0, 105)
    ax.set_ylabel("Mean 50-Ep Destruction %", color="#f8fafc", fontsize=9, fontweight="bold")
    ax.set_title("1. Pre-Change Baseline vs. Post-Test Verified Destruction %", color="#f8fafc", fontsize=10, fontweight="bold")
    ax.legend(loc="lower right", facecolor="#0b1324", edgecolor="#293b59", labelcolor="#f8fafc", fontsize=8)

    # Panel 2: 2★+ TH18 Takedown & 3★ Triple Rate Progression Across Cycles
    ax = axes[0, 1]
    ax.plot(x, pre_2s, "o--", color="#fb923c", lw=1.6, label="Pre 2★+ TH18 %")
    ax.plot(x, post_2s, "s-", color="#f97316", lw=2.2, label="Verified 2★+ TH18 %")
    ax.plot(x, pre_3s, "^--", color="#86efac", lw=1.6, label="Pre 3★ Triple %")
    ax.plot(x, post_3s, "D-", color="#22c55e", lw=2.2, label="Verified 3★ Triple %")
    ax.set_xticks(x)
    ax.set_xticklabels(c_labels, fontsize=8)
    ax.set_ylim(0, 105)
    ax.set_ylabel("Star Tier Rate (%)", color="#f8fafc", fontsize=9, fontweight="bold")
    ax.set_title("2. Star Conversion Funnel (2★ TH18 & 3★ Triple Progression)", color="#f8fafc", fontsize=10, fontweight="bold")
    ax.legend(loc="best", facecolor="#0b1324", edgecolor="#293b59", labelcolor="#f8fafc", fontsize=7.5)

    # Panel 3: AI Health Score & Plateau Diagnosis Status
    ax = axes[1, 0]
    bar_cols = [
        "#4ade80" if not c.get("health_verdict", {}).get("is_plateaued", True) else "#facc15"
        for c in cycles
    ]
    ax.bar(x, scores, width=0.5, color=bar_cols, alpha=0.88)
    ax.axhline(70, color="#22c55e", linestyle="--", lw=1.3, label="Healthy Threshold (70/100)")
    ax.set_xticks(x)
    ax.set_xticklabels(c_labels, fontsize=8)
    ax.set_ylim(0, 105)
    ax.set_ylabel("Health Score (0–100)", color="#f8fafc", fontsize=9, fontweight="bold")
    ax.set_title("3. Cycle Health Score & Plateau Detection", color="#f8fafc", fontsize=10, fontweight="bold")
    ax.legend(loc="lower right", facecolor="#0b1324", edgecolor="#293b59", labelcolor="#f8fafc", fontsize=8)

    # Panel 4: Delta Improvement Breakdown per Cycle
    ax = axes[1, 1]
    d_pct = [round(post_pcts[i] - pre_pcts[i], 2) for i in range(len(cycles))]
    d_2s = [round(post_2s[i] - pre_2s[i], 2) for i in range(len(cycles))]
    d_3s = [round(post_3s[i] - pre_3s[i], 2) for i in range(len(cycles))]
    ax.axhline(0, color="#94a3b8", lw=1.0)
    ax.bar(x - bw, d_pct, width=bw, color="#facc15", label="Δ Mean Destr %")
    ax.bar(x, d_2s, width=bw, color="#f97316", label="Δ 2★+ TH18 %")
    ax.bar(x + bw, d_3s, width=bw, color="#4ade80", label="Δ 3★ Triple %")
    ax.set_xticks(x)
    ax.set_xticklabels(c_labels, fontsize=8)
    ax.set_ylabel("Verified Metric Delta (Δ%)", color="#f8fafc", fontsize=9, fontweight="bold")
    ax.set_title("4. Verified Effect Size (After − Before) per Intervention", color="#f8fafc", fontsize=10, fontweight="bold")
    ax.legend(loc="best", facecolor="#0b1324", edgecolor="#293b59", labelcolor="#f8fafc", fontsize=8)

    fig.savefig(out_png_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return out_png_path


def sync_recursive_loop_to_vault(loop_state: Dict[str, Any]) -> str:
    """
    Writes the complete Long-Term Memory ledger of the Recursive AI Self-Improvement Loop
    into `obsidian_vault/experiments/Recursive_AI_Improvement_Loop.md` (including every
    cycle's mandatory Pre-Change Baseline Snapshot of Architecture, Reward Function,
    and Hyperparameters, the diagnosed reasons, candidate solutions, and verified results),
    updates the tracker chart PNG, and links it in `00_Index_MOC.md`.
    """
    for d in (VAULT_DIR, EXPERIMENTS_DIR, DECISIONS_DIR, CHARTS_DIR):
        os.makedirs(d, exist_ok=True)

    generate_recursive_loop_chart(loop_state, VAULT_LOOP_CHART_PATH)

    active_cfg = loop_state.get("active_config") or load_active_experiment_config()
    arch_cfg = active_cfg.get("arch_config", DEFAULT_ARCH_CONFIG)
    rew_cfg = active_cfg.get("reward_config", DEFAULT_REWARD_CONFIG)
    hp_cfg = active_cfg.get("hyperparams", DEFAULT_HYPERPARAMS)
    cycles = loop_state.get("cycles", [])

    # 1. Build "What Worked When" Synthesis Table across all cycles
    synthesis_rows = [
        "| Cycle | Episode | Health / Status | Primary Bottleneck Diagnosed | Category | Solution Applied (Exact Parameter Diffs) | Pre → Post Destr % | Pre → Post 2★ TH18 | Pre → Post 3★ | Verdict & Action |",
        "| :---: | :---: | :---: | :--- | :---: | :--- | :---: | :---: | :---: | :---: |",
    ]
    for c in cycles:
        cid = c.get("cycle_id", 1)
        ep = c.get("episode_at_analysis", 0)
        hv = c.get("health_verdict", {})
        status_str = f"`{hv.get('status', 'plateaued').upper()}` ({hv.get('health_score', 0)}/100)"
        reasons = hv.get("reasons", [])
        top_reason = reasons[0]["title"] if reasons else "Consolidation"
        sol = c.get("selected_solution") or {}
        cat = f"`{sol.get('category', 'baseline')}`"
        diffs_short = "; ".join((sol.get("diff_summary") or [])[:3]) or "Baseline documented"
        sol_str = f"**{sol.get('title', 'Baseline Snapshot')}** ({diffs_short})"

        pre_m = c.get("pre_change_snapshot", {}).get("baseline_metrics", {})
        ver = c.get("verification_result")
        if isinstance(ver, dict) and ver.get("post_change_metrics"):
            post_m = ver["post_change_metrics"]
            d = ver.get("metric_deltas", {})
            pct_cell = f"`{pre_m.get('mean_pct_50', 0):.1f}% → {post_m.get('mean_pct_50', 0):.1f}%` (**{d.get('delta_mean_pct_50', 0):+.2f}%**)"
            th_cell = f"`{pre_m.get('two_star_th_rate_50', 0):.1f}% → {post_m.get('two_star_th_rate_50', 0):.1f}%` (**{d.get('delta_two_star_th_rate', 0):+.1f}%**)"
            s3_cell = f"`{pre_m.get('three_star_triple_rate_50', 0):.1f}% → {post_m.get('three_star_triple_rate_50', 0):.1f}%` (**{d.get('delta_three_star_rate', 0):+.1f}%**)"
            verdict_cell = f"**`{ver.get('verdict')}`** ({ver.get('decision_taken')})"
        else:
            pct_cell = f"`{pre_m.get('mean_pct_50', 0):.1f}%` *(Testing...)*"
            th_cell = f"`{pre_m.get('two_star_th_rate_50', 0):.1f}%` *(Testing...)*"
            s3_cell = f"`{pre_m.get('three_star_triple_rate_50', 0):.1f}%` *(Testing...)*"
            verdict_cell = "`TESTING IN PROGRESS`"

        synthesis_rows.append(
            f"| **#{cid}** | `{ep:,}` | {status_str} | {top_reason} | {cat} | {sol_str} | {pct_cell} | {th_cell} | {s3_cell} | {verdict_cell} |"
        )
    synthesis_table = "\n".join(synthesis_rows)

    # 2. Build detailed per-cycle sections (newest first for quick reading, with complete pre-change snapshot!)
    cycle_sections: List[str] = []
    for c in reversed(cycles):
        cid = c.get("cycle_id", 1)
        snap = c.get("pre_change_snapshot", {})
        s_arch = snap.get("arch_config", {})
        s_rew = snap.get("reward_config", {})
        s_hp = snap.get("hyperparams", {})
        s_m = snap.get("baseline_metrics", {})
        hv = c.get("health_verdict", {})
        sol = c.get("selected_solution") or {}
        cands = c.get("candidate_solutions", [])
        ver = c.get("verification_result")

        reasons_md = "\n".join(
            [
                f"- **[{r.get('severity', 'warning').upper()} • `{r.get('category', 'rl')}`] {r.get('title')}**\n"
                f"  - *Quantitative Evidence*: {r.get('symptom')}\n"
                f"  - *Mathematical Root Cause*: {r.get('root_cause')}"
                for r in hv.get("reasons", [])
            ]
        ) or "- Training healthy and progressing."

        cands_md = "\n".join(
            [
                f"{idx+1}. **`[{cand.get('category', '').upper()}]` {cand.get('title')}** "
                f"{'*(✅ SELECTED FOR TESTING)*' if cand.get('solution_id') == sol.get('solution_id') else ''}\n"
                f"   - *Target Bottleneck*: {cand.get('target_problem')}\n"
                f"   - *Rationale*: {cand.get('rationale')}\n"
                f"   - *Exact Parameter Diff*: `{'; '.join(cand.get('diff_summary', [])) or 'No diff'}`\n"
                f"   - *Verification Criterion*: {cand.get('expected_verification_criteria')}"
                for idx, cand in enumerate(cands)
            ]
        )

        if isinstance(ver, dict) and ver.get("post_change_metrics"):
            pm = ver["post_change_metrics"]
            d = ver.get("metric_deltas", {})
            ver_md = f"""#### D. Post-Test Verification Results (`{ver.get('verdict')}` • `{ver.get('decision_taken')}`)
- **Verified At**: `{ver.get('verified_at')}` • **Episodes Tested**: `Ep {ver.get('start_episode', 0):,} → Ep {ver.get('end_episode', 0):,}` (`+{ver.get('episodes_tested', 0)}` episodes)
- **Target Problem Solved**: **`{'YES ✅' if ver.get('problem_solved') else 'NO ❌'}`**
- **Empirical Takeaway**: {ver.get('analysis_summary')}

| Verification Metric | Pre-Change Baseline | Post-Test Result | Verified Delta ($\Delta$) |
| :--- | :---: | :---: | :---: |
| **Recent 50-Ep Mean Destruction %** | `{s_m.get('mean_pct_50', 0):.2f}%` | **`{pm.get('mean_pct_50', 0):.2f}%`** | **`{d.get('delta_mean_pct_50', 0):+.2f}%`** |
| **2★+ Town Hall 18 Takedown Rate** | `{s_m.get('two_star_th_rate_50', 0):.1f}%` | **`{pm.get('two_star_th_rate_50', 0):.1f}%`** | **`{d.get('delta_two_star_th_rate', 0):+.1f}%`** |
| **3★ Triple Wipe Rate** | `{s_m.get('three_star_triple_rate_50', 0):.1f}%` | **`{pm.get('three_star_triple_rate_50', 0):.1f}%`** | **`{d.get('delta_three_star_rate', 0):+.1f}%`** |
| **Mean Episode Return ($R_{50}$)** | `{s_m.get('mean_reward_50', 0):.2f} pts` | **`{pm.get('mean_reward_50', 0):.2f} pts`** | **`{d.get('delta_mean_reward', 0):+.2f} pts`** |
| **Destruction Slope (per 100 ep)** | `{s_m.get('pct_slope_per_100ep', 0):+.2f}%` | **`{pm.get('pct_slope_per_100ep', 0):+.2f}%`** | **`{d.get('delta_pct_slope', 0):+.2f}%`** |
| **Worst Village Destruction %** | `{(s_m.get('worst_village') or {}).get('recent_avg_pct', 0):.1f}%` | **`{(pm.get('worst_village') or {}).get('recent_avg_pct', 0):.1f}%`** | **`{d.get('delta_worst_village_pct', 0):+.1f}%`** |
| **Critic Explained Variance** | `{s_m.get('explained_variance_50', 0)*100:.1f}%` | **`{pm.get('explained_variance_50', 0)*100:.1f}%`** | **`{d.get('delta_explained_variance', 0)*100:+.1f}%`** |"""
        else:
            ver_md = (
                "#### D. Post-Test Verification Results\n"
                "- **Status**: `TESTING IN PROGRESS` — Awaiting completion of verification episode window / next 10-minute cycle check."
            )

        cycle_sections.append(f"""---

### 🔄 Cycle #{cid} — Episode `{c.get('episode_at_analysis', 0):,}` (`{c.get('started_at', '')}`)

- **Trigger**: `{c.get('trigger', 'scheduled_10m')}` • **Diagnostic Engine**: `{hv.get('model_used', 'opencode_argon')}`
- **Health Verdict**: **`{hv.get('status', 'plateaued').upper()}` (`{hv.get('health_score', 0)}/100`)** — {hv.get('headline', '')}
- **Progression Summary**: {hv.get('progression_summary', '')}

#### A. Mandatory Pre-Change Baseline Snapshot (`{snap.get('snapshot_id', '')}`)
*Documented at `{snap.get('documented_at', '')}` on commit `{snap.get('git_commit', '')}` (Checkpoint: `{snap.get('checkpoint_file', '')}`, Episode `{snap.get('cumulative_episode', 0):,}`) BEFORE applying any modification:*

1. **Pre-Change Network Architecture (`CoCActorCritic` v`{s_arch.get('arch_version', '3.0-UNet')}`)**:
   - **Backbone & Dimensions**: `in_channels={s_arch.get('in_channels', 59)}`, `base_ch={s_arch.get('base_ch', 32)}`, `spatial_dim={s_arch.get('spatial_dim', 32)}`, `embed_dim={s_arch.get('embed_dim', 256)}`, `head_hidden_dim={s_arch.get('head_hidden_dim', 128)}` (`{s_arch.get('total_params', 2480299):,}` trainable params)
   - **Spatial Conditioning & Breach Field**: `th_threat_weight={s_arch.get('th_threat_weight', 6.0)}`, `defense_threat_weight={s_arch.get('defense_threat_weight', 1.8)}`, `breach_prior_weight={s_arch.get('breach_prior_weight', 8.0)}`, `spell_combat_prior_weight={s_arch.get('spell_combat_prior_weight', 7.5)}`, `film_cond_scale={s_arch.get('film_cond_scale', 0.5)}`, `tile_logit_scale={s_arch.get('tile_logit_scale', 2.2)}`
   - **Head Logit Temperatures & Per-Head Entropy Weights**: `logit_temp=(type:{s_arch.get('logit_temp_type', 1.4)}, idx:{s_arch.get('logit_temp_idx', 1.6)}, frac:{s_arch.get('logit_temp_frac', 1.4)})`, `reg_ent_weights=(type:{s_arch.get('reg_ent_type_weight', 2.2)}, idx:{s_arch.get('reg_ent_idx_weight', 2.2)}, frac:{s_arch.get('reg_ent_frac_weight', 2.2)}, tile:{s_arch.get('reg_ent_tile_weight', 0.12)})`
2. **Pre-Change Reward Shaping Formulation**:
   - **Formula**: `{snap.get('reward_formula', '')}`
   - **Weights**: `destr_weight={s_rew.get('destr_weight', 0.35)}`, `star_weight={s_rew.get('star_weight', 12.0)}`, `th_bonus={s_rew.get('th_bonus', 14.0)}`, `damage_weight={s_rew.get('damage_weight', 15.0)}`, `funnel_weight={s_rew.get('funnel_weight', 0.08)}`, `high_pct_milestone_75={s_rew.get('high_pct_milestone_75', 0.0)}`, `high_pct_milestone_90={s_rew.get('high_pct_milestone_90', 0.0)}`, `triple_wipe_bonus={s_rew.get('triple_wipe_bonus', 0.0)}`
3. **Pre-Change PPO Hyperparameters**:
   - `lr={s_hp.get('lr', 3e-4)}`, `critic_lr_mult={s_hp.get('critic_lr_mult', 2.5)}`, `batch_episodes={s_hp.get('batch_episodes', 12)}`, `minibatch_size={s_hp.get('minibatch_size', 128)}`, `ppo_epochs={s_hp.get('ppo_epochs', 4)}`, `clip_coef={s_hp.get('clip_coef', 0.2)}`, `ent_coef={s_hp.get('ent_coef', 0.015)}`, `vf_coef={s_hp.get('vf_coef', 0.5)}`, `target_kl={s_hp.get('target_kl', 0.03)}`, `gamma={s_hp.get('gamma', 0.99)}`, `gae_lambda={s_hp.get('gae_lambda', 0.95)}`, `matchup_mode={s_hp.get('matchup_mode', 'random')}`
4. **Pre-Change Baseline Telemetry**:
   - `Mean Destr (50-ep)`: **`{s_m.get('mean_pct_50', 0):.2f}%`** (Peak Rolling-50: `{s_m.get('rolling50_peak_pct', 0):.2f}%`, Slope: `{s_m.get('pct_slope_per_100ep', 0):+.2f}%/100ep`)
   - `Star Conversion Funnel`: `1★+ = {s_m.get('one_star_rate_50', 0):.1f}%` • `2★+ TH18 = {s_m.get('two_star_th_rate_50', 0):.1f}%` (`P(2★|1★) = {(s_m.get('star_funnel') or {}).get('p_2star_given_1star_pct', 0):.1f}%`) • `3★ Triple = {s_m.get('three_star_triple_rate_50', 0):.1f}%` (`P(3★|2★) = {(s_m.get('star_funnel') or {}).get('p_3star_given_2star_pct', 0):.1f}%`)
   - `Critic & Pacing`: `V(s₀) = {s_m.get('critic_v_s0', 0):.2f}` (Gap `{s_m.get('calibration_gap', 0):+.2f}`), `Explained Var = {s_m.get('explained_variance_50', 0)*100:.1f}%`, `NoOp = {s_m.get('mean_noop_pct_50', 0):.1f}%`, `Top-5 Tile Mass = {s_m.get('top5_tile_mass_pct', 0):.1f}%`

#### B. Plateau Root-Cause Diagnosis
{reasons_md}

#### C. Candidate Solutions Proposed & Action Taken
{cands_md}

{ver_md}
""")

    md_content = f"""---
title: "Recursive AI Self-Improvement Loop — Long-Term Memory & Experiment Ledger"
tags:
  - coc-rl
  - recursive-loop
  - self-improvement
  - ppo
  - architecture
  - reward-shaping
updated: "{time.strftime('%Y-%m-%d %H:%M:%S')}"
total_cycles: {len(cycles)}
loop_enabled: {str(bool(loop_state.get('enabled', False))).lower()}
interval_seconds: {int(loop_state.get('interval_seconds', 600))}
---

# ♾️ Recursive AI Self-Improvement Loop — Long-Term Memory Ledger

Back to [[00_Index_MOC|Vault Index (MOC)]] • View [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Model Architecture & Training Canvas]] • Related: [[experiments/AI_Diagnostics_And_Training_Fixes|AI Training Diagnostics]] • [[decisions/Architecture_Decisions_And_System_Memory|System Memory & ADRs]]

---

## 1. Autonomous Loop Overview & Active Configuration

The **Recursive AI Self-Improvement Loop** inspects training telemetry every **`{int(loop_state.get('interval_seconds', 600)) // 60}` minutes** (`{int(loop_state.get('interval_seconds', 600))}s`), determines whether training is healthy or plateaued, diagnoses root causes across **Network Architecture**, **Reward Shaping**, and **PPO Hyperparameters**, **documents the complete pre-change baseline state before every modification**, tests the selected solution, verifies whether the targeted bottleneck was solved, and logs the empirical outcome here for long-term institutional memory.

- **Loop Status**: **`{'ENABLED (AUTONOMOUS 10m TIMER)' if loop_state.get('enabled') else 'READY / ON-DEMAND'}`** • **Current Phase**: `{loop_state.get('phase', 'idle').upper()}`
- **Total Improvement Cycles Logged**: **`{len(cycles)}`**
- **Active Reward Formula**: `{format_reward_formula(rew_cfg)}`
- **Active Architecture Config**: `th_threat={arch_cfg.get('th_threat_weight', 6.0)}`, `breach_prior={arch_cfg.get('breach_prior_weight', 8.0)}`, `spell_prior={arch_cfg.get('spell_combat_prior_weight', 7.5)}`, `film_scale={arch_cfg.get('film_cond_scale', 0.5)}`, `tile_scale={arch_cfg.get('tile_logit_scale', 2.2)}`
- **Active Hyperparameters**: `lr={hp_cfg.get('lr', 3e-4)}`, `critic_lr_mult={hp_cfg.get('critic_lr_mult', 2.5)}`, `batch_episodes={hp_cfg.get('batch_episodes', 12)}`, `ent_coef={hp_cfg.get('ent_coef', 0.015)}`, `vf_coef={hp_cfg.get('vf_coef', 0.5)}`, `matchup_mode={hp_cfg.get('matchup_mode', 'random')}`

![Recursive AI Improvement Loop Progression](../assets/charts/recursive_improvement_loop_tracker.png)

---

## 2. "What Worked When" — Comparative Synthesis Matrix

{synthesis_table}

{"".join(cycle_sections)}
"""
    with open(VAULT_LOOP_NOTE_PATH, "w", encoding="utf-8") as f:
        f.write(md_content)

    return VAULT_LOOP_NOTE_PATH


# ---------------------------------------------------------------------------
# Recursive Loop State Manager & Execution Controller
# ---------------------------------------------------------------------------

def _init_default_loop_state() -> Dict[str, Any]:
    active_cfg = load_active_experiment_config()
    now_ts = time.time()
    return {
        "enabled": False,
        "interval_seconds": 600,
        "auto_apply_and_test": True,
        "test_episodes_per_cycle": 48,
        "provider": "opencode_argon",
        "phase": "idle",
        "is_running_cycle": False,
        "last_check_at": None,
        "last_check_ts": 0.0,
        "next_check_ts": now_ts + 600,
        "next_check_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now_ts + 600)),
        "current_cycle_id": 0,
        "active_hypothesis": None,
        "active_config": active_cfg,
        "vault_note_path": "obsidian_vault/experiments/Recursive_AI_Improvement_Loop.md",
        "cycles": [],
    }


def load_recursive_loop_state() -> Dict[str, Any]:
    os.makedirs(TRAINED_MODELS_DIR, exist_ok=True)
    state = _init_default_loop_state()
    if os.path.exists(LOOP_STATE_PATH):
        try:
            with open(LOOP_STATE_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
            if isinstance(saved, dict):
                state.update(saved)
                state["is_running_cycle"] = False
                if state.get("phase") in ("analyzing", "documenting_baseline", "applying_solution", "verifying_solution"):
                    state["phase"] = "testing_solution" if state.get("active_hypothesis") else ("monitoring" if state.get("enabled") else "idle")
        except Exception:
            pass
    state["active_config"] = load_active_experiment_config()
    return state


def save_recursive_loop_state(state: Dict[str, Any]) -> None:
    os.makedirs(TRAINED_MODELS_DIR, exist_ok=True)
    with _loop_lock:
        with open(LOOP_STATE_PATH, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2)


def run_recursive_improvement_cycle(
    loop_state: Dict[str, Any],
    training_state: Dict[str, Any],
    device: torch.device,
    trigger: str = "scheduled_10m",
    selected_solution_id: Optional[str] = None,
    use_llm: bool = True,
    start_training_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
) -> Dict[str, Any]:
    """
    Executes one full cycle of the Recursive Improvement Loop:
      1. Gathers expanded training telemetry.
      2. If a previous cycle has an unverified `active_hypothesis` and training has advanced
         (or the user triggered verification), verifies the outcome (Before vs After),
         keeps or rolls back the config, and records the result.
      3. Runs plateau & root-cause diagnosis and proposes 3–4 solutions (Architecture, Reward, Hyperparams).
      4. Captures the mandatory Pre-Change Baseline Snapshot BEFORE making any change.
      5. Applies the chosen solution (if plateaued and `auto_apply_and_test` or `selected_solution_id` is set)
         and optionally triggers/updates training to verify the solution.
      6. Syncs all snapshots, actions, and verification results to the Obsidian Vault.
    """
    if loop_state.get("is_running_cycle"):
        return loop_state

    loop_state["is_running_cycle"] = True
    loop_state["phase"] = "analyzing"
    save_recursive_loop_state(loop_state)

    try:
        active_config = load_active_experiment_config()
        loop_state["active_config"] = active_config
        provider = loop_state.get("provider", "opencode_argon")

        telemetry = gather_training_telemetry(
            training_state=training_state,
            device=device,
        )

        cycles: List[Dict[str, Any]] = list(loop_state.get("cycles") or [])

        # Step 1: Verify previous active hypothesis if one was under test
        if cycles and cycles[-1].get("verification_result") is None and cycles[-1].get("selected_solution"):
            last_cycle = cycles[-1]
            pre_ep = int(
                last_cycle.get("pre_change_snapshot", {})
                .get("baseline_metrics", {})
                .get("episode", 0)
            )
            cur_ep = int(
                telemetry.get("session", {}).get("cumulative_episode")
                or telemetry.get("session", {}).get("history_length", 0)
            )
            # Verify if episodes advanced or if explicitly requested
            if cur_ep > pre_ep or trigger in ("verify_now", "post_test_verification", "scheduled_10m"):
                loop_state["phase"] = "verifying_solution"
                ver_res, active_config = verify_solution_outcome(
                    cycle=last_cycle,
                    post_telemetry=telemetry,
                    current_config=active_config,
                )
                last_cycle["verification_result"] = ver_res
                last_cycle["completed_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
                loop_state["active_hypothesis"] = None
                loop_state["active_config"] = active_config

                if trigger == "post_test_verification" and not loop_state.get("enabled"):
                    loop_state["cycles"] = cycles
                    loop_state["phase"] = "idle"
                    now_ts = time.time()
                    interval = int(loop_state.get("interval_seconds", 600))
                    loop_state["last_check_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
                    loop_state["last_check_ts"] = now_ts
                    loop_state["next_check_ts"] = now_ts + interval
                    loop_state["next_check_at"] = time.strftime(
                        "%Y-%m-%d %H:%M:%S", time.localtime(now_ts + interval)
                    )
                    sync_recursive_loop_to_vault(loop_state)
                    save_recursive_loop_state(loop_state)
                    return loop_state

        # Step 2: Diagnose current training state & propose multi-domain solutions
        diag = diagnose_and_propose_solutions(
            telemetry=telemetry,
            active_config=active_config,
            past_cycles=cycles,
            provider=provider,
            use_llm=use_llm,
        )

        # Step 3: Mandatory Pre-Change Baseline Snapshot BEFORE any change
        loop_state["phase"] = "documenting_baseline"
        next_cycle_id = len(cycles) + 1
        pre_snapshot = capture_pre_change_snapshot(
            cycle_id=next_cycle_id,
            telemetry=telemetry,
            active_config=active_config,
        )

        # Step 4: Select & Apply Solution if plateaued (or if a specific solution was requested)
        candidates = diag.get("candidate_solutions", [])
        chosen_solution: Optional[Dict[str, Any]] = None
        if selected_solution_id:
            chosen_solution = next(
                (c for c in candidates if c.get("solution_id") == selected_solution_id),
                candidates[0] if candidates else None,
            )
        elif (diag.get("is_plateaued") or trigger == "manual_trigger") and loop_state.get("auto_apply_and_test", True):
            chosen_solution = candidates[0] if candidates else None

        applied_diffs: List[Dict[str, Any]] = []
        if chosen_solution:
            loop_state["phase"] = "applying_solution"
            new_cfg, applied_diffs = apply_config_patch(
                active_config, chosen_solution.get("config_patch", {})
            )
            active_config = save_active_experiment_config(new_cfg)
            loop_state["active_config"] = active_config
            chosen_solution["applied_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
            chosen_solution["diffs"] = applied_diffs

        cycle_record: Dict[str, Any] = {
            "cycle_id": next_cycle_id,
            "started_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "completed_at": None if chosen_solution else time.strftime("%Y-%m-%d %H:%M:%S"),
            "trigger": trigger,
            "episode_at_analysis": pre_snapshot["cumulative_episode"],
            "health_verdict": {
                "status": diag["status"],
                "health_score": diag["health_score"],
                "is_plateaued": diag["is_plateaued"],
                "headline": diag["headline"],
                "progression_summary": diag["progression_summary"],
                "model_used": diag.get("model_used", provider),
                "reasons": diag["reasons"],
            },
            "pre_change_snapshot": pre_snapshot,
            "candidate_solutions": candidates,
            "selected_solution": chosen_solution,
            "verification_result": None,
        }

        cycles.append(cycle_record)
        loop_state["cycles"] = cycles
        loop_state["current_cycle_id"] = next_cycle_id

        now_ts = time.time()
        interval = max(60, int(loop_state.get("interval_seconds", 600)))
        loop_state["last_check_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        loop_state["last_check_ts"] = now_ts
        loop_state["next_check_ts"] = now_ts + interval
        loop_state["next_check_at"] = time.strftime(
            "%Y-%m-%d %H:%M:%S", time.localtime(now_ts + interval)
        )

        if chosen_solution:
            loop_state["phase"] = "testing_solution"
            loop_state["active_hypothesis"] = {
                "cycle_id": next_cycle_id,
                "solution": chosen_solution,
                "baseline_episode": pre_snapshot["cumulative_episode"],
                "target_episodes": int(loop_state.get("test_episodes_per_cycle", 48)),
                "baseline_metrics": pre_snapshot["baseline_metrics"],
            }
        else:
            loop_state["phase"] = "monitoring" if loop_state.get("enabled") else "idle"
            loop_state["active_hypothesis"] = None

        # Step 5: Log Pre-Change Snapshot + Selected Solution to Obsidian Vault immediately
        sync_recursive_loop_to_vault(loop_state)
        save_recursive_loop_state(loop_state)

        # Step 6: If a solution was applied and training is currently idle, launch verification burst
        if (
            chosen_solution
            and start_training_callback is not None
            and not training_state.get("is_training", False)
            and loop_state.get("auto_apply_and_test", True)
        ):
            start_training_callback(active_config)

        return loop_state
    finally:
        loop_state["is_running_cycle"] = False
        save_recursive_loop_state(loop_state)
