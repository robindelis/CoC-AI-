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
    Balances continuous damage progression with tactical star objectives.
    """
    delta_dmg_ratio = float(step_info.get("delta_damage_ratio", 0.0))
    delta_pct = int(step_info.get("delta_pct", 0))
    delta_stars = int(step_info.get("delta_stars", 0))
    th_just_destroyed = bool(step_info.get("th_just_destroyed", False))
    invalid_action = bool(step_info.get("invalid_action", False))
    stars = int(step_info.get("stars", 0))
    time_rem = float(step_info.get("time_remaining_ratio", 0.0))

    reward = delta_dmg_ratio * 2.5 + delta_pct * 0.12 + delta_stars * 3.5
    if th_just_destroyed:
        reward += 2.5
    if stars == 3 and delta_stars > 0:
        reward += 5.0 + 3.0 * time_rem
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
    clip_coef: float = 0.2,
    vf_coef: float = 0.5,
    ent_coef: float = 0.01,
    max_grad_norm: float = 0.5,
) -> Dict[str, float]:
    """
    Clipped Proximal Policy Optimization (PPO) Minibatch Update.
    """
    _, new_logprob, entropy, new_value, _ = model.get_action_and_value(
        obs_b, masks=masks_b, action=actions_b
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
