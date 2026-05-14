"""PROJ-29 AC-22: seed 8 ChatNodeConfig rows with blank system_prompt.

Blank `system_prompt` triggers fallback to `DEFAULT_PROMPTS[node_name]` in
`chat_node_config_app/_default_prompts.py`. Per-node model + temperature +
max_tokens copied from `NODE_DEFAULTS`.
"""

from django.db import migrations


# PROJ-29 model policy (locked 2026-05-12):
#   - agent_react / creative_techniques: ADMIN-pinned to gpt-4.1-mini.
#     Reliable structured tool-calling for agent_react; reliable JSON output
#     + style discipline for creative_techniques. UI Model picker can still
#     override creative_techniques per request.
#   - Everything else: gemini-3-flash-preview. Cheap, fast, sufficient
#     creativity for chat answers / query rewrite / follow-up chips /
#     summarizer / contextual header.
#
# IMPORTANT: `mistralai/mistral-small-creative` was the original seed for
# creative_techniques. OpenRouter has retired that model — calls return
# 404 → agent crash on `generate_slogans`. Pinned to gpt-4.1-mini here so
# any fresh DB install (new server, prod first-deploy) starts in a known-
# good state. Admins can switch later via Django Admin.
NODE_SEED = [
    ('agent_react', 'openai/gpt-4.1-mini', 0.3, 4000),
    # creative_techniques: Mistral Medium 3 is the writing-tuned successor to
    # the retired Small Creative. The `generate_slogans` tool has an automatic
    # fallback to google/gemini-3-flash-preview on any API error, so a
    # retirement / outage of Mistral won't crash slogan generation.
    ('creative_techniques', 'mistralai/mistral-medium-3', 0.7, 3500),
    ('chat_with_niche', 'google/gemini-3-flash-preview', 0.3, 2000),
    ('chat_no_niche', 'google/gemini-3-flash-preview', 0.4, 2000),
    ('query_rewrite', 'google/gemini-3-flash-preview', 0.2, 500),
    ('contextual_header', 'google/gemini-3-flash-preview', 0.2, 200),
    ('follow_up_suggester', 'google/gemini-3-flash-preview', 0.5, 300),
    ('conversation_summarizer', 'google/gemini-3-flash-preview', 0.2, 1000),
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
