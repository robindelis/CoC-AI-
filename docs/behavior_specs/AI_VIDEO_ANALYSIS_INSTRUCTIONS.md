# Clash of Clans TH18 — Behavioral Specification Instructions for Video/Wiki Analysis AI

## Your Mission

You are analyzing official Clash of Clans gameplay demonstrations, wiki mechanics pages, and the pre-extracted Supercell `csv_logic` tables in `docs/behavior_specs/01_*.md` through `10_*.md`.
Your deliverable is to fill in the **Verified Behavioral Specification** sections of all 10 markdown files in `docs/behavior_specs/` so that a Rust simulation engineer can implement 100% authentic Town Hall 18 behavior in `crates/coc-engine/src/sim.rs` without guessing a single rule.

---

## Complete Entity Inventory (176 Entities — Zero Omissions Allowed)

Every single entity below has a dedicated section in `docs/behavior_specs/01_*.md` .. `10_*.md`:

1. **`01_elixir_troops.md` (19 Elixir Troops):**
   `Barbarian`, `Archer`, `Giant`, `Goblin`, `WallBreaker`, `Balloon`, `Wizard`, `Healer`, `Dragon`, `Pekka`, `BabyDragon`, `Miner`, `ElectroDragon`, `Yeti`, `DragonRider`, `ElectroTitan`, `RootRider`, `Thrower`, `MeteorGolem`
2. **`02_dark_elixir_troops.md` (13 Dark Elixir Troops):**
   `Minion`, `HogRider`, `Valkyrie`, `Golem`, `Witch`, `LavaHound`, `Bowler`, `IceGolem`, `Headhunter`, `ApprenticeWarden`, `Druid`, `Furnace`, `RuinWitch`
3. **`03_super_troops.md` (17 Super Troops):**
   `SuperBarbarian`, `SuperArcher`, `SuperGiant`, `SneakyGoblin`, `SuperWallBreaker`, `RocketBalloon`, `SuperWizard`, `SuperDragon`, `InfernoDragon`, `SuperMiner`, `SuperYeti`, `SuperMinion`, `SuperHogRider`, `SuperValkyrie`, `SuperWitch`, `IceHound`, `SuperBowler`
4. **`04_siege_machines.md` (9 Siege Machines):**
   `WallWrecker`, `BattleBlimp`, `StoneSlammer`, `SiegeBarracks`, `LogLauncher`, `FlameFlinger`, `BattleDrill`, `TroopLauncher`, `SkyWagon`
5. **`05_spawned_units_and_guardians.md` (20 Spawned Sub-Units & TH18 Guardians):**
   `Skeleton`, `ArmoredSkeleton`, `Bat`, `Golemite`, `LavaPup`, `Yetimite`, `Firemite`, `Frostmite`, `Henchman`, `Booger`, `DruidBear`, `Meteormite`, `RuinKnight`, `GiantGiant`, `Lavaloon`, `Snake`, `Totem`, `GuardianLogger`, `GuardianLongshot`, `GuardianSmasher`
6. **`06_heroes.md` (6 Heroes — Offensive & Defending Banner Behavior):**
   `BarbarianKing`, `ArcherQueen`, `MinionPrince`, `GrandWarden`, `RoyalChampion`, `DragonDuke`
7. **`07_hero_equipment.md` (43 Hero Equipment Items):**
   - *Barbarian King (8):* `BarbarianPuppet`, `RageVial`, `EarthquakeBoots`, `Vampstache`, `GiantGauntlet`, `SpikyBall`, `SnakeBracelet`, `StickHorse`
   - *Archer Queen (8):* `ArcherPuppet`, `InvisibilityVial`, `GiantArrow`, `HealerPuppet`, `FrozenArrow`, `MagicMirror`, `ActionFigure`, `MonolithArrow`
   - *Grand Warden (7):* `EternalTome`, `LifeGem`, `RageGem`, `HealingTome`, `Fireball`, `LavaloonPuppet`, `HeroicTorch`
   - *Royal Champion (7):* `RoyalGem`, `SeekingShield`, `HogRiderPuppet`, `HasteVial`, `RocketSpear`, `ElectroBoots`, `FrostFlake`
   - *Minion Prince (7):* `HenchmenPuppet`, `DarkOrb`, `MetalPants`, `NobleIron`, `DarkCrown`, `MeteorStaff`, `PortalPendant`
   - *Dragon Duke (6):* `FireHeart`, `FlameBlower`, `StunBlaster`, `ElectroFangs`, `RocketBackpack`, `RevengeDeck`
8. **`08_pets.md` (12 Hero Pets):**
   `Lassi`, `ElectroOwl`, `MightyYak`, `Unicorn`, `Frosty`, `Diggy`, `PoisonLizard`, `Phoenix`, `SpiritFox`, `AngryJelly`, `Sneezy`, `GreedyRaven`
9. **`09_spells.md` (18 Spells — 10 Elixir, 8 Dark Elixir):**
   - *Elixir (10):* `Lightning`, `Healing`, `Rage`, `Jump`, `Freeze`, `Clone`, `Invisibility`, `Recall`, `Revive`, `Totem`
   - *Dark Elixir (8):* `Poison`, `Earthquake`, `Haste`, `SkeletonSpell`, `BatSpell`, `Overgrowth`, `IceBlock`, `Angry`
10. **`10_defenses_and_traps.md` (21 Weaponized/Defensive Buildings + 8 Traps):**
    - *Defenses (21):* `TownHall` (TH18 Guardians), `ArcherTower`, `MultiArcherTower`, `RicochetCannon`, `Cannon`, `Mortar`, `AirDefense`, `WizardTower`, `SuperWizardTower`, `AirSweeper`, `HiddenTesla`, `BombTower`, `XBow`, `InfernoTower`, `Scattershot`, `BuildersHut`, `SpellTower`, `Monolith`, `MultiGearTower`, `Firespitter`, `RevengeTower`, `CraftingStation` (Hot Candle)
    - *Traps (8):* `Bomb`, `SpringTrap`, `AirBomb`, `GiantBomb`, `SeekingAirMine`, `SkeletonTrap`, `TornadoTrap`, `GigaBomb`

---

## Required Behavioral Checklist for Every Entity

When watching a video demonstration or checking the Clash of Clans Wiki / `coc_dumps/logic/*.csv` for an entity, you **must** document all 8 of the following subsections with exact numbers (in tiles, seconds/milliseconds, and HP/damage points):

1. **Deployment & Initial State:**
   - What happens at $t = 0$ on deploy? (e.g., `SuperBarbarian` 8s Rage; `SneakyGoblin` 5s Invisibility; `Phoenix` starts as an invulnerable Egg following its Hero; `AngryJelly` starts attached to its Hero for 35s; `SiegeBarracks` immediately drops P.E.K.K.A(s) then Wizards every $N$ seconds).
   - Does this unit trigger the defending Clan Castle (`DoesNotOpenCC`) or traps?
2. **Movement & Obstacle/Wall Interaction:**
   - Movement speed in raw units and tiles/second (`Speed / 8.0`).
   - How does it interact with walls? (`Ground` A* with wall penalty, `JumpWalls`, `Burrow` underground untargetable while moving, `WallCrusher` passive aura/contact damage vs walls, or `Air`).
   - For `Burrow` units (`Miner`, `SuperMiner`, `Diggy`, `BattleDrill`): how long does burrowing/submerging take, are they untargetable while underground, and do they trigger an effect on surfacing?
3. **Target Selection & Retargeting AI:**
   - `PreferredTarget` (`Any`, `Defenses`, `Resources`, `Walls`, `AirDefenses`, `Heroes`, `AlliedGround`, `AlliedAny`, `TownHall`) and multiplier against preferred targets.
   - How does it pick targets? (Standard Rule-of-3 closest candidates, `FightWithGroups` cluster following for `GrandWarden`/`ApprenticeWarden`, paired-Hero escort for `Pets`/`Unicorn`, or nearest-wall-shielding-building for `WallBreaker`/`SuperWallBreaker`).
   - When does it interrupt its current target? (Defending CC troop/hero entering `7.0t` alert radius; target becoming invisible or entangled by `Overgrowth`; wall opening mid-path).
4. **Attack / Heal Cadence & Projectile Mechanics:**
   - Attack speed (`AttackSpeed` ms), pre-hit windup (`AttackTime` ms if significant), and range (`AttackRange / 100` tiles; note whether range is measured to building footprint edge or center).
   - Is the attack instant melee/beam, homing projectile, ballistic ground-targeted projectile, penetrating line shot (`SuperArcher`, `LogLauncher`, `GiantArrow`, `Firespitter`, `GuardianLogger`), cone (`FlameBlower`, `Scattershot`), or chain bounce (`ElectroDragon`, `SuperWizard`, `ElectroOwl`, `RicochetCannon`, `SuperWizardTower`, `RevengeTower`, `SpikyBall`, `SeekingShield`, `ElectroFangs`)?
   - For splash/bounce/chain attacks: exact splash radius (tiles), max targets, bounce distance (tiles), and damage decay per bounce.
   - For ramping attacks (`InfernoDragon`, `SuperMiner`, `InfernoTower`): exact stage durations (seconds) and DPS at each stage, plus what resets the ramp (Freeze, Stun, Lightning, retargeting).
5. **Passive / Periodic Special Abilities:**
   - Periodic summons (`Witch`, `SuperWitch`, `RuinWitch`, `Furnace`, `SiegeBarracks`, `TroopLauncher`, `SkyWagon`, `Frosty`, `Sneezy`, `SnakeBracelet`): exact spawn unit, count per wave, wave interval (seconds), max active summoned units on field, and whether summons happen while moving or only while idle/attacking.
   - Passive auras (`ElectroTitan`, `ElectroBoots`, `ApprenticeWarden`, `LifeGem`, `RageGem`, `DragonDuke` Royal Rampage, `BabyDragon` Tantrum): exact radius (tiles), tick interval, stacking rules, and isolation conditions.
   - Damage-threshold triggers (`Yeti`, `SuperYeti`, `SnakeBracelet`, `DarkCrown`): exact HP lost per trigger and cap.
6. **Active Ability / Spell Zone Mechanics (for Heroes, Equipment, Siege Pop & Spells):**
   - Exact cast/activation behavior: self-buff, summoned units, directional projectile, or ground zone.
   - How the spell/ability interacts with footprint edges vs centers, immunity rules (e.g., Storages & Town Hall immune to `Lightning` and `Earthquake`), and stacking rules (e.g., `Earthquake` diminishing returns $1/(2k+1)$; `Rage` spell vs equipment rage).
7. **On-Death / Expiration / Transformation Behavior:**
   - Death damage, radius, delay, and knockback/freeze (`Balloon`, `RocketBalloon`, `DragonRider`, `BattleBlimp`, `StoneSlammer`, `Golem`, `Golemite`, `LavaHound`, `IceGolem`, `IceHound`, `SuperMiner`, `ElectroDragon`, `SuperValkyrie`, `BombTower`, `FireHeart`, `GuardianLogger`, `GuardianLongshot`, `GuardianSmasher`).
   - Death split/spawns (`Golem` -> `Golemite`, `LavaHound` -> `LavaPup`, `IceHound` -> `IcePup`, `SuperHogRider` -> `Hog` + `Rider`, `MeteorGolem` -> `Meteormite`, `Yeti`/`SuperYeti` -> `Yetimite`).
   - Lifetime expiration (`Clone`, `SkeletonSpell`, `BatSpell`, `Furnace`, `SiegeBarracks`, `TroopLauncher`, `Totem`, `Druid` -> `DruidBear` transformation after 30s or on death).
8. **Simulation Engine Gap Analysis (`sim.rs` Action Items):**
   - Explicitly list every difference between the verified video/CSV behavior and the pre-filled "Current `coc-engine` Implementation" block in the document so the implementation engineer can turn each bullet directly into a Rust unit test and code fix.
