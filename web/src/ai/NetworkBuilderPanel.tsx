import React, { useState } from 'react';
import { getArchitectureSvgUrl } from './aiClient';

interface StaticLayerRow {
  id: string;
  stage: 'spatial' | 'global' | 'heads';
  type: string;
  short: string;
  desc: string;
  inputShape: number[];
  outputShape: number[];
  receptiveField: number;
  params: number;
  macs: number;
  color: string;
  border: string;
  coneLabel?: string;
  hasSkipArc?: boolean;
}

const STATIC_LAYERS: StaticLayerRow[] = [
  {
    id: 's1',
    stage: 'spatial',
    type: 'Conv2d + GroupNorm + SiLU',
    short: 'Conv2d',
    desc: '32 filters, 3×3, s=1, p=1, GroupNorm(4), SiLU',
    inputShape: [8, 50, 50],
    outputShape: [32, 50, 50],
    receptiveField: 3,
    params: 2368,
    macs: 5760000,
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

const TOTAL_PARAMS = 908531;
const TOTAL_MACS = 336227288;
const ESTIMATED_VRAM_MB = 10.4;
const SPATIAL_PCT = 10;
const GLOBAL_PCT = 76;
const HEAD_PCT = 14;

const PYTORCH_MODEL_CODE = `class CoCSpatialEncoder(nn.Module):
    def __init__(self, in_channels: int = 8, spatial_dim: int = 64, embed_dim: int = 256):
        super().__init__()
        # Stage 1: Full-resolution 50x50 stem
        self.spatial_stem = nn.Sequential(
            nn.Conv2d(in_channels, 32, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(4, 32),
            nn.SiLU(),
            nn.Conv2d(32, spatial_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, spatial_dim),
            nn.SiLU(),
        )
        # Stage 2: Dilated 3x3 residual block (receptive field 11x11)
        self.context_res = nn.Sequential(
            nn.Conv2d(spatial_dim, spatial_dim, kernel_size=3, padding=2, dilation=2, bias=False),
            nn.GroupNorm(8, spatial_dim),
            nn.SiLU(),
            nn.Conv2d(spatial_dim, spatial_dim, kernel_size=3, padding=1, bias=False),
            nn.GroupNorm(8, spatial_dim),
        )
        # Stage 3: Strided downsampling pyramid (50x50 -> 25x25 -> 13x13 -> 4x4 -> 256-D)
        self.global_tower = nn.Sequential(
            nn.Conv2d(spatial_dim, 96, kernel_size=3, stride=2, padding=1),
            nn.SiLU(),
            nn.Conv2d(96, 128, kernel_size=3, stride=2, padding=1),
            nn.SiLU(),
            nn.AdaptiveAvgPool2d((4, 4)),
            nn.Flatten(),
            nn.Linear(128 * 4 * 4, embed_dim),
            nn.LayerNorm(embed_dim),
            nn.SiLU(),
        )

    def forward(self, obs: torch.Tensor):
        h = self.spatial_stem(obs)
        spatial_features = F.silu(h + self.context_res(h))
        global_embedding = self.global_tower(spatial_features)
        return spatial_features, global_embedding


class CoCActorCritic(nn.Module):
    def __init__(self, in_channels: int = 8, army_context_dim: int = 64):
        super().__init__()
        self.encoder = CoCSpatialEncoder(in_channels, spatial_dim=64, embed_dim=256)
        self.army_context_proj = nn.Sequential(
            nn.Linear(army_context_dim, 256), nn.LayerNorm(256), nn.SiLU()
        )
        self.slot_type_head = nn.Linear(256, 7)
        self.slot_idx_head = nn.Sequential(
            nn.Linear(256 + 7, 128), nn.SiLU(), nn.Linear(128, 10)
        )
        self.tile_cond_proj = nn.Linear(256 + 7, 64)
        self.tile_conv_head = nn.Sequential(
            nn.Conv2d(64, 32, kernel_size=3, padding=1),
            nn.SiLU(),
            nn.Conv2d(32, 1, kernel_size=1),
        )
        self.critic_head = nn.Sequential(
            nn.Linear(256, 128), nn.SiLU(), nn.Linear(128, 1)
        )`;

interface NetworkBuilderPanelProps {
  serverOnline: boolean;
}

export const NetworkBuilderPanel: React.FC<NetworkBuilderPanelProps> = ({
  serverOnline,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [vizMode, setVizMode] = useState<'cnn3d' | 'torchview'>('cnn3d');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>('s1');
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [torchviewDetail, setTorchviewDetail] = useState<'overview' | 'detailed'>('overview');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const spatialLayers = STATIC_LAYERS.filter((l) => l.stage === 'spatial');
  const globalLayers = STATIC_LAYERS.filter((l) => l.stage === 'global');
  const hoveredSummary = STATIC_LAYERS.find((l) => l.id === hoveredBlockId) ?? null;

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

          {/* 0. Input Volume: obs (8×50×50) */}
          {drawCuboid({
            key: 'input_obs',
            cx: startX,
            cy: stemY,
            c: 8,
            h: 50,
            w: 50,
            color: '#0284c7',
            borderColor: '#38bdf8',
            topLabel: 'Input Grid',
            shapeLabel: '8×50×50',
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
                <g transform={`translate(${headsX - 36}, ${topBranchY - 58})`}>
                  <rect
                    width={118}
                    height={34}
                    rx={6}
                    fill="#1e293b"
                    stroke="#facc15"
                    strokeWidth={1.5}
                  />
                  <text x={59} y={15} textAnchor="middle" fill="#fde047" fontSize={9.5} fontWeight={800}>
                    Action Type (7)
                  </text>
                  <text x={59} y={27} textAnchor="middle" fill="#cbd5e1" fontSize={8.5}>
                    NoOp / Troop / Spell...
                  </text>

                  <rect
                    y={42}
                    width={118}
                    height={34}
                    rx={6}
                    fill="#1e293b"
                    stroke="#38bdf8"
                    strokeWidth={1.5}
                  />
                  <text x={59} y={57} textAnchor="middle" fill="#38bdf8" fontSize={9.5} fontWeight={800}>
                    Slot Index (10)
                  </text>
                  <text x={59} y={69} textAnchor="middle" fill="#cbd5e1" fontSize={8.5}>
                    Conditioned on Type
                  </text>

                  <rect
                    y={84}
                    width={118}
                    height={34}
                    rx={6}
                    fill="#1e293b"
                    stroke="#4ade80"
                    strokeWidth={1.5}
                  />
                  <text x={59} y={99} textAnchor="middle" fill="#4ade80" fontSize={9.5} fontWeight={800}>
                    Critic Value V(s) (1)
                  </text>
                  <text x={59} y={111} textAnchor="middle" fill="#cbd5e1" fontSize={8.5}>
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
            <span>Spatial Map</span>
            <strong>64×50×50 (RF 11×11)</strong>
          </div>
          <div className="arch-pill">
            <span>Global Emb</span>
            <strong>256D</strong>
          </div>
          <div className="arch-pill">
            <span>Parameters</span>
            <strong style={{ color: '#facc15' }}>
              {TOTAL_PARAMS.toLocaleString()}
            </strong>
          </div>
          <div className="arch-pill">
            <span>Compute / Size</span>
            <strong>
              {(TOTAL_MACS / 1e6).toFixed(1)}M MACs • {ESTIMATED_VRAM_MB} MB
            </strong>
          </div>
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
                    src={getArchitectureSvgUrl(torchviewDetail)}
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
                  Layer-by-Layer Architecture ({STATIC_LAYERS.length} Blocks •{' '}
                  {TOTAL_PARAMS.toLocaleString()} Params)
                </strong>
                <div className="arch-footer-param-bar-wrap">
                  <div className="ai-stacked-bar" style={{ height: 8, width: 140 }}>
                    <div style={{ width: `${SPATIAL_PCT}%`, background: '#3b82f6' }} />
                    <div style={{ width: `${GLOBAL_PCT}%`, background: '#10b981' }} />
                    <div style={{ width: `${HEAD_PCT}%`, background: '#facc15' }} />
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    Stem {SPATIAL_PCT}% • Tower {GLOBAL_PCT}% • Heads {HEAD_PCT}%
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
                  {STATIC_LAYERS.map((row) => (
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

            <div className="arch-code-pane">
              <div className="arch-code-header">
                <strong>PyTorch `nn.Module` Implementation</strong>
                <button
                  type="button"
                  className="speed-pill-btn active"
                  onClick={() => {
                    navigator.clipboard?.writeText(PYTORCH_MODEL_CODE);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                >
                  {copiedCode ? '✓ Copied' : '📋 Copy PyTorch Code'}
                </button>
              </div>
              <pre className="arch-code-pre">{PYTORCH_MODEL_CODE}</pre>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
