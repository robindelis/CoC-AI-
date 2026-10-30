import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import initWasm, {
  WasmBattleSession,
  wasm_compute_no_deploy_json,
  wasm_get_catalog_json,
} from './wasm-pkg/coc_wasm';
import {
  ArmyLoadout,
  BattleEngineState,
  FullCatalog,
  VillageLayout,
} from './types';
import { BUILDING_SPRITES, UI_SPRITES } from './assetsManifest';
import { OverlayOptions } from './canvas/BattlefieldCanvas';
import { GameArmyBuilder } from './game/GameArmyBuilder';
import { GameTacticalDrawer } from './game/GameTacticalDrawer';
import { AIStudioView } from './ai/AIStudioView';
import { RLAcademyView } from './ai/RLAcademyView';
import { AIRolloutStep } from './ai/aiTypes';

type ActiveTab = 'armory' | 'ai_train' | 'ai_test' | 'rl_academy';

let wasmInitPromise: Promise<unknown> | null = null;
function ensureWasmInitialized() {
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm();
  }
  return wasmInitPromise;
}

export const App: React.FC = () => {
  const [catalog, setCatalog] = useState<FullCatalog | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('ai_train');
  const [layout, setLayout] = useState<VillageLayout | null>(null);
  const [army, setArmy] = useState<ArmyLoadout | null>(null);
  const [noDeployMask, setNoDeployMask] = useState<boolean[][]>([]);
  const [showTacticalDrawer, setShowTacticalDrawer] = useState<boolean>(false);
  const [selectionClickSeq, setSelectionClickSeq] = useState<number>(0);

  // Battle & AI state
  const sessionRef = useRef<WasmBattleSession | null>(null);
  const [battleState, setBattleState] = useState<BattleEngineState | null>(null);
  const [isAiPlaying, setIsAiPlaying] = useState<boolean>(false);
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
      setIsAiPlaying(false);
    } catch (err) {
      console.error('Failed to initialize battle session:', err);
    }
  }, [layout, army]);

  // AI simulation loop (AI Tester tab only)
  const rolloutScheduleRef = useRef<{
    steps: AIRolloutStep[];
    cursor: number;
    ticksPerStep: number;
    speedMode: 'watch' | 'fast' | 'instant';
  } | null>(null);

  useEffect(() => {
    if (!isAiPlaying || activeTab !== 'ai_test') return;
    const sched = rolloutScheduleRef.current;
    const intervalMs = sched?.speedMode === 'watch' ? 75 : 16;
    const timer = window.setInterval(() => {
      const sess = sessionRef.current;
      if (!sess) return;
      const activeSched = rolloutScheduleRef.current;
      if (activeSched && activeSched.steps.length > 0) {
        if (activeSched.cursor < activeSched.steps.length) {
          const item = activeSched.steps[activeSched.cursor];
          activeSched.cursor += 1;
          if (item.battle_action) {
            sess.apply_action_json(JSON.stringify(item.battle_action));
          }
          const nextJson = sess.step_ticks(activeSched.ticksPerStep);
          const nextState: BattleEngineState = JSON.parse(nextJson);
          setBattleState(nextState);
          if (nextState.is_finished) {
            rolloutScheduleRef.current = null;
            setIsAiPlaying(false);
          }
        } else {
          // Fast-forward remaining combat ticks after all actions are placed
          const nextJson = sess.step_ticks(
            activeSched.speedMode === 'watch' ? 12 : 360
          );
          const nextState: BattleEngineState = JSON.parse(nextJson);
          setBattleState(nextState);
          if (nextState.is_finished) {
            rolloutScheduleRef.current = null;
            setIsAiPlaying(false);
          }
        }
        return;
      }

      const nextJson = sess.run_heuristic_ai_ticks(360);
      const nextState: BattleEngineState = JSON.parse(nextJson);
      setBattleState(nextState);
      if (nextState.is_finished) {
        setIsAiPlaying(false);
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isAiPlaying, activeTab]);

  const playTrainedRollout = useCallback(
    (
      steps: AIRolloutStep[],
      ticksPerStep: number,
      speedMode: 'watch' | 'fast' | 'instant'
    ) => {
      if (!layout || !army) return;
      disposeSession();
      const sess = new WasmBattleSession(JSON.stringify(layout), JSON.stringify(army));
      sessionRef.current = sess;

      if (speedMode === 'instant') {
        rolloutScheduleRef.current = null;
        for (const item of steps) {
          if (item.battle_action) {
            sess.apply_action_json(JSON.stringify(item.battle_action));
          }
          sess.step_ticks(ticksPerStep);
        }
        const finalJson = sess.step_ticks(1800);
        setBattleState(JSON.parse(finalJson));
        setIsAiPlaying(false);
        return;
      }

      rolloutScheduleRef.current = {
        steps,
        cursor: 0,
        ticksPerStep,
        speedMode,
      };
      setBattleState(JSON.parse(sess.get_state_json()));
      setIsAiPlaying(true);
    },
    [layout, army]
  );

  const resetBattle = useCallback(() => {
    if (!layout || !army) return;
    disposeSession();
    const sess = new WasmBattleSession(JSON.stringify(layout), JSON.stringify(army));
    sessionRef.current = sess;
    setBattleState(JSON.parse(sess.get_state_json()));
    setIsAiPlaying(false);
  }, [layout, army]);

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
            className={`tab-btn ${activeTab === 'armory' ? 'active' : ''}`}
            onClick={() => {
              setIsAiPlaying(false);
              setActiveTab('armory');
            }}
          >
            <img src={UI_SPRITES.elixir} alt="" className="tab-icon" />
            Army Recipe ({totalArmyHousing}/352)
          </button>
          <button
            className={`tab-btn ai-tab-btn ${activeTab === 'ai_train' ? 'active' : ''}`}
            onClick={() => {
              setIsAiPlaying(false);
              setActiveTab('ai_train');
            }}
          >
            📊 AI Trainer
          </button>
          <button
            className={`tab-btn ai-tab-btn ${activeTab === 'ai_test' ? 'active' : ''}`}
            onClick={() => {
              setIsAiPlaying(false);
              setActiveTab('ai_test');
            }}
          >
            🧪 AI Model Tester
          </button>
          <button
            className={`tab-btn ai-tab-btn ${activeTab === 'rl_academy' ? 'active' : ''}`}
            onClick={() => {
              setIsAiPlaying(false);
              setActiveTab('rl_academy');
            }}
          >
            🎓 RL Professor Course
          </button>
        </nav>

        <div className="header-right-controls">
          <span className="badge-gold">⚔️ {army.name}</span>
          {activeTab === 'ai_test' && (
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
          onGoToTrainer={() => setActiveTab('ai_train')}
        />
      ) : activeTab === 'rl_academy' ? (
        <RLAcademyView onJumpToTab={(t) => setActiveTab(t)} />
      ) : (
        <div className="battlefield-viewport">
          <AIStudioView
            studioMode={activeTab === 'ai_train' ? 'trainer' : 'tester'}
            onSwitchStudioMode={(m) =>
              setActiveTab(m === 'trainer' ? 'ai_train' : 'ai_test')
            }
            catalog={catalog}
            layout={layout}
            army={army}
            noDeployMask={noDeployMask}
            battleState={battleState}
            overlays={overlays}
            isAiPlaying={isAiPlaying}
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
              if (!next) {
                rolloutScheduleRef.current = null;
                setIsAiPlaying(false);
                return;
              }
              if (battleState?.is_finished && layout && army) {
                disposeSession();
                const sess = new WasmBattleSession(
                  JSON.stringify(layout),
                  JSON.stringify(army)
                );
                sessionRef.current = sess;
                setBattleState(JSON.parse(sess.run_heuristic_ai_ticks(360)));
                setIsAiPlaying(true);
                return;
              }
              setIsAiPlaying(true);
              if (sessionRef.current && battleState?.tick === 0) {
                setBattleState(
                  JSON.parse(sessionRef.current.run_heuristic_ai_ticks(360))
                );
              }
            }}
            onStepAiTick={stepSingleAiTick}
            onResetAiBattle={() => {
              rolloutScheduleRef.current = null;
              resetBattle();
            }}
            onSelectLayout={(nextLayout) => setLayout(nextLayout)}
            onSelectArmy={(nextArmy) => setArmy(nextArmy)}
            onGoToArmyBuilder={() => {
              setIsAiPlaying(false);
              setActiveTab('armory');
            }}
            onPlayTrainedRollout={playTrainedRollout}
          />
          {showTacticalDrawer && activeTab === 'ai_test' && (
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
