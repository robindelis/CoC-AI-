---
title: "CoC TH18 Deep RL — Architecture & Experiment Vault (MOC)"
tags:
  - moc
  - coc-rl
  - ppo
  - architecture
updated: 2026-10-30
last_synced_commit: "f810ae8"
last_synced_at: "2026-10-30 22:20:26"
---

# 🏰 CoC TH18 Deep RL — Architecture & Training Vault

> [!NOTE] 🔄 Codebase Synchronization Status
> **Synchronized Commit**: [`f810ae8`](file:///home/robin/Projects/CoC) &mdash; *feat(vault): add incremental git-commit diff analyzer and persistent sync state for vault-updater*
> **Synced At**: `2026-10-30 22:20:26 UTC` • **Full SHA**: `f810ae865ad9be5595105956d167c3d47c6d27a2`

Welcome to the central research vault tracking our **v3.0 59-Channel Dedicated Spatial CNN & Single-Army Specialist Actor-Critic** architecture, input/output tensor specifications, per-troop, per-hero, per-spell, and per-defense spatial encodings, and empirical training benchmarks for Clash of Clans Town Hall 18.

---

## 🧭 Primary Navigation

### 🎨 [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Model Architecture & Training Canvas]]
Open the interactive 2D whiteboard visualizer presenting the 59-channel stacked CNN computation graph, live available inventory (`army_context`) fusion, single-army vs. 5-village benchmark matrices, training curves, and resumed training session timelines.

---

## 📊 Single-Army Specialist Model Runs

| Model Run | Arch | Inputs (`obs` + `army_context`) | Dedicated Army Composition | Total Episodes | Peak Combat Record | Status |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| [[runs/v3_per_defense_31ch\|v3.0 — 50-Channel Dedicated CNN & Single-Army Specialist Actor-Critic]] | `v3.0` | `(59, 50, 50)` + `64D` | **TH18 Thrower + Healer + Totem Smash (Meta)** | **`6,492`** (9 sessions) | **`100%` (3★)** | **ACTIVE** |

---

## 📚 Technical Reference Sections

### 1. Neural Architecture (`architectures/`)
- [[architectures/v3.0_31Ch_PerDefense_SingleArmy_ActorCritic|v3.0 — 50-Channel Dedicated Spatial CNN & Single-Army Specialist Actor-Critic (1.38M Params)]]

### 2. Spatial & Inventory Tensor Encodings (`encodings/`)
- [[encodings/Defense_And_Unit_Spatial_Encoding|50-Channel Dedicated Spatial Grid (Ch 0..49) & Live Available Inventory (64-D)]]
- [[encodings/Unit_Type_Spatial_Encoding|Hierarchical Tactical-Archetype Unit Encoding (Offline Diagnostics & ADR-007 Transition)]]

### 3. Long-Term Memory & Architectural Decisions (`decisions/`)
- [[decisions/Architecture_Decisions_And_System_Memory|Project Memory, Architectural Decision Records (ADRs) & Source of Truth]]

### 4. Empirical Benchmark Logs & AI Training Diagnostics (`experiments/`)
- [[experiments/Experiment_Log_And_Benchmarks|Master Experiment Log & Single-Army Specialist Benchmarks]]
- [[experiments/AI_Diagnostics_And_Training_Fixes|AI Training Diagnostics, Telemetry Architecture & PPO Pathology Fixes]]
