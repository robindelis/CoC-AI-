---
title: "Master Experiment Log & Single-Army Specialist Benchmarks"
tags:
  - experiments
  - benchmarks
  - checkpoints
  - coc-rl
updated: 2026-10-30
---

# 📈 Master Experiment Log & Single-Army Specialist Benchmarks

Back to [[00_Index_MOC|Vault Index (MOC)]] • Open [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Model Architecture & Training Canvas]] • Architecture: [[architectures/v3.0_31Ch_PerDefense_SingleArmy_ActorCritic|v3.0 Spec]]

This note tracks our **v3.0 Single-Army Specialist** models in `trained_models/`, where each model is trained on a single dedicated army composition with the `(31, 50, 50)` per-defense spatial grid and `(64,)` live available inventory input (`army_context`).

---

## 1. Active Architecture & Training Paradigm (`v3.0`)

| Property | Specification |
| :--- | :--- |
| **Architecture Version** | **`v3.0`** (`CoCSpatialEncoder` + `CoCActorCritic`, **`1,364,344` params**) |
| **Spatial Input (`obs`)** | **`(B, 31, 50, 50)`** — `Ch 0..9` Base/Units + `Ch 10..30` (1 Channel per TH18 Defense Type with mode, direction & Hidden Tesla masking) |
| **Inventory Input (`army_context`)** | **`(B, 64)`** — Live available troops, spells, heroes, equipment abilities, and siege machine with remaining quantities (depleted slots zeroed out) |
| **Factorized Action Heads** | `MultiDiscrete([7, 10, 50, 50, 5])` (`slot_type`, `slot_idx`, `tile_x`, `tile_y`, `deploy_fraction`) + `critic_head` $V(s)$ |
| **Training Scope** | **1 Dedicated Army Composition per Model** across the 5 TH18 reference villages (`Central Box`, `Offset Diamond`, `Anti-Hydra Ring`, `Anti-Fireball`, `Teaser Killzone`) |
| **Default Naming Convention** | `{army_slug}_ep{episodes}_{best_pct}pct_{best_stars}star.pt` (e.g., `thrower_healer_totem_smash_ep60_94pct_3star.pt`) |
| **Exported Model Metadata** | Full `army` loadout dict (`name`, `troops`, `spells`, `heroes`, `hero_equipment`, `siege_machine`, `cc_troops`, `cc_spells`) embedded in `.pt` file for automatic equipping in the AI Model Tester |

---

## 2. Why Single-Army + 31-Channel Per-Defense Spatial Input?

### A. Eliminating Cross-Army Gradient Interference
- Training a single policy across mechanically opposite armies (`Thrower + Healer Smash` ground entry vs. `Dragon Duke Hydra` air sweep vs. `Fireball Super Bowlers`) forced shared spatial filters and value heads to compromise across conflicting threat priorities.
- Specializing **1 model per army composition** lets the spatial backbone dedicate 100% of its capacity to the exact threats that matter for that army (e.g., `AirDefense` `Ch 15` and `AirSweeper` `Ch 18` for `Dragon Duke Hydra`; `Single Inferno` `Ch 22` and `Monolith` `Ch 26` for `Thrower + Healer Smash`).

### B. Direct Per-Defense Identification in Layer 1 (`Ch 10..30`)
- Previously, `Ch 0` (HP) and `Ch 1` (DPS) represented defenses only by scalar durability and raw DPS, making a `Scattershot`, `AirDefense`, and `MultiArcherTower` look nearly indistinguishable to early $3\times 3$ filters.
- With **Channels `10..30`** dedicating one $50\times 50$ plane per defense type (including mode encoding for `XBow`, `InfernoTower`, `SpellTower`, `MultiGearTower` and directional angle encoding for `AirSweeper` and `Firespitter`), `spatial_stem[0]` acts as an exact 64-D spatial embedding lookup per defense type.

### C. Live Available Inventory Tracking (`army_context`, `64-D`)
- While the army recipe is fixed per model, `army_context` tracks **what troops, spells, heroes, abilities, and siege machine are still available at step $t$ and in what quantity**, zeroing out depleted slots so the actor and critic always condition on remaining firepower.
