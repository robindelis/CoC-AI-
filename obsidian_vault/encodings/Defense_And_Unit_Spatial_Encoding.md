---
title: "59-Channel Dedicated Per-Troop, Per-Hero, Per-Spell, Per-Defense & Non-Offensive Spatial Grid & Live Inventory Encoding"
tags:
  - encoding
  - spatial-tensor
  - defenses
  - defending-heroes
  - non-offensive-buildings
  - army-context
  - coc-rl
updated: 2026-10-30
---

# 🛡️ 59-Channel Dedicated Spatial Grid (`Ch 0..58`) & Live Available Inventory (`64-D`)

Back to [[00_Index_MOC|Vault Index (MOC)]] • Used in [[architectures/v3.0_31Ch_PerDefense_SingleArmy_ActorCritic|v3.0 Architecture]] • Decisions: [[decisions/Architecture_Decisions_And_System_Memory|System Memory & ADR-008]]

---

## 1. 59-Channel Fine-Grained Factorization (ADR-008)

Under **ADR-008**, the spatial observation tensor is expanded to **59 channels** (`59 × 50 × 50`). Rather than compressing allied troops or defending heroes into coarse aggregations, every individual troop type, friendly hero, active spell, defending enemy hero, defense structure, and non-offensive building category receives its own dedicated non-overlapping channel:

### 1.1 The Seven Functional Channel Groups:
1. **Group 1: Base & Environment (`Ch 0..4`)**: Building HP ratio, Defense DPS threat field, 4×4 Town Hall 18 objective mask, 1×1 wall durability, and the dynamic No-Deploy Red Zone perimeter.
2. **Group 2: Friendly Army Troops, Siege & CC (`Ch 5..16`)**: Dedicated channel per loadout unit (Thrower, Healer, Furnace, Druid/Bear, Ice Golem, Super Wall Breaker, Headhunter, Balloon, Archer, Log Launcher, CC Super Yeti, CC Super Valkyrie), normalized by `count / max_in_army` on tile.
3. **Group 3: Friendly Heroes (`Ch 17..20`)**: Dedicated channel per hero (Barbarian King, Archer Queen, Grand Warden, Royal Champion), strictly `1.0` on tile if alive, `0.0` otherwise.
4. **Group 4: Friendly Spells (`Ch 21..24`)**: Totem Spell (summoned 1×1 unit HP ratio `u.hp / u.max_hp`), plus Rage, Poison, and Skeleton Spell continuous `1.0 -> 0.0` fading values (`remaining_sec / total_duration`) covering the full circular Area of Effect.
5. **Group 5: Enemy Defending Units (`Ch 25..33`)**:
   - `Ch 25`: Defending CC troops & TH18 Guardians (`min(N / 5.0, 1.0)`)
   - `Ch 26..31`: **Dedicated Individual Defending Hero Channels**:
     - `Ch 26`: Defending Barbarian King (`1.0`)
     - `Ch 27`: Defending Archer Queen (`1.0`)
     - `Ch 28`: Defending Grand Warden (`1.0`)
     - `Ch 29`: Defending Royal Champion (`1.0`)
     - `Ch 30`: Defending Minion Prince (`1.0`)
     - `Ch 31`: Defending Dragon Duke (`1.0`)
   - `Ch 32`: Defending Ground Skeletons (`min(N / 10.0, 1.0)`)
   - `Ch 33`: Defending Air Skeletons (`min(N / 10.0, 1.0)`)
6. **Group 6: 22 Dedicated Defense Types & Clan Castle (`Ch 34..55`)**: One channel per TH18 defense type plus defensive Clan Castle:
   - `Ch 34..54`: 21 TH18 Defenses (Archer Tower through Hot Candle)
   - `Ch 55`: Clan Castle (`1.0` while active on defense)
7. **Group 7: 3 Non-Offensive Building Groups (`Ch 56..58`)**:
   - `Ch 56`: Storages & Reservoirs + Hero Hall (Gold, Elixir, Dark Elixir Storages + Hero Hall HP ratio $\text{HP}/\text{HP}_{\max} \in [0, 1]$)
   - `Ch 57`: Resource Collectors (Gold Mines, Elixir Collectors, Dark Elixir Drills HP ratio $\in [0, 1]$)
   - `Ch 58`: Utility & Other Buildings (Army Camps, Barracks, Laboratory, Spell Factories, Blacksmith, etc. HP ratio $\in [0, 1]$)

---

## 2. Complete 59-Channel Spatial Observation Reference Table

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
| `26` | **Defending Barbarian King** | `1.0` on tile | Defending melee tank; pulls friendly frontline melee targeting into compartment. |
| `27` | **Defending Archer Queen** | `1.0` on tile | Defending ranged carry (700+ DPS); priority target for Headhunters and Poison. |
| `28` | **Defending Grand Warden** | `1.0` on tile | Long-range defending sniper (7.0t range) covering defense core. |
| `29` | **Defending Royal Champion** | `1.0` on tile | High-speed jumping defense assassin intercepting advancing squads. |
| `30` | **Defending Minion Prince** | `1.0` on tile | Flying defending hero sniping ground units. |
| `31` | **Defending Dragon Duke** | `1.0` on tile | Heavy aerial area-burn tank dealing continuous splash damage. |
| `32` | **Enemy Ground Skeletons** | `min(N / 10.0, 1.0)` | Defending ground skeletons from skeleton traps & defending witch. |
| `33` | **Enemy Air Skeletons** | `min(N / 10.0, 1.0)` | Defending air skeletons from air skeleton traps targeting air units. |
| `34` | **Archer Tower** | `1.0` while alive (3×3) | Point defense targeting ground + air (10.0t range, 145 DPS). |
| `35` | **Multi-Archer Tower** | `1.0` while alive (3×3) | Merged 3-target point defense (10.0t range, 363 DPS). |
| `36` | **Ricochet Cannon** | `1.0` while alive (3×3) | Merged 2-target ground bounce defense (9.0t range, 396 DPS). |
| `37` | **Cannon** | `1.0` while alive (3×3) | Standard ground point defense (9.0t range, 235 DPS). |
| `38` | **Mortar** | `1.0` while alive (3×3) | Long-range ground splash with 4–11t blind deadzone (56 DPS). |
| `39` | **Air Defense** | `1.0` while alive (3×3) | Lethal anti-air rocket battery (10.0t range, 650 DPS). |
| `40` | **Wizard Tower** | `1.0` while alive (3×3) | Ground + air area splash defense (7.0t range, 110 DPS). |
| `41` | **Super Wizard Tower** | `1.0` while alive (3×3) | Merged chain-lightning defense hitting up to 15 targets (8.0t range, 265 DPS). |
| `42` | **Air Sweeper** | `0.25 + 0.75 * (theta_deg / 360.0)` | Encodes 2×2 footprint and continuous 105° pushback cone facing angle in `[0.25, 1.0]`. |
| `43` | **Hidden Tesla** | `1.0` when revealed (2×2), `0.0` hidden | Hidden information invariant: strictly `0.0` until revealed by proximity or >=51% destruction. |
| `44` | **Bomb Tower** | `1.0` while alive (3×3) | Ground splash defense + triggers high-damage death bomb upon destruction. |
| `45` | **X-Bow** | `1.0` = Air+Ground, `0.5` = Ground-only | Distinguishes 11.5t Air+Ground mode from 14.0t Ground-only mode. |
| `46` | **Inferno Tower** | `1.0` = Single-Target, `0.5` = Multi-Target | 3-stage exponential ramp beam (Single) vs 6-target scorch (Multi). |
| `47` | **Scattershot** | `1.0` while alive (3×3) | Heavy 90° cone splash behind primary target (3–10t range). |
| `48` | **Builder's Hut** | `1.0` while alive (2×2) | Weaponized turret + spawns repair builder healing nearby structures. |
| `49` | **Spell Tower** | `0.25`=Rage, `0.50`=Poison, `0.75`=Invis, `1.00`=EQ | Encodes active defensive spell canister triggered on compartment breach. |
| `50` | **Monolith** | `1.0` while alive (3×3) | Anti-tank % max-HP + flat damage priority core threat. |
| `51` | **Multi-Gear Tower** | `1.0` = Long Range, `0.5` = Fast Attack | TH18 geared defense switching between long range and fast burst. |
| `52` | **Firespitter** | `0.25 + 0.75 * (theta_deg / 360.0)` | Continuous 150° piercing fireball cone angle encoding in `[0.25, 1.0]`. |
| `53` | **Revenge Tower** | `1.0` while alive (3×3) | Escalates power as 5 / 25 / 50 village buildings are destroyed. |
| `54` | **Hot Candle (Crafted)** | `1.0` while alive (3×3) | Season 4 Crafted Defense firing 6 → 4 → 3 multi-target flames as it melts. |
| `55` | **Clan Castle (Defense)** | `1.0` while alive (3×3) | Defensive fortification housing CC reinforcements. |
| `56` | **Storages & Hero Hall** | `hp / max_hp` across footprint | High-HP non-defensive tanks (Gold, Elixir, Dark Elixir Storages, Hero Hall). |
| `57` | **Resource Collectors** | `hp / max_hp` across footprint | Outer perimeter resource collectors (Gold Mines, Collectors, Drills). |
| `58` | **Utility & Other Buildings** | `hp / max_hp` across footprint | Remaining non-defensive structures (Army Camps, Barracks, Lab, Spell Factories, etc.). |
| `41` | **Inferno Tower** | `1.0` = Single-Target, `0.5` = Multi-Target | Distinguishes ramping single-target beam from 6-target multi mode. |
| `42` | **Scattershot** | `1.0` while alive (3×3) | Heavy splash defense with 90° blast cone behind target (3–10t range). |
| `43` | **Builder's Hut** | `1.0` while alive (2×2) | Weaponized turret that spawns an active repair builder healing damaged buildings. |
| `44` | **Spell Tower** | `0.25` Rage, `0.50` Poison, `0.75` Invis, `1.00` EQ | Encodes the active defensive spell canister triggered on compartment breach. |
| `45` | **Monolith** | `1.0` while alive (3×3) | High-threat tank destroyer dealing flat damage plus percentage of max HP. |
| `46` | **Multi-Gear Tower** | `1.0` = Long Range, `0.5` = Fast Attack | Distinguishes sniper mode from rapid-fire mode. |
| `47` | **Firespitter** | `0.25 + 0.75 * (theta_deg / 360.0)` | Encodes 3×3 footprint and continuous 150° piercing fireball cone angle in `[0.25, 1.0]`. |
| `48` | **Revenge Tower** | `1.0` while alive (3×3) | Escalating defense activating stage buffs at 5 / 25 / 50 destroyed structures. |
| `49` | **Hot Candle (Crafted)** | `1.0` while alive (3×3) | Season 4 Crafted Defense (`CraftingStation`) melting down through 6 -> 4 -> 3 flames. |

