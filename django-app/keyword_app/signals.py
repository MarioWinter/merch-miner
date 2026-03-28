"""Signal handlers for keyword auto-import on research completion."""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='niche_research_app.NicheResearch',
          dispatch_uid='keyword_auto_import_on_research')
def auto_import_on_research_complete(sender, instance, **kwargs):
    """When NicheResearch transitions to completed, auto-import keywords."""
    if instance.status != 'completed':
        return

    # Check update_fields to avoid infinite loops (only trigger on status change)
    update_fields = kwargs.get('update_fields')
    if update_fields and 'status' not in update_fields:
        return

    try:
        from keyword_app.services.auto_import import import_research_keywords
        import_research_keywords(instance)
    except Exception:
        logger.exception(
            "Failed to auto-import keywords for research %s",
            instance.id,
        )
