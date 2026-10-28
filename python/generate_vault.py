#!/usr/bin/env python3
"""
CLI entrypoint to generate and update the Obsidian Vault & Canvas for CoC TH18 Deep RL.
Tracks model architectures, inputs/outputs, CNN images, reward functions,
hyperparameters, comp-vs-village benchmark matrices, training curves, and resumed sessions.
"""

import argparse
import os
import sys

# Ensure python directory is on PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from coc_rl.vault_generator import rebuild_entire_vault


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Auto-generate the Obsidian Canvas & Vault for CoC TH18 Deep RL models."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force re-evaluation of all 15 comp-vs-village matchups and re-render diagrams",
    )
    args = parser.parse_args()

    res = rebuild_entire_vault(force_eval=args.force)
    print(f"\n[DONE] Generated Canvas: {res['canvas_file']}")
    print(f"       Tracked Models : {res['models_count']}")


if __name__ == "__main__":
    main()
