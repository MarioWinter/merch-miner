"""PROJ-29 Phase 1D Round 1D-1 — niche_chat_agent factory + 6 simple tools.

Covers:

- ``build_niche_chat_agent`` returns a compiled agent with recursion_limit=10.
- Cross-workspace niche_id raises ``Niche.DoesNotExist``.
- Per-request LLM (two builds -> two distinct LLM instances).
- Each of the 6 tools' happy paths (with mocked dependencies).
- ``search_slogans`` post-filter keeps approved/manual Ideas only.
- ``search_products`` does not bleed across workspaces.
- ``search_niche_knowledge`` subset mapping (single vs aggregate).
- ``bsr_stats`` over a real fixture niche (5 products).
- ``_with_timeout`` returns structured error when wrapped fn exceeds budget.
"""

from __future__ import annotations

import time
from unittest.mock import MagicMock, patch

import pytest


# ── Shared fixtures ─────────────────────────────────────────────────────────


@pytest.fixture
def User(db):
    from django.contrib.auth import get_user_model
    return get_user_model()


@pytest.fixture
def user_a(db, User):
    return User.objects.create_user(email='nca-a@test.com', password='pw')


@pytest.fixture
def user_b(db, User):
    return User.objects.create_user(email='nca-b@test.com', password='pw')


@pytest.fixture
def workspace_a(db, user_a):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='WS-A', slug='nca-ws-a', owner=user_a)


@pytest.fixture
def workspace_b(db, user_b):
    from workspace_app.models import Workspace
    return Workspace.objects.create(name='WS-B', slug='nca-ws-b', owner=user_b)


@pytest.fixture
def niche_a(db, workspace_a, user_a):
    from niche_app.models import Niche
    return Niche.objects.create(
        name='Fishing Humor', notes='', workspace=workspace_a,
        created_by=user_a,
    )


@pytest.fixture
def niche_b(db, workspace_b, user_b):
    from niche_app.models import Niche
    return Niche.objects.create(
        name='Hiking Humor', notes='', workspace=workspace_b,
        created_by=user_b,
    )


@pytest.fixture
def fake_llm():
    """Lightweight mock that satisfies ChatOpenAI duck-typing during agent build.

    create_react_agent calls ``model.bind_tools(...)`` -> Runnable; for these
    tests we never actually invoke the agent, just verify factory output.
    """
    llm = MagicMock(name='FakeLLM')
    llm.bind_tools = MagicMock(return_value=llm)
    return llm


@pytest.fixture
def patch_llm_factory(fake_llm):
    """Patch get_llm_for_node so factories don't need OpenRouter env vars.

    Returns the patcher so individual tests can inspect call counts.
    """
    with patch(
        'niche_research_app.graph.llm.get_llm_for_node',
        return_value=(fake_llm, 'SYSTEM'),
    ) as p:
        yield p


# ── Agent factory ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestAgentFactory:
    def test_build_returns_agent_with_recursion_limit(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        """Factory wires recursion_limit=10 via .with_config()."""
        from agent_app.agents.niche_chat_agent import build_niche_chat_agent

        agent = build_niche_chat_agent(
            workspace_a, niche_a.id, session_id='session-1',
        )
        config = getattr(agent, 'config', {}) or {}
        assert config.get('recursion_limit') == 10

    def test_cross_workspace_niche_raises(
        self, workspace_a, niche_b, patch_llm_factory,
    ):
        """Niche from workspace B must NOT be reachable from workspace A."""
        from agent_app.agents.niche_chat_agent import build_niche_chat_agent
        from niche_app.models import Niche

        with pytest.raises(Niche.DoesNotExist):
            build_niche_chat_agent(
                workspace_a, niche_b.id, session_id='session-x',
            )

    def test_llm_instantiated_per_build(
        self, workspace_a, niche_a,
    ):
        """Two builds -> two distinct LLM instances (AC-Ops-LG-3)."""
        from agent_app.agents.niche_chat_agent import build_niche_chat_agent

        llm1 = MagicMock(name='LLM-1')
        llm1.bind_tools = MagicMock(return_value=llm1)
        llm2 = MagicMock(name='LLM-2')
        llm2.bind_tools = MagicMock(return_value=llm2)

        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            side_effect=[(llm1, 'SYSTEM'), (llm2, 'SYSTEM')],
        ) as factory:
            build_niche_chat_agent(
                workspace_a, niche_a.id, session_id='s1',
            )
            build_niche_chat_agent(
                workspace_a, niche_a.id, session_id='s2',
            )

        assert factory.call_count == 2
        assert llm1 is not llm2


# ── _with_timeout helper ────────────────────────────────────────────────────


class TestWithTimeoutHelper:
    def test_returns_structured_error_on_timeout(self):
        from agent_app.agents.niche_chat_agent import _with_timeout

        def _slow() -> str:
            time.sleep(2)
            return 'too late'

        result = _with_timeout(_slow, timeout=1)
        assert isinstance(result, dict)
        assert result['error'] == 'tool_timeout'
        assert result['tool'] == '_slow'
        assert result['duration_ms'] == 1000

    def test_passes_through_value_on_success(self):
        from agent_app.agents.niche_chat_agent import _with_timeout

        def _fast(x: int) -> int:
            return x * 2

        assert _with_timeout(_fast, 21, timeout=5) == 42


# ── Tool: web_search ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestWebSearchTool:
    def test_happy_path_returns_up_to_8_results(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        # 10 fake sources -> tool must cap at 8.
        fake_sources = [
            {
                'title': f't{i}', 'url': f'https://example.com/{i}',
                'snippet': f's{i}',
            }
            for i in range(10)
        ]
        with patch(
            'search_app.services.vane_service.VaneService.search',
            return_value={'sources': fake_sources, 'answer': '', 'model_used': ''},
        ):
            tools = _build_tools(workspace_a, niche_a)
            web_search = next(t for t in tools if t.name == 'web_search')
            result = web_search.invoke({'query': 'fishing slogans'})

        assert isinstance(result, list)
        assert len(result) == 8
        assert all(set(r.keys()) == {'title', 'url', 'snippet'} for r in result)


# ── Tool: search_slogans ────────────────────────────────────────────────────


@pytest.mark.django_db(transaction=True)
class TestSearchSlogansTool:
    def _make_idea(self, workspace, niche, user, **kwargs):
        from idea_app.models import Idea
        defaults = {
            'workspace': workspace,
            'niche': niche,
            'slogan_text': 'tight lines and good vibes',
            'created_by': user,
            'is_manual': False,
            'status': Idea.Status.PENDING,
        }
        defaults.update(kwargs)
        return Idea.objects.create(**defaults)

    def test_keeps_approved_and_manual_drops_rejected(
        self, workspace_a, niche_a, user_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools
        from idea_app.models import Idea

        approved = self._make_idea(
            workspace_a, niche_a, user_a, status=Idea.Status.APPROVED,
        )
        manual = self._make_idea(
            workspace_a, niche_a, user_a, is_manual=True,
            status=Idea.Status.PENDING,
        )
        rejected = self._make_idea(
            workspace_a, niche_a, user_a, status=Idea.Status.REJECTED,
        )

        # Hybrid-search stub returns all three; post-filter drops rejected.
        hits = [
            {'source_pk': str(approved.pk), 'text': '', 'score': 0.9,
             'content_subtype': 'slogan', 'metadata': {}},
            {'source_pk': str(manual.pk), 'text': '', 'score': 0.8,
             'content_subtype': 'slogan', 'metadata': {}},
            {'source_pk': str(rejected.pk), 'text': '', 'score': 0.7,
             'content_subtype': 'slogan', 'metadata': {}},
        ]
        with patch(
            'vector_app.services.EmbeddingService.hybrid_search',
            return_value=hits,
        ):
            tools = _build_tools(workspace_a, niche_a)
            search_slogans = next(
                t for t in tools if t.name == 'search_slogans'
            )
            result = search_slogans.invoke({'query': 'tight lines'})

        kept_pks = {r['source_pk'] for r in result}
        assert str(approved.pk) in kept_pks
        assert str(manual.pk) in kept_pks
        assert str(rejected.pk) not in kept_pks

    def test_empty_hits_returns_empty(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        with patch(
            'vector_app.services.EmbeddingService.hybrid_search',
            return_value=[],
        ):
            tools = _build_tools(workspace_a, niche_a)
            search_slogans = next(
                t for t in tools if t.name == 'search_slogans'
            )
            assert search_slogans.invoke({'query': 'nothing'}) == []


# ── Tool: search_products ───────────────────────────────────────────────────


@pytest.mark.django_db(transaction=True)
class TestSearchProductsTool:
    def _make_product_for_niche(self, workspace, niche, user, asin: str):
        from niche_app.models import CollectedProduct
        from scraper_app.models import AmazonProduct
        product = AmazonProduct.objects.create(
            asin=asin,
            title=f'Product {asin}',
            product_url=f'https://amazon.com/dp/{asin}',
            marketplace='amazon_com',
        )
        CollectedProduct.objects.create(
            niche=niche, product=product,
        )
        return product

    def test_filters_to_only_niche_collected_products(
        self, workspace_a, workspace_b, niche_a, niche_b, user_a, user_b,
        patch_llm_factory,
    ):
        """A product collected in niche B must NOT surface when searching niche A."""
        from agent_app.agents.niche_chat_agent import _build_tools

        product_a = self._make_product_for_niche(
            workspace_a, niche_a, user_a, asin='B0AAAA0001',
        )
        product_b = self._make_product_for_niche(
            workspace_b, niche_b, user_b, asin='B0BBBB0001',
        )

        captured: dict = {}

        def _capturing_hybrid_search(*, workspace, query, filters, top_k):
            captured['filters'] = filters
            return []

        with patch(
            'vector_app.services.EmbeddingService.hybrid_search',
            side_effect=_capturing_hybrid_search,
        ):
            tools = _build_tools(workspace_a, niche_a)
            search_products = next(
                t for t in tools if t.name == 'search_products'
            )
            search_products.invoke({'query': 'tee'})

        # The filter must list ONLY product_a's id, not product_b's.
        object_id_in = captured['filters']['object_id__in']
        assert str(product_a.pk) in object_id_in
        assert str(product_b.pk) not in object_id_in

    def test_empty_niche_returns_empty_without_query(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        # No collected products -> tool must short-circuit, NOT call hybrid_search.
        with patch(
            'vector_app.services.EmbeddingService.hybrid_search',
        ) as mock_search:
            tools = _build_tools(workspace_a, niche_a)
            search_products = next(
                t for t in tools if t.name == 'search_products'
            )
            result = search_products.invoke({'query': 'tee'})

        assert result == []
        mock_search.assert_not_called()


# ── Tool: search_niche_knowledge ────────────────────────────────────────────


@pytest.mark.django_db
class TestSearchNicheKnowledgeTool:
    def test_subset_profile_passes_single_subtype(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        captured: dict = {}

        def _capture(*, workspace, query, filters, top_k, content_subtypes):
            captured['content_subtypes'] = content_subtypes
            return []

        with patch(
            'vector_app.services.EmbeddingService.hybrid_search',
            side_effect=_capture,
        ):
            tools = _build_tools(workspace_a, niche_a)
            knowledge = next(
                t for t in tools if t.name == 'search_niche_knowledge'
            )
            knowledge.invoke({'query': 'audience', 'subset': 'profile'})

        assert captured['content_subtypes'] == ['analysis']

    def test_subset_none_aggregates_all_five(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        captured: dict = {}

        def _capture(*, workspace, query, filters, top_k, content_subtypes):
            captured['content_subtypes'] = content_subtypes
            return []

        with patch(
            'vector_app.services.EmbeddingService.hybrid_search',
            side_effect=_capture,
        ):
            tools = _build_tools(workspace_a, niche_a)
            knowledge = next(
                t for t in tools if t.name == 'search_niche_knowledge'
            )
            knowledge.invoke({'query': 'anything'})

        assert set(captured['content_subtypes']) == {
            'analysis', 'emotional', 'vision', 'keyword_analysis', 'notes',
        }

    def test_invalid_subset_returns_error_dict(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        with patch(
            'vector_app.services.EmbeddingService.hybrid_search',
        ) as mock_search:
            tools = _build_tools(workspace_a, niche_a)
            knowledge = next(
                t for t in tools if t.name == 'search_niche_knowledge'
            )
            result = knowledge.invoke({'query': 'x', 'subset': 'bogus'})

        assert isinstance(result, dict)
        assert result['error'] == 'invalid_subset'
        mock_search.assert_not_called()


# ── Tool: top_keywords ──────────────────────────────────────────────────────


@pytest.mark.django_db
class TestTopKeywordsTool:
    def test_returns_keyword_search_volume_source(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        kw1 = MagicMock(
            keyword='fishing', search_volume=12_345, source='junglescout',
        )
        kw2 = MagicMock(
            keyword='trout', search_volume=None, source='research',
        )
        with patch(
            'keyword_app.services.ranking.rank_niche_keywords',
            return_value=[kw1, kw2],
        ):
            tools = _build_tools(workspace_a, niche_a)
            top_keywords = next(t for t in tools if t.name == 'top_keywords')
            result = top_keywords.invoke({'limit': 5})

        assert result == [
            {'keyword': 'fishing', 'search_volume': 12_345,
             'source': 'junglescout'},
            {'keyword': 'trout', 'search_volume': None, 'source': 'research'},
        ]


# ── Tool: bsr_stats ─────────────────────────────────────────────────────────


@pytest.mark.django_db(transaction=True)
class TestBSRStatsTool:
    def _seed_niche_with_bsrs(
        self, workspace, niche, user, bsrs: list[int],
    ):
        from niche_app.models import CollectedProduct
        from scraper_app.models import AmazonProduct
        for i, bsr in enumerate(bsrs):
            asin = f'B0BSR{i:05d}'
            product = AmazonProduct.objects.create(
                asin=asin, title=f'P{i}',
                product_url=f'https://amazon.com/dp/{asin}',
                marketplace='amazon_com',
                bsr=bsr,
            )
            CollectedProduct.objects.create(niche=niche, product=product)

    def test_returns_percentiles_for_known_dataset(
        self, workspace_a, niche_a, user_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        self._seed_niche_with_bsrs(
            workspace_a, niche_a, user_a, [100, 200, 300, 400, 500],
        )
        tools = _build_tools(workspace_a, niche_a)
        bsr_stats = next(t for t in tools if t.name == 'bsr_stats')
        result = bsr_stats.invoke({})

        assert result['count'] == 5
        assert result['min'] == 100
        assert result['max'] == 500
        # Postgres PERCENTILE_CONT(0.5) of {100,200,300,400,500} = 300.0
        assert result['median'] == pytest.approx(300.0)
        assert result['p25'] == pytest.approx(200.0)
        assert result['p75'] == pytest.approx(400.0)

    def test_empty_niche_returns_zero_count_and_nulls(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        tools = _build_tools(workspace_a, niche_a)
        bsr_stats = next(t for t in tools if t.name == 'bsr_stats')
        result = bsr_stats.invoke({})

        assert result == {
            'min': None, 'max': None,
            'p25': None, 'median': None, 'p75': None,
            'count': 0,
        }


# ── Tool: generate_slogans (Round 1D-2) ────────────────────────────────────


def _make_valid_slogan(**overrides):
    """Helper: a fully-valid raw LLM slogan dict."""
    base = {
        'slogan_text': 'Tight Lines and Good Vibes',
        'signal_type': 'self',
        'pattern_used': 'IDENTITY_DECLARATION',
        'stylistic_device': 'DECLARATION',
        'emotional_archetype': ['Hero'],
        'creative_modules_used': ['This Is My (X) Shirt', 'I'],
        'buyer_voice_pattern': "I'm an angler. This shirt brags about my hobby.",
        'why_it_works': 'Insider terminology + IDENTITY pattern.',
        'market_confidence': 'High',
    }
    base.update(overrides)
    return base


def _mock_creative_llm(json_content: str):
    """Return a (llm_mock, captured) pair for the creative_techniques LLM."""
    llm = MagicMock(name='CreativeLLM')
    llm.invoke = MagicMock(return_value=MagicMock(content=json_content))
    return llm


@pytest.mark.django_db
class TestGenerateSlogansTool:
    def _get_tool(self, workspace, niche):
        from agent_app.agents.niche_chat_agent import _build_tools
        tools = _build_tools(workspace, niche)
        return next(t for t in tools if t.name == 'generate_slogans')

    def test_happy_path_returns_10_valid_slogans(
        self, workspace_a, niche_a,
    ):
        """LLM returns 10 valid slogans -> tool returns all 10 with Idea-shaped keys."""
        import json

        slogans = [
            _make_valid_slogan(slogan_text=f"Slogan {i}", signal_type=(
                'self' if i % 2 == 0 else 'other'
            ))
            for i in range(10)
        ]
        json_content = json.dumps({'slogans': slogans, 'warnings': []})

        fake_llm = _mock_creative_llm(json_content)
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED_PROMPT',
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({'count': 10})

        from idea_app.models import Idea
        valid_patterns = {c.value for c in Idea.PatternUsed}

        assert isinstance(result, dict)
        assert set(result.keys()) == {'slogans', 'warnings'}
        assert len(result['slogans']) == 10
        # Every cleaned slogan exposes the full 9-key Idea-shaped payload.
        expected_keys = {
            'slogan_text', 'signal_type', 'pattern_used', 'stylistic_device',
            'emotional_archetype', 'creative_modules_used',
            'buyer_voice_pattern', 'why_it_works', 'market_confidence',
        }
        for s in result['slogans']:
            assert set(s.keys()) == expected_keys
            assert s['signal_type'] in {'self', 'other'}
            assert s['pattern_used'] in valid_patterns
            assert s['market_confidence'] in {'High', 'Medium', 'Low'}
            assert isinstance(s['emotional_archetype'], list)

    def test_malformed_slogan_routed_to_warnings(
        self, workspace_a, niche_a,
    ):
        """Slogan missing slogan_text -> excluded from output + appended to warnings."""
        import json

        valid = _make_valid_slogan()
        malformed = _make_valid_slogan(slogan_text='')  # hard reject
        payload = {'slogans': [valid, malformed], 'warnings': []}
        fake_llm = _mock_creative_llm(json.dumps(payload))
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED_PROMPT',
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({'count': 2})

        assert len(result['slogans']) == 1
        assert any('rejected malformed' in w for w in result['warnings'])

    def test_markdown_fenced_json_still_parses(
        self, workspace_a, niche_a,
    ):
        """LLM returns ```json ... ``` -> tool strips fences and parses."""
        import json

        body = json.dumps({'slogans': [_make_valid_slogan()], 'warnings': []})
        fenced = f"```json\n{body}\n```"
        fake_llm = _mock_creative_llm(fenced)
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED_PROMPT',
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({'count': 1})

        assert len(result['slogans']) == 1
        assert result['slogans'][0]['slogan_text'] == 'Tight Lines and Good Vibes'

    def test_non_json_returns_warning(
        self, workspace_a, niche_a,
    ):
        """Pure prose response -> empty slogans + dedicated warning."""
        fake_llm = _mock_creative_llm("I'm sorry, I can't help with that.")
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED_PROMPT',
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({'count': 5})

        assert result == {
            'slogans': [],
            'warnings': ['LLM returned non-JSON; try again'],
        }

    def test_invalid_pattern_used_cleaned_to_empty(
        self, workspace_a, niche_a,
    ):
        """LLM returns a pattern not in the 16-enum -> cleaned to ''."""
        import json

        bad_pattern = _make_valid_slogan(pattern_used='TOTALLY_MADE_UP')
        payload = {'slogans': [bad_pattern], 'warnings': []}
        fake_llm = _mock_creative_llm(json.dumps(payload))
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            return_value='RENDERED_PROMPT',
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({'count': 1})

        assert len(result['slogans']) == 1
        assert result['slogans'][0]['pattern_used'] == ''

    def test_marketplace_language_derived_for_german_niche(
        self, workspace_a, niche_a,
    ):
        """When derive_marketplace returns amazon_de -> prompt receives 'de'.

        We stub ``derive_marketplace`` directly because the production code
        runs the tool inside a thread-pool worker (see ``_with_timeout``);
        that thread has its own DB connection and would not see test-fixture
        rows committed under the test transaction.
        """
        import json

        captured: dict = {}

        def _capture_kwargs(node_name, **kwargs):
            captured['node_name'] = node_name
            captured['kwargs'] = kwargs
            return 'RENDERED_PROMPT'

        fake_llm = _mock_creative_llm(
            json.dumps({'slogans': [_make_valid_slogan()], 'warnings': []}),
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ), patch(
            'chat_node_config_app.services.resolver.get_chat_prompt',
            side_effect=_capture_kwargs,
        ), patch(
            'niche_app.services.derive_marketplace',
            return_value='amazon_de',
        ):
            tool = self._get_tool(workspace_a, niche_a)
            tool.invoke({'count': 1})

        assert captured['node_name'] == 'creative_techniques'
        assert captured['kwargs']['marketplace_language'] == 'de'
        assert captured['kwargs']['niche_name'] == niche_a.name


# ── _validate_slogan_payload unit (no LLM, no DB) ──────────────────────────


class TestValidateSloganPayload:
    def _enums(self):
        from idea_app.models import (
            ALLOWED_EMOTIONAL_ARCHETYPES, Idea,
        )
        return (
            {c.value for c in Idea.PatternUsed},
            {c.value for c in Idea.StylisticDevice},
            set(ALLOWED_EMOTIONAL_ARCHETYPES),
            {'High', 'Medium', 'Low'},
        )

    def test_hard_reject_when_signal_type_invalid(self):
        from agent_app.agents.niche_chat_agent import _validate_slogan_payload

        patterns, devices, archetypes, confidence = self._enums()
        raw = _make_valid_slogan(signal_type='neutral')
        assert _validate_slogan_payload(
            raw, patterns, devices, archetypes, confidence,
        ) is None

    def test_unknown_device_falls_back_to_free_form(self):
        from agent_app.agents.niche_chat_agent import _validate_slogan_payload

        patterns, devices, archetypes, confidence = self._enums()
        raw = _make_valid_slogan(stylistic_device='HAIKU')
        cleaned = _validate_slogan_payload(
            raw, patterns, devices, archetypes, confidence,
        )
        assert cleaned is not None
        assert cleaned['stylistic_device'] == 'FREE_FORM'


# ── Tool: brainstorm_ideas (Round 1D-2) ────────────────────────────────────


@pytest.mark.django_db
class TestBrainstormIdeasTool:
    def _get_tool(self, workspace, niche):
        from agent_app.agents.niche_chat_agent import _build_tools
        tools = _build_tools(workspace, niche)
        return next(t for t in tools if t.name == 'brainstorm_ideas')

    def test_happy_path_returns_5_directions(
        self, workspace_a, niche_a,
    ):
        import json
        directions = [
            {
                'direction_title': f"Direction {i}",
                'pattern': 'IDENTITY DECLARATION',
                'circle_layer': 'I',
                'rationale': 'Plays on insider pride.',
                'example_slogan_seed': 'I am the X',
            }
            for i in range(5)
        ]
        fake_llm = MagicMock()
        fake_llm.invoke = MagicMock(
            return_value=MagicMock(content=json.dumps({'directions': directions})),
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({})

        assert isinstance(result, dict)
        assert len(result['directions']) == 5
        expected_keys = {
            'direction_title', 'pattern', 'circle_layer',
            'rationale', 'example_slogan_seed',
        }
        for d in result['directions']:
            assert set(d.keys()) == expected_keys
            # Display form 'IDENTITY DECLARATION' must normalize to enum key.
            assert d['pattern'] == 'IDENTITY_DECLARATION'

    def test_empty_title_filtered_out(
        self, workspace_a, niche_a,
    ):
        import json
        directions = [
            {'direction_title': '', 'pattern': 'GROUP_LEADER',
             'circle_layer': '', 'rationale': '', 'example_slogan_seed': ''},
            {'direction_title': 'Keep me', 'pattern': 'GROUP_LEADER',
             'circle_layer': '', 'rationale': '', 'example_slogan_seed': ''},
        ]
        fake_llm = MagicMock()
        fake_llm.invoke = MagicMock(
            return_value=MagicMock(content=json.dumps({'directions': directions})),
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({})

        titles = [d['direction_title'] for d in result['directions']]
        assert titles == ['Keep me']

    def test_unknown_pattern_and_circle_cleaned(
        self, workspace_a, niche_a,
    ):
        import json
        directions = [{
            'direction_title': 'X',
            'pattern': 'BOGUS_PATTERN',
            'circle_layer': 'Z',
            'rationale': '',
            'example_slogan_seed': '',
        }]
        fake_llm = MagicMock()
        fake_llm.invoke = MagicMock(
            return_value=MagicMock(content=json.dumps({'directions': directions})),
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({})

        assert len(result['directions']) == 1
        assert result['directions'][0]['pattern'] == ''
        assert result['directions'][0]['circle_layer'] == ''

    def test_caps_at_10_directions(
        self, workspace_a, niche_a,
    ):
        import json
        directions = [
            {
                'direction_title': f"D{i}",
                'pattern': 'GROUP_LEADER',
                'circle_layer': '',
                'rationale': '',
                'example_slogan_seed': '',
            }
            for i in range(15)
        ]
        fake_llm = MagicMock()
        fake_llm.invoke = MagicMock(
            return_value=MagicMock(content=json.dumps({'directions': directions})),
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({})

        assert len(result['directions']) == 10

    def test_non_json_returns_empty_directions(
        self, workspace_a, niche_a,
    ):
        fake_llm = MagicMock()
        fake_llm.invoke = MagicMock(
            return_value=MagicMock(content='Sorry, no can do.'),
        )
        with patch(
            'niche_research_app.graph.llm.get_llm_for_node',
            return_value=(fake_llm, 'SYSTEM'),
        ):
            tool = self._get_tool(workspace_a, niche_a)
            result = tool.invoke({})

        assert result == {'directions': []}


# ── _build_tools wiring (Round 1D-2) ───────────────────────────────────────


@pytest.mark.django_db
class TestToolsWiring:
    def test_build_tools_returns_9_tools_including_cross_niche(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        tools = _build_tools(workspace_a, niche_a)
        # PROJ-29 cross-niche: list_workspace_niches added to the 8 existing
        # tools so the agent can resolve niche names → ids before calling
        # search_* with a cross-niche `niche_id` arg.
        assert len(tools) == 9
        names = {t.name for t in tools}
        assert 'generate_slogans' in names
        assert 'brainstorm_ideas' in names
        assert 'list_workspace_niches' in names


# ── Cross-niche workspace isolation ─────────────────────────────────────────


@pytest.mark.django_db(transaction=True)
class TestCrossNicheWorkspaceIsolation:
    """PROJ-29 cross-niche AC: an LLM-supplied niche_id MUST NOT escape the
    bound workspace. Even with a correct UUID for a niche in another workspace,
    every cross-niche tool must return `{error: ...}` without leaking data.
    """

    def test_list_workspace_niches_excludes_other_workspace(
        self, workspace_a, workspace_b, niche_a, niche_b, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        tools = _build_tools(workspace_a, niche_a)
        lister = next(t for t in tools if t.name == 'list_workspace_niches')
        result = lister.invoke({})

        ids = {n['id'] for n in result}
        assert str(niche_a.id) in ids
        assert str(niche_b.id) not in ids  # cross-workspace niche NEVER listed

    def test_search_slogans_rejects_cross_workspace_niche_id(
        self, workspace_a, workspace_b, niche_a, niche_b, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        tools = _build_tools(workspace_a, niche_a)
        searcher = next(t for t in tools if t.name == 'search_slogans')
        # Pass niche_b's UUID — belongs to workspace_b, not workspace_a.
        result = searcher.invoke({
            'query': 'anything', 'niche_id': str(niche_b.id),
        })

        assert isinstance(result, dict), result
        assert 'error' in result
        assert 'not found in this workspace' in result['error']
        # Error message must NOT confirm the niche exists in another workspace.
        assert 'workspace_b' not in result['error'].lower()
        assert 'hiking' not in result['error'].lower()

    def test_search_niche_knowledge_rejects_cross_workspace(
        self, workspace_a, workspace_b, niche_a, niche_b, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        tools = _build_tools(workspace_a, niche_a)
        searcher = next(t for t in tools if t.name == 'search_niche_knowledge')
        result = searcher.invoke({
            'query': 'anything', 'niche_id': str(niche_b.id),
        })

        assert isinstance(result, dict)
        assert 'error' in result

    def test_top_keywords_rejects_cross_workspace(
        self, workspace_a, workspace_b, niche_a, niche_b, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        tools = _build_tools(workspace_a, niche_a)
        searcher = next(t for t in tools if t.name == 'top_keywords')
        result = searcher.invoke({'niche_id': str(niche_b.id)})

        assert isinstance(result, dict)
        assert 'error' in result

    def test_search_slogans_accepts_same_workspace_niche_id(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        """Passing the pinned niche's own id explicitly is a no-op (fast path)."""
        from agent_app.agents.niche_chat_agent import _build_tools

        tools = _build_tools(workspace_a, niche_a)
        searcher = next(t for t in tools if t.name == 'search_slogans')
        result = searcher.invoke({
            'query': 'anything', 'niche_id': str(niche_a.id),
        })
        # Should NOT return an error — list (possibly empty) is fine.
        assert isinstance(result, list), result

    def test_search_slogans_rejects_malformed_niche_id(
        self, workspace_a, niche_a, patch_llm_factory,
    ):
        from agent_app.agents.niche_chat_agent import _build_tools

        tools = _build_tools(workspace_a, niche_a)
        searcher = next(t for t in tools if t.name == 'search_slogans')
        result = searcher.invoke({
            'query': 'anything', 'niche_id': "'; DROP TABLE niche_app_niche; --",
        })

        assert isinstance(result, dict)
        assert 'error' in result
        # Confirm Django ORM parameter binding handled the SQL injection
        # attempt safely — the message just says "not found".
        assert 'not found in this workspace' in result['error']
