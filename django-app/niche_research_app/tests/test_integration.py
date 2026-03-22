"""
Task 7.4 -- Integration tests for PROJ-6 Niche Deep Research.

Covers:
  - Full workflow mock: trigger -> scrape -> vision -> emotional -> niche_profile -> keywords -> finalize
  - Checkpoint resume: failure at emotional_analyze -> verify earlier results preserved -> resume
  - Config change between runs: change model in Admin -> verify new run uses new model
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from django.urls import reverse

from niche_app.models import Niche
from niche_research_app.models import (
    NicheAnalysis,
    NicheKeywordAnalysis,
    NicheProductEmotionalAnalysis,
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
    ResearchNodeConfig,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_vision_result(is_match=True, slogan='Gone Fishing Today'):
    r = MagicMock()
    r.slogan_text = slogan
    r.meaning_context = 'Fishing pride'
    r.visual_style = 'Cartoon'
    r.graphic_elements = 'Fish icon'
    r.layout_composition = 'Centered'
    r.is_niche_match = is_match
    return r


def _mock_emotional_result():
    def _sub(d):
        m = MagicMock()
        m.model_dump = MagicMock(return_value=d)
        for k, v in d.items():
            setattr(m, k, v)
        return m

    r = MagicMock()
    r.original_slogan = 'Gone Fishing Today'
    r.customer_psychology = _sub({
        'buyer_profile': 'Angler', 'emotional_need': 'Pride',
        'internal_monologue': 'I fish.', 'what_they_cant_say_out_loud': 'Escape.',
    })
    r.sentiment_analysis = _sub({
        'sentiment': 'Positive', 'primary_emotion': 'Pride',
        'emotion_target': 'Self', 'confrontation_level': 'Low',
        'workplace_culture_required': 'Peer', 'humor_style': 'Warm',
        'humor_function': 'Pride',
    })
    r.emotional_pattern = '1: IDENTITY DECLARATION'
    r.vibe = _sub({
        'energy_level': 'Medium', 'attitude': 'Proud', 'core_emotion': 'Content',
    })
    r.semantic_structure = _sub({
        'structural_template': 'X + Y', 'wordplay_type': 'None',
        'delivery_style': 'Direct',
    })
    r.key_elements = ['fishing', 'pride']
    r.tone = 'Warm'
    r.adaptation_formula = '[X] + Identity'
    r.adaptation_examples = ['Gone Hiking']
    r.transferability_notes = _sub({
        'works_best_in': ['outdoor'], 'avoid_in': ['formal'],
        'critical_success_factors': ['authentic'],
    })
    return r


def _mock_niche_analysis():
    r = MagicMock()
    r.niche_summary = 'Fishing niche summary'
    r.sentiment = 'Positive'
    r.primary_emotions = ['Pride', 'Joy', 'Contentment']
    r.emotional_archetype = ['Everyman/Orphan']
    r.example_keywords = ['fishing', 'angler']
    r.pattern_analysis = [
        MagicMock(model_dump=MagicMock(return_value={
            'name': 'IDENTITY DECLARATION', 'present': True,
            'context': 'Fishing pride slogans.',
        })),
    ]
    r.emotional_reality = 'Identity validation'
    r.design_concepts = 'Nature themes'
    r.dominant_design_aesthetics = 'Earth tones'
    r.model_dump = MagicMock(return_value={'niche_summary': 'Fishing niche summary'})
    return r


def _mock_keyword_result():
    r = MagicMock()
    r.main_short_tail = ['fishing', 'angler']
    r.main_long_tail = ['funny fishing shirt']
    r.all_keywords_flat = 'fishing, angler'
    r.top_focus_keywords = ['fishing']
    r.top_long_tail_keywords = ['funny fishing shirt']
    r.model_dump = MagicMock(return_value={
        'main_short_tail': ['fishing'], 'main_long_tail': ['funny fishing shirt'],
        'all_keywords_flat': 'fishing', 'top_focus_keywords': ['fishing'],
        'top_long_tail_keywords': ['funny fishing shirt'],
    })
    return r


# ---------------------------------------------------------------------------
# Full Workflow Mock
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestFullWorkflowMock:
    """End-to-end: trigger -> mock all LLM calls -> verify DB records + API response."""

    @patch('niche_research_app.api.views.django_rq')
    @patch('niche_research_app.graph.nodes.niche_profile.create_react_agent')
    @patch('niche_research_app.graph.nodes.keywords.get_llm_for_node')
    @patch('niche_research_app.graph.nodes.niche_profile.get_llm_for_node')
    @patch('niche_research_app.graph.nodes.emotional_analyze.get_llm_for_node')
    @patch('niche_research_app.graph.nodes.vision_analyze.get_llm_for_node')
    @patch('niche_research_app.graph.nodes.scrape.get_or_create_keyword_cache')
    def test_full_pipeline(
        self, mock_cache, mock_vision_llm, mock_emotional_llm,
        mock_profile_llm, mock_keywords_llm, mock_agent, mock_rq,
        niche, auth_client, user_with_workspace, keyword, amazon_products,
        research_configs,
    ):
        user, _ = user_with_workspace
        from scraper_app.models import ProductSearchCache

        # 1. Mock scrape: fresh cache
        cache = MagicMock()
        cache.status = ProductSearchCache.Status.COMPLETED
        mock_cache.return_value = (cache, False)

        # 2. Mock vision LLM
        vision_structured = AsyncMock()
        vision_structured.ainvoke = AsyncMock(return_value=_mock_vision_result())
        vision_llm = MagicMock()
        vision_llm.with_structured_output = MagicMock(return_value=vision_structured)
        mock_vision_llm.return_value = (vision_llm, 'Vision prompt')

        # 3. Mock emotional LLM
        emotional_structured = AsyncMock()
        emotional_structured.ainvoke = AsyncMock(return_value=_mock_emotional_result())
        emotional_llm = MagicMock()
        emotional_llm.with_structured_output = MagicMock(return_value=emotional_structured)
        mock_emotional_llm.return_value = (emotional_llm, 'Emotional prompt')

        # 4. Mock niche profile (agent + structured)
        profile_llm = MagicMock()
        mock_profile_llm.return_value = (profile_llm, 'Profile prompt')

        agent_msg = MagicMock()
        agent_msg.content = 'Agent output'
        mock_agent_inst = AsyncMock()
        mock_agent_inst.ainvoke = AsyncMock(return_value={'messages': [agent_msg]})
        mock_agent.return_value = mock_agent_inst

        profile_structured = AsyncMock()
        profile_structured.ainvoke = AsyncMock(return_value=_mock_niche_analysis())
        profile_llm.with_structured_output = MagicMock(return_value=profile_structured)

        # 5. Mock keywords LLM
        keywords_structured = AsyncMock()
        keywords_structured.ainvoke = AsyncMock(return_value=_mock_keyword_result())
        keywords_llm = MagicMock()
        keywords_llm.with_structured_output = MagicMock(return_value=keywords_structured)
        mock_keywords_llm.return_value = (keywords_llm, 'Keywords prompt')

        # 6. Trigger via API (but run workflow directly instead of via RQ)
        mock_rq.get_queue.return_value = MagicMock()
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)
        assert resp.status_code == 201

        research = NicheResearch.objects.get(niche=niche)
        research_id = str(research.id)

        # Run the workflow nodes directly (simulating what the RQ task does)
        from niche_research_app.graph.nodes.scrape import scrape_node
        from niche_research_app.graph.nodes.vision_analyze import vision_analyze_node
        from niche_research_app.graph.nodes.emotional_analyze import emotional_analyze_node
        from niche_research_app.graph.nodes.niche_profile import niche_profile_node
        from niche_research_app.graph.nodes.keywords import keywords_node
        from niche_research_app.graph.workflow import finalize_node

        state = {
            'research_id': research_id,
            'niche_name': 'Fishing',
            'marketplace': 'amazon_com',
        }

        loop = asyncio.get_event_loop()

        # Scrape
        result = loop.run_until_complete(scrape_node(state))
        state.update(result)
        assert len(state['product_asins']) == 3

        # Vision
        result = loop.run_until_complete(vision_analyze_node(state))
        state.update(result)
        assert len(state['vision_analyses']) == 3

        # Emotional
        result = loop.run_until_complete(emotional_analyze_node(state))
        state.update(result)
        assert len(state['emotional_analyses']) == 3

        # Niche profile
        result = loop.run_until_complete(niche_profile_node(state))
        state.update(result)

        # Keywords
        result = loop.run_until_complete(keywords_node(state))
        state.update(result)

        # Finalize
        loop.run_until_complete(finalize_node(state))

        # Verify DB records
        research.refresh_from_db()
        assert research.status == NicheResearch.Status.COMPLETED
        assert research.completed_at is not None
        assert NicheResearchProduct.objects.filter(research=research).count() == 3
        assert NicheProductVisionAnalysis.objects.filter(research=research).count() == 3
        assert NicheProductEmotionalAnalysis.objects.filter(research=research).count() == 3
        assert NicheAnalysis.objects.filter(research=research).count() == 1
        assert NicheKeywordAnalysis.objects.filter(research=research).count() == 1

        # Verify niche status
        niche.refresh_from_db()
        assert niche.status == Niche.Status.DEEP_RESEARCH
        assert niche.research_run_id == research.id

        # Verify API response shape
        url = reverse('niche-research-latest', kwargs={'niche_id': niche.id})
        resp = auth_client.get(url)
        assert resp.status_code == 200
        data = resp.data
        assert data['status'] == 'completed'
        assert data['analysis'] is not None
        assert data['analysis']['sentiment'] == 'Positive'
        assert data['keywords'] is not None
        assert len(data['products']) == 3
        # Each product should have vision + emotional
        for p in data['products']:
            assert p['vision_analysis'] is not None
            assert p['emotional_analysis'] is not None


# ---------------------------------------------------------------------------
# Checkpoint Resume
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestCheckpointResume:
    """Simulate failure at emotional_analyze, verify earlier results preserved."""

    @patch('niche_research_app.graph.nodes.scrape.get_or_create_keyword_cache')
    @patch('niche_research_app.graph.nodes.vision_analyze.get_llm_for_node')
    def test_scrape_and_vision_preserved_after_emotional_failure(
        self, mock_vision_llm, mock_cache,
        niche, user_with_workspace, keyword, amazon_products,
    ):
        user, _ = user_with_workspace
        from scraper_app.models import ProductSearchCache

        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.PENDING,
        )

        # Mock scrape
        cache = MagicMock()
        cache.status = ProductSearchCache.Status.COMPLETED
        mock_cache.return_value = (cache, False)

        # Mock vision
        vision_structured = AsyncMock()
        vision_structured.ainvoke = AsyncMock(return_value=_mock_vision_result())
        vision_llm = MagicMock()
        vision_llm.with_structured_output = MagicMock(return_value=vision_structured)
        mock_vision_llm.return_value = (vision_llm, 'Prompt')

        from niche_research_app.graph.nodes.scrape import scrape_node
        from niche_research_app.graph.nodes.vision_analyze import vision_analyze_node

        state = {
            'research_id': str(research.id),
            'niche_name': 'Fishing',
            'marketplace': 'amazon_com',
        }

        loop = asyncio.get_event_loop()

        # Scrape succeeds
        result = loop.run_until_complete(scrape_node(state))
        state.update(result)

        # Vision succeeds
        result = loop.run_until_complete(vision_analyze_node(state))
        state.update(result)

        # Verify scrape + vision results are in DB
        assert NicheResearchProduct.objects.filter(research=research).count() == 3
        assert NicheProductVisionAnalysis.objects.filter(research=research).count() == 3

        # Simulate emotional failure
        research.status = NicheResearch.Status.FAILED
        research.error_message = 'Emotional analysis LLM timeout'
        research.save()

        # Verify earlier results are still preserved
        assert NicheResearchProduct.objects.filter(research=research).count() == 3
        assert NicheProductVisionAnalysis.objects.filter(research=research).count() == 3
        assert NicheProductEmotionalAnalysis.objects.filter(research=research).count() == 0
        assert NicheAnalysis.objects.filter(research=research).count() == 0

    @patch('niche_research_app.graph.nodes.niche_profile.create_react_agent')
    @patch('niche_research_app.graph.nodes.keywords.get_llm_for_node')
    @patch('niche_research_app.graph.nodes.niche_profile.get_llm_for_node')
    @patch('niche_research_app.graph.nodes.emotional_analyze.get_llm_for_node')
    def test_resume_completes_remaining_nodes(
        self, mock_emotional_llm, mock_profile_llm, mock_keywords_llm,
        mock_agent,
        niche, user_with_workspace, amazon_products, keyword,
    ):
        """After earlier nodes saved results, remaining nodes can complete."""
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
            status=NicheResearch.Status.RUNNING,
        )

        # Simulate scrape + vision already done
        for p in amazon_products:
            NicheResearchProduct.objects.create(research=research, product=p)
            NicheProductVisionAnalysis.objects.create(
                research=research, product=p,
                slogan_text='Gone Fishing Today',
                is_niche_match=True,
            )

        # Mock emotional
        emotional_structured = AsyncMock()
        emotional_structured.ainvoke = AsyncMock(return_value=_mock_emotional_result())
        emotional_llm = MagicMock()
        emotional_llm.with_structured_output = MagicMock(return_value=emotional_structured)
        mock_emotional_llm.return_value = (emotional_llm, 'Prompt')

        # Mock niche profile
        profile_llm = MagicMock()
        mock_profile_llm.return_value = (profile_llm, 'Prompt')
        agent_msg = MagicMock()
        agent_msg.content = 'Agent output'
        mock_agent_inst = AsyncMock()
        mock_agent_inst.ainvoke = AsyncMock(return_value={'messages': [agent_msg]})
        mock_agent.return_value = mock_agent_inst
        profile_structured = AsyncMock()
        profile_structured.ainvoke = AsyncMock(return_value=_mock_niche_analysis())
        profile_llm.with_structured_output = MagicMock(return_value=profile_structured)

        # Mock keywords
        keywords_structured = AsyncMock()
        keywords_structured.ainvoke = AsyncMock(return_value=_mock_keyword_result())
        keywords_llm = MagicMock()
        keywords_llm.with_structured_output = MagicMock(return_value=keywords_structured)
        mock_keywords_llm.return_value = (keywords_llm, 'Prompt')

        # Resume from emotional_analyze with state from prior nodes
        vision_analyses = [
            {
                'asin': p.asin, 'title': p.title, 'brand': p.brand,
                'thumbnail_url': p.thumbnail_url,
                'slogan_text': 'Gone Fishing Today',
                'meaning_context': 'Pride', 'visual_style': 'Cartoon',
                'graphic_elements': 'Fish', 'layout_composition': 'Centered',
            }
            for p in amazon_products
        ]

        state = {
            'research_id': str(research.id),
            'niche_name': 'Fishing',
            'marketplace': 'amazon_com',
            'product_asins': [p.asin for p in amazon_products],
            'vision_analyses': vision_analyses,
        }

        loop = asyncio.get_event_loop()

        from niche_research_app.graph.nodes.emotional_analyze import emotional_analyze_node
        from niche_research_app.graph.nodes.niche_profile import niche_profile_node
        from niche_research_app.graph.nodes.keywords import keywords_node
        from niche_research_app.graph.workflow import finalize_node

        result = loop.run_until_complete(emotional_analyze_node(state))
        state.update(result)

        result = loop.run_until_complete(niche_profile_node(state))
        state.update(result)

        result = loop.run_until_complete(keywords_node(state))
        state.update(result)

        loop.run_until_complete(finalize_node(state))

        # All records now exist
        research.refresh_from_db()
        assert research.status == NicheResearch.Status.COMPLETED
        assert NicheProductEmotionalAnalysis.objects.filter(research=research).count() == 3
        assert NicheAnalysis.objects.filter(research=research).count() == 1
        assert NicheKeywordAnalysis.objects.filter(research=research).count() == 1


# ---------------------------------------------------------------------------
# Config Change Between Runs
# ---------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
class TestConfigChangeBetweenRuns:

    @patch('niche_research_app.api.views.django_rq')
    def test_config_change_reflected_in_new_run(
        self, mock_rq, niche, auth_client, user_with_workspace, research_configs,
    ):
        """Changing ResearchNodeConfig between runs updates config_snapshot."""
        mock_rq.get_queue.return_value = MagicMock()

        # First run
        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp1 = auth_client.post(url)
        assert resp1.status_code == 201
        r1 = NicheResearch.objects.get(id=resp1.data['id'])

        # Complete first run
        r1.status = NicheResearch.Status.COMPLETED
        r1.save()

        snapshot1 = r1.config_snapshot
        assert snapshot1['vision_analyze']['model_name'] == 'openai/gpt-4.1-mini'

        # Change config
        config = ResearchNodeConfig.objects.get(node_name='vision_analyze')
        config.model_name = 'openai/gpt-4o'
        config.temperature = 0.8
        config.save()

        # Second run
        resp2 = auth_client.post(url)
        assert resp2.status_code == 201
        r2 = NicheResearch.objects.get(id=resp2.data['id'])

        snapshot2 = r2.config_snapshot
        assert snapshot2['vision_analyze']['model_name'] == 'openai/gpt-4o'
        assert snapshot2['vision_analyze']['temperature'] == 0.8

        # First run snapshot unchanged
        r1.refresh_from_db()
        assert r1.config_snapshot['vision_analyze']['model_name'] == 'openai/gpt-4.1-mini'

    @patch('niche_research_app.api.views.django_rq')
    def test_empty_config_produces_empty_snapshot(
        self, mock_rq, niche, auth_client, user_with_workspace,
    ):
        """If no ResearchNodeConfig rows, snapshot is empty dict."""
        mock_rq.get_queue.return_value = MagicMock()
        # No research_configs fixture -> 0 config rows

        url = reverse('niche-research', kwargs={'niche_id': niche.id})
        resp = auth_client.post(url)
        assert resp.status_code == 201

        research = NicheResearch.objects.get(id=resp.data['id'])
        assert research.config_snapshot == {}
