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

interface ComposableModuleSpec {
  key: string;
  shortTitle: string;
  targetBottleneck: string;
  detail: string;
}

const COMPOSABLE_SOTA_MODULES: ComposableModuleSpec[] = [
  {
    key: 'use_coord_features',
    shortTitle: '+6 CoC Tactical Coords',
    targetBottleneck: 'Perimeter Trash Drift & TH18 LoS',
    detail: 'X/Y, TH18 radial dist & Siege ray angle, trash mask, frontline',
  },
  {
    key: 'use_se_attention',
    shortTitle: 'SE 59-Ch Attention',
    targetBottleneck: 'Sparse Defense / Troop Re-Weighting',
    detail: 'Squeeze-and-Excitation dynamic 59-channel gating',
  },
  {
    key: 'use_convnext_grn',
    shortTitle: 'ConvNeXt V2 7×7 GRN',
    targetBottleneck: '7–10t Splash & Sparse Channel Collapse',
    detail: '7×7 depthwise conv + Global Response Normalization',
  },
  {
    key: 'use_dilated_context',
    shortTitle: 'Dilated Context (d=2,4)',
    targetBottleneck: 'Multi-Ring Wall & Defense Reach',
    detail: 'Multi-scale dilated residual block at 25×25',
  },
  {
    key: 'use_segnext_msca',
    shortTitle: 'SegNeXt Strip MSCA',
    targetBottleneck: 'Orthogonal Wall Compartments & Ring Bases',
    detail: 'Anisotropic 1×7+7×1 & 1×11+11×1 strip convolutions',
  },
  {
    key: 'use_dual_spatial_head',
    shortTitle: 'Dual Troop/Spell Pointer',
    targetBottleneck: 'Border Troop Drop vs. Interior Spell Conflict',
    detail: 'Decouples perimeter troop funnel head from interior spell head',
  },
  {
    key: 'use_unet_decoder',
    shortTitle: '4-Stage U-Net Decoder',
    targetBottleneck: '50×50 Global Receptive Field & 2★→3★ Sweep',
    detail: 'Contracting-expansive 50→25→12→6→12→25→50 skip pathways',
  },
  {
    key: 'use_gated_heads',
    shortTitle: 'Sigmoid Gated Pointer',
    targetBottleneck: 'Action-Conditioned Spatial Masking',
    detail: 'Multiplicative sigmoid spatial gating from chosen slot/type',
  },
];

interface ArchTemplateSpec {
  id: string;
  label: string;
  paramsLabel: string;
  config: Record<string, number | string | boolean>;
}

const ARCH_TEMPLATES: ArchTemplateSpec[] = [
  {
    id: 'baseline_tiny',
    label: 'Baseline Fast CNN (v4.0-TinyCNN)',
    paramsLabel: '55.1K',
    config: {
      arch_version: 'v4.0-Gen0-TinyCNN',
      generation: 0,
      backbone_type: 'tiny_cnn',
      base_ch: 20,
      spatial_dim: 20,
      embed_dim: 64,
      head_hidden_dim: 48,
      critic_depth: 2,
      use_coord_features: false,
      use_se_attention: false,
      use_dilated_context: false,
      use_convnext_grn: false,
      use_segnext_msca: false,
      use_unet_decoder: false,
      use_dual_spatial_head: false,
      use_gated_heads: false,
    },
  },
  {
    id: 'coord_se_breach',
    label: 'Tactical Coord + SE ResCNN (Core Breach)',
    paramsLabel: '130.3K',
    config: {
      arch_version: 'v4-CoordSE-TacticalResCNN',
      generation: 1,
      backbone_type: 'coord_se_res',
      base_ch: 24,
      spatial_dim: 24,
      embed_dim: 96,
      head_hidden_dim: 64,
      critic_depth: 2,
      use_coord_features: true,
      use_se_attention: true,
      use_dilated_context: false,
      use_convnext_grn: false,
      use_segnext_msca: false,
      use_unet_decoder: false,
      use_dual_spatial_head: false,
      use_gated_heads: false,
    },
  },
  {
    id: 'dual_ptr_funnel',
    label: 'Dual-Pointer Gated BreachNet (Troop vs Spell)',
    paramsLabel: '198.4K',
    config: {
      arch_version: 'v4-DualPointer-GatedBreachNet',
      generation: 2,
      backbone_type: 'coord_se_res',
      base_ch: 24,
      spatial_dim: 28,
      embed_dim: 128,
      head_hidden_dim: 96,
      critic_depth: 2,
      use_coord_features: true,
      use_se_attention: true,
      use_dilated_context: true,
      use_convnext_grn: false,
      use_segnext_msca: false,
      use_unet_decoder: false,
      use_dual_spatial_head: true,
      use_gated_heads: true,
    },
  },
  {
    id: 'convnext_grn_threat',
    label: 'ConvNeXt V2 7×7 GRN ThreatNet (59-Ch Contrast)',
    paramsLabel: '260.0K',
    config: {
      arch_version: 'v4-ConvNeXtV2-GRN-ThreatNet',
      generation: 2,
      backbone_type: 'convnext_v2',
      base_ch: 28,
      spatial_dim: 28,
      embed_dim: 128,
      head_hidden_dim: 96,
      critic_depth: 2,
      use_coord_features: true,
      use_se_attention: true,
      use_dilated_context: true,
      use_convnext_grn: true,
      use_segnext_msca: false,
      use_unet_decoder: false,
      use_dual_spatial_head: false,
      use_gated_heads: false,
    },
  },
  {
    id: 'segnext_compartment',
    label: 'SegNeXt Strip-MSCA CompartmentNet (Ring/Diamond)',
    paramsLabel: '390.2K',
    config: {
      arch_version: 'v4-SegNeXt-MSCA-CompartmentNet',
      generation: 3,
      backbone_type: 'segnext_msca',
      base_ch: 32,
      spatial_dim: 32,
      embed_dim: 160,
      head_hidden_dim: 128,
      critic_depth: 3,
      use_coord_features: true,
      use_se_attention: true,
      use_dilated_context: true,
      use_convnext_grn: true,
      use_segnext_msca: true,
      use_unet_decoder: false,
      use_dual_spatial_head: true,
      use_gated_heads: true,
    },
  },
  {
    id: 'multiscale_unet_critic',
    label: 'Multi-Scale 4-Stage U-Net + 3L Critic (Full Wipe)',
    paramsLabel: '1.54M',
    config: {
      arch_version: 'v4-MultiScale-UNet-DeepCritic',
      generation: 4,
      backbone_type: 'unet',
      base_ch: 24,
      spatial_dim: 28,
      embed_dim: 192,
      head_hidden_dim: 128,
      critic_depth: 3,
      use_coord_features: true,
      use_se_attention: true,
      use_dilated_context: true,
      use_convnext_grn: true,
      use_segnext_msca: true,
      use_unet_decoder: true,
      use_dual_spatial_head: true,
      use_gated_heads: true,
    },
  },
];

const CATEGORY_COLORS: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  architecture: {
    bg: 'rgba(168, 85, 247, 0.16)',
    border: '#a855f7',
    text: '#d8b4fe',
    label: 'ARCH CONDITIONING',
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
    label: 'ARGON 4 ARCH EVOLUTION',
  },
};

const PIPELINE_STAGES = [
  { id: 'monitoring', num: 1, label: '1. Episode Telemetry Audit' },
  { id: 'analyzing', num: 2, label: '2. Argon 4 Diagnosis & Arch Check' },
  { id: 'documenting_baseline', num: 3, label: '3. Pre-Change Snapshot' },
  { id: 'testing_solution', num: 4, label: '4. Apply / Evolve & Sync Visualizer' },
  { id: 'verifying_solution', num: 5, label: '5. Empirical Verification' },
] as const;

const DECISION_LABELS: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  keep_monitoring: {
    label: 'KEEP CURRENT ARCH & MONITOR',
    color: '#4ade80',
    bg: 'rgba(34, 197, 94, 0.14)',
    border: '#22c55e',
  },
  apply_in_place_solution: {
    label: 'KEEP ARCH — TUNE IN-PLACE',
    color: '#38bdf8',
    bg: 'rgba(56, 189, 248, 0.14)',
    border: '#0284c7',
  },
  rollback_to_baseline: {
    label: 'ROLLBACK TO BASELINE',
    color: '#f87171',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: '#ef4444',
  },
  stop_and_restart_new_arch: {
    label: 'EVOLVE TO NEW ARCHITECTURE',
    color: '#f9a8d4',
    bg: 'rgba(236, 72, 153, 0.16)',
    border: '#ec4899',
  },
  kept_and_promoted: {
    label: 'SOLVED — PROMOTED AS BASELINE',
    color: '#4ade80',
    bg: 'rgba(34, 197, 94, 0.16)',
    border: '#22c55e',
  },
  kept_and_continuing: {
    label: 'RETAINED — CONTINUING CONSOLIDATION',
    color: '#fde047',
    bg: 'rgba(250, 204, 21, 0.14)',
    border: '#eab308',
  },
  rolled_back_to_baseline: {
    label: 'DEGRADED — ROLLED BACK TO BASELINE',
    color: '#f87171',
    bg: 'rgba(239, 68, 68, 0.16)',
    border: '#ef4444',
  },
  stopped_and_restarted_new_arch: {
    label: 'ESCALATED — EVOLVED NEW ARCHITECTURE',
    color: '#f9a8d4',
    bg: 'rgba(236, 72, 153, 0.18)',
    border: '#ec4899',
  },
};

export const RecursiveLoopPanel: React.FC<RecursiveLoopPanelProps> = ({
  loopState,
  isTraining,
  currentCumulativeEp,
  onRefreshStatus,
}) => {
  const [workspaceTab, setWorkspaceTab] = useState<
    'decisions' | 'studio' | 'ledger'
  >('decisions');
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null);
  const [snapshotTab, setSnapshotTab] = useState<
    'telemetry' | 'arch' | 'reward' | 'hyperparams'
  >('telemetry');
  const [paramEditorTab, setParamEditorTab] = useState<
    'arch' | 'reward' | 'hyperparams'
  >('arch');
  const [editArch, setEditArch] = useState<
    Record<string, number | string | boolean>
  >({});
  const [editReward, setEditReward] = useState<Record<string, number>>({});
  const [editHyper, setEditHyper] = useState<Record<string, number | string>>(
    {}
  );
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
  const lastCycleEp = loopState?.last_cycle_episode ?? 0;
  const nextTargetEp =
    loopState?.next_cycle_target_episode ?? lastCycleEp + testEps;
  const epsUntilNext =
    loopState?.episodes_until_next_cycle ??
    Math.max(0, nextTargetEp - currentCumulativeEp);
  const provider: AIFeedbackProviderId =
    loopState?.provider ?? 'opencode_argon';
  const phase = loopState?.phase ?? 'idle';
  const activeHyp = loopState?.active_hypothesis ?? null;
  const activeArchCfg = loopState?.active_config?.arch_config ?? {};
  const activeArchVersion = String(
    activeArchCfg.arch_version ?? 'v4.0-Gen0-TinyCNN'
  );
  const activeBackbone = String(activeArchCfg.backbone_type ?? 'tiny_cnn');
  const activeWeightMode = String(
    activeArchCfg.weight_transfer_mode ?? 'warm_start'
  );
  const latestStrategy =
    activeCycle?.strategy_research ??
    loopState?.latest_strategy_research ??
    null;
  const archAnalysis =
    activeCycle?.architecture_analysis ??
    activeCycle?.health_verdict?.architecture_analysis ??
    loopState?.latest_architecture_analysis ??
    null;
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

  const horizonProgressPct = useMemo(() => {
    if (activeHyp) {
      const done = Math.max(0, currentCumulativeEp - activeHyp.baseline_episode);
      return Math.min(
        100,
        Math.round((done / Math.max(1, activeHyp.target_episodes)) * 100)
      );
    }
    const span = Math.max(1, nextTargetEp - lastCycleEp);
    const done = Math.max(0, currentCumulativeEp - lastCycleEp);
    return Math.min(100, Math.round((done / span) * 100));
  }, [activeHyp, currentCumulativeEp, lastCycleEp, nextTargetEp]);

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

  const handleToggleComposableModule = (flagKey: string) => {
    setEditArch((prev) => ({
      ...prev,
      [flagKey]: !prev[flagKey],
    }));
    setWorkspaceTab('studio');
    setParamEditorTab('arch');
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
          ? 'Applied parameters, ran Argon 4 code sync & updated model-visualizer.'
          : 'Applied parameters & updated model-visualizer.'
      );
      setTimeout(() => setParamSaveMsg(null), 4500);
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
        setWorkspaceTab('decisions');
      }
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetLoop = async () => {
    if (cycles.length > 0) {
      const ok = window.confirm(
        'Reset evolution history and restore Baseline Fast CNN configuration?'
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
        setWorkspaceTab('decisions');
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

  const activeDecisionKey =
    ver?.decision_taken ??
    hv?.recommended_decision ??
    (activeHyp ? 'apply_in_place_solution' : 'keep_monitoring');
  const decisionMeta =
    DECISION_LABELS[activeDecisionKey] ?? DECISION_LABELS.keep_monitoring;

  const meanPct = Number(
    liveTelemetry?.mean_pct_300 ?? liveTelemetry?.mean_pct_50 ?? 0
  );
  const semPct = liveTelemetry?.sem_pct_300;
  const slope100 = Number(liveTelemetry?.pct_slope_per_100ep ?? 0);
  const twoStarRate = Number(
    liveTelemetry?.two_star_th_rate_300 ??
      liveTelemetry?.two_star_th_rate_50 ??
      0
  );
  const threeStarRate = Number(
    liveTelemetry?.three_star_triple_rate_300 ??
      liveTelemetry?.three_star_triple_rate_50 ??
      0
  );
  const combatScore = Number(
    liveTelemetry?.combat_score_300 ??
      0.5 * meanPct + 0.2 * twoStarRate + 0.3 * threeStarRate
  );
  const evPct =
    liveTelemetry?.explained_var_50 !== undefined
      ? Number(liveTelemetry.explained_var_50)
      : Number(liveTelemetry?.explained_variance_50 ?? 0) * 100;
  const approxKl = Number(liveTelemetry?.approx_kl_50 ?? 0);
  const noopPct = Number(
    liveTelemetry?.noop_pct_50 ?? liveTelemetry?.mean_noop_pct_50 ?? 0
  );

  const recommendedModulesSet = useMemo(
    () => new Set(archAnalysis?.selected_modules ?? []),
    [archAnalysis?.selected_modules]
  );

  return (
    <div className="rl-loop-container">
      {/* =================================================================== */}
      {/* 1. COMMAND BAR + 5-STAGE PIPELINE TRACKER                           */}
      {/* =================================================================== */}
      <section className="ai-card rl-loop-header-card">
        <div className="rl-loop-top-row">
          <div className="rl-loop-title-group">
            <button
              type="button"
              className={`clash-btn ${enabled ? 'green' : ''}`}
              disabled={isBusy}
              onClick={() => void handleToggleLoop()}
            >
              {enabled ? '🟢 Auto-Evolution ON' : '⚪ Auto-Evolution OFF'}
            </button>

            <span className="rl-loop-meta-chip">
              <span>Horizon</span>
              <select
                className="rl-inline-select"
                value={testEps}
                onChange={(e) => void handleTestEpsChange(Number(e.target.value))}
              >
                <option value={300}>Every 300 Eps</option>
                <option value={1000}>Every 1,000 Eps</option>
                <option value={2500}>Every 2,500 Eps</option>
                <option value={5000}>Every 5,000 Eps</option>
                <option value={10000}>Every 10,000 Eps</option>
              </select>
            </span>

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

            {lastVizSync && (
              <span
                className="rl-loop-meta-chip"
                title={`model-visualizer (${lastVizSync.agent}) synced at ${lastVizSync.synced_at}`}
              >
                <span>Visualizer</span>
                <code style={{ color: '#e9d5ff' }}>
                  🎨 {lastVizSync.total_params.toLocaleString()}p
                </code>
              </span>
            )}
          </div>

          <div className="rl-loop-actions-group">
            <button
              type="button"
              className="clash-btn"
              disabled={isBusy || Boolean(loopState?.is_running_cycle)}
              onClick={() => void handleRunCycleNow(false)}
              title="Run OpenCode Argon 4 Medium to determine if model evolution or in-place tuning is needed"
            >
              {isBusy || loopState?.is_running_cycle
                ? '⟳ Analyzing...'
                : '🔍 Argon 4: Diagnose & Check Arch'}
            </button>

            <button
              type="button"
              className="clash-btn gold"
              disabled={isBusy || Boolean(loopState?.is_running_cycle)}
              onClick={() => void handleRunCycleNow(true)}
              title="Run Argon 4 analysis, snapshot baseline, and automatically apply the recommended decision"
            >
              ⚡ Run Evolution Step
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
              title="Ask OpenCode Argon 4 Medium to synthesize and apply the best neural architecture for the current telemetry bottleneck"
            >
              🧬 Argon 4: Synthesize &amp; Evolve Arch
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

            <button
              type="button"
              className="clash-btn"
              style={{
                borderColor: '#475569',
                color: '#94a3b8',
                background: 'rgba(71, 85, 105, 0.14)',
              }}
              disabled={isBusy || Boolean(loopState?.is_running_cycle)}
              onClick={() => void handleResetLoop()}
              title="Reset evolution history and restore Baseline Fast CNN"
            >
              ↺ Reset Baseline
            </button>
          </div>
        </div>

        {/* 5-STAGE PIPELINE STEPPER + HORIZON PROGRESS */}
        <div className="rl-pipeline-row">
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

          <div className="rl-horizon-progress-box">
            <div className="rl-horizon-progress-top">
              <span style={{ color: isTraining ? '#4ade80' : '#94a3b8', fontWeight: 700 }}>
                {isTraining
                  ? '● TRAINING LIVE'
                  : activeHyp
                  ? '⏸ TESTING PAUSED'
                  : enabled
                  ? '⏸ STANDBY'
                  : '⚪ MANUAL'}
              </span>
              <span>
                Ep <b>{currentCumulativeEp.toLocaleString()}</b> /{' '}
                <b>{nextTargetEp.toLocaleString()}</b> ({epsUntilNext.toLocaleString()} left)
              </span>
            </div>
            <div className="rl-test-progress-track" style={{ width: '100%' }}>
              <div
                className="rl-test-progress-fill"
                style={{ width: `${horizonProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. COMPOSABLE SOTA VISION & SPATIAL-RL MODULES (NON-SEQUENTIAL)     */}
        {/* =================================================================== */}
        <div className="rl-modules-grid-strip">
          {COMPOSABLE_SOTA_MODULES.map((mod) => {
            const isActiveOnModel = Boolean(activeArchCfg[mod.key]);
            const isArgonRecommended =
              !isActiveOnModel && recommendedModulesSet.has(mod.key);
            return (
              <div
                key={mod.key}
                className={`rl-gen-card ${
                  isActiveOnModel
                    ? 'active'
                    : isArgonRecommended
                    ? 'passed'
                    : ''
                }`}
                onClick={() => handleToggleComposableModule(mod.key)}
                title={`${mod.detail} — Click to toggle in Parameter Studio`}
              >
                <div className="rl-gen-card-top">
                  <span className="rl-gen-num-badge">
                    {isActiveOnModel
                      ? '● ACTIVE'
                      : isArgonRecommended
                      ? '★ ARGON 4 TARGET'
                      : 'MODULE'}
                  </span>
                  <code className="rl-gen-params">{mod.key.replace('use_', '')}</code>
                </div>
                <strong className="rl-gen-title">{mod.shortTitle}</strong>
                <span className="rl-gen-summary">{mod.targetBottleneck}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. EXECUTIVE SUMMARY: TELEMETRY | ARGON 4 DECISION & WHY | ARCH     */}
      {/* =================================================================== */}
      <div className="rl-exec-summary-grid">
        {/* CARD A: LIVE 300-EP TELEMETRY */}
        <section className="ai-card rl-exec-card">
          <div className="rl-exec-card-hdr">
            <span className="rl-exec-step-tag">1. LIVE 300-EP TELEMETRY</span>
            <span
              className="ai-health-badge"
              style={{
                background: hv
                  ? !hv.is_plateaued
                    ? 'rgba(34, 197, 94, 0.16)'
                    : 'rgba(245, 158, 11, 0.16)'
                  : 'rgba(56, 189, 248, 0.14)',
                borderColor: hv
                  ? !hv.is_plateaued
                    ? '#22c55e'
                    : '#f59e0b'
                  : '#38bdf8',
                color: hv
                  ? !hv.is_plateaued
                    ? '#4ade80'
                    : '#fbbf24'
                  : '#7dd3fc',
              }}
            >
              {hv
                ? `${hv.status.toUpperCase()} • ${hv.health_score}/100`
                : isTraining
                ? 'COLLECTING TELEMETRY'
                : 'READY'}
            </span>
          </div>

          <div className="rl-kv-grid">
            <div className="rl-kv-item">
              <span>300-Ep Destruction</span>
              <strong style={{ color: '#fde047' }}>
                {meanPct.toFixed(1)}%
                {semPct !== undefined ? ` ± ${Number(semPct).toFixed(2)}%` : ''}
              </strong>
            </div>
            <div className="rl-kv-item">
              <span>Slope / 100 Eps</span>
              <strong style={{ color: slope100 >= 0.35 ? '#4ade80' : '#f97316' }}>
                {slope100 >= 0 ? `+${slope100.toFixed(2)}` : slope100.toFixed(2)}%
              </strong>
            </div>
            <div className="rl-kv-item">
              <span>2★ TH18 / 3★ Triple</span>
              <strong>
                {twoStarRate.toFixed(1)}% /{' '}
                <span style={{ color: '#4ade80' }}>{threeStarRate.toFixed(1)}%</span>
              </strong>
            </div>
            <div className="rl-kv-item">
              <span>Combat Score (0–100)</span>
              <strong style={{ color: '#38bdf8' }}>{combatScore.toFixed(1)}</strong>
            </div>
            <div className="rl-kv-item">
              <span>Critic EV / KL</span>
              <strong>
                {evPct.toFixed(1)}% / {approxKl.toFixed(4)}
              </strong>
            </div>
            <div className="rl-kv-item">
              <span>Worst Base / NoOp</span>
              <strong>
                {liveTelemetry?.worst_village?.name ?? '—'} (
                {liveTelemetry?.worst_village?.recent_avg_pct ?? 0}%) •{' '}
                {noopPct.toFixed(1)}%
              </strong>
            </div>
          </div>
        </section>

        {/* CARD B: ARGON 4 STAGE 1 — IS MODEL EVOLUTION REQUIRED & WHY? */}
        <section className="ai-card rl-exec-card">
          <div className="rl-exec-card-hdr">
            <span className="rl-exec-step-tag">
              2. ARGON 4 DECISION — IS ARCH EVOLUTION NEEDED?
            </span>
            <span
              className="rl-cat-chip"
              style={{
                background: decisionMeta.bg,
                borderColor: decisionMeta.border,
                color: decisionMeta.color,
              }}
            >
              {activeCycle ? decisionMeta.label : 'AWAITING ANALYSIS'}
            </span>
          </div>

          {archAnalysis ? (
            <div className="rl-exec-body">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  className="rl-cat-chip"
                  style={{
                    background: archAnalysis.evolution_required
                      ? 'rgba(236, 72, 153, 0.2)'
                      : 'rgba(56, 189, 248, 0.16)',
                    borderColor: archAnalysis.evolution_required
                      ? '#ec4899'
                      : '#0284c7',
                    color: archAnalysis.evolution_required
                      ? '#f9a8d4'
                      : '#7dd3fc',
                  }}
                >
                  {archAnalysis.evolution_required
                    ? '🧬 ARCH EVOLUTION REQUIRED: YES'
                    : '🛠️ ARCH EVOLUTION REQUIRED: NO (TUNE IN-PLACE)'}
                </span>
                <strong style={{ fontSize: '0.76rem', color: '#f8fafc' }}>
                  {archAnalysis.evolution_verdict_headline}
                </strong>
              </div>

              <div className="rl-exec-why-box">
                <div>
                  <span className="ai-issue-tag">Why</span>{' '}
                  {archAnalysis.evolution_rationale}
                </div>
                {hv?.reasons[0] && (
                  <div>
                    <span className="ai-issue-tag cause">Root Cause</span>{' '}
                    <b style={{ color: '#f8fafc' }}>{hv.reasons[0].title}:</b>{' '}
                    {hv.reasons[0].root_cause}
                  </div>
                )}
              </div>

              {latestStrategy && (
                <div className="rl-exec-strategy-line">
                  <span
                    className="ai-issue-tag"
                    style={{ background: '#0284c7', color: '#fff' }}
                  >
                    CoC Strategy
                  </span>
                  <span>
                    <b style={{ color: '#7dd3fc' }}>
                      {latestStrategy.tactical_focus}:
                    </b>{' '}
                    {latestStrategy.io_recommendation}
                  </span>
                </div>
              )}
            </div>
          ) : activeCycle && hv ? (
            <div className="rl-exec-body">
              <strong className="rl-exec-headline">{hv.headline}</strong>
              {hv.reasons[0] && (
                <div className="rl-exec-why-box">
                  <div>
                    <span className="ai-issue-tag">Bottleneck</span>{' '}
                    <strong style={{ color: '#f8fafc' }}>
                      {hv.reasons[0].title}
                    </strong>{' '}
                    — {hv.reasons[0].symptom}
                  </div>
                  <div>
                    <span className="ai-issue-tag cause">Why</span>{' '}
                    {hv.reasons[0].root_cause}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rl-exec-body">
              <strong className="rl-exec-headline">
                OpenCode Argon 4 Medium evaluates telemetry at Ep{' '}
                {nextTargetEp.toLocaleString()} (or on demand) to decide:
              </strong>
              <div className="rl-exec-why-box">
                <div>
                  <b>1. Is Model Evolution Required?</b> Checks whether the
                  current architecture is structurally bottlenecked or only needs
                  in-place reward / PPO / prior tuning.
                </div>
                <div>
                  <b>2. What Architecture Type Is Appropriate?</b> Diagnoses the
                  exact failure mode (compartment corridors, troop/spell pointer
                  conflict, sparse defense contrast, or 2★→3★ value lag) and
                  synthesizes a tailored architecture.
                </div>
              </div>
            </div>
          )}
        </section>

        {/* CARD C: ACTIVE MODEL & ARGON 4 TARGET ARCHITECTURE SYNTHESIS */}
        <section className="ai-card rl-exec-card">
          <div className="rl-exec-card-hdr">
            <span className="rl-exec-step-tag">
              3. ACTIVE &amp; TARGET ARCHITECTURE
            </span>
            <code className="rl-arch-pill">
              {activeBackbone} •{' '}
              {activeWeightMode === 'warm_start' ? 'Warm-Start' : 'Scratch'}
            </code>
          </div>

          <div className="rl-exec-body">
            <div className="rl-kv-grid" style={{ marginBottom: 4 }}>
              <div className="rl-kv-item">
                <span>Active Model</span>
                <strong style={{ color: '#e9d5ff' }}>{activeArchVersion}</strong>
              </div>
              <div className="rl-kv-item">
                <span>Dimensions &amp; Critic</span>
                <strong>
                  {Number(activeArchCfg.base_ch ?? 20)}ch •{' '}
                  {Number(activeArchCfg.embed_dim ?? 64)}D •{' '}
                  {Number(activeArchCfg.critic_depth ?? 2)}L Critic
                </strong>
              </div>
            </div>

            {activeHyp ? (
              <div className="rl-exec-why-box" style={{ borderColor: '#38bdf8' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 6,
                  }}
                >
                  <strong style={{ color: '#7dd3fc' }}>
                    🧪 Testing Cycle #{activeHyp.cycle_id}:{' '}
                    {activeHyp.solution.title}
                  </strong>
                  <span style={{ color: '#fde047', fontWeight: 700 }}>
                    {horizonProgressPct}%
                  </span>
                </div>
                <div className="rl-diff-pills">
                  {(activeHyp.solution.diff_summary ?? [])
                    .slice(0, 4)
                    .map((d, i) => (
                      <code key={i} className="rl-diff-pill">
                        {d}
                      </code>
                    ))}
                </div>
              </div>
            ) : archAnalysis ? (
              <div
                className="rl-exec-why-box"
                style={{
                  borderColor: archAnalysis.evolution_required
                    ? '#ec4899'
                    : '#253654',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <strong style={{ color: '#f9a8d4' }}>
                    🎯 Argon 4 Target: {archAnalysis.recommended_arch_version}
                  </strong>
                  <code style={{ fontSize: '0.68rem', color: '#fde047' }}>
                    {archAnalysis.total_params.toLocaleString()}p •{' '}
                    {archAnalysis.weight_transfer_mode}
                  </code>
                </div>
                <span style={{ fontSize: '0.69rem', color: '#cbd5e1' }}>
                  <b>Targets:</b> {archAnalysis.bottleneck_targeted}
                </span>
                <div className="rl-diff-pills">
                  {archAnalysis.selected_modules.map((m) => (
                    <code key={m} className="rl-diff-pill">
                      {m.replace('use_', '')}
                    </code>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rl-diff-pills">
                {[
                  activeArchCfg.use_coord_features ? '+6 CoC Coords' : 'Raw 59ch',
                  activeArchCfg.use_se_attention ? 'SE-Attn' : null,
                  activeArchCfg.use_convnext_grn ? '7×7 ConvNeXt GRN' : null,
                  activeArchCfg.use_segnext_msca ? 'SegNeXt MSCA' : null,
                  activeArchCfg.use_unet_decoder
                    ? '4-Stage U-Net'
                    : '2-Stage Fast CNN',
                  activeArchCfg.use_dual_spatial_head
                    ? 'Dual Pointer'
                    : 'Single Pointer',
                ]
                  .filter(Boolean)
                  .map((tag) => (
                    <code key={String(tag)} className="rl-diff-pill">
                      {tag}
                    </code>
                  ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* =================================================================== */}
      {/* 4. SEGMENTED WORKSPACE SWITCHER                                     */}
      {/* =================================================================== */}
      <div className="rl-workspace-tabs">
        <button
          type="button"
          className={`rl-workspace-tab ${
            workspaceTab === 'decisions' ? 'active' : ''
          }`}
          onClick={() => setWorkspaceTab('decisions')}
        >
          🧪 Argon 4 Diagnosis, Solutions &amp; Verification
          {activeCycle && (
            <span className="rl-tab-count">Cycle #{activeCycle.cycle_id}</span>
          )}
        </button>

        <button
          type="button"
          className={`rl-workspace-tab ${
            workspaceTab === 'studio' ? 'active' : ''
          }`}
          onClick={() => setWorkspaceTab('studio')}
        >
          🎛️ Composable Architecture &amp; Parameter Studio
          <span className="rl-tab-count">{String(editArch.arch_version ?? activeArchVersion)}</span>
        </button>

        <button
          type="button"
          className={`rl-workspace-tab ${
            workspaceTab === 'ledger' ? 'active' : ''
          }`}
          onClick={() => setWorkspaceTab('ledger')}
        >
          📚 Evolution History Ledger
          <span className="rl-tab-count">{cycles.length}</span>
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: DIAGNOSIS, CANDIDATE SOLUTIONS & VERIFICATION                */}
      {/* =================================================================== */}
      {workspaceTab === 'decisions' && (
        <>
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
                      Cycle #{c.cycle_id} • Ep {c.episode_at_analysis.toLocaleString()}
                    </span>
                    <small style={{ color: badgeColor, fontWeight: 800 }}>
                      {v ??
                        (c.selected_solution
                          ? 'TESTING'
                          : c.health_verdict.status.toUpperCase())}
                    </small>
                  </button>
                );
              })}
            </div>
          )}

          {activeCycle && snap && bm && hv ? (
            <div className="rl-two-col-workbench">
              {/* LEFT COLUMN: ROOT-CAUSE DIAGNOSIS + PRE-CHANGE SNAPSHOT */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <section className="ai-card rl-col-card">
                  <div className="ai-card-header">
                    <h3>🩺 Diagnosed Bottlenecks (Cycle #{activeCycle.cycle_id})</h3>
                    <span className="ai-feedback-meta-tag">
                      Engine: {hv.model_used}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                    {hv.progression_summary}
                  </p>

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
                            <span className="ai-issue-tag">Evidence</span>
                            <span>{r.symptom}</span>
                          </div>
                          <div className="ai-issue-row">
                            <span className="ai-issue-tag cause">Root Cause</span>
                            <span>{r.root_cause}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="ai-card rl-col-card">
                  <div className="ai-card-header">
                    <h3>📸 Pre-Change Baseline Snapshot</h3>
                    <span className="ai-feedback-meta-tag">
                      {snap.git_commit} • Ep {snap.cumulative_episode.toLocaleString()}
                    </span>
                  </div>

                  <div className="rl-subtab-bar">
                    {(
                      [
                        ['telemetry', '300-Ep Stats'],
                        ['arch', 'Architecture'],
                        ['reward', 'Reward Fn'],
                        ['hyperparams', 'Hyperparams'],
                      ] as const
                    ).map(([tid, lbl]) => (
                      <button
                        key={tid}
                        type="button"
                        className={`tb-mini-btn ${
                          snapshotTab === tid ? 'active' : ''
                        }`}
                        onClick={() => setSnapshotTab(tid)}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>

                  {snapshotTab === 'telemetry' && (
                    <div className="rl-kv-grid">
                      <div className="rl-kv-item">
                        <span>300-Ep Mean Destr</span>
                        <strong style={{ color: '#fde047' }}>
                          {bm.mean_pct_50.toFixed(1)}%
                          {bm.sem_pct_300 !== undefined
                            ? ` ± ${bm.sem_pct_300.toFixed(2)}%`
                            : ''}
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
                        <span>2★ TH18 / 3★ Rate</span>
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
                        <span>Critic V(s₀) / EV</span>
                        <strong>
                          {bm.critic_v_s0.toFixed(1)} •{' '}
                          {(bm.explained_variance_50 * 100).toFixed(1)}%
                        </strong>
                      </div>
                    </div>
                  )}

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
                </section>
              </div>

              {/* RIGHT COLUMN: CANDIDATE SOLUTIONS + VERIFICATION */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <section className="ai-card rl-col-card">
                  <div className="ai-card-header">
                    <h3>
                      🧪 Candidate Solutions ({activeCycle.candidate_solutions.length})
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.7rem',
                          color: '#fdba74',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={allowCodeAgent}
                          onChange={(e) => setAllowCodeAgent(e.target.checked)}
                        />
                        Argon 4 Code Edit
                      </label>

                      <button
                        type="button"
                        className="clash-btn gold"
                        style={{ padding: '4px 10px', fontSize: '0.72rem' }}
                        disabled={isBusy || checkedSolutionIds.length === 0}
                        onClick={() =>
                          void handleApplyCheckedSolutions(activeCycle.cycle_id)
                        }
                      >
                        🚀 Apply Selected ({checkedSolutionIds.length})
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
                      const isChecked = checkedSolutionIds.includes(
                        sol.solution_id
                      );
                      const catStyle =
                        CATEGORY_COLORS[sol.category] ??
                        CATEGORY_COLORS.combined;

                      return (
                        <div
                          key={sol.solution_id}
                          className={`rl-solution-card ${
                            isSelected ? 'selected' : ''
                          }`}
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
                              {sol.is_recommended && (
                                <span
                                  className="rl-cat-chip"
                                  style={{
                                    background: 'rgba(34, 197, 94, 0.18)',
                                    borderColor: '#22c55e',
                                    color: '#4ade80',
                                  }}
                                >
                                  ★ ARGON 4 RECOMMENDED
                                </span>
                              )}
                              <strong
                                style={{ fontSize: '0.79rem', color: '#f8fafc' }}
                              >
                                {sol.title}
                              </strong>
                            </div>

                            <button
                              type="button"
                              className={`speed-pill-btn ${
                                isSelected ? 'active' : ''
                              }`}
                              disabled={isBusy}
                              onClick={() =>
                                void handleApplyCandidate(
                                  activeCycle.cycle_id,
                                  sol
                                )
                              }
                            >
                              {isSelected ? '✓ Applied' : 'Apply'}
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
                            <span>Target:</span>{' '}
                            {sol.expected_verification_criteria}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* EMPIRICAL VERIFICATION TABLE WHEN AVAILABLE */}
                {ver && (
                  <section className="ai-card rl-col-card">
                    <div className="ai-card-header">
                      <h3>✅ Empirical Verification (Cycle #{activeCycle.cycle_id})</h3>
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
                        {ver.verdict} (+{ver.episodes_tested} Eps)
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.76rem', color: '#e2e8f0' }}>
                      {ver.analysis_summary}
                    </p>

                    <div className="ai-models-table-wrap">
                      <table className="ai-matrix-table">
                        <thead>
                          <tr>
                            <th>Metric (300-Ep Mean)</th>
                            <th>Pre (Ep {ver.start_episode})</th>
                            <th>Post (Ep {ver.end_episode})</th>
                            <th>Delta (Δ)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td><strong>Mean Destruction %</strong></td>
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
                            <td><strong>2★+ TH18 Takedown</strong></td>
                            <td>{bm.two_star_th_rate_50.toFixed(1)}%</td>
                            <td>{ver.post_change_metrics.two_star_th_rate_50.toFixed(1)}%</td>
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
                            <td><strong>3★ Triple Rate</strong></td>
                            <td>{bm.three_star_triple_rate_50.toFixed(1)}%</td>
                            <td>
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
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            <section
              className="ai-card"
              style={{
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '0.95rem' }}>
                  No Argon 4 Diagnostic Cycles Recorded Yet in This Session
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                  Click <b>🔍 Argon 4: Diagnose &amp; Check Arch</b> to evaluate the last 300 episodes and determine whether a model architecture evolution or in-place parameter tune is needed.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="clash-btn"
                  disabled={isBusy}
                  onClick={() => setWorkspaceTab('studio')}
                >
                  🎛️ Open Composable Studio
                </button>
                <button
                  type="button"
                  className="clash-btn gold"
                  disabled={isBusy}
                  onClick={() => void handleRunCycleNow(false)}
                >
                  🔍 Run Argon 4 Analysis Now
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 2: COMPOSABLE ARCHITECTURE & PARAMETER STUDIO                   */}
      {/* =================================================================== */}
      {workspaceTab === 'studio' && (
        <section className="ai-card">
          <div className="ai-card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="rl-subtab-bar">
              {(
                [
                  ['arch', '🧬 Composable Architecture & Priors'],
                  ['reward', '🏆 Reward Shaping Weights'],
                  ['hyperparams', '⚡ PPO Hyperparameters'],
                ] as const
              ).map(([tid, lbl]) => (
                <button
                  key={tid}
                  type="button"
                  className={`tb-mini-btn ${
                    paramEditorTab === tid ? 'active' : ''
                  }`}
                  onClick={() => setParamEditorTab(tid)}
                >
                  {lbl}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {paramSaveMsg && (
                <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 700 }}>
                  {paramSaveMsg}
                </span>
              )}
              <button
                type="button"
                className="clash-btn green"
                disabled={isBusy}
                onClick={() => void handleSaveEditedParameters(false)}
              >
                💾 Apply Parameters (+ Sync Visualizer)
              </button>
              <button
                type="button"
                className="clash-btn gold"
                disabled={isBusy}
                onClick={() => void handleSaveEditedParameters(true)}
              >
                🧬 Apply &amp; Run Argon 4 Code Sync
              </button>
            </div>
          </div>

          {paramEditorTab === 'arch' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* STRUCTURAL & TEMPLATE CONTROLS */}
              <div className="rl-param-section-box">
                <strong className="rl-param-sec-title">
                  1. Archetype Template, Backbone Topology &amp; Dimensions
                </strong>
                <div className="rl-param-inputs-grid">
                  <label className="rl-param-field">
                    <span>Reference Archetype (Optional)</span>
                    <select
                      className="clash-select"
                      value={
                        ARCH_TEMPLATES.find(
                          (t) =>
                            t.config.arch_version === editArch.arch_version
                        )?.id ?? ''
                      }
                      onChange={(e) => {
                        const found = ARCH_TEMPLATES.find(
                          (t) => t.id === e.target.value
                        );
                        if (found) {
                          setEditArch((prev) => ({
                            ...prev,
                            ...found.config,
                          }));
                        }
                      }}
                    >
                      <option value="">Custom Composed Architecture</option>
                      {ARCH_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label} ({t.paramsLabel})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="rl-param-field">
                    <span>arch_version</span>
                    <input
                      type="text"
                      className="clash-select"
                      value={String(editArch.arch_version ?? 'v4-Custom')}
                      onChange={(e) =>
                        setEditArch((prev) => ({
                          ...prev,
                          arch_version: e.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className="rl-param-field">
                    <span>backbone_type</span>
                    <select
                      className="clash-select"
                      value={String(editArch.backbone_type ?? 'tiny_cnn')}
                      onChange={(e) =>
                        setEditArch((prev) => ({
                          ...prev,
                          backbone_type: e.target.value,
                        }))
                      }
                    >
                      <option value="tiny_cnn">tiny_cnn (2-Stage Fast)</option>
                      <option value="coord_se_res">coord_se_res (Coord+SE)</option>
                      <option value="convnext_v2">convnext_v2 (7×7 GRN)</option>
                      <option value="segnext_msca">segnext_msca (Strip Attn)</option>
                      <option value="unet">unet (4-Stage U-Net)</option>
                    </select>
                  </label>

                  <label className="rl-param-field">
                    <span>weight_transfer_mode</span>
                    <select
                      className="clash-select"
                      value={String(
                        editArch.weight_transfer_mode ?? 'warm_start'
                      )}
                      onChange={(e) =>
                        setEditArch((prev) => ({
                          ...prev,
                          weight_transfer_mode: e.target.value,
                        }))
                      }
                    >
                      <option value="warm_start">warm_start (Overlap Slice)</option>
                      <option value="scratch_restart">scratch_restart (Fresh)</option>
                    </select>
                  </label>

                  {(
                    [
                      ['base_ch', 16, 64, 4],
                      ['spatial_dim', 16, 64, 4],
                      ['embed_dim', 64, 512, 32],
                      ['head_hidden_dim', 32, 256, 16],
                      ['critic_depth', 2, 3, 1],
                    ] as const
                  ).map(([key, minV, maxV, stepV]) => (
                    <label key={key} className="rl-param-field">
                      <span>{key}</span>
                      <input
                        type="number"
                        className="clash-select"
                        min={minV}
                        max={maxV}
                        step={stepV}
                        value={Number(editArch[key] ?? minV)}
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
              </div>

              {/* SOTA VISION MODULE TOGGLES */}
              <div className="rl-param-section-box">
                <strong className="rl-param-sec-title">
                  2. Composable SOTA Vision &amp; Spatial-RL Building Blocks
                </strong>
                <div className="rl-bool-toggles-grid">
                  {COMPOSABLE_SOTA_MODULES.map((mod) => {
                    const isOn = Boolean(editArch[mod.key]);
                    return (
                      <label
                        key={mod.key}
                        className={`rl-bool-chip ${isOn ? 'on' : ''}`}
                        title={mod.detail}
                      >
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={(e) =>
                            setEditArch((prev) => ({
                              ...prev,
                              [mod.key]: e.target.checked,
                            }))
                          }
                        />
                        <span>{mod.shortTitle}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* TACTICAL CONDITIONING & ENTROPY WEIGHTS */}
              <div className="rl-param-section-box">
                <strong className="rl-param-sec-title">
                  3. Tactical Breach Priors, FiLM Conditioning &amp; Head Temperatures
                </strong>
                <div className="rl-param-inputs-grid">
                  {(
                    [
                      ['th_threat_weight', 0.0, 15.0, 0.25],
                      ['defense_threat_weight', 0.0, 8.0, 0.2],
                      ['breach_prior_weight', 0.0, 16.0, 0.25],
                      ['spell_combat_prior_weight', 0.0, 15.0, 0.25],
                      ['film_cond_scale', 0.0, 2.0, 0.05],
                      ['tile_logit_scale', 0.5, 5.0, 0.1],
                      ['logit_temp_type', 0.5, 4.0, 0.1],
                      ['logit_temp_idx', 0.5, 4.0, 0.1],
                      ['logit_temp_frac', 0.5, 4.0, 0.1],
                      ['reg_ent_tile_weight', 0.02, 1.0, 0.02],
                    ] as const
                  ).map(([key, minV, maxV, stepV]) => (
                    <label key={key} className="rl-param-field">
                      <span>{key}</span>
                      <input
                        type="number"
                        className="clash-select"
                        min={minV}
                        max={maxV}
                        step={stepV}
                        value={Number(editArch[key] ?? 1.0)}
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
              </div>
            </div>
          )}

          {paramEditorTab === 'reward' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loopState?.reward_formula && (
                <code className="rl-formula-box">{loopState.reward_formula}</code>
              )}
              <div className="rl-param-inputs-grid">
                {Object.entries(editReward).map(([k, v]) => (
                  <label key={k} className="rl-param-field">
                    <span>{k}</span>
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
            </div>
          )}

          {paramEditorTab === 'hyperparams' && (
            <div className="rl-param-inputs-grid">
              {Object.entries(editHyper).map(([k, v]) => (
                <label key={k} className="rl-param-field">
                  <span>{k}</span>
                  {k === 'matchup_mode' ? (
                    <select
                      className="clash-select"
                      value={String(v)}
                      onChange={(e) =>
                        setEditHyper((prev) => ({
                          ...prev,
                          [k]: e.target.value,
                        }))
                      }
                    >
                      <option value="random">random</option>
                      <option value="round_robin">round_robin</option>
                      <option value="fixed_current">fixed_current</option>
                    </select>
                  ) : (
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
                  )}
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {/* =================================================================== */}
      {/* TAB 3: EVOLUTION HISTORY LEDGER ("WHAT WORKED WHEN")                */}
      {/* =================================================================== */}
      {workspaceTab === 'ledger' && (
        <section className="ai-card">
          <div className="ai-card-header">
            <h3>📚 Evolution History Ledger ({cycles.length} Cycles)</h3>
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
                  <th>Health</th>
                  <th>Diagnosed Bottleneck</th>
                  <th>Category</th>
                  <th>Applied Intervention &amp; Diffs</th>
                  <th>Pre → Post Destr %</th>
                  <th>Pre → Post 2★</th>
                  <th>Pre → Post 3★</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {cycles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      style={{
                        textAlign: 'center',
                        padding: '18px 12px',
                        color: '#94a3b8',
                      }}
                    >
                      No evolution cycles logged yet.
                    </td>
                  </tr>
                ) : (
                  cycles.map((c) => {
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
                        onClick={() => {
                          setSelectedCycleId(c.cycle_id);
                          setWorkspaceTab('decisions');
                        }}
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
                        </td>
                        <td style={{ maxWidth: 320 }}>
                          <strong style={{ color: '#f8fafc' }}>
                            {sol?.title ?? 'Baseline Snapshot'}
                          </strong>
                          <div style={{ fontSize: '0.68rem', color: '#7dd3fc' }}>
                            {(sol?.diff_summary ?? []).slice(0, 2).join(' • ')}
                          </div>
                        </td>
                        <td>
                          {mPost && vRes ? (
                            <span>
                              {mPre.mean_pct_50.toFixed(1)}% →{' '}
                              <strong style={{ color: '#fde047' }}>
                                {mPost.mean_pct_50.toFixed(1)}%
                              </strong>{' '}
                              (
                              <b
                                style={{
                                  color:
                                    vRes.metric_deltas.delta_mean_pct_50 >= 0
                                      ? '#4ade80'
                                      : '#f87171',
                                }}
                              >
                                {vRes.metric_deltas.delta_mean_pct_50 >= 0
                                  ? '+'
                                  : ''}
                                {vRes.metric_deltas.delta_mean_pct_50.toFixed(2)}%
                              </b>
                              )
                            </span>
                          ) : (
                            <span>{mPre.mean_pct_50.toFixed(1)}% (Testing)</span>
                          )}
                        </td>
                        <td>
                          {mPost && vRes ? (
                            <span>
                              {mPre.two_star_th_rate_50.toFixed(1)}% →{' '}
                              <b>{mPost.two_star_th_rate_50.toFixed(1)}%</b>
                            </span>
                          ) : (
                            <span>{mPre.two_star_th_rate_50.toFixed(1)}%</span>
                          )}
                        </td>
                        <td>
                          {mPost && vRes ? (
                            <span>
                              {mPre.three_star_triple_rate_50.toFixed(1)}% →{' '}
                              <b>{mPost.three_star_triple_rate_50.toFixed(1)}%</b>
                            </span>
                          ) : (
                            <span>
                              {mPre.three_star_triple_rate_50.toFixed(1)}%
                            </span>
                          )}
                        </td>
                        <td>
                          {vRes ? (
                            <span
                              style={{
                                fontWeight: 800,
                                color: vRes.problem_solved
                                  ? '#4ade80'
                                  : '#f87171',
                              }}
                            >
                              {vRes.verdict}
                            </span>
                          ) : (
                            <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                              TESTING
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
