"""Spatial drop localizer using isometric projection and adaptive frame differencing.

When a dock decrement event is detected, masks out the red-zone interior (for
troops/heroes/siege) and HUD bands, computes adaptive background differencing
delta_I = |I_t - I_{t-1}|, locates the centroid of the spawn smoke puff /
particle cluster, and maps (px, py) -> (tile_x, tile_y) in [0..49, 0..49].
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import cv2
import numpy as np

from .dock_tracker import DropCandidate
from .isometric_mapper import GRID_SIZE, IsometricMapper


@dataclass(frozen=True)
class LocalizedDrop:
    """Spatial localization result for a single `DropCandidate`."""

    candidate: DropCandidate
    pixel_x: float
    pixel_y: float
    exact_gx: float
    exact_gy: float
    tile_x: int
    tile_y: int
    confidence: float
    cluster_area: float


class DropLocator:
    """Locates unit and spell deployment coordinates on the 50x50 isometric grid."""

    def __init__(
        self,
        mapper: IsometricMapper | None = None,
        no_deploy_mask: np.ndarray | Sequence[Sequence[bool]] | None = None,
        hud_top_cutoff: float = 0.12,
        hud_bottom_cutoff: float = 0.81,
    ) -> None:
        self.mapper = mapper or IsometricMapper()
        self.hud_top_cutoff = hud_top_cutoff
        self.hud_bottom_cutoff = hud_bottom_cutoff
        self._no_deploy_grid: np.ndarray = (
            np.asarray(no_deploy_mask, dtype=bool).reshape((GRID_SIZE, GRID_SIZE))
            if no_deploy_mask is not None
            else self._default_no_deploy_grid()
        )
        self._troop_pixel_mask: np.ndarray | None = None
        self._spell_pixel_mask: np.ndarray | None = None

    @staticmethod
    def _default_no_deploy_grid() -> np.ndarray:
        """Default TH18 village interior mask ([5..45) blocked, outer perimeter valid)."""
        grid = np.zeros((GRID_SIZE, GRID_SIZE), dtype=bool)
        grid[5:45, 5:45] = True
        return grid

    def set_no_deploy_mask(
        self, no_deploy_mask: np.ndarray | Sequence[Sequence[bool]]
    ) -> None:
        """Update the 50x50 boolean red-zone mask and invalidate cached pixel masks."""
        self._no_deploy_grid = np.asarray(no_deploy_mask, dtype=bool).reshape(
            (GRID_SIZE, GRID_SIZE)
        )
        self._troop_pixel_mask = None
        self._spell_pixel_mask = None

    def _get_search_mask(self, frame_h: int, frame_w: int, allow_interior: bool) -> np.ndarray:
        if (
            self.mapper.viewport_w != frame_w
            or self.mapper.viewport_h != frame_h
        ):
            self.mapper.calibration.viewport_w = frame_w
            self.mapper.calibration.viewport_h = frame_h
            self._troop_pixel_mask = None
            self._spell_pixel_mask = None

        if allow_interior:
            if self._spell_pixel_mask is None:
                m = self.mapper.build_deployable_pixel_mask(
                    self._no_deploy_grid, allow_interior=True
                )
                self._apply_hud_cutoffs(m)
                self._spell_pixel_mask = m
            return self._spell_pixel_mask

        if self._troop_pixel_mask is None:
            m = self.mapper.build_deployable_pixel_mask(
                self._no_deploy_grid, allow_interior=False
            )
            self._apply_hud_cutoffs(m)
            self._troop_pixel_mask = m
        return self._troop_pixel_mask

    def _apply_hud_cutoffs(self, mask: np.ndarray) -> None:
        h = mask.shape[0]
        top_y = round(self.hud_top_cutoff * h)
        bot_y = round(self.hud_bottom_cutoff * h)
        mask[:top_y, :] = 0
        mask[bot_y:, :] = 0

    def snap_to_valid_tile(
        self, tile_x: int, tile_y: int, allow_interior: bool = False
    ) -> tuple[int, int]:
        """Ensure (tile_x, tile_y) lies on a valid deployable tile for troops/heroes/siege."""
        tx = int(np.clip(tile_x, 0, GRID_SIZE - 1))
        ty = int(np.clip(tile_y, 0, GRID_SIZE - 1))
        if allow_interior or not self._no_deploy_grid[ty, tx]:
            return tx, ty

        valid_ys, valid_xs = np.nonzero(~self._no_deploy_grid)
        if len(valid_xs) == 0:
            return tx, ty

        dists = (valid_xs - tx) ** 2 + (valid_ys - ty) ** 2
        best_idx = int(np.argmin(dists))
        return int(valid_xs[best_idx]), int(valid_ys[best_idx])

    def localize_drop(
        self,
        prev_frame_bgr: np.ndarray,
        curr_frame_bgr: np.ndarray,
        candidate: DropCandidate,
        diff_threshold: int = 24,
    ) -> LocalizedDrop:
        """Locate the (tile_x, tile_y) spawn puff in `curr_frame_bgr` relative to `prev_frame_bgr`."""
        if candidate.is_ability or candidate.slot_type in ("HeroAbility", "PopSiege"):
            # Non-spatial action (Hero Ability / Siege Pop) uses canonical (0, 0) or last hero pos
            px, py = self.mapper.tile_center_to_screen(25, 25)
            return LocalizedDrop(
                candidate=candidate,
                pixel_x=px,
                pixel_y=py,
                exact_gx=25.0,
                exact_gy=25.0,
                tile_x=0,
                tile_y=0,
                confidence=1.0,
                cluster_area=0.0,
            )

        allow_interior = candidate.slot_type == "Spell"
        h, w = curr_frame_bgr.shape[:2]
        search_mask = self._get_search_mask(h, w, allow_interior=allow_interior)

        # Compute multi-channel absolute frame difference delta_I = |I_t - I_{t-1}|
        diff_bgr = cv2.absdiff(curr_frame_bgr, prev_frame_bgr)
        diff_gray = np.max(diff_bgr, axis=2) if diff_bgr.ndim == 3 else diff_bgr
        masked_diff = cv2.bitwise_and(diff_gray, diff_gray, mask=search_mask)

        # Smooth slightly to coalesce particle / smoke puff clusters
        blurred = cv2.GaussianBlur(masked_diff, (5, 5), 1.0)
        max_delta = float(blurred.max()) if blurred.size > 0 else 0.0

        if max_delta < 4.0:
            # Fallback to default perimeter anchor if frame had zero motion
            tx, ty = self.snap_to_valid_tile(1, 25, allow_interior=allow_interior)
            px, py = self.mapper.tile_center_to_screen(tx, ty)
            return LocalizedDrop(
                candidate=candidate,
                pixel_x=px,
                pixel_y=py,
                exact_gx=float(tx) + 0.5,
                exact_gy=float(ty) + 0.5,
                tile_x=tx,
                tile_y=ty,
                confidence=0.1,
                cluster_area=0.0,
            )

        adaptive_thresh = max(float(diff_threshold), max_delta * 0.45)
        _, thresh_mask = cv2.threshold(
            blurred, round(adaptive_thresh), 255, cv2.THRESH_BINARY
        )
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        cleaned = cv2.morphologyEx(thresh_mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(
            cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )

        best_cx = 0.0
        best_cy = 0.0
        best_score = -1.0
        best_area = 0.0

        for cnt in contours:
            area = float(cv2.contourArea(cnt))
            if area < 4.0:
                continue
            m = cv2.moments(cnt)
            if m["m00"] <= 1e-5:
                continue
            cx = float(m["m10"] / m["m00"])
            cy = float(m["m01"] / m["m00"])
            ix = int(np.clip(round(cx), 0, w - 1))
            iy = int(np.clip(round(cy), 0, h - 1))
            peak_intensity = float(blurred[iy, ix])
            score = area * (0.5 + peak_intensity / 255.0)
            if score > best_score:
                best_score = score
                best_cx = cx
                best_cy = cy
                best_area = area

        if best_score < 0.0:
            # Fallback to global argmax pixel inside search_mask
            iy, ix = np.unravel_index(int(np.argmax(blurred)), blurred.shape)
            best_cx, best_cy = float(ix), float(iy)
            best_area = 1.0

        gx, gy = self.mapper.screen_to_grid(best_cx, best_cy, clamp=True)
        raw_tx = int(np.clip(np.floor(gx), 0, GRID_SIZE - 1))
        raw_ty = int(np.clip(np.floor(gy), 0, GRID_SIZE - 1))
        tx, ty = self.snap_to_valid_tile(raw_tx, raw_ty, allow_interior=allow_interior)
        conf = float(np.clip(max_delta / 90.0, 0.25, 1.0))

        return LocalizedDrop(
            candidate=candidate,
            pixel_x=round(best_cx, 2),
            pixel_y=round(best_cy, 2),
            exact_gx=round(gx, 3),
            exact_gy=round(gy, 3),
            tile_x=tx,
            tile_y=ty,
            confidence=round(conf, 4),
            cluster_area=round(best_area, 2),
        )
