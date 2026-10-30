import json
from typing import Any, Dict, List, Optional, Tuple

import gymnasium as gym
import numpy as np
from gymnasium import spaces

import coc_py


def _unpack_masks_bytes(
    st_b: bytearray, si_b: bytearray, tile_b: bytearray, raw_st_b: bytearray
) -> Dict[str, np.ndarray]:
    return {
        "slot_type": np.frombuffer(st_b, dtype=bool),
        "slot_idx": np.frombuffer(si_b, dtype=bool).reshape((7, 10)),
        "tile": np.frombuffer(tile_b, dtype=bool),
        "raw_slot_type": np.frombuffer(raw_st_b, dtype=bool),
    }


class CoCAttackerEnv(gym.Env):
    """
    Gymnasium RL Environment for training an AI to attack a max-level Town Hall 18 village.

    Observation Space:
        Box(0.0, 1.0, shape=(59, 50, 50), dtype=np.float32)
        - Group 1: Base & Environment (Ch 0..4: Building HP, Defense DPS, TH18 Mask, Wall Integrity, Red Zone)
        - Group 2: Friendly Army Troops, Siege & CC (Ch 5..16: Thrower, Healer, Furnace, Druid, Ice Golem, SWB, HH, Loon, Archer, Log Launcher, Super Yeti, Super Valkyrie)
        - Group 3: Friendly Heroes (Ch 17..20: Barbarian King, Archer Queen, Grand Warden, Royal Champion)
        - Group 4: Friendly Spells (Ch 21..24: Totem HP, Rage Fade AoE, Poison Fade AoE, Skeleton Fade AoE)
        - Group 5: Enemy Defending Units (Ch 25..33: Enemy CC & Guardian, Defending BK, AQ, GW, RC, MP, DD, Ground & Air Skeletons)
        - Group 6: Dedicated Defense Types & Clan Castle (Ch 34..55: 21 defense types + Clan Castle)
        - Group 7: Non-Offensive Structures (Ch 56..58: Storages/HeroHall, Collectors, Utility/Other Buildings)

    Action Space:
        MultiDiscrete([7, 10, 50, 50, 5]):
        - slot_type:
            0 = NoOp
            1 = Deploy Troop from slot_idx
            2 = Deploy Hero from slot_idx
            3 = Activate Hero Equipment Ability for slot_idx
            4 = Deploy Siege Machine
            5 = Pop Siege Machine (release CC)
            6 = Cast Spell from slot_idx
        - slot_idx: index into army loadout (0..9)
        - tile_x: target x coordinate (0..49)
        - tile_y: target y coordinate (0..49)
        - deploy_fraction_bin: 0..4 -> (0.0, 0.25, 0.50, 0.75, 1.00)
    """

    metadata = {"render_modes": ["json"]}

    def __init__(
        self,
        layout_json: Optional[str] = None,
        army_json: Optional[str] = None,
        ticks_per_step: int = 5,
    ):
        super().__init__()
        self.ticks_per_step = int(ticks_per_step)
        self._sim = coc_py.PyBattleEnv(layout_json, army_json, self.ticks_per_step)
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(59, 50, 50), dtype=np.float32
        )
        self.action_space = spaces.MultiDiscrete([7, 10, 50, 50, 5])
        self.fraction_bins = (0.0, 0.25, 0.50, 0.75, 1.00)

    def get_action_masks(self) -> Dict[str, np.ndarray]:
        st_b, si_b, tile_b, raw_st_b = self._sim.get_tactical_masks_bytes()
        return _unpack_masks_bytes(st_b, si_b, tile_b, raw_st_b)

    def get_army_context(self) -> np.ndarray:
        return np.asarray(self._sim.get_army_context(), dtype=np.float32)

    def reset(
        self,
        *,
        seed: Optional[int] = None,
        options: Optional[Dict[str, Any]] = None,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        super().reset(seed=seed)
        if options:
            if "layout_json" in options and options["layout_json"]:
                self._sim.set_layout(options["layout_json"])
            if "army_json" in options and options["army_json"]:
                self._sim.set_army(options["army_json"])
        self._sim.set_ticks_per_step(self.ticks_per_step)
        obs_b, ctx_b, st_b, si_b, tile_b, raw_st_b, has_inv = (
            self._sim.reset_tactical_bytes()
        )
        obs = np.frombuffer(obs_b, dtype=np.float32).reshape((59, 50, 50))
        ctx = np.frombuffer(ctx_b, dtype=np.float32)
        masks_now = _unpack_masks_bytes(st_b, si_b, tile_b, raw_st_b)
        return obs, {
            "destruction_pct": 0,
            "stars": 0,
            "delta_pct": 0,
            "delta_stars": 0,
            "delta_damage_ratio": 0.0,
            "th_just_destroyed": False,
            "time_remaining_ratio": 1.0,
            "invalid_action": False,
            "tick": 0,
            "has_remaining_inventory": bool(has_inv),
            "action_masks": masks_now,
            "army_context": ctx,
        }

    def step(
        self, action: np.ndarray
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        slot_type = max(0, min(6, int(action[0])))
        slot_idx = max(0, min(9, int(action[1])))
        tile_x = max(0, min(49, int(action[2])))
        tile_y = max(0, min(49, int(action[3])))
        frac_val = float(action[4])
        if (
            frac_val in (0.0, 1.0, 2.0, 3.0, 4.0)
            and float(frac_val).is_integer()
            and int(frac_val) < len(self.fraction_bins)
        ):
            deploy_fraction = self.fraction_bins[int(frac_val)]
        else:
            deploy_fraction = max(0.0, min(1.0, frac_val))

        self._sim.set_ticks_per_step(self.ticks_per_step)
        (
            (obs_b, ctx_b, st_b, si_b, tile_b, raw_st_b),
            (
                reward,
                done,
                destruction_pct,
                stars,
                delta_pct,
                delta_stars,
                delta_dmg_ratio,
                th_just_destroyed,
                time_rem_ratio,
            ),
            (
                invalid_action,
                deploy_fraction_out,
                funnel_cohesion,
                tick,
                has_inv,
            ),
        ) = self._sim.step_tactical_bytes(
            slot_type, slot_idx, tile_x, tile_y, deploy_fraction
        )

        obs = np.frombuffer(obs_b, dtype=np.float32).reshape((59, 50, 50))
        ctx = np.frombuffer(ctx_b, dtype=np.float32)
        masks_now = _unpack_masks_bytes(st_b, si_b, tile_b, raw_st_b)
        info = {
            "destruction_pct": int(destruction_pct),
            "stars": int(stars),
            "delta_pct": int(delta_pct),
            "delta_stars": int(delta_stars),
            "delta_damage_ratio": float(delta_dmg_ratio),
            "th_just_destroyed": bool(th_just_destroyed),
            "time_remaining_ratio": float(time_rem_ratio),
            "invalid_action": bool(invalid_action),
            "deploy_fraction": float(deploy_fraction_out),
            "funnel_cohesion": float(funnel_cohesion),
            "tick": int(tick),
            "has_remaining_inventory": bool(has_inv),
            "action_masks": masks_now,
            "army_context": ctx,
        }
        return obs, float(reward), bool(done), False, info

    def finish_battle(self) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        (
            (obs_b, ctx_b, st_b, si_b, tile_b, raw_st_b),
            (
                reward,
                done,
                destruction_pct,
                stars,
                delta_pct,
                delta_stars,
                delta_dmg_ratio,
                th_just_destroyed,
                time_rem_ratio,
                ff_ticks,
                tick,
                has_inv,
            ),
        ) = self._sim.finish_tactical_bytes()

        obs = np.frombuffer(obs_b, dtype=np.float32).reshape((59, 50, 50))
        ctx = np.frombuffer(ctx_b, dtype=np.float32)
        masks_now = _unpack_masks_bytes(st_b, si_b, tile_b, raw_st_b)
        info = {
            "destruction_pct": int(destruction_pct),
            "stars": int(stars),
            "delta_pct": int(delta_pct),
            "delta_stars": int(delta_stars),
            "delta_damage_ratio": float(delta_dmg_ratio),
            "th_just_destroyed": bool(th_just_destroyed),
            "time_remaining_ratio": float(time_rem_ratio),
            "invalid_action": False,
            "ff_ticks": int(ff_ticks),
            "tick": int(tick),
            "has_remaining_inventory": bool(has_inv),
            "action_masks": masks_now,
            "army_context": ctx,
        }
        return obs, float(reward), bool(done), info

    def valid_deploy_tiles(self) -> List[Tuple[int, int]]:
        mask = self._sim.get_no_deploy_mask_flat()
        coords = []
        for idx, blocked in enumerate(mask):
            if not blocked:
                coords.append((idx % 50, idx // 50))
        return coords

    def get_state_dict(self) -> Dict[str, Any]:
        return json.loads(self._sim.get_state_json())


class CoCVecAttackerEnv:
    """
    Rayon-parallelized Vectorized Clash of Clans TH18 RL Environment.
    Steps `num_envs` independent `BattleEngine` instances simultaneously across all CPU cores,
    including parallel `finish_battle()` fast-forwards and zero-copy byte buffer observation extraction.
    """

    def __init__(
        self,
        num_envs: int,
        layouts_json: List[str],
        armies_json: List[str],
        ticks_per_step: int = 8,
    ):
        self.num_envs = max(1, int(num_envs))
        self.ticks_per_step = int(ticks_per_step)
        self._vec = coc_py.PyVecBattleEnv(
            self.num_envs, layouts_json, armies_json, self.ticks_per_step
        )

    def reset_batch(
        self,
        layout_indices: List[int],
        army_indices: Optional[List[int]] = None,
    ) -> Tuple[np.ndarray, np.ndarray, Dict[str, np.ndarray]]:
        count = len(layout_indices)
        a_indices = army_indices if army_indices is not None else [0] * count
        obs_b, ctx_b, st_b, si_b, tile_b = self._vec.reset_batch(
            layout_indices, a_indices
        )
        obs = np.frombuffer(obs_b, dtype=np.float32).reshape((count, 59, 50, 50))
        ctx = np.frombuffer(ctx_b, dtype=np.float32).reshape((count, 64))
        masks = {
            "slot_type": np.frombuffer(st_b, dtype=bool).reshape((count, 7)),
            "slot_idx": np.frombuffer(si_b, dtype=bool).reshape((count, 7, 10)),
            "tile": np.frombuffer(tile_b, dtype=bool).reshape((count, 2500)),
        }
        return obs, ctx, masks

    def step_active(
        self,
        active_indices: List[int],
        actions: np.ndarray,
        is_last_step: bool = False,
        gamma: float = 0.99,
    ) -> Tuple[
        np.ndarray,
        np.ndarray,
        Dict[str, np.ndarray],
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
    ]:
        actions_flat = np.asarray(actions, dtype=np.int64).reshape(-1).tolist()
        (
            (obs_b, ctx_b, st_b, si_b, tile_b),
            telemetry,
        ) = self._vec.step_active_parallel(
            active_indices, actions_flat, bool(is_last_step), float(gamma)
        )
        n = self.num_envs
        obs = np.frombuffer(obs_b, dtype=np.float32).reshape((n, 59, 50, 50))
        ctx = np.frombuffer(ctx_b, dtype=np.float32).reshape((n, 64))
        masks = {
            "slot_type": np.frombuffer(st_b, dtype=bool).reshape((n, 7)),
            "slot_idx": np.frombuffer(si_b, dtype=bool).reshape((n, 7, 10)),
            "tile": np.frombuffer(tile_b, dtype=bool).reshape((n, 2500)),
        }
        return obs, ctx, masks, telemetry
