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
├── start_ai_studio.sh                # Launcher for PyTorch GPU backend (8000) + Vite UI (5173)
├── crates/
│   ├── coc-data/                     # Static catalog, stats, footprints, and presets (src/lib.rs, buildings.rs, presets.rs)
│   ├── coc-engine/                   # Deterministic simulation engine (src/lib.rs, grid.rs, sim.rs)
│   ├── coc-wasm/                     # WebAssembly bindings for browser canvas (src/lib.rs)
│   └── coc-py/                       # PyO3 native Python extension & Rayon parallel rollout env (src/lib.rs)
├── python/                           # Production AI / RL runtime, GPU trainer, and FastAPI AI bridge
│   ├── coc_rl/                       # Envs, networks.py, visualize.py, ppo.py, vault_generator.py
│   ├── train_ai.py                   # PyTorch GPU PPO trainer & layout benchmark CLI
│   ├── ai_server.py                  # FastAPI bridge server for Web AI Studio (port 8000)
│   ├── visualize_model.py            # CLI entrypoint to generate SVG/PNG torchview graphs
│   └── generate_vault.py             # CLI entrypoint to rebuild Obsidian vault & canvas
├── .agents/agents/                   # Version-controlled agent definitions
│   ├── vault-updater/agent.md        # Specialist Obsidian vault sync agent (agy, gemini-3.8-flash-medium)
│   └── model-visualizer/agent.md     # Specialist neural model visualizer agent (agy, gemini-3.8-flash-medium)
├── obsidian_vault/                   # Central Long-Term Memory & Source of Truth
│   ├── 00_Index_MOC.md               # Central Map of Content index & sync banner
│   ├── 01_Model_Architecture_and_Training_Tracker.canvas # Visual interactive 2D whiteboard
│   ├── decisions/                    # Architectural Decision Records (ADR ledger)
│   ├── architectures/                # Model architecture dossiers
│   ├── encodings/                    # Spatial tensor (59ch) & inventory (64-D) specifications
│   ├── experiments/                  # Benchmark dossiers & AI diagnostics
│   └── assets/                       # SVG computation graphs & training curve charts
├── scripts/                          # Tooling & utilities
│   ├── post_task_background.sh       # Asynchronous background post-task model & vault sync runner
│   ├── vault_diff.py                 # Incremental Git commit drift detector for Obsidian vault
│   ├── fetch_assets.py               # Sprite/font asset downloader
│   └── csv_logic_audit.py            # Supercell CSV integrity auditor
└── web/                              # React 18 + TypeScript + Vite 6 frontend
    ├── src/main.tsx & App.tsx        # React root shell & navigation
    ├── src/canvas/                   # HTML5 2D Battlefield canvas (BattlefieldCanvas.tsx, fx.ts, spriteLoader.ts)
    ├── src/game/                     # Game views (Battle Arena HUD, 44x44 Village Editor, Army Builder)
    └── src/ai/                       # AI Studio views, tensor visualizers & FastAPI client
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

#### A. 59-Channel Spatial Observation Tensor `(B, 59, 50, 50)`
Extracted by [`extract_spatial_observation()`](file:///home/robin/Projects/CoC/crates/coc-engine/src/sim.rs#L6435) on the 50×50 grid (see full specification in [`Defense_And_Unit_Spatial_Encoding.md`](file:///home/robin/Projects/CoC/obsidian_vault/encodings/Defense_And_Unit_Spatial_Encoding.md)):
- **`Ch 0..4` (Base & Environment)**: Building HP ratio (`hp / 11000.0`), Defense DPS threat (`min(dps / 750.0, 1.0)`), TH18 4×4 mask (`1.0`), Wall durability (`hp / max_hp`), and No-Deploy Red Zone (`1.0` on forbidden buffer tiles).
- **`Ch 5..16` (12 Friendly Army Troops, Siege & CC)**: Normalized density `count / max_in_army` on tile for Thrower, Healer, Furnace, Druid/Bear, Ice Golem, Super Wall Breaker, Headhunter, Balloon, Archer, Log Launcher Siege, CC Super Yeti, CC Super Valkyrie.
- **`Ch 17..20` (4 Friendly Heroes)**: `1.0` if alive on tile for Barbarian King, Archer Queen, Grand Warden, Royal Champion.
- **`Ch 21..24` (4 Friendly Spells)**: Summoned Totem HP ratio, and fading AoE remaining duration `rem / total` for Rage, Poison, and Skeleton spells.
- **`Ch 25..33` (9 Defending Enemy Units & Heroes)**: Defending CC Troops / TH18 Guardian, Barbarian King, Archer Queen, Grand Warden, Royal Champion, Minion Prince, Dragon Duke, Ground Skeletons, and Air Skeletons.
- **`Ch 34..55` (22 Dedicated Defense Types & Clan Castle)**: Archer Tower, Multi-Archer Tower, Ricochet Cannon, Cannon, Mortar, Air Defense, Wizard Tower, Super Wizard Tower, Air Sweeper (facing cone angle), Hidden Tesla (revealed-only), Bomb Tower, X-Bow (Ground vs Air+Ground mode), Inferno Tower (Single vs Multi mode), Scattershot, Builder's Hut (turret), Spell Tower (Rage/Poison/Invis/Quake modes), Monolith, Multi-Gear Tower, Firespitter (150° cone angle), Revenge Tower, Hot Candle (Inferno Candle), and Clan Castle.
- **`Ch 56..58` (3 Non-Offensive Building Groups)**: Resource Storages & Hero Hall (`hp / max_hp`), Resource Collectors (`hp / max_hp`), and Utility/Other Buildings (`hp / max_hp`).

#### B. 64-Dimensional Live Available Army Inventory Vector (`army_context`)
Extracted by [`extract_army_context()`](file:///home/robin/Projects/CoC/crates/coc-engine/src/sim.rs#L6573) and projected via `Linear(64 -> 256) + LayerNorm + SiLU`:
- **`[0..4]` Global Battle Progress**: Remaining time fraction `((1800 - tick) / 1800)`, destruction `% / 100`, stars `/ 3`, alive attacker count `/ 50`.
- **`[4..24]` 10 Troop Slots (20 floats, 2 per slot `i in 0..9`)**: `(troop_id + 1) / 60.0` and `remaining_count / 20.0` (drops strictly to `0.0` when depleted).
- **`[24..44]` 10 Spell Slots (20 floats, 2 per slot `i in 0..9`)**: `(spell_id + 1) / 20.0` and `remaining_count / 8.0` (drops strictly to `0.0` when depleted).
- **`[44..56]` 4 Hero Slots (12 floats, 3 per hero `i in 0..3`)**: Composite signature `((hero_id + 1)*60 + eq_sig + pet_sig) / 500.0`, HP ratio / dock availability, and ability readiness (`0.5` dock, `1.0` ready, `0.0` spent).
- **`[56..64]` Siege Machine & Clan Castle Slots (8 floats)**: Siege ID, dock availability, deployed unpopped flag, CC popped flag, and CC Troop Slots 0 & 1.

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
- **Role**: Uses incremental Git commit diffs (`scripts/vault_diff.py`) to detect code drift since the last synced commit in `obsidian_vault/.sync_state.json`; reads only the modified code lines without full-codebase scanning; records Architectural Decision Records (ADRs) in `obsidian_vault/decisions/Architecture_Decisions_And_System_Memory.md`; regenerates diagrams and the interactive canvas via `generate_vault.py`; marks the new commit as synced and commits to Git.

### ⚠️ MANDATORY RULE: Synchronize the Vault on Codebase Changes
Whenever ANY change is made to the codebase (simulation engine, observation space, action heads, neural architectures, or training pipeline), the `vault-updater` agent **MUST BE RUN** to reconcile and update the Obsidian vault.

```bash
# Check incremental code drift since last vault sync (or view targeted diff):
python3 scripts/vault_diff.py
python3 scripts/vault_diff.py --summary

# Run vault-updater non-interactively using agy with Gemini 3.8 Flash Medium:
agy --agent vault-updater --model gemini-3.8-flash-medium -p "Update the vault with the latest codebase changes"

# Run vault-updater interactively:
agy --agent vault-updater --model gemini-3.8-flash-medium
```

---

## Persisting Model Visualizer Agent (`model-visualizer`)

The project registers a specialized agent for neural network visualization, layer telemetry, and architecture representation:
- **Agent Name**: `model-visualizer`
- **Model**: `gemini-3.8-flash-medium`
- **CLI Framework**: Google Antigravity CLI (`agy`)
- **Agent Definitions**:
  - Global CLI runtime: `~/.gemini/config/agents/model-visualizer/agent.md`
  - Version-controlled repo source: [`.agents/agents/model-visualizer/agent.md`](file:///home/robin/Projects/CoC/.agents/agents/model-visualizer/agent.md)
- **Role**: Maintains `python/coc_rl/visualize.py`, `python/visualize_model.py`, live layer telemetry, `torchview` computation graphs (`docs/architecture/`), and web visualizer contracts in sync with model definitions.

### ⚠️ MANDATORY RULE: Model Visualization Exclusively via `model-visualizer`
Everything related to the visualize files (`python/coc_rl/visualize.py`, `python/visualize_model.py`) and showing the model representation (live layer specifications, MACs/parameter computations, receptive field telemetry, `torchview` computation graphs, and web visualizer payloads) **MUST BE DONE VIA THIS SPECIALIZED AGENT**.

The agent is aware of where neural network architectures and model implementations are defined across the entire codebase:
1. **Primary Production RL Models (`python/coc_rl/networks.py`)**:
   - `CoCActorCritic`: Main factorized actor-critic model (59×50×50 observation + 64-D army context -> 4 autoregressive actor heads: `slot_type`, `slot_idx`, `deploy_fraction`, `tile_xy` + scalar `critic_head`).
   - `CoCSpatialEncoder`: Dual-pathway 50×50 spatial CNN / U-Net backbone (`enc1`, `enc2`, `enc3`, `bottleneck`, `up3`, `up2`, `up1`, `global_tower`).
   - `UNetConvBlock` & `UNetUpBlock`: Convolutional downsampling/upsampling blocks with GroupNorm and SiLU.
   - `DilatedResBlock`: Residual context block preserving exact 50×50 spatial resolution.
2. **Downstream Visualization Consumers**:
   - `python/ai_server.py`: Serves `/api/ai/model-architecture` powered by `extract_live_layer_specs()`.
   - `python/coc_rl/vault_generator.py`: Embeds model architecture diagrams into Obsidian canvas.
   - `web/src/ai/AIStudioView.tsx` & `RLAcademyView.tsx`: Consumes live layer specs to render the interactive 3D layer visualizer, receptive field inspector, and live PyTorch code.
   - `docs/architecture/`: Publication-grade SVG/PNG diagrams (`coc_actor_critic_overview.svg`, `coc_actor_critic_detailed.svg`) and `manifest.json`.

```bash
# Run model-visualizer non-interactively using agy with Gemini 3.8 Flash Medium:
agy --agent model-visualizer --model gemini-3.8-flash-medium -p "Update model visualization to reflect latest networks.py architecture"

# Run model-visualizer interactively:
agy --agent model-visualizer --model gemini-3.8-flash-medium

# Direct CLI command for regenerating static computation graphs:
.venv/bin/python python/visualize_model.py --force
```

---

## Mandatory Post-Task Protocol: Asynchronous Background Maintenance

Whenever any code changes, refactors, simulation updates, or neural network modifications are made, the agent **MUST ALWAYS run the model visualization and vault update workflows in the background at the very end of the task**.

### ⚠️ CORE INVARIANT: Never Block on Post-Task Maintenance
- **Strict Prohibition**: NEVER run post-task synchronization synchronously blocking the agent response or forcing Robin to wait before sending his next prompt.
- **Immediate Response**: Launch the maintenance asynchronously in the background as the final step, then immediately complete the turn so Robin can continue prompting without interruption.

### How to Run in the Background:

1. **Automated Background Runner Script (Recommended)**:
   ```bash
   # Launch detached in the background with output logged:
   nohup bash scripts/post_task_background.sh > .logs/post_task_sync.log 2>&1 &
   ```
   *Features of [`scripts/post_task_background.sh`](file:///home/robin/Projects/CoC/scripts/post_task_background.sh)*:
   - **Mutex Locked (`flock`)**: Prevents duplicate or overlapping sync runs.
   - **Smart Drift Detection**: Inspects `git diff` for model/visualization files (`networks.py`, `visualize.py`, `visualize_model.py`) to trigger `model-visualizer`; runs `python3 scripts/vault_diff.py --status` to detect code drift and trigger `vault-updater`.
   - **Auto Commit & Push**: Automatically stages updated artifacts (`obsidian_vault/`, `docs/architecture/`), commits, rebases, and pushes to `origin main`.
   - **Audit Log**: Progress is continuously streamed to `.logs/post_task_sync.log` (`tail -f .logs/post_task_sync.log`).

2. **Direct CLI Background Invocations**:
   ```bash
   # Model visualizer in background:
   agy --agent model-visualizer --model gemini-3.8-flash-medium --dangerously-skip-permissions -p "Reconcile model architecture visualizations and manifest with latest codebase" &

   # Vault updater in background:
   agy --agent vault-updater --model gemini-3.8-flash-medium --dangerously-skip-permissions -p "Update the vault with the latest codebase changes" &
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

# 4. Run CLI PPO training or layout benchmark
.venv/bin/python python/train_ai.py --train-ppo --episodes 20

# 5. Launch the Python GPU AI Studio Server (port 8000)
.venv/bin/python python/ai_server.py

# 6. Rebuild or Update the Obsidian Vault & Canvas
.venv/bin/python python/generate_vault.py
# Or run the persisting AI agent to reconcile and update architectural memory:
agy --agent vault-updater --model gemini-3.8-flash-medium -p "Update the vault with the latest codebase changes"

# 7. Update Model Architecture Visualizations & Computation Graphs
agy --agent model-visualizer --model gemini-3.8-flash-medium -p "Update model visualization to reflect latest networks.py architecture"
# Or directly run the CLI entrypoint:
.venv/bin/python python/visualize_model.py --force
```

## Git Workflow

- **Always push changes to GitHub**: After completing any code or documentation changes, stage, commit with a clear message, and push to the remote GitHub repository (`git push origin main`) every time.

