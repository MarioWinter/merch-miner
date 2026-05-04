"""
Post-save signals that create ActivityEvent records for the dashboard feed.
Also busts the dashboard Redis cache on relevant model writes.
"""
import logging

from django.core.cache import cache
from django.db.models.signals import post_save
from django.dispatch import receiver

from dashboard_app.models import ActivityEvent

logger = logging.getLogger(__name__)


def _bust_dashboard_cache(workspace_id):
    """Delete cached dashboard data for a workspace."""
    cache.delete(f'dashboard:{workspace_id}')


def _safe_create_event(*, workspace, event_type, target_name, target_id=None,
                        user=None, agent_type='', metadata=None):
    """Create ActivityEvent with error handling — never break the save chain."""
    try:
        ActivityEvent.objects.create(
            workspace=workspace,
            event_type=event_type,
            target_name=str(target_name)[:200],
            target_id=target_id,
            user=user,
            agent_type=agent_type,
            metadata=metadata or {},
        )
        _bust_dashboard_cache(workspace.pk)
    except Exception:
        logger.exception('Failed to create ActivityEvent: %s', event_type)


# ─── Niche signals ───────────────────────────────────────────────────────────

@receiver(post_save, sender='niche_app.Niche')
def on_niche_save(sender, instance, created, **kwargs):
    if created:
        _safe_create_event(
            workspace=instance.workspace,
            event_type=ActivityEvent.EventType.NICHE_CREATED,
            target_name=instance.name,
            target_id=instance.pk,
            user=instance.created_by,
        )
    else:
        # Check status changes via update_fields or just bust cache
        if instance.status == 'archived':
            _safe_create_event(
                workspace=instance.workspace,
                event_type=ActivityEvent.EventType.NICHE_ARCHIVED,
                target_name=instance.name,
                target_id=instance.pk,
            )
        else:
            _bust_dashboard_cache(instance.workspace_id)


# ─── Research signals ─────────────────────────────────────────────────────────

@receiver(post_save, sender='niche_research_app.NicheResearch')
def on_research_save(sender, instance, created, **kwargs):
    if created:
        return
    niche = instance.niche
    if instance.status == 'completed':
        _safe_create_event(
            workspace=niche.workspace,
            event_type=ActivityEvent.EventType.RESEARCH_COMPLETED,
            target_name=niche.name,
            target_id=instance.pk,
            user=instance.triggered_by,
        )
    elif instance.status == 'failed':
        _safe_create_event(
            workspace=niche.workspace,
            event_type=ActivityEvent.EventType.RESEARCH_FAILED,
            target_name=niche.name,
            target_id=instance.pk,
            user=instance.triggered_by,
            metadata={'error': instance.error_message[:500] if instance.error_message else ''},
        )


# ─── Idea signals ─────────────────────────────────────────────────────────────

@receiver(post_save, sender='idea_app.Idea')
def on_idea_save(sender, instance, created, **kwargs):
    if created:
        _safe_create_event(
            workspace=instance.workspace,
            event_type=ActivityEvent.EventType.IDEA_CREATED,
            target_name=instance.slogan_text[:200] if instance.slogan_text else '',
            target_id=instance.pk,
            user=instance.created_by,
        )
    else:
        if instance.status == 'approved':
            _safe_create_event(
                workspace=instance.workspace,
                event_type=ActivityEvent.EventType.IDEA_APPROVED,
                target_name=instance.slogan_text[:200] if instance.slogan_text else '',
                target_id=instance.pk,
            )
        elif instance.status == 'rejected':
            _safe_create_event(
                workspace=instance.workspace,
                event_type=ActivityEvent.EventType.IDEA_REJECTED,
                target_name=instance.slogan_text[:200] if instance.slogan_text else '',
                target_id=instance.pk,
            )


# ─── Design signals ──────────────────────────────────────────────────────────

@receiver(post_save, sender='design_app.Design')
def on_design_save(sender, instance, created, **kwargs):
    if created:
        _safe_create_event(
            workspace=instance.workspace,
            event_type=ActivityEvent.EventType.DESIGN_GENERATED,
            target_name=str(instance),
            target_id=instance.pk,
        )
    elif instance.status == 'approved':
        _safe_create_event(
            workspace=instance.workspace,
            event_type=ActivityEvent.EventType.DESIGN_APPROVED,
            target_name=str(instance),
            target_id=instance.pk,
        )


# ─── Listing signals ─────────────────────────────────────────────────────────

@receiver(post_save, sender='publish_app.Listing')
def on_listing_save(sender, instance, created, **kwargs):
    if not created:
        if instance.status == 'ready':
            _safe_create_event(
                workspace=instance.workspace,
                event_type=ActivityEvent.EventType.LISTING_READY,
                target_name=instance.title or str(instance),
                target_id=instance.pk,
            )
        elif instance.status == 'published':
            _safe_create_event(
                workspace=instance.workspace,
                event_type=ActivityEvent.EventType.LISTING_PUBLISHED,
                target_name=instance.title or str(instance),
                target_id=instance.pk,
            )
    else:
        _bust_dashboard_cache(instance.workspace_id)


# ─── Upload signals ──────────────────────────────────────────────────────────

@receiver(post_save, sender='publish_app.UploadJob')
def on_upload_save(sender, instance, created, **kwargs):
    if created:
        return
    if instance.status == 'completed':
        _safe_create_event(
            workspace=instance.workspace,
            event_type=ActivityEvent.EventType.UPLOAD_COMPLETED,
            target_name=f"Upload to {instance.marketplace}",
            target_id=instance.pk,
            user=instance.created_by,
        )
    elif instance.status == 'failed':
        _safe_create_event(
            workspace=instance.workspace,
            event_type=ActivityEvent.EventType.UPLOAD_FAILED,
            target_name=f"Upload to {instance.marketplace}",
            target_id=instance.pk,
            user=instance.created_by,
            metadata={'error': instance.error_message[:500] if instance.error_message else ''},
        )
