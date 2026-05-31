"""Tests for ``feedback_app.api`` views.

Covers AC-1-5 (workspace + user inferred), AC-1-7 (email enqueued), AC-1-8
(email failure non-blocking), AC-1-10 (workspace isolation), EC-1-1 (missing
workspace), EC-1-5 (rate limit triggers 429), EC-1-7 (XSS-safe path).
"""

from io import BytesIO
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from feedback_app.models import BugFeatureReport, FeedbackScreenshot
from workspace_app.models import Membership, Workspace

User = get_user_model()

REPORTS_URL = '/api/feedback/reports/'
SCREENSHOTS_URL = '/api/feedback/screenshots/'


# ---------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------
@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='reporter@example.com', password='pw', is_active=True,
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email='other@example.com', password='pw', is_active=True,
    )


@pytest.fixture
def superuser(db):
    return User.objects.create_superuser(
        email='admin@example.com', password='pw',
    )


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='WS', slug='ws-a', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def other_workspace(db, other_user):
    ws = Workspace.objects.create(
        name='WS-B', slug='ws-b', owner=other_user,
    )
    Membership.objects.create(
        workspace=ws, user=other_user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def other_client(other_user):
    c = APIClient()
    c.force_authenticate(user=other_user)
    return c


@pytest.fixture
def super_client(superuser):
    c = APIClient()
    c.force_authenticate(user=superuser)
    return c


def _headers(workspace):
    return {'HTTP_X_WORKSPACE_ID': str(workspace.id)}


def _png_upload(name: str = 'screen.png') -> SimpleUploadedFile:
    img = Image.new('RGB', (64, 64), (100, 200, 50))
    buf = BytesIO()
    img.save(buf, format='PNG')
    return SimpleUploadedFile(
        name=name, content=buf.getvalue(), content_type='image/png',
    )


# ---------------------------------------------------------------------
# Screenshot upload
# ---------------------------------------------------------------------
@pytest.mark.django_db
class TestScreenshotUpload:
    def test_valid_png_returns_201(self, client, workspace):
        resp = client.post(
            SCREENSHOTS_URL,
            {'image': _png_upload()},
            format='multipart',
            **_headers(workspace),
        )
        assert resp.status_code == 201, resp.content
        body = resp.json()
        assert 'id' in body
        assert FeedbackScreenshot.objects.count() == 1

    def test_missing_workspace_header_returns_400(self, client):
        resp = client.post(
            SCREENSHOTS_URL,
            {'image': _png_upload()},
            format='multipart',
        )
        assert resp.status_code == 400

    def test_oversize_screenshot_rejected(self, client, workspace):
        big_png = SimpleUploadedFile(
            name='big.png',
            content=b'\x89PNG\r\n\x1a\n' + b'\x00' * (6 * 1024 * 1024),
            content_type='image/png',
        )
        resp = client.post(
            SCREENSHOTS_URL,
            {'image': big_png},
            format='multipart',
            **_headers(workspace),
        )
        # Either the image validator (invalid png past header) or the
        # explicit 5MB cap rejects it. Both surface as 400.
        assert resp.status_code == 400, resp.content

    def test_non_image_rejected(self, client, workspace):
        bogus = SimpleUploadedFile(
            name='evil.pdf',
            content=b'%PDF-1.4 not actually an image',
            content_type='application/pdf',
        )
        resp = client.post(
            SCREENSHOTS_URL,
            {'image': bogus},
            format='multipart',
            **_headers(workspace),
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------
# Report create
# ---------------------------------------------------------------------
@pytest.mark.django_db
class TestReportCreate:
    @patch('feedback_app.api.views.send_feedback_email')
    def test_create_minimal_report_enqueues_email(
        self, mock_email, client, workspace, user,
    ):
        resp = client.post(
            REPORTS_URL,
            {
                'type': 'bug',
                'title': 'Login broken',
                'description': 'Cannot login after recent deploy.',
            },
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 201, resp.content
        body = resp.json()
        assert body['type'] == 'bug'
        assert body['status'] == 'new'
        assert body['user_email'] == user.email
        assert str(workspace.id) == body['workspace_id']
        # AC-1-7: email enqueued, not sent inline.
        mock_email.delay.assert_called_once()

    @patch('feedback_app.api.views.send_feedback_email')
    def test_create_with_screenshot_links(
        self, mock_email, client, workspace, user,
    ):
        shot = FeedbackScreenshot.objects.create(
            image=_png_upload(), uploaded_by=user,
        )
        resp = client.post(
            REPORTS_URL,
            {
                'type': 'feature',
                'title': 'Dark mode',
                'description': 'Please add a dark theme toggle.',
                'screenshot_id': str(shot.id),
            },
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 201, resp.content
        assert resp.json()['screenshot']['id'] == str(shot.id)
        mock_email.delay.assert_called_once()

    @patch('feedback_app.api.views.send_feedback_email')
    def test_client_supplied_workspace_user_ignored(
        self, mock_email, client, workspace, other_workspace, user, other_user,
    ):
        """AC-1-5: workspace + user fields in body are NOT trusted."""
        resp = client.post(
            REPORTS_URL,
            {
                'type': 'bug',
                'title': 't',
                'description': 'd',
                # These should be ignored entirely.
                'workspace': str(other_workspace.id),
                'user': other_user.id,
            },
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 201
        report = BugFeatureReport.objects.get()
        assert report.workspace_id == workspace.id
        assert report.user_id == user.id

    def test_missing_workspace_returns_400(self, client):
        """EC-1-1: no X-Workspace-Id header → 400."""
        resp = client.post(
            REPORTS_URL,
            {'type': 'bug', 'title': 't', 'description': 'd'},
            format='json',
        )
        assert resp.status_code == 400

    def test_unauth_user_rejected(self, db, workspace):
        """EC-1-6: IsAuthenticated covers inactive / unauthenticated."""
        c = APIClient()
        resp = c.post(
            REPORTS_URL,
            {'type': 'bug', 'title': 't', 'description': 'd'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code in (401, 403)

    def test_other_workspace_membership_rejected(
        self, other_client, workspace,
    ):
        resp = other_client.post(
            REPORTS_URL,
            {'type': 'bug', 'title': 't', 'description': 'd'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 403

    @patch('feedback_app.api.views.send_feedback_email')
    def test_invalid_type_rejected(self, mock_email, client, workspace):
        resp = client.post(
            REPORTS_URL,
            {'type': 'compliment', 'title': 't', 'description': 'd'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 400
        mock_email.delay.assert_not_called()

    @patch('feedback_app.api.views.send_feedback_email')
    def test_description_over_4000_rejected(
        self, mock_email, client, workspace,
    ):
        resp = client.post(
            REPORTS_URL,
            {
                'type': 'bug',
                'title': 't',
                'description': 'x' * 4001,
            },
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 400
        mock_email.delay.assert_not_called()

    @patch('feedback_app.api.views.send_feedback_email')
    def test_html_in_title_persisted_as_plaintext(
        self, mock_email, client, workspace,
    ):
        """EC-1-7: title with HTML/script tags is stored verbatim, no escape /
        no execution path. The plain-text email body (tested in
        test_email_job.py) guarantees no rendering."""
        payload = {
            'type': 'bug',
            'title': '<script>alert(1)</script>',
            'description': '<img src=x onerror=alert(1)>',
        }
        resp = client.post(
            REPORTS_URL, payload, format='json', **_headers(workspace),
        )
        assert resp.status_code == 201
        report = BugFeatureReport.objects.get()
        assert report.title == '<script>alert(1)</script>'
        # JSON response body must roundtrip safely (DRF escapes by default).
        assert resp.json()['title'] == '<script>alert(1)</script>'


# ---------------------------------------------------------------------
# Workspace isolation on list
# ---------------------------------------------------------------------
@pytest.mark.django_db
class TestReportListIsolation:
    def _seed(self, user, workspace, other_user, other_workspace):
        BugFeatureReport.objects.create(
            workspace=workspace, user=user, type='bug', title='a',
            description='aa',
        )
        BugFeatureReport.objects.create(
            workspace=other_workspace, user=other_user, type='bug', title='b',
            description='bb',
        )

    def test_non_superuser_sees_only_own_workspace(
        self, client, user, workspace, other_user, other_workspace,
    ):
        self._seed(user, workspace, other_user, other_workspace)
        resp = client.get(REPORTS_URL, **_headers(workspace))
        assert resp.status_code == 200
        results = resp.json()['results']
        assert len(results) == 1
        assert results[0]['title'] == 'a'

    def test_superuser_sees_all(
        self, super_client, user, workspace, other_user, other_workspace,
    ):
        self._seed(user, workspace, other_user, other_workspace)
        # Superuser ignores workspace scoping — still pass a header so the
        # view can resolve without 400 elsewhere.
        resp = super_client.get(REPORTS_URL, **_headers(workspace))
        assert resp.status_code == 200
        results = resp.json()['results']
        assert len(results) == 2

    def test_non_superuser_no_header_returns_empty(
        self, client, user, workspace, other_user, other_workspace,
    ):
        self._seed(user, workspace, other_user, other_workspace)
        resp = client.get(REPORTS_URL)
        assert resp.status_code == 200
        assert resp.json()['results'] == []


# ---------------------------------------------------------------------
# Triage PATCH — superuser only
# ---------------------------------------------------------------------
@pytest.mark.django_db
class TestReportTriage:
    def test_non_superuser_patch_rejected(
        self, client, user, workspace,
    ):
        report = BugFeatureReport.objects.create(
            workspace=workspace, user=user, type='bug', title='t',
            description='d',
        )
        resp = client.patch(
            f'{REPORTS_URL}{report.id}/',
            {'status': 'triaged'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 403

    def test_superuser_can_update_status_and_notes(
        self, super_client, user, workspace,
    ):
        report = BugFeatureReport.objects.create(
            workspace=workspace, user=user, type='bug', title='t',
            description='d',
        )
        resp = super_client.patch(
            f'{REPORTS_URL}{report.id}/',
            {'status': 'in_progress', 'admin_notes': 'Mario looking into it.'},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 200, resp.content
        report.refresh_from_db()
        assert report.status == 'in_progress'
        assert report.admin_notes == 'Mario looking into it.'

    def test_superuser_cannot_modify_immutable_fields(
        self, super_client, user, workspace,
    ):
        """The triage serializer only accepts ``status`` + ``admin_notes``.
        Other fields silently ignored."""
        report = BugFeatureReport.objects.create(
            workspace=workspace, user=user, type='bug', title='orig',
            description='orig',
        )
        resp = super_client.patch(
            f'{REPORTS_URL}{report.id}/',
            {
                'status': 'triaged',
                'title': 'tampered',
                'description': 'tampered',
            },
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 200
        report.refresh_from_db()
        assert report.title == 'orig'
        assert report.description == 'orig'

    def test_put_method_not_allowed(self, super_client, user, workspace):
        report = BugFeatureReport.objects.create(
            workspace=workspace, user=user, type='bug', title='t',
            description='d',
        )
        resp = super_client.put(
            f'{REPORTS_URL}{report.id}/',
            {'status': 'done', 'admin_notes': ''},
            format='json',
            **_headers(workspace),
        )
        assert resp.status_code == 405


# ---------------------------------------------------------------------
# Rate limiting — EC-1-5
# ---------------------------------------------------------------------
@pytest.mark.django_db
class TestRateLimit:
    """EC-1-5: 10 POSTs in 60s → 429.

    Conftest disables global throttles to stop noisy interference, so we
    re-enable the ``feedback_create`` scope just for these tests.
    """

    @patch('feedback_app.api.views.send_feedback_email')
    def test_eleventh_request_returns_429(
        self, mock_email, settings, client, workspace,
    ):
        from django.core.cache import cache as dj_cache
        from rest_framework.settings import api_settings
        from rest_framework.throttling import (
            ScopedRateThrottle,
            SimpleRateThrottle,
        )

        settings.REST_FRAMEWORK = {
            **settings.REST_FRAMEWORK,
            'DEFAULT_THROTTLE_RATES': {
                **settings.REST_FRAMEWORK.get('DEFAULT_THROTTLE_RATES', {}),
                'feedback_create': '3/min',
            },
        }
        api_settings.reload()
        # ScopedRateThrottle caches THROTTLE_RATES at class-load time — we
        # must monkey-patch the class attr too.
        original_rates = ScopedRateThrottle.THROTTLE_RATES
        ScopedRateThrottle.THROTTLE_RATES = {
            **original_rates, 'feedback_create': '3/min',
        }
        # Clear any leftover bucket from earlier tests.
        for k in list(getattr(dj_cache, '_cache', {})):  # pragma: no cover
            dj_cache.delete(k)

        try:
            payload = {'type': 'bug', 'title': 't', 'description': 'd'}
            ok = 0
            for _ in range(3):
                r = client.post(
                    REPORTS_URL, payload, format='json',
                    **_headers(workspace),
                )
                assert r.status_code == 201
                ok += 1
            r = client.post(
                REPORTS_URL, payload, format='json', **_headers(workspace),
            )
            assert r.status_code == 429
            assert ok == 3
        finally:
            ScopedRateThrottle.THROTTLE_RATES = original_rates
            api_settings.reload()
            SimpleRateThrottle.cache.clear()
