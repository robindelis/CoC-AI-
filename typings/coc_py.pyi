from typing import Any, Dict, List, Optional, Tuple

class PyBattleEnv:
    def __init__(
        self,
        layout_json: Optional[str] = None,
        army_json: Optional[str] = None,
        ticks_per_step: int = 5,
    ) -> None: ...
    def set_ticks_per_step(self, ticks_per_step: int) -> None: ...
    def reset(self) -> List[float]: ...
    def reset_tactical_bytes(
        self,
    ) -> Tuple[bytearray, bytearray, bytearray, bytearray, bytearray, bytearray, bool]: ...
    def step_tactical_bytes(
        self,
        slot_type: int,
        slot_idx: int,
        tile_x: int,
        tile_y: int,
        deploy_fraction: float = 1.0,
    ) -> Tuple[
        Tuple[bytearray, bytearray, bytearray, bytearray, bytearray, bytearray],
        Tuple[float, bool, int, int, int, int, float, bool, float],
        Tuple[bool, float, float, int, bool],
    ]: ...
    def finish_tactical_bytes(
        self,
    ) -> Tuple[
        Tuple[bytearray, bytearray, bytearray, bytearray, bytearray, bytearray],
        Tuple[float, bool, int, int, int, int, float, bool, float, int, int, bool],
    ]: ...
    def get_tactical_masks_bytes(
        self,
    ) -> Tuple[bytearray, bytearray, bytearray, bytearray]: ...
    def set_layout(self, layout_json: str) -> None: ...
    def set_army(self, army_json: str) -> None: ...
    def get_action_masks(self) -> Tuple[List[bool], List[List[bool]], List[bool]]: ...
    def step_discrete(
        self,
        slot_type: int,
        slot_idx: int,
        tile_x: int,
        tile_y: int,
        deploy_fraction: float = 1.0,
    ) -> Tuple[List[float], float, bool, Dict[str, Any]]: ...
    def finish_battle(self) -> Tuple[List[float], float, bool, int, int]: ...
    def get_no_deploy_mask_flat(self) -> List[bool]: ...
    def get_state_json(self) -> str: ...
    def get_army_context(self) -> List[float]: ...
    def get_reward_telemetry(self) -> Tuple[float, float, bool, int]: ...

class PyVecBattleEnv:
    def __init__(
        self,
        num_envs: int,
        layouts_json: List[str],
        armies_json: List[str],
        ticks_per_step: int = 8,
    ) -> None: ...
    def num_envs(self) -> int: ...
    def reset_batch(
        self,
        layout_indices: List[int],
        army_indices: List[int],
    ) -> Tuple[bytearray, bytearray, bytearray, bytearray, bytearray]: ...
    def step_active_parallel(
        self,
        active_indices: List[int],
        actions_flat: List[int],
        is_last_step: bool = False,
        gamma: float = 0.99,
    ) -> Tuple[
        Tuple[bytearray, bytearray, bytearray, bytearray, bytearray],
        Tuple[
            List[float],
            List[float],
            List[float],
            List[float],
            List[bool],
            List[int],
            List[int],
            List[int],
        ],
    ]: ...

def get_catalog_json() -> str: ...
def validate_layout_json(layout_json: str) -> bool: ...
def evaluate_layouts_parallel(
    layouts_json: List[str],
    armies_json: List[str],
    ticks_per_step: int = 5,
) -> List[Tuple[int, int, float]]: ...
