---
title: "CoC TH18 Deep RL — Architecture & Experiment Vault (MOC)"
tags:
  - moc
  - coc-rl
  - ppo
  - architecture
updated: 2026-10-29
---

# 🏰 CoC TH18 Deep RL — Architecture & Training Vault

Welcome to the central research vault tracking every neural network architecture revision, input/output tensor specification, spatial archetype encoding, and empirical training benchmark for the Clash of Clans Town Hall 18 Deep RL agent.

---

## 🧭 Primary Navigation

### 🎨 [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Model Architecture & Training Canvas]]
Open the interactive 2D whiteboard visualizer presenting side-by-side architecture comparisons, stacked CNN computation graphs, comp-vs-village benchmark matrices, training curves, and resumed training session timelines.

---

## 📊 Model Architecture Runs

| Model Run | Arch | Spatial Input | Total Episodes | Peak Combat Record | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| [[runs/v1_baseline_8ch\|v1.0 — Baseline 8-Channel Single-Deploy]] | `v1.0` | `(8, 50, 50)` | **`30,102`** (6 sessions) | **`100%` (3★)** | **SUPERSEDED** |
| [[runs/v2_archetype_10ch\|v2.0 — 10-Channel Archetype & Batch-Deploy Fraction]] | `v2.0` | `(10, 50, 50)` | **`120`** (2 sessions) | **`100%` (3★)** | **ACTIVE** |

---

## 📚 Technical Reference Sections

### 1. Neural Architectures (`architectures/`)
- [[architectures/v1.0_Baseline_8Ch_SingleDeploy|v1.0 — Baseline 8-Channel Spatial CNN & 3-Head Single-Unit Actor-Critic]]
- [[architectures/v2.0_10Ch_Archetype_And_DeployFraction|v2.0 — 10-Channel Unit-Archetype CNN & 4-Head Batch-Fraction Actor-Critic]]

### 2. Spatial & Tensor Encodings (`encodings/`)
- [[encodings/Unit_Type_Spatial_Encoding|Hierarchical Tactical-Archetype Spatial Encoding (Ch 8 & Ch 9)]]

### 3. Empirical Benchmark Logs (`experiments/`)
- [[experiments/Experiment_Log_And_Benchmarks|Master Experiment Log & Model Checkpoint Comparison]]
