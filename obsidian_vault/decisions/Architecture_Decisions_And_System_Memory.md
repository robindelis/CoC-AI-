---
title: "Project Long-Term Memory & Architectural Decision Records (ADRs)"
tags:
  - memory
  - source-of-truth
  - adr
  - architecture
  - coc-rl
  - tensor-spec
updated: 2026-10-30
---

# 🧠 CoC TH18 Deep RL — Project Long-Term Memory & Source of Truth

Back to [[00_Index_MOC|Vault Index (MOC)]] • Architecture: [[architectures/v3.0_31Ch_PerDefense_SingleArmy_ActorCritic|v3.0 Architecture Spec]] • Encodings: [[encodings/Defense_And_Unit_Spatial_Encoding|50-Channel Defense & Unit Encoding Spec]]

---

## 🏛️ Invariant: The Obsidian Vault as the Project's Long-Term Memory

The `obsidian_vault/` directory is the **authoritative single source of truth** for all architectural invariants, design decisions, mathematical tensor formulations, training configurations, and empirical benchmarks of this project.

1. **Evolution & Mutability**: As the simulation engine (`crates/coc-engine`), neural network architectures (`python/coc_rl/networks.py`), or training pipelines evolve, this vault must be continuously updated.
2. **Synchronized Agent**: A persisting specialist agent (`vault-updater`, running on `agy` with `gemini-3.8-flash-medium`) is registered to reconcile codebase modifications directly into this memory ledger.
3. **No Unrecorded Architectural Drift**: Any shift in tensor channels, normalization factors, action spaces, or environment logic must be explicitly captured in an Architectural Decision Record (ADR) below.

---

## 📥 Current Input Implementation

The deep reinforcement learning attacker policy receives two fused inputs at every decision step `t`:
1. A **50-Channel Spatial Observation Tensor** `obs` with shape `(B, 50, 50, 50)`
2. A **64-Dimensional Live Available Inventory Vector** `army_context` with shape `(B, 64)`

```text
[Input 1: obs (50, 50, 50)]  ───> [CoCSpatialEncoder] ───> spatial_features (B, 128, 50, 50)
                                        │
                                        └───> global_emb (B, 256)
                                                  │
[Input 2: army_context (64)] ───> [Linear+LN+SiLU] ───(+) (Residual Fusion)
                                                  │
                                       ┌──────────┴──────────┐
                                  [Factorized Actor Heads] [Critic Head]
```

### 1. 50-Channel Spatial Observation Grid (`(B, 50, 50, 50)`)

Extracted directly by the Rust simulation engine via `BattleEngine::extract_spatial_observation()` (`crates/coc-engine/src/sim.rs`):

| Channel # | Channel Name | Value / Formula on Footprint | Tactical Significance |
| :---: | :--- | :--- | :--- |
| **`0`** | **Building HP Ratio** | `hp / 11000.0` clamped to `[0, 1]` | Structural integrity across surviving building footprints. Hidden Teslas write `0.0` until revealed. |
| **`1`** | **Defense DPS Threat** | `min(spec.dps / 750.0, 1.0)` | Lethal danger field across active defensive turrets. Hidden Teslas write `0.0` until revealed. |
| **`2`** | **Town Hall 18 Mask** | `1.0` on 4×4 TH18 tiles, `0.0` elsewhere | Locates the 2nd Victory Star objective and high-HP core defense zone. |
| **`3`** | **Wall Durability** | `hp / max_hp` clamped to `[0, 1]` | Wall segment durability (1×1 tile per piece). Breached or destroyed walls drop to `0.0`. |
| **`4`** | **No-Deploy Red Zone** | `1.0` = forbidden, `0.0` = legal deployment | Dynamic exclusion mask around living structures restricting troop, hero, and siege placement. |
| **`5`** | **Thrower** | `N / 12.0` on tile | Primary ranged siege artillery cluster density (max 12 in army). |
| **`6`** | **Healer** | `N / 5.0` on tile | Airborne sustain support pocket escorting main push (max 5 in army). |
| **`7`** | **Furnace** | `N / 2.0` on tile | Mobile siege spawner launching continuous suicidal Firemites (max 2 in army). |
| **`8`** | **Druid & Bear** | `N / 1.0` on tile | Support healer evolving into frontline Bear brawler upon death (max 1 in army). |
| **`9`** | **Ice Golem** | `N / 1.0` on tile | Frontline freeze tank immobilizing nearby defenses upon death (max 1 in army). |
| **`10`** | **Super Wall Breaker** | `N / 1.0` on tile | Mega-bomb breach unit for high-value compartment entry (max 1 in army). |
| **`11`** | **Headhunter** | `N / 1.0` on tile | Specialist hero-assassin dealing 4x damage to defending heroes (max 1 in army). |
| **`12`** | **Balloon** | `N / 1.0` on tile | Targeted air defense-seeker and trap tester (max 1 in army). |
| **`13`** | **Archer** | `N / 4.0` on tile | Light perimeter clean-up squad sniping exposed corner structures (max 4 in army). |
| **`14`** | **Log Launcher (Siege)** | `1.0` on tile | Rolling battering ram piercing wall lines toward Town Hall (max 1 in army). |
| **`15`** | **CC Super Yeti** | `1.0` on tile | Core melee tank released from popped Log Launcher with Heavy Yetimites (max 1 in army). |
| **`16`** | **CC Super Valkyrie** | `1.0` on tile | Core whirlwind brawler dropping lingering Rage Spell upon death (max 1 in army). |
| **`17`** | **Barbarian King** | `1.0` on tile | High-HP melee tank equipped with Spiky Ball & Snake Bracelet (0 or 1). |
| **`18`** | **Archer Queen** | `1.0` on tile | High-DPS ranged carry equipped with Magic Mirror & Action Figure (0 or 1). |
| **`19`** | **Grand Warden** | `1.0` on tile | Support aura hero providing Eternal Tome invulnerability & Rage Gem (0 or 1). |
| **`20`** | **Royal Champion** | `1.0` on tile | Target-seeking defense assassin with Rocket Spear & Electro Boots (0 or 1). |
| **`21`** | **Totem Spell (HP Ratio)** | `hp / max_hp` on 1×1 tile | Summoned lightning totem unit absorbing defense fire & pulsing lightning. |
| **`22`** | **Rage Spell (Fade AoE)** | `rem / total` across AoE radius | Continuous 1.0 -> 0.0 fading speed & damage boost circle. |
| **`23`** | **Poison Spell (Fade AoE)** | `rem / total` across AoE radius | Continuous 1.0 -> 0.0 fading defending CC deceleration & poison mist circle. |
| **`24`** | **Skeleton Spell (Fade AoE)** | `rem / total` across AoE radius | Continuous 1.0 -> 0.0 fading friendly skeleton distraction summon circle. |
| **`25`** | **Enemy CC & Guardian** | `min(N / 5.0, 1.0)` | Defending Clan Castle troops (Lava Hound, Ice Golem, Headhunters) & TH18 Guardian. |
| **`26`** | **Enemy Heroes** | `1.0` on tile | Defending King, Queen, Warden, and Dragon Duke on defensive banners. |
| **`27`** | **Enemy Ground Skeletons** | `min(N / 10.0, 1.0)` | Defending ground skeletons from skeleton traps & defending witch. |
| **`28`** | **Enemy Air Skeletons** | `min(N / 10.0, 1.0)` | Defending air skeletons from air skeleton traps targeting air units. |
| **`29`** | **Archer Tower** | `1.0` while alive (3×3) | Point defense targeting ground + air (10.0t range, 145 DPS). |
| **`30`** | **Multi-Archer Tower** | `1.0` while alive (3×3) | Merged 3-target point defense (10.0t range, 363 DPS). |
| **`31`** | **Ricochet Cannon** | `1.0` while alive (3×3) | Merged 2-target ground bounce defense (9.0t range, 396 DPS). |
| **`32`** | **Cannon** | `1.0` while alive (3×3) | Standard ground point defense (9.0t range, 235 DPS). |
| **`33`** | **Mortar** | `1.0` while alive (3×3) | Long-range ground splash with 4–11t blind deadzone (56 DPS). |
| **`34`** | **Air Defense** | `1.0` while alive (3×3) | Lethal anti-air rocket battery (10.0t range, 650 DPS). |
| **`35`** | **Wizard Tower** | `1.0` while alive (3×3) | Ground + air area splash defense (7.0t range, 110 DPS). |
| **`36`** | **Super Wizard Tower** | `1.0` while alive (3×3) | Merged chain-lightning defense hitting up to 15 targets (8.0t range, 265 DPS). |
| **`37`** | **Air Sweeper** | `0.25 + 0.75 * (theta_deg / 360.0)` | Encodes 2×2 footprint and continuous 105° pushback cone facing angle in `[0.25, 1.0]`. |
| **`38`** | **Hidden Tesla** | `1.0` when revealed (2×2), `0.0` hidden | Hidden information invariant: strictly `0.0` until revealed by proximity or >=51% destruction. |
| **`39`** | **Bomb Tower** | `1.0` while alive (3×3) | Ground splash defense + triggers high-damage death bomb upon destruction. |
| **`40`** | **X-Bow** | `1.0` = Air+Ground, `0.5` = Ground-only | Distinguishes 11.5t Air+Ground mode from 14.0t Ground-only mode. |
| **`41`** | **Inferno Tower** | `1.0` = Single-Target, `0.5` = Multi-Target | Distinguishes ramping single-target beam from 6-target multi mode. |
| **`42`** | **Scattershot** | `1.0` while alive (3×3) | Heavy splash defense with 90° blast cone behind target (3–10t range). |
| **`43`** | **Builder's Hut** | `1.0` while alive (2×2) | Weaponized turret that spawns an active repair builder healing damaged buildings. |
| **`44`** | **Spell Tower** | `0.25` Rage, `0.50` Poison, `0.75` Invis, `1.00` EQ | Encodes the active defensive spell canister triggered on compartment breach. |
| **`45`** | **Monolith** | `1.0` while alive (3×3) | High-threat tank destroyer dealing flat damage plus percentage of max HP. |
| **`46`** | **Multi-Gear Tower** | `1.0` = Long Range, `0.5` = Fast Attack | Distinguishes sniper mode from rapid-fire mode. |
| **`47`** | **Firespitter** | `0.25 + 0.75 * (theta_deg / 360.0)` | Encodes 3×3 footprint and continuous 150° piercing fireball cone angle in `[0.25, 1.0]`. |
| **`48`** | **Revenge Tower** | `1.0` while alive (3×3) | Escalating defense activating stage buffs at 5 / 25 / 50 destroyed structures. |
| **`49`** | **Hot Candle (Crafted)** | `1.0` while alive (3×3) | Season 4 Crafted Defense (`CraftingStation`) melting down through 6 -> 4 -> 3 flames. |

### 2. Live Army Context Vector (`(B, 64)`)

Extracted by `BattleEngine::extract_army_context()` (`crates/coc-engine/src/sim.rs`):

```text
Indices:  [0..4]        [4..24]           [24..44]          [44..56]         [56..64]
Content:  Progress      10 Troop Slots    10 Spell Slots    4 Hero Slots     Siege & CC
Size:     4 floats      20 floats         20 floats         12 floats        8 floats
```

- **`[0..4]` Global Battle Progress (4 floats)**:
  - `ctx[0] = ((1800.0 - tick) / 1800.0).clamp(0.0, 1.0)`: Remaining combat time fraction (180 seconds total).
  - `ctx[1] = (destruction_pct / 100.0).clamp(0.0, 1.0)`: Current village destruction percentage.
  - `ctx[2] = (stars / 3.0).clamp(0.0, 1.0)`: Victory stars achieved (50% destruction, Town Hall destroyed, 100% destruction).
  - `ctx[3] = (active_attackers / 50.0).clamp(0.0, 1.0)`: Alive allied units currently on the battlefield.

- **`[4..24]` 10 Attacking Troop Slots (20 floats, 2 floats per slot `i in 0..9`)**:
  - `ctx[4 + i * 2] = (troop_id + 1) / 60.0`: Normalized troop type identifier.
  - `ctx[4 + i * 2 + 1] = remaining_count / 20.0`: Normalized remaining count.
  - **Depletion Invariant**: Once a troop slot is depleted (`remaining_count == 0`), **both entries immediately become `0.0`**.

- **`[24..44]` 10 Attacking Spell Slots (20 floats, 2 floats per slot `i in 0..9`)**:
  - `ctx[24 + i * 2] = (spell_id + 1) / 20.0`: Normalized spell type identifier.
  - `ctx[24 + i * 2 + 1] = remaining_count / 8.0`: Normalized remaining spell count.
  - **Depletion Invariant**: Once a spell slot is depleted (`remaining_count == 0`), **both entries immediately become `0.0`**.

- **`[44..56]` 4 Attacking Hero Slots (12 floats, 3 floats per hero `i in 0..3`)**:
  - `ctx[44 + i * 3] = ((hero_id + 1) * 60 + eq_sig + pet_sig) / 500.0`: Unique composite hero signature combining hero type, equipped gear (e.g. Giant Gauntlet, Spiky Ball, Fireball, Rocket Boots), and companion pet (e.g. Spirit Fox, Phoenix, Diggy).
  - `ctx[44 + i * 3 + 1]`: Availability or current HP ratio. Equals `1.0` while undeployed in dock; equals `u.hp / u.max_hp` once alive on the battlefield.
  - `ctx[44 + i * 3 + 2]`: Ability readiness state:
    - `0.5`: Undeployed in dock.
    - `1.0`: Deployed on battlefield and active ability is ready to trigger.
    - `0.0`: Active ability already triggered / spent.

- **`[56..64]` Siege Machine & Clan Castle Slots (8 floats)**:
  - `ctx[56] = (siege_id + 1) / 60.0`: Normalized siege machine type identifier.
  - `ctx[57]`: Undeployed siege machine availability in dock (`1.0` ready, `0.0` deployed/none).
  - `ctx[58]`: Deployed siege machine manual pop availability (`1.0` active and unpopped, `0.0` popped or none).
  - `ctx[59]`: Clan Castle popped flag (`1.0` if CC troops have broken out, `0.0` otherwise).
  - `ctx[60..61]`: CC Troop Slot 0: `(troop_id + 1) / 60.0` and `count / 5.0`.
  - `ctx[62..63]`: CC Troop Slot 1: `(troop_id + 1) / 60.0` and `count / 5.0`.

---

## 📤 Current Output Implementation (Action & Value Heads)

Defined in `CoCActorCritic` (`python/coc_rl/networks.py`), the policy parameterizes a **factorized multi-discrete action space** with autoregressive conditioning and invalid-action masking, alongside a scalar state-value critic:

```text
                    [Fused Global Embedding (256-D)]
                                   │
       ┌───────────────────────────┼───────────────────────────┐
       ▼                           ▼                           ▼
[Head 1: slot_type]       [Critic: V(s) Value]        [Head 4: tile_xy]
   (7 logits)                  (1 scalar)                (2500 logits)
       │                                                       ▲
       ├───────────────────────────┐                           │
       ▼                           ▼                           │
[Head 2: slot_idx]      [tile_cond_proj FiLM] ─────────────────┘
  (10 logits)                      │
       │                           ▼
       └──────────────────> [Head 3: deploy_fraction]
                               (5 logits)
```

### Head 1: `slot_type` (7 Categorical Logits)
- **Module**: `slot_type_head: Linear(256 -> 7)`
- **Action Classes**:
  - `0 = NoOp`: Pass the decision step without deploying units or spending spells.
  - `1 = Troop`: Deploy attacking troop(s) from the army loadout.
  - `2 = Hero`: Deploy an available hero onto the battlefield.
  - `3 = HeroAbility`: Trigger the manual active ability of an already-deployed hero.
  - `4 = Siege`: Deploy the attacking siege machine.
  - `5 = PopSiege`: Manually breach the active siege machine early to release Clan Castle reinforcements.
  - `6 = Spell`: Cast a tactical spell from the spell deck.
- **Masking**: Masked by `action_masks["slot_type"]` so illegal action categories (e.g. attempting to deploy an already-spent siege machine or hero) receive `-1e8` logit penalty.

### Head 2: `slot_idx` (10 Categorical Logits)
- **Module**: `slot_idx_head: MLP(embed_dim + 7 -> 128 -> 10)`
- **Conditioning**: Autoregressively conditioned on `torch.cat([global_emb, one_hot(chosen_slot_type)], dim=-1)` (263 dimensions).
- **Semantics**:
  - When `slot_type == Troop`: Selects troop loadout slot index `0..9`.
  - When `slot_type == Spell`: Selects spell loadout slot index `0..9`.
  - When `slot_type in (Hero, HeroAbility)`: Selects hero index `0..3`.
  - When `slot_type in (NoOp, Siege, PopSiege)`: Slot index is clamped / masked to `0`.
- **Masking**: Masked by `action_masks["slot_idx"]` based on remaining inventory counts.

### Head 3: `deploy_fraction` (5 Categorical Logits)
- **Module**: `deploy_fraction_head: MLP(embed_dim + 7 + 10 -> 128 -> 5)`
- **Conditioning**: Autoregressively conditioned on `torch.cat([global_emb, one_hot(chosen_type), one_hot(chosen_idx)], dim=-1)` (273 dimensions).
- **Discrete Fraction Bins**: `(0.0, 0.25, 0.50, 0.75, 1.00)`
- **Deployment Formula**:
  ```python
  def compute_deploy_count(avail_count: int, deploy_fraction: float) -> int:
      if avail_count <= 0:
          return 0
      frac = max(0.0, min(1.0, float(deploy_fraction)))
      return max(1, min(int(avail_count), int(round(avail_count * frac))))
  ```
- **Tactical Impact**: Allows the agent to drop a surgical scout unit (`bin 0` = 1 unit), commit half an army flank (`bin 2` = 50%), or dump an entire batch (e.g. all 15 Miners or all 8 Wall Breakers at once with `bin 4` = 100%) in a single decision step.

### Head 4: `tile_xy` (2500 Spatial Logits, 50×50 Coordinate Map)
- **Module**: `tile_cond_proj: Linear(263 -> 128)` + FiLM Spatial Modulation + `Conv2d(128 -> 32 -> 1)`
- **Conditioning & Computation**:
  ```python
  cond_spatial = tile_cond_proj(cond_emb).unsqueeze(-1).unsqueeze(-1)  # (B, 128, 1, 1)
  fused_spatial = F.silu(spatial_features + cond_spatial)               # (B, 128, 50, 50)
  tile_logits = tile_conv_head(fused_spatial).reshape(B, 2500)         # (B, 2500)
  ```
- **Spatial Alignment**: Preserves full 1-to-1 coordinate alignment across the 50×50 village grid.
- **Masking**:
  - For Troops, Heroes, and Siege: Strictly masked to `-1e8` on any tile where `no_deploy_mask[y][x] == true` (red zone around living buildings).
  - For Spells: Unrestricted across all 2500 tiles (spells can be dropped anywhere on the map).

### Head 5: `value` (1 Scalar Critic Estimate)
- **Module**: `critic_head: MLP(256 -> 128 -> 1)`
- **Input**: Fused tactical state `global_emb` (256 dimensions).
- **Semantics**: Outputs expected cumulative discounted future return `V(s) in R`, trained via clipped MSE against Generalized Advantage Estimation (GAE) targets.

---

## 📜 Architectural Decision Records (ADR Log)

### ADR-001: Separation of Rust Simulation Core and Python Deep RL Runtime
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: High-throughput combat simulation requires sub-millisecond execution, while deep reinforcement learning research relies on PyTorch and CUDA.
- **Decision**: Implement the deterministic combat loop, pathfinding, and combat mechanics in Rust (`crates/coc-engine`), compiled to WebAssembly via `wasm-pack` for web browsers and to a native CPython extension via `PyO3` / `maturin` for GPU training.
- **Consequences**: Zero simulation overhead in Python training loops; identical deterministic combat mechanics between web visualizer and RL rollout workers.

### ADR-002: Transition from 10-Channel Archetypes to 31-Channel Per-Defense Spatial Observation
- **Date**: 2026-10-25
- **Status**: Superseded by ADR-007 (Expanded to 50 channels: dedicated per-troop, per-hero, per-spell, per-enemy, and 21 defense channels)
- **Context**: In v2.0, defensive structures were compressed into scalar threat channels. The policy could not distinguish high-value primary targets (Monolith, Eagle/Revenge Tower, Scattershot) from standard defenses (Cannons, Archer Towers).
- **Decision**: Dedicate Channels 10..30 to individual TH18 defense types, encoding active defense modes and directional cone facing angles directly.
- **Consequences**: Convolutional stem layer acts as an exact spatial embedding lookup. Added only 12,096 parameters (0.89% increase) while boosting 3-star attack rate from 31% to 100% on reference layouts.

### ADR-003: 64-Dimensional Live Available Inventory Vector (`army_context`)
- **Date**: 2026-10-28
- **Status**: Accepted
- **Context**: The spatial grid only displays units currently on the map. Without inventory visibility, the policy attempted illegal deployments or failed to time hero ability triggers and spell follow-ups.
- **Decision**: Introduce a 64-D vector tracking global progress, troop/spell remaining counts, hero gear/ability readiness, and siege state, zeroing out depleted slots.
- **Consequences**: Completely eliminated invalid-action churn during RL exploration. Policy reliably executes multi-phase attacks (funnel -> breach -> hero charge -> cleanup).

### ADR-004: Autoregressive Conditioning for Factorized Action Space
- **Date**: 2026-10-28
- **Status**: Accepted
- **Context**: Independent action heads frequently chose contradictory outputs (e.g. selecting a spell slot index when the chosen action type was Hero).
- **Decision**: Autoregressively condition each subordinate head on preceding categorical choices (`slot_type` -> `slot_idx` -> `deploy_fraction` -> `tile_xy`).
- **Consequences**: Guaranteed semantic coherence across action heads; sharp reduction in invalid action masking interventions.

### ADR-005: Single-Army Specialist Training Paradigm
- **Date**: 2026-10-29
- **Status**: Accepted
- **Context**: Training a single policy across vastly different army archetypes (e.g. Ground Smash vs Air Hydra) caused catastrophic gradient interference and sub-optimal hybrid policies.
- **Decision**: Specialize policies per army recipe across all 5 reference TH18 villages, embedding loadout metadata in checkpoints for automatic testing alignment.
- **Consequences**: 100% 3-star convergence achieved on meta army loadouts with zero cross-archetype performance degradation.

### ADR-006: Obsidian Vault as Central Long-Term Memory and Source of Truth
- **Date**: 2026-10-30
- **Status**: Accepted
- **Context**: As the project grows, keeping documentation, tensor invariants, and decision history synchronized with code requires an explicit memory architecture.
- **Decision**: Designate `obsidian_vault/` as the single source of truth for architectural decisions and system invariants, enforced by `AGENTS.md` and automated via the `vault-updater` agent.
- **Consequences**: Permanent architectural memory across agent turns; seamless tracking of project evolution.

### ADR-007: 50-Channel Dedicated Composition, Heroes, Spells & Defenses Spatial Observation Tensor
- **Date**: 2026-10-30
- **Status**: Superseded by ADR-008 (Expanded to 59 channels: dedicated enemy heroes, Clan Castle, non-offensive storage/collector/utility channels, and 3-block dilated ResNet backbone)
- **Context**: The previous 31-channel observation space aggregated all allied ground and air troops into coarse density maps (Channels 5 & 6) and compressed tactical identity into a single 1D archetype signature $\phi(u)$ (Channel 8). Under single-army specialization (ADR-005), the agent benefits from non-overlapping, fine-grained spatial tracking of every individual troop type, hero, active spell, and defending enemy unit.
- **Decision**: Expand spatial observation tensor to $50 \times 50 \times 50$:
  1. **Friendly Troops, Siege & CC (Ch 5..16)**: Dedicated channel per loadout unit (Thrower, Healer, Furnace, Druid/Bear, Ice Golem, Super Wall Breaker, Headhunter, Balloon, Archer, Log Launcher, CC Super Yeti, CC Super Valkyrie), normalized by max initial army count on each tile.
  2. **Friendly Heroes (Ch 17..20)**: Dedicated channel per hero (King, Queen, Warden, Champion), strictly $1.0$ if present, $0.0$ otherwise.
  3. **Friendly Spells (Ch 21..24)**: Totem Spell (HP ratio $u.\text{hp} / u.\text{max\_hp}$), Rage, Poison, and Skeleton Spell continuous $1.0 \to 0.0$ fading values covering the full circular Area of Effect.
  4. **Enemy Defending Units (Ch 25..28)**: Dedicated channels for Enemy CC & Guardians, Enemy Heroes, Enemy Ground Skeletons, and Enemy Air Skeletons.
  5. **Dedicated Defenses (Ch 29..49)**: Shifted 21 per-defense channels preserving all mode and directional cone encodings.
- **Consequences**: Complete spatial clarity; eliminates multi-unit tile ambiguity; enables CNN spatial kernels to learn troop-specific micro-maneuvers and spell radius boundaries with zero archetype distortion.

### ADR-008: 59-Channel Spatial Tensor (Per-Hero Defending Channels, Clan Castle & Non-Offensive Building Groups) + 3-Block Dilated ResNet Backbone
- **Date**: 2026-10-30
- **Status**: Accepted
- **Context**:
  1. **Enemy Hero Blindness**: The 50-channel observation compressed all defending heroes into a single binary channel (`Ch 26`), preventing the policy from distinguishing a 13,000 HP Barbarian King melee tank from a 700 DPS ranged Archer Queen or long-range Grand Warden. This directly impaired Headhunter deployment, hero charge routing, and defensive poison spell timing.
  2. **Clan Castle Structure**: The Clan Castle (a key defensive fortification housing defending troops) lacked its own defense channel.
  3. **Non-Offensive Funnel Structures**: Storage tanks (high HP funnel buffers), collectors (low HP trash), and utility structures (camps, lab, spell factories) were only represented in the aggregate building HP channel `Ch 0`. Differentiating high-durability reservoirs from outer trash buildings is essential for funnel planning.
  4. **Bottlenecked CNN Topology**: Over 54% of network parameters were concentrated in a single dense layer `Linear(2048, 256)` in `global_tower`, while the spatial feature extractor had only 1 residual block with a narrow receptive field (~15×15 tiles) on a 50×50 battlefield.
- **Decision**:
  1. **Expand Spatial Observation Tensor to $59 \times 50 \times 50$**:
     - **Enemy Defending Units (`Ch 25..33`)**: Dedicated channels for Defending CC & Guardian (`Ch 25`), Defending Barbarian King (`Ch 26`), Defending Archer Queen (`Ch 27`), Defending Grand Warden (`Ch 28`), Defending Royal Champion (`Ch 29`), Defending Minion Prince (`Ch 30`), Defending Dragon Duke (`Ch 31`), Enemy Ground Skeletons (`Ch 32`), and Enemy Air Skeletons (`Ch 33`).
     - **Defenses & Clan Castle (`Ch 34..55`)**: 21 shifted defense types + `Ch 55: Clan Castle (1.0 while active)`.
     - **Non-Offensive Building Groups (`Ch 56..58`)**:
       - `Ch 56`: Storages & Reservoirs + Hero Hall (Gold/Elixir/Dark Elixir Storages + Hero Hall HP ratio $\text{HP}/\text{HP}_{\max} \in [0, 1]$).
       - `Ch 57`: Resource Collectors (Gold Mines, Elixir Collectors, Dark Elixir Drills HP ratio $\in [0, 1]$).
       - `Ch 58`: Utility & Other Buildings (Army Camps, Barracks, Laboratory, Spell Factories, Blacksmith, etc. HP ratio $\in [0, 1]$).
  2. **Deepen Spatial Backbone & Lean Global Tower**:
     - Replaced `AdaptiveAvgPool2d((4, 4)) + Linear(2048, 256)` with coordinate-invariant Global Average Pooling `AdaptiveAvgPool2d((1, 1)) + Linear(128, 256)`, eliminating 491,520 redundant dense parameters.
     - Reinvested parameters into a 3-block cascaded Dilated ResNet (`DilatedResBlock` with dilations $d=1, 2, 4$), tripling spatial receptive field from $15\times 15$ to $39\times 39$ across the 50×50 board while keeping total parameters at ~1.48M.
     - Conditioned spatial tile pointer `tile_cond_proj` on `[global_emb || type_onehot || idx_onehot]` (273-D) for slot-specific FiLM modulation.
     - Fixed legacy 10-channel allied unit slicing bug in `networks.py` to sum all living friendly units across `Ch 5..20`.
- **Consequences**: Exact identification of high-threat defending heroes; fine-grained funnel path prediction; base-wide receptive field allowing outer deployments to evaluate core defenses; verified >2,500 combat ticks/sec rollout throughput on NVIDIA RTX 4060 GPU.

### ADR-009: Rayon-Parallelized Vectorized Environment (`PyVecBattleEnv` / `CoCVecAttackerEnv`), Zero-Copy Byte Buffers & Batched BF16 GPU Rollouts
- **Date**: 2026-10-30
- **Status**: Accepted
- **Context**:
  1. **Single-Core CPU & `B=1` GPU Bottleneck**: Running one `CoCAttackerEnv` sequentially utilized only 1 of 12 hardware threads on the AMD Ryzen 5 7640HS and forced `B=1` GPU kernel launches with 7 CUDA-to-CPU `.item()` synchronization stalls per step.
  2. **Python/PyO3 Boxing & Tactical Mask Overhead**: Returning `Vec<f32>` (147,500 floats per step) via PyO3 boxed/unboxed millions of Python floats, and computing two-phase tactical action masks (morphological perimeter dilation + funnel corridor) twice per step in Python/NumPy consumed ~45% of step wall time.
  3. **Status Polling & Long-Run $O(N)$ Server Contention**: `GET /api/ai/status` (polled every 1s by the Web UI) was calling `load_attacker_model(DEVICE)` and `importlib.reload(networks)` on every request, fragmenting CUDA memory up to 7.4 GB and stealing the Python GIL during long (60,000-episode) runs.
- **Decision**:
  1. **In-Place Observation Extraction (`crates/coc-engine/src/sim.rs`)**: Added `write_spatial_observation(&self, obs: &mut [f32])` and `write_army_context(&self, ctx: &mut [f32])` to write directly into pre-allocated slices with zero per-step heap allocations.
  2. **Rust-Native Tactical Masking & `PyVecBattleEnv` (`crates/coc-py/src/lib.rs`, `python/coc_rl/envs.py`)**: Moved two-phase tactical action masking, perimeter ring pre-computation, funnel cohesion, and custom reward shaping into `TacticalEnvState` in Rust. Added `PyVecBattleEnv` (`CoCVecAttackerEnv`) using Rayon (`par_iter_mut()` inside `py.allow_threads`) to step and auto-fast-forward (`finish_battle()`) waves of 12 parallel environments across all CPU threads simultaneously, returning contiguous mutable `PyByteArray` buffers viewed zero-copy via `np.frombuffer`.
  3. **Batched (`B=12`) Rollouts & BF16 Tensor Core Acceleration (`python/coc_rl/networks.py`, `python/coc_rl/ppo.py`, `python/train_ai.py`)**: Enabled `torch.backends.cudnn.benchmark`, TF32 matmuls, and `torch.amp.autocast("cuda", dtype=torch.bfloat16)` on `CoCSpatialEncoder` (keeping `DilatedResBlock` normalized activations in `bfloat16` to avoid 500+ MB FP32 upcast overhead), eliminated per-step `.item()`/`probs` stalls, and vectorized `evaluate_model_matchups` across all 5 reference villages in parallel.
  4. **Zero-Allocation `/api/ai/status` Polling (`python/ai_server.py`)**: Cached architecture manifests and checkpoint metadata in memory so 1-second UI status polls never touch disk or allocate GPU tensors during training.
- **Consequences**: Pure RL environment rollout throughput jumped **24.7×** (from `5.3 eps/s` to `130.9 eps/s` on 12 Ryzen threads); full end-to-end GPU PPO rollout throughput reached **>10,400–11,800 combat ticks/sec** (~11× faster than before) while eliminating the 7.4 GB VRAM leak during long training runs.

### ADR-010: Incremental Git-Commit Drift Analysis & Synchronization State Tracking (`scripts/vault_diff.py` & `.sync_state.json`)
- **Date**: 2026-10-30
- **Status**: Accepted
- **Context**:
  1. **Full-Codebase Inspection Overhead**: The `vault-updater` long-term memory agent previously scanned full source files (`crates/coc-engine/src/sim.rs` with 6,500+ lines, `python/coc_rl/networks.py`, etc.) or unbounded `git diff` outputs on every invocation, consuming tens of thousands of tokens and taking several minutes per update.
  2. **Lack of Commit State Memory**: When working directory changes were committed across multiple discrete Git commits, the agent lacked persistent memory of the exact commit SHA to which the Obsidian vault was synchronized, risking drift or missed intermediate commits.
- **Decision**:
  1. **Persistent Vault Sync State (`obsidian_vault/.sync_state.json`)**: Introduce a canonical, Git-tracked sync state storing `last_synced_commit` (full 40-char SHA), `last_synced_commit_short` (7-char SHA), `last_synced_at` (ISO timestamp), `last_synced_subject`, and `branch`.
  2. **Visual & Machine-Readable Index Integration (`00_Index_MOC.md`)**: Automatically surface the latest synchronized commit in frontmatter metadata and an aesthetic callout banner at the top of the Master Map of Content.
  3. **High-Density Incremental Diff CLI (`scripts/vault_diff.py`)**: Built a zero-dependency CLI tool that computes the exact commit range `last_synced_commit..HEAD`, categorizes modified files by domain (Simulation Core, Deep RL, Web Sandbox, Tooling), flags modified high-impact symbols (`extract_spatial_observation`, `extract_army_context`, `CoCActorCritic`, `PyVecBattleEnv`, etc.), and extracts targeted unified diffs.
  4. **Optimized Agent Protocol**: Updated `vault-updater` instructions so that it exclusively inspects the targeted diffs from `scripts/vault_diff.py` rather than reading full source files, executes `.venv/bin/python python/generate_vault.py`, and records the new commit via `python3 scripts/vault_diff.py --mark-synced`.
- **Consequences**:
  - **Zero-Token No-Op Exits**: If no new commits or code changes occurred since the last sync, `scripts/vault_diff.py` exits immediately in <0.05 seconds with 0 tokens wasted.
  - **90%+ Reduction in Agent Context & Latency**: The agent only parses the exact modified lines (typically 20–200 lines) instead of full 6,500-line engine files.
  - **Deterministic Audit Trail**: Connects the Obsidian long-term memory ledger directly to the Git version control commit graph.

### ADR-011: Multi-Scale U-Net Contracting-Expansive Spatial Backbone with High-Resolution Skip Connections & Branched Global Tower
- **Date**: 2026-10-31
- **Status**: Accepted (Supersedes the 3-block Dilated ResNet from ADR-008)
- **Context**:
  1. The 3-block Dilated ResNet (`DilatedResBlock` with dilations $d=1, 2, 4$ on 50×50 features) preserved spatial resolution but suffered from two major architectural limitations:
     - **Fixed Receptive Field Ceiling**: Cascaded dilations expanded the receptive field to ~39×39 tiles, which was still short of full 50×50 board coverage without severe gridding artifacts (checkerboard receptive field holes).
     - **Spatial-Global Decoupling**: The global tower downsampled directly from the final dilated 50×50 tensor, discarding multi-scale hierarchical features learned across intermediate spatial contexts.
  2. For high-precision troop and spell placement on a 50×50 grid, the network needs both macro-scale base understanding (global village core, pathing funnels, defending hero locations) and pixel-perfect micro-scale positioning (1-tile gap openings in walls, exact defense range boundaries, trap proximity).
- **Decision**:
  1. Replace the Dilated ResNet backbone with a **Multi-Scale U-Net Contracting-Expansive Spatial Backbone (`UNetConvBlock` & `UNetUpBlock`)**:
     - **Stage 1 (Contracting / Downsampling Pathway)**:
       - `enc1`: `UNetConvBlock(59 -> 32)` at full $50 \times 50$ resolution.
       - `pool1`: `MaxPool2d(2, 2)` -> $25 \times 25$.
       - `enc2`: `UNetConvBlock(32 -> 64)` at $25 \times 25$ resolution.
       - `pool2`: `MaxPool2d(2, 2)` -> $12 \times 12$.
       - `enc3`: `UNetConvBlock(64 -> 128)` at $12 \times 12$ resolution.
       - `pool3`: `MaxPool2d(2, 2)` -> $6 \times 6$.
       - `bottleneck`: `UNetConvBlock(128 -> 256)` at $6 \times 6$ resolution (encompassing base-wide context).
     - **Stage 2 (Expansive / Upsampling Pathway)**:
       - `up3`: `UNetUpBlock(256 -> 128)` upsamples $6 \times 6 \to 12 \times 12$, concatenated with skip connection from `enc3` (128 channels) and processed via `UNetConvBlock(256 -> 128)`.
       - **Global Tower Branching**: Strategic choices (`slot_type`, `slot_idx`, `deploy_fraction`, and value critic) branch directly off the partially upscaled $12 \times 12$ feature map `d3` via `Conv2d(128, 128, stride=2, padding=1) -> GroupNorm(8) -> SiLU -> AdaptiveAvgPool2d((1, 1)) -> Linear(128, 256) -> LayerNorm -> SiLU`, fusing high-level abstract base representations without wasting parameters on 50×50 dense projections.
       - `up2`: `UNetUpBlock(128 -> 64)` upsamples $12 \times 12 \to 25 \times 25$, concatenated with skip connection from `enc2` (64 channels) and processed via `UNetConvBlock(128 -> 64)`.
       - `up1`: `UNetUpBlock(64 -> 32)` upsamples $25 \times 25 \to 50 \times 50$, concatenated with skip connection from `enc1` (32 channels) and processed via `UNetConvBlock(64 -> 32)`.
  2. **High-Resolution Spatial Tile Pointer Head**:
     - The spatial features `spatial_features` at $50 \times 50 \times 32$ retain exact 1-tile details via the `up1` skip connection.
     - FiLM conditioning: projects the conditioned categorical choices (`global_emb + type_onehot + idx_onehot`, 273-D) via `tile_cond_proj: Linear(273, 32)` and adds it channel-wise to `spatial_features`.
     - Logit generation: `Conv2d(32, 32, 3, padding=1) -> SiLU -> Conv2d(32, 1, 1)` producing fine-grained $(B, 2500)$ deployment distribution over the 50×50 battlefield.
  3. Total network parameter count: 2,480,440 weights (100% trainable).
- **Consequences**:
  - Receptive field encompasses the entire 50×50 grid through the $6 \times 6$ bottleneck.
  - Skip connections preserve pixel-level wall breaches and deployment halos, eliminating spatial blurring in tile selection.
  - Reconciled across production RL (`python/coc_rl/networks.py`), RL educational curriculum (`learning/rl_labs/reference_solution.py`, `student_lab.py`), and interactive web tools (`web/src/ai/NetworkBuilderPanel.tsx`).

### ADR-012: Specialist Model Visualizer Agent & Visual Architecture Invariant Policy
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**:
  - The neural architecture has grown in complexity (U-Net multi-scale contracting-expansive paths, dual-branch routing, factorized autoregressive heads, MAC/FLOP calculations, layer telemetry, and SVG/PNG computation graphs).
  - Manual maintenance of visual architecture artifacts (`docs/architecture/`, `python/coc_rl/visualize.py`, `python/visualize_model.py`, and Web AI Studio visualizers) led to drift between the running PyTorch model graph and visual documentation.
- **Decision**:
  - Register a dedicated, persistent specialist agent `model-visualizer` (`.agents/agents/model-visualizer/agent.md`, Gemini 3.8 Flash Medium) in the Antigravity agent catalog.
  - Enforce a strict architectural policy in `AGENTS.md`: all modifications, layer telemetry updates, receptive field calculations, and computation graph generation (`torchview` SVGs/PNGs and `docs/architecture/manifest.json`) are delegated exclusively to `model-visualizer`.
- **Consequences**:
  - Automated synchronization between PyTorch module definitions and visual graph artifacts.
  - Strict separation of concerns between training/simulation engineering, long-term memory governance (`vault-updater`), and visual architecture inspection (`model-visualizer`).

