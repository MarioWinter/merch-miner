#!/usr/bin/env python
"""PROJ-34 Phase 13n-a-polish — bespoke SVG-rendered font-combination thumbnails.

Renders one 512×512 PNG per `FONT_COMBINATION_OPTIONS` entry
(`design_app.services.style_library`) into
`frontend-ui/public/font-combination-thumbnails/{id}.png`.

Unlike the typography thumbnails (which auto-size a single word and apply a
post-process), each font-combination thumbnail is a HAND-COMPOSED layout that
demonstrates that combination's specific pairing PRINCIPLE — magazine
hierarchies, sport-team sandwiches, alternating-line rhythms, 3D extruded
emphasis, etc. Each id calls its own dedicated `_build_<id>()` builder that
constructs an `svgwrite.Drawing` and we render the resulting SVG through
cairosvg to a flat 512×512 PNG.

Font handling: we ensure the same Google Fonts TTFs the typography script
uses are present in fontconfig (under `/root/.fonts/` inside the container,
or `~/.fonts/` on host). cairosvg then resolves `font-family="Lora"` etc.
through fontconfig/Pango. No `@font-face` URLs needed.

Run from the repo root *inside* the web container:

    docker compose exec -T web pip install cairosvg svgwrite
    docker cp scripts/generate_font_combination_thumbnails.py app_backend:/tmp/gen.py
    docker compose exec web python /tmp/gen.py --output-dir /tmp/font-combination-thumbnails
    docker cp app_backend:/tmp/font-combination-thumbnails/. frontend-ui/public/font-combination-thumbnails/
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

import cairosvg
import httpx
import svgwrite

# ─── Django bootstrap (mirrors generate_typography_thumbnails.py) ─────────
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

from design_app.services.style_library import FONT_COMBINATION_OPTIONS  # noqa: E402

# ─── Palette + canvas constants ──────────────────────────────────────────
CANVAS = 512
BG = '#F5F2EB'           # cream
INK = '#1A1A1A'           # near-black
INK_MID = '#888888'
INK_BACK = '#555555'
WHITE = '#FFFFFF'

# Flat color variants
COLOR_RED = '#D14B3E'
COLOR_TEAL = '#2BAFAF'
COLOR_ORANGE = '#E07A2A'

# Shared fonts cache (same dir typography script uses, kept out of git).
FONTS_CACHE = HERE.parent / 'fonts-cache'

# fontconfig-visible directory we install TTFs into so cairosvg/Pango can
# resolve them by family name. On Linux containers the standard user-fonts
# dir is `~/.fonts`; on host macs we leave them in the cache only and rely
# on the user having the fonts available system-wide (the container path is
# the supported run mode).
FC_FONTS_DIR = Path.home() / '.fonts'

GF_BASE = 'https://github.com/google/fonts/raw/main'

# (cache_filename, google_fonts_rel_url, fontconfig_family_name)
# Each font is downloaded once into FONTS_CACHE, then copied into FC_FONTS_DIR
# and registered with fc-cache so cairosvg can find it by `family` in the SVG.
FONT_TABLE: list[tuple[str, str, str]] = [
    ('Lora-Variable.ttf',           'ofl/lora/Lora%5Bwght%5D.ttf',                          'Lora'),
    ('Inter-Variable.ttf',          'ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf',                 'Inter'),
    ('Oswald-Variable.ttf',         'ofl/oswald/Oswald%5Bwght%5D.ttf',                      'Oswald'),
    ('DancingScript-Variable.ttf',  'ofl/dancingscript/DancingScript%5Bwght%5D.ttf',        'Dancing Script'),
    ('BowlbyOneSC-Regular.ttf',     'ofl/bowlbyonesc/BowlbyOneSC-Regular.ttf',              'Bowlby One SC'),
    ('BowlbyOne-Regular.ttf',       'ofl/bowlbyone/BowlbyOne-Regular.ttf',                  'Bowlby One'),
    ('Allura-Regular.ttf',          'ofl/allura/Allura-Regular.ttf',                        'Allura'),
    ('Rye-Regular.ttf',             'ofl/rye/Rye-Regular.ttf',                              'Rye'),
    ('PermanentMarker-Regular.ttf', 'apache/permanentmarker/PermanentMarker-Regular.ttf',   'Permanent Marker'),
    ('BagelFatOne-Regular.ttf',     'ofl/bagelfatone/BagelFatOne-Regular.ttf',              'Bagel Fat One'),
]


# ─── Font download + fontconfig registration ─────────────────────────────

def _download_font(fname: str, rel_url: str) -> Path:
    FONTS_CACHE.mkdir(parents=True, exist_ok=True)
    out_path = FONTS_CACHE / fname
    if out_path.exists() and out_path.stat().st_size > 0:
        return out_path
    url = f'{GF_BASE}/{rel_url}'
    print(f'  fetch {fname}  ←  {url}')
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=30)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        raise SystemExit(f'Failed to download font {fname!r} from {url}: {exc}')
    out_path.write_bytes(resp.content)
    return out_path


def ensure_fonts_available() -> None:
    """Download all required TTFs into FONTS_CACHE, copy into FC_FONTS_DIR,
    and rebuild fontconfig's cache so cairosvg can resolve family names."""
    FC_FONTS_DIR.mkdir(parents=True, exist_ok=True)
    for fname, rel_url, _family in FONT_TABLE:
        cached = _download_font(fname, rel_url)
        installed = FC_FONTS_DIR / fname
        if not installed.exists() or installed.stat().st_size != cached.stat().st_size:
            shutil.copy(cached, installed)
    # fc-cache is harmless to run even when nothing changed.
    try:
        subprocess.run(['fc-cache', '-f'], check=True, capture_output=True)
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        # fc-cache absent (e.g. host mac) — cairosvg may still resolve fonts
        # via system fontconfig if the user has them installed. Don't fail.
        print(f'  warn: fc-cache failed ({exc}); relying on system font config')


# ─── SVG render → PNG ────────────────────────────────────────────────────

def render_svg_to_png(dwg: svgwrite.Drawing, out_path: Path) -> None:
    """Serialize svgwrite Drawing to PNG via cairosvg at native 512×512."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    svg_bytes = dwg.tostring().encode('utf-8')
    cairosvg.svg2png(
        bytestring=svg_bytes,
        write_to=str(out_path),
        output_width=CANVAS,
        output_height=CANVAS,
    )


def new_canvas() -> svgwrite.Drawing:
    dwg = svgwrite.Drawing(size=(CANVAS, CANVAS))
    dwg.add(dwg.rect(insert=(0, 0), size=(CANVAS, CANVAS), fill=BG))
    return dwg


def _text(
    dwg: svgwrite.Drawing,
    text: str,
    x: float,
    y: float,
    family: str,
    size: int,
    weight: str | int = 'normal',
    style: str = 'normal',
    fill: str = INK,
    anchor: str = 'middle',
    letter_spacing: float | None = None,
    transform: str | None = None,
):
    """Add a centered (by default) text element. `y` is the baseline."""
    attrs = {
        'font_family': family,
        'font_size': size,
        'font_weight': str(weight),
        'font_style': style,
        'fill': fill,
        'text_anchor': anchor,
    }
    if letter_spacing is not None:
        attrs['letter_spacing'] = letter_spacing
    if transform is not None:
        attrs['transform'] = transform
    return dwg.add(dwg.text(text, insert=(x, y), **attrs))


# ─── 10 bespoke layout builders ──────────────────────────────────────────

def _build_serif_plus_sans_hierarchy() -> svgwrite.Drawing:
    """Editorial magazine — serif headline, divider, sans subtitle."""
    dwg = new_canvas()
    _text(dwg, 'MAGAZINE', 256, 180, 'Lora', 85, weight=700)
    dwg.add(dwg.line(start=(120, 215), end=(392, 215), stroke=INK, stroke_width=1))
    _text(dwg, 'digital edition', 256, 290, 'Inter', 32, weight=400)
    return dwg


def _build_script_plus_block_hierarchy() -> svgwrite.Drawing:
    """Casual party shirt — rotated script + chunky block."""
    dwg = new_canvas()
    _text(
        dwg, 'Cheers', 256, 210, 'Dancing Script', 95, weight=400,
        transform='rotate(-6 256 210)',
    )
    _text(dwg, 'FRIDAY', 256, 370, 'Bowlby One SC', 130, weight=400)
    # 3 small dots in a diagonal cluster between the two words (bumped from
    # 4×4 to 7×7 — earlier pass had them barely visible at thumbnail scale).
    for (cx, cy) in [(240, 245), (256, 262), (272, 279)]:
        dwg.add(dwg.rect(insert=(cx, cy), size=(7, 7), fill=INK))
    return dwg


def _build_single_font_color_hierarchy() -> svgwrite.Drawing:
    """3-line color stack — same font, color-driven hierarchy."""
    dwg = new_canvas()
    _text(dwg, 'BOLD',  256, 180, 'Bowlby One SC', 95, weight=400, fill=COLOR_RED)
    _text(dwg, 'MULTI', 256, 290, 'Bowlby One SC', 95, weight=400, fill=COLOR_TEAL)
    _text(dwg, 'COLOR', 256, 400, 'Bowlby One SC', 95, weight=400, fill=COLOR_ORANGE)
    return dwg


def _build_vintage_slab_plus_script_accent() -> svgwrite.Drawing:
    """Patriotic Americana — distressed Rye + Allura accent + swash arc."""
    dwg = new_canvas()
    _text(dwg, 'AMERICA', 256, 210, 'Rye', 100, weight=400)
    # Subtle knockout grunge — clip speckles to the AMERICA glyph shape so
    # they look like distress *inside* the letters, not dust *around* them.
    clip = dwg.defs.add(dwg.clipPath(id='america-clip'))
    clip.add(dwg.text(
        'AMERICA', insert=(256, 210),
        font_family='Rye', font_size=100, font_weight=400, text_anchor='middle',
    ))
    import random
    rng = random.Random(42)
    speckle_g = dwg.g(clip_path='url(#america-clip)')
    for _ in range(220):
        rx = rng.uniform(60, 452)
        ry = rng.uniform(140, 220)
        speckle_g.add(dwg.rect(
            insert=(rx, ry), size=(3, 3), fill=BG,
        ))
    dwg.add(speckle_g)
    _text(dwg, '& proud', 256, 320, 'Allura', 75, weight=400)
    # Decorative arc below
    dwg.add(dwg.path(
        d='M 140 350 Q 256 380 372 350',
        stroke=INK, stroke_width=3, fill='none',
    ))
    return dwg


def _build_athletic_sans_plus_script_sandwich() -> svgwrite.Drawing:
    """Sports team — GO / Hawks (swash) / GO."""
    dwg = new_canvas()
    _text(dwg, 'GO',    256, 140, 'Oswald', 90, weight=700)
    _text(
        dwg, 'Hawks', 256, 290, 'Allura', 105, weight=400, style='italic',
    )
    # Swash arc under "Hawks"
    dwg.add(dwg.path(
        d='M 110 305 Q 256 335 402 305',
        stroke=INK, stroke_width=4, fill='none',
    ))
    _text(dwg, 'GO',    256, 440, 'Oswald', 90, weight=700)
    return dwg


def _build_cartoon_block_plus_marker_script() -> svgwrite.Drawing:
    """Playful kid energy — HERO block with gloss stripe + marker accent."""
    dwg = new_canvas()
    # Define a clip-path that matches the HERO text shape so the white
    # gloss stripe is clipped to the glyphs.
    clip = dwg.defs.add(dwg.clipPath(id='hero-clip'))
    clip.add(dwg.text(
        'HERO', insert=(256, 260),
        font_family='Bowlby One SC', font_size=145, font_weight=400,
        text_anchor='middle',
    ))
    # HERO main render
    _text(dwg, 'HERO', 256, 260, 'Bowlby One SC', 145, weight=400)
    # Gloss stripe clipped to HERO glyphs — placed in the upper third of the
    # cap-height band (caps roughly span y=155..245 at this font/size, so the
    # stripe sits at y=190).
    dwg.add(dwg.rect(
        insert=(80, 188), size=(352, 12), fill=WHITE,
        clip_path='url(#hero-clip)',
    ))
    # Marker accent below, slight rotation for casual feel
    _text(
        dwg, 'with attitude', 256, 380, 'Permanent Marker', 55, weight=400,
        transform='rotate(-2 256 380)',
    )
    # Small radial "pop" lines anchored just outside the upper-right of HERO
    # to suggest cartoon impact (8 short strokes radiating from a virtual
    # point at the corner of the 'O').
    for (x1, y1, x2, y2) in [
        (400, 168, 418, 152),
        (412, 180, 432, 174),
        (418, 198, 440, 198),
        (412, 218, 432, 224),
    ]:
        dwg.add(dwg.line(start=(x1, y1), end=(x2, y2), stroke=INK, stroke_width=3))
    return dwg


def _build_groovy_bold_plus_modern_brush_alternating() -> svgwrite.Drawing:
    """Retro alternation — Bagel Fat One / Dancing Script / Bagel / Script."""
    dwg = new_canvas()
    _text(dwg, 'GROOVY', 256, 130, 'Bagel Fat One', 65, weight=400)
    _text(
        dwg, 'stay', 256, 225, 'Dancing Script', 55, weight=400, style='italic',
    )
    _text(dwg, 'FAR',    256, 330, 'Bagel Fat One', 65, weight=400)
    _text(
        dwg, 'out', 256, 430, 'Dancing Script', 55, weight=400, style='italic',
    )
    return dwg


def _build_sans_frame_plus_color_hero() -> svgwrite.Drawing:
    """Event flyer — frame lines + EST/DETAILS + HERO color."""
    dwg = new_canvas()
    dwg.add(dwg.line(start=(140, 130), end=(372, 130), stroke=INK, stroke_width=1.5))
    _text(
        dwg, 'EST 2026', 256, 165, 'Inter', 26, weight=400,
        letter_spacing=4.7,  # ~0.18em at 26px
    )
    _text(dwg, 'HERO', 256, 340, 'Bowlby One SC', 130, weight=400, fill=COLOR_RED)
    _text(
        dwg, 'DETAILS', 256, 420, 'Inter', 26, weight=400,
        letter_spacing=4.7,
    )
    dwg.add(dwg.line(start=(140, 445), end=(372, 445), stroke=INK, stroke_width=1.5))
    return dwg


def _build_vintage_slab_plus_modern_brush_accent() -> svgwrite.Drawing:
    """Refined Americana — Rye STYLE + Dancing Script essentials (no arc)."""
    dwg = new_canvas()
    _text(dwg, 'STYLE', 256, 240, 'Rye', 100, weight=400)
    # Very subtle grunge — even lighter than #4. Clipped to STYLE glyphs so
    # speckles never bleed into the cream background.
    clip = dwg.defs.add(dwg.clipPath(id='style-clip'))
    clip.add(dwg.text(
        'STYLE', insert=(256, 240),
        font_family='Rye', font_size=100, font_weight=400, text_anchor='middle',
    ))
    import random
    rng = random.Random(7)
    speckle_g = dwg.g(clip_path='url(#style-clip)')
    for _ in range(130):
        rx = rng.uniform(110, 402)
        ry = rng.uniform(170, 250)
        speckle_g.add(dwg.rect(
            insert=(rx, ry), size=(3, 3), fill=BG,
        ))
    dwg.add(speckle_g)
    _text(dwg, 'essentials', 256, 350, 'Dancing Script', 65, weight=400)
    return dwg


def _build_body_sans_plus_extruded_emphasis() -> svgwrite.Drawing:
    """Bus driver hero — GIVE IT / DEPTH (3D extrude) / OR NOTHING."""
    dwg = new_canvas()
    _text(
        dwg, 'GIVE IT', 256, 150, 'Oswald', 40, weight=700,
    )
    # 3-layer 3D extrude for DEPTH. Bowlby One at 145pt overflows the canvas
    # with DEPTH (5 wide caps) — bumped to 120pt which gives breathing room.
    _text(dwg, 'DEPTH', 256 + 12, 320 + 12, 'Bowlby One', 120, weight=400, fill=INK_BACK)
    _text(dwg, 'DEPTH', 256 + 6,  320 + 6,  'Bowlby One', 120, weight=400, fill=INK_MID)
    _text(dwg, 'DEPTH', 256,      320,      'Bowlby One', 120, weight=400, fill=INK)
    _text(
        dwg, 'OR NOTHING', 256, 420, 'Oswald', 40, weight=700,
    )
    return dwg


BUILDERS = {
    'serif_plus_sans_hierarchy':                  _build_serif_plus_sans_hierarchy,
    'script_plus_block_hierarchy':                _build_script_plus_block_hierarchy,
    'single_font_color_hierarchy':                _build_single_font_color_hierarchy,
    'vintage_slab_plus_script_accent':            _build_vintage_slab_plus_script_accent,
    'athletic_sans_plus_script_sandwich':         _build_athletic_sans_plus_script_sandwich,
    'cartoon_block_plus_marker_script':           _build_cartoon_block_plus_marker_script,
    'groovy_bold_plus_modern_brush_alternating':  _build_groovy_bold_plus_modern_brush_alternating,
    'sans_frame_plus_color_hero':                 _build_sans_frame_plus_color_hero,
    'vintage_slab_plus_modern_brush_accent':      _build_vintage_slab_plus_modern_brush_accent,
    'body_sans_plus_extruded_emphasis':           _build_body_sans_plus_extruded_emphasis,
}


# ─── Main ────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--output-dir',
        type=Path,
        default=None,
        help='Where to write PNGs. Defaults to <repo>/frontend-ui/public/font-combination-thumbnails/.',
    )
    args = parser.parse_args()

    # Reconcile BUILDERS against FONT_COMBINATION_OPTIONS so drift fails loudly.
    declared = {entry['id'] for entry in FONT_COMBINATION_OPTIONS}
    mapped = set(BUILDERS.keys())
    missing = declared - mapped
    extra = mapped - declared
    assert not missing, f'BUILDERS missing entries: {sorted(missing)}'
    assert not extra, f'BUILDERS has stale entries: {sorted(extra)}'

    ensure_fonts_available()

    if args.output_dir is not None:
        out_dir = args.output_dir
    elif (HERE.parents[1] / 'frontend-ui' / 'public').exists():
        out_dir = HERE.parents[1] / 'frontend-ui' / 'public' / 'font-combination-thumbnails'
    else:
        out_dir = Path('/tmp/font-combination-thumbnails')

    out_dir.mkdir(parents=True, exist_ok=True)
    print(f'writing PNGs → {out_dir}')

    for entry in FONT_COMBINATION_OPTIONS:
        cid = entry['id']
        builder = BUILDERS[cid]
        dwg = builder()
        out_path = out_dir / f'{cid}.png'
        render_svg_to_png(dwg, out_path)
        print(f'  ✓ {cid}.png  ({out_path.stat().st_size // 1024} KB)')

    print(f'\nGenerated {len(FONT_COMBINATION_OPTIONS)} thumbnails in {out_dir}')


if __name__ == '__main__':
    main()
