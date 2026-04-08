"""Signals for design_app — seed default prompt presets on workspace creation."""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)

DEFAULT_PRESETS = [
    {
        'name': 'Full Context',
        'source_config': {
            'slogan': True,
            'keywords': True,
            'research': True,
            'web_research': True,
            'image': True,
        },
    },
    {
        'name': 'Slogan Only',
        'source_config': {
            'slogan': True,
            'keywords': False,
            'research': False,
            'web_research': False,
            'image': False,
        },
    },
    {
        'name': 'Image Analysis Only',
        'source_config': {
            'slogan': False,
            'keywords': False,
            'research': False,
            'web_research': False,
            'image': True,
        },
    },
]


@receiver(post_save, sender='workspace_app.Workspace')
def seed_default_prompt_presets(sender, instance, created, **kwargs):
    """Seed 3 default PromptPresets when a workspace is created."""
    if not created:
        return

    from design_app.models import PromptPreset

    # Use workspace.owner FK directly — Membership doesn't exist yet at
    # post_save time (created after Workspace.objects.create in the
    # workspace_app signal).
    if not instance.owner_id:
        logger.warning(
            'No owner on workspace %s, skipping preset seeding.',
            instance.id,
        )
        return

    presets = [
        PromptPreset(
            workspace=instance,
            name=p['name'],
            source_config=p['source_config'],
            created_by_id=instance.owner_id,
        )
        for p in DEFAULT_PRESETS
    ]
    PromptPreset.objects.bulk_create(presets, ignore_conflicts=True)
