use coc_data::{get_full_catalog, get_preset_armies, get_preset_layouts, ArmyLoadout, VillageLayout};
use coc_engine::{validate_layout, BattleAction, BattleEngine};
use pyo3::prelude::*;
use rayon::prelude::*;

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
    layout: VillageLayout,
    army: ArmyLoadout,
    engine: BattleEngine,
}

#[pymethods]
impl PyBattleEnv {
    #[new]
    #[pyo3(signature = (layout_json=None, army_json=None))]
    pub fn new(layout_json: Option<&str>, army_json: Option<&str>) -> PyResult<Self> {
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
        let engine = BattleEngine::new(&layout, &army);
        Ok(Self {
            layout,
            army,
            engine,
        })
    }

    pub fn reset(&mut self) -> Vec<f32> {
        self.engine = BattleEngine::new(&self.layout, &self.army);
        self.engine.extract_spatial_observation()
    }

    pub fn set_layout(&mut self, layout_json: &str) -> PyResult<()> {
        self.layout = serde_json::from_str(layout_json)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        self.reset();
        Ok(())
    }

    pub fn set_army(&mut self, army_json: &str) -> PyResult<()> {
        self.army = serde_json::from_str(army_json)
            .map_err(|e| pyo3::exceptions::PyValueError::new_err(e.to_string()))?;
        self.reset();
        Ok(())
    }

    /// Returns `(slot_type_mask [7], slot_idx_masks [7][10], valid_deploy_tile_mask [2500])`
    /// where `true` indicates a currently legal action choice.
    pub fn get_action_masks(&self) -> (Vec<bool>, Vec<Vec<bool>>, Vec<bool>) {
        let can_activate_hero = |hid: coc_data::HeroId| -> bool {
            let Some(&(_, uid)) = self.engine.deployed_heroes.iter().find(|(h, _)| *h == hid)
            else {
                return false;
            };
            self.engine
                .units
                .iter()
                .any(|u| u.id == uid && u.alive && !u.ability_used)
        };

        let mut slot_idx_masks = vec![vec![false; 10]; 7];
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

        let slot_type_mask = vec![
            true,
            slot_idx_masks[1].iter().any(|&b| b),
            slot_idx_masks[2].iter().any(|&b| b),
            slot_idx_masks[3].iter().any(|&b| b),
            can_deploy_siege,
            can_pop_siege,
            slot_idx_masks[6].iter().any(|&b| b),
        ];

        let mut valid_deploy_mask = Vec::with_capacity(2500);
        for y in 0..50 {
            for x in 0..50 {
                valid_deploy_mask.push(!self.engine.no_deploy_mask[y][x]);
            }
        }

        (slot_type_mask, slot_idx_masks, valid_deploy_mask)
    }

    /// Discrete action interface for RL:
    /// - `slot_type`: 0 = NoOp, 1 = Troop slot `slot_idx`, 2 = Hero slot `slot_idx`,
    ///                3 = Hero Ability `slot_idx`, 4 = Siege Machine, 5 = Pop Siege, 6 = Spell slot `slot_idx`
    /// - `tile_x`, `tile_y`: in `0..50`
    /// - `ticks_per_step`: how many simulation ticks (0.1s each) to advance per RL action
    pub fn step_discrete(
        &mut self,
        slot_type: u8,
        slot_idx: usize,
        tile_x: u8,
        tile_y: u8,
        ticks_per_step: u32,
    ) -> (Vec<f32>, f32, bool, u8, u8) {
        let x = (tile_x.min(49) as f32) + 0.5;
        let y = (tile_y.min(49) as f32) + 0.5;

        let action = match slot_type {
            1 => self
                .engine
                .remaining_troops
                .get(slot_idx)
                .map(|&(tid, _)| BattleAction::DeployTroop {
                    troop_id: tid,
                    x,
                    y,
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

        (
            self.engine.extract_spatial_observation(),
            total_reward,
            self.engine.is_finished,
            self.engine.destruction_pct,
            self.engine.stars,
        )
    }

    /// Fast-forwards the battle to completion in pure Rust when no further deployment/ability actions remain.
    pub fn finish_battle(&mut self) -> (Vec<f32>, f32, bool, u8, u8) {
        let mut total_reward = 0.0f32;
        while !self.engine.is_finished && self.engine.tick < 1800 {
            let r = self.engine.step(BattleAction::NoOp);
            total_reward += r.reward;
        }
        (
            self.engine.extract_spatial_observation(),
            total_reward,
            self.engine.is_finished,
            self.engine.destruction_pct,
            self.engine.stars,
        )
    }

    pub fn get_no_deploy_mask_flat(&self) -> Vec<bool> {
        let mut out = Vec::with_capacity(2500);
        for y in 0..50 {
            for x in 0..50 {
                out.push(self.engine.no_deploy_mask[y][x]);
            }
        }
        out
    }

    pub fn get_state_json(&self) -> String {
        serde_json::to_string(&self.engine).unwrap()
    }

    /// Returns the 64-float army & live inventory context vector.
    pub fn get_army_context(&self) -> Vec<f32> {
        self.engine.extract_army_context()
    }

    /// Fast telemetry tuple for custom reward shaping in Python RL labs:
    /// `(damage_dealt_total, total_hp_pool, town_hall_destroyed, tick)`
    pub fn get_reward_telemetry(&self) -> (f32, f32, bool, u32) {
        (
            self.engine.damage_dealt_total,
            self.engine.total_hp_pool.max(1.0),
            self.engine.town_hall_destroyed,
            self.engine.tick,
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
                // Concentrated breach along the West edge (x=1.5, y=18..30)
                for &(_i, &(tid, count)) in army.troops.iter().enumerate().collect::<Vec<_>>().iter() {
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
    Ok(())
}
