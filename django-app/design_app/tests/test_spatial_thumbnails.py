"""PROJ-34 Phase 13a-ext — every SPATIAL_OPTIONS entry has a real PNG file.

Verifies the schematic-thumbnail bundle produced by
`scripts/generate_spatial_thumbnails.py` actually exists on disk under
`design_app/static/design_app/...`, so the frontend picker never 404s when
it requests `/static/design_app/thumbnails/spatial/{id}.png`.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from design_app.services.style_library import SPATIAL_OPTIONS

# Static-files root for the design_app: `design_app/static/`.
STATIC_ROOT = Path(__file__).resolve().parent.parent / 'static' / 'design_app'


@pytest.mark.parametrize('entry', SPATIAL_OPTIONS, ids=lambda e: e['id'])
def test_every_spatial_id_has_thumbnail_png(entry):
    """Each `thumbnail_path` must resolve to a real non-empty PNG file."""
    rel_path = entry['thumbnail_path']
    full_path = STATIC_ROOT / rel_path
    assert full_path.exists(), (
        f'Missing thumbnail for spatial id={entry["id"]!r}: {full_path}'
    )
    assert full_path.is_file(), f'Not a file: {full_path}'
    # Sanity: > 0 bytes and starts with the PNG magic header.
    data = full_path.read_bytes()
    assert len(data) > 0, f'Empty file: {full_path}'
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f'Not a PNG: {full_path}'


def test_no_orphan_spatial_thumbnails():
    """Every PNG on disk maps to a SPATIAL_OPTIONS id (no leftovers)."""
    thumb_dir = STATIC_ROOT / 'thumbnails' / 'spatial'
    if not thumb_dir.exists():
        pytest.skip('thumbnail dir not yet generated')
    on_disk = {p.stem for p in thumb_dir.glob('*.png')}
    declared = {e['id'] for e in SPATIAL_OPTIONS}
    orphans = on_disk - declared
    assert not orphans, f'Orphan PNGs not in SPATIAL_OPTIONS: {sorted(orphans)}'
