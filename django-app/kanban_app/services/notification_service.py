"""Service for creating notifications on kanban events (AC-4)."""

import logging

from kanban_app.models import Notification

logger = logging.getLogger(__name__)


def notify_assignment(workspace, niche, assigned_user, assigned_by):
    """Create notification when niche is assigned to a user."""
    if not assigned_user or assigned_user == assigned_by:
        return None
    return Notification.objects.create(
        workspace=workspace,
        recipient=assigned_user,
        type=Notification.Type.ASSIGNMENT,
        title=f'Assigned to niche: {niche.name}',
        message=f'{assigned_by.email} assigned you to "{niche.name}".',
        link=f'/kanban?card={niche.id}',
        source_user=assigned_by,
    )


def notify_design_approval(workspace, design, approved_by):
    """Notify design creator when their design is approved."""
    if not design.created_by or design.created_by == approved_by:
        return None
    return Notification.objects.create(
        workspace=workspace,
        recipient=design.created_by,
        type=Notification.Type.APPROVAL,
        title=f'Design approved: {design.file_name}',
        message=f'{approved_by.email} approved your design "{design.file_name}".',
        link=f'/kanban?card={design.niche_id}',
        source_user=approved_by,
    )


def notify_design_rejection(workspace, design, rejected_by, reason=''):
    """Notify design creator when their design is rejected."""
    if not design.created_by or design.created_by == rejected_by:
        return None
    msg = f'{rejected_by.email} rejected your design "{design.file_name}".'
    if reason:
        msg += f' Reason: {reason}'
    return Notification.objects.create(
        workspace=workspace,
        recipient=design.created_by,
        type=Notification.Type.REJECTION,
        title=f'Design rejected: {design.file_name}',
        message=msg,
        link=f'/kanban?card={design.niche_id}',
        source_user=rejected_by,
    )


def notify_mentions(workspace, comment, mentioned_user_ids):
    """Create a notification for each mentioned user in a comment."""
    from django.contrib.auth import get_user_model
    User = get_user_model()

    notifications = []
    for user_id in mentioned_user_ids:
        if comment.author and user_id == comment.author.id:
            continue
        try:
            recipient = User.objects.get(id=user_id)
        except User.DoesNotExist:
            logger.warning('Mentioned user %s not found', user_id)
            continue

        niche_name = comment.niche.name if comment.niche else 'unknown'
        author_name = comment.author.email if comment.author else f'Agent({comment.agent_type})'
        notifications.append(Notification(
            workspace=workspace,
            recipient=recipient,
            type=Notification.Type.MENTION,
            title=f'Mentioned in {niche_name}',
            message=f'{author_name} mentioned you: "{comment.content[:100]}"',
            link=f'/kanban?card={comment.niche_id}',
            source_user=comment.author,
            source_agent_type=comment.agent_type,
        ))

    if notifications:
        Notification.objects.bulk_create(notifications)
    return notifications


def notify_status_change(workspace, niche, old_status, changed_by):
    """Notify assigned user when niche status changes."""
    if not niche.assigned_to or niche.assigned_to == changed_by:
        return None
    return Notification.objects.create(
        workspace=workspace,
        recipient=niche.assigned_to,
        type=Notification.Type.STATUS_CHANGE,
        title=f'Status changed: {niche.name}',
        message=f'{changed_by.email} moved "{niche.name}" from {old_status} to {niche.status}.',
        link=f'/kanban?card={niche.id}',
        source_user=changed_by,
    )


def notify_agent_action(workspace, niche, agent_type, action_description, recipient=None):
    """Create notification for agent actions on the board (AC-20)."""
    if not recipient and niche.assigned_to:
        recipient = niche.assigned_to
    if not recipient:
        return None
    return Notification.objects.create(
        workspace=workspace,
        recipient=recipient,
        type=Notification.Type.AGENT_ACTION,
        title=f'Agent action on {niche.name}',
        message=action_description,
        link=f'/kanban?card={niche.id}',
        source_agent_type=agent_type,
    )


def create_agent_comment(niche, agent_type, content, design=None):
    """Create a comment from an agent (AC-20). Internal service, not via API."""
    from kanban_app.models import NicheComment
    return NicheComment.objects.create(
        niche=niche,
        design=design,
        author=None,
        agent_type=agent_type,
        content=content,
    )
