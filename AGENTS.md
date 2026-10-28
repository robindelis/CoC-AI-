# AGENTS.md — CoC Simulator

## Project Overview

A Clash of Clans Town Hall 18 combat simulator, village layout editor, and reinforcement learning environment. The simulation core is written in Rust and compiled to both WebAssembly (for the interactive browser sandbox) and a native Python extension (for RL training and layout evaluation).

## Reference Game Data (`coc_dumps/`)

- `coc_dumps/` (project root) holds the **complete decoded `csv_logic` of the current game version**, extracted by the user from their own device copy of Clash of Clans — this is the numeric source of truth for `coc-data`. Regenerate with `python3 coc_dumps/extract_coc_csv.py` (pulls the asset-pack APK out of `~/.local/share/waydroid/data/app`).
- Layout: `logic/` (combat & balance tables: `buildings.csv`, `characters.csv` (troops + attacking characters), `heroes.csv`, `pets.csv`, `spells.csv`, `traps.csv`, `projectiles.csv`, `special_abilities.csv`, `character_items.csv` (hero equipment), `seasonal_defense_*.csv` (crafted defenses), `townhall_levels.csv`, `globals.csv`), `csv/` (presentation config), `localization/` (TID → text).
- Supercell CSV conventions: line 1 = column names, line 2 = types, then data; a block's name appears only on the **first row** of its level group (forward-fill column 0); levels are per-row (`BuildingLevel` / `Level` / `VisualLevel`).
- Units: `AttackRange`/100 → tiles (1050 = 10.5 t); timings (`AttackSpeed`, durations) are **milliseconds**; damage is raw HP points; `Speed` is raw movement units (projectile thumb-rule: /80 ≈ tiles-per-second — arrow 1400 → 17.5 t/s, mortar 500 → 6.25 t/s, Thrower spear 700 → 8.75 t/s).
- Gotchas: the **Hot Candle** is the Season 4 crafted defense named "Inferno Candle" internally (`seasonal_defense_*.csv`; max module value = our Level-30 spec: 6000 HP, 125 dmg/0.5 s, 10.5 t range, 6→4→3 flames melting at 78 s / 131 s). **Minion Prince** and **Dragon Duke** only exist in `heroes.csv` (`TID_MINION_HERO`, `TID_DRAGON_DUKE`), not in `characters.csv`.
- The stat audit tool that cross-checks these tables against `coc-data` lives at `scripts/csv_logic_audit.py`.
- `Clash of Clans - v18.647.2.apk` (workspace root) is just the split base-APK shell — it ships no game data and is kept only as a version reference.

## Tech Stack

- **Simulation Core**: Rust (2021 edition, Cargo workspace)
  - Serialization: `serde`, `serde_json`
- **Web Assembly Bridge**: `wasm-bindgen`, built with `wasm-pack` (`--target web`)
- **Frontend (`web/`)**: React 18, TypeScript, Vite 6, HTML5 2D Canvas, `lucide-react`
- **Python Bindings & Deep RL (`crates/coc-py/`, `python/`, `.venv/`)**: `PyO3` (ABI3), `maturin`, `rayon` (parallel layout evaluation), `PyTorch 2.14.1+cu130` (CUDA GPU acceleration), `gymnasium`, `numpy`, `fastapi`, `uvicorn`

## Repository & File Structure

```text
/home/robin/Projects/CoC/
├── Cargo.toml                        # Rust workspace manifest (coc-data, coc-engine, coc-wasm, coc-py)
├── start_ai_studio.sh                # One-command launcher for the PyTorch GPU backend (8000) + Vite UI (5173)
├── crates/
│   ├── coc-data/                     # Static data definitions and presets
│   │   ├── src/lib.rs                # Exports FullCatalog and data modules
│   │   ├── src/buildings.rs          # Building specs, footprints, stats, and defense modes
│   │   ├── src/traps.rs              # Trap specs, trigger radii, and effects
│   │   ├── src/troops.rs             # Troop and siege machine specs
│   │   ├── src/heroes.rs             # Hero, hero equipment, and pet specs
│   │   ├── src/spells.rs             # Spell specs and effect types
│   │   └── src/presets.rs            # VillageLayout / ArmyLoadout structs and default presets
│   ├── coc-engine/                   # Deterministic combat simulation engine
│   │   ├── src/lib.rs                # Exports grid and simulation modules + unit tests
│   │   ├── src/grid.rs               # 50x50 grid validation, no-deploy mask, and A* pathfinding
│   │   └── src/sim.rs                # Tick-based combat loop (BattleEngine, units, buildings, spells, traps)
│   ├── coc-wasm/                     # WebAssembly bindings for the browser UI
│   │   └── src/lib.rs                # WasmBattleSession wrapper and JSON bridge functions
│   └── coc-py/                       # Native Python module (PyO3 + Rayon)
│       ├── Cargo.toml
│       ├── pyproject.toml
│       └── src/lib.rs                # PyBattleEnv class, action masks, and parallel layout evaluation
├── learning/                         # Isolated educational curriculum (PyTorch warmup & Deep RL labs)
│   ├── pytorch_bootcamp/
│   │   ├── bootcamp_exercises.py
│   │   ├── bootcamp_solutions.py
│   │   └── verify_bootcamp.py
│   └── rl_labs/
│       ├── student_lab.py            # Guided 4-stage hands-on PyTorch Deep RL workbook (CNN, Actor-Critic, GAE, PPO)
│       ├── reference_solution.py     # Complete reference PyTorch implementation for Labs 1–4
│       └── verify_labs.py            # Automated CUDA unit & shape verifier for student_lab.py
├── python/                           # Production AI / RL runtime, GPU trainer, and FastAPI AI bridge
│   ├── coc_rl/
│   │   ├── __init__.py
│   │   ├── envs.py                   # Gymnasium environment (CoCAttackerEnv) and layout mutator (CoCDefenderEvolution)
│   │   ├── networks.py               # Standalone CoCSpatialEncoder & CoCActorCritic neural networks
│   │   └── ppo.py                    # Standalone reward shaping, GAE, and PPO update step
│   ├── train_ai.py                   # CLI PyTorch GPU PPO trainer & Rayon base evolution benchmark
│   └── ai_server.py                  # FastAPI bridge server for the Web AI Studio
├── scripts/
│   └── fetch_assets.py               # Utility script to download sprite and font assets into web/public/assets/
└── web/                              # React + TypeScript + Vite web application
    ├── package.json
    ├── vite.config.ts
    ├── public/assets/                # Static sprites (.webp/.png) and fonts
    └── src/
        ├── main.tsx                  # React root entry point
        ├── App.tsx                   # Top-level shell routing between Game views and AI Studio
        ├── types.ts                  # TypeScript interfaces mirroring Rust structs
        ├── assetsManifest.ts         # Sprite asset path mappings
        ├── styles.css                # Application styling
        ├── wasm-pkg/                 # Generated wasm-pack output consumed by the frontend
        ├── canvas/
        │   ├── BattlefieldCanvas.tsx # HTML5 Canvas renderer (2.5D isometric & 2D top-down views, pan/zoom, pointer input)
        │   ├── fx.ts                 # 60fps combat FX overlay layer
        │   └── spriteLoader.ts       # Image preloader, cache, and sprite sizing helpers
        ├── game/                     # Pure Game UI components (no AI dependencies)
        │   ├── GameBattleHud.tsx     # Manual Battle Arena HUD, timer, playback controls, and deployment dock
        │   ├── GameVillageEditor.tsx # 44x44 Village Editor palette, tools, and building inspector
        │   ├── GameArmyBuilder.tsx   # Army composition, hero equipment, and pet selection UI
        │   └── GameTacticalDrawer.tsx# Tactical overlays and live entity telemetry drawer
        └── ai/                       # Dedicated AI Studio UI, client, and types
            ├── AIStudioView.tsx      # AI Attack Sandbox, Spatial Tensor Inspector, GPU PPO Trainer & Base Evolution
            ├── aiClient.ts           # FastAPI AI server client
            └── aiTypes.ts            # AI telemetry and tensor interfaces
```

## Build & Development Commands

```bash
# 1. Run Rust unit tests
. "$HOME/.cargo/env" && cargo test -p coc-engine

# 2. Rebuild WASM package (required after editing coc-data, coc-engine, or coc-wasm)
. "$HOME/.cargo/env" && wasm-pack build crates/coc-wasm --target web --out-dir ../../web/src/wasm-pkg

# 3. Build Python extension into the local CUDA PyTorch .venv
. "$HOME/.cargo/env" && env -u CONDA_PREFIX VIRTUAL_ENV="$PWD/.venv" .venv/bin/maturin develop --release -m crates/coc-py/Cargo.toml

# 4. Verify the Educational Labs on GPU or run CLI PPO training
.venv/bin/python learning/rl_labs/verify_labs.py
.venv/bin/python learning/pytorch_bootcamp/verify_bootcamp.py
.venv/bin/python python/train_ai.py --train-ppo --episodes 20

# 5. Launch the Python GPU AI Studio Server (port 8000)
.venv/bin/python python/ai_server.py

# 6. Rebuild or Update the Obsidian Vault & Canvas
.venv/bin/python python/generate_vault.py
```

## Git Workflow

- **Always push changes to GitHub**: After completing any code or documentation changes, stage, commit with a clear message, and push to the remote GitHub repository (`git push origin main`) every time.

