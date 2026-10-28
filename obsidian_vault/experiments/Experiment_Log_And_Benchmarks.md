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

Back to [[00_Index_MOC|Vault Index (MOC)]]

This note tracks every model checkpoint in `trained_models/`, the exact architecture version (`v1.0` vs. `v2.0`), spatial input channels, action head configuration, episode count, hyperparameters, and combat performance on the 5 TH18 reference villages.

---

## 1. Comparative Benchmark Table

| Exp ID | Checkpoint File | Arch Version | Input Tensor | Action Heads | Episodes Trained | Hyperparameters (`lr`, `batch`, `epochs`, `ticks/step`) | Avg Destruction % | Peak Destruction / Stars | Avg Return | Key Takeaways & Behavioral Observations |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :---: | :---: | :---: | :--- |
| **EXP-01** | `baseline_v1_random_init.pt` | [[v1.0_Baseline_8Ch_SingleDeploy\|v1.0]] | `8×50×50` + `64-D` | 3 (`type`, `idx`, `tile`) | `0` (Untrained) | `lr=3e-4`, `batch=4`, `K=4`, `ticks=8` | `31.4%` | `48% (0★)` | `+6.8` | Random perimeter drops; high `NoOp` drift (`48%`) and trickled single-unit deployment. |
| **EXP-02** | `v1_single_deploy_40ep.pt` | [[v1.0_Baseline_8Ch_SingleDeploy\|v1.0]] | `8×50×50` + `64-D` | 3 (`type`, `idx`, `tile`) | `40` | `lr=3e-4`, `batch=4`, `K=4`, `ticks=8` | `64.2%` | `88% (2★)` | `+16.9` | Learns West/South-West perimeter breach and Rage timing, but loses 3-star time because dropping 14 Throwers takes $14 \times 0.64\text{s} = 8.96\text{s}$. |
| **EXP-03** | `latest_attacker.pt` | [[v2.0_10Ch_Archetype_And_DeployFraction\|v2.0]] | `10×50×50` + `64-D` | 4 (`type`, `idx`, `frac`, `tile`) | `40` | `lr=3e-4`, `batch=4`, `K=4`, `ticks=8` | `78.6%` | `96% (3★)` | `+21.84` | Adding `deploy_fraction_head` ($\alpha_{\text{frac}} \in \{0.5, 1.0\}$) lets the agent drop its Thrower/Balloon core in 1–2 synchronized waves; Ch 8 & Ch 9 improve Poison/Rage targeting. |
| **EXP-04** | `th18_thrower_specialist.pt` | [[v2.0_10Ch_Archetype_And_DeployFraction\|v2.0]] | `10×50×50` + `64-D` | 4 (`type`, `idx`, `frac`, `tile`) | `120` | `lr=3e-4`, `batch=4`, `K=4`, `ticks=8` | `89.4%` | `100% (3★)` | `+24.50` | Full convergence on Thrower + Healer Smash: uses $\alpha_{\text{frac}}=1.0$ for Healer/Thrower core behind Root Riders, reacts to Ch 9 defending CC & Skeleton traps with Poison + Eternal Tome. |

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
