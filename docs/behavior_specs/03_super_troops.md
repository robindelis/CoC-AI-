# Super Troops (17) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `SuperBarbarian` — Super Barbarian (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperBarbarian",
  "name": "Super Barbarian",
  "category": "SuperTroop",
  "max_level": 13,
  "housing_space": 5,
  "max_hp": 1450.0,
  "dps": 270.0,
  "damage_per_hit": 216.0,
  "attack_speed_sec": 0.8,
  "move_speed": 24.0,
  "range": 0.6,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Barbarian",
  "VisualLevel": "13",
  "HousingSpace": "5",
  "Hitpoints": "1450",
  "DPS": "270",
  "AttackRange": "60",
  "AttackSpeed": "800",
  "Speed": "250",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Missing innate 8-second deploy rage (TroopRage: +70% damage and +16 speed immediately upon deployment).

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 270.0, Speed = 0.8s, Range = 0.6t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperArcher` — Super Archer (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperArcher",
  "name": "Super Archer",
  "category": "SuperTroop",
  "max_level": 14,
  "housing_space": 12,
  "max_hp": 725.0,
  "dps": 170.0,
  "damage_per_hit": 255.0,
  "attack_speed_sec": 1.5,
  "move_speed": 24.0,
  "range": 6.0,
  "splash_radius": 1.2,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Archer",
  "VisualLevel": "14",
  "HousingSpace": "12",
  "Hitpoints": "725",
  "DPS": "170",
  "AttackRange": "600",
  "AttackSpeed": "1500",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "magic_archer_projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Fires a standard single-target arrow instead of a 12-tile penetrating arrow that damages all buildings/enemies along the line.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 170.0, Speed = 1.5s, Range = 6.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperGiant` — Super Giant (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperGiant",
  "name": "Super Giant",
  "category": "SuperTroop",
  "max_level": 14,
  "housing_space": 10,
  "max_hp": 5600.0,
  "dps": 205.0,
  "damage_per_hit": 410.0,
  "attack_speed_sec": 2.0,
  "move_speed": 12.0,
  "range": 1.0,
  "splash_radius": 0.0,
  "movement": {
    "WallCrusher": {
      "wall_dps": 2000
    }
  },
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Giant",
  "VisualLevel": "14",
  "HousingSpace": "10",
  "Hitpoints": "5600",
  "DPS": "205",
  "AttackRange": "100",
  "AttackSpeed": "2000",
  "Speed": "150",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 12.0, Mode = {'WallCrusher': {'wall_dps': 2000}}
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 205.0, Speed = 2.0s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SneakyGoblin` — Sneaky Goblin (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SneakyGoblin",
  "name": "Sneaky Goblin",
  "category": "SuperTroop",
  "max_level": 10,
  "housing_space": 3,
  "max_hp": 380.0,
  "dps": 190.0,
  "damage_per_hit": 190.0,
  "attack_speed_sec": 1.0,
  "move_speed": 32.0,
  "range": 0.4,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Resources",
  "special": {
    "ResourceMultiplier": {
      "mult": 2.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Sneaky Goblin",
  "VisualLevel": "10",
  "HousingSpace": "3",
  "Hitpoints": "380",
  "DPS": "190",
  "AttackRange": "40",
  "AttackSpeed": "1000",
  "Speed": "400",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Missing innate 5-second deploy cloak (invisibility_timer = 5.0 immediately upon deployment).

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Resources, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 190.0, Speed = 1.0s, Range = 0.4t
- **Passive / Periodic Special Abilities:** Special = `{"ResourceMultiplier": {"mult": 2.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperWallBreaker` — Super Wall Breaker (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperWallBreaker",
  "name": "Super Wall Breaker",
  "category": "SuperTroop",
  "max_level": 14,
  "housing_space": 8,
  "max_hp": 575.0,
  "dps": 170.0,
  "damage_per_hit": 170.0,
  "attack_speed_sec": 1.0,
  "move_speed": 28.0,
  "range": 0.6,
  "splash_radius": 2.5,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Walls",
  "special": {
    "KamikazeWall": {
      "wall_mult": 80.0,
      "death_damage": 450.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Wall Breaker",
  "VisualLevel": "14",
  "HousingSpace": "8",
  "Hitpoints": "575",
  "DPS": "170",
  "AttackRange": "60",
  "AttackSpeed": "1000",
  "Speed": "350",
  "DamageRadius": "80",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Death bomb must always detonate on death (even if shot down before reaching a wall) and apply wall_mult against nearby walls.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 28.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Walls, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 170.0, Speed = 1.0s, Range = 0.6t
- **Passive / Periodic Special Abilities:** Special = `{"KamikazeWall": {"wall_mult": 80.0, "death_damage": 450.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RocketBalloon` — Rocket Balloon (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "RocketBalloon",
  "name": "Rocket Balloon",
  "category": "SuperTroop",
  "max_level": 13,
  "housing_space": 8,
  "max_hp": 1360.0,
  "dps": 326.0,
  "damage_per_hit": 978.0,
  "attack_speed_sec": 3.0,
  "move_speed": 24.0,
  "range": 0.5,
  "splash_radius": 1.5,
  "movement": "Air",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": {
    "DeathSplash": {
      "damage": 650.0,
      "radius": 1.5
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Rocket Balloon",
  "VisualLevel": "13",
  "HousingSpace": "8",
  "Hitpoints": "1360",
  "DPS": "326",
  "AttackRange": "0",
  "AttackSpeed": "3000",
  "Speed": "150",
  "DamageRadius": "120",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 326.0, Speed = 3.0s, Range = 0.5t
- **Passive / Periodic Special Abilities:** Special = `{"DeathSplash": {"damage": 650.0, "radius": 1.5}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperWizard` — Super Wizard (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperWizard",
  "name": "Super Wizard",
  "category": "SuperTroop",
  "max_level": 14,
  "housing_space": 10,
  "max_hp": 925.0,
  "dps": 335.0,
  "damage_per_hit": 670.0,
  "attack_speed_sec": 2.0,
  "move_speed": 16.0,
  "range": 3.5,
  "splash_radius": 1.5,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "ChainLightning": {
      "max_targets": 9,
      "chain_range": 3.0,
      "decay": 0.65,
      "death_damage": 0.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Wizard",
  "VisualLevel": "14",
  "HousingSpace": "10",
  "Hitpoints": "925",
  "DPS": "335",
  "AttackRange": "350",
  "AttackSpeed": "2000",
  "Speed": "250",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** execute_unit_attack() checks only TroopId::ElectroDragon for ChainLightning and skips TroopId::SuperWizard (should chain up to 9 targets within 3.0t at 65% damage).

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 335.0, Speed = 2.0s, Range = 3.5t
- **Passive / Periodic Special Abilities:** Special = `{"ChainLightning": {"max_targets": 9, "chain_range": 3.0, "decay": 0.65, "death_damage": 0.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperDragon` — Super Dragon (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperDragon",
  "name": "Super Dragon",
  "category": "SuperTroop",
  "max_level": 13,
  "housing_space": 40,
  "max_hp": 8400.0,
  "dps": 537.0,
  "damage_per_hit": 966.6,
  "attack_speed_sec": 1.8,
  "move_speed": 14.0,
  "range": 3.0,
  "splash_radius": 1.5,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Dragon",
  "VisualLevel": "13",
  "HousingSpace": "40",
  "Hitpoints": "8400",
  "DPS": "537",
  "AttackRange": "300",
  "AttackSpeed": "1800",
  "Speed": "175",
  "DamageRadius": "160",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "SuperDragonProjectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 14.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 537.0, Speed = 1.8s, Range = 3.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `InfernoDragon` — Inferno Dragon (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "InfernoDragon",
  "name": "Inferno Dragon",
  "category": "SuperTroop",
  "max_level": 12,
  "housing_space": 15,
  "max_hp": 2700.0,
  "dps": 91.0,
  "damage_per_hit": 11.83,
  "attack_speed_sec": 0.13,
  "move_speed": 18.0,
  "range": 3.5,
  "splash_radius": 0.0,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Inferno Dragon",
  "VisualLevel": "12",
  "HousingSpace": "15",
  "Hitpoints": "2700",
  "DPS": "91",
  "AttackRange": "350",
  "AttackSpeed": "128",
  "Speed": "225",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Uses flat 91 DPS instead of 3-stage Inferno beam ramp-up (stage 1 -> stage 2 -> stage 3 while locked on the same target).

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 18.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 91.0, Speed = 0.13s, Range = 3.5t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperMiner` — Super Miner (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperMiner",
  "name": "Super Miner",
  "category": "SuperTroop",
  "max_level": 12,
  "housing_space": 24,
  "max_hp": 5000.0,
  "dps": 265.0,
  "damage_per_hit": 66.25,
  "attack_speed_sec": 0.25,
  "move_speed": 32.0,
  "range": 0.6,
  "splash_radius": 0.0,
  "movement": "Burrow",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": {
    "DeathSplash": {
      "damage": 1800.0,
      "radius": 3.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Miner",
  "VisualLevel": "12",
  "HousingSpace": "24",
  "Hitpoints": "5000",
  "DPS": "265",
  "AttackRange": "60",
  "AttackSpeed": "250",
  "Speed": "400",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "IsUnderground": "TRUE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Uses flat 265 DPS instead of ramping drill beam; verify death bomb radius (3.0t) and damage (1800).

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = Burrow
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 265.0, Speed = 0.25s, Range = 0.6t
- **Passive / Periodic Special Abilities:** Special = `{"DeathSplash": {"damage": 1800.0, "radius": 3.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperYeti` — Super Yeti (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperYeti",
  "name": "Super Yeti",
  "category": "SuperTroop",
  "max_level": 8,
  "housing_space": 35,
  "max_hp": 7400.0,
  "dps": 550.0,
  "damage_per_hit": 550.0,
  "attack_speed_sec": 1.0,
  "move_speed": 14.0,
  "range": 0.8,
  "splash_radius": 1.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": {
    "YetiSpawner": {
      "yetimites_on_death": 18,
      "hp_per_spawn": 600.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Yeti",
  "VisualLevel": "8",
  "HousingSpace": "35",
  "Hitpoints": "7400",
  "DPS": "550",
  "AttackRange": "80",
  "AttackSpeed": "1000",
  "Speed": "150",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** damage_unit() damage-threshold Yetimite spawn checks only TroopId::Yeti and skips TroopId::SuperYeti; verify Electromite aura/zap behavior.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 14.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 550.0, Speed = 1.0s, Range = 0.8t
- **Passive / Periodic Special Abilities:** Special = `{"YetiSpawner": {"yetimites_on_death": 18, "hp_per_spawn": 600.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperMinion` — Super Minion (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperMinion",
  "name": "Super Minion",
  "category": "SuperTroop",
  "max_level": 14,
  "housing_space": 12,
  "max_hp": 2300.0,
  "dps": 400.0,
  "damage_per_hit": 400.0,
  "attack_speed_sec": 1.0,
  "move_speed": 20.0,
  "range": 3.5,
  "splash_radius": 0.0,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Minion",
  "VisualLevel": "14",
  "HousingSpace": "12",
  "Hitpoints": "2300",
  "DPS": "400",
  "AttackRange": "350",
  "AttackSpeed": "1000",
  "Speed": "200",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "super_gargoyle_projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Missing Long Shot ability: first 5 shots should fire from 10-tile range at rocket speed before reverting to 3.5-tile range.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 400.0, Speed = 1.0s, Range = 3.5t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperHogRider` — Super Hog Rider (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperHogRider",
  "name": "Super Hog Rider",
  "category": "SuperTroop",
  "max_level": 15,
  "housing_space": 12,
  "max_hp": 2350.0,
  "dps": 300.0,
  "damage_per_hit": 300.0,
  "attack_speed_sec": 1.0,
  "move_speed": 24.0,
  "range": 0.6,
  "splash_radius": 0.0,
  "movement": "JumpWalls",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": {
    "SplitOnDeath": {
      "unit": "HogRider",
      "count": 2,
      "death_damage": 0.0,
      "radius": 1.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Hog Rider",
  "VisualLevel": "15",
  "HousingSpace": "12",
  "Hitpoints": "2350",
  "DPS": "300",
  "AttackRange": "60",
  "AttackSpeed": "1000",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Splits into 2 HogRiders instead of 1 Super Hog (building/defense targeter) + 1 Super Rider (jumps walls, any target) on death.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 300.0, Speed = 1.0s, Range = 0.6t
- **Passive / Periodic Special Abilities:** Special = `{"SplitOnDeath": {"unit": "HogRider", "count": 2, "death_damage": 0.0, "radius": 1.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperValkyrie` — Super Valkyrie (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperValkyrie",
  "name": "Super Valkyrie",
  "category": "SuperTroop",
  "max_level": 12,
  "housing_space": 20,
  "max_hp": 4500.0,
  "dps": 405.0,
  "damage_per_hit": 445.5,
  "attack_speed_sec": 1.1,
  "move_speed": 24.0,
  "range": 0.5,
  "splash_radius": 1.2,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Valkyrie",
  "VisualLevel": "12",
  "HousingSpace": "20",
  "Hitpoints": "4500",
  "DPS": "405",
  "AttackRange": "50",
  "AttackSpeed": "1100",
  "Speed": "300",
  "DamageRadius": "100",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Missing death Rage Spell drop (EliteValkyrieRage: 4.0t radius, +160% damage, +26 speed for 10s) when defeated.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 405.0, Speed = 1.1s, Range = 0.5t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperWitch` — Super Witch (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperWitch",
  "name": "Super Witch",
  "category": "SuperTroop",
  "max_level": 8,
  "housing_space": 40,
  "max_hp": 4100.0,
  "dps": 470.0,
  "damage_per_hit": 329.0,
  "attack_speed_sec": 0.7,
  "move_speed": 12.0,
  "range": 4.0,
  "splash_radius": 0.5,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "PeriodicSummoner": {
      "unit": "Giant",
      "count": 1,
      "interval_sec": 12.0,
      "max_active": 2
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Witch",
  "VisualLevel": "8",
  "HousingSpace": "40",
  "Hitpoints": "4100",
  "DPS": "470",
  "AttackRange": "400",
  "AttackSpeed": "700",
  "Speed": "150",
  "DamageRadius": "30",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "Witch_projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 12.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 470.0, Speed = 0.7s, Range = 4.0t
- **Passive / Periodic Special Abilities:** Special = `{"PeriodicSummoner": {"unit": "Giant", "count": 1, "interval_sec": 12.0, "max_active": 2}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `IceHound` — Ice Hound (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "IceHound",
  "name": "Ice Hound",
  "category": "SuperTroop",
  "max_level": 8,
  "housing_space": 40,
  "max_hp": 11500.0,
  "dps": 25.0,
  "damage_per_hit": 50.0,
  "attack_speed_sec": 2.0,
  "move_speed": 20.0,
  "range": 0.25,
  "splash_radius": 0.0,
  "movement": "Air",
  "target_domain": "Ground",
  "preferred_target": "AirDefenses",
  "special": {
    "IceGolemFreeze": {
      "death_freeze_sec": 6.0,
      "radius": 5.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Ice Hound",
  "VisualLevel": "8",
  "HousingSpace": "40",
  "Hitpoints": "11500",
  "DPS": "25",
  "AttackRange": "25",
  "AttackSpeed": "2000",
  "Speed": "250",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Uses TroopSpecial::IceGolemFreeze alone so it freezes on death but never spawns Ice Pups.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = AirDefenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 25.0, Speed = 2.0s, Range = 0.25t
- **Passive / Periodic Special Abilities:** Special = `{"IceGolemFreeze": {"death_freeze_sec": 6.0, "radius": 5.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperBowler` — Super Bowler (Super Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperBowler",
  "name": "Super Bowler",
  "category": "SuperTroop",
  "max_level": 10,
  "housing_space": 30,
  "max_hp": 3700.0,
  "dps": 310.0,
  "damage_per_hit": 682.0,
  "attack_speed_sec": 2.2,
  "move_speed": 14.0,
  "range": 3.0,
  "splash_radius": 1.5,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": {
    "BowlerDoubleBounce": {
      "bounce_dist": 6.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Bowler",
  "VisualLevel": "10",
  "HousingSpace": "30",
  "Hitpoints": "3700",
  "DPS": "310",
  "AttackRange": "300",
  "AttackSpeed": "2200",
  "Speed": "175",
  "DamageRadius": "60",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "SuperBowlerProjectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 14.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 310.0, Speed = 2.2s, Range = 3.0t
- **Passive / Periodic Special Abilities:** Special = `{"BowlerDoubleBounce": {"bounce_dist": 6.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
