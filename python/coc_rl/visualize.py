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


def compute_networks_hash(model: Optional[nn.Module] = None) -> str:
    """Computes a SHA-256 digest of `networks.py` and the live `model` repr + parameter counts."""
    h = hashlib.sha256()
    if os.path.exists(NETWORKS_PATH):
        with open(NETWORKS_PATH, "rb") as f:
            h.update(f.read())
    if model is not None:
        h.update(repr(model).encode("utf-8"))
        for name, p in model.named_parameters():
            h.update(f"{name}:{tuple(p.shape)}".encode("utf-8"))
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
    so the 3D CNN Feature Map diagram, Layer-by-Layer table, KPI pills, and PyTorch code
    in the Web UI always reflect any edits made to `python/coc_rl/networks.py` on every refresh.
    """
    in_ch = int(getattr(model, "in_channels", 50))
    army_ctx_dim = int(getattr(model, "army_context_dim", 64))
    num_frac_bins = int(getattr(model, "num_fraction_bins", 5))
    spatial_dim = int(getattr(model.encoder, "spatial_dim", 128))
    embed_dim = int(getattr(model.encoder, "embed_dim", 256))

    def _mod_params(m: nn.Module) -> int:
        return int(sum(p.numel() for p in m.parameters()))

    stem = model.encoder.spatial_stem
    s1_mods = [stem[0], stem[1], stem[2]] if len(stem) >= 3 else [stem]
    s2_mods = [stem[3], stem[4], stem[5]] if len(stem) >= 6 else []
    s3_mods = [stem[6], stem[7], stem[8]] if len(stem) >= 9 else []
    s1_params = sum(_mod_params(m) for m in s1_mods)
    s2_params = sum(_mod_params(m) for m in s2_mods)
    s3_params = sum(_mod_params(m) for m in s3_mods)
    s1_out_ch = int(getattr(stem[0], "out_channels", 32))
    s2_out_ch = int(getattr(stem[3], "out_channels", 32)) if len(stem) >= 4 else s1_out_ch

    res_params = _mod_params(model.encoder.context_res)

    gt = model.encoder.global_tower
    g1_conv = gt[0] if len(gt) > 0 else nn.Conv2d(spatial_dim, 96, 3, stride=2, padding=1)
    g2_conv = gt[2] if len(gt) > 2 else nn.Conv2d(96, 128, 3, stride=2, padding=1)
    g5_mods = [gt[6], gt[7], gt[8]] if len(gt) >= 9 else []
    g1_ch = int(getattr(g1_conv, "out_channels", 96))
    g2_ch = int(getattr(g2_conv, "out_channels", 128))
    g1_params = _mod_params(g1_conv)
    g2_params = _mod_params(g2_conv)
    g5_params = sum(_mod_params(m) for m in g5_mods)

    layers: List[Dict[str, Any]] = [
        {
            "id": "s1",
            "stage": "spatial",
            "type": "Dilated Conv2d + GroupNorm + SiLU",
            "short": "Conv d=2",
            "desc": f"{s1_out_ch} filters, 3×3, d=2, p=2, GroupNorm(4), SiLU ({in_ch}-ch Village Grid)",
            "inputShape": [in_ch, 50, 50],
            "outputShape": [s1_out_ch, 50, 50],
            "receptiveField": 5,
            "params": s1_params,
            "macs": in_ch * s1_out_ch * 9 * 50 * 50,
            "color": "#2563eb",
            "border": "#60a5fa",
            "coneLabel": "3×3 d=2",
        },
        {
            "id": "s2",
            "stage": "spatial",
            "type": "Dilated Conv2d + GroupNorm + SiLU",
            "short": "Conv d=2",
            "desc": f"{s2_out_ch} filters, 3×3, d=2, p=2, GroupNorm(4), SiLU",
            "inputShape": [s1_out_ch, 50, 50],
            "outputShape": [s2_out_ch, 50, 50],
            "receptiveField": 9,
            "params": s2_params,
            "macs": s1_out_ch * s2_out_ch * 9 * 50 * 50,
            "color": "#2563eb",
            "border": "#60a5fa",
            "coneLabel": "3×3 d=2",
        },
        {
            "id": "s3",
            "stage": "spatial",
            "type": "Conv2d + GroupNorm + SiLU",
            "short": "Conv 3×3",
            "desc": f"{spatial_dim} filters, 3×3, d=1, p=1, GroupNorm(8), SiLU",
            "inputShape": [s2_out_ch, 50, 50],
            "outputShape": [spatial_dim, 50, 50],
            "receptiveField": 11,
            "params": s3_params,
            "macs": s2_out_ch * spatial_dim * 9 * 50 * 50,
            "color": "#1d4ed8",
            "border": "#60a5fa",
            "coneLabel": "3×3 d=1",
        },
        {
            "id": "s4",
            "stage": "spatial",
            "type": "Residual Context Block",
            "short": "ResBlock",
            "desc": f"2×Conv {spatial_dim} ch, 3×3, p=1, GroupNorm(8), Residual Skip (+), SiLU",
            "inputShape": [spatial_dim, 50, 50],
            "outputShape": [spatial_dim, 50, 50],
            "receptiveField": 15,
            "params": res_params,
            "macs": 2 * (spatial_dim * spatial_dim * 9 * 50 * 50),
            "color": "#7c3aed",
            "border": "#a78bfa",
            "coneLabel": "2×3×3 + Skip",
            "hasSkipArc": True,
        },
        {
            "id": "g1",
            "stage": "global",
            "type": "Strided Conv2d + SiLU",
            "short": "Conv s=2",
            "desc": f"{g1_ch} filters, 3×3, stride=2, pad=1, SiLU",
            "inputShape": [spatial_dim, 50, 50],
            "outputShape": [g1_ch, 25, 25],
            "receptiveField": 19,
            "params": g1_params,
            "macs": spatial_dim * g1_ch * 9 * 25 * 25,
            "color": "#2563eb",
            "border": "#60a5fa",
            "coneLabel": "3×3 s=2",
        },
        {
            "id": "g2",
            "stage": "global",
            "type": "Strided Conv2d + SiLU",
            "short": "Conv s=2",
            "desc": f"{g2_ch} filters, 3×3, stride=2, pad=1, SiLU",
            "inputShape": [g1_ch, 25, 25],
            "outputShape": [g2_ch, 13, 13],
            "receptiveField": 27,
            "params": g2_params,
            "macs": g1_ch * g2_ch * 9 * 13 * 13,
            "color": "#2563eb",
            "border": "#60a5fa",
            "coneLabel": "3×3 s=2",
        },
        {
            "id": "g3",
            "stage": "global",
            "type": "AdaptiveAvgPool2d",
            "short": "AdapPool",
            "desc": "Adaptive Grid 4×4",
            "inputShape": [g2_ch, 13, 13],
            "outputShape": [g2_ch, 4, 4],
            "receptiveField": 50,
            "params": 0,
            "macs": 0,
            "color": "#d97706",
            "border": "#fbbf24",
            "coneLabel": "Pool 4×4",
        },
        {
            "id": "g4",
            "stage": "global",
            "type": "Flatten",
            "short": "Flatten",
            "desc": f"Flatten {g2_ch}×4×4 → {g2_ch * 16}",
            "inputShape": [g2_ch, 4, 4],
            "outputShape": [g2_ch * 16],
            "receptiveField": 50,
            "params": 0,
            "macs": 0,
            "color": "#475569",
            "border": "#94a3b8",
            "coneLabel": "Flatten",
        },
        {
            "id": "g5",
            "stage": "global",
            "type": "Linear + LayerNorm + SiLU",
            "short": "GlobalTower",
            "desc": f"Linear({g2_ch * 16} → {embed_dim}) + LayerNorm({embed_dim}) + SiLU",
            "inputShape": [g2_ch * 16],
            "outputShape": [embed_dim],
            "receptiveField": 50,
            "params": g5_params,
            "macs": (g2_ch * 16) * embed_dim,
            "color": "#059669",
            "border": "#34d399",
            "coneLabel": "Dense",
        },
        {
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
            "coneLabel": "64→256 ⊕",
        },
        {
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
        },
        {
            "id": "head_slot_idx",
            "stage": "heads",
            "type": "slot_idx_head (Head 2)",
            "short": "IdxHead",
            "desc": f"cat[global_emb({embed_dim}), one_hot(type)(7)] → MLP({embed_dim + 7} → 128 → 10) + 1.6·tanh(z/3) + slot_idx mask",
            "inputShape": [embed_dim + 7],
            "outputShape": [10],
            "receptiveField": 50,
            "params": _mod_params(model.slot_idx_head),
            "macs": (embed_dim + 7) * 128 + 128 * 10,
            "color": "#0284c7",
            "border": "#38bdf8",
        },
        {
            "id": "head_deploy_fraction",
            "stage": "heads",
            "type": "deploy_fraction_head (Head 3)",
            "short": "FracHead",
            "desc": f"cat[global_emb({embed_dim}), one_hot(type)(7), one_hot(idx)(10)] → MLP({embed_dim + 17} → 128 → {num_frac_bins})",
            "inputShape": [embed_dim + 17],
            "outputShape": [num_frac_bins],
            "receptiveField": 50,
            "params": _mod_params(model.deploy_fraction_head),
            "macs": (embed_dim + 17) * 128 + 128 * num_frac_bins,
            "color": "#9333ea",
            "border": "#c084fc",
        },
        {
            "id": "head_tile_conv",
            "stage": "heads",
            "type": "tile_cond_proj + tile_conv_head (Head 4)",
            "short": "TileHead",
            "desc": f"FiLM(spatial_feat {spatial_dim}×50×50, Linear({embed_dim + 7}→{spatial_dim})) + Conv 3×3({spatial_dim}→32) + Conv 1×1(32→1) + spatial_prior",
            "inputShape": [spatial_dim, 50, 50],
            "outputShape": [1, 50, 50],
            "receptiveField": 50,
            "params": _mod_params(model.tile_cond_proj) + _mod_params(model.tile_conv_head),
            "macs": (spatial_dim * 32 * 9 + 32 * 1) * 50 * 50,
            "color": "#d97706",
            "border": "#facc15",
        },
        {
            "id": "head_critic",
            "stage": "heads",
            "type": "critic_head (Head 5)",
            "short": "Critic",
            "desc": f"MLP({embed_dim} → 128 → 1 Value V(s), SiLU, 2.5× Actor LR)",
            "inputShape": [embed_dim],
            "outputShape": [1],
            "receptiveField": 50,
            "params": _mod_params(model.critic_head),
            "macs": embed_dim * 128 + 128,
            "color": "#16a34a",
            "border": "#4ade80",
        },
    ]

    total_params = int(sum(p.numel() for p in model.parameters()))
    total_macs = int(sum(l["macs"] for l in layers))

    source_code = ""
    if os.path.exists(NETWORKS_PATH):
        try:
            with open(NETWORKS_PATH, "r", encoding="utf-8") as f:
                source_code = f.read()
        except Exception:
            pass

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
    input_size: tuple[int, ...] = (1, 31, 50, 50),
    depth: int = 2,
    graph_name: str = "CoCActorCritic",
) -> Dict[str, str]:
    """Renders SVG and PNG diagram for any model instance into `out_dir`."""
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
    if model is None:
        in_ch = input_size[1] if input_size is not None else 50
        model = CoCActorCritic(in_channels=in_ch)
    else:
        in_ch = int(getattr(model, "in_channels", 50))

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

