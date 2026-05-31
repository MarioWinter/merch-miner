"""Tests for ``feedback_app.models``.

Covers:
  * CASCADE on workspace delete (report row goes too).
  * SET_NULL on user delete (report row stays but user reference cleared).
  * SET_NULL on screenshot delete (report row stays without screenshot).
"""

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from io import BytesIO
from PIL import Image

from feedback_app.models import BugFeatureReport, FeedbackScreenshot
from workspace_app.models import Membership, Workspace

User = get_user_model()


def _png_upload(name: str = 'shot.png') -> SimpleUploadedFile:
    img = Image.new('RGB', (32, 32), (200, 0, 0))
    buf = BytesIO()
    img.save(buf, format='PNG')
    return SimpleUploadedFile(name=name, content=buf.getvalue(), content_type='image/png')


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='reporter@example.com', password='pw', is_active=True,
    )


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='WS', slug='ws-1', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.mark.django_db
class TestBugFeatureReportLifecycle:
    def test_create_minimal_report(self, user, workspace):
        report = BugFeatureReport.objects.create(
            workspace=workspace,
            user=user,
            type=BugFeatureReport.ReportType.BUG,
            title='Crash on save',
            description='Repro: open editor, click save, app freezes.',
        )
        assert report.status == BugFeatureReport.Status.NEW
        assert report.admin_notes == ''
        assert report.screenshot is None
        assert report.created_at is not None

    def test_workspace_cascade_deletes_report(self, user, workspace):
        report = BugFeatureReport.objects.create(
            workspace=workspace,
            user=user,
            type=BugFeatureReport.ReportType.FEATURE,
            title='Dark mode toggle',
            description='Nice-to-have.',
        )
        workspace.delete()
        assert not BugFeatureReport.objects.filter(id=report.id).exists()

    def test_user_set_null_on_delete(self, workspace):
        """Deleting the report's submitter (a regular member, NOT the
        workspace owner) sets ``report.user`` to NULL while preserving the
        row + the workspace + the report itself."""
        reporter = User.objects.create_user(
            email='reporter-only@example.com', password='pw', is_active=True,
        )
        Membership.objects.create(
            workspace=workspace, user=reporter, role='member', status='active',
        )
        report = BugFeatureReport.objects.create(
            workspace=workspace,
            user=reporter,
            type=BugFeatureReport.ReportType.BUG,
            title='x',
            description='y',
        )
        reporter.delete()
        report.refresh_from_db()
        assert report.user is None
        # Row still here for historical signal.
        assert BugFeatureReport.objects.filter(id=report.id).exists()

    def test_screenshot_set_null_on_delete(self, user, workspace):
        shot = FeedbackScreenshot.objects.create(
            image=_png_upload(), uploaded_by=user,
        )
        report = BugFeatureReport.objects.create(
            workspace=workspace,
            user=user,
            type=BugFeatureReport.ReportType.BUG,
            title='x',
            description='y',
            screenshot=shot,
        )
        shot.delete()
        report.refresh_from_db()
        assert report.screenshot is None


@pytest.mark.django_db
class TestFeedbackScreenshot:
    def test_create_and_str(self, user):
        shot = FeedbackScreenshot.objects.create(
            image=_png_upload('a.png'), uploaded_by=user,
        )
        assert str(shot).startswith('FeedbackScreenshot(')
        assert shot.uploaded_at is not None

    def test_upload_path_includes_uuid(self, user):
        shot = FeedbackScreenshot.objects.create(
            image=_png_upload('a.png'), uploaded_by=user,
        )
        assert 'feedback/screenshots/' in shot.image.name
        assert str(shot.id) in shot.image.name
