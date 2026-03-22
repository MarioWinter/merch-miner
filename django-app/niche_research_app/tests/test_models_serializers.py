"""
Task 7.1 -- Model + serializer tests for PROJ-6 Niche Deep Research.

Covers:
  - All 7 models: creation, validation, relationships
  - ResearchNodeConfig: fallback when no config exists
  - Serializer JSON shape (NicheResearchSerializer, NicheResearchDetailSerializer)
  - Related niches computation (>=2 shared active patterns)
"""

import pytest

from niche_app.models import Niche
from niche_research_app.api.serializers import (
    NicheResearchDetailSerializer,
    NicheResearchSerializer,
)
from niche_research_app.models import (
    NicheAnalysis,
    NicheKeywordAnalysis,
    NicheProductEmotionalAnalysis,
    NicheProductVisionAnalysis,
    NicheResearch,
    NicheResearchProduct,
    ResearchNodeConfig,
)
from niche_research_app.tests.conftest import SAMPLE_PATTERN_ANALYSIS


# ---------------------------------------------------------------------------
# ResearchNodeConfig
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestResearchNodeConfig:

    def test_create_all_node_names(self, research_configs):
        assert ResearchNodeConfig.objects.count() == 4
        names = set(ResearchNodeConfig.objects.values_list('node_name', flat=True))
        assert names == {'vision_analyze', 'emotional_analyze', 'niche_profile', 'keywords'}

    def test_unique_node_name(self, research_configs):
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            ResearchNodeConfig.objects.create(
                node_name='vision_analyze',
                model_name='test/model',
            )

    def test_defaults(self, db):
        config, _ = ResearchNodeConfig.objects.get_or_create(
            node_name='vision_analyze',
        )
        assert config.model_name == 'openai/gpt-4.1-mini'
        assert config.temperature == 0.3
        assert config.max_tokens is None
        # system_prompt is seeded by data migration 0002
        assert isinstance(config.system_prompt, str)

    def test_str(self, research_configs):
        config = ResearchNodeConfig.objects.get(node_name='vision_analyze')
        assert 'Vision Analyze' in str(config)
        assert 'openai/gpt-4.1-mini' in str(config)

    def test_updated_at_auto(self, research_configs):
        config = ResearchNodeConfig.objects.get(node_name='vision_analyze')
        old_updated = config.updated_at
        config.temperature = 0.7
        config.save()
        config.refresh_from_db()
        assert config.updated_at > old_updated


# ---------------------------------------------------------------------------
# NicheResearch
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNicheResearch:

    def test_create(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
        )
        assert research.status == NicheResearch.Status.PENDING
        assert research.config_snapshot == {}
        assert research.error_message == ''
        assert research.completed_at is None
        assert research.created_at is not None

    def test_ordering_by_created_at_desc(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        r1 = NicheResearch.objects.create(niche=niche, triggered_by=user)
        r2 = NicheResearch.objects.create(niche=niche, triggered_by=user)
        results = list(NicheResearch.objects.all())
        assert results[0] == r2
        assert results[1] == r1

    def test_status_choices(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        for st in ['pending', 'running', 'completed', 'failed']:
            r = NicheResearch.objects.create(
                niche=niche, triggered_by=user, status=st,
            )
            assert r.status == st

    def test_cascade_delete_niche(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        NicheResearch.objects.create(niche=niche, triggered_by=user)
        niche.delete()
        assert NicheResearch.objects.count() == 0

    def test_config_snapshot_json(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        snapshot = {'vision_analyze': {'model_name': 'test', 'temperature': 0.5}}
        r = NicheResearch.objects.create(
            niche=niche, triggered_by=user, config_snapshot=snapshot,
        )
        r.refresh_from_db()
        assert r.config_snapshot['vision_analyze']['model_name'] == 'test'

    def test_str(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        r = NicheResearch.objects.create(niche=niche, triggered_by=user)
        s = str(r)
        assert 'pending' in s.lower()
        assert 'Fishing' in s


# ---------------------------------------------------------------------------
# NicheResearchProduct
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNicheResearchProduct:

    def test_create(self, completed_research, amazon_products):
        assert NicheResearchProduct.objects.filter(
            research=completed_research,
        ).count() == 3

    def test_unique_together(self, completed_research, amazon_products):
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            NicheResearchProduct.objects.create(
                research=completed_research,
                product=amazon_products[0],
            )

    def test_cascade_on_research_delete(self, completed_research):
        rid = completed_research.id
        completed_research.delete()
        assert NicheResearchProduct.objects.filter(research_id=rid).count() == 0


# ---------------------------------------------------------------------------
# NicheProductVisionAnalysis
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNicheProductVisionAnalysis:

    def test_create(self, completed_research, amazon_products):
        count = NicheProductVisionAnalysis.objects.filter(
            research=completed_research,
        ).count()
        assert count == 3

    def test_fields_stored(self, completed_research, amazon_products):
        va = NicheProductVisionAnalysis.objects.filter(
            research=completed_research,
        ).first()
        assert va.slogan_text != ''
        assert va.is_niche_match is True
        assert va.created_at is not None

    def test_blank_defaults(self, niche, user_with_workspace, amazon_products):
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(
            niche=niche, triggered_by=user,
        )
        va = NicheProductVisionAnalysis.objects.create(
            research=research, product=amazon_products[0],
        )
        assert va.slogan_text == ''
        assert va.is_niche_match is False


# ---------------------------------------------------------------------------
# NicheProductEmotionalAnalysis
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNicheProductEmotionalAnalysis:

    def test_create(self, completed_research):
        count = NicheProductEmotionalAnalysis.objects.filter(
            research=completed_research,
        ).count()
        assert count == 3

    def test_json_fields(self, completed_research):
        ea = NicheProductEmotionalAnalysis.objects.filter(
            research=completed_research,
        ).first()
        assert 'buyer_profile' in ea.customer_psychology
        assert 'sentiment' in ea.sentiment_analysis
        assert 'energy_level' in ea.vibe
        assert isinstance(ea.key_elements, list)
        assert isinstance(ea.adaptation_examples, list)
        assert 'works_best_in' in ea.transferability_notes

    def test_defaults(self, niche, user_with_workspace, amazon_products):
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)
        ea = NicheProductEmotionalAnalysis.objects.create(
            research=research, product=amazon_products[0],
        )
        assert ea.customer_psychology == {}
        assert ea.key_elements == []
        assert ea.adaptation_examples == []


# ---------------------------------------------------------------------------
# NicheAnalysis
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNicheAnalysis:

    def test_create(self, completed_research):
        na = NicheAnalysis.objects.get(research=completed_research)
        assert na.sentiment == 'Positive'
        assert len(na.primary_emotions) == 3
        assert len(na.pattern_analysis) == 16

    def test_sentiment_choices(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)
        for s in ['Positive', 'Neutral', 'Negative']:
            na = NicheAnalysis.objects.create(
                research=research, niche=niche, sentiment=s,
            )
            assert na.sentiment == s

    def test_pattern_analysis_structure(self, completed_research):
        na = NicheAnalysis.objects.get(research=completed_research)
        for p in na.pattern_analysis:
            assert 'name' in p
            assert 'present' in p
            assert 'context' in p


# ---------------------------------------------------------------------------
# NicheKeywordAnalysis
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNicheKeywordAnalysis:

    def test_create(self, completed_research):
        ka = NicheKeywordAnalysis.objects.get(research=completed_research)
        assert len(ka.main_short_tail) > 0
        assert len(ka.main_long_tail) > 0
        assert 'fishing' in ka.all_keywords_flat

    def test_defaults(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        research = NicheResearch.objects.create(niche=niche, triggered_by=user)
        ka = NicheKeywordAnalysis.objects.create(
            research=research, niche=niche,
        )
        assert ka.main_short_tail == []
        assert ka.all_keywords_flat == ''


# ---------------------------------------------------------------------------
# LLM Factory Config Fallback
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestLLMFactoryFallback:

    def test_fallback_when_no_config(self, db, settings):
        """get_llm_for_node returns defaults when no ResearchNodeConfig exists."""
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
        from niche_research_app.graph.llm import get_llm_for_node
        llm, prompt = get_llm_for_node('vision_analyze')
        assert prompt != ''  # Falls back to DEFAULT_VISION_PROMPT
        assert llm.model_name == 'openai/gpt-4.1-mini'

    def test_reads_db_config(self, research_configs, settings):
        """get_llm_for_node reads config from DB."""
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
        config = ResearchNodeConfig.objects.get(node_name='vision_analyze')
        config.model_name = 'openai/gpt-4o'
        config.temperature = 0.9
        config.system_prompt = 'Custom prompt'
        config.save()

        from niche_research_app.graph.llm import get_llm_for_node
        llm, prompt = get_llm_for_node('vision_analyze')
        assert prompt == 'Custom prompt'
        assert llm.model_name == 'openai/gpt-4o'
        assert llm.temperature == 0.9

    def test_empty_system_prompt_uses_default(self, research_configs, settings):
        """If DB config has empty system_prompt, code default is used."""
        settings.OPENROUTER_API_KEY = 'test-key'
        settings.OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
        config = ResearchNodeConfig.objects.get(node_name='vision_analyze')
        config.system_prompt = ''
        config.save()

        from niche_research_app.graph.llm import get_llm_for_node
        _, prompt = get_llm_for_node('vision_analyze')
        # Falls back to DEFAULT_VISION_PROMPT since DB prompt is empty
        assert 'T-SHIRT DESIGN ANALYSIS' in prompt


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNicheResearchSerializer:

    def test_fields(self, completed_research):
        data = NicheResearchSerializer(completed_research).data
        assert set(data.keys()) == {
            'id', 'status', 'created_at', 'completed_at', 'error_message',
            'completed_nodes', 'current_node', 'total_nodes',
            'marketplace', 'product_type', 'retry_count',
            'brand_filtered_count',
        }
        assert data['status'] == 'completed'

    def test_pending_research(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        r = NicheResearch.objects.create(niche=niche, triggered_by=user)
        data = NicheResearchSerializer(r).data
        assert data['status'] == 'pending'
        assert data['completed_at'] is None


@pytest.mark.django_db
class TestNicheResearchDetailSerializer:

    def test_shape(self, completed_research):
        data = NicheResearchDetailSerializer(completed_research).data
        assert 'analysis' in data
        assert 'keywords' in data
        assert 'products' in data
        assert 'related_niches' in data

    def test_analysis_fields(self, completed_research):
        data = NicheResearchDetailSerializer(completed_research).data
        analysis = data['analysis']
        assert analysis is not None
        assert analysis['sentiment'] == 'Positive'
        assert len(analysis['primary_emotions']) == 3
        assert len(analysis['pattern_analysis']) == 16

    def test_keywords_fields(self, completed_research):
        data = NicheResearchDetailSerializer(completed_research).data
        kw = data['keywords']
        assert kw is not None
        assert 'fishing' in kw['main_short_tail']
        assert 'fishing' in kw['all_keywords_flat']

    def test_products_nested(self, completed_research):
        data = NicheResearchDetailSerializer(completed_research).data
        products = data['products']
        assert len(products) == 3
        p = products[0]
        assert 'asin' in p
        assert 'title' in p
        assert 'vision_analysis' in p
        assert 'emotional_analysis' in p

    def test_product_vision_analysis_shape(self, completed_research):
        data = NicheResearchDetailSerializer(completed_research).data
        va = data['products'][0]['vision_analysis']
        assert va is not None
        expected_keys = {
            'slogan_text', 'meaning_context', 'visual_style',
            'graphic_elements', 'layout_composition',
        }
        assert set(va.keys()) == expected_keys

    def test_product_emotional_analysis_shape(self, completed_research):
        data = NicheResearchDetailSerializer(completed_research).data
        ea = data['products'][0]['emotional_analysis']
        assert ea is not None
        assert 'customer_psychology' in ea
        assert 'sentiment_analysis' in ea
        assert 'emotional_pattern' in ea
        assert 'vibe' in ea
        assert 'key_elements' in ea

    def test_no_analysis_returns_none(self, niche, user_with_workspace):
        user, _ = user_with_workspace
        r = NicheResearch.objects.create(niche=niche, triggered_by=user)
        data = NicheResearchDetailSerializer(r).data
        assert data['analysis'] is None
        assert data['keywords'] is None

    def test_related_niches_empty_when_no_matches(self, completed_research):
        """No other niches with shared patterns -> empty list."""
        data = NicheResearchDetailSerializer(completed_research).data
        assert data['related_niches'] == []


@pytest.mark.django_db
class TestRelatedNichesComputation:

    def test_shared_patterns_gte_2(self, completed_research, other_niche, user_with_workspace):
        """Other niche with >=2 shared active patterns appears in related."""
        user, _ = user_with_workspace

        # Create a research + analysis for other_niche with overlapping patterns
        r2 = NicheResearch.objects.create(
            niche=other_niche, triggered_by=user,
            status=NicheResearch.Status.COMPLETED,
        )
        # Share IDENTITY DECLARATION + TRIBE/COMMUNITY (both active in fishing)
        other_patterns = [
            {'name': 'IDENTITY DECLARATION', 'present': True, 'context': 'Campers say "I am"'},
            {'name': 'GROUP LEADER', 'present': False, 'context': 'No leadership.'},
            {'name': 'TRIBE/COMMUNITY', 'present': True, 'context': 'Camp crew slogans.'},
            {'name': 'FUNNY ACTIVITY', 'present': False, 'context': 'No humor.'},
            {'name': 'CROSS-NICHE EVENTS', 'present': False, 'context': 'N/A'},
            {'name': 'CROSS-NICHE MASHUP', 'present': False, 'context': 'N/A'},
            {'name': 'ADDICTION/OBSESSION', 'present': False, 'context': 'N/A'},
            {'name': 'VINTAGE/LEGACY', 'present': False, 'context': 'N/A'},
            {'name': 'ACHIEVEMENT/GAMIFIED', 'present': False, 'context': 'N/A'},
            {'name': 'JOB/PROFESSION PARODY', 'present': False, 'context': 'N/A'},
            {'name': 'RELATIONSHIP HUMOR', 'present': False, 'context': 'N/A'},
            {'name': 'BOUNDARY/GATEKEEPING', 'present': False, 'context': 'N/A'},
            {'name': 'ENDURANCE/SURVIVAL', 'present': False, 'context': 'N/A'},
            {'name': 'COMPETENCE/EXPERTISE', 'present': False, 'context': 'N/A'},
            {'name': 'CHAOS/CONTROL', 'present': False, 'context': 'N/A'},
            {'name': 'SELF-CARE/PRIORITIES', 'present': False, 'context': 'N/A'},
        ]
        NicheAnalysis.objects.create(
            research=r2, niche=other_niche, pattern_analysis=other_patterns,
            sentiment='Positive', niche_summary='Camping niche.',
        )

        data = NicheResearchDetailSerializer(completed_research).data
        related = data['related_niches']
        assert len(related) == 1
        assert related[0]['name'] == 'Camping'
        assert 'IDENTITY DECLARATION' in related[0]['shared_patterns']
        assert 'TRIBE/COMMUNITY' in related[0]['shared_patterns']

    def test_fewer_than_2_shared_not_returned(self, completed_research, other_niche, user_with_workspace):
        """Only 1 shared active pattern -> not related."""
        user, _ = user_with_workspace
        r2 = NicheResearch.objects.create(
            niche=other_niche, triggered_by=user,
            status=NicheResearch.Status.COMPLETED,
        )
        # Only 1 shared pattern (IDENTITY DECLARATION)
        patterns = list(SAMPLE_PATTERN_ANALYSIS)
        # Set all to false except IDENTITY DECLARATION
        for p in patterns:
            p['present'] = (p['name'] == 'IDENTITY DECLARATION')
        NicheAnalysis.objects.create(
            research=r2, niche=other_niche, pattern_analysis=patterns,
            sentiment='Neutral', niche_summary='Camping niche.',
        )

        data = NicheResearchDetailSerializer(completed_research).data
        assert data['related_niches'] == []

    def test_different_workspace_not_related(
        self, completed_research, other_user_workspace, user_with_workspace,
    ):
        """Niches from different workspaces are never related."""
        other_user, other_ws = other_user_workspace
        other_niche = Niche.objects.create(
            workspace=other_ws, name='Hiking', created_by=other_user,
        )
        r2 = NicheResearch.objects.create(
            niche=other_niche, triggered_by=other_user,
            status=NicheResearch.Status.COMPLETED,
        )
        NicheAnalysis.objects.create(
            research=r2, niche=other_niche,
            pattern_analysis=SAMPLE_PATTERN_ANALYSIS,
            sentiment='Positive', niche_summary='Hiking niche.',
        )

        data = NicheResearchDetailSerializer(completed_research).data
        assert data['related_niches'] == []
