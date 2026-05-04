"""Agent app signals.

Two responsibilities:

1. KnowledgeDoc embedding in Vector DB (AC-7) — post_save + post_delete.
2. PROJ-18 AC-64 — emit ActivityEvent rows for the dashboard activity feed
   on key AgentSession status transitions and on AgentActionLog approval-
   pending writes. Idempotent: pre_save captures the prior status so we
   only emit on actual transitions, not on no-op saves.
"""

import logging

import django_rq
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models.signals import post_delete, post_save, pre_save
from django.dispatch import receiver

from agent_app.models import (
    ActionStatus,
    AgentActionLog,
    AgentSession,
    KnowledgeDoc,
    SessionStatus,
    Skill,
)
from vector_app.tasks import create_or_update_embedding, delete_embedding

logger = logging.getLogger(__name__)


# ── KnowledgeDoc embedding (AC-7) ──

@receiver(post_save, sender=KnowledgeDoc, dispatch_uid='knowledge_doc_embed_save')
def enqueue_knowledge_embedding(sender, instance, **kwargs):
    """Embed KnowledgeDoc in Vector DB on create/update.

    Wrapped in ``transaction.on_commit`` so the worker doesn't pick up the
    job before the DB row is committed (race-window otherwise).
    """
    ct_id = ContentType.objects.get_for_model(sender).id
    pk = str(instance.pk)

    def _enqueue():
        django_rq.get_queue('default').enqueue(
            create_or_update_embedding,
            content_type_id=ct_id,
            object_id=pk,
        )
        logger.debug("Enqueued embedding for KnowledgeDoc %s", pk)

    transaction.on_commit(_enqueue)


@receiver(post_delete, sender=KnowledgeDoc, dispatch_uid='knowledge_doc_embed_delete')
def enqueue_knowledge_embedding_delete(sender, instance, **kwargs):
    """Remove KnowledgeDoc embedding from Vector DB on delete (EC-9).

    ``transaction.on_commit`` defers the enqueue until the deletion is
    committed — guards against the worker reading a still-existing row.
    """
    ct_id = ContentType.objects.get_for_model(sender).id
    pk = str(instance.pk)

    def _enqueue():
        django_rq.get_queue('default').enqueue(
            delete_embedding,
            content_type_id=ct_id,
            object_id=pk,
        )
        logger.debug("Enqueued embedding deletion for KnowledgeDoc %s", pk)

    transaction.on_commit(_enqueue)


# ── PROJ-18 AC-64 — Dashboard activity feed emission ──

# Statuses that "open" a workflow — transitioning into RUNNING from any of
# {idle, paused, cancelled, failed, completed} fires a started event.
_RUNNING_TRIGGERS = {SessionStatus.RUNNING}
# Terminal states that close a workflow.
_COMPLETED_TRIGGERS = {SessionStatus.COMPLETED}
_FAILED_TRIGGERS = {SessionStatus.FAILED}


@receiver(pre_save, sender=AgentSession, dispatch_uid='agent_session_capture_status')
def _capture_prior_status(sender, instance, **kwargs):
    """Stash the prior status on the instance so post_save can detect a transition.

    Idempotent guard: if no row exists yet (creation) we set the sentinel
    to None so post_save can treat the new row's status as a transition
    from "nothing".
    """
    if not instance.pk:
        instance._prior_status = None
        return
    try:
        prior = sender.objects.only('status').get(pk=instance.pk)
        instance._prior_status = prior.status
    except sender.DoesNotExist:
        instance._prior_status = None


def _resolve_target_name(session):
    niche = getattr(session, 'niche_context', None)
    if niche is not None and getattr(niche, 'name', None):
        return niche.name
    return session.title or 'workspace'


def _resolve_agent_type(session):
    """Pick a representative agent_type for the activity row.

    For workspace-level sessions there's no single agent_type, so we use
    'orchestrator' as the default. Future: store last-active agent on
    session.
    """
    return 'orchestrator'


def _safe_emit_activity(*, workspace, event_type, target_name, target_id=None,
                        user=None, agent_type='', metadata=None):
    """Create a dashboard ActivityEvent row, never breaking the save chain.

    Imported lazily so the agent_app does not require dashboard_app to be
    loaded at import time.
    """
    try:
        from dashboard_app.models import ActivityEvent
        ActivityEvent.objects.create(
            workspace=workspace,
            event_type=event_type,
            target_name=str(target_name)[:200],
            target_id=target_id,
            user=user,
            agent_type=agent_type,
            metadata=metadata or {},
        )
    except Exception:
        logger.exception('Failed to create agent ActivityEvent: %s', event_type)


@receiver(post_save, sender=AgentSession, dispatch_uid='agent_session_activity_emit')
def emit_session_activity(sender, instance, created, **kwargs):
    """AC-64 — emit dashboard activity events on session status transitions."""
    from dashboard_app.models import ActivityEvent

    prior = getattr(instance, '_prior_status', None)
    current = instance.status

    # No-op save (status unchanged on existing row): nothing to emit.
    if not created and prior == current:
        return

    target_name = _resolve_target_name(instance)
    agent_type = _resolve_agent_type(instance)
    user = instance.created_by

    if current in _RUNNING_TRIGGERS and prior != current:
        workflow_label = instance.workflow_template or 'Autonomous'
        _safe_emit_activity(
            workspace=instance.workspace,
            event_type=ActivityEvent.EventType.AGENT_SESSION_STARTED,
            target_name=target_name,
            target_id=instance.pk,
            user=user,
            agent_type=agent_type,
            metadata={
                'session_id': str(instance.pk),
                'workflow_template': workflow_label,
                'message': f'Agent started {workflow_label} for {target_name}',
            },
        )
        return

    if current in _COMPLETED_TRIGGERS and prior != current:
        workflow_label = instance.workflow_template or 'Autonomous'
        _safe_emit_activity(
            workspace=instance.workspace,
            event_type=ActivityEvent.EventType.AGENT_SESSION_COMPLETED,
            target_name=target_name,
            target_id=instance.pk,
            user=user,
            agent_type=agent_type,
            metadata={
                'session_id': str(instance.pk),
                'workflow_template': workflow_label,
                'completed_steps': instance.completed_steps,
                'total_steps': instance.total_steps,
                'message': f'Agent completed {workflow_label} for {target_name}',
            },
        )
        return

    if current in _FAILED_TRIGGERS and prior != current:
        _safe_emit_activity(
            workspace=instance.workspace,
            event_type=ActivityEvent.EventType.AGENT_SESSION_FAILED,
            target_name=target_name,
            target_id=instance.pk,
            user=user,
            agent_type=agent_type,
            metadata={
                'session_id': str(instance.pk),
                'error': (instance.error_message or '')[:500],
                'message': (
                    f'Agent failed: {instance.error_message[:200]}'
                    if instance.error_message
                    else 'Agent failed'
                ),
            },
        )


@receiver(pre_save, sender=AgentActionLog, dispatch_uid='agent_action_capture_status')
def _capture_prior_action_status(sender, instance, **kwargs):
    """Stash prior action-log status for idempotent approval-pending emission."""
    if not instance.pk:
        instance._prior_status = None
        return
    try:
        prior = sender.objects.only('status').get(pk=instance.pk)
        instance._prior_status = prior.status
    except sender.DoesNotExist:
        instance._prior_status = None


@receiver(post_save, sender=AgentActionLog, dispatch_uid='agent_action_activity_emit')
def emit_action_log_activity(sender, instance, created, **kwargs):
    """AC-64 — emit dashboard event when an action enters AWAITING_APPROVAL."""
    from dashboard_app.models import ActivityEvent

    if instance.status != ActionStatus.AWAITING_APPROVAL:
        return

    prior = getattr(instance, '_prior_status', None)
    # Only emit on the actual transition into AWAITING_APPROVAL — not on
    # repeated saves while the row is already pending.
    if not created and prior == ActionStatus.AWAITING_APPROVAL:
        return

    session = instance.session
    target_name = _resolve_target_name(session) if session is not None else ''
    action_label = instance.action or 'action'

    _safe_emit_activity(
        workspace=instance.workspace,
        event_type=ActivityEvent.EventType.AGENT_AWAITING_APPROVAL,
        target_name=target_name,
        target_id=instance.pk,
        user=instance.user,
        agent_type=instance.agent_type or 'orchestrator',
        metadata={
            'session_id': str(session.pk) if session is not None else None,
            'action_log_id': str(instance.pk),
            'action': action_label,
            'message': f'Agent awaiting approval: {action_label}',
        },
    )


# ── Phase 14 — Skill embedding lifecycle (AC-65 / AC-68 / EC-22) ────────────


@receiver(post_save, sender=Skill, dispatch_uid='skill_embed_save')
def enqueue_skill_embedding(sender, instance, **kwargs):
    """Embed Skill (name + description + content_md) on create/update.

    EC-22: when ``deleted_at`` is set we instead drop the embedding so
    the soft-deleted skill no longer surfaces in ``find_relevant_skills``.
    The Skill row itself is preserved (soft delete) so SkillVersion
    history remains accessible from the admin.
    """
    ct_id = ContentType.objects.get_for_model(sender).id
    pk = str(instance.pk)
    is_soft_deleted = instance.deleted_at is not None

    def _enqueue():
        if is_soft_deleted:
            django_rq.get_queue('default').enqueue(
                delete_embedding,
                content_type_id=ct_id,
                object_id=pk,
            )
            logger.debug('Enqueued embedding deletion for soft-deleted Skill %s', pk)
        else:
            django_rq.get_queue('default').enqueue(
                create_or_update_embedding,
                content_type_id=ct_id,
                object_id=pk,
            )
            logger.debug('Enqueued embedding for Skill %s', pk)

    transaction.on_commit(_enqueue)


@receiver(post_delete, sender=Skill, dispatch_uid='skill_embed_delete')
def enqueue_skill_embedding_delete(sender, instance, **kwargs):
    """Hard-delete cleanup. (Soft delete is handled in post_save above.)"""
    ct_id = ContentType.objects.get_for_model(sender).id
    pk = str(instance.pk)

    def _enqueue():
        django_rq.get_queue('default').enqueue(
            delete_embedding,
            content_type_id=ct_id,
            object_id=pk,
        )
        logger.debug('Enqueued embedding deletion for Skill %s', pk)

    transaction.on_commit(_enqueue)


# ── Phase 14 — Reflection trigger (AC-69) ───────────────────────────────────


@receiver(post_save, sender=AgentSession, dispatch_uid='agent_session_reflection_trigger')
def enqueue_reflection_on_completion(sender, instance, created, **kwargs):
    """When a session transitions to COMPLETED, maybe enqueue reflection.

    The transition guard (capture prior status in ``pre_save``) is shared
    with ``emit_session_activity`` above. Reflection cadence is enforced
    inside ``maybe_enqueue_reflection`` so this signal can fire freely.
    """
    prior = getattr(instance, '_prior_status', None)
    if instance.status != SessionStatus.COMPLETED:
        return
    if not created and prior == SessionStatus.COMPLETED:
        return

    def _enqueue():
        try:
            from agent_app.services.reflection_service import maybe_enqueue_reflection
            maybe_enqueue_reflection(instance)
        except Exception:
            logger.exception('Failed to enqueue reflection for session %s', instance.pk)

    transaction.on_commit(_enqueue)
