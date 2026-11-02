import React, { useEffect, useMemo, useState } from 'react';
import {
  applyRecursiveLoopSolution,
  configureRecursiveLoop,
  resetRecursiveLoop,
  restartRecursiveLoopNewArchitecture,
  runRecursiveLoopCycle,
  updateRecursiveLoopConfigParameters,
  verifyRecursiveLoopSolution,
} from './aiClient';
import {
  AICandidateSolution,
  AIFeedbackProviderId,
  AIRecursiveLoopCycle,
  AIRecursiveLoopState,
} from './aiTypes';

interface RecursiveLoopPanelProps {
  loopState: AIRecursiveLoopState | null;
  isTraining: boolean;
  currentCumulativeEp: number;
  onRefreshStatus: () => Promise<void>;
}

const CATEGORY_COLORS: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  architecture: {
    bg: 'rgba(168, 85, 247, 0.16)',
    border: '#a855f7',
    text: '#d8b4fe',
    label: 'ARCHITECTURE',
  },
  reward_function: {
    bg: 'rgba(250, 204, 21, 0.16)',
    border: '#facc15',
    text: '#fde047',
    label: 'REWARD SHAPING',
  },
  hyperparameters: {
    bg: 'rgba(56, 189, 248, 0.16)',
    border: '#38bdf8',
    text: '#7dd3fc',
    label: 'HYPERPARAMETERS',
  },
  combined: {
    bg: 'rgba(74, 222, 128, 0.16)',
    border: '#4ade80',
    text: '#86efac',
    label: 'COMBINED SYNERGY',
  },
  code_agent: {
    bg: 'rgba(249, 115, 22, 0.16)',
    border: '#f97316',
    text: '#fdba74',
    label: 'ARGON 4 CODE AGENT',
  },
  new_architecture_restart: {
    bg: 'rgba(236, 72, 153, 0.18)',
    border: '#ec4899',
    text: '#f9a8d4',
    label: 'STOP & RESTART NEW ARCH',
  },
};

const PIPELINE_STAGES = [
  { id: 'monitoring', num: 1, label: 'Episode-Horizon Telemetry Audit' },
  { id: 'analyzing', num: 2, label: 'Plateau & Strategy Diagnosis' },
  { id: 'documenting_baseline', num: 3, label: 'Pre-Change Snapshot' },
  { id: 'testing_solution', num: 4, label: 'Morph / Tune + Sync Visualizer' },
  { id: 'verifying_solution', num: 5, label: 'Verify & Vault Ledger' },
] as const;

export const RecursiveLoopPanel: React.FC<RecursiveLoopPanelProps> = ({
  loopState,
  isTraining,
  currentCumulativeEp,
  onRefreshStatus,
}) => {
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [snapshotTab, setSnapshotTab] = useState<
    'arch' | 'reward' | 'hyperparams' | 'telemetry'
  >('arch');
  const [paramEditorTab, setParamEditorTab] = useState<
    'arch' | 'reward' | 'hyperparams'
  >('arch');
  const [showParamEditor, setShowParamEditor] = useState<boolean>(true);
  const [editArch, setEditArch] = useState<Record<string, number | string | boolean>>({});
  const [editReward, setEditReward] = useState<Record<string, number>>({});
  const [editHyper, setEditHyper] = useState<Record<string, number>>({});
  const [paramSaveMsg, setParamSaveMsg] = useState<string | null>(null);
  const [checkedSolutionIds, setCheckedSolutionIds] = useState<string[]>([]);
  const [allowCodeAgent, setAllowCodeAgent] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const cycles = useMemo(() => loopState?.cycles ?? [], [loopState?.cycles]);

  useEffect(() => {
    if (cycles.length > 0 && selectedCycleId === null) {
      setSelectedCycleId(cycles[cycles.length - 1].cycle_id);
    }
  }, [cycles, selectedCycleId]);

  useEffect(() => {
    if (loopState?.active_config) {
      setEditArch({ ...(loopState.active_config.arch_config ?? {}) });
      setEditReward({ ...(loopState.active_config.reward_config ?? {}) });
      setEditHyper({ ...(loopState.active_config.hyperparams ?? {}) });
    }
  }, [loopState?.active_config]);

  const activeCycle: AIRecursiveLoopCycle | null = useMemo(() => {
    if (cycles.length === 0) return null;
    if (selectedCycleId !== null) {
      const found = cycles.find((c) => c.cycle_id === selectedCycleId);
      if (found) return found;
    }
    return cycles[cycles.length - 1];
  }, [cycles, selectedCycleId]);

  useEffect(() => {
    if (!activeCycle) return;
    const appliedIds =
      activeCycle.selected_solution?.selected_solution_ids ??
      (activeCycle.selected_solutions ?? []).map((s) => s.solution_id) ??
      (activeCycle.selected_solution?.solution_id
        ? [activeCycle.selected_solution.solution_id]
        : []);
    if (appliedIds.length > 0) {
      setCheckedSolutionIds(appliedIds);
      return;
    }
    const recIds = activeCycle.recommended_solution_ids ?? [];
    if (recIds.length > 0) {
      setCheckedSolutionIds(recIds);
      return;
    }
    if (activeCycle.candidate_solutions.length > 0) {
      setCheckedSolutionIds([activeCycle.candidate_solutions[0].solution_id]);
    }
  }, [activeCycle]);

  const enabled = Boolean(loopState?.enabled);
  const testEps = loopState?.test_episodes_per_cycle ?? 5000;
  const epsUntilNext =
    loopState?.episodes_until_next_cycle ??
    Math.max(
      0,
      (loopState?.next_cycle_target_episode ?? testEps) - currentCumulativeEp
    );
  const nextTargetEp =
    loopState?.next_cycle_target_episode ?? currentCumulativeEp + epsUntilNext;
  const provider: AIFeedbackProviderId =
    loopState?.provider ?? 'opencode_argon';
  const phase = loopState?.phase ?? 'idle';
  const activeHyp = loopState?.active_hypothesis ?? null;
  const activeArchCfg = loopState?.active_config?.arch_config ?? {};
  const activeGen = Number(activeArchCfg.generation ?? 0);
  const activeArchVersion = String(
    activeArchCfg.arch_version ?? 'v4.0-Gen0-TinyCNN'
  );
  const activeBackbone = String(activeArchCfg.backbone_type ?? 'tiny_cnn');
  const activeWeightMode = String(
    activeArchCfg.weight_transfer_mode ?? 'scratch_restart'
  );
  const latestStrategy =
    activeCycle?.strategy_research ?? loopState?.latest_strategy_research ?? null;
  const lastVizSync = loopState?.last_model_visualizer_sync ?? null;
  const liveTelemetry =
    loopState?.live_telemetry_compact ??
    activeCycle?.pre_change_snapshot?.baseline_metrics ??
    null;

  const activeStageIndex = useMemo(() => {
    if (phase === 'analyzing') return 1;
    if (phase === 'documenting_baseline') return 2;
    if (phase === 'applying_solution' || phase === 'testing_solution') return 3;
    if (phase === 'verifying_solution') return 4;
    if (activeHyp) return 3;
    return 0;
  }, [phase, activeHyp]);

  const handleToggleLoop = async () => {
    setIsBusy(true);
    try {
      await configureRecursiveLoop({ enabled: !enabled });
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleTestEpsChange = async (nextEps: number) => {
    const clamped = Math.max(12, Math.min(20000, nextEps));
    await configureRecursiveLoop({ test_episodes_per_cycle: clamped });
    await onRefreshStatus();
  };

  const handleProviderChange = async (nextProv: AIFeedbackProviderId) => {
    await configureRecursiveLoop({ provider: nextProv });
    await onRefreshStatus();
  };

  const handleSaveEditedParameters = async (runCodeAgent: boolean) => {
    setIsBusy(true);
    setParamSaveMsg(null);
    try {
      await updateRecursiveLoopConfigParameters({
        arch_config: editArch,
        reward_config: editReward,
        hyperparams: editHyper,
        run_code_agent: runCodeAgent,
        reason: runCodeAgent
          ? 'manual_parameter_and_argon4_morph'
          : 'manual_parameter_studio_update',
      });
      setParamSaveMsg(
        runCodeAgent
          ? '✅ Applied parameters, triggered OpenCode Argon 4 morph, and started model-visualizer agent!'
          : '✅ Applied parameters & automatically synced model-visualizer in Model Trainer!'
      );
      setTimeout(() => setParamSaveMsg(null), 5000);
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunCycleNow = async (autoTest: boolean) => {
    setIsBusy(true);
    try {
      const res = await runRecursiveLoopCycle({
        auto_test: autoTest,
        use_llm: true,
        trigger: 'manual_trigger',
      });
      if (res && res.cycles.length > 0) {
        setSelectedCycleId(res.cycles[res.cycles.length - 1].cycle_id);
      }
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetLoop = async () => {
    if (cycles.length > 0) {
      const ok = window.confirm(
        'Reset recursive loop history and restore default baseline configuration?'
      );
      if (!ok) return;
    }
    setIsBusy(true);
    try {
      await resetRecursiveLoop();
      setSelectedCycleId(null);
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleSolutionCheck = (solId: string) => {
    setCheckedSolutionIds((prev) =>
      prev.includes(solId)
        ? prev.filter((id) => id !== solId)
        : [...prev, solId]
    );
  };

  const handleApplyCandidate = async (
    cycleId: number,
    sol: AICandidateSolution
  ) => {
    setIsBusy(true);
    try {
      await applyRecursiveLoopSolution({
        cycle_id: cycleId,
        solution_ids: [sol.solution_id],
        run_code_agent: allowCodeAgent,
        auto_test: true,
        test_episodes: testEps,
      });
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleApplyCheckedSolutions = async (cycleId: number) => {
    if (checkedSolutionIds.length === 0) return;
    setIsBusy(true);
    try {
      await applyRecursiveLoopSolution({
        cycle_id: cycleId,
        solution_ids: checkedSolutionIds,
        run_code_agent: allowCodeAgent,
        auto_test: true,
        test_episodes: testEps,
      });
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleVerifyNow = async () => {
    setIsBusy(true);
    try {
      await verifyRecursiveLoopSolution();
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleRestartWithNewArchitecture = async () => {
    setIsBusy(true);
    try {
      const res = await restartRecursiveLoopNewArchitecture({
        run_code_agent: allowCodeAgent,
        use_llm: true,
      });
      if (res && res.cycles.length > 0) {
        setSelectedCycleId(res.cycles[res.cycles.length - 1].cycle_id);
      }
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const snap = activeCycle?.pre_change_snapshot;
  const bm = snap?.baseline_metrics;
  const hv = activeCycle?.health_verdict;
  const ver = activeCycle?.verification_result;

  const testProgressPct = useMemo(() => {
    if (!activeHyp) return 0;
    const done = Math.max(0, currentCumulativeEp - activeHyp.baseline_episode);
    return Math.min(
      100,
      Math.round((done / Math.max(1, activeHyp.target_episodes)) * 100)
    );
  }, [activeHyp, currentCumulativeEp]);

  return (
    <div className="rl-loop-container">
      {/* 1. TOP CONTROL & 5-STAGE PIPELINE STEPPER BAR */}
      <section className="ai-card rl-loop-header-card">
        <div className="rl-loop-top-row">
          <div className="rl-loop-title-group">
            <button
              type="button"
              className={`clash-btn ${
                enabled && isTraining ? 'green' : 'gold'
              }`}
              disabled={isBusy}
              onClick={() => void handleToggleLoop()}
            >
              {enabled
                ? isTraining
                  ? `🟢 Auto-Evolution Active (${epsUntilNext.toLocaleString()} eps to Ep ${nextTargetEp.toLocaleString()})`
                  : `⏸ Auto-Evolution Armed (Next at Ep ${nextTargetEp.toLocaleString()} • ${epsUntilNext.toLocaleString()} eps left)`
                : '▶️ Enable Episode-Horizon Auto-Evolution'}
            </button>

            <div className="rl-loop-pill-group">
              <span className="rl-loop-meta-chip">
                <span>Active Model</span>
                <code>
                  Gen {activeGen} • {activeArchVersion} ({activeBackbone})
                </code>
              </span>

              <span className="rl-loop-meta-chip">
                <span>Weight Mode</span>
                <code>
                  {activeWeightMode === 'warm_start'
                    ? 'Warm-Start Transfer'
                    : 'Scratch Restart'}
                </code>
              </span>

              <span className="rl-loop-meta-chip">
                <span>Evolution Horizon</span>
                <select
                  className="rl-inline-select"
                  value={testEps}
                  onChange={(e) =>
                    void handleTestEpsChange(Number(e.target.value))
                  }
                >
                  <option value={300}>Every 300 Eps</option>
                  <option value={1000}>Every 1,000 Eps</option>
                  <option value={2500}>Every 2,500 Eps</option>
                  <option value={5000}>Every 5,000 Eps (Gen Horizon)</option>
                  <option value={10000}>Every 10,000 Eps</option>
                </select>
              </span>

              <span
                className="rl-loop-meta-chip"
                title={
                  lastVizSync
                    ? `Triggered model-visualizer (${lastVizSync.agent} • ${lastVizSync.model}) at ${lastVizSync.synced_at} (${lastVizSync.reason})`
                    : 'Automatically starts model-visualizer agent on every model or arch_config change'
                }
              >
                <span>Model Visualizer</span>
                <code style={{ color: '#e9d5ff' }}>
                  🎨 {lastVizSync ? `Synced ${lastVizSync.synced_at} (${lastVizSync.total_params.toLocaleString()}p)` : 'Auto-Sync Active'}
                </code>
              </span>

              <span className="rl-loop-meta-chip">
                <span>Vault Dossiers</span>
                <code>
                  SOTA_Vision_And_Spatial_RL • CoC_Strategy_Concepts • Evolution_Ledger
                </code>
              </span>
            </div>
          </div>

          <div className="rl-loop-actions-group">
            <div className="ai-provider-toggle" role="group">
              <button
                type="button"
                className={`ai-provider-btn ${
                  provider === 'opencode_argon' ? 'active' : ''
                }`}
                onClick={() => void handleProviderChange('opencode_argon')}
              >
                Argon 4 • OpenCode
              </button>
              <button
                type="button"
                className={`ai-provider-btn ${
                  provider === 'agy_flash' ? 'active' : ''
                }`}
                onClick={() => void handleProviderChange('agy_flash')}
              >
                Flash 3.8 • AGY
              </button>
            </div>

            <button
              type="button"
              className="clash-btn"
              onClick={() => setShowParamEditor((v) => !v)}
              title="Toggle Live Parameter & Architecture Studio with Telemetry Data"
            >
              {showParamEditor ? '🎛️ Hide Parameter Studio' : '🎛️ Parameter & Arch Studio'}
            </button>

            <button
              type="button"
              className="clash-btn"
              disabled={isBusy || Boolean(loopState?.is_running_cycle)}
              onClick={() => void handleRunCycleNow(false)}
            >
              {isBusy || loopState?.is_running_cycle
                ? '⟳ Running...'
                : '📸 Snapshot & Diagnose'}
            </button>

            <button
              type="button"
              className="clash-btn gold"
              disabled={isBusy || Boolean(loopState?.is_running_cycle)}
              onClick={() => void handleRunCycleNow(true)}
            >
              ⚡ Run Full Cycle (Snapshot → Fix → Test)
            </button>

            <button
              type="button"
              className="clash-btn"
              style={{
                borderColor: '#ec4899',
                color: '#f9a8d4',
                background: 'rgba(236, 72, 153, 0.16)',
              }}
              disabled={isBusy || Boolean(loopState?.is_running_cycle)}
              onClick={() => void handleRestartWithNewArchitecture()}
              title="Morph model to the next SOTA Vision Generation via AGY CoC Strategy Research + OpenCode Argon 4 and update model-visualizer"
            >
              🧬 Morph Next Arch Gen (Argon 4 + AGY)
            </button>

            <button
              type="button"
              className="clash-btn"
              style={{
                borderColor: '#64748b',
                color: '#94a3b8',
                background: 'rgba(100, 116, 139, 0.12)',
              }}
              disabled={isBusy || Boolean(loopState?.is_running_cycle)}
              onClick={() => void handleResetLoop()}
              title="Reset diagnostic history and restore default Gen 0 TinyCNN baseline parameters"
            >
              🧹 Reset History
            </button>

            {activeHyp && (
              <button
                type="button"
                className="clash-btn green"
                disabled={isBusy}
                onClick={() => void handleVerifyNow()}
              >
                ✅ Verify Now
              </button>
            )}
          </div>
        </div>

        {/* 5-STAGE PIPELINE STEPPER */}
        <div className="rl-pipeline-stepper">
          {PIPELINE_STAGES.map((st, idx) => {
            const isCurrent = idx === activeStageIndex;
            const isDone = idx < activeStageIndex;
            return (
              <div
                key={st.id}
                className={`rl-pipeline-step ${
                  isCurrent ? 'current' : isDone ? 'done' : ''
                }`}
              >
                <span className="rl-step-num">{isDone ? '✓' : st.num}</span>
                <span className="rl-step-lbl">{st.label}</span>
              </div>
            );
          })}
        </div>

        {latestStrategy && (
          <div
            style={{
              marginTop: 8,
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid rgba(56, 189, 248, 0.35)',
              background: 'rgba(15, 23, 42, 0.75)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: '#38bdf8' }}>
                ⚔️ AGY CoC Strategy &amp; I/O Research ({latestStrategy.model}) — {latestStrategy.tactical_focus}
              </strong>
              <code style={{ fontSize: 11, color: '#94a3b8' }}>
                {latestStrategy.vault_reference}
              </code>
            </div>
            <span style={{ color: '#cbd5e1' }}>{latestStrategy.summary}</span>
          </div>
        )}

        {/* ACTIVE HYPOTHESIS UNDER TEST BANNER */}
        {activeHyp && (
          <div className="rl-active-test-banner">
            <div className="rl-active-test-left">
              <span className="rl-testing-badge">
                {isTraining ? '🧪 TESTING SOLUTION LIVE' : '🧪 SOLUTION APPLIED'}
              </span>
              <strong>
                Cycle #{activeHyp.cycle_id}: {activeHyp.solution.title}
              </strong>
              <span className="rl-diff-inline">
                {(activeHyp.solution.diff_summary ?? []).slice(0, 3).join(' • ')}
              </span>
            </div>
            <div className="rl-active-test-right">
              <span>
                Ep {activeHyp.baseline_episode} → {currentCumulativeEp} (Target +
                {activeHyp.target_episodes} Eps • {testProgressPct}%)
              </span>
              <div className="rl-test-progress-track">
                <div
                  className="rl-test-progress-fill"
                  style={{ width: `${testProgressPct}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 1B. LIVE TELEMETRY & INTERACTIVE PARAMETER / ARCHITECTURE STUDIO */}
      {showParamEditor && (
        <section className="ai-card" style={{ marginBottom: 12 }}>
          <div className="ai-card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h3>
                🎛️ Live Telemetry &amp; Parameter Tuning Studio (Arch • Reward • Hyperparams)
              </h3>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(168, 85, 247, 0.16)',
                  border: '1px solid #a855f7',
                  color: '#e9d5ff',
                  fontWeight: 700,
                }}
              >
                🎨 Auto-Starts model-visualizer on Model Change
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {paramSaveMsg && (
                <span style={{ fontSize: '0.76rem', color: '#4ade80', fontWeight: 700 }}>
                  {paramSaveMsg}
                </span>
              )}
              <button
                type="button"
                className="clash-btn green"
                disabled={isBusy}
                onClick={() => void handleSaveEditedParameters(false)}
                title="Save all edited Architecture, Reward, and PPO Hyperparameters and start model-visualizer to update Model Trainer"
              >
                💾 Apply Parameters (+ Sync Model Visualizer)
              </button>
              <button
                type="button"
                className="clash-btn gold"
                disabled={isBusy}
                onClick={() => void handleSaveEditedParameters(true)}
                title="Save parameters, invoke OpenCode Argon 4 on networks.py, and start model-visualizer"
              >
                🧬 Apply + Run Argon 4 Morph (+ Sync Visualizer)
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.85fr',
              gap: 12,
              alignItems: 'start',
            }}
          >
            {/* LEFT: LIVE TELEMETRY DATA SUMMARY */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid #1e293b',
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <strong style={{ fontSize: '0.8rem', color: '#38bdf8' }}>
                  📊 Live Telemetry Data (Ep {currentCumulativeEp.toLocaleString()})
                </strong>
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                  Next Auto-Cycle: Ep {nextTargetEp.toLocaleString()}
                </span>
              </div>
              {liveTelemetry ? (
                <div className="rl-kv-grid">
                  <div className="rl-kv-item">
                    <span>Mean Destr (300-Ep)</span>
                    <strong style={{ color: '#fde047' }}>
                      {liveTelemetry.mean_pct_50.toFixed(1)}%
                      {liveTelemetry.sem_pct_300 !== undefined
                        ? ` ± ${liveTelemetry.sem_pct_300.toFixed(2)}%`
                        : ''}
                    </strong>
                  </div>
                  <div className="rl-kv-item">
                    <span>Destr Slope / 100ep</span>
                    <strong
                      style={{
                        color:
                          liveTelemetry.pct_slope_per_100ep >= 0.35
                            ? '#4ade80'
                            : '#f97316',
                      }}
                    >
                      {liveTelemetry.pct_slope_per_100ep >= 0 ? '+' : ''}
                      {liveTelemetry.pct_slope_per_100ep}%
                    </strong>
                  </div>
                  <div className="rl-kv-item">
                    <span>2★ TH18 / 3★ Triple</span>
                    <strong>
                      {liveTelemetry.two_star_th_rate_50.toFixed(1)}% /{' '}
                      {liveTelemetry.three_star_triple_rate_50.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="rl-kv-item">
                    <span>Explained Var / KL</span>
                    <strong>
                      {liveTelemetry.explained_var_50.toFixed(1)}% /{' '}
                      {liveTelemetry.approx_kl_50.toFixed(4)}
                    </strong>
                  </div>
                  <div className="rl-kv-item">
                    <span>Joint / Tile Entropy</span>
                    <strong>
                      {liveTelemetry.entropy_50.toFixed(2)} /{' '}
                      {liveTelemetry.h_tile_50.toFixed(2)} nats
                    </strong>
                  </div>
                  <div className="rl-kv-item">
                    <span>NoOp % / Worst Base</span>
                    <strong>
                      {liveTelemetry.noop_pct_50.toFixed(1)}% •{' '}
                      {liveTelemetry.worst_village?.name ?? '—'} (
                      {liveTelemetry.worst_village?.recent_avg_pct ?? 0}%)
                    </strong>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '8px 0' }}>
                  Start training or select a checkpoint to populate live rolling telemetry metrics alongside parameter controls.
                </div>
              )}
            </div>

            {/* RIGHT: INTERACTIVE PARAMETER TABS (ARCH / REWARD / HYPERPARAMS) */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid #1e293b',
                borderRadius: 8,
                padding: 10,
              }}
            >
              <div className="rl-subtab-bar" style={{ marginBottom: 8 }}>
                {(
                  [
                    ['arch', '🧬 Architecture (Gen 0..5 & Heads)'],
                    ['reward', '🏆 Reward Shaping Weights'],
                    ['hyperparams', '⚡ PPO Hyperparameters'],
                  ] as const
                ).map(([tid, lbl]) => (
                  <button
                    key={tid}
                    type="button"
                    className={`tb-mini-btn ${paramEditorTab === tid ? 'active' : ''}`}
                    onClick={() => setParamEditorTab(tid)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {paramEditorTab === 'arch' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                    gap: 8,
                  }}
                >
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
                    <span style={{ color: '#94a3b8' }}>generation (0..5)</span>
                    <select
                      className="clash-select"
                      value={Number(editArch.generation ?? 0)}
                      onChange={(e) => {
                        const g = Number(e.target.value);
                        const presetBackbones: Record<number, { ver: string; bb: string; sDim: number; eDim: number; blocks: number }> = {
                          0: { ver: 'v4.0-Gen0-TinyCNN', bb: 'tiny_cnn', sDim: 32, eDim: 128, blocks: 0 },
                          1: { ver: 'v4.1-Gen1-CoordDilatedCNN', bb: 'coord_dilated_cnn', sDim: 48, eDim: 160, blocks: 2 },
                          2: { ver: 'v4.2-Gen2-ConvNeXtV2-GRN', bb: 'convnext_v2_grn', sDim: 64, eDim: 192, blocks: 3 },
                          3: { ver: 'v4.3-Gen3-SegNeXt-MSCA-UNet', bb: 'segnext_msca_unet', sDim: 96, eDim: 256, blocks: 3 },
                          4: { ver: 'v4.4-Gen4-UniRepLKNet-HRNet', bb: 'unireplk_hrnet', sDim: 128, eDim: 256, blocks: 4 },
                          5: { ver: 'v4.5-Gen5-HybridSwinV2-Pointer', bb: 'swin_v2_pointer', sDim: 128, eDim: 256, blocks: 4 },
                        };
                        const p = presetBackbones[g] ?? presetBackbones[0];
                        setEditArch((prev) => ({
                          ...prev,
                          generation: g,
                          arch_version: p.ver,
                          backbone_type: p.bb,
                          spatial_dim: p.sDim,
                          embed_dim: p.eDim,
                          num_res_blocks: p.blocks,
                          use_coord_conv: g >= 1,
                          use_convnext_grn: g >= 2,
                          use_msca_strip_attn: g >= 3,
                          use_large_kernel_9x9: g >= 4,
                        }));
                      }}
                    >
                      <option value={0}>Gen 0 • TinyCNN (~50K)</option>
                      <option value={1}>Gen 1 • CoordDilatedCNN (~140K)</option>
                      <option value={2}>Gen 2 • ConvNeXtV2-GRN (~380K)</option>
                      <option value={3}>Gen 3 • SegNeXt-MSCA-UNet (~850K)</option>
                      <option value={4}>Gen 4 • UniRepLKNet-HRNet (~1.6M)</option>
                      <option value={5}>Gen 5 • SwinV2-Pointer (~2.4M)</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
                    <span style={{ color: '#94a3b8' }}>backbone_type</span>
                    <select
                      className="clash-select"
                      value={String(editArch.backbone_type ?? 'tiny_cnn')}
                      onChange={(e) =>
                        setEditArch((prev) => ({ ...prev, backbone_type: e.target.value }))
                      }
                    >
                      <option value="tiny_cnn">tiny_cnn</option>
                      <option value="coord_dilated_cnn">coord_dilated_cnn</option>
                      <option value="convnext_v2_grn">convnext_v2_grn</option>
                      <option value="segnext_msca_unet">segnext_msca_unet</option>
                      <option value="unireplk_hrnet">unireplk_hrnet</option>
                      <option value="swin_v2_pointer">swin_v2_pointer</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>
                    <span style={{ color: '#94a3b8' }}>weight_transfer_mode</span>
                    <select
                      className="clash-select"
                      value={String(editArch.weight_transfer_mode ?? 'scratch_restart')}
                      onChange={(e) =>
                        setEditArch((prev) => ({
                          ...prev,
                          weight_transfer_mode: e.target.value,
                        }))
                      }
                    >
                      <option value="scratch_restart">scratch_restart</option>
                      <option value="warm_start">warm_start (Net2Net slice)</option>
                    </select>
                  </label>

                  {(
                    [
                      ['spatial_dim', 16, 256, 8],
                      ['embed_dim', 64, 512, 32],
                      ['num_res_blocks', 0, 8, 1],
                      ['logit_cap_type', 0.5, 5.0, 0.1],
                      ['logit_cap_idx', 0.5, 5.0, 0.1],
                      ['logit_cap_frac', 0.5, 5.0, 0.1],
                      ['logit_cap_tile', 0.5, 6.0, 0.1],
                      ['spatial_prior_scale', 0.0, 2.0, 0.05],
                      ['spell_edge_suppress_Penalty', -6.0, 0.0, 0.25],
                    ] as const
                  ).map(([key, minV, maxV, stepV]) => (
                    <label
                      key={key}
                      style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}
                    >
                      <span style={{ color: '#94a3b8' }}>{key}</span>
                      <input
                        type="number"
                        className="clash-select"
                        min={minV}
                        max={maxV}
                        step={stepV}
                        value={Number(editArch[key] ?? 0)}
                        onChange={(e) =>
                          setEditArch((prev) => ({
                            ...prev,
                            [key]: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              {paramEditorTab === 'reward' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                    gap: 8,
                  }}
                >
                  {Object.entries(editReward).map(([k, v]) => (
                    <label
                      key={k}
                      style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}
                    >
                      <span style={{ color: '#94a3b8' }}>{k}</span>
                      <input
                        type="number"
                        step="any"
                        className="clash-select"
                        value={Number(v)}
                        onChange={(e) =>
                          setEditReward((prev) => ({
                            ...prev,
                            [k]: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              {paramEditorTab === 'hyperparams' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                    gap: 8,
                  }}
                >
                  {Object.entries(editHyper).map(([k, v]) => (
                    <label
                      key={k}
                      style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}
                    >
                      <span style={{ color: '#94a3b8' }}>{k}</span>
                      <input
                        type="number"
                        step="any"
                        className="clash-select"
                        value={Number(v)}
                        onChange={(e) =>
                          setEditHyper((prev) => ({
                            ...prev,
                            [k]: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 2. CYCLE SELECTOR STRIP */}
      {cycles.length > 0 && (
        <div className="rl-cycle-selector-strip">
          {cycles.map((c) => {
            const isSel = activeCycle?.cycle_id === c.cycle_id;
            const v = c.verification_result?.verdict;
            const badgeColor =
              v === 'SOLVED' || v === 'IMPROVED'
                ? '#4ade80'
                : v === 'NOT_SOLVED_ROLLED_BACK'
                ? '#f87171'
                : c.selected_solution
                ? '#38bdf8'
                : '#facc15';
            return (
              <button
                key={c.cycle_id}
                type="button"
                className={`rl-cycle-tab-btn ${isSel ? 'active' : ''}`}
                onClick={() => setSelectedCycleId(c.cycle_id)}
              >
                <i
                  className="tb-series-dot"
                  style={{ background: badgeColor }}
                />
                <span>
                  Cycle #{c.cycle_id} • Ep {c.episode_at_analysis}
                </span>
                <small style={{ color: badgeColor, fontWeight: 800 }}>
                  {v ?? (c.selected_solution ? 'TESTING' : c.health_verdict.status.toUpperCase())}
                </small>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. THREE-COLUMN ACTIVE CYCLE WORKBENCH */}
      {activeCycle && snap && bm && hv ? (
        <div className="rl-three-col-grid">
          {/* COLUMN 1: MANDATORY PRE-CHANGE BASELINE SNAPSHOT */}
          <section className="ai-card rl-col-card">
            <div className="ai-card-header">
              <h3>
                📸 1. Pre-Change Baseline Snapshot (Cycle #{activeCycle.cycle_id})
              </h3>
              <span className="ai-feedback-meta-tag">
                Commit {snap.git_commit} • Ep {snap.cumulative_episode}
              </span>
            </div>

            <div className="rl-subtab-bar">
              {(
                [
                  ['arch', 'Architecture'],
                  ['reward', 'Reward Fn'],
                  ['hyperparams', 'Hyperparams'],
                  ['telemetry', 'Baseline Stats'],
                ] as const
              ).map(([tid, lbl]) => (
                <button
                  key={tid}
                  type="button"
                  className={`tb-mini-btn ${snapshotTab === tid ? 'active' : ''}`}
                  onClick={() => setSnapshotTab(tid)}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {snapshotTab === 'arch' && (
              <div className="rl-kv-grid">
                {Object.entries(snap.arch_config).map(([k, v]) => (
                  <div key={k} className="rl-kv-item">
                    <span>{k}</span>
                    <strong>{String(v)}</strong>
                  </div>
                ))}
              </div>
            )}

            {snapshotTab === 'reward' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <code className="rl-formula-box">{snap.reward_formula}</code>
                <div className="rl-kv-grid">
                  {Object.entries(snap.reward_config).map(([k, v]) => (
                    <div key={k} className="rl-kv-item">
                      <span>{k}</span>
                      <strong>{String(v)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {snapshotTab === 'hyperparams' && (
              <div className="rl-kv-grid">
                {Object.entries(snap.hyperparams).map(([k, v]) => (
                  <div key={k} className="rl-kv-item">
                    <span>{k}</span>
                    <strong>{String(v)}</strong>
                  </div>
                ))}
              </div>
            )}

            {snapshotTab === 'telemetry' && (
              <div className="rl-kv-grid">
                <div className="rl-kv-item">
                  <span>Mean Destr (300-Ep)</span>
                  <strong style={{ color: '#fde047' }}>
                    {bm.mean_pct_50.toFixed(1)}%
                    {bm.sem_pct_300 !== undefined ? ` ± ${bm.sem_pct_300.toFixed(2)}%` : ''}
                  </strong>
                </div>
                <div className="rl-kv-item">
                  <span>300-Ep Peak</span>
                  <strong>
                    {bm.rolling50_peak_pct.toFixed(1)}% ({bm.episodes_since_peak}{' '}
                    eps ago)
                  </strong>
                </div>
                <div className="rl-kv-item">
                  <span>Destr Slope / 100ep</span>
                  <strong
                    style={{
                      color:
                        bm.pct_slope_per_100ep >= 0.35 ? '#4ade80' : '#f97316',
                    }}
                  >
                    {bm.pct_slope_per_100ep >= 0
                      ? `+${bm.pct_slope_per_100ep}`
                      : bm.pct_slope_per_100ep}
                    %
                  </strong>
                </div>
                <div className="rl-kv-item">
                  <span>2★+ TH18 / 3★ Rate</span>
                  <strong>
                    {bm.two_star_th_rate_50.toFixed(1)}% /{' '}
                    {bm.three_star_triple_rate_50.toFixed(1)}%
                  </strong>
                </div>
                <div className="rl-kv-item">
                  <span>Funnel P(2★|1★) → P(3★|2★)</span>
                  <strong>
                    {bm.star_funnel.p_2star_given_1star_pct}% →{' '}
                    {bm.star_funnel.p_3star_given_2star_pct}%
                  </strong>
                </div>
                <div className="rl-kv-item">
                  <span>Worst Village</span>
                  <strong style={{ color: '#f87171' }}>
                    {bm.worst_village.name} ({bm.worst_village.recent_avg_pct}%)
                  </strong>
                </div>
                <div className="rl-kv-item">
                  <span>Critic V(s₀) / Gap</span>
                  <strong>
                    {bm.critic_v_s0.toFixed(1)} (Δ {bm.calibration_gap.toFixed(1)})
                  </strong>
                </div>
                <div className="rl-kv-item">
                  <span>Explained Var / KL</span>
                  <strong>
                    {(bm.explained_variance_50 * 100).toFixed(1)}% /{' '}
                    {bm.approx_kl_50.toFixed(4)}
                  </strong>
                </div>
              </div>
            )}
          </section>

          {/* COLUMN 2: HEALTH VERDICT & ROOT-CAUSE PLATEAU DIAGNOSIS */}
          <section className="ai-card rl-col-card">
            <div className="ai-card-header">
              <h3>🩺 2. Plateau &amp; Root-Cause Diagnosis</h3>
              <span
                className="ai-health-badge"
                style={{
                  background: !hv.is_plateaued
                    ? 'rgba(34, 197, 94, 0.16)'
                    : 'rgba(245, 158, 11, 0.16)',
                  borderColor: !hv.is_plateaued ? '#22c55e' : '#f59e0b',
                  color: !hv.is_plateaued ? '#4ade80' : '#fbbf24',
                }}
              >
                {hv.status.toUpperCase()} • {hv.health_score}/100
              </span>
            </div>

            <div className="ai-feedback-verdict">
              <strong>{hv.headline}</strong>
              <p>{hv.progression_summary}</p>
            </div>

            <div className="ai-feedback-issues-list">
              {hv.reasons.map((r, idx) => {
                const catStyle =
                  CATEGORY_COLORS[r.category] ?? CATEGORY_COLORS.combined;
                return (
                  <div
                    key={idx}
                    className="ai-feedback-issue-card"
                    style={{
                      borderLeftColor:
                        r.severity === 'critical'
                          ? '#ef4444'
                          : r.severity === 'warning'
                          ? '#f59e0b'
                          : '#38bdf8',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 6,
                      }}
                    >
                      <strong style={{ fontSize: '0.78rem', color: '#f8fafc' }}>
                        {r.title}
                      </strong>
                      <span
                        className="rl-cat-chip"
                        style={{
                          background: catStyle.bg,
                          borderColor: catStyle.border,
                          color: catStyle.text,
                        }}
                      >
                        {catStyle.label}
                      </span>
                    </div>
                    <div className="ai-issue-row">
                      <span className="ai-issue-tag">Stat</span>
                      <span>{r.symptom}</span>
                    </div>
                    <div className="ai-issue-row">
                      <span className="ai-issue-tag cause">Why</span>
                      <span>{r.root_cause}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* COLUMN 3: CANDIDATE SOLUTIONS (MULTI-SELECT + ARGON 4 CODE AGENT) */}
          <section className="ai-card rl-col-card">
            <div className="ai-card-header">
              <h3>
                🧪 3. Proposed Solutions ({activeCycle.candidate_solutions.length})
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.68rem',
                    color: '#fdba74',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={allowCodeAgent}
                    onChange={(e) => setAllowCodeAgent(e.target.checked)}
                  />
                  🤖 Argon 4 Code Agent
                </label>

                <button
                  type="button"
                  className="clash-btn gold"
                  style={{ padding: '3px 9px', fontSize: '0.7rem' }}
                  disabled={isBusy || checkedSolutionIds.length === 0}
                  onClick={() =>
                    void handleApplyCheckedSolutions(activeCycle.cycle_id)
                  }
                >
                  🚀 Apply &amp; Test Selected ({checkedSolutionIds.length})
                </button>
              </div>
            </div>

            <div className="rl-solutions-list">
              {activeCycle.candidate_solutions.map((sol) => {
                const appliedSet = new Set(
                  activeCycle.selected_solution?.selected_solution_ids ??
                    (activeCycle.selected_solutions ?? []).map(
                      (s) => s.solution_id
                    ) ??
                    (activeCycle.selected_solution?.solution_id
                      ? [activeCycle.selected_solution.solution_id]
                      : [])
                );
                const isSelected = appliedSet.has(sol.solution_id);
                const isChecked = checkedSolutionIds.includes(sol.solution_id);
                const catStyle =
                  CATEGORY_COLORS[sol.category] ?? CATEGORY_COLORS.combined;

                return (
                  <div
                    key={sol.solution_id}
                    className={`rl-solution-card ${isSelected ? 'selected' : ''}`}
                    style={{
                      borderColor: isSelected
                        ? '#4ade80'
                        : isChecked
                        ? '#facc15'
                        : '#253654',
                    }}
                  >
                    <div className="rl-sol-top">
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            handleToggleSolutionCheck(sol.solution_id)
                          }
                          style={{ cursor: 'pointer' }}
                        />
                        <span className="rl-rank-badge">#{sol.rank}</span>
                        <span
                          className="rl-cat-chip"
                          style={{
                            background: catStyle.bg,
                            borderColor: catStyle.border,
                            color: catStyle.text,
                          }}
                        >
                          {catStyle.label}
                        </span>
                        {sol.requires_restart_from_scratch && (
                          <span
                            className="rl-cat-chip"
                            style={{
                              background: 'rgba(236, 72, 153, 0.2)',
                              borderColor: '#ec4899',
                              color: '#f9a8d4',
                            }}
                          >
                            🔄 RESTART FROM SCRATCH
                          </span>
                        )}
                        {sol.requires_code_edit && (
                          <span
                            className="rl-cat-chip"
                            style={{
                              background: 'rgba(249, 115, 22, 0.18)',
                              borderColor: '#f97316',
                              color: '#fdba74',
                            }}
                          >
                            🤖 OpenCode Argon 4
                          </span>
                        )}
                        <strong style={{ fontSize: '0.78rem', color: '#f8fafc' }}>
                          {sol.title}
                        </strong>
                      </div>

                      <button
                        type="button"
                        className={`speed-pill-btn ${isSelected ? 'active' : ''}`}
                        disabled={isBusy}
                        onClick={() =>
                          void handleApplyCandidate(activeCycle.cycle_id, sol)
                        }
                      >
                        {isSelected ? '✓ Applied' : '🧪 Apply 1'}
                      </button>
                    </div>

                    <p className="rl-sol-rationale">{sol.rationale}</p>

                    {sol.requires_code_edit && sol.target_files && (
                      <div className="rl-diff-pills">
                        {sol.target_files.map((tf) => (
                          <code
                            key={tf}
                            className="rl-diff-pill"
                            style={{ borderColor: '#f97316', color: '#fdba74' }}
                          >
                            ✏️ {tf}
                          </code>
                        ))}
                      </div>
                    )}

                    <div className="rl-diff-pills">
                      {(sol.diff_summary ?? []).map((dStr, i) => (
                        <code key={i} className="rl-diff-pill">
                          {dStr}
                        </code>
                      ))}
                    </div>

                    <div className="rl-sol-target">
                      <span>Verify Target:</span> {sol.expected_verification_criteria}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <section
          className="ai-card rl-col-card"
          style={{ padding: '36px 24px', textAlign: 'center' }}
        >
          <div style={{ fontSize: '38px', marginBottom: '12px' }}>🧬</div>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: '#f8fafc',
              marginBottom: '8px',
            }}
          >
            {isTraining
              ? `Training Gen ${activeGen} (${activeArchVersion}) — Next Auto-Evolution at Ep ${nextTargetEp.toLocaleString()}`
              : `Gen ${activeGen} (${activeArchVersion}) Ready — Episode-Horizon Progressive Evolution`}
          </h3>
          <p
            style={{
              color: '#94a3b8',
              maxWidth: '680px',
              margin: '0 auto 16px',
              lineHeight: 1.6,
              fontSize: '13px',
            }}
          >
            {isTraining
              ? `The Progressive Model Evolution system evaluates training telemetry every ${testEps.toLocaleString()} episodes (${epsUntilNext.toLocaleString()} episodes remaining until Ep ${nextTargetEp.toLocaleString()}). You can also tune any Architecture, Reward, or PPO Hyperparameter in the studio above or trigger a diagnostic cycle at any time.`
              : `Start training on Gen ${activeGen} (${activeArchVersion}) to gather episode telemetry over the ${testEps.toLocaleString()}-episode horizon, or use the Live Parameter Studio above to adjust architecture, reward weights, and PPO hyperparameters (automatically syncing model-visualizer).`}
          </p>
          <div
            className="rl-loop-pill-group"
            style={{ justifyContent: 'center' }}
          >
            <span className="rl-loop-meta-chip">
              <span>Episodes Until Next Cycle</span>
              <strong
                style={{
                  color: enabled && isTraining ? '#4ade80' : '#facc15',
                }}
              >
                {epsUntilNext.toLocaleString()} Eps (Target Ep{' '}
                {nextTargetEp.toLocaleString()})
              </strong>
            </span>
            <span className="rl-loop-meta-chip">
              <span>Evolution Status</span>
              <strong
                style={{
                  color: enabled
                    ? isTraining
                      ? '#4ade80'
                      : '#38bdf8'
                    : '#94a3b8',
                }}
              >
                {enabled
                  ? isTraining
                    ? 'Active (Episode Horizon)'
                    : 'Armed (Awaiting Training)'
                  : 'Manual / On-Demand'}
              </strong>
            </span>
          </div>
        </section>
      )}

      {/* OPENCODE ARGON 4 MEDIUM CODE AGENT EXECUTION & GIT DIFF */}
      {activeCycle?.code_agent_execution?.executed && (
        <section className="ai-card">
          <div className="ai-card-header">
            <h3>
              🤖 OpenCode Argon 4 Medium Code Agent — Cycle #{activeCycle.cycle_id}
            </h3>
            <span
              className="ai-health-badge"
              style={{
                background: activeCycle.code_agent_execution.success
                  ? 'rgba(34, 197, 94, 0.18)'
                  : 'rgba(239, 68, 68, 0.18)',
                borderColor: activeCycle.code_agent_execution.success
                  ? '#22c55e'
                  : '#ef4444',
                color: activeCycle.code_agent_execution.success
                  ? '#4ade80'
                  : '#fca5a5',
              }}
            >
              {activeCycle.code_agent_execution.model} •{' '}
              {activeCycle.code_agent_execution.success
                ? 'SMOKE TEST PASSED ✅'
                : 'ROLLED BACK ❌'}{' '}
              ({activeCycle.code_agent_execution.duration_sec}s)
            </span>
          </div>

          <div style={{ fontSize: '0.76rem', color: '#e2e8f0' }}>
            <strong>Files Edited:</strong>{' '}
            <code>
              {activeCycle.code_agent_execution.target_files.join(', ')}
            </code>{' '}
            — {activeCycle.code_agent_execution.agent_summary}
          </div>

          {activeCycle.code_agent_execution.git_diff && (
            <pre
              style={{
                margin: 0,
                background: '#060b16',
                border: '1px solid #1e293b',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: '0.68rem',
                color: '#7dd3fc',
                overflowX: 'auto',
                maxHeight: 220,
              }}
            >
              {activeCycle.code_agent_execution.git_diff}
            </pre>
          )}
        </section>
      )}

      {/* 4. VERIFICATION OUTCOME & BEFORE-VS-AFTER EMPIRICAL COMPARISON */}
      {activeCycle && ver && bm && (
        <section className="ai-card">
          <div className="ai-card-header">
            <h3>
              ✅ 4. Empirical Verification Result — Cycle #{activeCycle.cycle_id}:{' '}
              {activeCycle.selected_solution?.title}
            </h3>
            <span
              className="ai-health-badge"
              style={{
                background: ver.problem_solved
                  ? 'rgba(34, 197, 94, 0.18)'
                  : 'rgba(239, 68, 68, 0.18)',
                borderColor: ver.problem_solved ? '#22c55e' : '#ef4444',
                color: ver.problem_solved ? '#4ade80' : '#fca5a5',
              }}
            >
              {ver.verdict} • {ver.decision_taken.toUpperCase()} (+
              {ver.episodes_tested} Eps)
            </span>
          </div>

          <p
            style={{
              margin: '0 0 8px 0',
              fontSize: '0.78rem',
              color: '#e2e8f0',
            }}
          >
            {ver.analysis_summary}
          </p>

          <div className="ai-models-table-wrap">
            <table className="ai-matrix-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Pre-Change Baseline (Ep {ver.start_episode})</th>
                  <th>Post-Test Verified (Ep {ver.end_episode})</th>
                  <th>Verified Effect (Δ)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>Mean 300-Ep Destruction %</strong>
                  </td>
                  <td>{bm.mean_pct_50.toFixed(2)}%</td>
                  <td style={{ color: '#fde047', fontWeight: 700 }}>
                    {ver.post_change_metrics.mean_pct_50.toFixed(2)}%
                  </td>
                  <td
                    style={{
                      color:
                        ver.metric_deltas.delta_mean_pct_50 >= 0
                          ? '#4ade80'
                          : '#f87171',
                      fontWeight: 700,
                    }}
                  >
                    {ver.metric_deltas.delta_mean_pct_50 >= 0 ? '+' : ''}
                    {ver.metric_deltas.delta_mean_pct_50.toFixed(2)}%
                  </td>
                </tr>
                {ver.metric_deltas.delta_combat_score !== undefined && (
                  <tr>
                    <td>
                      <strong>Composite Combat Score (0–100)</strong>
                    </td>
                    <td>
                      {(
                        bm.combat_score_300 ??
                        0.5 * bm.mean_pct_50 +
                          0.2 * bm.two_star_th_rate_50 +
                          0.3 * bm.three_star_triple_rate_50
                      ).toFixed(2)}
                    </td>
                    <td style={{ color: '#38bdf8', fontWeight: 700 }}>
                      {(
                        ver.post_change_metrics.combat_score_300 ??
                        0.5 * ver.post_change_metrics.mean_pct_50 +
                          0.2 * ver.post_change_metrics.two_star_th_rate_50 +
                          0.3 * ver.post_change_metrics.three_star_triple_rate_50
                      ).toFixed(2)}
                    </td>
                    <td
                      style={{
                        color:
                          ver.metric_deltas.delta_combat_score >= 0
                            ? '#4ade80'
                            : '#f87171',
                        fontWeight: 700,
                      }}
                    >
                      {ver.metric_deltas.delta_combat_score >= 0 ? '+' : ''}
                      {ver.metric_deltas.delta_combat_score.toFixed(2)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td>
                    <strong>2★+ Town Hall 18 Takedown Rate</strong>
                  </td>
                  <td>{bm.two_star_th_rate_50.toFixed(1)}%</td>
                  <td style={{ color: '#fb923c', fontWeight: 700 }}>
                    {ver.post_change_metrics.two_star_th_rate_50.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      color:
                        ver.metric_deltas.delta_two_star_th_rate >= 0
                          ? '#4ade80'
                          : '#f87171',
                      fontWeight: 700,
                    }}
                  >
                    {ver.metric_deltas.delta_two_star_th_rate >= 0 ? '+' : ''}
                    {ver.metric_deltas.delta_two_star_th_rate.toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>3★ Triple Wipe Rate</strong>
                  </td>
                  <td>{bm.three_star_triple_rate_50.toFixed(1)}%</td>
                  <td style={{ color: '#4ade80', fontWeight: 700 }}>
                    {ver.post_change_metrics.three_star_triple_rate_50.toFixed(1)}%
                  </td>
                  <td
                    style={{
                      color:
                        ver.metric_deltas.delta_three_star_rate >= 0
                          ? '#4ade80'
                          : '#f87171',
                      fontWeight: 700,
                    }}
                  >
                    {ver.metric_deltas.delta_three_star_rate >= 0 ? '+' : ''}
                    {ver.metric_deltas.delta_three_star_rate.toFixed(1)}%
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Mean Episode Return (R̄₅₀)</strong>
                  </td>
                  <td>{bm.mean_reward_50.toFixed(2)} pts</td>
                  <td>{ver.post_change_metrics.mean_reward_50.toFixed(2)} pts</td>
                  <td
                    style={{
                      color:
                        ver.metric_deltas.delta_mean_reward >= 0
                          ? '#4ade80'
                          : '#f87171',
                      fontWeight: 700,
                    }}
                  >
                    {ver.metric_deltas.delta_mean_reward >= 0 ? '+' : ''}
                    {ver.metric_deltas.delta_mean_reward.toFixed(2)} pts
                  </td>
                </tr>
                <tr>
                  <td>
                    <strong>Worst Village Destruction %</strong>
                  </td>
                  <td>
                    {bm.worst_village.name} ({bm.worst_village.recent_avg_pct}%)
                  </td>
                  <td>
                    {ver.post_change_metrics.worst_village.name} (
                    {ver.post_change_metrics.worst_village.recent_avg_pct}%)
                  </td>
                  <td
                    style={{
                      color:
                        ver.metric_deltas.delta_worst_village_pct >= 0
                          ? '#4ade80'
                          : '#f87171',
                      fontWeight: 700,
                    }}
                  >
                    {ver.metric_deltas.delta_worst_village_pct >= 0 ? '+' : ''}
                    {ver.metric_deltas.delta_worst_village_pct.toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. LONG-TERM MEMORY LEDGER ("WHAT WORKED WHEN" MATRIX) */}
      <section className="ai-card">
        <div className="ai-card-header">
          <h3>
            📚 Long-Term Memory Ledger — What Worked When ({cycles.length} Cycles
            Synced to Obsidian Vault)
          </h3>
          <span className="ai-feedback-meta-tag">
            obsidian_vault/experiments/Recursive_AI_Improvement_Loop.md
          </span>
        </div>

        <div className="ai-models-table-wrap">
          <table className="ai-matrix-table">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Episode</th>
                <th>Health / Status</th>
                <th>Diagnosed Bottleneck</th>
                <th>Category</th>
                <th>Applied Solution &amp; Parameter Changes</th>
                <th>Before → After Destr %</th>
                <th>Before → After 2★ TH18</th>
                <th>Before → After 3★</th>
                <th>Verification Verdict</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => {
                const mPre = c.pre_change_snapshot.baseline_metrics;
                const vRes = c.verification_result;
                const mPost = vRes?.post_change_metrics;
                const sol = c.selected_solution;
                const catStyle =
                  CATEGORY_COLORS[sol?.category ?? 'combined'] ??
                  CATEGORY_COLORS.combined;
                const isSelectedRow = activeCycle?.cycle_id === c.cycle_id;

                return (
                  <tr
                    key={c.cycle_id}
                    style={{
                      cursor: 'pointer',
                      background: isSelectedRow
                        ? 'rgba(56, 189, 248, 0.08)'
                        : undefined,
                    }}
                    onClick={() => setSelectedCycleId(c.cycle_id)}
                  >
                    <td>
                      <strong>#{c.cycle_id}</strong>
                    </td>
                    <td>Ep {c.episode_at_analysis.toLocaleString()}</td>
                    <td>
                      <span
                        style={{
                          color: !c.health_verdict.is_plateaued
                            ? '#4ade80'
                            : '#facc15',
                          fontWeight: 700,
                        }}
                      >
                        {c.health_verdict.status.toUpperCase()} (
                        {c.health_verdict.health_score})
                      </span>
                    </td>
                    <td>
                      {c.health_verdict.reasons[0]?.title ?? 'Consolidation'}
                    </td>
                    <td>
                      {sol ? (
                        <span
                          className="rl-cat-chip"
                          style={{
                            background: catStyle.bg,
                            borderColor: catStyle.border,
                            color: catStyle.text,
                          }}
                        >
                          {catStyle.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      {sol ? (
                        <div>
                          <strong style={{ color: '#f8fafc' }}>
                            {sol.title}
                          </strong>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                            {(sol.diff_summary ?? []).slice(0, 2).join(' • ')}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>
                          Baseline Documented (Select solution above to test)
                        </span>
                      )}
                    </td>
                    <td>
                      {mPost && vRes ? (
                        <span>
                          {mPre.mean_pct_50.toFixed(1)}% →{' '}
                          <strong style={{ color: '#fde047' }}>
                            {mPost.mean_pct_50.toFixed(1)}%
                          </strong>{' '}
                          <span
                            style={{
                              color:
                                vRes.metric_deltas.delta_mean_pct_50 >= 0
                                  ? '#4ade80'
                                  : '#f87171',
                            }}
                          >
                            ({vRes.metric_deltas.delta_mean_pct_50 >= 0 ? '+' : ''}
                            {vRes.metric_deltas.delta_mean_pct_50.toFixed(2)}%)
                          </span>
                        </span>
                      ) : (
                        <span>{mPre.mean_pct_50.toFixed(1)}%</span>
                      )}
                    </td>
                    <td>
                      {mPost && vRes ? (
                        <span>
                          {mPre.two_star_th_rate_50.toFixed(1)}% →{' '}
                          <strong style={{ color: '#fb923c' }}>
                            {mPost.two_star_th_rate_50.toFixed(1)}%
                          </strong>
                        </span>
                      ) : (
                        <span>{mPre.two_star_th_rate_50.toFixed(1)}%</span>
                      )}
                    </td>
                    <td>
                      {mPost && vRes ? (
                        <span>
                          {mPre.three_star_triple_rate_50.toFixed(1)}% →{' '}
                          <strong style={{ color: '#4ade80' }}>
                            {mPost.three_star_triple_rate_50.toFixed(1)}%
                          </strong>
                        </span>
                      ) : (
                        <span>{mPre.three_star_triple_rate_50.toFixed(1)}%</span>
                      )}
                    </td>
                    <td>
                      {vRes ? (
                        <strong
                          style={{
                            color: vRes.problem_solved ? '#4ade80' : '#f87171',
                          }}
                        >
                          {vRes.verdict}
                        </strong>
                      ) : sol ? (
                        <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                          🧪 TESTING
                        </span>
                      ) : (
                        <span style={{ color: '#facc15' }}>READY</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
