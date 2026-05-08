"""PROJ-27: tests for the rq task that processes Replicate webhook callbacks."""

import io
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from PIL import Image

from design_app.models import (
    Design,
    DesignProcessingJob,
    UpscaleQuotaUsage,
    UpscalerSettings,
)
from design_app.tasks import (
    enqueue_replicate_upscale,
    process_replicate_callback,
    reconcile_stuck_jobs,
)

pytestmark = pytest.mark.django_db


def _png_bytes(w=4096, h=4096):
    img = Image.new('RGBA', (w, h), (0, 200, 0, 255))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        email='cb@example.com', password='pw',
    )


@pytest.fixture
def workspace(user):
    from workspace_app.models import Membership, Workspace
    ws = Workspace.objects.create(name='WS', slug='ws-cb', owner=user)
    Membership.objects.create(workspace=ws, user=user, role='admin', status='active')
    return ws


@pytest.fixture
def design(workspace):
    return Design.objects.create(
        workspace=workspace,
        status=Design.Status.PENDING,
        image_file='designs/generated/2026/05/x.png',
    )


@pytest.fixture
def job(design, user):
    return DesignProcessingJob.objects.create(
        design=design,
        type=DesignProcessingJob.JobType.UPSCALE,
        status=DesignProcessingJob.Status.RUNNING,
        replicate_prediction_id='pred-cb-1',
        triggered_by=user,
    )


# ---- process_replicate_callback ----

class TestProcessReplicateCallback:

    @patch('design_app.tasks.httpx')
    def test_succeeded_downloads_pads_and_saves(self, mock_httpx, job, design):
        mock_resp = MagicMock(content=_png_bytes(), raise_for_status=MagicMock())
        mock_httpx.Client.return_value.__enter__.return_value.get.return_value = mock_resp

        process_replicate_callback(
            'pred-cb-1', 'succeeded', 'https://r/x.png', None,
        )

        job.refresh_from_db()
        design.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.COMPLETED
        assert job.completed_at is not None
        assert design.upscaled_file  # file saved

    def test_failed_marks_failed_and_refunds(self, job, user):
        # Pre-seed quota so the refund is observable.
        UpscaleQuotaUsage.objects.create(
            user=user,
            month=date(date.today().year, date.today().month, 1),
            count=5,
        )
        process_replicate_callback(
            'pred-cb-1', 'failed', None, 'replicate boom',
        )
        job.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.FAILED
        assert 'replicate boom' in job.error_message
        usage = UpscaleQuotaUsage.objects.get(user=user)
        assert usage.count == 4

    def test_canceled_treated_as_failed(self, job):
        process_replicate_callback(
            'pred-cb-1', 'canceled', None, 'user canceled',
        )
        job.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.FAILED

    def test_idempotent_for_duplicate_succeeded(self, job, design):
        # Pre-mark complete; duplicate webhook shouldn't re-process.
        job.status = DesignProcessingJob.Status.COMPLETED
        job.save()

        with patch('design_app.tasks.httpx') as mock_httpx:
            process_replicate_callback(
                'pred-cb-1', 'succeeded', 'https://r/x.png', None,
            )
            # No HTTP fetch attempted on dup.
            mock_httpx.Client.assert_not_called()

    def test_unknown_prediction_id_is_noop(self):
        # Should not raise; just log + return.
        process_replicate_callback(
            'pred-does-not-exist', 'succeeded', 'https://r/x.png', None,
        )

    @patch('design_app.tasks.httpx')
    def test_invalid_replicate_output_marks_failed(self, mock_httpx, job, user):
        # Return garbage bytes — Pillow raises in center_pad.
        mock_resp = MagicMock(content=b'not-a-png', raise_for_status=MagicMock())
        mock_httpx.Client.return_value.__enter__.return_value.get.return_value = mock_resp

        UpscaleQuotaUsage.objects.create(
            user=user,
            month=date(date.today().year, date.today().month, 1),
            count=3,
        )

        process_replicate_callback(
            'pred-cb-1', 'succeeded', 'https://r/x.png', None,
        )
        job.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.FAILED
        assert job.error_message == 'invalid_replicate_output'
        # Quota refunded.
        assert UpscaleQuotaUsage.objects.get(user=user).count == 2


# ---- enqueue_replicate_upscale ----

class TestEnqueueReplicateUpscale:

    @patch('design_app.tasks._build_webhook_url', return_value='https://x/api/upscale/callback/')
    @patch('design_app.tasks.start_prediction')
    def test_marks_running_and_stores_prediction_id(
        self, mock_start, _build, design, user,
    ):
        mock_start.return_value = {'id': 'pred-XYZ', 'status': 'starting'}
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.PENDING,
            triggered_by=user,
        )
        enqueue_replicate_upscale(str(job.id))
        job.refresh_from_db()
        assert job.replicate_prediction_id == 'pred-XYZ'
        assert job.status == DesignProcessingJob.Status.RUNNING

    @patch('design_app.tasks._build_webhook_url', return_value='https://x/api/upscale/callback/')
    @patch('design_app.tasks.start_prediction')
    @patch('design_app.tasks.time.sleep')
    def test_retries_then_marks_failed_and_refunds(
        self, _sleep, mock_start, _build, design, user,
    ):
        mock_start.side_effect = Exception('replicate down')
        UpscaleQuotaUsage.objects.create(
            user=user,
            month=date(date.today().year, date.today().month, 1),
            count=5,
        )
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.PENDING,
            triggered_by=user,
        )
        enqueue_replicate_upscale(str(job.id))
        job.refresh_from_db()
        assert job.status == DesignProcessingJob.Status.FAILED
        assert job.error_message == 'replicate_unavailable'
        # 3 retry attempts.
        assert mock_start.call_count == 3
        # Quota refunded.
        assert UpscaleQuotaUsage.objects.get(user=user).count == 4

    @patch('design_app.tasks.start_prediction')
    def test_idempotent_if_prediction_id_already_set(
        self, mock_start, design, user,
    ):
        job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.RUNNING,
            replicate_prediction_id='already-set',
            triggered_by=user,
        )
        enqueue_replicate_upscale(str(job.id))
        mock_start.assert_not_called()


# ---- reconcile_stuck_jobs ----

class TestReconcileStuckJobs:

    @patch('design_app.tasks.process_replicate_callback')
    @patch('design_app.tasks.get_prediction')
    def test_finds_stuck_and_reconciles(
        self, mock_get, mock_process, design, user,
    ):
        # Stuck job >5min old.
        old_job = DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.RUNNING,
            replicate_prediction_id='pred-stuck',
            triggered_by=user,
        )
        # Force created_at older than threshold.
        DesignProcessingJob.objects.filter(pk=old_job.pk).update(
            created_at=timezone.now() - timedelta(minutes=10),
        )
        mock_get.return_value = {
            'id': 'pred-stuck',
            'status': 'succeeded',
            'output': 'https://r/x.png',
            'error': None,
        }
        reconcile_stuck_jobs()
        mock_process.assert_called_once_with(
            prediction_id='pred-stuck',
            status_value='succeeded',
            output_url='https://r/x.png',
            error_message=None,
        )

    @patch('design_app.tasks.process_replicate_callback')
    @patch('design_app.tasks.get_prediction')
    def test_skips_jobs_younger_than_threshold(
        self, mock_get, mock_process, design, user,
    ):
        DesignProcessingJob.objects.create(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status=DesignProcessingJob.Status.RUNNING,
            replicate_prediction_id='pred-fresh',
            triggered_by=user,
        )
        reconcile_stuck_jobs()
        mock_get.assert_not_called()
        mock_process.assert_not_called()
