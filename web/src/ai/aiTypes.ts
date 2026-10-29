import { ArmyLoadout, VillageLayout } from '../types';

export type MatchupMode =
  | 'random'
  | 'round_robin'
  | 'fixed_current';

export interface AISessionBoundary {
  session_id: number;
  start_ep: number;
  resumed_from?: string;
}

export interface AIModelHistoryCompressionMeta {
  has_history: boolean;
  history_episodes: number;
  compressed_kb: number;
  raw_kb: number;
  compression_ratio: number;
  session_boundaries: AISessionBoundary[];
}

export interface SavedModelMeta {
  filename: string;
  size_kb: number;
  updated_at: string;
  mtime: number;
  episode: number;
  best_pct: number;
  best_stars: number;
  best_reward: number;
  model_type: string;
  armies?: ArmyLoadout[];
  villages?: VillageLayout[];
  army_names?: string[];
  village_names?: string[];
  has_history?: boolean;
  history_episodes?: number;
  compressed_kb?: number;
  raw_kb?: number;
  compression_ratio?: number;
  session_boundaries?: AISessionBoundary[];
  hyperparams?: {
    lr?: number;
    batch_episodes?: number;
    minibatch_size?: number;
    ppo_epochs?: number;
    episodes?: number;
    ticks_per_step?: number;
    matchup_mode?: string;
    resumed_from?: string;
  };
}

export interface AITrainingEpisodeRecord {
  episode: number;
  cumulative_episode?: number;
  total_episodes: number;
  army_idx?: number;
  army_name?: string;
  village_idx?: number;
  village_name?: string;
  reward: number;
  reward_destr?: number;
  reward_stars?: number;
  reward_damage?: number;
  v_s0?: number;
  avg_reward_10: number;
  destruction_pct: number;
  avg_pct_10?: number;
  avg_pct_50?: number;
  stars: number;
  best_pct: number;
  best_stars: number;
  noop_pct?: number;
  deploy_steps?: number;
  spell_steps?: number;
  ability_steps?: number;
  policy_loss: number;
  value_loss: number;
  entropy: number;
  approx_kl: number;
  clip_fraction?: number;
  grad_norm?: number;
  explained_variance?: number;
  entropy_type?: number;
  entropy_idx?: number;
  entropy_frac?: number;
  entropy_tile?: number;
  fps_ticks: number;
  steps: number;
}

export interface AIModelHistoryResponse {
  filename: string;
  found: boolean;
  episode: number;
  best_pct: number;
  best_stars: number;
  best_reward: number;
  hyperparams?: SavedModelMeta['hyperparams'];
  armies?: ArmyLoadout[];
  villages?: VillageLayout[];
  army_names?: string[];
  village_names?: string[];
  compression: AIModelHistoryCompressionMeta;
  matchup_stats: AIMatchupStats;
  history: AITrainingEpisodeRecord[];
}

export interface AIArmyStat {
  army_idx: number;
  name: string;
  full_name: string;
  episodes: number;
  usage_pct?: number;
  avg_pct: number;
  recent_avg_pct?: number;
  peak_pct?: number;
  avg_stars: number;
  avg_reward: number;
  triple_rate: number;
}

export interface AIVillageStat {
  village_idx: number;
  name: string;
  full_name: string;
  episodes: number;
  usage_pct?: number;
  avg_pct: number;
  recent_avg_pct?: number;
  peak_pct?: number;
  avg_stars: number;
  triple_rate: number;
}

export interface AIMatchupStats {
  armies: string[];
  villages: string[];
  army_stats: AIArmyStat[];
  village_stats: AIVillageStat[];
}

export interface AITrainingState {
  is_training: boolean;
  stop_requested: boolean;
  matchup_mode?: MatchupMode;
  resume_from?: string;
  saved_filename?: string;
  current_episode: number;
  cumulative_episode?: number;
  total_episodes: number;
  best_pct: number;
  best_stars: number;
  matchup_stats?: AIMatchupStats | null;
  history: AITrainingEpisodeRecord[];
}

export interface AIArchitectureLayerSpec {
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

export interface AIArchitectureSpec {
  in_channels: number;
  spatial_dim: number;
  embed_dim: number;
  army_context_dim: number;
  num_fraction_bins: number;
  total_params: number;
  total_macs: number;
  layers: AIArchitectureLayerSpec[];
  source_code?: string;
}

export interface AIServerStatus {
  online: boolean;
  device: string;
  device_name: string;
  param_count: number;
  architecture_hash?: string;
  architecture_spec?: AIArchitectureSpec;
  saved_models?: SavedModelMeta[];
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
  deploy_fraction_probs?: number[];
  value: number;
  entropy: number;
  suggested_action: {
    slot_type: number;
    slot_idx: number;
    tile_x: number;
    tile_y: number;
    deploy_fraction?: number;
  };
  model_meta?: SavedModelMeta;
}

export interface AIRolloutStep {
  step: number;
  tick: number;
  slot_type: number;
  slot_idx: number;
  tile_x: number;
  tile_y: number;
  deploy_fraction?: number;
  deploy_count?: number;
  battle_action: unknown | null;
  value: number;
  entropy: number;
  noop_prob: number;
}

export interface AIRolloutResponse {
  model_file: string;
  model_episode: number;
  ticks_per_step: number;
  steps_run: number;
  final_tick: number;
  destruction_pct: number;
  stars: number;
  total_reward: number;
  noop_pct: number;
  actions_schedule: AIRolloutStep[];
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
  { id: 8, label: 'Ch 8 • Allied Unit Types φ(u)', color: '#14b8a6' },
  { id: 9, label: 'Ch 9 • Enemy CC / Hero / Skeleton Types φ(u)', color: '#f43f5e' },
  { id: 10, label: 'Policy Tile Heatmap', color: '#f59e0b' },
] as const;

export const SLOT_TYPE_LABELS = [
  'NoOp (Wait)',
  'Deploy Troop',
  'Deploy Hero',
  'Hero Ability',
  'Deploy Siege',
  'Pop Siege',
  'Cast Spell',
] as const;

export type AIFeedbackProviderId = 'opencode_argon' | 'agy_flash';

export interface AIFeedbackIssue {
  title: string;
  severity: 'critical' | 'warning' | 'info';
  symptom: string;
  root_cause: string;
}

export interface AIFeedbackRecommendation {
  action: string;
  target: string;
  rationale: string;
}

export interface AIFeedbackReport {
  health_status: 'progressing' | 'plateaued' | 'degrading' | 'unstable' | 'early_stage';
  health_score: number;
  is_progressing: boolean;
  headline: string;
  progression_summary: string;
  what_is_going_wrong: AIFeedbackIssue[];
  recommendations: AIFeedbackRecommendation[];
}

export interface AITelemetryHeadEntropy {
  entropy: number;
  max_possible: number;
  saturation_pct: number;
  top5_tile_prob_mass_pct?: number;
}

export interface AITelemetryWindowSummary {
  window: string;
  ep_start: number;
  ep_end: number;
  episodes: number;
  mean_pct: number;
  std_pct: number;
  min_pct: number;
  max_pct: number;
  mean_stars: number;
  zero_star_rate_pct: number;
  one_plus_star_rate_pct: number;
  two_plus_star_th_rate_pct: number;
  three_star_triple_rate_pct: number;
  mean_reward: number;
  mean_noop_pct: number;
  mean_steps: number;
  mean_deploy_steps: number;
  mean_spell_steps: number;
  mean_ability_steps: number;
  mean_policy_loss: number;
  mean_value_loss: number;
  mean_entropy: number;
  mean_approx_kl: number;
}

export interface AITrainingTelemetrySummary {
  collected_at: string;
  session: {
    is_training: boolean;
    matchup_mode: string;
    active_checkpoint: string;
    current_episode: number;
    cumulative_episode: number;
    total_episodes: number;
    history_length: number;
    best_pct: number;
    best_stars: number;
    hyperparams: Record<string, unknown>;
  };
  trends: {
    full_run_pct_slope_per_100ep?: number;
    recent_window_episodes?: number;
    recent_pct_slope_per_100ep?: number;
    recent_reward_slope_per_100ep?: number;
    recent_entropy_slope_per_100ep?: number;
    recent_value_loss_slope_per_100ep?: number;
    recent_noop_slope_per_100ep?: number;
    rolling50_peak_pct?: number;
    rolling50_peak_at_episode?: number;
    episodes_since_rolling50_peak?: number;
    current_rolling50_pct?: number;
    drawdown_from_rolling50_peak_pct?: number;
    best_single_ep_pct?: number;
    best_pct_first_at_episode?: number;
    episodes_since_best_pct?: number;
  };
  windows: Record<string, AITelemetryWindowSummary>;
  phases?: AITelemetryWindowSummary[];
  live_model_probe?: {
    probe_duration_ms: number;
    head_entropy_breakdown: {
      slot_type: AITelemetryHeadEntropy;
      slot_idx: AITelemetryHeadEntropy;
      deploy_fraction: AITelemetryHeadEntropy;
      tile_xy: AITelemetryHeadEntropy;
    };
    initial_step_probs?: {
      slot_type_probs: number[];
      deploy_fraction_probs: number[];
    };
    critic_calibration: {
      predicted_v_s0: number;
      pred_value_min: number;
      pred_value_max: number;
      empirical_recent50_return: number | null;
      calibration_gap_v0_minus_return: number | null;
    };
    tactical_rollout_behavior: {
      probe_steps_before_exhaustion: number;
      probe_destruction_pct: number;
      probe_stars: number;
      spatial_deploy_spread_std_tiles: number;
      unique_deploy_tiles_ratio: number;
      troop_deploy_tick_span: [number, number];
      spell_cast_tick_span: [number, number];
      hero_ability_tick_span: [number, number];
    };
    weight_norms_l2?: Record<string, number>;
    has_nan_or_inf_weights?: boolean;
  };
  detected_signals?: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    metric: string;
    detail: string;
  }>;
}

export interface AITrainingFeedbackResponse {
  success: boolean;
  error?: string | null;
  provider: AIFeedbackProviderId;
  provider_label: string;
  model: string;
  generated_at: string | null;
  latency_sec: number;
  feedback: AIFeedbackReport | null;
  telemetry?: AITrainingTelemetrySummary;
  providers?: Record<
    string,
    { id: string; label: string; model: string; cli: string }
  >;
}
