"""Tests for cross-cutting middleware."""

from unittest.mock import MagicMock

from django.test import RequestFactory

from core.middleware import RealIPMiddleware


def test_real_ip_overrides_remote_addr_from_xff():
    """X-Forwarded-For first IP becomes REMOTE_ADDR."""
    rf = RequestFactory()
    request = rf.get('/', HTTP_X_FORWARDED_FOR='203.0.113.42, 172.20.0.4')
    request.META['REMOTE_ADDR'] = '172.20.0.4'  # the proxy's view

    get_response = MagicMock(return_value='ok')
    mw = RealIPMiddleware(get_response)
    mw(request)

    assert request.META['REMOTE_ADDR'] == '203.0.113.42'


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
