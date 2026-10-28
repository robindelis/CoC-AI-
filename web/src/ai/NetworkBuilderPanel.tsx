import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchAITrainingFeedback,
  fetchArchitectureSpec,
  getArchitectureSvgUrl,
  requestAITrainingFeedback,
} from './aiClient';
import {
  AIArchitectureLayerSpec,
  AIArchitectureSpec,
  AIFeedbackProviderId,
  AITelemetryWindowSummary,
  AITrainingEpisodeRecord,
  AITrainingFeedbackResponse,
} from './aiTypes';

const DEFAULT_LAYERS: AIArchitectureLayerSpec[] = [
  {
    id: 's1',
    stage: 'spatial',
    type: 'Conv2d + GroupNorm + SiLU',
    short: 'Conv2d',
    desc: '32 filters, 3×3, s=1, p=1, GroupNorm(4), SiLU (10-ch input incl. Allied & Enemy Unit Types)',
    inputShape: [10, 50, 50],
    outputShape: [32, 50, 50],
    receptiveField: 3,
    params: 2944,
    macs: 7200000,
    color: '#2563eb',
    border: '#60a5fa',
    coneLabel: '3×3',
  },
  {
    id: 's2',
    stage: 'spatial',
    type: 'Conv2d + GroupNorm + SiLU',
    short: 'Conv2d',
    desc: '64 filters, 3×3, s=1, p=1, GroupNorm(8), SiLU',
    inputShape: [32, 50, 50],
    outputShape: [64, 50, 50],
    receptiveField: 5,
    params: 18560,
    macs: 46080000,
    color: '#2563eb',
    border: '#60a5fa',
    coneLabel: '3×3',
  },
  {
    id: 's3',
    stage: 'spatial',
    type: 'Dilated Residual Block',
    short: 'ResBlock',
    desc: '2×Conv 64 ch, 3×3, d=2 (p=2) → d=1 (p=1), skip+, GroupNorm(8), SiLU',
    inputShape: [64, 50, 50],
    outputShape: [64, 50, 50],
    receptiveField: 11,
    params: 73984,
    macs: 184320000,
    color: '#7c3aed',
    border: '#a78bfa',
    coneLabel: '3×3 d=2',
    hasSkipArc: true,
  },
  {
    id: 'g1',
    stage: 'global',
    type: 'Strided Conv2d + SiLU',
    short: 'Conv2d',
    desc: '96 filters, 3×3, stride=2, pad=1, SiLU',
    inputShape: [64, 50, 50],
    outputShape: [96, 25, 25],
    receptiveField: 15,
    params: 55392,
    macs: 34560000,
    color: '#2563eb',
    border: '#60a5fa',
    coneLabel: '3×3 s=2',
  },
  {
    id: 'g2',
    stage: 'global',
    type: 'Strided Conv2d + SiLU',
    short: 'Conv2d',
    desc: '128 filters, 3×3, stride=2, pad=1, SiLU',
    inputShape: [96, 25, 25],
    outputShape: [128, 13, 13],
    receptiveField: 23,
    params: 110720,
    macs: 18691584,
    color: '#2563eb',
    border: '#60a5fa',
    coneLabel: '3×3 s=2',
  },
  {
    id: 'g3',
    stage: 'global',
    type: 'AdaptiveAvgPool2d',
    short: 'AdapPool',
    desc: 'Adaptive Grid 4×4',
    inputShape: [128, 13, 13],
    outputShape: [128, 4, 4],
    receptiveField: 50,
    params: 0,
    macs: 0,
    color: '#d97706',
    border: '#fbbf24',
    coneLabel: 'Pool 4×4',
  },
  {
    id: 'g4',
    stage: 'global',
    type: 'Flatten',
    short: 'Flatten',
    desc: 'Flatten 128×4×4 → 2048',
    inputShape: [128, 4, 4],
    outputShape: [2048],
    receptiveField: 50,
    params: 0,
    macs: 0,
    color: '#475569',
    border: '#94a3b8',
    coneLabel: 'Flatten',
  },
  {
    id: 'g5',
    stage: 'global',
    type: 'Linear + LayerNorm + SiLU',
    short: 'Linear',
    desc: 'Linear(2048 → 256) + LayerNorm(256) + SiLU',
    inputShape: [2048],
    outputShape: [256],
    receptiveField: 50,
    params: 525056,
    macs: 524288,
    color: '#059669',
    border: '#34d399',
    coneLabel: 'Dense',
  },
  {
    id: 'head_army_ctx',
    stage: 'heads',
    type: 'army_context_proj',
    short: 'ArmyCtx',
    desc: 'Linear(64 → 256) + LayerNorm(256) + SiLU',
    inputShape: [64],
    outputShape: [256],
    receptiveField: 50,
    params: 17152,
    macs: 16384,
    color: '#059669',
    border: '#34d399',
  },
  {
    id: 'head_slot_type',
    stage: 'heads',
    type: 'slot_type_head',
    short: 'TypeHead',
    desc: 'Linear(256 → 7 Action Types)',
    inputShape: [256],
    outputShape: [7],
    receptiveField: 50,
    params: 1799,
    macs: 1792,
    color: '#ca8a04',
    border: '#facc15',
  },
  {
    id: 'head_slot_idx',
    stage: 'heads',
    type: 'slot_idx_head',
    short: 'IdxHead',
    desc: 'MLP(263 → 128 → 10 Loadout Slots, SiLU)',
    inputShape: [263],
    outputShape: [10],
    receptiveField: 50,
    params: 35082,
    macs: 34944,
    color: '#0284c7',
    border: '#38bdf8',
  },
  {
    id: 'head_deploy_fraction',
    stage: 'heads',
    type: 'deploy_fraction_head',
    short: 'FracHead',
    desc: 'MLP(273 → 128 → 5 Troop Fraction Bins α ∈ [0,1], SiLU)',
    inputShape: [273],
    outputShape: [5],
    receptiveField: 50,
    params: 35717,
    macs: 35584,
    color: '#9333ea',
    border: '#c084fc',
  },
  {
    id: 'head_tile_conv',
    stage: 'heads',
    type: 'tile_conv_head',
    short: 'TileHead',
    desc: 'Cond(263 → 64) + Conv 3×3(64 → 32) + Conv 1×1(32 → 1)',
    inputShape: [64, 50, 50],
    outputShape: [1, 50, 50],
    receptiveField: 50,
    params: 35393,
    macs: 46160000,
    color: '#d97706',
    border: '#facc15',
  },
  {
    id: 'head_critic',
    stage: 'heads',
    type: 'critic_head',
    short: 'Critic',
    desc: 'MLP(256 → 128 → 1 Value V(s), SiLU)',
    inputShape: [256],
    outputShape: [1],
    receptiveField: 50,
    params: 33025,
    macs: 32896,
    color: '#16a34a',
    border: '#4ade80',
  },
];

interface NetworkBuilderPanelProps {
  serverOnline: boolean;
  architectureSpec?: AIArchitectureSpec;
  architectureHash?: string;
  activeCheckpoint?: string;
  history?: AITrainingEpisodeRecord[];
}

function summarizeHistorySlice(
  records: AITrainingEpisodeRecord[],
  label: string
): AITelemetryWindowSummary {
  const n = Math.max(1, records.length);
  const pcts = records.map((r) => r.destruction_pct);
  const stars = records.map((r) => r.stars);
  const rews = records.map((r) => r.reward);
  const noops = records.map((r) => r.noop_pct ?? 0);
  const steps = records.map((r) => r.steps);
  const deploys = records.map((r) => r.deploy_steps ?? 0);
  const spells = records.map((r) => r.spell_steps ?? 0);
  const abilities = records.map((r) => r.ability_steps ?? 0);
  const ploss = records.map((r) => r.policy_loss);
  const vloss = records.map((r) => r.value_loss);
  const ents = records.map((r) => r.entropy);
  const kls = records.map((r) => r.approx_kl);

  const meanPct = pcts.reduce((a, b) => a + b, 0) / n;
  const stdPct = Math.sqrt(
    pcts.reduce((a, b) => a + (b - meanPct) ** 2, 0) / n
  );

  return {
    window: label,
    ep_start: records[0]?.episode ?? 1,
    ep_end: records[records.length - 1]?.episode ?? n,
    episodes: records.length,
    mean_pct: Math.round(meanPct * 100) / 100,
    std_pct: Math.round(stdPct * 100) / 100,
    min_pct: records.length ? Math.min(...pcts) : 0,
    max_pct: records.length ? Math.max(...pcts) : 0,
    mean_stars: Math.round((stars.reduce((a, b) => a + b, 0) / n) * 100) / 100,
    zero_star_rate_pct:
      Math.round((stars.filter((s) => s === 0).length / n) * 1000) / 10,
    one_plus_star_rate_pct:
      Math.round((stars.filter((s) => s >= 1).length / n) * 1000) / 10,
    two_plus_star_th_rate_pct:
      Math.round((stars.filter((s) => s >= 2).length / n) * 1000) / 10,
    three_star_triple_rate_pct:
      Math.round((stars.filter((s) => s >= 3).length / n) * 1000) / 10,
    mean_reward: Math.round((rews.reduce((a, b) => a + b, 0) / n) * 100) / 100,
    mean_noop_pct:
      Math.round((noops.reduce((a, b) => a + b, 0) / n) * 100) / 100,
    mean_steps: Math.round((steps.reduce((a, b) => a + b, 0) / n) * 10) / 10,
    mean_deploy_steps:
      Math.round((deploys.reduce((a, b) => a + b, 0) / n) * 10) / 10,
    mean_spell_steps:
      Math.round((spells.reduce((a, b) => a + b, 0) / n) * 10) / 10,
    mean_ability_steps:
      Math.round((abilities.reduce((a, b) => a + b, 0) / n) * 10) / 10,
    mean_policy_loss:
      Math.round((ploss.reduce((a, b) => a + b, 0) / n) * 10000) / 10000,
    mean_value_loss:
      Math.round((vloss.reduce((a, b) => a + b, 0) / n) * 1000) / 1000,
    mean_entropy:
      Math.round((ents.reduce((a, b) => a + b, 0) / n) * 1000) / 1000,
    mean_approx_kl:
      Math.round((kls.reduce((a, b) => a + b, 0) / n) * 10000) / 10000,
  };
}

const HEALTH_STYLE: Record<
  string,
  { label: string; bg: string; border: string; text: string }
> = {
  progressing: {
    label: 'PROGRESSING',
    bg: 'rgba(34, 197, 94, 0.16)',
    border: '#22c55e',
    text: '#4ade80',
  },
  plateaued: {
    label: 'PLATEAUED',
    bg: 'rgba(245, 158, 11, 0.16)',
    border: '#f59e0b',
    text: '#fbbf24',
  },
  degrading: {
    label: 'DEGRADING',
    bg: 'rgba(239, 68, 68, 0.18)',
    border: '#ef4444',
    text: '#f87171',
  },
  unstable: {
    label: 'UNSTABLE',
    bg: 'rgba(239, 68, 68, 0.18)',
    border: '#ef4444',
    text: '#f87171',
  },
  early_stage: {
    label: 'EARLY STAGE',
    bg: 'rgba(56, 189, 248, 0.16)',
    border: '#38bdf8',
    text: '#7dd3fc',
  },
};

const SEVERITY_STYLE: Record<
  string,
  { badge: string; border: string; color: string; bg: string }
> = {
  critical: {
    badge: 'CRITICAL',
    border: '#ef4444',
    color: '#fca5a5',
    bg: 'rgba(239, 68, 68, 0.12)',
  },
  warning: {
    badge: 'WARNING',
    border: '#f59e0b',
    color: '#fcd34d',
    bg: 'rgba(245, 158, 11, 0.10)',
  },
  info: {
    badge: 'INFO',
    border: '#38bdf8',
    color: '#7dd3fc',
    bg: 'rgba(56, 189, 248, 0.10)',
  },
};

export const NetworkBuilderPanel: React.FC<NetworkBuilderPanelProps> = ({
  serverOnline,
  architectureSpec,
  architectureHash,
  activeCheckpoint,
  history = [],
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [vizMode, setVizMode] = useState<'cnn3d' | 'torchview'>('cnn3d');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>('s1');
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [torchviewDetail, setTorchviewDetail] = useState<'overview' | 'detailed'>('overview');
  const [liveSpec, setLiveSpec] = useState<AIArchitectureSpec | null>(architectureSpec ?? null);
  const [liveHash, setLiveHash] = useState<string>(architectureHash ?? String(Date.now()));
  const [refreshCount, setRefreshCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // AI Training Feedback state
  const [feedbackProvider, setFeedbackProvider] =
    useState<AIFeedbackProviderId>('opencode_argon');
  const [feedbackData, setFeedbackData] =
    useState<AITrainingFeedbackResponse | null>(null);
  const [isAnalyzingFeedback, setIsAnalyzingFeedback] = useState<boolean>(false);
  const [isSyncingTelemetry, setIsSyncingTelemetry] = useState<boolean>(false);

  const handleSyncTelemetryOnly = useCallback(async () => {
    setIsSyncingTelemetry(true);
    try {
      const res = await fetchAITrainingFeedback(true, feedbackProvider);
      if (res) {
        setFeedbackData(res);
      }
    } finally {
      setIsSyncingTelemetry(false);
    }
  }, [feedbackProvider]);

  const livePhases = useMemo<AITelemetryWindowSummary[]>(() => {
    if (history.length >= 20) {
      const n = history.length;
      const numP = Math.min(5, Math.max(1, Math.floor(n / 10)));
      const out: AITelemetryWindowSummary[] = [];
      for (let i = 0; i < numP; i++) {
        const s = Math.floor((i * n) / numP);
        const e = Math.floor(((i + 1) * n) / numP);
        if (e > s) {
          out.push(summarizeHistorySlice(history.slice(s, e), `Phase ${i + 1}/${numP}`));
        }
      }
      return out;
    }
    return feedbackData?.telemetry?.phases ?? [];
  }, [history, feedbackData?.telemetry?.phases]);

  const liveWindows = useMemo<Record<string, AITelemetryWindowSummary>>(() => {
    if (history.length >= 10) {
      const n = history.length;
      const w: Record<string, AITelemetryWindowSummary> = {
        first_50: summarizeHistorySlice(history.slice(0, Math.min(50, n)), 'First 50'),
        recent_50: summarizeHistorySlice(history.slice(-Math.min(50, n)), 'Recent 50'),
        recent_10: summarizeHistorySlice(history.slice(-Math.min(10, n)), 'Recent 10'),
      };
      if (n > 100) {
        w.prev_100 = summarizeHistorySlice(
          history.slice(Math.max(0, n - 150), Math.max(1, n - 50)),
          'Prev 100'
        );
      }
      return w;
    }
    return feedbackData?.telemetry?.windows ?? {};
  }, [history, feedbackData?.telemetry?.windows]);

  const syncArchitectureFromServer = useCallback(async (force = false) => {
    setIsRefreshing(true);
    try {
      const res = await fetchArchitectureSpec(force);
      if (res?.spec) {
        setLiveSpec(res.spec);
      }
      if (res?.architecture_hash) {
        setLiveHash(`${res.architecture_hash}-${Date.now()}`);
      } else {
        setLiveHash(String(Date.now()));
      }
      setRefreshCount((c) => c + 1);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleRunFeedbackAnalysis = useCallback(
    async (providerOverride?: AIFeedbackProviderId) => {
      const targetProvider = providerOverride ?? feedbackProvider;
      setIsAnalyzingFeedback(true);
      try {
        const res = await requestAITrainingFeedback(
          targetProvider,
          activeCheckpoint
        );
        if (res) {
          setFeedbackData(res);
        }
      } finally {
        setIsAnalyzingFeedback(false);
      }
    },
    [feedbackProvider, activeCheckpoint]
  );

  const handleSelectFeedbackProvider = useCallback(
    async (nextProvider: AIFeedbackProviderId) => {
      setFeedbackProvider(nextProvider);
      const cached = await fetchAITrainingFeedback(false, nextProvider);
      if (cached && cached.provider === nextProvider && cached.feedback) {
        setFeedbackData(cached);
      }
    },
    []
  );
  useEffect(() => {
    void syncArchitectureFromServer(false);
    void fetchAITrainingFeedback(false).then((res) => {
      if (res) {
        setFeedbackData(res);
        if (res.provider === 'opencode_argon' || res.provider === 'agy_flash') {
          setFeedbackProvider(res.provider);
        }
      }
    });
  }, [syncArchitectureFromServer]);

  // Also sync whenever AIStudioView receives an updated architectureSpec or architectureHash
  useEffect(() => {
    if (architectureSpec) {
      setLiveSpec(architectureSpec);
    }
    if (architectureHash) {
      setLiveHash(architectureHash);
    }
  }, [architectureSpec, architectureHash]);

  const activeLayers = liveSpec?.layers ?? DEFAULT_LAYERS;
  const inChannels = liveSpec?.in_channels ?? activeLayers[0]?.inputShape[0] ?? 10;
  const spatialDim = liveSpec?.spatial_dim ?? 64;
  const embedDim = liveSpec?.embed_dim ?? 256;
  const numFracBins = liveSpec?.num_fraction_bins ?? 5;
  const totalParams =
    liveSpec?.total_params ?? activeLayers.reduce((acc, l) => acc + l.params, 0);
  const totalMacs =
    liveSpec?.total_macs ?? activeLayers.reduce((acc, l) => acc + l.macs, 0);
  const estimatedVramMb = Number(((totalParams * 4 * 3) / (1024 * 1024)).toFixed(1));

  const spatialLayers = activeLayers.filter((l) => l.stage === 'spatial');
  const globalLayers = activeLayers.filter((l) => l.stage === 'global');
  const headLayers = activeLayers.filter((l) => l.stage === 'heads');
  const hoveredSummary = activeLayers.find((l) => l.id === hoveredBlockId) ?? null;

  const spatialParamSum = spatialLayers.reduce((a, b) => a + b.params, 0);
  const globalParamSum = globalLayers.reduce((a, b) => a + b.params, 0);
  const headParamSum = headLayers.reduce((a, b) => a + b.params, 0);
  const safeTotal = Math.max(1, spatialParamSum + globalParamSum + headParamSum);
  const spatialPct = Math.round((spatialParamSum / safeTotal) * 100);
  const globalPct = Math.round((globalParamSum / safeTotal) * 100);
  const headPct = Math.max(0, 100 - spatialPct - globalPct);

  const render3DCnnDiagram = () => {
    const stepX = 112;
    const startX = 64;
    const stemY = 175;
    const topBranchY = 112;
    const botBranchY = 262;

    const splitX = startX + (spatialLayers.length + 1) * stepX;
    const totalCols = spatialLayers.length + globalLayers.length + 4;
    const svgWidth = Math.max(1060, startX + totalCols * stepX + 80);
    const svgHeight = 355;

    const drawCuboid = (opts: {
      key: string;
      cx: number;
      cy: number;
      c: number;
      h: number;
      w: number;
      color: string;
      borderColor: string;
      topLabel: string;
      subLabel: string;
      shapeLabel: string;
      isSelected?: boolean;
      isHovered?: boolean;
      hasSkipArc?: boolean;
      onClick?: () => void;
      onHover?: (id: string | null) => void;
    }) => {
      const sideH = Math.max(24, Math.min(98, 20 + (opts.h / 50) * 76));
      const sideW = Math.max(16, Math.min(44, 12 + (opts.w / 50) * 30));
      const depth = Math.max(10, Math.min(46, Math.round(Math.log2(Math.max(2, opts.c)) * 5.8)));
      const dx = Math.round(depth * 0.72);
      const dy = Math.round(depth * 0.42);

      const x0 = opts.cx - depth / 2;
      const y0 = opts.cy - sideH / 2;

      const frontPts = `${x0},${y0} ${x0 + depth},${y0} ${x0 + depth},${y0 + sideH} ${x0},${y0 + sideH}`;
      const topPts = `${x0},${y0} ${x0 + dx},${y0 - dy} ${x0 + depth + dx},${y0 - dy} ${x0 + depth},${y0}`;
      const rightPts = `${x0 + depth},${y0} ${x0 + depth + dx},${y0 - dy} ${x0 + depth + dx},${y0 + sideH - dy} ${x0 + depth},${y0 + sideH}`;

      const sliceCount = Math.min(6, Math.max(2, Math.floor(opts.c / 24)));
      const slices = Array.from({ length: sliceCount - 1 }, (_, i) => {
        const frac = (i + 1) / sliceCount;
        const sx = x0 + frac * depth;
        return (
          <g key={i} opacity={0.35}>
            <line x1={sx} y1={y0} x2={sx} y2={y0 + sideH} stroke="#0f172a" strokeWidth={1} />
            <line x1={sx} y1={y0} x2={sx + dx} y2={y0 - dy} stroke="#0f172a" strokeWidth={1} />
          </g>
        );
      });

      const strokeW = opts.isSelected ? 2.5 : opts.isHovered ? 2.0 : 1.2;
      const strokeCol = opts.isSelected
        ? '#facc15'
        : opts.isHovered
        ? '#ffffff'
        : opts.borderColor;

      return (
        <g
          key={opts.key}
          style={{ cursor: opts.onClick ? 'pointer' : 'default' }}
          onClick={opts.onClick}
          onMouseEnter={() => opts.onHover?.(opts.key)}
          onMouseLeave={() => opts.onHover?.(null)}
        >
          {opts.hasSkipArc && (
            <g>
              <path
                d={`M ${x0 - 28} ${y0 - 4} Q ${opts.cx + dx / 2} ${y0 - dy - 32} ${
                  x0 + depth + dx + 8
                } ${y0 - 4}`}
                fill="none"
                stroke="#facc15"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
              <circle
                cx={x0 + depth + dx + 8}
                cy={y0 - 4}
                r={7}
                fill="#0f172a"
                stroke="#facc15"
                strokeWidth={1.5}
              />
              <text
                x={x0 + depth + dx + 8}
                y={y0 - 1}
                textAnchor="middle"
                fill="#facc15"
                fontSize={10}
                fontWeight={800}
              >
                +
              </text>
            </g>
          )}

          {opts.isSelected && (
            <rect
              x={x0 - 6}
              y={y0 - dy - 6}
              width={depth + dx + 12}
              height={sideH + dy + 12}
              rx={6}
              fill="none"
              stroke="#facc15"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          )}

          <polygon
            points={topPts}
            fill={opts.color}
            fillOpacity={0.88}
            stroke={strokeCol}
            strokeWidth={strokeW}
          />
          <polygon
            points={rightPts}
            fill={opts.color}
            fillOpacity={0.55}
            stroke={strokeCol}
            strokeWidth={strokeW}
          />
          <polygon
            points={frontPts}
            fill={opts.color}
            fillOpacity={0.74}
            stroke={strokeCol}
            strokeWidth={strokeW}
          />
          {slices}

          {sideW > 18 && (
            <rect
              x={x0 + depth + dx * 0.25}
              y={y0 + sideH * 0.25 - dy * 0.25}
              width={Math.max(5, dx * 0.45)}
              height={Math.max(5, sideW * 0.35)}
              fill="rgba(255,255,255,0.22)"
              stroke="#f8fafc"
              strokeWidth={0.7}
            />
          )}

          <text
            x={opts.cx + dx / 2}
            y={y0 - dy - 10}
            textAnchor="middle"
            fill={opts.isSelected ? '#fde047' : '#f8fafc'}
            fontSize={10.5}
            fontWeight={700}
          >
            {opts.topLabel}
          </text>
          <text
            x={opts.cx + dx / 2}
            y={y0 + sideH + 14}
            textAnchor="middle"
            fill="#fde047"
            fontSize={10}
            fontWeight={700}
          >
            {opts.shapeLabel}
          </text>
          <text
            x={opts.cx + dx / 2}
            y={y0 + sideH + 26}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={9}
          >
            {opts.subLabel}
          </text>
        </g>
      );
    };

    const drawDenseBar = (opts: {
      key: string;
      cx: number;
      cy: number;
      dim: number;
      color: string;
      borderColor: string;
      topLabel: string;
      subLabel: string;
      isSelected?: boolean;
      isHovered?: boolean;
      onClick?: () => void;
      onHover?: (id: string | null) => void;
    }) => {
      const barH = Math.max(28, Math.min(86, Math.round(Math.log2(Math.max(2, opts.dim)) * 8.5)));
      const barW = 16;
      const dx = 7;
      const dy = 5;
      const x0 = opts.cx - barW / 2;
      const y0 = opts.cy - barH / 2;
      const strokeCol = opts.isSelected
        ? '#facc15'
        : opts.isHovered
        ? '#ffffff'
        : opts.borderColor;

      return (
        <g
          key={opts.key}
          style={{ cursor: opts.onClick ? 'pointer' : 'default' }}
          onClick={opts.onClick}
          onMouseEnter={() => opts.onHover?.(opts.key)}
          onMouseLeave={() => opts.onHover?.(null)}
        >
          <polygon
            points={`${x0},${y0} ${x0 + dx},${y0 - dy} ${x0 + barW + dx},${y0 - dy} ${x0 + barW},${y0}`}
            fill={opts.color}
            fillOpacity={0.9}
            stroke={strokeCol}
            strokeWidth={opts.isSelected ? 2.2 : 1.2}
          />
          <polygon
            points={`${x0 + barW},${y0} ${x0 + barW + dx},${y0 - dy} ${x0 + barW + dx},${y0 + barH - dy} ${x0 + barW},${y0 + barH}`}
            fill={opts.color}
            fillOpacity={0.55}
            stroke={strokeCol}
            strokeWidth={opts.isSelected ? 2.2 : 1.2}
          />
          <rect
            x={x0}
            y={y0}
            width={barW}
            height={barH}
            fill={opts.color}
            fillOpacity={0.78}
            stroke={strokeCol}
            strokeWidth={opts.isSelected ? 2.2 : 1.2}
          />
          {[0.25, 0.5, 0.75].map((f, i) => (
            <circle
              key={i}
              cx={x0 + barW / 2}
              cy={y0 + barH * f}
              r={2.2}
              fill="#f8fafc"
              opacity={0.75}
            />
          ))}
          <text
            x={opts.cx + dx / 2}
            y={y0 - dy - 9}
            textAnchor="middle"
            fill={opts.isSelected ? '#fde047' : '#f8fafc'}
            fontSize={10}
            fontWeight={700}
          >
            {opts.topLabel}
          </text>
          <text
            x={opts.cx + dx / 2}
            y={y0 + barH + 14}
            textAnchor="middle"
            fill="#34d399"
            fontSize={10}
            fontWeight={700}
          >
            {opts.dim}D
          </text>
          <text
            x={opts.cx + dx / 2}
            y={y0 + barH + 25}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={8.8}
          >
            {opts.subLabel}
          </text>
        </g>
      );
    };

    const drawFilterCone = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      label?: string,
      color = 'rgba(56, 189, 248, 0.25)',
      stroke = '#38bdf8'
    ) => {
      const patchH = 18;
      return (
        <g key={`cone-${x1}-${y1}-${x2}-${y2}`}>
          <polygon
            points={`${x1 + 14},${y1 - patchH / 2} ${x1 + 14},${y1 + patchH / 2} ${x2 - 14},${y2 + 3} ${x2 - 14},${y2 - 3}`}
            fill={color}
            stroke={stroke}
            strokeWidth={0.9}
            strokeOpacity={0.65}
          />
          {label && (
            <text
              x={(x1 + x2) / 2 + 2}
              y={(y1 + y2) / 2 - 10}
              textAnchor="middle"
              fill="#93c5fd"
              fontSize={8.8}
              fontWeight={600}
            >
              {label}
            </text>
          )}
        </g>
      );
    };

    return (
      <div className="arch-cnn3d-stage">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            width: `${Math.round(svgWidth * zoom)}px`,
            height: `${Math.round(svgHeight * zoom)}px`,
            minWidth: '100%',
          }}
        >
          <defs>
            <linearGradient id="bgGridGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0b1324" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>
          <rect width={svgWidth} height={svgHeight} fill="url(#bgGridGrad)" rx={8} />

          <text x={24} y={22} fill="#60a5fa" fontSize={10.5} fontWeight={800}>
            STAGE 1 • SPATIAL CNN BACKBONE (Full-Res 50×50 Feature Pathway)
          </text>
          <text x={splitX - 20} y={22} fill="#34d399" fontSize={10.5} fontWeight={800}>
            STAGE 2 • GLOBAL TOWER (Top) & STAGE 3 • TILE POINTER + HEADS (Bottom)
          </text>

          {/* 0. Input Volume: obs (inChannels×50×50) */}
          {drawCuboid({
            key: 'input_obs',
            cx: startX,
            cy: stemY,
            c: inChannels,
            h: 50,
            w: 50,
            color: '#0284c7',
            borderColor: '#38bdf8',
            topLabel: 'Input Grid',
            shapeLabel: `${inChannels}×50×50`,
            subLabel: 'Village Tensor',
          })}

          {/* 1. Spatial Stem Volumes */}
          {spatialLayers.map((sLayer, idx) => {
            const prevX = startX + idx * stepX;
            const curX = startX + (idx + 1) * stepX;
            const [c, h, w] = sLayer.outputShape;

            return (
              <React.Fragment key={sLayer.id}>
                {drawFilterCone(prevX, stemY, curX, stemY, sLayer.coneLabel)}
                {drawCuboid({
                  key: sLayer.id,
                  cx: curX,
                  cy: stemY,
                  c,
                  h,
                  w,
                  color: sLayer.color,
                  borderColor: sLayer.border,
                  topLabel: `S${idx + 1}: ${sLayer.short}`,
                  shapeLabel: `${c}×${h}×${w}`,
                  subLabel: `RF ${sLayer.receptiveField}×${sLayer.receptiveField}`,
                  isSelected: selectedBlockId === sLayer.id,
                  isHovered: hoveredBlockId === sLayer.id,
                  hasSkipArc: sLayer.hasSkipArc,
                  onClick: () => setSelectedBlockId(sLayer.id),
                  onHover: setHoveredBlockId,
                })}
              </React.Fragment>
            );
          })}

          {/* 2. Upper Branch: Global Tower Blocks */}
          {globalLayers.map((gLayer, idx) => {
            const prevX = idx === 0 ? splitX - stepX : splitX + (idx - 1) * stepX;
            const prevY = idx === 0 ? stemY : topBranchY;
            const curX = splitX + idx * stepX;
            const is1D = gLayer.outputShape.length === 1;

            return (
              <React.Fragment key={gLayer.id}>
                {drawFilterCone(
                  prevX,
                  prevY,
                  curX,
                  topBranchY,
                  gLayer.coneLabel,
                  'rgba(16, 185, 129, 0.2)',
                  '#34d399'
                )}
                {is1D
                  ? drawDenseBar({
                      key: gLayer.id,
                      cx: curX,
                      cy: topBranchY,
                      dim: gLayer.outputShape[0],
                      color: gLayer.color,
                      borderColor: gLayer.border,
                      topLabel: `G${idx + 1}: ${gLayer.short}`,
                      subLabel:
                        gLayer.params > 0
                          ? `${Math.round(gLayer.params / 1000)}K p`
                          : 'reshape',
                      isSelected: selectedBlockId === gLayer.id,
                      isHovered: hoveredBlockId === gLayer.id,
                      onClick: () => setSelectedBlockId(gLayer.id),
                      onHover: setHoveredBlockId,
                    })
                  : drawCuboid({
                      key: gLayer.id,
                      cx: curX,
                      cy: topBranchY,
                      c: gLayer.outputShape[0],
                      h: gLayer.outputShape[1],
                      w: gLayer.outputShape[2],
                      color: gLayer.color,
                      borderColor: gLayer.border,
                      topLabel: `G${idx + 1}: ${gLayer.short}`,
                      shapeLabel: gLayer.outputShape.join('×'),
                      subLabel: `RF ${gLayer.receptiveField}×${gLayer.receptiveField}`,
                      isSelected: selectedBlockId === gLayer.id,
                      isHovered: hoveredBlockId === gLayer.id,
                      onClick: () => setSelectedBlockId(gLayer.id),
                      onHover: setHoveredBlockId,
                    })}
              </React.Fragment>
            );
          })}

          {/* 3. Lower Branch: Spatial Tile Pointer Pathway */}
          {(() => {
            const stemLastX = splitX - stepX;
            const tileMidX = splitX + 2 * stepX;
            const tileOutX = tileMidX + stepX;
            const globalEndX = splitX + (globalLayers.length - 1) * stepX;
            const headsX = Math.max(globalEndX, tileOutX) + stepX;

            return (
              <>
                {drawFilterCone(
                  stemLastX,
                  stemY,
                  tileMidX,
                  botBranchY,
                  'Skip + Cond (3×3)',
                  'rgba(250, 204, 21, 0.22)',
                  '#facc15'
                )}
                <path
                  d={`M ${globalEndX} ${topBranchY + 25} C ${globalEndX} ${botBranchY - 40}, ${tileMidX} ${topBranchY + 50}, ${tileMidX} ${botBranchY - 35}`}
                  fill="none"
                  stroke="#facc15"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
                {drawCuboid({
                  key: 'head_tile_conv',
                  cx: tileMidX,
                  cy: botBranchY,
                  c: 32,
                  h: 50,
                  w: 50,
                  color: '#d97706',
                  borderColor: '#facc15',
                  topLabel: 'Tile Conv Head',
                  shapeLabel: '32×50×50',
                  subLabel: '3×3 Pointer',
                  isSelected: selectedBlockId === 'head_tile_conv',
                  isHovered: hoveredBlockId === 'head_tile_conv',
                  onClick: () => setSelectedBlockId('head_tile_conv'),
                  onHover: setHoveredBlockId,
                })}
                {drawFilterCone(
                  tileMidX,
                  botBranchY,
                  tileOutX,
                  botBranchY,
                  '1×1 Conv',
                  'rgba(249, 115, 22, 0.25)',
                  '#f97316'
                )}
                {drawCuboid({
                  key: 'out_tile_map',
                  cx: tileOutX,
                  cy: botBranchY,
                  c: 1,
                  h: 50,
                  w: 50,
                  color: '#ea580c',
                  borderColor: '#fde047',
                  topLabel: 'Tile Logits (Out)',
                  shapeLabel: '1×50×50',
                  subLabel: '2,500 Tiles',
                })}

                {drawFilterCone(
                  globalEndX,
                  topBranchY,
                  headsX,
                  topBranchY,
                  'MLP 128d',
                  'rgba(56, 189, 248, 0.22)',
                  '#38bdf8'
                )}
                <g transform={`translate(${headsX - 36}, ${topBranchY - 76})`}>
                  <rect
                    width={126}
                    height={32}
                    rx={6}
                    fill="#1e293b"
                    stroke="#facc15"
                    strokeWidth={1.5}
                  />
                  <text x={63} y={14} textAnchor="middle" fill="#fde047" fontSize={9.2} fontWeight={800}>
                    Action Type (7)
                  </text>
                  <text x={63} y={25} textAnchor="middle" fill="#cbd5e1" fontSize={8.2}>
                    NoOp / Troop / Spell...
                  </text>

                  <rect
                    y={38}
                    width={126}
                    height={32}
                    rx={6}
                    fill="#1e293b"
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                  />
                  <text x={63} y={52} textAnchor="middle" fill="#38bdf8" fontSize={9.2} fontWeight={800}>
                    Slot Index (10)
                  </text>
                  <text x={63} y={63} textAnchor="middle" fill="#cbd5e1" fontSize={8.2}>
                    Conditioned on Type
                  </text>

                  <rect
                    y={76}
                    width={126}
                    height={32}
                    rx={6}
                    fill="#1e293b"
                    stroke="#c084fc"
                    strokeWidth={1.5}
                  />
                  <text x={63} y={90} textAnchor="middle" fill="#c084fc" fontSize={9.2} fontWeight={800}>
                    Deploy Frac α∈[0,1] ({numFracBins})
                  </text>
                  <text x={63} y={101} textAnchor="middle" fill="#cbd5e1" fontSize={8.2}>
                    1 unit / 25% / 50% / 75% / All
                  </text>

                  <rect
                    y={114}
                    width={126}
                    height={32}
                    rx={6}
                    fill="#1e293b"
                    stroke="#4ade80"
                    strokeWidth={1.5}
                  />
                  <text x={63} y={128} textAnchor="middle" fill="#4ade80" fontSize={9.2} fontWeight={800}>
                    Critic Value V(s) (1)
                  </text>
                  <text x={63} y={139} textAnchor="middle" fill="#cbd5e1" fontSize={8.2}>
                    Expected Return
                  </text>
                </g>
              </>
            );
          })()}
        </svg>

        {hoveredSummary && (
          <div className="arch-hover-tooltip">
            <strong>
              {hoveredSummary.id.toUpperCase()} • {hoveredSummary.type}
            </strong>
            <span>{hoveredSummary.desc}</span>
            <span>
              Shape: {hoveredSummary.inputShape.join('×')} →{' '}
              <b>{hoveredSummary.outputShape.join('×')}</b> • RF:{' '}
              {hoveredSummary.receptiveField}×{hoveredSummary.receptiveField} •{' '}
              {hoveredSummary.params.toLocaleString()} params
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="ai-arch-studio-card">
      <div className="ai-arch-header">
        <div className="ai-arch-title-row">
          <h3>🧬 CoCActorCritic Neural Architecture (`python/coc_rl/networks.py`)</h3>
        </div>

        <div className="ai-arch-kpi-pills">
          <div className="arch-pill">
            <span>Input Tensor</span>
            <strong>{inChannels}×50×50</strong>
          </div>
          <div className="arch-pill">
            <span>Spatial Map</span>
            <strong>{spatialDim}×50×50 (RF 11×11)</strong>
          </div>
          <div className="arch-pill">
            <span>Global Emb</span>
            <strong>{embedDim}D</strong>
          </div>
          <div className="arch-pill">
            <span>Parameters</span>
            <strong style={{ color: '#facc15' }}>
              {totalParams.toLocaleString()}
            </strong>
          </div>
          <div className="arch-pill">
            <span>Compute / Size</span>
            <strong>
              {(totalMacs / 1e6).toFixed(1)}M MACs • {estimatedVramMb} MB
            </strong>
          </div>
          <button
            type="button"
            className="speed-pill-btn"
            onClick={() => void syncArchitectureFromServer(true)}
            title="Re-inspect python/coc_rl/networks.py and regenerate architecture diagrams"
          >
            {isRefreshing ? '⟳ Syncing...' : '↻ Sync Model'}
          </button>
          <button
            type="button"
            className="speed-pill-btn"
            onClick={() => setIsCollapsed((c) => !c)}
          >
            {isCollapsed ? '▼ Expand Architecture' : '▲ Collapse'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="arch-viz-toolbar">
            <div className="arch-viz-tabs">
              <button
                type="button"
                className={`speed-pill-btn ${vizMode === 'cnn3d' ? 'active' : ''}`}
                onClick={() => setVizMode('cnn3d')}
              >
                🧊 3D CNN Feature Maps
              </button>
              <button
                type="button"
                className={`speed-pill-btn ${vizMode === 'torchview' ? 'active' : ''}`}
                onClick={() => setVizMode('torchview')}
              >
                🕸️ Torchview Computation Graph
              </button>
            </div>

            <div className="arch-viz-controls">
              {vizMode === 'torchview' && (
                <select
                  className="clash-select mini"
                  value={torchviewDetail}
                  onChange={(e) =>
                    setTorchviewDetail(e.target.value as 'overview' | 'detailed')
                  }
                >
                  <option value="overview">Depth 2 (Overview)</option>
                  <option value="detailed">Depth 3 (Detailed)</option>
                </select>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  className="speed-pill-btn"
                  onClick={() =>
                    setZoom((z) => Math.max(0.6, Math.round((z - 0.15) * 100) / 100))
                  }
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: '#cbd5e1',
                    minWidth: 38,
                    textAlign: 'center',
                  }}
                >
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  className="speed-pill-btn"
                  onClick={() =>
                    setZoom((z) => Math.min(1.8, Math.round((z + 0.15) * 100) / 100))
                  }
                >
                  +
                </button>
                <button
                  type="button"
                  className="speed-pill-btn"
                  onClick={() => setZoom(1.0)}
                >
                  100%
                </button>
              </div>
            </div>
          </div>

          {vizMode === 'cnn3d' && render3DCnnDiagram()}

          {vizMode === 'torchview' && (
            <div className="arch-torchview-stage">
              {serverOnline ? (
                <div
                  className="arch-torchview-svg-wrap"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <img
                    key={`${torchviewDetail}-${liveHash}-${refreshCount}`}
                    src={getArchitectureSvgUrl(
                      torchviewDetail,
                      `${liveHash}-${refreshCount}`,
                      refreshCount > 1
                    )}
                    alt={`CoCActorCritic ${torchviewDetail} computation graph`}
                    style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
                  />
                </div>
              ) : (
                <div className="arch-stage-placeholder">
                  Start the Python AI server (port 8000) to view the Torchview computation graph.
                </div>
              )}
            </div>
          )}

          <div className="arch-summary-split">
            <div className="arch-summary-table-wrap">
              <div className="arch-code-header" style={{ marginBottom: 6 }}>
                <strong>
                  Layer-by-Layer Architecture ({activeLayers.length} Blocks •{' '}
                  {totalParams.toLocaleString()} Params)
                </strong>
                <div className="arch-footer-param-bar-wrap">
                  <div className="ai-stacked-bar" style={{ height: 8, width: 140 }}>
                    <div style={{ width: `${spatialPct}%`, background: '#3b82f6' }} />
                    <div style={{ width: `${globalPct}%`, background: '#10b981' }} />
                    <div style={{ width: `${headPct}%`, background: '#facc15' }} />
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    Stem {spatialPct}% • Tower {globalPct}% • Heads {headPct}%
                  </span>
                </div>
              </div>
              <table className="ai-matrix-table">
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>Stage</th>
                    <th>Configuration</th>
                    <th>Input → Output</th>
                    <th>RF</th>
                    <th>Params</th>
                    <th>MACs</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLayers.map((row) => (
                    <tr
                      key={row.id}
                      style={
                        selectedBlockId === row.id
                          ? { background: 'rgba(250, 204, 21, 0.12)' }
                          : undefined
                      }
                      onClick={() => setSelectedBlockId(row.id)}
                    >
                      <td style={{ fontWeight: 700, color: '#fde047' }}>
                        {row.type}
                      </td>
                      <td>{row.stage}</td>
                      <td
                        style={{
                          textAlign: 'left',
                          color: '#cbd5e1',
                          maxWidth: 260,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={row.desc}
                      >
                        {row.desc}
                      </td>
                      <td>
                        {row.inputShape.join('×')} →{' '}
                        <strong style={{ color: '#38bdf8' }}>
                          {row.outputShape.join('×')}
                        </strong>
                      </td>
                      <td>{row.receptiveField}×{row.receptiveField}</td>
                      <td style={{ color: '#4ade80', fontWeight: 700 }}>
                        {row.params.toLocaleString()}
                      </td>
                      <td>{(row.macs / 1e3).toFixed(1)}K</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="arch-code-pane ai-feedback-pane">
              <div className="arch-code-header ai-feedback-header">
                <div className="ai-feedback-title-group">
                  <strong>🩺 AI Training Health & Diagnostics</strong>
                  {feedbackData?.feedback && (() => {
                    const st =
                      HEALTH_STYLE[feedbackData.feedback.health_status] ??
                      HEALTH_STYLE.plateaued;
                    return (
                      <span
                        className="ai-health-badge"
                        style={{
                          background: st.bg,
                          borderColor: st.border,
                          color: st.text,
                        }}
                      >
                        {st.label} • {feedbackData.feedback.health_score}/100
                      </span>
                    );
                  })()}
                  {feedbackData?.model && (
                    <span className="ai-feedback-meta-tag" title={feedbackData.model}>
                      {feedbackData.provider === 'agy_flash'
                        ? 'gemini-3.8-flash'
                        : 'gemini-4-argon#medium'}
                      {feedbackData.latency_sec
                        ? ` • ${feedbackData.latency_sec}s`
                        : ''}
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
                      onClick={() => void handleSelectFeedbackProvider('opencode_argon')}
                      title="OpenCode CLI: google-vertex/gemini-4-argon#medium"
                    >
                      Argon 4 • OpenCode
                    </button>
                    <button
                      type="button"
                      className={`ai-provider-btn ${
                        feedbackProvider === 'agy_flash' ? 'active' : ''
                      }`}
                      disabled={isAnalyzingFeedback}
                      onClick={() => void handleSelectFeedbackProvider('agy_flash')}
                      title="AGY CLI: gemini-3.8-flash-medium"
                    >
                      Flash 3.8 • AGY
                    </button>
                  </div>

                  <button
                    type="button"
                    className="speed-pill-btn"
                    disabled={!serverOnline || isSyncingTelemetry || isAnalyzingFeedback}
                    onClick={() => void handleSyncTelemetryOnly()}
                    title="Refresh live model probe & telemetry plots without calling LLM"
                  >
                    {isSyncingTelemetry ? '⟳ Syncing...' : '↻ Sync Telemetry'}
                  </button>

                  <button
                    type="button"
                    className="speed-pill-btn active"
                    disabled={!serverOnline || isAnalyzingFeedback}
                    onClick={() => void handleRunFeedbackAnalysis()}
                  >
                    {isAnalyzingFeedback
                      ? `⟳ ${
                          feedbackProvider === 'agy_flash'
                            ? 'AGY Flash...'
                            : 'OpenCode Argon...'
                        }`
                      : '⚡ Diagnose'}
                  </button>
                </div>
              </div>

              {feedbackData?.telemetry && (() => {
                const tel = feedbackData.telemetry;
                const rec50 = tel.windows?.recent_50;
                const hb = tel.live_model_probe?.head_entropy_breakdown;
                const cal = tel.live_model_probe?.critic_calibration;
                const slope = tel.trends?.recent_pct_slope_per_100ep ?? 0;
                return (
                  <div className="ai-feedback-telemetry-strip">
                    <div className="ai-tel-chip">
                      <span>Slope</span>
                      <strong
                        style={{ color: slope >= 0.35 ? '#4ade80' : '#fbbf24' }}
                      >
                        {slope >= 0 ? `+${slope}` : slope}%/100ep
                      </strong>
                    </div>
                    <div className="ai-tel-chip">
                      <span>50-Ep Peak</span>
                      <strong>
                        {tel.trends?.rolling50_peak_pct ?? 0}% (Ep{' '}
                        {tel.trends?.rolling50_peak_at_episode ?? 0})
                      </strong>
                    </div>
                    <div className="ai-tel-chip">
                      <span>2★ TH / 3★</span>
                      <strong style={{ color: '#facc15' }}>
                        {rec50?.two_plus_star_th_rate_pct ?? 0}% /{' '}
                        {rec50?.three_star_triple_rate_pct ?? 0}%
                      </strong>
                    </div>
                    <div className="ai-tel-chip">
                      <span>NoOp / Steps</span>
                      <strong style={{ color: '#38bdf8' }}>
                        {rec50?.mean_noop_pct ?? 0}% / {rec50?.mean_steps ?? 0}st
                      </strong>
                    </div>
                    {hb && (
                      <div className="ai-tel-chip">
                        <span>Head H Sat</span>
                        <strong>
                          Tile {hb.tile_xy.saturation_pct}% • Type{' '}
                          {hb.slot_type.saturation_pct}% • Idx{' '}
                          {hb.slot_idx.saturation_pct}%
                        </strong>
                      </div>
                    )}
                    {cal && (
                      <div className="ai-tel-chip">
                        <span>Critic V(s₀)/R̄</span>
                        <strong>
                          {cal.predicted_v_s0} /{' '}
                          {cal.empirical_recent50_return ?? '—'}
                        </strong>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="ai-feedback-scroll">
                {feedbackData?.error && (
                  <div className="ai-feedback-error">
                    ⚠️ {feedbackData.error}
                  </div>
                )}

                {feedbackData?.feedback ? (
                  <>
                    <div className="ai-feedback-verdict">
                      <div className="ai-verdict-headline">
                        <span
                          className={`ai-prog-pill ${
                            feedbackData.feedback.is_progressing
                              ? 'prog-yes'
                              : 'prog-no'
                          }`}
                        >
                          {feedbackData.feedback.is_progressing
                            ? '✓ Progressing'
                            : '⚠ Not Progressing'}
                        </span>
                        <strong>{feedbackData.feedback.headline}</strong>
                      </div>
                      <p>{feedbackData.feedback.progression_summary}</p>
                    </div>

                    <div className="ai-feedback-section">
                      <div className="ai-feedback-section-title">
                        What Is Going Wrong & Root Causes (
                        {feedbackData.feedback.what_is_going_wrong.length})
                      </div>
                      <div className="ai-feedback-issues-list">
                        {feedbackData.feedback.what_is_going_wrong.map(
                          (item, idx) => {
                            const sev =
                              SEVERITY_STYLE[item.severity] ??
                              SEVERITY_STYLE.warning;
                            return (
                              <div
                                key={idx}
                                className="ai-feedback-issue-card"
                                style={{
                                  borderLeftColor: sev.border,
                                  background: sev.bg,
                                }}
                              >
                                <div className="ai-issue-top">
                                  <span
                                    className="ai-issue-sev"
                                    style={{
                                      color: sev.color,
                                      borderColor: sev.border,
                                    }}
                                  >
                                    {sev.badge}
                                  </span>
                                  <strong>{item.title}</strong>
                                </div>
                                <div className="ai-issue-row">
                                  <span className="ai-issue-tag">Symptom</span>
                                  <span>{item.symptom}</span>
                                </div>
                                <div className="ai-issue-row">
                                  <span className="ai-issue-tag cause">
                                    Cause
                                  </span>
                                  <span>{item.root_cause}</span>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>

                    {feedbackData.feedback.recommendations?.length > 0 && (
                      <div className="ai-feedback-section">
                        <div className="ai-feedback-section-title">
                          Recommended Fixes (
                          {feedbackData.feedback.recommendations.length})
                        </div>
                        <div className="ai-feedback-recs-list">
                          {feedbackData.feedback.recommendations.map(
                            (rec, idx) => (
                              <div key={idx} className="ai-feedback-rec-card">
                                <div className="ai-rec-top">
                                  <span className="ai-rec-target">
                                    {rec.target}
                                  </span>
                                  <strong>{rec.action}</strong>
                                </div>
                                <div className="ai-rec-rationale">
                                  {rec.rationale}
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="arch-stage-placeholder">
                    {isAnalyzingFeedback
                      ? `Gathering live PPO telemetry & querying ${
                          feedbackProvider === 'agy_flash'
                            ? 'Gemini 3.8 Flash via AGY'
                            : 'Gemini 4 Argon (#medium) via OpenCode'
                        }...`
                      : 'Click "⚡ Diagnose" to analyze training health, bottlenecks, and root causes.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 6-PANEL VISUAL TELEMETRY SUITE (PLOTS ALL STATS GIVEN TO AI FEEDBACK MODEL) */}
          {(() => {
            const tel = feedbackData?.telemetry;
            const probe = tel?.live_model_probe;
            const hb = probe?.head_entropy_breakdown;
            const tact = probe?.tactical_rollout_behavior;
            const cal = probe?.critic_calibration;
            const wnorms = probe?.weight_norms_l2 ?? {};
            const initProbs = probe?.initial_step_probs;
            const trends = tel?.trends;

            const phasesToPlot = livePhases;
            const winOrder = ['first_50', 'prev_100', 'recent_50', 'recent_10'].filter(
              (k) => liveWindows[k] != null
            );

            const buildSvgPolyline = (
              vals: number[],
              w: number,
              h: number,
              minY: number,
              maxY: number,
              padL = 26,
              padR = 10,
              padY = 14
            ) => {
              if (vals.length === 0) return '';
              const span = Math.max(1e-5, maxY - minY);
              const pw = w - padL - padR;
              const ph = h - padY * 2;
              return vals
                .map((v, idx) => {
                  const x =
                    vals.length === 1
                      ? padL + pw / 2
                      : padL + (idx / (vals.length - 1)) * pw;
                  const norm = Math.max(0, Math.min(1, (v - minY) / span));
                  const y = h - padY - norm * ph;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ');
            };

            const headBars = hb
              ? [
                  {
                    label: 'Slot Type H(type)',
                    sat: hb.slot_type.saturation_pct,
                    raw: `${hb.slot_type.entropy}/${hb.slot_type.max_possible}`,
                    color: '#facc15',
                  },
                  {
                    label: 'Slot Index H(idx)',
                    sat: hb.slot_idx.saturation_pct,
                    raw: `${hb.slot_idx.entropy}/${hb.slot_idx.max_possible}`,
                    color: '#38bdf8',
                  },
                  {
                    label: 'Deploy Frac H(α)',
                    sat: hb.deploy_fraction.saturation_pct,
                    raw: `${hb.deploy_fraction.entropy}/${hb.deploy_fraction.max_possible}`,
                    color: '#c084fc',
                  },
                  {
                    label: 'Tile Pointer H(tile)',
                    sat: hb.tile_xy.saturation_pct,
                    raw: `${hb.tile_xy.entropy}/${hb.tile_xy.max_possible}`,
                    color: '#f97316',
                  },
                  {
                    label: 'Top-5 Tile Mass',
                    sat: hb.tile_xy.top5_tile_prob_mass_pct ?? 0,
                    raw: `σ=${tact?.spatial_deploy_spread_std_tiles ?? 0}t`,
                    color: '#4ade80',
                  },
                ]
              : [];

            const normEntries = Object.entries(wnorms);
            const maxNorm = Math.max(10, ...normEntries.map(([, v]) => v));

            return (
              <div className="ai-telemetry-plots-grid">
                {/* PLOT 1: 5-PHASE PROGRESSION & STAR TIERS */}
                <div className="ai-tel-plot-card">
                  <div className="ai-tel-plot-head">
                    <strong>1. Phase Progression & Star Tiers</strong>
                    <div className="ai-chart-legend">
                      <span>
                        <i className="ai-dot" style={{ background: '#facc15' }} />
                        Mean %
                      </span>
                      <span>
                        <i className="ai-dot" style={{ background: '#38bdf8' }} />
                        1★+
                      </span>
                      <span>
                        <i className="ai-dot" style={{ background: '#f97316' }} />
                        2★+ TH
                      </span>
                      <span>
                        <i className="ai-dot" style={{ background: '#4ade80' }} />
                        3★
                      </span>
                    </div>
                  </div>
                  <svg
                    viewBox="0 0 340 132"
                    className="ai-tel-svg"
                    preserveAspectRatio="none"
                  >
                    {[0, 25, 50, 75, 100].map((pct) => {
                      const y = 132 - 14 - (pct / 100) * (132 - 28);
                      return (
                        <g key={pct}>
                          <line
                            x1={26}
                            y1={y}
                            x2={330}
                            y2={y}
                            stroke="#1e293b"
                            strokeDasharray={pct === 50 ? '3 3' : undefined}
                          />
                          <text x={2} y={y + 3} fill="#64748b" fontSize="8.5">
                            {pct}%
                          </text>
                        </g>
                      );
                    })}
                    {phasesToPlot.length > 0 && (
                      <>
                        <polyline
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.6"
                          strokeDasharray="3 2"
                          points={buildSvgPolyline(
                            phasesToPlot.map((p) => p.one_plus_star_rate_pct),
                            340,
                            132,
                            0,
                            100
                          )}
                        />
                        <polyline
                          fill="none"
                          stroke="#facc15"
                          strokeWidth="2.4"
                          points={buildSvgPolyline(
                            phasesToPlot.map((p) => p.mean_pct),
                            340,
                            132,
                            0,
                            100
                          )}
                        />
                        <polyline
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="2.0"
                          points={buildSvgPolyline(
                            phasesToPlot.map((p) => p.two_plus_star_th_rate_pct),
                            340,
                            132,
                            0,
                            100
                          )}
                        />
                        <polyline
                          fill="none"
                          stroke="#4ade80"
                          strokeWidth="2.0"
                          points={buildSvgPolyline(
                            phasesToPlot.map((p) => p.three_star_triple_rate_pct),
                            340,
                            132,
                            0,
                            100
                          )}
                        />
                        {phasesToPlot.map((p, idx) => {
                          const x =
                            phasesToPlot.length === 1
                              ? 178
                              : 26 + (idx / (phasesToPlot.length - 1)) * 304;
                          return (
                            <text
                              key={p.window}
                              x={x}
                              y={129}
                              textAnchor="middle"
                              fill="#94a3b8"
                              fontSize="8.5"
                            >
                              P{idx + 1} ({p.mean_pct.toFixed(0)}%)
                            </text>
                          );
                        })}
                      </>
                    )}
                  </svg>
                </div>

                {/* PLOT 2: ROLLING WINDOWS & REGRESSION SLOPES */}
                <div className="ai-tel-plot-card">
                  <div className="ai-tel-plot-head">
                    <strong>2. Rolling Windows & Trend Slopes (/100 Ep)</strong>
                    {trends && (
                      <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                        Peak 50-Ep: <b style={{ color: '#facc15' }}>{trends.rolling50_peak_pct}%</b>{' '}
                        (Δ {trends.drawdown_from_rolling50_peak_pct}%)
                      </span>
                    )}
                  </div>
                  <div className="ai-window-bars-list">
                    {winOrder.map((wk) => {
                      const w = liveWindows[wk];
                      return (
                        <div key={wk} className="ai-win-row">
                          <span className="ai-win-name">{w.window}</span>
                          <div className="ai-win-multi-track">
                            <div
                              className="ai-win-fill"
                              style={{
                                width: `${Math.min(100, w.mean_pct)}%`,
                                background: '#facc15',
                              }}
                              title={`Mean Destruction: ${w.mean_pct}%`}
                            />
                            <div
                              className="ai-win-fill-sub"
                              style={{
                                width: `${Math.min(100, w.two_plus_star_th_rate_pct)}%`,
                                background: '#f97316',
                              }}
                              title={`2★+ TH Rate: ${w.two_plus_star_th_rate_pct}%`}
                            />
                          </div>
                          <span className="ai-win-metrics">
                            <b style={{ color: '#fde047' }}>{w.mean_pct.toFixed(1)}%</b> • 2★{' '}
                            <b style={{ color: '#fb923c' }}>{w.two_plus_star_th_rate_pct}%</b> • 3★{' '}
                            <b style={{ color: '#4ade80' }}>{w.three_star_triple_rate_pct}%</b>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {trends && (
                    <div className="ai-slope-pills-row">
                      <span className="ai-slope-chip">
                        Destr:{' '}
                        <b
                          style={{
                            color:
                              (trends.recent_pct_slope_per_100ep ?? 0) >= 0
                                ? '#4ade80'
                                : '#f87171',
                          }}
                        >
                          {(trends.recent_pct_slope_per_100ep ?? 0) >= 0 ? '+' : ''}
                          {trends.recent_pct_slope_per_100ep}%
                        </b>
                      </span>
                      <span className="ai-slope-chip">
                        Rew:{' '}
                        <b
                          style={{
                            color:
                              (trends.recent_reward_slope_per_100ep ?? 0) >= 0
                                ? '#4ade80'
                                : '#f87171',
                          }}
                        >
                          {(trends.recent_reward_slope_per_100ep ?? 0) >= 0 ? '+' : ''}
                          {trends.recent_reward_slope_per_100ep}
                        </b>
                      </span>
                      <span className="ai-slope-chip">
                        H(π): <b>{trends.recent_entropy_slope_per_100ep}</b>
                      </span>
                      <span className="ai-slope-chip">
                        V-Loss: <b>{trends.recent_value_loss_slope_per_100ep}</b>
                      </span>
                      <span className="ai-slope-chip">
                        NoOp: <b>{trends.recent_noop_slope_per_100ep}%</b>
                      </span>
                    </div>
                  )}
                </div>

                {/* PLOT 3: FACTORIZED HEAD ENTROPY SATURATION & SPATIAL FOCUS */}
                <div className="ai-tel-plot-card">
                  <div className="ai-tel-plot-head">
                    <strong>3. Factorized Head Entropy Saturation</strong>
                    <span style={{ fontSize: '0.67rem', color: '#4ade80' }}>
                      Target Band: 25%–78%
                    </span>
                  </div>
                  <div className="ai-head-bars-list">
                    {headBars.map((hbItem) => (
                      <div key={hbItem.label} className="ai-head-bar-row">
                        <span className="ai-head-lbl">{hbItem.label}</span>
                        <div className="ai-head-track">
                          <div className="ai-head-target-zone" />
                          <div
                            className="ai-head-fill"
                            style={{
                              width: `${Math.min(100, Math.max(2, hbItem.sat))}%`,
                              background: hbItem.color,
                            }}
                          />
                        </div>
                        <span className="ai-head-val">
                          <b>{hbItem.sat.toFixed(1)}%</b>{' '}
                          <small style={{ color: '#64748b' }}>({hbItem.raw})</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PLOT 4: TACTICAL COMBAT TIMELINE GANTT & STEP-0 PRIORS */}
                <div className="ai-tel-plot-card">
                  <div className="ai-tel-plot-head">
                    <strong>4. Tactical Action Timing (Ticks) & Priors</strong>
                    {tact && (
                      <span style={{ fontSize: '0.67rem', color: '#94a3b8' }}>
                        Probe: <b style={{ color: '#fde047' }}>{tact.probe_destruction_pct}% ({tact.probe_stars}★)</b> •{' '}
                        {tact.probe_steps_before_exhaustion}st
                      </span>
                    )}
                  </div>
                  {tact && (() => {
                    const maxTick = Math.max(
                      320,
                      tact.troop_deploy_tick_span[1] + 20,
                      tact.spell_cast_tick_span[1] + 20,
                      tact.hero_ability_tick_span[1] + 20
                    );
                    const ganttRows = [
                      {
                        label: 'Troop Waves',
                        span: tact.troop_deploy_tick_span,
                        color: '#facc15',
                      },
                      {
                        label: 'Spell Casts',
                        span: tact.spell_cast_tick_span,
                        color: '#c084fc',
                      },
                      {
                        label: 'Hero Abilities',
                        span: tact.hero_ability_tick_span,
                        color: '#4ade80',
                      },
                    ];
                    return (
                      <div className="ai-gantt-list">
                        {ganttRows.map((gr) => {
                          const leftPct = Math.min(
                            92,
                            Math.round((gr.span[0] / maxTick) * 100)
                          );
                          const widthPct = Math.max(
                            6,
                            Math.min(
                              100 - leftPct,
                              Math.round(((gr.span[1] - gr.span[0]) / maxTick) * 100)
                            )
                          );
                          return (
                            <div key={gr.label} className="ai-gantt-row">
                              <span className="ai-gantt-lbl">{gr.label}</span>
                              <div className="ai-gantt-track">
                                <div
                                  className="ai-gantt-bar"
                                  style={{
                                    left: `${leftPct}%`,
                                    width: `${widthPct}%`,
                                    background: gr.color,
                                  }}
                                />
                              </div>
                              <span className="ai-gantt-val">
                                t={gr.span[0]}..{gr.span[1]} (
                                {(gr.span[0] / 10).toFixed(1)}–
                                {(gr.span[1] / 10).toFixed(1)}s)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {initProbs?.deploy_fraction_probs && (
                    <div className="ai-frac-mini-strip">
                      <span style={{ color: '#94a3b8', fontSize: '0.66rem' }}>
                        Wave Frac π(α):
                      </span>
                      {['1u', '25%', '50%', '75%', '100%'].map((lbl, i) => {
                        const p = Math.round(
                          (initProbs.deploy_fraction_probs[i] ?? 0) * 100
                        );
                        return (
                          <span key={lbl} className="ai-frac-pill">
                            {lbl}: <b style={{ color: '#e9d5ff' }}>{p}%</b>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* PLOT 5: CRITIC CALIBRATION V(s0) vs R & VALUE LOSS / KL */}
                <div className="ai-tel-plot-card">
                  <div className="ai-tel-plot-head">
                    <strong>5. Critic Calibration V(s₀) & Value Loss / KL</strong>
                    {cal && (
                      <span style={{ fontSize: '0.67rem', color: '#38bdf8' }}>
                        V(s₀)={cal.predicted_v_s0} vs R̄={cal.empirical_recent50_return ?? '—'} (Δ{' '}
                        {cal.calibration_gap_v0_minus_return ?? 0})
                      </span>
                    )}
                  </div>
                  {cal && (() => {
                    const maxCal = Math.max(
                      80,
                      cal.pred_value_max,
                      cal.empirical_recent50_return ?? 0
                    );
                    const v0Pct = Math.min(
                      100,
                      Math.max(2, (cal.predicted_v_s0 / maxCal) * 100)
                    );
                    const empPct = Math.min(
                      100,
                      Math.max(2, ((cal.empirical_recent50_return ?? 0) / maxCal) * 100)
                    );
                    return (
                      <div className="ai-cal-bars">
                        <div className="ai-gantt-row">
                          <span className="ai-gantt-lbl">Critic V(s₀)</span>
                          <div className="ai-gantt-track">
                            <div
                              className="ai-head-fill"
                              style={{ width: `${v0Pct}%`, background: '#38bdf8' }}
                            />
                          </div>
                          <span className="ai-gantt-val">
                            <b>{cal.predicted_v_s0}</b> [{cal.pred_value_min}..{cal.pred_value_max}]
                          </span>
                        </div>
                        <div className="ai-gantt-row">
                          <span className="ai-gantt-lbl">Empirical R̄₅₀</span>
                          <div className="ai-gantt-track">
                            <div
                              className="ai-head-fill"
                              style={{ width: `${empPct}%`, background: '#4ade80' }}
                            />
                          </div>
                          <span className="ai-gantt-val">
                            <b>{cal.empirical_recent50_return ?? '—'}</b>
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                  <svg
                    viewBox="0 0 340 72"
                    className="ai-tel-svg"
                    style={{ height: 72 }}
                    preserveAspectRatio="none"
                  >
                    {phasesToPlot.length > 0 && (() => {
                      const vls = phasesToPlot.map((p) => p.mean_value_loss);
                      const kls = phasesToPlot.map((p) => p.mean_approx_kl * 1000);
                      const maxVl = Math.max(10, ...vls);
                      return (
                        <>
                          <polyline
                            fill="none"
                            stroke="#f87171"
                            strokeWidth="2.0"
                            points={buildSvgPolyline(vls, 340, 72, 0, maxVl, 10, 10, 8)}
                          />
                          <polyline
                            fill="none"
                            stroke="#c084fc"
                            strokeWidth="1.8"
                            strokeDasharray="3 2"
                            points={buildSvgPolyline(kls, 340, 72, 0, 35, 10, 10, 8)}
                          />
                          <text x={12} y={14} fill="#f87171" fontSize="8.5">
                            V-Loss ({vls[vls.length - 1]?.toFixed(1)})
                          </text>
                          <text x={240} y={14} fill="#c084fc" fontSize="8.5">
                            KL ({phasesToPlot[phasesToPlot.length - 1]?.mean_approx_kl})
                          </text>
                        </>
                      );
                    })()}
                  </svg>
                </div>

                {/* PLOT 6: PER-MODULE PARAMETER L2 WEIGHT NORMS */}
                <div className="ai-tel-plot-card">
                  <div className="ai-tel-plot-head">
                    <strong>6. Module Parameter L2 Weight Norms</strong>
                    <span
                      style={{
                        fontSize: '0.67rem',
                        color: probe?.has_nan_or_inf_weights ? '#f87171' : '#4ade80',
                      }}
                    >
                      {probe?.has_nan_or_inf_weights ? '⚠ NaN/Inf Detected' : '✓ Finite Weights'}
                    </span>
                  </div>
                  <div className="ai-wnorm-grid">
                    {normEntries.map(([modName, normVal]) => (
                      <div key={modName} className="ai-wnorm-row">
                        <span className="ai-wnorm-lbl">
                          {modName.replace(/_head$/, '').replace(/_/g, ' ')}
                        </span>
                        <div className="ai-wnorm-track">
                          <div
                            className="ai-head-fill"
                            style={{
                              width: `${Math.min(100, (normVal / maxNorm) * 100)}%`,
                              background: modName.includes('head')
                                ? '#facc15'
                                : '#38bdf8',
                            }}
                          />
                        </div>
                        <span className="ai-wnorm-val">{normVal.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </section>
  );
};

