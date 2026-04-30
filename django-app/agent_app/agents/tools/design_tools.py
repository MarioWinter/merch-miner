"""Design Agent tools (AC-14).

6 tools for AI design generation, batch processing, and design board context.
Wraps `design_app` (DesignProject, DesignGenerationRun, Design, ProjectPrompt).

Note: Several tools (analyze_reference_image, trigger_batch_processing) use
existing django-rq tasks. `get_design_board_context` reads layout JSON.
"""

from __future__ import annotations

from typing import Any, Optional

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from agent_app.services.permission_decorator import permission_check


# ── Helpers ──

def _get_workspace_id(config: Optional[RunnableConfig]) -> str:
    if not config:
        raise ValueError('Tool requires LangGraph config with workspace context.')
    cfg = config.get('configurable') or {}
    workspace_id = cfg.get('workspace_id')
    if not workspace_id:
        raise ValueError('Missing workspace_id in tool config.')
    return str(workspace_id)


def _get_user_id(config: Optional[RunnableConfig]) -> Any:
    if not config:
        raise ValueError('Tool requires LangGraph config with user context.')
    cfg = config.get('configurable') or {}
    user_id = cfg.get('user_id')
    if not user_id:
        raise ValueError('Missing user_id in tool config.')
    return user_id


# ── Tools ──

@tool
@permission_check('get_design_board_context')
def get_design_board_context(
    project_id: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read a design project's board: prompts, references, ideas, designs.

    Args:
        project_id: DesignProject UUID.
    """
    from design_app.models import DesignProject

    workspace_id = _get_workspace_id(config)
    try:
        project = (
            DesignProject.objects
            .select_related('niche')
            .get(id=project_id, workspace_id=workspace_id)
        )
    except DesignProject.DoesNotExist:
        return {'error': f'DesignProject {project_id} not found.'}

    return {
        'project_id': str(project.id),
        'name': project.name,
        'niche_id': str(project.niche_id) if project.niche_id else None,
        'board_layout': project.board_layout,
        'idea_count': project.ideas.count(),
        'design_count': project.designs.count(),
        'prompt_count': project.prompts.count(),
        'reference_count': project.references.count(),
    }


@tool
@permission_check('analyze_reference_image')
def analyze_reference_image(
    source_image_url: str,
    design_id: Optional[str] = None,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Run vision analysis on a reference image (Gemini 3 Architect 7-step).

    If `design_id` is provided, the analysis is cached on Design.prompt_analysis.
    Otherwise returns the analysis dict directly (no caching).
    """
    import django_rq

    from design_app.models import Design
    from design_app.tasks import task_analyze_image

    workspace_id = _get_workspace_id(config)

    if design_id:
        try:
            design = Design.objects.get(
                id=design_id, workspace_id=workspace_id,
            )
        except Design.DoesNotExist:
            return {'error': f'Design {design_id} not found.'}
        queue = django_rq.get_queue('design')
        job = queue.enqueue(
            task_analyze_image, str(design.id), source_image_url,
        )
        return {
            'design_id': str(design.id),
            'rq_job_id': job.id if job else '',
            'status': 'queued',
        }

    # No design_id: synchronous analysis (small cost, used for lookups).
    from design_app.services.image_analyzer import analyze_image
    try:
        result = analyze_image(source_image_url)
        return {'analysis': result}
    except Exception as exc:
        return {'error': f'Analysis failed: {exc}'[:500]}


@tool
@permission_check('generate_design')
def generate_design(
    prompt: str,
    idea_id: Optional[str] = None,
    project_id: Optional[str] = None,
    model_name: str = 'google/gemini-2.5-flash-preview-image-generation',
    aspect_ratio: str = '1:1',
    source_image_url: str = '',
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Generate an AI design (PROJ-9). Costs OpenRouter credits.

    Returns DesignGenerationRun id. Poll `read_design_status` for completion.
    """
    import django_rq

    from design_app.models import DesignGenerationRun
    from design_app.tasks import task_generate_design

    _ = _get_workspace_id(config)
    user_id = _get_user_id(config)

    mode = (
        DesignGenerationRun.Mode.IMAGE_TO_IMAGE
        if source_image_url else DesignGenerationRun.Mode.TEXT_TO_IMAGE
    )

    run = DesignGenerationRun.objects.create(
        idea_id=idea_id,
        model_name=model_name,
        prompt_used=prompt,
        source_image_url=source_image_url,
        generation_mode=mode,
        triggered_by_id=user_id,
        status=DesignGenerationRun.Status.PENDING,
    )
    queue = django_rq.get_queue('design')
    job = queue.enqueue(
        task_generate_design,
        str(run.id),
        project_id,
        aspect_ratio,
        mode,
    )
    if job:
        run.rq_job_id = job.id
        run.save(update_fields=['rq_job_id'])
    return {
        'run_id': str(run.id),
        'status': run.status,
        'rq_job_id': run.rq_job_id,
    }


@tool
@permission_check('read_design_status')
def read_design_status(
    run_id: str,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Read DesignGenerationRun status + resulting designs."""
    from design_app.models import DesignGenerationRun

    workspace_id = _get_workspace_id(config)
    try:
        run = (
            DesignGenerationRun.objects
            .select_related('idea')
            .get(id=run_id)
        )
        # Workspace check via idea.workspace if present
        if run.idea and str(run.idea.workspace_id) != str(workspace_id):
            return {'error': 'Run not in current workspace.'}
    except DesignGenerationRun.DoesNotExist:
        return {'error': f'Run {run_id} not found.'}

    designs = list(
        run.designs.values('id', 'status', 'image_file')[:20]
    )
    for d in designs:
        d['id'] = str(d['id'])
    return {
        'run_id': str(run.id),
        'status': run.status,
        'error_message': run.error_message,
        'designs': designs,
    }


@tool
@permission_check('approve_reject_design')
def approve_reject_design(
    design_id: str,
    approved: bool,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Approve or reject a design.

    Args:
        design_id: Design UUID.
        approved: True → APPROVED, False → REJECTED.
    """
    from design_app.models import Design

    workspace_id = _get_workspace_id(config)
    try:
        design = Design.objects.get(id=design_id, workspace_id=workspace_id)
    except Design.DoesNotExist:
        return {'error': f'Design {design_id} not found.'}

    design.status = (
        Design.Status.APPROVED if approved else Design.Status.REJECTED
    )
    design.save(update_fields=['status'])
    return {'design_id': str(design.id), 'status': design.status}


@tool
@permission_check('trigger_batch_processing')
def trigger_batch_processing(
    design_ids: list[str],
    pipeline_id: Optional[str] = None,
    operations: Optional[list[str]] = None,
    config: RunnableConfig = None,
) -> dict[str, Any]:
    """Trigger a batch post-processing pipeline (e.g. bg_remove, upscale).

    Args:
        design_ids: List of Design UUIDs.
        pipeline_id: Optional DesignPipeline preset to use.
        operations: Fallback list of ops if no pipeline (e.g. ['bg_remove']).

    Phase 2: enqueues per-design jobs via existing design_app tasks.
    """
    import django_rq

    from design_app.models import Design, DesignProcessingJob
    from design_app.tasks import task_remove_background, task_upscale_design

    workspace_id = _get_workspace_id(config)
    valid_designs = list(
        Design.objects.filter(
            id__in=design_ids, workspace_id=workspace_id,
        ).values_list('id', flat=True)
    )
    if not valid_designs:
        return {'error': 'No designs found in workspace.'}

    ops = operations or ['bg_remove']
    queue = django_rq.get_queue('design')
    enqueued: list[dict[str, Any]] = []

    for d_id in valid_designs:
        for op in ops:
            if op == 'bg_remove':
                job_record = DesignProcessingJob.objects.create(
                    design_id=d_id,
                    type=DesignProcessingJob.JobType.BG_REMOVE,
                    status=DesignProcessingJob.Status.PENDING,
                )
                rq_job = queue.enqueue(
                    task_remove_background, str(job_record.id),
                )
            elif op == 'upscale':
                job_record = DesignProcessingJob.objects.create(
                    design_id=d_id,
                    type=DesignProcessingJob.JobType.UPSCALE,
                    status=DesignProcessingJob.Status.PENDING,
                )
                rq_job = queue.enqueue(task_upscale_design, str(job_record.id))
            else:
                continue
            enqueued.append({
                'design_id': str(d_id),
                'job_id': str(job_record.id),
                'op': op,
                'rq_job_id': rq_job.id if rq_job else '',
            })

    return {
        'pipeline_id': pipeline_id,
        'enqueued_count': len(enqueued),
        'jobs': enqueued,
    }


TOOLS = [
    get_design_board_context,
    analyze_reference_image,
    generate_design,
    read_design_status,
    approve_reject_design,
    trigger_batch_processing,
]


__all__ = ['TOOLS', *(t.name for t in TOOLS)]
