from .envs import CoCAttackerEnv, CoCVecAttackerEnv
from .history_compression import (
    compress_training_history,
    decompress_training_history,
    get_compressed_history_meta,
)
from .networks import (
    DEFAULT_ARCH_CONFIG,
    CoCActorCritic,
    CoCSpatialEncoder,
    transfer_compatible_weights,
)
from .ppo import (
    DEFAULT_HYPERPARAMS,
    DEFAULT_REWARD_CONFIG,
    compute_custom_reward,
    compute_custom_reward_components,
    compute_gae,
    format_reward_formula,
    ppo_minibatch_update,
    ppo_update_step,
)
from .recursive_loop import (
    apply_config_patch,
    backup_code_files_before_change,
    capture_pre_change_snapshot,
    diagnose_and_propose_solutions,
    execute_opencode_argon_code_edit,
    extract_compact_metrics_from_telemetry,
    get_default_experiment_config,
    load_active_experiment_config,
    load_recursive_loop_state,
    merge_selected_solutions,
    restore_code_files_from_backup,
    run_recursive_improvement_cycle,
    save_active_experiment_config,
    save_recursive_loop_state,
    sync_recursive_loop_to_vault,
    trigger_model_visualizer_agent,
    verify_solution_outcome,
)
from .training_feedback import (
    AI_PROVIDERS,
    gather_training_telemetry,
    generate_ai_training_feedback,
    load_cached_ai_feedback,
)


def ensure_architecture_diagrams(*args, **kwargs):
    from .visualize import ensure_architecture_diagrams as _impl

    return _impl(*args, **kwargs)


__all__ = [
    "CoCAttackerEnv",
    "CoCVecAttackerEnv",
    "CoCSpatialEncoder",
    "CoCActorCritic",
    "compute_custom_reward",
    "compute_custom_reward_components",
    "compute_gae",
    "ppo_update_step",
    "ppo_minibatch_update",
    "ensure_architecture_diagrams",
    "AI_PROVIDERS",
    "gather_training_telemetry",
    "generate_ai_training_feedback",
    "load_cached_ai_feedback",
    "compress_training_history",
    "decompress_training_history",
    "get_compressed_history_meta",
]

