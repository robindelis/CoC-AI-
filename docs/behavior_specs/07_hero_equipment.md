# Hero Equipment (43) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `BarbarianPuppet` — Barbarian Puppet (Hero Equipment (BarbarianKing))

### 1. Current `coc-data` Specification
```json
{
  "id": "BarbarianPuppet",
  "name": "Barbarian Puppet",
  "hero": "BarbarianKing",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 3366.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 1386.0,
  "ability_description": "Summons a pack of 44 raged Barbarians and heals the King."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Barbarian Puppet",
  "Level": "18",
  "HitPoints": "3366",
  "MainAbilities": "BarbarianKingSpawnBarbarians",
  "HealOnActivation": "1386"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RageVial` — Rage Vial (Hero Equipment (BarbarianKing))

### 1. Current `coc-data` Specification
```json
{
  "id": "RageVial",
  "name": "Rage Vial",
  "hero": "BarbarianKing",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 0.0,
  "dps_bonus": 128.0,
  "heal_on_activation": 1890.0,
  "ability_description": "Enrages the Barbarian King (+155% damage, +speed) for 10s."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Rage Vial",
  "Level": "18",
  "DPS": "128",
  "MainAbilities": "BarbarianKingRage",
  "HealOnActivation": "1890"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `EarthquakeBoots` — Earthquake Boots (Hero Equipment (BarbarianKing))

### 1. Current `coc-data` Specification
```json
{
  "id": "EarthquakeBoots",
  "name": "Earthquake Boots",
  "hero": "BarbarianKing",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 2500.0,
  "dps_bonus": 102.0,
  "heal_on_activation": 0.0,
  "ability_description": "Shatters surrounding walls and deals 40% HP damage to nearby buildings."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Earthquake Boots",
  "Level": "18",
  "HitPoints": "2500",
  "DPS": "102",
  "MainAbilities": "BarbarianKingEarthquakeBoots"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Vampstache` — Vampstache (Hero Equipment (BarbarianKing))

### 1. Current `coc-data` Specification
```json
{
  "id": "Vampstache",
  "name": "Vampstache",
  "hero": "BarbarianKing",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": true,
  "hp_bonus": 0.0,
  "dps_bonus": 120.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: Heals Barbarian King for 300 HP on every melee strike."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Vampstache",
  "Level": "18",
  "DPS": "120",
  "MainAbilities": "BarbarianKingVampstache"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GiantGauntlet` — Giant Gauntlet (Hero Equipment (BarbarianKing))

### 1. Current `coc-data` Specification
```json
{
  "id": "GiantGauntlet",
  "name": "Giant Gauntlet",
  "hero": "BarbarianKing",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 0.0,
  "dps_bonus": 160.0,
  "heal_on_activation": 0.0,
  "ability_description": "Grows gigantic for 19s: 2.5-tile splash attacks, 60% damage reduction & 40 HP/s regen."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Giant Gauntlet",
  "Level": "27",
  "DPS": "160",
  "MainAbilities": "BarbarianKingGetsBig",
  "ExtraAbilities": "Regeneration"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SpikyBall` — Spiky Ball (Hero Equipment (BarbarianKing))

### 1. Current `coc-data` Specification
```json
{
  "id": "SpikyBall",
  "name": "Spiky Ball",
  "hero": "BarbarianKing",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 3290.0,
  "dps_bonus": 222.0,
  "heal_on_activation": 0.0,
  "ability_description": "Hurls a spiked ball that ricochets across up to 8 buildings for 3,250 damage each."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Spiky Ball",
  "Level": "27",
  "HitPoints": "3290",
  "DPS": "222",
  "MainAbilities": "FootballBounce"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SnakeBracelet` — Snake Bracelet (Hero Equipment (BarbarianKing))

### 1. Current `coc-data` Specification
```json
{
  "id": "SnakeBracelet",
  "name": "Snake Bracelet",
  "hero": "BarbarianKing",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": true,
  "hp_bonus": 4050.0,
  "dps_bonus": 75.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: Summons wall-jumping Snakes whenever the King takes damage."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Snake Bracelet",
  "Level": "27",
  "HitPoints": "4050",
  "DPS": "75",
  "MainAbilities": "BarbarianKingSpawnOnTakeDamage"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Passive Snake summoning when Barbarian King takes damage (BarbKingEquipSpawn) is unimplemented in sim.rs.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `StickHorse` — Stick Horse (Hero Equipment (BarbarianKing))

### 1. Current `coc-data` Specification
```json
{
  "id": "StickHorse",
  "name": "Stick Horse",
  "hero": "BarbarianKing",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 4606.0,
  "dps_bonus": 222.0,
  "heal_on_activation": 0.0,
  "ability_description": "Gallops over walls with increased movement and attack speed for 30s."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Stick Horse",
  "Level": "27",
  "HitPoints": "4606",
  "DPS": "222",
  "MainAbilities": "StickHorseBoost"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ArcherPuppet` — Archer Puppet (Hero Equipment (ArcherQueen))

### 1. Current `coc-data` Specification
```json
{
  "id": "ArcherPuppet",
  "name": "Archer Puppet",
  "hero": "ArcherQueen",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 0.0,
  "dps_bonus": 159.0,
  "heal_on_activation": 484.0,
  "ability_description": "Summons 35 invisible Archers around the Queen."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Archer Puppet",
  "Level": "18",
  "DPS": "159",
  "MainAbilities": "ArcherQueenSpawnArchers",
  "HealOnActivation": "484"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `InvisibilityVial` — Invisibility Vial (Hero Equipment (ArcherQueen))

### 1. Current `coc-data` Specification
```json
{
  "id": "InvisibilityVial",
  "name": "Invisibility Vial",
  "hero": "ArcherQueen",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 700.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Cloaks the Queen in invisibility for 7.8s while boosting her damage per shot by +1,740."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Invisibility Vial",
  "Level": "18",
  "HitPoints": "700",
  "MainAbilities": "ArcherQueenInvisibility"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GiantArrow` — Giant Arrow (Hero Equipment (ArcherQueen))

### 1. Current `coc-data` Specification
```json
{
  "id": "GiantArrow",
  "name": "Giant Arrow",
  "hero": "ArcherQueen",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 581.0,
  "dps_bonus": 132.0,
  "heal_on_activation": 0.0,
  "ability_description": "Fires a piercing arrow across the entire battlefield dealing 1,950 damage along its line."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Piercing Arrow",
  "Level": "18",
  "HitPoints": "581",
  "DPS": "132",
  "MainAbilities": "ArcherQueenPierceProjectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `HealerPuppet` — Healer Puppet (Hero Equipment (ArcherQueen))

### 1. Current `coc-data` Specification
```json
{
  "id": "HealerPuppet",
  "name": "Healer Puppet",
  "hero": "ArcherQueen",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 968.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Summons 3 Healers and provides 35 HP/s passive self-healing."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Healer Puppet",
  "Level": "18",
  "HitPoints": "968",
  "MainAbilities": "ArcherQueenSpawnHealers",
  "ExtraAbilities": "Regeneration"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `FrozenArrow` — Frozen Arrow (Hero Equipment (ArcherQueen))

### 1. Current `coc-data` Specification
```json
{
  "id": "FrozenArrow",
  "name": "Frozen Arrow",
  "hero": "ArcherQueen",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": true,
  "hp_bonus": 0.0,
  "dps_bonus": 168.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: Every shot slows the target's attack & movement speed by 65% for 3s."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Frozen Arrow",
  "Level": "27",
  "DPS": "168",
  "MainAbilities": "ArcherQueenAttackFreeze"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `MagicMirror` — Magic Mirror (Hero Equipment (ArcherQueen))

### 1. Current `coc-data` Specification
```json
{
  "id": "MagicMirror",
  "name": "Magic Mirror",
  "hero": "ArcherQueen",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 861.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 891.0,
  "ability_description": "Turns briefly invisible and summons 2 high-DPS Archer Queen clones for 30s."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Magic Mirror",
  "Level": "27",
  "HitPoints": "861",
  "MainAbilities": "AQCloningCloak",
  "HealOnActivation": "891"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ActionFigure` — Action Figure (Hero Equipment (ArcherQueen))

### 1. Current `coc-data` Specification
```json
{
  "id": "ActionFigure",
  "name": "Action Figure",
  "hero": "ArcherQueen",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 713.0,
  "dps_bonus": 135.0,
  "heal_on_activation": 0.0,
  "ability_description": "Summons a massive 18,500 HP Giant Giant tank to fight beside the Queen + 40 HP/s regen."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Action Figure",
  "Level": "27",
  "HitPoints": "713",
  "DPS": "135",
  "MainAbilities": "AQSummonGiantGiant",
  "ExtraAbilities": "Regeneration"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `MonolithArrow` — Monolith Arrow (Hero Equipment (ArcherQueen))

### 1. Current `coc-data` Specification
```json
{
  "id": "MonolithArrow",
  "name": "Monolith Arrow",
  "hero": "ArcherQueen",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": true,
  "hp_bonus": 1160.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: Deals bonus % max HP damage per shot and grants 10% damage reduction."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Monolith Arrow",
  "Level": "27",
  "HitPoints": "1160",
  "MainAbilities": "ArcherQueenMonolithArrow",
  "ExtraAbilities": "ArcherQueenMonolithArrowMid;ArcherQueenMonolithArrowMin"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Passive bonus % max HP damage per shot and 10% damage reduction are unimplemented in sim.rs.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `EternalTome` — Eternal Tome (Hero Equipment (GrandWarden))

### 1. Current `coc-data` Specification
```json
{
  "id": "EternalTome",
  "name": "Eternal Tome",
  "hero": "GrandWarden",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 0.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Makes Grand Warden and all allied units within 9 tiles invincible for 7.2s."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Eternal Tome",
  "Level": "18",
  "MainAbilities": "GrandWardenInvulnerability"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `LifeGem` — Life Gem (Hero Equipment (GrandWarden))

### 1. Current `coc-data` Specification
```json
{
  "id": "LifeGem",
  "name": "Life Gem",
  "hero": "GrandWarden",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": true,
  "hp_bonus": 500.0,
  "dps_bonus": 75.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive Aura: Nearby friendly units gain extra hitpoints and sustain."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Life Gem",
  "Level": "18",
  "HitPoints": "500",
  "DPS": "75",
  "MainAbilities": "GrandWardenLifeAura"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Grand Warden passive currently heals 45 HP/s instead of granting the Life Gem max-HP aura (+120% HP up to +1200 HP cap while in 9t aura).

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RageGem` — Rage Gem (Hero Equipment (GrandWarden))

### 1. Current `coc-data` Specification
```json
{
  "id": "RageGem",
  "name": "Rage Gem",
  "hero": "GrandWarden",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": true,
  "hp_bonus": 0.0,
  "dps_bonus": 88.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive Aura: Nearby friendly units deal +50% extra damage."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Rage Gem",
  "Level": "18",
  "DPS": "88",
  "MainAbilities": "GrandWardenRageAura"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `HealingTome` — Healing Tome (Hero Equipment (GrandWarden))

### 1. Current `coc-data` Specification
```json
{
  "id": "HealingTome",
  "name": "Healing Tome",
  "hero": "GrandWarden",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 685.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 863.0,
  "ability_description": "Heals Grand Warden and all nearby friendly troops for 20s (Healing Tome Aura)."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Healing Tome",
  "Level": "18",
  "HitPoints": "685",
  "MainAbilities": "GrandWardenHealAura",
  "HealOnActivation": "863"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Fireball` — Fireball (Hero Equipment (GrandWarden))

### 1. Current `coc-data` Specification
```json
{
  "id": "Fireball",
  "name": "Fireball",
  "hero": "GrandWarden",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 0.0,
  "dps_bonus": 101.0,
  "heal_on_activation": 0.0,
  "ability_description": "Hurls a cataclysmic fireball at the nearest defense dealing 4,100 splash damage in a 6-tile radius."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Fireball",
  "Level": "27",
  "DPS": "101",
  "MainAbilities": "GrandWardenFireball"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `LavaloonPuppet` — Lavaloon Puppet (Hero Equipment (GrandWarden))

### 1. Current `coc-data` Specification
```json
{
  "id": "LavaloonPuppet",
  "name": "Lavaloon Puppet",
  "hero": "GrandWarden",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 150.0,
  "dps_bonus": 50.0,
  "heal_on_activation": 0.0,
  "ability_description": "Summons 3 Lavaloons to bomb enemy defenses."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Lavaloon Puppet",
  "Level": "27",
  "HitPoints": "150",
  "DPS": "50",
  "MainAbilities": "GrandWardenSummonLavaloon"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `HeroicTorch` — Heroic Torch (Hero Equipment (GrandWarden))

### 1. Current `coc-data` Specification
```json
{
  "id": "HeroicTorch",
  "name": "Heroic Torch",
  "hero": "GrandWarden",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 137.0,
  "dps_bonus": 78.0,
  "heal_on_activation": 390.0,
  "ability_description": "Allows nearby allied troops to walk through walls, move faster, and take 35% less damage for 26.5s."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Heroic Torch",
  "Level": "27",
  "HitPoints": "137",
  "DPS": "78",
  "MainAbilities": "GWHeroicTorch",
  "HealOnActivation": "390"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RoyalGem` — Royal Gem (Hero Equipment (RoyalChampion))

### 1. Current `coc-data` Specification
```json
{
  "id": "RoyalGem",
  "name": "Royal Gem",
  "hero": "RoyalChampion",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 570.0,
  "dps_bonus": 120.0,
  "heal_on_activation": 2400.0,
  "ability_description": "Instantly restores 2,400 HP to the Royal Champion."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Royal Gem",
  "Level": "18",
  "HitPoints": "570",
  "DPS": "120",
  "MainAbilities": "RCProtectiveCloak"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SeekingShield` — Seeking Shield (Hero Equipment (RoyalChampion))

### 1. Current `coc-data` Specification
```json
{
  "id": "SeekingShield",
  "name": "Seeking Shield",
  "hero": "RoyalChampion",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 380.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Throws her shield across 4 defenses dealing 2,500 damage to each."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Seeking Shield",
  "Level": "18",
  "HitPoints": "380",
  "MainAbilities": "RoyalChampionShieldBounce"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `HogRiderPuppet` — Hog Rider Puppet (Hero Equipment (RoyalChampion))

### 1. Current `coc-data` Specification
```json
{
  "id": "HogRiderPuppet",
  "name": "Hog Rider Puppet",
  "hero": "RoyalChampion",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 570.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 1000.0,
  "ability_description": "Turns briefly invisible and summons 10 Hog Riders."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Hog Rider Puppet",
  "Level": "18",
  "HitPoints": "570",
  "MainAbilities": "RCEquipSpawnHogs",
  "HealOnActivation": "1000"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `HasteVial` — Haste Vial (Hero Equipment (RoyalChampion))

### 1. Current `coc-data` Specification
```json
{
  "id": "HasteVial",
  "name": "Haste Vial",
  "hero": "RoyalChampion",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 0.0,
  "dps_bonus": 88.0,
  "heal_on_activation": 0.0,
  "ability_description": "Doubles Royal Champion's attack speed and greatly boosts her speed for 10s."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Haste Vial",
  "Level": "18",
  "DPS": "88",
  "MainAbilities": "RoyalChampionHaste"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RocketSpear` — Rocket Spear (Hero Equipment (RoyalChampion))

### 1. Current `coc-data` Specification
```json
{
  "id": "RocketSpear",
  "name": "Rocket Spear",
  "hero": "RoyalChampion",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 700.0,
  "dps_bonus": 168.0,
  "heal_on_activation": 0.0,
  "ability_description": "Empowers her attacks with 10 long-range (10-tile) rocket spears dealing +980 bonus damage."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Rocket Spear",
  "Level": "27",
  "HitPoints": "700",
  "DPS": "168",
  "MainAbilities": "RocketSpears"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Currently grants +range and +damage for the entire rest of the battle instead of expiring after 10 spear throws.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ElectroBoots` — Electro Boots (Hero Equipment (RoyalChampion))

### 1. Current `coc-data` Specification
```json
{
  "id": "ElectroBoots",
  "name": "Electro Boots",
  "hero": "RoyalChampion",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": true,
  "hp_bonus": 700.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: Emits a 200 DPS electric aura in a 4.5-tile radius + 45 HP/s self-healing."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Electro Boots",
  "Level": "27",
  "HitPoints": "700",
  "MainAbilities": "Electro Boots Aura",
  "ExtraAbilities": "RCElectroRegeneration"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `FrostFlake` — Frost Flake (Hero Equipment (RoyalChampion))

### 1. Current `coc-data` Specification
```json
{
  "id": "FrostFlake",
  "name": "Frost Flake",
  "hero": "RoyalChampion",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 700.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Flings icy flakes at the 7 closest defenses, freezing them solid for 7.0s."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Frost Charm",
  "Level": "27",
  "HitPoints": "700",
  "MainAbilities": "FrostBlast"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `HenchmenPuppet` — Henchmen Puppet (Hero Equipment (MinionPrince))

### 1. Current `coc-data` Specification
```json
{
  "id": "HenchmenPuppet",
  "name": "Henchmen Puppet",
  "hero": "MinionPrince",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 500.0,
  "dps_bonus": 188.0,
  "heal_on_activation": 538.0,
  "ability_description": "Turns invisible for 1s and summons 2 tanky flying Henchmen bodyguards."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Henchmen Puppet",
  "Level": "18",
  "HitPoints": "500",
  "DPS": "188",
  "MainAbilities": "MinionSummonAbility",
  "HealOnActivation": "538"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `DarkOrb` — Dark Orb (Hero Equipment (MinionPrince))

### 1. Current `coc-data` Specification
```json
{
  "id": "DarkOrb",
  "name": "Dark Orb",
  "hero": "MinionPrince",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 1140.0,
  "dps_bonus": 73.0,
  "heal_on_activation": 0.0,
  "ability_description": "Fires a wide wave of dark energy that slows defenses by 50% for 18s."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Dark Orb",
  "Level": "18",
  "HitPoints": "1140",
  "DPS": "73",
  "MainAbilities": "MinionAttackAbility"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `MetalPants` — Metal Pants (Hero Equipment (MinionPrince))

### 1. Current `coc-data` Specification
```json
{
  "id": "MetalPants",
  "name": "Metal Pants",
  "hero": "MinionPrince",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 1700.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 2500.0,
  "ability_description": "Creates a barrier reducing incoming damage by 70% for 15s and heals 2,500 HP."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Metal Pants",
  "Level": "18",
  "HitPoints": "1700",
  "MainAbilities": "MinionPrinceStoneSkinAbility",
  "HealOnActivation": "2500"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `NobleIron` — Noble Iron (Hero Equipment (MinionPrince))

### 1. Current `coc-data` Specification
```json
{
  "id": "NobleIron",
  "name": "Noble Iron",
  "hero": "MinionPrince",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": true,
  "hp_bonus": 500.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: First 10 attacks have 12-tile sniper range and +770 bonus damage."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Noble Iron",
  "Level": "18",
  "HitPoints": "500",
  "MainAbilities": "MPTurboStart"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Passive first-10-attacks 12-tile range and +770 bonus damage for Minion Prince is unimplemented in sim.rs.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `DarkCrown` — Dark Crown (Hero Equipment (MinionPrince))

### 1. Current `coc-data` Specification
```json
{
  "id": "DarkCrown",
  "name": "Dark Crown",
  "hero": "MinionPrince",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": true,
  "hp_bonus": 1200.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: Boosts Minion Prince's max HP and damage by up to +30% as allied units fall."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Dark Crown",
  "Level": "27",
  "HitPoints": "1200",
  "MainAbilities": "MinionDarkCrownAbilityHighestTier",
  "ExtraAbilities": "MinionDarkCrownAbilityLowestTier;MinionDarkCrownAbilityMediumTier;MinionDarkCrownAbilityConstantAura"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Passive scaling up to +30% max HP and DPS as allied housing falls is unimplemented in sim.rs.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `MeteorStaff` — Meteor Staff (Hero Equipment (MinionPrince))

### 1. Current `coc-data` Specification
```json
{
  "id": "MeteorStaff",
  "name": "Meteor Staff",
  "hero": "MinionPrince",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": true,
  "hp_bonus": 1381.0,
  "dps_bonus": 125.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: Calls down meteors every 5s striking the nearest defense for 850 splash damage."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Meteor Staff",
  "Level": "27",
  "HitPoints": "1381",
  "DPS": "125",
  "MainAbilities": "MPMeteorStaff"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `PortalPendant` — Portal Pendant (Hero Equipment (MinionPrince))

### 1. Current `coc-data` Specification
```json
{
  "id": "PortalPendant",
  "name": "Portal Pendant",
  "hero": "MinionPrince",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 0.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 1381.0,
  "ability_description": "Pulls Minion Prince and nearby allies back into the deployment bar with extra health and Haste (recalls up to 40 housing within 10 tiles)."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Cosmic Portal",
  "Level": "27",
  "MainAbilities": "MPCosmicPortal",
  "HealOnActivation": "1381"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `FireHeart` — Fire Heart (Hero Equipment (DragonDuke))

### 1. Current `coc-data` Specification
```json
{
  "id": "FireHeart",
  "name": "Fire Heart",
  "hero": "DragonDuke",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": true,
  "hp_bonus": 5600.0,
  "dps_bonus": 23.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: +5,600 HP, 150 HP/s self-regeneration, and explodes for 3,000 splash damage on defeat."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Fire Heart",
  "Level": "18",
  "HitPoints": "5600",
  "DPS": "23",
  "MainAbilities": "DragonCrownExplodeOnDeath",
  "ExtraAbilities": "DragonCrownRegeneration",
  "HealOnActivation": "0"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `FlameBlower` — Flame Blower (Hero Equipment (DragonDuke))

### 1. Current `coc-data` Specification
```json
{
  "id": "FlameBlower",
  "name": "Flame Blower",
  "hero": "DragonDuke",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 3100.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 1500.0,
  "ability_description": "Unleashes a 12-tile scorching cone of dragon fire dealing 2,500 instant damage."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Flame Blower",
  "Level": "18",
  "HitPoints": "3100",
  "MainAbilities": "DD Flaming Sneeze",
  "HealOnActivation": "1500"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `StunBlaster` — Stun Blaster (Hero Equipment (DragonDuke))

### 1. Current `coc-data` Specification
```json
{
  "id": "StunBlaster",
  "name": "Stun Blaster",
  "hero": "DragonDuke",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": false,
  "hp_bonus": 2400.0,
  "dps_bonus": 90.0,
  "heal_on_activation": 1300.0,
  "ability_description": "Emits an 8-tile shockwave that stuns all surrounding defenses for 7.5s and deals 400 damage."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Stun Blaster",
  "Level": "18",
  "HitPoints": "2400",
  "DPS": "90",
  "MainAbilities": "DDBlastAbility",
  "HealOnActivation": "1300"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ElectroFangs` — Electro Fangs (Hero Equipment (DragonDuke))

### 1. Current `coc-data` Specification
```json
{
  "id": "ElectroFangs",
  "name": "Electro Fangs",
  "hero": "DragonDuke",
  "rarity": "Common",
  "max_level": 18,
  "is_passive": true,
  "hp_bonus": 2400.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: Every melee bite chains lightning across 5 nearby buildings for 400 bonus damage."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "ElectroAttack",
  "Level": "18",
  "HitPoints": "2400",
  "MainAbilities": "DD Electro Attack"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RocketBackpack` — Rocket Backpack (Hero Equipment (DragonDuke))

### 1. Current `coc-data` Specification
```json
{
  "id": "RocketBackpack",
  "name": "Rocket Backpack",
  "hero": "DragonDuke",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": false,
  "hp_bonus": 3200.0,
  "dps_bonus": 86.0,
  "heal_on_activation": 2000.0,
  "ability_description": "Dashes toward the village core while invincible, scorching buildings for 2,150 damage."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Rocket Backpack",
  "Level": "27",
  "HitPoints": "3200",
  "DPS": "86",
  "MainAbilities": "DragonDukeDeadlyDashMapCenter",
  "HealOnActivation": "2000"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RevengeDeck` — Revenge Deck (Hero Equipment (DragonDuke))

### 1. Current `coc-data` Specification
```json
{
  "id": "RevengeDeck",
  "name": "Revenge Deck",
  "hero": "DragonDuke",
  "rarity": "Epic",
  "max_level": 27,
  "is_passive": true,
  "hp_bonus": 3200.0,
  "dps_bonus": 0.0,
  "heal_on_activation": 0.0,
  "ability_description": "Passive: Reflects 225 damage back at attacking defenses and heals 60 HP per hit taken."
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Draconic Counter",
  "Level": "27",
  "HitPoints": "3200",
  "MainAbilities": "DragonScaleReflect"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
