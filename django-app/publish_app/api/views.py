"""DRF views for publish_app API."""

import logging

import django_rq
from django.db import IntegrityError, models, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_control
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from publish_app.constants import MBA_COLORS

from idea_app.models import Idea
from keyword_app.models import NicheKeyword
from niche_app.models import Niche
from publish_app.api.serializers import (
    COPY_SCOPE_FIELDS,
    BulkActionSerializer,
    CloudImportSerializer,
    CollectionCreateSerializer,
    CollectionSerializer,
    CollectionTreeSerializer,
    CollectionUpdateSerializer,
    DesignAssetSerializer,
    DesignAssetUpdateSerializer,
    DesignAssetUploadSerializer,
    DesignProductConfigCopyFromSerializer,
    DesignProductConfigSerializer,
    DesignProductConfigUpsertSerializer,
    LifecycleSalesUpdateSerializer,
    ListingConvertSerializer,
    ListingGenerateSerializer,
    ListingSerializer,
    ListingTranslateSerializer,
    ListingUpdateSerializer,
    MoveAssetsSerializer,
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
    DesignCollection,
    DesignProductConfig,
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

        marketplace_type = data.get(
            'marketplace_type', Listing.MarketplaceType.MBA,
        )

        # Create listing record first. Unique constraint on
        # (design, marketplace_type) — return 409 on duplicate.
        # Wrap in an atomic() savepoint so a caller-level transaction
        # (e.g. pytest) is not left in a broken state on IntegrityError.
        try:
            with transaction.atomic():
                listing = Listing.objects.create(
                    workspace_id=ws_id,
                    idea=idea,
                    design=design,
                    marketplace_type=marketplace_type,
                    round=idea.niche.current_round if hasattr(idea.niche, 'current_round') else 1 if idea.niche else 1,
                    language=data.get('language', 'en'),
                    generated_by=Listing.GeneratedBy.AI,
                    status=Listing.Status.DRAFT,
                )
        except IntegrityError:
            return Response(
                {
                    'error': (
                        f'Listing already exists for this design with '
                        f'marketplace_type={marketplace_type}.'
                    ),
                    'code': 'duplicate_marketplace_type',
                },
                status=status.HTTP_409_CONFLICT,
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
    """GET /api/ideas/{id}/listing/ -- get listing for idea.

    Supports `?marketplace_type=` query param to select the marketplace
    variant. Defaults to `mba`. Invalid values return 400.
    """

    def get(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        marketplace_type = request.query_params.get(
            'marketplace_type', Listing.MarketplaceType.MBA,
        )
        valid_types = {c[0] for c in Listing.MarketplaceType.choices}
        if marketplace_type not in valid_types:
            return Response(
                {
                    'error': (
                        f"Invalid marketplace_type '{marketplace_type}'. "
                        f"Must be one of: {sorted(valid_types)}"
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        listing = (
            Listing.objects
            .filter(
                idea_id=pk,
                workspace_id=ws_id,
                marketplace_type=marketplace_type,
            )
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

        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            return Response(
                {
                    'error': (
                        'Listing already exists for this design with the '
                        'target marketplace_type.'
                    ),
                    'code': 'duplicate_marketplace_type',
                },
                status=status.HTTP_409_CONFLICT,
            )
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


# ---------------------------------------------------------------------------
# Listing Conversion (PROJ-11 F3)
# ---------------------------------------------------------------------------


def _map_listing_fields(source, target_marketplace_type):
    """Return a dict of field values mapped from ``source`` to the target.

    Spec (PROJ-11 spec lines 156-158):
    - Global -> MBA: Global text lands in Title/Brand/Bullet1 where data
      maps, the rest is left empty.
    - MBA -> Global: MBA fields map back to Global's simpler shape.

    Global and MBA both use the same underlying ``Listing`` schema, so the
    mapping difference is mainly in which fields are preserved vs cleared:
    - On MBA -> Global: keep brand_name/title/description, drop the 5
      bullets + backend_keywords (not part of Global's simpler shape).
    - On Global -> MBA: keep brand_name/title, promote description to
      bullet_1 when bullet_1 is empty, leave other bullets + backend_keywords
      blank for the user to fill in.
    - For any other direction (e.g. to Displate), do a straight field copy
      so nothing is silently lost.
    """
    source_mt = source.marketplace_type
    MarketplaceType = Listing.MarketplaceType

    payload = {
        'brand_name': source.brand_name,
        'title': source.title,
        'description': source.description,
        'language': source.language,
        'translations': dict(source.translations or {}),
        'bullet_1': source.bullet_1,
        'bullet_2': source.bullet_2,
        'bullet_3': source.bullet_3,
        'bullet_4': source.bullet_4,
        'bullet_5': source.bullet_5,
        'backend_keywords': source.backend_keywords,
    }

    if (
        source_mt == MarketplaceType.GLOBAL
        and target_marketplace_type == MarketplaceType.MBA
    ):
        # Global -> MBA: promote description into bullet_1 if bullet_1 empty.
        # Drop bullets 2-5 and backend_keywords so the MBA variant starts
        # with only the fields that cleanly map from Global.
        if not payload['bullet_1'] and payload['description']:
            payload['bullet_1'] = payload['description'][:256]
        payload['bullet_2'] = ''
        payload['bullet_3'] = ''
        payload['bullet_4'] = ''
        payload['bullet_5'] = ''
        payload['backend_keywords'] = ''

    elif (
        source_mt == MarketplaceType.MBA
        and target_marketplace_type == MarketplaceType.GLOBAL
    ):
        # MBA -> Global: keep brand/title/description. Drop the 5 bullets +
        # backend_keywords (not part of Global's simpler shape).
        payload['bullet_1'] = ''
        payload['bullet_2'] = ''
        payload['bullet_3'] = ''
        payload['bullet_4'] = ''
        payload['bullet_5'] = ''
        payload['backend_keywords'] = ''

    # Any other source/target combination -> straight copy of `payload`
    # (e.g. conversions involving Displate are placeholders for now).

    return payload


class ListingConvertView(APIView):
    """POST /api/listings/convert/ -- convert a Listing between marketplaces.

    Body: ``{source_listing_id, target_marketplace_type, overwrite?: bool}``.

    Behavior:
    - If no Listing exists for ``(source.design, target_marketplace_type)``
      -> create a new Listing, return 201.
    - If a target exists and ``overwrite=false`` (default) -> 409, do nothing.
    - If a target exists and ``overwrite=true`` -> update in place, return 200.

    Workspace isolation: source must belong to the caller's workspace.
    Cross-workspace source -> 404 (treat as not-found to avoid enumeration).

    Marketplace_type stays tied to the Listing row (one row per
    ``(design, marketplace_type)``). When the source has ``design=NULL``
    the DB unique constraint allows multiple rows, so convert creates a new
    NULL-design listing in the new marketplace_type.
    """

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = ListingConvertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        source = get_object_or_404(
            Listing.objects.select_related('idea', 'design'),
            pk=data['source_listing_id'],
            workspace_id=ws_id,
        )

        target_mt = data['target_marketplace_type']
        overwrite = data['overwrite']

        if target_mt == source.marketplace_type:
            return Response(
                {
                    'error': (
                        'target_marketplace_type must differ from source '
                        f"marketplace_type ({source.marketplace_type})."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        payload = _map_listing_fields(source, target_mt)

        with transaction.atomic():
            # Look up existing target Listing for this (design, target_mt)
            # pair. When source.design is NULL we cannot upsert by design —
            # always create a new row in that case (NULL != NULL in Postgres
            # unique constraint semantics, mirroring ListingGenerateView).
            existing = None
            if source.design_id is not None:
                existing = (
                    Listing.objects
                    .select_for_update()
                    .filter(
                        workspace_id=ws_id,
                        design_id=source.design_id,
                        marketplace_type=target_mt,
                    )
                    .first()
                )

            if existing and not overwrite:
                return Response(
                    {
                        'error': (
                            f'Listing already exists for this design with '
                            f'marketplace_type={target_mt}. '
                            f'Set overwrite=true to replace it.'
                        ),
                        'code': 'target_exists',
                        'existing_listing_id': str(existing.id),
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            if existing and overwrite:
                for field, value in payload.items():
                    setattr(existing, field, value)
                # Edits revert status to draft — matches ListingUpdateView.
                existing.status = Listing.Status.DRAFT
                existing.save(
                    update_fields=list(payload.keys())
                    + ['status', 'updated_at'],
                )
                return Response(
                    ListingSerializer(existing).data,
                    status=status.HTTP_200_OK,
                )

            # Create new target Listing. IntegrityError catch guards against
            # a race where a concurrent request inserted the same pair
            # between our SELECT and INSERT.
            try:
                with transaction.atomic():
                    created = Listing.objects.create(
                        workspace_id=ws_id,
                        idea=source.idea,
                        design=source.design,
                        marketplace_type=target_mt,
                        round=source.round,
                        status=Listing.Status.DRAFT,
                        generated_by=Listing.GeneratedBy.MANUAL,
                        availability=source.availability,
                        publish_mode=source.publish_mode,
                        **payload,
                    )
            except IntegrityError:
                return Response(
                    {
                        'error': (
                            f'Listing already exists for this design with '
                            f'marketplace_type={target_mt}.'
                        ),
                        'code': 'target_exists',
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        return Response(
            ListingSerializer(created).data,
            status=status.HTTP_201_CREATED,
        )


# ===========================================================================
# Design Collection Views
# ===========================================================================

class CollectionListCreateView(APIView):
    """GET /api/collections/ — root-level collections.
    POST /api/collections/ — create folder.
    """

    def get(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        parent_id = request.query_params.get('parent')

        qs = DesignCollection.objects.filter(workspace_id=ws_id)
        if parent_id:
            qs = qs.filter(parent_id=parent_id)
        else:
            qs = qs.filter(parent__isnull=True)

        qs = qs.annotate(
            _child_count=models.Count('children', distinct=True),
            _asset_count=models.Count('assets', distinct=True),
        ).order_by('position', 'name')

        paginator = PublishPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = CollectionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = CollectionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        parent = None
        if data.get('parent'):
            parent = get_object_or_404(
                DesignCollection, pk=data['parent'], workspace_id=ws_id,
            )

        # Auto-assign position: max position + 1 in same parent
        max_pos = (
            DesignCollection.objects
            .filter(workspace_id=ws_id, parent=parent)
            .aggregate(max_pos=models.Max('position'))['max_pos']
        ) or 0

        collection = DesignCollection.objects.create(
            workspace_id=ws_id,
            name=data['name'],
            parent=parent,
            position=max_pos + 1,
            created_by=request.user,
        )

        return Response(
            CollectionSerializer(collection).data,
            status=status.HTTP_201_CREATED,
        )


class CollectionDetailView(APIView):
    """GET /api/collections/{id}/ — detail with children + assets.
    PATCH /api/collections/{id}/ — rename or move.
    DELETE /api/collections/{id}/ — delete folder, bubble assets up.
    """

    def get(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        collection = get_object_or_404(
            DesignCollection.objects.annotate(
                _child_count=models.Count('children', distinct=True),
                _asset_count=models.Count('assets', distinct=True),
            ),
            pk=pk,
            workspace_id=ws_id,
        )

        # Children folders
        children = (
            DesignCollection.objects
            .filter(workspace_id=ws_id, parent=collection)
            .annotate(
                _child_count=models.Count('children', distinct=True),
                _asset_count=models.Count('assets', distinct=True),
            )
            .order_by('position', 'name')
        )

        # Assets in this collection (paginated)
        assets_qs = (
            DesignAsset.objects
            .filter(workspace_id=ws_id, collection=collection)
            .select_related('niche', 'idea', 'listing', 'collection')
            .order_by('-created_at')
        )

        paginator = PublishPagination()
        assets_page = paginator.paginate_queryset(assets_qs, request)

        return Response({
            'collection': CollectionSerializer(collection).data,
            'children': CollectionSerializer(children, many=True).data,
            'assets': DesignAssetSerializer(assets_page, many=True).data,
            'assets_count': paginator.page.paginator.count,
            'assets_next': paginator.get_next_link(),
            'assets_previous': paginator.get_previous_link(),
        })

    def patch(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        collection = get_object_or_404(
            DesignCollection, pk=pk, workspace_id=ws_id,
        )

        serializer = CollectionUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if 'name' in data:
            collection.name = data['name']

        if 'parent' in data:
            new_parent_id = data['parent']

            if new_parent_id is None:
                collection.parent = None
            else:
                # Prevent moving into self
                if str(new_parent_id) == str(collection.pk):
                    return Response(
                        {'error': 'Cannot move collection into itself'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                new_parent = get_object_or_404(
                    DesignCollection, pk=new_parent_id, workspace_id=ws_id,
                )

                # Prevent circular references: walk up from new_parent
                ancestor = new_parent
                while ancestor is not None:
                    if ancestor.pk == collection.pk:
                        return Response(
                            {'error': 'Circular reference: target is a descendant'},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    ancestor = ancestor.parent

                collection.parent = new_parent

        collection.save()

        # Re-fetch with annotations
        collection = DesignCollection.objects.annotate(
            _child_count=models.Count('children', distinct=True),
            _asset_count=models.Count('assets', distinct=True),
        ).get(pk=pk)

        return Response(CollectionSerializer(collection).data)

    def delete(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        collection = get_object_or_404(
            DesignCollection, pk=pk, workspace_id=ws_id,
        )

        # Bubble assets up: move all assets in this collection (and descendants) to parent
        target_parent = collection.parent

        # Collect all descendant collection IDs (recursive)
        descendant_ids = []
        self._collect_descendants(collection, descendant_ids)

        # Move all assets from this collection + descendants to the target parent
        DesignAsset.objects.filter(
            workspace_id=ws_id,
            collection_id__in=[collection.pk] + descendant_ids,
        ).update(collection=target_parent)

        # Delete the collection (CASCADE will delete child collections via SET_NULL parent)
        # Since parent is SET_NULL, children would become root — but we want them deleted.
        # Delete descendants explicitly first, then the collection itself.
        if descendant_ids:
            DesignCollection.objects.filter(pk__in=descendant_ids).delete()
        collection.delete()

        return Response(status=status.HTTP_204_NO_CONTENT)

    def _collect_descendants(self, collection, result):
        """Iteratively collect all descendant collection IDs (BFS)."""
        queue = list(
            DesignCollection.objects.filter(parent=collection).values_list('pk', flat=True)
        )
        while queue:
            current_id = queue.pop(0)
            result.append(current_id)
            children = list(
                DesignCollection.objects.filter(parent_id=current_id).values_list('pk', flat=True)
            )
            queue.extend(children)


class CollectionTreeView(APIView):
    """GET /api/collections/tree/ — full folder tree for Tree Explorer."""

    def get(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        # Get all collections for workspace, prefetch children recursively
        root_collections = (
            DesignCollection.objects
            .filter(workspace_id=ws_id, parent__isnull=True)
            .prefetch_related('children', 'children__children', 'children__children__children')
            .annotate(_asset_count=models.Count('assets', distinct=True))
            .order_by('position', 'name')
        )

        serializer = CollectionTreeSerializer(root_collections, many=True)
        return Response(serializer.data)


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
            .select_related('niche', 'idea', 'listing', 'collection')
        )

        # Filters
        collection_param = request.query_params.get('collection')
        if collection_param == 'root':
            qs = qs.filter(collection__isnull=True)
        elif collection_param:
            qs = qs.filter(collection_id=collection_param)

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


class DesignGalleryMoveView(APIView):
    """POST /api/designs/gallery/move/ — move assets to collection (or root)."""

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = MoveAssetsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        collection = None
        if data.get('collection_id'):
            collection = get_object_or_404(
                DesignCollection, pk=data['collection_id'], workspace_id=ws_id,
            )

        updated = DesignAsset.objects.filter(
            pk__in=data['asset_ids'],
            workspace_id=ws_id,
        ).update(collection=collection)

        return Response({'moved': updated})


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


# ===========================================================================
# Design Product Config Views (PROJ-11 F4 / AC-38..AC-44)
# ===========================================================================

def _valid_marketplace_types():
    return {c[0] for c in DesignProductConfig.MarketplaceType.choices}


def _get_workspace_design(ws_id, design_id):
    """Workspace-scoped DesignAsset lookup. Raises 404 on miss/cross-workspace.

    Workspace isolation requirement: only returns designs in the caller's
    workspace. Cross-workspace access yields 404 (treat as not-found to
    avoid ID enumeration).
    """
    return get_object_or_404(
        DesignAsset, pk=design_id, workspace_id=ws_id,
    )


class DesignProductConfigView(APIView):
    """GET/PATCH /api/designs/{design_id}/product-config/.

    GET: returns the config row for ``(design, marketplace_type)``. 404 when
    no row exists (frontend falls back to empty defaults). Default
    ``marketplace_type=mba`` when query param omitted.

    PATCH: upsert semantics. ``marketplace_type`` required in body. Creates
    the row on first call, updates on subsequent calls. Returns 200 with the
    full record.
    """

    def get(self, request, design_id):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        marketplace_type = request.query_params.get(
            'marketplace_type',
            DesignProductConfig.MarketplaceType.MBA,
        )
        valid = _valid_marketplace_types()
        if marketplace_type not in valid:
            return Response(
                {
                    'error': (
                        f"Invalid marketplace_type '{marketplace_type}'. "
                        f"Must be one of: {sorted(valid)}"
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        design = _get_workspace_design(ws_id, design_id)

        config = (
            DesignProductConfig.objects
            .filter(design=design, marketplace_type=marketplace_type)
            .first()
        )
        if not config:
            return Response(
                {
                    'error': (
                        f'No product config for this design + '
                        f'{marketplace_type}.'
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(DesignProductConfigSerializer(config).data)

    def patch(self, request, design_id):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        design = _get_workspace_design(ws_id, design_id)

        serializer = DesignProductConfigUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        marketplace_type = data.pop('marketplace_type')

        defaults = {k: v for k, v in data.items() if v is not None}

        with transaction.atomic():
            config, _created = (
                DesignProductConfig.objects
                .select_for_update()
                .get_or_create(
                    design=design,
                    marketplace_type=marketplace_type,
                    defaults=defaults,
                )
            )
            if not _created and defaults:
                for field, value in defaults.items():
                    setattr(config, field, value)
                config.save(
                    update_fields=list(defaults.keys()) + ['updated_at'],
                )

        config.refresh_from_db()
        return Response(DesignProductConfigSerializer(config).data)


class DesignProductConfigCopyFromView(APIView):
    """POST /api/designs/{design_id}/product-config/copy-from/.

    Copies a source design's config into the target design. Atomic: source
    read + target upsert happen in one transaction to avoid races with the
    frontend's auto-save PATCH.

    Body: ``{source_design_id, marketplace_type, scope}`` where ``scope`` is
    one of ``all, colors, fit_types, print_side, product_types, marketplaces``.

    Workspace isolation: both source and target must be in the caller's
    workspace. Cross-workspace returns 404 (source) or 403 if a cross-
    workspace target was reachable via a direct URL (we catch that upstream
    via the same workspace-scoped lookup).
    """

    def post(self, request, design_id):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        target_design = _get_workspace_design(ws_id, design_id)

        serializer = DesignProductConfigCopyFromSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if str(data['source_design_id']) == str(target_design.pk):
            return Response(
                {'error': 'source_design_id and target must differ.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        source_design = _get_workspace_design(ws_id, data['source_design_id'])
        marketplace_type = data['marketplace_type']
        scope = data['scope']

        with transaction.atomic():
            source = (
                DesignProductConfig.objects
                .filter(design=source_design, marketplace_type=marketplace_type)
                .first()
            )
            if not source:
                return Response(
                    {
                        'error': (
                            f'Source design has no product config for '
                            f'{marketplace_type}.'
                        ),
                        'code': 'source_config_missing',
                    },
                    status=status.HTTP_404_NOT_FOUND,
                )

            if scope == 'all':
                copy_fields = list(COPY_SCOPE_FIELDS)
            elif scope in COPY_SCOPE_FIELDS:
                copy_fields = [scope]
            else:  # Shouldn't hit — serializer validated the choice
                return Response(
                    {'error': f"Unknown scope '{scope}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            payload = {field: getattr(source, field) for field in copy_fields}

            target, _created = (
                DesignProductConfig.objects
                .select_for_update()
                .get_or_create(
                    design=target_design,
                    marketplace_type=marketplace_type,
                    defaults=payload,
                )
            )
            if not _created:
                for field, value in payload.items():
                    setattr(target, field, value)
                target.save(
                    update_fields=list(payload.keys()) + ['updated_at'],
                )

        target.refresh_from_db()
        return Response(DesignProductConfigSerializer(target).data)


# ===========================================================================
# MBA Reference Data Views (AC-37)
# ===========================================================================

class MbaColorsView(APIView):
    """GET /api/mba/colors/ -- canonical Amazon MBA garment color palette.

    Returns a static list of `{key, name, hex}` objects sourced from
    `publish_app.constants.MBA_COLORS`. Global read-only list (no workspace
    scope, no pagination). Consumed by the Edit Page ColorGrid so the frontend
    does not hardcode Amazon's palette.
    """

    @method_decorator(cache_control(public=True, max_age=3600))
    def get(self, request):
        return Response(MBA_COLORS)
