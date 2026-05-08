"""PROJ-27: integration tests for the AI Upscaler API endpoints."""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIClient

from design_app.models import (
    Design,
    DesignProcessingJob,
    UpscaleQuotaUsage,
    UpscalerSettings,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='upscaler@example.com', password='pw',
    )


@pytest.fixture
def staff_user(django_user_model):
    return django_user_model.objects.create_user(
        email='staff@example.com', password='pw', is_staff=True,
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='WS', slug='ws-up', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.fixture
def design(workspace):
    return Design.objects.create(
        workspace=workspace,
        status=Design.Status.PENDING,
        image_file='designs/generated/2026/05/foo.png',
    )


@pytest.fixture
def auth_client(user, workspace):
    client = APIClient()
    client.force_authenticate(user=user)
    client.credentials(HTTP_X_WORKSPACE_ID=str(workspace.id))
    return client


@pytest.fixture
def staff_client(staff_user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='Staff WS', slug='staff-ws', owner=staff_user)
    Membership.objects.create(
        workspace=ws, user=staff_user, role='admin', status='active',
    )
    client = APIClient()
    client.force_authenticate(user=staff_user)
    client.credentials(HTTP_X_WORKSPACE_ID=str(ws.id))
    return client, ws


@pytest.fixture(autouse=True)
def stub_rq(monkeypatch):
    """Stub django_rq.get_queue so tests don't hit real Redis."""
    fake_queue = MagicMock()
    fake_queue.enqueue.return_value = MagicMock(id='rq-job-id')
    monkeypatch.setattr(
        'design_app.api.upscale_views.django_rq.get_queue',
        lambda *a, **kw: fake_queue,
    )
    return fake_queue


# ---- Quota endpoint ----

class TestUpscaleQuotaView:

    def test_non_staff_default_quota(self, auth_client):
        resp = auth_client.get('/api/designs/upscale/quota/')
        assert resp.status_code == 200
        assert resp.data['used'] == 0
        assert resp.data['limit'] == 100
        assert resp.data['is_unlimited'] is False

    def test_staff_unlimited(self, staff_client):
        client, _ = staff_client
        resp = client.get('/api/designs/upscale/quota/')
        assert resp.status_code == 200
        assert resp.data['is_unlimited'] is True
        assert resp.data['limit'] is None

    def test_used_count_reflects_consumption(self, auth_client, user):
        UpscaleQuotaUsage.objects.create(
            user=user, month=date(date.today().year, date.today().month, 1), count=42,
        )
        resp = auth_client.get('/api/designs/upscale/quota/')
        assert resp.data['used'] == 42


# ---- Single-mode trigger ----

class TestUpscaleSingleView:

    def test_creates_job_and_consumes_quota(self, auth_client, design, user, stub_rq):
        resp = auth_client.post(
            f'/api/designs/{design.id}/upscale/', {}, format='json',
        )
        assert resp.status_code == 202
        assert 'job_id' in resp.data
        job = DesignProcessingJob.objects.get(pk=resp.data['job_id'])
        assert job.type == DesignProcessingJob.JobType.UPSCALE
        assert job.triggered_by_id == user.id

        usage = UpscaleQuotaUsage.objects.get(user=user)
        assert usage.count == 1
        stub_rq.enqueue.assert_called_once()

    def test_workspace_isolation(self, auth_client, user, django_user_model):
        # Design in another workspace.
        from workspace_app.models import Membership, Workspace
        other_owner = django_user_model.objects.create_user(
            email='other@example.com', password='pw',
        )
        other_ws = Workspace.objects.create(
            name='Other', slug='other-ws-up', owner=other_owner,
        )
        Membership.objects.create(
            workspace=other_ws, user=other_owner, role='admin', status='active',
        )
        other_design = Design.objects.create(
            workspace=other_ws,
            status=Design.Status.PENDING,
        )
        resp = auth_client.post(
            f'/api/designs/{other_design.id}/upscale/', {}, format='json',
        )
        assert resp.status_code == 404

    def test_409_when_job_already_running(self, auth_client, design):
        DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.RUNNING,
        )
        resp = auth_client.post(
            f'/api/designs/{design.id}/upscale/', {}, format='json',
        )
        assert resp.status_code == 409
        assert 'job_id' in resp.data

    def test_402_when_quota_exhausted(self, auth_client, design, user):
        cfg = UpscalerSettings.load()
        UpscaleQuotaUsage.objects.create(
            user=user,
            month=date(date.today().year, date.today().month, 1),
            count=cfg.monthly_quota_per_user,
        )
        resp = auth_client.post(
            f'/api/designs/{design.id}/upscale/', {}, format='json',
        )
        assert resp.status_code == 402
        assert resp.data['error'] == 'monthly_quota_exceeded'

    def test_staff_bypasses_quota(self, staff_client, stub_rq):
        client, ws = staff_client
        d = Design.objects.create(
            workspace=ws,
            status=Design.Status.PENDING,
        )
        # Even with quota maxed, staff should pass.
        resp = client.post(f'/api/designs/{d.id}/upscale/', {}, format='json')
        assert resp.status_code == 202
        # No quota row should be created for unlimited users.
        assert UpscaleQuotaUsage.objects.count() == 0

    def test_cloud_destination_requires_target(self, auth_client, design):
        resp = auth_client.post(
            f'/api/designs/{design.id}/upscale/',
            {'destination': 'cloud'},
            format='json',
        )
        assert resp.status_code == 400


# ---- Bulk trigger ----

class TestUpscaleBulkView:

    def test_bulk_creates_batch(self, auth_client, workspace, user, stub_rq):
        designs = [
            Design.objects.create(workspace=workspace, status=Design.Status.PENDING)
            for _ in range(3)
        ]
        resp = auth_client.post(
            '/api/designs/upscale/bulk/',
            {'design_ids': [str(d.id) for d in designs]},
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['batch_id']
        assert len(resp.data['jobs']) == 3
        assert UpscaleQuotaUsage.objects.get(user=user).count == 3
        assert stub_rq.enqueue.call_count == 3

    def test_bulk_rejects_cross_workspace(self, auth_client, workspace, user, django_user_model):
        from workspace_app.models import Membership, Workspace
        other_owner = django_user_model.objects.create_user(
            email='oo@example.com', password='pw',
        )
        other_ws = Workspace.objects.create(
            name='O', slug='o-ws', owner=other_owner,
        )
        Membership.objects.create(
            workspace=other_ws, user=other_owner, role='admin', status='active',
        )
        d1 = Design.objects.create(workspace=workspace, status=Design.Status.PENDING)
        d2 = Design.objects.create(workspace=other_ws, status=Design.Status.PENDING)
        resp = auth_client.post(
            '/api/designs/upscale/bulk/',
            {'design_ids': [str(d1.id), str(d2.id)]},
            format='json',
        )
        assert resp.status_code == 400
        assert resp.data['error'] == 'designs_not_in_workspace'

    def test_bulk_skips_already_upscaled_when_no_replace(
        self, auth_client, workspace, stub_rq,
    ):
        d1 = Design.objects.create(
            workspace=workspace, status=Design.Status.PENDING,
            upscaled_file='designs/upscaled/old.png',
        )
        d2 = Design.objects.create(workspace=workspace, status=Design.Status.PENDING)
        resp = auth_client.post(
            '/api/designs/upscale/bulk/',
            {'design_ids': [str(d1.id), str(d2.id)]},
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['skipped_already_upscaled'] == 1
        assert len(resp.data['jobs']) == 1

    def test_bulk_replace_overrides_skip(self, auth_client, workspace, stub_rq):
        d1 = Design.objects.create(
            workspace=workspace, status=Design.Status.PENDING,
            upscaled_file='designs/upscaled/old.png',
        )
        resp = auth_client.post(
            '/api/designs/upscale/bulk/',
            {'design_ids': [str(d1.id)], 'replace': True},
            format='json',
        )
        assert resp.status_code == 202
        assert resp.data['skipped_already_upscaled'] == 0
        assert len(resp.data['jobs']) == 1

    def test_bulk_402_when_over_quota(self, auth_client, workspace, user):
        cfg = UpscalerSettings.load()
        UpscaleQuotaUsage.objects.create(
            user=user,
            month=date(date.today().year, date.today().month, 1),
            count=cfg.monthly_quota_per_user - 1,
        )
        designs = [
            Design.objects.create(workspace=workspace, status=Design.Status.PENDING)
            for _ in range(3)
        ]
        resp = auth_client.post(
            '/api/designs/upscale/bulk/',
            {'design_ids': [str(d.id) for d in designs]},
            format='json',
        )
        assert resp.status_code == 402
        assert resp.data['error'] == 'monthly_quota_exceeded'


# ---- Batch status ----

class TestUpscaleBatchStatusView:

    def test_returns_aggregate_counts(self, auth_client, workspace):
        import uuid as _uuid

        batch = _uuid.uuid4()
        for _status in (
            DesignProcessingJob.Status.PENDING,
            DesignProcessingJob.Status.RUNNING,
            DesignProcessingJob.Status.COMPLETED,
            DesignProcessingJob.Status.FAILED,
        ):
            d = Design.objects.create(workspace=workspace, status=Design.Status.PENDING)
            DesignProcessingJob.objects.create(
                design=d,
                type=DesignProcessingJob.JobType.UPSCALE,
                status=_status,
                batch_id=batch,
            )
        resp = auth_client.get(f'/api/designs/upscale/batch/{batch}/')
        assert resp.status_code == 200
        assert resp.data['total'] == 4
        assert resp.data['completed'] == 1
        assert resp.data['failed'] == 1
        assert resp.data['pending'] == 1
        assert resp.data['running'] == 1
        assert resp.data['is_terminal'] is False

    def test_terminal_when_all_done(self, auth_client, workspace):
        import uuid as _uuid

        batch = _uuid.uuid4()
        d = Design.objects.create(workspace=workspace, status=Design.Status.PENDING)
        DesignProcessingJob.objects.create(
            design=d,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.COMPLETED,
            batch_id=batch,
        )
        resp = auth_client.get(f'/api/designs/upscale/batch/{batch}/')
        assert resp.data['is_terminal'] is True

    def test_404_for_unknown_batch(self, auth_client):
        import uuid as _uuid

        resp = auth_client.get(f'/api/designs/upscale/batch/{_uuid.uuid4()}/')
        assert resp.status_code == 404


# ---- Webhook callback ----

class TestUpscaleCallbackView:

    @patch('design_app.api.upscale_views.verify_webhook_signature')
    def test_403_on_bad_signature(self, mock_verify, client):
        from design_app.services.replicate_client import ReplicateSignatureError
        mock_verify.side_effect = ReplicateSignatureError('bad sig')
        resp = client.post(
            '/api/upscale/callback/',
            data='{"id":"x"}',
            content_type='application/json',
        )
        assert resp.status_code == 403

    @patch('design_app.api.upscale_views.verify_webhook_signature', return_value=None)
    def test_400_on_missing_fields(self, _verify, client):
        resp = client.post(
            '/api/upscale/callback/',
            data='{}',
            content_type='application/json',
        )
        assert resp.status_code == 400

    @patch('design_app.api.upscale_views.verify_webhook_signature', return_value=None)
    def test_enqueues_processing_on_valid_payload(
        self, _verify, client, stub_rq,
    ):
        resp = client.post(
            '/api/upscale/callback/',
            data='{"id":"pred-1","status":"succeeded","output":"https://r/x.png"}',
            content_type='application/json',
        )
        assert resp.status_code == 200
        assert resp.data == {'ok': True}
        # Webhook handler enqueues; one call.
        assert stub_rq.enqueue.called
