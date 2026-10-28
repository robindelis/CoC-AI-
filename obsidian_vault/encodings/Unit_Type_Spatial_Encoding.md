---
title: "Hierarchical Tactical-Archetype Spatial Encoding (Ch 8 & Ch 9)"
tags:
  - encoding
  - spatial-tensor
  - conv2d
  - skeletons
  - coc-rl
updated: 2026-10-28
---

# 🧠 Why Not Raw Integers? — Hierarchical Tactical-Archetype Encoding for Channels 8 & 9

Back to [[00_Index_MOC|Vault Index (MOC)]] • Used in [[v2.0_10Ch_Archetype_And_DeployFraction]]

---

## 1. The Question: Should We Encode Troop Types as Raw Integers ($1, 2, \dots, 65$)?

When adding **Channel 8 (Allied Unit Types)** and **Channel 9 (Enemy Unit Types)** to a `50 × 50` spatial tensor processed by a `Conv2d(in_channels=10, out_channels=32, kernel_size=3)` layer, a natural first thought is to write each unit's enum index ($1, 2, \dots, 65$) into the grid cell $(x, y)$.

However, in a 2D Convolutional Neural Network, **raw arbitrary integer IDs cause three severe mathematical pathologies**:

### Pathology A: Artificial Linear Ordering in `Conv2d` Inner Products
A `3 × 3` convolution computes a weighted linear sum:
$$
z_{k}(x, y) = b_k + \sum_{c=0}^{9} \sum_{\Delta y=-1}^{1} \sum_{\Delta x=-1}^{1} W_{k, c, \Delta y, \Delta x} \cdot S_{c}(x + \Delta x, y + \Delta y)
$$
If `Barbarian = 1`, `Healer = 8`, and `Skeleton = 48`:
- Every $3 \times 3$ filter weight $W_{k,8}$ is multiplied by $48\times$ more magnitude for a single Skeleton than for a Barbarian.
- Even if normalized by $/65$, an arbitrary enum order places unrelated units next to each other (e.g., an air transport `BattleBlimp` next to a ground `LogLauncher`, or a support `Healer` between `Balloon` and `Dragon`). A single ReLU/SiLU threshold cannot separate air threats from ground tanks.

### Pathology B: Multi-Unit Tile Collisions (Averaging / Summing Corruption)
In Clash of Clans, multiple units frequently stand on the same $1 \times 1$ tile $(x, y)$:
- If we **sum** or **average** arbitrary IDs on a tile, `1 Barbarian (ID 1) + 1 Skeleton (ID 48)` averages to `ID 24.5` (`Miner`), hallucinating a completely different troop!
- Moreover, **Channels 5 & 6 already encode summed Ground and Air HP density** on tile $(x, y)$. Channels 8 & 9 do not need to re-encode count/mass; they need to encode **tactical identity**.

### Pathology C: Ground Skeletons vs. Air Skeletons Share `TroopId::Skeleton`!
In the simulation engine (`crates/coc-engine/src/sim.rs`), when a `SkeletonTrap` triggers:
- If configured in **`TrapMode::SkeletonGround`**, it spawns `TroopId::Skeleton` with `is_air = false`.
- If configured in **`TrapMode::SkeletonAir`**, it spawns `TroopId::Skeleton` with `is_air = true`.
If we only looked at `TroopId`, **Ground Skeletons and Air Skeletons would receive the exact same integer**, making it impossible for the CNN to know whether its Balloons/Dragons are being attacked by Air Skeletons or whether Ground Skeletons are distracting its Heroes/Pekkas!

---

## 2. Our Solution: Hierarchical Tactical-Archetype Signature $\phi(u) \in [0, 1]$ with Dominant-Unit Max-Pooling

Instead of arbitrary enum IDs or a memory-heavy 65-channel one-hot tensor (which would bloat the observation space from `10×50×50` to `73×50×50`), we design a **monotonically structured Tactical-Archetype Signature $\phi(u) \in [0, 1]$** combined with **per-tile Max-Pooling**:

$$
S_{\text{Ch8}}(x, y) = \max_{u \in \text{Attacker}(x,y)} \phi(u), \qquad S_{\text{Ch9}}(x, y) = \max_{u \in \text{Defender}(x,y)} \phi(u)
$$

### Why Dominant-Unit Max-Pooling ($\max_{u \in (x,y)} \phi(u)$) + Role Bands Works Best:
1. **Semantic Grouping by Combat Role & Domain**:
   - Similar tactical roles occupy contiguous bands of $[0, 1]$, so a single `Conv2d` filter can easily threshold `[0.10, 0.25]` (light ground swarm), `[0.28, 0.42]` (air swarms & air skeletons), `[0.46, 0.62]` (high-DPS ranged core like Throwers/Bowlers), or `[0.93, 0.99]` (Heroes & Pets).
2. **Collision Invariance via Max-Pooling**:
   - When a Hero (`0.96`) or Thrower (`0.60`) stands on the same tile as a spawned Ground Skeleton (`0.10`), $\max \phi(u)$ preserves the high-priority unit signature (`0.96` or `0.60`) rather than averaging it into a nonsensical midpoint, while pure skeleton/swarm tiles cleanly display `0.10` (Ground Skeleton) or `0.28` (Air Skeleton).
3. **Explicit Domain-Aware Disambiguation for Skeletons**:
   - $\phi(u)$ inspects **both** `u.kind` and `u.is_air`:
     - `TroopId::Skeleton` with `is_air == false` $\implies \mathbf{0.10}$ (**Ground Skeleton**)
     - `TroopId::Skeleton` with `is_air == true` $\implies \mathbf{0.28}$ (**Air Skeleton**)

---

## 3. Complete Tactical-Archetype Lookup Table $\phi(u) \in [0, 1]$

| Band | $\phi(u)$ Value | Tactical Archetype | Units Mapped (Attacker Ch 8 & Defender Ch 9) |
| :--- | :---: | :--- | :--- |
| **Empty** | `0.00` | No Unit Present | Empty tile for that team |
| **Band 1: Ground Summons & Swarm** | `0.10` | **Ground Skeleton** | `Skeleton` with `is_air == false` (Ground Skeleton Trap, Witch, Skeleton Spell) |
| | `0.12` | **Armored Skeleton** | `ArmoredSkeleton` (Witch / Equipment summon) |
| | `0.14` | **Ground Critters / Mites** | `Yetimite`, `Firemite`, `Frostmite`, `Booger`, `Snake`, `Totem` |
| | `0.18` | **Light Ground Melee / Dive** | `Barbarian`, `SuperBarbarian`, `Goblin`, `SneakyGoblin`, `Miner`, `HogRider` |
| | `0.22` | **Breachers & Assassins** | `WallBreaker`, `SuperWallBreaker`, `Headhunter` |
| **Band 2: Air Swarms & Light Air** | `0.28` | **Air Skeleton** | `Skeleton` with `is_air == true` (**Air Skeleton Trap** `TrapMode::SkeletonAir`) |
| | `0.32` | **Air Bat Swarm** | `Bat` (Bat Spell / Night swarm) |
| | `0.36` | **Light/Med Air Ranged** | `Minion`, `SuperMinion`, `BabyDragon`, `InfernoDragon` |
| | `0.40` | **Air Defense-Targeters** | `Balloon`, `RocketBalloon`, `DragonRider` |
| **Band 3: Ground Ranged & Core** | `0.46` | **Light Ground Ranged** | `Archer`, `SuperArcher`, `Wizard`, `SuperWizard` |
| | `0.52` | **Summoners & Aura Support** | `Witch`, `SuperWitch`, `ApprenticeWarden`, `Druid`, `Furnace` |
| | `0.56` | **Medium Splash / Bounce** | `Valkyrie`, `SuperValkyrie`, `Bowler`, `SuperBowler`, `SuperMiner` |
| | `0.60` | **Elite Ground Core** | `Thrower`, `Yeti`, `SuperYeti`, `ElectroTitan` |
| **Band 4: Heavy Ground Tanks & Guardians** | `0.66` | **Medium Ground Tanks** | `Giant`, `SuperGiant`, `DruidBear` |
| | `0.70` | **Heavy Utility Tanks** | `IceGolem`, `Golem` |
| | `0.74` | **Heavy Breachers / Pekka** | `RootRider`, `Pekka` |
| | `0.78` | **TH18 Defending Guardians** | `GuardianLogger`, `GuardianLongshot`, `GuardianSmasher` |
| **Band 5: Heavy Air & Healers** | `0.81` | **Air Healer** | `Healer` (Allied ground-healing air support) |
| | `0.85` | **Heavy Dragons** | `Dragon`, `SuperDragon`, `ElectroDragon` |
| | `0.89` | **Heavy Air Tanks** | `LavaHound`, `IceHound` |
| **Band 6: Siege, Pets & Heroes** | `0.91` | **Siege Machines** | `WallWrecker`, `BattleBlimp`, `StoneSlammer`, `SiegeBarracks`, `LogLauncher`, `FlameFlinger`, `BattleDrill` |
| | `0.93` | **Hero Pets** | All `PetId` units (`SpiritFox`, `AngryJelly`, `Phoenix`, `Unicorn`, `Diggy`, `Frosty`, `Sneezy`, etc.) |
| | `0.96` | **Ground Heroes** | `BarbarianKing`, `ArcherQueen`, `GrandWarden`, `RoyalChampion` |
| | `0.99` | **Air Heroes** | `MinionPrince`, `DragonDuke` |
