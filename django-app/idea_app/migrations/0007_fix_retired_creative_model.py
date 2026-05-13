"""PROJ-29 follow-up: fix SloganNodeConfig rows still pointing at the retired
`mistralai/mistral-small-creative` model.

OpenRouter retired that model after the slogan-adaptation graph was wired.
Any DB where the `adapt_slogans` row was seeded with the old default has a
broken slogan adaptation workflow — every adapt call returns 404 from
OpenRouter and the LangGraph node crashes.

This data migration mirrors `chat_node_config_app/migrations/
0003_fix_retired_creative_model.py`. Idempotent: only updates rows whose
`model_name` matches the exact retired value. Reverse is a no-op (don't
restore a model that no longer exists).
"""

from django.db import migrations


RETIRED_MODELS = {
    'mistralai/mistral-small-creative': 'mistralai/mistral-medium-3',
}


def fix_retired_models(apps, schema_editor):
    SloganNodeConfig = apps.get_model('idea_app', 'SloganNodeConfig')
    for retired, replacement in RETIRED_MODELS.items():
        affected = list(
            SloganNodeConfig.objects.filter(model_name=retired)
            .values_list('node_name', flat=True)
        )
        if not affected:
            continue
        SloganNodeConfig.objects.filter(model_name=retired).update(
            model_name=replacement,
        )
        print(
            f'  fixed {len(affected)} slogan-node(s) using retired '
            f'{retired!r}: {affected} -> {replacement}',
        )


def reverse_fix(apps, schema_editor):
    # No-op: don't restore retired models that won't work anyway.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('idea_app', '0006_idea_pattern_stylistic_choices'),
    ]

    operations = [
        migrations.RunPython(fix_retired_models, reverse_fix),
    ]
