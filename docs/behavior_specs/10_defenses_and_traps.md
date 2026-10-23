# Defenses & Traps (21 Defenses + 8 Traps) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `TownHall` — Town Hall 18 (Building (TownHall))

### 1. Current `coc-data` Specification
```json
{
  "id": "TownHall",
  "name": "Town Hall 18",
  "category": "TownHall",
  "max_level": 18,
  "max_count": 1,
  "footprint": 4,
  "max_hp": 10800.0,
  "dps": 0.0,
  "damage_per_shot": 0.0,
  "attack_speed_sec": 0.0,
  "min_range": 0.0,
  "max_range": 0.0,
  "splash_radius": 0.0,
  "target_domain": "None",
  "default_mode": "GuardianLogger",
  "available_modes": [
    "GuardianLogger",
    "GuardianLongshot",
    "GuardianSmasher"
  ],
  "special": "TownHallGuardian",
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Town Hall",
  "BuildingLevel": "18",
  "Hitpoints": "10800"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = None
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 0.0, Speed = 0.0s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"TownHallGuardian"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ArcherTower` — Archer Tower (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "ArcherTower",
  "name": "Archer Tower",
  "category": "Defense",
  "max_level": 21,
  "max_count": 2,
  "footprint": 3,
  "max_hp": 1800.0,
  "dps": 145.0,
  "damage_per_shot": 72.5,
  "attack_speed_sec": 0.5,
  "min_range": 0.0,
  "max_range": 10.0,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": "None",
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Archer Tower",
  "BuildingLevel": "21",
  "Hitpoints": "1800",
  "DPS": "145",
  "Projectile": "Tower Arrow Fire3"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 145.0, Speed = 0.5s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `MultiArcherTower` — Multi-Archer Tower (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "MultiArcherTower",
  "name": "Multi-Archer Tower",
  "category": "Defense",
  "max_level": 4,
  "max_count": 3,
  "footprint": 3,
  "max_hp": 5500.0,
  "dps": 363.0,
  "damage_per_shot": 73.0,
  "attack_speed_sec": 0.6,
  "min_range": 0.0,
  "max_range": 10.0,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "MultiTarget": {
      "targets": 3
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Multi Archer Tower",
  "BuildingLevel": "4",
  "Hitpoints": "5500",
  "Damage": "73"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 363.0, Speed = 0.6s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"MultiTarget": {"targets": 3}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RicochetCannon` — Ricochet Cannon (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "RicochetCannon",
  "name": "Ricochet Cannon",
  "category": "Defense",
  "max_level": 4,
  "max_count": 3,
  "footprint": 3,
  "max_hp": 6100.0,
  "dps": 412.0,
  "damage_per_shot": 329.6,
  "attack_speed_sec": 0.8,
  "min_range": 0.0,
  "max_range": 9.0,
  "splash_radius": 0.0,
  "target_domain": "Ground",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "Ricochet": {
      "bounce_range": 4.0,
      "bounce_mult": 1.0
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Ricochet Cannon",
  "BuildingLevel": "4",
  "Hitpoints": "6100",
  "DPS": "412",
  "Projectile": "MergedCannonProjectile lvl4"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 412.0, Speed = 0.8s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"Ricochet": {"bounce_range": 4.0, "bounce_mult": 1.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Cannon` — Cannon (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "Cannon",
  "name": "Cannon",
  "category": "Defense",
  "max_level": 18,
  "max_count": 1,
  "footprint": 3,
  "max_hp": 2250.0,
  "dps": 160.0,
  "damage_per_shot": 128.0,
  "attack_speed_sec": 0.8,
  "min_range": 0.0,
  "max_range": 9.0,
  "splash_radius": 0.0,
  "target_domain": "Ground",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": "None",
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Cannon",
  "BuildingLevel": "21",
  "Hitpoints": "2250",
  "DPS": "160",
  "Projectile": "Cannonball16"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 160.0, Speed = 0.8s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Mortar` — Mortar (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "Mortar",
  "name": "Mortar",
  "category": "Defense",
  "max_level": 18,
  "max_count": 4,
  "footprint": 3,
  "max_hp": 2550.0,
  "dps": 72.0,
  "damage_per_shot": 360.0,
  "attack_speed_sec": 5.0,
  "min_range": 4.0,
  "max_range": 11.0,
  "splash_radius": 1.5,
  "target_domain": "Ground",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": "None",
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Mortar",
  "BuildingLevel": "18",
  "Hitpoints": "2550",
  "DPS": "72",
  "Projectile": "Mortar Ammo lvl18"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 72.0, Speed = 5.0s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `AirDefense` — Air Defense (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "AirDefense",
  "name": "Air Defense",
  "category": "Defense",
  "max_level": 16,
  "max_count": 4,
  "footprint": 3,
  "max_hp": 2000.0,
  "dps": 700.0,
  "damage_per_shot": 700.0,
  "attack_speed_sec": 1.0,
  "min_range": 0.0,
  "max_range": 10.0,
  "splash_radius": 0.0,
  "target_domain": "Air",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": "None",
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Air Defense",
  "BuildingLevel": "16",
  "Hitpoints": "2000",
  "DPS": "700",
  "Projectile": "Firework16"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Air
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 700.0, Speed = 1.0s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `WizardTower` — Wizard Tower (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "WizardTower",
  "name": "Wizard Tower",
  "category": "Defense",
  "max_level": 17,
  "max_count": 2,
  "footprint": 3,
  "max_hp": 3300.0,
  "dps": 110.0,
  "damage_per_shot": 143.0,
  "attack_speed_sec": 1.3,
  "min_range": 0.0,
  "max_range": 7.0,
  "splash_radius": 1.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": "None",
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Wizard Tower",
  "BuildingLevel": "17",
  "Hitpoints": "3300",
  "DPS": "110",
  "Projectile": "ps_chr_WizardAttack_TowerProjectile_lvl4"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 110.0, Speed = 1.3s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SuperWizardTower` — Super Wizard Tower (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "SuperWizardTower",
  "name": "Super Wizard Tower",
  "category": "Defense",
  "max_level": 2,
  "max_count": 2,
  "footprint": 3,
  "max_hp": 6300.0,
  "dps": 320.0,
  "damage_per_shot": 416.0,
  "attack_speed_sec": 1.3,
  "min_range": 0.0,
  "max_range": 8.0,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "ChainLightning": {
      "max_chains": 15,
      "chain_range": 4.0,
      "chain_mult": 0.4
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Super Wizard Tower",
  "BuildingLevel": "2",
  "Hitpoints": "6300",
  "DPS": "320"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 320.0, Speed = 1.3s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"ChainLightning": {"max_chains": 15, "chain_range": 4.0, "chain_mult": 0.4}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `AirSweeper` — Air Sweeper (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "AirSweeper",
  "name": "Air Sweeper",
  "category": "Defense",
  "max_level": 7,
  "max_count": 2,
  "footprint": 2,
  "max_hp": 1050.0,
  "dps": 0.0,
  "damage_per_shot": 0.0,
  "attack_speed_sec": 5.0,
  "min_range": 1.0,
  "max_range": 15.0,
  "splash_radius": 0.0,
  "target_domain": "Air",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "AirSweeper": {
      "push_tiles": 4.0,
      "arc_deg": 105.0,
      "rotate_step_deg": 45.0
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Air Sweeper",
  "BuildingLevel": "7",
  "Hitpoints": "1050"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Air
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 0.0, Speed = 5.0s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"AirSweeper": {"push_tiles": 4.0, "arc_deg": 105.0, "rotate_step_deg": 45.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `HiddenTesla` — Hidden Tesla (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "HiddenTesla",
  "name": "Hidden Tesla",
  "category": "Defense",
  "max_level": 17,
  "max_count": 5,
  "footprint": 2,
  "max_hp": 1750.0,
  "dps": 190.0,
  "damage_per_shot": 114.0,
  "attack_speed_sec": 0.6,
  "min_range": 0.0,
  "max_range": 7.0,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "HiddenTesla": {
      "trigger_range": 6.0
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Hidden Tesla",
  "BuildingLevel": "17",
  "Hitpoints": "1750",
  "DPS": "190"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 190.0, Speed = 0.6s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"HiddenTesla": {"trigger_range": 6.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `BombTower` — Bomb Tower (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "BombTower",
  "name": "Bomb Tower",
  "category": "Defense",
  "max_level": 13,
  "max_count": 2,
  "footprint": 3,
  "max_hp": 3050.0,
  "dps": 122.0,
  "damage_per_shot": 134.2,
  "attack_speed_sec": 1.1,
  "min_range": 0.0,
  "max_range": 6.0,
  "splash_radius": 1.5,
  "target_domain": "Ground",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "DeathBomb": {
      "death_damage": 700.0,
      "death_radius": 2.75
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Bomb Tower",
  "BuildingLevel": "13",
  "Hitpoints": "3050",
  "DPS": "122",
  "Projectile": "Bomb Tower Ammo3"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Ground
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 122.0, Speed = 1.1s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"DeathBomb": {"death_damage": 700.0, "death_radius": 2.75}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `XBow` — X-Bow (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "XBow",
  "name": "X-Bow",
  "category": "Defense",
  "max_level": 13,
  "max_count": 4,
  "footprint": 3,
  "max_hp": 5000.0,
  "dps": 245.0,
  "damage_per_shot": 49.0,
  "attack_speed_sec": 0.2,
  "min_range": 0.0,
  "max_range": 11.5,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "XBowAirAndGround",
  "available_modes": [
    "XBowAirAndGround",
    "XBowGround"
  ],
  "special": "None",
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "X-Bow",
  "BuildingLevel": "13",
  "Hitpoints": "5000",
  "DPS": "245",
  "Projectile": "X-Bow Projectile 7"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 245.0, Speed = 0.2s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `InfernoTower` — Inferno Tower (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "InfernoTower",
  "name": "Inferno Tower",
  "category": "Defense",
  "max_level": 12,
  "max_count": 3,
  "footprint": 2,
  "max_hp": 5100.0,
  "dps": 155.0,
  "damage_per_shot": 31.0,
  "attack_speed_sec": 0.2,
  "min_range": 0.0,
  "max_range": 10.0,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "InfernoMulti",
  "available_modes": [
    "InfernoMulti",
    "InfernoSingle"
  ],
  "special": {
    "InfernoRamp": {
      "dps_stage1": 155.0,
      "dps_stage2": 330.0,
      "dps_stage3": 3300.0
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Inferno Tower",
  "BuildingLevel": "12",
  "Hitpoints": "5100",
  "DPS": "155"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 155.0, Speed = 0.2s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"InfernoRamp": {"dps_stage1": 155.0, "dps_stage2": 330.0, "dps_stage3": 3300.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Scattershot` — Scattershot (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "Scattershot",
  "name": "Scattershot",
  "category": "Defense",
  "max_level": 7,
  "max_count": 2,
  "footprint": 3,
  "max_hp": 5800.0,
  "dps": 190.0,
  "damage_per_shot": 570.0,
  "attack_speed_sec": 3.0,
  "min_range": 3.0,
  "max_range": 10.0,
  "splash_radius": 1.2,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "ConeSplash": {
      "cone_range": 5.0,
      "cone_damage": 380.0
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Scattershot",
  "BuildingLevel": "7",
  "Hitpoints": "5800",
  "DPS": "190",
  "Projectile": "Scattershot Projectile 7"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 190.0, Speed = 3.0s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"ConeSplash": {"cone_range": 5.0, "cone_damage": 380.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `BuildersHut` — Builder's Hut (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "BuildersHut",
  "name": "Builder's Hut",
  "category": "Defense",
  "max_level": 8,
  "max_count": 5,
  "footprint": 2,
  "max_hp": 2100.0,
  "dps": 180.0,
  "damage_per_shot": 72.0,
  "attack_speed_sec": 0.4,
  "min_range": 0.0,
  "max_range": 7.0,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "BuilderRepair": {
      "repair_hps": 95.0,
      "repair_range": 7.0
    }
  },
  "counts_for_destruction": true
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
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 180.0, Speed = 0.4s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"BuilderRepair": {"repair_hps": 95.0, "repair_range": 7.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SpellTower` — Spell Tower (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "SpellTower",
  "name": "Spell Tower",
  "category": "Defense",
  "max_level": 4,
  "max_count": 2,
  "footprint": 2,
  "max_hp": 3200.0,
  "dps": 0.0,
  "damage_per_shot": 0.0,
  "attack_speed_sec": 1.0,
  "min_range": 0.0,
  "max_range": 9.0,
  "splash_radius": 5.0,
  "target_domain": "GroundAndAir",
  "default_mode": "SpellTowerPoison",
  "available_modes": [
    "SpellTowerRage",
    "SpellTowerPoison",
    "SpellTowerInvisibility",
    "SpellTowerEarthquake"
  ],
  "special": {
    "SpellCaster": {
      "cooldown_sec": 60.0
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Spell Tower",
  "BuildingLevel": "4",
  "Hitpoints": "3200"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 0.0, Speed = 1.0s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"SpellCaster": {"cooldown_sec": 60.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Monolith` — Monolith (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "Monolith",
  "name": "Monolith",
  "category": "Defense",
  "max_level": 5,
  "max_count": 1,
  "footprint": 3,
  "max_hp": 5959.0,
  "dps": 225.0,
  "damage_per_shot": 337.5,
  "attack_speed_sec": 1.5,
  "min_range": 0.0,
  "max_range": 11.0,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "PercentMaxHp": {
      "bonus_pct": 0.15
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Monolith",
  "BuildingLevel": "5",
  "Hitpoints": "5959",
  "DPS": "225",
  "Projectile": "MonolithProjectileMin;MonolithProjectileMed;MonolithProjectileMax"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 225.0, Speed = 1.5s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"PercentMaxHp": {"bonus_pct": 0.15}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `MultiGearTower` — Multi-Gear Tower (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "MultiGearTower",
  "name": "Multi-Gear Tower",
  "category": "Defense",
  "max_level": 3,
  "max_count": 1,
  "footprint": 3,
  "max_hp": 4350.0,
  "dps": 390.0,
  "damage_per_shot": 390.0,
  "attack_speed_sec": 1.0,
  "min_range": 0.0,
  "max_range": 12.0,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "MultiGearLongRange",
  "available_modes": [
    "MultiGearLongRange",
    "MultiGearFastAttack"
  ],
  "special": "None",
  "counts_for_destruction": true
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
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 390.0, Speed = 1.0s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Firespitter` — Firespitter (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "Firespitter",
  "name": "Firespitter",
  "category": "Defense",
  "max_level": 3,
  "max_count": 2,
  "footprint": 3,
  "max_hp": 5300.0,
  "dps": 456.0,
  "damage_per_shot": 91.2,
  "attack_speed_sec": 0.2,
  "min_range": 0.0,
  "max_range": 16.0,
  "splash_radius": 0.5,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "DirectionalPierce": {
      "arc_deg": 150.0,
      "rotate_step_deg": 90.0,
      "pierce_count": 2,
      "pierce_radius": 0.5,
      "extra_range": 1.0
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Firespitter",
  "BuildingLevel": "3",
  "Hitpoints": "5300",
  "DPS": "456"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 456.0, Speed = 0.2s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"DirectionalPierce": {"arc_deg": 150.0, "rotate_step_deg": 90.0, "pierce_count": 2, "pierce_radius": 0.5, "extra_range": 1.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `RevengeTower` — Revenge Tower (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "RevengeTower",
  "name": "Revenge Tower",
  "category": "Defense",
  "max_level": 2,
  "max_count": 1,
  "footprint": 3,
  "max_hp": 6200.0,
  "dps": 416.0,
  "damage_per_shot": 500.0,
  "attack_speed_sec": 1.2,
  "min_range": 0.0,
  "max_range": 11.0,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": "RevengeStages",
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Revenge Tower",
  "BuildingLevel": "2",
  "Hitpoints": "6200",
  "Damage": "60"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 416.0, Speed = 1.2s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"RevengeStages"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `CraftingStation` — Hot Candle (Building (Defense))

### 1. Current `coc-data` Specification
```json
{
  "id": "CraftingStation",
  "name": "Hot Candle",
  "category": "Defense",
  "max_level": 30,
  "max_count": 1,
  "footprint": 3,
  "max_hp": 6000.0,
  "dps": 1500.0,
  "damage_per_shot": 125.0,
  "attack_speed_sec": 0.5,
  "min_range": 0.0,
  "max_range": 10.5,
  "splash_radius": 0.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": {
    "HotCandle": {
      "stage1_flames": 6,
      "stage2_flames": 4,
      "stage3_flames": 3,
      "first_decay_sec": 78.0,
      "second_decay_sec": 131.0
    }
  },
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Crafting Station",
  "BuildingLevel": "1",
  "Hitpoints": "1000"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 1500.0, Speed = 0.5s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{"HotCandle": {"stage1_flames": 6, "stage2_flames": 4, "stage3_flames": 3, "first_decay_sec": 78.0, "second_decay_sec": 131.0}}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `ClanCastle` — Clan Castle (Building (Resource))

### 1. Current `coc-data` Specification
```json
{
  "id": "ClanCastle",
  "name": "Clan Castle",
  "category": "Resource",
  "max_level": 14,
  "max_count": 1,
  "footprint": 3,
  "max_hp": 6000.0,
  "dps": 0.0,
  "damage_per_shot": 0.0,
  "attack_speed_sec": 0.0,
  "min_range": 0.0,
  "max_range": 13.0,
  "splash_radius": 0.0,
  "target_domain": "None",
  "default_mode": "Default",
  "available_modes": [
    "Default"
  ],
  "special": "None",
  "counts_for_destruction": true
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Clan Castle",
  "BuildingLevel": "14",
  "HousingSpace": "55",
  "Hitpoints": "6000"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = None
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = 0.0, Speed = 0.0s, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `"None"`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `Bomb` — Bomb (Trap)

### 1. Current `coc-data` Specification
```json
{
  "id": "Bomb",
  "name": "Bomb",
  "max_level": 14,
  "max_count": 8,
  "footprint": 1,
  "trigger_radius": 1.5,
  "target_domain": "Ground",
  "default_mode": "Default",
  "effect": {
    "AreaDamage": {
      "damage": 200.0,
      "splash_radius": 3.0,
      "knockback_tiles": 1.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Bomb",
  "Level": "14",
  "Damage": "200",
  "DamageRadius": "300"
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

## `SpringTrap` — Spring Trap (Trap)

### 1. Current `coc-data` Specification
```json
{
  "id": "SpringTrap",
  "name": "Spring Trap",
  "max_level": 13,
  "max_count": 9,
  "footprint": 1,
  "trigger_radius": 1.0,
  "target_domain": "Ground",
  "default_mode": "Default",
  "effect": {
    "Spring": {
      "eject_max_housing": 18,
      "heavy_damage": 1400.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Spring Trap",
  "Level": "13",
  "Damage": "1400",
  "DamageRadius": "0"
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

## `AirBomb` — Air Bomb (Trap)

### 1. Current `coc-data` Specification
```json
{
  "id": "AirBomb",
  "name": "Air Bomb",
  "max_level": 13,
  "max_count": 8,
  "footprint": 1,
  "trigger_radius": 4.0,
  "target_domain": "Air",
  "default_mode": "Default",
  "effect": {
    "AreaDamage": {
      "damage": 425.0,
      "splash_radius": 3.0,
      "knockback_tiles": 0.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Air Bomb",
  "Level": "13",
  "Damage": "425",
  "DamageRadius": "300",
  "Projectile": "AirTrapBalloon_lvl13"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Air
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GiantBomb` — Giant Bomb (Trap)

### 1. Current `coc-data` Specification
```json
{
  "id": "GiantBomb",
  "name": "Giant Bomb",
  "max_level": 12,
  "max_count": 8,
  "footprint": 2,
  "trigger_radius": 2.0,
  "target_domain": "Ground",
  "default_mode": "Default",
  "effect": {
    "AreaDamage": {
      "damage": 490.0,
      "splash_radius": 4.2,
      "knockback_tiles": 1.5
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Giant Bomb",
  "Level": "12",
  "Damage": "490",
  "DamageRadius": "420"
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

## `SeekingAirMine` — Seeking Air Mine (Trap)

### 1. Current `coc-data` Specification
```json
{
  "id": "SeekingAirMine",
  "name": "Seeking Air Mine",
  "max_level": 8,
  "max_count": 9,
  "footprint": 1,
  "trigger_radius": 4.0,
  "target_domain": "Air",
  "default_mode": "Default",
  "effect": {
    "SingleTargetAirMine": {
      "damage": 3350.0,
      "min_housing": 5
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Seeking Air Mine",
  "Level": "8",
  "Damage": "3350",
  "DamageRadius": "0",
  "Projectile": "LargeDarkElixirBalloon_lvl7"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = Air
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `SkeletonTrap` — Skeleton Trap (Trap)

### 1. Current `coc-data` Specification
```json
{
  "id": "SkeletonTrap",
  "name": "Skeleton Trap",
  "max_level": 5,
  "max_count": 4,
  "footprint": 1,
  "trigger_radius": 5.0,
  "target_domain": "GroundAndAir",
  "default_mode": "SkeletonGround",
  "effect": {
    "SpawnSkeletons": {
      "count": 5
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Skeleton Trap",
  "Level": "5",
  "Damage": "0",
  "DamageRadius": "0"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `TornadoTrap` — Tornado Trap (Trap)

### 1. Current `coc-data` Specification
```json
{
  "id": "TornadoTrap",
  "name": "Tornado Trap",
  "max_level": 3,
  "max_count": 1,
  "footprint": 1,
  "trigger_radius": 3.0,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "effect": {
    "Tornado": {
      "duration_sec": 7.0,
      "dps": 8.0,
      "pull_radius": 3.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Tornado Trap",
  "Level": "3",
  "DamageRadius": "300"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---

## `GigaBomb` — Giga Bomb (Trap)

### 1. Current `coc-data` Specification
```json
{
  "id": "GigaBomb",
  "name": "Giga Bomb",
  "max_level": 4,
  "max_count": 1,
  "footprint": 2,
  "trigger_radius": 3.5,
  "target_domain": "GroundAndAir",
  "default_mode": "Default",
  "effect": {
    "GigaBlast": {
      "damage": 1400.0,
      "splash_radius": 4.5,
      "knockback_tiles": 2.5,
      "min_housing_trigger": 18
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Giga Bomb",
  "Level": "4",
  "Damage": "1400",
  "DamageRadius": "450"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] Audit current `sim.rs` implementation against video/CSV rules below.

### 4. Verified Behavioral Specification
- **Video / Live Gameplay Reference:** Clash of Clans live game capture & Supercell TH18 demonstration footage
- **Deployment & Initial State ($t = 0$):** Documented in engine alignment table.
- **Movement & Wall/Obstacle Interaction:** Speed = N/A, Mode = N/A
- **Target Selection & Retargeting AI:** Preferred = Any, Domain = GroundAndAir
- **Attack / Heal Cadence & Projectile Mechanics:** DPS = N/A, Speed = N/As, Range = N/At
- **Passive / Periodic Special Abilities:** Special = `{}`
- **Active Ability / Spell Zone Mechanics:** Hitbox uses footprint-edge calculation (`building_edge_dist`).
- **On-Death / Expiration / Transformation:** Death handlers aligned with `damage_unit` in `sim.rs`.

---
