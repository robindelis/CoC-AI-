"""
Production Proximal Policy Optimization (PPO), Generalized Advantage Estimation (GAE),
and Reward Shaping for Clash of Clans TH18 AI Training.
"""

from typing import Any, Dict, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

from .networks import CoCActorCritic


def compute_custom_reward(step_info: Dict[str, Any]) -> float:
    """
    Calibrated 100-Point Dense & Milestone Reward Shaping for TH18 Combat:
      - 50.0 pts total for 100% destruction & HP damage:
          * Destruction Percentage progress: `delta_pct * 0.35` (35.0 pts max)
          * Dense Core & Defense HP damage:  `delta_damage_ratio * 15.0` (15.0 pts max)
      - 50.0 pts total for 3 Stars & Town Hall 18 takedown:
          * Star progression:                `delta_stars * 12.0` (36.0 pts max)
          * Town Hall 18 takedown milestone: `+14.0` on `th_just_destroyed`
      - Spatial funnel cohesion shaping:     `funnel_cohesion * 0.08`
    """
    delta_pct = float(step_info.get("delta_pct", 0))
    delta_stars = float(step_info.get("delta_stars", 0))
    delta_dmg_ratio = float(step_info.get("delta_damage_ratio", 0.0))
    th_just_destroyed = bool(step_info.get("th_just_destroyed", False))
    funnel_cohesion = float(step_info.get("funnel_cohesion", 0.0))
    invalid_action = bool(step_info.get("invalid_action", False))

    pct_reward = delta_pct * 0.35
    dmg_reward = delta_dmg_ratio * 15.0
    stars_reward = delta_stars * 12.0
    th_bonus = 14.0 if th_just_destroyed else 0.0
    cohesion_reward = funnel_cohesion * 0.08

    reward = pct_reward + dmg_reward + stars_reward + th_bonus + cohesion_reward

    if invalid_action:
        reward -= 0.05

    return float(reward)


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

    total_pg_loss = 0.0
    total_v_loss = 0.0
    total_ent = 0.0
    total_kl = 0.0
    total_clip = 0.0
    total_grad_norm = 0.0
    num_updates = 0

    for _epoch in range(max(1, ppo_epochs)):
        perm = torch.randperm(B, device=obs_b.device)
        epoch_kl = 0.0
        epoch_mb = 0

        for start in range(0, B, max(8, minibatch_size)):
            mb_idx = perm[start : start + max(8, minibatch_size)]
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

            optimizer.zero_grad()
            loss.backward()
            grad_norm = nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
            optimizer.step()

            with torch.no_grad():
                approx_kl = ((ratio - 1.0) - logratio).mean().item()
                clip_frac = ((ratio - 1.0).abs() > clip_coef).float().mean().item()

            total_pg_loss += float(policy_loss.item())
            total_v_loss += float(value_loss.item())
            total_ent += float(entropy_loss.item())
            total_kl += float(approx_kl)
            total_clip += float(clip_frac)
            total_grad_norm += float(grad_norm.item()) if hasattr(grad_norm, "item") else float(grad_norm)
            num_updates += 1
            epoch_kl += float(approx_kl)
            epoch_mb += 1

        if target_kl > 0 and (epoch_kl / max(1, epoch_mb)) > target_kl:
            break

    denom = max(1, num_updates)
    return {
        "policy_loss": total_pg_loss / denom,
        "value_loss": total_v_loss / denom,
        "entropy": total_ent / denom,
        "approx_kl": total_kl / denom,
        "clip_fraction": total_clip / denom,
        "grad_norm": total_grad_norm / denom,
        "explained_variance": explained_var,
        "minibatch_updates": num_updates,
    }


def selector_ppo_update_step(
    model: nn.Module,
    optimizer: torch.optim.Optimizer,
    inputs_b: torch.Tensor,
    actions_b: torch.Tensor,
    old_logprobs_b: torch.Tensor,
    returns_b: torch.Tensor,
    clip_coef: float = 0.2,
    vf_coef: float = 0.5,
    ent_coef: float = 0.02,
    max_grad_norm: float = 0.5,
) -> Dict[str, float]:
    """
    Single-step Contextual Bandit PPO update for AttackerArmySelectorNet and DefenderVillageSelectorNet.
    """
    _, new_logprob, entropy, new_value, _ = model.get_action_and_value(
        inputs_b, action=actions_b
    )
    advantages_b = returns_b - new_value.detach()
    if advantages_b.numel() > 1:
        adv = (advantages_b - advantages_b.mean()) / (advantages_b.std(unbiased=False) + 1e-8)
    else:
        adv = advantages_b

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

    return {
        "policy_loss": float(policy_loss.item()),
        "value_loss": float(value_loss.item()),
        "entropy": float(entropy_loss.item()),
    }
