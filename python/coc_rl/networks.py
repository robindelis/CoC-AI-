"""
Production PyTorch Neural Network Architectures for Clash of Clans TH18 AI:
  - CoCSpatialEncoder: Dual-pathway Spatial CNN Backbone for the 8x50x50 Village Grid
  - CoCActorCritic: Factorized Multi-Discrete Actor-Critic with Invalid-Action Logit Masking
"""

from typing import Dict, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

NEG_INF = -1e8


class CoCSpatialEncoder(nn.Module):
    """
    Dual-pathway Spatial CNN Backbone for the 8x50x50 Village Grid.
    Produces:
      1. `spatial_features`: (B, 64, 50, 50) full-resolution feature map for tile-level targeting
      2. `global_embedding`: (B, 256) compact tactical summary vector for action-type & critic heads
    """

    def __init__(self, in_channels: int = 8, spatial_dim: int = 64, embed_dim: int = 256):
        super().__init__()
        self.spatial_dim = spatial_dim
        self.embed_dim = embed_dim

        self.spatial_stem = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(4, 32),
            nn.SiLU(),
            nn.Conv2d(32, spatial_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, spatial_dim),
            nn.SiLU(),
        )

        self.context_res = nn.Sequential(
            nn.Conv2d(spatial_dim, spatial_dim, kernel_size=3, padding=2, dilation=2, bias=False),
            nn.GroupNorm(8, spatial_dim),
            nn.SiLU(),
            nn.Conv2d(spatial_dim, spatial_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, spatial_dim),
        )

        self.global_tower = nn.Sequential(
            nn.Conv2d(spatial_dim, 96, kernel_size=3, stride=2, padding=1),
            nn.SiLU(),
            nn.Conv2d(96, 128, kernel_size=3, stride=2, padding=1),
            nn.SiLU(),
            nn.AdaptiveAvgPool2d((4, 4)),
            nn.Flatten(),
            nn.Linear(128 * 4 * 4, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.SiLU(),
        )

    def forward(self, obs: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        h = self.spatial_stem(obs)
        spatial_features = F.silu(h + self.context_res(h))
        global_embedding = self.global_tower(spatial_features)
        return spatial_features, global_embedding


class CoCActorCritic(nn.Module):
    """
    Factorized Multi-Discrete Actor-Critic with Invalid-Action Logit Masking.
    Action space is MultiDiscrete([7, 10, 50, 50]):
      - slot_type (0..6): NoOp, Troop, Hero, HeroAbility, Siege, PopSiege, Spell
      - slot_idx  (0..9): Army loadout slot index
      - tile_xy   (0..2499): Flattened (tile_y * 50 + tile_x) coordinate on the 50x50 map
    """

    def __init__(self, in_channels: int = 8):
        super().__init__()
        self.encoder = CoCSpatialEncoder(in_channels=in_channels, spatial_dim=64, embed_dim=256)

        self.slot_type_head = nn.Linear(256, 7)
        self.slot_idx_head = nn.Sequential(
            nn.Linear(256 + 7, 128),
            nn.SiLU(),
            nn.Linear(128, 10),
        )

        self.tile_cond_proj = nn.Linear(256 + 7, 64)
        self.tile_conv_head = nn.Sequential(
            nn.Conv2d(64, 32, kernel_size=3, padding=1),
            nn.SiLU(),
            nn.Conv2d(32, 1, kernel_size=1),
        )

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
        B = obs.shape[0]
        device = obs.device
        spatial_feat, global_emb = self.encoder(obs)

        type_logits = self.slot_type_head(global_emb)
        if masks is not None and "slot_type" in masks:
            type_mask = masks["slot_type"].to(device=device, dtype=torch.bool).clone()
            type_mask[:, 0] = True
            type_logits = type_logits.masked_fill(~type_mask, NEG_INF)

        type_dist = Categorical(logits=type_logits)
        if action is None:
            chosen_type = type_logits.argmax(dim=-1) if deterministic else type_dist.sample()
        else:
            chosen_type = action[:, 0].long()

        type_onehot = F.one_hot(chosen_type.clamp(0, 6), num_classes=7).float()
        cond_emb = torch.cat([global_emb, type_onehot], dim=-1)

        idx_logits = self.slot_idx_head(cond_emb)
        if masks is not None and "slot_idx" in masks:
            batch_indices = torch.arange(B, device=device)
            idx_mask = masks["slot_idx"].to(device=device, dtype=torch.bool)[
                batch_indices, chosen_type.clamp(0, 6)
            ]
            all_false = ~idx_mask.any(dim=-1, keepdim=True)
            idx_mask = idx_mask | (
                all_false & F.one_hot(torch.zeros(B, dtype=torch.long, device=device), 10).bool()
            )
            idx_logits = idx_logits.masked_fill(~idx_mask, NEG_INF)

        idx_dist = Categorical(logits=idx_logits)
        if action is None:
            chosen_idx = idx_logits.argmax(dim=-1) if deterministic else idx_dist.sample()
        else:
            chosen_idx = action[:, 1].long()

        cond_spatial = self.tile_cond_proj(cond_emb).unsqueeze(-1).unsqueeze(-1)
        fused_spatial = F.silu(spatial_feat + cond_spatial)
        tile_logits = self.tile_conv_head(fused_spatial).reshape(B, 2500)

        if masks is not None and "tile" in masks:
            valid_green = masks["tile"].to(device=device, dtype=torch.bool)
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

        uses_tile = (
            (chosen_type == 1) | (chosen_type == 2) | (chosen_type == 4) | (chosen_type == 6)
        ).float()
        uses_idx = (
            (chosen_type == 1) | (chosen_type == 2) | (chosen_type == 3) | (chosen_type == 6)
        ).float()

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
