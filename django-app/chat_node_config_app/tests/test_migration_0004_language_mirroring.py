"""PROJ-29 Phase 1J / BUG-3 — unit tests for migration 0004 backfill logic.

The migration is a Django data migration (``RunPython``). Its forward and
reverse callables operate on the historical ``ChatNodeConfig`` model via
``apps.get_model``. We don't replay the full migration here (that needs
``MigrationExecutor`` + state teardown which is slow and brittle); instead
we import the forward/reverse functions, pass a stub ``apps`` object that
returns the current ``ChatNodeConfig``, and assert the row-level effects.

This trades exact migration-state fidelity for fast, focused tests of the
business rule:

1. Admin-edited rows get the block prepended.
2. Already-migrated rows (containing the marker) are left alone.
3. Blank rows are left alone (fallback covers them).
4. Unrelated nodes (creative_techniques, etc.) are left alone.
5. Reverse migration strips the prepended block cleanly.
"""

from __future__ import annotations

import importlib

import pytest
from django.core.cache import cache

from chat_node_config_app.models import ChatNodeConfig

# Migration module names start with a digit, so Python's normal import
# syntax (``from chat_node_config_app.migrations.0004... import ...``)
# is a SyntaxError. Use ``importlib`` instead — this is the standard
# pattern for testing Django data migrations.
migration_0002 = importlib.import_module(
    'chat_node_config_app.migrations.0002_seed_node_rows',
)
migration_0004 = importlib.import_module(
    'chat_node_config_app.migrations.0004_promote_language_mirroring',
)


class _StubApps:
    """Minimal stand-in for the ``apps`` arg passed by Django's RunPython.

    Real migrations receive a frozen historical model registry. For the
    business-rule tests above the live model suffices.
    """

    def get_model(self, app_label: str, model_name: str):  # noqa: ARG002
        return ChatNodeConfig


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def _seed_chat_node_config_rows(db):
    """Re-run the 0002 seed inside the per-test transaction.

    pytest-django's `--reuse-db` + `@pytest.mark.django_db` transactional
    rollback hides rows created by data migrations from individual tests
    (the seed runs once on DB creation, then transactions roll back any
    state the migration left). Re-running `seed()` here is idempotent
    (`get_or_create`) and gives every test the 8 baseline rows the
    migration-under-test (`0004`) assumes exist.
    """
    migration_0002.seed(_StubApps(), schema_editor=None)


@pytest.fixture
def stub_apps():
    return _StubApps()


@pytest.mark.django_db
class TestPromoteLanguageMirroring:
    """``promote_language_mirroring`` MUST update only admin-edited target
    rows that lack the marker."""

    def test_migration_updates_existing_chatnodeconfig_rows(self, stub_apps):
        """Admin-edited target rows get the LANGUAGE MIRRORING block prepended."""
        # The 0002 seed migration creates the row with blank prompt. Set a
        # non-blank admin override that PRE-DATES Phase 1J (no marker).
        admin_prompt_agent = (
            'You are a custom niche assistant.\n\n'
            '# ROLE & MISSION\nDo niche things.\n'
        )
        admin_prompt_chat = (
            'You are a custom niche strategist.\n\n'
            '# ROLE & MISSION\nDiscuss niche things.\n'
        )
        ChatNodeConfig.objects.filter(node_name='agent_react').update(
            system_prompt=admin_prompt_agent,
        )
        ChatNodeConfig.objects.filter(node_name='chat_with_niche').update(
            system_prompt=admin_prompt_chat,
        )

        migration_0004.promote_language_mirroring(stub_apps, schema_editor=None)

        updated_agent = ChatNodeConfig.objects.get(node_name='agent_react')
        updated_chat = ChatNodeConfig.objects.get(node_name='chat_with_niche')

        assert migration_0004.MIGRATION_MARKER in updated_agent.system_prompt
        assert migration_0004.MIGRATION_MARKER in updated_chat.system_prompt
        # Admin's original content survives (PREPEND, not REPLACE).
        assert 'custom niche assistant' in updated_agent.system_prompt
        assert 'custom niche strategist' in updated_chat.system_prompt
        # Order: block FIRST, admin text SECOND.
        assert updated_agent.system_prompt.startswith(
            migration_0004.LANGUAGE_MIRRORING_BLOCK,
        )
        assert updated_chat.system_prompt.startswith(
            migration_0004.LANGUAGE_MIRRORING_BLOCK,
        )

    def test_migration_skips_blank_prompts(self, stub_apps):
        """Rows with blank ``system_prompt`` are left alone — fallback to
        ``DEFAULT_PROMPTS`` already carries the new block from Phase 1J."""
        # Seed migration leaves agent_react.system_prompt blank. Confirm
        # baseline + verify migration doesn't touch it.
        ChatNodeConfig.objects.filter(node_name='agent_react').update(
            system_prompt='',
        )

        migration_0004.promote_language_mirroring(stub_apps, schema_editor=None)

        row = ChatNodeConfig.objects.get(node_name='agent_react')
        assert row.system_prompt == ''  # untouched

    def test_migration_is_idempotent(self, stub_apps):
        """Re-running on a row that already has the marker is a no-op (no
        duplicated block)."""
        admin_prompt = (
            migration_0004.LANGUAGE_MIRRORING_BLOCK
            + '\n'
            + 'Admin custom override.\n'
        )
        ChatNodeConfig.objects.filter(node_name='agent_react').update(
            system_prompt=admin_prompt,
        )

        migration_0004.promote_language_mirroring(stub_apps, schema_editor=None)

        row = ChatNodeConfig.objects.get(node_name='agent_react')
        # Exactly ONE occurrence of the marker — not duplicated.
        assert row.system_prompt.count(migration_0004.MIGRATION_MARKER) == 1
        # Original admin content survives intact.
        assert 'Admin custom override.' in row.system_prompt

    def test_migration_leaves_non_target_nodes_alone(self, stub_apps):
        """Only 3 of the 8 nodes are user-facing chat surfaces — the other
        5 (creative_techniques, query_rewrite, contextual_header,
        follow_up_suggester, conversation_summarizer) must NOT receive the
        language-mirroring anchor; they are utility prompts."""
        for utility in (
            'creative_techniques',
            'query_rewrite',
            'contextual_header',
            'follow_up_suggester',
            'conversation_summarizer',
        ):
            ChatNodeConfig.objects.filter(node_name=utility).update(
                system_prompt='Some admin-edited utility prompt content.',
            )

        migration_0004.promote_language_mirroring(stub_apps, schema_editor=None)

        for utility in (
            'creative_techniques',
            'query_rewrite',
            'contextual_header',
            'follow_up_suggester',
            'conversation_summarizer',
        ):
            row = ChatNodeConfig.objects.get(node_name=utility)
            assert migration_0004.MIGRATION_MARKER not in row.system_prompt, (
                f'utility node {utility!r} unexpectedly received the language '
                f'anchor'
            )

    def test_reverse_migration_strips_block(self, stub_apps):
        """``reverse_promote`` removes the prepended block when present and
        is idempotent (re-running does not double-strip)."""
        admin_original = 'Admin custom override.\n'
        ChatNodeConfig.objects.filter(node_name='agent_react').update(
            system_prompt=(
                migration_0004.LANGUAGE_MIRRORING_BLOCK
                + '\n'
                + admin_original
            ),
        )

        migration_0004.reverse_promote(stub_apps, schema_editor=None)

        row = ChatNodeConfig.objects.get(node_name='agent_react')
        assert row.system_prompt == admin_original

        # Idempotent: running reverse again does NOT corrupt the prompt.
        migration_0004.reverse_promote(stub_apps, schema_editor=None)
        row.refresh_from_db()
        assert row.system_prompt == admin_original
