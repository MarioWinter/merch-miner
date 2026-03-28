"""DRF views for publish_app API."""

import logging

import django_rq
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from idea_app.models import Idea
from keyword_app.models import NicheKeyword
from niche_app.models import Niche
from publish_app.api.serializers import (
    BulkActionSerializer,
    CloudImportSerializer,
    DesignAssetSerializer,
    DesignAssetUpdateSerializer,
    DesignAssetUploadSerializer,
    LifecycleSalesUpdateSerializer,
    ListingGenerateSerializer,
    ListingSerializer,
    ListingTranslateSerializer,
    ListingUpdateSerializer,
    ProductLifecycleSerializer,
    UploadJobBatchSerializer,
    UploadJobCreateSerializer,
    UploadJobSerializer,
    UploadJobStatusUpdateSerializer,
    UploadTemplateCreateSerializer,
    UploadTemplateSerializer,
)
from publish_app.models import (
    DesignAsset,
    Listing,
    ProductLifecycle,
    UploadJob,
    UploadTemplate,
)

logger = logging.getLogger(__name__)


class LLMEndpointThrottle(UserRateThrottle):
    rate = '10/minute'


class PublishPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _get_workspace_id(request):
    return request.headers.get('X-Workspace-Id')


def _ws_error():
    return Response(
        {'error': 'X-Workspace-Id header required'},
        status=status.HTTP_400_BAD_REQUEST,
    )


# ===========================================================================
# Listing Views
# ===========================================================================

class ListingGenerateView(APIView):
    """POST /api/ideas/{id}/listing/generate/ -- AI generate listing."""

    throttle_classes = [LLMEndpointThrottle]

    def post(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        idea = get_object_or_404(
            Idea.objects.select_related('niche'),
            pk=pk,
            workspace_id=ws_id,
        )

        serializer = ListingGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        design = None
        if data.get('design_id'):
            design = get_object_or_404(
                DesignAsset, pk=data['design_id'], workspace_id=ws_id,
            )

        # Auto-inject PROJ-10 keywords from design_template
        auto_keywords = ''
        if design:
            template_kws = NicheKeyword.objects.filter(
                design_template_id=design.id,
            ).values_list('keyword', flat=True)[:50]
            if template_kws:
                auto_keywords = ', '.join(template_kws)

        extra_kw = data.get('extra_keywords', '')
        if auto_keywords:
            extra_kw = f"{auto_keywords}, {extra_kw}" if extra_kw else auto_keywords

        # Create listing record first
        listing = Listing.objects.create(
            workspace_id=ws_id,
            idea=idea,
            design=design,
            round=idea.niche.current_round if hasattr(idea.niche, 'current_round') else 1 if idea.niche else 1,
            language=data.get('language', 'en'),
            generated_by=Listing.GeneratedBy.AI,
            status=Listing.Status.DRAFT,
        )

        # Enqueue AI generation
        queue = django_rq.get_queue('slogan')
        queue.enqueue(
            'publish_app.tasks.task_generate_listing',
            listing_id=str(listing.id),
            slogan_text=idea.slogan_text,
            extra_keywords=extra_kw,
            language=data.get('language', 'en'),
            design_context=design.file_name if design else '',
        )

        return Response(
            ListingSerializer(listing).data,
            status=status.HTTP_201_CREATED,
        )


class ListingDetailView(APIView):
    """GET /api/ideas/{id}/listing/ -- get listing for idea."""

    def get(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        listing = (
            Listing.objects
            .filter(idea_id=pk, workspace_id=ws_id)
            .select_related('idea', 'design')
            .order_by('-created_at')
            .first()
        )
        if not listing:
            return Response(
                {'error': 'No listing found for this idea'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(ListingSerializer(listing).data)


class ListingUpdateView(APIView):
    """PATCH /api/listings/{id}/ -- partial update. Status reverts to draft."""

    def patch(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        listing = get_object_or_404(Listing, pk=pk, workspace_id=ws_id)
        serializer = ListingUpdateSerializer(listing, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # Revert to draft on content edit (unless only status is being set)
        content_fields = {
            'brand_name', 'title', 'bullet_1', 'bullet_2', 'bullet_3',
            'bullet_4', 'bullet_5', 'description', 'backend_keywords',
        }
        if content_fields.intersection(serializer.validated_data.keys()):
            if 'status' not in serializer.validated_data:
                serializer.validated_data['status'] = Listing.Status.DRAFT

        serializer.save()
        return Response(ListingSerializer(listing).data)


class ListingTranslateView(APIView):
    """POST /api/listings/{id}/translate/ -- AI translate listing fields."""

    throttle_classes = [LLMEndpointThrottle]

    def post(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        listing = get_object_or_404(Listing, pk=pk, workspace_id=ws_id)
        serializer = ListingTranslateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        target_langs = serializer.validated_data['target_languages']

        # Enqueue translation
        queue = django_rq.get_queue('slogan')
        queue.enqueue(
            'publish_app.tasks.task_translate_listing',
            listing_id=str(listing.id),
            target_languages=target_langs,
        )

        return Response(
            {'message': 'Translation started', 'target_languages': target_langs},
            status=status.HTTP_202_ACCEPTED,
        )


class ListingTMCheckView(APIView):
    """POST /api/listings/{id}/tm-check/ -- trademark check."""

    def post(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        listing = get_object_or_404(Listing, pk=pk, workspace_id=ws_id)

        from publish_app.services.tm_checker import check_listing_tm
        flagged = check_listing_tm(listing)

        return Response({'flagged_terms': flagged})


class ListingExportView(APIView):
    """GET /api/listings/{id}/export/ -- plain-text MBA format."""

    def get(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        listing = get_object_or_404(Listing, pk=pk, workspace_id=ws_id)

        text = (
            f"Brand Name: {listing.brand_name}\n"
            f"Title: {listing.title}\n"
            f"Bullet 1: {listing.bullet_1}\n"
            f"Bullet 2: {listing.bullet_2}\n"
            f"Bullet 3: {listing.bullet_3}\n"
            f"Bullet 4: {listing.bullet_4}\n"
            f"Bullet 5: {listing.bullet_5}\n"
            f"Description: {listing.description}\n"
            f"Backend Keywords: {listing.backend_keywords}\n"
        )

        return Response({'text': text, 'listing_id': str(listing.id)})


# ===========================================================================
# Design Gallery Views
# ===========================================================================

class DesignGalleryListView(APIView):
    """GET /api/designs/gallery/ -- paginated gallery."""

    pagination_class = PublishPagination

    def get(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        qs = (
            DesignAsset.objects
            .filter(workspace_id=ws_id)
            .select_related('niche', 'idea', 'listing')
        )

        # Filters
        source = request.query_params.get('source')
        if source:
            qs = qs.filter(source=source)

        has_listing = request.query_params.get('has_listing')
        if has_listing == 'true':
            qs = qs.filter(listing__isnull=False)
        elif has_listing == 'false':
            qs = qs.filter(listing__isnull=True)

        tags = request.query_params.get('tags')
        if tags:
            for tag in tags.split(','):
                qs = qs.filter(tags__contains=[tag.strip()])

        # Sort
        sort_by = request.query_params.get('sort_by', 'newest')
        if sort_by == 'recently_edited':
            qs = qs.order_by('-created_at')  # DesignAsset has no updated_at
        else:
            qs = qs.order_by('-created_at')

        paginator = PublishPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = DesignAssetSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class DesignGalleryUploadView(APIView):
    """POST /api/designs/gallery/upload/ -- direct file upload."""

    parser_classes = [MultiPartParser]

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = DesignAssetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        uploaded_file = data['file']

        # Validate file type
        content_type = uploaded_file.content_type
        if content_type not in DesignAsset.ALLOWED_TYPES:
            return Response(
                {'error': f'File type {content_type} not allowed. Use PNG or JPG.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file size
        if uploaded_file.size > DesignAsset.MAX_FILE_SIZE:
            return Response(
                {'error': f'File too large. Max size: {DesignAsset.MAX_FILE_SIZE // (1024*1024)} MB'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get dimensions via Pillow
        dimensions = {}
        try:
            from PIL import Image
            img = Image.open(uploaded_file)
            dimensions = {'width': img.width, 'height': img.height}
            uploaded_file.seek(0)
        except Exception:
            pass

        niche = None
        if data.get('niche_id'):
            niche = get_object_or_404(Niche, pk=data['niche_id'], workspace_id=ws_id)

        idea = None
        if data.get('idea_id'):
            idea = get_object_or_404(Idea, pk=data['idea_id'], workspace_id=ws_id)

        asset = DesignAsset.objects.create(
            workspace_id=ws_id,
            file_name=uploaded_file.name,
            file=uploaded_file,
            source=DesignAsset.Source.UPLOAD,
            dimensions=dimensions,
            file_size=uploaded_file.size,
            tags=data.get('tags', []),
            niche=niche,
            idea=idea,
            created_by=request.user,
        )

        return Response(
            DesignAssetSerializer(asset).data,
            status=status.HTTP_201_CREATED,
        )


class DesignGalleryImportView(APIView):
    """POST /api/designs/gallery/import-drive/ -- import from cloud storage."""

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = CloudImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Enqueue cloud import
        queue = django_rq.get_queue('design')
        queue.enqueue(
            'publish_app.tasks.task_import_cloud_files',
            workspace_id=ws_id,
            file_ids=data['file_ids'],
            provider=data['provider'],
            user_id=request.user.id,
        )

        return Response(
            {
                'message': f'Import started for {len(data["file_ids"])} files',
                'provider': data['provider'],
            },
            status=status.HTTP_202_ACCEPTED,
        )


class DesignGalleryDetailView(APIView):
    """DELETE /api/designs/gallery/{id}/ + PATCH."""

    def delete(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        asset = get_object_or_404(DesignAsset, pk=pk, workspace_id=ws_id)
        asset.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        asset = get_object_or_404(DesignAsset, pk=pk, workspace_id=ws_id)
        serializer = DesignAssetUpdateSerializer(asset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(DesignAssetSerializer(asset).data)


class DesignGalleryBulkActionView(APIView):
    """POST /api/designs/gallery/bulk-action/ -- bulk operations."""

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = BulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        ids = data['ids']
        action = data['action']
        assets = DesignAsset.objects.filter(
            pk__in=ids, workspace_id=ws_id,
        )

        if action == 'delete':
            count = assets.count()
            assets.delete()
            return Response({'deleted': count})

        elif action == 'apply_template':
            source_id = data.get('source_id')
            if not source_id:
                return Response(
                    {'error': 'source_id required for apply_template'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            template = get_object_or_404(
                UploadTemplate, pk=source_id, workspace_id=ws_id,
            )
            # Apply template to each design's listing
            updated = 0
            for asset in assets.select_related('listing'):
                if asset.listing:
                    asset.listing.brand_name = template.brand_name
                    asset.listing.save(update_fields=['brand_name', 'updated_at'])
                    updated += 1
            return Response({'updated': updated})

        elif action == 'apply_listing':
            source_id = data.get('source_id')
            if not source_id:
                return Response(
                    {'error': 'source_id required for apply_listing'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            source_listing = get_object_or_404(
                Listing, pk=source_id, workspace_id=ws_id,
            )
            updated = 0
            for asset in assets:
                if asset.listing_id:
                    target = Listing.objects.get(pk=asset.listing_id)
                    for field in ['brand_name', 'title', 'bullet_1', 'bullet_2',
                                  'bullet_3', 'bullet_4', 'bullet_5',
                                  'description', 'backend_keywords']:
                        setattr(target, field, getattr(source_listing, field))
                    target.status = Listing.Status.DRAFT
                    target.save()
                    updated += 1
            return Response({'updated': updated})

        return Response(
            {'error': f'Unknown action: {action}'},
            status=status.HTTP_400_BAD_REQUEST,
        )


# ===========================================================================
# Upload Job Views
# ===========================================================================

class UploadJobCreateView(APIView):
    """POST /api/upload-jobs/ -- create single upload job."""

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = UploadJobCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        listing = get_object_or_404(
            Listing, pk=data['listing_id'], workspace_id=ws_id,
        )

        design = None
        if data.get('design_id'):
            design = get_object_or_404(
                DesignAsset, pk=data['design_id'], workspace_id=ws_id,
            )

        template = None
        if data.get('template_id'):
            template = get_object_or_404(
                UploadTemplate, pk=data['template_id'], workspace_id=ws_id,
            )

        # Validate: listing must have content
        if not listing.title:
            return Response(
                {'error': 'Listing must have a title before upload'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Capture listing snapshot
        snapshot = {
            'brand_name': listing.brand_name,
            'title': listing.title,
            'bullet_1': listing.bullet_1,
            'bullet_2': listing.bullet_2,
            'bullet_3': listing.bullet_3,
            'bullet_4': listing.bullet_4,
            'bullet_5': listing.bullet_5,
            'description': listing.description,
            'backend_keywords': listing.backend_keywords,
        }

        job = UploadJob.objects.create(
            workspace_id=ws_id,
            listing=listing,
            design=design,
            template=template,
            listing_snapshot=snapshot,
            marketplace=data['marketplace'],
            created_by=request.user,
        )

        return Response(
            UploadJobSerializer(job).data,
            status=status.HTTP_201_CREATED,
        )


class UploadJobBatchCreateView(APIView):
    """POST /api/upload-jobs/batch/ -- batch create jobs."""

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = UploadJobBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        template = None
        if data.get('template_id'):
            template = get_object_or_404(
                UploadTemplate, pk=data['template_id'], workspace_id=ws_id,
            )

        designs = DesignAsset.objects.filter(
            pk__in=data['design_ids'],
            workspace_id=ws_id,
        ).select_related('listing')

        jobs = []
        errors = []
        for design in designs:
            listing = design.listing
            if not listing:
                errors.append({
                    'design_id': str(design.id),
                    'error': 'Design has no linked listing',
                })
                continue

            if not listing.title:
                errors.append({
                    'design_id': str(design.id),
                    'error': 'Listing has no title',
                })
                continue

            snapshot = {
                'brand_name': listing.brand_name,
                'title': listing.title,
                'bullet_1': listing.bullet_1,
                'bullet_2': listing.bullet_2,
                'bullet_3': listing.bullet_3,
                'bullet_4': listing.bullet_4,
                'bullet_5': listing.bullet_5,
                'description': listing.description,
                'backend_keywords': listing.backend_keywords,
            }

            job = UploadJob(
                workspace_id=ws_id,
                listing=listing,
                design=design,
                template=template,
                listing_snapshot=snapshot,
                marketplace=data['marketplace'],
                created_by=request.user,
            )
            jobs.append(job)

        created = UploadJob.objects.bulk_create(jobs)

        return Response({
            'created': UploadJobSerializer(created, many=True).data,
            'errors': errors,
        }, status=status.HTTP_201_CREATED)


class UploadJobListView(APIView):
    """GET /api/upload-jobs/ -- paginated list."""

    def get(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        qs = (
            UploadJob.objects
            .filter(workspace_id=ws_id)
            .select_related('listing', 'design', 'template')
        )

        # Filter by status
        job_status = request.query_params.get('status')
        if job_status:
            qs = qs.filter(status=job_status)

        paginator = PublishPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = UploadJobSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class UploadJobDetailView(APIView):
    """GET /api/upload-jobs/{id}/ -- job detail."""

    def get(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        job = get_object_or_404(
            UploadJob.objects.select_related('listing', 'design', 'template'),
            pk=pk,
            workspace_id=ws_id,
        )
        return Response(UploadJobSerializer(job).data)


class UploadJobCancelView(APIView):
    """POST /api/upload-jobs/{id}/cancel/ -- cancel pending job."""

    def post(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        job = get_object_or_404(UploadJob, pk=pk, workspace_id=ws_id)

        if job.status not in (UploadJob.Status.PENDING, UploadJob.Status.VALIDATING):
            return Response(
                {'error': f'Cannot cancel job in {job.status} status'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        job.status = UploadJob.Status.CANCELLED
        job.save(update_fields=['status'])
        return Response(UploadJobSerializer(job).data)


class UploadJobStatusUpdateView(APIView):
    """PATCH /api/upload-jobs/{id}/ -- Desktop App reports status."""

    def patch(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        job = get_object_or_404(UploadJob, pk=pk, workspace_id=ws_id)
        serializer = UploadJobStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        now = timezone.now()
        job.status = data['status']

        if data['status'] == 'uploading' and not job.started_at:
            job.started_at = now

        if data['status'] == 'completed':
            job.completed_at = now
            job.asin = data.get('asin', '')
            job.upload_date = now
            # Update lifecycle
            from publish_app.services.lifecycle_tracker import create_or_update_lifecycle
            job.save()
            create_or_update_lifecycle(job)

        if data['status'] == 'failed':
            job.error_message = data.get('error_message', '')
            job.error_screenshot = data.get('error_screenshot', '')
            job.retry_count += 1

        job.save()
        return Response(UploadJobSerializer(job).data)


# ===========================================================================
# Upload Template Views
# ===========================================================================

class UploadTemplateListCreateView(APIView):
    """GET/POST /api/upload-templates/."""

    def get(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        templates = UploadTemplate.objects.filter(workspace_id=ws_id)
        paginator = PublishPagination()
        page = paginator.paginate_queryset(templates, request)
        serializer = UploadTemplateSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = UploadTemplateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = serializer.save(
            workspace_id=ws_id,
            created_by=request.user,
        )
        return Response(
            UploadTemplateSerializer(template).data,
            status=status.HTTP_201_CREATED,
        )


class UploadTemplateDetailView(APIView):
    """GET/PATCH/DELETE /api/upload-templates/{id}/."""

    def get(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        template = get_object_or_404(
            UploadTemplate, pk=pk, workspace_id=ws_id,
        )
        return Response(UploadTemplateSerializer(template).data)

    def patch(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        template = get_object_or_404(
            UploadTemplate, pk=pk, workspace_id=ws_id,
        )
        serializer = UploadTemplateCreateSerializer(
            template, data=request.data, partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UploadTemplateSerializer(template).data)

    def delete(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        template = get_object_or_404(
            UploadTemplate, pk=pk, workspace_id=ws_id,
        )
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# Product Lifecycle Views
# ===========================================================================

class NicheLifecycleView(APIView):
    """GET /api/niches/{id}/lifecycle/ -- full lifecycle chains."""

    def get(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        niche = get_object_or_404(Niche, pk=pk, workspace_id=ws_id)

        from publish_app.services.lifecycle_tracker import get_niche_lifecycle
        result = get_niche_lifecycle(niche_id=niche.pk, workspace_id=ws_id)

        return Response({'niche_id': str(niche.pk), 'rounds': result})


class LifecycleUpdateView(APIView):
    """PATCH /api/lifecycle/{id}/ -- update sales data."""

    def patch(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        lifecycle = get_object_or_404(
            ProductLifecycle, pk=pk, workspace_id=ws_id,
        )

        serializer = LifecycleSalesUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        update_fields = ['updated_at']
        for field, value in serializer.validated_data.items():
            if value is not None:
                setattr(lifecycle, field, value)
                update_fields.append(field)

        lifecycle.save(update_fields=update_fields)
        return Response(ProductLifecycleSerializer(lifecycle).data)
