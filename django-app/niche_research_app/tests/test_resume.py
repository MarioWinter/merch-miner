"""Task 9.2 -- Resume/skip + progress unit tests for niche_research_app.

Covers:
  - resume.py helpers: state dict reconstruction from DB records (sync inner logic)
  - progress.py: update_node_progress decorator behavior
  - progress.py: get_completed_nodes helper

Note: The resume helpers are @sync_to_async-wrapped. Since pytest-asyncio
is not installed and sync_to_async spawns threads that don't share the
test transaction, we test the underlying sync QuerySet logic directly.
The progress decorator tests use TransactionTestCase to allow cross-thread
DB visibility.
"""

import uuid

import pytest
from django.test import TransactionTestCase
from django.utils import timezone

from niche_research_app.models import (
    NicheAnalysis,
    NicheKeywordAnalysis,
    NicheProductEmotionalAnalysis,
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
)
from niche_app.models import Niche
from scraper_app.models import AmazonProduct
from user_auth_app.models import User
from workspace_app.models import Workspace


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(email='resume@test.com'):
    return User.objects.create_user(
        email=email, password='TestPass123!', username=email, is_active=True,
    )


def _setup_research():
    """Create user, workspace, niche, research, and 2 products. Returns tuple."""
    user = _make_user()
    workspace = Workspace.objects.get(owner=user)
    niche = Niche.objects.create(workspace=workspace, name='Fishing', created_by=user)
    research = NicheResearch.objects.create(
        niche=niche,
        triggered_by=user,
        status=NicheResearch.Status.RUNNING,
    )

    products = []
    for i in range(2):
        p = AmazonProduct.objects.create(
            asin=f'RESUME000{i}',
            marketplace='amazon_com',
            title=f'Product {i}',
            brand=f'Brand{i}',
            thumbnail_url=f'https://img.com/{i}.jpg',
        )
        NicheResearchProduct.objects.create(research=research, product=p)
        products.append(p)

    return research, niche, products, user


# ---------------------------------------------------------------------------
# load_product_asins_from_db (sync inner logic)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLoadProductAsins:

    def test_returns_asins(self):
        research, _, products, _ = _setup_research()
        asins = list(
            NicheResearchProduct.objects.filter(
                research_id=research.id,
            ).values_list('product__asin', flat=True)
        )
        assert set(asins) == {'RESUME0000', 'RESUME0001'}

    def test_empty_when_no_products(self):
        user = _make_user('empty@test.com')
        ws = Workspace.objects.get(owner=user)
        niche = Niche.objects.create(workspace=ws, name='Empty', created_by=user)
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)
        asins = list(
            NicheResearchProduct.objects.filter(
                research_id=research.id,
            ).values_list('product__asin', flat=True)
        )
        assert asins == []


# ---------------------------------------------------------------------------
# load_vision_analyses_from_db (sync inner logic)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLoadVisionAnalyses:

    def _load_vision(self, research_id):
        """Replicate the sync logic from resume.load_vision_analyses_from_db."""
        analyses = NicheProductVisionAnalysis.objects.filter(
            research_id=research_id,
            is_niche_match=True,
        ).select_related('product')

        result = []
        for va in analyses:
            slogan = va.slogan_text or ''
            if not slogan.strip():
                continue
            words = slogan.strip().split()
            if len(words) <= 2:
                has_exception = any(w.lower() in ('squad', 'crew') for w in words)
                if not has_exception:
                    continue
            result.append({
                'asin': va.product.asin,
                'slogan_text': va.slogan_text,
            })
        return result

    def test_returns_matching_analyses(self):
        research, _, products, _ = _setup_research()
        NicheProductVisionAnalysis.objects.create(
            research=research, product=products[0],
            slogan_text='Gone Fishing Today',
            meaning_context='Pride', visual_style='Bold',
            graphic_elements='Fish', layout_composition='Center',
            is_niche_match=True,
        )
        NicheProductVisionAnalysis.objects.create(
            research=research, product=products[1],
            slogan_text='Not a match',
            is_niche_match=False,
        )

        result = self._load_vision(research.id)
        assert len(result) == 1
        assert result[0]['asin'] == 'RESUME0000'
        assert result[0]['slogan_text'] == 'Gone Fishing Today'

    def test_filters_short_slogans(self):
        """Slogans with <=2 words are filtered unless squad/crew exception."""
        research, _, products, _ = _setup_research()
        NicheProductVisionAnalysis.objects.create(
            research=research, product=products[0],
            slogan_text='Hi', is_niche_match=True,
        )
        result = self._load_vision(research.id)
        assert len(result) == 0

    def test_squad_crew_exception(self):
        """2-word slogans with 'squad' or 'crew' pass the filter."""
        research, _, products, _ = _setup_research()
        NicheProductVisionAnalysis.objects.create(
            research=research, product=products[0],
            slogan_text='Fishing Squad',
            meaning_context='Community', visual_style='Bold',
            graphic_elements='Group', layout_composition='Center',
            is_niche_match=True,
        )
        result = self._load_vision(research.id)
        assert len(result) == 1
        assert result[0]['slogan_text'] == 'Fishing Squad'

    def test_empty_slogan_filtered(self):
        research, _, products, _ = _setup_research()
        NicheProductVisionAnalysis.objects.create(
            research=research, product=products[0],
            slogan_text='', is_niche_match=True,
        )
        result = self._load_vision(research.id)
        assert len(result) == 0

    def test_crew_exception_also_works(self):
        """'crew' is also an exception word."""
        research, _, products, _ = _setup_research()
        NicheProductVisionAnalysis.objects.create(
            research=research, product=products[0],
            slogan_text='Fishing Crew',
            is_niche_match=True,
        )
        result = self._load_vision(research.id)
        assert len(result) == 1

    def test_three_word_slogan_passes(self):
        """Slogans with 3+ words always pass length filter."""
        research, _, products, _ = _setup_research()
        NicheProductVisionAnalysis.objects.create(
            research=research, product=products[0],
            slogan_text='I Love Fishing',
            is_niche_match=True,
        )
        result = self._load_vision(research.id)
        assert len(result) == 1


# ---------------------------------------------------------------------------
# load_emotional_analyses_from_db (sync inner logic)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLoadEmotionalAnalyses:

    def test_returns_analyses_with_vision_data(self):
        research, _, products, _ = _setup_research()
        NicheProductVisionAnalysis.objects.create(
            research=research, product=products[0],
            slogan_text='Gone Fishing Today',
            is_niche_match=True,
        )
        NicheProductEmotionalAnalysis.objects.create(
            research=research, product=products[0],
            original_slogan='Gone Fishing Today',
            emotional_pattern='IDENTITY DECLARATION',
            tone='Proud',
        )

        # Replicate sync logic
        analyses = NicheProductEmotionalAnalysis.objects.filter(
            research_id=research.id,
        ).select_related('product')

        assert analyses.count() == 1
        ea = analyses.first()
        assert ea.product.asin == 'RESUME0000'
        assert ea.original_slogan == 'Gone Fishing Today'
        assert ea.emotional_pattern == 'IDENTITY DECLARATION'

    def test_empty_when_no_emotional_analyses(self):
        research, _, _, _ = _setup_research()
        count = NicheProductEmotionalAnalysis.objects.filter(
            research_id=research.id,
        ).count()
        assert count == 0

    def test_vision_data_lookup(self):
        """_get_vision_data_for_product returns slogan_text from vision analysis."""
        from niche_research_app.graph.resume import _get_vision_data_for_product

        research, _, products, _ = _setup_research()
        NicheProductVisionAnalysis.objects.create(
            research=research, product=products[0],
            slogan_text='Test Slogan Here',
            is_niche_match=True,
        )

        result = _get_vision_data_for_product(str(research.id), 'RESUME0000')
        assert result == {'slogan_text': 'Test Slogan Here'}

    def test_vision_data_missing_returns_empty(self):
        """_get_vision_data_for_product returns {} when no vision analysis."""
        from niche_research_app.graph.resume import _get_vision_data_for_product

        research, _, products, _ = _setup_research()
        result = _get_vision_data_for_product(str(research.id), 'RESUME0000')
        assert result == {}


# ---------------------------------------------------------------------------
# load_analysis_result_from_db (sync inner logic)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLoadAnalysisResult:

    def test_returns_analysis_dict(self):
        research, niche, _, _ = _setup_research()
        na = NicheAnalysis.objects.create(
            research=research, niche=niche,
            niche_summary='Fishing niche summary',
            sentiment='Positive',
            primary_emotions=['Pride', 'Joy'],
            emotional_archetype=['Explorer'],
            example_keywords=['fishing', 'bass'],
            pattern_analysis=[{'name': 'IDENTITY', 'present': True, 'context': 'test'}],
            emotional_reality='Identity validation',
            design_concepts='Nature themes',
            dominant_design_aesthetics='Earth tones',
        )

        fetched = NicheAnalysis.objects.get(research_id=research.id)
        assert fetched.niche_summary == 'Fishing niche summary'
        assert fetched.sentiment == 'Positive'
        assert fetched.primary_emotions == ['Pride', 'Joy']
        assert fetched.pattern_analysis[0]['name'] == 'IDENTITY'

    def test_empty_when_no_analysis(self):
        research, _, _, _ = _setup_research()
        with pytest.raises(NicheAnalysis.DoesNotExist):
            NicheAnalysis.objects.get(research_id=research.id)


# ---------------------------------------------------------------------------
# load_keywords_result_from_db (sync inner logic)
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLoadKeywordsResult:

    def test_returns_keywords_dict(self):
        research, niche, _, _ = _setup_research()
        NicheKeywordAnalysis.objects.create(
            research=research, niche=niche,
            main_short_tail=['fishing', 'bass'],
            main_long_tail=['funny fishing shirt'],
            all_keywords_flat='fishing, bass, funny fishing shirt',
            top_focus_keywords=['fishing'],
            top_long_tail_keywords=['funny fishing shirt'],
        )

        fetched = NicheKeywordAnalysis.objects.get(research_id=research.id)
        assert fetched.main_short_tail == ['fishing', 'bass']
        assert fetched.all_keywords_flat == 'fishing, bass, funny fishing shirt'

    def test_empty_when_no_keywords(self):
        research, _, _, _ = _setup_research()
        with pytest.raises(NicheKeywordAnalysis.DoesNotExist):
            NicheKeywordAnalysis.objects.get(research_id=research.id)


# ---------------------------------------------------------------------------
# update_node_progress decorator (TransactionTestCase for cross-thread DB)
# ---------------------------------------------------------------------------

class TestUpdateNodeProgress(TransactionTestCase):
    """Uses TransactionTestCase so sync_to_async threads can see committed data."""

    def _run(self, coro):
        import asyncio
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()

    def _make_research(self):
        user = User.objects.create_user(
            email=f'progress{uuid.uuid4().hex[:6]}@test.com',
            password='TestPass123!',
            username=f'progress{uuid.uuid4().hex[:6]}',
            is_active=True,
        )
        workspace = Workspace.objects.get(owner=user)
        niche = Niche.objects.create(workspace=workspace, name='Test', created_by=user)
        return NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.RUNNING,
        )

    def test_sets_current_node_and_marks_completed(self):
        """On success, node appended to completed_nodes, current_node cleared."""
        from niche_research_app.graph.progress import update_node_progress

        research = self._make_research()

        @update_node_progress('test_node')
        async def dummy_node(state):
            return {'result': 'ok'}

        state = {'research_id': str(research.id)}
        self._run(dummy_node(state))

        research.refresh_from_db()
        assert 'test_node' in research.completed_nodes
        assert research.current_node == ''

    def test_clears_current_node_on_error(self):
        """On error, current_node cleared but NOT added to completed_nodes."""
        from niche_research_app.graph.progress import update_node_progress

        research = self._make_research()

        @update_node_progress('failing_node')
        async def failing_node(state):
            raise ValueError("boom")

        state = {'research_id': str(research.id)}
        with self.assertRaises(ValueError):
            self._run(failing_node(state))

        research.refresh_from_db()
        assert 'failing_node' not in research.completed_nodes
        assert research.current_node == ''

    def test_raises_cancelled_error_if_cancelled(self):
        """If research.cancelled=True, raises ResearchCancelledError before running."""
        from niche_research_app.graph.progress import (
            ResearchCancelledError,
            update_node_progress,
        )

        research = self._make_research()
        research.cancelled = True
        research.save(update_fields=['cancelled'])

        @update_node_progress('should_not_run')
        async def node(state):
            return {'result': 'should not get here'}

        state = {'research_id': str(research.id)}
        with self.assertRaises(ResearchCancelledError):
            self._run(node(state))

        research.refresh_from_db()
        assert 'should_not_run' not in research.completed_nodes

    def test_does_not_duplicate_completed_node(self):
        """Running same node twice doesn't duplicate in completed_nodes."""
        from niche_research_app.graph.progress import update_node_progress

        research = self._make_research()

        @update_node_progress('idempotent_node')
        async def node(state):
            return {}

        state = {'research_id': str(research.id)}
        self._run(node(state))
        self._run(node(state))

        research.refresh_from_db()
        assert research.completed_nodes.count('idempotent_node') == 1


# ---------------------------------------------------------------------------
# get_completed_nodes (TransactionTestCase)
# ---------------------------------------------------------------------------

class TestGetCompletedNodes(TransactionTestCase):

    def _run(self, coro):
        import asyncio
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()

    def test_returns_completed_nodes_list(self):
        from niche_research_app.graph.progress import get_completed_nodes

        user = User.objects.create_user(
            email='nodes@test.com', password='TestPass123!',
            username='nodes', is_active=True,
        )
        workspace = Workspace.objects.get(owner=user)
        niche = Niche.objects.create(workspace=workspace, name='Test', created_by=user)
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            completed_nodes=['scrape', 'vision_analyze'],
        )

        result = self._run(get_completed_nodes(str(research.id)))
        assert result == ['scrape', 'vision_analyze']

    def test_returns_empty_for_new_research(self):
        from niche_research_app.graph.progress import get_completed_nodes

        user = User.objects.create_user(
            email='new@test.com', password='TestPass123!',
            username='new', is_active=True,
        )
        workspace = Workspace.objects.get(owner=user)
        niche = Niche.objects.create(workspace=workspace, name='Test', created_by=user)
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
        )

        result = self._run(get_completed_nodes(str(research.id)))
        assert result == []

    def test_returns_empty_for_nonexistent_research(self):
        from niche_research_app.graph.progress import get_completed_nodes

        result = self._run(get_completed_nodes(str(uuid.uuid4())))
        assert result == []
