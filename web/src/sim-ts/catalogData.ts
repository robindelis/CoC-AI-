import { FullCatalog } from '../types';

export const FULL_CATALOG: FullCatalog = {
  "buildings": [
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
    },
    {
      "id": "ArcherTower",
      "name": "Archer Tower",
      "category": "Defense",
      "max_level": 21,
      "max_count": 3,
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
    {
      "id": "GoldStorage",
      "name": "Gold Storage",
      "category": "Resource",
      "max_level": 19,
      "max_count": 4,
      "footprint": 3,
      "max_hp": 4300.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "ElixirStorage",
      "name": "Elixir Storage",
      "category": "Resource",
      "max_level": 19,
      "max_count": 4,
      "footprint": 3,
      "max_hp": 4300.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "DarkElixirStorage",
      "name": "Dark Elixir Storage",
      "category": "Resource",
      "max_level": 13,
      "max_count": 1,
      "footprint": 3,
      "max_hp": 4800.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "GoldMine",
      "name": "Gold Mine",
      "category": "Resource",
      "max_level": 17,
      "max_count": 7,
      "footprint": 3,
      "max_hp": 1400.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "ElixirCollector",
      "name": "Elixir Collector",
      "category": "Resource",
      "max_level": 17,
      "max_count": 7,
      "footprint": 3,
      "max_hp": 1400.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "DarkElixirDrill",
      "name": "Dark Elixir Drill",
      "category": "Resource",
      "max_level": 11,
      "max_count": 3,
      "footprint": 3,
      "max_hp": 1600.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "ArmyCamp",
      "name": "Army Camp",
      "category": "Army",
      "max_level": 14,
      "max_count": 4,
      "footprint": 4,
      "max_hp": 950.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "Barracks",
      "name": "Barracks",
      "category": "Army",
      "max_level": 19,
      "max_count": 1,
      "footprint": 3,
      "max_hp": 1520.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "DarkBarracks",
      "name": "Dark Barracks",
      "category": "Army",
      "max_level": 13,
      "max_count": 1,
      "footprint": 3,
      "max_hp": 1100.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "Laboratory",
      "name": "Laboratory",
      "category": "Army",
      "max_level": 16,
      "max_count": 1,
      "footprint": 3,
      "max_hp": 1500.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "SpellFactory",
      "name": "Spell Factory",
      "category": "Army",
      "max_level": 9,
      "max_count": 1,
      "footprint": 3,
      "max_hp": 1150.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "DarkSpellFactory",
      "name": "Dark Spell Factory",
      "category": "Army",
      "max_level": 8,
      "max_count": 1,
      "footprint": 3,
      "max_hp": 1070.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "HeroHall",
      "name": "Hero Hall",
      "category": "Army",
      "max_level": 12,
      "max_count": 1,
      "footprint": 4,
      "max_hp": 6000.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "Blacksmith",
      "name": "Blacksmith",
      "category": "Army",
      "max_level": 10,
      "max_count": 1,
      "footprint": 3,
      "max_hp": 1600.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "Workshop",
      "name": "Workshop",
      "category": "Army",
      "max_level": 9,
      "max_count": 1,
      "footprint": 4,
      "max_hp": 1800.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "PetHouse",
      "name": "Pet House",
      "category": "Army",
      "max_level": 12,
      "max_count": 1,
      "footprint": 3,
      "max_hp": 1400.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "HelperHut",
      "name": "Helper Hut",
      "category": "Other",
      "max_level": 1,
      "max_count": 1,
      "footprint": 3,
      "max_hp": 500.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "BobsHut",
      "name": "B.O.B's Hut",
      "category": "Other",
      "max_level": 1,
      "max_count": 1,
      "footprint": 2,
      "max_hp": 250.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": true
    },
    {
      "id": "Wall",
      "name": "Wall",
      "category": "Wall",
      "max_level": 19,
      "max_count": 325,
      "footprint": 1,
      "max_hp": 14000.0,
      "dps": 0.0,
      "damage_per_shot": 0.0,
      "attack_speed_sec": 0.0,
      "min_range": 0.0,
      "max_range": 0.0,
      "splash_radius": 0.0,
      "target_domain": "None",
      "default_mode": "Default",
      "available_modes": [
        "Default"
      ],
      "special": "None",
      "counts_for_destruction": false
    }
  ],
  "traps": [
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
  ],
  "troops": [
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
          "interval_sec": 2.7
        }
      }
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
      "range": 20.0,
      "splash_radius": 1.2,
      "movement": "Ground",
      "target_domain": "Ground",
      "preferred_target": "TownHall",
      "special": {
        "SiegeWallMultiplier": {
          "wall_mult": 4.0,
          "hp_decay_per_sec": 156.0
        }
      }
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
    {
      "id": "Firemite",
      "name": "Fire Spirit",
      "category": "Spawned",
      "max_level": 4,
      "housing_space": 1,
      "max_hp": 325.0,
      "dps": 80.0,
      "damage_per_hit": 80.0,
      "attack_speed_sec": 1.0,
      "move_speed": 32.0,
      "range": 2.0,
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
    {
      "id": "GiantGiant",
      "name": "Giant Giant",
      "category": "Spawned",
      "max_level": 10,
      "housing_space": 25,
      "max_hp": 18500.0,
      "dps": 700.0,
      "damage_per_hit": 1400.0,
      "attack_speed_sec": 2.0,
      "move_speed": 13.0,
      "range": 1.0,
      "splash_radius": 1.5,
      "movement": "Ground",
      "target_domain": "Ground",
      "preferred_target": "Defenses",
      "special": "None"
    },
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
    },
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
    },
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
    },
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
    },
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
  ],
  "heroes": [
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
    },
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
    },
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
    },
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
    },
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
    },
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
  ],
  "equipment": [
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
  ],
  "pets": [
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
  ],
  "spells": [
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
    },
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
    },
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
    },
    {
      "id": "Jump",
      "name": "Jump Spell",
      "is_dark": false,
      "max_level": 5,
      "housing_space": 2,
      "radius": 3.5,
      "duration_sec": 100.25,
      "effect": "JumpWalls"
    },
    {
      "id": "Freeze",
      "name": "Freeze Spell",
      "is_dark": false,
      "max_level": 8,
      "housing_space": 1,
      "radius": 3.5,
      "duration_sec": 6.0,
      "effect": "FreezeEnemies"
    },
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
    },
    {
      "id": "Invisibility",
      "name": "Invisibility Spell",
      "is_dark": false,
      "max_level": 4,
      "housing_space": 1,
      "radius": 4.0,
      "duration_sec": 4.25,
      "effect": "InvisibilityZone"
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
    {
      "id": "Overgrowth",
      "name": "Overgrowth Spell",
      "is_dark": true,
      "max_level": 5,
      "housing_space": 2,
      "radius": 6.0,
      "duration_sec": 26.0,
      "effect": "OvergrowthRoots"
    },
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
    },
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
  ],
  "preset_layouts": [
    {
      "name": "TH18 Central Box Legends (Cake-A-Pult + Smasher)",
      "buildings": [
        {
          "instance_id": 1,
          "building_id": "TownHall",
          "tile_x": 23,
          "tile_y": 23,
          "mode": "GuardianSmasher",
          "direction_deg": 0.0
        },
        {
          "instance_id": 2,
          "building_id": "Monolith",
          "tile_x": 27,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 3,
          "building_id": "RevengeTower",
          "tile_x": 20,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 4,
          "building_id": "MultiGearTower",
          "tile_x": 22,
          "tile_y": 20,
          "mode": "MultiGearLongRange",
          "direction_deg": 0.0
        },
        {
          "instance_id": 5,
          "building_id": "CraftingStation",
          "tile_x": 25,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 6,
          "building_id": "InfernoTower",
          "tile_x": 20,
          "tile_y": 22,
          "mode": "InfernoMulti",
          "direction_deg": 0.0
        },
        {
          "instance_id": 7,
          "building_id": "InfernoTower",
          "tile_x": 26,
          "tile_y": 20,
          "mode": "InfernoMulti",
          "direction_deg": 0.0
        },
        {
          "instance_id": 8,
          "building_id": "InfernoTower",
          "tile_x": 22,
          "tile_y": 27,
          "mode": "InfernoMulti",
          "direction_deg": 0.0
        },
        {
          "instance_id": 9,
          "building_id": "Scattershot",
          "tile_x": 20,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 10,
          "building_id": "Scattershot",
          "tile_x": 31,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 11,
          "building_id": "Firespitter",
          "tile_x": 16,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 180.0
        },
        {
          "instance_id": 12,
          "building_id": "Firespitter",
          "tile_x": 24,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 13,
          "building_id": "SuperWizardTower",
          "tile_x": 24,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 14,
          "building_id": "SuperWizardTower",
          "tile_x": 16,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 15,
          "building_id": "XBow",
          "tile_x": 31,
          "tile_y": 21,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 16,
          "building_id": "XBow",
          "tile_x": 16,
          "tile_y": 27,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 17,
          "building_id": "XBow",
          "tile_x": 23,
          "tile_y": 13,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 18,
          "building_id": "XBow",
          "tile_x": 31,
          "tile_y": 27,
          "mode": "XBowGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 19,
          "building_id": "MultiArcherTower",
          "tile_x": 13,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 20,
          "building_id": "MultiArcherTower",
          "tile_x": 28,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 21,
          "building_id": "MultiArcherTower",
          "tile_x": 21,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 22,
          "building_id": "RicochetCannon",
          "tile_x": 17,
          "tile_y": 15,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 23,
          "building_id": "RicochetCannon",
          "tile_x": 34,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 24,
          "building_id": "RicochetCannon",
          "tile_x": 15,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 25,
          "building_id": "AirDefense",
          "tile_x": 26,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 26,
          "building_id": "AirDefense",
          "tile_x": 27,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 27,
          "building_id": "AirDefense",
          "tile_x": 11,
          "tile_y": 19,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 28,
          "building_id": "AirDefense",
          "tile_x": 31,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 29,
          "building_id": "AirSweeper",
          "tile_x": 19,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 180.0
        },
        {
          "instance_id": 30,
          "building_id": "AirSweeper",
          "tile_x": 20,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 31,
          "building_id": "SpellTower",
          "tile_x": 31,
          "tile_y": 30,
          "mode": "SpellTowerRage",
          "direction_deg": 0.0
        },
        {
          "instance_id": 32,
          "building_id": "SpellTower",
          "tile_x": 12,
          "tile_y": 26,
          "mode": "SpellTowerPoison",
          "direction_deg": 0.0
        },
        {
          "instance_id": 33,
          "building_id": "BombTower",
          "tile_x": 31,
          "tile_y": 15,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 34,
          "building_id": "BombTower",
          "tile_x": 23,
          "tile_y": 34,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 35,
          "building_id": "WizardTower",
          "tile_x": 11,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 36,
          "building_id": "WizardTower",
          "tile_x": 36,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 37,
          "building_id": "Mortar",
          "tile_x": 11,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 38,
          "building_id": "Mortar",
          "tile_x": 22,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 39,
          "building_id": "Mortar",
          "tile_x": 31,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 40,
          "building_id": "Mortar",
          "tile_x": 9,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 41,
          "building_id": "Cannon",
          "tile_x": 36,
          "tile_y": 14,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 42,
          "building_id": "ArcherTower",
          "tile_x": 20,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 43,
          "building_id": "ArcherTower",
          "tile_x": 15,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 44,
          "building_id": "ArcherTower",
          "tile_x": 36,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 45,
          "building_id": "HiddenTesla",
          "tile_x": 10,
          "tile_y": 29,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 46,
          "building_id": "HiddenTesla",
          "tile_x": 29,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 47,
          "building_id": "HiddenTesla",
          "tile_x": 28,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 48,
          "building_id": "HiddenTesla",
          "tile_x": 10,
          "tile_y": 14,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 49,
          "building_id": "HiddenTesla",
          "tile_x": 36,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 50,
          "building_id": "BuildersHut",
          "tile_x": 16,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 51,
          "building_id": "BuildersHut",
          "tile_x": 20,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 52,
          "building_id": "BuildersHut",
          "tile_x": 36,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 53,
          "building_id": "BuildersHut",
          "tile_x": 8,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 54,
          "building_id": "BuildersHut",
          "tile_x": 32,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 55,
          "building_id": "GoldStorage",
          "tile_x": 12,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 56,
          "building_id": "GoldStorage",
          "tile_x": 37,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 57,
          "building_id": "GoldStorage",
          "tile_x": 6,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 58,
          "building_id": "GoldStorage",
          "tile_x": 27,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 59,
          "building_id": "ElixirStorage",
          "tile_x": 25,
          "tile_y": 37,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 60,
          "building_id": "ElixirStorage",
          "tile_x": 6,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 61,
          "building_id": "ElixirStorage",
          "tile_x": 41,
          "tile_y": 19,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 62,
          "building_id": "ElixirStorage",
          "tile_x": 13,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 63,
          "building_id": "DarkElixirStorage",
          "tile_x": 20,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 64,
          "building_id": "ClanCastle",
          "tile_x": 36,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 65,
          "building_id": "GoldMine",
          "tile_x": 41,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 66,
          "building_id": "GoldMine",
          "tile_x": 10,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 67,
          "building_id": "GoldMine",
          "tile_x": 25,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 68,
          "building_id": "GoldMine",
          "tile_x": 31,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 69,
          "building_id": "GoldMine",
          "tile_x": 6,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 70,
          "building_id": "GoldMine",
          "tile_x": 35,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 71,
          "building_id": "GoldMine",
          "tile_x": 18,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 72,
          "building_id": "ElixirCollector",
          "tile_x": 15,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 73,
          "building_id": "ElixirCollector",
          "tile_x": 41,
          "tile_y": 28,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 74,
          "building_id": "ElixirCollector",
          "tile_x": 6,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 75,
          "building_id": "ElixirCollector",
          "tile_x": 30,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 76,
          "building_id": "ElixirCollector",
          "tile_x": 27,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 77,
          "building_id": "ElixirCollector",
          "tile_x": 6,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 78,
          "building_id": "ElixirCollector",
          "tile_x": 41,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 79,
          "building_id": "DarkElixirDrill",
          "tile_x": 11,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 80,
          "building_id": "DarkElixirDrill",
          "tile_x": 20,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 81,
          "building_id": "DarkElixirDrill",
          "tile_x": 37,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 82,
          "building_id": "ArmyCamp",
          "tile_x": 32,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 83,
          "building_id": "ArmyCamp",
          "tile_x": 5,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 84,
          "building_id": "ArmyCamp",
          "tile_x": 41,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 85,
          "building_id": "ArmyCamp",
          "tile_x": 14,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 86,
          "building_id": "Barracks",
          "tile_x": 12,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 87,
          "building_id": "DarkBarracks",
          "tile_x": 41,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 88,
          "building_id": "Laboratory",
          "tile_x": 3,
          "tile_y": 29,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 89,
          "building_id": "SpellFactory",
          "tile_x": 30,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 90,
          "building_id": "DarkSpellFactory",
          "tile_x": 28,
          "tile_y": 44,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 91,
          "building_id": "HeroHall",
          "tile_x": 5,
          "tile_y": 5,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 92,
          "building_id": "Blacksmith",
          "tile_x": 44,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 93,
          "building_id": "Workshop",
          "tile_x": 7,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 94,
          "building_id": "PetHouse",
          "tile_x": 17,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 95,
          "building_id": "HelperHut",
          "tile_x": 41,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 96,
          "building_id": "BobsHut",
          "tile_x": 3,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        }
      ],
      "walls": [
        [
          19,
          19
        ],
        [
          19,
          30
        ],
        [
          20,
          19
        ],
        [
          20,
          30
        ],
        [
          21,
          19
        ],
        [
          21,
          30
        ],
        [
          22,
          19
        ],
        [
          22,
          30
        ],
        [
          23,
          19
        ],
        [
          23,
          30
        ],
        [
          25,
          19
        ],
        [
          25,
          30
        ],
        [
          26,
          19
        ],
        [
          26,
          30
        ],
        [
          27,
          19
        ],
        [
          27,
          30
        ],
        [
          28,
          19
        ],
        [
          28,
          30
        ],
        [
          29,
          19
        ],
        [
          29,
          30
        ],
        [
          30,
          19
        ],
        [
          30,
          30
        ],
        [
          19,
          20
        ],
        [
          30,
          20
        ],
        [
          19,
          21
        ],
        [
          30,
          21
        ],
        [
          19,
          22
        ],
        [
          30,
          22
        ],
        [
          19,
          23
        ],
        [
          30,
          23
        ],
        [
          19,
          25
        ],
        [
          30,
          25
        ],
        [
          19,
          26
        ],
        [
          30,
          26
        ],
        [
          19,
          27
        ],
        [
          30,
          27
        ],
        [
          19,
          28
        ],
        [
          30,
          28
        ],
        [
          19,
          29
        ],
        [
          30,
          29
        ],
        [
          14,
          14
        ],
        [
          14,
          35
        ],
        [
          15,
          14
        ],
        [
          15,
          35
        ],
        [
          16,
          14
        ],
        [
          16,
          35
        ],
        [
          17,
          14
        ],
        [
          17,
          35
        ],
        [
          18,
          14
        ],
        [
          18,
          35
        ],
        [
          19,
          14
        ],
        [
          19,
          35
        ],
        [
          20,
          14
        ],
        [
          20,
          35
        ],
        [
          21,
          14
        ],
        [
          21,
          35
        ],
        [
          22,
          14
        ],
        [
          22,
          35
        ],
        [
          26,
          14
        ],
        [
          26,
          35
        ],
        [
          27,
          14
        ],
        [
          27,
          35
        ],
        [
          28,
          14
        ],
        [
          28,
          35
        ],
        [
          29,
          14
        ],
        [
          29,
          35
        ],
        [
          30,
          14
        ],
        [
          30,
          35
        ],
        [
          31,
          14
        ],
        [
          31,
          35
        ],
        [
          32,
          14
        ],
        [
          32,
          35
        ],
        [
          33,
          14
        ],
        [
          33,
          35
        ],
        [
          34,
          14
        ],
        [
          34,
          35
        ],
        [
          35,
          14
        ],
        [
          35,
          35
        ],
        [
          14,
          15
        ],
        [
          35,
          15
        ],
        [
          14,
          16
        ],
        [
          35,
          16
        ],
        [
          14,
          17
        ],
        [
          35,
          17
        ],
        [
          14,
          18
        ],
        [
          35,
          18
        ],
        [
          14,
          19
        ],
        [
          35,
          19
        ],
        [
          14,
          20
        ],
        [
          35,
          20
        ],
        [
          14,
          21
        ],
        [
          35,
          21
        ],
        [
          14,
          22
        ],
        [
          35,
          22
        ],
        [
          14,
          26
        ],
        [
          35,
          26
        ],
        [
          14,
          27
        ],
        [
          35,
          27
        ],
        [
          14,
          28
        ],
        [
          35,
          28
        ],
        [
          14,
          29
        ],
        [
          35,
          29
        ],
        [
          14,
          30
        ],
        [
          35,
          30
        ],
        [
          14,
          31
        ],
        [
          35,
          31
        ],
        [
          14,
          32
        ],
        [
          35,
          32
        ],
        [
          14,
          33
        ],
        [
          35,
          33
        ],
        [
          14,
          34
        ],
        [
          35,
          34
        ],
        [
          9,
          9
        ],
        [
          9,
          40
        ],
        [
          10,
          9
        ],
        [
          10,
          40
        ],
        [
          11,
          9
        ],
        [
          11,
          40
        ],
        [
          12,
          9
        ],
        [
          12,
          40
        ],
        [
          13,
          9
        ],
        [
          13,
          40
        ],
        [
          14,
          9
        ],
        [
          14,
          40
        ],
        [
          15,
          9
        ],
        [
          15,
          40
        ],
        [
          16,
          9
        ],
        [
          16,
          40
        ],
        [
          17,
          9
        ],
        [
          17,
          40
        ],
        [
          18,
          9
        ],
        [
          18,
          40
        ],
        [
          19,
          9
        ],
        [
          19,
          40
        ],
        [
          20,
          9
        ],
        [
          20,
          40
        ],
        [
          21,
          9
        ],
        [
          21,
          40
        ],
        [
          27,
          9
        ],
        [
          27,
          40
        ],
        [
          28,
          9
        ],
        [
          28,
          40
        ],
        [
          29,
          9
        ],
        [
          29,
          40
        ],
        [
          30,
          9
        ],
        [
          30,
          40
        ],
        [
          31,
          9
        ],
        [
          31,
          40
        ],
        [
          32,
          9
        ],
        [
          32,
          40
        ],
        [
          33,
          9
        ],
        [
          33,
          40
        ],
        [
          34,
          9
        ],
        [
          34,
          40
        ],
        [
          35,
          9
        ],
        [
          35,
          40
        ],
        [
          36,
          9
        ],
        [
          36,
          40
        ],
        [
          37,
          9
        ],
        [
          37,
          40
        ],
        [
          38,
          9
        ],
        [
          38,
          40
        ],
        [
          39,
          9
        ],
        [
          39,
          40
        ],
        [
          40,
          9
        ],
        [
          40,
          40
        ],
        [
          9,
          10
        ],
        [
          40,
          10
        ],
        [
          9,
          11
        ],
        [
          40,
          11
        ],
        [
          9,
          12
        ],
        [
          40,
          12
        ],
        [
          9,
          13
        ],
        [
          40,
          13
        ],
        [
          9,
          14
        ],
        [
          40,
          14
        ],
        [
          9,
          15
        ],
        [
          40,
          15
        ],
        [
          9,
          16
        ],
        [
          40,
          16
        ],
        [
          9,
          17
        ],
        [
          40,
          17
        ],
        [
          9,
          18
        ],
        [
          40,
          18
        ],
        [
          9,
          19
        ],
        [
          40,
          19
        ],
        [
          9,
          20
        ],
        [
          40,
          20
        ],
        [
          9,
          21
        ],
        [
          40,
          21
        ],
        [
          9,
          27
        ],
        [
          40,
          27
        ],
        [
          9,
          28
        ],
        [
          40,
          28
        ],
        [
          9,
          29
        ],
        [
          40,
          29
        ],
        [
          9,
          30
        ],
        [
          40,
          30
        ],
        [
          9,
          31
        ],
        [
          40,
          31
        ],
        [
          9,
          32
        ],
        [
          40,
          32
        ],
        [
          9,
          33
        ],
        [
          40,
          33
        ],
        [
          9,
          34
        ],
        [
          40,
          34
        ],
        [
          9,
          35
        ],
        [
          40,
          35
        ],
        [
          9,
          36
        ],
        [
          40,
          36
        ],
        [
          9,
          37
        ],
        [
          40,
          37
        ],
        [
          9,
          38
        ],
        [
          40,
          38
        ],
        [
          9,
          39
        ],
        [
          40,
          39
        ],
        [
          5,
          24
        ],
        [
          44,
          24
        ],
        [
          24,
          5
        ],
        [
          24,
          44
        ],
        [
          6,
          24
        ],
        [
          43,
          24
        ],
        [
          24,
          6
        ],
        [
          24,
          43
        ],
        [
          7,
          24
        ],
        [
          42,
          24
        ],
        [
          24,
          7
        ],
        [
          24,
          42
        ],
        [
          8,
          24
        ],
        [
          41,
          24
        ],
        [
          24,
          8
        ],
        [
          24,
          41
        ],
        [
          16,
          33
        ],
        [
          23,
          16
        ],
        [
          27,
          16
        ],
        [
          30,
          33
        ],
        [
          16,
          23
        ],
        [
          28,
          29
        ],
        [
          29,
          29
        ]
      ],
      "traps": [
        {
          "instance_id": 1,
          "trap_id": "Bomb",
          "tile_x": 22,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 2,
          "trap_id": "Bomb",
          "tile_x": 25,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 3,
          "trap_id": "Bomb",
          "tile_x": 25,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 4,
          "trap_id": "Bomb",
          "tile_x": 26,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 5,
          "trap_id": "Bomb",
          "tile_x": 21,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 6,
          "trap_id": "Bomb",
          "tile_x": 24,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 7,
          "trap_id": "Bomb",
          "tile_x": 25,
          "tile_y": 20,
          "mode": "Default"
        },
        {
          "instance_id": 8,
          "trap_id": "Bomb",
          "tile_x": 27,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 9,
          "trap_id": "SpringTrap",
          "tile_x": 21,
          "tile_y": 20,
          "mode": "Default"
        },
        {
          "instance_id": 10,
          "trap_id": "SpringTrap",
          "tile_x": 20,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 11,
          "trap_id": "SpringTrap",
          "tile_x": 27,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 12,
          "trap_id": "SpringTrap",
          "tile_x": 21,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 13,
          "trap_id": "SpringTrap",
          "tile_x": 24,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 14,
          "trap_id": "SpringTrap",
          "tile_x": 19,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 15,
          "trap_id": "SpringTrap",
          "tile_x": 24,
          "tile_y": 28,
          "mode": "Default"
        },
        {
          "instance_id": 16,
          "trap_id": "SpringTrap",
          "tile_x": 28,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 17,
          "trap_id": "SpringTrap",
          "tile_x": 20,
          "tile_y": 20,
          "mode": "Default"
        },
        {
          "instance_id": 18,
          "trap_id": "AirBomb",
          "tile_x": 20,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 19,
          "trap_id": "AirBomb",
          "tile_x": 28,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 20,
          "trap_id": "AirBomb",
          "tile_x": 28,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 21,
          "trap_id": "AirBomb",
          "tile_x": 21,
          "tile_y": 28,
          "mode": "Default"
        },
        {
          "instance_id": 22,
          "trap_id": "AirBomb",
          "tile_x": 23,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 23,
          "trap_id": "AirBomb",
          "tile_x": 18,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 24,
          "trap_id": "AirBomb",
          "tile_x": 23,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 25,
          "trap_id": "AirBomb",
          "tile_x": 24,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 26,
          "trap_id": "GiantBomb",
          "tile_x": 28,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 27,
          "trap_id": "GiantBomb",
          "tile_x": 17,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 28,
          "trap_id": "GiantBomb",
          "tile_x": 15,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 29,
          "trap_id": "GiantBomb",
          "tile_x": 15,
          "tile_y": 16,
          "mode": "Default"
        },
        {
          "instance_id": 30,
          "trap_id": "GiantBomb",
          "tile_x": 19,
          "tile_y": 33,
          "mode": "Default"
        },
        {
          "instance_id": 31,
          "trap_id": "GiantBomb",
          "tile_x": 17,
          "tile_y": 33,
          "mode": "Default"
        },
        {
          "instance_id": 32,
          "trap_id": "GiantBomb",
          "tile_x": 18,
          "tile_y": 12,
          "mode": "Default"
        },
        {
          "instance_id": 33,
          "trap_id": "GiantBomb",
          "tile_x": 12,
          "tile_y": 28,
          "mode": "Default"
        },
        {
          "instance_id": 34,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 20,
          "mode": "Default"
        },
        {
          "instance_id": 35,
          "trap_id": "SeekingAirMine",
          "tile_x": 29,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 36,
          "trap_id": "SeekingAirMine",
          "tile_x": 20,
          "tile_y": 28,
          "mode": "Default"
        },
        {
          "instance_id": 37,
          "trap_id": "SeekingAirMine",
          "tile_x": 22,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 38,
          "trap_id": "SeekingAirMine",
          "tile_x": 29,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 39,
          "trap_id": "SeekingAirMine",
          "tile_x": 29,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 40,
          "trap_id": "SeekingAirMine",
          "tile_x": 21,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 41,
          "trap_id": "SeekingAirMine",
          "tile_x": 23,
          "tile_y": 17,
          "mode": "Default"
        },
        {
          "instance_id": 42,
          "trap_id": "SeekingAirMine",
          "tile_x": 27,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 43,
          "trap_id": "SkeletonTrap",
          "tile_x": 29,
          "tile_y": 20,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 44,
          "trap_id": "SkeletonTrap",
          "tile_x": 17,
          "tile_y": 23,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 45,
          "trap_id": "SkeletonTrap",
          "tile_x": 30,
          "tile_y": 24,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 46,
          "trap_id": "SkeletonTrap",
          "tile_x": 20,
          "tile_y": 29,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 47,
          "trap_id": "TornadoTrap",
          "tile_x": 24,
          "tile_y": 30,
          "mode": "Default"
        },
        {
          "instance_id": 48,
          "trap_id": "GigaBomb",
          "tile_x": 33,
          "tile_y": 30,
          "mode": "Default"
        }
      ],
      "defending_heroes": [
        {
          "hero_id": "BarbarianKing",
          "tile_x": 20,
          "tile_y": 27
        },
        {
          "hero_id": "ArcherQueen",
          "tile_x": 28,
          "tile_y": 20
        },
        {
          "hero_id": "GrandWarden",
          "tile_x": 27,
          "tile_y": 28
        },
        {
          "hero_id": "DragonDuke",
          "tile_x": 20,
          "tile_y": 20
        }
      ],
      "defending_cc_troops": [
        [
          "IceGolem",
          2
        ],
        [
          "Headhunter",
          3
        ],
        [
          "Archer",
          7
        ]
      ]
    },
    {
      "name": "TH18 Offset Diamond (Hot Candle + Longshot)",
      "buildings": [
        {
          "instance_id": 1,
          "building_id": "TownHall",
          "tile_x": 16,
          "tile_y": 23,
          "mode": "GuardianLongshot",
          "direction_deg": 0.0
        },
        {
          "instance_id": 2,
          "building_id": "Monolith",
          "tile_x": 29,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 3,
          "building_id": "RevengeTower",
          "tile_x": 26,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 4,
          "building_id": "MultiGearTower",
          "tile_x": 26,
          "tile_y": 19,
          "mode": "MultiGearLongRange",
          "direction_deg": 0.0
        },
        {
          "instance_id": 5,
          "building_id": "CraftingStation",
          "tile_x": 29,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 6,
          "building_id": "InfernoTower",
          "tile_x": 23,
          "tile_y": 24,
          "mode": "InfernoSingle",
          "direction_deg": 0.0
        },
        {
          "instance_id": 7,
          "building_id": "InfernoTower",
          "tile_x": 29,
          "tile_y": 18,
          "mode": "InfernoSingle",
          "direction_deg": 0.0
        },
        {
          "instance_id": 8,
          "building_id": "InfernoTower",
          "tile_x": 29,
          "tile_y": 27,
          "mode": "InfernoMulti",
          "direction_deg": 0.0
        },
        {
          "instance_id": 9,
          "building_id": "Scattershot",
          "tile_x": 19,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 10,
          "building_id": "Scattershot",
          "tile_x": 32,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 11,
          "building_id": "Firespitter",
          "tile_x": 26,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 180.0
        },
        {
          "instance_id": 12,
          "building_id": "Firespitter",
          "tile_x": 22,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 13,
          "building_id": "SuperWizardTower",
          "tile_x": 31,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 14,
          "building_id": "SuperWizardTower",
          "tile_x": 16,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 15,
          "building_id": "XBow",
          "tile_x": 32,
          "tile_y": 18,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 16,
          "building_id": "XBow",
          "tile_x": 22,
          "tile_y": 30,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 17,
          "building_id": "XBow",
          "tile_x": 19,
          "tile_y": 16,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 18,
          "building_id": "XBow",
          "tile_x": 34,
          "tile_y": 24,
          "mode": "XBowGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 19,
          "building_id": "MultiArcherTower",
          "tile_x": 18,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 20,
          "building_id": "MultiArcherTower",
          "tile_x": 28,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 21,
          "building_id": "MultiArcherTower",
          "tile_x": 30,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 22,
          "building_id": "RicochetCannon",
          "tile_x": 16,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 23,
          "building_id": "RicochetCannon",
          "tile_x": 38,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 24,
          "building_id": "RicochetCannon",
          "tile_x": 22,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 25,
          "building_id": "AirDefense",
          "tile_x": 23,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 26,
          "building_id": "AirDefense",
          "tile_x": 34,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 27,
          "building_id": "AirDefense",
          "tile_x": 15,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 28,
          "building_id": "AirDefense",
          "tile_x": 31,
          "tile_y": 14,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 29,
          "building_id": "AirSweeper",
          "tile_x": 27,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 90.0
        },
        {
          "instance_id": 30,
          "building_id": "AirSweeper",
          "tile_x": 18,
          "tile_y": 14,
          "mode": "Default",
          "direction_deg": 270.0
        },
        {
          "instance_id": 31,
          "building_id": "SpellTower",
          "tile_x": 35,
          "tile_y": 22,
          "mode": "SpellTowerRage",
          "direction_deg": 0.0
        },
        {
          "instance_id": 32,
          "building_id": "SpellTower",
          "tile_x": 19,
          "tile_y": 33,
          "mode": "SpellTowerPoison",
          "direction_deg": 0.0
        },
        {
          "instance_id": 33,
          "building_id": "BombTower",
          "tile_x": 25,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 34,
          "building_id": "BombTower",
          "tile_x": 33,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 35,
          "building_id": "WizardTower",
          "tile_x": 10,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 36,
          "building_id": "WizardTower",
          "tile_x": 34,
          "tile_y": 14,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 37,
          "building_id": "Mortar",
          "tile_x": 25,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 38,
          "building_id": "Mortar",
          "tile_x": 18,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 39,
          "building_id": "Mortar",
          "tile_x": 38,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 40,
          "building_id": "Mortar",
          "tile_x": 12,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 41,
          "building_id": "Cannon",
          "tile_x": 31,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 42,
          "building_id": "ArcherTower",
          "tile_x": 31,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 43,
          "building_id": "ArcherTower",
          "tile_x": 13,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 44,
          "building_id": "ArcherTower",
          "tile_x": 42,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 45,
          "building_id": "HiddenTesla",
          "tile_x": 19,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 46,
          "building_id": "HiddenTesla",
          "tile_x": 22,
          "tile_y": 8,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 47,
          "building_id": "HiddenTesla",
          "tile_x": 38,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 48,
          "building_id": "HiddenTesla",
          "tile_x": 11,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 49,
          "building_id": "HiddenTesla",
          "tile_x": 35,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 50,
          "building_id": "BuildersHut",
          "tile_x": 28,
          "tile_y": 37,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 51,
          "building_id": "BuildersHut",
          "tile_x": 16,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 52,
          "building_id": "BuildersHut",
          "tile_x": 41,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 53,
          "building_id": "BuildersHut",
          "tile_x": 15,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 54,
          "building_id": "BuildersHut",
          "tile_x": 28,
          "tile_y": 8,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 55,
          "building_id": "GoldStorage",
          "tile_x": 30,
          "tile_y": 7,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 56,
          "building_id": "GoldStorage",
          "tile_x": 25,
          "tile_y": 39,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 57,
          "building_id": "GoldStorage",
          "tile_x": 10,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 58,
          "building_id": "GoldStorage",
          "tile_x": 38,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 59,
          "building_id": "ElixirStorage",
          "tile_x": 14,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 60,
          "building_id": "ElixirStorage",
          "tile_x": 19,
          "tile_y": 7,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 61,
          "building_id": "ElixirStorage",
          "tile_x": 36,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 62,
          "building_id": "ElixirStorage",
          "tile_x": 6,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 63,
          "building_id": "DarkElixirStorage",
          "tile_x": 37,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 64,
          "building_id": "ClanCastle",
          "tile_x": 21,
          "tile_y": 40,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 65,
          "building_id": "GoldMine",
          "tile_x": 25,
          "tile_y": 7,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 66,
          "building_id": "GoldMine",
          "tile_x": 34,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 67,
          "building_id": "GoldMine",
          "tile_x": 6,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 68,
          "building_id": "GoldMine",
          "tile_x": 37,
          "tile_y": 14,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 69,
          "building_id": "GoldMine",
          "tile_x": 18,
          "tile_y": 40,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 70,
          "building_id": "GoldMine",
          "tile_x": 15,
          "tile_y": 7,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 71,
          "building_id": "GoldMine",
          "tile_x": 42,
          "tile_y": 28,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 72,
          "building_id": "ElixirCollector",
          "tile_x": 6,
          "tile_y": 28,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 73,
          "building_id": "ElixirCollector",
          "tile_x": 29,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 74,
          "building_id": "ElixirCollector",
          "tile_x": 28,
          "tile_y": 40,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 75,
          "building_id": "ElixirCollector",
          "tile_x": 6,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 76,
          "building_id": "ElixirCollector",
          "tile_x": 43,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 77,
          "building_id": "ElixirCollector",
          "tile_x": 11,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 78,
          "building_id": "ElixirCollector",
          "tile_x": 20,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 79,
          "building_id": "DarkElixirDrill",
          "tile_x": 37,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 80,
          "building_id": "DarkElixirDrill",
          "tile_x": 3,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 81,
          "building_id": "DarkElixirDrill",
          "tile_x": 37,
          "tile_y": 7,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 82,
          "building_id": "ArmyCamp",
          "tile_x": 5,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 83,
          "building_id": "ArmyCamp",
          "tile_x": 42,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 84,
          "building_id": "ArmyCamp",
          "tile_x": 14,
          "tile_y": 40,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 85,
          "building_id": "ArmyCamp",
          "tile_x": 11,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 86,
          "building_id": "Barracks",
          "tile_x": 42,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 87,
          "building_id": "DarkBarracks",
          "tile_x": 5,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 88,
          "building_id": "Laboratory",
          "tile_x": 32,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 89,
          "building_id": "SpellFactory",
          "tile_x": 28,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 90,
          "building_id": "DarkSpellFactory",
          "tile_x": 3,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 91,
          "building_id": "HeroHall",
          "tile_x": 43,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 92,
          "building_id": "Blacksmith",
          "tile_x": 11,
          "tile_y": 40,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 93,
          "building_id": "Workshop",
          "tile_x": 16,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 94,
          "building_id": "PetHouse",
          "tile_x": 42,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 95,
          "building_id": "HelperHut",
          "tile_x": 3,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 96,
          "building_id": "BobsHut",
          "tile_x": 40,
          "tile_y": 7,
          "mode": "Default",
          "direction_deg": 0.0
        }
      ],
      "walls": [
        [
          13,
          19
        ],
        [
          13,
          29
        ],
        [
          14,
          19
        ],
        [
          14,
          29
        ],
        [
          15,
          19
        ],
        [
          15,
          29
        ],
        [
          16,
          19
        ],
        [
          16,
          29
        ],
        [
          18,
          19
        ],
        [
          18,
          29
        ],
        [
          19,
          19
        ],
        [
          19,
          29
        ],
        [
          20,
          19
        ],
        [
          20,
          29
        ],
        [
          21,
          19
        ],
        [
          21,
          29
        ],
        [
          22,
          19
        ],
        [
          22,
          29
        ],
        [
          13,
          20
        ],
        [
          22,
          20
        ],
        [
          13,
          21
        ],
        [
          22,
          21
        ],
        [
          13,
          22
        ],
        [
          22,
          22
        ],
        [
          13,
          23
        ],
        [
          22,
          23
        ],
        [
          13,
          25
        ],
        [
          22,
          25
        ],
        [
          13,
          26
        ],
        [
          22,
          26
        ],
        [
          13,
          27
        ],
        [
          22,
          27
        ],
        [
          13,
          28
        ],
        [
          22,
          28
        ],
        [
          25,
          17
        ],
        [
          25,
          31
        ],
        [
          26,
          17
        ],
        [
          26,
          31
        ],
        [
          27,
          17
        ],
        [
          27,
          31
        ],
        [
          28,
          17
        ],
        [
          28,
          31
        ],
        [
          29,
          17
        ],
        [
          29,
          31
        ],
        [
          30,
          17
        ],
        [
          30,
          31
        ],
        [
          32,
          17
        ],
        [
          32,
          31
        ],
        [
          33,
          17
        ],
        [
          33,
          31
        ],
        [
          34,
          17
        ],
        [
          34,
          31
        ],
        [
          35,
          17
        ],
        [
          35,
          31
        ],
        [
          36,
          17
        ],
        [
          36,
          31
        ],
        [
          37,
          17
        ],
        [
          37,
          31
        ],
        [
          25,
          18
        ],
        [
          37,
          18
        ],
        [
          25,
          19
        ],
        [
          37,
          19
        ],
        [
          25,
          20
        ],
        [
          37,
          20
        ],
        [
          25,
          21
        ],
        [
          37,
          21
        ],
        [
          25,
          22
        ],
        [
          37,
          22
        ],
        [
          25,
          23
        ],
        [
          37,
          23
        ],
        [
          25,
          25
        ],
        [
          37,
          25
        ],
        [
          25,
          26
        ],
        [
          37,
          26
        ],
        [
          25,
          27
        ],
        [
          37,
          27
        ],
        [
          25,
          28
        ],
        [
          37,
          28
        ],
        [
          25,
          29
        ],
        [
          37,
          29
        ],
        [
          25,
          30
        ],
        [
          37,
          30
        ],
        [
          9,
          10
        ],
        [
          9,
          39
        ],
        [
          10,
          10
        ],
        [
          10,
          39
        ],
        [
          11,
          10
        ],
        [
          11,
          39
        ],
        [
          12,
          10
        ],
        [
          12,
          39
        ],
        [
          13,
          10
        ],
        [
          13,
          39
        ],
        [
          14,
          10
        ],
        [
          14,
          39
        ],
        [
          15,
          10
        ],
        [
          15,
          39
        ],
        [
          16,
          10
        ],
        [
          16,
          39
        ],
        [
          17,
          10
        ],
        [
          17,
          39
        ],
        [
          18,
          10
        ],
        [
          18,
          39
        ],
        [
          19,
          10
        ],
        [
          19,
          39
        ],
        [
          20,
          10
        ],
        [
          20,
          39
        ],
        [
          21,
          10
        ],
        [
          21,
          39
        ],
        [
          22,
          10
        ],
        [
          22,
          39
        ],
        [
          28,
          10
        ],
        [
          28,
          39
        ],
        [
          29,
          10
        ],
        [
          29,
          39
        ],
        [
          30,
          10
        ],
        [
          30,
          39
        ],
        [
          31,
          10
        ],
        [
          31,
          39
        ],
        [
          32,
          10
        ],
        [
          32,
          39
        ],
        [
          33,
          10
        ],
        [
          33,
          39
        ],
        [
          34,
          10
        ],
        [
          34,
          39
        ],
        [
          35,
          10
        ],
        [
          35,
          39
        ],
        [
          36,
          10
        ],
        [
          36,
          39
        ],
        [
          37,
          10
        ],
        [
          37,
          39
        ],
        [
          38,
          10
        ],
        [
          38,
          39
        ],
        [
          39,
          10
        ],
        [
          39,
          39
        ],
        [
          40,
          10
        ],
        [
          40,
          39
        ],
        [
          41,
          10
        ],
        [
          41,
          39
        ],
        [
          9,
          11
        ],
        [
          41,
          11
        ],
        [
          9,
          12
        ],
        [
          41,
          12
        ],
        [
          9,
          13
        ],
        [
          41,
          13
        ],
        [
          9,
          14
        ],
        [
          41,
          14
        ],
        [
          9,
          15
        ],
        [
          41,
          15
        ],
        [
          9,
          16
        ],
        [
          41,
          16
        ],
        [
          9,
          17
        ],
        [
          41,
          17
        ],
        [
          9,
          18
        ],
        [
          41,
          18
        ],
        [
          9,
          19
        ],
        [
          41,
          19
        ],
        [
          9,
          20
        ],
        [
          41,
          20
        ],
        [
          9,
          21
        ],
        [
          41,
          21
        ],
        [
          9,
          27
        ],
        [
          41,
          27
        ],
        [
          9,
          28
        ],
        [
          41,
          28
        ],
        [
          9,
          29
        ],
        [
          41,
          29
        ],
        [
          9,
          30
        ],
        [
          41,
          30
        ],
        [
          9,
          31
        ],
        [
          41,
          31
        ],
        [
          9,
          32
        ],
        [
          41,
          32
        ],
        [
          9,
          33
        ],
        [
          41,
          33
        ],
        [
          9,
          34
        ],
        [
          41,
          34
        ],
        [
          9,
          35
        ],
        [
          41,
          35
        ],
        [
          9,
          36
        ],
        [
          41,
          36
        ],
        [
          9,
          37
        ],
        [
          41,
          37
        ],
        [
          9,
          38
        ],
        [
          41,
          38
        ],
        [
          24,
          5
        ],
        [
          24,
          44
        ],
        [
          24,
          6
        ],
        [
          24,
          43
        ],
        [
          24,
          7
        ],
        [
          24,
          42
        ],
        [
          24,
          8
        ],
        [
          24,
          41
        ],
        [
          24,
          9
        ],
        [
          24,
          40
        ],
        [
          24,
          10
        ],
        [
          24,
          39
        ],
        [
          24,
          11
        ],
        [
          24,
          38
        ],
        [
          17,
          33
        ],
        [
          18,
          33
        ],
        [
          21,
          33
        ],
        [
          25,
          16
        ],
        [
          28,
          16
        ],
        [
          29,
          16
        ],
        [
          29,
          33
        ],
        [
          30,
          16
        ],
        [
          16,
          27
        ],
        [
          16,
          28
        ],
        [
          33,
          30
        ],
        [
          23,
          29
        ]
      ],
      "traps": [
        {
          "instance_id": 1,
          "trap_id": "Bomb",
          "tile_x": 28,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 2,
          "trap_id": "Bomb",
          "tile_x": 32,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 3,
          "trap_id": "Bomb",
          "tile_x": 29,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 4,
          "trap_id": "Bomb",
          "tile_x": 30,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 5,
          "trap_id": "Bomb",
          "tile_x": 27,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 6,
          "trap_id": "Bomb",
          "tile_x": 32,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 7,
          "trap_id": "Bomb",
          "tile_x": 33,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 8,
          "trap_id": "Bomb",
          "tile_x": 26,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 9,
          "trap_id": "SpringTrap",
          "tile_x": 33,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 10,
          "trap_id": "SpringTrap",
          "tile_x": 25,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 11,
          "trap_id": "SpringTrap",
          "tile_x": 31,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 12,
          "trap_id": "SpringTrap",
          "tile_x": 24,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 13,
          "trap_id": "SpringTrap",
          "tile_x": 29,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 14,
          "trap_id": "SpringTrap",
          "tile_x": 30,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 15,
          "trap_id": "SpringTrap",
          "tile_x": 28,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 16,
          "trap_id": "SpringTrap",
          "tile_x": 31,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 17,
          "trap_id": "SpringTrap",
          "tile_x": 24,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 18,
          "trap_id": "AirBomb",
          "tile_x": 28,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 19,
          "trap_id": "AirBomb",
          "tile_x": 31,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 20,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 21,
          "trap_id": "AirBomb",
          "tile_x": 24,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 22,
          "trap_id": "AirBomb",
          "tile_x": 35,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 23,
          "trap_id": "AirBomb",
          "tile_x": 24,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 24,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 25,
          "trap_id": "AirBomb",
          "tile_x": 32,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 26,
          "trap_id": "GiantBomb",
          "tile_x": 23,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 27,
          "trap_id": "GiantBomb",
          "tile_x": 35,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 28,
          "trap_id": "GiantBomb",
          "tile_x": 23,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 29,
          "trap_id": "GiantBomb",
          "tile_x": 26,
          "tile_y": 15,
          "mode": "Default"
        },
        {
          "instance_id": 30,
          "trap_id": "GiantBomb",
          "tile_x": 20,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 31,
          "trap_id": "GiantBomb",
          "tile_x": 38,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 32,
          "trap_id": "GiantBomb",
          "tile_x": 20,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 33,
          "trap_id": "GiantBomb",
          "tile_x": 20,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 34,
          "trap_id": "SeekingAirMine",
          "tile_x": 26,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 35,
          "trap_id": "SeekingAirMine",
          "tile_x": 23,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 36,
          "trap_id": "SeekingAirMine",
          "tile_x": 26,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 37,
          "trap_id": "SeekingAirMine",
          "tile_x": 33,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 38,
          "trap_id": "SeekingAirMine",
          "tile_x": 29,
          "tile_y": 30,
          "mode": "Default"
        },
        {
          "instance_id": 39,
          "trap_id": "SeekingAirMine",
          "tile_x": 30,
          "tile_y": 30,
          "mode": "Default"
        },
        {
          "instance_id": 40,
          "trap_id": "SeekingAirMine",
          "tile_x": 31,
          "tile_y": 17,
          "mode": "Default"
        },
        {
          "instance_id": 41,
          "trap_id": "SeekingAirMine",
          "tile_x": 23,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 42,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 30,
          "mode": "Default"
        },
        {
          "instance_id": 43,
          "trap_id": "SkeletonTrap",
          "tile_x": 31,
          "tile_y": 30,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 44,
          "trap_id": "SkeletonTrap",
          "tile_x": 23,
          "tile_y": 21,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 45,
          "trap_id": "SkeletonTrap",
          "tile_x": 36,
          "tile_y": 21,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 46,
          "trap_id": "SkeletonTrap",
          "tile_x": 23,
          "tile_y": 26,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 47,
          "trap_id": "TornadoTrap",
          "tile_x": 27,
          "tile_y": 30,
          "mode": "Default"
        },
        {
          "instance_id": 48,
          "trap_id": "GigaBomb",
          "tile_x": 25,
          "tile_y": 32,
          "mode": "Default"
        }
      ],
      "defending_heroes": [
        {
          "hero_id": "BarbarianKing",
          "tile_x": 20,
          "tile_y": 27
        },
        {
          "hero_id": "ArcherQueen",
          "tile_x": 28,
          "tile_y": 20
        },
        {
          "hero_id": "GrandWarden",
          "tile_x": 27,
          "tile_y": 28
        },
        {
          "hero_id": "DragonDuke",
          "tile_x": 20,
          "tile_y": 20
        }
      ],
      "defending_cc_troops": [
        [
          "IceGolem",
          2
        ],
        [
          "Headhunter",
          3
        ],
        [
          "Archer",
          7
        ]
      ]
    },
    {
      "name": "TH18 Anti-Hydra Air Ring (4 Air X-Bows + Sweepers)",
      "buildings": [
        {
          "instance_id": 1,
          "building_id": "TownHall",
          "tile_x": 23,
          "tile_y": 23,
          "mode": "GuardianLongshot",
          "direction_deg": 0.0
        },
        {
          "instance_id": 2,
          "building_id": "Monolith",
          "tile_x": 24,
          "tile_y": 17,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 3,
          "building_id": "RevengeTower",
          "tile_x": 23,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 4,
          "building_id": "MultiGearTower",
          "tile_x": 17,
          "tile_y": 20,
          "mode": "MultiGearLongRange",
          "direction_deg": 0.0
        },
        {
          "instance_id": 5,
          "building_id": "CraftingStation",
          "tile_x": 30,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 6,
          "building_id": "InfernoTower",
          "tile_x": 21,
          "tile_y": 26,
          "mode": "InfernoSingle",
          "direction_deg": 0.0
        },
        {
          "instance_id": 7,
          "building_id": "InfernoTower",
          "tile_x": 22,
          "tile_y": 18,
          "mode": "InfernoSingle",
          "direction_deg": 0.0
        },
        {
          "instance_id": 8,
          "building_id": "InfernoTower",
          "tile_x": 27,
          "tile_y": 26,
          "mode": "InfernoMulti",
          "direction_deg": 0.0
        },
        {
          "instance_id": 9,
          "building_id": "Scattershot",
          "tile_x": 17,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 10,
          "building_id": "Scattershot",
          "tile_x": 27,
          "tile_y": 17,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 11,
          "building_id": "Firespitter",
          "tile_x": 20,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 180.0
        },
        {
          "instance_id": 12,
          "building_id": "Firespitter",
          "tile_x": 19,
          "tile_y": 17,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 13,
          "building_id": "SuperWizardTower",
          "tile_x": 30,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 14,
          "building_id": "SuperWizardTower",
          "tile_x": 17,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 15,
          "building_id": "XBow",
          "tile_x": 24,
          "tile_y": 13,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 16,
          "building_id": "XBow",
          "tile_x": 28,
          "tile_y": 32,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 17,
          "building_id": "XBow",
          "tile_x": 13,
          "tile_y": 19,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 18,
          "building_id": "XBow",
          "tile_x": 33,
          "tile_y": 17,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 19,
          "building_id": "MultiArcherTower",
          "tile_x": 18,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 20,
          "building_id": "MultiArcherTower",
          "tile_x": 18,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 21,
          "building_id": "MultiArcherTower",
          "tile_x": 33,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 22,
          "building_id": "RicochetCannon",
          "tile_x": 9,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 23,
          "building_id": "RicochetCannon",
          "tile_x": 29,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 24,
          "building_id": "RicochetCannon",
          "tile_x": 24,
          "tile_y": 34,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 25,
          "building_id": "AirDefense",
          "tile_x": 13,
          "tile_y": 15,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 26,
          "building_id": "AirDefense",
          "tile_x": 34,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 27,
          "building_id": "AirDefense",
          "tile_x": 14,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 28,
          "building_id": "AirDefense",
          "tile_x": 23,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 29,
          "building_id": "AirSweeper",
          "tile_x": 31,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 180.0
        },
        {
          "instance_id": 30,
          "building_id": "AirSweeper",
          "tile_x": 10,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 31,
          "building_id": "SpellTower",
          "tile_x": 33,
          "tile_y": 15,
          "mode": "SpellTowerPoison",
          "direction_deg": 0.0
        },
        {
          "instance_id": 32,
          "building_id": "SpellTower",
          "tile_x": 21,
          "tile_y": 35,
          "mode": "SpellTowerInvisibility",
          "direction_deg": 0.0
        },
        {
          "instance_id": 33,
          "building_id": "BombTower",
          "tile_x": 15,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 34,
          "building_id": "BombTower",
          "tile_x": 34,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 35,
          "building_id": "WizardTower",
          "tile_x": 9,
          "tile_y": 28,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 36,
          "building_id": "WizardTower",
          "tile_x": 27,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 37,
          "building_id": "Mortar",
          "tile_x": 31,
          "tile_y": 34,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 38,
          "building_id": "Mortar",
          "tile_x": 9,
          "tile_y": 17,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 39,
          "building_id": "Mortar",
          "tile_x": 38,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 40,
          "building_id": "Mortar",
          "tile_x": 15,
          "tile_y": 34,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 41,
          "building_id": "Cannon",
          "tile_x": 19,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 42,
          "building_id": "ArcherTower",
          "tile_x": 38,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 43,
          "building_id": "ArcherTower",
          "tile_x": 5,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 44,
          "building_id": "ArcherTower",
          "tile_x": 33,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 45,
          "building_id": "HiddenTesla",
          "tile_x": 23,
          "tile_y": 40,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 46,
          "building_id": "HiddenTesla",
          "tile_x": 10,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 47,
          "building_id": "HiddenTesla",
          "tile_x": 41,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 48,
          "building_id": "HiddenTesla",
          "tile_x": 9,
          "tile_y": 34,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 49,
          "building_id": "HiddenTesla",
          "tile_x": 25,
          "tile_y": 5,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 50,
          "building_id": "BuildersHut",
          "tile_x": 33,
          "tile_y": 38,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 51,
          "building_id": "BuildersHut",
          "tile_x": 5,
          "tile_y": 19,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 52,
          "building_id": "BuildersHut",
          "tile_x": 38,
          "tile_y": 14,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 53,
          "building_id": "BuildersHut",
          "tile_x": 17,
          "tile_y": 40,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 54,
          "building_id": "BuildersHut",
          "tile_x": 15,
          "tile_y": 5,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 55,
          "building_id": "GoldStorage",
          "tile_x": 38,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 56,
          "building_id": "GoldStorage",
          "tile_x": 14,
          "tile_y": 38,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 57,
          "building_id": "GoldStorage",
          "tile_x": 22,
          "tile_y": 7,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 58,
          "building_id": "GoldStorage",
          "tile_x": 34,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 59,
          "building_id": "ElixirStorage",
          "tile_x": 4,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 60,
          "building_id": "ElixirStorage",
          "tile_x": 36,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 61,
          "building_id": "ElixirStorage",
          "tile_x": 22,
          "tile_y": 42,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 62,
          "building_id": "ElixirStorage",
          "tile_x": 12,
          "tile_y": 8,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 63,
          "building_id": "DarkElixirStorage",
          "tile_x": 43,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 64,
          "building_id": "ClanCastle",
          "tile_x": 4,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 65,
          "building_id": "GoldMine",
          "tile_x": 12,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 66,
          "building_id": "GoldMine",
          "tile_x": 39,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 67,
          "building_id": "GoldMine",
          "tile_x": 19,
          "tile_y": 38,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 68,
          "building_id": "GoldMine",
          "tile_x": 12,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 69,
          "building_id": "GoldMine",
          "tile_x": 38,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 70,
          "building_id": "GoldMine",
          "tile_x": 8,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 71,
          "building_id": "GoldMine",
          "tile_x": 30,
          "tile_y": 8,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 72,
          "building_id": "ElixirCollector",
          "tile_x": 26,
          "tile_y": 39,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 73,
          "building_id": "ElixirCollector",
          "tile_x": 8,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 74,
          "building_id": "ElixirCollector",
          "tile_x": 43,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 75,
          "building_id": "ElixirCollector",
          "tile_x": 11,
          "tile_y": 38,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 76,
          "building_id": "ElixirCollector",
          "tile_x": 22,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 77,
          "building_id": "ElixirCollector",
          "tile_x": 38,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 78,
          "building_id": "ElixirCollector",
          "tile_x": 3,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 79,
          "building_id": "DarkElixirDrill",
          "tile_x": 39,
          "tile_y": 8,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 80,
          "building_id": "DarkElixirDrill",
          "tile_x": 19,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 81,
          "building_id": "DarkElixirDrill",
          "tile_x": 9,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 82,
          "building_id": "ArmyCamp",
          "tile_x": 43,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 83,
          "building_id": "ArmyCamp",
          "tile_x": 15,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 84,
          "building_id": "ArmyCamp",
          "tile_x": 5,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 85,
          "building_id": "ArmyCamp",
          "tile_x": 43,
          "tile_y": 28,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 86,
          "building_id": "Barracks",
          "tile_x": 4,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 87,
          "building_id": "DarkBarracks",
          "tile_x": 30,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 88,
          "building_id": "Laboratory",
          "tile_x": 28,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 89,
          "building_id": "SpellFactory",
          "tile_x": 4,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 90,
          "building_id": "DarkSpellFactory",
          "tile_x": 43,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 91,
          "building_id": "HeroHall",
          "tile_x": 10,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 92,
          "building_id": "Blacksmith",
          "tile_x": 27,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 93,
          "building_id": "Workshop",
          "tile_x": 38,
          "tile_y": 38,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 94,
          "building_id": "PetHouse",
          "tile_x": 3,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 95,
          "building_id": "HelperHut",
          "tile_x": 38,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 96,
          "building_id": "BobsHut",
          "tile_x": 22,
          "tile_y": 45,
          "mode": "Default",
          "direction_deg": 0.0
        }
      ],
      "walls": [
        [
          20,
          20
        ],
        [
          20,
          29
        ],
        [
          21,
          20
        ],
        [
          21,
          29
        ],
        [
          22,
          20
        ],
        [
          22,
          29
        ],
        [
          23,
          20
        ],
        [
          23,
          29
        ],
        [
          24,
          20
        ],
        [
          24,
          29
        ],
        [
          25,
          20
        ],
        [
          25,
          29
        ],
        [
          26,
          20
        ],
        [
          26,
          29
        ],
        [
          27,
          20
        ],
        [
          27,
          29
        ],
        [
          28,
          20
        ],
        [
          28,
          29
        ],
        [
          29,
          20
        ],
        [
          29,
          29
        ],
        [
          20,
          21
        ],
        [
          29,
          21
        ],
        [
          20,
          22
        ],
        [
          29,
          22
        ],
        [
          20,
          23
        ],
        [
          29,
          23
        ],
        [
          20,
          24
        ],
        [
          29,
          24
        ],
        [
          20,
          25
        ],
        [
          29,
          25
        ],
        [
          20,
          26
        ],
        [
          29,
          26
        ],
        [
          20,
          27
        ],
        [
          29,
          27
        ],
        [
          20,
          28
        ],
        [
          29,
          28
        ],
        [
          12,
          12
        ],
        [
          12,
          37
        ],
        [
          13,
          12
        ],
        [
          13,
          37
        ],
        [
          14,
          12
        ],
        [
          14,
          37
        ],
        [
          15,
          12
        ],
        [
          15,
          37
        ],
        [
          16,
          12
        ],
        [
          16,
          37
        ],
        [
          17,
          12
        ],
        [
          17,
          37
        ],
        [
          18,
          12
        ],
        [
          18,
          37
        ],
        [
          19,
          12
        ],
        [
          19,
          37
        ],
        [
          20,
          12
        ],
        [
          20,
          37
        ],
        [
          21,
          12
        ],
        [
          21,
          37
        ],
        [
          22,
          12
        ],
        [
          22,
          37
        ],
        [
          26,
          12
        ],
        [
          26,
          37
        ],
        [
          27,
          12
        ],
        [
          27,
          37
        ],
        [
          28,
          12
        ],
        [
          28,
          37
        ],
        [
          29,
          12
        ],
        [
          29,
          37
        ],
        [
          30,
          12
        ],
        [
          30,
          37
        ],
        [
          31,
          12
        ],
        [
          31,
          37
        ],
        [
          32,
          12
        ],
        [
          32,
          37
        ],
        [
          33,
          12
        ],
        [
          33,
          37
        ],
        [
          34,
          12
        ],
        [
          34,
          37
        ],
        [
          35,
          12
        ],
        [
          35,
          37
        ],
        [
          36,
          12
        ],
        [
          36,
          37
        ],
        [
          37,
          12
        ],
        [
          37,
          37
        ],
        [
          12,
          13
        ],
        [
          37,
          13
        ],
        [
          12,
          14
        ],
        [
          37,
          14
        ],
        [
          12,
          15
        ],
        [
          37,
          15
        ],
        [
          12,
          16
        ],
        [
          37,
          16
        ],
        [
          12,
          17
        ],
        [
          37,
          17
        ],
        [
          12,
          18
        ],
        [
          37,
          18
        ],
        [
          12,
          19
        ],
        [
          37,
          19
        ],
        [
          12,
          20
        ],
        [
          37,
          20
        ],
        [
          12,
          21
        ],
        [
          37,
          21
        ],
        [
          12,
          22
        ],
        [
          37,
          22
        ],
        [
          12,
          26
        ],
        [
          37,
          26
        ],
        [
          12,
          27
        ],
        [
          37,
          27
        ],
        [
          12,
          28
        ],
        [
          37,
          28
        ],
        [
          12,
          29
        ],
        [
          37,
          29
        ],
        [
          12,
          30
        ],
        [
          37,
          30
        ],
        [
          12,
          31
        ],
        [
          37,
          31
        ],
        [
          12,
          32
        ],
        [
          37,
          32
        ],
        [
          12,
          33
        ],
        [
          37,
          33
        ],
        [
          12,
          34
        ],
        [
          37,
          34
        ],
        [
          12,
          35
        ],
        [
          37,
          35
        ],
        [
          12,
          36
        ],
        [
          37,
          36
        ],
        [
          7,
          7
        ],
        [
          7,
          42
        ],
        [
          8,
          7
        ],
        [
          8,
          42
        ],
        [
          9,
          7
        ],
        [
          9,
          42
        ],
        [
          10,
          7
        ],
        [
          10,
          42
        ],
        [
          11,
          7
        ],
        [
          11,
          42
        ],
        [
          12,
          7
        ],
        [
          12,
          42
        ],
        [
          13,
          7
        ],
        [
          13,
          42
        ],
        [
          14,
          7
        ],
        [
          14,
          42
        ],
        [
          15,
          7
        ],
        [
          15,
          42
        ],
        [
          16,
          7
        ],
        [
          16,
          42
        ],
        [
          17,
          7
        ],
        [
          17,
          42
        ],
        [
          18,
          7
        ],
        [
          18,
          42
        ],
        [
          19,
          7
        ],
        [
          19,
          42
        ],
        [
          20,
          7
        ],
        [
          20,
          42
        ],
        [
          21,
          7
        ],
        [
          21,
          42
        ],
        [
          27,
          7
        ],
        [
          27,
          42
        ],
        [
          28,
          7
        ],
        [
          28,
          42
        ],
        [
          29,
          7
        ],
        [
          29,
          42
        ],
        [
          30,
          7
        ],
        [
          30,
          42
        ],
        [
          31,
          7
        ],
        [
          31,
          42
        ],
        [
          32,
          7
        ],
        [
          32,
          42
        ],
        [
          33,
          7
        ],
        [
          33,
          42
        ],
        [
          34,
          7
        ],
        [
          34,
          42
        ],
        [
          35,
          7
        ],
        [
          35,
          42
        ],
        [
          36,
          7
        ],
        [
          36,
          42
        ],
        [
          37,
          7
        ],
        [
          37,
          42
        ],
        [
          38,
          7
        ],
        [
          38,
          42
        ],
        [
          39,
          7
        ],
        [
          39,
          42
        ],
        [
          40,
          7
        ],
        [
          40,
          42
        ],
        [
          41,
          7
        ],
        [
          41,
          42
        ],
        [
          42,
          7
        ],
        [
          42,
          42
        ],
        [
          7,
          8
        ],
        [
          42,
          8
        ],
        [
          7,
          9
        ],
        [
          42,
          9
        ],
        [
          7,
          10
        ],
        [
          42,
          10
        ],
        [
          7,
          11
        ],
        [
          42,
          11
        ],
        [
          7,
          12
        ],
        [
          42,
          12
        ],
        [
          7,
          13
        ],
        [
          42,
          13
        ],
        [
          7,
          14
        ],
        [
          42,
          14
        ],
        [
          7,
          15
        ],
        [
          42,
          15
        ],
        [
          7,
          16
        ],
        [
          42,
          16
        ],
        [
          7,
          17
        ],
        [
          42,
          17
        ],
        [
          7,
          18
        ],
        [
          42,
          18
        ],
        [
          7,
          19
        ],
        [
          42,
          19
        ],
        [
          7,
          20
        ],
        [
          42,
          20
        ],
        [
          7,
          21
        ],
        [
          42,
          21
        ],
        [
          7,
          27
        ],
        [
          42,
          27
        ],
        [
          7,
          28
        ],
        [
          42,
          28
        ],
        [
          7,
          29
        ],
        [
          42,
          29
        ],
        [
          7,
          30
        ],
        [
          42,
          30
        ],
        [
          7,
          31
        ],
        [
          42,
          31
        ],
        [
          7,
          32
        ],
        [
          42,
          32
        ],
        [
          7,
          33
        ],
        [
          42,
          33
        ],
        [
          7,
          34
        ],
        [
          42,
          34
        ],
        [
          7,
          35
        ],
        [
          42,
          35
        ],
        [
          7,
          36
        ],
        [
          42,
          36
        ],
        [
          7,
          37
        ],
        [
          42,
          37
        ],
        [
          7,
          38
        ],
        [
          42,
          38
        ],
        [
          7,
          39
        ],
        [
          42,
          39
        ],
        [
          7,
          40
        ],
        [
          42,
          40
        ],
        [
          7,
          41
        ],
        [
          42,
          41
        ],
        [
          8,
          20
        ],
        [
          41,
          29
        ],
        [
          20,
          8
        ],
        [
          29,
          41
        ],
        [
          9,
          20
        ],
        [
          40,
          29
        ],
        [
          20,
          9
        ],
        [
          29,
          40
        ],
        [
          10,
          20
        ],
        [
          39,
          29
        ],
        [
          20,
          10
        ],
        [
          29,
          39
        ],
        [
          11,
          20
        ],
        [
          38,
          29
        ],
        [
          20,
          11
        ],
        [
          29,
          38
        ],
        [
          16,
          16
        ],
        [
          17,
          16
        ],
        [
          17,
          33
        ],
        [
          18,
          16
        ],
        [
          19,
          16
        ],
        [
          20,
          16
        ],
        [
          21,
          16
        ],
        [
          21,
          33
        ],
        [
          22,
          33
        ],
        [
          23,
          33
        ],
        [
          25,
          16
        ],
        [
          25,
          33
        ],
        [
          26,
          16
        ],
        [
          26,
          33
        ],
        [
          27,
          16
        ],
        [
          27,
          33
        ],
        [
          28,
          16
        ],
        [
          29,
          16
        ],
        [
          30,
          16
        ],
        [
          31,
          16
        ],
        [
          32,
          16
        ],
        [
          33,
          33
        ],
        [
          16,
          17
        ],
        [
          16,
          18
        ],
        [
          16,
          19
        ],
        [
          16,
          20
        ],
        [
          33,
          20
        ],
        [
          16,
          21
        ],
        [
          33,
          21
        ],
        [
          16,
          22
        ],
        [
          33,
          22
        ],
        [
          33,
          23
        ],
        [
          33,
          25
        ],
        [
          33,
          26
        ],
        [
          16,
          27
        ],
        [
          16,
          28
        ],
        [
          16,
          29
        ],
        [
          16,
          30
        ],
        [
          33,
          30
        ],
        [
          33,
          31
        ],
        [
          33,
          32
        ]
      ],
      "traps": [
        {
          "instance_id": 1,
          "trap_id": "Bomb",
          "tile_x": 23,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 2,
          "trap_id": "Bomb",
          "tile_x": 24,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 3,
          "trap_id": "Bomb",
          "tile_x": 22,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 4,
          "trap_id": "Bomb",
          "tile_x": 22,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 5,
          "trap_id": "Bomb",
          "tile_x": 22,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 6,
          "trap_id": "Bomb",
          "tile_x": 25,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 7,
          "trap_id": "Bomb",
          "tile_x": 22,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 8,
          "trap_id": "Bomb",
          "tile_x": 23,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 9,
          "trap_id": "SpringTrap",
          "tile_x": 24,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 10,
          "trap_id": "SpringTrap",
          "tile_x": 21,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 11,
          "trap_id": "SpringTrap",
          "tile_x": 21,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 12,
          "trap_id": "SpringTrap",
          "tile_x": 22,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 13,
          "trap_id": "SpringTrap",
          "tile_x": 25,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 14,
          "trap_id": "SpringTrap",
          "tile_x": 21,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 15,
          "trap_id": "SpringTrap",
          "tile_x": 26,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 16,
          "trap_id": "SpringTrap",
          "tile_x": 21,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 17,
          "trap_id": "SpringTrap",
          "tile_x": 21,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 18,
          "trap_id": "AirBomb",
          "tile_x": 26,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 19,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 20,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 21,
          "trap_id": "AirBomb",
          "tile_x": 23,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 22,
          "trap_id": "AirBomb",
          "tile_x": 24,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 23,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 24,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 25,
          "trap_id": "AirBomb",
          "tile_x": 25,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 26,
          "trap_id": "GiantBomb",
          "tile_x": 22,
          "tile_y": 16,
          "mode": "Default"
        },
        {
          "instance_id": 27,
          "trap_id": "GiantBomb",
          "tile_x": 26,
          "tile_y": 30,
          "mode": "Default"
        },
        {
          "instance_id": 28,
          "trap_id": "GiantBomb",
          "tile_x": 17,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 29,
          "trap_id": "GiantBomb",
          "tile_x": 18,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 30,
          "trap_id": "GiantBomb",
          "tile_x": 15,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 31,
          "trap_id": "GiantBomb",
          "tile_x": 30,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 32,
          "trap_id": "GiantBomb",
          "tile_x": 30,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 33,
          "trap_id": "GiantBomb",
          "tile_x": 15,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 34,
          "trap_id": "SeekingAirMine",
          "tile_x": 27,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 35,
          "trap_id": "SeekingAirMine",
          "tile_x": 26,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 36,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 37,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 38,
          "trap_id": "SeekingAirMine",
          "tile_x": 23,
          "tile_y": 28,
          "mode": "Default"
        },
        {
          "instance_id": 39,
          "trap_id": "SeekingAirMine",
          "tile_x": 24,
          "tile_y": 28,
          "mode": "Default"
        },
        {
          "instance_id": 40,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 41,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 42,
          "trap_id": "SeekingAirMine",
          "tile_x": 22,
          "tile_y": 28,
          "mode": "Default"
        },
        {
          "instance_id": 43,
          "trap_id": "SkeletonTrap",
          "tile_x": 25,
          "tile_y": 28,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 44,
          "trap_id": "SkeletonTrap",
          "tile_x": 28,
          "tile_y": 21,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 45,
          "trap_id": "SkeletonTrap",
          "tile_x": 21,
          "tile_y": 28,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 46,
          "trap_id": "SkeletonTrap",
          "tile_x": 26,
          "tile_y": 28,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 47,
          "trap_id": "TornadoTrap",
          "tile_x": 27,
          "tile_y": 28,
          "mode": "Default"
        },
        {
          "instance_id": 48,
          "trap_id": "GigaBomb",
          "tile_x": 28,
          "tile_y": 30,
          "mode": "Default"
        }
      ],
      "defending_heroes": [
        {
          "hero_id": "BarbarianKing",
          "tile_x": 20,
          "tile_y": 27
        },
        {
          "hero_id": "ArcherQueen",
          "tile_x": 28,
          "tile_y": 20
        },
        {
          "hero_id": "GrandWarden",
          "tile_x": 27,
          "tile_y": 28
        },
        {
          "hero_id": "DragonDuke",
          "tile_x": 20,
          "tile_y": 20
        }
      ],
      "defending_cc_troops": [
        [
          "LavaHound",
          1
        ],
        [
          "IceGolem",
          1
        ],
        [
          "Archer",
          5
        ]
      ]
    },
    {
      "name": "TH18 Anti-Fireball Wide Spread (3 Single Infernos)",
      "buildings": [
        {
          "instance_id": 1,
          "building_id": "TownHall",
          "tile_x": 23,
          "tile_y": 17,
          "mode": "GuardianLogger",
          "direction_deg": 0.0
        },
        {
          "instance_id": 2,
          "building_id": "Monolith",
          "tile_x": 22,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 3,
          "building_id": "RevengeTower",
          "tile_x": 25,
          "tile_y": 28,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 4,
          "building_id": "MultiGearTower",
          "tile_x": 15,
          "tile_y": 23,
          "mode": "MultiGearLongRange",
          "direction_deg": 0.0
        },
        {
          "instance_id": 5,
          "building_id": "CraftingStation",
          "tile_x": 25,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 6,
          "building_id": "InfernoTower",
          "tile_x": 23,
          "tile_y": 30,
          "mode": "InfernoSingle",
          "direction_deg": 0.0
        },
        {
          "instance_id": 7,
          "building_id": "InfernoTower",
          "tile_x": 19,
          "tile_y": 18,
          "mode": "InfernoSingle",
          "direction_deg": 0.0
        },
        {
          "instance_id": 8,
          "building_id": "InfernoTower",
          "tile_x": 29,
          "tile_y": 25,
          "mode": "InfernoSingle",
          "direction_deg": 0.0
        },
        {
          "instance_id": 9,
          "building_id": "Scattershot",
          "tile_x": 15,
          "tile_y": 29,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 10,
          "building_id": "Scattershot",
          "tile_x": 24,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 11,
          "building_id": "Firespitter",
          "tile_x": 25,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 180.0
        },
        {
          "instance_id": 12,
          "building_id": "Firespitter",
          "tile_x": 19,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 13,
          "building_id": "SuperWizardTower",
          "tile_x": 28,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 14,
          "building_id": "SuperWizardTower",
          "tile_x": 22,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 15,
          "building_id": "XBow",
          "tile_x": 18,
          "tile_y": 12,
          "mode": "XBowGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 16,
          "building_id": "XBow",
          "tile_x": 32,
          "tile_y": 29,
          "mode": "XBowGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 17,
          "building_id": "XBow",
          "tile_x": 12,
          "tile_y": 25,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 18,
          "building_id": "XBow",
          "tile_x": 32,
          "tile_y": 17,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 19,
          "building_id": "MultiArcherTower",
          "tile_x": 24,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 20,
          "building_id": "MultiArcherTower",
          "tile_x": 12,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 21,
          "building_id": "MultiArcherTower",
          "tile_x": 35,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 22,
          "building_id": "RicochetCannon",
          "tile_x": 14,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 23,
          "building_id": "RicochetCannon",
          "tile_x": 22,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 24,
          "building_id": "RicochetCannon",
          "tile_x": 32,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 25,
          "building_id": "AirDefense",
          "tile_x": 9,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 26,
          "building_id": "AirDefense",
          "tile_x": 32,
          "tile_y": 14,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 27,
          "building_id": "AirDefense",
          "tile_x": 18,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 28,
          "building_id": "AirDefense",
          "tile_x": 15,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 29,
          "building_id": "AirSweeper",
          "tile_x": 35,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 90.0
        },
        {
          "instance_id": 30,
          "building_id": "AirSweeper",
          "tile_x": 11,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 270.0
        },
        {
          "instance_id": 31,
          "building_id": "SpellTower",
          "tile_x": 29,
          "tile_y": 11,
          "mode": "SpellTowerEarthquake",
          "direction_deg": 0.0
        },
        {
          "instance_id": 32,
          "building_id": "SpellTower",
          "tile_x": 29,
          "tile_y": 36,
          "mode": "SpellTowerInvisibility",
          "direction_deg": 0.0
        },
        {
          "instance_id": 33,
          "building_id": "BombTower",
          "tile_x": 6,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 34,
          "building_id": "BombTower",
          "tile_x": 35,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 35,
          "building_id": "WizardTower",
          "tile_x": 15,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 36,
          "building_id": "WizardTower",
          "tile_x": 19,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 37,
          "building_id": "Mortar",
          "tile_x": 37,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 38,
          "building_id": "Mortar",
          "tile_x": 5,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 39,
          "building_id": "Mortar",
          "tile_x": 34,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 40,
          "building_id": "Mortar",
          "tile_x": 23,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 41,
          "building_id": "Cannon",
          "tile_x": 10,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 42,
          "building_id": "ArcherTower",
          "tile_x": 40,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 43,
          "building_id": "ArcherTower",
          "tile_x": 10,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 44,
          "building_id": "ArcherTower",
          "tile_x": 25,
          "tile_y": 5,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 45,
          "building_id": "HiddenTesla",
          "tile_x": 33,
          "tile_y": 38,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 46,
          "building_id": "HiddenTesla",
          "tile_x": 4,
          "tile_y": 19,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 47,
          "building_id": "HiddenTesla",
          "tile_x": 38,
          "tile_y": 15,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 48,
          "building_id": "HiddenTesla",
          "tile_x": 17,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 49,
          "building_id": "HiddenTesla",
          "tile_x": 15,
          "tile_y": 7,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 50,
          "building_id": "BuildersHut",
          "tile_x": 41,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 51,
          "building_id": "BuildersHut",
          "tile_x": 5,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 52,
          "building_id": "BuildersHut",
          "tile_x": 31,
          "tile_y": 7,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 53,
          "building_id": "BuildersHut",
          "tile_x": 27,
          "tile_y": 42,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 54,
          "building_id": "BuildersHut",
          "tile_x": 7,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 55,
          "building_id": "GoldStorage",
          "tile_x": 35,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 56,
          "building_id": "GoldStorage",
          "tile_x": 6,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 57,
          "building_id": "GoldStorage",
          "tile_x": 37,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 58,
          "building_id": "GoldStorage",
          "tile_x": 20,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 59,
          "building_id": "ElixirStorage",
          "tile_x": 10,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 60,
          "building_id": "ElixirStorage",
          "tile_x": 43,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 61,
          "building_id": "ElixirStorage",
          "tile_x": 6,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 62,
          "building_id": "ElixirStorage",
          "tile_x": 28,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 63,
          "building_id": "DarkElixirStorage",
          "tile_x": 32,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 64,
          "building_id": "ClanCastle",
          "tile_x": 3,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 65,
          "building_id": "GoldMine",
          "tile_x": 22,
          "tile_y": 38,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 66,
          "building_id": "GoldMine",
          "tile_x": 15,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 67,
          "building_id": "GoldMine",
          "tile_x": 37,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 68,
          "building_id": "GoldMine",
          "tile_x": 8,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 69,
          "building_id": "GoldMine",
          "tile_x": 28,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 70,
          "building_id": "GoldMine",
          "tile_x": 29,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 71,
          "building_id": "GoldMine",
          "tile_x": 6,
          "tile_y": 15,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 72,
          "building_id": "ElixirCollector",
          "tile_x": 41,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 73,
          "building_id": "ElixirCollector",
          "tile_x": 11,
          "tile_y": 41,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 74,
          "building_id": "ElixirCollector",
          "tile_x": 20,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 75,
          "building_id": "ElixirCollector",
          "tile_x": 37,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 76,
          "building_id": "ElixirCollector",
          "tile_x": 3,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 77,
          "building_id": "ElixirCollector",
          "tile_x": 37,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 78,
          "building_id": "ElixirCollector",
          "tile_x": 21,
          "tile_y": 44,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 79,
          "building_id": "DarkElixirDrill",
          "tile_x": 7,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 80,
          "building_id": "DarkElixirDrill",
          "tile_x": 44,
          "tile_y": 28,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 81,
          "building_id": "DarkElixirDrill",
          "tile_x": 4,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 82,
          "building_id": "ArmyCamp",
          "tile_x": 16,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 83,
          "building_id": "ArmyCamp",
          "tile_x": 5,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 84,
          "building_id": "ArmyCamp",
          "tile_x": 43,
          "tile_y": 31,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 85,
          "building_id": "ArmyCamp",
          "tile_x": 5,
          "tile_y": 39,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 86,
          "building_id": "Barracks",
          "tile_x": 31,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 87,
          "building_id": "DarkBarracks",
          "tile_x": 28,
          "tile_y": 44,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 88,
          "building_id": "Laboratory",
          "tile_x": 3,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 89,
          "building_id": "SpellFactory",
          "tile_x": 44,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 90,
          "building_id": "DarkSpellFactory",
          "tile_x": 8,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 91,
          "building_id": "HeroHall",
          "tile_x": 3,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 92,
          "building_id": "Blacksmith",
          "tile_x": 41,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 93,
          "building_id": "Workshop",
          "tile_x": 3,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 94,
          "building_id": "PetHouse",
          "tile_x": 40,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 95,
          "building_id": "HelperHut",
          "tile_x": 24,
          "tile_y": 44,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 96,
          "building_id": "BobsHut",
          "tile_x": 8,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        }
      ],
      "walls": [
        [
          9,
          9
        ],
        [
          9,
          21
        ],
        [
          10,
          9
        ],
        [
          10,
          21
        ],
        [
          11,
          9
        ],
        [
          11,
          21
        ],
        [
          12,
          9
        ],
        [
          12,
          21
        ],
        [
          13,
          9
        ],
        [
          13,
          21
        ],
        [
          14,
          9
        ],
        [
          14,
          21
        ],
        [
          16,
          9
        ],
        [
          16,
          21
        ],
        [
          17,
          9
        ],
        [
          17,
          21
        ],
        [
          18,
          9
        ],
        [
          18,
          21
        ],
        [
          19,
          9
        ],
        [
          19,
          21
        ],
        [
          20,
          9
        ],
        [
          20,
          21
        ],
        [
          21,
          9
        ],
        [
          21,
          21
        ],
        [
          9,
          10
        ],
        [
          21,
          10
        ],
        [
          9,
          11
        ],
        [
          21,
          11
        ],
        [
          9,
          12
        ],
        [
          21,
          12
        ],
        [
          9,
          13
        ],
        [
          21,
          13
        ],
        [
          9,
          14
        ],
        [
          21,
          14
        ],
        [
          9,
          16
        ],
        [
          21,
          16
        ],
        [
          9,
          17
        ],
        [
          21,
          17
        ],
        [
          9,
          18
        ],
        [
          21,
          18
        ],
        [
          9,
          19
        ],
        [
          21,
          19
        ],
        [
          9,
          20
        ],
        [
          21,
          20
        ],
        [
          28,
          9
        ],
        [
          28,
          21
        ],
        [
          29,
          9
        ],
        [
          29,
          21
        ],
        [
          30,
          9
        ],
        [
          30,
          21
        ],
        [
          31,
          9
        ],
        [
          31,
          21
        ],
        [
          32,
          9
        ],
        [
          32,
          21
        ],
        [
          33,
          9
        ],
        [
          33,
          21
        ],
        [
          35,
          9
        ],
        [
          35,
          21
        ],
        [
          36,
          9
        ],
        [
          36,
          21
        ],
        [
          37,
          9
        ],
        [
          37,
          21
        ],
        [
          38,
          9
        ],
        [
          38,
          21
        ],
        [
          39,
          9
        ],
        [
          39,
          21
        ],
        [
          40,
          9
        ],
        [
          40,
          21
        ],
        [
          28,
          10
        ],
        [
          40,
          10
        ],
        [
          28,
          11
        ],
        [
          40,
          11
        ],
        [
          28,
          12
        ],
        [
          40,
          12
        ],
        [
          28,
          13
        ],
        [
          40,
          13
        ],
        [
          28,
          14
        ],
        [
          40,
          14
        ],
        [
          28,
          16
        ],
        [
          40,
          16
        ],
        [
          28,
          17
        ],
        [
          40,
          17
        ],
        [
          28,
          18
        ],
        [
          40,
          18
        ],
        [
          28,
          19
        ],
        [
          40,
          19
        ],
        [
          28,
          20
        ],
        [
          40,
          20
        ],
        [
          9,
          28
        ],
        [
          9,
          40
        ],
        [
          10,
          28
        ],
        [
          10,
          40
        ],
        [
          11,
          28
        ],
        [
          11,
          40
        ],
        [
          12,
          28
        ],
        [
          12,
          40
        ],
        [
          13,
          28
        ],
        [
          13,
          40
        ],
        [
          14,
          28
        ],
        [
          14,
          40
        ],
        [
          16,
          28
        ],
        [
          16,
          40
        ],
        [
          17,
          28
        ],
        [
          17,
          40
        ],
        [
          18,
          28
        ],
        [
          18,
          40
        ],
        [
          19,
          28
        ],
        [
          19,
          40
        ],
        [
          20,
          28
        ],
        [
          20,
          40
        ],
        [
          21,
          28
        ],
        [
          21,
          40
        ],
        [
          9,
          29
        ],
        [
          21,
          29
        ],
        [
          9,
          30
        ],
        [
          21,
          30
        ],
        [
          9,
          31
        ],
        [
          21,
          31
        ],
        [
          9,
          32
        ],
        [
          21,
          32
        ],
        [
          9,
          33
        ],
        [
          21,
          33
        ],
        [
          9,
          35
        ],
        [
          21,
          35
        ],
        [
          9,
          36
        ],
        [
          21,
          36
        ],
        [
          9,
          37
        ],
        [
          21,
          37
        ],
        [
          9,
          38
        ],
        [
          21,
          38
        ],
        [
          9,
          39
        ],
        [
          21,
          39
        ],
        [
          28,
          28
        ],
        [
          28,
          40
        ],
        [
          29,
          28
        ],
        [
          29,
          40
        ],
        [
          30,
          28
        ],
        [
          30,
          40
        ],
        [
          31,
          28
        ],
        [
          31,
          40
        ],
        [
          32,
          28
        ],
        [
          32,
          40
        ],
        [
          33,
          28
        ],
        [
          33,
          40
        ],
        [
          35,
          28
        ],
        [
          35,
          40
        ],
        [
          36,
          28
        ],
        [
          36,
          40
        ],
        [
          37,
          28
        ],
        [
          37,
          40
        ],
        [
          38,
          28
        ],
        [
          38,
          40
        ],
        [
          39,
          28
        ],
        [
          39,
          40
        ],
        [
          40,
          28
        ],
        [
          40,
          40
        ],
        [
          28,
          29
        ],
        [
          40,
          29
        ],
        [
          28,
          30
        ],
        [
          40,
          30
        ],
        [
          28,
          31
        ],
        [
          40,
          31
        ],
        [
          28,
          32
        ],
        [
          40,
          32
        ],
        [
          28,
          33
        ],
        [
          40,
          33
        ],
        [
          28,
          35
        ],
        [
          40,
          35
        ],
        [
          28,
          36
        ],
        [
          40,
          36
        ],
        [
          28,
          37
        ],
        [
          40,
          37
        ],
        [
          28,
          38
        ],
        [
          40,
          38
        ],
        [
          28,
          39
        ],
        [
          40,
          39
        ],
        [
          18,
          15
        ],
        [
          18,
          34
        ],
        [
          19,
          15
        ],
        [
          19,
          34
        ],
        [
          20,
          15
        ],
        [
          20,
          34
        ],
        [
          21,
          15
        ],
        [
          21,
          34
        ],
        [
          22,
          15
        ],
        [
          22,
          34
        ],
        [
          23,
          15
        ],
        [
          23,
          34
        ],
        [
          25,
          15
        ],
        [
          25,
          34
        ],
        [
          26,
          15
        ],
        [
          26,
          34
        ],
        [
          27,
          15
        ],
        [
          27,
          34
        ],
        [
          28,
          15
        ],
        [
          28,
          34
        ],
        [
          29,
          15
        ],
        [
          29,
          34
        ],
        [
          30,
          15
        ],
        [
          30,
          34
        ],
        [
          31,
          15
        ],
        [
          31,
          34
        ],
        [
          18,
          16
        ],
        [
          31,
          16
        ],
        [
          18,
          17
        ],
        [
          31,
          17
        ],
        [
          18,
          18
        ],
        [
          31,
          18
        ],
        [
          18,
          19
        ],
        [
          31,
          19
        ],
        [
          18,
          20
        ],
        [
          31,
          20
        ],
        [
          18,
          22
        ],
        [
          31,
          22
        ],
        [
          18,
          23
        ],
        [
          31,
          23
        ],
        [
          18,
          25
        ],
        [
          31,
          25
        ],
        [
          18,
          26
        ],
        [
          31,
          26
        ],
        [
          18,
          27
        ],
        [
          31,
          27
        ],
        [
          18,
          29
        ],
        [
          31,
          29
        ],
        [
          18,
          30
        ],
        [
          31,
          30
        ],
        [
          18,
          31
        ],
        [
          31,
          31
        ],
        [
          18,
          32
        ],
        [
          31,
          32
        ],
        [
          18,
          33
        ],
        [
          31,
          33
        ],
        [
          16,
          16
        ],
        [
          17,
          16
        ],
        [
          17,
          33
        ],
        [
          19,
          16
        ],
        [
          19,
          33
        ],
        [
          20,
          16
        ],
        [
          20,
          33
        ],
        [
          22,
          16
        ],
        [
          22,
          33
        ],
        [
          23,
          16
        ],
        [
          25,
          16
        ],
        [
          26,
          16
        ],
        [
          27,
          16
        ],
        [
          29,
          16
        ],
        [
          29,
          33
        ],
        [
          30,
          16
        ],
        [
          30,
          33
        ],
        [
          16,
          17
        ],
        [
          16,
          18
        ],
        [
          33,
          20
        ],
        [
          16,
          22
        ],
        [
          33,
          22
        ],
        [
          33,
          23
        ],
        [
          33,
          27
        ],
        [
          33,
          32
        ],
        [
          27,
          20
        ]
      ],
      "traps": [
        {
          "instance_id": 1,
          "trap_id": "Bomb",
          "tile_x": 23,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 2,
          "trap_id": "Bomb",
          "tile_x": 24,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 3,
          "trap_id": "Bomb",
          "tile_x": 23,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 4,
          "trap_id": "Bomb",
          "tile_x": 24,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 5,
          "trap_id": "Bomb",
          "tile_x": 23,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 6,
          "trap_id": "Bomb",
          "tile_x": 24,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 7,
          "trap_id": "Bomb",
          "tile_x": 22,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 8,
          "trap_id": "Bomb",
          "tile_x": 25,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 9,
          "trap_id": "SpringTrap",
          "tile_x": 22,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 10,
          "trap_id": "SpringTrap",
          "tile_x": 25,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 11,
          "trap_id": "SpringTrap",
          "tile_x": 22,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 12,
          "trap_id": "SpringTrap",
          "tile_x": 25,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 13,
          "trap_id": "SpringTrap",
          "tile_x": 25,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 14,
          "trap_id": "SpringTrap",
          "tile_x": 21,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 15,
          "trap_id": "SpringTrap",
          "tile_x": 26,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 16,
          "trap_id": "SpringTrap",
          "tile_x": 21,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 17,
          "trap_id": "SpringTrap",
          "tile_x": 26,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 18,
          "trap_id": "AirBomb",
          "tile_x": 26,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 19,
          "trap_id": "AirBomb",
          "tile_x": 21,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 20,
          "trap_id": "AirBomb",
          "tile_x": 26,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 21,
          "trap_id": "AirBomb",
          "tile_x": 20,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 22,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 23,
          "trap_id": "AirBomb",
          "tile_x": 20,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 24,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 25,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 24,
          "mode": "Default"
        },
        {
          "instance_id": 26,
          "trap_id": "GiantBomb",
          "tile_x": 19,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 27,
          "trap_id": "GiantBomb",
          "tile_x": 23,
          "tile_y": 32,
          "mode": "Default"
        },
        {
          "instance_id": 28,
          "trap_id": "GiantBomb",
          "tile_x": 16,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 29,
          "trap_id": "GiantBomb",
          "tile_x": 29,
          "tile_y": 29,
          "mode": "Default"
        },
        {
          "instance_id": 30,
          "trap_id": "GiantBomb",
          "tile_x": 19,
          "tile_y": 31,
          "mode": "Default"
        },
        {
          "instance_id": 31,
          "trap_id": "GiantBomb",
          "tile_x": 29,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 32,
          "trap_id": "GiantBomb",
          "tile_x": 29,
          "tile_y": 31,
          "mode": "Default"
        },
        {
          "instance_id": 33,
          "trap_id": "GiantBomb",
          "tile_x": 32,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 34,
          "trap_id": "SeekingAirMine",
          "tile_x": 20,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 35,
          "trap_id": "SeekingAirMine",
          "tile_x": 27,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 36,
          "trap_id": "SeekingAirMine",
          "tile_x": 19,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 37,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 25,
          "mode": "Default"
        },
        {
          "instance_id": 38,
          "trap_id": "SeekingAirMine",
          "tile_x": 19,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 39,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 26,
          "mode": "Default"
        },
        {
          "instance_id": 40,
          "trap_id": "SeekingAirMine",
          "tile_x": 19,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 41,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 42,
          "trap_id": "SeekingAirMine",
          "tile_x": 22,
          "tile_y": 30,
          "mode": "Default"
        },
        {
          "instance_id": 43,
          "trap_id": "SkeletonTrap",
          "tile_x": 22,
          "tile_y": 20,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 44,
          "trap_id": "SkeletonTrap",
          "tile_x": 18,
          "tile_y": 24,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 45,
          "trap_id": "SkeletonTrap",
          "tile_x": 29,
          "tile_y": 27,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 46,
          "trap_id": "SkeletonTrap",
          "tile_x": 22,
          "tile_y": 31,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 47,
          "trap_id": "TornadoTrap",
          "tile_x": 20,
          "tile_y": 20,
          "mode": "Default"
        },
        {
          "instance_id": 48,
          "trap_id": "GigaBomb",
          "tile_x": 16,
          "tile_y": 19,
          "mode": "Default"
        }
      ],
      "defending_heroes": [
        {
          "hero_id": "BarbarianKing",
          "tile_x": 20,
          "tile_y": 27
        },
        {
          "hero_id": "ArcherQueen",
          "tile_x": 28,
          "tile_y": 20
        },
        {
          "hero_id": "GrandWarden",
          "tile_x": 27,
          "tile_y": 28
        },
        {
          "hero_id": "DragonDuke",
          "tile_x": 20,
          "tile_y": 20
        }
      ],
      "defending_cc_troops": [
        [
          "IceGolem",
          2
        ],
        [
          "Headhunter",
          3
        ],
        [
          "Archer",
          7
        ]
      ]
    },
    {
      "name": "TH18 Teaser War Base (Double Rage Towers + Killzone)",
      "buildings": [
        {
          "instance_id": 1,
          "building_id": "TownHall",
          "tile_x": 17,
          "tile_y": 28,
          "mode": "GuardianLogger",
          "direction_deg": 0.0
        },
        {
          "instance_id": 2,
          "building_id": "Monolith",
          "tile_x": 24,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 3,
          "building_id": "RevengeTower",
          "tile_x": 30,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 4,
          "building_id": "MultiGearTower",
          "tile_x": 20,
          "tile_y": 21,
          "mode": "MultiGearFastAttack",
          "direction_deg": 0.0
        },
        {
          "instance_id": 5,
          "building_id": "CraftingStation",
          "tile_x": 27,
          "tile_y": 15,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 6,
          "building_id": "InfernoTower",
          "tile_x": 28,
          "tile_y": 24,
          "mode": "InfernoMulti",
          "direction_deg": 0.0
        },
        {
          "instance_id": 7,
          "building_id": "InfernoTower",
          "tile_x": 21,
          "tile_y": 18,
          "mode": "InfernoMulti",
          "direction_deg": 0.0
        },
        {
          "instance_id": 8,
          "building_id": "InfernoTower",
          "tile_x": 30,
          "tile_y": 18,
          "mode": "InfernoMulti",
          "direction_deg": 0.0
        },
        {
          "instance_id": 9,
          "building_id": "Scattershot",
          "tile_x": 25,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 10,
          "building_id": "Scattershot",
          "tile_x": 24,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 11,
          "building_id": "Firespitter",
          "tile_x": 30,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 225.0
        },
        {
          "instance_id": 12,
          "building_id": "Firespitter",
          "tile_x": 17,
          "tile_y": 19,
          "mode": "Default",
          "direction_deg": 180.0
        },
        {
          "instance_id": 13,
          "building_id": "SuperWizardTower",
          "tile_x": 30,
          "tile_y": 15,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 14,
          "building_id": "SuperWizardTower",
          "tile_x": 26,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 15,
          "building_id": "XBow",
          "tile_x": 20,
          "tile_y": 15,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 16,
          "building_id": "XBow",
          "tile_x": 33,
          "tile_y": 19,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 17,
          "building_id": "XBow",
          "tile_x": 20,
          "tile_y": 25,
          "mode": "XBowAirAndGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 18,
          "building_id": "XBow",
          "tile_x": 27,
          "tile_y": 18,
          "mode": "XBowGround",
          "direction_deg": 0.0
        },
        {
          "instance_id": 19,
          "building_id": "MultiArcherTower",
          "tile_x": 31,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 20,
          "building_id": "MultiArcherTower",
          "tile_x": 14,
          "tile_y": 19,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 21,
          "building_id": "MultiArcherTower",
          "tile_x": 33,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 22,
          "building_id": "RicochetCannon",
          "tile_x": 21,
          "tile_y": 29,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 23,
          "building_id": "RicochetCannon",
          "tile_x": 19,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 24,
          "building_id": "RicochetCannon",
          "tile_x": 34,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 25,
          "building_id": "AirDefense",
          "tile_x": 15,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 26,
          "building_id": "AirDefense",
          "tile_x": 28,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 27,
          "building_id": "AirDefense",
          "tile_x": 28,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 28,
          "building_id": "AirDefense",
          "tile_x": 15,
          "tile_y": 15,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 29,
          "building_id": "AirSweeper",
          "tile_x": 35,
          "tile_y": 17,
          "mode": "Default",
          "direction_deg": 180.0
        },
        {
          "instance_id": 30,
          "building_id": "AirSweeper",
          "tile_x": 20,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 31,
          "building_id": "SpellTower",
          "tile_x": 23,
          "tile_y": 10,
          "mode": "SpellTowerRage",
          "direction_deg": 0.0
        },
        {
          "instance_id": 32,
          "building_id": "SpellTower",
          "tile_x": 34,
          "tile_y": 27,
          "mode": "SpellTowerRage",
          "direction_deg": 0.0
        },
        {
          "instance_id": 33,
          "building_id": "BombTower",
          "tile_x": 11,
          "tile_y": 21,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 34,
          "building_id": "BombTower",
          "tile_x": 38,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 35,
          "building_id": "WizardTower",
          "tile_x": 26,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 36,
          "building_id": "WizardTower",
          "tile_x": 15,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 37,
          "building_id": "Mortar",
          "tile_x": 39,
          "tile_y": 19,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 38,
          "building_id": "Mortar",
          "tile_x": 13,
          "tile_y": 29,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 39,
          "building_id": "Mortar",
          "tile_x": 27,
          "tile_y": 5,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 40,
          "building_id": "Mortar",
          "tile_x": 33,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 41,
          "building_id": "Cannon",
          "tile_x": 10,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 42,
          "building_id": "ArcherTower",
          "tile_x": 38,
          "tile_y": 14,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 43,
          "building_id": "ArcherTower",
          "tile_x": 20,
          "tile_y": 37,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 44,
          "building_id": "ArcherTower",
          "tile_x": 19,
          "tile_y": 5,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 45,
          "building_id": "HiddenTesla",
          "tile_x": 39,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 46,
          "building_id": "HiddenTesla",
          "tile_x": 10,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 47,
          "building_id": "HiddenTesla",
          "tile_x": 33,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 48,
          "building_id": "HiddenTesla",
          "tile_x": 29,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 49,
          "building_id": "HiddenTesla",
          "tile_x": 13,
          "tile_y": 11,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 50,
          "building_id": "BuildersHut",
          "tile_x": 43,
          "tile_y": 18,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 51,
          "building_id": "BuildersHut",
          "tile_x": 16,
          "tile_y": 32,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 52,
          "building_id": "BuildersHut",
          "tile_x": 24,
          "tile_y": 5,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 53,
          "building_id": "BuildersHut",
          "tile_x": 37,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 54,
          "building_id": "BuildersHut",
          "tile_x": 9,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 55,
          "building_id": "GoldStorage",
          "tile_x": 23,
          "tile_y": 40,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 56,
          "building_id": "GoldStorage",
          "tile_x": 10,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 57,
          "building_id": "GoldStorage",
          "tile_x": 42,
          "tile_y": 24,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 58,
          "building_id": "GoldStorage",
          "tile_x": 5,
          "tile_y": 33,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 59,
          "building_id": "ElixirStorage",
          "tile_x": 30,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 60,
          "building_id": "ElixirStorage",
          "tile_x": 33,
          "tile_y": 42,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 61,
          "building_id": "ElixirStorage",
          "tile_x": 3,
          "tile_y": 16,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 62,
          "building_id": "ElixirStorage",
          "tile_x": 43,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 63,
          "building_id": "DarkElixirStorage",
          "tile_x": 13,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 64,
          "building_id": "ClanCastle",
          "tile_x": 14,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 65,
          "building_id": "GoldMine",
          "tile_x": 36,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 66,
          "building_id": "GoldMine",
          "tile_x": 9,
          "tile_y": 29,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 67,
          "building_id": "GoldMine",
          "tile_x": 33,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 68,
          "building_id": "GoldMine",
          "tile_x": 27,
          "tile_y": 38,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 69,
          "building_id": "GoldMine",
          "tile_x": 5,
          "tile_y": 13,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 70,
          "building_id": "GoldMine",
          "tile_x": 43,
          "tile_y": 20,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 71,
          "building_id": "GoldMine",
          "tile_x": 12,
          "tile_y": 37,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 72,
          "building_id": "ElixirCollector",
          "tile_x": 15,
          "tile_y": 9,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 73,
          "building_id": "ElixirCollector",
          "tile_x": 37,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 74,
          "building_id": "ElixirCollector",
          "tile_x": 3,
          "tile_y": 23,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 75,
          "building_id": "ElixirCollector",
          "tile_x": 36,
          "tile_y": 5,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 76,
          "building_id": "ElixirCollector",
          "tile_x": 21,
          "tile_y": 43,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 77,
          "building_id": "ElixirCollector",
          "tile_x": 9,
          "tile_y": 5,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 78,
          "building_id": "ElixirCollector",
          "tile_x": 44,
          "tile_y": 27,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 79,
          "building_id": "DarkElixirDrill",
          "tile_x": 4,
          "tile_y": 36,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 80,
          "building_id": "DarkElixirDrill",
          "tile_x": 39,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 81,
          "building_id": "DarkElixirDrill",
          "tile_x": 36,
          "tile_y": 42,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 82,
          "building_id": "ArmyCamp",
          "tile_x": 9,
          "tile_y": 12,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 83,
          "building_id": "ArmyCamp",
          "tile_x": 43,
          "tile_y": 30,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 84,
          "building_id": "ArmyCamp",
          "tile_x": 4,
          "tile_y": 29,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 85,
          "building_id": "ArmyCamp",
          "tile_x": 42,
          "tile_y": 4,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 86,
          "building_id": "Barracks",
          "tile_x": 28,
          "tile_y": 42,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 87,
          "building_id": "DarkBarracks",
          "tile_x": 5,
          "tile_y": 10,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 88,
          "building_id": "Laboratory",
          "tile_x": 38,
          "tile_y": 22,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 89,
          "building_id": "SpellFactory",
          "tile_x": 9,
          "tile_y": 38,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 90,
          "building_id": "DarkSpellFactory",
          "tile_x": 6,
          "tile_y": 3,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 91,
          "building_id": "HeroHall",
          "tile_x": 43,
          "tile_y": 35,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 92,
          "building_id": "Blacksmith",
          "tile_x": 3,
          "tile_y": 26,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 93,
          "building_id": "Workshop",
          "tile_x": 43,
          "tile_y": 8,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 94,
          "building_id": "PetHouse",
          "tile_x": 24,
          "tile_y": 44,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 95,
          "building_id": "HelperHut",
          "tile_x": 5,
          "tile_y": 6,
          "mode": "Default",
          "direction_deg": 0.0
        },
        {
          "instance_id": 96,
          "building_id": "BobsHut",
          "tile_x": 45,
          "tile_y": 25,
          "mode": "Default",
          "direction_deg": 0.0
        }
      ],
      "walls": [
        [
          23,
          12
        ],
        [
          23,
          26
        ],
        [
          24,
          12
        ],
        [
          24,
          26
        ],
        [
          25,
          12
        ],
        [
          25,
          26
        ],
        [
          26,
          12
        ],
        [
          26,
          26
        ],
        [
          27,
          12
        ],
        [
          27,
          26
        ],
        [
          28,
          12
        ],
        [
          28,
          26
        ],
        [
          29,
          12
        ],
        [
          29,
          26
        ],
        [
          31,
          12
        ],
        [
          31,
          26
        ],
        [
          32,
          12
        ],
        [
          32,
          26
        ],
        [
          33,
          12
        ],
        [
          33,
          26
        ],
        [
          34,
          12
        ],
        [
          34,
          26
        ],
        [
          35,
          12
        ],
        [
          35,
          26
        ],
        [
          36,
          12
        ],
        [
          36,
          26
        ],
        [
          37,
          12
        ],
        [
          37,
          26
        ],
        [
          23,
          13
        ],
        [
          37,
          13
        ],
        [
          23,
          14
        ],
        [
          37,
          14
        ],
        [
          23,
          15
        ],
        [
          37,
          15
        ],
        [
          23,
          16
        ],
        [
          37,
          16
        ],
        [
          23,
          17
        ],
        [
          37,
          17
        ],
        [
          23,
          18
        ],
        [
          37,
          18
        ],
        [
          23,
          20
        ],
        [
          37,
          20
        ],
        [
          23,
          21
        ],
        [
          37,
          21
        ],
        [
          23,
          22
        ],
        [
          37,
          22
        ],
        [
          23,
          23
        ],
        [
          37,
          23
        ],
        [
          23,
          24
        ],
        [
          37,
          24
        ],
        [
          23,
          25
        ],
        [
          37,
          25
        ],
        [
          18,
          9
        ],
        [
          18,
          32
        ],
        [
          19,
          9
        ],
        [
          19,
          32
        ],
        [
          20,
          9
        ],
        [
          20,
          32
        ],
        [
          21,
          9
        ],
        [
          21,
          32
        ],
        [
          22,
          9
        ],
        [
          22,
          32
        ],
        [
          23,
          9
        ],
        [
          23,
          32
        ],
        [
          24,
          9
        ],
        [
          24,
          32
        ],
        [
          25,
          9
        ],
        [
          25,
          32
        ],
        [
          26,
          9
        ],
        [
          26,
          32
        ],
        [
          27,
          9
        ],
        [
          27,
          32
        ],
        [
          31,
          9
        ],
        [
          31,
          32
        ],
        [
          32,
          9
        ],
        [
          32,
          32
        ],
        [
          33,
          9
        ],
        [
          33,
          32
        ],
        [
          34,
          9
        ],
        [
          34,
          32
        ],
        [
          35,
          9
        ],
        [
          35,
          32
        ],
        [
          36,
          9
        ],
        [
          36,
          32
        ],
        [
          37,
          9
        ],
        [
          37,
          32
        ],
        [
          38,
          9
        ],
        [
          38,
          32
        ],
        [
          39,
          9
        ],
        [
          39,
          32
        ],
        [
          40,
          9
        ],
        [
          40,
          32
        ],
        [
          41,
          9
        ],
        [
          41,
          32
        ],
        [
          18,
          10
        ],
        [
          41,
          10
        ],
        [
          18,
          11
        ],
        [
          41,
          11
        ],
        [
          18,
          12
        ],
        [
          41,
          12
        ],
        [
          18,
          13
        ],
        [
          41,
          13
        ],
        [
          18,
          14
        ],
        [
          41,
          14
        ],
        [
          18,
          15
        ],
        [
          41,
          15
        ],
        [
          18,
          16
        ],
        [
          41,
          16
        ],
        [
          18,
          17
        ],
        [
          41,
          17
        ],
        [
          18,
          18
        ],
        [
          41,
          18
        ],
        [
          18,
          22
        ],
        [
          41,
          22
        ],
        [
          18,
          23
        ],
        [
          41,
          23
        ],
        [
          18,
          24
        ],
        [
          41,
          24
        ],
        [
          18,
          25
        ],
        [
          41,
          25
        ],
        [
          18,
          26
        ],
        [
          41,
          26
        ],
        [
          18,
          27
        ],
        [
          41,
          27
        ],
        [
          41,
          28
        ],
        [
          41,
          29
        ],
        [
          41,
          30
        ],
        [
          41,
          31
        ],
        [
          12,
          24
        ],
        [
          12,
          36
        ],
        [
          13,
          24
        ],
        [
          13,
          36
        ],
        [
          14,
          24
        ],
        [
          14,
          36
        ],
        [
          15,
          24
        ],
        [
          15,
          36
        ],
        [
          16,
          24
        ],
        [
          16,
          36
        ],
        [
          17,
          24
        ],
        [
          17,
          36
        ],
        [
          19,
          24
        ],
        [
          19,
          36
        ],
        [
          20,
          24
        ],
        [
          20,
          36
        ],
        [
          21,
          24
        ],
        [
          21,
          36
        ],
        [
          22,
          24
        ],
        [
          22,
          36
        ],
        [
          23,
          36
        ],
        [
          24,
          24
        ],
        [
          24,
          36
        ],
        [
          12,
          25
        ],
        [
          24,
          25
        ],
        [
          12,
          26
        ],
        [
          12,
          27
        ],
        [
          24,
          27
        ],
        [
          12,
          28
        ],
        [
          24,
          28
        ],
        [
          12,
          29
        ],
        [
          24,
          29
        ],
        [
          12,
          31
        ],
        [
          24,
          31
        ],
        [
          12,
          32
        ],
        [
          12,
          33
        ],
        [
          24,
          33
        ],
        [
          12,
          34
        ],
        [
          24,
          34
        ],
        [
          12,
          35
        ],
        [
          24,
          35
        ],
        [
          8,
          8
        ],
        [
          8,
          41
        ],
        [
          9,
          8
        ],
        [
          9,
          41
        ],
        [
          10,
          8
        ],
        [
          10,
          41
        ],
        [
          11,
          8
        ],
        [
          11,
          41
        ],
        [
          12,
          8
        ],
        [
          12,
          41
        ],
        [
          13,
          8
        ],
        [
          13,
          41
        ],
        [
          14,
          8
        ],
        [
          14,
          41
        ],
        [
          15,
          8
        ],
        [
          15,
          41
        ],
        [
          16,
          8
        ],
        [
          16,
          41
        ],
        [
          17,
          8
        ],
        [
          17,
          41
        ],
        [
          18,
          8
        ],
        [
          18,
          41
        ],
        [
          19,
          8
        ],
        [
          19,
          41
        ],
        [
          20,
          8
        ],
        [
          20,
          41
        ],
        [
          21,
          8
        ],
        [
          21,
          41
        ],
        [
          22,
          8
        ],
        [
          22,
          41
        ],
        [
          28,
          8
        ],
        [
          28,
          41
        ],
        [
          29,
          8
        ],
        [
          29,
          41
        ],
        [
          30,
          8
        ],
        [
          30,
          41
        ],
        [
          31,
          8
        ],
        [
          31,
          41
        ],
        [
          32,
          8
        ],
        [
          32,
          41
        ],
        [
          33,
          8
        ],
        [
          33,
          41
        ],
        [
          34,
          8
        ],
        [
          34,
          41
        ],
        [
          35,
          8
        ],
        [
          35,
          41
        ],
        [
          36,
          8
        ],
        [
          36,
          41
        ],
        [
          37,
          8
        ],
        [
          37,
          41
        ],
        [
          38,
          8
        ],
        [
          38,
          41
        ],
        [
          39,
          8
        ],
        [
          39,
          41
        ],
        [
          40,
          8
        ],
        [
          40,
          41
        ],
        [
          41,
          8
        ],
        [
          41,
          41
        ],
        [
          42,
          8
        ],
        [
          42,
          41
        ],
        [
          8,
          9
        ],
        [
          42,
          9
        ],
        [
          8,
          10
        ],
        [
          42,
          10
        ],
        [
          8,
          11
        ],
        [
          42,
          11
        ],
        [
          8,
          12
        ],
        [
          42,
          12
        ],
        [
          8,
          13
        ],
        [
          42,
          13
        ],
        [
          8,
          14
        ],
        [
          42,
          14
        ],
        [
          8,
          15
        ],
        [
          42,
          15
        ],
        [
          8,
          16
        ],
        [
          42,
          16
        ],
        [
          8,
          17
        ],
        [
          42,
          17
        ],
        [
          8,
          18
        ],
        [
          42,
          18
        ],
        [
          8,
          19
        ],
        [
          42,
          19
        ],
        [
          8,
          20
        ],
        [
          42,
          20
        ],
        [
          8,
          21
        ],
        [
          42,
          21
        ],
        [
          8,
          27
        ],
        [
          42,
          27
        ],
        [
          8,
          28
        ],
        [
          42,
          28
        ],
        [
          8,
          29
        ],
        [
          42,
          29
        ],
        [
          8,
          30
        ],
        [
          42,
          30
        ],
        [
          8,
          31
        ],
        [
          42,
          31
        ],
        [
          8,
          32
        ],
        [
          42,
          32
        ],
        [
          8,
          33
        ],
        [
          42,
          33
        ],
        [
          8,
          34
        ],
        [
          42,
          34
        ],
        [
          8,
          35
        ],
        [
          42,
          35
        ],
        [
          8,
          36
        ],
        [
          42,
          36
        ],
        [
          8,
          37
        ],
        [
          42,
          37
        ],
        [
          8,
          38
        ],
        [
          42,
          38
        ],
        [
          8,
          39
        ],
        [
          42,
          39
        ],
        [
          8,
          40
        ],
        [
          42,
          40
        ],
        [
          18,
          33
        ],
        [
          19,
          16
        ],
        [
          19,
          33
        ],
        [
          22,
          33
        ],
        [
          23,
          33
        ],
        [
          25,
          33
        ],
        [
          29,
          33
        ],
        [
          30,
          33
        ],
        [
          31,
          33
        ],
        [
          32,
          33
        ],
        [
          16,
          18
        ],
        [
          16,
          22
        ],
        [
          16,
          23
        ],
        [
          33,
          23
        ],
        [
          33,
          25
        ],
        [
          16,
          28
        ],
        [
          16,
          29
        ],
        [
          16,
          30
        ],
        [
          33,
          30
        ],
        [
          16,
          31
        ],
        [
          33,
          31
        ],
        [
          20,
          20
        ],
        [
          21,
          20
        ],
        [
          22,
          20
        ],
        [
          25,
          29
        ],
        [
          29,
          29
        ]
      ],
      "traps": [
        {
          "instance_id": 1,
          "trap_id": "Bomb",
          "tile_x": 26,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 2,
          "trap_id": "Bomb",
          "tile_x": 28,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 3,
          "trap_id": "Bomb",
          "tile_x": 29,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 4,
          "trap_id": "Bomb",
          "tile_x": 26,
          "tile_y": 20,
          "mode": "Default"
        },
        {
          "instance_id": 5,
          "trap_id": "Bomb",
          "tile_x": 27,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 6,
          "trap_id": "Bomb",
          "tile_x": 32,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 7,
          "trap_id": "Bomb",
          "tile_x": 25,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 8,
          "trap_id": "Bomb",
          "tile_x": 32,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 9,
          "trap_id": "SpringTrap",
          "tile_x": 26,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 10,
          "trap_id": "SpringTrap",
          "tile_x": 28,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 11,
          "trap_id": "SpringTrap",
          "tile_x": 29,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 12,
          "trap_id": "SpringTrap",
          "tile_x": 25,
          "tile_y": 20,
          "mode": "Default"
        },
        {
          "instance_id": 13,
          "trap_id": "SpringTrap",
          "tile_x": 27,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 14,
          "trap_id": "SpringTrap",
          "tile_x": 25,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 15,
          "trap_id": "SpringTrap",
          "tile_x": 26,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 16,
          "trap_id": "SpringTrap",
          "tile_x": 28,
          "tile_y": 14,
          "mode": "Default"
        },
        {
          "instance_id": 17,
          "trap_id": "SpringTrap",
          "tile_x": 29,
          "tile_y": 14,
          "mode": "Default"
        },
        {
          "instance_id": 18,
          "trap_id": "AirBomb",
          "tile_x": 33,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 19,
          "trap_id": "AirBomb",
          "tile_x": 24,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 20,
          "trap_id": "AirBomb",
          "tile_x": 28,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 21,
          "trap_id": "AirBomb",
          "tile_x": 29,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 22,
          "trap_id": "AirBomb",
          "tile_x": 27,
          "tile_y": 14,
          "mode": "Default"
        },
        {
          "instance_id": 23,
          "trap_id": "AirBomb",
          "tile_x": 30,
          "tile_y": 14,
          "mode": "Default"
        },
        {
          "instance_id": 24,
          "trap_id": "AirBomb",
          "tile_x": 33,
          "tile_y": 17,
          "mode": "Default"
        },
        {
          "instance_id": 25,
          "trap_id": "AirBomb",
          "tile_x": 24,
          "tile_y": 20,
          "mode": "Default"
        },
        {
          "instance_id": 26,
          "trap_id": "GiantBomb",
          "tile_x": 31,
          "tile_y": 13,
          "mode": "Default"
        },
        {
          "instance_id": 27,
          "trap_id": "GiantBomb",
          "tile_x": 26,
          "tile_y": 10,
          "mode": "Default"
        },
        {
          "instance_id": 28,
          "trap_id": "GiantBomb",
          "tile_x": 31,
          "tile_y": 10,
          "mode": "Default"
        },
        {
          "instance_id": 29,
          "trap_id": "GiantBomb",
          "tile_x": 29,
          "tile_y": 27,
          "mode": "Default"
        },
        {
          "instance_id": 30,
          "trap_id": "GiantBomb",
          "tile_x": 33,
          "tile_y": 10,
          "mode": "Default"
        },
        {
          "instance_id": 31,
          "trap_id": "GiantBomb",
          "tile_x": 38,
          "tile_y": 17,
          "mode": "Default"
        },
        {
          "instance_id": 32,
          "trap_id": "GiantBomb",
          "tile_x": 35,
          "tile_y": 10,
          "mode": "Default"
        },
        {
          "instance_id": 33,
          "trap_id": "GiantBomb",
          "tile_x": 25,
          "tile_y": 7,
          "mode": "Default"
        },
        {
          "instance_id": 34,
          "trap_id": "SeekingAirMine",
          "tile_x": 25,
          "tile_y": 22,
          "mode": "Default"
        },
        {
          "instance_id": 35,
          "trap_id": "SeekingAirMine",
          "tile_x": 33,
          "tile_y": 16,
          "mode": "Default"
        },
        {
          "instance_id": 36,
          "trap_id": "SeekingAirMine",
          "tile_x": 24,
          "tile_y": 21,
          "mode": "Default"
        },
        {
          "instance_id": 37,
          "trap_id": "SeekingAirMine",
          "tile_x": 28,
          "tile_y": 13,
          "mode": "Default"
        },
        {
          "instance_id": 38,
          "trap_id": "SeekingAirMine",
          "tile_x": 29,
          "tile_y": 13,
          "mode": "Default"
        },
        {
          "instance_id": 39,
          "trap_id": "SeekingAirMine",
          "tile_x": 34,
          "tile_y": 18,
          "mode": "Default"
        },
        {
          "instance_id": 40,
          "trap_id": "SeekingAirMine",
          "tile_x": 23,
          "tile_y": 19,
          "mode": "Default"
        },
        {
          "instance_id": 41,
          "trap_id": "SeekingAirMine",
          "tile_x": 27,
          "tile_y": 13,
          "mode": "Default"
        },
        {
          "instance_id": 42,
          "trap_id": "SeekingAirMine",
          "tile_x": 30,
          "tile_y": 13,
          "mode": "Default"
        },
        {
          "instance_id": 43,
          "trap_id": "SkeletonTrap",
          "tile_x": 34,
          "tile_y": 17,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 44,
          "trap_id": "SkeletonTrap",
          "tile_x": 24,
          "tile_y": 22,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 45,
          "trap_id": "SkeletonTrap",
          "tile_x": 33,
          "tile_y": 22,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 46,
          "trap_id": "SkeletonTrap",
          "tile_x": 34,
          "tile_y": 16,
          "mode": "SkeletonGround"
        },
        {
          "instance_id": 47,
          "trap_id": "TornadoTrap",
          "tile_x": 24,
          "tile_y": 23,
          "mode": "Default"
        },
        {
          "instance_id": 48,
          "trap_id": "GigaBomb",
          "tile_x": 23,
          "tile_y": 7,
          "mode": "Default"
        }
      ],
      "defending_heroes": [
        {
          "hero_id": "BarbarianKing",
          "tile_x": 20,
          "tile_y": 27
        },
        {
          "hero_id": "ArcherQueen",
          "tile_x": 28,
          "tile_y": 20
        },
        {
          "hero_id": "GrandWarden",
          "tile_x": 27,
          "tile_y": 28
        },
        {
          "hero_id": "DragonDuke",
          "tile_x": 20,
          "tile_y": 20
        }
      ],
      "defending_cc_troops": [
        [
          "Furnace",
          1
        ],
        [
          "Witch",
          1
        ],
        [
          "Headhunter",
          3
        ],
        [
          "Archer",
          2
        ]
      ]
    }
  ],
  "preset_armies": [
    {
      "name": "TH18 Thrower + Healer + Totem Smash (Meta)",
      "troops": [
        [
          "Thrower",
          12
        ],
        [
          "Healer",
          5
        ],
        [
          "Furnace",
          2
        ],
        [
          "Druid",
          1
        ],
        [
          "IceGolem",
          1
        ],
        [
          "SuperWallBreaker",
          1
        ],
        [
          "Headhunter",
          1
        ],
        [
          "Balloon",
          1
        ],
        [
          "Archer",
          4
        ]
      ],
      "spells": [
        [
          "Totem",
          7
        ],
        [
          "Rage",
          1
        ],
        [
          "Poison",
          1
        ],
        [
          "SkeletonSpell",
          1
        ]
      ],
      "heroes": [
        [
          "BarbarianKing",
          "Frosty"
        ],
        [
          "ArcherQueen",
          "Unicorn"
        ],
        [
          "GrandWarden",
          "AngryJelly"
        ],
        [
          "RoyalChampion",
          "Phoenix"
        ]
      ],
      "hero_equipment": [
        [
          "BarbarianKing",
          [
            "SpikyBall",
            "SnakeBracelet"
          ]
        ],
        [
          "ArcherQueen",
          [
            "MagicMirror",
            "ActionFigure"
          ]
        ],
        [
          "GrandWarden",
          [
            "EternalTome",
            "RageGem"
          ]
        ],
        [
          "RoyalChampion",
          [
            "RocketSpear",
            "ElectroBoots"
          ]
        ]
      ],
      "siege_machine": "LogLauncher",
      "cc_troops": [
        [
          "SuperYeti",
          1
        ],
        [
          "SuperValkyrie",
          1
        ]
      ],
      "cc_spells": [
        [
          "Rage",
          1
        ],
        [
          "Freeze",
          1
        ]
      ]
    },
    {
      "name": "TH18 Dragon Duke Charge Hydra (Meta)",
      "troops": [
        [
          "Dragon",
          7
        ],
        [
          "DragonRider",
          6
        ],
        [
          "RocketBalloon",
          5
        ],
        [
          "IceGolem",
          1
        ],
        [
          "Headhunter",
          1
        ],
        [
          "Archer",
          1
        ]
      ],
      "spells": [
        [
          "Totem",
          6
        ],
        [
          "Rage",
          2
        ],
        [
          "Freeze",
          1
        ],
        [
          "Poison",
          1
        ]
      ],
      "heroes": [
        [
          "DragonDuke",
          "Phoenix"
        ],
        [
          "MinionPrince",
          "AngryJelly"
        ],
        [
          "GrandWarden",
          "ElectroOwl"
        ],
        [
          "RoyalChampion",
          "SpiritFox"
        ]
      ],
      "hero_equipment": [
        [
          "DragonDuke",
          [
            "RevengeDeck",
            "FlameBlower"
          ]
        ],
        [
          "MinionPrince",
          [
            "PortalPendant",
            "DarkOrb"
          ]
        ],
        [
          "GrandWarden",
          [
            "EternalTome",
            "RageGem"
          ]
        ],
        [
          "RoyalChampion",
          [
            "RocketSpear",
            "ElectroBoots"
          ]
        ]
      ],
      "siege_machine": "BattleBlimp",
      "cc_troops": [
        [
          "DragonRider",
          2
        ],
        [
          "Balloon",
          1
        ]
      ],
      "cc_spells": [
        [
          "Rage",
          1
        ],
        [
          "Freeze",
          1
        ]
      ]
    },
    {
      "name": "TH18 Fireball Super Bowler & Meteor Golem Smash (Meta)",
      "troops": [
        [
          "SuperBowler",
          5
        ],
        [
          "MeteorGolem",
          1
        ],
        [
          "Healer",
          5
        ],
        [
          "RootRider",
          1
        ],
        [
          "Furnace",
          1
        ],
        [
          "Druid",
          1
        ],
        [
          "SuperWallBreaker",
          2
        ],
        [
          "IceGolem",
          1
        ],
        [
          "Headhunter",
          1
        ],
        [
          "Archer",
          1
        ]
      ],
      "spells": [
        [
          "Totem",
          4
        ],
        [
          "Rage",
          2
        ],
        [
          "Overgrowth",
          1
        ],
        [
          "Earthquake",
          1
        ],
        [
          "Invisibility",
          1
        ]
      ],
      "heroes": [
        [
          "GrandWarden",
          "AngryJelly"
        ],
        [
          "DragonDuke",
          "Phoenix"
        ],
        [
          "BarbarianKing",
          "Frosty"
        ],
        [
          "ArcherQueen",
          "Unicorn"
        ]
      ],
      "hero_equipment": [
        [
          "GrandWarden",
          [
            "Fireball",
            "EternalTome"
          ]
        ],
        [
          "DragonDuke",
          [
            "RocketBackpack",
            "FireHeart"
          ]
        ],
        [
          "BarbarianKing",
          [
            "GiantGauntlet",
            "SpikyBall"
          ]
        ],
        [
          "ArcherQueen",
          [
            "MagicMirror",
            "FrozenArrow"
          ]
        ]
      ],
      "siege_machine": "FlameFlinger",
      "cc_troops": [
        [
          "SuperYeti",
          1
        ],
        [
          "IceGolem",
          1
        ]
      ],
      "cc_spells": [
        [
          "Rage",
          1
        ],
        [
          "Poison",
          1
        ]
      ]
    }
  ]
} as unknown as FullCatalog;
