---
title: "v3.0 — 31-Channel Per-Defense CNN & Single-Army Specialist Actor-Critic"
model_id: "v3_per_defense_31ch"
arch_version: "3.0"
status: "active"
total_episodes: 0
best_pct: 0
best_stars: 0
updated_at: "2026-10-30 17:06:37"
tags:
  - coc-rl
  - ppo
  - model-run
  - architecture-3-0
---

# 🤖 v3.0 — 31-Channel Per-Defense CNN & Single-Army Specialist Actor-Critic

Back to [[00_Index_MOC|Vault Map of Content]] • View [[01_Model_Architecture_and_Training_Tracker.canvas|Interactive Obsidian Canvas]]

---

## 📌 Executive Summary & Single-Army Lineage

- **Model Identifier**: `v3_per_defense_31ch`
- **Architecture Version**: `v3.0` (`1,364,344` Trainable Parameters)
- **Dedicated Army Composition**: **`TH18 Thrower + Healer + Totem Smash (Meta)`** (Exported in `.pt` checkpoint metadata for testing)
- **Active Status**: **ACTIVE**
- **Total Episodes Trained**: **`0`** (Cumulative across **0** training sessions)
- **Peak Combat Performance**: **`0%` (0★)** (Best dense return: `+0.0`)
- **Latest Checkpoint**: `trained_models/thrower_healer_totem_smash_ep0_0pct_0star.pt`

### 🔄 Resumed Training Sessions History
| Session # | Start Ep | End Ep | Episodes Added | Checkpoint File | Peak % | Stars | Notes |
| :---: | :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| *No sessions recorded yet* | `0` | `0` | `+0` | `—` | `0%` | `0★` | Ready for single-army training |

---

## 1. Input Observation Space (`31 × 50 × 50` Spatial Grid + `64-D` Live Available Inventory)

- **Spatial Observation Tensor**: `(B, 31, 50, 50)` (`Ch 0..9` Base & Unit Archetypes + `Ch 10..30` One Channel per Defense Type)
- **Live Available Inventory Vector (`army_context`)**: `(B, 64)` (what troops, spells, heroes, equipment abilities, and siege machine are still available and in what remaining quantity; depleted slots zeroed out)

| Ch # | Name | Mathematical Normalization | Tactical Functional Role |
| :---: | :--- | :--- | :--- |
| `0` | **Building HP Ratio** | `hp / 11000.0 across footprint` | Base destruction tracking & target durability (Hidden Tesla masked until revealed) |
| `1` | **Defense DPS Threat** | `min(DPS / 750, 1.0)` | Identifies lethal zones (Monolith, Inferno, Scattershot, Hot Candle) |
| `2` | **Town Hall 18 Mask** | `1.0 on TH18 tiles, 0.0 elsewhere` | Pinpoints Town Hall 18 footprint for the 2nd Star |
| `3` | **Wall Integrity** | `wall_hp / max_wall_hp` | Detects closed compartments vs breached walls |
| `4` | **No-Deploy Red Zone** | `1.0 = forbidden, 0.0 = legal deploy` | Dynamic perimeter enforcing legal unit drops |
| `5` | **Friendly Ground HP** | `min(sum(HP_ground) / 5000, 1.0)` | Allied ground troop mass and density |
| `6` | **Friendly Air HP** | `min(sum(HP_air) / 5000, 1.0)` | Allied air troop mass and density |
| `7` | **Active Spell Field** | `1.0 at active spell centers` | Active Rage, Heal, Freeze, Overgrowth, Poison, Totem zones |
| `8` | **Allied Tactical Archetype** | `max phi(u) in [0, 1]` | Unit identity: Swarm (0.1) vs Ranged Core (0.6) vs Tank (0.7) vs Healer (0.81) vs Hero (0.98) |
| `9` | **Enemy Tactical Archetype** | `max phi(u) in [0, 1]` | Defending CC, Heroes, Guardians, Ground Skeletons (0.10) vs Air Skeletons (0.28) |
| `10` | **Archer Tower** | `1.0 on alive 3×3 footprint` | Point ground+air defense (10.0t range, 145 DPS) |
| `11` | **Multi-Archer Tower** | `1.0 on alive 3×3 footprint` | 3-target merged point defense (10.0t range, 363 DPS) |
| `12` | **Ricochet Cannon** | `1.0 on alive 3×3 footprint` | 2-target bounce ground defense (9.0t range, 396 DPS) |
| `13` | **Cannon** | `1.0 on alive 3×3 footprint` | Ground point defense (9.0t range, 235 DPS) |
| `14` | **Mortar** | `1.0 on alive 3×3 footprint` | Long-range ground splash (4–11t deadzone, 56 DPS) |
| `15` | **Air Defense** | `1.0 on alive 3×3 footprint` | Anti-air high single-target rocket defense (10.0t range, 650 DPS) |
| `16` | **Wizard Tower** | `1.0 on alive 3×3 footprint` | Ground+air splash defense (7.0t range, 110 DPS) |
| `17` | **Super Wizard Tower** | `1.0 on alive 3×3 footprint` | Chain-lightning multi-target defense (8.0t range, 265 DPS) |
| `18` | **Air Sweeper** | `0.25 + 0.75 * (dir_deg / 360.0)` | Directional 105° cone air pushback (encodes both presence & facing angle) |
| `19` | **Hidden Tesla** | `1.0 only when revealed, 0.0 hidden` | Revealed when enemy enters trigger range or destruction >= 51% |
| `20` | **Bomb Tower** | `1.0 on alive 3×3 footprint` | Ground splash + lethal death bomb explosion on destruction |
| `21` | **X-Bow** | `1.0 = Air & Ground, 0.5 = Ground Only` | Rapid-fire defense with mode-dependent range (11.5t A+G vs 14.0t Ground) |
| `22` | **Inferno Tower** | `1.0 = Single-Target, 0.5 = Multi-Target` | 3-stage exponential ramp beam (Single) vs 6-target scorch (Multi) |
| `23` | **Scattershot** | `1.0 on alive 3×3 footprint` | Heavy 90° cone splash behind primary target (3–10t range) |
| `24` | **Builder's Hut** | `1.0 on alive 2×2 footprint` | Weaponized turret + spawns repair builder healing nearby structures |
| `25` | **Spell Tower** | `0.25=Rage, 0.50=Poison, 0.75=Invis, 1.0=EQ` | Encodes exact equipped defensive spell tower mode |
| `26` | **Monolith** | `1.0 on alive 3×3 footprint` | Anti-tank % max-HP + flat damage priority core threat |
| `27` | **Multi-Gear Tower** | `1.0 = Long Range, 0.5 = Fast Attack` | TH18 geared defense switching between long range and fast burst |
| `28` | **Firespitter** | `0.25 + 0.75 * (dir_deg / 360.0)` | Directional 150° cone rapid piercing fireballs (encodes presence & facing angle) |
| `29` | **Revenge Tower** | `1.0 on alive 3×3 footprint` | Escalates power as 5 / 25 / 50 village buildings are destroyed |
| `30` | **Hot Candle (Crafted)** | `1.0 on alive 3×3 footprint` | Season 4 Crafted Defense firing 6 → 4 → 3 multi-target flames as it melts |

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

![Stacked CNN Computation Graph](../assets/architectures/v3_architecture.png)

---

## 4. Reward Shaping Function

### 🎯 Reward Formulation & Two-Phase Pacing (TH18 Combat v3.0)

Calibrated 100-point dense & milestone reward shaping balancing **Destruction + Core HP Damage** ($50\text{ pts}$) and **Victory Stars + Town Hall 18 Takedown** ($50\text{ pts}$):

$$R_t = 0.35 \cdot \Delta \%_{\text{destr}} + 15.0 \cdot \Delta \text{HP}_{\text{ratio}} + 12.0 \cdot \Delta \text{stars} + 14.0 \cdot \mathbb{I}_{\text{TH18}} + 0.08 \cdot C_{\text{funnel}} - 0.05 \cdot \mathbb{I}_{\text{invalid}}$$

- **Destruction & Core HP Damage**: $0.35\text{ pts}$ per $1\%$ destruction ($35.0\text{ pts}$ max) $+ 15.0\text{ pts}$ continuous building/core HP pool damage ($50.0\text{ pts}$ combined).
- **Stars & TH18 Takedown**: $12.0\text{ pts}$ per star ($36.0\text{ pts}$ max) $+ 14.0\text{ pts}$ dedicated milestone bonus upon destroying Town Hall 18 ($50.0\text{ pts}$ combined).
- **Two-Phase Tactical Masking & Normalized Per-Head Entropy (`reg_entropy`)**: Phase 1 deploys frontline troop waves along exterior cardinal funnels (excluding interior teaser holes) before Siege/Heroes; Phase 2 paces Spells (`t >= 40`) and Hero Abilities (`t >= 64`) with `NoOp` waiting and Town Hall spell-halo protection.

---

## 5. Main Results: Dedicated Army Composition vs. 5 Reference Villages

| Attack Composition | **Central Box** | **Offset Diamond** | **Anti-Hydra Ring** | **Anti-Fireball** | **Compact Teaser** | **Avg Destruction** | **3★ Rate** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **TH18 Thrower + Healer + Totem Smash** | `62% (2★)` | `75% (2★)` | `68% (2★)` | `62% (2★)` | `68% (2★)` | **67.0%** | **0.0%** |
| **Base Defense Rate (Avg)** | **62.0% (2.0★)** | **75.0% (2.0★)** | **68.0% (2.0★)** | **62.0% (2.0★)** | **68.0% (2.0★)** | **Overall: 67.0%** | — |

---

## 6. Training Progress & Optimization Curves

![Training Curves Progression](../assets/charts/v3_per_defense_31ch_training_curves.png)

### 🩺 AI Diagnostic Telemetry Suite (Head Entropy, Tactical Pacing & Critic Calibration)

See [[experiments/AI_Diagnostics_And_Training_Fixes|AI Training Diagnostics, Telemetry Architecture & PPO Pathology Fixes]] for the full Dual-LLM (`OpenCode Gemini 4 Argon` & `AGY Gemini 3.8 Flash`) diagnostic architecture.

![AI Diagnostic Telemetry Overview](../assets/charts/v3_ai_diagnostics_telemetry.png)

---

## 7. Hyperparameters & Simulation Configuration

| Hyperparameter | Value | Description |
| :--- | :--- | :--- |
| **Trained Army Composition** | `TH18 Thrower + Healer + Totem Smash (Meta)` | Single dedicated army composition per model |
| **Default Checkpoint Pattern** | `thrower_healer_totem_smash_ep{N}_{pct}pct_{stars}star.pt` | Army-prefixed checkpoint naming convention |
| **Learning Rate (`lr`)** | `0.0003` | Adam optimizer learning rate (Critic `2.5x`) |
| **Batch Episodes** | `12` | Trajectories collected per PPO update |
| **Minibatch Size** | `128` | SGD transition batch size |
| **PPO Epochs** | `4` | Optimization passes over collected rollout |
| **Simulation Ticks / Step** | `8` | Simulated combat duration per RL decision ($0.8\text{s}$) |
| **Discount ($\gamma$)** | `0.99` | Reward discount factor |
| **GAE ($\lambda$)** | `0.95` | Generalized Advantage Estimation smoothing |
| **Clip Coefficient** | `0.2` | PPO surrogate objective clipping range |
| **Entropy Coefficient** | `0.015` | Normalized per-head exploration policy entropy bonus |
| **Total Training Episodes** | **`0`** | **Cumulative episodes across all resumed sessions** |
