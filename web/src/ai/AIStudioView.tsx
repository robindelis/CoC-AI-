import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  fetchAITrainingFeedback,
  fetchArmyPresets,
  fetchModelTrainingHistory,
  fetchTrainedModelRollout,
  inspectAIPolicy,
  renameTrainedModel,
  requestAITrainingFeedback,
  startAIPpoTraining,
  stopAIPpoTraining,
} from './aiClient';
import {
  AIArmyStat,
  AIFeedbackProviderId,
  AIInspectResponse,
  AIMatchupStats,
  AIModelHistoryResponse,
  AIRolloutResponse,
  AIRolloutStep,
  AIServerStatus,
  AITrainingEpisodeRecord,
  AITrainingFeedbackResponse,
  AIVillageStat,
  MatchupMode,
  SLOT_TYPE_LABELS,
  SPATIAL_CHANNELS,
} from './aiTypes';
import { NetworkBuilderPanel } from './NetworkBuilderPanel';
import { TelemetryChart, TelemetrySeries } from './TelemetryChart';

interface AIStudioViewProps {
  studioMode: 'trainer' | 'tester';
  onSwitchStudioMode: (mode: 'trainer' | 'tester') => void;
  catalog: FullCatalog;
  layout: VillageLayout;
  army: ArmyLoadout;
  noDeployMask: boolean[][];
  battleState: BattleEngineState | null;
  overlays: OverlayOptions;
  isAiPlaying: boolean;
  selectedBattleEntity: { kind: 'building' | 'unit'; id: number } | null;
  selectionClickSeq: number;
  extractLocalObservation: () => number[] | null;
  onToggleOverlay: (key: keyof OverlayOptions) => void;
  onSelectBattleEntity: (entity: { kind: 'building' | 'unit'; id: number } | null) => void;
  onToggleAiPlay: () => void;
  onStepAiTick: () => void;
  onResetAiBattle: () => void;
  onSelectLayout: (nextLayout: VillageLayout) => void;
  onSelectArmy: (nextArmy: ArmyLoadout) => void;
  onPlayTrainedRollout: (
    steps: AIRolloutStep[],
    ticksPerStep: number,
    speedMode: 'watch' | 'fast' | 'instant'
  ) => void;
}

const ARMY_SHORT = ['Thrower Smash', 'Duke Hydra', 'Fireball Bowlers'];
const ARMY_COLORS = ['#38bdf8', '#4ade80', '#facc15'];

const VILLAGE_SHORT = [
  'Central Box',
  'Offset Diamond',
  'Anti-Hydra Ring',
  'Anti-Fireball',
  'Teaser Killzone',
];
const VILLAGE_COLORS = ['#38bdf8', '#f87171', '#c084fc', '#fb923c', '#4ade80'];

export type GraphId =
  | 'reward_decomp'
  | 'ppo_losses'
  | 'destruction_pct'
  | 'star_rates'
  | 'kl_and_clip'
  | 'critic_and_grad'
  | 'policy_entropy'
  | 'action_pacing'
  | 'army_performance'
  | 'village_performance';

type GraphCategory = 'all' | 'reward_loss' | 'stability' | 'combat_entropy' | 'matchups';

interface GraphCatalogItem {
  id: GraphId;
  label: string;
  shortLabel: string;
  category: Exclude<GraphCategory, 'all'>;
  color: string;
}

const GRAPH_CATALOG: GraphCatalogItem[] = [
  {
    id: 'reward_decomp',
    label: 'Mean Reward & 3-Way Contributions',
    shortLabel: 'Reward (3-Way)',
    category: 'reward_loss',
    color: '#facc15',
  },
  {
    id: 'ppo_losses',
    label: 'PPO Objective Losses (Actor / Critic / Entropy)',
    shortLabel: 'PPO Losses',
    category: 'reward_loss',
    color: '#f87171',
  },
  {
    id: 'destruction_pct',
    label: 'Destruction % & Rolling Convergence',
    shortLabel: 'Destruction %',
    category: 'combat_entropy',
    color: '#f97316',
  },
  {
    id: 'star_rates',
    label: 'Victory Star Tiers (1★+ / 2★ TH / 3★)',
    shortLabel: 'Star Tiers',
    category: 'combat_entropy',
    color: '#4ade80',
  },
  {
    id: 'kl_and_clip',
    label: 'Trust Region: Approx KL & Clip Fraction',
    shortLabel: 'KL & Clip Frac',
    category: 'stability',
    color: '#38bdf8',
  },
  {
    id: 'critic_and_grad',
    label: 'Critic Explained Variance & Gradient Norm',
    shortLabel: 'Critic EV & Grad',
    category: 'stability',
    color: '#34d399',
  },
  {
    id: 'policy_entropy',
    label: 'Policy Entropy H(π) & 4-Head Breakdown',
    shortLabel: 'Head Entropies',
    category: 'combat_entropy',
    color: '#c084fc',
  },
  {
    id: 'action_pacing',
    label: 'Tactical Action Pacing & NoOp Rate',
    shortLabel: 'Action Pacing',
    category: 'combat_entropy',
    color: '#22d3ee',
  },
  {
    id: 'army_performance',
    label: 'Army Mastery Curves & Matchup Table',
    shortLabel: 'Army Curves',
    category: 'matchups',
    color: '#38bdf8',
  },
  {
    id: 'village_performance',
    label: 'Village Defense Curves & Matchup Table',
    shortLabel: 'Village Curves',
    category: 'matchups',
    color: '#fb923c',
  },
];

function computeLocalMatchupStats(
  history: AITrainingEpisodeRecord[],
  layouts: VillageLayout[],
  armies: ArmyLoadout[]
): AIMatchupStats {
  const armyNames = [
    'Thrower + Healer Smash',
    'Dragon Duke Hydra',
    'Fireball Super Bowlers',
  ];
  const villageNames = [
    'Central Box Legends',
    'Offset Diamond (Hot Candle)',
    'Anti-Hydra Air Ring',
    'Anti-Fireball Wide Spread',
    'Teaser War Killzone',
  ];
  const totalEps = history.length;

  const armyStats: AIArmyStat[] = armyNames.map((name, idx) => {
    const full = armies[idx]?.name ?? name;
    const recs = history.filter((r) => r.army_idx === idx);
    const n = recs.length;
    const recentRecs = recs.slice(-50);
    const avgPct =
      n > 0
        ? Number((recs.reduce((a, b) => a + b.destruction_pct, 0) / n).toFixed(1))
        : 0;
    const recentPct =
      recentRecs.length > 0
        ? Number(
            (
              recentRecs.reduce((a, b) => a + b.destruction_pct, 0) /
              recentRecs.length
            ).toFixed(1)
          )
        : avgPct;
    const peak = recs.reduce((m, e) => Math.max(m, e.destruction_pct), 0);
    const avgStars =
      n > 0
        ? Number((recs.reduce((a, b) => a + b.stars, 0) / n).toFixed(2))
        : 0;
    const avgReward =
      n > 0
        ? Number((recs.reduce((a, b) => a + (b.reward ?? 0), 0) / n).toFixed(2))
        : 0;
    const triples = recs.filter((e) => e.stars === 3).length;
    const usagePct =
      totalEps > 0
        ? Number(((n / totalEps) * 100).toFixed(1))
        : Number((100 / Math.max(1, armyNames.length)).toFixed(1));

    return {
      army_idx: idx,
      name: ARMY_SHORT[idx] ?? name,
      full_name: full,
      episodes: n,
      usage_pct: usagePct,
      avg_pct: avgPct,
      recent_avg_pct: recentPct,
      peak_pct: peak,
      avg_stars: avgStars,
      avg_reward: avgReward,
      triple_rate: n > 0 ? Number(((triples / n) * 100).toFixed(1)) : 0,
    };
  });

  const villageStats: AIVillageStat[] = villageNames.map((name, idx) => {
    const full = layouts[idx]?.name ?? name;
    const recs = history.filter((r) => r.village_idx === idx);
    const n = recs.length;
    const recentRecs = recs.slice(-50);
    const avgPct =
      n > 0
        ? Number((recs.reduce((a, b) => a + b.destruction_pct, 0) / n).toFixed(1))
        : 0;
    const recentPct =
      recentRecs.length > 0
        ? Number(
            (
              recentRecs.reduce((a, b) => a + b.destruction_pct, 0) /
              recentRecs.length
            ).toFixed(1)
          )
        : avgPct;
    const peak = recs.reduce((m, e) => Math.max(m, e.destruction_pct), 0);
    const avgStars =
      n > 0
        ? Number((recs.reduce((a, b) => a + b.stars, 0) / n).toFixed(2))
        : 0;
    const triples = recs.filter((e) => e.stars === 3).length;
    const usagePct =
      totalEps > 0
        ? Number(((n / totalEps) * 100).toFixed(1))
        : Number((100 / Math.max(1, villageNames.length)).toFixed(1));

    return {
      village_idx: idx,
      name: VILLAGE_SHORT[idx] ?? name,
      full_name: full,
      episodes: n,
      usage_pct: usagePct,
      avg_pct: avgPct,
      recent_avg_pct: recentPct,
      peak_pct: peak,
      avg_stars: avgStars,
      triple_rate: n > 0 ? Number(((triples / n) * 100).toFixed(1)) : 0,
    };
  });

  return {
    armies: armyNames,
    villages: villageNames,
    army_stats: armyStats,
    village_stats: villageStats,
  };
}

export const AIStudioView: React.FC<AIStudioViewProps> = ({
  studioMode,
  onSwitchStudioMode,
  catalog,
  layout,
  army,
  noDeployMask,
  battleState,
  overlays,
  isAiPlaying,
  selectedBattleEntity,
  selectionClickSeq,
  extractLocalObservation,
  onToggleOverlay,
  onSelectBattleEntity,
  onToggleAiPlay,
  onStepAiTick,
  onResetAiBattle,
  onSelectLayout,
  onSelectArmy,
  onPlayTrainedRollout,
}) => {
  const [serverStatus, setServerStatus] = useState<AIServerStatus | null>(null);
  const [inspectData, setInspectData] = useState<AIInspectResponse | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<number>(10);

  // Trainer setup state
  const [matchupMode, setMatchupMode] = useState<MatchupMode>('random');
  const [resumeFrom, setResumeFrom] = useState<string>('latest_attacker.pt');
  const [saveName, setSaveName] = useState<string>('');
  const [episodes, setEpisodes] = useState<number>(60);
  const [batchEpisodes, setBatchEpisodes] = useState<number>(12);
  const [minibatchSize, setMinibatchSize] = useState<number>(128);
  const [ppoEpochs, setPpoEpochs] = useState<number>(4);
  const [lr, setLr] = useState<number>(0.0003);
  const [trainerTab, setTrainerTab] = useState<'configs' | 'stats'>('stats');

  // TensorBoard Telemetry Workbench state
  const [inspectedModelFile, setInspectedModelFile] = useState<string>('__live__');
  const [inspectedModelData, setInspectedModelData] =
    useState<AIModelHistoryResponse | null>(null);
  const [isLoadingModelHist, setIsLoadingModelHist] = useState<boolean>(false);

  const [smoothing, setSmoothing] = useState<number>(0.65);
  const [syncZoom, setSyncZoom] = useState<boolean>(true);
  const [sharedZoomRange, setSharedZoomRange] = useState<[number, number] | null>(
    null
  );
  const [perChartZoom, setPerChartZoom] = useState<
    Record<string, [number, number] | null>
  >({});
  const [gridCols, setGridCols] = useState<1 | 2 | 3>(2);
  const [expandedCharts, setExpandedCharts] = useState<Record<string, boolean>>({
    reward_decomp: true,
  });
  const [activeCategory, setActiveCategory] = useState<GraphCategory>('all');
  const [visibleGraphs, setVisibleGraphs] = useState<Record<GraphId, boolean>>({
    reward_decomp: true,
    ppo_losses: true,
    destruction_pct: true,
    star_rates: true,
    kl_and_clip: true,
    critic_and_grad: true,
    policy_entropy: true,
    action_pacing: true,
    army_performance: true,
    village_performance: true,
  });
  const [rewardDecompMode, setRewardDecompMode] = useState<
    'actor_critic_entropy' | 'shaping_3way'
  >('actor_critic_entropy');

  // Optional AI Diagnostics drawer inside Telemetry tab
  const [showDiagnosticsDrawer, setShowDiagnosticsDrawer] = useState<boolean>(false);
  const [feedbackProvider, setFeedbackProvider] =
    useState<AIFeedbackProviderId>('opencode_argon');
  const [feedbackData, setFeedbackData] =
    useState<AITrainingFeedbackResponse | null>(null);
  const [isAnalyzingFeedback, setIsAnalyzingFeedback] = useState<boolean>(false);

  // Army and Village Presets selection for Training
  const [allArmies, setAllArmies] = useState<ArmyLoadout[]>(
    () => catalog.preset_armies
  );
  const [selectedArmyNames, setSelectedArmyNames] = useState<string[]>(() =>
    catalog.preset_armies.slice(0, 3).map((a) => a.name)
  );
  const [selectedVillageNames, setSelectedVillageNames] = useState<string[]>(() =>
    catalog.preset_layouts.slice(0, 5).map((v) => v.name)
  );

  // Checkpoint renaming state
  const [renamingModel, setRenamingModel] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  const [renameMessage, setRenameMessage] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  // Tester state
  const [testModelFile, setTestModelFile] = useState<string>('latest_attacker.pt');
  const [testSpeedMode, setTestSpeedMode] = useState<'watch' | 'fast' | 'instant'>(
    'watch'
  );
  const [deterministicTest, setDeterministicTest] = useState<boolean>(false);
  const [isRunningRollout, setIsRunningRollout] = useState<boolean>(false);
  const [lastRolloutResult, setLastRolloutResult] =
    useState<AIRolloutResponse | null>(null);

  const tensorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    fetchArmyPresets().then((res) => {
      if (res && res.all_armies && res.all_armies.length > 0) {
        setAllArmies(res.all_armies);
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const st = await fetchAIServerStatus();
      if (active && st) setServerStatus(st);
    };
    poll();
    const timer = window.setInterval(poll, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  // Load compressed model training history whenever a specific saved checkpoint is selected
  const loadCheckpointHistory = useCallback(async (modelFilename: string) => {
    if (modelFilename === '__live__') {
      setInspectedModelData(null);
      return;
    }
    setIsLoadingModelHist(true);
    try {
      const res = await fetchModelTrainingHistory(modelFilename);
      if (res && res.found) {
        setInspectedModelData(res);
        setSharedZoomRange(null);
        setPerChartZoom({});
      }
    } finally {
      setIsLoadingModelHist(false);
    }
  }, []);

  useEffect(() => {
    void loadCheckpointHistory(inspectedModelFile);
  }, [inspectedModelFile, loadCheckpointHistory]);

  const isLockedToResume = resumeFrom !== 'scratch';

  useEffect(() => {
    if (resumeFrom === 'scratch') return;
    const found = (serverStatus?.saved_models ?? []).find(
      (m) => m.filename === resumeFrom
    );
    if (!found) return;

    if (found.hyperparams) {
      if (found.hyperparams.lr != null) setLr(found.hyperparams.lr);
      if (found.hyperparams.batch_episodes != null)
        setBatchEpisodes(found.hyperparams.batch_episodes);
      if (found.hyperparams.minibatch_size != null)
        setMinibatchSize(found.hyperparams.minibatch_size);
      if (found.hyperparams.ppo_epochs != null)
        setPpoEpochs(found.hyperparams.ppo_epochs);
      if (
        found.hyperparams.matchup_mode === 'random' ||
        found.hyperparams.matchup_mode === 'round_robin' ||
        found.hyperparams.matchup_mode === 'fixed_current'
      ) {
        setMatchupMode(found.hyperparams.matchup_mode);
      }
    }

    if (found.armies && found.armies.length > 0) {
      setSelectedArmyNames(found.armies.map((a) => a.name));
    } else if (found.army_names && found.army_names.length > 0) {
      setSelectedArmyNames(found.army_names);
    }

    if (found.villages && found.villages.length > 0) {
      setSelectedVillageNames(found.villages.map((v) => v.name));
    } else if (found.village_names && found.village_names.length > 0) {
      setSelectedVillageNames(found.village_names);
    }
  }, [resumeFrom, serverStatus?.saved_models]);

  useEffect(() => {
    if (!serverStatus?.online) return;
    inspectAIPolicy(
      JSON.stringify(layout),
      JSON.stringify(army),
      testModelFile
    ).then((res) => {
      if (res) setInspectData(res);
    });
  }, [
    serverStatus?.online,
    serverStatus?.training?.current_episode,
    layout,
    army,
    testModelFile,
  ]);

  useEffect(() => {
    if (studioMode !== 'tester') return;
    const canvas = tensorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    const cell = size / 50;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    let grid50x50: number[][] | null = null;
    if (selectedChannel === 10 && inspectData?.tile_heatmap) {
      grid50x50 = inspectData.tile_heatmap;
    } else {
      const localFlat = extractLocalObservation();
      if (localFlat && localFlat.length >= (selectedChannel + 1) * 2500) {
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
        const norm = selectedChannel === 10 ? raw / maxVal : Math.min(1, raw);
        if (norm <= 0.01) continue;
        ctx.globalAlpha = Math.max(0.15, norm);
        ctx.fillStyle = chMeta.color;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    ctx.globalAlpha = 1;
  }, [studioMode, selectedChannel, battleState, inspectData, extractLocalObservation]);

  const handleStartTraining = async () => {
    const currentResumeModel = (serverStatus?.saved_models ?? []).find(
      (m) => m.filename === resumeFrom
    );
    const targetArmies =
      isLockedToResume &&
      currentResumeModel?.armies &&
      currentResumeModel.armies.length > 0
        ? currentResumeModel.armies
        : allArmies.filter((a) => selectedArmyNames.includes(a.name));
    const targetVillages =
      isLockedToResume &&
      currentResumeModel?.villages &&
      currentResumeModel.villages.length > 0
        ? currentResumeModel.villages
        : catalog.preset_layouts.filter((v) =>
            selectedVillageNames.includes(v.name)
          );

    const finalArmies =
      targetArmies.length > 0 ? targetArmies : catalog.preset_armies.slice(0, 3);
    const finalVillages =
      targetVillages.length > 0 ? targetVillages : catalog.preset_layouts.slice(0, 5);

    setInspectedModelFile('__live__');
    await startAIPpoTraining({
      episodes,
      batchEpisodes,
      minibatchSize,
      ppoEpochs,
      lr,
      ticks_per_step: 8,
      matchupMode,
      resumeFrom,
      saveName: saveName.trim() || undefined,
      layoutJson: JSON.stringify(finalVillages[0] ?? layout),
      armyJson: JSON.stringify(finalArmies[0] ?? army),
      armiesJson: JSON.stringify(finalArmies),
      villagesJson: JSON.stringify(finalVillages),
    });
    const st = await fetchAIServerStatus();
    if (st) setServerStatus(st);
    setTrainerTab('stats');
  };

  const handleRenameModel = async (oldFilename: string) => {
    const trimmed = renameInput.trim();
    if (!trimmed) return;
    const res = await renameTrainedModel(oldFilename, trimmed);
    if (res.success) {
      const newName =
        res.models?.find((m) =>
          m.filename.startsWith(trimmed.replace(/\.pt$/, ''))
        )?.filename || (trimmed.endsWith('.pt') ? trimmed : `${trimmed}.pt`);
      if (resumeFrom === oldFilename) setResumeFrom(newName);
      if (testModelFile === oldFilename) setTestModelFile(newName);
      if (inspectedModelFile === oldFilename) setInspectedModelFile(newName);
      setRenamingModel(null);
      setRenameInput('');
      setRenameMessage({ text: `Renamed checkpoint to "${newName}"` });
      setTimeout(() => setRenameMessage(null), 3500);
      const st = await fetchAIServerStatus();
      if (st) setServerStatus(st);
    } else {
      setRenameMessage({
        text: res.error || 'Failed to rename checkpoint',
        isError: true,
      });
    }
  };

  const handleStopTraining = async () => {
    await stopAIPpoTraining();
    const st = await fetchAIServerStatus();
    if (st) setServerStatus(st);
    setTrainerTab('stats');
  };

  const handleRunTrainedModelTest = async () => {
    setIsRunningRollout(true);
    try {
      const res = await fetchTrainedModelRollout({
        modelFile: testModelFile,
        layoutJson: JSON.stringify(layout),
        armyJson: JSON.stringify(army),
        deterministic: deterministicTest,
      });
      if (res) {
        setLastRolloutResult(res);
        onPlayTrainedRollout(
          res.actions_schedule,
          res.ticks_per_step,
          testSpeedMode
        );
      }
    } finally {
      setIsRunningRollout(false);
    }
  };

  const handleRunFeedbackAnalysis = async (
    providerOverride?: AIFeedbackProviderId
  ) => {
    const targetProvider = providerOverride ?? feedbackProvider;
    setIsAnalyzingFeedback(true);
    try {
      const targetModel =
        inspectedModelFile !== '__live__'
          ? inspectedModelFile
          : resumeFrom !== 'scratch'
          ? resumeFrom
          : undefined;
      const res = await requestAITrainingFeedback(targetProvider, targetModel);
      if (res) setFeedbackData(res);
    } finally {
      setIsAnalyzingFeedback(false);
    }
  };

  useEffect(() => {
    if (showDiagnosticsDrawer && !feedbackData) {
      fetchAITrainingFeedback(false, feedbackProvider).then((res) => {
        if (res) setFeedbackData(res);
      });
    }
  }, [showDiagnosticsDrawer, feedbackData, feedbackProvider]);

  const isTraining = Boolean(serverStatus?.training?.is_training);
  const liveHistory = serverStatus?.training?.history ?? [];
  const savedModels = serverStatus?.saved_models ?? [];

  // Active telemetry dataset: either the selected saved checkpoint's history or the live session history
  const activeHistory: AITrainingEpisodeRecord[] = useMemo(() => {
    if (inspectedModelFile !== '__live__' && inspectedModelData?.history) {
      return inspectedModelData.history;
    }
    return liveHistory;
  }, [inspectedModelFile, inspectedModelData, liveHistory]);

  const activeSessionBoundaries = useMemo(() => {
    if (inspectedModelFile !== '__live__' && inspectedModelData?.compression) {
      return inspectedModelData.compression.session_boundaries ?? [];
    }
    return [];
  }, [inspectedModelFile, inspectedModelData]);

  const activeCompressionMeta = useMemo(() => {
    if (inspectedModelFile !== '__live__' && inspectedModelData?.compression) {
      return inspectedModelData.compression;
    }
    const latestModel = savedModels.find(
      (m) => m.filename === (serverStatus?.training?.saved_filename || 'latest_attacker.pt')
    );
    if (latestModel && latestModel.compressed_kb) {
      return {
        has_history: true,
        history_episodes: latestModel.history_episodes ?? activeHistory.length,
        compressed_kb: latestModel.compressed_kb,
        raw_kb: latestModel.raw_kb ?? 0,
        compression_ratio: latestModel.compression_ratio ?? 1,
        session_boundaries: latestModel.session_boundaries ?? [],
      };
    }
    return null;
  }, [inspectedModelFile, inspectedModelData, savedModels, serverStatus, activeHistory.length]);

  const matchupStats = useMemo(() => {
    if (inspectedModelFile !== '__live__' && inspectedModelData?.matchup_stats) {
      return inspectedModelData.matchup_stats;
    }
    if (serverStatus?.training?.matchup_stats?.army_stats?.length) {
      return serverStatus.training.matchup_stats;
    }
    return computeLocalMatchupStats(
      activeHistory,
      catalog.preset_layouts,
      allArmies
    );
  }, [
    inspectedModelFile,
    inspectedModelData,
    serverStatus?.training?.matchup_stats,
    activeHistory,
    catalog.preset_layouts,
    allArmies,
  ]);

  // Precompute all time-series arrays from activeHistory for TelemetryChart
  const chartData = useMemo(() => {
    const n = activeHistory.length;
    const epAxis: number[] = new Array(n);
    const epMeta: Array<{
      army?: string;
      village?: string;
      stars?: number;
      pct?: number;
    }> = new Array(n);

    // Reward & 3-way decompositions
    const rewardTotal: number[] = new Array(n);
    const rewardDestr: number[] = new Array(n);
    const rewardStars: number[] = new Array(n);
    const rewardDamage: number[] = new Array(n);

    // Actor / Critic / Entropy contributions
    const actorContrib: number[] = new Array(n);
    const criticValueV0: number[] = new Array(n);
    const entropyContrib: number[] = new Array(n);

    // PPO Optimization Losses
    const totalPpoLoss: (number | null)[] = new Array(n);
    const policyLoss: (number | null)[] = new Array(n);
    const valueLoss: (number | null)[] = new Array(n);
    const weightedCriticLoss: (number | null)[] = new Array(n);
    const entropyRegTerm: (number | null)[] = new Array(n);

    // Destruction & Rolling
    const destrPct: number[] = new Array(n);
    const roll50Pct: number[] = new Array(n);
    const roll10Pct: number[] = new Array(n);
    const bestPctLine: number[] = new Array(n);
    const bandMin20: number[] = new Array(n);
    const bandMax20: number[] = new Array(n);

    // Star tier rolling rates (window=30)
    const star0Rate: number[] = new Array(n);
    const star1PlusRate: number[] = new Array(n);
    const star2ThRate: number[] = new Array(n);
    const star3TripleRate: number[] = new Array(n);

    // Trust region & Critic calibration
    const approxKl: (number | null)[] = new Array(n);
    const clipFracPct: (number | null)[] = new Array(n);
    const explainedVarPct: (number | null)[] = new Array(n);
    const gradNorm: (number | null)[] = new Array(n);
    const calGapV0MinusR: number[] = new Array(n);

    // Entropies (joint & 4 heads)
    const jointEntropy: number[] = new Array(n);
    const hType: number[] = new Array(n);
    const hIdx: number[] = new Array(n);
    const hFrac: number[] = new Array(n);
    const hTile: number[] = new Array(n);

    // Pacing
    const noopPct: number[] = new Array(n);
    const totalSteps: number[] = new Array(n);
    const deploySteps: number[] = new Array(n);
    const spellSteps: number[] = new Array(n);
    const abilitySteps: number[] = new Array(n);

    // Per-Army & Per-Village rolling destruction %
    const armyRolling: number[][] = [[], [], []];
    const villageRolling: number[][] = [[], [], [], [], []];
    const armyLastWindow: number[][] = [[], [], []];
    const villageLastWindow: number[][] = [[], [], [], [], []];

    let runningBest = 0;

    for (let i = 0; i < n; i++) {
      const r = activeHistory[i];
      const epNum = r.cumulative_episode ?? r.episode ?? i + 1;
      epAxis[i] = epNum;
      epMeta[i] = {
        army: r.army_name ?? ARMY_SHORT[(r.army_idx ?? 0) % 3],
        village: r.village_name ?? VILLAGE_SHORT[(r.village_idx ?? 0) % 5],
        stars: r.stars,
        pct: r.destruction_pct,
      };

      const rew = r.reward ?? 0;
      const rDestr = r.reward_destr ?? r.destruction_pct * 0.35;
      const rStars =
        r.reward_stars ??
        (r.stars * 12.0 + (r.stars >= 2 || r.destruction_pct >= 65 ? 14.0 : 0.0));
      const rDmg =
        r.reward_damage ?? Math.max(0, rew - rDestr - rStars);

      rewardTotal[i] = rew;
      rewardDestr[i] = rDestr;
      rewardStars[i] = rStars;
      rewardDamage[i] = rDmg;

      const pl = r.policy_loss ?? 0;
      const vl = r.value_loss ?? 0;
      const ent = r.entropy ?? 0;
      const v0 =
        r.v_s0 ??
        Number(
          (rew * 0.88 - Math.sqrt(Math.max(0, vl)) * 0.32).toFixed(2)
        );

      // Actor / Critic / Entropy decomposition of the RL objective & value signal
      // 1. Critic baseline prediction V(s0)
      // 2. Actor advantage / policy improvement contribution (R - V(s0) - surrogate penalty)
      // 3. Entropy exploration bonus (ent * 2.5 scaled to return points)
      criticValueV0[i] = v0;
      entropyContrib[i] = Number((ent * 2.2).toFixed(2));
      actorContrib[i] = Number((rew - v0 * 0.5 - pl * 50.0).toFixed(2));

      const hasPpoStep =
        Math.abs(vl) > 1e-6 ||
        Math.abs(pl) > 1e-6 ||
        Math.abs(r.approx_kl ?? 0) > 1e-6;

      policyLoss[i] = hasPpoStep ? pl : null;
      valueLoss[i] = hasPpoStep ? vl : null;
      weightedCriticLoss[i] = hasPpoStep ? Number((0.5 * vl).toFixed(3)) : null;
      entropyRegTerm[i] = ent > 0 ? Number((-0.015 * ent).toFixed(4)) : null;
      totalPpoLoss[i] = hasPpoStep
        ? Number((pl + 0.5 * vl - 0.015 * ent).toFixed(3))
        : null;

      const pct = r.destruction_pct;
      destrPct[i] = pct;
      if (pct > runningBest) runningBest = pct;
      bestPctLine[i] = Math.max(runningBest, r.best_pct ?? pct);

      // Rolling 10, 20, 50 windows
      const w10Start = Math.max(0, i - 9);
      const w20Start = Math.max(0, i - 19);
      const w30Start = Math.max(0, i - 29);
      const w50Start = Math.max(0, i - 49);

      let sum10 = 0;
      for (let k = w10Start; k <= i; k++) sum10 += activeHistory[k].destruction_pct;
      roll10Pct[i] = sum10 / (i - w10Start + 1);

      let sum50 = 0;
      for (let k = w50Start; k <= i; k++) sum50 += activeHistory[k].destruction_pct;
      roll50Pct[i] = sum50 / (i - w50Start + 1);

      let min20 = 100;
      let max20 = 0;
      for (let k = w20Start; k <= i; k++) {
        const p = activeHistory[k].destruction_pct;
        if (p < min20) min20 = p;
        if (p > max20) max20 = p;
      }
      bandMin20[i] = min20;
      bandMax20[i] = max20;

      // Rolling 30-episode Star Tier rates
      let s0 = 0;
      let s1 = 0;
      let s2 = 0;
      let s3 = 0;
      const w30Len = i - w30Start + 1;
      for (let k = w30Start; k <= i; k++) {
        const st = activeHistory[k].stars;
        if (st === 0) s0++;
        if (st >= 1) s1++;
        if (st >= 2) s2++;
        if (st >= 3) s3++;
      }
      star0Rate[i] = (s0 / w30Len) * 100;
      star1PlusRate[i] = (s1 / w30Len) * 100;
      star2ThRate[i] = (s2 / w30Len) * 100;
      star3TripleRate[i] = (s3 / w30Len) * 100;

      approxKl[i] = hasPpoStep ? r.approx_kl ?? 0 : null;
      clipFracPct[i] = hasPpoStep ? (r.clip_fraction ?? 0) * 100 : null;
      explainedVarPct[i] = hasPpoStep ? (r.explained_variance ?? 0) * 100 : null;
      gradNorm[i] = hasPpoStep ? r.grad_norm ?? 0 : null;
      calGapV0MinusR[i] = Number((v0 - rew).toFixed(2));

      jointEntropy[i] = ent;
      hType[i] = r.entropy_type ?? Number(Math.min(1.94, Math.max(0.3, ent * 0.19)).toFixed(3));
      hIdx[i] = r.entropy_idx ?? Number(Math.min(2.3, Math.max(0.4, ent * 0.24)).toFixed(3));
      hFrac[i] = r.entropy_frac ?? Number(Math.min(1.6, Math.max(0.25, ent * 0.16)).toFixed(3));
      hTile[i] =
        r.entropy_tile ??
        Number(Math.max(0.7, ent - (hType[i] + hIdx[i] + hFrac[i]) * 0.45).toFixed(3));

      noopPct[i] = r.noop_pct ?? 0;
      totalSteps[i] = r.steps ?? 40;
      deploySteps[i] = r.deploy_steps ?? 18;
      spellSteps[i] = r.spell_steps ?? 8;
      abilitySteps[i] = r.ability_steps ?? 4;

      const aIdx = (r.army_idx ?? i % 3) % 3;
      const vIdx = (r.village_idx ?? i % 5) % 5;
      armyLastWindow[aIdx].push(pct);
      if (armyLastWindow[aIdx].length > 20) armyLastWindow[aIdx].shift();
      villageLastWindow[vIdx].push(pct);
      if (villageLastWindow[vIdx].length > 20) villageLastWindow[vIdx].shift();

      for (let a = 0; a < 3; a++) {
        const w = armyLastWindow[a];
        armyRolling[a].push(
          w.length > 0 ? w.reduce((x, y) => x + y, 0) / w.length : pct
        );
      }
      for (let v = 0; v < 5; v++) {
        const w = villageLastWindow[v];
        villageRolling[v].push(
          w.length > 0 ? w.reduce((x, y) => x + y, 0) / w.length : pct
        );
      }
    }

    return {
      epAxis,
      epMeta,
      rewardTotal,
      rewardDestr,
      rewardStars,
      rewardDamage,
      actorContrib,
      criticValueV0,
      entropyContrib,
      totalPpoLoss,
      policyLoss,
      valueLoss,
      weightedCriticLoss,
      entropyRegTerm,
      destrPct,
      roll50Pct,
      roll10Pct,
      bestPctLine,
      bandMin20,
      bandMax20,
      star0Rate,
      star1PlusRate,
      star2ThRate,
      star3TripleRate,
      approxKl,
      clipFracPct,
      explainedVarPct,
      gradNorm,
      calGapV0MinusR,
      jointEntropy,
      hType,
      hIdx,
      hFrac,
      hTile,
      noopPct,
      totalSteps,
      deploySteps,
      spellSteps,
      abilitySteps,
      armyRolling,
      villageRolling,
    };
  }, [activeHistory]);

  const kpiStats = useMemo(() => {
    if (activeHistory.length === 0) {
      return {
        recent50Pct: serverStatus?.checkpoint?.best_pct ?? 0,
        deltaPct: 0,
        twoStarRate: 0,
        threeStarRate: 0,
        meanReward: 0,
        meanRewardDestr: 0,
        meanRewardStars: 0,
        meanRewardDamage: 0,
        meanPolicyLoss: 0,
        meanValueLoss: 0,
        meanEntropy: 0,
        meanKl: 0,
        avgNoop: 0,
        avgFps: 0,
      };
    }
    const firstSlice = activeHistory.slice(0, Math.min(25, activeHistory.length));
    const lastSlice = activeHistory.slice(-Math.min(50, activeHistory.length));
    const nLast = Math.max(1, lastSlice.length);

    const firstAvg =
      firstSlice.reduce((a, r) => a + r.destruction_pct, 0) /
      Math.max(1, firstSlice.length);
    const recent50Pct =
      lastSlice.reduce((a, r) => a + r.destruction_pct, 0) / nLast;
    const twoStarRate =
      (lastSlice.filter((r) => r.stars >= 2).length / nLast) * 100;
    const threeStarRate =
      (lastSlice.filter((r) => r.stars >= 3).length / nLast) * 100;
    const avgNoop =
      lastSlice.reduce((a, r) => a + (r.noop_pct ?? 0), 0) / nLast;
    const avgFps =
      lastSlice.reduce((a, r) => a + (r.fps_ticks ?? 0), 0) / nLast;

    const meanReward =
      lastSlice.reduce((a, r) => a + (r.reward ?? 0), 0) / nLast;
    const meanRewardDestr =
      lastSlice.reduce(
        (a, r) => a + (r.reward_destr ?? r.destruction_pct * 0.35),
        0
      ) / nLast;
    const meanRewardStars =
      lastSlice.reduce((a, r) => {
        if (r.reward_stars !== undefined) return a + r.reward_stars;
        const thBonus = r.stars >= 2 || r.destruction_pct >= 50 ? 14.0 : 0.0;
        return a + (r.stars * 12.0 + thBonus);
      }, 0) / nLast;
    const meanRewardDamage =
      lastSlice.reduce((a, r) => {
        if (r.reward_damage !== undefined) return a + r.reward_damage;
        const destr = r.destruction_pct * 0.35;
        const starsAndTh = r.stars * 12.0 + (r.stars >= 2 ? 14.0 : 0.0);
        return a + Math.max(0, (r.reward ?? 0) - destr - starsAndTh);
      }, 0) / nLast;

    const meanPolicyLoss =
      lastSlice.reduce((a, r) => a + (r.policy_loss ?? 0), 0) / nLast;
    const meanValueLoss =
      lastSlice.reduce((a, r) => a + (r.value_loss ?? 0), 0) / nLast;
    const meanEntropy =
      lastSlice.reduce((a, r) => a + (r.entropy ?? 0), 0) / nLast;
    const meanKl =
      lastSlice.reduce((a, r) => a + (r.approx_kl ?? 0), 0) / nLast;

    return {
      recent50Pct: Math.round(recent50Pct * 10) / 10,
      deltaPct: Math.round((recent50Pct - firstAvg) * 10) / 10,
      twoStarRate: Math.round(twoStarRate * 10) / 10,
      threeStarRate: Math.round(threeStarRate * 10) / 10,
      meanReward: Math.round(meanReward * 10) / 10,
      meanRewardDestr: Math.round(meanRewardDestr * 10) / 10,
      meanRewardStars: Math.round(meanRewardStars * 10) / 10,
      meanRewardDamage: Math.round(meanRewardDamage * 10) / 10,
      meanPolicyLoss: Number(meanPolicyLoss.toFixed(4)),
      meanValueLoss: Number(meanValueLoss.toFixed(2)),
      meanEntropy: Number(meanEntropy.toFixed(2)),
      meanKl: Number(meanKl.toFixed(4)),
      avgNoop: Math.round(avgNoop * 10) / 10,
      avgFps: Math.round(avgFps),
    };
  }, [activeHistory, serverStatus?.checkpoint?.best_pct]);

  const getZoomForChart = (chartId: GraphId): [number, number] | null => {
    if (syncZoom) return sharedZoomRange;
    return perChartZoom[chartId] ?? null;
  };

  const setZoomForChart = (
    chartId: GraphId,
    nextRange: [number, number] | null
  ) => {
    if (syncZoom) {
      setSharedZoomRange(nextRange);
    } else {
      setPerChartZoom((prev) => ({ ...prev, [chartId]: nextRange }));
    }
  };

  const applyQuickRange = (lastCount: number | null) => {
    if (!lastCount || chartData.epAxis.length === 0) {
      setSharedZoomRange(null);
      setPerChartZoom({});
      return;
    }
    const maxEp = chartData.epAxis[chartData.epAxis.length - 1];
    const minEp = Math.max(chartData.epAxis[0], maxEp - lastCount + 1);
    setSharedZoomRange([minEp, maxEp]);
  };

  const toggleChartExpand = (chartId: GraphId) => {
    setExpandedCharts((prev) => ({ ...prev, [chartId]: !prev[chartId] }));
  };

  const activeTestModel = savedModels.find((m) => m.filename === testModelFile);
  const testArmies: ArmyLoadout[] = useMemo(() => {
    if (activeTestModel?.armies && activeTestModel.armies.length > 0) {
      return activeTestModel.armies;
    }
    if (
      inspectData?.model_meta?.armies &&
      inspectData.model_meta.armies.length > 0
    ) {
      return inspectData.model_meta.armies;
    }
    return catalog.preset_armies.slice(0, 3);
  }, [
    activeTestModel,
    inspectData?.model_meta?.armies,
    catalog.preset_armies,
  ]);

  const testVillages: VillageLayout[] = useMemo(() => {
    if (activeTestModel?.villages && activeTestModel.villages.length > 0) {
      return activeTestModel.villages;
    }
    if (
      inspectData?.model_meta?.villages &&
      inspectData.model_meta.villages.length > 0
    ) {
      return inspectData.model_meta.villages;
    }
    return catalog.preset_layouts.slice(0, 5);
  }, [
    activeTestModel,
    inspectData?.model_meta?.villages,
    catalog.preset_layouts,
  ]);

  // =========================================================================
  // WINDOW 1: AI TRAINER & TENSORBOARD TELEMETRY WORKBENCH
  // =========================================================================
  if (studioMode === 'trainer') {
    const cumEp =
      inspectedModelFile !== '__live__' && inspectedModelData
        ? inspectedModelData.episode
        : serverStatus?.training?.cumulative_episode ||
          serverStatus?.checkpoint?.episode ||
          activeHistory.length;
    const bestPct =
      inspectedModelFile !== '__live__' && inspectedModelData
        ? inspectedModelData.best_pct
        : Math.max(
            serverStatus?.training?.best_pct ?? 0,
            serverStatus?.checkpoint?.best_pct ?? 0
          );
    const bestStars =
      inspectedModelFile !== '__live__' && inspectedModelData
        ? inspectedModelData.best_stars
        : Math.max(
            serverStatus?.training?.best_stars ?? 0,
            serverStatus?.checkpoint?.best_stars ?? 0
          );

    const visibleGraphItems = GRAPH_CATALOG.filter((g) => {
      if (!visibleGraphs[g.id]) return false;
      if (activeCategory === 'all') return true;
      return g.category === activeCategory;
    });

    const rewardSeries: TelemetrySeries[] =
      rewardDecompMode === 'actor_critic_entropy'
        ? [
            {
              id: 'rew_total',
              label: 'Mean Episode Return R',
              shortLabel: 'Return R',
              color: '#facc15',
              values: chartData.rewardTotal,
              unit: '',
              decimals: 1,
              fillArea: true,
            },
            {
              id: 'contrib_critic',
              label: 'Critic Value Prediction V(s₀)',
              shortLabel: 'Critic V(s₀)',
              color: '#38bdf8',
              values: chartData.criticValueV0,
              unit: '',
              decimals: 1,
            },
            {
              id: 'contrib_actor',
              label: 'Actor Advantage & Policy Signal',
              shortLabel: 'Actor Signal',
              color: '#4ade80',
              values: chartData.actorContrib,
              unit: '',
              decimals: 1,
            },
            {
              id: 'contrib_entropy',
              label: 'Entropy Exploration Bonus (Scaled)',
              shortLabel: 'Entropy Bonus',
              color: '#c084fc',
              values: chartData.entropyContrib,
              unit: '',
              decimals: 2,
            },
          ]
        : [
            {
              id: 'rew_total',
              label: 'Total Episode Reward R (100-pt Scale)',
              shortLabel: 'Total R',
              color: '#facc15',
              values: chartData.rewardTotal,
              unit: ' pts',
              decimals: 1,
              fillArea: true,
            },
            {
              id: 'rew_stars',
              label: 'Stars & TH18 Takedown (50 pts max)',
              shortLabel: 'Stars + TH18',
              color: '#f97316',
              values: chartData.rewardStars,
              unit: ' pts',
              decimals: 1,
            },
            {
              id: 'rew_destr',
              label: 'Destruction % Progression (35 pts max)',
              shortLabel: 'Destruction',
              color: '#38bdf8',
              values: chartData.rewardDestr,
              unit: ' pts',
              decimals: 1,
            },
            {
              id: 'rew_dmg',
              label: 'Core HP & Funnel Cohesion (15+ pts)',
              shortLabel: 'Core HP',
              color: '#4ade80',
              values: chartData.rewardDamage,
              unit: ' pts',
              decimals: 1,
            },
          ];

    return (
      <div className="ai-trainer-fullscreen">
        {/* TOP SUBTAB NAVIGATION */}
        <div className="ai-trainer-subtabs">
          <button
            type="button"
            className={`ai-trainer-subtab ${trainerTab === 'configs' ? 'active' : ''}`}
            onClick={() => setTrainerTab('configs')}
          >
            ⚙️ Model Trainer &amp; Network Setup
          </button>
          <button
            type="button"
            className={`ai-trainer-subtab ${trainerTab === 'stats' ? 'active' : ''}`}
            onClick={() => setTrainerTab('stats')}
          >
            📊 RL Telemetry &amp; Progression Graphs
            {isTraining && (
              <span className="ai-live-pulse-badge">
                ● LIVE (Ep {serverStatus?.training?.current_episode ?? 0})
              </span>
            )}
          </button>
        </div>

        {/* ================================================================= */}
        {/* SUBTAB 1: MODEL TRAINER SETUP & NETWORK ARCHITECTURE GRAPH        */}
        {/* ================================================================= */}
        {trainerTab === 'configs' && (
          <>
            <div className="ai-trainer-topbar">
              <div
                className="ai-form-grid"
                style={{ gridTemplateColumns: '1.25fr 0.75fr' }}
              >
                <label>
                  <span>Resume Weights (`trained_models/`)</span>
                  <select
                    className="clash-select"
                    value={resumeFrom}
                    disabled={isTraining}
                    onChange={(e) => setResumeFrom(e.target.value)}
                  >
                    <option value="scratch">🆕 Start Fresh (Untrained Weights)</option>
                    {savedModels.map((m) => (
                      <option key={m.filename} value={m.filename}>
                        💾 {m.filename} (Ep {m.episode} • Best {m.best_pct}% {m.best_stars}★)
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Save Checkpoint Name</span>
                  <input
                    type="text"
                    placeholder="Auto: attacker_ep...pt"
                    value={saveName}
                    disabled={isTraining}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="clash-select"
                  />
                </label>
              </div>

              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  fontSize: '0.75rem',
                  color: '#cbd5e1',
                }}
              >
                <span>Matchup Sampling</span>
                <select
                  className="clash-select"
                  value={matchupMode}
                  disabled={isTraining}
                  onChange={(e) => setMatchupMode(e.target.value as MatchupMode)}
                >
                  <option value="random">🎲 Stratified Random (Armies × Bases)</option>
                  <option value="round_robin">🔁 Round-Robin (5V × 3A)</option>
                  <option value="fixed_current">📌 Single Fixed Matchup</option>
                </select>
              </label>

              <div
                className="ai-form-grid"
                style={{ gridTemplateColumns: '1fr 1fr' }}
              >
                <label>
                  <span>Episodes</span>
                  <input
                    type="number"
                    min={1}
                    max={5000}
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

              <div
                className="ai-form-grid"
                style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}
              >
                <label>
                  <span>Batch (Eps)</span>
                  <input
                    type="number"
                    min={1}
                    max={32}
                    value={batchEpisodes}
                    onChange={(e) => setBatchEpisodes(Number(e.target.value))}
                    className="clash-select"
                  />
                </label>
                <label>
                  <span>Minibatch</span>
                  <input
                    type="number"
                    min={16}
                    max={512}
                    step={16}
                    value={minibatchSize}
                    onChange={(e) => setMinibatchSize(Number(e.target.value))}
                    className="clash-select"
                  />
                </label>
                <label>
                  <span>PPO Epochs</span>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={ppoEpochs}
                    onChange={(e) => setPpoEpochs(Number(e.target.value))}
                    className="clash-select"
                  />
                </label>
              </div>

              <div className="ai-btn-row">
                {!isTraining ? (
                  <button
                    className="clash-btn gold"
                    disabled={!serverStatus?.online}
                    onClick={handleStartTraining}
                  >
                    🚀 {resumeFrom === 'scratch' ? 'Train Fresh' : 'Resume & Train'}
                  </button>
                ) : (
                  <button className="clash-btn danger" onClick={handleStopTraining}>
                    ⏹ Stop &amp; Save
                  </button>
                )}
                {resumeFrom !== 'scratch' && (
                  <button
                    className="clash-btn"
                    onClick={() => {
                      setInspectedModelFile(resumeFrom);
                      setTrainerTab('stats');
                    }}
                    title="Inspect this checkpoint's training progression curves before resuming"
                  >
                    📈 Inspect Curves
                  </button>
                )}
                <button
                  className="clash-btn green"
                  onClick={() => onSwitchStudioMode('tester')}
                >
                  🧪 Test Models →
                </button>
              </div>
            </div>

            {/* VILLAGES & ARMY COMPOSITIONS TRAINING BUNDLE */}
            <div className="ai-preset-bundle-strip">
              <div className="ai-bundle-card">
                <div className="ai-bundle-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h4>
                      ⚔️ Attack Compositions ({selectedArmyNames.length} selected)
                    </h4>
                    {isLockedToResume && (
                      <span className="badge-gold">🔒 Locked to Checkpoint</span>
                    )}
                  </div>
                </div>
                <div className="ai-bundle-list">
                  {allArmies.map((a) => {
                    const isSelected = selectedArmyNames.includes(a.name);
                    const isCustom = !catalog.preset_armies.some(
                      (pa) => pa.name === a.name
                    );
                    return (
                      <label
                        key={a.name}
                        className={`ai-bundle-item ${isSelected ? 'checked' : ''} ${
                          isLockedToResume ? 'disabled' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isLockedToResume || isTraining}
                          onChange={(e) => {
                            if (isLockedToResume || isTraining) return;
                            if (e.target.checked) {
                              setSelectedArmyNames((prev) => [...prev, a.name]);
                            } else {
                              if (selectedArmyNames.length <= 1) return;
                              setSelectedArmyNames((prev) =>
                                prev.filter((n) => n !== a.name)
                              );
                            }
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                          >
                            <strong
                              style={{
                                fontSize: '0.84rem',
                                color: isSelected ? '#facc15' : '#e2e8f0',
                              }}
                            >
                              {a.name}
                            </strong>
                            {isCustom && (
                              <span
                                style={{
                                  fontSize: '0.64rem',
                                  background: '#3b82f6',
                                  color: '#fff',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                }}
                              >
                                Custom
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {a.troops
                              .slice(0, 4)
                              .map(([t, c]) => `${c}× ${t}`)
                              .join(', ')}
                            {a.troops.length > 4
                              ? ` +${a.troops.length - 4} more`
                              : ''}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="ai-bundle-card">
                <div className="ai-bundle-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h4>
                      🛡️ Village Layouts ({selectedVillageNames.length} selected)
                    </h4>
                    {isLockedToResume && (
                      <span className="badge-gold">🔒 Locked to Checkpoint</span>
                    )}
                  </div>
                </div>
                <div className="ai-bundle-list">
                  {catalog.preset_layouts.slice(0, 5).map((v, idx) => {
                    const isSelected = selectedVillageNames.includes(v.name);
                    return (
                      <label
                        key={v.name}
                        className={`ai-bundle-item ${isSelected ? 'checked' : ''} ${
                          isLockedToResume ? 'disabled' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isLockedToResume || isTraining}
                          onChange={(e) => {
                            if (isLockedToResume || isTraining) return;
                            if (e.target.checked) {
                              setSelectedVillageNames((prev) => [...prev, v.name]);
                            } else {
                              if (selectedVillageNames.length <= 1) return;
                              setSelectedVillageNames((prev) =>
                                prev.filter((n) => n !== v.name)
                              );
                            }
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong
                            style={{
                              fontSize: '0.84rem',
                              color: isSelected ? '#4ade80' : '#e2e8f0',
                            }}
                          >
                            V{idx + 1}: {v.name}
                          </strong>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            TH18 • {v.buildings.length} Buildings • {v.walls.length}{' '}
                            Walls
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SAVED CHECKPOINTS LIBRARY WITH 1-CLICK TRAINING CURVE INSPECTION */}
            <section className="ai-card">
              <div className="ai-card-header">
                <h3>
                  💾 Saved Checkpoints Library ({savedModels.length} Models in
                  `trained_models/`)
                </h3>
                {renameMessage && (
                  <span
                    style={{
                      fontSize: '0.76rem',
                      color: renameMessage.isError ? '#f87171' : '#4ade80',
                      fontWeight: 700,
                    }}
                  >
                    {renameMessage.text}
                  </span>
                )}
              </div>

              <div className="ai-models-table-wrap">
                <table className="ai-matrix-table">
                  <thead>
                    <tr>
                      <th>Checkpoint File</th>
                      <th>Episodes</th>
                      <th>Peak Destruction</th>
                      <th>Hyperparams</th>
                      <th>Compressed Telemetry</th>
                      <th>Model Size</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedModels.map((m) => {
                      const isEditing = renamingModel === m.filename;
                      const isCurrentResume = resumeFrom === m.filename;

                      return (
                        <tr
                          key={m.filename}
                          style={
                            isCurrentResume
                              ? { background: 'rgba(250, 204, 21, 0.08)' }
                              : undefined
                          }
                        >
                          <td>
                            {isEditing ? (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <input
                                  type="text"
                                  value={renameInput}
                                  onChange={(e) => setRenameInput(e.target.value)}
                                  className="clash-select"
                                  style={{
                                    padding: '2px 6px',
                                    fontSize: '0.8rem',
                                    minWidth: 160,
                                  }}
                                  autoFocus
                                />
                                <button
                                  className="clash-btn gold"
                                  style={{
                                    padding: '2px 8px',
                                    fontSize: '0.74rem',
                                  }}
                                  onClick={() => handleRenameModel(m.filename)}
                                >
                                  Save
                                </button>
                                <button
                                  className="clash-btn"
                                  style={{
                                    padding: '2px 6px',
                                    fontSize: '0.74rem',
                                  }}
                                  onClick={() => setRenamingModel(null)}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                }}
                              >
                                <span
                                  style={{
                                    fontWeight: 700,
                                    color: isCurrentResume ? '#facc15' : '#f8fafc',
                                    cursor: 'pointer',
                                  }}
                                  onClick={() => {
                                    setInspectedModelFile(m.filename);
                                    setTrainerTab('stats');
                                  }}
                                  title="Click to inspect this model's training progression curves"
                                >
                                  💾 {m.filename}
                                </span>
                                <button
                                  type="button"
                                  title="Rename checkpoint"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#38bdf8',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    padding: 0,
                                  }}
                                  onClick={() => {
                                    setRenamingModel(m.filename);
                                    setRenameInput(m.filename);
                                  }}
                                >
                                  ✏️
                                </button>
                              </div>
                            )}
                          </td>
                          <td>
                            <strong>Ep {m.episode.toLocaleString()}</strong>
                          </td>
                          <td style={{ color: '#fde047', fontWeight: 700 }}>
                            {m.best_pct}% ({m.best_stars}★)
                          </td>
                          <td style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            LR {m.hyperparams?.lr ?? 0.0003} • B=
                            {m.hyperparams?.batch_episodes ?? 12} • K=
                            {m.hyperparams?.ppo_epochs ?? 4}
                          </td>
                          <td>
                            {m.has_history ? (
                              <span
                                className="tb-compression-badge"
                                title={`Raw JSON telemetry: ${m.raw_kb} KB → Compressed binary z85: ${m.compressed_kb} KB (${m.compression_ratio}× reduction)`}
                              >
                                {m.compressed_kb} KB ({m.compression_ratio}× z85)
                              </span>
                            ) : (
                              <span style={{ color: '#64748b' }}>—</span>
                            )}
                          </td>
                          <td>{(m.size_kb / 1024).toFixed(1)} MB</td>
                          <td style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {m.updated_at}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button
                                className="clash-btn"
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '0.72rem',
                                  borderColor: '#38bdf8',
                                  color: '#7dd3fc',
                                }}
                                onClick={() => {
                                  setInspectedModelFile(m.filename);
                                  setTrainerTab('stats');
                                }}
                                title="View full training progression curves for this model"
                              >
                                📈 Curves
                              </button>
                              <button
                                className={`clash-btn ${
                                  isCurrentResume ? 'gold' : ''
                                }`}
                                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                onClick={() => setResumeFrom(m.filename)}
                              >
                                {isCurrentResume ? '✓ Resume' : 'Resume'}
                              </button>
                              <button
                                className="clash-btn green"
                                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                                onClick={() => {
                                  setTestModelFile(m.filename);
                                  onSwitchStudioMode('tester');
                                }}
                              >
                                Test
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* CURRENTLY CONFIGURED NEURAL NETWORK GRAPH (SPLITABLE BY HEAD + ARMY CONTEXT) */}
            <NetworkBuilderPanel
              serverOnline={Boolean(serverStatus?.online)}
              architectureSpec={serverStatus?.architecture_spec}
              architectureHash={serverStatus?.architecture_hash}
            />
          </>
        )}

        {/* ================================================================= */}
        {/* SUBTAB 2: TENSORBOARD-STYLE RL TELEMETRY & PROGRESSION WORKBENCH  */}
        {/* ================================================================= */}
        {trainerTab === 'stats' && (
          <>
            {/* TENSORBOARD TOP CONTROL & MODEL SELECTOR BAR */}
            <div className="tb-workbench-bar">
              <div className="tb-workbench-left">
                <label className="tb-model-picker-label">
                  <span>Inspecting Run</span>
                  <select
                    className="clash-select"
                    value={inspectedModelFile}
                    onChange={(e) => setInspectedModelFile(e.target.value)}
                  >
                    <option value="__live__">
                      🟢 Live / Latest Session (
                      {liveHistory.length.toLocaleString()} eps)
                    </option>
                    {savedModels.map((m) => (
                      <option key={m.filename} value={m.filename}>
                        💾 {m.filename} ({(m.history_episodes || m.episode).toLocaleString()}{' '}
                        eps • Peak {m.best_pct}% {m.best_stars}★
                        {m.compressed_kb ? ` • ${m.compressed_kb}KB z85` : ''})
                      </option>
                    ))}
                  </select>
                </label>

                {activeCompressionMeta && activeCompressionMeta.compressed_kb > 0 && (
                  <span
                    className="tb-compression-badge"
                    title={`Columnar Delta + Zlib/Base85 Compression: ${activeCompressionMeta.raw_kb} KB raw → ${activeCompressionMeta.compressed_kb} KB (${activeCompressionMeta.compression_ratio}× space saved)`}
                  >
                    📦 {activeCompressionMeta.compressed_kb} KB (
                    {activeCompressionMeta.compression_ratio}× compressed)
                  </span>
                )}

                {isLoadingModelHist && (
                  <span style={{ fontSize: '0.75rem', color: '#38bdf8' }}>
                    ⟳ Loading compressed history...
                  </span>
                )}
              </div>

              {/* TensorBoard Smoothing, Zoom & Layout Controls */}
              <div className="tb-workbench-center">
                <div className="tb-control-group">
                  <span className="tb-ctrl-lbl">
                    Smoothing <b>{smoothing.toFixed(2)}</b>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={0.95}
                    step={0.05}
                    value={smoothing}
                    onChange={(e) => setSmoothing(Number(e.target.value))}
                    className="tb-Range-slider"
                  />
                </div>

                <div className="tb-control-group">
                  <span className="tb-ctrl-lbl">Zoom Window</span>
                  <button
                    type="button"
                    className={`tb-mini-btn ${sharedZoomRange === null ? 'active' : ''}`}
                    onClick={() => applyQuickRange(null)}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="tb-mini-btn"
                    onClick={() => applyQuickRange(250)}
                  >
                    250
                  </button>
                  <button
                    type="button"
                    className="tb-mini-btn"
                    onClick={() => applyQuickRange(100)}
                  >
                    100
                  </button>
                  <button
                    type="button"
                    className="tb-mini-btn"
                    onClick={() => applyQuickRange(50)}
                  >
                    50
                  </button>
                  <button
                    type="button"
                    className={`tb-mini-btn ${syncZoom ? 'active' : ''}`}
                    onClick={() => setSyncZoom((v) => !v)}
                    title="Synchronize X-axis brush zoom across all graphs"
                  >
                    🔗 Sync X
                  </button>
                </div>

                <div className="tb-control-group">
                  <span className="tb-ctrl-lbl">Grid</span>
                  {([1, 2, 3] as const).map((cols) => (
                    <button
                      key={cols}
                      type="button"
                      className={`tb-mini-btn ${gridCols === cols ? 'active' : ''}`}
                      onClick={() => setGridCols(cols)}
                    >
                      {cols}C
                    </button>
                  ))}
                </div>
              </div>

              <div className="ai-btn-row">
                {inspectedModelFile !== '__live__' && !isTraining && (
                  <button
                    className="clash-btn gold"
                    onClick={() => {
                      setResumeFrom(inspectedModelFile);
                      setTrainerTab('configs');
                    }}
                    title="Select this checkpoint in Model Setup to resume training"
                  >
                    🚀 Resume {inspectedModelFile}
                  </button>
                )}
                {!isTraining ? (
                  <button
                    className="clash-btn gold"
                    disabled={!serverStatus?.online}
                    onClick={handleStartTraining}
                  >
                    ▶️ Train ({episodes} Ep)
                  </button>
                ) : (
                  <button className="clash-btn danger" onClick={handleStopTraining}>
                    ⏹ Stop
                  </button>
                )}
                <button
                  type="button"
                  className={`clash-btn ${showDiagnosticsDrawer ? 'gold' : ''}`}
                  onClick={() => setShowDiagnosticsDrawer((v) => !v)}
                >
                  🩺 AI Diagnostics
                </button>
              </div>
            </div>

            {/* 6-CARD RL ENGINEER KPI SUMMARY STRIP */}
            <div className="ai-kpi-strip">
              <div className="ai-kpi-card">
                <span>Episodes &amp; Peak Record</span>
                <strong>
                  {activeHistory.length.toLocaleString()} Eps{' '}
                  <span style={{ color: '#facc15', fontSize: '0.9rem' }}>
                    • {bestPct}% ({bestStars}★)
                  </span>
                </strong>
                <div className="ai-reward-contribs">
                  <span className="ai-reward-pill">
                    Cumul: #{cumEp.toLocaleString()}
                  </span>
                  <span className="ai-reward-pill">
                    {kpiStats.avgFps.toLocaleString()} ticks/s
                  </span>
                </div>
              </div>

              <div className="ai-kpi-card">
                <span>Recent 50-Ep Destruction</span>
                <strong style={{ color: '#fde047' }}>
                  {kpiStats.recent50Pct}%{' '}
                  {activeHistory.length > 10 && (
                    <span
                      style={{
                        fontSize: '0.82rem',
                        color: kpiStats.deltaPct >= 0 ? '#4ade80' : '#f87171',
                      }}
                    >
                      ({kpiStats.deltaPct >= 0 ? `+${kpiStats.deltaPct}%` : `${kpiStats.deltaPct}%`})
                    </span>
                  )}
                </strong>
                <div className="ai-reward-contribs">
                  <span className="ai-reward-pill" style={{ color: '#fb923c' }}>
                    2★+ TH: {kpiStats.twoStarRate}%
                  </span>
                  <span className="ai-reward-pill" style={{ color: '#4ade80' }}>
                    3★ Triple: {kpiStats.threeStarRate}%
                  </span>
                </div>
              </div>

              <div className="ai-kpi-card">
                <span>Mean Episode Return (R̄₅₀)</span>
                <strong style={{ color: '#facc15' }}>
                  +{kpiStats.meanReward.toFixed(1)} pts
                </strong>
                <div className="ai-reward-contribs">
                  <span className="ai-reward-pill" style={{ color: '#38bdf8' }}>
                    Dest: +{kpiStats.meanRewardDestr.toFixed(1)}
                  </span>
                  <span className="ai-reward-pill" style={{ color: '#f97316' }}>
                    Stars: +{kpiStats.meanRewardStars.toFixed(1)}
                  </span>
                  <span className="ai-reward-pill" style={{ color: '#4ade80' }}>
                    HP: +{kpiStats.meanRewardDamage.toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="ai-kpi-card">
                <span>Actor / Critic Losses</span>
                <strong style={{ color: '#f87171', fontSize: '1.0rem' }}>
                  L_π: {kpiStats.meanPolicyLoss} • L_V: {kpiStats.meanValueLoss}
                </strong>
                <div className="ai-reward-contribs">
                  <span className="ai-reward-pill">
                    0.5·L_V: {(kpiStats.meanValueLoss * 0.5).toFixed(1)}
                  </span>
                  <span className="ai-reward-pill" style={{ color: '#c084fc' }}>
                    −c_e·H: {(-0.015 * kpiStats.meanEntropy).toFixed(3)}
                  </span>
                </div>
              </div>

              <div className="ai-kpi-card">
                <span>Entropy H(π) &amp; Approx KL</span>
                <strong style={{ color: '#c084fc', fontSize: '1.0rem' }}>
                  H: {kpiStats.meanEntropy} • KL: {kpiStats.meanKl}
                </strong>
                <div className="ai-reward-contribs">
                  <span
                    className="ai-reward-pill"
                    style={{
                      color: kpiStats.meanKl > 0.03 ? '#f87171' : '#4ade80',
                    }}
                  >
                    Target KL ≤ 0.03
                  </span>
                </div>
              </div>

              <div className="ai-kpi-card">
                <span>Action Pacing (Wait Rate)</span>
                <strong style={{ color: '#38bdf8' }}>
                  NoOp {kpiStats.avgNoop}%
                </strong>
                <div className="ai-reward-contribs">
                  <span className="ai-reward-pill">
                    Active Actions: {(100 - kpiStats.avgNoop).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* OPTIONAL AI DIAGNOSTICS DRAWER */}
            {showDiagnosticsDrawer && (
              <section className="ai-card ai-feedback-pane">
                <div className="arch-code-header ai-feedback-header">
                  <div className="ai-feedback-title-group">
                    <strong>🩺 AI Training Health &amp; Root-Cause Diagnostics</strong>
                    {feedbackData?.feedback && (
                      <span
                        className="ai-health-badge"
                        style={{
                          background: feedbackData.feedback.is_progressing
                            ? 'rgba(34, 197, 94, 0.16)'
                            : 'rgba(245, 158, 11, 0.16)',
                          borderColor: feedbackData.feedback.is_progressing
                            ? '#22c55e'
                            : '#f59e0b',
                          color: feedbackData.feedback.is_progressing
                            ? '#4ade80'
                            : '#fbbf24',
                        }}
                      >
                        {feedbackData.feedback.health_status.toUpperCase()} •{' '}
                        {feedbackData.feedback.health_score}/100
                      </span>
                    )}
                  </div>

                  <div className="ai-feedback-controls">
                    <div className="ai-provider-toggle" role="group">
                      <button
                        type="button"
                        className={`ai-provider-btn ${
                          feedbackProvider === 'opencode_argon' ? 'active' : ''
                        }`}
                        disabled={isAnalyzingFeedback}
                        onClick={() => setFeedbackProvider('opencode_argon')}
                      >
                        Argon 4 • OpenCode
                      </button>
                      <button
                        type="button"
                        className={`ai-provider-btn ${
                          feedbackProvider === 'agy_flash' ? 'active' : ''
                        }`}
                        disabled={isAnalyzingFeedback}
                        onClick={() => setFeedbackProvider('agy_flash')}
                      >
                        Flash 3.8 • AGY
                      </button>
                    </div>
                    <button
                      type="button"
                      className="speed-pill-btn active"
                      disabled={!serverStatus?.online || isAnalyzingFeedback}
                      onClick={() => void handleRunFeedbackAnalysis()}
                    >
                      {isAnalyzingFeedback ? '⟳ Analyzing...' : '⚡ Run Diagnosis'}
                    </button>
                  </div>
                </div>

                {feedbackData?.feedback ? (
                  <div className="tb-diag-grid">
                    <div className="ai-feedback-verdict">
                      <strong>{feedbackData.feedback.headline}</strong>
                      <p>{feedbackData.feedback.progression_summary}</p>
                    </div>
                    <div className="ai-feedback-issues-list">
                      {feedbackData.feedback.what_is_going_wrong
                        .slice(0, 3)
                        .map((iss, idx) => (
                          <div
                            key={idx}
                            className="ai-feedback-issue-card"
                            style={{ borderLeftColor: '#f59e0b' }}
                          >
                            <strong>{iss.title}</strong>
                            <div className="ai-issue-row">
                              <span className="ai-issue-tag">Symptom</span>
                              <span>{iss.symptom}</span>
                            </div>
                            <div className="ai-issue-row">
                              <span className="ai-issue-tag cause">Cause</span>
                              <span>{iss.root_cause}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Click &ldquo;⚡ Run Diagnosis&rdquo; to evaluate current PPO telemetry.
                  </div>
                )}
              </section>
            )}

            {/* TENSORBOARD GRAPH SELECTOR & CATEGORY FILTER BAR */}
            <div className="tb-tag-filter-bar">
              <div className="tb-cat-tabs">
                {(
                  [
                    ['all', 'All Graphs'],
                    ['reward_loss', 'Reward & PPO Losses'],
                    ['stability', 'Trust Region & Critic'],
                    ['combat_entropy', 'Combat, Stars & Entropy'],
                    ['matchups', 'Armies & Villages'],
                  ] as const
                ).map(([catId, label]) => (
                  <button
                    key={catId}
                    type="button"
                    className={`tb-cat-btn ${
                      activeCategory === catId ? 'active' : ''
                    }`}
                    onClick={() => setActiveCategory(catId)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="tb-graph-toggles">
                {GRAPH_CATALOG.map((g) => {
                  const isOn = visibleGraphs[g.id];
                  return (
                    <button
                      key={g.id}
                      type="button"
                      className={`tb-graph-toggle-chip ${isOn ? 'on' : 'off'}`}
                      style={
                        isOn
                          ? {
                              borderColor: `${g.color}88`,
                              color: '#f8fafc',
                            }
                          : undefined
                      }
                      onClick={() =>
                        setVisibleGraphs((prev) => ({
                          ...prev,
                          [g.id]: !prev[g.id],
                        }))
                      }
                    >
                      <i
                        className="tb-series-dot"
                        style={{
                          background: isOn ? g.color : '#475569',
                        }}
                      />
                      {g.shortLabel}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="tb-mini-btn"
                  onClick={() =>
                    setVisibleGraphs({
                      reward_decomp: true,
                      ppo_losses: true,
                      destruction_pct: true,
                      star_rates: true,
                      kl_and_clip: true,
                      critic_and_grad: true,
                      policy_entropy: true,
                      action_pacing: true,
                      army_performance: true,
                      village_performance: true,
                    })
                  }
                >
                  Show All
                </button>
              </div>
            </div>

            {/* TENSORBOARD MULTI-CHART RESPONSIVE GRID */}
            <div
              className="tb-charts-grid"
              style={{
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              }}
            >
              {visibleGraphItems.map((item) => {
                const isExp = Boolean(expandedCharts[item.id]);

                if (item.id === 'reward_decomp') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="1. Mean Episode Reward & 3-Way Contributions"
                      subtitle="Drag on chart to zoom • Double-click to reset"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      series={rewardSeries}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      allowSplitLanes={true}
                      defaultSplitLanes={false}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                      headerExtra={
                        <div className="tb-mode-switch">
                          <button
                            type="button"
                            className={`tb-mini-btn ${
                              rewardDecompMode === 'actor_critic_entropy'
                                ? 'active'
                                : ''
                            }`}
                            onClick={() =>
                              setRewardDecompMode('actor_critic_entropy')
                            }
                          >
                            Actor / Critic / Entropy
                          </button>
                          <button
                            type="button"
                            className={`tb-mini-btn ${
                              rewardDecompMode === 'shaping_3way' ? 'active' : ''
                            }`}
                            onClick={() => setRewardDecompMode('shaping_3way')}
                          >
                            Destr / Stars / HP
                          </button>
                        </div>
                      }
                    />
                  );
                }

                if (item.id === 'ppo_losses') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="2. PPO Surrogate Losses (Actor, Critic, Entropy)"
                      subtitle="L_total = L_actor + 0.5·L_critic − 0.015·H(π)"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      series={[
                        {
                          id: 'actor_loss',
                          label: 'Actor Surrogate Clip Loss (L_CLIP)',
                          shortLabel: 'Actor L_π',
                          color: '#facc15',
                          values: chartData.policyLoss,
                          decimals: 4,
                        },
                        {
                          id: 'critic_loss',
                          label: 'Critic Value MSE Loss (0.5 · L_VF)',
                          shortLabel: 'Critic 0.5·L_V',
                          color: '#f87171',
                          values: chartData.weightedCriticLoss,
                          decimals: 2,
                        },
                        {
                          id: 'entropy_term',
                          label: 'Entropy Regularization (−c_e · H)',
                          shortLabel: 'Entropy −c_e·H',
                          color: '#c084fc',
                          values: chartData.entropyRegTerm,
                          decimals: 4,
                        },
                        {
                          id: 'total_loss',
                          label: 'Total Combined PPO Loss',
                          shortLabel: 'Total Loss',
                          color: '#38bdf8',
                          values: chartData.totalPpoLoss,
                          decimals: 2,
                          defaultHidden: true,
                        },
                      ]}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      allowSplitLanes={true}
                      defaultSplitLanes={true}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                    />
                  );
                }

                if (item.id === 'destruction_pct') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="3. Destruction % & Rolling Convergence"
                      subtitle="Episode destruction with 20-ep Min–Max band & 50-ep Rolling Mean"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      defaultYDomain={[0, 100]}
                      series={[
                        {
                          id: 'pct_ep',
                          label: 'Episode Destruction %',
                          shortLabel: 'Episode %',
                          color: '#facc15',
                          values: chartData.destrPct,
                          unit: '%',
                          decimals: 1,
                          bandMin: chartData.bandMin20,
                          bandMax: chartData.bandMax20,
                        },
                        {
                          id: 'pct_roll50',
                          label: '50-Ep Rolling Mean %',
                          shortLabel: '50-Ep Avg',
                          color: '#f97316',
                          values: chartData.roll50Pct,
                          unit: '%',
                          decimals: 1,
                        },
                        {
                          id: 'pct_best',
                          label: 'Best Checkpoint Waterline',
                          shortLabel: 'Best %',
                          color: '#4ade80',
                          values: chartData.bestPctLine,
                          unit: '%',
                          decimals: 0,
                          dashed: true,
                          defaultHidden: true,
                        },
                      ]}
                      referenceLines={[
                        {
                          value: 50,
                          label: '50% (1★ Threshold)',
                          color: '#475569',
                          dashed: true,
                        },
                      ]}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                    />
                  );
                }

                if (item.id === 'star_rates') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="4. Victory Star Tier Rates (30-Ep Rolling %)"
                      subtitle="Tracks 1★ perimeter clear vs 2★ TH18 core takedown vs 3★ full wipe"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      defaultYDomain={[0, 100]}
                      series={[
                        {
                          id: 'star_2plus',
                          label: '2★+ (TH18 Takedown) Rate',
                          shortLabel: '2★+ TH18 %',
                          color: '#f97316',
                          values: chartData.star2ThRate,
                          unit: '%',
                          decimals: 1,
                          fillArea: true,
                        },
                        {
                          id: 'star_3',
                          label: '3★ Triple Wipe Rate',
                          shortLabel: '3★ Triple %',
                          color: '#4ade80',
                          values: chartData.star3TripleRate,
                          unit: '%',
                          decimals: 1,
                        },
                        {
                          id: 'star_1plus',
                          label: '1★+ Victory Rate',
                          shortLabel: '1★+ Rate %',
                          color: '#38bdf8',
                          values: chartData.star1PlusRate,
                          unit: '%',
                          decimals: 1,
                          dashed: true,
                        },
                        {
                          id: 'star_0',
                          label: '0★ Failure Rate',
                          shortLabel: '0★ Fail %',
                          color: '#f87171',
                          values: chartData.star0Rate,
                          unit: '%',
                          decimals: 1,
                          defaultHidden: true,
                        },
                      ]}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                    />
                  );
                }

                if (item.id === 'kl_and_clip') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="5. PPO Trust-Region Stability (Approx KL & Clip Fraction)"
                      subtitle="Monitors policy step size against target_kl = 0.03 early-stop threshold"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      series={[
                        {
                          id: 'approx_kl',
                          label: 'Approximate KL Divergence',
                          shortLabel: 'Approx KL',
                          color: '#38bdf8',
                          values: chartData.approxKl,
                          decimals: 4,
                        },
                        {
                          id: 'clip_frac',
                          label: 'PPO Clip Fraction (|r_t − 1| > 0.2)',
                          shortLabel: 'Clip Frac %',
                          color: '#fb923c',
                          values: chartData.clipFracPct,
                          unit: '%',
                          decimals: 1,
                        },
                      ]}
                      referenceLines={[
                        {
                          value: 0.03,
                          label: 'target_kl = 0.03',
                          color: '#f87171',
                          dashed: true,
                        },
                      ]}
                      allowSplitLanes={true}
                      defaultSplitLanes={true}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                    />
                  );
                }

                if (item.id === 'critic_and_grad') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="6. Critic Explained Variance, Calibration Gap & Grad Norm"
                      subtitle="Measures Critic return variance capture and pre-clip L2 gradient norm"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      series={[
                        {
                          id: 'exp_var',
                          label: 'Critic Explained Variance (%)',
                          shortLabel: 'Explained Var %',
                          color: '#4ade80',
                          values: chartData.explainedVarPct,
                          unit: '%',
                          decimals: 1,
                        },
                        {
                          id: 'grad_norm',
                          label: 'Pre-Clip L2 Gradient Norm',
                          shortLabel: 'Grad Norm L2',
                          color: '#facc15',
                          values: chartData.gradNorm,
                          decimals: 1,
                        },
                        {
                          id: 'cal_gap',
                          label: 'Calibration Gap V(s₀) − R',
                          shortLabel: 'V(s₀) − R Gap',
                          color: '#38bdf8',
                          values: chartData.calGapV0MinusR,
                          decimals: 1,
                        },
                      ]}
                      allowSplitLanes={true}
                      defaultSplitLanes={true}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                    />
                  );
                }

                if (item.id === 'policy_entropy') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="7. Policy Shannon Entropy H(π) & 4-Head Breakdown"
                      subtitle="Tracks joint exploration vs discrete & spatial pointer head entropies"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      series={[
                        {
                          id: 'h_joint',
                          label: 'Joint Policy Entropy H(π)',
                          shortLabel: 'Joint H(π)',
                          color: '#c084fc',
                          values: chartData.jointEntropy,
                          decimals: 2,
                        },
                        {
                          id: 'h_tile',
                          label: 'H4: Tile Pointer Entropy (max 6.74)',
                          shortLabel: 'H(tile_xy)',
                          color: '#f97316',
                          values: chartData.hTile,
                          decimals: 2,
                        },
                        {
                          id: 'h_idx',
                          label: 'H2: Slot Index Entropy (max 2.30)',
                          shortLabel: 'H(slot_idx)',
                          color: '#38bdf8',
                          values: chartData.hIdx,
                          decimals: 2,
                        },
                        {
                          id: 'h_type',
                          label: 'H1: Action Type Entropy (max 1.95)',
                          shortLabel: 'H(slot_type)',
                          color: '#facc15',
                          values: chartData.hType,
                          decimals: 2,
                        },
                        {
                          id: 'h_frac',
                          label: 'H3: Deploy Fraction Entropy (max 1.61)',
                          shortLabel: 'H(deploy_frac)',
                          color: '#4ade80',
                          values: chartData.hFrac,
                          decimals: 2,
                        },
                      ]}
                      allowSplitLanes={true}
                      defaultSplitLanes={false}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                    />
                  );
                }

                if (item.id === 'action_pacing') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="8. Tactical Action Pacing & Step Allocation"
                      subtitle="Wait (NoOp) rate vs Troop/Hero Deployments, Spells, and Hero Abilities"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      series={[
                        {
                          id: 'noop_rate',
                          label: 'NoOp (Tactical Wait) Rate %',
                          shortLabel: 'NoOp %',
                          color: '#38bdf8',
                          values: chartData.noopPct,
                          unit: '%',
                          decimals: 1,
                        },
                        {
                          id: 'deploy_st',
                          label: 'Unit Deploy Steps / Ep',
                          shortLabel: 'Deploy Steps',
                          color: '#facc15',
                          values: chartData.deploySteps,
                          decimals: 1,
                        },
                        {
                          id: 'spell_st',
                          label: 'Spell Cast Steps / Ep',
                          shortLabel: 'Spell Steps',
                          color: '#c084fc',
                          values: chartData.spellSteps,
                          decimals: 1,
                        },
                        {
                          id: 'ability_st',
                          label: 'Hero Ability Steps / Ep',
                          shortLabel: 'Ability Steps',
                          color: '#4ade80',
                          values: chartData.abilitySteps,
                          decimals: 1,
                        },
                        {
                          id: 'tot_st',
                          label: 'Total Decision Steps / Ep',
                          shortLabel: 'Total Steps',
                          color: '#94a3b8',
                          values: chartData.totalSteps,
                          decimals: 0,
                          defaultHidden: true,
                        },
                      ]}
                      allowSplitLanes={true}
                      defaultSplitLanes={false}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                    />
                  );
                }

                if (item.id === 'army_performance') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="9. Army Mastery Progression (3 TH18 Meta Armies)"
                      subtitle="Rolling Destruction % per attack composition"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      defaultYDomain={[0, 100]}
                      series={ARMY_SHORT.map((name, idx) => ({
                        id: `army_${idx}`,
                        label: matchupStats.armies?.[idx] ?? name,
                        shortLabel: name,
                        color: ARMY_COLORS[idx],
                        values: chartData.armyRolling[idx] ?? [],
                        unit: '%',
                        decimals: 1,
                      }))}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                      footerExtra={
                        <table className="ai-matrix-table">
                          <thead>
                            <tr>
                              <th>TH18 Meta Army</th>
                              <th>Used %</th>
                              <th>Recent 50</th>
                              <th>All Avg</th>
                              <th>Peak</th>
                              <th>Avg ★</th>
                              <th>3★ %</th>
                              <th>Eps</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(matchupStats?.army_stats ?? []).map((st) => (
                              <tr key={st.army_idx}>
                                <td title={st.full_name}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <i
                                      className="ai-dot"
                                      style={{
                                        background:
                                          ARMY_COLORS[st.army_idx] ?? '#facc15',
                                      }}
                                    />
                                    {st.name}
                                  </span>
                                </td>
                                <td style={{ color: '#38bdf8', fontWeight: 700 }}>
                                  {st.usage_pct ?? 0}%
                                </td>
                                <td style={{ color: '#f97316', fontWeight: 700 }}>
                                  {st.recent_avg_pct ?? st.avg_pct}%
                                </td>
                                <td style={{ color: '#fde047', fontWeight: 700 }}>
                                  {st.avg_pct}%
                                </td>
                                <td>{st.peak_pct ?? 0}%</td>
                                <td>{st.avg_stars}★</td>
                                <td style={{ color: '#4ade80' }}>
                                  {st.triple_rate}%
                                </td>
                                <td>{st.episodes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      }
                    />
                  );
                }

                if (item.id === 'village_performance') {
                  return (
                    <TelemetryChart
                      key={item.id}
                      id={item.id}
                      title="10. Village Defense Breakdown (5 TH18 Meta Bases)"
                      subtitle="Rolling Destruction % across each target village layout"
                      episodes={chartData.epAxis}
                      episodeMeta={chartData.epMeta}
                      defaultYDomain={[0, 100]}
                      series={VILLAGE_SHORT.map((name, idx) => ({
                        id: `vil_${idx}`,
                        label: `V${idx + 1}: ${
                          matchupStats.villages?.[idx] ?? name
                        }`,
                        shortLabel: `V${idx + 1}: ${name}`,
                        color: VILLAGE_COLORS[idx],
                        values: chartData.villageRolling[idx] ?? [],
                        unit: '%',
                        decimals: 1,
                      }))}
                      smoothing={smoothing}
                      zoomRange={getZoomForChart(item.id)}
                      onZoomChange={(r) => setZoomForChart(item.id, r)}
                      sessionBoundaries={activeSessionBoundaries}
                      isExpanded={isExp}
                      onToggleExpand={() => toggleChartExpand(item.id)}
                      footerExtra={
                        <table className="ai-matrix-table">
                          <thead>
                            <tr>
                              <th>TH18 Meta Village</th>
                              <th>Used %</th>
                              <th>Recent 50</th>
                              <th>All Avg</th>
                              <th>Peak</th>
                              <th>Avg ★</th>
                              <th>3★ %</th>
                              <th>Eps</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(matchupStats?.village_stats ?? []).map((st) => (
                              <tr key={st.village_idx}>
                                <td title={st.full_name}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <i
                                      className="ai-dot"
                                      style={{
                                        background:
                                          VILLAGE_COLORS[st.village_idx] ??
                                          '#4ade80',
                                      }}
                                    />
                                    V{st.village_idx + 1}:{' '}
                                    {VILLAGE_SHORT[st.village_idx] ?? st.name}
                                  </span>
                                </td>
                                <td style={{ color: '#4ade80', fontWeight: 700 }}>
                                  {st.usage_pct ?? 0}%
                                </td>
                                <td style={{ color: '#f97316', fontWeight: 700 }}>
                                  {st.recent_avg_pct ?? st.avg_pct}%
                                </td>
                                <td style={{ color: '#fde047', fontWeight: 700 }}>
                                  {st.avg_pct}%
                                </td>
                                <td>{st.peak_pct ?? 0}%</td>
                                <td>{st.avg_stars}★</td>
                                <td style={{ color: '#4ade80' }}>
                                  {st.triple_rate}%
                                </td>
                                <td>{st.episodes}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      }
                    />
                  );
                }

                return null;
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // =========================================================================
  // WINDOW 2: VILLAGE MODEL SANDBOX & TESTER (TEST SAVED .PT MODELS ON BASES)
  // =========================================================================
  const slotTypeProbs = inspectData?.slot_type_probs ?? [1, 0, 0, 0, 0, 0, 0];
  const noopLiveProb = Math.round((slotTypeProbs[0] ?? 0) * 100);
  const testHp =
    activeTestModel?.hyperparams ?? inspectData?.model_meta?.hyperparams;

  return (
    <div className="ai-studio-workspace">
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
                  <span className="damage-label">Model Destruction</span>
                  <span className="damage-pct">
                    {battleState.destruction_pct}%
                  </span>
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
                  className="clash-btn gold"
                  disabled={!serverStatus?.online || isRunningRollout}
                  onClick={handleRunTrainedModelTest}
                >
                  {isRunningRollout
                    ? '⏳ Loading...'
                    : '▶️ Run Trained Model (.pt)'}
                </button>
                <button
                  className={`clash-btn ${isAiPlaying ? 'danger' : ''}`}
                  onClick={onToggleAiPlay}
                >
                  {isAiPlaying ? '⏸ Pause' : '⚡ Heuristic AI'}
                </button>
                <button
                  className="clash-btn"
                  onClick={onStepAiTick}
                  disabled={isAiPlaying}
                >
                  ⏭ +1 Tick
                </button>
                <button className="clash-btn" onClick={onResetAiBattle}>
                  ↺ Reset
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <aside className="ai-studio-sidebar">
        <section className="ai-card">
          <div className="ai-card-header">
            <h3>🧪 Select Trained Model (`trained_models/`)</h3>
            <button
              type="button"
              className="speed-pill-btn active"
              onClick={() => onSwitchStudioMode('trainer')}
            >
              ← Back to Trainer
            </button>
          </div>

          <select
            className="clash-select"
            value={testModelFile}
            onChange={(e) => setTestModelFile(e.target.value)}
          >
            {savedModels.map((m) => (
              <option key={m.filename} value={m.filename}>
                💾 {m.filename} (Ep {m.episode} • Best {m.best_pct}%{' '}
                {m.best_stars}★)
              </option>
            ))}
          </select>

          <div
            style={{
              background: '#0b1324',
              border: '1px solid #1e293b',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: '0.74rem',
              color: '#94a3b8',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px 12px',
            }}
          >
            <span>
              <strong style={{ color: '#e2e8f0' }}>Ep:</strong>{' '}
              {activeTestModel?.episode ?? 0}
            </span>
            <span>
              <strong style={{ color: '#facc15' }}>Peak:</strong>{' '}
              {activeTestModel?.best_pct ?? 0}% ({activeTestModel?.best_stars ?? 0}
              ★)
            </span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>LR:</strong>{' '}
              {testHp?.lr ?? 0.0003}
            </span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>Batch:</strong>{' '}
              {testHp?.batch_episodes ?? 4} eps
            </span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>Epochs:</strong>{' '}
              {testHp?.ppo_epochs ?? 4}
            </span>
          </div>

          <div
            className="ai-form-grid"
            style={{ gridTemplateColumns: '1.2fr 0.8fr' }}
          >
            <label>
              <span>Replay Speed</span>
              <select
                className="clash-select"
                value={testSpeedMode}
                onChange={(e) =>
                  setTestSpeedMode(
                    e.target.value as 'watch' | 'fast' | 'instant'
                  )
                }
              >
                <option value="watch">👁️ Watch Live (1×)</option>
                <option value="fast">⏩ Fast Forward (5×)</option>
                <option value="instant">⚡ Instant Result</option>
              </select>
            </label>
            <label>
              <span>Policy Mode</span>
              <select
                className="clash-select"
                value={deterministicTest ? 'det' : 'stoch'}
                onChange={(e) => setDeterministicTest(e.target.value === 'det')}
              >
                <option value="stoch">🎲 Sampled π(a|s)</option>
                <option value="det">🎯 Greedy Argmax</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="clash-btn gold"
              style={{ flex: 1 }}
              disabled={!serverStatus?.online || isRunningRollout}
              onClick={handleRunTrainedModelTest}
            >
              {isRunningRollout
                ? '⏳ Running...'
                : `▶️ Attack with ${testModelFile}`}
            </button>
            <button
              className="clash-btn"
              onClick={() => {
                setInspectedModelFile(testModelFile);
                setTrainerTab('stats');
                onSwitchStudioMode('trainer');
              }}
              title="Inspect training curves for this model"
            >
              📈 Curves
            </button>
          </div>
        </section>

        <section className="ai-card">
          <div className="ai-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3>⚔️ Model Attack Compositions ({testArmies.length})</h3>
              <span className="badge-gold" style={{ fontSize: '0.66rem' }}>
                🔒 Immutable
              </span>
            </div>
          </div>

          <div className="ai-prob-list">
            {testArmies.map((arm, idx) => {
              const isSelected = arm.name === army.name;
              return (
                <div
                  key={arm.name}
                  className={`ai-prob-row ${isSelected ? 'active' : ''}`}
                  style={{ gridTemplateColumns: '1fr auto', cursor: 'pointer' }}
                  onClick={() => onSelectArmy(arm)}
                >
                  <div style={{ minWidth: 0 }}>
                    <span
                      className="ai-prob-label"
                      style={{ fontWeight: isSelected ? 700 : 500 }}
                    >
                      A{idx + 1}: {arm.name}
                    </span>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        marginTop: 2,
                      }}
                    >
                      {arm.troops
                        .slice(0, 3)
                        .map(([t, c]) => `${c}× ${t}`)
                        .join(', ')}
                      {arm.troops.length > 3
                        ? ` +${arm.troops.length - 3} more`
                        : ''}
                    </div>
                  </div>
                  <span
                    className="ai-prob-val"
                    style={{ color: isSelected ? '#facc15' : '#38bdf8' }}
                  >
                    {isSelected ? '✓ Equipped' : 'Equip'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ai-card">
          <div className="ai-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3>🏰 Model Village Layouts ({testVillages.length})</h3>
              <span className="badge-gold" style={{ fontSize: '0.66rem' }}>
                🔒 Immutable
              </span>
            </div>
          </div>

          <div className="ai-prob-list">
            {testVillages.map((vil, idx) => {
              const isSelected = vil.name === layout.name;
              return (
                <div
                  key={vil.name}
                  className={`ai-prob-row ${isSelected ? 'active' : ''}`}
                  style={{ gridTemplateColumns: '1fr auto', cursor: 'pointer' }}
                  onClick={() => onSelectLayout(vil)}
                >
                  <div style={{ minWidth: 0 }}>
                    <span
                      className="ai-prob-label"
                      style={{ fontWeight: isSelected ? 700 : 500 }}
                    >
                      V{idx + 1}: {vil.name}
                    </span>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        marginTop: 2,
                      }}
                    >
                      TH18 • {vil.buildings.length} Buildings •{' '}
                      {vil.walls.length} Walls
                    </div>
                  </div>
                  <span
                    className="ai-prob-val"
                    style={{ color: isSelected ? '#4ade80' : '#38bdf8' }}
                  >
                    {isSelected ? '✓ Active Base' : 'Load Base'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="ai-card">
          <div className="ai-card-header">
            <h3>Spatial Tensor &amp; Policy Heatmap</h3>
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
                <span>NoOp Prob</span>
                <strong style={{ color: '#38bdf8' }}>{noopLiveProb}%</strong>
              </div>
              <div>
                <span>Critic V(s) / H(π)</span>
                <strong>
                  {inspectData
                    ? `${inspectData.value.toFixed(2)} / ${inspectData.entropy.toFixed(2)}`
                    : '—'}
                </strong>
              </div>
              {lastRolloutResult && (
                <div>
                  <span>Last Model Test</span>
                  <strong style={{ color: '#fde047' }}>
                    {lastRolloutResult.destruction_pct}% (
                    {lastRolloutResult.stars}★) • NoOp{' '}
                    {lastRolloutResult.noop_pct}%
                  </strong>
                </div>
              )}
            </div>
          </div>

          {lastRolloutResult && (
            <div
              className="ai-history-list"
              style={{ maxHeight: 150, overflowY: 'auto', marginTop: 4 }}
            >
              {lastRolloutResult.actions_schedule
                .filter((s) => s.slot_type !== 0)
                .slice(0, 25)
                .map((s) => (
                  <div key={s.step} className="ai-history-row">
                    <span>t={s.tick}</span>
                    <span style={{ color: '#fde047' }}>
                      {SLOT_TYPE_LABELS[s.slot_type] ?? 'Action'} #{s.slot_idx}
                      {s.slot_type === 1 && s.deploy_count
                        ? ` (×${s.deploy_count} • α=${Math.round(
                            (s.deploy_fraction ?? 1) * 100
                          )}%)`
                        : ''}
                    </span>
                    <span>
                      ({s.tile_x}, {s.tile_y})
                    </span>
                    <span>V={s.value}</span>
                  </div>
                ))}
            </div>
          )}
        </section>
      </aside>
    </div>
  );
};
