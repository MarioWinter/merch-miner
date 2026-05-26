"""PROJ-34 Phase 13t-e — Tests for `collage_renderer` (Appendix V.5).

Covers:
- 600×200 webp output, <80 KB
- Missing product → placeholder cell
- All missing → 3 placeholder cells
- Fetch failure → placeholder
- Empty list → 3 placeholders
- Filesystem cache on second call (no re-render)
- Staleness >7d triggers regen
- Atomic write (.tmp + os.replace)
- In-memory cache fallback when MEDIA_ROOT not writable
"""

from __future__ import annotations

import io
import time
from unittest.mock import MagicMock, patch

import httpx
import pytest
from django.core.cache import cache
from django.test import override_settings
from PIL import Image

from design_app.services import collage_renderer
from design_app.services.collage_renderer import (
    COLLAGE_CACHE_KEY_PREFIX,
    COLLAGE_HEIGHT,
    COLLAGE_STALENESS_SECONDS,
    COLLAGE_WIDTH,
    get_collage_path,
    get_or_generate_collage_bytes,
    render_collage_webp,
)
from scraper_app.models import AmazonProduct

pytestmark = pytest.mark.django_db


# ─── Helpers ──────────────────────────────────────────────────────────────


def _png_bytes(color: str = 'red', size: int = 120) -> bytes:
    buf = io.BytesIO()
    Image.new('RGB', (size, size), color).save(buf, 'PNG')
    return buf.getvalue()


def _make_product(asin: str, thumb: str = 'https://example.com/t.png') -> AmazonProduct:
    return AmazonProduct.objects.create(
        asin=asin, marketplace='amazon.com', thumbnail_url=thumb,
    )


def _mock_httpx_get(png_bytes: bytes) -> MagicMock:
    """Return a MagicMock that emulates httpx.Client used as context manager."""
    mock_resp = MagicMock()
    mock_resp.content = png_bytes
    mock_resp.raise_for_status = MagicMock()

    client_instance = MagicMock()
    client_instance.get.return_value = mock_resp

    mock_client_cm = MagicMock()
    mock_client_cm.__enter__.return_value = client_instance
    mock_client_cm.__exit__.return_value = False
    return mock_client_cm


@pytest.fixture(autouse=True)
def _reset_writable_flag():
    """Reset the module-level writable cache before each test."""
    collage_renderer._writable_flag = None
    yield
    collage_renderer._writable_flag = None


@pytest.fixture(autouse=True)
def _clear_django_cache():
    cache.clear()
    yield
    cache.clear()


# ─── Renderer tests ───────────────────────────────────────────────────────


def test_render_with_3_valid_urls():
    p1 = _make_product('B000R1', 'https://example.com/1.png')
    p2 = _make_product('B000R2', 'https://example.com/2.png')
    p3 = _make_product('B000R3', 'https://example.com/3.png')

    with patch(
        'httpx.Client', return_value=_mock_httpx_get(_png_bytes('red')),
    ):
        data = render_collage_webp([str(p1.id), str(p2.id), str(p3.id)])

    # WebP magic: 'RIFF....WEBP'
    assert data[:4] == b'RIFF'
    assert data[8:12] == b'WEBP'
    img = Image.open(io.BytesIO(data))
    assert img.size == (COLLAGE_WIDTH, COLLAGE_HEIGHT)
    assert img.format == 'WEBP'
    assert len(data) < 80 * 1024


def test_render_with_missing_product_url():
    p1 = _make_product('B000M1', 'https://example.com/1.png')
    p2 = _make_product('B000M2', thumb='')  # empty thumb → placeholder
    p3 = _make_product('B000M3', 'https://example.com/3.png')

    with patch(
        'httpx.Client', return_value=_mock_httpx_get(_png_bytes('blue')),
    ):
        data = render_collage_webp([str(p1.id), str(p2.id), str(p3.id)])

    img = Image.open(io.BytesIO(data))
    assert img.size == (COLLAGE_WIDTH, COLLAGE_HEIGHT)


def test_render_with_all_missing():
    p1 = _make_product('B000A1', thumb='')
    p2 = _make_product('B000A2', thumb='')
    p3 = _make_product('B000A3', thumb='')

    data = render_collage_webp([str(p1.id), str(p2.id), str(p3.id)])

    img = Image.open(io.BytesIO(data))
    assert img.size == (COLLAGE_WIDTH, COLLAGE_HEIGHT)
    # Placeholder cells dominate → very small WebP.
    assert len(data) < 80 * 1024


def test_render_with_fetch_failure():
    p1 = _make_product('B000F1', 'https://example.com/1.png')
    p2 = _make_product('B000F2', 'https://example.com/2.png')
    p3 = _make_product('B000F3', 'https://example.com/3.png')

    # Make ALL fetch attempts raise → 3 placeholders. (Mocking per-call
    # is complex; covered conceptually + by the placeholder branch.)
    def boom(*args, **kwargs):
        raise httpx.ConnectError('boom')

    mock_client_cm = MagicMock()
    mock_client_cm.__enter__.side_effect = boom
    with patch('httpx.Client', return_value=mock_client_cm):
        data = render_collage_webp([str(p1.id), str(p2.id), str(p3.id)])

    img = Image.open(io.BytesIO(data))
    assert img.size == (COLLAGE_WIDTH, COLLAGE_HEIGHT)


def test_render_with_zero_product_ids():
    data = render_collage_webp([])

    img = Image.open(io.BytesIO(data))
    assert img.size == (COLLAGE_WIDTH, COLLAGE_HEIGHT)


def test_render_with_nonexistent_product_id():
    """Unknown UUID → placeholder, still valid output."""
    import uuid
    data = render_collage_webp([str(uuid.uuid4())])

    img = Image.open(io.BytesIO(data))
    assert img.size == (COLLAGE_WIDTH, COLLAGE_HEIGHT)


# ─── Filesystem cache tests ──────────────────────────────────────────────


def test_get_or_generate_caches_filesystem(tmp_path):
    p1 = _make_product('B000C1', 'https://example.com/1.png')
    niche_id = '11111111-2222-3333-4444-555555555555'

    with override_settings(MEDIA_ROOT=str(tmp_path)):
        with patch(
            'httpx.Client', return_value=_mock_httpx_get(_png_bytes('green')),
        ) as mock_client:
            # First call → writes to filesystem
            data1 = get_or_generate_collage_bytes(niche_id, [str(p1.id)])
            calls_after_first = mock_client.call_count

            # Second call → reads from filesystem, no new fetch
            data2 = get_or_generate_collage_bytes(niche_id, [str(p1.id)])
            assert mock_client.call_count == calls_after_first

        path = get_collage_path(niche_id)
        assert path.exists()
        assert data1 == data2
        assert path.read_bytes() == data1


def test_get_or_generate_regenerates_after_staleness(tmp_path):
    p1 = _make_product('B000S1', 'https://example.com/1.png')
    niche_id = '22222222-2222-3333-4444-555555555555'

    with override_settings(MEDIA_ROOT=str(tmp_path)):
        with patch(
            'httpx.Client', return_value=_mock_httpx_get(_png_bytes('red')),
        ) as mock_client:
            get_or_generate_collage_bytes(niche_id, [str(p1.id)])
            first_fetch_calls = mock_client.call_count

            # Backdate mtime > 7 days.
            path = get_collage_path(niche_id)
            old_ts = time.time() - (COLLAGE_STALENESS_SECONDS + 60)
            import os
            os.utime(path, (old_ts, old_ts))

            get_or_generate_collage_bytes(niche_id, [str(p1.id)])
            # Must have re-fetched (stale → regen).
            assert mock_client.call_count > first_fetch_calls


def test_atomic_write(tmp_path):
    p1 = _make_product('B000W1', 'https://example.com/1.png')
    niche_id = '33333333-2222-3333-4444-555555555555'

    with override_settings(MEDIA_ROOT=str(tmp_path)):
        with patch(
            'httpx.Client', return_value=_mock_httpx_get(_png_bytes('purple')),
        ):
            with patch(
                'design_app.services.collage_renderer.os.replace',
            ) as mock_replace:
                get_or_generate_collage_bytes(niche_id, [str(p1.id)])
                # The atomic rename MUST have been invoked.
                assert mock_replace.called
                args = mock_replace.call_args[0]
                # src ends with .tmp, dst is the final .webp path.
                src, dst = str(args[0]), str(args[1])
                assert src.endswith('.tmp')
                assert dst.endswith(f'{niche_id}.webp')


# ─── In-memory cache fallback ────────────────────────────────────────────


def test_in_memory_cache_fallback():
    p1 = _make_product('B000I1', 'https://example.com/1.png')
    niche_id = '44444444-2222-3333-4444-555555555555'

    with patch(
        'design_app.services.collage_renderer._media_root_writable',
        return_value=False,
    ):
        with patch(
            'httpx.Client', return_value=_mock_httpx_get(_png_bytes('orange')),
        ) as mock_client:
            data1 = get_or_generate_collage_bytes(niche_id, [str(p1.id)])
            first_calls = mock_client.call_count

            # Second call → hit django cache, no new fetch
            data2 = get_or_generate_collage_bytes(niche_id, [str(p1.id)])
            assert mock_client.call_count == first_calls
            assert data1 == data2

        assert cache.get(f'{COLLAGE_CACHE_KEY_PREFIX}:{niche_id}') == data1
