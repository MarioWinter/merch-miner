"""Tests for cross-cutting middleware."""

from unittest.mock import MagicMock

from django.test import RequestFactory

from core.middleware import RealIPMiddleware

# DRF imports are exercised in the throttle-key smoke test below — kept inside
# the test fn so module import stays light.


def test_real_ip_overrides_remote_addr_from_xff():
    """X-Forwarded-For first IP becomes REMOTE_ADDR + XFF is dropped."""
    rf = RequestFactory()
    request = rf.get('/', HTTP_X_FORWARDED_FOR='203.0.113.42, 172.20.0.4')
    request.META['REMOTE_ADDR'] = '172.20.0.4'  # the proxy's view

    get_response = MagicMock(return_value='ok')
    mw = RealIPMiddleware(get_response)
    mw(request)

    assert request.META['REMOTE_ADDR'] == '203.0.113.42'
    # XFF must be dropped so DRF SimpleRateThrottle falls back to REMOTE_ADDR
    # (DRF reads XFF directly when NUM_PROXIES is unset, ignoring REMOTE_ADDR).
    assert 'HTTP_X_FORWARDED_FOR' not in request.META


def test_real_ip_no_xff_keeps_remote_addr():
    """No X-Forwarded-For → REMOTE_ADDR unchanged."""
    rf = RequestFactory()
    request = rf.get('/')
    request.META['REMOTE_ADDR'] = '127.0.0.1'

    mw = RealIPMiddleware(MagicMock(return_value='ok'))
    mw(request)

    assert request.META['REMOTE_ADDR'] == '127.0.0.1'


def test_real_ip_strips_whitespace():
    """Leading/trailing whitespace in XFF entry is stripped."""
    rf = RequestFactory()
    request = rf.get('/', HTTP_X_FORWARDED_FOR='  203.0.113.42  , 10.0.0.1')
    request.META['REMOTE_ADDR'] = 'unused'

    mw = RealIPMiddleware(MagicMock(return_value='ok'))
    mw(request)

    assert request.META['REMOTE_ADDR'] == '203.0.113.42'


def test_real_ip_empty_xff_keeps_remote_addr():
    """Empty XFF (e.g. ', ') doesn't blank REMOTE_ADDR."""
    rf = RequestFactory()
    request = rf.get('/', HTTP_X_FORWARDED_FOR='')
    request.META['REMOTE_ADDR'] = '127.0.0.1'

    mw = RealIPMiddleware(MagicMock(return_value='ok'))
    mw(request)

    assert request.META['REMOTE_ADDR'] == '127.0.0.1'


def test_real_ip_throttle_key_uses_client_not_caddy_peer():
    """PROJ-29 Phase 1G AC-Ops-Throttle-3 / Verification 23 — smoke test the
    XFF chain ``client → Caddy(172.20.0.4) → Django`` and confirm DRF's
    ``SimpleRateThrottle.get_ident()`` resolves the throttle key to the
    *client* IP, not the Caddy container peer.

    Regression gate: if ``RealIPMiddleware`` ever stops dropping XFF, DRF
    would key throttles by the raw XFF string (effectively per-chain instead
    of per-client). This test fails loudly in that scenario.
    """
    from rest_framework.test import APIRequestFactory
    from rest_framework.throttling import SimpleRateThrottle

    rf = APIRequestFactory()
    # Simulate Caddy-proxied request: real client 1.2.3.4 hit Caddy at the
    # internal IP 172.20.0.4 which then forwarded to Django.
    request = rf.get(
        '/api/some/endpoint/',
        HTTP_X_FORWARDED_FOR='1.2.3.4, 172.20.0.4',
    )
    request.META['REMOTE_ADDR'] = '172.20.0.4'  # Caddy peer

    mw = RealIPMiddleware(MagicMock(return_value='ok'))
    mw(request)

    # Post-middleware: REMOTE_ADDR is the real client, XFF dropped.
    assert request.META['REMOTE_ADDR'] == '1.2.3.4'
    assert 'HTTP_X_FORWARDED_FOR' not in request.META

    # DRF's get_ident() reads HTTP_X_FORWARDED_FOR if present (when
    # NUM_PROXIES is set), else REMOTE_ADDR. With XFF dropped, it MUST
    # fall through to REMOTE_ADDR (which we just set to the client IP).
    throttle = SimpleRateThrottle.__new__(SimpleRateThrottle)
    # SimpleRateThrottle.get_ident accepts request-like objects.
    ident = throttle.get_ident(request)
    assert ident == '1.2.3.4', (
        f'Throttle key resolved to {ident!r}, expected client IP "1.2.3.4". '
        'If this fails, all users behind Caddy share one throttle bucket.'
    )
    # Negative: the Caddy peer IP must NEVER be the throttle key.
    assert ident != '172.20.0.4', (
        'Throttle key bound to Caddy peer IP — sitewide throttle collapse!'
    )
