"""PROJ-11 Phase I1 — data migration tests for Listing.translations.

Covers the forward migration in
``publish_app/migrations/0008_listing_translations_shape.py``: legacy
``{bullets: [...]}`` entries are promoted to ``{bullet_1, bullet_2}`` and
any bullet_3/4/5 keys are stripped. Tests invoke the pure function
directly (via importlib, since Django migration modules start with
digits) rather than replaying the full migration graph.
"""

import importlib
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from django.contrib.auth import get_user_model

from idea_app.models import Idea
from niche_app.models import Niche
from publish_app.models import Listing
from workspace_app.models import Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='mig@example.com', password='x')


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(name='MigWS', slug='mig-ws', owner=user)


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='MigNiche', created_by=user,
    )


@pytest.fixture
def idea(workspace, niche, user):
    return Idea.objects.create(
        workspace=workspace, niche=niche,
        slogan_text='Mig Slogan', created_by=user,
    )


def _run_forward():
    """Invoke the migration forward function with a stub `apps` registry.

    A tiny shim returns the real Listing model via
    ``apps.get_model('publish_app', 'Listing')`` so the migration logic
    runs against live ORM rows created by the test fixtures.
    """
    mod = importlib.import_module(
        'publish_app.migrations.0008_listing_translations_shape',
    )

    apps_stub = MagicMock()
    apps_stub.get_model.return_value = Listing
    schema_stub = SimpleNamespace()
    mod.migrate_translations_forward(apps_stub, schema_stub)


class TestTranslationsForwardMigration:
    def test_legacy_bullets_array_promoted_to_bullet_1_and_2(
        self, workspace, idea,
    ):
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, title='T',
            translations={
                'de': {
                    'title': 'T-DE',
                    'bullets': ['B1-DE', 'B2-DE', 'B3-DE', 'B4-DE', 'B5-DE'],
                    'description': 'D-DE',
                },
            },
        )

        _run_forward()
        listing.refresh_from_db()

        entry = listing.translations['de']
        assert entry['bullet_1'] == 'B1-DE'
        assert entry['bullet_2'] == 'B2-DE'
        # Legacy array dropped.
        assert 'bullets' not in entry
        # Preserved fields stay untouched.
        assert entry['title'] == 'T-DE'
        assert entry['description'] == 'D-DE'

    def test_legacy_bullets_array_truncates_over_two(self, workspace, idea):
        """Third, fourth, fifth entries are dropped (AC-1: 5 -> 2)."""
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, title='T',
            translations={
                'fr': {
                    'bullets': ['one', 'two', 'three', 'four', 'five'],
                },
            },
        )

        _run_forward()
        listing.refresh_from_db()

        entry = listing.translations['fr']
        assert entry['bullet_1'] == 'one'
        assert entry['bullet_2'] == 'two'
        assert 'bullet_3' not in entry
        assert 'bullet_4' not in entry
        assert 'bullet_5' not in entry
        assert 'bullets' not in entry

    def test_new_shape_untouched(self, workspace, idea):
        """Already-migrated entries are not clobbered."""
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, title='T',
            translations={
                'es': {
                    'title': 'T-ES',
                    'bullet_1': 'Existing 1',
                    'bullet_2': 'Existing 2',
                    'description': 'D-ES',
                },
            },
        )

        _run_forward()
        listing.refresh_from_db()

        entry = listing.translations['es']
        assert entry['bullet_1'] == 'Existing 1'
        assert entry['bullet_2'] == 'Existing 2'
        assert entry['title'] == 'T-ES'

    def test_stale_bullet_3_to_5_keys_removed(self, workspace, idea):
        """Residual bullet_3/4/5 keys from older writes are stripped."""
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, title='T',
            translations={
                'ja': {
                    'bullet_1': 'ichi',
                    'bullet_2': 'ni',
                    'bullet_3': 'san',
                    'bullet_4': 'yon',
                    'bullet_5': 'go',
                },
            },
        )

        _run_forward()
        listing.refresh_from_db()

        entry = listing.translations['ja']
        assert entry['bullet_1'] == 'ichi'
        assert entry['bullet_2'] == 'ni'
        assert 'bullet_3' not in entry
        assert 'bullet_4' not in entry
        assert 'bullet_5' not in entry

    def test_empty_translations_no_op(self, workspace, idea):
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, title='T', translations={},
        )

        _run_forward()
        listing.refresh_from_db()
        assert listing.translations == {}

    def test_non_dict_entry_defensively_skipped(self, workspace, idea):
        """An entry that isn't a dict is left as-is (forward migration
        only rewrites dict entries with bullets[] arrays).
        """
        listing = Listing.objects.create(
            workspace=workspace, idea=idea, title='T',
            translations={'it': 'not-a-dict'},
        )

        _run_forward()
        listing.refresh_from_db()
        assert listing.translations == {'it': 'not-a-dict'}
