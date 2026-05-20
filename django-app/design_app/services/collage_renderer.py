"""PROJ-34 Phase 13t — Best-of-Mix Top-3 Product Collage Renderer (Appendix V).

Renders a 600×200 WebP collage from 3 product thumbnails for the
Best-of-Mix Vorschläge card. Output is server-rendered + cached so the
frontend can request it as a single `<img>` URL.

Caching strategy (Resolved Tech Note T3):
- Primary: filesystem at ``MEDIA_ROOT / 'best_of_mix_collages' / <niche_id>.webp``
  with 7-day staleness.
- Fallback: Django in-memory cache key ``bom_collage:<niche_id>`` (7-day TTL)
  when MEDIA_ROOT is not writable at startup.

Atomic write: bytes go to ``.tmp`` then ``os.replace`` to avoid serving a
partial file to a concurrent reader. Public functions NEVER raise — worst
case is a 3-placeholder collage.
"""

from __future__ import annotations

import io
import logging
import os
import pathlib
import time
import uuid as _uuid
from typing import Optional

from django.conf import settings
from django.core.cache import cache
from PIL import Image, ImageDraw

logger = logging.getLogger(__name__)


# ─── Constants ────────────────────────────────────────────────────────────

COLLAGE_DIR_NAME = 'best_of_mix_collages'
COLLAGE_CELL_SIZE = 200
COLLAGE_CELL_COUNT = 3
COLLAGE_WIDTH = COLLAGE_CELL_SIZE * COLLAGE_CELL_COUNT  # 600
COLLAGE_HEIGHT = COLLAGE_CELL_SIZE                       # 200
COLLAGE_WEBP_QUALITY = 85
COLLAGE_BG_COLOR = (0x1f, 0x1f, 0x1f)
COLLAGE_STALENESS_DAYS = 7
COLLAGE_STALENESS_SECONDS = COLLAGE_STALENESS_DAYS * 24 * 60 * 60
COLLAGE_FETCH_TIMEOUT = 5.0
COLLAGE_PLACEHOLDER_TEXT = 'no image'
COLLAGE_CACHE_KEY_PREFIX = 'bom_collage'


# Cached writability flag — checked once on first call.
_writable_flag: Optional[bool] = None


# ─── Module-level writability check ──────────────────────────────────────


def _media_root_writable() -> bool:
    """Return True if MEDIA_ROOT / COLLAGE_DIR_NAME is writable.

    Result is cached on a module-level flag; subsequent calls return the
    cached value (no repeated I/O on every request).
    """
    global _writable_flag
    if _writable_flag is not None:
        return _writable_flag

    try:
        target = pathlib.Path(settings.MEDIA_ROOT) / COLLAGE_DIR_NAME
        target.mkdir(parents=True, exist_ok=True)
        probe = target / f'.writable_probe_{os.getpid()}'
        probe.write_bytes(b'ok')
        probe.unlink()
        _writable_flag = True
    except (OSError, PermissionError, AttributeError) as exc:
        logger.warning(
            'collage_renderer: MEDIA_ROOT not writable, falling back to in-memory cache (%s)',
            exc,
        )
        _writable_flag = False
    return _writable_flag


# ─── Image fetch + placeholder helpers ────────────────────────────────────


def _fetch_or_load(product_id: str) -> Image.Image:
    """Fetch the product's thumbnail and return a PIL Image.

    Raises on any failure — caller catches and renders a placeholder.
    Local imports keep module load light.
    """
    import httpx

    from scraper_app.models import AmazonProduct

    product = AmazonProduct.objects.only('thumbnail_url').get(pk=product_id)
    url = (product.thumbnail_url or '').strip()
    if not url:
        raise ValueError('empty thumbnail_url')

    with httpx.Client(timeout=COLLAGE_FETCH_TIMEOUT, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()
        img = Image.open(io.BytesIO(resp.content))
        img.load()
        return img.convert('RGB')


def _center_crop_resize_to_cell(img: Image.Image) -> Image.Image:
    """Center-crop the image to a square, then resize to COLLAGE_CELL_SIZE."""
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    cropped = img.crop((left, top, left + side, top + side))
    return cropped.resize(
        (COLLAGE_CELL_SIZE, COLLAGE_CELL_SIZE),
        Image.LANCZOS,
    )


def _placeholder_200(label: str = COLLAGE_PLACEHOLDER_TEXT) -> Image.Image:
    """Render a 200×200 placeholder cell with centered label text."""
    cell = Image.new('RGB', (COLLAGE_CELL_SIZE, COLLAGE_CELL_SIZE), COLLAGE_BG_COLOR)
    draw = ImageDraw.Draw(cell)
    # PIL's default bitmap font — no external font dependency. Size is
    # fixed but legible for a 200px cell.
    try:
        bbox = draw.textbbox((0, 0), label)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
    except AttributeError:
        # Fallback for very old Pillow without textbbox.
        text_w, text_h = draw.textsize(label)
    x = (COLLAGE_CELL_SIZE - text_w) // 2
    y = (COLLAGE_CELL_SIZE - text_h) // 2
    draw.text((x, y), label, fill=(0xaa, 0xaa, 0xaa))
    return cell


def _compose_canvas(cells: list[Image.Image]) -> Image.Image:
    """Paste exactly 3 cells side-by-side onto a 600×200 RGB canvas."""
    canvas = Image.new(
        'RGB', (COLLAGE_WIDTH, COLLAGE_HEIGHT), COLLAGE_BG_COLOR,
    )
    for idx, cell in enumerate(cells[:COLLAGE_CELL_COUNT]):
        canvas.paste(cell, (idx * COLLAGE_CELL_SIZE, 0))
    return canvas


def _encode_webp(canvas: Image.Image) -> bytes:
    """Encode the canvas as WebP bytes."""
    buf = io.BytesIO()
    canvas.save(buf, format='WEBP', quality=COLLAGE_WEBP_QUALITY)
    return buf.getvalue()


# ─── Public API ───────────────────────────────────────────────────────────


def render_collage_webp(product_ids: list[str]) -> bytes:
    """Render the 600×200 WebP collage for the given product ids.

    Pads ``product_ids`` to exactly 3 cells; missing or fetch-failing
    products render as placeholders. NEVER raises — worst case is a
    3-placeholder collage.
    """
    cells: list[Image.Image] = []
    for pid in (product_ids or [])[:COLLAGE_CELL_COUNT]:
        try:
            img = _fetch_or_load(str(pid))
            cells.append(_center_crop_resize_to_cell(img))
        except Exception as exc:
            logger.info(
                'collage_renderer: fallback placeholder for product %s (%s)',
                pid, exc,
            )
            cells.append(_placeholder_200())
    while len(cells) < COLLAGE_CELL_COUNT:
        cells.append(_placeholder_200())

    canvas = _compose_canvas(cells)
    return _encode_webp(canvas)


def get_collage_path(niche_id) -> pathlib.Path:
    """Return the canonical filesystem path for a niche's collage."""
    return (
        pathlib.Path(settings.MEDIA_ROOT)
        / COLLAGE_DIR_NAME
        / f'{niche_id}.webp'
    )


def _is_stale(path: pathlib.Path) -> bool:
    """True if the file is missing OR older than COLLAGE_STALENESS_DAYS."""
    if not path.exists():
        return True
    age = time.time() - path.stat().st_mtime
    return age > COLLAGE_STALENESS_SECONDS


def _write_atomic(path: pathlib.Path, data: bytes) -> None:
    """Write bytes to ``<path>.tmp`` then atomically rename to ``path``."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(path.suffix + '.tmp')
    tmp_path.write_bytes(data)
    os.replace(tmp_path, path)


def get_or_generate_collage_bytes(
    niche_id,
    product_ids: list[str],
) -> bytes:
    """Return cached collage bytes, regenerating if missing or >7 days old.

    Uses filesystem when MEDIA_ROOT is writable; otherwise falls back to
    Django cache per Resolved Tech Note T3. Atomic write on regen.
    """
    nid_str = str(niche_id)

    if _media_root_writable():
        path = get_collage_path(nid_str)
        if not _is_stale(path):
            return path.read_bytes()
        data = render_collage_webp(product_ids)
        try:
            _write_atomic(path, data)
        except OSError as exc:
            logger.warning(
                'collage_renderer: atomic write failed for %s (%s)', path, exc,
            )
        return data

    # Fallback path — in-memory Django cache (Tech Note T3).
    cache_key = f'{COLLAGE_CACHE_KEY_PREFIX}:{nid_str}'
    cached = cache.get(cache_key)
    if cached:
        return cached
    data = render_collage_webp(product_ids)
    cache.set(cache_key, data, timeout=COLLAGE_STALENESS_SECONDS)
    return data
