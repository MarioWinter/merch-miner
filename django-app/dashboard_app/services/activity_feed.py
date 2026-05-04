"""
Recent activity feed from ActivityEvent model.
"""
from dashboard_app.models import ActivityEvent


def get_recent_activity(workspace_id, limit=20):
    """Return last N activity events for workspace, serialized."""
    events = (
        ActivityEvent.objects
        .filter(workspace_id=workspace_id)
        .select_related('user')
        .order_by('-created_at')[:limit]
    )
    result = []
    for event in events:
        user_display = ''
        if event.user:
            user_display = (
                f"{event.user.first_name} {event.user.last_name}".strip()
                or event.user.email
            )
        result.append({
            'event': event.event_type,
            'niche_name': event.target_name,
            'target_id': str(event.target_id) if event.target_id else None,
            'user': user_display,
            'agent_type': event.agent_type or None,
            'timestamp': event.created_at.isoformat(),
            'metadata': event.metadata,
        })
    return result
