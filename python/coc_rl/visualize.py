"""
Automated `torchview` Neural Architecture Visualizer & Live Sync System.

Generates publication-grade SVG & PNG computation graphs of `CoCActorCritic`
(`overview` at depth=2 and `detailed` at depth=3) with automatic submodule naming
and input/output tensor labeling.

Automatically detects changes to `python/coc_rl/networks.py` or `CoCActorCritic`
structure via SHA-256 fingerprinting and regenerates:
  - `docs/architecture/coc_actor_critic_overview.svg` & `.png`
  - `docs/architecture/coc_actor_critic_detailed.svg` & `.png`
  - `docs/architecture/manifest.json`
  - `docs/AI_Architecture.canvas` (live parameter & submodule table + embedded diagrams)
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import importlib
import inspect
import json
import os
import sys
import time
from typing import Any, Dict, Iterator, List, Optional

import torch
import torch.nn as nn
from torchview import draw_graph

from . import networks
from .networks import CoCActorCritic, CoCSpatialEncoder

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ARCH_DIR = os.path.join(REPO_ROOT, "docs", "architecture")
MANIFEST_PATH = os.path.join(ARCH_DIR, "manifest.json")
CANVAS_PATH = os.path.join(REPO_ROOT, "docs", "AI_Architecture.canvas")
NETWORKS_FILE = os.path.abspath(networks.__file__)


def get_submodule_breakdown(model: nn.Module) -> List[Dict[str, Any]]:
    """Returns parameter counts and layer types for top-level logical blocks."""
    rows: List[Dict[str, Any]] = []
    for name, mod in model.named_modules():
        if not name or "." in name and not name.startswith("encoder."):
            continue
        if name == "encoder":
            continue
        leaf = name.split(".")[-1]
        if leaf.isdigit():
            continue
        params = sum(p.numel() for p in mod.parameters())
        rows.append(
            {
                "name": name,
                "type": type(mod).__name__,
                "params": int(params),
            }
        )
    return rows


def compute_architecture_hash(model: nn.Module) -> str:
    """
    Computes a deterministic SHA-256 fingerprint of the network's source code,
    module hierarchy (`repr(model)`), and parameter shapes.
    """
    h = hashlib.sha256()
    if os.path.exists(NETWORKS_FILE):
        with open(NETWORKS_FILE, "rb") as f:
            h.update(f.read())
    else:
        h.update(inspect.getsource(CoCSpatialEncoder).encode("utf-8"))
        h.update(inspect.getsource(model.__class__).encode("utf-8"))

    h.update(repr(model).encode("utf-8"))
    for name, p in model.named_parameters():
        h.update(f"{name}:{tuple(p.shape)}:{p.dtype};".encode("utf-8"))
    return h.hexdigest()


@contextlib.contextmanager
def _named_module_classes(model: nn.Module) -> Iterator[None]:
    """
    Temporarily tags named submodules' class `__name__` with their Python attribute
    name (e.g. `spatial_stem (Sequential)`, `slot_type_head (Linear)`) so `torchview`
    renders exact attribute names automatically for any current or future layers.
    """
    saved = []
    for full_name, mod in model.named_modules():
        if not full_name:
            continue
        leaf = full_name.split(".")[-1]
        if leaf.isdigit():
            continue
        orig_cls = mod.__class__
        saved.append((mod, orig_cls))
        mod.__class__ = type(f"{leaf} ({orig_cls.__name__})", (orig_cls,), {})
    try:
        yield
    finally:
        for mod, orig_cls in saved:
            mod.__class__ = orig_cls


class _TracedModelWrapper(nn.Module):
    """
    Wraps `model` during `torchview.draw_graph` to capture the terminal `TensorNode`
    of each returned dictionary key or tuple element so output nodes receive their
    exact semantic names (`type_logits (output)`, `value (output)`, etc.).
    """

    def __init__(self, model: nn.Module):
        super().__init__()
        self.model = model
        self.captured_outputs: Dict[str, Any] = {}
        # Expose child attributes at top level so depth matches `model` directly
        for name, child in model.named_children():
            setattr(self, name, child)

    def forward(self, obs: torch.Tensor) -> Any:
        self.captured_outputs.clear()
        out = self.model.forward(obs)
        if isinstance(out, dict):
            for k, v in out.items():
                if hasattr(v, "tensor_nodes") and v.tensor_nodes:
                    self.captured_outputs[k] = v.tensor_nodes
        elif isinstance(out, (tuple, list)):
            for i, v in enumerate(out):
                if hasattr(v, "tensor_nodes") and v.tensor_nodes:
                    self.captured_outputs[f"output_{i}"] = v.tensor_nodes
        return out


def _render_torchview_variant(
    model: nn.Module,
    input_size: tuple[int, ...],
    depth: int,
    stem_name: str,
    graph_name: str,
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

        # Label root input tensor node(s) and named output tensor node(s)
        for root_node in graph.root_container:
            root_node.name = "obs (input)"
        for out_key, tensor_nodes in wrapper.captured_outputs.items():
            if tensor_nodes:
                tensor_nodes[-1].name = f"{out_key} (output)"

        # Rebuild visual_graph with the semantic input/output node labels
        graph.visual_graph.body.clear()
        graph.running_node_id = 0
        graph.running_subgraph_id = 0
        graph.id_dict.clear()
        graph.node_set.clear()
        graph.edge_list.clear()
        graph.subgraph_dict.clear()
        graph.fill_visual_graph()

    out_base = os.path.join(ARCH_DIR, stem_name)
    svg_path = graph.visual_graph.render(out_base, format="svg", cleanup=True)
    png_path = graph.visual_graph.render(out_base, format="png", cleanup=True)
    return {
        "svg": os.path.relpath(svg_path, REPO_ROOT),
        "png": os.path.relpath(png_path, REPO_ROOT),
    }


_SVG_MEM_CACHE: Dict[str, str] = {}


def render_custom_torchview_svg(
    model: nn.Module,
    input_size: tuple[int, ...] = (1, 8, 50, 50),
    depth: int = 2,
    graph_dir: str = "LR",
) -> str:
    """
    Renders a `torchview` computation graph SVG in-memory for any custom or default
    `CoCActorCritic` instance, cached by `(arch_hash, depth, graph_dir)`.
    """
    arch_hash = compute_architecture_hash(model)
    cache_key = f"{arch_hash}:d={depth}:dir={graph_dir}"
    if cache_key in _SVG_MEM_CACHE:
        return _SVG_MEM_CACHE[cache_key]

    orig_device = (
        next(model.parameters()).device
        if list(model.parameters())
        else torch.device("cpu")
    )
    wrapper = _TracedModelWrapper(model)
    with _named_module_classes(model):
        graph = draw_graph(
            wrapper,
            input_size=input_size,
            expand_nested=True,
            depth=depth,
            graph_dir=graph_dir,
            graph_name="Custom_CoCActorCritic",
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

    model.to(orig_device)
    svg_str = graph.visual_graph.pipe(format="svg").decode("utf-8")
    if len(_SVG_MEM_CACHE) > 32:
        _SVG_MEM_CACHE.clear()
    _SVG_MEM_CACHE[cache_key] = svg_str
    return svg_str



def _sync_obsidian_canvas(manifest: Dict[str, Any]) -> None:
    """
    Updates `docs/AI_Architecture.canvas` so the Obsidian Canvas includes a live
    auto-updated Torchview & Parameter Summary card plus embedded file cards for the
    generated `torchview` diagrams.
    """
    if not os.path.exists(CANVAS_PATH):
        return

    try:
        with open(CANVAS_PATH, "r", encoding="utf-8") as f:
            canvas = json.load(f)
    except Exception:
        return

    breakdown_lines = [
        "### Live Network Telemetry & Torchview Sync",
        f"- **Architecture Hash**: `{manifest['architecture_hash'][:12]}`",
        f"- **Total Parameters**: **`{manifest['total_params']:,}`** (`input_shape = {tuple(manifest['input_shape'])}`)",
        f"- **Last Auto-Synced**: `{manifest['updated_at']}`",
        "",
        "| Submodule | Layer Type | Params |",
        "| :--- | :--- | ---: |",
    ]
    for row in manifest.get("submodules", []):
        breakdown_lines.append(
            f"| `{row['name']}` | `{row['type']}` | `{row['params']:,}` |"
        )
    summary_text = "\n".join(breakdown_lines)

    auto_nodes = [
        {
            "id": "group-torchview",
            "type": "group",
            "x": 1520,
            "y": 1460,
            "width": 1820,
            "height": 1180,
            "color": "4",
            "label": "6. Auto-Synced Torchview Computation Graphs (docs/architecture/)",
        },
        {
            "id": "torchview-summary",
            "type": "text",
            "x": 1560,
            "y": 1520,
            "width": 520,
            "height": 420,
            "color": "4",
            "text": summary_text,
        },
        {
            "id": "torchview-overview-img",
            "type": "file",
            "file": manifest["files"]["overview"]["png"],
            "x": 2120,
            "y": 1520,
            "width": 560,
            "height": 1080,
            "color": "4",
        },
        {
            "id": "torchview-detailed-img",
            "type": "file",
            "file": manifest["files"]["detailed"]["png"],
            "x": 2720,
            "y": 1520,
            "width": 580,
            "height": 1080,
            "color": "4",
        },
    ]
    auto_ids = {n["id"] for n in auto_nodes}
    existing_nodes = [n for n in canvas.get("nodes", []) if n.get("id") not in auto_ids]
    canvas["nodes"] = existing_nodes + auto_nodes

    auto_edge = {
        "id": "e-actor-torchview",
        "fromNode": "actor-output",
        "fromSide": "bottom",
        "toNode": "torchview-summary",
        "toSide": "top",
        "toEnd": "arrow",
        "color": "4",
        "label": "torchview auto-sync",
    }
    existing_edges = [
        e for e in canvas.get("edges", []) if e.get("id") != auto_edge["id"]
    ]
    canvas["edges"] = existing_edges + [auto_edge]

    with open(CANVAS_PATH, "w", encoding="utf-8") as f:
        json.dump(canvas, f, indent=2)


def ensure_architecture_diagrams(
    model: Optional[nn.Module] = None,
    force: bool = False,
    input_size: tuple[int, ...] = (1, 8, 50, 50),
) -> Dict[str, Any]:
    """
    Checks whether `CoCActorCritic` has changed since the last render.
    If unchanged and all diagram files exist, returns the cached manifest in <1ms.
    If changed (or `force=True`), re-renders `torchview` overview & detailed diagrams
    and updates `docs/architecture/manifest.json` + `docs/AI_Architecture.canvas`.
    """
    os.makedirs(ARCH_DIR, exist_ok=True)
    if model is None:
        model = CoCActorCritic(in_channels=input_size[1])

    arch_hash = compute_architecture_hash(model)

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
            if cached.get("architecture_hash") == arch_hash and all_exist:
                return {**cached, "regenerated": False}
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
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)

    manifest: Dict[str, Any] = {
        "model_class": type(model).__name__,
        "architecture_hash": arch_hash,
        "input_shape": list(input_size),
        "total_params": int(total_params),
        "trainable_params": int(trainable_params),
        "submodules": get_submodule_breakdown(model),
        "files": {
            "overview": overview_files,
            "detailed": detailed_files,
        },
        "updated_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    _sync_obsidian_canvas(manifest)
    return {**manifest, "regenerated": True}


def watch_network_changes(poll_interval: float = 0.5) -> None:
    """
    Watches `python/coc_rl/networks.py` for edits and automatically re-renders
    `torchview` diagrams whenever the network changes.
    """
    print(f"[torchview-watch] Watching {os.path.relpath(NETWORKS_FILE, REPO_ROOT)} for changes...")
    res = ensure_architecture_diagrams(force=False)
    status = "Regenerated" if res["regenerated"] else "Up-to-date"
    print(
        f"[torchview-watch] {status} | hash={res['architecture_hash'][:12]} | "
        f"params={res['total_params']:,} | {res['files']['overview']['png']}"
    )

    last_mtime = os.path.getmtime(NETWORKS_FILE) if os.path.exists(NETWORKS_FILE) else 0.0
    try:
        while True:
            time.sleep(poll_interval)
            if not os.path.exists(NETWORKS_FILE):
                continue
            mtime = os.path.getmtime(NETWORKS_FILE)
            if mtime != last_mtime:
                last_mtime = mtime
                try:
                    importlib.reload(networks)
                    fresh_model = networks.CoCActorCritic(in_channels=8)
                    res = ensure_architecture_diagrams(model=fresh_model, force=False)
                    if res["regenerated"]:
                        print(
                            f"[torchview-watch] Network change detected -> Regenerated diagrams! "
                            f"(hash={res['architecture_hash'][:12]}, params={res['total_params']:,})"
                        )
                    else:
                        print("[torchview-watch] File saved (architecture hash unchanged).")
                except Exception as exc:
                    print(f"[torchview-watch] Error while reloading network: {exc}")
    except KeyboardInterrupt:
        print("\n[torchview-watch] Stopped.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate and auto-sync torchview computation graphs for CoCActorCritic."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force regeneration even if the architecture hash has not changed",
    )
    parser.add_argument(
        "--watch",
        action="store_true",
        help="Watch python/coc_rl/networks.py and auto-regenerate diagrams on save",
    )
    args = parser.parse_args()

    if args.watch:
        watch_network_changes()
    else:
        res = ensure_architecture_diagrams(force=args.force)
        state = "Regenerated" if res["regenerated"] else "Already up-to-date"
        print(
            f"[torchview] {state} | {res['model_class']} ({res['total_params']:,} params) | "
            f"hash={res['architecture_hash'][:12]}"
        )
        print(f"  Overview : {res['files']['overview']['png']} & {res['files']['overview']['svg']}")
        print(f"  Detailed : {res['files']['detailed']['png']} & {res['files']['detailed']['svg']}")
        print(f"  Manifest : {os.path.relpath(MANIFEST_PATH, REPO_ROOT)}")
        print(f"  Canvas   : {os.path.relpath(CANVAS_PATH, REPO_ROOT)}")


if __name__ == "__main__":
    main()
