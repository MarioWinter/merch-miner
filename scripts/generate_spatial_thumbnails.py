#!/usr/bin/env python
"""PROJ-34 Phase 13a-ext + 13o — generate 43 schematic spatial thumbnail PNGs.

Renders one 512×512 PNG per `SPATIAL_OPTIONS` entry (`design_app.services.
style_library`) into
`django-app/design_app/static/design_app/thumbnails/spatial/{id}.png`.

Each thumbnail is a neutral grey canvas (#D9D9D9) with black geometric
markers (#222222) that visually communicate the spatial grammar:
- filled rounded rectangles → text blocks
- crossed circles → "illustration goes here"
- thin frames / hexagons / octagons → enclosing shapes
- dashed arcs → text-on-curve
- banner ribbons → ribbon-style text holders

Use Pillow (already in requirements; cairosvg is not). Output is
deterministic and idempotent — re-running overwrites.

Run from the repo root *inside* the web container:

    docker compose exec web python /app/scripts/generate_spatial_thumbnails.py
"""

from __future__ import annotations

import math
import os
import sys
from pathlib import Path

from PIL import Image, ImageDraw

# Bootstrap Django so we can import the SPATIAL_OPTIONS source of truth.
# Works in two contexts:
#   1. Host repo: <repo>/scripts/generate_spatial_thumbnails.py → django-app/ alongside.
#   2. Container (web service): /app is the django-app/ root.
HERE = Path(__file__).resolve()
HOST_DJANGO_DIR = HERE.parents[1] / 'django-app'
CONTAINER_DJANGO_DIR = Path('/app')
if (HOST_DJANGO_DIR / 'core' / 'settings.py').exists():
    DJANGO_DIR = HOST_DJANGO_DIR
elif (CONTAINER_DJANGO_DIR / 'core' / 'settings.py').exists():
    DJANGO_DIR = CONTAINER_DJANGO_DIR
else:
    raise SystemExit('Cannot locate django-app/ (no core/settings.py found).')
sys.path.insert(0, str(DJANGO_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django  # noqa: E402

django.setup()  # noqa: E402

from design_app.services.style_library import SPATIAL_OPTIONS  # noqa: E402

OUT_DIR = (
    DJANGO_DIR / 'design_app' / 'static' / 'design_app' / 'thumbnails' / 'spatial'
)

# ─── Palette + dimensions ────────────────────────────────────────────────
CANVAS = 512
BG = (217, 217, 217)         # #D9D9D9
INK = (34, 34, 34)           # #222222
STROKE_THIN = 3
STROKE_OUTLINE = 4
STROKE_CIRCLE = 6
STROKE_ARC = 12
ARC_DASH = (10, 8)            # dash, gap


# ─── Drawing primitives ──────────────────────────────────────────────────

def new_canvas() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new('RGB', (CANVAS, CANVAS), BG)
    return img, ImageDraw.Draw(img)


def text_rect(d: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float = 30) -> None:
    """Solid rounded-rectangle (text block placeholder)."""
    d.rounded_rectangle((x, y, x + w, y + h), radius=6, fill=INK)


def crossed_circle(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float) -> None:
    """Crossed circle = 'illustration goes here'."""
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=INK, width=STROKE_CIRCLE)
    off = r / math.sqrt(2)
    d.line((cx - off, cy - off, cx + off, cy + off), fill=INK, width=STROKE_OUTLINE)
    d.line((cx - off, cy + off, cx + off, cy - off), fill=INK, width=STROKE_OUTLINE)


def frame(d: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, sw: int = STROKE_OUTLINE) -> None:
    d.rectangle((x, y, x + w, y + h), outline=INK, width=sw)


def rounded_frame(d: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, radius: int = 12, sw: int = STROKE_OUTLINE) -> None:
    d.rounded_rectangle((x, y, x + w, y + h), radius=radius, outline=INK, width=sw)


def dashed_arc(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, start_deg: float, end_deg: float, dash_len: int = 14, gap_deg: float | None = None) -> None:
    """Dashed arc using short angular segments — represents 'text on curve'."""
    # Convert dash length (px along arc) → angular step.
    circumference = 2 * math.pi * r
    step_deg = (dash_len / circumference) * 360 if circumference else 8
    if gap_deg is None:
        gap_deg = step_deg
    a = start_deg
    drawing = True
    bbox = (cx - r, cy - r, cx + r, cy + r)
    while a < end_deg:
        nxt = min(a + step_deg, end_deg)
        if drawing:
            d.arc(bbox, a, nxt, fill=INK, width=STROKE_ARC)
        a = nxt + (gap_deg if drawing else 0)
        drawing = not drawing


def banner_ribbon(d: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float = 50) -> None:
    """Banner ribbon with little triangular tails on each end."""
    # Main body
    d.rectangle((x, y, x + w, y + h), fill=INK)
    # Triangular tails (notch cut into the ends)
    tail = h * 0.45
    # Left tail
    d.polygon([(x, y), (x + tail, y + h / 2), (x, y + h)], fill=BG)
    # Right tail
    d.polygon([(x + w, y), (x + w - tail, y + h / 2), (x + w, y + h)], fill=BG)
    # Outer shoulders (small dropped flaps under the canvas line) for ribbon look
    flap_h = h * 0.4
    d.polygon([(x - 10, y + h - 8), (x, y + h - 8), (x, y + h + flap_h), (x - 4, y + h + flap_h - 6)], fill=INK)
    d.polygon([(x + w + 10, y + h - 8), (x + w, y + h - 8), (x + w, y + h + flap_h), (x + w + 4, y + h + flap_h - 6)], fill=INK)


def regular_polygon(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, sides: int, rotation_deg: float = -90, sw: int = STROKE_OUTLINE) -> list[tuple[float, float]]:
    """Draw regular polygon outline; return vertex list."""
    pts = []
    for i in range(sides):
        a = math.radians(rotation_deg + i * 360 / sides)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    d.polygon(pts, outline=INK, width=sw)
    return pts


def checkbox(d: ImageDraw.ImageDraw, x: float, y: float, size: int = 18) -> None:
    d.rectangle((x, y, x + size, y + size), outline=INK, width=2)


def perforation_dots(d: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, step: int = 22, dot_r: int = 4) -> None:
    """Postage-stamp perforation along all 4 edges of a rect."""
    # Top + bottom
    for cx in range(int(x + step / 2), int(x + w), step):
        d.ellipse((cx - dot_r, y - dot_r, cx + dot_r, y + dot_r), fill=INK)
        d.ellipse((cx - dot_r, y + h - dot_r, cx + dot_r, y + h + dot_r), fill=INK)
    # Left + right
    for cy in range(int(y + step / 2), int(y + h), step):
        d.ellipse((x - dot_r, cy - dot_r, x + dot_r, cy + dot_r), fill=INK)
        d.ellipse((x + w - dot_r, cy - dot_r, x + w + dot_r, cy + dot_r), fill=INK)


def speech_bubble(d: ImageDraw.ImageDraw, x: float, y: float, w: float, h: float, tail: tuple[float, float] = (0, 0)) -> None:
    """Rounded bubble shape with a triangular tail."""
    rounded_frame(d, x, y, w, h, radius=30, sw=STROKE_OUTLINE)
    # Tail points down-right from the bubble bottom edge.
    tx, ty = tail
    # Anchor at bottom-right of bubble
    ax = x + w * 0.65
    ay = y + h
    # Cover the bubble bottom seam with BG so the tail looks attached
    d.polygon([(ax - 22, ay - 2), (ax + 22, ay - 2), (tx, ty)], fill=BG)
    d.line((ax - 22, ay, tx, ty), fill=INK, width=STROKE_OUTLINE)
    d.line((ax + 22, ay, tx, ty), fill=INK, width=STROKE_OUTLINE)


def sunburst_rays(d: ImageDraw.ImageDraw, cx: float, cy: float, inner_r: float, count: int = 12) -> None:
    for i in range(count):
        a = math.radians(i * 360 / count)
        x0 = cx + inner_r * math.cos(a)
        y0 = cy + inner_r * math.sin(a)
        x1 = cx + CANVAS * math.cos(a)
        y1 = cy + CANVAS * math.sin(a)
        d.line((x0, y0, x1, y1), fill=INK, width=STROKE_OUTLINE)


# ─── Layout builders ─────────────────────────────────────────────────────
# One function per spatial id. Each returns an Image already drawn on.

def L_vertical_stack() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 126, 80, 260, 34)
    crossed_circle(d, 256, 256, 120)
    text_rect(d, 166, 410, 180, 24)
    return img


def L_horizontal_row() -> Image.Image:
    img, d = new_canvas()
    crossed_circle(d, 140, 256, 100)
    text_rect(d, 280, 180, 200, 26)
    text_rect(d, 280, 230, 220, 32)
    text_rect(d, 280, 290, 180, 22)
    return img


def L_badge_emblem() -> Image.Image:
    img, d = new_canvas()
    # Outer thin ring
    d.ellipse((76, 76, 436, 436), outline=INK, width=STROKE_THIN)
    # Inner ring
    d.ellipse((96, 96, 416, 416), outline=INK, width=STROKE_THIN)
    crossed_circle(d, 256, 256, 110)
    # Top arc (dashed) and bottom arc (dashed) inside the rings
    dashed_arc(d, 256, 256, 145, 200, 340)   # top half
    dashed_arc(d, 256, 256, 145, 20, 160)    # bottom half
    return img


def L_banner_top() -> Image.Image:
    img, d = new_canvas()
    banner_ribbon(d, 60, 40, 392, 50)
    crossed_circle(d, 256, 290, 130)
    return img


def L_headline_top_subtitle_bottom() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 90, 50, 332, 44)        # bold headline
    crossed_circle(d, 256, 260, 120)
    text_rect(d, 180, 440, 152, 16)      # tiny subtitle
    return img


def L_text_overlay() -> Image.Image:
    img, d = new_canvas()
    crossed_circle(d, 256, 256, 160)
    # Overlay text rect — drawn with white stroke around the ink rect to suggest knockout
    x0, y0, x1, y1 = 116, 240, 396, 280
    # Halo (BG) behind text
    d.rounded_rectangle((x0 - 6, y0 - 6, x1 + 6, y1 + 6), radius=10, fill=BG)
    d.rounded_rectangle((x0, y0, x1, y1), radius=6, fill=INK)
    return img


def L_stacked_word_block() -> Image.Image:
    img, d = new_canvas()
    widths = [200, 280, 360, 280, 200]
    heights = [22, 30, 44, 30, 22]
    y = 100
    for w, h in zip(widths, heights):
        text_rect(d, (CANVAS - w) / 2, y, w, h)
        y += h + 28
    return img


def L_knockout_text() -> Image.Image:
    img, d = new_canvas()
    # Big filled plaque
    d.rounded_rectangle((70, 130, 442, 382), radius=24, fill=INK)
    # "Knocked out" text shape in BG
    text_w, text_h = 320, 50
    cx0, cy0 = (CANVAS - text_w) / 2, 230
    d.rounded_rectangle((cx0, cy0, cx0 + text_w, cy0 + text_h), radius=6, fill=BG)
    return img


def L_big_word_tiny_tag() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 70, 120, 372, 220)      # huge word
    text_rect(d, 200, 380, 112, 18)      # tiny tag
    return img


def L_word_as_shape() -> Image.Image:
    img, d = new_canvas()
    # Build a heart-silhouette out of text rects.
    # Top lobes
    text_rect(d, 130, 130, 110, 26)
    text_rect(d, 270, 130, 110, 26)
    # Upper body
    text_rect(d, 110, 175, 290, 30)
    # Middle body
    text_rect(d, 140, 220, 230, 30)
    # Lower body — tapering
    text_rect(d, 180, 265, 150, 26)
    text_rect(d, 215, 305, 80, 22)
    text_rect(d, 240, 340, 30, 18)
    return img


def L_diagonal_text() -> Image.Image:
    img = Image.new('RGB', (CANVAS, CANVAS), BG)
    # Draw rects on a transparent layer, rotate, paste back.
    layer = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    dl = ImageDraw.Draw(layer)
    text_rect(dl, 86, 200, 340, 34)
    text_rect(dl, 86, 246, 340, 34)
    text_rect(dl, 86, 292, 340, 34)
    rotated = layer.rotate(-20, resample=Image.BICUBIC, center=(256, 256))
    img.paste(rotated, (0, 0), rotated)
    return img


def L_pyramid_stack() -> Image.Image:
    img, d = new_canvas()
    widths = [120, 200, 280, 360, 440]
    heights = [18, 24, 32, 40, 50]
    y = 90
    for w, h in zip(widths, heights):
        text_rect(d, (CANVAS - w) / 2, y, w, h)
        y += h + 12
    return img


def L_rectangular_frame() -> Image.Image:
    img, d = new_canvas()
    frame(d, 50, 50, 412, 412)
    # Inner thin double-line
    frame(d, 64, 64, 384, 384, sw=2)
    text_rect(d, 130, 90, 252, 28)
    crossed_circle(d, 256, 256, 110)
    text_rect(d, 160, 396, 192, 24)
    return img


def L_crest_coat_of_arms() -> Image.Image:
    img, d = new_canvas()
    # Shield outline: rounded top, pointed bottom.
    shield_pts = [
        (160, 100),
        (352, 100),
        (372, 120),
        (372, 280),
        (256, 410),     # pointed bottom
        (140, 280),
        (140, 120),
    ]
    d.polygon(shield_pts, outline=INK, width=STROKE_OUTLINE)
    crossed_circle(d, 256, 220, 80)
    banner_ribbon(d, 80, 410, 352, 40)
    # Laurel flanks — simple line motifs
    for i in range(4):
        y = 150 + i * 50
        d.line((92, y, 132, y + 14), fill=INK, width=3)
        d.line((420, y, 380, y + 14), fill=INK, width=3)
    return img


def L_postage_stamp() -> Image.Image:
    img, d = new_canvas()
    x, y, w, h = 50, 50, 412, 412
    frame(d, x, y, w, h)
    perforation_dots(d, x, y, w, h)
    # Denomination tag in upper-left corner
    text_rect(d, x + 30, y + 30, 80, 20)
    crossed_circle(d, 256, 256, 110)
    text_rect(d, x + 90, y + h - 70, 232, 24)
    return img


def L_hexagon_medallion() -> Image.Image:
    img, d = new_canvas()
    regular_polygon(d, 256, 256, 170, 6, rotation_deg=-90)
    crossed_circle(d, 256, 256, 90)
    text_rect(d, 156, 60, 200, 26)
    text_rect(d, 186, 444, 140, 22)
    return img


def L_road_sign() -> Image.Image:
    img, d = new_canvas()
    # Octagon (stop-sign style) filling most of canvas
    regular_polygon(d, 256, 256, 200, 8, rotation_deg=-67.5)
    text_rect(d, 156, 242, 200, 30)
    return img


def L_definition_entry() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 80, 80, 300, 44)          # headword
    text_rect(d, 80, 138, 120, 16)         # phonetic
    text_rect(d, 212, 138, 60, 16)         # POS
    # Paragraph lines
    text_rect(d, 80, 200, 352, 14)
    text_rect(d, 80, 226, 340, 14)
    text_rect(d, 80, 252, 350, 14)
    text_rect(d, 80, 278, 320, 14)
    text_rect(d, 80, 304, 348, 14)
    text_rect(d, 80, 330, 250, 14)
    return img


def L_knolling_grid() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 80, 60, 352, 30)
    # 3x3 grid of mini crossed circles
    margin_x, margin_y = 90, 130
    cell = 110
    for row in range(3):
        for col in range(3):
            cx = margin_x + col * cell + cell / 2
            cy = margin_y + row * cell + cell / 2
            crossed_circle(d, cx, cy, 36)
    return img


def L_anatomy_diagram() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 130, 50, 252, 26)
    cx, cy, r = 256, 270, 100
    crossed_circle(d, cx, cy, r)
    # 4 pointer lines + tiny label rects at NE/NW/SE/SW
    targets = [(60, 130), (452, 130), (60, 410), (452, 410)]
    for tx, ty in targets:
        # Line from circle edge toward label
        dx, dy = tx - cx, ty - cy
        length = math.hypot(dx, dy)
        ex = cx + (dx / length) * r
        ey = cy + (dy / length) * r
        d.line((ex, ey, tx, ty), fill=INK, width=2)
        # Tiny label
        text_rect(d, tx - 40 if tx < cx else tx, ty - 8, 80, 16)
    return img


def L_checklist() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 100, 70, 312, 30)         # title
    for i in range(5):
        y = 140 + i * 60
        checkbox(d, 120, y, size=22)
        text_rect(d, 160, y + 4, 232, 18)
    return img


def L_periodic_tile() -> Image.Image:
    img, d = new_canvas()
    # Outlined square tile
    frame(d, 116, 116, 280, 280, sw=STROKE_OUTLINE)
    text_rect(d, 140, 140, 56, 18)         # atomic number (top-left)
    text_rect(d, 196, 200, 120, 100)       # big symbol
    text_rect(d, 156, 326, 200, 22)        # name
    return img


def L_recipe_card() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 100, 60, 312, 36)          # title
    text_rect(d, 160, 110, 192, 18)         # subtitle
    for i in range(4):
        y = 170 + i * 50
        # bullet dot
        d.ellipse((120, y + 4, 134, y + 18), fill=INK)
        text_rect(d, 150, y + 4, 232, 18)
    # Tiny garnish illustration in corner
    crossed_circle(d, 430, 430, 38)
    return img


def L_vintage_postcard() -> Image.Image:
    img, d = new_canvas()
    # Huge stacked "Greetings from" headline filling top half
    text_rect(d, 90, 60, 332, 40)
    text_rect(d, 130, 110, 252, 56)
    crossed_circle(d, 256, 320, 110)
    text_rect(d, 170, 450, 172, 16)
    return img


def L_sports_jersey() -> Image.Image:
    img, d = new_canvas()
    # Arched name (top)
    dashed_arc(d, 256, 320, 160, 200, 340)
    # Massive number — represented as one big rect roughly square
    text_rect(d, 170, 200, 172, 180)
    # Arched team name (bottom)
    dashed_arc(d, 256, 200, 160, 20, 160)
    return img


def L_movie_poster() -> Image.Image:
    img, d = new_canvas()
    crossed_circle(d, 256, 200, 160)            # upper two-thirds illustration
    text_rect(d, 60, 380, 392, 50)              # dramatic title
    # Credit-block lines
    text_rect(d, 130, 446, 252, 10)
    text_rect(d, 156, 462, 200, 10)
    return img


def L_license_plate() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 156, 90, 200, 18)              # region tag above
    # Plate body
    rounded_frame(d, 50, 200, 412, 130, radius=20)
    text_rect(d, 100, 240, 312, 50)             # chunky letters
    text_rect(d, 156, 400, 200, 18)             # state tag below
    return img


def L_concert_ticket() -> Image.Image:
    img, d = new_canvas()
    # Ticket body
    rounded_frame(d, 40, 170, 432, 180, radius=14)
    # Dashed vertical perforation separating stub
    stub_x = 320
    for y in range(180, 350, 14):
        d.line((stub_x, y, stub_x, y + 8), fill=INK, width=2)
    # Main area: big event name
    text_rect(d, 70, 230, 220, 36)
    # Stub: 3 small detail lines
    text_rect(d, 340, 200, 110, 14)
    text_rect(d, 340, 224, 110, 14)
    text_rect(d, 340, 248, 110, 14)
    return img


def L_map_coordinates() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 100, 80, 312, 44)              # place name
    text_rect(d, 156, 150, 200, 18)             # coords
    # Minimal landmark line-art (skyline-ish)
    pts = [(80, 360), (130, 320), (160, 350), (210, 280), (250, 340),
           (300, 290), (340, 350), (390, 300), (432, 360)]
    for a, b in zip(pts, pts[1:]):
        d.line((a, b), fill=INK, width=STROKE_OUTLINE)
    # Base line
    d.line((60, 400, 452, 400), fill=INK, width=STROKE_OUTLINE)
    return img


def L_off_center_text_wrap() -> Image.Image:
    img, d = new_canvas()
    crossed_circle(d, 370, 256, 120)
    # Text rects on the left, widths shaped around an implied curve.
    rows = [
        (60, 130, 200), (60, 170, 180), (60, 210, 160),
        (60, 250, 150), (60, 290, 170), (60, 330, 200),
    ]
    for x, y, w in rows:
        text_rect(d, x, y, w, 22)
    return img


def L_diagonal_split() -> Image.Image:
    img, d = new_canvas()
    # Diagonal line top-left → bottom-right
    d.line((0, 0, CANVAS, CANVAS), fill=INK, width=STROKE_OUTLINE)
    # Upper-right triangle — crossed circle
    crossed_circle(d, 370, 150, 90)
    # Lower-left triangle — 3 stacked text rects
    text_rect(d, 50, 320, 250, 24)
    text_rect(d, 50, 360, 220, 24)
    text_rect(d, 50, 400, 180, 24)
    return img


def L_triptych_three_panel() -> Image.Image:
    img, d = new_canvas()
    text_rect(d, 60, 60, 392, 30)              # header bar across all 3
    # Two vertical dividers
    d.line((CANVAS / 3, 120, CANVAS / 3, 460), fill=INK, width=STROKE_THIN)
    d.line((2 * CANVAS / 3, 120, 2 * CANVAS / 3, 460), fill=INK, width=STROKE_THIN)
    # Outer panel frame
    frame(d, 40, 120, 432, 340, sw=STROKE_THIN)
    # Mini crossed circles, one per panel
    crossed_circle(d, 110, 290, 56)
    crossed_circle(d, 256, 290, 56)
    crossed_circle(d, 402, 290, 56)
    return img


def L_concentric_circular_text() -> Image.Image:
    img, d = new_canvas()
    # Outer dashed arcs (top + bottom) = ring of text
    dashed_arc(d, 256, 256, 210, 200, 340)
    dashed_arc(d, 256, 256, 210, 20, 160)
    # Inner ring
    d.ellipse((96, 96, 416, 416), outline=INK, width=STROKE_THIN)
    d.ellipse((146, 146, 366, 366), outline=INK, width=STROKE_THIN)
    crossed_circle(d, 256, 256, 80)
    return img


def L_speech_bubble() -> Image.Image:
    img, d = new_canvas()
    speech_bubble(d, 60, 60, 392, 260, tail=(380, 380))
    # Inside-bubble text rects
    text_rect(d, 100, 130, 312, 20)
    text_rect(d, 100, 170, 280, 20)
    text_rect(d, 100, 210, 240, 20)
    # Character below
    crossed_circle(d, 380, 430, 56)
    return img


def L_quote_marks_frame() -> Image.Image:
    img, d = new_canvas()
    # Stylized "66" upper-left  — two filled blobs
    d.ellipse((50, 60, 110, 130), fill=INK)
    d.ellipse((120, 60, 180, 130), fill=INK)
    # Stylized "99" lower-right
    d.ellipse((332, 382, 392, 452), fill=INK)
    d.ellipse((402, 382, 462, 452), fill=INK)
    # Centered slogan in middle
    text_rect(d, 100, 220, 312, 30)
    text_rect(d, 130, 270, 252, 26)
    return img


def L_sunburst_layout() -> Image.Image:
    img, d = new_canvas()
    cx, cy = 256, 256
    sunburst_rays(d, cx, cy, inner_r=140, count=12)
    crossed_circle(d, cx, cy, 110)
    # Top arc + bottom arc (text-on-curve indicators)
    dashed_arc(d, cx, cy, 200, 200, 340)
    dashed_arc(d, cx, cy, 200, 20, 160)
    return img


# ─── Phase 13o layouts (German POD layout-canon references) ──────────────

def L_flush_aligned_block() -> Image.Image:
    img, d = new_canvas()
    # 5 stacked rects, all flush-left at x=60, varying widths → staircase silhouette.
    widths = [200, 280, 220, 300, 180]
    y = 110
    for w in widths:
        text_rect(d, 60, y, w, 30)
        y += 60
    return img


def L_full_canvas_word_block() -> Image.Image:
    img, d = new_canvas()
    # 4 lines filling the entire canvas edge-to-edge, almost no padding.
    # x = 20 → x = 492 (width 472). Tight vertical gaps.
    for y in (80, 200, 320, 440):
        text_rect(d, 20, y, 472, 50)
    return img


def L_vertical_pillar_text() -> Image.Image:
    img, d = new_canvas()
    # One TALL vertical rect down the center.
    text_rect(d, 240, 60, 40, 390)
    # Small crossed-circle in the lower-left corner for context.
    crossed_circle(d, 100, 420, 40)
    return img


def L_illustration_only_no_text() -> Image.Image:
    img, d = new_canvas()
    # Just a single large crossed-circle, generous breathing room. NO text rects.
    crossed_circle(d, 256, 256, 140)
    return img


def L_unconventional_integration() -> Image.Image:
    img = Image.new('RGB', (CANVAS, CANVAS), BG)
    d = ImageDraw.Draw(img)
    # Crossed-circle offset to upper-left of center.
    crossed_circle(d, 200, 200, 100)
    # Scattered text rects at different angles overlapping the illustration.
    # Use a rotated overlay layer for the angled rects.
    layer = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    dl = ImageDraw.Draw(layer)
    # Rect 1: angled, overlapping the circle's lower edge.
    text_rect(dl, 130, 280, 220, 28)
    rotated1 = layer.rotate(-12, resample=Image.BICUBIC, center=(240, 294))
    img.paste(rotated1, (0, 0), rotated1)

    # Rect 2: anchored to the upper-right, sharp rotation.
    layer2 = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    dl2 = ImageDraw.Draw(layer2)
    text_rect(dl2, 320, 70, 160, 26)
    rotated2 = layer2.rotate(15, resample=Image.BICUBIC, center=(400, 83))
    img.paste(rotated2, (0, 0), rotated2)

    # Rect 3: lower-right horizontal anchor, not rotated.
    text_rect(d, 280, 380, 180, 26)
    return img


def L_crossed_tools_intersection() -> Image.Image:
    img = Image.new('RGB', (CANVAS, CANVAS), BG)
    d = ImageDraw.Draw(img)
    # Build two thick "tool" bars crossing at the canvas center on a rotated layer.
    # Each bar = thick rect 16px tall × 400px long, centered.
    # Tool 1 rotated +30°.
    layer1 = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    dl1 = ImageDraw.Draw(layer1)
    dl1.rectangle((56, 248, 456, 264), fill=INK)
    rotated1 = layer1.rotate(30, resample=Image.BICUBIC, center=(256, 256))
    img.paste(rotated1, (0, 0), rotated1)
    # Tool 2 rotated -30°.
    layer2 = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    dl2 = ImageDraw.Draw(layer2)
    dl2.rectangle((56, 248, 456, 264), fill=INK)
    rotated2 = layer2.rotate(-30, resample=Image.BICUBIC, center=(256, 256))
    img.paste(rotated2, (0, 0), rotated2)
    # Text bands above and below the X.
    text_rect(d, 110, 80, 292, 30)        # primary line above
    text_rect(d, 156, 410, 200, 22)       # smaller accent line below
    return img


def L_subject_portrait_with_caption() -> Image.Image:
    img, d = new_canvas()
    # Big subject portrait filling upper 2/3.
    crossed_circle(d, 256, 200, 140)
    # Small minimal caption at the bottom edge with generous breathing room.
    text_rect(d, 166, 420, 180, 30)
    return img


# ─── Layout registry ─────────────────────────────────────────────────────
LAYOUTS = {
    'vertical_stack': L_vertical_stack,
    'horizontal_row': L_horizontal_row,
    'badge_emblem': L_badge_emblem,
    'banner_top': L_banner_top,
    'headline_top_subtitle_bottom': L_headline_top_subtitle_bottom,
    'text_overlay': L_text_overlay,
    'stacked_word_block': L_stacked_word_block,
    'knockout_text': L_knockout_text,
    'big_word_tiny_tag': L_big_word_tiny_tag,
    'word_as_shape': L_word_as_shape,
    'diagonal_text': L_diagonal_text,
    'pyramid_stack': L_pyramid_stack,
    'rectangular_frame': L_rectangular_frame,
    'crest_coat_of_arms': L_crest_coat_of_arms,
    'postage_stamp': L_postage_stamp,
    'hexagon_medallion': L_hexagon_medallion,
    'road_sign': L_road_sign,
    'definition_entry': L_definition_entry,
    'knolling_grid': L_knolling_grid,
    'anatomy_diagram': L_anatomy_diagram,
    'checklist': L_checklist,
    'periodic_tile': L_periodic_tile,
    'recipe_card': L_recipe_card,
    'vintage_postcard': L_vintage_postcard,
    'sports_jersey': L_sports_jersey,
    'movie_poster': L_movie_poster,
    'license_plate': L_license_plate,
    'concert_ticket': L_concert_ticket,
    'map_coordinates': L_map_coordinates,
    'off_center_text_wrap': L_off_center_text_wrap,
    'diagonal_split': L_diagonal_split,
    'triptych_three_panel': L_triptych_three_panel,
    'concentric_circular_text': L_concentric_circular_text,
    'speech_bubble': L_speech_bubble,
    'quote_marks_frame': L_quote_marks_frame,
    'sunburst_layout': L_sunburst_layout,
    # Phase 13o additions.
    'flush_aligned_block': L_flush_aligned_block,
    'full_canvas_word_block': L_full_canvas_word_block,
    'vertical_pillar_text': L_vertical_pillar_text,
    'illustration_only_no_text': L_illustration_only_no_text,
    'unconventional_integration': L_unconventional_integration,
    'crossed_tools_intersection': L_crossed_tools_intersection,
    'subject_portrait_with_caption': L_subject_portrait_with_caption,
}


def main() -> None:
    spatial_ids = {entry['id'] for entry in SPATIAL_OPTIONS}
    missing = spatial_ids - LAYOUTS.keys()
    extra = LAYOUTS.keys() - spatial_ids
    assert not missing, f'Missing layouts: {sorted(missing)}'
    assert not extra, f'Extra layouts not in SPATIAL_OPTIONS: {sorted(extra)}'

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for spatial_id, builder in LAYOUTS.items():
        img = builder()
        out_path = OUT_DIR / f'{spatial_id}.png'
        # optimize=True + palette mode keeps each PNG well under the 60kB target.
        img.convert('P', palette=Image.ADAPTIVE, colors=8).save(
            out_path, format='PNG', optimize=True
        )
        print(f'wrote {out_path.name}')
    print(f'\nGenerated {len(LAYOUTS)} thumbnails in {OUT_DIR}')


if __name__ == '__main__':
    main()
