"""
Production Proximal Policy Optimization (PPO), Generalized Advantage Estimation (GAE),
and Reward Shaping for Clash of Clans TH18 AI Training.
"""

from typing import Any, Dict, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from .networks import CoCActorCritic

DEFAULT_REWARD_CONFIG: Dict[str, float] = {
    "destr_weight": 0.35,
    "star_weight": 12.0,
    "th_bonus": 14.0,
    "damage_weight": 15.0,
    "funnel_weight": 0.08,
    "invalid_penalty": 0.05,
    "early_noop_penalty": 0.02,
    "high_pct_milestone_75": 0.0,
    "high_pct_milestone_90": 0.0,
    "triple_wipe_bonus": 0.0,
    "pacing_wait_bonus": 0.0,
}

DEFAULT_HYPERPARAMS: Dict[str, Any] = {
    "lr": 0.0003,
    "critic_lr_mult": 2.5,
    "batch_episodes": 12,
    "minibatch_size": 128,
    "ppo_epochs": 4,
    "clip_coef": 0.2,
    "ent_coef": 0.015,
    "vf_coef": 0.5,
    "target_kl": 0.03,
    "gamma": 0.99,
    "gae_lambda": 0.95,
    "max_grad_norm": 0.5,
    "ticks_per_step": 8,
    "matchup_mode": "random",
}


def format_reward_formula(cfg: Optional[Dict[str, Any]] = None) -> str:
    rc = dict(DEFAULT_REWARD_CONFIG)
    if isinstance(cfg, dict):
        for k, v in cfg.items():
            if k in rc and v is not None:
                rc[k] = float(v)
    parts = [
        f"{rc['destr_weight']:.2f}·Δ%destr",
        f"{rc['damage_weight']:.1f}·ΔHPratio",
        f"{rc['star_weight']:.1f}·Δstars",
        f"{rc['th_bonus']:.1f}·I(TH18)",
        f"{rc['funnel_weight']:.2f}·C_funnel",
    ]
    if rc.get("high_pct_milestone_75", 0.0) > 0:
        parts.append(f"{rc['high_pct_milestone_75']:.1f}·I(%≥75)")
    if rc.get("high_pct_milestone_90", 0.0) > 0:
        parts.append(f"{rc['high_pct_milestone_90']:.1f}·I(%≥90)")
    if rc.get("triple_wipe_bonus", 0.0) > 0:
        parts.append(f"{rc['triple_wipe_bonus']:.1f}·I(3★)")
    if rc.get("pacing_wait_bonus", 0.0) > 0:
        parts.append(f"{rc['pacing_wait_bonus']:.3f}·I(wait_core)")
    parts.append(f"- {rc['invalid_penalty']:.2f}·I(invalid)")
    return "R_t = " + " + ".join(parts).replace("+ - ", "- ")


def compute_custom_reward_components(
    step_info: Dict[str, Any],
    reward_config: Optional[Dict[str, Any]] = None,
) -> Tuple[float, float, float, float]:
    """
    Calibrated 100-Point Dense & Milestone Reward Shaping for TH18 Combat:
      - 35.0 pts max for Destruction Percentage: delta_pct * destr_weight (0.35)
      - 50.0 pts max for 3 Stars & TH18 milestone: delta_stars * star_weight (12.0) + th_bonus (14.0)
      - 15.0+ pts max for Core HP damage & tactical cohesion: delta_damage_ratio * damage_weight (15.0) + funnel_cohesion * funnel_weight (0.08)

    Returns:
      (total_reward, reward_destr, reward_stars_th, reward_damage_tactical)
    """
    rc = dict(DEFAULT_REWARD_CONFIG)
    if isinstance(reward_config, dict):
        for k, v in reward_config.items():
            if k in rc and v is not None:
                rc[k] = float(v)

    delta_pct = float(step_info.get("delta_pct", 0))
    delta_stars = float(step_info.get("delta_stars", 0))
    delta_dmg_ratio = float(step_info.get("delta_damage_ratio", 0.0))
    th_just_destroyed = bool(step_info.get("th_just_destroyed", False))
    funnel_cohesion = float(step_info.get("funnel_cohesion", 0.0))
    invalid_action = bool(step_info.get("invalid_action", False))

    r_destr = delta_pct * rc["destr_weight"]
    th_bonus = rc["th_bonus"] if th_just_destroyed else 0.0
    r_stars = delta_stars * rc["star_weight"] + th_bonus
    r_damage = delta_dmg_ratio * rc["damage_weight"] + funnel_cohesion * rc["funnel_weight"]
    if invalid_action:
        r_damage -= rc["invalid_penalty"]

    total = r_destr + r_stars + r_damage
    return float(total), float(r_destr), float(r_stars), float(r_damage)


def compute_custom_reward(
    step_info: Dict[str, Any],
    reward_config: Optional[Dict[str, Any]] = None,
) -> float:
    total, _, _, _ = compute_custom_reward_components(step_info, reward_config=reward_config)
    return float(total)


def compute_gae(
    rewards: torch.Tensor,
    values: torch.Tensor,
    dones: torch.Tensor,
    next_value: torch.Tensor,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Generalized Advantage Estimation (GAE-Lambda).
    """
    T = rewards.shape[0]
    advantages = torch.zeros_like(rewards)
    last_gae_lam = torch.zeros((), dtype=rewards.dtype, device=rewards.device)
    next_val = next_value.squeeze()

    for t in reversed(range(T)):
        non_terminal = 1.0 - dones[t].float()
        delta = rewards[t] + gamma * next_val * non_terminal - values[t]
        last_gae_lam = delta + gamma * gae_lambda * non_terminal * last_gae_lam
        advantages[t] = last_gae_lam
        next_val = values[t]

    returns = advantages + values
    return advantages, returns


def ppo_update_step(
    model: CoCActorCritic,
    optimizer: torch.optim.Optimizer,
    obs_b: torch.Tensor,
    actions_b: torch.Tensor,
    old_logprobs_b: torch.Tensor,
    advantages_b: torch.Tensor,
    returns_b: torch.Tensor,
    masks_b: Optional[Dict[str, torch.Tensor]] = None,
    army_context_b: Optional[torch.Tensor] = None,
    clip_coef: float = 0.2,
    vf_coef: float = 0.5,
    ent_coef: float = 0.01,
    max_grad_norm: float = 0.5,
) -> Dict[str, float]:
    """
    Clipped Proximal Policy Optimization (PPO) Minibatch Update.
    """
    _, new_logprob, entropy, new_value, _ = model.get_action_and_value(
        obs_b, masks=masks_b, action=actions_b, army_context=army_context_b
    )

    adv = (advantages_b - advantages_b.mean()) / (advantages_b.std(unbiased=False) + 1e-8)

    logratio = new_logprob - old_logprobs_b
    ratio = torch.exp(logratio)

    pg_loss1 = -adv * ratio
    pg_loss2 = -adv * torch.clamp(ratio, 1.0 - clip_coef, 1.0 + clip_coef)
    policy_loss = torch.max(pg_loss1, pg_loss2).mean()

    value_loss = 0.5 * F.mse_loss(new_value, returns_b)
    entropy_loss = entropy.mean()

    total_loss = policy_loss + vf_coef * value_loss - ent_coef * entropy_loss

    optimizer.zero_grad()
    total_loss.backward()
    nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
    optimizer.step()

    with torch.no_grad():
        approx_kl = ((ratio - 1.0) - logratio).mean().item()
        clip_frac = ((ratio - 1.0).abs() > clip_coef).float().mean().item()

    return {
        "total_loss": float(total_loss.item()),
        "policy_loss": float(policy_loss.item()),
        "value_loss": float(value_loss.item()),
        "entropy": float(entropy_loss.item()),
        "approx_kl": float(approx_kl),
        "clip_fraction": float(clip_frac),
    }


def ppo_minibatch_update(
    model: CoCActorCritic,
    optimizer: torch.optim.Optimizer,
    obs_b: torch.Tensor,
    actions_b: torch.Tensor,
    old_logprobs_b: torch.Tensor,
    advantages_b: torch.Tensor,
    returns_b: torch.Tensor,
    masks_b: Dict[str, torch.Tensor],
    army_context_b: Optional[torch.Tensor] = None,
    ppo_epochs: int = 4,
    minibatch_size: int = 64,
    clip_coef: float = 0.2,
    vf_coef: float = 0.5,
    ent_coef: float = 0.015,
    max_grad_norm: float = 0.5,
    target_kl: float = 0.03,
) -> Dict[str, float]:
    """
    CleanRL / Stable-Baselines3 style Shuffled Minibatch PPO Update with Target-KL Early Stopping.
    - Normalizes advantages across the entire multi-episode rollout buffer `B`.
    - For each epoch in `1..ppo_epochs`, shuffles the `B` transitions and slices into minibatches of `minibatch_size`.
    - Stops early if mean `approx_kl > target_kl` to prevent destructive policy updates.
    """
    B = obs_b.shape[0]
    adv_norm_full = (advantages_b - advantages_b.mean()) / (
        advantages_b.std(unbiased=False) + 1e-8
    )

    with torch.no_grad():
        values_old_b = returns_b - advantages_b
        var_ret = torch.var(returns_b, unbiased=False)
        explained_var = (
            float((1.0 - torch.var(returns_b - values_old_b, unbiased=False) / (var_ret + 1e-8)).item())
            if float(var_ret.item()) > 1e-8
            else 0.0
        )

    device = obs_b.device
    total_pg_loss = torch.zeros((), device=device)
    total_v_loss = torch.zeros((), device=device)
    total_ent = torch.zeros((), device=device)
    total_kl = torch.zeros((), device=device)
    total_clip = torch.zeros((), device=device)
    total_grad_norm = torch.zeros((), device=device)
    num_updates = 0
    mb_step = max(8, minibatch_size)

    for _epoch in range(max(1, ppo_epochs)):
        perm = torch.randperm(B, device=device)
        epoch_kl = torch.zeros((), device=device)
        epoch_mb = 0

        for start in range(0, B, mb_step):
            mb_idx = perm[start : start + mb_step]
            mb_obs = obs_b[mb_idx]
            mb_act = actions_b[mb_idx]
            mb_old_lp = old_logprobs_b[mb_idx]
            mb_adv = adv_norm_full[mb_idx]
            mb_ret = returns_b[mb_idx]
            mb_ctx = army_context_b[mb_idx] if army_context_b is not None else None
            mb_masks = {
                "slot_type": masks_b["slot_type"][mb_idx],
                "slot_idx": masks_b["slot_idx"][mb_idx],
                "tile": masks_b["tile"][mb_idx],
            }

            _, new_logprob, entropy, new_value, diag = model.get_action_and_value(
                mb_obs, masks=mb_masks, action=mb_act, army_context=mb_ctx
            )

            logratio = new_logprob - mb_old_lp
            ratio = torch.exp(logratio)

            pg_loss1 = -mb_adv * ratio
            pg_loss2 = -mb_adv * torch.clamp(ratio, 1.0 - clip_coef, 1.0 + clip_coef)
            policy_loss = torch.max(pg_loss1, pg_loss2).mean()

            value_loss = 0.5 * F.mse_loss(new_value, mb_ret)
            entropy_loss = entropy.mean()
            reg_entropy = diag.get("reg_entropy", entropy).mean()

            loss = policy_loss + vf_coef * value_loss - ent_coef * reg_entropy

            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            grad_norm = nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
            optimizer.step()

            with torch.no_grad():
                approx_kl = ((ratio - 1.0) - logratio).mean()
                clip_frac = ((ratio - 1.0).abs() > clip_coef).float().mean()
                total_pg_loss += policy_loss.detach()
                total_v_loss += value_loss.detach()
                total_ent += entropy_loss.detach()
                total_kl += approx_kl
                total_clip += clip_frac
                total_grad_norm += grad_norm.detach() if isinstance(grad_norm, torch.Tensor) else float(grad_norm)
                epoch_kl += approx_kl

            num_updates += 1
            epoch_mb += 1

        if target_kl > 0 and float((epoch_kl / max(1, epoch_mb)).item()) > target_kl:
            break

    denom = float(max(1, num_updates))
    return {
        "policy_loss": float(total_pg_loss.item()) / denom,
        "value_loss": float(total_v_loss.item()) / denom,
        "entropy": float(total_ent.item()) / denom,
        "approx_kl": float(total_kl.item()) / denom,
        "clip_fraction": float(total_clip.item()) / denom,
        "grad_norm": float(total_grad_norm.item()) / denom,
        "explained_variance": explained_var,
        "minibatch_updates": num_updates,
    }

