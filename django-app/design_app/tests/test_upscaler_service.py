"""PROJ-27: tests for design_app.services.upscaler.center_pad_to_target."""

import io

import pytest
from PIL import Image

from design_app.services.upscaler import center_pad_to_target


def _png_bytes(width: int, height: int, color=(255, 0, 0, 255)) -> bytes:
    img = Image.new('RGBA', (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


@pytest.mark.unit
class TestCenterPadToTarget:

    def test_square_input_smaller_than_target_pads_centered(self):
        """4096×4096 (1024 × 4) on 4500×5400 → centered with margins on all sides."""
        out_bytes = center_pad_to_target(_png_bytes(4096, 4096), 4500, 5400)
        out = Image.open(io.BytesIO(out_bytes))
        assert out.size == (4500, 5400)
        assert out.mode == 'RGBA'
        # Corner pixel should be transparent (padding).
        assert out.getpixel((0, 0))[3] == 0

    def test_landscape_input_fits_within_target(self):
        """Landscape 4096×3072 fits horizontally without scaling."""
        out_bytes = center_pad_to_target(_png_bytes(4096, 3072), 4500, 5400)
        out = Image.open(io.BytesIO(out_bytes))
        assert out.size == (4500, 5400)

    def test_portrait_overflow_triggers_lanczos_down(self):
        """Tall portrait whose height exceeds target gets scaled down first.

        Input 4000×6000 — height 6000 > target 5400. Should scale down to
        fit by height, preserving aspect ratio (~3600×5400), then pad.
        """
        out_bytes = center_pad_to_target(_png_bytes(4000, 6000), 4500, 5400)
        out = Image.open(io.BytesIO(out_bytes))
        assert out.size == (4500, 5400)
        # Centre column at vertical midline should NOT be transparent
        # (image fills the whole height after the scale-down).
        center_pixel = out.getpixel((2250, 2700))
        # Pixel may have RGBA; alpha should be nonzero because the scaled
        # image fills the central region.
        assert center_pixel[3] > 0

    def test_ultra_portrait_input_pads_horizontally(self):
        """1024×3072 → 4× = 4096×12288. Lanczos-down to 5400 height ⇒ 1800×5400.

        Spec EC-7: documented behavior — large transparent left/right margins.
        """
        out_bytes = center_pad_to_target(_png_bytes(4096, 12288), 4500, 5400)
        out = Image.open(io.BytesIO(out_bytes))
        assert out.size == (4500, 5400)
        # Far-left column should be transparent (left margin).
        assert out.getpixel((10, 2700))[3] == 0

    def test_invalid_input_raises(self):
        """Garbage bytes — Pillow raises (caller turns into 'invalid_replicate_output')."""
        with pytest.raises(Exception):
            center_pad_to_target(b'not-a-real-png', 4500, 5400)

    def test_rgb_input_converted_to_rgba(self):
        """Non-RGBA inputs should be converted before composing."""
        img = Image.new('RGB', (4096, 4096), (10, 20, 30))
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        out_bytes = center_pad_to_target(buf.getvalue(), 4500, 5400)
        out = Image.open(io.BytesIO(out_bytes))
        assert out.mode == 'RGBA'
        assert out.size == (4500, 5400)
