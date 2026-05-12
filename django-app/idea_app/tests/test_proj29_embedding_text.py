"""PROJ-29 Phase 1B Round 1: Idea.get_embedding_text shape (slogan + why + buyer_voice)."""

import pytest
from django.contrib.auth import get_user_model

from idea_app.models import Idea

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='emb@test.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='Emb WS', slug='emb-ws', owner=user)


@pytest.fixture
def niche(workspace, user):
    from niche_app.models import Niche
    return Niche.objects.create(workspace=workspace, name='Hiking', created_by=user)


@pytest.mark.django_db
class TestIdeaGetEmbeddingText:
    def test_all_three_parts_joined(self, workspace, niche, user):
        idea = Idea.objects.create(
            workspace=workspace,
            niche=niche,
            slogan_text='Hike More Worry Less',
            why_it_works='Identity declaration.',
            buyer_voice_pattern='I am a hiker',
            is_manual=True,
            created_by=user,
        )
        text = idea.get_embedding_text()
        assert 'Hike More Worry Less' in text
        assert 'Identity declaration.' in text
        assert 'I am a hiker' in text

    def test_empty_slogan_only_other_parts(self, workspace, niche, user):
        idea = Idea.objects.create(
            workspace=workspace,
            niche=niche,
            slogan_text='',
            why_it_works='only this',
            buyer_voice_pattern='',
            is_manual=True,
            created_by=user,
        )
        text = idea.get_embedding_text()
        assert text == 'only this'

    def test_all_empty_returns_empty(self, workspace, niche, user):
        idea = Idea.objects.create(
            workspace=workspace,
            niche=niche,
            slogan_text='',
            why_it_works='',
            buyer_voice_pattern='',
            is_manual=True,
            created_by=user,
        )
        text = idea.get_embedding_text()
        assert text == ''
