import json
import random
from typing import Any, Dict, List, Optional, Tuple

import gymnasium as gym
import numpy as np
from gymnasium import spaces

import coc_py


class CoCAttackerEnv(gym.Env):
    """
    Gymnasium RL Environment for training an AI to attack a max-level Town Hall 18 village.

    Observation Space:
        Box(0.0, 1.0, shape=(10, 50, 50), dtype=np.float32)
        - Channel 0: Live Building HP normalized (0..1)
        - Channel 1: Defense DPS threat normalized (0..1)
        - Channel 2: Town Hall 18 mask (0 or 1)
        - Channel 3: Live Wall HP normalized (0..1)
        - Channel 4: No-Deploy Red Zone mask (1 = red zone, 0 = valid troop deployment)
        - Channel 5: Attacking Ground unit HP density
        - Channel 6: Attacking Air unit HP density
        - Channel 7: Active Spell zone indicator
        - Channel 8: Allied Unit Type Signature phi(u) in [0, 1]
        - Channel 9: Enemy Unit Type Signature phi(u) in [0, 1] (CC, Heroes, Guardians, Ground vs Air Skeletons)

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
        self.ticks_per_step = ticks_per_step
        self._sim = coc_py.PyBattleEnv(layout_json, army_json)
        self._prev_pct = 0
        self._prev_stars = 0
        self._prev_dmg = 0.0
        self._prev_th_destroyed = False
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(10, 50, 50), dtype=np.float32
        )
        self.action_space = spaces.MultiDiscrete([7, 10, 50, 50, 5])
        self.fraction_bins = (0.0, 0.25, 0.50, 0.75, 1.00)

    def get_action_masks(self) -> Dict[str, np.ndarray]:
        slot_type_mask, slot_idx_masks, valid_deploy_mask = self._sim.get_action_masks()
        return {
            "slot_type": np.asarray(slot_type_mask, dtype=bool),
            "slot_idx": np.asarray(slot_idx_masks, dtype=bool),
            "tile": np.asarray(valid_deploy_mask, dtype=bool),
        }

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
        raw_obs = self._sim.reset()
        self._prev_pct = 0
        self._prev_stars = 0
        self._prev_dmg = 0.0
        self._prev_th_destroyed = False
        obs = np.asarray(raw_obs, dtype=np.float32).reshape((-1, 50, 50))
        if obs.shape[0] < 10:
            obs = np.pad(obs, ((0, 10 - obs.shape[0]), (0, 0), (0, 0)))
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
            "action_masks": self.get_action_masks(),
            "army_context": self.get_army_context(),
        }

    def step(
        self, action: np.ndarray
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        slot_type = int(action[0])
        slot_idx = int(action[1])
        tile_x = int(action[2])
        tile_y = int(action[3])
        if len(action) >= 5:
            frac_val = float(action[4])
            if frac_val in (0.0, 1.0, 2.0, 3.0, 4.0) and float(frac_val).is_integer() and int(frac_val) < len(self.fraction_bins):
                deploy_fraction = self.fraction_bins[int(frac_val)]
            else:
                deploy_fraction = max(0.0, min(1.0, frac_val))
        else:
            deploy_fraction = 1.0

        masks_before = self.get_action_masks()
        tile_flat = tile_y * 50 + tile_x
        is_valid_type = (
            0 <= slot_type < 7 and bool(masks_before["slot_type"][slot_type])
        )
        is_valid_idx = (
            is_valid_type
            and 0 <= slot_idx < 10
            and bool(masks_before["slot_idx"][slot_type, slot_idx])
        )
        needs_green_tile = slot_type in (1, 2, 4)
        is_valid_tile = (
            0 <= tile_x < 50
            and 0 <= tile_y < 50
            and (not needs_green_tile or bool(masks_before["tile"][tile_flat]))
        )
        invalid_action = not (is_valid_type and is_valid_idx and is_valid_tile)

        raw_obs, reward, done, destruction_pct, stars = self._sim.step_discrete(
            slot_type, slot_idx, tile_x, tile_y, self.ticks_per_step, deploy_fraction
        )
        dmg_total, hp_pool, th_destroyed, tick = self._sim.get_reward_telemetry()

        delta_pct = max(0, int(destruction_pct) - self._prev_pct)
        delta_stars = max(0, int(stars) - self._prev_stars)
        delta_dmg_ratio = max(0.0, float(dmg_total - self._prev_dmg) / float(hp_pool))
        th_just_destroyed = bool(th_destroyed and not self._prev_th_destroyed)
        time_rem_ratio = max(0.0, (1800.0 - float(tick)) / 1800.0)

        self._prev_pct = int(destruction_pct)
        self._prev_stars = int(stars)
        self._prev_dmg = float(dmg_total)
        self._prev_th_destroyed = bool(th_destroyed)

        obs = np.asarray(raw_obs, dtype=np.float32).reshape((-1, 50, 50))
        if obs.shape[0] < 10:
            obs = np.pad(obs, ((0, 10 - obs.shape[0]), (0, 0), (0, 0)))
        info = {
            "destruction_pct": int(destruction_pct),
            "stars": int(stars),
            "delta_pct": delta_pct,
            "delta_stars": delta_stars,
            "delta_damage_ratio": delta_dmg_ratio,
            "th_just_destroyed": th_just_destroyed,
            "time_remaining_ratio": time_rem_ratio,
            "invalid_action": invalid_action,
            "deploy_fraction": deploy_fraction,
            "tick": int(tick),
            "action_masks": self.get_action_masks(),
            "army_context": self.get_army_context(),
        }
        return obs, float(reward), bool(done), False, info

    def finish_battle(self) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        raw_obs, reward, done, destruction_pct, stars = self._sim.finish_battle()
        dmg_total, hp_pool, th_destroyed, tick = self._sim.get_reward_telemetry()

        delta_pct = max(0, int(destruction_pct) - self._prev_pct)
        delta_stars = max(0, int(stars) - self._prev_stars)
        delta_dmg_ratio = max(0.0, float(dmg_total - self._prev_dmg) / float(hp_pool))
        th_just_destroyed = bool(th_destroyed and not self._prev_th_destroyed)
        time_rem_ratio = max(0.0, (1800.0 - float(tick)) / 1800.0)

        self._prev_pct = int(destruction_pct)
        self._prev_stars = int(stars)
        self._prev_dmg = float(dmg_total)
        self._prev_th_destroyed = bool(th_destroyed)

        obs = np.asarray(raw_obs, dtype=np.float32).reshape((-1, 50, 50))
        if obs.shape[0] < 10:
            obs = np.pad(obs, ((0, 10 - obs.shape[0]), (0, 0), (0, 0)))
        info = {
            "destruction_pct": int(destruction_pct),
            "stars": int(stars),
            "delta_pct": delta_pct,
            "delta_stars": delta_stars,
            "delta_damage_ratio": delta_dmg_ratio,
            "th_just_destroyed": th_just_destroyed,
            "time_remaining_ratio": time_rem_ratio,
            "invalid_action": False,
            "tick": int(tick),
            "action_masks": self.get_action_masks(),
            "army_context": self.get_army_context(),
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


class CoCDefenderEvolution:
    """
    Parallel evolutionary base-layout optimizer for training a Defender AI.
    Mutates building positions, swaps defense compartments, and toggles defense modes
    (Inferno Single/Multi, X-Bow Ground/Air, Spell Tower modes, TH18 Guardians)
    while strictly preserving TH18 non-overlap and building count constraints.
    """

    def __init__(self, base_layout: Optional[Dict[str, Any]] = None):
        catalog = json.loads(coc_py.get_catalog_json())
        self.footprints = {b["id"]: b["footprint"] for b in catalog["buildings"]}
        self.modes = {b["id"]: b["available_modes"] for b in catalog["buildings"]}
        self.base_layout = base_layout or catalog["preset_layouts"][0]

    def mutate_layout(self, layout: Dict[str, Any], num_swaps: int = 4) -> Dict[str, Any]:
        cand = json.loads(json.dumps(layout))
        buildings = cand["buildings"]

        # 1. Swap positions of same-footprint buildings (preserves exact non-overlapping validity!)
        for _ in range(num_swaps):
            i, j = random.sample(range(len(buildings)), 2)
            bi, bj = buildings[i], buildings[j]
            if self.footprints[bi["building_id"]] == self.footprints[bj["building_id"]]:
                bi["tile_x"], bj["tile_x"] = bj["tile_x"], bi["tile_x"]
                bi["tile_y"], bj["tile_y"] = bj["tile_y"], bi["tile_y"]

        # 2. Mutate configurable defense modes (Inferno, X-Bow, Spell Tower, TH18 Guardian)
        for b in buildings:
            avail = self.modes.get(b["building_id"], [])
            if len(avail) > 1 and random.random() < 0.2:
                b["mode"] = random.choice(avail)

        return cand

    def evolve_generation(
        self, population: List[Dict[str, Any]], elite_k: int = 4
    ) -> Tuple[List[Dict[str, Any]], List[Tuple[int, int, float]]]:
        payloads = [json.dumps(ind) for ind in population]
        # Parallel Rayon evaluation in Rust across all CPU cores
        scores = coc_py.evaluate_layouts_parallel(payloads)
        ranked = sorted(
            zip(population, scores), key=lambda item: item[1][2], reverse=True
        )

        elites = [item[0] for item in ranked[:elite_k]]
        next_pop = list(elites)
        while len(next_pop) < len(population):
            parent = random.choice(elites)
            next_pop.append(self.mutate_layout(parent, num_swaps=random.randint(2, 6)))

        return next_pop, [item[1] for item in ranked]
