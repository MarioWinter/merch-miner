"""PROJ-34 Phase 13n-a — every FONT_COMBINATION_OPTIONS entry has a real PNG file.

Verifies the font-combination-thumbnail bundle
(`scripts/generate_font_combination_thumbnails.py`) exists on disk under
`frontend-ui/public/font-combination-thumbnails/`. Phase 13o-dedup removed the
duplicate Django static mirror — the frontend tree is the single source of truth.

Inside Docker the frontend tree isn't mounted, so the test gracefully skips if
the dir can't be found. Local host + CI execute the full check.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from design_app.services.style_library import FONT_COMBINATION_OPTIONS

FRONTEND_PUBLIC = Path(__file__).resolve().parents[3] / 'frontend-ui' / 'public'
THUMB_DIR = FRONTEND_PUBLIC / 'font-combination-thumbnails'

_skip_if_no_frontend = pytest.mark.skipif(
    not THUMB_DIR.exists(),
    reason='frontend-ui/public/font-combination-thumbnails not mounted into this env',
)


@_skip_if_no_frontend
@pytest.mark.parametrize(
    'entry', FONT_COMBINATION_OPTIONS, ids=lambda e: e['id'],
)
def test_every_font_combination_id_has_thumbnail_png(entry):
    """Each `thumbnail_path` must resolve to a real non-empty PNG file."""
    rel_path = entry['thumbnail_path']
    full_path = FRONTEND_PUBLIC / rel_path
    assert full_path.exists(), (
        f'Missing thumbnail for font_combination id={entry["id"]!r}: {full_path}'
    )
    assert full_path.is_file(), f'Not a file: {full_path}'
    data = full_path.read_bytes()
    assert len(data) > 0, f'Empty file: {full_path}'
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f'Not a PNG: {full_path}'


@_skip_if_no_frontend
def test_no_orphan_font_combination_thumbnails():
    """Every PNG on disk maps to a FONT_COMBINATION_OPTIONS id (no leftovers)."""
    on_disk = {p.stem for p in THUMB_DIR.glob('*.png')}
    declared = {e['id'] for e in FONT_COMBINATION_OPTIONS}
    orphans = on_disk - declared
    assert not orphans, (
        f'Orphan PNGs not in FONT_COMBINATION_OPTIONS: {sorted(orphans)}'
    )
