import React, { useEffect, useMemo, useRef, useState } from 'react';
import initWasm, {
  WasmBattleSession,
  wasm_compute_no_deploy_json,
  wasm_get_catalog_json,
  wasm_validate_layout_json,
} from './wasm-pkg/coc_wasm';
import {
  ArmyLoadout,
  BattleEngineState,
  BuildingSpec,
  FullCatalog,
  VillageLayout,
} from './types';
import {
  BUILDING_SPRITES,
  EQUIPMENT_SPRITES,
  HERO_SPRITES,
  PET_SPRITES,
  SPELL_SPRITES,
  TRAP_SPRITES,
  TROOP_SPRITES,
  UI_SPRITES,
} from './assetsManifest';
import { BattlefieldCanvas, OverlayOptions } from './canvas/BattlefieldCanvas';
import { ArmyRecipeBuilder } from './components/ArmyRecipeBuilder';

type ActiveTab = 'battle' | 'editor' | 'armory';

type SelectedDeploySlot =
  | { kind: 'inspect' }
  | { kind: 'troop'; troopId: string }
  | { kind: 'hero'; heroId: string }
  | { kind: 'siege' }
  | { kind: 'spell'; spellId: string };

let wasmInitPromise: Promise<unknown> | null = null;
function ensureWasmInitialized() {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm();
  }
  return wasmInitPromise;
}

function getDefaultDeploySlot(army: ArmyLoadout): SelectedDeploySlot {
  const firstTroop = army.troops.find(([_, count]) => count > 0);
  if (firstTroop) return { kind: 'troop', troopId: firstTroop[0] };
  if (army.heroes.length > 0) return { kind: 'hero', heroId: army.heroes[0][0] };
  if (army.siege_machine) return { kind: 'siege' };
  const firstSpell = army.spells.find(([_, count]) => count > 0);
  if (firstSpell) return { kind: 'spell', spellId: firstSpell[0] };
  return { kind: 'inspect' };
}

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<FullCatalog | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('battle');
  const [layout, setLayout] = useState<VillageLayout | null>(null);
  const [army, setArmy] = useState<ArmyLoadout | null>(null);
  const [noDeployMask, setNoDeployMask] = useState<boolean[][]>([]);
  const [showTacticalDrawer, setShowTacticalDrawer] = useState<boolean>(false);

  // Editor state
  const [editorTool, setEditorTool] = useState<
    | { type: 'select' }
    | { type: 'wall_brush' }
    | { type: 'wall_eraser' }
    | { type: 'place_building'; buildingId: string }
    | { type: 'place_trap'; trapId: string }
  >({ type: 'select' });
  const [selectedBuildingInstanceId, setSelectedBuildingInstanceId] = useState<number | null>(
    null
  );
  const [selectionClickSeq, setSelectionClickSeq] = useState<number>(0);

  // Battle state
  const sessionRef = useRef<WasmBattleSession | null>(null);
  const [battleState, setBattleState] = useState<BattleEngineState | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [aiMode, setAiMode] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [deploySlot, setDeploySlot] = useState<SelectedDeploySlot>({
    kind: 'troop',
    troopId: 'Thrower',
  });
  const [selectedBattleEntity, setSelectedBattleEntity] = useState<{
    kind: 'building' | 'unit';
    id: number;
  } | null>(null);

  // Default to authentic 2.5D Isometric Village projection!
  const [overlays, setOverlays] = useState<OverlayOptions>({
    isometric: true,
    showRedZone: true,
    showRanges: false,
    showDpsHeatmap: false,
    showTargetVectors: false,
    showTraps: true,
    fxHigh: true,
  });

  const disposeSession = () => {
    const prev = sessionRef.current;
    sessionRef.current = null;
    if (prev) {
      try {
        prev.free();
      } catch (err) {
        console.warn('Ignored error while freeing previous battle session:', err);
      }
    }
  };

  // Initialize WASM & load catalog + default presets
  useEffect(() => {
    let cancelled = false;
    ensureWasmInitialized().then(() => {
      if (cancelled) return;
      const cat: FullCatalog = JSON.parse(wasm_get_catalog_json());
      setCatalog(cat);
      const initialLayout = cat.preset_layouts[0];
      const initialArmy = cat.preset_armies[0];
      setLayout(initialLayout);
      setArmy(initialArmy);
      setDeploySlot(getDefaultDeploySlot(initialArmy));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Recompute no-deploy mask and reset battle session when layout or army changes
  useEffect(() => {
    if (!layout || !army) return;
    const layoutJson = JSON.stringify(layout);
    const armyJson = JSON.stringify(army);
    const mask: boolean[][] = JSON.parse(wasm_compute_no_deploy_json(layoutJson));
    setNoDeployMask(mask);

    try {
      disposeSession();
      const sess = new WasmBattleSession(layoutJson, armyJson);
      sessionRef.current = sess;
      setBattleState(JSON.parse(sess.get_state_json()));
      setIsPlaying(false);
      setAiMode(false);
      setDeploySlot((prev) => {
        if (
          prev.kind === 'troop' &&
          army.troops.some(([tid, c]) => tid === prev.troopId && c > 0)
        ) {
          return prev;
        }
        return getDefaultDeploySlot(army);
      });
    } catch (err) {
      console.error('Failed to initialize battle session:', err);
    }
  }, [layout, army]);

  // Real-time simulation loop
  useEffect(() => {
    if (!isPlaying || activeTab !== 'battle') return;
    const intervalMs = Math.max(16, Math.floor(100 / simSpeed));
    const timer = window.setInterval(() => {
      const sess = sessionRef.current;
      if (!sess) return;

      const nextJson = aiMode
        ? sess.run_heuristic_ai_step()
        : sess.step_ticks(simSpeed >= 4 ? 2 : 1);
      const nextState: BattleEngineState = JSON.parse(nextJson);
      setBattleState(nextState);
      if (nextState.is_finished) {
        setIsPlaying(false);
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlaying, aiMode, simSpeed, activeTab]);

  const layoutValidation = useMemo(() => {
    if (!layout) return null;
    return JSON.parse(wasm_validate_layout_json(JSON.stringify(layout))) as {
      is_valid: boolean;
      errors: string[];
      total_buildings: number;
      total_walls: number;
      total_traps: number;
    };
  }, [layout]);

  const resetBattle = () => {
    if (!layout || !army) return;
    disposeSession();
    const sess = new WasmBattleSession(JSON.stringify(layout), JSON.stringify(army));
    sessionRef.current = sess;
    setBattleState(JSON.parse(sess.get_state_json()));
    setIsPlaying(false);
    setAiMode(false);
    setDeploySlot(getDefaultDeploySlot(army));
  };

  const stepSingleTick = () => {
    const sess = sessionRef.current;
    if (!sess) return;
    const nextJson = aiMode ? sess.run_heuristic_ai_step() : sess.step_ticks(1);
    setBattleState(JSON.parse(nextJson));
  };

  // ---------------------------------------------------------------------
  // Placement validation (mirrors the Rust validator so the UI never
  // accepts a footprint that does not fit, e.g. 3x3 in a 2x2 gap).
  // ---------------------------------------------------------------------
  const buildOccupancy = (ignoreInstanceId?: number | null): boolean[][] => {
    const grid: boolean[][] = Array.from({ length: 50 }, () => Array(50).fill(false));
    if (!layout || !catalog) return grid;
    for (const b of layout.buildings) {
      if (ignoreInstanceId != null && b.instance_id === ignoreInstanceId) continue;
      const size = catalog.buildings.find((s) => s.id === b.building_id)?.footprint ?? 3;
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
      const size = catalog.traps.find((s) => s.id === t.trap_id)?.footprint ?? 1;
      for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
          const x = t.tile_x + dx;
          const y = t.tile_y + dy;
          if (x < 50 && y < 50) grid[y][x] = true;
        }
      }
    }
    return grid;
  };

  const footprintFits = (
    grid: boolean[][],
    tileX: number,
    tileY: number,
    size: number
  ): boolean => {
    if (tileX < 3 || tileY < 3 || tileX + size > 47 || tileY + size > 47) return false;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        if (grid[tileY + dy][tileX + dx]) return false;
      }
    }
    return true;
  };

  /** Finds the closest tile in the footprint to `(tileX, tileY)` that actually fits. */
  const findNearestFreeSpot = (
    grid: boolean[][],
    size: number,
    tileX: number,
    tileY: number,
    maxRadius = 4
  ): [number, number] | null => {
    const cx = Math.max(3, Math.min(47 - size, tileX));
    const cy = Math.max(3, Math.min(47 - size, tileY));
    if (footprintFits(grid, cx, cy, size)) return [cx, cy];
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (footprintFits(grid, nx, ny, size)) return [nx, ny];
        }
      }
    }
    return null;
  };

  const togglePauseBattle = () => {
    if (!battleState || battleState.tick === 0 || battleState.is_finished) return;
    setIsPlaying((prev) => !prev);
  };

  const handleMoveBuilding = (instanceId: number, tileX: number, tileY: number): boolean => {
    if (!catalog || !layout) return false;
    const targetB = layout.buildings.find((b) => b.instance_id === instanceId);
    if (!targetB) return false;
    const spec = catalog.buildings.find((b) => b.id === targetB.building_id);
    const size = spec?.footprint ?? 3;
    const grid = buildOccupancy(instanceId);
    const spot = findNearestFreeSpot(grid, size, tileX, tileY);
    if (!spot) return false;
    const [nx, ny] = spot;
    if (nx === targetB.tile_x && ny === targetB.tile_y) return false;
    setLayout({
      ...layout,
      buildings: layout.buildings.map((b) =>
        b.instance_id === instanceId ? { ...b, tile_x: nx, tile_y: ny } : b
      ),
    });
    return true;
  };

  const handleTileAction = (
    tileX: number,
    tileY: number,
    exactX: number,
    exactY: number,
    isDrag: boolean
  ) => {
    if (!catalog || !layout) return;

    if (activeTab === 'editor') {
      if (editorTool.type === 'wall_brush') {
        if (tileX < 3 || tileX >= 47 || tileY < 3 || tileY >= 47) return;
        if (layout.walls.length >= 325) return;
        const exists = layout.walls.some(([wx, wy]) => wx === tileX && wy === tileY);
        const overlapsBuilding = layout.buildings.some((b) => {
          const s = catalog.buildings.find((sp) => sp.id === b.building_id)?.footprint ?? 3;
          return (
            tileX >= b.tile_x &&
            tileX < b.tile_x + s &&
            tileY >= b.tile_y &&
            tileY < b.tile_y + s
          );
        });
        if (!exists && !overlapsBuilding) {
          setLayout({
            ...layout,
            walls: [...layout.walls, [tileX, tileY]],
          });
        }
        return;
      }

      if (editorTool.type === 'wall_eraser') {
        setLayout({
          ...layout,
          walls: layout.walls.filter(([wx, wy]) => !(wx === tileX && wy === tileY)),
        });
        return;
      }

      if (editorTool.type === 'place_building' && !isDrag) {
        const spec = catalog.buildings.find((b) => b.id === editorTool.buildingId);
        if (!spec) return;
        const currentCount = layout.buildings.filter((b) => b.building_id === spec.id).length;
        if (currentCount >= spec.max_count) return;
        const grid = buildOccupancy(null);
        const spot = findNearestFreeSpot(grid, spec.footprint, tileX, tileY);
        if (!spot) return;
        const [clampedX, clampedY] = spot;
        if (!footprintFits(grid, clampedX, clampedY, spec.footprint)) return;
        const nextId =
          layout.buildings.reduce((m, b) => Math.max(m, b.instance_id), 0) + 1;
        setLayout({
          ...layout,
          buildings: [
            ...layout.buildings,
            {
              instance_id: nextId,
              building_id: spec.id,
              tile_x: clampedX,
              tile_y: clampedY,
              mode: spec.default_mode,
              direction_deg: 0,
            },
          ],
        });
        setSelectedBuildingInstanceId(nextId);
        setSelectionClickSeq((s) => s + 1);
        return;
      }

      if (editorTool.type === 'place_trap' && !isDrag) {
        const spec = catalog.traps.find((t) => t.id === editorTool.trapId);
        if (!spec) return;
        const currentCount = layout.traps.filter((t) => t.trap_id === spec.id).length;
        if (currentCount >= spec.max_count) return;
        const grid = buildOccupancy(null);
        const spot = findNearestFreeSpot(grid, spec.footprint, tileX, tileY);
        if (!spot) return;
        const [clampedX, clampedY] = spot;
        const nextId = layout.traps.reduce((m, t) => Math.max(m, t.instance_id), 0) + 1;
        setLayout({
          ...layout,
          traps: [
            ...layout.traps,
            {
              instance_id: nextId,
              trap_id: spec.id,
              tile_x: clampedX,
              tile_y: clampedY,
              mode: spec.default_mode,
            },
          ],
        });
        return;
      }

      if (editorTool.type === 'select' && !isDrag) {
        // 1. Check if the user clicked on a building to select it & show its range
        const hitBuilding = layout.buildings.find((b) => {
          const s = catalog.buildings.find((sp) => sp.id === b.building_id)?.footprint ?? 3;
          return (
            tileX >= b.tile_x &&
            tileX < b.tile_x + s &&
            tileY >= b.tile_y &&
            tileY < b.tile_y + s
          );
        });
        if (hitBuilding) {
          setSelectedBuildingInstanceId(hitBuilding.instance_id);
          setSelectionClickSeq((s) => s + 1);
          return;
        }

        // 2. Otherwise, if a building is currently selected and the user clicked a free tile, move it there
        if (selectedBuildingInstanceId !== null) {
          const targetB = layout.buildings.find(
            (b) => b.instance_id === selectedBuildingInstanceId
          );
          const size = targetB
            ? catalog.buildings.find((b) => b.id === targetB.building_id)?.footprint ?? 3
            : 3;
          const anchorX = Math.round(exactX - size / 2);
          const anchorY = Math.round(exactY - size / 2);
          handleMoveBuilding(selectedBuildingInstanceId, anchorX, anchorY);
          setSelectionClickSeq((s) => s + 1);
        }
      }
      return;
    }

    // BATTLE MODE
    if (activeTab === 'battle' && sessionRef.current && battleState) {
      // Check if the user clicked directly on a standing building/defense
      const hitBuilding = !isDrag
        ? battleState.buildings.find(
            (b) =>
              !b.destroyed &&
              !(b.building_id === 'HiddenTesla' && !b.is_hidden_tesla_revealed) &&
              tileX >= b.tile_x &&
              tileX < b.tile_x + b.footprint &&
              tileY >= b.tile_y &&
              tileY < b.tile_y + b.footprint
          )
        : undefined;

      if (deploySlot.kind === 'inspect') {
        const hitUnit = battleState.units.find(
          (u) => u.alive && Math.hypot(u.x - exactX, u.y - exactY) <= 1.8
        );
        if (hitUnit) {
          setSelectedBattleEntity({ kind: 'unit', id: hitUnit.id });
          setShowTacticalDrawer(true);
          return;
        }
        if (hitBuilding) {
          setSelectedBattleEntity({ kind: 'building', id: hitBuilding.instance_id });
          setSelectionClickSeq((s) => s + 1);
        }
        return;
      }

      // Clicking a building/defense in Battle Arena when not casting a spell selects it to display its range & click animation
      if (hitBuilding && deploySlot.kind !== 'spell') {
        setSelectedBattleEntity({ kind: 'building', id: hitBuilding.instance_id });
        setSelectionClickSeq((s) => s + 1);
        return;
      }

      const mask = battleState.no_deploy_mask ?? noDeployMask;
      const isRedZone = Boolean(mask[tileY]?.[tileX]);

      let actionObj: unknown = null;
      if (deploySlot.kind === 'troop' || deploySlot.kind === 'hero' || deploySlot.kind === 'siege') {
        if (isRedZone) {
          return;
        }
        const sx = Math.max(tileX + 0.05, Math.min(tileX + 0.95, exactX));
        const sy = Math.max(tileY + 0.05, Math.min(tileY + 0.95, exactY));
        if (deploySlot.kind === 'troop') {
          actionObj = { DeployTroop: { troop_id: deploySlot.troopId, x: sx, y: sy } };
        } else if (deploySlot.kind === 'hero' && !isDrag) {
          actionObj = { DeployHero: { hero_id: deploySlot.heroId, x: sx, y: sy } };
        } else if (deploySlot.kind === 'siege' && !isDrag) {
          actionObj = { DeploySiege: { x: sx, y: sy } };
        }
      } else if (deploySlot.kind === 'spell' && !isDrag) {
        actionObj = {
          CastSpell: {
            spell_id: deploySlot.spellId,
            x: exactX,
            y: exactY,
          },
        };
      }

      if (actionObj) {
        const applied = sessionRef.current.apply_action_json(JSON.stringify(actionObj));
        if (applied) {
          const nextJson =
            !isPlaying && battleState.tick === 0
              ? sessionRef.current.step_ticks(1)
              : sessionRef.current.get_state_json();
          const nextState: BattleEngineState = JSON.parse(nextJson);
          setBattleState(nextState);
          if (!isPlaying) {
            setIsPlaying(true);
          }
          // Auto-advance slot if the current slot is depleted
          if (deploySlot.kind === 'troop') {
            const rem = nextState.remaining_troops.find(([t]) => t === deploySlot.troopId)?.[1] ?? 0;
            if (rem === 0) {
              const nextTroop = nextState.remaining_troops.find(([_, c]) => c > 0);
              if (nextTroop) {
                setDeploySlot({ kind: 'troop', troopId: nextTroop[0] });
              }
            }
          } else if (deploySlot.kind === 'hero') {
            const nextHero = nextState.remaining_heroes.find(
              ([h]) => !nextState.deployed_heroes.some(([dh]) => dh === h)
            );
            if (nextHero) {
              setDeploySlot({ kind: 'hero', heroId: nextHero[0] });
            } else {
              const nextTroop = nextState.remaining_troops.find(([_, c]) => c > 0);
              if (nextTroop) setDeploySlot({ kind: 'troop', troopId: nextTroop[0] });
            }
          } else if (deploySlot.kind === 'siege') {
            const nextTroop = nextState.remaining_troops.find(([_, c]) => c > 0);
            if (nextTroop) setDeploySlot({ kind: 'troop', troopId: nextTroop[0] });
          } else if (deploySlot.kind === 'spell') {
            const rem = nextState.remaining_spells.find(([s]) => s === deploySlot.spellId)?.[1] ?? 0;
            if (rem === 0) {
              const nextSpell = nextState.remaining_spells.find(([_, c]) => c > 0);
              if (nextSpell) {
                setDeploySlot({ kind: 'spell', spellId: nextSpell[0] });
              }
            }
          }
        }
      }
    }
  };

  if (!catalog || !layout || !army) {
    return (
      <div className="loading-screen">
        <div className="loading-card">
          <img src={BUILDING_SPRITES.TownHall} alt="TH18" className="loading-th-img" />
          <h1>CLASH OF CLANS • TOWN HALL 18</h1>
          <p>Loading WebAssembly Combat Core & Real TH18 Sprites...</p>
        </div>
      </div>
    );
  }

  const selectedPlacedBuilding = layout.buildings.find(
    (b) => b.instance_id === selectedBuildingInstanceId
  );
  const selectedBuildingSpec: BuildingSpec | undefined = selectedPlacedBuilding
    ? catalog.buildings.find((s) => s.id === selectedPlacedBuilding.building_id)
    : undefined;

  const totalArmyHousing = army.troops.reduce((acc, [tid, count]) => {
    const sp = catalog.troops.find((t) => t.id === tid);
    return acc + (sp?.housing_space ?? 1) * count;
  }, 0);

  const timeRemainingSec = battleState
    ? Math.max(0, Math.floor(180 - battleState.time_elapsed_sec))
    : 180;
  const mins = Math.floor(timeRemainingSec / 60);
  const secs = timeRemainingSec % 60;

  return (
    <div className="app-shell">
      {/* TOP CLASH COMMAND HEADER */}
      <header className="top-bar">
        <div className="brand-block">
          <img src={BUILDING_SPRITES.TownHall} alt="TH18" className="th-header-icon" />
          <div>
            <h1 className="brand-title">CLASH OF CLANS • TH18 SANDBOX</h1>
            <p className="brand-subtitle">
              2026 Town Hall 18 Simulator • Dragon Duke • All 42 Hero Equipment
            </p>
          </div>
        </div>

        <nav className="mode-tabs">
          <button
            className={`tab-btn ${activeTab === 'battle' ? 'active' : ''}`}
            onClick={() => setActiveTab('battle')}
          >
            <img src={UI_SPRITES.sword} alt="" className="tab-icon" />
            Battle Arena
          </button>
          <button
            className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => {
              setIsPlaying(false);
              setActiveTab('editor');
            }}
          >
            <img src={UI_SPRITES.shield} alt="" className="tab-icon" />
            Village Editor (44×44)
          </button>
          <button
            className={`tab-btn ${activeTab === 'armory' ? 'active' : ''}`}
            onClick={() => {
              setIsPlaying(false);
              setActiveTab('armory');
            }}
          >
            <img src={UI_SPRITES.elixir} alt="" className="tab-icon" />
            Army Recipe ({totalArmyHousing}/352)
          </button>
        </nav>

        <div className="header-right-controls">
          <span className="badge-gold">⚔️ {army.name}</span>

          {activeTab !== 'armory' && (
            <button
              className={`clash-btn ${showTacticalDrawer ? 'gold' : ''}`}
              onClick={() => setShowTacticalDrawer(!showTacticalDrawer)}
            >
              ⚙️ Overlays & Telemetry
            </button>
          )}
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      {activeTab === 'armory' ? (
        <ArmyRecipeBuilder
          catalog={catalog}
          army={army}
          onChangeArmy={setArmy}
          onLaunchBattle={() => {
            if (army.troops.length > 0) {
              setDeploySlot({ kind: 'troop', troopId: army.troops[0][0] });
            }
            setActiveTab('battle');
          }}
        />
      ) : (
        <div className="battlefield-viewport">
          {/* FULL-VIEWPORT VILLAGE CANVAS */}
          <BattlefieldCanvas
            mode={activeTab === 'editor' ? 'editor' : 'battle'}
            catalog={catalog}
            layout={layout}
            noDeployMask={noDeployMask}
            battleState={battleState}
            overlays={overlays}
            onToggleOverlay={(key) =>
              setOverlays((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            selectedEditorTool={editorTool}
            selectedBuildingInstanceId={selectedBuildingInstanceId}
            selectedBattleEntity={selectedBattleEntity}
            selectionClickSeq={selectionClickSeq}
            deploySlot={deploySlot}
            onTileAction={handleTileAction}
            onMoveBuilding={handleMoveBuilding}
            onSelectBuildingInstance={(id) => {
              setSelectedBuildingInstanceId(id);
              setSelectionClickSeq((s) => s + 1);
            }}
            onSelectBattleEntity={(ent) => {
              setSelectedBattleEntity(ent);
              setSelectionClickSeq((s) => s + 1);
            }}
          />

          {/* BATTLE MODE FLOATING HUD OVERLAYS */}
          {activeTab === 'battle' && battleState && (
            <>
              {/* TOP-LEFT DEFENDER & 3-STAR SCOREBOARD HUD */}
              <div className="hud-top-left">
                <div className="defender-banner">
                  <img
                    src={BUILDING_SPRITES.TownHall}
                    alt="TH18"
                    className="defender-th-icon"
                  />
                  <div>
                    <div className="defender-name">{layout.name}</div>
                    <div className="defender-sub">
                      Town Hall 18 •{' '}
                      {battleState.town_hall_destroyed
                        ? '💥 TH Destroyed'
                        : '🛡️ Guardian Ready'}
                    </div>
                  </div>
                </div>

                <div className="clash-scoreboard-pod">
                  <div className="clash-stars-strip">
                    {[1, 2, 3].map((s) => (
                      <img
                        key={s}
                        src={
                          battleState.stars >= s
                            ? UI_SPRITES.star
                            : UI_SPRITES.empty_star
                        }
                        alt="star"
                        className={`clash-star-img ${
                          battleState.stars >= s ? 'earned' : ''
                        }`}
                      />
                    ))}
                  </div>
                  <div className="damage-readout-row">
                    <span className="damage-label">Overall Damage</span>
                    <span className="damage-pct">{battleState.destruction_pct}%</span>
                  </div>
                  <div className="clash-progress-track">
                    <div
                      className="clash-progress-fill"
                      style={{ width: `${battleState.destruction_pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* TOP-CENTER BATTLE TIMER */}
              <div className="hud-top-center">
                <div className="battle-timer-label">
                  {battleState.is_finished ? 'BATTLE ENDED' : 'Time left:'}
                </div>
                <div className="battle-timer-value">
                  {mins}m {secs.toString().padStart(2, '0')}s
                </div>
              </div>

              {/* TOP-RIGHT PLAYBACK & AI CONTROLS */}
              <div className="hud-top-right">
                <div className="playback-pod">
                  {battleState.tick > 0 && !battleState.is_finished && (
                    <button
                      className={`clash-btn ${isPlaying ? 'danger' : 'green'}`}
                      onClick={togglePauseBattle}
                      title="Pause or resume simulation"
                    >
                      {isPlaying ? '⏸ Pause' : '▶ Resume'}
                    </button>
                  )}
                  <button
                    className="clash-btn"
                    onClick={stepSingleTick}
                    disabled={isPlaying}
                    title="Step 0.1s Tick"
                  >
                    ⏭ +1 Tick
                  </button>
                  <button
                    className={`clash-btn ${aiMode ? 'gold' : ''}`}
                    onClick={() => {
                      const nextAi = !aiMode;
                      setAiMode(nextAi);
                      if (nextAi && sessionRef.current) {
                        const nextJson = sessionRef.current.run_heuristic_ai_step();
                        setBattleState(JSON.parse(nextJson));
                        setIsPlaying(true);
                      }
                    }}
                  >
                    🤖 {aiMode ? 'AI: ON' : 'AI Attack'}
                  </button>
                  <button className="clash-btn" onClick={resetBattle}>
                    ↺ Reset
                  </button>
                </div>

                <div className="speed-pills-row">
                  <span>Speed:</span>
                  {[1, 2, 4, 10].map((sp) => (
                    <button
                      key={sp}
                      className={`speed-pill-btn ${simSpeed === sp ? 'active' : ''}`}
                      onClick={() => setSimSpeed(sp)}
                    >
                      {sp}×
                    </button>
                  ))}
                </div>
              </div>

              {/* HOW TO ATTACK GUIDANCE BANNER */}
              {battleState.tick === 0 && (
                <div className="hud-attack-guide-banner">
                  <span>
                    ⚔️ <b>HOW TO ATTACK:</b> Select a troop, hero, siege machine, or spell below, then click any valid green tile on the map to deploy and start the attack!
                  </span>
                </div>
              )}

              {/* BOTTOM AUTHENTIC CLASH DEPLOYMENT DOCK */}
              <div className="hud-bottom-dock-wrap">
                <div className="clash-deployment-dock">
                  {/* Troop Cards */}
                  {battleState.remaining_troops.map(([tid, count]) => {
                    const spec = catalog.troops.find((t) => t.id === tid);
                    const isSelected =
                      deploySlot.kind === 'troop' && deploySlot.troopId === tid;
                    return (
                      <button
                        key={tid}
                        className={`deploy-slot-card troop-slot ${
                          isSelected ? 'selected' : ''
                        } ${count === 0 ? 'depleted' : ''}`}
                        onClick={() => setDeploySlot({ kind: 'troop', troopId: tid })}
                      >
                        <span className="slot-top-count">×{count}</span>
                        <img
                          src={TROOP_SPRITES[tid]}
                          alt={spec?.name ?? tid}
                          className="slot-unit-sprite"
                        />
                        <span className="slot-lv-pill">{spec?.max_level}</span>
                        <span className="slot-bottom-name">{spec?.name ?? tid}</span>
                      </button>
                    );
                  })}

                  {/* Siege Machine / Offensive Clan Castle Card */}
                  {(battleState.remaining_siege ||
                    battleState.active_siege_unit_id ||
                    (!battleState.attacker_cc_popped &&
                      army.cc_troops.some(([_, c]) => c > 0))) && (
                    <button
                      className={`deploy-slot-card siege-slot ${
                        deploySlot.kind === 'siege' ? 'selected' : ''
                      }`}
                      onClick={() => {
                        if (
                          battleState.remaining_siege ||
                          (!battleState.active_siege_unit_id &&
                            !battleState.attacker_cc_popped)
                        ) {
                          setDeploySlot({ kind: 'siege' });
                        } else if (
                          battleState.active_siege_unit_id &&
                          !battleState.attacker_cc_popped &&
                          sessionRef.current
                        ) {
                          sessionRef.current.apply_action_json(
                            JSON.stringify('PopSiegeMachine')
                          );
                          setBattleState(JSON.parse(sessionRef.current.get_state_json()));
                        }
                      }}
                    >
                      <span className="slot-top-count">
                        {battleState.active_siege_unit_id ? '⚡ POP' : '×1'}
                      </span>
                      <img
                        src={
                          battleState.remaining_siege || army.siege_machine
                            ? TROOP_SPRITES[
                                battleState.remaining_siege ??
                                  army.siege_machine ??
                                  'SiegeBarracks'
                              ]
                            : BUILDING_SPRITES.ClanCastle
                        }
                        alt="Siege / CC"
                        className="slot-unit-sprite"
                      />
                      <span className="slot-lv-pill">
                        {battleState.remaining_siege || army.siege_machine ? 'SIEGE' : 'CC'}
                      </span>
                      <span className="slot-bottom-name">
                        {battleState.active_siege_unit_id
                          ? 'Release CC'
                          : battleState.remaining_siege
                          ? 'Deploy'
                          : 'Deploy CC'}
                      </span>
                    </button>
                  )}

                  {/* Hero Cards (with Pet + 2 Equipped Items Badges!) */}
                  {army.heroes.map(([hid, pid]) => {
                    const hspec = catalog.heroes.find((h) => h.id === hid);
                    const eqPair =
                      army.hero_equipment?.find(([h]) => h === hid)?.[1] ??
                      hspec?.default_equipment ??
                      [];
                    const isRemaining = battleState.remaining_heroes.some(
                      ([h]) => h === hid
                    );
                    const deployedEntry = battleState.deployed_heroes.find(
                      ([h]) => h === hid
                    );
                    const liveHero = deployedEntry
                      ? battleState.units.find((u) => u.id === deployedEntry[1])
                      : null;
                    const canTriggerAbility =
                      liveHero && liveHero.alive && !liveHero.ability_used;
                    const isSelected =
                      deploySlot.kind === 'hero' && deploySlot.heroId === hid;
                    const hpRatio = liveHero
                      ? Math.max(0, liveHero.hp / liveHero.max_hp)
                      : 1;

                    return (
                      <button
                        key={hid}
                        className={`deploy-slot-card hero-slot ${
                          isSelected ? 'selected' : ''
                        } ${canTriggerAbility ? 'ability-ready' : ''} ${
                          !isRemaining && (!liveHero || !liveHero.alive) ? 'depleted' : ''
                        }`}
                        onClick={() => {
                          if (isRemaining) {
                            setDeploySlot({ kind: 'hero', heroId: hid });
                          } else if (canTriggerAbility && sessionRef.current) {
                            sessionRef.current.apply_action_json(
                              JSON.stringify({ ActivateHeroAbility: { hero_id: hid } })
                            );
                            setBattleState(
                              JSON.parse(sessionRef.current.get_state_json())
                            );
                          }
                        }}
                      >
                        {/* Top-left Equipment Mini Badges + Top-right Pet Mini Badge */}
                        <div className="hero-dock-badges">
                          <div className="hero-dock-equips">
                            {eqPair.map((eqId) => (
                              <img
                                key={eqId}
                                src={EQUIPMENT_SPRITES[eqId]}
                                alt={eqId}
                                className="dock-mini-equip"
                              />
                            ))}
                          </div>
                          <img
                            src={PET_SPRITES[pid]}
                            alt={pid}
                            className="dock-mini-pet"
                          />
                        </div>

                        <img
                          src={HERO_SPRITES[hid]}
                          alt={hspec?.name ?? hid}
                          className="slot-unit-sprite"
                        />
                        <span className="slot-lv-pill">{hspec?.max_level}</span>

                        {!isRemaining && liveHero && liveHero.alive && (
                          <div className="dock-hero-hp-bar">
                            <div
                              className="dock-hero-hp-fill"
                              style={{ width: `${hpRatio * 100}%` }}
                            />
                          </div>
                        )}

                        <span className="slot-bottom-name">
                          {isRemaining
                            ? hspec?.name.split(' ')[1] ?? hspec?.name
                            : canTriggerAbility
                            ? '⚡ ABILITY!'
                            : liveHero?.alive
                            ? `${Math.round(hpRatio * 100)}% HP`
                            : 'KO'}
                        </span>
                      </button>
                    );
                  })}

                  {/* Spell Cards */}
                  {battleState.remaining_spells.map(([sid, count]) => {
                    const spec = catalog.spells.find((s) => s.id === sid);
                    const isSelected =
                      deploySlot.kind === 'spell' && deploySlot.spellId === sid;
                    return (
                      <button
                        key={sid}
                        className={`deploy-slot-card spell-slot ${
                          isSelected ? 'selected' : ''
                        } ${count === 0 ? 'depleted' : ''}`}
                        onClick={() => setDeploySlot({ kind: 'spell', spellId: sid })}
                      >
                        <span className="slot-top-count">×{count}</span>
                        <img
                          src={SPELL_SPRITES[sid]}
                          alt={spec?.name ?? sid}
                          className="slot-unit-sprite"
                        />
                        <span className="slot-lv-pill">{spec?.max_level}</span>
                        <span className="slot-bottom-name">
                          {spec?.name.replace(' Spell', '')}
                        </span>
                      </button>
                    );
                  })}

                  {/* Inspect Tool Card */}
                  <button
                    className={`deploy-slot-card inspect-slot ${
                      deploySlot.kind === 'inspect' ? 'selected' : ''
                    }`}
                    onClick={() => setDeploySlot({ kind: 'inspect' })}
                    title="Inspect battle units and buildings"
                  >
                    <span className="slot-top-count">INSPECT</span>
                    <div className="inspect-icon-circle">🔍</div>
                    <span className="slot-bottom-name">Inspect</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* EDITOR MODE FLOATING PALETTE & INSPECTOR */}
          {activeTab === 'editor' && (
            <>
              <aside className="editor-floating-left">
                <div className="editor-card-header">
                  <h3>TH18 Village Editor</h3>
                  <span
                    className={`validation-pill ${
                      layoutValidation?.is_valid ? 'valid' : 'invalid'
                    }`}
                  >
                    {layout.buildings.length}/{catalog.buildings.reduce((n, b) => n + b.max_count, 0)} Bldgs • {layout.walls.length}/325 Walls
                  </span>
                </div>

                <div className="editor-tools-row">
                  <button
                    className={`clash-btn ${
                      editorTool.type === 'select' ? 'gold' : ''
                    }`}
                    onClick={() => setEditorTool({ type: 'select' })}
                  >
                    🎯 Move
                  </button>
                  <button
                    className={`clash-btn ${
                      editorTool.type === 'wall_brush' ? 'gold' : ''
                    }`}
                    onClick={() => setEditorTool({ type: 'wall_brush' })}
                  >
                    🧱 Wall+
                  </button>
                  <button
                    className={`clash-btn ${
                      editorTool.type === 'wall_eraser' ? 'gold' : ''
                    }`}
                    onClick={() => setEditorTool({ type: 'wall_eraser' })}
                  >
                    🧹 Erase
                  </button>
                  <button
                    className="clash-btn danger"
                    onClick={() =>
                      setLayout({
                        ...layout,
                        buildings: [],
                        walls: [],
                        traps: [],
                      })
                    }
                  >
                    🗑️ Clear
                  </button>
                </div>

                <div className="editor-palette-scroll">
                  {catalog.buildings
                    .filter((b) => b.id !== 'Wall')
                    .map((b) => {
                      const placedCount = layout.buildings.filter(
                        (pb) => pb.building_id === b.id
                      ).length;
                      const isFull = placedCount >= b.max_count;
                      const isSelected =
                        editorTool.type === 'place_building' &&
                        editorTool.buildingId === b.id;
                      return (
                        <button
                          key={b.id}
                          className={`editor-palette-row ${
                            isSelected ? 'active' : ''
                          } ${isFull ? 'full' : ''}`}
                          onClick={() => {
                            if (!isFull) {
                              setEditorTool({
                                type: 'place_building',
                                buildingId: b.id,
                              });
                            } else {
                              const inst = layout.buildings.find(
                                (pb) => pb.building_id === b.id
                              );
                              if (inst) {
                                setEditorTool({ type: 'select' });
                                setSelectedBuildingInstanceId(inst.instance_id);
                              }
                            }
                          }}
                        >
                          <img
                            src={BUILDING_SPRITES[b.id]}
                            alt={b.name}
                            className="palette-row-sprite"
                          />
                          <div className="palette-row-text">
                            <strong>{b.name}</strong>
                            <span>
                              Lv {b.max_level} • {b.footprint}×{b.footprint}
                            </span>
                          </div>
                          <span className="palette-row-count">
                            {placedCount}/{b.max_count}
                          </span>
                        </button>
                      );
                    })}

                  <div className="palette-divider">TRAPS (48 MAX)</div>
                  {catalog.traps.map((t) => {
                    const placedCount = layout.traps.filter(
                      (pt) => pt.trap_id === t.id
                    ).length;
                    const isFull = placedCount >= t.max_count;
                    const isSelected =
                      editorTool.type === 'place_trap' && editorTool.trapId === t.id;
                    return (
                      <button
                        key={t.id}
                        className={`editor-palette-row ${
                          isSelected ? 'active' : ''
                        } ${isFull ? 'full' : ''}`}
                        onClick={() => {
                          if (!isFull) {
                            setEditorTool({ type: 'place_trap', trapId: t.id });
                          }
                        }}
                      >
                        <img
                          src={TRAP_SPRITES[t.id]}
                          alt={t.name}
                          className="palette-row-sprite"
                        />
                        <div className="palette-row-text">
                          <strong>{t.name}</strong>
                          <span>Lv {t.max_level}</span>
                        </div>
                        <span className="palette-row-count">
                          {placedCount}/{t.max_count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </aside>

              {selectedPlacedBuilding && selectedBuildingSpec && (
                <aside className="editor-floating-right">
                  <div className="inspector-building-header">
                    <img
                      src={BUILDING_SPRITES[selectedBuildingSpec.id]}
                      alt={selectedBuildingSpec.name}
                      className="inspector-bldg-sprite"
                    />
                    <div>
                      <h3>{selectedBuildingSpec.name}</h3>
                      <span className="badge-gold">
                        Lv {selectedBuildingSpec.max_level} • ({selectedPlacedBuilding.tile_x},{' '}
                        {selectedPlacedBuilding.tile_y})
                      </span>
                    </div>
                  </div>

                  <div className="telemetry-kv-list">
                    <div>
                      <span>Hitpoints</span>
                      <strong>{selectedBuildingSpec.max_hp.toLocaleString()} HP</strong>
                    </div>
                    <div>
                      <span>Damage / Sec</span>
                      <strong>
                        {selectedBuildingSpec.id === 'CraftingStation'
                          ? '250 DPS × 6/4/3 Flames'
                          : `${selectedBuildingSpec.dps} DPS`}
                      </strong>
                    </div>
                    <div>
                      <span>Range</span>
                      <strong>
                        {selectedBuildingSpec.id === 'SpellTower'
                          ? selectedPlacedBuilding.mode === 'SpellTowerInvisibility'
                            ? '4.5 tiles (Trigger & Cloak)'
                            : selectedPlacedBuilding.mode === 'SpellTowerEarthquake'
                            ? '9.0t Trigger • 4.7t Ground EQ'
                            : '9.0t Trigger • 5.0t Aura'
                          : selectedBuildingSpec.id === 'AirSweeper'
                          ? '1.0–15.0t • 105° Cone'
                          : selectedBuildingSpec.id === 'Firespitter'
                          ? '16.0t • 150° Cone (2× Pierce)'
                          : `${selectedBuildingSpec.max_range} tiles`}
                      </strong>
                    </div>
                    {(selectedBuildingSpec.id === 'AirSweeper' ||
                      selectedBuildingSpec.id === 'Firespitter') && (
                      <div>
                        <span>Aim Direction</span>
                        <strong>{Math.round(selectedPlacedBuilding.direction_deg ?? 0)}°</strong>
                      </div>
                    )}
                  </div>

                  {(selectedBuildingSpec.id === 'AirSweeper' ||
                    selectedBuildingSpec.id === 'Firespitter') && (
                    <div className="mode-switch-box">
                      <label>
                        🧭 Directional Cone ({selectedBuildingSpec.id === 'AirSweeper' ? '105° Arc • 45° Step' : '150° Arc • 90° Step'})
                      </label>
                      <button
                        type="button"
                        className="clash-btn gold"
                        style={{ width: '100%', marginTop: '6px' }}
                        onClick={() => {
                          const step = selectedBuildingSpec.id === 'AirSweeper' ? 45 : 90;
                          const nextDeg = ((selectedPlacedBuilding.direction_deg ?? 0) + step) % 360;
                          setLayout({
                            ...layout,
                            buildings: layout.buildings.map((b) =>
                              b.instance_id === selectedPlacedBuilding.instance_id
                                ? { ...b, direction_deg: nextDeg }
                                : b
                            ),
                          });
                          setSelectionClickSeq((s) => s + 1);
                        }}
                      >
                        ↻ Rotate +{selectedBuildingSpec.id === 'AirSweeper' ? '45°' : '90°'} (Facing {Math.round(selectedPlacedBuilding.direction_deg ?? 0)}°)
                      </button>
                    </div>
                  )}

                  {selectedBuildingSpec.id === 'CraftingStation' && (
                    <div className="mode-switch-box">
                      <label>🕯️ Crafted Defense: Hot Candle (Phase 4)</label>
                      <p style={{ fontSize: '0.78rem', color: '#cbd5e1', margin: '4px 0 0' }}>
                        Fires <b>6 flames</b> (0–78s), melts to <b>4 flames</b> (78–132s), then{' '}
                        <b>3 flames</b> (132s+). Concentrates all flames if fewer targets are in
                        range!
                      </p>
                    </div>
                  )}

                  {selectedBuildingSpec.id === 'SpellTower' ? (
                    <div className="mode-switch-box">
                      <label>🧪 Select Spell Tower Spell (4 Modes)</label>
                      <div className="spelltower-picker-grid">
                        {[
                          {
                            mode: 'SpellTowerRage',
                            label: 'Rage',
                            icon: SPELL_SPRITES.Rage,
                            sub: '+60% DMG • 5t • 18s',
                          },
                          {
                            mode: 'SpellTowerPoison',
                            label: 'Poison',
                            icon: SPELL_SPRITES.Poison,
                            sub: '60 DPS & Slow • 5t • 12s',
                          },
                          {
                            mode: 'SpellTowerInvisibility',
                            label: 'Invisibility',
                            icon: SPELL_SPRITES.Invisibility,
                            sub: 'Cloak • 4.5t • 4.5s',
                          },
                          {
                            mode: 'SpellTowerEarthquake',
                            label: 'Earthquake',
                            icon: SPELL_SPRITES.Earthquake,
                            sub: '-30% Ground HP • 4.7t',
                          },
                        ].map((sp) => {
                          const active = selectedPlacedBuilding.mode === sp.mode;
                          return (
                            <button
                              key={sp.mode}
                              type="button"
                              className={`spelltower-mode-btn ${active ? 'active' : ''}`}
                              onClick={() => {
                                setLayout({
                                  ...layout,
                                  buildings: layout.buildings.map((b) =>
                                    b.instance_id === selectedPlacedBuilding.instance_id
                                      ? { ...b, mode: sp.mode }
                                      : b
                                  ),
                                });
                                setSelectionClickSeq((s) => s + 1);
                              }}
                            >
                              <img src={sp.icon} alt={sp.label} />
                              <div>
                                <strong>{sp.label}</strong>
                                <span>{sp.sub}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    selectedBuildingSpec.available_modes.length > 1 && (
                      <div className="mode-switch-box">
                        <label>Defense / Guardian Mode</label>
                        <select
                          className="clash-select"
                          value={selectedPlacedBuilding.mode}
                          onChange={(e) => {
                            const newMode = e.target.value;
                            setLayout({
                              ...layout,
                              buildings: layout.buildings.map((b) =>
                                b.instance_id === selectedPlacedBuilding.instance_id
                                  ? { ...b, mode: newMode }
                                  : b
                              ),
                            });
                          }}
                        >
                          {selectedBuildingSpec.available_modes.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    )
                  )}

                  <p style={{ fontSize: '0.76rem', color: '#94a3b8', margin: '6px 0' }}>
                    💡 Drag this building on the map or click any free tile to reposition it.
                  </p>

                  <button
                    className="clash-btn danger"
                    onClick={() => {
                      setLayout({
                        ...layout,
                        buildings: layout.buildings.filter(
                          (b) => b.instance_id !== selectedPlacedBuilding.instance_id
                        ),
                      });
                      setSelectedBuildingInstanceId(null);
                    }}
                  >
                    🗑️ Remove Building
                  </button>
                </aside>
              )}
            </>
          )}

          {/* COLLAPSIBLE TACTICAL OVERLAYS & ENTITY TELEMETRY DRAWER */}
          {showTacticalDrawer && (
            <aside className="tactical-floating-drawer">
              <div className="drawer-header">
                <h3>Tactical Overlays & Telemetry</h3>
                <button
                  className="modal-close-btn"
                  onClick={() => setShowTacticalDrawer(false)}
                >
                  ✕
                </button>
              </div>

              <div className="toggle-list">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={overlays.isometric}
                    onChange={(e) =>
                      setOverlays({ ...overlays, isometric: e.target.checked })
                    }
                  />
                  <span>2.5D Isometric Village Projection</span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={overlays.showRedZone}
                    onChange={(e) =>
                      setOverlays({ ...overlays, showRedZone: e.target.checked })
                    }
                  />
                  <span>No-Deploy Red Zone Boundary</span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={overlays.showRanges}
                    onChange={(e) =>
                      setOverlays({ ...overlays, showRanges: e.target.checked })
                    }
                  />
                  <span>All Defense Range Circles</span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={overlays.showDpsHeatmap}
                    onChange={(e) =>
                      setOverlays({ ...overlays, showDpsHeatmap: e.target.checked })
                    }
                  />
                  <span>DPS Threat Heatmap</span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={overlays.showTargetVectors}
                    onChange={(e) =>
                      setOverlays({ ...overlays, showTargetVectors: e.target.checked })
                    }
                  />
                  <span>Unit Target Lock Vectors</span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={overlays.showTraps}
                    onChange={(e) =>
                      setOverlays({ ...overlays, showTraps: e.target.checked })
                    }
                  />
                  <span>Reveal Village Traps (48)</span>
                </label>
              </div>

              {battleState && (
                <div className="telemetry-kv-list">
                  <div>
                    <span>Simulation Tick</span>
                    <strong>#{battleState.tick} / 1800</strong>
                  </div>
                  <div>
                    <span>Total Damage Dealt</span>
                    <strong>
                      {Math.round(battleState.damage_dealt_total).toLocaleString()} HP
                    </strong>
                  </div>
                  <div>
                    <span>Active Attacker Units</span>
                    <strong>
                      {
                        battleState.units.filter(
                          (u) => u.alive && u.team === 'Attacker'
                        ).length
                      }
                    </strong>
                  </div>
                </div>
              )}

              {battleState && selectedBattleEntity && (
                <div className="live-entity-box">
                  <h4>Selected Entity</h4>
                  {selectedBattleEntity.kind === 'unit' ? (
                    (() => {
                      const u = battleState.units.find(
                        (unit) => unit.id === selectedBattleEntity.id
                      );
                      if (!u) return <p>Unit defeated.</p>;
                      return (
                        <div className="telemetry-kv-list">
                          <div>
                            <span>Unit</span>
                            <strong>
                              {u.name} (#{u.id})
                            </strong>
                          </div>
                          <div>
                            <span>Hitpoints</span>
                            <strong>
                              {Math.round(u.hp)} / {Math.round(u.max_hp)} HP
                            </strong>
                          </div>
                          {u.equipped_items && (
                            <div>
                              <span>Equipment</span>
                              <strong>{u.equipped_items.join(' + ')}</strong>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    (() => {
                      const b = battleState.buildings.find(
                        (bldg) => bldg.instance_id === selectedBattleEntity.id
                      );
                      if (!b) return null;
                      return (
                        <div className="telemetry-kv-list">
                          <div>
                            <span>Building</span>
                            <strong>{b.name}</strong>
                          </div>
                          <div>
                            <span>Hitpoints</span>
                            <strong>
                              {Math.round(b.hp)} / {Math.round(b.max_hp)} HP
                            </strong>
                          </div>
                          <div>
                            <span>Mode</span>
                            <strong>{b.mode}</strong>
                          </div>
                          {(b.building_id === 'AirSweeper' ||
                            b.building_id === 'Firespitter') && (
                            <div>
                              <span>Cone Direction</span>
                              <strong>
                                {Math.round(b.direction_deg)}° (
                                {b.building_id === 'AirSweeper' ? '105° Cone' : '150° Cone'})
                              </strong>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
