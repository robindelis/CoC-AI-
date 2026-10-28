import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  fetchArmyPresets,
  fetchTrainedModelRollout,
  inspectAIPolicy,
  renameTrainedModel,
  startAIPpoTraining,
  stopAIPpoTraining,
} from './aiClient';
import {
  AIArmyStat,
  AIInspectResponse,
  AIMatchupStats,
  AIRolloutResponse,
  AIRolloutStep,
  AIServerStatus,
  AITrainingEpisodeRecord,
  AIVillageStat,
  MatchupMode,
  SavedModelMeta,
  SLOT_TYPE_LABELS,
  SPATIAL_CHANNELS,
} from './aiTypes';
import { NetworkBuilderPanel } from './NetworkBuilderPanel';
import { useContainerWidth } from './useContainerWidth';

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

interface EntityTrendBin {
  ep: number;
  values: number[];
}

function binEntityPerformance(
  history: AITrainingEpisodeRecord[],
  key: 'army_idx' | 'village_idx',
  numEntities: number,
  maxBins = 35
): EntityTrendBin[] {
  if (history.length === 0) return [];
  const n = history.length;
  const binSize = Math.max(1, Math.ceil(n / maxBins));
  const bins: EntityTrendBin[] = [];

  const entityPcts: number[][] = Array.from({ length: numEntities }, () => []);

  for (let i = 0; i < n; i += binSize) {
    const slice = history.slice(i, Math.min(n, i + binSize));
    for (const rec of slice) {
      const idx = rec[key];
      if (idx != null && idx >= 0 && idx < numEntities) {
        entityPcts[idx].push(rec.destruction_pct);
      }
    }

    const values = entityPcts.map((arr) => {
      if (arr.length === 0) return 0;
      const recent = arr.slice(-15);
      return Number(
        (recent.reduce((a, b) => a + b, 0) / recent.length).toFixed(1)
      );
    });

    bins.push({
      ep: slice[slice.length - 1].episode,
      values,
    });
  }

  return bins;
}

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

interface BinnedPoint {
  epStart: number;
  epEnd: number;
  meanPct: number;
  minPct: number;
  maxPct: number;
  avg50Pct: number;
  meanNoop: number;
  meanReward: number;
  meanRewardDestr: number;
  meanRewardStars: number;
  meanRewardDamage: number;
  meanEntropy: number;
  meanValLoss: number;
}

function binTrainingHistory(
  history: AITrainingEpisodeRecord[],
  maxBins = 75
): BinnedPoint[] {
  if (history.length === 0) return [];
  const n = history.length;
  const binSize = Math.max(1, Math.ceil(n / maxBins));
  const bins: BinnedPoint[] = [];

  for (let i = 0; i < n; i += binSize) {
    const slice = history.slice(i, Math.min(n, i + binSize));
    const pcts = slice.map((s) => s.destruction_pct);
    const meanPct = pcts.reduce((a, b) => a + b, 0) / slice.length;
    const minPct = Math.min(...pcts);
    const maxPct = Math.max(...pcts);

    // 50-episode rolling average up to the end of this bin
    const endIdx = Math.min(n, i + binSize);
    const win50 = history.slice(Math.max(0, endIdx - 50), endIdx);
    const avg50Pct =
      win50.reduce((a, b) => a + b.destruction_pct, 0) / Math.max(1, win50.length);

    const meanNoop =
      slice.reduce((a, b) => a + (b.noop_pct ?? 0), 0) / slice.length;
    const meanReward =
      slice.reduce((a, b) => a + (b.reward ?? 0), 0) / slice.length;
    const meanRewardDestr =
      slice.reduce((a, b) => a + (b.reward_destr ?? (b.destruction_pct * 0.35)), 0) / slice.length;
    const meanRewardStars =
      slice.reduce((a, b) => {
        if (b.reward_stars !== undefined) return a + b.reward_stars;
        const thBonus = b.stars >= 2 || b.destruction_pct >= 50 ? 14.0 : 0.0;
        return a + (b.stars * 12.0 + thBonus);
      }, 0) / slice.length;
    const meanRewardDamage =
      slice.reduce((a, b) => {
        if (b.reward_damage !== undefined) return a + b.reward_damage;
        const destr = b.destruction_pct * 0.35;
        const starsAndTh = b.stars * 12.0 + (b.stars >= 2 ? 14.0 : 0.0);
        return a + Math.max(0, (b.reward ?? 0) - destr - starsAndTh);
      }, 0) / slice.length;

    const meanEntropy =
      slice.reduce((a, b) => a + b.entropy, 0) / slice.length;
    const meanValLoss =
      slice.reduce((a, b) => a + b.value_loss, 0) / slice.length;

    bins.push({
      epStart: slice[0].episode,
      epEnd: slice[slice.length - 1].episode,
      meanPct,
      minPct,
      maxPct,
      avg50Pct,
      meanNoop,
      meanReward,
      meanRewardDestr,
      meanRewardStars,
      meanRewardDamage,
      meanEntropy,
      meanValLoss,
    });
  }
  return bins;
}

function buildLinePoints(
  values: number[],
  width: number,
  height: number,
  minV: number,
  maxV: number,
  padX = 36,
  padY = 18
): string {
  if (values.length === 0) return '';
  const span = Math.max(1e-5, maxV - minV);
  const plotW = width - padX - 14;
  const plotH = height - padY * 2;
  return values
    .map((v, i) => {
      const x =
        values.length === 1
          ? padX + plotW / 2
          : padX + (i / (values.length - 1)) * plotW;
      const norm = Math.max(0, Math.min(1, (v - minV) / span));
      const y = height - padY - norm * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildBandPolygon(
  mins: number[],
  maxs: number[],
  width: number,
  height: number,
  minV: number,
  maxV: number,
  padX = 36,
  padY = 18
): string {
  if (mins.length === 0 || mins.length !== maxs.length) return '';
  const span = Math.max(1e-5, maxV - minV);
  const plotW = width - padX - 14;
  const plotH = height - padY * 2;

  const topPts = maxs.map((v, i) => {
    const x =
      maxs.length === 1 ? padX + plotW / 2 : padX + (i / (maxs.length - 1)) * plotW;
    const norm = Math.max(0, Math.min(1, (v - minV) / span));
    const y = height - padY - norm * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const botPts = [...mins].reverse().map((v, revIdx) => {
    const i = mins.length - 1 - revIdx;
    const x =
      mins.length === 1 ? padX + plotW / 2 : padX + (i / (mins.length - 1)) * plotW;
    const norm = Math.max(0, Math.min(1, (v - minV) / span));
    const y = height - padY - norm * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return [...topPts, ...botPts].join(' ');
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

  // Trainer state
  const [matchupMode, setMatchupMode] = useState<MatchupMode>('random');
  const [resumeFrom, setResumeFrom] = useState<string>('latest_attacker.pt');
  const [saveName, setSaveName] = useState<string>('');
  const [episodes, setEpisodes] = useState<number>(60);
  const [batchEpisodes, setBatchEpisodes] = useState<number>(12);
  const [minibatchSize, setMinibatchSize] = useState<number>(128);
  const [ppoEpochs, setPpoEpochs] = useState<number>(4);
  const [lr, setLr] = useState<number>(0.0003);
  const [trainerTab, setTrainerTab] = useState<'configs' | 'stats'>('stats');
  const [fitYAxis, setFitYAxis] = useState<boolean>(false);
  const [mainChartRef, mainChartWidth] = useContainerWidth(960);
  const [pacingChartRef, pacingChartWidth] = useContainerWidth(380);
  const [armyChartRef, armyChartWidth] = useContainerWidth(380);
  const [villageChartRef, villageChartWidth] = useContainerWidth(380);

  // Army and Village Presets selection for Training
  const [allArmies, setAllArmies] = useState<ArmyLoadout[]>(() => catalog.preset_armies);
  const [selectedArmyNames, setSelectedArmyNames] = useState<string[]>(() =>
    catalog.preset_armies.slice(0, 3).map((a) => a.name)
  );
  const [selectedVillageNames, setSelectedVillageNames] = useState<string[]>(() =>
    catalog.preset_layouts.slice(0, 5).map((v) => v.name)
  );

  // Checkpoint renaming state
  const [renamingModel, setRenamingModel] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  const [renameMessage, setRenameMessage] = useState<{ text: string; isError?: boolean } | null>(null);

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

  // Fetch custom army recipes on mount
  useEffect(() => {
    fetchArmyPresets().then((res) => {
      if (res && res.all_armies && res.all_armies.length > 0) {
        setAllArmies(res.all_armies);
      }
    });
  }, []);

  // Poll Python AI Server status
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

  const isLockedToResume = resumeFrom !== 'scratch';

  // Automatically bundle & lock parameters, villages and attack compositions when resuming a past model
  useEffect(() => {
    if (resumeFrom === 'scratch') return;
    const found = (serverStatus?.saved_models ?? []).find((m) => m.filename === resumeFrom);
    if (!found) return;

    if (found.hyperparams) {
      if (found.hyperparams.lr != null) setLr(found.hyperparams.lr);
      if (found.hyperparams.batch_episodes != null) setBatchEpisodes(found.hyperparams.batch_episodes);
      if (found.hyperparams.minibatch_size != null) setMinibatchSize(found.hyperparams.minibatch_size);
      if (found.hyperparams.ppo_epochs != null) setPpoEpochs(found.hyperparams.ppo_epochs);
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

  // Fetch PyTorch policy inspection for the selected test model
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

  // Render the 50x50 Spatial Observation Tensor or Policy Tile Heatmap in Tester mode
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
      isLockedToResume && currentResumeModel?.armies && currentResumeModel.armies.length > 0
        ? currentResumeModel.armies
        : allArmies.filter((a) => selectedArmyNames.includes(a.name));
    const targetVillages =
      isLockedToResume && currentResumeModel?.villages && currentResumeModel.villages.length > 0
        ? currentResumeModel.villages
        : catalog.preset_layouts.filter((v) => selectedVillageNames.includes(v.name));

    const finalArmies =
      targetArmies.length > 0 ? targetArmies : catalog.preset_armies.slice(0, 3);
    const finalVillages =
      targetVillages.length > 0 ? targetVillages : catalog.preset_layouts.slice(0, 5);

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
        res.models?.find((m) => m.filename.startsWith(trimmed.replace(/\.pt$/, '')))
          ?.filename || (trimmed.endsWith('.pt') ? trimmed : `${trimmed}.pt`);
      if (resumeFrom === oldFilename) setResumeFrom(newName);
      if (testModelFile === oldFilename) setTestModelFile(newName);
      setRenamingModel(null);
      setRenameInput('');
      setRenameMessage({ text: `✅ Renamed checkpoint to "${newName}"` });
      setTimeout(() => setRenameMessage(null), 3500);
      const st = await fetchAIServerStatus();
      if (st) setServerStatus(st);
    } else {
      setRenameMessage({
        text: `❌ ${res.error || 'Failed to rename checkpoint'}`,
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

  const isTraining = Boolean(serverStatus?.training?.is_training);
  const history = serverStatus?.training?.history ?? [];
  const savedModels = serverStatus?.saved_models ?? [];

  const matchupStats = useMemo(() => {
    if (serverStatus?.training?.matchup_stats?.army_stats?.length) {
      return serverStatus.training.matchup_stats;
    }
    return computeLocalMatchupStats(history, catalog.preset_layouts, allArmies);
  }, [serverStatus?.training?.matchup_stats, history, catalog.preset_layouts, allArmies]);

  const armyTrends = useMemo(
    () => binEntityPerformance(history, 'army_idx', 3, 35),
    [history]
  );
  const villageTrends = useMemo(
    () => binEntityPerformance(history, 'village_idx', 5, 35),
    [history]
  );

  const binned = useMemo(() => binTrainingHistory(history, 75), [history]);

  const kpiStats = useMemo(() => {
    if (history.length === 0) {
      return {
        recent50Pct: serverStatus?.checkpoint?.best_pct ?? 0,
        deltaPct: 0,
        avgNoop: 0,
        avgFps: 0,
        meanReward: 0,
        meanRewardDestr: 0,
        meanRewardStars: 0,
        meanRewardDamage: 0,
      };
    }
    const firstSlice = history.slice(0, Math.min(25, history.length));
    const lastSlice = history.slice(-Math.min(50, history.length));
    const firstAvg =
      firstSlice.reduce((a, r) => a + r.destruction_pct, 0) / firstSlice.length;
    const recent50Pct =
      lastSlice.reduce((a, r) => a + r.destruction_pct, 0) / lastSlice.length;
    const avgNoop =
      lastSlice.reduce((a, r) => a + (r.noop_pct ?? 0), 0) / lastSlice.length;
    const avgFps =
      lastSlice.reduce((a, r) => a + (r.fps_ticks ?? 0), 0) / lastSlice.length;

    // Mean reward & 3 contributions across the recent 50 episodes:
    const meanReward =
      lastSlice.reduce((a, r) => a + (r.reward ?? 0), 0) / lastSlice.length;

    // Contribution 1: Destruction % progression (35 pts max)
    const meanRewardDestr =
      lastSlice.reduce(
        (a, r) => a + (r.reward_destr ?? r.destruction_pct * 0.35),
        0
      ) / lastSlice.length;

    // Contribution 2: Stars & Town Hall 18 milestone (50 pts max)
    const meanRewardStars =
      lastSlice.reduce((a, r) => {
        if (r.reward_stars !== undefined) return a + r.reward_stars;
        const thBonus = r.stars >= 2 || r.destruction_pct >= 50 ? 14.0 : 0.0;
        return a + (r.stars * 12.0 + thBonus);
      }, 0) / lastSlice.length;

    // Contribution 3: Dense Core HP damage & tactical shaping (15+ pts max)
    const meanRewardDamage =
      lastSlice.reduce((a, r) => {
        if (r.reward_damage !== undefined) return a + r.reward_damage;
        const destr = r.destruction_pct * 0.35;
        const starsAndTh = r.stars * 12.0 + (r.stars >= 2 ? 14.0 : 0.0);
        return a + Math.max(0, (r.reward ?? 0) - destr - starsAndTh);
      }, 0) / lastSlice.length;

    return {
      recent50Pct: Math.round(recent50Pct * 10) / 10,
      deltaPct: Math.round((recent50Pct - firstAvg) * 10) / 10,
      avgNoop: Math.round(avgNoop * 10) / 10,
      avgFps: Math.round(avgFps),
      meanReward: Math.round(meanReward * 10) / 10,
      meanRewardDestr: Math.round(meanRewardDestr * 10) / 10,
      meanRewardStars: Math.round(meanRewardStars * 10) / 10,
      meanRewardDamage: Math.round(meanRewardDamage * 10) / 10,
    };
  }, [history, serverStatus?.checkpoint?.best_pct]);

  const pacingTotals = useMemo(() => {
    if (history.length === 0) {
      return { noop: 25, deploy: 55, spell: 12, ability: 8 };
    }
    const last = history.slice(-30);
    const noop = Math.round(
      last.reduce((acc, r) => acc + (r.noop_pct ?? 0), 0) / last.length
    );
    const rem = Math.max(0, 100 - noop);
    const totAct = Math.max(
      1,
      last.reduce(
        (acc, r) =>
          acc +
          (r.deploy_steps ?? 1) +
          (r.spell_steps ?? 0) +
          (r.ability_steps ?? 0),
        0
      )
    );
    const deploy = Math.round(
      (rem * last.reduce((a, r) => a + (r.deploy_steps ?? 1), 0)) / totAct
    );
    const spell = Math.round(
      (rem * last.reduce((a, r) => a + (r.spell_steps ?? 0), 0)) / totAct
    );
    const ability = Math.max(0, rem - deploy - spell);
    return { noop, deploy, spell, ability };
  }, [history]);

  const activeTestModel = savedModels.find((m) => m.filename === testModelFile);
  const testArmies: ArmyLoadout[] = useMemo(() => {
    if (activeTestModel?.armies && activeTestModel.armies.length > 0) {
      return activeTestModel.armies;
    }
    if (inspectData?.model_meta?.armies && inspectData.model_meta.armies.length > 0) {
      return inspectData.model_meta.armies;
    }
    return catalog.preset_armies.slice(0, 3);
  }, [activeTestModel, inspectData?.model_meta?.armies, catalog.preset_armies]);

  const testVillages: VillageLayout[] = useMemo(() => {
    if (activeTestModel?.villages && activeTestModel.villages.length > 0) {
      return activeTestModel.villages;
    }
    if (inspectData?.model_meta?.villages && inspectData.model_meta.villages.length > 0) {
      return inspectData.model_meta.villages;
    }
    return catalog.preset_layouts.slice(0, 5);
  }, [activeTestModel, inspectData?.model_meta?.villages, catalog.preset_layouts]);

  // =========================================================================
  // WINDOW 1: FULL-SCREEN AI TRAINER & ANALYTICS DASHBOARD (NO VILLAGE CANVAS)
  // =========================================================================
  if (studioMode === 'trainer') {
    const cumEp =
      serverStatus?.training?.cumulative_episode ||
      serverStatus?.checkpoint?.episode ||
      0;
    const bestPct =
      Math.max(
        serverStatus?.training?.best_pct ?? 0,
        serverStatus?.checkpoint?.best_pct ?? 0
      );
    const bestStars =
      Math.max(
        serverStatus?.training?.best_stars ?? 0,
        serverStatus?.checkpoint?.best_stars ?? 0
      );

    const dataMinPct = binned.length > 0 ? Math.min(...binned.map((b) => b.minPct)) : 0;
    const dataMaxPct = binned.length > 0 ? Math.max(...binned.map((b) => b.maxPct)) : 100;
    const effectiveYMin =
      fitYAxis && binned.length > 0
        ? Math.max(0, Math.floor((dataMinPct - 2) / 5) * 5)
        : 0;
    const effectiveYMax =
      fitYAxis && binned.length > 0
        ? Math.min(100, Math.ceil((dataMaxPct + 2) / 5) * 5)
        : 100;
    const ySpan = Math.max(10, effectiveYMax - effectiveYMin);
    const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((frac) =>
      Math.round(effectiveYMin + frac * ySpan)
    );

    return (
      <div className="ai-trainer-fullscreen">
        {/* SUBTAB BAR: SWITCH BETWEEN CONFIGURATIONS AND STATS */}
        <div className="ai-trainer-subtabs">
          <button
            type="button"
            className={`ai-trainer-subtab ${trainerTab === 'configs' ? 'active' : ''}`}
            onClick={() => setTrainerTab('configs')}
          >
            ⚙️ Training Configurations & Model Setup
          </button>
          <button
            type="button"
            className={`ai-trainer-subtab ${trainerTab === 'stats' ? 'active' : ''}`}
            onClick={() => setTrainerTab('stats')}
          >
            📊 Training Stats & Live Telemetry
            {isTraining && (
              <span className="ai-live-pulse-badge">
                ● LIVE (Ep {serverStatus?.training?.current_episode ?? 0})
              </span>
            )}
          </button>
        </div>

        {trainerTab === 'configs' && (
          <>
            {/* TOP CONTROL & CHECKPOINT RESUME BAR */}
        <div className="ai-trainer-topbar">
          <div className="ai-form-grid" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
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

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', color: '#cbd5e1' }}>
            <span>Matchup Sampling</span>
            <select
              className="clash-select"
              value={matchupMode}
              disabled={isTraining}
              onChange={(e) => setMatchupMode(e.target.value as MatchupMode)}
            >
              <option value="random">🎲 Random Village + Random Army</option>
              <option value="round_robin">🔁 Round-Robin (All 5V × 3A)</option>
              <option value="fixed_current">📌 Current Village + Army</option>
            </select>
          </label>

          <div className="ai-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
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

          <div className="ai-form-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
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
              <span>Epochs</span>
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
                ⏹ Stop & Save
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

        {/* VILLAGES & ARMY COMPOSITIONS TRAINING BUNDLE CARD */}
        <div className="ai-preset-bundle-strip">
          <div className="ai-bundle-card">
            <div className="ai-bundle-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4>⚔️ Training Attack Compositions ({selectedArmyNames.length} selected)</h4>
                {isLockedToResume && (
                  <span className="badge-gold">🔒 Locked to Checkpoint</span>
                )}
              </div>
            </div>
            <div className="ai-bundle-list">
              {allArmies.map((a) => {
                const isSelected = selectedArmyNames.includes(a.name);
                const isCustom = !catalog.preset_armies.some((pa) => pa.name === a.name);
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
                          setSelectedArmyNames((prev) => prev.filter((n) => n !== a.name));
                        }
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong
                          style={{
                            fontSize: '0.85rem',
                            color: isSelected ? '#facc15' : '#e2e8f0',
                          }}
                        >
                          {a.name}
                        </strong>
                        {isCustom && (
                          <span
                            style={{
                              fontSize: '0.65rem',
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
                        {a.troops.slice(0, 4).map(([t, c]) => `${c}× ${t}`).join(', ')}
                        {a.troops.length > 4 ? ` +${a.troops.length - 4} more` : ''}
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
                <h4>🛡️ Training Village Layouts ({selectedVillageNames.length} selected)</h4>
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
                          setSelectedVillageNames((prev) => prev.filter((n) => n !== v.name));
                        }
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong
                        style={{
                          fontSize: '0.85rem',
                          color: isSelected ? '#4ade80' : '#e2e8f0',
                        }}
                      >
                        V{idx + 1}: {v.name}
                      </strong>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        TH18 • {v.buildings.length} Buildings • {v.walls.length} Walls
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* LIVE NEURAL NETWORK ARCHITECTURE VISUALIZER */}
        <NetworkBuilderPanel
          serverOnline={Boolean(serverStatus?.online)}
          architectureSpec={serverStatus?.architecture_spec}
          architectureHash={serverStatus?.architecture_hash}
          activeCheckpoint={resumeFrom !== 'scratch' ? resumeFrom : undefined}
          history={history}
        />

        {/* SAVED CHECKPOINTS LIBRARY & FILE RENAMER */}
        <section className="ai-card" style={{ marginTop: 4 }}>
          <div className="ai-card-header">
            <h3>💾 Saved Training Files & Checkpoints ({savedModels.length} Models in `trained_models/`)</h3>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Name, rename, and review bundled village & army configurations
            </span>
          </div>

          {renameMessage && (
            <div
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: '0.82rem',
                marginBottom: 8,
                background: renameMessage.isError
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'rgba(34, 197, 94, 0.2)',
                color: renameMessage.isError ? '#f87171' : '#4ade80',
                border: `1px solid ${
                  renameMessage.isError ? '#ef4444' : '#22c55e'
                }`,
              }}
            >
              {renameMessage.text}
            </div>
          )}

          <div className="ai-models-table-wrap">
            <table className="ai-matrix-table">
              <thead>
                <tr>
                  <th>Checkpoint File</th>
                  <th>Episodes</th>
                  <th>Best Destruction</th>
                  <th>Bundled Armies</th>
                  <th>Bundled Villages</th>
                  <th>Size</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedModels.map((m) => {
                  const isEditing = renamingModel === m.filename;
                  const isCurrentResume = resumeFrom === m.filename;
                  const armyList =
                    m.army_names ?? m.armies?.map((a) => a.name) ?? ['3 Meta Armies'];
                  const vilList =
                    m.village_names ?? m.villages?.map((v) => v.name) ?? ['5 Meta Bases'];

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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                              onClick={() => handleRenameModel(m.filename)}
                            >
                              Save
                            </button>
                            <button
                              className="clash-btn"
                              style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                              onClick={() => setRenamingModel(null)}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                fontWeight: 700,
                                color: isCurrentResume ? '#facc15' : '#f8fafc',
                              }}
                            >
                              💾 {m.filename}
                            </span>
                            <button
                              type="button"
                              title="Rename file"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
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
                      <td>Ep {m.episode}</td>
                      <td style={{ color: '#fde047', fontWeight: 700 }}>
                        {m.best_pct}% ({m.best_stars}★)
                      </td>
                      <td
                        style={{ fontSize: '0.75rem', color: '#94a3b8' }}
                        title={armyList.join('\n')}
                      >
                        {armyList.length} Armies ({armyList[0]?.split(' ')[0] ?? 'Meta'}...)
                      </td>
                      <td
                        style={{ fontSize: '0.75rem', color: '#94a3b8' }}
                        title={vilList.join('\n')}
                      >
                        {vilList.length} Bases ({vilList[0]?.split(' ')[0] ?? 'Meta'}...)
                      </td>
                      <td>{m.size_kb} KB</td>
                      <td style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {m.updated_at}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className={`clash-btn ${isCurrentResume ? 'gold' : ''}`}
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={() => {
                              setResumeFrom(m.filename);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                          >
                            {isCurrentResume ? '✓ Selected' : 'Resume'}
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
      </>
    )}

    {/* ================================================================= */}
    {/* PANEL B: TRAINING STATS, LIVE CURVES & MATCHUP ANALYTICS         */}
    {/* ================================================================= */}
    {trainerTab === 'stats' && (
      <>
        {/* COMPACT RUNTIME & CONTROL STRIP */}
        <div
          className="ai-trainer-topbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                background: '#facc15',
                color: '#0f172a',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 4,
                fontSize: '0.78rem',
              }}
            >
              ⚔️ Attacker PPO
            </span>
            <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
              Weights: <strong style={{ color: '#facc15' }}>{resumeFrom === 'scratch' ? 'Fresh (Untrained)' : resumeFrom}</strong>
            </span>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Target: <strong>{episodes} Eps</strong> (LR: {lr}, Batch: {batchEpisodes})
            </span>
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
                ⏹ Stop & Save
              </button>
            )}
            <button
              className="clash-btn"
              onClick={() => setTrainerTab('configs')}
              style={{ fontSize: '0.78rem' }}
            >
              ⚙️ Edit Configs
            </button>
            <button
              className="clash-btn green"
              onClick={() => onSwitchStudioMode('tester')}
            >
              🧪 Test Models →
            </button>
          </div>
        </div>

        {/* 6+ KPI LIVE SUMMARY STRIP (WITH MEAN REWARD + 3 CONTRIBUTIONS) */}
        <div className="ai-kpi-strip">
          <div className="ai-kpi-card">
            <span>GPU Runtime</span>
            <strong style={{ color: serverStatus?.online ? '#4ade80' : '#f87171', fontSize: '0.95rem' }}>
              {serverStatus?.online ? `🟢 ${serverStatus.device_name}` : 'Offline'}
            </strong>
          </div>
          <div className="ai-kpi-card">
            <span>Session / Total Episodes</span>
            <strong>
              {serverStatus?.training.current_episode ?? 0}/
              {serverStatus?.training.total_episodes ?? 0}{' '}
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                (Cumul: {cumEp})
              </span>
            </strong>
          </div>
          <div className="ai-kpi-card">
            <span>Recent 50-Ep Avg Destruction</span>
            <strong style={{ color: '#fde047' }}>
              {kpiStats.recent50Pct}%{' '}
              {history.length > 10 && (
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
          </div>
          <div className="ai-kpi-card">
            <span>Best Checkpoint Score</span>
            <strong style={{ color: '#facc15' }}>
              {bestPct}% ({bestStars}★)
            </strong>
          </div>
          {/* Mean Reward divided by the three contributions */}
          <div className="ai-kpi-card" style={{ minWidth: 210 }}>
            <span>Mean Reward (3 Contributions)</span>
            <strong style={{ color: '#facc15' }}>
              +{kpiStats.meanReward.toFixed(1)}
            </strong>
            <div className="ai-reward-contribs">
              <span className="ai-reward-pill" title="Destruction % progression contribution (max 35 pts)">
                💥 Dest: +{kpiStats.meanRewardDestr.toFixed(1)}
              </span>
              <span className="ai-reward-pill" title="Victory Stars & TH takedown milestone (max 50 pts)">
                ⭐ Stars: +{kpiStats.meanRewardStars.toFixed(1)}
              </span>
              <span className="ai-reward-pill" title="Dense Core HP damage & tactical shaping (max 15+ pts)">
                🎯 HP: +{kpiStats.meanRewardDamage.toFixed(1)}
              </span>
            </div>
          </div>
          <div className="ai-kpi-card">
            <span>Recent NoOp (Wait) Rate</span>
            <strong style={{ color: '#38bdf8' }}>{kpiStats.avgNoop}%</strong>
          </div>
          <div className="ai-kpi-card">
            <span>Simulation Speed</span>
            <strong>{kpiStats.avgFps.toLocaleString()} ticks/s</strong>
          </div>
        </div>

        {/* FULL-WIDTH BINNED TRAINING PROGRESS CHART */}
        <section className="ai-main-chart-card" ref={mainChartRef}>
          <div className="ai-card-header">
            <h3>
              📈 Attacker Improvement Curve ({history.length} Episodes in Current Run
              {binned.length < history.length
                ? ` • Binned into ${binned.length} Windows`
                : ''}
              )
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="ai-chart-legend">
                <span>
                  <i className="ai-dot" style={{ background: '#f97316' }} />
                  50-Ep Rolling Avg Destruction %
                </span>
                <span>
                  <i className="ai-dot" style={{ background: '#facc15' }} />
                  Window Mean Destruction % (with Min–Max Band)
                </span>
              </div>
              <button
                type="button"
                className={`speed-pill-btn ${fitYAxis ? 'active' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setFitYAxis((prev) => !prev)}
                title="Fit Y-axis scale to data range or reset to 0-100%"
              >
                ↕️ {fitYAxis ? `Fitted (${effectiveYMin}%–${effectiveYMax}%)` : 'Fit to Data (Y-Axis)'}
              </button>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${mainChartWidth} 340`}
            className="ai-wide-svg-chart"
            style={{ height: 340 }}
          >
            {yTicks.map((pct) => {
              const y = 340 - 22 - ((pct - effectiveYMin) / ySpan) * (340 - 44);
              return (
                <g key={pct}>
                  <line
                    x1={40}
                    y1={y}
                    x2={mainChartWidth - 14}
                    y2={y}
                    stroke="#1e293b"
                    strokeDasharray={pct === effectiveYMin || pct === effectiveYMax ? undefined : '4 4'}
                  />
                  <text x={6} y={y + 3} fill="#64748b" fontSize="10.5" fontFamily="monospace">
                    {pct}%
                  </text>
                </g>
              );
            })}

            {binned.length > 0 ? (
              <>
                {/* Shaded Min-Max Destruction Band */}
                {binned.length > 1 && (
                  <polygon
                    fill="rgba(250, 204, 21, 0.14)"
                    points={buildBandPolygon(
                      binned.map((b) => b.minPct),
                      binned.map((b) => b.maxPct),
                      mainChartWidth,
                      340,
                      effectiveYMin,
                      effectiveYMax,
                      40,
                      22
                    )}
                  />
                )}

                {/* Window Mean Destruction % */}
                <polyline
                  fill="none"
                  stroke="#facc15"
                  strokeWidth="1.8"
                  points={buildLinePoints(
                    binned.map((b) => b.meanPct),
                    mainChartWidth,
                    340,
                    effectiveYMin,
                    effectiveYMax,
                    40,
                    22
                  )}
                />

                {/* 50-Episode Rolling Average Destruction % (Main Trend Line) */}
                <polyline
                  fill="none"
                  stroke="#f97316"
                  strokeWidth="3.0"
                  points={buildLinePoints(
                    binned.map((b) => b.avg50Pct),
                    mainChartWidth,
                    340,
                    effectiveYMin,
                    effectiveYMax,
                    40,
                    22
                  )}
                />

                {/* X-axis Episode labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                  const bIdx = Math.min(
                    binned.length - 1,
                    Math.floor(frac * (binned.length - 1))
                  );
                  const b = binned[bIdx];
                  const x = 40 + frac * (mainChartWidth - 54);
                  return (
                    <text
                      key={idx}
                      x={x}
                      y={334}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      Ep {b.epEnd}
                    </text>
                  );
                })}
              </>
            ) : (
              <text
                x={mainChartWidth / 2}
                y={170}
                textAnchor="middle"
                fill="#64748b"
                fontSize="13"
                fontFamily="monospace"
              >
                Click "Resume & Train" above to stream live GPU training curves
              </text>
            )}
          </svg>
        </section>

        {/* BOTTOM 3-COLUMN LIVE ANALYTICS GRID */}
        <div className="ai-analytics-grid">
          {/* COL 1: ARMY USAGE & PERFORMANCE STATS */}
          <section className="ai-card" ref={armyChartRef}>
            <div className="ai-card-header">
              <h3>⚔️ Army Performance (3 Meta Armies)</h3>
              <div className="ai-chart-legend" style={{ fontSize: '0.72rem' }}>
                {ARMY_SHORT.map((name, i) => (
                  <span key={i} title={matchupStats.armies?.[i] ?? name}>
                    <i className="ai-dot" style={{ background: ARMY_COLORS[i] }} />
                    {name.split(' ')[0]}
                  </span>
                ))}
              </div>
            </div>

            <svg
              viewBox={`0 0 ${armyChartWidth} 115`}
              className="ai-svg-chart"
              style={{ height: 115, marginBottom: 8 }}
            >
              {[25, 50, 75, 100].map((pct) => {
                const y = 115 - 10 - (pct / 100) * (115 - 20);
                return (
                  <g key={pct}>
                    <line
                      x1={32}
                      y1={y}
                      x2={armyChartWidth - 14}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray={pct === 100 ? undefined : '3 3'}
                    />
                    <text x={4} y={y + 3} fill="#64748b" fontSize="8.5" fontFamily="monospace">
                      {pct}%
                    </text>
                  </g>
                );
              })}
              {armyTrends.length > 0 ? (
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <polyline
                      key={i}
                      fill="none"
                      stroke={ARMY_COLORS[i]}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={buildLinePoints(
                        armyTrends.map((b) => b.values[i]),
                        armyChartWidth,
                        115,
                        0,
                        100,
                        32,
                        10
                      )}
                    />
                  ))}
                  {[0, 0.5, 1].map((frac, idx) => {
                    const bIdx = Math.min(
                      armyTrends.length - 1,
                      Math.floor(frac * (armyTrends.length - 1))
                    );
                    const b = armyTrends[bIdx];
                    const x = 32 + frac * (armyChartWidth - 46);
                    return (
                      <text
                        key={idx}
                        x={x}
                        y={112}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="8.5"
                        fontFamily="monospace"
                      >
                        Ep {b.ep}
                      </text>
                    );
                  })}
                </>
              ) : (
                <text
                  x={armyChartWidth / 2}
                  y="60"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  Start training to stream Army mastery curves
                </text>
              )}
            </svg>

            <table className="ai-matrix-table">
              <thead>
                <tr>
                  <th>TH18 Meta Army</th>
                  <th>Used %</th>
                  <th>Recent 50</th>
                  <th>All Avg</th>
                  <th>Peak</th>
                  <th>Avg ★</th>
                  <th>Eps</th>
                </tr>
              </thead>
              <tbody>
                {(matchupStats?.army_stats ?? []).map((st) => (
                  <tr key={st.army_idx}>
                    <td title={st.full_name}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <i className="ai-dot" style={{ background: ARMY_COLORS[st.army_idx] ?? '#facc15' }} />
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
                    <td>{st.episodes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* COL 2: VILLAGE MATCHUP STATS */}
          <section className="ai-card" ref={villageChartRef}>
            <div className="ai-card-header">
              <h3>🏰 Village Performance (5 Villages)</h3>
              <div className="ai-chart-legend" style={{ fontSize: '0.72rem' }}>
                {VILLAGE_SHORT.map((name, i) => (
                  <span key={i} title={matchupStats.villages?.[i] ?? name}>
                    <i className="ai-dot" style={{ background: VILLAGE_COLORS[i] }} />
                    V{i + 1}
                  </span>
                ))}
              </div>
            </div>

            <svg
              viewBox={`0 0 ${villageChartWidth} 115`}
              className="ai-svg-chart"
              style={{ height: 115, marginBottom: 8 }}
            >
              {[25, 50, 75, 100].map((pct) => {
                const y = 115 - 10 - (pct / 100) * (115 - 20);
                return (
                  <g key={pct}>
                    <line
                      x1={32}
                      y1={y}
                      x2={villageChartWidth - 14}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray={pct === 100 ? undefined : '3 3'}
                    />
                    <text x={4} y={y + 3} fill="#64748b" fontSize="8.5" fontFamily="monospace">
                      {pct}%
                    </text>
                  </g>
                );
              })}
              {villageTrends.length > 0 ? (
                <>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <polyline
                      key={i}
                      fill="none"
                      stroke={VILLAGE_COLORS[i]}
                      strokeWidth="2.0"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={buildLinePoints(
                        villageTrends.map((b) => b.values[i]),
                        villageChartWidth,
                        115,
                        0,
                        100,
                        32,
                        10
                      )}
                    />
                  ))}
                  {[0, 0.5, 1].map((frac, idx) => {
                    const bIdx = Math.min(
                      villageTrends.length - 1,
                      Math.floor(frac * (villageTrends.length - 1))
                    );
                    const b = villageTrends[bIdx];
                    const x = 32 + frac * (villageChartWidth - 46);
                    return (
                      <text
                        key={idx}
                        x={x}
                        y={112}
                        textAnchor="middle"
                        fill="#64748b"
                        fontSize="8.5"
                        fontFamily="monospace"
                      >
                        Ep {b.ep}
                      </text>
                    );
                  })}
                </>
              ) : (
                <text
                  x={villageChartWidth / 2}
                  y="60"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  Start training to stream Village defense curves
                </text>
              )}
            </svg>

            <table className="ai-matrix-table">
              <thead>
                <tr>
                  <th>TH18 Meta Village</th>
                  <th>Used %</th>
                  <th>Recent 50</th>
                  <th>All Avg</th>
                  <th>Peak</th>
                  <th>Avg ★</th>
                  <th>Eps</th>
                </tr>
              </thead>
              <tbody>
                {(matchupStats?.village_stats ?? []).map((st) => (
                  <tr key={st.village_idx}>
                    <td title={st.full_name}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <i className="ai-dot" style={{ background: VILLAGE_COLORS[st.village_idx] ?? '#4ade80' }} />
                        V{st.village_idx + 1}: {VILLAGE_SHORT[st.village_idx] ?? st.name}
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
                    <td>{st.episodes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* COL 3: LOSSES, ACTION PACING & RECENT EPISODES */}
          <section className="ai-card" ref={pacingChartRef}>
            <div className="ai-card-header">
              <h3>🧠 Return, Entropy & Action Pacing</h3>
            </div>
            <svg
              viewBox={`0 0 ${pacingChartWidth} 115`}
              className="ai-svg-chart"
              style={{ height: 115 }}
            >
              {binned.length > 0 ? (
                <>
                  <polyline
                    fill="none"
                    stroke="#fde047"
                    strokeWidth="2.2"
                    points={buildLinePoints(
                      binned.map((b) => b.meanReward),
                      pacingChartWidth,
                      115,
                      Math.min(0, ...binned.map((b) => b.meanReward)),
                      Math.max(15, ...binned.map((b) => b.meanReward)),
                      12,
                      10
                    )}
                  />
                  <polyline
                    fill="none"
                    stroke="#c084fc"
                    strokeWidth="1.8"
                    points={buildLinePoints(
                      binned.map((b) => b.meanEntropy),
                      pacingChartWidth,
                      115,
                      0,
                      Math.max(8, ...binned.map((b) => b.meanEntropy)),
                      12,
                      10
                    )}
                  />
                </>
              ) : (
                <text
                  x={pacingChartWidth / 2}
                  y="60"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  Return R & Entropy H(π)
                </text>
              )}
            </svg>

            <div className="ai-stacked-bar">
              <div
                style={{ width: `${pacingTotals.noop}%`, background: '#38bdf8' }}
              />
              <div
                style={{ width: `${pacingTotals.deploy}%`, background: '#facc15' }}
              />
              <div
                style={{ width: `${pacingTotals.spell}%`, background: '#c084fc' }}
              />
              <div
                style={{ width: `${pacingTotals.ability}%`, background: '#4ade80' }}
              />
            </div>
            <div className="ai-chart-legend">
              <span>
                <i className="ai-dot" style={{ background: '#38bdf8' }} />
                NoOp {pacingTotals.noop}%
              </span>
              <span>
                <i className="ai-dot" style={{ background: '#facc15' }} />
                Deploy {pacingTotals.deploy}%
              </span>
              <span>
                <i className="ai-dot" style={{ background: '#c084fc' }} />
                Spells {pacingTotals.spell}%
              </span>
              <span>
                <i className="ai-dot" style={{ background: '#4ade80' }} />
                Abilities {pacingTotals.ability}%
              </span>
            </div>

            <div className="ai-history-list" style={{ marginTop: 4 }}>
              {history
                .slice(-5)
                .reverse()
                .map((ep) => (
                  <div key={ep.episode} className="ai-history-row">
                    <span
                      style={{
                        color: '#fde047',
                        fontWeight: 700,
                      }}
                    >
                      Ep {ep.episode}
                    </span>
                    <span>
                      A{(ep.army_idx ?? 0) + 1} vs V{(ep.village_idx ?? 0) + 1}
                    </span>
                    <span>
                      {ep.destruction_pct}% ({ep.stars}★)
                    </span>
                    <span>NoOp {ep.noop_pct ?? 0}%</span>
                    <span>{ep.fps_ticks} t/s</span>
                  </div>
                ))}
            </div>
          </section>
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

  const testHp = activeTestModel?.hyperparams ?? inspectData?.model_meta?.hyperparams;

  return (
    <div className="ai-studio-workspace">
      {/* LEFT / CENTER: INTERACTIVE VILLAGE SANDBOX */}
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
                  className="clash-btn gold"
                  disabled={!serverStatus?.online || isRunningRollout}
                  onClick={handleRunTrainedModelTest}
                >
                  {isRunningRollout ? '⏳ Loading...' : '▶️ Run Trained Model (.pt)'}
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

      {/* RIGHT SIDEBAR: TRAINED MODEL SELECTOR, VILLAGE/ARMY PICKER & ROLLOUT INSPECTOR */}
      <aside className="ai-studio-sidebar">
        {/* 1. SELECT TRAINED MODEL FILE FROM `trained_models/` */}
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
                💾 {m.filename} (Ep {m.episode} • Best {m.best_pct}% {m.best_stars}★)
              </option>
            ))}
          </select>

          {/* Training Hyperparameters Dossier */}
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
              <strong style={{ color: '#e2e8f0' }}>Ep:</strong> {activeTestModel?.episode ?? 0}
            </span>
            <span>
              <strong style={{ color: '#facc15' }}>Peak:</strong>{' '}
              {activeTestModel?.best_pct ?? 0}% ({activeTestModel?.best_stars ?? 0}★)
            </span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>LR:</strong> {testHp?.lr ?? 0.0003}
            </span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>Batch:</strong>{' '}
              {testHp?.batch_episodes ?? 4} eps
            </span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>Epochs:</strong>{' '}
              {testHp?.ppo_epochs ?? 4}
            </span>
            <span>
              <strong style={{ color: '#e2e8f0' }}>Sampling:</strong>{' '}
              {testHp?.matchup_mode ?? 'random'}
            </span>
          </div>

          <div className="ai-form-grid" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
            <label>
              <span>Replay Speed</span>
              <select
                className="clash-select"
                value={testSpeedMode}
                onChange={(e) =>
                  setTestSpeedMode(e.target.value as 'watch' | 'fast' | 'instant')
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

          <button
            className="clash-btn gold"
            style={{ width: '100%' }}
            disabled={!serverStatus?.online || isRunningRollout}
            onClick={handleRunTrainedModelTest}
          >
            {isRunningRollout
              ? '⏳ Running PyTorch Rollout...'
              : `▶️ Attack with ${testModelFile}`}
          </button>
        </section>

        {/* 2. TRAINED ATTACK COMPOSITIONS POOL (FIXED TO MODEL / READ-ONLY) */}
        <section className="ai-card">
          <div className="ai-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3>⚔️ Model Attack Compositions ({testArmies.length})</h3>
              <span className="badge-gold" style={{ fontSize: '0.66rem' }}>
                🔒 Immutable
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Model Draw Pool
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 6px 0' }}>
            The model was trained exclusively on these {testArmies.length} attack compositions (fixed). Select one to test against the village:
          </p>

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
                    <span className="ai-prob-label" style={{ fontWeight: isSelected ? 700 : 500 }}>
                      A{idx + 1}: {arm.name}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                      {arm.troops.slice(0, 3).map(([t, c]) => `${c}× ${t}`).join(', ')}
                      {arm.troops.length > 3 ? ` +${arm.troops.length - 3} more` : ''}
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

        {/* 3. TRAINED VILLAGE LAYOUTS POOL (FIXED TO MODEL / READ-ONLY) */}
        <section className="ai-card">
          <div className="ai-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <h3>🏰 Model Village Layouts ({testVillages.length})</h3>
              <span className="badge-gold" style={{ fontSize: '0.66rem' }}>
                🔒 Immutable
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Model Target Pool
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: '0 0 6px 0' }}>
            The model was trained to attack these {testVillages.length} base layouts (fixed). Select one to view on the canvas:
          </p>

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
                    <span className="ai-prob-label" style={{ fontWeight: isSelected ? 700 : 500 }}>
                      V{idx + 1}: {vil.name}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 2 }}>
                      TH18 • {vil.buildings.length} Buildings • {vil.walls.length} Walls
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

        {/* 3. SPATIAL TENSOR & ROLLOUT TELEMETRY */}
        <section className="ai-card">
          <div className="ai-card-header">
            <h3>Spatial Tensor & Policy Heatmap</h3>
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
                    {lastRolloutResult.destruction_pct}% ({lastRolloutResult.stars}
                    ★) • NoOp {lastRolloutResult.noop_pct}%
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
                        ? ` (×${s.deploy_count} • α=${Math.round((s.deploy_fraction ?? 1) * 100)}%)`
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
