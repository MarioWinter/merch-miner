import csv
import hashlib
import json
import logging
import re
from datetime import timedelta

import httpx
from django.core.cache import cache as redis_cache
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db.models import F
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

import django_rq

from scraper_app.brand_filter import SHORT_BRAND_THRESHOLD
from scraper_app.models import (
    AmazonProduct,
    BrandBlacklist,
    BSRSnapshot,
    Keyword,
    MarketplaceChoices,
    PRODUCT_TYPE_SPIDER_KWARGS,
    ProductSearchCache,
    SearchKeywordResult,
    ScrapeJob,
)
from scraper_app.scrapy_app.keyword_extractor import extract_keywords
from scraper_app.tasks import (
    LIVE_SEARCH_MAX_PAGES,
    cancel_scrape_job,
    compute_pages_to_scrape,
    scrape_keyword_job,
)
from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership

from research_app.api.serializers import (
    AmazonProductSerializer,
    BSRSnapshotSerializer,
    LiveSearchSerializer,
    PriceHistorySerializer,
    ProductDetailSerializer,
    ProductFilterSerializer,
    SimilarProductSerializer,
    SuggestionsQuerySerializer,
    UseAsTemplateSerializer,
    compute_bsr_summary,
)

logger = logging.getLogger(__name__)

# Amazon marketplace IDs for autocomplete API
MARKETPLACE_MIDS = {
    'amazon_com': 'ATVPDKIKX0DER',
    'amazon_de': 'A1PA6795UKMFR9',
    'amazon_co_uk': 'A1F83G8C2ARO7P',
    'amazon_fr': 'A13V1IB3VIYBER',
    'amazon_it': 'APJ6JRA9NG5V4',
    'amazon_es': 'A1RKKUPIHCS9HS',
}

SUGGESTIONS_CACHE_TTL = 60  # seconds

# DB-mode keyword aggregation
DB_KEYWORDS_SAMPLE_N = 200
DB_KEYWORDS_CACHE_TTL = 600  # 10 minutes


def _db_keywords_cache_key(validated_data):
    """Build a stable cache key from validated ProductFilterSerializer data.

    Same filter set in different param ordering must produce the same hash.
    """
    canonical = json.dumps(validated_data, sort_keys=True, default=str)
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    return f"research:keywords:{digest}"


OFFICIAL_BRANDS_CACHE_KEY = 'research:official_brands'
OFFICIAL_BRANDS_CACHE_TTL = 300  # 5 minutes

# Precomputed set of concrete AmazonProduct.brand values that match the
# BrandBlacklist patterns. Drives the `hide_official_brands` filter via
# `brand__in=[...]` (indexed equality) instead of `brand__iregex=...`
# (Seq Scan on 100k+ rows). Invalidated by the signal handler in
# research_app.signals on BrandBlacklist save/delete.
BLACKLISTED_BRAND_VALUES_CACHE_KEY = 'research:blacklisted_brand_values'
BLACKLISTED_BRAND_VALUES_CACHE_TTL = 3600  # 1 hour


def _get_official_brands():
    """Return list of blacklisted brand names (lowercased on save by the model).

    Cached in Redis for 5 minutes so admin edits to BrandBlacklist propagate
    within that window without per-request DB hits.
    """
    cached = redis_cache.get(OFFICIAL_BRANDS_CACHE_KEY)
    if cached is not None:
        return cached
    brands = list(BrandBlacklist.objects.values_list('brand_name', flat=True))
    redis_cache.set(OFFICIAL_BRANDS_CACHE_KEY, brands, OFFICIAL_BRANDS_CACHE_TTL)
    return brands


def _get_blacklisted_brand_values():
    """Return the concrete AmazonProduct.brand strings that match the blacklist.

    Replaces the old `brand__iregex` Seq Scan with an indexed `brand__in`
    lookup. The set is precomputed once per cache window:

      1. Pull every distinct non-empty `brand` from AmazonProduct (uses the
         btree index on `brand` — index-only scan).
      2. For each distinct brand, apply the same matching rules as
         `scraper_app.brand_filter.is_brand_blocked`:
           - patterns >SHORT_BRAND_THRESHOLD chars → substring match
           - patterns <=SHORT_BRAND_THRESHOLD chars → exact match
         (Case-insensitive: lowercase + strip the candidate.)
      3. Collect the ORIGINAL brand strings (preserves case as stored).

    Cached in Redis for 1 hour; invalidated on BrandBlacklist save/delete
    via the signal handler in research_app.signals.
    """
    cached = redis_cache.get(BLACKLISTED_BRAND_VALUES_CACHE_KEY)
    if cached is not None:
        return cached

    patterns = _get_official_brands()
    long_brands = [b for b in patterns if len(b) > SHORT_BRAND_THRESHOLD]
    short_brands = [b for b in patterns if len(b) <= SHORT_BRAND_THRESHOLD]

    if not long_brands and not short_brands:
        redis_cache.set(
            BLACKLISTED_BRAND_VALUES_CACHE_KEY, [],
            BLACKLISTED_BRAND_VALUES_CACHE_TTL,
        )
        return []

    distinct_brands = (
        AmazonProduct.objects
        .exclude(brand='')
        .values_list('brand', flat=True)
        .distinct()
    )

    short_set = set(short_brands)
    matched = []
    for brand in distinct_brands:
        candidate = brand.lower().strip()
        if not candidate:
            continue
        if candidate in short_set:
            matched.append(brand)
            continue
        # Substring match for long blacklist patterns.
        for pattern in long_brands:
            if pattern in candidate:
                matched.append(brand)
                break

    redis_cache.set(
        BLACKLISTED_BRAND_VALUES_CACHE_KEY, matched,
        BLACKLISTED_BRAND_VALUES_CACHE_TTL,
    )
    return matched


def _get_active_membership(user):
    """Return first active Membership for user, or None."""
    return (
        Membership.objects
        .filter(user=user, status=Membership.Status.ACTIVE)
        .select_related('workspace')
        .first()
    )


def _get_membership_for_workspace(user, workspace_id):
    """Return Membership if user is active member of workspace_id."""
    try:
        return Membership.objects.select_related('workspace').get(
            user=user,
            workspace_id=workspace_id,
            status=Membership.Status.ACTIVE,
        )
    except Membership.DoesNotExist:
        return None


def _resolve_workspace(request):
    """Resolve workspace from X-Workspace-Id header or first active membership."""
    workspace_id = request.headers.get('X-Workspace-Id')
    if workspace_id:
        membership = _get_membership_for_workspace(request.user, workspace_id)
    else:
        membership = _get_active_membership(request.user)
    if membership:
        return membership.workspace
    return None


def _build_product_queryset(filters):
    """Build filtered AmazonProduct queryset from validated filter data.

    Shared by ProductListView and ProductExportView.
    """
    qs = AmazonProduct.objects.all()

    marketplace = filters.get('marketplace', MarketplaceChoices.AMAZON_COM)
    qs = qs.filter(marketplace=marketplace)

    keyword = filters.get('keyword', '').strip()
    if keyword:
        search_vector = SearchVector(
            'title', weight='A',
        ) + SearchVector(
            'brand', weight='B',
        ) + SearchVector(
            'bullet_1', weight='C',
        ) + SearchVector(
            'bullet_2', weight='C',
        ) + SearchVector(
            'description', weight='D',
        )
        search_query = SearchQuery(keyword)
        qs = qs.annotate(
            search=search_vector,
            rank=SearchRank(search_vector, search_query),
        ).filter(search=search_query)

    # Range filters — only applied if param present.
    # Treat NULL as "unknown — matches any range" so products without that
    # data point are not silently excluded when the user enables the filter
    # at default full range.
    from django.db.models import Q

    bsr_min = filters.get('bsr_min')
    if bsr_min is not None:
        qs = qs.filter(Q(bsr__gte=bsr_min) | Q(bsr__isnull=True))
    bsr_max = filters.get('bsr_max')
    if bsr_max is not None:
        qs = qs.filter(Q(bsr__lte=bsr_max) | Q(bsr__isnull=True))

    rating_min = filters.get('rating_min')
    if rating_min is not None:
        qs = qs.filter(Q(rating__gte=rating_min) | Q(rating__isnull=True))

    reviews_min = filters.get('reviews_min')
    if reviews_min is not None:
        qs = qs.filter(Q(reviews_count__gte=reviews_min) | Q(reviews_count__isnull=True))
    reviews_max = filters.get('reviews_max')
    if reviews_max is not None:
        qs = qs.filter(Q(reviews_count__lte=reviews_max) | Q(reviews_count__isnull=True))

    price_min = filters.get('price_min')
    if price_min is not None:
        qs = qs.filter(Q(price__gte=price_min) | Q(price__isnull=True))
    price_max = filters.get('price_max')
    if price_max is not None:
        qs = qs.filter(Q(price__lte=price_max) | Q(price__isnull=True))

    date_from = filters.get('date_from')
    if date_from is not None:
        qs = qs.filter(listed_date__gte=date_from)
    date_to = filters.get('date_to')
    if date_to is not None:
        qs = qs.filter(listed_date__lte=date_to)

    product_type = filters.get('product_type', '').strip()
    if product_type:
        types = [t.strip() for t in product_type.split(',') if t.strip()]
        if types:
            qs = qs.filter(product_type__in=types)

    subcategory = filters.get('subcategory', '').strip()
    if subcategory:
        qs = qs.filter(subcategory__icontains=subcategory)

    hide_official_brands = filters.get('hide_official_brands', False)
    if hide_official_brands:
        # `brand__in` over a precomputed, cached set hits the btree index on
        # AmazonProduct.brand instead of the previous `brand__iregex` Seq Scan.
        # Matching semantics (substring for long patterns, exact for short
        # patterns) are preserved by `_get_blacklisted_brand_values`.
        blacklisted_brand_values = _get_blacklisted_brand_values()
        if blacklisted_brand_values:
            qs = qs.exclude(brand__in=blacklisted_brand_values)

    exclude_words = filters.get('exclude_words', '').strip()
    if exclude_words:
        words = [w.strip() for w in exclude_words.split(',') if w.strip()]
        for word in words:
            qs = qs.exclude(title__icontains=word)

    # Sorting — every order_by adds `id` as a stable tiebreaker. Two products
    # can share the same primary sort value (e.g. duplicate BSRs across niches,
    # equal price/rating); without a deterministic secondary key the row order
    # of paginated slices is undefined and an offset-based fetch can return
    # the same row on consecutive pages or skip rows entirely.
    # Sorting — every order_by uses F('field').desc/asc(nulls_last=True) so
    # NULL-valued rows always sink to the bottom regardless of direction.
    # PostgreSQL's default ORDER BY DESC puts NULLs FIRST, which made
    # reviews_desc / rating_desc visually identical (the ~40% rows with
    # NULL reviews/rating piled up at the top of every "high-to-low" sort).
    # `id` stays as a deterministic tiebreaker for stable pagination.
    sort_by = filters.get('sort_by', '')
    sort_map = {
        'reviews_desc': F('reviews_count').desc(nulls_last=True),
        'rating_desc': F('rating').desc(nulls_last=True),
        'price_asc': F('price').asc(nulls_last=True),
        'newest': F('listed_date').desc(nulls_last=True),
    }
    # When user selects "BSR low to high", products without BSR data are
    # explicitly hidden (per user spec 2026-05-06): no BSR = no usable rank.
    if sort_by == 'bsr_asc':
        qs = qs.exclude(bsr__isnull=True).order_by('bsr', 'id')
    elif sort_by and sort_by in sort_map:
        qs = qs.order_by(sort_map[sort_by], 'id')
    elif keyword:
        # Relevance order when keyword search active
        qs = qs.order_by('-rank', 'id')
    else:
        # Default sort: bsr ASC with NULLs at the end (visible but ranked last)
        qs = qs.order_by(F('bsr').asc(nulls_last=True), 'id')

    return qs


class SuggestionsView(APIView):
    """GET /api/research/suggestions/ — Amazon autocomplete proxy."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = SuggestionsQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        q = serializer.validated_data['q']
        marketplace = serializer.validated_data['marketplace']

        # Redis cache check
        cache_key = f"suggestions:{q}:{marketplace}"
        cached = redis_cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        mid = MARKETPLACE_MIDS.get(marketplace, MARKETPLACE_MIDS['amazon_com'])
        url = "https://completion.amazon.com/api/2017/suggestions"

        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.get(url, params={'prefix': q, 'mid': mid, 'alias': 'aps'})
                resp.raise_for_status()
                data = resp.json()
                suggestions = [s.get('value', '') for s in data.get('suggestions', [])]
        except Exception:
            logger.warning("Amazon autocomplete failed for q=%s marketplace=%s", q, marketplace)
            suggestions = []

        redis_cache.set(cache_key, suggestions, SUGGESTIONS_CACHE_TTL)
        return Response(suggestions)


class LiveSearchView(APIView):
    """POST /api/research/search/ — trigger live scrape or return cached."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LiveSearchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        keyword_str = serializer.validated_data.get('keyword', '').strip()
        marketplace = serializer.validated_data['marketplace']
        product_type = serializer.validated_data.get('product_type', '')
        sort_by = serializer.validated_data.get('sort_by', '')
        price_min = serializer.validated_data.get('price_min')
        price_max = serializer.validated_data.get('price_max')
        browse_node = serializer.validated_data.get('browse_node', '').strip()
        # NOTE: pages_total / start_page from request body are intentionally
        # ignored. With per-page freshness tracking we always crawl the full
        # 1..LIVE_SEARCH_MAX_PAGES window and let `compute_pages_to_scrape`
        # decide which pages still need scraping. Serializer keeps the fields
        # for back-compat with older clients.

        workspace = _resolve_workspace(request)
        if not workspace:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Per-page freshness check. Returns:
        #   (None, 0, existing) -> all pages fresh, skip scrape
        #   (start, count, existing_or_None) -> scrape from `start` for `count` pages
        start_page, pages_total, existing_cache = compute_pages_to_scrape(
            workspace=workspace,
            keyword_str=keyword_str,
            marketplace=marketplace,
            sort_by=sort_by,
            price_min=price_min,
            price_max=price_max,
            browse_node=browse_node,
            product_type_filter=product_type,
            max_total_pages=LIVE_SEARCH_MAX_PAGES,
        )

        if start_page is None:
            # All pages fresh — return existing cache as completed.
            return Response({
                'cache_id': str(existing_cache.id),
                'status': existing_cache.status,
            })

        # Hard cap (defensive — `compute_pages_to_scrape` already enforces it).
        pages_total = min(pages_total, LIVE_SEARCH_MAX_PAGES)

        # Create new job + cache
        keyword_obj, _ = Keyword.objects.get_or_create(
            keyword=keyword_str, marketplace=marketplace,
        )

        scrape_job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.LIVE,
            keyword=keyword_obj,
            marketplace=marketplace,
            status=ScrapeJob.Status.PENDING,
            product_type_filter=product_type,
            sort_by=sort_by,
            price_min=price_min,
            price_max=price_max,
            browse_node=browse_node,
            pages_total=pages_total,
            start_page=start_page,
        )

        # Carry forward existing pages_scraped_at so the spider's per-page
        # stamps merge with prior fresh entries instead of clobbering them.
        carried_pages_map = (
            dict(existing_cache.pages_scraped_at or {}) if existing_cache else {}
        )

        search_cache = ProductSearchCache.objects.create(
            keyword=keyword_obj,
            scrape_job=scrape_job,
            workspace=workspace,
            status=ProductSearchCache.Status.PENDING,
            sort_by=sort_by,
            price_min=price_min,
            price_max=price_max,
            browse_node=browse_node,
            product_type_filter=product_type,
            pages_scraped_at=carried_pages_map,
        )

        # Build spider kwargs
        spider_kwargs = {}
        if product_type and product_type in PRODUCT_TYPE_SPIDER_KWARGS:
            spider_kwargs.update(PRODUCT_TYPE_SPIDER_KWARGS[product_type])

        # Override browse_node if explicitly set by user
        if browse_node:
            spider_kwargs['browse_node'] = browse_node

        queue = django_rq.get_queue('scraper')
        rq_job = queue.enqueue(
            scrape_keyword_job,
            keyword_str=keyword_str,
            marketplace=marketplace,
            scrape_job_id=str(scrape_job.id),
            sort_by=sort_by,
            price_min=price_min,
            price_max=price_max,
            browse_node=spider_kwargs.get('browse_node', ''),
            start_page=start_page,
            max_pages=pages_total,
            **{k: v for k, v in spider_kwargs.items() if k != 'browse_node'},
        )
        scrape_job.rq_job_id = rq_job.id
        scrape_job.save(update_fields=['rq_job_id'])

        return Response(
            {
                'cache_id': str(search_cache.id),
                'status': search_cache.status,
            },
            status=status.HTTP_201_CREATED,
        )


class SearchStatusView(APIView):
    """GET /api/research/search/{cache_id}/status/ — poll scrape status."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, cache_id):
        try:
            search_cache = ProductSearchCache.objects.select_related(
                'scrape_job', 'keyword', 'workspace',
            ).get(id=cache_id)
        except ProductSearchCache.DoesNotExist:
            return Response(
                {'error': 'Search cache not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Workspace ownership check
        workspace = _resolve_workspace(request)
        if not workspace:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if search_cache.workspace_id and search_cache.workspace_id != workspace.id:
            return Response(
                {'error': 'Access denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        scrape_job = search_cache.scrape_job
        result = {
            'status': search_cache.status,
            'pages_done': scrape_job.pages_done if scrape_job else 0,
            'products_scraped': scrape_job.products_scraped if scrape_job else 0,
            'error_log': scrape_job.error_log if scrape_job else '',
            'sort_by': search_cache.sort_by,
            'price_min': str(search_cache.price_min) if search_cache.price_min is not None else None,
            'price_max': str(search_cache.price_max) if search_cache.price_max is not None else None,
            'browse_node': search_cache.browse_node,
        }

        # On completion include first page of products + keyword results
        if search_cache.status == ProductSearchCache.Status.COMPLETED and search_cache.keyword:
            products = (
                AmazonProduct.objects
                .filter(
                    keywords=search_cache.keyword,
                    marketplace=search_cache.keyword.marketplace,
                )
                .order_by('bsr')[:50]
            )
            result['products'] = AmazonProductSerializer(products, many=True).data

            # Include SearchKeywordResult if available
            try:
                kw_result = search_cache.keyword_result
                result['keyword_result'] = {
                    'top_focus_keywords': kw_result.top_focus_keywords,
                    'top_long_tail_keywords': kw_result.top_long_tail_keywords,
                }
            except SearchKeywordResult.DoesNotExist:
                result['keyword_result'] = None

        return Response(result)


class SearchCancelView(APIView):
    """POST /api/research/search/{cache_id}/cancel/ — cancel a live search job."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, cache_id):
        try:
            search_cache = ProductSearchCache.objects.select_related(
                'scrape_job', 'workspace',
            ).get(id=cache_id)
        except ProductSearchCache.DoesNotExist:
            return Response(
                {'error': 'Search cache not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Workspace ownership check
        workspace = _resolve_workspace(request)
        if not workspace:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if search_cache.workspace_id and search_cache.workspace_id != workspace.id:
            return Response(
                {'error': 'Access denied.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        scrape_job = search_cache.scrape_job
        if not scrape_job:
            return Response({'status': search_cache.status})

        # Only cancel if job is still cancellable
        if scrape_job.status in (ScrapeJob.Status.PENDING, ScrapeJob.Status.RUNNING):
            cancel_scrape_job(scrape_job.id, cancelled_by='user')
            scrape_job.refresh_from_db()

        return Response({'status': scrape_job.status})


class ProductListView(APIView):
    """GET /api/research/products/ — DB research with full filters."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ProductFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        filters = serializer.validated_data

        qs = _build_product_queryset(filters)

        # Pagination
        page = filters.get('page', 1)
        page_size = filters.get('page_size', 50)
        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        products = qs[start:end]

        # Build next/previous URLs preserving all filter params
        base_url = request.build_absolute_uri(request.path)
        query_dict = request.query_params.copy()
        next_url = None
        previous_url = None
        if end < total:
            query_dict['page'] = page + 1
            query_dict['page_size'] = page_size
            next_url = f"{base_url}?{query_dict.urlencode()}"
        if page > 1:
            query_dict['page'] = page - 1
            query_dict['page_size'] = page_size
            previous_url = f"{base_url}?{query_dict.urlencode()}"

        return Response({
            'count': total,
            'results': AmazonProductSerializer(products, many=True).data,
            'next': next_url,
            'previous': previous_url,
        })


class DbKeywordsView(APIView):
    """GET /api/research/products/keywords/ — aggregate keywords for DB-mode filters.

    Runs the existing keyword extractor on the top-N (by BSR asc) products
    matching the same filter set used by ProductListView. Cached in Redis
    for 10 minutes, keyed by a SHA256 of the canonicalized validated_data.
    No workspace scoping — AmazonProduct is a shared global catalog.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = ProductFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        filters = serializer.validated_data

        cache_key = _db_keywords_cache_key(filters)
        cached_payload = redis_cache.get(cache_key)
        if cached_payload is not None:
            # Don't mutate the cached dict — copy first so concurrent
            # readers don't see a flipped `cached` flag.
            payload = dict(cached_payload)
            payload['cached'] = True
            return Response(payload)

        qs = _build_product_queryset(filters)
        # Top-N by BSR ascending, mirroring ProductListView's default ordering.
        # `.values(...)` projection materializes only what the extractor needs.
        products = list(
            qs.order_by(F('bsr').asc(nulls_last=True), 'id')
            .values('title', 'brand', 'bullet_1', 'bullet_2', 'description')
            [:DB_KEYWORDS_SAMPLE_N]
        )

        extracted = extract_keywords(products)
        payload = {
            'top_focus_keywords': extracted['global_top_focus'],
            'top_long_tail_keywords': extracted['global_top_long_tail'],
            'sample_size': len(products),
            'cached': False,
        }
        redis_cache.set(cache_key, payload, DB_KEYWORDS_CACHE_TTL)
        return Response(payload)


class ProductExportView(APIView):
    """GET /api/research/products/export/ — CSV export with streaming."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    CSV_COLUMNS = [
        'ASIN', 'Title', 'Brand', 'BSR', 'Rating', 'Reviews',
        'Price', 'Product Type', 'Subcategory', 'Listed Date',
        'Scraped At', 'Marketplace',
    ]

    def get(self, request):
        serializer = ProductFilterSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        filters = serializer.validated_data

        qs = _build_product_queryset(filters)

        def stream_csv():
            """Generator yielding CSV rows."""
            # Use a pseudo-buffer for csv.writer
            class Echo:
                def write(self, value):
                    return value

            writer = csv.writer(Echo())
            yield writer.writerow(self.CSV_COLUMNS)

            for product in qs.iterator(chunk_size=200):
                yield writer.writerow([
                    product.asin,
                    product.title,
                    product.brand,
                    product.bsr,
                    product.rating,
                    product.reviews_count,
                    product.price,
                    product.get_product_type_display(),
                    product.subcategory,
                    product.listed_date.isoformat() if product.listed_date else '',
                    product.scraped_at.isoformat() if product.scraped_at else '',
                    product.marketplace,
                ])

        response = StreamingHttpResponse(stream_csv(), content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="research-export.csv"'
        return response


class BSRHistoryView(APIView):
    """GET /api/research/products/{asin}/bsr-history/ — BSR snapshots."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, asin):
        if not re.match(r'^[A-Z0-9]{10}$', asin):
            return Response(
                {'error': 'Invalid ASIN format. Must be 10 alphanumeric characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        marketplace = request.query_params.get('marketplace')
        if not marketplace:
            return Response(
                {'error': 'marketplace query param is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if marketplace not in dict(MarketplaceChoices.choices):
            return Response(
                {'error': f'Invalid marketplace: {marketplace}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify product exists
        product_exists = AmazonProduct.objects.filter(
            asin=asin, marketplace=marketplace,
        ).exists()
        if not product_exists:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        cutoff = timezone.now() - timedelta(days=90)
        snapshots = list(
            BSRSnapshot.objects
            .filter(
                product__asin=asin,
                product__marketplace=marketplace,
                recorded_at__gte=cutoff,
            )
            .order_by('recorded_at')
        )

        summary = compute_bsr_summary(snapshots)

        return Response({
            'snapshots': BSRSnapshotSerializer(snapshots, many=True).data,
            'summary': summary,
        })


def _validate_asin(asin):
    """Return error Response if ASIN invalid, else None."""
    if not re.match(r'^[A-Z0-9]{10}$', asin):
        return Response(
            {'error': 'Invalid ASIN format. Must be 10 alphanumeric characters.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return None


def _get_product_or_404(asin, marketplace=None):
    """Return (product, None) or (None, error_response)."""
    filters = {'asin': asin}
    if marketplace:
        filters['marketplace'] = marketplace
    try:
        product = AmazonProduct.objects.get(**filters)
        return product, None
    except AmazonProduct.DoesNotExist:
        return None, Response(
            {'error': 'Product not found.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    except AmazonProduct.MultipleObjectsReturned:
        # ASIN without marketplace may match multiple — get first
        product = AmazonProduct.objects.filter(**filters).first()
        return product, None


class ProductDetailView(APIView):
    """GET /api/research/products/{asin}/ — single product with meta_keywords."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, asin):
        err = _validate_asin(asin)
        if err:
            return err

        marketplace = request.query_params.get('marketplace')

        filters = {'asin': asin}
        if marketplace:
            if marketplace not in dict(MarketplaceChoices.choices):
                return Response(
                    {'error': f'Invalid marketplace: {marketplace}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            filters['marketplace'] = marketplace

        product = (
            AmazonProduct.objects
            .prefetch_related('meta_keywords')
            .filter(**filters)
            .first()
        )
        if not product:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(ProductDetailSerializer(product).data)


class SimilarProductsView(APIView):
    """GET /api/research/products/{asin}/similar/ — products with overlapping meta_keywords."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, asin):
        err = _validate_asin(asin)
        if err:
            return err

        marketplace = request.query_params.get('marketplace')

        filters = {'asin': asin}
        if marketplace:
            filters['marketplace'] = marketplace

        product = (
            AmazonProduct.objects
            .prefetch_related('meta_keywords')
            .filter(**filters)
            .first()
        )
        if not product:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get meta_keyword IDs for this product
        keyword_ids = list(product.meta_keywords.values_list('id', flat=True))
        if not keyword_ids:
            return Response([])

        # Find products sharing meta_keywords in same marketplace, exclude self
        from django.db.models import Count

        similar = (
            AmazonProduct.objects
            .filter(
                meta_keywords__id__in=keyword_ids,
                marketplace=product.marketplace,
            )
            .exclude(id=product.id)
            .annotate(shared_count=Count('meta_keywords'))
            .order_by('-shared_count')[:20]
        )

        return Response(SimilarProductSerializer(similar, many=True).data)


class SameBrandView(APIView):
    """GET /api/research/products/{asin}/same-brand/ — products with same brand + marketplace."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, asin):
        err = _validate_asin(asin)
        if err:
            return err

        marketplace = request.query_params.get('marketplace')

        filters = {'asin': asin}
        if marketplace:
            filters['marketplace'] = marketplace

        product = AmazonProduct.objects.filter(**filters).first()
        if not product:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not product.brand:
            return Response([])

        same_brand = (
            AmazonProduct.objects
            .filter(brand=product.brand, marketplace=product.marketplace)
            .exclude(id=product.id)
            .order_by('bsr')[:20]
        )

        return Response(SimilarProductSerializer(same_brand, many=True).data)


class PriceHistoryView(APIView):
    """GET /api/research/products/{asin}/price-history/ — price snapshots for last 90 days."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, asin):
        err = _validate_asin(asin)
        if err:
            return err

        marketplace = request.query_params.get('marketplace')
        if not marketplace:
            return Response(
                {'error': 'marketplace query param is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if marketplace not in dict(MarketplaceChoices.choices):
            return Response(
                {'error': f'Invalid marketplace: {marketplace}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        product_exists = AmazonProduct.objects.filter(
            asin=asin, marketplace=marketplace,
        ).exists()
        if not product_exists:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        cutoff = timezone.now() - timedelta(days=90)
        snapshots = (
            BSRSnapshot.objects
            .filter(
                product__asin=asin,
                product__marketplace=marketplace,
                recorded_at__gte=cutoff,
                price__isnull=False,
            )
            .order_by('recorded_at')
        )

        return Response(PriceHistorySerializer(snapshots, many=True).data)


class UseAsTemplateView(APIView):
    """POST /api/research/products/{asin}/use-as-template/ — create Listing draft from product."""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, asin):
        err = _validate_asin(asin)
        if err:
            return err

        serializer = UseAsTemplateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        niche_id = serializer.validated_data['niche_id']

        workspace = _resolve_workspace(request)
        if not workspace:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Verify niche belongs to workspace
        from niche_app.models import Niche

        try:
            niche = Niche.objects.get(id=niche_id, workspace=workspace)
        except Niche.DoesNotExist:
            return Response(
                {'error': 'Niche not found or not in your workspace.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get product
        product = AmazonProduct.objects.filter(asin=asin).first()
        if not product:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Create a placeholder Idea for the Listing (manual, from product copy)
        from idea_app.models import Idea

        idea = Idea.objects.create(
            workspace=workspace,
            niche=niche,
            slogan_text=product.title[:200] if product.title else 'Template from research',
            is_manual=True,
            source_product_url=product.product_url or '',
            status=Idea.Status.APPROVED,
            created_by=request.user,
        )

        # Create Listing draft pre-populated from product
        from publish_app.models import Listing

        listing = Listing.objects.create(
            workspace=workspace,
            idea=idea,
            brand_name=product.brand[:50] if product.brand else '',
            title=product.title[:60] if product.title else '',
            bullet_1=product.bullet_1[:256] if product.bullet_1 else '',
            bullet_2=product.bullet_2[:256] if product.bullet_2 else '',
            description=product.description[:2000] if product.description else '',
            status=Listing.Status.DRAFT,
            generated_by=Listing.GeneratedBy.MANUAL,
        )

        return Response(
            {
                'listing_id': str(listing.id),
                'idea_id': str(idea.id),
            },
            status=status.HTTP_201_CREATED,
        )
