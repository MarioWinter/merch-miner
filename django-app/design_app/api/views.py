"""DRF views for design_app API."""

import logging

import django_rq
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
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
    BuildPromptsSerializer,
    BulkCreatePromptsSerializer,
    CreateProjectSerializer,
    CreatePromptPresetSerializer,
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
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    DesignProject,
    DesignProjectDesign,
    DesignProjectIdea,
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

        data = {
            'project': DesignProjectSerializer(project).data,
            'designs': DesignSerializer(designs, many=True).data,
            'board_layout': project.board_layout,
            'idea_context': idea_context,
            'ideas': ideas_data,
            'prompts': prompts_data,
            'references': references_data,
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
