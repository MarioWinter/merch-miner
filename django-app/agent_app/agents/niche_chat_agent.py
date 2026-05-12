"""PROJ-29 Phase 1D — Niche Chat Agent (Round 1D-1).

Factory + 6 simple tools for the niche-bound chat agent. Mirrors the
``reflection_agent.py`` / ``skill_refiner_agent.py`` pattern.

Round 1D-1 scope (this module):

- Agent factory ``build_niche_chat_agent(workspace, niche_id, session_id)``
- 6 tools (workspace + niche captured via closure, never LLM-supplied):
  ``web_search``, ``search_slogans``, ``search_products``,
  ``search_niche_knowledge``, ``top_keywords``, ``bsr_stats``.
- 30s timeout wrapper (``_with_timeout``) — ThreadPoolExecutor-based
  to stay sync-friendly per existing tool patterns.
- Per-request LLM (AC-Ops-LG-3) — instantiated inside ``build_niche_chat_agent``,
  NOT module-level.
- ``recursion_limit=10`` hard cap (AC-Ops-LG-1) via ``.with_config()``.

Round 1D-2 (separate module pass): ``generate_slogans`` + ``brainstorm_ideas``.
Round 1D-3 (separate module pass): conversation_summarizer + follow_up_suggester
+ prompt_assembler.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from typing import Any, Callable, Optional

from django.db.models import (
    Aggregate,
    Count,
    FloatField,
    Max,
    Min,
)
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent

logger = logging.getLogger(__name__)

AGENT_TYPE = 'niche_chat'

# AC-Ops-LG-2 — hard 30s wall-clock cap per tool call.
TOOL_TIMEOUT_SECONDS = 30

# AC-Ops-LG-1 — LangGraph recursion kill-switch.
RECURSION_LIMIT = 10

# Subset → content_subtypes map for ``search_niche_knowledge``.
SUBSET_TO_SUBTYPES: dict[Optional[str], list[str]] = {
    'profile': ['analysis'],
    'emotional': ['emotional'],
    'vision': ['vision'],
    'keyword_analysis': ['keyword_analysis'],
    'notes': ['notes'],
    None: ['analysis', 'emotional', 'vision', 'keyword_analysis', 'notes'],
}


class PercentileCont(Aggregate):
    """Postgres ``PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY expr)`` aggregate.

    Used by ``bsr_stats`` for p25 / median / p75 over CollectedProduct.bsr.
    """

    function = 'PERCENTILE_CONT'
    name = 'percentile_cont'
    output_field = FloatField()
    template = (
        '%(function)s(%(percentile)s) WITHIN GROUP (ORDER BY %(expressions)s)'
    )


def _with_timeout(
    fn: Callable[..., Any],
    *args: Any,
    timeout: int = TOOL_TIMEOUT_SECONDS,
    **kwargs: Any,
) -> Any:
    """Run ``fn`` in a worker thread; cancel after ``timeout`` seconds.

    Returns ``{'error': 'tool_timeout', 'tool': <name>, 'duration_ms': N}``
    on timeout instead of raising — so the agent sees a structured error
    and continues. Non-timeout exceptions propagate unchanged.
    """
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(fn, *args, **kwargs)
        try:
            return future.result(timeout=timeout)
        except FuturesTimeout:
            tool_name = getattr(fn, '__name__', 'unknown')
            future.cancel()
            return {
                'error': 'tool_timeout',
                'tool': tool_name,
                'duration_ms': timeout * 1000,
            }


def _render_tool_descriptions(tools: list[Any]) -> str:
    """Multi-line description block for the ``{tool_descriptions}`` placeholder.

    Each line: ``- <name>(<args>): <description>``. We pull ``description``
    from LangChain ``BaseTool.description`` (rendered from the @tool docstring).
    """
    lines: list[str] = []
    for t in tools:
        name = getattr(t, 'name', getattr(t, '__name__', '<tool>'))
        desc = getattr(t, 'description', '').strip().split('\n', 1)[0]
        lines.append(f"- {name}: {desc}")
    return '\n'.join(lines)


def _build_tools(workspace, niche) -> list:
    """Construct the 6 tools bound to ``(workspace, niche)`` via closure.

    Workspace + niche are NEVER exposed as LLM-supplied parameters — they
    are captured here at agent build time, so the LLM cannot cross-pollinate
    workspaces (AC-13).
    """
    # ── web_search ──────────────────────────────────────────────────────
    @tool('web_search')
    def web_search(query: str) -> list[dict]:
        """Live web search via Vane (Perplexica). Returns up to 8 results
        each shaped as ``{title, url, snippet}``."""
        from search_app.services.vane_service import VaneService

        def _run() -> list[dict]:
            service = VaneService()
            resp = service.search(query=query)
            sources = (resp or {}).get('sources') or []
            return [
                {
                    'title': s.get('title', ''),
                    'url': s.get('url', ''),
                    'snippet': s.get('snippet', ''),
                }
                for s in sources[:8]
            ]

        return _with_timeout(_run)

    # ── search_slogans ──────────────────────────────────────────────────
    @tool('search_slogans')
    def search_slogans(query: str) -> list[dict]:
        """Hybrid search over slogan embeddings for the current niche. Returns
        approved or manually-created Ideas only. Up to 10 results."""
        from idea_app.models import Idea
        from vector_app.services import EmbeddingService

        def _run() -> list[dict]:
            service = EmbeddingService()
            hits = service.hybrid_search(
                workspace=workspace,
                query=query,
                filters={
                    'metadata__niche_id': str(niche.id),
                    'metadata__content_subtype': 'slogan',
                },
                top_k=10,
            )
            if not hits:
                return []
            # Post-filter: keep only approved OR manual Ideas (single OR query).
            from django.db.models import Q
            source_pks = [h['source_pk'] for h in hits if h.get('source_pk')]
            allowed = set(
                str(pk) for pk in Idea.objects.filter(
                    pk__in=source_pks,
                ).filter(
                    Q(is_manual=True) | Q(status=Idea.Status.APPROVED),
                ).values_list('pk', flat=True)
            )
            return [h for h in hits if h.get('source_pk') in allowed]

        return _with_timeout(_run)

    # ── search_products ─────────────────────────────────────────────────
    @tool('search_products')
    def search_products(query: str) -> list[dict]:
        """Hybrid search over Amazon products *collected for this niche*.
        Up to 10 results."""
        from niche_app.models import CollectedProduct
        from vector_app.services import EmbeddingService

        def _run() -> list[dict]:
            allowed_product_ids = list(
                CollectedProduct.objects.filter(niche=niche)
                .values_list('product_id', flat=True)
            )
            if not allowed_product_ids:
                return []
            service = EmbeddingService()
            hits = service.hybrid_search(
                workspace=workspace,
                query=query,
                filters={
                    'metadata__content_subtype': 'product',
                    'object_id__in': [str(pk) for pk in allowed_product_ids],
                },
                top_k=10,
            )
            return hits

        return _with_timeout(_run)

    # ── search_niche_knowledge ──────────────────────────────────────────
    @tool('search_niche_knowledge')
    def search_niche_knowledge(
        query: str, subset: Optional[str] = None,
    ) -> list[dict]:
        """Hybrid search over the niche's stored knowledge (profile,
        emotional, vision, keyword_analysis, notes). Use ``subset`` to
        restrict to one subtype (defaults to all 5)."""
        from vector_app.services import EmbeddingService

        def _run() -> list[dict]:
            if subset is not None and subset not in SUBSET_TO_SUBTYPES:
                return {
                    'error': 'invalid_subset',
                    'subset': subset,
                    'allowed': sorted(
                        k for k in SUBSET_TO_SUBTYPES if k is not None
                    ),
                }
            subtypes = SUBSET_TO_SUBTYPES[subset]
            service = EmbeddingService()
            return service.hybrid_search(
                workspace=workspace,
                query=query,
                filters={'metadata__niche_id': str(niche.id)},
                content_subtypes=subtypes,
                top_k=10,
            )

        return _with_timeout(_run)

    # ── top_keywords ────────────────────────────────────────────────────
    @tool('top_keywords')
    def top_keywords(limit: int = 20) -> list[dict]:
        """Top keywords for this niche, ranked by JungleScout search volume
        when available (falls back to manual position)."""
        from keyword_app.services.ranking import rank_niche_keywords

        def _run() -> list[dict]:
            capped = max(1, min(int(limit), 100))
            rows = rank_niche_keywords(niche, limit=capped)
            return [
                {
                    'keyword': kw.keyword,
                    'search_volume': getattr(kw, 'search_volume', None),
                    'source': kw.source,
                }
                for kw in rows
            ]

        return _with_timeout(_run)

    # ── bsr_stats ───────────────────────────────────────────────────────
    @tool('bsr_stats')
    def bsr_stats() -> dict:
        """BSR (Best Sellers Rank) percentiles over products collected for
        this niche. Returns ``{min, max, p25, median, p75, count}`` — values
        are ``None`` when no products are collected."""
        from niche_app.models import CollectedProduct

        def _run() -> dict:
            stats = CollectedProduct.objects.filter(niche=niche).aggregate(
                min=Min('product__bsr'),
                max=Max('product__bsr'),
                p25=PercentileCont('product__bsr', percentile=0.25),
                median=PercentileCont('product__bsr', percentile=0.5),
                p75=PercentileCont('product__bsr', percentile=0.75),
                count=Count('id'),
            )
            # Ensure consistent shape for empty niches.
            return {
                'min': stats.get('min'),
                'max': stats.get('max'),
                'p25': stats.get('p25'),
                'median': stats.get('median'),
                'p75': stats.get('p75'),
                'count': stats.get('count') or 0,
            }

        return _with_timeout(_run)

    return [
        web_search,
        search_slogans,
        search_products,
        search_niche_knowledge,
        top_keywords,
        bsr_stats,
    ]


def build_niche_chat_agent(workspace, niche_id, session_id: str):
    """Compile the niche-chat ReAct agent for one user turn.

    Per-request LLM (AC-Ops-LG-3) — instantiated here, not at module level,
    so two concurrent requests get isolated client state.

    ``niche_id`` is validated against the workspace inside this function
    (``Niche.objects.get(workspace=workspace, id=niche_id)``) — cross-workspace
    access raises ``Niche.DoesNotExist`` and propagates to the view layer.
    """
    # Lazy imports — avoid app-loading cycles and keep test-time light.
    from chat_node_config_app.services.resolver import (
        get_chat_prompt, get_node_config,
    )
    from niche_app.models import Niche
    from niche_app.services import derive_marketplace, marketplace_to_language
    from niche_research_app.graph.llm import get_llm_for_node

    niche = Niche.objects.get(workspace=workspace, id=niche_id)

    tools = _build_tools(workspace, niche)

    # AC-Ops-LG-3 — per-request LLM, NOT a module-level singleton.
    llm, _ = get_llm_for_node('agent_react', config_resolver=get_node_config)

    marketplace = derive_marketplace(niche)
    marketplace_language = marketplace_to_language(marketplace)
    rendered_prompt = get_chat_prompt(
        'agent_react',
        niche_name=niche.name,
        user_language='en',
        marketplace_language=marketplace_language,
        conversation_summary='(none)',
        tool_descriptions=_render_tool_descriptions(tools),
    )

    agent = create_react_agent(
        model=llm,
        tools=tools,
        prompt=rendered_prompt,
    )
    # AC-Ops-LG-1 — hard recursion cap. The soft 5-iteration cap is enforced
    # at the prompt level in `_default_prompts.agent_react`.
    return agent.with_config({'recursion_limit': RECURSION_LIMIT})


__all__ = [
    'AGENT_TYPE',
    'PercentileCont',
    'RECURSION_LIMIT',
    'SUBSET_TO_SUBTYPES',
    'TOOL_TIMEOUT_SECONDS',
    'build_niche_chat_agent',
]
