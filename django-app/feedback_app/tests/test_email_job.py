"""Tests for ``feedback_app.tasks.send_feedback_email``.

Covers AC-1-7 (correct subject + body shape), AC-1-8 (SMTP failure
re-raises so django-rq retries), and EC-1-4 (graceful when row deleted
before the job runs).
"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core import mail

from feedback_app.models import BugFeatureReport
from feedback_app.tasks import (
    _build_email_body,
    _recipient_email,
    send_feedback_email,
)
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='bobby@example.com', password='pw', is_active=True,
    )


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='Demo WS', slug='demo-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def report(db, workspace, user):
    return BugFeatureReport.objects.create(
        workspace=workspace,
        user=user,
        type=BugFeatureReport.ReportType.BUG,
        title='Login button missing',
        description='After deploy the login button is gone on mobile Safari.',
    )


@pytest.mark.django_db
class TestSendFeedbackEmail:
    def test_sends_email_with_expected_subject_and_body(
        self, settings, report,
    ):
        settings.FEEDBACK_RECIPIENT_EMAIL = 'mario@example.com'
        settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
        settings.DEFAULT_FROM_EMAIL = 'noreply@example.com'

        # Run synchronously (no rq worker) by calling the underlying function.
        send_feedback_email.delay(str(report.id)) if False else send_feedback_email(
            str(report.id),
        )

        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.to == ['mario@example.com']
        assert msg.from_email == 'noreply@example.com'
        assert msg.subject == '[Merch Miner Feedback] Bug: Login button missing'
        # Plain-text body — no HTML rendering (EC-1-7).
        assert 'bobby@example.com' in msg.body
        assert 'Demo WS' in msg.body
        assert 'Login button missing' in msg.body
        assert 'After deploy' in msg.body
        assert '/admin/feedback_app/bugfeaturereport/' in msg.body

    def test_smtp_failure_reraises_for_retry(self, settings, report):
        settings.FEEDBACK_RECIPIENT_EMAIL = 'mario@example.com'
        settings.DEFAULT_FROM_EMAIL = 'noreply@example.com'

        with patch('feedback_app.tasks.send_mail', side_effect=ConnectionRefusedError('smtp down')):
            with pytest.raises(ConnectionRefusedError):
                send_feedback_email(str(report.id))

    def test_missing_report_is_noop(self, settings):
        """EC-1-4 corner: report row gone before the job runs (admin
        delete, race) → log + return, do NOT raise (no retry needed)."""
        settings.FEEDBACK_RECIPIENT_EMAIL = 'mario@example.com'
        with patch('feedback_app.tasks.send_mail') as mock_send:
            send_feedback_email('00000000-0000-0000-0000-000000000000')
            mock_send.assert_not_called()

    def test_recipient_falls_back_to_default_from_email(
        self, settings, monkeypatch,
    ):
        """When neither ``settings.FEEDBACK_RECIPIENT_EMAIL`` nor the env
        var are set, we fall back to ``DEFAULT_FROM_EMAIL`` so the email
        still goes somewhere identifiable."""
        monkeypatch.delenv('FEEDBACK_RECIPIENT_EMAIL', raising=False)
        settings.FEEDBACK_RECIPIENT_EMAIL = ''
        settings.DEFAULT_FROM_EMAIL = 'fallback@example.com'
        assert _recipient_email() == 'fallback@example.com'

    def test_body_handles_deleted_user(self, workspace):
        """SET_NULL leaves ``report.user is None`` — body must not crash."""
        report = BugFeatureReport.objects.create(
            workspace=workspace,
            user=None,
            type=BugFeatureReport.ReportType.FEATURE,
            title='Anon request',
            description='from a ghost',
        )
        body = _build_email_body(report)
        assert '(deleted user)' in body
        assert 'Anon request' in body
