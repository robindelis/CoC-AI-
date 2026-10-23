# Elixir Troops (19) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `Barbarian` — Barbarian (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Barbarian",
  "name": "Barbarian",
  "category": "Elixir",
  "max_level": 13,
  "housing_space": 1,
  "max_hp": 310.0,
  "dps": 51.0,
  "damage_per_hit": 51.0,
  "attack_speed_sec": 1.0,
  "move_speed": 18.0,
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
  "Name": "Barbarian",
  "VisualLevel": "13",
  "HousingSpace": "1",
  "Hitpoints": "310",
  "DPS": "51",
  "AttackRange": "40",
  "AttackSpeed": "1000",
  "Speed": "220",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 18.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 51.0, Speed = 1.0s, Range = 0.4t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Archer` — Archer (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Archer",
  "name": "Archer",
  "category": "Elixir",
  "max_level": 14,
  "housing_space": 1,
  "max_hp": 76.0,
  "dps": 46.0,
  "damage_per_hit": 46.0,
  "attack_speed_sec": 1.0,
  "move_speed": 24.0,
  "range": 3.5,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Archer",
  "VisualLevel": "14",
  "HousingSpace": "1",
  "Hitpoints": "76",
  "DPS": "46",
  "AttackRange": "350",
  "AttackSpeed": "1000",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "Arrow_small_darkElixirFire2"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 46.0, Speed = 1.0s, Range = 3.5t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Giant` — Giant (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Giant",
  "name": "Giant",
  "category": "Elixir",
  "max_level": 14,
  "housing_space": 5,
  "max_hp": 3000.0,
  "dps": 114.0,
  "damage_per_hit": 228.0,
  "attack_speed_sec": 2.0,
  "move_speed": 12.0,
  "range": 1.0,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Giant",
  "VisualLevel": "14",
  "HousingSpace": "5",
  "Hitpoints": "3000",
  "DPS": "114",
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
- **Movement & Wall/Obstacle Interaction:** Speed = 12.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 114.0, Speed = 2.0s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Goblin` — Goblin (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Goblin",
  "name": "Goblin",
  "category": "Elixir",
  "max_level": 10,
  "housing_space": 1,
  "max_hp": 166.0,
  "dps": 82.0,
  "damage_per_hit": 82.0,
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
  "Name": "Goblin",
  "VisualLevel": "10",
  "HousingSpace": "1",
  "Hitpoints": "166",
  "DPS": "82",
  "AttackRange": "40",
  "AttackSpeed": "1000",
  "Speed": "400",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Resources, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 82.0, Speed = 1.0s, Range = 0.4t
- **Passive / Periodic Special Abilities:** Special = `{"ResourceMultiplier": {"mult": 2.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `WallBreaker` — Wall Breaker (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "WallBreaker",
  "name": "Wall Breaker",
  "category": "Elixir",
  "max_level": 14,
  "housing_space": 2,
  "max_hp": 170.0,
  "dps": 126.0,
  "damage_per_hit": 126.0,
  "attack_speed_sec": 1.0,
  "move_speed": 24.0,
  "range": 0.5,
  "splash_radius": 2.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Walls",
  "special": {
    "KamikazeWall": {
      "wall_mult": 40.0,
      "death_damage": 78.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Wall Breaker",
  "VisualLevel": "14",
  "HousingSpace": "2",
  "Hitpoints": "170",
  "DPS": "126",
  "AttackRange": "50",
  "AttackSpeed": "1000",
  "Speed": "300",
  "DamageRadius": "80",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** When killed before reaching a wall, TroopSpecial::KamikazeWall death_damage (78) is not applied in damage_unit() death handler.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Walls, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 126.0, Speed = 1.0s, Range = 0.5t
- **Passive / Periodic Special Abilities:** Special = `{"KamikazeWall": {"wall_mult": 40.0, "death_damage": 78.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Balloon` — Balloon (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Balloon",
  "name": "Balloon",
  "category": "Elixir",
  "max_level": 13,
  "housing_space": 5,
  "max_hp": 1360.0,
  "dps": 326.0,
  "damage_per_hit": 978.0,
  "attack_speed_sec": 3.0,
  "move_speed": 10.0,
  "range": 0.5,
  "splash_radius": 1.2,
  "movement": "Air",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": {
    "DeathSplash": {
      "damage": 425.0,
      "radius": 1.2
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Balloon",
  "VisualLevel": "13",
  "HousingSpace": "5",
  "Hitpoints": "1360",
  "DPS": "326",
  "AttackRange": "0",
  "AttackSpeed": "3000",
  "Speed": "130",
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
- **Movement & Wall/Obstacle Interaction:** Speed = 10.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 326.0, Speed = 3.0s, Range = 0.5t
- **Passive / Periodic Special Abilities:** Special = `{"DeathSplash": {"damage": 425.0, "radius": 1.2}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Wizard` — Wizard (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Wizard",
  "name": "Wizard",
  "category": "Elixir",
  "max_level": 14,
  "housing_space": 4,
  "max_hp": 330.0,
  "dps": 310.0,
  "damage_per_hit": 465.0,
  "attack_speed_sec": 1.5,
  "move_speed": 16.0,
  "range": 3.0,
  "splash_radius": 0.5,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Wizard",
  "VisualLevel": "14",
  "HousingSpace": "4",
  "Hitpoints": "330",
  "DPS": "310",
  "AttackRange": "300",
  "AttackSpeed": "1500",
  "Speed": "200",
  "DamageRadius": "30",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "ps_chr_WizardAttack_Projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 310.0, Speed = 1.5s, Range = 3.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Healer` — Healer (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Healer",
  "name": "Healer",
  "category": "Elixir",
  "max_level": 11,
  "housing_space": 14,
  "max_hp": 2100.0,
  "dps": 82.0,
  "damage_per_hit": 57.4,
  "attack_speed_sec": 0.7,
  "move_speed": 16.0,
  "range": 4.5,
  "splash_radius": 1.5,
  "movement": "Air",
  "target_domain": "Ground",
  "preferred_target": "AlliedGround",
  "special": {
    "Healer": {
      "hero_mult": 1.073
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Healer",
  "VisualLevel": "11",
  "HousingSpace": "14",
  "Hitpoints": "2100",
  "DPS": "-82",
  "AttackRange": "450",
  "AttackSpeed": "700",
  "Speed": "200",
  "DamageRadius": "150",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "HealerEnergy"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** execute_unit_attack() only heals the single TargetRef::Unit(aid) instead of splash-healing all friendly ground units within 1.5t.
- [ ] **KNOWN ENGINE GAP:** TroopSpecial::Healer { hero_mult } is not applied to scale healing on Heroes.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = AlliedGround, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 82.0, Speed = 0.7s, Range = 4.5t
- **Passive / Periodic Special Abilities:** Special = `{"Healer": {"hero_mult": 1.073}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Dragon` — Dragon (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Dragon",
  "name": "Dragon",
  "category": "Elixir",
  "max_level": 13,
  "housing_space": 20,
  "max_hp": 6000.0,
  "dps": 430.0,
  "damage_per_hit": 537.5,
  "attack_speed_sec": 1.25,
  "move_speed": 16.0,
  "range": 2.5,
  "splash_radius": 0.5,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Dragon",
  "VisualLevel": "13",
  "HousingSpace": "20",
  "Hitpoints": "6000",
  "DPS": "430",
  "AttackRange": "250",
  "AttackSpeed": "1250",
  "Speed": "200",
  "DamageRadius": "30",
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
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 430.0, Speed = 1.25s, Range = 2.5t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Pekka` — P.E.K.K.A (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Pekka",
  "name": "P.E.K.K.A",
  "category": "Elixir",
  "max_level": 13,
  "housing_space": 25,
  "max_hp": 8800.0,
  "dps": 940.0,
  "damage_per_hit": 1692.0,
  "attack_speed_sec": 1.8,
  "move_speed": 16.0,
  "range": 0.8,
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
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 940.0, Speed = 1.8s, Range = 0.8t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `BabyDragon` — Baby Dragon (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "BabyDragon",
  "name": "Baby Dragon",
  "category": "Elixir",
  "max_level": 12,
  "housing_space": 10,
  "max_hp": 2350.0,
  "dps": 185.0,
  "damage_per_hit": 185.0,
  "attack_speed_sec": 1.0,
  "move_speed": 20.0,
  "range": 2.25,
  "splash_radius": 0.5,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "BabyDragonTantrum": {
      "radius": 4.5,
      "damage_mult": 2.0,
      "speed_mult": 1.5
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Baby Dragon",
  "VisualLevel": "12",
  "HousingSpace": "10",
  "Hitpoints": "2350",
  "DPS": "185",
  "AttackRange": "225",
  "AttackSpeed": "1000",
  "Speed": "250",
  "DamageRadius": "30",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "babydragon_projectile_lvl10"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Tantrum doubles damage_per_hit when isolated (no air ally within 4.5t) but does not apply speed_mult (1.5x attack speed) to attack_cooldown.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 185.0, Speed = 1.0s, Range = 2.25t
- **Passive / Periodic Special Abilities:** Special = `{"BabyDragonTantrum": {"radius": 4.5, "damage_mult": 2.0, "speed_mult": 1.5}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Miner` — Miner (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Miner",
  "name": "Miner",
  "category": "Elixir",
  "max_level": 12,
  "housing_space": 6,
  "max_hp": 2050.0,
  "dps": 195.0,
  "damage_per_hit": 331.5,
  "attack_speed_sec": 1.7,
  "move_speed": 32.0,
  "range": 0.6,
  "splash_radius": 0.0,
  "movement": "Burrow",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Miner",
  "VisualLevel": "12",
  "HousingSpace": "6",
  "Hitpoints": "2050",
  "DPS": "195",
  "AttackRange": "60",
  "AttackSpeed": "1700",
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
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 195.0, Speed = 1.7s, Range = 0.6t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ElectroDragon` — Electro Dragon (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "ElectroDragon",
  "name": "Electro Dragon",
  "category": "Elixir",
  "max_level": 9,
  "housing_space": 30,
  "max_hp": 6900.0,
  "dps": 510.0,
  "damage_per_hit": 1785.0,
  "attack_speed_sec": 3.5,
  "move_speed": 13.0,
  "range": 2.5,
  "splash_radius": 0.0,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "ChainLightning": {
      "max_targets": 5,
      "chain_range": 3.0,
      "decay": 0.8,
      "death_damage": 870.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Electro Dragon",
  "VisualLevel": "9",
  "HousingSpace": "30",
  "Hitpoints": "6900",
  "DPS": "510",
  "AttackRange": "250",
  "AttackSpeed": "3500",
  "Speed": "160",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** TroopSpecial::ChainLightning death_damage (ElectroDragonDie: 6 lightning strikes on death) is not handled in damage_unit() when Electro Dragon dies.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 13.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 510.0, Speed = 3.5s, Range = 2.5t
- **Passive / Periodic Special Abilities:** Special = `{"ChainLightning": {"max_targets": 5, "chain_range": 3.0, "decay": 0.8, "death_damage": 870.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Yeti` — Yeti (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Yeti",
  "name": "Yeti",
  "category": "Elixir",
  "max_level": 8,
  "housing_space": 18,
  "max_hp": 4650.0,
  "dps": 380.0,
  "damage_per_hit": 380.0,
  "attack_speed_sec": 1.0,
  "move_speed": 12.0,
  "range": 0.8,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": {
    "YetiSpawner": {
      "yetimites_on_death": 14,
      "hp_per_spawn": 600.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Yeti",
  "VisualLevel": "8",
  "HousingSpace": "18",
  "Hitpoints": "4650",
  "DPS": "380",
  "AttackRange": "80",
  "AttackSpeed": "1000",
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
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 380.0, Speed = 1.0s, Range = 0.8t
- **Passive / Periodic Special Abilities:** Special = `{"YetiSpawner": {"yetimites_on_death": 14, "hp_per_spawn": 600.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `DragonRider` — Dragon Rider (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "DragonRider",
  "name": "Dragon Rider",
  "category": "Elixir",
  "max_level": 6,
  "housing_space": 25,
  "max_hp": 6000.0,
  "dps": 510.0,
  "damage_per_hit": 612.0,
  "attack_speed_sec": 1.2,
  "move_speed": 20.0,
  "range": 3.5,
  "splash_radius": 0.0,
  "movement": "Air",
  "target_domain": "GroundAndAir",
  "preferred_target": "Defenses",
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
  "Name": "Dragon Rider",
  "VisualLevel": "6",
  "HousingSpace": "25",
  "Hitpoints": "5900",
  "DPS": "490",
  "AttackRange": "350",
  "AttackSpeed": "1200",
  "Speed": "250",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "DragonRiderProjectile 3"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 510.0, Speed = 1.2s, Range = 3.5t
- **Passive / Periodic Special Abilities:** Special = `{"DeathSplash": {"damage": 1200.0, "radius": 2.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ElectroTitan` — Electro Titan (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "ElectroTitan",
  "name": "Electro Titan",
  "category": "Elixir",
  "max_level": 5,
  "housing_space": 32,
  "max_hp": 9200.0,
  "dps": 270.0,
  "damage_per_hit": 405.0,
  "attack_speed_sec": 1.5,
  "move_speed": 16.0,
  "range": 1.25,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "ElectricAura": {
      "radius": 3.5,
      "dps": 150.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Electro Titan",
  "VisualLevel": "5",
  "HousingSpace": "32",
  "Hitpoints": "9200",
  "DPS": "270",
  "AttackRange": "125",
  "AttackSpeed": "1500",
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
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 270.0, Speed = 1.5s, Range = 1.25t
- **Passive / Periodic Special Abilities:** Special = `{"ElectricAura": {"radius": 3.5, "dps": 150.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RootRider` — Root Rider (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "RootRider",
  "name": "Root Rider",
  "category": "Elixir",
  "max_level": 4,
  "housing_space": 20,
  "max_hp": 6700.0,
  "dps": 125.0,
  "damage_per_hit": 275.0,
  "attack_speed_sec": 2.2,
  "move_speed": 12.0,
  "range": 1.0,
  "splash_radius": 0.0,
  "movement": {
    "WallCrusher": {
      "wall_dps": 10000
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
  "Name": "Root Rider",
  "VisualLevel": "4",
  "HousingSpace": "20",
  "Hitpoints": "6700",
  "DPS": "125",
  "AttackRange": "100",
  "AttackSpeed": "2200",
  "Speed": "150",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 12.0, Mode = {'WallCrusher': {'wall_dps': 10000}}
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 125.0, Speed = 2.2s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Thrower` — Thrower (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Thrower",
  "name": "Thrower",
  "category": "Elixir",
  "max_level": 4,
  "housing_space": 16,
  "max_hp": 2650.0,
  "dps": 230.0,
  "damage_per_hit": 575.0,
  "attack_speed_sec": 2.5,
  "move_speed": 16.0,
  "range": 6.0,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Thrower",
  "VisualLevel": "4",
  "HousingSpace": "16",
  "Hitpoints": "2650",
  "DPS": "230",
  "AttackRange": "600",
  "AttackSpeed": "2500",
  "Speed": "200",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "ThrowerProjectile4"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 16.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 230.0, Speed = 2.5s, Range = 6.0t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `MeteorGolem` — Meteor Golem (Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "MeteorGolem",
  "name": "Meteor Golem",
  "category": "Elixir",
  "max_level": 3,
  "housing_space": 40,
  "max_hp": 17500.0,
  "dps": 580.0,
  "damage_per_hit": 580.0,
  "attack_speed_sec": 1.0,
  "move_speed": 12.0,
  "range": 5.0,
  "splash_radius": 1.2,
  "movement": {
    "WallCrusher": {
      "wall_dps": 6000
    }
  },
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": {
    "SplitOnDeath": {
      "unit": "Meteormite",
      "count": 6,
      "death_damage": 1400.0,
      "radius": 2.5
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Meteor Golem",
  "VisualLevel": "3",
  "HousingSpace": "40",
  "Hitpoints": "17500",
  "DPS": "580",
  "AttackRange": "500",
  "AttackSpeed": "1000",
  "Speed": "150",
  "DamageRadius": "100",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "MeteoriteGolemProjectileLvl3"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 12.0, Mode = {'WallCrusher': {'wall_dps': 6000}}
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 580.0, Speed = 1.0s, Range = 5.0t
- **Passive / Periodic Special Abilities:** Special = `{"SplitOnDeath": {"unit": "Meteormite", "count": 6, "death_damage": 1400.0, "radius": 2.5}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
