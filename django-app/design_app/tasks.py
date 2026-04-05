"""django-rq task functions for design generation and processing."""

import logging
import os

from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone

logger = logging.getLogger(__name__)


def task_generate_design(run_id: str, project_id: str = None):
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

        output_path = generate_image(
            prompt=run.prompt_used,
            model_name=run.model_name,
            output_dir=media_dir,
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
            background_color=_get_bg_from_prompt(run.prompt_used),
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
                return task_generate_design(run_id, project_id)
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
    """Upscale a design image.

    Auto-mode: checks dimensions vs threshold.
    - >= threshold: returns 'client' hint (Pica.js handles it)
    - < threshold: calls external API
    """
    from design_app.models import DesignProcessingJob, ProcessingSettings
    from design_app.services.upscaler import get_upscale_decision

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

        provider = ps.upscale_provider if ps else 'auto'
        threshold = ps.upscale_auto_threshold if ps else 3000

        input_path = job.design.image_file.path
        decision = get_upscale_decision(input_path, threshold)

        if provider == 'pica' or (provider == 'auto' and decision['route'] == 'client'):
            # Client-side upscaling — mark as completed with hint
            job.status = DesignProcessingJob.Status.COMPLETED
            job.completed_at = timezone.now()
            job.error_message = 'route:client'  # Signal to frontend
            job.save(update_fields=['status', 'completed_at', 'error_message'])
            logger.info("Upscale routed to client: job=%s", job_id)
            return

        if provider in ('api', 'auto'):
            from design_app.services.upscaler import upscale_api
            api_key = ps.upscale_api_key if ps else ''
            output_path = upscale_api(input_path, api_key)

            with open(output_path, 'rb') as f:
                content = f.read()

            filename = f"upscaled_{str(job.design.id)[:8]}.png"
            job.result_file.save(filename, ContentFile(content), save=False)
            job.design.upscaled_file.save(filename, ContentFile(content), save=False)
            job.design.save(update_fields=['upscaled_file'])

            if os.path.exists(output_path):
                os.remove(output_path)

        job.status = DesignProcessingJob.Status.COMPLETED
        job.completed_at = timezone.now()
        job.save(update_fields=['status', 'completed_at', 'result_file'])

        logger.info("Upscale completed: job=%s", job_id)

    except Exception as exc:
        logger.exception("Upscale failed: job=%s", job_id)
        job.status = DesignProcessingJob.Status.FAILED
        job.completed_at = timezone.now()
        job.error_message = str(exc)[:2000]
        job.save(update_fields=['status', 'completed_at', 'error_message'])


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


def _get_bg_from_prompt(prompt: str) -> str:
    """Extract background color from prompt text."""
    from design_app.models import Design
    for choice_val, hex_val in Design.BG_COLOR_HEX.items():
        if hex_val.lower() in prompt.lower():
            return choice_val
    return Design.BackgroundColor.LIGHT_GRAY
