"""Tests for snapshot retention logic in scraper_app.tasks._prune_snapshots."""

from datetime import datetime, timedelta
from pathlib import Path

import pytest

from scraper_app.models import CanaryAsin, SelectorHealthCheck
from scraper_app.tasks import _prune_snapshots


pytestmark = pytest.mark.django_db


def _seed_snapshot(snapshot_dir: Path, asin: str, days_old: int) -> Path:
    """Create a snapshot file aged `days_old` days. Returns absolute path."""
    snapshot_dir.mkdir(parents=True, exist_ok=True)
    ts = (datetime.now() - timedelta(days=days_old)).strftime('%Y-%m-%dT%H-%M-%SZ')
    path = snapshot_dir / f"{asin}_{ts}.html"
    path.write_text(f'<html>old={days_old}</html>')
    # Set mtime so retention sorts correctly.
    target_ts = (datetime.now() - timedelta(days=days_old)).timestamp()
    import os
    os.utime(path, (target_ts, target_ts))
    return path


def test_prune_keeps_newest_n(tmp_path, settings):
    """15 files, keep=12 → exactly 12 newest survive, 3 oldest deleted."""
    settings.MEDIA_ROOT = str(tmp_path)
    asin = 'B011111111'
    marketplace = 'amazon_com'
    snapshot_dir = tmp_path / 'snapshots' / marketplace

    for i in range(15):
        _seed_snapshot(snapshot_dir, asin, days_old=i)

    deleted = _prune_snapshots(asin, marketplace, keep=12)
    assert deleted == 3

    remaining = list(snapshot_dir.glob(f'{asin}_*.html'))
    assert len(remaining) == 12


def test_prune_below_threshold_is_noop(tmp_path, settings):
    """5 files, keep=12 → nothing deleted."""
    settings.MEDIA_ROOT = str(tmp_path)
    asin = 'B022222222'
    marketplace = 'amazon_com'
    snapshot_dir = tmp_path / 'snapshots' / marketplace
    for i in range(5):
        _seed_snapshot(snapshot_dir, asin, days_old=i)

    deleted = _prune_snapshots(asin, marketplace, keep=12)
    assert deleted == 0
    assert len(list(snapshot_dir.glob(f'{asin}_*.html'))) == 5


def test_prune_nulls_html_path_on_pruned_rows(tmp_path, settings):
    """SelectorHealthCheck rows pointing to deleted files must have html_path=NULL."""
    settings.MEDIA_ROOT = str(tmp_path)
    asin = 'B033333333'
    marketplace = 'amazon_com'
    snapshot_dir = tmp_path / 'snapshots' / marketplace
    canary = CanaryAsin.objects.create(
        asin=asin, marketplace=marketplace, label='retention test',
    )

    paths = []
    rows = []
    for i in range(15):
        path = _seed_snapshot(snapshot_dir, asin, days_old=i)
        rel = str(path.relative_to(tmp_path))
        paths.append(rel)
        rows.append(SelectorHealthCheck.objects.create(
            canary=canary,
            html_path=rel,
            html_size_bytes=path.stat().st_size,
            results={'title': 'OK'},
            passed=True,
        ))

    _prune_snapshots(asin, marketplace, keep=12)

    # The 3 oldest rows should have html_path nulled; 12 newest retained.
    nulled = SelectorHealthCheck.objects.filter(canary=canary, html_path__isnull=True).count()
    kept = SelectorHealthCheck.objects.filter(canary=canary, html_path__isnull=False).count()
    assert nulled == 3
    assert kept == 12


def test_prune_only_touches_target_asin(tmp_path, settings):
    """Other ASINs in the same marketplace dir must not be deleted."""
    settings.MEDIA_ROOT = str(tmp_path)
    marketplace = 'amazon_com'
    snapshot_dir = tmp_path / 'snapshots' / marketplace

    for i in range(15):
        _seed_snapshot(snapshot_dir, 'BAAAAAAAAA', days_old=i)
    for i in range(5):
        _seed_snapshot(snapshot_dir, 'BBBBBBBBBB', days_old=i)

    _prune_snapshots('BAAAAAAAAA', marketplace, keep=12)

    assert len(list(snapshot_dir.glob('BAAAAAAAAA_*.html'))) == 12
    assert len(list(snapshot_dir.glob('BBBBBBBBBB_*.html'))) == 5


def test_prune_missing_directory_is_noop(tmp_path, settings):
    """Snapshot dir doesn't exist → returns 0 cleanly."""
    settings.MEDIA_ROOT = str(tmp_path)
    deleted = _prune_snapshots('B044444444', 'amazon_com', keep=12)
    assert deleted == 0


def test_prune_failure_does_not_raise(tmp_path, settings, monkeypatch):
    """Filesystem error during prune should log + return 0, never re-raise (EC-9)."""
    settings.MEDIA_ROOT = str(tmp_path)
    asin = 'B055555555'
    marketplace = 'amazon_com'
    snapshot_dir = tmp_path / 'snapshots' / marketplace
    for i in range(15):
        _seed_snapshot(snapshot_dir, asin, days_old=i)

    # Patch unlink to raise to simulate a permission error on one delete.
    original_unlink = Path.unlink
    call_count = {'n': 0}

    def flaky_unlink(self, *args, **kwargs):
        call_count['n'] += 1
        if call_count['n'] == 1:
            raise PermissionError('locked file')
        return original_unlink(self, *args, **kwargs)

    monkeypatch.setattr(Path, 'unlink', flaky_unlink)

    # Must NOT raise.
    deleted = _prune_snapshots(asin, marketplace, keep=12)
    # 3 deletions attempted, 1 failed → 2 actually deleted, no exception.
    assert deleted == 2
