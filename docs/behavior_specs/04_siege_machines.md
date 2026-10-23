# Siege Machines (9) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `WallWrecker` — Wall Wrecker (Siege Machine)

### 1. Current `coc-data` Specification
```json
{
  "id": "WallWrecker",
  "name": "Wall Wrecker",
  "category": "SiegeMachine",
  "max_level": 6,
  "housing_space": 1,
  "max_hp": 10000.0,
  "dps": 670.0,
  "damage_per_hit": 871.0,
  "attack_speed_sec": 1.3,
  "move_speed": 12.0,
  "range": 1.5,
  "splash_radius": 1.5,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "TownHall",
  "special": {
    "SiegeWallMultiplier": {
      "wall_mult": 10.0,
      "hp_decay_per_sec": 0.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Wall Wrecker",
  "VisualLevel": "6",
  "HousingSpace": "1",
  "Hitpoints": "10000",
  "DPS": "670",
  "AttackRange": "150",
  "AttackSpeed": "1300",
  "Speed": "150",
  "DamageRadius": "150",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Should suffer passive HP decay per second and automatically burst open to release Clan Castle troops upon reaching the Town Hall footprint.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 12.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = TownHall, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 670.0, Speed = 1.3s, Range = 1.5t
- **Passive / Periodic Special Abilities:** Special = `{"SiegeWallMultiplier": {"wall_mult": 10.0, "hp_decay_per_sec": 0.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `BattleBlimp` — Battle Blimp (Siege Machine)

### 1. Current `coc-data` Specification
```json
{
  "id": "BattleBlimp",
  "name": "Battle Blimp",
  "category": "SiegeMachine",
  "max_level": 6,
  "housing_space": 1,
  "max_hp": 5500.0,
  "dps": 300.0,
  "damage_per_hit": 450.0,
  "attack_speed_sec": 1.5,
  "move_speed": 18.0,
  "range": 1.5,
  "splash_radius": 1.5,
  "movement": "Air",
  "target_domain": "Ground",
  "preferred_target": "TownHall",
  "special": {
    "DeathSplash": {
      "damage": 1200.0,
      "radius": 2.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Battle Blimp",
  "VisualLevel": "6",
  "HousingSpace": "1",
  "Hitpoints": "5500",
  "DPS": "300",
  "AttackRange": "150",
  "AttackSpeed": "1500",
  "Speed": "225",
  "DamageRadius": "300",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "Siege Zeppelin Projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Should drop periodic bombs along its flight path, suffer passive HP decay, and burst open upon reaching the Town Hall footprint.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 18.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = TownHall, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 300.0, Speed = 1.5s, Range = 1.5t
- **Passive / Periodic Special Abilities:** Special = `{"DeathSplash": {"damage": 1200.0, "radius": 2.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `StoneSlammer` — Stone Slammer (Siege Machine)

### 1. Current `coc-data` Specification
```json
{
  "id": "StoneSlammer",
  "name": "Stone Slammer",
  "category": "SiegeMachine",
  "max_level": 6,
  "housing_space": 1,
  "max_hp": 7200.0,
  "dps": 820.0,
  "damage_per_hit": 2050.0,
  "attack_speed_sec": 2.5,
  "move_speed": 16.0,
  "range": 0.5,
  "splash_radius": 2.5,
  "movement": "Air",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": {
    "SiegeWallMultiplier": {
      "wall_mult": 25.0,
      "hp_decay_per_sec": 0.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Stone Slammer",
  "VisualLevel": "6",
  "HousingSpace": "1",
  "Hitpoints": "7200",
  "DPS": "820",
  "AttackRange": "0",
  "AttackSpeed": "2500",
  "Speed": "200",
  "DamageRadius": "100",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Should deal death splash damage when destroyed and suffer passive HP decay.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 820.0, Speed = 2.5s, Range = 0.5t
- **Passive / Periodic Special Abilities:** Special = `{"SiegeWallMultiplier": {"wall_mult": 25.0, "hp_decay_per_sec": 0.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SiegeBarracks` — Siege Barracks (Siege Machine)

### 1. Current `coc-data` Specification
```json
{
  "id": "SiegeBarracks",
  "name": "Siege Barracks",
  "category": "SiegeMachine",
  "max_level": 6,
  "housing_space": 1,
  "max_hp": 5100.0,
  "dps": 0.0,
  "damage_per_hit": 0.0,
  "attack_speed_sec": 0.8,
  "move_speed": 0.0,
  "range": 0.0,
  "splash_radius": 0.0,
  "movement": "Stationary",
  "target_domain": "None",
  "preferred_target": "Any",
  "special": {
    "SiegeSpawner": {
      "lifetime_sec": 30.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Siege Barracks",
  "VisualLevel": "6",
  "HousingSpace": "1",
  "Hitpoints": "5100",
  "DPS": "0",
  "AttackRange": "0",
  "AttackSpeed": "800",
  "Speed": "0",
  "DamageRadius": "0",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 0.0, Mode = Stationary
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = None
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 0.0, Speed = 0.8s, Range = 0.0t
- **Passive / Periodic Special Abilities:** Special = `{"SiegeSpawner": {"lifetime_sec": 30.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `LogLauncher` — Log Launcher (Siege Machine)

### 1. Current `coc-data` Specification
```json
{
  "id": "LogLauncher",
  "name": "Log Launcher",
  "category": "SiegeMachine",
  "max_level": 6,
  "housing_space": 1,
  "max_hp": 5800.0,
  "dps": 230.0,
  "damage_per_hit": 690.0,
  "attack_speed_sec": 3.0,
  "move_speed": 5.0,
  "range": 11.0,
  "splash_radius": 1.5,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "TownHall",
  "special": {
    "SiegeWallMultiplier": {
      "wall_mult": 4.0,
      "hp_decay_per_sec": 156.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Log Launcher",
  "VisualLevel": "6",
  "HousingSpace": "1",
  "Hitpoints": "5800",
  "DPS": "230",
  "AttackRange": "100",
  "AttackSpeed": "3000",
  "Speed": "70",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "RollingLog"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Logs should roll for 11 tiles as a PenetratingShot damaging all buildings and walls along the path (with 4x wall multiplier), plus point-blank crushing damage.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 5.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = TownHall, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 230.0, Speed = 3.0s, Range = 11.0t
- **Passive / Periodic Special Abilities:** Special = `{"SiegeWallMultiplier": {"wall_mult": 4.0, "hp_decay_per_sec": 156.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `FlameFlinger` — Flame Flinger (Siege Machine)

### 1. Current `coc-data` Specification
```json
{
  "id": "FlameFlinger",
  "name": "Flame Flinger",
  "category": "SiegeMachine",
  "max_level": 5,
  "housing_space": 1,
  "max_hp": 2100.0,
  "dps": 184.0,
  "damage_per_hit": 920.0,
  "attack_speed_sec": 5.0,
  "move_speed": 6.0,
  "range": 10.05,
  "splash_radius": 2.5,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": {
    "SiegeWallMultiplier": {
      "wall_mult": 2.0,
      "hp_decay_per_sec": 17.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Flame Flinger",
  "VisualLevel": "5",
  "HousingSpace": "1",
  "Hitpoints": "2100",
  "DPS": "184",
  "AttackRange": "1005",
  "AttackSpeed": "5000",
  "Speed": "80",
  "DamageRadius": "100",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "FireCatapultProjectile5"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Should lob Flame Spirits that leave a lingering burning hazard zone (FireSpiritBurn) on the target area over time, not just instant damage.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 6.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 184.0, Speed = 5.0s, Range = 10.05t
- **Passive / Periodic Special Abilities:** Special = `{"SiegeWallMultiplier": {"wall_mult": 2.0, "hp_decay_per_sec": 17.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `BattleDrill` — Battle Drill (Siege Machine)

### 1. Current `coc-data` Specification
```json
{
  "id": "BattleDrill",
  "name": "Battle Drill",
  "category": "SiegeMachine",
  "max_level": 6,
  "housing_space": 1,
  "max_hp": 6900.0,
  "dps": 640.0,
  "damage_per_hit": 1088.0,
  "attack_speed_sec": 1.7,
  "move_speed": 24.0,
  "range": 1.0,
  "splash_radius": 0.0,
  "movement": "Burrow",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Battle Drill",
  "VisualLevel": "6",
  "HousingSpace": "1",
  "Hitpoints": "6900",
  "DPS": "640",
  "AttackRange": "100",
  "AttackSpeed": "1700",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "IsUnderground": "TRUE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Should stun nearby defenses for 2.0s in a 1.5t radius upon surfacing (DrillerSurfacing).

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Burrow
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 640.0, Speed = 1.7s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `TroopLauncher` — Troop Launcher (Siege Machine)

### 1. Current `coc-data` Specification
```json
{
  "id": "TroopLauncher",
  "name": "Troop Launcher",
  "category": "SiegeMachine",
  "max_level": 4,
  "housing_space": 1,
  "max_hp": 2600.0,
  "dps": 0.0,
  "damage_per_hit": 0.0,
  "attack_speed_sec": 6.0,
  "move_speed": 0.0,
  "range": 80.0,
  "splash_radius": 0.0,
  "movement": "Stationary",
  "target_domain": "None",
  "preferred_target": "AlliedGround",
  "special": {
    "SiegeSpawner": {
      "lifetime_sec": 104.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Troop Launcher",
  "VisualLevel": "4",
  "HousingSpace": "1",
  "Hitpoints": "2600",
  "DPS": "-1",
  "AttackRange": "8000",
  "AttackSpeed": "6000",
  "Speed": "0",
  "DamageRadius": "1",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "CommandTower Barrel4"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Currently shares SiegeBarracks logic (spawning PEKKAs/Wizards at its feet) instead of launching barrels containing Giant, Barbarians, Archers, and Wall Breakers toward allied units (TroopCatapultSummonTroopNew).

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 0.0, Mode = Stationary
- **Target Selection & Retargeting AI:** Preferred = AlliedGround, Domain = None
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 0.0, Speed = 6.0s, Range = 80.0t
- **Passive / Periodic Special Abilities:** Special = `{"SiegeSpawner": {"lifetime_sec": 104.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SkyWagon` — Sky Wagon (Siege Machine)

### 1. Current `coc-data` Specification
```json
{
  "id": "SkyWagon",
  "name": "Sky Wagon",
  "category": "SiegeMachine",
  "max_level": 4,
  "housing_space": 1,
  "max_hp": 4200.0,
  "dps": 220.0,
  "damage_per_hit": 440.0,
  "attack_speed_sec": 2.0,
  "move_speed": 14.0,
  "range": 3.5,
  "splash_radius": 1.0,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Defenses",
  "special": {
    "PeriodicSummoner": {
      "unit": "Balloon",
      "count": 2,
      "interval_sec": 5.5,
      "max_active": 10
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 14.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 220.0, Speed = 2.0s, Range = 3.5t
- **Passive / Periodic Special Abilities:** Special = `{"PeriodicSummoner": {"unit": "Balloon", "count": 2, "interval_sec": 5.5, "max_active": 10}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
