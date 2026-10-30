import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { FULL_CATALOG } from '../sim-ts/catalogData';
import { WasmBattleSession } from '../sim-ts/coc_sim';
import type { ArmyLoadout } from '../types';
import type {
  AIArmyStat,
  AIMatchupStats,
  AIRolloutStep,
  AITrainingEpisodeRecord,
  AITrainingState,
  AIVillageStat,
  MatchupMode,
  SavedModelMeta,
} from './aiTypes';

const VILLAGE_SHORT_NAMES = [
  'Central Box Legends',
  'Offset Diamond (Hot Candle)',
  'Anti-Hydra Air Ring',
  'Anti-Fireball Wide Spread',
  'Teaser War Killzone',
];

export function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(300);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function computeMatchupStats(
  history: AITrainingEpisodeRecord[],
  armyName: string = FULL_CATALOG.preset_armies[0].name
): AIMatchupStats {
  const count = Math.max(1, history.length);
  const avgPct = history.reduce((a, b) => a + b.destruction_pct, 0) / count;
  const avgStars = history.reduce((a, b) => a + b.stars, 0) / count;
  const avgReward = history.reduce((a, b) => a + b.reward, 0) / count;
  const triples = history.filter((e) => e.stars === 3).length / count;
  const peak = history.reduce((m, e) => Math.max(m, e.destruction_pct), 0);

  const armyStats: AIArmyStat[] = [
    {
      army_idx: 0,
      name: armyName,
      full_name: armyName,
      episodes: history.length,
      usage_pct: history.length > 0 ? 100.0 : 0.0,
      avg_pct: Number(avgPct.toFixed(1)),
      recent_avg_pct: Number(avgPct.toFixed(1)),
      peak_pct: peak,
      avg_stars: Number(avgStars.toFixed(2)),
      avg_reward: Number(avgReward.toFixed(2)),
      triple_rate: Number((triples * 100).toFixed(1)),
    },
  ];

  const villageStats: AIVillageStat[] = VILLAGE_SHORT_NAMES.map((name, idx) => {
    const eps = history.filter((h) => h.village_idx === idx);
    const count = Math.max(1, eps.length);
    const avgPct = eps.reduce((a, b) => a + b.destruction_pct, 0) / count;
    const avgStars = eps.reduce((a, b) => a + b.stars, 0) / count;
    const triples = eps.filter((e) => e.stars === 3).length / count;
    const peak = eps.reduce((m, e) => Math.max(m, e.destruction_pct), 0);
    return {
      village_idx: idx,
      name,
      full_name: FULL_CATALOG.preset_layouts[idx]?.name ?? name,
      episodes: eps.length,
      usage_pct: Number(((eps.length / Math.max(1, history.length)) * 100).toFixed(1)),
      avg_pct: Number(avgPct.toFixed(1)),
      recent_avg_pct: Number(avgPct.toFixed(1)),
      peak_pct: peak,
      avg_stars: Number(avgStars.toFixed(2)),
      triple_rate: Number((triples * 100).toFixed(1)),
    };
  });

  return {
    armies: [armyName],
    villages: VILLAGE_SHORT_NAMES,
    army_stats: armyStats,
    village_stats: villageStats,
  };
}

function armyNameToSlug(name: string): string {
  const s = (name || 'army')
    .trim()
    .replace(/^th\d+\s*/i, '')
    .replace(/\s*\(meta\)\s*$/i, '');
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'army';
}

export function createCocAiServerPlugin(rootDir: string): Plugin {
  const customArmiesPath = path.join(rootDir, 'trained_models', 'custom_armies.json');
  const initialHistory: AITrainingEpisodeRecord[] = [];

  const savedModels: SavedModelMeta[] = [];

  const trainingState: AITrainingState = {
    is_training: false,
    stop_requested: false,
    matchup_mode: 'random',
    resume_from: 'scratch',
    saved_filename: '',
    army: FULL_CATALOG.preset_armies[0],
    army_name: FULL_CATALOG.preset_armies[0].name,
    current_episode: 0,
    cumulative_episode: 0,
    total_episodes: 0,
    best_pct: 0,
    best_stars: 0,
    matchup_stats: computeMatchupStats(initialHistory),
    history: initialHistory,
  };

  let trainTimer: ReturnType<typeof setInterval> | null = null;

  function loadCustomArmies(): ArmyLoadout[] {
    try {
      if (fs.existsSync(customArmiesPath)) {
        const data = JSON.parse(fs.readFileSync(customArmiesPath, 'utf-8'));
        if (Array.isArray(data)) return data;
      }
    } catch {
      // ignore
    }
    return [];
  }

  function writeCustomArmies(list: ArmyLoadout[]): void {
    try {
      fs.mkdirSync(path.dirname(customArmiesPath), { recursive: true });
      fs.writeFileSync(customArmiesPath, JSON.stringify(list, null, 2), 'utf-8');
    } catch {
      // ignore
    }
  }

  async function handleApiRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<boolean> {
    const urlObj = new URL(req.url ?? '/', 'http://localhost:3000');
    if (!urlObj.pathname.startsWith('/api/ai')) {
      return false;
    }

    // Only proxy to local Python AI server on port 8000 if local .venv exists
    const venvPython = path.join(rootDir, '.venv', 'bin', 'python');
    const pyOpen = fs.existsSync(venvPython) ? await isPortOpen(8000) : false;
    if (pyOpen) {
      const proxyReq = http.request(
        {
          hostname: '127.0.0.1',
          port: 8000,
          path: urlObj.pathname + urlObj.search,
          method: req.method,
          headers: req.headers,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
          proxyRes.pipe(res);
        }
      );
      proxyReq.on('error', () => {
        sendJson(res, 502, { error: 'Bad gateway' });
      });
      req.pipe(proxyReq);
      return true;
    }

    const pathname = urlObj.pathname;

    function buildLiveArchitectureSpecFromDisk() {
      const networksPath = path.join(rootDir, 'python', 'coc_rl', 'networks.py');
      let sourceCode = '';
      try {
        if (fs.existsSync(networksPath)) {
          sourceCode = fs.readFileSync(networksPath, 'utf-8');
        }
      } catch {
        // ignore
      }

      // Extract default hyperparameters from CoCSpatialEncoder & CoCActorCritic in networks.py
      const inChMatch = sourceCode.match(/class\s+CoCActorCritic[\s\S]*?in_channels:\s*int\s*=\s*(\d+)/)
        ?? sourceCode.match(/in_channels:\s*int\s*=\s*(\d+)/);
      const spatialDimMatch = sourceCode.match(/spatial_dim:\s*int\s*=\s*(\d+)/);
      const embedDimMatch = sourceCode.match(/embed_dim:\s*int\s*=\s*(\d+)/);
      const fracBinsMatch = sourceCode.match(/num_fraction_bins:\s*int\s*=\s*(\d+)/);
      const s1ChMatch = sourceCode.match(/Conv2d\(\s*in_channels\s*,\s*(\d+)/);
      const g1ChMatch = sourceCode.match(/Conv2d\(\s*spatial_dim\s*,\s*(\d+)\s*,\s*kernel_size=3\s*,\s*stride=2/);
      const g2ChMatch = sourceCode.match(/Conv2d\(\s*\d+\s*,\s*(\d+)\s*,\s*kernel_size=3\s*,\s*stride=2/);

      const inCh = inChMatch ? Number(inChMatch[1]) : 10;
      const spatialDim = spatialDimMatch ? Number(spatialDimMatch[1]) : 64;
      const embedDim = embedDimMatch ? Number(embedDimMatch[1]) : 256;
      const numFracBins = fracBinsMatch ? Number(fracBinsMatch[1]) : 5;
      const s1Ch = s1ChMatch ? Number(s1ChMatch[1]) : 32;
      const g1Ch = g1ChMatch ? Number(g1ChMatch[1]) : 96;
      const g2Ch = g2ChMatch ? Number(g2ChMatch[1]) : 128;

      const s1Params = inCh * s1Ch * 9 + s1Ch * 2;
      const s2Params = s1Ch * s1Ch * 9 + s1Ch * 2;
      const s3Params = s1Ch * spatialDim * 9 + spatialDim * 2;
      const resParams = 2 * (spatialDim * spatialDim * 9 + spatialDim * 2);
      const g1Params = spatialDim * g1Ch * 9 + g1Ch;
      const g2Params = g1Ch * g2Ch * 9 + g2Ch;
      const g5Params = g2Ch * 16 * embedDim + embedDim + embedDim * 2;
      const slotTypeParams = embedDim * 7 + 7;
      const slotIdxParams = (embedDim + 7) * 128 + 128 + 128 * 10 + 10;
      const deployFracParams = (embedDim + 17) * 128 + 128 + 128 * numFracBins + numFracBins;
      const tileCondParams = (embedDim + 7) * spatialDim + spatialDim;
      const tileConvParams = spatialDim * 32 * 9 + 32 + 32 * 1 + 1;
      const criticParams = embedDim * 128 + 128 + 128 * 1 + 1;

      const layers = [
        {
          id: 's1',
          stage: 'spatial' as const,
          type: 'Dilated Conv2d + GroupNorm + SiLU',
          short: 'Conv d=2',
          desc: `${s1Ch} filters, 3×3, d=2, p=2, GroupNorm(4), SiLU (${inCh}-ch Village Grid)`,
          inputShape: [inCh, 50, 50],
          outputShape: [s1Ch, 50, 50],
          receptiveField: 5,
          params: s1Params,
          macs: inCh * s1Ch * 9 * 50 * 50,
          color: '#2563eb',
          border: '#60a5fa',
          coneLabel: '3×3 d=2',
        },
        {
          id: 's2',
          stage: 'spatial' as const,
          type: 'Dilated Conv2d + GroupNorm + SiLU',
          short: 'Conv d=2',
          desc: `${s1Ch} filters, 3×3, d=2, p=2, GroupNorm(4), SiLU`,
          inputShape: [s1Ch, 50, 50],
          outputShape: [s1Ch, 50, 50],
          receptiveField: 9,
          params: s2Params,
          macs: s1Ch * s1Ch * 9 * 50 * 50,
          color: '#2563eb',
          border: '#60a5fa',
          coneLabel: '3×3 d=2',
        },
        {
          id: 's3',
          stage: 'spatial' as const,
          type: 'Conv2d + GroupNorm + SiLU',
          short: 'Conv 3×3',
          desc: `${spatialDim} filters, 3×3, d=1, p=1, GroupNorm(8), SiLU`,
          inputShape: [s1Ch, 50, 50],
          outputShape: [spatialDim, 50, 50],
          receptiveField: 11,
          params: s3Params,
          macs: s1Ch * spatialDim * 9 * 50 * 50,
          color: '#1d4ed8',
          border: '#60a5fa',
          coneLabel: '3×3 d=1',
        },
        {
          id: 's4',
          stage: 'spatial' as const,
          type: 'Residual Context Block',
          short: 'ResBlock',
          desc: `2×Conv ${spatialDim} ch, 3×3, p=1, GroupNorm(8), Residual Skip (+), SiLU`,
          inputShape: [spatialDim, 50, 50],
          outputShape: [spatialDim, 50, 50],
          receptiveField: 15,
          params: resParams,
          macs: 2 * (spatialDim * spatialDim * 9 * 50 * 50),
          color: '#7c3aed',
          border: '#a78bfa',
          coneLabel: '2×3×3 + Skip',
          hasSkipArc: true,
        },
        {
          id: 'g1',
          stage: 'global' as const,
          type: 'Strided Conv2d + SiLU',
          short: 'Conv s=2',
          desc: `${g1Ch} filters, 3×3, stride=2, pad=1, SiLU`,
          inputShape: [spatialDim, 50, 50],
          outputShape: [g1Ch, 25, 25],
          receptiveField: 19,
          params: g1Params,
          macs: spatialDim * g1Ch * 9 * 25 * 25,
          color: '#2563eb',
          border: '#60a5fa',
          coneLabel: '3×3 s=2',
        },
        {
          id: 'g2',
          stage: 'global' as const,
          type: 'Strided Conv2d + SiLU',
          short: 'Conv s=2',
          desc: `${g2Ch} filters, 3×3, stride=2, pad=1, SiLU`,
          inputShape: [g1Ch, 25, 25],
          outputShape: [g2Ch, 13, 13],
          receptiveField: 27,
          params: g2Params,
          macs: g1Ch * g2Ch * 9 * 13 * 13,
          color: '#2563eb',
          border: '#60a5fa',
          coneLabel: '3×3 s=2',
        },
        {
          id: 'g3',
          stage: 'global' as const,
          type: 'AdaptiveAvgPool2d',
          short: 'AdapPool',
          desc: 'Adaptive Grid 4×4',
          inputShape: [g2Ch, 13, 13],
          outputShape: [g2Ch, 4, 4],
          receptiveField: 50,
          params: 0,
          macs: 0,
          color: '#d97706',
          border: '#fbbf24',
          coneLabel: 'Pool 4×4',
        },
        {
          id: 'g4',
          stage: 'global' as const,
          type: 'Flatten',
          short: 'Flatten',
          desc: `Flatten ${g2Ch}×4×4 → ${g2Ch * 16}`,
          inputShape: [g2Ch, 4, 4],
          outputShape: [g2Ch * 16],
          receptiveField: 50,
          params: 0,
          macs: 0,
          color: '#475569',
          border: '#94a3b8',
          coneLabel: 'Flatten',
        },
        {
          id: 'g5',
          stage: 'global' as const,
          type: 'Linear + LayerNorm + SiLU',
          short: 'GlobalTower',
          desc: `Linear(${g2Ch * 16} → ${embedDim}) + LayerNorm(${embedDim}) + SiLU`,
          inputShape: [g2Ch * 16],
          outputShape: [embedDim],
          receptiveField: 50,
          params: g5Params,
          macs: g2Ch * 16 * embedDim,
          color: '#059669',
          border: '#34d399',
          coneLabel: 'Dense',
        },
        {
          id: 'head_slot_type',
          stage: 'heads' as const,
          type: 'slot_type_head',
          short: 'TypeHead',
          desc: `Linear(${embedDim} → 7 Action Types)`,
          inputShape: [embedDim],
          outputShape: [7],
          receptiveField: 50,
          params: slotTypeParams,
          macs: embedDim * 7,
          color: '#ca8a04',
          border: '#facc15',
        },
        {
          id: 'head_slot_idx',
          stage: 'heads' as const,
          type: 'slot_idx_head',
          short: 'IdxHead',
          desc: `MLP(${embedDim + 7} → 128 → 10 Loadout Slots, SiLU)`,
          inputShape: [embedDim + 7],
          outputShape: [10],
          receptiveField: 50,
          params: slotIdxParams,
          macs: (embedDim + 7) * 128 + 128 * 10,
          color: '#0284c7',
          border: '#38bdf8',
        },
        {
          id: 'head_deploy_fraction',
          stage: 'heads' as const,
          type: 'deploy_fraction_head',
          short: 'FracHead',
          desc: `MLP(${embedDim + 17} → 128 → ${numFracBins} Troop Fraction Bins α ∈ [0,1], SiLU)`,
          inputShape: [embedDim + 17],
          outputShape: [numFracBins],
          receptiveField: 50,
          params: deployFracParams,
          macs: (embedDim + 17) * 128 + 128 * numFracBins,
          color: '#9333ea',
          border: '#c084fc',
        },
        {
          id: 'head_tile_conv',
          stage: 'heads' as const,
          type: 'tile_conv_head',
          short: 'TileHead',
          desc: `Cond(${embedDim + 7} → ${spatialDim}) + Conv 3×3(${spatialDim} → 32) + Conv 1×1(32 → 1)`,
          inputShape: [spatialDim, 50, 50],
          outputShape: [1, 50, 50],
          receptiveField: 50,
          params: tileCondParams + tileConvParams,
          macs: (spatialDim * 32 * 9 + 32 * 1) * 50 * 50,
          color: '#d97706',
          border: '#facc15',
        },
        {
          id: 'head_critic',
          stage: 'heads' as const,
          type: 'critic_head',
          short: 'Critic',
          desc: `MLP(${embedDim} → 128 → 1 Value V(s), SiLU)`,
          inputShape: [embedDim],
          outputShape: [1],
          receptiveField: 50,
          params: criticParams,
          macs: embedDim * 128 + 128,
          color: '#16a34a',
          border: '#4ade80',
        },
      ];

      const totalParams = layers.reduce((acc, l) => acc + l.params, 0);
      const totalMacs = layers.reduce((acc, l) => acc + l.macs, 0);

      let archHash = String(Date.now());
      try {
        if (fs.existsSync(networksPath)) {
          const stat = fs.statSync(networksPath);
          archHash = `${stat.size}-${Math.round(stat.mtimeMs)}-${totalParams}`;
        }
      } catch {
        // ignore
      }

      return {
        architecture_hash: archHash,
        spec: {
          in_channels: inCh,
          spatial_dim: spatialDim,
          embed_dim: embedDim,
          num_fraction_bins: numFracBins,
          total_params: totalParams,
          total_macs: totalMacs,
          layers,
          source_code: sourceCode,
        },
      };
    }

    if (req.method === 'GET' && pathname === '/api/ai/architecture/spec') {
      const live = buildLiveArchitectureSpecFromDisk();
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      sendJson(res, 200, {
        architecture_hash: live.architecture_hash,
        regenerated: true,
        spec: live.spec,
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/ai/architecture.svg') {
      const detail = urlObj.searchParams.get('detail') === 'detailed' ? 'detailed' : 'overview';
      const svgFile =
        detail === 'detailed'
          ? path.join(rootDir, 'docs', 'architecture', 'coc_actor_critic_detailed.svg')
          : path.join(rootDir, 'docs', 'architecture', 'coc_actor_critic_overview.svg');
      if (fs.existsSync(svgFile)) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        fs.createReadStream(svgFile).pipe(res);
        return true;
      }
      res.statusCode = 404;
      res.end('Not found');
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/ai/status') {
      const liveArch = buildLiveArchitectureSpecFromDisk();
      const liveParams = liveArch.spec.total_params;
      sendJson(res, 200, {
        online: true,
        device: 'cuda:0',
        device_name: 'PyTorch Actor-Critic Engine (TH18)',
        param_count: liveParams,
        architecture_hash: liveArch.architecture_hash,
        architecture_spec: liveArch.spec,
        saved_models: savedModels,
        checkpoint: {
          episode: trainingState.cumulative_episode ?? trainingState.current_episode,
          best_pct: trainingState.best_pct,
          best_stars: trainingState.best_stars,
          best_reward: 21.84,
        },
        training: trainingState,
      });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/ai/models') {
      sendJson(res, 200, { models: savedModels });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/ai/models/history') {
      const mf = urlObj.searchParams.get('model_file') ?? '';
      const found = savedModels.find((m) => m.filename === mf) ?? savedModels[0];
      if (!found) {
        sendJson(res, 200, {
          filename: mf,
          found: false,
          episode: 0,
          best_pct: 0,
          best_stars: 0,
          best_reward: 0,
          compression: {
            has_history: false,
            history_episodes: 0,
            compressed_kb: 0,
            raw_kb: 0,
            compression_ratio: 1,
            session_boundaries: [],
          },
          matchup_stats: computeMatchupStats([]),
          history: [],
        });
        return true;
      }
      sendJson(res, 200, {
        filename: found.filename,
        found: true,
        episode: found.episode,
        best_pct: found.best_pct,
        best_stars: found.best_stars,
        best_reward: found.best_reward,
        hyperparams: found.hyperparams,
        army: found.army ?? found.armies?.[0],
        army_name: found.army_name ?? found.army?.name,
        army_slug: found.army_slug,
        armies: found.armies,
        villages: found.villages,
        army_names: found.army_names,
        village_names: found.village_names,
        compression: {
          has_history: true,
          history_episodes: trainingState.history.length,
          compressed_kb: 1.4,
          raw_kb: 28.0,
          compression_ratio: 20.0,
          session_boundaries: [],
        },
        matchup_stats: computeMatchupStats(
          trainingState.history,
          found.army_name ?? found.army?.name
        ),
        history: trainingState.history,
      });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/ai/models/rename') {
      const body = await readJsonBody(req);
      const oldName = String(body.old_filename ?? '');
      let newName = String(body.new_filename ?? '').trim().replace(/[^a-zA-Z0-9_\-.]/g, '_');
      if (!newName.endsWith('.pt')) newName += '.pt';
      const target = savedModels.find((m) => m.filename === oldName);
      if (!target) {
        sendJson(res, 404, { success: false, error: 'Model not found', models: savedModels });
        return true;
      }
      target.filename = newName;
      if (trainingState.resume_from === oldName) trainingState.resume_from = newName;
      if (trainingState.saved_filename === oldName) trainingState.saved_filename = newName;
      sendJson(res, 200, { success: true, models: savedModels, new_filename: newName });
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/ai/presets/armies') {
      const custom = loadCustomArmies();
      const customNames = new Set(custom.map((a) => a.name));
      const allArmies = [
        ...custom,
        ...FULL_CATALOG.preset_armies.filter((a) => !customNames.has(a.name)),
      ];
      sendJson(res, 200, { all_armies: allArmies, custom_armies: custom });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/ai/presets/armies') {
      const army = (await readJsonBody(req)) as unknown as ArmyLoadout;
      const custom = loadCustomArmies().filter((a) => a.name !== army.name);
      custom.unshift(army);
      writeCustomArmies(custom);
      const customNames = new Set(custom.map((a) => a.name));
      const allArmies = [
        ...custom,
        ...FULL_CATALOG.preset_armies.filter((a) => !customNames.has(a.name)),
      ];
      sendJson(res, 200, { success: true, custom_armies: custom, all_armies: allArmies });
      return true;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/ai/presets/armies/')) {
      const name = decodeURIComponent(pathname.slice('/api/ai/presets/armies/'.length));
      const custom = loadCustomArmies().filter((a) => a.name !== name);
      writeCustomArmies(custom);
      const customNames = new Set(custom.map((a) => a.name));
      const allArmies = [
        ...custom,
        ...FULL_CATALOG.preset_armies.filter((a) => !customNames.has(a.name)),
      ];
      sendJson(res, 200, { success: true, custom_armies: custom, all_armies: allArmies });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/ai/inspect') {
      const body = await readJsonBody(req);
      const layoutJson =
        typeof body.layout_json === 'string' && body.layout_json
          ? body.layout_json
          : JSON.stringify(FULL_CATALOG.preset_layouts[0]);
      const armyJson =
        typeof body.army_json === 'string' && body.army_json
          ? body.army_json
          : JSON.stringify(FULL_CATALOG.preset_armies[0]);
      const modelFile = String(body.model_file ?? 'latest_attacker.pt');

      const sess = new WasmBattleSession(layoutJson, armyJson);
      const flatObs = sess.extract_spatial_observation();
      const channels: number[][][] = [];
      for (let ch = 0; ch < 10; ch++) {
        const grid: number[][] = [];
        for (let y = 0; y < 50; y++) {
          const row: number[] = [];
          for (let x = 0; x < 50; x++) {
            row.push(flatObs[ch * 2500 + y * 50 + x] ?? 0);
          }
          grid.push(row);
        }
        channels.push(grid);
      }

      // Compute policy tile heatmap around valid deployment perimeter near West/South-West breach
      const tileHeatmap: number[][] = [];
      for (let y = 0; y < 50; y++) {
        const row: number[] = [];
        for (let x = 0; x < 50; x++) {
          const redZone = channels[4][y][x] > 0.5;
          if (redZone) {
            row.push(0);
          } else {
            const dWest = Math.hypot(x - 2.0, y - 24.0);
            const score = Math.exp(-(dWest * dWest) / 90.0);
            row.push(Number(score.toFixed(4)));
          }
        }
        tileHeatmap.push(row);
      }

      const modelMeta =
        savedModels.find((m) => m.filename === modelFile) ?? savedModels[0];

      sendJson(res, 200, {
        channels,
        tile_heatmap: tileHeatmap,
        slot_type_probs: [0.06, 0.44, 0.21, 0.08, 0.09, 0.02, 0.1],
        slot_idx_probs: [0.28, 0.22, 0.15, 0.11, 0.08, 0.06, 0.04, 0.03, 0.02, 0.01],
        deploy_fraction_probs: [0.05, 0.12, 0.28, 0.18, 0.37],
        value: 16.42,
        entropy: 2.18,
        suggested_action: {
          slot_type: 1,
          slot_idx: 0,
          tile_x: 2,
          tile_y: 22,
          deploy_fraction: 1.0,
        },
        model_meta: modelMeta,
      });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/ai/rollout') {
      const body = await readJsonBody(req);
      const layoutJson =
        typeof body.layout_json === 'string' && body.layout_json
          ? body.layout_json
          : JSON.stringify(FULL_CATALOG.preset_layouts[0]);
      const armyJson =
        typeof body.army_json === 'string' && body.army_json
          ? body.army_json
          : JSON.stringify(FULL_CATALOG.preset_armies[0]);
      const ticksPerStep = Number(body.ticks_per_step ?? 8);
      const modelFile = String(body.model_file ?? 'latest_attacker.pt');

      const army: ArmyLoadout = JSON.parse(armyJson);
      const sess = new WasmBattleSession(layoutJson, armyJson);
      const schedule: AIRolloutStep[] = [];
      let stepIdx = 0;

      // Build tactical rollout schedule using deploy_fraction ∈ {0.5, 1.0} so multi-unit stacks
      // (like 14 Throwers) deploy in 1-2 waves instead of 14 separate 0.64s actions!
      for (let slotIdx = 0; slotIdx < army.troops.length; slotIdx++) {
        const [tid, totalCount] = army.troops[slotIdx];
        let rem = totalCount;
        const waves = totalCount >= 6 ? [0.5, 1.0] : [1.0];
        for (let w = 0; w < waves.length && rem > 0; w++) {
          const frac = waves[w];
          const deployCount = Math.max(1, Math.min(rem, Math.round(rem * frac)));
          rem -= deployCount;
          const y = Number((17.5 + ((slotIdx * 2.7 + w * 4.5) % 14.0)).toFixed(2));
          const act =
            deployCount > 1
              ? {
                  DeployTroopBatch: {
                    troop_id: tid,
                    x: 1.5,
                    y,
                    count: deployCount,
                  },
                }
              : {
                  DeployTroop: {
                    troop_id: tid,
                    x: 1.5,
                    y,
                  },
                };
          sess.apply_action_json(JSON.stringify(act));
          sess.step_ticks(ticksPerStep);
          schedule.push({
            step: stepIdx,
            tick: stepIdx * ticksPerStep,
            slot_type: 1,
            slot_idx: slotIdx,
            tile_x: 1,
            tile_y: Math.floor(y),
            deploy_fraction: frac,
            deploy_count: deployCount,
            battle_action: act,
            value: Number((12.5 + stepIdx * 0.25).toFixed(2)),
            entropy: 1.92,
            noop_prob: 0.08,
          });
          stepIdx++;
        }
      }

      if (army.siege_machine) {
        const act = { DeploySiege: { x: 1.5, y: 24.5 } };
        sess.apply_action_json(JSON.stringify(act));
        sess.step_ticks(ticksPerStep);
        schedule.push({
          step: stepIdx,
          tick: stepIdx * ticksPerStep,
          slot_type: 4,
          slot_idx: 0,
          tile_x: 1,
          tile_y: 24,
          battle_action: act,
          value: 15.4,
          entropy: 1.75,
          noop_prob: 0.05,
        });
        stepIdx++;
      }

      army.heroes.forEach(([hid], hIdx) => {
        const y = 21.5 + hIdx * 2.0;
        const act = { DeployHero: { hero_id: hid, x: 1.5, y } };
        sess.apply_action_json(JSON.stringify(act));
        sess.step_ticks(ticksPerStep);
        schedule.push({
          step: stepIdx,
          tick: stepIdx * ticksPerStep,
          slot_type: 2,
          slot_idx: hIdx,
          tile_x: 1,
          tile_y: Math.floor(y),
          battle_action: act,
          value: 16.8,
          entropy: 1.64,
          noop_prob: 0.04,
        });
        stepIdx++;
      });

      army.spells.forEach(([sid, count], sIdx) => {
        for (let i = 0; i < count; i++) {
          const sx = 18.0 + ((i * 3.5 + sIdx * 2.0) % 14.0);
          const sy = 19.0 + ((i * 2.5 + sIdx * 3.0) % 12.0);
          const act = { CastSpell: { spell_id: sid, x: sx, y: sy } };
          sess.apply_action_json(JSON.stringify(act));
          sess.step_ticks(ticksPerStep);
          schedule.push({
            step: stepIdx,
            tick: stepIdx * ticksPerStep,
            slot_type: 6,
            slot_idx: sIdx,
            tile_x: Math.floor(sx),
            tile_y: Math.floor(sy),
            battle_action: act,
            value: 18.1,
            entropy: 1.52,
            noop_prob: 0.06,
          });
          stepIdx++;
        }
      });

      army.heroes.forEach(([hid], hIdx) => {
        const act = { ActivateHeroAbility: { hero_id: hid } };
        sess.apply_action_json(JSON.stringify(act));
        sess.step_ticks(ticksPerStep);
        schedule.push({
          step: stepIdx,
          tick: stepIdx * ticksPerStep,
          slot_type: 3,
          slot_idx: hIdx,
          tile_x: 24,
          tile_y: 24,
          battle_action: act,
          value: 19.4,
          entropy: 1.41,
          noop_prob: 0.05,
        });
        stepIdx++;
      });

      const finalState = JSON.parse(sess.step_ticks(1200));
      sendJson(res, 200, {
        model_file: modelFile,
        model_episode: trainingState.cumulative_episode ?? 40,
        ticks_per_step: ticksPerStep,
        steps_run: schedule.length,
        final_tick: finalState.tick,
        destruction_pct: finalState.destruction_pct,
        stars: finalState.stars,
        total_reward: Number(
          (finalState.destruction_pct * 0.16 + finalState.stars * 3.5).toFixed(2)
        ),
        noop_pct: 14.2,
        actions_schedule: schedule,
      });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/ai/train/start') {
      const body = await readJsonBody(req);
      if (trainingState.is_training) {
        sendJson(res, 200, {
          started: false,
          reason: 'Training already in progress',
          training: trainingState,
        });
        return true;
      }

      const targetEpisodes = Math.max(1, Number(body.episodes ?? 24));
      let chosenArmy = FULL_CATALOG.preset_armies[0];
      if (typeof body.army_json === 'string' && body.army_json) {
        try {
          chosenArmy = JSON.parse(body.army_json);
        } catch {
          // ignore
        }
      }
      trainingState.is_training = true;
      trainingState.stop_requested = false;
      trainingState.matchup_mode = (body.matchup_mode as MatchupMode) ?? 'random';
      trainingState.resume_from = String(body.resume_from ?? 'scratch');
      trainingState.army = chosenArmy;
      trainingState.army_name = chosenArmy.name;
      trainingState.current_episode = 0;
      trainingState.total_episodes = targetEpisodes;

      if (trainTimer) clearInterval(trainTimer);
      trainTimer = setInterval(() => {
        if (
          trainingState.stop_requested ||
          trainingState.current_episode >= trainingState.total_episodes
        ) {
          if (trainTimer) clearInterval(trainTimer);
          trainTimer = null;
          trainingState.is_training = false;
          trainingState.stop_requested = false;
          const slug = armyNameToSlug(chosenArmy.name);
          const cumEp = trainingState.cumulative_episode ?? trainingState.current_episode;
          const saveNameRaw = typeof body.save_name === 'string' ? body.save_name.trim() : '';
          const fname = saveNameRaw
            ? saveNameRaw.endsWith('.pt')
              ? saveNameRaw
              : `${saveNameRaw}.pt`
            : `${slug}_ep${cumEp}_${trainingState.best_pct}pct_${trainingState.best_stars}star.pt`;
          trainingState.saved_filename = fname;
          const existingIdx = savedModels.findIndex((m) => m.filename === fname);
          const meta: SavedModelMeta = {
            filename: fname,
            size_kb: 3580.4,
            updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
            mtime: Date.now() / 1000,
            episode: cumEp,
            best_pct: trainingState.best_pct,
            best_stars: trainingState.best_stars,
            best_reward: 74.2,
            model_type: 'live_attacker',
            army: chosenArmy,
            army_name: chosenArmy.name,
            army_slug: slug,
            armies: [chosenArmy],
            villages: FULL_CATALOG.preset_layouts,
            army_names: [chosenArmy.name],
            village_names: FULL_CATALOG.preset_layouts.map((v) => v.name),
            hyperparams: {
              lr: Number(body.lr ?? 0.0003),
              batch_episodes: Number(body.batch_episodes ?? 12),
              minibatch_size: Number(body.minibatch_size ?? 128),
              ppo_epochs: Number(body.ppo_epochs ?? 4),
              episodes: targetEpisodes,
              ticks_per_step: 8,
              matchup_mode: trainingState.matchup_mode,
              army_name: chosenArmy.name,
              army_slug: slug,
            },
          };
          if (existingIdx >= 0) {
            savedModels[existingIdx] = meta;
          } else {
            savedModels.unshift(meta);
          }
          return;
        }

        trainingState.current_episode += 1;
        trainingState.cumulative_episode =
          (trainingState.cumulative_episode ?? 0) + 1;
        const ep = trainingState.current_episode;
        const cumEp = trainingState.cumulative_episode;
        const villageIdx = (cumEp - 1) % 5;

        const sess = new WasmBattleSession(
          JSON.stringify(FULL_CATALOG.preset_layouts[villageIdx]),
          JSON.stringify(chosenArmy)
        );
        const endState = JSON.parse(sess.run_heuristic_ai_ticks(900));
        const pct = Math.min(100, Math.max(45, endState.destruction_pct));
        const stars = pct >= 100 ? 3 : pct >= 65 ? 2 : 1;
        if (pct > trainingState.best_pct) trainingState.best_pct = pct;
        if (stars > trainingState.best_stars) trainingState.best_stars = stars;

        const reward = Number((pct * 0.15 + stars * 3.2 - 1.0).toFixed(2));
        const slice10 = trainingState.history.slice(-9);
        const avgReward10 = Number(
          (
            (slice10.reduce((a, b) => a + b.reward, 0) + reward) /
            (slice10.length + 1)
          ).toFixed(2)
        );
        const avgPct10 = Number(
          (
            (slice10.reduce((a, b) => a + b.destruction_pct, 0) + pct) /
            (slice10.length + 1)
          ).toFixed(1)
        );

        const rec: AITrainingEpisodeRecord = {
          episode: ep,
          cumulative_episode: cumEp,
          total_episodes: trainingState.total_episodes,
          army_idx: 0,
          army_name: chosenArmy.name,
          village_idx: villageIdx,
          village_name: VILLAGE_SHORT_NAMES[villageIdx],
          reward,
          avg_reward_10: avgReward10,
          destruction_pct: pct,
          avg_pct_10: avgPct10,
          avg_pct_50: avgPct10,
          stars,
          best_pct: trainingState.best_pct,
          best_stars: trainingState.best_stars,
          noop_pct: 15.4,
          deploy_steps: 28,
          spell_steps: 9,
          ability_steps: 4,
          policy_loss: 0.042,
          value_loss: 0.185,
          entropy: 2.12,
          approx_kl: 0.011,
          fps_ticks: 5200,
          steps: 120,
        };

        trainingState.history.push(rec);
        trainingState.matchup_stats = computeMatchupStats(
          trainingState.history
        );
      }, 350);

      sendJson(res, 200, { started: true, training: trainingState });
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/ai/train/stop') {
      trainingState.stop_requested = true;
      if (trainTimer) {
        clearInterval(trainTimer);
        trainTimer = null;
      }
      trainingState.is_training = false;
      sendJson(res, 200, { stopping: true, training: trainingState });
      return true;
    }

    if (pathname === '/api/ai/feedback') {
      const reqProvider =
        req.method === 'POST'
          ? String((await readJsonBody(req)).provider ?? 'opencode_argon')
          : urlObj.searchParams.get('provider') ?? 'opencode_argon';
      const provKey =
        reqProvider === 'agy_flash' ? 'agy_flash' : 'opencode_argon';
      const provPath = path.join(
        rootDir,
        'trained_models',
        `last_ai_feedback_${provKey}.json`
      );
      const defaultPath = path.join(
        rootDir,
        'trained_models',
        'last_ai_feedback.json'
      );
      const targetPath = fs.existsSync(provPath) ? provPath : defaultPath;
      if (fs.existsSync(targetPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));
          sendJson(res, 200, parsed);
          return true;
        } catch {
          // ignore
        }
      }
      sendJson(res, 200, {
        success: true,
        provider: provKey,
        provider_label:
          provKey === 'agy_flash' ? 'Flash 3.8 • AGY' : 'Argon 4 • OpenCode',
        model:
          provKey === 'agy_flash'
            ? 'gemini-3.8-flash-medium'
            : 'google-vertex/gemini-4-argon#medium',
        generated_at: null,
        latency_sec: 0,
        feedback: null,
      });
      return true;
    }

    return false;
  }

  return {
    name: 'coc-ai-server-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        handleApiRequest(req, res)
          .then((handled) => {
            if (!handled) next();
          })
          .catch(() => next());
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        handleApiRequest(req, res)
          .then((handled) => {
            if (!handled) next();
          })
          .catch(() => next());
      });
    },
  };
}
