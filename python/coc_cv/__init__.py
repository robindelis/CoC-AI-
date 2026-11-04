"""Computer Vision (CV) Replay Extraction Engine for Clash of Clans TH18."""

from .cli import ReplayExtractionPipeline, main
from .dock_tracker import DockSlotState, DockTracker, DropCandidate, SpriteTemplate
from .drop_locator import DropLocator, LocalizedDrop
from .font_matcher import DigitMatchResult, FontMatcher, GlyphDetection
from .hud_detector import BattleSegment, HudDetector, HudFrameState, HudRoiConfig
from .isometric_mapper import CameraCalibration, IsometricMapper
from .replay_builder import ReplayActionEntry, ReplayBuilder, ReplayValidationReport
from .video_fetcher import (
    SyntheticDropSpec,
    VideoFetcher,
    VideoMetadata,
    generate_synthetic_pro_attack_video,
    parse_timestamp,
)

__all__ = [
    "BattleSegment",
    "CameraCalibration",
    "DigitMatchResult",
    "DockSlotState",
    "DockTracker",
    "DropCandidate",
    "DropLocator",
    "FontMatcher",
    "GlyphDetection",
    "HudDetector",
    "HudFrameState",
    "HudRoiConfig",
    "IsometricMapper",
    "LocalizedDrop",
    "ReplayActionEntry",
    "ReplayBuilder",
    "ReplayExtractionPipeline",
    "ReplayValidationReport",
    "SpriteTemplate",
    "SyntheticDropSpec",
    "VideoFetcher",
    "VideoMetadata",
    "generate_synthetic_pro_attack_video",
    "main",
    "parse_timestamp",
]
