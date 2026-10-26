import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { BUILDING_SPRITES, UI_SPRITES } from './assetsManifest';
import {
  BattlefieldCanvas,
  DeploySlotType,
  OverlayOptions,
} from './canvas/BattlefieldCanvas';
import { GameArmyBuilder } from './game/GameArmyBuilder';
import { GameBattleHud } from './game/GameBattleHud';
import { GameTacticalDrawer } from './game/GameTacticalDrawer';
import { EditorToolType, GameVillageEditor } from './game/GameVillageEditor';
import { AIStudioView } from './ai/AIStudioView';

type ActiveTab = 'battle' | 'editor' | 'armory' | 'ai';

let wasmInitPromise: Promise<unknown> | null = null;
function ensureWasmInitialized() {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm();
  }
  return wasmInitPromise;
}

function getDefaultDeploySlot(army: ArmyLoadout): DeploySlotType {
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
  const [editorTool, setEditorTool] = useState<EditorToolType>({ type: 'select' });
  const [selectedBuildingInstanceId, setSelectedBuildingInstanceId] = useState<
    number | null
  >(null);
  const [selectionClickSeq, setSelectionClickSeq] = useState<number>(0);

  // Battle & AI state
  const sessionRef = useRef<WasmBattleSession | null>(null);
  const [battleState, setBattleState] = useState<BattleEngineState | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isAiPlaying, setIsAiPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [deploySlot, setDeploySlot] = useState<DeploySlotType>({
    kind: 'troop',
    troopId: 'Thrower',
  });
  const [selectedBattleEntity, setSelectedBattleEntity] = useState<{
    kind: 'building' | 'unit';
    id: number;
  } | null>(null);

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
      setIsAiPlaying(false);
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

  // Manual Game simulation loop (Battle Arena tab only)
  useEffect(() => {
    if (!isPlaying || activeTab !== 'battle') return;
    const intervalMs = Math.max(16, Math.floor(100 / simSpeed));
    const timer = window.setInterval(() => {
      const sess = sessionRef.current;
      if (!sess) return;
      const nextJson = sess.step_ticks(simSpeed >= 4 ? 2 : 1);
      const nextState: BattleEngineState = JSON.parse(nextJson);
      setBattleState(nextState);
      if (nextState.is_finished) {
        setIsPlaying(false);
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, simSpeed, activeTab]);

  // AI simulation loop (AI Studio tab only)
  useEffect(() => {
    if (!isAiPlaying || activeTab !== 'ai') return;
    const intervalMs = Math.max(16, Math.floor(100 / simSpeed));
    const timer = window.setInterval(() => {
      const sess = sessionRef.current;
      if (!sess) return;
      const nextJson = sess.run_heuristic_ai_step();
      const nextState: BattleEngineState = JSON.parse(nextJson);
      setBattleState(nextState);
      if (nextState.is_finished) {
        setIsAiPlaying(false);
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isAiPlaying, simSpeed, activeTab]);

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

  const resetBattle = useCallback(() => {
    if (!layout || !army) return;
    disposeSession();
    const sess = new WasmBattleSession(JSON.stringify(layout), JSON.stringify(army));
    sessionRef.current = sess;
    setBattleState(JSON.parse(sess.get_state_json()));
    setIsPlaying(false);
    setIsAiPlaying(false);
    setDeploySlot(getDefaultDeploySlot(army));
  }, [layout, army]);

  const stepSingleGameTick = () => {
    const sess = sessionRef.current;
    if (!sess) return;
    setBattleState(JSON.parse(sess.step_ticks(1)));
  };

  const stepSingleAiTick = () => {
    const sess = sessionRef.current;
    if (!sess) return;
    setBattleState(JSON.parse(sess.run_heuristic_ai_step()));
  };

  const extractLocalObservation = useCallback((): number[] | null => {
    const sess = sessionRef.current;
    if (!sess) return null;
    try {
      return JSON.parse(sess.extract_spatial_observation_json()) as number[];
    } catch {
      return null;
    }
  }, []);

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
          setLayout({ ...layout, walls: [...layout.walls, [tileX, tileY]] });
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

    if (activeTab === 'battle' && sessionRef.current && battleState) {
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

      if (hitBuilding && deploySlot.kind !== 'spell') {
        setSelectedBattleEntity({ kind: 'building', id: hitBuilding.instance_id });
        setSelectionClickSeq((s) => s + 1);
        return;
      }

      const mask = battleState.no_deploy_mask ?? noDeployMask;
      const isRedZone = Boolean(mask[tileY]?.[tileX]);

      let actionObj: unknown = null;
      if (
        deploySlot.kind === 'troop' ||
        deploySlot.kind === 'hero' ||
        deploySlot.kind === 'siege'
      ) {
        if (isRedZone) return;
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
          if (deploySlot.kind === 'troop') {
            const rem =
              nextState.remaining_troops.find(([t]) => t === deploySlot.troopId)?.[1] ??
              0;
            if (rem === 0) {
              const nextTroop = nextState.remaining_troops.find(([_, c]) => c > 0);
              if (nextTroop) setDeploySlot({ kind: 'troop', troopId: nextTroop[0] });
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
            const rem =
              nextState.remaining_spells.find(([s]) => s === deploySlot.spellId)?.[1] ??
              0;
            if (rem === 0) {
              const nextSpell = nextState.remaining_spells.find(([_, c]) => c > 0);
              if (nextSpell) setDeploySlot({ kind: 'spell', spellId: nextSpell[0] });
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

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <img src={BUILDING_SPRITES.TownHall} alt="TH18" className="th-header-icon" />
          <h1 className="brand-title">CLASH OF CLANS • TH18</h1>
        </div>

        <nav className="mode-tabs">
          <button
            className={`tab-btn ${activeTab === 'battle' ? 'active' : ''}`}
            onClick={() => {
              setIsAiPlaying(false);
              setActiveTab('battle');
            }}
          >
            <img src={UI_SPRITES.sword} alt="" className="tab-icon" />
            Battle Arena
          </button>
          <button
            className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => {
              setIsPlaying(false);
              setIsAiPlaying(false);
              setActiveTab('editor');
            }}
          >
            <img src={UI_SPRITES.shield} alt="" className="tab-icon" />
            Village Editor
          </button>
          <button
            className={`tab-btn ${activeTab === 'armory' ? 'active' : ''}`}
            onClick={() => {
              setIsPlaying(false);
              setIsAiPlaying(false);
              setActiveTab('armory');
            }}
          >
            <img src={UI_SPRITES.elixir} alt="" className="tab-icon" />
            Army Recipe ({totalArmyHousing}/352)
          </button>
          <button
            className={`tab-btn ai-tab-btn ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => {
              setIsPlaying(false);
              setActiveTab('ai');
            }}
          >
            🤖 AI Studio
          </button>
        </nav>

        <div className="header-right-controls">
          <span className="badge-gold">⚔️ {army.name}</span>
          {activeTab !== 'armory' && (
            <button
              className={`clash-btn ${showTacticalDrawer ? 'gold' : ''}`}
              onClick={() => setShowTacticalDrawer(!showTacticalDrawer)}
            >
              ⚙️ Overlays
            </button>
          )}
        </div>
      </header>

      {activeTab === 'armory' ? (
        <GameArmyBuilder
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
      ) : activeTab === 'ai' ? (
        <div className="battlefield-viewport">
          <AIStudioView
            catalog={catalog}
            layout={layout}
            army={army}
            noDeployMask={noDeployMask}
            battleState={battleState}
            overlays={overlays}
            isAiPlaying={isAiPlaying}
            simSpeed={simSpeed}
            selectedBattleEntity={selectedBattleEntity}
            selectionClickSeq={selectionClickSeq}
            extractLocalObservation={extractLocalObservation}
            onToggleOverlay={(key) =>
              setOverlays((prev) => ({ ...prev, [key]: !prev[key] }))
            }
            onSelectBattleEntity={(ent) => {
              setSelectedBattleEntity(ent);
              setSelectionClickSeq((s) => s + 1);
            }}
            onToggleAiPlay={() => {
              const next = !isAiPlaying;
              setIsAiPlaying(next);
              if (next && sessionRef.current && battleState?.tick === 0) {
                setBattleState(JSON.parse(sessionRef.current.run_heuristic_ai_step()));
              }
            }}
            onStepAiTick={stepSingleAiTick}
            onResetAiBattle={resetBattle}
            onSetSimSpeed={setSimSpeed}
            onApplyEvolvedLayout={(nextLayout) => setLayout(nextLayout)}
          />
          {showTacticalDrawer && (
            <GameTacticalDrawer
              overlays={overlays}
              battleState={battleState}
              selectedBattleEntity={selectedBattleEntity}
              onSetOverlays={setOverlays}
              onClose={() => setShowTacticalDrawer(false)}
            />
          )}
        </div>
      ) : (
        <div className="battlefield-viewport">
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

          {activeTab === 'battle' && battleState && (
            <GameBattleHud
              catalog={catalog}
              layout={layout}
              army={army}
              battleState={battleState}
              isPlaying={isPlaying}
              simSpeed={simSpeed}
              deploySlot={deploySlot}
              onSetDeploySlot={setDeploySlot}
              onTogglePause={() => {
                if (!battleState || battleState.tick === 0 || battleState.is_finished)
                  return;
                setIsPlaying((prev) => !prev);
              }}
              onStepSingleTick={stepSingleGameTick}
              onResetBattle={resetBattle}
              onSetSimSpeed={setSimSpeed}
              onPopSiegeMachine={() => {
                if (!sessionRef.current) return;
                sessionRef.current.apply_action_json(JSON.stringify('PopSiegeMachine'));
                setBattleState(JSON.parse(sessionRef.current.get_state_json()));
              }}
              onActivateHeroAbility={(heroId) => {
                if (!sessionRef.current) return;
                sessionRef.current.apply_action_json(
                  JSON.stringify({ ActivateHeroAbility: { hero_id: heroId } })
                );
                setBattleState(JSON.parse(sessionRef.current.get_state_json()));
              }}
            />
          )}

          {activeTab === 'editor' && (
            <GameVillageEditor
              catalog={catalog}
              layout={layout}
              editorTool={editorTool}
              layoutValidation={layoutValidation}
              selectedPlacedBuilding={selectedPlacedBuilding}
              selectedBuildingSpec={selectedBuildingSpec}
              onSetEditorTool={setEditorTool}
              onSetLayout={setLayout}
              onSelectBuildingInstance={setSelectedBuildingInstanceId}
              onBumpSelectionSeq={() => setSelectionClickSeq((s) => s + 1)}
            />
          )}

          {showTacticalDrawer && (
            <GameTacticalDrawer
              overlays={overlays}
              battleState={battleState}
              selectedBattleEntity={selectedBattleEntity}
              onSetOverlays={setOverlays}
              onClose={() => setShowTacticalDrawer(false)}
            />
          )}
        </div>
      )}
    </div>
  );
};
