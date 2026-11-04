"""
PyTorch Neural Network Architectures for Clash of Clans TH18 Deep RL (Progressive Evolution Framework):
  1. Stage 0 Baseline (`v4.0-Gen0-TinyCNN`, ~50K params):
     - Bare-minimum 2-layer strided CNN (`50x50 -> 25x25 -> 50x50`) + 1x1 spatial projection head
       for ultra-fast throughput over 5,000-episode evaluation cycles.
  2. Progressive SOTA Vision & Spatial-RL Morphing Building Blocks (Gen 1 -> Gen 5):
     - `TacticalFeatureSynthesizer`: Explicit CoC spatial strategy channels (CoordConv X/Y, TH18 radial
       distance & Siege line-of-sight angle, exterior funnel trash density, active frontline zone).
     - `SEChannelAttention`: Squeeze-and-Excitation dynamic 59-channel defense/troop re-weighting.
     - `DilatedResBlock`: Multi-scale dilated residual context (dilation 2 & 4).
     - `GlobalResponseNorm` & `ConvNeXtV2Block`: 7x7 depthwise ConvNeXt V2 block with GRN to prevent
       feature collapse on sparse defense/unit channels.
     - `SegNeXtMSCABlock`: Multi-Scale Strip Convolutional Attention (1x7 + 7x1 and 1x11 + 11x1)
       capturing axis-aligned wall compartments and Log Launcher / Firespitter corridors.
     - `UNetConvBlock` & `UNetUpBlock`: Full 4-stage contracting-expansive U-Net decoder path.
     - `DualModeSpatialTileHead`: Decoupled Perimeter Funneling Entry vs. Interior Spell Engagement pointer.
  3. `transfer_compatible_weights`: Shape-aware partial & exact weight transfer across architecture morphs.
"""

import json
import os
from typing import Any, Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

NEG_INF = -1e8


def _safe_group_count(channels: int, max_groups: int = 8) -> int:
    """Returns the largest divisor of `channels` that is <= `max_groups` (at least 1)."""
    ch = max(1, int(channels))
    for g in range(min(max_groups, ch), 0, -1):
        if ch % g == 0:
            return g
    return 1


class TacticalFeatureSynthesizer(nn.Module):
    """
    Synthesizes 6 explicit Clash of Clans tactical geometry channels on-the-fly from the
    (B, 59, 50, 50) spatial observation tensor:
      0. Normalized X coordinate in [-1, 1]
      1. Normalized Y coordinate in [-1, 1]
      2. Normalized radial distance to Town Hall 18 (Ch 2) centroid
      3. Normalized angle atan2(dy, dx) / pi to Town Hall 18 (Siege Machine line-of-sight axis)
      4. Exterior Funnel Trash Density (Ch 56..58 Collectors/Storages/Utility outside walls)
      5. Active Frontline Combat Engagement Zone (Allied Units Ch 5..20 overlapping Defenses Ch 1)
    """

    grid_x: torch.Tensor
    grid_y: torch.Tensor

    def __init__(self, grid_size: int = 50):
        super().__init__()
        self.grid_size = grid_size
        coords = torch.linspace(-1.0, 1.0, grid_size, dtype=torch.float32)
        yy, xx = torch.meshgrid(coords, coords, indexing="ij")
        self.register_buffer("grid_x", xx.unsqueeze(0).unsqueeze(0), persistent=False)
        self.register_buffer("grid_y", yy.unsqueeze(0).unsqueeze(0), persistent=False)

    def forward(self, obs: torch.Tensor) -> torch.Tensor:
        B, C, H, W = obs.shape
        gx = self.grid_x.expand(B, 1, H, W).to(dtype=obs.dtype, device=obs.device)
        gy = self.grid_y.expand(B, 1, H, W).to(dtype=obs.dtype, device=obs.device)

        # Town Hall 18 mask is Ch 2
        th_mask = obs[:, 2:3]
        th_sum = th_mask.sum(dim=(-2, -1), keepdim=True).clamp(min=1e-5)
        th_cx = (th_mask * gx).sum(dim=(-2, -1), keepdim=True) / th_sum
        th_cy = (th_mask * gy).sum(dim=(-2, -1), keepdim=True) / th_sum

        dx = gx - th_cx
        dy = gy - th_cy
        th_dist = torch.sqrt(dx * dx + dy * dy + 1e-6) / 1.4142
        th_angle = torch.atan2(dy, dx) / 3.14159265

        # Exterior Funnel Trash Density (non-offensive buildings Ch 56..58)
        if C >= 59:
            trash_raw = obs[:, 56:59].sum(dim=1, keepdim=True).clamp(max=1.0)
        else:
            trash_raw = obs[:, 0:1] * (1.0 - obs[:, 1:2].clamp(max=1.0))
        wall_ring = F.avg_pool2d(obs[:, 3:4], kernel_size=5, stride=1, padding=2)
        funnel_trash = F.avg_pool2d(
            trash_raw * (1.0 - 0.5 * wall_ring.clamp(max=1.0)),
            kernel_size=3,
            stride=1,
            padding=1,
        )

        # Active Frontline Combat Zone (Allied Units Ch 5..20 near Defenses Ch 1)
        allies = obs[:, 5:21].sum(dim=1, keepdim=True).clamp(max=1.0) if C >= 21 else obs[:, 0:1] * 0.0
        allies_blur = F.avg_pool2d(allies, kernel_size=5, stride=1, padding=2)
        def_blur = F.avg_pool2d(obs[:, 1:2], kernel_size=5, stride=1, padding=2)
        frontline_zone = (allies_blur * def_blur).clamp(max=1.0)

        tactical_feats = torch.cat(
            [gx, gy, th_dist, th_angle, funnel_trash, frontline_zone], dim=1
        )
        return torch.cat([obs, tactical_feats.to(obs.dtype)], dim=1)


class GlobalResponseNorm(nn.Module):
    """
    ConvNeXt V2 Global Response Normalization (GRN):
    Normalizes channel responses by global L2 norm to prevent dead/collapsed channels
    across sparse 59-channel defense and troop maps.
    """

    def __init__(self, channels: int, eps: float = 1e-6):
        super().__init__()
        self.eps = eps
        self.gamma = nn.Parameter(torch.zeros(1, channels, 1, 1))
        self.beta = nn.Parameter(torch.zeros(1, channels, 1, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        gx = torch.norm(x.float(), p=2, dim=(-2, -1), keepdim=True)
        nx = gx / (gx.mean(dim=1, keepdim=True) + self.eps)
        out = self.gamma.to(x.dtype) * (x * nx.to(x.dtype)) + self.beta.to(x.dtype) + x
        return out


class ConvNeXtV2Block(nn.Module):
    """
    ConvNeXt V2 7x7 Depthwise Separable Block with Global Response Normalization (GRN):
    Captures 7x7 medium-range weapon radii (Wizard Tower, Bomb Tower, Royal Champion)
    with minimal parameter overhead.
    """

    def __init__(self, channels: int, expansion: int = 2, groups: int = 8):
        super().__init__()
        g = _safe_group_count(channels, groups)
        mid = max(channels, channels * expansion)
        self.dwconv = nn.Conv2d(
            channels, channels, kernel_size=7, padding=3, groups=channels, bias=False
        )
        self.norm = nn.GroupNorm(g, channels)
        self.pwconv1 = nn.Conv2d(channels, mid, kernel_size=1, bias=True)
        self.act = nn.SiLU(inplace=True)
        self.grn = GlobalResponseNorm(mid)
        self.pwconv2 = nn.Conv2d(mid, channels, kernel_size=1, bias=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        h = self.dwconv(x)
        h = self.norm(h).to(x.dtype)
        h = self.act(self.pwconv1(h))
        h = self.grn(h)
        h = self.pwconv2(h)
        return residual + h


class SegNeXtMSCABlock(nn.Module):
    """
    SegNeXt Multi-Scale Convolutional Attention (MSCA) Block:
    Uses factorized depthwise strip convolutions (1x7 + 7x1 and 1x11 + 11x1)
    to model orthogonal CoC wall compartments, funneling lanes, and long-range
    X-Bow / Monolith / Eagle / Log Launcher corridors.
    """

    def __init__(self, channels: int):
        super().__init__()
        self.dw_local = nn.Conv2d(
            channels, channels, kernel_size=5, padding=2, groups=channels, bias=False
        )
        self.strip7_h = nn.Conv2d(
            channels, channels, kernel_size=(1, 7), padding=(0, 3), groups=channels, bias=False
        )
        self.strip7_v = nn.Conv2d(
            channels, channels, kernel_size=(7, 1), padding=(3, 0), groups=channels, bias=False
        )
        self.strip11_h = nn.Conv2d(
            channels, channels, kernel_size=(1, 11), padding=(0, 5), groups=channels, bias=False
        )
        self.strip11_v = nn.Conv2d(
            channels, channels, kernel_size=(11, 1), padding=(5, 0), groups=channels, bias=False
        )
        self.mixer = nn.Conv2d(channels, channels, kernel_size=1, bias=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        u = self.dw_local(x)
        b7 = self.strip7_v(self.strip7_h(u))
        b11 = self.strip11_v(self.strip11_h(u))
        attn = torch.sigmoid(self.mixer(u + b7 + b11))
        return x * attn


class UNetConvBlock(nn.Module):
    """
    Double 3x3 Convolution Block with GroupNorm(8) and SiLU activation:
      2 x (3x3 Conv2d -> GroupNorm(8) -> SiLU)
    Matches the standard U-Net double-conv stage at each spatial resolution scale.
    """

    def __init__(self, in_ch: int, out_ch: int, groups: int = 8):
        super().__init__()
        g = _safe_group_count(out_ch, groups)
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
        h2 = self.block[5](self.block[4](c2).to(c2.dtype))
        return h1 + h2


class TinySingleConvBlock(nn.Module):
    """
    Lightweight Single 3x3 Convolution Block for Stage 0 (`v4.0-Gen0-TinyCNN`):
      1 x (3x3 Conv2d -> GroupNorm -> SiLU)
    Provides ultra-fast feature extraction while keeping total model parameters ~50K.
    """

    def __init__(self, in_ch: int, out_ch: int, groups: int = 4):
        super().__init__()
        g = _safe_group_count(out_ch, groups)
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(g, out_ch),
            nn.SiLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        c1 = self.block[0](x)
        return self.block[2](self.block[1](c1).to(c1.dtype))


class TinySkipUpBlock(nn.Module):
    """
    Lightweight Bilinear Upsampling + Skip Fusion Block for Stage 0 (`v4.0-Gen0-TinyCNN`):
    Upsamples 25x25 -> 50x50, concatenates the 50x50 encoder skip tensor, and fuses via 3x3 Conv.
    """

    def __init__(self, in_ch: int, skip_ch: int, out_ch: int, groups: int = 4):
        super().__init__()
        g = _safe_group_count(out_ch, groups)
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch + skip_ch, out_ch, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(g, out_ch),
            nn.SiLU(inplace=True),
        )

    def forward(self, x: torch.Tensor, skip: torch.Tensor) -> torch.Tensor:
        u = F.interpolate(
            x, size=skip.shape[-2:], mode="bilinear", align_corners=False
        )
        fused = torch.cat([u, skip.to(u.dtype)], dim=1)
        c = self.conv[0](fused)
        return self.conv[2](self.conv[1](c).to(c.dtype))


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
        up_ch = max(4, in_ch // 2)
        g_up = _safe_group_count(up_ch, groups)
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


class SEChannelAttention(nn.Module):
    """
    Squeeze-and-Excitation (SE) Channel Attention Block:
    Dynamically re-weights the 59-channel / multi-scale defense & unit feature maps
    based on global village layout context.
    """

    def __init__(self, channels: int, reduction: int = 4):
        super().__init__()
        mid = max(8, channels // reduction)
        self.fc = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(channels, mid),
            nn.SiLU(inplace=True),
            nn.Linear(mid, channels),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        w = self.fc(x).unsqueeze(-1).unsqueeze(-1)
        return x * w.to(x.dtype)


class DilatedResBlock(nn.Module):
    """
    Multi-Scale Dilated Residual Context Block (dilation=2 and dilation=4):
    Expands spatial receptive field across TH18 multi-compartment wall & defense rings
    while preserving exact spatial resolution.
    """

    def __init__(self, channels: int, groups: int = 8):
        super().__init__()
        g = _safe_group_count(channels, groups)
        self.block = nn.Sequential(
            nn.Conv2d(channels, channels, kernel_size=3, padding=2, dilation=2, bias=False),
            nn.GroupNorm(g, channels),
            nn.SiLU(inplace=True),
            nn.Conv2d(channels, channels, kernel_size=3, padding=4, dilation=4, bias=False),
            nn.GroupNorm(g, channels),
        )
        self.act = nn.SiLU(inplace=True)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        c1 = self.block[0](x)
        h1 = self.block[2](self.block[1](c1).to(c1.dtype))
        c2 = self.block[3](h1)
        h2 = self.block[4](c2).to(c2.dtype)
        return self.act(x + h2)


class CoCSpatialEncoder(nn.Module):
    """
    Evolvable Spatial Backbone for the 59x50x50 Village Observation Grid.

    Supports progressive architectural morphing from Stage 0 (`tiny_cnn`, ~50K total model params)
    through SOTA Vision & Spatial-RL stages (`coord_se_res`, `convnext_v2`, `segnext_msca`, `unet`):
      - Stage 0 (`backbone_type="tiny_cnn"`, `use_unet_decoder=False`):
        * `enc1`: (59, 50, 50) -> (base_ch, 50, 50) [Single 3x3 Conv + GN + SiLU]
        * `pool1` + `enc2`: -> (c2, 25, 25) [2x2 MaxPool + 3x3 Conv + GN + SiLU]
        * `global_tower`: (c2, 25, 25) -> `global_embedding` (B, embed_dim)
        * `up1`: Bilinear Upsample (25x25 -> 50x50) + Skip 1 -> `spatial_features` (B, spatial_dim, 50, 50)
      - Evolved Stages (`use_coord_features`, `use_se_attention`, `use_convnext_grn`, `use_segnext_msca`, `use_unet_decoder`):
        * Adds explicit CoC tactical strategy coordinate channels, SE attention, ConvNeXt V2 7x7 GRN blocks,
          SegNeXt Multi-Scale Strip Attention, and/or full 4-stage U-Net contracting-expansive pathways.
    """

    def __init__(
        self,
        in_channels: int = 59,
        base_ch: int = 24,
        spatial_dim: int = 24,
        embed_dim: int = 96,
        backbone_type: str = "coord_se_res",
        use_coord_features: bool = True,
        use_dilated_context: bool = False,
        use_se_attention: bool = True,
        use_convnext_grn: bool = False,
        use_segnext_msca: bool = False,
        use_unet_decoder: bool = False,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.base_ch = base_ch
        self.spatial_dim = spatial_dim
        self.embed_dim = embed_dim
        self.backbone_type = str(backbone_type or "coord_se_res")
        self.use_coord_features = bool(use_coord_features)
        self.use_dilated_context = bool(use_dilated_context)
        self.use_se_attention = bool(use_se_attention)
        self.use_convnext_grn = bool(use_convnext_grn)
        self.use_segnext_msca = bool(use_segnext_msca)
        self.use_unet_decoder = bool(use_unet_decoder or self.backbone_type == "unet")

        self.tactical_synth = TacticalFeatureSynthesizer() if self.use_coord_features else None
        effective_in_ch = in_channels + (6 if self.use_coord_features else 0)

        c1 = base_ch
        c2 = int(round(base_ch * 1.6)) if (self.backbone_type == "tiny_cnn" and not self.use_unet_decoder) else (base_ch * 2)
        c2 = max(16, (c2 // 4) * 4)

        if self.use_unet_decoder:
            c3 = base_ch * 4
            c4 = base_ch * 8
            self.enc1 = UNetConvBlock(effective_in_ch, c1)
            self.stem_se = SEChannelAttention(c1) if self.use_se_attention else None
            self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)
            self.enc2 = UNetConvBlock(c1, c2)
            self.dilated_context = DilatedResBlock(c2) if self.use_dilated_context else None
            self.convnext_block = ConvNeXtV2Block(c2) if self.use_convnext_grn else None
            self.msca_block = SegNeXtMSCABlock(c2) if self.use_segnext_msca else None
            self.pool2 = nn.MaxPool2d(kernel_size=2, stride=2)

            self.enc3 = UNetConvBlock(c2, c3)
            self.pool3 = nn.MaxPool2d(kernel_size=2, stride=2)

            self.bottleneck = UNetConvBlock(c3, c4)
            self.bottleneck_se = SEChannelAttention(c4) if self.use_se_attention else None

            self.up3 = UNetUpBlock(
                in_ch=c4, skip_ch=c3, out_ch=c3, padding=1, output_padding=1
            )
            g_tower = _safe_group_count(c3, 8)
            self.global_tower = nn.Sequential(
                nn.Conv2d(c3, c3, kernel_size=3, stride=2, padding=1, bias=False),
                nn.GroupNorm(g_tower, c3),
                nn.SiLU(inplace=True),
                nn.AdaptiveAvgPool2d((1, 1)),
                nn.Flatten(),
                nn.Linear(c3, embed_dim),
                nn.LayerNorm(embed_dim),
                nn.SiLU(inplace=True),
            )
            self.up2 = UNetUpBlock(
                in_ch=c3, skip_ch=c2, out_ch=c2, padding=0, output_padding=0
            )
            self.up1 = UNetUpBlock(
                in_ch=c2, skip_ch=c1, out_ch=spatial_dim, padding=1, output_padding=1
            )
            self.spatial_se = SEChannelAttention(spatial_dim) if self.use_se_attention else None
        else:
            # Lightweight 2-Stage Strided CNN Pathway (Gen 0 TinyCNN ~50K params -> Gen 1..3 Mid-Scale)
            is_tiny = (
                self.backbone_type == "tiny_cnn"
                and not self.use_dilated_context
                and not self.use_convnext_grn
                and not self.use_segnext_msca
            )
            self.enc1 = (
                TinySingleConvBlock(effective_in_ch, c1)
                if is_tiny
                else UNetConvBlock(effective_in_ch, c1)
            )
            self.stem_se = SEChannelAttention(c1) if self.use_se_attention else None
            self.pool1 = nn.MaxPool2d(kernel_size=2, stride=2)
            self.enc2 = (
                TinySingleConvBlock(c1, c2)
                if is_tiny
                else UNetConvBlock(c1, c2)
            )
            self.dilated_context = DilatedResBlock(c2) if self.use_dilated_context else None
            self.convnext_block = ConvNeXtV2Block(c2) if self.use_convnext_grn else None
            self.msca_block = SegNeXtMSCABlock(c2) if self.use_segnext_msca else None
            self.bottleneck = self.enc2
            self.bottleneck_se = SEChannelAttention(c2) if self.use_se_attention else None

            g_tower = _safe_group_count(c2, 8)
            self.global_tower = nn.Sequential(
                nn.Conv2d(c2, c2, kernel_size=3, stride=2, padding=1, bias=False),
                nn.GroupNorm(g_tower, c2),
                nn.SiLU(inplace=True),
                nn.AdaptiveAvgPool2d((1, 1)),
                nn.Flatten(),
                nn.Linear(c2, embed_dim),
                nn.LayerNorm(embed_dim),
                nn.SiLU(inplace=True),
            )
            self.up1 = TinySkipUpBlock(in_ch=c2, skip_ch=c1, out_ch=spatial_dim)
            self.spatial_se = SEChannelAttention(spatial_dim) if self.use_se_attention else None

    @property
    def spatial_stem(self) -> nn.Module:
        return self.enc1

    @property
    def context_res(self) -> nn.Module:
        return self.bottleneck

    def _adapt_input_channels(self, obs: torch.Tensor) -> torch.Tensor:
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
        return obs

    def forward(self, obs: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        obs = self._adapt_input_channels(obs)
        x = self.tactical_synth(obs) if self.tactical_synth is not None else obs

        if self.use_unet_decoder:
            e1 = self.enc1(x)
            if self.stem_se is not None:
                e1 = self.stem_se(e1)
            e2 = self.enc2(self.pool1(e1))
            if self.dilated_context is not None:
                e2 = self.dilated_context(e2)
            if self.convnext_block is not None:
                e2 = self.convnext_block(e2)
            if self.msca_block is not None:
                e2 = self.msca_block(e2)
            e3 = self.enc3(self.pool2(e2))
            b = self.bottleneck(self.pool3(e3))
            if self.bottleneck_se is not None:
                b = self.bottleneck_se(b)

            d3 = self.up3(b, e3)
            global_embedding = self.global_tower(d3)
            d2 = self.up2(d3, e2)
            spatial_features = self.up1(d2, e1)
            if self.spatial_se is not None:
                spatial_features = self.spatial_se(spatial_features)
            return spatial_features.float(), global_embedding.float()

        # Fast 2-Stage Strided CNN + Skip Upsample Path (Stage 0 TinyCNN & Mid-Scale Evolutions)
        e1 = self.enc1(x)                   # (B, c1, 50, 50)
        if self.stem_se is not None:
            e1 = self.stem_se(e1)
        e2 = self.enc2(self.pool1(e1))      # (B, c2, 25, 25)
        if self.dilated_context is not None:
            e2 = self.dilated_context(e2)
        if self.convnext_block is not None:
            e2 = self.convnext_block(e2)
        if self.msca_block is not None:
            e2 = self.msca_block(e2)
        if self.bottleneck_se is not None:
            e2 = self.bottleneck_se(e2)

        global_embedding = self.global_tower(e2)   # (B, embed_dim)
        spatial_features = self.up1(e2, e1)        # (B, spatial_dim, 50, 50)
        if self.spatial_se is not None:
            spatial_features = self.spatial_se(spatial_features)

        return spatial_features.float(), global_embedding.float()


DEPLOY_FRACTION_BINS: Tuple[float, ...] = (0.0, 0.25, 0.50, 0.75, 1.00)

GEN0_BASELINE_ARCH_CONFIG: Dict[str, Any] = {
    "arch_version": "v4.0-Gen0-TinyCNN",
    "generation": 0,
    "backbone_type": "tiny_cnn",
    "weight_transfer_mode": "scratch_restart",
    "in_channels": 59,
    "base_ch": 20,
    "spatial_dim": 20,
    "embed_dim": 64,
    "head_hidden_dim": 48,
    "use_coord_features": False,
    "use_dilated_context": False,
    "use_se_attention": False,
    "use_convnext_grn": False,
    "use_segnext_msca": False,
    "use_unet_decoder": False,
    "use_dual_spatial_head": False,
    "use_gated_heads": False,
    "critic_depth": 2,
    "logit_temp_type": 1.4,
    "logit_temp_idx": 1.6,
    "logit_temp_frac": 1.4,
    "tile_logit_scale": 2.2,
    "th_threat_weight": 9.5,
    "defense_threat_weight": 1.8,
    "breach_prior_weight": 11.0,
    "spell_combat_prior_weight": 7.5,
    "film_cond_scale": 0.8,
    "reg_ent_type_weight": 2.0,
    "reg_ent_idx_weight": 2.0,
    "reg_ent_frac_weight": 2.0,
    "reg_ent_tile_weight": 0.14,
}

GEN1_COORDSE_ARCH_CONFIG: Dict[str, Any] = {
    "arch_version": "v4.1-Gen1-CoordSE-ResCNN",
    "generation": 1,
    "backbone_type": "coord_se_res",
    "weight_transfer_mode": "warm_start",
    "in_channels": 59,
    "base_ch": 24,
    "spatial_dim": 24,
    "embed_dim": 96,
    "head_hidden_dim": 64,
    "use_coord_features": True,
    "use_dilated_context": False,
    "use_se_attention": True,
    "use_convnext_grn": False,
    "use_segnext_msca": False,
    "use_unet_decoder": False,
    "use_dual_spatial_head": False,
    "use_gated_heads": False,
    "critic_depth": 2,
    "logit_temp_type": 1.4,
    "logit_temp_idx": 1.6,
    "logit_temp_frac": 1.4,
    "tile_logit_scale": 2.8,
    "th_threat_weight": 9.5,
    "defense_threat_weight": 2.2,
    "breach_prior_weight": 11.5,
    "spell_combat_prior_weight": 10.1,
    "film_cond_scale": 0.85,
    "reg_ent_type_weight": 2.4,
    "reg_ent_idx_weight": 2.0,
    "reg_ent_frac_weight": 2.0,
    "reg_ent_tile_weight": 0.1,
    "total_params": 130268,
}

GEN2_SEGNEXT_MSCA_ARCH_CONFIG: Dict[str, Any] = {
    "arch_version": "v4-SegNeXt-MSCA-CompartmentNet",
    "generation": 2,
    "backbone_type": "segnext_msca",
    "weight_transfer_mode": "warm_start",
    "in_channels": 59,
    "base_ch": 28,
    "spatial_dim": 28,
    "embed_dim": 128,
    "head_hidden_dim": 96,
    "use_coord_features": True,
    "use_dilated_context": True,
    "use_se_attention": True,
    "use_convnext_grn": False,
    "use_segnext_msca": True,
    "use_unet_decoder": False,
    "use_dual_spatial_head": False,
    "use_gated_heads": True,
    "critic_depth": 2,
    "logit_temp_type": 1.4,
    "logit_temp_idx": 1.6,
    "logit_temp_frac": 1.4,
    "tile_logit_scale": 2.8,
    "th_threat_weight": 9.5,
    "defense_threat_weight": 2.2,
    "breach_prior_weight": 11.5,
    "spell_combat_prior_weight": 10.1,
    "film_cond_scale": 0.85,
    "reg_ent_type_weight": 2.4,
    "reg_ent_idx_weight": 2.0,
    "reg_ent_frac_weight": 2.0,
    "reg_ent_tile_weight": 0.1,
    "total_params": 254882,
}

DEFAULT_ARCH_CONFIG: Dict[str, Any] = dict(GEN2_SEGNEXT_MSCA_ARCH_CONFIG)


def fraction_bin_to_value(bin_idx: int) -> float:
    idx = max(0, min(len(DEPLOY_FRACTION_BINS) - 1, int(bin_idx)))
    return float(DEPLOY_FRACTION_BINS[idx])


def compute_deploy_count(avail_count: int, deploy_fraction: float) -> int:
    if avail_count <= 0:
        return 0
    frac = max(0.0, min(1.0, float(deploy_fraction)))
    return max(1, min(int(avail_count), int(round(avail_count * frac))))


def transfer_compatible_weights(
    old_state_dict: Dict[str, torch.Tensor],
    new_model: nn.Module,
) -> Dict[str, Any]:
    """
    Shape-Aware Warm-Start Weight Transfer across Progressive Architecture Generations:
      - Copies exact matching parameter tensors directly.
      - Copies overlapping tensor slices when dimensions expand/contract (e.g., widening
        `base_ch` from 20 -> 28 -> 32, `embed_dim` from 64 -> 128 -> 256, or adding
        6 tactical coordinate input channels from 59 -> 65).
      - Leaves newly introduced layers (e.g., ConvNeXtV2Block, SegNeXtMSCABlock) at their
        clean initial weights.
    """
    new_sd = new_model.state_dict()
    updated_sd: Dict[str, torch.Tensor] = {}
    exact_matches: List[str] = []
    sliced_matches: List[str] = []
    fresh_keys: List[str] = []
    transferred_params = 0
    total_new_params = 0

    for key, new_tensor in new_sd.items():
        numel = int(new_tensor.numel())
        total_new_params += numel
        if key not in old_state_dict:
            updated_sd[key] = new_tensor
            fresh_keys.append(key)
            continue

        old_tensor = old_state_dict[key].to(
            device=new_tensor.device, dtype=new_tensor.dtype
        )
        if old_tensor.shape == new_tensor.shape:
            updated_sd[key] = old_tensor.clone()
            exact_matches.append(key)
            transferred_params += numel
        elif old_tensor.ndim == new_tensor.ndim and old_tensor.ndim >= 1:
            merged = new_tensor.clone()
            slices = tuple(
                slice(0, min(int(s_old), int(s_new)))
                for s_old, s_new in zip(old_tensor.shape, new_tensor.shape, strict=False)
            )
            merged[slices] = old_tensor[slices]
            updated_sd[key] = merged
            sliced_matches.append(key)
            overlap_count = 1
            for s in slices:
                overlap_count *= int(s.stop - s.start)
            transferred_params += overlap_count
        else:
            updated_sd[key] = new_tensor
            fresh_keys.append(key)

    new_model.load_state_dict(updated_sd, strict=False)
    ratio = float(transferred_params) / float(max(1, total_new_params))
    return {
        "exact_matched_count": len(exact_matches),
        "sliced_matched_count": len(sliced_matches),
        "fresh_initialized_count": len(fresh_keys),
        "transferred_params": int(transferred_params),
        "total_new_params": int(total_new_params),
        "transferred_param_ratio": round(ratio, 4),
    }


class CoCActorCritic(nn.Module):
    """
    Live Tactical Attacker Network: Evolvable Factorized Multi-Discrete Actor-Critic.

    Fuses the (B, 59, 50, 50) spatial battlefield tensor with the (B, 64) live available
    army inventory vector to parameterize a factorized policy over MultiDiscrete([7, 10, 50, 50, 5]):
      1. `slot_type`       (7 choices):  0=NoOp, 1=Troop, 2=Hero, 3=HeroAbility, 4=Siege, 5=PopSiege, 6=Spell
      2. `slot_idx`        (10 choices): Loadout slot index, conditioned on the chosen `slot_type`
      3. `deploy_fraction` (5 bins in [0, 1]): Fraction of remaining available troops of `slot_idx` to deploy
      4. `tile_xy`         (2500 tiles): Flattened (tile_y * 50 + tile_x) deployment coordinate
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
        if arch_config is None:
            try:
                active_cfg_path = os.path.join(
                    os.path.dirname(__file__), "..", "..", "trained_models", "loop", "active_experiment_config.json"
                )
                if os.path.exists(active_cfg_path):
                    with open(active_cfg_path, "r", encoding="utf-8") as f:
                        disk_data = json.load(f)
                        if isinstance(disk_data.get("arch_config"), dict):
                            cfg.update({k: v for k, v in disk_data["arch_config"].items() if v is not None})
            except Exception:
                pass
        elif isinstance(arch_config, dict):
            cfg.update({k: v for k, v in arch_config.items() if v is not None})
        self.in_channels = in_channels
        self.army_context_dim = army_context_dim
        self.num_fraction_bins = num_fraction_bins

        base_ch = int(cfg.get("base_ch", 28))
        spatial_dim_cfg = int(cfg.get("spatial_dim", 28))
        embed_dim_cfg = int(cfg.get("embed_dim", 128))
        head_hidden_dim = int(cfg.get("head_hidden_dim", 96))
        self.head_hidden_dim = head_hidden_dim
        self.arch_version: str = str(cfg.get("arch_version", "v4-SegNeXt-MSCA-CompartmentNet"))
        self.generation: int = int(cfg.get("generation", 2))
        self.backbone_type: str = str(cfg.get("backbone_type", "segnext_msca"))
        self.weight_transfer_mode: str = str(
            cfg.get("weight_transfer_mode", "warm_start")
        )
        self.use_coord_features: bool = bool(cfg.get("use_coord_features", True))
        self.use_dilated_context: bool = bool(cfg.get("use_dilated_context", True))
        self.use_se_attention: bool = bool(cfg.get("use_se_attention", True))
        self.use_convnext_grn: bool = bool(cfg.get("use_convnext_grn", False))
        self.use_segnext_msca: bool = bool(cfg.get("use_segnext_msca", True))
        self.use_unet_decoder: bool = bool(
            cfg.get("use_unet_decoder", self.backbone_type == "unet")
        )
        self.use_dual_spatial_head: bool = bool(cfg.get("use_dual_spatial_head", False))
        self.use_gated_heads: bool = bool(cfg.get("use_gated_heads", True))
        self.critic_depth: int = int(cfg.get("critic_depth", 2))

        # Dynamic architectural conditioning & regularization coefficients
        self.logit_temp_type: float = float(cfg.get("logit_temp_type", 1.4))
        self.logit_temp_idx: float = float(cfg.get("logit_temp_idx", 1.6))
        self.logit_temp_frac: float = float(cfg.get("logit_temp_frac", 1.4))
        self.tile_logit_scale: float = float(cfg.get("tile_logit_scale", 2.2))
        self.th_threat_weight: float = float(cfg.get("th_threat_weight", 9.5))
        self.defense_threat_weight: float = float(cfg.get("defense_threat_weight", 2.0))
        self.breach_prior_weight: float = float(cfg.get("breach_prior_weight", 11.0))
        self.spell_combat_prior_weight: float = float(cfg.get("spell_combat_prior_weight", 8.0))
        self.film_cond_scale: float = float(cfg.get("film_cond_scale", 0.8))
        self.reg_ent_type_weight: float = float(cfg.get("reg_ent_type_weight", 2.2))
        self.reg_ent_idx_weight: float = float(cfg.get("reg_ent_idx_weight", 2.2))
        self.reg_ent_frac_weight: float = float(cfg.get("reg_ent_frac_weight", 2.2))
        self.reg_ent_tile_weight: float = float(cfg.get("reg_ent_tile_weight", 0.12))

        # Evolvable Spatial Backbone (Gen 0 TinyCNN -> Gen 1..5 SOTA Vision Backbones)
        self.encoder = CoCSpatialEncoder(
            in_channels=in_channels,
            base_ch=base_ch,
            spatial_dim=spatial_dim_cfg,
            embed_dim=embed_dim_cfg,
            backbone_type=self.backbone_type,
            use_coord_features=self.use_coord_features,
            use_dilated_context=self.use_dilated_context,
            use_se_attention=self.use_se_attention,
            use_convnext_grn=self.use_convnext_grn,
            use_segnext_msca=self.use_segnext_msca,
            use_unet_decoder=self.use_unet_decoder,
        )
        spatial_dim = self.encoder.spatial_dim
        embed_dim = self.encoder.embed_dim

        # Live available army inventory & remaining quantities projection (64-D -> embed_dim)
        self.army_context_proj = nn.Sequential(
            nn.Linear(army_context_dim, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.SiLU(),
        )

        # Head 1: Action Type logits (embed_dim -> 7 action types)
        self.slot_type_head = nn.Linear(embed_dim, 7)

        # Head 2: Army Slot Index logits, conditioned on global_emb + one_hot(slot_type)
        self.slot_idx_head = nn.Sequential(
            nn.Linear(embed_dim + 7, head_hidden_dim),
            nn.SiLU(),
            nn.Linear(head_hidden_dim, 10),
        )

        # Head 3: Troop Deployment Fraction logits (bins in [0.0, 0.25, 0.50, 0.75, 1.00])
        self.deploy_fraction_head = nn.Sequential(
            nn.Linear(embed_dim + 7 + 10, head_hidden_dim),
            nn.SiLU(),
            nn.Linear(head_hidden_dim, num_fraction_bins),
        )

        # Head 4: Spatial Tile Pointer (1x1 projection in Gen 0 TinyCNN; 3x3 + Dual Pointer in evolved generations)
        self.tile_cond_proj = nn.Linear(embed_dim + 7 + 10, spatial_dim)
        self.head_gate = (
            nn.Sequential(
                nn.Linear(embed_dim + 7 + 10, spatial_dim),
                nn.Sigmoid(),
            )
            if self.use_gated_heads
            else None
        )
        if self.backbone_type == "tiny_cnn" and not self.use_unet_decoder and not self.use_dual_spatial_head:
            self.tile_conv_head = nn.Sequential(
                nn.Conv2d(spatial_dim, 1, kernel_size=1),
            )
        else:
            mid_tile_ch = max(16, spatial_dim)
            self.tile_conv_head = nn.Sequential(
                nn.Conv2d(spatial_dim, mid_tile_ch, kernel_size=3, padding=1),
                nn.SiLU(),
                nn.Conv2d(mid_tile_ch, 1, kernel_size=1),
            )
        self.spell_tile_conv_head = (
            nn.Sequential(
                nn.Conv2d(spatial_dim, max(16, spatial_dim), kernel_size=3, padding=1),
                nn.SiLU(),
                nn.Conv2d(max(16, spatial_dim), 1, kernel_size=1),
            )
            if self.use_dual_spatial_head
            else None
        )

        # Head 5: State-Value Critic V(s)
        if self.critic_depth >= 3:
            self.critic_head = nn.Sequential(
                nn.Linear(embed_dim, head_hidden_dim),
                nn.LayerNorm(head_hidden_dim),
                nn.SiLU(),
                nn.Linear(head_hidden_dim, head_hidden_dim),
                nn.LayerNorm(head_hidden_dim),
                nn.SiLU(),
                nn.Linear(head_hidden_dim, 1),
            )
        else:
            self.critic_head = nn.Sequential(
                nn.Linear(embed_dim, head_hidden_dim),
                nn.SiLU(),
                nn.Linear(head_hidden_dim, 1),
            )
        self._frac_bins_tensor: torch.Tensor
        self.register_buffer(
            "_frac_bins_tensor",
            torch.tensor(DEPLOY_FRACTION_BINS, dtype=torch.float32),
            persistent=False,
        )

    def apply_arch_config(self, cfg: Optional[Dict[str, Any]]) -> None:
        if not isinstance(cfg, dict):
            return
        if "arch_version" in cfg and cfg["arch_version"]:
            self.arch_version = str(cfg["arch_version"])
        if "generation" in cfg and cfg["generation"] is not None:
            self.generation = int(cfg["generation"])
        if "backbone_type" in cfg and cfg["backbone_type"]:
            self.backbone_type = str(cfg["backbone_type"])
        if "weight_transfer_mode" in cfg and cfg["weight_transfer_mode"]:
            self.weight_transfer_mode = str(cfg["weight_transfer_mode"])
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
            "arch_version": str(getattr(self, "arch_version", "v4-SegNeXt-MSCA-CompartmentNet")),
            "generation": int(getattr(self, "generation", 2)),
            "backbone_type": str(getattr(self, "backbone_type", "segnext_msca")),
            "weight_transfer_mode": str(
                getattr(self, "weight_transfer_mode", "warm_start")
            ),
            "in_channels": int(self.in_channels),
            "base_ch": int(self.encoder.base_ch),
            "spatial_dim": int(self.encoder.spatial_dim),
            "embed_dim": int(self.encoder.embed_dim),
            "head_hidden_dim": int(getattr(self, "head_hidden_dim", 96)),
            "use_coord_features": bool(getattr(self, "use_coord_features", True)),
            "use_dilated_context": bool(getattr(self, "use_dilated_context", True)),
            "use_se_attention": bool(getattr(self, "use_se_attention", True)),
            "use_convnext_grn": bool(getattr(self, "use_convnext_grn", False)),
            "use_segnext_msca": bool(getattr(self, "use_segnext_msca", True)),
            "use_unet_decoder": bool(getattr(self, "use_unet_decoder", False)),
            "use_dual_spatial_head": bool(getattr(self, "use_dual_spatial_head", False)),
            "use_gated_heads": bool(getattr(self, "use_gated_heads", True)),
            "critic_depth": int(getattr(self, "critic_depth", 2)),
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

    def _compute_raw_tile_logits(
        self, fused_spatial: torch.Tensor, is_spell: torch.Tensor
    ) -> torch.Tensor:
        B = fused_spatial.shape[0]
        perimeter_logits = self.tile_conv_head(fused_spatial).reshape(B, 2500)
        if self.spell_tile_conv_head is not None:
            spell_logits = self.spell_tile_conv_head(fused_spatial).reshape(B, 2500)
            return (1.0 - is_spell) * perimeter_logits + is_spell * spell_logits
        return perimeter_logits

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
        if self.head_gate is not None:
            gate_w = self.head_gate(frac_cond_emb).unsqueeze(-1).unsqueeze(-1)
            cond_spatial = cond_spatial * gate_w
        fused_spatial = F.silu(
            spatial_feat * (1.0 + self.film_cond_scale * torch.tanh(cond_spatial)) + cond_spatial
        )
        is_spell = (chosen_type == 6).float().unsqueeze(-1)
        tile_logits = self._compute_raw_tile_logits(fused_spatial, is_spell)

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

        # Conditioned 50x50 Spatial Tile Pointer (including chosen_frac_bin signal)
        frac_onehot = F.one_hot(
            chosen_frac_bin.clamp(0, self.num_fraction_bins - 1),
            num_classes=self.num_fraction_bins,
        ).float()
        cond_spatial = self.tile_cond_proj(frac_cond_emb).unsqueeze(-1).unsqueeze(-1)
        if self.head_gate is not None:
            gate_w = self.head_gate(frac_cond_emb).unsqueeze(-1).unsqueeze(-1)
            cond_spatial = cond_spatial * gate_w
        fused_spatial = F.silu(
            spatial_feat * (1.0 + self.film_cond_scale * torch.tanh(cond_spatial)) + cond_spatial
        )
        is_spell = (chosen_type == 6).float().unsqueeze(-1)
        raw_tile_logits = self._compute_raw_tile_logits(fused_spatial, is_spell)

        th_alive_ratio = obs[:, 2:3].amax(dim=(-2, -1), keepdim=True)
        cleanup_focus = (1.0 - th_alive_ratio) * 2.5 * obs[:, 0:1]
        surgical_funnel = (
            frac_onehot[:, 0:1].unsqueeze(-1).unsqueeze(-1)
            * (obs[:, 56:59].sum(dim=1, keepdim=True).clamp(max=1.0) if obs.shape[1] >= 59 else obs[:, 0:1])
        )
        threat_field = (
            0.6 * obs[:, 0:1]
            + cleanup_focus
            + 0.8 * surgical_funnel
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
