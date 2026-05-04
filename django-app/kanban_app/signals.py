"""Signals for kanban_app: auto-create notifications on key events."""

import logging

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from niche_app.models import Niche

logger = logging.getLogger(__name__)


@receiver(pre_save, sender=Niche)
def capture_niche_old_status(sender, instance, **kwargs):
    """Capture old status before save for status-change notification."""
    if instance.pk:
        try:
            old = Niche.objects.only('status', 'assigned_to').get(pk=instance.pk)
            instance._old_status = old.status
            instance._old_assigned_to_id = old.assigned_to_id
        except Niche.DoesNotExist:
            instance._old_status = None
            instance._old_assigned_to_id = None
    else:
        instance._old_status = None
        instance._old_assigned_to_id = None


@receiver(post_save, sender=Niche)
def on_niche_save(sender, instance, created, **kwargs):
    """Create notifications for status changes and assignments."""
    if created:
        return

    old_status = getattr(instance, '_old_status', None)
    old_assigned_to_id = getattr(instance, '_old_assigned_to_id', None)

    # Status change and assignment notifications are created by views directly
    # (they have access to the acting user). Signals just capture old state.
    # Kept as placeholder for future real-time broadcast hooks.
    _ = old_status, old_assigned_to_id
