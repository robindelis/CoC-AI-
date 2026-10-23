use crate::buildings::TargetDomain;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TrapId {
    Bomb,
    SpringTrap,
    AirBomb,
    GiantBomb,
    SeekingAirMine,
    SkeletonTrap,
    TornadoTrap,
    GigaBomb,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TrapMode {
    Default,
    SkeletonGround,
    SkeletonAir,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrapEffect {
    AreaDamage {
        damage: f32,
        splash_radius: f32,
        knockback_tiles: f32,
    },
    Spring {
        eject_max_housing: u16,
        heavy_damage: f32,
    },
    SingleTargetAirMine {
        damage: f32,
        min_housing: u16,
    },
    SpawnSkeletons {
        count: u8,
    },
    Tornado {
        duration_sec: f32,
        dps: f32,
        pull_radius: f32,
    },
    GigaBlast {
        damage: f32,
        splash_radius: f32,
        knockback_tiles: f32,
        min_housing_trigger: u16,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrapSpec {
    pub id: TrapId,
    pub name: &'static str,
    pub max_level: u8,
    pub max_count: u8,
    pub footprint: u8,
    pub trigger_radius: f32,
    pub target_domain: TargetDomain,
    pub default_mode: TrapMode,
    pub effect: TrapEffect,
}

pub static TRAPS: &[TrapSpec] = &[
    TrapSpec {
        id: TrapId::Bomb,
        name: "Bomb",
        max_level: 14,
        max_count: 8,
        footprint: 1,
        trigger_radius: 1.5,
        target_domain: TargetDomain::Ground,
        default_mode: TrapMode::Default,
        effect: TrapEffect::AreaDamage {
            damage: 200.0,
            splash_radius: 3.0,
            knockback_tiles: 1.0,
        },
    },
    TrapSpec {
        id: TrapId::SpringTrap,
        name: "Spring Trap",
        max_level: 13,
        max_count: 9,
        footprint: 1,
        trigger_radius: 1.0,
        target_domain: TargetDomain::Ground,
        default_mode: TrapMode::Default,
        effect: TrapEffect::Spring {
            eject_max_housing: 18,
            heavy_damage: 1400.0,
        },
    },
    TrapSpec {
        id: TrapId::AirBomb,
        name: "Air Bomb",
        max_level: 13,
        max_count: 8,
        footprint: 1,
        trigger_radius: 4.0,
        target_domain: TargetDomain::Air,
        default_mode: TrapMode::Default,
        effect: TrapEffect::AreaDamage {
            damage: 425.0,
            splash_radius: 3.0,
            knockback_tiles: 0.0,
        },
    },
    TrapSpec {
        id: TrapId::GiantBomb,
        name: "Giant Bomb",
        max_level: 12,
        max_count: 8,
        footprint: 2,
        trigger_radius: 2.0,
        target_domain: TargetDomain::Ground,
        default_mode: TrapMode::Default,
        effect: TrapEffect::AreaDamage {
            damage: 490.0,
            splash_radius: 4.2,
            knockback_tiles: 1.5,
        },
    },
    TrapSpec {
        id: TrapId::SeekingAirMine,
        name: "Seeking Air Mine",
        max_level: 8,
        max_count: 9,
        footprint: 1,
        trigger_radius: 4.0,
        target_domain: TargetDomain::Air,
        default_mode: TrapMode::Default,
        effect: TrapEffect::SingleTargetAirMine {
            damage: 3350.0,
            min_housing: 5,
        },
    },
    TrapSpec {
        id: TrapId::SkeletonTrap,
        name: "Skeleton Trap",
        max_level: 5,
        max_count: 4,
        footprint: 1,
        trigger_radius: 5.0,
        target_domain: TargetDomain::GroundAndAir,
        default_mode: TrapMode::SkeletonGround,
        effect: TrapEffect::SpawnSkeletons { count: 5 },
    },
    TrapSpec {
        id: TrapId::TornadoTrap,
        name: "Tornado Trap",
        max_level: 3,
        max_count: 1,
        footprint: 1,
        trigger_radius: 3.0,
        target_domain: TargetDomain::GroundAndAir,
        default_mode: TrapMode::Default,
        effect: TrapEffect::Tornado {
            duration_sec: 7.0,
            dps: 8.0,
            pull_radius: 3.0,
        },
    },
    TrapSpec {
        id: TrapId::GigaBomb,
        name: "Giga Bomb",
        max_level: 4,
        max_count: 1,
        footprint: 2,
        trigger_radius: 3.5,
        target_domain: TargetDomain::GroundAndAir,
        default_mode: TrapMode::Default,
        effect: TrapEffect::GigaBlast {
            damage: 1400.0,
            splash_radius: 4.5,
            knockback_tiles: 2.5,
            min_housing_trigger: 18,
        },
    },
];

pub fn get_trap_spec(id: TrapId) -> &'static TrapSpec {
    TRAPS.iter().find(|t| t.id == id).expect("All TrapIds exist")
}
