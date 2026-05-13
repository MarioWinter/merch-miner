"""PROJ-29 Phase 1J / BUG-3 — promote LANGUAGE MIRRORING rule to a CRITICAL
top-of-prompt anchor in admin-edited ChatNodeConfig rows.

Why this migration exists
-------------------------
Prior to Phase 1J the language-mirroring rule lived only as Rule 2 of the
8-rule `CHAT_GUARDRAILS_BLOCK`. Production prod traffic showed that
positional bias caused the LLM to drift to English on German queries when
no niche was pinned (Vane path) or when tool context overwhelmed the
guardrail block (agent path).

Phase 1J promotes the rule to a top-of-prompt CRITICAL anchor in
``_default_prompts.py:LANGUAGE_MIRRORING_CRITICAL_BLOCK``. Fresh DBs +
fallback users (rows with blank ``system_prompt``) pick this up
automatically via the resolver. But existing admin-edited rows in prod
have a non-blank ``system_prompt`` snapshot from before Phase 1J — the
resolver returns that snapshot unchanged, so the fix never reaches those
rows without an explicit data migration.

This migration scans for non-blank rows that DO NOT already contain the
``LANGUAGE MIRRORING (CRITICAL)`` marker and prepends the block. Blank
rows are left alone (fallback covers them). Rows that already contain the
marker (re-run scenario) are left alone (idempotent).

Safety
------
- Idempotent. Re-running does not duplicate the block.
- Admin-divergence preserved. We only PREPEND. The admin's edits stay
  intact below the new anchor.
- Reverse migration strips the prepended block.
- Best-effort resolver cache invalidation so the fix takes effect
  immediately on the next request (60s TTL otherwise).
"""

from django.db import migrations


# Source-of-truth: keep this string in sync with
# `chat_node_config_app/_default_prompts.py:LANGUAGE_MIRRORING_CRITICAL_BLOCK`.
# We inline a copy here so the migration is hermetic — running it on an
# older codebase checkout still works.
LANGUAGE_MIRRORING_BLOCK = """\
# LANGUAGE MIRRORING (CRITICAL)

Always respond in the same language as the user's most recent message.
If the user wrote in German, respond in German.
If the user wrote in English, respond in English.
If unclear, mirror the dominant language of the conversation.

This rule overrides niche names, niche notes, marketplace language, and any
stored reference content. Slogan generation in `generate_slogans` is the
only exception — it always uses {marketplace_language}.
"""

# Idempotency marker. Any row whose ``system_prompt`` contains this exact
# substring is treated as already-migrated and skipped.
MIGRATION_MARKER = '# LANGUAGE MIRRORING (CRITICAL)'

# Only touch these 3 prompts — the other 5 chat nodes (creative_techniques,
# query_rewrite, contextual_header, follow_up_suggester,
# conversation_summarizer) are utility prompts that do not need a
# user-facing language directive.
TARGET_NODES = ('agent_react', 'chat_with_niche', 'chat_no_niche')


def promote_language_mirroring(apps, schema_editor):
    ChatNodeConfig = apps.get_model('chat_node_config_app', 'ChatNodeConfig')
    touched = []
    for node_name in TARGET_NODES:
        try:
            row = ChatNodeConfig.objects.get(node_name=node_name)
        except ChatNodeConfig.DoesNotExist:
            continue
        # Blank rows fall back to DEFAULT_PROMPTS which already includes the
        # block via the Phase 1J code change — leave alone.
        if not row.system_prompt:
            continue
        # Idempotent: skip rows that already carry the marker.
        if MIGRATION_MARKER in row.system_prompt:
            continue
        row.system_prompt = LANGUAGE_MIRRORING_BLOCK + '\n' + row.system_prompt
        row.save(update_fields=['system_prompt'])
        touched.append(node_name)

    if touched:
        print(
            f'  PROJ-29 Phase 1J: prepended LANGUAGE MIRRORING anchor to '
            f'{len(touched)} admin-edited prompt(s): {touched}',
        )

    # Best-effort cache invalidation. Resolver caches for 60s in Redis; this
    # is just for users hitting chat immediately post-migrate.
    try:
        from chat_node_config_app.services.resolver import invalidate_cache
        for node_name in TARGET_NODES:
            invalidate_cache(node_name)
    except Exception:  # pragma: no cover - defensive
        pass


def reverse_promote(apps, schema_editor):
    """Strip the prepended block if present. Best-effort, idempotent."""
    ChatNodeConfig = apps.get_model('chat_node_config_app', 'ChatNodeConfig')
    for node_name in TARGET_NODES:
        try:
            row = ChatNodeConfig.objects.get(node_name=node_name)
        except ChatNodeConfig.DoesNotExist:
            continue
        if not row.system_prompt:
            continue
        if row.system_prompt.startswith(LANGUAGE_MIRRORING_BLOCK + '\n'):
            row.system_prompt = row.system_prompt[
                len(LANGUAGE_MIRRORING_BLOCK) + 1:
            ]
            row.save(update_fields=['system_prompt'])

    try:
        from chat_node_config_app.services.resolver import invalidate_cache
        for node_name in TARGET_NODES:
            invalidate_cache(node_name)
    except Exception:  # pragma: no cover - defensive
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('chat_node_config_app', '0003_fix_retired_creative_model'),
    ]

    operations = [
        migrations.RunPython(promote_language_mirroring, reverse_promote),
    ]
