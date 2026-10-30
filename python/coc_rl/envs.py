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
        self._current_tick = 0
        self._deployed_troop_actions = 0
        self._deployed_any_unit = False
        self._last_spell_tick = -999
        self._last_ability_tick = -999
        self._deploy_coords: List[Tuple[float, float]] = []
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(10, 50, 50), dtype=np.float32
        )
        self.action_space = spaces.MultiDiscrete([7, 10, 50, 50, 5])
        self.fraction_bins = (0.0, 0.25, 0.50, 0.75, 1.00)

    def get_action_masks(self) -> Dict[str, np.ndarray]:
        slot_type_mask, slot_idx_masks, valid_deploy_mask = self._sim.get_action_masks()
        st_mask = np.asarray(slot_type_mask, dtype=bool).copy()
        si_mask = np.asarray(slot_idx_masks, dtype=bool).copy()
        tile_mask = np.asarray(valid_deploy_mask, dtype=bool).copy()

        # Tactical two-phase combat structure:
        # Phase 1 (Deployment): Deploy frontline troops first (>= 3 troop waves), then Siege & Heroes
        #   so the entire main army enters the breach together as a coordinated push.
        if st_mask[2] and st_mask[1] and self._deployed_troop_actions < 3:
            st_mask[2] = False
        if st_mask[4] and st_mask[1] and self._deployed_troop_actions < 1:
            st_mask[4] = False

        # Prioritize core army troop slots (slots 0..3: main DPS, tanks, healers) before 1-space cleanup slots
        if st_mask[1] and np.any(si_mask[1, :4]):
            si_mask[1, 4:] = False

        # Phase 2 (Mid-Battle Tactical Timing): Pace Hero Abilities and Spells across the core push
        #   with NoOp (Wait) steps interleaved while units advance into defense compartments.
        if st_mask[3]:
            if (
                self._current_tick < 64
                or self._deployed_troop_actions < 3
                or (self._current_tick - self._last_ability_tick) < 16
            ):
                st_mask[3] = False

        if st_mask[5] and self._current_tick < 112:
            st_mask[5] = False

        if st_mask[6]:
            if (
                self._deployed_troop_actions < 3
                or self._current_tick < 40
                or (self._current_tick - self._last_spell_tick) < 8
            ):
                st_mask[6] = False

        # Restrict troop deployment tiles to the outer village red-zone border
        # (never inside the central [13..36, 13..36] teaser killzone holes and never at the far 0/49 map edge)
        red_zone = (~tile_mask).reshape(50, 50)
        ys, xs = np.divmod(np.arange(2500), 50)
        not_interior_hole = ~((xs >= 13) & (xs <= 36) & (ys >= 13) & (ys <= 36))
        if np.any(red_zone):
            rz_pad = np.pad(red_zone, 2, mode="constant", constant_values=False)
            near_village = np.zeros((50, 50), dtype=bool)
            for dy in range(5):
                for dx in range(5):
                    near_village |= rz_pad[dy : dy + 50, dx : dx + 50]
            cardinal_corridor = ((xs >= 13) & (xs <= 36)) | ((ys >= 13) & (ys <= 36))
            perimeter_ring = (
                tile_mask
                & near_village.reshape(2500)
                & not_interior_hole
                & cardinal_corridor
            )
            if np.any(perimeter_ring):
                tile_mask = perimeter_ring

        # Once the initial breach point is chosen, focus subsequent deployments into a
        # 14-tile funnel corridor along that attack face
        if len(self._deploy_coords) >= 1:
            cx = float(np.mean([c[0] for c in self._deploy_coords[:2]]))
            cy = float(np.mean([c[1] for c in self._deploy_coords[:2]]))
            dist = np.hypot(xs - cx, ys - cy)
            funnel_mask = tile_mask & (dist <= 14.0)
            if np.any(funnel_mask):
                tile_mask = funnel_mask

        return {
            "slot_type": st_mask,
            "slot_idx": si_mask,
            "tile": tile_mask,
            "raw_slot_type": np.asarray(slot_type_mask, dtype=bool),
        }

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
        self._current_tick = 0
        self._deployed_troop_actions = 0
        self._deployed_any_unit = False
        self._last_spell_tick = -999
        self._last_ability_tick = -999
        self._deploy_coords = []
        obs = np.asarray(raw_obs, dtype=np.float32).reshape((10, 50, 50))
        masks_now = self.get_action_masks()
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
            "has_remaining_inventory": bool(masks_now["raw_slot_type"][1:].any()),
            "action_masks": masks_now,
        }

    def step(
        self, action: np.ndarray
    ) -> Tuple[np.ndarray, float, bool, bool, Dict[str, Any]]:
        slot_type = int(action[0])
        slot_idx = int(action[1])
        tile_x = int(action[2])
        tile_y = int(action[3])
        frac_val = float(action[4])
        if frac_val in (0.0, 1.0, 2.0, 3.0, 4.0) and float(frac_val).is_integer() and int(frac_val) < len(self.fraction_bins):
            deploy_fraction = self.fraction_bins[int(frac_val)]
        else:
            deploy_fraction = max(0.0, min(1.0, frac_val))

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

        funnel_cohesion = 0.0
        if not invalid_action:
            if slot_type == 1:
                self._deployed_troop_actions += 1
                self._deployed_any_unit = True
            elif slot_type in (2, 4):
                self._deployed_any_unit = True
            elif slot_type == 3:
                self._last_ability_tick = int(tick)
            elif slot_type == 6:
                self._last_spell_tick = int(tick)

            if slot_type in (1, 2, 4):
                if len(self._deploy_coords) > 0:
                    cx = float(np.mean([c[0] for c in self._deploy_coords[:4]]))
                    cy = float(np.mean([c[1] for c in self._deploy_coords[:4]]))
                    dist = float(np.hypot(tile_x - cx, tile_y - cy))
                    funnel_cohesion = 1.0 if dist <= 12.0 else (-0.5 if dist > 20.0 else 0.0)
                self._deploy_coords.append((float(tile_x), float(tile_y)))

        self._current_tick = int(tick)

        delta_pct = max(0, int(destruction_pct) - self._prev_pct)
        delta_stars = max(0, int(stars) - self._prev_stars)
        delta_dmg_ratio = max(0.0, float(dmg_total - self._prev_dmg) / float(hp_pool))
        th_just_destroyed = bool(th_destroyed and not self._prev_th_destroyed)
        time_rem_ratio = max(0.0, (1800.0 - float(tick)) / 1800.0)

        self._prev_pct = int(destruction_pct)
        self._prev_stars = int(stars)
        self._prev_dmg = float(dmg_total)
        self._prev_th_destroyed = bool(th_destroyed)

        obs = np.asarray(raw_obs, dtype=np.float32).reshape((10, 50, 50))
        masks_now = self.get_action_masks()
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
            "funnel_cohesion": funnel_cohesion,
            "tick": int(tick),
            "has_remaining_inventory": bool(masks_now["raw_slot_type"][1:].any()),
            "action_masks": masks_now,
        }
        return obs, float(reward), bool(done), False, info

    def finish_battle(self) -> Tuple[np.ndarray, float, bool, Dict[str, Any]]:
        tick_before = self._current_tick
        raw_obs, reward, done, destruction_pct, stars = self._sim.finish_battle()
        dmg_total, hp_pool, th_destroyed, tick = self._sim.get_reward_telemetry()
        self._current_tick = int(tick)
        ff_ticks = max(0, int(tick) - int(tick_before))

        delta_pct = max(0, int(destruction_pct) - self._prev_pct)
        delta_stars = max(0, int(stars) - self._prev_stars)
        delta_dmg_ratio = max(0.0, float(dmg_total - self._prev_dmg) / float(hp_pool))
        th_just_destroyed = bool(th_destroyed and not self._prev_th_destroyed)
        time_rem_ratio = max(0.0, (1800.0 - float(tick)) / 1800.0)

        self._prev_pct = int(destruction_pct)
        self._prev_stars = int(stars)
        self._prev_dmg = float(dmg_total)
        self._prev_th_destroyed = bool(th_destroyed)

        obs = np.asarray(raw_obs, dtype=np.float32).reshape((10, 50, 50))
        masks_now = self.get_action_masks()
        info = {
            "destruction_pct": int(destruction_pct),
            "stars": int(stars),
            "delta_pct": delta_pct,
            "delta_stars": delta_stars,
            "delta_damage_ratio": delta_dmg_ratio,
            "th_just_destroyed": th_just_destroyed,
            "time_remaining_ratio": time_rem_ratio,
            "invalid_action": False,
            "ff_ticks": ff_ticks,
            "tick": int(tick),
            "has_remaining_inventory": bool(masks_now["raw_slot_type"][1:].any()),
            "action_masks": masks_now,
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

