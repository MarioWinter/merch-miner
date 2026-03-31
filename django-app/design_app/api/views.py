"""DRF views for design_app API."""

import logging

import django_rq
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from django.db.models import Count

from design_app.api.serializers import (
    AddDesignsToProjectSerializer,
    AnalyzeImageSerializer,
    ApplyPipelineSerializer,
    BatchProcessSerializer,
    CreateProjectSerializer,
    DesignPipelineSerializer,
    DesignProcessingJobSerializer,
    DesignGenerationRunSerializer,
    DesignProjectListSerializer,
    DesignProjectSerializer,
    DesignSerializer,
    DesignStatusUpdateSerializer,
    GenerateDesignSerializer,
    ProcessingSettingsSerializer,
    ProductAnalyzeImageSerializer,
    StandaloneGenerateSerializer,
    UpdateProjectSerializer,
)
from design_app.models import (
    Design,
    DesignGenerationRun,
    DesignPipeline,
    DesignProcessingJob,
    DesignProject,
    DesignProjectDesign,
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
        designs = (
            Design.objects.filter(
                design_projects_through__project=project,
            )
            .select_related('generation_run', 'idea')
            .prefetch_related('projects')
            .order_by('-created_at')
        )

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
            except Idea.DoesNotExist:
                pass

        data = {
            'project': DesignProjectSerializer(project).data,
            'designs': DesignSerializer(designs, many=True).data,
            'board_layout': project.board_layout,
            'idea_context': idea_context,
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
        job = queue.enqueue(
            task_generate_design,
            str(run.id),
            str(project.id),  # Pass project_id for auto-linking
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
