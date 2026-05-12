"""PROJ-29 Phase 1A — Sentry capture wrapper PII redaction (AC-Ops-Obs-2)."""

from unittest.mock import patch

import pytest
from django.test import override_settings

from core.observability.sentry import capture_chat_error


@pytest.mark.django_db
@override_settings(SENTRY_DSN='', SENTRY_INCLUDE_USER_INPUT=False)
def test_noop_when_sentry_dsn_unset():
    """Without SENTRY_DSN, capture_chat_error is a no-op (no crash)."""
    capture_chat_error(
        session_id='s1', user_id='u1',
        exception=ValueError('boom'),
        workspace_id='w1',
    )


@pytest.mark.django_db
@override_settings(SENTRY_DSN='https://fake@sentry.example/1', SENTRY_INCLUDE_USER_INPUT=False)
def test_strips_message_content_when_flag_false():
    """message_content is removed from extras when SENTRY_INCLUDE_USER_INPUT=False."""
    recorded_extras = {}

    class FakeScope:
        def set_tag(self, *a, **k):
            pass

        def set_extra(self, key, value):
            recorded_extras[key] = value

    class FakeContextManager:
        def __enter__(self):
            return FakeScope()

        def __exit__(self, *a):
            return False

    with patch('sentry_sdk.push_scope', return_value=FakeContextManager()), \
         patch('sentry_sdk.capture_exception') as captured:
        capture_chat_error(
            session_id='s1', user_id='u1',
            exception=ValueError('boom'),
            workspace_id='w1',
            niche_id='n1',
            message_content='THIS IS PRIVATE USER INPUT',
        )

    assert captured.called
    assert 'message_content' not in recorded_extras
    assert recorded_extras.get('workspace_id') == 'w1'
    assert recorded_extras.get('niche_id') == 'n1'


@pytest.mark.django_db
@override_settings(SENTRY_DSN='https://fake@sentry.example/1', SENTRY_INCLUDE_USER_INPUT=True)
def test_keeps_message_content_when_flag_true():
    """When SENTRY_INCLUDE_USER_INPUT=True, message_content is preserved."""
    recorded_extras = {}

    class FakeScope:
        def set_tag(self, *a, **k):
            pass

        def set_extra(self, key, value):
            recorded_extras[key] = value

    class FakeContextManager:
        def __enter__(self):
            return FakeScope()

        def __exit__(self, *a):
            return False

    with patch('sentry_sdk.push_scope', return_value=FakeContextManager()), \
         patch('sentry_sdk.capture_exception'):
        capture_chat_error(
            session_id='s1', user_id='u1',
            exception=ValueError('boom'),
            message_content='THIS IS PRIVATE USER INPUT',
        )

    assert recorded_extras.get('message_content') == 'THIS IS PRIVATE USER INPUT'
