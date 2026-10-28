"""
Production PyTorch Neural Network Architectures for Clash of Clans TH18 AI:
  - CoCSpatialEncoder: Configurable Dual-pathway Spatial CNN Backbone for the 8x50x50 Village Grid
  - CoCActorCritic: Factorized Multi-Discrete Actor-Critic with Invalid-Action Logit Masking
    and Dynamic Block-Builder Architecture Support
"""

from collections import OrderedDict
import copy
import math
from typing import Any, Dict, List, Optional, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.distributions import Categorical

NEG_INF = -1e8

DEFAULT_ARCH_CONFIG: Dict[str, Any] = {
    "preset_id": "default_th18_resnet",
    "name": "TH18 Dual-Pathway ResNet (Default)",
    "spatial_blocks": [
        {
            "id": "s1",
            "type": "conv2d",
            "filters": 32,
            "kernel_size": 3,
            "stride": 1,
            "padding": 1,
            "dilation": 1,
            "norm": "group",
            "activation": "silu",
            "bias": False,
        },
        {
            "id": "s2",
            "type": "conv2d",
            "filters": 64,
            "kernel_size": 3,
            "stride": 1,
            "padding": 1,
            "dilation": 1,
            "norm": "group",
            "activation": "silu",
            "bias": False,
        },
        {
            "id": "s3",
            "type": "resblock2d",
            "filters": 64,
            "kernel_size": 3,
            "stride": 1,
            "padding": 2,
            "dilation": 2,
            "norm": "group",
            "activation": "silu",
            "bias": False,
        },
    ],
    "global_blocks": [
        {
            "id": "g1",
            "type": "conv2d",
            "filters": 96,
            "kernel_size": 3,
            "stride": 2,
            "padding": 1,
            "dilation": 1,
            "norm": "none",
            "activation": "silu",
            "bias": True,
        },
        {
            "id": "g2",
            "type": "conv2d",
            "filters": 128,
            "kernel_size": 3,
            "stride": 2,
            "padding": 1,
            "dilation": 1,
            "norm": "none",
            "activation": "silu",
            "bias": True,
        },
        {
            "id": "g3",
            "type": "adaptive_avgpool2d",
            "pool_size": 4,
        },
        {
            "id": "g4",
            "type": "flatten",
        },
        {
            "id": "g5",
            "type": "linear",
            "units": 256,
            "norm": "layer",
            "activation": "silu",
            "dropout": 0.0,
            "bias": True,
        },
    ],
    "heads": {
        "tile_head_filters": 32,
        "tile_head_kernel": 3,
        "head_hidden_dim": 128,
        "head_activation": "silu",
    },
}


def get_default_arch_config() -> Dict[str, Any]:
    return copy.deepcopy(DEFAULT_ARCH_CONFIG)


def _strip_block_for_compare(b: Dict[str, Any]) -> Dict[str, Any]:
    btype = str(b.get("type", "conv2d")).lower()
    if btype in ("conv2d", "resblock2d", "dwsep_conv2d"):
        return {
            "type": btype,
            "filters": int(b.get("filters", 64)),
            "kernel_size": int(b.get("kernel_size", 3)),
            "stride": int(b.get("stride", 1)),
            "padding": int(b.get("padding", 1)),
            "dilation": int(b.get("dilation", 1)),
            "norm": str(b.get("norm", "none")).lower(),
            "activation": str(b.get("activation", "silu")).lower(),
            "bias": bool(b.get("bias", False)),
        }
    if btype in ("maxpool2d", "avgpool2d"):
        return {
            "type": btype,
            "kernel_size": int(b.get("kernel_size", 2)),
            "stride": int(b.get("stride", 2)),
            "padding": int(b.get("padding", 0)),
        }
    if btype in ("adaptive_avgpool2d", "adaptive_maxpool2d"):
        return {
            "type": btype,
            "pool_size": int(b.get("pool_size", 4)),
        }
    if btype == "se_block2d":
        return {
            "type": btype,
            "reduction": int(b.get("reduction", 4)),
            "activation": str(b.get("activation", "silu")).lower(),
        }
    if btype == "dropout2d":
        return {
            "type": btype,
            "dropout": round(float(b.get("dropout", 0.1)), 4),
        }
    if btype == "flatten":
        return {"type": "flatten"}
    if btype == "linear":
        return {
            "type": "linear",
            "units": int(b.get("units", 256)),
            "norm": str(b.get("norm", "layer")).lower(),
            "activation": str(b.get("activation", "silu")).lower(),
            "dropout": round(float(b.get("dropout", 0.0)), 4),
            "bias": bool(b.get("bias", True)),
        }
    return {"type": btype}


def is_default_arch_config(arch_config: Optional[Dict[str, Any]]) -> bool:
    if not arch_config or not isinstance(arch_config, dict):
        return True
    s_blocks = arch_config.get("spatial_blocks")
    g_blocks = arch_config.get("global_blocks")
    heads = arch_config.get("heads", {})
    if not isinstance(s_blocks, list) or not isinstance(g_blocks, list):
        return True
    def_s = [_strip_block_for_compare(b) for b in DEFAULT_ARCH_CONFIG["spatial_blocks"]]
    def_g = [_strip_block_for_compare(b) for b in DEFAULT_ARCH_CONFIG["global_blocks"]]
    cur_s = [_strip_block_for_compare(b) for b in s_blocks]
    cur_g = [_strip_block_for_compare(b) for b in g_blocks]
    if cur_s != def_s or cur_g != def_g:
        return False
    if int(heads.get("tile_head_filters", 32)) != 32:
        return False
    if int(heads.get("tile_head_kernel", 3)) != 3:
        return False
    if int(heads.get("head_hidden_dim", 128)) != 128:
        return False
    if str(heads.get("head_activation", "silu")).lower() != "silu":
        return False
    return True


def make_activation(name: str) -> nn.Module:
    act = (name or "silu").lower()
    if act == "relu":
        return nn.ReLU()
    if act == "gelu":
        return nn.GELU()
    if act == "leaky_relu":
        return nn.LeakyReLU(0.1)
    if act == "elu":
        return nn.ELU()
    if act == "tanh":
        return nn.Tanh()
    if act == "none":
        return nn.Identity()
    return nn.SiLU()


def _best_group_count(channels: int) -> int:
    candidates = [4, 2, 1] if channels <= 32 else [8, 4, 2, 1]
    for g in candidates:
        if channels % g == 0:
            return g
    return 1


def make_norm2d(norm_type: str, channels: int) -> Tuple[Optional[nn.Module], int]:
    nt = (norm_type or "none").lower()
    if nt == "group":
        g = _best_group_count(channels)
        return nn.GroupNorm(g, channels), 2 * channels
    if nt == "batch":
        return nn.BatchNorm2d(channels), 2 * channels
    if nt == "layer":
        return nn.GroupNorm(1, channels), 2 * channels
    return None, 0


def make_norm1d(norm_type: str, features: int) -> Tuple[Optional[nn.Module], int]:
    nt = (norm_type or "none").lower()
    if nt == "layer":
        return nn.LayerNorm(features), 2 * features
    if nt == "batch":
        return nn.BatchNorm1d(features), 2 * features
    return None, 0


class ResidualConvBlock2d(nn.Module):
    """Configurable 2-layer Residual CNN Block with automatic spatial/channel shortcut alignment."""

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: int = 3,
        stride: int = 1,
        padding: int = 1,
        dilation: int = 1,
        norm: str = "group",
        activation: str = "silu",
        bias: bool = False,
    ):
        super().__init__()
        self.conv1 = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=kernel_size,
            stride=stride,
            padding=padding,
            dilation=dilation,
            bias=bias,
        )
        norm1, _ = make_norm2d(norm, out_channels)
        self.norm1 = norm1 if norm1 is not None else nn.Identity()
        self.act1 = make_activation(activation)

        pad2 = (kernel_size - 1) // 2
        self.conv2 = nn.Conv2d(
            out_channels,
            out_channels,
            kernel_size=kernel_size,
            stride=1,
            padding=pad2,
            dilation=1,
            bias=bias,
        )
        norm2, _ = make_norm2d(norm, out_channels)
        self.norm2 = norm2 if norm2 is not None else nn.Identity()

        if in_channels != out_channels or stride != 1:
            sc_norm, _ = make_norm2d(norm, out_channels)
            sc_layers: List[nn.Module] = [
                nn.Conv2d(in_channels, out_channels, kernel_size=1, stride=stride, bias=False)
            ]
            if sc_norm is not None:
                sc_layers.append(sc_norm)
            self.shortcut: nn.Module = nn.Sequential(*sc_layers)
        else:
            self.shortcut = nn.Identity()

        self.out_act = make_activation(activation)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out = self.act1(self.norm1(self.conv1(x)))
        out = self.norm2(self.conv2(out))
        sc = self.shortcut(x)
        if out.shape[-2:] != sc.shape[-2:]:
            sc = F.interpolate(sc, size=out.shape[-2:], mode="nearest")
        return self.out_act(out + sc)


class DepthwiseSeparableConv2d(nn.Module):
    """Depthwise + Pointwise Separable Conv2d Block."""

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: int = 3,
        stride: int = 1,
        padding: int = 1,
        dilation: int = 1,
        norm: str = "group",
        activation: str = "silu",
        bias: bool = False,
    ):
        super().__init__()
        self.depthwise = nn.Conv2d(
            in_channels,
            in_channels,
            kernel_size=kernel_size,
            stride=stride,
            padding=padding,
            dilation=dilation,
            groups=in_channels,
            bias=False,
        )
        self.pointwise = nn.Conv2d(
            in_channels,
            out_channels,
            kernel_size=1,
            stride=1,
            padding=0,
            bias=bias,
        )
        norm_mod, _ = make_norm2d(norm, out_channels)
        self.norm = norm_mod if norm_mod is not None else nn.Identity()
        self.act = make_activation(activation)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.depthwise(x)
        x = self.pointwise(x)
        x = self.norm(x)
        return self.act(x)


class SEAttentionBlock2d(nn.Module):
    """Squeeze-and-Excitation Channel Attention Block."""

    def __init__(self, channels: int, reduction: int = 4, activation: str = "silu"):
        super().__init__()
        mid = max(4, channels // max(1, reduction))
        self.pool = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Sequential(
            nn.Flatten(),
            nn.Linear(channels, mid),
            make_activation(activation),
            nn.Linear(mid, channels),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        scale = self.fc(self.pool(x)).unsqueeze(-1).unsqueeze(-1)
        return x * scale


def _safe_conv_pad(h_in: int, k: int, s: int, p: int, d: int) -> int:
    eff_k = d * (k - 1) + 1
    if h_in + 2 * p < eff_k:
        return max(p, math.ceil((eff_k - h_in) / 2.0))
    return p


def _conv_out_dim(h_in: int, k: int, s: int, p: int, d: int = 1) -> int:
    eff_k = d * (k - 1) + 1
    p_safe = _safe_conv_pad(h_in, k, s, p, d)
    return max(1, (h_in + 2 * p_safe - eff_k) // max(1, s) + 1)



def _build_2d_block(
    idx: int,
    prefix: str,
    b: Dict[str, Any],
    c_in: int,
    h_in: int,
    w_in: int,
) -> Tuple[str, nn.Module, int, int, int]:
    btype = str(b.get("type", "conv2d")).lower()
    if btype == "conv2d":
        c_out = max(4, min(512, int(b.get("filters", 64))))
        k = max(1, min(9, int(b.get("kernel_size", 3))))
        s = max(1, min(4, int(b.get("stride", 1))))
        p = max(0, min(8, int(b.get("padding", 1))))
        d = max(1, min(4, int(b.get("dilation", 1))))
        norm = str(b.get("norm", "none")).lower()
        act = str(b.get("activation", "silu")).lower()
        bias = bool(b.get("bias", norm == "none"))
        p_safe = _safe_conv_pad(min(h_in, w_in), k, s, p, d)
        h_out = _conv_out_dim(h_in, k, s, p_safe, d)
        w_out = _conv_out_dim(w_in, k, s, p_safe, d)

        sub: List[nn.Module] = [
            nn.Conv2d(c_in, c_out, kernel_size=k, stride=s, padding=p_safe, dilation=d, bias=bias)
        ]
        norm_mod, _ = make_norm2d(norm, c_out)
        if norm_mod is not None:
            sub.append(norm_mod)
        if act != "none":
            sub.append(make_activation(act))
        mod = nn.Sequential(*sub) if len(sub) > 1 else sub[0]
        return f"{prefix}_{idx}_conv{k}x{k}_{c_out}", mod, c_out, h_out, w_out

    if btype == "resblock2d":
        c_out = max(4, min(512, int(b.get("filters", c_in))))
        k = max(1, min(9, int(b.get("kernel_size", 3))))
        s = max(1, min(4, int(b.get("stride", 1))))
        p = max(0, min(8, int(b.get("padding", (d := max(1, min(4, int(b.get("dilation", 1))))) * (k - 1) // 2))))
        norm = str(b.get("norm", "group")).lower()
        act = str(b.get("activation", "silu")).lower()
        bias = bool(b.get("bias", False))
        p_safe = _safe_conv_pad(min(h_in, w_in), k, s, p, d)
        h_out = _conv_out_dim(h_in, k, s, p_safe, d)
        w_out = _conv_out_dim(w_in, k, s, p_safe, d)
        mod = ResidualConvBlock2d(
            in_channels=c_in,
            out_channels=c_out,
            kernel_size=k,
            stride=s,
            padding=p_safe,
            dilation=d,
            norm=norm,
            activation=act,
            bias=bias,
        )
        return f"{prefix}_{idx}_res{k}x{k}_{c_out}", mod, c_out, h_out, w_out

    if btype == "dwsep_conv2d":
        c_out = max(4, min(512, int(b.get("filters", 64))))
        k = max(1, min(9, int(b.get("kernel_size", 3))))
        s = max(1, min(4, int(b.get("stride", 1))))
        p = max(0, min(8, int(b.get("padding", 1))))
        d = max(1, min(4, int(b.get("dilation", 1))))
        norm = str(b.get("norm", "group")).lower()
        act = str(b.get("activation", "silu")).lower()
        bias = bool(b.get("bias", False))
        p_safe = _safe_conv_pad(min(h_in, w_in), k, s, p, d)
        h_out = _conv_out_dim(h_in, k, s, p_safe, d)
        w_out = _conv_out_dim(w_in, k, s, p_safe, d)
        mod = DepthwiseSeparableConv2d(
            in_channels=c_in,
            out_channels=c_out,
            kernel_size=k,
            stride=s,
            padding=p_safe,
            dilation=d,
            norm=norm,
            activation=act,
            bias=bias,
        )
        return f"{prefix}_{idx}_dwsep{k}x{k}_{c_out}", mod, c_out, h_out, w_out

    if btype == "se_block2d":
        red = max(1, min(16, int(b.get("reduction", 4))))
        act = str(b.get("activation", "silu")).lower()
        mod = SEAttentionBlock2d(channels=c_in, reduction=red, activation=act)
        return f"{prefix}_{idx}_se_r{red}", mod, c_in, h_in, w_in

    if btype in ("maxpool2d", "avgpool2d"):
        k = max(1, min(8, int(b.get("kernel_size", 2))))
        s = max(1, min(8, int(b.get("stride", 2))))
        p = max(0, min(4, int(b.get("padding", 0))))
        p_safe = _safe_conv_pad(min(h_in, w_in), k, s, p, 1)
        h_out = _conv_out_dim(h_in, k, s, p_safe, 1)
        w_out = _conv_out_dim(w_in, k, s, p_safe, 1)
        pool_cls = nn.MaxPool2d if btype == "maxpool2d" else nn.AvgPool2d
        mod = pool_cls(kernel_size=k, stride=s, padding=p_safe)
        return f"{prefix}_{idx}_{btype}_{k}x{k}", mod, c_in, h_out, w_out

    if btype in ("adaptive_avgpool2d", "adaptive_maxpool2d"):
        ps = max(1, min(16, int(b.get("pool_size", 4))))
        pool_cls = nn.AdaptiveAvgPool2d if btype == "adaptive_avgpool2d" else nn.AdaptiveMaxPool2d
        mod = pool_cls((ps, ps))
        return f"{prefix}_{idx}_adapool_{ps}x{ps}", mod, c_in, ps, ps

    if btype == "dropout2d":
        drop = max(0.0, min(0.8, float(b.get("dropout", 0.1))))
        mod = nn.Dropout2d(p=drop)
        return f"{prefix}_{idx}_dropout2d", mod, c_in, h_in, w_in

    # Fallback identity
    return f"{prefix}_{idx}_identity", nn.Identity(), c_in, h_in, w_in


class CoCSpatialEncoder(nn.Module):
    """
    Dual-pathway Spatial CNN Backbone for the 8x50x50 Village Grid.
    Produces:
      1. `spatial_features`: (B, spatial_dim, H_s, W_s) feature map for tile-level targeting
      2. `global_embedding`: (B, embed_dim) compact tactical summary vector for action-type & critic heads
    """

    def __init__(
        self,
        in_channels: int = 8,
        spatial_dim: int = 64,
        embed_dim: int = 256,
        arch_config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__()
        self.is_custom = not is_default_arch_config(arch_config)

        if not self.is_custom:
            self.spatial_dim = spatial_dim
            self.embed_dim = embed_dim
            self.spatial_out_hw = (50, 50)

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
            return

        cfg = arch_config or DEFAULT_ARCH_CONFIG
        s_blocks = cfg.get("spatial_blocks") or DEFAULT_ARCH_CONFIG["spatial_blocks"]
        g_blocks = cfg.get("global_blocks") or DEFAULT_ARCH_CONFIG["global_blocks"]

        c_cur, h_cur, w_cur = in_channels, 50, 50
        stem_ordered: "OrderedDict[str, nn.Module]" = OrderedDict()
        for idx, b in enumerate(s_blocks):
            btype = str(b.get("type", "conv2d")).lower()
            if btype in ("flatten", "linear"):
                continue
            name, mod, c_cur, h_cur, w_cur = _build_2d_block(
                idx, "stem", b, c_cur, h_cur, w_cur
            )
            stem_ordered[name] = mod

        if len(stem_ordered) == 0:
            name, mod, c_cur, h_cur, w_cur = _build_2d_block(
                0,
                "stem",
                DEFAULT_ARCH_CONFIG["spatial_blocks"][0],
                in_channels,
                50,
                50,
            )
            stem_ordered[name] = mod

        self.spatial_dim = c_cur
        self.spatial_out_hw = (h_cur, w_cur)
        self.spatial_stem = nn.Sequential(stem_ordered)

        tower_ordered: "OrderedDict[str, nn.Module]" = OrderedDict()
        is_flat = False
        flat_dim = c_cur * h_cur * w_cur

        # Process 2D blocks first, then 1D blocks in global_blocks
        two_d_blocks = [
            b
            for b in g_blocks
            if str(b.get("type", "")).lower() not in ("flatten", "linear")
        ]
        one_d_blocks = [
            b
            for b in g_blocks
            if str(b.get("type", "")).lower() in ("flatten", "linear")
        ]

        t_idx = 0
        for b in two_d_blocks:
            name, mod, c_cur, h_cur, w_cur = _build_2d_block(
                t_idx, "tower", b, c_cur, h_cur, w_cur
            )
            tower_ordered[name] = mod
            t_idx += 1

        # If spatial grid is still large (>8x8) before flattening and user didn't add adaptive pool,
        # keep it safe unless user explicitly added adaptive pool.
        for b in one_d_blocks:
            btype = str(b.get("type", "linear")).lower()
            if btype == "flatten":
                if not is_flat:
                    tower_ordered[f"tower_{t_idx}_flatten"] = nn.Flatten()
                    is_flat = True
                    flat_dim = c_cur * h_cur * w_cur
                    t_idx += 1
            elif btype == "linear":
                if not is_flat:
                    tower_ordered[f"tower_{t_idx}_flatten"] = nn.Flatten()
                    is_flat = True
                    flat_dim = c_cur * h_cur * w_cur
                    t_idx += 1
                units = max(16, min(1024, int(b.get("units", 256))))
                norm = str(b.get("norm", "layer")).lower()
                act = str(b.get("activation", "silu")).lower()
                drop = max(0.0, min(0.8, float(b.get("dropout", 0.0))))
                bias = bool(b.get("bias", True))
                lin_sub: List[nn.Module] = [nn.Linear(flat_dim, units, bias=bias)]
                norm_mod, _ = make_norm1d(norm, units)
                if norm_mod is not None:
                    lin_sub.append(norm_mod)
                if act != "none":
                    lin_sub.append(make_activation(act))
                if drop > 0.0:
                    lin_sub.append(nn.Dropout(p=drop))
                tower_ordered[f"tower_{t_idx}_linear_{units}"] = (
                    nn.Sequential(*lin_sub) if len(lin_sub) > 1 else lin_sub[0]
                )
                flat_dim = units
                t_idx += 1

        if not is_flat:
            ps = min(4, h_cur, w_cur)
            tower_ordered[f"tower_{t_idx}_adapool_{ps}x{ps}"] = nn.AdaptiveAvgPool2d((ps, ps))
            t_idx += 1
            tower_ordered[f"tower_{t_idx}_flatten"] = nn.Flatten()
            t_idx += 1
            flat_dim = c_cur * ps * ps
            tower_ordered[f"tower_{t_idx}_linear_{embed_dim}"] = nn.Sequential(
                nn.Linear(flat_dim, embed_dim),
                nn.LayerNorm(embed_dim),
                nn.SiLU(),
            )
            flat_dim = embed_dim

        self.embed_dim = flat_dim
        self.global_tower = nn.Sequential(tower_ordered)

    def forward(self, obs: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        if not self.is_custom:
            h = self.spatial_stem(obs)
            spatial_features = F.silu(h + self.context_res(h))
            global_embedding = self.global_tower(spatial_features)
            return spatial_features, global_embedding

        spatial_features = self.spatial_stem(obs)
        global_embedding = self.global_tower(spatial_features)
        return spatial_features, global_embedding


class CoCActorCritic(nn.Module):
    """
    Model 2 (Live Tactical Attacker):
    Factorized Multi-Discrete Actor-Critic with Invalid-Action Logit Masking and Full
    Army Composition Context (`army_context`: 64 floats encoding troops, spells, heroes,
    hero equipment, pets, siege machine, CC contents, and live remaining inventory).

    Action space is MultiDiscrete([7, 10, 50, 50]):
      - slot_type (0..6): 0=NoOp (Do Nothing), 1=Troop, 2=Hero, 3=HeroAbility, 4=Siege, 5=PopSiege, 6=Spell
      - slot_idx  (0..9): Army loadout slot index
      - tile_xy   (0..2499): Flattened (tile_y * 50 + tile_x) coordinate on the 50x50 map
    """

    def __init__(
        self,
        in_channels: int = 8,
        army_context_dim: int = 64,
        arch_config: Optional[Dict[str, Any]] = None,
    ):
        super().__init__()
        self.in_channels = in_channels
        self.army_context_dim = army_context_dim
        self.arch_config = (
            copy.deepcopy(arch_config)
            if arch_config and isinstance(arch_config, dict)
            else get_default_arch_config()
        )
        self.encoder = CoCSpatialEncoder(
            in_channels=in_channels,
            spatial_dim=64,
            embed_dim=256,
            arch_config=arch_config,
        )
        spatial_dim = self.encoder.spatial_dim
        embed_dim = self.encoder.embed_dim

        heads_cfg = self.arch_config.get("heads", {})
        tile_filters = max(8, min(128, int(heads_cfg.get("tile_head_filters", 32))))
        tile_kernel = max(1, min(7, int(heads_cfg.get("tile_head_kernel", 3))))
        head_hidden = max(32, min(512, int(heads_cfg.get("head_hidden_dim", 128))))
        head_act = str(heads_cfg.get("head_activation", "silu")).lower()

        self.army_context_proj = nn.Sequential(
            nn.Linear(army_context_dim, embed_dim),
            nn.LayerNorm(embed_dim),
            make_activation(head_act),
        )

        self.slot_type_head = nn.Linear(embed_dim, 7)
        self.slot_idx_head = nn.Sequential(
            nn.Linear(embed_dim + 7, head_hidden),
            make_activation(head_act),
            nn.Linear(head_hidden, 10),
        )

        self.tile_cond_proj = nn.Linear(embed_dim + 7, spatial_dim)
        self.tile_conv_head = nn.Sequential(
            nn.Conv2d(
                spatial_dim,
                tile_filters,
                kernel_size=tile_kernel,
                padding=(tile_kernel - 1) // 2,
            ),
            make_activation(head_act),
            nn.Conv2d(tile_filters, 1, kernel_size=1),
        )

        self.critic_head = nn.Sequential(
            nn.Linear(embed_dim, head_hidden),
            make_activation(head_act),
            nn.Linear(head_hidden, 1),
        )

    def forward(
        self, obs: torch.Tensor, army_context: Optional[torch.Tensor] = None
    ) -> Dict[str, torch.Tensor]:
        """
        Deterministic architectural forward pass returning all raw head outputs:
        `type_logits (B, 7)`, `idx_logits (B, 10)`, `tile_logits (B, 2500)`, `value (B,)`.
        Used by `torchview` / ONNX / graph inspection tools.
        """
        B = obs.shape[0]
        spatial_feat, global_emb = self.encoder(obs)
        if army_context is None:
            army_context = obs.reshape(B, -1)[:, : self.army_context_dim] * 0.0
        global_emb = global_emb + self.army_context_proj(army_context)

        type_logits = self.slot_type_head(global_emb)
        chosen_type = type_logits.argmax(dim=-1)
        type_onehot = F.one_hot(chosen_type.clamp(0, 6), num_classes=7).float()
        cond_emb = torch.cat([global_emb, type_onehot], dim=-1)
        idx_logits = self.slot_idx_head(cond_emb)
        cond_spatial = self.tile_cond_proj(cond_emb).unsqueeze(-1).unsqueeze(-1)
        if spatial_feat.shape[-2:] != (50, 50):
            spatial_feat = F.interpolate(
                spatial_feat, size=(50, 50), mode="bilinear", align_corners=False
            )
        fused_spatial = F.silu(spatial_feat + cond_spatial)
        tile_logits = self.tile_conv_head(fused_spatial).reshape(B, 2500)
        value = self.critic_head(global_emb).squeeze(-1)
        return {
            "type_logits": type_logits,
            "idx_logits": idx_logits,
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
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, Dict[str, torch.Tensor]]:
        B = obs.shape[0]
        device = obs.device
        spatial_feat, global_emb = self.encoder(obs)
        if army_context is not None:
            global_emb = global_emb + self.army_context_proj(
                army_context.to(device=device, dtype=obs.dtype)
            )

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
        if spatial_feat.shape[-2:] != (50, 50):
            spatial_feat = F.interpolate(
                spatial_feat, size=(50, 50), mode="bilinear", align_corners=False
            )
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


def analyze_architecture(
    arch_config: Optional[Dict[str, Any]] = None,
    in_channels: int = 8,
    grid_size: int = 50,
    army_context_dim: int = 64,
) -> Dict[str, Any]:
    """
    Analyzes a `CoCActorCritic` architecture configuration, instantiating the real
    PyTorch model, verifying a dummy forward pass, and returning layer-by-layer shapes,
    parameter counts, MACs, receptive fields, and equivalent PyTorch `nn.Module` code.
    """
    cfg = copy.deepcopy(arch_config) if arch_config else get_default_arch_config()
    model = CoCActorCritic(
        in_channels=in_channels,
        army_context_dim=army_context_dim,
        arch_config=cfg,
    )
    model.eval()
    with torch.no_grad():
        dummy_obs = torch.zeros(1, in_channels, grid_size, grid_size)
        dummy_ctx = torch.zeros(1, army_context_dim)
        _ = model(dummy_obs, dummy_ctx)

    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

    layers_summary: List[Dict[str, Any]] = []
    c_cur, h_cur, w_cur = in_channels, grid_size, grid_size
    rf = 1
    jump = 1
    total_macs = 0

    s_blocks = cfg.get("spatial_blocks") or DEFAULT_ARCH_CONFIG["spatial_blocks"]
    g_blocks = cfg.get("global_blocks") or DEFAULT_ARCH_CONFIG["global_blocks"]
    heads_cfg = cfg.get("heads") or DEFAULT_ARCH_CONFIG["heads"]

    def _trace_2d(idx: int, stage: str, b: Dict[str, Any]) -> None:
        nonlocal c_cur, h_cur, w_cur, rf, jump, total_macs
        btype = str(b.get("type", "conv2d")).lower()
        in_shape = [c_cur, h_cur, w_cur]
        params = 0
        macs = 0
        desc = ""

        if btype == "conv2d":
            c_out = max(4, min(512, int(b.get("filters", 64))))
            k = max(1, min(9, int(b.get("kernel_size", 3))))
            s = max(1, min(4, int(b.get("stride", 1))))
            p = max(0, min(8, int(b.get("padding", 1))))
            d = max(1, min(4, int(b.get("dilation", 1))))
            norm = str(b.get("norm", "none")).lower()
            act = str(b.get("activation", "silu")).lower()
            bias = bool(b.get("bias", norm == "none"))
            p_safe = _safe_conv_pad(min(h_cur, w_cur), k, s, p, d)
            h_out = _conv_out_dim(h_cur, k, s, p_safe, d)
            w_out = _conv_out_dim(w_cur, k, s, p_safe, d)

            w_params = c_cur * c_out * k * k + (c_out if bias else 0)
            n_params = 2 * c_out if norm in ("group", "batch", "layer") else 0
            params = w_params + n_params
            macs = c_cur * c_out * k * k * h_out * w_out

            eff_k = d * (k - 1) + 1
            rf = rf + (eff_k - 1) * jump
            jump = jump * s
            c_cur, h_cur, w_cur = c_out, h_out, w_out
            desc = f"{c_out} filters, {k}×{k}, s={s}, p={p_safe}, d={d}, norm={norm}, act={act}"

        elif btype == "resblock2d":
            c_out = max(4, min(512, int(b.get("filters", c_cur))))
            k = max(1, min(9, int(b.get("kernel_size", 3))))
            s = max(1, min(4, int(b.get("stride", 1))))
            d = max(1, min(4, int(b.get("dilation", 1))))
            p = max(0, min(8, int(b.get("padding", d * (k - 1) // 2))))
            norm = str(b.get("norm", "group")).lower()
            act = str(b.get("activation", "silu")).lower()
            bias = bool(b.get("bias", False))
            p_safe = _safe_conv_pad(min(h_cur, w_cur), k, s, p, d)
            h_out = _conv_out_dim(h_cur, k, s, p_safe, d)
            w_out = _conv_out_dim(w_cur, k, s, p_safe, d)

            n_params = 2 * c_out if norm in ("group", "batch", "layer") else 0
            conv1_p = c_cur * c_out * k * k + (c_out if bias else 0) + n_params
            conv2_p = c_out * c_out * k * k + (c_out if bias else 0) + n_params
            sc_p = (c_cur * c_out + n_params) if (c_cur != c_out or s != 1) else 0
            params = conv1_p + conv2_p + sc_p
            macs = (c_cur * c_out * k * k + c_out * c_out * k * k) * h_out * w_out

            eff_k1 = d * (k - 1) + 1
            rf = rf + (eff_k1 - 1) * jump
            jump = jump * s
            rf = rf + (k - 1) * jump
            c_cur, h_cur, w_cur = c_out, h_out, w_out
            desc = f"2×Conv {c_out} filters, {k}×{k}, s={s}, p={p_safe}, d={d}, skip+, {norm}, {act}"

        elif btype == "dwsep_conv2d":
            c_out = max(4, min(512, int(b.get("filters", 64))))
            k = max(1, min(9, int(b.get("kernel_size", 3))))
            s = max(1, min(4, int(b.get("stride", 1))))
            p = max(0, min(8, int(b.get("padding", 1))))
            d = max(1, min(4, int(b.get("dilation", 1))))
            norm = str(b.get("norm", "group")).lower()
            act = str(b.get("activation", "silu")).lower()
            bias = bool(b.get("bias", False))
            p_safe = _safe_conv_pad(min(h_cur, w_cur), k, s, p, d)
            h_out = _conv_out_dim(h_cur, k, s, p_safe, d)
            w_out = _conv_out_dim(w_cur, k, s, p_safe, d)

            dw_p = c_cur * k * k
            pw_p = c_cur * c_out + (c_out if bias else 0)
            n_p = 2 * c_out if norm in ("group", "batch", "layer") else 0
            params = dw_p + pw_p + n_p
            macs = (c_cur * k * k + c_cur * c_out) * h_out * w_out

            eff_k = d * (k - 1) + 1
            rf = rf + (eff_k - 1) * jump
            jump = jump * s
            c_cur, h_cur, w_cur = c_out, h_out, w_out
            desc = f"DW {k}×{k} + PW 1×1 → {c_out} ch, s={s}, p={p_safe}, {norm}, {act}"

        elif btype == "se_block2d":
            red = max(1, min(16, int(b.get("reduction", 4))))
            act = str(b.get("activation", "silu")).lower()
            mid = max(4, c_cur // red)
            params = 2 * c_cur * mid + c_cur + mid
            macs = 2 * c_cur * mid
            desc = f"SE Channel Attention (÷{red} → {mid} ch, {act})"

        elif btype in ("maxpool2d", "avgpool2d"):
            k = max(1, min(8, int(b.get("kernel_size", 2))))
            s = max(1, min(8, int(b.get("stride", 2))))
            p = max(0, min(4, int(b.get("padding", 0))))
            p_safe = _safe_conv_pad(min(h_cur, w_cur), k, s, p, 1)
            h_out = _conv_out_dim(h_cur, k, s, p_safe, 1)
            w_out = _conv_out_dim(w_cur, k, s, p_safe, 1)
            rf = rf + (k - 1) * jump
            jump = jump * s
            h_cur, w_cur = h_out, w_out
            desc = f"Pool {k}×{k}, stride={s}, pad={p_safe}"

        elif btype in ("adaptive_avgpool2d", "adaptive_maxpool2d"):
            ps = max(1, min(16, int(b.get("pool_size", 4))))
            h_cur, w_cur = ps, ps
            rf = grid_size
            desc = f"Adaptive Grid {ps}×{ps}"

        elif btype == "dropout2d":
            drop = max(0.0, min(0.8, float(b.get("dropout", 0.1))))
            desc = f"Spatial Dropout p={drop}"

        total_macs += macs
        layers_summary.append(
            {
                "id": b.get("id", f"{stage}_{idx}"),
                "stage": stage,
                "type": btype,
                "desc": desc,
                "input_shape": in_shape,
                "output_shape": [c_cur, h_cur, w_cur],
                "receptive_field": min(grid_size, rf),
                "params": params,
                "macs": macs,
            }
        )

    for idx, b in enumerate(s_blocks):
        if str(b.get("type", "")).lower() not in ("flatten", "linear"):
            _trace_2d(idx, "spatial", b)

    spatial_out_shape = [c_cur, h_cur, w_cur]
    spatial_rf = min(grid_size, rf)

    two_d_g = [b for b in g_blocks if str(b.get("type", "")).lower() not in ("flatten", "linear")]
    one_d_g = [b for b in g_blocks if str(b.get("type", "")).lower() in ("flatten", "linear")]

    for idx, b in enumerate(two_d_g):
        _trace_2d(idx, "global", b)

    is_flat = False
    flat_dim = c_cur * h_cur * w_cur

    for idx, b in enumerate(one_d_g):
        btype = str(b.get("type", "linear")).lower()
        if btype == "flatten":
            if not is_flat:
                is_flat = True
                flat_dim = c_cur * h_cur * w_cur
                layers_summary.append(
                    {
                        "id": b.get("id", f"global_flat_{idx}"),
                        "stage": "global",
                        "type": "flatten",
                        "desc": f"Flatten {c_cur}×{h_cur}×{w_cur} → {flat_dim}",
                        "input_shape": [c_cur, h_cur, w_cur],
                        "output_shape": [flat_dim],
                        "receptive_field": grid_size,
                        "params": 0,
                        "macs": 0,
                    }
                )
        elif btype == "linear":
            if not is_flat:
                is_flat = True
                flat_dim = c_cur * h_cur * w_cur
                layers_summary.append(
                    {
                        "id": f"auto_flat_{idx}",
                        "stage": "global",
                        "type": "flatten",
                        "desc": f"Auto-Flatten {c_cur}×{h_cur}×{w_cur} → {flat_dim}",
                        "input_shape": [c_cur, h_cur, w_cur],
                        "output_shape": [flat_dim],
                        "receptive_field": grid_size,
                        "params": 0,
                        "macs": 0,
                    }
                )
            units = max(16, min(1024, int(b.get("units", 256))))
            norm = str(b.get("norm", "layer")).lower()
            act = str(b.get("activation", "silu")).lower()
            drop = max(0.0, min(0.8, float(b.get("dropout", 0.0))))
            bias = bool(b.get("bias", True))
            p_cnt = flat_dim * units + (units if bias else 0) + (2 * units if norm in ("layer", "batch") else 0)
            macs = flat_dim * units
            total_macs += macs
            layers_summary.append(
                {
                    "id": b.get("id", f"global_lin_{idx}"),
                    "stage": "global",
                    "type": "linear",
                    "desc": f"Linear {flat_dim} → {units}, norm={norm}, act={act}" + (f", drop={drop}" if drop > 0 else ""),
                    "input_shape": [flat_dim],
                    "output_shape": [units],
                    "receptive_field": grid_size,
                    "params": p_cnt,
                    "macs": macs,
                }
            )
            flat_dim = units

    embed_dim = model.encoder.embed_dim
    spatial_dim = model.encoder.spatial_dim
    tile_filters = max(8, min(128, int(heads_cfg.get("tile_head_filters", 32))))
    tile_kernel = max(1, min(7, int(heads_cfg.get("tile_head_kernel", 3))))
    head_hidden = max(32, min(512, int(heads_cfg.get("head_hidden_dim", 128))))

    # Append Head summaries
    head_items = [
        (
            "head_army_ctx",
            "army_context_proj",
            f"Linear({army_context_dim} → {embed_dim}) + LayerNorm",
            [army_context_dim],
            [embed_dim],
            sum(p.numel() for p in model.army_context_proj.parameters()),
            army_context_dim * embed_dim,
        ),
        (
            "head_slot_type",
            "slot_type_head",
            f"Linear({embed_dim} → 7 Action Types)",
            [embed_dim],
            [7],
            sum(p.numel() for p in model.slot_type_head.parameters()),
            embed_dim * 7,
        ),
        (
            "head_slot_idx",
            "slot_idx_head",
            f"MLP({embed_dim + 7} → {head_hidden} → 10 Slots)",
            [embed_dim + 7],
            [10],
            sum(p.numel() for p in model.slot_idx_head.parameters()),
            (embed_dim + 7) * head_hidden + head_hidden * 10,
        ),
        (
            "head_tile_conv",
            "tile_conv_head",
            f"Cond({embed_dim + 7}→{spatial_dim}) + Conv {tile_kernel}×{tile_kernel}({spatial_dim}→{tile_filters}→1)",
            [spatial_dim, 50, 50],
            [1, 50, 50],
            sum(p.numel() for p in model.tile_cond_proj.parameters())
            + sum(p.numel() for p in model.tile_conv_head.parameters()),
            (spatial_dim * tile_filters * tile_kernel * tile_kernel + tile_filters) * 2500,
        ),
        (
            "head_critic",
            "critic_head",
            f"MLP({embed_dim} → {head_hidden} → 1 Value V(s))",
            [embed_dim],
            [1],
            sum(p.numel() for p in model.critic_head.parameters()),
            embed_dim * head_hidden + head_hidden,
        ),
    ]
    for hid, htype, hdesc, in_s, out_s, p_c, m_c in head_items:
        total_macs += m_c
        layers_summary.append(
            {
                "id": hid,
                "stage": "heads",
                "type": htype,
                "desc": hdesc,
                "input_shape": in_s,
                "output_shape": out_s,
                "receptive_field": grid_size,
                "params": int(p_c),
                "macs": int(m_c),
            }
        )

    vram_mb = round((total_params * 4 * 3) / (1024.0 * 1024.0), 2)

    return {
        "valid": True,
        "name": cfg.get("name", "Custom CoCActorCritic"),
        "is_default": is_default_arch_config(cfg),
        "total_params": int(total_params),
        "trainable_params": int(trainable_params),
        "estimated_vram_mb": vram_mb,
        "total_macs": int(total_macs),
        "spatial_out_shape": spatial_out_shape,
        "spatial_receptive_field": spatial_rf,
        "embed_dim": int(embed_dim),
        "layers_summary": layers_summary,
        "pytorch_repr": repr(model),
    }



class AttackerArmySelectorNet(nn.Module):
    """
    Model 1 (Pre-Battle Attacker Army Selector):
    Takes the village layout spatial tensor `(B, 8, 50, 50)` (positions & threat of defenses,
    Town Hall 18, walls, red-zone) and outputs a categorical distribution over the 3 fixed
    TH18 Meta Armies (`0..2`) plus a value estimate `V(layout)`.
    """

    def __init__(self, in_channels: int = 8, num_armies: int = 3):
        super().__init__()
        self.num_armies = num_armies
        self.encoder = CoCSpatialEncoder(in_channels=in_channels, spatial_dim=64, embed_dim=256)
        self.army_head = nn.Sequential(
            nn.Linear(256, 128),
            nn.SiLU(),
            nn.Linear(128, num_armies),
        )
        self.critic_head = nn.Sequential(
            nn.Linear(256, 128),
            nn.SiLU(),
            nn.Linear(128, 1),
        )

    def forward(self, layout_obs: torch.Tensor) -> Dict[str, torch.Tensor]:
        _, global_emb = self.encoder(layout_obs)
        logits = self.army_head(global_emb)
        value = self.critic_head(global_emb).squeeze(-1)
        return {"army_logits": logits, "value": value}

    def get_action_and_value(
        self,
        layout_obs: torch.Tensor,
        action: Optional[torch.Tensor] = None,
        deterministic: bool = False,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        _, global_emb = self.encoder(layout_obs)
        logits = self.army_head(global_emb)
        dist = Categorical(logits=logits)
        if action is None:
            chosen = logits.argmax(dim=-1) if deterministic else dist.sample()
        else:
            chosen = action.long()
        log_prob = dist.log_prob(chosen)
        entropy = dist.entropy()
        value = self.critic_head(global_emb).squeeze(-1)
        return chosen, log_prob, entropy, value, dist.probs.detach()


class DefenderVillageSelectorNet(nn.Module):
    """
    Model 3 (Pre-Battle Defender Village Selector):
    Takes full knowledge of the incoming attacking army composition (`army_context`: `(B, 64)`
    encoding troops, spells, siege machine, heroes, hero equipment, pets, and CC contents)
    and outputs a categorical distribution over the 5 TH18 Meta Villages (`0..4`) plus a
    defensive value estimate `V(army)`.
    """

    def __init__(self, army_context_dim: int = 64, num_villages: int = 5):
        super().__init__()
        self.army_context_dim = army_context_dim
        self.num_villages = num_villages
        self.army_encoder = nn.Sequential(
            nn.Linear(army_context_dim, 128),
            nn.LayerNorm(128),
            nn.SiLU(),
            nn.Linear(128, 128),
            nn.LayerNorm(128),
            nn.SiLU(),
        )
        self.village_head = nn.Sequential(
            nn.Linear(128, 64),
            nn.SiLU(),
            nn.Linear(64, num_villages),
        )
        self.critic_head = nn.Sequential(
            nn.Linear(128, 64),
            nn.SiLU(),
            nn.Linear(64, 1),
        )

    def forward(self, army_context: torch.Tensor) -> Dict[str, torch.Tensor]:
        h = self.army_encoder(army_context)
        logits = self.village_head(h)
        value = self.critic_head(h).squeeze(-1)
        return {"village_logits": logits, "value": value}

    def get_action_and_value(
        self,
        army_context: torch.Tensor,
        action: Optional[torch.Tensor] = None,
        deterministic: bool = False,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        h = self.army_encoder(army_context)
        logits = self.village_head(h)
        dist = Categorical(logits=logits)
        if action is None:
            chosen = logits.argmax(dim=-1) if deterministic else dist.sample()
        else:
            chosen = action.long()
        log_prob = dist.log_prob(chosen)
        entropy = dist.entropy()
        value = self.critic_head(h).squeeze(-1)
        return chosen, log_prob, entropy, value, dist.probs.detach()
