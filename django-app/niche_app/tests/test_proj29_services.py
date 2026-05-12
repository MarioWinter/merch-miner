"""PROJ-29 Phase 1B Round 2 — niche_app.services tests.

Covers:
* `marketplace_to_language` mapping + default fallback
* `derive_marketplace` 3-layer resolution (cache, NicheResearch, CollectedProduct)
* Redis-cache hit halves the query count
* Signal-driven cache invalidation on NicheResearch + CollectedProduct save
* `get_niche_analysis_snippet` empty + populated formatting
"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache

from niche_app.models import CollectedProduct, Niche
from niche_app.services import (
    MARKETPLACE_LANGUAGE_MAP,
    _marketplace_cache_key,
    derive_marketplace,
    get_niche_analysis_snippet,
    invalidate_marketplace_cache,
    marketplace_to_language,
)

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='svc@test.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='Svc WS', slug='svc-ws', owner=user)


@pytest.fixture
def niche(db, workspace, user):
    return Niche.objects.create(
        workspace=workspace, name='Cycling', notes='', created_by=user,
    )


@pytest.fixture(autouse=True)
def _clear_marketplace_cache():
    """Make sure no cross-test leakage of the niche-marketplace cache."""
    cache.clear()
    yield
    cache.clear()


# ---------------------------------------------------------------------------
# marketplace_to_language
# ---------------------------------------------------------------------------


class TestMarketplaceToLanguage:
    def test_known_marketplaces_map(self):
        assert marketplace_to_language('amazon_com') == 'en'
        assert marketplace_to_language('amazon_de') == 'de'
        assert marketplace_to_language('amazon_fr') == 'fr'
        assert marketplace_to_language('amazon_es') == 'es'
        assert marketplace_to_language('amazon_it') == 'it'
        assert marketplace_to_language('amazon_jp') == 'ja'
        assert marketplace_to_language('amazon_uk') == 'en'
        assert marketplace_to_language('amazon_ca') == 'en'

    def test_unknown_falls_back_to_english(self):
        assert marketplace_to_language('amazon_kp') == 'en'

    def test_empty_string_falls_back_to_english(self):
        assert marketplace_to_language('') == 'en'

    def test_map_constant_shape(self):
        assert 'amazon_com' in MARKETPLACE_LANGUAGE_MAP
        # 8 well-known marketplaces.
        assert len(set(MARKETPLACE_LANGUAGE_MAP.values())) >= 6


# ---------------------------------------------------------------------------
# derive_marketplace (3-layer fall-through)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeriveMarketplace:
    @patch('niche_app.signals._enqueue_reindex')
    def test_default_when_nothing_known(self, _mock_reindex, niche):
        assert derive_marketplace(niche) == 'amazon_com'

    @patch('niche_app.signals._enqueue_reindex')
    def test_falls_back_to_niche_research(
        self, _mock_reindex, niche, user,
    ):
        from niche_research_app.models import NicheResearch
        NicheResearch.objects.create(
            niche=niche,
            triggered_by=user,
            marketplace='amazon_de',
        )
        # Drop cache that may have been set by previous calls.
        invalidate_marketplace_cache(niche.pk)
        assert derive_marketplace(niche) == 'amazon_de'

    @patch('niche_app.signals._enqueue_reindex')
    def test_falls_back_to_collected_product_when_no_research(
        self, _mock_reindex, niche, user,
    ):
        from scraper_app.models import AmazonProduct
        prod_de = AmazonProduct.objects.create(
            asin='AAAAAAAAAA', marketplace='amazon_de', title='DE 1',
        )
        prod_de_2 = AmazonProduct.objects.create(
            asin='BBBBBBBBBB', marketplace='amazon_de', title='DE 2',
        )
        prod_com = AmazonProduct.objects.create(
            asin='CCCCCCCCCC', marketplace='amazon_com', title='US 1',
        )
        CollectedProduct.objects.create(niche=niche, product=prod_de)
        CollectedProduct.objects.create(niche=niche, product=prod_de_2)
        CollectedProduct.objects.create(niche=niche, product=prod_com)
        invalidate_marketplace_cache(niche.pk)
        # Most common marketplace (2x amazon_de vs 1x amazon_com).
        assert derive_marketplace(niche) == 'amazon_de'

    @patch('niche_app.signals._enqueue_reindex')
    def test_research_preferred_over_collected(
        self, _mock_reindex, niche, user,
    ):
        from niche_research_app.models import NicheResearch
        from scraper_app.models import AmazonProduct
        # Research says UK; collected says DE — research wins.
        prod_de = AmazonProduct.objects.create(
            asin='DDDDDDDDDD', marketplace='amazon_de', title='DE',
        )
        CollectedProduct.objects.create(niche=niche, product=prod_de)
        NicheResearch.objects.create(
            niche=niche, triggered_by=user, marketplace='amazon_co_uk',
        )
        invalidate_marketplace_cache(niche.pk)
        assert derive_marketplace(niche) == 'amazon_co_uk'


# ---------------------------------------------------------------------------
# derive_marketplace caching
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestDeriveMarketplaceCache:
    @patch('niche_app.signals._enqueue_reindex')
    def test_cache_hit_short_circuits(self, _mock_reindex, niche):
        cache.set(_marketplace_cache_key(niche.pk), 'amazon_jp', 3600)
        assert derive_marketplace(niche) == 'amazon_jp'

    @patch('niche_app.signals._enqueue_reindex')
    def test_second_call_uses_cache(
        self, _mock_reindex, niche, user, django_assert_num_queries,
    ):
        from niche_research_app.models import NicheResearch
        NicheResearch.objects.create(
            niche=niche, triggered_by=user, marketplace='amazon_es',
        )
        invalidate_marketplace_cache(niche.pk)

        # First call populates cache (DB query).
        assert derive_marketplace(niche) == 'amazon_es'
        # Second call hits cache — zero ORM queries.
        with django_assert_num_queries(0):
            assert derive_marketplace(niche) == 'amazon_es'


# ---------------------------------------------------------------------------
# Signal-driven cache invalidation (transaction.on_commit -> needs
# @pytest.mark.django_db(transaction=True) so the on_commit hook actually fires)
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
class TestMarketplaceCacheInvalidation:
    @patch('niche_app.signals._enqueue_reindex')
    def test_invalidated_on_niche_research_save(
        self, _mock_reindex, workspace, user,
    ):
        from niche_research_app.models import NicheResearch
        niche = Niche.objects.create(
            workspace=workspace, name='X', notes='', created_by=user,
        )
        cache.set(_marketplace_cache_key(niche.pk), 'amazon_com', 3600)
        NicheResearch.objects.create(
            niche=niche, triggered_by=user, marketplace='amazon_de',
        )
        # post-commit signal handler should have dropped the key.
        assert cache.get(_marketplace_cache_key(niche.pk)) is None

    @patch('niche_app.signals._enqueue_reindex')
    def test_invalidated_on_collected_product_save(
        self, _mock_reindex, workspace, user,
    ):
        from scraper_app.models import AmazonProduct
        niche = Niche.objects.create(
            workspace=workspace, name='Y', notes='', created_by=user,
        )
        prod = AmazonProduct.objects.create(
            asin='EEEEEEEEEE', marketplace='amazon_fr', title='FR',
        )
        cache.set(_marketplace_cache_key(niche.pk), 'amazon_com', 3600)
        CollectedProduct.objects.create(niche=niche, product=prod)
        assert cache.get(_marketplace_cache_key(niche.pk)) is None


# ---------------------------------------------------------------------------
# get_niche_analysis_snippet
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGetNicheAnalysisSnippet:
    @patch('niche_app.signals._enqueue_reindex')
    def test_empty_string_when_no_analysis(self, _mock_reindex, niche):
        assert get_niche_analysis_snippet(niche) == ''

    @patch('niche_app.signals._enqueue_reindex')
    def test_formats_when_analysis_exists(self, _mock_reindex, niche, user):
        from niche_research_app.models import NicheAnalysis, NicheResearch
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user, marketplace='amazon_com',
        )
        NicheAnalysis.objects.create(
            research=research,
            niche=niche,
            niche_summary='Cyclists love irony',
            emotional_reality='Pride + grit',
            design_concepts='Vintage bike art',
            pattern_analysis=[
                {'name': 'IDENTITY DECLARATION', 'present': True, 'context': 'I am a cyclist'},
                {'name': 'GROUP LEADER', 'present': False, 'context': ''},
                {'name': 'TRIBE/COMMUNITY', 'present': True, 'context': 'club tone'},
            ],
        )
        snippet = get_niche_analysis_snippet(niche)
        assert 'Cyclists love irony' in snippet
        assert 'Pride + grit' in snippet
        assert 'Vintage bike art' in snippet
        assert 'IDENTITY DECLARATION' in snippet
        assert 'TRIBE/COMMUNITY' in snippet
        # Non-present pattern excluded.
        assert 'GROUP LEADER' not in snippet

    @patch('niche_app.signals._enqueue_reindex')
    def test_takes_most_recent_analysis(self, _mock_reindex, niche, user):
        from niche_research_app.models import NicheAnalysis, NicheResearch
        research1 = NicheResearch.objects.create(
            niche=niche, triggered_by=user, marketplace='amazon_com',
        )
        NicheAnalysis.objects.create(
            research=research1, niche=niche, niche_summary='OLD',
            emotional_reality='', design_concepts='', pattern_analysis=[],
        )
        research2 = NicheResearch.objects.create(
            niche=niche, triggered_by=user, marketplace='amazon_com',
        )
        NicheAnalysis.objects.create(
            research=research2, niche=niche, niche_summary='NEW',
            emotional_reality='', design_concepts='', pattern_analysis=[],
        )
        snippet = get_niche_analysis_snippet(niche)
        assert 'NEW' in snippet
        assert 'OLD' not in snippet
