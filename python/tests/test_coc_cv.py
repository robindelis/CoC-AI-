"""Unit and integration test suite for the `coc_cv` Replay Extraction Pipeline."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT / "python") not in sys.path:
    sys.path.insert(0, str(REPO_ROOT / "python"))

from coc_cv.cli import main
from coc_cv.dock_tracker import DockTracker, DropCandidate
from coc_cv.drop_locator import DropLocator
from coc_cv.font_matcher import FontMatcher
from coc_cv.isometric_mapper import GRID_SIZE, IsometricMapper
from coc_cv.replay_builder import ReplayActionEntry, ReplayBuilder
from coc_cv.video_fetcher import (
    VideoFetcher,
    generate_synthetic_pro_attack_video,
    parse_timestamp,
)


def test_font_matcher() -> None:
    """Verify 100% deterministic digit recognition using SCmagic.ttf on clean and noisy crops."""
    fm = FontMatcher()
    rng = np.random.default_rng(42)

    test_values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 25, 39, 67, 88, 100]
    colors = [
        (255, 255, 255),  # White HUD text
        (64, 224, 255),   # Yellow/Gold HUD text (BGR)
        (75, 75, 255),    # Red warning HUD text (BGR)
    ]

    for font_size in (20, 28, 36):
        for color_bgr in colors:
            for val in test_values:
                clean = fm.render_text(
                    str(val),
                    font_size=font_size,
                    color_bgr=color_bgr,
                    bg_bgr=(22, 25, 30),
                    stroke_width=2,
                    padding=8,
                )
                # Add synthetic Gaussian sensor/compression noise
                noise = rng.normal(0.0, 9.0, size=clean.shape).astype(np.float32)
                noisy = np.clip(clean.astype(np.float32) + noise, 0, 255).astype(
                    np.uint8
                )
                pred, conf = fm.match_digits_with_confidence(noisy)
                assert pred == val, (
                    f"Failed digit match for val={val} at size={font_size}: got {pred} (conf={conf:.3f})"
                )
                assert conf >= 0.55

    # Verify MM:SS countdown timer parsing
    for timer_str, expected_sec in [
        ("03:00", 180),
        ("02:45", 165),
        ("01:23", 83),
        ("00:09", 9),
    ]:
        t_crop = fm.render_text(timer_str, font_size=28, stroke_width=2)
        sec, conf = fm.match_timer_seconds(t_crop)
        assert sec == expected_sec
        assert conf >= 0.60


def test_isometric_mapper() -> None:
    """Verify sub-tile roundtrip precision across all 50x50 tiles and anchor calibration."""
    for iso_mode in (True, False):
        mapper = IsometricMapper(
            viewport_w=1920,
            viewport_h=1080,
            zoom=1.12,
            pan_x=18.5,
            pan_y=-12.0,
            isometric=iso_mode,
        )
        for ty in range(GRID_SIZE):
            for tx in range(GRID_SIZE):
                gx_in = float(tx) + 0.37
                gy_in = float(ty) + 0.61
                px, py = mapper.grid_to_screen(gx_in, gy_in)
                gx_out, gy_out = mapper.screen_to_grid(px, py)
                assert abs(gx_out - gx_in) < 1e-4
                assert abs(gy_out - gy_in) < 1e-4

                tile_x, tile_y = mapper.screen_to_tile(px, py)
                assert tile_x == tx
                assert tile_y == ty

    # Test least-squares camera calibration from known village anchors
    true_mapper = IsometricMapper(
        viewport_w=1920, viewport_h=1080, zoom=1.25, pan_x=42.0, pan_y=-27.5
    )
    anchor_tiles = [(25.0, 25.0), (3.0, 3.0), (47.0, 3.0), (3.0, 47.0), (47.0, 47.0)]
    anchors = [(pt, true_mapper.grid_to_screen(*pt)) for pt in anchor_tiles]

    est_mapper = IsometricMapper(
        viewport_w=1920, viewport_h=1080, zoom=1.0, pan_x=0.0, pan_y=0.0
    )
    cal = est_mapper.calibrate_from_anchors(anchors)
    assert abs(cal.zoom - 1.25) < 1e-4
    assert abs(cal.pan_x - 42.0) < 1e-3
    assert abs(cal.pan_y - (-27.5)) < 1e-3


def test_replay_schema(tmp_path: Path) -> None:
    """Validate generated replay JSON against coc-data catalog and coc-engine dry-run."""
    builder = ReplayBuilder(output_dir=tmp_path, ticks_per_sec=30)

    sample_actions = [
        ReplayActionEntry(
            tick=15,
            slot_type="Troop",
            slot_idx=0,
            unit_name="IceGolem",
            tile_x=2,
            tile_y=24,
            fraction=0.5,
        ),
        ReplayActionEntry(
            tick=84,
            slot_type="Troop",
            slot_idx=1,
            unit_name="Thrower",
            tile_x=12,
            tile_y=48,
            fraction=0.2,
        ),
        ReplayActionEntry(
            tick=120,
            slot_type="Siege",
            slot_idx=4,
            unit_name="LogLauncher",
            tile_x=2,
            tile_y=25,
            fraction=1.0,
        ),
        ReplayActionEntry(
            tick=150,
            slot_type="Hero",
            slot_idx=5,
            unit_name="BarbarianKing",
            tile_x=3,
            tile_y=25,
            fraction=1.0,
        ),
        ReplayActionEntry(
            tick=210,
            slot_type="Spell",
            slot_idx=9,
            unit_name="Rage",
            tile_x=18,
            tile_y=25,
            fraction=0.3333,
        ),
        ReplayActionEntry(
            tick=270,
            slot_type="HeroAbility",
            slot_idx=5,
            unit_name="BarbarianKing",
            tile_x=0,
            tile_y=0,
            fraction=1.0,
        ),
    ]

    payload = builder.build_replay_payload(
        match_id="test_schema_match",
        actions=sample_actions,
        run_engine_dry_run=True,
    )
    saved_file = builder.save_replay("test_schema_match", payload)
    assert saved_file.exists()

    loaded = json.loads(saved_file.read_text(encoding="utf-8"))
    assert loaded["match_id"] == "test_schema_match"
    assert loaded["validation"]["valid"] is True
    assert loaded["validation"]["layout_valid"] is True
    assert loaded["validation"]["roster_valid"] is True
    assert loaded["validation"]["actions_valid"] is True
    assert loaded["validation"]["sim_dry_run_executed"] is True
    assert loaded["validation"]["sim_destruction_pct"] > 0

    # Verify schema error detection on invalid unit or out-of-bounds tile
    bad_payload = dict(loaded)
    bad_payload["actions"] = [
        {
            "tick": 10,
            "slot_type": "Troop",
            "slot_idx": 0,
            "unit_name": "NonExistentCyberDragon",
            "tile_x": 99,
            "tile_y": 48,
            "fraction": 0.5,
        }
    ]
    bad_report = builder.validate_replay_payload(bad_payload, run_engine_dry_run=False)
    assert bad_report.valid is False
    assert bad_report.roster_valid is False
    assert bad_report.actions_valid is False
    assert len(bad_report.errors) >= 2


def test_dock_tracker_and_drop_locator() -> None:
    """Verify sprite template loading, icon classification, and spatial puff localization."""
    tracker = DockTracker()
    assert "Thrower" in tracker.templates
    assert "BarbarianKing" in tracker.templates
    assert "Rage" in tracker.templates
    assert "LogLauncher" in tracker.templates
    assert tracker.templates["LogLauncher"].slot_type == "Siege"

    mapper = IsometricMapper(viewport_w=1280, viewport_h=720)
    locator = DropLocator(mapper=mapper)

    prev_frame = np.full((720, 1280, 3), 40, dtype=np.uint8)
    curr_frame = prev_frame.copy()

    target_tx, target_ty = 12, 48
    px, py = mapper.tile_center_to_screen(target_tx, target_ty)
    import cv2

    cv2.circle(curr_frame, (round(px), round(py)), 12, (250, 250, 255), -1)

    cand = DropCandidate(
        frame_idx=145,
        video_sec=4.83,
        slot_idx=1,
        unit_type="Thrower",
        count_before=10,
        count_after=8,
        slot_type="Troop",
    )
    loc = locator.localize_drop(prev_frame, curr_frame, cand)
    assert loc.tile_x == target_tx
    assert loc.tile_y == target_ty
    assert loc.confidence >= 0.5


def test_end_to_end_pipeline_and_cli(tmp_path: Path) -> None:
    """Verify full end-to-end video synthesis, CLI parsing, and replay extraction."""
    video_path = tmp_path / "pro_attack_synth.mp4"
    replays_dir = tmp_path / "replays"

    meta, scripted_drops = generate_synthetic_pro_attack_video(
        video_path, width=1280, height=720, fps=30.0, total_frames=56
    )
    assert meta.width == 1280
    assert meta.height == 720
    assert meta.frame_count == 56

    rc = main(
        [
            "parse",
            "--file",
            str(video_path),
            "--match-id",
            "klaus_th18_finals",
            "--output-dir",
            str(replays_dir),
        ]
    )
    assert rc == 0

    out_json = replays_dir / "klaus_th18_finals.json"
    assert out_json.exists()
    data = json.loads(out_json.read_text(encoding="utf-8"))
    assert data["validation"]["valid"] is True
    assert len(data["actions"]) == len(scripted_drops)

    # Check that extracted unit names and coordinates match the scripted pro attack
    extracted_units = [a["unit_name"] for a in data["actions"]]
    assert "IceGolem" in extracted_units
    assert "Thrower" in extracted_units
    assert "LogLauncher" in extracted_units
    assert "BarbarianKing" in extracted_units
    assert "Rage" in extracted_units

    thrower_drops = [a for a in data["actions"] if a["unit_name"] == "Thrower"]
    assert any(a["tile_x"] == 12 and a["tile_y"] == 48 for a in thrower_drops)
    for act, spec in zip(data["actions"], scripted_drops, strict=True):
        assert act["tile_x"] == spec.tile_x
        assert act["tile_y"] == spec.tile_y


def test_timestamp_parser_and_yt_dlp_builder(tmp_path: Path) -> None:
    """Verify timestamp parsing and yt-dlp command construction."""
    assert parse_timestamp("01:23") == pytest.approx(83.0)
    assert parse_timestamp("00:04:15") == pytest.approx(255.0)
    assert parse_timestamp(42.5) == pytest.approx(42.5)
    assert parse_timestamp(None) is None

    fetcher = VideoFetcher(cache_dir=tmp_path)
    cmd = fetcher.build_yt_dlp_command(
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        output_path=tmp_path / "test.mp4",
        start_sec=83.0,
        end_sec=255.0,
    )
    assert any("yt-dlp" in part for part in cmd)
    assert "--download-sections" in cmd
    assert "*00:01:23.00-00:04:15.00" in cmd
