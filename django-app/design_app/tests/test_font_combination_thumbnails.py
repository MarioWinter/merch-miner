"""PROJ-34 Phase 13n-a — every FONT_COMBINATION_OPTIONS entry has a real PNG file.

Verifies the font-combination-thumbnail bundle produced by
`scripts/generate_font_combination_thumbnails.py` actually exists on disk under
`frontend-ui/public/font-combination-thumbnails/`, so the frontend Font
Combination picker never 404s when it requests
`/font-combination-thumbnails/{id}.png`.

Mirrors the typography-thumbnail test layout (test_typography_thumbnails.py).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from design_app.services.style_library import FONT_COMBINATION_OPTIONS

# Backend static mirror — PNGs live in BOTH
# `frontend-ui/public/font-combination-thumbnails/` (served by Vite) AND here
# under Django static (accessible to backend tests inside Docker, which doesn't
# see the frontend tree). Replace either copy in-place to swap visuals; keep
# them in sync.
DJANGO_STATIC = (
    Path(__file__).resolve().parents[1] / 'static' / 'design_app'
)

# `thumbnail_path` is recorded as "font-combination-thumbnails/{id}.png" (the
# Vite-relative path used by the frontend). On the Django side the same file
# lives under `static/design_app/thumbnails/font-combinations/{id}.png`.
_FRONTEND_TO_DJANGO = (
    'font-combination-thumbnails/', 'thumbnails/font-combinations/',
)


@pytest.mark.parametrize(
    'entry', FONT_COMBINATION_OPTIONS, ids=lambda e: e['id'],
)
def test_every_font_combination_id_has_thumbnail_png(entry):
    """Each `thumbnail_path` must resolve to a real non-empty PNG file."""
    rel_path = entry['thumbnail_path'].replace(*_FRONTEND_TO_DJANGO)
    full_path = DJANGO_STATIC / rel_path
    assert full_path.exists(), (
        f'Missing thumbnail for font_combination id={entry["id"]!r}: {full_path}'
    )
    assert full_path.is_file(), f'Not a file: {full_path}'
    data = full_path.read_bytes()
    assert len(data) > 0, f'Empty file: {full_path}'
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f'Not a PNG: {full_path}'


def test_no_orphan_font_combination_thumbnails():
    """Every PNG on disk maps to a FONT_COMBINATION_OPTIONS id (no leftovers)."""
    thumb_dir = DJANGO_STATIC / 'thumbnails' / 'font-combinations'
    if not thumb_dir.exists():
        pytest.skip('thumbnail dir not yet generated')
    on_disk = {p.stem for p in thumb_dir.glob('*.png')}
    declared = {e['id'] for e in FONT_COMBINATION_OPTIONS}
    orphans = on_disk - declared
    assert not orphans, (
        f'Orphan PNGs not in FONT_COMBINATION_OPTIONS: {sorted(orphans)}'
    )
