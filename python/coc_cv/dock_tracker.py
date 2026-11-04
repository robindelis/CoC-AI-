"""Deployment dock tracker for troop, spell, siege, and hero cards.

Crops the bottom deployment dock band across video frames, identifies each slot
using sprite templates from `web/public/assets/{troops,spells,heroes}/`, tracks
active selection glow, reads unit count decrements via `FontMatcher`, and emits
discrete `DropCandidate` events.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .font_matcher import FontMatcher

REPO_ROOT = Path(__file__).resolve().parents[2]
ASSETS_ROOT = REPO_ROOT / "web" / "public" / "assets"

SIEGE_UNIT_NAMES: frozenset[str] = frozenset(
    {
        "WallWrecker",
        "BattleBlimp",
        "StoneSlammer",
        "SiegeBarracks",
        "LogLauncher",
        "FlameFlinger",
        "BattleDrill",
        "TroopLauncher",
        "SkyWagon",
    }
)

FILENAME_OVERRIDES: dict[str, str] = {
    "skeleton_spell": "SkeletonSpell",
    "bat_spell": "BatSpell",
    "ice_block_spell": "IceBlock",
}


def _stem_to_canonical_name(stem: str, category: str) -> str:
    if stem in FILENAME_OVERRIDES:
        return FILENAME_OVERRIDES[stem]
    if category == "Spell" and stem.endswith("_spell"):
        stem = stem[: -len("_spell")]
    return "".join(part.capitalize() for part in stem.split("_") if part)


@dataclass(frozen=True)
class SpriteTemplate:
    """Reference icon template loaded from `web/public/assets/`."""

    unit_name: str
    slot_type: str  # "Troop" | "Siege" | "Hero" | "Spell"
    path: Path
    icon_bgr: np.ndarray  # Normalized (48, 48, 3) BGR icon
    hist_hsv: np.ndarray


@dataclass(frozen=True)
class DockSlotState:
    """Instantaneous state of a single card in the deployment dock."""

    slot_idx: int
    slot_type: str  # "Troop" | "Hero" | "HeroAbility" | "Siege" | "Spell"
    unit_type: str
    count: int
    selected: bool
    ability_active: bool
    bbox: tuple[int, int, int, int]  # (x, y, w, h) in full frame coordinates


@dataclass(frozen=True)
class DropCandidate:
    """Discrete deployment or hero-ability event detected on the dock."""

    frame_idx: int
    video_sec: float
    slot_idx: int
    unit_type: str
    count_before: int
    count_after: int
    slot_type: str = "Troop"
    initial_count: int = 1
    is_ability: bool = False
    selected: bool = True

    @property
    def dropped_count(self) -> int:
        return max(1, self.count_before - self.count_after)


class DockTracker:
    """Tracks dock slot identities, selection borders, count decrements, and hero abilities."""

    def __init__(
        self,
        font_matcher: FontMatcher | None = None,
        assets_root: Path | str | None = None,
        num_slots: int = 11,
        dock_norm_box: tuple[float, float, float, float] = (0.04, 0.82, 0.96, 0.98),
    ) -> None:
        self.font_matcher = font_matcher or FontMatcher()
        self.assets_root = Path(assets_root) if assets_root is not None else ASSETS_ROOT
        self.num_slots = max(1, int(num_slots))
        self.dock_norm_box = dock_norm_box
        self.templates: dict[str, SpriteTemplate] = {}
        self._load_sprite_templates()

        # Stateful tracking across frames
        self._slot_identities: dict[int, tuple[str, str]] = {}  # slot_idx -> (slot_type, unit_name)
        self._initial_counts: dict[int, int] = {}
        self._prev_counts: dict[int, int] = {}
        self._hero_deployed: dict[int, bool] = {}
        self._hero_ability_used: dict[int, bool] = {}

    def reset(self) -> None:
        """Reset temporal dock tracking state between videos."""
        self._slot_identities.clear()
        self._initial_counts.clear()
        self._prev_counts.clear()
        self._hero_deployed.clear()
        self._hero_ability_used.clear()

    def set_known_roster(
        self, roster: Sequence[tuple[str, str, int]]
    ) -> None:
        """Optionally seed the dock tracker with a known [(slot_type, unit_name, initial_count), ...] roster."""
        self.reset()
        self.num_slots = max(1, len(roster))
        for idx, (s_type, u_name, init_cnt) in enumerate(roster):
            self._slot_identities[idx] = (s_type, u_name)
            self._initial_counts[idx] = max(1, int(init_cnt))
            self._prev_counts[idx] = int(init_cnt)

    def _load_sprite_templates(self) -> None:
        folder_map = [
            ("troops", "Troop"),
            ("spells", "Spell"),
            ("heroes", "Hero"),
        ]
        for subdir, default_cat in folder_map:
            folder = self.assets_root / subdir
            if not folder.exists():
                continue
            for p in sorted(folder.iterdir()):
                if p.suffix.lower() not in (".webp", ".png", ".jpg"):
                    continue
                if p.stem.startswith("banner_"):
                    continue
                raw = cv2.imread(str(p), cv2.IMREAD_UNCHANGED)
                if raw is None or raw.size == 0:
                    continue
                if raw.ndim == 3 and raw.shape[2] == 4:
                    alpha = raw[:, :, 3:4].astype(np.float32) / 255.0
                    bgr = raw[:, :, :3].astype(np.float32)
                    bg = np.full_like(bgr, (42.0, 38.0, 34.0))
                    comp = (bgr * alpha + bg * (1.0 - alpha)).astype(np.uint8)
                elif raw.ndim == 3:
                    comp = raw[:, :, :3]
                else:
                    comp = cv2.cvtColor(raw, cv2.COLOR_GRAY2BGR)

                icon_48 = cv2.resize(comp, (48, 48), interpolation=cv2.INTER_AREA)
                hsv = cv2.cvtColor(icon_48, cv2.COLOR_BGR2HSV)
                hist = cv2.calcHist([hsv], [0, 1], None, [18, 16], [0, 180, 0, 256])
                cv2.normalize(hist, hist)

                u_name = _stem_to_canonical_name(p.stem, default_cat)
                s_type = "Siege" if u_name in SIEGE_UNIT_NAMES else default_cat
                self.templates[u_name] = SpriteTemplate(
                    unit_name=u_name,
                    slot_type=s_type,
                    path=p,
                    icon_bgr=icon_48,
                    hist_hsv=hist,
                )

    def get_slot_bboxes(self, frame_w: int, frame_h: int) -> list[tuple[int, int, int, int]]:
        """Compute individual card bounding boxes (x, y, w, h) along the bottom dock."""
        x0 = round(self.dock_norm_box[0] * frame_w)
        y0 = round(self.dock_norm_box[1] * frame_h)
        x1 = round(self.dock_norm_box[2] * frame_w)
        y1 = round(self.dock_norm_box[3] * frame_h)
        total_w = max(self.num_slots * 16, x1 - x0)
        slot_step = total_w / float(self.num_slots)
        pad_x = max(2, round(slot_step * 0.06))
        boxes: list[tuple[int, int, int, int]] = []
        for i in range(self.num_slots):
            sx = x0 + round(i * slot_step) + pad_x
            sw = max(12, round(slot_step) - 2 * pad_x)
            boxes.append((sx, y0, sw, max(16, y1 - y0)))
        return boxes

    def classify_card_icon(
        self, card_bgr: np.ndarray, candidate_names: Sequence[str] | None = None
    ) -> tuple[str, str, float]:
        """Match a card's center icon region against loaded Supercell asset sprites.

        Returns `(slot_type, unit_name, confidence)`.
        """
        ch, cw = card_bgr.shape[:2]
        iy0 = round(ch * 0.34)
        iy1 = max(iy0 + 8, round(ch * 0.90))
        ix0 = round(cw * 0.12)
        ix1 = max(ix0 + 8, round(cw * 0.88))
        icon_crop = card_bgr[iy0:iy1, ix0:ix1]
        if icon_crop.size == 0 or not self.templates:
            return "Troop", "Thrower", 0.0

        icon_48 = cv2.resize(icon_crop, (48, 48), interpolation=cv2.INTER_AREA)
        hsv = cv2.cvtColor(icon_48, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], None, [18, 16], [0, 180, 0, 256])
        cv2.normalize(hist, hist)

        pool = (
            [self.templates[n] for n in candidate_names if n in self.templates]
            if candidate_names
            else list(self.templates.values())
        )
        if not pool:
            pool = list(self.templates.values())

        best_tmpl = pool[0]
        best_score = -1.0
        for tmpl in pool:
            res = cv2.matchTemplate(icon_48, tmpl.icon_bgr, cv2.TM_CCOEFF_NORMED)
            ncc = float(res[0, 0])
            h_corr = float(cv2.compareHist(hist, tmpl.hist_hsv, cv2.HISTCMP_CORREL))
            score = 0.65 * max(0.0, ncc) + 0.35 * max(0.0, h_corr)
            if score > best_score:
                best_score = score
                best_tmpl = tmpl

        return best_tmpl.slot_type, best_tmpl.unit_name, float(np.clip(best_score, 0.0, 1.0))

    @staticmethod
    def _detect_border_states(card_bgr: np.ndarray) -> tuple[bool, bool]:
        """Detect active card selection glow and hero ability activation aura."""
        ch, cw = card_bgr.shape[:2]
        if ch < 8 or cw < 8:
            return False, False

        # Border ring (outer 5 pixels)
        border_mask = np.zeros((ch, cw), dtype=bool)
        border_mask[:5, :] = True
        border_mask[-5:, :] = True
        border_mask[:, :5] = True
        border_mask[:, -5:] = True

        hsv = cv2.cvtColor(card_bgr, cv2.COLOR_BGR2HSV)
        border_hsv = hsv[border_mask]

        # Selection glow: bright lime/yellow-green or bright gold border
        sel_pixels = np.count_nonzero(
            (border_hsv[:, 0] >= 20)
            & (border_hsv[:, 0] <= 80)
            & (border_hsv[:, 1] >= 90)
            & (border_hsv[:, 2] >= 150)
        )
        selected = (float(sel_pixels) / max(1, len(border_hsv))) >= 0.12

        # Ability aura: bright magenta/purple surge on hero card
        abil_pixels = np.count_nonzero(
            (border_hsv[:, 0] >= 120)
            & (border_hsv[:, 0] <= 175)
            & (border_hsv[:, 1] >= 90)
            & (border_hsv[:, 2] >= 150)
        )
        ability_active = (float(abil_pixels) / max(1, len(border_hsv))) >= 0.12
        return selected, ability_active

    def read_card_count(self, card_bgr: np.ndarray, fallback: int = 0) -> int:
        """Read the unit count badge in the top portion of a dock card."""
        ch, cw = card_bgr.shape[:2]
        badge_crop = card_bgr[round(ch * 0.02) : round(ch * 0.36), round(cw * 0.08) : round(cw * 0.92)]
        val, conf = self.font_matcher.match_digits_with_confidence(badge_crop, min_confidence=0.48)
        if val is None or conf < 0.48:
            return fallback
        return int(val)

    def inspect_frame(self, frame_bgr: np.ndarray) -> list[DockSlotState]:
        """Extract the instantaneous state of all dock slots in `frame_bgr`."""
        h, w = frame_bgr.shape[:2]
        bboxes = self.get_slot_bboxes(w, h)
        states: list[DockSlotState] = []

        for idx, (bx, by, bw, bh) in enumerate(bboxes):
            card = frame_bgr[by : by + bh, bx : bx + bw]
            if idx not in self._slot_identities:
                s_type, u_name, _ = self.classify_card_icon(card)
                self._slot_identities[idx] = (s_type, u_name)
            else:
                s_type, u_name = self._slot_identities[idx]

            prev_cnt = self._prev_counts.get(idx, 0)
            cnt = self.read_card_count(card, fallback=prev_cnt)
            selected, ability_active = self._detect_border_states(card)

            states.append(
                DockSlotState(
                    slot_idx=idx,
                    slot_type=s_type,
                    unit_type=u_name,
                    count=cnt,
                    selected=selected,
                    ability_active=ability_active,
                    bbox=(bx, by, bw, bh),
                )
            )
        return states

    def update(
        self, frame_bgr: np.ndarray, frame_idx: int, video_sec: float
    ) -> tuple[list[DropCandidate], list[DockSlotState]]:
        """Process a new video frame and return `(emitted_drop_events, slot_states)`."""
        slot_states = self.inspect_frame(frame_bgr)
        events: list[DropCandidate] = []

        for st in slot_states:
            idx = st.slot_idx
            if idx not in self._prev_counts:
                self._prev_counts[idx] = st.count
                self._initial_counts[idx] = max(1, st.count)
                continue

            before = self._prev_counts[idx]
            after = st.count
            if after > self._initial_counts.get(idx, 1) and before == 0:
                # Initial HUD fade-in stabilization
                self._initial_counts[idx] = after
                self._prev_counts[idx] = after
                continue

            if st.slot_type == "Hero":
                if before > after and not self._hero_deployed.get(idx, False):
                    self._hero_deployed[idx] = True
                    self._prev_counts[idx] = after
                    events.append(
                        DropCandidate(
                            frame_idx=frame_idx,
                            video_sec=round(float(video_sec), 4),
                            slot_idx=idx,
                            unit_type=st.unit_type,
                            count_before=before,
                            count_after=after,
                            slot_type="Hero",
                            initial_count=1,
                            is_ability=False,
                            selected=st.selected,
                        )
                    )
                elif (
                    self._hero_deployed.get(idx, False)
                    and not self._hero_ability_used.get(idx, False)
                    and st.ability_active
                ):
                    self._hero_ability_used[idx] = True
                    events.append(
                        DropCandidate(
                            frame_idx=frame_idx,
                            video_sec=round(float(video_sec), 4),
                            slot_idx=idx,
                            unit_type=st.unit_type,
                            count_before=after,
                            count_after=after,
                            slot_type="HeroAbility",
                            initial_count=1,
                            is_ability=True,
                            selected=st.selected,
                        )
                    )
            else:
                if after < before:
                    self._prev_counts[idx] = after
                    events.append(
                        DropCandidate(
                            frame_idx=frame_idx,
                            video_sec=round(float(video_sec), 4),
                            slot_idx=idx,
                            unit_type=st.unit_type,
                            count_before=before,
                            count_after=after,
                            slot_type=st.slot_type,
                            initial_count=self._initial_counts.get(idx, max(1, before)),
                            is_ability=False,
                            selected=st.selected,
                        )
                    )

        return events, slot_states
