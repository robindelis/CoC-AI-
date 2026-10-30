---
title: "50-Channel Dedicated Per-Troop, Per-Hero, Per-Spell & Per-Defense Spatial Grid & Live Inventory Encoding"
tags:
  - encoding
  - spatial-tensor
  - defenses
  - army-context
  - coc-rl
updated: 2026-10-30
---

# 🛡️ 50-Channel Dedicated Spatial Grid (`Ch 0..49`) & Live Available Inventory (`64-D`)

Back to [[00_Index_MOC|Vault Index (MOC)]] • Used in [[architectures/v3.0_31Ch_PerDefense_SingleArmy_ActorCritic|v3.0 Architecture]] • Unit Details: [[encodings/Unit_Type_Spatial_Encoding|Unit Archetype Diagnostic Specification]] • Decisions: [[decisions/Architecture_Decisions_And_System_Memory|System Memory & ADRs]]

---

## 1. 50-Channel Fine-Grained Factorization (ADR-007)

Under **ADR-007**, the spatial observation tensor is expanded from 31 to **50 channels** (`50 × 50 × 50`). Rather than compressing allied troops into coarse ground/air density maps and a 1D archetype signature $\phi(u)$, every individual troop type, hero, active spell, and defending entity in the meta army composition receives its own dedicated non-overlapping channel:

### 1.1 The Six Functional Channel Groups:
1. **Group 1: Base & Environment (`Ch 0..4`)**: Building HP ratio, Defense DPS threat field, 4×4 Town Hall 18 objective mask, 1×1 wall durability, and the dynamic No-Deploy Red Zone perimeter.
2. **Group 2: Friendly Army Troops, Siege & CC (`Ch 5..16`)**: Dedicated channel per loadout unit (Thrower, Healer, Furnace, Druid/Bear, Ice Golem, Super Wall Breaker, Headhunter, Balloon, Archer, Log Launcher, CC Super Yeti, CC Super Valkyrie), normalized by `count / max_in_army` on tile.
3. **Group 3: Friendly Heroes (`Ch 17..20`)**: Dedicated channel per hero (Barbarian King, Archer Queen, Grand Warden, Royal Champion), strictly `1.0` on tile if alive, `0.0` otherwise.
4. **Group 4: Friendly Spells (`Ch 21..24`)**: Totem Spell (summoned 1×1 unit HP ratio `u.hp / u.max_hp`), plus Rage, Poison, and Skeleton Spell continuous `1.0 -> 0.0` fading values (`remaining_sec / total_duration`) covering the full circular Area of Effect.
5. **Group 5: Enemy Defending Units (`Ch 25..28`)**: Defending CC troops & TH18 Guardians (`min(N / 5.0, 1.0)`), Defending Heroes (`1.0`), Defending Ground Skeletons (`min(N / 10.0, 1.0)`), and Defending Air Skeletons (`min(N / 10.0, 1.0)`).
6. **Group 6: 21 Dedicated Defense Types (`Ch 29..49`)**: One channel per TH18 defense type with mode, angle, and concealment semantics preserved:
   - **Mode-Switchable Defenses**:
     - `Ch 40 (XBow)`: `1.0` = Air & Ground ($11.5\text{t}$), `0.5` = Ground Only ($14.0\text{t}$)
     - `Ch 41 (InfernoTower)`: `1.0` = Single-Target exponential ramp, `0.5` = Multi-Target (6 beams)
     - `Ch 44 (SpellTower)`: `0.25` = Rage, `0.50` = Poison, `0.75` = Invisibility, `1.00` = Earthquake
     - `Ch 46 (MultiGearTower)`: `1.0` = Long Range, `0.5` = Fast Attack
   - **Directional Cone Defenses**:
     - `Ch 37 (AirSweeper)` & `Ch 47 (Firespitter)`: Encode $0.25 + 0.75 \cdot (\theta_{\text{deg}} \bmod 360^\circ) / 360^\circ \in [0.25, 1.0]$, so a single channel conveys both the building's footprint and the exact direction its cone is pointing.
   - **Fair Hidden Tesla Masking (`Ch 38`)**:
     - While `HiddenTesla` is unrevealed (`!b.is_hidden_tesla_revealed`), it writes `0.0` into `Ch 0` (Building HP), `Ch 1` (DPS), and `Ch 38` (`HiddenTesla`). Once triggered by proximity or $\ge 51\%$ destruction, it appears immediately.

### 1.2 Mathematical Equivalence to Learned Spatial Embeddings:
Feeding 50 channels into `Conv2d(in_channels=50, out_channels=64, kernel_size=3, dilation=2)` corresponds to a learned 64-D embedding lookup per feature plane convolved over the $50\times 50$ map, adding only $10{,}944$ parameters ($0.80\%$ increase) while completely resolving multi-unit tile overlap ambiguity.

---

## 2. Live Available Army Inventory Vector (`army_context`, `(B, 64)`)

Even though each `v3.0` model is trained for **1 dedicated Army Composition**, the spatial grid `(50, 50, 50)` only shows units that have **already been deployed** onto the battlefield. To make optimal sequential decisions, the policy also receives the `64-D` live inventory vector `army_context`:

| Slice | Dimensions | Encoded Live State |
| :---: | :---: | :--- |
| `[0..4]` | `4` | **Battle Progress**: Remaining clock ratio $(1800 - t)/1800$, destruction $\% / 100$, stars $/ 3$, active allied unit count $/ 50$. |
| `[4..24]` | `20` (`10 × 2`) | **Troop Slots `0..9`**: If `rem > 0`, encodes `(troop_id / 60.0, rem / 20.0)`; once depleted (`rem == 0`), both entries become **`0.0`**. |
| `[24..44]` | `20` (`10 × 2`) | **Spell Slots `0..9`**: If `rem > 0`, encodes `(spell_id / 20.0, rem / 8.0)`; once depleted (`rem == 0`), both entries become **`0.0`**. |
| `[44..56]` | `12` (`4 × 3`) | **Hero Slots `0..3`**: `(hero_equip_pet_sig, deploy_or_hp_ratio, ability_ready_state)` where ability state is `0.5` undeployed, `1.0` deployed & ability ready, `0.0` ability used. |
---

## 3. Complete 50-Channel Spatial Observation Reference Table

| Ch # | Channel Name | Value / Formula on Footprint | Tactical Role & Normalization |
| :---: | :--- | :--- | :--- |
| `0` | **Building HP Ratio** | `hp / 11000.0` in `[0, 1]` | Surviving building durability across footprint. Hidden Tesla writes `0.0` until revealed. |
| `1` | **Defense DPS Threat** | `min(spec.dps / 750.0, 1.0)` | Lethal danger field across active defensive turrets. Hidden Tesla writes `0.0` until revealed. |
| `2` | **Town Hall 18 Mask** | `1.0` on 4×4 TH18 tiles, `0.0` elsewhere | Locates the 2nd Victory Star objective and high-HP core defense zone. |
| `3` | **Wall Durability** | `hp / max_hp` in `[0, 1]` | Wall segment durability (1×1 tile per piece). Breached or destroyed walls drop to `0.0`. |
| `4` | **No-Deploy Red Zone** | `1.0` = forbidden, `0.0` = legal deployment | Dynamic exclusion mask around living structures restricting troop, hero, and siege placement. |
| `5` | **Thrower** | `N / 12.0` on tile | Primary ranged siege artillery cluster density (max 12 in army). |
| `6` | **Healer** | `N / 5.0` on tile | Airborne sustain support pocket escorting main push (max 5 in army). |
| `7` | **Furnace** | `N / 2.0` on tile | Mobile siege spawner launching continuous suicidal Firemites (max 2 in army). |
| `8` | **Druid & Bear** | `N / 1.0` on tile | Support healer evolving into frontline Bear brawler upon death (max 1 in army). |
| `9` | **Ice Golem** | `N / 1.0` on tile | Frontline freeze tank immobilizing nearby defenses upon death (max 1 in army). |
| `10` | **Super Wall Breaker** | `N / 1.0` on tile | Mega-bomb breach unit for high-value compartment entry (max 1 in army). |
| `11` | **Headhunter** | `N / 1.0` on tile | Specialist hero-assassin dealing 4x damage to defending heroes (max 1 in army). |
| `12` | **Balloon** | `N / 1.0` on tile | Targeted air defense-seeker and trap tester (max 1 in army). |
| `13` | **Archer** | `N / 4.0` on tile | Light perimeter clean-up squad sniping exposed corner structures (max 4 in army). |
| `14` | **Log Launcher (Siege)** | `1.0` on tile | Rolling battering ram piercing wall lines toward Town Hall (max 1 in army). |
| `15` | **CC Super Yeti** | `1.0` on tile | Core melee tank released from popped Log Launcher with Heavy Yetimites (max 1 in army). |
| `16` | **CC Super Valkyrie** | `1.0` on tile | Core whirlwind brawler dropping lingering Rage Spell upon death (max 1 in army). |
| `17` | **Barbarian King** | `1.0` on tile | High-HP melee tank equipped with Spiky Ball & Snake Bracelet (0 or 1). |
| `18` | **Archer Queen** | `1.0` on tile | High-DPS ranged carry equipped with Magic Mirror & Action Figure (0 or 1). |
| `19` | **Grand Warden** | `1.0` on tile | Support aura hero providing Eternal Tome invulnerability & Rage Gem (0 or 1). |
| `20` | **Royal Champion** | `1.0` on tile | Target-seeking defense assassin with Rocket Spear & Electro Boots (0 or 1). |
| `21` | **Totem Spell (HP Ratio)** | `hp / max_hp` on 1×1 tile | Summoned lightning totem unit absorbing defense fire & pulsing lightning. |
| `22` | **Rage Spell (Fade AoE)** | `rem / total` across AoE radius | Continuous 1.0 -> 0.0 fading speed & damage boost circle. |
| `23` | **Poison Spell (Fade AoE)** | `rem / total` across AoE radius | Continuous 1.0 -> 0.0 fading defending CC deceleration & poison mist circle. |
| `24` | **Skeleton Spell (Fade AoE)** | `rem / total` across AoE radius | Continuous 1.0 -> 0.0 fading friendly skeleton distraction summon circle. |
| `25` | **Enemy CC & Guardian** | `min(N / 5.0, 1.0)` | Defending Clan Castle troops (Lava Hound, Ice Golem, Headhunters) & TH18 Guardian. |
| `26` | **Enemy Heroes** | `1.0` on tile | Defending King, Queen, Warden, and Dragon Duke on defensive banners. |
| `27` | **Enemy Ground Skeletons** | `min(N / 10.0, 1.0)` | Defending ground skeletons from skeleton traps & defending witch. |
| `28` | **Enemy Air Skeletons** | `min(N / 10.0, 1.0)` | Defending air skeletons from air skeleton traps targeting air units. |
| `29` | **Archer Tower** | `1.0` while alive (3×3) | Point defense targeting ground + air (10.0t range, 145 DPS). |
| `30` | **Multi-Archer Tower** | `1.0` while alive (3×3) | Merged 3-target point defense (10.0t range, 363 DPS). |
| `31` | **Ricochet Cannon** | `1.0` while alive (3×3) | Merged 2-target ground bounce defense (9.0t range, 396 DPS). |
| `32` | **Cannon** | `1.0` while alive (3×3) | Standard ground point defense (9.0t range, 235 DPS). |
| `33` | **Mortar** | `1.0` while alive (3×3) | Long-range ground splash with 4–11t blind deadzone (56 DPS). |
| `34` | **Air Defense** | `1.0` while alive (3×3) | Lethal anti-air rocket battery (10.0t range, 650 DPS). |
| `35` | **Wizard Tower** | `1.0` while alive (3×3) | Ground + air area splash defense (7.0t range, 110 DPS). |
| `36` | **Super Wizard Tower** | `1.0` while alive (3×3) | Merged chain-lightning defense hitting up to 15 targets (8.0t range, 265 DPS). |
| `37` | **Air Sweeper** | `0.25 + 0.75 * (theta_deg / 360.0)` | Encodes 2×2 footprint and continuous 105° pushback cone facing angle in `[0.25, 1.0]`. |
| `38` | **Hidden Tesla** | `1.0` when revealed (2×2), `0.0` hidden | Hidden information invariant: strictly `0.0` until revealed by proximity or >=51% destruction. |
| `39` | **Bomb Tower** | `1.0` while alive (3×3) | Ground splash defense + triggers high-damage death bomb upon destruction. |
| `40` | **X-Bow** | `1.0` = Air+Ground, `0.5` = Ground-only | Distinguishes 11.5t Air+Ground mode from 14.0t Ground-only mode. |
| `41` | **Inferno Tower** | `1.0` = Single-Target, `0.5` = Multi-Target | Distinguishes ramping single-target beam from 6-target multi mode. |
| `42` | **Scattershot** | `1.0` while alive (3×3) | Heavy splash defense with 90° blast cone behind target (3–10t range). |
| `43` | **Builder's Hut** | `1.0` while alive (2×2) | Weaponized turret that spawns an active repair builder healing damaged buildings. |
| `44` | **Spell Tower** | `0.25` Rage, `0.50` Poison, `0.75` Invis, `1.00` EQ | Encodes the active defensive spell canister triggered on compartment breach. |
| `45` | **Monolith** | `1.0` while alive (3×3) | High-threat tank destroyer dealing flat damage plus percentage of max HP. |
| `46` | **Multi-Gear Tower** | `1.0` = Long Range, `0.5` = Fast Attack | Distinguishes sniper mode from rapid-fire mode. |
| `47` | **Firespitter** | `0.25 + 0.75 * (theta_deg / 360.0)` | Encodes 3×3 footprint and continuous 150° piercing fireball cone angle in `[0.25, 1.0]`. |
| `48` | **Revenge Tower** | `1.0` while alive (3×3) | Escalating defense activating stage buffs at 5 / 25 / 50 destroyed structures. |
| `49` | **Hot Candle (Crafted)** | `1.0` while alive (3×3) | Season 4 Crafted Defense (`CraftingStation`) melting down through 6 -> 4 -> 3 flames. |

