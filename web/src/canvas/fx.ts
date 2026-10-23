/**
 * Combat FX layer for the battlefield overlay canvas.
 *
 * All state comes exclusively from the existing BattleEngineState snapshots —
 * no Rust bridge changes. Every simulated field has a graceful fallback and
 * anywhere the engine lacks a dedicated field the local heuristic is tagged
 * with a TODO(bridge) so the orchestrator can wire the real value later.
 *
 * Perf contract:
 *  - Particle arena is pre-allocated (fixed slots, round-robin overwrite) so the
 *    render loop never allocates.
 *  - Colors are stored as ready-made CSS strings; alpha is applied with
 *    ctx.globalAlpha (no per-particle string building).
 *  - Projectiles are interpolated between 10 Hz snapshots for 60 fps motion.
 */
import {
  ActiveSpellZone,
  BattleEngineState,
  ProjectileKind,
  VisualEvent,
} from '../types';
import { FX_SPRITES } from '../assetsManifest';
import {
  buildingSpriteSize,
  getBuildingSpriteUrl,
  getLoadedImage,
} from './spriteLoader';

// ---------------------------------------------------------------------------
// Virtual design space (mirror of BattlefieldCanvas's coordinate system)
// ---------------------------------------------------------------------------
const VIRTUAL_W = 1240;
const VIRTUAL_H = 880;
const ISO_TILE_W = 21.6;
const ISO_TILE_H = 14.4;
const ISO_ORIGIN_Y = 78;
const BOARD_PX = 780;

/** Grid tile coordinates → virtual design-space pixels (same math as the base canvas). */
export function projectTile(
  gx: number,
  gy: number,
  iso: boolean
): [number, number] {
  if (!iso) {
    const ox = (VIRTUAL_W - BOARD_PX) / 2;
    const oy = (VIRTUAL_H - BOARD_PX) / 2;
    const cell = BOARD_PX / 50;
    return [ox + gx * cell, oy + gy * cell];
  }
  return [
    VIRTUAL_W / 2 + (gx - gy) * (ISO_TILE_W / 2),
    ISO_ORIGIN_Y + (gx + gy) * (ISO_TILE_H / 2),
  ];
}

const ISO_Y_SQUASH = 0.67;
const dashPat = [4, 3];

// ---------------------------------------------------------------------------
// Quality toggle
// ---------------------------------------------------------------------------
let fxHigh = true;
export function setFxQuality(high: boolean): void {
  fxHigh = high;
}
export function isFxHigh(): boolean {
  return fxHigh;
}

// ---------------------------------------------------------------------------
// Particle arena (pre-allocated, round-robin overwrite, zero allocation)
// ---------------------------------------------------------------------------
export type ParticleKind =
  | 'smoke'
  | 'ember'
  | 'spark'
  | 'debris'
  | 'droplet'
  | 'bubble'
  | 'plus'
  | 'mote'
  | 'dust'
  | 'shard';

const P_CAP = 220; // hard cap on concurrent particles

interface Particle {
  alive: boolean;
  kind: ParticleKind;
  x: number; // virtual design px (screen-ish space; projected once at spawn)
  y: number;
  vx: number; // px / sec
  vy: number;
  g: number; // gravity px / s² (screen-down)
  drag: number;
  born: number;
  life: number; // seconds
  size: number;
  color: string;
  seed: number;
}

const particles: Particle[] = Array.from({ length: P_CAP }, () => ({
  alive: false,
  kind: 'smoke' as ParticleKind,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  g: 0,
  drag: 0.9,
  born: 0,
  life: 1,
  size: 2,
  color: '#ffffff',
  seed: 0,
}));
let pCursor = 0;

function spawnP(p: Particle): void {
  if (!fxHigh) return;
  const slot = particles[pCursor];
  pCursor = (pCursor + 1) % P_CAP;
  slot.alive = true;
  slot.kind = p.kind;
  slot.x = p.x;
  slot.y = p.y;
  slot.vx = p.vx;
  slot.vy = p.vy;
  slot.g = p.g;
  slot.drag = p.drag;
  slot.born = p.born;
  slot.life = p.life;
  slot.size = p.size;
  slot.color = p.color;
  slot.seed = p.seed;
}

function activeParticles(): number {
  let n = 0;
  for (let i = 0; i < P_CAP; i++) if (particles[i].alive) n++;
  return n;
}

/**
 * Position burst emitters. NOTE: particles live in *virtual screen px*, so a
 * burst spot is projected once at spawn time. Screen-space exit velocity is
 * derived by sampling the projected positions of two nearby tile points, which
 * keeps burst shapes correct in both 2D top-down and 2.5D iso.
 */
function burstScreenDelta(
  tx: number,
  ty: number,
  iso: boolean
): { px: number; py: number; dx: number; dy: number } {
  const [px, py] = projectTile(tx, ty, iso);
  const [qx, qy] = projectTile(tx + 0.5, ty, iso);
  const [rx, ry] = projectTile(tx, ty + 0.5, iso);
  return { px, py, dx: (qx - px) * 2, dy: (ry - py) * 2 };
}

function burst(
  tx: number,
  ty: number,
  iso: boolean,
  now: number,
  color: string,
  count: number,
  radiusTiles: number,
  kind: ParticleKind,
  speedMul: number,
  lifeMul: number
): void {
  const { px, py, dx, dy } = burstScreenDelta(tx, ty, iso || curIso);
  const dirLen = Math.hypot(dx, dy) || 1;
  const dirX = dx / dirLen;
  const dirY = dy / dirLen;
  const orthX = -dirY;
  const orthY = dirX;
  const spread = radiusTiles * (iso ? ISO_TILE_W : 15.6) * 0.42;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 1.4;
    const r = spread * (0.25 + Math.random() * 0.8);
    const o = Math.cos(a) * r;
    const v = Math.sin(a); // −1..1 along the tile→screen down axis
    const speed = (34 + Math.random() * 52) * speedMul;
    spawnP({
      alive: true,
      kind,
      x: px + orthX * o,
      y: py + orthY * o,
      vx: dirX * speed * Math.abs(v) + orthX * speed * v * 0.55,
      vy: dirY * speed * Math.abs(v) + orthY * speed * v * 0.55,
      g:
        kind === 'debris' || kind === 'droplet'
          ? 150
          : kind === 'dust'
          ? 46
          : kind === 'smoke'
          ? -26
          : 0,
      drag: kind === 'smoke' || kind === 'dust' ? 0.9 : 0.945,
      born: now,
      life:
        (kind === 'smoke'
          ? 0.55 + Math.random() * 0.4
          : kind === 'debris'
          ? 0.38 + Math.random() * 0.3
          : kind === 'bubble'
          ? 0.9 + Math.random() * 0.6
          : kind === 'dust'
          ? 0.5 + Math.random() * 0.3
          : kind === 'plus'
          ? 0.85 + Math.random() * 0.5
          : 0.3 + Math.random() * 0.3) * lifeMul,
      size:
        kind === 'smoke'
          ? 2.2 + Math.random() * 2.2
          : kind === 'debris'
          ? 1.7 + Math.random() * 1.4
          : kind === 'bubble'
          ? 2 + Math.random() * 2
          : kind === 'plus' || kind === 'mote'
          ? 2.4
          : kind === 'shard'
          ? 2.7
          : 1.8,
      color,
      seed: Math.random() * 6.28,
    });
  }
}

function smokeBurst(tx: number, ty: number, now: number, color: string, count: number, r: number): void {
  burst(tx, ty, false, now, color, count, r, 'smoke', 0.7, 1);
}
function debrisBurst(tx: number, ty: number, now: number, color: string, count: number, r: number): void {
  burst(tx, ty, false, now, color, count, r, 'debris', 1, 1);
}
function emberBurst(tx: number, ty: number, now: number, color: string, count: number, r: number): void {
  burst(tx, ty, false, now, color, count, r, 'ember', 1.1, 1);
}
function dustBurst(tx: number, ty: number, now: number, color: string, count: number, r: number): void {
  burst(tx, ty, false, now, color, count, r, 'dust', 0.75, 1);
}
function shardBurst(tx: number, ty: number, now: number, color: string, count: number, r: number): void {
  burst(tx, ty, false, now, color, count, r, 'shard', 1, 1);
}
function dropletBurst(tx: number, ty: number, now: number, color: string, count: number, r: number): void {
  burst(tx, ty, false, now, color, count, r, 'droplet', 0.8, 1.3);
}

// ---------------------------------------------------------------------------
// Latched transient FX (tile coordinates so pan/zoom/iso stay in sync)
// ---------------------------------------------------------------------------
type LatchKind =
  | 'impact'
  | 'muzzle'
  | 'lightning'
  | 'healring'
  | 'beam'
  | 'airwave'
  | 'deployring'
  | 'bloom'
  | 'dustcloud'
  | 'deathflash';

interface Latch {
  alive: boolean;
  kind: LatchKind;
  x: number; // tile coords
  y: number;
  x2: number; // second point for beams
  y2: number;
  color: string;
  radius: number; // tiles
  t0: number;
  ttl: number;
}

const LATCH_CAP = 80;
const latches: Latch[] = Array.from({ length: LATCH_CAP }, () => ({
  alive: false,
  kind: 'impact' as LatchKind,
  x: 0,
  y: 0,
  x2: 0,
  y2: 0,
  color: '#ffffff',
  radius: 1,
  t0: 0,
  ttl: 1,
}));
let lCursor = 0;

function spawnL(l: Omit<Latch, 'alive'>): void {
  const slot = latches[lCursor];
  lCursor = (lCursor + 1) % LATCH_CAP;
  slot.alive = true;
  slot.kind = l.kind;
  slot.x = l.x;
  slot.y = l.y;
  slot.x2 = l.x2;
  slot.y2 = l.y2;
  slot.color = l.color;
  slot.radius = l.radius;
  slot.t0 = l.t0;
  slot.ttl = l.ttl;
}

// ---------------------------------------------------------------------------
// Trackers
// ---------------------------------------------------------------------------
interface ProjTrack {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  kind: ProjectileKind;
  team: 'Attacker' | 'Defender';
  color: string;
  homing: boolean;
  splash: number;
  arc: number;
  progress: number;
  rate: number; // progress per wall-second between snapshots
  syncWall: number;
  lastAmbientP: number;
}
const projTracks = new Map<number, ProjTrack>();

interface BarTrack {
  shown: number;
  lastRatio: number;
  flashUntil: number;
  lastCall: number;
}
const barTracks = new Map<string, BarTrack>();

interface DeployTrack {
  t0: number;
  isAir: boolean;
}
const deployTracks = new Map<number, DeployTrack>();

const unitAlive = new Set<number>();
const unitLastPos = new Map<number, [number, number]>();

const zoneKeys = new Set<string>();
const zoneAmbient = new Map<string, number>();

const smolder = new Map<number, number>();

let lastTick = -1;

let fxLastFrame = -1; // for frame dt

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOutCubic(u: number): number {
  const inv = 1 - u;
  return 1 - inv * inv * inv;
}

function easeOutBack(u: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const inv = u - 1;
  return 1 + c3 * inv * inv * inv + c1 * inv * inv;
}

const LIGHTNING_HINTS = ['#60a5fa', '#38bdf8', '#93c5fd', '#7dd3fc'];
const HOT_HINTS = ['#f97316', '#ef4444', '#dc2626', '#fb923c'];

/** Current projection mode — updated every frame so burst emitters spawn in
 *  screen-px consistent with the user's current projection. */
let curIso = true;

function isLightningColor(c: string): boolean {
  const low = c.toLowerCase();
  return LIGHTNING_HINTS.some((l) => low === l || low.startsWith(l.slice(1)));
}

function isWhiteish(c: string): boolean {
  const low = c.toLowerCase();
  return low === '#ffffff' || low === '#fff' || low === 'white';
}

// ---------------------------------------------------------------------------
// Public API used by the battlefield canvas & App
// ---------------------------------------------------------------------------

/** Fully reset every FX tracker (battle session was recreated). */
export function resetBattleFx(): void {
  particles.forEach((p) => {
    p.alive = false;
  });
  latches.forEach((l) => {
    l.alive = false;
  });
  projTracks.clear();
  barTracks.clear();
  deployTracks.clear();
  unitAlive.clear();
  unitLastPos.clear();
  zoneKeys.clear();
  zoneAmbient.clear();
  smolder.clear();
  lastTick = -1;
  pCursor = 0;
  lCursor = 0;
}

/**
 * Smoothed health-bar ratio + hit flash (decays over 150 ms). Called from the
 * base canvas draw pass for both buildings and units.
 */
export function getBarFx(
  key: string,
  ratioNow: number,
  now: number
): { ratio: number; flash: number } {
  let bt = barTracks.get(key);
  if (!bt) {
    bt = { shown: ratioNow, lastRatio: ratioNow, flashUntil: 0, lastCall: now };
    barTracks.set(key, bt);
  }
  if (ratioNow < bt.lastRatio - 0.004) {
    bt.flashUntil = now + 150;
  }
  bt.lastRatio = ratioNow;
  const dt = Math.max(0, Math.min(120, now - bt.lastCall));
  bt.lastCall = now;
  if (Math.abs(ratioNow - bt.shown) < 0.002) {
    bt.shown = ratioNow;
  } else {
    bt.shown += (ratioNow - bt.shown) * Math.min(1, dt / 90);
  }
  const flash = now < bt.flashUntil ? clamp01(1 - (now - (bt.flashUntil - 150)) / 150) : 0;
  return { ratio: bt.shown, flash };
}

/** Deploy scale-in bounce for a freshly deployed unit (null once done). */
export function getDeployAnim(
  id: number,
  now: number
): { scale: number; dropY: number } | null {
  const dt = deployTracks.get(id);
  if (!dt) return null;
  const u = (now - dt.t0) / 280;
  if (u >= 1) {
    deployTracks.delete(id);
    return null;
  }
  if (u < 0) return null;
  return {
    scale: 0.22 + 0.78 * easeOutBack(u),
    dropY: dt.isAir ? (1 - easeOutCubic(u)) * 24 : (1 - easeOutCubic(u)) * 10,
  };
}

// ---------------------------------------------------------------------------
// Snapshot diffing — runs every time a new engine state arrives (~10 Hz)
// ---------------------------------------------------------------------------
export function syncBattleFx(state: BattleEngineState): void {
  const now = performance.now();

  // Session recreated → tick regression → wipe trackers.
  if (lastTick >= 0 && state.tick < lastTick - 2) {
    resetBattleFx();
  }
  lastTick = state.tick;

  const events: VisualEvent[] = state.visual_events ?? [];

  // --- Projectiles ---------------------------------------------------------
  const seenProj = new Set<number>();
  for (const p of state.projectiles ?? []) {
    seenProj.add(p.id);
    const tr = projTracks.get(p.id);
    if (!tr) {
      projTracks.set(p.id, {
        fromX: p.from_x,
        fromY: p.from_y,
        toX: p.target_x,
        toY: p.target_y,
        kind: p.kind,
        team: p.team,
        color: p.color,
        homing: p.homing,
        splash: p.splash_radius,
        arc: p.arc_height,
        progress: p.progress,
        rate: 0,
        syncWall: now,
        lastAmbientP: p.progress,
      });
      // TODO(bridge): engine exposes no "shot_origin" flag; every unseen
      // projectile id is treated as a fresh shot → small muzzle flash.
      spawnL({
        kind: 'muzzle',
        x: p.from_x,
        y: p.from_y,
        x2: 0,
        y2: 0,
        color: p.color,
        radius: Math.max(0.3, Math.min(1.2, p.splash_radius || 0.3)),
        t0: now,
        ttl: 110,
      });
      if (p.kind === 'MortarShell' || p.kind === 'Boulder') {
        smokeBurst(p.from_x, p.from_y, now, '#cbd5e1', 3, 0.5);
      }
    } else {
      const dtWall = now - tr.syncWall;
      if (dtWall > 14) {
        if (p.progress >= tr.progress) {
          tr.rate = (p.progress - tr.progress) / (dtWall / 1000);
        } else {
          tr.rate = 0; // progress went backwards mid-hover → freeze interp
        }
        tr.progress = p.progress;
        tr.syncWall = now;
      }
      tr.toX = p.target_x;
      tr.toY = p.target_y;
      tr.homing = p.homing;
      tr.color = p.color;
    }
  }
  // Removals → impact effects at the last known position. Deduped against this
  // tick's Explosion events so the engine blast is not doubled.
  for (const [id, tr] of projTracks) {
    if (seenProj.has(id)) continue;
    const dp = clamp01(tr.progress + Math.max(0, tr.rate) * 0.08);
    const ix = tr.fromX + (tr.toX - tr.fromX) * dp;
    const iy = tr.fromY + (tr.toY - tr.fromY) * dp;
    const nearExplosion = events.some(
      (ev) => 'Explosion' in ev && Math.hypot(ev.Explosion.x - ix, ev.Explosion.y - iy) <= 1.2
    );
    spawnImpact(ix, iy, tr.kind, tr.color, tr.splash, nearExplosion, now);
    projTracks.delete(id);
  }

  // --- Units: deploy pop + death puffs ------------------------------------
  const aliveNow = new Set<number>();
  for (const u of state.units) {
    if (!u.alive) continue;
    aliveNow.add(u.id);
    unitLastPos.set(u.id, [u.x, u.y]);
    if (!unitAlive.has(u.id)) {
      unitAlive.add(u.id);
      deployTracks.set(u.id, { t0: now, isAir: u.is_air });
      spawnL({
        kind: 'deployring',
        x: u.x,
        y: u.y,
        x2: 0,
        y2: 0,
        color: u.is_air ? '#7dd3fc' : '#a3e635',
        radius: u.is_air ? 0.9 : 0.7,
        t0: now,
        ttl: 360,
      });
      smokeBurst(u.x, u.y, now, u.is_air ? '#7dd3fc' : '#d6d3d1', 4, 0.4);
    }
  }
  for (const id of unitAlive) {
    if (!aliveNow.has(id)) {
      unitAlive.delete(id);
      const pos = unitLastPos.get(id);
      if (pos) {
        smokeBurst(pos[0], pos[1], now, '#57534e', 3, 0.4);
        unitLastPos.delete(id);
      }
    }
  }

  // --- Buildings: destruction flash, dust cloud, smolder -------------------
  for (const b of state.buildings) {
    if (b.destroyed) {
      if (!smolder.has(b.instance_id)) {
        smolder.set(b.instance_id, now);
        spawnL({
          kind: 'deathflash',
          x: b.center_x,
          y: b.center_y,
          x2: 0,
          y2: 0,
          color: '#fefce8',
          radius: Math.max(1.2, b.footprint * 0.8),
          t0: now,
          ttl: 240,
        });
        spawnL({
          kind: 'dustcloud',
          x: b.center_x,
          y: b.center_y,
          x2: 0,
          y2: 0,
          color: '#78716c',
          radius: Math.max(1.4, b.footprint * 1.15),
          t0: now,
          ttl: 720,
        });
        debrisBurst(b.center_x, b.center_y, now, '#a8a29e', 8, b.footprint * 0.55);
        smokeBurst(b.center_x, b.center_y, now, '#57534e', 8, b.footprint * 0.6);
      }
    } else {
      smolder.delete(b.instance_id);
    }
  }

  // --- Spell zones: cast bloom + ambient emitters bookkeeping --------------
  const curZones = new Set<string>();
  for (const z of state.spells ?? []) {
    const key = `${z.spell_id}|${Math.round(z.x * 3)}|${Math.round(z.y * 3)}`;
    curZones.add(key);
    if (!zoneKeys.has(key)) {
      zoneKeys.add(key);
      zoneAmbient.set(key, now);
      spawnL({
        kind: 'bloom',
        x: z.x,
        y: z.y,
        x2: 0,
        y2: 0,
        color: zoneSpellColor(z),
        radius: z.radius,
        t0: now,
        ttl: 550,
      });
      if (fxHigh) seedZoneAmbient(z, now, true);
    }
  }
  for (const k of zoneKeys) {
    if (!curZones.has(k)) {
      zoneKeys.delete(k);
      zoneAmbient.delete(k);
    }
  }

  // --- Visual events -------------------------------------------------------
  for (const ev of events) {
    consumeVisualEvent(ev, now);
  }

  // Prune stale bar tracks opportunistically.
  if (barTracks.size > 700) {
    const cutoff = now - 15000;
    for (const [k, bt] of barTracks) {
      if (bt.lastCall < cutoff) barTracks.delete(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Impact classification per projectile kind
// ---------------------------------------------------------------------------
function spawnImpact(
  x: number,
  y: number,
  kind: ProjectileKind,
  color: string,
  splash: number,
  dedupeExplosion: boolean,
  now: number
): void {
  const kindRadius: Partial<Record<ProjectileKind, number>> = {
    MortarShell: 1.6,
    Boulder: 1.3,
    ScatterBundle: 0.95,
    Cannonball: 0.9,
    WizardFireball: 1.0,
    CandleFlame: 0.85,
    FlameSpirit: 0.85,
    Rocket: 0.95,
    Log: 1.2,
    EnergyBolt: 0.55,
    SpellVial: 0.8,
    Arrow: 0.3,
    Spear: 0.35,
  };
  let radius = kindRadius[kind] ?? 0.8;
  if (splash > 0.6) radius = Math.max(radius, Math.min(2.6, splash * 0.55));
  spawnL({
    kind: 'impact',
    x,
    y,
    x2: 0,
    y2: 0,
    color: kind === 'Arrow' || kind === 'Spear' ? '#ffffff' : color,
    radius,
    t0: now,
    ttl: 380,
  });
  if (dedupeExplosion || !fxHigh) return;

  switch (kind) {
    case 'MortarShell':
    case 'Boulder':
      debrisBurst(x, y, now, '#78716c', 6, radius);
      smokeBurst(x, y, now, '#57534e', 5, radius);
      break;
    case 'ScatterBundle':
    case 'Cannonball':
      debrisBurst(x, y, now, color, 5, radius);
      break;
    case 'WizardFireball':
    case 'FlameSpirit':
    case 'CandleFlame':
      emberBurst(x, y, now, '#fb923c', 7, radius);
      break;
    case 'Rocket':
      emberBurst(x, y, now, '#ef4444', 5, radius);
      debrisBurst(x, y, now, '#a8a29e', 3, radius);
      break;
    case 'Log':
      dustBurst(x, y, now, '#a89984', 7, radius);
      break;
    case 'EnergyBolt':
      shardBurst(x, y, now, '#c4b5fd', 4, radius);
      break;
    case 'SpellVial':
      dropletBurst(x, y, now, color, 6, radius);
      break;
    default:
      break; // Arrow / Spear: the small white ring is enough
  }
}

// ---------------------------------------------------------------------------
// Visual event → FX translation
// ---------------------------------------------------------------------------
function consumeVisualEvent(ev: VisualEvent, now: number): void {
  if ('Explosion' in ev) {
    const ex = ev.Explosion;
    const lightning = isLightningColor(ex.color);
    spawnL({
      kind: 'impact',
      x: ex.x,
      y: ex.y,
      x2: 0,
      y2: 0,
      color: ex.color,
      radius: ex.radius,
      t0: now,
      ttl: lightning ? 310 : 380,
    });
    if (lightning) {
      // Lightning spell strike → white bolt column from the sky + ground burst.
      spawnL({
        kind: 'lightning',
        x: ex.x,
        y: ex.y,
        x2: 0,
        y2: 0,
        color: ex.color,
        radius: ex.radius,
        t0: now,
        ttl: 250,
      });
      shardBurst(ex.x, ex.y, now, '#bfdbfe', 5, ex.radius * 0.6);
      smokeBurst(ex.x, ex.y, now, '#64748b', 4, ex.radius * 0.5);
    } else if (HOT_HINTS.includes(ex.color)) {
      emberBurst(ex.x, ex.y, now, '#fb923c', 6, ex.radius * 0.7);
      smokeBurst(ex.x, ex.y, now, '#57534e', 4, ex.radius * 0.55);
    } else if (ex.color === '#a16207' || ex.color === '#d97706') {
      debrisBurst(ex.x, ex.y, now, '#b45309', 6, ex.radius * 0.6);
      dustBurst(ex.x, ex.y, now, '#d6d3d1', 4, ex.radius * 0.5);
    } else {
      debrisBurst(ex.x, ex.y, now, ex.color, 4, ex.radius * 0.5);
    }
  } else if ('HealPulse' in ev) {
    spawnL({
      kind: 'healring',
      x: ev.HealPulse.x,
      y: ev.HealPulse.y,
      x2: 0,
      y2: 0,
      color: '#86efac',
      radius: ev.HealPulse.radius,
      t0: now,
      ttl: 520,
    });
  } else if ('Beam' in ev) {
    const b = ev.Beam;
    if (b.width >= 4 || isWhiteish(b.color)) {
      // Thick/white beams read as sky strikes.
      spawnL({
        kind: 'lightning',
        x: b.to_x,
        y: b.to_y,
        x2: b.from_x,
        y2: b.from_y,
        color: b.color,
        radius: Math.max(0.5, b.width * 0.28),
        t0: now,
        ttl: 260,
      });
    }
    spawnL({
      kind: 'beam',
      x: b.from_x,
      y: b.from_y,
      x2: b.to_x,
      y2: b.to_y,
      color: b.color,
      radius: b.width,
      t0: now,
      ttl: 130,
    });
  } else {
    // Projectile streak event → Air Sweeper wind wave or brief directional shot line.
    const p = ev.Projectile;
    if (p.color === '#bae6fd' && p.splash_radius >= 3.0) {
      spawnL({
        kind: 'airwave',
        x: p.from_x,
        y: p.from_y,
        x2: p.to_x,
        y2: p.to_y,
        color: p.color,
        radius: p.splash_radius,
        t0: now,
        ttl: 520,
      });
    } else {
      spawnL({
        kind: 'beam',
        x: p.from_x,
        y: p.from_y,
        x2: p.to_x,
        y2: p.to_y,
        color: p.color,
        radius: 1.4,
        t0: now,
        ttl: 110,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Spell zone ambience
// ---------------------------------------------------------------------------
function zoneSpellColor(z: ActiveSpellZone): string {
  switch (z.spell_id) {
    case 'Healing':
      return '#86efac';
    case 'Rage':
      return '#d8b4fe';
    case 'Freeze':
    case 'IceBlock':
      return '#bae6fd';
    case 'Poison':
      return '#4ade80';
    case 'Haste':
      return '#f9a8d4';
    case 'Jump':
      return '#86efac';
    case 'Invisibility':
      return '#e2e8f0';
    case 'Clone':
      return '#7dd3fc';
    case 'Overgrowth':
      return '#4ade80';
    case 'Totem':
      return '#fde047';
    case 'Angry':
      return '#fca5a5';
    case 'SkeletonSpell':
      return '#fca5a5';
    case 'BatSpell':
      return '#c4b5fd';
    case 'Lightning':
      return '#93c5fd';
    case 'Earthquake':
      return '#fdba74';
    case 'Recall':
      return '#99f6e4';
    case 'Revive':
      return '#fde047';
    default:
      return '#e2e8f0';
  }
}

/** Feed ambient zone particles for Heal (plus-motes) & Poison (bubbles). */
function seedZoneAmbient(z: ActiveSpellZone, now: number, initial: boolean): void {
  const key = `${z.spell_id}|${Math.round(z.x * 3)}|${Math.round(z.y * 3)}`;
  const every = z.spell_id === 'Poison' ? 210 : 260;
  const last = zoneAmbient.get(key) ?? now - every;
  if (!initial && now - last < every) return;
  if (activeParticles() > P_CAP - 30) return;
  if (z.spell_id === 'Healing') {
    burst(
      z.x + (Math.random() - 0.5) * z.radius * 1.1,
      z.y + (Math.random() - 0.5) * z.radius * 0.7,
      false,
      now,
      '#86efac',
      1,
      0.12,
      'plus',
      0.25,
      1
    );
  } else if (z.spell_id === 'Poison') {
    burst(
      z.x + (Math.random() - 0.5) * z.radius * 1.2,
      z.y + (Math.random() - 0.5) * z.radius * 0.8,
      false,
      now,
      Math.random() < 0.5 ? '#4ade80' : '#a3e635',
      1,
      0.1,
      'bubble',
      0.2,
      1
    );
  }
  zoneAmbient.set(key, now);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------
export interface FxCamera {
  dpr: number;
  cssW: number;
  cssH: number;
  fit: number;
  zoom: number;
  panX: number;
  panY: number;
}

function applyCamera(ctx: CanvasRenderingContext2D, cam: FxCamera): void {
  const scale = cam.dpr * cam.fit * cam.zoom;
  ctx.setTransform(
    scale,
    0,
    0,
    scale,
    cam.dpr * (cam.cssW / 2 + cam.panX) - scale * (VIRTUAL_W / 2),
    cam.dpr * (cam.cssH / 2 + cam.panY) - scale * (VIRTUAL_H / 2)
  );
}

function projectedPos(
  tr: ProjTrack,
  displayProgress: number,
  iso: boolean,
  out: [number, number]
): void {
  const t = clamp01(displayProgress);
  const gx = tr.fromX + (tr.toX - tr.fromX) * t;
  const gy = tr.fromY + (tr.toY - tr.fromY) * t;
  const lift = 4 * t * (1 - t) * tr.arc * (iso ? 14 : 16);
  const [px, py] = projectTile(gx, gy, iso);
  out[0] = px;
  out[1] = py - lift;
}

// Preallocated scratch for trail sampling (zero per-frame allocation)
const trailScratch: Array<[number, number]> = [
  [0, 0],
  [0, 0],
  [0, 0],
  [0, 0],
];
const bodyScene: [number, number] = [0, 0];
const groundScene: [number, number] = [0, 0];

/**
 * Full FX frame. Clears `ctx` (the always-on overlay canvas) and draws
 * everything that changes per animation frame, at 60 fps.
 */
export function drawFxFrame(
  ctx: CanvasRenderingContext2D,
  state: BattleEngineState,
  iso: boolean,
  cam: FxCamera,
  now: number
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  applyCamera(ctx, cam);
  curIso = iso;

  const dt =
    fxLastFrame >= 0
      ? Math.min(0.05, Math.max(0.001, (now - fxLastFrame) / 1000))
      : 0.016;
  fxLastFrame = now;

  // ---------------- Active spell zones: ambient FX over the base tint ------
  for (const z of state.spells ?? []) {
    const [zx, zy] = projectTile(z.x, z.y, iso);
    const rPx = z.radius * (iso ? 11.2 : 15.6);
    const ry = iso ? rPx * ISO_Y_SQUASH : rPx;
    const phase = now * 0.004;

    if (z.spell_id === 'Healing') {
      const u = (now % 1250) / 1250;
      ctx.globalAlpha = (1 - u) * 0.4;
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(zx, zy, rPx * (0.35 + 0.62 * u), ry * (0.35 + 0.62 * u), 0, 0, Math.PI * 2);
      ctx.stroke();
      if (fxHigh) seedZoneAmbient(z, now, false);
    } else if (z.spell_id === 'Rage') {
      ctx.strokeStyle = '#d8b4fe';
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 2; k++) {
        const u = ((now + k * 450) % 900) / 900;
        ctx.globalAlpha = (1 - u) * 0.34;
        ctx.beginPath();
        ctx.ellipse(zx, zy, rPx * (0.3 + 0.66 * u), ry * (0.3 + 0.66 * u), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (z.spell_id === 'Freeze' || z.spell_id === 'IceBlock') {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#bae6fd';
      ctx.beginPath();
      ctx.ellipse(zx, zy, rPx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#e0f2fe';
      const specks = 7;
      for (let i = 0; i < specks; i++) {
        const a = i * 2.19 + phase * (1 + (i % 3) * 0.14);
        const rr = rPx * (0.3 + 0.55 * ((i % 4) / 4 + 0.16));
        const sxp = zx + Math.cos(a) * rr;
        const syp = zy + Math.sin(a) * rr * ISO_Y_SQUASH;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(phase * 2 + i);
        const s = 1.8 + (i % 2) * 0.6;
        ctx.beginPath();
        ctx.moveTo(sxp, syp - s);
        ctx.lineTo(sxp + s * 0.72, syp);
        ctx.lineTo(sxp, syp + s);
        ctx.lineTo(sxp - s * 0.72, syp);
        ctx.closePath();
        ctx.fill();
      }
    } else if (z.spell_id === 'Poison') {
      if (fxHigh) seedZoneAmbient(z, now, false);
    }
  }
  ctx.globalAlpha = 1;

  // ---------------- Latched transient FX -----------------------------------
  for (const l of latches) {
    if (!l.alive) continue;
    const age = now - l.t0;
    if (age < 0) continue;
    if (age > l.ttl) {
      l.alive = false;
      continue;
    }
    const u = age / l.ttl;
    const [lx, ly] = projectTile(l.x, l.y, iso);

    switch (l.kind) {
      case 'impact': {
        const R = l.radius * (iso ? 11.2 : 15.6);
        ctx.globalAlpha = (1 - u) * 0.85;
        ctx.strokeStyle = l.color;
        ctx.lineWidth = u < 0.3 ? 3 : 1.8;
        ctx.beginPath();
        ctx.ellipse(
          lx,
          ly,
          R * easeOutCubic(u),
          R * easeOutCubic(u) * (iso ? ISO_Y_SQUASH : 1),
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        if (u < 0.35) {
          ctx.globalAlpha = (1 - u / 0.35) * 0.6;
          ctx.fillStyle = l.color;
          ctx.beginPath();
          ctx.ellipse(lx, ly, R * 0.5 * (1 - u), R * 0.4 * (1 - u) * (iso ? ISO_Y_SQUASH : 1), 0, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'muzzle': {
        const flash = clamp01(1 - (age / l.ttl));
        const r = 7 + l.radius * 11;
        ctx.globalAlpha = flash * 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(lx, ly, r * 0.5, r * 0.36, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = flash * 0.5;
        ctx.fillStyle = l.color;
        ctx.beginPath();
        ctx.ellipse(lx, ly, r, r * 0.66, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'lightning': {
        const flick = u < 0.2 || Math.sin(now * 0.07) > -0.2 ? 1 : 0.4;
        const colW = 6 + l.radius * 5;
        // TODO(bridge): engine does not expose the sky origin height of the bolt;
        // a fixed ~165 virtual px column is simulated.
        ctx.globalAlpha = (1 - u) * 0.9 * flick;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(lx - colW, ly - 165 * (iso ? ISO_Y_SQUASH : 1) - 55);
        ctx.lineTo(lx + colW, ly - 165 * (iso ? ISO_Y_SQUASH : 1) - 55);
        ctx.lineTo(lx + colW * 0.55, ly);
        ctx.lineTo(lx - colW * 0.55, ly);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = (1 - u) * 0.5 * flick;
        ctx.fillStyle = '#bfdbfe';
        ctx.beginPath();
        ctx.ellipse(lx, ly, 20 * (1 - u * 0.4), 12 * (1 - u * 0.4) * (iso ? ISO_Y_SQUASH : 1), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = (1 - u) * 0.8;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 26 * (0.4 + u), 16 * (0.4 + u) * (iso ? ISO_Y_SQUASH : 1), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'healring': {
        const R = Math.max(12, l.radius * (iso ? 11.2 : 15.6));
        ctx.globalAlpha = (1 - u) * 0.8;
        ctx.strokeStyle = '#86efac';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(lx, ly, R * easeOutCubic(u), R * easeOutCubic(u) * (iso ? ISO_Y_SQUASH : 1), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'deployring': {
        const R = l.radius * (iso ? 11.2 : 15.6) * (0.5 + easeOutCubic(u));
        ctx.globalAlpha = (1 - u) * 0.85;
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(lx, ly, R, R * (iso ? ISO_Y_SQUASH : 1), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'bloom': {
        const R = l.radius * (iso ? 11.2 : 15.6);
        const rr = R * (1 + easeOutCubic(u) * 0.25);
        ctx.globalAlpha = (1 - u) * 0.5;
        ctx.strokeStyle = l.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(lx, ly, rr, rr * (iso ? ISO_Y_SQUASH : 1), 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'dustcloud': {
        const R = l.radius * (iso ? 11.2 : 15.6) * (0.6 + u);
        ctx.globalAlpha = (1 - u) * 0.4;
        ctx.fillStyle = '#78716c';
        ctx.beginPath();
        ctx.ellipse(lx, ly, R, R * 0.5 * (iso ? ISO_Y_SQUASH : 1), 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'deathflash': {
        const R = l.radius * (iso ? 11.2 : 15.6);
        ctx.globalAlpha = (1 - u) * 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(
          lx,
          ly,
          R * (0.5 + u * 0.8),
          R * (0.35 + u * 0.55) * (iso ? ISO_Y_SQUASH : 1),
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        break;
      }
      case 'beam': {
        const [tx, ty] = projectTile(l.x2, l.y2, iso);
        ctx.globalAlpha = (1 - u) * 0.9;
        ctx.strokeStyle = l.color;
        ctx.lineWidth = Math.max(1.2, l.radius + 1.2);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        break;
      }
      case 'airwave': {
        const gx = l.x + (l.x2 - l.x) * easeOutCubic(u);
        const gy = l.y + (l.y2 - l.y) * easeOutCubic(u);
        const [wx, wy] = projectTile(gx, gy, iso);
        const [tx, ty] = projectTile(l.x2, l.y2, iso);
        const ang = Math.atan2(ty - ly, tx - lx);
        const waveImg = getLoadedImage(FX_SPRITES.AirWave);
        const spreadW = (18 + u * 56) * (iso ? 1.0 : 1.15);
        const spreadH = (10 + u * 22) * (iso ? 0.85 : 1.0);
        ctx.save();
        ctx.translate(wx, wy - 6);
        ctx.rotate(ang + Math.PI / 2);
        ctx.globalAlpha = (1 - u) * 0.88;
        if (waveImg) {
          ctx.drawImage(waveImg, -spreadW / 2, -spreadH / 2, spreadW, spreadH);
        } else {
          ctx.strokeStyle = '#bae6fd';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, spreadW * 0.5, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }
    }
  }
  ctx.globalAlpha = 1;

  // ---------------- In-flight projectiles (interpolated) --------------------
  for (const p of state.projectiles ?? []) {
    const tr = projTracks.get(p.id);
    if (!tr) continue;

    const dispP = clamp01(
      tr.progress + (Math.max(0, tr.rate) * Math.max(0, now - tr.syncWall)) / 1000
    );

    // Ballistic AoE ground marker at the target point
    if (!tr.homing && tr.splash > 0) {
      const [txg, tyg] = projectTile(tr.toX, tr.toY, iso);
      const rPx = tr.splash * (iso ? 11.2 : 15.6);
      ctx.save();
      ctx.strokeStyle = tr.color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.3;
      ctx.setLineDash(dashPat);
      ctx.lineDashOffset = -now * 0.02;
      ctx.beginPath();
      ctx.ellipse(txg, tyg, rPx, iso ? rPx * ISO_Y_SQUASH : rPx, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Interpolated body & ground positions
    projectedPos(tr, dispP, iso, bodyScene);
    const t = clamp01(dispP);
    const gx = tr.fromX + (tr.toX - tr.fromX) * t;
    const gy = tr.fromY + (tr.toY - tr.fromY) * t;
    const groundOf = projectTile(gx, gy, iso);
    groundScene[0] = groundOf[0];
    groundScene[1] = groundOf[1];

    // Ground shadow under the ballistic arc
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(groundScene[0], groundScene[1] + 2, 4.2, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ambient trail particles (comb smoke / embers / droplets)
    const amb = PROJECTILE_AMBIENT.get(tr.kind);
    if (amb && fxHigh) {
      if (Math.floor(dispP / amb.step) > Math.floor(tr.lastAmbientP / amb.step)) {
        tr.lastAmbientP = dispP;
        burst(gx, gy, iso, now, amb.color, 1, 0.08, amb.kind, amb.speed, amb.life);
      }
    }

    // Trail streak for fast projectiles (arrow/spear/bolt/fire)
    const st = STREAK_WIDTH.get(tr.kind);
    if (st !== undefined) {
      // Preallocated anchors along the path (k=0 is just behind the body).
      for (let k = 0; k < 3; k++) {
        projectedPos(tr, dispP - (k + 1) * 0.028, iso, trailScratch[k]);
      }
      let alpha = 0.3;
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = tr.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = st * (1 - k * 0.25);
        ctx.beginPath();
        ctx.moveTo(trailScratch[k][0], trailScratch[k][1]);
        if (k === 0) {
          ctx.lineTo(bodyScene[0], bodyScene[1]);
        } else {
          ctx.lineTo(trailScratch[k - 1][0], trailScratch[k - 1][1]);
        }
        ctx.stroke();
        alpha *= 0.6;
      }
    }
    ctx.globalAlpha = 1;

    drawProjectileBody(ctx, tr, bodyScene[0], bodyScene[1], iso, now);
  }

  // ---------------- Particles ----------------------------------------------
  for (let i = 0; i < P_CAP; i++) {
    const p = particles[i];
    if (!p.alive) continue;
    const age = now - p.born;
    const lifeSec = p.life * 1000;
    if (age >= lifeSec) {
      p.alive = false;
      continue;
    }
    const u = age / lifeSec;
    if (p.g !== 0) p.vy += p.g * dt;
    if (p.drag !== 1) {
      p.vx *= p.drag;
      p.vy *= p.drag;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    drawParticle(ctx, p, u, now);
  }
  ctx.globalAlpha = 1;

  // ---------------- Hot Candle flickering flames ---------------------------
  drawCandleFlames(ctx, state, iso, now);

  // ---------------- Spell Tower mode ring hints ----------------------------
  drawSpellTowerHints(ctx, state, iso, now);
}

// Per-kind trail ambient configs -------------------------------------------------
interface AmbientCfg {
  step: number;
  color: string;
  kind: ParticleKind;
  speed: number;
  life: number;
}
const PROJECTILE_AMBIENT = new Map<ProjectileKind, AmbientCfg>([
  ['MortarShell', { step: 0.05, color: '#cbd5e1', kind: 'smoke', speed: 0.35, life: 1 }],
  ['Boulder', { step: 0.05, color: '#cbd5e1', kind: 'smoke', speed: 0.35, life: 1 }],
  ['ScatterBundle', { step: 0.06, color: '#e2e8f0', kind: 'smoke', speed: 0.3, life: 1 }],
  ['Cannonball', { step: 0.08, color: '#cbd5e1', kind: 'smoke', speed: 0.3, life: 1 }],
  ['WizardFireball', { step: 0.03, color: '#fb923c', kind: 'ember', speed: 0.9, life: 1 }],
  ['FlameSpirit', { step: 0.03, color: '#f97316', kind: 'ember', speed: 0.9, life: 1 }],
  ['CandleFlame', { step: 0.03, color: '#fb923c', kind: 'ember', speed: 0.9, life: 1 }],
  ['Rocket', { step: 0.04, color: '#fda4af', kind: 'ember', speed: 0.8, life: 1 }],
  ['SpellVial', { step: 0.07, color: '#86efac', kind: 'droplet', speed: 0.5, life: 1.2 }],
  ['Log', { step: 0.05, color: '#a89984', kind: 'dust', speed: 0.5, life: 1 }],
]);
const STREAK_WIDTH = new Map<ProjectileKind, number>([
  ['Arrow', 1.7],
  ['Spear', 2.4],
  ['EnergyBolt', 2.8],
  ['WizardFireball', 4.2],
  ['FlameSpirit', 4.2],
  ['CandleFlame', 4.2],
  ['Rocket', 3.2],
]);

// ---------------------------------------------------------------------------
// Projectile bodies (per-frame at interpolated position)
// ---------------------------------------------------------------------------
function drawProjectileBody(
  ctx: CanvasRenderingContext2D,
  tr: ProjTrack,
  px: number,
  py: number,
  iso: boolean,
  now: number
): void {
  ctx.save();
  ctx.translate(px, py);
  const ang = Math.atan2(tr.toY - tr.fromY, tr.toX - tr.fromX);
  ctx.rotate(
    iso ? Math.atan2(Math.sin(ang) * ISO_TILE_H, Math.cos(ang) * ISO_TILE_W) : ang
  );

  if (tr.kind === 'Spear' || tr.kind === 'Arrow') {
    const len = tr.kind === 'Spear' ? 14 : 10;
    ctx.strokeStyle = tr.color;
    ctx.lineWidth = tr.kind === 'Spear' ? 2.6 : 1.9;
    ctx.beginPath();
    ctx.moveTo(-len * 0.6, 0);
    ctx.lineTo(len * 0.5, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(len * 0.62, 0);
    ctx.lineTo(len * 0.2, -2.6);
    ctx.lineTo(len * 0.2, 2.6);
    ctx.closePath();
    ctx.fill();
  } else if (
    tr.kind === 'MortarShell' ||
    tr.kind === 'Boulder' ||
    tr.kind === 'ScatterBundle' ||
    tr.kind === 'Cannonball'
  ) {
    const rad =
      tr.kind === 'MortarShell' || tr.kind === 'Boulder'
        ? 5.4
        : tr.kind === 'ScatterBundle'
        ? 4.6
        : 3.6;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = tr.color;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.globalAlpha = 0.45 + 0.3 * Math.abs(Math.sin(now * 0.02));
    ctx.fillStyle = tr.color;
    ctx.beginPath();
    ctx.arc(-rad * 0.32, -rad * 0.32, rad * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (tr.kind === 'Log') {
    ctx.fillStyle = '#78350f';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6;
    ctx.fillRect(-5, -9, 10, 18);
    ctx.strokeRect(-5, -9, 10, 18);
  } else if (tr.kind === 'SpellVial') {
    ctx.fillStyle = tr.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-1.4, -1.6, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (tr.kind === 'Rocket') {
    ctx.fillStyle = tr.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fecdd3';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(2.8, -2);
    ctx.lineTo(2.8, 2);
    ctx.closePath();
    ctx.fill();
  } else if (tr.kind === 'EnergyBolt') {
    ctx.fillStyle = tr.color;
    ctx.beginPath();
    ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-0.8, -0.8, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    // CandleFlame / WizardFireball / FlameSpirit — flickering flame blob
    const flick = 0.9 + 0.14 * Math.abs(Math.sin(now * 0.03));
    ctx.fillStyle = tr.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.4 / flick, 3.6 * flick, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(1.2, 0, 3.1, 2.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(2.1, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Particle painters
// ---------------------------------------------------------------------------
function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  u: number,
  now: number
): void {
  switch (p.kind) {
    case 'smoke':
    case 'dust': {
      const grow = (0.7 + 1.5 * u) * p.size;
      ctx.globalAlpha = (1 - u) * (p.kind === 'dust' ? 0.5 : 0.42);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, grow, grow * ISO_Y_SQUASH, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'ember': {
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - u * 0.6), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'debris': {
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = p.color;
      const s = p.size * (1 - u * 0.35);
      ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
      break;
    }
    case 'droplet': {
      ctx.globalAlpha = (1 - u) * 0.8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - u * 0.5), 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bubble': {
      ctx.globalAlpha = (1 - u) * 0.8;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(now * 0.006 + p.seed) * 1.6, p.y, p.size * (1 - u * 0.3), 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'plus': {
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.6;
      const s = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x - s, p.y);
      ctx.lineTo(p.x + s, p.y);
      ctx.moveTo(p.x, p.y - s);
      ctx.lineTo(p.x, p.y + s);
      ctx.stroke();
      break;
    }
    case 'mote': {
      ctx.globalAlpha = (1 - u) * (0.45 + 0.4 * Math.sin(now * 0.02 + p.seed));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'shard': {
      ctx.globalAlpha = (1 - u) * 0.9;
      ctx.fillStyle = p.color;
      const s = p.size * (1 - u * 0.3);
      const rot = p.seed + now * 0.004;
      const c = Math.cos(rot);
      const sn = Math.sin(rot);
      ctx.beginPath();
      ctx.moveTo(p.x + sn * s, p.y - c * s);
      ctx.lineTo(p.x + c * s, p.y + sn * s);
      ctx.lineTo(p.x - sn * s, p.y + c * s);
      ctx.lineTo(p.x - c * s, p.y - sn * s);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Hot Candle flickering flames (fx sprite with canvas fallback)
// ---------------------------------------------------------------------------
function drawCandleFlames(
  ctx: CanvasRenderingContext2D,
  state: BattleEngineState,
  iso: boolean,
  now: number
): void {
  const flamesImg = getLoadedImage(FX_SPRITES.EternalFlame);
  for (const b of state.buildings) {
    if (b.destroyed || b.building_id !== 'CraftingStation') continue;
    const flames = b.candle_stage === 3 ? 3 : b.candle_stage === 2 ? 4 : 6;
    const [cx, cy] = projectTile(b.center_x, b.center_y, iso);
    let spriteW = b.footprint * (iso ? ISO_TILE_W : 15.6) * 0.8;
    let spriteH = spriteW;
    const img = getLoadedImage(
      getBuildingSpriteUrl(
        'CraftingStation',
        b.mode,
        state.destroyed_scorable_buildings,
        b.candle_stage ?? 1
      )
    );
    if (img) {
      const size = buildingSpriteSize(img, b.footprint, iso);
      spriteW = size.w;
      spriteH = size.h;
    }
    const bottomY = cy + b.footprint * (iso ? ISO_TILE_H * 0.32 : 15.6 * 0.34);
    const topY = bottomY - spriteH;

    for (let i = 0; i < flames; i++) {
      const phase = now * 0.006 * (1 + (i % 3) * 0.25) + i * 1.7;
      const sway = Math.sin(phase) * 1.7 + Math.sin(phase * 2.6 + i) * 0.8;
      const flick = 0.9 + 0.16 * Math.abs(Math.sin(phase * 3.1 + i * 0.9));
      const fxp = cx + (i - (flames - 1) / 2) * (spriteW * 0.15) + sway * 0.6;
      const fyp = topY + spriteH * 0.14;
      const fw = spriteW * 0.13;
      const fh = fw * 1.7 * flick;
      if (flamesImg) {
        ctx.globalAlpha = 0.95;
        ctx.drawImage(flamesImg, fxp - fw / 2, fyp - fh, fw, fh);
        ctx.globalAlpha = 1;
      } else {
        // Canvas teardrop flame fallback while the sprite loads.
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.moveTo(fxp - fw * 0.5, fyp);
        ctx.quadraticCurveTo(fxp - fw * 0.55, fyp - fh * 0.5, fxp + sway * 0.4, fyp - fh);
        ctx.quadraticCurveTo(fxp + fw * 0.55, fyp - fh * 0.5, fxp + fw * 0.5, fyp);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fde68a';
        ctx.beginPath();
        ctx.ellipse(fxp, fyp - fh * 0.28, fw * 0.26, fh * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Spell Tower aura hint (subtle pulsing dashed ring, colour = current mode)
// ---------------------------------------------------------------------------
function drawSpellTowerHints(
  ctx: CanvasRenderingContext2D,
  state: BattleEngineState,
  iso: boolean,
  now: number
): void {
  for (const b of state.buildings) {
    if (b.destroyed || b.building_id !== 'SpellTower') continue;
    let radiusTiles = 5;
    let stroke = 'rgba(216, 180, 254, 0.6)';
    if (b.mode === 'SpellTowerPoison') {
      radiusTiles = 5;
      stroke = 'rgba(163, 230, 53, 0.55)';
    } else if (b.mode === 'SpellTowerInvisibility') {
      radiusTiles = 4.5;
      stroke = 'rgba(226, 232, 240, 0.5)';
    } else if (b.mode === 'SpellTowerEarthquake') {
      radiusTiles = 4.7;
      stroke = 'rgba(217, 119, 6, 0.55)';
    }
    const [cx, cy] = projectTile(b.center_x, b.center_y, iso);
    const R = radiusTiles * (iso ? 11.2 : 15.6);
    const pulse = 1 + 0.015 * Math.sin(now * 0.003);
    ctx.save();
    ctx.setLineDash(dashPat);
    ctx.lineDashOffset = now * 0.008;
    ctx.strokeStyle = stroke;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * pulse, R * pulse * (iso ? ISO_Y_SQUASH : 1), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
