"""Seed default ResearchNodeConfig rows with prompts ported from n8n."""

from django.db import migrations


def seed_config(apps, schema_editor):
    ResearchNodeConfig = apps.get_model('niche_research_app', 'ResearchNodeConfig')

    # Import prompts — use raw strings since migrations should be self-contained
    from niche_research_app.graph.prompts import (
        DEFAULT_EMOTIONAL_PROMPT,
        DEFAULT_KEYWORDS_PROMPT,
        DEFAULT_NICHE_PROFILE_PROMPT,
        DEFAULT_VISION_PROMPT,
    )

    defaults = [
        ('vision_analyze', 'openai/gpt-4.1-mini', 0.3, DEFAULT_VISION_PROMPT),
        ('emotional_analyze', 'openai/gpt-4.1-mini', 0.3, DEFAULT_EMOTIONAL_PROMPT),
        ('niche_profile', 'openai/gpt-4.1-mini', 0.3, DEFAULT_NICHE_PROFILE_PROMPT),
        ('keywords', 'openai/gpt-4.1-mini', 0.3, DEFAULT_KEYWORDS_PROMPT),
    ]

    for node_name, model_name, temperature, system_prompt in defaults:
        ResearchNodeConfig.objects.get_or_create(
            node_name=node_name,
            defaults={
                'model_name': model_name,
                'temperature': temperature,
                'system_prompt': system_prompt,
            },
        )


def reverse_seed(apps, schema_editor):
    ResearchNodeConfig = apps.get_model('niche_research_app', 'ResearchNodeConfig')
    ResearchNodeConfig.objects.filter(
        node_name__in=['vision_analyze', 'emotional_analyze', 'niche_profile', 'keywords'],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('niche_research_app', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_config, reverse_seed),
    ]
