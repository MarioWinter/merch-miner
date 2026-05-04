"""
DB-level aggregations for dashboard KPI counts.
All queries workspace-scoped, use COUNT/GROUP BY (no Python iteration).
"""
from django.db.models import Count
from django.utils import timezone
from datetime import timedelta

from niche_app.models import Niche
from design_app.models import Design
from publish_app.models import Listing

# Map niche statuses to dashboard status groups
STATUS_GROUPS = {
    'research': ['data_entry', 'deep_research'],
    'design': ['niche_with_potential', 'to_designer'],
    'publish': ['upload'],
    'live': ['start_ads', 'pending', 'winner'],
    'done': ['loser'],
    'archived': ['archived'],
}


def get_niche_counts(workspace_id):
    """Return niche counts grouped by dashboard status group."""
    qs = Niche.objects.filter(workspace_id=workspace_id)
    result = {group: 0 for group in STATUS_GROUPS}

    counts = qs.values('status').annotate(count=Count('id'))
    status_to_group = {}
    for group, statuses in STATUS_GROUPS.items():
        for s in statuses:
            status_to_group[s] = group

    for row in counts:
        group = status_to_group.get(row['status'])
        if group:
            result[group] += row['count']

    return result


def get_design_counts(workspace_id):
    """Return total and approved design counts."""
    qs = Design.objects.filter(workspace_id=workspace_id)
    total = qs.count()
    approved = qs.filter(status=Design.Status.APPROVED).count()
    return {'total': total, 'approved': approved}


def get_listing_counts(workspace_id):
    """Return total and ready listing counts."""
    qs = Listing.objects.filter(workspace_id=workspace_id)
    total = qs.count()
    ready = qs.filter(
        status__in=[Listing.Status.READY, Listing.Status.PUBLISHED]
    ).count()
    return {'total': total, 'ready': ready}


def get_stuck_niches(workspace_id, days=7, limit=20):
    """
    Return niches unchanged for >days, excluding terminal statuses.
    """
    threshold = timezone.now() - timedelta(days=days)
    terminal = ['archived', 'winner', 'loser']
    qs = (
        Niche.objects
        .filter(workspace_id=workspace_id, updated_at__lt=threshold)
        .exclude(status__in=terminal)
        .order_by('updated_at')[:limit]
    )
    result = []
    now = timezone.now()
    for niche in qs:
        days_stuck = (now - niche.updated_at).days
        result.append({
            'id': str(niche.pk),
            'name': niche.name,
            'status': niche.status,
            'days_stuck': days_stuck,
        })
    return result
