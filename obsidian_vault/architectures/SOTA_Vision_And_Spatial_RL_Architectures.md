---
title: "State-of-the-Art (SOTA) Vision & Spatial RL Architectures — Reference Catalog for Evolutionary Model Morphing"
tags:
  - architecture
  - sota-vision
  - spatial-rl
  - convnext-v2
  - segnext
  - hrnet
  - swin-v2
  - vision-mamba
  - unireplknet
  - alphastar
  - model-evolution
updated: "2026-11-01"
---

# 🏛️ State-of-the-Art (SOTA) Vision & Spatial RL Architectures Catalog

Back to [[00_Index_MOC|Vault Index (MOC)]] • Companion Strategy Spec: [[decisions/CoC_Strategy_Concepts_And_Input_Output_Design|CoC Strategy Concepts & Input/Output Design]] • Evolution Ledger: [[architectures/Model_Architecture_Evolution_Ledger|Model Architecture Evolution Ledger]] • Loop Ledger: [[experiments/Recursive_AI_Improvement_Loop|Recursive AI Self-Improvement Loop]]

---

## 1. Purpose & Role in the Bottom-Up Evolutionary Pipeline

Rather than starting with an over-parameterized multi-million-weight network that is slow to iterate and masks structural bottlenecks, our **Evolutionary Vision Architecture Pipeline** builds the model bottom-up:

1. **Start at Generation 0 (`v4.0-Gen0-TinyCNN`, ~50K parameters)**: A bare-minimum 2-layer strided CNN + $1\times 1$ spatial tile projection head.
2. **Train in 5,000-Episode Horizons**: Evaluate empirical combat metrics over a 300-episode rolling window at the end of each 5,000-episode training block.
3. **Autonomous Morphing via OpenCode Argon 4 (`google-vertex/gemini-4-argon#medium`)**: When training plateaus, the OpenCode Argon 4 medium-effort agent consults **this SOTA Vision Catalog**, the **[[decisions/CoC_Strategy_Concepts_And_Input_Output_Design|Clash of Clans Strategy & Input/Output Design Dossier]]**, and **live training telemetry** to morph `python/coc_rl/networks.py` step-by-step—introducing only the architectural inductive biases warranted by the observed failure modes.

---

## 2. Comparative Landscape of SOTA Vision & Spatial-RL Backbones (2024–2026)

| Architecture Family | Core Mathematical Operator | Receptive Field Scaling | Parameter / Compute Profile | Primary Strength for CoC TH18 $50\times 50$ Tactical Grid |
| :--- | :--- | :--- | :--- | :--- |
| **0. Bare-Min Strided CNN (`TinyCNN`)** | $3\times 3$ Conv (`s=1`) + $3\times 3$ Conv (`s=2`) + $1\times 1$ Pointer | Local ($5\times 5$ to $7\times 7$ tiles) | **Ultra-Light (~50K params, ~18M MACs)** | Maximum PPO rollout & update speed; learns border deployment mask and immediate proximity cues. |
| **1. CoordConv + IMPALA ResNet** | Explicit $(x, y, r_{\text{TH}}, \theta_{\text{TH}})$ coords + Pre-Act $3\times 3$ ResBlocks | Medium ($15\times 15$ tiles) | **Light (~95K–160K params)** | Breaks translation equivariance; gives policy exact awareness of board center, perimeter, and TH18 vector. |
| **2. Squeeze-and-Excitation (`SE` / `ECA`)** | Global Avg/Max Pool $\to$ MLP Sigmoid channel gating | Global channel context | **Negligible (+2K–8K params)** | Suppresses empty/zero channels among the 59 sparse unit/defense planes and amplifies active threats. |
| **3. ConvNeXt V2 (`DWConv 7×7 + GRN`)** | $7\times 7$ Depthwise Conv + Inverted Bottleneck + Global Response Norm (`GRN`) | Broad local ($15\times 15$ to $29\times 29$ tiles) | **Highly Efficient (~150K–350K params)** | $7\times 7$ depthwise kernels match defense range rings (7–11 tiles) at a fraction of dense $3\times 3$ cost; `GRN` prevents channel feature collapse. |
| **4. SegNeXt (`MSCA` Strip Attention)** | Multi-scale depthwise strip convolutions ($1\times 7 + 7\times 1$, $1\times 11 + 11\times 1$, $1\times 21 + 21\times 1$) | Directional & elongated ($21\times 21+$ tiles) | **Efficient (~180K–450K params)** | Ideal for linear wall compartments, Log Launcher / Giant Arrow line-of-sight rays, and funnel corridors. |
| **5. Dilated RepLK / UniRepLKNet** | Parallel dilated kernels ($d=1,2,4,8$) or re-parameterized $9\times 9 / 13\times 13$ depthwise kernels | Base-wide ($35\times 35$ to $50\times 50$ tiles) | **Moderate (~250K–600K params)** | Captures long-range defensive overlap (Monolith 11t, Hot Candle 10.5t, X-Bow 14t, Firespitter cone) without downsampling blur. |
| **6. Multi-Scale U-Net / Attention U-Net** | Contracting (`50→25→12→6`) + Expansive decoder with gated skip connections | Full $50\times 50$ board + 1-tile skip fidelity | **Medium-Heavy (~400K–2.4M params)** | Combines macro village layout topology ($6\times 6$ bottleneck) with exact 1-tile wall-gap and spell placement precision. |
| **7. HRNet (Parallel Multi-Resolution)** | Permanent parallel $50\times 50$, $25\times 25$, and $12\times 12$ branches with repeated cross-scale fusion | Full $50\times 50$ board without bottleneck squeezing | **Moderate-Heavy (~500K–1.5M params)** | Preserves uncorrupted high-resolution spatial representations throughout the entire network depth. |
| **8. Swin Transformer V2 / ViTDet** | Shifted-Window Scaled Cosine Self-Attention + Cross-Attention | Global + local window hierarchy | **Heavy (~800K–3M+ params)** | Models arbitrary long-range relational dependencies (e.g., main smash on SW flank vs. Royal Champion on NE flank). |
| **9. InternImage (`DCNv3` / Deformable)** | Content-adaptive deformable sampling offsets $\Delta p_k$ | Dynamic adaptive receptive field | **Moderate-Heavy (~600K–2M params)** | Dynamically warps sampling grids around irregular compartment shapes and asymmetric diamond layouts. |
| **10. Vision Mamba (`VMamba` / `SS2D`)** | 2D 4-Way Selective State-Space Scan ($h_t = \bar{A}h_{t-1} + \bar{B}x_t$) | Global $50\times 50$ directional pathing in $O(N)$ | **Efficient Global (~300K–900K params)** | Models directional troop pathing flows across the 50×50 grid with linear $O(N)$ complexity. |
| **11. AlphaStar Pointer & Entity Cross-Attn** | Autoregressive Key-Query Transformer Pointer over spatial map + Entity Set Encoder | Full-map conditioned pointer | **Head Module (+40K–150K params)** | Couples *which* unit/spell is selected with *where* it points via multi-head query-key dot products. |

---

## 3. Detailed Architectural Specifications & PyTorch Primitives

### 3.1 Stage 0 Baseline: Bare-Minimum Strided CNN + 1×1 Spatial Head (`v4.0-Gen0-TinyCNN`, ~50K Params)
- **Design Philosophy**: Establish the fastest possible end-to-end differentiable policy over the $(B, 59, 50, 50)$ grid and $(B, 64)$ army inventory.
- **Spatial Backbone**:
  1. `enc1` (Full-res stem): `Conv2d(59, 20, kernel_size=3, stride=1, padding=1, bias=False) -> GroupNorm(4, 20) -> SiLU` $\to (B, 20, 50, 50)$.
  2. `enc2` (Strided context): `Conv2d(20, 32, kernel_size=3, stride=2, padding=1, bias=False) -> GroupNorm(8, 32) -> SiLU` $\to (B, 32, 25, 25)$.
  3. `up1` (Lightweight fusion): Bilinear upsample $(B, 32, 25, 25) \to (B, 32, 50, 50)$, concatenate with `enc1` $(B, 20, 50, 50)$, and fuse via $1\times 1$ `Conv2d(52, 20, kernel_size=1) -> GroupNorm(4, 20) -> SiLU` $\to (B, 20, 50, 50)$.
  4. `global_tower`: `Conv2d(32, 48, kernel_size=3, stride=2, padding=1) -> GN(8, 48) -> SiLU -> AdaptiveAvgPool2d(1) -> Flatten -> Linear(48, 64) -> LayerNorm(64) -> SiLU`.
- **Output Heads (`embed_dim=64`, `head_hidden_dim=48`, `spatial_dim=20`)**:
  - `slot_type_head`: `Linear(64, 7)`
  - `slot_idx_head`: `Linear(71, 48) -> SiLU -> Linear(48, 10)`
  - `deploy_fraction_head`: `Linear(81, 48) -> SiLU -> Linear(48, 5)`
  - `tile_cond_proj` + `tile_conv_head`: `Linear(81, 20)` FiLM modulation on `spatial_features`, followed by a single $1\times 1$ `Conv2d(20, 1, kernel_size=1)` producing 2,500 tile logits.
  - `critic_head`: `Linear(64, 48) -> SiLU -> Linear(48, 1)`.
- **Expected Ceiling**: Rapidly learns valid green-zone troop drops, basic troop-before-spell sequencing, and perimeter proximity to the Town Hall within 5,000 episodes, but will plateau on multi-compartment funneling and long-range threat avoidance due to its $7\times 7$ receptive field.

---

### 3.2 CoordConv + Pre-Activation Residual Stem (IMPALA / AlphaStar Spatial Grounding)
- **Why Standard Convolutions Fail on CoC Grids**: Convolution is translation-equivariant, whereas Clash of Clans villages have strong spatial priors (outer border is `[0..3, 46..49]`, Town Hall 18 is near `(25, 25)` or offset diamond `(18..32, 18..32)`, and funnel corners are at the 4 cardinal diamond vertices).
- **Operator**: Append or project 4 coordinate channels onto the input or stem:
  $$\text{Coord}(x, y) = \left[ \frac{x - 24.5}{24.5},\; \frac{y - 24.5}{24.5},\; \sqrt{\Delta x_{\text{TH}}^2 + \Delta y_{\text{TH}}^2},\; \text{atan2}(\Delta y_{\text{TH}}, \Delta x_{\text{TH}}) \right]$$
- **When to Morph**: When telemetry shows high `spatial_deploy_spread_std_tiles` dispersion or failure to distinguish corner funnel trash from central core compartments.

---

### 3.3 ConvNeXt V2 Block (`7×7 Depthwise Separable Conv + Global Response Normalization`)
- **Paper / Source**: Woo et al., *ConvNeXt V2: Co-designing and Scaling ConvNets with Masked Autoencoders* (CVPR 2023 / 2024 dense prediction benchmark).
- **Mathematical Formulation**:
  1. Depthwise spatial mixing: $z = \text{GroupNorm}(\text{DWConv}_{7\times 7}(x))$
  2. Pointwise inverted bottleneck expansion: $h = \phi_{\text{GELU/SiLU}}(W_1 z)$ where $W_1: C \to 4C$ (or $2C$ for lightweight RL).
  3. **Global Response Normalization (GRN)**:
     $$G(h)_c = \|h_c\|_2 = \sqrt{\sum_{H,W} h_{c,i,j}^2 + \epsilon}, \qquad \hat{g}_c = \frac{G(h)_c}{\frac{1}{C}\sum_{k=1}^C G(h)_k + \epsilon}$$
     $$\text{GRN}(h)_c = \gamma_c \cdot (h_c \odot \hat{g}_c) + \beta_c + h_c$$
  4. Pointwise projection & residual: $y = x + W_2(\text{GRN}(h))$.
- **Why It Excels in CoC RL**:
  - A $7\times 7$ depthwise convolution only costs $49 \cdot C$ parameters (vs. $9 \cdot C^2$ for a dense $3\times 3$ conv!) while immediately spanning a 7-tile radius—matching ArcherQueen/WizardTower/Scattershot engagement zones.
  - **GRN** increases inter-channel contrast, preventing dominant channels (like `Ch 0` Building HP) from drowning out sparse unit channels (`Ch 10` Super Wall Breaker or `Ch 20` Royal Champion).

---

### 3.4 SegNeXt Multi-Scale Convolutional Attention (`MSCA`)
- **Paper / Source**: Guo et al., *SegNeXt: Rethinking Convolutional Attention Design for Semantic Segmentation* (NeurIPS).
- **Mathematical Formulation**:
  Given feature map $F \in \mathbb{R}^{C \times H \times W}$:
  $$F_0 = \text{DWConv}_{5\times 5}(F)$$
  $$F_1 = \text{DWConv}_{7\times 1}(\text{DWConv}_{1\times 7}(F_0)), \quad F_2 = \text{DWConv}_{11\times 1}(\text{DWConv}_{1\times 11}(F_0)), \quad F_3 = \text{DWConv}_{21\times 1}(\text{DWConv}_{1\times 21}(F_0))$$
  $$A = \text{Conv}_{1\times 1}(F_0 + F_1 + F_2 + F_3), \qquad Y = F \odot A$$
- **Why It Excels in CoC RL**:
  - Clash of Clans bases are built from **orthogonal wall lines, linear corridors, and axial line-of-sight lanes** (e.g., Log Launcher rolling straight toward TH18, Firespitter directional cones, Giant Arrow rays).
  - Strip convolutions ($1\times 11 + 11\times 1$ and $1\times 21 + 21\times 1$) capture 21-tile-long corridors along both axes with minimal parameter overhead.

---

### 3.5 UniRepLKNet & Multi-Branch Dilated Residual Blocks
- **Paper / Source**: Ding et al., *UniRepLKNet: A Universal Perception Large-Kernel ConvNet for Audio, Video, Point Cloud, Time-Series and Image Recognition* (CVPR 2024).
- **Mathematical Formulation**:
  Combines a large depthwise kernel ($9\times 9$ or $11\times 11$) in parallel with dilated $3\times 3$ depthwise branches ($d \in \{1, 2, 4\}$) so the effective receptive field covers both dense local neighborhoods and sparse long-range rings without checkerboard blind spots.
- **Why It Excels in CoC RL**:
  - TH18 lethal defenses have radii of $9.0\text{t}$ to $14.0\text{t}$ (Monolith $11\text{t}$, Hot Candle $10.5\text{t}$, X-Bow $14\text{t}$, Mortar $11\text{t}$, Revenge Tower). Large/dilated kernels allow a single spatial stage at $25\times 25$ or $50\times 50$ to perceive overlapping defense killzones.

---

### 3.6 Multi-Scale U-Net with Additive Attention Gates & HRNet Parallel Streams
- **U-Net with Attention Gates (Oktay et al.)**:
  - Filters high-resolution encoder skip features $x^l$ using coarse decoder gating signals $g$ before concatenation:
    $$\alpha^l = \sigma\left(\psi^T \left(\text{SiLU}(W_x^T x^l + W_g^T g)\right)\right), \qquad \hat{x}^l = x^l \odot \alpha^l$$
- **HRNet (Wang et al.)**:
  - Maintains a permanent $50\times 50$ high-resolution branch in parallel with $25\times 25$ and $12\times 12$ branches, exchanging information via strided convolutions (down) and bilinear upsampling + $1\times 1$ projections (up).
- **Why They Excel in CoC RL**:
  - Crucial when the policy must simultaneously reason about **global base symmetry/funnel state** ($12\times 12$ / $6\times 6$) and **exact 1-tile placement** ($50\times 50$) for Super Wall Breakers, Totem spells, and Rage/Freeze drops.

---

### 3.7 Swin Transformer V2, Entity Cross-Attention & Vision Mamba (`SS2D`)
- **Entity-to-Grid Cross-Attention (AlphaStar / ViTDet hybrid)**:
  - Reshapes the $(B, 64)$ `army_context` into $K$ structured slot tokens (Global Progress, 10 Troop Slots, 10 Spell Slots, 4 Hero Slots, Siege/CC) and runs Multi-Head Cross-Attention against the $12\times 12$ or $25\times 25$ spatial grid tokens.
- **Vision Mamba (`VMamba` 2D Selective Scan)**:
  - Applies 1D selective state-space scans along 4 spatial traversal paths (top-left $\to$ bottom-right, bottom-right $\to$ top-left, top-right $\to$ bottom-left, bottom-left $\to$ top-right) to propagate pathfinding impedance across the entire $50\times 50$ village in $O(N)$ time.

---

### 3.8 AlphaStar Autoregressive Dual-Mode Spatial Pointer Head
- **Concept**: Troop/Hero/Siege deployments are restricted to the **exterior valid green zone** (`Ch 4 == 0`), whereas Spells (`slot_type == 6`) are cast **inside the village core** where allied units (`Ch 5..20`) engage enemy defenses (`Ch 1, 34..55`).
- **Architectural Realization**:
  - Use a **Dual-Branch or Key-Query Conditioned Spatial Head**:
    1. **Perimeter Breach Pointer ($P_{\text{deploy}}$)**: Specializes in scoring exterior entry tiles based on funnel openness, wall thickness (`Ch 3`), and line-of-sight to TH18 (`Ch 2`).
    2. **Interior Combat Spell Pointer ($P_{\text{spell}}$)**: Specializes in scoring interior $50\times 50$ tiles based on allied troop cluster density (`Ch 5..20`), incoming defense DPS (`Ch 1`), and spell radius overlap.
    3. Select or blend via `is_spell = (chosen_type == 6)` plus multi-head Key-Query dot-product pointer conditioned on `[global_emb, type_onehot, idx_onehot, frac_onehot]`.

---

## 4. Progressive Evolutionary Morphing Ladder (For OpenCode Argon 4 Agent)

When the **OpenCode Argon 4 (`google-vertex/gemini-4-argon#medium`)** agent is invoked after a 5,000-episode training horizon plateaus, it should consult the table below to select the most logical next structural upgrade:

| Generation Stage | Target Parameter Budget | Structural Upgrade to Apply in `python/coc_rl/networks.py` | Triggering Telemetry Bottleneck (After 5,000 Episodes) | Recommended Weight Mode |
| :---: | :---: | :--- | :--- | :---: |
| **Gen 0 (`v4.0-Gen0-TinyCNN`)** | **~50K params** | 2-layer strided CNN (`59→20→32`), bilinear + $1\times 1$ skip fusion (`→20`), `64-D` global tower, $1\times 1$ spatial tile head. | Initial starting point (0 episodes). Fast baseline convergence check. | `scratch_restart` |
| **Gen 1 (`v4.1-CoordSE-ResCNN`)** | **~95K–130K params** | Add **CoordConv + TH18 Polar Channels** (`+4 ch` computed on-the-fly in `encoder.forward`), **Squeeze-and-Excitation (`SEChannelAttention`)** on stem/context, and Pre-Activation Residual Block. | Policy deploys randomly around border (`spatial_spread_std > 7t`) or ignores sparse hero/defense channels (`1★ < 85%` or `2★ TH18 < 45%`). | `warm_start` |
| **Gen 2 (`v4.2-ConvNeXtV2-GRN`)** | **~180K–280K params** | Upgrade encoder stages to **ConvNeXt V2 Blocks** ($7\times 7$ Depthwise Separable Conv + Inverted Bottleneck + **Global Response Normalization `GRN`**) and widen `embed_dim` to `128`. | Policy achieves $1\star$ perimeter clearing (`60–72%` destr) but stalls against overlapping medium-range defense rings (`P(2★|1★) < 65%`). | `warm_start` or `scratch_restart` |
| **Gen 3 (`v4.3-SegNeXt-MSCA-DualPtr`)** | **~320K–500K params** | Insert **SegNeXt Multi-Scale Strip Convolutional Attention (`MSCA`)** ($1\times 7, 7\times 1, 1\times 11, 11\times 1$) + **Dual-Branch Troop/Spell Spatial Pointer Head** (`deploy_conv_head` vs `spell_conv_head`). | Troops drift into "donut" rings around walls or spells are cast poorly during core pushes (`2★ TH18 < 78%`, poor spell efficiency). | `warm_start` |
| **Gen 4 (`v4.4-UNet-DilatedRepLK`)** | **~650K–1.2M params** | Expand to 3-scale **Attention U-Net / HRNet** (`50→25→12→6` with Attention Gates and Multi-Scale Dilated RepLK bottleneck) + 3-layer LayerNorm Critic (`embed_dim=192..256`). | High inter-village variance (`inter_village_gap_pct > 10%`) or `2★ → 3★` back-end cleanup stall (`P(3★|2★) < 45%`, critic calibration lag). | `scratch_restart` or `warm_start` |
| **Gen 5 (`v4.5-EntityCrossAttn-Pointer`)** | **~1.2M–2.2M params** | Add **Entity-to-Spatial Cross-Attention** between structured `army_context` tokens (Heroes, Troops, Spells, Siege) and spatial bottleneck tokens + **Multi-Head Key-Query Spatial Pointer**. | Fine-grained multi-phase coordination ceiling (e.g., timing Royal Champion back-end flank + Warden Eternal Tome + Siege Pop for $>65\%$ $3\star$ triples). | `warm_start` |
