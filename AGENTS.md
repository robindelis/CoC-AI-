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
│   │   ├── envs.py                   # Gymnasium environment (CoCAttackerEnv)
│   │   ├── networks.py               # Standalone CoCSpatialEncoder & CoCActorCritic neural networks
│   │   ├── ppo.py                    # Standalone reward shaping, GAE, and PPO update step
│   │   └── vault_generator.py        # Obsidian vault and canvas auto-generation engine
│   ├── train_ai.py                   # CLI PyTorch GPU PPO trainer & benchmark
│   ├── ai_server.py                  # FastAPI bridge server for the Web AI Studio
│   └── generate_vault.py             # CLI entrypoint to rebuild Obsidian vault and canvas
├── .agents/                          # Persisting agent definitions (checked into Git)
│   └── agents/
│       └── vault-updater/
│           └── agent.md              # Specialist Obsidian vault sync agent (agy, gemini-3.8-flash-medium)
├── obsidian_vault/                   # Central Long-Term Memory & Source of Truth
│   ├── 00_Index_MOC.md               # Master Map of Content index
│   ├── 01_Model_Architecture_and_Training_Tracker.canvas # Visual interactive 2D whiteboard
│   ├── decisions/                    # Architectural Decision Records (ADRs) & system memory ledger
│   │   └── Architecture_Decisions_And_System_Memory.md
│   ├── architectures/                # Neural network architecture specifications
│   │   └── v3.0_31Ch_PerDefense_SingleArmy_ActorCritic.md
│   ├── encodings/                    # Spatial tensor and army inventory encoding specs
│   │   ├── Defense_And_Unit_Spatial_Encoding.md
│   │   └── Unit_Type_Spatial_Encoding.md
│   ├── experiments/                  # Empirical benchmarks and AI diagnostics
│   │   ├── Experiment_Log_And_Benchmarks.md
│   │   └── AI_Diagnostics_And_Training_Fixes.md
│   ├── runs/                         # Model run dossiers and session histories
│   └── assets/                       # Computation graphs (SVG/PNG) and training curves
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
            ├── AIStudioView.tsx      # AI Attack Sandbox, Spatial Tensor Inspector & GPU PPO Trainer
            ├── aiClient.ts           # FastAPI AI server client
            └── aiTypes.ts            # AI telemetry and tensor interfaces
```

## Long-Term Memory & Obsidian Vault (Source of Truth)

The [`obsidian_vault/`](file:///home/robin/Projects/CoC/obsidian_vault) directory is the project's permanent **Long-Term Memory** and **authoritative single source of truth** for all architectural decisions, tensor formulations, combat mechanics invariants, and empirical findings.

- **Mandatory Invariant**: The content of the Obsidian vault represents the canonical decisions taken along the project and **must be updated as the project evolves**. Any modification to simulation logic, observation formats, action heads, reward functions, or training paradigms must be documented in the vault.
- **Key Memory Assets**:
  - [`00_Index_MOC.md`](file:///home/robin/Projects/CoC/obsidian_vault/00_Index_MOC.md): Central Map of Content index.
  - [`Architecture_Decisions_And_System_Memory.md`](file:///home/robin/Projects/CoC/obsidian_vault/decisions/Architecture_Decisions_And_System_Memory.md): Architectural Decision Records (ADR-001 through ADR-006) and formal system memory ledger.
  - [`v3.0_31Ch_PerDefense_SingleArmy_ActorCritic.md`](file:///home/robin/Projects/CoC/obsidian_vault/architectures/v3.0_31Ch_PerDefense_SingleArmy_ActorCritic.md): Full layer-by-layer neural network specification (1.36M params).
  - [`Defense_And_Unit_Spatial_Encoding.md`](file:///home/robin/Projects/CoC/obsidian_vault/encodings/Defense_And_Unit_Spatial_Encoding.md): Detailed 31-channel per-defense spatial grid and 64-D live inventory encoding.
  - [`Unit_Type_Spatial_Encoding.md`](file:///home/robin/Projects/CoC/obsidian_vault/encodings/Unit_Type_Spatial_Encoding.md): Hierarchical unit archetype signature mapping for allied and enemy units.
  - [`01_Model_Architecture_and_Training_Tracker.canvas`](file:///home/robin/Projects/CoC/obsidian_vault/01_Model_Architecture_and_Training_Tracker.canvas): Interactive visual 2D whiteboard tracking computation graphs, comp-vs-village evaluations, and training curves.

---

## Deep RL State & Action Space Invariants (Current Implementation)

The current reinforcement learning pipeline (`v3.0`) operates on a dual-input observation space and a factorized multi-discrete action space with autoregressive conditioning and invalid-action masking:

### 1. Current Input Implementation

#### A. 31-Channel Spatial Observation Tensor `(B, 31, 50, 50)`
Extracted by [`extract_spatial_observation()`](file:///home/robin/Projects/CoC/crates/coc-engine/src/sim.rs#L6435) on the 50×50 battlefield grid:
- **`Ch 0` — Building HP Ratio**: `hp / 11000.0` in `[0, 1]` across living building footprints. Unrevealed Hidden Teslas are masked to `0.0`.
- **`Ch 1` — Defense DPS Threat**: `min(spec.dps / 750.0, 1.0)` across active defenses. Unrevealed Hidden Teslas are masked to `0.0`.
- **`Ch 2` — Town Hall 18 Mask**: `1.0` on the 4×4 TH18 footprint, `0.0` elsewhere. Pinpoints the 2nd Victory Star objective.
- **`Ch 3` — Wall Durability**: `hp / max_hp` in `[0, 1]` for each 1×1 wall piece. Destroyed walls drop to `0.0`.
- **`Ch 4` — No-Deploy Red Zone**: `1.0` on forbidden tiles (building buffer halos), `0.0` on legal deployment green zone.
- **`Ch 5` — Friendly Ground HP Density**: `min(sum(ground_hp) / 5000.0, 1.0)` friendly ground mass concentration.
- **`Ch 6` — Friendly Air HP Density**: `min(sum(air_hp) / 5000.0, 1.0)` friendly air mass concentration.
- **`Ch 7` — Active Spell Fields**: `1.0` at the center tile of active Rage, Heal, Freeze, Invisibility, Poison, Overgrowth, or Totem spells.
- **`Ch 8` — Allied Unit Type Signature**: `max_{u} phi(u) in [0, 1]` (Swarm `0.10`, Melee Tank `0.35`, Ranged DPS `0.60`, Healer `0.81`, Hero `0.99`).
- **`Ch 9` — Enemy Unit Type Signature**: `max_{u} phi(u) in [0, 1]` (Defending CC, Heroes, Guardians, Ground Skeletons `0.10`, Air Skeletons `0.28`).
- **`Ch 10..30` — 21 Dedicated Defense Type Channels** (3×3 footprint unless noted):
  - `Ch 10`: Archer Tower (`1.0`)
  - `Ch 11`: Multi-Archer Tower (`1.0`)
  - `Ch 12`: Ricochet Cannon (`1.0`)
  - `Ch 13`: Cannon (`1.0`)
  - `Ch 14`: Mortar (`1.0`)
  - `Ch 15`: Air Defense (`1.0`)
  - `Ch 16`: Wizard Tower (`1.0`)
  - `Ch 17`: Super Wizard Tower (`1.0`)
  - `Ch 18`: Air Sweeper (`2×2`, encodes `0.25 + 0.75 * (theta_deg / 360.0)` for facing cone angle)
  - `Ch 19`: Hidden Tesla (`2×2`, `1.0` ONLY when revealed by unit proximity or >=51% destruction; strictly `0.0` when hidden)
  - `Ch 20`: Bomb Tower (`1.0`)
  - `Ch 21`: X-Bow (`1.0` Air+Ground 11.5t mode, `0.5` Ground-only 14.0t mode)
  - `Ch 22`: Inferno Tower (`1.0` Single-Target ramp beam, `0.5` Multi-Target 6-beam mode)
  - `Ch 23`: Scattershot (`1.0`)
  - `Ch 24`: Builder's Hut (`2×2`, `1.0`, weaponized turret + healing builder)
  - `Ch 25`: Spell Tower (`2×2`, `0.25` Rage, `0.50` Poison, `0.75` Invis, `1.00` Earthquake mode)
  - `Ch 26`: Monolith (`1.0`)
  - `Ch 27`: Multi-Gear Tower (`1.0` Long Range mode, `0.5` Fast Attack mode)
  - `Ch 28`: Firespitter (`0.25 + 0.75 * (theta_deg / 360.0)` for 150° piercing cone angle)
  - `Ch 29`: Revenge Tower (`1.0`)
  - `Ch 30`: Hot Candle / CraftingStation (`1.0`, Season 4 crafted defense)

#### B. 64-Dimensional Live Available Army Inventory Vector (`army_context`)
Extracted by [`extract_army_context()`](file:///home/robin/Projects/CoC/crates/coc-engine/src/sim.rs#L6573) and projected via `Linear(64 -> 256) + LayerNorm + SiLU`:
- **`[0..4]` Global Battle Progress**: Remaining time fraction `((1800 - tick) / 1800)`, destruction `% / 100`, stars `/ 3`, alive attacker count `/ 50`.
- **`[4..24]` 10 Troop Slots (20 floats, 2 per slot `i in 0..9`)**: `(troop_id + 1) / 60.0` and `remaining_count / 20.0`.
  - **Depletion Invariant**: As soon as `remaining_count == 0`, **both entries immediately drop to `0.0`**.
- **`[24..44]` 10 Spell Slots (20 floats, 2 per slot `i in 0..9`)**: `(spell_id + 1) / 20.0` and `remaining_count / 8.0`.
  - **Depletion Invariant**: As soon as `remaining_count == 0`, **both entries immediately drop to `0.0`**.
- **`[44..56]` 4 Hero Slots (12 floats, 3 per hero `i in 0..3`)**:
  - Entry 0: Composite signature `((hero_id + 1)*60 + eq_sig + pet_sig) / 500.0` encoding hero identity, equipment pair, and pet.
  - Entry 1: Availability or HP ratio (`1.0` if in dock ready to deploy; `u.hp / u.max_hp` once deployed).
  - Entry 2: Ability state (`0.5` undeployed in dock, `1.0` deployed and ability ready, `0.0` ability spent).
- **`[56..64]` Siege Machine & Clan Castle Slots (8 floats)**:
  - `ctx[56]`: `(siege_id + 1) / 60.0` normalized siege ID.
  - `ctx[57]`: Undeployed siege availability (`1.0` ready, `0.0` spent/none).
  - `ctx[58]`: Deployed siege pop availability (`1.0` active on field unpopped, `0.0` popped/none).
  - `ctx[59]`: Attacker Clan Castle popped flag (`1.0` popped, `0.0` unpopped).
  - `ctx[60..61]`: CC Troop Slot 0 (`(id + 1) / 60.0` and `count / 5.0`).
  - `ctx[62..63]`: CC Troop Slot 1 (`(id + 1) / 60.0` and `count / 5.0`).

### 2. Current Output Implementation (Action & Critic Heads)

Defined in [`CoCActorCritic`](file:///home/robin/Projects/CoC/python/coc_rl/networks.py#L136-L260), factoring the action space into 4 autoregressively conditioned actor heads plus 1 critic value head:

| Head | Name | Logits / Dim | Conditioning | Tactical Semantics |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **`slot_type`** | `7` | `global_emb (256)` | Action category: `0=NoOp`, `1=Troop`, `2=Hero`, `3=HeroAbility`, `4=Siege`, `5=PopSiege`, `6=Spell`. Masked by available types. |
| **2** | **`slot_idx`** | `10` | `global_emb + one_hot(type)` (263-D) | Loadout slot index `0..9` (which troop, spell, or hero 0..3). Masked to valid slots with `rem > 0`. |
| **3** | **`deploy_fraction`** | `5` | `global_emb + one_hot(type) + one_hot(idx)` (273-D) | Discrete fraction bins `(0.0, 0.25, 0.50, 0.75, 1.00)` mapping to batch deploy size: `max(1, round(avail * frac))`. |
| **4** | **`tile_xy`** | `2500` | `global_emb + one_hot(type)` FiLM + `spatial_features` | 50×50 deployment tile coordinate. Masked by `no_deploy_mask` for troops/heroes/siege; unrestricted for spells. |
| **5** | **`value`** | `1` (scalar) | `global_emb (256)` | Critic estimate $V(s) \in \mathbb{R}$ of expected discounted return, trained via clipped MSE against GAE targets. |

---

## Persisting Vault Updater Agent (`vault-updater`)

The project registers a persisting agent specialized in keeping the Obsidian vault synchronized with the real state of the codebase:
- **Agent Name**: `vault-updater`
- **Model**: `gemini-3.8-flash-medium`
- **CLI Framework**: Google Antigravity CLI (`agy`)
- **Agent Definitions**:
  - Global CLI runtime: `~/.gemini/config/agents/vault-updater/agent.md`
  - Version-controlled repo source: [`.agents/agents/vault-updater/agent.md`](file:///home/robin/Projects/CoC/.agents/agents/vault-updater/agent.md)
- **Role**: Detects changes in Rust simulation code, Python RL environments, neural networks, or presets; updates the corresponding markdown files and ADRs in `obsidian_vault/`; regenerates diagrams and the interactive canvas via `generate_vault.py`.

### ⚠️ MANDATORY RULE: Synchronize the Vault on Codebase Changes
Whenever ANY change is made to the codebase (simulation engine, observation space, action heads, neural architectures, or training pipeline), the `vault-updater` agent **MUST BE RUN** to reconcile and update the Obsidian vault.

```bash
# Run vault-updater non-interactively using agy with Gemini 3.8 Flash Medium:
agy --agent vault-updater --model gemini-3.8-flash-medium -p "Update the vault with the latest codebase changes"

# Run vault-updater interactively:
agy --agent vault-updater --model gemini-3.8-flash-medium
```

---

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
# Or run the persisting AI agent to reconcile and update architectural memory:
agy --agent vault-updater --model gemini-3.8-flash-medium -p "Update the vault with the latest codebase changes"
```

## Git Workflow

- **Always push changes to GitHub**: After completing any code or documentation changes, stage, commit with a clear message, and push to the remote GitHub repository (`git push origin main`) every time.

