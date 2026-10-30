---
title: "CoC TH18 Deep RL — Architecture & Experiment Vault (MOC)"
tags:
  - moc
  - coc-rl
  - ppo
  - architecture
updated: 2026-10-30
---

# 🏰 CoC TH18 Deep RL — Architecture & Training Vault

Welcome to the central research vault tracking our **v3.0 31-Channel Per-Defense Spatial CNN & Single-Army Specialist Actor-Critic** architecture, input/output tensor specifications, per-defense and unit archetype spatial encodings, and empirical training benchmarks for Clash of Clans Town Hall 18.

---

## 🧭 Primary Navigation

### 🎨 [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Model Architecture & Training Canvas]]
Open the interactive 2D whiteboard visualizer presenting the 31-channel stacked CNN computation graph, live available inventory (`army_context`) fusion, single-army vs. 5-village benchmark matrices, training curves, and resumed training session timelines.

---

## 📊 Single-Army Specialist Model Runs

| Model Run | Arch | Inputs (`obs` + `army_context`) | Dedicated Army Composition | Total Episodes | Peak Combat Record | Status |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| [[runs/v3_per_defense_31ch\|v3.0 — 31-Channel Per-Defense CNN & Single-Army Specialist Actor-Critic]] | `v3.0` | `(31, 50, 50)` + `64D` | **TH18 Thrower + Healer + Totem Smash (Meta)** | **`0`** (0 sessions) | **`0%` (0★)** | **ACTIVE** |

---

## 📚 Technical Reference Sections

### 1. Neural Architecture (`architectures/`)
- [[architectures/v3.0_31Ch_PerDefense_SingleArmy_ActorCritic|v3.0 — 31-Channel Per-Defense Spatial CNN & Single-Army Specialist Actor-Critic (1.36M Params)]]

### 2. Spatial & Inventory Tensor Encodings (`encodings/`)
- [[encodings/Defense_And_Unit_Spatial_Encoding|31-Channel Per-Defense Spatial Grid (Ch 10..30), Unit Archetypes (Ch 8..9) & Live Available Inventory (64-D)]]
- [[encodings/Unit_Type_Spatial_Encoding|Hierarchical Tactical-Archetype Unit Encoding (Ch 8 & Ch 9 Deep Dive)]]

### 3. Empirical Benchmark Logs & AI Training Diagnostics (`experiments/`)
- [[experiments/Experiment_Log_And_Benchmarks|Master Experiment Log & Single-Army Specialist Benchmarks]]
- [[experiments/AI_Diagnostics_And_Training_Fixes|AI Training Diagnostics, Telemetry Architecture & PPO Pathology Fixes]]
