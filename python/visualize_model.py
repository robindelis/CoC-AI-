#!/usr/bin/env python3
"""CLI entrypoint to generate or live-watch `torchview` diagrams for `CoCActorCritic`."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from coc_rl.visualize import main

if __name__ == "__main__":
    main()
