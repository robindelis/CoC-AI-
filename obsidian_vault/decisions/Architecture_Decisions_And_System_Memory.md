---
title: "Project Long-Term Memory & Architectural Decision Records (ADRs)"
tags:
  - memory
  - source-of-truth
  - adr
  - architecture
  - coc-rl
  - tensor-spec
updated: 2026-11-04
---

# 🧠 CoC TH18 Deep RL — Project Long-Term Memory & Source of Truth

Back to [[00_Index_MOC|Vault Index (MOC)]] • Architecture: [[architectures/v3.0_59Ch_UNet_SingleArmy_ActorCritic|v3.0 Architecture Spec]] • Encodings: [[encodings/Defense_And_Unit_Spatial_Encoding|59-Channel Defense & Unit Encoding Spec]]

---

## 🏛️ Invariant: The Obsidian Vault as the Project's Long-Term Memory

The `obsidian_vault/` directory is the **authoritative single source of truth** for all architectural invariants, design decisions, mathematical tensor formulations, training configurations, and empirical benchmarks of this project.

1. **Evolution & Mutability**: As the simulation engine (`crates/coc-engine`), neural network architectures (`python/coc_rl/networks.py`), or training pipelines evolve, this vault must be continuously updated.
2. **Synchronized Agent**: A persisting specialist agent (`vault-updater`, running on `agy` with `gemini-3.8-flash-medium`) is registered to reconcile codebase modifications directly into this memory ledger.
3. **No Unrecorded Architectural Drift**: Any shift in tensor channels, normalization factors, action spaces, or environment logic must be explicitly captured in an Architectural Decision Record (ADR) below.

---

## 📥 Current Input Implementation

The deep reinforcement learning attacker policy receives two fused inputs at every decision step `t`:
1. A **59-Channel Dedicated Spatial Observation Tensor** `obs` with shape `(B, 59, 50, 50)` (see complete specification in [[encodings/Defense_And_Unit_Spatial_Encoding|59-Channel Defense & Unit Encoding Spec]])
2. A **64-Dimensional Live Available Inventory Vector** `army_context` with shape `(B, 64)`

```text
[Input 1: obs (59, 50, 50)]  ───> [CoCSpatialEncoder (U-Net)] ───> spatial_features (B, 32, 50, 50)
                                           │
                                           └───> global_emb (B, 256)
                                                     │
[Input 2: army_context (64)] ─────> [Linear+LN+SiLU] ───(+) (Residual Fusion)
                                                     │
                                          ┌──────────┴──────────┐
                                     [Factorized Actor Heads] [Critic Head]
```

### 1. 59-Channel Spatial Observation Grid (`(B, 59, 50, 50)`)

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
  - Reconciled across production RL (`python/coc_rl/networks.py`) and interactive web tools (`web/src/ai/NetworkBuilderPanel.tsx`).

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

### ADR-013: Autonomous 10-Minute Recursive AI Self-Improvement Loop, Dynamic Architectural Conditioning, Milestone Reward Shaping & Mandatory Pre-Change Baseline Snapshots
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**:
  1. **Long-Run Training Plateaus & Diagnostic Blindspots**: As PPO training extends past 9,000+ episodes, policies encounter subtle multi-modal bottlenecks: 2-star to 3-star conversion funnels stalling at back-end cleanup, high cross-village destruction variance (e.g. 17.1% gap between symmetrical layouts vs. Offset Diamond with Hot Candle), and critic baseline lag ($V(s_0)$ under-calibrating by >24 pts). Diagnosing these manually was slow, error-prone, and reactive.
  2. **Scientific Traceability & The "Pre-Change Baseline" Invariant**: In deep RL, hyperparameter or architecture tweaks often appear beneficial in short windows but introduce silent regressions on difficult layouts. Without recording the full baseline state (exact model weights, git commit, full reward formula, architecture config, conversion funnels, per-village spread) *immediately prior* to any modification, it was impossible to objectively measure progress or verify whether an intervention actually solved the targeted pathology.
  3. **Static Weights in Production Networks**: Architectural priors (such as the 15×15 Town Hall breach attraction field `th_threat_weight`, `breach_prior_weight`, `film_cond_scale`, and per-head entropy regularization weights) and reward parameters (such as `th_bonus`, `damage_weight`, `funnel_weight`, and high-percentage milestone bonuses) were previously hardcoded constants in `networks.py` and `ppo.py`, requiring code edits and server restarts to test hypotheses.
- **Decision**:
  1. **Autonomous 10-Minute Recursive Improvement Loop (`python/coc_rl/recursive_loop.py`, `python/ai_server.py`)**:
     - Background daemon running every 600 seconds (`interval_seconds=600`) that triggers automatic health evaluations (0–100 score).
     - Multi-provider LLM / hybrid diagnostic engine (Vertex AI Gemini 4 Argon, OpenCode Argon, or deterministic analytical fallbacks) identifying primary bottlenecks across four structured categories: `architecture`, `reward_function`, `hyperparameters`, and `combined`.
  2. **Mandatory Pre-Change Baseline Snapshots (`capture_pre_change_snapshot`)**:
     - Before applying any candidate solution, the system captures an immutable snapshot: cumulative episode, checkpoint path, git commit SHA, active architecture hyperparameters, active reward formula, PPO hyperparameters, 50-episode mean destruction %, star conversion funnel ($1\star \to P(2\star|1\star) \to P(3\star|2\star)$), critic calibration gap, and per-village destruction metrics.
  3. **Dynamic Architectural Conditioning (`DEFAULT_ARCH_CONFIG` in `python/coc_rl/networks.py`)**:
     - Parameterized `arch_config` passed into `CoCActorCritic`: dynamically tunes U-Net FiLM scale (`film_cond_scale`), Town Hall breach attraction (`th_threat_weight`, `breach_prior_weight`), spell combat prior (`spell_combat_prior_weight`), spatial tile scale (`tile_logit_scale`), and per-head categorical entropy weights (`reg_ent_type_weight`, `reg_ent_idx_weight`, `reg_ent_frac_weight`, `reg_ent_tile_weight`).
  4. **Configurable Dense & Milestone Reward Shaping (`DEFAULT_REWARD_CONFIG` in `python/coc_rl/ppo.py`)**:
     - Parameterized `reward_config` passed into `compute_custom_reward_components()`: supports progressive milestone bonuses (`high_pct_milestone_75`, `high_pct_milestone_90`, `triple_wipe_bonus`), custom destruction/star/TH weights, and generates explicit LaTeX/text math representations via `format_reward_formula()`.
  5. **Empirical Post-Verification & Vault Ledger (`verify_solution_outcome`, `sync_recursive_loop_to_vault`)**:
     - Evaluates post-change training runs (typically +24 to +50 episodes) against the pre-change baseline snapshot.
     - Categorizes outcomes into `SOLVED` (promoted as new baseline), `IMPROVED` (retained for continued consolidation), or `REGRESSED` (rolled back to baseline configuration).
     - Continuously generates and updates the long-term memory ledger in `obsidian_vault/experiments/Recursive_AI_Improvement_Loop.md`, complete with comparative synthesis matrix, exact parameter diffs, and before-vs-after delta tables.
  6. **Interactive AI Studio UI Panel (`web/src/ai/RecursiveLoopPanel.tsx`)**:
     - Full-featured monitoring dashboard in Web AI Studio for visualizing active cycle phases, triggering on-demand audits, manually selecting candidate solutions, and reviewing pre-change snapshots.
- **Consequences**:
  - Establishes a fully autonomous, scientifically verifiable self-improvement loop for TH18 combat AI.
  - Eliminates silent regressions through mandatory before-vs-after baseline comparison.
  - Ensures all self-improvement experiments, parameter mutations, and empirical results are permanently recorded in the Obsidian vault.

### ADR-014: Multi-Solution Simultaneous Application and OpenCode Argon 4 Medium Code-Editing Agent Integration with Pre-Change Backup and Automated Rollback Smoke-Testing
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**:
  1. **Compounding Pathologies Across Distinct Modules**: Self-improvement cycles in the Recursive AI Improvement Loop often identify systemic bottlenecks spanning multiple domains simultaneously (e.g. Town Hall breach attraction failing due to both under-weighted spatial prior logits and lack of milestone reward incentives). Applying candidate solutions in sequential isolation forced artificial evaluation delays, increased rollout cycle count, and obscured multi-parameter synergies.
  2. **Need for Surgical Code Modifications Beyond Runtime Config**: While runtime `DEFAULT_ARCH_CONFIG` and `DEFAULT_REWARD_CONFIG` patch dictionaries handle hyperparameter adjustments, structural hypotheses (such as modifying mathematical formulas, adjusting loss terms, refactoring layer activations, or altering spatial breach priors directly in source files) require direct modifications to `python/coc_rl/networks.py`, `python/coc_rl/ppo.py`, and `python/train_ai.py`.
  3. **Risk of Code Breakage and Silent Failures**: Modifying core deep RL code dynamically during autonomous or semi-autonomous cycles risks syntax errors, broken tensor shapes, CUDA runtime exceptions, and simulation desyncs if modifications are unverified.
- **Decision**:
  1. **Multi-Solution Simultaneous Application (`merge_selected_solutions` in `python/coc_rl/recursive_loop.py`)**:
     - Enables bundling $N \ge 1$ candidate solutions into a single composite execution unit with unified config patching, combined diff summaries, and joint rationale tracking.
     - Added multi-solution request payloads (`selected_solution_ids: Optional[List[str]]`) to `/api/ai/loop/apply-solution` and `/api/ai/loop/run-cycle` in `python/ai_server.py`, alongside interactive multi-checkbox selection in `web/src/ai/RecursiveLoopPanel.tsx`.
  2. **OpenCode Argon 4 Medium Code-Editing Agent Integration (`execute_opencode_argon_code_edit`)**:
     - Directly interfaces with the OpenCode CLI (`google-vertex/gemini-4-argon#medium`) inside the repository root (`/home/robin/Projects/CoC`) to perform targeted, surgical code edits on specified target files (`python/coc_rl/networks.py`, `python/coc_rl/ppo.py`, `python/train_ai.py`).
  3. **Pre-Change Backup & Digest Manifest (`backup_code_files_before_change`)**:
     - Prior to invoking the code agent, the system automatically captures exact file copies and short SHA-256 digests in `trained_models/code_backups/cycle_NNN/`, generating an immutable manifest.
  4. **Automated Smoke Testing & Instant Rollback (`_smoke_test_rl_modules`, `restore_code_files_from_backup`)**:
     - Following code edits, the runtime dynamically reloads `coc_rl.networks` and `coc_rl.ppo` and executes a live forward-pass smoke check with dummy 59×50×50 observation tensors and 64-D army contexts.
     - If syntax errors, shape mismatches, or exception asserts occur, the system automatically triggers `restore_code_files_from_backup()`, discarding faulty modifications, capturing error logs, and protecting training stability.
     - If successful, captures unified `git diff` for immediate inspection in the Web AI Studio UI and vault synchronization.
  5. **Empirical Consolidation in Cycle 008**:
     - Applied a multi-solution bundle combining architectural spatial prior tuning (`th_threat_weight: 7.8 -> 8.6`, `breach_prior_weight: 9.8 -> 10.6`, `film_cond_scale: 0.72 -> 0.8`) with reward bonus intensification (`th_bonus: 14.0 -> 20.0`), permanently hardening the updated defaults in `networks.py` and `ppo.py`.
- **Consequences**:
  - Enables holistic, multi-dimensional self-improvement across architecture, reward functions, and hyperparameters within a single cycle.
  - Empowers autonomous code-level enhancements via Google Vertex Gemini 4 Argon with zero risk to codebase stability thanks to cryptographic backups and automated smoke rollback.
  - Full transparency: all code diffs, backup manifests, and smoke-test verifications are indexed in the Obsidian Vault.

### ADR-015: Training-Gated Autonomous Daemon Lifecycle & Standby State Machine for Recursive AI Self-Improvement Loop
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**:
  1. **Spurious Inactive Daemon Firing & Premature Cycle Triggers**: Previously, when the 10-minute Recursive AI Self-Improvement Loop was enabled (`_loop_state["enabled"] = True`), the background daemon thread in `python/ai_server.py` decremented wall-clock time (`now_ts >= next_ts`) regardless of whether training rollouts were actually occurring or if the server was idling.
  2. **Zero-Experience Diagnostics & Rollout Waste**: When training was paused or stopped, wall-clock triggers caused the daemon to execute LLM/hybrid audits without new rollout experience, attempt post-change verifications against zero additional episodes, and display negative or confusing countdown timers in the Web UI.
- **Decision**:
  1. **Active-Training Gated Countdown (`remaining_training_seconds`)**:
     - Added persistent and in-memory tracker `remaining_training_seconds: float` (default `600s`).
     - The background daemon loop (`_daemon`) computes elapsed wall-clock slice $\Delta t$, but strictly gates subtraction on `_training_state.get("is_training", False)`.
     - When training is stopped or paused, $\Delta t$ deduction is bypassed entirely, freezing the remaining countdown at its exact active training duration.
  2. **Standby Lifecycle State Machine**:
     - Introduced `paused_waiting_for_training: bool` (`bool(enabled and not is_training and not is_running_cycle)`).
     - Dynamically surfaces effective phase `standby_waiting_for_training` in `/api/ai/loop/status` whenever the loop is armed but training is inactive.
  3. **Ergonomic Web AI Studio Synchronization**:
     - Updated tab badges in `web/src/ai/AIStudioView.tsx`: displays `⏸ STANDBY (Start Training)` with cyan styling when loop is armed while trainer is idle, switching to active live countdown only when training is running.
     - Updated button status in `web/src/ai/RecursiveLoopPanel.tsx`: labels state as `⏸ 10m Loop Armed (Paused — Start Training • mm:ss)`.
- **Consequences**:
  - Eliminates phantom self-improvement cycles and LLM API cost when training is halted.
  - Guarantees exactly 600 seconds of genuine PPO exploration and rollout transitions between recursive cycles.
  - Clear, intuitive developer status indicators across all Web AI Studio panels.

### ADR-016: Dual-Mode Self-Improvement Decision Paradigm (In-Place Optimization vs Stop & Restart with New Architecture) and 300-Episode Honest Evaluation Standard
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**:
  1. **Architectural vs Hyperparameter Discontinuity**: In previous cycles, all self-improvement recommendations were treated as continuous in-place mutations. While continuous fine-tuning is valid for reward coefficients, entropy regularizers, and spatial prior scalars, modifying network topology (e.g. inserting dilated residual blocks, changing layer depths, or adding channel attention) breaks weight checkpoint compatibility or induces catastrophic interference if forced onto partially-converged weights.
  2. **Short-Window Evaluation Noise**: Evaluating agent performance over small slices (e.g. 10 to 50 episodes) exhibited massive statistical variance. Because rollouts rotate across 5 distinct reference villages with varying layout difficulties, a 50-episode window provides only 10 samples per layout. Lucky or unlucky deployments caused false-positive confirmations or spurious rollbacks.
- **Decision**:
  1. **Dual-Mode Decision Separation (`stop_and_restart_new_arch` vs `apply_in_place_solution`)**:
     - The recursive loop explicitly categorizes proposed hypotheses into two distinct pathways:
       - **In-Place Optimization (`apply_in_place_solution`)**: Applied dynamically during active training for hyperparameter tweaks, reward scale adjustments, and runtime prior modulation via `apply_arch_config()`.
       - **Stop & Restart with New Architecture (`stop_and_restart_new_arch`)**: Triggered when a solution introduces structural modifications (`use_dilated_context`, `use_se_attention`, `use_gated_heads`, `critic_depth`, or custom layer dimensions).
     - Upon electing an architectural restart, the system cleanly halts current training, safely moves the active checkpoint to `trained_models/archives/`, resets the baseline episode to 0 (`baseline_episode = 0`), preserves `pre_restart_episode` for historic continuity, and spawns fresh PPO training with the new architecture config.
  2. **300-Episode Honest Evaluation Standard**:
     - Standardized the primary empirical verification window to 300 episodes (`test_episodes_per_cycle = 300`).
     - Added rolling 300-episode peak detection in `python/coc_rl/training_feedback.py`: computes `rolling300_peak_pct`, `rolling300_peak_at_episode`, `episodes_since_rolling300_peak`, `current_rolling300_pct`, and `drawdown_from_rolling300_peak_pct`.
     - In `python/train_ai.py`, `compute_matchup_stats()` calculates recent destruction averages and triple conversion rates strictly across the last 300 episodes (`recent_hist_300`), guaranteeing statistically significant sample sizes across all 5 village layouts.
     - PPO logging tracks running 300-episode destruction averages (`avg_pct_300`) alongside short-term indicators.
- **Consequences**:
  - Provides a clean, principled mechanism for the autonomous AI loop to explore structural architectural evolutions without corrupting existing weights.
  - Eliminates noise-induced false positives by grounding all empirical verifications in a statistically robust 300-episode evaluation window.
  - Maintains full provenance: archived weights, pre-restart episode counters, and historic baseline metrics are preserved in perpetuity.

### ADR-017: Modular Trained Models Directory Hierarchy, Checkpoint Pruning, and Dynamic Multi-Scale Architecture Extensions
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**:
  1. **Unstructured File Sprawl in `trained_models/`**: As training sessions, backups, diagnostic JSONs, model evaluations, and checkpoint files accumulated, the root `trained_models/` directory grew cluttered with hundreds of mixed files, complicating backups, inspection, and disk management.
  2. **Disk Exhaustion from Intermediate Checkpoints**: Saving checkpoints every $N$ episodes generated redundant intermediate `.pt` files that remained on disk long after being superseded by newer checkpoints.
  3. **Demand for Enhanced Spatial Receptive Fields & Attention**: Complex Town Hall 18 base layouts feature multi-compartment wall rings and high-density defensive pockets. The baseline U-Net needed optional mechanisms for broader dilated receptive fields without gridding artifacts and dynamic channel reweighting across the 59 spatial channels.
- **Decision**:
  1. **Modular Directory Structure (`ensure_trained_models_dir`)**:
     - Partitioned `trained_models/` into dedicated functional subdirectories:
       - `trained_models/checkpoints/`: Active training checkpoints (`latest_attacker.pt`, `<army_slug>_epXXXXX.pt`).
       - `trained_models/archives/`: Archived models from completed runs or superseded architectures.
       - `trained_models/presets/`: Custom army configurations (`custom_armies.json`).
       - `trained_models/state/`: Runtime status files (`last_training_state.json`, `run_registry.json`, `model_evals.json`).
       - `trained_models/loop/`: Self-improvement state (`recursive_improvement_loop.json`, `active_experiment_config.json`).
       - `trained_models/feedback/`: Telemetry & LLM feedback logs (`last_ai_feedback.json`, `last_ai_feedback_opencode_argon.json`).
       - `trained_models/code_backups/`: Pre-change cryptographic file backups (`cycle_NNN/`).
  2. **Automated Superseded Checkpoint Pruning**:
     - During PPO checkpoint saving in `python/train_ai.py`, stale intermediate checkpoints matching the current army slug and run are automatically purged from `trained_models/checkpoints/`, keeping storage footprints minimal while retaining final exports and archives.
  3. **Dynamic Architecture Extensions in `python/coc_rl/networks.py`**:
     - **Multi-Scale Dilated Residual Context (`DilatedResBlock`)**: Optional block inserted at `enc2` ($25 \times 25$ resolution) with dual convolutions ($3 \times 3$, dilation=2 and dilation=4, GroupNorm=8, SiLU) via `use_dilated_context=True`, expanding spatial receptive field across outer wall rings without downsampling.
     - **Squeeze-and-Excitation Channel Attention (`SEChannelAttention`)**: Optional channel attention modules inserted at the bottleneck ($6 \times 6$, 256 channels) and spatial output ($50 \times 50$, 32 channels) via `use_se_attention=True`, dynamically recalibrating the importance of specific defense and unit channels based on global layout context.
     - **Spatial Head Gating (`head_gate`)**: Optional Sigmoid gating layer on conditioned spatial embeddings (`tile_cond_proj`) via `use_gated_heads=True`.
     - **Deep Critic Variant**: Optional 3-layer MLP critic with `LayerNorm` and dual hidden projections when `critic_depth >= 3`.
     - **Milestone & Pacing Rewards in `ppo.py`**: Integrated dense rewards for 75% (`high_pct_milestone_75=2.0`), 90% (`high_pct_milestone_90=4.0`), triple wipes (`triple_wipe_bonus=6.0`), and pacing waits (`pacing_wait_bonus=0.02`).
  4. **Dynamic Layer Telemetry & Visualization**:
     - Reconciled `python/coc_rl/visualize.py` (`extract_live_layer_specs`) to dynamically calculate exact parameter counts, MACs, and receptive fields whether dilated blocks, SE attention, or deep critics are active or disabled.
- **Consequences**:
  - Clean separation of concerns across filesystem storage, eliminating clutter and preventing storage leaks.
  - Flexible neural architecture supporting both lightweight baseline configurations and advanced dilated attention variants.
  - Live visualizer and architecture manifests stay mathematically accurate across all configuration states.

### ADR-018: Bottom-Up Evolutionary Vision Architecture Pipeline (`Gen 0` ~50K TinyCNN Baseline, 5,000-Episode Horizons, AGY CoC Strategy Researcher & OpenCode Argon 4 Model Evolver)
- **Date**: 2026-11-01
- **Status**: Accepted
- **Context**:
  1. **Over-Parameterized Static Baseline**: Starting training directly with a 2.48M-parameter 4-stage U-Net slowed per-episode rollout/update throughput and obscured which spatial inductive biases and tactical representations were actually responsible for solving specific TH18 combat phases (perimeter funneling, core breach, hero charge timing, back-end Royal Champion cleanup).
  2. **Need for Domain-Grounded SOTA Vision & Strategy Co-Evolution**: Evolving a spatial RL policy requires combining modern computer vision operators (`ConvNeXt V2` $7\times 7$ depthwise + `GRN`, `SegNeXt` strip attention `MSCA`, `UniRepLKNet` dilated kernels, `Attention U-Net`, `HRNet`, `Swin V2`, `Vision Mamba`) with classical Clash of Clans strategic concepts (Rule-of-3 funnel cutting, Hero Charges, Warden Walk Fireball, Log Launcher line-of-sight rays, and multi-phase pacing).
- **Decision**:
  1. **SOTA Vision Catalog & CoC Strategy Dossiers in Obsidian Vault**:
     - Established `obsidian_vault/architectures/SOTA_Vision_And_Spatial_RL_Architectures.md` cataloging 11 SOTA vision and spatial-RL families and a progressive morphing ladder (`Gen 0` through `Gen 5`).
     - Established `obsidian_vault/decisions/CoC_Strategy_Concepts_And_Input_Output_Design.md` documenting classical TH18 strategy concepts and in-network GPU tactical feature synthesis (CoordConv + TH18 radial polar vectors, exterior trash vs. core funnel density, Log Launcher line-of-sight corridor, frontline combat intersection mask, and attack phase embeddings).
     - Established `obsidian_vault/architectures/Model_Architecture_Evolution_Ledger.md` to record every morphed generation, exact diff, weight transfer mode, and 5,000-episode empirical benchmark.
  2. **Stage 0 Bare-Minimum Model (`v4.0-Gen0-TinyCNN`, ~50K Parameters)**:
     - Refactored `python/coc_rl/networks.py` so `Gen 0` starts as an ultra-fast **2-layer strided CNN + $1\times 1$ spatial tile projection head** (`base_ch=20, spatial_dim=20, embed_dim=64, head_hidden_dim=48`, ~49.8K parameters—a 98% parameter reduction vs. the 2.48M U-Net), alongside a modular SOTA building-block library (`CoordPolarFeatureSynthesizer`, `ConvNeXtV2Block`, `SegNeXtMSCABlock`, `SEChannelAttention`, `DilatedResBlock`, `UNetConvBlock`, `UNetUpBlock`) and `transfer_compatible_weights()` for shape-aware partial weight transfer (`warm_start` vs. `scratch_restart`).
  3. **5,000-Episode Evolutionary Evaluation Horizon & Dual-Agent Collaboration**:
     - Set default evolutionary evaluation horizon to `test_episodes_per_cycle = 5000` episodes.
     - Registered `.agents/agents/coc-strategy-researcher/agent.md` (`agy` • `gemini-3.8-flash-medium`) to research CoC tactical mechanics from forums, videos, and behavior specs and update the vault strategy dossier.
     - Registered `.agents/agents/opencode-model-evolver/agent.md` (`opencode` • `google-vertex/gemini-4-argon#medium`) to freely morph `python/coc_rl/networks.py` step-by-step when a 5,000-episode horizon plateaus, choosing between `warm_start` weight transfer and `scratch_restart` and logging the evolution in Obsidian.
- **Consequences**:
  - ~5×–8× faster initial training iteration on the ~50K-parameter `Gen 0` baseline.
  - Every architectural upgrade is empirically justified by 5,000-episode combat telemetry and permanently traced in the Obsidian Vault.

### ADR-019: Safe GroupNorm Channel Factorization, Spatial Tile Conditioning via Discrete Fraction One-Hot & Prior Weighting, and Auto-Triggered Architecture Visualization
- **Date**: 2026-11-02
- **Status**: Accepted
- **Context**:
  1. **Dynamic Channel Factorization Fragility in GroupNorm**: As model evolution allows variable channel dimensions (`base_ch`, `spatial_dim`, `embed_dim`), hardcoded group counts (`groups=8` or `groups=4`) fail whenever channel dimensions are not cleanly divisible by the group count, causing PyTorch runtime crashes during instantiation or forward passes.
  2. **Tile Pointer Blindness to Deployment Batch Size**: Previously, the spatial tile head ($50\times 50 = 2500$ logits) was conditioned on `global_emb + one_hot(type)`. However, an attacker's deployment location is heavily dependent on batch fraction: single-unit surgical scouting ($0.0$, one unit) belongs on exterior peripheral trash buildings to establish a funnel, whereas massive troop dumps ($1.0$, full reserve) or siege machines require direct breach trajectories toward high-threat compartments.
  3. **Town Hall 18 Core Takedown vs Peripheral Cleanup Pacing**: After destroying Town Hall 18, agents frequently suffered from pathing stagnation in the empty center. Combat policies needed an explicit post-TH cleanup incentive targeting remaining perimeter defenses and resource storages.
  4. **Visualizer Desynchronization During Dynamic Evolution**: With model evolution and parameter tuning occurring autonomously, static documentation graphs and the UI's `NetworkBuilderPanel` could desynchronize from active model configurations if not refreshed automatically.
- **Decision**:
  1. **Safe GroupNorm Divisor (`_safe_group_count`)**:
     - Implemented `_safe_group_count(channels: int, max_groups: int = 8) -> int` across all neural blocks (`ConvNeXtV2Block`, `UNetConvBlock`, `TinySingleConvBlock`, `TinySkipUpBlock`, `UNetUpBlock`, `DilatedResBlock`).
     - Dynamically selects the largest divisor of `channels` $\le \text{max\_groups}$ (falling back to 1 if prime), preventing runtime exceptions across arbitrary morphed layer widths.
  2. **Fraction-Conditioned Spatial Pointer & Dual Priors**:
     - Expanded spatial tile conditioning to incorporate `frac_onehot` (5-dimensional one-hot representation of chosen batch fraction bin).
     - Augmented the tile logit threat field with two dynamic priors:
       $$\text{cleanup\_focus} = (1.0 - \text{TH}_{\text{alive\_ratio}}) \cdot 2.5 \cdot \text{obs}_{0}$$
       $$\text{surgical\_funnel} = \text{frac\_onehot}_{0} \cdot \left(\sum_{c=56}^{58} \text{obs}_{c}\right)$$
       $$\text{threat\_field} = 0.6 \cdot \text{obs}_{0} + \text{cleanup\_focus} + 0.8 \cdot \text{surgical\_funnel} + w_{\text{def}} \cdot \text{obs}_{1} + w_{\text{th}} \cdot \text{obs}_{2}$$
  3. **Transition to Generation 1 (`v4.1-Gen1-CoordSE-ResCNN`)**:
     - Upgraded default active architecture to `Gen 1`: `base_ch=24`, `spatial_dim=24`, `embed_dim=96`, `head_hidden_dim=64`, `use_coord_features=True` (`TacticalFeatureSynthesizer` 6-channel polar/LoS injection), `use_se_attention=True` (`SEChannelAttention`), and `weight_transfer_mode="warm_start"` (`130,268` parameters).
     - Adjusted PPO rewards: `funnel_weight=0.10`, `high_pct_milestone_75=2.5`, `high_pct_milestone_90=5.0`, `triple_wipe_bonus=8.0`, `pacing_wait_bonus=0.03`.
  4. **Mandatory Visualizer Auto-Trigger**:
     - Added `trigger_model_visualizer_agent()` in `python/coc_rl/recursive_loop.py` and `python/ai_server.py`.
     - Whenever model architecture or `arch_config` is updated, the specialized `model-visualizer` agent is invoked automatically in the background to ensure `docs/architecture/` graphs and UI specs reflect the live model.
- **Consequences**:
  - Robust GroupNorm operation across arbitrary model architectures and channel configurations.
  - Substantially sharper surgical funneling on exterior structures and rapid post-TH core clearing.
  - Real-time synchronization between active model checkpoints, `NetworkBuilderPanel`, and architecture diagrams.


### ADR-020: Argon 4 Diagnostics-Driven 2-Stage Neural Architecture Analysis & Targeted SOTA Synthesis, Dynamic Active Config Visualization, and Decoupled Dual Spatial Pointers
- **Date**: 2026-11-02
- **Status**: Accepted
- **Context**:
  1. **Limitations of Rigid Sequential Gen 0..5 Climbing**: The initial bottom-up roadmap assumed a linear progression (`Gen 0 -> Gen 1 -> Gen 2 -> Gen 3 -> Gen 4 -> Gen 5`). In practice, empirical 300-episode combat telemetry reveals highly distinct failure modes: asymmetric wall compartment failures (e.g., Offset Diamond layouts) require anisotropic strip attention (`SegNeXt MSCA`), whereas sparse defense attrition requires broad receptive field depthwise kernels (`ConvNeXt V2 GRN`), and perimeter funnel vs. interior spell conflicts require decoupled spatial pointer branches. Forcing a rigid sequential order delayed or bypassed the exact inductive bias needed to resolve the observed bottleneck.
  2. **Premature Architecture Morphing**: When training is progressing well or simply experiencing minor policy entropy dips or pacing misalignments, triggering a structural model morph wastes sample efficiency and resets optimizer state. Architecture evolution must be gated by an honest diagnostic assessment.
  3. **Visualizer Desynchronization from Active Config**: Static default configs in `networks.py` did not always reflect the dynamically tuned `active_experiment_config.json` used by the active training daemon, leading to UI/manifest discrepancies during live experiments.
  4. **Perimeter Troop vs Interior Spell Placement Spatial Head Contention**: Troops and heroes must deploy strictly on the perimeter green zone (`Ch 4 == 0`), whereas spells must target high-density interior combat clusters. Sharing a single $1\times 1$ spatial head forced compromise between perimeter entry scoring and interior spell concentration.
- **Decision**:
  1. **Argon 4 Diagnostics-Driven 2-Stage Evolutionary Vision System**:
     - Replaced the rigid sequential ladder with a 2-stage analysis and synthesis protocol in `python/coc_rl/recursive_loop.py` and `.agents/agents/opencode-model-evolver/agent.md`:
       - **Stage 1 (Diagnostic Assessment)**: OpenCode Argon 4 (`google-vertex/gemini-4-argon#medium`) audits rolling 300-episode combat telemetry (inter-village spread $\Delta \text{destr}$, $1\star \to 2\star \text{ TH18} \to 3\star$ funnel, near-miss rates $85\%-99\%$, spatial spread standard deviation, entropy saturation, worst-village performance). Explicitly outputs `architecture_evolution_required = true/false` and an empirical rationale. If false, training optimizes in-place without model modification.
       - **Stage 2 (Targeted SOTA Vision Synthesis)**: When evolution is required, Argon 4 synthesizes the specific vision and spatial-RL module matching the diagnosed combat pathology:
         - *Asymmetric Compartments & Cross-Village Wall Breaching* (`inter_village_gap_pct >= 9.0%` or worst village < 64%): Synthesizes `SegNeXtMSCABlock` (anisotropic $1\times 7+7\times 1$ and $1\times 11+11\times 1$ strip convolutions) and `DilatedResBlock` ($d=2, 4$) to capture linear wall corridors and Log Launcher breach lines.
         - *Sparse 59-Channel Defense Attrition & Core Stalling* (mean destruction < 60% or TH18 rate < 35%): Synthesizes `ConvNeXtV2Block` ($7\times 7$ depthwise convolutions with Global Response Normalization `GRN`) and `SEChannelAttention` to cover 7–11 tile defense range rings.
         - *Perimeter Funnel vs Interior Spell Conflict* (spatial spread std < 3.2 tiles or near-miss rate $\ge 15\%$): Synthesizes Decoupled Dual Spatial Pointers (`use_dual_spatial_head=True`) + Sigmoid Head Gating (`use_gated_heads=True`).
         - *Perimeter Trash Drift / TH18 Blindness* (TH rate < 40%): Synthesizes `TacticalFeatureSynthesizer` (`use_coord_features=True`: 6 explicit spatial strategy planes) + `SEChannelAttention`.
         - *Late-Battle $2\star \to 3\star$ Cleanup Stagnation & Value Lag* (triple rate < 12%): Synthesizes full 4-stage contracting-expansive U-Net decoder (`use_unet_decoder=True`) and 3-layer LayerNorm Critic (`critic_depth=3`).
  2. **Decoupled Dual-Branch Spatial Pointer Head**:
     - Introduced support for `use_dual_spatial_head=True` in `CoCActorCritic`, splitting spatial tile prediction into `spatial_troop_head` (perimeter breach scoring) and `spatial_spell_head` (interior cluster targeting), conditioned autoregressively on `is_spell`.
  3. **Active Config Loading & Dynamic Layer Spec Visualization**:
     - Updated `python/coc_rl/visualize.py`: implemented `load_active_arch_config()` reading `trained_models/loop/active_experiment_config.json` and hashing into `compute_networks_hash()`.
     - Reconciled `extract_live_layer_specs()` to dynamically calculate exact shapes, parameter counts, MACs, and receptive fields across both 2-stage CNN backbones (`tiny_cnn`, `convnext_v2`, `segnext_msca`) and 4-stage U-Net backbones (`full_sota_unet`).
  4. **Web UI Reconciliation**:
     - Updated `RecursiveLoopPanel.tsx`, `NetworkBuilderPanel.tsx`, and `AIStudioView.tsx` to display 2-stage diagnostic verdicts, targeted failure modes, weight transfer labels, and dynamic layer inspection cards.
- **Consequences**:
  - Eliminates unnecessary and disruptive architectural churn; model modifications occur only when structurally bottlenecked.
  - SOTA vision modules are chosen based on empirical combat evidence rather than arbitrary sequence.
  - Accurate, real-time visualization and parameter accounting in the Web UI directly synchronized with active running configurations.

### ADR-021: Subprocess Process-Group Lifecycle Management, Fast-Interrupt PPO Rollout Halting, Gen 1 CoordSE Architecture Baseline Promotion, and Static Type Hardening
- **Date**: 2026-11-02
- **Status**: Accepted
- **Context**:
  1. **Subprocess Leakage & Zombie Background Daemons**: During rapid stopping or restarting of the recursive training loop or automated agent invocations (`opencode`, `agy`), child processes spawned by Python were not assigned distinct process groups (`start_new_session=True`). Consequently, standard termination only signaled the immediate parent shell, leaving orphaned child processes consuming CPU/GPU cycles.
  2. **Sluggish Training Stop Latency**: In `train_pytorch_ppo`, the training loop only checked `stop_requested` at the end of full rollout batches (which can span 1,800 ticks across parallel vectorized environments). If a user requested stop or restart mid-rollout, the engine blocked for several seconds until all parallel workers completed.
  3. **Stale Recursive Cycle State on Fresh Starts**: Starting a fresh training run (`is_scratch=True`) previously carried over stale diagnostic hypotheses, cycles, and evaluation episode counters from prior runs, leading to premature cycle evaluation triggers.
  4. **Gen 1 CoordSE Baseline Promotion**: Having successfully validated the `v4.1-Gen1-CoordSE-ResCNN` architecture (~130K params with CoordConv strategy planes and Squeeze-and-Excitation channel attention), default baseline configuration in `networks.py` needed formal promotion to `GEN1_COORDSE_ARCH_CONFIG`.
  5. **Static Typing & Cross-Language Rust Idioms**: Lack of strict type stubs for `coc_py` and clippy patterns in Rust simulation crates allowed minor typing and idiom discrepancies to accumulate.
- **Decision**:
  1. **Process-Group Isolation & Centralized Subprocess Manager**:
     - Introduced `run_managed_subprocess()` and `terminate_all_active_subprocesses()` in `python/coc_rl/training_feedback.py`.
     - All external CLI calls (`opencode`, `agy`) execute with `start_new_session=True`, tracked in a thread-safe registry `_active_subprocs`.
     - Full process groups are terminated via `os.killpg(os.getpgid(p.pid), signal.SIGTERM)` with graceful timeout followed by `SIGKILL` fallback.
  2. **Inter-Step Early Exit Callback in PPO Rollouts**:
     - Added `should_stop_callback` parameter to `train_pytorch_ppo()`.
     - Evaluated inside the per-step vectorized environment step loop (`for step_i in range(max_steps_per_ep)`), enabling sub-millisecond halting when stop/restart is requested.
  3. **Clean Reset of Recursive Loop State on Scratch Training**:
     - In `python/ai_server.py`, `start_ppo_training()` now explicitly terminates all active subprocesses and purges `cycles`, `current_cycle_id`, `active_hypothesis`, and resets target episode windows when `is_scratch and not preserve_loop`.
     - When resuming, correctly initializes cumulative episode counters from checkpoint metadata.
     - Made training completion Obsidian vault sync asynchronous (`async_vault_sync=True`) so API calls return without blocking on markdown/canvas generation.
  4. **Promotion of `GEN1_COORDSE_ARCH_CONFIG` as Default Architecture**:
     - Set `DEFAULT_ARCH_CONFIG = dict(GEN1_COORDSE_ARCH_CONFIG)` (`v4.1-Gen1-CoordSE-ResCNN`, 130,268 parameters) with CoordConv, Squeeze-and-Excitation, and calibrated logit scales (`tile_logit_scale=2.8`, `th_threat_weight=9.5`, `breach_prior_weight=11.5`).
     - Added automatic disk-fallback to `trained_models/loop/active_experiment_config.json` inside `CoCActorCritic.__init__()` when `arch_config is None`.
  5. **Static Type Hardening & Rust Clippy Refactoring**:
     - Configured `pyrightconfig.json` and added PyO3 type stub `typings/coc_py.pyi`.
     - Modernized Rust codebase idioms: converted `.map_or(true, ...)` to `.is_none_or(...)`, `.clamp(...)`, and pattern matching in `crates/coc-engine`, `coc-data`, and `coc-py`.
     - Registered polyglot static analysis maintenance agent `codebase-maintainer` (`.agents/agents/codebase-maintainer/agent.md`).
- **Consequences**:
  - Immediate, responsive stop and restart controls in AI Studio with zero zombie child processes.
  - Deterministic cycle isolation preventing state bleeding between training runs.
  - Production RL policies initialize by default with spatial coordinate features and SE channel attention.
  - Clean typing throughout Python runtime and modern idiom compliance across Rust simulation engine.

### ADR-022: Computer Vision Replay Extraction Pipeline (`coc_cv`) for Pro Trajectory Demonstration & Imitation Learning
- **Date**: 2026-11-04
- **Status**: Accepted
- **Context**:
  1. Reinforcement learning from scratch on high-dimensional Town Hall 18 combat faces severe sample complexity before discovering foundational pro heuristics (surgical perimeter funneling, Warden Walk timing, breach-axis wall opening, late Royal Champion cleanup).
  2. While simulation rollouts execute at high throughput, bootstrapping policies with expert human demonstrations via Behavior Cloning (BC) and Offline RL drastically accelerates policy convergence.
  3. However, Clash of Clans game clients do not export raw action event streams—expert tournament and pro gameplay is available predominantly as MP4 video recordings and replay screen captures.
- **Decision**:
  - Implement a dedicated end-to-end Computer Vision replay extraction pipeline in `python/coc_cv/`:
    1. **`video_fetcher.py`**: Automated acquisition, frame demuxing, and chunk extraction from video files (`samples/pro_attack.mp4`) and online video sources.
    2. **`hud_detector.py` & `font_matcher.py`**: Precise detection of combat HUD telemetry across frames—tracking destruction percentage, star acquisition milestones, and the remaining 3-minute battle clock via normalized template and font matching.
    3. **`dock_tracker.py`**: Real-time tracking of the bottom unit deployment tray/dock, detecting troop/hero/spell slot selection highlights, remaining unit count drops, and hero ability activation states.
    4. **`drop_locator.py`**: High-contrast frame-differencing, particle burst analysis, and spawn animation tracking to pin down the exact screen coordinates $(x_{\text{screen}}, y_{\text{screen}})$ and timestamp `tick` of each unit deployment event.
    5. **`isometric_mapper.py`**: Homographic perspective transformation mapping 2D screen coordinates into canonical 50×50 game board coordinates $(x, y) \in [0, 50]^2$ with boundary clamping and red-zone collision verification.
    6. **`replay_builder.py`**: Synthesizes raw extracted detections into standardized JSON demonstration datasets (`datasets/replays/pro_attack_01.json`), perfectly matching the 5-head factorized RL action schema (`slot_type`, `slot_idx`, `deploy_fraction`, `tile_xy`, `tick`).
    7. **Test suite**: `python/tests/test_coc_cv.py` validating end-to-end video extraction, dock identification, and coordinate warping.
- **Consequences**:
  - Unlocks automated mining of YouTube pro TH18 tournament attacks into structured offline RL / Imitation Learning trajectory datasets.
  - Generates exact $(s_t, a_t)$ action pairs aligned with `CoCActorCritic` discrete action heads, paving the way for offline pre-training and hybrid BC-PPO fine-tuning.

### ADR-023: Generation 2 Architecture Promotion (`v4-SegNeXt-MSCA-CompartmentNet`), Anisotropic Multi-Scale Strip Convolutions, and Gated Actor Heads
- **Date**: 2026-11-04
- **Status**: Accepted
- **Context**:
  1. In Cycle #3 evaluation of `v4.1-Gen1-CoordSE-ResCNN` (130,268 params), the agent achieved strong overall performance (mean destruction 89.68%, 2★ TH18 97.7%, 3★ 53.0%), but exhibited a persistent 13.0% cross-village performance gap on complex layouts—specifically `Offset Diamond (Hot Candle)` (83.5% vs 96.5% on `Anti-Hydra Air Ring`).
  2. Analysis revealed that standard square 3×3 convolutions diluted long-range orthogonal wall compartments, causing attacking units to get siphoned along diagonal perimeter donut rings while the isolated Hot Candle melted core attackers through intact walls.
  3. Tactical I/O research and Argon 4 model evolution indicated the need for anisotropic strip convolutions and dilated context to trace axis-aligned wall corridors and deep compartment breaches.
- **Decision**:
  - Promote Generation 2 architecture `v4-SegNeXt-MSCA-CompartmentNet` (254,882 parameters, `backbone_type="segnext_msca"`) as the new `DEFAULT_ARCH_CONFIG` in `python/coc_rl/networks.py`.
  - Architecture specifications:
    - **Backbone**: Multi-Scale Convolutional Attention (`use_segnext_msca=True`) featuring paired anisotropic strip convolutions ($1\times 7 + 7\times 1$ and $1\times 11 + 11\times 1$) with lightweight depthwise kernel decomposition, capturing elongated orthogonal wall corridors and Log Launcher breach lines without prohibitive parameter cost.
    - **Dilated Spatial Context**: (`use_dilated_context=True`, dilation rates $d \in \{2, 4\}$) covering the 7.0t–10.5t defensive danger radius of Hot Candle and Monolith.
    - **Channel Capacity Expansion**: `base_ch: 28` (up from 24), `spatial_dim: 28` (up from 24), `embed_dim: 128` (up from 96), `head_hidden_dim: 96` (up from 64).
    - **Gated Actor Heads**: (`use_gated_heads=True`): Gated linear projection units filtering out noise before discrete categorical action projections.
    - **Calibrated Priors & Regularization**: `tile_logit_scale: 2.8`, `th_threat_weight: 9.5`, `breach_prior_weight: 11.5`, `spell_combat_prior_weight: 10.1`, `film_cond_scale: 0.85`.
    - **Weight Transfer**: Initialized via `warm_start` projection from Gen 1 weights.
- **Consequences**:
  - Provides the neural policy with inductive bias for axis-aligned wall corridors and deep compartment breaches.
  - Expands spatial embedding capacity to 128 channels, maintaining fine-grained distinction between perimeter deployment and core spell target zones.
  - Parameter footprint remains compact at 254K parameters, preserving sub-millisecond PyTorch GPU inference throughput.

### ADR-024: Interactive Split-Pane CV Replay Extractor Studio & Dual-Stream WASM-Video Synchronized Verification
- **Date**: 2026-11-04
- **Status**: Accepted
- **Context**:
  1. **Trajectory Verification Bottleneck**: Automated CV extraction from tournament videos (ADR-022) produces trajectory demonstration datasets (`datasets/replays/*.json`), but computer vision detection is prone to occlusion, particle bursts, camera drift, and perspective distortion.
  2. **Ground Truth Validation**: Before using extracted demonstrations for offline reinforcement learning (Behavior Cloning / Offline RL pre-training), human experts and reinforcement learning engineers must visually inspect detected actions against the raw gameplay video alongside the deterministic game engine simulation.
  3. **Lack of Integrated Inspection Tooling**: Debugging isometric perspective warping discrepancies, active dock slot highlights, and action timestamp offsets previously required offline terminal logs and separate manual playback.
- **Decision**:
  1. **Interactive Split-Pane CV Replay Extractor Studio (`web/src/ai/CVReplayStudioView.tsx`)**:
     - **Left Pane (Video & CV Detections)**: Integrated HTML5 video player with synchronized dynamic canvas overlays displaying detected HUD bounding boxes (destruction %, stars, 3-minute battle clock), unit dock bounding boxes, active slot deployment highlights, and unit spawn particle bursts.
     - **Right Pane (Deterministic WASM Simulation)**: Embedded `WasmBattleSession` compiled from `crates/coc-engine` executing the extracted base layout and attacker army composition.
  2. **Dual-Stream Lock-Step Synchronization**:
     - Playback scrubber binds video time $t_{\text{sec}}$ to deterministic battle ticks $t_{\text{tick}} = \lfloor (t_{\text{sec}} - t_{\text{start}}) \times 30 \rfloor$.
     - When seeking or playing, the WASM battle session injects the extracted actions (`slot_type`, `slot_idx`, `deploy_fraction`, `tile_xy`) precisely at their scheduled timestamps.
     - Real-time side-by-side battle telemetry compares video CV ground truth (clock, destruction %, stars) with WASM simulation metrics, surfacing any divergence.
  3. **FastAPI Endpoints & Video Streaming Proxy (`python/ai_server.py`, `web/src/ai/aiServerPlugin.ts`)**:
     - `/api/ai/cv/replays`: Catalogs extracted replay dossiers and raw videos from `datasets/replays/` and `datasets/raw_videos/`.
     - `/api/ai/cv/video`: Streams MP4 replay videos supporting HTTP 206 Partial Content range requests for smooth scrubbing.
     - `/api/ai/cv/parse`: Triggers extraction runs for local video files or external URLs.
  4. **First-Class Web UI Navigation (`web/src/App.tsx`, `web/src/ai/aiTypes.ts`, `web/src/ai/aiClient.ts`)**:
     - Added dedicated "CV Replay" navigation tab (`tab === 'cv-replay'`) in the Web Sandbox top-level shell.
- **Consequences**:
  - Provides a complete visual verification studio for offline imitation learning trajectories.
  - Enables instant identification of coordinate warping errors, slot misidentifications, and deployment timing offsets.
  - Ensures all demonstrations fed into the RL offline pre-training buffer are verified against the deterministic simulation core.


