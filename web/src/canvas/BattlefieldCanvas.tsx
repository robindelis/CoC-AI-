import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BattleEngineState,
  BuildingSpec,
  FullCatalog,
  TrapSpec,
  VillageLayout,
} from '../types';
import { HERO_BANNER_SPRITES, TRAP_SPRITES, TROOP_SPRITES } from '../assetsManifest';
import {
  buildingSpriteSize,
  getBuildingSpriteUrl,
  getLoadedImage,
  getUnitBodyUrl,
  isHeroKind,
  unitBodyHeight,
  useSpritePreloader,
} from './spriteLoader';
import * as fx from './fx';

export interface OverlayOptions {
  isometric: boolean;
  showRedZone: boolean;
  showRanges: boolean;
  showDpsHeatmap: boolean;
  showTargetVectors: boolean;
  showTraps: boolean;
  /** FX Quality: High spawns particles, Low keeps only cheap effects. */
  fxHigh: boolean;
}

type EditorTool =
  | { type: 'select' }
  | { type: 'wall_brush' }
  | { type: 'wall_eraser' }
  | { type: 'place_building'; buildingId: string }
  | { type: 'place_trap'; trapId: string };

export type DeploySlotType =
  | { kind: 'inspect' }
  | { kind: 'troop'; troopId: string }
  | { kind: 'hero'; heroId: string }
  | { kind: 'siege' }
  | { kind: 'spell'; spellId: string };

interface Props {
  mode: 'editor' | 'battle';
  catalog: FullCatalog;
  layout: VillageLayout;
  noDeployMask: boolean[][];
  battleState: BattleEngineState | null;
  overlays: OverlayOptions;
  onToggleOverlay?: (key: keyof OverlayOptions) => void;
  selectedEditorTool: EditorTool;
  selectedBuildingInstanceId: number | null;
  selectedBattleEntity: { kind: 'building' | 'unit'; id: number } | null;
  selectionClickSeq?: number;
  deploySlot?: DeploySlotType;
  onTileAction: (
    tileX: number,
    tileY: number,
    exactX: number,
    exactY: number,
    isDrag: boolean
  ) => void;
  onMoveBuilding?: (instanceId: number, tileX: number, tileY: number) => boolean;
  onSelectBuildingInstance: (instanceId: number | null) => void;
  onSelectBattleEntity: (entity: { kind: 'building' | 'unit'; id: number } | null) => void;
}

/** Virtual design-space size. All grid maths happen in this coordinate system. */
const VIRTUAL_W = 1240;
const VIRTUAL_H = 880;
const ISO_TILE_W = 21.6;
const ISO_TILE_H = 14.4;
const ISO_ORIGIN_Y = 78;

const SPELL_COLORS: Record<string, { fill: string; stroke: string }> = {
  Lightning: { fill: 'rgba(59, 130, 246, 0.32)', stroke: 'rgba(147, 197, 253, 0.95)' },
  Healing: { fill: 'rgba(250, 204, 21, 0.28)', stroke: 'rgba(254, 240, 138, 0.92)' },
  Rage: { fill: 'rgba(168, 85, 247, 0.30)', stroke: 'rgba(216, 180, 254, 0.90)' },
  Jump: { fill: 'rgba(34, 197, 94, 0.30)', stroke: 'rgba(134, 239, 172, 0.92)' },
  Freeze: { fill: 'rgba(56, 189, 248, 0.36)', stroke: 'rgba(186, 230, 253, 0.95)' },
  Clone: { fill: 'rgba(14, 165, 233, 0.30)', stroke: 'rgba(125, 211, 252, 0.92)' },
  Invisibility: { fill: 'rgba(148, 163, 184, 0.36)', stroke: 'rgba(226, 232, 240, 0.92)' },
  Recall: { fill: 'rgba(45, 212, 191, 0.30)', stroke: 'rgba(153, 246, 228, 0.95)' },
  Revive: { fill: 'rgba(251, 191, 36, 0.32)', stroke: 'rgba(253, 230, 138, 0.95)' },
  Totem: { fill: 'rgba(245, 158, 11, 0.28)', stroke: 'rgba(253, 230, 138, 0.90)' },
  Poison: { fill: 'rgba(234, 88, 12, 0.32)', stroke: 'rgba(253, 186, 116, 0.92)' },
  Earthquake: { fill: 'rgba(180, 83, 9, 0.34)', stroke: 'rgba(253, 186, 116, 0.92)' },
  Haste: { fill: 'rgba(244, 114, 182, 0.30)', stroke: 'rgba(251, 207, 232, 0.92)' },
  SkeletonSpell: { fill: 'rgba(220, 38, 38, 0.28)', stroke: 'rgba(252, 165, 165, 0.92)' },
  BatSpell: { fill: 'rgba(124, 58, 237, 0.30)', stroke: 'rgba(196, 181, 253, 0.92)' },
  Overgrowth: { fill: 'rgba(21, 128, 61, 0.45)', stroke: 'rgba(74, 222, 128, 0.95)' },
  IceBlock: { fill: 'rgba(125, 211, 252, 0.40)', stroke: 'rgba(224, 242, 254, 0.95)' },
  Angry: { fill: 'rgba(239, 68, 68, 0.32)', stroke: 'rgba(252, 165, 165, 0.95)' },
};

// Deterministic perimeter tree ring around the clearing
const PERIMETER_TREES = Array.from({ length: 62 }, (_, i) => {
  const angle = (i / 62) * Math.PI * 2;
  const dist = 27.4 + (i % 3) * 1.5;
  return {
    gx: 25 + Math.cos(angle) * dist,
    gy: 25 + Math.sin(angle) * dist,
    scale: 0.85 + (i % 4) * 0.14,
    shade: i % 2 === 0 ? '#1e4a22' : '#255c29',
  };
});

export const BattlefieldCanvas: React.FC<Props> = ({
  mode,
  catalog,
  layout,
  noDeployMask,
  battleState,
  overlays,
  onToggleOverlay,
  selectedEditorTool,
  selectedBuildingInstanceId,
  selectedBattleEntity,
  selectionClickSeq = 0,
  deploySlot,
  onTileAction,
  onMoveBuilding,
  onSelectBuildingInstance,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const spriteLoadTick = useSpritePreloader();

  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 1200, h: 800 });
  const [hoverTile, setHoverTile] = useState<{
    x: number;
    y: number;
    exactX: number;
    exactY: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState<number>(1.05);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggingBuilding, setDraggingBuilding] = useState<{
    instanceId: number;
    tileX: number;
    tileY: number;
  } | null>(null);
  const [animFrameTick, setAnimFrameTick] = useState<number>(0);

  const panStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    hasPanned: boolean;
    active: boolean;
  }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
    hasPanned: false,
    active: false,
  });
  const buildingDragRef = useRef<{
    instanceId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    hasMoved: boolean;
  } | null>(null);
  const clickAnimRef = useRef<{ instanceId: number; startTime: number } | null>(null);

  // Trigger a 280ms Clash-style bounce animation whenever a building is clicked in Editor or Battle
  useEffect(() => {
    const activeId =
      mode === 'editor'
        ? selectedBuildingInstanceId
        : selectedBattleEntity?.kind === 'building'
        ? selectedBattleEntity.id
        : null;
    if (activeId == null) return;
    const startTime = performance.now();
    clickAnimRef.current = { instanceId: activeId, startTime };
    let rafId: number | null = null;
    const tick = () => {
      const elapsed = performance.now() - startTime;
      setAnimFrameTick(elapsed);
      if (elapsed < 300) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [mode, selectedBuildingInstanceId, selectedBattleEntity, selectionClickSeq]);

  const buildingSpecMap = useMemo(() => {
    const m = new Map<string, BuildingSpec>();
    catalog.buildings.forEach((b) => m.set(b.id, b));
    return m;
  }, [catalog]);

  const trapSpecMap = useMemo(() => {
    const m = new Map<string, TrapSpec>();
    catalog.traps.forEach((t) => m.set(t.id, t));
    return m;
  }, [catalog]);

  // Track the true CSS size of the canvas container (crisp 1:1 pointer mapping)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setViewport({
        w: Math.max(320, Math.round(rect.width)),
        h: Math.max(320, Math.round(rect.height)),
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const fit = Math.min(viewport.w / VIRTUAL_W, viewport.h / VIRTUAL_H);

  // ---------------------------------------------------------------------
  // FX overlay runtime — mirrored into refs so the rAF loop reads fresh
  // camera/state without React re-renders.
  // ---------------------------------------------------------------------
  const fxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fxStateRef = useRef({
    iso: true,
    mode: mode,
    battleState: null as BattleEngineState | null,
    camera: {
      dpr: window.devicePixelRatio || 1,
      cssW: viewport.w,
      cssH: viewport.h,
      fit: fit,
      zoom: zoom,
      panX: pan.x,
      panY: pan.y,
    },
  });

  // Mirror current props into the FX runtime on every render.
  useEffect(() => {
    const st = fxStateRef.current;
    st.iso = overlays.isometric;
    st.mode = mode;
    st.battleState = battleState;
    st.camera.dpr = window.devicePixelRatio || 1;
    st.camera.cssW = viewport.w;
    st.camera.cssH = viewport.h;
    st.camera.fit = fit;
    st.camera.zoom = zoom;
    st.camera.panX = pan.x;
    st.camera.panY = pan.y;
  });

  // New engine snapshot → diff particles/tracks/latches.
  useEffect(() => {
    if (battleState) fx.syncBattleFx(battleState);
  }, [battleState]);

  // FX quality toggle.
  useEffect(() => {
    fx.setFxQuality(overlays.fxHigh);
  }, [overlays.fxHigh]);

  // Persistent 60 fps FX loop on the overlay canvas.
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      const overlay = fxCanvasRef.current;
      const st = fxStateRef.current;
      if (overlay) {
        const dpr = st.camera.dpr;
        const w = Math.round(st.camera.cssW * dpr);
        const h = Math.round(st.camera.cssH * dpr);
        if (w > 0 && h > 0 && (overlay.width !== w || overlay.height !== h)) {
          overlay.width = w;
          overlay.height = h;
        }
        const ctx = overlay.getContext('2d');
        if (ctx && w > 0 && h > 0) {
          if (st.mode === 'battle' && st.battleState) {
            fx.drawFxFrame(ctx, st.battleState, st.iso, st.camera, t);
          } else {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, overlay.width, overlay.height);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  /** Virtual design-space → screen CSS pixels. */
  const gridToScreen = useCallback(
    (gx: number, gy: number): [number, number] => {
      let vx: number;
      let vy: number;
      if (!overlays.isometric) {
        const boardPx = 780;
        const ox = (VIRTUAL_W - boardPx) / 2;
        const oy = (VIRTUAL_H - boardPx) / 2;
        const cell = boardPx / 50;
        vx = ox + gx * cell;
        vy = oy + gy * cell;
      } else {
        vx = VIRTUAL_W / 2 + (gx - gy) * (ISO_TILE_W / 2);
        vy = ISO_ORIGIN_Y + (gx + gy) * (ISO_TILE_H / 2);
      }
      return [
        (vx - VIRTUAL_W / 2) * fit * zoom + viewport.w / 2 + pan.x,
        (vy - VIRTUAL_H / 2) * fit * zoom + viewport.h / 2 + pan.y,
      ];
    },
    [overlays.isometric, fit, zoom, viewport.w, viewport.h, pan.x, pan.y]
  );

  /** Screen CSS pixels → virtual design space. */
  const screenToVirtual = useCallback(
    (px: number, py: number): [number, number] => {
      const s = fit * zoom;
      return [
        (px - viewport.w / 2 - pan.x) / s + VIRTUAL_W / 2,
        (py - viewport.h / 2 - pan.y) / s + VIRTUAL_H / 2,
      ];
    },
    [fit, zoom, viewport.w, viewport.h, pan.x, pan.y]
  );

  const virtualToGrid = useCallback(
    (vx: number, vy: number): [number, number] => {
      if (!overlays.isometric) {
        const boardPx = 780;
        const ox = (VIRTUAL_W - boardPx) / 2;
        const oy = (VIRTUAL_H - boardPx) / 2;
        const cell = boardPx / 50;
        return [(vx - ox) / cell, (vy - oy) / cell];
      }
      const dx = (vx - VIRTUAL_W / 2) / (ISO_TILE_W / 2);
      const dy = (vy - ISO_ORIGIN_Y) / (ISO_TILE_H / 2);
      return [(dy + dx) / 2, (dy - dx) / 2];
    },
    [overlays.isometric]
  );

  // ---------------------------------------------------------------------
  // Placement validation shared by the ghost preview and the editor clicks
  // ---------------------------------------------------------------------
  const occupied = useMemo(() => {
    const grid: boolean[][] = Array.from({ length: 50 }, () => Array(50).fill(false));
    for (const b of layout.buildings) {
      const size = buildingSpecMap.get(b.building_id)?.footprint ?? 3;
      if (b.instance_id === selectedBuildingInstanceId && mode === 'editor') continue;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const x = b.tile_x + dx;
          const y = b.tile_y + dy;
          if (x < 50 && y < 50) grid[y][x] = true;
        }
      }
    }
    for (const [wx, wy] of layout.walls) {
      if (wx < 50 && wy < 50) grid[wy][wx] = true;
    }
    for (const t of layout.traps) {
      const size = trapSpecMap.get(t.trap_id)?.footprint ?? 1;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const x = t.tile_x + dx;
          const y = t.tile_y + dy;
          if (x < 50 && y < 50) grid[y][x] = true;
        }
      }
    }
    return grid;
  }, [
    layout.buildings,
    layout.walls,
    layout.traps,
    buildingSpecMap,
    trapSpecMap,
    selectedBuildingInstanceId,
    mode,
  ]);

  const footprintFits = useCallback(
    (tileX: number, tileY: number, size: number): boolean => {
      if (tileX < 3 || tileY < 3 || tileX + size > 47 || tileY + size > 47) return false;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          if (occupied[tileY + dy]?.[tileX + dx]) return false;
        }
      }
      return true;
    },
    [occupied]
  );

  /** Size of the footprint currently being placed/moved (for the ghost preview). */
  const ghostFootprint = useMemo<number | null>(() => {
    if (mode !== 'editor') return null;
    if (selectedEditorTool.type === 'place_building') {
      return buildingSpecMap.get(selectedEditorTool.buildingId)?.footprint ?? 3;
    }
    if (selectedEditorTool.type === 'place_trap') {
      return trapSpecMap.get(selectedEditorTool.trapId)?.footprint ?? 1;
    }
    if (selectedEditorTool.type === 'select' && selectedBuildingInstanceId !== null) {
      const b = layout.buildings.find((pb) => pb.instance_id === selectedBuildingInstanceId);
      if (!b) return null;
      return buildingSpecMap.get(b.building_id)?.footprint ?? 3;
    }
    return null;
  }, [
    mode,
    selectedEditorTool,
    selectedBuildingInstanceId,
    buildingSpecMap,
    trapSpecMap,
    layout.buildings,
  ]);

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = viewport.w;
    const cssH = viewport.h;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Scenic backdrop
    const bg = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      80,
      canvas.width / 2,
      canvas.height / 2,
      Math.max(canvas.width, canvas.height) * 0.75
    );
    bg.addColorStop(0, '#2c5c20');
    bg.addColorStop(0.62, '#1d4017');
    bg.addColorStop(1, '#0d220a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Enter virtual design space
    const scale = dpr * fit * zoom;
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      dpr * (cssW / 2 + pan.x) - scale * (VIRTUAL_W / 2),
      dpr * (cssH / 2 + pan.y) - scale * (VIRTUAL_H / 2)
    );

    const activeMask =
      mode === 'battle' && battleState ? battleState.no_deploy_mask : noDeployMask;

    // Outer dirt rim under the village board
    const rim = 0.9;

    /** Grid tile coordinates → virtual design-space pixels. */
    const vs = (gx: number, gy: number): [number, number] => {
      if (!overlays.isometric) {
        const boardPx = 780;
        const ox = (VIRTUAL_W - boardPx) / 2;
        const oy = (VIRTUAL_H - boardPx) / 2;
        const cell = boardPx / 50;
        return [ox + gx * cell, oy + gy * cell];
      }
      return [
        VIRTUAL_W / 2 + (gx - gy) * (ISO_TILE_W / 2),
        ISO_ORIGIN_Y + (gx + gy) * (ISO_TILE_H / 2),
      ];
    };

    const quad = (x0: number, y0: number, x1: number, y1: number) => {
      const a = vs(x0, y0);
      const b = vs(x1, y0);
      const c = vs(x1, y1);
      const d = vs(x0, y1);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.closePath();
    };

    /** Traces an exact circle of `radiusTiles` in grid space around `(gx0, gy0)`. */
    const traceGridCircle = (gx0: number, gy0: number, radiusTiles: number) => {
      const [cx, cy] = vs(gx0, gy0);
      if (!overlays.isometric) {
        const cell = 780 / 50;
        ctx.beginPath();
        ctx.arc(cx, cy, radiusTiles * cell, 0, Math.PI * 2);
      } else {
        // Under vs(gx, gy), a grid circle of radius R projects to an axis-aligned
        // ellipse with semi-axes R * (ISO_TILE_W / sqrt(2)) and R * (ISO_TILE_H / sqrt(2)).
        const rx = radiusTiles * (ISO_TILE_W / Math.SQRT2);
        const ry = radiusTiles * (ISO_TILE_H / Math.SQRT2);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      }
    };

    ctx.fillStyle = '#3b2f20';
    quad(-rim, -rim, 50 + rim, 50 + rim);
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 184, 46, 0.28)';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Grass checkerboard
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        const isBuildable = x >= 3 && x < 47 && y >= 3 && y < 47;
        const isEven = (x + y) % 2 === 0;
        ctx.fillStyle = isBuildable
          ? isEven
            ? '#64ad30'
            : '#5aa029'
          : isEven
          ? '#468221'
          : '#3f761d';
        quad(x, y, x + 1, y + 1);
        ctx.fill();

        if (overlays.showRedZone && activeMask[y]?.[x]) {
          ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
          ctx.fill();
        }
      }
    }

    // Crisp red no-deploy boundary
    if (overlays.showRedZone) {
      ctx.strokeStyle = 'rgba(248, 113, 113, 0.85)';
      ctx.lineWidth = 1.8;
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          if (!activeMask[y]?.[x]) continue;
          if (!activeMask[y - 1]?.[x]) {
            const a = vs(x, y);
            const b = vs(x + 1, y);
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
          if (!activeMask[y]?.[x + 1]) {
            const a = vs(x + 1, y);
            const b = vs(x + 1, y + 1);
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
          if (!activeMask[y + 1]?.[x]) {
            const a = vs(x + 1, y + 1);
            const b = vs(x, y + 1);
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
          if (!activeMask[y]?.[x - 1]) {
            const a = vs(x, y + 1);
            const b = vs(x, y);
            ctx.beginPath();
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
            ctx.stroke();
          }
        }
      }
    }

    // 44x44 buildable border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.6;
    quad(3, 3, 47, 47);
    ctx.stroke();

    // Perimeter forest
    for (const tree of PERIMETER_TREES) {
      const [tx, ty] = vs(tree.gx, tree.gy);
      const r = 14 * tree.scale;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
      ctx.beginPath();
      ctx.ellipse(tx + 3, ty + 5, r * 0.9, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = tree.shade;
      ctx.beginPath();
      ctx.arc(tx, ty, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a7d3d';
      ctx.beginPath();
      ctx.arc(tx - r * 0.22, ty - r * 0.22, r * 0.62, 0, Math.PI * 2);
      ctx.fill();
    }

    const allBuildings =
      mode === 'battle' && battleState
        ? battleState.buildings
        : layout.buildings.map((pb, idx) => {
            const spec = buildingSpecMap.get(pb.building_id)!;
            const isBeingDragged =
              mode === 'editor' &&
              draggingBuilding &&
              draggingBuilding.instanceId === pb.instance_id;
            const tx = isBeingDragged ? draggingBuilding.tileX : pb.tile_x;
            const ty = isBeingDragged ? draggingBuilding.tileY : pb.tile_y;
            return {
              index: idx,
              instance_id: pb.instance_id,
              building_id: pb.building_id,
              name: spec.name,
              category: spec.category,
              tile_x: tx,
              tile_y: ty,
              footprint: spec.footprint,
              center_x: tx + spec.footprint / 2,
              center_y: ty + spec.footprint / 2,
              hp: spec.max_hp,
              max_hp: spec.max_hp,
              mode: pb.mode,
              direction_deg: pb.direction_deg,
              current_target: null,
              inferno_ramp_sec: 0,
              is_hidden_tesla_revealed: true,
              candle_stage: 1,
              freeze_timer: 0,
              stun_timer: 0,
              overgrowth_timer: 0,
              invisibility_timer: 0,
              rage_timer: 0,
              destroyed: false,
            };
          });

    /** Traces a directional cone sector path in grid coordinates around (gx0, gy0). */
    const traceConePath = (
      gx0: number,
      gy0: number,
      minR: number,
      maxR: number,
      dirDeg: number,
      arcDeg: number
    ) => {
      const startRad = ((dirDeg - arcDeg / 2) * Math.PI) / 180;
      const endRad = ((dirDeg + arcDeg / 2) * Math.PI) / 180;
      const steps = 28;
      ctx.beginPath();
      if (minR > 0.05) {
        for (let i = 0; i <= steps; i++) {
          const a = startRad + (i / steps) * (endRad - startRad);
          const [px, py] = vs(gx0 + Math.cos(a) * maxR, gy0 + Math.sin(a) * maxR);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        for (let i = steps; i >= 0; i--) {
          const a = startRad + (i / steps) * (endRad - startRad);
          const [px, py] = vs(gx0 + Math.cos(a) * minR, gy0 + Math.sin(a) * minR);
          ctx.lineTo(px, py);
        }
      } else {
        const [ox, oy] = vs(gx0, gy0);
        ctx.moveTo(ox, oy);
        for (let i = 0; i <= steps; i++) {
          const a = startRad + (i / steps) * (endRad - startRad);
          const [px, py] = vs(gx0 + Math.cos(a) * maxR, gy0 + Math.sin(a) * maxR);
          ctx.lineTo(px, py);
        }
      }
      ctx.closePath();
    };

    // DPS heatmap
    if (overlays.showDpsHeatmap) {
      for (const b of allBuildings) {
        if (b.destroyed) continue;
        const spec = buildingSpecMap.get(b.building_id);
        if (!spec || spec.max_range <= 0) continue;
        if (spec.dps <= 0 && b.building_id !== 'AirSweeper') continue;
        const [cx, cy] = vs(b.center_x, b.center_y);
        const radiusPx = spec.max_range * (overlays.isometric ? 11.2 : 15.6);
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radiusPx);
        if (b.building_id === 'AirSweeper') {
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.24)');
          grad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
        } else {
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.22)');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
        }
        ctx.fillStyle = grad;
        const coneArc =
          b.building_id === 'AirSweeper'
            ? 105
            : b.building_id === 'Firespitter'
            ? 150
            : null;
        if (coneArc !== null) {
          traceConePath(
            b.center_x,
            b.center_y,
            spec.min_range,
            spec.max_range,
            b.direction_deg ?? 0,
            coneArc
          );
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Baseplates / rubble
    for (const b of allBuildings) {
      if (
        mode === 'battle' &&
        b.building_id === 'HiddenTesla' &&
        !b.is_hidden_tesla_revealed &&
        !b.destroyed
      ) {
        continue;
      }
      ctx.fillStyle = b.destroyed ? 'rgba(41, 37, 36, 0.62)' : 'rgba(62, 102, 34, 0.70)';
      quad(b.tile_x + 0.06, b.tile_y + 0.06, b.tile_x + b.footprint - 0.06, b.tile_y + b.footprint - 0.06);
      ctx.fill();

      if (b.destroyed) {
        const [cx, cy] = vs(b.center_x, b.center_y);
        ctx.fillStyle = '#57534e';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8, 5, 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Traps
    if ((overlays.showTraps || mode === 'editor') && (battleState || mode === 'editor')) {
      const trapsList =
        mode === 'battle' && battleState
          ? battleState.traps
          : layout.traps.map((t) => ({
              ...t,
              center_x: t.tile_x + 0.5,
              center_y: t.tile_y + 0.5,
              triggered: false,
            }));
      for (const t of trapsList) {
        if (t.triggered) continue;
        const spec = trapSpecMap.get(t.trap_id);
        const size = spec?.footprint ?? 1;
        const [tx, ty] = vs(t.tile_x + size / 2, t.tile_y + size / 2);
        const img = getLoadedImage(TRAP_SPRITES[t.trap_id]);
        const drawSize = size === 2 ? 22 : 15;
        if (img) {
          ctx.drawImage(img, tx - drawSize / 2, ty - drawSize / 2, drawSize, drawSize);
        } else {
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(tx, ty, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Walls
    const wallsList =
      mode === 'battle' && battleState
        ? battleState.walls.filter((w) => !w.destroyed)
        : layout.walls.map(([wx, wy], i) => ({
            index: i,
            tile_x: wx,
            tile_y: wy,
            hp: 14000,
            max_hp: 14000,
            destroyed: false,
          }));

    const wallSet = new Set<string>();
    wallsList.forEach((w) => wallSet.add(`${w.tile_x},${w.tile_y}`));
    const wallImg = getLoadedImage(getBuildingSpriteUrl('Wall', 'Default'));

    ctx.strokeStyle = '#2f2b6e';
    ctx.lineWidth = overlays.isometric ? 7 : 9;
    ctx.lineCap = 'round';
    for (const w of wallsList) {
      const [wx, wy] = vs(w.tile_x + 0.5, w.tile_y + 0.5);
      if (wallSet.has(`${w.tile_x + 1},${w.tile_y}`)) {
        const [nx, ny] = vs(w.tile_x + 1.5, w.tile_y + 0.5);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
      if (wallSet.has(`${w.tile_x},${w.tile_y + 1}`)) {
        const [nx, ny] = vs(w.tile_x + 0.5, w.tile_y + 1.5);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
    }

    for (const w of wallsList) {
      const [wx, wy] = vs(w.tile_x + 0.5, w.tile_y + 0.5);
      const size = overlays.isometric ? 16 : 17;
      if (wallImg) {
        ctx.drawImage(wallImg, wx - size / 2, wy - size * 0.55, size, size);
      } else {
        ctx.fillStyle = '#6366f1';
        ctx.fillRect(wx - 4, wy - 4, 8, 8);
      }
    }

    // Depth-sorted buildings
    const destroyedCount =
      mode === 'battle' && battleState ? battleState.destroyed_scorable_buildings : 0;
    const sortedBuildings = [...allBuildings]
      .filter((b) => !b.destroyed)
      .sort((a, b) => a.center_x + a.center_y - (b.center_x + b.center_y));

    for (const b of sortedBuildings) {
      if (mode === 'battle' && b.building_id === 'HiddenTesla' && !b.is_hidden_tesla_revealed) {
        continue;
      }
      const spec = buildingSpecMap.get(b.building_id);
      const isSelected =
        (mode === 'editor' && selectedBuildingInstanceId === b.instance_id) ||
        (mode === 'battle' &&
          selectedBattleEntity?.kind === 'building' &&
          selectedBattleEntity.id === b.instance_id);

      const [cx, cy] = vs(b.center_x, b.center_y);

      // Compute click bounce animation if this building was just clicked
      let bounceScale = 1;
      let bounceLiftY = 0;
      let rangeScale = 1;
      let flashAlpha = 0;
      if (clickAnimRef.current && clickAnimRef.current.instanceId === b.instance_id) {
        const elapsed = performance.now() - clickAnimRef.current.startTime;
        if (elapsed >= 0 && elapsed < 300) {
          const u = elapsed / 300;
          bounceScale = 1 + 0.22 * Math.sin(u * Math.PI * 1.6) * (1 - u);
          bounceLiftY = -10 * Math.sin(u * Math.PI) * (1 - u * 0.35);
          rangeScale = 0.84 + 0.16 * Math.min(1, u * 2.2);
          flashAlpha = 0.45 * (1 - u);
        }
      }

      if (isSelected) {
        const fitsHere =
          mode === 'editor' ? footprintFits(b.tile_x, b.tile_y, b.footprint) : true;
        quad(b.tile_x, b.tile_y, b.tile_x + b.footprint, b.tile_y + b.footprint);
        ctx.fillStyle = fitsHere ? 'rgba(74, 222, 128, 0.28)' : 'rgba(239, 68, 68, 0.35)';
        ctx.strokeStyle = fitsHere ? '#4ade80' : '#f87171';
        ctx.lineWidth = 2.4;
        ctx.fill();
        ctx.stroke();
      }

      const candleStage = b.candle_stage ?? 1;
      const spriteUrl = getBuildingSpriteUrl(
        b.building_id,
        b.mode,
        destroyedCount,
        candleStage
      );
      const img = getLoadedImage(spriteUrl);
      let spriteW = b.footprint * (overlays.isometric ? ISO_TILE_W : 15.6) * 0.8;
      let spriteH = spriteW;

      if (img) {
        const size = buildingSpriteSize(img, b.footprint, overlays.isometric);
        spriteW = size.w;
        spriteH = size.h;
      }

      const bottomY = overlays.isometric
        ? cy + b.footprint * ISO_TILE_H * 0.32
        : cy + b.footprint * 15.6 * 0.34;

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(
        cx,
        bottomY - spriteH * 0.02,
        spriteW * 0.44 * bounceScale,
        spriteW * (overlays.isometric ? 0.2 : 0.26) * bounceScale,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      const drawW = spriteW * bounceScale;
      const drawH = spriteH * bounceScale;
      const drawBottomY = bottomY + bounceLiftY;

      if (img) {
        ctx.drawImage(img, cx - drawW / 2, drawBottomY - drawH, drawW, drawH);
      } else {
        ctx.fillStyle = '#334155';
        ctx.fillRect(cx - drawW / 2, drawBottomY - drawH, drawW, drawH);
      }

      if (flashAlpha > 0.01) {
        ctx.fillStyle = `rgba(254, 240, 138, ${flashAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(
          cx,
          drawBottomY - drawH * 0.48,
          drawW * 0.45,
          drawH * 0.42,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // TH18 Guardian badge
      if (b.building_id === 'TownHall') {
        const gImg = getLoadedImage(TROOP_SPRITES[b.mode]);
        if (gImg) {
          const gs = 22;
          ctx.drawImage(gImg, cx + drawW * 0.22, drawBottomY - drawH * 0.92, gs, gs);
        }
      }

      // Hot Candle flame stage badge (6 -> 4 -> 3 flames)
      if (b.building_id === 'CraftingStation') {
        const flames = candleStage === 1 ? 6 : candleStage === 2 ? 4 : 3;
        ctx.save();
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(cx - 18, drawBottomY - drawH - 15, 36, 13);
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx - 18, drawBottomY - drawH - 15, 36, 13);
        ctx.fillStyle = '#fed7aa';
        ctx.fillText(`🕯️ ${flames}🔥`, cx, drawBottomY - drawH - 5);
        ctx.restore();
      }

      // Directional Aim Indicator for Air Sweeper (105° cone) & Firespitter (150° cone)
      if (b.building_id === 'AirSweeper' || b.building_id === 'Firespitter') {
        const dirRad = ((b.direction_deg ?? 0) * Math.PI) / 180;
        const [p0x, p0y] = vs(b.center_x, b.center_y);
        const [p1x, p1y] = vs(
          b.center_x + Math.cos(dirRad) * (b.footprint * 0.68),
          b.center_y + Math.sin(dirRad) * (b.footprint * 0.68)
        );
        const screenAngle = Math.atan2(p1y - p0y, p1x - p0x);
        ctx.save();
        ctx.translate(p1x, p1y - 4);
        ctx.rotate(screenAngle);
        ctx.fillStyle = b.building_id === 'AirSweeper' ? '#38bdf8' : '#fb923c';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -4.5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Freeze / overgrowth tint
      if (b.freeze_timer > 0) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.beginPath();
        ctx.arc(cx, drawBottomY - drawH * 0.5, drawW * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.overgrowth_timer > 0) {
        ctx.fillStyle = 'rgba(21, 128, 61, 0.55)';
        ctx.beginPath();
        ctx.arc(cx, drawBottomY - drawH * 0.5, drawW * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }

      // HP bar
      if (b.hp < b.max_hp) {
        const ratio = Math.max(0, b.hp / b.max_hp);
        const bw = Math.max(26, spriteW * 0.72);
        const bh = 4.5;
        const bx = cx - bw / 2;
        const by = drawBottomY - drawH - 7;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
        ctx.fillStyle = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#f59e0b' : '#ef4444';
        ctx.fillRect(bx, by, bw * ratio, bh);
      }

      // Defense Range Circle / Directional Cone (shown when defense is clicked/selected in Editor or Battle, or when All Ranges overlay is on)
      if ((isSelected || overlays.showRanges) && spec && spec.max_range > 0) {
        const unitPx = overlays.isometric ? 11.2 : 15.6;
        const isoYScale = overlays.isometric ? 0.67 : 1;
        const effRange =
          b.building_id === 'XBow' && b.mode === 'XBowGround'
            ? 14.0
            : b.building_id === 'MultiGearTower' && b.mode === 'MultiGearFastAttack'
            ? 8.0
            : b.building_id === 'InfernoTower' && b.mode === 'InfernoSingle'
            ? 9.0
            : b.building_id === 'SpellTower' && b.mode === 'SpellTowerInvisibility'
            ? 4.5
            : spec.max_range;
        const scaleFactor = isSelected ? rangeScale : 1;
        const rPx = effRange * unitPx * scaleFactor;
        const rangeCenterY = bottomY - spriteH * 0.1;

        // Air Sweeper (105° cone, 1.0t–15.0t) & Firespitter (150° cone, 0t–16.0t)
        const coneArcDeg =
          b.building_id === 'AirSweeper'
            ? 105
            : b.building_id === 'Firespitter'
            ? 150
            : null;

        if (coneArcDeg !== null) {
          const dirDeg = b.direction_deg ?? 0;
          const isSweeper = b.building_id === 'AirSweeper';
          traceConePath(
            b.center_x,
            b.center_y,
            spec.min_range * scaleFactor,
            effRange * scaleFactor,
            dirDeg,
            coneArcDeg
          );
          if (isSelected) {
            ctx.fillStyle = isSweeper
              ? 'rgba(56, 189, 248, 0.14)'
              : 'rgba(251, 146, 60, 0.14)';
            ctx.fill();
          }
          ctx.strokeStyle = isSelected
            ? isSweeper
              ? 'rgba(56, 189, 248, 0.95)'
              : 'rgba(251, 146, 60, 0.95)'
            : 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = isSelected ? 2.4 : 1.1;
          ctx.stroke();

          // Center aim axis dashed line when selected
          if (isSelected) {
            const rad = (dirDeg * Math.PI) / 180;
            const [ax0, ay0] = vs(
              b.center_x + Math.cos(rad) * Math.max(0.8, spec.min_range * scaleFactor),
              b.center_y + Math.sin(rad) * Math.max(0.8, spec.min_range * scaleFactor)
            );
            const [ax1, ay1] = vs(
              b.center_x + Math.cos(rad) * effRange * scaleFactor,
              b.center_y + Math.sin(rad) * effRange * scaleFactor
            );
            ctx.save();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = isSweeper
              ? 'rgba(186, 230, 253, 0.85)'
              : 'rgba(254, 215, 170, 0.85)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(ax0, ay0);
            ctx.lineTo(ax1, ay1);
            ctx.stroke();
            ctx.restore();
          }
        } else {
          if (isSelected) {
            ctx.fillStyle = 'rgba(250, 204, 21, 0.09)';
            ctx.beginPath();
            ctx.ellipse(cx, rangeCenterY, rPx, rPx * isoYScale, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.strokeStyle = isSelected ? 'rgba(250, 204, 21, 0.95)' : 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = isSelected ? 2.4 : 1;
          ctx.beginPath();
          ctx.ellipse(cx, rangeCenterY, rPx, rPx * isoYScale, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Minimum range blind spot (Mortar 4t, Scattershot 3t)
          if (isSelected && spec.min_range > 0) {
            const minRPx = spec.min_range * unitPx * rangeScale;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
            ctx.strokeStyle = 'rgba(248, 113, 113, 0.88)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.ellipse(cx, rangeCenterY, minRPx, minRPx * isoYScale, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }

        // Spell Tower inner spell effect radius ring (5.0t Rage/Poison, 4.7t Earthquake)
        if (isSelected && b.building_id === 'SpellTower') {
          const spellRadius =
            b.mode === 'SpellTowerInvisibility'
              ? 4.5
              : b.mode === 'SpellTowerEarthquake'
              ? 4.7
              : 5.0;
          const spRPx = spellRadius * unitPx * rangeScale;
          const spStroke =
            b.mode === 'SpellTowerRage'
              ? 'rgba(216, 180, 254, 0.92)'
              : b.mode === 'SpellTowerPoison'
              ? 'rgba(251, 146, 60, 0.92)'
              : b.mode === 'SpellTowerEarthquake'
              ? 'rgba(217, 119, 6, 0.92)'
              : 'rgba(226, 232, 240, 0.92)';
          ctx.save();
          ctx.setLineDash([5, 4]);
          ctx.strokeStyle = spStroke;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, rangeCenterY, spRPx, spRPx * isoYScale, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Defending hero banners (editor only)
    if (mode === 'editor') {
      for (const hb of layout.defending_heroes) {
        const [hx, hy] = vs(hb.tile_x + 1, hb.tile_y + 1);
        const bImg = getLoadedImage(HERO_BANNER_SPRITES[hb.hero_id]);
        if (bImg) {
          const s = 26;
          ctx.drawImage(bImg, hx - s / 2, hy - s * 0.7, s, s);
        }
      }
    }

    // Battle visual effects & units
    if (mode === 'battle' && battleState) {
      for (const z of battleState.spells) {
        const style = SPELL_COLORS[z.spell_id] ?? {
          fill: 'rgba(56, 189, 248, 0.28)',
          stroke: 'rgba(186, 230, 253, 0.85)',
        };
        ctx.fillStyle = style.fill;
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = 2;
        traceGridCircle(z.x, z.y, z.radius);
        ctx.fill();
        ctx.stroke();
      }

      for (const ev of battleState.visual_events) {
        if ('Beam' in ev) {
          const b = ev.Beam;
          const [fx, fy] = vs(b.from_x, b.from_y);
          const [tx, ty] = vs(b.to_x, b.to_y);
          ctx.strokeStyle = b.color;
          ctx.lineWidth = b.width;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        } else if ('Projectile' in ev) {
          const p = ev.Projectile;
          const [fx, fy] = vs(p.from_x, p.from_y);
          const [tx, ty] = vs(p.to_x, p.to_y);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.lineTo(tx, ty);
          ctx.stroke();
        } else if ('Explosion' in ev) {
          const ex = ev.Explosion;
          const [cx, cy] = vs(ex.x, ex.y);
          const rPx = ex.radius * 10;
          const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rPx);
          grad.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
          grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.55)');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
          ctx.fill();
        } else if ('HealPulse' in ev) {
          const hp = ev.HealPulse;
          const [cx, cy] = vs(hp.x, hp.y);
          const rPx = hp.radius * 9;
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Live units: real full-body sprites with shadows, facing & HP bars
      const sortedUnits = [...battleState.units]
        .filter((u) => u.alive)
        .sort((a, b) => a.x + a.y - (b.x + b.y));

      for (const u of sortedUnits) {
        const [gxS, gyS] = vs(u.x, u.y);
        const isHero = isHeroKind(u.kind);
        const isSelected =
          selectedBattleEntity?.kind === 'unit' && selectedBattleEntity.id === u.id;

        const housing =
          u.kind && typeof u.kind === 'object' && u.kind.Troop
            ? catalog.troops.find((t) => t.id === (u.kind as { Troop?: string }).Troop)
                ?.housing_space ?? 5
            : 5;

        const bodyH = unitBodyHeight(u.kind, housing, overlays.isometric);
        const lift = u.is_air ? bodyH * 0.55 : 0;
        const baseY = gyS - lift;

        // Target lock vector
        const targetRef = u.target;
        if (
          (overlays.showTargetVectors || isSelected) &&
          targetRef !== 'None' &&
          typeof targetRef === 'object'
        ) {
          let targetPos: [number, number] | null = null;
          if (targetRef.Building !== undefined) {
            const tb = battleState.buildings[targetRef.Building];
            if (tb) targetPos = vs(tb.center_x, tb.center_y);
          } else if (targetRef.Wall !== undefined) {
            const tw = battleState.walls[targetRef.Wall];
            if (tw) targetPos = vs(tw.tile_x + 0.5, tw.tile_y + 0.5);
          } else if (targetRef.Unit !== undefined) {
            const targetUnitId = targetRef.Unit;
            const tu = battleState.units.find((uu) => uu.id === targetUnitId);
            if (tu) targetPos = vs(tu.x, tu.y);
          }
          if (targetPos) {
            ctx.strokeStyle = isSelected ? 'rgba(56, 189, 248, 0.95)' : 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = isSelected ? 1.6 : 0.8;
            ctx.beginPath();
            ctx.moveTo(gxS, baseY);
            ctx.lineTo(targetPos[0], targetPos[1]);
            ctx.stroke();
          }
        }

        // Ground shadow
        ctx.fillStyle = u.team === 'Defender' ? 'rgba(120, 20, 20, 0.35)' : 'rgba(0, 0, 0, 0.36)';
        ctx.beginPath();
        ctx.ellipse(gxS, gyS + 2, bodyH * 0.3, bodyH * 0.14, 0, 0, Math.PI * 2);
        ctx.fill();

        if (u.is_burrowed || u.invisibility_timer > 0) ctx.globalAlpha = 0.5;

        const bodyUrl = getUnitBodyUrl(u.kind);
        const bodyImg = getLoadedImage(bodyUrl);

        if (isHero && bodyImg) {
          // Hero medallion (square portrait art inside a gold rim)
          const r = bodyH * 0.52;
          ctx.save();
          ctx.beginPath();
          ctx.arc(gxS, baseY - r * 0.5, r, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(bodyImg, gxS - r, baseY - r * 0.5 - r, r * 2, r * 2);
          ctx.restore();
          ctx.strokeStyle =
            u.invincibility_timer > 0 ? '#fde047' : u.rage_timer > 0 ? '#e879f9' : '#f5b82e';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(gxS, baseY - r * 0.5, r, 0, Math.PI * 2);
          ctx.stroke();
        } else if (bodyImg) {
          const aspect = bodyImg.naturalWidth / Math.max(1, bodyImg.naturalHeight);
          const w = Math.min(bodyH * 1.8, bodyH * aspect);
          const h = bodyH;
          if (u.team === 'Defender') {
            ctx.save();
            // Defending units get a subtle red base ring so they read as enemies
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.ellipse(gxS, gyS + 2, h * 0.28, h * 0.13, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.drawImage(bodyImg, gxS - w / 2, baseY - h, w, h);
            ctx.restore();
          } else {
            ctx.drawImage(bodyImg, gxS - w / 2, baseY - h, w, h);
          }

          if (u.rage_timer > 0) {
            ctx.strokeStyle = 'rgba(232, 121, 249, 0.85)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(gxS, baseY - h * 0.45, w * 0.6, h * 0.55, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (u.invincibility_timer > 0) {
            ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.ellipse(gxS, baseY - h * 0.45, w * 0.62, h * 0.58, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = u.is_air ? '#38bdf8' : '#4ade80';
          ctx.beginPath();
          ctx.arc(gxS, baseY - bodyH * 0.4, bodyH * 0.28, 0, Math.PI * 2);
          ctx.fill();
        }

        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(gxS, gyS + 2, bodyH * 0.34, bodyH * 0.17, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.globalAlpha = 1;

        // HP bar
        if (u.hp < u.max_hp || isHero) {
          const ratio = Math.max(0, u.hp / u.max_hp);
          const bw = isHero ? 26 : 18;
          const bh = isHero ? 4 : 3;
          const by = baseY - bodyH - 5;
          ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
          ctx.fillRect(gxS - bw / 2 - 1, by - 1, bw + 2, bh + 2);
          ctx.fillStyle =
            u.team === 'Defender'
              ? '#ef4444'
              : isHero
              ? '#facc15'
              : ratio > 0.5
              ? '#22c55e'
              : '#ef4444';
          ctx.fillRect(gxS - bw / 2, by, bw * ratio, bh);
        }
      }

      // In-flight Projectiles (with travel speed, parabolic arc height & ground AoE indicator)
      for (const p of battleState.projectiles ?? []) {
        const [px, py] = vs(p.x, p.y);
        const [fx, fy] = vs(p.from_x, p.from_y);
        const [tx, ty] = vs(p.target_x, p.target_y);
        const t = Math.max(0, Math.min(1, p.progress));
        const zLift =
          4 * t * (1 - t) * p.arc_height * (overlays.isometric ? 14 : 16);

        // Ballistic AoE ground target ring (Mortar, Scattershot, Bomb Tower, Flame Flinger, Spell Vial)
        if (!p.homing && p.splash_radius > 0) {
          const rPx = p.splash_radius * (overlays.isometric ? 11.2 : 15.6);
          ctx.save();
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = 0.42;
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.ellipse(
            tx,
            ty,
            rPx,
            overlays.isometric ? rPx * 0.67 : rPx,
            0,
            0,
            Math.PI * 2
          );
          ctx.stroke();
          ctx.restore();
        }

        // Ground shadow under projectile
        ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.beginPath();
        ctx.ellipse(px, py + 2, 4.2, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();

        const drawY = py - zLift;
        const angle = Math.atan2(ty - fy, tx - fx);

        ctx.save();
        ctx.translate(px, drawY);
        ctx.rotate(angle);

        if (p.kind === 'Spear' || p.kind === 'Arrow') {
          const len = p.kind === 'Spear' ? 14 : 10;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.kind === 'Spear' ? 2.4 : 1.8;
          ctx.beginPath();
          ctx.moveTo(-len * 0.6, 0);
          ctx.lineTo(len * 0.5, 0);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(len * 0.6, 0);
          ctx.lineTo(len * 0.2, -2.5);
          ctx.lineTo(len * 0.2, 2.5);
          ctx.closePath();
          ctx.fill();
        } else if (
          p.kind === 'MortarShell' ||
          p.kind === 'Boulder' ||
          p.kind === 'ScatterBundle' ||
          p.kind === 'Cannonball'
        ) {
          const rad =
            p.kind === 'MortarShell' || p.kind === 'Boulder'
              ? 5.2
              : p.kind === 'ScatterBundle'
              ? 4.6
              : 3.6;
          // Smoke/ember trail
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = rad * 1.1;
          ctx.beginPath();
          ctx.moveTo(-rad * 2.2, 0);
          ctx.lineTo(0, 0);
          ctx.stroke();
          ctx.globalAlpha = 1;

          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.arc(0, 0, rad, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.8;
          ctx.stroke();
        } else if (p.kind === 'Log') {
          ctx.fillStyle = '#78350f';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.6;
          ctx.fillRect(-5, -9, 10, 18);
          ctx.strokeRect(-5, -9, 10, 18);
        } else if (p.kind === 'SpellVial') {
          ctx.fillStyle = p.color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          // CandleFlame, WizardFireball, FlameSpirit, Rocket, EnergyBolt
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, 5.5, 3.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(1.2, 0, 2.1, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    // Editor ghost preview (green = fits, red = insufficient space)
    if (mode === 'editor' && hoverTile && ghostFootprint) {
      const size = ghostFootprint;
      let gx = hoverTile.x;
      let gy = hoverTile.y;
      if (selectedEditorTool.type === 'place_building' || selectedEditorTool.type === 'place_trap') {
        gx = Math.max(3, Math.min(47 - size, gx));
        gy = Math.max(3, Math.min(47 - size, gy));
      }
      const ok = footprintFits(gx, gy, size);
      quad(gx, gy, gx + size, gy + size);
      ctx.fillStyle = ok ? 'rgba(74, 222, 128, 0.26)' : 'rgba(239, 68, 68, 0.32)';
      ctx.strokeStyle = ok ? 'rgba(74, 222, 128, 0.95)' : 'rgba(248, 113, 113, 0.95)';
      ctx.lineWidth = 2.2;
      ctx.fill();
      ctx.stroke();
    }

    // Hover cursor / Deployment preview
    if (hoverTile && !ghostFootprint) {
      if (mode === 'battle' && deploySlot) {
        if (deploySlot.kind === 'spell') {
          // Circular spell aura preview
          const spellSpec = catalog.spells.find((s) => s.id === deploySlot.spellId);
          const spColor = SPELL_COLORS[deploySlot.spellId] ?? {
            fill: 'rgba(56, 189, 248, 0.35)',
            stroke: 'rgba(186, 230, 253, 0.95)',
          };
          const r = spellSpec?.radius ?? 5.0;
          traceGridCircle(hoverTile.exactX, hoverTile.exactY, r);
          ctx.fillStyle = spColor.fill;
          ctx.fill();
          ctx.strokeStyle = spColor.stroke;
          ctx.lineWidth = 2.5;
          ctx.stroke();

          // Center aim reticle
          const [cx, cy] = vs(hoverTile.exactX, hoverTile.exactY);
          ctx.strokeStyle = spColor.stroke;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.stroke();
        } else if (
          deploySlot.kind === 'troop' ||
          deploySlot.kind === 'hero' ||
          deploySlot.kind === 'siege'
        ) {
          const isRedZone = activeMask[hoverTile.y]?.[hoverTile.x];
          quad(hoverTile.x, hoverTile.y, hoverTile.x + 1, hoverTile.y + 1);
          if (isRedZone) {
            ctx.fillStyle = 'rgba(239, 68, 68, 0.38)';
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
            ctx.lineWidth = 2.2;
            ctx.fill();
            ctx.stroke();

            // Draw forbidden X in red zone
            const [cx, cy] = vs(hoverTile.x + 0.5, hoverTile.y + 0.5);
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(cx - 5, cy - 5);
            ctx.lineTo(cx + 5, cy + 5);
            ctx.moveTo(cx + 5, cy - 5);
            ctx.lineTo(cx - 5, cy + 5);
            ctx.stroke();
          } else {
            ctx.fillStyle = 'rgba(74, 222, 128, 0.38)';
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.95)';
            ctx.lineWidth = 2.4;
            ctx.fill();
            ctx.stroke();

            // Draw target deployment reticle
            const [cx, cy] = vs(hoverTile.x + 0.5, hoverTile.y + 0.5);
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else {
          quad(hoverTile.x, hoverTile.y, hoverTile.x + 1, hoverTile.y + 1);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }
      } else {
        quad(hoverTile.x, hoverTile.y, hoverTile.x + 1, hoverTile.y + 1);
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }
  }, [
    mode,
    layout,
    noDeployMask,
    battleState,
    overlays,
    selectedEditorTool,
    selectedBuildingInstanceId,
    selectedBattleEntity,
    deploySlot,
    hoverTile,
    buildingSpecMap,
    trapSpecMap,
    catalog.troops,
    zoom,
    pan,
    fit,
    viewport,
    spriteLoadTick,
    ghostFootprint,
    footprintFits,
    gridToScreen,
    draggingBuilding,
    animFrameTick,
  ]);

  const getPointerCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const [vx, vy] = screenToVirtual(e.clientX - rect.left, e.clientY - rect.top);
    const [gx, gy] = virtualToGrid(vx, vy);
    const tx = Math.max(0, Math.min(49, Math.floor(gx)));
    const ty = Math.max(0, Math.min(49, Math.floor(gy)));
    const exactX = Math.max(0.5, Math.min(49.5, gx));
    const exactY = Math.max(0.5, Math.min(49.5, gy));
    return { tx, ty, exactX, exactY };
  };

  return (
    <div className="canvas-stage-wrapper" ref={wrapperRef}>
      <canvas
        ref={canvasRef}
        className="battlefield-canvas"
        style={{
          width: '100%',
          height: '100%',
          cursor:
            draggingBuilding || isPanning
              ? 'grabbing'
              : mode === 'editor' && selectedEditorTool.type === 'select'
              ? 'grab'
              : 'pointer',
        }}
        onContextMenu={(e) => e.preventDefault()}
        onWheel={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
          const nextZoom = Math.max(0.55, Math.min(3.5, Number((zoom * factor).toFixed(2))));
          if (nextZoom !== zoom) {
            const ratio = nextZoom / zoom;
            const nextPanX = (mx - viewport.w / 2) * (1 - ratio) + pan.x * ratio;
            const nextPanY = (my - viewport.h / 2) * (1 - ratio) + pan.y * ratio;
            setZoom(nextZoom);
            setPan({
              x: Math.max(-viewport.w * nextZoom, Math.min(viewport.w * nextZoom, nextPanX)),
              y: Math.max(-viewport.h * nextZoom, Math.min(viewport.h * nextZoom, nextPanY)),
            });
          }
        }}
        onMouseDown={(e) => {
          const { tx, ty, exactX, exactY } = getPointerCoords(e);
          setHoverTile({ x: tx, y: ty, exactX, exactY });

          // Wall brush / eraser in Editor drags continuously across tiles
          if (
            mode === 'editor' &&
            e.button === 0 &&
            (selectedEditorTool.type === 'wall_brush' ||
              selectedEditorTool.type === 'wall_eraser')
          ) {
            setIsDragging(true);
            onTileAction(tx, ty, exactX, exactY, false);
            return;
          }

          // In Village Editor Select mode: pressing on a building selects it and allows dragging it directly
          if (mode === 'editor' && e.button === 0 && selectedEditorTool.type === 'select') {
            const hitB = layout.buildings.find((b) => {
              const s = buildingSpecMap.get(b.building_id)?.footprint ?? 3;
              return tx >= b.tile_x && tx < b.tile_x + s && ty >= b.tile_y && ty < b.tile_y + s;
            });
            if (hitB) {
              onSelectBuildingInstance(hitB.instance_id);
              buildingDragRef.current = {
                instanceId: hitB.instance_id,
                startX: e.clientX,
                startY: e.clientY,
                offsetX: exactX - hitB.tile_x,
                offsetY: exactY - hitB.tile_y,
                hasMoved: false,
              };
              return;
            }
          }

          // Default in both Battle Arena and Village Editor:
          // Left-clicking and dragging navigates (pans) the camera window just like in Clash of Clans;
          // releasing without dragging performs a click action on the tile!
          panStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            panX: pan.x,
            panY: pan.y,
            hasPanned: false,
            active: true,
          };
        }}
        onMouseMove={(e) => {
          const { tx, ty, exactX, exactY } = getPointerCoords(e);
          setHoverTile({ x: tx, y: ty, exactX, exactY });

          // 1. Direct building drag in Village Editor
          if (buildingDragRef.current) {
            const bd = buildingDragRef.current;
            const distPx = Math.hypot(e.clientX - bd.startX, e.clientY - bd.startY);
            if (distPx > 5 || bd.hasMoved) {
              bd.hasMoved = true;
              const targetB = layout.buildings.find((b) => b.instance_id === bd.instanceId);
              const size = targetB
                ? buildingSpecMap.get(targetB.building_id)?.footprint ?? 3
                : 3;
              const candX = Math.max(3, Math.min(47 - size, Math.round(exactX - bd.offsetX)));
              const candY = Math.max(3, Math.min(47 - size, Math.round(exactY - bd.offsetY)));
              setDraggingBuilding({
                instanceId: bd.instanceId,
                tileX: candX,
                tileY: candY,
              });
            }
            return;
          }

          // 2. Camera pan by clicking and dragging
          if (panStartRef.current.active) {
            const dx = e.clientX - panStartRef.current.x;
            const dy = e.clientY - panStartRef.current.y;
            if (Math.hypot(dx, dy) > 6 || panStartRef.current.hasPanned) {
              panStartRef.current.hasPanned = true;
              setIsPanning(true);
              const maxPanX = viewport.w * Math.max(0.8, zoom);
              const maxPanY = viewport.h * Math.max(0.8, zoom);
              setPan({
                x: Math.max(-maxPanX, Math.min(maxPanX, panStartRef.current.panX + dx)),
                y: Math.max(-maxPanY, Math.min(maxPanY, panStartRef.current.panY + dy)),
              });
            }
            return;
          }

          // 3. Wall brush / eraser continuous drag
          if (isDragging) {
            onTileAction(tx, ty, exactX, exactY, true);
          }
        }}
        onMouseUp={(e) => {
          const { tx, ty, exactX, exactY } = getPointerCoords(e);

          if (buildingDragRef.current) {
            const bd = buildingDragRef.current;
            buildingDragRef.current = null;
            if (bd.hasMoved && draggingBuilding && onMoveBuilding) {
              onMoveBuilding(bd.instanceId, draggingBuilding.tileX, draggingBuilding.tileY);
            }
            setDraggingBuilding(null);
            return;
          }

          if (panStartRef.current.active) {
            const wasPan = panStartRef.current.hasPanned;
            panStartRef.current.active = false;
            panStartRef.current.hasPanned = false;
            setIsPanning(false);
            if (!wasPan && e.button === 0) {
              onTileAction(tx, ty, exactX, exactY, false);
            }
            return;
          }

          setIsDragging(false);
        }}
        onMouseLeave={() => {
          setIsDragging(false);
          setIsPanning(false);
          panStartRef.current.active = false;
          panStartRef.current.hasPanned = false;
          buildingDragRef.current = null;
          setDraggingBuilding(null);
          setHoverTile(null);
        }}
      />

      {/* Combat FX overlay: 60 fps particles, trails, spell ambience, flashes */}
      <canvas
        ref={fxCanvasRef}
        className="fx-overlay-canvas"
        aria-hidden="true"
      />

      <div className="canvas-camera-bar">
        {hoverTile && (
          <span className="coord-readout">
            Tile ({hoverTile.x}, {hoverTile.y})
          </span>
        )}
        {onToggleOverlay && (
          <button
            className={`cam-btn ${overlays.fxHigh ? 'active' : ''}`}
            onClick={() => onToggleOverlay('fxHigh')}
            title="FX Quality: High spawns particles, Low keeps only cheap effects"
          >
            {overlays.fxHigh ? '✨ FX High' : '✨ FX Low'}
          </button>
        )}
        <button
          className="cam-btn"
          onClick={() => setZoom((z) => Math.min(3.5, Number((z + 0.15).toFixed(2))))}
          title="Zoom In"
        >
          ＋
        </button>
        <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
        <button
          className="cam-btn"
          onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
          title="Zoom Out"
        >
          −
        </button>
        <button
          className="cam-btn"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          title="Reset camera (right-click drag to pan)"
        >
          ⟲ Center
        </button>
        {onToggleOverlay && (
          <button
            className={`cam-btn ${overlays.isometric ? 'active' : ''}`}
            onClick={() => onToggleOverlay('isometric')}
          >
            {overlays.isometric ? '💎 2.5D' : '🗺️ 2D'}
          </button>
        )}
      </div>
    </div>
  );
};
