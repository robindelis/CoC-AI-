#![allow(unused_imports, dead_code)]

use crate::buildings::{BuildingCategory, BuildingId, DefenseMode, BUILDINGS, get_building_spec};
use crate::heroes::{EquipmentId, HeroId, PetId};
use crate::spells::SpellId;
use crate::traps::{TrapId, TrapMode, TRAPS};
use crate::troops::TroopId;
use serde::{Deserialize, Serialize};

pub const MAP_SIZE: u8 = 50;
pub const BUILD_MIN: u8 = 3;
pub const BUILD_MAX: u8 = 47; // [3..47) = 44x44 buildable tiles

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlacedBuilding {
    pub instance_id: u16,
    pub building_id: BuildingId,
    pub tile_x: u8,
    pub tile_y: u8,
    pub mode: DefenseMode,
    pub direction_deg: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlacedTrap {
    pub instance_id: u16,
    pub trap_id: TrapId,
    pub tile_x: u8,
    pub tile_y: u8,
    pub mode: TrapMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlacedHeroBanner {
    pub hero_id: HeroId,
    pub tile_x: u8,
    pub tile_y: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VillageLayout {
    pub name: String,
    pub buildings: Vec<PlacedBuilding>,
    pub walls: Vec<(u8, u8)>,
    pub traps: Vec<PlacedTrap>,
    pub defending_heroes: Vec<PlacedHeroBanner>,
    pub defending_cc_troops: Vec<(TroopId, u8)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArmyLoadout {
    pub name: String,
    pub troops: Vec<(TroopId, u16)>,
    pub spells: Vec<(SpellId, u8)>,
    pub heroes: Vec<(HeroId, PetId)>,
    #[serde(default)]
    pub hero_equipment: Vec<(HeroId, [EquipmentId; 2])>,
    pub siege_machine: Option<TroopId>,
    pub cc_troops: Vec<(TroopId, u8)>,
    pub cc_spells: Vec<(SpellId, u8)>,
}

/// Deterministic occupancy-aware village builder used to construct the preset
/// Town Hall 18 bases without ever overlapping two structures.
struct LayoutBuilder {
    occ: [[bool; 50]; 50],
    buildings: Vec<PlacedBuilding>,
    walls: Vec<(u8, u8)>,
    traps: Vec<PlacedTrap>,
    next_b_id: u16,
    next_t_id: u16,
}

impl LayoutBuilder {
    fn new() -> Self {
        Self {
            occ: [[false; 50]; 50],
            buildings: Vec::with_capacity(96),
            walls: Vec::with_capacity(325),
            traps: Vec::with_capacity(48),
            next_b_id: 1,
            next_t_id: 1,
        }
    }

    fn can_place(&self, x: u8, y: u8, size: u8) -> bool {
        if x < BUILD_MIN || y < BUILD_MIN || x + size > BUILD_MAX || y + size > BUILD_MAX {
            return false;
        }
        for dy in 0..size {
            for dx in 0..size {
                if self.occ[(y + dy) as usize][(x + dx) as usize] {
                    return false;
                }
            }
        }
        true
    }

    fn mark(&mut self, x: u8, y: u8, size: u8) {
        for dy in 0..size {
            for dx in 0..size {
                self.occ[(y + dy) as usize][(x + dx) as usize] = true;
            }
        }
    }

    fn try_place_building(
        &mut self,
        building_id: BuildingId,
        x: u8,
        y: u8,
        mode: DefenseMode,
        direction_deg: f32,
    ) -> bool {
        let spec = get_building_spec(building_id);
        if !self.can_place(x, y, spec.footprint) {
            return false;
        }
        self.mark(x, y, spec.footprint);
        self.buildings.push(PlacedBuilding {
            instance_id: self.next_b_id,
            building_id,
            tile_x: x,
            tile_y: y,
            mode,
            direction_deg,
        });
        self.next_b_id += 1;
        true
    }

    /// Places a building at the free anchor closest to `(target_x, target_y)`.
    fn place_near(
        &mut self,
        building_id: BuildingId,
        target_x: f32,
        target_y: f32,
        mode: DefenseMode,
    ) -> bool {
        let spec = get_building_spec(building_id);
        let size = spec.footprint;
        let mut best: Option<(u8, u8, i32)> = None;
        for y in BUILD_MIN..=(BUILD_MAX - size) {
            for x in BUILD_MIN..=(BUILD_MAX - size) {
                if !self.can_place(x, y, size) {
                    continue;
                }
                let dx = x as f32 + size as f32 * 0.5 - target_x;
                let dy = y as f32 + size as f32 * 0.5 - target_y;
                let d2 = (dx * dx + dy * dy) as i32;
                if best.map_or(true, |(_, _, b_d2)| d2 < b_d2) {
                    best = Some((x, y, d2));
                }
            }
        }
        if let Some((bx, by, _)) = best {
            let cx = bx as f32 + size as f32 * 0.5;
            let cy = by as f32 + size as f32 * 0.5;
            let raw_deg = (cy - 25.0).atan2(cx - 25.0).to_degrees().rem_euclid(360.0);
            let dir_deg = match building_id {
                BuildingId::AirSweeper => ((raw_deg / 45.0).round() * 45.0).rem_euclid(360.0),
                BuildingId::Firespitter => ((raw_deg / 90.0).round() * 90.0).rem_euclid(360.0),
                _ => 0.0,
            };
            self.try_place_building(building_id, bx, by, mode, dir_deg)
        } else {
            false
        }
    }

    /// Radial golden-angle spread so every structure gets its own compartment.
    fn spread_anchor(index: usize, count: usize, r_min: f32, r_max: f32) -> (f32, f32) {
        const GOLDEN: f32 = 2.399_963_1;
        let t = if count <= 1 {
            0.0
        } else {
            index as f32 / (count - 1) as f32
        };
        let radius = r_min + (r_max - r_min) * t;
        let angle = index as f32 * GOLDEN;
        (24.0 + radius * angle.cos(), 24.0 + radius * angle.sin())
    }

    fn add_wall_rect(&mut self, x0: u8, y0: u8, x1: u8, y1: u8, leave_gates: bool) {
        let mid_x = (x0 + x1) / 2;
        let mid_y = (y0 + y1) / 2;
        let gate_w = ((x1 - x0) / 10).max(1);
        for x in x0..=x1 {
            for &y in &[y0, y1] {
                if leave_gates && (x as i32 - mid_x as i32).unsigned_abs() < gate_w as u32 {
                    continue;
                }
                self.try_add_wall(x, y);
            }
        }
        for y in (y0 + 1)..y1 {
            for &x in &[x0, x1] {
                if leave_gates && (y as i32 - mid_y as i32).unsigned_abs() < gate_w as u32 {
                    continue;
                }
                self.try_add_wall(x, y);
            }
        }
    }

    fn try_add_wall(&mut self, x: u8, y: u8) {
        if self.walls.len() >= 325 {
            return;
        }
        if self.can_place(x, y, 1) {
            self.mark(x, y, 1);
            self.walls.push((x, y));
        }
    }
}

/// Ordered Town Hall 18 defense manifest parameterized by meta archetype (0..5).
/// 52 defensive structures, matching the live game.
fn th18_defenses_for_archetype(archetype: usize) -> Vec<(BuildingId, DefenseMode)> {
    use BuildingId::*;
    use DefenseMode::*;
    let mut v: Vec<(BuildingId, DefenseMode)> = Vec::new();
    let mut push = |id: BuildingId, mode: DefenseMode, n: usize| {
        for _ in 0..n {
            v.push((id, mode));
        }
    };
    // Cross-map signature artillery
    push(Monolith, Default, 1);
    push(RevengeTower, Default, 1);
    let mg_mode = if archetype == 4 {
        MultiGearFastAttack
    } else {
        MultiGearLongRange
    };
    push(MultiGearTower, mg_mode, 1);
    push(CraftingStation, Default, 1);

    // Inferno & X-Bow & Spell Tower modes customized per meta archetype
    match archetype {
        // 1: Offset Diamond (2 Single + 1 Multi Inferno, Poison + Rage Towers)
        1 => {
            push(InfernoTower, InfernoSingle, 2);
            push(InfernoTower, InfernoMulti, 1);
        }
        // 2: Anti-Hydra Air Ring (2 Single + 1 Multi Inferno, all 4 Air X-Bows)
        2 => {
            push(InfernoTower, InfernoSingle, 2);
            push(InfernoTower, InfernoMulti, 1);
        }
        // 3: Anti-Fireball Wide Spread (3 Single Infernos to melt Meteor Golem / Duke / Heroes)
        3 => {
            push(InfernoTower, InfernoSingle, 3);
        }
        // 0 (Central Box) & 4 (Teaser Killzone): 3 Multi-Target Infernos
        _ => {
            push(InfernoTower, InfernoMulti, 3);
        }
    }

    push(Scattershot, Default, 2);
    push(Firespitter, Default, 2);
    push(SuperWizardTower, Default, 2);

    if archetype == 2 {
        push(XBow, XBowAirAndGround, 4);
    } else if archetype == 3 {
        push(XBow, XBowGround, 2);
        push(XBow, XBowAirAndGround, 2);
    } else {
        push(XBow, XBowAirAndGround, 3);
        push(XBow, XBowGround, 1);
    }

    push(MultiArcherTower, Default, 3);
    push(RicochetCannon, Default, 3);
    // Air coverage
    push(AirDefense, Default, 4);
    push(AirSweeper, Default, 2);

    // Spell Towers
    match archetype {
        2 => {
            push(SpellTower, SpellTowerPoison, 1);
            push(SpellTower, SpellTowerInvisibility, 1);
        }
        3 => {
            push(SpellTower, SpellTowerEarthquake, 1);
            push(SpellTower, SpellTowerInvisibility, 1);
        }
        4 => {
            push(SpellTower, SpellTowerRage, 2);
        }
        _ => {
            push(SpellTower, SpellTowerRage, 1);
            push(SpellTower, SpellTowerPoison, 1);
        }
    }

    push(BombTower, Default, 2);
    push(WizardTower, Default, 2);
    push(Mortar, Default, 4);
    push(Cannon, Default, 1);
    push(ArcherTower, Default, 3);
    push(HiddenTesla, Default, 5);
    push(BuildersHut, Default, 5);
    v
}

/// Resource buildings (26) placed in a ring around the defensive core.
fn th18_storages() -> Vec<BuildingId> {
    use BuildingId::*;
    vec![
        GoldStorage,
        GoldStorage,
        GoldStorage,
        GoldStorage,
        ElixirStorage,
        ElixirStorage,
        ElixirStorage,
        ElixirStorage,
        DarkElixirStorage,
        ClanCastle,
    ]
}

fn th18_collectors() -> Vec<BuildingId> {
    use BuildingId::*;
    vec![
        GoldMine,
        GoldMine,
        GoldMine,
        GoldMine,
        GoldMine,
        GoldMine,
        GoldMine,
        ElixirCollector,
        ElixirCollector,
        ElixirCollector,
        ElixirCollector,
        ElixirCollector,
        ElixirCollector,
        ElixirCollector,
        DarkElixirDrill,
        DarkElixirDrill,
        DarkElixirDrill,
    ]
}

/// Army / utility buildings (16).
fn th18_army_buildings() -> Vec<BuildingId> {
    use BuildingId::*;
    vec![
        ArmyCamp,
        ArmyCamp,
        ArmyCamp,
        ArmyCamp,
        Barracks,
        DarkBarracks,
        Laboratory,
        SpellFactory,
        DarkSpellFactory,
        HeroHall,
        Blacksmith,
        Workshop,
        PetHouse,
        HelperHut,
        BobsHut,
    ]
}

/// Builds one of the 5 current-meta Town Hall 18 village layouts (overlap-free, 95 buildings,
/// up to 325 walls, 48 traps):
///   0: "TH18 Central Box Legends (Cake-A-Pult + Smasher)"
///   1: "TH18 Offset Diamond (Hot Candle + Longshot)"
///   2: "TH18 Anti-Hydra Air Ring (4 Air X-Bows + Sweepers)"
///   3: "TH18 Anti-Fireball Wide Spread (3 Single Infernos)"
///   4: "TH18 Teaser War Base (Double Rage Towers + Killzone)"
pub fn build_th18_meta_village(archetype: usize) -> VillageLayout {
    let mut b = LayoutBuilder::new();

    let (th_x, th_y, th_mode, core_cx, core_cy) = match archetype {
        1 => (16u8, 23u8, DefenseMode::GuardianLongshot, 30.0f32, 24.0f32),
        2 => (23u8, 23u8, DefenseMode::GuardianLongshot, 24.0f32, 24.0f32),
        3 => (23u8, 17u8, DefenseMode::GuardianLogger, 24.0f32, 26.0f32),
        4 => (17u8, 28u8, DefenseMode::GuardianLogger, 29.0f32, 19.0f32),
        _ => (23u8, 23u8, DefenseMode::GuardianSmasher, 24.0f32, 24.0f32),
    };

    b.try_place_building(BuildingId::TownHall, th_x, th_y, th_mode, 0.0);

    // Compartment wall geometry per meta archetype
    match archetype {
        1 => {
            // Offset Diamond: West TH compartment + East kill-core box + outer frame
            b.add_wall_rect(13, 19, 22, 29, true);
            b.add_wall_rect(25, 17, 37, 31, true);
            b.add_wall_rect(9, 10, 41, 39, true);
            for i in 5u8..12 {
                b.try_add_wall(24, i);
                b.try_add_wall(24, 49 - i);
            }
        }
        2 => {
            // Anti-Hydra Air Ring: Isolated inner island + wide moat ring + outer compartments
            b.add_wall_rect(20, 20, 29, 29, false);
            b.add_wall_rect(12, 12, 37, 37, true);
            b.add_wall_rect(7, 7, 42, 42, true);
            for i in 7u8..12 {
                b.try_add_wall(i, 20);
                b.try_add_wall(49 - i, 29);
                b.try_add_wall(20, i);
                b.try_add_wall(29, 49 - i);
            }
        }
        3 => {
            // Anti-Fireball Wide Spread: 4 separated quadrant boxes to prevent Fireball/SpikyBall chains
            b.add_wall_rect(9, 9, 21, 21, true);
            b.add_wall_rect(28, 9, 40, 21, true);
            b.add_wall_rect(9, 28, 21, 40, true);
            b.add_wall_rect(28, 28, 40, 40, true);
            b.add_wall_rect(18, 15, 31, 34, true);
        }
        4 => {
            // Teaser War Base: Open South-West bait side + fortified North-East killzone compartments
            b.add_wall_rect(23, 12, 37, 26, true);
            b.add_wall_rect(18, 9, 41, 32, true);
            b.add_wall_rect(12, 24, 24, 36, true);
            b.add_wall_rect(8, 8, 42, 41, true);
        }
        _ => {
            // Central Box Legends: Classic 3-ring divided war box
            b.add_wall_rect(19, 19, 30, 30, true);
            b.add_wall_rect(14, 14, 35, 35, true);
            b.add_wall_rect(9, 9, 40, 40, true);
            for i in 5u8..9 {
                b.try_add_wall(i, 24);
                b.try_add_wall(49 - i, 24);
                b.try_add_wall(24, i);
                b.try_add_wall(24, 49 - i);
            }
        }
    }

    let defences = th18_defenses_for_archetype(archetype);
    let n = defences.len();
    for (i, &(id, mode)) in defences.iter().enumerate() {
        let (r_min, r_max) = match archetype {
            // Anti-Hydra Ring pushes mid defenses out into a wider ring to split air pathing
            2 => {
                if i < n / 4 {
                    (3.5, 6.0)
                } else if i < (3 * n) / 4 {
                    (9.0, 14.0)
                } else {
                    (14.0, 17.5)
                }
            }
            // Anti-Fireball Wide Spread increases spacing between defenses
            3 => {
                if i < n / 3 {
                    (5.0, 9.5)
                } else if i < (2 * n) / 3 {
                    (9.5, 14.0)
                } else {
                    (14.0, 18.0)
                }
            }
            _ => {
                if i < n / 3 {
                    (3.4, 7.0)
                } else if i < (2 * n) / 3 {
                    (7.0, 11.0)
                } else {
                    (11.0, 14.5)
                }
            }
        };
        let (base_x, base_y) = LayoutBuilder::spread_anchor(i + archetype * 5, n, r_min, r_max);
        let tx = (base_x + (core_cx - 24.0) * 0.55).clamp(6.0, 43.0);
        let ty = (base_y + (core_cy - 24.0) * 0.55).clamp(6.0, 43.0);
        if !b.place_near(id, tx, ty, mode) {
            b.place_near(id, 24.0, 24.0, mode);
        }
    }

    // Storages ring
    let storages = th18_storages();
    for (i, &id) in storages.iter().enumerate() {
        let (tx, ty) =
            LayoutBuilder::spread_anchor(i + 7 + archetype * 3, storages.len(), 6.0, 11.5);
        b.place_near(id, tx, ty, DefenseMode::Default);
    }

    // Collectors + drills outer ring
    let collectors = th18_collectors();
    for (i, &id) in collectors.iter().enumerate() {
        let (tx, ty) =
            LayoutBuilder::spread_anchor(i + archetype * 2, collectors.len(), 13.0, 19.5);
        b.place_near(id, tx, ty, DefenseMode::Default);
    }

    // Army / utility buildings on the outer edge
    let army = th18_army_buildings();
    for (i, &id) in army.iter().enumerate() {
        let (tx, ty) = LayoutBuilder::spread_anchor(i + 3 + archetype, army.len(), 15.0, 20.5);
        b.place_near(id, tx, ty, DefenseMode::Default);
    }

    // Traps fill the free tiles closest to the archetype's kill-core
    let mut trap_queue: Vec<(TrapId, TrapMode)> = Vec::new();
    for spec in TRAPS {
        for _ in 0..spec.max_count {
            trap_queue.push((spec.id, spec.default_mode));
        }
    }
    for (trap_id, mode) in trap_queue {
        let spec = crate::traps::get_trap_spec(trap_id);
        let size = spec.footprint;
        let mut best: Option<(u8, u8, i32)> = None;
        for y in BUILD_MIN..=(BUILD_MAX - size) {
            for x in BUILD_MIN..=(BUILD_MAX - size) {
                if !b.can_place(x, y, size) {
                    continue;
                }
                let dx = x as f32 + size as f32 * 0.5 - core_cx;
                let dy = y as f32 + size as f32 * 0.5 - core_cy;
                let d2 = (dx * dx + dy * dy) as i32;
                if best.map_or(true, |(_, _, bd)| d2 < bd) {
                    best = Some((x, y, d2));
                }
            }
        }
        if let Some((tx, ty, _)) = best {
            b.mark(tx, ty, size);
            b.traps.push(PlacedTrap {
                instance_id: b.next_t_id,
                trap_id,
                tile_x: tx,
                tile_y: ty,
                mode,
            });
            b.next_t_id += 1;
        }
    }

    // Top up remaining walls up to 325 around the perimeter compartments if spare walls exist
    for r in [16u8, 22u8, 27u8, 33u8] {
        if b.walls.len() >= 325 {
            break;
        }
        b.add_wall_rect(r.min(20), r.min(20), (49 - r).max(29), (49 - r).max(29), true);
    }

    // Ensure the 2 Air Sweepers and 2 Firespitters cover opposite hemispheres
    let sweeper_dirs = if archetype % 2 == 0 {
        [180.0f32, 0.0f32]
    } else {
        [90.0f32, 270.0f32]
    };
    let mut sweeper_idx = 0usize;
    let spitter_dirs = if archetype == 4 {
        [225.0f32, 180.0f32]
    } else {
        [180.0f32, 0.0f32]
    };
    let mut spitter_idx = 0usize;
    for pb in &mut b.buildings {
        if pb.building_id == BuildingId::AirSweeper {
            pb.direction_deg = sweeper_dirs[sweeper_idx % sweeper_dirs.len()];
            sweeper_idx += 1;
        } else if pb.building_id == BuildingId::Firespitter {
            pb.direction_deg = spitter_dirs[spitter_idx % spitter_dirs.len()];
            spitter_idx += 1;
        }
    }

    let name = match archetype {
        1 => "TH18 Offset Diamond (Hot Candle + Longshot)",
        2 => "TH18 Anti-Hydra Air Ring (4 Air X-Bows + Sweepers)",
        3 => "TH18 Anti-Fireball Wide Spread (3 Single Infernos)",
        4 => "TH18 Teaser War Base (Double Rage Towers + Killzone)",
        _ => "TH18 Central Box Legends (Cake-A-Pult + Smasher)",
    };

    let defending_cc_troops = match archetype {
        2 => vec![
            (TroopId::LavaHound, 1),
            (TroopId::IceGolem, 1),
            (TroopId::Archer, 5),
        ],
        4 => vec![
            (TroopId::Furnace, 1),
            (TroopId::Witch, 1),
            (TroopId::Headhunter, 3),
            (TroopId::Archer, 2),
        ],
        _ => vec![
            (TroopId::IceGolem, 2),
            (TroopId::Headhunter, 3),
            (TroopId::Archer, 7),
        ],
    };

    VillageLayout {
        name: name.to_string(),
        buildings: b.buildings,
        walls: b.walls,
        traps: b.traps,
        defending_heroes: vec![
            PlacedHeroBanner { hero_id: HeroId::BarbarianKing, tile_x: 20, tile_y: 27 },
            PlacedHeroBanner { hero_id: HeroId::ArcherQueen, tile_x: 28, tile_y: 20 },
            PlacedHeroBanner { hero_id: HeroId::GrandWarden, tile_x: 27, tile_y: 28 },
            PlacedHeroBanner { hero_id: HeroId::DragonDuke, tile_x: 20, tile_y: 20 },
        ],
        defending_cc_troops,
    }
}

pub fn build_full_th18_village() -> VillageLayout {
    build_th18_meta_village(0)
}

pub fn build_th18_war_village() -> VillageLayout {
    build_th18_meta_village(1)
}

pub fn get_preset_layouts() -> Vec<VillageLayout> {
    (0..5).map(build_th18_meta_village).collect()
}

pub fn get_preset_armies() -> Vec<ArmyLoadout> {
    vec![
        // Army 0: Thrower + Healer + Totem Smash (352 housing)
        ArmyLoadout {
            name: "TH18 Thrower + Healer + Totem Smash (Meta)".to_string(),
            troops: vec![
                (TroopId::Thrower, 12),
                (TroopId::Healer, 5),
                (TroopId::Furnace, 2),
                (TroopId::Druid, 1),
                (TroopId::IceGolem, 1),
                (TroopId::SuperWallBreaker, 1),
                (TroopId::Headhunter, 1),
                (TroopId::Balloon, 1),
                (TroopId::Archer, 4),
            ],
            spells: vec![
                (SpellId::Totem, 7),
                (SpellId::Rage, 1),
                (SpellId::Poison, 1),
                (SpellId::SkeletonSpell, 1),
            ],
            heroes: vec![
                (HeroId::BarbarianKing, PetId::Frosty),
                (HeroId::ArcherQueen, PetId::Unicorn),
                (HeroId::GrandWarden, PetId::AngryJelly),
                (HeroId::RoyalChampion, PetId::Phoenix),
            ],
            hero_equipment: vec![
                (
                    HeroId::BarbarianKing,
                    [EquipmentId::SpikyBall, EquipmentId::SnakeBracelet],
                ),
                (
                    HeroId::ArcherQueen,
                    [EquipmentId::MagicMirror, EquipmentId::ActionFigure],
                ),
                (
                    HeroId::GrandWarden,
                    [EquipmentId::EternalTome, EquipmentId::RageGem],
                ),
                (
                    HeroId::RoyalChampion,
                    [EquipmentId::RocketSpear, EquipmentId::ElectroBoots],
                ),
            ],
            siege_machine: Some(TroopId::LogLauncher),
            cc_troops: vec![(TroopId::SuperYeti, 1), (TroopId::SuperValkyrie, 1)],
            cc_spells: vec![(SpellId::Rage, 1), (SpellId::Freeze, 1)],
        },
        // Army 1: Dragon Duke Charge Hydra (Dragons + Dragon Riders + Totem Spells, 352 housing)
        ArmyLoadout {
            name: "TH18 Dragon Duke Charge Hydra (Meta)".to_string(),
            troops: vec![
                (TroopId::Dragon, 7),
                (TroopId::DragonRider, 6),
                (TroopId::RocketBalloon, 5),
                (TroopId::IceGolem, 1),
                (TroopId::Headhunter, 1),
                (TroopId::Archer, 1),
            ],
            spells: vec![
                (SpellId::Totem, 6),
                (SpellId::Rage, 2),
                (SpellId::Freeze, 1),
                (SpellId::Poison, 1),
            ],
            heroes: vec![
                (HeroId::DragonDuke, PetId::Phoenix),
                (HeroId::MinionPrince, PetId::AngryJelly),
                (HeroId::GrandWarden, PetId::ElectroOwl),
                (HeroId::RoyalChampion, PetId::SpiritFox),
            ],
            hero_equipment: vec![
                (
                    HeroId::DragonDuke,
                    [EquipmentId::RevengeDeck, EquipmentId::FlameBlower],
                ),
                (
                    HeroId::MinionPrince,
                    [EquipmentId::PortalPendant, EquipmentId::DarkOrb],
                ),
                (
                    HeroId::GrandWarden,
                    [EquipmentId::EternalTome, EquipmentId::RageGem],
                ),
                (
                    HeroId::RoyalChampion,
                    [EquipmentId::RocketSpear, EquipmentId::ElectroBoots],
                ),
            ],
            siege_machine: Some(TroopId::BattleBlimp),
            cc_troops: vec![(TroopId::DragonRider, 2), (TroopId::Balloon, 1)],
            cc_spells: vec![(SpellId::Rage, 1), (SpellId::Freeze, 1)],
        },
        // Army 2: Warden Fireball + Super Bowler & Meteor Golem Smash (352 housing)
        ArmyLoadout {
            name: "TH18 Fireball Super Bowler & Meteor Golem Smash (Meta)".to_string(),
            troops: vec![
                (TroopId::SuperBowler, 5),
                (TroopId::MeteorGolem, 1),
                (TroopId::Healer, 5),
                (TroopId::RootRider, 1),
                (TroopId::Furnace, 1),
                (TroopId::Druid, 1),
                (TroopId::SuperWallBreaker, 2),
                (TroopId::IceGolem, 1),
                (TroopId::Headhunter, 1),
                (TroopId::Archer, 1),
            ],
            spells: vec![
                (SpellId::Totem, 4),
                (SpellId::Rage, 2),
                (SpellId::Overgrowth, 1),
                (SpellId::Earthquake, 1),
                (SpellId::Invisibility, 1),
            ],
            heroes: vec![
                (HeroId::GrandWarden, PetId::AngryJelly),
                (HeroId::DragonDuke, PetId::Phoenix),
                (HeroId::BarbarianKing, PetId::Frosty),
                (HeroId::ArcherQueen, PetId::Unicorn),
            ],
            hero_equipment: vec![
                (
                    HeroId::GrandWarden,
                    [EquipmentId::Fireball, EquipmentId::EternalTome],
                ),
                (
                    HeroId::DragonDuke,
                    [EquipmentId::RocketBackpack, EquipmentId::FireHeart],
                ),
                (
                    HeroId::BarbarianKing,
                    [EquipmentId::GiantGauntlet, EquipmentId::SpikyBall],
                ),
                (
                    HeroId::ArcherQueen,
                    [EquipmentId::MagicMirror, EquipmentId::FrozenArrow],
                ),
            ],
            siege_machine: Some(TroopId::FlameFlinger),
            cc_troops: vec![(TroopId::SuperYeti, 1), (TroopId::IceGolem, 1)],
            cc_spells: vec![(SpellId::Rage, 1), (SpellId::Poison, 1)],
        },
    ]
}
