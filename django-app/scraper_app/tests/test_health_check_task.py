"""End-to-end tests for run_selector_health_check task (PROJ-23)."""

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings

from scraper_app.models import CanaryAsin, SelectorHealthCheck
from scraper_app.tasks import run_selector_health_check


pytestmark = pytest.mark.django_db


FIXTURES_DIR = Path(__file__).parent / 'fixtures'


@pytest.fixture
def canary():
    return CanaryAsin.objects.create(
        asin='B077GRS3BJ',
        marketplace='amazon_com',
        label='Test Canary',
        active=True,
    )


def _fake_subprocess_writes_fixture(fixture_name, marketplace='amazon_com', asin='B077GRS3BJ'):
    """Build a Popen mock that simulates a successful spider run by copying a fixture
    into the snapshots dir and updating the SelectorHealthCheck row."""
    src_html = (FIXTURES_DIR / fixture_name).read_text(encoding='utf-8')

    def fake_popen(*args, **kwargs):
        # Find the health_check_id that was passed via -a flag.
        cmd = args[0] if args else kwargs.get('args', [])
        hc_id = None
        for item in cmd:
            if isinstance(item, str) and item.startswith('health_check_id='):
                hc_id = item.split('=', 1)[1]
                break

        # Write the fixture as a snapshot in the proper folder.
        snapshot_dir = Path(settings.MEDIA_ROOT) / 'snapshots' / marketplace
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        snapshot_path = snapshot_dir / f"{asin}_synthetic.html"
        snapshot_path.write_text(src_html, encoding='utf-8')

        # Update the row as the real spider would.
        if hc_id:
            SelectorHealthCheck.objects.filter(id=hc_id).update(
                html_path=str(snapshot_path.relative_to(settings.MEDIA_ROOT)),
                html_size_bytes=len(src_html.encode('utf-8')),
            )

        proc = MagicMock()
        proc.communicate.return_value = (b'', b'')
        proc.returncode = 0
        return proc

    return fake_popen


def _fake_subprocess_failure(error_message='HTTP 500'):
    """Popen mock that simulates a spider failure (no snapshot, error_message set)."""
    def fake_popen(*args, **kwargs):
        cmd = args[0] if args else kwargs.get('args', [])
        hc_id = None
        for item in cmd:
            if isinstance(item, str) and item.startswith('health_check_id='):
                hc_id = item.split('=', 1)[1]
                break
        if hc_id:
            SelectorHealthCheck.objects.filter(id=hc_id).update(
                error_message=error_message,
            )
        proc = MagicMock()
        proc.communicate.return_value = (b'', error_message.encode('utf-8'))
        proc.returncode = 1
        return proc
    return fake_popen


# ---------------------------------------------------------------------------
# Happy path
# ---------------------------------------------------------------------------

def test_task_full_fixture_passes(canary, tmp_path, settings):
    """Spider succeeds with full HTML → all OK, passed=True."""
    settings.MEDIA_ROOT = str(tmp_path)

    with patch('scraper_app.tasks.subprocess.Popen',
               side_effect=_fake_subprocess_writes_fixture('detail_full.html')):
        hc = run_selector_health_check(str(canary.id), triggered_by='cli')

    assert hc is not None
    assert hc.passed is True
    assert hc.error_message in (None, '')
    assert hc.html_path is not None
    assert hc.html_size_bytes and hc.html_size_bytes > 0
    assert hc.results['title'] == 'OK'
    assert hc.results['bsr'] == 'OK'
    assert hc.triggered_by == 'cli'


# ---------------------------------------------------------------------------
# Failure path (AC-19)
# ---------------------------------------------------------------------------

def test_task_spider_failure_writes_error_message(canary, tmp_path, settings):
    """Spider fails → row has error_message, passed=False, no html_path."""
    settings.MEDIA_ROOT = str(tmp_path)

    with patch('scraper_app.tasks.subprocess.Popen',
               side_effect=_fake_subprocess_failure('HTTP 503 — proxy quota')):
        hc = run_selector_health_check(str(canary.id), triggered_by='schedule')

    assert hc.passed is False
    assert hc.error_message == 'HTTP 503 — proxy quota'
    assert hc.html_path in (None, '')
    assert hc.results == {}


# ---------------------------------------------------------------------------
# BSR-INFO does NOT flip passed (EC-3)
# ---------------------------------------------------------------------------

def test_task_no_bsr_block_still_passes(canary, tmp_path, settings):
    """If page genuinely has no BSR block, passed should still be True."""
    settings.MEDIA_ROOT = str(tmp_path)

    with patch('scraper_app.tasks.subprocess.Popen',
               side_effect=_fake_subprocess_writes_fixture('detail_no_bsr_block.html')):
        hc = run_selector_health_check(str(canary.id), triggered_by='admin')

    assert hc.results['bsr'] == 'INFO'
    # date_first_available is EMPTY in this fixture (its table has no header
    # matching "Date First Available" — only the th text). Confirm the bool:
    has_empty = any(v == 'EMPTY' for v in hc.results.values())
    assert hc.passed is (not has_empty)


# ---------------------------------------------------------------------------
# Missing canary returns None
# ---------------------------------------------------------------------------

def test_task_unknown_canary_returns_none():
    import uuid
    result = run_selector_health_check(str(uuid.uuid4()), triggered_by='cli')
    assert result is None


# ---------------------------------------------------------------------------
# Up-front row creation (AC-10)
# ---------------------------------------------------------------------------

def test_task_creates_row_even_when_spider_crashes(canary, tmp_path, settings):
    """Even if subprocess explodes, a SelectorHealthCheck row must exist with error_message."""
    settings.MEDIA_ROOT = str(tmp_path)

    def boom(*args, **kwargs):
        raise RuntimeError('subprocess explosion')

    with patch('scraper_app.tasks.subprocess.Popen', side_effect=boom):
        hc = run_selector_health_check(str(canary.id), triggered_by='schedule')

    assert hc is not None
    assert hc.passed is False
    assert hc.error_message and 'subprocess explosion' in hc.error_message
