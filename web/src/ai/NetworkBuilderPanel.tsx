import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivationType,
  AnalyzedLayerSummary,
  ArchitectureAnalysisResult,
  ArchitectureConfig,
  LayerBlockType,
  NetworkBlockConfig,
  NormType,
} from './aiTypes';
import { previewCustomArchitecture } from './aiClient';

export const DEFAULT_ARCHITECTURE_CONFIG: ArchitectureConfig = {
  preset_id: 'default_th18_resnet',
  name: 'TH18 Dual-Pathway ResNet (Default)',
  spatial_blocks: [
    {
      id: 's1',
      type: 'conv2d',
      filters: 32,
      kernel_size: 3,
      stride: 1,
      padding: 1,
      dilation: 1,
      norm: 'group',
      activation: 'silu',
      bias: false,
    },
    {
      id: 's2',
      type: 'conv2d',
      filters: 64,
      kernel_size: 3,
      stride: 1,
      padding: 1,
      dilation: 1,
      norm: 'group',
      activation: 'silu',
      bias: false,
    },
    {
      id: 's3',
      type: 'resblock2d',
      filters: 64,
      kernel_size: 3,
      stride: 1,
      padding: 2,
      dilation: 2,
      norm: 'group',
      activation: 'silu',
      bias: false,
    },
  ],
  global_blocks: [
    {
      id: 'g1',
      type: 'conv2d',
      filters: 96,
      kernel_size: 3,
      stride: 2,
      padding: 1,
      dilation: 1,
      norm: 'none',
      activation: 'silu',
      bias: true,
    },
    {
      id: 'g2',
      type: 'conv2d',
      filters: 128,
      kernel_size: 3,
      stride: 2,
      padding: 1,
      dilation: 1,
      norm: 'none',
      activation: 'silu',
      bias: true,
    },
    {
      id: 'g3',
      type: 'adaptive_avgpool2d',
      pool_size: 4,
    },
    {
      id: 'g4',
      type: 'flatten',
    },
    {
      id: 'g5',
      type: 'linear',
      units: 256,
      norm: 'layer',
      activation: 'silu',
      dropout: 0.0,
      bias: true,
    },
  ],
  heads: {
    tile_head_filters: 32,
    tile_head_kernel: 3,
    head_hidden_dim: 128,
    head_activation: 'silu',
  },
};

export const ARCHITECTURE_PRESETS: ArchitectureConfig[] = [
  DEFAULT_ARCHITECTURE_CONFIG,
  {
    preset_id: 'lightweight_fast_cnn',
    name: 'Lightweight Fast CNN',
    spatial_blocks: [
      {
        id: 's1',
        type: 'conv2d',
        filters: 24,
        kernel_size: 3,
        stride: 1,
        padding: 1,
        dilation: 1,
        norm: 'group',
        activation: 'silu',
        bias: false,
      },
      {
        id: 's2',
        type: 'conv2d',
        filters: 32,
        kernel_size: 3,
        stride: 1,
        padding: 1,
        dilation: 1,
        norm: 'group',
        activation: 'silu',
        bias: false,
      },
    ],
    global_blocks: [
      {
        id: 'g1',
        type: 'conv2d',
        filters: 64,
        kernel_size: 3,
        stride: 2,
        padding: 1,
        dilation: 1,
        norm: 'none',
        activation: 'silu',
        bias: true,
      },
      {
        id: 'g2',
        type: 'adaptive_avgpool2d',
        pool_size: 4,
      },
      {
        id: 'g3',
        type: 'flatten',
      },
      {
        id: 'g4',
        type: 'linear',
        units: 128,
        norm: 'layer',
        activation: 'silu',
        dropout: 0.0,
        bias: true,
      },
    ],
    heads: {
      tile_head_filters: 16,
      tile_head_kernel: 3,
      head_hidden_dim: 64,
      head_activation: 'silu',
    },
  },
  {
    preset_id: 'deep_se_resnet',
    name: 'Deep Dilated SE-ResNet',
    spatial_blocks: [
      {
        id: 's1',
        type: 'conv2d',
        filters: 32,
        kernel_size: 3,
        stride: 1,
        padding: 1,
        dilation: 1,
        norm: 'group',
        activation: 'silu',
        bias: false,
      },
      {
        id: 's2',
        type: 'resblock2d',
        filters: 64,
        kernel_size: 3,
        stride: 1,
        padding: 1,
        dilation: 1,
        norm: 'group',
        activation: 'silu',
        bias: false,
      },
      {
        id: 's3',
        type: 'resblock2d',
        filters: 64,
        kernel_size: 3,
        stride: 1,
        padding: 2,
        dilation: 2,
        norm: 'group',
        activation: 'silu',
        bias: false,
      },
      {
        id: 's4',
        type: 'se_block2d',
        reduction: 4,
        activation: 'silu',
      },
      {
        id: 's5',
        type: 'resblock2d',
        filters: 96,
        kernel_size: 3,
        stride: 1,
        padding: 3,
        dilation: 3,
        norm: 'group',
        activation: 'silu',
        bias: false,
      },
    ],
    global_blocks: [
      {
        id: 'g1',
        type: 'conv2d',
        filters: 128,
        kernel_size: 3,
        stride: 2,
        padding: 1,
        dilation: 1,
        norm: 'group',
        activation: 'silu',
        bias: false,
      },
      {
        id: 'g2',
        type: 'resblock2d',
        filters: 128,
        kernel_size: 3,
        stride: 2,
        padding: 1,
        dilation: 1,
        norm: 'group',
        activation: 'silu',
        bias: false,
      },
      {
        id: 'g3',
        type: 'adaptive_avgpool2d',
        pool_size: 4,
      },
      {
        id: 'g4',
        type: 'flatten',
      },
      {
        id: 'g5',
        type: 'linear',
        units: 256,
        norm: 'layer',
        activation: 'silu',
        dropout: 0.0,
        bias: true,
      },
    ],
    heads: {
      tile_head_filters: 48,
      tile_head_kernel: 3,
      head_hidden_dim: 128,
      head_activation: 'silu',
    },
  },
  {
    preset_id: 'convnext_dwsep',
    name: 'ConvNeXt Depthwise-Separable',
    spatial_blocks: [
      {
        id: 's1',
        type: 'conv2d',
        filters: 32,
        kernel_size: 3,
        stride: 1,
        padding: 1,
        dilation: 1,
        norm: 'layer',
        activation: 'gelu',
        bias: false,
      },
      {
        id: 's2',
        type: 'dwsep_conv2d',
        filters: 64,
        kernel_size: 5,
        stride: 1,
        padding: 2,
        dilation: 1,
        norm: 'layer',
        activation: 'gelu',
        bias: false,
      },
      {
        id: 's3',
        type: 'dwsep_conv2d',
        filters: 64,
        kernel_size: 7,
        stride: 1,
        padding: 3,
        dilation: 1,
        norm: 'layer',
        activation: 'gelu',
        bias: false,
      },
      {
        id: 's4',
        type: 'se_block2d',
        reduction: 4,
        activation: 'gelu',
      },
    ],
    global_blocks: [
      {
        id: 'g1',
        type: 'dwsep_conv2d',
        filters: 96,
        kernel_size: 5,
        stride: 2,
        padding: 2,
        dilation: 1,
        norm: 'layer',
        activation: 'gelu',
        bias: false,
      },
      {
        id: 'g2',
        type: 'dwsep_conv2d',
        filters: 128,
        kernel_size: 3,
        stride: 2,
        padding: 1,
        dilation: 1,
        norm: 'layer',
        activation: 'gelu',
        bias: false,
      },
      {
        id: 'g3',
        type: 'adaptive_avgpool2d',
        pool_size: 4,
      },
      {
        id: 'g4',
        type: 'flatten',
      },
      {
        id: 'g5',
        type: 'linear',
        units: 256,
        norm: 'layer',
        activation: 'gelu',
        dropout: 0.0,
        bias: true,
      },
    ],
    heads: {
      tile_head_filters: 32,
      tile_head_kernel: 3,
      head_hidden_dim: 128,
      head_activation: 'gelu',
    },
  },
  {
    preset_id: 'alexnet_classic',
    name: 'Classic Conv + MaxPool Stack',
    spatial_blocks: [
      {
        id: 's1',
        type: 'conv2d',
        filters: 32,
        kernel_size: 5,
        stride: 1,
        padding: 2,
        dilation: 1,
        norm: 'batch',
        activation: 'relu',
        bias: false,
      },
      {
        id: 's2',
        type: 'conv2d',
        filters: 64,
        kernel_size: 3,
        stride: 1,
        padding: 1,
        dilation: 1,
        norm: 'batch',
        activation: 'relu',
        bias: false,
      },
    ],
    global_blocks: [
      {
        id: 'g1',
        type: 'maxpool2d',
        kernel_size: 2,
        stride: 2,
        padding: 0,
      },
      {
        id: 'g2',
        type: 'conv2d',
        filters: 96,
        kernel_size: 3,
        stride: 1,
        padding: 1,
        dilation: 1,
        norm: 'batch',
        activation: 'relu',
        bias: false,
      },
      {
        id: 'g3',
        type: 'maxpool2d',
        kernel_size: 2,
        stride: 2,
        padding: 0,
      },
      {
        id: 'g4',
        type: 'conv2d',
        filters: 128,
        kernel_size: 3,
        stride: 1,
        padding: 1,
        dilation: 1,
        norm: 'batch',
        activation: 'relu',
        bias: false,
      },
      {
        id: 'g5',
        type: 'adaptive_avgpool2d',
        pool_size: 4,
      },
      {
        id: 'g6',
        type: 'flatten',
      },
      {
        id: 'g7',
        type: 'linear',
        units: 256,
        norm: 'layer',
        activation: 'relu',
        dropout: 0.1,
        bias: true,
      },
    ],
    heads: {
      tile_head_filters: 32,
      tile_head_kernel: 3,
      head_hidden_dim: 128,
      head_activation: 'relu',
    },
  },
];

const LAYER_META: Record<
  LayerBlockType,
  { label: string; short: string; color: string; border: string }
> = {
  conv2d: { label: 'Conv2d', short: 'Conv', color: '#3b82f6', border: '#60a5fa' },
  resblock2d: {
    label: 'ResBlock2d (Skip+)',
    short: 'ResBlock',
    color: '#f59e0b',
    border: '#fbbf24',
  },
  dwsep_conv2d: {
    label: 'Depthwise-Sep Conv2d',
    short: 'SepConv',
    color: '#a855f7',
    border: '#c084fc',
  },
  se_block2d: {
    label: 'SE Channel Attention',
    short: 'SE-Attn',
    color: '#ec4899',
    border: '#f472b6',
  },
  maxpool2d: {
    label: 'MaxPool2d',
    short: 'MaxPool',
    color: '#ef4444',
    border: '#f87171',
  },
  avgpool2d: {
    label: 'AvgPool2d',
    short: 'AvgPool',
    color: '#f97316',
    border: '#fb923c',
  },
  adaptive_avgpool2d: {
    label: 'AdaptiveAvgPool2d',
    short: 'AdapAvgPool',
    color: '#ea580c',
    border: '#fb923c',
  },
  adaptive_maxpool2d: {
    label: 'AdaptiveMaxPool2d',
    short: 'AdapMaxPool',
    color: '#dc2626',
    border: '#f87171',
  },
  dropout2d: {
    label: 'Spatial Dropout2d',
    short: 'Dropout2d',
    color: '#64748b',
    border: '#94a3b8',
  },
  flatten: {
    label: 'Flatten (3D → 1D)',
    short: 'Flatten',
    color: '#06b6d4',
    border: '#22d3ee',
  },
  linear: {
    label: 'Linear (Dense)',
    short: 'Linear',
    color: '#10b981',
    border: '#34d399',
  },
};

function safeConvPad(hIn: number, k: number, _s: number, p: number, d: number): number {
  const effK = d * (k - 1) + 1;
  if (hIn + 2 * p < effK) {
    return Math.max(p, Math.ceil((effK - hIn) / 2));
  }
  return p;
}

function convOutDim(hIn: number, k: number, s: number, p: number, d = 1): number {
  const effK = d * (k - 1) + 1;
  const pSafe = safeConvPad(hIn, k, s, p, d);
  return Math.max(1, Math.floor((hIn + 2 * pSafe - effK) / Math.max(1, s)) + 1);
}

export function analyzeArchitectureLocal(
  cfg: ArchitectureConfig,
  inChannels = 8,
  gridSize = 50,
  armyContextDim = 64
): ArchitectureAnalysisResult {
  let cCur = inChannels;
  let hCur = gridSize;
  let wCur = gridSize;
  let rf = 1;
  let jump = 1;
  let totalMacs = 0;
  let totalParams = 0;

  const layersSummary: AnalyzedLayerSummary[] = [];
  const codeLines: string[] = [
    'class CustomCoCActorCritic(nn.Module):',
    '  def __init__(self, in_channels=8, army_context_dim=64):',
    '    super().__init__()',
    '    # 1. Spatial CNN Stem (8×50×50 → Spatial Features)',
    '    self.spatial_stem = nn.Sequential(',
  ];

  const trace2D = (idx: number, stage: 'spatial' | 'global', b: NetworkBlockConfig) => {
    const btype = b.type;
    const inShape = [cCur, hCur, wCur];
    let params = 0;
    let macs = 0;
    let desc = '';
    let pyLine = '';

    if (btype === 'conv2d') {
      const cOut = Math.max(4, Math.min(512, b.filters ?? 64));
      const k = Math.max(1, Math.min(9, b.kernel_size ?? 3));
      const s = Math.max(1, Math.min(4, b.stride ?? 1));
      const p = Math.max(0, Math.min(8, b.padding ?? 1));
      const d = Math.max(1, Math.min(4, b.dilation ?? 1));
      const norm = b.norm ?? 'none';
      const act = b.activation ?? 'silu';
      const bias = b.bias ?? norm === 'none';
      const pSafe = safeConvPad(Math.min(hCur, wCur), k, s, p, d);
      const hOut = convOutDim(hCur, k, s, pSafe, d);
      const wOut = convOutDim(wCur, k, s, pSafe, d);

      const wParams = cCur * cOut * k * k + (bias ? cOut : 0);
      const nParams = norm !== 'none' ? 2 * cOut : 0;
      params = wParams + nParams;
      macs = cCur * cOut * k * k * hOut * wOut;

      const effK = d * (k - 1) + 1;
      rf += (effK - 1) * jump;
      jump *= s;
      pyLine = `      nn.Conv2d(${cCur}, ${cOut}, kernel_size=${k}, stride=${s}, padding=${pSafe}${d > 1 ? `, dilation=${d}` : ''}, bias=${bias ? 'True' : 'False'}),` +
        (norm !== 'none' ? ` # + ${norm.toUpperCase()}Norm + ${act.toUpperCase()}` : ` # + ${act.toUpperCase()}`);
      cCur = cOut;
      hCur = hOut;
      wCur = wOut;
      desc = `${cOut} filters, ${k}×${k}, s=${s}, p=${pSafe}${d > 1 ? `, d=${d}` : ''}, norm=${norm}, act=${act}`;
    } else if (btype === 'resblock2d') {
      const cOut = Math.max(4, Math.min(512, b.filters ?? cCur));
      const k = Math.max(1, Math.min(9, b.kernel_size ?? 3));
      const s = Math.max(1, Math.min(4, b.stride ?? 1));
      const d = Math.max(1, Math.min(4, b.dilation ?? 1));
      const p = Math.max(0, Math.min(8, b.padding ?? Math.floor((d * (k - 1)) / 2)));
      const norm = b.norm ?? 'group';
      const act = b.activation ?? 'silu';
      const bias = b.bias ?? false;
      const pSafe = safeConvPad(Math.min(hCur, wCur), k, s, p, d);
      const hOut = convOutDim(hCur, k, s, pSafe, d);
      const wOut = convOutDim(wCur, k, s, pSafe, d);

      const nParams = norm !== 'none' ? 2 * cOut : 0;
      const conv1P = cCur * cOut * k * k + (bias ? cOut : 0) + nParams;
      const conv2P = cOut * cOut * k * k + (bias ? cOut : 0) + nParams;
      const scP = cCur !== cOut || s !== 1 ? cCur * cOut + nParams : 0;
      params = conv1P + conv2P + scP;
      macs = (cCur * cOut * k * k + cOut * cOut * k * k) * hOut * wOut;

      const effK1 = d * (k - 1) + 1;
      rf += (effK1 - 1) * jump;
      jump *= s;
      rf += (k - 1) * jump;
      pyLine = `      ResidualConvBlock2d(${cCur}, ${cOut}, kernel_size=${k}, stride=${s}, padding=${pSafe}, dilation=${d}, norm="${norm}", act="${act}"),`;
      cCur = cOut;
      hCur = hOut;
      wCur = wOut;
      desc = `2×Conv ${cOut} ch, ${k}×${k}, s=${s}, p=${pSafe}${d > 1 ? `, d=${d}` : ''}, skip+, ${norm}, ${act}`;
    } else if (btype === 'dwsep_conv2d') {
      const cOut = Math.max(4, Math.min(512, b.filters ?? 64));
      const k = Math.max(1, Math.min(9, b.kernel_size ?? 3));
      const s = Math.max(1, Math.min(4, b.stride ?? 1));
      const p = Math.max(0, Math.min(8, b.padding ?? Math.floor((k - 1) / 2)));
      const d = Math.max(1, Math.min(4, b.dilation ?? 1));
      const norm = b.norm ?? 'group';
      const act = b.activation ?? 'silu';
      const bias = b.bias ?? false;
      const pSafe = safeConvPad(Math.min(hCur, wCur), k, s, p, d);
      const hOut = convOutDim(hCur, k, s, pSafe, d);
      const wOut = convOutDim(wCur, k, s, pSafe, d);

      const dwP = cCur * k * k;
      const pwP = cCur * cOut + (bias ? cOut : 0);
      const nP = norm !== 'none' ? 2 * cOut : 0;
      params = dwP + pwP + nP;
      macs = (cCur * k * k + cCur * cOut) * hOut * wOut;

      const effK = d * (k - 1) + 1;
      rf += (effK - 1) * jump;
      jump *= s;
      pyLine = `      DepthwiseSeparableConv2d(${cCur}, ${cOut}, kernel_size=${k}, stride=${s}, padding=${pSafe}, norm="${norm}", act="${act}"),`;
      cCur = cOut;
      hCur = hOut;
      wCur = wOut;
      desc = `DW ${k}×${k} + PW 1×1 → ${cOut} ch, s=${s}, p=${pSafe}, ${norm}, ${act}`;
    } else if (btype === 'se_block2d') {
      const red = Math.max(1, Math.min(16, b.reduction ?? 4));
      const act = b.activation ?? 'silu';
      const mid = Math.max(4, Math.floor(cCur / red));
      params = 2 * cCur * mid + cCur + mid;
      macs = 2 * cCur * mid;
      pyLine = `      SEAttentionBlock2d(channels=${cCur}, reduction=${red}, act="${act}"),`;
      desc = `SE Attention ÷${red} (${cCur}→${mid}→${cCur} ch, ${act})`;
    } else if (btype === 'maxpool2d' || btype === 'avgpool2d') {
      const k = Math.max(1, Math.min(8, b.kernel_size ?? 2));
      const s = Math.max(1, Math.min(8, b.stride ?? 2));
      const p = Math.max(0, Math.min(4, b.padding ?? 0));
      const pSafe = safeConvPad(Math.min(hCur, wCur), k, s, p, 1);
      const hOut = convOutDim(hCur, k, s, pSafe, 1);
      const wOut = convOutDim(wCur, k, s, pSafe, 1);
      rf += (k - 1) * jump;
      jump *= s;
      hCur = hOut;
      wCur = wOut;
      const clsName = btype === 'maxpool2d' ? 'MaxPool2d' : 'AvgPool2d';
      pyLine = `      nn.${clsName}(kernel_size=${k}, stride=${s}, padding=${pSafe}),`;
      desc = `${clsName} ${k}×${k}, stride=${s}, pad=${pSafe}`;
    } else if (btype === 'adaptive_avgpool2d' || btype === 'adaptive_maxpool2d') {
      const ps = Math.max(1, Math.min(16, b.pool_size ?? 4));
      hCur = ps;
      wCur = ps;
      rf = gridSize;
      const clsName =
        btype === 'adaptive_avgpool2d' ? 'AdaptiveAvgPool2d' : 'AdaptiveMaxPool2d';
      pyLine = `      nn.${clsName}((${ps}, ${ps})),`;
      desc = `${clsName} → ${ps}×${ps} grid`;
    } else if (btype === 'dropout2d') {
      const drop = b.dropout ?? 0.1;
      pyLine = `      nn.Dropout2d(p=${drop}),`;
      desc = `Dropout2d p=${drop}`;
    }

    totalParams += params;
    totalMacs += macs;
    codeLines.push(pyLine);
    layersSummary.push({
      id: b.id || `${stage}_${idx}`,
      stage,
      type: btype,
      desc,
      input_shape: inShape,
      output_shape: [cCur, hCur, wCur],
      receptive_field: Math.min(gridSize, rf),
      params,
      macs,
    });
  };

  cfg.spatial_blocks.forEach((b, idx) => {
    if (b.type !== 'flatten' && b.type !== 'linear') {
      trace2D(idx, 'spatial', b);
    }
  });

  const spatialOutShape = [cCur, hCur, wCur];
  const spatialRf = Math.min(gridSize, rf);
  const spatialDim = cCur;

  codeLines.push('    )');
  codeLines.push('    # 2. Global Encoder Tower (Spatial Features → Global Embedding)');
  codeLines.push('    self.global_tower = nn.Sequential(');

  const twoDG = cfg.global_blocks.filter(
    (b) => b.type !== 'flatten' && b.type !== 'linear'
  );
  const oneDG = cfg.global_blocks.filter(
    (b) => b.type === 'flatten' || b.type === 'linear'
  );

  twoDG.forEach((b, idx) => trace2D(idx, 'global', b));

  let isFlat = false;
  let flatDim = cCur * hCur * wCur;

  oneDG.forEach((b, idx) => {
    if (b.type === 'flatten') {
      if (!isFlat) {
        isFlat = true;
        flatDim = cCur * hCur * wCur;
        codeLines.push('      nn.Flatten(),');
        layersSummary.push({
          id: b.id || `g_flat_${idx}`,
          stage: 'global',
          type: 'flatten',
          desc: `Flatten ${cCur}×${hCur}×${wCur} → ${flatDim}`,
          input_shape: [cCur, hCur, wCur],
          output_shape: [flatDim],
          receptive_field: gridSize,
          params: 0,
          macs: 0,
        });
      }
    } else if (b.type === 'linear') {
      if (!isFlat) {
        isFlat = true;
        flatDim = cCur * hCur * wCur;
        codeLines.push('      nn.Flatten(),');
        layersSummary.push({
          id: `auto_flat_${idx}`,
          stage: 'global',
          type: 'flatten',
          desc: `Auto-Flatten ${cCur}×${hCur}×${wCur} → ${flatDim}`,
          input_shape: [cCur, hCur, wCur],
          output_shape: [flatDim],
          receptive_field: gridSize,
          params: 0,
          macs: 0,
        });
      }
      const units = Math.max(16, Math.min(1024, b.units ?? 256));
      const norm = b.norm ?? 'layer';
      const act = b.activation ?? 'silu';
      const drop = b.dropout ?? 0.0;
      const bias = b.bias ?? true;
      const pCnt =
        flatDim * units +
        (bias ? units : 0) +
        (norm === 'layer' || norm === 'batch' ? 2 * units : 0);
      const macs = flatDim * units;
      totalParams += pCnt;
      totalMacs += macs;
      codeLines.push(
        `      nn.Linear(${flatDim}, ${units}, bias=${bias ? 'True' : 'False'}), # + ${norm}Norm + ${act}${drop > 0 ? ` + Dropout(${drop})` : ''}`
      );
      layersSummary.push({
        id: b.id || `g_lin_${idx}`,
        stage: 'global',
        type: 'linear',
        desc: `Linear ${flatDim} → ${units}, norm=${norm}, act=${act}${drop > 0 ? `, drop=${drop}` : ''}`,
        input_shape: [flatDim],
        output_shape: [units],
        receptive_field: gridSize,
        params: pCnt,
        macs,
      });
      flatDim = units;
    }
  });

  if (!isFlat) {
    const ps = Math.min(4, hCur, wCur);
    flatDim = cCur * ps * ps;
    const pCnt = flatDim * 256 + 256 + 512;
    totalParams += pCnt;
    totalMacs += flatDim * 256;
    codeLines.push(`      nn.AdaptiveAvgPool2d((${ps}, ${ps})),`);
    codeLines.push('      nn.Flatten(),');
    codeLines.push(`      nn.Linear(${flatDim}, 256),`);
    layersSummary.push({
      id: 'auto_tail_linear',
      stage: 'global',
      type: 'linear',
      desc: `Auto Pool(${ps}×${ps}) + Flatten + Linear(${flatDim} → 256)`,
      input_shape: [cCur, hCur, wCur],
      output_shape: [256],
      receptive_field: gridSize,
      params: pCnt,
      macs: flatDim * 256,
    });
    flatDim = 256;
  }

  codeLines.push('    )');

  const embedDim = flatDim;
  const tileFilters = cfg.heads.tile_head_filters ?? 32;
  const tileKernel = cfg.heads.tile_head_kernel ?? 3;
  const headHidden = cfg.heads.head_hidden_dim ?? 128;
  const headAct = cfg.heads.head_activation ?? 'silu';

  const armyProjParams = armyContextDim * embedDim + embedDim + 2 * embedDim;
  const slotTypeParams = embedDim * 7 + 7;
  const slotIdxParams =
    (embedDim + 7) * headHidden + headHidden + headHidden * 10 + 10;
  const tileCondParams = (embedDim + 7) * spatialDim + spatialDim;
  const tileConvParams =
    spatialDim * tileFilters * tileKernel * tileKernel +
    tileFilters +
    tileFilters * 1 +
    1;
  const criticParams = embedDim * headHidden + headHidden + headHidden * 1 + 1;

  const headSummaries: AnalyzedLayerSummary[] = [
    {
      id: 'head_army_ctx',
      stage: 'heads',
      type: 'army_context_proj',
      desc: `Linear(${armyContextDim} → ${embedDim}) + LayerNorm + ${headAct}`,
      input_shape: [armyContextDim],
      output_shape: [embedDim],
      receptive_field: gridSize,
      params: armyProjParams,
      macs: armyContextDim * embedDim,
    },
    {
      id: 'head_slot_type',
      stage: 'heads',
      type: 'slot_type_head',
      desc: `Linear(${embedDim} → 7 Action Types)`,
      input_shape: [embedDim],
      output_shape: [7],
      receptive_field: gridSize,
      params: slotTypeParams,
      macs: embedDim * 7,
    },
    {
      id: 'head_slot_idx',
      stage: 'heads',
      type: 'slot_idx_head',
      desc: `MLP(${embedDim + 7} → ${headHidden} → 10 Slots, ${headAct})`,
      input_shape: [embedDim + 7],
      output_shape: [10],
      receptive_field: gridSize,
      params: slotIdxParams,
      macs: (embedDim + 7) * headHidden + headHidden * 10,
    },
    {
      id: 'head_tile_conv',
      stage: 'heads',
      type: 'tile_conv_head',
      desc: `Cond(${embedDim + 7}→${spatialDim}) + Conv ${tileKernel}×${tileKernel}(${spatialDim}→${tileFilters}→1)`,
      input_shape: [spatialDim, 50, 50],
      output_shape: [1, 50, 50],
      receptive_field: gridSize,
      params: tileCondParams + tileConvParams,
      macs: (spatialDim * tileFilters * tileKernel * tileKernel + tileFilters) * 2500,
    },
    {
      id: 'head_critic',
      stage: 'heads',
      type: 'critic_head',
      desc: `MLP(${embedDim} → ${headHidden} → 1 Critic V(s), ${headAct})`,
      input_shape: [embedDim],
      output_shape: [1],
      receptive_field: gridSize,
      params: criticParams,
      macs: embedDim * headHidden + headHidden,
    },
  ];

  headSummaries.forEach((h) => {
    totalParams += h.params;
    totalMacs += h.macs;
    layersSummary.push(h);
  });

  codeLines.push('    # 3. Factorized Policy & Critic Heads');
  codeLines.push(`    self.army_context_proj = nn.Sequential(nn.Linear(64, ${embedDim}), nn.LayerNorm(${embedDim}), nn.${headAct.toUpperCase()}())`);
  codeLines.push(`    self.slot_type_head = nn.Linear(${embedDim}, 7)`);
  codeLines.push(`    self.slot_idx_head = nn.Sequential(nn.Linear(${embedDim + 7}, ${headHidden}), nn.${headAct.toUpperCase()}(), nn.Linear(${headHidden}, 10))`);
  codeLines.push(`    self.tile_cond_proj = nn.Linear(${embedDim + 7}, ${spatialDim})`);
  codeLines.push(
    `    self.tile_conv_head = nn.Sequential(nn.Conv2d(${spatialDim}, ${tileFilters}, kernel_size=${tileKernel}, padding=${Math.floor((tileKernel - 1) / 2)}), nn.${headAct.toUpperCase()}(), nn.Conv2d(${tileFilters}, 1, kernel_size=1))`
  );
  codeLines.push(`    self.critic_head = nn.Sequential(nn.Linear(${embedDim}, ${headHidden}), nn.${headAct.toUpperCase()}(), nn.Linear(${headHidden}, 1))`);

  const vramMb = Math.round(((totalParams * 4 * 3) / (1024 * 1024)) * 100) / 100;

  return {
    valid: true,
    name: cfg.name,
    is_default: cfg.preset_id === 'default_th18_resnet',
    total_params: totalParams,
    trainable_params: totalParams,
    estimated_vram_mb: vramMb,
    total_macs: totalMacs,
    spatial_out_shape: spatialOutShape,
    spatial_receptive_field: spatialRf,
    embed_dim: embedDim,
    layers_summary: layersSummary,
    pytorch_repr: codeLines.join('\n'),
  };
}

interface NetworkBuilderPanelProps {
  archConfig: ArchitectureConfig;
  onChangeArchConfig: (next: ArchitectureConfig) => void;
  isLockedToResume: boolean;
  isTraining: boolean;
  serverOnline: boolean;
  onUnlockToScratch: () => void;
}

export const NetworkBuilderPanel: React.FC<NetworkBuilderPanelProps> = ({
  archConfig,
  onChangeArchConfig,
  isLockedToResume,
  isTraining,
  serverOnline,
  onUnlockToScratch,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [vizMode, setVizMode] = useState<'cnn3d' | 'torchview'>('cnn3d');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>('s1');
  const [hoveredBlockId, setHoveredBlockId] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);

  // Torchview backend SVG state
  const [torchviewDetail, setTorchviewDetail] = useState<'overview' | 'detailed'>('overview');
  const [torchviewDir, setTorchviewDir] = useState<'LR' | 'TB'>('LR');
  const [backendResult, setBackendResult] = useState<ArchitectureAnalysisResult | null>(null);
  const [isLoadingSvg, setIsLoadingSvg] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const localAnalysis = useMemo(
    () => analyzeArchitectureLocal(archConfig),
    [archConfig]
  );

  // Sync with backend when server is online (especially when Torchview mode is active)
  useEffect(() => {
    if (!serverOnline) return;
    let active = true;
    const needSvg = vizMode === 'torchview';
    if (needSvg) setIsLoadingSvg(true);
    const timer = window.setTimeout(() => {
      previewCustomArchitecture({
        archConfig,
        detail: torchviewDetail,
        direction: torchviewDir,
        includeSvg: needSvg,
      }).then((res) => {
        if (!active) return;
        if (res) setBackendResult(res);
        setIsLoadingSvg(false);
      });
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [archConfig, serverOnline, vizMode, torchviewDetail, torchviewDir]);

  // Only lock editing while a training job is actively running on GPU;
  // editing while a checkpoint is selected automatically switches to 'scratch' (fresh model).
  const readOnly = isTraining;

  const commitArchChange = (next: ArchitectureConfig) => {
    if (isLockedToResume) {
      onUnlockToScratch();
    }
    onChangeArchConfig(next);
  };

  const updateBlock = (
    stage: 'spatial' | 'global',
    id: string,
    patch: Partial<NetworkBlockConfig>
  ) => {
    if (readOnly) return;
    const key = stage === 'spatial' ? 'spatial_blocks' : 'global_blocks';
    const nextList = archConfig[key].map((b) => {
      if (b.id !== id) return b;
      const merged = { ...b, ...patch };
      // Apply smart defaults when switching layer type
      if (patch.type && patch.type !== b.type) {
        const t = patch.type;
        if (t === 'conv2d' || t === 'resblock2d' || t === 'dwsep_conv2d') {
          merged.filters = merged.filters ?? 64;
          merged.kernel_size = merged.kernel_size ?? 3;
          merged.stride = merged.stride ?? 1;
          merged.dilation = merged.dilation ?? 1;
          merged.padding =
            merged.padding ??
            Math.floor(((merged.dilation ?? 1) * ((merged.kernel_size ?? 3) - 1)) / 2);
          merged.norm = merged.norm ?? (stage === 'spatial' ? 'group' : 'none');
          merged.activation =
            merged.activation && merged.activation !== 'none'
              ? merged.activation
              : 'silu';
        } else if (t === 'maxpool2d' || t === 'avgpool2d') {
          merged.kernel_size = 2;
          merged.stride = 2;
          merged.padding = 0;
        } else if (t === 'adaptive_avgpool2d' || t === 'adaptive_maxpool2d') {
          merged.pool_size = merged.pool_size ?? 4;
        } else if (t === 'se_block2d') {
          merged.reduction = merged.reduction ?? 4;
          merged.activation = merged.activation ?? 'silu';
        } else if (t === 'dropout2d') {
          merged.dropout = merged.dropout ?? 0.1;
        } else if (t === 'linear') {
          merged.units = merged.units ?? 256;
          merged.norm = merged.norm ?? 'layer';
          merged.activation = merged.activation ?? 'silu';
          merged.dropout = merged.dropout ?? 0.0;
        }
      }
      return merged;
    });
    commitArchChange({
      ...archConfig,
      preset_id: 'custom',
      name: archConfig.name.startsWith('Custom')
        ? archConfig.name
        : `Custom (${archConfig.name})`,
      [key]: nextList,
    });
  };

  const addBlock = (stage: 'spatial' | 'global', type: LayerBlockType) => {
    if (readOnly) return;
    const key = stage === 'spatial' ? 'spatial_blocks' : 'global_blocks';
    const currentList = [...archConfig[key]];
    const uid = `${stage[0]}${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 90 + 10)}`;

    const lastChannels =
      stage === 'spatial'
        ? localAnalysis.spatial_out_shape[0] ?? 64
        : 128;

    const newBlock: NetworkBlockConfig = {
      id: uid,
      type,
      filters: lastChannels,
      kernel_size: type === 'maxpool2d' || type === 'avgpool2d' ? 2 : 3,
      stride: type === 'maxpool2d' || type === 'avgpool2d' ? 2 : 1,
      padding: type === 'maxpool2d' || type === 'avgpool2d' ? 0 : 1,
      dilation: 1,
      norm: stage === 'spatial' ? 'group' : type === 'linear' ? 'layer' : 'none',
      activation: 'silu',
      bias: stage !== 'spatial',
      pool_size: 4,
      reduction: 4,
      dropout: type === 'dropout2d' ? 0.1 : 0.0,
      units: 256,
    };

    if (stage === 'global' && type !== 'flatten' && type !== 'linear') {
      // Insert 2D spatial blocks before Flatten / Linear in global_blocks
      const first1dIdx = currentList.findIndex(
        (b) => b.type === 'flatten' || b.type === 'linear'
      );
      if (first1dIdx >= 0) {
        currentList.splice(first1dIdx, 0, newBlock);
      } else {
        currentList.push(newBlock);
      }
    } else {
      currentList.push(newBlock);
    }

    setSelectedBlockId(uid);
    commitArchChange({
      ...archConfig,
      preset_id: 'custom',
      name: 'Custom CNN Architecture',
      [key]: currentList,
    });
  };

  const moveBlock = (stage: 'spatial' | 'global', idx: number, dir: -1 | 1) => {
    if (readOnly) return;
    const key = stage === 'spatial' ? 'spatial_blocks' : 'global_blocks';
    const list = [...archConfig[key]];
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    // Prevent moving 2D blocks after Flatten/Linear or vice-versa in global_blocks
    if (stage === 'global') {
      const aIs1D = list[idx].type === 'flatten' || list[idx].type === 'linear';
      const bIs1D = list[target].type === 'flatten' || list[target].type === 'linear';
      if (aIs1D !== bIs1D) return;
    }
    const tmp = list[idx];
    list[idx] = list[target];
    list[target] = tmp;
    commitArchChange({
      ...archConfig,
      preset_id: 'custom',
      [key]: list,
    });
  };

  const duplicateBlock = (stage: 'spatial' | 'global', idx: number) => {
    if (readOnly) return;
    const key = stage === 'spatial' ? 'spatial_blocks' : 'global_blocks';
    const list = [...archConfig[key]];
    const orig = list[idx];
    if (orig.type === 'flatten') return;
    const copyBlock: NetworkBlockConfig = {
      ...orig,
      id: `${stage[0]}${Date.now().toString(36).slice(-4)}${Math.floor(Math.random() * 90 + 10)}`,
    };
    list.splice(idx + 1, 0, copyBlock);
    setSelectedBlockId(copyBlock.id);
    commitArchChange({
      ...archConfig,
      preset_id: 'custom',
      [key]: list,
    });
  };

  const removeBlock = (stage: 'spatial' | 'global', idx: number) => {
    if (readOnly) return;
    const key = stage === 'spatial' ? 'spatial_blocks' : 'global_blocks';
    const list = [...archConfig[key]];
    if (stage === 'spatial' && list.length <= 1) return;
    if (stage === 'global' && list.length <= 1) return;
    list.splice(idx, 1);
    commitArchChange({
      ...archConfig,
      preset_id: 'custom',
      [key]: list,
    });
  };

  // Parameter breakdown percentages
  const paramSplit = useMemo(() => {
    const tot = Math.max(1, localAnalysis.total_params);
    const sParams = localAnalysis.layers_summary
      .filter((l) => l.stage === 'spatial')
      .reduce((a, b) => a + b.params, 0);
    const gParams = localAnalysis.layers_summary
      .filter((l) => l.stage === 'global')
      .reduce((a, b) => a + b.params, 0);
    const hParams = localAnalysis.layers_summary
      .filter((l) => l.stage === 'heads')
      .reduce((a, b) => a + b.params, 0);
    return {
      spatialParams: sParams,
      globalParams: gParams,
      headParams: hParams,
      spatialPct: Math.round((sParams / tot) * 100),
      globalPct: Math.round((gParams / tot) * 100),
      headPct: Math.max(1, 100 - Math.round((sParams / tot) * 100) - Math.round((gParams / tot) * 100)),
    };
  }, [localAnalysis]);

  const summaryMap = useMemo(() => {
    const m = new Map<string, AnalyzedLayerSummary>();
    localAnalysis.layers_summary.forEach((s) => m.set(s.id, s));
    return m;
  }, [localAnalysis]);

  const hoveredSummary = hoveredBlockId ? summaryMap.get(hoveredBlockId) : null;

  // =========================================================================
  // RENDER INLINE PARAMETER CONTROLS FOR EACH LAYER CARD
  // =========================================================================
  const renderBlockInlineControls = (
    stage: 'spatial' | 'global',
    b: NetworkBlockConfig,
    idx: number,
    listLen: number
  ) => {
    const sum = summaryMap.get(b.id);
    const meta = LAYER_META[b.type] ?? LAYER_META.conv2d;
    const isSelected = selectedBlockId === b.id;
    const isHovered = hoveredBlockId === b.id;

    const isConvLike =
      b.type === 'conv2d' || b.type === 'resblock2d' || b.type === 'dwsep_conv2d';
    const isPoolLike = b.type === 'maxpool2d' || b.type === 'avgpool2d';
    const isAdapPool =
      b.type === 'adaptive_avgpool2d' || b.type === 'adaptive_maxpool2d';

    const stageAllowedTypes: LayerBlockType[] =
      stage === 'spatial'
        ? [
            'conv2d',
            'resblock2d',
            'dwsep_conv2d',
            'se_block2d',
            'maxpool2d',
            'avgpool2d',
            'dropout2d',
          ]
        : [
            'conv2d',
            'resblock2d',
            'dwsep_conv2d',
            'se_block2d',
            'maxpool2d',
            'avgpool2d',
            'adaptive_avgpool2d',
            'adaptive_maxpool2d',
            'dropout2d',
            'flatten',
            'linear',
          ];

    return (
      <div
        key={b.id}
        className={`arch-layer-row ${isSelected ? 'selected' : ''} ${
          isHovered ? 'hovered' : ''
        }`}
        style={{ borderLeftColor: meta.color }}
        onClick={() => setSelectedBlockId(b.id)}
        onMouseEnter={() => setHoveredBlockId(b.id)}
        onMouseLeave={() => setHoveredBlockId(null)}
      >
        {/* Left: Layer Badge & Layer Type Selector */}
        <div className="arch-layer-head">
          <span
            className="arch-layer-index"
            style={{ background: meta.color }}
          >
            {stage === 'spatial' ? `S${idx + 1}` : `G${idx + 1}`}
          </span>
          <select
            className="clash-select arch-type-select"
            value={b.type}
            disabled={readOnly}
            onChange={(e) =>
              updateBlock(stage, b.id, { type: e.target.value as LayerBlockType })
            }
          >
            {stageAllowedTypes.map((t) => (
              <option key={t} value={t}>
                {LAYER_META[t].label}
              </option>
            ))}
          </select>
        </div>

        {/* Center: Dynamic Inline Layer Parameters */}
        <div className="arch-layer-params">
          {isConvLike && (
            <>
              <label className="arch-param-field">
                <span>Filters</span>
                <select
                  className="clash-select mini"
                  value={b.filters ?? 64}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, { filters: Number(e.target.value) })
                  }
                >
                  {[16, 24, 32, 48, 64, 96, 128, 160, 192, 256, 384, 512].map(
                    (f) => (
                      <option key={f} value={f}>
                        {f} ch
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="arch-param-field">
                <span>Filter Size</span>
                <select
                  className="clash-select mini"
                  value={b.kernel_size ?? 3}
                  disabled={readOnly}
                  onChange={(e) => {
                    const nextK = Number(e.target.value);
                    const nextPad = Math.floor(
                      ((b.dilation ?? 1) * (nextK - 1)) / 2
                    );
                    updateBlock(stage, b.id, {
                      kernel_size: nextK,
                      padding: nextPad,
                    });
                  }}
                >
                  {[1, 3, 5, 7].map((k) => (
                    <option key={k} value={k}>
                      {k}×{k}
                    </option>
                  ))}
                </select>
              </label>

              <label className="arch-param-field">
                <span>Padding</span>
                <select
                  className="clash-select mini"
                  value={b.padding ?? 1}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, { padding: Number(e.target.value) })
                  }
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((p) => {
                    const samePad = Math.floor(
                      ((b.dilation ?? 1) * ((b.kernel_size ?? 3) - 1)) / 2
                    );
                    return (
                      <option key={p} value={p}>
                        {p}
                        {p === samePad && (b.stride ?? 1) === 1 ? ' (same)' : ''}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="arch-param-field">
                <span>Stride</span>
                <select
                  className="clash-select mini"
                  value={b.stride ?? 1}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, { stride: Number(e.target.value) })
                  }
                >
                  {[1, 2, 3].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="arch-param-field">
                <span>Dilation</span>
                <select
                  className="clash-select mini"
                  value={b.dilation ?? 1}
                  disabled={readOnly}
                  onChange={(e) => {
                    const nextD = Number(e.target.value);
                    const nextPad = Math.floor(
                      (nextD * ((b.kernel_size ?? 3) - 1)) / 2
                    );
                    updateBlock(stage, b.id, {
                      dilation: nextD,
                      padding: nextPad,
                    });
                  }}
                >
                  {[1, 2, 3, 4].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <label className="arch-param-field">
                <span>Norm</span>
                <select
                  className="clash-select mini"
                  value={b.norm ?? 'group'}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, {
                      norm: e.target.value as NormType,
                      bias: e.target.value === 'none',
                    })
                  }
                >
                  <option value="group">GroupNorm</option>
                  <option value="batch">BatchNorm</option>
                  <option value="layer">LayerNorm</option>
                  <option value="none">None</option>
                </select>
              </label>

              <label className="arch-param-field">
                <span>Activation</span>
                <select
                  className="clash-select mini"
                  value={b.activation ?? 'silu'}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, {
                      activation: e.target.value as ActivationType,
                    })
                  }
                >
                  <option value="silu">SiLU</option>
                  <option value="relu">ReLU</option>
                  <option value="gelu">GELU</option>
                  <option value="leaky_relu">LeakyReLU</option>
                  <option value="elu">ELU</option>
                  <option value="tanh">Tanh</option>
                  <option value="none">Identity</option>
                </select>
              </label>
            </>
          )}

          {isPoolLike && (
            <>
              <label className="arch-param-field">
                <span>Pool Size</span>
                <select
                  className="clash-select mini"
                  value={b.kernel_size ?? 2}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, {
                      kernel_size: Number(e.target.value),
                    })
                  }
                >
                  {[2, 3, 4].map((k) => (
                    <option key={k} value={k}>
                      {k}×{k}
                    </option>
                  ))}
                </select>
              </label>
              <label className="arch-param-field">
                <span>Stride</span>
                <select
                  className="clash-select mini"
                  value={b.stride ?? 2}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, { stride: Number(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="arch-param-field">
                <span>Padding</span>
                <select
                  className="clash-select mini"
                  value={b.padding ?? 0}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, { padding: Number(e.target.value) })
                  }
                >
                  {[0, 1, 2].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {isAdapPool && (
            <label className="arch-param-field">
              <span>Output Grid</span>
              <select
                className="clash-select mini"
                value={b.pool_size ?? 4}
                disabled={readOnly}
                onChange={(e) =>
                  updateBlock(stage, b.id, { pool_size: Number(e.target.value) })
                }
              >
                {[1, 2, 3, 4, 6, 8].map((ps) => (
                  <option key={ps} value={ps}>
                    {ps}×{ps}
                  </option>
                ))}
              </select>
            </label>
          )}

          {b.type === 'se_block2d' && (
            <>
              <label className="arch-param-field">
                <span>Reduction</span>
                <select
                  className="clash-select mini"
                  value={b.reduction ?? 4}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, {
                      reduction: Number(e.target.value),
                    })
                  }
                >
                  {[2, 4, 8, 16].map((r) => (
                    <option key={r} value={r}>
                      ÷{r}
                    </option>
                  ))}
                </select>
              </label>
              <label className="arch-param-field">
                <span>Activation</span>
                <select
                  className="clash-select mini"
                  value={b.activation ?? 'silu'}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, {
                      activation: e.target.value as ActivationType,
                    })
                  }
                >
                  <option value="silu">SiLU</option>
                  <option value="relu">ReLU</option>
                  <option value="gelu">GELU</option>
                </select>
              </label>
            </>
          )}

          {b.type === 'dropout2d' && (
            <label className="arch-param-field">
              <span>Drop Rate p</span>
              <select
                className="clash-select mini"
                value={b.dropout ?? 0.1}
                disabled={readOnly}
                onChange={(e) =>
                  updateBlock(stage, b.id, { dropout: Number(e.target.value) })
                }
              >
                {[0.05, 0.1, 0.15, 0.2, 0.3, 0.5].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          )}

          {b.type === 'flatten' && (
            <span className="arch-flatten-tag">
              3D Spatial Volume → 1D Dense Vector
            </span>
          )}

          {b.type === 'linear' && (
            <>
              <label className="arch-param-field">
                <span>Units</span>
                <select
                  className="clash-select mini"
                  value={b.units ?? 256}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, { units: Number(e.target.value) })
                  }
                >
                  {[64, 128, 192, 256, 384, 512, 768, 1024].map((u) => (
                    <option key={u} value={u}>
                      {u}d
                    </option>
                  ))}
                </select>
              </label>
              <label className="arch-param-field">
                <span>Norm</span>
                <select
                  className="clash-select mini"
                  value={b.norm ?? 'layer'}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, { norm: e.target.value as NormType })
                  }
                >
                  <option value="layer">LayerNorm</option>
                  <option value="batch">BatchNorm1d</option>
                  <option value="none">None</option>
                </select>
              </label>
              <label className="arch-param-field">
                <span>Activation</span>
                <select
                  className="clash-select mini"
                  value={b.activation ?? 'silu'}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, {
                      activation: e.target.value as ActivationType,
                    })
                  }
                >
                  <option value="silu">SiLU</option>
                  <option value="relu">ReLU</option>
                  <option value="gelu">GELU</option>
                  <option value="leaky_relu">LeakyReLU</option>
                  <option value="tanh">Tanh</option>
                  <option value="none">Identity</option>
                </select>
              </label>
              <label className="arch-param-field">
                <span>Dropout</span>
                <select
                  className="clash-select mini"
                  value={b.dropout ?? 0.0}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateBlock(stage, b.id, { dropout: Number(e.target.value) })
                  }
                >
                  {[0.0, 0.05, 0.1, 0.2, 0.3].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>

        {/* Right: Live Shape Transition, Receptive Field, Params & Row Actions */}
        <div className="arch-layer-telemetry">
          {sum && (
            <>
              <span className="arch-shape-pill" title="Input Shape → Output Shape">
                {sum.input_shape.join('×')} →{' '}
                <strong>{sum.output_shape.join('×')}</strong>
              </span>
              {sum.output_shape.length === 3 && (
                <span className="arch-rf-pill" title="Spatial Receptive Field on 50×50 Grid">
                  RF {sum.receptive_field}×{sum.receptive_field}
                </span>
              )}
              <span className="arch-param-pill">
                {sum.params > 0 ? `${sum.params.toLocaleString()} p` : '0 p'}
              </span>
            </>
          )}
          <div
            className="arch-row-actions"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              disabled={readOnly || idx === 0}
              onClick={() => moveBlock(stage, idx, -1)}
              title="Move Up"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={readOnly || idx === listLen - 1}
              onClick={() => moveBlock(stage, idx, 1)}
              title="Move Down"
            >
              ↓
            </button>
            {b.type !== 'flatten' && (
              <button
                type="button"
                disabled={readOnly}
                onClick={() => duplicateBlock(stage, idx)}
                title="Duplicate Block"
              >
                ⧉
              </button>
            )}
            <button
              type="button"
              className="danger"
              disabled={readOnly || listLen <= 1}
              onClick={() => removeBlock(stage, idx)}
              title="Delete Block"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    );
  };

  // =========================================================================
  // RENDER 3D ISOMETRIC CNN VOLUMETRIC DIAGRAM (NN-SVG / PLOTNEURALNET STYLE)
  // =========================================================================
  const render3DCnnDiagram = () => {
    const spatialLayers = localAnalysis.layers_summary.filter(
      (l) => l.stage === 'spatial'
    );
    const globalLayers = localAnalysis.layers_summary.filter(
      (l) => l.stage === 'global'
    );

    const stepX = 112;
    const startX = 64;
    const stemY = 175;
    const topBranchY = 112;
    const botBranchY = 262;

    const splitX = startX + (spatialLayers.length + 1) * stepX;
    const totalCols = Math.max(
      spatialLayers.length + globalLayers.length + 4,
      spatialLayers.length + 5
    );
    const svgWidth = Math.max(1060, startX + totalCols * stepX + 80);
    const svgHeight = 355;

    // Helper to draw a 3D isometric cuboid representing a (C, H, W) tensor slab
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
      isSE?: boolean;
      onClick?: () => void;
      onHover?: (id: string | null) => void;
    }) => {
      // Scale height/width by spatial resolution H (4..50 -> 26..96px)
      const sideH = Math.max(24, Math.min(98, 20 + (opts.h / 50) * 76));
      const sideW = Math.max(16, Math.min(44, 12 + (opts.w / 50) * 30));
      // Scale depth by log2(channels)
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
            <line
              x1={sx}
              y1={y0}
              x2={sx}
              y2={y0 + sideH}
              stroke="#0f172a"
              strokeWidth={1}
            />
            <line
              x1={sx}
              y1={y0}
              x2={sx + dx}
              y2={y0 - dy}
              stroke="#0f172a"
              strokeWidth={1}
            />
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
          {/* Residual Skip Connection Arc */}
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

          {/* Selection Halo */}
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

          {/* 3D Isometric Faces */}
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

          {/* Inner Feature Map Grid Accent on Right Face */}
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

          {opts.isSE && (
            <circle
              cx={opts.cx + dx / 2}
              cy={opts.cy - dy / 2}
              r={10}
              fill="#ec4899"
              stroke="#fff"
              strokeWidth={1.2}
            />
          )}

          {/* Top & Bottom Labels */}
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

    // Helper to draw a 1D Dense Vector Column (for Flatten / Linear / Action Heads)
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

    // Receptive field pyramid connector between two 3D nodes
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

          {/* Stage Banner Labels */}
          <text x={24} y={22} fill="#60a5fa" fontSize={10.5} fontWeight={800}>
            STAGE 1 • SPATIAL CNN BACKBONE (Full-Res Feature Pathway)
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
            const bCfg = archConfig.spatial_blocks.find((b) => b.id === sLayer.id);
            const meta =
              LAYER_META[(sLayer.type as LayerBlockType) ?? 'conv2d'] ??
              LAYER_META.conv2d;
            const prevX = startX + idx * stepX;
            const curX = startX + (idx + 1) * stepX;
            const [c, h, w] = sLayer.output_shape;
            const k = bCfg?.kernel_size ?? 3;
            const d = bCfg?.dilation ?? 1;
            const coneLabel =
              sLayer.type === 'se_block2d'
                ? `SE ÷${bCfg?.reduction ?? 4}`
                : `${k}×${k}${d > 1 ? ` d=${d}` : ''}`;

            return (
              <React.Fragment key={sLayer.id}>
                {drawFilterCone(prevX, stemY, curX, stemY, coneLabel)}
                {drawCuboid({
                  key: sLayer.id,
                  cx: curX,
                  cy: stemY,
                  c,
                  h,
                  w,
                  color: meta.color,
                  borderColor: meta.border,
                  topLabel: `S${idx + 1}: ${meta.short}`,
                  shapeLabel: `${c}×${h}×${w}`,
                  subLabel: `RF ${sLayer.receptive_field}×${sLayer.receptive_field}`,
                  isSelected: selectedBlockId === sLayer.id,
                  isHovered: hoveredBlockId === sLayer.id,
                  hasSkipArc: sLayer.type === 'resblock2d',
                  isSE: sLayer.type === 'se_block2d',
                  onClick: () => setSelectedBlockId(sLayer.id),
                  onHover: setHoveredBlockId,
                })}
              </React.Fragment>
            );
          })}

          {/* 2. Upper Branch: Global Tower Blocks */}
          {globalLayers.map((gLayer, idx) => {
            const bCfg = archConfig.global_blocks.find((b) => b.id === gLayer.id);
            const meta =
              LAYER_META[(gLayer.type as LayerBlockType) ?? 'conv2d'] ??
              LAYER_META.conv2d;
            const prevX = idx === 0 ? splitX - stepX : splitX + (idx - 1) * stepX;
            const prevY = idx === 0 ? stemY : topBranchY;
            const curX = splitX + idx * stepX;
            const is1D = gLayer.output_shape.length === 1;

            const k = bCfg?.kernel_size ?? 3;
            const s = bCfg?.stride ?? 1;
            const coneLbl =
              gLayer.type === 'flatten'
                ? 'Flatten'
                : gLayer.type === 'linear'
                ? 'Dense'
                : gLayer.type.startsWith('adaptive')
                ? `Pool ${bCfg?.pool_size ?? 4}×${bCfg?.pool_size ?? 4}`
                : `${k}×${k}${s > 1 ? ` s=${s}` : ''}`;

            return (
              <React.Fragment key={gLayer.id}>
                {drawFilterCone(
                  prevX,
                  prevY,
                  curX,
                  topBranchY,
                  coneLbl,
                  'rgba(16, 185, 129, 0.2)',
                  '#34d399'
                )}
                {is1D
                  ? drawDenseBar({
                      key: gLayer.id,
                      cx: curX,
                      cy: topBranchY,
                      dim: gLayer.output_shape[0],
                      color: meta.color,
                      borderColor: meta.border,
                      topLabel: `G${idx + 1}: ${meta.short}`,
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
                      c: gLayer.output_shape[0],
                      h: gLayer.output_shape[1],
                      w: gLayer.output_shape[2],
                      color: meta.color,
                      borderColor: meta.border,
                      topLabel: `G${idx + 1}: ${meta.short}`,
                      shapeLabel: gLayer.output_shape.join('×'),
                      subLabel: `RF ${gLayer.receptive_field}×${gLayer.receptive_field}`,
                      isSelected: selectedBlockId === gLayer.id,
                      isHovered: hoveredBlockId === gLayer.id,
                      hasSkipArc: gLayer.type === 'resblock2d',
                      isSE: gLayer.type === 'se_block2d',
                      onClick: () => setSelectedBlockId(gLayer.id),
                      onHover: setHoveredBlockId,
                    })}
              </React.Fragment>
            );
          })}

          {/* 3. Lower Branch: Spatial Tile Pointer Pathway */}
          {(() => {
            const stemLastX = splitX - stepX;
            const tileMidX = splitX + Math.max(1, Math.floor(globalLayers.length / 2)) * stepX;
            const tileOutX = tileMidX + stepX;
            const globalEndX = splitX + Math.max(0, globalLayers.length - 1) * stepX;
            const headsX = Math.max(globalEndX, tileOutX) + stepX;

            const tileF = archConfig.heads.tile_head_filters;
            const tileK = archConfig.heads.tile_head_kernel;

            return (
              <>
                {/* Spatial Stem -> Tile Conv Head */}
                {drawFilterCone(
                  stemLastX,
                  stemY,
                  tileMidX,
                  botBranchY,
                  `Skip + Cond (${tileK}×${tileK})`,
                  'rgba(250, 204, 21, 0.22)',
                  '#facc15'
                )}
                {/* Conditioning dashed line from Global Embedding down to Tile Conv Head */}
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
                  c: tileF,
                  h: 50,
                  w: 50,
                  color: '#d97706',
                  borderColor: '#facc15',
                  topLabel: 'Tile Conv Head',
                  shapeLabel: `${tileF}×50×50`,
                  subLabel: `${tileK}×${tileK} Pointer`,
                  isHovered: hoveredBlockId === 'head_tile_conv',
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

                {/* Global Embedding -> 3 Vector Output Heads (Action Type 7, Slot Idx 10, Critic 1) */}
                {drawFilterCone(
                  globalEndX,
                  topBranchY,
                  headsX,
                  topBranchY,
                  `MLP ${archConfig.heads.head_hidden_dim}d`,
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

        {/* Floating Hover Inspector Badge inside the 3D Stage */}
        {hoveredSummary && (
          <div className="arch-hover-tooltip">
            <strong>
              {hoveredSummary.id.toUpperCase()} • {hoveredSummary.type}
            </strong>
            <span>{hoveredSummary.desc}</span>
            <span>
              Shape: {hoveredSummary.input_shape.join('×')} →{' '}
              <b>{hoveredSummary.output_shape.join('×')}</b> • RF:{' '}
              {hoveredSummary.receptive_field}×{hoveredSummary.receptive_field} •{' '}
              {hoveredSummary.params.toLocaleString()} params
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="ai-arch-studio-card">
      {/* TOP BAR: TITLE, PRESET PICKER, LIVE MODEL KPI PILLS & COLLAPSE */}
      <div className="ai-arch-header">
        <div className="ai-arch-title-row">
          <h3>🧬 Neural Network Block Builder & CNN Visualizer</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              className="clash-select mini"
              value={
                ARCHITECTURE_PRESETS.some(
                  (p) => p.preset_id === archConfig.preset_id
                )
                  ? archConfig.preset_id
                  : 'custom'
              }
              disabled={readOnly}
              onChange={(e) => {
                const found = ARCHITECTURE_PRESETS.find(
                  (p) => p.preset_id === e.target.value
                );
                if (found) {
                  commitArchChange(JSON.parse(JSON.stringify(found)));
                  setSelectedBlockId(found.spatial_blocks[0]?.id ?? null);
                }
              }}
            >
              {ARCHITECTURE_PRESETS.map((p) => (
                <option key={p.preset_id} value={p.preset_id}>
                  📐 Preset: {p.name}
                </option>
              ))}
              <option value="custom">✨ Custom User Architecture</option>
            </select>
            <button
              type="button"
              className="speed-pill-btn"
              disabled={readOnly}
              onClick={() =>
                commitArchChange(
                  JSON.parse(JSON.stringify(DEFAULT_ARCHITECTURE_CONFIG))
                )
              }
            >
              ↺ Reset Default
            </button>
            {isLockedToResume && (
              <span className="badge-gold" title="Editing any block will automatically switch to Start Fresh">
                📦 Checkpoint Architecture
              </span>
            )}
          </div>
        </div>

        {/* LIVE CURRENT MODEL READOUT PILLS */}
        <div className="ai-arch-kpi-pills">
          <div className="arch-pill">
            <span>Spatial Map</span>
            <strong>
              {localAnalysis.spatial_out_shape.join('×')} (RF{' '}
              {localAnalysis.spatial_receptive_field}×
              {localAnalysis.spatial_receptive_field})
            </strong>
          </div>
          <div className="arch-pill">
            <span>Global Emb</span>
            <strong>{localAnalysis.embed_dim}D</strong>
          </div>
          <div className="arch-pill">
            <span>Parameters</span>
            <strong style={{ color: '#facc15' }}>
              {localAnalysis.total_params.toLocaleString()}
            </strong>
          </div>
          <div className="arch-pill">
            <span>Compute / Size</span>
            <strong>
              {(localAnalysis.total_macs / 1e6).toFixed(1)}M MACs •{' '}
              {localAnalysis.estimated_vram_mb} MB
            </strong>
          </div>
          <button
            type="button"
            className="speed-pill-btn"
            onClick={() => setIsCollapsed((c) => !c)}
          >
            {isCollapsed ? '▼ Expand Studio' : '▲ Collapse'}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* VISUALIZATION TOOLBAR & VIEWPORT */}
          <div className="arch-viz-toolbar">
            <div className="arch-viz-tabs">
              <button
                type="button"
                className={`speed-pill-btn ${vizMode === 'cnn3d' ? 'active' : ''}`}
                onClick={() => setVizMode('cnn3d')}
              >
                🧊 3D CNN Feature Maps (NN-SVG / PlotNeuralNet)
              </button>
              <button
                type="button"
                className={`speed-pill-btn ${
                  vizMode === 'torchview' ? 'active' : ''
                }`}
                onClick={() => setVizMode('torchview')}
              >
                🕸️ Torchview Computation Graph (Graphviz SVG)
              </button>
            </div>

            <div className="arch-viz-controls">
              {vizMode === 'torchview' && (
                <>
                  <select
                    className="clash-select mini"
                    value={torchviewDetail}
                    onChange={(e) =>
                      setTorchviewDetail(
                        e.target.value as 'overview' | 'detailed'
                      )
                    }
                  >
                    <option value="overview">Depth 2 (Overview)</option>
                    <option value="detailed">Depth 3 (Detailed)</option>
                  </select>
                  <select
                    className="clash-select mini"
                    value={torchviewDir}
                    onChange={(e) =>
                      setTorchviewDir(e.target.value as 'LR' | 'TB')
                    }
                  >
                    <option value="LR">Horizontal (LR)</option>
                    <option value="TB">Vertical (TB)</option>
                  </select>
                </>
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
                <span style={{ fontSize: '0.72rem', color: '#cbd5e1', minWidth: 38, textAlign: 'center' }}>
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

          {/* ACTIVE VISUALIZATION STAGE */}
          {vizMode === 'cnn3d' && render3DCnnDiagram()}

          {vizMode === 'torchview' && (
            <div className="arch-torchview-stage">
              {isLoadingSvg ? (
                <div className="arch-stage-placeholder">
                  ⏳ Compiling custom `CoCActorCritic` in PyTorch & rendering `torchview` Graphviz SVG...
                </div>
              ) : backendResult?.svg ? (
                <div
                  className="arch-torchview-svg-wrap"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                  }}
                  dangerouslySetInnerHTML={{ __html: backendResult.svg }}
                />
              ) : (
                <div className="arch-stage-placeholder">
                  {serverOnline
                    ? 'Rendering Torchview SVG...'
                    : 'Start the Python AI server (port 8000) to render live Torchview Graphviz computation graphs.'}
                </div>
              )}
            </div>
          )}

          {/* TWO-COLUMN INTERACTIVE LAYER BLOCK STACK BUILDER */}
          <div className="arch-builder-columns">
            {/* LEFT COLUMN: STAGE 1 SPATIAL CNN STEM BLOCKS */}
            <div className="arch-stage-column">
              <div className="arch-stage-header">
                <div>
                  <h4>
                    Stage 1 • Spatial CNN Stem ({archConfig.spatial_blocks.length}{' '}
                    Blocks)
                  </h4>
                  <span>
                    Input <b>8×50×50</b> → Output{' '}
                    <b style={{ color: '#fde047' }}>
                      {localAnalysis.spatial_out_shape.join('×')}
                    </b>{' '}
                    • Receptive Field{' '}
                    <b>
                      {localAnalysis.spatial_receptive_field}×
                      {localAnalysis.spatial_receptive_field}
                    </b>{' '}
                    • {paramSplit.spatialParams.toLocaleString()} params
                  </span>
                </div>
              </div>

              <div className="arch-blocks-list">
                {archConfig.spatial_blocks.map((b, idx) =>
                  renderBlockInlineControls(
                    'spatial',
                    b,
                    idx,
                    archConfig.spatial_blocks.length
                  )
                )}
              </div>

              <div className="arch-add-bar">
                <span>+ Add Spatial Block:</span>
                {(
                  [
                    ['conv2d', '+ Conv2d'],
                    ['resblock2d', '+ ResBlock2d'],
                    ['dwsep_conv2d', '+ SepConv2d'],
                    ['se_block2d', '+ SE Attention'],
                    ['maxpool2d', '+ MaxPool2d'],
                    ['avgpool2d', '+ AvgPool2d'],
                    ['dropout2d', '+ Dropout2d'],
                  ] as [LayerBlockType, string][]
                ).map(([t, lbl]) => (
                  <button
                    key={t}
                    type="button"
                    className="arch-add-btn"
                    disabled={readOnly}
                    onClick={() => addBlock('spatial', t)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT COLUMN: STAGE 2 GLOBAL ENCODER TOWER + STAGE 3 HEADS */}
            <div className="arch-stage-column">
              <div className="arch-stage-header">
                <div>
                  <h4>
                    Stage 2 • Global Encoder Tower (
                    {archConfig.global_blocks.length} Blocks)
                  </h4>
                  <span>
                    Input <b>{localAnalysis.spatial_out_shape.join('×')}</b> →
                    Embedding{' '}
                    <b style={{ color: '#4ade80' }}>
                      {localAnalysis.embed_dim}D
                    </b>{' '}
                    • {paramSplit.globalParams.toLocaleString()} params
                  </span>
                </div>
              </div>

              <div className="arch-blocks-list">
                {archConfig.global_blocks.map((b, idx) =>
                  renderBlockInlineControls(
                    'global',
                    b,
                    idx,
                    archConfig.global_blocks.length
                  )
                )}
              </div>

              <div className="arch-add-bar">
                <span>+ Add Global Block:</span>
                {(
                  [
                    ['conv2d', '+ Conv2d'],
                    ['resblock2d', '+ ResBlock2d'],
                    ['maxpool2d', '+ MaxPool2d'],
                    ['adaptive_avgpool2d', '+ AdapPool2d'],
                    ['linear', '+ Linear (Dense)'],
                    ['dropout2d', '+ Dropout'],
                  ] as [LayerBlockType, string][]
                ).map(([t, lbl]) => (
                  <button
                    key={t}
                    type="button"
                    className="arch-add-btn"
                    disabled={readOnly}
                    onClick={() => addBlock('global', t)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {/* STAGE 3: POLICY & CRITIC HEADS INLINE CONFIG */}
              <div className="arch-heads-box">
                <div className="arch-heads-title">
                  <strong>
                    Stage 3 • Factorized Policy & Critic Heads (
                    {paramSplit.headParams.toLocaleString()} params)
                  </strong>
                  <span>
                    Outputs: Type(7) • Slot(10) • Tile(50×50) • Critic V(s)(1)
                  </span>
                </div>
                <div className="arch-layer-params">
                  <label className="arch-param-field">
                    <span>Tile Conv Filters</span>
                    <select
                      className="clash-select mini"
                      value={archConfig.heads.tile_head_filters}
                      disabled={readOnly}
                      onChange={(e) =>
                        commitArchChange({
                          ...archConfig,
                          preset_id: 'custom',
                          heads: {
                            ...archConfig.heads,
                            tile_head_filters: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {[16, 24, 32, 48, 64, 96].map((f) => (
                        <option key={f} value={f}>
                          {f} ch
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="arch-param-field">
                    <span>Tile Filter Size</span>
                    <select
                      className="clash-select mini"
                      value={archConfig.heads.tile_head_kernel}
                      disabled={readOnly}
                      onChange={(e) =>
                        commitArchChange({
                          ...archConfig,
                          preset_id: 'custom',
                          heads: {
                            ...archConfig.heads,
                            tile_head_kernel: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {[1, 3, 5].map((k) => (
                        <option key={k} value={k}>
                          {k}×{k}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="arch-param-field">
                    <span>MLP Head Hidden</span>
                    <select
                      className="clash-select mini"
                      value={archConfig.heads.head_hidden_dim}
                      disabled={readOnly}
                      onChange={(e) =>
                        commitArchChange({
                          ...archConfig,
                          preset_id: 'custom',
                          heads: {
                            ...archConfig.heads,
                            head_hidden_dim: Number(e.target.value),
                          },
                        })
                      }
                    >
                      {[64, 96, 128, 192, 256, 384].map((h) => (
                        <option key={h} value={h}>
                          {h}d
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="arch-param-field">
                    <span>Head Activation</span>
                    <select
                      className="clash-select mini"
                      value={archConfig.heads.head_activation}
                      disabled={readOnly}
                      onChange={(e) =>
                        commitArchChange({
                          ...archConfig,
                          preset_id: 'custom',
                          heads: {
                            ...archConfig.heads,
                            head_activation: e.target.value as ActivationType,
                          },
                        })
                      }
                    >
                      <option value="silu">SiLU</option>
                      <option value="relu">ReLU</option>
                      <option value="gelu">GELU</option>
                      <option value="tanh">Tanh</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* ALWAYS-VISIBLE CURRENT MODEL OUTPUT: LAYER TABLE & PYTORCH NN.MODULE SPEC */}
          <div className="arch-summary-split">
            <div className="arch-summary-table-wrap">
              <div className="arch-code-header" style={{ marginBottom: 6 }}>
                <strong>
                  Current Model Layer-by-Layer Output ({localAnalysis.layers_summary.length} Layers •{' '}
                  {localAnalysis.total_params.toLocaleString()} Params)
                </strong>
                <div className="arch-footer-param-bar-wrap">
                  <div className="ai-stacked-bar" style={{ height: 8, width: 140 }}>
                    <div
                      style={{
                        width: `${paramSplit.spatialPct}%`,
                        background: '#3b82f6',
                      }}
                    />
                    <div
                      style={{
                        width: `${paramSplit.globalPct}%`,
                        background: '#10b981',
                      }}
                    />
                    <div
                      style={{
                        width: `${paramSplit.headPct}%`,
                        background: '#facc15',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    Stem {paramSplit.spatialPct}% • Tower {paramSplit.globalPct}% • Heads{' '}
                    {paramSplit.headPct}%
                  </span>
                </div>
              </div>
              <table className="ai-matrix-table">
                <thead>
                  <tr>
                    <th>Layer</th>
                    <th>Stage</th>
                    <th>Parameters & Configuration</th>
                    <th>Input → Output</th>
                    <th>RF</th>
                    <th>Params</th>
                    <th>MACs</th>
                  </tr>
                </thead>
                <tbody>
                  {localAnalysis.layers_summary.map((row) => (
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
                        {row.input_shape.join('×')} →{' '}
                        <strong style={{ color: '#38bdf8' }}>
                          {row.output_shape.join('×')}
                        </strong>
                      </td>
                      <td>{row.receptive_field}×{row.receptive_field}</td>
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
                <strong>Compiled PyTorch `nn.Module` Output</strong>
                <button
                  type="button"
                  className="speed-pill-btn active"
                  onClick={() => {
                    navigator.clipboard?.writeText(localAnalysis.pytorch_repr);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                >
                  {copiedCode ? '✓ Copied' : '📋 Copy PyTorch Code'}
                </button>
              </div>
              <pre className="arch-code-pre">{localAnalysis.pytorch_repr}</pre>
            </div>
          </div>

          {/* CLEAR OUTPUT BAR OF WHAT THE CURRENT MODEL IS */}
          <div className="arch-current-model-footer">
            <div className="arch-footer-summary">
              <span className="arch-footer-tag">CURRENT MODEL SPEC</span>
              <span className="arch-footer-chain">
                <code>obs(8×50×50)</code> →{' '}
                {archConfig.spatial_blocks.map((b, i) => (
                  <React.Fragment key={b.id}>
                    <b style={{ color: '#60a5fa' }}>
                      {LAYER_META[b.type].short}
                      {b.filters ? `(${b.filters}, ${b.kernel_size ?? 3}×${b.kernel_size ?? 3}, p=${b.padding ?? 0})` : ''}
                    </b>
                    {i < archConfig.spatial_blocks.length - 1 ? ' → ' : ''}
                  </React.Fragment>
                ))}{' '}
                ⇒ <code>[{localAnalysis.spatial_out_shape.join('×')}]</code> →{' '}
                {archConfig.global_blocks.map((b, i) => (
                  <React.Fragment key={b.id}>
                    <b style={{ color: '#34d399' }}>
                      {LAYER_META[b.type].short}
                      {b.filters
                        ? `(${b.filters})`
                        : b.units
                        ? `(${b.units}d)`
                        : b.pool_size
                        ? `(${b.pool_size}×${b.pool_size})`
                        : ''}
                    </b>
                    {i < archConfig.global_blocks.length - 1 ? ' → ' : ''}
                  </React.Fragment>
                ))}{' '}
                ⇒ <code>emb({localAnalysis.embed_dim}d) + ctx(64d)</code> ⇒{' '}
                <b style={{ color: '#fde047' }}>
                  Type(7) • Slot(10) • Tile(50×50) • Critic(1)
                </b>
              </span>
            </div>

            <div className="arch-footer-param-bar-wrap">
              <div className="ai-stacked-bar" style={{ height: 8, width: 220 }}>
                <div
                  style={{
                    width: `${paramSplit.spatialPct}%`,
                    background: '#3b82f6',
                  }}
                  title={`Spatial Stem: ${paramSplit.spatialPct}%`}
                />
                <div
                  style={{
                    width: `${paramSplit.globalPct}%`,
                    background: '#10b981',
                  }}
                  title={`Global Tower: ${paramSplit.globalPct}%`}
                />
                <div
                  style={{
                    width: `${paramSplit.headPct}%`,
                    background: '#facc15',
                  }}
                  title={`Policy & Critic Heads: ${paramSplit.headPct}%`}
                />
              </div>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                Stem {paramSplit.spatialPct}% • Tower {paramSplit.globalPct}% •
                Heads {paramSplit.headPct}%
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
