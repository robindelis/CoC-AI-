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

interface HeadPipelineSpec {
  id: Exclude<HeadFilterId, 'all' | 'split_all'>;
  index: number;
  title: string;
  shortTitle: string;
  moduleName: string;
  color: string;
  border: string;
  outputDim: string;
  distribution: string;
  params: number;
  activeWhen: string;
  inputsUsed: Array<{ label: string; shape: string; color: string }>;
  stages: Array<{
    name: string;
    op: string;
    inShape: string;
    outShape: string;
    detail: string;
    color: string;
  }>;
  formula: string;
  maskRule: string;
  entropyWeight: string;
}

const HEAD_PIPELINES: HeadPipelineSpec[] = [
  {
    id: 'head_slot_type',
    index: 1,
    title: 'Head 1 • Action Type (slot_type_head)',
    shortTitle: 'H1: Action Type (7)',
    moduleName: 'self.slot_type_head',
    color: '#ca8a04',
    border: '#facc15',
    outputDim: '7 logits',
    distribution: 'Categorical(7)',
    params: 1799,
    activeWhen: 'Every decision step t',
    inputsUsed: [
      { label: 'global_tower(obs)', shape: '256-D', color: '#34d399' },
      { label: 'army_context_proj(ctx)', shape: '256-D', color: '#38bdf8' },
    ],
    stages: [
      {
        name: 'State Fusion ⊕',
        op: 'global_emb = spatial_emb + army_emb',
        inShape: '256 + 256',
        outShape: '256-D',
        detail: 'Fuses 10×50×50 CNN global tower with 64-D army inventory projection',
        color: '#059669',
      },
      {
        name: 'Linear Projection',
        op: 'nn.Linear(256, 7)',
        inShape: '256-D',
        outShape: '7-D',
        detail: '0=NoOp, 1=Troop, 2=Hero, 3=HeroAbility, 4=Siege, 5=PopSiege, 6=Spell',
        color: '#ca8a04',
      },
      {
        name: 'Logit Bounding',
        op: '1.4 · tanh(z / 3.0)',
        inShape: '7-D',
        outShape: '7-D',
        detail: 'Smoothly bounds raw logits to [-1.4, +1.4] to prevent entropy collapse',
        color: '#d97706',
      },
      {
        name: 'Action Mask',
        op: 'masked_fill(~slot_type_mask, -1e8)',
        inShape: '7-D + bool[7]',
        outShape: 'Categorical(7)',
        detail: 'Masks depleted categories; prevents step-0 NoOp while troops remain',
        color: '#eab308',
      },
    ],
    formula: 'z_type = 1.4 · tanh(W_type · (g_spatial + g_army) / 3.0) + M_type',
    maskRule: 'masks["slot_type"] (B, 7) • Blocks NoOp on step 0 & unavailable categories',
    entropyWeight: '2.2 × (H(π_type) / ln 7)',
  },
  {
    id: 'head_slot_idx',
    index: 2,
    title: 'Head 2 • Loadout Slot Index (slot_idx_head)',
    shortTitle: 'H2: Slot Index (10)',
    moduleName: 'self.slot_idx_head',
    color: '#0284c7',
    border: '#38bdf8',
    outputDim: '10 logits',
    distribution: 'Categorical(10)',
    params: 35082,
    activeWhen: 'chosen_type ∈ {1=Troop, 2=Hero, 3=Ability, 6=Spell}',
    inputsUsed: [
      { label: 'global_emb (obs ⊕ army)', shape: '256-D', color: '#34d399' },
      { label: 'one_hot(chosen_type)', shape: '7-D', color: '#facc15' },
    ],
    stages: [
      {
        name: 'Autoregressive Cat',
        op: 'cond_emb = cat([global_emb, type_1hot])',
        inShape: '256 + 7',
        outShape: '263-D',
        detail: 'Conditions slot selection on the sampled Action Type from Head 1',
        color: '#0891b2',
      },
      {
        name: 'Hidden MLP Layer',
        op: 'Linear(263 → 128) + SiLU',
        inShape: '263-D',
        outShape: '128-D',
        detail: 'Cross-references remaining army inventory with chosen action category',
        color: '#0284c7',
      },
      {
        name: 'Slot Logits + Tanh',
        op: '1.6 · tanh(Linear(128 → 10) / 3.0)',
        inShape: '128-D',
        outShape: '10-D',
        detail: 'Produces bounded logits across up to 10 army loadout slots',
        color: '#2563eb',
      },
      {
        name: 'Per-Type Slot Mask',
        op: 'masks["slot_idx"][B, chosen_type]',
        inShape: '10-D + bool[7,10]',
        outShape: 'Categorical(10)',
        detail: 'Slices the (7, 10) mask row for chosen_type so only non-empty slots can be picked',
        color: '#38bdf8',
      },
    ],
    formula: 'z_idx = 1.6 · tanh(MLP_idx([global_emb, one_hot(a_type)]) / 3.0) + M_idx[a_type]',
    maskRule: 'masks["slot_idx"][batch, chosen_type] (B, 10) • Masks exhausted unit/spell slots',
    entropyWeight: '2.2 × (uses_idx · H(π_idx) / ln 10)',
  },
  {
    id: 'head_deploy_fraction',
    index: 3,
    title: 'Head 3 • Troop Wave Fraction (deploy_fraction_head)',
    shortTitle: 'H3: Deploy Frac (5)',
    moduleName: 'self.deploy_fraction_head',
    color: '#9333ea',
    border: '#c084fc',
    outputDim: '5 bins α ∈ [0,1]',
    distribution: 'Categorical(5)',
    params: 35717,
    activeWhen: 'chosen_type == 1 (Deploy Troop)',
    inputsUsed: [
      { label: 'global_emb (obs ⊕ army)', shape: '256-D', color: '#34d399' },
      { label: 'one_hot(chosen_type)', shape: '7-D', color: '#facc15' },
      { label: 'one_hot(chosen_idx)', shape: '10-D', color: '#38bdf8' },
    ],
    stages: [
      {
        name: '2-Step Autoreg Cat',
        op: 'cat([global_emb, type_1hot, idx_1hot])',
        inShape: '256 + 7 + 10',
        outShape: '273-D',
        detail: 'Conditions wave size on both Action Type (Head 1) and Troop Slot (Head 2)',
        color: '#7c3aed',
      },
      {
        name: 'Fraction MLP',
        op: 'Linear(273 → 128) + SiLU',
        inShape: '273-D',
        outShape: '128-D',
        detail: 'Distinguishes single-unit funnel test drops from full-squad smash waves',
        color: '#9333ea',
      },
      {
        name: 'Bin Logits + Tanh',
        op: '1.4 · tanh(Linear(128 → 5) / 3.0)',
        inShape: '128-D',
        outShape: '5-D',
        detail: 'Bins: α ∈ {0.0 (1 unit), 0.25 (25%), 0.50 (50%), 0.75 (75%), 1.00 (All)}',
        color: '#a855f7',
      },
      {
        name: 'Batch Count Calc',
        op: 'max(1, round(avail_count × α))',
        inShape: 'Categorical(5)',
        outShape: 'DeployTroopBatch',
        detail: 'Converts sampled fraction bin into exact integer troop count for the engine',
        color: '#c084fc',
      },
    ],
    formula: 'z_frac = 1.4 · tanh(MLP_frac([global_emb, 1hot(a_type), 1hot(a_idx)]) / 3.0)',
    maskRule: 'Active when chosen_type == 1 (uses_frac = 1.0); all 5 bins valid',
    entropyWeight: '2.2 × (uses_frac · H(π_frac) / ln 5)',
  },
  {
    id: 'head_tile_conv',
    index: 4,
    title: 'Head 4 • 50×50 Spatial Tile Pointer (tile_cond_proj + tile_conv_head)',
    shortTitle: 'H4: Tile Pointer (2500)',
    moduleName: 'self.tile_cond_proj + self.tile_conv_head',
    color: '#d97706',
    border: '#facc15',
    outputDim: '50×50 = 2,500 tiles',
    distribution: 'Categorical(2500)',
    params: 35393,
    activeWhen: 'chosen_type ∈ {1=Troop, 2=Hero, 4=Siege, 6=Spell}',
    inputsUsed: [
      { label: 'spatial_feat (CNN Stem)', shape: '64×50×50', color: '#60a5fa' },
      { label: 'cond_emb (global ⊕ type)', shape: '263-D', color: '#facc15' },
      { label: 'obs Priors (Ch 0,1,2,5,6)', shape: '10×50×50', color: '#fb923c' },
    ],
    stages: [
      {
        name: 'FiLM Conditioning',
        op: 'c = Linear(263 → 64).view(B,64,1,1)',
        inShape: '64×50×50 + 263-D',
        outShape: '64×50×50',
        detail: 'fused = SiLU(spatial_feat * (1 + 0.5·tanh(c)) + c) modulates every tile by action type + army',
        color: '#b45309',
      },
      {
        name: 'Pointer Conv Tower',
        op: 'Conv3×3(64→32) + SiLU → Conv1×1(32→1)',
        inShape: '64×50×50',
        outShape: '1×50×50 (2500)',
        detail: 'Preserves 1-to-1 tile alignment across all 2,500 battlefield coordinates',
        color: '#d97706',
      },
      {
        name: 'Multi-Scale Prior',
        op: '2.2·z_raw + (1-s)·8·Breach + s·7.5·Combat',
        inShape: '2500 + obs pools',
        outShape: '2500-D',
        detail: '15×15×2 AvgPool threat/TH breach field for units; 7×7 active combat focus for spells',
        color: '#ea580c',
      },
      {
        name: 'Green / Spell Mask',
        op: 'where(needs_green, valid_green, spell_mask)',
        inShape: '2500-D + bool[2500]',
        outShape: 'Categorical(2500)',
        detail: 'Enforces legal perimeter grass for deployments & active combat (non-TH halo) for spells',
        color: '#f59e0b',
      },
    ],
    formula: 'z_tile = 2.2 · Conv1×1(SiLU(Conv3×3(FiLM(F_50×50, c_263)))) + Prior_spatial + M_tile',
    maskRule: 'Units: masks["tile"] (green perimeter) • Spells: near_allies & near_buildings & ~TH_halo',
    entropyWeight: '0.12 × (uses_tile · H(π_tile) / 6.743)',
  },
  {
    id: 'head_critic',
    index: 5,
    title: 'Head 5 • State-Value Critic V(s) (critic_head)',
    shortTitle: 'H5: Value Critic (1)',
    moduleName: 'self.critic_head',
    color: '#16a34a',
    border: '#4ade80',
    outputDim: 'Scalar V(s) ∈ ℝ',
    distribution: 'MSE vs GAE Return R_t',
    params: 33025,
    activeWhen: 'Every step t + bootstrap V(s_T)',
    inputsUsed: [
      { label: 'global_tower(obs)', shape: '256-D', color: '#34d399' },
      { label: 'army_context_proj(ctx)', shape: '256-D', color: '#38bdf8' },
    ],
    stages: [
      {
        name: 'State Fusion ⊕',
        op: 'global_emb = spatial_emb + army_emb',
        inShape: '256 + 256',
        outShape: '256-D',
        detail: 'Evaluates remaining base HP/DPS alongside remaining army inventory & clock',
        color: '#059669',
      },
      {
        name: 'Critic Hidden Layer',
        op: 'nn.Linear(256, 128) + nn.SiLU()',
        inShape: '256-D',
        outShape: '128-D',
        detail: 'Nonlinear state-value representation trained at 2.5× Actor learning rate',
        color: '#15803d',
      },
      {
        name: 'Scalar Value Out',
        op: 'nn.Linear(128, 1).squeeze(-1)',
        inShape: '128-D',
        outShape: 'Scalar V(s)',
        detail: 'Predicts expected discounted return R_t (0..100 pt scale) for GAE-λ advantage estimation',
        color: '#16a34a',
      },
      {
        name: 'GAE & Value Loss',
        op: 'L_VF = 0.5 · MSE(V(s_t), R_t)',
        inShape: 'V(s_t), R_t',
        outShape: 'δ_t = r_t + γV(s_{t+1}) - V(s_t)',
        detail: 'Provides low-variance baseline for Actor policy gradient updates',
        color: '#22c55e',
      },
    ],
    formula: 'V(s) = W_v2 · SiLU(W_v1 · (g_spatial(obs) + g_army(army_context)))',
    maskRule: 'Unmasked scalar state-value estimation • Optimizer group lr = 2.5 × actor_lr',
    entropyWeight: 'Critic Loss Term: 0.5 × MSE(V(s), R_GAE)',
  },
];

const DEFAULT_LAYERS: AIArchitectureLayerSpec[] = [
  {
    id: 's1',
    stage: 'spatial',
    type: 'Dilated Conv2d + GroupNorm + SiLU',
    short: 'Conv d=2',
    desc: '32 filters, 3×3, d=2, p=2, GroupNorm(4), SiLU (10-ch Village Grid)',
    inputShape: [10, 50, 50],
    outputShape: [32, 50, 50],
    receptiveField: 5,
    params: 2944,
    macs: 7200000,
    color: '#2563eb',
    border: '#60a5fa',
    coneLabel: '3×3 d=2',
  },
  {
    id: 's2',
    stage: 'spatial',
    type: 'Dilated Conv2d + GroupNorm + SiLU',
    short: 'Conv d=2',
    desc: '32 filters, 3×3, d=2, p=2, GroupNorm(4), SiLU',
    inputShape: [32, 50, 50],
    outputShape: [32, 50, 50],
    receptiveField: 9,
    params: 9280,
    macs: 23040000,
    color: '#2563eb',
    border: '#60a5fa',
    coneLabel: '3×3 d=2',
  },
  {
    id: 's3',
    stage: 'spatial',
    type: 'Conv2d + GroupNorm + SiLU',
    short: 'Conv 3×3',
    desc: '64 filters, 3×3, d=1, p=1, GroupNorm(8), SiLU',
    inputShape: [32, 50, 50],
    outputShape: [64, 50, 50],
    receptiveField: 11,
    params: 18560,
    macs: 46080000,
    color: '#1d4ed8',
    border: '#60a5fa',
    coneLabel: '3×3 d=1',
  },
  {
    id: 's4',
    stage: 'spatial',
    type: 'Residual Context Block',
    short: 'ResBlock',
    desc: '2×Conv 64 ch, 3×3, p=1, GroupNorm(8), Residual Skip (+), SiLU',
    inputShape: [64, 50, 50],
    outputShape: [64, 50, 50],
    receptiveField: 15,
    params: 73984,
    macs: 184320000,
    color: '#7c3aed',
    border: '#a78bfa',
    coneLabel: '2×3×3 + Skip',
    hasSkipArc: true,
  },
  {
    id: 'g1',
    stage: 'global',
    type: 'Strided Conv2d + SiLU',
    short: 'Conv s=2',
    desc: '96 filters, 3×3, stride=2, pad=1, SiLU',
    inputShape: [64, 50, 50],
    outputShape: [96, 25, 25],
    receptiveField: 19,
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
    short: 'Conv s=2',
    desc: '128 filters, 3×3, stride=2, pad=1, SiLU',
    inputShape: [96, 25, 25],
    outputShape: [128, 13, 13],
    receptiveField: 27,
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
    short: 'GlobalTower',
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
    type: 'tile_cond_proj + tile_conv_head (Head 4)',
    short: 'TileHead',
    desc: 'FiLM(spatial_feat 64×50×50, Linear(263→64)) + Conv 3×3(64→32) + Conv 1×1(32→1) + spatial_prior',
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
  const inChannels = liveSpec?.in_channels ?? 10;
  const armyContextDim = liveSpec?.army_context_dim ?? 64;
  const spatialDim = liveSpec?.spatial_dim ?? 64;
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

  const renderUnifiedNetworkSvg = () => {
    const stepX = 96;
    const startX = 62;
    const stemY = 152;
    const topBranchY = 92;
    const armyTrackY = 236;
    const botBranchY = 330;

    const splitX = startX + (spatialLayers.length + 1) * stepX;
    const globalEndX = splitX + (globalTowerLayers.length - 1) * stepX;
    const fusionX = globalEndX + 86;
    const headsX = fusionX + 118;
    const svgWidth = Math.max(1220, headsX + 185);
    const svgHeight = 420;

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
      const sideH = Math.max(22, Math.min(82, 18 + (opts.h / 50) * 64));
      const depth = Math.max(10, Math.min(40, Math.round(Math.log2(Math.max(2, opts.c)) * 5.2)));
      const dx = Math.round(depth * 0.68);
      const dy = Math.round(depth * 0.38);

      const x0 = opts.cx - depth / 2;
      const y0 = opts.cy - sideH / 2;

      const frontPts = `${x0},${y0} ${x0 + depth},${y0} ${x0 + depth},${y0 + sideH} ${x0},${y0 + sideH}`;
      const topPts = `${x0},${y0} ${x0 + dx},${y0 - dy} ${x0 + depth + dx},${y0 - dy} ${x0 + depth},${y0}`;
      const rightPts = `${x0 + depth},${y0} ${x0 + depth + dx},${y0 - dy} ${x0 + depth + dx},${y0 + sideH - dy} ${x0 + depth},${y0 + sideH}`;

      const strokeW = opts.isSelected ? 2.4 : opts.isHovered ? 2.0 : 1.2;
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
                d={`M ${x0 - 22} ${y0 - 4} Q ${opts.cx + dx / 2} ${y0 - dy - 26} ${
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

          <text
            x={opts.cx + dx / 2}
            y={y0 - dy - 8}
            textAnchor="middle"
            fill={opts.isSelected ? '#fde047' : '#f8fafc'}
            fontSize={9.5}
            fontWeight={700}
          >
            {opts.topLabel}
          </text>
          <text
            x={opts.cx + dx / 2}
            y={y0 + sideH + 13}
            textAnchor="middle"
            fill="#fde047"
            fontSize={9.2}
            fontWeight={700}
          >
            {opts.shapeLabel}
          </text>
          <text
            x={opts.cx + dx / 2}
            y={y0 + sideH + 24}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={8.4}
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
      dimColor?: string;
      isSelected?: boolean;
      isHovered?: boolean;
      onClick?: () => void;
      onHover?: (id: string | null) => void;
    }) => {
      const barH = Math.max(28, Math.min(74, Math.round(Math.log2(Math.max(2, opts.dim)) * 7.2)));
      const barW = 16;
      const dx = 6;
      const dy = 4;
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
            fillOpacity={0.8}
            stroke={strokeCol}
            strokeWidth={opts.isSelected ? 2.2 : 1.2}
          />
          {[0.25, 0.5, 0.75].map((f, i) => (
            <circle key={i} cx={x0 + barW / 2} cy={y0 + barH * f} r={2} fill="#f8fafc" opacity={0.8} />
          ))}
          <text
            x={opts.cx + dx / 2}
            y={y0 - dy - 8}
            textAnchor="middle"
            fill={opts.isSelected ? '#fde047' : '#f8fafc'}
            fontSize={9.5}
            fontWeight={700}
          >
            {opts.topLabel}
          </text>
          <text
            x={opts.cx + dx / 2}
            y={y0 + barH + 13}
            textAnchor="middle"
            fill={opts.dimColor ?? '#34d399'}
            fontSize={9.5}
            fontWeight={700}
          >
            {opts.dim}D
          </text>
          <text
            x={opts.cx + dx / 2}
            y={y0 + barH + 23}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize={8.3}
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
      const patchH = 16;
      return (
        <g key={`cone-${x1}-${y1}-${x2}-${y2}`}>
          <polygon
            points={`${x1 + 12},${y1 - patchH / 2} ${x1 + 12},${y1 + patchH / 2} ${x2 - 12},${y2 + 3} ${x2 - 12},${y2 - 3}`}
            fill={color}
            stroke={stroke}
            strokeWidth={0.9}
            strokeOpacity={0.65}
          />
          {label && (
            <text
              x={(x1 + x2) / 2 + 2}
              y={(y1 + y2) / 2 - 9}
              textAnchor="middle"
              fill="#93c5fd"
              fontSize={8.2}
              fontWeight={600}
            >
              {label}
            </text>
          )}
        </g>
      );
    };

    const stemLastX = splitX - stepX;
    const armyProjX = splitX + 2 * stepX;
    const tileFiLMX = splitX + 1.5 * stepX;
    const tileMidX = splitX + 3.0 * stepX;
    const tileOutX = tileMidX + 1.15 * stepX;

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
            STAGE 1 • DUAL INPUTS &amp; SPATIAL CNN STEM (Full-Res 50×50 Pathway: S1 d=2 → S2 d=2 → S3 d=1 → S4 ResBlock)
          </text>
          <text x={splitX - 18} y={20} fill="#34d399" fontSize={10} fontWeight={800}>
            STAGE 2 • GLOBAL TOWER + ARMY CONTEXT FUSION (⊕ 256D) &amp; STAGE 3 • 5 AUTOREGRESSIVE HEADS
          </text>

          {/* INPUT 1: Spatial Observation Grid obs (10×50×50) */}
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

          {/* INPUT 2: Army Context Vector army_context (64-D) */}
          {drawDenseBar({
            key: 'input_army_ctx',
            cx: startX,
            cy: armyTrackY + 42,
            dim: armyContextDim,
            color: '#0891b2',
            borderColor: '#38bdf8',
            dimColor: '#38bdf8',
            topLabel: 'Input 2: army_context',
            subLabel: 'Troops/Heroes/Spells',
            isSelected: selectedBlockId === 'head_army_ctx',
            onClick: () => setSelectedBlockId('head_army_ctx'),
            onHover: setHoveredBlockId,
          })}

          {/* Spatial Stem Blocks S1, S2, S3, S4 */}
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

          {/* Upper Branch: Global Tower G1..G5 */}
          {globalTowerLayers.map((gLayer, idx) => {
            const prevX = idx === 0 ? stemLastX : splitX + (idx - 1) * stepX;
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

          {/* Middle Branch: Army Context Projection (64D -> 256D) & Residual Fusion (⊕) */}
          <path
            d={`M ${startX + 14} ${armyTrackY + 42} L ${armyProjX - 18} ${armyTrackY}`}
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

          {/* Fusion Node: global_emb = global_tower(obs) + army_context_proj(army_context) */}
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
          <g transform={`translate(${fusionX}, ${topBranchY + 34})`}>
            <circle r={16} fill="#0f172a" stroke="#facc15" strokeWidth={2.2} />
            <text y={4} textAnchor="middle" fill="#facc15" fontSize={14} fontWeight={900}>
              ⊕
            </text>
            <text y={-22} textAnchor="middle" fill="#fde047" fontSize={9.2} fontWeight={800}>
              global_emb
            </text>
            <text y={30} textAnchor="middle" fill="#34d399" fontSize={8.5} fontWeight={700}>
              256D Fused State
            </text>
          </g>

          {/* Lower Branch: Spatial Tile Pointer (Head 4) with FiLM Conditioning + Spatial Prior */}
          {drawFilterCone(
            stemLastX,
            stemY,
            tileFiLMX,
            botBranchY,
            'spatial_feat (64×50×50)',
            'rgba(96, 165, 250, 0.2)',
            '#60a5fa'
          )}
          <path
            d={`M ${fusionX} ${topBranchY + 50} C ${fusionX - 30} ${botBranchY - 70}, ${tileFiLMX} ${topBranchY + 120}, ${tileFiLMX} ${botBranchY - 42}`}
            fill="none"
            stroke="#facc15"
            strokeWidth={1.6}
            strokeDasharray="4 3"
          />
          <text
            x={tileFiLMX + 46}
            y={botBranchY - 52}
            textAnchor="middle"
            fill="#fde047"
            fontSize={8.2}
            fontWeight={700}
          >
            tile_cond_proj(263→64) FiLM
          </text>
          {drawCuboid({
            key: 'tile_film_fusion',
            cx: tileFiLMX,
            cy: botBranchY,
            c: spatialDim,
            h: 50,
            w: 50,
            color: '#b45309',
            borderColor: '#facc15',
            topLabel: 'FiLM Spatial Fusion',
            shapeLabel: '64×50×50',
            subLabel: 'F·(1+0.5tanh(c))+c',
            isSelected: selectedBlockId === 'head_tile_conv',
            onClick: () => {
              setSelectedBlockId('head_tile_conv');
              setHeadFilter('head_tile_conv');
            },
          })}

          {drawFilterCone(
            tileFiLMX,
            botBranchY,
            tileMidX,
            botBranchY,
            'Conv 3×3',
            'rgba(250, 204, 21, 0.22)',
            '#facc15'
          )}
          {drawCuboid({
            key: 'head_tile_conv',
            cx: tileMidX,
            cy: botBranchY,
            c: 32,
            h: 50,
            w: 50,
            color: '#d97706',
            borderColor: '#facc15',
            topLabel: 'tile_conv_head',
            shapeLabel: '32×50×50',
            subLabel: '35.4K params',
            isSelected: selectedBlockId === 'head_tile_conv',
            isHovered: hoveredBlockId === 'head_tile_conv',
            onClick: () => {
              setSelectedBlockId('head_tile_conv');
              setHeadFilter('head_tile_conv');
            },
            onHover: setHoveredBlockId,
          })}

          {drawFilterCone(
            tileMidX,
            botBranchY,
            tileOutX,
            botBranchY,
            '1×1 + Prior',
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

          {/* Autoregressive Conditioning Cascade Arrows between H1 -> H2 -> H3 */}
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

  const renderSingleHeadCard = (head: HeadPipelineSpec, isCompact: boolean) => {
    const svgW = 860;
    const svgH = 148;
    const boxW = 166;
    const boxH = 82;
    const startX = 148;
    const stepX = 174;

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
              <b>{head.params.toLocaleString()}</b> params
            </span>
            <span className="arch-head-stat-pill" style={{ color: head.border }}>
              Out: <b>{head.outputDim}</b> ({head.distribution})
            </span>
            {isCompact ? (
              <button
                type="button"
                className="speed-pill-btn"
                onClick={() => setHeadFilter(head.id)}
              >
                ⤢ Focus Head
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

        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="arch-head-flow-svg">
          {/* Upstream Input Pills on the Left */}
          {head.inputsUsed.map((inp, idx) => {
            const totalIn = head.inputsUsed.length;
            const spacing = 36;
            const y0 =
              svgH / 2 - ((totalIn - 1) * spacing) / 2 + idx * spacing - 14;
            return (
              <g key={inp.label}>
                <rect
                  x={10}
                  y={y0}
                  width={118}
                  height={28}
                  rx={5}
                  fill="#0f172a"
                  stroke={inp.color}
                  strokeWidth={1.4}
                />
                <text
                  x={69}
                  y={y0 + 12}
                  textAnchor="middle"
                  fill={inp.color}
                  fontSize={8.3}
                  fontWeight={800}
                >
                  {inp.label}
                </text>
                <text
                  x={69}
                  y={y0 + 22}
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize={7.8}
                >
                  {inp.shape}
                </text>
                <path
                  d={`M 128 ${y0 + 14} C 138 ${y0 + 14}, 138 ${svgH / 2}, ${startX} ${svgH / 2}`}
                  fill="none"
                  stroke={inp.color}
                  strokeWidth={1.5}
                />
              </g>
            );
          })}

          {/* 4 Pipeline Stages */}
          {head.stages.map((st, sIdx) => {
            const x = startX + sIdx * stepX;
            const y = (svgH - boxH) / 2;
            return (
              <g key={st.name}>
                {sIdx > 0 && (
                  <g>
                    <line
                      x1={x - (stepX - boxW)}
                      y1={svgH / 2}
                      x2={x}
                      y2={svgH / 2}
                      stroke={head.border}
                      strokeWidth={1.8}
                    />
                    <polygon
                      points={`${x},${svgH / 2} ${x - 5},${svgH / 2 - 3.5} ${x - 5},${svgH / 2 + 3.5}`}
                      fill={head.border}
                    />
                  </g>
                )}
                <rect
                  x={x}
                  y={y}
                  width={boxW}
                  height={boxH}
                  rx={7}
                  fill="#101b30"
                  stroke={sIdx === head.stages.length - 1 ? head.border : '#334b73'}
                  strokeWidth={sIdx === head.stages.length - 1 ? 2.0 : 1.3}
                />
                <rect
                  x={x}
                  y={y}
                  width={boxW}
                  height={18}
                  rx={6}
                  fill={st.color}
                  fillOpacity={0.85}
                />
                <text
                  x={x + boxW / 2}
                  y={y + 12.5}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize={8.6}
                  fontWeight={800}
                >
                  {sIdx + 1}. {st.name}
                </text>
                <text
                  x={x + boxW / 2}
                  y={y + 33}
                  textAnchor="middle"
                  fill="#fde047"
                  fontSize={8.2}
                  fontWeight={700}
                >
                  {st.op}
                </text>
                <text
                  x={x + boxW / 2}
                  y={y + 48}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize={8.0}
                  fontWeight={700}
                >
                  {st.inShape} → {st.outShape}
                </text>
                <text
                  x={x + boxW / 2}
                  y={y + 66}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize={7.3}
                >
                  {st.detail.length > 42 ? `${st.detail.slice(0, 42)}…` : st.detail}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="arch-head-meta-footer">
          <span>
            <strong>Equation:</strong> <code>{head.formula}</code>
          </span>
          <span>
            <strong>Masking:</strong> {head.maskRule}
          </span>
          <span>
            <strong>PPO Objective Weight:</strong> <code>{head.entropyWeight}</code>
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
                ⊞ Split All 5 Heads
              </button>
              {HEAD_PIPELINES.map((hp) => (
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

            {(headFilter === 'all' || vizMode === 'torchview') && (
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
            )}
          </div>

          {vizMode === 'schematic' && headFilter === 'all' && renderUnifiedNetworkSvg()}

          {vizMode === 'schematic' && headFilter === 'split_all' && (
            <div className="arch-heads-split-grid">
              {HEAD_PIPELINES.map((hp) => renderSingleHeadCard(hp, true))}
            </div>
          )}

          {vizMode === 'schematic' &&
            headFilter !== 'all' &&
            headFilter !== 'split_all' && (
              <div className="arch-heads-single-focus">
                {HEAD_PIPELINES.filter((hp) => hp.id === headFilter).map((hp) =>
                  renderSingleHeadCard(hp, false)
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
