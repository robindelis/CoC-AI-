import React, { useEffect, useRef, useState } from 'react';
import {
  ArmyLoadout,
  BattleEngineState,
  FullCatalog,
  VillageLayout,
} from '../types';
import { UI_SPRITES } from '../assetsManifest';
import { BattlefieldCanvas, OverlayOptions } from '../canvas/BattlefieldCanvas';
import {
  fetchAIServerStatus,
  inspectAIPolicy,
  runAIDefenderEvolution,
  startAIPpoTraining,
  stopAIPpoTraining,
} from './aiClient';
import {
  AIEvolutionResult,
  AIInspectResponse,
  AIServerStatus,
  SLOT_TYPE_LABELS,
  SPATIAL_CHANNELS,
} from './aiTypes';

interface AIStudioViewProps {
  catalog: FullCatalog;
  layout: VillageLayout;
  army: ArmyLoadout;
  noDeployMask: boolean[][];
  battleState: BattleEngineState | null;
  overlays: OverlayOptions;
  isAiPlaying: boolean;
  simSpeed: number;
  selectedBattleEntity: { kind: 'building' | 'unit'; id: number } | null;
  selectionClickSeq: number;
  extractLocalObservation: () => number[] | null;
  onToggleOverlay: (key: keyof OverlayOptions) => void;
  onSelectBattleEntity: (entity: { kind: 'building' | 'unit'; id: number } | null) => void;
  onToggleAiPlay: () => void;
  onStepAiTick: () => void;
  onResetAiBattle: () => void;
  onSetSimSpeed: (speed: number) => void;
  onApplyEvolvedLayout: (nextLayout: VillageLayout) => void;
}

export const AIStudioView: React.FC<AIStudioViewProps> = ({
  catalog,
  layout,
  army,
  noDeployMask,
  battleState,
  overlays,
  isAiPlaying,
  simSpeed,
  selectedBattleEntity,
  selectionClickSeq,
  extractLocalObservation,
  onToggleOverlay,
  onSelectBattleEntity,
  onToggleAiPlay,
  onStepAiTick,
  onResetAiBattle,
  onSetSimSpeed,
  onApplyEvolvedLayout,
}) => {
  const [serverStatus, setServerStatus] = useState<AIServerStatus | null>(null);
  const [inspectData, setInspectData] = useState<AIInspectResponse | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<number>(0);
  const [episodes, setEpisodes] = useState<number>(20);
  const [lr, setLr] = useState<number>(0.0003);
  const [evolveGens, setEvolveGens] = useState<number>(3);
  const [isEvolving, setIsEvolving] = useState<boolean>(false);
  const [evolutionResult, setEvolutionResult] = useState<AIEvolutionResult | null>(
    null
  );

  const tensorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Poll Python AI Server status
  useEffect(() => {
    let active = true;
    const poll = async () => {
      const st = await fetchAIServerStatus();
      if (active) setServerStatus(st);
    };
    poll();
    const timer = window.setInterval(poll, 1500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // Fetch PyTorch policy inspection when layout/army changes and server is online
  useEffect(() => {
    if (!serverStatus?.online) return;
    inspectAIPolicy(JSON.stringify(layout), JSON.stringify(army)).then((res) => {
      if (res) setInspectData(res);
    });
  }, [serverStatus?.online, layout, army]);

  // Render the 50x50 Spatial Observation Tensor or Policy Tile Heatmap
  useEffect(() => {
    const canvas = tensorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    const cell = size / 50;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    let grid50x50: number[][] | null = null;
    if (selectedChannel === 8 && inspectData?.tile_heatmap) {
      grid50x50 = inspectData.tile_heatmap;
    } else {
      const localFlat = extractLocalObservation();
      if (localFlat && localFlat.length === 8 * 50 * 50) {
        const offset = selectedChannel * 2500;
        grid50x50 = Array.from({ length: 50 }, (_, y) =>
          Array.from({ length: 50 }, (_, x) => localFlat[offset + y * 50 + x])
        );
      } else if (inspectData?.channels?.[selectedChannel]) {
        grid50x50 = inspectData.channels[selectedChannel];
      }
    }

    if (!grid50x50) return;

    let maxVal = 0.0001;
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        if (grid50x50[y][x] > maxVal) maxVal = grid50x50[y][x];
      }
    }

    const chMeta =
      SPATIAL_CHANNELS.find((c) => c.id === selectedChannel) ?? SPATIAL_CHANNELS[0];

    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 50; x++) {
        const raw = grid50x50[y][x];
        const norm = selectedChannel === 8 ? raw / maxVal : Math.min(1, raw);
        if (norm <= 0.01) continue;
        ctx.globalAlpha = Math.max(0.15, norm);
        ctx.fillStyle = chMeta.color;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.globalAlpha = 1;
  }, [selectedChannel, battleState, inspectData, extractLocalObservation]);

  const handleStartTraining = async () => {
    await startAIPpoTraining({
      episodes,
      lr,
      ticks_per_step: 8,
      layoutJson: JSON.stringify(layout),
      armyJson: JSON.stringify(army),
    });
    const st = await fetchAIServerStatus();
    if (st) setServerStatus(st);
  };

  const handleStopTraining = async () => {
    await stopAIPpoTraining();
    const st = await fetchAIServerStatus();
    if (st) setServerStatus(st);
  };

  const handleEvolveBase = async () => {
    setIsEvolving(true);
    try {
      const res = await runAIDefenderEvolution({
        generations: evolveGens,
        populationSize: 12,
        baseLayoutJson: JSON.stringify(layout),
      });
      if (res) {
        setEvolutionResult(res);
      }
    } finally {
      setIsEvolving(false);
    }
  };

  const isTraining = Boolean(serverStatus?.training?.is_training);
  const history = serverStatus?.training?.history ?? [];

  return (
    <div className="ai-studio-workspace">
      {/* LEFT / CENTER: LIVE AI BATTLE SANDBOX */}
      <div className="ai-sandbox-stage">
        <BattlefieldCanvas
          mode="battle"
          catalog={catalog}
          layout={layout}
          noDeployMask={noDeployMask}
          battleState={battleState}
          overlays={overlays}
          onToggleOverlay={onToggleOverlay}
          selectedEditorTool={{ type: 'select' }}
          selectedBuildingInstanceId={null}
          selectedBattleEntity={selectedBattleEntity}
          selectionClickSeq={selectionClickSeq}
          deploySlot={{ kind: 'inspect' }}
          onTileAction={() => {}}
          onSelectBuildingInstance={() => {}}
          onSelectBattleEntity={onSelectBattleEntity}
        />

        {battleState && (
          <>
            <div className="hud-top-left">
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
                  <span className="damage-label">AI Destruction</span>
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

            <div className="hud-top-right">
              <div className="playback-pod">
                <button
                  className={`clash-btn ${isAiPlaying ? 'danger' : 'gold'}`}
                  onClick={onToggleAiPlay}
                >
                  {isAiPlaying ? '⏸ Pause AI' : '🤖 Run AI Attack'}
                </button>
                <button
                  className="clash-btn"
                  onClick={onStepAiTick}
                  disabled={isAiPlaying}
                >
                  ⏭ +1 AI Tick
                </button>
                <button className="clash-btn" onClick={onResetAiBattle}>
                  ↺ Reset
                </button>
              </div>

              <div className="speed-pills-row">
                <span>Speed:</span>
                {[1, 2, 4, 10].map((sp) => (
                  <button
                    key={sp}
                    className={`speed-pill-btn ${simSpeed === sp ? 'active' : ''}`}
                    onClick={() => onSetSimSpeed(sp)}
                  >
                    {sp}×
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* RIGHT: AI TELEMETRY, TENSOR INSPECTOR & GPU PPO TRAINER */}
      <aside className="ai-studio-sidebar">
        {/* 1. AI ENGINE STATUS */}
        <section className="ai-card">
          <div className="ai-card-header">
            <h3>AI Runtime</h3>
            <span
              className={`validation-pill ${
                serverStatus?.online ? 'valid' : 'invalid'
              }`}
            >
              {serverStatus?.online
                ? `🟢 ${serverStatus.device_name}`
                : '⚡ WASM Heuristic'}
            </span>
          </div>
          <div className="telemetry-kv-list">
            <div>
              <span>Model</span>
              <strong>CoCActorCritic (8×50×50)</strong>
            </div>
            <div>
              <span>Parameters</span>
              <strong>
                {serverStatus?.param_count
                  ? serverStatus.param_count.toLocaleString()
                  : '891,379'}
              </strong>
            </div>
            <div>
              <span>Best Checkpoint</span>
              <strong>
                {serverStatus?.checkpoint?.best_pct !== undefined
                  ? `${serverStatus.checkpoint.best_pct}% (${serverStatus.checkpoint.best_stars}★)`
                  : 'Untrained'}
              </strong>
            </div>
          </div>
        </section>

        {/* 2. SPATIAL OBSERVATION TENSOR & POLICY HEATMAP */}
        <section className="ai-card">
          <div className="ai-card-header">
            <h3>Spatial Tensor (50×50)</h3>
            <select
              className="clash-select"
              style={{ width: 'auto' }}
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(Number(e.target.value))}
            >
              {SPATIAL_CHANNELS.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ai-tensor-preview-row">
            <canvas
              ref={tensorCanvasRef}
              width={200}
              height={200}
              className="ai-tensor-canvas"
            />
            <div className="telemetry-kv-list" style={{ flex: 1 }}>
              <div>
                <span>Tick</span>
                <strong>#{battleState?.tick ?? 0}</strong>
              </div>
              <div>
                <span>Critic V(s)</span>
                <strong>
                  {inspectData ? inspectData.value.toFixed(2) : '—'}
                </strong>
              </div>
              <div>
                <span>Entropy H(π)</span>
                <strong>
                  {inspectData ? inspectData.entropy.toFixed(2) : '—'}
                </strong>
              </div>
              {inspectData && (
                <div>
                  <span>Top Action</span>
                  <strong>
                    {SLOT_TYPE_LABELS[inspectData.suggested_action.slot_type] ??
                      'NoOp'}{' '}
                    ({inspectData.suggested_action.tile_x},{' '}
                    {inspectData.suggested_action.tile_y})
                  </strong>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. PYTORCH GPU PPO TRAINER */}
        <section className="ai-card">
          <div className="ai-card-header">
            <h3>PPO Attacker Trainer</h3>
            {isTraining && (
              <span className="badge-gold">
                Ep {serverStatus?.training.current_episode}/
                {serverStatus?.training.total_episodes}
              </span>
            )}
          </div>

          <div className="ai-form-grid">
            <label>
              <span>Episodes</span>
              <input
                type="number"
                min={1}
                max={500}
                value={episodes}
                onChange={(e) => setEpisodes(Number(e.target.value))}
                className="clash-select"
              />
            </label>
            <label>
              <span>Learning Rate</span>
              <input
                type="number"
                step={0.0001}
                value={lr}
                onChange={(e) => setLr(Number(e.target.value))}
                className="clash-select"
              />
            </label>
          </div>

          <div className="ai-btn-row">
            {!isTraining ? (
              <button
                className="clash-btn gold"
                style={{ width: '100%' }}
                disabled={!serverStatus?.online}
                onClick={handleStartTraining}
              >
                🚀 Train PPO on GPU
              </button>
            ) : (
              <button
                className="clash-btn danger"
                style={{ width: '100%' }}
                onClick={handleStopTraining}
              >
                ⏹ Stop Training
              </button>
            )}
          </div>

          {history.length > 0 && (
            <div className="ai-history-list">
              {history.slice(-5).reverse().map((ep) => (
                <div key={ep.episode} className="ai-history-row">
                  <span>Ep {ep.episode}</span>
                  <span>
                    {ep.destruction_pct}% ({ep.stars}★)
                  </span>
                  <span>R: {ep.reward >= 0 ? `+${ep.reward}` : ep.reward}</span>
                  <span>{ep.fps_ticks} t/s</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. DEFENDER BASE EVOLUTION (RAYON MULTI-CORE) */}
        <section className="ai-card">
          <div className="ai-card-header">
            <h3>Defender Base Evolution</h3>
            <span className="badge-gold">{evolveGens} Gens × 12</span>
          </div>

          <div className="ai-btn-row">
            <input
              type="number"
              min={1}
              max={15}
              value={evolveGens}
              onChange={(e) => setEvolveGens(Number(e.target.value))}
              className="clash-select"
              style={{ width: '80px' }}
            />
            <button
              className="clash-btn green"
              style={{ flex: 1 }}
              disabled={!serverStatus?.online || isEvolving}
              onClick={handleEvolveBase}
            >
              {isEvolving ? '⏳ Evolving...' : '🧬 Evolve Anti-3★ Base'}
            </button>
          </div>

          {evolutionResult && (
            <div className="telemetry-kv-list" style={{ marginTop: '8px' }}>
              {evolutionResult.generations.map((g) => (
                <div key={g.generation}>
                  <span>Gen {g.generation}</span>
                  <strong>
                    Max Allowed: {g.best_attacker_pct}% ({g.best_attacker_stars}★) •
                    Fit {g.defense_fitness}
                  </strong>
                </div>
              ))}
              <button
                className="clash-btn gold"
                style={{ width: '100%', marginTop: '6px' }}
                onClick={() => onApplyEvolvedLayout(evolutionResult.best_layout)}
              >
                📥 Load Evolved Layout
              </button>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
};
