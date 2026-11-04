"""Deterministic digit and HUD text recognition using the official Supercell Magic font.

Loads `web/public/assets/fonts/SCmagic.ttf` and pre-renders exact digit templates
0..9 across typical HUD font sizes (16px to 48px) to perform deterministic
multi-scale template matching on unit counts, countdown timers, and percentages.
"""

from __future__ import annotations

import itertools
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FONT_PATH = REPO_ROOT / "web" / "public" / "assets" / "fonts" / "SCmagic.ttf"
DEFAULT_FONT_SIZES: tuple[int, ...] = (16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48)
CANONICAL_H: int = 36


@dataclass(frozen=True)
class GlyphDetection:
    """Single recognized digit glyph in an ROI."""

    digit: int
    x: int
    y: int
    w: int
    h: int
    confidence: float


@dataclass(frozen=True)
class DigitMatchResult:
    """Full digit sequence recognition result."""

    value: int | None
    text: str
    confidence: float
    glyphs: tuple[GlyphDetection, ...]


class FontMatcher:
    """Multi-scale deterministic digit matcher backed by SCmagic.ttf."""

    def __init__(
        self,
        font_path: Path | str | None = None,
        font_sizes: Sequence[int] = DEFAULT_FONT_SIZES,
    ) -> None:
        self.font_path = Path(font_path) if font_path is not None else DEFAULT_FONT_PATH
        if not self.font_path.exists():
            raise FileNotFoundError(f"Supercell Magic font not found at {self.font_path}")

        self.font_sizes: tuple[int, ...] = tuple(sorted({int(s) for s in font_sizes}))
        self._fonts: dict[int, ImageFont.FreeTypeFont] = {
            sz: ImageFont.truetype(str(self.font_path), sz) for sz in self.font_sizes
        }
        # Templates indexed by font_size -> digit (0..9) -> tightly cropped grayscale uint8
        self.templates_by_size: dict[int, dict[int, np.ndarray]] = {}
        # Canonical height-normalized templates (digit -> list of (aspect_ratio, norm_img))
        self.canonical_templates: dict[int, list[tuple[float, np.ndarray]]] = {
            d: [] for d in range(10)
        }
        self._build_templates()

    def _render_raw_glyph(self, char: str, font_size: int, stroke_width: int = 0) -> np.ndarray:
        font = self._fonts.get(font_size) or ImageFont.truetype(str(self.font_path), font_size)
        canvas_sz = max(96, font_size * 3)
        img = Image.new("L", (canvas_sz, canvas_sz), 0)
        draw = ImageDraw.Draw(img)
        draw.text(
            (canvas_sz // 4, canvas_sz // 4),
            char,
            fill=255,
            font=font,
            stroke_width=stroke_width,
            stroke_fill=0,
        )
        arr = np.asarray(img, dtype=np.uint8)
        ys, xs = np.nonzero(arr > 32)
        if len(xs) == 0 or len(ys) == 0:
            return np.zeros((font_size, max(8, font_size // 2)), dtype=np.uint8)
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        y0, y1 = int(ys.min()), int(ys.max()) + 1
        cropped = arr[y0:y1, x0:x1]
        return cropped

    def _build_templates(self) -> None:
        for sz in self.font_sizes:
            self.templates_by_size[sz] = {}
            for d in range(10):
                glyph = self._render_raw_glyph(str(d), sz, stroke_width=0)
                self.templates_by_size[sz][d] = glyph
                gh, gw = glyph.shape[:2]
                aspect = float(gw) / max(1.0, float(gh))
                norm_w = max(6, round(CANONICAL_H * aspect))
                norm_glyph = cv2.resize(
                    glyph, (norm_w, CANONICAL_H), interpolation=cv2.INTER_AREA
                )
                self.canonical_templates[d].append((aspect, norm_glyph))

    def render_text(
        self,
        text: str,
        font_size: int = 28,
        color_bgr: tuple[int, int, int] = (255, 255, 255),
        bg_bgr: tuple[int, int, int] = (20, 24, 30),
        stroke_width: int = 2,
        padding: int = 8,
    ) -> np.ndarray:
        """Render clean synthetic text using SCmagic.ttf (for HUD simulation & testing)."""
        font = self._fonts.get(font_size) or ImageFont.truetype(str(self.font_path), font_size)
        dummy = Image.new("RGB", (16, 16), (0, 0, 0))
        d_draw = ImageDraw.Draw(dummy)
        bbox = d_draw.textbbox((0, 0), text, font=font, stroke_width=stroke_width)
        tw = max(1, int(bbox[2] - bbox[0]))
        th = max(1, int(bbox[3] - bbox[1]))
        w = tw + padding * 2
        h = th + padding * 2

        bg_rgb = (bg_bgr[2], bg_bgr[1], bg_bgr[0])
        fg_rgb = (color_bgr[2], color_bgr[1], color_bgr[0])
        img = Image.new("RGB", (w, h), bg_rgb)
        draw = ImageDraw.Draw(img)
        draw.text(
            (padding - bbox[0], padding - bbox[1]),
            text,
            font=font,
            fill=fg_rgb,
            stroke_width=stroke_width,
            stroke_fill=(0, 0, 0) if stroke_width > 0 else None,
        )
        rgb = np.asarray(img, dtype=np.uint8)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

    def render_text_box(
        self,
        text: str,
        box_w: int,
        box_h: int,
        font_size: int | None = None,
        color_bgr: tuple[int, int, int] = (255, 255, 255),
        bg_bgr: tuple[int, int, int] = (20, 24, 30),
        stroke_width: int = 2,
    ) -> np.ndarray:
        """Render text centered inside an exact `(box_w, box_h)` canvas at natural 1:1 aspect ratio."""
        bw = max(8, int(box_w))
        bh = max(8, int(box_h))
        target_sz = font_size if font_size is not None else max(14, round(bh * 0.58))
        rendered = self.render_text(
            text=text,
            font_size=target_sz,
            color_bgr=color_bgr,
            bg_bgr=bg_bgr,
            stroke_width=stroke_width,
            padding=2,
        )
        rh, rw = rendered.shape[:2]
        scale = min((bw - 4) / max(1.0, float(rw)), (bh - 4) / max(1.0, float(rh)), 1.0)
        if scale < 1.0:
            nw = max(4, round(rw * scale))
            nh = max(4, round(rh * scale))
            rendered = cv2.resize(rendered, (nw, nh), interpolation=cv2.INTER_AREA)
            rh, rw = rendered.shape[:2]

        canvas = np.full((bh, bw, 3), bg_bgr, dtype=np.uint8)
        y0 = max(0, (bh - rh) // 2)
        x0 = max(0, (bw - rw) // 2)
        canvas[y0 : y0 + rh, x0 : x0 + rw] = rendered[: bh - y0, : bw - x0]
        return canvas

    @staticmethod
    def _extract_foreground_mask(roi: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """Extract foreground text luminance and binary mask from BGR or grayscale ROI.

        Handles white (#FFFFFF), yellow/gold (#FFE040), and red (#FF4040) Clash of Clans digits.
        """
        if roi.ndim == 3 and roi.shape[2] >= 3:
            roi[:, :, 0].astype(np.float32)
            g = roi[:, :, 1].astype(np.float32)
            r = roi[:, :, 2].astype(np.float32)
            # White/Yellow/Red text all have strong Red channel or high max(R, G)
            lum = np.maximum(r, 0.5 * (r + g)).astype(np.uint8)
        else:
            lum = roi.astype(np.uint8) if roi.ndim == 2 else roi[:, :, 0].astype(np.uint8)

        if lum.size == 0:
            return lum, np.zeros_like(lum, dtype=np.uint8)

        # Light Gaussian denoise if ROI is large enough to suppress pixel salt-and-pepper noise
        if min(lum.shape[:2]) >= 14:
            denoised = cv2.GaussianBlur(lum, (3, 3), 0.6)
        else:
            denoised = lum

        min_v = float(np.percentile(denoised, 10))
        max_v = float(np.percentile(denoised, 98))
        contrast = max_v - min_v
        if max_v < 160.0 or contrast < 40.0:
            return denoised, np.zeros_like(denoised, dtype=np.uint8)

        norm = np.clip((denoised.astype(np.float32) - min_v) * (255.0 / max(1.0, contrast)), 0, 255).astype(
            np.uint8
        )
        _, binary = cv2.threshold(norm, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # Ensure bright foreground is above threshold
        high_thresh = max(135, int(np.percentile(norm, 70)))
        _, binary_strict = cv2.threshold(norm, high_thresh, 255, cv2.THRESH_BINARY)
        mask = cv2.bitwise_and(binary, binary_strict)
        if np.count_nonzero(mask) < 6:
            mask = binary
        return norm, mask

    def _classify_single_blob(
        self, blob_gray: np.ndarray, blob_mask: np.ndarray
    ) -> tuple[int, float]:
        """Classify a single segmented character blob into digit 0..9 with confidence."""
        bh, bw = blob_gray.shape[:2]
        if bh < 6 or bw < 2:
            return 0, 0.0

        aspect = float(bw) / float(bh)
        best_digit = 0
        best_score = -1.0

        # Blend normalized grayscale and binary mask for robustness to noise & shading
        signal = cv2.addWeighted(blob_gray, 0.65, blob_mask, 0.35, 0.0)

        for digit, entries in self.canonical_templates.items():
            for tmpl_aspect, tmpl_norm in entries:
                th, tw = tmpl_norm.shape[:2]
                resized = cv2.resize(signal, (tw, th), interpolation=cv2.INTER_LINEAR)

                # Normalized cross-correlation
                res = cv2.matchTemplate(resized, tmpl_norm, cv2.TM_CCOEFF_NORMED)
                ncc = float(res[0, 0])

                # Pixel-wise structural overlap (IoU on >110 mask)
                m_sig = resized > 110
                m_tmp = tmpl_norm > 110
                union = int(np.count_nonzero(m_sig | m_tmp))
                inter = int(np.count_nonzero(m_sig & m_tmp))
                iou = float(inter) / max(1, union)

                # Aspect ratio penalty (crucial for distinguishing '1' vs '0'/'7'/'8')
                aspect_diff = abs(aspect - tmpl_aspect) / max(0.25, tmpl_aspect)
                aspect_score = max(0.0, 1.0 - 0.55 * aspect_diff)

                score = 0.50 * max(0.0, ncc) + 0.35 * iou + 0.15 * aspect_score
                if score > best_score:
                    best_score = score
                    best_digit = digit

        return best_digit, float(np.clip(best_score, 0.0, 1.0))

    def _segment_character_boxes(self, mask: np.ndarray) -> list[tuple[int, int, int, int]]:
        """Segment connected character bounding boxes left-to-right from binary mask."""
        h, _w = mask.shape[:2]
        num_labels, _labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

        raw_boxes: list[tuple[int, int, int, int]] = []
        min_h = max(6, round(h * 0.24))
        min_area = max(8, round(h * 0.12))

        for idx in range(1, num_labels):
            bx = int(stats[idx, cv2.CC_STAT_LEFT])
            by = int(stats[idx, cv2.CC_STAT_TOP])
            bw = int(stats[idx, cv2.CC_STAT_WIDTH])
            bh = int(stats[idx, cv2.CC_STAT_HEIGHT])
            area = int(stats[idx, cv2.CC_STAT_AREA])
            if bh < min_h or area < min_area:
                continue
            if bw > h * 3.2:
                continue
            raw_boxes.append((bx, by, bw, bh))

        if not raw_boxes:
            return []

        raw_boxes.sort(key=lambda b: b[0])

        # Filter out colon dots or percent slash fragments when we only want full-height digits
        max_bh = max(b[3] for b in raw_boxes)
        filtered = [b for b in raw_boxes if b[3] >= max_bh * 0.68]

        # Split any horizontally merged multi-digit box using vertical projection minima
        final_boxes: list[tuple[int, int, int, int]] = []
        for bx, by, bw, bh in filtered:
            ratio = float(bw) / max(1.0, float(bh))
            if ratio > 1.15:
                n_splits = max(2, round(ratio / 0.72))
                sub_mask = mask[by : by + bh, bx : bx + bw]
                col_sum = sub_mask.sum(axis=0).astype(np.float32)
                step = bw / float(n_splits)
                cuts = [0]
                for s_i in range(1, n_splits):
                    center = round(s_i * step)
                    win = max(2, bw // (n_splits * 4))
                    lo = max(cuts[-1] + 2, center - win)
                    hi = min(bw - 2, center + win + 1)
                    if lo < hi:
                        cut = lo + int(np.argmin(col_sum[lo:hi]))
                    else:
                        cut = center
                    cuts.append(cut)
                cuts.append(bw)
                for c0, c1 in itertools.pairwise(cuts):
                    sw = c1 - c0
                    if sw >= 3:
                        final_boxes.append((bx + c0, by, sw, bh))
            else:
                final_boxes.append((bx, by, bw, bh))

        final_boxes.sort(key=lambda b: b[0])
        return final_boxes

    def recognize(
        self, roi: np.ndarray, min_confidence: float = 0.50
    ) -> DigitMatchResult:
        """Recognize an integer digit sequence inside `roi` and return full telemetry."""
        if roi is None or roi.size == 0:
            return DigitMatchResult(value=None, text="", confidence=0.0, glyphs=())

        norm_gray, mask = self._extract_foreground_mask(roi)
        boxes = self._segment_character_boxes(mask)
        if not boxes:
            return DigitMatchResult(value=None, text="", confidence=0.0, glyphs=())

        glyphs: list[GlyphDetection] = []
        for bx, by, bw, bh in boxes:
            crop_gray = norm_gray[by : by + bh, bx : bx + bw]
            crop_mask = mask[by : by + bh, bx : bx + bw]
            # Tighten vertical bounds on each segmented column
            ys, xs = np.nonzero(crop_mask > 0)
            if len(xs) > 0 and len(ys) > 0:
                y0, y1 = int(ys.min()), int(ys.max()) + 1
                x0, x1 = int(xs.min()), int(xs.max()) + 1
                crop_gray = crop_gray[y0:y1, x0:x1]
                crop_mask = crop_mask[y0:y1, x0:x1]
                bx, by, bw, bh = bx + x0, by + y0, x1 - x0, y1 - y0

            digit, conf = self._classify_single_blob(crop_gray, crop_mask)
            if conf >= min_confidence:
                glyphs.append(
                    GlyphDetection(
                        digit=digit,
                        x=bx,
                        y=by,
                        w=bw,
                        h=bh,
                        confidence=conf,
                    )
                )

        if not glyphs:
            return DigitMatchResult(value=None, text="", confidence=0.0, glyphs=())

        text = "".join(str(g.digit) for g in glyphs)
        mean_conf = float(np.mean([g.confidence for g in glyphs]))
        return DigitMatchResult(
            value=int(text),
            text=text,
            confidence=mean_conf,
            glyphs=tuple(glyphs),
        )

    def match_digits(self, roi_gray: np.ndarray, min_confidence: float = 0.50) -> int | None:
        """Recognize digits in `roi_gray` and return the integer value (or None if below threshold)."""
        res = self.recognize(roi_gray, min_confidence=min_confidence)
        return res.value

    def match_digits_with_confidence(
        self, roi_gray: np.ndarray, min_confidence: float = 0.50
    ) -> tuple[int | None, float]:
        """Recognize digits in `roi_gray` and return `(value, confidence)`."""
        res = self.recognize(roi_gray, min_confidence=min_confidence)
        return res.value, res.confidence

    def match_timer_seconds(
        self, roi: np.ndarray, min_confidence: float = 0.50
    ) -> tuple[int | None, float]:
        """Parse a countdown timer ROI (e.g. '02:45' or '2:45' or '03:00') into remaining seconds."""
        res = self.recognize(roi, min_confidence=min_confidence)
        if res.value is None or not res.text:
            return None, 0.0

        digits = res.text
        if len(digits) in (3, 4):
            mins = int(digits[:-2])
            secs = int(digits[-2:])
            if 0 <= mins <= 3 and 0 <= secs < 60:
                return mins * 60 + secs, res.confidence
        elif len(digits) <= 2:
            secs = int(digits)
            if 0 <= secs < 60:
                return secs, res.confidence
        return None, 0.0
