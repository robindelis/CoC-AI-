from .envs import CoCAttackerEnv, CoCDefenderEvolution
from .networks import CoCActorCritic, CoCSpatialEncoder
from .ppo import compute_custom_reward, compute_gae, ppo_update_step


def ensure_architecture_diagrams(*args, **kwargs):
    from .visualize import ensure_architecture_diagrams as _impl

    return _impl(*args, **kwargs)


__all__ = [
    "CoCAttackerEnv",
    "CoCDefenderEvolution",
    "CoCSpatialEncoder",
    "CoCActorCritic",
    "compute_custom_reward",
    "compute_gae",
    "ppo_update_step",
    "ensure_architecture_diagrams",
]
