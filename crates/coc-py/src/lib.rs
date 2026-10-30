use coc_data::{get_full_catalog, get_preset_armies, get_preset_layouts, ArmyLoadout, HeroId, VillageLayout};
use coc_engine::{validate_layout, BattleAction, BattleEngine};
use pyo3::prelude::*;
use pyo3::types::PyByteArray;
use rayon::prelude::*;

const OBS_FLOATS: usize = 59 * 50 * 50;
const CTX_FLOATS: usize = 64;
const FRACTION_BINS: [f32; 5] = [0.0, 0.25, 0.50, 0.75, 1.00];

#[inline]
fn f32_slice_as_bytes(slice: &[f32]) -> &[u8] {
    unsafe { std::slice::from_raw_parts(slice.as_ptr() as *const u8, slice.len() * 4) }
}

#[derive(Clone)]
struct TacticalMasks {
    slot_type: [u8; 7],
    slot_idx: [u8; 70],
    tile: [u8; 2500],
    raw_slot_type: [u8; 7],
}

impl Default for TacticalMasks {
    fn default() -> Self {
        Self {
            slot_type: [0; 7],
            slot_idx: [0; 70],
            tile: [0; 2500],
            raw_slot_type: [0; 7],
        }
    }
}

struct TacticalStepTelemetry {
    engine_reward: f32,
    done: bool,
    destruction_pct: u8,
    stars: u8,
    delta_pct: u8,
    delta_stars: u8,
    delta_damage_ratio: f32,
    th_just_destroyed: bool,
    time_remaining_ratio: f32,
    invalid_action: bool,
    deploy_fraction: f32,
    funnel_cohesion: f32,
    tick: u32,
    ff_ticks: u32,
    has_remaining_inventory: bool,
    custom_reward: f32,
    reward_destr: f32,
    reward_stars: f32,
    reward_damage: f32,
}

#[inline]
fn compute_reward_parts(
    delta_pct: u8,
    delta_stars: u8,
    delta_dmg_ratio: f32,
    th_just_destroyed: bool,
    funnel_cohesion: f32,
    invalid_action: bool,
) -> (f32, f32, f32, f32) {
    let r_destr = (delta_pct as f32) * 0.35;
    let th_bonus = if th_just_destroyed { 14.0 } else { 0.0 };
    let r_stars = (delta_stars as f32) * 12.0 + th_bonus;
    let mut r_damage = delta_dmg_ratio * 15.0 + funnel_cohesion * 0.08;
    if invalid_action {
        r_damage -= 0.05;
    }
    let total = r_destr + r_stars + r_damage;
    (total, r_destr, r_stars, r_damage)
}

struct TacticalEnvState {
    layout: VillageLayout,
    army: ArmyLoadout,
    engine: BattleEngine,
    ticks_per_step: u32,
    prev_pct: u8,
    prev_stars: u8,
    prev_dmg: f32,
    prev_th_destroyed: bool,
    current_tick: u32,
    deployed_troop_actions: u32,
    deployed_any_unit: bool,
    last_spell_tick: i32,
    last_ability_tick: i32,
    deploy_coords: Vec<(f32, f32)>,
    base_perimeter_mask: [u8; 2500],
    cached_masks: TacticalMasks,
}

impl TacticalEnvState {
    fn new(layout: VillageLayout, army: ArmyLoadout, ticks_per_step: u32) -> Self {
        let engine = BattleEngine::new(&layout, &army);
        let mut st = Self {
            layout,
            army,
            engine,
            ticks_per_step: ticks_per_step.max(1),
            prev_pct: 0,
            prev_stars: 0,
            prev_dmg: 0.0,
            prev_th_destroyed: false,
            current_tick: 0,
            deployed_troop_actions: 0,
            deployed_any_unit: false,
            last_spell_tick: -999,
            last_ability_tick: -999,
            deploy_coords: Vec::with_capacity(32),
            base_perimeter_mask: [0; 2500],
            cached_masks: TacticalMasks::default(),
        };
        st.recompute_base_perimeter_mask();
        st.cached_masks = st.compute_tactical_masks();
        st
    }

    fn reset(&mut self) {
        self.engine = BattleEngine::new(&self.layout, &self.army);
        self.prev_pct = 0;
        self.prev_stars = 0;
        self.prev_dmg = 0.0;
        self.prev_th_destroyed = false;
        self.current_tick = 0;
        self.deployed_troop_actions = 0;
        self.deployed_any_unit = false;
        self.last_spell_tick = -999;
        self.last_ability_tick = -999;
        self.deploy_coords.clear();
        self.recompute_base_perimeter_mask();
        self.cached_masks = self.compute_tactical_masks();
    }

    fn reset_with(&mut self, layout: &VillageLayout, army: &ArmyLoadout) {
        self.layout = layout.clone();
        self.army = army.clone();
        self.reset();
    }

    fn recompute_base_perimeter_mask(&mut self) {
        let mut valid_deploy = [0u8; 2500];
        let mut any_red = false;
        for y in 0..50 {
            for x in 0..50 {
                let blocked = self.engine.no_deploy_mask[y][x];
                if blocked {
                    any_red = true;
                } else {
                    valid_deploy[y * 50 + x] = 1;
                }
            }
        }

        if !any_red {
            self.base_perimeter_mask = valid_deploy;
            return;
        }

        let mut perimeter = [0u8; 2500];
        let mut any_perimeter = false;
        for y in 0..50usize {
            for x in 0..50usize {
                if valid_deploy[y * 50 + x] == 0 {
                    continue;
                }
                let in_hole = (13..=36).contains(&x) && (13..=36).contains(&y);
                if in_hole {
                    continue;
                }
                let cardinal = (13..=36).contains(&x) || (13..=36).contains(&y);
                if !cardinal {
                    continue;
                }
                let y_min = y.saturating_sub(2);
                let y_max = (y + 2).min(49);
                let x_min = x.saturating_sub(2);
                let x_max = (x + 2).min(49);
                let mut near_village = false;
                'search: for ny in y_min..=y_max {
                    for nx in x_min..=x_max {
                        if self.engine.no_deploy_mask[ny][nx] {
                            near_village = true;
                            break 'search;
                        }
                    }
                }
                if near_village {
                    perimeter[y * 50 + x] = 1;
                    any_perimeter = true;
                }
            }
        }

        self.base_perimeter_mask = if any_perimeter {
            perimeter
        } else {
            valid_deploy
        };
    }

    fn compute_raw_masks(&self) -> ([bool; 7], [[bool; 10]; 7]) {
        let can_activate_hero = |hid: HeroId| -> bool {
            let Some(&(_, uid)) = self.engine.deployed_heroes.iter().find(|(h, _)| *h == hid)
            else {
                return false;
            };
            self.engine
                .units
                .iter()
                .any(|u| u.id == uid && u.alive && !u.ability_used)
        };

        let mut slot_idx_masks = [[false; 10]; 7];
        slot_idx_masks[0][0] = true;
        slot_idx_masks[4][0] = true;
        slot_idx_masks[5][0] = true;

        for i in 0..10 {
            if let Some(&(_, count)) = self.engine.remaining_troops.get(i) {
                slot_idx_masks[1][i] = count > 0;
            }
            if let Some(&(hid, _)) = self.army.heroes.get(i) {
                slot_idx_masks[2][i] = self
                    .engine
                    .remaining_heroes
                    .iter()
                    .any(|&(rh, _)| rh == hid);
                slot_idx_masks[3][i] = can_activate_hero(hid);
            }
            if let Some(&(_, count)) = self.engine.remaining_spells.get(i) {
                slot_idx_masks[6][i] = count > 0;
            }
        }

        let can_deploy_siege = self.engine.remaining_siege.is_some()
            || (!self.engine.attacker_cc_popped
                && self.engine.active_siege_unit_id.is_none()
                && !self.engine.attacker_cc_troops.is_empty());

        let can_pop_siege = !self.engine.attacker_cc_popped
            && self
                .engine
                .active_siege_unit_id
                .map_or(false, |uid| self.engine.units.iter().any(|u| u.id == uid && u.alive));

        let slot_type_mask = [
            true,
            slot_idx_masks[1].iter().any(|&b| b),
            slot_idx_masks[2].iter().any(|&b| b),
            slot_idx_masks[3].iter().any(|&b| b),
            can_deploy_siege,
            can_pop_siege,
            slot_idx_masks[6].iter().any(|&b| b),
        ];

        (slot_type_mask, slot_idx_masks)
    }

    fn compute_tactical_masks(&self) -> TacticalMasks {
        let (raw_st, raw_si) = self.compute_raw_masks();
        let mut st_mask = [0u8; 7];
        let mut raw_slot_type = [0u8; 7];
        for i in 0..7 {
            let v = u8::from(raw_st[i]);
            st_mask[i] = v;
            raw_slot_type[i] = v;
        }
        let mut si_mask = [0u8; 70];
        for r in 0..7 {
            for c in 0..10 {
                si_mask[r * 10 + c] = u8::from(raw_si[r][c]);
            }
        }

        // Phase 1 (Deployment): Deploy frontline troops first (>= 3 troop waves), then Siege & Heroes
        if st_mask[2] != 0 && st_mask[1] != 0 && self.deployed_troop_actions < 3 {
            st_mask[2] = 0;
        }
        if st_mask[4] != 0 && st_mask[1] != 0 && self.deployed_troop_actions < 1 {
            st_mask[4] = 0;
        }

        // Prioritize core army troop slots (slots 0..3) before 1-space cleanup slots
        if st_mask[1] != 0 && si_mask[10..14].iter().any(|&b| b != 0) {
            for c in 4..10 {
                si_mask[10 + c] = 0;
            }
        }

        // Phase 2 (Mid-Battle Tactical Timing)
        if st_mask[3] != 0 {
            if self.current_tick < 64
                || self.deployed_troop_actions < 3
                || (self.current_tick as i32 - self.last_ability_tick) < 16
            {
                st_mask[3] = 0;
            }
        }
        if st_mask[5] != 0 && self.current_tick < 112 {
            st_mask[5] = 0;
        }
        if st_mask[6] != 0 {
            if self.deployed_troop_actions < 3
                || self.current_tick < 40
                || (self.current_tick as i32 - self.last_spell_tick) < 8
            {
                st_mask[6] = 0;
            }
        }

        let mut tile_mask = self.base_perimeter_mask;
        if !self.deploy_coords.is_empty() {
            let n = self.deploy_coords.len().min(2);
            let cx = self.deploy_coords[..n].iter().map(|c| c.0).sum::<f32>() / (n as f32);
            let cy = self.deploy_coords[..n].iter().map(|c| c.1).sum::<f32>() / (n as f32);
            let mut funnel = [0u8; 2500];
            let mut any_funnel = false;
            for y in 0..50usize {
                let dy = (y as f32) - cy;
                let dy2 = dy * dy;
                for x in 0..50usize {
                    if tile_mask[y * 50 + x] == 0 {
                        continue;
                    }
                    let dx = (x as f32) - cx;
                    if dx * dx + dy2 <= 196.0 {
                        funnel[y * 50 + x] = 1;
                        any_funnel = true;
                    }
                }
            }
            if any_funnel {
                tile_mask = funnel;
            }
        }

        TacticalMasks {
            slot_type: st_mask,
            slot_idx: si_mask,
            tile: tile_mask,
            raw_slot_type,
        }
    }

    fn step_discrete_raw(
        &mut self,
        slot_type: u8,
        slot_idx: usize,
        tile_x: u8,
        tile_y: u8,
        ticks_per_step: u32,
        deploy_fraction: f32,
    ) -> f32 {
        let x = (tile_x.min(49) as f32) + 0.5;
        let y = (tile_y.min(49) as f32) + 0.5;
        let frac = deploy_fraction.clamp(0.0, 1.0);

        let action = match slot_type {
            1 => self
                .engine
                .remaining_troops
                .get(slot_idx)
                .map(|&(tid, avail)| {
                    let count = ((avail as f32 * frac).round() as u16)
                        .max(1)
                        .min(avail.max(1));
                    BattleAction::DeployTroopBatch {
                        troop_id: tid,
                        x,
                        y,
                        count,
                    }
                })
                .unwrap_or(BattleAction::NoOp),
            2 => self
                .army
                .heroes
                .get(slot_idx)
                .map(|&(hid, _)| BattleAction::DeployHero {
                    hero_id: hid,
                    x,
                    y,
                })
                .unwrap_or(BattleAction::NoOp),
            3 => self
                .army
                .heroes
                .get(slot_idx)
                .map(|&(hid, _)| BattleAction::ActivateHeroAbility { hero_id: hid })
                .unwrap_or(BattleAction::NoOp),
            4 => BattleAction::DeploySiege { x, y },
            5 => BattleAction::PopSiegeMachine,
            6 => self
                .engine
                .remaining_spells
                .get(slot_idx)
                .map(|&(sid, _)| BattleAction::CastSpell {
                    spell_id: sid,
                    x,
                    y,
                })
                .unwrap_or(BattleAction::NoOp),
            _ => BattleAction::NoOp,
        };

        let mut total_reward = 0.0f32;
        let first = self.engine.step(action);
        total_reward += first.reward;

        for _ in 1..ticks_per_step.max(1) {
            if self.engine.is_finished {
                break;
            }
            let r = self.engine.step(BattleAction::NoOp);
            total_reward += r.reward;
        }
        total_reward
    }

    fn step_tactical(
        &mut self,
        slot_type: u8,
        slot_idx: usize,
        tile_x: u8,
        tile_y: u8,
        deploy_fraction: f32,
        auto_finish: bool,
        is_last_step: bool,
        gamma: f32,
    ) -> TacticalStepTelemetry {
        let tile_flat = (tile_y as usize) * 50 + (tile_x as usize);
        let is_valid_type =
            (slot_type as usize) < 7 && self.cached_masks.slot_type[slot_type as usize] != 0;
        let is_valid_idx = is_valid_type
            && slot_idx < 10
            && self.cached_masks.slot_idx[(slot_type as usize) * 10 + slot_idx] != 0;
        let needs_green_tile = matches!(slot_type, 1 | 2 | 4);
        let is_valid_tile = tile_x < 50
            && tile_y < 50
            && (!needs_green_tile || self.cached_masks.tile[tile_flat] != 0);
        let invalid_action = !(is_valid_type && is_valid_idx && is_valid_tile);

        let engine_reward = self.step_discrete_raw(
            slot_type,
            slot_idx,
            tile_x,
            tile_y,
            self.ticks_per_step,
            deploy_fraction,
        );

        let tick = self.engine.tick;
        let mut funnel_cohesion = 0.0f32;
        if !invalid_action {
            match slot_type {
                1 => {
                    self.deployed_troop_actions += 1;
                    self.deployed_any_unit = true;
                }
                2 | 4 => {
                    self.deployed_any_unit = true;
                }
                3 => {
                    self.last_ability_tick = tick as i32;
                }
                6 => {
                    self.last_spell_tick = tick as i32;
                }
                _ => {}
            }

            if matches!(slot_type, 1 | 2 | 4) {
                if !self.deploy_coords.is_empty() {
                    let n = self.deploy_coords.len().min(4);
                    let cx =
                        self.deploy_coords[..n].iter().map(|c| c.0).sum::<f32>() / (n as f32);
                    let cy =
                        self.deploy_coords[..n].iter().map(|c| c.1).sum::<f32>() / (n as f32);
                    let dist = ((tile_x as f32) - cx).hypot((tile_y as f32) - cy);
                    funnel_cohesion = if dist <= 12.0 {
                        1.0
                    } else if dist > 20.0 {
                        -0.5
                    } else {
                        0.0
                    };
                }
                self.deploy_coords.push((tile_x as f32, tile_y as f32));
            }
        }

        self.current_tick = tick;
        let hp_pool = self.engine.total_hp_pool.max(1.0);
        let mut delta_pct = self.engine.destruction_pct.saturating_sub(self.prev_pct);
        let mut delta_stars = self.engine.stars.saturating_sub(self.prev_stars);
        let mut delta_damage_ratio =
            ((self.engine.damage_dealt_total - self.prev_dmg) / hp_pool).max(0.0);
        let mut th_just_destroyed = self.engine.town_hall_destroyed && !self.prev_th_destroyed;
        let mut time_remaining_ratio = ((1800.0 - tick as f32) / 1800.0).max(0.0);

        self.prev_pct = self.engine.destruction_pct;
        self.prev_stars = self.engine.stars;
        self.prev_dmg = self.engine.damage_dealt_total;
        self.prev_th_destroyed = self.engine.town_hall_destroyed;

        let (mut custom_reward, mut reward_destr, mut reward_stars, mut reward_damage) =
            compute_reward_parts(
                delta_pct,
                delta_stars,
                delta_damage_ratio,
                th_just_destroyed,
                funnel_cohesion,
                invalid_action,
            );

        self.cached_masks = self.compute_tactical_masks();
        let mut has_remaining_inventory =
            self.cached_masks.raw_slot_type[1..].iter().any(|&b| b != 0);
        let mut done = self.engine.is_finished;
        let mut ff_ticks = 0u32;

        if auto_finish && !done && (!has_remaining_inventory || is_last_step) {
            let ff_tel = self.finish_tactical();
            ff_ticks = ff_tel.ff_ticks;
            let ff_equiv_steps =
                (ff_ticks as f32) / ((self.ticks_per_step as f32) * 4.0).max(1.0);
            let ff_discount = gamma.powf(ff_equiv_steps.min(25.0));
            custom_reward += ff_discount * ff_tel.custom_reward;
            reward_destr += ff_discount * ff_tel.reward_destr;
            reward_stars += ff_discount * ff_tel.reward_stars;
            reward_damage += ff_discount * ff_tel.reward_damage;
            done = ff_tel.done;
            delta_pct = delta_pct.saturating_add(ff_tel.delta_pct);
            delta_stars = delta_stars.saturating_add(ff_tel.delta_stars);
            delta_damage_ratio += ff_tel.delta_damage_ratio;
            th_just_destroyed = th_just_destroyed || ff_tel.th_just_destroyed;
            time_remaining_ratio = ff_tel.time_remaining_ratio;
            has_remaining_inventory = ff_tel.has_remaining_inventory;
        }

        TacticalStepTelemetry {
            engine_reward,
            done,
            destruction_pct: self.engine.destruction_pct,
            stars: self.engine.stars,
            delta_pct,
            delta_stars,
            delta_damage_ratio,
            th_just_destroyed,
            time_remaining_ratio,
            invalid_action,
            deploy_fraction,
            funnel_cohesion,
            tick: self.current_tick,
            ff_ticks,
            has_remaining_inventory,
            custom_reward,
            reward_destr,
            reward_stars,
            reward_damage,
        }
    }

    fn finish_tactical(&mut self) -> TacticalStepTelemetry {
        let tick_before = self.current_tick;
        let mut total_reward = 0.0f32;
        while !self.engine.is_finished && self.engine.tick < 1800 {
            let r = self.engine.step(BattleAction::NoOp);
            total_reward += r.reward;
        }
        let tick = self.engine.tick;
        self.current_tick = tick;
        let ff_ticks = tick.saturating_sub(tick_before);

        let hp_pool = self.engine.total_hp_pool.max(1.0);
        let delta_pct = self.engine.destruction_pct.saturating_sub(self.prev_pct);
        let delta_stars = self.engine.stars.saturating_sub(self.prev_stars);
        let delta_damage_ratio =
            ((self.engine.damage_dealt_total - self.prev_dmg) / hp_pool).max(0.0);
        let th_just_destroyed = self.engine.town_hall_destroyed && !self.prev_th_destroyed;
        let time_remaining_ratio = ((1800.0 - tick as f32) / 1800.0).max(0.0);

        self.prev_pct = self.engine.destruction_pct;
        self.prev_stars = self.engine.stars;
        self.prev_dmg = self.engine.damage_dealt_total;
        self.prev_th_destroyed = self.engine.town_hall_destroyed;

        let (custom_reward, reward_destr, reward_stars, reward_damage) = compute_reward_parts(
            delta_pct,
            delta_stars,
            delta_damage_ratio,
            th_just_destroyed,
            0.0,
            false,
        );

        self.cached_masks = self.compute_tactical_masks();
        let has_remaining_inventory =
            self.cached_masks.raw_slot_type[1..].iter().any(|&b| b != 0);

        TacticalStepTelemetry {
            engine_reward: total_reward,
            done: self.engine.is_finished,
            destruction_pct: self.engine.destruction_pct,
            stars: self.engine.stars,
            delta_pct,
            delta_stars,
            delta_damage_ratio,
            th_just_destroyed,
            time_remaining_ratio,
            invalid_action: false,
            deploy_fraction: 1.0,
            funnel_cohesion: 0.0,
            tick,
            ff_ticks,
            has_remaining_inventory,
            custom_reward,
            reward_destr,
            reward_stars,
            reward_damage,
        }
    }
}

#[pyfunction]
fn get_catalog_json() -> String {
    serde_json::to_string(&get_full_catalog()).unwrap()
}

#[pyfunction]
fn validate_layout_json(layout_json: &str) -> PyResult<String> {
    let layout: VillageLayout = serde_json::from_str(layout_json)
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    Ok(serde_json::to_string(&validate_layout(&layout)).unwrap())
}

#[pyclass]
pub struct PyBattleEnv {
    state: TacticalEnvState,
    obs_buf: Vec<f32>,
    ctx_buf: Vec<f32>,
}

#[pymethods]
impl PyBattleEnv {
    #[new]
    #[pyo3(signature = (layout_json=None, army_json=None, ticks_per_step=5))]
    pub fn new(
        layout_json: Option<&str>,
        army_json: Option<&str>,
        ticks_per_step: u32,
    ) -> PyResult<Self> {
        let layout = match layout_json {
            Some(s) => serde_json::from_str(s)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?,
            None => get_preset_layouts().remove(0),
        };
        let army = match army_json {
            Some(s) => serde_json::from_str(s)
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?,
            None => get_preset_armies().remove(0),
        };
        let state = TacticalEnvState::new(layout, army, ticks_per_step);
        Ok(Self {
            state,
            obs_buf: vec![0.0f32; OBS_FLOATS],
            ctx_buf: vec![0.0f32; CTX_FLOATS],
        })
    }

    pub fn set_ticks_per_step(&mut self, ticks_per_step: u32) {
        self.state.ticks_per_step = ticks_per_step.max(1);
    }

    pub fn reset(&mut self) -> Vec<f32> {
        self.state.reset();
        self.state.engine.extract_spatial_observation()
    }

    /// Zero-copy bytes reset returning `(obs_bytes, ctx_bytes, st_bytes, si_bytes, tile_bytes, raw_st_bytes, has_inventory)`
    pub fn reset_tactical_bytes<'py>(
        &mut self,
        py: Python<'py>,
    ) -> (
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        bool,
    ) {
        self.state.reset();
        self.state.engine.write_spatial_observation(&mut self.obs_buf);
        self.state.engine.write_army_context(&mut self.ctx_buf);
        let m = &self.state.cached_masks;
        let has_inv = m.raw_slot_type[1..].iter().any(|&b| b != 0);
        (
            PyByteArray::new(py, f32_slice_as_bytes(&self.obs_buf)),
            PyByteArray::new(py, f32_slice_as_bytes(&self.ctx_buf)),
            PyByteArray::new(py, &m.slot_type),
            PyByteArray::new(py, &m.slot_idx),
            PyByteArray::new(py, &m.tile),
            PyByteArray::new(py, &m.raw_slot_type),
            has_inv,
        )
    }

    /// Fast Rust-native tactical step returning observation & mask bytes plus full reward telemetry.
    #[pyo3(signature = (slot_type, slot_idx, tile_x, tile_y, deploy_fraction=1.0))]
    pub fn step_tactical_bytes<'py>(
        &mut self,
        py: Python<'py>,
        slot_type: u8,
        slot_idx: usize,
        tile_x: u8,
        tile_y: u8,
        deploy_fraction: f32,
    ) -> (
        (
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
        ),
        (f32, bool, u8, u8, u8, u8, f32, bool, f32),
        (bool, f32, f32, u32, bool),
    ) {
        let tel = self.state.step_tactical(
            slot_type,
            slot_idx,
            tile_x,
            tile_y,
            deploy_fraction,
            false,
            false,
            0.99,
        );
        self.state.engine.write_spatial_observation(&mut self.obs_buf);
        self.state.engine.write_army_context(&mut self.ctx_buf);
        let m = &self.state.cached_masks;
        (
            (
                PyByteArray::new(py, f32_slice_as_bytes(&self.obs_buf)),
                PyByteArray::new(py, f32_slice_as_bytes(&self.ctx_buf)),
                PyByteArray::new(py, &m.slot_type),
                PyByteArray::new(py, &m.slot_idx),
                PyByteArray::new(py, &m.tile),
                PyByteArray::new(py, &m.raw_slot_type),
            ),
            (
                tel.engine_reward,
                tel.done,
                tel.destruction_pct,
                tel.stars,
                tel.delta_pct,
                tel.delta_stars,
                tel.delta_damage_ratio,
                tel.th_just_destroyed,
                tel.time_remaining_ratio,
            ),
            (
                tel.invalid_action,
                tel.deploy_fraction,
                tel.funnel_cohesion,
                tel.tick,
                tel.has_remaining_inventory,
            ),
        )
    }

    pub fn finish_tactical_bytes<'py>(
        &mut self,
        py: Python<'py>,
    ) -> (
        (
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
        ),
        (f32, bool, u8, u8, u8, u8, f32, bool, f32, u32, u32, bool),
    ) {
        let tel = self.state.finish_tactical();
        self.state.engine.write_spatial_observation(&mut self.obs_buf);
        self.state.engine.write_army_context(&mut self.ctx_buf);
        let m = &self.state.cached_masks;
        (
            (
                PyByteArray::new(py, f32_slice_as_bytes(&self.obs_buf)),
                PyByteArray::new(py, f32_slice_as_bytes(&self.ctx_buf)),
                PyByteArray::new(py, &m.slot_type),
                PyByteArray::new(py, &m.slot_idx),
                PyByteArray::new(py, &m.tile),
                PyByteArray::new(py, &m.raw_slot_type),
            ),
            (
                tel.engine_reward,
                tel.done,
                tel.destruction_pct,
                tel.stars,
                tel.delta_pct,
                tel.delta_stars,
                tel.delta_damage_ratio,
                tel.th_just_destroyed,
                tel.time_remaining_ratio,
                tel.ff_ticks,
                tel.tick,
                tel.has_remaining_inventory,
            ),
        )
    }

    pub fn get_tactical_masks_bytes<'py>(
        &self,
        py: Python<'py>,
    ) -> (
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
    ) {
        let m = &self.state.cached_masks;
        (
            PyByteArray::new(py, &m.slot_type),
            PyByteArray::new(py, &m.slot_idx),
            PyByteArray::new(py, &m.tile),
            PyByteArray::new(py, &m.raw_slot_type),
        )
    }

    pub fn set_layout(&mut self, layout_json: &str) -> PyResult<()> {
        self.state.layout = serde_json::from_str(layout_json)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        self.state.reset();
        Ok(())
    }

    pub fn set_army(&mut self, army_json: &str) -> PyResult<()> {
        self.state.army = serde_json::from_str(army_json)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        self.state.reset();
        Ok(())
    }

    /// Returns `(slot_type_mask [7], slot_idx_masks [7][10], valid_deploy_tile_mask [2500])`
    /// where `true` indicates a currently legal action choice.
    pub fn get_action_masks(&self) -> (Vec<bool>, Vec<Vec<bool>>, Vec<bool>) {
        let (st, si) = self.state.compute_raw_masks();
        let slot_type_mask = st.to_vec();
        let slot_idx_masks = si.iter().map(|row| row.to_vec()).collect();
        let mut valid_deploy_mask = Vec::with_capacity(2500);
        for y in 0..50 {
            for x in 0..50 {
                valid_deploy_mask.push(!self.state.engine.no_deploy_mask[y][x]);
            }
        }
        (slot_type_mask, slot_idx_masks, valid_deploy_mask)
    }

    #[pyo3(signature = (slot_type, slot_idx, tile_x, tile_y, ticks_per_step, deploy_fraction=1.0))]
    pub fn step_discrete(
        &mut self,
        slot_type: u8,
        slot_idx: usize,
        tile_x: u8,
        tile_y: u8,
        ticks_per_step: u32,
        deploy_fraction: f32,
    ) -> (Vec<f32>, f32, bool, u8, u8) {
        let total_reward = self.state.step_discrete_raw(
            slot_type,
            slot_idx,
            tile_x,
            tile_y,
            ticks_per_step,
            deploy_fraction,
        );
        (
            self.state.engine.extract_spatial_observation(),
            total_reward,
            self.state.engine.is_finished,
            self.state.engine.destruction_pct,
            self.state.engine.stars,
        )
    }

    pub fn finish_battle(&mut self) -> (Vec<f32>, f32, bool, u8, u8) {
        let mut total_reward = 0.0f32;
        while !self.state.engine.is_finished && self.state.engine.tick < 1800 {
            let r = self.state.engine.step(BattleAction::NoOp);
            total_reward += r.reward;
        }
        (
            self.state.engine.extract_spatial_observation(),
            total_reward,
            self.state.engine.is_finished,
            self.state.engine.destruction_pct,
            self.state.engine.stars,
        )
    }

    pub fn get_no_deploy_mask_flat(&self) -> Vec<bool> {
        let mut out = Vec::with_capacity(2500);
        for y in 0..50 {
            for x in 0..50 {
                out.push(self.state.engine.no_deploy_mask[y][x]);
            }
        }
        out
    }

    pub fn get_state_json(&self) -> String {
        serde_json::to_string(&self.state.engine).unwrap()
    }

    pub fn get_army_context(&self) -> Vec<f32> {
        self.state.engine.extract_army_context()
    }

    pub fn get_reward_telemetry(&self) -> (f32, f32, bool, u32) {
        (
            self.state.engine.damage_dealt_total,
            self.state.engine.total_hp_pool.max(1.0),
            self.state.engine.town_hall_destroyed,
            self.state.engine.tick,
        )
    }
}

/// Rayon-parallelized vectorized battle environment running `num_envs` independent
/// `BattleEngine` instances across all CPU threads simultaneously.
#[pyclass]
pub struct PyVecBattleEnv {
    layouts: Vec<VillageLayout>,
    armies: Vec<ArmyLoadout>,
    envs: Vec<TacticalEnvState>,
    obs_buf: Vec<f32>,
    ctx_buf: Vec<f32>,
    st_mask_buf: Vec<u8>,
    si_mask_buf: Vec<u8>,
    tile_mask_buf: Vec<u8>,
}

#[pymethods]
impl PyVecBattleEnv {
    #[new]
    #[pyo3(signature = (num_envs, layouts_json, armies_json, ticks_per_step=8))]
    pub fn new(
        num_envs: usize,
        layouts_json: Vec<String>,
        armies_json: Vec<String>,
        ticks_per_step: u32,
    ) -> PyResult<Self> {
        let n = num_envs.max(1);
        let layouts: Vec<VillageLayout> = if layouts_json.is_empty() {
            get_preset_layouts()
        } else {
            layouts_json
                .iter()
                .map(|s| serde_json::from_str(s))
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?
        };
        let armies: Vec<ArmyLoadout> = if armies_json.is_empty() {
            get_preset_armies()
        } else {
            armies_json
                .iter()
                .map(|s| serde_json::from_str(s))
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?
        };

        let envs: Vec<TacticalEnvState> = (0..n)
            .into_par_iter()
            .map(|i| {
                TacticalEnvState::new(
                    layouts[i % layouts.len()].clone(),
                    armies[i % armies.len()].clone(),
                    ticks_per_step,
                )
            })
            .collect();

        Ok(Self {
            layouts,
            armies,
            envs,
            obs_buf: vec![0.0f32; n * OBS_FLOATS],
            ctx_buf: vec![0.0f32; n * CTX_FLOATS],
            st_mask_buf: vec![0u8; n * 7],
            si_mask_buf: vec![0u8; n * 70],
            tile_mask_buf: vec![0u8; n * 2500],
        })
    }

    pub fn num_envs(&self) -> usize {
        self.envs.len()
    }

    /// Resets the first `count = layout_indices.len()` environments in parallel across Rayon threads
    /// and writes their initial `(obs, ctx, slot_type_mask, slot_idx_mask, tile_mask)` into contiguous buffers.
    pub fn reset_batch<'py>(
        &mut self,
        py: Python<'py>,
        layout_indices: Vec<usize>,
        army_indices: Vec<usize>,
    ) -> (
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
        Bound<'py, PyByteArray>,
    ) {
        let count = layout_indices.len().min(self.envs.len());
        let layouts = &self.layouts;
        let armies = &self.armies;
        let envs_slice = &mut self.envs[..count];
        let obs_slice = &mut self.obs_buf[..count * OBS_FLOATS];
        let ctx_slice = &mut self.ctx_buf[..count * CTX_FLOATS];
        let st_slice = &mut self.st_mask_buf[..count * 7];
        let si_slice = &mut self.si_mask_buf[..count * 70];
        let tile_slice = &mut self.tile_mask_buf[..count * 2500];

        py.allow_threads(|| {
            envs_slice
                .par_iter_mut()
                .zip(obs_slice.par_chunks_mut(OBS_FLOATS))
                .zip(ctx_slice.par_chunks_mut(CTX_FLOATS))
                .zip(st_slice.par_chunks_mut(7))
                .zip(si_slice.par_chunks_mut(70))
                .zip(tile_slice.par_chunks_mut(2500))
                .enumerate()
                .for_each(
                    |(i, (((((env, obs_out), ctx_out), st_out), si_out), tile_out))| {
                        let l_idx = layout_indices[i] % layouts.len();
                        let a_idx = army_indices.get(i).copied().unwrap_or(0) % armies.len();
                        env.reset_with(&layouts[l_idx], &armies[a_idx]);
                        env.engine.write_spatial_observation(obs_out);
                        env.engine.write_army_context(ctx_out);
                        st_out.copy_from_slice(&env.cached_masks.slot_type);
                        si_out.copy_from_slice(&env.cached_masks.slot_idx);
                        tile_out.copy_from_slice(&env.cached_masks.tile);
                    },
                );
        });

        (
            PyByteArray::new(py, f32_slice_as_bytes(obs_slice)),
            PyByteArray::new(py, f32_slice_as_bytes(ctx_slice)),
            PyByteArray::new(py, st_slice),
            PyByteArray::new(py, si_slice),
            PyByteArray::new(py, tile_slice),
        )
    }

    /// Steps the subset `active_indices` of environments in parallel using Rayon.
    /// `actions_flat` has length `active_indices.len() * 5` (`[slot_type, slot_idx, tile_x, tile_y, frac_bin]`).
    /// When `auto_finish` is true, any environment whose inventory is depleted or reaches `is_last_step`
    /// automatically fast-forwards `finish_battle()` in parallel on its Rayon worker thread!
    #[pyo3(signature = (active_indices, actions_flat, is_last_step=false, gamma=0.99))]
    pub fn step_active_parallel<'py>(
        &mut self,
        py: Python<'py>,
        active_indices: Vec<usize>,
        actions_flat: Vec<i64>,
        is_last_step: bool,
        gamma: f32,
    ) -> (
        (
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
            Bound<'py, PyByteArray>,
        ),
        (
            Vec<f32>,
            Vec<f32>,
            Vec<f32>,
            Vec<f32>,
            Vec<bool>,
            Vec<u8>,
            Vec<u8>,
            Vec<u32>,
        ),
    ) {
        let k = active_indices.len();
        let mut active_mask = vec![false; self.envs.len()];
        let mut action_for_env = vec![[0i64; 5]; self.envs.len()];
        for (pos, &env_idx) in active_indices.iter().enumerate() {
            if env_idx < self.envs.len() && (pos + 1) * 5 <= actions_flat.len() {
                active_mask[env_idx] = true;
                let base = pos * 5;
                action_for_env[env_idx] = [
                    actions_flat[base],
                    actions_flat[base + 1],
                    actions_flat[base + 2],
                    actions_flat[base + 3],
                    actions_flat[base + 4],
                ];
            }
        }

        let n_total = self.envs.len();
        let envs_slice = &mut self.envs[..n_total];
        let obs_slice = &mut self.obs_buf[..n_total * OBS_FLOATS];
        let ctx_slice = &mut self.ctx_buf[..n_total * CTX_FLOATS];
        let st_slice = &mut self.st_mask_buf[..n_total * 7];
        let si_slice = &mut self.si_mask_buf[..n_total * 70];
        let tile_slice = &mut self.tile_mask_buf[..n_total * 2500];

        let mut step_results: Vec<(f32, f32, f32, f32, bool, u8, u8, u32)> =
            vec![(0.0, 0.0, 0.0, 0.0, false, 0, 0, 0); n_total];

        py.allow_threads(|| {
            envs_slice
                .par_iter_mut()
                .zip(obs_slice.par_chunks_mut(OBS_FLOATS))
                .zip(ctx_slice.par_chunks_mut(CTX_FLOATS))
                .zip(st_slice.par_chunks_mut(7))
                .zip(si_slice.par_chunks_mut(70))
                .zip(tile_slice.par_chunks_mut(2500))
                .zip(step_results.par_iter_mut())
                .enumerate()
                .for_each(
                    |(
                        env_idx,
                        ((((((env, obs_out), ctx_out), st_out), si_out), tile_out), res_out),
                    )| {
                        if !active_mask[env_idx] {
                            return;
                        }
                        let act = action_for_env[env_idx];
                        let s_type = act[0].clamp(0, 6) as u8;
                        let s_idx = act[1].clamp(0, 9) as usize;
                        let tx = act[2].clamp(0, 49) as u8;
                        let ty = act[3].clamp(0, 49) as u8;
                        let frac_bin = act[4].clamp(0, 4) as usize;
                        let deploy_fraction = FRACTION_BINS[frac_bin];

                        let tel = env.step_tactical(
                            s_type,
                            s_idx,
                            tx,
                            ty,
                            deploy_fraction,
                            true,
                            is_last_step,
                            gamma,
                        );
                        env.engine.write_spatial_observation(obs_out);
                        env.engine.write_army_context(ctx_out);
                        st_out.copy_from_slice(&env.cached_masks.slot_type);
                        si_out.copy_from_slice(&env.cached_masks.slot_idx);
                        tile_out.copy_from_slice(&env.cached_masks.tile);

                        *res_out = (
                            tel.custom_reward,
                            tel.reward_destr,
                            tel.reward_stars,
                            tel.reward_damage,
                            tel.done,
                            tel.destruction_pct,
                            tel.stars,
                            tel.tick,
                        );
                    },
                );
        });

        let mut custom_rewards = Vec::with_capacity(k);
        let mut r_destrs = Vec::with_capacity(k);
        let mut r_stars = Vec::with_capacity(k);
        let mut r_damages = Vec::with_capacity(k);
        let mut dones = Vec::with_capacity(k);
        let mut pcts = Vec::with_capacity(k);
        let mut stars_out = Vec::with_capacity(k);
        let mut ticks_out = Vec::with_capacity(k);

        for &env_idx in &active_indices {
            let (cr, rd, rs, rdm, dn, pc, st, tk) = step_results[env_idx];
            custom_rewards.push(cr);
            r_destrs.push(rd);
            r_stars.push(rs);
            r_damages.push(rdm);
            dones.push(dn);
            pcts.push(pc);
            stars_out.push(st);
            ticks_out.push(tk);
        }

        (
            (
                PyByteArray::new(py, f32_slice_as_bytes(obs_slice)),
                PyByteArray::new(py, f32_slice_as_bytes(ctx_slice)),
                PyByteArray::new(py, st_slice),
                PyByteArray::new(py, si_slice),
                PyByteArray::new(py, tile_slice),
            ),
            (
                custom_rewards,
                r_destrs,
                r_stars,
                r_damages,
                dones,
                pcts,
                stars_out,
                ticks_out,
            ),
        )
    }
}

/// Evaluates a batch of village layouts in parallel across all CPU threads using Rayon
/// against the heuristic attacker swarm to compute defender fitness (lower destruction & stars = higher defender score).
#[pyfunction]
fn evaluate_layouts_parallel(layouts_json: Vec<String>) -> PyResult<Vec<(u8, u8, f32)>> {
    let layouts: Vec<VillageLayout> = layouts_json
        .iter()
        .map(|s| serde_json::from_str(s))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
    let armies = get_preset_armies();

    let results: Vec<(u8, u8, f32)> = layouts
        .par_iter()
        .map(|layout| {
            let mut total_pct = 0u32;
            let mut total_stars = 0u32;
            for army in &armies {
                let mut eng = BattleEngine::new(layout, army);
                for &(_i, &(tid, count)) in
                    army.troops.iter().enumerate().collect::<Vec<_>>().iter()
                {
                    for c in 0..count {
                        let y = 18.5 + ((c as f32 * 1.3) % 12.0);
                        eng.apply_action(BattleAction::DeployTroop {
                            troop_id: tid,
                            x: 1.5,
                            y,
                        });
                    }
                }
                for (i, &(hid, _)) in army.heroes.iter().enumerate() {
                    eng.apply_action(BattleAction::DeployHero {
                        hero_id: hid,
                        x: 1.5,
                        y: 21.5 + (i as f32) * 2.0,
                    });
                }
                eng.apply_action(BattleAction::DeploySiege { x: 1.5, y: 24.5 });

                for t in 0..1800 {
                    if t == 35 || t == 75 || t == 115 {
                        if let Some((sid, _)) = eng
                            .remaining_spells
                            .iter()
                            .find(|(_, c)| *c > 0)
                            .copied()
                        {
                            eng.apply_action(BattleAction::CastSpell {
                                spell_id: sid,
                                x: 21.0,
                                y: 24.0,
                            });
                        }
                    }
                    if t == 80 {
                        for &(hid, _) in &army.heroes {
                            eng.apply_action(BattleAction::ActivateHeroAbility { hero_id: hid });
                        }
                    }
                    let info = eng.step(BattleAction::NoOp);
                    if info.is_finished {
                        break;
                    }
                }
                total_pct += eng.destruction_pct as u32;
                total_stars += eng.stars as u32;
            }
            let n = armies.len() as u32;
            let avg_pct = (total_pct / n) as u8;
            let avg_stars = (total_stars / n) as u8;
            let defender_score = 100.0 - (avg_pct as f32) - (avg_stars as f32) * 20.0;
            (avg_pct, avg_stars, defender_score)
        })
        .collect();

    Ok(results)
}

#[pymodule]
fn coc_py(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_function(wrap_pyfunction!(get_catalog_json, m)?)?;
    m.add_function(wrap_pyfunction!(validate_layout_json, m)?)?;
    m.add_function(wrap_pyfunction!(evaluate_layouts_parallel, m)?)?;
    m.add_class::<PyBattleEnv>()?;
    m.add_class::<PyVecBattleEnv>()?;
    Ok(())
}
