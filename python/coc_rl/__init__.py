from .envs import CoCAttackerEnv
from .networks import (
    CoCActorCritic,
    CoCSpatialEncoder,
)
from .ppo import (
    compute_custom_reward,
    compute_custom_reward_components,
    compute_gae,
    ppo_minibatch_update,
    ppo_update_step,
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
]

