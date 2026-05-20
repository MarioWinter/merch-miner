"""DRF views for design_app API."""

import logging

import django_rq
import httpx
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from django.db.models import Count, Exists, OuterRef

from design_app.api.serializers import (
    AddDesignsToProjectSerializer,
    AddIdeasToPoolSerializer,
    AddManualReferencesSerializer,
    AddReferencesFromProductsSerializer,
    AnalyzeImageSerializer,
    ApplyPipelineSerializer,
    BatchProcessSerializer,
    BuilderBuildSerializer,
    BuilderPresetSerializer,
    BuildPromptsSerializer,
    BulkCreatePromptsSerializer,
    CreateProjectSerializer,
    CreatePromptPresetSerializer,
    CustomSpatialAnalyzeSerializer,
    CustomSpatialSerializer,
    CustomTypographyAnalyzeSerializer,
    CustomTypographySerializer,
    DesignPipelineSerializer,
    DesignProcessingJobSerializer,
    DesignGenerationRunSerializer,
    DesignProjectListSerializer,
    DesignProjectSerializer,
    DesignSerializer,
    DesignStatusUpdateSerializer,
    DesignUploadSerializer,
    GenerateDesignSerializer,
    GenerateFromPromptSerializer,
    NicheCardPresetSerializer,
    PresetConfirmSerializer,
    PresetRegenerateSerializer,
    ProcessingSettingsSerializer,
    ProductAnalyzeImageSerializer,
    ProjectIdeaSerializer,
    ProjectPromptSerializer,
    ProjectReferenceSerializer,
    PromptPresetSerializer,
    StandaloneGenerateSerializer,
    UpdateProjectSerializer,
    UpdatePromptSerializer,
)
from rest_framework.exceptions import ValidationError as DRFValidationError
from design_app.models import (
    BuilderPreset,
    CustomSpatial,
    CustomTypography,
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    DesignProject,
    DesignProjectDesign,
    DesignProjectIdea,
    NicheCardPreset,
    ProcessingSettings,
    ProjectPrompt,
    ProjectReference,
    PromptPreset,
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
    """Resolve workspace from X-Workspace-Id header or user's active membership."""
    ws_id = request.headers.get('X-Workspace-Id')
    if ws_id:
        return ws_id
    # Fallback: use user's first active membership
    from workspace_app.models import Membership
    membership = (
        Membership.objects
        .filter(user=request.user, status=Membership.Status.ACTIVE)
        .select_related('workspace')
        .first()
    )
    if membership:
        return str(membership.workspace_id)
    return None


def _require_workspace(request):
    ws_id = _get_workspace_id(request)
    if not ws_id:
        return None
    return ws_id


def _ws_error():
    return Response(
        {'error': 'Workspace not found. Ensure active membership or send X-Workspace-Id header.'},
        status=status.HTTP_400_BAD_REQUEST,
    )


class DesignPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _annotate_has_design_asset(qs):
    """Annotate ``has_design_asset`` (PROJ-9 Phase O AC-171).

    Uses an ``Exists`` subquery so the boolean is computed in SQL without
    loading any DesignAsset rows into Python. Importing DesignAsset lazily
    here keeps the design_app -> publish_app dependency one-way at import
    time (publish_app already imports design_app for the FK).
    """
    from publish_app.models import DesignAsset
    return qs.annotate(
        has_design_asset=Exists(
            DesignAsset.objects.filter(design_origin=OuterRef('pk')),
        ),
    )


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
        designs = _annotate_has_design_asset(
            Design.objects.filter(
                idea=idea,
                workspace_id=ws_id,
            ).select_related('generation_run'),
        ).order_by('-created_at')

        board_data = {
            'idea_id': str(idea.id),
            'slogan_text': idea.slogan_text,
            'niche_name': idea.niche.name if idea.niche else None,
            'board_layout': idea.board_layout,
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

        designs = _annotate_has_design_asset(
            Design.objects.filter(
                idea_id=pk,
                workspace_id=ws_id,
            ).select_related('generation_run'),
        ).order_by('-created_at')

        paginator = DesignPagination()
        page = paginator.paginate_queryset(designs, request)
        serializer = DesignSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


# -- Design List by IDs --

class DesignListByIdsView(APIView):
    """GET /api/designs/?ids=uuid1,uuid2,... — fetch designs by comma-separated IDs."""

    def get(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        ids_param = request.query_params.get('ids', '')
        if not ids_param:
            raise DRFValidationError({'ids': 'Query parameter "ids" is required.'})

        id_list = [i.strip() for i in ids_param.split(',') if i.strip()]
        if not id_list:
            raise DRFValidationError({'ids': 'At least one design ID is required.'})
        if len(id_list) > 100:
            raise DRFValidationError({'ids': 'Maximum 100 IDs per request.'})

        designs = _annotate_has_design_asset(
            Design.objects.filter(id__in=id_list, workspace_id=ws_id)
            .select_related('generation_run', 'idea')
            .prefetch_related('projects'),
        ).order_by('-created_at')

        serializer = DesignSerializer(designs, many=True)
        return Response(serializer.data)


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

        mode = serializer.validated_data.get('mode', DesignGenerationRun.Mode.TEXT_TO_IMAGE)
        source_image_url = serializer.validated_data.get('source_image_url', '')
        source_image_url_2 = serializer.validated_data.get('source_image_url_2', '')

        # Validate multimodal support for image-based modes
        _IMAGE_MODES = {
            DesignGenerationRun.Mode.IMAGE_TO_IMAGE,
            DesignGenerationRun.Mode.IMAGE_TO_IMAGE_EDIT,
            DesignGenerationRun.Mode.REMIX,
        }
        if mode in _IMAGE_MODES:
            from design_app.services.image_generator import MULTIMODAL_MODELS
            if serializer.validated_data['model'] not in MULTIMODAL_MODELS:
                return Response(
                    {'error': 'Selected model does not support image input. '
                     'Use a multimodal model for image-based generation.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Create generation run
        run = DesignGenerationRun.objects.create(
            idea=idea,
            model_name=serializer.validated_data['model'],
            generation_mode=mode,
            status=DesignGenerationRun.Status.PENDING,
            triggered_by=request.user,
            prompt_used=serializer.validated_data['prompt'],
            source_image_url=source_image_url,
            source_image_url_2=source_image_url_2,
            # PROJ-34 AC-5: persist UI bg_color selection onto the Run.
            background_color=serializer.validated_data.get(
                'background_color', 'light_gray',
            ),
        )

        # Resolve optional project_id
        project_id_str = None
        project_id = serializer.validated_data.get('project_id')
        if project_id:
            project = get_object_or_404(
                DesignProject, pk=project_id, workspace_id=ws_id,
            )
            project_id_str = str(project.id)

        # Enqueue to design worker
        queue = django_rq.get_queue('design')
        job = queue.enqueue(
            task_generate_design, str(run.id), project_id_str,
            serializer.validated_data.get('aspect_ratio', '1:1'),
            mode,
        )
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
        # Only within same idea scope (skip if no idea — standalone designs)
        if new_status == 'approved' and design.idea is not None:
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
            designs = _annotate_has_design_asset(run.designs.all())
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
        model_name = request.data.get('model', '')

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
                    rq_job = queue.enqueue(task_remove_background, str(job_record.id), model_name=model_name)
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


# -- Design Project CRUD (C1.2) --

class ProjectListCreateView(APIView):
    """GET /api/designs/projects/ — list projects. POST — create."""

    def get(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        projects = (
            DesignProject.objects.filter(workspace_id=ws_id)
            .select_related('niche')
            .annotate(design_count_annotated=Count('designs'))
            .order_by('-updated_at')
        )

        paginator = DesignPagination()
        page = paginator.paginate_queryset(projects, request)
        serializer = DesignProjectListSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = CreateProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        niche_id = serializer.validated_data.get('niche')
        niche = None
        if niche_id:
            from niche_app.models import Niche
            niche = get_object_or_404(Niche, pk=niche_id, workspace_id=ws_id)

        project = DesignProject.objects.create(
            workspace_id=ws_id,
            name=serializer.validated_data['name'],
            niche=niche,
            created_by=request.user,
        )

        # Bulk-create DesignProjectIdea for each idea_id (G1/G2)
        idea_ids = serializer.validated_data.get('idea_ids', [])
        if idea_ids:
            from idea_app.models import Idea
            valid_ideas = Idea.objects.filter(
                id__in=idea_ids, workspace_id=ws_id,
            ).values_list('id', flat=True)
            links = [
                DesignProjectIdea(
                    project=project, idea_id=idea_id, position=idx,
                )
                for idx, idea_id in enumerate(valid_ideas)
            ]
            DesignProjectIdea.objects.bulk_create(links, ignore_conflicts=True)

        return Response(
            DesignProjectSerializer(project).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectDetailView(APIView):
    """GET/PATCH/DELETE /api/designs/projects/{id}/"""

    def get(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject.objects.select_related('niche')
            .annotate(design_count_annotated=Count('designs')),
            pk=pk,
            workspace_id=ws_id,
        )

        return Response(DesignProjectSerializer(project).data)

    def patch(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )

        serializer = UpdateProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if 'name' in serializer.validated_data:
            project.name = serializer.validated_data['name']

        if 'niche' in serializer.validated_data:
            niche_id = serializer.validated_data['niche']
            if niche_id:
                from niche_app.models import Niche
                niche = get_object_or_404(Niche, pk=niche_id, workspace_id=ws_id)
                project.niche = niche
            else:
                project.niche = None

        if 'board_layout' in serializer.validated_data:
            project.board_layout = serializer.validated_data['board_layout']

        project.save()

        return Response(DesignProjectSerializer(project).data)

    def delete(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )
        # M2M unlinked automatically, designs NOT deleted
        project.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


# -- Project <-> Design M2M (C1.3) --

class ProjectDesignsView(APIView):
    """POST /api/designs/projects/{id}/designs/ — add designs to project."""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )

        serializer = AddDesignsToProjectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        design_ids = serializer.validated_data['design_ids']

        # Validate all designs belong to workspace
        designs = Design.objects.filter(
            id__in=design_ids, workspace_id=ws_id,
        )
        if designs.count() != len(design_ids):
            return Response(
                {'error': 'Some designs not found in workspace'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Create M2M links, ignoring duplicates
        created = 0
        for design in designs:
            _, was_created = DesignProjectDesign.objects.get_or_create(
                project=project, design=design,
            )
            if was_created:
                created += 1

        return Response(
            {'added': created, 'total': project.designs.count()},
            status=status.HTTP_201_CREATED,
        )


class ProjectDesignRemoveView(APIView):
    """DELETE /api/designs/projects/{id}/designs/{design_id}/ — remove."""

    def delete(self, request, pk, design_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )

        link = get_object_or_404(
            DesignProjectDesign, project=project, design_id=design_id,
        )
        link.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectBoardView(APIView):
    """GET /api/designs/projects/{id}/board/ — board context."""

    def get(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject.objects.select_related('niche')
            .annotate(design_count_annotated=Count('designs')),
            pk=pk,
            workspace_id=ws_id,
        )

        # Get project designs
        designs = _annotate_has_design_asset(
            Design.objects.filter(
                design_projects_through__project=project,
            )
            .select_related('generation_run', 'idea')
            .prefetch_related('projects'),
        ).order_by('-created_at')

        # Optional idea context overlay
        idea_context = None
        idea_id = request.query_params.get('ideaId')
        if idea_id:
            from idea_app.models import Idea
            try:
                idea = Idea.objects.select_related('niche').get(
                    pk=idea_id, workspace_id=ws_id,
                )
                reference_products = _get_reference_products(idea)
                idea_context = {
                    'idea_id': str(idea.id),
                    'slogan_text': idea.slogan_text,
                    'niche_name': idea.niche.name if idea.niche else None,
                    'reference_products': reference_products,
                }
                # Auto-add idea to pool if not already there (EC-30)
                DesignProjectIdea.objects.get_or_create(
                    project=project,
                    idea=idea,
                    defaults={'position': 0},
                )
            except Idea.DoesNotExist:
                pass

        # Slogan pool (G2)
        pool_items = (
            DesignProjectIdea.objects.filter(project=project)
            .select_related('idea', 'idea__niche')
            .order_by('position', '-added_at')
        )
        ideas_data = ProjectIdeaSerializer(pool_items, many=True).data

        # Prompts (G9)
        prompts = (
            ProjectPrompt.objects.filter(project=project)
            .select_related('source_idea')
            .order_by('-created_at')
        )
        prompts_data = ProjectPromptSerializer(prompts, many=True).data

        # References (I2)
        references = (
            ProjectReference.objects.filter(project=project)
            .select_related('source_product')
            .order_by('position', '-added_at')
        )
        references_data = ProjectReferenceSerializer(references, many=True).data

        # Active runs for this project — exposed so the frontend can reconcile
        # skeleton artboards with their run state (pending / running / failed).
        # Includes runs that produced no design (e.g. failed before save).
        from datetime import timedelta
        from django.utils import timezone as _tz
        active_run_qs = DesignGenerationRun.objects.filter(
            project_prompt__project=project,
        ).order_by('-created_at')
        recent_cutoff = _tz.now() - timedelta(hours=24)
        active_runs = [
            {
                'id': str(r.id),
                'status': r.status,
                'generation_mode': r.generation_mode,
                'error_message': r.error_message,
            }
            for r in active_run_qs
            if r.status in {'pending', 'running'}
            or (r.status == 'failed' and r.created_at >= recent_cutoff)
        ]
        # Also include standalone runs (no project_prompt) that the user just
        # triggered against this project via /api/designs/generate/.
        # Match by Design.generation_run scoped to this project's designs.
        standalone_run_ids = (
            DesignGenerationRun.objects.filter(
                designs__design_projects_through__project=project,
            )
            .exclude(project_prompt__project=project)
            .values_list('id', flat=True)
            .distinct()
        )
        # Also any pending/running runs not yet linked to a design but whose
        # triggered_by matches the requesting user (best-effort for UX).
        unlinked_recent_runs = DesignGenerationRun.objects.filter(
            triggered_by=request.user,
            created_at__gte=recent_cutoff,
            project_prompt__isnull=True,
        ).exclude(id__in=standalone_run_ids).order_by('-created_at')[:20]
        for r in unlinked_recent_runs:
            if r.status in {'pending', 'running'} or r.status == 'failed':
                active_runs.append({
                    'id': str(r.id),
                    'status': r.status,
                    'generation_mode': r.generation_mode,
                    'error_message': r.error_message,
                })

        data = {
            'project': DesignProjectSerializer(project).data,
            'designs': DesignSerializer(designs, many=True).data,
            'board_layout': project.board_layout,
            'idea_context': idea_context,
            'ideas': ideas_data,
            'prompts': prompts_data,
            'references': references_data,
            'active_runs': active_runs,
        }

        return Response(data)


# -- Standalone Generate (C1.4) --

class StandaloneGenerateView(APIView):
    """POST /api/designs/generate/ — generate with project_id + optional idea_id."""

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = StandaloneGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        project_id = serializer.validated_data.get('project_id')
        idea_id = serializer.validated_data.get('idea_id')

        # Resolve or auto-create project
        if project_id:
            project = get_object_or_404(
                DesignProject, pk=project_id, workspace_id=ws_id,
            )
        else:
            # Auto-create default project if none exists
            project, _ = DesignProject.objects.get_or_create(
                workspace_id=ws_id,
                name='My Designs',
                defaults={'created_by': request.user},
            )

        # Resolve optional idea
        idea = None
        if idea_id:
            from idea_app.models import Idea
            idea = get_object_or_404(Idea, pk=idea_id, workspace_id=ws_id)

        # Validate multimodal support
        source_image_url = serializer.validated_data.get('source_image_url', '')
        source_image_url_2 = serializer.validated_data.get('source_image_url_2', '')
        mode = serializer.validated_data.get('mode', DesignGenerationRun.Mode.TEXT_TO_IMAGE)
        model_key = serializer.validated_data['model']

        _IMAGE_MODES = {
            DesignGenerationRun.Mode.IMAGE_TO_IMAGE,
            DesignGenerationRun.Mode.IMAGE_TO_IMAGE_EDIT,
            DesignGenerationRun.Mode.REMIX,
        }
        if source_image_url or mode in _IMAGE_MODES:
            from design_app.services.image_generator import MULTIMODAL_MODELS
            if model_key not in MULTIMODAL_MODELS:
                return Response(
                    {'error': 'Selected model does not support image input. '
                     'Use a multimodal model or remove the reference image.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Create generation run
        run = DesignGenerationRun.objects.create(
            idea=idea,
            model_name=serializer.validated_data['model'],
            generation_mode=mode,
            status=DesignGenerationRun.Status.PENDING,
            triggered_by=request.user,
            prompt_used=serializer.validated_data['prompt'],
            source_image_url=source_image_url,
            source_image_url_2=source_image_url_2,
            # PROJ-34 AC-5: persist UI bg_color selection onto the Run.
            background_color=serializer.validated_data.get(
                'background_color', 'light_gray',
            ),
        )

        # Enqueue to design worker
        queue = django_rq.get_queue('design')
        job = queue.enqueue(
            task_generate_design,
            str(run.id),
            str(project.id),
            serializer.validated_data.get('aspect_ratio', '1:1'),
            mode,
        )
        run.rq_job_id = job.id
        run.save(update_fields=['rq_job_id'])

        return Response(
            {
                **DesignGenerationRunSerializer(run).data,
                'project_id': str(project.id),
            },
            status=status.HTTP_202_ACCEPTED,
        )


# -- Product Image Analysis (C1.5) --

class ProductAnalyzeImageView(APIView):
    """POST /api/products/{product_id}/analyze-image/ — analyze Amazon product image."""

    def post(self, request, product_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        from scraper_app.models import AmazonProduct
        product = get_object_or_404(AmazonProduct, pk=product_id)

        serializer = ProductAnalyzeImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        source_url = serializer.validated_data['source_image_url']

        # Reuse check: if prompt_analysis already populated, return immediately
        if product.prompt_analysis:
            return Response({
                'status': 'reused',
                'product_id': str(product.id),
                'prompt_analysis': product.prompt_analysis,
            })

        # Enqueue analysis job
        from design_app.tasks import task_analyze_product_image
        queue = django_rq.get_queue('design')
        job = queue.enqueue(
            task_analyze_product_image,
            str(product.id),
            source_url,
        )

        return Response(
            {
                'status': 'pending',
                'job_id': job.id,
                'product_id': str(product.id),
            },
            status=status.HTTP_202_ACCEPTED,
        )


# -- Revert to Original --

class DesignRevertView(APIView):
    """POST /api/designs/{id}/revert/ — delete processed files, revert to original."""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        design = get_object_or_404(Design, pk=pk, workspace_id=ws_id)

        has_bg = bool(design.bg_removed_file)
        has_upscaled = bool(design.upscaled_file)
        has_processed = bool(design.processed_file)

        if not has_bg and not has_upscaled and not has_processed:
            return Response(
                {'error': 'No processed files to revert.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Delete files from disk
        if has_bg:
            design.bg_removed_file.delete(save=False)
        if has_upscaled:
            design.upscaled_file.delete(save=False)
        if has_processed:
            design.processed_file.delete(save=False)

        # Clear DB fields
        design.bg_removed_file = ''
        design.upscaled_file = ''
        design.processed_file = ''
        design.save(update_fields=['bg_removed_file', 'upscaled_file', 'processed_file'])

        return Response(DesignSerializer(design).data)


# -- Save Processed Image --

ALLOWED_IMAGE_TYPES = {'image/png', 'image/jpeg', 'image/webp'}
MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 MB


class DesignSaveProcessedView(APIView):
    """POST /api/designs/{id}/save-processed/ — save processed upload to processed_file."""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        design = get_object_or_404(Design, pk=pk, workspace_id=ws_id)

        uploaded = request.FILES.get('file')
        if not uploaded:
            raise DRFValidationError({'file': 'No file provided.'})

        if uploaded.content_type not in ALLOWED_IMAGE_TYPES:
            raise DRFValidationError(
                {'file': f'Invalid type {uploaded.content_type}. Allowed: png, jpeg, webp.'},
            )

        if uploaded.size > MAX_UPLOAD_SIZE:
            raise DRFValidationError(
                {'file': f'File too large ({uploaded.size} bytes). Max 25 MB.'},
            )

        # Delete old processed file from disk (not image_file — that stays as original)
        if design.processed_file:
            design.processed_file.delete(save=False)

        # Save new file to processed_file
        design.processed_file = uploaded
        design.save(update_fields=['processed_file'])

        return Response(DesignSerializer(design).data)


# -- Delete Specific Version --

VERSION_FIELD_MAP = {
    'original': 'image_file',
    'processed': 'processed_file',
    'bg_removed': 'bg_removed_file',
    'upscaled': 'upscaled_file',
}


class DesignDeleteVersionView(APIView):
    """POST /api/designs/{id}/delete-version/ — delete a specific file version."""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        design = get_object_or_404(Design, pk=pk, workspace_id=ws_id)

        version = request.data.get('version')
        if version not in VERSION_FIELD_MAP:
            raise DRFValidationError(
                {'version': f'Invalid version "{version}". '
                            f'Allowed: {", ".join(VERSION_FIELD_MAP.keys())}.'},
            )

        field_name = VERSION_FIELD_MAP[version]
        file_field = getattr(design, field_name)

        if not file_field:
            return Response(
                {'error': f'No {version} file exists for this design.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Delete file from disk and clear field
        file_field.delete(save=False)
        setattr(design, field_name, '')
        design.save(update_fields=[field_name])

        return Response(DesignSerializer(design).data)


# -- Manual Upload to Project (Artboard Canvas) --

class ProjectUploadView(APIView):
    """POST /api/designs/projects/{id}/upload/ — upload image, create Design + M2M link."""

    def post(self, request, project_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=project_id, workspace_id=ws_id,
        )

        serializer = DesignUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data['file']

        # Create Design record
        design = Design.objects.create(
            workspace_id=ws_id,
            image_file=uploaded_file,
            status=Design.Status.APPROVED,
            is_manual=True,
        )

        # Link to project via M2M
        DesignProjectDesign.objects.create(
            project=project,
            design=design,
        )

        return Response(
            DesignSerializer(design).data,
            status=status.HTTP_201_CREATED,
        )


# -- Slogan Pool CRUD (G2) --

class ProjectIdeasView(APIView):
    """POST /api/designs/projects/{id}/ideas/ — add ideas to slogan pool."""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )

        serializer = AddIdeasToPoolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        idea_ids = serializer.validated_data['idea_ids']

        # Validate ideas belong to same workspace
        from idea_app.models import Idea
        valid_ideas = Idea.objects.filter(
            id__in=idea_ids, workspace_id=ws_id,
        ).values_list('id', flat=True)

        # Auto-assign position starting after max existing
        max_pos = (
            DesignProjectIdea.objects.filter(project=project)
            .order_by('-position')
            .values_list('position', flat=True)
            .first()
        ) or 0

        links = []
        for idx, idea_id in enumerate(valid_ideas):
            links.append(
                DesignProjectIdea(
                    project=project,
                    idea_id=idea_id,
                    position=max_pos + idx + 1,
                ),
            )
        DesignProjectIdea.objects.bulk_create(links, ignore_conflicts=True)

        # Return updated pool
        pool_items = (
            DesignProjectIdea.objects.filter(project=project)
            .select_related('idea', 'idea__niche')
            .order_by('position', '-added_at')
        )
        return Response(ProjectIdeaSerializer(pool_items, many=True).data)


class ProjectIdeaRemoveView(APIView):
    """DELETE /api/designs/projects/{id}/ideas/{ideaId}/ — remove from pool."""

    def delete(self, request, pk, idea_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )

        link = get_object_or_404(
            DesignProjectIdea, project=project, idea_id=idea_id,
        )
        link.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


# -- ProjectReference (I2) --

class ProjectReferencesView(APIView):
    """POST /api/designs/projects/{id}/references/ — bulk add references."""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )

        data = request.data

        # Determine max existing position for auto-increment
        max_pos = (
            ProjectReference.objects.filter(project=project)
            .order_by('-position')
            .values_list('position', flat=True)
            .first()
        ) or 0


        # Path 1: product_ids — bulk create from AmazonProduct records
        if 'product_ids' in data:
            serializer = AddReferencesFromProductsSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            product_ids = serializer.validated_data['product_ids']

            from scraper_app.models import AmazonProduct
            products = AmazonProduct.objects.filter(
                id__in=product_ids,
            ).only('id', 'thumbnail_url', 'title', 'asin')

            # Existing image_urls in project for dedup
            existing_urls = set(
                ProjectReference.objects.filter(project=project)
                .values_list('image_url', flat=True)
            )

            refs_to_create = []
            for product in products:
                img_url = product.thumbnail_url or ''
                if not img_url or img_url in existing_urls:
                    continue
                existing_urls.add(img_url)
                max_pos += 1
                refs_to_create.append(
                    ProjectReference(
                        project=project,
                        source_product=product,
                        image_url=img_url,
                        title=product.title[:500] if product.title else '',
                        asin=product.asin or '',
                        position=max_pos,
                    ),
                )

            if refs_to_create:
                ProjectReference.objects.bulk_create(
                    refs_to_create, ignore_conflicts=True,
                )

        # Path 2: image_urls — manual references
        elif 'image_urls' in data:
            serializer = AddManualReferencesSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            items = serializer.validated_data['image_urls']

            existing_urls = set(
                ProjectReference.objects.filter(project=project)
                .values_list('image_url', flat=True)
            )

            refs_to_create = []
            for item in items:
                url = item['url']
                if url in existing_urls:
                    continue
                existing_urls.add(url)
                max_pos += 1
                refs_to_create.append(
                    ProjectReference(
                        project=project,
                        image_url=url,
                        title=item.get('title', ''),
                        position=max_pos,
                    ),
                )

            if refs_to_create:
                ProjectReference.objects.bulk_create(
                    refs_to_create, ignore_conflicts=True,
                )

        else:
            return Response(
                {'error': 'Provide either product_ids or image_urls.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Return all project references (not just created)
        all_refs = (
            ProjectReference.objects.filter(project=project)
            .select_related('source_product')
            .order_by('position', '-added_at')
        )
        return Response(
            ProjectReferenceSerializer(all_refs, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectReferenceRemoveView(APIView):
    """DELETE /api/designs/projects/{id}/references/{refId}/ — remove ref."""

    def delete(self, request, pk, ref_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )

        ref = get_object_or_404(
            ProjectReference, pk=ref_id, project=project,
        )
        ref.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)



# -- ProjectPrompt CRUD (G9) --

class ProjectPromptsView(APIView):
    """POST /api/designs/projects/{id}/prompts/ — bulk create prompts."""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )

        serializer = BulkCreatePromptsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        created = []
        for item in serializer.validated_data['prompts']:
            source_idea_id = item.get('source_idea')
            source_idea = None
            if source_idea_id:
                from idea_app.models import Idea
                try:
                    source_idea = Idea.objects.get(
                        pk=source_idea_id, workspace_id=ws_id,
                    )
                except Idea.DoesNotExist:
                    pass

            prompt = ProjectPrompt.objects.create(
                project=project,
                prompt_text=item['prompt_text'],
                sources=item.get('sources', {}),
                source_idea=source_idea,
                source_image_url=item.get('source_image_url', ''),
                variant_index=item.get('variant_index', 0),
            )
            created.append(prompt)

        return Response(
            ProjectPromptSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectPromptDetailView(APIView):
    """PATCH/DELETE /api/designs/projects/{id}/prompts/{promptId}/"""

    def patch(self, request, pk, prompt_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )
        prompt = get_object_or_404(
            ProjectPrompt, pk=prompt_id, project=project,
        )

        serializer = UpdatePromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        prompt.prompt_text = serializer.validated_data['prompt_text']
        prompt.save(update_fields=['prompt_text', 'updated_at'])

        return Response(ProjectPromptSerializer(prompt).data)

    def delete(self, request, pk, prompt_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )
        prompt = get_object_or_404(
            ProjectPrompt, pk=prompt_id, project=project,
        )
        prompt.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


class GenerateFromPromptView(APIView):
    """POST /api/designs/projects/{id}/prompts/{promptId}/generate/"""

    def post(self, request, pk, prompt_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )
        prompt = get_object_or_404(
            ProjectPrompt.objects.select_related('source_idea'),
            pk=prompt_id,
            project=project,
        )

        serializer = GenerateFromPromptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mode = serializer.validated_data.get('mode', DesignGenerationRun.Mode.TEXT_TO_IMAGE)
        source_image_url = serializer.validated_data.get('source_image_url', '')
        source_image_url_2 = serializer.validated_data.get('source_image_url_2', '')

        # Use prompt's source_image_url as fallback for image modes
        if not source_image_url and prompt.source_image_url:
            source_image_url = prompt.source_image_url

        # Validate multimodal support for image-based modes
        _IMAGE_MODES = {
            DesignGenerationRun.Mode.IMAGE_TO_IMAGE,
            DesignGenerationRun.Mode.IMAGE_TO_IMAGE_EDIT,
            DesignGenerationRun.Mode.REMIX,
        }
        if mode in _IMAGE_MODES:
            from design_app.services.image_generator import MULTIMODAL_MODELS
            if serializer.validated_data['model'] not in MULTIMODAL_MODELS:
                return Response(
                    {'error': 'Selected model does not support image input. '
                     'Use a multimodal model for image-based generation.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        run = DesignGenerationRun.objects.create(
            idea=prompt.source_idea,
            project_prompt=prompt,
            model_name=serializer.validated_data['model'],
            generation_mode=mode,
            status=DesignGenerationRun.Status.PENDING,
            triggered_by=request.user,
            prompt_used=prompt.prompt_text,
            source_image_url=source_image_url,
            source_image_url_2=source_image_url_2,
            # PROJ-34 AC-5: persist UI bg_color selection onto the Run.
            background_color=serializer.validated_data.get(
                'background_color', 'light_gray',
            ),
        )

        queue = django_rq.get_queue('design')
        job = queue.enqueue(
            task_generate_design,
            str(run.id),
            str(project.id),
            serializer.validated_data.get('aspect_ratio', '1:1'),
            mode,
        )
        run.rq_job_id = job.id
        run.save(update_fields=['rq_job_id'])

        return Response(
            DesignGenerationRunSerializer(run).data,
            status=status.HTTP_202_ACCEPTED,
        )


# -- Prompt Builder (G10) --

class BuildPromptsView(APIView):
    """POST /api/designs/projects/{id}/build-prompts/"""

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject.objects.select_related('niche'),
            pk=pk,
            workspace_id=ws_id,
        )

        serializer = BuildPromptsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        sources = serializer.validated_data['sources']
        slogan_id = serializer.validated_data.get('slogan_id')
        image_url = serializer.validated_data.get('image_url')
        variants = serializer.validated_data.get('variants', 1)

        # Gather source data
        idea = None
        if sources.get('slogan') and slogan_id:
            from idea_app.models import Idea
            try:
                idea = Idea.objects.select_related('niche').get(
                    pk=slogan_id, workspace_id=ws_id,
                )
            except Idea.DoesNotExist:
                pass

        # Keywords
        keywords = None
        if sources.get('keywords') and project.niche:
            from keyword_app.models import NicheKeyword
            keywords = list(
                NicheKeyword.objects.filter(niche=project.niche)
                .order_by('position')
                .values_list('keyword', flat=True)[:20]
            )

        # Research data
        research_data = None
        if sources.get('research') and project.niche:
            research_data = _gather_research_data(project.niche)

        # Image analysis
        image_analysis = None
        if sources.get('image') and image_url:
            from design_app.services.image_analyzer import analyze_image
            try:
                image_analysis = analyze_image(image_url)
            except Exception:
                logger.exception('Image analysis failed for %s', image_url)

        # Build prompts (one per variant)
        from design_app.services.prompt_builder import build_from_sources
        prompts = []
        for v in range(variants):
            prompt_text = build_from_sources(
                sources_config=sources,
                idea=idea,
                keywords=keywords,
                research_data=research_data,
                image_analysis=image_analysis,
                variant_index=v,
            )
            prompts.append({
                'prompt_text': prompt_text,
                'sources': sources,
            })

        return Response({'prompts': prompts})


def _gather_research_data(niche):
    """Gather niche research data for prompt building."""
    from niche_research_app.models import (
        NicheProductEmotionalAnalysis,
        NicheProductVisionAnalysis,
        NicheResearch,
        NicheResearchProduct,
    )

    latest = NicheResearch.objects.filter(
        niche=niche,
        status=NicheResearch.Status.COMPLETED,
    ).order_by('-created_at').first()

    if not latest:
        return None

    products = NicheResearchProduct.objects.filter(
        research=latest, brand_blocked=False,
    ).select_related('product')[:10]

    product_ids = [rp.product_id for rp in products]

    visions = NicheProductVisionAnalysis.objects.filter(
        research=latest, product_id__in=product_ids,
    )
    emotionals = NicheProductEmotionalAnalysis.objects.filter(
        research=latest, product_id__in=product_ids,
    )

    styles = set()
    elements = set()
    vibes = set()
    tones = set()

    for v in visions:
        if v.visual_style:
            styles.add(v.visual_style)
        if v.graphic_elements:
            elements.add(v.graphic_elements)
    for e in emotionals:
        if e.tone:
            tones.add(e.tone)
        if e.vibe:
            vibe_val = e.vibe
            if isinstance(vibe_val, dict):
                vibe_val = vibe_val.get('primary', '')
            if isinstance(vibe_val, str) and vibe_val:
                vibes.add(vibe_val)

    return {
        'visual_styles': list(styles)[:5],
        'graphic_elements': list(elements)[:5],
        'vibes': list(vibes)[:5],
        'tones': list(tones)[:5],
    }


# -- Prompt Presets (G10) --

class PromptPresetListCreateView(APIView):
    """GET/POST /api/designs/prompt-presets/"""

    def get(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        presets = PromptPreset.objects.filter(workspace_id=ws_id)
        return Response(PromptPresetSerializer(presets, many=True).data)

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = CreatePromptPresetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        preset = PromptPreset.objects.create(
            workspace_id=ws_id,
            name=serializer.validated_data['name'],
            source_config=serializer.validated_data['source_config'],
            created_by=request.user,
        )

        return Response(
            PromptPresetSerializer(preset).data,
            status=status.HTTP_201_CREATED,
        )


class PromptPresetDeleteView(APIView):
    """DELETE /api/designs/prompt-presets/{id}/"""

    def delete(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        preset = get_object_or_404(
            PromptPreset, pk=pk, workspace_id=ws_id,
        )
        preset.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)


# -- PROJ-34 Multi-Prompt Builder API --

class BuilderBuildView(APIView):
    """POST /api/designs/projects/{id}/builder/build/

    Cross-product Builder (PROJ-34 Phase 5; Phase 13k removed the legacy
    warp field). Given N slogans × M styles (+ optional niche-context
    toggle, bg_color), returns N×M prompts in cross-product order:
    (slogan[0]×style[0]), (slogan[0]×style[1]), ...

    Polish is parallel-bounded by `workspace.ProcessingSettings
    .polish_builder_prompts_enabled` AND the request's `with_polish` flag
    (AC-16 / EC-7). Failures degrade to raw prompts (AC-18 — see
    prompt_polish.polish_prompt).
    """

    # Cap on concurrent polish worker threads; matches the AC-19 latency
    # budget (≤5s for ≤50 polishes when calls run in parallel).
    _POLISH_MAX_WORKERS = 16

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject.objects.select_related('niche'),
            pk=pk,
            workspace_id=ws_id,
        )

        serializer = BuilderBuildSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cfg = serializer.validated_data

        slogans: list[str] = [s.strip() for s in cfg['slogans'] if s and s.strip()]
        styles: list[str] = [s.strip() for s in cfg['styles'] if s and s.strip()]
        bg_color = cfg.get('background_color', 'light_gray')
        with_polish = cfg.get('with_polish', True)
        include_niche_context = cfg.get('include_niche_context', True)
        slots: dict = cfg.get('slots') or {}

        # EC-9 / EC-10: defensive guards even though frontend disables Build.
        if not slogans:
            return Response(
                {'error': 'Select at least one slogan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not styles:
            return Response(
                {'error': 'Select at least one style.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # EC-16 / EC-23: niche-context silently ignored if no linked niche.
        # Phase 13b consumes the structured `builder_form_hints` JSON (set by
        # Phase 13c's niche-vision LLM) — NOT the verbatim research dump.
        # The field lands in Phase 13c; until then `getattr` returns None and
        # the resolver falls through to style defaults.
        niche_hints: dict | None = None
        if include_niche_context and project.niche_id:
            niche_hints = getattr(project.niche, 'builder_form_hints', None)

        # Build raw prompts in cross-product order.
        from design_app.services.prompt_builder import build_form_prompt
        raw_prompts: list[str] = []
        for slogan in slogans:
            for style in styles:
                raw_prompts.append(
                    build_form_prompt(
                        slogan=slogan,
                        style_slug=style,
                        slots=slots,
                        background_color=bg_color,
                        niche_hints=niche_hints,
                        workspace_id=ws_id,
                    )
                )

        # Resolve workspace-level polish toggle.
        try:
            ps = ProcessingSettings.objects.get(workspace_id=ws_id)
            workspace_polish_enabled = ps.polish_builder_prompts_enabled
        except ProcessingSettings.DoesNotExist:
            workspace_polish_enabled = True

        run_polish = with_polish and workspace_polish_enabled
        final_prompts = _maybe_polish_parallel(raw_prompts, run_polish)
        return Response({'prompts': final_prompts}, status=status.HTTP_200_OK)


def _maybe_polish_parallel(raw_prompts: list[str], run_polish: bool) -> list[str]:
    """Polish all prompts in parallel via a thread pool (preserves order).

    Polish is a sync httpx call; threads are simpler than asyncio here
    and the per-call 5s timeout caps total wall-clock at ~5s for any
    realistic Build (≤50 prompts) with `_POLISH_MAX_WORKERS` workers.
    """
    if not run_polish:
        return raw_prompts

    from concurrent.futures import ThreadPoolExecutor
    from design_app.services.prompt_polish import polish_prompt

    max_workers = min(len(raw_prompts), BuilderBuildView._POLISH_MAX_WORKERS)
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        # map() preserves input order — exactly what we need for AC-36.
        return list(pool.map(polish_prompt, raw_prompts))


# -- PROJ-34 Phase 13c — Niche Builder Hints --

class BuilderNicheHintsView(APIView):
    """GET /api/designs/projects/{id}/builder/niche-hints/

    Returns the structured `Niche.builder_form_hints` dict produced by
    `niche_app.services.builder_hints.structure_niche_for_builder` for the
    project's linked niche, plus the niche id + the hint's `_generated_at`
    timestamp so the frontend can show "auto from niche" badges.

    When the project has no linked niche (or the niche has no hints yet —
    EC-26), returns a null trio. Workspace isolation is enforced by the
    `get_object_or_404(workspace_id=ws_id)` filter (cross-workspace → 404).
    """

    def get(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        project = get_object_or_404(
            DesignProject.objects.select_related('niche'),
            pk=pk,
            workspace_id=ws_id,
        )

        if project.niche_id is None:
            return Response(
                {
                    'builder_form_hints': None,
                    'niche_id': None,
                    'last_updated': None,
                },
                status=status.HTTP_200_OK,
            )

        hints = project.niche.builder_form_hints
        last_updated = None
        if isinstance(hints, dict):
            last_updated = hints.get('_generated_at')

        return Response(
            {
                'builder_form_hints': hints,
                'niche_id': str(project.niche_id),
                'last_updated': last_updated,
            },
            status=status.HTTP_200_OK,
        )


# -- PROJ-34 Phase 13t-e — Best-of-Mix Collage Endpoint (AC-88, AC-122) --

class CollageView(APIView):
    """GET /api/designs/preset-cards/collage/<uuid:niche_id>.webp

    Returns the server-rendered Best-of-Mix top-3 product collage as
    ``image/webp``. Triggers regeneration if the cached file is missing
    or older than 7 days. Workspace isolation: niche must belong to the
    caller's workspace (cross-workspace → 404).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, niche_id):
        from django.http import HttpResponse

        from design_app.services.collage_renderer import (
            get_or_generate_collage_bytes,
        )
        from niche_app.models import Niche

        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        niche = get_object_or_404(Niche, pk=niche_id, workspace_id=ws_id)
        cache_dict = niche.best_of_mix_cache or {}
        product_ids = cache_dict.get('top3_product_ids') or []

        data = get_or_generate_collage_bytes(niche.id, product_ids)
        response = HttpResponse(data, content_type='image/webp')
        response['Cache-Control'] = 'public, max-age=86400'
        return response


# -- PROJ-34 BuilderPreset CRUD --

class BuilderPresetListCreateView(APIView):
    """GET / POST /api/designs/projects/{id}/builder-presets/"""

    def get(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        # Tenant isolation: project must belong to caller's workspace.
        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )
        qs = BuilderPreset.objects.filter(
            workspace_id=ws_id, project=project, is_deleted=False,
        )
        return Response(BuilderPresetSerializer(qs, many=True).data)

    def post(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )
        serializer = BuilderPresetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # EC-19: name must be unique among non-deleted rows for the project.
        name = serializer.validated_data['name']
        if BuilderPreset.objects.filter(
            project=project, name=name, is_deleted=False,
        ).exists():
            return Response(
                {'error': 'Preset name already exists in this project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        preset = BuilderPreset.objects.create(
            workspace_id=ws_id,
            project=project,
            name=name,
            config=serializer.validated_data.get('config', {}),
            created_by=request.user,
        )
        return Response(
            BuilderPresetSerializer(preset).data,
            status=status.HTTP_201_CREATED,
        )


class BuilderPresetDetailView(APIView):
    """PATCH / DELETE /api/designs/projects/{id}/builder-presets/{preset_id}/"""

    def patch(self, request, pk, preset_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )
        preset = get_object_or_404(
            BuilderPreset,
            pk=preset_id, workspace_id=ws_id, project=project, is_deleted=False,
        )

        serializer = BuilderPresetSerializer(preset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # EC-19: re-check name uniqueness on rename.
        new_name = serializer.validated_data.get('name')
        if new_name and new_name != preset.name and BuilderPreset.objects.filter(
            project=project, name=new_name, is_deleted=False,
        ).exclude(pk=preset.pk).exists():
            return Response(
                {'error': 'Preset name already exists in this project.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save()
        return Response(BuilderPresetSerializer(preset).data)

    def delete(self, request, pk, preset_id):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        project = get_object_or_404(
            DesignProject, pk=pk, workspace_id=ws_id,
        )
        preset = get_object_or_404(
            BuilderPreset,
            pk=preset_id, workspace_id=ws_id, project=project, is_deleted=False,
        )
        # AC-46: soft-delete via flag (partial UniqueConstraint allows name re-use).
        preset.is_deleted = True
        preset.save(update_fields=['is_deleted', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# -- PROJ-34 Phase 13d — CustomSpatial (Analyze + CRUD) --

class CustomSpatialAnalyzeView(APIView):
    """POST /api/designs/spatials/custom/analyze/ — vision-LLM spatial extractor.

    Accepts one of:
      - ``image`` (multipart upload, ≤10 MB, JPG/PNG/WebP) — EC-30
      - ``reference_id`` (UUID of a ProjectReference in caller's workspace)
      - ``design_id`` (UUID of a Design in caller's workspace)

    Returns ``{prompt_text, model}`` (200) or one of:
      - 400 missing X-Workspace-Id / serializer validation
      - 404 cross-workspace reference/design or not found
      - 422 ``spatial_unclear`` (LLM returned LAYOUT_UNCLEAR sentinel)
      - 422 ``spatial_analysis_failed`` (forbidden terms detected by scrub)
      - 502 ``analyzer_unavailable`` (network / HTTP / parse error)
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = CustomSpatialAnalyzeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # ---- Resolve image bytes + mime ---------------------------------
        if data.get('image'):
            upload = request.FILES['image']
            image_bytes = upload.read()
            mime = upload.content_type or 'image/jpeg'
            source_kind = 'upload'
        elif data.get('reference_id'):
            ref = get_object_or_404(
                ProjectReference,
                id=data['reference_id'],
                project__workspace_id=ws_id,
            )
            # ProjectReference stores a URL — fetch bytes via httpx so we
            # forward them as base64 to the vision LLM.
            try:
                r = httpx.get(ref.image_url, timeout=10.0)
                r.raise_for_status()
                image_bytes = r.content
                mime = (
                    r.headers.get('content-type', '').split(';')[0].strip()
                    or 'image/jpeg'
                )
            except Exception as exc:  # noqa: BLE001 — surface as analyzer-down
                logger.warning(
                    'CustomSpatialAnalyze: reference fetch failed %s: %s',
                    type(exc).__name__, exc,
                )
                return Response(
                    {'error': 'analyzer_unavailable'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            source_kind = 'reference'
        else:
            design = get_object_or_404(
                Design,
                id=data['design_id'],
                workspace_id=ws_id,
            )
            if not design.image_file:
                return Response(
                    {'error': 'design has no image_file'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            try:
                with design.image_file.open('rb') as fh:
                    image_bytes = fh.read()
            except Exception:  # noqa: BLE001 — fall back to .read()
                image_bytes = design.image_file.read()
            import mimetypes as _mimetypes
            mime, _ = _mimetypes.guess_type(design.image_file.name)
            mime = mime or 'image/png'
            source_kind = 'design'

        # ---- Call vision LLM --------------------------------------------
        from design_app.services.spatial_analyzer import (
            SpatialAnalyzerError,
            SpatialUnclearError,
            _scrub_forbidden,
            analyze_spatial_layout,
        )

        try:
            text = analyze_spatial_layout(
                image_bytes,
                mime=mime,
                workspace_id=str(ws_id),
                user_id=str(request.user.id),
                source_kind=source_kind,
            )
        except SpatialUnclearError:
            return Response(
                {'error': 'spatial_unclear'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except SpatialAnalyzerError:
            return Response(
                {'error': 'analyzer_unavailable'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        ok, hits = _scrub_forbidden(text)
        if not ok:
            return Response(
                {
                    'error': 'spatial_analysis_failed',
                    'forbidden_terms': hits,
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        return Response(
            {'prompt_text': text, 'model': 'openai/gpt-4.1-mini'},
            status=status.HTTP_200_OK,
        )


class CustomSpatialListCreateView(APIView):
    """GET / POST /api/designs/spatials/custom/ — workspace-scoped CustomSpatial CRUD."""

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        qs = (
            CustomSpatial.objects
            .filter(workspace_id=ws_id, is_deleted=False)
            .order_by('-created_at')
        )
        return Response(
            CustomSpatialSerializer(qs, many=True).data,
        )

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        from workspace_app.models import Workspace
        workspace = get_object_or_404(Workspace, pk=ws_id)
        serializer = CustomSpatialSerializer(
            data=request.data, context={'workspace': workspace},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(
            workspace=workspace,
            created_by=request.user,
        )
        return Response(
            CustomSpatialSerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )


class CustomSpatialDetailView(APIView):
    """DELETE /api/designs/spatials/custom/{id}/ — soft-delete a CustomSpatial."""

    def delete(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        instance = get_object_or_404(
            CustomSpatial,
            pk=pk,
            workspace_id=ws_id,
            is_deleted=False,
        )
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# -- PROJ-34 Phase 13i — CustomTypography (Analyze + CRUD) --

class CustomTypographyAnalyzeView(APIView):
    """POST /api/designs/typography/custom/analyze/ — vision-LLM typography extractor.

    Accepts one of:
      - ``image`` (multipart upload, ≤10 MB, JPG/PNG/WebP)
      - ``reference_id`` (UUID of a ProjectReference in caller's workspace)
      - ``design_id`` (UUID of a Design in caller's workspace)

    Returns ``{prompt_text, model}`` (200) or one of:
      - 400 missing X-Workspace-Id / serializer validation
      - 404 cross-workspace reference/design or not found
      - 422 ``typography_unclear`` (LLM returned TYPOGRAPHY_UNCLEAR sentinel)
      - 422 ``typography_analysis_failed`` (forbidden terms detected by scrub)
      - 502 ``analyzer_unavailable`` (network / HTTP / parse error)
    """

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = CustomTypographyAnalyzeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # ---- Resolve image bytes + mime ---------------------------------
        if data.get('image'):
            upload = request.FILES['image']
            image_bytes = upload.read()
            mime = upload.content_type or 'image/jpeg'
            source_kind = 'upload'
        elif data.get('reference_id'):
            ref = get_object_or_404(
                ProjectReference,
                id=data['reference_id'],
                project__workspace_id=ws_id,
            )
            # ProjectReference stores a URL — fetch bytes via httpx so we
            # forward them as base64 to the vision LLM.
            try:
                r = httpx.get(ref.image_url, timeout=10.0)
                r.raise_for_status()
                image_bytes = r.content
                mime = (
                    r.headers.get('content-type', '').split(';')[0].strip()
                    or 'image/jpeg'
                )
            except Exception as exc:  # noqa: BLE001 — surface as analyzer-down
                logger.warning(
                    'CustomTypographyAnalyze: reference fetch failed %s: %s',
                    type(exc).__name__, exc,
                )
                return Response(
                    {'error': 'analyzer_unavailable'},
                    status=status.HTTP_502_BAD_GATEWAY,
                )
            source_kind = 'reference'
        else:
            design = get_object_or_404(
                Design,
                id=data['design_id'],
                workspace_id=ws_id,
            )
            if not design.image_file:
                return Response(
                    {'error': 'design has no image_file'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            try:
                with design.image_file.open('rb') as fh:
                    image_bytes = fh.read()
            except Exception:  # noqa: BLE001 — fall back to .read()
                image_bytes = design.image_file.read()
            import mimetypes as _mimetypes
            mime, _ = _mimetypes.guess_type(design.image_file.name)
            mime = mime or 'image/png'
            source_kind = 'design'

        # ---- Call vision LLM --------------------------------------------
        from design_app.services.typography_analyzer import (
            TypographyAnalyzerError,
            TypographyUnclearError,
            _scrub_forbidden,
            analyze_typography_style,
        )

        try:
            text = analyze_typography_style(
                image_bytes,
                mime=mime,
                workspace_id=str(ws_id),
                user_id=str(request.user.id),
                source_kind=source_kind,
            )
        except TypographyUnclearError:
            return Response(
                {'error': 'typography_unclear'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        except TypographyAnalyzerError:
            return Response(
                {'error': 'analyzer_unavailable'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        ok, hits = _scrub_forbidden(text)
        if not ok:
            return Response(
                {
                    'error': 'typography_analysis_failed',
                    'forbidden_terms': hits,
                },
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        return Response(
            {'prompt_text': text, 'model': 'openai/gpt-4.1-mini'},
            status=status.HTTP_200_OK,
        )


class CustomTypographyListCreateView(APIView):
    """GET / POST /api/designs/typography/custom/ — workspace-scoped CustomTypography CRUD."""

    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        qs = (
            CustomTypography.objects
            .filter(workspace_id=ws_id, is_deleted=False)
            .order_by('-created_at')
        )
        return Response(
            CustomTypographySerializer(qs, many=True).data,
        )

    def post(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        from workspace_app.models import Workspace
        workspace = get_object_or_404(Workspace, pk=ws_id)
        serializer = CustomTypographySerializer(
            data=request.data, context={'workspace': workspace},
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(
            workspace=workspace,
            created_by=request.user,
        )
        return Response(
            CustomTypographySerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )


class CustomTypographyDetailView(APIView):
    """DELETE /api/designs/typography/custom/{id}/ — soft-delete a CustomTypography."""

    def delete(self, request, pk):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        instance = get_object_or_404(
            CustomTypography,
            pk=pk,
            workspace_id=ws_id,
            is_deleted=False,
        )
        instance.is_deleted = True
        instance.save(update_fields=['is_deleted', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# -- PROJ-34 Phase 13t-g — NicheCardPreset endpoints --

class NicheCardPresetViewSet(viewsets.GenericViewSet):
    """Niche-Reference Preset Picker endpoints (PROJ-34 Phase 13t).

    Six actions:
      * ``list``           — GET /api/designs/preset-cards/?niche_id=<uuid>
      * ``history``        — GET /api/designs/preset-cards/history/
      * ``custom``         — GET /api/designs/preset-cards/custom/
      * ``confirm``        — POST /api/designs/preset-cards/confirm/
      * ``promote_custom`` — POST /api/designs/preset-cards/<id>/promote-custom/
      * ``custom_remove``  — DELETE /api/designs/preset-cards/<id>/custom/
      * ``regenerate_mix`` — POST /api/designs/preset-cards/regenerate-mix/

    All endpoints: ``IsAuthenticated`` + workspace isolation via
    ``X-Workspace-Id`` header. ``regenerate_mix`` adds a 5/h/user
    ``ScopedRateThrottle`` (scope ``preset_regenerate``, AC-89).
    """

    permission_classes = [IsAuthenticated]
    serializer_class = NicheCardPresetSerializer

    def get_queryset(self):
        ws_id = _get_workspace_id(self.request)
        if not ws_id:
            return NicheCardPreset.objects.none()
        return NicheCardPreset.objects.filter(workspace_id=ws_id)

    # -- list (Vorschläge): niche-scoped Top + Best-of-Mix -----------------

    def list(self, request):
        """Return Vorschläge structure for one niche.

        Shape::
          {
            "top": [<Top-Card preset_dict>, ...]       # up to 10
            "best_of_mix": {
              "most_common": <preset_dict | null>,
              "edgy":        <preset_dict | null>,
              "safe":        <preset_dict | null>,
            },
            "top3_product_ids": [<uuid>, ...]
          }

        On Best-of-Mix cache-miss, enqueues async LLM generation via
        ``django_rq`` and returns ``null`` placeholders with HTTP 202 so the
        frontend can poll. Top-cards are computed in-memory (not persisted) —
        they only land in History via the ``confirm`` action (AC-95).
        """
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        niche_id = request.query_params.get('niche_id')
        if not niche_id:
            return Response(
                {'error': 'niche_id query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from niche_app.models import Niche
        niche = get_object_or_404(Niche, pk=niche_id, workspace_id=ws_id)

        # ---- Top-10 Cards (computed in-memory, not persisted) -----------
        from design_app.services.preset_ranker import rank_top_products
        from design_app.services.top_card_builder import build_top_card_preset

        top_vision_rows = rank_top_products(niche, limit=10)
        top_cards = [
            build_top_card_preset(vision, niche) for vision in top_vision_rows
        ]

        # ---- Best-of-Mix (from cache or async-trigger) ------------------
        cache_dict = niche.best_of_mix_cache or {}
        has_variants = any(
            cache_dict.get(key) for key in ('most_common', 'edgy', 'safe')
        )

        response_status = status.HTTP_200_OK
        if not has_variants:
            # Cache-miss: enqueue async LLM generation. Frontend polls list.
            try:
                django_rq.enqueue(
                    'design_app.services.best_of_mix_generator.generate_best_of_mix',
                    str(niche.id),
                )
            except Exception as exc:  # noqa: BLE001 — best-effort enqueue
                logger.warning(
                    'NicheCardPresetViewSet.list: enqueue failed (%s): %s',
                    type(exc).__name__, exc,
                )
            response_status = status.HTTP_202_ACCEPTED

        collage_url = (
            f'/api/designs/preset-cards/collage/{niche.id}.webp'
        )

        def _mix_payload(variant_key: str):
            variant = cache_dict.get(variant_key)
            if not variant:
                return None
            payload = dict(variant)
            payload.setdefault(
                'preset_label',
                f'{variant_key.replace("_", "-").title()} Mix',
            )
            payload['reference_thumbnail_url'] = collage_url
            payload['source_card_type'] = f'mix_{variant_key}'
            payload['source_card_references'] = [
                {
                    'niche_id': str(niche.id),
                    'product_ids': cache_dict.get('top3_product_ids', []),
                },
            ]
            return payload

        return Response(
            {
                'top': top_cards,
                'best_of_mix': {
                    'most_common': _mix_payload('most_common'),
                    'edgy': _mix_payload('edgy'),
                    'safe': _mix_payload('safe'),
                },
                'top3_product_ids': cache_dict.get('top3_product_ids', []),
            },
            status=response_status,
        )

    # -- history -----------------------------------------------------------

    @action(detail=False, methods=['get'])
    def history(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        qs = (
            self.get_queryset()
            .filter(is_in_history=True)
            .order_by('-last_clicked_at')[:50]
        )
        return Response(NicheCardPresetSerializer(qs, many=True).data)

    # -- custom ------------------------------------------------------------

    @action(detail=False, methods=['get'])
    def custom(self, request):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        qs = (
            self.get_queryset()
            .filter(is_in_custom=True)
            .order_by('-custom_promoted_at')
        )
        return Response(NicheCardPresetSerializer(qs, many=True).data)

    # -- confirm -----------------------------------------------------------

    @action(detail=False, methods=['post'])
    def confirm(self, request):
        """Confirm a preset selection.

        Two paths (mutually exclusive — serializer enforces):
          * ``preset_id``  — existing row, bump ``last_clicked_at``.
          * ``preset_dict`` — Top-Card path: ``upsert_preset`` inserts /
            dedups / runs LRU eviction. ``source_card_type`` + ``source_refs``
            required alongside.
        """
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = PresetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if data.get('preset_id'):
            try:
                preset = self.get_queryset().get(id=data['preset_id'])
            except NicheCardPreset.DoesNotExist:
                return Response(
                    {'error': 'preset not found'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            preset.last_clicked_at = timezone.now()
            # Revive if previously evicted from History (AC-105 mirror).
            if not preset.is_in_history:
                preset.is_in_history = True
                preset.save(update_fields=[
                    'last_clicked_at', 'is_in_history', 'updated_at',
                ])
            else:
                preset.save(update_fields=['last_clicked_at', 'updated_at'])
            return Response(NicheCardPresetSerializer(preset).data)

        # Top-Card upsert path.
        from design_app.services import preset_persistence
        preset = preset_persistence.upsert_preset(
            workspace_id=ws_id,
            preset_dict=data['preset_dict'],
            source_card_type=data['source_card_type'],
            source_refs=data['source_refs'],
        )
        return Response(NicheCardPresetSerializer(preset).data)

    # -- promote_custom ----------------------------------------------------

    @action(detail=True, methods=['post'], url_path='promote-custom')
    def promote_custom(self, request, pk=None):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        # Workspace isolation: row must exist in caller's workspace.
        if not self.get_queryset().filter(pk=pk).exists():
            return Response(
                {'error': 'preset not found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        from design_app.services import preset_persistence
        result = preset_persistence.promote_to_custom(pk, request.user)
        if result is None:
            return Response(
                {'error': 'preset not found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(NicheCardPresetSerializer(result).data)

    # -- custom_remove -----------------------------------------------------

    @action(detail=True, methods=['delete'], url_path='custom')
    def custom_remove(self, request, pk=None):
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()
        if not self.get_queryset().filter(pk=pk).exists():
            return Response(
                {'error': 'preset not found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        from design_app.services import preset_persistence
        result = preset_persistence.unpromote_from_custom(pk)
        if result is None:
            return Response(
                {'error': 'preset not found'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    # -- regenerate_mix ----------------------------------------------------

    def get_throttles(self):
        """Apply ``preset_regenerate`` scope only to the ``regenerate_mix`` action."""
        if getattr(self, 'action', None) == 'regenerate_mix':
            self.throttle_scope = 'preset_regenerate'
            return [ScopedRateThrottle()]
        return super().get_throttles()

    @action(detail=False, methods=['post'], url_path='regenerate-mix')
    def regenerate_mix(self, request):
        """Force-regenerate Best-of-Mix variants for a niche + persist to History.

        AC-89: rate-limited 5/h/user via ``preset_regenerate`` scope.
        AC-90: all 3 variants inserted into History on success.
        """
        ws_id = _require_workspace(request)
        if not ws_id:
            return _ws_error()

        serializer = PresetRegenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        niche_id = serializer.validated_data['niche_id']

        from niche_app.models import Niche
        try:
            niche = Niche.objects.get(id=niche_id, workspace_id=ws_id)
        except Niche.DoesNotExist:
            return Response(
                {'error': 'niche not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        from design_app.services.best_of_mix_generator import (
            generate_best_of_mix,
        )
        cache_payload = generate_best_of_mix(niche.id, force=True)
        if cache_payload is None:
            return Response(
                {'error': 'generation_failed'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # AC-90: insert all 3 mix variants into History via upsert.
        from design_app.services import preset_persistence
        collage_url = (
            f'/api/designs/preset-cards/collage/{niche.id}.webp'
        )
        top3 = cache_payload.get('top3_product_ids', [])
        source_refs = [{
            'niche_id': str(niche.id),
            'product_ids': top3,
        }]
        for variant_key in ('most_common', 'edgy', 'safe'):
            variant_data = cache_payload.get(variant_key)
            if not variant_data:
                continue
            preset_dict = dict(variant_data)
            preset_dict.setdefault(
                'preset_label',
                f'{variant_key.replace("_", "-").title()} Mix',
            )
            preset_dict['reference_thumbnail_url'] = collage_url
            preset_persistence.upsert_preset(
                workspace_id=ws_id,
                preset_dict=preset_dict,
                source_card_type=f'mix_{variant_key}',
                source_refs=source_refs,
            )

        return Response(cache_payload)
