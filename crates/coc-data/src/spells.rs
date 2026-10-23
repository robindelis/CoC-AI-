use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SpellId {
    // Elixir Spells (10)
    Lightning,
    Healing,
    Rage,
    Jump,
    Freeze,
    Clone,
    Invisibility,
    Recall,
    Revive,
    Totem,
    // Dark Spells (8)
    Poison,
    Earthquake,
    Haste,
    SkeletonSpell,
    BatSpell,
    Overgrowth,
    IceBlock,
    Angry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SpellEffect {
    InstantDamage {
        damage: f32,
        stun_sec: f32,
    },
    HealOverTime {
        total_heal: f32,
        hero_mult: f32,
    },
    RageBuff {
        damage_mult: f32,
        hero_damage_mult: f32,
        speed_bonus: f32,
    },
    JumpWalls,
    FreezeEnemies,
    CloneUnits {
        max_housing: u16,
        clone_lifetime_sec: f32,
    },
    InvisibilityZone,
    RecallUnits {
        max_housing: u16,
    },
    ReviveHero {
        hp_pct: f32,
    },
    SummonTotem {
        hp: f32,
        decay_per_sec: f32,
        stun_sec: f32,
    },
    PoisonZone {
        max_dps: f32,
        speed_slow_pct: f32,
        attack_slow_pct: f32,
    },
    EarthquakePct {
        building_max_hp_pct: f32,
        wall_mult: f32,
    },
    HasteBuff {
        speed_bonus: f32,
    },
    SpawnSkeletons {
        count: u8,
    },
    SpawnBats {
        count: u8,
    },
    OvergrowthRoots,
    IceBlockShield {
        damage_reduction_pct: f32,
    },
    AngryDefenses {
        damage_mult: f32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpellSpec {
    pub id: SpellId,
    pub name: &'static str,
    pub is_dark: bool,
    pub max_level: u8,
    pub housing_space: u8,
    pub radius: f32,
    pub duration_sec: f32,
    pub effect: SpellEffect,
}

pub static SPELLS: &[SpellSpec] = &[
    SpellSpec {
        id: SpellId::Lightning,
        name: "Lightning Spell",
        is_dark: false,
        max_level: 13,
        housing_space: 1,
        radius: 2.0,
        duration_sec: 0.1,
        effect: SpellEffect::InstantDamage {
            damage: 720.0,
            // L13: StunTimeMS 100
            stun_sec: 0.1,
        },
    },
    SpellSpec {
        id: SpellId::Healing,
        name: "Healing Spell",
        is_dark: false,
        max_level: 12,
        housing_space: 2,
        radius: 5.0,
        duration_sec: 12.3, // 41 hits x 300ms = 12.3s -> 250 HP/s, total 3,075
        effect: SpellEffect::HealOverTime {
            total_heal: 3075.0,
            hero_mult: 0.55,
        },
    },
    SpellSpec {
        id: SpellId::Rage,
        name: "Rage Spell",
        is_dark: false,
        max_level: 7,
        housing_space: 2,
        radius: 5.0,
        duration_sec: 18.0,
        effect: SpellEffect::RageBuff {
            // L7: DamageBoostPercent 190 = +190% damage (x2.90 total, additive
            // convention shared with equipment rage boosts)
            damage_mult: 2.90,
            hero_damage_mult: 2.90,
            speed_bonus: 32.0, // SpeedBoost in raw CoC units (/8 = +4.0 tiles/s)
        },
    },
    SpellSpec {
        id: SpellId::Jump,
        name: "Jump Spell",
        is_dark: false,
        max_level: 5,
        housing_space: 2,
        radius: 3.5,
        duration_sec: 100.25, // JumpBoostMS 100250
        effect: SpellEffect::JumpWalls,
    },
    SpellSpec {
        id: SpellId::Freeze,
        name: "Freeze Spell",
        is_dark: false,
        max_level: 8,
        housing_space: 1,
        radius: 3.5,
        duration_sec: 6.0,
        effect: SpellEffect::FreezeEnemies,
    },
    SpellSpec {
        id: SpellId::Clone,
        name: "Clone Spell",
        is_dark: false,
        max_level: 9,
        housing_space: 3,
        radius: 3.5,
        duration_sec: 18.0,
        effect: SpellEffect::CloneUnits {
            max_housing: 48,
            clone_lifetime_sec: 30.0,
        },
    },
    SpellSpec {
        id: SpellId::Invisibility,
        name: "Invisibility Spell",
        is_dark: false,
        max_level: 4,
        housing_space: 1,
        radius: 4.0,
        duration_sec: 4.25,
        effect: SpellEffect::InvisibilityZone,
    },
    SpellSpec {
        id: SpellId::Recall,
        name: "Recall Spell",
        is_dark: false,
        max_level: 7,
        housing_space: 2,
        radius: 5.0,
        duration_sec: 0.1,
        effect: SpellEffect::RecallUnits { max_housing: 120 },
    },
    SpellSpec {
        id: SpellId::Revive,
        name: "Revive Spell",
        is_dark: false,
        max_level: 5,
        housing_space: 2,
        radius: 8.0,
        duration_sec: 0.1,
        effect: SpellEffect::ReviveHero { hp_pct: 0.80 },
    },
    SpellSpec {
        id: SpellId::Totem,
        name: "Totem Spell",
        is_dark: false,
        max_level: 4,
        housing_space: 1,
        radius: 5.0,
        duration_sec: 38.9,
        effect: SpellEffect::SummonTotem {
            hp: 13000.0,
            decay_per_sec: 334.0,
            stun_sec: 0.2, // StunTimeMS 200
        },
    },
    SpellSpec {
        id: SpellId::Poison,
        name: "Poison Spell",
        is_dark: true,
        max_level: 12,
        housing_space: 1,
        radius: 4.0,
        duration_sec: 16.0,
        effect: SpellEffect::PoisonZone {
            max_dps: 380.0,
            speed_slow_pct: 0.52,
            attack_slow_pct: 0.74,
        },
    },
    SpellSpec {
        id: SpellId::Earthquake,
        name: "Earthquake Spell",
        is_dark: true,
        max_level: 8,
        housing_space: 1,
        radius: 4.7,
        duration_sec: 0.1,
        effect: SpellEffect::EarthquakePct {
            // BuildingDamagePermil 58 x5 ticks against buildings - engine stores the
            // total per cast (29% of max HP) with a halving repeat-counter.
            building_max_hp_pct: 0.29,
            wall_mult: 5.0, // PreferredTargetDamageMod 5.0 vs walls
        },
    },
    SpellSpec {
        id: SpellId::Haste,
        name: "Haste Spell",
        is_dark: true,
        max_level: 7,
        housing_space: 1,
        radius: 5.0,
        duration_sec: 30.25, // 121 hits x 250ms = 30.25s
        effect: SpellEffect::HasteBuff { speed_bonus: 56.0 }, // SpeedBoost 56 (/8 = +7 tiles/s)
    },
    SpellSpec {
        id: SpellId::SkeletonSpell,
        name: "Skeleton Spell",
        is_dark: true,
        max_level: 8,
        housing_space: 1,
        radius: 2.25, // Radius 225 (spawn scatter area)
        duration_sec: 15.0, // SpawnDuration 15000ms (spawned skeleton lifetime)
        effect: SpellEffect::SpawnSkeletons { count: 19 },
    },
    SpellSpec {
        id: SpellId::BatSpell,
        name: "Bat Spell",
        is_dark: true,
        max_level: 8,
        housing_space: 1,
        radius: 2.25, // Radius 225 (spawn scatter area)
        duration_sec: 13.8, // SpawnDuration 13800ms (spawned bat lifetime)
        effect: SpellEffect::SpawnBats { count: 25 },
    },
    SpellSpec {
        id: SpellId::Overgrowth,
        name: "Overgrowth Spell",
        is_dark: true,
        max_level: 5,
        housing_space: 2,
        radius: 6.0,
        duration_sec: 26.0,
        effect: SpellEffect::OvergrowthRoots,
    },
    SpellSpec {
        id: SpellId::IceBlock,
        name: "Ice Block Spell",
        is_dark: true,
        max_level: 6,
        housing_space: 1,
        radius: 5.0, // Radius 500
        duration_sec: 7.0, // FreezeTimeMS 7000
        effect: SpellEffect::IceBlockShield {
            damage_reduction_pct: 0.96, // IceBlockSpell L6: ShieldProtectionPercent 96
        },
    },
    SpellSpec {
        id: SpellId::Angry,
        name: "Angry Spell",
        is_dark: true,
        max_level: 4,
        housing_space: 1,
        radius: 6.0, // Radius 600
        duration_sec: 25.0, // BoostTimeMS 25000
        // csv grants no damage boost - the enraged defenders only retarget.
        effect: SpellEffect::AngryDefenses { damage_mult: 1.0 },
    },
];

pub fn get_spell_spec(id: SpellId) -> &'static SpellSpec {
    SPELLS.iter().find(|s| s.id == id).expect("All SpellIds exist")
}
