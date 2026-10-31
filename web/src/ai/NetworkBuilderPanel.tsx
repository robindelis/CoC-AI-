import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchArchitectureSpec,
  getArchitectureSvgUrl,
} from './aiClient';
import {
  AIArchitectureLayerSpec,
  AIArchitectureSpec,
} from './aiTypes';

export type HeadFilterId =
  | 'all'
  | 'split_all'
  | 'head_slot_type'
  | 'head_slot_idx'
  | 'head_deploy_fraction'
  | 'head_tile_conv'
  | 'head_critic';

interface HeadMetaSpec {
  id: Exclude<HeadFilterId, 'all' | 'split_all'>;
  index: number;
  title: string;
  shortTitle: string;
  moduleName: string;
  color: string;
  border: string;
  outputDim: string;
  params: number;
  backboneParams: number;
  formula: string;
}

const HEAD_META: HeadMetaSpec[] = [
  {
    id: 'head_slot_type',
    index: 1,
    title: 'Head 1 Sub-Network • Action Type Policy (slot_type_head)',
    shortTitle: 'H1: Action Type (7)',
    moduleName: 'U-Net Stage 1 + Up3 (12×12) + global_tower + army_ctx + slot_type_head',
    color: '#ca8a04',
    border: '#facc15',
    outputDim: '7 Action Types',
    params: 1799,
    backboneParams: 2121024,
    formula: 'π(type | s) = Categorical(1.4 · tanh(Linear_256→7(GlobalTower(Up3_12×12) ⊕ g_army) / 3) + M_type)',
  },
  {
    id: 'head_slot_idx',
    index: 2,
    title: 'Head 2 Sub-Network • Autoregressive Loadout Slot Index (slot_idx_head)',
    shortTitle: 'H2: Slot Index (10)',
    moduleName: 'U-Net Stage 1 + Up3 (12×12) + global_tower + army_ctx + H1 + slot_idx_head',
    color: '#0284c7',
    border: '#38bdf8',
    outputDim: '10 Loadout Slots',
    params: 35082,
    backboneParams: 2122823,
    formula: 'π(idx | s, type) = Categorical(1.6 · tanh(MLP_263→128→10([g_emb ‖ 1hot(type)]) / 3) + M_idx[type])',
  },
  {
    id: 'head_deploy_fraction',
    index: 3,
    title: 'Head 3 Sub-Network • Autoregressive Troop Wave Fraction (deploy_fraction_head)',
    shortTitle: 'H3: Deploy Frac (5)',
    moduleName: 'U-Net Stage 1 + Up3 (12×12) + global_tower + army_ctx + H1 + H2 + deploy_fraction_head',
    color: '#9333ea',
    border: '#c084fc',
    outputDim: '5 Wave Bins α∈[0,1]',
    params: 35717,
    backboneParams: 2157905,
    formula: 'π(α | s, type, idx) = Categorical(1.4 · tanh(MLP_273→128→5([g_emb ‖ 1hot(type) ‖ 1hot(idx)]) / 3))',
  },
  {
    id: 'head_tile_conv',
    index: 4,
    title: 'Head 4 Sub-Network • Full U-Net 50×50 Spatial Tile Segmentation (up2 + up1 + tile_conv_head)',
    shortTitle: 'H4: U-Net 50×50 Tile (2500)',
    moduleName: 'U-Net Stage 1 + Up3(12×12) + Up2(25×25+Skip2) + Up1(50×50+Skip1) + FiLM + tile_conv_head',
    color: '#d97706',
    border: '#facc15',
    outputDim: '1×50×50 (2,500 Tiles)',
    params: 249729,
    backboneParams: 2157905,
    formula: 'π(x,y | s, type, idx) = Categorical(2.2 · Conv1×1(SiLU(Conv3×3(FiLM(Up1_50×50, c_273→32)))) + Prior_50×50 + M_tile)',
  },
  {
    id: 'head_critic',
    index: 5,
    title: 'Head 5 Sub-Network • State-Value Critic V(s) (critic_head)',
    shortTitle: 'H5: Value Critic (1)',
    moduleName: 'U-Net Stage 1 + Up3 (12×12) + global_tower + army_ctx + critic_head',
    color: '#16a34a',
    border: '#4ade80',
    outputDim: 'Scalar V(s) ∈ ℝ',
    params: 33025,
    backboneParams: 2121024,
    formula: 'V(s) = Linear_128→1(SiLU(Linear_256→128(GlobalTower(Up3_12×12) ⊕ g_army(army_context))))',
  },
];

const DEFAULT_LAYERS: AIArchitectureLayerSpec[] = [
  {
    id: 's1',
    stage: 'spatial',
    type: 'U-Net Down 1: enc1 (2× Conv3×3-GN8-SiLU)',
    short: 'Enc1 50×50',
    desc: '2×(Conv 3×3 → GroupNorm(8) → SiLU), 59→32 ch at 50×50 + Skip 1',
    inputShape: [59, 50, 50],
    outputShape: [32, 50, 50],
    receptiveField: 5,
    params: 26336,
    macs: 65520000,
    color: '#2563eb',
    border: '#60a5fa',
    coneLabel: '2×3×3 GN8',
  },
  {
    id: 's2',
    stage: 'spatial',
    type: 'U-Net Down 2: MaxPool 2×2 + enc2',
    short: 'Enc2 25×25',
    desc: 'MaxPool2d(2×2) + 2×(Conv 3×3 → GroupNorm(8) → SiLU), 32→64 ch at 25×25 + Skip 2',
    inputShape: [32, 50, 50],
    outputShape: [64, 25, 25],
    receptiveField: 14,
    params: 55552,
    macs: 34560000,
    color: '#2563eb',
    border: '#60a5fa',
    coneLabel: 'Pool2 + 2×3×3',
  },
  {
    id: 's3',
    stage: 'spatial',
    type: 'U-Net Down 3: MaxPool 2×2 + enc3',
    short: 'Enc3 12×12',
    desc: 'MaxPool2d(2×2) + 2×(Conv 3×3 → GroupNorm(8) → SiLU), 64→128 ch at 12×12 + Skip 3',
    inputShape: [64, 25, 25],
    outputShape: [128, 12, 12],
    receptiveField: 32,
    params: 221696,
    macs: 31850496,
    color: '#1d4ed8',
    border: '#60a5fa',
    coneLabel: 'Pool2 + 2×3×3',
  },
  {
    id: 's4',
    stage: 'spatial',
    type: 'U-Net Bottleneck: MaxPool 2×2 + bottleneck',
    short: 'Bot 6×6',
    desc: 'MaxPool2d(2×2) + 2×(Conv 3×3 → GroupNorm(8) → SiLU), 128→256 ch at 6×6',
    inputShape: [128, 12, 12],
    outputShape: [256, 6, 6],
    receptiveField: 50,
    params: 885760,
    macs: 31850496,
    color: '#7c3aed',
    border: '#a78bfa',
    coneLabel: 'Pool2 + 2×3×3',
  },
  {
    id: 'g1',
    stage: 'global',
    type: 'Stage 2 Partial Upscale: up3 (6×6 → 12×12 + Skip 3)',
    short: 'Up3 12×12',
    desc: 'ConvTranspose 3×3 (256→128, s=2) + Skip 3 (128×12×12) → 2×Conv 3×3 (128×12×12)',
    inputShape: [256, 6, 6],
    outputShape: [128, 12, 12],
    receptiveField: 50,
    params: 738048,
    macs: 106168320,
    color: '#ea580c',
    border: '#fb923c',
    coneLabel: 'UpConv 3×3 + Skip3',
    hasSkipArc: true,
  },
  {
    id: 'g2',
    stage: 'global',
    type: 'Global Tower Strided Conv2d + GN8 + SiLU',
    short: 'GT Conv 6×6',
    desc: '128 filters, 3×3, stride=2, pad=1, GroupNorm(8), SiLU (from Stage 2 Up3 12×12)',
    inputShape: [128, 12, 12],
    outputShape: [128, 6, 6],
    receptiveField: 50,
    params: 147712,
    macs: 5308416,
    color: '#2563eb',
    border: '#60a5fa',
    coneLabel: '3×3 s=2',
  },
  {
    id: 'g3',
    stage: 'global',
    type: 'AdaptiveAvgPool2d',
    short: 'AdapPool',
    desc: 'Global Average Pool 1×1',
    inputShape: [128, 6, 6],
    outputShape: [128, 1, 1],
    receptiveField: 50,
    params: 0,
    macs: 0,
    color: '#d97706',
    border: '#fbbf24',
    coneLabel: 'Pool 1×1',
  },
  {
    id: 'g4',
    stage: 'global',
    type: 'Flatten',
    short: 'Flatten',
    desc: 'Flatten 128×1×1 → 128',
    inputShape: [128, 1, 1],
    outputShape: [128],
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
    short: 'GlobalTower',
    desc: 'Linear(128 → 256) + LayerNorm(256) + SiLU',
    inputShape: [128],
    outputShape: [256],
    receptiveField: 50,
    params: 33536,
    macs: 32768,
    color: '#059669',
    border: '#34d399',
    coneLabel: 'Dense',
  },
  {
    id: 'head_army_ctx',
    stage: 'global',
    type: 'army_context_proj (Fusion)',
    short: 'ArmyCtx',
    desc: 'army_context(64) → Linear(64 → 256) + LayerNorm(256) + SiLU ⊕ global_emb',
    inputShape: [64],
    outputShape: [256],
    receptiveField: 50,
    params: 17152,
    macs: 16384,
    color: '#0891b2',
    border: '#38bdf8',
    coneLabel: '64→256 ⊕',
  },
  {
    id: 'head_slot_type',
    stage: 'heads',
    type: 'slot_type_head (Head 1)',
    short: 'TypeHead',
    desc: 'Linear(256 → 7) + 1.4·tanh(z/3) + slot_type mask',
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
    type: 'slot_idx_head (Head 2)',
    short: 'IdxHead',
    desc: 'cat[global_emb(256), one_hot(type)(7)] → MLP(263 → 128 → 10) + 1.6·tanh(z/3) + slot_idx mask',
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
    type: 'deploy_fraction_head (Head 3)',
    short: 'FracHead',
    desc: 'cat[global_emb(256), one_hot(type)(7), one_hot(idx)(10)] → MLP(273 → 128 → 5)',
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
    type: 'U-Net Full 50×50 Upscale (up2 + up1) + Tile Head (Head 4)',
    short: 'UNet50×50',
    desc: 'up2(12×12→25×25 + Skip2) → up1(25×25→50×50 + Skip1) → FiLM(273→32) → Conv 3×3 + 1×1 (1×50×50)',
    inputShape: [128, 12, 12],
    outputShape: [1, 50, 50],
    receptiveField: 50,
    params: 249729,
    macs: 253520000,
    color: '#d97706',
    border: '#facc15',
  },
  {
    id: 'head_critic',
    stage: 'heads',
    type: 'critic_head (Head 5)',
    short: 'Critic',
    desc: 'MLP(256 → 128 → 1 Value V(s), SiLU, 2.5× Actor LR)',
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
}

export const NetworkBuilderPanel: React.FC<NetworkBuilderPanelProps> = ({
  serverOnline,
  architectureSpec,
  architectureHash,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [vizMode, setVizMode] = useState<'schematic' | 'torchview'>('schematic');
  const [headFilter, setHeadFilter] = useState<HeadFilterId>('all');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>('head_army_ctx');
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [torchviewDetail, setTorchviewDetail] = useState<'overview' | 'detailed'>('overview');
  const [showLayerTable, setShowLayerTable] = useState<boolean>(false);
  const [liveSpec, setLiveSpec] = useState<AIArchitectureSpec | null>(architectureSpec ?? null);
  const [liveHash, setLiveHash] = useState<string>(architectureHash ?? String(Date.now()));
  const [refreshCount, setRefreshCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

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

  useEffect(() => {
    void syncArchitectureFromServer(false);
  }, [syncArchitectureFromServer]);

  useEffect(() => {
    if (architectureSpec) setLiveSpec(architectureSpec);
    if (architectureHash) setLiveHash(architectureHash);
  }, [architectureSpec, architectureHash]);

  const activeLayers =
    liveSpec?.layers && liveSpec.layers.length >= 15
      ? liveSpec.layers
      : DEFAULT_LAYERS;
  const inChannels = liveSpec?.in_channels ?? 59;
  const armyContextDim = liveSpec?.army_context_dim ?? 64;
  const spatialDim = liveSpec?.spatial_dim ?? 128;
  const embedDim = liveSpec?.embed_dim ?? 256;
  const numFracBins = liveSpec?.num_fraction_bins ?? 5;
  const totalParams =
    liveSpec?.total_params ?? activeLayers.reduce((acc, l) => acc + l.params, 0);
  const totalMacs =
    liveSpec?.total_macs ?? activeLayers.reduce((acc, l) => acc + l.macs, 0);

  const spatialLayers = activeLayers.filter((l) => l.stage === 'spatial');
  const globalTowerLayers = activeLayers.filter(
    (l) => l.stage === 'global' && l.id !== 'head_army_ctx'
  );
  const armyCtxLayer =
    activeLayers.find((l) => l.id === 'head_army_ctx') ??
    DEFAULT_LAYERS.find((l) => l.id === 'head_army_ctx')!;
  const hoveredSummary = activeLayers.find((l) => l.id === hoveredBlockId) ?? null;

  // =========================================================================
  // SHARED 3D ISOMETRIC VOLUMETRIC PRIMITIVES (CUBOIDS, BARS, STACKED BARS, CONES)
  // =========================================================================
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
    scale?: number;
    isSelected?: boolean;
    isHovered?: boolean;
    hasSkipArc?: boolean;
    onClick?: () => void;
    onHover?: (id: string | null) => void;
  }) => {
    const sc = opts.scale ?? 1.0;
    const sideH = Math.round(Math.max(22, Math.min(82, 18 + (opts.h / 50) * 64)) * sc);
    const depth = Math.round(
      Math.max(10, Math.min(40, Math.round(Math.log2(Math.max(2, opts.c)) * 5.2))) * sc
    );
    const dx = Math.round(depth * 0.68);
    const dy = Math.round(depth * 0.38);

    const x0 = opts.cx - depth / 2;
    const y0 = opts.cy - sideH / 2;

    const frontPts = `${x0},${y0} ${x0 + depth},${y0} ${x0 + depth},${y0 + sideH} ${x0},${y0 + sideH}`;
    const topPts = `${x0},${y0} ${x0 + dx},${y0 - dy} ${x0 + depth + dx},${y0 - dy} ${x0 + depth},${y0}`;
    const rightPts = `${x0 + depth},${y0} ${x0 + depth + dx},${y0 - dy} ${x0 + depth + dx},${y0 + sideH - dy} ${x0 + depth},${y0 + sideH}`;

    const sliceCount = Math.min(5, Math.max(2, Math.floor(opts.c / 24)));
    const slices = Array.from({ length: sliceCount - 1 }, (_, i) => {
      const frac = (i + 1) / sliceCount;
      const sx = x0 + frac * depth;
      return (
        <g key={i} opacity={0.32}>
          <line x1={sx} y1={y0} x2={sx} y2={y0 + sideH} stroke="#0f172a" strokeWidth={1} />
          <line x1={sx} y1={y0} x2={sx + dx} y2={y0 - dy} stroke="#0f172a" strokeWidth={1} />
        </g>
      );
    });

    const strokeW = opts.isSelected ? 2.4 : opts.isHovered ? 2.0 : 1.25;
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
              d={`M ${x0 - 20} ${y0 - 4} Q ${opts.cx + dx / 2} ${y0 - dy - 24} ${
                x0 + depth + dx + 6
              } ${y0 - 4}`}
              fill="none"
              stroke="#facc15"
              strokeWidth={1.8}
              strokeDasharray="4 2"
            />
            <circle
              cx={x0 + depth + dx + 6}
              cy={y0 - 4}
              r={6}
              fill="#0f172a"
              stroke="#facc15"
              strokeWidth={1.4}
            />
            <text
              x={x0 + depth + dx + 6}
              y={y0 - 1}
              textAnchor="middle"
              fill="#facc15"
              fontSize={9}
              fontWeight={800}
            >
              +
            </text>
          </g>
        )}

        <polygon points={topPts} fill={opts.color} fillOpacity={0.88} stroke={strokeCol} strokeWidth={strokeW} />
        <polygon points={rightPts} fill={opts.color} fillOpacity={0.55} stroke={strokeCol} strokeWidth={strokeW} />
        <polygon points={frontPts} fill={opts.color} fillOpacity={0.76} stroke={strokeCol} strokeWidth={strokeW} />
        {slices}

        <text
          x={opts.cx + dx / 2}
          y={y0 - dy - 7}
          textAnchor="middle"
          fill={opts.isSelected ? '#fde047' : '#f8fafc'}
          fontSize={9.3}
          fontWeight={700}
        >
          {opts.topLabel}
        </text>
        <text
          x={opts.cx + dx / 2}
          y={y0 + sideH + 12}
          textAnchor="middle"
          fill="#fde047"
          fontSize={9.0}
          fontWeight={700}
        >
          {opts.shapeLabel}
        </text>
        <text
          x={opts.cx + dx / 2}
          y={y0 + sideH + 22}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={8.1}
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
    dimLabel?: string;
    dimColor?: string;
    scale?: number;
    segments?: Array<{ color: string; frac: number; label?: string }>;
    isSelected?: boolean;
    isHovered?: boolean;
    onClick?: () => void;
    onHover?: (id: string | null) => void;
  }) => {
    const sc = opts.scale ?? 1.0;
    const barH = Math.round(
      Math.max(26, Math.min(76, Math.round(Math.log2(Math.max(2, opts.dim)) * 7.4))) * sc
    );
    const barW = Math.round(17 * sc);
    const dx = Math.round(7 * sc);
    const dy = Math.round(5 * sc);
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
          fill={opts.segments?.[0]?.color ?? opts.color}
          fillOpacity={0.92}
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
        {opts.segments && opts.segments.length > 1 ? (
          (() => {
            let curY = y0;
            return opts.segments.map((seg, sIdx) => {
              const segH = Math.max(4, Math.round(barH * seg.frac));
              const rectEl = (
                <rect
                  key={sIdx}
                  x={x0}
                  y={curY}
                  width={barW}
                  height={
                    sIdx === opts.segments!.length - 1
                      ? Math.max(4, y0 + barH - curY)
                      : segH
                  }
                  fill={seg.color}
                  fillOpacity={0.85}
                  stroke={strokeCol}
                  strokeWidth={0.9}
                />
              );
              curY += segH;
              return rectEl;
            });
          })()
        ) : (
          <rect
            x={x0}
            y={y0}
            width={barW}
            height={barH}
            fill={opts.color}
            fillOpacity={0.8}
            stroke={strokeCol}
            strokeWidth={opts.isSelected ? 2.2 : 1.2}
          />
        )}
        {[0.25, 0.5, 0.75].map((f, i) => (
          <circle
            key={i}
            cx={x0 + barW / 2}
            cy={y0 + barH * f}
            r={1.9}
            fill="#f8fafc"
            opacity={0.82}
          />
        ))}
        <text
          x={opts.cx + dx / 2}
          y={y0 - dy - 7}
          textAnchor="middle"
          fill={opts.isSelected ? '#fde047' : '#f8fafc'}
          fontSize={9.3}
          fontWeight={700}
        >
          {opts.topLabel}
        </text>
        <text
          x={opts.cx + dx / 2}
          y={y0 + barH + 12}
          textAnchor="middle"
          fill={opts.dimColor ?? '#34d399'}
          fontSize={9.1}
          fontWeight={700}
        >
          {opts.dimLabel ?? `${opts.dim}D`}
        </text>
        <text
          x={opts.cx + dx / 2}
          y={y0 + barH + 22}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={8.0}
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
    color = 'rgba(56, 189, 248, 0.22)',
    stroke = '#38bdf8'
  ) => {
    const patchH = 15;
    return (
      <g key={`cone-${x1}-${y1}-${x2}-${y2}-${label ?? ''}`}>
        <polygon
          points={`${x1 + 11},${y1 - patchH / 2} ${x1 + 11},${y1 + patchH / 2} ${x2 - 11},${y2 + 3} ${x2 - 11},${y2 - 3}`}
          fill={color}
          stroke={stroke}
          strokeWidth={0.95}
          strokeOpacity={0.7}
        />
        {label && (
          <text
            x={(x1 + x2) / 2 + 2}
            y={(y1 + y2) / 2 - 9}
            textAnchor="middle"
            fill="#93c5fd"
            fontSize={8.1}
            fontWeight={600}
          >
            {label}
          </text>
        )}
      </g>
    );
  };

  const drawFusionCircle = (cx: number, cy: number, symbol: string, topText: string, subText: string, border = '#facc15') => (
    <g key={`fusion-${cx}-${cy}-${topText}`} transform={`translate(${cx}, ${cy})`}>
      <circle r={14} fill="#0f172a" stroke={border} strokeWidth={2.0} />
      <text y={4} textAnchor="middle" fill={border} fontSize={12.5} fontWeight={900}>
        {symbol}
      </text>
      <text y={-19} textAnchor="middle" fill="#fde047" fontSize={8.8} fontWeight={800}>
        {topText}
      </text>
      <text y={26} textAnchor="middle" fill="#34d399" fontSize={8.0} fontWeight={700}>
        {subText}
      </text>
    </g>
  );

  // =========================================================================
  // 1. FULL UNIFIED NETWORK DIAGRAM (U-Net Stage 1 Downscale -> Stage 2 Upscale + Global Tower + 50x50 Tile Decoder)
  // =========================================================================
  const renderUnifiedNetworkSvg = () => {
    const stepX = 96;
    const startX = 62;
    const stemY = 126;
    const topBranchY = 92;
    const armyTrackY = 236;
    const botBranchY = 330;

    // U-Net vertical staircase for Stage 1 downscaling (50x50 -> 25x25 -> 12x12 -> 6x6)
    const stage1Y = [126, 152, 178, 204];

    const splitX = startX + (spatialLayers.length + 1) * stepX;
    const globalEndX = splitX + (globalTowerLayers.length - 1) * stepX;
    const fusionX = globalEndX + 86;
    const headsX = fusionX + 118;
    const svgWidth = Math.max(1260, headsX + 185);
    const svgHeight = 430;

    const stemLastX = splitX - stepX;
    const armyProjX = splitX + 2 * stepX;
    const up2X = splitX + 0.9 * stepX;
    const up1X = splitX + 2.05 * stepX;
    const tileFiLMX = splitX + 3.15 * stepX;
    const tileOutX = tileFiLMX + 1.15 * stepX;

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
              <stop offset="0%" stopColor="#080e1c" />
              <stop offset="100%" stopColor="#0c1528" />
            </linearGradient>
          </defs>
          <rect width={svgWidth} height={svgHeight} fill="url(#bgGridGrad)" rx={8} />

          <text x={20} y={20} fill="#60a5fa" fontSize={10} fontWeight={800}>
            STAGE 1 • U-NET DOWNSCALING ENCODER (50×50 → 25×25 → 12×12 → 6×6 Bottleneck)
          </text>
          <text x={splitX - 18} y={20} fill="#34d399" fontSize={10} fontWeight={800}>
            STAGE 2 • UPSCALE TO 12×12 → GLOBAL TOWER (5 HEADS) &amp; FULL U-NET 50×50 UPSCALE (GRID POSITION)
          </text>

          {/* INPUT 1: Spatial Observation Grid obs (59×50×50) */}
          {drawCuboid({
            key: 'input_obs',
            cx: startX,
            cy: stemY,
            c: inChannels,
            h: 50,
            w: 50,
            color: '#0284c7',
            borderColor: '#38bdf8',
            topLabel: 'Input 1: obs',
            shapeLabel: `${inChannels}×50×50`,
            subLabel: 'Village Grid',
          })}

          {/* INPUT 2: Available Army Inventory Vector army_context (64-D) */}
          {drawDenseBar({
            key: 'input_army_ctx',
            cx: startX,
            cy: armyTrackY + 58,
            dim: armyContextDim,
            color: '#0891b2',
            borderColor: '#38bdf8',
            dimColor: '#38bdf8',
            topLabel: 'Input 2: army_context',
            subLabel: 'Avail Troops/Spells/Heroes',
            isSelected: selectedBlockId === 'head_army_ctx',
            onClick: () => setSelectedBlockId('head_army_ctx'),
            onHover: setHoveredBlockId,
          })}

          {/* Stage 1 U-Net Contracting Path Blocks: Enc1 (50x50), Enc2 (25x25), Enc3 (12x12), Bottleneck (6x6) */}
          {spatialLayers.map((sLayer, idx) => {
            const prevX = startX + idx * stepX;
            const prevY = idx === 0 ? stemY : stage1Y[Math.max(0, idx - 1)];
            const curX = startX + (idx + 1) * stepX;
            const curY = stage1Y[Math.min(idx, stage1Y.length - 1)];
            const [c, h, w] = sLayer.outputShape;

            return (
              <React.Fragment key={sLayer.id}>
                {drawFilterCone(prevX, prevY, curX, curY, sLayer.coneLabel)}
                {drawCuboid({
                  key: sLayer.id,
                  cx: curX,
                  cy: curY,
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

          {/* Dashed U-Net Skip Connection 3: Enc3 (128×12×12) -> Up3 (128×12×12) */}
          <path
            d={`M ${startX + 3 * stepX} ${stage1Y[2] - 24} Q ${(startX + 3 * stepX + splitX) / 2} ${topBranchY - 38} ${splitX} ${topBranchY - 22}`}
            fill="none"
            stroke="#fb923c"
            strokeWidth={1.6}
            strokeDasharray="5 3"
          />

          {/* Upper Branch: Stage 2 Up3 (12×12) + Global Tower G2..G5 */}
          {globalTowerLayers.map((gLayer, idx) => {
            const prevX = idx === 0 ? stemLastX : splitX + (idx - 1) * stepX;
            const prevY = idx === 0 ? stage1Y[3] : topBranchY;
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
                  idx === 0 ? 'rgba(249, 115, 22, 0.24)' : 'rgba(16, 185, 129, 0.2)',
                  idx === 0 ? '#fb923c' : '#34d399'
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

          {/* Middle Branch: Available Army Projection (64D -> 256D) & Residual Fusion (⊕) */}
          <path
            d={`M ${startX + 14} ${armyTrackY + 58} L ${armyProjX - 18} ${armyTrackY}`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2}
            strokeDasharray="5 3"
          />
          <text
            x={(startX + armyProjX) / 2 - 20}
            y={armyTrackY + 12}
            textAnchor="middle"
            fill="#38bdf8"
            fontSize={8.8}
            fontWeight={700}
          >
            army_context (B, 64) → Linear(64→256) + LayerNorm + SiLU
          </text>
          {drawDenseBar({
            key: armyCtxLayer.id,
            cx: armyProjX,
            cy: armyTrackY,
            dim: embedDim,
            color: '#0891b2',
            borderColor: '#38bdf8',
            dimColor: '#38bdf8',
            topLabel: 'army_context_proj',
            subLabel: `${(armyCtxLayer.params / 1000).toFixed(1)}K p`,
            isSelected: selectedBlockId === armyCtxLayer.id,
            isHovered: hoveredBlockId === armyCtxLayer.id,
            onClick: () => setSelectedBlockId(armyCtxLayer.id),
            onHover: setHoveredBlockId,
          })}

          {/* Fusion Node: global_emb = global_tower(up3) + army_context_proj(army_context) */}
          <path
            d={`M ${globalEndX + 14} ${topBranchY} L ${fusionX - 16} ${topBranchY + 34}`}
            fill="none"
            stroke="#34d399"
            strokeWidth={2.2}
          />
          <path
            d={`M ${armyProjX + 14} ${armyTrackY} C ${armyProjX + 95} ${armyTrackY}, ${fusionX - 60} ${topBranchY + 34}, ${fusionX - 16} ${topBranchY + 34}`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={2.2}
          />
          {drawFusionCircle(fusionX, topBranchY + 34, '⊕', 'global_emb', '256D Fused State')}

          {/* Lower Branch: Full U-Net Upscaling (12×12 → 25×25 → 50×50) + Skip Connections + FiLM Tile Head */}
          {drawFilterCone(
            splitX,
            topBranchY,
            up2X,
            botBranchY + 12,
            'UpConv 3×3 + Skip2',
            'rgba(249, 115, 22, 0.24)',
            '#fb923c'
          )}
          {/* Dashed Skip 2 from Enc2 (64×25×25) -> Up2 */}
          <path
            d={`M ${startX + 2 * stepX} ${stage1Y[1] + 24} Q ${(startX + 2 * stepX + up2X) / 2} ${botBranchY + 52} ${up2X - 16} ${botBranchY + 18}`}
            fill="none"
            stroke="#fb923c"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          {drawCuboid({
            key: 'unet_up2',
            cx: up2X,
            cy: botBranchY + 12,
            c: 64,
            h: 25,
            w: 25,
            color: '#ea580c',
            borderColor: '#fb923c',
            topLabel: 'Up2: 25×25',
            shapeLabel: '64×25×25',
            subLabel: 'cat[Up(d3), Skip2]',
            isSelected: selectedBlockId === 'head_tile_conv',
            onClick: () => {
              setSelectedBlockId('head_tile_conv');
              setHeadFilter('head_tile_conv');
            },
          })}

          {drawFilterCone(
            up2X,
            botBranchY + 12,
            up1X,
            botBranchY,
            'UpConv 3×3 + Skip1',
            'rgba(249, 115, 22, 0.24)',
            '#fb923c'
          )}
          {/* Dashed Skip 1 from Enc1 (32×50×50) -> Up1 */}
          <path
            d={`M ${startX + stepX} ${stage1Y[0] + 36} Q ${(startX + stepX + up1X) / 2} ${botBranchY + 72} ${up1X - 16} ${botBranchY + 26}`}
            fill="none"
            stroke="#fb923c"
            strokeWidth={1.5}
            strokeDasharray="5 3"
          />
          {drawCuboid({
            key: 'unet_up1',
            cx: up1X,
            cy: botBranchY,
            c: spatialDim,
            h: 50,
            w: 50,
            color: '#2563eb',
            borderColor: '#60a5fa',
            topLabel: 'Up1: Full 50×50',
            shapeLabel: `${spatialDim}×50×50`,
            subLabel: 'cat[Up(d2), Skip1]',
            isSelected: selectedBlockId === 'head_tile_conv',
            onClick: () => {
              setSelectedBlockId('head_tile_conv');
              setHeadFilter('head_tile_conv');
            },
          })}

          <path
            d={`M ${fusionX} ${topBranchY + 50} C ${fusionX - 10} ${botBranchY - 70}, ${tileFiLMX} ${topBranchY + 120}, ${tileFiLMX} ${botBranchY - 42}`}
            fill="none"
            stroke="#facc15"
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          {drawFilterCone(
            up1X,
            botBranchY,
            tileFiLMX,
            botBranchY,
            'FiLM + 3×3',
            'rgba(250, 204, 21, 0.22)',
            '#facc15'
          )}
          {drawCuboid({
            key: 'head_tile_conv',
            cx: tileFiLMX,
            cy: botBranchY,
            c: 32,
            h: 50,
            w: 50,
            color: '#d97706',
            borderColor: '#facc15',
            topLabel: 'FiLM + tile_conv',
            shapeLabel: '32×50×50',
            subLabel: '249.7K U-Net Head',
            isSelected: selectedBlockId === 'head_tile_conv',
            isHovered: hoveredBlockId === 'head_tile_conv',
            onClick: () => {
              setSelectedBlockId('head_tile_conv');
              setHeadFilter('head_tile_conv');
            },
            onHover: setHoveredBlockId,
          })}

          {drawFilterCone(
            tileFiLMX,
            botBranchY,
            tileOutX,
            botBranchY,
            '1×1 + Softmax',
            'rgba(34, 197, 94, 0.28)',
            '#4ade80'
          )}
          {drawCuboid({
            key: 'out_tile_map',
            cx: tileOutX,
            cy: botBranchY,
            c: 1,
            h: 50,
            w: 50,
            color: '#16a34a',
            borderColor: '#fde047',
            topLabel: 'H4: Tile Logits',
            shapeLabel: '1×50×50',
            subLabel: '2,500 Tiles (Masked)',
            onClick: () => setHeadFilter('head_tile_conv'),
          })}

          {/* Right Branch: Autoregressive Discrete & Critic Heads (H1, H2, H3, H5) */}
          {[
            {
              id: 'head_slot_type' as const,
              y: 52,
              title: 'H1: Action Type (7)',
              sub: 'Linear(256→7) • 1.8K p',
              cond: '256D',
              border: '#facc15',
              text: '#fde047',
            },
            {
              id: 'head_slot_idx' as const,
              y: 112,
              title: 'H2: Slot Index (10)',
              sub: 'MLP(263→128→10) • 35.1K p',
              cond: '256 + 1hot(type:7) = 263D',
              border: '#38bdf8',
              text: '#38bdf8',
            },
            {
              id: 'head_deploy_fraction' as const,
              y: 172,
              title: `H3: Deploy Frac (${numFracBins})`,
              sub: `MLP(273→128→${numFracBins}) • 35.7K p`,
              cond: '263 + 1hot(idx:10) = 273D',
              border: '#c084fc',
              text: '#c084fc',
            },
            {
              id: 'head_critic' as const,
              y: 232,
              title: 'H5: Critic Value V(s) (1)',
              sub: 'MLP(256→128→1) • 33.0K p',
              cond: '256D (2.5× Actor LR)',
              border: '#4ade80',
              text: '#4ade80',
            },
          ].map((hItem) => (
            <g
              key={hItem.id}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSelectedBlockId(hItem.id);
                setHeadFilter(hItem.id);
              }}
              onMouseEnter={() => setHoveredBlockId(hItem.id)}
              onMouseLeave={() => setHoveredBlockId(null)}
            >
              <path
                d={`M ${fusionX + 16} ${topBranchY + 34} C ${fusionX + 55} ${topBranchY + 34}, ${headsX - 55} ${hItem.y + 18}, ${headsX - 8} ${hItem.y + 18}`}
                fill="none"
                stroke={hItem.border}
                strokeWidth={1.6}
                strokeOpacity={0.85}
              />
              <rect
                x={headsX - 8}
                y={hItem.y}
                width={176}
                height={44}
                rx={7}
                fill="#111c33"
                stroke={hItem.border}
                strokeWidth={selectedBlockId === hItem.id ? 2.4 : 1.5}
              />
              <text
                x={headsX + 80}
                y={hItem.y + 15}
                textAnchor="middle"
                fill={hItem.text}
                fontSize={9.3}
                fontWeight={800}
              >
                {hItem.title}
              </text>
              <text
                x={headsX + 80}
                y={hItem.y + 27}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize={8.1}
              >
                {hItem.sub}
              </text>
              <text
                x={headsX + 80}
                y={hItem.y + 38}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={7.6}
              >
                In: {hItem.cond}
              </text>
            </g>
          ))}

          <path
            d={`M ${headsX + 168} ${74} Q ${headsX + 182} ${93} ${headsX + 168} ${112}`}
            fill="none"
            stroke="#facc15"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />
          <path
            d={`M ${headsX + 168} ${134} Q ${headsX + 182} ${153} ${headsX + 168} ${172}`}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={1.5}
            strokeDasharray="2 2"
          />
        </svg>

        {hoveredSummary && (
          <div className="arch-hover-tooltip">
            <strong>
              {hoveredSummary.id.toUpperCase()} • {hoveredSummary.type}
            </strong>
            <span>{hoveredSummary.desc}</span>
            <span>
              Shape: {hoveredSummary.inputShape.join('×')} →{' '}
              <b>{hoveredSummary.outputShape.join('×')}</b> •{' '}
              {hoveredSummary.params.toLocaleString()} params
            </span>
          </div>
        )}
      </div>
    );
  };

  // =========================================================================
  // 2. VISUAL 3D VOLUMETRIC SUB-NETWORK RENDERER FOR EACH INDIVIDUAL HEAD
  // =========================================================================
  const renderVisualSubModel3D = (head: HeadMetaSpec, isCompact: boolean) => {
    const startX = 52;
    const stepX = 82;
    const topY = 92;
    const botY = 205;
    const midY = 135;

    const splitX = startX + 5 * stepX; // Col 5
    const g5X = splitX + 4 * stepX; // Col 9
    const armyProjX = splitX + 2 * stepX; // Col 7
    const fusionX = g5X + 68;
    const globalBarX = fusionX + 58;

    const isTileHead = head.id === 'head_tile_conv';
    const svgHeight = isTileHead ? 315 : 265;
    const svgWidth = isTileHead ? 1310 : head.id === 'head_deploy_fraction' ? 1360 : 1280;

    return (
      <div
        key={head.id}
        className={`arch-head-split-card ${headFilter === head.id ? 'focused' : ''}`}
        style={{ borderColor: head.border }}
      >
        <div className="arch-head-card-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span
              className="arch-head-badge"
              style={{ background: head.color, borderColor: head.border }}
            >
              HEAD {head.index}
            </span>
            <strong style={{ color: '#f8fafc', fontSize: '0.88rem' }}>{head.title}</strong>
            <code className="arch-head-mod">{head.moduleName}</code>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="arch-head-stat-pill">
              Head: <b style={{ color: head.border }}>{head.params.toLocaleString()} p</b> • Sub-Model Total:{' '}
              <b>{(head.backboneParams + head.params).toLocaleString()} p</b>
            </span>
            <span className="arch-head-stat-pill" style={{ color: head.border }}>
              Out: <b>{head.outputDim}</b>
            </span>
            {isCompact ? (
              <button
                type="button"
                className="speed-pill-btn"
                onClick={() => setHeadFilter(head.id)}
              >
                ⤢ Focus Head {head.index}
              </button>
            ) : (
              <button
                type="button"
                className="speed-pill-btn"
                onClick={() => setHeadFilter('split_all')}
              >
                ⊞ All 5 Heads
              </button>
            )}
          </div>
        </div>

        <div className="arch-cnn3d-stage" style={{ border: '1px solid #1e2f4d' }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{
              width: isCompact ? '100%' : `${Math.round(svgWidth * zoom)}px`,
              height: 'auto',
              minWidth: '100%',
              display: 'block',
            }}
          >
            <rect width={svgWidth} height={svgHeight} fill="#070d19" rx={8} />

            <text x={18} y={18} fill="#60a5fa" fontSize={9.2} fontWeight={800}>
              SHARED ENCODER PATHWAY • Input 1: obs ({inChannels}×50×50) + Input 2: army_context ({armyContextDim}D)
            </text>
            <text x={fusionX - 10} y={18} fill={head.border} fontSize={9.2} fontWeight={800}>
              HEAD {head.index} VOLUMETRIC PIPELINE • {head.shortTitle.toUpperCase()} ({head.params.toLocaleString()} PARAMS)
            </text>

            {/* 1. Input 1: obs (10×50×50) */}
            {drawCuboid({
              key: `${head.id}_obs`,
              cx: startX,
              cy: topY,
              c: inChannels,
              h: 50,
              w: 50,
              scale: 0.84,
              color: '#0284c7',
              borderColor: '#38bdf8',
              topLabel: 'obs',
              shapeLabel: `${inChannels}×50×50`,
              subLabel: 'Village Grid',
            })}

            {/* 2. Input 2: army_context (64D) */}
            {drawDenseBar({
              key: `${head.id}_army_in`,
              cx: startX,
              cy: botY,
              dim: armyContextDim,
              scale: 0.88,
              color: '#0891b2',
              borderColor: '#38bdf8',
              dimColor: '#38bdf8',
              topLabel: 'army_context',
              subLabel: 'Inventory 64D',
            })}

            {/* 3. Spatial CNN Stem S1..S4 */}
            {spatialLayers.map((sLayer, idx) => {
              const prevX = startX + idx * stepX;
              const curX = startX + (idx + 1) * stepX;
              const [c, h, w] = sLayer.outputShape;
              return (
                <React.Fragment key={`${head.id}_${sLayer.id}`}>
                  {drawFilterCone(prevX, topY, curX, topY, sLayer.coneLabel)}
                  {drawCuboid({
                    key: `${head.id}_${sLayer.id}`,
                    cx: curX,
                    cy: topY,
                    c,
                    h,
                    w,
                    scale: 0.84,
                    color: sLayer.color,
                    borderColor: sLayer.border,
                    topLabel: `S${idx + 1}:${sLayer.short}`,
                    shapeLabel: `${c}×${h}×${w}`,
                    subLabel: `RF ${sLayer.receptiveField}`,
                    hasSkipArc: sLayer.hasSkipArc,
                  })}
                </React.Fragment>
              );
            })}

            {/* 4. Global Tower G1..G5 */}
            {globalTowerLayers.map((gLayer, idx) => {
              const prevX = idx === 0 ? startX + 4 * stepX : splitX + (idx - 1) * stepX;
              const curX = splitX + idx * stepX;
              const is1D = gLayer.outputShape.length === 1;
              return (
                <React.Fragment key={`${head.id}_${gLayer.id}`}>
                  {drawFilterCone(
                    prevX,
                    topY,
                    curX,
                    topY,
                    gLayer.coneLabel,
                    'rgba(16, 185, 129, 0.2)',
                    '#34d399'
                  )}
                  {is1D
                    ? drawDenseBar({
                        key: `${head.id}_${gLayer.id}`,
                        cx: curX,
                        cy: topY,
                        dim: gLayer.outputShape[0],
                        scale: 0.86,
                        color: gLayer.color,
                        borderColor: gLayer.border,
                        topLabel: `G${idx + 1}:${gLayer.short}`,
                        subLabel:
                          gLayer.params > 0
                            ? `${Math.round(gLayer.params / 1000)}K p`
                            : 'reshape',
                      })
                    : drawCuboid({
                        key: `${head.id}_${gLayer.id}`,
                        cx: curX,
                        cy: topY,
                        c: gLayer.outputShape[0],
                        h: gLayer.outputShape[1],
                        w: gLayer.outputShape[2],
                        scale: 0.84,
                        color: gLayer.color,
                        borderColor: gLayer.border,
                        topLabel: `G${idx + 1}:${gLayer.short}`,
                        shapeLabel: gLayer.outputShape.join('×'),
                        subLabel: `RF ${gLayer.receptiveField}`,
                      })}
                </React.Fragment>
              );
            })}

            {/* 5. Army Context Projection & Residual Addition ⊕ */}
            <path
              d={`M ${startX + 14} ${botY} L ${armyProjX - 16} ${botY}`}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={1.8}
              strokeDasharray="5 3"
            />
            <text
              x={(startX + armyProjX) / 2}
              y={botY - 8}
              textAnchor="middle"
              fill="#38bdf8"
              fontSize={8.2}
              fontWeight={700}
            >
              Linear(64→256) + LayerNorm + SiLU
            </text>
            {drawDenseBar({
              key: `${head.id}_army_proj`,
              cx: armyProjX,
              cy: botY,
              dim: embedDim,
              scale: 0.88,
              color: '#0891b2',
              borderColor: '#38bdf8',
              dimColor: '#38bdf8',
              topLabel: 'army_context_proj',
              subLabel: '17.2K p',
            })}

            <path
              d={`M ${g5X + 12} ${topY} L ${fusionX - 14} ${midY}`}
              fill="none"
              stroke="#34d399"
              strokeWidth={2}
            />
            <path
              d={`M ${armyProjX + 12} ${botY} C ${armyProjX + 80} ${botY}, ${fusionX - 50} ${midY}, ${fusionX - 14} ${midY}`}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={2}
            />
            {drawFusionCircle(fusionX, midY, '⊕', 'State Fusion', 'spatial + army')}

            <line
              x1={fusionX + 14}
              y1={midY}
              x2={globalBarX - 12}
              y2={midY}
              stroke="#34d399"
              strokeWidth={2}
            />
            {drawDenseBar({
              key: `${head.id}_global_emb`,
              cx: globalBarX,
              cy: midY,
              dim: embedDim,
              scale: 0.92,
              color: '#059669',
              borderColor: '#34d399',
              topLabel: 'global_emb',
              subLabel: 'Fused State',
            })}

            {/* ============================================================= */}
            {/* HEAD-SPECIFIC 3D VOLUMETRIC LAYERS (RIGHT SIDE OF DIAGRAM)     */}
            {/* ============================================================= */}

            {/* HEAD 1: ACTION TYPE (256D -> Linear(256->7) -> 1.4*tanh -> Masked Categorical(7)) */}
            {head.id === 'head_slot_type' && (() => {
              const rawX = globalBarX + 108;
              const maskX = rawX + 108;
              const outX = maskX + 108;
              return (
                <>
                  {drawFilterCone(
                    globalBarX,
                    midY,
                    rawX,
                    midY,
                    'Linear(256→7)',
                    'rgba(250, 204, 21, 0.24)',
                    '#facc15'
                  )}
                  {drawDenseBar({
                    key: 'h1_raw',
                    cx: rawX,
                    cy: midY,
                    dim: 7,
                    scale: 1.05,
                    color: '#a16207',
                    borderColor: '#facc15',
                    dimColor: '#fde047',
                    topLabel: 'slot_type_head',
                    subLabel: '1.4·tanh(z/3)',
                  })}
                  {drawFilterCone(
                    rawX,
                    midY,
                    maskX,
                    midY,
                    'slot_type_mask',
                    'rgba(250, 204, 21, 0.24)',
                    '#facc15'
                  )}
                  {drawDenseBar({
                    key: 'h1_masked',
                    cx: maskX,
                    cy: midY,
                    dim: 7,
                    scale: 1.05,
                    color: '#ca8a04',
                    borderColor: '#fde047',
                    dimColor: '#fde047',
                    topLabel: 'Masked Logits',
                    subLabel: 'bool[7] mask',
                  })}
                  {drawFilterCone(
                    maskX,
                    midY,
                    outX,
                    midY,
                    'Softmax',
                    'rgba(250, 204, 21, 0.3)',
                    '#fde047'
                  )}
                  {drawDenseBar({
                    key: 'h1_out',
                    cx: outX,
                    cy: midY,
                    dim: 7,
                    scale: 1.12,
                    color: '#eab308',
                    borderColor: '#ffffff',
                    dimColor: '#fde047',
                    dimLabel: '7 Classes',
                    topLabel: 'π(slot_type)',
                    subLabel: 'NoOp/Troop/Spell',
                    isSelected: true,
                  })}
                </>
              );
            })()}

            {/* HEAD 2: SLOT INDEX (global_emb 256D + 1hot(type:7D) = 263D -> 128D -> 10D) */}
            {head.id === 'head_slot_idx' && (() => {
              const typeOneHotX = globalBarX;
              const typeOneHotY = topY - 26;
              const catX = globalBarX + 94;
              const hidX = catX + 98;
              const outX = hidX + 98;
              return (
                <>
                  {drawDenseBar({
                    key: 'h2_type_1hot',
                    cx: typeOneHotX,
                    cy: typeOneHotY,
                    dim: 7,
                    scale: 0.78,
                    color: '#ca8a04',
                    borderColor: '#facc15',
                    dimColor: '#fde047',
                    dimLabel: '7D 1-Hot',
                    topLabel: 'H1: chosen_type',
                    subLabel: 'Autoregressive',
                  })}
                  <path
                    d={`M ${typeOneHotX + 12} ${typeOneHotY} C ${catX - 30} ${typeOneHotY}, ${catX - 35} ${midY - 18}, ${catX - 12} ${midY - 12}`}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={1.8}
                    strokeDasharray="3 2"
                  />
                  <line
                    x1={globalBarX + 12}
                    y1={midY}
                    x2={catX - 12}
                    y2={midY}
                    stroke="#34d399"
                    strokeWidth={2}
                  />
                  {drawDenseBar({
                    key: 'h2_cond_emb',
                    cx: catX,
                    cy: midY,
                    dim: 263,
                    scale: 0.96,
                    color: '#0284c7',
                    borderColor: '#38bdf8',
                    dimColor: '#38bdf8',
                    dimLabel: '263D (256+7)',
                    topLabel: 'cond_emb',
                    subLabel: 'cat[global, type]',
                    segments: [
                      { color: '#eab308', frac: 0.22 },
                      { color: '#059669', frac: 0.78 },
                    ],
                  })}
                  {drawFilterCone(
                    catX,
                    midY,
                    hidX,
                    midY,
                    'Linear(263→128)+SiLU',
                    'rgba(56, 189, 248, 0.24)',
                    '#38bdf8'
                  )}
                  {drawDenseBar({
                    key: 'h2_hid',
                    cx: hidX,
                    cy: midY,
                    dim: 128,
                    scale: 0.95,
                    color: '#0369a1',
                    borderColor: '#38bdf8',
                    dimColor: '#7dd3fc',
                    topLabel: 'slot_idx MLP',
                    subLabel: '128D Hidden',
                  })}
                  {drawFilterCone(
                    hidX,
                    midY,
                    outX,
                    midY,
                    '128→10 + Mask',
                    'rgba(56, 189, 248, 0.3)',
                    '#38bdf8'
                  )}
                  {drawDenseBar({
                    key: 'h2_out',
                    cx: outX,
                    cy: midY,
                    dim: 10,
                    scale: 1.08,
                    color: '#0284c7',
                    borderColor: '#ffffff',
                    dimColor: '#38bdf8',
                    dimLabel: '10 Slots',
                    topLabel: 'π(slot_idx | type)',
                    subLabel: 'Masked Loadout',
                    isSelected: true,
                  })}
                </>
              );
            })()}

            {/* HEAD 3: DEPLOY FRACTION (global 256D + type 7D + idx 10D = 273D -> 128D -> 5D) */}
            {head.id === 'head_deploy_fraction' && (() => {
              const cat1X = globalBarX + 88;
              const cat2X = cat1X + 94;
              const hidX = cat2X + 96;
              const outX = hidX + 96;
              return (
                <>
                  {drawDenseBar({
                    key: 'h3_type_1hot',
                    cx: globalBarX,
                    cy: topY - 26,
                    dim: 7,
                    scale: 0.74,
                    color: '#ca8a04',
                    borderColor: '#facc15',
                    dimColor: '#fde047',
                    dimLabel: '7D Type',
                    topLabel: 'H1: 1hot(type)',
                    subLabel: '',
                  })}
                  <path
                    d={`M ${globalBarX + 12} ${topY - 26} C ${cat1X - 28} ${topY - 26}, ${cat1X - 28} ${midY - 14}, ${cat1X - 12} ${midY - 10}`}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={1.6}
                    strokeDasharray="3 2"
                  />
                  <line
                    x1={globalBarX + 12}
                    y1={midY}
                    x2={cat1X - 12}
                    y2={midY}
                    stroke="#34d399"
                    strokeWidth={2}
                  />
                  {drawDenseBar({
                    key: 'h3_cond1',
                    cx: cat1X,
                    cy: midY,
                    dim: 263,
                    scale: 0.92,
                    color: '#0284c7',
                    borderColor: '#38bdf8',
                    dimColor: '#38bdf8',
                    dimLabel: '263D',
                    topLabel: 'cond_emb',
                    subLabel: '256 + 7',
                    segments: [
                      { color: '#eab308', frac: 0.22 },
                      { color: '#059669', frac: 0.78 },
                    ],
                  })}
                  {drawDenseBar({
                    key: 'h3_idx_1hot',
                    cx: cat1X,
                    cy: topY - 26,
                    dim: 10,
                    scale: 0.74,
                    color: '#0284c7',
                    borderColor: '#38bdf8',
                    dimColor: '#38bdf8',
                    dimLabel: '10D Idx',
                    topLabel: 'H2: 1hot(idx)',
                    subLabel: '',
                  })}
                  <path
                    d={`M ${cat1X + 12} ${topY - 26} C ${cat2X - 28} ${topY - 26}, ${cat2X - 28} ${midY - 14}, ${cat2X - 12} ${midY - 10}`}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={1.6}
                    strokeDasharray="3 2"
                  />
                  <line
                    x1={cat1X + 12}
                    y1={midY}
                    x2={cat2X - 12}
                    y2={midY}
                    stroke="#c084fc"
                    strokeWidth={2}
                  />
                  {drawDenseBar({
                    key: 'h3_frac_cond',
                    cx: cat2X,
                    cy: midY,
                    dim: 273,
                    scale: 0.96,
                    color: '#7c3aed',
                    borderColor: '#c084fc',
                    dimColor: '#e9d5ff',
                    dimLabel: '273D (256+7+10)',
                    topLabel: 'frac_cond_emb',
                    subLabel: '3-Way Autoreg',
                    segments: [
                      { color: '#38bdf8', frac: 0.2 },
                      { color: '#eab308', frac: 0.18 },
                      { color: '#059669', frac: 0.62 },
                    ],
                  })}
                  {drawFilterCone(
                    cat2X,
                    midY,
                    hidX,
                    midY,
                    'Linear(273→128)+SiLU',
                    'rgba(192, 132, 252, 0.24)',
                    '#c084fc'
                  )}
                  {drawDenseBar({
                    key: 'h3_hid',
                    cx: hidX,
                    cy: midY,
                    dim: 128,
                    scale: 0.95,
                    color: '#7e22ce',
                    borderColor: '#c084fc',
                    dimColor: '#e9d5ff',
                    topLabel: 'Fraction MLP',
                    subLabel: '128D Hidden',
                  })}
                  {drawFilterCone(
                    hidX,
                    midY,
                    outX,
                    midY,
                    'Linear(128→5)',
                    'rgba(192, 132, 252, 0.3)',
                    '#c084fc'
                  )}
                  {drawDenseBar({
                    key: 'h3_out',
                    cx: outX,
                    cy: midY,
                    dim: numFracBins,
                    scale: 1.08,
                    color: '#9333ea',
                    borderColor: '#ffffff',
                    dimColor: '#e9d5ff',
                    dimLabel: '5 Bins α∈[0,1]',
                    topLabel: 'π(α | type, idx)',
                    subLabel: '1u/25/50/75/100%',
                    isSelected: true,
                  })}
                </>
              );
            })()}

            {/* HEAD 4: 50×50 SPATIAL TILE POINTER (3D Cuboid Pathway + FiLM Conditioning + Spatial Prior) */}
            {head.id === 'head_tile_conv' && (() => {
              const condX = globalBarX + 86;
              const projX = condX + 88;
              const filmX = splitX + 3.2 * stepX;
              const conv32X = filmX + 115;
              const raw1X = conv32X + 115;
              const outTileX = raw1X + 115;
              const tileTrackY = 248;
              const s4X = startX + 4 * stepX;

              return (
                <>
                  {/* Top Conditioning Bar: cond_emb (263D) -> tile_cond_proj (64×1×1) */}
                  <line
                    x1={globalBarX + 12}
                    y1={midY}
                    x2={condX - 12}
                    y2={midY}
                    stroke="#facc15"
                    strokeWidth={1.8}
                  />
                  {drawDenseBar({
                    key: 'h4_cond_emb',
                    cx: condX,
                    cy: midY,
                    dim: 263,
                    scale: 0.88,
                    color: '#ca8a04',
                    borderColor: '#facc15',
                    dimColor: '#fde047',
                    dimLabel: '263D (256+7)',
                    topLabel: 'cond_emb',
                    subLabel: 'global + 1hot(type)',
                    segments: [
                      { color: '#eab308', frac: 0.22 },
                      { color: '#059669', frac: 0.78 },
                    ],
                  })}
                  {drawFilterCone(
                    condX,
                    midY,
                    projX,
                    midY,
                    'Linear(263→64)',
                    'rgba(250, 204, 21, 0.25)',
                    '#facc15'
                  )}
                  {drawCuboid({
                    key: 'h4_cond_spatial',
                    cx: projX,
                    cy: midY,
                    c: 64,
                    h: 8,
                    w: 8,
                    scale: 0.85,
                    color: '#d97706',
                    borderColor: '#fde047',
                    topLabel: 'tile_cond_proj',
                    shapeLabel: '64×1×1',
                    subLabel: 'FiLM Vector',
                  })}

                  {/* Full-Res 64×50×50 Skip Pathway from S4 into FiLM Cuboid */}
                  {drawFilterCone(
                    s4X,
                    topY,
                    filmX,
                    tileTrackY,
                    'spatial_feat (64×50×50)',
                    'rgba(96, 165, 250, 0.22)',
                    '#60a5fa'
                  )}
                  <path
                    d={`M ${projX} ${midY + 26} C ${projX} ${tileTrackY - 55}, ${filmX} ${midY + 40}, ${filmX} ${tileTrackY - 38}`}
                    fill="none"
                    stroke="#facc15"
                    strokeWidth={1.8}
                    strokeDasharray="4 2"
                  />
                  {drawCuboid({
                    key: 'h4_film_cuboid',
                    cx: filmX,
                    cy: tileTrackY,
                    c: 64,
                    h: 50,
                    w: 50,
                    scale: 0.86,
                    color: '#b45309',
                    borderColor: '#facc15',
                    topLabel: 'FiLM Fused Map',
                    shapeLabel: '64×50×50',
                    subLabel: 'F·(1+0.5tanh(c))+c',
                  })}
                  {drawFilterCone(
                    filmX,
                    tileTrackY,
                    conv32X,
                    tileTrackY,
                    'Conv 3×3 + SiLU',
                    'rgba(250, 204, 21, 0.25)',
                    '#facc15'
                  )}
                  {drawCuboid({
                    key: 'h4_conv32',
                    cx: conv32X,
                    cy: tileTrackY,
                    c: 32,
                    h: 50,
                    w: 50,
                    scale: 0.86,
                    color: '#d97706',
                    borderColor: '#facc15',
                    topLabel: 'tile_conv_head[0]',
                    shapeLabel: '32×50×50',
                    subLabel: '18.5K params',
                  })}
                  {drawFilterCone(
                    conv32X,
                    tileTrackY,
                    raw1X,
                    tileTrackY,
                    'Conv 1×1',
                    'rgba(249, 115, 22, 0.28)',
                    '#f97316'
                  )}
                  {drawCuboid({
                    key: 'h4_raw1',
                    cx: raw1X,
                    cy: tileTrackY,
                    c: 1,
                    h: 50,
                    w: 50,
                    scale: 0.86,
                    color: '#ea580c',
                    borderColor: '#fb923c',
                    topLabel: 'raw_tile_logits',
                    shapeLabel: '1×50×50',
                    subLabel: '+ Spatial Prior',
                  })}
                  {drawFilterCone(
                    raw1X,
                    tileTrackY,
                    outTileX,
                    tileTrackY,
                    'Mask + Softmax',
                    'rgba(250, 204, 21, 0.32)',
                    '#fde047'
                  )}
                  {drawCuboid({
                    key: 'h4_out',
                    cx: outTileX,
                    cy: tileTrackY,
                    c: 1,
                    h: 50,
                    w: 50,
                    scale: 0.92,
                    color: '#f59e0b',
                    borderColor: '#ffffff',
                    topLabel: 'π(tile_x, tile_y)',
                    shapeLabel: '1×50×50',
                    subLabel: '2,500 Tiles',
                    isSelected: true,
                  })}
                </>
              );
            })()}

            {/* HEAD 5: STATE-VALUE CRITIC V(s) (global_emb 256D -> Linear(256->128)+SiLU -> Linear(128->1) -> Scalar V(s)) */}
            {head.id === 'head_critic' && (() => {
              const hidX = globalBarX + 112;
              const outX = hidX + 112;
              return (
                <>
                  {drawFilterCone(
                    globalBarX,
                    midY,
                    hidX,
                    midY,
                    'Linear(256→128)+SiLU',
                    'rgba(74, 222, 128, 0.24)',
                    '#4ade80'
                  )}
                  {drawDenseBar({
                    key: 'h5_hid',
                    cx: hidX,
                    cy: midY,
                    dim: 128,
                    scale: 1.0,
                    color: '#15803d',
                    borderColor: '#4ade80',
                    dimColor: '#86efac',
                    topLabel: 'critic_head[0]',
                    subLabel: '32.9K p (SiLU)',
                  })}
                  {drawFilterCone(
                    hidX,
                    midY,
                    outX,
                    midY,
                    'Linear(128→1)',
                    'rgba(74, 222, 128, 0.32)',
                    '#4ade80'
                  )}
                  {drawCuboid({
                    key: 'h5_out',
                    cx: outX,
                    cy: midY,
                    c: 4,
                    h: 12,
                    w: 12,
                    scale: 1.05,
                    color: '#16a34a',
                    borderColor: '#ffffff',
                    topLabel: 'Critic V(s)',
                    shapeLabel: '1D Scalar',
                    subLabel: '2.5× Actor LR',
                    isSelected: true,
                  })}
                </>
              );
            })()}
          </svg>
        </div>

        <div className="arch-head-meta-footer">
          <span>
            <strong>Sub-Model Forward:</strong> <code>{head.formula}</code>
          </span>
        </div>
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
            <span>Input 1 (obs)</span>
            <strong>{inChannels}×50×50</strong>
          </div>
          <div className="arch-pill" style={{ borderColor: '#0891b2' }}>
            <span>Input 2 (army_context)</span>
            <strong style={{ color: '#38bdf8' }}>{armyContextDim}D → 256D ⊕</strong>
          </div>
          <div className="arch-pill">
            <span>Spatial Map</span>
            <strong>{spatialDim}×50×50 (RF 15×15)</strong>
          </div>
          <div className="arch-pill">
            <span>Fused State</span>
            <strong style={{ color: '#34d399' }}>{embedDim}D</strong>
          </div>
          <div className="arch-pill">
            <span>Parameters</span>
            <strong style={{ color: '#facc15' }}>{totalParams.toLocaleString()}</strong>
          </div>
          <div className="arch-pill">
            <span>Compute</span>
            <strong>{(totalMacs / 1e6).toFixed(1)}M MACs</strong>
          </div>
          <button
            type="button"
            className="speed-pill-btn"
            onClick={() => setShowLayerTable((v) => !v)}
          >
            {showLayerTable ? 'Hide Layer Table' : '📋 Layer Table'}
          </button>
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
            {isCollapsed ? '▼ Expand' : '▲ Collapse'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="arch-viz-toolbar">
            <div className="arch-viz-tabs">
              <button
                type="button"
                className={`speed-pill-btn ${
                  vizMode === 'schematic' && headFilter === 'all' ? 'active' : ''
                }`}
                onClick={() => {
                  setVizMode('schematic');
                  setHeadFilter('all');
                }}
              >
                🧊 Full Network (obs + army_context + 5 Heads)
              </button>
              <button
                type="button"
                className={`speed-pill-btn ${
                  vizMode === 'schematic' && headFilter === 'split_all' ? 'active' : ''
                }`}
                onClick={() => {
                  setVizMode('schematic');
                  setHeadFilter('split_all');
                }}
              >
                ⊞ Split All 5 Heads (3D)
              </button>
              {HEAD_META.map((hp) => (
                <button
                  key={hp.id}
                  type="button"
                  className={`speed-pill-btn ${
                    vizMode === 'schematic' && headFilter === hp.id ? 'active' : ''
                  }`}
                  style={
                    vizMode === 'schematic' && headFilter === hp.id
                      ? { borderColor: hp.border, color: hp.border }
                      : undefined
                  }
                  onClick={() => {
                    setVizMode('schematic');
                    setHeadFilter(hp.id);
                  }}
                >
                  {hp.shortTitle}
                </button>
              ))}
              <button
                type="button"
                className={`speed-pill-btn ${vizMode === 'torchview' ? 'active' : ''}`}
                onClick={() => setVizMode('torchview')}
              >
                🕸️ Torchview Graph
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

          {vizMode === 'schematic' && headFilter === 'all' && renderUnifiedNetworkSvg()}

          {vizMode === 'schematic' && headFilter === 'split_all' && (
            <div className="arch-heads-split-grid">
              {HEAD_META.map((hp) => renderVisualSubModel3D(hp, true))}
            </div>
          )}

          {vizMode === 'schematic' &&
            headFilter !== 'all' &&
            headFilter !== 'split_all' && (
              <div className="arch-heads-single-focus">
                {HEAD_META.filter((hp) => hp.id === headFilter).map((hp) =>
                  renderVisualSubModel3D(hp, false)
                )}
              </div>
            )}

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

          {showLayerTable && (
            <div className="arch-summary-table-wrap" style={{ maxHeight: 340 }}>
              <table className="ai-matrix-table">
                <thead>
                  <tr>
                    <th>Block ID</th>
                    <th>Layer / Module</th>
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
                      <td style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
                        {row.id}
                      </td>
                      <td style={{ fontWeight: 700, color: '#fde047' }}>{row.type}</td>
                      <td>{row.stage}</td>
                      <td
                        style={{
                          textAlign: 'left',
                          color: '#cbd5e1',
                          maxWidth: 340,
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
          )}
        </>
      )}
    </section>
  );
};
