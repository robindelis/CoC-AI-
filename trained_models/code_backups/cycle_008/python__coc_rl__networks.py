"""
PyTorch Neural Network Architectures for Clash of Clans TH18 Deep RL:
  1. CoCSpatialEncoder: U-Net Contracting-Expansive Spatial Backbone for the (59, 50, 50) Village Grid
     - Stage 1 (Contracting / Downscaling): 50x50 (32ch) -> 25x25 (64ch) -> 12x12 (128ch) -> 6x6 Bottleneck (256ch)
     - Stage 2 (Expansive / Upscaling):
       * Upscales 6x6 -> 12x12 (128ch with skip connection) before feeding into the Global Tower (256-D) for the 5 heads
       * Continues upscaling 12x12 -> 25x25 (64ch) -> 50x50 (32ch) with skip connections for 50x50 grid position selection
  2. CoCActorCritic: Factorized Multi-Discrete Actor-Critic ([7, 10, 50, 50, 5]) with
     Autoregressive Conditioning, U-Net Spatial Tile Segmentation Head, and Invalid-Action Logit Masking
"""

from typing import Any, Dict, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

NEG_INF = -1e8


class UNetConvBlock(nn.Module):
    """
    Double 3x3 Convolution Block with GroupNorm(8) and SiLU activation:
      2 x (3x3 Conv2d -> GroupNorm(8) -> SiLU)
    Matches the standard U-Net double-conv stage at each spatial resolution scale.
    """

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
        c1 = self.block[0](x)
        h1 = self.block[2](self.block[1](c1).to(c1.dtype))
        c2 = self.block[3](h1)
        return self.block[5](self.block[4](c2).to(c2.dtype))


class UNetUpBlock(nn.Module):
    """
    U-Net Expansive Upsampling Stage:
      1. 3x3 ConvTranspose2d (stride=2) -> GroupNorm(8) -> SiLU (halves channels, doubles resolution)
      2. Concatenates along channel axis with the corresponding Stage 1 Encoder skip tensor
      3. UNetConvBlock (2 x [3x3 Conv2d -> GroupNorm(8) -> SiLU]) to fuse multi-scale features
    """

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
        t = self.up[0](x)
        u = self.up[2](self.up[1](t).to(t.dtype))
        if u.shape[-2:] != skip.shape[-2:]:
            u = F.interpolate(
                u, size=skip.shape[-2:], mode="bilinear", align_corners=False
            )
        fused = torch.cat([u, skip.to(u.dtype)], dim=1)
        return self.conv(fused)


class CoCSpatialEncoder(nn.Module):
    """
    U-Net Contracting-Expansive Spatial Backbone for the 59x50x50 Village Observation Grid.

    Architecture Overview:
      - Stage 1 (Contracting / Downscaling Encoder):
        * `enc1`: (59, 50, 50)  -> (32, 50, 50)   [2x Conv3x3-GN8-SiLU, Skip 1]
        * `pool1` + `enc2`:     -> (64, 25, 25)   [2x2 MaxPool + 2x Conv3x3-GN8-SiLU, Skip 2]
        * `pool2` + `enc3`:     -> (128, 12, 12)  [2x2 MaxPool + 2x Conv3x3-GN8-SiLU, Skip 3]
        * `pool3` + `bottleneck`: -> (256, 6, 6)  [2x2 MaxPool + 2x Conv3x3-GN8-SiLU]

      - Stage 2 (Expansive / Upscaling Decoder & Dual-Branch Split):
        * Partial Upscale (`up3`): (256, 6, 6) + Skip 3 (128, 12, 12) -> `d3` (128, 12, 12)
        * Branch A — `global_tower`: Pools partially upscaled `d3` (128, 12, 12) into
          `global_embedding` (B, 256) to feed the 5 tactical decision heads.
        * Branch B — Full U-Net Upscale for Grid Position Selection:
          - `up2`: `d3` (128, 12, 12) + Skip 2 (64, 25, 25) -> `d2` (64, 25, 25)
          - `up1`: `d2` (64, 25, 25) + Skip 1 (32, 50, 50)  -> `spatial_features` (32, 50, 50)
    """

    def __init__(
        self,
        in_channels: int = 59,
        base_ch: int = 32,
        spatial_dim: int = 32,
        embed_dim: int = 256,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.base_ch = base_ch
        self.spatial_dim = spatial_dim
        self.embed_dim = embed_dim

        c1 = base_ch          # 32
        c2 = base_ch * 2      # 64
        c3 = base_ch * 4      # 128
        c4 = base_ch * 8      # 256

        # Stage 1: U-Net Contracting (Downscaling) Path (50x50 -> 25x25 -> 12x12 -> 6x6)
        self.enc1 = UNetConvBlock(in_channels, c1)
        self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)

        self.enc2 = UNetConvBlock(c1, c2)
        self.pool2 = nn.MaxPool2d(kernel_size=2, stride=2)

        self.enc3 = UNetConvBlock(c2, c3)
        self.pool3 = nn.MaxPool2d(kernel_size=2, stride=2)

        self.bottleneck = UNetConvBlock(c3, c4)

        # Stage 2A: Initial U-Net Upscale (6x6 -> 12x12 with Skip 3)
        # Feeds both the Global Tower (for the 5 heads) and the remaining U-Net decoder path
        self.up3 = UNetUpBlock(
            in_ch=c4, skip_ch=c3, out_ch=c3, padding=1, output_padding=1
        )

        # Global Tower: Branches off from Stage 2's partially upscaled d3 (128x12x12 -> 256-D)
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

        # Stage 2B: Full U-Net Upscaling back to 50x50 for Grid Position Selection (12x12 -> 25x25 -> 50x50)
        # Note: 12x12 with kernel=3, stride=2, pad=0, out_pad=0 produces (12-1)*2 + 3 = 25x25 exact
        self.up2 = UNetUpBlock(
            in_ch=c3, skip_ch=c2, out_ch=c2, padding=0, output_padding=0
        )
        # 25x25 with kernel=3, stride=2, pad=1, out_pad=1 produces (25-1)*2 - 2 + 3 + 1 = 50x50 exact
        self.up1 = UNetUpBlock(
            in_ch=c2, skip_ch=c1, out_ch=spatial_dim, padding=1, output_padding=1
        )

    @property
    def spatial_stem(self) -> nn.Module:
        return self.enc1

    @property
    def context_res(self) -> nn.Module:
        return self.bottleneck

    def forward(self, obs: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        if obs.shape[1] != self.in_channels:
            if obs.shape[1] == 50 and self.in_channels == 59:
                adapted = torch.zeros(
                    (obs.shape[0], 59, obs.shape[2], obs.shape[3]),
                    dtype=obs.dtype,
                    device=obs.device,
                )
                adapted[:, 0:26] = obs[:, 0:26]
                adapted[:, 26] = obs[:, 26]
                adapted[:, 32:34] = obs[:, 27:29]
                adapted[:, 34:55] = obs[:, 29:50]
                obs = adapted
            elif obs.shape[1] == 59 and self.in_channels == 50:
                adapted = torch.zeros(
                    (obs.shape[0], 50, obs.shape[2], obs.shape[3]),
                    dtype=obs.dtype,
                    device=obs.device,
                )
                adapted[:, 0:26] = obs[:, 0:26]
                adapted[:, 26] = obs[:, 26:32].max(dim=1).values
                adapted[:, 27:29] = obs[:, 32:34]
                adapted[:, 29:50] = obs[:, 34:55]
                obs = adapted
            elif obs.shape[1] == 50 and self.in_channels == 31:
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

        # Stage 1: Downscale 50x50 -> 25x25 -> 12x12 -> 6x6
        e1 = self.enc1(obs)               # (B, 32, 50, 50)
        e2 = self.enc2(self.pool1(e1))    # (B, 64, 25, 25)
        e3 = self.enc3(self.pool2(e2))    # (B, 128, 12, 12)
        b = self.bottleneck(self.pool3(e3))  # (B, 256, 6, 6)

        # Stage 2: Upscale a little bit (6x6 -> 12x12) with Skip 3
        d3 = self.up3(b, e3)              # (B, 128, 12, 12)

        # Branch A: Feed partially upscaled Stage 2 features into the Global Tower for the 5 heads
        global_embedding = self.global_tower(d3)  # (B, 256)

        # Branch B: Upscale completely back to 50x50 (12x12 -> 25x25 -> 50x50) for grid position selection
        d2 = self.up2(d3, e2)             # (B, 64, 25, 25)
        spatial_features = self.up1(d2, e1)  # (B, 32, 50, 50)

        return spatial_features.float(), global_embedding.float()


DEPLOY_FRACTION_BINS: Tuple[float, ...] = (0.0, 0.25, 0.50, 0.75, 1.00)

DEFAULT_ARCH_CONFIG: Dict[str, Any] = {
    "arch_version": "3.0-UNet",
    "in_channels": 59,
    "base_ch": 32,
    "spatial_dim": 32,
    "embed_dim": 256,
    "head_hidden_dim": 128,
    "logit_temp_type": 1.4,
    "logit_temp_idx": 1.6,
    "logit_temp_frac": 1.4,
    "tile_logit_scale": 2.2,
    "th_threat_weight": 6.0,
    "defense_threat_weight": 1.8,
    "breach_prior_weight": 8.0,
    "spell_combat_prior_weight": 7.5,
    "film_cond_scale": 0.5,
    "reg_ent_type_weight": 2.2,
    "reg_ent_idx_weight": 2.2,
    "reg_ent_frac_weight": 2.2,
    "reg_ent_tile_weight": 0.12,
}


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
        in_channels: int = 59,
        army_context_dim: int = 64,
        num_fraction_bins: int = 5,
        arch_config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__()
        cfg = dict(DEFAULT_ARCH_CONFIG)
        if isinstance(arch_config, dict):
            cfg.update({k: v for k, v in arch_config.items() if v is not None})
        self.in_channels = in_channels
        self.army_context_dim = army_context_dim
        self.num_fraction_bins = num_fraction_bins

        base_ch = int(cfg.get("base_ch", 32))
        spatial_dim_cfg = int(cfg.get("spatial_dim", 32))
        embed_dim_cfg = int(cfg.get("embed_dim", 256))
        head_hidden_dim = int(cfg.get("head_hidden_dim", 128))
        self.head_hidden_dim = head_hidden_dim

        # Dynamic architectural conditioning & regularization coefficients
        self.logit_temp_type: float = float(cfg.get("logit_temp_type", 1.4))
        self.logit_temp_idx: float = float(cfg.get("logit_temp_idx", 1.6))
        self.logit_temp_frac: float = float(cfg.get("logit_temp_frac", 1.4))
        self.tile_logit_scale: float = float(cfg.get("tile_logit_scale", 2.2))
        self.th_threat_weight: float = float(cfg.get("th_threat_weight", 6.0))
        self.defense_threat_weight: float = float(cfg.get("defense_threat_weight", 1.8))
        self.breach_prior_weight: float = float(cfg.get("breach_prior_weight", 8.0))
        self.spell_combat_prior_weight: float = float(cfg.get("spell_combat_prior_weight", 7.5))
        self.film_cond_scale: float = float(cfg.get("film_cond_scale", 0.5))
        self.reg_ent_type_weight: float = float(cfg.get("reg_ent_type_weight", 2.2))
        self.reg_ent_idx_weight: float = float(cfg.get("reg_ent_idx_weight", 2.2))
        self.reg_ent_frac_weight: float = float(cfg.get("reg_ent_frac_weight", 2.2))
        self.reg_ent_tile_weight: float = float(cfg.get("reg_ent_tile_weight", 0.12))

        # U-Net Contracting-Expansive Spatial Backbone
        self.encoder = CoCSpatialEncoder(
            in_channels=in_channels,
            base_ch=base_ch,
            spatial_dim=spatial_dim_cfg,
            embed_dim=embed_dim_cfg,
        )
        spatial_dim = self.encoder.spatial_dim  # 32
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
            nn.Linear(embed_dim + 7, head_hidden_dim),
            nn.SiLU(),
            nn.Linear(head_hidden_dim, 10),
        )

        # Head 3: Troop Deployment Fraction logits (bins in [0.0, 0.25, 0.50, 0.75, 1.00]),
        # conditioned on global_emb + one_hot(slot_type) + one_hot(slot_idx)
        self.deploy_fraction_head = nn.Sequential(
            nn.Linear(embed_dim + 7 + 10, head_hidden_dim),
            nn.SiLU(),
            nn.Linear(head_hidden_dim, num_fraction_bins),
        )

        # Head 4: Spatial Tile Pointer (projects conditioned embedding onto the spatial map)
        self.tile_cond_proj = nn.Linear(embed_dim + 7 + 10, spatial_dim)
        self.tile_conv_head = nn.Sequential(
            nn.Conv2d(spatial_dim, 32, kernel_size=3, padding=1),
            nn.SiLU(),
            nn.Conv2d(32, 1, kernel_size=1),
        )

        # Head 5: State-Value Critic V(s)
        self.critic_head = nn.Sequential(
            nn.Linear(embed_dim, head_hidden_dim),
            nn.SiLU(),
            nn.Linear(head_hidden_dim, 1),
        )
        self.register_buffer(
            "_frac_bins_tensor",
            torch.tensor(DEPLOY_FRACTION_BINS, dtype=torch.float32),
            persistent=False,
        )

    def apply_arch_config(self, cfg: Optional[Dict[str, Any]]) -> None:
        if not isinstance(cfg, dict):
            return
        for attr in (
            "logit_temp_type",
            "logit_temp_idx",
            "logit_temp_frac",
            "tile_logit_scale",
            "th_threat_weight",
            "defense_threat_weight",
            "breach_prior_weight",
            "spell_combat_prior_weight",
            "film_cond_scale",
            "reg_ent_type_weight",
            "reg_ent_idx_weight",
            "reg_ent_frac_weight",
            "reg_ent_tile_weight",
        ):
            if attr in cfg and cfg[attr] is not None:
                setattr(self, attr, float(cfg[attr]))

    def get_arch_config(self) -> Dict[str, Any]:
        return {
            "arch_version": "3.0-UNet",
            "in_channels": int(self.in_channels),
            "base_ch": int(self.encoder.base_ch),
            "spatial_dim": int(self.encoder.spatial_dim),
            "embed_dim": int(self.encoder.embed_dim),
            "head_hidden_dim": int(getattr(self, "head_hidden_dim", 128)),
            "total_params": int(sum(p.numel() for p in self.parameters())),
            "logit_temp_type": round(float(self.logit_temp_type), 4),
            "logit_temp_idx": round(float(self.logit_temp_idx), 4),
            "logit_temp_frac": round(float(self.logit_temp_frac), 4),
            "tile_logit_scale": round(float(self.tile_logit_scale), 4),
            "th_threat_weight": round(float(self.th_threat_weight), 4),
            "defense_threat_weight": round(float(self.defense_threat_weight), 4),
            "breach_prior_weight": round(float(self.breach_prior_weight), 4),
            "spell_combat_prior_weight": round(float(self.spell_combat_prior_weight), 4),
            "film_cond_scale": round(float(self.film_cond_scale), 4),
            "reg_ent_type_weight": round(float(self.reg_ent_type_weight), 4),
            "reg_ent_idx_weight": round(float(self.reg_ent_idx_weight), 4),
            "reg_ent_frac_weight": round(float(self.reg_ent_frac_weight), 4),
            "reg_ent_tile_weight": round(float(self.reg_ent_tile_weight), 4),
        }

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
        cond_spatial = self.tile_cond_proj(frac_cond_emb).unsqueeze(-1).unsqueeze(-1)
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

        # Encode spatial grid (using BF16 Tensor Cores on CUDA) and fuse with live available army inventory context
        if obs.is_cuda:
            with torch.amp.autocast("cuda", dtype=torch.bfloat16):
                spatial_feat, global_emb = self.encoder(obs)
        else:
            spatial_feat, global_emb = self.encoder(obs)
        if army_context is not None:
            global_emb = global_emb + self.army_context_proj(
                army_context.to(device=device, dtype=global_emb.dtype)
            )

        # 1. Action Type Distribution (0=NoOp is always valid as a fallback)
        # Smooth logit bounding prevents premature discrete-head entropy collapse
        type_logits = self.logit_temp_type * torch.tanh(self.slot_type_head(global_emb) / 3.0)
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
        idx_logits = self.logit_temp_idx * torch.tanh(self.slot_idx_head(cond_emb) / 3.0)
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
        frac_logits = self.logit_temp_frac * torch.tanh(self.deploy_fraction_head(frac_cond_emb) / 3.0)
        frac_dist = Categorical(logits=frac_logits)
        if action is None:
            chosen_frac_bin = (
                frac_logits.argmax(dim=-1) if deterministic else frac_dist.sample()
            )
        else:
            chosen_frac_bin = action[:, 4].long().clamp(0, self.num_fraction_bins - 1)

        # 4. Spatial Tile Distribution (50x50 = 2500 tiles)
        # FiLM-style multiplicative + additive spatial conditioning & multi-scale core/defense proximity focus
        cond_spatial = self.tile_cond_proj(frac_cond_emb).unsqueeze(-1).unsqueeze(-1)
        fused_spatial = F.silu(
            spatial_feat * (1.0 + self.film_cond_scale * torch.tanh(cond_spatial)) + cond_spatial
        )
        raw_tile_logits = self.tile_conv_head(fused_spatial).reshape(B, 2500)
        is_spell = (chosen_type == 6).float().unsqueeze(-1)
        threat_field = (
            0.6 * obs[:, 0:1]
            + self.defense_threat_weight * obs[:, 1:2]
            + self.th_threat_weight * obs[:, 2:3]
        )
        breach_stage1 = F.avg_pool2d(threat_field, kernel_size=15, stride=1, padding=7)
        breach_prox = F.avg_pool2d(
            breach_stage1, kernel_size=15, stride=1, padding=7
        ).reshape(B, 2500)
        non_th_defenses = obs[:, 1:2] * (1.0 - obs[:, 2:3])
        allied_units = obs[:, 5:21].sum(dim=1, keepdim=True).clamp(max=1.0)
        combat_focus = F.avg_pool2d(
            1.2 * non_th_defenses + 3.0 * allied_units,
            kernel_size=7,
            stride=1,
            padding=3,
        ).reshape(B, 2500)
        spatial_prior = (1.0 - is_spell) * (
            self.breach_prior_weight * breach_prox
        ) + is_spell * (self.spell_combat_prior_weight * combat_focus)
        tile_logits = raw_tile_logits * self.tile_logit_scale + spatial_prior

        if masks is not None and "tile" in masks:
            valid_green = masks["tile"].to(device=device, dtype=torch.bool)
            needs_green = (chosen_type == 1) | (chosen_type == 2) | (chosen_type == 4)
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
        e_type = type_dist.entropy()
        e_idx = uses_idx * idx_dist.entropy()
        e_frac = uses_frac * frac_dist.entropy()
        e_tile = uses_tile * tile_dist.entropy()

        entropy = e_type + e_idx + e_frac + e_tile
        # Normalized per-head entropy with decoupled coefficients so the 2500-tile spatial head
        # does not drown out discrete head exploration (slot_type, slot_idx, deploy_fraction)
        h_type_norm = e_type / 1.94591
        h_idx_norm = e_idx / 2.30259
        h_frac_norm = e_frac / 1.60944
        h_tile_norm = e_tile / 6.74288
        reg_entropy = (
            self.reg_ent_type_weight * h_type_norm
            + self.reg_ent_idx_weight * h_idx_norm
            + self.reg_ent_frac_weight * h_frac_norm
            + self.reg_ent_tile_weight * h_tile_norm
        )
        value = self.critic_head(global_emb).squeeze(-1)

        if action is not None:
            diagnostics = {
                "reg_entropy": reg_entropy,
                "h_type": e_type.detach(),
                "h_idx": e_idx.detach(),
                "h_frac": e_frac.detach(),
                "h_tile": e_tile.detach(),
            }
        else:
            diagnostics = {
                "slot_type_probs": type_dist.probs.detach(),
                "slot_idx_probs": idx_dist.probs.detach(),
                "tile_heatmap": tile_dist.probs.detach().reshape(B, 50, 50),
                "reg_entropy": reg_entropy,
                "h_type": e_type.detach(),
                "h_idx": e_idx.detach(),
                "h_frac": e_frac.detach(),
                "h_tile": e_tile.detach(),
                "deploy_fraction_probs": frac_dist.probs.detach(),
                "deploy_fraction": self._frac_bins_tensor[chosen_frac_bin].detach(),
            }
        return out_action, log_prob, entropy, value, diagnostics
