"""Keyword Research & Bank API views."""

import csv
import logging
import re

from django.db.models import Count
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership
from niche_app.models import Niche
from keyword_app.models import (
    NicheKeyword,
    NicheKeywordGroup,
)
from keyword_app.api.serializers import (
    KeywordEnrichRequestSerializer,
    KeywordExportQuerySerializer,
    KeywordHistoryQuerySerializer,
    KeywordJSDataSerializer,
    KeywordProductCountRequestSerializer,
    KeywordProductCountSerializer,
    KeywordSearchQuerySerializer,
    KeywordSearchResultSerializer,
    NicheKeywordBulkAddSerializer,
    NicheKeywordBulkDeleteSerializer,
    NicheKeywordCreateSerializer,
    NicheKeywordGroupCreateSerializer,
    NicheKeywordGroupSerializer,
    NicheKeywordGroupUpdateSerializer,
    NicheKeywordSerializer,
    NicheKeywordUpdateSerializer,
)
from keyword_app.services.autocomplete_service import get_autocomplete_suggestions
from keyword_app.services.junglescout_service import (
    enrich_keywords,
    get_cached_js_data,
    get_keyword_history,
    is_js_configured,
)
from keyword_app.services.datamuse_service import get_synonyms
from keyword_app.services.product_count_scraper import (
    get_cached_product_counts,
    scrape_product_count,
)

logger = logging.getLogger(__name__)


# ---- Helpers ----

def _get_membership(user, request):
    """Resolve workspace membership from X-Workspace-Id header or first active."""
    workspace_id = request.headers.get('X-Workspace-Id')
    try:
        if workspace_id:
            return Membership.objects.select_related('workspace').get(
                user=user, workspace_id=workspace_id,
                status=Membership.Status.ACTIVE,
            )
        return (
            Membership.objects
            .filter(user=user, status=Membership.Status.ACTIVE)
            .select_related('workspace')
            .first()
        )
    except Membership.DoesNotExist:
        return None


def _get_niche_for_member(niche_id, user, request):
    """Return niche if user is workspace member, else None."""
    membership = _get_membership(user, request)
    if not membership:
        return None, None
    try:
        niche = Niche.objects.get(id=niche_id, workspace=membership.workspace)
        return niche, membership
    except Niche.DoesNotExist:
        return None, membership


class KeywordPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ==============================================================
# Keyword Research API (global search + enrich + history + export)
# ==============================================================

class KeywordSearchView(APIView):
    """
    GET /api/keywords/search/
    Merged results: DB keywords + Amazon Autocomplete.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = KeywordSearchQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data['query']
        marketplace = serializer.validated_data['marketplace']
        page = serializer.validated_data.get('page', 1)
        page_size = serializer.validated_data.get('page_size', 20)

        membership = _get_membership(request.user, request)
        if not membership:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        results = []
        seen_keywords = set()

        # Source 1: DB keywords (NicheKeyword)
        db_keywords = (
            NicheKeyword.objects
            .filter(
                niche__workspace=membership.workspace,
                keyword__icontains=query,
            )
            .values('keyword')
            .annotate(count=Count('id'))
            .order_by('-count')[:100]
        )
        for row in db_keywords:
            kw = row['keyword']
            if kw not in seen_keywords:
                seen_keywords.add(kw)
                results.append({
                    'keyword': kw,
                    'source': 'listing',
                    'in_product_count': 0,
                    'in_slogan_count': 0,
                })

        # Source 1b: NicheKeywordAnalysis all_keywords_flat
        from niche_research_app.models import NicheKeywordAnalysis
        analyses = NicheKeywordAnalysis.objects.filter(
            niche__workspace=membership.workspace,
            all_keywords_flat__icontains=query,
        )[:20]
        for analysis in analyses:
            for kw in (analysis.top_focus_keywords or []):
                if isinstance(kw, str) and query.lower() in kw.lower() and kw not in seen_keywords:
                    seen_keywords.add(kw)
                    results.append({
                        'keyword': kw,
                        'source': 'listing',
                        'in_product_count': 0,
                        'in_slogan_count': 0,
                    })

        # Source 1c: MetaKeyword (scraped listing meta keywords)
        # MetaKeyword is not workspace-scoped — extracted from Amazon listings globally.
        # This is acceptable: keywords like "funny camping" are universal, not workspace-specific.
        from scraper_app.models import MetaKeyword, SearchKeywordResult
        meta_kws = (
            MetaKeyword.objects
            .filter(keyword__icontains=query)
            .order_by('-frequency')[:100]
        )
        for mk in meta_kws:
            kw = mk.keyword
            if kw not in seen_keywords:
                seen_keywords.add(kw)
                results.append({
                    'keyword': kw,
                    'source': 'listing',
                    'in_product_count': 0,
                    'in_slogan_count': 0,
                })

        # Source 1d: SearchKeywordResult (AI-extracted search keywords, workspace-scoped)
        skr_qs = SearchKeywordResult.objects.filter(
            all_keywords_flat__icontains=query,
            search_cache__workspace=membership.workspace,
        )[:20]
        query_lower = query.lower()
        for skr in skr_qs:
            for kw_list in (skr.top_focus_keywords, skr.top_long_tail_keywords):
                for item in (kw_list or []):
                    # Items may be dicts with 'keyword' key or plain strings
                    kw = item.get('keyword', '') if isinstance(item, dict) else str(item)
                    if kw and query_lower in kw.lower() and kw not in seen_keywords:
                        seen_keywords.add(kw)
                        results.append({
                            'keyword': kw,
                            'source': 'listing',
                            'in_product_count': 0,
                            'in_slogan_count': 0,
                        })

        # Note: Amazon Autocomplete removed from this endpoint (Phase 15).
        # Frontend calls /api/research/suggestions/ directly as Group 2 (source=suggestion).

        # Paginate first, then enrich only the page (avoids N+1 on full result set)
        total_count = len(results)
        start = (page - 1) * page_size
        end = start + page_size
        page_results = results[start:end]

        # Enrich only paginated keywords (BUG-2 fix: max page_size queries, not all)
        page_kws = [r['keyword'] for r in page_results]
        if page_kws:
            from scraper_app.models import AmazonProduct
            from idea_app.models import Idea

            product_counts = {}
            for kw in page_kws:
                product_counts[kw] = AmazonProduct.objects.filter(
                    title__icontains=kw,
                ).count()

            slogan_counts = {}
            for kw in page_kws:
                slogan_counts[kw] = Idea.objects.filter(
                    workspace=membership.workspace,
                    slogan_text__icontains=kw,
                ).count()

            for r in page_results:
                r['in_product_count'] = product_counts.get(r['keyword'], 0)
                r['in_slogan_count'] = slogan_counts.get(r['keyword'], 0)

        # Attach JS data where cached
        js_cache = get_cached_js_data(page_kws, marketplace)
        for r in page_results:
            cache_entry = js_cache.get(r['keyword'])
            r['js_data'] = KeywordJSDataSerializer(cache_entry).data if cache_entry else None

        # Attach Amazon product count from KeywordProductCount cache (AC-9c)
        product_count_cache = get_cached_product_counts(page_kws, marketplace)
        for r in page_results:
            pc = product_count_cache.get(r['keyword'])
            if pc:
                r['amazon_product_count'] = pc.product_count
                r['product_count_fetched_at'] = pc.fetched_at
            else:
                r['amazon_product_count'] = None
                r['product_count_fetched_at'] = None

        return Response({
            'count': total_count,
            'page': page,
            'page_size': page_size,
            'results': KeywordSearchResultSerializer(page_results, many=True).data,
        })


class KeywordEnrichView(APIView):
    """
    POST /api/keywords/enrich/
    On-demand JungleScout enrichment with 30-day cache.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = KeywordEnrichRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        keywords = serializer.validated_data['keywords']
        marketplace = serializer.validated_data['marketplace']

        if not is_js_configured():
            return Response(
                {'error': 'JungleScout API key not configured'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = _get_membership(request.user, request)
        workspace = membership.workspace if membership else None

        try:
            cache_map = enrich_keywords(
                keywords, marketplace,
                user=request.user, workspace=workspace,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        result = {}
        for kw in keywords:
            entry = cache_map.get(kw)
            if entry:
                result[kw] = KeywordJSDataSerializer(entry).data
            else:
                result[kw] = None

        return Response({'data': result})


class KeywordHistoryView(APIView):
    """
    GET /api/keywords/{keyword}/history/
    Historical search volume for trend chart.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, keyword):
        serializer = KeywordHistoryQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        marketplace = serializer.validated_data['marketplace']

        if not is_js_configured():
            return Response(
                {'error': 'JungleScout API key not configured'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = _get_membership(request.user, request)
        workspace = membership.workspace if membership else None

        try:
            history = get_keyword_history(
                keyword, marketplace,
                user=request.user, workspace=workspace,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'keyword': keyword, 'marketplace': marketplace, 'data': history})


class KeywordExportView(APIView):
    """
    GET /api/keywords/export/
    CSV export with StreamingHttpResponse.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = KeywordExportQuerySerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data['query']
        marketplace = serializer.validated_data['marketplace']

        membership = _get_membership(request.user, request)
        if not membership:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Collect keywords (same logic as search but no pagination)
        results = []
        seen = set()

        db_keywords = (
            NicheKeyword.objects
            .filter(
                niche__workspace=membership.workspace,
                keyword__icontains=query,
            )
            .values_list('keyword', flat=True)
            .distinct()[:500]
        )
        for kw in db_keywords:
            if kw not in seen:
                seen.add(kw)
                results.append(kw)

        autocomplete = get_autocomplete_suggestions(query, marketplace)
        for s in autocomplete:
            if s not in seen:
                seen.add(s)
                results.append(s)

        # Get JS cache + product count cache for all keywords
        js_cache = get_cached_js_data(results, marketplace)
        pc_cache = get_cached_product_counts(results, marketplace)

        # Stream CSV
        def csv_rows():
            header = [
                'keyword', 'amazon_product_count', 'product_count_fetched_at',
                'monthly_search_volume_exact', 'monthly_search_volume_broad',
                'monthly_trend', 'quarterly_trend', 'ppc_bid_exact', 'ppc_bid_broad',
                'sp_brand_ad_bid', 'ease_of_ranking_score', 'relevancy_score',
                'organic_product_count', 'sponsored_product_count',
                'dominant_category', 'recommended_promotions',
            ]
            yield header
            for kw in results:
                js = js_cache.get(kw)
                pc = pc_cache.get(kw)
                row = [kw]
                row.append(pc.product_count if pc else '')
                row.append(pc.fetched_at.isoformat() if pc else '')
                if js:
                    row.extend([
                        js.monthly_search_volume_exact or '',
                        js.monthly_search_volume_broad or '',
                        js.monthly_trend or '',
                        js.quarterly_trend or '',
                        js.ppc_bid_exact or '',
                        js.ppc_bid_broad or '',
                        js.sp_brand_ad_bid or '',
                        js.ease_of_ranking_score or '',
                        js.relevancy_score or '',
                        js.organic_product_count or '',
                        js.sponsored_product_count or '',
                        js.dominant_category or '',
                        js.recommended_promotions or '',
                    ])
                else:
                    row.extend([''] * 13)
                yield row

        class Echo:
            """Pseudo-buffer for csv.writer streaming."""
            def write(self, value):
                return value

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        response = StreamingHttpResponse(
            (writer.writerow(row) for row in csv_rows()),
            content_type='text/csv',
        )
        safe_query = re.sub(r'[^a-zA-Z0-9\s-]', '', query)[:50].strip()
        response['Content-Disposition'] = f'attachment; filename="keywords_{safe_query}.csv"'
        return response


# ==============================================================
# Niche Keywords CRUD (per niche)
# ==============================================================

class NicheKeywordListCreateView(APIView):
    """
    GET  /api/niches/{id}/keywords/
    POST /api/niches/{id}/keywords/
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, niche_id):
        niche, membership = _get_niche_for_member(niche_id, request.user, request)
        if not niche:
            return Response(
                {'error': 'Niche not found or access denied.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        queryset = (
            NicheKeyword.objects
            .filter(niche=niche)
            .select_related('group')
            .order_by('group__position', 'position')
        )

        # Filters
        source = request.query_params.get('source')
        if source:
            queryset = queryset.filter(source=source)
        group_id = request.query_params.get('group_id')
        if group_id:
            queryset = queryset.filter(group_id=group_id)

        # Get JS cache for all keywords in one query
        all_kws = list(queryset.values_list('keyword', flat=True))
        js_cache_map = get_cached_js_data(all_kws, 'amazon_com') if all_kws else {}

        paginator = KeywordPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = NicheKeywordSerializer(
            page, many=True,
            context={'js_cache_map': js_cache_map},
        )
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, niche_id):
        niche, membership = _get_niche_for_member(niche_id, request.user, request)
        if not niche:
            return Response(
                {'error': 'Niche not found or access denied.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = NicheKeywordCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        keyword = serializer.validated_data['keyword']
        source = serializer.validated_data['source']
        group_id = serializer.validated_data.get('group_id')

        # Check duplicate
        if NicheKeyword.objects.filter(niche=niche, keyword=keyword).exists():
            return Response(
                {'error': f'Keyword "{keyword}" already exists for this niche.'},
                status=status.HTTP_409_CONFLICT,
            )

        # Validate group belongs to niche
        group = None
        if group_id:
            try:
                group = NicheKeywordGroup.objects.get(id=group_id, niche=niche)
            except NicheKeywordGroup.DoesNotExist:
                return Response(
                    {'error': 'Keyword group not found.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        obj = NicheKeyword.objects.create(
            niche=niche,
            keyword=keyword,
            source=source,
            group=group,
            created_by=request.user,
        )
        return Response(
            NicheKeywordSerializer(obj).data,
            status=status.HTTP_201_CREATED,
        )


class NicheKeywordBulkAddView(APIView):
    """POST /api/niches/{id}/keywords/bulk-add/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, niche_id):
        niche, membership = _get_niche_for_member(niche_id, request.user, request)
        if not niche:
            return Response(
                {'error': 'Niche not found or access denied.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = NicheKeywordBulkAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        keywords_data = serializer.validated_data['keywords']
        group_id = serializer.validated_data.get('group_id')

        group = None
        if group_id:
            try:
                group = NicheKeywordGroup.objects.get(id=group_id, niche=niche)
            except NicheKeywordGroup.DoesNotExist:
                return Response(
                    {'error': 'Keyword group not found.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Get existing keywords
        existing = set(
            NicheKeyword.objects.filter(niche=niche).values_list('keyword', flat=True)
        )

        objs = []
        for item in keywords_data:
            kw = item['keyword']
            if kw not in existing:
                existing.add(kw)
                objs.append(NicheKeyword(
                    niche=niche,
                    keyword=kw,
                    source=item['source'],
                    group=group,
                    created_by=request.user,
                ))

        created = NicheKeyword.objects.bulk_create(objs, ignore_conflicts=True)
        return Response(
            {'added': len(created), 'skipped': len(keywords_data) - len(created)},
            status=status.HTTP_201_CREATED,
        )


class NicheKeywordDetailView(APIView):
    """
    DELETE /api/niches/{id}/keywords/{keyword_id}/
    PATCH  /api/niches/{id}/keywords/{keyword_id}/
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_keyword(self, niche_id, keyword_id, user, request):
        niche, membership = _get_niche_for_member(niche_id, user, request)
        if not niche:
            return None, None
        try:
            return NicheKeyword.objects.get(id=keyword_id, niche=niche), niche
        except NicheKeyword.DoesNotExist:
            return None, niche

    def delete(self, request, niche_id, keyword_id):
        kw_obj, niche = self._get_keyword(niche_id, keyword_id, request.user, request)
        if not kw_obj:
            return Response(
                {'error': 'Keyword not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        kw_obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, niche_id, keyword_id):
        kw_obj, niche = self._get_keyword(niche_id, keyword_id, request.user, request)
        if not kw_obj:
            return Response(
                {'error': 'Keyword not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = NicheKeywordUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        update_fields = []
        data = serializer.validated_data

        if 'group' in data:
            group_id = data['group']
            if group_id is None:
                kw_obj.group = None
            else:
                try:
                    kw_obj.group = NicheKeywordGroup.objects.get(id=group_id, niche=niche)
                except NicheKeywordGroup.DoesNotExist:
                    return Response(
                        {'error': 'Keyword group not found.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            update_fields.append('group')

        if 'position' in data:
            kw_obj.position = data['position']
            update_fields.append('position')

        if 'design_template' in data:
            design_id = data['design_template']
            if design_id is None:
                kw_obj.design_template = None
            else:
                from design_app.models import Design
                try:
                    kw_obj.design_template = Design.objects.get(id=design_id)
                except Design.DoesNotExist:
                    return Response(
                        {'error': 'Design not found.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            update_fields.append('design_template')

        if update_fields:
            kw_obj.save(update_fields=update_fields)

        return Response(NicheKeywordSerializer(kw_obj).data)


class NicheKeywordBulkDeleteView(APIView):
    """POST /api/niches/{id}/keywords/bulk-delete/"""

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request, niche_id):
        niche, membership = _get_niche_for_member(niche_id, request.user, request)
        if not niche:
            return Response(
                {'error': 'Niche not found or access denied.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = NicheKeywordBulkDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        ids = serializer.validated_data['ids']
        deleted, _ = NicheKeyword.objects.filter(id__in=ids, niche=niche).delete()
        return Response({'deleted': deleted})


# ==============================================================
# Keyword Groups CRUD (per niche)
# ==============================================================

class NicheKeywordGroupListCreateView(APIView):
    """
    GET  /api/niches/{id}/keyword-groups/
    POST /api/niches/{id}/keyword-groups/
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, niche_id):
        niche, membership = _get_niche_for_member(niche_id, request.user, request)
        if not niche:
            return Response(
                {'error': 'Niche not found or access denied.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        groups = (
            NicheKeywordGroup.objects
            .filter(niche=niche)
            .annotate(keyword_count=Count('keywords'))
            .order_by('position')
        )
        serializer = NicheKeywordGroupSerializer(groups, many=True)
        return Response(serializer.data)

    def post(self, request, niche_id):
        niche, membership = _get_niche_for_member(niche_id, request.user, request)
        if not niche:
            return Response(
                {'error': 'Niche not found or access denied.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = NicheKeywordGroupCreateSerializer(
            data=request.data,
            context={'niche': niche},
        )
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data['name']

        # Check duplicate
        if NicheKeywordGroup.objects.filter(niche=niche, name=name).exists():
            return Response(
                {'error': f'Group "{name}" already exists.'},
                status=status.HTTP_409_CONFLICT,
            )

        # Auto-position at end
        max_pos = NicheKeywordGroup.objects.filter(niche=niche).count()
        group = NicheKeywordGroup.objects.create(
            niche=niche,
            name=name,
            position=max_pos,
            created_by=request.user,
        )
        return Response(
            NicheKeywordGroupSerializer(group).data,
            status=status.HTTP_201_CREATED,
        )


class NicheKeywordGroupDetailView(APIView):
    """
    PATCH  /api/niches/{id}/keyword-groups/{group_id}/
    DELETE /api/niches/{id}/keyword-groups/{group_id}/
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_group(self, niche_id, group_id, user, request):
        niche, membership = _get_niche_for_member(niche_id, user, request)
        if not niche:
            return None, None
        try:
            return NicheKeywordGroup.objects.get(id=group_id, niche=niche), niche
        except NicheKeywordGroup.DoesNotExist:
            return None, niche

    def patch(self, request, niche_id, group_id):
        group, niche = self._get_group(niche_id, group_id, request.user, request)
        if not group:
            return Response(
                {'error': 'Group not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = NicheKeywordGroupUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        update_fields = []
        data = serializer.validated_data

        if 'name' in data:
            # Check duplicate name
            if NicheKeywordGroup.objects.filter(
                niche=niche, name=data['name']
            ).exclude(id=group.id).exists():
                return Response(
                    {'error': f'Group "{data["name"]}" already exists.'},
                    status=status.HTTP_409_CONFLICT,
                )
            group.name = data['name']
            update_fields.append('name')

        if 'position' in data:
            group.position = data['position']
            update_fields.append('position')

        if update_fields:
            group.save(update_fields=update_fields)

        return Response(NicheKeywordGroupSerializer(group).data)

    def delete(self, request, niche_id, group_id):
        group, niche = self._get_group(niche_id, group_id, request.user, request)
        if not group:
            return Response(
                {'error': 'Group not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Ungroup keywords (set group=null), don't delete them
        NicheKeyword.objects.filter(group=group).update(group=None)
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ==============================================================
# Product Count Scraper (AC-9b)
# ==============================================================

class KeywordProductCountView(APIView):
    """
    POST /api/keywords/product-count/
    On-demand Amazon product count scrape via ScraperOps proxy.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'product_count_scrape'

    def post(self, request):
        serializer = KeywordProductCountRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        keyword = serializer.validated_data['keyword']
        marketplace = serializer.validated_data['marketplace']

        try:
            obj = scrape_product_count(keyword, marketplace)
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(KeywordProductCountSerializer(obj).data)


# ==============================================================
# Datamuse Synonyms (AC-38)
# ==============================================================

class KeywordSynonymsView(APIView):
    """
    GET /api/keywords/synonyms/?query=...
    Returns related words from Datamuse API with DB caching.
    """

    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('query', '').strip()
        if not query:
            return Response(
                {'error': 'query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(query) > 200:
            return Response(
                {'error': 'query must be 200 characters or fewer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        words = get_synonyms(query)
        return Response({'words': words})
