"""Permission gating for agent tool calls (AC-18 / AC-19 / AC-21 / AC-22 / AC-23).

Three-level model: Auto / Notify / Approve.

- **Auto**     → tool executes silently.
- **Notify**   → tool executes + AgentMessage(role=system) is emitted.
- **Approve**  → workflow pauses: AgentActionLog status is set to
                 `awaiting_approval` and an AgentMessage(role=approval_request)
                 is created. The agent loop is expected to abort the current
                 tool call (raise `ApprovalRequired`) until the user resolves
                 the request via the API (`resolve_approval`). Wait is
                 unbounded (AC-23).

`apply_preset()` implements AC-21: bulk-updating a user's `ToolPermission`
rows from an `AutonomyPreset.permissions` JSON map.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.utils import timezone

from agent_app.constants import DEFAULT_TOOL_PERMISSIONS
from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentMessage,
    AutonomyPreset,
    MessageRole,
    PermissionLevel,
    ToolPermission,
)

logger = logging.getLogger(__name__)


class ApprovalRequired(Exception):
    """Raised by tool wrappers when the user must approve before execution.

    The orchestrator/sub-agent loop catches this, persists state, and yields
    control back to the API layer until `resolve_approval()` is called.
    """

    def __init__(self, action_log: AgentActionLog, tool_name: str):
        self.action_log = action_log
        self.tool_name = tool_name
        super().__init__(
            f"Approval required for tool '{tool_name}' "
            f"(action_log_id={action_log.id})"
        )


def get_permission_level(workspace, user, tool_name: str) -> str:
    """Return the permission level for a tool, seeding defaults if needed (AC-19).

    First call for a (workspace, user, tool_name) triple creates a
    `ToolPermission` row from `DEFAULT_TOOL_PERMISSIONS`.
    """
    try:
        perm = ToolPermission.objects.get(
            workspace=workspace, user=user, tool_name=tool_name,
        )
        return perm.permission_level
    except ToolPermission.DoesNotExist:
        default_level = DEFAULT_TOOL_PERMISSIONS.get(tool_name, PermissionLevel.AUTO)
        ToolPermission.objects.create(
            workspace=workspace,
            user=user,
            tool_name=tool_name,
            permission_level=default_level,
        )
        return default_level


def check_tool_permission(
    session,
    tool_name: str,
    agent_type: str,
    *,
    target_object_type: str = '',
    target_object_id=None,
    cost_estimate: Optional[Decimal] = None,
    description: str = '',
) -> tuple[bool, AgentActionLog]:
    """Gate a tool call (AC-18).

    Returns:
        (can_execute, action_log)
        - can_execute=True  → caller may run the tool body.
        - can_execute=False → caller must NOT run the tool; raise
          `ApprovalRequired` (or simply return) so workflow pauses.
    """
    # Lazy import to avoid circular: cost_tracker → permission_checker (none currently).
    if cost_estimate is None:
        try:
            from agent_app.services.cost_tracker import estimate_cost
            cost_estimate = estimate_cost(tool_name)
        except Exception:
            cost_estimate = None

    level = get_permission_level(session.workspace, session.created_by, tool_name)

    action_log = AgentActionLog.objects.create(
        session=session,
        workspace=session.workspace,
        user=session.created_by,
        agent_type=agent_type,
        action=tool_name,
        target_object_type=target_object_type or '',
        target_object_id=target_object_id,
        cost_estimate=cost_estimate if (cost_estimate and cost_estimate > 0) else None,
        status=ActionStatus.STARTED,
    )

    if level == PermissionLevel.AUTO:
        return True, action_log

    if level == PermissionLevel.NOTIFY:
        AgentMessage.objects.create(
            session=session,
            role=MessageRole.SYSTEM,
            agent_type=agent_type,
            content=f"[Notify] Executing: {tool_name}"
            + (f" — {description}" if description else ''),
        )
        return True, action_log

    # APPROVE: pause and emit approval_request (AC-22, AC-23).
    action_log.status = ActionStatus.AWAITING_APPROVAL
    action_log.save(update_fields=['status'])

    summary_parts = [tool_name]
    if description:
        summary_parts.append(description)
    if target_object_type and target_object_id:
        summary_parts.append(f"target={target_object_type}#{target_object_id}")
    summary = ' — '.join(summary_parts)

    cost_str = (
        f"${cost_estimate}" if (cost_estimate and cost_estimate > 0) else 'free'
    )

    AgentMessage.objects.create(
        session=session,
        role=MessageRole.APPROVAL_REQUEST,
        agent_type=agent_type,
        content=f"Approval required: {summary} (estimated cost: {cost_str})",
        tool_calls=[{
            'tool_name': tool_name,
            'action_log_id': str(action_log.id),
            'description': description,
            'target_object_type': target_object_type,
            'target_object_id': str(target_object_id) if target_object_id else None,
            'cost_estimate': str(cost_estimate) if cost_estimate else None,
        }],
    )
    return False, action_log


def resolve_approval(action_log: AgentActionLog, approved: bool) -> bool:
    """Resolve a pending approval (AC-22).

    Returns the boolean `approved` for caller convenience.
    """
    if approved:
        action_log.status = ActionStatus.APPROVED
        action_log.completed_at = timezone.now()
        action_log.save(update_fields=['status', 'completed_at'])

        AgentMessage.objects.create(
            session=action_log.session,
            role=MessageRole.APPROVAL_RESPONSE,
            agent_type=action_log.agent_type,
            content=f"Approved: {action_log.action}",
        )
    else:
        action_log.status = ActionStatus.REJECTED
        action_log.completed_at = timezone.now()
        action_log.save(update_fields=['status', 'completed_at'])

        AgentMessage.objects.create(
            session=action_log.session,
            role=MessageRole.APPROVAL_RESPONSE,
            agent_type=action_log.agent_type,
            content=f"Rejected: {action_log.action}",
        )
    return approved


@transaction.atomic
def apply_preset(workspace, user, preset: AutonomyPreset) -> int:
    """Bulk-update a user's ToolPermission rows from a preset (AC-21).

    Args:
        workspace: Workspace instance.
        user: User instance whose permissions get rewritten.
        preset: AutonomyPreset whose `permissions` JSON map drives the update.

    Returns:
        Number of ToolPermission rows written (created + updated).

    Notes:
        Permission levels not present in the preset map are left untouched —
        callers can pre-clear them by deleting the user's permissions first if
        they want strict reset semantics.
    """
    if preset.workspace_id != workspace.pk:
        raise ValueError(
            f"Preset {preset.id} does not belong to workspace {workspace.pk}."
        )

    perms_map = preset.permissions or {}
    written = 0
    for tool_name, level in perms_map.items():
        if level not in PermissionLevel.values:
            logger.warning(
                "apply_preset: skipping invalid level %r for tool %s",
                level, tool_name,
            )
            continue
        ToolPermission.objects.update_or_create(
            workspace=workspace,
            user=user,
            tool_name=tool_name,
            defaults={'permission_level': level},
        )
        written += 1

    logger.info(
        "apply_preset: wrote %d permissions for user=%s preset=%s",
        written, user.pk, preset.name,
    )
    return written


def update_permissions(workspace, user, permissions: dict[str, str]) -> int:
    """Granular permission update (AC-20).

    Args:
        workspace, user: scope.
        permissions: {tool_name: permission_level} map.

    Returns:
        Number of rows written.
    """
    written = 0
    for tool_name, level in (permissions or {}).items():
        if level not in PermissionLevel.values:
            raise ValueError(f"Invalid permission level for {tool_name}: {level!r}")
        ToolPermission.objects.update_or_create(
            workspace=workspace,
            user=user,
            tool_name=tool_name,
            defaults={'permission_level': level},
        )
        written += 1
    return written


__all__ = [
    'ApprovalRequired',
    'apply_preset',
    'check_tool_permission',
    'get_permission_level',
    'resolve_approval',
    'update_permissions',
]
