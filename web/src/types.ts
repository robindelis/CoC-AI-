export type BuildingCategory = 'TownHall' | 'Defense' | 'Resource' | 'Army' | 'Other' | 'Wall';
export type TargetDomain = 'None' | 'Ground' | 'Air' | 'GroundAndAir';
export type EquipmentRarity = 'Common' | 'Epic';

export interface BuildingSpec {
  id: string;
  name: string;
  category: BuildingCategory;
  max_level: number;
  max_count: number;
  footprint: number;
  max_hp: number;
  dps: number;
  damage_per_shot: number;
  attack_speed_sec: number;
  min_range: number;
  max_range: number;
  splash_radius: number;
  target_domain: TargetDomain;
  default_mode: string;
  available_modes: string[];
  counts_for_destruction: boolean;
}

export interface TrapSpec {
  id: string;
  name: string;
  max_level: number;
  max_count: number;
  footprint: number;
  trigger_radius: number;
  target_domain: TargetDomain;
  default_mode: string;
}

export interface TroopSpec {
  id: string;
  name: string;
  category: 'Elixir' | 'DarkElixir' | 'SuperTroop' | 'SiegeMachine' | 'Spawned';
  max_level: number;
  housing_space: number;
  max_hp: number;
  dps: number;
  damage_per_hit: number;
  attack_speed_sec: number;
  move_speed: number;
  range: number;
  splash_radius: number;
  target_domain: TargetDomain;
  preferred_target: string;
}

export interface HeroEquipmentSpec {
  id: string;
  name: string;
  hero: string;
  rarity: EquipmentRarity;
  max_level: number;
  is_passive: boolean;
  hp_bonus: number;
  dps_bonus: number;
  heal_on_activation: number;
  ability_description: string;
}

export interface HeroSpec {
  id: string;
  name: string;
  max_level: number;
  base_hp: number;
  base_dps: number;
  max_hp: number;
  dps: number;
  damage_per_hit: number;
  attack_speed_sec: number;
  move_speed: number;
  range: number;
  ability_name: string;
  ability_heal: number;
  ability_duration_sec: number;
  default_pet: string;
  default_equipment: [string, string];
}

export interface PetSpec {
  id: string;
  name: string;
  max_level: number;
  max_hp: number;
  dps: number;
  range: number;
  move_speed: number;
}

export interface SpellSpec {
  id: string;
  name: string;
  is_dark: boolean;
  max_level: number;
  housing_space: number;
  radius: number;
  duration_sec: number;
}

export interface PlacedBuilding {
  instance_id: number;
  building_id: string;
  tile_x: number;
  tile_y: number;
  mode: string;
  direction_deg: number;
}

export interface PlacedTrap {
  instance_id: number;
  trap_id: string;
  tile_x: number;
  tile_y: number;
  mode: string;
}

export interface PlacedHeroBanner {
  hero_id: string;
  tile_x: number;
  tile_y: number;
}

export interface VillageLayout {
  name: string;
  buildings: PlacedBuilding[];
  walls: [number, number][];
  traps: PlacedTrap[];
  defending_heroes: PlacedHeroBanner[];
  defending_cc_troops: [string, number][];
}

export interface ArmyLoadout {
  name: string;
  troops: [string, number][];
  spells: [string, number][];
  heroes: [string, string][];
  hero_equipment?: [string, [string, string]][];
  siege_machine: string | null;
  cc_troops: [string, number][];
  cc_spells: [string, number][];
}

export interface FullCatalog {
  buildings: BuildingSpec[];
  traps: TrapSpec[];
  troops: TroopSpec[];
  heroes: HeroSpec[];
  equipment: HeroEquipmentSpec[];
  pets: PetSpec[];
  spells: SpellSpec[];
  preset_layouts: VillageLayout[];
  preset_armies: ArmyLoadout[];
}

export interface SimBuilding {
  index: number;
  instance_id: number;
  building_id: string;
  name: string;
  category: BuildingCategory;
  tile_x: number;
  tile_y: number;
  footprint: number;
  center_x: number;
  center_y: number;
  hp: number;
  max_hp: number;
  mode: string;
  direction_deg: number;
  current_target: number | null;
  inferno_ramp_sec: number;
  is_hidden_tesla_revealed: boolean;
  spell_cooldown?: number;
  candle_melt_timer?: number;
  candle_stage?: number;
  freeze_timer: number;
  stun_timer: number;
  overgrowth_timer: number;
  invisibility_timer: number;
  rage_timer: number;
  destroyed: boolean;
}

export interface SimWall {
  index: number;
  tile_x: number;
  tile_y: number;
  hp: number;
  max_hp: number;
  destroyed: boolean;
}

export interface SimTrap {
  instance_id: number;
  trap_id: string;
  tile_x: number;
  tile_y: number;
  center_x: number;
  center_y: number;
  mode: string;
  triggered: boolean;
}

export interface SimUnit {
  id: number;
  kind: { Troop?: string; Hero?: string; Pet?: string } | 'Totem';
  name: string;
  team: 'Attacker' | 'Defender';
  x: number;
  y: number;
  hp: number;
  max_hp: number;
  base_dps: number;
  range: number;
  is_air: boolean;
  is_burrowed: boolean;
  freeze_timer: number;
  stun_timer: number;
  invisibility_timer: number;
  invincibility_timer: number;
  rage_timer: number;
  haste_timer: number;
  poison_timer: number;
  ability_used: boolean;
  ability_active_timer: number;
  equipped_items?: [string, string] | null;
  target: 'None' | { Building?: number; Wall?: number; Unit?: number };
  waypoints: [number, number][];
  alive: boolean;
}

export interface ActiveSpellZone {
  spell_id: string;
  team: 'Attacker' | 'Defender';
  x: number;
  y: number;
  radius: number;
  remaining_sec: number;
  total_duration_sec?: number;
}

export type ProjectileKind =
  | 'Arrow'
  | 'Cannonball'
  | 'MortarShell'
  | 'ScatterBundle'
  | 'WizardFireball'
  | 'Rocket'
  | 'CandleFlame'
  | 'Spear'
  | 'Boulder'
  | 'FlameSpirit'
  | 'Log'
  | 'SpellVial'
  | 'EnergyBolt';

export interface SimProjectile {
  id: number;
  kind: ProjectileKind;
  team: 'Attacker' | 'Defender';
  from_x: number;
  from_y: number;
  x: number;
  y: number;
  target_x: number;
  target_y: number;
  homing: boolean;
  speed: number;
  progress: number;
  total_dist: number;
  arc_height: number;
  damage: number;
  splash_radius: number;
  color: string;
}

export type VisualEvent =
  | {
      Projectile: {
        from_x: number;
        from_y: number;
        to_x: number;
        to_y: number;
        color: string;
        splash_radius: number;
      };
    }
  | {
      Beam: {
        from_x: number;
        from_y: number;
        to_x: number;
        to_y: number;
        color: string;
        width: number;
      };
    }
  | {
      Explosion: {
        x: number;
        y: number;
        radius: number;
        color: string;
      };
    }
  | {
      HealPulse: {
        x: number;
        y: number;
        radius: number;
      };
    };

export interface BattleEngineState {
  tick: number;
  time_elapsed_sec: number;
  buildings: SimBuilding[];
  walls: SimWall[];
  traps: SimTrap[];
  units: SimUnit[];
  projectiles: SimProjectile[];
  spells: ActiveSpellZone[];
  visual_events: VisualEvent[];
  no_deploy_mask: boolean[][];
  remaining_troops: [string, number][];
  remaining_spells: [string, number][];
  remaining_heroes: [string, string][];
  hero_equipment: [string, [string, string]][];
  deployed_heroes: [string, number][];
  remaining_siege: string | null;
  active_siege_unit_id: number | null;
  attacker_cc_popped: boolean;
  total_scorable_buildings: number;
  destroyed_scorable_buildings: number;
  destruction_pct: number;
  town_hall_destroyed: boolean;
  stars: number;
  damage_dealt_total: number;
  is_finished: boolean;
}
