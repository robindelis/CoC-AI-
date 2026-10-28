---
title: "v2.0 — 10-Channel Archetype & Batch-Deploy Fraction"
model_id: "v2_archetype_10ch"
arch_version: "2.0"
status: "active"
total_episodes: 2726
best_pct: 85
best_stars: 2
updated_at: "2026-10-28 16:27:35"
tags:
  - coc-rl
  - ppo
  - model-run
  - architecture-2-0
---

# 🤖 v2.0 — 10-Channel Archetype & Batch-Deploy Fraction

Back to [[00_Index_MOC|Vault Map of Content]] • View [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Obsidian Canvas]]

---

## 📌 Executive Summary & Lineage

- **Model Identifier**: `v2_archetype_10ch`
- **Architecture Version**: `v2.0`
- **Active Status**: **ACTIVE**
- **Total Episodes Trained**: **`2,726`** (Cumulative across **2** training sessions)
- **Peak Combat Performance**: **`85%` (2★)** (Best dense return: `+76.49`)
- **Latest Checkpoint**: `trained_models/attacker_ep2726_85pct_2star.pt`

### 🔄 Resumed Training Sessions History
| Session # | Start Ep | End Ep | Episodes Added | Checkpoint File | Peak % | Stars | Notes |
| :---: | :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| **#1** | `0` | `2,724` | `+2,724` | `latest_attacker.pt` | `84%` | `2★` | Initial training: fractional wave drops (0.25..1.0) and unit archetype perception (Ch 8 & 9) |
| **#2** | `2,724` | `2,726` | `+2` | `attacker_ep2726_85pct_2star.pt` | `85%` | `2★` | Resumed training (+2 ep from latest_attacker.pt) |

---

## 1. Input Observation Space

- **Spatial Observation Tensor**: `(B, 10, 50, 50)`
- **Global Army Context Vector**: `(B, 64)` (remaining troops, heroes, abilities, sieges, spells)

| Ch # | Name | Mathematical Normalization | Tactical Functional Role |
| :---: | :--- | :--- | :--- |
| `0` | **Building HP Ratio** | `hp / max_hp across footprint` | Base destruction tracking & target durability |
| `1` | **Defense DPS Threat** | `min(DPS / 1000, 1.0)` | Identifies lethal zones (Monolith, Eagle, Inferno) |
| `2` | **Town Hall 18 Mask** | `1.0 on TH18 tiles, 0.0 elsewhere` | Pinpoints Town Hall for the crucial 2nd Star |
| `3` | **Wall Integrity** | `wall_hp / max_wall_hp` | Detects closed compartments vs breached walls |
| `4` | **No-Deploy Red Zone** | `1.0 = forbidden, 0.0 = legal deploy` | Dynamic perimeter enforcing legal unit drops |
| `5` | **Friendly Ground HP** | `min(sum(HP_ground) / 5000, 1.0)` | Allied ground troop mass and density |
| `6` | **Friendly Air HP** | `min(sum(HP_air) / 5000, 1.0)` | Allied air troop mass and density |
| `7` | **Active Spell Field** | `min(remaining_ticks / 300, 1.0)` | Active Rage, Heal, Freeze, Overgrowth aura |
| `8` | **Allied Tactical Archetype** | `max phi(u) in [0, 1]` | Unit identity: Swarm (0.1) vs Ranged Core (0.6) vs Tank (0.7) vs Healer (0.81) vs Hero (0.98) |
| `9` | **Enemy Tactical Archetype** | `max phi(u) in [0, 1]` | Defending CC, Heroes, Guardians, Ground Skeletons (0.10) vs Air Skeletons (0.28) |

---

## 2. Output Policy & Action Space

The network parameterizes a factorized multi-discrete policy:

- **Head 1**: `slot_type (7)`
- **Head 2**: `slot_idx (10)`
- **Head 3**: `deploy_fraction (5)`
- **Head 4**: `tile_xy (2500)`
- **Head 5**: `critic_value (1)`

---

## 3. Stacked CNN Architecture

![Stacked CNN Computation Graph](../assets/architectures/v2_architecture.png)

---

## 4. Reward Shaping Function

### 🎯 Reward Formulation (TH18 Combat)

Balanced 50/50 weighting between **Destruction Percentage** and **Milestone Victory Stars**:

$$R_t = 0.50 \cdot \Delta \%_{\text{destr}} + 16.6667 \cdot \Delta \text{stars} - 0.05 \cdot \mathbb{I}_{\text{invalid}}$$

- **Destruction**: $0.50\text{ pts}$ per $1\%$ building destruction ($50.0\text{ pts}$ max).
- **Victory Stars**: $\frac{50.0}{3} = 16.6667\text{ pts}$ per star earned ($50.0\text{ pts}$ max for 3 stars).
- **Invalid Penalty**: $-0.05\text{ pts}$ deducted for executing illegal actions (e.g. dropping in red zone).
- **Total Wipe Return**: A complete $100\%$ 3-star wipe achieves **$100.0\text{ base reward}$**.
- **Fast-Forward Bonus**: When active attack actions are exhausted or timer reaches limit, remaining simulation ticks run to resolution and award accrued terminal rewards.

---

## 5. Main Results: Army Composition vs Reference Village Matrix

| Attack Composition | **Central Box** | **Offset Diamond** | **Anti-Hydra Ring** | **Anti-Fireball** | **Compact Teaser** | **Avg Destruction** | **3★ Rate** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **TH18 Thrower + Healer + Totem Smash** | `39% (0★)` | `45% (0★)` | `61% (2★)` | `80% (1★)` | `58% (2★)` | **56.6%** | **0.0%** |
| **TH18 Dragon Duke Charge Hydra** | `45% (0★)` | `40% (0★)` | `53% (1★)` | `66% (1★)` | `55% (2★)` | **51.8%** | **0.0%** |
| **TH18 Fireball Super Bowler & Meteor Golem Smash** | `37% (0★)` | `53% (1★)` | `58% (1★)` | `40% (0★)` | `64% (2★)` | **50.4%** | **0.0%** |
| **Base Defense Rate (Avg)** | **40.3% (0.0★)** | **46.0% (0.33★)** | **57.3% (1.33★)** | **62.0% (0.67★)** | **59.0% (2.0★)** | **Overall: 52.9%** | — |

---

## 6. Training Progress & Optimization Curves

![Training Curves Progression](../assets/charts/v2_archetype_10ch_training_curves.png)

---

## 7. Hyperparameters & Simulation Configuration

| Hyperparameter | Value | Description |
| :--- | :--- | :--- |
| **Learning Rate (`lr`)** | `0.0003` | Adam optimizer learning rate |
| **Batch Episodes** | `4` | Trajectories collected per PPO update |
| **Minibatch Size** | `64` | SGD transition batch size |
| **PPO Epochs** | `4` | Optimization passes over collected rollout |
| **Simulation Ticks / Step** | `8` | Simulated combat duration per RL decision ($0.64\text{s}$) |
| **Discount ($\gamma$)** | `0.99` | Reward discount factor |
| **GAE ($\lambda$)** | `0.95` | Generalized Advantage Estimation smoothing |
| **Clip Coefficient** | `0.2` | PPO surrogate objective clipping range |
| **Entropy Coefficient** | `0.015` | Exploration policy entropy bonus |
| **Total Training Episodes** | **`2,726`** | **Cumulative episodes across all resumed sessions** |
