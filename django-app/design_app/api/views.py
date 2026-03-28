"""DRF views for design_app API."""

import logging

import django_rq
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from design_app.api.serializers import (
    AnalyzeImageSerializer,
    ApplyPipelineSerializer,
    BatchProcessSerializer,
    DesignPipelineSerializer,
    DesignProcessingJobSerializer,
    DesignGenerationRunSerializer,
    DesignSerializer,
    DesignStatusUpdateSerializer,
    GenerateDesignSerializer,
    ProcessingSettingsSerializer,
)
from design_app.models import (
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    ProcessingSettings,
)
from design_app.tasks import (
    task_analyze_image,
    task_generate_design,
    task_remove_background,
    task_upscale_design,
)

logger = logging.getLogger(__name__)


# -- Helpers --

def _get_workspace_id(request):
    return request.headers.get('X-Workspace-Id')


def _require_workspace(request):
    ws_id = _get_workspace_id(request)
    if not ws_id:
        return None
    return ws_id


def _ws_error():
    return Response(
        {'error': 'X-Workspace-Id header required'},
        status=status.HTTP_400_BAD_REQUEST,
    )


class DesignPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# -- Board Context --

class DesignBoardView(APIView):
    """GET /api/ideas/{id}/design-board/ — board context for an idea."""

    def get(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        from idea_app.models import Idea
        idea = get_object_or_404(
            Idea.objects.select_related('niche', 'workspace'),
            pk=pk,
            workspace_id=ws_id,
        )

        # Get reference products from niche research
        reference_products = _get_reference_products(idea)

        # Get existing designs
        designs = Design.objects.filter(
            idea=idea,
            workspace_id=ws_id,
        ).select_related('generation_run').order_by('-created_at')

        board_data = {
            'idea_id': str(idea.id),
            'slogan_text': idea.slogan_text,
            'niche_name': idea.niche.name if idea.niche else None,
            'reference_products': reference_products,
            'designs': DesignSerializer(designs, many=True).data,
        }

        return Response(board_data)


def _get_reference_products(idea):
    """Fetch reference products with analysis from niche research."""
    if not idea.niche:
        return []

    from niche_research_app.models import (
        NicheProductEmotionalAnalysis,
        NicheProductVisionAnalysis,
        NicheResearch,
        NicheResearchProduct,
    )

    # Get latest completed research for this niche
    latest_research = NicheResearch.objects.filter(
        niche=idea.niche,
        status=NicheResearch.Status.COMPLETED,
    ).order_by('-created_at').first()

    if not latest_research:
        return []

    # Get products with analyses
    research_products = NicheResearchProduct.objects.filter(
        research=latest_research,
        brand_blocked=False,
    ).select_related('product').order_by('product__bsr')[:20]

    products = []
    for rp in research_products:
        product = rp.product

        # Get vision analysis
        vision = NicheProductVisionAnalysis.objects.filter(
            research=latest_research,
            product=product,
        ).first()

        # Get emotional analysis
        emotional = NicheProductEmotionalAnalysis.objects.filter(
            research=latest_research,
            product=product,
        ).first()

        ref = {
            'product_id': str(product.id),
            'image': product.thumbnail_url or '',
            'title': product.title or '',
            'visual_style': vision.visual_style if vision else '',
            'graphic_elements': vision.graphic_elements if vision else '',
            'layout_composition': vision.layout_composition if vision else '',
            'vibe': emotional.vibe if emotional else {},
            'emotional_pattern': emotional.emotional_pattern if emotional else '',
            'semantic_structure': emotional.semantic_structure if emotional else {},
            'key_elements': emotional.key_elements if emotional else [],
            'tone': emotional.tone if emotional else '',
            'adaptation_formula': emotional.adaptation_formula if emotional else '',
            'adaptation_examples': emotional.adaptation_examples if emotional else [],
            'customer_psychology': emotional.customer_psychology if emotional else {},
            'sentiment_analysis': emotional.sentiment_analysis if emotional else {},
            'prompt_analysis': {},
        }
        products.append(ref)

    return products


# -- Design List --

class DesignListView(APIView):
    """GET /api/ideas/{id}/designs/ — list designs for an idea."""

    def get(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        designs = Design.objects.filter(
            idea_id=pk,
            workspace_id=ws_id,
        ).select_related('generation_run').order_by('-created_at')

        paginator = DesignPagination()
        page = paginator.paginate_queryset(designs, request)
        serializer = DesignSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# -- Generate Design --

class GenerateDesignView(APIView):
    """POST /api/ideas/{id}/designs/generate/ — trigger design generation."""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = GenerateDesignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from idea_app.models import Idea
        idea = get_object_or_404(Idea, pk=pk, workspace_id=ws_id)

        # Create generation run
        run = DesignGenerationRun.objects.create(
            idea=idea,
            model_name=serializer.validated_data['model'],
            status=DesignGenerationRun.Status.PENDING,
            triggered_by=request.user,
            prompt_used=serializer.validated_data['prompt'],
        )

        # Enqueue to design worker
        queue = django_rq.get_queue('design')
        job = queue.enqueue(task_generate_design, str(run.id))
        run.rq_job_id = job.id
        run.save(update_fields=['rq_job_id'])

        return Response(
            DesignGenerationRunSerializer(run).data,
            status=status.HTTP_202_ACCEPTED,
        )


# -- Design Detail + Status Update --

class DesignDetailView(APIView):
    """
    PATCH /api/designs/{id}/ — update status (approve/reject).
    DELETE /api/designs/{id}/ — hard delete.
    """

    def patch(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        design = get_object_or_404(
            Design.objects.select_related('idea'),
            pk=pk,
            workspace_id=ws_id,
        )

        serializer = DesignStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']

        # Auto-reject previous approved design when approving new one
        if new_status == 'approved':
            Design.objects.filter(
                idea=design.idea,
                workspace_id=ws_id,
                status=Design.Status.APPROVED,
            ).exclude(pk=pk).update(status=Design.Status.REJECTED)

        design.status = new_status
        design.save(update_fields=['status'])

        return Response(DesignSerializer(design).data)

    def delete(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        design = get_object_or_404(Design, pk=pk, workspace_id=ws_id)
        design.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


# -- Download Design --

class DesignDownloadView(APIView):
    """GET /api/designs/{id}/download/ — returns image file."""

    def get(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        design = get_object_or_404(Design, pk=pk, workspace_id=ws_id)

        if not design.image_file:
            return Response(
                {'error': 'No image file available'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return FileResponse(
            design.image_file.open('rb'),
            content_type='image/png',
            as_attachment=True,
            filename=f"design_{str(pk)[:8]}.png",
        )


# -- Analyze Image --

class AnalyzeImageView(APIView):
    """POST /api/designs/{id}/analyze-image/ — trigger Gemini 3 analysis."""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        design = get_object_or_404(Design, pk=pk, workspace_id=ws_id)

        serializer = AnalyzeImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        source_url = serializer.validated_data['source_image_url']

        # Reuse check: if prompt_analysis already exists, return it
        if design.prompt_analysis:
            return Response({
                'status': 'reused',
                'prompt_analysis': design.prompt_analysis,
            })

        # Enqueue analysis job
        queue = django_rq.get_queue('design')
        job = queue.enqueue(
            task_analyze_image,
            str(design.id),
            source_url,
        )

        return Response(
            {
                'status': 'pending',
                'job_id': job.id,
                'design_id': str(design.id),
            },
            status=status.HTTP_202_ACCEPTED,
        )


# -- Poll Run Status --

class RunStatusView(APIView):
    """GET /api/designs/runs/{run_id}/ — poll generation run status."""

    def get(self, request, run_id):
        run = get_object_or_404(
            DesignGenerationRun.objects.prefetch_related('designs'),
            pk=run_id,
        )

        data = DesignGenerationRunSerializer(run).data

        # Include generated designs if completed
        if run.status == DesignGenerationRun.Status.COMPLETED:
            designs = run.designs.all()
            data['designs'] = DesignSerializer(designs, many=True).data

        return Response(data)


# -- Batch Process --

class BatchProcessView(APIView):
    """POST /api/designs/batch-process/ — batch upscale + bg_remove."""

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = BatchProcessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        design_ids = serializer.validated_data['design_ids']
        steps = serializer.validated_data['steps']

        # Validate all designs belong to workspace
        designs = Design.objects.filter(
            id__in=design_ids,
            workspace_id=ws_id,
        )
        if designs.count() != len(design_ids):
            return Response(
                {'error': 'Some designs not found in workspace'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queue = django_rq.get_queue('design')
        jobs = []

        for design in designs:
            for step in steps:
                job_record = DesignProcessingJob.objects.create(
                    design=design,
                    type=step,
                    status=DesignProcessingJob.Status.PENDING,
                )

                if step == 'upscale':
                    rq_job = queue.enqueue(task_upscale_design, str(job_record.id))
                elif step == 'bg_remove':
                    rq_job = queue.enqueue(task_remove_background, str(job_record.id))
                else:
                    continue

                job_record.rq_job_id = rq_job.id
                job_record.save(update_fields=['rq_job_id'])
                jobs.append(job_record)

        return Response(
            DesignProcessingJobSerializer(jobs, many=True).data,
            status=status.HTTP_202_ACCEPTED,
        )


# -- Poll Processing Job --

class ProcessingJobStatusView(APIView):
    """GET /api/designs/processing-jobs/{job_id}/ — poll job status."""

    def get(self, request, job_id):
        job = get_object_or_404(DesignProcessingJob, pk=job_id)
        return Response(DesignProcessingJobSerializer(job).data)


# -- Processing Settings --

class ProcessingSettingsView(APIView):
    """GET/PATCH /api/designs/settings/ — workspace processing settings."""

    def get(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        settings_obj, _ = ProcessingSettings.objects.get_or_create(
            workspace_id=ws_id,
        )
        return Response(ProcessingSettingsSerializer(settings_obj).data)

    def patch(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        settings_obj, _ = ProcessingSettings.objects.get_or_create(
            workspace_id=ws_id,
        )
        serializer = ProcessingSettingsSerializer(
            settings_obj,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(ProcessingSettingsSerializer(settings_obj).data)


# -- Pipeline CRUD --

class PipelineListCreateView(APIView):
    """GET/POST /api/designs/pipelines/"""

    def get(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        pipelines = DesignPipeline.objects.filter(
            workspace_id=ws_id,
        ).select_related('created_by')

        paginator = DesignPagination()
        page = paginator.paginate_queryset(pipelines, request)
        serializer = DesignPipelineSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = DesignPipelineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(workspace_id=ws_id, created_by=request.user)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PipelineDetailView(APIView):
    """PATCH/DELETE /api/designs/pipelines/{id}/"""

    def patch(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        pipeline = get_object_or_404(
            DesignPipeline, pk=pk, workspace_id=ws_id,
        )
        serializer = DesignPipelineSerializer(
            pipeline, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data)

    def delete(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        pipeline = get_object_or_404(
            DesignPipeline, pk=pk, workspace_id=ws_id,
        )
        pipeline.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


# -- Apply Pipeline --

class ApplyPipelineView(APIView):
    """POST /api/designs/apply-pipeline/ — apply pipeline to designs."""

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = ApplyPipelineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        pipeline = get_object_or_404(
            DesignPipeline,
            pk=serializer.validated_data['pipeline_id'],
            workspace_id=ws_id,
        )

        design_ids = serializer.validated_data['design_ids']
        designs = Design.objects.filter(id__in=design_ids, workspace_id=ws_id)

        if designs.count() != len(design_ids):
            return Response(
                {'error': 'Some designs not found in workspace'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queue = django_rq.get_queue('design')
        server_jobs = []
        client_steps = []

        for tool_config in pipeline.tools:
            tool_name = tool_config.get('tool_name', '')

            if tool_name == 'bg_remove':
                for design in designs:
                    job = DesignProcessingJob.objects.create(
                        design=design,
                        type='bg_remove',
                    )
                    rq_job = queue.enqueue(task_remove_background, str(job.id))
                    job.rq_job_id = rq_job.id
                    job.save(update_fields=['rq_job_id'])
                    server_jobs.append(job)

            elif tool_name == 'upscale':
                for design in designs:
                    job = DesignProcessingJob.objects.create(
                        design=design,
                        type='upscale',
                    )
                    rq_job = queue.enqueue(task_upscale_design, str(job.id))
                    job.rq_job_id = rq_job.id
                    job.save(update_fields=['rq_job_id'])
                    server_jobs.append(job)

            else:
                # Client-side tool — return config for frontend execution
                client_steps.append(tool_config)

        return Response({
            'server_jobs': DesignProcessingJobSerializer(server_jobs, many=True).data,
            'client_steps': client_steps,
        })
