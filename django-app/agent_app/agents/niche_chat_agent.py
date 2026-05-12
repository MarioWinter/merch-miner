"""PROJ-29 Phase 1D — Niche Chat Agent (Rounds 1D-1 + 1D-2).

Factory + 8 tools for the niche-bound chat agent. Mirrors the
``reflection_agent.py`` / ``skill_refiner_agent.py`` pattern.

Round 1D-1 scope:

- Agent factory ``build_niche_chat_agent(workspace, niche_id, session_id)``
- 6 simple tools (workspace + niche captured via closure, never LLM-supplied):
  ``web_search``, ``search_slogans``, ``search_products``,
  ``search_niche_knowledge``, ``top_keywords``, ``bsr_stats``.
- 30s timeout wrapper (``_with_timeout``) — ThreadPoolExecutor-based
  to stay sync-friendly per existing tool patterns.
- Per-request LLM (AC-Ops-LG-3) — instantiated inside ``build_niche_chat_agent``,
  NOT module-level.
- ``recursion_limit=10`` hard cap (AC-Ops-LG-1) via ``.with_config()``.

Round 1D-2 scope (this round):

- 2 LLM-heavy tools: ``generate_slogans`` + ``brainstorm_ideas``.
- ``generate_slogans`` uses the ``creative_techniques`` ChatNodeConfig prompt
  and validates each LLM-returned slogan against ``Idea`` model enums.
- ``brainstorm_ideas`` composes ``top_keywords`` + ``bsr_stats`` + recent
  slogans + niche analysis into a one-off prompt and returns 5-10 concept
  directions tagged with the 16 canonical patterns + (optional) CIRCLE layer.

Round 1D-3 scope (this round):

- ``_with_langfuse_span`` decorator wrapping all 8 tools (AC-Ops-Obs-1):
  best-effort Langfuse v4 span emission with a documented ``logger.info``
  fallback when credentials are missing OR the sync wrap is awkward.
- Companion modules ``agent_app.services.conversation_summarizer`` +
  ``agent_app.services.follow_up_suggester`` +
  ``agent_app.services.prompt_assembler`` ship alongside this round.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from functools import wraps
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


def _with_langfuse_span(span_name: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Wrap a tool callable in a Langfuse span (best-effort, never crashes).

    AC-Ops-Obs-1 — every tool emission needs ``input``, ``output_preview``,
    ``duration_ms`` captured for SLA dashboards.

    Pragmatic implementation:

    - Try the Langfuse v4 ``Langfuse().start_as_current_span(...)`` context
      manager when ``LANGFUSE_PUBLIC_KEY`` / ``LANGFUSE_SECRET_KEY`` are set.
    - When credentials are missing OR the SDK call fails OR the sync wrapping
      is awkward (Langfuse v4 is async-first), emit a structured
      ``logger.info('langfuse_tool_span', extra=...)`` line capturing the
      same fields. This is the documented Phase 1I follow-up — chat-tool
      observability via structured logs is acceptable until a dedicated
      sync helper lands. See Round 1D-3 notes.
    - Telemetry MUST never break the call: catch every exception around the
      span; only the wrapped function's result/exception is visible to the
      caller.
    """
    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            start = time.monotonic()
            input_repr = _safe_repr({'args': args, 'kwargs': kwargs}, limit=400)
            handler = None
            span_ctx = None
            try:
                # Late import — keep this module light when Langfuse is absent.
                from core.observability.langfuse_handler import (
                    get_langfuse_handler,
                )
                handler = get_langfuse_handler(
                    trace_name=f'chat_tool:{span_name}',
                )
            except Exception:  # pragma: no cover - defensive
                handler = None

            if handler is not None:
                # Best-effort: try Langfuse v4's start_as_current_span.
                try:
                    from langfuse import get_client  # type: ignore

                    client = get_client()
                    span_ctx = client.start_as_current_span(name=span_name)
                    span_ctx.__enter__()
                    try:
                        span_ctx.update(input=input_repr)
                    except Exception:  # pragma: no cover - defensive
                        pass
                except Exception:
                    span_ctx = None

            try:
                result = fn(*args, **kwargs)
            except Exception as exc:
                duration_ms = int((time.monotonic() - start) * 1000)
                if span_ctx is not None:
                    try:
                        span_ctx.update(
                            output={'error': str(exc)[:200]},
                            metadata={'duration_ms': duration_ms},
                        )
                    except Exception:  # pragma: no cover - defensive
                        pass
                    try:
                        span_ctx.__exit__(type(exc), exc, exc.__traceback__)
                    except Exception:  # pragma: no cover - defensive
                        pass
                logger.info(
                    'langfuse_tool_span',
                    extra={
                        'tool': span_name,
                        'input_preview': input_repr,
                        'duration_ms': duration_ms,
                        'error': str(exc)[:200],
                    },
                )
                raise
            duration_ms = int((time.monotonic() - start) * 1000)
            output_preview = _safe_repr(result, limit=200)
            if span_ctx is not None:
                try:
                    span_ctx.update(
                        output=output_preview,
                        metadata={'duration_ms': duration_ms},
                    )
                except Exception:  # pragma: no cover - defensive
                    pass
                try:
                    span_ctx.__exit__(None, None, None)
                except Exception:  # pragma: no cover - defensive
                    pass
            logger.info(
                'langfuse_tool_span',
                extra={
                    'tool': span_name,
                    'input_preview': input_repr,
                    'output_preview': output_preview,
                    'duration_ms': duration_ms,
                },
            )
            return result

        return wrapper

    return decorator


def _safe_repr(value: Any, limit: int = 200) -> str:
    """``repr()`` truncated to ``limit`` chars; never raises."""
    try:
        text = repr(value)
    except Exception:  # pragma: no cover - defensive
        text = '<unrepr-able>'
    if len(text) > limit:
        return text[:limit] + '…'
    return text


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


def _parse_llm_json(raw: str) -> Optional[dict]:
    """Best-effort JSON parse for LLM responses.

    Tries ``json.loads`` directly first. If the LLM returned markdown-fenced
    JSON (``` ```json ... ``` ```), strips backticks + leading ``json\n`` and
    retries once. Returns ``None`` on hard failure.
    """
    import json

    raw = (raw or '').strip()
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    stripped = raw.strip('`').lstrip('json\n').strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        return None


def _normalize_enum_token(value: Any) -> str:
    """Normalize an LLM-emitted enum token to SCREAMING_SNAKE form.

    Accepts display form (e.g. ``"IDENTITY DECLARATION"``,
    ``"CROSS-NICHE EVENTS"``) or already-normalized form. Returns ``''`` for
    falsy input.
    """
    if not value:
        return ''
    return (
        str(value).upper()
        .replace('/', '_')
        .replace(' ', '_')
        .replace('-', '_')
    )


def _validate_slogan_payload(
    raw: Any,
    valid_patterns: set,
    valid_devices: set,
    valid_archetypes: set,
    valid_confidence: set,
) -> Optional[dict]:
    """Validate + clean ONE slogan dict against the ``Idea`` enums.

    Hard rejection (returns ``None``):
      - ``slogan_text`` missing OR empty
      - ``signal_type`` not in ``{'self', 'other'}``

    Soft fallback (cleaned to safe default, never rejected):
      - ``pattern_used`` -> ``''`` when not in ``valid_patterns``
      - ``stylistic_device`` -> ``'FREE_FORM'`` when not in ``valid_devices``
      - ``emotional_archetype`` -> ``[]`` when not a list of valid archetypes
      - ``creative_modules_used`` -> ``[]`` when not list-of-strings
      - ``buyer_voice_pattern`` -> ``''`` when missing
      - ``why_it_works`` -> ``''`` when missing
      - ``market_confidence`` -> ``'Medium'`` when not in ``valid_confidence``
    """
    if not isinstance(raw, dict):
        return None
    slogan_text = (raw.get('slogan_text') or '').strip()
    if not slogan_text:
        return None
    signal_type = raw.get('signal_type')
    if signal_type not in ('self', 'other'):
        return None

    pattern = _normalize_enum_token(raw.get('pattern_used'))
    if pattern not in valid_patterns:
        pattern = ''

    device = _normalize_enum_token(raw.get('stylistic_device'))
    if device not in valid_devices:
        device = 'FREE_FORM'

    archetype = raw.get('emotional_archetype')
    if isinstance(archetype, list) and all(
        isinstance(a, str) and a in valid_archetypes for a in archetype
    ):
        archetype_clean = archetype
    else:
        archetype_clean = []

    modules = raw.get('creative_modules_used')
    if isinstance(modules, list) and all(isinstance(m, str) for m in modules):
        modules_clean = modules
    else:
        modules_clean = []

    confidence = raw.get('market_confidence')
    if confidence not in valid_confidence:
        confidence = 'Medium'

    return {
        'slogan_text': slogan_text,
        'signal_type': signal_type,
        'pattern_used': pattern,
        'stylistic_device': device,
        'emotional_archetype': archetype_clean,
        'creative_modules_used': modules_clean,
        'buyer_voice_pattern': (raw.get('buyer_voice_pattern') or '').strip(),
        'why_it_works': (raw.get('why_it_works') or '').strip(),
        'market_confidence': confidence,
    }


def _bsr_snippet(niche) -> str:
    """Return a 1-line BSR summary for the niche's CollectedProducts.

    Used inline by ``brainstorm_ideas`` to give the LLM a compact competitive
    signal without firing the heavier ``bsr_stats`` aggregate.
    """
    from niche_app.models import CollectedProduct

    agg = CollectedProduct.objects.filter(niche=niche).aggregate(
        n=Count('id'), lo=Min('product__bsr'), hi=Max('product__bsr'),
    )
    if not agg['n']:
        return '(no products collected yet)'
    return f"{agg['n']} products, BSR range {agg['lo']}-{agg['hi']}"


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


def _build_tools(workspace, niche, model_override=None) -> list:
    """Construct the 8 tools bound to ``(workspace, niche)`` via closure.

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

        @_with_langfuse_span('web_search')
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

        @_with_langfuse_span('search_slogans')
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

        @_with_langfuse_span('search_products')
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

        @_with_langfuse_span('search_niche_knowledge')
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

        @_with_langfuse_span('top_keywords')
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

        @_with_langfuse_span('bsr_stats')
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

    # ── generate_slogans ───────────────────────────────────────────────
    @tool('generate_slogans')
    def generate_slogans(
        theme: Optional[str] = None,
        style: Optional[str] = None,
        count: int = 10,
        signal_mix: Optional[str] = None,
    ) -> dict:
        """Generate slogans for the pinned niche using the
        ``creative_techniques`` engine. Returns
        ``{'slogans': [...], 'warnings': [...]}`` where each slogan dict maps
        1:1 to ``Idea`` model fields (signal_type, pattern_used,
        stylistic_device, emotional_archetype, creative_modules_used,
        buyer_voice_pattern, why_it_works, market_confidence)."""
        @_with_langfuse_span('generate_slogans')
        def _run() -> dict:
            # Local imports — avoid app-loading cycles + keep test footprint small.
            from chat_node_config_app.services.resolver import (
                get_chat_prompt, get_node_config,
            )
            from idea_app.models import ALLOWED_EMOTIONAL_ARCHETYPES, Idea
            from idea_app.services import get_recent_slogans_sample
            from keyword_app.services.ranking import rank_niche_keywords
            from niche_app.services import (
                derive_marketplace,
                get_niche_analysis_snippet,
                marketplace_to_language,
            )
            from niche_research_app.graph.llm import get_llm_for_node

            # 1. Assemble placeholders for the creative_techniques prompt.
            marketplace = derive_marketplace(niche)
            marketplace_language = marketplace_to_language(marketplace)

            keywords = rank_niche_keywords(niche, limit=20)
            niche_keywords_topN = '\n'.join(
                f"- {kw.keyword} (vol: {getattr(kw, 'search_volume', None) or '?'})"
                for kw in keywords
            ) or '(no keywords yet)'

            recent_slogans_sample = get_recent_slogans_sample(niche, limit=20)
            niche_analysis_snippet = (
                get_niche_analysis_snippet(niche) or '(no niche analysis yet)'
            )

            signal_mix_value = signal_mix or '5 SELF + 5 OTHER'

            system_prompt = get_chat_prompt(
                'creative_techniques',
                niche_name=niche.name,
                marketplace_language=marketplace_language,
                niche_keywords_topN=niche_keywords_topN,
                recent_slogans_sample=recent_slogans_sample,
                niche_analysis_snippet=niche_analysis_snippet,
                requested_style=style or '',
                signal_mix=signal_mix_value,
                count=count,
            )

            llm, _ = get_llm_for_node(
                'creative_techniques',
                config_resolver=get_node_config,
                # PROJ-29 Phase 1I follow-up: honor user-selected model from
                # the ChatInputBar Model picker. Falls back to ChatNodeConfig
                # when no override is set.
                model_override=model_override,
            )

            user_message = (
                f"Generate {count} slogans for niche '{niche.name}'."
            )
            if theme:
                user_message += f" Theme: {theme}."

            response = llm.invoke([
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ])
            raw = (getattr(response, 'content', '') or '').strip()

            payload = _parse_llm_json(raw)
            if payload is None:
                logger.warning(
                    'generate_slogans: LLM returned non-JSON: %s', raw[:200],
                )
                return {
                    'slogans': [],
                    'warnings': ['LLM returned non-JSON; try again'],
                }

            valid_patterns = {c.value for c in Idea.PatternUsed}
            valid_devices = {c.value for c in Idea.StylisticDevice}
            valid_archetypes = set(ALLOWED_EMOTIONAL_ARCHETYPES)
            valid_confidence = {'High', 'Medium', 'Low'}

            warnings = list(payload.get('warnings') or [])
            validated: list[dict] = []
            for raw_slogan in payload.get('slogans', []) or []:
                cleaned = _validate_slogan_payload(
                    raw_slogan, valid_patterns, valid_devices,
                    valid_archetypes, valid_confidence,
                )
                if cleaned:
                    validated.append(cleaned)
                else:
                    text_preview = ''
                    if isinstance(raw_slogan, dict):
                        text_preview = (raw_slogan.get('slogan_text') or '<no text>')[:80]
                    warnings.append(
                        f"rejected malformed slogan: {text_preview}"
                    )

            return {'slogans': validated, 'warnings': warnings}

        return _with_timeout(_run)

    # ── brainstorm_ideas ───────────────────────────────────────────────
    @tool('brainstorm_ideas')
    def brainstorm_ideas(focus: Optional[str] = None) -> dict:
        """Brainstorm 5-10 concept directions for the pinned niche.

        Composes top_keywords + bsr_stats + recent slogans + niche analysis,
        then asks the LLM to propose 5-10 design directions tagged with the 16
        canonical patterns + (optional) CIRCLE crossover layer.
        Returns ``{'directions': [{direction_title, pattern, circle_layer,
        rationale, example_slogan_seed}, ...]}``."""
        @_with_langfuse_span('brainstorm_ideas')
        def _run() -> dict:
            from chat_node_config_app.services.resolver import get_node_config
            from idea_app.models import Idea
            from idea_app.services import get_recent_slogans_sample
            from keyword_app.services.ranking import rank_niche_keywords
            from niche_app.services import (
                derive_marketplace,
                get_niche_analysis_snippet,
                marketplace_to_language,
            )
            from niche_research_app.graph.llm import get_llm_for_node

            marketplace_language = marketplace_to_language(
                derive_marketplace(niche),
            )
            keywords = list(rank_niche_keywords(niche, limit=20))
            top_keywords_text = (
                ', '.join(kw.keyword for kw in keywords[:10])
                or '(none yet)'
            )

            bsr_text = _bsr_snippet(niche)
            recent_slogans = get_recent_slogans_sample(niche, limit=10)
            niche_analysis = (
                get_niche_analysis_snippet(niche) or '(no analysis yet)'
            )

            system_prompt = (
                "You are a Print-on-Demand niche strategist. Brainstorm 5-10 "
                "concept DIRECTIONS (not finished slogans) for the niche. Each "
                "direction tags one of the 16 canonical patterns "
                "(IDENTITY DECLARATION, GROUP LEADER, TRIBE/COMMUNITY, "
                "FUNNY ACTIVITY, CROSS-NICHE EVENTS, CROSS-NICHE MASHUP, "
                "ADDICTION/OBSESSION, VINTAGE/LEGACY, ACHIEVEMENT/GAMIFIED, "
                "JOB/PROFESSION PARODY, RELATIONSHIP HUMOR, "
                "BOUNDARY/GATEKEEPING, ENDURANCE/SURVIVAL, "
                "COMPETENCE/EXPERTISE, CHAOS/CONTROL, SELF-CARE/PRIORITIES) "
                "and optionally a Heidorn CIRCLE letter "
                "(C / I / R / Crossover / LE).\n\n"
                f"Niche: {niche.name}\n"
                f"Marketplace language: {marketplace_language}\n"
                f"Top keywords: {top_keywords_text}\n"
                f"BSR profile: {bsr_text}\n"
                f"Niche analysis: {niche_analysis}\n"
                f"Recent slogans sample:\n{recent_slogans}\n"
                f"User focus (optional): "
                f"{focus or '(none - propose mixed directions)'}\n\n"
                "Return STRICT JSON: "
                '{"directions": [{"direction_title": "...", '
                '"pattern": "<one of 16>", '
                '"circle_layer": "<C|I|R|Crossover|LE|>", '
                '"rationale": "1-2 sentences", '
                '"example_slogan_seed": "<a phrase, not a finished slogan>"}]} '
                "5-10 directions. No markdown."
            )

            llm, _ = get_llm_for_node(
                'agent_react',
                config_resolver=get_node_config,
                model_override=model_override,
            )
            response = llm.invoke([
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': f"Focus: {focus or 'mix it up'}"},
            ])
            raw = (getattr(response, 'content', '') or '').strip()

            payload = _parse_llm_json(raw)
            if payload is None:
                logger.warning(
                    'brainstorm_ideas: LLM returned non-JSON: %s', raw[:200],
                )
                return {'directions': []}

            valid_patterns = {c.value for c in Idea.PatternUsed}
            valid_circle = {'C', 'I', 'R', 'Crossover', 'LE', ''}

            cleaned: list[dict] = []
            for d in payload.get('directions', []) or []:
                if not isinstance(d, dict):
                    continue
                title = (d.get('direction_title') or '').strip()
                if not title:
                    continue
                pattern_in = d.get('pattern', '')
                pattern_norm = _normalize_enum_token(pattern_in)
                pattern = pattern_norm if pattern_norm in valid_patterns else ''

                circle_layer = d.get('circle_layer') or ''
                if circle_layer not in valid_circle:
                    circle_layer = ''

                cleaned.append({
                    'direction_title': title,
                    'pattern': pattern,
                    'circle_layer': circle_layer,
                    'rationale': (d.get('rationale') or '').strip(),
                    'example_slogan_seed': (
                        d.get('example_slogan_seed') or ''
                    ).strip(),
                })

            return {'directions': cleaned[:10]}

        return _with_timeout(_run)

    return [
        web_search,
        search_slogans,
        search_products,
        search_niche_knowledge,
        top_keywords,
        bsr_stats,
        generate_slogans,
        brainstorm_ideas,
    ]


def build_niche_chat_agent(workspace, niche_id, session_id: str, model_override=None):
    """Compile the niche-chat ReAct agent for one user turn.

    Per-request LLM (AC-Ops-LG-3) — instantiated here, not at module level,
    so two concurrent requests get isolated client state.

    ``niche_id`` is validated against the workspace inside this function
    (``Niche.objects.get(workspace=workspace, id=niche_id)``) — cross-workspace
    access raises ``Niche.DoesNotExist`` and propagates to the view layer.

    ``model_override``: PROJ-29 Phase 1I follow-up — when set (e.g. from the
    ChatInputBar Model picker), the user-facing stages (``agent_react`` here
    + ``creative_techniques`` inside the slogan tool) use this model instead
    of the ChatNodeConfig default. Utility stages (``query_rewrite``,
    ``contextual_header``, ``follow_up_suggester``, ``conversation_summarizer``)
    keep their tuned defaults — those are not visible to the user.
    """
    # Lazy imports — avoid app-loading cycles and keep test-time light.
    from chat_node_config_app.services.resolver import (
        get_chat_prompt, get_node_config,
    )
    from niche_app.models import Niche
    from niche_app.services import derive_marketplace, marketplace_to_language
    from niche_research_app.graph.llm import get_llm_for_node

    niche = Niche.objects.get(workspace=workspace, id=niche_id)

    tools = _build_tools(workspace, niche, model_override=model_override)

    # AC-Ops-LG-3 — per-request LLM, NOT a module-level singleton.
    llm, _ = get_llm_for_node(
        'agent_react',
        config_resolver=get_node_config,
        model_override=model_override,
    )

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


# ---------------------------------------------------------------------------
# PROJ-29 Phase 1E — ``run_chat`` orchestration entry point
# ---------------------------------------------------------------------------

# SSE event constants — names map 1:1 to the SSE protocol documented in
# ``docs/tasks/PROJ-29-tasks.md`` Phase 1E.
EVENT_INIT = 'init'
EVENT_STAGE = 'stage'
EVENT_TOOL_CALL = 'tool_call'
EVENT_TOOL_RESULT = 'tool_result'
EVENT_TOOL_TIMEOUT = 'tool_timeout'
EVENT_CHUNKS_USED = 'chunks_used'
EVENT_CHUNK = 'chunk'
EVENT_DONE = 'done'
EVENT_FOLLOW_UPS = 'follow_ups'
EVENT_ERROR = 'error'
EVENT_GENERATE_SLOGANS_PAYLOAD = 'generate_slogans_payload'
EVENT_HEARTBEAT = 'heartbeat'

# Tools that surface RAG chunks the UI renders as citations.
SEARCH_TOOL_NAMES = {
    'search_slogans',
    'search_products',
    'search_niche_knowledge',
}


def _is_chunk_list(value: Any) -> bool:
    """Best-effort detector for hybrid_search result lists."""
    return (
        isinstance(value, list)
        and value
        and isinstance(value[0], dict)
        and 'chunk_text' in value[0]
    )


def run_chat(session, message: str, model_override=None):
    """Yield SSE event dicts for one niche-chat turn.

    Phase 1E orchestration entry point. The view layer wraps each yield in
    ``event: <name>\\ndata: <json>\\n\\n``. Tests mock this function with a
    fixture event sequence — the production implementation iterates
    ``agent.stream(..., stream_mode=['updates', 'messages'])`` and translates
    LangGraph node updates into the documented event vocabulary.

    Event order (per Phase 1E):

    ``init`` -> ``stage:thinking`` -> N x (``tool_call`` -> ``tool_result``
    OR ``tool_timeout``) -> ``chunks_used`` -> N x ``chunk`` ->
    ``generate_slogans_payload`` (when applicable) -> ``done`` ->
    ``follow_ups``.

    ``model_override``: PROJ-29 Phase 1I follow-up — when set, the user-facing
    LLM stages (``agent_react`` + ``creative_techniques``) use this model
    instead of the per-stage ChatNodeConfig default. Honors the ChatInputBar
    Model picker. Utility stages (query rewrite, contextual header, follow-up
    suggester, conversation summarizer) keep their tuned defaults.

    On unrecoverable error: ``error`` with ``{code, retry_after_s: 30}``.
    """
    niche = session.niche_context
    yield {
        'event': EVENT_INIT,
        'data': {
            'session_id': str(session.id),
            'mode': 'agent',
            'niche_id': str(niche.id) if niche else None,
        },
    }
    yield {'event': EVENT_STAGE, 'data': {'stage': 'thinking'}}

    chunks_consolidated: list[dict] = []
    final_answer_parts: list[str] = []
    generate_slogans_payload: Optional[dict] = None
    tool_call_starts: dict[str, float] = {}

    try:
        agent = build_niche_chat_agent(
            session.workspace, niche.id, str(session.id),
            model_override=model_override,
        )

        # ``stream_mode=['updates', 'messages']`` -> tuples of
        # ``(mode_name, payload)`` per the LangGraph contract.
        for stream_mode, payload in agent.stream(
            {'messages': [{'role': 'user', 'content': message}]},
            stream_mode=['updates', 'messages'],
        ):
            if stream_mode == 'updates':
                # ``payload`` shape: ``{<node_name>: <state_update>}``.
                for node_name, update in (payload or {}).items():
                    if node_name == 'tools':
                        for tool_msg in (update or {}).get('messages', []):
                            tool_name = (
                                getattr(tool_msg, 'name', '') or 'unknown'
                            )
                            raw_output = getattr(tool_msg, 'content', '')
                            duration_ms = int(
                                (
                                    time.monotonic()
                                    - tool_call_starts.pop(tool_name, time.monotonic())
                                ) * 1000
                            )
                            # Tool-timeout / tool-error detection: the tool
                            # wrapper returns ``{'error': 'tool_timeout', ...}``
                            # on the 30s cap (AC-Thinking-5). Inspect the
                            # parsed payload to distinguish timeout vs success.
                            parsed: Any = raw_output
                            try:
                                import json as _json
                                if isinstance(raw_output, str):
                                    parsed = _json.loads(raw_output)
                            except (TypeError, ValueError):
                                parsed = raw_output

                            if (
                                isinstance(parsed, dict)
                                and parsed.get('error') == 'tool_timeout'
                            ):
                                yield {
                                    'event': EVENT_TOOL_TIMEOUT,
                                    'data': {
                                        'tool': tool_name,
                                        'duration_ms': parsed.get(
                                            'duration_ms', duration_ms,
                                        ),
                                        'output_preview': _safe_repr(parsed, 200),
                                    },
                                }
                                continue

                            # Capture generate_slogans payload (special-case).
                            if (
                                tool_name == 'generate_slogans'
                                and isinstance(parsed, dict)
                                and 'slogans' in parsed
                            ):
                                generate_slogans_payload = parsed

                            # Accumulate chunks for the consolidated event.
                            if (
                                tool_name in SEARCH_TOOL_NAMES
                                and _is_chunk_list(parsed)
                            ):
                                chunks_consolidated.extend(parsed)

                            yield {
                                'event': EVENT_TOOL_RESULT,
                                'data': {
                                    'tool': tool_name,
                                    'duration_ms': duration_ms,
                                    'output_preview': _safe_repr(parsed, 200),
                                },
                            }
                    elif node_name == 'agent':
                        for ai_msg in (update or {}).get('messages', []):
                            for tool_call in getattr(
                                ai_msg, 'tool_calls', [],
                            ) or []:
                                tool_name = (
                                    tool_call.get('name')
                                    if isinstance(tool_call, dict)
                                    else getattr(tool_call, 'name', '')
                                ) or 'unknown'
                                tool_args = (
                                    tool_call.get('args')
                                    if isinstance(tool_call, dict)
                                    else getattr(tool_call, 'args', {})
                                ) or {}
                                tool_call_starts[tool_name] = time.monotonic()
                                yield {
                                    'event': EVENT_TOOL_CALL,
                                    'data': {
                                        'tool': tool_name,
                                        'args': tool_args,
                                    },
                                }
            elif stream_mode == 'messages':
                # ``payload`` shape: ``(message_chunk, metadata)``.
                try:
                    msg_chunk, metadata = payload
                except (TypeError, ValueError):
                    continue
                # Only emit token chunks from the agent node (not tool nodes).
                node = (metadata or {}).get('langgraph_node', '')
                if node and node != 'agent':
                    continue
                delta = getattr(msg_chunk, 'content', '') or ''
                if not delta:
                    continue
                final_answer_parts.append(delta)
                yield {'event': EVENT_CHUNK, 'data': {'delta': delta}}
    except Exception as exc:
        logger.exception('run_chat agent stream failed')
        yield {
            'event': EVENT_ERROR,
            'data': {
                'code': type(exc).__name__,
                'retry_after_s': 30,
            },
        }
        return

    # Always emit chunks_used (even when empty) so the UI can clear stale
    # citations from a prior turn.
    yield {
        'event': EVENT_CHUNKS_USED,
        'data': {'chunks': chunks_consolidated},
    }

    if generate_slogans_payload is not None:
        yield {
            'event': EVENT_GENERATE_SLOGANS_PAYLOAD,
            'data': generate_slogans_payload,
        }

    final_answer = ''.join(final_answer_parts)

    # PROJ-29 Phase 1I follow-up: emit `follow_ups` BEFORE `done` because the
    # frontend's `done` handler closes the EventSource immediately — any event
    # arriving after `done` is lost on a closed connection. The 1-3s suggester
    # latency is acceptable UX cost for getting the chips to render reliably.
    try:
        from agent_app.services.follow_up_suggester import suggest as _suggest
        from niche_app.services import (
            derive_marketplace,
            marketplace_to_language,
        )

        language = marketplace_to_language(derive_marketplace(niche)) if niche else 'en'
        suggestions = _suggest(
            user_msg=message,
            assistant_msg=final_answer,
            niche_name=niche.name if niche else '',
            language=language,
        )
        if suggestions:
            yield {
                'event': EVENT_FOLLOW_UPS,
                # Canonical wire shape: `{chips: [...]}` per
                # `frontend-ui/src/types/chat-rag.ts:SSEFollowUpsEvent`.
                'data': {'chips': list(suggestions)},
            }
    except Exception:
        logger.warning(
            'follow_up_suggester invocation failed; skipping chips',
            exc_info=True,
        )

    yield {'event': EVENT_DONE, 'data': {'final_answer': final_answer}}


__all__ = [
    'AGENT_TYPE',
    'EVENT_CHUNK',
    'EVENT_CHUNKS_USED',
    'EVENT_DONE',
    'EVENT_ERROR',
    'EVENT_FOLLOW_UPS',
    'EVENT_GENERATE_SLOGANS_PAYLOAD',
    'EVENT_HEARTBEAT',
    'EVENT_INIT',
    'EVENT_STAGE',
    'EVENT_TOOL_CALL',
    'EVENT_TOOL_RESULT',
    'EVENT_TOOL_TIMEOUT',
    'PercentileCont',
    'RECURSION_LIMIT',
    'SEARCH_TOOL_NAMES',
    'SUBSET_TO_SUBTYPES',
    'TOOL_TIMEOUT_SECONDS',
    'build_niche_chat_agent',
    'run_chat',
    '_bsr_snippet',
    '_normalize_enum_token',
    '_parse_llm_json',
    '_safe_repr',
    '_validate_slogan_payload',
    '_with_langfuse_span',
]
