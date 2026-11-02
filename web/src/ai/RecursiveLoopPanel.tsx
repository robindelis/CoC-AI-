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

export interface GenPresetSpec {
  gen: number;
  version: string;
  shortTitle: string;
  backbone: string;
  paramsLabel: string;
  summary: string;
  tags: string[];
  config: {
    arch_version: string;
    generation: number;
    backbone_type: string;
    base_ch: number;
    spatial_dim: number;
    embed_dim: number;
    head_hidden_dim: number;
    critic_depth: number;
    use_coord_features: boolean;
    use_se_attention: boolean;
    use_dilated_context: boolean;
    use_convnext_grn: boolean;
    use_segnext_msca: boolean;
    use_unet_decoder: boolean;
    use_dual_spatial_head: boolean;
    use_gated_heads: boolean;
  };
}

export const GENERATION_LADDER: GenPresetSpec[] = [
  {
    gen: 0,
    version: 'v4.0-Gen0-TinyCNN',
    shortTitle: 'TinyCNN',
    backbone: 'tiny_cnn',
    paramsLabel: '55.1K',
    summary: '2-stage strided CNN + 1×1 pointer',
    tags: ['20ch Stem', '64D Emb', '1×1 Pointer'],
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
    gen: 1,
    version: 'v4.1-Gen1-CoordSE-ResCNN',
    shortTitle: 'CoordSE-Res',
    backbone: 'coord_se_res',
    paramsLabel: '130.3K',
    summary: '+6 CoC tactical coord planes + SE-Attn',
    tags: ['+6 CoC Coords', 'SE-Attn', '24ch / 96D'],
    config: {
      arch_version: 'v4.1-Gen1-CoordSE-ResCNN',
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
    gen: 2,
    version: 'v4.2-Gen2-ConvNeXtV2-GRN',
    shortTitle: 'ConvNeXtV2-GRN',
    backbone: 'convnext_v2',
    paramsLabel: '260.0K',
    summary: '+7×7 depthwise ConvNeXt GRN + Dilated Res',
    tags: ['7×7 ConvNeXt GRN', 'Dilated d=2,4', '28ch / 128D'],
    config: {
      arch_version: 'v4.2-Gen2-ConvNeXtV2-GRN',
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
    gen: 3,
    version: 'v4.3-Gen3-SegNeXt-MSCA-DualPtr',
    shortTitle: 'SegNeXt-MSCA',
    backbone: 'segnext_msca',
    paramsLabel: '390.2K',
    summary: '+Strip Attn (1×7, 1×11) + Dual Spatial Pointer',
    tags: ['SegNeXt Strip', 'Dual Pointer', '3-Layer Critic'],
    config: {
      arch_version: 'v4.3-Gen3-SegNeXt-MSCA-DualPtr',
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
    gen: 4,
    version: 'v4.4-Gen4-SOTA-Hybrid-UNet',
    shortTitle: 'Hybrid U-Net',
    backbone: 'unet',
    paramsLabel: '1.54M',
    summary: '4-stage U-Net (50→6→50) + GRN + MSCA',
    tags: ['4-Stage U-Net', 'GRN + MSCA', '24ch / 192D'],
    config: {
      arch_version: 'v4.4-Gen4-SOTA-Hybrid-UNet',
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
  {
    gen: 5,
    version: 'v4.5-Gen5-Full-Attention-UNet',
    shortTitle: 'Full SOTA U-Net',
    backbone: 'unet',
    paramsLabel: '2.69M',
    summary: 'Full-width 32ch/256D Hybrid Attention U-Net',
    tags: ['Full 32ch U-Net', '256D Global', 'All SOTA Blocks'],
    config: {
      arch_version: 'v4.5-Gen5-Full-Attention-UNet',
      generation: 5,
      backbone_type: 'unet',
      base_ch: 32,
      spatial_dim: 32,
      embed_dim: 256,
      head_hidden_dim: 160,
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
    label: 'MORPH NEXT GEN',
  },
};

const PIPELINE_STAGES = [
  { id: 'monitoring', num: 1, label: '1. Episode Telemetry Audit' },
  { id: 'analyzing', num: 2, label: '2. Strategy & Plateau Diagnosis' },
  { id: 'documenting_baseline', num: 3, label: '3. Pre-Change Snapshot' },
  { id: 'testing_solution', num: 4, label: '4. Morph / Tune & Sync Visualizer' },
  { id: 'verifying_solution', num: 5, label: '5. Empirical Verification' },
] as const;

const DECISION_LABELS: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  keep_monitoring: {
    label: 'KEEP MONITORING (PROGRESSING)',
    color: '#4ade80',
    bg: 'rgba(34, 197, 94, 0.14)',
    border: '#22c55e',
  },
  apply_in_place_solution: {
    label: 'APPLY IN-PLACE TUNING',
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
    label: 'MORPH TO NEXT ARCHITECTURE GEN',
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
    label: 'ESCALATED — MORPHED TO NEW ARCH GEN',
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
  const activeGen = Number(activeArchCfg.generation ?? 0);
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

  const handleSelectGenerationPreset = (spec: GenPresetSpec) => {
    setEditArch((prev) => ({
      ...prev,
      ...spec.config,
      weight_transfer_mode:
        spec.gen === 0
          ? 'scratch_restart'
          : String(prev.weight_transfer_mode ?? 'warm_start'),
    }));
    setWorkspaceTab('studio');
    setParamEditorTab('arch');
  };

  const handleQuickApplyGeneration = async (spec: GenPresetSpec) => {
    setIsBusy(true);
    setParamSaveMsg(null);
    try {
      const nextArch = {
        ...editArch,
        ...spec.config,
        weight_transfer_mode:
          spec.gen === 0
            ? 'scratch_restart'
            : String(editArch.weight_transfer_mode ?? 'warm_start'),
      };
      setEditArch(nextArch);
      await updateRecursiveLoopConfigParameters({
        arch_config: nextArch,
        reward_config: editReward,
        hyperparams: editHyper,
        run_code_agent: false,
        reason: `switch_to_gen${spec.gen}_${spec.version}`,
      });
      setParamSaveMsg(
        `Switched active architecture to Gen ${spec.gen} (${spec.version}) & synced model-visualizer.`
      );
      setTimeout(() => setParamSaveMsg(null), 4500);
      await onRefreshStatus();
    } finally {
      setIsBusy(false);
    }
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
          ? 'Applied parameters, ran Argon 4 morph & synced model-visualizer.'
          : 'Applied parameters & synced model-visualizer.'
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
        'Reset evolution history and restore Gen 0 TinyCNN baseline configuration?'
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

  // Safe numeric helpers for telemetry display
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
            >
              {isBusy || loopState?.is_running_cycle
                ? '⟳ Running...'
                : '📸 Diagnose Now'}
            </button>

            <button
              type="button"
              className="clash-btn gold"
              disabled={isBusy || Boolean(loopState?.is_running_cycle)}
              onClick={() => void handleRunCycleNow(true)}
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
            >
              🧬 Morph Gen {activeGen} → Gen {Math.min(5, activeGen + 1)}
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
              title="Reset evolution history and restore Gen 0 TinyCNN baseline"
            >
              ↺ Reset Gen 0
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
        {/* 2. PROGRESSIVE ARCHITECTURE LADDER (GEN 0 -> GEN 5)                 */}
        {/* =================================================================== */}
        <div className="rl-gen-ladder-strip">
          {GENERATION_LADDER.map((gSpec) => {
            const isActiveGen = gSpec.gen === activeGen;
            const isPastGen = gSpec.gen < activeGen;
            return (
              <div
                key={gSpec.gen}
                className={`rl-gen-card ${
                  isActiveGen ? 'active' : isPastGen ? 'passed' : ''
                }`}
                onClick={() => handleSelectGenerationPreset(gSpec)}
              >
                <div className="rl-gen-card-top">
                  <span className="rl-gen-num-badge">
                    {isPastGen ? '✓ ' : isActiveGen ? '● ' : ''}Gen {gSpec.gen}
                  </span>
                  <code className="rl-gen-params">{gSpec.paramsLabel}</code>
                </div>
                <strong className="rl-gen-title">{gSpec.shortTitle}</strong>
                <span className="rl-gen-summary">{gSpec.summary}</span>
                <div className="rl-gen-tags">
                  {gSpec.tags.map((t) => (
                    <span key={t} className="rl-gen-tag">
                      {t}
                    </span>
                  ))}
                </div>
                {!isActiveGen && (
                  <button
                    type="button"
                    className="rl-gen-activate-btn"
                    disabled={isBusy}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleQuickApplyGeneration(gSpec);
                    }}
                  >
                    Use Gen {gSpec.gen}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. EXECUTIVE SUMMARY: STATE, DECISION MADE & WHY, ACTIVE CONFIG     */}
      {/* =================================================================== */}
      <div className="rl-exec-summary-grid">
        {/* CARD A: WHAT IS HAPPENING & LIVE TELEMETRY */}
        <section className="ai-card rl-exec-card">
          <div className="rl-exec-card-hdr">
            <span className="rl-exec-step-tag">STATUS &amp; TELEMETRY</span>
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

        {/* CARD B: WHAT DECISION HAS BEEN MADE & WHY */}
        <section className="ai-card rl-exec-card">
          <div className="rl-exec-card-hdr">
            <span className="rl-exec-step-tag">DECISION &amp; WHY</span>
            <span
              className="rl-cat-chip"
              style={{
                background: decisionMeta.bg,
                borderColor: decisionMeta.border,
                color: decisionMeta.color,
              }}
            >
              { activeCycle ? decisionMeta.label : 'AWAITING FIRST CYCLE' }
            </span>
          </div>

          {activeCycle && hv ? (
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
              {latestStrategy && (
                <div className="rl-exec-strategy-line">
                  <span className="ai-issue-tag" style={{ background: '#0284c7', color: '#fff' }}>
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
          ) : (
            <div className="rl-exec-body">
              <strong className="rl-exec-headline">
                Gen {activeGen} ({activeArchVersion}) active — next automated audit at Ep{' '}
                {nextTargetEp.toLocaleString()}
              </strong>
              {latestStrategy ? (
                <div className="rl-exec-strategy-line">
                  <span className="ai-issue-tag" style={{ background: '#0284c7', color: '#fff' }}>
                    CoC Strategy
                  </span>
                  <span>
                    <b style={{ color: '#7dd3fc' }}>
                      {latestStrategy.tactical_focus}:
                    </b>{' '}
                    {latestStrategy.io_recommendation}
                  </span>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                  Click &ldquo;📸 Diagnose Now&rdquo; or &ldquo;⚡ Run Evolution Step&rdquo; at any time to evaluate the last 300 episodes and generate candidate solutions.
                </p>
              )}
            </div>
          )}
        </section>

        {/* CARD C: ACTIVE ARCHITECTURE & APPLIED INTERVENTION */}
        <section className="ai-card rl-exec-card">
          <div className="rl-exec-card-hdr">
            <span className="rl-exec-step-tag">ARCHITECTURE &amp; INTERVENTION</span>
            <code className="rl-arch-pill">
              Gen {activeGen} • {activeBackbone} •{' '}
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
                <span>Dimensions</span>
                <strong>
                  {Number(activeArchCfg.base_ch ?? 20)}ch •{' '}
                  {Number(activeArchCfg.spatial_dim ?? 20)}sp •{' '}
                  {Number(activeArchCfg.embed_dim ?? 64)}D
                </strong>
              </div>
            </div>

            {activeHyp ? (
              <div className="rl-exec-why-box" style={{ borderColor: '#38bdf8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                  <strong style={{ color: '#7dd3fc' }}>
                    🧪 Testing Cycle #{activeHyp.cycle_id}: {activeHyp.solution.title}
                  </strong>
                  <span style={{ color: '#fde047', fontWeight: 700 }}>
                    {horizonProgressPct}%
                  </span>
                </div>
                <div className="rl-diff-pills">
                  {(activeHyp.solution.diff_summary ?? []).slice(0, 4).map((d, i) => (
                    <code key={i} className="rl-diff-pill">
                      {d}
                    </code>
                  ))}
                </div>
              </div>
            ) : activeCycle?.selected_solution ? (
              <div className="rl-exec-why-box">
                <strong style={{ color: '#86efac' }}>
                  ✓ Cycle #{activeCycle.cycle_id}: {activeCycle.selected_solution.title}
                </strong>
                <div className="rl-diff-pills">
                  {(activeCycle.selected_solution.diff_summary ?? [])
                    .slice(0, 4)
                    .map((d, i) => (
                      <code key={i} className="rl-diff-pill">
                        {d}
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
                  activeArchCfg.use_unet_decoder ? '4-Stage U-Net' : '2-Stage Fast CNN',
                  activeArchCfg.use_dual_spatial_head ? 'Dual Pointer' : 'Single Pointer',
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
          🧪 Diagnosis, Solutions &amp; Verification
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
          🎛️ Parameter &amp; Architecture Studio
          <span className="rl-tab-count">Gen {Number(editArch.generation ?? activeGen)}</span>
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
                                  ★ RECOMMENDED
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
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 4px 0', color: '#f8fafc', fontSize: '0.95rem' }}>
                  No Diagnostic Cycles Recorded Yet in This Session
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                  Auto-evolution triggers every {testEps.toLocaleString()} episodes, or click{' '}
                  <b>📸 Diagnose Now</b> / <b>⚡ Run Evolution Step</b> to run a 300-episode audit immediately.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="clash-btn"
                  disabled={isBusy}
                  onClick={() => setWorkspaceTab('studio')}
                >
                  🎛️ Open Parameter Studio
                </button>
                <button
                  type="button"
                  className="clash-btn gold"
                  disabled={isBusy}
                  onClick={() => void handleRunCycleNow(false)}
                >
                  📸 Run First Diagnosis
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 2: PARAMETER & ARCHITECTURE STUDIO                              */}
      {/* =================================================================== */}
      {workspaceTab === 'studio' && (
        <section className="ai-card">
          <div className="ai-card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="rl-subtab-bar">
              {(
                [
                  ['arch', '🧬 Architecture & Tactical Priors'],
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
              {/* STRUCTURAL & GENERATION CONTROLS */}
              <div className="rl-param-section-box">
                <strong className="rl-param-sec-title">
                  1. Backbone Generation, Dimensions &amp; Weight Transfer
                </strong>
                <div className="rl-param-inputs-grid">
                  <label className="rl-param-field">
                    <span>Generation Preset (0..5)</span>
                    <select
                      className="clash-select"
                      value={Number(editArch.generation ?? 0)}
                      onChange={(e) => {
                        const g = Number(e.target.value);
                        const spec =
                          GENERATION_LADDER.find((s) => s.gen === g) ??
                          GENERATION_LADDER[0];
                        handleSelectGenerationPreset(spec);
                      }}
                    >
                      {GENERATION_LADDER.map((s) => (
                        <option key={s.gen} value={s.gen}>
                          Gen {s.gen} • {s.shortTitle} ({s.paramsLabel})
                        </option>
                      ))}
                    </select>
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
                  2. SOTA Vision &amp; Spatial-RL Architectural Blocks
                </strong>
                <div className="rl-bool-toggles-grid">
                  {(
                    [
                      ['use_coord_features', '+6 CoC Tactical Coord Planes'],
                      ['use_se_attention', 'SE 59-Channel Attention'],
                      ['use_dilated_context', 'Dilated Res Context (d=2,4)'],
                      ['use_convnext_grn', 'ConvNeXt V2 7×7 + GRN'],
                      ['use_segnext_msca', 'SegNeXt Strip Attention'],
                      ['use_unet_decoder', '4-Stage U-Net Decoder'],
                      ['use_dual_spatial_head', 'Dual Troop/Spell Pointer'],
                      ['use_gated_heads', 'Sigmoid Gated Spatial Head'],
                    ] as const
                  ).map(([flagKey, label]) => {
                    const isOn = Boolean(editArch[flagKey]);
                    return (
                      <label
                        key={flagKey}
                        className={`rl-bool-chip ${isOn ? 'on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={(e) =>
                            setEditArch((prev) => ({
                              ...prev,
                              [flagKey]: e.target.checked,
                            }))
                          }
                        />
                        <span>{label}</span>
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
