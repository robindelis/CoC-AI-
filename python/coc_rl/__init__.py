from .envs import CoCAttackerEnv, CoCDefenderEvolution
from .networks import (
    DEFAULT_ARCH_CONFIG,
    AttackerArmySelectorNet,
    CoCActorCritic,
    CoCSpatialEncoder,
    DefenderVillageSelectorNet,
    analyze_architecture,
    get_default_arch_config,
)
from .ppo import (
    compute_custom_reward,
    compute_gae,
    ppo_minibatch_update,
    ppo_update_step,
    selector_ppo_update_step,
)


def ensure_architecture_diagrams(*args, **kwargs):
    from .visualize import ensure_architecture_diagrams as _impl

    return _impl(*args, **kwargs)


def render_custom_torchview_svg(*args, **kwargs):
    from .visualize import render_custom_torchview_svg as _impl

    return _impl(*args, **kwargs)


__all__ = [
    "CoCAttackerEnv",
    "CoCDefenderEvolution",
    "CoCSpatialEncoder",
    "CoCActorCritic",
    "AttackerArmySelectorNet",
    "DefenderVillageSelectorNet",
    "DEFAULT_ARCH_CONFIG",
    "get_default_arch_config",
    "analyze_architecture",
    "compute_custom_reward",
    "compute_gae",
    "ppo_update_step",
    "ppo_minibatch_update",
    "selector_ppo_update_step",
    "ensure_architecture_diagrams",
    "render_custom_torchview_svg",
]

