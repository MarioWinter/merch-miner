"""Upscaler service (PROJ-27).

Replaces the legacy Pica.js + auto-threshold logic from PROJ-9. The actual
4× upscale runs externally on Replicate (`nightmareai/real-esrgan`); this
module owns the local Pillow post-processing — Lanczos-down guard for
portrait inputs that would overflow the 4500×5400 canvas, then center-pad
on a transparent RGBA canvas.

See PROJ-27 spec AC-20 / EC-7.
"""

from __future__ import annotations

import io
import logging

from PIL import Image

logger = logging.getLogger(__name__)


def check_dimensions(image_path: str) -> tuple[int, int]:
    """Return (width, height) of an image file."""
    with Image.open(image_path) as img:
        return img.size


def center_pad_to_target(
    image_bytes: bytes,
    target_w: int = 4500,
    target_h: int = 5400,
) -> bytes:
    """Center-pad upscaled image onto a transparent target canvas.

    AC-20 logic:
      1. Open the upscaled image (Replicate output, already 4×).
      2. If either dimension exceeds the target (e.g. tall portrait input
         where height × 4 > target_h), Lanczos-down to fit the longer
         dimension first while preserving aspect ratio.
      3. Compose centered onto a transparent RGBA canvas at (target_w, target_h).
      4. Save as PNG (compress_level=6).

    Raises:
        PIL.UnidentifiedImageError when input isn't a valid image (EC-6).
    """
    src = Image.open(io.BytesIO(image_bytes))
    src.load()

    # Always work in RGBA so transparent compositing is correct.
    if src.mode != 'RGBA':
        src = src.convert('RGBA')

    width, height = src.size

    # Lanczos-down guard — if either side exceeds target, scale down to fit.
    scale = 1.0
    if width > target_w or height > target_h:
        scale_w = target_w / width
        scale_h = target_h / height
        scale = min(scale_w, scale_h)
        new_w = max(1, int(round(width * scale)))
        new_h = max(1, int(round(height * scale)))
        src = src.resize((new_w, new_h), Image.Resampling.LANCZOS)
        width, height = src.size
        logger.info(
            'center_pad: scaled-down %sx%s -> %sx%s (scale=%.4f) before pad',
            int(width / scale), int(height / scale), width, height, scale,
        )

    # Transparent target canvas.
    canvas = Image.new('RGBA', (target_w, target_h), (0, 0, 0, 0))
    offset_x = (target_w - width) // 2
    offset_y = (target_h - height) // 2
    canvas.paste(src, (offset_x, offset_y), src)

    out = io.BytesIO()
    canvas.save(out, format='PNG', compress_level=6)
    return out.getvalue()
