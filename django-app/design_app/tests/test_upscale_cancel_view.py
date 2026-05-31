"""FIX-canvas-editor-bugs-and-image-gen Phase D:
tests for CancelUpscaleJobView.
"""

from datetime import date
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from design_app.models import (
    Design,
    DesignProcessingJob,
    UpscaleQuotaUsage,
)

pytestmark = pytest.mark.django_db


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='cancel-upscale@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='Cancel WS', slug='cancel-ws', owner=user)
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


def _month_start():
    today = date.today()
    return date(today.year, today.month, 1)


def _seed_quota(user, count: int) -> UpscaleQuotaUsage:
    return UpscaleQuotaUsage.objects.create(
        user=user, month=_month_start(), count=count,
    )


# ---- Cancel happy paths ----

class TestCancelUpscaleJobView:

    def test_cancel_pending_job_without_prediction_id(
        self, auth_client, design, user,
    ):
        _seed_quota(user, 3)
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.PENDING,
            triggered_by=user,
        )

        with patch(
            'design_app.api.views.cancel_prediction',
        ) as mock_cancel:
            resp = auth_client.post(
                f'/api/designs/upscale/jobs/{job.id}/cancel/',
                {}, format='json',
            )

        assert resp.status_code == 200
        assert resp.data['id'] == str(job.id)
        assert resp.data['status'] == DesignProcessingJob.Status.FAILED
        assert resp.data['error_message'] == 'Cancelled by user'

        job.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.FAILED
        assert job.error_message == 'Cancelled by user'
        assert job.completed_at is not None

        # Replicate API must NOT be called when prediction_id is empty.
        mock_cancel.assert_not_called()

        # Quota refunded from 3 -> 2.
        usage = UpscaleQuotaUsage.objects.get(user=user)
        assert usage.count == 2

    def test_cancel_running_job_with_prediction_id_calls_replicate(
        self, auth_client, design, user,
    ):
        _seed_quota(user, 5)
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.RUNNING,
            triggered_by=user,
            replicate_prediction_id='pred-cancel-1',
        )

        with patch(
            'design_app.api.views.cancel_prediction',
            return_value={'id': 'pred-cancel-1', 'status': 'canceled'},
        ) as mock_cancel:
            resp = auth_client.post(
                f'/api/designs/upscale/jobs/{job.id}/cancel/',
                {}, format='json',
            )

        assert resp.status_code == 200
        mock_cancel.assert_called_once_with('pred-cancel-1')

        job.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.FAILED
        assert job.error_message == 'Cancelled by user'
        assert job.completed_at is not None

        usage = UpscaleQuotaUsage.objects.get(user=user)
        assert usage.count == 4

    def test_cancel_swallows_replicate_failure(
        self, auth_client, design, user,
    ):
        _seed_quota(user, 1)
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.RUNNING,
            triggered_by=user,
            replicate_prediction_id='pred-flaky-9',
        )

        with patch(
            'design_app.api.views.cancel_prediction',
            side_effect=RuntimeError('replicate down'),
        ) as mock_cancel:
            resp = auth_client.post(
                f'/api/designs/upscale/jobs/{job.id}/cancel/',
                {}, format='json',
            )

        assert resp.status_code == 200
        mock_cancel.assert_called_once_with('pred-flaky-9')

        # Local DB still updated despite Replicate failure.
        job.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.FAILED
        assert job.error_message == 'Cancelled by user'
        assert job.completed_at is not None

        # Quota still refunded.
        usage = UpscaleQuotaUsage.objects.get(user=user)
        assert usage.count == 0

    def test_cancel_terminal_completed_is_noop(
        self, auth_client, design, user,
    ):
        _seed_quota(user, 7)
        from django.utils import timezone as _tz
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.COMPLETED,
            triggered_by=user,
            completed_at=_tz.now(),
            error_message='',
        )

        with patch(
            'design_app.api.views.cancel_prediction',
        ) as mock_cancel:
            resp = auth_client.post(
                f'/api/designs/upscale/jobs/{job.id}/cancel/',
                {}, format='json',
            )

        assert resp.status_code == 200
        assert resp.data['status'] == DesignProcessingJob.Status.COMPLETED
        assert resp.data['detail'] == 'already terminal'

        mock_cancel.assert_not_called()

        # No state change, no double-refund.
        job.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.COMPLETED
        usage = UpscaleQuotaUsage.objects.get(user=user)
        assert usage.count == 7

    def test_cancel_terminal_failed_is_noop(
        self, auth_client, design, user,
    ):
        _seed_quota(user, 4)
        from django.utils import timezone as _tz
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.FAILED,
            triggered_by=user,
            completed_at=_tz.now(),
            error_message='replicate timed out',
        )

        resp = auth_client.post(
            f'/api/designs/upscale/jobs/{job.id}/cancel/',
            {}, format='json',
        )

        assert resp.status_code == 200
        assert resp.data['detail'] == 'already terminal'
        assert resp.data['error_message'] == 'replicate timed out'

        usage = UpscaleQuotaUsage.objects.get(user=user)
        assert usage.count == 4  # no double-refund


# ---- Authz / lookup edges ----

class TestCancelUpscaleJobAuthz:

    def test_cross_workspace_returns_403(
        self, auth_client, user, django_user_model,
    ):
        from workspace_app.models import Membership, Workspace
        other_owner = django_user_model.objects.create_user(
            email='other-cancel@example.com', password='pw',
        )
        other_ws = Workspace.objects.create(
            name='Other WS', slug='other-ws-cancel', owner=other_owner,
        )
        Membership.objects.create(
            workspace=other_ws, user=other_owner, role='admin', status='active',
        )
        other_design = Design.objects.create(
            workspace=other_ws,
            status=Design.Status.PENDING,
        )
        other_job = DesignProcessingJob.objects.create(
            design=other_design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.RUNNING,
            triggered_by=other_owner,
        )

        resp = auth_client.post(
            f'/api/designs/upscale/jobs/{other_job.id}/cancel/',
            {}, format='json',
        )
        assert resp.status_code == 403

        # The other job must remain untouched.
        other_job.refresh_from_db()
        assert other_job.status == DesignProcessingJob.Status.RUNNING

    def test_unknown_job_returns_404(self, auth_client):
        import uuid as _uuid
        resp = auth_client.post(
            f'/api/designs/upscale/jobs/{_uuid.uuid4()}/cancel/',
            {}, format='json',
        )
        assert resp.status_code == 404

    def test_anonymous_returns_401(self, design, user):
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.RUNNING,
            triggered_by=user,
        )
        anon = APIClient()
        resp = anon.post(
            f'/api/designs/upscale/jobs/{job.id}/cancel/',
            {}, format='json',
        )
        assert resp.status_code == 401

    def test_cancel_without_triggered_by_skips_refund(
        self, auth_client, design, user,
    ):
        _seed_quota(user, 2)
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.RUNNING,
            triggered_by=None,
        )

        resp = auth_client.post(
            f'/api/designs/upscale/jobs/{job.id}/cancel/',
            {}, format='json',
        )
        assert resp.status_code == 200

        job.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.FAILED

        # No triggered_by => no refund attempted on the caller's quota.
        usage = UpscaleQuotaUsage.objects.get(user=user)
        assert usage.count == 2
