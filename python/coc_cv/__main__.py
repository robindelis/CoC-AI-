"""CLI entrypoint for `python -m coc_cv`."""

import sys

from .cli import main

if __name__ == "__main__":
    sys.exit(main())
