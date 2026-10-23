# Spells (18) — TH18 Behavioral Specification

> See `AI_VIDEO_ANALYSIS_INSTRUCTIONS.md` for the 8-point verification checklist.

---

## `Lightning` — Lightning Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Lightning",
  "name": "Lightning Spell",
  "is_dark": false,
  "max_level": 13,
  "housing_space": 1,
  "radius": 2.0,
  "duration_sec": 0.1,
  "effect": {
    "InstantDamage": {
      "damage": 720.0,
      "stun_sec": 0.1
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Lightning",
  "Level": "13",
  "HousingSpace": "1",
  "Damage": "720",
  "Radius": "200",
  "NumberOfHits": "1",
  "TimeBetweenHitsMS": "400",
  "FreezeTimeMS": "100",
  "StunTimeMS": "100"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Instant VisualEvent::Explosion is wiped out if step_ticks(1) runs immediately after apply_action_json().

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

## `Healing` — Healing Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Healing",
  "name": "Healing Spell",
  "is_dark": false,
  "max_level": 12,
  "housing_space": 2,
  "radius": 5.0,
  "duration_sec": 12.3,
  "effect": {
    "HealOverTime": {
      "total_heal": 3075.0,
      "hero_mult": 0.55
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Healing",
  "Level": "12",
  "HousingSpace": "2",
  "Damage": "-75",
  "Radius": "500",
  "NumberOfHits": "41",
  "TimeBetweenHitsMS": "300"
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

## `Rage` — Rage Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Rage",
  "name": "Rage Spell",
  "is_dark": false,
  "max_level": 7,
  "housing_space": 2,
  "radius": 5.0,
  "duration_sec": 18.0,
  "effect": {
    "RageBuff": {
      "damage_mult": 2.9,
      "hero_damage_mult": 2.9,
      "speed_bonus": 32.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Rage",
  "Level": "7",
  "HousingSpace": "2",
  "Radius": "500",
  "NumberOfHits": "60",
  "TimeBetweenHitsMS": "300",
  "BoostTimeMS": "1000"
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

## `Jump` — Jump Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Jump",
  "name": "Jump Spell",
  "is_dark": false,
  "max_level": 5,
  "housing_space": 2,
  "radius": 3.5,
  "duration_sec": 100.25,
  "effect": "JumpWalls"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Jump",
  "Level": "5",
  "HousingSpace": "2",
  "Radius": "350",
  "NumberOfHits": "401",
  "TimeBetweenHitsMS": "250"
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

## `Freeze` — Freeze Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Freeze",
  "name": "Freeze Spell",
  "is_dark": false,
  "max_level": 8,
  "housing_space": 1,
  "radius": 3.5,
  "duration_sec": 6.0,
  "effect": "FreezeEnemies"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Freeze",
  "Level": "8",
  "HousingSpace": "1",
  "Radius": "350",
  "NumberOfHits": "1",
  "TimeBetweenHitsMS": "0",
  "FreezeTimeMS": "6000"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Uses center-to-center dist() instead of building_edge_dist(), missing large buildings whose edges lie inside the 3.5t ring.

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

## `Clone` — Clone Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Clone",
  "name": "Clone Spell",
  "is_dark": false,
  "max_level": 9,
  "housing_space": 3,
  "radius": 3.5,
  "duration_sec": 18.0,
  "effect": {
    "CloneUnits": {
      "max_housing": 48,
      "clone_lifetime_sec": 30.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Clone",
  "Level": "9",
  "HousingSpace": "3",
  "Radius": "350",
  "NumberOfHits": "60",
  "TimeBetweenHitsMS": "300",
  "DuplicateHousing": "48",
  "DuplicateLifetime": "30000"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Clones the same unit repeatedly on consecutive ticks instead of tracking already-cloned unit IDs per spell zone.

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

## `Invisibility` — Invisibility Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Invisibility",
  "name": "Invisibility Spell",
  "is_dark": false,
  "max_level": 4,
  "housing_space": 1,
  "radius": 4.0,
  "duration_sec": 4.25,
  "effect": "InvisibilityZone"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Invisibility",
  "Level": "4",
  "HousingSpace": "1",
  "Radius": "400",
  "NumberOfHits": "17",
  "TimeBetweenHitsMS": "250"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Uses center-to-center dist() instead of building_edge_dist() for buildings.

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

## `Recall` — Recall Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Recall",
  "name": "Recall Spell",
  "is_dark": false,
  "max_level": 7,
  "housing_space": 2,
  "radius": 5.0,
  "duration_sec": 0.1,
  "effect": {
    "RecallUnits": {
      "max_housing": 120
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Recall",
  "Level": "7",
  "HousingSpace": "2",
  "Damage": "0",
  "Radius": "500",
  "NumberOfHits": "1",
  "TimeBetweenHitsMS": "100",
  "BoostTimeMS": "0",
  "RecallHousing": "120"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Only recalls UnitKind::Troop; completely ignores Heroes and Pets and emits no VisualEvent.

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

## `Revive` — Revive Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Revive",
  "name": "Revive Spell",
  "is_dark": false,
  "max_level": 5,
  "housing_space": 2,
  "radius": 8.0,
  "duration_sec": 0.1,
  "effect": {
    "ReviveHero": {
      "hp_pct": 0.8
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Revive",
  "Level": "5",
  "HousingSpace": "2",
  "Radius": "0",
  "NumberOfHits": "1",
  "TimeBetweenHitsMS": "0"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Does not reset negative status timers/stale targets on the revived Hero and emits no VisualEvent.

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

## `Totem` — Totem Spell (Elixir Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Totem",
  "name": "Totem Spell",
  "is_dark": false,
  "max_level": 4,
  "housing_space": 1,
  "radius": 5.0,
  "duration_sec": 38.9,
  "effect": {
    "SummonTotem": {
      "hp": 13000.0,
      "decay_per_sec": 334.0,
      "stun_sec": 0.2
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Totem Spell",
  "Level": "4",
  "HousingSpace": "1",
  "Radius": "500",
  "NumberOfHits": "1",
  "TimeBetweenHitsMS": "100",
  "FreezeTimeMS": "200",
  "StunTimeMS": "200"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Ignores HP decay_per_sec (334 HP/s), does not stun defending units in radius, and lacks a sprite mapping in spriteLoader.ts.

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

## `Poison` — Poison Spell (Dark Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Poison",
  "name": "Poison Spell",
  "is_dark": true,
  "max_level": 12,
  "housing_space": 1,
  "radius": 4.0,
  "duration_sec": 16.0,
  "effect": {
    "PoisonZone": {
      "max_dps": 380.0,
      "speed_slow_pct": 0.52,
      "attack_slow_pct": 0.74
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Poison",
  "Level": "12",
  "HousingSpace": "1",
  "Radius": "400",
  "NumberOfHits": "40",
  "TimeBetweenHitsMS": "400",
  "BoostTimeMS": "500"
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

## `Earthquake` — Earthquake Spell (Dark Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Earthquake",
  "name": "Earthquake Spell",
  "is_dark": true,
  "max_level": 8,
  "housing_space": 1,
  "radius": 4.7,
  "duration_sec": 0.1,
  "effect": {
    "EarthquakePct": {
      "building_max_hp_pct": 0.29,
      "wall_mult": 5.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Earthquake",
  "Level": "8",
  "HousingSpace": "1",
  "Radius": "470",
  "NumberOfHits": "5",
  "TimeBetweenHitsMS": "400",
  "PreferredTarget": "Wall",
  "PreferredTargetDamageMod": "5"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Instant VisualEvent::Explosion is wiped out if step_ticks(1) runs immediately after apply_action_json().

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

## `Haste` — Haste Spell (Dark Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Haste",
  "name": "Haste Spell",
  "is_dark": true,
  "max_level": 7,
  "housing_space": 1,
  "radius": 5.0,
  "duration_sec": 30.25,
  "effect": {
    "HasteBuff": {
      "speed_bonus": 56.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Haste",
  "Level": "7",
  "HousingSpace": "1",
  "Radius": "500",
  "NumberOfHits": "121",
  "TimeBetweenHitsMS": "250",
  "BoostTimeMS": "1000"
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

## `SkeletonSpell` — Skeleton Spell (Dark Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "SkeletonSpell",
  "name": "Skeleton Spell",
  "is_dark": true,
  "max_level": 8,
  "housing_space": 1,
  "radius": 2.25,
  "duration_sec": 15.0,
  "effect": {
    "SpawnSkeletons": {
      "count": 19
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Skeleton Spell",
  "Level": "8",
  "HousingSpace": "1",
  "Radius": "225",
  "NumberOfHits": "1",
  "TimeBetweenHitsMS": "300",
  "UnitsToSpawn": "19",
  "SpawnDuration": "15000",
  "SpawnFirstGroupSize": "4"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Misinterprets SpawnDuration (15.0s) as a self-destruct timer on the skeletons instead of wave-spawning duration; skeletons should not self-destruct after 15s.

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

## `BatSpell` — Bat Spell (Dark Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "BatSpell",
  "name": "Bat Spell",
  "is_dark": true,
  "max_level": 8,
  "housing_space": 1,
  "radius": 2.25,
  "duration_sec": 13.8,
  "effect": {
    "SpawnBats": {
      "count": 25
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Bat Spell",
  "Level": "8",
  "HousingSpace": "1",
  "Damage": "0",
  "Radius": "225",
  "NumberOfHits": "1",
  "TimeBetweenHitsMS": "300",
  "BoostTimeMS": "0",
  "UnitsToSpawn": "25",
  "SpawnDuration": "13800",
  "SpawnFirstGroupSize": "2"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Misinterprets SpawnDuration (13.8s) as a self-destruct timer on the bats instead of wave-spawning duration; bats should not self-destruct after 13.8s.

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

## `Overgrowth` — Overgrowth Spell (Dark Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Overgrowth",
  "name": "Overgrowth Spell",
  "is_dark": true,
  "max_level": 5,
  "housing_space": 2,
  "radius": 6.0,
  "duration_sec": 26.0,
  "effect": "OvergrowthRoots"
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Overgrowth",
  "Level": "5",
  "HousingSpace": "2",
  "Radius": "600",
  "NumberOfHits": "1",
  "TimeBetweenHitsMS": "0",
  "FreezeTimeMS": "26000",
  "ShieldProtectionPercent": "100"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Uses center-to-center dist() instead of building_edge_dist() for buildings.

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

## `IceBlock` — Ice Block Spell (Dark Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "IceBlock",
  "name": "Ice Block Spell",
  "is_dark": true,
  "max_level": 6,
  "housing_space": 1,
  "radius": 5.0,
  "duration_sec": 7.0,
  "effect": {
    "IceBlockShield": {
      "damage_reduction_pct": 0.96
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "Ice Block",
  "Level": "6",
  "HousingSpace": "1",
  "Radius": "500",
  "NumberOfHits": "1",
  "TimeBetweenHitsMS": "0",
  "FreezeTimeMS": "7000",
  "GiveSpecialAbility": "IceBlockSpell"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Applies 96% damage shield without freezing allied units in place (FreezeTimeMS = 7000).

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

## `Angry` — Angry Spell (Dark Spell)

### 1. Current `coc-data` Specification
```json
{
  "id": "Angry",
  "name": "Angry Spell",
  "is_dark": true,
  "max_level": 4,
  "housing_space": 1,
  "radius": 6.0,
  "duration_sec": 25.0,
  "effect": {
    "AngryDefenses": {
      "damage_mult": 1.0
    }
  }
}
```

### 2. Decoded `coc_dumps/logic/*.csv` Reference (TH18 Max)
```json
{
  "Name": "AngrySpell",
  "Level": "4",
  "HousingSpace": "1",
  "Radius": "600",
  "NumberOfHits": "50",
  "TimeBetweenHitsMS": "100",
  "BoostTimeMS": "25000",
  "GiveSpecialAbility": "AngrySpellAnger"
}
```

### 3. Pre-Diagnosed `coc-engine` (`sim.rs`) Gaps
- [ ] **KNOWN ENGINE GAP:** Sets preferred_target = Defenses on allied units without clearing their current non-defense target or resetting repath_timer.

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
