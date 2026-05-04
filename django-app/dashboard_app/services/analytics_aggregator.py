"""
Weekly analytics aggregations using TruncWeek.
All queries workspace-scoped, DB-level GROUP BY.
Date range filterable, max 52 weeks.
"""
from datetime import timedelta

from django.db.models import Count, Q
from django.db.models.functions import TruncWeek
from django.utils import timezone

from design_app.models import DesignGenerationRun
from publish_app.models import Listing


MAX_WEEKS = 52


def _clamp_date_range(date_from, date_to):
    """Validate and clamp date range to max 52 weeks. Returns (date_from, date_to, warning)."""
    warning = None
    if not date_to:
        date_to = timezone.now().date()
    if not date_from:
        date_from = date_to - timedelta(weeks=12)

    delta = (date_to - date_from).days
    if delta > MAX_WEEKS * 7:
        warning = f'Date range clamped to {MAX_WEEKS} weeks maximum.'
        date_from = date_to - timedelta(weeks=MAX_WEEKS)

    return date_from, date_to, warning


def get_design_analytics(workspace_id, date_from=None, date_to=None):
    """Design generation counts grouped by (model_name, week)."""
    date_from, date_to, warning = _clamp_date_range(date_from, date_to)

    qs = (
        DesignGenerationRun.objects
        .filter(
            idea__workspace_id=workspace_id,
            status=DesignGenerationRun.Status.COMPLETED,
            created_at__date__gte=date_from,
            created_at__date__lte=date_to,
        )
        .annotate(week=TruncWeek('created_at'))
        .values('week', 'model_name')
        .annotate(count=Count('id'))
        .order_by('week', 'model_name')
    )

    data = [
        {
            'week': row['week'].date().isoformat(),
            'model': row['model_name'],
            'count': row['count'],
        }
        for row in qs
    ]
    return {'data': data, 'warning': warning}


def get_listing_analytics(workspace_id, date_from=None, date_to=None):
    """Listing production counts grouped by week."""
    date_from, date_to, warning = _clamp_date_range(date_from, date_to)

    qs = (
        Listing.objects
        .filter(
            workspace_id=workspace_id,
            created_at__date__gte=date_from,
            created_at__date__lte=date_to,
        )
        .annotate(week=TruncWeek('created_at'))
        .values('week')
        .annotate(
            listings_ready=Count('id', filter=Q(status__in=['ready', 'published'])),
            listings_published=Count('id', filter=Q(status='published')),
        )
        .order_by('week')
    )

    data = [
        {
            'week': row['week'].date().isoformat(),
            'listings_ready': row['listings_ready'],
            'listings_published': row['listings_published'],
        }
        for row in qs
    ]
    return {'data': data, 'warning': warning}


def get_agent_analytics(workspace_id, date_from=None, date_to=None):
    """
    Agent usage analytics. Returns placeholder if PROJ-18 AgentActionLog
    not available yet.
    """
    try:
        # PROJ-18 not implemented yet — return placeholder
        from importlib import import_module
        import_module('agent_app.models')
    except (ImportError, ModuleNotFoundError):
        return {
            'configured': False,
            'message': 'Agent not set up',
        }

    # Future: aggregate from AgentActionLog
    return {'configured': False, 'message': 'Agent not set up'}


def get_search_analytics(workspace_id, date_from=None, date_to=None):
    """
    Search usage analytics. Returns placeholder if PROJ-17 SearchUsageLog
    not available yet.
    """
    try:
        from importlib import import_module
        import_module('search_app.models')
    except (ImportError, ModuleNotFoundError):
        return {
            'configured': False,
            'message': 'Search not connected',
        }

    # Future: aggregate from SearchUsageLog
    return {'configured': False, 'message': 'Search not connected'}
