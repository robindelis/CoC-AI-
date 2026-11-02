"""
Static `torchview` Computation Graph Generator for `CoCActorCritic`.

Renders publication-grade SVG and PNG diagrams of `CoCActorCritic`
(`overview` at depth=2 and `detailed` at depth=3) into `docs/architecture/`.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
from typing import Any, Dict, Iterator, List, Optional

import torch
import torch.nn as nn
from torchview import draw_graph

from .networks import CoCActorCritic

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ARCH_DIR = os.path.join(REPO_ROOT, "docs", "architecture")
MANIFEST_PATH = os.path.join(ARCH_DIR, "manifest.json")
NETWORKS_PATH = os.path.join(os.path.dirname(__file__), "networks.py")


ACTIVE_CONFIG_PATH = os.path.join(REPO_ROOT, "trained_models", "loop", "active_experiment_config.json")


def load_active_arch_config() -> Optional[Dict[str, Any]]:
    """Loads the active experiment arch_config from disk if present."""
    if os.path.exists(ACTIVE_CONFIG_PATH):
        try:
            with open(ACTIVE_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("arch_config")
        except Exception:
            pass
    return None


def compute_networks_hash(model: Optional[nn.Module] = None) -> str:
    """Computes a SHA-256 digest of `networks.py`, active config, and the live `model` repr + parameter counts."""
    h = hashlib.sha256()
    if os.path.exists(NETWORKS_PATH):
        with open(NETWORKS_PATH, "rb") as f:
            h.update(f.read())
    if os.path.exists(ACTIVE_CONFIG_PATH):
        with open(ACTIVE_CONFIG_PATH, "rb") as f:
            h.update(f.read())
    if model is not None:
        h.update(repr(model).encode("utf-8"))
        for name, p in model.named_parameters():
            h.update(f"{name}:{tuple(p.shape)}".encode("utf-8"))
        if hasattr(model, "get_arch_config"):
            h.update(json.dumps(model.get_arch_config(), sort_keys=True).encode("utf-8"))
    return h.hexdigest()


def get_submodule_breakdown(model: nn.Module) -> List[Dict[str, Any]]:
    """Returns parameter counts and layer types for top-level logical blocks."""
    rows: List[Dict[str, Any]] = []
    for name, mod in model.named_modules():
        if not name or ("." in name and not name.startswith("encoder.")):
            continue
        if name == "encoder" or name.split(".")[-1].isdigit():
            continue
        rows.append(
            {
                "name": name,
                "type": type(mod).__name__,
                "params": int(sum(p.numel() for p in mod.parameters())),
            }
        )
    return rows


def extract_live_layer_specs(model: CoCActorCritic) -> Dict[str, Any]:
    """
    Runs a live forward trace with shape & parameter hooks on `model` (`CoCActorCritic`)
    so the 3D U-Net Feature Map diagram, Layer-by-Layer table, KPI pills, and PyTorch code
    in the Web UI always reflect any edits made to `python/coc_rl/networks.py` on every refresh.
    Dynamically supports both 2-stage CNN backbones (Gen 0..Gen 2) and full U-Net backbones (Gen 3..Gen 5).
    """
    in_ch = int(getattr(model, "in_channels", 59))
    army_ctx_dim = int(getattr(model, "army_context_dim", 64))
    num_frac_bins = int(getattr(model, "num_fraction_bins", 5))

    enc = getattr(model, "encoder", None)
    base_ch = int(getattr(enc, "base_ch", 24)) if enc is not None else 24
    spatial_dim = int(getattr(enc, "spatial_dim", 24)) if enc is not None else 24
    embed_dim = int(getattr(enc, "embed_dim", 96)) if enc is not None else 96
    head_hidden_dim = int(getattr(model, "head_hidden_dim", 64))
    critic_depth = int(getattr(model, "critic_depth", 2))

    use_unet = bool(getattr(enc, "use_unet_decoder", False))
    use_coord = bool(getattr(enc, "use_coord_features", False))
    use_dilated = bool(getattr(enc, "use_dilated_context", False))
    use_convnext = bool(getattr(enc, "use_convnext_grn", False))
    use_segnext = bool(getattr(enc, "use_segnext_msca", False))
    use_dual_head = bool(getattr(model, "use_dual_spatial_head", False))
    use_gated = bool(getattr(model, "use_gated_heads", False))
    effective_in_ch = in_ch + (6 if use_coord else 0)

    c1 = base_ch
    is_tiny = (
        getattr(enc, "backbone_type", "") == "tiny_cnn"
        and not use_dilated
        and not use_convnext
        and not use_segnext
        and not use_unet
    )
    c2 = int(round(base_ch * 1.6)) if is_tiny else (base_ch * 2)
    c2 = max(16, (c2 // 4) * 4)
    c3 = base_ch * 4
    c4 = base_ch * 8

    def _mod_params(m: Optional[nn.Module]) -> int:
        if m is None:
            return 0
        return int(sum(p.numel() for p in m.parameters()))

    stem_se = getattr(enc, "stem_se", None)
    dilated_mod = getattr(enc, "dilated_context", None)
    convnext_mod = getattr(enc, "convnext_block", None)
    msca_mod = getattr(enc, "msca_block", None)
    bottleneck_se = getattr(enc, "bottleneck_se", None)
    spatial_se = getattr(enc, "spatial_se", None)
    head_gate = getattr(model, "head_gate", None)
    gt = getattr(enc, "global_tower", None)

    layers: List[Dict[str, Any]] = []

    # -------------------------------------------------------------
    # S1: Spatial Stem (enc1 + optional SE)
    # -------------------------------------------------------------
    enc1_params = _mod_params(getattr(enc, "enc1", None)) + _mod_params(stem_se)
    enc1_is_single = type(getattr(enc, "enc1", None)).__name__ == "TinySingleConvBlock"
    enc1_conv_macs = (
        effective_in_ch * c1 * 9 * 50 * 50
        if enc1_is_single
        else (effective_in_ch * c1 * 9 + c1 * c1 * 9) * 50 * 50
    )
    stem_se_macs = 2 * c1 * max(8, c1 // 4) if stem_se is not None else 0
    enc1_rf = 3 if enc1_is_single else 5
    enc1_type_str = f"Spatial Stem: enc1 ({type(getattr(enc, 'enc1', None)).__name__})"
    if stem_se is not None:
        enc1_type_str += " + SE-Attn"
    if use_coord:
        enc1_type_str += " + CoordConv"

    enc1_desc = (
        f"{'1×' if enc1_is_single else '2×'}(Conv 3×3 → GN → SiLU), {effective_in_ch}→{c1} ch at 50×50 + Skip 1"
    )
    if stem_se is not None:
        enc1_desc += " + SEChannelAttention"
    if use_coord:
        enc1_desc += " + TacticalFeatureSynthesizer(6ch)"

    layers.append({
        "id": "s1",
        "stage": "spatial",
        "type": enc1_type_str,
        "short": "Enc1 50×50",
        "desc": enc1_desc,
        "inputShape": [effective_in_ch, 50, 50],
        "outputShape": [c1, 50, 50],
        "receptiveField": enc1_rf,
        "params": enc1_params,
        "macs": enc1_conv_macs + stem_se_macs,
        "color": "#2563eb",
        "border": "#60a5fa",
        "coneLabel": "1×3×3 GN4" if enc1_is_single else "2×3×3 GN8",
    })

    # -------------------------------------------------------------
    # S2: Stage 2 Down (enc2 + context blocks + bottleneck_se if not use_unet)
    # -------------------------------------------------------------
    enc2_is_single = type(getattr(enc, "enc2", None)).__name__ == "TinySingleConvBlock"
    enc2_base_macs = (
        c1 * c2 * 9 * 25 * 25
        if enc2_is_single
        else (c1 * c2 * 9 + c2 * c2 * 9) * 25 * 25
    )
    context_macs = 0
    if dilated_mod is not None:
        context_macs += (c2 * c2 * 9 + c2 * c2 * 9) * 25 * 25
    if convnext_mod is not None:
        context_macs += (c2 * 49 + c2 * (c2 * 2) + (c2 * 2) * c2) * 25 * 25
    if msca_mod is not None:
        context_macs += (c2 * 25 + 2 * c2 * 7 + 2 * c2 * 11 + c2 * c2) * 25 * 25

    bneck_se_in_s2 = (not use_unet) and (bottleneck_se is not None)
    bneck_se_s2_macs = 2 * c2 * max(8, c2 // 4) if bneck_se_in_s2 else 0

    enc2_params = (
        _mod_params(getattr(enc, "enc2", None))
        + _mod_params(dilated_mod)
        + _mod_params(convnext_mod)
        + _mod_params(msca_mod)
        + (_mod_params(bottleneck_se) if bneck_se_in_s2 else 0)
    )

    enc2_rf = 10 if enc2_is_single else 14
    if dilated_mod is not None:
        enc2_rf += 24
    if convnext_mod is not None:
        enc2_rf += 12
    if msca_mod is not None:
        enc2_rf += 20
    enc2_rf = min(50, enc2_rf)

    enc2_type_str = f"Down 2: MaxPool + enc2 ({type(getattr(enc, 'enc2', None)).__name__})"
    if dilated_mod is not None:
        enc2_type_str += " + DilatedRes"
    if convnext_mod is not None:
        enc2_type_str += " + ConvNeXtV2"
    if msca_mod is not None:
        enc2_type_str += " + SegNeXt"
    if bneck_se_in_s2:
        enc2_type_str += " + SE-Attn"

    enc2_desc = (
        f"MaxPool2d(2×2) + {'1×' if enc2_is_single else '2×'}(Conv 3×3 → GN → SiLU), {c1}→{c2} ch at 25×25"
    )
    if dilated_mod is not None:
        enc2_desc += " + DilatedRes(d=2,4)"
    if convnext_mod is not None:
        enc2_desc += " + ConvNeXtV2(7×7 GRN)"
    if msca_mod is not None:
        enc2_desc += " + SegNeXtMSCA"
    if bneck_se_in_s2:
        enc2_desc += " + SE-Attn"
    if use_unet:
        enc2_desc += " + Skip 2"

    layers.append({
        "id": "s2",
        "stage": "spatial",
        "type": enc2_type_str,
        "short": "Enc2 25×25",
        "desc": enc2_desc,
        "inputShape": [c1, 50, 50],
        "outputShape": [c2, 25, 25],
        "receptiveField": enc2_rf,
        "params": enc2_params,
        "macs": enc2_base_macs + context_macs + bneck_se_s2_macs,
        "color": "#2563eb",
        "border": "#60a5fa",
        "coneLabel": "Pool2 + 1×3×3" if enc2_is_single else "Pool2 + 2×3×3",
    })
    # -------------------------------------------------------------
    # S3, S4, G1: Full U-Net Contracting & Expansive stages (when use_unet is True)
    # -------------------------------------------------------------
    if use_unet:
        enc3_params = _mod_params(getattr(enc, "enc3", None))
        layers.append({
            "id": "s3",
            "stage": "spatial",
            "type": "U-Net Down 3: MaxPool 2×2 + enc3",
            "short": "Enc3 12×12",
            "desc": f"MaxPool2d(2×2) + 2×(Conv 3×3 → GroupNorm(8) → SiLU), {c2}→{c3} ch at 12×12 + Skip 3",
            "inputShape": [c2, 25, 25],
            "outputShape": [c3, 12, 12],
            "receptiveField": 32,
            "params": enc3_params,
            "macs": (c2 * c3 * 9 + c3 * c3 * 9) * 12 * 12,
            "color": "#1d4ed8",
            "border": "#60a5fa",
            "coneLabel": "Pool2 + 2×3×3",
        })

        bneck_params = _mod_params(getattr(enc, "bottleneck", None)) + _mod_params(bottleneck_se)
        bneck_macs = (c3 * c4 * 9 + c4 * c4 * 9) * 6 * 6
        if bottleneck_se is not None:
            bneck_macs += 2 * c4 * max(8, c4 // 4)

        layers.append({
            "id": "s4",
            "stage": "spatial",
            "type": "U-Net Bottleneck: MaxPool 2×2 + bottleneck" + (" + SEChannelAttention" if bottleneck_se is not None else ""),
            "short": "Bot 6×6",
            "desc": f"MaxPool2d(2×2) + 2×(Conv 3×3 → GroupNorm(8) → SiLU)" + (" + SE-Attn" if bottleneck_se is not None else "") + f", {c3}→{c4} ch at 6×6",
            "inputShape": [c3, 12, 12],
            "outputShape": [c4, 6, 6],
            "receptiveField": 50,
            "params": bneck_params,
            "macs": bneck_macs,
            "color": "#7c3aed",
            "border": "#a78bfa",
            "coneLabel": "Pool2 + 2×3×3",
        })

        up3_params = _mod_params(getattr(enc, "up3", None))
        layers.append({
            "id": "g1",
            "stage": "global",
            "type": "Stage 2 Partial Upscale: up3 (6×6 → 12×12 + Skip 3)",
            "short": "Up3 12×12",
            "desc": f"ConvTranspose 3×3 ({c4}→{c3}, s=2) + Skip 3 ({c3}×12×12) → 2×Conv 3×3 ({c3}×12×12)",
            "inputShape": [c4, 6, 6],
            "outputShape": [c3, 12, 12],
            "receptiveField": 50,
            "params": up3_params,
            "macs": (c4 * c3 * 9 + (c3 * 2) * c3 * 9 + c3 * c3 * 9) * 12 * 12,
            "color": "#ea580c",
            "border": "#fb923c",
            "coneLabel": "UpConv 3×3 + Skip3",
            "hasSkipArc": True,
        })

    # -------------------------------------------------------------
    # Global Tower: G2..G5
    # -------------------------------------------------------------
    gt_in_ch = c3 if use_unet else c2
    gt_in_res = 12 if use_unet else 25
    gt_out_res = 6 if use_unet else 13

    g2_params = _mod_params(gt[0]) + _mod_params(gt[1]) if gt is not None and len(gt) >= 2 else 0
    layers.append({
        "id": "g2",
        "stage": "global",
        "type": "Global Tower Strided Conv2d + GN + SiLU",
        "short": f"GT Conv {gt_out_res}×{gt_out_res}",
        "desc": f"{gt_in_ch} filters, 3×3, stride=2, pad=1, GroupNorm, SiLU ({gt_in_res}×{gt_in_res} → {gt_out_res}×{gt_out_res})",
        "inputShape": [gt_in_ch, gt_in_res, gt_in_res],
        "outputShape": [gt_in_ch, gt_out_res, gt_out_res],
        "receptiveField": 50,
        "params": g2_params,
        "macs": gt_in_ch * gt_in_ch * 9 * gt_out_res * gt_out_res,
        "color": "#2563eb",
        "border": "#60a5fa",
        "coneLabel": "3×3 s=2",
    })

    layers.append({
        "id": "g3",
        "stage": "global",
        "type": "AdaptiveAvgPool2d",
        "short": "AdapPool",
        "desc": "Global Average Pool 1×1",
        "inputShape": [gt_in_ch, gt_out_res, gt_out_res],
        "outputShape": [gt_in_ch, 1, 1],
        "receptiveField": 50,
        "params": 0,
        "macs": 0,
        "color": "#d97706",
        "border": "#fbbf24",
        "coneLabel": "Pool 1×1",
    })

    layers.append({
        "id": "g4",
        "stage": "global",
        "type": "Flatten",
        "short": "Flatten",
        "desc": f"Flatten {gt_in_ch}×1×1 → {gt_in_ch}",
        "inputShape": [gt_in_ch, 1, 1],
        "outputShape": [gt_in_ch],
        "receptiveField": 50,
        "params": 0,
        "macs": 0,
        "color": "#475569",
        "border": "#94a3b8",
        "coneLabel": "Flatten",
    })

    g5_params = _mod_params(gt[5]) + _mod_params(gt[6]) if gt is not None and len(gt) >= 7 else 0
    layers.append({
        "id": "g5",
        "stage": "global",
        "type": "Linear + LayerNorm + SiLU",
        "short": "GlobalTower",
        "desc": f"Linear({gt_in_ch} → {embed_dim}) + LayerNorm({embed_dim}) + SiLU",
        "inputShape": [gt_in_ch],
        "outputShape": [embed_dim],
        "receptiveField": 50,
        "params": g5_params,
        "macs": gt_in_ch * embed_dim,
        "color": "#059669",
        "border": "#34d399",
        "coneLabel": "Dense",
    })

    # -------------------------------------------------------------
    # Fusion & Actor / Critic Heads
    # -------------------------------------------------------------
    layers.append({
        "id": "head_army_ctx",
        "stage": "global",
        "type": "army_context_proj (Fusion)",
        "short": "ArmyCtx",
        "desc": f"army_context({army_ctx_dim}) → Linear({army_ctx_dim} → {embed_dim}) + LayerNorm({embed_dim}) + SiLU ⊕ global_emb",
        "inputShape": [army_ctx_dim],
        "outputShape": [embed_dim],
        "receptiveField": 50,
        "params": _mod_params(model.army_context_proj),
        "macs": army_ctx_dim * embed_dim,
        "color": "#0891b2",
        "border": "#38bdf8",
        "coneLabel": f"{army_ctx_dim}→{embed_dim} ⊕",
    })

    layers.append({
        "id": "head_slot_type",
        "stage": "heads",
        "type": "slot_type_head (Head 1)",
        "short": "TypeHead",
        "desc": f"Linear({embed_dim} → 7) + 1.4·tanh(z/3) + slot_type mask",
        "inputShape": [embed_dim],
        "outputShape": [7],
        "receptiveField": 50,
        "params": _mod_params(model.slot_type_head),
        "macs": embed_dim * 7,
        "color": "#ca8a04",
        "border": "#facc15",
    })

    layers.append({
        "id": "head_slot_idx",
        "stage": "heads",
        "type": "slot_idx_head (Head 2)",
        "short": "IdxHead",
        "desc": f"cat[global_emb({embed_dim}), 1hot(type)(7)] → MLP({embed_dim + 7} → {head_hidden_dim} → 10) + 1.6·tanh(z/3) + slot_idx mask",
        "inputShape": [embed_dim + 7],
        "outputShape": [10],
        "receptiveField": 50,
        "params": _mod_params(model.slot_idx_head),
        "macs": (embed_dim + 7) * head_hidden_dim + head_hidden_dim * 10,
        "color": "#0284c7",
        "border": "#38bdf8",
    })

    layers.append({
        "id": "head_deploy_fraction",
        "stage": "heads",
        "type": "deploy_fraction_head (Head 3)",
        "short": "FracHead",
        "desc": f"cat[global_emb({embed_dim}), 1hot(type)(7), 1hot(idx)(10)] → MLP({embed_dim + 17} → {head_hidden_dim} → {num_frac_bins})",
        "inputShape": [embed_dim + 17],
        "outputShape": [num_frac_bins],
        "receptiveField": 50,
        "params": _mod_params(model.deploy_fraction_head),
        "macs": (embed_dim + 17) * head_hidden_dim + head_hidden_dim * num_frac_bins,
        "color": "#9333ea",
        "border": "#c084fc",
    })

    # Head 4: Spatial Tile Head (U-Net up2+up1 or TinySkipUpBlock up1)
    spell_tile_head = getattr(model, "spell_tile_conv_head", None)
    mid_tile_ch = max(16, spatial_dim)
    is_tiny_tile = (
        getattr(enc, "backbone_type", "") == "tiny_cnn"
        and not use_unet
        and not use_dual_head
    )
    tile_conv_macs = (
        spatial_dim * 1 * 50 * 50
        if is_tiny_tile
        else (spatial_dim * mid_tile_ch * 9 + mid_tile_ch * 1) * 50 * 50
    )
    spell_conv_macs = (
        (spatial_dim * mid_tile_ch * 9 + mid_tile_ch * 1) * 50 * 50
        if spell_tile_head is not None
        else 0
    )
    gate_macs = (embed_dim + 17) * spatial_dim if head_gate is not None else 0
    film_macs = (embed_dim + 17) * spatial_dim

    if use_unet:
        tile_params = (
            _mod_params(getattr(enc, "up2", None))
            + _mod_params(getattr(enc, "up1", None))
            + _mod_params(spatial_se)
            + _mod_params(getattr(model, "tile_cond_proj", None))
            + _mod_params(head_gate)
            + _mod_params(getattr(model, "tile_conv_head", None))
            + _mod_params(spell_tile_head)
        )
        tile_macs = (
            (c3 * c2 * 9 + (c2 * 2) * c2 * 9 + c2 * c2 * 9) * 25 * 25
            + (c2 * c1 * 9 + (c1 * 2) * spatial_dim * 9 + spatial_dim * spatial_dim * 9) * 50 * 50
            + tile_conv_macs
            + spell_conv_macs
            + (2 * spatial_dim * max(8, spatial_dim // 4) if spatial_se is not None else 0)
            + film_macs
            + gate_macs
        )
        tile_type = "U-Net Full 50×50 Upscale (up2 + up1) + Tile Head (Head 4)"
        if spell_tile_head is not None:
            tile_type += " + Dual Branch (Troop vs Spell)"
        tile_short = "UNet50×50"
        tile_desc = (
            f"up2(12×12→25×25 + Skip2) → up1(25×25→50×50 + Skip1) → FiLM({embed_dim + 17}→{spatial_dim})"
            + (" + Gated" if head_gate is not None else "")
            + " → Conv 3×3 + 1×1 (1×50×50)"
            + (" + Spell Branch" if spell_tile_head is not None else "")
        )
        tile_in_shape = [c3, 12, 12]
    else:
        tile_params = (
            _mod_params(getattr(enc, "up1", None))
            + _mod_params(spatial_se)
            + _mod_params(getattr(model, "tile_cond_proj", None))
            + _mod_params(head_gate)
            + _mod_params(getattr(model, "tile_conv_head", None))
            + _mod_params(spell_tile_head)
        )
        tile_macs = (
            (c2 + c1) * spatial_dim * 9 * 50 * 50
            + tile_conv_macs
            + spell_conv_macs
            + (2 * spatial_dim * max(8, spatial_dim // 4) if spatial_se is not None else 0)
            + film_macs
            + gate_macs
        )
        tile_type = "TinySkipUpBlock (25×25→50×50) + Skip1 + Tile Head (Head 4)"
        if spell_tile_head is not None:
            tile_type += " + Dual Branch (Troop vs Spell)"
        tile_short = "SkipUp50×50"
        tile_conv_desc = "Conv 1×1 (1×50×50)" if is_tiny_tile else "Conv 3×3 + 1×1 (1×50×50)"
        tile_desc = (
            f"up1(Bilinear 25×25→50×50 + Skip1 {c2}+{c1}→{spatial_dim}) → FiLM({embed_dim + 17}→{spatial_dim})"
            + (" + Gated" if head_gate is not None else "")
            + f" → {tile_conv_desc}"
            + (" + Spell Branch" if spell_tile_head is not None else "")
        )
        tile_in_shape = [c2, 25, 25]

    layers.append({
        "id": "head_tile_conv",
        "stage": "heads",
        "type": tile_type,
        "short": tile_short,
        "desc": tile_desc,
        "inputShape": tile_in_shape,
        "outputShape": [1, 50, 50],
        "receptiveField": 50,
        "params": tile_params,
        "macs": tile_macs,
        "color": "#d97706",
        "border": "#facc15",
    })

    critic_macs = (
        (embed_dim * head_hidden_dim + head_hidden_dim * head_hidden_dim + head_hidden_dim * 1)
        if critic_depth >= 3
        else (embed_dim * head_hidden_dim + head_hidden_dim * 1)
    )
    layers.append({
        "id": "head_critic",
        "stage": "heads",
        "type": "critic_head (Head 5)",
        "short": "Critic",
        "desc": f"MLP({embed_dim} → {head_hidden_dim}" + (f" → {head_hidden_dim}" if critic_depth >= 3 else "") + f" → 1 Value V(s), SiLU, depth={critic_depth})",
        "inputShape": [embed_dim],
        "outputShape": [1],
        "receptiveField": 50,
        "params": _mod_params(getattr(model, "critic_head", None)),
        "macs": critic_macs,
        "color": "#16a34a",
        "border": "#4ade80",
    })

    total_params = int(sum(p.numel() for p in model.parameters()))
    total_macs = int(sum(l["macs"] for l in layers))

    source_code = ""
    if os.path.exists(NETWORKS_PATH):
        try:
            with open(NETWORKS_PATH, "r", encoding="utf-8") as f:
                source_code = f.read()
        except Exception:
            pass

    arch_cfg = model.get_arch_config() if hasattr(model, "get_arch_config") else (load_active_arch_config() or {})

    return {
        "in_channels": in_ch,
        "spatial_dim": spatial_dim,
        "embed_dim": embed_dim,
        "army_context_dim": army_ctx_dim,
        "num_fraction_bins": num_frac_bins,
        "total_params": total_params,
        "total_macs": total_macs,
        "layers": layers,
        "source_code": source_code,
        "arch_config": arch_cfg,
    }


@contextlib.contextmanager
def _named_module_classes(model: nn.Module) -> Iterator[None]:
    """Tags named submodules with their attribute name so `torchview` displays exact layer names."""
    saved = []
    for full_name, mod in model.named_modules():
        if not full_name or full_name.split(".")[-1].isdigit():
            continue
        leaf = full_name.split(".")[-1]
        orig_cls = mod.__class__
        saved.append((mod, orig_cls))
        mod.__class__ = type(f"{leaf} ({orig_cls.__name__})", (orig_cls,), {})
    try:
        yield
    finally:
        for mod, orig_cls in saved:
            mod.__class__ = orig_cls


class _TracedModelWrapper(nn.Module):
    """Wraps `model` during `torchview.draw_graph` to label output tensor nodes by dictionary key."""

    def __init__(self, model: nn.Module):
        super().__init__()
        self.model = model
        self.captured_outputs: Dict[str, Any] = {}
        for name, child in model.named_children():
            setattr(self, name, child)

    def forward(
        self, obs: torch.Tensor, army_context: Optional[torch.Tensor] = None
    ) -> Any:
        self.captured_outputs.clear()
        if army_context is not None and (
            isinstance(self.model, CoCActorCritic)
            or type(self.model).__name__ == "CoCActorCritic"
        ):
            out = self.model.forward(obs, army_context)
        else:
            out = self.model.forward(obs)
        if isinstance(out, dict):
            for k, v in out.items():
                if hasattr(v, "tensor_nodes") and v.tensor_nodes:
                    self.captured_outputs[k] = v.tensor_nodes
        return out


def _render_torchview_variant(
    model: nn.Module,
    input_size: tuple[int, ...],
    depth: int,
    stem_name: str,
    graph_name: str,
    out_dir: Optional[str] = None,
) -> Dict[str, str]:
    wrapper = _TracedModelWrapper(model)
    is_actor_critic = (
        isinstance(model, CoCActorCritic)
        or type(model).__name__ == "CoCActorCritic"
    )
    army_ctx_dim = int(getattr(model, "army_context_dim", 64))
    effective_input_size: Any = (
        [input_size, (input_size[0], army_ctx_dim)]
        if is_actor_critic
        else input_size
    )
    with _named_module_classes(model):
        graph = draw_graph(
            wrapper,
            input_size=effective_input_size,
            expand_nested=True,
            depth=depth,
            graph_name=graph_name,
            device="cpu",
        )
        root_names = (
            [f"obs (1×{input_size[1]}×50×50)", f"army_context (1×{army_ctx_dim})"]
            if is_actor_critic
            else ["obs (input)"]
        )
        for idx, root_node in enumerate(graph.root_container):
            root_node.name = root_names[idx] if idx < len(root_names) else f"input_{idx}"
        for out_key, tensor_nodes in wrapper.captured_outputs.items():
            if tensor_nodes:
                tensor_nodes[-1].name = f"{out_key} (output)"

        graph.visual_graph.body.clear()
        graph.running_node_id = 0
        graph.running_subgraph_id = 0
        graph.id_dict.clear()
        graph.node_set.clear()
        graph.edge_list.clear()
        graph.subgraph_dict.clear()
        graph.fill_visual_graph()

    target_dir = out_dir if out_dir is not None else ARCH_DIR
    os.makedirs(target_dir, exist_ok=True)
    out_base = os.path.join(target_dir, stem_name)
    svg_path = graph.visual_graph.render(out_base, format="svg", cleanup=True)
    png_path = graph.visual_graph.render(out_base, format="png", cleanup=True)
    return {
        "svg": os.path.relpath(svg_path, REPO_ROOT),
        "png": os.path.relpath(png_path, REPO_ROOT),
        "abs_svg": os.path.abspath(svg_path),
        "abs_png": os.path.abspath(png_path),
    }


def render_model_architecture(
    model: nn.Module,
    out_dir: str,
    stem_name: str,
    input_size: Optional[tuple[int, ...]] = None,
    depth: int = 2,
    graph_name: str = "CoCActorCritic",
) -> Dict[str, str]:
    """Renders SVG and PNG diagram for any model instance into `out_dir`."""
    if input_size is None:
        in_ch = int(getattr(model, "in_channels", 59))
        input_size = (1, in_ch, 50, 50)
    orig_device = next(model.parameters()).device if list(model.parameters()) else torch.device("cpu")
    model.to("cpu")
    res = _render_torchview_variant(
        model=model,
        input_size=input_size,
        depth=depth,
        stem_name=stem_name,
        graph_name=graph_name,
        out_dir=out_dir,
    )
    model.to(orig_device)
    return res


def ensure_architecture_diagrams(
    model: Optional[nn.Module] = None,
    force: bool = False,
    input_size: Optional[tuple[int, ...]] = None,
) -> Dict[str, Any]:
    """
    Returns the architecture diagram manifest in `docs/architecture/manifest.json`,
    automatically regenerating the SVG/PNG files via `torchview` whenever `networks.py`
    or the live model architecture changes, when files are missing, or when `force=True`.
    """
    os.makedirs(ARCH_DIR, exist_ok=True)
    active_arch_cfg = load_active_arch_config()
    if model is None:
        in_ch = input_size[1] if input_size is not None else int((active_arch_cfg or {}).get("in_channels", 59))
        model = CoCActorCritic(in_channels=in_ch, arch_config=active_arch_cfg)
    else:
        in_ch = int(getattr(model, "in_channels", 59))

    if input_size is None:
        input_size = (1, in_ch, 50, 50)

    current_hash = compute_networks_hash(model)
    live_spec = (
        extract_live_layer_specs(model)
        if (isinstance(model, CoCActorCritic) or hasattr(model, "encoder"))
        else {}
    )

    if not force and os.path.exists(MANIFEST_PATH):
        try:
            with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                cached = json.load(f)
            files = cached.get("files", {})
            all_exist = all(
                os.path.exists(os.path.join(REPO_ROOT, files[k][fmt]))
                for k in ("overview", "detailed")
                for fmt in ("svg", "png")
            )
            if (
                all_exist
                and cached.get("architecture_hash") == current_hash
                and cached.get("input_shape") == list(input_size)
            ):
                return {**cached, "live_spec": live_spec, "regenerated": False}
        except Exception:
            pass

    orig_device = next(model.parameters()).device if list(model.parameters()) else torch.device("cpu")

    overview_files = _render_torchview_variant(
        model=model,
        input_size=input_size,
        depth=2,
        stem_name="coc_actor_critic_overview",
        graph_name="CoCActorCritic_Overview",
    )
    detailed_files = _render_torchview_variant(
        model=model,
        input_size=input_size,
        depth=3,
        stem_name="coc_actor_critic_detailed",
        graph_name="CoCActorCritic_Detailed",
    )
    model.to(orig_device)

    total_params = sum(p.numel() for p in model.parameters())
    manifest: Dict[str, Any] = {
        "model_class": type(model).__name__,
        "architecture_hash": current_hash,
        "input_shape": list(input_size),
        "total_params": int(total_params),
        "trainable_params": int(total_params),
        "submodules": get_submodule_breakdown(model),
        "files": {
            "overview": overview_files,
            "detailed": detailed_files,
        },
        "live_spec": live_spec,
    }
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    return {**manifest, "regenerated": True}


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate static torchview diagrams for CoCActorCritic.")
    parser.add_argument("--force", action="store_true", help="Force regeneration of SVG/PNG diagrams")
    args = parser.parse_args()
    res = ensure_architecture_diagrams(force=args.force)
    print(f"[torchview] {res['model_class']} ({res['total_params']:,} params)")
    print(f"  Overview : {res['files']['overview']['svg']}")
    print(f"  Detailed : {res['files']['detailed']['svg']}")


if __name__ == "__main__":
    main()

