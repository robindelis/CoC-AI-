"""
Static `torchview` Computation Graph Generator for `CoCActorCritic`.

Renders publication-grade SVG and PNG diagrams of `CoCActorCritic`
(`overview` at depth=2 and `detailed` at depth=3) into `docs/architecture/`.
"""

from __future__ import annotations

import argparse
import contextlib
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

    def forward(self, obs: torch.Tensor) -> Any:
        self.captured_outputs.clear()
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
    with _named_module_classes(model):
        graph = draw_graph(
            wrapper,
            input_size=input_size,
            expand_nested=True,
            depth=depth,
            graph_name=graph_name,
            device="cpu",
        )
        for root_node in graph.root_container:
            root_node.name = "obs (input)"
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
    input_size: tuple[int, ...] = (1, 10, 50, 50),
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
    input_size: tuple[int, ...] = (1, 8, 50, 50),
) -> Dict[str, Any]:
    """
    Returns the cached static architecture diagram manifest in `docs/architecture/manifest.json`,
    generating the SVG/PNG files via `torchview` only if missing or when `force=True`.
    """
    os.makedirs(ARCH_DIR, exist_ok=True)
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
            if all_exist:
                return {**cached, "regenerated": False}
        except Exception:
            pass

    if model is None:
        model = CoCActorCritic(in_channels=input_size[1])
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
        "input_shape": list(input_size),
        "total_params": int(total_params),
        "trainable_params": int(total_params),
        "submodules": get_submodule_breakdown(model),
        "files": {
            "overview": overview_files,
            "detailed": detailed_files,
        },
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
