import { VillageLayout } from '../types';

export interface AITrainingEpisodeRecord {
  episode: number;
  total_episodes: number;
  reward: number;
  avg_reward_10: number;
  destruction_pct: number;
  stars: number;
  best_pct: number;
  best_stars: number;
  policy_loss: number;
  value_loss: number;
  entropy: number;
  approx_kl: number;
  fps_ticks: number;
  steps: number;
}

export interface AITrainingState {
  is_training: boolean;
  stop_requested: boolean;
  current_episode: number;
  total_episodes: number;
  best_pct: number;
  best_stars: number;
  history: AITrainingEpisodeRecord[];
}

export interface AIServerStatus {
  online: boolean;
  device: string;
  device_name: string;
  param_count: number;
  checkpoint: {
    episode?: number;
    best_pct?: number;
    best_stars?: number;
    best_reward?: number;
  };
  training: AITrainingState;
}

export interface AIInspectResponse {
  channels: number[][][];
  tile_heatmap: number[][];
  slot_type_probs: number[];
  slot_idx_probs: number[];
  value: number;
  entropy: number;
  suggested_action: {
    slot_type: number;
    slot_idx: number;
    tile_x: number;
    tile_y: number;
  };
}

export interface AIEvolutionGeneration {
  generation: number;
  best_attacker_pct: number;
  best_attacker_stars: number;
  defense_fitness: number;
}

export interface AIEvolutionResult {
  best_layout: VillageLayout;
  generations: AIEvolutionGeneration[];
  validation: {
    is_valid: boolean;
    total_buildings: number;
    total_walls: number;
    total_traps: number;
  };
}

export const SPATIAL_CHANNELS = [
  { id: 0, label: 'Ch 0 • Building HP', color: '#22c55e' },
  { id: 1, label: 'Ch 1 • Defense DPS Threat', color: '#ef4444' },
  { id: 2, label: 'Ch 2 • Town Hall 18', color: '#facc15' },
  { id: 3, label: 'Ch 3 • Wall HP', color: '#6366f1' },
  { id: 4, label: 'Ch 4 • No-Deploy Red Zone', color: '#f87171' },
  { id: 5, label: 'Ch 5 • Ground Attackers', color: '#38bdf8' },
  { id: 6, label: 'Ch 6 • Air Attackers', color: '#c084fc' },
  { id: 7, label: 'Ch 7 • Active Spells', color: '#fb923c' },
  { id: 8, label: 'Policy Tile Heatmap', color: '#f59e0b' },
] as const;

export const SLOT_TYPE_LABELS = [
  'NoOp',
  'Deploy Troop',
  'Deploy Hero',
  'Hero Ability',
  'Deploy Siege',
  'Pop Siege',
  'Cast Spell',
] as const;
