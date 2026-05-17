#!/usr/bin/env python
"""PROJ-34 Phase 7 — generate one 1024×1024 PNG thumbnail per style.

Iterates the 15 entries from `design_app.services.style_library.STYLE_LIBRARY`,
fires `generate_image()` for each with a fixed taco-mascot test prompt, then
re-compresses + palette-quantises the output via Pillow to keep each PNG
under ~80KB (so the whole bundle stays ≤ 1.2MB per AC-24).

Idempotent: existing thumbnails are skipped unless `--force` is set. Single
slug regeneration via `--slug=<slug>` (AC-25).

Run from the repo root:

    docker compose exec web python scripts/generate_style_thumbnails.py
    docker compose exec web python scripts/generate_style_thumbnails.py --slug vintage_retro
    docker compose exec web python scripts/generate_style_thumbnails.py --force

Aborts with a clear error if `OPENROUTER_API_KEY` is unset (EC-22).
"""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import sys
import tempfile
from pathlib import Path

# Bootstrap Django so we can import design_app services.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DJANGO_DIR = PROJECT_ROOT / 'django-app'
sys.path.insert(0, str(DJANGO_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django  # noqa: E402

django.setup()  # noqa: E402

from django.conf import settings  # noqa: E402

from design_app.services.image_generator import generate_image  # noqa: E402
from design_app.services.style_library import STYLE_LIBRARY  # noqa: E402

THUMBNAIL_DIR = (
    PROJECT_ROOT / 'frontend-ui' / 'public' / 'style-thumbnails'
)

# AC-21: deterministic fixed taco-mascot test prompt
TEST_PROMPT_TEMPLATE = (
    'a smiling cartoon taco mascot, centered, isolated on white background, '
    '{prompt_suffix}'
)

# Default generator model for thumbnails — fast/cheap Gemini Flash variant.
DEFAULT_MODEL = 'google/gemini-2.5-flash-preview-image-generation'

# AC-24: each PNG should stay ≤ 80KB after PIL palette quantisation.
TARGET_MAX_BYTES = 80 * 1024

logging.basicConfig(
    level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s',
)
log = logging.getLogger('style-thumbs')


def _compress_to_palette(src_path: Path, dst_path: Path) -> int:
    """Re-encode ``src_path`` as a palette-quantised PNG at ``dst_path``.

    Returns final size in bytes. Aims for ≤ 80KB via 8-bit palette + PIL
    optimize=True; if still oversized, falls back to a downsized 512×512.
    """
    from PIL import Image

    with Image.open(src_path) as img:
        img = img.convert('RGB')
        palette = img.convert(
            'P', palette=Image.ADAPTIVE, colors=256,
        )
        palette.save(dst_path, 'PNG', optimize=True)

    size = dst_path.stat().st_size
    if size <= TARGET_MAX_BYTES:
        return size

    log.warning(
        'Thumbnail %s is %sKB after quantisation — retrying at 512×512',
        dst_path.name, size // 1024,
    )
    with Image.open(src_path) as img:
        img = img.convert('RGB').resize((512, 512), Image.LANCZOS)
        palette = img.convert(
            'P', palette=Image.ADAPTIVE, colors=128,
        )
        palette.save(dst_path, 'PNG', optimize=True)
    return dst_path.stat().st_size


def _generate_one(slug: str, model: str) -> None:
    suffix = STYLE_LIBRARY[slug]['prompt_suffix']
    prompt = TEST_PROMPT_TEMPLATE.format(prompt_suffix=suffix)

    log.info('Generating thumbnail for %s (model=%s)', slug, model)
    with tempfile.TemporaryDirectory() as tmpdir:
        raw_path = generate_image(
            prompt=prompt,
            model_name=model,
            output_dir=tmpdir,
            aspect_ratio='1:1',
        )
        target = THUMBNAIL_DIR / f'{slug}.png'
        size = _compress_to_palette(Path(raw_path), target)
        log.info('  → %s (%s KB)', target, size // 1024)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--slug',
        help='Regenerate a single style by slug.',
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Regenerate all thumbnails even if they already exist.',
    )
    parser.add_argument(
        '--model',
        default=DEFAULT_MODEL,
        help=f'OpenRouter model id. Default: {DEFAULT_MODEL}',
    )
    args = parser.parse_args()

    # EC-22: hard-stop before any LLM call when key is missing.
    if not getattr(settings, 'OPENROUTER_API_KEY', ''):
        log.error('OPENROUTER_API_KEY is not configured; aborting.')
        return 2

    THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)

    if args.slug:
        if args.slug not in STYLE_LIBRARY:
            log.error(
                'Unknown slug %r. Known slugs: %s',
                args.slug, ', '.join(sorted(STYLE_LIBRARY)),
            )
            return 2
        slugs = [args.slug]
    else:
        slugs = list(STYLE_LIBRARY.keys())

    failures: list[str] = []
    for slug in slugs:
        target = THUMBNAIL_DIR / f'{slug}.png'
        if target.exists() and not args.force and not args.slug:
            log.info('Skip %s — already exists (use --force to regenerate)', slug)
            continue
        try:
            _generate_one(slug, args.model)
        except Exception as exc:  # noqa: BLE001
            log.exception('Failed to generate %s: %s', slug, exc)
            failures.append(slug)

    if failures:
        log.error('Done with errors: %s failed: %s', len(failures), failures)
        return 1
    log.info('Done. Thumbnails in %s', THUMBNAIL_DIR)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
