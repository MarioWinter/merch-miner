"""DRF views for the PROJ-27 AI Upscaler endpoints.

Five endpoints (per spec / tech design):
  - POST /api/designs/<uuid:design_id>/upscale/   single-mode trigger
  - POST /api/designs/upscale/bulk/               bulk-mode trigger
  - GET  /api/designs/upscale/batch/<uuid>/       per-batch poll
  - GET  /api/designs/upscale/quota/              user's monthly quota
  - POST /api/upscale/callback/                   Replicate webhook
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import date

import django_rq
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from design_app.api.serializers import (
    BatchStatusSerializer,
    UpscaleBulkTriggerSerializer,
    UpscaleJobSerializer,
    UpscaleQuotaSerializer,
    UpscaleSingleTriggerSerializer,
)
from design_app.api.views import _require_workspace, _ws_error  # reuse helper
from design_app.models import (
    Design,
    DesignProcessingJob,
    UpscaleQuotaUsage,
    UpscalerSettings,
)
from design_app.tasks import enqueue_replicate_upscale, process_replicate_callback
from design_app.services.replicate_client import (
    ReplicateConfigError,
    ReplicateSignatureError,
    verify_webhook_signature,
)

logger = logging.getLogger(__name__)


# ----------------------------------------
# Quota helpers
# ----------------------------------------

def _month_start(today: date | None = None) -> date:
    today = today or timezone.now().date()
    return date(today.year, today.month, 1)


def _next_month_start(today: date | None = None) -> date:
    today = today or timezone.now().date()
    if today.month == 12:
        return date(today.year + 1, 1, 1)
    return date(today.year, today.month + 1, 1)


def _is_unlimited(user, cfg: UpscalerSettings) -> bool:
    return cfg.staff_unlimited and (user.is_staff or user.is_superuser)


def _quota_state(user, cfg: UpscalerSettings) -> dict:
    """Return {used, limit, resets_on, is_unlimited} dict."""
    if _is_unlimited(user, cfg):
        return {
            'used': 0,
            'limit': None,
            'resets_on': _next_month_start(),
            'is_unlimited': True,
        }
    month_start = _month_start()
    usage = (
        UpscaleQuotaUsage.objects
        .filter(user=user, month=month_start)
        .first()
    )
    used = usage.count if usage else 0
    return {
        'used': used,
        'limit': cfg.monthly_quota_per_user,
        'resets_on': _next_month_start(),
        'is_unlimited': False,
    }


def _quota_402(user, cfg: UpscalerSettings, *, requested: int = 1):
    state = _quota_state(user, cfg)
    return Response(
        {
            'error': 'monthly_quota_exceeded',
            'used': state['used'],
            'limit': state['limit'],
            'resets_on': state['resets_on'],
            'requested': requested,
        },
        status=status.HTTP_402_PAYMENT_REQUIRED,
    )


def _consume_quota(user, n: int = 1) -> None:
    """Atomically increment the user's quota counter for the current month."""
    from django.db.models import F

    month_start = _month_start()
    obj, created = UpscaleQuotaUsage.objects.get_or_create(
        user=user, month=month_start, defaults={'count': n},
    )
    if not created:
        UpscaleQuotaUsage.objects.filter(pk=obj.pk).update(count=F('count') + n)


# ----------------------------------------
# Single-mode trigger
# ----------------------------------------

class UpscaleSingleView(APIView):
    """POST /api/designs/<uuid:design_id>/upscale/."""

    def post(self, request, design_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        design = get_object_or_404(
            Design.objects.select_related('workspace'),
            pk=design_id,
            workspace_id=ws_id,
        )

        serializer = UpscaleSingleTriggerSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        body = serializer.validated_data

        cfg = UpscalerSettings.load()

        # EC-1: don't double-fire on a job that's already pending/running.
        active = DesignProcessingJob.objects.filter(
            design=design,
            type=DesignProcessingJob.JobType.UPSCALE,
            status__in=(
                DesignProcessingJob.Status.PENDING,
                DesignProcessingJob.Status.RUNNING,
            ),
        ).first()
        if active:
            return Response(
                {
                    'error': 'upscale_already_in_progress',
                    'job_id': str(active.id),
                    'status': active.status,
                },
                status=status.HTTP_409_CONFLICT,
            )

        # AC-21 / AC-23: quota enforcement (counted at submission).
        if not _is_unlimited(request.user, cfg):
            state = _quota_state(request.user, cfg)
            if state['used'] >= (state['limit'] or 0):
                return _quota_402(request.user, cfg, requested=1)

        # AC-8: replace guard — silently overwrites; frontend handles the
        # confirm dialog. We don't refuse here because re-upscale is allowed.

        with transaction.atomic():
            cloud_target = body.get('cloud_target') or {}
            if body.get('destination') != 'cloud':
                cloud_target = {}

            job = DesignProcessingJob.objects.create(
                design=design,
                type=DesignProcessingJob.JobType.UPSCALE,
                status=DesignProcessingJob.Status.PENDING,
                triggered_by=request.user,
                cloud_target=cloud_target,
            )
            if not _is_unlimited(request.user, cfg):
                _consume_quota(request.user, 1)

        queue = django_rq.get_queue('design')
        rq_job = queue.enqueue(enqueue_replicate_upscale, str(job.id))
        job.rq_job_id = rq_job.id
        job.save(update_fields=['rq_job_id'])

        return Response(
            {
                'job_id': str(job.id),
                'design_id': str(design.id),
                'status': job.status,
                'replicate_prediction_id': job.replicate_prediction_id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


# ----------------------------------------
# Bulk-mode trigger
# ----------------------------------------

class UpscaleBulkView(APIView):
    """POST /api/designs/upscale/bulk/."""

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = UpscaleBulkTriggerSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        body = serializer.validated_data

        design_ids = body['design_ids']
        replace_flag = body.get('replace', False)

        # AC-10: validate workspace ownership for all IDs (EC-5).
        designs_qs = Design.objects.filter(
            id__in=design_ids, workspace_id=ws_id,
        )
        designs = list(designs_qs)
        if len(designs) != len(set(design_ids)):
            return Response(
                {'error': 'designs_not_in_workspace'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Filter out designs with active in-progress upscales (EC-1).
        in_progress_ids = set(
            DesignProcessingJob.objects.filter(
                design_id__in=design_ids,
                type=DesignProcessingJob.JobType.UPSCALE,
                status__in=(
                    DesignProcessingJob.Status.PENDING,
                    DesignProcessingJob.Status.RUNNING,
                ),
            ).values_list('design_id', flat=True)
        )

        # Already-upscaled handling.
        skipped_already = 0
        candidates: list[Design] = []
        for d in designs:
            if d.id in in_progress_ids:
                # silently skip — one job per design is enough
                continue
            if d.upscaled_file and not replace_flag:
                skipped_already += 1
                continue
            candidates.append(d)

        cfg = UpscalerSettings.load()

        # AC-11: pre-flight quota check.
        unlimited = _is_unlimited(request.user, cfg)
        if not unlimited:
            state = _quota_state(request.user, cfg)
            remaining = (state['limit'] or 0) - state['used']
            if remaining <= 0:
                return _quota_402(request.user, cfg, requested=len(candidates))
            if len(candidates) > remaining:
                # Race-condition safety net (frontend pre-check usually catches).
                return _quota_402(request.user, cfg, requested=len(candidates))

        if not candidates:
            return Response(
                {
                    'batch_id': None,
                    'jobs': [],
                    'skipped_quota': 0,
                    'skipped_already_upscaled': skipped_already,
                    'skipped_in_progress': len(in_progress_ids),
                },
                status=status.HTTP_202_ACCEPTED,
            )

        batch_id = uuid.uuid4()
        cloud_target = body.get('cloud_target') or {}
        if body.get('destination') != 'cloud':
            cloud_target = {}

        with transaction.atomic():
            jobs = [
                DesignProcessingJob(
                    design=d,
                    type=DesignProcessingJob.JobType.UPSCALE,
                    status=DesignProcessingJob.Status.PENDING,
                    triggered_by=request.user,
                    batch_id=batch_id,
                    cloud_target=cloud_target,
                )
                for d in candidates
            ]
            DesignProcessingJob.objects.bulk_create(jobs)
            # bulk_create doesn't refresh PKs reliably for non-default backends
            # but Postgres does — pull fresh rows for response + enqueue.
            jobs = list(
                DesignProcessingJob.objects.filter(batch_id=batch_id)
                .select_related('design')
                .order_by('created_at')
            )
            if not unlimited:
                _consume_quota(request.user, len(jobs))

        queue = django_rq.get_queue('design')
        for job in jobs:
            rq_job = queue.enqueue(enqueue_replicate_upscale, str(job.id))
            job.rq_job_id = rq_job.id
        DesignProcessingJob.objects.bulk_update(jobs, fields=['rq_job_id'])

        return Response(
            {
                'batch_id': str(batch_id),
                'jobs': UpscaleJobSerializer(jobs, many=True).data,
                'skipped_quota': 0,
                'skipped_already_upscaled': skipped_already,
                'skipped_in_progress': len(in_progress_ids),
            },
            status=status.HTTP_202_ACCEPTED,
        )


# ----------------------------------------
# Batch status (poll)
# ----------------------------------------

class UpscaleBatchStatusView(APIView):
    """GET /api/designs/upscale/batch/<uuid:batch_id>/."""

    def get(self, request, batch_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        jobs = list(
            DesignProcessingJob.objects.filter(
                batch_id=batch_id,
                design__workspace_id=ws_id,
            )
            .select_related('design')
            .order_by('created_at')
        )
        if not jobs:
            return Response(
                {'error': 'batch_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        counts = {'pending': 0, 'running': 0, 'completed': 0, 'failed': 0}
        for j in jobs:
            counts[j.status] = counts.get(j.status, 0) + 1
        is_terminal = counts['pending'] == 0 and counts['running'] == 0

        payload = {
            'batch_id': batch_id,
            'total': len(jobs),
            'completed': counts['completed'],
            'failed': counts['failed'],
            'pending': counts['pending'],
            'running': counts['running'],
            'is_terminal': is_terminal,
            'jobs': jobs,
        }
        return Response(BatchStatusSerializer(payload).data)


# ----------------------------------------
# Quota
# ----------------------------------------

class UpscaleQuotaView(APIView):
    """GET /api/designs/upscale/quota/."""

    def get(self, request):
        cfg = UpscalerSettings.load()
        state = _quota_state(request.user, cfg)
        return Response(UpscaleQuotaSerializer(state).data)


# ----------------------------------------
# Replicate webhook callback
# ----------------------------------------

class UpscaleCallbackView(APIView):
    """POST /api/upscale/callback/.

    Public endpoint — no JWT. Auth is via Replicate signature header
    (verified by SDK). Always returns 200 once a payload is processed,
    even on permanent failure, to prevent Replicate retry storms (we
    capture the error in the job row).
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            verify_webhook_signature(
                headers=dict(request.headers),
                body=request.body.decode('utf-8'),
            )
        except ReplicateSignatureError as exc:
            logger.warning('replicate webhook signature invalid: %s', exc)
            return Response(
                {'error': 'invalid_signature'},
                status=status.HTTP_403_FORBIDDEN,
            )
        except ReplicateConfigError as exc:
            logger.error('replicate webhook config missing: %s', exc)
            return Response(
                {'error': 'webhook_not_configured'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            payload = json.loads(request.body.decode('utf-8'))
        except json.JSONDecodeError:
            return Response(
                {'error': 'invalid_json'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prediction_id = payload.get('id') or ''
        status_value = payload.get('status') or ''
        output = payload.get('output')
        if isinstance(output, list) and output:
            output = output[0]
        elif not isinstance(output, str):
            output = None
        error_message = payload.get('error') or ''

        if not prediction_id or not status_value:
            return Response(
                {'error': 'missing_fields'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Off-load actual processing (download + Pillow) to the design
        # queue so the webhook handler returns fast (<1s) and we don't
        # tie up gunicorn workers.
        queue = django_rq.get_queue('design')
        queue.enqueue(
            process_replicate_callback,
            prediction_id,
            status_value,
            output,
            error_message,
        )

        return Response({'ok': True}, status=status.HTTP_200_OK)
