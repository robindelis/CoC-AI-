# Dark Elixir Troops (13) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `Minion` — Minion (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Minion",
  "name": "Minion",
  "category": "DarkElixir",
  "max_level": 14,
  "housing_space": 2,
  "max_hp": 140.0,
  "dps": 92.0,
  "damage_per_hit": 92.0,
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
  "Name": "Minion",
  "VisualLevel": "14",
  "HousingSpace": "2",
  "Hitpoints": "140",
  "DPS": "92",
  "AttackRange": "225",
  "AttackSpeed": "1000",
  "Speed": "400",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "gargoyle_projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 92.0, Speed = 1.0s, Range = 2.25t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `HogRider` — Hog Rider (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "HogRider",
  "name": "Hog Rider",
  "category": "DarkElixir",
  "max_level": 15,
  "housing_space": 5,
  "max_hp": 1750.0,
  "dps": 250.0,
  "damage_per_hit": 250.0,
  "attack_speed_sec": 1.0,
  "move_speed": 24.0,
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
  "Name": "Hog Rider",
  "VisualLevel": "15",
  "HousingSpace": "5",
  "Hitpoints": "1750",
  "DPS": "250",
  "AttackRange": "60",
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
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Defenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 250.0, Speed = 1.0s, Range = 0.6t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Valkyrie` — Valkyrie (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Valkyrie",
  "name": "Valkyrie",
  "category": "DarkElixir",
  "max_level": 12,
  "housing_space": 8,
  "max_hp": 2900.0,
  "dps": 255.0,
  "damage_per_hit": 459.0,
  "attack_speed_sec": 1.8,
  "move_speed": 24.0,
  "range": 0.5,
  "splash_radius": 1.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": "None"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Valkyrie",
  "VisualLevel": "12",
  "HousingSpace": "8",
  "Hitpoints": "2900",
  "DPS": "255",
  "AttackRange": "50",
  "AttackSpeed": "1800",
  "Speed": "300",
  "DamageRadius": "100",
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
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 255.0, Speed = 1.8s, Range = 0.5t
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Golem` — Golem (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Golem",
  "name": "Golem",
  "category": "DarkElixir",
  "max_level": 15,
  "housing_space": 30,
  "max_hp": 10600.0,
  "dps": 120.0,
  "damage_per_hit": 288.0,
  "attack_speed_sec": 2.4,
  "move_speed": 12.0,
  "range": 1.0,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": {
    "SplitOnDeath": {
      "unit": "Golemite",
      "count": 4,
      "death_damage": 1050.0,
      "radius": 1.5
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Golem",
  "VisualLevel": "15",
  "HousingSpace": "30",
  "Hitpoints": "10600",
  "DPS": "120",
  "AttackRange": "100",
  "AttackSpeed": "2400",
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
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 120.0, Speed = 2.4s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `{"SplitOnDeath": {"unit": "Golemite", "count": 4, "death_damage": 1050.0, "radius": 1.5}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Witch` — Witch (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Witch",
  "name": "Witch",
  "category": "DarkElixir",
  "max_level": 8,
  "housing_space": 12,
  "max_hp": 650.0,
  "dps": 260.0,
  "damage_per_hit": 182.0,
  "attack_speed_sec": 0.7,
  "move_speed": 12.0,
  "range": 4.0,
  "splash_radius": 0.3,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "PeriodicSummoner": {
      "unit": "Skeleton",
      "count": 5,
      "interval_sec": 7.0,
      "max_active": 16
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Witch",
  "VisualLevel": "8",
  "HousingSpace": "12",
  "Hitpoints": "650",
  "DPS": "260",
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
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 260.0, Speed = 0.7s, Range = 4.0t
- **Passive / Periodic Special Abilities:** Special = `{"PeriodicSummoner": {"unit": "Skeleton", "count": 5, "interval_sec": 7.0, "max_active": 16}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `LavaHound` — Lava Hound (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "LavaHound",
  "name": "Lava Hound",
  "category": "DarkElixir",
  "max_level": 8,
  "housing_space": 30,
  "max_hp": 9500.0,
  "dps": 24.0,
  "damage_per_hit": 48.0,
  "attack_speed_sec": 2.0,
  "move_speed": 20.0,
  "range": 0.25,
  "splash_radius": 0.0,
  "movement": "Air",
  "target_domain": "Ground",
  "preferred_target": "AirDefenses",
  "special": {
    "SplitOnDeath": {
      "unit": "LavaPup",
      "count": 22,
      "death_damage": 450.0,
      "radius": 3.5
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Lava Hound",
  "VisualLevel": "8",
  "HousingSpace": "30",
  "Hitpoints": "9500",
  "DPS": "24",
  "AttackRange": "25",
  "AttackSpeed": "2000",
  "Speed": "250",
  "IsFlying": "TRUE",
  "IsJumper": "FALSE",
  "Projectile": "hound_projectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = Air
- **Target Selection & Retargeting AI:** Preferred = AirDefenses, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 24.0, Speed = 2.0s, Range = 0.25t
- **Passive / Periodic Special Abilities:** Special = `{"SplitOnDeath": {"unit": "LavaPup", "count": 22, "death_damage": 450.0, "radius": 3.5}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Bowler` — Bowler (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Bowler",
  "name": "Bowler",
  "category": "DarkElixir",
  "max_level": 10,
  "housing_space": 6,
  "max_hp": 860.0,
  "dps": 160.0,
  "damage_per_hit": 352.0,
  "attack_speed_sec": 2.2,
  "move_speed": 14.0,
  "range": 3.0,
  "splash_radius": 0.5,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Any",
  "special": {
    "BowlerDoubleBounce": {
      "bounce_dist": 4.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Bowler",
  "VisualLevel": "10",
  "HousingSpace": "6",
  "Hitpoints": "860",
  "DPS": "160",
  "AttackRange": "300",
  "AttackSpeed": "2200",
  "Speed": "175",
  "DamageRadius": "30",
  "IsFlying": "FALSE",
  "IsJumper": "FALSE",
  "Projectile": "trollBoulder_lvl10"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 14.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 160.0, Speed = 2.2s, Range = 3.0t
- **Passive / Periodic Special Abilities:** Special = `{"BowlerDoubleBounce": {"bounce_dist": 4.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `IceGolem` — Ice Golem (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "IceGolem",
  "name": "Ice Golem",
  "category": "DarkElixir",
  "max_level": 9,
  "housing_space": 15,
  "max_hp": 4350.0,
  "dps": 56.0,
  "damage_per_hit": 112.0,
  "attack_speed_sec": 2.0,
  "move_speed": 12.0,
  "range": 1.0,
  "splash_radius": 0.0,
  "movement": "Ground",
  "target_domain": "Ground",
  "preferred_target": "Defenses",
  "special": {
    "IceGolemFreeze": {
      "death_freeze_sec": 9.0,
      "radius": 7.5
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Ice Golem",
  "VisualLevel": "9",
  "HousingSpace": "15",
  "Hitpoints": "4350",
  "DPS": "56",
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
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 56.0, Speed = 2.0s, Range = 1.0t
- **Passive / Periodic Special Abilities:** Special = `{"IceGolemFreeze": {"death_freeze_sec": 9.0, "radius": 7.5}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Headhunter` — Headhunter (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Headhunter",
  "name": "Headhunter",
  "category": "DarkElixir",
  "max_level": 4,
  "housing_space": 6,
  "max_hp": 500.0,
  "dps": 135.0,
  "damage_per_hit": 81.0,
  "attack_speed_sec": 0.6,
  "move_speed": 32.0,
  "range": 3.0,
  "splash_radius": 0.0,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Heroes",
  "special": {
    "HeadhunterPoison": {
      "hero_mult": 4.0,
      "speed_slow": 0.46,
      "attack_slow": 0.68,
      "poison_dps": 300.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Headhunter",
  "VisualLevel": "4",
  "HousingSpace": "6",
  "Hitpoints": "500",
  "DPS": "135",
  "AttackRange": "300",
  "AttackSpeed": "600",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE",
  "Projectile": "Headhunter_Card_lvl4"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 32.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Heroes, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 135.0, Speed = 0.6s, Range = 3.0t
- **Passive / Periodic Special Abilities:** Special = `{"HeadhunterPoison": {"hero_mult": 4.0, "speed_slow": 0.46, "attack_slow": 0.68, "poison_dps": 300.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ApprenticeWarden` — Apprentice Warden (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "ApprenticeWarden",
  "name": "Apprentice Warden",
  "category": "DarkElixir",
  "max_level": 4,
  "housing_space": 20,
  "max_hp": 1950.0,
  "dps": 215.0,
  "damage_per_hit": 193.5,
  "attack_speed_sec": 0.9,
  "move_speed": 20.0,
  "range": 5.0,
  "splash_radius": 0.0,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "LifeAura": {
      "radius": 7.0,
      "hp_bonus_pct": 0.26
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Apprentice Warden",
  "VisualLevel": "4",
  "HousingSpace": "20",
  "Hitpoints": "1950",
  "DPS": "215",
  "AttackRange": "500",
  "AttackSpeed": "900",
  "Speed": "250",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE",
  "Projectile": "ApprenticeWarden_small2"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** TroopSpecial::LifeAura (7.0t radius, +26% HP cap up to cap) is defined in coc-data but never applied in sim.rs.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 20.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 215.0, Speed = 0.9s, Range = 5.0t
- **Passive / Periodic Special Abilities:** Special = `{"LifeAura": {"radius": 7.0, "hp_bonus_pct": 0.26}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Druid` — Druid (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Druid",
  "name": "Druid",
  "category": "DarkElixir",
  "max_level": 6,
  "housing_space": 16,
  "max_hp": 1850.0,
  "dps": 115.0,
  "damage_per_hit": 115.0,
  "attack_speed_sec": 1.0,
  "move_speed": 24.0,
  "range": 5.0,
  "splash_radius": 0.0,
  "movement": "JumpWalls",
  "target_domain": "GroundAndAir",
  "preferred_target": "AlliedAny",
  "special": {
    "DruidEvolution": {
      "heal_targets": 4,
      "evolve_after_sec": 30.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Druid",
  "VisualLevel": "6",
  "HousingSpace": "16",
  "Hitpoints": "1850",
  "DPS": "-115",
  "AttackRange": "500",
  "AttackSpeed": "1000",
  "Speed": "300",
  "IsFlying": "FALSE",
  "IsJumper": "TRUE",
  "Projectile": "BattleDruidProjectile"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Heals only 1 target per pulse instead of bouncing heal across up to 4 injured friendly targets (BattleDruidHeal).

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = 24.0, Mode = JumpWalls
- **Target Selection & Retargeting AI:** Preferred = AlliedAny, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 115.0, Speed = 1.0s, Range = 5.0t
- **Passive / Periodic Special Abilities:** Special = `{"DruidEvolution": {"heal_targets": 4, "evolve_after_sec": 30.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Furnace` — Furnace (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "Furnace",
  "name": "Furnace",
  "category": "DarkElixir",
  "max_level": 4,
  "housing_space": 18,
  "max_hp": 1800.0,
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
    "FurnaceSpawner": {
      "lifetime_sec": 60.0,
      "interval_sec": 0.8
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Furnace",
  "VisualLevel": "4",
  "HousingSpace": "18",
  "Hitpoints": "1800",
  "DPS": "4",
  "AttackRange": "1",
  "AttackSpeed": "800",
  "Speed": "0",
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
- **Passive / Periodic Special Abilities:** Special = `{"FurnaceSpawner": {"lifetime_sec": 60.0, "interval_sec": 0.8}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RuinWitch` — Ruin Witch (Dark Elixir Troop)

### 1. Current `coc-data` Specification
```json
{
  "id": "RuinWitch",
  "name": "Ruin Witch",
  "category": "DarkElixir",
  "max_level": 4,
  "housing_space": 26,
  "max_hp": 3050.0,
  "dps": 28.0,
  "damage_per_hit": 56.0,
  "attack_speed_sec": 2.0,
  "move_speed": 14.0,
  "range": 0.8,
  "splash_radius": 0.8,
  "movement": "Ground",
  "target_domain": "GroundAndAir",
  "preferred_target": "Any",
  "special": {
    "PeriodicSummoner": {
      "unit": "RuinKnight",
      "count": 2,
      "interval_sec": 8.0,
      "max_active": 6
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Ruin Witch",
  "VisualLevel": "4",
  "HousingSpace": "26",
  "Hitpoints": "3050",
  "DPS": "28",
  "AttackRange": "80",
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
- **Movement & Wall/Obstacle Interaction:** Speed = 14.0, Mode = Ground
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 28.0, Speed = 2.0s, Range = 0.8t
- **Passive / Periodic Special Abilities:** Special = `{"PeriodicSummoner": {"unit": "RuinKnight", "count": 2, "interval_sec": 8.0, "max_active": 6}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
