---
title: "Master Experiment Log & Model Checkpoint Comparison"
tags:
  - experiments
  - benchmarks
  - checkpoints
  - coc-rl
updated: 2026-10-28
---

# 📈 Master Experiment Log & Model Benchmarks

Back to [[00_Index_MOC|Vault Index (MOC)]] • Open [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Model Architecture & Training Canvas]]

This note tracks every model checkpoint in `trained_models/`, the exact architecture version (`v1.0` vs. `v2.0`), spatial input channels, action head configuration, cumulative episode count across resumed sessions, hyperparameters, and combat performance on the 5 TH18 reference villages.

---

## 1. Comparative Benchmark Table

| Model Lineage / Run | Checkpoint File | Arch Version | Input Tensor | Action Heads | Total Episodes Trained | Resumed Sessions | Avg Destruction % | Peak Destruction / Stars | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [[runs/v1_baseline_8ch\|v1.0 Baseline 8-Ch]] | `attacker_ep30102_100pct_3star.pt` | `v1.0` | `8×50×50` + `64-D` | 3 (`type`, `idx`, `tile`) | **`30,102`** | 6 sessions (`0 -> 2.4k -> 3.8k -> 6.5k -> 10.2k -> 15.2k -> 30.1k`) | `60.9%` | **`100% (3★)`** | `SUPERSEDED` |
| [[runs/v2_archetype_10ch\|v2.0 10-Ch Archetype + Waves (Pre-Fix)]] | `attacker_ep8770_90pct_2star.pt` | `v2.0` | `10×50×50` + `64-D` | 4 (`type`, `idx`, `frac`, `tile`) | **`8,770`** | 3 sessions (`0 -> 2,724 -> 8,770`) | `59.5%` | `90% (2★)` | `DIAGNOSED` |
| [[experiments/AI_Diagnostics_And_Training_Fixes\|v2.1 Two-Phase Pacing + Head-Balanced PPO]] | `attacker_ep8938_100pct_3star.pt` / `latest_attacker.pt` | `v2.1` | `10×50×50` + `64-D` | 4 (`type`, `idx`, `frac`, `tile`) | **`8,938+`** | Resumed + Live `60k` Run (`Ep 3,500+` at **`71.7%` avg, `68.4%` 2★+, `15.0%` 3★**) | **`71.7%`** | **`100% (3★)`** | **`ACTIVE`** |

> **Full AI Diagnostic Dossier**: See [[experiments/AI_Diagnostics_And_Training_Fixes|AI Training Diagnostics, Telemetry Architecture & PPO Pathology Fixes]] for the complete Dual-LLM (`OpenCode Gemini 4 Argon` & `AGY Gemini 3.8 Flash`) root-cause analysis and 6-panel telemetry plots.

---

## 2. Impact Analysis: What Moved the Needle Most?

### A. Impact of `deploy_fraction_head` ($\alpha_{\text{frac}} \in [0, 1]$)
- **Before (`v1.0`)**: High-count troop stacks (`14× Thrower`, `24× Balloon`) suffered severe **staggered entry syndrome** — early units engaged high-DPS defenses (Monolith, Hot Candle, Scattershot) piecemeal while the remaining units were still waiting in the deployment queue ($0.64\text{s}$ per unit).
- **After (`v2.0`)**: With $\alpha_{\text{frac}} \in \{0.25, 0.50, 0.75, 1.00\}$, the policy rapidly learns to select $\alpha_{\text{frac}} = 0.50$ or $1.00$ on main push troops, concentrating DPS and Healer splash value from the first second of entry. Average destruction at 40 episodes jumped from **`64.2%` $\to$ `78.6%`** ($+14.4\%$).

### B. Impact of Channel 8 (`Allied Unit Type Signature`)
- **Before (`v1.0`)**: Channels 5 & 6 only reported total Ground/Air HP on a tile. A tile with 1 Golem (`7000 HP`) looked identical to a tile with 3 Throwers (`7200 HP`), causing suboptimal spell placement (e.g., dropping Rage on isolated tanks instead of the ranged DPS core).
- **After (`v2.0`)**: Channel 8 distinguishes Ranged Core (`0.60`), Healers (`0.81`), Tanks (`0.70–0.74`), and Heroes (`0.96–0.99`), allowing the `tile_conv` head to center `Rage` and `Heal` spells directly over the Thrower/Bowler/Queen core.

### C. Impact of Channel 9 (`Enemy Unit Type Signature` — CC, Heroes, Ground vs. Air Skeletons)
- **Before (`v1.0`)**: Defending Clan Castle troops, defending Heroes, and Skeleton Traps were invisible to the CNN.
- **After (`v2.0`)**:
  - When the defending Clan Castle triggers at $12\text{ tiles}$ (`SuperMinion = 0.36`, `IceGolem = 0.70`, `Headhunter = 0.22`), Channel 9 lights up along their approach vector, giving the `CastSpell` (`Poison`) head an explicit spatial target.
  - Because **Ground Skeletons (`0.10`)** and **Air Skeletons (`0.28`)** have separate signatures in Channel 9, air armies (`Dragon Duke Hydra`) no longer waste `Freeze`/`Poison` on harmless Ground Skeletons (`0.10`), reserving them for **Air Skeleton Traps (`0.28`)**, defending **Minion Prince / Dragon Duke (`0.99`)**, and **Archer Queen (`0.96`)**.

---

## 3. Template for Future Training Runs

Whenever a new model checkpoint is trained via `python/train_ai.py` or the Web AI Studio Trainer, append a row to Section 1 above with:
1. **Checkpoint filename** (`trained_models/<name>.pt`)
2. **Architecture & Channel version** (`v2.0`, `10×50×50`)
3. **Total episodes & Matchup mode** (`random`, `round_robin`, `selectors`)
4. **Rolling 50-episode Avg Destruction %, Peak Stars, and NoOp %**
