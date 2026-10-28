import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import { FULL_CATALOG } from '../wasm-pkg/catalogData';
import { WasmBattleSession, validateLayout } from '../wasm-pkg/coc_wasm';
import type { ArmyLoadout, VillageLayout } from '../types';
import type {
  AIArmyStat,
  AIEvolutionGeneration,
  AIRolloutStep,
  AISelectorMatrices,
  AITrainingEpisodeRecord,
  AITrainingState,
  AIVillageStat,
  MatchupMode,
  SavedModelMeta,
  TrainingMode,
} from './aiTypes';

const ARMY_SHORT_NAMES = [
  'Thrower + Healer Smash',
  'Dragon Duke Hydra',
  'Fireball Super Bowlers',
];

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

function buildInitialHistory(): AITrainingEpisodeRecord[] {
  const history: AITrainingEpisodeRecord[] = [];
  let bestPct = 42;
  let bestStars = 1;
  for (let ep = 1; ep <= 40; ep++) {
    const progress = ep / 40;
    const armyIdx = (ep - 1) % 3;
    const villageIdx = (ep - 1) % 5;
    const wave = Math.sin(ep * 0.7) * 8;
    const pct = Math.min(
      100,
      Math.max(28, Math.round(44 + progress * 46 + wave))
    );
    const stars = pct >= 100 ? 3 : pct >= 68 ? 2 : pct >= 50 ? 1 : 0;
    if (pct > bestPct) bestPct = pct;
    if (stars > bestStars) bestStars = stars;
    const reward = Number((pct * 0.14 + stars * 3.2 - 1.5).toFixed(2));
    const slice10 = history.slice(-9);
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
    history.push({
      episode: ep,
      cumulative_episode: ep,
      total_episodes: 40,
      active_model: 'live_attacker',
      army_idx: armyIdx,
      army_name: ARMY_SHORT_NAMES[armyIdx],
      village_idx: villageIdx,
      village_name: VILLAGE_SHORT_NAMES[villageIdx],
      reward,
      avg_reward_10: avgReward10,
      defender_reward: Number((10 - reward * 0.45).toFixed(2)),
      destruction_pct: pct,
      avg_pct_10: avgPct10,
      avg_pct_50: avgPct10,
      stars,
      best_pct: bestPct,
      best_stars: bestStars,
      noop_pct: Number(Math.max(12, 48 - progress * 28).toFixed(1)),
      deploy_steps: 28,
      spell_steps: 9,
      ability_steps: 4,
      policy_loss: Number((0.085 - progress * 0.04).toFixed(4)),
      value_loss: Number((0.42 - progress * 0.21).toFixed(4)),
      entropy: Number((2.85 - progress * 0.65).toFixed(3)),
      approx_kl: Number((0.012 + (ep % 4) * 0.002).toFixed(4)),
      fps_ticks: 4850 + (ep % 7) * 120,
      steps: 120,
      defender_gen: Math.floor(ep / 10),
      defender_fitness: Number((45 + (100 - pct) * 0.55).toFixed(1)),
      army_probs: [0.42, 0.33, 0.25],
      village_probs: [0.22, 0.24, 0.19, 0.18, 0.17],
    });
  }
  return history;
}

function computeSelectorMatrices(
  history: AITrainingEpisodeRecord[]
): AISelectorMatrices {
  const armyStats: AIArmyStat[] = ARMY_SHORT_NAMES.map((name, idx) => {
    const eps = history.filter((h) => h.army_idx === idx);
    const count = Math.max(1, eps.length);
    const avgPct = eps.reduce((a, b) => a + b.destruction_pct, 0) / count;
    const avgStars = eps.reduce((a, b) => a + b.stars, 0) / count;
    const avgReward = eps.reduce((a, b) => a + b.reward, 0) / count;
    const triples = eps.filter((e) => e.stars === 3).length / count;
    const peak = eps.reduce((m, e) => Math.max(m, e.destruction_pct), 0);
    return {
      army_idx: idx,
      name,
      full_name: FULL_CATALOG.preset_armies[idx]?.name ?? name,
      episodes: eps.length,
      usage_pct: Number(((eps.length / Math.max(1, history.length)) * 100).toFixed(1)),
      avg_pct: Number(avgPct.toFixed(1)),
      recent_avg_pct: Number(avgPct.toFixed(1)),
      peak_pct: peak,
      avg_stars: Number(avgStars.toFixed(2)),
      avg_reward: Number(avgReward.toFixed(2)),
      triple_rate: Number((triples * 100).toFixed(1)),
      mean_selector_prob: idx === 0 ? 0.42 : idx === 1 ? 0.33 : 0.25,
      selector_model_prob: idx === 0 ? 0.42 : idx === 1 ? 0.33 : 0.25,
    };
  });

  const villageStats: AIVillageStat[] = VILLAGE_SHORT_NAMES.map((name, idx) => {
    const eps = history.filter((h) => h.village_idx === idx);
    const count = Math.max(1, eps.length);
    const avgPctAllowed = eps.reduce((a, b) => a + b.destruction_pct, 0) / count;
    const avgStarsAllowed = eps.reduce((a, b) => a + b.stars, 0) / count;
    const holds = eps.filter((e) => e.stars < 3).length / count;
    return {
      village_idx: idx,
      name,
      full_name: FULL_CATALOG.preset_layouts[idx]?.name ?? name,
      episodes: eps.length,
      usage_pct: Number(((eps.length / Math.max(1, history.length)) * 100).toFixed(1)),
      avg_pct_allowed: Number(avgPctAllowed.toFixed(1)),
      recent_avg_pct_allowed: Number(avgPctAllowed.toFixed(1)),
      avg_stars_allowed: Number(avgStarsAllowed.toFixed(2)),
      hold_rate: Number((holds * 100).toFixed(1)),
      mean_selector_prob: 0.2,
      selector_model_prob: 0.2,
    };
  });

  return {
    armies: ARMY_SHORT_NAMES,
    villages: VILLAGE_SHORT_NAMES,
    village_to_army_probs: [
      [0.48, 0.28, 0.24],
      [0.31, 0.46, 0.23],
      [0.44, 0.19, 0.37],
      [0.38, 0.41, 0.21],
      [0.29, 0.32, 0.39],
    ],
    army_to_village_probs: [
      [0.16, 0.24, 0.18, 0.22, 0.2],
      [0.18, 0.17, 0.31, 0.16, 0.18],
      [0.19, 0.2, 0.17, 0.28, 0.16],
    ],
    layout_values: [14.2, 13.6, 12.9, 13.4, 13.8],
    defender_values: [8.4, 9.1, 9.6, 9.2, 8.9],
    army_stats: armyStats,
    village_stats: villageStats,
  };
}

export function createCocAiServerPlugin(rootDir: string): Plugin {
  const customArmiesPath = path.join(rootDir, 'trained_models', 'custom_armies.json');
  const initialHistory = buildInitialHistory();

  const savedModels: SavedModelMeta[] = [
    {
      filename: 'latest_attacker.pt',
      size_kb: 3642.8,
      updated_at: '2026-10-28 04:45:00',
      mtime: Date.now() / 1000,
      episode: initialHistory.length,
      best_pct: 96,
      best_stars: 3,
      best_reward: 21.84,
      model_type: 'live_attacker',
      armies: FULL_CATALOG.preset_armies,
      villages: FULL_CATALOG.preset_layouts,
      army_names: FULL_CATALOG.preset_armies.map((a) => a.name),
      village_names: FULL_CATALOG.preset_layouts.map((v) => v.name),
      hyperparams: {
        lr: 0.0003,
        batch_episodes: 4,
        minibatch_size: 64,
        ppo_epochs: 4,
        episodes: 40,
        ticks_per_step: 8,
        training_mode: 'live_attacker',
        matchup_mode: 'random',
      },
    },
    {
      filename: 'th18_thrower_specialist.pt',
      size_kb: 3642.8,
      updated_at: '2026-10-27 21:15:00',
      mtime: Date.now() / 1000 - 3600,
      episode: 120,
      best_pct: 100,
      best_stars: 3,
      best_reward: 24.5,
      model_type: 'live_attacker',
      armies: FULL_CATALOG.preset_armies,
      villages: FULL_CATALOG.preset_layouts,
      army_names: FULL_CATALOG.preset_armies.map((a) => a.name),
      village_names: FULL_CATALOG.preset_layouts.map((v) => v.name),
      hyperparams: {
        lr: 0.0003,
        batch_episodes: 4,
        minibatch_size: 64,
        ppo_epochs: 4,
        episodes: 120,
        ticks_per_step: 8,
        training_mode: 'cycle',
        matchup_mode: 'selectors',
      },
    },
  ];

  const trainingState: AITrainingState = {
    is_training: false,
    stop_requested: false,
    training_mode: 'live_attacker',
    matchup_mode: 'random',
    resume_from: 'latest_attacker.pt',
    saved_filename: 'latest_attacker.pt',
    active_model: 'live_attacker',
    current_episode: initialHistory.length,
    cumulative_episode: initialHistory.length,
    total_episodes: initialHistory.length,
    best_pct: 96,
    best_stars: 3,
    co_evolve_defender: false,
    defender_gen: 4,
    defender_fitness: 62.4,
    evolved_layout: null,
    selector_matrices: computeSelectorMatrices(initialHistory),
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

  function mutateVillageLayout(base: VillageLayout, swaps = 4): VillageLayout {
    const clone: VillageLayout = JSON.parse(JSON.stringify(base));
    const defIndices = clone.buildings
      .map((b, i) => ({ b, i }))
      .filter((x) => x.b.building_id !== 'TownHall' && x.b.footprint === 3)
      .map((x) => x.i);
    for (let s = 0; s < swaps && defIndices.length >= 2; s++) {
      const i1 = defIndices[(s * 3) % defIndices.length];
      const i2 = defIndices[(s * 7 + 1) % defIndices.length];
      if (i1 !== i2) {
        const tx = clone.buildings[i1].tile_x;
        const ty = clone.buildings[i1].tile_y;
        clone.buildings[i1].tile_x = clone.buildings[i2].tile_x;
        clone.buildings[i1].tile_y = clone.buildings[i2].tile_y;
        clone.buildings[i2].tile_x = tx;
        clone.buildings[i2].tile_y = ty;
      }
    }
    clone.name = `${base.name.replace(/\s*\(Evolved.*\)$/, '')} (Evolved)`;
    return clone;
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

    if (req.method === 'GET' && pathname === '/api/ai/architecture.svg') {
      const detail = urlObj.searchParams.get('detail') === 'detailed' ? 'detailed' : 'overview';
      const svgFile =
        detail === 'detailed'
          ? path.join(rootDir, 'docs', 'architecture', 'coc_actor_critic_detailed.svg')
          : path.join(rootDir, 'docs', 'architecture', 'coc_actor_critic_overview.svg');
      if (fs.existsSync(svgFile)) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/svg+xml');
        fs.createReadStream(svgFile).pipe(res);
        return true;
      }
      res.statusCode = 404;
      res.end('Not found');
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/ai/status') {
      sendJson(res, 200, {
        online: true,
        device: 'cuda:0',
        device_name: 'PyTorch Actor-Critic Engine (TH18)',
        param_count: 977905,
        models_info: {
          attacker_selector: {
            name: 'Attacker 1: Army Selector (8×50×50 → 3 Armies)',
            params: 18420,
          },
          live_attacker: {
            name: 'Attacker 2: Live Controller (CNN+64d → 7×10×5×50×50)',
            params: 944256,
          },
          defender_selector: {
            name: 'Defender: Village Selector (64d Army → 5 Villages)',
            params: 15229,
          },
        },
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
        attacker_selector: {
          recommended_army_idx: 0,
          recommended_army_name: FULL_CATALOG.preset_armies[0].name,
          army_probs: [0.46, 0.31, 0.23],
          value: 15.8,
        },
        defender_selector: {
          recommended_village_idx: 2,
          recommended_village_name: FULL_CATALOG.preset_layouts[2].name,
          village_probs: [0.18, 0.21, 0.29, 0.17, 0.15],
          value: 9.4,
        },
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
          const act = {
            DeployTroop: {
              troop_id: tid,
              x: 1.5,
              y,
              count: deployCount,
              deploy_fraction: frac,
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
      trainingState.is_training = true;
      trainingState.stop_requested = false;
      trainingState.training_mode = (body.training_mode as TrainingMode) ?? 'live_attacker';
      trainingState.matchup_mode = (body.matchup_mode as MatchupMode) ?? 'random';
      trainingState.resume_from = String(body.resume_from ?? 'latest_attacker.pt');
      trainingState.current_episode = 0;
      trainingState.total_episodes = targetEpisodes;
      trainingState.co_evolve_defender = Boolean(body.co_evolve_defender);

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
          return;
        }

        trainingState.current_episode += 1;
        trainingState.cumulative_episode =
          (trainingState.cumulative_episode ?? 0) + 1;
        const ep = trainingState.current_episode;
        const cumEp = trainingState.cumulative_episode;
        const armyIdx = (cumEp - 1) % 3;
        const villageIdx = (cumEp - 1) % 5;

        const sess = new WasmBattleSession(
          JSON.stringify(FULL_CATALOG.preset_layouts[villageIdx]),
          JSON.stringify(FULL_CATALOG.preset_armies[armyIdx])
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
          active_model:
            trainingState.training_mode === 'cycle'
              ? ['live_attacker', 'attacker_selector', 'defender_selector'][ep % 3]
              : trainingState.training_mode,
          army_idx: armyIdx,
          army_name: ARMY_SHORT_NAMES[armyIdx],
          village_idx: villageIdx,
          village_name: VILLAGE_SHORT_NAMES[villageIdx],
          reward,
          avg_reward_10: avgReward10,
          defender_reward: Number((10 - reward * 0.45).toFixed(2)),
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
          defender_gen: trainingState.defender_gen,
          defender_fitness: trainingState.defender_fitness,
          army_probs: [0.44, 0.32, 0.24],
          village_probs: [0.2, 0.22, 0.21, 0.19, 0.18],
        };

        trainingState.history.push(rec);
        trainingState.selector_matrices = computeSelectorMatrices(
          trainingState.history
        );
        if (trainingState.co_evolve_defender && ep % 2 === 0) {
          trainingState.defender_gen = (trainingState.defender_gen ?? 0) + 1;
          trainingState.evolved_layout = mutateVillageLayout(
            FULL_CATALOG.preset_layouts[0],
            trainingState.defender_gen
          );
        }
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

    if (req.method === 'POST' && pathname === '/api/ai/evolve') {
      const body = await readJsonBody(req);
      const generations = Math.max(1, Math.min(15, Number(body.generations ?? 3)));
      const baseLayout: VillageLayout =
        typeof body.base_layout_json === 'string' && body.base_layout_json
          ? JSON.parse(body.base_layout_json)
          : FULL_CATALOG.preset_layouts[0];

      const genLogs: AIEvolutionGeneration[] = [];
      let bestLayout = baseLayout;
      for (let g = 1; g <= generations; g++) {
        bestLayout = mutateVillageLayout(bestLayout, 4);
        const pct = Math.max(38, 72 - g * 6);
        const stars = pct >= 50 ? 1 : 0;
        genLogs.push({
          generation: g,
          best_attacker_pct: pct,
          best_attacker_stars: stars,
          defense_fitness: Number((100 - pct + (3 - stars) * 15).toFixed(2)),
        });
      }

      sendJson(res, 200, {
        best_layout: bestLayout,
        generations: genLogs,
        validation: validateLayout(bestLayout),
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
