import { useEffect, useState } from 'react';
import {
  BUILDING_MODE_SPRITES,
  BUILDING_SPRITES,
  EQUIPMENT_SPRITES,
  FX_SPRITES,
  HERO_BANNER_SPRITES,
  HERO_SPRITES,
  PET_SPRITES,
  SPELL_SPRITES,
  TRAP_SPRITES,
  TROOP_SPRITES,
  UI_SPRITES,
  UNIT_BODY_SPRITES,
} from '../assetsManifest';

const imageCache = new Map<string, HTMLImageElement>();
const loadedListeners = new Set<() => void>();
let preloadStarted = false;

function notifyListeners() {
  loadedListeners.forEach((cb) => cb());
}

export function getLoadedImage(url: string | undefined): HTMLImageElement | null {
  if (!url) return null;
  const cached = imageCache.get(url);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return cached;
  }
  if (!cached) {
    const img = new Image();
    img.src = url;
    img.onload = () => notifyListeners();
    imageCache.set(url, img);
  }
  return null;
}

/** Returns the sprite URL for a building, honouring its current defense mode. */
export function getBuildingSpriteUrl(
  buildingId: string,
  mode: string,
  destroyedCount = 0,
  candleStage = 1
): string | undefined {
  if (buildingId === 'CraftingStation') {
    if (candleStage >= 3 && BUILDING_MODE_SPRITES.HotCandleStage3) {
      return BUILDING_MODE_SPRITES.HotCandleStage3;
    }
    if (candleStage === 2 && BUILDING_MODE_SPRITES.HotCandleStage2) {
      return BUILDING_MODE_SPRITES.HotCandleStage2;
    }
    return BUILDING_SPRITES.CraftingStation;
  }
  if (buildingId === 'InfernoTower' && mode === 'InfernoMulti') {
    return BUILDING_MODE_SPRITES.InfernoMulti;
  }
  if (buildingId === 'XBow' && mode === 'XBowAirAndGround') {
    return BUILDING_MODE_SPRITES.XBowAirAndGround;
  }
  if (buildingId === 'MultiGearTower' && mode === 'MultiGearFastAttack') {
    return BUILDING_MODE_SPRITES.MultiGearFastAttack;
  }
  if (buildingId === 'SpellTower') {
    if (mode === 'SpellTowerPoison') return BUILDING_MODE_SPRITES.SpellTowerPoison;
    if (mode === 'SpellTowerInvisibility') return BUILDING_MODE_SPRITES.SpellTowerInvisibility;
    if (mode === 'SpellTowerEarthquake') return BUILDING_MODE_SPRITES.SpellTowerEarthquake;
  }
  if (buildingId === 'RevengeTower' && destroyedCount >= 40) {
    return BUILDING_MODE_SPRITES.RevengeStage3;
  }
  return BUILDING_SPRITES[buildingId];
}

/** Square portrait icon used by the HUD dock, pickers and cards. */
export function getUnitSpriteUrl(
  kind: { Troop?: string; Hero?: string; Pet?: string } | 'Totem'
): string | undefined {
  if (kind === 'Totem') {
    return SPELL_SPRITES.Totem;
  }
  if (kind.Hero) return HERO_SPRITES[kind.Hero];
  if (kind.Pet) return PET_SPRITES[kind.Pet];
  if (kind.Troop) return TROOP_SPRITES[kind.Troop];
  return undefined;
}

/** Sub-unit full-body fallback mappings so spawned units never render as circles. */
const SUB_UNIT_BODY_FALLBACKS: Record<string, string> = {
  InfernoDragon: '/assets/troops/inferno_dragon.webp',
  Golemite: '/assets/unit/Golem.png',
  LavaPup: '/assets/unit/Minion.png',
  Yetimite: '/assets/unit/Yeti.png',
  Firemite: '/assets/unit/Firemite.png',
  Frostmite: '/assets/unit/pets/Frosty.png',
  Henchman: '/assets/unit/Minion.png',
  Booger: '/assets/unit/pets/Sneezy.png',
  DruidBear: '/assets/unit/Druid.png',
  Meteormite: '/assets/unit/MeteorGolem.png',
  RuinKnight: '/assets/unit/RuinWitch.png',
  GiantGiant: '/assets/unit/SuperGiant.png',
  Lavaloon: '/assets/troops/lavaloon.webp',
  Snake: '/assets/equipment/snake_bracelet.webp',
  Skeleton: '/assets/unit/Skeleton.png',
  ArmoredSkeleton: '/assets/unit/ArmoredSkeleton.png',
  Bat: '/assets/troops/bat.webp',
};

/** Full-body transparent battlefield render. */
export function getUnitBodyUrl(
  kind: { Troop?: string; Hero?: string; Pet?: string } | 'Totem'
): string | undefined {
  if (kind === 'Totem') return SPELL_SPRITES.Totem;
  if (kind.Hero) return UNIT_BODY_SPRITES[`unit/heroes/${heroFile(kind.Hero)}.webp`];
  if (kind.Pet) return UNIT_BODY_SPRITES[`unit/pets/${kind.Pet}.png`];
  if (kind.Troop) {
    if (kind.Troop.startsWith('Guardian')) {
      const key = `unit/guardians/${kind.Troop.replace('Guardian', '').toLowerCase()}.png`;
      if (UNIT_BODY_SPRITES[key]) return UNIT_BODY_SPRITES[key];
    }
    return (
      UNIT_BODY_SPRITES[`unit/${kind.Troop}.png`] ??
      SUB_UNIT_BODY_FALLBACKS[kind.Troop] ??
      TROOP_SPRITES[kind.Troop]
    );
  }
  return undefined;
}

function heroFile(heroId: string): string {
  return heroId
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

/** True when the sprite is a hero medallion (square portrait) rather than a full body render. */
export function isHeroKind(kind: { Hero?: string } | 'Totem'): boolean {
  return typeof kind === 'object' && Boolean(kind.Hero);
}

/**
 * Consistent relative sizing for building sprites.
 *
 * The game's asset renders are all authored at the same pixel scale, so a single
 * global multiplier keeps every building proportional to its true in-game size
 * (a 3x3 Bomb Tower stays visibly smaller than the 4x4 Town Hall). Two clamps
 * prevent a wide/squat sprite from spilling outside its own tile footprint.
 */
export function buildingSpriteSize(
  img: HTMLImageElement,
  footprint: number,
  isometric: boolean
): { w: number; h: number } {
  const tileW = isometric ? 21.6 : 15.6;
  const GLOBAL = 0.42;

  let w = img.naturalWidth * GLOBAL;
  let h = img.naturalHeight * GLOBAL;

  // A handful of sprites ship at very high resolution and need renormalising.
  if (img.naturalWidth > 400 || img.naturalHeight > 420) {
    h = footprint * 26;
    w = (img.naturalWidth / Math.max(1, img.naturalHeight)) * h;
  }

  const maxW = footprint * tileW * 1.05;
  const maxH = footprint * (isometric ? 30 : 26);
  const k = Math.min(1, maxW / Math.max(1, w), maxH / Math.max(1, h));
  return { w: w * k, h: h * k };
}

/** Visual height of a battlefield unit, in virtual pixels (1 tile ≈ 21.6 px). */
export function unitBodyHeight(
  kind: { Troop?: string; Hero?: string; Pet?: string } | 'Totem',
  housingSpace: number,
  isometric: boolean
): number {
  const tile = isometric ? 21.6 : 15.6;
  if (typeof kind === 'object' && kind.Hero) return tile * 1.75;
  if (typeof kind === 'object' && kind.Pet) return tile * 1.05;
  if (kind === 'Totem') return tile * 1.2;

  // Roughly matches the live game: a Barbarian is about one tile tall, a
  // P.E.K.K.A / Golem closer to two.
  if (housingSpace <= 2) return tile * 0.9;
  if (housingSpace <= 6) return tile * 1.05;
  if (housingSpace <= 10) return tile * 1.2;
  if (housingSpace <= 16) return tile * 1.4;
  if (housingSpace <= 25) return tile * 1.6;
  return tile * 1.85;
}

export function preloadAllSprites() {
  if (preloadStarted) return;
  preloadStarted = true;
  const allUrls = new Set<string>([
    ...Object.values(BUILDING_SPRITES),
    ...Object.values(BUILDING_MODE_SPRITES),
    ...Object.values(TRAP_SPRITES),
    ...Object.values(HERO_SPRITES),
    ...Object.values(HERO_BANNER_SPRITES),
    ...Object.values(EQUIPMENT_SPRITES),
    ...Object.values(PET_SPRITES),
    ...Object.values(TROOP_SPRITES),
    ...Object.values(SPELL_SPRITES),
    ...Object.values(FX_SPRITES),
    ...Object.values(UI_SPRITES),
    ...Object.values(UNIT_BODY_SPRITES),
  ]);

  allUrls.forEach((url) => {
    if (!imageCache.has(url)) {
      const img = new Image();
      img.src = url;
      img.onload = () => notifyListeners();
      imageCache.set(url, img);
    }
  });
}

export function useSpritePreloader(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    preloadAllSprites();
    let frame: number | null = null;
    const listener = () => {
      if (frame === null) {
        frame = requestAnimationFrame(() => {
          frame = null;
          setTick((t) => t + 1);
        });
      }
    };
    loadedListeners.add(listener);
    return () => {
      loadedListeners.delete(listener);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
  return tick;
}
