---
title: "31-Channel Per-Defense Spatial Grid, Unit Archetypes & Live Inventory Encoding"
tags:
  - encoding
  - spatial-tensor
  - defenses
  - army-context
  - coc-rl
updated: 2026-10-30
---

# 🛡️ 31-Channel Per-Defense Spatial Grid (`Ch 10..30`), Unit Archetypes (`Ch 8..9`) & Live Inventory (`64-D`)

Back to [[00_Index_MOC|Vault Index (MOC)]] • Used in [[architectures/v3.0_31Ch_PerDefense_SingleArmy_ActorCritic|v3.0 Architecture]] • Unit Details: [[encodings/Unit_Type_Spatial_Encoding|Ch 8 & Ch 9 Unit Archetype Deep Dive]] • Decisions: [[decisions/Architecture_Decisions_And_System_Memory|System Memory & ADRs]]

---

## 1. Why One Channel per Defense Type (`Ch 10..30`)?

Town Hall 18 features **21 distinct defensive building types** (plus `TownHall` on Channel 2). In `v3.0`, each defense type receives its own dedicated $50 \times 50$ channel (`Channels 10..30`):

1. **Exact Equivalence to a Learned Spatial Embedding (`nn.Embedding` + `Conv2d`)**:
   - Because buildings on a Clash of Clans village grid never overlap on the same tile, feeding 21 per-defense planes into the first convolutional layer `Conv2d(in_channels=31, out_channels=64, kernel_size=3, dilation=2)` is mathematically equivalent to looking up a learned 64-D embedding vector for each defense type and convolving over the $50\times 50$ map.
2. **Negligible Parameter & Compute Overhead**:
   - Adding 21 channels only modifies the first layer `s1`, adding $21 \times 64 \times 3 \times 3 = 12{,}096$ parameters ($0.89\%$ of the $1.36\text{M}$-parameter model).
3. **Mode, Direction & Visibility Awareness**:
   - **Mode-Switchable Defenses**:
     - `Ch 21 (XBow)`: `1.0` = Air & Ground ($11.5\text{t}$), `0.5` = Ground Only ($14.0\text{t}$)
     - `Ch 22 (InfernoTower)`: `1.0` = Single-Target exponential ramp, `0.5` = Multi-Target (6 beams)
     - `Ch 25 (SpellTower)`: `0.25` = Rage, `0.50` = Poison, `0.75` = Invisibility, `1.00` = Earthquake
     - `Ch 27 (MultiGearTower)`: `1.0` = Long Range, `0.5` = Fast Attack
   - **Directional Cone Defenses**:
     - `Ch 18 (AirSweeper)` & `Ch 28 (Firespitter)`: Encode $0.25 + 0.75 \cdot (\theta_{\text{deg}} \bmod 360^\circ) / 360^\circ \in [0.25, 1.0]$, so a single channel conveys both the building's footprint and the exact direction its cone is pointing.
   - **Fair Hidden Tesla Masking (`Ch 19`)**:
     - While `HiddenTesla` is unrevealed (`!b.is_hidden_tesla_revealed`), it writes `0.0` into `Ch 0` (Building HP), `Ch 1` (DPS), and `Ch 19` (`HiddenTesla`). Once triggered by an approaching unit or $\ge 51\%$ destruction, it immediately appears on `Ch 0`, `Ch 1`, and `Ch 19`.

---

## 2. Live Available Army Inventory Vector (`army_context`, `(B, 64)`)

Even though each `v3.0` model is trained for **1 dedicated Army Composition**, the spatial grid `(31, 50, 50)` only shows units that have **already been deployed** onto the battlefield. To make optimal sequential decisions, the policy also receives the `64-D` live inventory vector `army_context`:

| Slice | Dimensions | Encoded Live State |
| :---: | :---: | :--- |
| `[0..4]` | `4` | **Battle Progress**: Remaining clock ratio $(1800 - t)/1800$, destruction $\% / 100$, stars $/ 3$, active allied unit count $/ 50$. |
| `[4..24]` | `20` (`10 × 2`) | **Troop Slots `0..9`**: If `rem > 0`, encodes `(troop_id / 60.0, rem / 20.0)`; once depleted (`rem == 0`), both entries become **`0.0`**. |
| `[24..44]` | `20` (`10 × 2`) | **Spell Slots `0..9`**: If `rem > 0`, encodes `(spell_id / 20.0, rem / 8.0)`; once depleted (`rem == 0`), both entries become **`0.0`**. |
| `[44..56]` | `12` (`4 × 3`) | **Hero Slots `0..3`**: `(hero_equip_pet_sig, deploy_or_hp_ratio, ability_ready_state)` where ability state is `0.5` undeployed, `1.0` deployed & ability ready, `0.0` ability used. |
---

## 3. Complete 31-Channel Spatial Observation Reference Table

| Ch # | Channel Name | Value / Formula on Footprint | Tactical Role & Normalization |
| :---: | :--- | :--- | :--- |
| `0` | **Building HP Ratio** | `hp / 11000.0` in `[0, 1]` | Surviving building durability across footprint. Hidden Tesla writes `0.0` until revealed. |
| `1` | **Defense DPS Threat** | `min(spec.dps / 750.0, 1.0)` | Lethal danger field across active defensive turrets. Hidden Tesla writes `0.0` until revealed. |
| `2` | **Town Hall 18 Mask** | `1.0` on 4×4 TH18 tiles, `0.0` elsewhere | Locates the 2nd Victory Star objective and high-HP core defense zone. |
| `3` | **Wall Durability** | `hp / max_hp` in `[0, 1]` | Wall segment durability (1×1 tile per piece). Breached or destroyed walls drop to `0.0`. |
| `4` | **No-Deploy Red Zone** | `1.0` = forbidden, `0.0` = legal deployment | Dynamic exclusion mask around living structures restricting troop, hero, and siege placement. |
| `5` | **Friendly Ground HP Density** | `min(sum(ground_hp) / 5000.0, 1.0)` | Spatial clustering and mass density of allied ground units. |
| `6` | **Friendly Air HP Density** | `min(sum(air_hp) / 5000.0, 1.0)` | Spatial clustering and mass density of allied air units. |
| `7` | **Active Spell Fields** | `1.0` at center of active spell rings | Active Rage, Heal, Freeze, Invisibility, Poison, Overgrowth, or Totem fields. |
| `8` | **Allied Unit Archetype Signature** | `max_{u in Ally(x,y)} phi(u) in [0, 1]` | Distinguishes allied archetypes: Swarm `0.10`, Tank `0.35`, Ranged `0.60`, Healer `0.81`, Hero `0.99`. |
| `9` | **Enemy Unit Archetype Signature** | `max_{u in Enemy(x,y)} phi(u) in [0, 1]` | Distinguishes defending CC troops, Heroes, Guardians, Ground Skeletons `0.10`, Air Skeletons `0.28`. |
| `10` | **Archer Tower** | `1.0` while alive (3×3) | Point defense targeting ground + air (10.0t range, 145 DPS). |
| `11` | **Multi-Archer Tower** | `1.0` while alive (3×3) | Merged 3-target point defense (10.0t range, 363 DPS). |
| `12` | **Ricochet Cannon** | `1.0` while alive (3×3) | Merged 2-target ground bounce defense (9.0t range, 396 DPS). |
| `13` | **Cannon** | `1.0` while alive (3×3) | Standard ground point defense (9.0t range, 235 DPS). |
| `14` | **Mortar** | `1.0` while alive (3×3) | Long-range ground splash with 4–11t blind deadzone (56 DPS). |
| `15` | **Air Defense** | `1.0` while alive (3×3) | Lethal anti-air rocket battery (10.0t range, 650 DPS). |
| `16` | **Wizard Tower** | `1.0` while alive (3×3) | Ground + air area splash defense (7.0t range, 110 DPS). |
| `17` | **Super Wizard Tower** | `1.0` while alive (3×3) | Merged chain-lightning defense hitting up to 15 targets (8.0t range, 265 DPS). |
| `18` | **Air Sweeper** | `0.25 + 0.75 * (theta_deg / 360.0)` | Encodes 2×2 footprint and continuous 105° pushback cone facing angle in `[0.25, 1.0]`. |
| `19` | **Hidden Tesla** | `1.0` when revealed (2×2), `0.0` hidden | Hidden information invariant: strictly `0.0` until revealed by proximity or >=51% destruction. |
| `20` | **Bomb Tower** | `1.0` while alive (3×3) | Ground splash defense + triggers high-damage death bomb upon destruction. |
| `21` | **X-Bow** | `1.0` = Air+Ground, `0.5` = Ground-only | Distinguishes 11.5t Air+Ground mode from 14.0t Ground-only mode. |
| `22` | **Inferno Tower** | `1.0` = Single-Target, `0.5` = Multi-Target | Distinguishes ramping single-target beam from 6-target multi mode. |
| `23` | **Scattershot** | `1.0` while alive (3×3) | Heavy splash defense with 90° blast cone behind target (3–10t range). |
| `24` | **Builder's Hut** | `1.0` while alive (2×2) | Weaponized turret that spawns an active repair builder healing damaged buildings. |
| `25` | **Spell Tower** | `0.25` Rage, `0.50` Poison, `0.75` Invis, `1.00` EQ | Encodes the active defensive spell canister triggered on compartment breach. |
| `26` | **Monolith** | `1.0` while alive (3×3) | High-threat tank destroyer dealing flat damage plus percentage of max HP. |
| `27` | **Multi-Gear Tower** | `1.0` = Long Range, `0.5` = Fast Attack | Distinguishes sniper mode from rapid-fire mode. |
| `28` | **Firespitter** | `0.25 + 0.75 * (theta_deg / 360.0)` | Encodes 3×3 footprint and continuous 150° piercing fireball cone angle in `[0.25, 1.0]`. |
| `29` | **Revenge Tower** | `1.0` while alive (3×3) | Escalating defense activating stage buffs at 5 / 25 / 50 destroyed structures. |
| `30` | **Hot Candle (Crafted)** | `1.0` while alive (3×3) | Season 4 Crafted Defense (`CraftingStation`) melting down through 6 -> 4 -> 3 flames. |

