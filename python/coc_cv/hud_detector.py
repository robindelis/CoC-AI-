"""Battle HUD detector for timer countdown, destruction percentage, and star count.

Monitors the Clash of Clans HUD across video frames to:
1. Read the countdown timer (03:00 down to 00:00).
2. Read the destruction percentage (0% -> 100%) and stars (0 -> 3).
3. Segment the exact battle start and end frames within a broadcast video.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

import cv2
import numpy as np

from .font_matcher import FontMatcher


@dataclass(frozen=True)
class HudRoiConfig:
    """Normalized [x0, y0, x1, y1] bounding boxes for Clash of Clans HUD elements."""

    # Primary top-right countdown timer ROI
    timer_top_right: tuple[float, float, float, float] = (0.82, 0.02, 0.98, 0.11)
    # Fallback top-center spectator countdown timer ROI
    timer_top_center: tuple[float, float, float, float] = (0.43, 0.02, 0.57, 0.11)
    # Top-left destruction percentage text ROI
    destruction_top_left: tuple[float, float, float, float] = (0.02, 0.02, 0.16, 0.11)
    # Top-left 3-star indicator strip ROI
    stars_top_left: tuple[float, float, float, float] = (0.02, 0.11, 0.16, 0.17)
    # Bottom deployment dock band ROI
    dock_bottom: tuple[float, float, float, float] = (0.04, 0.82, 0.96, 0.98)


@dataclass(frozen=True)
class HudFrameState:
    """Extracted HUD state for a single video frame."""

    frame_idx: int
    video_sec: float
    in_battle: bool
    time_remaining_sec: int | None
    destruction_pct: int
    stars: int
    timer_confidence: float
    destruction_confidence: float


@dataclass(frozen=True)
class BattleSegment:
    """Segmented battle window inside a video stream."""

    start_frame: int
    end_frame: int
    start_sec: float
    end_sec: float
    initial_timer_sec: int
    final_destruction_pct: int
    final_stars: int


class HudDetector:
    """Detects battle boundaries, countdown clock, destruction %, and stars."""

    def __init__(
        self,
        font_matcher: FontMatcher | None = None,
        roi_config: HudRoiConfig | None = None,
    ) -> None:
        self.font_matcher = font_matcher or FontMatcher()
        self.roi_config = roi_config or HudRoiConfig()

    @staticmethod
    def crop_normalized(
        frame: np.ndarray, norm_box: tuple[float, float, float, float]
    ) -> tuple[np.ndarray, tuple[int, int, int, int]]:
        """Crop a normalized (x0, y0, x1, y1) box from `frame` and return (crop, pixel_box)."""
        h, w = frame.shape[:2]
        x0 = max(0, min(w - 1, round(norm_box[0] * w)))
        y0 = max(0, min(h - 1, round(norm_box[1] * h)))
        x1 = max(x0 + 1, min(w, round(norm_box[2] * w)))
        y1 = max(y0 + 1, min(h, round(norm_box[3] * h)))
        return frame[y0:y1, x0:x1], (x0, y0, x1 - x0, y1 - y0)

    def detect_timer(self, frame_bgr: np.ndarray) -> tuple[int | None, float]:
        """Read battle countdown timer (in seconds remaining, 0..180) from top HUD."""
        for box in (self.roi_config.timer_top_right, self.roi_config.timer_top_center):
            crop, _ = self.crop_normalized(frame_bgr, box)
            sec, conf = self.font_matcher.match_timer_seconds(crop, min_confidence=0.50)
            if sec is not None and 0 <= sec <= 180:
                return sec, conf
        return None, 0.0

    def detect_destruction_pct(self, frame_bgr: np.ndarray) -> tuple[int, float]:
        """Read battle destruction percentage (0..100) from top-left HUD."""
        crop, _ = self.crop_normalized(frame_bgr, self.roi_config.destruction_top_left)
        res = self.font_matcher.recognize(crop, min_confidence=0.50)
        if res.value is None:
            return 0, 0.0
        val = res.value
        # If trailing '%' glyph was partially matched as a digit on low-res streams, clamp sensibly
        if val > 100 and len(res.text) >= 2:
            candidate = int(res.text[:-1])
            if 0 <= candidate <= 100:
                val = candidate
        if 0 <= val <= 100:
            return val, res.confidence
        return 0, 0.0

    def detect_stars(self, frame_bgr: np.ndarray, destruction_pct: int = 0) -> int:
        """Count earned battle stars (0..3) from the top-left star strip."""
        crop, _ = self.crop_normalized(frame_bgr, self.roi_config.stars_top_left)
        if crop.size == 0:
            return 3 if destruction_pct >= 100 else (1 if destruction_pct >= 50 else 0)

        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        # Golden star hue/saturation/value mask
        gold_mask = cv2.inRange(hsv, np.array([14, 110, 145]), np.array([38, 255, 255]))
        _h, w = gold_mask.shape[:2]
        slot_w = max(1, w // 3)
        earned = 0
        for i in range(3):
            slot = gold_mask[:, i * slot_w : min(w, (i + 1) * slot_w)]
            fill_ratio = float(np.count_nonzero(slot)) / max(1.0, float(slot.size))
            if fill_ratio >= 0.08:
                earned += 1

        if destruction_pct >= 100:
            earned = 3
        elif destruction_pct >= 50:
            earned = max(1, earned)
        return min(3, earned)

    def analyze_frame(
        self, frame_bgr: np.ndarray, frame_idx: int = 0, video_sec: float = 0.0
    ) -> HudFrameState:
        """Extract timer, destruction percentage, and stars from a single video frame."""
        timer_sec, timer_conf = self.detect_timer(frame_bgr)
        destr_pct, destr_conf = self.detect_destruction_pct(frame_bgr)
        stars = self.detect_stars(frame_bgr, destruction_pct=destr_pct)
        in_battle = (timer_sec is not None and timer_conf >= 0.50) or (destr_conf >= 0.65)
        return HudFrameState(
            frame_idx=frame_idx,
            video_sec=video_sec,
            in_battle=in_battle,
            time_remaining_sec=timer_sec,
            destruction_pct=destr_pct,
            stars=stars,
            timer_confidence=timer_conf,
            destruction_confidence=destr_conf,
        )

    def segment_battle(
        self,
        frames: Iterable[tuple[int, float, np.ndarray]] | Sequence[HudFrameState],
    ) -> tuple[BattleSegment | None, list[HudFrameState]]:
        """Identify the active battle start and end boundaries from a frame sequence."""
        states: list[HudFrameState] = []
        for item in frames:
            if isinstance(item, HudFrameState):
                states.append(item)
            else:
                f_idx, f_sec, f_bgr = item
                states.append(self.analyze_frame(f_bgr, frame_idx=f_idx, video_sec=f_sec))

        battle_states = [s for s in states if s.in_battle]
        if not battle_states:
            return None, states

        # Battle starts when countdown timer first starts ticking down (or first active battle frame)
        start_state = battle_states[0]
        initial_timer = start_state.time_remaining_sec or 180
        for s in battle_states:
            if s.time_remaining_sec is not None and s.time_remaining_sec < initial_timer:
                # Step one frame back if available so we capture t=0 of the attack
                idx = battle_states.index(s)
                start_state = battle_states[max(0, idx - 1)]
                break

        # Battle ends when 100% / 3 stars is reached, timer hits 0, or last battle HUD frame
        end_state = battle_states[-1]
        for s in battle_states:
            if s.frame_idx < start_state.frame_idx:
                continue
            if s.destruction_pct >= 100 or s.stars == 3 or (
                s.time_remaining_sec is not None and s.time_remaining_sec == 0
            ):
                end_state = s
                break

        max_pct = max(
            (s.destruction_pct for s in battle_states if s.frame_idx <= end_state.frame_idx),
            default=end_state.destruction_pct,
        )
        max_stars = max(
            (s.stars for s in battle_states if s.frame_idx <= end_state.frame_idx),
            default=end_state.stars,
        )

        segment = BattleSegment(
            start_frame=start_state.frame_idx,
            end_frame=end_state.frame_idx,
            start_sec=start_state.video_sec,
            end_sec=end_state.video_sec,
            initial_timer_sec=start_state.time_remaining_sec or 180,
            final_destruction_pct=max_pct,
            final_stars=max_stars,
        )
        return segment, states

    @staticmethod
    def video_sec_to_tick(
        video_sec: float,
        battle_start_sec: float,
        ticks_per_sec: int = 30,
        max_battle_sec: int = 180,
    ) -> int:
        """Convert video timestamp into deterministic engine tick (default 30 ticks/s)."""
        elapsed = max(0.0, float(video_sec) - float(battle_start_sec))
        max_tick = max_battle_sec * ticks_per_sec
        return int(np.clip(round(elapsed * ticks_per_sec), 0, max_tick))
