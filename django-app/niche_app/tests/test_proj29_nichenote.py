"""PROJ-29 Phase 1B Round 1: NicheNote.source choices + get_embedding_text."""

import pytest

from niche_app.models import Niche, NicheNote


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    return User.objects.create_user(email='note@test.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='Note WS', slug='note-ws', owner=user)


@pytest.fixture
def niche(workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Yoga', notes='', created_by=user,
    )


@pytest.mark.django_db
class TestNicheNoteSource:
    def test_default_source_is_user(self, niche, user):
        note = NicheNote.objects.create(niche=niche, text='hello', created_by=user)
        assert note.source == NicheNote.Source.USER

    def test_all_source_choices_valid(self, niche, user):
        for src in [
            NicheNote.Source.USER,
            NicheNote.Source.NICHE_LEGACY_NOTES,
            NicheNote.Source.WEB_SEARCH,
            NicheNote.Source.AGENT_RESEARCH,
        ]:
            note = NicheNote.objects.create(
                niche=niche, text=f'{src}', source=src, created_by=user,
            )
            assert note.source == src


@pytest.mark.django_db
class TestNicheNoteGetEmbeddingText:
    def test_returns_text(self, niche, user):
        note = NicheNote.objects.create(
            niche=niche, text='yoga shirts trend up', created_by=user,
        )
        assert note.get_embedding_text() == 'yoga shirts trend up'

    def test_empty_text_returns_empty_string(self, niche, user):
        # Build without saving so we don't violate TextField (which allows blank=False)
        note = NicheNote(niche=niche, text='', created_by=user)
        assert note.get_embedding_text() == ''
