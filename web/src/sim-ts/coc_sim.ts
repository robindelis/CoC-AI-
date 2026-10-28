import {
  ActiveSpellZone,
  ArmyLoadout,
  BattleEngineState,
  BuildingSpec,
  HeroEquipmentSpec,
  HeroSpec,
  PetSpec,
  PlacedBuilding,
  ProjectileKind,
  SimBuilding,
  SimProjectile,
  SimTrap,
  SimUnit,
  SimWall,
  SpellSpec,
  TrapSpec,
  TroopSpec,
  VillageLayout,
  VisualEvent,
} from '../types';
import { FULL_CATALOG } from './catalogData';

const DT = 0.1;
const MAX_TICKS = 1800;
const MAP_SIZE = 50;
const BUILD_MIN = 3;
const BUILD_MAX = 47;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const BUILDING_MAP = new Map<string, BuildingSpec>(
  FULL_CATALOG.buildings.map((b) => [b.id, b])
);
const TRAP_MAP = new Map<string, TrapSpec>(
  FULL_CATALOG.traps.map((t) => [t.id, t])
);
const TROOP_MAP = new Map<string, TroopSpec & { movement?: string }>(
  FULL_CATALOG.troops.map((t) => [t.id, t as TroopSpec & { movement?: string }])
);
const HERO_MAP = new Map<string, HeroSpec & { movement?: string }>(
  FULL_CATALOG.heroes.map((h) => [h.id, h as HeroSpec & { movement?: string }])
);
const EQUIP_MAP = new Map<string, HeroEquipmentSpec>(
  FULL_CATALOG.equipment.map((e) => [e.id, e])
);
const PET_MAP = new Map<
  string,
  PetSpec & {
    movement?: string;
    damage_per_hit?: number;
    attack_speed_sec?: number;
    target_domain?: string;
    preferred_target?: string;
  }
>(FULL_CATALOG.pets.map((p) => [p.id, p as PetSpec & { movement?: string }]));
const SPELL_MAP = new Map<string, SpellSpec>(
  FULL_CATALOG.spells.map((s) => [s.id, s])
);

export default async function initWasm(): Promise<void> {
  return Promise.resolve();
}

export function wasm_get_catalog_json(): string {
  return JSON.stringify(FULL_CATALOG);
}

export function computeNoDeployMask(
  buildings: PlacedBuilding[],
  walls: [number, number][]
): boolean[][] {
  const mask: boolean[][] = Array.from({ length: MAP_SIZE }, () =>
    Array(MAP_SIZE).fill(false)
  );
  for (const b of buildings) {
    const spec = BUILDING_MAP.get(b.building_id);
    const size = spec ? spec.footprint : 3;
    const x0 = Math.max(0, b.tile_x - 1);
    const y0 = Math.max(0, b.tile_y - 1);
    const x1 = Math.min(MAP_SIZE, b.tile_x + size + 1);
    const y1 = Math.min(MAP_SIZE, b.tile_y + size + 1);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        mask[y][x] = true;
      }
    }
  }
  for (const [wx, wy] of walls) {
    const x0 = Math.max(0, wx - 1);
    const y0 = Math.max(0, wy - 1);
    const x1 = Math.min(MAP_SIZE, wx + 2);
    const y1 = Math.min(MAP_SIZE, wy + 2);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        mask[y][x] = true;
      }
    }
  }
  return mask;
}

export function wasm_compute_no_deploy_json(layoutJson: string): string {
  try {
    const layout = JSON.parse(layoutJson) as VillageLayout;
    return JSON.stringify(
      computeNoDeployMask(layout.buildings ?? [], layout.walls ?? [])
    );
  } catch {
    return '[]';
  }
}

export function validateLayout(layout: VillageLayout) {
  const errors: string[] = [];
  const occ: boolean[][] = Array.from({ length: 50 }, () =>
    Array(50).fill(false)
  );
  const counts = new Map<string, number>();

  for (const b of layout.buildings ?? []) {
    const spec = BUILDING_MAP.get(b.building_id);
    if (!spec) continue;
    counts.set(b.building_id, (counts.get(b.building_id) ?? 0) + 1);
    const size = spec.footprint;
    if (
      b.tile_x < BUILD_MIN ||
      b.tile_y < BUILD_MIN ||
      b.tile_x + size > BUILD_MAX ||
      b.tile_y + size > BUILD_MAX
    ) {
      errors.push(
        `${spec.name} (#${b.instance_id}) at (${b.tile_x}, ${b.tile_y}) is outside buildable area`
      );
      continue;
    }
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const cx = b.tile_x + dx;
        const cy = b.tile_y + dy;
        if (occ[cy][cx]) {
          errors.push(
            `${spec.name} (#${b.instance_id}) overlaps another structure at (${cx}, ${cy})`
          );
        }
        occ[cy][cx] = true;
      }
    }
  }

  for (const [wx, wy] of layout.walls ?? []) {
    if (wx < BUILD_MIN || wy < BUILD_MIN || wx >= BUILD_MAX || wy >= BUILD_MAX) {
      errors.push(`Wall at (${wx}, ${wy}) is outside buildable area`);
      continue;
    }
    occ[wy][wx] = true;
  }

  return {
    is_valid: errors.length === 0,
    errors,
    total_buildings: (layout.buildings ?? []).length,
    total_walls: (layout.walls ?? []).length,
    total_traps: (layout.traps ?? []).length,
  };
}

export function wasm_validate_layout_json(layoutJson: string): string {
  try {
    const layout = JSON.parse(layoutJson) as VillageLayout;
    return JSON.stringify(validateLayout(layout));
  } catch (e) {
    return JSON.stringify({
      is_valid: false,
      errors: [`Invalid JSON: ${String(e)}`],
      total_buildings: 0,
      total_walls: 0,
      total_traps: 0,
    });
  }
}

export type BattleActionInput =
  | 'NoOp'
  | { NoOp?: null }
  | {
      DeployTroop: {
        troop_id: string;
        x: number;
        y: number;
        count?: number;
        deploy_fraction?: number;
      };
    }
  | {
      DeployTroopBatch: {
        troop_id: string;
        x: number;
        y: number;
        count: number;
      };
    }
  | { DeployHero: { hero_id: string; x: number; y: number } }
  | { ActivateHeroAbility: { hero_id: string } }
  | { DeploySiege: { x: number; y: number } }
  | 'PopSiegeMachine'
  | { PopSiegeMachine?: null }
  | { CastSpell: { spell_id: string; x: number; y: number } };

interface InternalUnit extends SimUnit {
  damage_per_hit: number;
  attack_speed_sec: number;
  move_speed: number;
  splash_radius: number;
  housing_space: number;
  movement: string;
  target_domain: string;
  preferred_target: string;
  attack_cooldown: number;
  special_timer: number;
  lifetime_remaining: number | null;
  anchor_pos: [number, number] | null;
  paired_hero_id: number | null;
}

interface InternalBuilding extends SimBuilding {
  attack_cooldown: number;
  counts_for_destruction: boolean;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function buildingEdgeDist(b: SimBuilding, px: number, py: number): number {
  const ex = Math.max(b.tile_x, Math.min(b.tile_x + b.footprint, px));
  const ey = Math.max(b.tile_y, Math.min(b.tile_y + b.footprint, py));
  return dist(px, py, ex, ey);
}

function canHitDomain(domain: string, isAir: boolean): boolean {
  if (domain === 'GroundAndAir') return true;
  if (domain === 'Ground') return !isAir;
  if (domain === 'Air') return isAir;
  return false;
}

/**
 * Hierarchical Tactical-Archetype Signature phi(u) in (0, 1] for 2D CNN channels 8 & 9.
 * Strictly separates Ground Skeletons (0.10) from Air Skeletons (0.28) using `u.is_air`.
 */
export function unitTypeSignature(u: InternalUnit): number {
  if (u.kind === 'Totem') return 0.14;
  if ('Pet' in u.kind) return 0.93;
  if ('Hero' in u.kind) {
    const hid = u.kind.Hero;
    return hid === 'MinionPrince' || hid === 'DragonDuke' ? 0.99 : 0.96;
  }
  const tid = u.kind.Troop;
  switch (tid) {
    case 'Skeleton':
      return u.is_air ? 0.28 : 0.10;
    case 'ArmoredSkeleton':
      return 0.12;
    case 'Yetimite':
    case 'Firemite':
    case 'Frostmite':
    case 'Booger':
    case 'Snake':
      return 0.14;
    case 'Barbarian':
    case 'SuperBarbarian':
    case 'Goblin':
    case 'SneakyGoblin':
    case 'Miner':
    case 'HogRider':
      return 0.18;
    case 'WallBreaker':
    case 'SuperWallBreaker':
    case 'Headhunter':
      return 0.22;
    case 'Bat':
      return 0.32;
    case 'Minion':
    case 'SuperMinion':
    case 'BabyDragon':
    case 'InfernoDragon':
      return 0.36;
    case 'Balloon':
    case 'RocketBalloon':
    case 'DragonRider':
      return 0.40;
    case 'Archer':
    case 'SuperArcher':
    case 'Wizard':
    case 'SuperWizard':
      return 0.46;
    case 'Witch':
    case 'SuperWitch':
    case 'ApprenticeWarden':
    case 'Druid':
    case 'Furnace':
      return 0.52;
    case 'Valkyrie':
    case 'SuperValkyrie':
    case 'Bowler':
    case 'SuperBowler':
    case 'SuperMiner':
      return 0.56;
    case 'Thrower':
    case 'Yeti':
    case 'SuperYeti':
    case 'ElectroTitan':
      return 0.60;
    case 'Giant':
    case 'SuperGiant':
    case 'DruidBear':
      return 0.66;
    case 'IceGolem':
    case 'Golem':
      return 0.70;
    case 'RootRider':
    case 'Pekka':
      return 0.74;
    case 'GuardianLogger':
    case 'GuardianLongshot':
    case 'GuardianSmasher':
      return 0.78;
    case 'Healer':
      return 0.81;
    case 'Dragon':
    case 'SuperDragon':
    case 'ElectroDragon':
      return 0.85;
    case 'LavaHound':
    case 'IceHound':
      return 0.89;
    case 'WallWrecker':
    case 'BattleBlimp':
    case 'StoneSlammer':
    case 'SiegeBarracks':
    case 'LogLauncher':
    case 'FlameFlinger':
    case 'BattleDrill':
      return 0.91;
    default:
      return u.is_air ? 0.36 : 0.46;
  }
}

export class WasmBattleSession {
  private state: BattleEngineState;
  private internalBuildings: InternalBuilding[];
  private internalUnits: InternalUnit[];
  private attackerCcTroops: [string, number][];
  private defenderCcTroops: [string, number][];
  private defenderCcTriggered = false;
  private guardianSpawned = false;
  private nextUnitId = 1;
  private nextProjectileId = 1;
  private pendingActionEvents: VisualEvent[] = [];

  constructor(layoutJson: string, armyJson: string) {
    const layout: VillageLayout = JSON.parse(layoutJson);
    const army: ArmyLoadout = JSON.parse(armyJson);

    const noDeployMask = computeNoDeployMask(
      layout.buildings ?? [],
      layout.walls ?? []
    );

    let totalScorable = 0;
    this.internalBuildings = (layout.buildings ?? []).map((pb, index) => {
      const spec = BUILDING_MAP.get(pb.building_id) ?? FULL_CATALOG.buildings[0];
      if (spec.counts_for_destruction) {
        totalScorable += 1;
      }
      const half = spec.footprint * 0.5;
      return {
        index,
        instance_id: pb.instance_id,
        building_id: pb.building_id,
        name: spec.name,
        category: spec.category,
        tile_x: pb.tile_x,
        tile_y: pb.tile_y,
        footprint: spec.footprint,
        center_x: pb.tile_x + half,
        center_y: pb.tile_y + half,
        hp: spec.max_hp,
        max_hp: spec.max_hp,
        mode: pb.mode,
        direction_deg: pb.direction_deg ?? 0,
        current_target: null,
        inferno_ramp_sec: 0,
        is_hidden_tesla_revealed: pb.building_id !== 'HiddenTesla',
        spell_cooldown: 0,
        candle_melt_timer: 0,
        candle_stage: 1,
        freeze_timer: 0,
        stun_timer: 0,
        overgrowth_timer: 0,
        invisibility_timer: 0,
        rage_timer: 0,
        destroyed: false,
        attack_cooldown: 0,
        counts_for_destruction: spec.counts_for_destruction,
      };
    });

    const wallSpec = BUILDING_MAP.get('Wall');
    const wallMaxHp = wallSpec ? wallSpec.max_hp : 14000;
    const walls: SimWall[] = (layout.walls ?? []).map(([wx, wy], index) => ({
      index,
      tile_x: wx,
      tile_y: wy,
      hp: wallMaxHp,
      max_hp: wallMaxHp,
      destroyed: false,
    }));

    const traps: SimTrap[] = (layout.traps ?? []).map((pt) => {
      const tspec = TRAP_MAP.get(pt.trap_id);
      const half = (tspec ? tspec.footprint : 1) * 0.5;
      return {
        instance_id: pt.instance_id,
        trap_id: pt.trap_id,
        tile_x: pt.tile_x,
        tile_y: pt.tile_y,
        center_x: pt.tile_x + half,
        center_y: pt.tile_y + half,
        mode: pt.mode,
        triggered: false,
      };
    });

    const remainingSpells: [string, number][] = (army.spells ?? []).map(
      ([s, c]) => [s, c]
    );
    for (const [sid, count] of army.cc_spells ?? []) {
      if (count <= 0) continue;
      const existing = remainingSpells.find(([s]) => s === sid);
      if (existing) {
        existing[1] += count;
      } else {
        remainingSpells.push([sid, count]);
      }
    }

    this.internalUnits = [];
    this.attackerCcTroops = (army.cc_troops ?? []).map(([t, c]) => [t, c]);
    this.defenderCcTroops = (layout.defending_cc_troops ?? []).map(([t, c]) => [
      t,
      c,
    ]);

    for (const hb of layout.defending_heroes ?? []) {
      const hspec = HERO_MAP.get(hb.hero_id);
      if (!hspec) continue;
      const ax = hb.tile_x + 1.0;
      const ay = hb.tile_y + 1.0;
      const uid = this.nextUnitId++;
      this.internalUnits.push({
        id: uid,
        kind: { Hero: hb.hero_id },
        name: hspec.name,
        team: 'Defender',
        x: ax,
        y: ay,
        hp: hspec.base_hp,
        max_hp: hspec.base_hp,
        base_dps: hspec.base_dps,
        damage_per_hit: hspec.damage_per_hit,
        attack_speed_sec: hspec.attack_speed_sec,
        move_speed: hspec.move_speed,
        range: hspec.range,
        splash_radius: 0,
        housing_space: 25,
        is_air: hspec.movement === 'Air',
        movement: 'JumpWalls',
        target_domain: 'GroundAndAir',
        preferred_target: 'Any',
        is_burrowed: false,
        freeze_timer: 0,
        stun_timer: 0,
        invisibility_timer: 0,
        invincibility_timer: 0,
        rage_timer: 0,
        haste_timer: 0,
        poison_timer: 0,
        ability_used: true,
        ability_active_timer: 0,
        equipped_items: null,
        target: 'None',
        waypoints: [],
        alive: true,
        attack_cooldown: 0,
        special_timer: 0,
        lifetime_remaining: null,
        anchor_pos: [ax, ay],
        paired_hero_id: null,
      });
    }

    this.state = {
      tick: 0,
      time_elapsed_sec: 0,
      buildings: this.internalBuildings,
      walls,
      traps,
      units: this.internalUnits,
      projectiles: [],
      spells: [],
      visual_events: [],
      no_deploy_mask: noDeployMask,
      remaining_troops: (army.troops ?? []).map(([t, c]) => [t, c]),
      remaining_spells: remainingSpells,
      remaining_heroes: (army.heroes ?? []).map(([h, p]) => [h, p]),
      hero_equipment: (army.hero_equipment ?? []).map(([h, eq]) => [
        h,
        [eq[0], eq[1]],
      ]),
      deployed_heroes: [],
      remaining_siege: army.siege_machine ?? null,
      active_siege_unit_id: null,
      attacker_cc_popped: false,
      total_scorable_buildings: Math.max(1, totalScorable),
      destroyed_scorable_buildings: 0,
      destruction_pct: 0,
      town_hall_destroyed: false,
      stars: 0,
      damage_dealt_total: 0,
      is_finished: false,
    };
  }

  public free(): void {
    // No-op in JS/TS runtime
  }

  public get_state_json(): string {
    return JSON.stringify(this.state);
  }

  public extract_spatial_observation(): number[] {
    const obs = new Array<number>(10 * 50 * 50).fill(0);
    const idx = (ch: number, y: number, x: number) => ch * 2500 + y * 50 + x;

    for (const b of this.internalBuildings) {
      if (b.destroyed) continue;
      const hpNorm = Math.max(0, Math.min(1, b.hp / 11000.0));
      const spec = BUILDING_MAP.get(b.building_id);
      const dpsNorm = Math.max(0, Math.min(1, (spec?.dps ?? 0) / 750.0));
      const isTh = b.building_id === 'TownHall' ? 1.0 : 0.0;
      for (let dy = 0; dy < b.footprint; dy++) {
        for (let dx = 0; dx < b.footprint; dx++) {
          const x = Math.min(49, b.tile_x + dx);
          const y = Math.min(49, b.tile_y + dy);
          obs[idx(0, y, x)] = hpNorm;
          obs[idx(1, y, x)] = dpsNorm;
          obs[idx(2, y, x)] = isTh;
        }
      }
    }

    for (const w of this.state.walls) {
      if (!w.destroyed) {
        obs[idx(3, w.tile_y, w.tile_x)] = Math.max(
          0,
          Math.min(1, w.hp / Math.max(1, w.max_hp))
        );
      }
    }

    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        if (this.state.no_deploy_mask[y]?.[x]) {
          obs[idx(4, y, x)] = 1.0;
        }
      }
    }

    for (const u of this.internalUnits) {
      if (!u.alive) continue;
      const x = Math.max(0, Math.min(49, Math.floor(u.x)));
      const y = Math.max(0, Math.min(49, Math.floor(u.y)));
      const sig = unitTypeSignature(u);
      if (u.team === 'Attacker') {
        const ch = u.is_air ? 6 : 5;
        obs[idx(ch, y, x)] = Math.min(1.0, obs[idx(ch, y, x)] + u.hp / 5000.0);
        if (sig > obs[idx(8, y, x)]) {
          obs[idx(8, y, x)] = sig;
        }
      } else {
        if (sig > obs[idx(9, y, x)]) {
          obs[idx(9, y, x)] = sig;
        }
      }
    }

    for (const z of this.state.spells) {
      const x = Math.max(0, Math.min(49, Math.floor(z.x)));
      const y = Math.max(0, Math.min(49, Math.floor(z.y)));
      obs[idx(7, y, x)] = 1.0;
    }

    return obs;
  }

  public extract_spatial_observation_json(): string {
    return JSON.stringify(this.extract_spatial_observation());
  }

  public extract_army_context(): number[] {
    const ctx = new Array<number>(64).fill(0);
    const activeAttackers = this.internalUnits.filter(
      (u) => u.alive && u.team === 'Attacker'
    ).length;
    ctx[0] = Math.max(0, Math.min(1, (1800 - this.state.tick) / 1800));
    ctx[1] = Math.max(0, Math.min(1, this.state.destruction_pct / 100));
    ctx[2] = Math.max(0, Math.min(1, this.state.stars / 3));
    ctx[3] = Math.max(0, Math.min(1, activeAttackers / 50));

    for (let i = 0; i < 10; i++) {
      const entry = this.state.remaining_troops[i];
      if (entry) {
        const tIdx = FULL_CATALOG.troops.findIndex((t) => t.id === entry[0]);
        ctx[4 + i * 2] = Math.max(0, Math.min(1, (tIdx + 1) / 60));
        ctx[4 + i * 2 + 1] = Math.max(0, Math.min(1, entry[1] / 20));
      }
    }

    for (let i = 0; i < 10; i++) {
      const entry = this.state.remaining_spells[i];
      if (entry) {
        const sIdx = FULL_CATALOG.spells.findIndex((s) => s.id === entry[0]);
        ctx[24 + i * 2] = Math.max(0, Math.min(1, (sIdx + 1) / 20));
        ctx[24 + i * 2 + 1] = Math.max(0, Math.min(1, entry[1] / 8));
      }
    }

    return ctx;
  }

  public extract_army_context_json(): string {
    return JSON.stringify(this.extract_army_context());
  }

  private canDeployAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= 50 || y >= 50) return false;
    const tx = Math.max(0, Math.min(49, Math.floor(x)));
    const ty = Math.max(0, Math.min(49, Math.floor(y)));
    return !this.state.no_deploy_mask[ty]?.[tx];
  }

  private spawnTroopUnit(
    troopId: string,
    team: 'Attacker' | 'Defender',
    x: number,
    y: number,
    lifetime: number | null = null
  ): number {
    const spec = TROOP_MAP.get(troopId) ?? FULL_CATALOG.troops[0];
    const uid = this.nextUnitId++;
    const movement = (spec as { movement?: string }).movement ?? 'Ground';
    const isAir = movement === 'Air';
    const unit: InternalUnit = {
      id: uid,
      kind: { Troop: troopId },
      name: spec.name,
      team,
      x: Math.max(0.5, Math.min(49.5, x)),
      y: Math.max(0.5, Math.min(49.5, y)),
      hp: spec.max_hp,
      max_hp: spec.max_hp,
      base_dps: spec.dps,
      damage_per_hit: spec.damage_per_hit,
      attack_speed_sec: Math.max(0.2, spec.attack_speed_sec),
      move_speed: spec.move_speed,
      range: spec.range,
      splash_radius: spec.splash_radius,
      housing_space: spec.housing_space,
      is_air: isAir,
      movement: team === 'Defender' && !isAir ? 'JumpWalls' : movement,
      target_domain: spec.target_domain,
      preferred_target: spec.preferred_target,
      is_burrowed: movement === 'Burrow',
      freeze_timer: 0,
      stun_timer: 0,
      invisibility_timer: troopId === 'SneakyGoblin' ? 5.0 : 0,
      invincibility_timer: 0,
      rage_timer: troopId === 'SuperBarbarian' ? 8.0 : 0,
      haste_timer: troopId === 'RocketBalloon' ? 4.0 : 0,
      poison_timer: 0,
      ability_used: false,
      ability_active_timer: 0,
      equipped_items: null,
      target: 'None',
      waypoints: [],
      alive: true,
      attack_cooldown: 0,
      special_timer: 0,
      lifetime_remaining:
        lifetime ?? (troopId === 'Furnace' ? 60.0 : troopId === 'SiegeBarracks' ? 30.0 : null),
      anchor_pos: null,
      paired_hero_id: null,
    };
    this.internalUnits.push(unit);
    return uid;
  }

  private spawnHeroUnit(
    heroId: string,
    team: 'Attacker' | 'Defender',
    x: number,
    y: number
  ): number {
    const spec = HERO_MAP.get(heroId) ?? FULL_CATALOG.heroes[0];
    const eqPair =
      this.state.hero_equipment.find(([h]) => h === heroId)?.[1] ??
      spec.default_equipment;
    const eq0 = EQUIP_MAP.get(eqPair[0]);
    const eq1 = EQUIP_MAP.get(eqPair[1]);
    const totalHp = Math.max(
      spec.max_hp * 0.75,
      spec.base_hp + (eq0?.hp_bonus ?? 0) + (eq1?.hp_bonus ?? 0)
    );
    const totalDps = Math.max(
      spec.dps * 0.75,
      spec.base_dps + (eq0?.dps_bonus ?? 0) + (eq1?.dps_bonus ?? 0)
    );
    const movement = (spec as { movement?: string }).movement ?? 'Ground';
    const uid = this.nextUnitId++;
    this.internalUnits.push({
      id: uid,
      kind: { Hero: heroId },
      name: spec.name,
      team,
      x: Math.max(0.5, Math.min(49.5, x)),
      y: Math.max(0.5, Math.min(49.5, y)),
      hp: totalHp,
      max_hp: totalHp,
      base_dps: totalDps,
      damage_per_hit: totalDps * spec.attack_speed_sec,
      attack_speed_sec: spec.attack_speed_sec,
      move_speed: spec.move_speed,
      range: spec.range,
      splash_radius: 0,
      housing_space: 25,
      is_air: movement === 'Air',
      movement,
      target_domain: 'GroundAndAir',
      preferred_target: heroId === 'RoyalChampion' ? 'Defenses' : 'Any',
      is_burrowed: false,
      freeze_timer: 0,
      stun_timer: 0,
      invisibility_timer: 0,
      invincibility_timer: 0,
      rage_timer: 0,
      haste_timer: 0,
      poison_timer: 0,
      ability_used: false,
      ability_active_timer: 0,
      equipped_items: [eqPair[0], eqPair[1]],
      target: 'None',
      waypoints: [],
      alive: true,
      attack_cooldown: 0,
      special_timer: 0,
      lifetime_remaining: null,
      anchor_pos: null,
      paired_hero_id: null,
    });
    return uid;
  }

  private spawnPetUnit(
    petId: string,
    heroUid: number,
    x: number,
    y: number
  ): number {
    const spec = PET_MAP.get(petId);
    if (!spec) return 0;
    const uid = this.nextUnitId++;
    const movement = spec.movement ?? 'JumpWalls';
    this.internalUnits.push({
      id: uid,
      kind: { Pet: petId },
      name: spec.name,
      team: 'Attacker',
      x: Math.max(0.5, Math.min(49.5, x)),
      y: Math.max(0.5, Math.min(49.5, y)),
      hp: spec.max_hp,
      max_hp: spec.max_hp,
      base_dps: spec.dps,
      damage_per_hit: spec.damage_per_hit ?? spec.dps,
      attack_speed_sec: spec.attack_speed_sec ?? 1.0,
      move_speed: spec.move_speed,
      range: spec.range,
      splash_radius: 0,
      housing_space: 20,
      is_air: movement === 'Air',
      movement,
      target_domain: spec.target_domain ?? 'GroundAndAir',
      preferred_target: spec.preferred_target ?? 'Any',
      is_burrowed: movement === 'Burrow',
      freeze_timer: 0,
      stun_timer: 0,
      invisibility_timer: 0,
      invincibility_timer: 0,
      rage_timer: 0,
      haste_timer: 0,
      poison_timer: 0,
      ability_used: false,
      ability_active_timer: 0,
      equipped_items: null,
      target: 'None',
      waypoints: [],
      alive: true,
      attack_cooldown: 0,
      special_timer: 0,
      lifetime_remaining: null,
      anchor_pos: null,
      paired_hero_id: heroUid,
    });
    return uid;
  }

  private triggerHeroAbility(heroId: string, heroUid: number): boolean {
    const u = this.internalUnits.find((unit) => unit.id === heroUid && unit.alive);
    if (!u || u.ability_used) return false;
    const hspec = HERO_MAP.get(heroId);
    if (!hspec) return false;
    u.ability_used = true;
    u.ability_active_timer = hspec.ability_duration_sec || 8.0;
    u.hp = Math.min(u.max_hp, u.hp + hspec.ability_heal);
    u.rage_timer = Math.max(u.rage_timer, 8.0);

    const eqs = u.equipped_items ?? hspec.default_equipment;
    for (const eqId of eqs) {
      const eq = EQUIP_MAP.get(eqId);
      if (eq && eq.heal_on_activation > 0) {
        u.hp = Math.min(u.max_hp, u.hp + eq.heal_on_activation);
      }
      if (eqId === 'EternalTome') {
        for (const ally of this.internalUnits) {
          if (
            ally.alive &&
            ally.team === 'Attacker' &&
            dist(u.x, u.y, ally.x, ally.y) <= 9.0
          ) {
            ally.invincibility_timer = Math.max(ally.invincibility_timer, 7.2);
          }
        }
      } else if (eqId === 'Fireball' || eqId === 'SpikyBall' || eqId === 'SeekingShield') {
        const targets = this.internalBuildings
          .filter((b) => !b.destroyed && b.category === 'Defense')
          .sort(
            (a, b) =>
              dist(u.x, u.y, a.center_x, a.center_y) -
              dist(u.x, u.y, b.center_x, b.center_y)
          )
          .slice(0, eqId === 'Fireball' ? 1 : eqId === 'SeekingShield' ? 4 : 6);
        for (const t of targets) {
          const dmg = eqId === 'Fireball' ? 4100 : eqId === 'SpikyBall' ? 3250 : 2500;
          this.damageBuilding(t, dmg);
          this.state.visual_events.push({
            Explosion: {
              x: t.center_x,
              y: t.center_y,
              radius: eqId === 'Fireball' ? 5.0 : 2.2,
              color: '#f97316',
            },
          });
        }
      } else if (eqId === 'ActionFigure') {
        this.spawnTroopUnit('GiantGiant', 'Attacker', u.x + 1, u.y + 1);
      } else if (eqId === 'BarbarianPuppet') {
        for (let i = 0; i < 8; i++) {
          this.spawnTroopUnit(
            'Barbarian',
            'Attacker',
            u.x + Math.cos(i) * 1.2,
            u.y + Math.sin(i) * 1.2
          );
        }
      } else if (eqId === 'ArcherPuppet' || eqId === 'MagicMirror') {
        u.invisibility_timer = Math.max(u.invisibility_timer, 4.0);
        for (let i = 0; i < 5; i++) {
          this.spawnTroopUnit(
            'Archer',
            'Attacker',
            u.x + Math.cos(i) * 1.2,
            u.y + Math.sin(i) * 1.2
          );
        }
      }
    }

    this.state.visual_events.push({
      HealPulse: { x: u.x, y: u.y, radius: 4.5 },
    });
    return true;
  }

  private releaseAttackerCc(x: number, y: number): void {
    if (this.state.attacker_cc_popped) return;
    this.state.attacker_cc_popped = true;
    for (const [tid, count] of this.attackerCcTroops) {
      for (let i = 0; i < count; i++) {
        const angle = (i / Math.max(1, count)) * Math.PI * 2;
        this.spawnTroopUnit(
          tid,
          'Attacker',
          x + Math.cos(angle) * 0.8,
          y + Math.sin(angle) * 0.8
        );
      }
    }
  }

  private castSpell(
    spellId: string,
    team: 'Attacker' | 'Defender',
    x: number,
    y: number
  ): void {
    const spec = SPELL_MAP.get(spellId);
    if (!spec) return;

    if (spellId === 'Lightning') {
      for (const b of this.internalBuildings) {
        if (!b.destroyed && buildingEdgeDist(b, x, y) <= spec.radius) {
          this.damageBuilding(b, 720);
          b.stun_timer = Math.max(b.stun_timer, 0.2);
        }
      }
      this.state.visual_events.push({
        Explosion: { x, y, radius: spec.radius, color: '#38bdf8' },
      });
      return;
    }

    if (spellId === 'Earthquake') {
      for (const b of this.internalBuildings) {
        if (!b.destroyed && buildingEdgeDist(b, x, y) <= spec.radius) {
          this.damageBuilding(b, b.max_hp * 0.25);
        }
      }
      for (const w of this.state.walls) {
        if (!w.destroyed && dist(x, y, w.tile_x + 0.5, w.tile_y + 0.5) <= spec.radius) {
          w.hp -= w.max_hp * 0.65;
          if (w.hp <= 0) {
            w.hp = 0;
            w.destroyed = true;
          }
        }
      }
      this.state.visual_events.push({
        Explosion: { x, y, radius: spec.radius, color: '#d97706' },
      });
      return;
    }

    if (spellId === 'Totem') {
      const uid = this.nextUnitId++;
      this.internalUnits.push({
        id: uid,
        kind: 'Totem',
        name: 'Totem',
        team: 'Attacker',
        x: Math.max(0.5, Math.min(49.5, x)),
        y: Math.max(0.5, Math.min(49.5, y)),
        hp: 13000,
        max_hp: 13000,
        base_dps: 0,
        damage_per_hit: 0,
        attack_speed_sec: 1,
        move_speed: 0,
        range: 0,
        splash_radius: 0,
        housing_space: 1,
        is_air: false,
        movement: 'Stationary',
        target_domain: 'None',
        preferred_target: 'Any',
        is_burrowed: false,
        freeze_timer: 0,
        stun_timer: 0,
        invisibility_timer: 0,
        invincibility_timer: 0,
        rage_timer: 0,
        haste_timer: 0,
        poison_timer: 0,
        ability_used: false,
        ability_active_timer: 0,
        equipped_items: null,
        target: 'None',
        waypoints: [],
        alive: true,
        attack_cooldown: 0,
        special_timer: 0,
        lifetime_remaining: 38.9,
        anchor_pos: null,
        paired_hero_id: null,
      });
      for (const b of this.internalBuildings) {
        if (!b.destroyed && buildingEdgeDist(b, x, y) <= spec.radius) {
          b.stun_timer = Math.max(b.stun_timer, 0.4);
        }
      }
    } else if (spellId === 'SkeletonSpell') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.spawnTroopUnit(
          'Skeleton',
          'Attacker',
          x + Math.cos(a) * 1.2,
          y + Math.sin(a) * 1.2,
          15.0
        );
      }
    } else if (spellId === 'BatSpell') {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        this.spawnTroopUnit(
          'Bat',
          'Attacker',
          x + Math.cos(a) * 1.2,
          y + Math.sin(a) * 1.2,
          13.8
        );
      }
    }

    const zone: ActiveSpellZone = {
      spell_id: spellId,
      team,
      x,
      y,
      radius: spec.radius,
      remaining_sec: Math.max(0.5, spec.duration_sec),
    };
    this.state.spells.push(zone);
  }

  public apply_action(action: BattleActionInput): boolean {
    if (this.state.is_finished) return false;
    if (action === 'NoOp' || (typeof action === 'object' && 'NoOp' in action)) {
      return true;
    }
    if (
      action === 'PopSiegeMachine' ||
      (typeof action === 'object' && 'PopSiegeMachine' in action)
    ) {
      if (this.state.attacker_cc_popped) return false;
      const uid = this.state.active_siege_unit_id;
      if (uid !== null) {
        const u = this.internalUnits.find((unit) => unit.id === uid && unit.alive);
        if (u) {
          u.alive = false;
          this.releaseAttackerCc(u.x, u.y);
          return true;
        }
      }
      return false;
    }
    if (
      typeof action === 'object' &&
      ('DeployTroop' in action || 'DeployTroopBatch' in action)
    ) {
      const payload =
        'DeployTroop' in action ? action.DeployTroop : action.DeployTroopBatch;
      const { troop_id, x, y } = payload;
      if (!this.canDeployAt(x, y)) return false;
      const entry = this.state.remaining_troops.find(
        ([id, c]) => id === troop_id && c > 0
      );
      if (!entry) return false;
      const avail = entry[1];
      let requested = 1;
      if ('count' in payload && typeof payload.count === 'number') {
        requested = Math.max(1, Math.round(payload.count));
      } else if (
        'deploy_fraction' in payload &&
        typeof payload.deploy_fraction === 'number'
      ) {
        const frac = clamp(payload.deploy_fraction, 0, 1);
        requested = Math.max(1, Math.round(avail * frac));
      }
      const toSpawn = Math.max(1, Math.min(avail, requested));
      entry[1] -= toSpawn;
      for (let i = 0; i < toSpawn; i++) {
        const angle = i * 2.3999631;
        const r = i === 0 ? 0 : Math.min(0.42, 0.15 * Math.sqrt(i));
        const sx = clamp(x + r * Math.cos(angle), 0.5, 49.5);
        const sy = clamp(y + r * Math.sin(angle), 0.5, 49.5);
        const [fx, fy] = this.canDeployAt(sx, sy) ? [sx, sy] : [x, y];
        this.spawnTroopUnit(troop_id, 'Attacker', fx, fy);
      }
      return true;
    }
    if (typeof action === 'object' && 'DeployHero' in action) {
      const { hero_id, x, y } = action.DeployHero;
      if (!this.canDeployAt(x, y)) return false;
      const idx = this.state.remaining_heroes.findIndex(([h]) => h === hero_id);
      if (idx === -1) return false;
      const [hid, petId] = this.state.remaining_heroes.splice(idx, 1)[0];
      const heroUid = this.spawnHeroUnit(hid, 'Attacker', x, y);
      this.state.deployed_heroes.push([hid, heroUid]);
      this.spawnPetUnit(petId, heroUid, x + 0.6, y + 0.6);
      return true;
    }
    if (typeof action === 'object' && 'ActivateHeroAbility' in action) {
      const { hero_id } = action.ActivateHeroAbility;
      const deployed = this.state.deployed_heroes.find(([h]) => h === hero_id);
      if (!deployed) return false;
      return this.triggerHeroAbility(hero_id, deployed[1]);
    }
    if (typeof action === 'object' && 'DeploySiege' in action) {
      const { x, y } = action.DeploySiege;
      if (!this.canDeployAt(x, y)) return false;
      if (this.state.remaining_siege) {
        const sid = this.state.remaining_siege;
        this.state.remaining_siege = null;
        const uid = this.spawnTroopUnit(sid, 'Attacker', x, y);
        this.state.active_siege_unit_id = uid;
        return true;
      } else if (!this.state.attacker_cc_popped && this.attackerCcTroops.length > 0) {
        this.releaseAttackerCc(x, y);
        return true;
      }
      return false;
    }
    if (typeof action === 'object' && 'CastSpell' in action) {
      const { spell_id, x, y } = action.CastSpell;
      if (x < 0 || y < 0 || x >= 50 || y >= 50) return false;
      const entry = this.state.remaining_spells.find(
        ([id, c]) => id === spell_id && c > 0
      );
      if (!entry) return false;
      entry[1] -= 1;
      this.castSpell(spell_id, 'Attacker', x, y);
      return true;
    }
    return false;
  }

  public apply_action_json(actionJson: string): boolean {
    try {
      const action = JSON.parse(actionJson) as BattleActionInput;
      this.state.visual_events = [];
      const ok = this.apply_action(action);
      if (ok) {
        this.pendingActionEvents.push(...this.state.visual_events);
        this.state.visual_events = [...this.pendingActionEvents];
      }
      return ok;
    } catch {
      return false;
    }
  }

  public activate_hero_ability(heroIdJson: string): boolean {
    try {
      const heroId = JSON.parse(heroIdJson) as string;
      return this.apply_action_json(
        JSON.stringify({ ActivateHeroAbility: { hero_id: heroId } })
      );
    } catch {
      return false;
    }
  }

  private damageBuilding(b: InternalBuilding, dmg: number): void {
    if (b.destroyed || b.invisibility_timer > 0 || b.overgrowth_timer > 0) return;
    if (b.building_id === 'TownHall' && !this.guardianSpawned) {
      this.guardianSpawned = true;
      const guardianId =
        b.mode === 'GuardianLongshot'
          ? 'GuardianLongshot'
          : b.mode === 'GuardianSmasher'
          ? 'GuardianSmasher'
          : 'GuardianLogger';
      this.spawnTroopUnit(guardianId, 'Defender', b.center_x, b.center_y);
    }
    const actual = Math.min(b.hp, Math.max(0, dmg));
    b.hp -= actual;
    if (b.counts_for_destruction) {
      this.state.damage_dealt_total += actual;
    }
    if (b.hp <= 0) {
      b.hp = 0;
      b.destroyed = true;
      this.state.visual_events.push({
        Explosion: {
          x: b.center_x,
          y: b.center_y,
          radius: b.footprint * 0.65,
          color: '#f59e0b',
        },
      });
      if (b.counts_for_destruction) {
        this.state.destroyed_scorable_buildings += 1;
        this.state.destruction_pct = Math.min(
          100,
          Math.floor(
            (this.state.destroyed_scorable_buildings * 100) /
              this.state.total_scorable_buildings
          )
        );
      }
      if (b.building_id === 'TownHall') {
        this.state.town_hall_destroyed = true;
      }
      let stars = 0;
      if (this.state.destruction_pct >= 50) stars += 1;
      if (this.state.town_hall_destroyed) stars += 1;
      if (this.state.destruction_pct >= 100) stars = 3;
      this.state.stars = stars;
      if (this.state.destruction_pct >= 100) {
        this.state.is_finished = true;
      }
    }
  }

  private stepSingleTick(): void {
    if (this.state.is_finished) return;
    this.state.tick += 1;
    this.state.time_elapsed_sec = Number((this.state.tick * DT).toFixed(2));

    for (const z of this.state.spells) {
      z.remaining_sec -= DT;
      if (z.spell_id === 'Rage') {
        for (const u of this.internalUnits) {
          if (u.alive && u.team === z.team && dist(u.x, u.y, z.x, z.y) <= z.radius) {
            u.rage_timer = Math.max(u.rage_timer, 0.3);
          }
        }
      } else if (z.spell_id === 'Healing') {
        for (const u of this.internalUnits) {
          if (
            u.alive &&
            u.team === 'Attacker' &&
            u.kind !== 'Totem' &&
            dist(u.x, u.y, z.x, z.y) <= z.radius
          ) {
            u.hp = Math.min(u.max_hp, u.hp + 250 * DT);
          }
        }
      } else if (z.spell_id === 'Freeze') {
        for (const b of this.internalBuildings) {
          if (!b.destroyed && buildingEdgeDist(b, z.x, z.y) <= z.radius) {
            b.freeze_timer = Math.max(b.freeze_timer, 0.25);
          }
        }
      } else if (z.spell_id === 'Overgrowth') {
        for (const b of this.internalBuildings) {
          if (
            !b.destroyed &&
            b.building_id !== 'TownHall' &&
            buildingEdgeDist(b, z.x, z.y) <= z.radius
          ) {
            b.overgrowth_timer = Math.max(b.overgrowth_timer, 0.25);
          }
        }
      } else if (z.spell_id === 'Invisibility') {
        for (const u of this.internalUnits) {
          if (u.alive && dist(u.x, u.y, z.x, z.y) <= z.radius) {
            u.invisibility_timer = Math.max(u.invisibility_timer, 0.25);
          }
        }
      } else if (z.spell_id === 'Poison') {
        for (const u of this.internalUnits) {
          if (u.alive && u.team !== z.team && dist(u.x, u.y, z.x, z.y) <= z.radius) {
            u.poison_timer = Math.max(u.poison_timer, 0.3);
            u.hp -= 280 * DT;
            if (u.hp <= 0) u.alive = false;
          }
        }
      }
    }
    this.state.spells = this.state.spells.filter((z) => z.remaining_sec > 0);

    if (!this.defenderCcTriggered && this.defenderCcTroops.length > 0) {
      const ccBuilding = this.internalBuildings.find(
        (b) => b.building_id === 'ClanCastle' && !b.destroyed
      );
      if (ccBuilding) {
        const triggered = this.internalUnits.some(
          (u) =>
            u.alive &&
            u.team === 'Attacker' &&
            u.kind !== 'Totem' &&
            dist(u.x, u.y, ccBuilding.center_x, ccBuilding.center_y) <= 12.0
        );
        if (triggered) {
          this.defenderCcTriggered = true;
          for (const [tid, count] of this.defenderCcTroops) {
            for (let i = 0; i < count; i++) {
              this.spawnTroopUnit(
                tid,
                'Defender',
                ccBuilding.center_x + (i % 3) - 1,
                ccBuilding.center_y + Math.floor(i / 3) - 1
              );
            }
          }
        }
      }
    }

    for (const tr of this.state.traps) {
      if (tr.triggered) continue;
      const tspec = TRAP_MAP.get(tr.trap_id);
      if (!tspec) continue;
      const trapDomain =
        tr.trap_id === 'SkeletonTrap'
          ? tr.mode === 'SkeletonAir'
            ? 'Air'
            : 'Ground'
          : tspec.target_domain;
      const victim = this.internalUnits.find(
        (u) =>
          u.alive &&
          u.team === 'Attacker' &&
          u.kind !== 'Totem' &&
          !u.is_burrowed &&
          canHitDomain(trapDomain, u.is_air) &&
          dist(u.x, u.y, tr.center_x, tr.center_y) <= tspec.trigger_radius
      );
      if (victim) {
        tr.triggered = true;
        if (tr.trap_id === 'SkeletonTrap') {
          const isAirSkel = tr.mode === 'SkeletonAir';
          for (let i = 0; i < 5; i++) {
            const ang = i * 1.25;
            const uid = this.spawnTroopUnit(
              'Skeleton',
              'Defender',
              tr.center_x + Math.cos(ang) * 0.6,
              tr.center_y + Math.sin(ang) * 0.6,
              30.0
            );
            const spawned = this.internalUnits.find((su) => su.id === uid);
            if (spawned && isAirSkel) {
              spawned.is_air = true;
              spawned.movement = 'Air';
              spawned.target_domain = 'Air';
              spawned.name = 'Air Skeleton';
            }
          }
          continue;
        }
        const dmg =
          tr.trap_id === 'SeekingAirMine'
            ? 3350
            : tr.trap_id === 'GigaBomb'
            ? 1400
            : tr.trap_id === 'GiantBomb'
            ? 490
            : 250;
        for (const u of this.internalUnits) {
          if (
            u.alive &&
            u.team === 'Attacker' &&
            canHitDomain(tspec.target_domain, u.is_air) &&
            dist(u.x, u.y, tr.center_x, tr.center_y) <= 3.2
          ) {
            if (u.invincibility_timer <= 0) {
              u.hp -= dmg;
              if (u.hp <= 0) u.alive = false;
            }
          }
        }
        this.state.visual_events.push({
          Explosion: { x: tr.center_x, y: tr.center_y, radius: 2.5, color: '#ef4444' },
        });
      }
    }

    for (const u of this.internalUnits) {
      if (!u.alive) continue;
      if (u.lifetime_remaining !== null) {
        u.lifetime_remaining -= DT;
        if (u.lifetime_remaining <= 0) {
          u.alive = false;
          if (u.id === this.state.active_siege_unit_id) {
            this.releaseAttackerCc(u.x, u.y);
          }
          continue;
        }
      }
      u.freeze_timer = Math.max(0, u.freeze_timer - DT);
      u.stun_timer = Math.max(0, u.stun_timer - DT);
      u.invisibility_timer = Math.max(0, u.invisibility_timer - DT);
      u.invincibility_timer = Math.max(0, u.invincibility_timer - DT);
      u.rage_timer = Math.max(0, u.rage_timer - DT);
      u.haste_timer = Math.max(0, u.haste_timer - DT);
      u.poison_timer = Math.max(0, u.poison_timer - DT);
      u.ability_active_timer = Math.max(0, u.ability_active_timer - DT);
      u.attack_cooldown = Math.max(0, u.attack_cooldown - DT);

      if (u.kind === 'Totem') {
        u.hp -= 334 * DT;
        if (u.hp <= 0) u.alive = false;
        continue;
      }

      if (
        typeof u.kind === 'object' &&
        u.kind.Troop === 'Furnace' &&
        u.team === 'Attacker'
      ) {
        u.special_timer += DT;
        if (u.special_timer >= 2.7) {
          u.special_timer = 0;
          this.spawnTroopUnit('Firemite', 'Attacker', u.x + 0.5, u.y + 0.5, 12.0);
        }
        continue;
      }

      if (u.freeze_timer > 0 || u.stun_timer > 0) continue;

      if (
        u.preferred_target === 'AlliedGround' ||
        u.preferred_target === 'AlliedAny'
      ) {
        let bestAlly: InternalUnit | null = null;
        let bestRatio = 1.0;
        for (const ally of this.internalUnits) {
          if (
            !ally.alive ||
            ally.team !== u.team ||
            ally.id === u.id ||
            ally.kind === 'Totem'
          )
            continue;
          if (u.preferred_target === 'AlliedGround' && ally.is_air) continue;
          const ratio = ally.hp / Math.max(1, ally.max_hp);
          if (ratio < bestRatio) {
            bestRatio = ratio;
            bestAlly = ally;
          }
        }
        if (bestAlly) {
          const d = dist(u.x, u.y, bestAlly.x, bestAlly.y);
          if (d > u.range) {
            const step = (u.move_speed / 8.0) * DT;
            u.x += ((bestAlly.x - u.x) / d) * Math.min(step, d);
            u.y += ((bestAlly.y - u.y) / d) * Math.min(step, d);
            u.waypoints = [[bestAlly.x, bestAlly.y]];
          } else if (u.attack_cooldown <= 0) {
            u.attack_cooldown = u.attack_speed_sec;
            bestAlly.hp = Math.min(
              bestAlly.max_hp,
              bestAlly.hp + u.damage_per_hit * (u.rage_timer > 0 ? 1.5 : 1.0)
            );
            this.state.visual_events.push({
              HealPulse: { x: bestAlly.x, y: bestAlly.y, radius: 1.5 },
            });
          }
        }
        continue;
      }

      if (u.team === 'Defender') {
        let nearest: InternalUnit | null = null;
        let bestD = 999;
        for (const enemy of this.internalUnits) {
          if (
            !enemy.alive ||
            enemy.team !== 'Attacker' ||
            enemy.invisibility_timer > 0 ||
            enemy.is_burrowed ||
            !canHitDomain(u.target_domain, enemy.is_air)
          )
            continue;
          const d = dist(u.x, u.y, enemy.x, enemy.y);
          if (d < bestD) {
            bestD = d;
            nearest = enemy;
          }
        }
        if (nearest && bestD <= 14.0) {
          u.target = { Unit: nearest.id };
          if (bestD > u.range) {
            const step = (u.move_speed / 8.0) * DT;
            u.x += ((nearest.x - u.x) / bestD) * Math.min(step, bestD);
            u.y += ((nearest.y - u.y) / bestD) * Math.min(step, bestD);
          } else if (u.attack_cooldown <= 0) {
            u.attack_cooldown = u.attack_speed_sec;
            if (nearest.invincibility_timer <= 0) {
              nearest.hp -= u.damage_per_hit;
              if (nearest.hp <= 0) nearest.alive = false;
            }
            this.state.visual_events.push({
              Projectile: {
                from_x: u.x,
                from_y: u.y,
                to_x: nearest.x,
                to_y: nearest.y,
                color: '#ef4444',
                splash_radius: u.splash_radius,
              },
            });
          }
        }
        continue;
      }

      let bestBuilding: InternalBuilding | null = null;
      let bestScore = Infinity;
      for (const b of this.internalBuildings) {
        if (b.destroyed || b.invisibility_timer > 0 || b.overgrowth_timer > 0)
          continue;
        if (b.building_id === 'HiddenTesla' && !b.is_hidden_tesla_revealed)
          continue;
        const d = buildingEdgeDist(b, u.x, u.y);
        let prefPenalty = 0;
        if (u.preferred_target === 'Defenses' && b.category !== 'Defense') {
          prefPenalty = 200;
        } else if (u.preferred_target === 'TownHall' && b.building_id !== 'TownHall') {
          prefPenalty = 250;
        } else if (u.preferred_target === 'Resources' && b.category !== 'Resource') {
          prefPenalty = 150;
        }
        const score = d + prefPenalty;
        if (score < bestScore) {
          bestScore = score;
          bestBuilding = b;
        }
      }

      if (!bestBuilding) continue;
      u.target = { Building: bestBuilding.index };
      const dEdge = buildingEdgeDist(bestBuilding, u.x, u.y);
      const effRange = Math.max(0.6, u.range);

      if (dEdge > effRange) {
        u.is_burrowed = u.movement === 'Burrow';
        const speedMult =
          (u.rage_timer > 0 ? 1.35 : 1.0) *
          (u.haste_timer > 0 ? 1.4 : 1.0) *
          (u.poison_timer > 0 ? 0.65 : 1.0);
        const step = (u.move_speed / 8.0) * speedMult * DT;
        const dx = bestBuilding.center_x - u.x;
        const dy = bestBuilding.center_y - u.y;
        const norm = Math.max(0.001, Math.hypot(dx, dy));
        const nx = u.x + (dx / norm) * Math.min(step, dEdge);
        const ny = u.y + (dy / norm) * Math.min(step, dEdge);

        const wx = Math.floor(nx);
        const wy = Math.floor(ny);
        const blockingWall =
          !u.is_air &&
          u.movement !== 'JumpWalls' &&
          u.movement !== 'Burrow'
            ? this.state.walls.find(
                (w) => !w.destroyed && w.tile_x === wx && w.tile_y === wy
              )
            : undefined;

        if (blockingWall) {
          if (u.movement === 'WallCrusher') {
            blockingWall.hp = 0;
            blockingWall.destroyed = true;
            u.x = nx;
            u.y = ny;
          } else {
            u.target = { Wall: blockingWall.index };
            if (u.attack_cooldown <= 0) {
              u.attack_cooldown = u.attack_speed_sec;
              const wallMult =
                typeof u.kind === 'object' &&
                (u.kind.Troop === 'WallBreaker' ||
                  u.kind.Troop === 'SuperWallBreaker')
                  ? 40
                  : 1.5;
              blockingWall.hp -= u.damage_per_hit * wallMult;
              if (blockingWall.hp <= 0) {
                blockingWall.hp = 0;
                blockingWall.destroyed = true;
              }
            }
          }
        } else {
          u.x = nx;
          u.y = ny;
          u.waypoints = [[bestBuilding.center_x, bestBuilding.center_y]];
        }
      } else {
        u.is_burrowed = false;
        u.waypoints = [];
        if (u.attack_cooldown <= 0) {
          const rageMult = u.rage_timer > 0 ? 1.85 : 1.0;
          u.attack_cooldown = u.attack_speed_sec / (u.haste_timer > 0 ? 1.35 : 1.0);
          const dmg = u.damage_per_hit * rageMult;
          this.damageBuilding(bestBuilding, dmg);

          if (u.splash_radius > 0.6) {
            for (const otherB of this.internalBuildings) {
              if (
                !otherB.destroyed &&
                otherB.index !== bestBuilding.index &&
                buildingEdgeDist(otherB, bestBuilding.center_x, bestBuilding.center_y) <=
                  u.splash_radius
              ) {
                this.damageBuilding(otherB, dmg * 0.65);
              }
            }
          }

          if (u.range >= 2.0) {
            const pKind: ProjectileKind =
              typeof u.kind === 'object' && u.kind.Troop === 'Thrower'
                ? 'Spear'
                : typeof u.kind === 'object' &&
                  (u.kind.Troop === 'Bowler' || u.kind.Troop === 'SuperBowler')
                ? 'Boulder'
                : 'Arrow';
            this.spawnVisualProjectile(
              pKind,
              'Attacker',
              u.x,
              u.y,
              bestBuilding.center_x,
              bestBuilding.center_y,
              dmg,
              u.splash_radius,
              '#38bdf8'
            );
            this.state.visual_events.push({
              Projectile: {
                from_x: u.x,
                from_y: u.y,
                to_x: bestBuilding.center_x,
                to_y: bestBuilding.center_y,
                color: '#38bdf8',
                splash_radius: u.splash_radius,
              },
            });
          }
        }
      }
    }

    for (const b of this.internalBuildings) {
      if (b.destroyed) continue;
      b.freeze_timer = Math.max(0, b.freeze_timer - DT);
      b.stun_timer = Math.max(0, b.stun_timer - DT);
      b.overgrowth_timer = Math.max(0, b.overgrowth_timer - DT);
      b.invisibility_timer = Math.max(0, b.invisibility_timer - DT);
      b.rage_timer = Math.max(0, b.rage_timer - DT);
      b.attack_cooldown = Math.max(0, b.attack_cooldown - DT);
      if (b.spell_cooldown !== undefined && b.spell_cooldown > 0) {
        b.spell_cooldown = Math.max(0, b.spell_cooldown - DT);
      }

      if (b.building_id === 'CraftingStation') {
        b.candle_melt_timer = (b.candle_melt_timer ?? 0) + DT;
        b.candle_stage =
          b.candle_melt_timer >= 131 ? 3 : b.candle_melt_timer >= 78 ? 2 : 1;
      }

      if (b.freeze_timer > 0 || b.stun_timer > 0 || b.overgrowth_timer > 0) {
        b.inferno_ramp_sec = 0;
        b.current_target = null;
        continue;
      }

      const spec = BUILDING_MAP.get(b.building_id);
      if (!spec) continue;

      if (b.building_id === 'HiddenTesla' && !b.is_hidden_tesla_revealed) {
        if (this.state.destruction_pct >= 51) {
          b.is_hidden_tesla_revealed = true;
        } else {
          const near = this.internalUnits.some(
            (u) =>
              u.alive &&
              u.team === 'Attacker' &&
              dist(u.x, u.y, b.center_x, b.center_y) <= 6.0
          );
          if (near) b.is_hidden_tesla_revealed = true;
        }
        if (!b.is_hidden_tesla_revealed) continue;
      }

      if (b.building_id === 'SpellTower' && (b.spell_cooldown ?? 0) <= 0) {
        const enemyNear = this.internalUnits.find(
          (u) =>
            u.alive &&
            u.team === 'Attacker' &&
            dist(u.x, u.y, b.center_x, b.center_y) <= spec.max_range
        );
        if (enemyNear) {
          b.spell_cooldown = 60.0;
          if (b.mode === 'SpellTowerRage') {
            for (const defB of this.internalBuildings) {
              if (
                !defB.destroyed &&
                dist(defB.center_x, defB.center_y, b.center_x, b.center_y) <= 5.0
              ) {
                defB.rage_timer = 18.0;
              }
            }
          } else if (b.mode === 'SpellTowerPoison') {
            this.castSpell('Poison', 'Defender', enemyNear.x, enemyNear.y);
          } else if (b.mode === 'SpellTowerInvisibility') {
            for (const defB of this.internalBuildings) {
              if (
                !defB.destroyed &&
                dist(defB.center_x, defB.center_y, b.center_x, b.center_y) <= 4.5
              ) {
                defB.invisibility_timer = 4.25;
              }
            }
          }
        }
        continue;
      }

      if (spec.dps <= 0) continue;
      if (
        b.building_id === 'RevengeTower' &&
        this.state.destroyed_scorable_buildings < 5
      ) {
        continue;
      }

      const domain =
        b.building_id === 'XBow' && b.mode === 'XBowGround'
          ? 'Ground'
          : spec.target_domain;

      let targetUnit: InternalUnit | null = null;
      let bestDist = Infinity;
      for (const u of this.internalUnits) {
        if (
          !u.alive ||
          u.team !== 'Attacker' ||
          u.invisibility_timer > 0 ||
          u.is_burrowed ||
          !canHitDomain(domain, u.is_air)
        )
          continue;
        const d = dist(b.center_x, b.center_y, u.x, u.y);
        if (d >= spec.min_range && d <= spec.max_range && d < bestDist) {
          bestDist = d;
          targetUnit = u;
        }
      }

      if (!targetUnit) {
        b.current_target = null;
        b.inferno_ramp_sec = 0;
        continue;
      }

      if (b.current_target === targetUnit.id) {
        b.inferno_ramp_sec += DT;
      } else {
        b.current_target = targetUnit.id;
        b.inferno_ramp_sec = 0;
      }

      if (b.attack_cooldown <= 0) {
        b.attack_cooldown = Math.max(0.2, spec.attack_speed_sec);
        let shotDmg = spec.damage_per_shot * (b.rage_timer > 0 ? 1.6 : 1.0);
        if (b.building_id === 'InfernoTower' && b.mode === 'InfernoSingle') {
          const rampDps =
            b.inferno_ramp_sec >= 5.25
              ? 2400
              : b.inferno_ramp_sec >= 1.5
              ? 420
              : 155;
          shotDmg = rampDps * b.attack_cooldown;
        } else if (b.building_id === 'Monolith') {
          shotDmg += targetUnit.max_hp * 0.13;
        }

        if (targetUnit.invincibility_timer <= 0) {
          targetUnit.hp -= shotDmg;
          if (targetUnit.hp <= 0) {
            targetUnit.alive = false;
            if (targetUnit.id === this.state.active_siege_unit_id) {
              this.releaseAttackerCc(targetUnit.x, targetUnit.y);
            }
          }
        }

        if (b.building_id === 'InfernoTower' || b.building_id === 'HiddenTesla') {
          this.state.visual_events.push({
            Beam: {
              from_x: b.center_x,
              from_y: b.center_y,
              to_x: targetUnit.x,
              to_y: targetUnit.y,
              color: b.building_id === 'InfernoTower' ? '#f97316' : '#38bdf8',
              width: b.mode === 'InfernoSingle' && b.inferno_ramp_sec > 2 ? 3.2 : 1.8,
            },
          });
        } else {
          this.spawnVisualProjectile(
            b.building_id === 'Mortar'
              ? 'MortarShell'
              : b.building_id === 'Scattershot'
              ? 'ScatterBundle'
              : b.building_id === 'AirDefense'
              ? 'Rocket'
              : b.building_id === 'CraftingStation'
              ? 'CandleFlame'
              : 'Cannonball',
            'Defender',
            b.center_x,
            b.center_y,
            targetUnit.x,
            targetUnit.y,
            shotDmg,
            spec.splash_radius,
            '#ef4444'
          );
          this.state.visual_events.push({
            Projectile: {
              from_x: b.center_x,
              from_y: b.center_y,
              to_x: targetUnit.x,
              to_y: targetUnit.y,
              color: '#ef4444',
              splash_radius: spec.splash_radius,
            },
          });
        }
      }
    }

    for (const p of this.state.projectiles) {
      p.progress += (p.speed * DT) / Math.max(0.5, p.total_dist);
      p.x = p.from_x + (p.target_x - p.from_x) * Math.min(1, p.progress);
      p.y = p.from_y + (p.target_y - p.from_y) * Math.min(1, p.progress);
    }
    this.state.projectiles = this.state.projectiles.filter((p) => p.progress < 1.0);

    if (this.state.tick >= MAX_TICKS) {
      this.state.is_finished = true;
      return;
    }
    const noInventory =
      this.state.remaining_troops.every(([, c]) => c === 0) &&
      this.state.remaining_spells.every(([, c]) => c === 0) &&
      this.state.remaining_heroes.length === 0 &&
      this.state.remaining_siege === null;
    const noLiveAttackers = !this.internalUnits.some(
      (u) => u.alive && u.team === 'Attacker' && u.kind !== 'Totem'
    );
    if (noInventory && noLiveAttackers && this.state.tick > 10) {
      this.state.is_finished = true;
    }
  }

  private spawnVisualProjectile(
    kind: ProjectileKind,
    team: 'Attacker' | 'Defender',
    fromX: number,
    fromY: number,
    targetX: number,
    targetY: number,
    damage: number,
    splashRadius: number,
    color: string
  ): void {
    if (this.state.projectiles.length > 48) return;
    const totalDist = Math.max(0.5, dist(fromX, fromY, targetX, targetY));
    const proj: SimProjectile = {
      id: this.nextProjectileId++,
      kind,
      team,
      from_x: fromX,
      from_y: fromY,
      x: fromX,
      y: fromY,
      target_x: targetX,
      target_y: targetY,
      homing: true,
      speed: 14.0,
      progress: 0,
      total_dist: totalDist,
      arc_height: kind === 'MortarShell' || kind === 'ScatterBundle' ? 2.5 : 0.4,
      damage,
      splash_radius: splashRadius,
      color,
    };
    this.state.projectiles.push(proj);
  }

  public step_ticks(numTicks: number): string {
    const accumulatedEvents = [...this.pendingActionEvents];
    this.pendingActionEvents = [];
    this.state.visual_events = [];
    const n = Math.max(1, numTicks);
    for (let i = 0; i < n; i++) {
      if (this.state.is_finished) break;
      this.stepSingleTick();
      if (this.state.visual_events.length > 0 && accumulatedEvents.length < 160) {
        accumulatedEvents.push(...this.state.visual_events);
      }
      this.state.visual_events = [];
    }
    this.state.visual_events = accumulatedEvents;
    return JSON.stringify(this.state);
  }

  private stepHeuristicAiOnce(accumulatedEvents: VisualEvent[]): void {
    this.state.visual_events = [];
    const t = this.state.tick;
    const hasAttackers = this.internalUnits.some(
      (u) => u.alive && u.team === 'Attacker'
    );

    if (t === 0 || !hasAttackers) {
      for (const [tid, count] of [...this.state.remaining_troops]) {
        if (count === 0) continue;
        const toDeploy = Math.max(1, Math.floor(count / 2));
        for (let i = 0; i < toDeploy; i++) {
          const y = 16.5 + ((i * 1.4) % 16.0);
          this.apply_action({
            DeployTroop: { troop_id: tid, x: 1.5, y },
          });
        }
      }
      if (this.state.remaining_siege) {
        this.apply_action({ DeploySiege: { x: 1.5, y: 24.5 } });
      }
    } else if (
      t >= 10 &&
      (this.state.remaining_heroes.length > 0 ||
        this.state.remaining_troops.some(([, c]) => c > 0))
    ) {
      const heroes = this.state.remaining_heroes.map(([h]) => h);
      heroes.forEach((hid, i) => {
        this.apply_action({
          DeployHero: { hero_id: hid, x: 1.5, y: 21.5 + i * 2.0 },
        });
      });
      if (this.state.remaining_siege) {
        this.apply_action({ DeploySiege: { x: 1.5, y: 24.5 } });
      }
      for (const [tid, count] of [...this.state.remaining_troops]) {
        for (let i = 0; i < count; i++) {
          const y = 18.5 + ((i * 1.1) % 12.0);
          this.apply_action({
            DeployTroop: { troop_id: tid, x: 1.5, y },
          });
        }
      }
    } else if (t % 35 === 0) {
      let sumX = 0;
      let sumY = 0;
      let n = 0;
      for (const u of this.internalUnits) {
        if (u.alive && u.team === 'Attacker') {
          sumX += u.x;
          sumY += u.y;
          n += 1;
        }
      }
      if (n > 0) {
        const cx = Math.max(6.0, Math.min(44.0, sumX / n));
        const cy = Math.max(6.0, Math.min(44.0, sumY / n));
        const spellEntry = this.state.remaining_spells.find(([, c]) => c > 0);
        if (spellEntry) {
          const sid = spellEntry[0];
          const [sx, sy] =
            sid === 'Overgrowth' || sid === 'Freeze'
              ? [(cx + 25.0) * 0.5, (cy + 25.0) * 0.5]
              : [cx, cy];
          this.apply_action({ CastSpell: { spell_id: sid, x: sx, y: sy } });
        }
      }
      for (const [hid, uid] of [...this.state.deployed_heroes]) {
        const u = this.internalUnits.find((unit) => unit.id === uid && unit.alive);
        if (u && (u.hp < u.max_hp * 0.7 || t >= 85)) {
          this.apply_action({ ActivateHeroAbility: { hero_id: hid } });
        }
      }
    }

    if (this.state.visual_events.length > 0 && accumulatedEvents.length < 160) {
      accumulatedEvents.push(...this.state.visual_events);
    }
    this.state.visual_events = [];
    this.stepSingleTick();
    if (this.state.visual_events.length > 0 && accumulatedEvents.length < 160) {
      accumulatedEvents.push(...this.state.visual_events);
    }
    this.state.visual_events = [];
  }

  public run_heuristic_ai_step(): string {
    return this.run_heuristic_ai_ticks(1);
  }

  public run_heuristic_ai_ticks(numTicks: number): string {
    const accumulatedEvents: VisualEvent[] = [];
    const n = Math.max(1, numTicks);
    for (let i = 0; i < n; i++) {
      if (this.state.is_finished) break;
      this.stepHeuristicAiOnce(accumulatedEvents);
    }
    this.state.visual_events = accumulatedEvents;
    return JSON.stringify(this.state);
  }
}
