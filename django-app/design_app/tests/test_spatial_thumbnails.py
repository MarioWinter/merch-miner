"""PROJ-34 Phase 13o-dedup — every SPATIAL_OPTIONS entry has a real PNG file.

Verifies the LLM-rendered thumbnail bundle (`scripts/generate_spatial_thumbnails_llm.py`)
exists on disk under `frontend-ui/public/spatial-thumbnails/`. The frontend serves
these via Vite at `/spatial-thumbnails/{id}.png` directly (no Django static mirror —
Phase 13o-dedup removed the duplicate copy under `design_app/static/`).

Inside Docker the frontend tree isn't mounted, so the test gracefully skips if it
can't find the public dir. Local host runs + CI (which mounts the repo) execute
the full check.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from design_app.services.style_library import SPATIAL_OPTIONS

# Frontend public root. Layout: repo-root/frontend-ui/public/. From this file at
# repo-root/django-app/design_app/tests/, parents are:
#   …/tests/      (0)
#   …/design_app/ (1)
#   …/django-app/ (2)
#   …/repo-root/  (3)
FRONTEND_PUBLIC = Path(__file__).resolve().parents[3] / 'frontend-ui' / 'public'
THUMB_DIR = FRONTEND_PUBLIC / 'spatial-thumbnails'

# `thumbnail_path` field reads `thumbnails/spatial/{id}.png` (the Django-static-style
# path used by SPATIAL_OPTIONS for backwards-compat). The frontend mirror is
# `spatial-thumbnails/{id}.png`. Map between the two:
_BACKEND_TO_FRONTEND = ('thumbnails/spatial/', 'spatial-thumbnails/')

# Skip the suite entirely if the frontend tree isn't visible (e.g. Docker container
# without a frontend-ui bind-mount).
_skip_if_no_frontend = pytest.mark.skipif(
    not THUMB_DIR.exists(),
    reason='frontend-ui/public/spatial-thumbnails not mounted into this env',
)


@_skip_if_no_frontend
@pytest.mark.parametrize('entry', SPATIAL_OPTIONS, ids=lambda e: e['id'])
def test_every_spatial_id_has_thumbnail_png(entry):
    """Each `thumbnail_path` must resolve to a real non-empty PNG file."""
    rel_path = entry['thumbnail_path'].replace(*_BACKEND_TO_FRONTEND)
    full_path = FRONTEND_PUBLIC / rel_path
    assert full_path.exists(), (
        f'Missing thumbnail for spatial id={entry["id"]!r}: {full_path}'
    )
    assert full_path.is_file(), f'Not a file: {full_path}'
    data = full_path.read_bytes()
    assert len(data) > 0, f'Empty file: {full_path}'
    assert data[:8] == b'\x89PNG\r\n\x1a\n', f'Not a PNG: {full_path}'


@_skip_if_no_frontend
def test_no_orphan_spatial_thumbnails():
    """Every PNG on disk maps to a SPATIAL_OPTIONS id (no leftovers)."""
    on_disk = {p.stem for p in THUMB_DIR.glob('*.png')}
    declared = {e['id'] for e in SPATIAL_OPTIONS}
    orphans = on_disk - declared
    assert not orphans, f'Orphan PNGs not in SPATIAL_OPTIONS: {sorted(orphans)}'
