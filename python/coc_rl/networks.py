"""
PyTorch Neural Network Architectures for Clash of Clans TH18 Deep RL:
  1. CoCSpatialEncoder: Dual-pathway Spatial CNN Backbone for the (10, 50, 50) Village Grid
  2. CoCActorCritic: Factorized Multi-Discrete Actor-Critic ([7, 10, 50, 50, 5]) with
     Autoregressive Conditioning, Spatial Tile Pointer, and Invalid-Action Logit Masking
"""

from typing import Dict, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

NEG_INF = -1e8


class CoCSpatialEncoder(nn.Module):
    """
    Dual-pathway Spatial CNN Backbone for the 10x50x50 Village Observation Grid.

    Input tensor `obs` has shape (B, 10, 50, 50):
      - Ch 0: Building HP (normalized)       - Ch 5: Ground attacker HP density
      - Ch 1: Defense DPS threat             - Ch 6: Air attacker HP density
      - Ch 2: Town Hall 18 footprint         - Ch 7: Active Spell zones
      - Ch 3: Wall HP (normalized)           - Ch 8: Allied Unit Type Signature phi(u) in [0, 1]
      - Ch 4: No-Deploy Red Zone mask        - Ch 9: Enemy Unit Type Signature phi(u) in [0, 1]
                                                     (CC, Heroes, Guardians, Ground vs Air Skeletons)

    Outputs two complementary representations:
      1. `spatial_features`: (B, 64, 50, 50) full-resolution feature map preserving exact
         1-to-1 tile alignment for the spatial deployment pointer head.
      2. `global_embedding`: (B, 256) compact tactical state vector summarizing the entire
         battlefield for the action-type, slot-index, and value-critic heads.
    """

    def __init__(
        self,
        in_channels: int = 50,
        subspatial_dim: int = 64,
        spatial_dim: int = 128,
        embed_dim: int = 256,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.spatial_dim = spatial_dim
        self.embed_dim = embed_dim

        # Stage 1: Full-resolution convolutional stem (50x50 -> 50x50)
        # Uses padding=1 to preserve exact tile coordinates and GroupNorm for stable RL updates.
        self.spatial_stem = nn.Sequential(
            nn.Conv2d(
                in_channels,
                subspatial_dim,
                kernel_size=3,
                padding=2,
                dilation=2,
                bias=False,
            ),
            nn.GroupNorm(
                4,
                subspatial_dim,
            ),
            nn.SiLU(),
            nn.Conv2d(
                subspatial_dim,
                subspatial_dim,
                kernel_size=3,
                padding=2,
                dilation=2,
                bias=False,
            ),
            nn.GroupNorm(4, subspatial_dim),
            nn.SiLU(),
            nn.Conv2d(
                subspatial_dim, spatial_dim, kernel_size=3, padding=1, bias=False
            ),
            nn.GroupNorm(8, spatial_dim),
            nn.SiLU(),
        )

        # Stage 2: Dilated residual context block (50x50 -> 50x50, receptive field 11x11)
        # Dilation=2 lets each tile's feature vector see across TH18 wall compartments and
        # overlapping defense ranges without downsampling the 50x50 coordinate grid.
        self.context_res = nn.Sequential(
            nn.Conv2d(
                spatial_dim,
                spatial_dim,
                kernel_size=3,
                padding=1,
                # dilation=2,
                bias=False,
            ),
            nn.GroupNorm(8, spatial_dim),
            nn.SiLU(),
            nn.Conv2d(spatial_dim, spatial_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, spatial_dim),
        )

        # Stage 3: Strided downsampling pyramid (50x50 -> 25x25 -> 13x13 -> 4x4 -> 256-D)
        # Compresses the spatial map into a global battlefield summary vector.
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
        if obs.shape[1] == 50 and self.in_channels == 31:
            # Backward compatibility adapter for legacy 31-channel checkpoints
            adapted = torch.zeros(
                (obs.shape[0], 31, obs.shape[2], obs.shape[3]),
                dtype=obs.dtype,
                device=obs.device,
            )
            adapted[:, 0:5] = obs[:, 0:5]
            ground_idx = [5, 7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 20]
            adapted[:, 5] = torch.clamp(obs[:, ground_idx].sum(dim=1), max=1.0)
            air_idx = [6, 12, 19]
            adapted[:, 6] = torch.clamp(obs[:, air_idx].sum(dim=1), max=1.0)
            adapted[:, 7] = torch.clamp(obs[:, 21:25].max(dim=1).values, max=1.0)
            adapted[:, 8] = torch.clamp(obs[:, 5:21].max(dim=1).values, max=1.0)
            adapted[:, 9] = torch.clamp(obs[:, 25:29].max(dim=1).values, max=1.0)
            adapted[:, 10:31] = obs[:, 29:50]
            obs = adapted
        h = self.spatial_stem(obs)
        spatial_features = F.silu(h + self.context_res(h))
        global_embedding = self.global_tower(spatial_features)
        return spatial_features, global_embedding


DEPLOY_FRACTION_BINS: Tuple[float, ...] = (0.0, 0.25, 0.50, 0.75, 1.00)


def fraction_bin_to_value(bin_idx: int) -> float:
    idx = max(0, min(len(DEPLOY_FRACTION_BINS) - 1, int(bin_idx)))
    return float(DEPLOY_FRACTION_BINS[idx])


def compute_deploy_count(avail_count: int, deploy_fraction: float) -> int:
    if avail_count <= 0:
        return 0
    frac = max(0.0, min(1.0, float(deploy_fraction)))
    return max(1, min(int(avail_count), int(round(avail_count * frac))))


class CoCActorCritic(nn.Module):
    """
    Live Tactical Attacker Network: Factorized Multi-Discrete Actor-Critic.

    Fuses the (B, 10, 50, 50) spatial battlefield tensor with the (B, 64) live available
    army inventory vector (encoding what troops, spells, heroes, equipment, pets, and siege
    machine are available and in what remaining quantity) to parameterize a factorized policy
    over MultiDiscrete([7, 10, 50, 50, 5]):

      1. `slot_type`       (7 choices):  0=NoOp, 1=Troop, 2=Hero, 3=HeroAbility, 4=Siege, 5=PopSiege, 6=Spell
      2. `slot_idx`        (10 choices): Loadout slot index, conditioned on the chosen `slot_type`
      3. `deploy_fraction` (5 bins in [0, 1]): Fraction of remaining available troops of `slot_idx` to deploy
                                         at once (0.0 -> min 1 troop, 0.25 -> 25%, 0.50 -> 50%, 0.75 -> 75%, 1.00 -> all)
      4. `tile_xy`         (2500 tiles): Flattened (tile_y * 50 + tile_x) deployment coordinate,
                                         conditioned on both the 50x50 spatial map and chosen `slot_type`
      5. `value`           (scalar):     Critic state-value estimate V(s)
    """

    def __init__(
        self,
        in_channels: int = 50,
        army_context_dim: int = 64,
        num_fraction_bins: int = 5,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.army_context_dim = army_context_dim
        self.num_fraction_bins = num_fraction_bins

        # Dual-pathway CNN backbone
        self.encoder = CoCSpatialEncoder(
            in_channels=in_channels,
            subspatial_dim=64,
            spatial_dim=128,
            embed_dim=256,
        )
        spatial_dim = self.encoder.spatial_dim  # 128
        embed_dim = self.encoder.embed_dim  # 256

        # Live available army inventory & remaining quantities projection (64-D -> 256-D)
        self.army_context_proj = nn.Sequential(
            nn.Linear(army_context_dim, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.SiLU(),
        )

        # Head 1: Action Type logits (256-D -> 7 action types)
        self.slot_type_head = nn.Linear(embed_dim, 7)

        # Head 2: Army Slot Index logits, conditioned on global_emb + one_hot(slot_type)
        self.slot_idx_head = nn.Sequential(
            nn.Linear(embed_dim + 7, 128),
            nn.SiLU(),
            nn.Linear(128, 10),
        )

        # Head 3: Troop Deployment Fraction logits (bins in [0.0, 0.25, 0.50, 0.75, 1.00]),
        # conditioned on global_emb + one_hot(slot_type) + one_hot(slot_idx)
        self.deploy_fraction_head = nn.Sequential(
            nn.Linear(embed_dim + 7 + 10, 128),
            nn.SiLU(),
            nn.Linear(128, num_fraction_bins),
        )

        # Head 4: Spatial Tile Pointer (projects conditioned embedding onto the spatial map)
        self.tile_cond_proj = nn.Linear(embed_dim + 7, spatial_dim)
        self.tile_conv_head = nn.Sequential(
            nn.Conv2d(spatial_dim, 32, kernel_size=3, padding=1),
            nn.SiLU(),
            nn.Conv2d(32, 1, kernel_size=1),
        )

        # Head 5: State-Value Critic V(s)
        self.critic_head = nn.Sequential(
            nn.Linear(embed_dim, 128),
            nn.SiLU(),
            nn.Linear(128, 1),
        )

    def forward(
        self, obs: torch.Tensor, army_context: Optional[torch.Tensor] = None
    ) -> Dict[str, torch.Tensor]:
        """
        Deterministic forward pass returning raw head outputs for graph tracing (`torchview`).
        """
        B = obs.shape[0]
        spatial_feat, global_emb = self.encoder(obs)

        if army_context is None:
            army_context = obs.reshape(B, -1)[:, : self.army_context_dim] * 0.0
        global_emb = global_emb + self.army_context_proj(army_context)

        # 1. Action Type
        type_logits = self.slot_type_head(global_emb)
        chosen_type = type_logits.argmax(dim=-1)
        type_onehot = F.one_hot(chosen_type.clamp(0, 6), num_classes=7).float()
        cond_emb = torch.cat([global_emb, type_onehot], dim=-1)

        # 2. Conditioned Slot Index
        idx_logits = self.slot_idx_head(cond_emb)
        chosen_idx = idx_logits.argmax(dim=-1)
        idx_onehot = F.one_hot(chosen_idx.clamp(0, 9), num_classes=10).float()

        # 3. Conditioned Troop Deployment Fraction (in [0, 1])
        frac_cond_emb = torch.cat([cond_emb, idx_onehot], dim=-1)
        fraction_logits = self.deploy_fraction_head(frac_cond_emb)

        # 4. Conditioned 50x50 Spatial Tile Pointer
        cond_spatial = self.tile_cond_proj(cond_emb).unsqueeze(-1).unsqueeze(-1)
        fused_spatial = F.silu(spatial_feat + cond_spatial)
        tile_logits = self.tile_conv_head(fused_spatial).reshape(B, 2500)

        # 5. Critic Value V(s)
        value = self.critic_head(global_emb).squeeze(-1)

        return {
            "type_logits": type_logits,
            "idx_logits": idx_logits,
            "fraction_logits": fraction_logits,
            "tile_logits": tile_logits,
            "value": value,
        }

    def get_action_and_value(
        self,
        obs: torch.Tensor,
        masks: Optional[Dict[str, torch.Tensor]] = None,
        action: Optional[torch.Tensor] = None,
        deterministic: bool = False,
        army_context: Optional[torch.Tensor] = None,
    ) -> Tuple[
        torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, Dict[str, torch.Tensor]
    ]:
        """
        Samples or evaluates a factorized action `[slot_type, slot_idx, tile_x, tile_y, frac_bin]`
        with invalid-action logit masking, returning `(action, log_prob, entropy, value, diagnostics)`.
        """
        B = obs.shape[0]
        device = obs.device

        # Encode spatial grid and fuse with live available army inventory context
        spatial_feat, global_emb = self.encoder(obs)
        if army_context is not None:
            global_emb = global_emb + self.army_context_proj(
                army_context.to(device=device, dtype=obs.dtype)
            )

        # 1. Action Type Distribution (0=NoOp is always valid as a fallback)
        # Smooth logit bounding prevents premature discrete-head entropy collapse
        type_logits = 1.4 * torch.tanh(self.slot_type_head(global_emb) / 3.0)
        if masks is not None and "slot_type" in masks:
            type_mask = masks["slot_type"].to(device=device, dtype=torch.bool).clone()
            has_undeployed_units = type_mask[:, 1] | type_mask[:, 2] | type_mask[:, 4]
            has_any_active = type_mask[:, 1:].any(dim=-1)
            if action is None:
                type_mask[:, 0] = (~has_undeployed_units) | (~has_any_active)
            else:
                type_mask[:, 0] = True
            type_logits = type_logits.clone()
            type_logits[:, 0] = torch.where(
                ~has_undeployed_units,
                type_logits[:, 0] + 0.55,
                type_logits[:, 0],
            )
            type_logits = type_logits.masked_fill(~type_mask, NEG_INF)

        type_dist = Categorical(logits=type_logits)
        if action is None:
            chosen_type = (
                type_logits.argmax(dim=-1) if deterministic else type_dist.sample()
            )
        else:
            chosen_type = action[:, 0].long()

        # Condition downstream heads on the chosen action type
        type_onehot = F.one_hot(chosen_type.clamp(0, 6), num_classes=7).float()
        cond_emb = torch.cat([global_emb, type_onehot], dim=-1)

        # 2. Army Slot Index Distribution (masked per chosen_type)
        idx_logits = 1.6 * torch.tanh(self.slot_idx_head(cond_emb) / 3.0)
        if masks is not None and "slot_idx" in masks:
            batch_indices = torch.arange(B, device=device)
            idx_mask = masks["slot_idx"].to(device=device, dtype=torch.bool)[
                batch_indices, chosen_type.clamp(0, 6)
            ]
            all_false = ~idx_mask.any(dim=-1, keepdim=True)
            idx_mask = idx_mask | (
                all_false
                & F.one_hot(torch.zeros(B, dtype=torch.long, device=device), 10).bool()
            )
            idx_logits = idx_logits.masked_fill(~idx_mask, NEG_INF)

        idx_dist = Categorical(logits=idx_logits)
        if action is None:
            chosen_idx = (
                idx_logits.argmax(dim=-1) if deterministic else idx_dist.sample()
            )
        else:
            chosen_idx = action[:, 1].long()

        # 3. Troop Deployment Fraction Distribution (bins in [0.0, 0.25, 0.50, 0.75, 1.00])
        idx_onehot = F.one_hot(chosen_idx.clamp(0, 9), num_classes=10).float()
        frac_cond_emb = torch.cat([cond_emb, idx_onehot], dim=-1)
        frac_logits = 1.4 * torch.tanh(self.deploy_fraction_head(frac_cond_emb) / 3.0)
        frac_dist = Categorical(logits=frac_logits)
        if action is None:
            chosen_frac_bin = (
                frac_logits.argmax(dim=-1) if deterministic else frac_dist.sample()
            )
        else:
            chosen_frac_bin = action[:, 4].long().clamp(0, self.num_fraction_bins - 1)

        # 4. Spatial Tile Distribution (50x50 = 2500 tiles)
        # FiLM-style multiplicative + additive spatial conditioning & multi-scale core/defense proximity focus
        cond_spatial = self.tile_cond_proj(cond_emb).unsqueeze(-1).unsqueeze(-1)
        fused_spatial = F.silu(
            spatial_feat * (1.0 + 0.5 * torch.tanh(cond_spatial)) + cond_spatial
        )
        raw_tile_logits = self.tile_conv_head(fused_spatial).reshape(B, 2500)
        is_spell = (chosen_type == 6).float().unsqueeze(-1)
        threat_field = 0.6 * obs[:, 0:1] + 1.8 * obs[:, 1:2] + 6.0 * obs[:, 2:3]
        breach_stage1 = F.avg_pool2d(threat_field, kernel_size=15, stride=1, padding=7)
        breach_prox = F.avg_pool2d(
            breach_stage1, kernel_size=15, stride=1, padding=7
        ).reshape(B, 2500)
        non_th_defenses = obs[:, 1:2] * (1.0 - obs[:, 2:3])
        combat_focus = F.avg_pool2d(
            1.2 * non_th_defenses + 3.0 * (obs[:, 5:6] + obs[:, 6:7]),
            kernel_size=7,
            stride=1,
            padding=3,
        ).reshape(B, 2500)
        spatial_prior = (1.0 - is_spell) * (8.0 * breach_prox) + is_spell * (
            7.5 * combat_focus
        )
        tile_logits = raw_tile_logits * 2.2 + spatial_prior

        if masks is not None and "tile" in masks:
            valid_green = masks["tile"].to(device=device, dtype=torch.bool)
            needs_green = (chosen_type == 1) | (chosen_type == 2) | (chosen_type == 4)
            allied_units = obs[:, 5:6] + obs[:, 6:7]
            buildings_alive = obs[:, 0:1] + obs[:, 1:2]
            not_th_halo = (
                F.max_pool2d(obs[:, 2:3], kernel_size=7, stride=1, padding=3) < 0.5
            )
            near_allies = (
                F.max_pool2d(allied_units, kernel_size=9, stride=1, padding=4) > 0.01
            )
            near_buildings = (
                F.max_pool2d(buildings_alive, kernel_size=7, stride=1, padding=3) > 0.01
            )
            active_combat_zone = (near_allies & near_buildings & not_th_halo).reshape(
                B, 2500
            )
            has_combat_tiles = active_combat_zone.any(dim=-1, keepdim=True)
            fallback_zone = (near_allies & near_buildings).reshape(B, 2500)
            has_fallback = fallback_zone.any(dim=-1, keepdim=True)
            spell_mask = torch.where(
                has_combat_tiles,
                active_combat_zone,
                torch.where(
                    has_fallback,
                    fallback_zone,
                    torch.ones_like(valid_green, dtype=torch.bool),
                ),
            )

            effective_tile_mask = torch.where(
                needs_green.unsqueeze(-1),
                valid_green,
                spell_mask,
            )
            tile_logits = tile_logits.masked_fill(~effective_tile_mask, NEG_INF)

        tile_dist = Categorical(logits=tile_logits)
        if action is None:
            chosen_tile = (
                tile_logits.argmax(dim=-1) if deterministic else tile_dist.sample()
            )
            tile_x = chosen_tile % 50
            tile_y = torch.div(chosen_tile, 50, rounding_mode="floor")
            out_action = torch.stack(
                [chosen_type, chosen_idx, tile_x, tile_y, chosen_frac_bin], dim=-1
            )
        else:
            tile_x = action[:, 2].long().clamp(0, 49)
            tile_y = action[:, 3].long().clamp(0, 49)
            chosen_tile = tile_y * 50 + tile_x
            out_action = action.long()

        # 5. Joint Log-Probability, Entropy, and Critic Value
        # Sub-actions only contribute to log_prob and entropy when active for `chosen_type`.
        uses_idx = (
            (chosen_type == 1)
            | (chosen_type == 2)
            | (chosen_type == 3)
            | (chosen_type == 6)
        ).float()
        uses_frac = (chosen_type == 1).float()
        uses_tile = (
            (chosen_type == 1)
            | (chosen_type == 2)
            | (chosen_type == 4)
            | (chosen_type == 6)
        ).float()

        log_prob = (
            type_dist.log_prob(chosen_type)
            + uses_idx * idx_dist.log_prob(chosen_idx)
            + uses_frac * frac_dist.log_prob(chosen_frac_bin)
            + uses_tile * tile_dist.log_prob(chosen_tile)
        )
        entropy = (
            type_dist.entropy()
            + uses_idx * idx_dist.entropy()
            + uses_frac * frac_dist.entropy()
            + uses_tile * tile_dist.entropy()
        )
        # Normalized per-head entropy with decoupled coefficients so the 2500-tile spatial head
        # does not drown out discrete head exploration (slot_type, slot_idx, deploy_fraction)
        h_type_norm = type_dist.entropy() / 1.94591
        h_idx_norm = (uses_idx * idx_dist.entropy()) / 2.30259
        h_frac_norm = (uses_frac * frac_dist.entropy()) / 1.60944
        h_tile_norm = (uses_tile * tile_dist.entropy()) / 6.74288
        reg_entropy = (
            2.2 * h_type_norm
            + 2.2 * h_idx_norm
            + 2.2 * h_frac_norm
            + 0.12 * h_tile_norm
        )
        value = self.critic_head(global_emb).squeeze(-1)

        frac_bins_tensor = torch.tensor(
            DEPLOY_FRACTION_BINS, device=device, dtype=torch.float32
        )
        diagnostics = {
            "slot_type_probs": type_dist.probs.detach(),
            "slot_idx_probs": idx_dist.probs.detach(),
            "tile_heatmap": tile_dist.probs.detach().reshape(B, 50, 50),
            "reg_entropy": reg_entropy,
            "h_type": type_dist.entropy().detach(),
            "h_idx": (uses_idx * idx_dist.entropy()).detach(),
            "h_frac": (uses_frac * frac_dist.entropy()).detach(),
            "h_tile": (uses_tile * tile_dist.entropy()).detach(),
            "deploy_fraction_probs": frac_dist.probs.detach(),
            "deploy_fraction": frac_bins_tensor[chosen_frac_bin].detach(),
        }
        return out_action, log_prob, entropy, value, diagnostics
