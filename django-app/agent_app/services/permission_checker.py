"""Permission gating for agent tool calls (AC-18)."""

import logging

from django.utils import timezone

from agent_app.constants import DEFAULT_TOOL_PERMISSIONS
from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentMessage,
    MessageRole,
    PermissionLevel,
    ToolPermission,
)

logger = logging.getLogger(__name__)


def get_permission_level(workspace, user, tool_name):
    """Return the permission level for a tool, seeding defaults if needed."""
    try:
        perm = ToolPermission.objects.get(
            workspace=workspace, user=user, tool_name=tool_name,
        )
        return perm.permission_level
    except ToolPermission.DoesNotExist:
        # Seed default for this tool on first use
        default_level = DEFAULT_TOOL_PERMISSIONS.get(tool_name, PermissionLevel.AUTO)
        ToolPermission.objects.create(
            workspace=workspace,
            user=user,
            tool_name=tool_name,
            permission_level=default_level,
        )
        return default_level


def check_tool_permission(session, tool_name, agent_type, **kwargs):
    """Check permission before tool execution.

    Returns:
        tuple: (can_execute: bool, action_log: AgentActionLog)
        - can_execute=True for auto/notify
        - can_execute=False for approve (workflow pauses)
    """
    level = get_permission_level(session.workspace, session.created_by, tool_name)

    action_log = AgentActionLog.objects.create(
        session=session,
        workspace=session.workspace,
        user=session.created_by,
        agent_type=agent_type,
        action=tool_name,
        target_object_type=kwargs.get('target_object_type', ''),
        target_object_id=kwargs.get('target_object_id'),
        cost_estimate=kwargs.get('cost_estimate'),
        status=ActionStatus.STARTED,
    )

    if level == PermissionLevel.AUTO:
        return True, action_log

    if level == PermissionLevel.NOTIFY:
        # Execute but notify user
        AgentMessage.objects.create(
            session=session,
            role=MessageRole.SYSTEM,
            agent_type=agent_type,
            content=f"[Notify] Executing: {tool_name}",
        )
        return True, action_log

    # Approve: pause and wait
    action_log.status = ActionStatus.AWAITING_APPROVAL
    action_log.save(update_fields=['status'])

    AgentMessage.objects.create(
        session=session,
        role=MessageRole.APPROVAL_REQUEST,
        agent_type=agent_type,
        content=f"Approval required: {tool_name}",
        tool_calls=[{
            'tool_name': tool_name,
            'action_log_id': str(action_log.id),
            'cost_estimate': str(action_log.cost_estimate) if action_log.cost_estimate else None,
            **{k: str(v) for k, v in kwargs.items() if v is not None},
        }],
    )
    return False, action_log


def resolve_approval(action_log, approved):
    """Resolve a pending approval request (AC-22/23).

    Returns True if approved, False if rejected.
    """
    if approved:
        action_log.status = ActionStatus.APPROVED
        action_log.completed_at = timezone.now()
        action_log.save(update_fields=['status', 'completed_at'])

        AgentMessage.objects.create(
            session=action_log.session,
            role=MessageRole.APPROVAL_RESPONSE,
            content=f"Approved: {action_log.action}",
        )
    else:
        action_log.status = ActionStatus.REJECTED
        action_log.completed_at = timezone.now()
        action_log.save(update_fields=['status', 'completed_at'])

        AgentMessage.objects.create(
            session=action_log.session,
            role=MessageRole.APPROVAL_RESPONSE,
            content=f"Rejected: {action_log.action}",
        )
    return approved
