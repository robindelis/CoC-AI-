import {
  AIEvolutionResult,
  AIInspectResponse,
  AIServerStatus,
} from './aiTypes';

const AI_API_BASE = 'http://localhost:8000/api/ai';

export async function fetchAIServerStatus(): Promise<AIServerStatus | null> {
  try {
    const res = await fetch(`${AI_API_BASE}/status`);
    if (!res.ok) return null;
    return (await res.json()) as AIServerStatus;
  } catch {
    return null;
  }
}

export async function inspectAIPolicy(
  layoutJson: string,
  armyJson: string
): Promise<AIInspectResponse | null> {
  try {
    const res = await fetch(`${AI_API_BASE}/inspect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout_json: layoutJson, army_json: armyJson }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AIInspectResponse;
  } catch {
    return null;
  }
}

export async function startAIPpoTraining(params: {
  episodes: number;
  lr: number;
  ticks_per_step: number;
  layoutJson: string;
  armyJson: string;
}): Promise<boolean> {
  try {
    const res = await fetch(`${AI_API_BASE}/train/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episodes: params.episodes,
        lr: params.lr,
        ticks_per_step: params.ticks_per_step,
        layout_json: params.layoutJson,
        army_json: params.armyJson,
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
