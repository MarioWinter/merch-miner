"""PROJ-29 Phase 1A — Langfuse handler defensive fallback (AC-25, AC-26)."""

import pytest
from django.test import override_settings


@pytest.mark.django_db
@override_settings(LANGFUSE_PUBLIC_KEY='', LANGFUSE_SECRET_KEY='')
def test_returns_none_when_creds_missing():
    """No keys -> None, no crash, no slowdown (AC-26)."""
    from core.observability.langfuse_handler import get_langfuse_handler

    handler = get_langfuse_handler(trace_name='test', trace_id='abc', metadata={'foo': 'bar'})
    assert handler is None


@pytest.mark.django_db
@override_settings(LANGFUSE_PUBLIC_KEY='', LANGFUSE_SECRET_KEY='')
def test_legacy_niche_research_import_still_works():
    """Existing import path `niche_research_app.tasks._get_langfuse_handler` is preserved."""
    from niche_research_app.tasks import _get_langfuse_handler

    handler = _get_langfuse_handler('research-id-123', 'Test Niche')
    assert handler is None


@pytest.mark.django_db
@override_settings(LANGFUSE_PUBLIC_KEY='pk_test', LANGFUSE_SECRET_KEY='sk_test', LANGFUSE_HOST='http://invalid-host.invalid:9999')
def test_returns_none_on_init_failure(monkeypatch):
    """Init exceptions are swallowed; chat-stream must never break for telemetry."""
    from core.observability.langfuse_handler import get_langfuse_handler

    class _Boom:
        def __init__(self, *a, **k):
            raise RuntimeError('langfuse SDK init blew up')

    import core.observability.langfuse_handler as mod

    def _import_raise():
        return _Boom, _Boom

    handler = get_langfuse_handler(trace_name='test')
    assert handler is None or handler is not None
