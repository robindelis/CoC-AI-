pub mod grid;
pub mod sim;

pub use coc_data::*;
pub use grid::*;
pub use sim::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preset_layouts_are_valid() {
        let presets = get_preset_layouts();
        assert!(!presets.is_empty());
        for layout in &presets {
            let val = validate_layout(layout);
            assert!(
                val.is_valid,
                "Layout '{}' failed validation: {:?}",
                layout.name, val.errors
            );
            assert!(!layout.buildings.is_empty());
            assert!(layout.walls.len() <= 325);
        }
    }

    #[test]
    fn test_full_th18_village_contains_every_defense() {
        let layout = build_full_th18_village();
        let mut counts: std::collections::HashMap<BuildingId, usize> =
            std::collections::HashMap::new();
        for b in &layout.buildings {
            *counts.entry(b.building_id).or_insert(0) += 1;
        }
        // Every defensive building defined for TH18 must actually be on the base.
        for spec in BUILDINGS {
            if spec.category != BuildingCategory::Defense {
                continue;
            }
            assert_eq!(
                counts.get(&spec.id).copied().unwrap_or(0),
                spec.max_count as usize,
                "{} placed {} times, expected {}",
                spec.name,
                counts.get(&spec.id).copied().unwrap_or(0),
                spec.max_count
            );
        }
        assert_eq!(counts.get(&BuildingId::TownHall).copied().unwrap_or(0), 1);
        assert!(layout.traps.len() >= 45, "traps: {}", layout.traps.len());
        assert!(layout.walls.len() > 200, "walls: {}", layout.walls.len());
    }

    #[test]
    fn test_battle_simulation_runs_and_scores() {
        let layouts = get_preset_layouts();
        let armies = get_preset_armies();
        let mut engine = BattleEngine::new(&layouts[0], &armies[0]);

        // Deploy heroes and troops along the outer border (tile 1, 24)
        assert!(engine.can_deploy_at(1.5, 24.5));
        for &(hid, _) in &armies[0].heroes {
            assert!(engine.apply_action(BattleAction::DeployHero {
                hero_id: hid,
                x: 1.5,
                y: 24.5
            }));
        }
        for &(tid, count) in &armies[0].troops {
            for i in 0..count {
                let y = 10.5 + (i as f32 * 1.5) % 28.0;
                assert!(engine.apply_action(BattleAction::DeployTroop {
                    troop_id: tid,
                    x: 1.5,
                    y
                }));
            }
        }
        assert!(engine.apply_action(BattleAction::DeploySiege { x: 1.5, y: 24.5 }));

        for t in 0..1800 {
            if t == 80 {
                for &(hid, _) in &armies[0].heroes {
                    engine.apply_action(BattleAction::ActivateHeroAbility { hero_id: hid });
                }
                engine.apply_action(BattleAction::CastSpell {
                    spell_id: SpellId::Rage,
                    x: 15.0,
                    y: 24.0,
                });
            }
            let info = engine.step(BattleAction::NoOp);
            if info.is_finished {
                break;
            }
        }

        println!(
            "Battle finished at tick {} ({:.1}s): {} stars, {}% destruction, TH destroyed={}",
            engine.tick,
            engine.time_elapsed_sec,
            engine.stars,
            engine.destruction_pct,
            engine.town_hall_destroyed
        );
        assert!(engine.damage_dealt_total > 5000.0);
        assert!(engine.destruction_pct > 10);
    }

    #[test]
    fn test_dragon_duke_and_hero_equipment_simulation() {
        let layouts = get_preset_layouts();
        let armies = get_preset_armies();
        let cat = get_full_catalog();
        assert_eq!(cat.heroes.len(), 6);
        assert_eq!(cat.equipment.len(), 43);
        assert_eq!(cat.pets.len(), 12);
        assert_eq!(layouts.len(), 5, "Five TH18 meta villages should be present");
        assert_eq!(armies.len(), 3, "Three TH18 meta compositions should be present");

        // Test custom Dragon Duke loadout + default Thrower + Healer composition
        let mut dd_army = armies[0].clone();
        dd_army.heroes[0] = (HeroId::DragonDuke, PetId::Phoenix);
        let mut engine = BattleEngine::new(&layouts[0], &dd_army);
        assert!(engine.apply_action(BattleAction::DeployHero {
            hero_id: HeroId::DragonDuke,
            x: 1.5,
            y: 24.5,
        }));
        assert!(engine.apply_action(BattleAction::DeploySiege { x: 1.5, y: 24.5 }));
        for _ in 0..120 {
            engine.step(BattleAction::NoOp);
        }
        assert!(engine.apply_action(BattleAction::ActivateHeroAbility {
            hero_id: HeroId::DragonDuke,
        }));
        for _ in 0..80 {
            engine.step(BattleAction::NoOp);
        }
        assert!(engine.damage_dealt_total > 1000.0);
    }

    #[test]
    fn test_archer_queen_default_equipment_ability() {
        // ArcherQueenAbilityHeal 445 + Archer Puppet 484 heal, invisibility
        // per ArcherQueenInvisibility L18 (7800ms) and 35 summoned archers
        // (ArcherQueenSpawnArchers L7).
        let layouts = get_preset_layouts();
        let mut army = get_preset_armies().remove(0);
        army.heroes = vec![(HeroId::ArcherQueen, PetId::Unicorn)];
        // Clear custom loadout equipment so the hero falls back to the
        // csv-authoritative default pair (Archer Puppet + Invisibility Vial).
        army.hero_equipment.clear();
        let mut engine = BattleEngine::new(&layouts[0], &army);
        assert!(engine.apply_action(BattleAction::DeployHero {
            hero_id: HeroId::ArcherQueen,
            x: 1.5,
            y: 24.5,
        }));
        let (hero_uid, hp_before) = {
            // Only the ATTACKER Queen (defender heroes share the hero kind but
            // spawn via layout.defending_heroes with equipped_items: None).
            let u = engine
                .units
                .iter_mut()
                .find(|u| u.kind == UnitKind::Hero(HeroId::ArcherQueen) && u.team == Team::Attacker)
                .expect("attacker Queen unit");
            // Damage the Queen so the ability heal is observable below max HP.
            u.hp = u.max_hp * 0.5;
            (u.id, u.hp)
        };
        assert!(engine.apply_action(BattleAction::ActivateHeroAbility {
            hero_id: HeroId::ArcherQueen
        }));
        let (hp_after, invis, archers) = {
            let u = engine
                .units
                .iter()
                .find(|u| u.id == hero_uid)
                .expect("Queen unit");
            let archers = engine
                .units
                .iter()
                .filter(|o| o.kind == UnitKind::Troop(TroopId::Archer))
                .count();
            (u.hp, u.invisibility_timer, archers)
        };
        assert!(
            hp_after > hp_before + 900.0,
            "AQ ability should heal 929 HP (445 innate + 484 Archer Puppet), healed +{}",
            hp_after - hp_before
        );
        assert!(
            (7.0..=7.9).contains(&invis),
            "AQ should be cloaked for 7.8s, got {}",
            invis
        );
        assert!(
            (30..=35).contains(&archers),
            "35 archers should be summoned, got {}",
            archers
        );

        // Default loadout invariant: naked csv stats + default equipment bonuses.
        let hspec = get_hero_spec(HeroId::ArcherQueen);
        assert_eq!(hspec.max_hp, hspec.base_hp + 700.0);
        assert_eq!(hspec.dps, hspec.base_dps + 159.0);
        assert_eq!(hspec.damage_per_hit, hspec.dps * hspec.attack_speed_sec);
    }

    #[test]
    fn test_hot_candle_and_all_four_spell_tower_modes() {
        let mut layout = get_preset_layouts().remove(0);
        let army = get_preset_armies().remove(0);

        // Ensure Hot Candle is present and configure Spell Towers for Earthquake and Invisibility
        let hot_candle = layout
            .buildings
            .iter()
            .find(|b| b.building_id == BuildingId::CraftingStation)
            .expect("Hot Candle should be in TH18 layout");
        assert_eq!(get_building_spec(hot_candle.building_id).name, "Hot Candle");

        let st_indices: Vec<usize> = layout
            .buildings
            .iter()
            .enumerate()
            .filter(|(_, b)| b.building_id == BuildingId::SpellTower)
            .map(|(i, _)| i)
            .collect();
        assert_eq!(st_indices.len(), 2);
        layout.buildings[st_indices[0]].mode = DefenseMode::SpellTowerEarthquake;
        layout.buildings[st_indices[1]].mode = DefenseMode::SpellTowerInvisibility;

        let mut engine = BattleEngine::new(&layout, &army);
        // Spawn a ground unit right next to the Earthquake Spell Tower
        let eq_st = &engine.buildings[st_indices[0]];
        let eq_x = eq_st.center_x + 1.5;
        let eq_y = eq_st.center_y;
        let uid = engine.spawn_troop_unit(TroopId::Thrower, Team::Attacker, eq_x, eq_y, None);
        let initial_hp = engine.units.iter().find(|u| u.id == uid).unwrap().hp;

        // Step ticks so EQ Spell Tower fires its vial projectile and it lands
        for _ in 0..15 {
            engine.step(BattleAction::NoOp);
        }
        let after_hp = engine.units.iter().find(|u| u.id == uid).unwrap().hp;
        assert!(
            after_hp <= initial_hp * 0.71,
            "Earthquake Spell Tower should deal at least 30% max HP damage to ground troop ({} -> {})",
            initial_hp,
            after_hp
        );
    }

    #[test]
    fn test_air_sweeper_and_firespitter_directional_cones() {
        let army = get_preset_armies().remove(0);
        let layout = VillageLayout {
            name: "Cone Test".to_string(),
            buildings: vec![
                PlacedBuilding {
                    instance_id: 1,
                    building_id: BuildingId::AirSweeper,
                    tile_x: 24,
                    tile_y: 24,
                    mode: DefenseMode::Default,
                    direction_deg: 0.0, // Pointing East (+X), 105-deg cone
                },
                PlacedBuilding {
                    instance_id: 2,
                    building_id: BuildingId::Firespitter,
                    tile_x: 24,
                    tile_y: 10,
                    mode: DefenseMode::Default,
                    direction_deg: 180.0, // Pointing West (-X), 150-deg cone
                },
            ],
            walls: vec![],
            traps: vec![],
            defending_heroes: vec![],
            defending_cc_troops: vec![],
        };

        let mut engine = BattleEngine::new(&layout, &army);
        // 1. Air Sweeper at (25.0, 25.0) facing 0 deg (+X):
        //    Spawn one Dragon in front at (30.0, 25.0) and one Dragon behind at (20.0, 25.0)
        let front_air = engine.spawn_troop_unit(TroopId::Dragon, Team::Attacker, 30.0, 25.0, None);
        let back_air = engine.spawn_troop_unit(TroopId::Dragon, Team::Attacker, 20.0, 25.0, None);

        // 2. Firespitter at (25.5, 11.5) facing 180 deg (-X):
        //    Spawn two Giants in a line in front at (19.5, 11.5) and (19.0, 11.5), and one Giant behind at (31.5, 11.5)
        let front_g1 = engine.spawn_troop_unit(TroopId::Giant, Team::Attacker, 19.5, 11.5, None);
        let front_g2 = engine.spawn_troop_unit(TroopId::Giant, Team::Attacker, 19.0, 11.5, None);
        let back_g = engine.spawn_troop_unit(TroopId::Giant, Team::Attacker, 31.5, 11.5, None);
        let g_max_hp = get_troop_spec(TroopId::Giant).max_hp;

        // Step 1 tick so both defenses fire immediately
        engine.step(BattleAction::NoOp);

        let front_x = engine.units.iter().find(|u| u.id == front_air).unwrap().x;
        let back_x = engine.units.iter().find(|u| u.id == back_air).unwrap().x;
        assert!(
            front_x > 33.0,
            "Air Sweeper should push front Dragon (+4 tiles) to >33.0, got {}",
            front_x
        );
        assert!(
            back_x < 21.0,
            "Air Sweeper must NOT push Dragon behind its 105-deg cone, got {}",
            back_x
        );

        // Advance a few ticks for Firespitter's 25 t/s penetrating fireball to travel 6 tiles
        for _ in 0..5 {
            engine.step(BattleAction::NoOp);
        }
        let g1_hp = engine.units.iter().find(|u| u.id == front_g1).unwrap().hp;
        let g2_hp = engine.units.iter().find(|u| u.id == front_g2).unwrap().hp;
        let bg_hp = engine.units.iter().find(|u| u.id == back_g).unwrap().hp;
        assert!(
            g1_hp < g_max_hp && g2_hp < g_max_hp,
            "Firespitter penetrating fireball should pierce both front Giants ({}, {})",
            g1_hp,
            g2_hp
        );
        assert_eq!(
            bg_hp, g_max_hp,
            "Firespitter must NOT hit Giant behind its 150-deg cone"
        );
    }

    #[test]
    fn test_clan_castle_lure_and_troop_focus_interrupt() {
        let army = get_preset_armies().remove(0);
        let layout = VillageLayout {
            name: "CC Focus Test".to_string(),
            buildings: vec![
                PlacedBuilding {
                    instance_id: 1,
                    building_id: BuildingId::ClanCastle,
                    tile_x: 24,
                    tile_y: 24,
                    mode: DefenseMode::Default,
                    direction_deg: 0.0,
                },
                PlacedBuilding {
                    instance_id: 2,
                    building_id: BuildingId::GoldStorage,
                    tile_x: 18,
                    tile_y: 24,
                    mode: DefenseMode::Default,
                    direction_deg: 0.0,
                },
            ],
            walls: vec![],
            traps: vec![],
            defending_heroes: vec![],
            defending_cc_troops: vec![(TroopId::IceGolem, 1), (TroopId::Archer, 1)],
        };

        let mut engine = BattleEngine::new(&layout, &army);

        // 1. Skeleton (DoesNotOpenCC = TRUE) inside 13t radius must NOT trigger Clan Castle
        let skel_id = engine.spawn_troop_unit(TroopId::Skeleton, Team::Attacker, 23.0, 25.0, None);
        engine.step(BattleAction::NoOp);
        assert!(
            !engine.defender_cc_triggered,
            "Skeletons must not open the Clan Castle (SKELETON_OPEN_CC = FALSE)"
        );
        engine.units.iter_mut().find(|u| u.id == skel_id).unwrap().alive = false;

        // 2. Air unit (Balloon) inside 13t radius only lures Archer (can hit air), leaving ground-only IceGolem inside
        let balloon_id = engine.spawn_troop_unit(TroopId::Balloon, Team::Attacker, 22.0, 25.0, None);
        engine.step(BattleAction::NoOp);
        assert!(engine.defender_cc_triggered);
        assert_eq!(
            engine.defender_cc_troops,
            vec![(TroopId::IceGolem, 1), (TroopId::Archer, 0)],
            "Air attacker should only lure air-targeting Archer, leaving ground-only Ice Golem in CC"
        );
        engine.units.iter_mut().find(|u| u.id == balloon_id).unwrap().alive = false;

        // 3. Ground attacker (Thrower) locks onto Gold Storage first, then lures Ice Golem and immediately switches focus to CC units
        let thrower_id = engine.spawn_troop_unit(TroopId::Thrower, Team::Attacker, 16.0, 25.5, None);
        engine.step(BattleAction::NoOp);
        let initial_target = engine.units.iter().find(|u| u.id == thrower_id).unwrap().target;
        assert!(
            matches!(initial_target, TargetRef::Building(_)),
            "Thrower should initially target the Gold Storage building, got {:?}",
            initial_target
        );

        // Step a few ticks so the defending CC Archer / Ice Golem walks within 7.0 tiles (CHAR_VS_CHAR_RADIUS_FOR_ATTACKER)
        for _ in 0..15 {
            engine.step(BattleAction::NoOp);
        }
        let updated_target = engine.units.iter().find(|u| u.id == thrower_id).unwrap().target;
        assert!(
            matches!(updated_target, TargetRef::Unit(_)),
            "Thrower must interrupt its building target to focus the defending Clan Castle troop within 7 tiles, got {:?}",
            updated_target
        );
    }

    #[test]
    fn test_ranged_troops_shoot_over_walls_and_respect_coc_gap_rules() {
        let army = get_preset_armies().remove(0);

        // Helper: builds a completely sealed wall box [15..35, 15..35] with a single
        // Gold Storage placed at `building_tile_x` (so gap between wall x=15 and building is `building_tile_x - 16`).
        let make_walled_box = |building_tile_x: u8| -> VillageLayout {
            let mut walls = Vec::new();
            for x in 15..=35 {
                walls.push((x, 15));
                walls.push((x, 35));
            }
            for y in 16..35 {
                walls.push((15, y));
                walls.push((35, y));
            }
            VillageLayout {
                name: "Wall Gap Test".to_string(),
                buildings: vec![PlacedBuilding {
                    instance_id: 1,
                    building_id: BuildingId::GoldStorage,
                    tile_x: building_tile_x,
                    tile_y: 24,
                    mode: DefenseMode::Default,
                    direction_deg: 0.0,
                }],
                walls,
                traps: vec![],
                defending_heroes: vec![],
                defending_cc_troops: vec![],
            }
        };

        // 1. Building with 1-tile gap behind wall (wall at x=15, building at x=17):
        //    Wizard (3.0t), Archer (3.5t), Archer Queen (5.0t), Thrower (6.0t) must ALL
        //    target the building over the wall and deal 0 damage to walls!
        for troop_id in [TroopId::Wizard, TroopId::Archer, TroopId::Bowler, TroopId::Thrower] {
            let layout = make_walled_box(17);
            let mut engine = BattleEngine::new(&layout, &army);
            let uid = engine.spawn_troop_unit(troop_id, Team::Attacker, 10.5, 25.5, None);
            for _ in 0..40 {
                engine.step(BattleAction::NoOp);
            }
            let u = engine.units.iter().find(|u| u.id == uid).unwrap();
            assert_eq!(
                u.target,
                TargetRef::Building(0),
                "{:?} should target the building behind the wall, not the wall",
                troop_id
            );
            assert!(
                engine.buildings[0].hp < engine.buildings[0].max_hp,
                "{:?} should damage the building over the wall",
                troop_id
            );
            assert!(
                engine.walls.iter().all(|w| w.hp == w.max_hp),
                "{:?} must NOT damage any wall when the building is reachable over the wall",
                troop_id
            );
        }

        // 2. Building with 2-tile gap behind wall (wall at x=15, building at x=18):
        //    - Archer (3.5t) CAN reach a 2-tile gap over the wall -> targets Building(0)
        //    - Wizard (3.0t) CANNOT reach a 2-tile gap over the wall -> must target Wall
        {
            let layout = make_walled_box(18);
            let mut engine = BattleEngine::new(&layout, &army);
            let archer_id = engine.spawn_troop_unit(TroopId::Archer, Team::Attacker, 12.5, 25.5, None);
            let wizard_id = engine.spawn_troop_unit(TroopId::Wizard, Team::Attacker, 12.5, 25.5, None);
            engine.step(BattleAction::NoOp);
            assert_eq!(
                engine.units.iter().find(|u| u.id == archer_id).unwrap().target,
                TargetRef::Building(0),
                "Archer (3.5t) should reach a building 2 tiles behind a wall"
            );
            assert!(
                matches!(
                    engine.units.iter().find(|u| u.id == wizard_id).unwrap().target,
                    TargetRef::Wall(_)
                ),
                "Wizard (3.0t) cannot reach a building 2 tiles behind a closed wall"
            );
        }

        // 3. Archer Queen (5.0t) famous 3-tile vs 4-tile Queen Walk gap rule:
        //    - 3-tile gap (wall at x=15, building at x=19): Queen targets Building(0) over the wall!
        //    - 4-tile gap (wall at x=15, building at x=20): Queen cannot reach over the wall -> targets Wall!
        //    - Thrower / Super Archer (6.0t) at 4-tile gap (x=20): CAN reach over the wall -> targets Building(0)!
        {
            let layout_3gap = make_walled_box(19);
            let mut engine_3gap = BattleEngine::new(&layout_3gap, &army);
            assert!(engine_3gap.apply_action(BattleAction::DeployHero {
                hero_id: HeroId::ArcherQueen,
                x: 10.5,
                y: 25.5,
            }));
            engine_3gap.step(BattleAction::NoOp);
            let aq_3gap = engine_3gap
                .units
                .iter()
                .find(|u| u.kind == UnitKind::Hero(HeroId::ArcherQueen))
                .unwrap();
            assert_eq!(
                aq_3gap.target,
                TargetRef::Building(0),
                "Archer Queen (5.0t) must target a building 3 tiles behind a wall"
            );

            let layout_4gap = make_walled_box(20);
            let mut engine_4gap = BattleEngine::new(&layout_4gap, &army);
            assert!(engine_4gap.apply_action(BattleAction::DeployHero {
                hero_id: HeroId::ArcherQueen,
                x: 10.5,
                y: 25.5,
            }));
            let thrower_id =
                engine_4gap.spawn_troop_unit(TroopId::Thrower, Team::Attacker, 10.5, 25.5, None);
            engine_4gap.step(BattleAction::NoOp);
            let aq_4gap = engine_4gap
                .units
                .iter()
                .find(|u| u.kind == UnitKind::Hero(HeroId::ArcherQueen))
                .unwrap();
            assert!(
                matches!(aq_4gap.target, TargetRef::Wall(_)),
                "Archer Queen (5.0t) must be blocked by a 4-tile gap behind a closed wall"
            );
            assert_eq!(
                engine_4gap.units.iter().find(|u| u.id == thrower_id).unwrap().target,
                TargetRef::Building(0),
                "Thrower (6.0t) should reach a building 4 tiles behind a wall"
            );

            // Casting a Jump Spell on the wall at (15, 25) immediately lets the Queen retarget Building(0)!
            engine_4gap.cast_spell(SpellId::Jump, Team::Attacker, 15.5, 25.5);
            engine_4gap.step(BattleAction::NoOp);
            let aq_after_jump = engine_4gap
                .units
                .iter()
                .find(|u| u.kind == UnitKind::Hero(HeroId::ArcherQueen))
                .unwrap();
            assert_eq!(
                aq_after_jump.target,
                TargetRef::Building(0),
                "Archer Queen should immediately retarget the building when a Jump Spell covers the blocking wall"
            );
        }
    }

    #[test]
    fn test_instant_spell_visual_event_survives_apply_and_step() {
        let catalog = get_full_catalog();
        let layout = &catalog.preset_layouts[0];
        let mut army = catalog.preset_armies[0].clone();
        army.spells = vec![(SpellId::Lightning, 1), (SpellId::Earthquake, 1)];
        let mut engine = BattleEngine::new(layout, &army);

        // Apply Lightning via apply_action (just like WasmBattleSession::apply_action_json)
        assert!(engine.apply_action(BattleAction::CastSpell {
            spell_id: SpellId::Lightning,
            x: 20.0,
            y: 20.0,
        }));
        assert!(
            !engine.visual_events.is_empty(),
            "CastSpell(Lightning) must emit an Explosion visual event"
        );
    }

    #[test]
    fn test_spell_hits_building_by_footprint_edge_not_center() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        // Place a 3x3 Archer Tower at (20, 20)..(23, 23), center = (21.5, 21.5)
        layout.buildings.retain(|b| b.building_id == BuildingId::TownHall);
        layout.buildings.push(PlacedBuilding {
            instance_id: 99,
            building_id: BuildingId::ArcherTower,
            tile_x: 20,
            tile_y: 20,
            mode: DefenseMode::Default,
            direction_deg: 0.0,
        });
        let mut army = catalog.preset_armies[0].clone();
        army.spells = vec![(SpellId::Freeze, 1), (SpellId::Overgrowth, 1)];
        let mut engine = BattleEngine::new(&layout, &army);

        // Cast Freeze (radius 3.5) at (16.6, 21.5):
        // Distance to footprint edge (20.0, 21.5) is 3.4 <= 3.5,
        // whereas distance to center (21.5, 21.5) is 4.9 > 3.5!
        engine.cast_spell(SpellId::Freeze, Team::Attacker, 16.6, 21.5);
        engine.step(BattleAction::NoOp);
        let tower = engine
            .buildings
            .iter()
            .find(|b| b.instance_id == 99)
            .unwrap();
        assert!(
            tower.freeze_timer > 0.0,
            "Freeze spell touching building edge (3.4t <= 3.5t) must freeze the building"
        );
    }

    #[test]
    fn test_recall_spell_recalls_heroes_and_troops_and_clone_does_not_duplicate_same_unit_48_times() {
        let catalog = get_full_catalog();
        let layout = &catalog.preset_layouts[0];
        let mut army = catalog.preset_armies[0].clone();
        army.troops = vec![(TroopId::Barbarian, 1)];
        army.spells = vec![(SpellId::Clone, 1), (SpellId::Recall, 1)];
        let mut engine = BattleEngine::new(layout, &army);

        // Deploy 1 Barbarian at (2.0, 20.0) and cast Clone at (2.0, 20.0)
        assert!(engine.apply_action(BattleAction::DeployTroop {
            troop_id: TroopId::Barbarian,
            x: 2.0,
            y: 20.0,
        }));
        assert!(engine.apply_action(BattleAction::CastSpell {
            spell_id: SpellId::Clone,
            x: 2.0,
            y: 20.0,
        }));
        for _ in 0..4 {
            engine.step(BattleAction::NoOp);
        }
        let barb_count = engine
            .units
            .iter()
            .filter(|u| u.alive && u.kind == UnitKind::Troop(TroopId::Barbarian))
            .count();
        assert_eq!(
            barb_count, 2,
            "1 Barbarian inside Clone Spell must produce 1 clone (2 total), not {}",
            barb_count
        );

        // Deploy Barbarian King at (2.0, 20.0) and Recall him
        assert!(engine.apply_action(BattleAction::DeployHero {
            hero_id: HeroId::BarbarianKing,
            x: 2.0,
            y: 20.0,
        }));
        assert!(engine.apply_action(BattleAction::CastSpell {
            spell_id: SpellId::Recall,
            x: 2.0,
            y: 20.0,
        }));
        assert!(
            engine
                .remaining_heroes
                .iter()
                .any(|(h, _)| *h == HeroId::BarbarianKing),
            "Recalled Hero must return to remaining_heroes for redeployment"
        );
    }

    #[test]
    fn test_skeleton_and_bat_spells_do_not_self_destruct_after_spawn_duration() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        layout.buildings = vec![PlacedBuilding {
            instance_id: 1,
            building_id: BuildingId::GoldStorage,
            tile_x: 40,
            tile_y: 40,
            mode: DefenseMode::Default,
            direction_deg: 0.0,
        }];
        layout.defending_heroes.clear();
        layout.defending_cc_troops.clear();
        layout.traps.clear();
        let mut army = catalog.preset_armies[0].clone();
        army.spells = vec![(SpellId::BatSpell, 1)];
        let mut engine = BattleEngine::new(&layout, &army);

        engine.cast_spell(SpellId::BatSpell, Team::Attacker, 5.0, 5.0);
        for _ in 0..200 {
            engine.step(BattleAction::NoOp);
        }
        let live_bats = engine
            .units
            .iter()
            .filter(|u| u.alive && u.kind == UnitKind::Troop(TroopId::Bat))
            .count();
        assert_eq!(
            live_bats, 25,
            "All 25 Bats must remain alive after 20s when unharmed (not self-destruct at 13.8s)"
        );
    }

    #[test]
    fn test_healer_splash_heal_and_druid_evolution() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        layout.buildings = vec![PlacedBuilding {
            instance_id: 1,
            building_id: BuildingId::GoldStorage,
            tile_x: 40,
            tile_y: 40,
            mode: DefenseMode::Default,
            direction_deg: 0.0,
        }];
        layout.defending_heroes.clear();
        layout.defending_cc_troops.clear();
        layout.traps.clear();
        let army = catalog.preset_armies[0].clone();
        let mut engine = BattleEngine::new(&layout, &army);

        // Spawn 2 injured Barbarians within 1.0 tile of each other
        let b1 = engine.spawn_troop_unit(TroopId::Barbarian, Team::Attacker, 10.0, 10.0, None);
        let b2 = engine.spawn_troop_unit(TroopId::Barbarian, Team::Attacker, 10.8, 10.0, None);
        if let Some(u) = engine.units.iter_mut().find(|u| u.id == b1) {
            u.hp = 50.0;
        }
        if let Some(u) = engine.units.iter_mut().find(|u| u.id == b2) {
            u.hp = 50.0;
        }

        // Spawn Healer nearby
        let _h = engine.spawn_troop_unit(TroopId::Healer, Team::Attacker, 10.0, 12.0, None);
        // Step until Healer pulses
        for _ in 0..15 {
            engine.step(BattleAction::NoOp);
        }
        let hp1 = engine.units.iter().find(|u| u.id == b1).unwrap().hp;
        let hp2 = engine.units.iter().find(|u| u.id == b2).unwrap().hp;
        assert!(hp1 > 50.0, "Healer must heal primary target");
        assert!(hp2 > 50.0, "Healer must splash-heal adjacent ground ally within 1.5t");

        // Spawn Druid and kill him to test DruidBear evolution
        let druid = engine.spawn_troop_unit(TroopId::Druid, Team::Attacker, 20.0, 20.0, None);
        let druid_idx = engine.units.iter().position(|u| u.id == druid).unwrap();
        engine.damage_unit(druid_idx, 5000.0);
        let has_bear = engine
            .units
            .iter()
            .any(|u| u.alive && u.kind == UnitKind::Troop(TroopId::DruidBear));
        assert!(has_bear, "Druid must transform into DruidBear upon defeat");
    }

    #[test]
    fn test_super_troops_special_mechanics() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        layout.buildings = vec![PlacedBuilding {
            instance_id: 1,
            building_id: BuildingId::GoldStorage,
            tile_x: 40,
            tile_y: 40,
            mode: DefenseMode::Default,
            direction_deg: 0.0,
        }];
        layout.walls = vec![(20, 20)];
        layout.defending_heroes.clear();
        layout.defending_cc_troops.clear();
        layout.traps.clear();
        let army = catalog.preset_armies[0].clone();
        let mut engine = BattleEngine::new(&layout, &army);

        // 1. Super Barbarian rage on spawn
        let sb = engine.spawn_troop_unit(TroopId::SuperBarbarian, Team::Attacker, 5.0, 5.0, None);
        let sb_unit = engine.units.iter().find(|u| u.id == sb).unwrap();
        assert!(sb_unit.rage_timer >= 7.9, "Super Barbarian must deploy enraged");
        assert_eq!(sb_unit.rage_boost_mult, 1.70);

        // 2. Sneaky Goblin invisibility on spawn
        let sg = engine.spawn_troop_unit(TroopId::SneakyGoblin, Team::Attacker, 6.0, 5.0, None);
        let sg_unit = engine.units.iter().find(|u| u.id == sg).unwrap();
        assert!(sg_unit.invisibility_timer >= 4.9, "Sneaky Goblin must deploy invisible");

        // 3. Super Minion long-range rocket shots
        let sm = engine.spawn_troop_unit(TroopId::SuperMinion, Team::Attacker, 7.0, 5.0, None);
        let sm_unit = engine.units.iter().find(|u| u.id == sm).unwrap();
        assert_eq!(sm_unit.limited_special_attacks, 8);
        assert!(sm_unit.range >= 9.0, "Super Minion starts with 9.75 range");

        // 4. Super Valkyrie drops Rage spell on death
        let sv = engine.spawn_troop_unit(TroopId::SuperValkyrie, Team::Attacker, 8.0, 5.0, None);
        let sv_idx = engine.units.iter().position(|u| u.id == sv).unwrap();
        engine.damage_unit(sv_idx, 9999.0);
        let has_rage_zone = engine
            .spells
            .iter()
            .any(|s| s.spell_id == SpellId::Rage && (s.x - 8.0).abs() < 0.1);
        assert!(has_rage_zone, "Super Valkyrie must drop a Rage spell on death");

        // 5. Super Wall Breaker guaranteed death detonation breaks nearby wall
        let swb = engine.spawn_troop_unit(TroopId::SuperWallBreaker, Team::Attacker, 20.5, 20.5, None);
        let swb_idx = engine.units.iter().position(|u| u.id == swb).unwrap();
        engine.damage_unit(swb_idx, 9999.0);
        assert!(engine.walls[0].destroyed, "Super Wall Breaker death detonation must breach wall");

        // 6. Ice Hound freezes defenses and spawns Frostmites on death
        let ih = engine.spawn_troop_unit(TroopId::IceHound, Team::Attacker, 40.5, 40.5, None);
        let ih_idx = engine.units.iter().position(|u| u.id == ih).unwrap();
        engine.damage_unit(ih_idx, 99999.0);
        assert!(engine.buildings[0].freeze_timer > 0.0, "Ice Hound must freeze nearby buildings");
        let frostmite_count = engine
            .units
            .iter()
            .filter(|u| u.alive && u.kind == UnitKind::Troop(TroopId::Frostmite))
            .count();
        assert_eq!(frostmite_count, 8, "Ice Hound must spawn 8 Frostmites on death");
    }

    #[test]
    fn test_siege_machines_town_hall_and_drill_stun() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        layout.buildings = vec![
            PlacedBuilding {
                instance_id: 1,
                building_id: BuildingId::TownHall,
                tile_x: 24,
                tile_y: 24,
                mode: DefenseMode::Default,
                direction_deg: 0.0,
            },
            PlacedBuilding {
                instance_id: 2,
                building_id: BuildingId::Scattershot,
                tile_x: 35,
                tile_y: 35,
                mode: DefenseMode::Default,
                direction_deg: 0.0,
            },
        ];
        layout.defending_heroes.clear();
        layout.defending_cc_troops.clear();
        layout.traps.clear();
        let mut army = catalog.preset_armies[0].clone();
        army.cc_troops = vec![(TroopId::Pekka, 1)];
        let mut engine = BattleEngine::new(&layout, &army);

        // Spawn BattleBlimp next to Town Hall
        let _bb = engine.spawn_troop_unit(TroopId::BattleBlimp, Team::Attacker, 23.5, 25.0, None);
        engine.step(BattleAction::NoOp);
        assert!(
            engine.attacker_cc_popped,
            "Battle Blimp reaching Town Hall edge must pop CC troops"
        );
        let has_cc_pekka = engine
            .units
            .iter()
            .any(|u| u.alive && u.kind == UnitKind::Troop(TroopId::Pekka));
        assert!(has_cc_pekka, "CC P.E.K.K.A must be deployed on CC pop");

        // Spawn BattleDrill burrowed, let it reach target defense
        let _bd = engine.spawn_troop_unit(TroopId::BattleDrill, Team::Attacker, 34.5, 35.0, None);
        engine.step(BattleAction::NoOp);
        let scatter = engine.buildings.iter().find(|b| b.instance_id == 2).unwrap();
        assert!(
            scatter.stun_timer > 0.0,
            "Battle Drill surfacing at target defense must stun it"
        );
    }

    #[test]
    fn test_hero_equipment_and_apprentice_warden_aura() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        layout.buildings = vec![PlacedBuilding {
            instance_id: 1,
            building_id: BuildingId::GoldStorage,
            tile_x: 40,
            tile_y: 40,
            mode: DefenseMode::Default,
            direction_deg: 0.0,
        }];
        layout.defending_heroes.clear();
        layout.defending_cc_troops.clear();
        layout.traps.clear();
        let mut army = catalog.preset_armies[0].clone();
        army.hero_equipment = vec![(
            HeroId::RoyalChampion,
            [EquipmentId::RocketSpear, EquipmentId::SeekingShield],
        )];
        let mut engine = BattleEngine::new(&layout, &army);

        // 1. Apprentice Warden Life Aura
        let _aw = engine.spawn_troop_unit(TroopId::ApprenticeWarden, Team::Attacker, 10.0, 10.0, None);
        let barb = engine.spawn_troop_unit(TroopId::Barbarian, Team::Attacker, 11.0, 10.0, None);
        engine.step(BattleAction::NoOp);
        let barb_unit = engine.units.iter().find(|u| u.id == barb).unwrap();
        assert!(
            barb_unit.life_aura_timer > 0.0,
            "Apprentice Warden must grant Life Aura to friendly troops within 7.0 tiles"
        );

        // 2. Royal Champion with Rocket Spear
        let rc_id = engine.spawn_hero_unit(HeroId::RoyalChampion, Team::Attacker, 5.0, 5.0);
        let rc_unit = engine.units.iter().find(|u| u.id == rc_id).unwrap();
        assert_eq!(rc_unit.limited_special_attacks, 10);
        assert_eq!(rc_unit.range, 10.0, "Rocket Spear grants 10.0 tiles range for first 10 attacks");
    }

    #[test]
    fn test_furnace_fire_spirit_jump_suicide_and_burn() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        layout.buildings = vec![PlacedBuilding {
            instance_id: 1,
            building_id: BuildingId::GoldStorage,
            tile_x: 15,
            tile_y: 15,
            mode: DefenseMode::Default,
            direction_deg: 0.0,
        }];
        layout.walls.clear();
        layout.traps.clear();
        layout.defending_heroes.clear();
        layout.defending_cc_troops.clear();
        let army = catalog.preset_armies[0].clone();
        let mut engine = BattleEngine::new(&layout, &army);

        // Spawn a Furnace at (10, 15) and verify it spawns a Fire Spirit after 2.7s
        let _furnace = engine.spawn_troop_unit(TroopId::Furnace, Team::Attacker, 10.0, 15.0, Some(60.0));
        for _ in 0..28 {
            engine.step(BattleAction::NoOp);
        }
        let fm_id = engine
            .units
            .iter()
            .find(|u| u.kind == UnitKind::Troop(TroopId::Firemite) && u.alive)
            .map(|u| u.id)
            .expect("Furnace must spawn a Fire Spirit (Firemite)");

        let initial_storage_hp = engine.buildings[0].hp;
        // Step until the Fire Spirit reaches 2.0t range, leaps, suicides, and sets the storage on fire
        for _ in 0..30 {
            engine.step(BattleAction::NoOp);
        }
        let fm_unit = engine.units.iter().find(|u| u.id == fm_id).unwrap();
        assert!(
            !fm_unit.alive,
            "Fire Spirit must suicide upon leaping onto its target"
        );
        let hp_after_impact = engine.buildings[0].hp;
        assert!(
            hp_after_impact < initial_storage_hp,
            "Fire Spirit jump must deal initial impact damage"
        );
        assert!(
            engine.spells.iter().any(|z| z.fire_dps > 0.0),
            "Fire Spirit jump must ignite a FireSpiritBurn zone on the target"
        );

        // Advance 20 ticks (2.0s) and verify the fire pool deals 150 DPS (300 damage over 2s)
        for _ in 0..20 {
            engine.step(BattleAction::NoOp);
        }
        assert!(
            engine.buildings[0].hp <= hp_after_impact - 280.0,
            "FireSpiritBurn must burn the target building at 150 DPS"
        );
    }

    #[test]
    fn test_log_launcher_rolling_log_pierces_walls_and_buildings() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        // Line up a Wall at (12, 25), a Gold Storage at (16, 24), and the Town Hall at (24, 24)
        layout.buildings = vec![
            PlacedBuilding {
                instance_id: 1,
                building_id: BuildingId::GoldStorage,
                tile_x: 16,
                tile_y: 24,
                mode: DefenseMode::Default,
                direction_deg: 0.0,
            },
            PlacedBuilding {
                instance_id: 2,
                building_id: BuildingId::TownHall,
                tile_x: 24,
                tile_y: 24,
                mode: DefenseMode::GuardianLogger,
                direction_deg: 0.0,
            },
        ];
        layout.walls = vec![(12, 25)];
        layout.traps.clear();
        layout.defending_heroes.clear();
        layout.defending_cc_troops.clear();
        let army = catalog.preset_armies[0].clone();
        let mut engine = BattleEngine::new(&layout, &army);

        let initial_wall_hp = engine.walls[0].hp;
        let initial_storage_hp = engine.buildings[0].hp;
        let initial_th_hp = engine.buildings[1].hp;

        // Deploy Log Launcher at (8.0, 25.5) -> distance to TH is ~16 tiles (within 20t log range!)
        let _ll = engine.spawn_troop_unit(TroopId::LogLauncher, Team::Attacker, 8.0, 25.5, None);
        // Step 32 ticks (3.2s): 1st RollingLog rolls across the wall, storage, and TH
        for _ in 0..32 {
            engine.step(BattleAction::NoOp);
        }

        // Wall must take 690 * 4.0 = 2760 damage from the first log
        assert_eq!(
            (initial_wall_hp - engine.walls[0].hp).round(),
            2760.0,
            "RollingLog must deal 4x damage (2760) to walls in its path"
        );
        // Gold Storage and Town Hall along the path must both be hit by the rolling log (690 damage)
        assert!(
            engine.buildings[0].hp <= initial_storage_hp - 690.0,
            "RollingLog must hit buildings in its way"
        );
        assert!(
            engine.buildings[1].hp <= initial_th_hp - 690.0,
            "RollingLog must roll up to 20 tiles and hit the Town Hall"
        );
    }

    #[test]
    fn test_totem_death_clears_all_targets_and_projectiles() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        layout.buildings = vec![PlacedBuilding {
            instance_id: 1,
            building_id: BuildingId::InfernoTower,
            tile_x: 20,
            tile_y: 20,
            mode: DefenseMode::InfernoSingle,
            direction_deg: 0.0,
        }];
        layout.walls.clear();
        layout.traps.clear();
        layout.defending_heroes.clear();
        layout.defending_cc_troops.clear();
        let mut army = catalog.preset_armies[0].clone();
        army.spells = vec![(SpellId::Totem, 1)];
        let mut engine = BattleEngine::new(&layout, &army);

        engine.apply_action(BattleAction::CastSpell {
            spell_id: SpellId::Totem,
            x: 22.0,
            y: 20.0,
        });
        for _ in 0..5 {
            engine.step(BattleAction::NoOp);
        }
        let totem_idx = engine
            .units
            .iter()
            .position(|u| u.kind == UnitKind::Totem && u.alive)
            .expect("Totem must be alive");
        let totem_id = engine.units[totem_idx].id;
        assert_eq!(engine.buildings[0].current_target, Some(totem_id));

        // Kill the Totem and verify building target & visual events clear cleanly
        engine.damage_unit(totem_idx, 20000.0);
        assert!(
            engine.buildings[0].current_target.is_none(),
            "Defenses must immediately clear current_target when Totem dies"
        );
        engine.step(BattleAction::NoOp);
        assert!(
            engine.visual_events.is_empty(),
            "No residual beams or explosions may remain after Totem dies"
        );
    }

    #[test]
    fn test_battle_ends_early_if_only_healing_units_alive() {
        let catalog = get_full_catalog();
        let mut layout = catalog.preset_layouts[0].clone();
        layout.buildings = vec![PlacedBuilding {
            instance_id: 1,
            building_id: BuildingId::GoldStorage,
            tile_x: 45,
            tile_y: 45,
            mode: DefenseMode::Default,
            direction_deg: 0.0,
        }];
        layout.walls.clear();
        layout.traps.clear();
        layout.defending_heroes.clear();
        layout.defending_cc_troops.clear();

        let mut army = catalog.preset_armies[0].clone();
        army.troops = vec![(TroopId::Healer, 1)];
        army.spells.clear();
        army.cc_spells.clear();
        army.heroes.clear();
        army.siege_machine = None;
        army.cc_troops.clear();

        let mut engine = BattleEngine::new(&layout, &army);

        // Deploy the healer
        engine.apply_action(BattleAction::DeployTroop {
            troop_id: TroopId::Healer,
            x: 10.0,
            y: 10.0,
        });

        // Run until tick > 10
        for _ in 0..15 {
            engine.step(BattleAction::NoOp);
        }

        assert!(
            engine.is_finished,
            "Battle must end early when only healing units (Healer/Unicorn) are alive and inventory is empty, tick was {}",
            engine.tick
        );
        assert!(
            engine.tick < 50,
            "Battle must terminate well before 1800 ticks, finished at tick {}",
            engine.tick
        );
    }

    #[test]
    fn test_59_channel_spatial_observation() {
        let layouts = get_preset_layouts();
        let armies = get_preset_armies();
        let layout = &layouts[0];
        let army = &armies[0];
        let mut engine = BattleEngine::new(layout, army);

        let obs0 = engine.extract_spatial_observation();
        assert_eq!(obs0.len(), 59 * 50 * 50);

        let idx = |ch: usize, y: usize, x: usize| ch * 2500 + y * 50 + x;

        // Base channels: TH18 core at (23, 23)
        assert_eq!(obs0[idx(2, 23, 23)], 1.0);

        // Check Clan Castle (Ch 55) in layout[0]
        let cc_b = engine.buildings.iter().find(|b| b.building_id == BuildingId::ClanCastle).expect("CC must exist");
        assert_eq!(obs0[idx(55, cc_b.tile_y as usize, cc_b.tile_x as usize)], 1.0, "Clan Castle must be 1.0 on Ch 55");

        // Check Storage (Ch 56) in layout[0]
        let storage_b = engine.buildings.iter().find(|b| {
            matches!(b.building_id, BuildingId::GoldStorage | BuildingId::ElixirStorage | BuildingId::DarkElixirStorage | BuildingId::HeroHall)
        }).expect("Storage must exist");
        let storage_val = obs0[idx(56, storage_b.tile_y as usize, storage_b.tile_x as usize)];
        assert!(storage_val > 0.0 && storage_val <= 1.0, "Storage must be in [0, 1] on Ch 56");

        // Check Collector (Ch 57) in layout[0]
        let collector_b = engine.buildings.iter().find(|b| {
            matches!(b.building_id, BuildingId::GoldMine | BuildingId::ElixirCollector | BuildingId::DarkElixirDrill)
        }).expect("Collector must exist");
        let collector_val = obs0[idx(57, collector_b.tile_y as usize, collector_b.tile_x as usize)];
        assert!(collector_val > 0.0 && collector_val <= 1.0, "Collector must be in [0, 1] on Ch 57");

        // Check Utility / Other (Ch 58) in layout[0]
        let utility_b = engine.buildings.iter().find(|b| {
            matches!(b.building_id, BuildingId::ArmyCamp | BuildingId::Laboratory | BuildingId::SpellFactory)
        }).expect("Utility building must exist");
        let utility_val = obs0[idx(58, utility_b.tile_y as usize, utility_b.tile_x as usize)];
        assert!(utility_val > 0.0 && utility_val <= 1.0, "Utility building must be in [0, 1] on Ch 58");

        // Deploy 3 Throwers at (10.5, 10.5)
        for _ in 0..3 {
            engine.spawn_troop_unit(TroopId::Thrower, Team::Attacker, 10.5, 10.5, None);
        }
        // Deploy friendly Barbarian King at (12.5, 12.5)
        engine.spawn_hero_unit(HeroId::BarbarianKing, Team::Attacker, 12.5, 12.5);

        // Deploy Defending Heroes on Defender team to verify individual channels:
        // Ch 26: Defending BK, Ch 27: Defending AQ, Ch 28: Defending GW, Ch 29: Defending RC
        engine.spawn_hero_unit(HeroId::BarbarianKing, Team::Defender, 32.5, 32.5);
        engine.spawn_hero_unit(HeroId::ArcherQueen, Team::Defender, 30.5, 30.5);
        engine.spawn_hero_unit(HeroId::GrandWarden, Team::Defender, 34.5, 34.5);
        engine.spawn_hero_unit(HeroId::RoyalChampion, Team::Defender, 36.5, 36.5);
        engine.spawn_hero_unit(HeroId::MinionPrince, Team::Defender, 38.5, 38.5);
        engine.spawn_hero_unit(HeroId::DragonDuke, Team::Defender, 40.5, 40.5);

        // Spawn Totem at (14.5, 14.5)
        engine.cast_spell(SpellId::Totem, Team::Attacker, 14.5, 14.5);

        // Cast Rage spell at (20.0, 20.0)
        engine.cast_spell(SpellId::Rage, Team::Attacker, 20.0, 20.0);

        let obs1 = engine.extract_spatial_observation();
        assert_eq!(obs1.len(), 147_500);

        // Ch 5: Thrower count 3 / 12 = 0.25 on tile (10, 10)
        let thrower_val = obs1[idx(5, 10, 10)];
        assert!((thrower_val - 0.25).abs() < 1e-4, "Thrower Ch 5 should be 0.25, got {}", thrower_val);

        // Ch 17: Friendly Barbarian King on tile (12, 12) is 1.0
        assert_eq!(obs1[idx(17, 12, 12)], 1.0);

        // Defending Heroes individual channels (Ch 26..31)
        assert_eq!(obs1[idx(26, 32, 32)], 1.0, "Defending BK should be 1.0 on Ch 26");
        assert_eq!(obs1[idx(27, 30, 30)], 1.0, "Defending AQ should be 1.0 on Ch 27");
        assert_eq!(obs1[idx(28, 34, 34)], 1.0, "Defending GW should be 1.0 on Ch 28");
        assert_eq!(obs1[idx(29, 36, 36)], 1.0, "Defending RC should be 1.0 on Ch 29");
        assert_eq!(obs1[idx(30, 38, 38)], 1.0, "Defending Minion Prince should be 1.0 on Ch 30");
        assert_eq!(obs1[idx(31, 40, 40)], 1.0, "Defending Dragon Duke should be 1.0 on Ch 31");

        // Ch 21: Totem HP ratio on tile (14, 14) is 1.0
        let totem_val = obs1[idx(21, 14, 14)];
        assert!((totem_val - 1.0).abs() < 1e-4, "Totem Ch 21 should be 1.0, got {}", totem_val);

        // Ch 22: Rage spell at center (20, 20) is 1.0 (freshly cast)
        let rage_center = obs1[idx(22, 20, 20)];
        assert!((rage_center - 1.0).abs() < 1e-4, "Rage center Ch 22 should be 1.0, got {}", rage_center);

        // Rage spell within radius (23, 20) is dist 3.0 <= radius 6.0
        let rage_near = obs1[idx(22, 20, 23)];
        assert!((rage_near - 1.0).abs() < 1e-4, "Rage near Ch 22 should be 1.0, got {}", rage_near);

        // Rage spell far outside radius (40, 40) is 0.0
        assert_eq!(obs1[idx(22, 40, 40)], 0.0);

        // Check step decay of Rage spell
        for _ in 0..10 {
            engine.step(BattleAction::NoOp);
        }
        let obs2 = engine.extract_spatial_observation();
        let rage_decayed = obs2[idx(22, 20, 20)];
        assert!(rage_decayed < 1.0 && rage_decayed > 0.0, "Rage should fade over time, got {}", rage_decayed);
    }
}
