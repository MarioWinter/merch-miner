"""django-rq task functions for design generation and processing."""

import logging
import os
import time

import httpx

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import models
from django.utils import timezone

from design_app.services.replicate_client import (
    get_prediction,
    start_prediction,
)

logger = logging.getLogger(__name__)


def task_generate_design(
    run_id: str,
    project_id: str = None,
    aspect_ratio: str = '1:1',
    mode: str = 'text_to_image',
):
    """Generate a design image via OpenRouter.

    Called by django-rq worker-design queue.
    Creates a Design record on success, marks run as failed on error.
    If project_id is provided, auto-links the design to that project.
    """
    from design_app.models import (
        Design,
        DesignGenerationRun,
        DesignProject,
        DesignProjectDesign,
    )
    from design_app.services.image_generator import generate_image

    run = DesignGenerationRun.objects.select_related('idea').get(pk=run_id)
    run.status = DesignGenerationRun.Status.RUNNING
    run.save(update_fields=['status'])

    try:
        # Generate the image
        media_dir = os.path.join(settings.MEDIA_ROOT, 'designs', 'generated')
        os.makedirs(media_dir, exist_ok=True)

        # PROJ-34 AC-39 / Appendix H — derive a deterministic 32-bit seed
        # from this Run's UUID so parallel variants (each its own Run)
        # produce different — but reproducible — outputs from the same prompt.
        # Cheaper than carrying a separate seed column on the Run.
        seed_value = int(run.id.int & 0xFFFFFFFF)

        output_path = generate_image(
            prompt=run.prompt_used,
            model_name=run.model_name,
            output_dir=media_dir,
            aspect_ratio=aspect_ratio,
            source_image_url=run.source_image_url or '',
            source_image_url_2=run.source_image_url_2 or '',
            mode=run.generation_mode or mode,
            # PROJ-34 AC-6: persisted UI selection threads through to the
            # generator instead of being post-hoc derived from prompt text.
            background_color=run.background_color,
            seed=seed_value,
        )

        # Read file and save to Design model
        with open(output_path, 'rb') as f:
            image_content = f.read()

        # Resolve workspace: from idea if available, else from project
        workspace = None
        if run.idea:
            workspace = run.idea.workspace
        elif project_id:
            try:
                project = DesignProject.objects.get(pk=project_id)
                workspace = project.workspace
            except DesignProject.DoesNotExist:
                pass

        if not workspace:
            raise ValueError("Cannot determine workspace for design")

        design = Design(
            workspace=workspace,
            idea=run.idea,
            generation_run=run,
            status=Design.Status.PENDING,
            # PROJ-34 AC-8: trust the persisted UI selection on the Run.
            background_color=run.background_color,
        )
        filename = f"design_{str(run.id)[:8]}.png"
        design.image_file.save(filename, ContentFile(image_content), save=False)
        design.save()

        # Auto-link to project if provided
        if project_id:
            try:
                DesignProjectDesign.objects.get_or_create(
                    project_id=project_id,
                    design=design,
                )
            except Exception:
                logger.warning(
                    "Failed to link design to project: design=%s project=%s",
                    design.id, project_id,
                )

        # Clean up temp file
        if os.path.exists(output_path):
            os.remove(output_path)

        # Mark run as completed
        run.status = DesignGenerationRun.Status.COMPLETED
        run.completed_at = timezone.now()
        run.save(update_fields=['status', 'completed_at'])

        logger.info("Design generated: run=%s design=%s", run.id, design.id)

    except Exception as exc:
        logger.exception("Design generation failed: run=%s", run_id)

        # Retry once on timeout
        if 'timeout' in str(exc).lower() and not getattr(run, '_retried', False):
            run._retried = True
            logger.info("Retrying generation: run=%s", run_id)
            try:
                return task_generate_design(run_id, project_id, aspect_ratio, mode)
            except Exception:
                pass

        run.status = DesignGenerationRun.Status.FAILED
        run.completed_at = timezone.now()
        run.error_message = str(exc)[:2000]
        run.save(update_fields=['status', 'completed_at', 'error_message'])


def task_analyze_image(design_id: str, source_image_url: str):
    """Run Gemini 3 Architect 7-step analysis on an image.

    Stores structured output in Design.prompt_analysis.
    """
    from design_app.models import Design
    from design_app.services.image_analyzer import analyze_image

    design = Design.objects.get(pk=design_id)

    try:
        analysis = analyze_image(source_image_url)
        design.prompt_analysis = analysis
        design.source_image_url = source_image_url
        design.save(update_fields=['prompt_analysis', 'source_image_url'])

        logger.info("Image analyzed: design=%s", design_id)
        return analysis

    except Exception:
        logger.exception("Image analysis failed: design=%s", design_id)
        raise


def task_remove_background(job_id: str, model_name: str = ''):
    """Remove background from a design image.

    Reads ProcessingSettings to determine provider (rembg vs API).
    model_name overrides the default rembg model if provided.
    """
    from design_app.models import DesignProcessingJob, ProcessingSettings
    from design_app.services.bg_remover import (
        remove_background_api,
        remove_background_rembg,
    )

    job = DesignProcessingJob.objects.select_related(
        'design', 'design__workspace',
    ).get(pk=job_id)

    job.status = DesignProcessingJob.Status.RUNNING
    job.save(update_fields=['status'])

    try:
        # Get provider settings
        try:
            ps = ProcessingSettings.objects.get(
                workspace=job.design.workspace,
            )
        except ProcessingSettings.DoesNotExist:
            ps = None

        provider = ps.bg_removal_provider if ps else 'rembg'

        # Get input file path
        input_path = job.design.image_file.path

        if provider == 'rembg':
            output_path = remove_background_rembg(input_path, model_name=model_name or '')
        else:
            api_key = ps.bg_removal_api_key if ps else ''
            output_path = remove_background_api(input_path, api_key)

        # Save result
        with open(output_path, 'rb') as f:
            content = f.read()

        filename = f"nobg_{str(job.design.id)[:8]}.png"
        job.result_file.save(filename, ContentFile(content), save=False)

        # Also save to design's bg_removed_file
        job.design.bg_removed_file.save(filename, ContentFile(content), save=False)
        job.design.save(update_fields=['bg_removed_file'])

        # Clean up
        if os.path.exists(output_path):
            os.remove(output_path)

        job.status = DesignProcessingJob.Status.COMPLETED
        job.completed_at = timezone.now()
        job.save(update_fields=['status', 'completed_at', 'result_file'])

        logger.info("BG removed: job=%s design=%s", job_id, job.design.id)

    except Exception as exc:
        logger.exception("BG removal failed: job=%s", job_id)
        job.status = DesignProcessingJob.Status.FAILED
        job.completed_at = timezone.now()
        job.error_message = str(exc)[:2000]
        job.save(update_fields=['status', 'completed_at', 'error_message'])


def task_upscale_design(job_id: str):
    """Backwards-compat shim for the legacy PROJ-9 batch+pipeline callers.

    The new PROJ-27 flow uses ``enqueue_replicate_upscale`` directly. This
    shim simply delegates so existing entry points (BatchProcessView,
    ApplyPipelineView) keep working without code changes.
    """
    enqueue_replicate_upscale(job_id)


# ----------------------------------------
# PROJ-27 — AI Upscaler tasks
# ----------------------------------------

# How long we let an upscale job sit in `running` before the reconciler
# considers it stuck. Replicate predictions for real-esrgan typically finish
# in 3-5s, so 5min is an order of magnitude safety margin.
RECONCILE_STUCK_THRESHOLD_SEC = 60  # Phase 13t-u: was 300s — Replicate webhook
# losses are common (no TLS issues on our side; just intermittent). 60s polling
# means worst-case wait is ~1 min after Replicate finishes instead of ~5 min.
# Polling cost: ~89 / day max (1 prediction lookup per stuck job per minute).

# Max retries when firing the initial Replicate prediction. Per EC-2 in spec.
REPLICATE_RETRY_BACKOFF_SEC = (2, 4, 8)


def _build_webhook_url() -> str:
    """Resolve the webhook callback URL from settings + ALLOWED_HOSTS."""
    from django.conf import settings as dj_settings

    explicit = getattr(dj_settings, 'REPLICATE_WEBHOOK_URL', '')
    if explicit:
        return explicit.rstrip('/') + (
            '' if explicit.endswith('/api/upscale/callback/') else '/api/upscale/callback/'
        )

    # Fallback — pick first non-localhost ALLOWED_HOST. This is best-effort;
    # operators should set REPLICATE_WEBHOOK_URL explicitly.
    hosts = [h for h in dj_settings.ALLOWED_HOSTS if h not in ('localhost', '127.0.0.1', '[::1]')]
    if hosts:
        return f'https://{hosts[0]}/api/upscale/callback/'
    return 'http://localhost:8000/api/upscale/callback/'


def _refund_quota(user, ts):
    """Decrement the user's quota usage for the calendar month of ``ts``."""
    if user is None:
        return
    from datetime import date as _date

    from design_app.models import UpscaleQuotaUsage

    month_start = _date(ts.year, ts.month, 1)
    # Atomic decrement; clamp at 0 in case of double-refund races.
    UpscaleQuotaUsage.objects.filter(
        user=user, month=month_start, count__gt=0,
    ).update(count=models.F('count') - 1)


def _design_image_url(design) -> str:
    """Build a public URL for the source design file the worker hands to Replicate.

    Replicate requires a publicly fetchable URL; ``Design.image_file.url``
    hits MEDIA_URL which during prod is served by Caddy via the same ALLOWED_HOST
    used for the webhook callback. We piggy-back on the same base URL.
    """
    from django.conf import settings as dj_settings

    file_url = design.image_file.url  # e.g. /media/designs/...
    if file_url.startswith('http://') or file_url.startswith('https://'):
        return file_url

    base = getattr(dj_settings, 'REPLICATE_WEBHOOK_URL', '') or ''
    if base:
        # Strip trailing path so we keep only scheme+host.
        from urllib.parse import urlparse
        parsed = urlparse(base)
        return f'{parsed.scheme}://{parsed.netloc}{file_url}'

    hosts = [
        h for h in dj_settings.ALLOWED_HOSTS
        if h not in ('localhost', '127.0.0.1', '[::1]')
    ]
    if hosts:
        return f'https://{hosts[0]}{file_url}'
    return f'http://localhost:8000{file_url}'


def enqueue_replicate_upscale(job_id: str):
    """Fire a Replicate prediction for an existing DesignProcessingJob.

    Marks the job ``running`` and stores the Replicate prediction id. On
    Replicate-side errors we retry with exponential backoff up to 3 times
    (EC-2). Permanent failure refunds quota (AC-21) and marks job ``failed``.
    """
    from design_app.models import (
        DesignProcessingJob,
        UpscalerSettings,
    )
    from design_app.services.replicate_client import ReplicateConfigError

    job = DesignProcessingJob.objects.select_related(
        'design', 'design__workspace', 'triggered_by',
    ).get(pk=job_id)

    # Idempotency: if we've already kicked this off, don't double-fire.
    if job.replicate_prediction_id:
        logger.info(
            'enqueue_replicate_upscale: job=%s already has prediction=%s — skip',
            job_id, job.replicate_prediction_id,
        )
        return

    job.status = DesignProcessingJob.Status.RUNNING
    job.save(update_fields=['status'])

    cfg = UpscalerSettings.load()
    last_exc: Exception | None = None

    for attempt, backoff in enumerate(REPLICATE_RETRY_BACKOFF_SEC, start=1):
        try:
            result = start_prediction(
                image_url=_design_image_url(job.design),
                scale=cfg.default_scale,
                webhook_url=_build_webhook_url(),
                model_slug=cfg.replicate_model_slug,
                model_version=cfg.replicate_model_version,
            )
            job.replicate_prediction_id = result.get('id', '')
            job.save(update_fields=['replicate_prediction_id'])
            logger.info(
                'replicate prediction created: job=%s prediction=%s',
                job_id, job.replicate_prediction_id,
            )
            return
        except ReplicateConfigError as exc:
            # Don't retry config errors — surface immediately. But mark the
            # DB row failed first, otherwise the UI sees a phantom "running"
            # forever AND the bulk endpoint's "one job per design" guard
            # blocks the user from retriggering once the operator fixes
            # the env (user-reported 2026-05-31: stuck job blocked all
            # further upscale attempts until manually-cleared via shell).
            job.status = DesignProcessingJob.Status.FAILED
            job.completed_at = timezone.now()
            job.error_message = f'replicate_config_error: {exc}'
            job.save(update_fields=['status', 'completed_at', 'error_message'])
            _refund_quota(job.triggered_by, job.completed_at)
            logger.error(
                'replicate config error — job=%s permanently failed (no retry): %s',
                job_id, exc,
            )
            raise
        except Exception as exc:  # noqa: BLE001 — broad on purpose; we retry
            last_exc = exc
            logger.warning(
                'replicate start_prediction failed (attempt %s/%s): %s',
                attempt, len(REPLICATE_RETRY_BACKOFF_SEC), exc,
            )
            if attempt < len(REPLICATE_RETRY_BACKOFF_SEC):
                time.sleep(backoff)
            continue

    # All retries exhausted — mark failed + refund quota.
    job.status = DesignProcessingJob.Status.FAILED
    job.completed_at = timezone.now()
    job.error_message = 'replicate_unavailable'
    job.save(update_fields=['status', 'completed_at', 'error_message'])
    _refund_quota(job.triggered_by, job.completed_at)
    logger.exception(
        'replicate upscale permanent failure: job=%s last_exc=%s', job_id, last_exc,
    )


def process_replicate_callback(
    prediction_id: str,
    status_value: str,
    output_url: str | None,
    error_message: str | None,
):
    """Process a Replicate webhook payload (or reconciler-fetched state).

    Idempotent: if the matching DesignProcessingJob is already in a terminal
    state (completed/failed), this returns immediately. On success, the
    Replicate output is downloaded, run through Pillow center-pad, and saved
    to ``Design.upscaled_file`` (Source of Truth per spec).
    """
    from design_app.models import (
        DesignProcessingJob,
        UpscalerSettings,
    )
    from design_app.services.upscaler import center_pad_to_target

    try:
        job = DesignProcessingJob.objects.select_related(
            'design', 'design__workspace', 'triggered_by',
        ).get(replicate_prediction_id=prediction_id)
    except DesignProcessingJob.DoesNotExist:
        logger.warning(
            'process_replicate_callback: no job for prediction_id=%s — ignoring',
            prediction_id,
        )
        return

    # Idempotency — short-circuit on already-terminal jobs.
    if job.status in (
        DesignProcessingJob.Status.COMPLETED,
        DesignProcessingJob.Status.FAILED,
    ):
        logger.info(
            'process_replicate_callback: job=%s already %s — ignoring duplicate',
            job.id, job.status,
        )
        return

    if status_value in ('failed', 'canceled'):
        job.status = DesignProcessingJob.Status.FAILED
        job.completed_at = timezone.now()
        job.error_message = (error_message or status_value)[:2000]
        job.save(update_fields=['status', 'completed_at', 'error_message'])
        _refund_quota(job.triggered_by, job.completed_at)
        logger.info('replicate prediction %s: job=%s', status_value, job.id)
        return

    if status_value != 'succeeded' or not output_url:
        # Treat unknown intermediate states as no-op (we only ask for
        # `completed` filter, but defend anyway).
        logger.info(
            'process_replicate_callback: ignoring non-terminal status=%s job=%s',
            status_value, job.id,
        )
        return

    cfg = UpscalerSettings.load()

    # Defense-in-depth: even though the webhook signature gates out forged
    # callbacks, validate the output URL host before fetching to prevent SSRF
    # if the signing secret is ever leaked. Replicate serves outputs from
    # replicate.delivery (and historically pbxt.replicate.delivery).
    from urllib.parse import urlparse

    parsed = urlparse(output_url or '')
    allowed_hosts = ('replicate.delivery', 'pbxt.replicate.delivery')
    if parsed.scheme != 'https' or not parsed.netloc.endswith(allowed_hosts):
        job.status = DesignProcessingJob.Status.FAILED
        job.completed_at = timezone.now()
        job.error_message = f'untrusted_output_host: {parsed.netloc}'[:2000]
        job.save(update_fields=['status', 'completed_at', 'error_message'])
        _refund_quota(job.triggered_by, job.completed_at)
        logger.error(
            'replicate output URL host not allow-listed: job=%s host=%s',
            job.id, parsed.netloc,
        )
        return

    try:
        with httpx.Client(timeout=60) as client:
            # follow_redirects=False — outputs are direct, redirect would be
            # another SSRF vector.
            resp = client.get(output_url, follow_redirects=False)
            resp.raise_for_status()
            raw_bytes = resp.content
    except Exception as exc:  # noqa: BLE001
        job.status = DesignProcessingJob.Status.FAILED
        job.completed_at = timezone.now()
        job.error_message = f'download_failed: {exc}'[:2000]
        job.save(update_fields=['status', 'completed_at', 'error_message'])
        _refund_quota(job.triggered_by, job.completed_at)
        logger.exception('replicate output download failed: job=%s', job.id)
        return

    # Pillow center-pad.
    try:
        padded = center_pad_to_target(
            raw_bytes,
            target_w=cfg.target_width,
            target_h=cfg.target_height,
        )
    except Exception as exc:  # noqa: BLE001 — invalid image, etc. (EC-6)
        job.status = DesignProcessingJob.Status.FAILED
        job.completed_at = timezone.now()
        job.error_message = 'invalid_replicate_output'
        job.save(update_fields=['status', 'completed_at', 'error_message'])
        _refund_quota(job.triggered_by, job.completed_at)
        logger.exception('center_pad_to_target failed: job=%s exc=%s', job.id, exc)
        return

    # Save to Design.upscaled_file (Source of Truth).
    filename = f'upscaled_{str(job.design.id)[:8]}.png'
    job.design.upscaled_file.save(filename, ContentFile(padded), save=False)
    job.design.save(update_fields=['upscaled_file'])

    job.result_file.save(filename, ContentFile(padded), save=False)
    job.status = DesignProcessingJob.Status.COMPLETED
    job.completed_at = timezone.now()
    job.save(update_fields=['status', 'completed_at', 'result_file'])

    logger.info('upscale completed: job=%s design=%s', job.id, job.design_id)

    # Optional cloud upload.
    if job.cloud_target:
        import django_rq

        queue = django_rq.get_queue('design')
        queue.enqueue(
            enqueue_cloud_upload,
            str(job.id),
            job.cloud_target,
        )


def reconcile_stuck_jobs():
    """Fallback reconciler for lost webhooks (EC-3).

    Scans DesignProcessingJob in `running` state older than the threshold
    and polls Replicate to recover their final state. Scheduled via
    ``rq-scheduler`` (see schedule_upscale_reconciler management command).
    """
    from datetime import timedelta

    from design_app.models import DesignProcessingJob

    cutoff = timezone.now() - timedelta(seconds=RECONCILE_STUCK_THRESHOLD_SEC)
    stuck_qs = DesignProcessingJob.objects.filter(
        type=DesignProcessingJob.JobType.UPSCALE,
        status=DesignProcessingJob.Status.RUNNING,
        created_at__lt=cutoff,
    ).exclude(replicate_prediction_id='')[:50]

    reconciled = 0
    for job in stuck_qs:
        try:
            state = get_prediction(job.replicate_prediction_id)
        except Exception:  # noqa: BLE001
            logger.exception('reconciler: get_prediction failed job=%s', job.id)
            continue
        replicate_status = state.get('status')
        if replicate_status in ('succeeded', 'failed', 'canceled'):
            process_replicate_callback(
                prediction_id=state.get('id') or job.replicate_prediction_id,
                status_value=replicate_status,
                output_url=state.get('output'),
                error_message=state.get('error'),
            )
            reconciled += 1
    if reconciled:
        logger.info('reconcile_stuck_jobs: reconciled %s jobs', reconciled)

    # User-report 2026-05-31: orphan jobs — status='running' but no
    # replicate_prediction_id — are invisible to BOTH this reconciler
    # (excluded by the empty-id filter above) AND the frontend
    # (workspace UI keys off activeBatchId, hidden orphans never get
    # surfaced). They jam the bulk endpoint's "one job per design" guard
    # so the user can't retrigger. Sweep them here too: anything that's
    # been "running" without a prediction id for >threshold is by
    # definition a never-actually-fired enqueue (Fix A wrapping
    # ReplicateConfigError now prevents the most common cause, but this
    # is the safety net for any future enqueue-side crash that bypasses
    # the new failed-status path).
    orphan_qs = DesignProcessingJob.objects.filter(
        type=DesignProcessingJob.JobType.UPSCALE,
        status=DesignProcessingJob.Status.RUNNING,
        replicate_prediction_id='',
        created_at__lt=cutoff,
    ).select_related('triggered_by')[:50]
    orphans_failed = 0
    for job in orphan_qs:
        job.status = DesignProcessingJob.Status.FAILED
        job.completed_at = timezone.now()
        job.error_message = 'orphan_no_prediction_id — enqueue crashed before Replicate handoff'
        job.save(update_fields=['status', 'completed_at', 'error_message'])
        _refund_quota(job.triggered_by, job.completed_at)
        orphans_failed += 1
    if orphans_failed:
        logger.warning(
            'reconcile_stuck_jobs: marked %s orphan job(s) failed (status=running, no prediction id)',
            orphans_failed,
        )


def enqueue_cloud_upload(job_id: str, cloud_target: dict):
    """Upload the upscaled file to the user-picked cloud destination.

    PROJ-27 reuses PROJ-11 cloud infrastructure; for MVP this is a thin
    placeholder that logs the intent — actual provider upload (Google
    Drive / OneDrive) is wired through publish_app upload primitives once
    those are factored out from the existing `cloud_import` flow.
    """
    from design_app.models import DesignProcessingJob

    try:
        job = DesignProcessingJob.objects.select_related(
            'design', 'design__workspace',
        ).get(pk=job_id)
    except DesignProcessingJob.DoesNotExist:
        logger.warning('enqueue_cloud_upload: job=%s not found', job_id)
        return

    if not job.design.upscaled_file:
        logger.warning(
            'enqueue_cloud_upload: job=%s has no upscaled_file — skipping cloud',
            job_id,
        )
        return

    provider = (cloud_target or {}).get('provider')
    folder = (cloud_target or {}).get('folder_id') or (cloud_target or {}).get('folder_path')
    logger.info(
        'cloud upload requested: job=%s provider=%s folder=%s file=%s',
        job_id, provider, folder, job.design.upscaled_file.name,
    )
    # NOTE: actual upload happens via publish_app helpers when those are
    # extended for outbound transfers (PROJ-11 currently covers download).
    # This keeps the contract intact for the frontend without new failure
    # modes during MVP rollout.


def task_analyze_product_image(product_id: str, source_image_url: str):
    """Run Gemini 3 Architect 7-step analysis on an AmazonProduct image.

    Stores structured output in AmazonProduct.prompt_analysis.
    """
    from scraper_app.models import AmazonProduct
    from design_app.services.image_analyzer import analyze_image

    product = AmazonProduct.objects.get(pk=product_id)

    try:
        analysis = analyze_image(source_image_url)
        product.prompt_analysis = analysis
        product.save(update_fields=['prompt_analysis'])

        logger.info("Product image analyzed: product=%s", product_id)
        return analysis

    except Exception:
        logger.exception("Product image analysis failed: product=%s", product_id)
        raise


