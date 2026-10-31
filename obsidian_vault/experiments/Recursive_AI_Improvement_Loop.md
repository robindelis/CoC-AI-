---
title: "Recursive AI Self-Improvement Loop — Long-Term Memory & Experiment Ledger"
tags:
  - coc-rl
  - recursive-loop
  - self-improvement
  - ppo
  - architecture
  - reward-shaping
updated: "2026-10-31 21:30:35"
total_cycles: 1
loop_enabled: false
interval_seconds: 600
---

# ♾️ Recursive AI Self-Improvement Loop — Long-Term Memory Ledger

Back to [[00_Index_MOC|Vault Index (MOC)]] • View [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Model Architecture & Training Canvas]] • Related: [[experiments/AI_Diagnostics_And_Training_Fixes|AI Training Diagnostics]] • [[decisions/Architecture_Decisions_And_System_Memory|System Memory & ADRs]]

---

## 1. Autonomous Loop Overview & Active Configuration

The **Recursive AI Self-Improvement Loop** inspects training telemetry every **`10` minutes** (`600s`), determines whether training is healthy or plateaued, diagnoses root causes across **Network Architecture**, **Reward Shaping**, and **PPO Hyperparameters**, **documents the complete pre-change baseline state before every modification**, tests the selected solution, verifies whether the targeted bottleneck was solved, and logs the empirical outcome here for long-term institutional memory.

- **Loop Status**: **`READY / ON-DEMAND`** • **Current Phase**: `TESTING_SOLUTION`
- **Total Improvement Cycles Logged**: **`1`**
- **Active Reward Formula**: `R_t = 0.35·Δ%destr + 17.5·ΔHPratio + 12.0·Δstars + 22.0·I(TH18) + 0.11·C_funnel + 4.5·I(%≥75) + 7.0·I(%≥90) + 10.0·I(3★) + 0.020·I(wait_core) - 0.05·I(invalid)`
- **Active Architecture Config**: `th_threat=9.5`, `breach_prior=11.5`, `spell_prior=8.8`, `film_scale=0.85`, `tile_scale=2.4`
- **Active Hyperparameters**: `lr=0.0003`, `critic_lr_mult=2.5`, `batch_episodes=12`, `ent_coef=0.015`, `vf_coef=0.5`, `matchup_mode=random`

![Recursive AI Improvement Loop Progression](../assets/charts/recursive_improvement_loop_tracker.png)

---

## 2. "What Worked When" — Comparative Synthesis Matrix

| Cycle | Episode | Health / Status | Primary Bottleneck Diagnosed | Category | Solution Applied (Exact Parameter Diffs) | Pre → Post Destr % | Pre → Post 2★ TH18 | Pre → Post 3★ | Verdict & Action |
| :---: | :---: | :---: | :--- | :---: | :--- | :---: | :---: | :---: | :---: |
| **#1** | `0` | `PLATEAUED` (45/100) | Town Hall 18 Core Breach Bottleneck | `combined` | **Multi-Solution Bundle (2): High-Destruction Milestone & Core HP Shaping Boost + U-Net FiLM Conditioning & TH18 Spatial Breach Attraction Amplification** (arch_config.breach_prior_weight: 11.0 → 11.5; arch_config.spell_combat_prior_weight: 8.0 → 8.8; arch_config.film_cond_scale: 0.8 → 0.85) | `0.0%` *(Testing...)* | `0.0%` *(Testing...)* | `0.0%` *(Testing...)* | `TESTING IN PROGRESS` |

---

### 🔄 Cycle #1 — Episode `0` (`2026-10-31 21:30:35`)

- **Trigger**: `initial_baseline_audit` • **Diagnostic Engine**: `deterministic_hybrid`
- **Health Verdict**: **`PLATEAUED` (`45/100`)** — Training PLATEAUED at 0.0% 300-ep mean destruction (±0.00% SEM, +0.00%/100ep, 0.0% 2★ TH18, 0.0% 3★) — Decision: APPLY_IN_PLACE_SOLUTION (Town Hall 18 Core Breach Bottleneck).
- **Progression Summary**: At cumulative episode 0 (evaluated over the last 1 episodes), mean destruction is 0.0% ± 0.00% (peak 300-ep mean: 0.0% 0 eps ago; slope +0.00%/100ep; Combat Score: 0.0/100). Star conversion funnel: 1★=0.0% → P(2★|1★)=0.0% → P(3★|2★)=0.0% (Worst village: N/A at 0.0%).

#### A. Mandatory Pre-Change Baseline Snapshot (`snapshot_cycle_001_1793478635`)
*Documented at `2026-10-31 21:30:35` on commit `d3b5521` (Checkpoint: `scratch`, Episode `0`) BEFORE applying any modification:*

1. **Pre-Change Network Architecture (`CoCActorCritic` v`3.0-UNet`)**:
   - **Backbone & Dimensions**: `in_channels=59`, `base_ch=32`, `spatial_dim=32`, `embed_dim=256`, `head_hidden_dim=128` (`2,480,440` trainable params)
   - **Spatial Conditioning & Breach Field**: `th_threat_weight=9.5`, `defense_threat_weight=2.0`, `breach_prior_weight=11.0`, `spell_combat_prior_weight=8.0`, `film_cond_scale=0.8`, `tile_logit_scale=2.2`
   - **Head Logit Temperatures & Per-Head Entropy Weights**: `logit_temp=(type:1.4, idx:1.6, frac:1.4)`, `reg_ent_weights=(type:2.2, idx:2.2, frac:2.2, tile:0.12)`
2. **Pre-Change Reward Shaping Formulation**:
   - **Formula**: `R_t = 0.35·Δ%destr + 15.0·ΔHPratio + 12.0·Δstars + 20.0·I(TH18) + 0.08·C_funnel + 2.0·I(%≥75) + 4.0·I(%≥90) + 6.0·I(3★) + 0.020·I(wait_core) - 0.05·I(invalid)`
   - **Weights**: `destr_weight=0.35`, `star_weight=12.0`, `th_bonus=20.0`, `damage_weight=15.0`, `funnel_weight=0.08`, `high_pct_milestone_75=2.0`, `high_pct_milestone_90=4.0`, `triple_wipe_bonus=6.0`
3. **Pre-Change PPO Hyperparameters**:
   - `lr=0.0003`, `critic_lr_mult=2.5`, `batch_episodes=12`, `minibatch_size=128`, `ppo_epochs=4`, `clip_coef=0.2`, `ent_coef=0.015`, `vf_coef=0.5`, `target_kl=0.03`, `gamma=0.99`, `gae_lambda=0.95`, `matchup_mode=random`
4. **Pre-Change Baseline Telemetry**:
   - `Mean Destr (50-ep)`: **`0.00%`** (Peak Rolling-50: `0.00%`, Slope: `+0.00%/100ep`)
   - `Star Conversion Funnel`: `1★+ = 0.0%` • `2★+ TH18 = 0.0%` (`P(2★|1★) = 0.0%`) • `3★ Triple = 0.0%` (`P(3★|2★) = 0.0%`)
   - `Critic & Pacing`: `V(s₀) = -0.01` (Gap `+0.00`), `Explained Var = 0.0%`, `NoOp = 0.0%`, `Top-5 Tile Mass = 13.3%`

#### B. Plateau Root-Cause Diagnosis
- **[CRITICAL • `reward_function`] Town Hall 18 Core Breach Bottleneck**
  - *Quantitative Evidence*: 300-ep 2★+ TH18 takedown rate is 0.0% (conditional P(2★|1★) = 0.0%) with 1-ep mean destruction at 0.0% ± 0.00% (slope +0.00%/100ep).
  - *Mathematical Root Cause*: Exterior building destruction rewards (0.35 pts/%) provide easier immediate gradient signal than chewing through high-HP core defenses (Monolith, Multi-Archer, Hot Candle, TH18 Guardian), causing units to drift around the perimeter instead of committing to a deep core funnel.
- **[WARNING • `architecture`] Spatial Breach Focus & Factorized Head Conditioning Imbalance**
  - *Quantitative Evidence*: Tile pointer saturation is 97.0% (Top-5 tile mass 13.3%, spread σ=3.73t) while Action Type saturation is 98.1%.
  - *Mathematical Root Cause*: Current spatial breach attraction (`th_threat_weight=9.5`, `breach_prior_weight=11.0`) and FiLM conditioning scale (`film_cond_scale=0.8`) allow troop drops to spread too widely along the border rather than concentrating on the shortest breach vector to TH18.
- **[INFO • `hyperparameters`] Critic Baseline Lag & PPO Trust-Region Plateau**
  - *Quantitative Evidence*: Critic calibration gap |V(s₀)−R̄₃₀₀| = 0.00 pts, Explained Variance = 0.0%, Approx KL = 0.0000 (Slope +0.00%/100ep, 0 eps since 300-ep peak).
  - *Mathematical Root Cause*: As policy returns shift into higher destruction regimes, the 2-layer Critic value head lags behind the return distribution, increasing GAE advantage noise and causing policy updates to stall or oscillate.

#### C. Candidate Solutions Proposed & Action Taken
1. **`[REWARD_FUNCTION]` High-Destruction Milestone & Core HP Shaping Boost** *(✅ SELECTED FOR TESTING)*
   - *Target Bottleneck*: Town Hall 18 Core Breach Bottleneck
   - *Rationale*: Adds explicit progressive milestone bonuses at ≥75% (+4.5 pts) and ≥90% (+6.0 pts) destruction plus a +8.0 pt 3★ wipe bonus and elevated Core HP & TH18 takedown weights so GAE advantages strongly reward pushing through the TH18 core into back-end cleanup.
   - *Exact Parameter Diff*: `reward_config.th_bonus: 20.0 → 22.0; reward_config.damage_weight: 15.0 → 17.5; reward_config.funnel_weight: 0.08 → 0.11; reward_config.high_pct_milestone_75: 2.0 → 4.5; reward_config.high_pct_milestone_90: 4.0 → 7.0; reward_config.triple_wipe_bonus: 6.0 → 10.0`
   - *Verification Criterion*: Improve 300-ep Mean Destruction % by ≥ +0.35% with non-negative 2★+ TH18 and 3★ Triple rates.
2. **`[ARCHITECTURE]` U-Net FiLM Conditioning & TH18 Spatial Breach Attraction Amplification** *(✅ SELECTED FOR TESTING)*
   - *Target Bottleneck*: Spatial Breach Focus & Factorized Head Conditioning Imbalance
   - *Rationale*: Increases the U-Net decoder's FiLM multiplicative conditioning scale (`film_cond_scale`), strengthens the 15×15 cascaded Town Hall 18 breach attraction field (`th_threat_weight`, `breach_prior_weight`) and mid-battle spell combat focus (`spell_combat_prior_weight`), and tightens spatial tile entropy regularization so troops funnel into a concentrated breach corridor.
   - *Exact Parameter Diff*: `arch_config.breach_prior_weight: 11.0 → 11.5; arch_config.spell_combat_prior_weight: 8.0 → 8.8; arch_config.film_cond_scale: 0.8 → 0.85; arch_config.tile_logit_scale: 2.2 → 2.4; arch_config.reg_ent_tile_weight: 0.12 → 0.1; arch_config.reg_ent_type_weight: 2.2 → 2.4`
   - *Verification Criterion*: Increase Top-5 Tile Probability Mass %, reduce perimeter scatter σ, and improve 300-ep 2★+ TH18 breach rate.
3. **`[HYPERPARAMETERS]` Critic Calibration Acceleration, Trust-Region Fine-Tuning & Round-Robin Sampling** 
   - *Target Bottleneck*: Critic Baseline Lag & PPO Trust-Region Plateau
   - *Rationale*: Refines actor learning rate for fine-grained late-stage convergence while boosting `critic_lr_mult` and `vf_coef` to eliminate V(s₀) calibration lag, and enforces `round_robin` village sampling so every PPO batch receives equal gradient weight from the hardest TH18 layout.
   - *Exact Parameter Diff*: `hyperparams.lr: 0.0003 → 0.000255; hyperparams.critic_lr_mult: 2.5 → 3.0; hyperparams.vf_coef: 0.5 → 0.6; hyperparams.ent_coef: 0.015 → 0.0142; hyperparams.matchup_mode: random → round_robin`
   - *Verification Criterion*: Reduce 300-ep inter-village destruction gap, improve Critic Explained Variance, and resume positive destruction slope.
4. **`[CODE_AGENT]` OpenCode Argon 4 Medium Surgical Code Upgrade (Spatial Prior & Reward Shaping)** 
   - *Target Bottleneck*: Town Hall 18 Core Breach Bottleneck
   - *Rationale*: Invokes the OpenCode `google-vertex/gemini-4-argon#medium` coding agent directly on `python/coc_rl/networks.py` and `python/coc_rl/ppo.py` to refine the spatial breach/spell prior and reward shaping weights while combining synergistic architecture, reward, and critic calibration parameters.
   - *Exact Parameter Diff*: `reward_config.high_pct_milestone_75: 2.0 → 4.0; reward_config.high_pct_milestone_90: 4.0 → 6.5; reward_config.triple_wipe_bonus: 6.0 → 9.0; hyperparams.critic_lr_mult: 2.5 → 2.9; hyperparams.matchup_mode: random → round_robin`
   - *Verification Criterion*: Simultaneously lift 300-ep Mean Destruction %, 2★+ TH18 rate, and worst-village performance via code + config synergy.
5. **`[NEW_ARCHITECTURE_RESTART]` Stop Model & Restart with New Architecture (3.1-40ch-DilatedRes-SE-GatedPtr • 4.13M Params)** 
   - *Target Bottleneck*: Town Hall 18 Core Breach Bottleneck & Spatial Breach Focus & Factorized Head Conditioning Imbalance
   - *Rationale*: Stops the current model (arch `3.0-UNet` at 300-ep mean 0.0% destr, 0.0% 3★, worst village `N/A` at 0.0%) and restarts training from scratch with a new `3.1-40ch-DilatedRes-SE-GatedPtr` architecture (`base_ch=40`, `embed_dim=320`, `spatial_dim=48`, `4,129,900` params) that adds a Multi-Scale Dilated Residual Context Block (`DilatedResBlock`, dilation=2,4) in the U-Net encoder to expand cross-compartment receptive field for TH18 core breaches, enables Squeeze-and-Excitation (`SEChannelAttention`) on the bottleneck and 50×50 spatial decoder to dynamically re-weight lethal defenses (Monolith, Hot Candle, TH18), introduces Gated Cross-Head Spatial Conditioning (`use_gated_heads=True`, `spatial_dim=48`) to sharpen 50×50 deployment focus, upgrades `critic_head` to a 3-layer LayerNorm tower (`critic_depth=3`, `head_hidden_dim=192`) to eliminate V(s₀) calibration lag (+0.0 pts).
   - *Exact Parameter Diff*: `arch_config.arch_version: 3.0-UNet → 3.1-40ch-DilatedRes-SE-GatedPtr; arch_config.base_ch: 32 → 40; arch_config.spatial_dim: 32 → 48; arch_config.embed_dim: 256 → 320; arch_config.head_hidden_dim: 128 → 192; arch_config.use_dilated_context: False → True; arch_config.use_se_attention: False → True; arch_config.use_gated_heads: False → True; arch_config.critic_depth: 2 → 3; arch_config.breach_prior_weight: 11.0 → 11.5; arch_config.total_params: None → 4129900; hyperparams.lr: 0.0003 → 0.00028; hyperparams.critic_lr_mult: 2.5 → 3.0; hyperparams.vf_coef: 0.5 → 0.6; hyperparams.matchup_mode: random → round_robin`
   - *Verification Criterion*: Stop current model, initialize new `3.1-40ch-DilatedRes-SE-GatedPtr` (4,129,900 params) from scratch, train for 300 episodes, and honestly evaluate 300-episode Mean Destruction %, 2★+ TH18 rate, and 3★ Triple rate.

#### D. Post-Test Verification Results
- **Status**: `TESTING IN PROGRESS` — Awaiting completion of verification episode window / next 10-minute cycle check.

