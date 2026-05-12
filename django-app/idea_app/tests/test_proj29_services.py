"""PROJ-29 Phase 1B Round 2 — idea_app.services tests."""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from idea_app.models import Idea
from idea_app.services import get_recent_slogans_sample

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='ideasvc@test.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='Idea SVC', slug='idea-svc', owner=user)


@pytest.fixture
def niche(db, workspace, user):
    from niche_app.models import Niche
    return Niche.objects.create(
        workspace=workspace, name='Diving', notes='', created_by=user,
    )


@pytest.mark.django_db
class TestGetRecentSlogansSample:
    @patch('niche_app.signals._enqueue_reindex')
    def test_returns_placeholder_when_empty(self, _mock_reindex, niche):
        assert get_recent_slogans_sample(niche) == '(no slogans yet)'

    @patch('niche_app.signals._enqueue_reindex')
    def test_returns_lines_with_pattern_and_signal(
        self, _mock_reindex, workspace, niche, user,
    ):
        Idea.objects.create(
            workspace=workspace, niche=niche,
            slogan_text='Hike harder, worry less',
            pattern_used='IDENTITY_DECLARATION',
            signal_type='self',
            is_manual=True, created_by=user,
        )
        Idea.objects.create(
            workspace=workspace, niche=niche,
            slogan_text='Made for the trail',
            pattern_used='',
            signal_type=None,
            is_manual=True, created_by=user,
        )
        sample = get_recent_slogans_sample(niche)
        assert 'Hike harder, worry less' in sample
        assert 'IDENTITY_DECLARATION' in sample
        assert 'self' in sample
        # Empty pattern/signal rendered as '?'
        assert 'Made for the trail' in sample
        assert '(pattern: ?, signal: ?)' in sample

    @patch('niche_app.signals._enqueue_reindex')
    def test_respects_limit(self, _mock_reindex, workspace, niche, user):
        for i in range(5):
            Idea.objects.create(
                workspace=workspace, niche=niche,
                slogan_text=f'Slogan {i}',
                is_manual=True, created_by=user,
            )
        sample = get_recent_slogans_sample(niche, limit=2)
        lines = sample.splitlines()
        assert len(lines) == 2
