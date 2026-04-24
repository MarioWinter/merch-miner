"""DRF views for publish_app API."""

import logging
from urllib.parse import quote

import django_rq
from django.db import IntegrityError, models, transaction
from django.http import HttpResponse
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

from publish_app.catalogs import MBA_PRODUCT_CATALOG
from publish_app.constants import MBA_COLORS

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.api.throttles import AIImproveThrottle
from publish_app.services.ai_improve import (
    AIImproveError,
    apply_to_listing,
    build_prompt,
    call_llm,
    ensure_design_vision,
    validate_and_truncate,
)
from publish_app.api.serializers import (
    PRODUCT_ENTRY_SCOPE_FIELDS,
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
    ExportLogSerializer,
    ExportPreflightRequestSerializer,
    LifecycleSalesUpdateSerializer,
    ListingConvertSerializer,
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
    ExportLog,
    Listing,
    ProductLifecycle,
    UploadJob,
    UploadTemplate,
)
from publish_app.services import flyingupload_export
from workspace_app.models import Membership

logger = logging.getLogger(__name__)


class LLMEndpointThrottle(UserRateThrottle):
    rate = '10/minute'


class PublishPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _get_workspace_id(request):
    # Prefer explicit header; fall back to user's first active membership.
    header_ws = request.headers.get('X-Workspace-Id')
    if header_ws:
        return header_ws
    user = getattr(request, 'user', None)
    if user is None or not user.is_authenticated:
        return None
    membership = (
        Membership.objects
        .filter(user=user, status=Membership.Status.ACTIVE)
        .values_list('workspace_id', flat=True)
        .first()
    )
    return str(membership) if membership else None


def _ws_error():
    return Response(
        {'error': 'No active workspace.'},
        status=status.HTTP_400_BAD_REQUEST,
    )


# ===========================================================================
# Listing Views
# ===========================================================================

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
                # AC-51, EC-22: never surface templates on the per-idea
                # listing endpoint -- Edit page must only see real listings.
                is_template=False,
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
    """PATCH/DELETE /api/listings/{id}/.

    - PATCH: partial update, status reverts to draft on content edit.
    - DELETE: removes the listing. Works for both regular + template
      listings; workspace isolation enforced.
    """

    def patch(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        listing = get_object_or_404(Listing, pk=pk, workspace_id=ws_id)
        serializer = ListingUpdateSerializer(listing, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        # EC-42: Revert to draft on visible content edit (Brand / Title /
        # Bullets / Description). `keyword_context` is explicitly excluded
        # because it's AI-input guidance, not user-facing listing copy --
        # editing it must not knock a Ready/Published listing back to draft.
        content_fields = {
            'brand_name', 'title', 'bullet_1', 'bullet_2', 'description',
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

    def delete(self, request, pk):
        """AC-49: DELETE /api/listings/<id>/ supports templates.

        Workspace isolation via the direct `workspace_id` FK on Listing.
        Cross-workspace -> 404.
        """
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        listing = get_object_or_404(Listing, pk=pk, workspace_id=ws_id)
        listing.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
            f"Description: {listing.description}\n"
        )

        return Response({'text': text, 'listing_id': str(listing.id)})


class ListingAIImproveView(APIView):
    """POST /api/listings/{id}/ai-improve/ -- AI rewrite of listing copy.

    Pipeline (see ``publish_app.services.ai_improve``):
        1. ``ensure_design_vision`` (cached on DesignAsset)
        2. ``build_prompt`` (text-only, vision context embedded)
        3. ``call_llm`` (OpenRouter, model from ``ListingImproveNodeConfig``)
        4. ``validate_and_truncate`` (coerce + cap to char limits)
        5. ``apply_to_listing`` (persist; reverts status to ``draft``)

    AC-69..AC-72. EC-31 (no design -> 400). EC-33 (LLM failure -> 502,
    listing unchanged).
    """

    throttle_classes = [AIImproveThrottle]

    def post(self, request, pk):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        # Workspace isolation via direct ``workspace_id`` FK on Listing.
        # Cross-workspace -> 404 (matches other Listing views).
        listing = get_object_or_404(
            Listing.objects.select_related('design', 'idea'),
            pk=pk,
            workspace_id=ws_id,
        )

        # EC-31: AI Improve requires a linked design (we need the vision pass).
        if listing.design is None:
            return Response(
                {'error': 'AI Improve requires a linked design asset'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            vision_context = ensure_design_vision(listing.design)
            messages = build_prompt(
                listing=listing,
                vision_context=vision_context,
                keyword_context=listing.keyword_context or '',
                language=listing.language or 'en',
            )
            raw = call_llm(messages)
            fields, truncated = validate_and_truncate(raw)
            listing = apply_to_listing(listing, fields)
        except AIImproveError:
            # EC-33: upstream LLM failure. Log full exception for ops, but
            # return a generic message to the client (listing unchanged).
            logger.exception('AI Improve LLM pipeline failed for listing %s', pk)
            return Response(
                {'error': 'AI Improve LLM call failed'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(
            {
                'listing': ListingSerializer(listing).data,
                'truncated_fields': truncated,
            },
            status=status.HTTP_200_OK,
        )


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
    - On MBA -> Global: keep brand_name/title/description, drop bullets +
      keyword_context (not part of Global's simpler shape).
    - On Global -> MBA: keep brand_name/title, promote description to
      bullet_1 when bullet_1 is empty, leave bullet_2 + keyword_context
      blank for the user to fill in.
    - For any other direction (e.g. to Displate), do a straight field copy
      so nothing is silently lost.

    PROJ-11 Phase R3 (2026-04-24 -- AC-109): marketplace-scoped fields never
    cross the convert boundary. ``keywords`` / ``type_flags`` /
    ``color_mode`` / ``background_color_hex`` stay on whichever tab they
    were set on -- convert leaves them untouched on the source AND does not
    initialize them on the target (they default to empty per AC-82).
    ``brand_name`` and ``category`` ARE copied, with ``category`` dropped
    when the target is Displate (serializer gate would reject it anyway).
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
        'keyword_context': source.keyword_context,
        # AC-109: `category` is copied across tabs (MBA + Global), but
        # dropped when the target is Displate (serializer gate rejects it
        # there).
        'category': (
            source.category
            if target_marketplace_type != MarketplaceType.DISPLATE
            else ''
        ),
    }

    if (
        source_mt == MarketplaceType.GLOBAL
        and target_marketplace_type == MarketplaceType.MBA
    ):
        # Global -> MBA: promote description into bullet_1 if bullet_1 empty.
        # Drop bullet_2 and keyword_context so the MBA variant starts with
        # only the fields that cleanly map from Global.
        if not payload['bullet_1'] and payload['description']:
            payload['bullet_1'] = payload['description'][:256]
        payload['bullet_2'] = ''
        payload['keyword_context'] = ''

    elif (
        source_mt == MarketplaceType.MBA
        and target_marketplace_type == MarketplaceType.GLOBAL
    ):
        # MBA -> Global: keep brand/title/description. Drop bullets +
        # keyword_context (not part of Global's simpler shape).
        payload['bullet_1'] = ''
        payload['bullet_2'] = ''
        payload['keyword_context'] = ''

    # Any other source/target combination -> straight copy of `payload`
    # (e.g. conversions involving Displate are placeholders for now).

    # AC-109: `keywords` / `type_flags` / `color_mode` /
    # `background_color_hex` are NOT in `payload` by design -- they are
    # marketplace-scoped decorations that must not bleed across tabs. The
    # target Listing gets the model defaults (empty dict/list/string).

    return payload


def _seed_product_config_from_default(
    workspace_id, design, marketplace_type,
):
    """Auto-seed a DesignProductConfig from the workspace's default
    UploadTemplate for ``(workspace, marketplace_type)`` (AC-57..AC-59).

    PROJ-11 Phase K3 (2026-04-23): UploadTemplate and DesignProductConfig
    now share the ``products_config`` per-product shape (Phase K1), so the
    template list is copied verbatim into the new row — no fan-out, no
    shape translation.

    Returns the created ``DesignProductConfig`` instance on success, or
    ``None`` when:
      - ``design`` is ``None`` (AC-59: no target design to hang a config on).
      - A ``DesignProductConfig`` already exists for
        ``(design, marketplace_type)`` (EC-19: never overwrite existing).
      - No default ``UploadTemplate`` is set for
        ``(workspace, marketplace_type)`` (EC-20).

    Callers set ``product_config_seeded = seeded is not None`` on the
    response body (AC-57 contract).

    Must be called inside an open transaction — the caller's
    ``transaction.atomic()`` block keeps the Convert + seed pair consistent.
    """
    if design is None:
        return None

    # EC-19: never overwrite an existing config for this design.
    already_exists = (
        DesignProductConfig.objects
        .filter(design=design, marketplace_type=marketplace_type)
        .exists()
    )
    if already_exists:
        return None

    # EC-20: no default template for this marketplace -> no-op.
    default_template = (
        UploadTemplate.objects
        .filter(
            workspace_id=workspace_id,
            marketplace_type=marketplace_type,
            is_default=True,
        )
        .first()
    )
    if default_template is None:
        return None

    # Copy verbatim. Deep copy so mutations on either side stay isolated.
    source_config = default_template.products_config or []
    seeded_config = [
        dict(entry) if isinstance(entry, dict) else entry
        for entry in source_config
    ]
    # Also deep-copy nested marketplaces[] lists so the two rows don't alias.
    for entry in seeded_config:
        if not isinstance(entry, dict):
            continue
        if isinstance(entry.get('marketplaces'), list):
            entry['marketplaces'] = [
                dict(m) if isinstance(m, dict) else m
                for m in entry['marketplaces']
            ]
        if isinstance(entry.get('fit_types'), list):
            entry['fit_types'] = list(entry['fit_types'])
        if isinstance(entry.get('colors'), list):
            entry['colors'] = list(entry['colors'])

    return DesignProductConfig.objects.create(
        design=design,
        marketplace_type=marketplace_type,
        products_config=seeded_config,
    )


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

    AC-57/AC-59 auto-apply: after the target Listing is created or updated,
    if ``target.design`` is non-null AND no DesignProductConfig exists for
    ``(target.design, target_marketplace_type)`` AND the workspace has a
    default UploadTemplate for that marketplace, seed a new
    DesignProductConfig from the template's field values. Response always
    includes ``product_config_seeded: bool``.
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
            # unique constraint semantics).
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
                # AC-50: convert always materializes a non-template target.
                existing.is_template = False
                existing.save(
                    update_fields=list(payload.keys())
                    + ['status', 'is_template', 'updated_at'],
                )
                # AC-57 auto-apply on overwrite path. When target.design is
                # NULL (AC-59) the helper short-circuits to None.
                seeded = _seed_product_config_from_default(
                    ws_id, existing.design, target_mt,
                )
                body = ListingSerializer(existing).data
                body['product_config_seeded'] = seeded is not None
                return Response(body, status=status.HTTP_200_OK)

            # Create new target Listing. IntegrityError catch guards against
            # a race where a concurrent request inserted the same pair
            # between our SELECT and INSERT.
            #
            # AC-50: when source is a template (`is_template=True`) we still
            # create a fresh non-template target. The target inherits
            # source.design (NULL when source is a template -> NULL design).
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
                        is_template=False,
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

            # AC-57 auto-apply on create path.
            seeded = _seed_product_config_from_default(
                ws_id, created.design, target_mt,
            )

        body = ListingSerializer(created).data
        body['product_config_seeded'] = seeded is not None
        return Response(body, status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Listing Templates (PROJ-11 F5 / AC-45..AC-51)
# ---------------------------------------------------------------------------


class ListingTemplateListCreateView(APIView):
    """GET/POST /api/listings/templates/.

    AC-47 GET: paginated list of `is_template=True` Listings in the caller's
    workspace. Filter: `?marketplace_type=<global|mba|displate>`. Ordered by
    `-created_at`.

    AC-48 POST: create a Listing Template. Server forces
    `is_template=True, design=None` regardless of the request body. Body
    accepts: idea (required FK), marketplace_type, listing text fields.

    EC-16: a request body with a non-null `design` is rejected at the
    serializer with a 400 ValidationError.
    """

    def get(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        marketplace_type = request.query_params.get('marketplace_type')
        if marketplace_type:
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

        qs = (
            Listing.objects
            .filter(workspace_id=ws_id, is_template=True)
            .select_related('idea', 'design')
            .order_by('-created_at')
        )
        if marketplace_type:
            qs = qs.filter(marketplace_type=marketplace_type)

        paginator = PublishPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = ListingSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        from publish_app.api.serializers import ListingTemplateCreateSerializer

        serializer = ListingTemplateCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Workspace isolation: the supplied idea must belong to the caller's
        # workspace. Cross-workspace -> 404 (avoid ID enumeration).
        idea = get_object_or_404(
            Idea, pk=data['idea'].id, workspace_id=ws_id,
        )

        # Force is_template=True + design=None regardless of body (AC-48).
        template = Listing.objects.create(
            workspace_id=ws_id,
            idea=idea,
            design=None,
            is_template=True,
            marketplace_type=data.get(
                'marketplace_type', Listing.MarketplaceType.MBA,
            ),
            brand_name=data.get('brand_name', ''),
            title=data.get('title', ''),
            bullet_1=data.get('bullet_1', ''),
            bullet_2=data.get('bullet_2', ''),
            description=data.get('description', ''),
            keyword_context=data.get('keyword_context', ''),
            language=data.get('language', 'en'),
            generated_by=Listing.GeneratedBy.MANUAL,
            status=Listing.Status.DRAFT,
        )

        return Response(
            ListingSerializer(template).data,
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

        # Full-text-ish search across file_name + tags JSON.
        search = request.query_params.get('search')
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(file_name__icontains=search) | Q(tags__icontains=search))

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


class DesignAssetDuplicateView(APIView):
    """POST /api/designs/gallery/{id}/duplicate/ -- duplicate a DesignAsset.

    PROJ-11 Phase H6 (AC-65, AC-66, EC-27, EC-30).

    Behavior (atomic):
    - Loads source asset via workspace-scoped lookup (cross-workspace -> 404).
    - Streams the source file bytes via ``default_storage`` into a new
      object key, so external storage backends (S3) get a fresh key rather
      than a copy-on-read illusion.
    - Creates a new DesignAsset row inheriting ``workspace``, ``file_name``,
      ``tags``, ``collection``, ``dimensions``, ``file_size``. Forces
      ``source='upload'`` (user-initiated duplicate) and clears
      ``listing``/``idea``/``niche``.
    - Either the file copy + DB row BOTH succeed or neither persists
      (transaction rollback on any failure during the block).
    """

    def post(self, request, pk):
        from django.core.files.base import ContentFile
        from django.core.files.storage import default_storage

        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        source = get_object_or_404(
            DesignAsset.objects.select_related('collection'),
            pk=pk,
            workspace_id=ws_id,
        )

        try:
            with transaction.atomic():
                new_asset = DesignAsset(
                    workspace_id=ws_id,
                    file_name=source.file_name,
                    source=DesignAsset.Source.UPLOAD,
                    dimensions=dict(source.dimensions or {}),
                    file_size=source.file_size,
                    tags=list(source.tags or []),
                    collection=source.collection,
                    # Explicitly clear linking fields per spec.
                    listing=None,
                    idea=None,
                    niche=None,
                    round=source.round,
                    created_by=request.user,
                )

                if source.file and source.file.name:
                    # Stream source bytes -> new storage key. storage.save()
                    # auto-suffixes on collisions so the new object lands at a
                    # fresh key (S3-safe, no overwrite).
                    with default_storage.open(source.file.name, 'rb') as src_fh:
                        content = ContentFile(src_fh.read())
                    new_asset.file.save(source.file_name, content, save=False)

                # External-URL sources (drive/onedrive/generated) have no
                # FileField payload — keep the metadata but flip source to
                # 'upload' so the duplicate is treated as a local copy.

                new_asset.save()
        except (IOError, OSError, ValueError) as exc:
            logger.exception(
                'DesignAsset duplicate failed for source %s: %s', source.pk, exc,
            )
            return Response(
                {
                    'error': 'Failed to duplicate design file.',
                    'detail': str(exc),
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            DesignAssetSerializer(new_asset, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


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
                    for field in ['brand_name', 'title', 'bullet_1',
                                  'bullet_2', 'description',
                                  'keyword_context']:
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
            'description': listing.description,
            'keyword_context': listing.keyword_context,
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
                'description': listing.description,
                'keyword_context': listing.keyword_context,
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

def _valid_upload_template_marketplace_types():
    return {c[0] for c in UploadTemplate.MarketplaceType.choices}


def _clear_sibling_defaults(workspace_id, marketplace_type, exclude_pk=None):
    """Clear ``is_default=True`` on other UploadTemplates sharing the
    ``(workspace, marketplace_type)`` set (AC-54, AC-55, EC-18).

    Called inside a transaction.atomic() block in the caller. Runs BEFORE
    the target row's save() so the partial unique index
    (``upload_template_single_default``) never sees two True rows.
    """
    qs = UploadTemplate.objects.filter(
        workspace_id=workspace_id,
        marketplace_type=marketplace_type,
        is_default=True,
    )
    if exclude_pk is not None:
        qs = qs.exclude(pk=exclude_pk)
    qs.update(is_default=False)


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

        marketplace_type = serializer.validated_data.get(
            'marketplace_type', UploadTemplate.MarketplaceType.MBA,
        )
        is_default = serializer.validated_data.get('is_default', False)

        # AC-55 clear-then-set: before saving a row with is_default=True,
        # atomically clear the flag on siblings that share the target
        # (workspace, marketplace_type). Prevents IntegrityError from the
        # partial unique index.
        with transaction.atomic():
            if is_default:
                _clear_sibling_defaults(ws_id, marketplace_type)
            template = serializer.save(
                workspace_id=ws_id,
                created_by=request.user,
            )

        return Response(
            UploadTemplateSerializer(template).data,
            status=status.HTTP_201_CREATED,
        )


class UploadTemplateDefaultView(APIView):
    """GET /api/upload-templates/default/?marketplace_type=mba (AC-56).

    Returns the single default UploadTemplate for the caller's workspace +
    marketplace_type. 404 when no default is set. Default
    ``marketplace_type=mba`` when the query param is omitted. 400 on invalid
    marketplace_type values.
    """

    def get(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        marketplace_type = request.query_params.get(
            'marketplace_type', UploadTemplate.MarketplaceType.MBA,
        )
        valid = _valid_upload_template_marketplace_types()
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

        template = (
            UploadTemplate.objects
            .filter(
                workspace_id=ws_id,
                marketplace_type=marketplace_type,
                is_default=True,
            )
            .first()
        )
        if not template:
            return Response(
                {
                    'error': (
                        f'No default UploadTemplate set for '
                        f'{marketplace_type}.'
                    ),
                    'code': 'no_default_template',
                },
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(UploadTemplateSerializer(template).data)


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

        # Resolve the effective marketplace_type AFTER this update: body
        # value if provided, else the existing row's value.
        effective_mt = serializer.validated_data.get(
            'marketplace_type', template.marketplace_type,
        )
        # AC-54 clear-then-set: if this update sets is_default=True, clear
        # the flag on siblings in the (workspace, effective_mt) set before
        # saving. Runs inside the same atomic block as the save.
        incoming_default = serializer.validated_data.get('is_default', None)
        with transaction.atomic():
            if incoming_default is True:
                _clear_sibling_defaults(
                    ws_id, effective_mt, exclude_pk=template.pk,
                )
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


def _apply_upsert_product(
    current_config, product_type, patch,
):
    """Merge-or-append one entry in a ``products_config`` list by product_type.

    Returns the mutated list. Preserves order; new entries append at the end.
    Existing entries keep keys not in ``patch`` (shallow merge on top-level
    fields only).
    """
    new_list = []
    replaced = False
    for entry in current_config or []:
        if isinstance(entry, dict) and entry.get('product_type') == product_type:
            merged = {**entry, **patch, 'product_type': product_type}
            new_list.append(merged)
            replaced = True
        else:
            new_list.append(entry)
    if not replaced:
        new_list.append({'product_type': product_type, **patch})
    return new_list


class DesignProductConfigView(APIView):
    """GET/PATCH /api/designs/{design_id}/product-config/.

    GET: returns the config row for ``(design, marketplace_type)``. 404 when
    no row exists (frontend falls back to empty defaults). Default
    ``marketplace_type=mba`` when query param omitted.

    PATCH (Phase J2): two body forms, both require ``marketplace_type``.

    1. Full replace — ``{marketplace_type, products_config: [...]}``.
       Wholesale overwrite of the per-product entry list. Creates the row on
       first call; updates on subsequent calls.

    2. Targeted op — ``{marketplace_type, op, product_type, patch}``.
       Currently only ``op=upsert_product``. Merges ``patch`` into the
       matching entry by ``product_type`` or appends a new entry when no
       match exists (AC-40).
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
        marketplace_type = data['marketplace_type']

        with transaction.atomic():
            config, created = (
                DesignProductConfig.objects
                .select_for_update()
                .get_or_create(
                    design=design,
                    marketplace_type=marketplace_type,
                    defaults={'products_config': []},
                )
            )

            if 'products_config' in data:
                # Full replace.
                config.products_config = data['products_config']
            elif data.get('op') == serializer.OP_UPSERT_PRODUCT:
                config.products_config = _apply_upsert_product(
                    config.products_config,
                    data['product_type'],
                    data['patch'],
                )
            # else: get_or_create created an empty row — leave as-is.

            if not created or 'products_config' in data or data.get('op'):
                config.save(
                    update_fields=['products_config', 'updated_at'],
                )

        config.refresh_from_db()
        return Response(DesignProductConfigSerializer(config).data)


def _copy_scalar_scope_to_target(
    target_entries, source_entries, field, product_type,
):
    """Return new ``products_config`` list for target after a scalar copy.

    - ``product_type`` given: find matching entry on source AND on target
      (404 if either is missing — raises), copy just ``field``. Entries not
      matching ``product_type`` are preserved on the target.
    - ``product_type`` None: apply the field value from the *first* matching
      source entry to all target entries. No-op when source is empty.
    """
    if product_type:
        source_entry = next(
            (
                e for e in source_entries
                if isinstance(e, dict) and e.get('product_type') == product_type
            ),
            None,
        )
        if source_entry is None or field not in source_entry:
            raise _CopyFromNotFound(
                f"Source has no entry for product_type='{product_type}' "
                f"with field '{field}'.",
            )
        updated = []
        matched = False
        for entry in target_entries or []:
            if (
                isinstance(entry, dict)
                and entry.get('product_type') == product_type
            ):
                updated.append({**entry, field: source_entry[field]})
                matched = True
            else:
                updated.append(entry)
        if not matched:
            # Append a new entry with just the copied field scoped to this
            # product_type. Defer shape completeness to a subsequent PATCH.
            updated.append(
                {'product_type': product_type, field: source_entry[field]},
            )
        return updated

    # Apply-across-all: use the first source entry that carries this field.
    source_entry = next(
        (
            e for e in source_entries
            if isinstance(e, dict) and field in e
        ),
        None,
    )
    if source_entry is None:
        raise _CopyFromNotFound(
            f"Source has no entry carrying field '{field}'.",
        )
    value = source_entry[field]
    return [
        {**entry, field: value} if isinstance(entry, dict) else entry
        for entry in (target_entries or [])
    ]


class _CopyFromNotFound(Exception):
    """Internal signal -- source missing the requested data (maps to 404)."""


class DesignProductConfigCopyFromView(APIView):
    """POST /api/designs/{design_id}/product-config/copy-from/.

    Copies a source design's config into the target design. Atomic: source
    read + target upsert happen in one transaction to avoid races with the
    frontend's auto-save PATCH.

    Phase J3 body (AC-41):
      ``{source_design_id, marketplace_type, scope, product_type?}``

    ``scope`` values:
      - ``all`` — copy the entire ``products_config`` list.
      - ``fit_types`` / ``print_side`` / ``colors`` / ``marketplaces`` /
        ``enabled`` — scalar scope. When ``product_type`` is provided, copy
        that field for the matching entry only. When omitted, apply the
        source value across all target entries.

    Workspace isolation: both source and target must be in the caller's
    workspace. Cross-workspace returns 404.
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
        product_type = data.get('product_type') or None

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
                new_products_config = list(source.products_config or [])
            elif scope in PRODUCT_ENTRY_SCOPE_FIELDS:
                try:
                    target_existing = (
                        DesignProductConfig.objects
                        .filter(
                            design=target_design,
                            marketplace_type=marketplace_type,
                        )
                        .values_list('products_config', flat=True)
                        .first()
                    ) or []
                    new_products_config = _copy_scalar_scope_to_target(
                        target_existing,
                        source.products_config or [],
                        scope,
                        product_type,
                    )
                except _CopyFromNotFound as exc:
                    return Response(
                        {
                            'error': str(exc),
                            'code': 'source_scope_missing',
                        },
                        status=status.HTTP_404_NOT_FOUND,
                    )
            else:  # Shouldn't hit — serializer validated the choice
                return Response(
                    {'error': f"Unknown scope '{scope}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            target, _created = (
                DesignProductConfig.objects
                .select_for_update()
                .get_or_create(
                    design=target_design,
                    marketplace_type=marketplace_type,
                    defaults={'products_config': new_products_config},
                )
            )
            if not _created:
                target.products_config = new_products_config
                target.save(
                    update_fields=['products_config', 'updated_at'],
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

    Phase L (2026-04-23): kept as a deprecated alias of the full product
    catalog endpoint. Frontend should switch to ``/api/mba/product-catalog/``.
    """

    @method_decorator(cache_control(public=True, max_age=3600))
    def get(self, request):
        return Response(MBA_COLORS)


class MbaProductCatalogView(APIView):
    """GET /api/mba/product-catalog/ -- canonical MBA product catalog (AC-37).

    Returns the 17-entry ``MBA_PRODUCT_CATALOG`` as a JSON array. Each entry
    describes a single MBA product: supported controls, per-product color
    palette, fit types, print sides, marketplaces, default prices + royalty
    formula per marketplace. Consumed by the Edit Page product scroller /
    color grid / marketplace grid and by the Desktop Upload App.

    Global read-only list — no workspace scope, no pagination. Response
    carries ``Cache-Control: public, max-age=86400`` (24h) so the frontend
    caches aggressively. Updates ship as a backend deploy + cache bust.
    """

    @method_decorator(cache_control(public=True, max_age=86400))
    def get(self, request):
        return Response(list(MBA_PRODUCT_CATALOG))


# ===========================================================================
# FlyingUpload Export Views (PROJ-11 Phase T)
# ===========================================================================

def _resolve_design_ids(
    *,
    workspace_id: str,
    design_ids: list | None,
    collection_id: str | None,
) -> list[str]:
    """Turn a (design_ids, collection_id) input into a concrete UUID list.

    Workspace-isolated. When ``design_ids`` is provided, cross-workspace IDs
    are silently dropped (and the downstream preflight reports missing
    designs as ``design_not_found``); if no valid IDs remain we return []
    so the caller can raise 404.
    """
    if design_ids:
        id_strs = [str(x) for x in design_ids]
        valid = set(
            str(x) for x in DesignAsset.objects
            .filter(workspace_id=workspace_id, id__in=id_strs)
            .values_list('id', flat=True)
        )
        # Preserve caller-provided ordering.
        return [i for i in id_strs if i in valid]

    if collection_id:
        return list(
            str(x) for x in DesignAsset.objects
            .filter(
                workspace_id=workspace_id,
                collection_id=str(collection_id),
            )
            .values_list('id', flat=True)
        )
    return []


def _export_error_response(exc: flyingupload_export.ExportError) -> Response:
    """Map ExportError to a 400 JSON body (AC-107)."""
    status_code = status.HTTP_400_BAD_REQUEST
    if exc.code == 'estimated_archive_too_large':
        status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    return Response(
        {
            'error': str(exc) or exc.code,
            'code': exc.code,
            'details': exc.details,
        },
        status=status_code,
    )


def _build_content_disposition(filename: str) -> str:
    """RFC 5987 Content-Disposition for Unicode-safe filenames.

    Always emits both a 7-bit ``filename=`` fallback and a
    ``filename*=UTF-8''`` parameter so clients on older HTTP libraries still
    get a predictable name.
    """
    ascii_safe = filename.encode('ascii', errors='replace').decode('ascii')
    ascii_safe = ascii_safe.replace('"', '_')
    quoted = quote(filename, safe='')
    return (
        f'attachment; filename="{ascii_safe}"; '
        f"filename*=UTF-8''{quoted}"
    )


def _slugify_workspace(name: str) -> str:
    """Loose slug for filename embedding (keeps A-Z, 0-9, dash)."""
    safe = ''.join(
        ch if (ch.isalnum() or ch in ('-', '_')) else '-' for ch in (name or '')
    ).strip('-')
    return safe or 'workspace'


class FlyingUploadPreflightView(APIView):
    """POST /api/publish/export/flyingupload/preflight/ (AC-91, AC-111).

    No side effects. Returns the same summary the download endpoint would
    use. Accepts either ``design_ids`` or ``collection_id``.
    """

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = ExportPreflightRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        design_ids = _resolve_design_ids(
            workspace_id=ws_id,
            design_ids=data.get('design_ids'),
            collection_id=data.get('collection_id'),
        )
        if not design_ids:
            # Either the caller asked for IDs that don't exist in this
            # workspace, or the collection was empty / cross-workspace.
            return Response(
                {'error': 'No matching designs in workspace.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            summary = flyingupload_export.preflight(
                workspace_id=ws_id,
                design_ids=design_ids,
                template=data['template'],
                fmt=data['format'],
            )
        except flyingupload_export.ExportError as exc:
            return _export_error_response(exc)

        return Response(summary, status=status.HTTP_200_OK)


class FlyingUploadExportView(APIView):
    """POST /api/publish/export/flyingupload/ (AC-111 + AC-116 + AC-136).

    Streams ZIP (xlsx) or plain CSV (csv). Writes ``ExportLog`` at the end of
    a successful export only -- failed exports (400, 413, 502) do NOT create
    a log row.
    """

    def post(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        serializer = ExportPreflightRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        design_ids = _resolve_design_ids(
            workspace_id=ws_id,
            design_ids=data.get('design_ids'),
            collection_id=data.get('collection_id'),
        )
        if not design_ids:
            return Response(
                {'error': 'No matching designs in workspace.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        template = data['template']
        fmt = data['format']

        try:
            if template == ExportLog.Template.MBA:
                if fmt == ExportLog.Format.XLSX:
                    payload, summary = flyingupload_export.build_mba_bundle(
                        ws_id, design_ids,
                    )
                else:
                    payload, summary = flyingupload_export.build_mba_csv(
                        ws_id, design_ids,
                    )
            else:  # basic
                if fmt == ExportLog.Format.XLSX:
                    payload, summary = flyingupload_export.build_basic_bundle(
                        ws_id, design_ids,
                    )
                else:
                    payload, summary = flyingupload_export.build_basic_csv(
                        ws_id, design_ids,
                    )
        except flyingupload_export.ExportError as exc:
            return _export_error_response(exc)
        except Exception:  # pragma: no cover - defensive
            logger.exception(
                'FlyingUpload export failed for workspace %s (template=%s)',
                ws_id, template,
            )
            return Response(
                {'error': 'Export pipeline failed.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Filename: `<workspace_slug>_flyingupload_<template>_<ts>.<ext>`
        # (AC-113).
        ext = 'zip' if fmt == ExportLog.Format.XLSX else 'csv'
        ws_name = ''
        try:
            from workspace_app.models import Workspace
            ws_name = (
                Workspace.objects
                .filter(id=ws_id)
                .values_list('name', flat=True)
                .first()
                or ''
            )
        except Exception:  # pragma: no cover - defensive
            ws_name = ''
        slug = _slugify_workspace(ws_name)
        ts = timezone.now().strftime('%Y%m%d-%H%M%S')
        filename = f'{slug}_flyingupload_{template}_{ts}.{ext}'

        content_type = (
            'application/zip' if fmt == ExportLog.Format.XLSX else 'text/csv'
        )

        # Write ExportLog INSIDE an atomic block, BEFORE streaming the body
        # back -- AC-116 says the row is written at the END of a successful
        # export. Build succeeded -> log it. A client disconnect during
        # streaming does not undo the log row (EC-67).
        with transaction.atomic():
            ExportLog.objects.create(
                workspace_id=ws_id,
                created_by=request.user,
                template=template,
                format=fmt,
                design_ids=design_ids,
                design_count=len(design_ids),
                row_count=int(summary.get('ready_rows') or 0),
                filename=filename,
                output_size_bytes=len(payload),
            )

        response = HttpResponse(payload, content_type=content_type)
        response['Content-Disposition'] = _build_content_disposition(filename)
        response['Content-Length'] = str(len(payload))
        response['X-Export-Ready-Rows'] = str(summary.get('ready_rows') or 0)
        response['X-Export-Total-Designs'] = str(
            summary.get('total_designs') or 0,
        )
        return response


class ExportHistoryListView(APIView):
    """GET /api/publish/export/history/ -- last 50 ExportLog rows (AC-115).

    Workspace-isolated. Paginated (PageNumberPagination). Server hard-caps
    the queryset to 50 rows per workspace regardless of page-size query
    params.
    """

    pagination_class = PublishPagination

    def get(self, request):
        ws_id = _get_workspace_id(request)
        if not ws_id:
            return _ws_error()

        qs = (
            ExportLog.objects
            .filter(workspace_id=ws_id)
            .select_related('created_by')
            .order_by('-created_at')[:50]
        )
        # DRF PageNumberPagination wants a list or queryset; slicing is fine.
        rows = list(qs)

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(rows, request, view=self)
        serializer = ExportLogSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
