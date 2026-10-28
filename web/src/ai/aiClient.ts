import { ArmyLoadout } from '../types';
import {
  AIEvolutionResult,
  AIInspectResponse,
  AIRolloutResponse,
  AIServerStatus,
  MatchupMode,
  SavedModelMeta,
  TrainingMode,
} from './aiTypes';

const AI_API_BASE = 'http://localhost:8000/api/ai';

export function getArchitectureSvgUrl(detail: 'overview' | 'detailed' = 'overview'): string {
  return `${AI_API_BASE}/architecture.svg?detail=${detail}`;
}

export async function fetchAIServerStatus(): Promise<AIServerStatus | null> {
  try {
    const res = await fetch(`${AI_API_BASE}/status`);
    if (!res.ok) return null;
    return (await res.json()) as AIServerStatus;
  } catch {
    return null;
  }
}

export async function renameTrainedModel(
  oldFilename: string,
  newFilename: string
): Promise<{ success: boolean; models?: SavedModelMeta[]; error?: string }> {
  try {
    const res = await fetch(`${AI_API_BASE}/models/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_filename: oldFilename, new_filename: newFilename }),
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    return (await res.json()) as { success: boolean; models?: SavedModelMeta[]; error?: string };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function fetchArmyPresets(): Promise<{
  all_armies: ArmyLoadout[];
  custom_armies: ArmyLoadout[];
} | null> {
  try {
    const res = await fetch(`${AI_API_BASE}/presets/armies`);
    if (!res.ok) return null;
    return (await res.json()) as { all_armies: ArmyLoadout[]; custom_armies: ArmyLoadout[] };
  } catch {
    return null;
  }
}

export async function saveCustomArmyPreset(army: ArmyLoadout): Promise<boolean> {
  try {
    const res = await fetch(`${AI_API_BASE}/presets/armies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(army),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteCustomArmyPreset(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${AI_API_BASE}/presets/armies/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function inspectAIPolicy(
  layoutJson: string,
  armyJson: string,
  modelFile?: string
): Promise<AIInspectResponse | null> {
  try {
    const res = await fetch(`${AI_API_BASE}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        layout_json: layoutJson,
        army_json: armyJson,
        model_file: modelFile ?? 'latest_attacker.pt',
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AIInspectResponse;
  } catch {
    return null;
  }
}

export async function fetchTrainedModelRollout(params: {
  modelFile: string;
  layoutJson: string;
  armyJson: string;
  deterministic?: boolean;
}): Promise<AIRolloutResponse | null> {
  try {
    const res = await fetch(`${AI_API_BASE}/rollout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_file: params.modelFile,
        layout_json: params.layoutJson,
        army_json: params.armyJson,
        ticks_per_step: 8,
        deterministic: Boolean(params.deterministic),
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AIRolloutResponse;
  } catch {
    return null;
  }
}

export async function startAIPpoTraining(params: {
  episodes: number;
  batchEpisodes: number;
  minibatchSize: number;
  ppoEpochs: number;
  lr: number;
  ticks_per_step: number;
  trainingMode: TrainingMode;
  matchupMode: MatchupMode;
  resumeFrom: string;
  saveName?: string;
  coEvolveDefender: boolean;
  layoutJson: string;
  armyJson: string;
  armiesJson?: string;
  villagesJson?: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${AI_API_BASE}/train/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episodes: params.episodes,
        batch_episodes: params.batchEpisodes,
        minibatch_size: params.minibatchSize,
        ppo_epochs: params.ppoEpochs,
        lr: params.lr,
        ticks_per_step: params.ticks_per_step,
        training_mode: params.trainingMode,
        matchup_mode: params.matchupMode,
        resume_from: params.resumeFrom,
        save_name: params.saveName,
        co_evolve_defender: params.coEvolveDefender,
        layout_json: params.layoutJson,
        army_json: params.armyJson,
        armies_json: params.armiesJson,
        villages_json: params.villagesJson,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function stopAIPpoTraining(): Promise<boolean> {
  try {
    const res = await fetch(`${AI_API_BASE}/train/stop`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runAIDefenderEvolution(params: {
  generations: number;
  populationSize: number;
  baseLayoutJson: string;
}): Promise<AIEvolutionResult | null> {
  try {
    const res = await fetch(`${AI_API_BASE}/evolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generations: params.generations,
        population_size: params.populationSize,
        base_layout_json: params.baseLayoutJson,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AIEvolutionResult;
  } catch {
    return null;
  }
}
