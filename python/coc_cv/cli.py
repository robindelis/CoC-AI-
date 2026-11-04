"""Unified CLI and end-to-end orchestration pipeline for Clash of Clans CV replay extraction.

Usage:
    # Parse a YouTube pro attack:
    python -m coc_cv parse --url "https://www.youtube.com/watch?v=..." --start 01:23 --end 04:15 --match-id "klaus_th18_finals"

    # Parse a local video file:
    python -m coc_cv parse --file "samples/pro_attack.mp4" --match-id "pro_attack_01"
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import coc_py
import numpy as np

from .dock_tracker import DockTracker, DropCandidate
from .drop_locator import DropLocator, LocalizedDrop
from .font_matcher import FontMatcher
from .hud_detector import BattleSegment, HudDetector, HudFrameState
from .isometric_mapper import IsometricMapper
from .replay_builder import ReplayBuilder
from .video_fetcher import (
    VideoFetcher,
    VideoMetadata,
    generate_synthetic_pro_attack_video,
    parse_timestamp,
)


class ReplayExtractionPipeline:
    """End-to-end Computer Vision pipeline turning pro gameplay videos into coc-engine replays."""

    def __init__(
        self,
        output_dir: Path | str | None = None,
        raw_video_dir: Path | str | None = None,
        ticks_per_sec: int = 30,
        num_dock_slots: int = 11,
    ) -> None:
        self.font_matcher = FontMatcher()
        self.video_fetcher = VideoFetcher(cache_dir=raw_video_dir)
        self.hud_detector = HudDetector(font_matcher=self.font_matcher)
        self.dock_tracker = DockTracker(
            font_matcher=self.font_matcher, num_slots=num_dock_slots
        )
        self.mapper = IsometricMapper()
        self.drop_locator = DropLocator(mapper=self.mapper)
        self.replay_builder = ReplayBuilder(
            output_dir=output_dir, ticks_per_sec=ticks_per_sec
        )

    def configure_layout_red_zone(
        self, layout_dict: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Load the 50x50 `no_deploy_mask` from `coc-engine` for the target layout."""
        resolved_layout = (
            layout_dict
            if layout_dict is not None
            else self.replay_builder.default_layout()
        )
        env = coc_py.PyBattleEnv(json.dumps(resolved_layout), None, 1)
        flat_mask = env.get_no_deploy_mask_flat()
        mask_2d = np.asarray(flat_mask, dtype=bool).reshape((50, 50))
        self.drop_locator.set_no_deploy_mask(mask_2d)
        return resolved_layout

    def run(
        self,
        match_id: str,
        url: str | None = None,
        file_path: Path | str | None = None,
        start: str | float | None = None,
        end: str | float | None = None,
        stride: int = 1,
        known_roster: Sequence[tuple[str, str, int]] | None = None,
        layout_dict: dict[str, Any] | None = None,
        army_dict: dict[str, Any] | None = None,
        save_to_disk: bool = True,
    ) -> tuple[dict[str, Any], Path | None]:
        """Execute full video ingestion, HUD segmentation, dock tracking, spatial drop localization, and validation."""
        video_meta: VideoMetadata = self.video_fetcher.fetch(
            url=url,
            file_path=file_path,
            start=start,
            end=end,
            match_id=match_id,
        )

        self.mapper.calibration.viewport_w = video_meta.width
        self.mapper.calibration.viewport_h = video_meta.height
        resolved_layout = self.configure_layout_red_zone(layout_dict)
        resolved_army = (
            army_dict if army_dict is not None else self.replay_builder.default_army()
        )

        if known_roster is not None:
            self.dock_tracker.set_known_roster(known_roster)
        else:
            self.dock_tracker.reset()

        hud_states: list[HudFrameState] = []
        localized_drops: list[LocalizedDrop] = []
        prev_frame: np.ndarray | None = None

        for f_idx, f_sec, frame_bgr in self.video_fetcher.iter_frames(
            video_meta.video_path,
            start_sec=video_meta.clip_start_sec,
            end_sec=video_meta.clip_end_sec,
            stride=stride,
        ):
            hud_st = self.hud_detector.analyze_frame(
                frame_bgr, frame_idx=f_idx, video_sec=f_sec
            )
            hud_states.append(hud_st)

            candidates: list[DropCandidate]
            candidates, _ = self.dock_tracker.update(
                frame_bgr, frame_idx=f_idx, video_sec=f_sec
            )

            ref_prev = prev_frame if prev_frame is not None else frame_bgr
            for cand in candidates:
                loc = self.drop_locator.localize_drop(ref_prev, frame_bgr, cand)
                localized_drops.append(loc)

            prev_frame = frame_bgr

        segment: BattleSegment | None
        segment, _ = self.hud_detector.segment_battle(hud_states)
        battle_start_sec = segment.start_sec if segment is not None else 0.0

        # Filter drops to active battle window if segmented
        if segment is not None:
            filtered_drops = [
                d
                for d in localized_drops
                if segment.start_frame <= d.candidate.frame_idx <= segment.end_frame
            ]
        else:
            filtered_drops = localized_drops

        actions = self.replay_builder.build_actions(
            filtered_drops, battle_start_sec=battle_start_sec
        )

        source_meta = {
            "video_path": str(video_meta.video_path),
            "source_url": video_meta.source_url,
            "width": video_meta.width,
            "height": video_meta.height,
            "fps": round(video_meta.fps, 3),
            "frame_count": video_meta.frame_count,
            "duration_sec": round(video_meta.duration_sec, 3),
            "clip_start_sec": round(video_meta.clip_start_sec, 3),
            "clip_end_sec": (
                round(video_meta.clip_end_sec, 3)
                if video_meta.clip_end_sec is not None
                else None
            ),
        }

        payload = self.replay_builder.build_replay_payload(
            match_id=match_id,
            actions=actions,
            segment=segment,
            layout=resolved_layout,
            army=resolved_army,
            source_meta=source_meta,
            run_engine_dry_run=True,
        )

        saved_path: Path | None = None
        if save_to_disk:
            saved_path = self.replay_builder.save_replay(match_id, payload)

        return payload, saved_path


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="coc_cv",
        description="Clash of Clans TH18 Computer Vision Replay Extraction Pipeline",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    parse_cmd = subparsers.add_parser(
        "parse",
        help="Parse a YouTube URL or local MP4 video into a standardized replay JSON",
    )
    parse_cmd.add_argument(
        "--url",
        type=str,
        default=None,
        help="YouTube / Twitch VOD URL to download via yt-dlp",
    )
    parse_cmd.add_argument(
        "--file",
        type=str,
        default=None,
        help="Local video file path (.mp4)",
    )
    parse_cmd.add_argument(
        "--start",
        type=str,
        default=None,
        help="Optional clip start timestamp (e.g. 01:23 or 83.0)",
    )
    parse_cmd.add_argument(
        "--end",
        type=str,
        default=None,
        help="Optional clip end timestamp (e.g. 04:15 or 255.0)",
    )
    parse_cmd.add_argument(
        "--match-id",
        type=str,
        required=True,
        help="Unique match identifier for datasets/replays/<match_id>.json",
    )
    parse_cmd.add_argument(
        "--stride",
        type=int,
        default=1,
        help="Frame sampling stride (default: 1)",
    )
    parse_cmd.add_argument(
        "--output-dir",
        type=str,
        default=None,
        help="Override output directory (default: datasets/replays/)",
    )

    synth_cmd = subparsers.add_parser(
        "synthesize-sample",
        help="Generate a deterministic synthetic pro attack MP4 for testing",
    )
    synth_cmd.add_argument(
        "--output",
        type=str,
        default="samples/pro_attack.mp4",
        help="Output path for the synthesized sample MP4",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_arg_parser()
    args = parser.parse_args(argv)

    if args.command == "synthesize-sample":
        meta, drops = generate_synthetic_pro_attack_video(args.output)
        print(
            json.dumps(
                {
                    "status": "ok",
                    "video_path": str(meta.video_path),
                    "width": meta.width,
                    "height": meta.height,
                    "fps": meta.fps,
                    "frames": meta.frame_count,
                    "scripted_drops": len(drops),
                },
                indent=2,
            )
        )
        return 0

    if args.command == "parse":
        if not args.url and not args.file:
            parser.error("Either --url or --file must be specified for `coc_cv parse`")

        # Validate timestamps early
        _ = parse_timestamp(args.start)
        _ = parse_timestamp(args.end)

        pipeline = ReplayExtractionPipeline(output_dir=args.output_dir)
        payload, out_path = pipeline.run(
            match_id=args.match_id,
            url=args.url,
            file_path=args.file,
            start=args.start,
            end=args.end,
            stride=args.stride,
            save_to_disk=True,
        )
        summary = {
            "match_id": payload["match_id"],
            "output_file": str(out_path),
            "actions_extracted": len(payload["actions"]),
            "battle_segment": payload["battle_segment"],
            "validation": payload["validation"],
        }
        print(json.dumps(summary, indent=2))
        return 0 if payload["validation"]["valid"] else 1

    return 1


if __name__ == "__main__":
    sys.exit(main())
