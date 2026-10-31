import React, { useEffect, useMemo, useState } from 'react';
import {
  applyRecursiveLoopSolution,
  configureRecursiveLoop,
  runRecursiveLoopCycle,
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
};

const PIPELINE_STAGES = [
  { id: 'monitoring', num: 1, label: '10m Telemetry Audit' },
  { id: 'analyzing', num: 2, label: 'Plateau Root-Cause Diagnosis' },
  { id: 'documenting_baseline', num: 3, label: 'Pre-Change Snapshot' },
  { id: 'testing_solution', num: 4, label: 'Apply & Test Solution' },
  { id: 'verifying_solution', num: 5, label: 'Verify & Vault Memory' },
] as const;

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

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
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const cycles = useMemo(() => loopState?.cycles ?? [], [loopState?.cycles]);

  useEffect(() => {
    if (cycles.length > 0 && selectedCycleId === null) {
      setSelectedCycleId(cycles[cycles.length - 1].cycle_id);
    }
  }, [cycles, selectedCycleId]);

  const activeCycle: AIRecursiveLoopCycle | null = useMemo(() => {
    if (cycles.length === 0) return null;
    if (selectedCycleId !== null) {
      const found = cycles.find((c) => c.cycle_id === selectedCycleId);
      if (found) return found;
    }
    return cycles[cycles.length - 1];
  }, [cycles, selectedCycleId]);

  const enabled = Boolean(loopState?.enabled);
  const intervalSec = loopState?.interval_seconds ?? 600;
  const countdownSec = loopState?.seconds_until_next_check ?? intervalSec;
  const testEps = loopState?.test_episodes_per_cycle ?? 48;
  const provider: AIFeedbackProviderId =
    loopState?.provider ?? 'opencode_argon';
  const phase = loopState?.phase ?? 'idle';
  const activeHyp = loopState?.active_hypothesis ?? null;

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

  const handleIntervalChange = async (nextSec: number) => {
    setIsBusy(true);
    try {
      await configureRecursiveLoop({ interval_seconds: nextSec });
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleTestEpsChange = async (nextEps: number) => {
    const clamped = Math.max(12, Math.min(500, nextEps));
    await configureRecursiveLoop({ test_episodes_per_cycle: clamped });
    await onRefreshStatus();
  };

  const handleProviderChange = async (nextProv: AIFeedbackProviderId) => {
    await configureRecursiveLoop({ provider: nextProv });
    await onRefreshStatus();
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

  const handleApplyCandidate = async (
    cycleId: number,
    sol: AICandidateSolution
  ) => {
    setIsBusy(true);
    try {
      await applyRecursiveLoopSolution({
        cycle_id: cycleId,
        solution_id: sol.solution_id,
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
              className={`clash-btn ${enabled ? 'green' : 'gold'}`}
              disabled={isBusy}
              onClick={() => void handleToggleLoop()}
            >
              {enabled
                ? `🟢 10m Loop Active (${formatCountdown(countdownSec)})`
                : '▶️ Enable 10m Auto-Loop'}
            </button>

            <div className="rl-loop-pill-group">
              <span className="rl-loop-meta-chip">
                <span>Cadence</span>
                <select
                  className="rl-inline-select"
                  value={intervalSec}
                  onChange={(e) =>
                    void handleIntervalChange(Number(e.target.value))
                  }
                >
                  <option value={300}>Every 5m</option>
                  <option value={600}>Every 10m</option>
                  <option value={900}>Every 15m</option>
                  <option value={1800}>Every 30m</option>
                </select>
              </span>

              <span className="rl-loop-meta-chip">
                <span>Test Burst</span>
                <select
                  className="rl-inline-select"
                  value={testEps}
                  onChange={(e) =>
                    void handleTestEpsChange(Number(e.target.value))
                  }
                >
                  <option value={24}>24 Eps</option>
                  <option value={48}>48 Eps</option>
                  <option value={96}>96 Eps</option>
                  <option value={144}>144 Eps</option>
                </select>
              </span>

              <span className="rl-loop-meta-chip">
                <span>Vault Memory</span>
                <code>obsidian_vault/experiments/Recursive_AI_Improvement_Loop.md</code>
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
      {activeCycle && snap && bm && hv && (
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
                  <span>Mean Destr (50-Ep)</span>
                  <strong style={{ color: '#fde047' }}>
                    {bm.mean_pct_50.toFixed(1)}%
                  </strong>
                </div>
                <div className="rl-kv-item">
                  <span>Rolling-50 Peak</span>
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

          {/* COLUMN 3: CANDIDATE SOLUTIONS (ARCH / REWARD / HYPERPARAMS) */}
          <section className="ai-card rl-col-card">
            <div className="ai-card-header">
              <h3>
                🧪 3. Proposed Solutions ({activeCycle.candidate_solutions.length})
              </h3>
              <span className="ai-feedback-meta-tag">
                Select to Snapshot &amp; Test
              </span>
            </div>

            <div className="rl-solutions-list">
              {activeCycle.candidate_solutions.map((sol) => {
                const isSelected =
                  activeCycle.selected_solution?.solution_id === sol.solution_id;
                const catStyle =
                  CATEGORY_COLORS[sol.category] ?? CATEGORY_COLORS.combined;

                return (
                  <div
                    key={sol.solution_id}
                    className={`rl-solution-card ${isSelected ? 'selected' : ''}`}
                    style={{
                      borderColor: isSelected ? '#4ade80' : '#253654',
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
                        {isSelected ? '✓ Applied & Testing' : '🧪 Apply & Test'}
                      </button>
                    </div>

                    <p className="rl-sol-rationale">{sol.rationale}</p>

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
                    <strong>Mean 50-Ep Destruction %</strong>
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
