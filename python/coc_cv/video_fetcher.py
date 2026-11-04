"""Video stream ingestion, timestamp trimming (yt-dlp / ffmpeg), and frame reader.

Supports both remote VOD URLs (YouTube / Twitch via yt-dlp) and local .mp4 files,
caching raw downloads in `datasets/raw_videos/`. Also includes a deterministic
1080p pro-attack video synthesizer for offline verification and testing.
"""

from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .dock_tracker import DockTracker
from .font_matcher import FontMatcher
from .hud_detector import HudRoiConfig
from .isometric_mapper import GRID_SIZE, IsometricMapper

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_RAW_VIDEO_DIR = REPO_ROOT / "datasets" / "raw_videos"


def parse_timestamp(ts: str | float | None) -> float | None:
    """Parse 'HH:MM:SS', 'MM:SS', or numeric seconds string into float seconds."""
    if ts is None:
        return None
    if isinstance(ts, (int, float)):
        return max(0.0, float(ts))
    s = str(ts).strip()
    if not s:
        return None
    if re.fullmatch(r"\d+(\.\d+)?", s):
        return max(0.0, float(s))
    parts = s.split(":")
    if len(parts) == 2:
        return max(0.0, int(parts[0]) * 60.0 + float(parts[1]))
    if len(parts) == 3:
        return max(0.0, int(parts[0]) * 3600.0 + int(parts[1]) * 60.0 + float(parts[2]))
    raise ValueError(f"Invalid timestamp format: {ts!r}")


def format_timestamp_hms(seconds: float) -> str:
    """Format seconds as HH:MM:SS.xx for yt-dlp / ffmpeg."""
    s = max(0.0, float(seconds))
    hrs = int(s // 3600)
    mins = int((s % 3600) // 60)
    secs = s % 60.0
    return f"{hrs:02d}:{mins:02d}:{secs:05.2f}"


def find_yt_dlp_binary() -> str:
    """Locate the yt-dlp executable on the system."""
    which_bin = shutil.which("yt-dlp")
    if which_bin:
        return which_bin
    fallback = Path("/home/robin/miniconda3/bin/yt-dlp")
    if fallback.exists():
        return str(fallback)
    raise FileNotFoundError(
        "yt-dlp executable not found in PATH or /home/robin/miniconda3/bin/yt-dlp"
    )


@dataclass(frozen=True)
class VideoMetadata:
    """Metadata of an ingested local or downloaded video stream."""

    video_path: Path
    width: int
    height: int
    fps: float
    frame_count: int
    duration_sec: float
    source_url: str | None = None
    clip_start_sec: float = 0.0
    clip_end_sec: float | None = None


class VideoFetcher:
    """Downloads, trims, caches, and streams frames from YouTube URLs or local MP4s."""

    def __init__(self, cache_dir: Path | str | None = None) -> None:
        self.cache_dir = Path(cache_dir) if cache_dir is not None else DEFAULT_RAW_VIDEO_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def build_yt_dlp_command(
        self,
        url: str,
        output_path: Path,
        start_sec: float | None = None,
        end_sec: float | None = None,
    ) -> list[str]:
        """Construct the yt-dlp CLI invocation preferring 1080p60 MP4."""
        yt_dlp_bin = find_yt_dlp_binary()
        fmt = (
            "bestvideo[height<=1080][fps>=50][ext=mp4]+bestaudio[ext=m4a]/"
            "bestvideo[height<=1080][fps>=50]+bestaudio/"
            "bestvideo[height<=1080][ext=mp4]+bestaudio/"
            "best[height<=1080][ext=mp4]/best"
        )
        cmd = [
            yt_dlp_bin,
            "--no-playlist",
            "-f",
            fmt,
            "--merge-output-format",
            "mp4",
            "-o",
            str(output_path),
        ]
        if start_sec is not None or end_sec is not None:
            s_str = format_timestamp_hms(start_sec or 0.0)
            e_str = format_timestamp_hms(end_sec) if end_sec is not None else "inf"
            cmd.extend(["--download-sections", f"*{s_str}-{e_str}"])
        cmd.append(url)
        return cmd

    def fetch(
        self,
        url: str | None = None,
        file_path: Path | str | None = None,
        start: str | float | None = None,
        end: str | float | None = None,
        match_id: str | None = None,
        force_download: bool = False,
    ) -> VideoMetadata:
        """Resolve a local video file or download from URL into `datasets/raw_videos/`."""
        start_sec = parse_timestamp(start) or 0.0
        end_sec = parse_timestamp(end)

        if file_path is not None:
            local_p = Path(file_path)
            if not local_p.exists():
                raise FileNotFoundError(f"Video file not found at {local_p}")
            return self.inspect_video(
                local_p,
                source_url=url,
                clip_start_sec=start_sec,
                clip_end_sec=end_sec,
            )

        if not url:
            raise ValueError("Either `url` or `file_path` must be provided to VideoFetcher.fetch")

        slug = match_id or hashlib.sha1(
            f"{url}|{start_sec}|{end_sec}".encode()
        ).hexdigest()[:12]
        safe_slug = re.sub(r"[^a-zA-Z0-9_\-]+", "_", slug)
        out_path = self.cache_dir / f"{safe_slug}.mp4"

        if not out_path.exists() or force_download:
            cmd = self.build_yt_dlp_command(
                url=url,
                output_path=out_path,
                start_sec=start_sec if start is not None else None,
                end_sec=end_sec,
            )
            subprocess.run(cmd, check=True)
            # When yt-dlp trims with --download-sections, the downloaded clip starts at 0.0s
            start_sec = 0.0
            end_sec = None

        return self.inspect_video(
            out_path,
            source_url=url,
            clip_start_sec=start_sec,
            clip_end_sec=end_sec,
        )

    @staticmethod
    def inspect_video(
        video_path: Path | str,
        source_url: str | None = None,
        clip_start_sec: float = 0.0,
        clip_end_sec: float | None = None,
    ) -> VideoMetadata:
        """Read resolution, FPS, and frame count from a video file."""
        p = Path(video_path)
        cap = cv2.VideoCapture(str(p))
        if not cap.isOpened():
            raise RuntimeError(f"Failed to open video stream: {p}")
        try:
            w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
            if fps <= 0.0:
                fps = 30.0
            n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            dur = float(n_frames) / fps if n_frames > 0 else 0.0
        finally:
            cap.release()

        return VideoMetadata(
            video_path=p,
            width=w,
            height=h,
            fps=fps,
            frame_count=n_frames,
            duration_sec=dur,
            source_url=source_url,
            clip_start_sec=clip_start_sec,
            clip_end_sec=clip_end_sec,
        )

    @staticmethod
    def iter_frames(
        video_path: Path | str,
        start_sec: float = 0.0,
        end_sec: float | None = None,
        stride: int = 1,
    ) -> Iterator[tuple[int, float, np.ndarray]]:
        """Yield `(frame_idx, timestamp_sec, frame_bgr)` from `video_path`."""
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Failed to open video stream: {video_path}")
        try:
            fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
            if fps <= 0.0:
                fps = 30.0
            start_frame = max(0, round(start_sec * fps))
            end_frame = round(end_sec * fps) if end_sec is not None else None
            if start_frame > 0:
                cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

            f_idx = start_frame
            step = max(1, int(stride))
            while True:
                if end_frame is not None and f_idx > end_frame:
                    break
                ok, frame = cap.read()
                if not ok or frame is None:
                    break
                if (f_idx - start_frame) % step == 0:
                    yield f_idx, float(f_idx) / fps, frame
                f_idx += 1
        finally:
            cap.release()


@dataclass(frozen=True)
class SyntheticDropSpec:
    """Specification for a scripted drop event inside a synthetic test video."""

    frame_idx: int
    slot_idx: int
    tile_x: int
    tile_y: int
    count_delta: int = 1
    is_ability: bool = False


def generate_synthetic_pro_attack_video(
    output_path: Path | str,
    width: int = 1280,
    height: int = 720,
    fps: float = 30.0,
    total_frames: int = 60,
    roster: Sequence[tuple[str, str, int]] | None = None,
    drops: Sequence[SyntheticDropSpec] | None = None,
) -> tuple[VideoMetadata, list[SyntheticDropSpec]]:
    """Render a deterministic Clash of Clans pro-attack MP4 using real SCmagic.ttf & sprites.

    Used for automated integration tests and sample CLI verification (`samples/pro_attack.mp4`).
    """
    out_p = Path(output_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)

    if roster is None:
        roster = [
            ("Troop", "IceGolem", 2),
            ("Troop", "Thrower", 10),
            ("Troop", "Healer", 5),
            ("Troop", "SuperWallBreaker", 3),
            ("Siege", "LogLauncher", 1),
            ("Hero", "BarbarianKing", 1),
            ("Hero", "ArcherQueen", 1),
            ("Hero", "GrandWarden", 1),
            ("Hero", "RoyalChampion", 1),
            ("Spell", "Rage", 3),
            ("Spell", "Totem", 4),
        ]

    if drops is None:
        drops = [
            SyntheticDropSpec(frame_idx=6, slot_idx=0, tile_x=1, tile_y=24, count_delta=1),
            SyntheticDropSpec(frame_idx=12, slot_idx=1, tile_x=12, tile_y=48, count_delta=2),
            SyntheticDropSpec(frame_idx=18, slot_idx=2, tile_x=13, tile_y=48, count_delta=2),
            SyntheticDropSpec(frame_idx=24, slot_idx=4, tile_x=1, tile_y=25, count_delta=1),
            SyntheticDropSpec(frame_idx=30, slot_idx=5, tile_x=1, tile_y=26, count_delta=1),
            SyntheticDropSpec(frame_idx=36, slot_idx=9, tile_x=18, tile_y=25, count_delta=1),
            SyntheticDropSpec(
                frame_idx=42, slot_idx=5, tile_x=0, tile_y=0, count_delta=0, is_ability=True
            ),
            SyntheticDropSpec(frame_idx=48, slot_idx=1, tile_x=14, tile_y=48, count_delta=3),
        ]

    fm = FontMatcher()
    mapper = IsometricMapper(viewport_w=width, viewport_h=height)
    hud_cfg = HudRoiConfig()
    dock_tracker = DockTracker(font_matcher=fm, num_slots=len(roster))
    slot_bboxes = dock_tracker.get_slot_bboxes(width, height)

    # Pre-render static village background
    base_bg = np.full((height, width, 3), (28, 52, 30), dtype=np.uint8)
    board_poly = np.round(
        np.asarray(
            [
                mapper.grid_to_screen(0.0, 0.0),
                mapper.grid_to_screen(float(GRID_SIZE), 0.0),
                mapper.grid_to_screen(float(GRID_SIZE), float(GRID_SIZE)),
                mapper.grid_to_screen(0.0, float(GRID_SIZE)),
            ],
            dtype=np.float32,
        )
    ).astype(np.int32)
    cv2.fillConvexPoly(base_bg, board_poly, (46, 98, 52))

    # Draw subtle interior building zone
    inner_poly = np.round(
        np.asarray(
            [
                mapper.grid_to_screen(5.0, 5.0),
                mapper.grid_to_screen(45.0, 5.0),
                mapper.grid_to_screen(45.0, 45.0),
                mapper.grid_to_screen(5.0, 45.0),
            ],
            dtype=np.float32,
        )
    ).astype(np.int32)
    cv2.polylines(base_bg, [inner_poly], isClosed=True, color=(55, 65, 145), thickness=2)

    counts = [int(c) for _, _, c in roster]
    ability_active_frames: dict[int, set[int]] = {}
    drops_by_frame: dict[int, list[SyntheticDropSpec]] = {}
    for d in drops:
        drops_by_frame.setdefault(d.frame_idx, []).append(d)
        if d.is_ability:
            ability_active_frames.setdefault(d.slot_idx, set()).update(
                {d.frame_idx, d.frame_idx + 1}
            )

    fourcc = cv2.VideoWriter.fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_p), fourcc, fps, (width, height))
    if not writer.isOpened():
        raise RuntimeError(f"Failed to open VideoWriter for {out_p}")

    try:
        for f_idx in range(total_frames):
            frame = base_bg.copy()
            active_drops = drops_by_frame.get(f_idx, [])
            selected_slot = active_drops[0].slot_idx if active_drops else -1

            for d in active_drops:
                if not d.is_ability:
                    counts[d.slot_idx] = max(0, counts[d.slot_idx] - d.count_delta)
                    # Draw vivid spawn smoke puff at exact tile center
                    px, py = mapper.tile_center_to_screen(d.tile_x, d.tile_y)
                    cx, cy = round(px), round(py)
                    cv2.circle(frame, (cx, cy), 14, (245, 245, 255), -1)
                    cv2.circle(frame, (cx, cy), 8, (180, 235, 255), -1)

            # Battle starts at frame 2
            in_battle = f_idx >= 2
            elapsed_sec = max(0, (f_idx - 2) // max(1, round(fps / 10.0)))
            rem_sec = max(0, 180 - elapsed_sec)
            mins = rem_sec // 60
            secs = rem_sec % 60
            timer_str = f"{mins:02d}:{secs:02d}"

            # Destruction progresses smoothly to 100% (3 stars) at the end
            if f_idx >= total_frames - 3:
                destr_pct = 100
                stars = 3
            else:
                destr_pct = min(99, round((f_idx / max(1, total_frames - 4)) * 95))
                stars = 2 if destr_pct >= 70 else (1 if destr_pct >= 50 else 0)

            if in_battle:
                # Render timer into top-right HUD ROI preserving 1:1 glyph aspect ratio
                _, (tx, ty, tw, th) = dock_tracker_crop_box(frame, hud_cfg.timer_top_right)
                frame[ty : ty + th, tx : tx + tw] = fm.render_text_box(
                    timer_str, box_w=tw, box_h=th, font_size=26, stroke_width=2
                )

                # Render destruction % into top-left HUD ROI preserving 1:1 glyph aspect ratio
                _, (dx, dy, dw, dh) = dock_tracker_crop_box(
                    frame, hud_cfg.destruction_top_left
                )
                frame[dy : dy + dh, dx : dx + dw] = fm.render_text_box(
                    str(destr_pct), box_w=dw, box_h=dh, font_size=26, stroke_width=2
                )

                # Render stars strip
                _, (sx, sy, sw, sh) = dock_tracker_crop_box(frame, hud_cfg.stars_top_left)
                frame[sy : sy + sh, sx : sx + sw] = (24, 28, 34)
                slot_w = sw // 3
                for s_i in range(3):
                    scx = sx + s_i * slot_w + slot_w // 2
                    scy = sy + sh // 2
                    rad = max(5, min(slot_w, sh) // 3)
                    col = (30, 215, 255) if s_i < stars else (70, 75, 80)
                    cv2.circle(frame, (scx, scy), rad, col, -1)

            # Render deployment dock cards
            for idx, (bx, by, bw, bh) in enumerate(slot_bboxes):
                _s_type, u_name, _ = roster[idx]
                card = np.full((bh, bw, 3), (42, 38, 34), dtype=np.uint8)

                # Paste sprite icon if available
                tmpl = dock_tracker.templates.get(u_name)
                if tmpl is not None:
                    iy0 = round(bh * 0.34)
                    iy1 = max(iy0 + 8, round(bh * 0.90))
                    ix0 = round(bw * 0.12)
                    ix1 = max(ix0 + 8, round(bw * 0.88))
                    icon_rs = cv2.resize(
                        tmpl.icon_bgr, (ix1 - ix0, iy1 - iy0), interpolation=cv2.INTER_AREA
                    )
                    card[iy0:iy1, ix0:ix1] = icon_rs

                # Render count badge in top band at natural 1:1 aspect ratio
                by0 = round(bh * 0.04)
                by1 = max(by0 + 10, round(bh * 0.35))
                bx0 = round(bw * 0.08)
                bx1 = max(bx0 + 10, round(bw * 0.92))
                card[by0:by1, bx0:bx1] = fm.render_text_box(
                    str(counts[idx]),
                    box_w=bx1 - bx0,
                    box_h=by1 - by0,
                    font_size=22,
                    color_bgr=(255, 255, 255),
                    bg_bgr=(24, 26, 30),
                    stroke_width=1,
                )

                # Border highlight
                if f_idx in ability_active_frames.get(idx, set()):
                    # Magenta/purple ability surge border (HSV H ~ 150)
                    cv2.rectangle(card, (0, 0), (bw - 1, bh - 1), (235, 40, 235), 5)
                elif idx == selected_slot:
                    # Lime/gold selection border (HSV H ~ 45)
                    cv2.rectangle(card, (0, 0), (bw - 1, bh - 1), (40, 240, 180), 5)
                else:
                    cv2.rectangle(card, (0, 0), (bw - 1, bh - 1), (85, 85, 90), 1)

                frame[by : by + bh, bx : bx + bw] = card

            writer.write(frame)
    finally:
        writer.release()

    meta = VideoFetcher.inspect_video(out_p)
    return meta, list(drops)


def dock_tracker_crop_box(
    frame: np.ndarray, norm_box: tuple[float, float, float, float]
) -> tuple[np.ndarray, tuple[int, int, int, int]]:
    h, w = frame.shape[:2]
    x0 = max(0, min(w - 1, round(norm_box[0] * w)))
    y0 = max(0, min(h - 1, round(norm_box[1] * h)))
    x1 = max(x0 + 1, min(w, round(norm_box[2] * w)))
    y1 = max(y0 + 1, min(h, round(norm_box[3] * h)))
    return frame[y0:y1, x0:x1], (x0, y0, x1 - x0, y1 - y0)
