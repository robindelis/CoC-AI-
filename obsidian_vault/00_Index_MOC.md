---
title: "CoC TH18 Deep RL — Architecture & Experiment Vault (MOC)"
tags:
  - moc
  - coc-rl
  - ppo
  - architecture
updated: 2026-10-28
---

# 🏰 CoC TH18 Deep RL — Obsidian Research Vault

Welcome to the central **Map of Content (MOC)** tracking every neural network architecture revision, input/output tensor reformulation, spatial encoding scheme, and empirical training benchmark for our Clash of Clans Town Hall 18 Reinforcement Learning agent.

---

## 🧭 Vault Navigation

### 1. Neural Architectures (`architectures/`)
- [[v1.0_Baseline_8Ch_SingleDeploy|v1.0 — Baseline 8-Channel Spatial CNN & 3-Head Single-Unit Actor-Critic]]
  - Initial `8×50×50` spatial observation + `64-D` army vector.
  - 3-head factorized policy $(a_{\text{type}}, a_{\text{idx}}, a_{x,y})$ that deployed **1 troop per action** ($0.64\text{s}$ per unit).
- [[v2.0_10Ch_Archetype_And_DeployFraction|v2.0 — 10-Channel Unit-Archetype CNN & 4-Head Batch-Fraction Actor-Critic]]
  - Upgraded `10×50×50` spatial observation adding **Ch 8 (Allied Unit Type Signature)** and **Ch 9 (Enemy CC / Hero / Skeleton Trap Unit Type Signature)**.
  - Added 4th policy head (`deploy_fraction_head`, $\alpha_{\text{frac}} \in \{0.0, 0.25, 0.50, 0.75, 1.00\}$) enabling instantaneous multi-unit wave drops ($N_{\text{spawn}} = \max(1, \text{round}(\alpha_{\text{frac}} \cdot N_{\text{avail}}))$).

### 2. Spatial & Tensor Encodings (`encodings/`)
- [[Unit_Type_Spatial_Encoding|Hierarchical Tactical-Archetype Spatial Encoding (Ch 8 & Ch 9)]]
  - Why raw integer enum IDs ($1, 2, \dots, 65$) are mathematically flawed for `Conv2d` kernels.
  - How our structured functional-role spectrum $\phi(u) \in [0, 1]$ with dominant-unit max-pooling $\max_{u \in (x,y)} \phi(u)$ preserves smooth convolutional gradients.
  - Explicit separation of **Ground Skeletons (`0.10`)** vs. **Air Skeletons (`0.28`)**, defending Clan Castle troops, defending Heroes, and TH18 Guardians.

### 3. Training Runs & Empirical Results (`experiments/`)
- [[Experiment_Log_And_Benchmarks|Master Experiment Log & Model Checkpoint Comparison]]
  - Side-by-side comparison of `v1.0` vs. `v2.0` across episode budgets ($40$, $120$, $250+$ episodes), destruction %, 3-star rate, action horizon efficiency, and spell placement accuracy.

---

## 📊 Quick Summary of Architecture Evolution

| Version | Spatial Input Shape | Context Input | Actor Heads | Total Params (`CoCActorCritic`) | Key Capability Unlocked |
| :--- | :--- | :--- | :--- | :--- | :--- |
| [[v1.0_Baseline_8Ch_SingleDeploy\|v1.0]] | `8 × 50 × 50` | `64-D` | 3 (`type`, `idx`, `tile`) | `876,695` | Base layout recognition & basic funneling, but slow $1\times$ troop deployment ($8.96\text{s}$ for 14 Throwers) and blind to defending CC/Skeleton types. |
| [[v2.0_10Ch_Archetype_And_DeployFraction\|v2.0]] | `10 × 50 × 50` | `64-D` | 4 (`type`, `idx`, `frac`, `tile`) | `878,236` | Instant fractional wave deployment ($\alpha_{\text{frac}}$) + full awareness of allied unit roles (Ch 8) and enemy CC/Heroes/Air vs. Ground Skeletons (Ch 9). |
