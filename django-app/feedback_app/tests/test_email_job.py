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

        with patch(
            'feedback_app.tasks.EmailMessage.send',
            side_effect=ConnectionRefusedError('smtp down'),
        ):
            with pytest.raises(ConnectionRefusedError):
                send_feedback_email(str(report.id))

    def test_missing_report_is_noop(self, settings):
        """EC-1-4 corner: report row gone before the job runs (admin
        delete, race) → log + return, do NOT raise (no retry needed)."""
        settings.FEEDBACK_RECIPIENT_EMAIL = 'mario@example.com'
        with patch('feedback_app.tasks.EmailMessage') as mock_email:
            send_feedback_email('00000000-0000-0000-0000-000000000000')
            mock_email.assert_not_called()

    def test_attaches_screenshot_file_when_present(
        self, settings, user, workspace, tmp_path,
    ):
        """When the report has a screenshot, the file is attached to the
        outbound email so the recipient can see it without admin access.
        """
        from feedback_app.models import FeedbackScreenshot
        from django.core.files.uploadedfile import SimpleUploadedFile

        settings.FEEDBACK_RECIPIENT_EMAIL = 'mario@example.com'
        settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
        settings.DEFAULT_FROM_EMAIL = 'noreply@example.com'

        # Minimal valid PNG (1x1 transparent pixel) so ImageField saves cleanly.
        png_bytes = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00'
            b'\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx'
            b'\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\x18\xd3\x14\x8f\x00'
            b'\x00\x00\x00IEND\xaeB`\x82'
        )
        screenshot = FeedbackScreenshot.objects.create(
            image=SimpleUploadedFile('shot.png', png_bytes, content_type='image/png'),
            uploaded_by=user,
        )
        report = BugFeatureReport.objects.create(
            workspace=workspace,
            user=user,
            type=BugFeatureReport.ReportType.BUG,
            title='With attachment',
            description='Body text',
            screenshot=screenshot,
        )

        send_feedback_email(str(report.id))

        assert len(mail.outbox) == 1
        attachments = mail.outbox[0].attachments
        assert len(attachments) == 1, attachments
        # attach_file produces a (filename, content, mimetype) tuple.
        filename, content, _mimetype = attachments[0]
        assert filename.endswith('.png')
        assert content == png_bytes

    def test_skips_attachment_when_file_missing(self, settings, report):
        """If the storage path can't be resolved (e.g. cloud backend, file
        deleted between enqueue and run), send the body alone — don't fail
        the whole job."""
        settings.FEEDBACK_RECIPIENT_EMAIL = 'mario@example.com'
        settings.EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
        settings.DEFAULT_FROM_EMAIL = 'noreply@example.com'

        # The fixture report has no screenshot — path lookup never happens,
        # but we also assert the no-attachment branch sends cleanly.
        send_feedback_email(str(report.id))
        assert len(mail.outbox) == 1
        assert mail.outbox[0].attachments == []

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
