"""Replay timeline builder, schema validator, and coc-engine dry-run verifier.

Aggregates localized drop events and HUD battle boundaries into standardized
replay JSON dossiers (`datasets/replays/<match_id>.json`) compatible with
`coc-engine` and `coc_rl`.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import coc_py

from .drop_locator import LocalizedDrop
from .hud_detector import BattleSegment, HudDetector

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REPLAY_DIR = REPO_ROOT / "datasets" / "replays"

SLOT_TYPE_TO_ID: dict[str, int] = {
    "NoOp": 0,
    "Troop": 1,
    "Hero": 2,
    "HeroAbility": 3,
    "Siege": 4,
    "PopSiege": 5,
    "Spell": 6,
}

VALID_SLOT_TYPES: frozenset[str] = frozenset(SLOT_TYPE_TO_ID.keys())
RL_FRACTION_BINS: tuple[float, ...] = (0.0, 0.25, 0.50, 0.75, 1.00)


@dataclass(frozen=True)
class ReplayActionEntry:
    """Single canonical action entry in a parsed pro-attack replay."""

    tick: int
    slot_type: str
    slot_idx: int
    unit_name: str
    tile_x: int
    tile_y: int
    fraction: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "tick": int(self.tick),
            "slot_type": str(self.slot_type),
            "slot_idx": int(self.slot_idx),
            "unit_name": str(self.unit_name),
            "tile_x": int(self.tile_x),
            "tile_y": int(self.tile_y),
            "fraction": round(float(self.fraction), 4),
        }


@dataclass(frozen=True)
class ReplayValidationReport:
    """Schema, catalog, layout, and simulator dry-run validation report."""

    valid: bool
    layout_valid: bool
    roster_valid: bool
    actions_valid: bool
    errors: tuple[str, ...]
    sim_dry_run_executed: bool
    sim_destruction_pct: int
    sim_stars: int
    sim_final_tick: int


class ReplayBuilder:
    """Constructs, validates, and dry-runs standardized Clash of Clans replay JSONs."""

    def __init__(
        self,
        output_dir: Path | str | None = None,
        ticks_per_sec: int = 30,
    ) -> None:
        self.output_dir = Path(output_dir) if output_dir is not None else DEFAULT_REPLAY_DIR
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ticks_per_sec = max(1, int(ticks_per_sec))
        self.catalog: dict[str, Any] = json.loads(coc_py.get_catalog_json())

        self._valid_troops: set[str] = {t["id"] for t in self.catalog.get("troops", [])}
        self._valid_spells: set[str] = {s["id"] for s in self.catalog.get("spells", [])}
        self._valid_heroes: set[str] = {h["id"] for h in self.catalog.get("heroes", [])}
        self._valid_buildings: set[str] = {b["id"] for b in self.catalog.get("buildings", [])}

    def default_layout(self) -> dict[str, Any]:
        """Return the default preset TH18 village layout from `coc_data`."""
        presets = self.catalog.get("preset_layouts", [])
        if not presets:
            raise RuntimeError("No preset_layouts found in coc_py catalog")
        return dict(presets[0])

    def default_army(self) -> dict[str, Any]:
        """Return the default preset TH18 army loadout from `coc_data`."""
        armies = self.catalog.get("preset_armies", [])
        if not armies:
            raise RuntimeError("No preset_armies found in coc_py catalog")
        return dict(armies[0])

    def build_actions(
        self,
        localized_drops: Sequence[LocalizedDrop],
        battle_start_sec: float = 0.0,
    ) -> list[ReplayActionEntry]:
        """Convert localized drop events into chronologically sorted `ReplayActionEntry` items."""
        entries: list[ReplayActionEntry] = []
        for drop in localized_drops:
            cand = drop.candidate
            tick = HudDetector.video_sec_to_tick(
                video_sec=cand.video_sec,
                battle_start_sec=battle_start_sec,
                ticks_per_sec=self.ticks_per_sec,
            )
            avail = max(1, cand.count_before)
            dropped = max(1, cand.count_before - cand.count_after)
            if cand.is_ability or cand.slot_type in ("HeroAbility", "Hero", "Siege", "PopSiege"):
                frac = 1.0
            else:
                frac = min(1.0, max(0.01, round(float(dropped) / float(avail), 4)))

            entries.append(
                ReplayActionEntry(
                    tick=tick,
                    slot_type=cand.slot_type,
                    slot_idx=cand.slot_idx,
                    unit_name=cand.unit_type,
                    tile_x=drop.tile_x,
                    tile_y=drop.tile_y,
                    fraction=frac,
                )
            )

        entries.sort(key=lambda e: (e.tick, e.slot_idx))
        return entries

    def build_replay_payload(
        self,
        match_id: str,
        actions: Sequence[ReplayActionEntry | dict[str, Any]],
        segment: BattleSegment | None = None,
        layout: dict[str, Any] | None = None,
        army: dict[str, Any] | None = None,
        source_meta: dict[str, Any] | None = None,
        run_engine_dry_run: bool = True,
    ) -> dict[str, Any]:
        """Assemble a complete replay dossier dictionary and validate it against `coc-engine`."""
        layout_dict = layout if layout is not None else self.default_layout()
        army_dict = army if army is not None else self.default_army()

        action_dicts: list[dict[str, Any]] = [
            a.to_dict() if isinstance(a, ReplayActionEntry) else dict(a)
            for a in actions
        ]

        payload: dict[str, Any] = {
            "schema_version": "1.0",
            "match_id": str(match_id),
            "ticks_per_second": self.ticks_per_sec,
            "source": source_meta or {},
            "battle_segment": asdict(segment) if segment is not None else {
                "start_frame": 0,
                "end_frame": 0,
                "start_sec": 0.0,
                "end_sec": 0.0,
                "initial_timer_sec": 180,
                "final_destruction_pct": 100,
                "final_stars": 3,
            },
            "layout": layout_dict,
            "army": army_dict,
            "actions": action_dicts,
        }

        report = self.validate_replay_payload(
            payload, run_engine_dry_run=run_engine_dry_run
        )
        payload["validation"] = asdict(report)
        return payload

    def validate_replay_payload(
        self,
        payload: dict[str, Any],
        run_engine_dry_run: bool = True,
    ) -> ReplayValidationReport:
        """Validate a replay dictionary against `coc_data` rules and optionally dry-run in `coc-engine`."""
        errors: list[str] = []

        # 1. Validate top-level keys
        for req_key in ("match_id", "layout", "army", "actions"):
            if req_key not in payload:
                errors.append(f"Missing required top-level key: {req_key}")

        # 2. Validate village layout via Rust `coc_py.validate_layout_json`
        layout_valid = False
        layout_obj = payload.get("layout")
        if isinstance(layout_obj, dict):
            try:
                val_res = json.loads(
                    coc_py.validate_layout_json(json.dumps(layout_obj))
                )
                layout_valid = bool(
                    val_res.get("is_valid", val_res.get("valid", True))
                )
                if not layout_valid:
                    for err in val_res.get("errors", []):
                        errors.append(f"Layout validation error: {err}")
            except (ValueError, RuntimeError, TypeError, KeyError) as exc:
                errors.append(f"Layout deserialization error: {exc}")
        else:
            errors.append("`layout` must be a JSON object")

        # 3. Validate army roster & action entries against `coc_data` catalog
        roster_valid = True
        actions_valid = True
        actions_list = payload.get("actions", [])
        if not isinstance(actions_list, list):
            actions_valid = False
            errors.append("`actions` must be a list")
            actions_list = []

        prev_tick = -1
        for i, act in enumerate(actions_list):
            if not isinstance(act, dict):
                actions_valid = False
                errors.append(f"Action[{i}] is not a dict")
                continue

            for field in (
                "tick",
                "slot_type",
                "slot_idx",
                "unit_name",
                "tile_x",
                "tile_y",
                "fraction",
            ):
                if field not in act:
                    actions_valid = False
                    errors.append(f"Action[{i}] missing required field '{field}'")

            if not actions_valid:
                continue

            tick = int(act["tick"])
            s_type = str(act["slot_type"])
            s_idx = int(act["slot_idx"])
            u_name = str(act["unit_name"])
            tx = int(act["tile_x"])
            ty = int(act["tile_y"])
            frac = float(act["fraction"])

            if tick < 0 or tick > 180 * max(10, self.ticks_per_sec):
                actions_valid = False
                errors.append(f"Action[{i}] tick {tick} out of bounds")
            if tick < prev_tick:
                actions_valid = False
                errors.append(
                    f"Action[{i}] tick {tick} is not monotonically non-decreasing (prev={prev_tick})"
                )
            prev_tick = tick

            if s_type not in VALID_SLOT_TYPES:
                actions_valid = False
                errors.append(f"Action[{i}] invalid slot_type: {s_type!r}")

            if s_idx < 0:
                actions_valid = False
                errors.append(f"Action[{i}] negative slot_idx: {s_idx}")

            if not (0 <= tx < 50 and 0 <= ty < 50):
                actions_valid = False
                errors.append(f"Action[{i}] tile ({tx}, {ty}) out of 50x50 grid bounds")

            if not (0.0 <= frac <= 1.0):
                actions_valid = False
                errors.append(f"Action[{i}] fraction {frac} outside [0.0, 1.0]")

            # Verify unit_name exists in coc_data catalog
            if s_type in ("Troop", "Siege") and u_name not in self._valid_troops:
                roster_valid = False
                errors.append(f"Action[{i}] unknown Troop/Siege unit_name: {u_name!r}")
            elif s_type in ("Hero", "HeroAbility") and u_name not in self._valid_heroes:
                roster_valid = False
                errors.append(f"Action[{i}] unknown Hero unit_name: {u_name!r}")
            elif s_type == "Spell" and u_name not in self._valid_spells:
                roster_valid = False
                errors.append(f"Action[{i}] unknown Spell unit_name: {u_name!r}")

        # 4. Optional coc-engine simulator dry-run
        sim_executed = False
        sim_pct = 0
        sim_stars = 0
        sim_tick = 0

        if (
            run_engine_dry_run
            and layout_valid
            and roster_valid
            and actions_valid
            and isinstance(payload.get("army"), dict)
        ):
            try:
                sim_pct, sim_stars, sim_tick = self.dry_run_in_engine(
                    layout_dict=payload["layout"],
                    army_dict=payload["army"],
                    actions=actions_list,
                )
                sim_executed = True
            except (ValueError, RuntimeError, TypeError, KeyError) as exc:
                errors.append(f"Engine dry-run error: {exc}")

        overall_valid = layout_valid and roster_valid and actions_valid and len(errors) == 0
        return ReplayValidationReport(
            valid=overall_valid,
            layout_valid=layout_valid,
            roster_valid=roster_valid,
            actions_valid=actions_valid,
            errors=tuple(errors),
            sim_dry_run_executed=sim_executed,
            sim_destruction_pct=sim_pct,
            sim_stars=sim_stars,
            sim_final_tick=sim_tick,
        )

    def dry_run_in_engine(
        self,
        layout_dict: dict[str, Any],
        army_dict: dict[str, Any],
        actions: Sequence[dict[str, Any]],
    ) -> tuple[int, int, int]:
        """Replay the action trajectory in `coc_py.PyBattleEnv` and return `(destruction_pct, stars, final_tick)`."""
        env = coc_py.PyBattleEnv(
            json.dumps(layout_dict),
            json.dumps(army_dict),
            1,
        )
        env.reset()

        troop_Slots = [t[0] for t in army_dict.get("troops", [])]
        spell_slots = [s[0] for s in army_dict.get("spells", [])]
        hero_slots = [h[0] for h in army_dict.get("heroes", [])]

        for act in actions:
            s_type_str = str(act["slot_type"])
            s_type_id = SLOT_TYPE_TO_ID.get(s_type_str, 0)
            u_name = str(act["unit_name"])
            tx = int(act["tile_x"])
            ty = int(act["tile_y"])
            frac = float(act["fraction"])

            # Resolve category-specific slot index (0..9) from unit_name if present in army
            cat_idx = min(9, max(0, int(act["slot_idx"])))
            if s_type_str == "Troop" and u_name in troop_Slots:
                cat_idx = troop_Slots.index(u_name)
            elif s_type_str == "Spell" and u_name in spell_slots:
                cat_idx = spell_slots.index(u_name)
            elif s_type_str in ("Hero", "HeroAbility") and u_name in hero_slots:
                cat_idx = hero_slots.index(u_name)
            elif s_type_str in ("Siege", "PopSiege"):
                cat_idx = 0

            env.step_discrete(s_type_id, cat_idx, tx, ty, 2, frac)

        _, _, _, final_pct, final_stars = env.finish_battle()
        _, _, _, final_tick = env.get_reward_telemetry()
        return int(final_pct), int(final_stars), int(final_tick)

    def save_replay(
        self, match_id: str, payload: dict[str, Any], output_path: Path | str | None = None
    ) -> Path:
        """Write validated replay JSON dossier to `datasets/replays/<match_id>.json`."""
        if output_path is not None:
            out_p = Path(output_path)
        else:
            out_p = self.output_dir / f"{match_id}.json"
        out_p.parent.mkdir(parents=True, exist_ok=True)
        out_p.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return out_p
