"""2.5D Isometric projection mapper between video pixels and the 50x50 simulation grid.

Implements the exact forward and inverse isometric projection matrix from
`web/src/canvas/BattlefieldCanvas.tsx`:
    dx = (vx - VIRTUAL_W / 2) / (ISO_TILE_W / 2)
    dy = (vy - ISO_ORIGIN_Y) / (ISO_TILE_H / 2)
    gx = (dy + dx) / 2
    gy = (dy - dx) / 2
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import cv2
import numpy as np

VIRTUAL_W: float = 1240.0
VIRTUAL_H: float = 880.0
ISO_TILE_W: float = 21.6
ISO_TILE_H: float = 14.4
ISO_ORIGIN_Y: float = 78.0
ORTHO_BOARD_PX: float = 780.0
GRID_SIZE: int = 50


@dataclass
class CameraCalibration:
    """Camera viewport and transform parameters for a video stream."""

    viewport_w: int = 1920
    viewport_h: int = 1080
    zoom: float = 1.05
    pan_x: float = 0.0
    pan_y: float = 0.0
    isometric: bool = True

    @property
    def fit(self) -> float:
        return min(self.viewport_w / VIRTUAL_W, self.viewport_h / VIRTUAL_H)

    @property
    def scale(self) -> float:
        return max(1e-6, self.fit * self.zoom)


class IsometricMapper:
    """Bidirectional 2.5D isometric coordinate mapper for Clash of Clans 50x50 villages."""

    def __init__(
        self,
        viewport_w: int = 1920,
        viewport_h: int = 1080,
        zoom: float = 1.05,
        pan_x: float = 0.0,
        pan_y: float = 0.0,
        isometric: bool = True,
    ) -> None:
        self.calibration = CameraCalibration(
            viewport_w=viewport_w,
            viewport_h=viewport_h,
            zoom=zoom,
            pan_x=pan_x,
            pan_y=pan_y,
            isometric=isometric,
        )

    @property
    def viewport_w(self) -> int:
        return self.calibration.viewport_w

    @property
    def viewport_h(self) -> int:
        return self.calibration.viewport_h

    def grid_to_virtual(self, gx: float, gy: float) -> tuple[float, float]:
        """Convert continuous grid coordinates (gx, gy) in [0, 50] to virtual design space."""
        if not self.calibration.isometric:
            ox = (VIRTUAL_W - ORTHO_BOARD_PX) / 2.0
            oy = (VIRTUAL_H - ORTHO_BOARD_PX) / 2.0
            cell = ORTHO_BOARD_PX / float(GRID_SIZE)
            return ox + gx * cell, oy + gy * cell

        vx = VIRTUAL_W / 2.0 + (gx - gy) * (ISO_TILE_W / 2.0)
        vy = ISO_ORIGIN_Y + (gx + gy) * (ISO_TILE_H / 2.0)
        return vx, vy

    def virtual_to_grid(self, vx: float, vy: float) -> tuple[float, float]:
        """Convert virtual design space coordinates (vx, vy) to continuous grid (gx, gy)."""
        if not self.calibration.isometric:
            ox = (VIRTUAL_W - ORTHO_BOARD_PX) / 2.0
            oy = (VIRTUAL_H - ORTHO_BOARD_PX) / 2.0
            cell = ORTHO_BOARD_PX / float(GRID_SIZE)
            return (vx - ox) / cell, (vy - oy) / cell

        dx = (vx - VIRTUAL_W / 2.0) / (ISO_TILE_W / 2.0)
        dy = (vy - ISO_ORIGIN_Y) / (ISO_TILE_H / 2.0)
        gx = (dy + dx) / 2.0
        gy = (dy - dx) / 2.0
        return gx, gy

    def virtual_to_screen(self, vx: float, vy: float) -> tuple[float, float]:
        """Project virtual design space coordinates to video frame pixels."""
        cal = self.calibration
        s = cal.scale
        px = (vx - VIRTUAL_W / 2.0) * s + cal.viewport_w / 2.0 + cal.pan_x
        py = (vy - VIRTUAL_H / 2.0) * s + cal.viewport_h / 2.0 + cal.pan_y
        return px, py

    def screen_to_virtual(self, px: float, py: float) -> tuple[float, float]:
        """Invert video frame pixels back to virtual design space coordinates."""
        cal = self.calibration
        s = cal.scale
        vx = (px - cal.viewport_w / 2.0 - cal.pan_x) / s + VIRTUAL_W / 2.0
        vy = (py - cal.viewport_h / 2.0 - cal.pan_y) / s + VIRTUAL_H / 2.0
        return vx, vy

    def grid_to_screen(self, gx: float, gy: float) -> tuple[float, float]:
        """Project continuous 50x50 grid coordinates (gx, gy) to video pixel (px, py)."""
        vx, vy = self.grid_to_virtual(gx, gy)
        return self.virtual_to_screen(vx, vy)

    def screen_to_grid(
        self, px: float, py: float, clamp: bool = False
    ) -> tuple[float, float]:
        """Invert video pixel (px, py) to continuous 50x50 grid coordinates (gx, gy)."""
        vx, vy = self.screen_to_virtual(px, py)
        gx, gy = self.virtual_to_grid(vx, vy)
        if clamp:
            gx = min(float(GRID_SIZE - 1), max(0.0, gx))
            gy = min(float(GRID_SIZE - 1), max(0.0, gy))
        return gx, gy

    def screen_to_tile(self, px: float, py: float) -> tuple[int, int]:
        """Convert video pixel (px, py) to clamped integer tile coordinates (tile_x, tile_y) in [0..49]."""
        gx, gy = self.screen_to_grid(px, py, clamp=False)
        tx = int(np.clip(np.floor(gx), 0, GRID_SIZE - 1))
        ty = int(np.clip(np.floor(gy), 0, GRID_SIZE - 1))
        return tx, ty

    def tile_center_to_screen(self, tile_x: int, tile_y: int) -> tuple[float, float]:
        """Return the screen pixel coordinates of the center of discrete tile (tile_x, tile_y)."""
        return self.grid_to_screen(float(tile_x) + 0.5, float(tile_y) + 0.5)

    def tile_polygon_screen(self, tile_x: int, tile_y: int) -> np.ndarray:
        """Return the 4 screen-space vertices of a discrete tile diamond as shape (4, 2) int32."""
        x0, y0 = float(tile_x), float(tile_y)
        corners = [
            self.grid_to_screen(x0, y0),
            self.grid_to_screen(x0 + 1.0, y0),
            self.grid_to_screen(x0 + 1.0, y0 + 1.0),
            self.grid_to_screen(x0, y0 + 1.0),
        ]
        return np.round(np.asarray(corners, dtype=np.float32)).astype(np.int32)

    def calibrate_from_anchors(
        self,
        anchors: Sequence[tuple[tuple[float, float], tuple[float, float]]],
    ) -> CameraCalibration:
        """Calibrate camera zoom and pan from known ((gx, gy), (px, py)) anchor pairs.

        If 1 anchor is provided, calibrates (pan_x, pan_y) keeping current zoom.
        If >= 2 anchors are provided, solves least-squares for isotropic scale s = fit * zoom
        and translation (pan_x, pan_y).
        """
        if not anchors:
            return self.calibration

        cal = self.calibration
        if len(anchors) == 1:
            (gx, gy), (px, py) = anchors[0]
            vx, vy = self.grid_to_virtual(gx, gy)
            s = cal.scale
            cal.pan_x = px - cal.viewport_w / 2.0 - (vx - VIRTUAL_W / 2.0) * s
            cal.pan_y = py - cal.viewport_h / 2.0 - (vy - VIRTUAL_H / 2.0) * s
            return cal

        v_offsets: list[tuple[float, float]] = []
        s_targets: list[tuple[float, float]] = []
        for (gx, gy), (px, py) in anchors:
            vx, vy = self.grid_to_virtual(gx, gy)
            v_offsets.append((vx - VIRTUAL_W / 2.0, vy - VIRTUAL_H / 2.0))
            s_targets.append((px - cal.viewport_w / 2.0, py - cal.viewport_h / 2.0))

        # Linear system:
        # [dvx, 1, 0] [s    ] = [dpx]
        # [dvy, 0, 1] [pan_x]   [dpy]
        #             [pan_y]
        a_rows: list[list[float]] = []
        b_vals: list[float] = []
        for (dvx, dvy), (dpx, dpy) in zip(v_offsets, s_targets):
            a_rows.append([dvx, 1.0, 0.0])
            b_vals.append(dpx)
            a_rows.append([dvy, 0.0, 1.0])
            b_vals.append(dpy)

        a_mat = np.asarray(a_rows, dtype=np.float64)
        b_vec = np.asarray(b_vals, dtype=np.float64)
        sol, _, _, _ = np.linalg.lstsq(a_mat, b_vec, rcond=None)
        s_est = max(0.1, float(sol[0]))
        cal.zoom = s_est / max(1e-6, cal.fit)
        cal.pan_x = float(sol[1])
        cal.pan_y = float(sol[2])
        return cal

    def build_deployable_pixel_mask(
        self,
        no_deploy_mask: np.ndarray | Sequence[Sequence[bool]] | None = None,
        allow_interior: bool = False,
    ) -> np.ndarray:
        """Rasterize a binary uint8 mask (H, W) of valid deployment pixels on the video frame.

        Args:
            no_deploy_mask: 50x50 boolean array where True indicates red-zone (blocked for troops).
            allow_interior: If True (e.g. for Spells), all 50x50 village tiles are valid.
        """
        h, w = self.calibration.viewport_h, self.calibration.viewport_w
        mask = np.zeros((h, w), dtype=np.uint8)

        # Outer 50x50 board diamond
        board_poly = np.round(
            np.asarray(
                [
                    self.grid_to_screen(0.0, 0.0),
                    self.grid_to_screen(float(GRID_SIZE), 0.0),
                    self.grid_to_screen(float(GRID_SIZE), float(GRID_SIZE)),
                    self.grid_to_screen(0.0, float(GRID_SIZE)),
                ],
                dtype=np.float32,
            )
        ).astype(np.int32)
        cv2.fillConvexPoly(mask, board_poly, 255)

        if allow_interior or no_deploy_mask is None:
            return mask

        nd_arr = np.asarray(no_deploy_mask, dtype=bool).reshape((GRID_SIZE, GRID_SIZE))
        blocked_ys, blocked_xs = np.nonzero(nd_arr)
        for ty, tx in zip(blocked_ys.tolist(), blocked_xs.tolist()):
            poly = self.tile_polygon_screen(int(tx), int(ty))
            cv2.fillConvexPoly(mask, poly, 0)

        return mask
