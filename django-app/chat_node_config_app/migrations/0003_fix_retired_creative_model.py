"""PROJ-29 follow-up: fix ChatNodeConfig rows still pointing at the retired
`mistralai/mistral-small-creative` model.

OpenRouter retired that model after our Phase 1A seed migration shipped.
Any DB where migration 0002 ran BEFORE this patch has a `creative_techniques`
row that returns 404 on every `generate_slogans` invocation — agent crash.

This data migration scans the table for that exact broken value and updates
it to the new policy default (`openai/gpt-4.1-mini`). Safe to re-run; idempotent.
Also invalidates the resolver's Redis cache so the fix takes effect immediately.
"""

from django.db import migrations


RETIRED_MODELS = {
    # `mistral-small-creative` retired between Phase 1A seed and Phase 1I e2e.
    # New default per user request: Mistral Medium 3 (successor, writing-tuned)
    # with an in-tool fallback to gemini-3-flash-preview on any API error.
    'mistralai/mistral-small-creative': 'mistralai/mistral-medium-3',
}


def fix_retired_models(apps, schema_editor):
    ChatNodeConfig = apps.get_model('chat_node_config_app', 'ChatNodeConfig')
    for retired, replacement in RETIRED_MODELS.items():
        affected = list(
            ChatNodeConfig.objects.filter(model_name=retired)
            .values_list('node_name', flat=True)
        )
        if not affected:
            continue
        ChatNodeConfig.objects.filter(model_name=retired).update(
            model_name=replacement,
        )
        print(
            f'  fixed {len(affected)} node(s) using retired {retired!r}: '
            f'{affected} -> {replacement}',
        )
    # Best-effort cache invalidation — resolver cache is Redis with 60s TTL,
    # so this is just for users who hit the chat immediately after migrate.
    try:
        from chat_node_config_app.services.resolver import invalidate_cache
        for node_name in ['creative_techniques']:
            invalidate_cache(node_name)
    except Exception:  # pragma: no cover - defensive
        pass


def reverse_fix(apps, schema_editor):
    # No-op: don't restore retired models that won't work anyway.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('chat_node_config_app', '0002_seed_node_rows'),
    ]

    operations = [
        migrations.RunPython(fix_retired_models, reverse_fix),
    ]
