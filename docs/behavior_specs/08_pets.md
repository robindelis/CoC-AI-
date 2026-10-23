# Hero Pets (12) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `Lassi` — L.A.S.S.I (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "Lassi",
  "name": "L.A.S.S.I",
  "max_level": 15,
  "max_hp": 4500.0,
  "dps": 400.0,
  "damage_per_hit": 360.0,
  "attack_speed_sec": 0.9,
  "move_speed": 32.0,
  "range": 0.6,
  "movement": "JumpWalls",
  "target_domain": "Ground",
  "preferred_target": "Any"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "LASSI",
  "TroopLevel": "15",
  "HousingSpace": "20",
  "Hitpoints": "4500",
  "DPS": "400",
  "AttackRange": "60",
  "AttackSpeed": "900",
  "Speed": "400",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 400.0, Speed = 0.9s, Range = 0.6t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ElectroOwl` — Electro Owl (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "ElectroOwl",
  "name": "Electro Owl",
  "max_level": 15,
  "max_hp": 3000.0,
  "dps": 170.0,
  "damage_per_hit": 238.0,
  "attack_speed_sec": 1.4,
  "move_speed": 20.0,
  "range": 6.0,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Electro Owl",
  "TroopLevel": "15",
  "HousingSpace": "20",
  "Hitpoints": "3000",
  "DPS": "170",
  "AttackRange": "550",
  "AttackSpeed": "1400",
  "Speed": "250",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Chain lightning bounce to 1 secondary target within 3.5t for 80% damage is not implemented in execute_unit_attack().

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 170.0, Speed = 1.4s, Range = 6.0t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `MightyYak` — Mighty Yak (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "MightyYak",
  "name": "Mighty Yak",
  "max_level": 15,
  "max_hp": 6300.0,
  "dps": 116.0,
  "damage_per_hit": 243.6,
  "attack_speed_sec": 2.1,
  "move_speed": 20.0,
  "range": 1.2,
  "movement": {
    "WallCrusher": {
      "wall_dps": 2320
    }
  },
  "target_domain": "Ground",
  "preferred_target": "Any"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Mighty Yak",
  "TroopLevel": "15",
  "HousingSpace": "20",
  "Hitpoints": "6300",
  "DPS": "116",
  "AttackRange": "120",
  "AttackSpeed": "2100",
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
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = {'WallCrusher': {'wall_dps': 2320}}
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 116.0, Speed = 2.1s, Range = 1.2t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Unicorn` — Unicorn (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "Unicorn",
  "name": "Unicorn",
  "max_level": 15,
  "max_hp": 2325.0,
  "dps": 75.0,
  "damage_per_hit": 75.0,
  "attack_speed_sec": 1.0,
  "move_speed": 16.0,
  "range": 2.5,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "AlliedAny"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Unicorn",
  "TroopLevel": "15",
  "HousingSpace": "20",
  "Hitpoints": "2325",
  "DPS": "-75",
  "AttackRange": "250",
  "AttackSpeed": "1000",
  "Speed": "200",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE",
  "Projectile": "UnicornHealEnergy"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = AlliedAny, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 75.0, Speed = 1.0s, Range = 2.5t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Frosty` — Frosty (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "Frosty",
  "name": "Frosty",
  "max_level": 15,
  "max_hp": 3800.0,
  "dps": 150.0,
  "damage_per_hit": 180.0,
  "attack_speed_sec": 1.2,
  "move_speed": 24.0,
  "range": 3.5,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Frosty",
  "TroopLevel": "15",
  "HousingSpace": "20",
  "Hitpoints": "3800",
  "DPS": "150",
  "AttackRange": "350",
  "AttackSpeed": "1200",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE",
  "Projectile": "Frosty_projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 150.0, Speed = 1.2s, Range = 3.5t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Diggy` — Diggy (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "Diggy",
  "name": "Diggy",
  "max_level": 15,
  "max_hp": 5750.0,
  "dps": 175.0,
  "damage_per_hit": 192.5,
  "attack_speed_sec": 1.1,
  "move_speed": 32.0,
  "range": 0.8,
  "movement": "Burrow",
  "target_domain": "Ground",
  "preferred_target": "Defenses"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Diggy",
  "TroopLevel": "15",
  "HousingSpace": "20",
  "Hitpoints": "5750",
  "DPS": "175",
  "AttackRange": "80",
  "AttackSpeed": "1100",
  "Speed": "400",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "IsUnderground": "TRUE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = Burrow
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 175.0, Speed = 1.1s, Range = 0.8t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `PoisonLizard` — Poison Lizard (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "PoisonLizard",
  "name": "Poison Lizard",
  "max_level": 15,
  "max_hp": 2300.0,
  "dps": 335.0,
  "damage_per_hit": 117.25,
  "attack_speed_sec": 0.35,
  "move_speed": 36.0,
  "range": 4.5,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Heroes"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Poison Lizard",
  "TroopLevel": "15",
  "HousingSpace": "20",
  "Hitpoints": "2300",
  "DPS": "335",
  "AttackRange": "450",
  "AttackSpeed": "350",
  "Speed": "450",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE",
  "Projectile": "fireIguanaProto"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Poison spit slow and DOT (PoisonLizardAttack) on defending heroes and CC troops is not applied on projectile impact.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 36.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Heroes, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 335.0, Speed = 0.35s, Range = 4.5t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Phoenix` — Phoenix (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "Phoenix",
  "name": "Phoenix",
  "max_level": 10,
  "max_hp": 4200.0,
  "dps": 250.0,
  "damage_per_hit": 250.0,
  "attack_speed_sec": 1.0,
  "move_speed": 16.0,
  "range": 2.5,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Phoenix",
  "TroopLevel": "10",
  "HousingSpace": "20",
  "Hitpoints": "4200",
  "DPS": "250",
  "AttackRange": "250",
  "AttackSpeed": "1000",
  "Speed": "200",
  "DamageRadius": "30",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "PhoenixProjectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Currently spawns as an active flying bird at t=0; should follow Hero as an invulnerable Egg until Hero takes fatal damage, then revive Hero with 8s invulnerability and hatch into active Phoenix.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 250.0, Speed = 1.0s, Range = 2.5t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SpiritFox` — Spirit Fox (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "SpiritFox",
  "name": "Spirit Fox",
  "max_level": 10,
  "max_hp": 2800.0,
  "dps": 180.0,
  "damage_per_hit": 288.0,
  "attack_speed_sec": 1.6,
  "move_speed": 24.0,
  "range": 2.5,
  "movement": "JumpWalls",
  "target_domain": "Ground",
  "preferred_target": "Defenses"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Spirit Fox",
  "TroopLevel": "10",
  "HousingSpace": "20",
  "Hitpoints": "2800",
  "DPS": "180",
  "AttackRange": "250",
  "AttackSpeed": "1600",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE",
  "Projectile": "Fennec_projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 180.0, Speed = 1.6s, Range = 2.5t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `AngryJelly` — Angry Jelly (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "AngryJelly",
  "name": "Angry Jelly",
  "max_level": 10,
  "max_hp": 2125.0,
  "dps": 193.0,
  "damage_per_hit": 144.75,
  "attack_speed_sec": 0.75,
  "move_speed": 16.0,
  "range": 1.5,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Defenses"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Angry Jelly",
  "TroopLevel": "10",
  "HousingSpace": "20",
  "Hitpoints": "2125",
  "DPS": "193",
  "AttackRange": "500",
  "AttackSpeed": "750",
  "Speed": "200",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Currently sets Hero preferred_target = Defenses permanently at t=0 and flies as a targetable unit immediately; should attach to Hero (untargetable) for 35s forcing Defense targeting, then detach.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 193.0, Speed = 0.75s, Range = 1.5t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Sneezy` — Sneezy (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "Sneezy",
  "name": "Sneezy",
  "max_level": 10,
  "max_hp": 4650.0,
  "dps": 450.0,
  "damage_per_hit": 360.0,
  "attack_speed_sec": 0.8,
  "move_speed": 24.0,
  "range": 1.5,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Defenses"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Sneezy",
  "TroopLevel": "10",
  "HousingSpace": "20",
  "Hitpoints": "4650",
  "DPS": "450",
  "AttackRange": "250",
  "AttackSpeed": "800",
  "Speed": "300",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "pet_sneezy_projectile_ShockWave"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 450.0, Speed = 0.8s, Range = 1.5t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GreedyRaven` — Greedy Raven (Hero Pet)

### 1. Current `coc-data` Specification
```json
{
  "id": "GreedyRaven",
  "name": "Greedy Raven",
  "max_level": 10,
  "max_hp": 3500.0,
  "dps": 155.0,
  "damage_per_hit": 186.0,
  "attack_speed_sec": 1.2,
  "move_speed": 28.0,
  "range": 2.0,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Resources"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Crow",
  "TroopLevel": "10",
  "HousingSpace": "20",
  "Hitpoints": "3500",
  "DPS": "155",
  "AttackRange": "800",
  "AttackSpeed": "420",
  "Speed": "350",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "CrowProjectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 28.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Resources, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 155.0, Speed = 1.2s, Range = 2.0t
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
