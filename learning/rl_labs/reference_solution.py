"""
Reference PyTorch Implementation for the Clash of Clans TH18 Deep RL Curriculum.
Covers all 4 Labs:
  - Lab 1: CoCSpatialEncoder (10x50x50 Spatial CNN Backbone)
  - Lab 2: CoCActorCritic (Factorized Multi-Discrete Policy + Spatial Pointer + Action Masking)
  - Lab 3: compute_custom_reward & compute_gae (Reward Shaping & Generalized Advantage Estimation)
  - Lab 4: ppo_update_step (Clipped Proximal Policy Optimization Update on GPU)
"""

from typing import Any, Dict, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

NEG_INF = -1e8


class UNetConvBlock(nn.Module):
    """Double 3x3 Convolution Block with GroupNorm(8) and SiLU activation."""

    def __init__(self, in_ch: int, out_ch: int, groups: int = 8):
        super().__init__()
        g = min(groups, out_ch)
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(g, out_ch),
            nn.SiLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(g, out_ch),
            nn.SiLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class UNetUpBlock(nn.Module):
    """3x3 Transposed Conv Upsampling + Skip Connection Concatenation + UNetConvBlock."""

    def __init__(
        self,
        in_ch: int,
        skip_ch: int,
        out_ch: int,
        padding: int = 1,
        output_padding: int = 1,
        groups: int = 8,
    ):
        super().__init__()
        up_ch = in_ch // 2
        g_up = min(groups, up_ch)
        self.up = nn.Sequential(
            nn.ConvTranspose2d(
                in_ch,
                up_ch,
                kernel_size=3,
                stride=2,
                padding=padding,
                output_padding=output_padding,
                bias=False,
            ),
            nn.GroupNorm(g_up, up_ch),
            nn.SiLU(inplace=True),
        )
        self.conv = UNetConvBlock(up_ch + skip_ch, out_ch, groups=groups)

    def forward(self, x: torch.Tensor, skip: torch.Tensor) -> torch.Tensor:
        u = self.up(x)
        if u.shape[-2:] != skip.shape[-2:]:
            u = F.interpolate(u, size=skip.shape[-2:], mode="bilinear", align_corners=False)
        return self.conv(torch.cat([u, skip], dim=1))


class CoCSpatialEncoder(nn.Module):
    """
    Lab 1 Reference: U-Net Contracting-Expansive Spatial Backbone for the 50x50 Village Grid.
    Stage 1 downscales 50x50 -> 25x25 -> 12x12 -> 6x6;
    Stage 2 upscales 6x6 -> 12x12 before feeding into the Global Tower (256-D),
    and upscales completely back to 50x50 with skip connections for grid position selection.
    Produces:
      1. `spatial_features`: (B, spatial_dim, 50, 50) full-resolution U-Net feature map for tile targeting
      2. `global_embedding`: (B, 256) compact tactical summary vector for action-type & critic heads
    """

    def __init__(self, in_channels: int = 10, spatial_dim: int = 64, embed_dim: int = 256, base_ch: int = 32):
        super().__init__()
        self.spatial_dim = spatial_dim
        self.embed_dim = embed_dim

        c1, c2, c3, c4 = base_ch, base_ch * 2, base_ch * 4, base_ch * 8

        # Stage 1: U-Net Contracting (Downscaling) Path (50x50 -> 25x25 -> 12x12 -> 6x6)
        self.enc1 = UNetConvBlock(in_channels, c1)
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)
        self.enc2 = UNetConvBlock(c1, c2)
        self.pool2 = nn.MaxPool2d(kernel_size=2, stride=2)
        self.enc3 = UNetConvBlock(c2, c3)
        self.pool3 = nn.MaxPool2d(kernel_size=2, stride=2)
        self.bottleneck = UNetConvBlock(c3, c4)

        # Stage 2A: Partial Upscale (6x6 -> 12x12 with Skip 3)
        self.up3 = UNetUpBlock(c4, c3, c3, padding=1, output_padding=1)

        # Global Tower from partially upscaled Stage 2 features (12x12 -> 256-D)
        self.global_tower = nn.Sequential(
            nn.Conv2d(c3, c3, kernel_size=3, stride=2, padding=1, bias=False),
            nn.GroupNorm(8, c3),
            nn.SiLU(inplace=True),
            nn.AdaptiveAvgPool2d((1, 1)),
            nn.Flatten(),
            nn.Linear(c3, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.SiLU(inplace=True),
        )

        # Stage 2B: Full Upscale back to 50x50 (12x12 -> 25x25 -> 50x50 with Skips 2 & 1)
        self.up2 = UNetUpBlock(c3, c2, c2, padding=0, output_padding=0)
        self.up1 = UNetUpBlock(c2, c1, spatial_dim, padding=1, output_padding=1)

    def forward(self, obs: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        e1 = self.enc1(obs)                 # (B, 32, 50, 50)
        e2 = self.enc2(self.pool1(e1))      # (B, 64, 25, 25)
        e3 = self.enc3(self.pool2(e2))      # (B, 128, 12, 12)
        b = self.bottleneck(self.pool3(e3)) # (B, 256, 6, 6)

        d3 = self.up3(b, e3)                # (B, 128, 12, 12)
        global_embedding = self.global_tower(d3)  # (B, 256)

        d2 = self.up2(d3, e2)               # (B, 64, 25, 25)
        spatial_features = self.up1(d2, e1) # (B, spatial_dim, 50, 50)
        return spatial_features, global_embedding


class CoCActorCritic(nn.Module):
    """
    Lab 2 Reference: Factorized Multi-Discrete Actor-Critic with Invalid-Action Logit Masking.
    Action space is MultiDiscrete([7, 10, 50, 50]):
      - slot_type (0..6): NoOp, Troop, Hero, HeroAbility, Siege, PopSiege, Spell
      - slot_idx  (0..9): Army loadout slot index
      - tile_xy   (0..2499): Flattened (tile_y * 50 + tile_x) coordinate on the 50x50 map
    """

    def __init__(self, in_channels: int = 10):
        super().__init__()
        self.encoder = CoCSpatialEncoder(in_channels=in_channels, spatial_dim=64, embed_dim=256)

        # Discrete control heads from global tactical embedding
        self.slot_type_head = nn.Linear(256, 7)
        self.slot_idx_head = nn.Sequential(
            nn.Linear(256 + 7, 128),
            nn.SiLU(),
            nn.Linear(128, 10),
        )

        # Spatial pointer head: conditions 50x50 feature map on global embedding + chosen slot_type
        self.tile_cond_proj = nn.Linear(256 + 7, 64)
        self.tile_conv_head = nn.Sequential(
            nn.Conv2d(64, 32, kernel_size=3, padding=1),
            nn.SiLU(),
            nn.Conv2d(32, 1, kernel_size=1),
        )

        # Critic Value Head V(s)
        self.critic_head = nn.Sequential(
            nn.Linear(256, 128),
            nn.SiLU(),
            nn.Linear(128, 1),
        )

    def get_action_and_value(
        self,
        obs: torch.Tensor,
        masks: Optional[Dict[str, torch.Tensor]] = None,
        action: Optional[torch.Tensor] = None,
        deterministic: bool = False,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, Dict[str, torch.Tensor]]:
        """
        Args:
            obs: (B, 10, 50, 50) float32 tensor
            masks: optional dict with:
                - "slot_type": (B, 7) bool
                - "slot_idx": (B, 7, 10) bool
                - "tile": (B, 2500) bool (True = valid green deployment tile outside red zone)
            action: optional (B, 4) int64 tensor [slot_type, slot_idx, tile_x, tile_y]
        Returns:
            action: (B, 4) int64 [slot_type, slot_idx, tile_x, tile_y]
            log_prob: (B,) total joint log-probability
            entropy: (B,) total joint policy entropy
            value: (B,) state value prediction V(s)
            diagnostics: dict with probabilities/heatmaps for visualization
        """
        B = obs.shape[0]
        device = obs.device
        spatial_feat, global_emb = self.encoder(obs)

        # 1. Slot Type Distribution (7 choices)
        type_logits = self.slot_type_head(global_emb)  # (B, 7)
        if masks is not None and "slot_type" in masks:
            type_mask = masks["slot_type"].to(device=device, dtype=torch.bool)
            # Ensure NoOp (index 0) is always available as fallback
            type_mask[:, 0] = True
            type_logits = type_logits.masked_fill(~type_mask, NEG_INF)

        type_dist = Categorical(logits=type_logits)
        if action is None:
            chosen_type = type_logits.argmax(dim=-1) if deterministic else type_dist.sample()
        else:
            chosen_type = action[:, 0].long()

        # One-hot encode chosen_type to condition slot_idx and spatial tile map
        type_onehot = F.one_hot(chosen_type.clamp(0, 6), num_classes=7).float()
        cond_emb = torch.cat([global_emb, type_onehot], dim=-1)  # (B, 263)

        # 2. Slot Index Distribution (10 choices, conditioned on chosen_type)
        idx_logits = self.slot_idx_head(cond_emb)  # (B, 10)
        if masks is not None and "slot_idx" in masks:
            # Gather the 10-element mask row for each batch item's chosen_type
            batch_indices = torch.arange(B, device=device)
            idx_mask = masks["slot_idx"].to(device=device, dtype=torch.bool)[
                batch_indices, chosen_type.clamp(0, 6)
            ]
            # Fallback if a mask row is all False
            all_false = ~idx_mask.any(dim=-1, keepdim=True)
            idx_mask = idx_mask | (all_false & F.one_hot(torch.zeros(B, dtype=torch.long, device=device), 10).bool())
            idx_logits = idx_logits.masked_fill(~idx_mask, NEG_INF)

        idx_dist = Categorical(logits=idx_logits)
        if action is None:
            chosen_idx = idx_logits.argmax(dim=-1) if deterministic else idx_dist.sample()
        else:
            chosen_idx = action[:, 1].long()

        # 3. Spatial Tile Distribution (50x50 = 2500 choices)
        cond_spatial = self.tile_cond_proj(cond_emb).unsqueeze(-1).unsqueeze(-1)  # (B, 64, 1, 1)
        fused_spatial = F.silu(spatial_feat + cond_spatial)
        tile_logits = self.tile_conv_head(fused_spatial).reshape(B, 2500)  # (B, 2500)

        # Red-zone masking applies when deploying Troops (1), Heroes (2), or Siege (4).
        # Spells (6) can be cast anywhere on the 50x50 map!
        if masks is not None and "tile" in masks:
            valid_green = masks["tile"].to(device=device, dtype=torch.bool)  # (B, 2500)
            needs_green = (chosen_type == 1) | (chosen_type == 2) | (chosen_type == 4)
            effective_tile_mask = torch.where(
                needs_green.unsqueeze(-1),
                valid_green,
                torch.ones_like(valid_green, dtype=torch.bool),
            )
            tile_logits = tile_logits.masked_fill(~effective_tile_mask, NEG_INF)

        tile_dist = Categorical(logits=tile_logits)
        if action is None:
            chosen_tile = tile_logits.argmax(dim=-1) if deterministic else tile_dist.sample()
            tile_x = chosen_tile % 50
            tile_y = torch.div(chosen_tile, 50, rounding_mode="floor")
            out_action = torch.stack([chosen_type, chosen_idx, tile_x, tile_y], dim=-1)
        else:
            tile_x = action[:, 2].long().clamp(0, 49)
            tile_y = action[:, 3].long().clamp(0, 49)
            chosen_tile = tile_y * 50 + tile_x
            out_action = action.long()

        # Joint log-probability and entropy
        # Note: tile coordinates only affect the simulation when slot_type in {1, 2, 4, 6}
        uses_tile = ((chosen_type == 1) | (chosen_type == 2) | (chosen_type == 4) | (chosen_type == 6)).float()
        uses_idx = ((chosen_type == 1) | (chosen_type == 2) | (chosen_type == 3) | (chosen_type == 6)).float()

        log_prob = (
            type_dist.log_prob(chosen_type)
            + uses_idx * idx_dist.log_prob(chosen_idx)
            + uses_tile * tile_dist.log_prob(chosen_tile)
        )
        entropy = (
            type_dist.entropy()
            + uses_idx * idx_dist.entropy()
            + uses_tile * tile_dist.entropy()
        )
        value = self.critic_head(global_emb).squeeze(-1)

        diagnostics = {
            "slot_type_probs": type_dist.probs.detach(),
            "slot_idx_probs": idx_dist.probs.detach(),
            "tile_heatmap": tile_dist.probs.detach().reshape(B, 50, 50),
        }
        return out_action, log_prob, entropy, value, diagnostics


def compute_custom_reward(step_info: Dict[str, Any]) -> float:
    """
    Lab 3A Reference: Custom Dense & Milestone Reward Shaping for TH18 Combat.
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
    Lab 3B Reference: Generalized Advantage Estimation (GAE-Lambda).
    Args:
        rewards: (T,) float32 tensor of step rewards
        values: (T,) float32 tensor of critic predictions V(s_t)
        dones: (T,) float32 or bool tensor (1.0 if episode terminated at step t)
        next_value: scalar or (1,) tensor V(s_{T})
    Returns:
        advantages: (T,) float32 tensor
        returns: (T,) float32 tensor (advantages + values)
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
    Lab 4 Reference: Clipped Proximal Policy Optimization (PPO) Minibatch Update.
    """
    # 1. Re-evaluate stored rollout actions under current policy weights
    _, new_logprob, entropy, new_value, _ = model.get_action_and_value(
        obs_b, masks=masks_b, action=actions_b
    )

    # 2. Normalize advantages across the minibatch (zero mean, unit variance) for stable step sizes
    adv = (advantages_b - advantages_b.mean()) / (advantages_b.std(unbiased=False) + 1e-8)

    # 3. Importance-sampling probability ratio r(theta) = exp(log P_new - log P_old) = P_new / P_old
    logratio = new_logprob - old_logprobs_b
    ratio = torch.exp(logratio)

    # 4. Pessimistic clipped surrogate actor loss: zeroes gradient once ratio moves outside [1-eps, 1+eps]
    pg_loss1 = -adv * ratio
    pg_loss2 = -adv * torch.clamp(ratio, 1.0 - clip_coef, 1.0 + clip_coef)
    policy_loss = torch.max(pg_loss1, pg_loss2).mean()

    # 5. Value function critic regression loss (0.5 * MSE against GAE returns)
    value_loss = 0.5 * F.mse_loss(new_value, returns_b)

    # 6. Entropy regularization bonus (subtracted from loss to encourage exploration)
    entropy_loss = entropy.mean()

    total_loss = policy_loss + vf_coef * value_loss - ent_coef * entropy_loss

    # 7. Backpropagate, clip global gradient L2 norm to prevent spikes, and apply Adam update
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
