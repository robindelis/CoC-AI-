use crate::grid::{compute_no_deploy_mask, find_path_to_building};
use coc_data::*;
use serde::{Deserialize, Serialize};

pub const DT: f32 = 0.1;
pub const MAX_TICKS: u32 = 1800; // 180.0s (3 minutes)

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Team {
    Attacker,
    Defender,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TargetRef {
    None,
    Building(usize),
    Wall(usize),
    Unit(u32),
}

#[derive(Debug, Clone, Serialize)]
pub struct SimBuilding {
    pub index: usize,
    pub instance_id: u16,
    pub building_id: BuildingId,
    pub name: &'static str,
    pub category: BuildingCategory,
    pub tile_x: u8,
    pub tile_y: u8,
    pub footprint: u8,
    pub center_x: f32,
    pub center_y: f32,
    pub hp: f32,
    pub max_hp: f32,
    pub mode: DefenseMode,
    pub direction_deg: f32,
    pub attack_cooldown: f32,
    pub current_target: Option<u32>,
    pub inferno_ramp_sec: f32,
    pub is_hidden_tesla_revealed: bool,
    pub spell_cooldown: f32,
    pub spell_trigger_timer: f32,
    pub candle_melt_timer: f32,
    pub candle_stage: u8,
    pub freeze_timer: f32,
    pub stun_timer: f32,
    pub overgrowth_timer: f32,
    pub invisibility_timer: f32,
    pub rage_timer: f32,
    pub slow_timer: f32,
    pub eq_hits: u8,
    pub counts_for_destruction: bool,
    pub destroyed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimWall {
    pub index: usize,
    pub tile_x: u8,
    pub tile_y: u8,
    pub hp: f32,
    pub max_hp: f32,
    pub eq_hits: u8,
    pub destroyed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimTrap {
    pub instance_id: u16,
    pub trap_id: TrapId,
    pub tile_x: u8,
    pub tile_y: u8,
    pub center_x: f32,
    pub center_y: f32,
    pub mode: TrapMode,
    pub triggered: bool,
}

/// Closest point on a building's footprint rectangle to `(px, py)`.
/// Clash of Clans measures range from the building's edge, not its centre.
fn building_edge_point(b: &SimBuilding, px: f32, py: f32) -> (f32, f32) {
    let x0 = b.tile_x as f32;
    let y0 = b.tile_y as f32;
    let size = b.footprint as f32;
    (px.clamp(x0, x0 + size), py.clamp(y0, y0 + size))
}

fn building_edge_dist(b: &SimBuilding, px: f32, py: f32) -> f32 {
    let (ex, ey) = building_edge_point(b, px, py);
    dist(px, py, ex, ey)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UnitKind {
    Troop(TroopId),
    Hero(HeroId),
    Pet(PetId),
    Totem,
}

#[derive(Debug, Clone, Serialize)]
pub struct SimUnit {
    pub id: u32,
    pub kind: UnitKind,
    pub name: &'static str,
    pub team: Team,
    pub x: f32,
    pub y: f32,
    pub hp: f32,
    pub max_hp: f32,
    pub base_dps: f32,
    pub damage_per_hit: f32,
    pub attack_speed_sec: f32,
    pub move_speed: f32,
    pub range: f32,
    pub splash_radius: f32,
    pub housing_space: u16,
    pub is_air: bool,
    pub movement: MovementMode,
    pub target_domain: TargetDomain,
    pub preferred_target: PreferredTarget,
    pub target: TargetRef,
    pub waypoints: Vec<(f32, f32)>,
    pub repath_timer: f32,
    pub attack_cooldown: f32,
    pub is_burrowed: bool,
    // Buffs / Debuffs / Timers
    pub freeze_timer: f32,
    pub stun_timer: f32,
    pub invisibility_timer: f32,
    pub invincibility_timer: f32,
    pub rage_timer: f32,
    /// Rage damage multiplier sourced from hero-equipment abilities
    /// (0 = no ability rage in play -> default spell multiplier x2.90).
    pub rage_boost_mult: f32,
    /// Rage movement bonus in tiles/s from hero-equipment abilities (0 = spell default +4.0).
    pub rage_speed_bonus: f32,
    pub haste_timer: f32,
    /// Attack-speed multiplier (>1 = faster attacks; Haste Vial = 2.0).
    pub attack_speed_mult: f32,
    /// Flat damage bonus applied per hit while invisible (Invisibility Vial L18: +1740).
    pub bonus_flat_damage: f32,
    /// While > 0, incoming damage is reduced by `damage_shield_protection`.
    pub damage_shield_timer: f32,
    pub damage_shield_protection: f32,
    pub poison_timer: f32,
    pub slow_timer: f32,
    pub ability_used: bool,
    pub ability_active_timer: f32,
    pub equipped_items: Option<[EquipmentId; 2]>,
    pub paired_hero_id: Option<u32>,
    pub phoenix_revive_available: bool,
    pub special_timer: f32,
    pub spawned_children_count: u8,
    pub yeti_hp_milestone: f32,
    pub lifetime_remaining: Option<f32>,
    pub anchor_pos: Option<(f32, f32)>,
    pub inferno_ramp_sec: f32,
    pub limited_special_attacks: u8,
    pub life_aura_timer: f32,
    pub alive: bool,
}

impl SimUnit {
    #[inline]
    pub fn is_siege_machine(&self) -> bool {
        match self.kind {
            UnitKind::Troop(tid) => matches!(get_troop_spec(tid).category, TroopCategory::SiegeMachine),
            _ => false,
        }
    }

    #[inline]
    pub fn is_immune_to_healing(&self) -> bool {
        self.is_siege_machine() || matches!(self.kind, UnitKind::Totem)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveSpellZone {
    pub spell_id: SpellId,
    pub team: Team,
    pub x: f32,
    pub y: f32,
    pub radius: f32,
    pub remaining_sec: f32,
    pub clone_budget_remaining: u16,
    #[serde(default, skip_serializing)]
    pub processed_unit_ids: Vec<u32>,
    #[serde(default, skip_serializing)]
    pub spawn_remaining: u8,
    #[serde(default, skip_serializing)]
    pub spawn_timer: f32,
    #[serde(default, skip_serializing)]
    pub fire_dps: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProjectileKind {
    Arrow,
    Cannonball,
    MortarShell,
    ScatterBundle,
    WizardFireball,
    Rocket,
    CandleFlame,
    Spear,
    Boulder,
    FlameSpirit,
    Log,
    SpellVial,
    EnergyBolt,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProjectilePayload {
    Standard,
    Ricochet {
        bounce_range: f32,
        bounce_mult: f32,
        bounces_left: u8,
        hit_unit_ids: Vec<u32>,
    },
    PenetratingShot {
        pierce_count: usize,
        pierce_radius: f32,
        pushback_tiles: f32,
    },
    ConeSplash {
        cone_range: f32,
        cone_damage: f32,
        dir_x: f32,
        dir_y: f32,
    },
    BowlerBounce {
        bounce_dist: f32,
        dir_x: f32,
        dir_y: f32,
    },
    HeadhunterPoison,
    FrozenArrow,
    ElectroFangs,
    WallBreakerMult {
        wall_mult: f32,
    },
    FireSpiritBurn {
        burn_dps: f32,
        duration_sec: f32,
        radius: f32,
    },
    RollingLog {
        wall_mult: f32,
        pierce_radius: f32,
        hit_building_indices: Vec<usize>,
        hit_wall_indices: Vec<usize>,
        hit_unit_ids: Vec<u32>,
    },
    CastDefenderSpell {
        spell_id: SpellId,
        radius: f32,
        duration_sec: f32,
    },
}

#[derive(Debug, Clone, Serialize)]
pub struct SimProjectile {
    pub id: u32,
    pub kind: ProjectileKind,
    pub team: Team,
    pub from_x: f32,
    pub from_y: f32,
    pub x: f32,
    pub y: f32,
    pub target_x: f32,
    pub target_y: f32,
    pub target: TargetRef,
    pub homing: bool,
    pub speed: f32,
    pub progress: f32,
    pub total_dist: f32,
    pub arc_height: f32,
    pub damage: f32,
    pub splash_radius: f32,
    pub target_domain: TargetDomain,
    pub color: &'static str,
    pub payload: ProjectilePayload,
}

#[derive(Debug, Clone, Serialize)]
pub enum VisualEvent {
    Projectile {
        from_x: f32,
        from_y: f32,
        to_x: f32,
        to_y: f32,
        color: &'static str,
        splash_radius: f32,
    },
    Beam {
        from_x: f32,
        from_y: f32,
        to_x: f32,
        to_y: f32,
        color: &'static str,
        width: f32,
    },
    Explosion {
        x: f32,
        y: f32,
        radius: f32,
        color: &'static str,
    },
    HealPulse {
        x: f32,
        y: f32,
        radius: f32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BattleAction {
    NoOp,
    DeployTroop { troop_id: TroopId, x: f32, y: f32 },
    DeployTroopBatch {
        troop_id: TroopId,
        x: f32,
        y: f32,
        count: u16,
    },
    DeployHero { hero_id: HeroId, x: f32, y: f32 },
    ActivateHeroAbility { hero_id: HeroId },
    DeploySiege { x: f32, y: f32 },
    PopSiegeMachine,
    CastSpell { spell_id: SpellId, x: f32, y: f32 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepRewardInfo {
    pub reward: f32,
    pub delta_destruction_pct: u8,
    pub delta_stars: u8,
    pub invalid_action: bool,
    pub is_finished: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BattleEngine {
    pub tick: u32,
    pub time_elapsed_sec: f32,
    pub buildings: Vec<SimBuilding>,
    pub walls: Vec<SimWall>,
    pub traps: Vec<SimTrap>,
    pub units: Vec<SimUnit>,
    pub projectiles: Vec<SimProjectile>,
    pub spells: Vec<ActiveSpellZone>,
    pub visual_events: Vec<VisualEvent>,
    pub no_deploy_mask: Vec<Vec<bool>>,
    // Remaining Attacker Inventory
    pub remaining_troops: Vec<(TroopId, u16)>,
    pub remaining_spells: Vec<(SpellId, u8)>,
    pub remaining_heroes: Vec<(HeroId, PetId)>,
    pub hero_equipment: Vec<(HeroId, [EquipmentId; 2])>,
    pub deployed_heroes: Vec<(HeroId, u32)>,
    pub remaining_siege: Option<TroopId>,
    pub active_siege_unit_id: Option<u32>,
    pub attacker_cc_troops: Vec<(TroopId, u8)>,
    pub attacker_cc_popped: bool,
    pub defender_cc_troops: Vec<(TroopId, u8)>,
    pub defender_cc_triggered: bool,
    pub cc_spawn_cooldown: f32,
    pub cc_spawned_count: u8,
    pub guardian_spawned: bool,
    // Score State
    pub total_scorable_buildings: u16,
    pub destroyed_scorable_buildings: u16,
    pub destruction_pct: u8,
    pub town_hall_destroyed: bool,
    pub stars: u8,
    pub total_hp_pool: f32,
    pub damage_dealt_total: f32,
    pub is_finished: bool,
    next_unit_id: u32,
    next_projectile_id: u32,
}

impl BattleEngine {
    pub fn new(layout: &VillageLayout, army: &ArmyLoadout) -> Self {
        let no_deploy_mask = compute_no_deploy_mask(&layout.buildings, &layout.walls);
        let mut buildings = Vec::with_capacity(layout.buildings.len());
        let mut total_scorable = 0u16;
        let mut total_hp_pool = 0.0f32;

        for (index, pb) in layout.buildings.iter().enumerate() {
            let spec = get_building_spec(pb.building_id);
            if spec.counts_for_destruction {
                total_scorable += 1;
                total_hp_pool += spec.max_hp;
            }
            let half = spec.footprint as f32 * 0.5;
            buildings.push(SimBuilding {
                index,
                instance_id: pb.instance_id,
                building_id: pb.building_id,
                name: spec.name,
                category: spec.category,
                tile_x: pb.tile_x,
                tile_y: pb.tile_y,
                footprint: spec.footprint,
                center_x: pb.tile_x as f32 + half,
                center_y: pb.tile_y as f32 + half,
                hp: spec.max_hp,
                max_hp: spec.max_hp,
                mode: pb.mode,
                direction_deg: pb.direction_deg,
                attack_cooldown: 0.0,
                current_target: None,
                inferno_ramp_sec: 0.0,
                is_hidden_tesla_revealed: false,
                spell_cooldown: 0.0,
                spell_trigger_timer: 0.0,
                candle_melt_timer: 0.0,
                candle_stage: 1,
                freeze_timer: 0.0,
                stun_timer: 0.0,
                overgrowth_timer: 0.0,
                invisibility_timer: 0.0,
                rage_timer: 0.0,
                slow_timer: 0.0,
                eq_hits: 0,
                counts_for_destruction: spec.counts_for_destruction,
                destroyed: false,
            });
        }

        let wall_spec = get_building_spec(BuildingId::Wall);
        let walls: Vec<SimWall> = layout
            .walls
            .iter()
            .enumerate()
            .map(|(index, &(wx, wy))| SimWall {
                index,
                tile_x: wx,
                tile_y: wy,
                hp: wall_spec.max_hp,
                max_hp: wall_spec.max_hp,
                eq_hits: 0,
                destroyed: false,
            })
            .collect();

        let traps: Vec<SimTrap> = layout
            .traps
            .iter()
            .map(|pt| {
                let spec = get_trap_spec(pt.trap_id);
                let half = spec.footprint as f32 * 0.5;
                SimTrap {
                    instance_id: pt.instance_id,
                    trap_id: pt.trap_id,
                    tile_x: pt.tile_x,
                    tile_y: pt.tile_y,
                    center_x: pt.tile_x as f32 + half,
                    center_y: pt.tile_y as f32 + half,
                    mode: pt.mode,
                    triggered: false,
                }
            })
            .collect();

        // Combine regular spells + CC spells
        let mut remaining_spells = army.spells.clone();
        for &(sid, count) in &army.cc_spells {
            if count == 0 {
                continue;
            }
            if let Some(entry) = remaining_spells.iter_mut().find(|(s, _)| *s == sid) {
                entry.1 += count;
            } else {
                remaining_spells.push((sid, count));
            }
        }

        let mut engine = Self {
            tick: 0,
            time_elapsed_sec: 0.0,
            buildings,
            walls,
            traps,
            units: Vec::with_capacity(128),
            projectiles: Vec::with_capacity(64),
            spells: Vec::new(),
            visual_events: Vec::new(),
            no_deploy_mask,
            remaining_troops: army.troops.clone(),
            remaining_spells,
            remaining_heroes: army.heroes.clone(),
            hero_equipment: army.hero_equipment.clone(),
            deployed_heroes: Vec::new(),
            remaining_siege: army.siege_machine,
            active_siege_unit_id: None,
            attacker_cc_troops: army.cc_troops.clone(),
            attacker_cc_popped: false,
            defender_cc_troops: layout.defending_cc_troops.clone(),
            defender_cc_triggered: false,
            cc_spawn_cooldown: 0.0,
            cc_spawned_count: 0,
            guardian_spawned: false,
            total_scorable_buildings: total_scorable.max(1),
            destroyed_scorable_buildings: 0,
            destruction_pct: 0,
            town_hall_destroyed: bool::default(),
            stars: 0,
            total_hp_pool: total_hp_pool.max(1.0),
            damage_dealt_total: 0.0,
            is_finished: false,
            next_unit_id: 1,
            next_projectile_id: 1,
        };

        // Spawn Defending Heroes at their Hero Banners (using defensive base stats)
        for hb in &layout.defending_heroes {
            let hspec = get_hero_spec(hb.hero_id);
            let ax = hb.tile_x as f32 + 1.0;
            let ay = hb.tile_y as f32 + 1.0;
            let uid = engine.alloc_unit_id();
            engine.units.push(SimUnit {
                id: uid,
                kind: UnitKind::Hero(hb.hero_id),
                name: hspec.name,
                team: Team::Defender,
                x: ax,
                y: ay,
                hp: hspec.base_hp,
                max_hp: hspec.base_hp,
                base_dps: hspec.base_dps,
                damage_per_hit: hspec.damage_per_hit,
                attack_speed_sec: hspec.attack_speed_sec,
                move_speed: hspec.move_speed,
                range: hspec.range,
                splash_radius: 0.0,
                housing_space: 25,
                is_air: matches!(hspec.movement, MovementMode::Air),
                movement: MovementMode::JumpWalls,
                target_domain: hspec.target_domain,
                preferred_target: PreferredTarget::Any,
                target: TargetRef::None,
                waypoints: Vec::new(),
                repath_timer: 0.0,
                attack_cooldown: 0.0,
                is_burrowed: false,
                freeze_timer: 0.0,
                stun_timer: 0.0,
                invisibility_timer: 0.0,
                invincibility_timer: 0.0,
                rage_timer: 0.0,
                rage_boost_mult: 0.0,
                rage_speed_bonus: 0.0,
                haste_timer: 0.0,
                attack_speed_mult: 1.0,
                bonus_flat_damage: 0.0,
                damage_shield_timer: 0.0,
                damage_shield_protection: 0.0,
                poison_timer: 0.0,
                slow_timer: 0.0,
                ability_used: true,
                ability_active_timer: 0.0,
                equipped_items: None,
                paired_hero_id: None,
                phoenix_revive_available: false,
                special_timer: 0.0,
                spawned_children_count: 0,
                yeti_hp_milestone: 0.0,
                lifetime_remaining: None,
                anchor_pos: Some((ax, ay)),
                inferno_ramp_sec: 0.0,
                limited_special_attacks: 0,
                life_aura_timer: 0.0,
                alive: true,
            });
        }

        engine
    }

    fn alloc_unit_id(&mut self) -> u32 {
        let id = self.next_unit_id;
        self.next_unit_id += 1;
        id
    }

    fn alloc_projectile_id(&mut self) -> u32 {
        let id = self.next_projectile_id;
        self.next_projectile_id += 1;
        id
    }

    #[allow(clippy::too_many_arguments)]
    pub fn spawn_projectile(
        &mut self,
        kind: ProjectileKind,
        team: Team,
        from_x: f32,
        from_y: f32,
        target_x: f32,
        target_y: f32,
        target: TargetRef,
        homing: bool,
        speed: f32,
        arc_height: f32,
        damage: f32,
        splash_radius: f32,
        target_domain: TargetDomain,
        color: &'static str,
        payload: ProjectilePayload,
    ) {
        let id = self.alloc_projectile_id();
        let total_dist = dist(from_x, from_y, target_x, target_y).max(0.25);
        self.projectiles.push(SimProjectile {
            id,
            kind,
            team,
            from_x,
            from_y,
            x: from_x,
            y: from_y,
            target_x,
            target_y,
            target,
            homing,
            speed: speed.max(2.0),
            progress: 0.0,
            total_dist,
            arc_height,
            damage,
            splash_radius,
            target_domain,
            color,
            payload,
        });
    }

    pub fn can_deploy_at(&self, x: f32, y: f32) -> bool {
        if x < 0.0 || y < 0.0 || x >= 50.0 || y >= 50.0 {
            return false;
        }
        let tx = (x.floor() as i32).clamp(0, 49) as usize;
        let ty = (y.floor() as i32).clamp(0, 49) as usize;
        !self.no_deploy_mask[ty][tx]
    }

    pub fn apply_action(&mut self, action: BattleAction) -> bool {
        if self.is_finished {
            return false;
        }
        match action {
            BattleAction::NoOp => true,
            BattleAction::DeployTroop { troop_id, x, y } => {
                self.deploy_troop_count(troop_id, x, y, 1) > 0
            }
            BattleAction::DeployTroopBatch {
                troop_id,
                x,
                y,
                count,
            } => self.deploy_troop_count(troop_id, x, y, count) > 0,
            BattleAction::DeployHero { hero_id, x, y } => {
                if !self.can_deploy_at(x, y) {
                    return false;
                }
                let Some(pos) = self
                    .remaining_heroes
                    .iter()
                    .position(|(hid, _)| *hid == hero_id)
                else {
                    return false;
                };
                let (hid, pet_id) = self.remaining_heroes.remove(pos);
                let hero_uid = self.spawn_hero_unit(hid, Team::Attacker, x, y);
                self.deployed_heroes.push((hid, hero_uid));
                self.spawn_pet_unit(pet_id, hero_uid, x + 0.6, y + 0.6);
                true
            }
            BattleAction::ActivateHeroAbility { hero_id } => {
                let Some(&(_, hero_uid)) =
                    self.deployed_heroes.iter().find(|(h, _)| *h == hero_id)
                else {
                    return false;
                };
                self.trigger_hero_ability(hero_id, hero_uid)
            }
            BattleAction::DeploySiege { x, y } => {
                if !self.can_deploy_at(x, y) {
                    return false;
                }
                if let Some(siege_id) = self.remaining_siege.take() {
                    let uid = self.spawn_troop_unit(siege_id, Team::Attacker, x, y, None);
                    self.active_siege_unit_id = Some(uid);
                    true
                } else if !self.attacker_cc_popped && !self.attacker_cc_troops.is_empty() {
                    // Direct offensive Clan Castle deployment when no Siege Machine is selected
                    self.release_attacker_cc(x, y);
                    true
                } else {
                    false
                }
            }
            BattleAction::PopSiegeMachine => {
                if self.attacker_cc_popped {
                    return false;
                }
                if let Some(uid) = self.active_siege_unit_id {
                    if let Some(u) = self.units.iter_mut().find(|u| u.id == uid && u.alive) {
                        let sx = u.x;
                        let sy = u.y;
                        u.alive = false;
                        self.release_attacker_cc(sx, sy);
                        return true;
                    }
                }
                false
            }
            BattleAction::CastSpell { spell_id, x, y } => {
                if x < 0.0 || y < 0.0 || x >= 50.0 || y >= 50.0 {
                    return false;
                }
                let Some(entry) = self
                    .remaining_spells
                    .iter_mut()
                    .find(|(id, c)| *id == spell_id && *c > 0)
                else {
                    return false;
                };
                entry.1 -= 1;
                self.cast_spell(spell_id, Team::Attacker, x, y);
                true
            }
        }
    }

    pub fn deploy_troop_count(
        &mut self,
        troop_id: TroopId,
        x: f32,
        y: f32,
        requested_count: u16,
    ) -> u16 {
        if !self.can_deploy_at(x, y) {
            return 0;
        }
        let Some(entry) = self
            .remaining_troops
            .iter_mut()
            .find(|(id, c)| *id == troop_id && *c > 0)
        else {
            return 0;
        };
        let to_spawn = requested_count.max(1).min(entry.1);
        entry.1 -= to_spawn;
        for i in 0..to_spawn {
            let angle = (i as f32) * 2.3999631; // golden angle spread
            let r = if i == 0 {
                0.0
            } else {
                0.15 * ((i as f32).sqrt()).min(0.42)
            };
            let sx = (x + r * angle.cos()).clamp(0.5, 49.5);
            let sy = (y + r * angle.sin()).clamp(0.5, 49.5);
            let (fx, fy) = if self.can_deploy_at(sx, sy) {
                (sx, sy)
            } else {
                (x, y)
            };
            self.spawn_troop_unit(troop_id, Team::Attacker, fx, fy, None);
        }
        to_spawn
    }

    pub fn spawn_troop_unit(
        &mut self,
        troop_id: TroopId,
        team: Team,
        x: f32,
        y: f32,
        lifetime: Option<f32>,
    ) -> u32 {
        let spec = get_troop_spec(troop_id);
        let uid = self.alloc_unit_id();
        let default_lifetime = match spec.special {
            TroopSpecial::FurnaceSpawner { lifetime_sec, .. } => Some(lifetime_sec),
            TroopSpecial::SiegeSpawner { lifetime_sec } => Some(lifetime_sec),
            TroopSpecial::DruidEvolution {
                evolve_after_sec, ..
            } => Some(evolve_after_sec),
            _ => lifetime,
        };
        let (initial_special_attacks, initial_range) = match troop_id {
            TroopId::SuperMinion => (8, 9.75),
            _ => (0, spec.range),
        };
        let (initial_rage_timer, initial_rage_mult, initial_rage_speed) = match troop_id {
            TroopId::SuperBarbarian => (8.0, 1.70, 1.875),
            _ => (0.0, 0.0, 0.0),
        };
        let initial_invis = match troop_id {
            TroopId::SneakyGoblin => 5.0,
            _ => 0.0,
        };
        let (initial_haste, initial_speed_bonus) = match troop_id {
            TroopId::RocketBalloon => (4.0, 4.0),
            _ => (0.0, 0.0),
        };
        let initial_burrowed = matches!(troop_id, TroopId::BattleDrill);

        self.units.push(SimUnit {
            id: uid,
            kind: UnitKind::Troop(troop_id),
            name: spec.name,
            team,
            x: x.clamp(0.5, 49.5),
            y: y.clamp(0.5, 49.5),
            hp: spec.max_hp,
            max_hp: spec.max_hp,
            base_dps: spec.dps,
            damage_per_hit: spec.damage_per_hit,
            attack_speed_sec: spec.attack_speed_sec.max(0.2),
            move_speed: spec.move_speed + initial_speed_bonus,
            range: initial_range,
            splash_radius: spec.splash_radius,
            housing_space: spec.housing_space,
            is_air: matches!(spec.movement, MovementMode::Air),
            // globals.csv: ENABLE_DEFENDING_ALLIANCE_TROOP_JUMP = TRUE
            movement: if team == Team::Defender && matches!(spec.movement, MovementMode::Ground) {
                MovementMode::JumpWalls
            } else {
                spec.movement
            },
            target_domain: spec.target_domain,
            preferred_target: spec.preferred_target,
            target: TargetRef::None,
            waypoints: Vec::new(),
            repath_timer: 0.0,
            attack_cooldown: 0.0,
            is_burrowed: initial_burrowed,
            freeze_timer: 0.0,
            stun_timer: 0.0,
            invisibility_timer: initial_invis,
            invincibility_timer: 0.0,
            rage_timer: initial_rage_timer,
            rage_boost_mult: initial_rage_mult,
            rage_speed_bonus: initial_rage_speed,
            haste_timer: initial_haste,
            attack_speed_mult: 1.0,
            bonus_flat_damage: 0.0,
            damage_shield_timer: 0.0,
            damage_shield_protection: 0.0,
            poison_timer: 0.0,
            slow_timer: 0.0,
            ability_used: false,
            ability_active_timer: 0.0,
            equipped_items: None,
            paired_hero_id: None,
            phoenix_revive_available: false,
            special_timer: 0.0,
            spawned_children_count: 0,
            yeti_hp_milestone: spec.max_hp - 600.0,
            lifetime_remaining: default_lifetime,
            anchor_pos: None,
            inferno_ramp_sec: 0.0,
            limited_special_attacks: initial_special_attacks,
            life_aura_timer: 0.0,
            alive: true,
        });
        uid
    }

    pub fn spawn_hero_unit(&mut self, hero_id: HeroId, team: Team, x: f32, y: f32) -> u32 {
        let spec = get_hero_spec(hero_id);
        let eq_pair = self
            .hero_equipment
            .iter()
            .find(|(h, _)| *h == hero_id)
            .map(|(_, eq)| *eq)
            .unwrap_or(spec.default_equipment);
        let eq0 = get_equipment_spec(eq_pair[0]);
        let eq1 = get_equipment_spec(eq_pair[1]);

        let total_hp = (spec.base_hp + eq0.hp_bonus + eq1.hp_bonus).max(spec.max_hp * 0.75);
        let total_dps = (spec.base_dps + eq0.dps_bonus + eq1.dps_bonus).max(spec.dps * 0.75);
        let dph = total_dps * spec.attack_speed_sec;
        let has_stick_horse = eq_pair.contains(&EquipmentId::StickHorse);
        let movement = if has_stick_horse && matches!(spec.movement, MovementMode::Ground) {
            MovementMode::JumpWalls
        } else {
            spec.movement
        };

        let (initial_attacks, hero_range) = if eq_pair.contains(&EquipmentId::RocketSpear) {
            (10, 10.0)
        } else if eq_pair.contains(&EquipmentId::NobleIron) {
            (10, 8.0)
        } else {
            (0, spec.range)
        };

        let uid = self.alloc_unit_id();
        self.units.push(SimUnit {
            id: uid,
            kind: UnitKind::Hero(hero_id),
            name: spec.name,
            team,
            x: x.clamp(0.5, 49.5),
            y: y.clamp(0.5, 49.5),
            hp: total_hp,
            max_hp: total_hp,
            base_dps: total_dps,
            damage_per_hit: dph,
            attack_speed_sec: spec.attack_speed_sec,
            move_speed: if has_stick_horse {
                spec.move_speed + 3.0 // StickHorseBoost L10: SpeedBoost 300 = +3 tiles/s
            } else {
                spec.move_speed
            },
            range: hero_range,
            splash_radius: 0.0,
            housing_space: 25,
            is_air: matches!(movement, MovementMode::Air),
            movement,
            target_domain: spec.target_domain,
            preferred_target: spec.preferred_target,
            target: TargetRef::None,
            waypoints: Vec::new(),
            repath_timer: 0.0,
            attack_cooldown: 0.0,
            is_burrowed: false,
            freeze_timer: 0.0,
            stun_timer: 0.0,
            invisibility_timer: 0.0,
            invincibility_timer: 0.0,
            rage_timer: 0.0,
            rage_boost_mult: 0.0,
            rage_speed_bonus: 0.0,
            haste_timer: 0.0,
            attack_speed_mult: 1.0,
            bonus_flat_damage: 0.0,
            damage_shield_timer: 0.0,
            damage_shield_protection: 0.0,
            poison_timer: 0.0,
            slow_timer: 0.0,
            ability_used: false,
            ability_active_timer: 0.0,
            equipped_items: Some(eq_pair),
            paired_hero_id: None,
            phoenix_revive_available: false,
            special_timer: 0.0,
            spawned_children_count: 0,
            yeti_hp_milestone: 0.0,
            lifetime_remaining: None,
            anchor_pos: None,
            inferno_ramp_sec: 0.0,
            limited_special_attacks: initial_attacks,
            life_aura_timer: 0.0,
            alive: true,
        });
        uid
    }

    fn spawn_pet_unit(&mut self, pet_id: PetId, hero_uid: u32, x: f32, y: f32) {
        let spec = get_pet_spec(pet_id);
        let uid = self.alloc_unit_id();
        if pet_id == PetId::Phoenix {
            if let Some(h) = self.units.iter_mut().find(|u| u.id == hero_uid) {
                h.phoenix_revive_available = true;
            }
        }
        if pet_id == PetId::AngryJelly {
            if let Some(h) = self.units.iter_mut().find(|u| u.id == hero_uid) {
                h.preferred_target = PreferredTarget::Defenses;
            }
        }
        self.units.push(SimUnit {
            id: uid,
            kind: UnitKind::Pet(pet_id),
            name: spec.name,
            team: Team::Attacker,
            x: x.clamp(0.5, 49.5),
            y: y.clamp(0.5, 49.5),
            hp: spec.max_hp,
            max_hp: spec.max_hp,
            base_dps: spec.dps,
            damage_per_hit: spec.damage_per_hit,
            attack_speed_sec: spec.attack_speed_sec,
            move_speed: spec.move_speed,
            range: spec.range,
            splash_radius: 0.0,
            housing_space: 20,
            is_air: matches!(spec.movement, MovementMode::Air),
            movement: spec.movement,
            target_domain: spec.target_domain,
            preferred_target: spec.preferred_target,
            target: TargetRef::None,
            waypoints: Vec::new(),
            repath_timer: 0.0,
            attack_cooldown: 0.0,
            is_burrowed: false,
            freeze_timer: 0.0,
            stun_timer: 0.0,
            invisibility_timer: if pet_id == PetId::SpiritFox { 4.0 } else { 0.0 },
            invincibility_timer: 0.0,
            rage_timer: 0.0,
            rage_boost_mult: 0.0,
            rage_speed_bonus: 0.0,
            haste_timer: 0.0,
            attack_speed_mult: 1.0,
            bonus_flat_damage: 0.0,
            damage_shield_timer: 0.0,
            damage_shield_protection: 0.0,
            poison_timer: 0.0,
            slow_timer: 0.0,
            ability_used: false,
            ability_active_timer: 0.0,
            equipped_items: None,
            paired_hero_id: Some(hero_uid),
            phoenix_revive_available: false,
            special_timer: 0.0,
            spawned_children_count: 0,
            yeti_hp_milestone: 0.0,
            lifetime_remaining: None,
            anchor_pos: None,
            inferno_ramp_sec: 0.0,
            limited_special_attacks: 0,
            life_aura_timer: 0.0,
            alive: true,
        });
    }

    fn trigger_hero_ability(&mut self, hero_id: HeroId, hero_uid: u32) -> bool {
        let Some(idx) = self
            .units
            .iter()
            .position(|u| u.id == hero_uid && u.alive && !u.ability_used)
        else {
            return false;
        };
        let spec = get_hero_spec(hero_id);
        let eq_pair = self.units[idx]
            .equipped_items
            .unwrap_or(spec.default_equipment);
        let eq0 = get_equipment_spec(eq_pair[0]);
        let eq1 = get_equipment_spec(eq_pair[1]);

        let hx = self.units[idx].x;
        let hy = self.units[idx].y;
        self.units[idx].ability_used = true;
        self.units[idx].ability_active_timer = spec.ability_duration_sec;
        // csv composition (special_abilities.csv): innate hero-ability heal
        // (e.g. BarbarianKingAbilityHeal L23 = 3250) + both equipped items'
        // HealOnActivation columns.
        let total_heal = spec.ability_heal + eq0.heal_on_activation + eq1.heal_on_activation;
        self.units[idx].hp = (self.units[idx].hp + total_heal).min(self.units[idx].max_hp);

        for &eq_id in &eq_pair {
            self.execute_equipment_ability(idx, eq_id, hx, hy);
        }
        true
    }

    fn execute_equipment_ability(&mut self, idx: usize, eq_id: EquipmentId, hx: f32, hy: f32) {
        match eq_id {
            EquipmentId::BarbarianPuppet => {
                // BarbarianKingSpawnBarbarians L7: 44 Raged Barbarians;
                // BoostBarbarian L7 gives them x3.2 damage and +3.6 tiles/s for 20s.
                for i in 0..44 {
                    let angle = (i as f32 / 44.0) * std::f32::consts::TAU;
                    let uid = self.spawn_troop_unit(
                        TroopId::Barbarian,
                        Team::Attacker,
                        hx + angle.cos() * 1.5,
                        hy + angle.sin() * 1.5,
                        None,
                    );
                    if let Some(u) = self.units.iter_mut().find(|u| u.id == uid) {
                        u.rage_timer = 20.0;
                        u.rage_boost_mult = 3.2;
                        u.rage_speed_bonus = 3.6;
                    }
                }
            }
            EquipmentId::RageVial => {
                // BarbarianKingRage L7: BoostDamagePercentage 155 (x2.55),
                // SpeedBoost 480 -> +4.8 tiles/s, 10s.
                self.units[idx].rage_timer = 10.0;
                self.units[idx].rage_boost_mult = 2.55;
                self.units[idx].rage_speed_bonus = 4.8;
            }
            EquipmentId::EarthquakeBoots => {
                // BarbarianKingEarthquakeBoots L7 (SelfSpell 7): 8-tile quake ring
                for bi in 0..self.buildings.len() {
                    if !self.buildings[bi].destroyed
                        && dist(hx, hy, self.buildings[bi].center_x, self.buildings[bi].center_y)
                            <= 8.0
                    {
                        let dmg = self.buildings[bi].max_hp * 0.40;
                        self.damage_building(bi, dmg);
                    }
                }
                let mut wall_broken = false;
                for w in &mut self.walls {
                    if !w.destroyed
                        && dist(hx, hy, w.tile_x as f32 + 0.5, w.tile_y as f32 + 0.5) <= 8.0
                    {
                        w.hp = 0.0;
                        w.destroyed = true;
                        wall_broken = true;
                    }
                }
                if wall_broken {
                    self.invalidate_pathing();
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x: hx,
                    y: hy,
                    radius: 8.0,
                    color: "#d97706",
                });
            }
            EquipmentId::GiantGauntlet => {
                // BarbarianKingGetsBig L10: splash radius 250 (2.5t),
                // ShieldProtectionPercent 60, 19s activation (+ Regeneration 40 HP/s
                // modeled with the other equipment passives).
                self.units[idx].splash_radius = 2.5;
                self.units[idx].damage_shield_timer = 19.0;
                self.units[idx].damage_shield_protection = 0.60;
                self.units[idx].ability_active_timer = 19.0;
            }
            EquipmentId::SpikyBall => {
                let mut candidates: Vec<(usize, f32)> = self
                    .buildings
                    .iter()
                    .enumerate()
                    .filter(|(_, b)| {
                        !b.destroyed && b.overgrowth_timer <= 0.0 && b.invisibility_timer <= 0.0
                    })
                    .map(|(i, b)| (i, dist(hx, hy, b.center_x, b.center_y)))
                    .collect();
                candidates.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
                let mut prev = (hx, hy);
                for (b_idx, _) in candidates.into_iter().take(8) {
                    let bx = self.buildings[b_idx].center_x;
                    let by = self.buildings[b_idx].center_y;
                    self.damage_building(b_idx, 3250.0);
                    self.visual_events.push(VisualEvent::Projectile {
                        from_x: prev.0,
                        from_y: prev.1,
                        to_x: bx,
                        to_y: by,
                        color: "#f59e0b",
                        splash_radius: 1.0,
                    });
                    prev = (bx, by);
                }
            }
            EquipmentId::StickHorse => {
                self.units[idx].movement = MovementMode::JumpWalls;
                self.units[idx].haste_timer = 30.0;
            }
            EquipmentId::ArcherPuppet => {
                // ArcherQueenSpawnArchers L7: 35 Archers
                for i in 0..35 {
                    let angle = (i as f32 / 35.0) * std::f32::consts::TAU;
                    let uid = self.spawn_troop_unit(
                        TroopId::Archer,
                        Team::Attacker,
                        hx + angle.cos() * 1.5,
                        hy + angle.sin() * 1.5,
                        None,
                    );
                    if let Some(u) = self.units.iter_mut().find(|u| u.id == uid) {
                        u.invisibility_timer = 6.5;
                    }
                }
            }
            EquipmentId::InvisibilityVial => {
                // ArcherQueenInvisibility L18: 7800ms cloak + ExtraDamageFlat 1740 per hit
                self.units[idx].invisibility_timer = 7.8;
                self.units[idx].bonus_flat_damage = 1740.0;
            }
            EquipmentId::GiantArrow => {
                // Piercing arrow across the village toward center (25, 25)
                let dx = (25.0 - hx).max(0.01);
                let dy = 25.0 - hy;
                let len = (dx * dx + dy * dy).sqrt().max(0.1);
                let ux = dx / len;
                let uy = dy / len;
                for bi in 0..self.buildings.len() {
                    if self.buildings[bi].destroyed {
                        continue;
                    }
                    let bx = self.buildings[bi].center_x - hx;
                    let by = self.buildings[bi].center_y - hy;
                    let proj = bx * ux + by * uy;
                    if proj >= 0.0 {
                        let perp = (bx - proj * ux).hypot(by - proj * uy);
                        if perp <= 2.2 {
                            self.damage_building(bi, 1950.0);
                        }
                    }
                }
                self.visual_events.push(VisualEvent::Beam {
                    from_x: hx,
                    from_y: hy,
                    to_x: (hx + ux * 45.0).clamp(1.0, 49.0),
                    to_y: (hy + uy * 45.0).clamp(1.0, 49.0),
                    color: "#facc15",
                    width: 3.5,
                });
            }
            EquipmentId::HealerPuppet => {
                for i in 0..3 {
                    let a = (i as f32) * 2.0;
                    self.spawn_troop_unit(
                        TroopId::Healer,
                        Team::Attacker,
                        hx + a.cos() * 1.4,
                        hy + a.sin() * 1.4,
                        None,
                    );
                }
            }
            EquipmentId::MagicMirror => {
                self.units[idx].invisibility_timer = 1.0; // AQCloningCloak: 1000ms
                for dy in [-1.2f32, 1.2] {
                    let uid = self.alloc_unit_id();
                    // ClonedArcherQueenAbility L10: HP 3216, DPS 765, 30s lifetime, no equipment
                    self.units.push(SimUnit {
                        id: uid,
                        kind: UnitKind::Hero(HeroId::ArcherQueen),
                        name: "Archer Queen (Clone)",
                        team: Team::Attacker,
                        x: (hx + 0.8).clamp(0.5, 49.5),
                        y: (hy + dy).clamp(0.5, 49.5),
                        hp: 3216.0,
                        max_hp: 3216.0,
                        base_dps: 765.0,
                        damage_per_hit: 765.0 * 0.75,
                        attack_speed_sec: 0.75,
                        move_speed: 24.0,
                        range: 5.0,
                        splash_radius: 0.0,
                        housing_space: 25,
                        is_air: false,
                        movement: MovementMode::Ground,
                        target_domain: TargetDomain::GroundAndAir,
                        preferred_target: PreferredTarget::Any,
                        target: TargetRef::None,
                        waypoints: Vec::new(),
                        repath_timer: 0.0,
                        attack_cooldown: 0.0,
                        is_burrowed: false,
                        freeze_timer: 0.0,
                        stun_timer: 0.0,
                        invisibility_timer: 0.0,
                        invincibility_timer: 0.0,
                        rage_timer: 0.0,
                        rage_boost_mult: 0.0,
                        rage_speed_bonus: 0.0,
                        haste_timer: 0.0,
                        attack_speed_mult: 1.0,
                        bonus_flat_damage: 0.0,
                        damage_shield_timer: 0.0,
                        damage_shield_protection: 0.0,
                        poison_timer: 0.0,
                        slow_timer: 0.0,
                        ability_used: true,
                        ability_active_timer: 0.0,
                        equipped_items: None,
                        paired_hero_id: None,
                        phoenix_revive_available: false,
                        special_timer: 0.0,
                        spawned_children_count: 0,
                        yeti_hp_milestone: 0.0,
                        lifetime_remaining: Some(30.0),
                        anchor_pos: None,
                        inferno_ramp_sec: 0.0,
                        limited_special_attacks: 0,
                        life_aura_timer: 0.0,
                        alive: true,
                    });
                }
            }
            EquipmentId::ActionFigure => {
                self.units[idx].invisibility_timer = 1.0;
                self.spawn_troop_unit(TroopId::GiantGiant, Team::Attacker, hx + 1.0, hy + 1.0, None);
            }
            EquipmentId::EternalTome => {
                for u in &mut self.units {
                    if u.alive
                        && u.team == Team::Attacker
                        && !u.is_siege_machine()
                        && dist(hx, hy, u.x, u.y) <= 9.0
                    {
                        u.invincibility_timer = 8.2;
                    }
                }
                self.visual_events.push(VisualEvent::HealPulse {
                    x: hx,
                    y: hy,
                    radius: 9.0,
                });
            }
            EquipmentId::HealingTome => {
                self.spells.push(ActiveSpellZone {
                    spell_id: SpellId::Healing,
                    team: Team::Attacker,
                    x: hx,
                    y: hy,
                    radius: 9.0,
                    remaining_sec: 20.0,
                    clone_budget_remaining: 0,
                    processed_unit_ids: Vec::new(),
                    spawn_remaining: 0,
                    spawn_timer: 0.0,
                    fire_dps: 0.0,
                });
            }
            EquipmentId::Fireball => {
                if let Some((b_idx, _)) = self
                    .buildings
                    .iter()
                    .enumerate()
                    .filter(|(_, b)| !b.destroyed && b.category == BuildingCategory::Defense)
                    .map(|(i, b)| (i, dist(hx, hy, b.center_x, b.center_y)))
                    .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
                {
                    let fx = self.buildings[b_idx].center_x;
                    let fy = self.buildings[b_idx].center_y;
                    for bi in 0..self.buildings.len() {
                        if !self.buildings[bi].destroyed
                            && dist(fx, fy, self.buildings[bi].center_x, self.buildings[bi].center_y)
                                <= 6.0
                        {
                            self.damage_building(bi, 4100.0);
                        }
                    }
                    self.visual_events.push(VisualEvent::Explosion {
                        x: fx,
                        y: fy,
                        radius: 6.0,
                        color: "#ef4444",
                    });
                }
            }
            EquipmentId::LavaloonPuppet => {
                for i in 0..3 {
                    let a = (i as f32) * 2.0;
                    self.spawn_troop_unit(
                        TroopId::Lavaloon,
                        Team::Attacker,
                        hx + a.cos() * 1.4,
                        hy + a.sin() * 1.4,
                        None,
                    );
                }
            }
            EquipmentId::HeroicTorch => {
                for u in &mut self.units {
                    if u.alive && u.team == Team::Attacker && dist(hx, hy, u.x, u.y) <= 9.0 {
                        if matches!(u.movement, MovementMode::Ground) {
                            u.movement = MovementMode::JumpWalls;
                        }
                        u.haste_timer = u.haste_timer.max(26.5); // GWHeroicTorch L10: 26500ms
                    }
                }
            }
            EquipmentId::SeekingShield => {
                let mut candidates: Vec<(usize, f32)> = self
                    .buildings
                    .iter()
                    .enumerate()
                    .filter(|(_, b)| {
                        !b.destroyed
                            && b.overgrowth_timer <= 0.0
                            && b.invisibility_timer <= 0.0
                            && b.category == BuildingCategory::Defense
                    })
                    .map(|(i, b)| (i, dist(hx, hy, b.center_x, b.center_y)))
                    .collect();
                candidates.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
                for (b_idx, _) in candidates.into_iter().take(4) {
                    let bx = self.buildings[b_idx].center_x;
                    let by = self.buildings[b_idx].center_y;
                    self.damage_building(b_idx, 2500.0);
                    self.visual_events.push(VisualEvent::Projectile {
                        from_x: hx,
                        from_y: hy,
                        to_x: bx,
                        to_y: by,
                        color: "#38bdf8",
                        splash_radius: 0.8,
                    });
                }
            }
            EquipmentId::HogRiderPuppet => {
                self.units[idx].invisibility_timer = 1.0;
                for i in 0..9 {
                    let a = (i as f32 / 9.0) * std::f32::consts::TAU;
                    self.spawn_troop_unit(
                        TroopId::HogRider,
                        Team::Attacker,
                        hx + a.cos() * 1.4,
                        hy + a.sin() * 1.4,
                        None,
                    );
                }
            }
            EquipmentId::HasteVial => {
                // RoyalChampionHaste L7: AttackSpeed cooldown override 600ms
                // (x2 attack speed), SpeedBoost 480 via haste, 10s. csv grants no
                // damage boost.
                self.units[idx].haste_timer = 10.0;
                self.units[idx].attack_speed_mult = 2.0;
            }
            EquipmentId::RocketSpear => {
                self.units[idx].range = 10.0;
                self.units[idx].limited_special_attacks = 10;
            }
            EquipmentId::FrostFlake => {
                let mut candidates: Vec<(usize, f32)> = self
                    .buildings
                    .iter()
                    .enumerate()
                    .filter(|(_, b)| !b.destroyed && b.category == BuildingCategory::Defense)
                    .map(|(i, b)| (i, dist(hx, hy, b.center_x, b.center_y)))
                    .collect();
                candidates.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
                for (b_idx, _) in candidates.into_iter().take(7) {
                    self.buildings[b_idx].freeze_timer = 7.0;
                    self.damage_building(b_idx, 294.0);
                }
            }
            EquipmentId::HenchmenPuppet => {
                self.units[idx].invisibility_timer = 1.0;
                for dy in [-1.2f32, 1.2] {
                    self.spawn_troop_unit(TroopId::Henchman, Team::Attacker, hx + 0.8, hy + dy, None);
                }
            }
            EquipmentId::DarkOrb => {
                // MinionAttackAbility L7: PenetratingRadius 500 (5 tiles), 200 damage,
                // 50% slow for 18s on every defense hit.
                for b in &mut self.buildings {
                    if !b.destroyed && dist(hx, hy, b.center_x, b.center_y) <= 5.0 {
                        b.slow_timer = 18.0;
                        b.hp = (b.hp - 200.0).max(0.0);
                    }
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x: hx,
                    y: hy,
                    radius: 5.0,
                    color: "#6366f1",
                });
            }
            EquipmentId::MetalPants => {
                // MinionPrinceStoneSkinAbility L7: ShieldProtectionPercent 70 for 15s
                // (+ csv HealOnActivation 2500 applied via the hero-ability heal
                // composition).
                self.units[idx].damage_shield_timer = 15.0;
                self.units[idx].damage_shield_protection = 0.70;
            }
            EquipmentId::PortalPendant => {
                // MPCosmicPortal L10: ShieldProtectionPercent 100 while recalling,
                // recalls up to RecallHousing 400 housing within a 10-tile radius
                // (RecallTroopsRadius 1000), 35% heal bump on redeploy (modeled
                // via the item's HealOnActivation), 8s Recalled-haste not simulated.
                let mut budget = 400u16; // RecallHousing 400
                for u in &mut self.units {
                    if u.alive
                        && u.team == Team::Attacker
                        && dist(hx, hy, u.x, u.y) <= 10.0
                    {
                        if let UnitKind::Troop(tid) = u.kind {
                            if u.housing_space <= budget {
                                budget -= u.housing_space;
                                u.alive = false;
                                if let Some(entry) = self
                                    .remaining_troops
                                    .iter_mut()
                                    .find(|(t, _)| *t == tid)
                                {
                                    entry.1 += 1;
                                } else {
                                    self.remaining_troops.push((tid, 1));
                                }
                            }
                        }
                    }
                }
                self.units[idx].invincibility_timer =
                    self.units[idx].invincibility_timer.max(0.5);
            }
            EquipmentId::FlameBlower => {
                // DD Flaming Sneeze -> DragonDukeFireBlast L7: 2,500 damage in a
                // 60-degree, 12-tile cone (Radius 1200, ConeAngle 60).
                let dir = self
                    .buildings
                    .iter()
                    .filter(|b| !b.destroyed)
                    .map(|b| (b.center_x - hx, b.center_y - hy))
                    .min_by(|a, b| {
                        (a.0 * a.0 + a.1 * a.1)
                            .partial_cmp(&(b.0 * b.0 + b.1 * b.1))
                            .unwrap()
                    })
                    .map(|(dx, dy)| {
                        let len = (dx * dx + dy * dy).sqrt().max(0.001);
                        (dx / len, dy / len)
                    })
                    .unwrap_or((0.0f32, 1.0f32));
                for bi in 0..self.buildings.len() {
                    if !self.buildings[bi].destroyed {
                        let (vx, vy) = (
                            self.buildings[bi].center_x - hx,
                            self.buildings[bi].center_y - hy,
                        );
                        let d = vx.hypot(vy);
                        if d <= 12.0 {
                            let dot = (vx * dir.0 + vy * dir.1).max(0.0) / d.max(0.001);
                            if dot >= (30.0f32.to_radians().cos()) {
                                self.damage_building(bi, 2500.0);
                            }
                        }
                    }
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x: hx + dir.0 * 6.0,
                    y: hy + dir.1 * 6.0,
                    radius: 6.0,
                    color: "#f97316",
                });
                for angle in [-0.6f32, -0.3, 0.0, 0.3, 0.6] {
                    let rx = angle.cos() * dir.0 - angle.sin() * dir.1;
                    let ry = angle.sin() * dir.0 + angle.cos() * dir.1;
                    self.visual_events.push(VisualEvent::Projectile {
                        from_x: hx,
                        from_y: hy,
                        to_x: hx + rx * 12.0,
                        to_y: hy + ry * 12.0,
                        color: "#ef4444",
                        splash_radius: 1.5,
                    });
                }
            }
            EquipmentId::StunBlaster => {
                // DDBlastSpell L7: 400 damage, 8-tile radius, 7500ms stun
                for bi in 0..self.buildings.len() {
                    if !self.buildings[bi].destroyed
                        && dist(hx, hy, self.buildings[bi].center_x, self.buildings[bi].center_y)
                            <= 8.0
                    {
                        self.buildings[bi].stun_timer = 7.5;
                        self.damage_building(bi, 400.0);
                    }
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x: hx,
                    y: hy,
                    radius: 8.0,
                    color: "#38bdf8",
                });
            }
            EquipmentId::RocketBackpack => {
                self.units[idx].invincibility_timer = 4.0;
                self.units[idx].haste_timer = 8.0;
                for bi in 0..self.buildings.len() {
                    if !self.buildings[bi].destroyed
                        && dist(hx, hy, self.buildings[bi].center_x, self.buildings[bi].center_y)
                            <= 8.0
                    {
                        self.damage_building(bi, 2150.0);
                    }
                }
            }
            _ => {}
        }
    }

    fn release_attacker_cc(&mut self, x: f32, y: f32) {
        if self.attacker_cc_popped {
            return;
        }
        self.attacker_cc_popped = true;
        let cc = self.attacker_cc_troops.clone();
        let mut idx = 0usize;
        for (tid, count) in cc {
            for _ in 0..count {
                let angle = (idx as f32) * 0.9;
                idx += 1;
                self.spawn_troop_unit(
                    tid,
                    Team::Attacker,
                    x + angle.cos() * 1.2,
                    y + angle.sin() * 1.2,
                    None,
                );
            }
        }
    }

    pub fn cast_spell(&mut self, spell_id: SpellId, team: Team, x: f32, y: f32) {
        let spec = get_spell_spec(spell_id);
        match &spec.effect {
            SpellEffect::InstantDamage { damage, stun_sec } => {
                for i in 0..self.buildings.len() {
                    let b = &self.buildings[i];
                    if b.destroyed || b.overgrowth_timer > 0.0 {
                        continue;
                    }
                    // Resource storages and Town Hall are immune to Lightning
                    if matches!(
                        b.building_id,
                        BuildingId::GoldStorage
                            | BuildingId::ElixirStorage
                            | BuildingId::DarkElixirStorage
                            | BuildingId::TownHall
                    ) {
                        continue;
                    }
                    if building_edge_dist(b, x, y) <= spec.radius {
                        self.buildings[i].stun_timer = self.buildings[i].stun_timer.max(*stun_sec);
                        self.buildings[i].inferno_ramp_sec = 0.0;
                        self.damage_building(i, *damage);
                    }
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x,
                    y,
                    radius: spec.radius,
                    color: "#60a5fa",
                });
            }
            SpellEffect::EarthquakePct {
                building_max_hp_pct,
                wall_mult,
            } => {
                if team == Team::Defender {
                    // Defensive Earthquake Spell Tower (Lv 4): deals 30% of each ground troop's max HP
                    // in a 4.7-tile radius; ignores air troops and never damages friendly buildings!
                    let eq_radius = 4.7;
                    for u_idx in 0..self.units.len() {
                        if self.units[u_idx].alive
                            && self.units[u_idx].team == Team::Attacker
                            && !self.units[u_idx].is_air
                            && !self.units[u_idx].is_burrowed
                            && dist(x, y, self.units[u_idx].x, self.units[u_idx].y) <= eq_radius
                        {
                            let dmg = self.units[u_idx].max_hp * 0.30;
                            self.damage_unit(u_idx, dmg);
                        }
                    }
                    self.visual_events.push(VisualEvent::Explosion {
                        x,
                        y,
                        radius: eq_radius,
                        color: "#a16207",
                    });
                } else {
                    for i in 0..self.buildings.len() {
                        let b = &self.buildings[i];
                        if b.destroyed || b.overgrowth_timer > 0.0 {
                            continue;
                        }
                        if matches!(
                            b.building_id,
                            BuildingId::GoldStorage
                                | BuildingId::ElixirStorage
                                | BuildingId::DarkElixirStorage
                        ) {
                            continue;
                        }
                        if building_edge_dist(b, x, y) <= spec.radius {
                            let k = self.buildings[i].eq_hits as f32;
                            let mult = 1.0 / (2.0 * k + 1.0);
                            let dmg = self.buildings[i].max_hp * (*building_max_hp_pct) * mult;
                            self.buildings[i].eq_hits += 1;
                            self.damage_building(i, dmg);
                        }
                    }
                    let mut wall_broken = false;
                    for w in &mut self.walls {
                        if !w.destroyed
                            && dist(x, y, w.tile_x as f32 + 0.5, w.tile_y as f32 + 0.5)
                                <= spec.radius
                        {
                            w.eq_hits += 1;
                            if w.eq_hits >= 4 {
                                w.hp = 0.0;
                                w.destroyed = true;
                                wall_broken = true;
                            } else {
                                let dmg = w.max_hp * (*building_max_hp_pct) * (*wall_mult) * 0.25;
                                w.hp = (w.hp - dmg).max(1.0);
                            }
                        }
                    }
                    if wall_broken {
                        self.invalidate_pathing();
                    }
                    self.visual_events.push(VisualEvent::Explosion {
                        x,
                        y,
                        radius: spec.radius,
                        color: "#a16207",
                    });
                }
            }
            SpellEffect::RecallUnits { max_housing } => {
                let mut budget = *max_housing;
                let mut recalled_heroes: Vec<(HeroId, PetId)> = Vec::new();
                for u in &mut self.units {
                    if u.alive && u.team == Team::Attacker && dist(x, y, u.x, u.y) <= spec.radius {
                        match u.kind {
                            UnitKind::Troop(tid) => {
                                let tspec = get_troop_spec(tid);
                                if tspec.category != TroopCategory::SiegeMachine && u.housing_space <= budget {
                                    budget -= u.housing_space;
                                    u.alive = false;
                                    if let Some(entry) =
                                        self.remaining_troops.iter_mut().find(|(t, _)| *t == tid)
                                    {
                                        entry.1 += 1;
                                    } else {
                                        self.remaining_troops.push((tid, 1));
                                    }
                                }
                            }
                            UnitKind::Hero(hid) => {
                                if u.housing_space <= budget {
                                    budget -= u.housing_space;
                                    u.alive = false;
                                    recalled_heroes.push((hid, PetId::Lassi));
                                }
                            }
                            _ => {}
                        }
                    }
                }
                for (hid, default_pet) in recalled_heroes {
                    let pet = self.units.iter_mut().find(|p| {
                        p.alive
                            && matches!(p.kind, UnitKind::Pet(_))
                            && self
                                .deployed_heroes
                                .iter()
                                .any(|&(dh, du)| dh == hid && p.paired_hero_id == Some(du))
                    });
                    let pet_id = if let Some(p) = pet {
                        p.alive = false;
                        if let UnitKind::Pet(pid) = p.kind {
                            pid
                        } else {
                            default_pet
                        }
                    } else {
                        default_pet
                    };
                    self.remaining_heroes.push((hid, pet_id));
                    self.deployed_heroes.retain(|(h, _)| *h != hid);
                }
                self.visual_events.push(VisualEvent::HealPulse {
                    x,
                    y,
                    radius: spec.radius,
                });
            }
            SpellEffect::ReviveHero { hp_pct } => {
                let mut chosen_idx = None;
                let mut min_d = f32::MAX;
                for (ui, u) in self.units.iter().enumerate() {
                    if !u.alive
                        && u.team == Team::Attacker
                        && matches!(u.kind, UnitKind::Hero(_))
                    {
                        let d = dist(x, y, u.x, u.y);
                        if d <= spec.radius && d < min_d {
                            min_d = d;
                            chosen_idx = Some(ui);
                        }
                    }
                }
                if chosen_idx.is_none() {
                    for (ui, u) in self.units.iter().enumerate() {
                        if !u.alive
                            && u.team == Team::Attacker
                            && matches!(u.kind, UnitKind::Hero(_))
                        {
                            chosen_idx = Some(ui);
                            break;
                        }
                    }
                }
                if let Some(ui) = chosen_idx {
                    let u = &mut self.units[ui];
                    u.alive = true;
                    u.hp = u.max_hp * (*hp_pct);
                    u.freeze_timer = 0.0;
                    u.stun_timer = 0.0;
                    u.poison_timer = 0.0;
                    u.slow_timer = 0.0;
                    u.target = TargetRef::None;
                    u.waypoints.clear();
                    u.repath_timer = 0.0;
                    self.visual_events.push(VisualEvent::HealPulse {
                        x: u.x,
                        y: u.y,
                        radius: spec.radius,
                    });
                }
            }
            SpellEffect::SummonTotem {
                hp,
                decay_per_sec: _,
                stun_sec,
            } => {
                let uid = self.alloc_unit_id();
                self.units.push(SimUnit {
                    id: uid,
                    kind: UnitKind::Totem,
                    name: "Totem",
                    team: Team::Attacker,
                    x,
                    y,
                    hp: *hp,
                    max_hp: *hp,
                    base_dps: 0.0,
                    damage_per_hit: 0.0,
                    attack_speed_sec: 1.0,
                    move_speed: 0.0,
                    range: 0.0,
                    splash_radius: 0.0,
                    housing_space: 20,
                    is_air: false,
                    movement: MovementMode::Stationary,
                    target_domain: TargetDomain::None,
                    preferred_target: PreferredTarget::Any,
                    target: TargetRef::None,
                    waypoints: Vec::new(),
                    repath_timer: 0.0,
                    attack_cooldown: 0.0,
                    is_burrowed: false,
                    freeze_timer: 0.0,
                    stun_timer: 0.0,
                    invisibility_timer: 0.0,
                    invincibility_timer: 0.0,
                    rage_timer: 0.0,
                    rage_boost_mult: 0.0,
                    rage_speed_bonus: 0.0,
                    haste_timer: 0.0,
                    attack_speed_mult: 1.0,
                    bonus_flat_damage: 0.0,
                    damage_shield_timer: 0.0,
                    damage_shield_protection: 0.0,
                    poison_timer: 0.0,
                    slow_timer: 0.0,
                    ability_used: false,
                    ability_active_timer: 0.0,
                    equipped_items: None,
                    paired_hero_id: None,
                    phoenix_revive_available: false,
                    special_timer: 0.0,
                    spawned_children_count: 0,
                    yeti_hp_milestone: 0.0,
                    lifetime_remaining: Some(38.9),
                    anchor_pos: None,
                    inferno_ramp_sec: 0.0,
                    limited_special_attacks: 0,
                    life_aura_timer: 0.0,
                    alive: true,
                });
                for b in &mut self.buildings {
                    if !b.destroyed && building_edge_dist(b, x, y) <= spec.radius {
                        b.stun_timer = b.stun_timer.max(*stun_sec);
                    }
                }
                for u in &mut self.units {
                    if u.alive && u.team != team && dist(x, y, u.x, u.y) <= spec.radius {
                        u.stun_timer = u.stun_timer.max(*stun_sec);
                    }
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x,
                    y,
                    radius: spec.radius,
                    color: "#f59e0b",
                });
            }
            SpellEffect::SpawnSkeletons { count } => {
                let first_group = 4u8.min(*count);
                for i in 0..first_group {
                    let a = (i as f32) * 1.57;
                    self.spawn_troop_unit(
                        TroopId::ArmoredSkeleton,
                        Team::Attacker,
                        x + a.cos() * 1.2,
                        y + a.sin() * 1.2,
                        None,
                    );
                }
                let rem = count.saturating_sub(first_group);
                if rem > 0 {
                    self.spells.push(ActiveSpellZone {
                        spell_id,
                        team,
                        x,
                        y,
                        radius: spec.radius,
                        remaining_sec: spec.duration_sec,
                        clone_budget_remaining: 0,
                        processed_unit_ids: Vec::new(),
                        spawn_remaining: rem,
                        spawn_timer: 0.8,
                        fire_dps: 0.0,
                    });
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x,
                    y,
                    radius: spec.radius,
                    color: "#fca5a5",
                });
            }
            SpellEffect::SpawnBats { count } => {
                let first_group = 5u8.min(*count);
                for i in 0..first_group {
                    let a = (i as f32) * 1.25;
                    self.spawn_troop_unit(
                        TroopId::Bat,
                        Team::Attacker,
                        x + a.cos() * 1.2,
                        y + a.sin() * 1.2,
                        None,
                    );
                }
                let rem = count.saturating_sub(first_group);
                if rem > 0 {
                    self.spells.push(ActiveSpellZone {
                        spell_id,
                        team,
                        x,
                        y,
                        radius: spec.radius,
                        remaining_sec: spec.duration_sec,
                        clone_budget_remaining: 0,
                        processed_unit_ids: Vec::new(),
                        spawn_remaining: rem,
                        spawn_timer: 0.6,
                        fire_dps: 0.0,
                    });
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x,
                    y,
                    radius: spec.radius,
                    color: "#c4b5fd",
                });
            }
            SpellEffect::CloneUnits { max_housing, .. } => {
                self.spells.push(ActiveSpellZone {
                    spell_id,
                    team,
                    x,
                    y,
                    radius: spec.radius,
                    remaining_sec: spec.duration_sec,
                    clone_budget_remaining: *max_housing,
                    processed_unit_ids: Vec::new(),
                    spawn_remaining: 0,
                    spawn_timer: 0.0,
                    fire_dps: 0.0,
                });
            }
            _ => {
                let (eff_radius, eff_duration) = if team == Team::Defender {
                    match spell_id {
                        SpellId::Rage => (5.0, 18.0),
                        SpellId::Poison => (5.0, 12.0),
                        SpellId::Invisibility => (4.5, 4.5),
                        _ => (spec.radius, spec.duration_sec),
                    }
                } else {
                    (spec.radius, spec.duration_sec)
                };
                self.spells.push(ActiveSpellZone {
                    spell_id,
                    team,
                    x,
                    y,
                    radius: eff_radius,
                    remaining_sec: eff_duration,
                    clone_budget_remaining: 0,
                    processed_unit_ids: Vec::new(),
                    spawn_remaining: 0,
                    spawn_timer: 0.0,
                    fire_dps: 0.0,
                });
                if spell_id == SpellId::Jump {
                    self.invalidate_pathing();
                }
            }
        }
    }

    pub fn step(&mut self, action: BattleAction) -> StepRewardInfo {
        self.visual_events.clear();
        let prev_pct = self.destruction_pct;
        let prev_stars = self.stars;
        let _prev_dmg = self.damage_dealt_total;

        let valid = self.apply_action(action);
        if self.is_finished {
            return StepRewardInfo {
                reward: 0.0,
                delta_destruction_pct: 0,
                delta_stars: 0,
                invalid_action: !valid,
                is_finished: true,
            };
        }

        self.tick += 1;
        self.time_elapsed_sec = self.tick as f32 * DT;

        self.update_spells();
        self.update_traps_and_triggers();
        self.update_buildings();
        self.update_units();
        self.update_projectiles();
        self.update_score_and_termination();

        let delta_pct = self.destruction_pct.saturating_sub(prev_pct);
        let delta_stars = self.stars.saturating_sub(prev_stars);

        // 50/50 balanced reward: 50.0 pts for 100% destruction + 50.0 pts for 3 stars
        let mut reward = (delta_pct as f32) * 0.50
            + (delta_stars as f32) * (50.0 / 3.0);
        if !valid {
            reward -= 0.05;
        }

        StepRewardInfo {
            reward,
            delta_destruction_pct: delta_pct,
            delta_stars,
            invalid_action: !valid,
            is_finished: self.is_finished,
        }
    }

    fn update_spells(&mut self) {
        let mut newly_cloned: Vec<(TroopId, f32, f32, f32)> = Vec::new();
        let mut wave_spawns: Vec<(TroopId, Team, f32, f32)> = Vec::new();
        let mut fire_building_hits: Vec<(usize, f32)> = Vec::new();
        let mut fire_unit_hits: Vec<(usize, f32)> = Vec::new();

        for zone in &mut self.spells {
            zone.remaining_sec -= DT;
            if zone.fire_dps > 0.0 {
                // FireSpiritBurn (spells.csv L4): 150 DPS, 0.8t radius, 10s duration, ImmunityWalls = TRUE
                let mut any_burning_target = false;
                for (bi, b) in self.buildings.iter().enumerate() {
                    if !b.destroyed
                        && b.overgrowth_timer <= 0.0
                        && building_edge_dist(b, zone.x, zone.y) <= zone.radius
                    {
                        fire_building_hits.push((bi, zone.fire_dps * DT));
                        any_burning_target = true;
                    }
                }
                for (ui, u) in self.units.iter().enumerate() {
                    if u.alive
                        && u.team != zone.team
                        && !u.is_burrowed
                        && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                    {
                        fire_unit_hits.push((ui, zone.fire_dps * DT));
                        any_burning_target = true;
                    }
                }
                if !any_burning_target {
                    zone.remaining_sec = 0.0;
                }
                continue;
            }
            let spec = get_spell_spec(zone.spell_id);
            match &spec.effect {
                SpellEffect::HealOverTime {
                    total_heal,
                    hero_mult,
                } => {
                    let hps = *total_heal / spec.duration_sec;
                    for u in &mut self.units {
                        if u.alive
                            && u.team == zone.team
                            && !matches!(
                                u.kind,
                                UnitKind::Troop(
                                    TroopId::WallWrecker
                                        | TroopId::BattleBlimp
                                        | TroopId::StoneSlammer
                                        | TroopId::SiegeBarracks
                                        | TroopId::LogLauncher
                                        | TroopId::FlameFlinger
                                        | TroopId::BattleDrill
                                        | TroopId::TroopLauncher
                                        | TroopId::SkyWagon
                                )
                            )
                            && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                        {
                            let mult = if matches!(u.kind, UnitKind::Hero(_)) {
                                *hero_mult
                            } else {
                                1.0
                            };
                            u.hp = (u.hp + hps * mult * DT).min(u.max_hp);
                        }
                    }
                }
                SpellEffect::RageBuff { .. } => {
                    if zone.team == Team::Attacker {
                        for u in &mut self.units {
                            if u.alive
                                && u.team == Team::Attacker
                                && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                            {
                                u.rage_timer = u.rage_timer.max(1.0);
                                u.rage_boost_mult = 2.90;
                                u.rage_speed_bonus = 4.0;
                            }
                        }
                    } else {
                        for b in &mut self.buildings {
                            if !b.destroyed
                                && building_edge_dist(b, zone.x, zone.y) <= zone.radius
                            {
                                b.rage_timer = b.rage_timer.max(1.0);
                            }
                        }
                        for u in &mut self.units {
                            if u.alive
                                && u.team == Team::Defender
                                && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                            {
                                u.rage_timer = u.rage_timer.max(1.0);
                                u.rage_boost_mult = 2.90;
                                u.rage_speed_bonus = 4.0;
                            }
                        }
                    }
                }
                SpellEffect::FreezeEnemies => {
                    for b in &mut self.buildings {
                        if !b.destroyed
                            && building_edge_dist(b, zone.x, zone.y) <= zone.radius
                        {
                            b.freeze_timer = b.freeze_timer.max(0.2);
                            b.inferno_ramp_sec = 0.0;
                        }
                    }
                    for u in &mut self.units {
                        if u.alive
                            && u.team != zone.team
                            && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                        {
                            u.freeze_timer = u.freeze_timer.max(0.2);
                        }
                    }
                }
                SpellEffect::InvisibilityZone => {
                    for b in &mut self.buildings {
                        if !b.destroyed
                            && building_edge_dist(b, zone.x, zone.y) <= zone.radius
                        {
                            b.invisibility_timer = b.invisibility_timer.max(0.2);
                        }
                    }
                    for u in &mut self.units {
                        if u.alive && dist(zone.x, zone.y, u.x, u.y) <= zone.radius {
                            u.invisibility_timer = u.invisibility_timer.max(0.2);
                        }
                    }
                }
                SpellEffect::OvergrowthRoots => {
                    for b in &mut self.buildings {
                        if !b.destroyed
                            && building_edge_dist(b, zone.x, zone.y) <= zone.radius
                        {
                            b.overgrowth_timer = b.overgrowth_timer.max(0.2);
                        }
                    }
                }
                SpellEffect::PoisonZone { max_dps, .. } => {
                    let eff_dps = if zone.team == Team::Defender {
                        60.0
                    } else {
                        *max_dps * 0.65
                    };
                    for u in &mut self.units {
                        if u.alive
                            && u.team != zone.team
                            && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                        {
                            u.poison_timer = u.poison_timer.max(0.5);
                            let mult = if matches!(
                                u.kind,
                                UnitKind::Troop(
                                    TroopId::GuardianLogger
                                        | TroopId::GuardianLongshot
                                        | TroopId::GuardianSmasher
                                )
                            ) {
                                0.30
                            } else {
                                1.0
                            };
                            u.hp -= (eff_dps * mult) * DT;
                            if u.hp <= 0.0 {
                                u.alive = false;
                            }
                        }
                    }
                }
                SpellEffect::HasteBuff { .. } => {
                    for u in &mut self.units {
                        if u.alive
                            && u.team == zone.team
                            && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                        {
                            u.haste_timer = u.haste_timer.max(0.5);
                        }
                    }
                }
                SpellEffect::IceBlockShield {
                    damage_reduction_pct,
                } => {
                    for u in &mut self.units {
                        if u.alive
                            && u.team == zone.team
                            && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                        {
                            // IceBlock: freezes friendly units in ice and gives 96% shield protection
                            u.freeze_timer = u.freeze_timer.max(0.25);
                            u.damage_shield_timer = u.damage_shield_timer.max(0.25);
                            u.damage_shield_protection = *damage_reduction_pct;
                        }
                    }
                }
                SpellEffect::AngryDefenses { .. } => {
                    for u in &mut self.units {
                        if u.alive
                            && u.team == zone.team
                            && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                        {
                            // csv grants no damage boost: enraged defenders only retarget to defenses
                            if !matches!(
                                u.preferred_target,
                                PreferredTarget::AlliedGround | PreferredTarget::AlliedAny
                            ) {
                                if u.preferred_target != PreferredTarget::Defenses {
                                    u.preferred_target = PreferredTarget::Defenses;
                                    u.target = TargetRef::None;
                                    u.waypoints.clear();
                                    u.repath_timer = 0.0;
                                }
                            }
                        }
                    }
                }
                SpellEffect::CloneUnits {
                    clone_lifetime_sec, ..
                } => {
                    if zone.clone_budget_remaining > 0 {
                        for u in &self.units {
                            if u.alive
                                && u.team == Team::Attacker
                                && u.lifetime_remaining.is_none()
                                && !zone.processed_unit_ids.contains(&u.id)
                                && dist(zone.x, zone.y, u.x, u.y) <= zone.radius
                            {
                                if let UnitKind::Troop(tid) = u.kind {
                                    let tspec = get_troop_spec(tid);
                                    if tspec.category != TroopCategory::SiegeMachine
                                        && u.housing_space <= zone.clone_budget_remaining
                                    {
                                        zone.clone_budget_remaining -= u.housing_space;
                                        zone.processed_unit_ids.push(u.id);
                                        newly_cloned.push((
                                            tid,
                                            u.x + 0.5,
                                            u.y + 0.5,
                                            *clone_lifetime_sec,
                                        ));
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                _ => {}
            }

            if zone.spawn_remaining > 0 {
                zone.spawn_timer -= DT;
                if zone.spawn_timer <= 0.0 {
                    let to_spawn = 1u8.min(zone.spawn_remaining);
                    zone.spawn_remaining -= to_spawn;
                    zone.spawn_timer = match zone.spell_id {
                        SpellId::SkeletonSpell => 0.8,
                        SpellId::BatSpell => 0.5,
                        _ => 1.0,
                    };
                    let tid = match zone.spell_id {
                        SpellId::SkeletonSpell => TroopId::ArmoredSkeleton,
                        SpellId::BatSpell => TroopId::Bat,
                        _ => TroopId::Skeleton,
                    };
                    let a = (zone.spawn_remaining as f32) * 1.3;
                    wave_spawns.push((
                        tid,
                        zone.team,
                        zone.x + a.cos() * 1.2,
                        zone.y + a.sin() * 1.2,
                    ));
                }
            }
        }

        for (bi, dmg) in fire_building_hits {
            self.damage_building(bi, dmg);
        }
        for (ui, dmg) in fire_unit_hits {
            self.damage_unit(ui, dmg);
        }

        self.spells.retain(|z| z.remaining_sec > 0.0);

        for (tid, cx, cy, life) in newly_cloned {
            self.spawn_troop_unit(tid, Team::Attacker, cx, cy, Some(life));
        }
        for (tid, team, cx, cy) in wave_spawns {
            self.spawn_troop_unit(tid, team, cx, cy, None);
        }
    }

    fn update_traps_and_triggers(&mut self) {
        // 1. Check Town Hall 18 Guardian trigger (guardians.csv: Longshot=20t, Logger=16t, Smasher=12t)
        //    & Clan Castle trigger (globals.csv: CLAN_CASTLE_RADIUS=13t, BUNKER_SEARCH_TIME=320ms)
        if !self.guardian_spawned {
            if let Some(th) = self
                .buildings
                .iter()
                .find(|b| b.building_id == BuildingId::TownHall && !b.destroyed)
            {
                let thx = th.center_x;
                let thy = th.center_y;
                let th_mode = th.mode;
                let (g_id, trigger_r) = match th_mode {
                    DefenseMode::GuardianLongshot => (TroopId::GuardianLongshot, 20.0),
                    DefenseMode::GuardianSmasher => (TroopId::GuardianSmasher, 12.0),
                    _ => (TroopId::GuardianLogger, 16.0),
                };
                let triggered = self.units.iter().any(|u| {
                    u.alive
                        && u.team == Team::Attacker
                        && !u.is_burrowed
                        && u.invisibility_timer <= 0.0
                        && dist(thx, thy, u.x, u.y) <= trigger_r
                });
                if triggered {
                    self.guardian_spawned = true;
                    let uid = self.spawn_troop_unit(g_id, Team::Defender, thx, thy, None);
                    if let Some(gu) = self.units.iter_mut().find(|u| u.id == uid) {
                        gu.anchor_pos = Some((thx, thy));
                    }
                }
            }
        }

        // Defending Clan Castle:
        // - DoesNotOpenCC = TRUE & SKELETON_OPEN_CC = FALSE (characters.csv / globals.csv)
        // - Domain-matched deployment: a CC troop only emerges if a luring attacker within 13t
        //   can be targeted by that CC troop's TargetDomain
        // - BUNKER_SEARCH_TIME = 320ms staggered emergence while the Clan Castle stands
        self.cc_spawn_cooldown = (self.cc_spawn_cooldown - DT).max(0.0);
        if self.defender_cc_troops.iter().any(|(_, c)| *c > 0) {
            if let Some(cc) = self
                .buildings
                .iter()
                .find(|b| b.building_id == BuildingId::ClanCastle && !b.destroyed)
            {
                let ccx = cc.center_x;
                let ccy = cc.center_y;
                let mut has_ground_lure = false;
                let mut has_air_lure = false;
                for u in &self.units {
                    if u.alive
                        && u.team == Team::Attacker
                        && !u.is_burrowed
                        && u.invisibility_timer <= 0.0
                        && does_unit_open_cc(u.kind)
                        && dist(ccx, ccy, u.x, u.y) <= 13.0
                    {
                        if u.is_air {
                            has_air_lure = true;
                        } else {
                            has_ground_lure = true;
                        }
                    }
                }
                if (has_ground_lure || has_air_lure) && self.cc_spawn_cooldown <= 0.0 {
                    let mut spawn_tid: Option<TroopId> = None;
                    for (tid, count) in &mut self.defender_cc_troops {
                        if *count == 0 {
                            continue;
                        }
                        let tspec = get_troop_spec(*tid);
                        if (has_ground_lure && tspec.target_domain.can_hit(false))
                            || (has_air_lure && tspec.target_domain.can_hit(true))
                        {
                            *count -= 1;
                            spawn_tid = Some(*tid);
                            break;
                        }
                    }
                    if let Some(tid) = spawn_tid {
                        self.defender_cc_triggered = true;
                        self.cc_spawn_cooldown = 0.32; // BUNKER_SEARCH_TIME = 320ms
                        let a = (self.cc_spawned_count as f32) * 0.8;
                        self.cc_spawned_count = self.cc_spawned_count.wrapping_add(1);
                        self.spawn_troop_unit(
                            tid,
                            Team::Defender,
                            ccx + a.cos() * 1.2,
                            ccy + a.sin() * 1.2,
                            None,
                        );
                    }
                }
            }
        }

        // 2. Check Traps
        let mut skeleton_spawns: Vec<(f32, f32, u8, bool)> = Vec::new();
        for trap in &mut self.traps {
            if trap.triggered {
                continue;
            }
            let spec = get_trap_spec(trap.trap_id);
            let tx = trap.center_x;
            let ty = trap.center_y;

            let mut housing_in_radius = 0u16;
            let mut matching_unit_idx: Option<usize> = None;

            for (u_idx, u) in self.units.iter().enumerate() {
                if !u.alive
                    || u.team != Team::Attacker
                    || u.is_burrowed
                    || u.invincibility_timer > 0.0
                    || !spec.target_domain.can_hit(u.is_air)
                {
                    continue;
                }
                if dist(tx, ty, u.x, u.y) <= spec.trigger_radius {
                    housing_in_radius += u.housing_space;
                    if matching_unit_idx.is_none() {
                        matching_unit_idx = Some(u_idx);
                    }
                }
            }

            let Some(first_idx) = matching_unit_idx else {
                continue;
            };

            match &spec.effect {
                TrapEffect::AreaDamage {
                    damage,
                    splash_radius,
                    ..
                } => {
                    trap.triggered = true;
                    for u in &mut self.units {
                        if u.alive
                            && u.team == Team::Attacker
                            && !u.is_burrowed
                            && u.invincibility_timer <= 0.0
                            && spec.target_domain.can_hit(u.is_air)
                            && dist(tx, ty, u.x, u.y) <= *splash_radius
                        {
                            u.hp -= *damage;
                            if u.hp <= 0.0 {
                                u.alive = false;
                            }
                        }
                    }
                    self.visual_events.push(VisualEvent::Explosion {
                        x: tx,
                        y: ty,
                        radius: *splash_radius,
                        color: "#f97316",
                    });
                }
                TrapEffect::Spring {
                    eject_max_housing,
                    heavy_damage,
                } => {
                    trap.triggered = true;
                    let u = &mut self.units[first_idx];
                    if matches!(u.kind, UnitKind::Troop(_)) && u.housing_space <= *eject_max_housing
                    {
                        u.hp = 0.0;
                        u.alive = false;
                    } else {
                        let dmg = if matches!(u.kind, UnitKind::Hero(_) | UnitKind::Pet(_)) {
                            *heavy_damage * 0.5
                        } else {
                            *heavy_damage
                        };
                        u.hp -= dmg;
                        u.stun_timer = u.stun_timer.max(1.0);
                        if u.hp <= 0.0 {
                            u.alive = false;
                        }
                    }
                }
                TrapEffect::SingleTargetAirMine {
                    damage,
                    min_housing,
                } => {
                    if let Some(u) = self.units.iter_mut().find(|u| {
                        u.alive
                            && u.team == Team::Attacker
                            && u.is_air
                            && u.housing_space >= *min_housing
                            && dist(tx, ty, u.x, u.y) <= spec.trigger_radius
                    }) {
                        trap.triggered = true;
                        if u.invincibility_timer <= 0.0 {
                            u.hp -= *damage;
                            if u.hp <= 0.0 {
                                u.alive = false;
                            }
                        }
                        self.visual_events.push(VisualEvent::Explosion {
                            x: tx,
                            y: ty,
                            radius: 1.5,
                            color: "#dc2626",
                        });
                    }
                }
                TrapEffect::SpawnSkeletons { count } => {
                    trap.triggered = true;
                    skeleton_spawns.push((
                        tx,
                        ty,
                        *count,
                        matches!(trap.mode, TrapMode::SkeletonAir),
                    ));
                }
                TrapEffect::Tornado {
                    duration_sec,
                    dps,
                    pull_radius,
                } => {
                    trap.triggered = true;
                    for u in &mut self.units {
                        if u.alive
                            && u.team == Team::Attacker
                            && !u.is_burrowed
                            && dist(tx, ty, u.x, u.y) <= *pull_radius
                        {
                            u.slow_timer = u.slow_timer.max(*duration_sec);
                            u.hp -= *dps * *duration_sec;
                            // Pull halfway toward trap center
                            u.x = (u.x + tx) * 0.5;
                            u.y = (u.y + ty) * 0.5;
                            if u.hp <= 0.0 {
                                u.alive = false;
                            }
                        }
                    }
                }
                TrapEffect::GigaBlast {
                    damage,
                    splash_radius,
                    min_housing_trigger,
                    ..
                } => {
                    if housing_in_radius >= *min_housing_trigger {
                        trap.triggered = true;
                        for u in &mut self.units {
                            if u.alive
                                && u.team == Team::Attacker
                                && !u.is_burrowed
                                && u.invincibility_timer <= 0.0
                                && dist(tx, ty, u.x, u.y) <= *splash_radius
                            {
                                u.hp -= *damage;
                                u.stun_timer = u.stun_timer.max(1.2);
                                if u.hp <= 0.0 {
                                    u.alive = false;
                                }
                            }
                        }
                        self.visual_events.push(VisualEvent::Explosion {
                            x: tx,
                            y: ty,
                            radius: *splash_radius,
                            color: "#ef4444",
                        });
                    }
                }
            }
        }

        for (sx, sy, count, is_air) in skeleton_spawns {
            for i in 0..count {
                let a = (i as f32) * 1.2;
                let uid = self.spawn_troop_unit(
                    TroopId::Skeleton,
                    Team::Defender,
                    sx + a.cos() * 0.8,
                    sy + a.sin() * 0.8,
                    None,
                );
                if is_air {
                    if let Some(u) = self.units.iter_mut().find(|u| u.id == uid) {
                        u.is_air = true;
                        u.movement = MovementMode::Air;
                        u.target_domain = TargetDomain::Air;
                    }
                }
            }
        }
    }

    fn update_buildings(&mut self) {
        let destroyed_count = self.destroyed_scorable_buildings;
        let pct = self.destruction_pct;
        let any_attacker_deployed = self.units.iter().any(|u| u.team == Team::Attacker);
        let mut spell_casts: Vec<(SpellId, f32, f32)> = Vec::new();
        let mut new_projectiles: Vec<(
            ProjectileKind,
            Team,
            f32,
            f32,
            f32,
            f32,
            TargetRef,
            bool,
            f32,
            f32,
            f32,
            f32,
            TargetDomain,
            &'static str,
            ProjectilePayload,
        )> = Vec::new();

        for b_idx in 0..self.buildings.len() {
            if self.buildings[b_idx].destroyed {
                continue;
            }

            // Decrement timers
            self.buildings[b_idx].freeze_timer =
                (self.buildings[b_idx].freeze_timer - DT).max(0.0);
            self.buildings[b_idx].stun_timer = (self.buildings[b_idx].stun_timer - DT).max(0.0);
            self.buildings[b_idx].overgrowth_timer =
                (self.buildings[b_idx].overgrowth_timer - DT).max(0.0);
            self.buildings[b_idx].invisibility_timer =
                (self.buildings[b_idx].invisibility_timer - DT).max(0.0);
            self.buildings[b_idx].rage_timer = (self.buildings[b_idx].rage_timer - DT).max(0.0);
            self.buildings[b_idx].slow_timer = (self.buildings[b_idx].slow_timer - DT).max(0.0);
            self.buildings[b_idx].spell_cooldown =
                (self.buildings[b_idx].spell_cooldown - DT).max(0.0);

            let spec = get_building_spec(self.buildings[b_idx].building_id);

            // Hot Candle melt timer runs once an attacker troop is deployed
            if let DefenseSpecial::HotCandle {
                first_decay_sec,
                second_decay_sec,
                ..
            } = spec.special
            {
                if any_attacker_deployed {
                    self.buildings[b_idx].candle_melt_timer += DT;
                }
                let t = self.buildings[b_idx].candle_melt_timer;
                self.buildings[b_idx].candle_stage = if t < first_decay_sec {
                    1
                } else if t < second_decay_sec {
                    2
                } else {
                    3
                };
            }

            if self.buildings[b_idx].freeze_timer > 0.0
                || self.buildings[b_idx].stun_timer > 0.0
                || self.buildings[b_idx].overgrowth_timer > 0.0
            {
                self.buildings[b_idx].inferno_ramp_sec = 0.0;
                continue;
            }

            let bx = self.buildings[b_idx].center_x;
            let by = self.buildings[b_idx].center_y;

            // Builder's Hut passive repair of nearest damaged building within 7 tiles
            if let DefenseSpecial::BuilderRepair {
                repair_hps,
                repair_range,
            } = spec.special
            {
                let mut damaged_idx: Option<usize> = None;
                for (oi, ob) in self.buildings.iter().enumerate() {
                    if !ob.destroyed
                        && ob.hp < ob.max_hp
                        && dist(bx, by, ob.center_x, ob.center_y) <= repair_range
                    {
                        damaged_idx = Some(oi);
                        break;
                    }
                }
                if let Some(di) = damaged_idx {
                    self.buildings[di].hp =
                        (self.buildings[di].hp + repair_hps * DT).min(self.buildings[di].max_hp);
                }
            }

            // Hidden Tesla reveal check
            if let DefenseSpecial::HiddenTesla { trigger_range } = spec.special {
                if !self.buildings[b_idx].is_hidden_tesla_revealed {
                    if pct >= 51
                        || self.units.iter().any(|u| {
                            u.alive
                                && u.team == Team::Attacker
                                && !u.is_burrowed
                                && dist(bx, by, u.x, u.y) <= trigger_range
                        })
                    {
                        self.buildings[b_idx].is_hidden_tesla_revealed = true;
                    } else {
                        continue;
                    }
                }
            }

            // Revenge Tower stage check (dormant if < 5 buildings destroyed)
            if matches!(spec.special, DefenseSpecial::RevengeStages) && destroyed_count < 5 {
                continue;
            }

            // Spell Tower cast check (authentic 4-spell mechanics: Rage, Poison, Invisibility, Earthquake)
            if let DefenseSpecial::SpellCaster { .. } = spec.special {
                if self.buildings[b_idx].spell_cooldown <= 0.0 {
                    let mode = self.buildings[b_idx].mode;
                    match mode {
                        DefenseMode::SpellTowerRage => {
                            // 9-tile trigger range, ~1.2s activation delay, 70s reload, casts on self
                            let has_enemy = self.units.iter().any(|u| {
                                u.alive
                                    && u.team == Team::Attacker
                                    && !u.is_burrowed
                                    && dist(bx, by, u.x, u.y) <= 9.0
                            });
                            if has_enemy {
                                self.buildings[b_idx].spell_trigger_timer += DT;
                                if self.buildings[b_idx].spell_trigger_timer >= 1.2 {
                                    self.buildings[b_idx].spell_trigger_timer = 0.0;
                                    self.buildings[b_idx].spell_cooldown = 70.0;
                                    spell_casts.push((SpellId::Rage, bx, by));
                                }
                            } else {
                                self.buildings[b_idx].spell_trigger_timer = 0.0;
                            }
                        }
                        DefenseMode::SpellTowerInvisibility => {
                            // 4.5-tile trigger & spell radius, 50s reload, casts immediately on self
                            let triggered = self.units.iter().any(|u| {
                                u.alive
                                    && u.team == Team::Attacker
                                    && !u.is_burrowed
                                    && dist(bx, by, u.x, u.y) <= 4.5
                            }) || self.buildings.iter().any(|ob| {
                                !ob.destroyed
                                    && ob.hp < ob.max_hp
                                    && dist(bx, by, ob.center_x, ob.center_y) <= 4.5
                            });
                            if triggered {
                                self.buildings[b_idx].spell_cooldown = 50.0;
                                spell_casts.push((SpellId::Invisibility, bx, by));
                            }
                        }
                        DefenseMode::SpellTowerEarthquake => {
                            // 9-tile trigger range, Ground units ONLY, 50s reload, throws EQ vial at ground unit
                            if let Some(u) = self.units.iter().find(|u| {
                                u.alive
                                    && u.team == Team::Attacker
                                    && !u.is_air
                                    && !u.is_burrowed
                                    && dist(bx, by, u.x, u.y) <= 9.0
                            }) {
                                self.buildings[b_idx].spell_cooldown = 50.0;
                                new_projectiles.push((
                                    ProjectileKind::SpellVial,
                                    Team::Defender,
                                    bx,
                                    by,
                                    u.x,
                                    u.y,
                                    TargetRef::Unit(u.id),
                                    false,
                                    11.0,
                                    2.4,
                                    0.0,
                                    4.7,
                                    TargetDomain::Ground,
                                    "#a16207",
                                    ProjectilePayload::CastDefenderSpell {
                                        spell_id: SpellId::Earthquake,
                                        radius: 4.7,
                                        duration_sec: 0.1,
                                    },
                                ));
                            }
                        }
                        _ => {
                            // Poison Spell Tower: 9-tile trigger range (Ground & Air), 70s reload, throws Poison vial
                            if let Some(u) = self.units.iter().find(|u| {
                                u.alive
                                    && u.team == Team::Attacker
                                    && !u.is_burrowed
                                    && dist(bx, by, u.x, u.y) <= 9.0
                            }) {
                                self.buildings[b_idx].spell_cooldown = 70.0;
                                new_projectiles.push((
                                    ProjectileKind::SpellVial,
                                    Team::Defender,
                                    bx,
                                    by,
                                    u.x,
                                    u.y,
                                    TargetRef::Unit(u.id),
                                    false,
                                    9.5,
                                    2.8,
                                    0.0,
                                    5.0,
                                    TargetDomain::GroundAndAir,
                                    "#ea580c",
                                    ProjectilePayload::CastDefenderSpell {
                                        spell_id: SpellId::Poison,
                                        radius: 5.0,
                                        duration_sec: 12.0,
                                    },
                                ));
                            }
                        }
                    }
                }
                continue;
            }

            if spec.attack_speed_sec <= 0.0
                && !matches!(spec.special, DefenseSpecial::AirSweeper { .. })
            {
                continue;
            }

            // Mode adjustments for range and target domain
            let mode = self.buildings[b_idx].mode;
            let (min_r, max_r, domain, base_atk_speed, mut base_dph) = match (spec.id, mode) {
                (BuildingId::XBow, DefenseMode::XBowGround) => {
                    (0.0, 14.0, TargetDomain::Ground, 0.2, 49.0)
                }
                (BuildingId::MultiGearTower, DefenseMode::MultiGearFastAttack) => {
                    // buildings.csv Multi Gear Tower L3: AltAttackRange 800, AltAttackSpeed 350, AltDPS 710
                    (0.0, 8.0, TargetDomain::GroundAndAir, 0.35, 248.5)
                }
                (BuildingId::InfernoTower, DefenseMode::InfernoSingle) => {
                    (0.0, 9.0, TargetDomain::GroundAndAir, 0.2, 31.0)
                }
                (BuildingId::RevengeTower, _) => {
                    // special_abilities.csv DebrisTowerTier1..4 L2:
                    // Tier 2 (5..25 destroyed): 1.2s, 500 dmg
                    // Tier 3 (25..50 destroyed): 0.6s, 250 dmg (1 bounce)
                    // Tier 4 (50+ destroyed): 0.35s, 250 dmg (2 bounces)
                    if destroyed_count >= 50 {
                        (0.0, 11.0, TargetDomain::GroundAndAir, 0.35, 250.0)
                    } else if destroyed_count >= 25 {
                        (0.0, 11.0, TargetDomain::GroundAndAir, 0.60, 250.0)
                    } else {
                        (0.0, 11.0, TargetDomain::GroundAndAir, 1.20, 500.0)
                    }
                }
                _ => (
                    spec.min_range,
                    spec.max_range,
                    spec.target_domain,
                    spec.attack_speed_sec,
                    spec.damage_per_shot,
                ),
            };

            if self.buildings[b_idx].rage_timer > 0.0 {
                base_dph *= 1.60;
            }

            let speed_factor = if self.buildings[b_idx].slow_timer > 0.0 {
                0.5
            } else {
                1.0
            };
            self.buildings[b_idx].attack_cooldown -= DT * speed_factor;

            let cone_arc = match spec.special {
                DefenseSpecial::AirSweeper { arc_deg, .. } => Some(arc_deg),
                DefenseSpecial::DirectionalPierce { arc_deg, .. } => Some(arc_deg),
                _ => None,
            };
            let b_dir = self.buildings[b_idx].direction_deg;

            // Find valid targets in [min_r .. max_r] (and within directional cone for AirSweeper & Firespitter)
            let mut valid_targets: Vec<(usize, u32, f32)> = self
                .units
                .iter()
                .enumerate()
                .filter(|(_, u)| {
                    u.alive
                        && u.team == Team::Attacker
                        && !u.is_burrowed
                        && u.invisibility_timer <= 0.0
                        && (domain.can_hit(u.is_air) || matches!(u.kind, UnitKind::Totem))
                })
                .filter_map(|(ui, u)| {
                    let d = dist(bx, by, u.x, u.y);
                    if d >= min_r && d <= max_r {
                        if let Some(arc) = cone_arc {
                            if !is_within_cone(bx, by, u.x, u.y, b_dir, arc) {
                                return None;
                            }
                        }
                        Some((ui, u.id, d))
                    } else {
                        None
                    }
                })
                .collect();

            if valid_targets.is_empty() {
                self.buildings[b_idx].current_target = None;
                self.buildings[b_idx].inferno_ramp_sec = 0.0;
                continue;
            }

            valid_targets.sort_by(|a, b| a.2.partial_cmp(&b.2).unwrap());

            // Keep existing target if still valid, else lock onto closest
            let primary_tuple = if let Some(cur_id) = self.buildings[b_idx].current_target {
                valid_targets
                    .iter()
                    .copied()
                    .find(|(_, id, _)| *id == cur_id)
                    .unwrap_or_else(|| {
                        self.buildings[b_idx].inferno_ramp_sec = 0.0;
                        valid_targets[0]
                    })
            } else {
                self.buildings[b_idx].inferno_ramp_sec = 0.0;
                valid_targets[0]
            };

            self.buildings[b_idx].current_target = Some(primary_tuple.1);
            if mode == DefenseMode::InfernoSingle {
                self.buildings[b_idx].inferno_ramp_sec += DT * speed_factor;
            }

            if self.buildings[b_idx].attack_cooldown > 0.0 {
                continue;
            }
            self.buildings[b_idx].attack_cooldown = base_atk_speed;

            let (p_ui, p_uid, _) = primary_tuple;
            let tx = self.units[p_ui].x;
            let ty = self.units[p_ui].y;

            match &spec.special {
                DefenseSpecial::AirSweeper { push_tiles, .. } => {
                    for &(ui, _, _) in &valid_targets {
                        let dx = self.units[ui].x - bx;
                        let dy = self.units[ui].y - by;
                        let len = (dx * dx + dy * dy).sqrt().max(0.1);
                        self.units[ui].x =
                            (self.units[ui].x + (dx / len) * *push_tiles).clamp(0.5, 49.5);
                        self.units[ui].y =
                            (self.units[ui].y + (dy / len) * *push_tiles).clamp(0.5, 49.5);
                        // PickNewTargetAfterPushback (characters.csv)
                        self.units[ui].waypoints.clear();
                        self.units[ui].repath_timer = 0.0;
                    }
                    let rad = b_dir.to_radians();
                    self.visual_events.push(VisualEvent::Projectile {
                        from_x: bx + rad.cos() * 1.0,
                        from_y: by + rad.sin() * 1.0,
                        to_x: (bx + rad.cos() * 15.0).clamp(0.5, 49.5),
                        to_y: (by + rad.sin() * 15.0).clamp(0.5, 49.5),
                        color: "#bae6fd",
                        splash_radius: 3.5,
                    });
                }
                DefenseSpecial::DirectionalPierce {
                    pierce_count,
                    pierce_radius,
                    extra_range,
                    ..
                } => {
                    // Firespitter (GatlingGunAmmo): Speed 2000 (25.0 t/s), DontTrackTarget=TRUE,
                    // PenetratingProjectile=TRUE, MaxHitObjects=2, PenetratingRadius=50 (0.5t), PenetratingExtraRange=100 (1.0t)
                    let dx = tx - bx;
                    let dy = ty - by;
                    let shot_dist = (dx * dx + dy * dy).sqrt().max(0.1);
                    let dir_x = dx / shot_dist;
                    let dir_y = dy / shot_dist;
                    let end_x = (tx + dir_x * *extra_range).clamp(0.5, 49.5);
                    let end_y = (ty + dir_y * *extra_range).clamp(0.5, 49.5);
                    new_projectiles.push((
                        ProjectileKind::CandleFlame,
                        Team::Defender,
                        bx,
                        by,
                        end_x,
                        end_y,
                        TargetRef::Unit(p_uid),
                        false,
                        25.0,
                        0.2,
                        base_dph,
                        *pierce_radius,
                        TargetDomain::GroundAndAir,
                        "#f97316",
                        ProjectilePayload::PenetratingShot {
                            pierce_count: *pierce_count,
                            pierce_radius: *pierce_radius,
                            pushback_tiles: 0.0,
                        },
                    ));
                }
                DefenseSpecial::RevengeStages => {
                    // RevengeTowerProjectile1..3:
                    // Tier 2 (5..25): Speed 1400 (17.5 t/s), 0 bounces
                    // Tier 3 (25..50): Speed 1800 (22.5 t/s), 1 bounce within 4.5t (60% dmg)
                    // Tier 4 (50+): Speed 2200 (27.5 t/s), 2 bounces within 4.5t (60% dmg)
                    let (speed, bounces) = if destroyed_count >= 50 {
                        (27.5, 2u8)
                    } else if destroyed_count >= 25 {
                        (22.5, 1u8)
                    } else {
                        (17.5, 0u8)
                    };
                    let payload = if bounces > 0 {
                        ProjectilePayload::Ricochet {
                            bounce_range: 4.5,
                            bounce_mult: 0.60,
                            bounces_left: bounces,
                            hit_unit_ids: vec![p_uid],
                        }
                    } else {
                        ProjectilePayload::Standard
                    };
                    new_projectiles.push((
                        ProjectileKind::EnergyBolt,
                        Team::Defender,
                        bx,
                        by,
                        tx,
                        ty,
                        TargetRef::Unit(p_uid),
                        true,
                        speed,
                        0.3,
                        base_dph,
                        0.0,
                        TargetDomain::GroundAndAir,
                        "#c084fc",
                        payload,
                    ));
                }
                DefenseSpecial::HotCandle {
                    stage1_flames,
                    stage2_flames,
                    stage3_flames,
                    ..
                } => {
                    let stage = self.buildings[b_idx].candle_stage;
                    let total_flames = match stage {
                        1 => *stage1_flames,
                        2 => *stage2_flames,
                        _ => *stage3_flames,
                    }
                    .max(1);
                    let target_count = valid_targets.len();
                    for shot_idx in 0..total_flames {
                        let (target_ui, target_uid, _) = valid_targets[shot_idx % target_count];
                        let ux = self.units[target_ui].x;
                        let uy = self.units[target_ui].y;
                        let angle = (shot_idx as f32 / total_flames as f32) * std::f32::consts::TAU;
                        let ox = angle.cos() * 0.35;
                        let oy = angle.sin() * 0.35;
                        new_projectiles.push((
                            ProjectileKind::CandleFlame,
                            Team::Defender,
                            bx + ox,
                            by + oy,
                            ux,
                            uy,
                            TargetRef::Unit(target_uid),
                            true,
                            14.5,
                            0.6,
                            base_dph,
                            0.0,
                            TargetDomain::GroundAndAir,
                            "#fb923c",
                            ProjectilePayload::Standard,
                        ));
                    }
                }
                DefenseSpecial::MultiTarget { targets } => {
                    let total_shots = (*targets).max(1);
                    let target_count = valid_targets.len();
                    let archer_offsets = [(-0.4f32, -0.3f32), (0.4f32, -0.3f32), (0.0f32, 0.4f32)];
                    for shot_idx in 0..total_shots {
                        let (target_ui, target_uid, _) = valid_targets[shot_idx % target_count];
                        let ux = self.units[target_ui].x;
                        let uy = self.units[target_ui].y;
                        let (ox, oy) = archer_offsets[shot_idx % archer_offsets.len()];
                        new_projectiles.push((
                            ProjectileKind::Arrow,
                            Team::Defender,
                            bx + ox,
                            by + oy,
                            ux,
                            uy,
                            TargetRef::Unit(target_uid),
                            true,
                            18.0,
                            0.65,
                            base_dph,
                            0.0,
                            TargetDomain::GroundAndAir,
                            "#facc15",
                            ProjectilePayload::Standard,
                        ));
                    }
                }
                DefenseSpecial::Ricochet {
                    bounce_range,
                    bounce_mult,
                } => {
                    new_projectiles.push((
                        ProjectileKind::Cannonball,
                        Team::Defender,
                        bx,
                        by,
                        tx,
                        ty,
                        TargetRef::Unit(p_uid),
                        true,
                        15.0,
                        0.2,
                        base_dph,
                        0.0,
                        TargetDomain::Ground,
                        "#fb923c",
                        ProjectilePayload::Ricochet {
                            bounce_range: *bounce_range,
                            bounce_mult: *bounce_mult,
                            bounces_left: 1,
                            hit_unit_ids: vec![p_uid],
                        },
                    ));
                }
                DefenseSpecial::ChainLightning {
                    max_chains,
                    chain_range,
                    chain_mult,
                } => {
                    self.damage_unit(p_ui, base_dph);
                    self.visual_events.push(VisualEvent::Beam {
                        from_x: bx,
                        from_y: by,
                        to_x: tx,
                        to_y: ty,
                        color: "#38bdf8",
                        width: 2.8,
                    });
                    let mut prev_x = tx;
                    let mut prev_y = ty;
                    let mut hit_indices = vec![p_ui];
                    let chain_dph = base_dph * *chain_mult;
                    let max_c = (*max_chains).min(15);

                    for _ in 0..max_c {
                        let next_target = self
                            .units
                            .iter()
                            .enumerate()
                            .filter_map(|(ui, u)| {
                                if !u.alive
                                    || u.team != Team::Attacker
                                    || u.is_burrowed
                                    || u.invisibility_timer > 0.0
                                    || hit_indices.contains(&ui)
                                {
                                    return None;
                                }
                                let d = dist(prev_x, prev_y, u.x, u.y);
                                if d <= *chain_range {
                                    Some((ui, u.x, u.y, d))
                                } else {
                                    None
                                }
                            })
                            .min_by(|a, b| a.3.partial_cmp(&b.3).unwrap());

                        if let Some((next_ui, nx, ny, _)) = next_target {
                            hit_indices.push(next_ui);
                            self.damage_unit(next_ui, chain_dph);
                            self.visual_events.push(VisualEvent::Beam {
                                from_x: prev_x,
                                from_y: prev_y,
                                to_x: nx,
                                to_y: ny,
                                color: "#38bdf8",
                                width: 2.0,
                            });
                            prev_x = nx;
                            prev_y = ny;
                        } else {
                            break;
                        }
                    }
                }
                DefenseSpecial::ConeSplash {
                    cone_range,
                    cone_damage,
                } => {
                    let dx = tx - bx;
                    let dy = ty - by;
                    let shot_dist = (dx * dx + dy * dy).sqrt().max(0.01);
                    let dir_x = dx / shot_dist;
                    let dir_y = dy / shot_dist;
                    new_projectiles.push((
                        ProjectileKind::ScatterBundle,
                        Team::Defender,
                        bx,
                        by,
                        tx,
                        ty,
                        TargetRef::Unit(p_uid),
                        false,
                        9.5,
                        2.1,
                        base_dph,
                        spec.splash_radius.max(1.2),
                        TargetDomain::GroundAndAir,
                        "#d97706",
                        ProjectilePayload::ConeSplash {
                            cone_range: *cone_range,
                            cone_damage: *cone_damage,
                            dir_x,
                            dir_y,
                        },
                    ));
                }
                DefenseSpecial::InfernoRamp {
                    dps_stage1,
                    dps_stage2,
                    dps_stage3,
                } => {
                    if mode == DefenseMode::InfernoSingle {
                        let ramp = self.buildings[b_idx].inferno_ramp_sec;
                        let dps = if ramp < 1.5 {
                            *dps_stage1
                        } else if ramp < 5.25 {
                            *dps_stage2
                        } else {
                            *dps_stage3
                        };
                        self.damage_unit(p_ui, dps * base_atk_speed);
                        self.visual_events.push(VisualEvent::Beam {
                            from_x: bx,
                            from_y: by,
                            to_x: tx,
                            to_y: ty,
                            color: "#ef4444",
                            width: if ramp >= 5.25 { 4.0 } else { 2.0 },
                        });
                    } else {
                        for &(ui, _, _) in valid_targets.iter().take(6) {
                            let ux = self.units[ui].x;
                            let uy = self.units[ui].y;
                            self.damage_unit(ui, *dps_stage1 * base_atk_speed);
                            self.visual_events.push(VisualEvent::Beam {
                                from_x: bx,
                                from_y: by,
                                to_x: ux,
                                to_y: uy,
                                color: "#f97316",
                                width: 1.5,
                            });
                        }
                    }
                }
                DefenseSpecial::PercentMaxHp { bonus_pct } => {
                    let bonus = self.units[p_ui].max_hp * *bonus_pct;
                    self.damage_unit(p_ui, base_dph + bonus);
                    self.visual_events.push(VisualEvent::Beam {
                        from_x: bx,
                        from_y: by,
                        to_x: tx,
                        to_y: ty,
                        color: "#a855f7",
                        width: 3.0,
                    });
                }
                DefenseSpecial::HiddenTesla { .. } => {
                    self.damage_unit(p_ui, base_dph);
                    self.visual_events.push(VisualEvent::Beam {
                        from_x: bx,
                        from_y: by,
                        to_x: tx,
                        to_y: ty,
                        color: "#38bdf8",
                        width: 2.2,
                    });
                }
                _ => {
                    let (p_kind, homing, speed, arc_h, color) = match spec.id {
                        BuildingId::Mortar => {
                            (ProjectileKind::MortarShell, false, 6.25, 3.6, "#fb923c")
                        }
                        BuildingId::BombTower => {
                            (ProjectileKind::MortarShell, false, 10.0, 1.8, "#f97316")
                        }
                        BuildingId::WizardTower => {
                            (ProjectileKind::WizardFireball, true, 11.25, 0.5, "#a855f7")
                        }
                        BuildingId::AirDefense => {
                            (ProjectileKind::Rocket, true, 10.0, 0.8, "#ef4444")
                        }
                        BuildingId::Cannon => {
                            (ProjectileKind::Cannonball, true, 15.0, 0.2, "#94a3b8")
                        }
                        BuildingId::XBow => (ProjectileKind::Arrow, true, 31.25, 0.2, "#e879f9"),
                        BuildingId::Firespitter => {
                            (ProjectileKind::CandleFlame, false, 10.0, 0.3, "#f97316")
                        }
                        BuildingId::RevengeTower => {
                            (ProjectileKind::EnergyBolt, true, 15.0, 0.4, "#c084fc")
                        }
                        BuildingId::MultiGearTower => {
                            (ProjectileKind::Cannonball, true, 15.0, 0.3, "#facc15")
                        }
                        _ => (ProjectileKind::Arrow, true, 22.5, 0.5, "#facc15"),
                    };
                    let eff_domain = if spec.splash_radius > 0.0 && self.units[p_ui].is_air {
                        TargetDomain::Air
                    } else if spec.splash_radius > 0.0 {
                        TargetDomain::Ground
                    } else {
                        domain
                    };
                    new_projectiles.push((
                        p_kind,
                        Team::Defender,
                        bx,
                        by,
                        tx,
                        ty,
                        TargetRef::Unit(p_uid),
                        homing,
                        speed,
                        arc_h,
                        base_dph,
                        spec.splash_radius,
                        eff_domain,
                        color,
                        ProjectilePayload::Standard,
                    ));
                }
            }
        }

        for (sid, sx, sy) in spell_casts {
            self.cast_spell(sid, Team::Defender, sx, sy);
        }
        for (
            kind,
            team,
            fx,
            fy,
            tx,
            ty,
            tref,
            homing,
            speed,
            arc_h,
            dmg,
            splash,
            dom,
            col,
            payload,
        ) in new_projectiles
        {
            self.spawn_projectile(
                kind, team, fx, fy, tx, ty, tref, homing, speed, arc_h, dmg, splash, dom, col,
                payload,
            );
        }
    }

    fn update_units(&mut self) {
        // Precompute wall HP ratio grid (0.0 if no wall or under active Jump Spell)
        let mut wall_grid = [[0.0f32; 50]; 50];
        let mut wall_idx_grid = [[None::<usize>; 50]; 50];
        for (wi, w) in self.walls.iter().enumerate() {
            if !w.destroyed {
                wall_grid[w.tile_y as usize][w.tile_x as usize] = (w.hp / w.max_hp).max(0.05);
                wall_idx_grid[w.tile_y as usize][w.tile_x as usize] = Some(wi);
            }
        }
        for z in &self.spells {
            if z.spell_id == SpellId::Jump {
                for y in 0..50 {
                    for x in 0..50 {
                        if dist(z.x, z.y, x as f32 + 0.5, y as f32 + 0.5) <= z.radius {
                            wall_grid[y][x] = 0.0;
                        }
                    }
                }
            }
        }

        let mut pending_spawns: Vec<(TroopId, Team, f32, f32)> = Vec::new();
        let unit_count = self.units.len();

        for u_idx in 0..unit_count {
            if !self.units[u_idx].alive {
                continue;
            }

            // Lifetime decay (Clones, Totems, Siege Barracks, Furnace, Druid evolution)
            if self.units[u_idx].kind == UnitKind::Totem {
                // characters.csv Totem: LoseHpPerTick=167, LoseHpInterval=500 -> 334.0 HP/s
                self.units[u_idx].hp -= 334.0 * DT;
                if self.units[u_idx].hp <= 0.0 {
                    let dead_id = self.units[u_idx].id;
                    self.units[u_idx].hp = 0.0;
                    self.units[u_idx].alive = false;
                    self.clear_references_to_dead_unit(dead_id);
                    continue;
                }
            }
            if let Some(rem) = self.units[u_idx].lifetime_remaining {
                let next_rem = rem - DT;
                self.units[u_idx].lifetime_remaining = Some(next_rem);
                if next_rem <= 0.0 {
                    let dead_id = self.units[u_idx].id;
                    let kind = self.units[u_idx].kind;
                    let ux = self.units[u_idx].x;
                    let uy = self.units[u_idx].y;
                    let team = self.units[u_idx].team;
                    self.units[u_idx].hp = 0.0;
                    self.units[u_idx].alive = false;
                    self.clear_references_to_dead_unit(dead_id);
                    if kind == UnitKind::Troop(TroopId::Druid) {
                        pending_spawns.push((TroopId::DruidBear, team, ux, uy));
                    } else if self.active_siege_unit_id == Some(dead_id) {
                        self.release_attacker_cc(ux, uy);
                    }
                    continue;
                }
            }

            // Decrement status timers
            self.units[u_idx].freeze_timer = (self.units[u_idx].freeze_timer - DT).max(0.0);
            self.units[u_idx].stun_timer = (self.units[u_idx].stun_timer - DT).max(0.0);
            self.units[u_idx].invisibility_timer =
                (self.units[u_idx].invisibility_timer - DT).max(0.0);
            self.units[u_idx].invincibility_timer =
                (self.units[u_idx].invincibility_timer - DT).max(0.0);
            self.units[u_idx].rage_timer = (self.units[u_idx].rage_timer - DT).max(0.0);
            self.units[u_idx].haste_timer = (self.units[u_idx].haste_timer - DT).max(0.0);
            self.units[u_idx].damage_shield_timer =
                (self.units[u_idx].damage_shield_timer - DT).max(0.0);
            // Equipment rage boosts / invis flat damage are valid only while
            // their timers are live - clear them so a later Rage/invisibility
            // spell falls back to the plain x2.90 spell multiplier.
            if self.units[u_idx].rage_timer == 0.0 && self.units[u_idx].rage_boost_mult > 0.0 {
                self.units[u_idx].rage_boost_mult = 0.0;
                self.units[u_idx].rage_speed_bonus = 0.0;
            }
            if self.units[u_idx].haste_timer == 0.0 && self.units[u_idx].attack_speed_mult != 1.0 {
                self.units[u_idx].attack_speed_mult = 1.0;
            }
            if self.units[u_idx].invincibility_timer > 0.0
                && self.units[u_idx].damage_shield_timer > 0.0
            {
                self.units[u_idx].damage_shield_protection = 0.0;
            }
            self.units[u_idx].poison_timer = (self.units[u_idx].poison_timer - DT).max(0.0);
            self.units[u_idx].slow_timer = (self.units[u_idx].slow_timer - DT).max(0.0);
            self.units[u_idx].repath_timer = (self.units[u_idx].repath_timer - DT).max(0.0);
            self.units[u_idx].special_timer += DT;

            if self.units[u_idx].freeze_timer > 0.0 || self.units[u_idx].stun_timer > 0.0 {
                continue;
            }

            let kind = self.units[u_idx].kind;
            let ux = self.units[u_idx].x;
            let uy = self.units[u_idx].y;
            let team = self.units[u_idx].team;

            // Periodic special behaviors (Electro Titan Aura, Grand Warden Life Aura, Hero Equipment Passives, Witch Summons, Furnace, Siege Barracks)
            if let Some(eq_pair) = self.units[u_idx].equipped_items {
                if eq_pair.contains(&EquipmentId::FireHeart) {
                    self.units[u_idx].hp =
                        (self.units[u_idx].hp + 150.0 * DT).min(self.units[u_idx].max_hp); // DragonCrownRegeneration L7: 150
                }
                if eq_pair.contains(&EquipmentId::ElectroBoots) {
                    self.units[u_idx].hp =
                        (self.units[u_idx].hp + 45.0 * DT).min(self.units[u_idx].max_hp);
                    for b_idx in 0..self.buildings.len() {
                        if !self.buildings[b_idx].destroyed
                            && self.buildings[b_idx].overgrowth_timer <= 0.0
                            && dist(
                                ux,
                                uy,
                                self.buildings[b_idx].center_x,
                                self.buildings[b_idx].center_y,
                            ) <= 4.5 // Electro Boots Aura L10: Radius 450
                        {
                            self.damage_building(b_idx, 200.0 * DT); // 80 per 400ms = 200 DPS
                        }
                    }
                }
                if eq_pair.contains(&EquipmentId::GiantGauntlet)
                    || eq_pair.contains(&EquipmentId::ActionFigure)
                    || eq_pair.contains(&EquipmentId::HealerPuppet)
                {
                    self.units[u_idx].hp =
                        (self.units[u_idx].hp + 40.0 * DT).min(self.units[u_idx].max_hp);
                }
                if eq_pair.contains(&EquipmentId::RageGem) {
                    for o_idx in 0..unit_count {
                        if o_idx != u_idx
                            && self.units[o_idx].alive
                            && self.units[o_idx].team == Team::Attacker
                            && !self.units[o_idx].is_siege_machine()
                            && self.units[o_idx].kind != UnitKind::Totem
                            && dist(ux, uy, self.units[o_idx].x, self.units[o_idx].y) <= 9.0
                        {
                            // Rage Gem Aura (spells.csv): +50% damage boost, 0 speed boost. Does not override full Rage spell (mult 2.90).
                            if self.units[o_idx].rage_timer <= 0.0 || self.units[o_idx].rage_boost_mult <= 1.50 {
                                self.units[o_idx].rage_timer = self.units[o_idx].rage_timer.max(0.3);
                                self.units[o_idx].rage_boost_mult = 1.50;
                                self.units[o_idx].rage_speed_bonus = 0.0;
                            }
                        }
                    }
                }
                if eq_pair.contains(&EquipmentId::MeteorStaff)
                    && self.units[u_idx].special_timer >= 5.0
                {
                    self.units[u_idx].special_timer = 0.0;
                    if let Some((bi, _)) = self
                        .buildings
                        .iter()
                        .enumerate()
                        .filter(|(_, b)| !b.destroyed && b.category == BuildingCategory::Defense)
                        .map(|(i, b)| (i, dist(ux, uy, b.center_x, b.center_y)))
                        .min_by(|a, b| a.1.partial_cmp(&b.1).unwrap())
                    {
                        let mx = self.buildings[bi].center_x;
                        let my = self.buildings[bi].center_y;
                        self.damage_building(bi, 850.0);
                        self.visual_events.push(VisualEvent::Explosion {
                            x: mx,
                            y: my,
                            radius: 2.2,
                            color: "#a855f7",
                        });
                    }
                }
            }
            // Apprentice Warden Life Aura (+26% effective HP to friendly troops within 7.0 tiles)
            if kind == UnitKind::Troop(TroopId::ApprenticeWarden) {
                for o_idx in 0..unit_count {
                    if o_idx != u_idx
                        && self.units[o_idx].alive
                        && self.units[o_idx].team == team
                        && dist(ux, uy, self.units[o_idx].x, self.units[o_idx].y) <= 7.0
                    {
                        let is_warden_or_siege = matches!(self.units[o_idx].kind, UnitKind::Troop(TroopId::ApprenticeWarden) | UnitKind::Totem)
                            || match self.units[o_idx].kind {
                                UnitKind::Troop(tid) => matches!(get_troop_spec(tid).category, TroopCategory::SiegeMachine),
                                _ => false,
                            };
                        if !is_warden_or_siege {
                            self.units[o_idx].life_aura_timer = 0.25;
                        }
                    }
                }
            }
            if kind == UnitKind::Hero(HeroId::GrandWarden) && team == Team::Attacker {
                // Grand Warden Life Gem passive aura (+120% HP up to +1200 HP cap, plus passive aura sustain)
                for o_idx in 0..unit_count {
                    if o_idx != u_idx
                        && self.units[o_idx].alive
                        && self.units[o_idx].team == Team::Attacker
                        && dist(ux, uy, self.units[o_idx].x, self.units[o_idx].y) <= 9.0
                    {
                        self.units[o_idx].hp =
                            (self.units[o_idx].hp + 45.0 * DT).min(self.units[o_idx].max_hp);
                    }
                }
            }
            // Pet behaviours (Spirit Fox cloaking, Diggy burrow-stun, Frosty
            // and Sneezy summons) exactly as they behave on live servers.
            if let UnitKind::Pet(pid) = kind {
                match pid {
                    PetId::SpiritFox => {
                        if self.units[u_idx].special_timer >= 10.0 {
                            self.units[u_idx].special_timer = 0.0;
                            self.units[u_idx].invisibility_timer = 4.0;
                            if let Some(hid) = self.units[u_idx].paired_hero_id {
                                if let Some(pos) =
                                    self.units.iter().position(|u| u.id == hid && u.alive)
                                {
                                    self.units[pos].invisibility_timer = 4.0;
                                }
                            }
                        }
                    }
                    PetId::Diggy => {
                        if self.units[u_idx].special_timer >= 4.0 {
                            self.units[u_idx].special_timer = 0.0;
                            if let TargetRef::Building(bi) = self.units[u_idx].target {
                                if !self.buildings[bi].destroyed {
                                    self.buildings[bi].stun_timer =
                                        self.buildings[bi].stun_timer.max(3.5);
                                }
                            }
                        }
                    }
                    PetId::Frosty => {
                        if self.units[u_idx].special_timer >= 6.0 {
                            self.units[u_idx].special_timer = 0.0;
                            pending_spawns.push((TroopId::Frostmite, team, ux + 0.6, uy + 0.6));
                        }
                    }
                    PetId::Sneezy => {
                        if self.units[u_idx].special_timer >= 8.0 {
                            self.units[u_idx].special_timer = 0.0;
                            pending_spawns.push((TroopId::Booger, team, ux + 0.6, uy + 0.6));
                        }
                    }
                    _ => {}
                }
            }

            if let UnitKind::Troop(tid) = kind {
                let tspec = get_troop_spec(tid);
                match tspec.special {
                    TroopSpecial::ElectricAura { radius, dps } => {
                        for b_idx in 0..self.buildings.len() {
                            if !self.buildings[b_idx].destroyed
                                && self.buildings[b_idx].overgrowth_timer <= 0.0
                                && dist(
                                    ux,
                                    uy,
                                    self.buildings[b_idx].center_x,
                                    self.buildings[b_idx].center_y,
                                ) <= radius
                            {
                                self.damage_building(b_idx, dps * DT);
                            }
                        }
                        for oi in 0..self.units.len() {
                            if self.units[oi].alive
                                && self.units[oi].team != team
                                && !self.units[oi].is_burrowed
                                && dist(ux, uy, self.units[oi].x, self.units[oi].y) <= radius
                            {
                                self.damage_unit(oi, dps * DT);
                            }
                        }
                    }
                    TroopSpecial::DruidEvolution { .. } => {
                        if self.units[u_idx].lifetime_remaining.map_or(false, |lt| lt <= 0.0) {
                            self.units[u_idx].alive = false;
                            pending_spawns.push((TroopId::DruidBear, team, ux, uy));
                            continue;
                        }
                    }
                    TroopSpecial::PeriodicSummoner {
                        unit,
                        count,
                        interval_sec,
                        ..
                    } => {
                        if self.units[u_idx].special_timer >= interval_sec {
                            self.units[u_idx].special_timer = 0.0;
                            for _ in 0..count {
                                pending_spawns.push((unit, team, ux + 0.5, uy + 0.5));
                            }
                        }
                    }
                    TroopSpecial::FurnaceSpawner { interval_sec, .. } => {
                        // Furnace L4: 1800 HP, 60s lifetime, spawns up to 22 Firemites (BunkerTroopCount1=22)
                        // Decays ~27 HP/s so untouched it finishes with ~10% HP buffer before expiring at 60s.
                        self.units[u_idx].hp = (self.units[u_idx].hp - 27.0 * DT).max(1.0);
                        if self.units[u_idx].special_timer >= interval_sec
                            && self.units[u_idx].spawned_children_count < 22
                        {
                            self.units[u_idx].special_timer = 0.0;
                            self.units[u_idx].spawned_children_count += 1;
                            pending_spawns.push((TroopId::Firemite, team, ux, uy));
                        }
                    }
                    TroopSpecial::SiegeSpawner { .. } => {
                        if self.units[u_idx].special_timer >= 3.0
                            && self.units[u_idx].spawned_children_count < 14
                        {
                            self.units[u_idx].special_timer = 0.0;
                            self.units[u_idx].spawned_children_count += 1;
                            let spawn_tid = if self.units[u_idx].spawned_children_count <= 2 {
                                TroopId::Pekka
                            } else {
                                TroopId::Wizard
                            };
                            pending_spawns.push((spawn_tid, team, ux + 0.6, uy + 0.6));
                        }
                    }
                    TroopSpecial::SiegeWallMultiplier {
                        hp_decay_per_sec, ..
                    } => {
                        if hp_decay_per_sec > 0.0 {
                            self.units[u_idx].hp -= hp_decay_per_sec * DT;
                            if self.units[u_idx].hp <= 0.0 {
                                let dead_id = self.units[u_idx].id;
                                self.units[u_idx].hp = 0.0;
                                self.units[u_idx].alive = false;
                                self.clear_references_to_dead_unit(dead_id);
                                if self.active_siege_unit_id == Some(dead_id) {
                                    self.release_attacker_cc(ux, uy);
                                }
                                continue;
                            }
                        }
                    }
                    _ => {}
                }
            }

            // Siege Machine Town Hall contact auto-pop & flight bombs
            if matches!(
                kind,
                UnitKind::Troop(TroopId::WallWrecker | TroopId::BattleBlimp | TroopId::LogLauncher)
            ) {
                if let Some(th_idx) = self
                    .buildings
                    .iter()
                    .position(|b| !b.destroyed && b.building_id == BuildingId::TownHall)
                {
                    if building_edge_dist(&self.buildings[th_idx], ux, uy) <= 1.5 {
                        let dead_id = self.units[u_idx].id;
                        self.units[u_idx].hp = 0.0;
                        self.units[u_idx].alive = false;
                        self.clear_references_to_dead_unit(dead_id);
                        self.release_attacker_cc(ux, uy);
                        if kind == UnitKind::Troop(TroopId::BattleBlimp) {
                            self.damage_building(th_idx, 1200.0);
                            self.visual_events.push(VisualEvent::Explosion {
                                x: ux,
                                y: uy,
                                radius: 2.0,
                                color: "#ef4444",
                            });
                        }
                        continue;
                    }
                }
            }
            // Log Launcher (characters.csv):
            // - PreferredMovementTarget = Town Hall, CanAttackWhileMoving = TRUE
            // - Moves straight toward the Town Hall while launching RollingLog every 3.0s
            // - Point-blank contact (<= 1.2t) deals Damage2 = 3600 (4x vs Wall) to clear path
            if kind == UnitKind::Troop(TroopId::LogLauncher) {
                let th_opt = self
                    .buildings
                    .iter()
                    .enumerate()
                    .find(|(_, b)| b.building_id == BuildingId::TownHall)
                    .map(|(bi, b)| (bi, b.center_x, b.center_y, b.destroyed));
                let (th_x, th_y) = match th_opt {
                    Some((bi, cx, cy, destroyed)) => {
                        if !destroyed {
                            self.units[u_idx].target = TargetRef::Building(bi);
                        }
                        (cx, cy)
                    }
                    None => (25.0, 25.0),
                };

                let slow_mult = if self.units[u_idx].poison_timer > 0.0
                    || self.units[u_idx].slow_timer > 0.0
                {
                    0.55
                } else {
                    1.0
                };

                let dx = th_x - ux;
                let dy = th_y - uy;
                let dist_to_th = (dx * dx + dy * dy).sqrt();
                if dist_to_th > 1.2 {
                    let eff_speed = self.units[u_idx].move_speed * 0.125 * slow_mult;
                    let step_dist = eff_speed * DT;
                    let nx = (ux + (dx / dist_to_th) * step_dist).clamp(0.5, 49.5);
                    let ny = (uy + (dy / dist_to_th) * step_dist).clamp(0.5, 49.5);
                    self.units[u_idx].x = nx;
                    self.units[u_idx].y = ny;
                }

                self.units[u_idx].attack_cooldown -=
                    DT * slow_mult * self.units[u_idx].attack_speed_mult;
                if self.units[u_idx].attack_cooldown <= 0.0 {
                    self.units[u_idx].attack_cooldown = self.units[u_idx].attack_speed_sec;
                    self.execute_unit_attack(u_idx, th_x, th_y);
                }
                continue;
            }
            if kind == UnitKind::Troop(TroopId::BattleBlimp) {
                self.units[u_idx].special_timer += DT;
                if self.units[u_idx].special_timer >= 1.5 {
                    self.units[u_idx].special_timer = 0.0;
                    for bi in 0..self.buildings.len() {
                        if !self.buildings[bi].destroyed && building_edge_dist(&self.buildings[bi], ux, uy) <= 1.5 {
                            self.damage_building(bi, 450.0);
                            self.visual_events.push(VisualEvent::Explosion {
                                x: ux,
                                y: uy,
                                radius: 1.5,
                                color: "#f97316",
                            });
                            break;
                        }
                    }
                }
            }
            if kind == UnitKind::Pet(PetId::AngryJelly) {
                self.units[u_idx].special_timer += DT;
                if self.units[u_idx].special_timer >= 35.0 {
                    if let Some(hid) = self.units[u_idx].paired_hero_id {
                        if let Some(h) = self.units.iter_mut().find(|u| u.id == hid) {
                            h.preferred_target = PreferredTarget::Any;
                        }
                    }
                    self.units[u_idx].alive = false;
                    continue;
                }
            }

            if matches!(self.units[u_idx].movement, MovementMode::Stationary) {
                continue;
            }

            // Target Selection & Validation
            // globals.csv: CHAR_VS_CHAR_RADIUS_FOR_ATTACKER = 7, ALLIANCE_ALERT_RADIUS = 700 (7.0t)
            // Attacking units that can engage defending units (PreferredTarget::Any or Heroes)
            // immediately interrupt building/wall targets when a defending CC troop or hero
            // enters their alert radius.
            let pref = self.units[u_idx].preferred_target;
            let domain = self.units[u_idx].target_domain;
            let defender_alert_interrupt = team == Team::Attacker
                && !matches!(self.units[u_idx].target, TargetRef::Unit(_))
                && matches!(pref, PreferredTarget::Any | PreferredTarget::Heroes)
                && self.units.iter().any(|o| {
                    if !o.alive
                        || o.team != Team::Defender
                        || o.is_burrowed
                        || o.invisibility_timer > 0.0
                        || !domain.can_hit(o.is_air)
                    {
                        return false;
                    }
                    let d = dist(ux, uy, o.x, o.y);
                    if pref == PreferredTarget::Heroes && matches!(o.kind, UnitKind::Hero(_)) {
                        d <= 50.0
                    } else {
                        d <= 7.0
                    }
                });

            let needs_target = defender_alert_interrupt
                || match self.units[u_idx].target {
                    TargetRef::None => true,
                    TargetRef::Building(bi) => {
                        self.buildings[bi].destroyed
                            || self.buildings[bi].overgrowth_timer > 0.0
                            || self.buildings[bi].invisibility_timer > 0.0
                            || (self.units[u_idx].repath_timer <= 0.0
                                && building_edge_dist(&self.buildings[bi], ux, uy)
                                    > self.units[u_idx].range)
                    }
                    TargetRef::Wall(wi) => {
                        self.walls[wi].destroyed
                            || self.units[u_idx].repath_timer <= 0.0
                            || (self.units[u_idx].range > 1.25
                                && self.units[u_idx].kind
                                    != UnitKind::Troop(TroopId::WallWrecker)
                                && self.has_valid_building_in_range(u_idx))
                    }
                    TargetRef::Unit(uid) => !self.units.iter().any(|o| {
                        o.id == uid && o.alive && o.invisibility_timer <= 0.0 && !o.is_burrowed
                    }),
                };

            if needs_target {
                self.units[u_idx].repath_timer = 3.0;
                self.select_target_for_unit(u_idx, &wall_grid, &wall_idx_grid);
            }

            let Some((tx, ty, target_radius)) =
                self.get_target_coords_from(ux, uy, self.units[u_idx].target)
            else {
                continue;
            };

            let d_to_target = (dist(ux, uy, tx, ty) - target_radius).max(0.0);
            let slow_mult = if self.units[u_idx].poison_timer > 0.0
                || self.units[u_idx].slow_timer > 0.0
            {
                0.55
            } else {
                1.0
            };

            if d_to_target > self.units[u_idx].range {
                // Move toward next waypoint or target
                self.units[u_idx].is_burrowed =
                    matches!(self.units[u_idx].movement, MovementMode::Burrow);
                let (wx, wy) = self
                    .units[u_idx]
                    .waypoints
                    .first()
                    .copied()
                    .unwrap_or((tx, ty));
                let dx = wx - ux;
                let dy = wy - uy;
                let len = (dx * dx + dy * dy).sqrt();
                let mut eff_speed = self.units[u_idx].move_speed * 0.125; // CoC speed 16 = 2.0 tiles/sec
                if self.units[u_idx].rage_timer > 0.0 {
                    // Rage spell: SpeedBoost 32 raw units = +4.0 tiles/s
                    // (equipment rage may raise it, e.g. Rage Vial +4.8).
                    // Rage Gem aura provides +0 speed boost.
                    let equip_bonus = self.units[u_idx].rage_speed_bonus;
                    if !(self.units[u_idx].rage_boost_mult == 1.50 && equip_bonus == 0.0) {
                        eff_speed += if equip_bonus > 0.0 { equip_bonus } else { 4.0 };
                    }
                }
                if self.units[u_idx].haste_timer > 0.0 {
                    eff_speed += 7.0; // Haste/Healing-Tome speed family: SpeedBoost 56 = +7 tiles/s
                }
                if self.units[u_idx].kind == UnitKind::Troop(TroopId::BabyDragon)
                    && self.unit_is_isolated(u_idx, 4.5, true)
                {
                    eff_speed *= 1.5;
                }
                if matches!(kind, UnitKind::Troop(TroopId::InfernoDragon | TroopId::SuperMiner)) {
                    self.units[u_idx].inferno_ramp_sec = 0.0;
                }
                eff_speed *= slow_mult;

                let step_dist = eff_speed * DT;
                if len <= step_dist.max(0.2) {
                    self.units[u_idx].x = wx.clamp(0.5, 49.5);
                    self.units[u_idx].y = wy.clamp(0.5, 49.5);
                    if !self.units[u_idx].waypoints.is_empty() {
                        self.units[u_idx].waypoints.remove(0);
                    }
                } else {
                    self.units[u_idx].x = (ux + (dx / len) * step_dist).clamp(0.5, 49.5);
                    self.units[u_idx].y = (uy + (dy / len) * step_dist).clamp(0.5, 49.5);
                }

                // Root Rider / Mighty Yak wall crushing on contact (opens 3x3 breach)
                if let MovementMode::WallCrusher { wall_dps } = self.units[u_idx].movement {
                    let cur_tx = (self.units[u_idx].x.floor() as i32).clamp(1, 48);
                    let cur_ty = (self.units[u_idx].y.floor() as i32).clamp(1, 48);
                    for dy in -1..=1 {
                        for dx in -1..=1 {
                            let gx = (cur_tx + dx) as usize;
                            let gy = (cur_ty + dy) as usize;
                            if let Some(wi) = wall_idx_grid[gy][gx] {
                                self.walls[wi].hp -= (wall_dps as f32) * DT;
                                if self.walls[wi].hp <= 0.0 {
                                    self.walls[wi].hp = 0.0;
                                    self.walls[wi].destroyed = true;
                                    wall_grid[gy][gx] = 0.0;
                                    wall_idx_grid[gy][gx] = None;
                                    self.invalidate_pathing();
                                } else if wall_grid[gy][gx] > 0.0 {
                                    wall_grid[gy][gx] =
                                        (self.walls[wi].hp / self.walls[wi].max_hp).max(0.05);
                                }
                            }
                        }
                    }
                }
            } else {
                // In range -> Attack or Heal!
                if kind == UnitKind::Troop(TroopId::BattleDrill) && self.units[u_idx].is_burrowed {
                    for bi in 0..self.buildings.len() {
                        if !self.buildings[bi].destroyed
                            && dist(ux, uy, self.buildings[bi].center_x, self.buildings[bi].center_y) <= 2.5
                        {
                            self.buildings[bi].stun_timer = self.buildings[bi].stun_timer.max(2.0);
                        }
                    }
                    self.visual_events.push(VisualEvent::Explosion {
                        x: ux,
                        y: uy,
                        radius: 2.5,
                        color: "#eab308",
                    });
                }
                self.units[u_idx].is_burrowed = false;
                if matches!(kind, UnitKind::Troop(TroopId::InfernoDragon | TroopId::SuperMiner)) {
                    self.units[u_idx].inferno_ramp_sec += DT;
                }
                // Dragon Duke Royal Rampage and Baby Dragon Tantrum: +50% attack speed while isolated
                let is_baby_dragon_isolated = self.units[u_idx].kind == UnitKind::Troop(TroopId::BabyDragon)
                    && self.unit_is_isolated(u_idx, 4.5, true);
                let is_dragon_duke_isolated = self.units[u_idx].kind == UnitKind::Hero(HeroId::DragonDuke)
                    && self.unit_is_isolated(u_idx, 7.5, false);
                let rampage_mult = if is_dragon_duke_isolated || is_baby_dragon_isolated {
                    1.5
                } else {
                    1.0
                };
                self.units[u_idx].attack_cooldown -=
                    DT * slow_mult * self.units[u_idx].attack_speed_mult * rampage_mult;
                if self.units[u_idx].attack_cooldown <= 0.0 {
                    self.units[u_idx].attack_cooldown = self.units[u_idx].attack_speed_sec;
                    let attacked_wall = matches!(self.units[u_idx].target, TargetRef::Wall(_));
                    self.execute_unit_attack(u_idx, tx, ty);
                    if attacked_wall {
                        for (wi, w) in self.walls.iter().enumerate() {
                            let wx = w.tile_x as usize;
                            let wy = w.tile_y as usize;
                            if w.destroyed {
                                wall_grid[wy][wx] = 0.0;
                                wall_idx_grid[wy][wx] = None;
                            } else if wall_idx_grid[wy][wx] == Some(wi) && wall_grid[wy][wx] > 0.0 {
                                wall_grid[wy][wx] = (w.hp / w.max_hp).max(0.05);
                            }
                        }
                    }
                }
            }
        }

        for (tid, team, sx, sy) in pending_spawns {
            self.spawn_troop_unit(tid, team, sx, sy, None);
        }
    }

    /// Forces every ground unit to re-evaluate its route the moment a wall
    /// opens, so the whole army funnels through the new breach.
    fn invalidate_pathing(&mut self) {
        for u in &mut self.units {
            if !u.alive {
                continue;
            }
            if matches!(
                u.movement,
                MovementMode::Ground | MovementMode::JumpWalls | MovementMode::WallCrusher { .. }
            ) {
                u.repath_timer = 0.0;
            }
        }
    }

    fn select_target_for_unit(
        &mut self,
        u_idx: usize,
        wall_grid: &[[f32; 50]; 50],
        wall_idx_grid: &[[Option<usize>; 50]; 50],
    ) {
        let u = &self.units[u_idx];
        let ux = u.x;
        let uy = u.y;
        let team = u.team;
        let pref = u.preferred_target;
        let domain = u.target_domain;

        // Impassable terrain: every live building footprint
        let mut blocked = [[false; 50]; 50];
        for ob in &self.buildings {
            if ob.destroyed {
                continue;
            }
            if ob.building_id == BuildingId::HiddenTesla && !ob.is_hidden_tesla_revealed {
                continue;
            }
            for dy in 0..ob.footprint {
                for dx in 0..ob.footprint {
                    let gx2 = ob.tile_x as usize + dx as usize;
                    let gy2 = ob.tile_y as usize + dy as usize;
                    if gx2 < 50 && gy2 < 50 {
                        blocked[gy2][gx2] = true;
                    }
                }
            }
        }

        // 1. Healer / Druid / Unicorn -> escort allies, never attack buildings.
        //    Unicorn prioritizes its paired Hero while alive (TID_PET_ABILITY_INFO_UNIPONY);
        //    otherwise injured allies take priority, then the nearest friendly unit.
        if matches!(pref, PreferredTarget::AlliedGround | PreferredTarget::AlliedAny) {
            if let Some(hid) = u.paired_hero_id {
                if self
                    .units
                    .iter()
                    .any(|o| o.id == hid && o.alive && !o.is_burrowed)
                {
                    self.units[u_idx].target = TargetRef::Unit(hid);
                    self.units[u_idx].waypoints.clear();
                    return;
                }
            }
            let mut best_injured: Option<(u32, f32)> = None;
            let mut best_group: Option<(u32, f32)> = None;
            for o in &self.units {
                if !o.alive || o.team != team || o.id == u.id || o.is_burrowed {
                    continue;
                }
                if pref == PreferredTarget::AlliedGround && o.is_air {
                    continue;
                }
                if matches!(o.kind, UnitKind::Totem | UnitKind::Troop(TroopId::Furnace)) || o.is_immune_to_healing() {
                    continue;
                }
                let d = dist(ux, uy, o.x, o.y);
                if o.hp < o.max_hp
                    && best_injured.map_or(true, |(_, bd)| d < bd)
                {
                    best_injured = Some((o.id, d));
                }
                if best_group.map_or(true, |(_, bd)| d < bd) {
                    best_group = Some((o.id, d));
                }
            }
            if let Some((aid, _)) = best_injured.or(best_group) {
                self.units[u_idx].target = TargetRef::Unit(aid);
                self.units[u_idx].waypoints.clear();
            } else {
                self.units[u_idx].target = TargetRef::None;
                self.units[u_idx].waypoints.clear();
            }
            return;
        }

        // 2. Defending units -> Target nearest valid attacking unit
        if team == Team::Defender {
            let max_anchor_r = match u.kind {
                UnitKind::Troop(TroopId::GuardianLongshot) => 19.0, // AlertRadius 1900
                UnitKind::Troop(TroopId::GuardianSmasher) => 14.0,  // AlertRadius 1400
                _ => 15.0,                                          // AlertRadius 1500
            };
            let mut best_enemy: Option<(u32, f32)> = None;
            for o in &self.units {
                if o.alive
                    && o.team == Team::Attacker
                    && !o.is_burrowed
                    && o.invisibility_timer <= 0.0
                    && domain.can_hit(o.is_air)
                {
                    if let Some((ax, ay)) = u.anchor_pos {
                        if dist(ax, ay, o.x, o.y) > max_anchor_r {
                            continue;
                        }
                    }
                    let d = dist(ux, uy, o.x, o.y);
                    if best_enemy.map_or(true, |(_, bd)| d < bd) {
                        best_enemy = Some((o.id, d));
                    }
                }
            }
            if let Some((eid, _)) = best_enemy {
                self.units[u_idx].target = TargetRef::Unit(eid);
                self.units[u_idx].waypoints.clear();
            }
            return;
        }

        // 3. Attacking units: check nearby defending units within 7 tiles
        //    (globals.csv: CHAR_VS_CHAR_RADIUS_FOR_ATTACKER = 7, ALLIANCE_ALERT_RADIUS = 700),
        //    or anywhere on the map for Headhunter vs Defending Heroes (PreferHeroes = TRUE).
        if !matches!(
            pref,
            PreferredTarget::Defenses
                | PreferredTarget::Resources
                | PreferredTarget::Walls
                | PreferredTarget::AirDefenses
                | PreferredTarget::TownHall
        ) {
            if pref == PreferredTarget::Heroes {
                let mut nearest_hero: Option<(u32, f32)> = None;
                for o in &self.units {
                    if o.alive
                        && o.team == Team::Defender
                        && o.invisibility_timer <= 0.0
                        && !o.is_burrowed
                        && domain.can_hit(o.is_air)
                        && matches!(o.kind, UnitKind::Hero(_))
                    {
                        let d = dist(ux, uy, o.x, o.y);
                        if nearest_hero.map_or(true, |(_, bd)| d < bd) {
                            nearest_hero = Some((o.id, d));
                        }
                    }
                }
                if let Some((h_id, _)) = nearest_hero {
                    self.units[u_idx].target = TargetRef::Unit(h_id);
                    self.units[u_idx].waypoints.clear();
                    return;
                }
            }

            let mut nearest_def_unit: Option<(u32, f32)> = None;
            for o in &self.units {
                if o.alive
                    && o.team == Team::Defender
                    && o.invisibility_timer <= 0.0
                    && !o.is_burrowed
                    && domain.can_hit(o.is_air)
                {
                    let d = dist(ux, uy, o.x, o.y);
                    if d <= 7.0 && nearest_def_unit.map_or(true, |(_, bd)| d < bd) {
                        nearest_def_unit = Some((o.id, d));
                    }
                }
            }
            if let Some((du_id, _)) = nearest_def_unit {
                self.units[u_idx].target = TargetRef::Unit(du_id);
                self.units[u_idx].waypoints.clear();
                return;
            }
        }

        // 3b. FightWithGroups AI (characters.csv / heroes.csv):
        //     Grand Warden & Apprentice Warden follow the highest-weight friendly cluster
        //     within 13 tiles (TargetGroupsRange=1300, TargetGroupsRadius=500, TargetGroupsMinWeight=1000 -> 10 housing).
        if matches!(
            u.kind,
            UnitKind::Hero(HeroId::GrandWarden) | UnitKind::Troop(TroopId::ApprenticeWarden)
        ) && pref == PreferredTarget::Any
        {
            let uid_self = u.id;
            let mut best_group_target: Option<(TargetRef, u32)> = None;
            for ally in &self.units {
                if !ally.alive
                    || ally.team != Team::Attacker
                    || ally.id == uid_self
                    || matches!(
                        ally.kind,
                        UnitKind::Hero(HeroId::GrandWarden)
                            | UnitKind::Troop(TroopId::ApprenticeWarden | TroopId::Healer | TroopId::Druid)
                            | UnitKind::Totem
                    )
                {
                    continue;
                }
                let valid_ally_target = match ally.target {
                    TargetRef::Building(bi) => {
                        !self.buildings[bi].destroyed
                            && self.buildings[bi].overgrowth_timer <= 0.0
                            && self.buildings[bi].invisibility_timer <= 0.0
                    }
                    TargetRef::Unit(tid) => self.units.iter().any(|o| {
                        o.id == tid
                            && o.alive
                            && o.invisibility_timer <= 0.0
                            && domain.can_hit(o.is_air)
                    }),
                    _ => false,
                };
                if !valid_ally_target || dist(ux, uy, ally.x, ally.y) > 13.0 {
                    continue;
                }
                let cluster_weight: u32 = self
                    .units
                    .iter()
                    .filter(|m| {
                        m.alive
                            && m.team == Team::Attacker
                            && m.id != uid_self
                            && dist(ally.x, ally.y, m.x, m.y) <= 5.0
                    })
                    .map(|m| m.housing_space as u32)
                    .sum();
                if cluster_weight >= 10
                    && best_group_target.map_or(true, |(_, bw)| cluster_weight > bw)
                {
                    best_group_target = Some((ally.target, cluster_weight));
                }
            }
            if let Some((grp_target, _)) = best_group_target {
                self.units[u_idx].target = grp_target;
                self.units[u_idx].waypoints.clear();
                return;
            }
        }

        // 4. Wall Breakers run at the wall panel guarding the nearest building
        //    instead of picking an arbitrary isolated wall tile.
        if pref == PreferredTarget::Walls {
            let mut building_anchor: Option<(f32, f32, f32)> = None;
            for b in &self.buildings {
                if b.destroyed || b.overgrowth_timer > 0.0 {
                    continue;
                }
                if b.building_id == BuildingId::HiddenTesla && !b.is_hidden_tesla_revealed {
                    continue;
                }
                let d = building_edge_dist(b, ux, uy);
                if building_anchor.map_or(true, |(_, _, bd)| d < bd) {
                    building_anchor = Some((b.center_x, b.center_y, d));
                }
            }
            let (gx, gy) = match building_anchor {
                Some((bx, by, _)) => (bx, by),
                None => (ux, uy),
            };
            let mut best_wall: Option<(usize, f32)> = None;
            for (wi, w) in self.walls.iter().enumerate() {
                if w.destroyed {
                    continue;
                }
                let wx = w.tile_x as f32 + 0.5;
                let wy = w.tile_y as f32 + 0.5;
                // Distance from the unit plus how well the wall shields the target
                let score = dist(ux, uy, wx, wy) + 0.6 * dist(gx, gy, wx, wy);
                if best_wall.map_or(true, |(_, bs)| score < bs) {
                    best_wall = Some((wi, score));
                }
            }
            if let Some((wi, _)) = best_wall {
                self.units[u_idx].target = TargetRef::Wall(wi);
                self.units[u_idx].waypoints.clear();
                return;
            }
        }

        // 5. Rule of 3 Building Selection
        let mut preferred_candidates: Vec<(usize, f32)> = Vec::new();
        let mut fallback_candidates: Vec<(usize, f32)> = Vec::new();

        for (bi, b) in self.buildings.iter().enumerate() {
            if b.destroyed || b.overgrowth_timer > 0.0 || b.invisibility_timer > 0.0 {
                continue;
            }
            if b.building_id == BuildingId::HiddenTesla && !b.is_hidden_tesla_revealed {
                continue;
            }
            let d = building_edge_dist(b, ux, uy);
            fallback_candidates.push((bi, d));

            let matches_pref = match pref {
                PreferredTarget::Defenses => b.category == BuildingCategory::Defense,
                PreferredTarget::Resources => {
                    b.category == BuildingCategory::Resource || b.building_id == BuildingId::TownHall
                }
                PreferredTarget::AirDefenses => b.building_id == BuildingId::AirDefense,
                PreferredTarget::TownHall => b.building_id == BuildingId::TownHall,
                _ => true,
            };
            if matches_pref {
                preferred_candidates.push((bi, d));
            }
        }

        let mut pool = if !preferred_candidates.is_empty() {
            preferred_candidates
        } else {
            fallback_candidates
        };
        if pool.is_empty() {
            self.units[u_idx].target = TargetRef::None;
            return;
        }
        pool.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

        // Bypass-wall units fly/jump/burrow straight to closest candidate
        if matches!(
            self.units[u_idx].movement,
            MovementMode::Air
                | MovementMode::JumpWalls
                | MovementMode::Burrow
                | MovementMode::WallCrusher { .. }
        ) {
            let best_bi = pool[0].0;
            self.units[u_idx].target = TargetRef::Building(best_bi);
            self.units[u_idx].waypoints.clear();
            return;
        }

        // Ground unit target selection (globals.csv):
        // - TARGET_LIST_SIZE = 3 primary candidates
        // - MAX_TARGET_LIST_SIZE = 6 extended candidates (+5.0 EXTRA_TARGET_PATH_COST_PENALTY)
        // - BLOCKED_ATTACK_POSITION_PENALTY = 6.0 when path requires breaking a wall
        // - PRUNE_ATTACK_POSITION_EVALUATION_PATHS = TRUE
        let u_range = self.units[u_idx].range;
        let can_attack_over_walls =
            u_range > 1.25 && self.units[u_idx].kind != UnitKind::Troop(TroopId::WallWrecker);
        let eff_range = if can_attack_over_walls {
            (u_range - 0.05).max(0.35)
        } else {
            u_range.min(0.95).max(0.35)
        };

        let mut best_choice: Option<(TargetRef, Vec<(f32, f32)>, f32)> = None;
        for (rank, &(bi, d_edge)) in pool.iter().take(6).enumerate() {
            let extra_penalty = if rank >= 3 { 5.0 } else { 0.0 };
            let min_possible_cost =
                (d_edge - eff_range).max(0.0) + extra_penalty + d_edge * 0.05;
            if let Some((_, _, best_c)) = &best_choice {
                if min_possible_cost >= *best_c {
                    continue;
                }
            }

            let b = &self.buildings[bi];
            let path = find_path_to_building(
                ux,
                uy,
                b.tile_x,
                b.tile_y,
                b.footprint,
                u_range,
                can_attack_over_walls,
                wall_grid,
                Some(&blocked),
            );
            let blocked_penalty = if path.blocking_wall_tile.is_some() {
                6.0 // globals.csv: BLOCKED_ATTACK_POSITION_PENALTY = 6
            } else {
                0.0
            };
            let eval_cost =
                path.total_cost + extra_penalty + blocked_penalty + d_edge * 0.05;

            let target_ref = if let Some((wx, wy)) = path.blocking_wall_tile {
                if let Some(wi) = wall_idx_grid[wy as usize][wx as usize] {
                    TargetRef::Wall(wi)
                } else {
                    TargetRef::Building(bi)
                }
            } else {
                TargetRef::Building(bi)
            };
            if best_choice
                .as_ref()
                .map_or(true, |(_, _, best_c)| eval_cost < *best_c)
            {
                best_choice = Some((target_ref, path.waypoints, eval_cost));
            }
        }

        if let Some((tref, wps, _)) = best_choice {
            self.units[u_idx].target = tref;
            self.units[u_idx].waypoints = wps;
        }
    }

    /// Returns true if a ranged ground unit currently has at least one valid
    /// target building within its attack range (matching its `PreferredTarget`
    /// if any preferred buildings remain, or any building otherwise).
    fn has_valid_building_in_range(&self, u_idx: usize) -> bool {
        let u = &self.units[u_idx];
        let ux = u.x;
        let uy = u.y;
        let u_range = u.range;
        let pref = u.preferred_target;

        let mut any_pref_alive = false;
        let mut any_pref_in_range = false;
        let mut any_fallback_in_range = false;

        for b in &self.buildings {
            if b.destroyed || b.overgrowth_timer > 0.0 || b.invisibility_timer > 0.0 {
                continue;
            }
            if b.building_id == BuildingId::HiddenTesla && !b.is_hidden_tesla_revealed {
                continue;
            }
            let in_range = building_edge_dist(b, ux, uy) <= u_range;
            if in_range {
                any_fallback_in_range = true;
            }
            let matches_pref = match pref {
                PreferredTarget::Defenses => b.category == BuildingCategory::Defense,
                PreferredTarget::Resources => {
                    b.category == BuildingCategory::Resource || b.building_id == BuildingId::TownHall
                }
                PreferredTarget::AirDefenses => b.building_id == BuildingId::AirDefense,
                PreferredTarget::TownHall => b.building_id == BuildingId::TownHall,
                _ => true,
            };
            if matches_pref {
                any_pref_alive = true;
                if in_range {
                    any_pref_in_range = true;
                    break;
                }
            }
        }

        if any_pref_alive {
            any_pref_in_range
        } else {
            any_fallback_in_range
        }
    }

    /// Reports the closest point on a building's
    /// footprint to the attacker, matching how Clash of Clans resolves range.
    fn get_target_coords_from(
        &self,
        ux: f32,
        uy: f32,
        target: TargetRef,
    ) -> Option<(f32, f32, f32)> {
        match target {
            TargetRef::None => None,
            TargetRef::Building(bi) => {
                let b = &self.buildings[bi];
                if b.destroyed {
                    None
                } else {
                    let (ex, ey) = building_edge_point(b, ux, uy);
                    Some((ex, ey, 0.0))
                }
            }
            TargetRef::Wall(wi) => {
                let w = &self.walls[wi];
                if w.destroyed {
                    None
                } else {
                    Some((w.tile_x as f32 + 0.5, w.tile_y as f32 + 0.5, 0.4))
                }
            }
            TargetRef::Unit(uid) => self
                .units
                .iter()
                .find(|u| u.id == uid && u.alive)
                .map(|u| (u.x, u.y, 0.3)),
        }
    }

    /// True when the unit has no living ally (optionally air-only) within
    /// `radius` tiles - used by Baby Dragon tantrum and Dragon Duke rampaging.
    fn unit_is_isolated(&self, u_idx: usize, radius: f32, air_only: bool) -> bool {
        let id = self.units[u_idx].id;
        let (ux, uy) = (self.units[u_idx].x, self.units[u_idx].y);
        let team = self.units[u_idx].team;
        !self.units.iter().any(|o| {
            o.alive
                && o.id != id
                && o.team == team
                && (!air_only || o.is_air)
                && dist(ux, uy, o.x, o.y) <= radius
        })
    }

    fn execute_unit_attack(&mut self, u_idx: usize, tx: f32, ty: f32) {
        let ux = self.units[u_idx].x;
        let uy = self.units[u_idx].y;
        let kind = self.units[u_idx].kind;
        let target = self.units[u_idx].target;
        let splash = self.units[u_idx].splash_radius;
        let mut dph = self.units[u_idx].damage_per_hit;

        if self.units[u_idx].rage_timer > 0.0 {
            // Rage spell L7 = DamageBoostPercent 190 = +190% (x2.90 total);
            // hero equipment rage (Rage Vial x2.55, BoostBarbarian x3.2)
            // overrides it through rage_boost_mult.
            let mult = if self.units[u_idx].rage_boost_mult > 1.0 {
                self.units[u_idx].rage_boost_mult
            } else {
                2.90
            };
            dph *= mult;
        }

        // Invisibility Vial L18: +1740 flat damage per hit while cloaked.
        if self.units[u_idx].invisibility_timer > 0.0 && self.units[u_idx].bonus_flat_damage > 0.0
        {
            dph += self.units[u_idx].bonus_flat_damage;
        }

        // Baby Dragon Tantrum & Dragon Duke Royal Rampage check
        if kind == UnitKind::Troop(TroopId::BabyDragon)
            || kind == UnitKind::Hero(HeroId::DragonDuke)
        {
            // Baby Dragon tantrum needs no AIR ally within 4.5 tiles; the Dragon
            // Duke rampage (DragonDukeRageWhenAlone: ActiveWhileAloneRadius 600)
            // triggers with no ally of any kind within 7.5 tiles.
            let (radius, air_only) = match kind {
                UnitKind::Hero(HeroId::DragonDuke) => (7.5f32, false),
                _ => (4.5f32, true),
            };
            if self.unit_is_isolated(u_idx, radius, air_only) {
                dph *= 2.0;
            }
        }

        if let Some(eq_pair) = self.units[u_idx].equipped_items {
            if eq_pair.contains(&EquipmentId::Vampstache) {
                self.units[u_idx].hp = (self.units[u_idx].hp + 300.0).min(self.units[u_idx].max_hp);
            }
            if eq_pair.contains(&EquipmentId::DarkCrown) {
                let dead_allies = self.units.iter().filter(|u| u.team == self.units[u_idx].team && !u.alive).count();
                let total_allies = self.units.iter().filter(|u| u.team == self.units[u_idx].team).count().max(1);
                let fall_ratio = (dead_allies as f32 / total_allies as f32).clamp(0.0, 1.0);
                dph *= 1.0 + 0.35 * fall_ratio;
            }
        }

        // Limited special attacks: Super Minion (8 shots), Rocket Spear (10 shots), Noble Iron (10 shots)
        if self.units[u_idx].limited_special_attacks > 0 {
            self.units[u_idx].limited_special_attacks -= 1;
            if kind == UnitKind::Troop(TroopId::SuperMinion) {
                dph *= 1.35;
                if self.units[u_idx].limited_special_attacks == 0 {
                    self.units[u_idx].range = 3.5;
                    self.units[u_idx].target = TargetRef::None;
                    self.units[u_idx].waypoints.clear();
                }
            } else if matches!(kind, UnitKind::Hero(HeroId::RoyalChampion)) {
                dph += 980.0;
                if self.units[u_idx].limited_special_attacks == 0 {
                    self.units[u_idx].range = 3.0;
                    self.units[u_idx].target = TargetRef::None;
                    self.units[u_idx].waypoints.clear();
                }
            } else if matches!(kind, UnitKind::Hero(HeroId::MinionPrince)) {
                dph += 500.0;
                if self.units[u_idx].limited_special_attacks == 0 {
                    self.units[u_idx].range = 4.0;
                    self.units[u_idx].target = TargetRef::None;
                    self.units[u_idx].waypoints.clear();
                }
            }
        }

        // Inferno Dragon & Super Miner 3-stage ramp up (1x -> 3x -> 15x)
        if matches!(kind, UnitKind::Troop(TroopId::InfernoDragon | TroopId::SuperMiner)) {
            let ramp = self.units[u_idx].inferno_ramp_sec;
            let mult = if ramp >= 3.0 { 15.0 } else if ramp >= 1.5 { 3.0 } else { 1.0 };
            dph *= mult;
            let beam_col = if kind == UnitKind::Troop(TroopId::InfernoDragon) {
                if mult >= 15.0 { "#ef4444" } else if mult >= 3.0 { "#f97316" } else { "#eab308" }
            } else {
                "#38bdf8"
            };
            self.visual_events.push(VisualEvent::Beam {
                from_x: ux,
                from_y: uy,
                to_x: tx,
                to_y: ty,
                color: beam_col,
                width: if mult >= 15.0 { 3.5 } else if mult >= 3.0 { 2.5 } else { 1.5 },
            });
        }

        // Healer / Druid / Unicorn healing pulse
        if matches!(
            self.units[u_idx].preferred_target,
            PreferredTarget::AlliedGround | PreferredTarget::AlliedAny
        ) {
            if let TargetRef::Unit(aid) = target {
                if let Some(ai) = self.units.iter().position(|o| o.id == aid && o.alive) {
                    if self.units[ai].is_immune_to_healing() {
                        return;
                    }
                    let healer_count = if kind == UnitKind::Troop(TroopId::Healer) {
                        self.units.iter().filter(|u| {
                            u.alive && u.team == self.units[u_idx].team
                                && u.kind == UnitKind::Troop(TroopId::Healer)
                                && u.target == TargetRef::Unit(aid)
                        }).count()
                    } else {
                        1
                    };
                    let stack_mult = match healer_count {
                        0 | 1 | 2 => 1.0,
                        3 => 0.90,
                        4 => 0.85,
                        5 => 0.70,
                        6 => 0.50,
                        7 => 0.30,
                        _ => 0.15,
                    };
                    let target_is_hero = matches!(self.units[ai].kind, UnitKind::Hero(_));
                    let primary_mult = (if target_is_hero {
                        if kind == UnitKind::Troop(TroopId::Druid) { 1.05 } else { 0.55 }
                    } else {
                        1.0
                    }) * stack_mult;
                    self.units[ai].hp = (self.units[ai].hp + dph * primary_mult).min(self.units[ai].max_hp);
                    self.visual_events.push(VisualEvent::HealPulse {
                        x: tx,
                        y: ty,
                        radius: splash.max(1.0),
                    });

                    // Healer splash healing (1.5t radius around target friendly unit)
                    if kind == UnitKind::Troop(TroopId::Healer) {
                        let h_splash = splash.max(1.5);
                        for oi in 0..self.units.len() {
                            if oi != ai
                                && self.units[oi].alive
                                && self.units[oi].team == self.units[u_idx].team
                                && !self.units[oi].is_air
                                && !self.units[oi].is_immune_to_healing()
                                && dist(tx, ty, self.units[oi].x, self.units[oi].y) <= h_splash
                            {
                                let is_hero = matches!(self.units[oi].kind, UnitKind::Hero(_));
                                let m = (if is_hero { 0.55 } else { 1.0 }) * stack_mult * 0.5;
                                self.units[oi].hp = (self.units[oi].hp + dph * m).min(self.units[oi].max_hp);
                            }
                        }
                    }

                    // Druid 4-target bounce heal (3 bounces to injured allies within 3.5t)
                    if kind == UnitKind::Troop(TroopId::Druid) {
                        let mut cur_x = tx;
                        let mut cur_y = ty;
                        let mut healed_ids = vec![aid];
                        for _ in 0..3 {
                            let next_ally = self.units.iter().enumerate().find(|(_oi, o)| {
                                o.alive
                                    && o.team == self.units[u_idx].team
                                    && !o.is_immune_to_healing()
                                    && !healed_ids.contains(&o.id)
                                    && o.hp < o.max_hp
                                    && dist(cur_x, cur_y, o.x, o.y) <= 3.5
                            });
                            if let Some((ni, _)) = next_ally {
                                let n_is_hero = matches!(self.units[ni].kind, UnitKind::Hero(_));
                                let m = if n_is_hero { 1.05 } else { 1.0 };
                                self.units[ni].hp = (self.units[ni].hp + dph * m).min(self.units[ni].max_hp);
                                let nx = self.units[ni].x;
                                let ny = self.units[ni].y;
                                self.visual_events.push(VisualEvent::Beam {
                                    from_x: cur_x,
                                    from_y: cur_y,
                                    to_x: nx,
                                    to_y: ny,
                                    color: "#4ade80",
                                    width: 2.0,
                                });
                                healed_ids.push(self.units[ni].id);
                                cur_x = nx;
                                cur_y = ny;
                            } else {
                                break;
                            }
                        }
                    }
                }
            }
            return;
        }

        // Super Archer penetrating arrow (pierces in a 12.0t line beyond the target)
        if kind == UnitKind::Troop(TroopId::SuperArcher) {
            let dx = tx - ux;
            let dy = ty - uy;
            let len = (dx * dx + dy * dy).sqrt().max(0.01);
            let dir_x = dx / len;
            let dir_y = dy / len;
            let total_reach = len + 12.0;
            let end_x = (ux + dir_x * total_reach).clamp(0.5, 49.5);
            let end_y = (uy + dir_y * total_reach).clamp(0.5, 49.5);

            for bi in 0..self.buildings.len() {
                if self.buildings[bi].destroyed || self.buildings[bi].overgrowth_timer > 0.0 {
                    continue;
                }
                let bx = self.buildings[bi].center_x - ux;
                let by = self.buildings[bi].center_y - uy;
                let proj = bx * dir_x + by * dir_y;
                if proj >= 0.0 && proj <= total_reach + 1.0 {
                    let perp = (bx - proj * dir_x).hypot(by - proj * dir_y);
                    if perp <= 1.4 {
                        self.damage_building(bi, dph);
                    }
                }
            }
            for oi in 0..self.units.len() {
                if self.units[oi].alive && self.units[oi].team != self.units[u_idx].team && !self.units[oi].is_burrowed {
                    let vx = self.units[oi].x - ux;
                    let vy = self.units[oi].y - uy;
                    let proj = vx * dir_x + vy * dir_y;
                    if proj >= 0.0 && proj <= total_reach + 0.5 {
                        let perp = (vx - proj * dir_x).hypot(vy - proj * dir_y);
                        if perp <= 1.0 {
                            self.damage_unit(oi, dph);
                        }
                    }
                }
            }
            self.visual_events.push(VisualEvent::Beam {
                from_x: ux,
                from_y: uy,
                to_x: end_x,
                to_y: end_y,
                color: "#ec4899",
                width: 2.5,
            });
            return;
        }

        // Chain lightning: Electro Dragon (5 targets, decay 0.80) & Super Wizard (10 targets, decay 0.40)
        if matches!(kind, UnitKind::Troop(TroopId::ElectroDragon | TroopId::SuperWizard)) {
            let (max_targets, decay, chain_color) = if kind == UnitKind::Troop(TroopId::ElectroDragon) {
                (5, 0.80f32, "#38bdf8")
            } else {
                (10, 0.40f32, "#f59e0b")
            };
            let mut chain_dph = dph;
            let mut cur_x = tx;
            let mut cur_y = ty;
            let mut hit_b = Vec::new();
            for _ in 0..max_targets {
                let mut next_b: Option<(usize, f32)> = None;
                for (bi, b) in self.buildings.iter().enumerate() {
                    if !b.destroyed
                        && b.overgrowth_timer <= 0.0
                        && !hit_b.contains(&bi)
                        && dist(cur_x, cur_y, b.center_x, b.center_y) <= 3.5
                    {
                        let d = dist(cur_x, cur_y, b.center_x, b.center_y);
                        if next_b.map_or(true, |(_, bd)| d < bd) {
                            next_b = Some((bi, d));
                        }
                    }
                }
                if let Some((bi, _)) = next_b {
                    let bx = self.buildings[bi].center_x;
                    let by = self.buildings[bi].center_y;
                    self.damage_building(bi, chain_dph);
                    self.visual_events.push(VisualEvent::Beam {
                        from_x: cur_x,
                        from_y: cur_y,
                        to_x: bx,
                        to_y: by,
                        color: chain_color,
                        width: 2.5,
                    });
                    hit_b.push(bi);
                    cur_x = bx;
                    cur_y = by;
                    chain_dph *= decay;
                } else {
                    break;
                }
            }
            return;
        }

        let team = self.units[u_idx].team;
        let domain = self.units[u_idx].target_domain;

        // Firemite / Fire Spirit (characters.csv Firemite Spawn L4 + projectiles.csv FireSpiritJump4 + spells.csv FireSpiritBurn L4):
        // Jumps onto its target from 2.0t range, suicides on launch (AttackCount = 1), deals 80 initial splash damage
        // in 0.8t radius, and ignites a 10.0s FireSpiritBurn zone (150 DPS).
        if kind == UnitKind::Troop(TroopId::Firemite) {
            let dead_id = self.units[u_idx].id;
            self.units[u_idx].hp = 0.0;
            self.units[u_idx].alive = false;
            self.clear_references_to_dead_unit(dead_id);
            self.spawn_projectile(
                ProjectileKind::FlameSpirit,
                team,
                ux,
                uy,
                tx,
                ty,
                target,
                false,
                5.0,
                1.2,
                dph,
                0.8,
                TargetDomain::GroundAndAir,
                "#f97316",
                ProjectilePayload::FireSpiritBurn {
                    burn_dps: 150.0,
                    duration_sec: 10.0,
                    radius: 0.8,
                },
            );
            return;
        }

        // Log Launcher (characters.csv L6 + projectiles.csv RollingLog):
        // Throws a RollingLog 20.0 tiles toward the Town Hall (AttackRange 100 + PenetratingExtraRange 1900 = 2000),
        // Speed 420 (5.25 t/s), PenetratingRadius 120 (1.2t), hitting every building and wall in its path (4x wall mult).
        if kind == UnitKind::Troop(TroopId::LogLauncher) {
            let dx = tx - ux;
            let dy = ty - uy;
            let dist_len = (dx * dx + dy * dy).sqrt().max(0.01);
            let dir_x = dx / dist_len;
            let dir_y = dy / dist_len;
            let end_x = (ux + dir_x * 20.0).clamp(0.5, 49.5);
            let end_y = (uy + dir_y * 20.0).clamp(0.5, 49.5);
            self.spawn_projectile(
                ProjectileKind::Log,
                team,
                ux,
                uy,
                end_x,
                end_y,
                target,
                false,
                5.25,
                0.0,
                dph,
                1.2,
                TargetDomain::Ground,
                "#a16207",
                ProjectilePayload::RollingLog {
                    wall_mult: 4.0,
                    pierce_radius: 1.2,
                    hit_building_indices: Vec::new(),
                    hit_wall_indices: Vec::new(),
                    hit_unit_ids: Vec::new(),
                },
            );

            // Point-blank secondary contact strike (characters.csv Damage2 = 3600, 4x vs Wall):
            // Only triggered on attack (every 3.0s) to clear walls / obstacles right in front of the machine (<= 1.2t).
            let mut wall_broken = false;
            for w in &mut self.walls {
                if !w.destroyed
                    && dist(ux, uy, w.tile_x as f32 + 0.5, w.tile_y as f32 + 0.5) <= 1.2
                {
                    w.hp -= 3600.0 * 4.0;
                    if w.hp <= 0.0 {
                        w.hp = 0.0;
                        w.destroyed = true;
                        wall_broken = true;
                    }
                }
            }
            if wall_broken {
                self.invalidate_pathing();
            }
            for bi in 0..self.buildings.len() {
                if !self.buildings[bi].destroyed
                    && building_edge_dist(&self.buildings[bi], ux, uy) <= 1.0
                {
                    self.damage_building(bi, 3600.0);
                }
            }
            return;
        }

        // Ranged units & heroes spawn real projectiles with travel speed, arc & impact AoE
        // (excluding melee siege rams and kamikaze mites whose range > 1.25 is contact/leap reach).
        let is_ranged_projectile_unit = self.units[u_idx].range > 1.25
            && !matches!(
                kind,
                UnitKind::Troop(TroopId::WallWrecker | TroopId::Yetimite | TroopId::Firemite)
            );
        if is_ranged_projectile_unit {
            let mut mult = 1.0f32;
            if let TargetRef::Building(bi) = target {
                let is_resource_or_th = self.buildings[bi].category == BuildingCategory::Resource
                    || self.buildings[bi].building_id == BuildingId::TownHall;
                if matches!(
                    kind,
                    UnitKind::Troop(TroopId::Goblin | TroopId::SneakyGoblin)
                ) && is_resource_or_th
                {
                    mult = 2.0;
                } else if kind == UnitKind::Pet(PetId::GreedyRaven) && is_resource_or_th {
                    mult = 5.0;
                }
            }

            let dx = tx - ux;
            let dy = ty - uy;
            let dist_len = (dx * dx + dy * dy).sqrt().max(0.01);
            let dir_x = dx / dist_len;
            let dir_y = dy / dist_len;

            let mut payload = ProjectilePayload::Standard;
            if let Some(eq_pair) = self.units[u_idx].equipped_items {
                if eq_pair.contains(&EquipmentId::FrozenArrow) {
                    payload = ProjectilePayload::FrozenArrow;
                } else if eq_pair.contains(&EquipmentId::ElectroFangs) {
                    payload = ProjectilePayload::ElectroFangs;
                }
            }

            let (p_kind, homing, speed, arc_h, color) = match kind {
                UnitKind::Troop(TroopId::Thrower) => {
                    (ProjectileKind::Spear, true, 8.75, 1.3, "#38bdf8")
                }
                UnitKind::Troop(TroopId::Bowler) => {
                    payload = ProjectilePayload::BowlerBounce {
                        bounce_dist: 3.2,
                        dir_x,
                        dir_y,
                    };
                    (ProjectileKind::Boulder, false, 5.94, 1.1, "#a855f7")
                }
                UnitKind::Troop(TroopId::SuperBowler) => {
                    payload = ProjectilePayload::BowlerBounce {
                        bounce_dist: 4.5,
                        dir_x,
                        dir_y,
                    };
                    (ProjectileKind::Boulder, false, 5.94, 1.3, "#c084fc")
                }
                UnitKind::Troop(TroopId::FlameFlinger) => {
                    (ProjectileKind::FlameSpirit, false, 6.25, 3.2, "#ef4444")
                }
                UnitKind::Troop(TroopId::LogLauncher) => {
                    payload = ProjectilePayload::WallBreakerMult { wall_mult: 4.0 };
                    (ProjectileKind::Log, false, 5.25, 0.15, "#a16207")
                }
                UnitKind::Troop(TroopId::GuardianLogger) => {
                    // LoggerProjectile: Speed 420 (5.25 t/s), PenetratingRadius 180 (1.8t),
                    // PenetratingExtraRange 600 (6.0t), Pushback 150 (1.5t)
                    let end_x = (tx + dir_x * 6.0).clamp(0.5, 49.5);
                    let end_y = (ty + dir_y * 6.0).clamp(0.5, 49.5);
                    self.spawn_projectile(
                        ProjectileKind::Log,
                        team,
                        ux,
                        uy,
                        end_x,
                        end_y,
                        target,
                        false,
                        5.25,
                        0.15,
                        dph * mult,
                        1.8,
                        domain,
                        "#a16207",
                        ProjectilePayload::PenetratingShot {
                            pierce_count: 8,
                            pierce_radius: 1.8,
                            pushback_tiles: 1.5,
                        },
                    );
                    return;
                }
                UnitKind::Troop(TroopId::GuardianLongshot) => {
                    (ProjectileKind::WizardFireball, false, 12.5, 1.4, "#fb923c")
                }
                UnitKind::Troop(TroopId::Wizard | TroopId::SuperWizard) => {
                    (ProjectileKind::WizardFireball, true, 6.25, 0.4, "#f97316")
                }
                UnitKind::Troop(TroopId::Dragon | TroopId::SuperDragon) => {
                    (ProjectileKind::WizardFireball, true, 6.25, 0.4, "#f97316")
                }
                UnitKind::Troop(TroopId::BabyDragon) => {
                    (ProjectileKind::WizardFireball, true, 5.94, 0.4, "#f97316")
                }
                UnitKind::Troop(TroopId::Headhunter) => {
                    payload = ProjectilePayload::HeadhunterPoison;
                    (ProjectileKind::Arrow, true, 17.5, 0.35, "#4ade80")
                }
                UnitKind::Hero(HeroId::ArcherQueen) => {
                    (ProjectileKind::Arrow, true, 20.625, 0.4, "#facc15")
                }
                UnitKind::Hero(HeroId::GrandWarden) => {
                    (ProjectileKind::EnergyBolt, true, 16.0, 0.3, "#c084fc")
                }
                UnitKind::Hero(HeroId::RoyalChampion) => {
                    (ProjectileKind::Spear, true, 15.0, 0.7, "#38bdf8")
                }
                UnitKind::Hero(HeroId::DragonDuke) => {
                    (ProjectileKind::WizardFireball, true, 14.0, 0.5, "#f97316")
                }
                UnitKind::Hero(HeroId::MinionPrince) => {
                    (ProjectileKind::EnergyBolt, true, 12.5, 0.4, "#6366f1")
                }
                _ => (ProjectileKind::Arrow, true, 17.5, 0.5, "#34d399"),
            };

            self.spawn_projectile(
                p_kind,
                team,
                ux,
                uy,
                tx,
                ty,
                target,
                homing,
                speed,
                arc_h,
                dph * mult,
                splash,
                domain,
                color,
                payload,
            );
            return;
        }

        match target {
            TargetRef::Building(bi) => {
                let mut mult = 1.0f32;
                let is_resource_or_th = self.buildings[bi].category == BuildingCategory::Resource
                    || self.buildings[bi].building_id == BuildingId::TownHall;
                if matches!(
                    kind,
                    UnitKind::Troop(TroopId::Goblin | TroopId::SneakyGoblin)
                ) && is_resource_or_th
                {
                    mult = 2.0;
                } else if kind == UnitKind::Pet(PetId::GreedyRaven) && is_resource_or_th {
                    mult = 5.0;
                }
                if let Some(eq_pair) = self.units[u_idx].equipped_items {
                    if eq_pair.contains(&EquipmentId::FrozenArrow) {
                        self.buildings[bi].slow_timer = 3.0;
                    }
                    if eq_pair.contains(&EquipmentId::MonolithArrow) {
                        mult += (self.buildings[bi].max_hp * 0.15).min(2500.0) / dph.max(1.0);
                    }
                    if eq_pair.contains(&EquipmentId::ElectroFangs) {
                        for obi in 0..self.buildings.len() {
                            if obi != bi
                                && !self.buildings[obi].destroyed
                                && dist(
                                    tx,
                                    ty,
                                    self.buildings[obi].center_x,
                                    self.buildings[obi].center_y,
                                ) <= 4.0
                            {
                                let obx = self.buildings[obi].center_x;
                                let oby = self.buildings[obi].center_y;
                                self.damage_building(obi, 400.0);
                                self.visual_events.push(VisualEvent::Beam {
                                    from_x: tx,
                                    from_y: ty,
                                    to_x: obx,
                                    to_y: oby,
                                    color: "#38bdf8",
                                    width: 1.8,
                                });
                            }
                        }
                    }
                }
                self.damage_building(bi, dph * mult);

                if splash > 0.0 {
                    for obi in 0..self.buildings.len() {
                        if obi != bi
                            && !self.buildings[obi].destroyed
                            && dist(
                                tx,
                                ty,
                                self.buildings[obi].center_x,
                                self.buildings[obi].center_y,
                            ) <= splash + 1.2
                        {
                            self.damage_building(obi, dph * 0.75);
                        }
                    }
                }
            }
            TargetRef::Wall(wi) => {
                let wall_mult = match kind {
                    UnitKind::Troop(TroopId::WallBreaker) => 40.0,
                    UnitKind::Troop(TroopId::SuperWallBreaker) => 80.0,
                    UnitKind::Troop(TroopId::SuperGiant) => 5.0,
                    UnitKind::Troop(TroopId::WallWrecker) => 10.0,
                    UnitKind::Troop(TroopId::StoneSlammer) => 25.0,
                    UnitKind::Troop(TroopId::LogLauncher) => 4.0,
                    UnitKind::Pet(PetId::MightyYak) => 20.0,
                    _ => 1.0,
                };
                let mut wall_broken = false;
                self.walls[wi].hp -= dph * wall_mult;
                if self.walls[wi].hp <= 0.0 {
                    self.walls[wi].hp = 0.0;
                    self.walls[wi].destroyed = true;
                    wall_broken = true;
                }
                if matches!(
                    kind,
                    UnitKind::Troop(
                        TroopId::WallBreaker
                            | TroopId::SuperWallBreaker
                            | TroopId::Yetimite
                            | TroopId::Firemite
                    )
                ) {
                    // Splash nearby walls too
                    for ow in &mut self.walls {
                        if !ow.destroyed
                            && dist(tx, ty, ow.tile_x as f32 + 0.5, ow.tile_y as f32 + 0.5) <= 2.0
                        {
                            ow.hp -= dph * wall_mult;
                            if ow.hp <= 0.0 {
                                ow.hp = 0.0;
                                ow.destroyed = true;
                                wall_broken = true;
                            }
                        }
                    }
                    self.units[u_idx].hp = 0.0;
                    self.units[u_idx].alive = false;
                }
                if wall_broken {
                    self.invalidate_pathing();
                }
            }
            TargetRef::Unit(uid) => {
                if let Some(ti) = self.units.iter().position(|o| o.id == uid && o.alive) {
                    let mut mult = 1.0f32;
                    if kind == UnitKind::Troop(TroopId::Headhunter)
                        && matches!(self.units[ti].kind, UnitKind::Hero(_))
                    {
                        mult = 4.0;
                        self.units[ti].poison_timer = 3.0;
                    }
                    self.damage_unit(ti, dph * mult);

                    // Melee AoE splash against nearby enemy units (e.g. Guardian Smasher 2.5t, Valkyrie, Electro Titan)
                    if splash > 0.0 {
                        for oi in 0..self.units.len() {
                            if oi != ti
                                && self.units[oi].alive
                                && self.units[oi].team != team
                                && !self.units[oi].is_burrowed
                                && domain.can_hit(self.units[oi].is_air)
                                && dist(tx, ty, self.units[oi].x, self.units[oi].y) <= splash
                            {
                                self.damage_unit(oi, dph * 0.75);
                            }
                        }
                    }
                }
            }
            TargetRef::None => {}
        }
    }

    fn update_projectiles(&mut self) {
        let mut active = std::mem::take(&mut self.projectiles);
        let mut spawned_bounces: Vec<(
            ProjectileKind,
            Team,
            f32,
            f32,
            f32,
            f32,
            TargetRef,
            bool,
            f32,
            f32,
            f32,
            f32,
            TargetDomain,
            &'static str,
            ProjectilePayload,
        )> = Vec::new();
        let mut deferred_spells: Vec<(SpellId, Team, f32, f32)> = Vec::new();

        for p in &mut active {
            if p.homing {
                match p.target {
                    TargetRef::Unit(uid) => {
                        if let Some(u) = self.units.iter().find(|u| u.id == uid && u.alive) {
                            p.target_x = u.x;
                            p.target_y = u.y;
                        }
                    }
                    TargetRef::Building(bi) => {
                        if let Some(b) = self.buildings.get(bi) {
                            if !b.destroyed {
                                let (ex, ey) = building_edge_point(b, p.from_x, p.from_y);
                                p.target_x = ex;
                                p.target_y = ey;
                            }
                        }
                    }
                    TargetRef::Wall(wi) => {
                        if let Some(w) = self.walls.get(wi) {
                            if !w.destroyed {
                                p.target_x = w.tile_x as f32 + 0.5;
                                p.target_y = w.tile_y as f32 + 0.5;
                            }
                        }
                    }
                    TargetRef::None => {}
                }
            }

            let total_d = dist(p.from_x, p.from_y, p.target_x, p.target_y).max(0.25);
            p.total_dist = total_d;
            p.progress += (p.speed * DT) / total_d;
            let t = p.progress.clamp(0.0, 1.0);
            p.x = p.from_x + (p.target_x - p.from_x) * t;
            p.y = p.from_y + (p.target_y - p.from_y) * t;

            // Continuous line-piercing collision for Log Launcher's RollingLog:
            // Damages every building, wall (4x multiplier), and defending ground unit in its 1.2t path as it rolls!
            if let ProjectilePayload::RollingLog {
                wall_mult,
                pierce_radius,
                ref mut hit_building_indices,
                ref mut hit_wall_indices,
                ref mut hit_unit_ids,
            } = p.payload
            {
                let mut wall_broken = false;
                for (wi, w) in self.walls.iter_mut().enumerate() {
                    if !w.destroyed
                        && !hit_wall_indices.contains(&wi)
                        && dist(p.x, p.y, w.tile_x as f32 + 0.5, w.tile_y as f32 + 0.5)
                            <= pierce_radius
                    {
                        hit_wall_indices.push(wi);
                        w.hp -= p.damage * wall_mult;
                        if w.hp <= 0.0 {
                            w.hp = 0.0;
                            w.destroyed = true;
                            wall_broken = true;
                        }
                    }
                }
                if wall_broken {
                    self.invalidate_pathing();
                }

                for bi in 0..self.buildings.len() {
                    if !self.buildings[bi].destroyed
                        && !hit_building_indices.contains(&bi)
                        && building_edge_dist(&self.buildings[bi], p.x, p.y) <= pierce_radius
                    {
                        hit_building_indices.push(bi);
                        self.damage_building(bi, p.damage);
                        self.visual_events.push(VisualEvent::Explosion {
                            x: p.x,
                            y: p.y,
                            radius: 1.0,
                            color: "#a16207",
                        });
                        // MaxHitBuildings = 4 (projectiles.csv RollingLog)
                        if hit_building_indices.len() >= 4 {
                            p.progress = 1.0;
                            break;
                        }
                    }
                }

                for ui in 0..self.units.len() {
                    if self.units[ui].alive
                        && self.units[ui].team != p.team
                        && !self.units[ui].is_air
                        && !self.units[ui].is_burrowed
                        && !hit_unit_ids.contains(&self.units[ui].id)
                        && dist(p.x, p.y, self.units[ui].x, self.units[ui].y) <= pierce_radius
                    {
                        hit_unit_ids.push(self.units[ui].id);
                        self.damage_unit(ui, p.damage);
                    }
                }

                continue;
            }

            if p.progress < 1.0 {
                continue;
            }

            // Projectile has reached its target -> resolve impact!
            let ix = p.target_x;
            let iy = p.target_y;

            if let ProjectilePayload::CastDefenderSpell { spell_id, .. } = p.payload {
                deferred_spells.push((spell_id, Team::Defender, ix, iy));
                continue;
            }

            if let ProjectilePayload::FireSpiritBurn {
                burn_dps,
                duration_sec,
                radius,
            } = p.payload
            {
                // Firemite jump impact: 80 initial splash damage + 10s FireSpiritBurn (150 DPS, 0.8t radius)
                for bi in 0..self.buildings.len() {
                    if !self.buildings[bi].destroyed
                        && building_edge_dist(&self.buildings[bi], ix, iy) <= radius
                    {
                        self.damage_building(bi, p.damage);
                    }
                }
                if let TargetRef::Wall(wi) = p.target {
                    if wi < self.walls.len() && !self.walls[wi].destroyed {
                        self.walls[wi].hp -= p.damage;
                        if self.walls[wi].hp <= 0.0 {
                            self.walls[wi].hp = 0.0;
                            self.walls[wi].destroyed = true;
                            self.invalidate_pathing();
                        }
                    }
                }
                for ui in 0..self.units.len() {
                    if self.units[ui].alive
                        && self.units[ui].team != p.team
                        && !self.units[ui].is_burrowed
                        && dist(ix, iy, self.units[ui].x, self.units[ui].y) <= radius
                    {
                        self.damage_unit(ui, p.damage);
                    }
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x: ix,
                    y: iy,
                    radius,
                    color: "#f97316",
                });
                self.spells.push(ActiveSpellZone {
                    spell_id: SpellId::Poison,
                    team: p.team,
                    x: ix,
                    y: iy,
                    radius,
                    remaining_sec: duration_sec,
                    clone_budget_remaining: 0,
                    processed_unit_ids: Vec::new(),
                    spawn_remaining: 0,
                    spawn_timer: 0.0,
                    fire_dps: burn_dps,
                });
                continue;
            }

            if p.team == Team::Defender {
                // Defender projectile hitting Attacker units
                if let ProjectilePayload::PenetratingShot {
                    pierce_count,
                    pierce_radius,
                    pushback_tiles,
                } = p.payload
                {
                    // Ray from (p.from_x, p.from_y) to (ix, iy): hit up to `pierce_count`
                    // valid Attacker units within `pierce_radius` of the line segment.
                    let rx = ix - p.from_x;
                    let ry = iy - p.from_y;
                    let r_len = (rx * rx + ry * ry).sqrt().max(0.01);
                    let ux = rx / r_len;
                    let uy = ry / r_len;
                    let mut candidates: Vec<(usize, f32)> = self
                        .units
                        .iter()
                        .enumerate()
                        .filter_map(|(u_idx, u)| {
                            if !u.alive
                                || u.team != Team::Attacker
                                || u.is_burrowed
                                || !p.target_domain.can_hit(u.is_air)
                            {
                                return None;
                            }
                            let vx = u.x - p.from_x;
                            let vy = u.y - p.from_y;
                            let proj = vx * ux + vy * uy;
                            if proj < -0.5 || proj > r_len + 0.5 {
                                return None;
                            }
                            let perp = (vx - proj * ux).hypot(vy - proj * uy);
                            if perp <= pierce_radius {
                                Some((u_idx, proj))
                            } else {
                                None
                            }
                        })
                        .collect();
                    candidates.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());
                    for (u_idx, _) in candidates.into_iter().take(pierce_count.max(1)) {
                        self.damage_unit(u_idx, p.damage);
                        if pushback_tiles > 0.0 && self.units[u_idx].alive {
                            self.units[u_idx].x =
                                (self.units[u_idx].x + ux * pushback_tiles).clamp(0.5, 49.5);
                            self.units[u_idx].y =
                                (self.units[u_idx].y + uy * pushback_tiles).clamp(0.5, 49.5);
                        }
                    }
                    continue;
                }

                if p.splash_radius > 0.0 {
                    for u_idx in 0..self.units.len() {
                        if self.units[u_idx].alive
                            && self.units[u_idx].team == Team::Attacker
                            && !self.units[u_idx].is_burrowed
                            && p.target_domain.can_hit(self.units[u_idx].is_air)
                            && dist(ix, iy, self.units[u_idx].x, self.units[u_idx].y)
                                <= p.splash_radius
                        {
                            self.damage_unit(u_idx, p.damage);
                        }
                    }
                    self.visual_events.push(VisualEvent::Explosion {
                        x: ix,
                        y: iy,
                        radius: p.splash_radius,
                        color: p.color,
                    });
                } else if let TargetRef::Unit(uid) = p.target {
                    if let Some(u_idx) = self.units.iter().position(|u| u.id == uid && u.alive) {
                        self.damage_unit(u_idx, p.damage);
                    }
                }

                match &p.payload {
                    ProjectilePayload::Ricochet {
                        bounce_range,
                        bounce_mult,
                        bounces_left,
                        hit_unit_ids,
                    } if *bounces_left > 0 => {
                        let secondary = self
                            .units
                            .iter()
                            .filter_map(|u| {
                                if hit_unit_ids.contains(&u.id)
                                    || !u.alive
                                    || u.team != Team::Attacker
                                    || !p.target_domain.can_hit(u.is_air)
                                    || u.is_burrowed
                                    || u.invisibility_timer > 0.0
                                {
                                    return None;
                                }
                                let d = dist(ix, iy, u.x, u.y);
                                if d <= *bounce_range {
                                    Some((u.id, u.x, u.y, d))
                                } else {
                                    None
                                }
                            })
                            .min_by(|a, b| a.3.partial_cmp(&b.3).unwrap());

                        if let Some((sec_uid, sx, sy, _)) = secondary {
                            let mut next_hits = hit_unit_ids.clone();
                            next_hits.push(sec_uid);
                            let next_payload = if *bounces_left > 1 {
                                ProjectilePayload::Ricochet {
                                    bounce_range: *bounce_range,
                                    bounce_mult: 1.0,
                                    bounces_left: *bounces_left - 1,
                                    hit_unit_ids: next_hits,
                                }
                            } else {
                                ProjectilePayload::Standard
                            };
                            spawned_bounces.push((
                                p.kind,
                                Team::Defender,
                                ix,
                                iy,
                                sx,
                                sy,
                                TargetRef::Unit(sec_uid),
                                true,
                                p.speed,
                                0.3,
                                p.damage * *bounce_mult,
                                0.0,
                                p.target_domain,
                                p.color,
                                next_payload,
                            ));
                        }
                    }
                    ProjectilePayload::ConeSplash {
                        cone_range,
                        cone_damage,
                        dir_x,
                        dir_y,
                    } => {
                        let primary_uid = match p.target {
                            TargetRef::Unit(uid) => Some(uid),
                            _ => None,
                        };
                        for u_idx in 0..self.units.len() {
                            if Some(self.units[u_idx].id) == primary_uid
                                || !self.units[u_idx].alive
                                || self.units[u_idx].team != Team::Attacker
                                || self.units[u_idx].is_burrowed
                                || self.units[u_idx].invisibility_timer > 0.0
                            {
                                continue;
                            }
                            let ux = self.units[u_idx].x - ix;
                            let uy = self.units[u_idx].y - iy;
                            let d = (ux * ux + uy * uy).sqrt();
                            if d <= *cone_range && d > 0.01 {
                                let cos_theta = (ux * *dir_x + uy * *dir_y) / d;
                                if cos_theta >= 0.5 {
                                    self.damage_unit(u_idx, *cone_damage);
                                }
                            }
                        }
                        self.visual_events.push(VisualEvent::Explosion {
                            x: ix + *dir_x * 1.5,
                            y: iy + *dir_y * 1.5,
                            radius: *cone_range * 0.55,
                            color: "#f59e0b",
                        });
                    }
                    _ => {}
                }
            } else {
                // Attacker projectile hitting Defender buildings / walls / units
                match p.target {
                    TargetRef::Building(bi) => {
                        if bi < self.buildings.len() && !self.buildings[bi].destroyed {
                            if matches!(p.payload, ProjectilePayload::FrozenArrow) {
                                self.buildings[bi].slow_timer = 3.0;
                            }
                            if matches!(p.payload, ProjectilePayload::ElectroFangs) {
                                for obi in 0..self.buildings.len() {
                                    if obi != bi
                                        && !self.buildings[obi].destroyed
                                        && dist(
                                            ix,
                                            iy,
                                            self.buildings[obi].center_x,
                                            self.buildings[obi].center_y,
                                        ) <= 4.0
                                    {
                                        let obx = self.buildings[obi].center_x;
                                        let oby = self.buildings[obi].center_y;
                                        self.damage_building(obi, 400.0);
                                        self.visual_events.push(VisualEvent::Beam {
                                            from_x: ix,
                                            from_y: iy,
                                            to_x: obx,
                                            to_y: oby,
                                            color: "#38bdf8",
                                            width: 1.8,
                                        });
                                    }
                                }
                            }
                            self.damage_building(bi, p.damage);
                        }
                        if p.splash_radius > 0.0 {
                            for obi in 0..self.buildings.len() {
                                if Some(obi) == (if let TargetRef::Building(b0) = p.target { Some(b0) } else { None }) {
                                    continue;
                                }
                                if !self.buildings[obi].destroyed
                                    && dist(
                                        ix,
                                        iy,
                                        self.buildings[obi].center_x,
                                        self.buildings[obi].center_y,
                                    ) <= p.splash_radius + 1.2
                                {
                                    self.damage_building(obi, p.damage * 0.75);
                                }
                            }
                            self.visual_events.push(VisualEvent::Explosion {
                                x: ix,
                                y: iy,
                                radius: p.splash_radius.max(0.8),
                                color: p.color,
                            });
                        }
                        if let ProjectilePayload::BowlerBounce {
                            bounce_dist,
                            dir_x,
                            dir_y,
                        } = p.payload
                        {
                            let bx2 = (ix + dir_x * bounce_dist).clamp(1.0, 49.0);
                            let by2 = (iy + dir_y * bounce_dist).clamp(1.0, 49.0);
                            spawned_bounces.push((
                                ProjectileKind::Boulder,
                                Team::Attacker,
                                ix,
                                iy,
                                bx2,
                                by2,
                                TargetRef::None,
                                false,
                                9.5,
                                0.85,
                                p.damage,
                                p.splash_radius.max(1.2),
                                TargetDomain::Ground,
                                p.color,
                                ProjectilePayload::Standard,
                            ));
                        }
                    }
                    TargetRef::Wall(wi) => {
                        let wall_mult = match p.payload {
                            ProjectilePayload::WallBreakerMult { wall_mult } => wall_mult,
                            _ => 1.0,
                        };
                        let mut wall_broken = false;
                        if wi < self.walls.len() && !self.walls[wi].destroyed {
                            self.walls[wi].hp -= p.damage * wall_mult;
                            if self.walls[wi].hp <= 0.0 {
                                self.walls[wi].hp = 0.0;
                                self.walls[wi].destroyed = true;
                                wall_broken = true;
                            }
                        }
                        if p.splash_radius > 0.0 {
                            for ow in &mut self.walls {
                                if !ow.destroyed
                                    && dist(ix, iy, ow.tile_x as f32 + 0.5, ow.tile_y as f32 + 0.5)
                                        <= p.splash_radius
                                {
                                    ow.hp -= p.damage * wall_mult * 0.75;
                                    if ow.hp <= 0.0 {
                                        ow.hp = 0.0;
                                        ow.destroyed = true;
                                        wall_broken = true;
                                    }
                                }
                            }
                        }
                        if wall_broken {
                            self.invalidate_pathing();
                        }
                    }
                    TargetRef::Unit(uid) => {
                        if let Some(ti) = self.units.iter().position(|o| o.id == uid && o.alive) {
                            let mut mult = 1.0f32;
                            if matches!(p.payload, ProjectilePayload::HeadhunterPoison)
                                && matches!(self.units[ti].kind, UnitKind::Hero(_))
                            {
                                mult = 4.0;
                                self.units[ti].poison_timer = 3.0;
                            }
                            self.damage_unit(ti, p.damage * mult);
                        }
                    }
                    TargetRef::None => {
                        // Ballistic ground-targeted projectile (e.g. second Bowler bounce)
                        if p.splash_radius > 0.0 {
                            for obi in 0..self.buildings.len() {
                                if !self.buildings[obi].destroyed
                                    && dist(
                                        ix,
                                        iy,
                                        self.buildings[obi].center_x,
                                        self.buildings[obi].center_y,
                                    ) <= p.splash_radius + 1.4
                                {
                                    self.damage_building(obi, p.damage);
                                }
                            }
                            self.visual_events.push(VisualEvent::Explosion {
                                x: ix,
                                y: iy,
                                radius: p.splash_radius,
                                color: p.color,
                            });
                        }
                    }
                }
            }
        }

        active.retain(|p| p.progress < 1.0);
        self.projectiles = active;

        for (sid, team, sx, sy) in deferred_spells {
            self.cast_spell(sid, team, sx, sy);
        }
        for (
            kind,
            team,
            fx,
            fy,
            tx,
            ty,
            tref,
            homing,
            speed,
            arc_h,
            dmg,
            splash,
            dom,
            col,
            payload,
        ) in spawned_bounces
        {
            self.spawn_projectile(
                kind, team, fx, fy, tx, ty, tref, homing, speed, arc_h, dmg, splash, dom, col,
                payload,
            );
        }
    }

    fn damage_building(&mut self, b_idx: usize, dmg: f32) {
        if self.buildings[b_idx].destroyed || self.buildings[b_idx].overgrowth_timer > 0.0 {
            return;
        }
        let actual = dmg.min(self.buildings[b_idx].hp);
        self.buildings[b_idx].hp -= actual;
        if self.buildings[b_idx].counts_for_destruction {
            self.damage_dealt_total += actual;
        }
        if self.buildings[b_idx].hp <= 0.0 {
            self.buildings[b_idx].hp = 0.0;
            self.buildings[b_idx].destroyed = true;
            let bx = self.buildings[b_idx].center_x;
            let by = self.buildings[b_idx].center_y;

            if self.buildings[b_idx].counts_for_destruction {
                self.destroyed_scorable_buildings += 1;
            }
            if self.buildings[b_idx].building_id == BuildingId::TownHall {
                self.town_hall_destroyed = true;
                // MeleeGuardianOnHomeDeath L1 (special_abilities.csv):
                // Smasher Guardian enrages for +60% damage and +1.5 t/s speed when TH18 dies.
                for u in &mut self.units {
                    if u.alive && u.kind == UnitKind::Troop(TroopId::GuardianSmasher) {
                        u.rage_timer = 180.0;
                        u.rage_boost_mult = 1.60;
                        u.rage_speed_bonus = 1.875;
                    }
                }
            }
            // Spell Tower drops its loaded spell on its own location when destroyed
            if self.buildings[b_idx].building_id == BuildingId::SpellTower
                && self.buildings[b_idx].spell_cooldown <= 0.0
            {
                self.buildings[b_idx].spell_cooldown = 70.0;
                let sid = match self.buildings[b_idx].mode {
                    DefenseMode::SpellTowerRage => SpellId::Rage,
                    DefenseMode::SpellTowerInvisibility => SpellId::Invisibility,
                    DefenseMode::SpellTowerEarthquake => SpellId::Earthquake,
                    _ => SpellId::Poison,
                };
                self.cast_spell(sid, Team::Defender, bx, by);
            }
            // Bomb Tower death bomb
            if let DefenseSpecial::DeathBomb {
                death_damage,
                death_radius,
            } = get_building_spec(self.buildings[b_idx].building_id).special
            {
                for u in &mut self.units {
                    if u.alive
                        && u.team == Team::Attacker
                        && !u.is_air
                        && !u.is_burrowed
                        && u.invincibility_timer <= 0.0
                        && dist(bx, by, u.x, u.y) <= death_radius
                    {
                        u.hp -= death_damage;
                        if u.hp <= 0.0 {
                            u.alive = false;
                        }
                    }
                }
                self.visual_events.push(VisualEvent::Explosion {
                    x: bx,
                    y: by,
                    radius: death_radius,
                    color: "#f97316",
                });
            }
        }
    }

    fn clear_references_to_dead_unit(&mut self, dead_uid: u32) {
        for b in &mut self.buildings {
            if b.current_target == Some(dead_uid) {
                b.current_target = None;
                b.inferno_ramp_sec = 0.0;
            }
        }
        for u in &mut self.units {
            if u.target == TargetRef::Unit(dead_uid) {
                u.target = TargetRef::None;
                u.repath_timer = 0.0;
            }
        }
        self.projectiles
            .retain(|p| !(p.homing && p.target == TargetRef::Unit(dead_uid)));
    }

    pub fn damage_unit(&mut self, u_idx: usize, dmg: f32) {
        if !self.units[u_idx].alive || self.units[u_idx].invincibility_timer > 0.0 {
            return;
        }
        let dmg = if self.units[u_idx].life_aura_timer > 0.0 {
            dmg * (1.0 / 1.26) // +26% effective HP from Apprentice Warden Life Aura
        } else {
            dmg
        };
        // Equipment/Spell-Tower damage shields (Metal Pants & Giant Gauntlet
        // StoneSkin/GetsBig protection, Ice Block frost shield) reduce all
        // damage routed through this chokepoint.
        let dmg = if self.units[u_idx].damage_shield_timer > 0.0
            && self.units[u_idx].damage_shield_protection > 0.0
        {
            dmg * (1.0 - self.units[u_idx].damage_shield_protection)
        } else {
            dmg
        };
        self.units[u_idx].hp -= dmg;

        // Snake Bracelet hero equipment: spawns snakes when taking damage
        if let Some(eq_pair) = self.units[u_idx].equipped_items {
            if eq_pair.contains(&EquipmentId::SnakeBracelet) {
                self.units[u_idx].special_timer += dmg;
                if self.units[u_idx].special_timer >= 500.0 && self.units[u_idx].spawned_children_count < 6 {
                    self.units[u_idx].special_timer = 0.0;
                    self.units[u_idx].spawned_children_count += 1;
                    let a = (self.units[u_idx].spawned_children_count as f32) * 1.0;
                    let sux = self.units[u_idx].x;
                    let suy = self.units[u_idx].y;
                    let steam = self.units[u_idx].team;
                    self.spawn_troop_unit(TroopId::Snake, steam, sux + a.cos() * 0.8, suy + a.sin() * 0.8, None);
                }
            }
        }

        // Revenge Deck hero equipment: reflects damage to attacking defense and heals 60 HP
        if let Some(eq_pair) = self.units[u_idx].equipped_items {
            if eq_pair.contains(&EquipmentId::RevengeDeck) {
                self.units[u_idx].hp = (self.units[u_idx].hp + 60.0).min(self.units[u_idx].max_hp);
                let uid = self.units[u_idx].id;
                for b in &mut self.buildings {
                    if !b.destroyed && b.current_target == Some(uid) {
                        b.hp = (b.hp - 225.0).max(0.0);
                    }
                }
            }
        }

        // Yeti damage-threshold Yetimite spawn
        if self.units[u_idx].kind == UnitKind::Troop(TroopId::Yeti)
            && self.units[u_idx].hp > 0.0
            && self.units[u_idx].hp <= self.units[u_idx].yeti_hp_milestone
        {
            self.units[u_idx].yeti_hp_milestone -= 600.0;
            let ux = self.units[u_idx].x;
            let uy = self.units[u_idx].y;
            let team = self.units[u_idx].team;
            self.spawn_troop_unit(TroopId::Yetimite, team, ux + 0.4, uy + 0.4, None);
        }

        if self.units[u_idx].hp <= 0.0 {
            // Check Phoenix Pet Revive for Heroes!
            if self.units[u_idx].phoenix_revive_available {
                self.units[u_idx].phoenix_revive_available = false;
                self.units[u_idx].hp = 1.0;
                self.units[u_idx].invincibility_timer = 8.5;
                return;
            }

            let dead_uid = self.units[u_idx].id;
            self.units[u_idx].hp = 0.0;
            self.units[u_idx].alive = false;
            self.clear_references_to_dead_unit(dead_uid);
            let ux = self.units[u_idx].x;
            let uy = self.units[u_idx].y;
            let team = self.units[u_idx].team;
            let kind = self.units[u_idx].kind;

            if self.active_siege_unit_id == Some(dead_uid) {
                self.release_attacker_cc(ux, uy);
            }

            if let Some(eq_pair) = self.units[u_idx].equipped_items {
                if eq_pair.contains(&EquipmentId::FireHeart) {
                    for bi in 0..self.buildings.len() {
                        if !self.buildings[bi].destroyed
                            && dist(
                                ux,
                                uy,
                                self.buildings[bi].center_x,
                                self.buildings[bi].center_y,
                            ) <= 4.0
                        {
                            self.damage_building(bi, 3000.0);
                        }
                    }
                    self.visual_events.push(VisualEvent::Explosion {
                        x: ux,
                        y: uy,
                        radius: 3.5,
                        color: "#f97316",
                    });
                }
            }

            if let UnitKind::Troop(tid) = kind {
                if tid == TroopId::Druid {
                    self.spawn_troop_unit(TroopId::DruidBear, team, ux, uy, None);
                    return;
                }
                if tid == TroopId::GuardianSmasher {
                    // MeleeGuardianOnDeath L1: drops SmasherRageArea on death
                    self.cast_spell(SpellId::Rage, Team::Defender, ux, uy);
                    return;
                }
                if tid == TroopId::SuperValkyrie {
                    // EliteValkyrieOnDeath: drops Rage spell on death
                    self.cast_spell(SpellId::Rage, team, ux, uy);
                }
                if tid == TroopId::SuperMiner {
                    // Super Miner death bomb: 1800 damage in 3.0t radius
                    for bi in 0..self.buildings.len() {
                        if !self.buildings[bi].destroyed && dist(ux, uy, self.buildings[bi].center_x, self.buildings[bi].center_y) <= 3.5 {
                            self.damage_building(bi, 1800.0);
                        }
                    }
                    self.visual_events.push(VisualEvent::Explosion {
                        x: ux,
                        y: uy,
                        radius: 3.0,
                        color: "#f97316",
                    });
                }
                if tid == TroopId::ElectroDragon {
                    // Electro Dragon death lightning strikes (6 strikes in 3.5t radius)
                    for i in 0..6 {
                        let angle = (i as f32 / 6.0) * std::f32::consts::TAU;
                        let strike_x = (ux + angle.cos() * 2.5).clamp(0.5, 49.5);
                        let strike_y = (uy + angle.sin() * 2.5).clamp(0.5, 49.5);
                        for bi in 0..self.buildings.len() {
                            if !self.buildings[bi].destroyed && dist(strike_x, strike_y, self.buildings[bi].center_x, self.buildings[bi].center_y) <= 2.5 {
                                self.damage_building(bi, 870.0);
                                break;
                            }
                        }
                        self.visual_events.push(VisualEvent::Explosion {
                            x: strike_x,
                            y: strike_y,
                            radius: 1.5,
                            color: "#38bdf8",
                        });
                    }
                }
                if tid == TroopId::WallBreaker || tid == TroopId::SuperWallBreaker {
                    let (death_dmg, wall_m, radius) = if tid == TroopId::SuperWallBreaker {
                        (450.0f32, 80.0f32, 2.5f32)
                    } else {
                        (78.0f32, 40.0f32, 2.0f32)
                    };
                    let mut wall_broken = false;
                    for w in &mut self.walls {
                        if !w.destroyed && dist(ux, uy, w.tile_x as f32 + 0.5, w.tile_y as f32 + 0.5) <= radius {
                            w.hp -= death_dmg * wall_m;
                            if w.hp <= 0.0 {
                                w.hp = 0.0;
                                w.destroyed = true;
                                wall_broken = true;
                            }
                        }
                    }
                    for bi in 0..self.buildings.len() {
                        if !self.buildings[bi].destroyed && dist(ux, uy, self.buildings[bi].center_x, self.buildings[bi].center_y) <= radius + 0.8 {
                            self.damage_building(bi, death_dmg);
                        }
                    }
                    if wall_broken {
                        self.invalidate_pathing();
                    }
                    self.visual_events.push(VisualEvent::Explosion {
                        x: ux,
                        y: uy,
                        radius,
                        color: "#f97316",
                    });
                }
                let spec = get_troop_spec(tid);
                match spec.special {
                    TroopSpecial::DeathSplash { damage, radius } => {
                        if team == Team::Defender {
                            // Defender death splash (Guardian Logger 800 dmg / 2.0t, Longshot 1000 dmg / 3.5t)
                            for oi in 0..self.units.len() {
                                if self.units[oi].alive
                                    && self.units[oi].team == Team::Attacker
                                    && !self.units[oi].is_burrowed
                                    && self.units[oi].invincibility_timer <= 0.0
                                    && dist(ux, uy, self.units[oi].x, self.units[oi].y) <= radius
                                {
                                    self.units[oi].hp -= damage;
                                    if self.units[oi].hp <= 0.0 {
                                        self.units[oi].alive = false;
                                    }
                                }
                            }
                            if tid == TroopId::GuardianLogger {
                                // LoggerDeathAbility L5: fires 4 logs outward in a 3.0t circle
                                for dir in [(1.0f32, 0.0f32), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0)]
                                {
                                    self.spawn_projectile(
                                        ProjectileKind::Log,
                                        Team::Defender,
                                        ux,
                                        uy,
                                        (ux + dir.0 * 3.0).clamp(0.5, 49.5),
                                        (uy + dir.1 * 3.0).clamp(0.5, 49.5),
                                        TargetRef::None,
                                        false,
                                        5.25,
                                        0.15,
                                        damage,
                                        1.8,
                                        TargetDomain::GroundAndAir,
                                        "#a16207",
                                        ProjectilePayload::PenetratingShot {
                                            pierce_count: 6,
                                            pierce_radius: 1.8,
                                            pushback_tiles: 1.0,
                                        },
                                    );
                                }
                            }
                        } else {
                            for bi in 0..self.buildings.len() {
                                if !self.buildings[bi].destroyed
                                    && dist(
                                        ux,
                                        uy,
                                        self.buildings[bi].center_x,
                                        self.buildings[bi].center_y,
                                    ) <= radius + 1.0
                                {
                                    self.damage_building(bi, damage);
                                }
                            }
                        }
                        self.visual_events.push(VisualEvent::Explosion {
                            x: ux,
                            y: uy,
                            radius,
                            color: "#f43f5e",
                        });
                    }
                    TroopSpecial::SplitOnDeath {
                        unit,
                        count,
                        death_damage,
                        radius,
                    } => {
                        for bi in 0..self.buildings.len() {
                            if !self.buildings[bi].destroyed
                                && dist(
                                    ux,
                                    uy,
                                    self.buildings[bi].center_x,
                                    self.buildings[bi].center_y,
                                ) <= radius + 1.0
                            {
                                self.damage_building(bi, death_damage);
                            }
                        }
                        let cap = count.min(12);
                        for i in 0..cap {
                            let a = (i as f32 / cap as f32) * std::f32::consts::TAU;
                            self.spawn_troop_unit(
                                unit,
                                team,
                                ux + a.cos() * 1.0,
                                uy + a.sin() * 1.0,
                                None,
                            );
                        }
                    }
                    TroopSpecial::YetiSpawner { yetimites_on_death, .. } => {
                        let count = if tid == TroopId::SuperYeti { 18 } else { yetimites_on_death.min(8) };
                        for i in 0..count {
                            let a = (i as f32 / count as f32) * std::f32::consts::TAU;
                            self.spawn_troop_unit(
                                TroopId::Yetimite,
                                team,
                                ux + a.cos() * 0.9,
                                uy + a.sin() * 0.9,
                                None,
                            );
                        }
                    }
                    TroopSpecial::IceGolemFreeze {
                        death_freeze_sec,
                        radius,
                    } => {
                        let dur = if team == Team::Attacker {
                            death_freeze_sec
                        } else {
                            3.5
                        };
                        for b in &mut self.buildings {
                            if !b.destroyed && dist(ux, uy, b.center_x, b.center_y) <= radius {
                                b.freeze_timer = b.freeze_timer.max(dur);
                            }
                        }
                        if tid == TroopId::IceHound {
                            for i in 0..8 {
                                let a = (i as f32 / 8.0) * std::f32::consts::TAU;
                                self.spawn_troop_unit(
                                    TroopId::Frostmite,
                                    team,
                                    ux + a.cos() * 1.0,
                                    uy + a.sin() * 1.0,
                                    None,
                                );
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    fn update_score_and_termination(&mut self) {
        self.destruction_pct = ((self.destroyed_scorable_buildings as u32 * 100)
            / (self.total_scorable_buildings as u32))
            .min(100) as u8;

        let mut stars = 0u8;
        if self.destruction_pct >= 50 {
            stars += 1;
        }
        if self.town_hall_destroyed {
            stars += 1;
        }
        if self.destruction_pct == 100 {
            stars = 3;
        }
        self.stars = stars;

        if self.destruction_pct == 100 || self.tick >= MAX_TICKS {
            self.is_finished = true;
            return;
        }

        // Check if attacker has no remaining inventory AND no live attacking units
        let no_inventory = self.remaining_troops.iter().all(|(_, c)| *c == 0)
            && self.remaining_spells.iter().all(|(_, c)| *c == 0)
            && self.remaining_heroes.is_empty()
            && self.remaining_siege.is_none();
        let no_live_attackers = !self
            .units
            .iter()
            .any(|u| u.alive && u.team == Team::Attacker);

        if no_inventory && no_live_attackers && self.tick > 10 {
            self.is_finished = true;
        }
    }

    /// Maps any live `SimUnit` (Attacker or Defender) to a structured Hierarchical Tactical-Archetype
    /// signature `phi(u) in (0.0, 1.0]` suitable for 2D Convolutional Neural Network filters.
    ///
    /// Why not raw enum integers (1..65)?
    /// 1. Arbitrary integer orderings impose meaningless linear magnitudes in `Conv2d` dot products.
    /// 2. Summing or averaging integer IDs when multiple units share a tile corrupts unit identity.
    /// 3. Ground Skeletons (`TrapMode::SkeletonGround` / Witch) and Air Skeletons (`TrapMode::SkeletonAir`)
    ///    both use `TroopId::Skeleton` in `sim.rs`, differing by `u.is_air`.
    ///
    /// By grouping tactical roles into contiguous bands of `(0, 1]` and taking the per-tile maximum
    /// `max_{u at (x,y)} phi(u)` (while Ch 5 & Ch 6 already carry summed Ground/Air HP density),
    /// `Conv2d` kernels can cleanly separate swarms, ranged cores, heavy tanks, healers, heroes,
    /// and strictly distinguish Ground Skeletons (`0.10`) from Air Skeletons (`0.28`).
    pub fn unit_type_signature(u: &SimUnit) -> f32 {
        match u.kind {
            UnitKind::Totem => 0.14,
            UnitKind::Pet(_) => 0.93,
            UnitKind::Hero(hid) => match hid {
                HeroId::MinionPrince | HeroId::DragonDuke => 0.99,
                HeroId::BarbarianKing
                | HeroId::ArcherQueen
                | HeroId::GrandWarden
                | HeroId::RoyalChampion => 0.96,
            },
            UnitKind::Troop(tid) => match tid {
                // CRITICAL: Ground Skeleton (0.10) vs Air Skeleton (0.28) are strictly separated!
                TroopId::Skeleton => {
                    if u.is_air {
                        0.28
                    } else {
                        0.10
                    }
                }
                TroopId::ArmoredSkeleton => 0.12,
                TroopId::Yetimite
                | TroopId::Firemite
                | TroopId::Frostmite
                | TroopId::Booger
                | TroopId::Snake => 0.14,
                TroopId::Barbarian
                | TroopId::SuperBarbarian
                | TroopId::Goblin
                | TroopId::SneakyGoblin
                | TroopId::Miner
                | TroopId::HogRider => 0.18,
                TroopId::WallBreaker | TroopId::SuperWallBreaker | TroopId::Headhunter => 0.22,
                TroopId::Bat => 0.32,
                TroopId::Minion
                | TroopId::SuperMinion
                | TroopId::BabyDragon
                | TroopId::InfernoDragon => 0.36,
                TroopId::Balloon | TroopId::RocketBalloon | TroopId::DragonRider => 0.40,
                TroopId::Archer
                | TroopId::SuperArcher
                | TroopId::Wizard
                | TroopId::SuperWizard => 0.46,
                TroopId::Witch
                | TroopId::SuperWitch
                | TroopId::ApprenticeWarden
                | TroopId::Druid
                | TroopId::Furnace => 0.52,
                TroopId::Valkyrie
                | TroopId::SuperValkyrie
                | TroopId::Bowler
                | TroopId::SuperBowler
                | TroopId::SuperMiner => 0.56,
                TroopId::Thrower
                | TroopId::Yeti
                | TroopId::SuperYeti
                | TroopId::ElectroTitan => 0.60,
                TroopId::Giant | TroopId::SuperGiant | TroopId::DruidBear => 0.66,
                TroopId::IceGolem | TroopId::Golem => 0.70,
                TroopId::RootRider | TroopId::Pekka => 0.74,
                TroopId::GuardianLogger
                | TroopId::GuardianLongshot
                | TroopId::GuardianSmasher => 0.78,
                TroopId::Healer => 0.81,
                TroopId::Dragon | TroopId::SuperDragon | TroopId::ElectroDragon => 0.85,
                TroopId::LavaHound | TroopId::IceHound => 0.89,
                TroopId::WallWrecker
                | TroopId::BattleBlimp
                | TroopId::StoneSlammer
                | TroopId::SiegeBarracks
                | TroopId::LogLauncher
                | TroopId::FlameFlinger
                | TroopId::BattleDrill => 0.91,
            },
        }
    }

    /// Extracts a 10-channel 50x50 spatial tensor flattened `[10 * 50 * 50]` for RL agents:
    /// Ch 0: Building HP normalized (0..1)
    /// Ch 1: Defense DPS normalized (0..1)
    /// Ch 2: Town Hall indicator (0 or 1)
    /// Ch 3: Wall HP normalized (0..1)
    /// Ch 4: No-Deploy Red Zone mask (0 or 1)
    /// Ch 5: Attacking Ground unit HP density
    /// Ch 6: Attacking Air unit HP density
    /// Ch 7: Active Spell zone indicator
    /// Ch 8: Allied Unit Type Signature `max_{u in Attacker(x,y)} phi(u) in [0, 1]`
    /// Ch 9: Enemy Unit Type Signature `max_{u in Defender(x,y)} phi(u) in [0, 1]`
    ///       (Defending CC troops, defending Heroes, TH18 Guardians, and Ground [0.10] vs Air [0.28] Skeletons)
    pub fn extract_spatial_observation(&self) -> Vec<f32> {
        let mut obs = vec![0.0f32; 10 * 50 * 50];
        let idx = |ch: usize, y: usize, x: usize| ch * 2500 + y * 50 + x;

        for b in &self.buildings {
            if b.destroyed {
                continue;
            }
            let hp_norm = (b.hp / 11000.0).clamp(0.0, 1.0);
            let spec = get_building_spec(b.building_id);
            let dps_norm = (spec.dps / 750.0).clamp(0.0, 1.0);
            let is_th = if b.building_id == BuildingId::TownHall {
                1.0
            } else {
                0.0
            };
            for dy in 0..b.footprint {
                for dx in 0..b.footprint {
                    let x = (b.tile_x + dx).min(49) as usize;
                    let y = (b.tile_y + dy).min(49) as usize;
                    obs[idx(0, y, x)] = hp_norm;
                    obs[idx(1, y, x)] = dps_norm;
                    obs[idx(2, y, x)] = is_th;
                }
            }
        }

        for w in &self.walls {
            if !w.destroyed {
                obs[idx(3, w.tile_y as usize, w.tile_x as usize)] = (w.hp / w.max_hp).clamp(0.0, 1.0);
            }
        }

        for y in 0..50 {
            for x in 0..50 {
                if self.no_deploy_mask[y][x] {
                    obs[idx(4, y, x)] = 1.0;
                }
            }
        }

        for u in &self.units {
            if !u.alive {
                continue;
            }
            let x = (u.x.floor() as i32).clamp(0, 49) as usize;
            let y = (u.y.floor() as i32).clamp(0, 49) as usize;
            let sig = Self::unit_type_signature(u);
            if u.team == Team::Attacker {
                let ch = if u.is_air { 6 } else { 5 };
                obs[idx(ch, y, x)] = (obs[idx(ch, y, x)] + u.hp / 5000.0).min(1.0);
                if sig > obs[idx(8, y, x)] {
                    obs[idx(8, y, x)] = sig;
                }
            } else {
                if sig > obs[idx(9, y, x)] {
                    obs[idx(9, y, x)] = sig;
                }
            }
        }

        for z in &self.spells {
            let x = (z.x.floor() as i32).clamp(0, 49) as usize;
            let y = (z.y.floor() as i32).clamp(0, 49) as usize;
            obs[idx(7, y, x)] = 1.0;
        }

        obs
    }

    /// Extracts a 64-float vector encoding full knowledge of the attacking army composition
    /// and live remaining inventory (troops, spells, heroes, hero equipment, pets, siege machine, CC, clock).
    pub fn extract_army_context(&self) -> Vec<f32> {
        let mut ctx = vec![0.0f32; 64];
        // [0..4]: Global battle progress
        let active_attackers = self
            .units
            .iter()
            .filter(|u| u.alive && u.team == Team::Attacker)
            .count();
        ctx[0] = ((1800.0 - self.tick as f32) / 1800.0).clamp(0.0, 1.0);
        ctx[1] = (self.destruction_pct as f32 / 100.0).clamp(0.0, 1.0);
        ctx[2] = (self.stars as f32 / 3.0).clamp(0.0, 1.0);
        ctx[3] = (active_attackers as f32 / 50.0).clamp(0.0, 1.0);

        // [4..24]: 10 Troop slots (tid normalized + remaining count normalized)
        for i in 0..10 {
            if let Some(&(tid, rem)) = self.remaining_troops.get(i) {
                ctx[4 + i * 2] = ((tid as usize + 1) as f32 / 60.0).clamp(0.0, 1.0);
                ctx[4 + i * 2 + 1] = (rem as f32 / 20.0).clamp(0.0, 1.0);
            }
        }

        // [24..44]: 10 Spell slots (sid normalized + remaining count normalized)
        for i in 0..10 {
            if let Some(&(sid, rem)) = self.remaining_spells.get(i) {
                ctx[24 + i * 2] = ((sid as usize + 1) as f32 / 20.0).clamp(0.0, 1.0);
                ctx[24 + i * 2 + 1] = (rem as f32 / 8.0).clamp(0.0, 1.0);
            }
        }

        // [44..56]: 4 Hero slots (Hero+Equipment+Pet signature, live HP / availability, ability state)
        let mut all_heroes: Vec<HeroId> = self.remaining_heroes.iter().map(|(h, _)| *h).collect();
        for &(dh, _) in &self.deployed_heroes {
            if !all_heroes.contains(&dh) {
                all_heroes.push(dh);
            }
        }
        all_heroes.sort_by_key(|h| *h as usize);
        for (i, &hid) in all_heroes.iter().take(4).enumerate() {
            let eq_sig = self
                .hero_equipment
                .iter()
                .find(|(h, _)| *h == hid)
                .map(|(_, eqs)| (eqs[0] as usize + 1) * 7 + (eqs[1] as usize + 1))
                .unwrap_or(1);
            let pet_sig = self
                .remaining_heroes
                .iter()
                .find(|(h, _)| *h == hid)
                .map(|(_, p)| *p as usize + 1)
                .unwrap_or(1);
            let sig = ((hid as usize + 1) * 60 + eq_sig + pet_sig) as f32 / 500.0;
            ctx[44 + i * 3] = sig.clamp(0.0, 1.0);

            if self.remaining_heroes.iter().any(|(rh, _)| *rh == hid) {
                // In deployment bar ready to deploy
                ctx[44 + i * 3 + 1] = 1.0;
                ctx[44 + i * 3 + 2] = 0.5;
            } else if let Some(&(_, uid)) = self.deployed_heroes.iter().find(|(dh, _)| *dh == hid) {
                if let Some(u) = self.units.iter().find(|u| u.id == uid && u.alive) {
                    ctx[44 + i * 3 + 1] = (u.hp / u.max_hp.max(1.0)).clamp(0.0, 1.0);
                    ctx[44 + i * 3 + 2] = if u.ability_used { 0.0 } else { 1.0 };
                }
            }
        }

        // [56..64]: Siege machine & Clan Castle full knowledge
        if let Some(siege_id) = self.remaining_siege {
            ctx[56] = ((siege_id as usize + 1) as f32 / 60.0).clamp(0.0, 1.0);
            ctx[57] = 1.0;
        } else if let Some(uid) = self.active_siege_unit_id {
            if let Some(u) = self.units.iter().find(|u| u.id == uid && u.alive) {
                if let UnitKind::Troop(sid) = u.kind {
                    ctx[56] = ((sid as usize + 1) as f32 / 60.0).clamp(0.0, 1.0);
                }
                ctx[58] = if self.attacker_cc_popped { 0.0 } else { 1.0 };
            }
        }
        ctx[59] = if self.attacker_cc_popped { 1.0 } else { 0.0 };
        if let Some(&(cc_t0, cc_c0)) = self.attacker_cc_troops.first() {
            ctx[60] = ((cc_t0 as usize + 1) as f32 / 60.0).clamp(0.0, 1.0);
            ctx[61] = (cc_c0 as f32 / 5.0).clamp(0.0, 1.0);
        }
        if let Some(&(cc_t1, cc_c1)) = self.attacker_cc_troops.get(1) {
            ctx[62] = ((cc_t1 as usize + 1) as f32 / 60.0).clamp(0.0, 1.0);
            ctx[63] = (cc_c1 as f32 / 5.0).clamp(0.0, 1.0);
        }
        ctx
    }
}

#[inline]
fn dist(x1: f32, y1: f32, x2: f32, y2: f32) -> f32 {
    ((x2 - x1).powi(2) + (y2 - y1).powi(2)).sqrt()
}

/// Returns true if `(px, py)` falls inside the directional cone of width `arc_deg`
/// centered on `direction_deg` around `(bx, by)`.
#[inline]
pub fn is_within_cone(
    bx: f32,
    by: f32,
    px: f32,
    py: f32,
    direction_deg: f32,
    arc_deg: f32,
) -> bool {
    if arc_deg >= 360.0 {
        return true;
    }
    let angle_deg = (py - by).atan2(px - bx).to_degrees();
    let diff = (angle_deg - direction_deg + 180.0).rem_euclid(360.0) - 180.0;
    diff.abs() <= arc_deg * 0.5
}

/// Returns true if an attacking unit of `kind` is allowed to trigger the defending Clan Castle
/// (`DoesNotOpenCC` in `characters.csv` and `SKELETON_OPEN_CC = FALSE` in `globals.csv`).
#[inline]
pub fn does_unit_open_cc(kind: UnitKind) -> bool {
    match kind {
        UnitKind::Totem => false,
        UnitKind::Troop(
            TroopId::Skeleton
            | TroopId::ArmoredSkeleton
            | TroopId::Bat
            | TroopId::Yetimite
            | TroopId::Firemite
            | TroopId::Frostmite
            | TroopId::Booger
            | TroopId::Snake,
        ) => false,
        _ => true,
    }
}
