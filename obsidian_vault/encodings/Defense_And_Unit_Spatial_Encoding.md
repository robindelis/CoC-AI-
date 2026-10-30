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

Back to [[00_Index_MOC|Vault Index (MOC)]] • Used in [[architectures/v3.0_31Ch_PerDefense_SingleArmy_ActorCritic|v3.0 Architecture]] • Unit Details: [[encodings/Unit_Type_Spatial_Encoding|Ch 8 & Ch 9 Unit Archetype Deep Dive]]

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
| `[56..64]` | `8` | **Siege Machine & Clan Castle**: Siege ID, undeployed availability (`1.0`/`0.0`), active poppable state (`1.0`/`0.0`), CC popped flag, and CC troop slots. |
