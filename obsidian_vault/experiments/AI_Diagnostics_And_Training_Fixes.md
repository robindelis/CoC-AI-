---
title: "AI Training Diagnostics, Telemetry Architecture & PPO Pathology Fixes"
tags:
  - coc-rl
  - ppo
  - diagnostics
  - reward-shaping
  - entropy-regularization
  - th18
updated: 2026-10-28
---

# 🩺 AI Training Diagnostics, Telemetry Architecture & PPO Pathology Fixes

Back to [[00_Index_MOC|Vault Index (MOC)]] • View [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Model Architecture & Training Canvas]] • Related: [[runs/v2_archetype_10ch|v2.0 Run Dossier]] • [[experiments/Experiment_Log_And_Benchmarks|Master Experiment Log]]

---

## 1. Dual-LLM Training Diagnostics Architecture (`python/coc_rl/training_feedback.py`)

To diagnose subtle reinforcement learning bottlenecks in a multi-head factorized action space (`MultiDiscrete([7, 10, 50, 50, 5])`), we implemented an automated telemetry collector (`gather_training_telemetry`) and live GPU policy probe (`probe_live_model_diagnostics`) coupled to two local AI diagnostic engines:

1. **Argon 4 • OpenCode (`opencode_argon`)**: Invokes `opencode run -m google-vertex/gemini-4-argon#medium --format json` locally.
2. **Flash 3.8 • AGY (`agy_flash`)**: Invokes `agy --model gemini-3.8-flash-medium --disable-slash-commands -p=...` locally.

### Telemetry Dimensions Gathered for AI Feedback
Every diagnostic evaluation compiles six quantitative telemetry blocks and visualizes them in both the Web Trainer UI and the Obsidian Vault:

| Telemetry Block | Metrics Extracted & Plotted | Diagnostic Purpose |
| :--- | :--- | :--- |
| **1. Chronological Quintile Phases (`Phase 1/5` $\to$ `Phase 5/5`)** | `mean_pct`, `std_pct`, `min_pct`, `max_pct`, `mean_stars`, `zero_star_rate_pct`, `one_plus_star_rate_pct`, `two_plus_star_th_rate_pct` (TH18 takedown proxy), `three_star_triple_rate_pct`, `mean_reward`, `mean_noop_pct`, `mean_steps`, `mean_policy_loss`, `mean_value_loss`, `mean_entropy`, `mean_approx_kl` | Tracks macro-scale learning progression, star-tier breakthroughs, and policy regime shifts across the entire training run. |
| **2. Rolling Windows (`First 50`, `Prev 100`, `Recent 50`, `Recent 10`)** | Window means + standard deviations for destruction %, stars, 2★/3★ rates, NoOp %, step counts, and PPO losses | Contrasts initial behavior against recent performance and immediate short-horizon momentum. |
| **3. Regression Slopes & Plateau Tracking (`trends`)** | Linear regression slopes per 100 episodes (`pct_slope`, `reward_slope`, `entropy_slope`, `value_loss_slope`, `noop_slope`), `rolling50_peak_pct`, `episodes_since_rolling50_peak`, `drawdown_from_rolling50_peak_pct`, `episodes_since_best_pct` | Quantifies whether training is actively progressing or stalled in a local optimum. |
| **4. Live Factorized Head Entropy & Spatial Probe (`head_entropy_breakdown`)** | Per-head Shannon entropy $H(a_k)$, effective unmasked maximum $\ln(|A_k^{\text{valid}}|)$, saturation % (`slot_type`, `slot_idx`, `deploy_fraction`, `tile_xy`), `top5_tile_prob_mass_pct`, `spatial_deploy_spread_std_tiles` ($\sigma$), `unique_deploy_tiles_ratio` | Detects asymmetric head collapse vs. spatial pointer uniformity across the 2,500-tile grid. |
| **5. Tactical Combat Timing Spans (`tactical_rollout_behavior`)** | `troop_deploy_tick_span` $[t_{\min}, t_{\max}]$, `spell_cast_tick_span` $[t_{\min}, t_{\max}]$, `hero_ability_tick_span` $[t_{\min}, t_{\max}]$, `initial_step_probs` (`slot_type_probs`, `deploy_fraction_probs`) | Verifies whether spells and hero abilities are held for core engagements or dumped prematurely at the perimeter. |
| **6. Critic Calibration & Module L2 Weight Norms (`critic_calibration`, `weight_norms_l2`)** | `predicted_v_s0`, `[pred_value_min, pred_value_max]`, `empirical_recent50_return`, `calibration_gap_v0_minus_return`, L2 weight norms across all 9 modules (`spatial_stem` .. `critic_head`), plus 3-Army $\times$ 5-Village matchup spread | Identifies value critic under/over-estimation, gradient variance, and cross-army policy interference. |

![AI Diagnostic Telemetry Overview](../assets/charts/v2_ai_diagnostics_telemetry.png)

---

## 2. The Four Pathologies Diagnosed at Episode 8,770

When evaluated on the initial 8,770-episode `v2.0` training run (`attacker_ep8770_90pct_2star.pt`), both **Gemini 4 Argon (`44/100 • PLATEAUED`)** and **Gemini 3.8 Flash (`42/100 • PLATEAUED`)** identified four interacting root causes trapping the agent around `~59.5%` destruction:

### Pathology 1: Action Dumping & Premature Exhaustion (`Zero-NoOp Collapse`) — `CRITICAL`
- **Quantitative Symptom**: `NoOp (Wait)` frequency collapsed from `43.97%` (`64.5` steps) in the first 50 episodes to `0.11%` (`36.3` steps) in episodes `8,721–8,770`. Live rollout probes showed all troops deployed by tick `296` (`29.6s`), all spells dumped by tick `264` (`26.4s`), and all 4 Hero Equipment Abilities popped at ticks `40–64` (`4.0–6.4s` into the battle, while heroes were still walking on the outer grass border).
- **Mathematical Root Cause**:
  1. `train_ai.py` applied a `-0.04` per-step penalty on `NoOp` alongside a `+0.035` step bonus on every non-NoOp action (`0.075` per-step reward swing favoring spam).
  2. When all deployables/abilities were spent, `env.finish_battle()` immediately fast-forwarded the remaining ~1,500 simulation ticks in a single transition and credited 100% of the terminal destruction and star rewards to that final active step without fast-forward discounting. Under GAE ($\gamma = 0.99$), every `NoOp` wait step exponentially discounted the terminal payout, teaching the policy to burn all spells and hero abilities immediately.

### Pathology 2: Factorized Head Entropy Imbalance & Interior-Hole Scattering — `CRITICAL`
- **Quantitative Symptom**: Joint entropy appeared high (`6.855`), but decomposing by head revealed `tile_xy` was at **`101.6%` saturation** (`6.850` nats, top-5 tiles holding only `2.81%` probability mass, spatial spread $\sigma = 17.0$ tiles across 100% unique tiles), whereas `slot_type` (`28.3%`), `slot_idx` (`12.2%`), and `deploy_fraction` (`29.6%`, locked `95.8%` on the `25%` bin) had collapsed. Furthermore, bases `V2–V4` contained 1×1 unblocked interior "teaser holes" at `(26, 25)` and `(25, 21)` surrounded 360° by Single Infernos and Double Rage Towers.
- **Mathematical Root Cause**: Summing unnormalized entropies $H = H(\text{type}) + H(\text{idx}) + H(\text{frac}) + H(\text{tile})$ under a single scalar `ent_coef = 0.015` allowed the 2,500-way spatial head ($\ln 2500 \approx 7.82$ nats) to satisfy the entropy bonus by remaining near-uniform across the perimeter while starving the small discrete heads ($\ln 5 = 1.61$ to $\ln 10 = 2.30$ nats).

### Pathology 3: 1-Star Perimeter Trash-Clearing Local Optimum — `WARNING`
- **Quantitative Symptom**: While the `1★+` rate reached `92.2%` in Phase 5, the `2★+` Town Hall 18 takedown rate fell to `4.0%` in `recent_50`, and the `3★` triple rate was `0.0%` across all 8,770 episodes. Additionally, `Army 2 (Fireball Super Bowlers)` frequently cast `Overgrowth` directly on the Town Hall 18, making the Town Hall invulnerable and untargetable for 28 seconds.
- **Mathematical Root Cause**: `compute_custom_reward` in `ppo.py` rewarded only discrete 1% building destruction steps (`0.50 * delta_pct`) and stars (`16.67 * delta_stars`), ignoring continuous HP damage (`delta_damage_ratio`) and `th_just_destroyed`. Chewing through the massive HP pool of Town Hall 18 and core defenses yielded zero intermediate reward until the final hit, whereas clearing low-HP exterior trash buildings gave immediate reward.

### Pathology 4: Cross-Army Gradient Interference & Critic Lag — `INFO`
- **Quantitative Symptom**: `Thrower + Healer Smash` averaged `64.9%` recent destruction (`1.12★`), outperforming `Dragon Duke Hydra` (`53.6%`, `0.76★`) by `11.3%`, while Critic $V(s_0)$ lagged empirical returns during regime transitions.
- **Mathematical Root Cause**: Small unstratified rollouts (`batch_episodes = 4`) across 3 mechanically distinct armies and 5 bases produced high-variance advantage baselines and conflicting spatial gradients.

---

## 3. Mathematical & Architectural Corrections Implemented

1. **Two-Phase Tactical Action Masking & Cooldown Pacing (`python/coc_rl/envs.py`, `python/train_ai.py`)**:
   - Removed the `+0.035` active-action step bonus and unconditional `-0.04` `NoOp` penalty; added temporal fast-forward discounting $\gamma^{\Delta t_{\text{ff}}}$ on `finish_battle()`.
   - Tracked `has_remaining_inventory` separately from tick-level cooldown masks so tactical waiting never triggers premature fast-forwarding.
   - **Phase 1 (Coordinated Entry)**: Requires deploying frontline core troop stacks (`slot_idx 0..3`, $\ge 3$ waves) before Siege Machine and Heroes so solo heroes never walk into Single Infernos/Monolith unbuffered.
   - **Phase 2 (Mid-Battle Timing)**: Unlocks Spells (`tick >= 40`, `8`-tick spacing) and Hero Abilities (`tick >= 64`, `16`-tick spacing) with `NoOp (Wait)` interleaved while units push through the core.
2. **Exterior Cardinal Funneling & Town Hall Spell Halo Protection (`python/coc_rl/envs.py`, `python/coc_rl/networks.py`)**:
   - Restricted troop/hero/siege deployment to the exterior village border (`not_interior_hole` excluding `[13..36, 13..36]` teaser traps) along cardinal breach corridors within a `14.0`-tile funnel around the initial entry point.
   - Restricted `CastSpell` (`slot_type = 6`) to active combat zones (`near_allies & near_buildings`) while excluding the Town Hall footprint (`not_th_halo`) so `Overgrowth` and `Invisibility` never root/cloak the Town Hall 18.
3. **Normalized Per-Head Entropy (`reg_entropy`), Smooth Logit Bounding & FiLM Conditioning (`python/coc_rl/networks.py`, `python/coc_rl/ppo.py`)**:
   - Replaced raw summed entropy in `ppo_minibatch_update` with normalized per-head regularization:
     $$H_{\text{reg}} = 2.2\,\frac{H(\text{type})}{\ln 7} + 2.2\,\frac{H(\text{idx})}{\ln 10} + 2.2\,\frac{H(\text{frac})}{\ln 5} + 0.12\,\frac{H(\text{tile})}{\ln N_{\text{valid}}}$$
   - Applied smooth tanh logit bounding on discrete heads, wave-deployment priors (`25%–75%` bins), FiLM-style multiplicative spatial conditioning (`spatial_feat * (1 + 0.5 * tanh(cond_spatial)) + cond_spatial`), and a cascaded $15\times 15 \to 15\times 15$ defense/TH breach attraction field.
4. **Calibrated 100-Point Dense + TH18 Milestone Reward & Stratified Rollouts (`python/coc_rl/ppo.py`, `python/train_ai.py`)**:
   - Updated `compute_custom_reward` on the calibrated 100-point scale:
     $$R_t = 0.35\,\Delta\%_{\text{destr}} + 15.0\,\Delta\text{HP}_{\text{ratio}} + 12.0\,\Delta\text{stars} + 14.0\,\mathbb{I}_{\text{TH18}} + 0.08\,C_{\text{funnel}} - 0.05\,\mathbb{I}_{\text{invalid}}$$
   - Increased default `batch_episodes` to `12` (`minibatch_size = 128`), enforced stratified per-batch `(army, village)` permutation sampling, and decoupled the Critic head learning rate (`2.5x` actor LR).

---

## 4. Empirical Results: Before vs. After Fixes

| Diagnostic Metric | Before Fixes (`Ep 8,770` Plateau) | Resumed Continuation (`Ep 8,938`) | Live `v2.1` Training from Scratch (`Phase 1 -> Phase 5`, `Ep 3,500+`) |
| :--- | :---: | :---: | :---: |
| **Mean Destruction %** | `59.46%` (Peak `90%`) | `62.8% – 63.8%` (Peak **`100%`**) | `64.2%` $\to$ **`71.7%`** (Peak **`100%`**) |
| **Mean Victory Stars** | `0.88★` | `1.42★ – 1.52★` | `1.48★` $\to$ **`1.77★`** |
| **2★+ Town Hall 18 Takedown Rate** | `4.0%` | **`51.7% – 54.0%`** ($13\times$ jump) | `53.9%` $\to$ **`68.4%`** ($17\times$ jump) |
| **3★ Triple Rate (100% Wipe)** | `0.0%` (0 in 8,770 eps) | **`3.3% – 4.0%`** (`10%` on Thrower) | `4.0%` $\to$ **`15.0%`** |
| **NoOp (Wait) Tactical Pacing** | `0.11%` (`36.3` steps) | **`23.7%`** (`58.3` steps) | **`14.0% – 17.2%`** (`49–55` steps) |
| **Hero Ability Timing Window** | Ticks `40–64` (`4.0–6.4s` border dump) | **Ticks `64–232`** (`6.4–23.2s` core push) | **Ticks `64–216`** (`6.4–21.6s` core push) |
| **Spatial Top-5 Tile Mass / Spread** | `2.81%` ($\sigma = 17.0$ tiles) | **`24.5%`** ($\sigma = 4.3$ tiles) | **`22.4%`** ($\sigma = 4.6$ tiles) |
| **OpenCode Argon 4 Verdict** | `PLATEAUED • 44/100` | **`PROGRESSING • 84/100`** | **`PROGRESSING • 78/100`** |
| **AGY Flash 3.8 Score** | `42/100` | **`54/100`** | **`52/100`** |
