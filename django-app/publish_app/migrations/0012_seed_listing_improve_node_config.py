# PROJ-11 Phase M1 extension (2026-04-23):
#
# Seed default ``ListingImproveNodeConfig`` rows so the service can read LLM
# config from DB without a first-run bootstrap. Idempotent via
# ``get_or_create``.
#
# Two nodes:
# - ``ai_improve``    — text-only rewrite of Listing copy using cached
#                       ``DesignAsset.vision_analysis`` as context.
# - ``design_vision`` — one-shot vision pass to populate the cache.

from django.db import migrations

from publish_app.services.ai_improve_prompts import (
    DEFAULT_AI_IMPROVE_PROMPT,
    DEFAULT_DESIGN_VISION_PROMPT,
)


def seed_config(apps, schema_editor):
    ListingImproveNodeConfig = apps.get_model(
        'publish_app', 'ListingImproveNodeConfig',
    )

    defaults = [
        (
            'ai_improve',
            'openai/gpt-4.1-mini',
            0.7,
            2000,
            DEFAULT_AI_IMPROVE_PROMPT,
        ),
        (
            'design_vision',
            'openai/gpt-4.1-mini',
            0.2,
            1500,
            DEFAULT_DESIGN_VISION_PROMPT,
        ),
    ]

    for node_name, model_name, temperature, max_tokens, system_prompt in defaults:
        ListingImproveNodeConfig.objects.get_or_create(
            node_name=node_name,
            defaults={
                'model_name': model_name,
                'temperature': temperature,
                'max_tokens': max_tokens,
                'system_prompt': system_prompt,
            },
        )


def reverse_seed(apps, schema_editor):
    ListingImproveNodeConfig = apps.get_model(
        'publish_app', 'ListingImproveNodeConfig',
    )
    ListingImproveNodeConfig.objects.filter(
        node_name__in=['ai_improve', 'design_vision'],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('publish_app', '0011_listingimprovenodeconfig_designasset_vision'),
    ]

    operations = [
        migrations.RunPython(seed_config, reverse_seed),
    ]
