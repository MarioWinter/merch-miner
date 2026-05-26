"""PROJ-34 Phase 13m-a — every TYPOGRAPHY_OPTIONS entry has a real PNG file.

Verifies the typography-thumbnail bundle (`scripts/generate_typography_thumbnails.py`)
exists on disk under `frontend-ui/public/typography-thumbnails/`. Phase 13o-dedup
removed the duplicate Django static mirror — the frontend tree is the single
source of truth.

Inside Docker the frontend tree isn't mounted, so the test gracefully skips if
the dir can't be found. Local host + CI execute the full check.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from design_app.services.style_library import TYPOGRAPHY_OPTIONS

FRONTEND_PUBLIC = Path(__file__).resolve().parents[3] / 'frontend-ui' / 'public'
THUMB_DIR = FRONTEND_PUBLIC / 'typography-thumbnails'

# `thumbnail_path` reads `typography-thumbnails/{id}.png` (the Vite-relative
# path), so this test consumes it as-is.

_skip_if_no_frontend = pytest.mark.skipif(
    not THUMB_DIR.exists(),
    reason='frontend-ui/public/typography-thumbnails not mounted into this env',
)


@_skip_if_no_frontend
@pytest.mark.parametrize('entry', TYPOGRAPHY_OPTIONS, ids=lambda e: e['id'])
def test_every_typography_id_has_thumbnail_png(entry):
    """Each `thumbnail_path` must resolve to a real non-empty PNG file."""
    rel_path = entry['thumbnail_path']
    full_path = FRONTEND_PUBLIC / rel_path
    assert full_path.exists(), (
        f'Missing thumbnail for typography id={entry["id"]!r}: {full_path}'
    )
    assert full_path.is_file(), f'Not a file: {full_path}'
    data = full_path.read_bytes()
    assert len(data) > 0, f'Empty file: {full_path}'
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f'Not a PNG: {full_path}'


@_skip_if_no_frontend
def test_no_orphan_typography_thumbnails():
    """Every PNG on disk maps to a TYPOGRAPHY_OPTIONS id (no leftovers)."""
    on_disk = {p.stem for p in THUMB_DIR.glob('*.png')}
    declared = {e['id'] for e in TYPOGRAPHY_OPTIONS}
    orphans = on_disk - declared
    assert not orphans, f'Orphan PNGs not in TYPOGRAPHY_OPTIONS: {sorted(orphans)}'
