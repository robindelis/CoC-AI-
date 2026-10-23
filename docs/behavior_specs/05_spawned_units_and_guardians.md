# Spawned Sub-Units & TH18 Guardians (20) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `Skeleton` — Skeleton (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Skeleton",
  "name": "Skeleton",
  "category": "Spawned",
  "max_level": 2,
  "housing_space": 1,
  "max_hp": 45.0,
  "dps": 30.0,
  "damage_per_hit": 30.0,
  "attack_speed_sec": 1.0,
  "move_speed": 24.0,
  "range": 0.4,
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
  "Name": "Skeleton",
  "VisualLevel": "2",
  "HousingSpace": "1",
  "Hitpoints": "45",
  "DPS": "30",
  "AttackRange": "40",
  "AttackSpeed": "1000",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 30.0, Speed = 1.0s, Range = 0.4t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ArmoredSkeleton` — Armored Skeleton (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "ArmoredSkeleton",
  "name": "Armored Skeleton",
  "category": "Spawned",
  "max_level": 8,
  "housing_space": 1,
  "max_hp": 60.0,
  "dps": 25.0,
  "damage_per_hit": 25.0,
  "attack_speed_sec": 1.0,
  "move_speed": 24.0,
  "range": 0.4,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": "None"
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
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 25.0, Speed = 1.0s, Range = 0.4t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Bat` — Bat (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Bat",
  "name": "Bat",
  "category": "Spawned",
  "max_level": 8,
  "housing_space": 1,
  "max_hp": 20.0,
  "dps": 30.0,
  "damage_per_hit": 60.0,
  "attack_speed_sec": 2.0,
  "move_speed": 56.0,
  "range": 0.8,
  "splash_radius": 0.0,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Defenses",
  "special": "None"
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
- **Movement & Wall/Obstacle Interaction:** Speed = 56.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 30.0, Speed = 2.0s, Range = 0.8t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Golemite` — Golemite (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Golemite",
  "name": "Golemite",
  "category": "Spawned",
  "max_level": 15,
  "housing_space": 6,
  "max_hp": 2040.0,
  "dps": 22.0,
  "damage_per_hit": 66.0,
  "attack_speed_sec": 3.0,
  "move_speed": 12.0,
  "range": 0.5,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": {
    "DeathSplash": {
      "damage": 210.0,
      "radius": 1.2
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Golemite",
  "VisualLevel": "15",
  "HousingSpace": "6",
  "Hitpoints": "2040",
  "DPS": "22",
  "AttackRange": "50",
  "AttackSpeed": "3000",
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
- **Movement & Wall/Obstacle Interaction:** Speed = 12.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 22.0, Speed = 3.0s, Range = 0.5t
- **Passive / Periodic Special Abilities:** Special = `{"DeathSplash": {"damage": 210.0, "radius": 1.2}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `LavaPup` — Lava Pup (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "LavaPup",
  "name": "Lava Pup",
  "category": "Spawned",
  "max_level": 8,
  "housing_space": 1,
  "max_hp": 50.0,
  "dps": 35.0,
  "damage_per_hit": 35.0,
  "attack_speed_sec": 1.0,
  "move_speed": 32.0,
  "range": 2.25,
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
  "Name": "Lava Pup",
  "VisualLevel": "1",
  "HousingSpace": "1",
  "Hitpoints": "50",
  "DPS": "35",
  "AttackRange": "225",
  "AttackSpeed": "1000",
  "Speed": "400",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "tinyhound_projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 35.0, Speed = 1.0s, Range = 2.25t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Yetimite` — Yetimite (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Yetimite",
  "name": "Yetimite",
  "category": "Spawned",
  "max_level": 8,
  "housing_space": 2,
  "max_hp": 590.0,
  "dps": 92.0,
  "damage_per_hit": 92.0,
  "attack_speed_sec": 1.0,
  "move_speed": 24.0,
  "range": 2.0,
  "splash_radius": 0.8,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Defenses",
  "special": {
    "KamikazeWall": {
      "wall_mult": 1.0,
      "death_damage": 92.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Yetimite",
  "VisualLevel": "8",
  "HousingSpace": "2",
  "Hitpoints": "590",
  "DPS": "92",
  "AttackRange": "200",
  "AttackSpeed": "1000",
  "Speed": "300",
  "DamageRadius": "80",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE",
  "Projectile": "YetimiteJump8"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 92.0, Speed = 1.0s, Range = 2.0t
- **Passive / Periodic Special Abilities:** Special = `{"KamikazeWall": {"wall_mult": 1.0, "death_damage": 92.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Firemite` — Firemite (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Firemite",
  "name": "Firemite",
  "category": "Spawned",
  "max_level": 4,
  "housing_space": 1,
  "max_hp": 325.0,
  "dps": 150.0,
  "damage_per_hit": 230.0,
  "attack_speed_sec": 1.0,
  "move_speed": 32.0,
  "range": 1.5,
  "splash_radius": 0.8,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "KamikazeWall": {
      "wall_mult": 1.0,
      "death_damage": 80.0
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
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 150.0, Speed = 1.0s, Range = 1.5t
- **Passive / Periodic Special Abilities:** Special = `{"KamikazeWall": {"wall_mult": 1.0, "death_damage": 80.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Frostmite` — Frostmite (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Frostmite",
  "name": "Frostmite",
  "category": "Spawned",
  "max_level": 15,
  "housing_space": 1,
  "max_hp": 450.0,
  "dps": 15.0,
  "damage_per_hit": 15.0,
  "attack_speed_sec": 1.0,
  "move_speed": 24.0,
  "range": 1.5,
  "splash_radius": 0.8,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Defenses",
  "special": "None"
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
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 15.0, Speed = 1.0s, Range = 1.5t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Henchman` — Henchman (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Henchman",
  "name": "Henchman",
  "category": "Spawned",
  "max_level": 7,
  "housing_space": 10,
  "max_hp": 2500.0,
  "dps": 150.0,
  "damage_per_hit": 165.0,
  "attack_speed_sec": 1.1,
  "move_speed": 32.0,
  "range": 1.0,
  "splash_radius": 0.0,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
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
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 150.0, Speed = 1.1s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Booger` — Booger (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Booger",
  "name": "Booger",
  "category": "Spawned",
  "max_level": 10,
  "housing_space": 4,
  "max_hp": 2000.0,
  "dps": 150.0,
  "damage_per_hit": 150.0,
  "attack_speed_sec": 1.0,
  "move_speed": 16.0,
  "range": 0.9,
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
  "Name": "Booger",
  "VisualLevel": "10",
  "HousingSpace": "4",
  "Hitpoints": "2000",
  "DPS": "150",
  "AttackRange": "90",
  "AttackSpeed": "1000",
  "Speed": "200",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 150.0, Speed = 1.0s, Range = 0.9t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `DruidBear` — Druid Bear (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "DruidBear",
  "name": "Druid Bear",
  "category": "Spawned",
  "max_level": 6,
  "housing_space": 10,
  "max_hp": 2750.0,
  "dps": 225.0,
  "damage_per_hit": 225.0,
  "attack_speed_sec": 1.0,
  "move_speed": 20.0,
  "range": 0.6,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": "None"
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
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 225.0, Speed = 1.0s, Range = 0.6t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Meteormite` — Meteormite (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Meteormite",
  "name": "Meteormite",
  "category": "Spawned",
  "max_level": 3,
  "housing_space": 6,
  "max_hp": 8750.0,
  "dps": 230.0,
  "damage_per_hit": 345.0,
  "attack_speed_sec": 1.5,
  "move_speed": 22.0,
  "range": 0.8,
  "splash_radius": 0.8,
  "movement": "JumpWalls",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Meteormite",
  "VisualLevel": "3",
  "HousingSpace": "20",
  "Hitpoints": "8750",
  "DPS": "230",
  "AttackRange": "80",
  "AttackSpeed": "1500",
  "Speed": "200",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 22.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 230.0, Speed = 1.5s, Range = 0.8t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RuinKnight` — Ruin Knight (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "RuinKnight",
  "name": "Ruin Knight",
  "category": "Spawned",
  "max_level": 4,
  "housing_space": 8,
  "max_hp": 4000.0,
  "dps": 345.0,
  "damage_per_hit": 345.0,
  "attack_speed_sec": 1.0,
  "move_speed": 20.0,
  "range": 0.6,
  "splash_radius": 0.0,
  "movement": "JumpWalls",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Ruin Knight",
  "VisualLevel": "4",
  "HousingSpace": "20",
  "Hitpoints": "4000",
  "DPS": "345",
  "AttackRange": "60",
  "AttackSpeed": "1000",
  "Speed": "200",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 345.0, Speed = 1.0s, Range = 0.6t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GiantGiant` — Giant Giant (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "GiantGiant",
  "name": "Giant Giant",
  "category": "Spawned",
  "max_level": 10,
  "housing_space": 25,
  "max_hp": 27500.0,
  "dps": 1060.0,
  "damage_per_hit": 2120.0,
  "attack_speed_sec": 2.0,
  "move_speed": 14.0,
  "range": 1.0,
  "splash_radius": 1.5,
  "movement": {
    "WallCrusher": {
      "wall_dps": 5000
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
  "Name": "Giant Giant",
  "VisualLevel": "16",
  "HousingSpace": "50",
  "Hitpoints": "27500",
  "DPS": "1060",
  "AttackRange": "100",
  "AttackSpeed": "2000",
  "Speed": "165",
  "DamageRadius": "150",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 14.0, Mode = {'WallCrusher': {'wall_dps': 5000}}
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 1060.0, Speed = 2.0s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Lavaloon` — Lavaloon (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Lavaloon",
  "name": "Lavaloon",
  "category": "Spawned",
  "max_level": 11,
  "housing_space": 23,
  "max_hp": 6500.0,
  "dps": 310.0,
  "damage_per_hit": 775.0,
  "attack_speed_sec": 2.5,
  "move_speed": 18.0,
  "range": 1.0,
  "splash_radius": 1.5,
  "movement": "Air",
  "target_domain": "Ground",
  "preferred_target": "AirDefenses",
  "special": {
    "DeathSplash": {
      "damage": 600.0,
      "radius": 2.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Lavaloon",
  "VisualLevel": "13",
  "HousingSpace": "21",
  "Hitpoints": "6500",
  "DPS": "310",
  "AttackRange": "0",
  "AttackSpeed": "2500",
  "Speed": "200",
  "DamageRadius": "180",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "LavaloonProjectile13"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 18.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = AirDefenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 310.0, Speed = 2.5s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `{"DeathSplash": {"damage": 600.0, "radius": 2.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Snake` — Snake (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Snake",
  "name": "Snake",
  "category": "Spawned",
  "max_level": 10,
  "housing_space": 1,
  "max_hp": 200.0,
  "dps": 50.0,
  "damage_per_hit": 50.0,
  "attack_speed_sec": 1.0,
  "move_speed": 28.0,
  "range": 0.4,
  "splash_radius": 0.0,
  "movement": "JumpWalls",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Snake",
  "VisualLevel": "1",
  "HousingSpace": "1",
  "Hitpoints": "200",
  "DPS": "50",
  "AttackRange": "40",
  "AttackSpeed": "1000",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 28.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 50.0, Speed = 1.0s, Range = 0.4t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GuardianLogger` — Logger (Guardian) (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "GuardianLogger",
  "name": "Logger (Guardian)",
  "category": "Spawned",
  "max_level": 5,
  "housing_space": 25,
  "max_hp": 12000.0,
  "dps": 350.0,
  "damage_per_hit": 875.0,
  "attack_speed_sec": 2.5,
  "move_speed": 8.0,
  "range": 7.0,
  "splash_radius": 1.8,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "DeathSplash": {
      "damage": 800.0,
      "radius": 2.0
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
- **Movement & Wall/Obstacle Interaction:** Speed = 8.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 350.0, Speed = 2.5s, Range = 7.0t
- **Passive / Periodic Special Abilities:** Special = `{"DeathSplash": {"damage": 800.0, "radius": 2.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GuardianLongshot` — Longshot (Guardian) (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "GuardianLongshot",
  "name": "Longshot (Guardian)",
  "category": "Spawned",
  "max_level": 5,
  "housing_space": 25,
  "max_hp": 11000.0,
  "dps": 450.0,
  "damage_per_hit": 810.0,
  "attack_speed_sec": 1.8,
  "move_speed": 12.0,
  "range": 11.0,
  "splash_radius": 1.0,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "DeathSplash": {
      "damage": 1000.0,
      "radius": 3.5
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
- **Movement & Wall/Obstacle Interaction:** Speed = 12.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 450.0, Speed = 1.8s, Range = 11.0t
- **Passive / Periodic Special Abilities:** Special = `{"DeathSplash": {"damage": 1000.0, "radius": 3.5}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GuardianSmasher` — Smasher (Guardian) (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "GuardianSmasher",
  "name": "Smasher (Guardian)",
  "category": "Spawned",
  "max_level": 5,
  "housing_space": 25,
  "max_hp": 16000.0,
  "dps": 700.0,
  "damage_per_hit": 1260.0,
  "attack_speed_sec": 1.8,
  "move_speed": 20.0,
  "range": 1.25,
  "splash_radius": 2.5,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
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
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 700.0, Speed = 1.8s, Range = 1.25t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Totem` — Totem (Summoned Statue) (Spawned / Guardian Unit)

### 1. Current `coc-data` Specification
```json
{
  "id": "Totem",
  "name": "Totem (Summoned Statue)",
  "category": "Spawned",
  "max_hp": 13000.0,
  "decay_per_sec": 334.0,
  "lifetime_sec": 38.9,
  "movement": "Stationary"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Ignores HP decay_per_sec (334 HP/s), does not stun defending units in radius, and lacks a sprite mapping in spriteLoader.ts.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = Stationary
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
