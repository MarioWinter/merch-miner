"""
Dashboard & Analytics API views.
Main dashboard cached 60s in Redis. Analytics endpoints admin-only, date-filterable.
CSV exports via StreamingHttpResponse.
"""
import csv
import io
import logging

from django.core.cache import cache
from django.http import StreamingHttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from user_auth_app.api.authentication import CookieJWTAuthentication
from workspace_app.models import Membership

from dashboard_app.api.serializers import (
    DashboardSerializer,
    DateRangeSerializer,
)
from dashboard_app.services.kpi_aggregator import (
    get_niche_counts,
    get_design_counts,
    get_listing_counts,
    get_stuck_niches,
)
from dashboard_app.services.activity_feed import get_recent_activity
from dashboard_app.services.analytics_aggregator import (
    get_design_analytics,
    get_listing_analytics,
    get_agent_analytics,
    get_search_analytics,
)
from dashboard_app.services.roadmap_loader import (
    load_roadmap,
    roadmap_last_modified,
)
from dashboard_app.services.changelog_translator import (
    get_translated_changelog,
)

logger = logging.getLogger(__name__)

DASHBOARD_CACHE_TTL = 60  # seconds


def _get_active_membership(user):
    """Return the first active Membership for the user, or None."""
    return (
        Membership.objects
        .filter(user=user, status=Membership.Status.ACTIVE)
        .select_related('workspace')
        .first()
    )


def _require_admin(membership):
    """Return True if membership has admin role."""
    return membership and membership.role == Membership.Role.ADMIN


def _csv_response(filename, header, rows):
    """Return a StreamingHttpResponse with CSV data."""
    def generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(header)
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for row in rows:
            writer.writerow(row)
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    response = StreamingHttpResponse(generate(), content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


class DashboardView(APIView):
    """
    GET /api/dashboard/ — main dashboard KPIs + activity + agent + search.
    Cached 60s in Redis. Member access.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_active_membership(request.user)
        if not membership:
            return Response(
                {'error': 'No active workspace membership.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        workspace_id = membership.workspace_id
        cache_key = f'dashboard:{workspace_id}'

        data = cache.get(cache_key)
        if data is None:
            try:
                data = {
                    'niche_counts': get_niche_counts(workspace_id),
                    'design_counts': get_design_counts(workspace_id),
                    'listing_counts': get_listing_counts(workspace_id),
                    'recent_activity': get_recent_activity(workspace_id),
                    'stuck_niches': get_stuck_niches(workspace_id),
                    'agent_activity': get_agent_analytics(workspace_id),
                    'search_activity': get_search_analytics(workspace_id),
                }
                cache.set(cache_key, data, DASHBOARD_CACHE_TTL)
            except Exception:
                logger.exception('Dashboard aggregation failed')
                return Response(
                    {'error': 'Failed to compute dashboard data.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        serializer = DashboardSerializer(data)
        return Response(serializer.data)


class DesignAnalyticsView(APIView):
    """GET /api/dashboard/analytics/designs/ — admin only, date-filterable."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_active_membership(request.user)
        if not _require_admin(membership):
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        params = DateRangeSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        result = get_design_analytics(
            membership.workspace_id,
            date_from=params.validated_data['date_from'],
            date_to=params.validated_data['date_to'],
        )
        return Response(result)


class ListingAnalyticsView(APIView):
    """GET /api/dashboard/analytics/listings/ — admin only, date-filterable."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_active_membership(request.user)
        if not _require_admin(membership):
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        params = DateRangeSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        result = get_listing_analytics(
            membership.workspace_id,
            date_from=params.validated_data['date_from'],
            date_to=params.validated_data['date_to'],
        )
        return Response(result)


class AgentAnalyticsView(APIView):
    """GET /api/dashboard/analytics/agent/ — admin only, date-filterable."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_active_membership(request.user)
        if not _require_admin(membership):
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        params = DateRangeSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        result = get_agent_analytics(
            membership.workspace_id,
            date_from=params.validated_data['date_from'],
            date_to=params.validated_data['date_to'],
        )
        return Response(result)


class SearchAnalyticsView(APIView):
    """GET /api/dashboard/analytics/search/ — admin only, date-filterable."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_active_membership(request.user)
        if not _require_admin(membership):
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        params = DateRangeSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        result = get_search_analytics(
            membership.workspace_id,
            date_from=params.validated_data['date_from'],
            date_to=params.validated_data['date_to'],
        )
        return Response(result)


# ─── CSV Export Views ─────────────────────────────────────────────────────────

class DesignAnalyticsExportView(APIView):
    """GET /api/dashboard/analytics/designs/export/ — CSV export, admin only."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_active_membership(request.user)
        if not _require_admin(membership):
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        params = DateRangeSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        result = get_design_analytics(
            membership.workspace_id,
            date_from=params.validated_data['date_from'],
            date_to=params.validated_data['date_to'],
        )
        rows = [(r['week'], r['model'], r['count']) for r in result['data']]
        return _csv_response('design_analytics.csv', ['week', 'model', 'count'], rows)


class ListingAnalyticsExportView(APIView):
    """GET /api/dashboard/analytics/listings/export/ — CSV export, admin only."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_active_membership(request.user)
        if not _require_admin(membership):
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        params = DateRangeSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        result = get_listing_analytics(
            membership.workspace_id,
            date_from=params.validated_data['date_from'],
            date_to=params.validated_data['date_to'],
        )
        rows = [
            (r['week'], r['listings_ready'], r['listings_published'])
            for r in result['data']
        ]
        return _csv_response(
            'listing_analytics.csv',
            ['week', 'listings_ready', 'listings_published'],
            rows,
        )


class AgentAnalyticsExportView(APIView):
    """GET /api/dashboard/analytics/agent/export/ — CSV export, admin only."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_active_membership(request.user)
        if not _require_admin(membership):
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        params = DateRangeSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        result = get_agent_analytics(
            membership.workspace_id,
            date_from=params.validated_data['date_from'],
            date_to=params.validated_data['date_to'],
        )

        if not result.get('configured', True):
            # Agent not configured — return headers-only CSV
            return _csv_response(
                'agent_analytics.csv',
                ['week', 'agent_type', 'runs', 'cost', 'success_rate', 'avg_duration'],
                [],
            )

        rows = result.get('data', [])
        csv_rows = [
            (r.get('week', ''), r.get('agent_type', ''), r.get('runs', 0),
             r.get('cost', 0), r.get('success_rate', 0), r.get('avg_duration', 0))
            for r in rows
        ]
        return _csv_response(
            'agent_analytics.csv',
            ['week', 'agent_type', 'runs', 'cost', 'success_rate', 'avg_duration'],
            csv_rows,
        )


class SearchAnalyticsExportView(APIView):
    """GET /api/dashboard/analytics/search/export/ — CSV export, admin only."""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        membership = _get_active_membership(request.user)
        if not _require_admin(membership):
            return Response(
                {'error': 'Admin access required.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        params = DateRangeSerializer(data=request.query_params)
        params.is_valid(raise_exception=True)

        result = get_search_analytics(
            membership.workspace_id,
            date_from=params.validated_data['date_from'],
            date_to=params.validated_data['date_to'],
        )

        if not result.get('configured', True):
            return _csv_response(
                'search_analytics.csv',
                ['week', 'searches', 'crawls', 'crawl_success_rate', 'top_query'],
                [],
            )

        rows = result.get('data', [])
        csv_rows = [
            (r.get('week', ''), r.get('searches', 0), r.get('crawls', 0),
             r.get('crawl_success_rate', 0), r.get('top_query', ''))
            for r in rows
        ]
        return _csv_response(
            'search_analytics.csv',
            ['week', 'searches', 'crawls', 'crawl_success_rate', 'top_query'],
            csv_rows,
        )


class RoadmapView(APIView):
    """
    GET /api/dashboard/roadmap/?lang=de|en — user-facing roadmap items.

    Source: hand-curated ``docs/roadmap_user_facing.md`` (YAML front-matter).
    Visible to ALL authenticated users; no workspace gating.

    ``lang`` (default ``de``) selects which language fields to emit. ``en``
    prefers ``title_en`` / ``description_en`` per entry with a per-item
    German fallback.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lang = request.query_params.get('lang', 'de').lower()
        if lang not in ('de', 'en'):
            lang = 'de'
        try:
            items = load_roadmap(lang=lang)
            last_modified = roadmap_last_modified()
        except Exception:
            logger.exception('Roadmap load failed')
            return Response(
                {'error': 'Failed to load roadmap.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({
            'items': items,
            'last_updated': last_modified.isoformat() if last_modified else None,
        })


class ChangelogView(APIView):
    """
    GET /api/dashboard/changelog/?lang=de|en — top-3 versions, LLM-rewritten.

    Source: ``CHANGELOG.md`` (release-please generated). Each commit-bullet is
    rewritten into ≤2-sentence user-benefit copy in the requested language
    via OpenRouter, then Redis-cached for 6h keyed by ``(latest tag, lang)``
    so DE + EN renditions don't evict each other.

    Visible to ALL authenticated users; no workspace gating (per AC-4-6).
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lang = request.query_params.get('lang', 'de').lower()
        if lang not in ('de', 'en'):
            lang = 'de'
        try:
            versions = get_translated_changelog(lang=lang)
        except Exception:
            logger.exception('Changelog translation failed')
            return Response(
                {'error': 'Failed to load changelog.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({'versions': versions})
