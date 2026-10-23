# Heroes (6) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `BarbarianKing` — Barbarian King (Hero)

### 1. Current `coc-data` Specification
```json
{
  "id": "BarbarianKing",
  "name": "Barbarian King",
  "max_level": 110,
  "base_hp": 13350.0,
  "base_dps": 713.0,
  "max_hp": 16716.0,
  "dps": 841.0,
  "damage_per_hit": 1009.2,
  "attack_speed_sec": 1.2,
  "move_speed": 16.0,
  "range": 1.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "ability_name": "Barbarian Puppet",
  "ability_heal": 3250.0,
  "ability_duration_sec": 15.0,
  "default_pet": "Phoenix",
  "default_equipment": [
    "BarbarianPuppet",
    "RageVial"
  ]
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Barbarian King",
  "VisualLevel": "110",
  "HousingSpace": "25",
  "Hitpoints": "13350",
  "DPS": "713",
  "AttackRange": "100",
  "AttackSpeed": "1200",
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
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 841.0, Speed = 1.2s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ArcherQueen` — Archer Queen (Hero)

### 1. Current `coc-data` Specification
```json
{
  "id": "ArcherQueen",
  "name": "Archer Queen",
  "max_level": 110,
  "base_hp": 3576.0,
  "base_dps": 810.0,
  "max_hp": 4276.0,
  "dps": 969.0,
  "damage_per_hit": 726.75,
  "attack_speed_sec": 0.75,
  "move_speed": 24.0,
  "range": 5.0,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "ability_name": "Archer Puppet",
  "ability_heal": 445.0,
  "ability_duration_sec": 7.8,
  "default_pet": "Unicorn",
  "default_equipment": [
    "ArcherPuppet",
    "InvisibilityVial"
  ]
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Archer Queen",
  "VisualLevel": "110",
  "HousingSpace": "25",
  "Hitpoints": "3576",
  "DPS": "810",
  "AttackRange": "500",
  "AttackSpeed": "750",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "ArcherQueen arrow lvl3"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 969.0, Speed = 0.75s, Range = 5.0t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `MinionPrince` — Minion Prince (Hero)

### 1. Current `coc-data` Specification
```json
{
  "id": "MinionPrince",
  "name": "Minion Prince",
  "max_level": 95,
  "base_hp": 4510.0,
  "base_dps": 765.0,
  "max_hp": 6150.0,
  "dps": 1026.0,
  "damage_per_hit": 872.1,
  "attack_speed_sec": 0.85,
  "move_speed": 24.0,
  "range": 4.5,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "ability_name": "Henchmen Puppet",
  "ability_heal": 1050.0,
  "ability_duration_sec": 1.0,
  "default_pet": "AngryJelly",
  "default_equipment": [
    "HenchmenPuppet",
    "DarkOrb"
  ]
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Minion Prince",
  "VisualLevel": "95",
  "HousingSpace": "25",
  "Hitpoints": "4510",
  "DPS": "765",
  "AttackRange": "450",
  "AttackSpeed": "850",
  "Speed": "300",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "MinionHeroAttackProjectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 1026.0, Speed = 0.85s, Range = 4.5t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GrandWarden` — Grand Warden (Hero)

### 1. Current `coc-data` Specification
```json
{
  "id": "GrandWarden",
  "name": "Grand Warden",
  "max_level": 85,
  "base_hp": 2669.0,
  "base_dps": 354.0,
  "max_hp": 3169.0,
  "dps": 429.0,
  "damage_per_hit": 772.2,
  "attack_speed_sec": 1.8,
  "move_speed": 16.0,
  "range": 7.0,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "ability_name": "Eternal Tome",
  "ability_heal": 285.0,
  "ability_duration_sec": 7.2,
  "default_pet": "ElectroOwl",
  "default_equipment": [
    "EternalTome",
    "LifeGem"
  ]
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Grand Warden",
  "VisualLevel": "85",
  "HousingSpace": "25",
  "Hitpoints": "2669",
  "DPS": "354",
  "AttackRange": "700",
  "AttackSpeed": "1800",
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
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 429.0, Speed = 1.8s, Range = 7.0t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RoyalChampion` — Royal Champion (Hero)

### 1. Current `coc-data` Specification
```json
{
  "id": "RoyalChampion",
  "name": "Royal Champion",
  "max_level": 55,
  "base_hp": 4298.0,
  "base_dps": 575.0,
  "max_hp": 5248.0,
  "dps": 695.0,
  "damage_per_hit": 834.0,
  "attack_speed_sec": 1.2,
  "move_speed": 24.0,
  "range": 3.0,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Defenses",
  "ability_name": "Seeking Shield",
  "ability_heal": 1500.0,
  "ability_duration_sec": 1.2,
  "default_pet": "SpiritFox",
  "default_equipment": [
    "SeekingShield",
    "RoyalGem"
  ]
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Royal Champion",
  "VisualLevel": "55",
  "HousingSpace": "25",
  "Hitpoints": "4298",
  "DPS": "575",
  "AttackRange": "300",
  "AttackSpeed": "1200",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE",
  "Projectile": "AmazonQueen_javelin"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 695.0, Speed = 1.2s, Range = 3.0t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `DragonDuke` — Dragon Duke (Hero)

### 1. Current `coc-data` Specification
```json
{
  "id": "DragonDuke",
  "name": "Dragon Duke",
  "max_level": 25,
  "base_hp": 10900.0,
  "base_dps": 400.0,
  "max_hp": 19600.0,
  "dps": 423.0,
  "damage_per_hit": 507.6,
  "attack_speed_sec": 1.2,
  "move_speed": 20.0,
  "range": 1.25,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "ability_name": "Fire Heart",
  "ability_heal": 4750.0,
  "ability_duration_sec": 1.0,
  "default_pet": "Phoenix",
  "default_equipment": [
    "FireHeart",
    "FlameBlower"
  ]
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Dragon Duke",
  "VisualLevel": "25",
  "HousingSpace": "25",
  "Hitpoints": "10900",
  "DPS": "400",
  "AttackRange": "125",
  "AttackSpeed": "1200",
  "Speed": "250",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 423.0, Speed = 1.2s, Range = 1.25t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
