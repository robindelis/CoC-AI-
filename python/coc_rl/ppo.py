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
    Dense & Milestone Reward Shaping for TH18 Combat.
    50/50 balanced weighting between Destruction Percentage (50% max)
    and Stars Earned (50% max).
    - 50.0 points total for 100% destruction (0.50 pt per 1% destruction).
    - 50.0 points total for 3 stars (16.6667 pts per star).
    A complete 100% 3-star wipe achieves 100.0 base reward.
    """
    delta_pct = float(step_info.get("delta_pct", 0))
    delta_stars = float(step_info.get("delta_stars", 0))
    invalid_action = bool(step_info.get("invalid_action", False))

    # 50% for 100% destruction -> 0.50 points per 1%
    pct_reward = delta_pct * 0.50

    # 50% for 3 stars -> 50.0 / 3.0 = 16.6666667 points per star
    stars_reward = delta_stars * (50.0 / 3.0)

    reward = pct_reward + stars_reward

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

    total_pg_loss = 0.0
    total_v_loss = 0.0
    total_ent = 0.0
    total_kl = 0.0
    total_clip = 0.0
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

            _, new_logprob, entropy, new_value, _ = model.get_action_and_value(
                mb_obs, masks=mb_masks, action=mb_act, army_context=mb_ctx
            )

            logratio = new_logprob - mb_old_lp
            ratio = torch.exp(logratio)

            pg_loss1 = -mb_adv * ratio
            pg_loss2 = -mb_adv * torch.clamp(ratio, 1.0 - clip_coef, 1.0 + clip_coef)
            policy_loss = torch.max(pg_loss1, pg_loss2).mean()

            value_loss = 0.5 * F.mse_loss(new_value, mb_ret)
            entropy_loss = entropy.mean()

            loss = policy_loss + vf_coef * value_loss - ent_coef * entropy_loss

            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_grad_norm)
            optimizer.step()

            with torch.no_grad():
                approx_kl = ((ratio - 1.0) - logratio).mean().item()
                clip_frac = ((ratio - 1.0).abs() > clip_coef).float().mean().item()

            total_pg_loss += float(policy_loss.item())
            total_v_loss += float(value_loss.item())
            total_ent += float(entropy_loss.item())
            total_kl += float(approx_kl)
            total_clip += float(clip_frac)
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
