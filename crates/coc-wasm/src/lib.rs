use coc_data::{get_full_catalog, ArmyLoadout, VillageLayout};
use coc_engine::{compute_no_deploy_mask, validate_layout, BattleAction, BattleEngine, VisualEvent};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn wasm_get_catalog_json() -> String {
    serde_json::to_string(&get_full_catalog()).expect("Failed to serialize catalog")
}

#[wasm_bindgen]
pub fn wasm_validate_layout_json(layout_json: &str) -> String {
    let layout: VillageLayout = match serde_json::from_str(layout_json) {
        Ok(l) => l,
        Err(e) => {
            return serde_json::json!({
                "is_valid": false,
                "errors": [format!("Invalid JSON: {}", e)],
                "total_buildings": 0,
                "total_walls": 0,
                "total_traps": 0
            })
            .to_string();
        }
    };
    let res = validate_layout(&layout);
    serde_json::to_string(&res).unwrap()
}

#[wasm_bindgen]
pub fn wasm_compute_no_deploy_json(layout_json: &str) -> String {
    let layout: VillageLayout = match serde_json::from_str(layout_json) {
        Ok(l) => l,
        Err(_) => return "[]".to_string(),
    };
    let mask = compute_no_deploy_mask(&layout.buildings, &layout.walls);
    serde_json::to_string(&mask).unwrap()
}

#[wasm_bindgen]
pub struct WasmBattleSession {
    engine: BattleEngine,
    pending_action_events: Vec<VisualEvent>,
}

#[wasm_bindgen]
impl WasmBattleSession {
    #[wasm_bindgen(constructor)]
    pub fn new(layout_json: &str, army_json: &str) -> Result<WasmBattleSession, JsValue> {
        let layout: VillageLayout = serde_json::from_str(layout_json)
            .map_err(|e| JsValue::from_str(&format!("Layout parse error: {}", e)))?;
        let army: ArmyLoadout = serde_json::from_str(army_json)
            .map_err(|e| JsValue::from_str(&format!("Army parse error: {}", e)))?;
        Ok(WasmBattleSession {
            engine: BattleEngine::new(&layout, &army),
            pending_action_events: Vec::new(),
        })
    }

    pub fn get_state_json(&self) -> String {
        serde_json::to_string(&self.engine).unwrap()
    }

    pub fn extract_spatial_observation_json(&self) -> String {
        serde_json::to_string(&self.engine.extract_spatial_observation()).unwrap()
    }

    pub fn apply_action_json(&mut self, action_json: &str) -> bool {
        let Ok(action) = serde_json::from_str::<BattleAction>(action_json) else {
            return false;
        };
        self.engine.visual_events.clear();
        let ok = self.engine.apply_action(action);
        if ok {
            self.pending_action_events
                .extend(self.engine.visual_events.iter().cloned());
            self.engine.visual_events = self.pending_action_events.clone();
        }
        ok
    }

    /// Activates a hero's signature ability. `hero_id_json` is the serialized
    /// `HeroId` variant, e.g. `"BarbarianKing"`.
    pub fn activate_hero_ability(&mut self, hero_id_json: &str) -> bool {
        let Ok(hero_id) = serde_json::from_str::<coc_data::HeroId>(hero_id_json) else {
            return false;
        };
        self.engine.visual_events.clear();
        let ok = self
            .engine
            .apply_action(BattleAction::ActivateHeroAbility { hero_id });
        if ok {
            self.pending_action_events
                .extend(self.engine.visual_events.iter().cloned());
            self.engine.visual_events = self.pending_action_events.clone();
        }
        ok
    }

    pub fn step_ticks(&mut self, num_ticks: u32) -> String {
        let mut accumulated_events = std::mem::take(&mut self.pending_action_events);
        self.engine.visual_events.clear();
        for _ in 0..num_ticks.max(1) {
            if self.engine.is_finished {
                break;
            }
            self.engine.step(BattleAction::NoOp);
            accumulated_events.append(&mut self.engine.visual_events);
        }
        self.engine.visual_events = accumulated_events;
        serde_json::to_string(&self.engine).unwrap()
    }

    pub fn run_heuristic_ai_step(&mut self) -> String {
        // Coordinated TH18 tactical AI attacker:
        // Phase 1 (t == 0 or no attackers deployed): Funnel & Tank wave along West breach line + Siege Machine
        // Phase 2 (t >= 10): Main Army core wave + all Heroes & Pets
        // Phase 3 (t % 35 == 0): Dynamic Rage, Healing, Overgrowth, Freeze spells + Hero Equipment Abilities
        self.engine.visual_events.clear();
        let t = self.engine.tick;
        let has_attackers = self
            .engine
            .units
            .iter()
            .any(|u| u.team == coc_engine::Team::Attacker);

        if t == 0 || !has_attackers {
            for (tid, count) in self.engine.remaining_troops.clone() {
                if count == 0 {
                    continue;
                }
                let to_deploy = (count / 2).max(1);
                for i in 0..to_deploy {
                    let y = 16.5 + ((i as f32 * 1.4) % 16.0);
                    self.engine.apply_action(BattleAction::DeployTroop {
                        troop_id: tid,
                        x: 1.5,
                        y,
                    });
                }
            }
            if self.engine.remaining_siege.is_some() {
                self.engine
                    .apply_action(BattleAction::DeploySiege { x: 1.5, y: 24.5 });
            }
        } else if t >= 10
            && (!self.engine.remaining_heroes.is_empty()
                || self.engine.remaining_troops.iter().any(|(_, c)| *c > 0))
        {
            let heroes: Vec<_> = self.engine.remaining_heroes.iter().map(|(h, _)| *h).collect();
            for (i, hid) in heroes.into_iter().enumerate() {
                self.engine.apply_action(BattleAction::DeployHero {
                    hero_id: hid,
                    x: 1.5,
                    y: 21.5 + (i as f32) * 2.0,
                });
            }
            if self.engine.remaining_siege.is_some() {
                self.engine
                    .apply_action(BattleAction::DeploySiege { x: 1.5, y: 24.5 });
            }
            for (tid, count) in self.engine.remaining_troops.clone() {
                for i in 0..count {
                    let y = 18.5 + ((i as f32 * 1.1) % 12.0);
                    self.engine.apply_action(BattleAction::DeployTroop {
                        troop_id: tid,
                        x: 1.5,
                        y,
                    });
                }
            }
        } else if t % 35 == 0 {
            let mut sum_x = 0.0f32;
            let mut sum_y = 0.0f32;
            let mut n = 0usize;
            for u in &self.engine.units {
                if u.alive && u.team == coc_engine::Team::Attacker {
                    sum_x += u.x;
                    sum_y += u.y;
                    n += 1;
                }
            }
            if n > 0 {
                let cx = (sum_x / n as f32).clamp(6.0, 44.0);
                let cy = (sum_y / n as f32).clamp(6.0, 44.0);
                if let Some((sid, _)) = self
                    .engine
                    .remaining_spells
                    .iter()
                    .find(|(_, c)| *c > 0)
                    .copied()
                {
                    // Place Overgrowth/Freeze ahead of the army toward the village core
                    let (sx, sy) = if matches!(
                        sid,
                        coc_data::SpellId::Overgrowth | coc_data::SpellId::Freeze
                    ) {
                        ((cx + 25.0) * 0.5, (cy + 25.0) * 0.5)
                    } else {
                        (cx, cy)
                    };
                    self.engine.apply_action(BattleAction::CastSpell {
                        spell_id: sid,
                        x: sx,
                        y: sy,
                    });
                }
            }
            for &(hid, uid) in &self.engine.deployed_heroes.clone() {
                if let Some(u) = self.engine.units.iter().find(|u| u.id == uid && u.alive) {
                    if u.hp < u.max_hp * 0.70 || t >= 85 {
                        self.engine
                            .apply_action(BattleAction::ActivateHeroAbility { hero_id: hid });
                    }
                }
            }
        }

        let mut action_events = std::mem::take(&mut self.engine.visual_events);
        self.engine.step(BattleAction::NoOp);
        action_events.append(&mut self.engine.visual_events);
        self.engine.visual_events = action_events;
        serde_json::to_string(&self.engine).unwrap()
    }
}
