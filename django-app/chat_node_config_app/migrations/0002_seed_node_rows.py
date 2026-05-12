"""PROJ-29 AC-22: seed 8 ChatNodeConfig rows with blank system_prompt.

Blank `system_prompt` triggers fallback to `DEFAULT_PROMPTS[node_name]` in
`chat_node_config_app/_default_prompts.py`. Per-node model + temperature +
max_tokens copied from `NODE_DEFAULTS`.
"""

from django.db import migrations


NODE_SEED = [
    ('agent_react', 'openai/gpt-4.1-mini', 0.3, 4000),
    ('creative_techniques', 'mistralai/mistral-small-creative', 0.7, 3500),
    ('chat_with_niche', 'openai/gpt-4.1-mini', 0.3, 2000),
    ('chat_no_niche', 'openai/gpt-4.1-mini', 0.4, 2000),
    ('query_rewrite', 'openai/gpt-4.1-mini', 0.2, 500),
    ('contextual_header', 'openai/gpt-4.1-mini', 0.2, 200),
    ('follow_up_suggester', 'openai/gpt-4.1-mini', 0.5, 300),
    ('conversation_summarizer', 'openai/gpt-4.1-mini', 0.2, 1000),
]


def seed(apps, schema_editor):
    ChatNodeConfig = apps.get_model('chat_node_config_app', 'ChatNodeConfig')
    for node_name, model_name, temperature, max_tokens in NODE_SEED:
        ChatNodeConfig.objects.get_or_create(
            node_name=node_name,
            defaults={
                'model_name': model_name,
                'temperature': temperature,
                'max_tokens': max_tokens,
                'system_prompt': '',
                'is_active': True,
            },
        )


def reverse_seed(apps, schema_editor):
    ChatNodeConfig = apps.get_model('chat_node_config_app', 'ChatNodeConfig')
    ChatNodeConfig.objects.filter(
        node_name__in=[name for name, *_ in NODE_SEED],
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('chat_node_config_app', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed, reverse_seed),
    ]
