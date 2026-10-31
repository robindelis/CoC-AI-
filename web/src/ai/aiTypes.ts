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
  army?: ArmyLoadout;
  army_name?: string;
  army_slug?: string;
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
    army_name?: string;
    army_slug?: string;
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
  army?: ArmyLoadout;
  army_name?: string;
  army_slug?: string;
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
  army?: ArmyLoadout | null;
  army_name?: string;
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
  recursive_loop?: AIRecursiveLoopState;
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
  army?: ArmyLoadout;
  army_name?: string;
  armies?: ArmyLoadout[];
  villages?: VillageLayout[];
}

export const POLICY_HEATMAP_CHANNEL_ID = 59;

export const SPATIAL_CHANNELS = [
  // Group 1: Base & Environment (0..4)
  { id: 0, label: 'Ch 0 • Building HP Ratio', color: '#22c55e' },
  { id: 1, label: 'Ch 1 • Defense DPS Threat', color: '#ef4444' },
  { id: 2, label: 'Ch 2 • Town Hall 18 Core Mask', color: '#facc15' },
  { id: 3, label: 'Ch 3 • Wall Durability', color: '#6366f1' },
  { id: 4, label: 'Ch 4 • No-Deploy Red Zone', color: '#f87171' },

  // Group 2: Friendly Army Troops, Siege & CC (5..16)
  { id: 5, label: 'Ch 5 • Thrower (Max 12)', color: '#0ea5e9' },
  { id: 6, label: 'Ch 6 • Healer (Max 5)', color: '#ec4899' },
  { id: 7, label: 'Ch 7 • Furnace (Max 2)', color: '#f97316' },
  { id: 8, label: 'Ch 8 • Druid & Bear (Max 1)', color: '#10b981' },
  { id: 9, label: 'Ch 9 • Ice Golem (Max 1)', color: '#38bdf8' },
  { id: 10, label: 'Ch 10 • Super Wall Breaker (Max 1)', color: '#eab308' },
  { id: 11, label: 'Ch 11 • Headhunter (Max 1)', color: '#a855f7' },
  { id: 12, label: 'Ch 12 • Balloon (Max 1)', color: '#f43f5e' },
  { id: 13, label: 'Ch 13 • Archer (Max 4)', color: '#ec4899' },
  { id: 14, label: 'Ch 14 • Log Launcher Siege (Max 1)', color: '#d97706' },
  { id: 15, label: 'Ch 15 • CC Super Yeti (Max 1)', color: '#06b6d4' },
  { id: 16, label: 'Ch 16 • CC Super Valkyrie (Max 1)', color: '#fb7185' },

  // Group 3: Friendly Heroes (17..20)
  { id: 17, label: 'Ch 17 • Barbarian King', color: '#eab308' },
  { id: 18, label: 'Ch 18 • Archer Queen', color: '#c084fc' },
  { id: 19, label: 'Ch 19 • Grand Warden', color: '#60a5fa' },
  { id: 20, label: 'Ch 20 • Royal Champion', color: '#34d399' },

  // Group 4: Friendly Spells (21..24)
  { id: 21, label: 'Ch 21 • Totem Spell (HP)', color: '#a78bfa' },
  { id: 22, label: 'Ch 22 • Rage Spell (Fade)', color: '#f43f5e' },
  { id: 23, label: 'Ch 23 • Poison Spell (Fade)', color: '#e11d48' },
  { id: 24, label: 'Ch 24 • Skeleton Spell (Fade)', color: '#94a3b8' },

  // Group 5: Enemy Defending Units (25..33)
  { id: 25, label: 'Ch 25 • Enemy CC & Guardian', color: '#e11d48' },
  { id: 26, label: 'Ch 26 • Defending Barbarian King', color: '#eab308' },
  { id: 27, label: 'Ch 27 • Defending Archer Queen', color: '#c084fc' },
  { id: 28, label: 'Ch 28 • Defending Grand Warden', color: '#60a5fa' },
  { id: 29, label: 'Ch 29 • Defending Royal Champion', color: '#34d399' },
  { id: 30, label: 'Ch 30 • Defending Minion Prince', color: '#a855f7' },
  { id: 31, label: 'Ch 31 • Defending Dragon Duke', color: '#f97316' },
  { id: 32, label: 'Ch 32 • Enemy Ground Skeletons', color: '#cbd5e1' },
  { id: 33, label: 'Ch 33 • Enemy Air Skeletons', color: '#93c5fd' },

  // Group 6: Dedicated Defense Types & Clan Castle (34..55)
  { id: 34, label: 'Ch 34 • Archer Tower', color: '#38bdf8' },
  { id: 35, label: 'Ch 35 • Multi-Archer Tower', color: '#0ea5e9' },
  { id: 36, label: 'Ch 36 • Ricochet Cannon', color: '#f97316' },
  { id: 37, label: 'Ch 37 • Cannon', color: '#fb923c' },
  { id: 38, label: 'Ch 38 • Mortar', color: '#a855f7' },
  { id: 39, label: 'Ch 39 • Air Defense', color: '#ef4444' },
  { id: 40, label: 'Ch 40 • Wizard Tower', color: '#c084fc' },
  { id: 41, label: 'Ch 41 • Super Wizard Tower', color: '#8b5cf6' },
  { id: 42, label: 'Ch 42 • Air Sweeper (Dir)', color: '#22d3ee' },
  { id: 43, label: 'Ch 43 • Hidden Tesla (Revealed)', color: '#fde047' },
  { id: 44, label: 'Ch 44 • Bomb Tower', color: '#fb7185' },
  { id: 45, label: 'Ch 45 • X-Bow (Mode)', color: '#e879f9' },
  { id: 46, label: 'Ch 46 • Inferno Tower (Single/Multi)', color: '#f43f5e' },
  { id: 47, label: 'Ch 47 • Scattershot', color: '#6366f1' },
  { id: 48, label: 'Ch 48 • Builder\'s Hut', color: '#4ade80' },
  { id: 49, label: 'Ch 49 • Spell Tower (Mode)', color: '#a3e635' },
  { id: 50, label: 'Ch 50 • Monolith', color: '#9333ea' },
  { id: 51, label: 'Ch 51 • Multi-Gear Tower (Mode)', color: '#f59e0b' },
  { id: 52, label: 'Ch 52 • Firespitter (Dir)', color: '#ea580c' },
  { id: 53, label: 'Ch 53 • Revenge Tower', color: '#dc2626' },
  { id: 54, label: 'Ch 54 • Hot Candle (Crafted)', color: '#fbbf24' },
  { id: 55, label: 'Ch 55 • Clan Castle (Defense)', color: '#d97706' },

  // Group 7: Non-Offensive Structures (56..58)
  { id: 56, label: 'Ch 56 • Storages & Hero Hall', color: '#f59e0b' },
  { id: 57, label: 'Ch 57 • Resource Collectors', color: '#10b981' },
  { id: 58, label: 'Ch 58 • Utility & Other Buildings', color: '#8b5cf6' },

  { id: 59, label: 'Policy Tile Heatmap', color: '#f59e0b' },
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

export interface AIConfigDiffItem {
  section: 'arch_config' | 'reward_config' | 'hyperparams' | string;
  parameter: string;
  before: unknown;
  after: unknown;
}

export interface AICandidateSolution {
  solution_id: string;
  rank: number;
  category: 'architecture' | 'reward_function' | 'hyperparameters' | 'combined' | string;
  title: string;
  target_problem: string;
  rationale: string;
  config_patch: {
    arch_config?: Record<string, number | string>;
    reward_config?: Record<string, number>;
    hyperparams?: Record<string, number | string>;
  };
  diffs?: AIConfigDiffItem[];
  diff_summary?: string[];
  expected_verification_criteria: string;
  applied_at?: string;
}

export interface AICompactBaselineMetrics {
  episode: number;
  history_length: number;
  mean_pct_50: number;
  std_pct_50: number;
  rolling50_peak_pct: number;
  episodes_since_peak: number;
  drawdown_from_peak_pct: number;
  best_pct: number;
  best_stars: number;
  one_star_rate_50: number;
  two_star_th_rate_50: number;
  three_star_triple_rate_50: number;
  mean_reward_50: number;
  reward_snr: number;
  destr_share_pct: number;
  stars_th_share_pct: number;
  damage_funnel_share_pct: number;
  pct_slope_per_100ep: number;
  reward_slope_per_100ep: number;
  entropy_slope_per_100ep: number;
  mean_noop_pct_50: number;
  mean_steps_50: number;
  explained_variance_50: number;
  approx_kl_50: number;
  kl_saturation_rate_pct: number;
  clip_fraction_50: number;
  grad_norm_50: number;
  critic_v_s0: number;
  calibration_gap: number;
  head_saturation_pct: {
    slot_type: number;
    slot_idx: number;
    deploy_fraction: number;
    tile_xy: number;
  };
  top5_tile_mass_pct: number;
  spatial_spread_std: number;
  star_funnel: {
    p_1star_pct: number;
    p_2star_given_1star_pct: number;
    p_3star_given_2star_pct: number;
    near_miss_85_to_99_pct_rate: number;
  };
  worst_village: {
    name?: string;
    full_name?: string;
    recent_avg_pct: number;
    avg_stars?: number;
    triple_rate?: number;
  };
  best_village: {
    name?: string;
    full_name?: string;
    recent_avg_pct: number;
    avg_stars?: number;
    triple_rate?: number;
  };
  inter_village_gap_pct: number;
}

export interface AIPreChangeSnapshot {
  snapshot_id: string;
  cycle_id: number;
  documented_at: string;
  git_commit: string;
  checkpoint_file: string;
  cumulative_episode: number;
  arch_config: Record<string, number | string>;
  reward_config: Record<string, number>;
  reward_formula: string;
  hyperparams: Record<string, number | string>;
  baseline_metrics: AICompactBaselineMetrics;
}

export interface AISolutionVerificationResult {
  verified_at: string;
  start_episode: number;
  end_episode: number;
  episodes_tested: number;
  problem_solved: boolean;
  verdict: 'SOLVED' | 'IMPROVED' | 'PARTIAL' | 'NOT_SOLVED_ROLLED_BACK' | string;
  decision_taken: 'kept_and_promoted' | 'kept_and_continuing' | 'rolled_back_to_baseline' | string;
  post_change_metrics: AICompactBaselineMetrics;
  metric_deltas: {
    delta_mean_pct_50: number;
    delta_two_star_th_rate: number;
    delta_three_star_rate: number;
    delta_mean_reward: number;
    delta_pct_slope: number;
    delta_noop_pct: number;
    delta_explained_variance: number;
    delta_worst_village_pct: number;
    delta_inter_village_gap_pct: number;
  };
  analysis_summary: string;
}

export interface AIRecursiveLoopReason {
  id: string;
  title: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'architecture' | 'reward_function' | 'hyperparameters' | 'tactical_pacing' | 'combined' | string;
  symptom: string;
  root_cause: string;
}

export interface AIRecursiveLoopCycle {
  cycle_id: number;
  started_at: string;
  completed_at: string | null;
  trigger: string;
  episode_at_analysis: number;
  health_verdict: {
    status: 'healthy_progressing' | 'plateaued' | 'degrading' | string;
    health_score: number;
    is_plateaued: boolean;
    headline: string;
    progression_summary: string;
    model_used: string;
    reasons: AIRecursiveLoopReason[];
  };
  pre_change_snapshot: AIPreChangeSnapshot;
  candidate_solutions: AICandidateSolution[];
  selected_solution: AICandidateSolution | null;
  verification_result: AISolutionVerificationResult | null;
}

export interface AIRecursiveLoopState {
  enabled: boolean;
  interval_seconds: number;
  auto_apply_and_test: boolean;
  test_episodes_per_cycle: number;
  provider: AIFeedbackProviderId;
  phase:
    | 'idle'
    | 'monitoring'
    | 'analyzing'
    | 'documenting_baseline'
    | 'applying_solution'
    | 'testing_solution'
    | 'verifying_solution'
    | string;
  is_running_cycle: boolean;
  last_check_at: string | null;
  last_check_ts: number;
  next_check_ts: number;
  next_check_at: string | null;
  seconds_until_next_check?: number;
  current_cycle_id: number;
  active_hypothesis: {
    cycle_id: number;
    solution: AICandidateSolution;
    baseline_episode: number;
    target_episodes: number;
    baseline_metrics: AICompactBaselineMetrics;
  } | null;
  active_config: {
    updated_at?: string;
    arch_config: Record<string, number | string>;
    reward_config: Record<string, number>;
    hyperparams: Record<string, number | string>;
  };
  reward_formula?: string;
  vault_note_path: string;
  cycles: AIRecursiveLoopCycle[];
}
