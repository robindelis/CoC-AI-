---
title: "Model Architecture Evolution Ledger — Bottom-Up Morphing History (Gen 0 to SOTA)"
tags:
  - architecture
  - model-evolution
  - opencode-argon
  - agy-research
  - coc-rl
  - benchmark-ledger
updated: "2026-11-01"
current_generation: "Gen 0 (v4.0-Gen0-TinyCNN)"
current_params: 49830
episode_step_budget: 5000
---

# 🧬 Model Architecture Evolution Ledger (Bottom-Up Morphing)

Back to [[00_Index_MOC|Vault Index (MOC)]] • SOTA Catalog: [[architectures/SOTA_Vision_And_Spatial_RL_Architectures|SOTA Vision & Spatial RL Architectures]] • CoC Strategy & I/O: [[decisions/CoC_Strategy_Concepts_And_Input_Output_Design|CoC Strategy Concepts & Input/Output Design]] • Loop Ledger: [[experiments/Recursive_AI_Improvement_Loop|Recursive AI Self-Improvement Loop]]

---

## 1. Evolutionary Philosophy & Protocol

Instead of locking into a single static neural network, `python/coc_rl/networks.py` is evolved **bit-by-bit** based on empirical 5,000-episode training horizons:

1. **Bare-Minimum Starting Point (`Gen 0: v4.0-Gen0-TinyCNN`, ~50K parameters)**:
   - Trains rapidly to establish the baseline destruction % and star conversion rate achievable with minimal local $3\times 3$ convolutions and a $1\times 1$ spatial tile head.
2. **5,000-Episode Training Horizons**:
   - Each architecture generation trains for **5,000 episodes** (evaluated via the honest 300-episode rolling combat score, $1\star \to 2\star \text{ TH18} \to 3\star$ funnel, and per-village breakdown).
3. **Tactical & Vision Grounded Morphing (`agy` + `opencode`)**:
   - When a generation plateaus, `coc-strategy-researcher` (`agy` • `gemini-3.8-flash-medium`) diagnoses the tactical bottleneck (e.g., exterior funnel drift, core defense range blindness, premature hero ability activation, or spell placement dispersion), and `opencode-model-evolver` (`opencode` • `google-vertex/gemini-4-argon#medium`) rewrites `python/coc_rl/networks.py` to morph the model to the next generation.
4. **Adaptive Weight Transfer (`warm_start` vs. `scratch_restart`)**:
   - Incremental morphs (widening channels, inserting residual/attention blocks, or adding input feature channels) use **shape-aware partial weight transfer (`warm_start`)** via `transfer_compatible_weights()` to preserve learned representations.
   - Fundamental operator replacements use a clean **5,000-episode `scratch_restart`** while archiving the previous generation checkpoint in `trained_models/archives/`.

---

## 2. Generation-by-Generation Architecture Evolution Table

| Gen # | Arch Version Tag | Total Params | Spatial Backbone Summary | Input / Output Tactical Features | Weight Init Mode | Episodes Trained | Pre → Post 300-Ep Destr % | Pre → Post 2★ TH18 / 3★ | Status & Key Finding |
| :---: | :--- | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Gen 0** | `v4.0-Gen0-TinyCNN` | **`~50K`** | 2-layer strided CNN (`59→20` at $50\times 50$, `20→32` at $25\times 25$, bilinear + $1\times 1$ skip fuse `→20`) + `64-D` Global Tower | Raw `(59, 50, 50)` + `64-D` inventory; 4 autoregressive heads + $1\times 1$ `Conv2d(20→1)` spatial tile head | `scratch_restart` | `0 / 5,000` | *Baseline Floor* | *Baseline Floor* | **ACTIVE BASELINE** — Ready for initial 5,000-episode training run. |

---

## 3. Generation Dossiers

### 🌱 Generation 0 — `v4.0-Gen0-TinyCNN` (~50K Parameters • Bare-Minimum Baseline)
- **Initialized At**: `2026-11-01`
- **Design Rationale**:
  - Replaces the legacy 2.48M-parameter 4-stage U-Net with an ultra-compact **~50K-parameter 2-layer strided CNN + $1\times 1$ spatial pointer head** (`base_ch=20`, `spatial_dim=20`, `embed_dim=64`, `head_hidden_dim=48`).
  - Reduces parameter count by **~98%** (`2,480,299` $\to$ `~49,830` parameters) to maximize rollout and PPO minibatch throughput over the initial 5,000-episode benchmark.
- **Layer-by-Layer Topology**:
  - **`enc1` (50×50 Local Stem)**: `Conv2d(59, 20, k=3, s=1, p=1, bias=False) -> GroupNorm(4, 20) -> SiLU` (`10,660` params).
  - **`enc2` (25×25 Strided Context)**: `Conv2d(20, 32, k=3, s=2, p=1, bias=False) -> GroupNorm(8, 32) -> SiLU` (`5,824` params).
  - **`up1` (50×50 Lightweight Fusion)**: Bilinear upsample `(32, 25, 25) -> (32, 50, 50)` concatenated with `enc1 (20, 50, 50)` $\to$ `Conv2d(52, 20, k=1, bias=False) -> GroupNorm(4, 20) -> SiLU` (`1,080` params).
  - **`global_tower` (25×25 → 64-D)**: `Conv2d(32, 48, k=3, s=2, p=1, bias=False) -> GroupNorm(8, 48) -> SiLU -> AdaptiveAvgPool2d(1) -> Flatten -> Linear(48, 64) -> LayerNorm(64) -> SiLU` (`17,120` params).
  - **`army_context_proj` (64-D → 64-D)**: `Linear(64, 64) -> LayerNorm(64) -> SiLU` (`4,288` params).
  - **Autoregressive Actor & Critic Heads (`embed_dim=64`, `head_hidden_dim=48`, `spatial_dim=20`)**:
    - `slot_type_head`: `Linear(64, 7)` (`455` params)
    - `slot_idx_head`: `MLP(71 -> 48 -> 10)` (`3,946` params)
    - `deploy_fraction_head`: `MLP(81 -> 48 -> 5)` (`4,181` params)
    - `tile_cond_proj`: `Linear(81, 20)` (`1,640` params)
    - `tile_conv_head`: `Conv2d(20, 1, k=1)` (`21` params)
    - `critic_head`: `MLP(64 -> 48 -> 1)` (`3,169` params)
- **Planned Next Evolution Step (Gen 0 $\to$ Gen 1 after 5,000 Episodes)**:
  - Once `Gen 0` plateaus after 5,000 episodes, `opencode-model-evolver` (`google-vertex/gemini-4-argon#medium`) will analyze the plateau and morph the network toward **Gen 1 (`v4.1-CoordSE-ResCNN`)** or **Gen 2 (`v4.2-ConvNeXtV2-GRN`)**, introducing explicit TH18 polar/CoordConv channels, Squeeze-and-Excitation channel gating for the 59 sparse planes, and deeper $7\times 7$ depthwise / dilated receptive fields.

---

### 🔄 Cycle #1 — Generation 1 (`v4.1-Gen1-CoordSE-ResCNN`)

- **Timestamp**: `2026-11-01 20:39:17` • **Episode**: `6,240`
- **Transition**: `v4.0-Gen0-TinyCNN` (`55,104` params) → **`v4.1-Gen1-CoordSE-ResCNN`** (**`129,852` params**)
- **Weight Handling Mode**: **`WARM_START`**
- **Pre-Morph Telemetry**: Mean Destr `81.42%`, 2★+ TH18 `85.3%`, 3★ Triple `27.3%`, Combat Score `65.96/100`
- **AGY CoC Strategy & I/O Research (`gemini-3.8-flash-medium`)**: [Rule-of-3 Funneling & TH18 Line-of-Sight Coordinate Geometry] At 81.4% mean destruction (85.3% 2★ TH18, 27.3% 3★), tactical bottleneck requires Enable `TacticalFeatureSynthesizer` (`use_coord_features=True`) to inject 6 explicit CoC spatial strategy planes `(X, Y, TH18_Radial_Dist, TH18_LoS_Angle, Exterior_Funnel_Trash, Active_Frontline_Zone)` plus `SEChannelAttention` (`use_se_attention=True`) to dynamically weight the 59 unit/defense channels.
- **Architectural Morph Rationale**: Triggered after plateauing on Gen 0 (`v4.0-Gen0-TinyCNN` at 81.4% mean destr, 27.3% 3★, worst village `Offset Diamond (Hot Candle)` at 76.9%). Guided by the Obsidian SOTA Vision Catalog and AGY CoC Strategy Research, OpenCode Argon 4 (`google-vertex/gemini-4-argon#medium`) morphs Stage 0 TinyCNN into Gen 1 `CoordSE-ResCNN` by enabling `TacticalFeatureSynthesizer` (6 explicit CoC strategy planes: X/Y coords, TH18 radial distance & Siege LoS angle, exterior funnel trash density, and active frontline zone), double 3x3 residual blocks, and `SEChannelAttention` (`base_ch=24, embed_dim=96`) (`129,852` params, weight mode: `warm_start`).
