"""PROJ-29 Phase 1B Round 2 — rank_niche_keywords service tests."""

from datetime import datetime, timezone
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from keyword_app.models import KeywordJSCache, NicheKeyword
from keyword_app.services import rank_niche_keywords

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='kwrank@test.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='Rank WS', slug='rank-ws', owner=user)


@pytest.fixture
def niche(db, workspace, user):
    from niche_app.models import Niche
    return Niche.objects.create(
        workspace=workspace, name='Climbing', notes='', created_by=user,
    )


@pytest.fixture(autouse=True)
def _clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.mark.django_db
class TestRankNicheKeywords:
    @patch('niche_app.signals._enqueue_reindex')
    def test_orders_by_search_volume_when_cache_hit(
        self, _mock_reindex, niche, user,
    ):
        # Mark this niche as US so the JS cache rows must match marketplace='amazon_com'.
        from niche_research_app.models import NicheResearch
        NicheResearch.objects.create(
            niche=niche, triggered_by=user, marketplace='amazon_com',
        )

        NicheKeyword.objects.create(
            niche=niche, keyword='aaa', source='manual',
            position=2, created_by=user,
        )
        NicheKeyword.objects.create(
            niche=niche, keyword='bbb', source='manual',
            position=1, created_by=user,
        )
        NicheKeyword.objects.create(
            niche=niche, keyword='ccc', source='manual',
            position=0, created_by=user,
        )
        # Highest-volume keyword should rank first regardless of position.
        KeywordJSCache.objects.create(
            keyword='aaa', marketplace='amazon_com',
            monthly_search_volume_exact=10000,
            fetched_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        KeywordJSCache.objects.create(
            keyword='bbb', marketplace='amazon_com',
            monthly_search_volume_exact=2000,
            fetched_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        # ccc has NO cache row -> NULL volume -> ranks last (nulls_last).

        ranked = rank_niche_keywords(niche, limit=20)
        keywords = [kw.keyword for kw in ranked]
        assert keywords == ['aaa', 'bbb', 'ccc']
        assert ranked[0].search_volume == 10000
        assert ranked[1].search_volume == 2000
        assert ranked[2].search_volume is None

    @patch('niche_app.signals._enqueue_reindex')
    def test_falls_back_to_position_when_no_cache(
        self, _mock_reindex, niche, user,
    ):
        # No JS cache rows -> all search_volume are NULL -> ordering by position.
        NicheKeyword.objects.create(
            niche=niche, keyword='alpha', source='manual',
            position=2, created_by=user,
        )
        NicheKeyword.objects.create(
            niche=niche, keyword='beta', source='manual',
            position=0, created_by=user,
        )
        NicheKeyword.objects.create(
            niche=niche, keyword='gamma', source='manual',
            position=1, created_by=user,
        )
        ranked = rank_niche_keywords(niche, limit=20)
        keywords = [kw.keyword for kw in ranked]
        assert keywords == ['beta', 'gamma', 'alpha']
        assert all(kw.search_volume is None for kw in ranked)

    @patch('niche_app.signals._enqueue_reindex')
    def test_respects_limit(self, _mock_reindex, niche, user):
        for i in range(5):
            NicheKeyword.objects.create(
                niche=niche, keyword=f'kw{i}', source='manual',
                position=i, created_by=user,
            )
        ranked = rank_niche_keywords(niche, limit=3)
        assert len(ranked) == 3
