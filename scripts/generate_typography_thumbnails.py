#!/usr/bin/env python
"""PROJ-34 Phase 13m-a — generate 22 typography thumbnail PNGs.

Renders one 512×512 PNG per `TYPOGRAPHY_OPTIONS` entry (`design_app.services.
style_library`) into `frontend-ui/public/typography-thumbnails/{id}.png` —
served directly by Vite as `/typography-thumbnails/{id}.png` without proxying
through Django.

Each thumbnail is a light cream canvas (#F5F2EB) with near-black sample text
(#1A1A1A) auto-sized to fill ~60-70 % of the canvas width and post-processed
to visually communicate the font's anatomy (distress, gloss stripe, chrome
bevel, 3D extrusion, etc.). Fonts are downloaded from the Google Fonts
GitHub repo on first run and cached under `scripts/fonts-cache/`.

Run from the repo root *inside* the web container:

    docker cp scripts/generate_typography_thumbnails.py app_backend:/tmp/gen.py
    docker compose exec web python /tmp/gen.py --output-dir /tmp/typography-thumbnails
    docker cp app_backend:/tmp/typography-thumbnails/. frontend-ui/public/typography-thumbnails/

Or, if Pillow + httpx are installed on the host venv, just:

    python scripts/generate_typography_thumbnails.py
"""

from __future__ import annotations

import argparse
import os
import random
import sys
from io import BytesIO
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ─── Django bootstrap (re-uses the spatial-generator pattern) ────────────
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

from design_app.services.style_library import TYPOGRAPHY_OPTIONS  # noqa: E402

# ─── Palette + canvas constants ──────────────────────────────────────────
CANVAS = 512
BG = (245, 242, 235)         # #F5F2EB cream
INK = (26, 26, 26)            # #1A1A1A near-black
INK_MID = (119, 119, 119)     # #777777
INK_LIGHT = (107, 107, 107)   # #6B6B6B
INK_BACK = (68, 68, 68)       # #444444

# Target text width as fraction of canvas
TARGET_WIDTH_FRAC = 0.70

# Fonts cache (kept out of git — see .gitignore)
FONTS_CACHE = HERE.parent / 'fonts-cache'

# Google Fonts GitHub-raw base
GF_BASE = 'https://github.com/google/fonts/raw/main'

# ─── Font registry: (rel_url, sample_text, post_process_name, var_axes?) ─
# `rel_url` is the path under GF_BASE. Variable-font filenames are
# url-encoded (e.g. `Inter%5Bopsz%2Cwght%5D.ttf`). Tested at script-write
# time; if Google reshuffles the repo, the loud failure mode in `load_font`
# will name the offending id.
#
# `var_axes` (optional) is a list of axis values applied via
# `font.set_variation_by_axes()` after load. Used to push variable-font
# weight up to display-heavy where the default Regular master is too thin
# for a thumbnail-sized preview.
FONT_MAP = {
    'distressed_vintage_slab':    ('ofl/rye/Rye-Regular.ttf',                                  'VINTAGE',    'grunge_knockout',  None),
    'chunky_cartoon_block_gloss': ('ofl/bowlbyonesc/BowlbyOneSC-Regular.ttf',                  'CARTOON',    'gloss_stripe',     None),
    'distressed_industrial_sans': ('ofl/anton/Anton-Regular.ttf',                              'AWESOME',    'grunge_knockout',  None),
    'varsity_script_swash':       ('ofl/allura/Allura-Regular.ttf',                            'Varsity',    'swash_underline',  None),
    'retro_diner_brush':          ('ofl/lobster/Lobster-Regular.ttf',                          'Diner',      'stripe_knockout',  None),
    # DancingScript: wght 400→700 — push to 700 for stronger brush contrast.
    'modern_elegant_brush':       ('ofl/dancingscript/DancingScript%5Bwght%5D.ttf',            'Elegant',    None,               [700]),
    # Fredoka axis order is [Weight, Width] despite the filename — push both
    # to their max for the chunkiest "rounded friendly slab" silhouette.
    'rounded_friendly_slab':      ('ofl/fredoka/Fredoka%5Bwdth%2Cwght%5D.ttf',                 'ROUNDED',    None,               [700, 125]),
    'seventies_groovy_bold':      ('ofl/bagelfatone/BagelFatOne-Regular.ttf',                  'GROOVY',     None,               None),
    'playful_marker_script':      ('apache/permanentmarker/PermanentMarker-Regular.ttf',       'Marker',     None,               None),
    # Inter: [opsz 14-32, wght 100-900] — keep default-ish (24, 400) for editorial minimal.
    'minimal_geometric_sans':     ('ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf',                     'MINIMAL',    None,               [24, 400]),
    # Lora: wght 400-700 — keep at 500 for book-weight feel.
    'transitional_book_serif':    ('ofl/lora/Lora%5Bwght%5D.ttf',                              'Book Serif', None,               [500]),
    'western_country_slab':       ('apache/smokum/Smokum-Regular.ttf',                         'WESTERN',    'edge_cutouts',     None),
    'blackletter_gothic':         ('ofl/unifrakturmaguntia/UnifrakturMaguntia-Book.ttf',       'Gothic',     None,               None),
    'pixel_eight_bit_bitmap':     ('ofl/pressstart2p/PressStart2P-Regular.ttf',                '8-BIT',      None,               None),
    # Oswald: wght 200-700 — bold for jersey punch.
    'athletic_jersey_sans':       ('ofl/oswald/Oswald%5Bwght%5D.ttf',                          'JERSEY',     None,               [700]),
    'chrome_bevel_display':       ('ofl/fasterone/FasterOne-Regular.ttf',                      'CHROME',     'chrome_bevel',     None),
    # FredokaOne was removed from google/fonts (replaced by variable Fredoka).
    # LuckiestGuy is a faithful kindergarten-block stand-in.
    'childlike_rounded_block':    ('apache/luckiestguy/LuckiestGuy-Regular.ttf',               'FUN',        None,               None),
    'bubble_graffiti_letters':    ('ofl/sigmarone/SigmarOne-Regular.ttf',                      'BUBBLE',     'inflated',         None),
    'tattoo_old_school_bold':     ('ofl/pirataone/PirataOne-Regular.ttf',                      'TATTOO',     None,               None),
    # Caveat: wght 400-700 — heavier for clearer hand-lettering.
    'italic_handdrawn_indie':     ('ofl/caveat/Caveat%5Bwght%5D.ttf',                          'indie',      'rotate_5deg',      [700]),
    'stencil_military_uniform':   ('ofl/blackopsone/BlackOpsOne-Regular.ttf',                  'STENCIL',    None,               None),
    'extruded_3d_block':          ('ofl/bowlbyone/BowlbyOne-Regular.ttf',                      'DEPTH',      'extrude_3d',       None),
}


# ─── Font download + cache ───────────────────────────────────────────────

def _local_ttf_name(rel_url: str) -> str:
    """Strip URL-encoded brackets so the on-disk cache filename is sane."""
    name = rel_url.rsplit('/', 1)[-1]
    return name.replace('%5B', '_').replace('%5D', '').replace('%2C', '_')


def download_font(typography_id: str, rel_url: str) -> Path:
    """Download a TTF from GF GitHub raw if not already cached."""
    FONTS_CACHE.mkdir(parents=True, exist_ok=True)
    out_path = FONTS_CACHE / _local_ttf_name(rel_url)
    if out_path.exists() and out_path.stat().st_size > 0:
        return out_path

    url = f'{GF_BASE}/{rel_url}'
    print(f'  fetch {typography_id}  ←  {url}')
    try:
        # follow_redirects=True because github.com → raw.githubusercontent.com
        resp = httpx.get(url, follow_redirects=True, timeout=30)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001 — fail loudly with context
        raise SystemExit(
            f'Failed to download font for {typography_id!r} from {url}: {exc}'
        )
    out_path.write_bytes(resp.content)
    return out_path


def load_font(
    typography_id: str,
    rel_url: str,
    size_px: int,
    var_axes: list[float] | None = None,
) -> ImageFont.FreeTypeFont:
    """Load a TTF at the requested pixel size. If `var_axes` is provided AND
    the font is a variable font, push the axis values via
    `set_variation_by_axes`. Falls back silently for non-variable fonts."""
    ttf_path = download_font(typography_id, rel_url)
    font = ImageFont.truetype(str(ttf_path), size=size_px)
    if var_axes is not None:
        try:
            font.set_variation_by_axes(var_axes)
        except (OSError, ValueError):
            # Static font or wrong axis count — leave at default master.
            pass
    return font


# ─── Text rendering helpers ──────────────────────────────────────────────

def measure_text(font: ImageFont.FreeTypeFont, text: str) -> tuple[int, int, int, int]:
    """Return tight text bbox (x0, y0, x1, y1) for the given font + text."""
    dummy = Image.new('RGB', (1, 1))
    d = ImageDraw.Draw(dummy)
    return d.textbbox((0, 0), text, font=font)


def autosize_font(
    typography_id: str,
    rel_url: str,
    text: str,
    target_w_frac: float = TARGET_WIDTH_FRAC,
    max_h_frac: float = 0.55,
    min_size: int = 24,
    max_size: int = 380,
    var_axes: list[float] | None = None,
) -> ImageFont.FreeTypeFont:
    """Binary-search the font size so the text fills ~target_w_frac of the canvas
    while staying inside max_h_frac vertically. Avoids loading the font many
    times by re-using the same Pillow font object (just changing size)."""
    target_w = CANVAS * target_w_frac
    max_h = CANVAS * max_h_frac
    lo, hi = min_size, max_size
    best = lo
    while lo <= hi:
        mid = (lo + hi) // 2
        font = load_font(typography_id, rel_url, mid, var_axes=var_axes)
        x0, y0, x1, y1 = measure_text(font, text)
        w, h = x1 - x0, y1 - y0
        if w <= target_w and h <= max_h:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return load_font(typography_id, rel_url, best, var_axes=var_axes)


def render_centered_text(
    text: str,
    font: ImageFont.FreeTypeFont,
    fill: tuple[int, int, int] = INK,
    bg: tuple[int, int, int] = BG,
    canvas: int = CANVAS,
) -> Image.Image:
    """Draw `text` centered on a fresh canvas. Returns the new RGB image."""
    img = Image.new('RGB', (canvas, canvas), bg)
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = measure_text(font, text)
    w, h = x1 - x0, y1 - y0
    # Pillow textbbox can have a non-zero (x0, y0) offset; subtract it so the
    # glyph bounding box (not the typographic origin) is what we center.
    cx = (canvas - w) / 2 - x0
    cy = (canvas - h) / 2 - y0
    d.text((cx, cy), text, font=font, fill=fill)
    return img


# ─── Post-process effects (Pillow only) ──────────────────────────────────

def _text_mask(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Render text as an L-mode mask (255 = ink, 0 = background)."""
    x0, y0, x1, y1 = measure_text(font, text)
    w, h = x1 - x0, y1 - y0
    mask = Image.new('L', (CANVAS, CANVAS), 0)
    d = ImageDraw.Draw(mask)
    cx = (CANVAS - w) / 2 - x0
    cy = (CANVAS - h) / 2 - y0
    d.text((cx, cy), text, font=font, fill=255)
    return mask


def grunge_knockout(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Black text with random transparent scratches cut out — reveals BG."""
    img = Image.new('RGB', (CANVAS, CANVAS), BG)
    text_mask = _text_mask(text, font)

    # Build a noise mask the same size as the canvas — 60% of pixels punched out.
    rng = random.Random(hash(text) & 0xFFFF)
    noise = Image.new('L', (CANVAS, CANVAS), 0)
    np = noise.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            np[x, y] = 255 if rng.random() > 0.62 else 0
    # Combine: ink where text AND noise both say "on" — knockout reveals BG.
    combined = Image.eval(text_mask, lambda v: v)  # copy
    cp = combined.load()
    np2 = noise.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            if np2[x, y] > 0:
                cp[x, y] = 0  # punch hole
    # Paste INK through the punched mask.
    ink_layer = Image.new('RGB', (CANVAS, CANVAS), INK)
    img.paste(ink_layer, (0, 0), combined)
    return img


def gloss_stripe(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Render black text, then carve a white gloss stripe through the upper
    third of the cap height using a stripe-shape mask that itself is clipped
    to the text mask. The stripe must overwrite ONLY the text pixels — never
    the canvas background — so the letterforms stay legible everywhere else.
    """
    img = render_centered_text(text, font)
    x0, y0, x1, y1 = measure_text(font, text)
    w, h = x1 - x0, y1 - y0
    cx = (CANVAS - w) / 2
    cy = (CANVAS - h) / 2
    text_mask = _text_mask(text, font)
    # Build a stripe-shaped mask the size of the canvas, then AND it with
    # text_mask so the white only lands where ink already lives.
    stripe_only = Image.new('L', (CANVAS, CANVAS), 0)
    sm = ImageDraw.Draw(stripe_only)
    stripe_y = cy + h * 0.22
    sm.rectangle((cx - 4, stripe_y, cx + w + 4, stripe_y + 10), fill=255)
    # Intersect: stripe AND text → final mask for the white paste.
    sp = stripe_only.load()
    tp = text_mask.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            sp[x, y] = sp[x, y] if tp[x, y] else 0
    white_layer = Image.new('RGB', (CANVAS, CANVAS), (255, 255, 255))
    img.paste(white_layer, (0, 0), stripe_only)
    return img


def swash_underline(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    img = render_centered_text(text, font)
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = measure_text(font, text)
    w, h = x1 - x0, y1 - y0
    cx = (CANVAS - w) / 2
    cy = (CANVAS - h) / 2
    base_y = cy + h + 12
    # Two slightly-offset arc-ish lines to suggest a hand-drawn swash tail.
    d.arc(
        (cx - 30, base_y - 20, cx + w + 60, base_y + 50),
        start=170, end=10, fill=INK, width=4,
    )
    d.arc(
        (cx - 32, base_y - 18, cx + w + 62, base_y + 52),
        start=170, end=10, fill=INK, width=2,
    )
    return img


def stripe_knockout(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Render black text, then carve thin BG-colored stripes through the upper
    third of cap height — same masking pattern as `gloss_stripe` so the
    stripes only clip the text, never the surrounding canvas."""
    img = render_centered_text(text, font)
    x0, y0, x1, y1 = measure_text(font, text)
    w, h = x1 - x0, y1 - y0
    cx = (CANVAS - w) / 2
    cy = (CANVAS - h) / 2
    text_mask = _text_mask(text, font)
    stripe_mask = Image.new('L', (CANVAS, CANVAS), 0)
    sm = ImageDraw.Draw(stripe_mask)
    for i in range(3):
        sy = cy + h * 0.18 + i * 10
        sm.rectangle((cx - 4, sy, cx + w + 4, sy + 5), fill=255)
    # Intersect with text mask.
    sp = stripe_mask.load()
    tp = text_mask.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            sp[x, y] = sp[x, y] if tp[x, y] else 0
    bg_layer = Image.new('RGB', (CANVAS, CANVAS), BG)
    img.paste(bg_layer, (0, 0), stripe_mask)
    return img


def edge_cutouts(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Roughen text outline only — random small holes biased toward edges."""
    img = render_centered_text(text, font)
    text_mask = _text_mask(text, font)
    # Edge = (mask) - (eroded mask). Approximate erosion via MinFilter.
    eroded = text_mask.filter(ImageFilter.MinFilter(5))
    edge = Image.eval(text_mask, lambda v: v).copy()
    em = edge.load()
    ep = eroded.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            em[x, y] = max(0, em[x, y] - ep[x, y])  # only the outline ring
    # Random cutouts only along the edge ring.
    rng = random.Random(hash(text) & 0xFFFF)
    cutout_mask = Image.new('L', (CANVAS, CANVAS), 0)
    cm = cutout_mask.load()
    for y in range(CANVAS):
        for x in range(CANVAS):
            if em[x, y] > 0 and rng.random() > 0.5:
                cm[x, y] = 255
    # Paste BG through the cutout ring.
    bg_layer = Image.new('RGB', (CANVAS, CANVAS), BG)
    img.paste(bg_layer, (0, 0), cutout_mask)
    return img


def chrome_bevel(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Back ghost at offset + front ink — gives a hard 2-tone bevel feel."""
    img = Image.new('RGB', (CANVAS, CANVAS), BG)
    text_mask = _text_mask(text, font)

    # Back layer: shift +4, +4
    back_mask = Image.new('L', (CANVAS, CANVAS), 0)
    back_mask.paste(text_mask, (4, 4))
    back_layer = Image.new('RGB', (CANVAS, CANVAS), INK_LIGHT)
    img.paste(back_layer, (0, 0), back_mask)

    # Front layer: at origin
    front_layer = Image.new('RGB', (CANVAS, CANVAS), INK)
    img.paste(front_layer, (0, 0), text_mask)
    return img


def inflated(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Gaussian-blur then re-threshold = chunky inflated silhouette."""
    text_mask = _text_mask(text, font)
    blurred = text_mask.filter(ImageFilter.GaussianBlur(radius=4))
    # Re-threshold at 80 → fat clean silhouette
    fat = blurred.point(lambda v: 255 if v > 80 else 0)
    img = Image.new('RGB', (CANVAS, CANVAS), BG)
    ink_layer = Image.new('RGB', (CANVAS, CANVAS), INK)
    img.paste(ink_layer, (0, 0), fat)
    return img


def rotate_5deg(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    img = render_centered_text(text, font)
    return img.rotate(5, resample=Image.BICUBIC, fillcolor=BG)


def extrude_3d(text: str, font: ImageFont.FreeTypeFont) -> Image.Image:
    """Three stacked layers at offsets — gives a stepped 3D depth read."""
    img = Image.new('RGB', (CANVAS, CANVAS), BG)
    text_mask = _text_mask(text, font)

    # Back layer (+12, +12) in dark grey
    back_mask = Image.new('L', (CANVAS, CANVAS), 0)
    back_mask.paste(text_mask, (12, 12))
    img.paste(Image.new('RGB', (CANVAS, CANVAS), INK_BACK), (0, 0), back_mask)

    # Middle layer (+6, +6) in mid grey
    mid_mask = Image.new('L', (CANVAS, CANVAS), 0)
    mid_mask.paste(text_mask, (6, 6))
    img.paste(Image.new('RGB', (CANVAS, CANVAS), INK_MID), (0, 0), mid_mask)

    # Front layer at origin in black
    img.paste(Image.new('RGB', (CANVAS, CANVAS), INK), (0, 0), text_mask)
    return img


POST_PROCESS = {
    'grunge_knockout':  grunge_knockout,
    'gloss_stripe':     gloss_stripe,
    'swash_underline':  swash_underline,
    'stripe_knockout':  stripe_knockout,
    'edge_cutouts':     edge_cutouts,
    'chrome_bevel':     chrome_bevel,
    'inflated':         inflated,
    'rotate_5deg':      rotate_5deg,
    'extrude_3d':       extrude_3d,
}


# ─── Per-id thumbnail builder ────────────────────────────────────────────

def build_thumbnail(typography_id: str) -> Image.Image:
    rel_url, sample, effect, var_axes = FONT_MAP[typography_id]
    # Slightly tighter target width for very wide all-caps so they don't crowd.
    target_w_frac = 0.62 if len(sample) >= 7 else TARGET_WIDTH_FRAC
    font = autosize_font(
        typography_id, rel_url, sample,
        target_w_frac=target_w_frac, var_axes=var_axes,
    )
    if effect is None:
        return render_centered_text(sample, font)
    fn = POST_PROCESS[effect]
    return fn(sample, font)


def save_png(img: Image.Image, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # 8-bit palette + optimize keeps each PNG under ~80 KB.
    img.convert('P', palette=Image.ADAPTIVE, colors=64).save(
        out_path, format='PNG', optimize=True
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=None,
        help='Where to write PNGs. Defaults to <repo>/frontend-ui/public/typography-thumbnails/.',
    )
    args = parser.parse_args()

    # Reconcile FONT_MAP against TYPOGRAPHY_OPTIONS so a drift fails loudly.
    declared = {entry['id'] for entry in TYPOGRAPHY_OPTIONS}
    mapped = set(FONT_MAP.keys())
    missing = declared - mapped
    extra = mapped - declared
    assert not missing, f'FONT_MAP missing entries: {sorted(missing)}'
    assert not extra, f'FONT_MAP has stale entries: {sorted(extra)}'

    if args.output_dir is not None:
        out_dir = args.output_dir
    elif (HERE.parents[1] / 'frontend-ui' / 'public').exists():
        out_dir = HERE.parents[1] / 'frontend-ui' / 'public' / 'typography-thumbnails'
    else:
        # Inside-container fallback: write to /tmp/typography-thumbnails so the
        # operator can `docker cp` the directory out to host.
        out_dir = Path('/tmp/typography-thumbnails')

    out_dir.mkdir(parents=True, exist_ok=True)
    print(f'writing PNGs → {out_dir}')

    for entry in TYPOGRAPHY_OPTIONS:
        tid = entry['id']
        img = build_thumbnail(tid)
        out_path = out_dir / f'{tid}.png'
        save_png(img, out_path)
        print(f'  ✓ {tid}.png  ({out_path.stat().st_size // 1024} KB)')

    print(f'\nGenerated {len(TYPOGRAPHY_OPTIONS)} thumbnails in {out_dir}')


if __name__ == '__main__':
    main()
