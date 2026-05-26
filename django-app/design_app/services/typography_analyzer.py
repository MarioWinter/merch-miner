"""PROJ-34 Phase 13i — Vision-LLM typography-style extractor.

Mirror of ``spatial_analyzer.py`` but for typographic anatomy. Sends a single
OpenRouter chat-completion call to ``openai/gpt-4.1-mini`` with the strict
typography-only system prompt below and returns the LLM's 50–90 word font-
anatomy paragraph.

The function raises:
- ``TypographyUnclearError`` when the LLM returns the literal
  ``TYPOGRAPHY_UNCLEAR`` sentinel (no clear text / blurry / photographic).
  Views translate this into HTTP 422 ``{ error: 'typography_unclear' }``.
- ``TypographyAnalyzerError`` on any network / HTTP / JSON parse error.
  Views translate this into HTTP 502 ``{ error: 'analyzer_unavailable' }``.

Post-LLM scrub is exposed as ``_scrub_forbidden(text)`` — a pure regex pass
that rejects responses mentioning colors, style names, illustration nouns,
hex codes, forbidden phrases, OR spatial-position words (the latter being
typography-specific extra: font anatomy must NOT describe placement).

Color / style / subject / generic-phrase blocklists are imported from
``spatial_analyzer`` (single source of truth). Spatial-position words are
added locally because they are FORBIDDEN here (font anatomy only) whereas
they are LEGITIMATE in spatial-analyzer.

Langfuse trace tags: ``workspace_id``, ``user_id``, ``source_kind``,
``scrub_passed``, ``scrub_terms``.
"""

from __future__ import annotations

import base64
import logging
import re

import httpx
from django.conf import settings

from design_app.services.spatial_analyzer import (
    COLOR_WORDS,
    HEX_RE,
    PHRASE_BLOCKLIST as SPATIAL_PHRASE_BLOCKLIST,
    STYLE_WORDS,
    SUBJECT_NOUNS,
)

logger = logging.getLogger(__name__)


# Tunables — matches `spatial_analyzer.py` style.
DEFAULT_MODEL = 'openai/gpt-4.1-mini'
TIMEOUT_SEC = 12.0


# ─── System prompt (VERBATIM, do not paraphrase) ──────────────────────────

TYPOGRAPHY_ANALYZER_SYSTEM_PROMPT = """You are a Print-on-Demand typography analyst. Your ONE job is to look at the supplied image and produce a SHORT paragraph that describes ONLY the typographic character of the visible text — the font anatomy and stroke behavior.

# What "typography" means here

- Font family kind: serif, sans-serif, slab, script, blackletter, monospace, display, hand-drawn, pixelated, etc.
- Weight: thin, light, regular, medium, bold, heavy, ultra-black
- Stroke contrast: monoline / low-contrast / high-contrast (thick-vs-thin)
- Terminals + endings: rounded / squared / pointed / flared / hooked
- Letterform proportions: condensed / regular / extended; tall x-height / low x-height
- Personality cues that show through anatomy: aggressive, friendly, refined, distressed, retro, mechanical, organic
- Decorative elements that belong to the FONT itself: serifs, ligatures, gloss highlights inside the letters, internal stripe lines, distress noise on the letterforms

# What you are FORBIDDEN to describe

- Any color (no "red", "yellow", "blue", "black", "white", "neon", "pastel", "warm tones", no hex codes — NOTHING about color)
- The spatial layout (no "top", "bottom", "centered", "above", "below" — that's the spatial slot's job)
- The illustration / subject / scene (no "skull", "dog", "guitar", "bus", "tree" — even if the artwork around the text is dominant)
- Any background texture / paper / fabric / ink material (that's the material slot's job)
- Any style name (no "vintage", "retro", "cartoon", "kawaii", "grunge", "halftone" — even when the font itself fits one of those eras, do not name the era; describe the anatomy instead)
- The words: "T-shirt", "shirt", "tee", "mockup", "model wearing", "fabric", "garment"

If the image contains multiple distinct fonts, describe ONLY the most dominant one. If they form a hierarchy, mention it briefly ("a primary heavyweight slab paired with a thin secondary mono caps"), but do not assign roles by spatial position.

# Output format

Return one English paragraph, 50 to 90 words, no markdown, no headings, no JSON, no bullet list. Begin with the most defining anatomical category (e.g. "Heavyweight cartoon-block font with …", "Thin hand-drawn marker font with …", "Ornate blackletter font with …"). Use only anatomy + behavior vocabulary.

# If the image cannot be analysed

If the typography is too small, blurry, photographic, or no clear text is visible, return exactly the literal token:

TYPOGRAPHY_UNCLEAR"""


# ─── Post-LLM scrub validator ──────────────────────────────────────────────

# Spatial-position words — FORBIDDEN here (font anatomy only). Defined
# explicitly in this module so the typography blocklist is self-contained
# and so future tweaks don't leak into the spatial analyzer.
SPATIAL_POSITION_BLOCKLIST = {
    'top', 'bottom', 'left', 'right', 'above', 'below',
    'center', 'centered', 'centre', 'centred', 'corner',
    'top-left', 'top-right', 'bottom-left', 'bottom-right',
    'upper-left', 'upper-right', 'lower-left', 'lower-right',
}

# Multi-word spatial-position phrases (substring match — same convention as
# ``PHRASE_BLOCKLIST`` in spatial_analyzer). Kept separate from the single-
# word list so the regex word-boundary pass doesn't need to know about them.
SPATIAL_POSITION_PHRASES = {
    'top of', 'bottom of', 'left side', 'right side',
    'centered on', 'centred on', 'upper half', 'lower half',
    'corners',
}

# Full phrase blocklist = generic POD phrases (from spatial) + spatial-position phrases.
PHRASE_BLOCKLIST = SPATIAL_PHRASE_BLOCKLIST | SPATIAL_POSITION_PHRASES


def _scrub_forbidden(text: str) -> tuple[bool, list[str]]:
    """Return ``(ok, hits)`` — ``ok`` is False when ``text`` contains banned terms.

    Word-boundary regex prevents false positives on substrings (e.g. "topple"
    won't match "top"). Hex codes flagged generically as the literal token
    ``'hex_code'`` so the UI can render a single banner without leaking the
    actual hex.
    """
    t = text.lower()
    hits: list[str] = []
    if HEX_RE.search(text):
        hits.append('hex_code')
    # Single-word blocklists (word-boundary regex)
    single_words = (
        COLOR_WORDS | STYLE_WORDS | SUBJECT_NOUNS | SPATIAL_POSITION_BLOCKLIST
    )
    for w in single_words:
        if re.search(rf'\b{re.escape(w)}\b', t):
            hits.append(w)
    # Multi-word phrase substrings (POD + spatial-position phrases)
    for ph in PHRASE_BLOCKLIST:
        if ph in t:
            hits.append(ph)
    return (len(hits) == 0, hits)


# ─── Exceptions ────────────────────────────────────────────────────────────


class TypographyAnalyzerError(Exception):
    """Generic failure (HTTP / timeout / JSON parse / unexpected error)."""


class TypographyUnclearError(TypographyAnalyzerError):
    """LLM returned the literal ``TYPOGRAPHY_UNCLEAR`` sentinel."""


# ─── Langfuse helper (best-effort) ─────────────────────────────────────────


def _get_langfuse():
    if not getattr(settings, 'LANGFUSE_PUBLIC_KEY', '') or not getattr(
        settings, 'LANGFUSE_SECRET_KEY', '',
    ):
        return None
    try:
        from langfuse import Langfuse

        return Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            base_url=getattr(settings, 'LANGFUSE_HOST', ''),
        )
    except Exception:  # noqa: BLE001 — Langfuse must never break a request
        return None


# ─── OpenRouter call ───────────────────────────────────────────────────────


def analyze_typography_style(
    image_bytes: bytes,
    *,
    mime: str,
    workspace_id: str | None = None,
    user_id: str | None = None,
    source_kind: str = 'upload',
) -> str:
    """Call OpenRouter vision-LLM and return the typography paragraph.

    Raises ``TypographyUnclearError`` if the LLM returns ``TYPOGRAPHY_UNCLEAR``.
    Raises ``TypographyAnalyzerError`` on any other failure mode (network,
    HTTP non-2xx, JSON parse, missing OpenRouter config).
    """
    api_key = getattr(settings, 'OPENROUTER_API_KEY', '')
    base_url = getattr(settings, 'OPENROUTER_BASE_URL', '')
    if not api_key or not base_url:
        logger.warning('analyze_typography_style: OPENROUTER not configured')
        raise TypographyAnalyzerError('OpenRouter not configured')

    b64 = base64.b64encode(image_bytes).decode('ascii')
    data_url = f'data:{mime};base64,{b64}'

    payload = {
        'model': DEFAULT_MODEL,
        'temperature': 0.2,
        'max_tokens': 240,
        'messages': [
            {'role': 'system', 'content': TYPOGRAPHY_ANALYZER_SYSTEM_PROMPT},
            {'role': 'user', 'content': [
                {'type': 'text', 'text': 'Analyse the typography of this design.'},
                {'type': 'image_url', 'image_url': {'url': data_url}},
            ]},
        ],
    }
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'merch-miner / typography-analyzer',
    }

    # Langfuse — best-effort.
    langfuse = _get_langfuse()
    trace = None
    generation = None
    if langfuse:
        try:
            trace = langfuse.trace(
                name='design-typography-analyze',
                metadata={
                    'workspace_id': str(workspace_id) if workspace_id else None,
                    'user_id': str(user_id) if user_id else None,
                    'source_kind': source_kind,
                },
                tags=['design_app', 'typography_analyzer', 'proj-34'],
            )
            generation = trace.generation(
                name='analyze_typography_style',
                model=DEFAULT_MODEL,
                input=payload['messages'],
                model_parameters={'temperature': 0.2, 'max_tokens': 240},
            )
        except Exception:
            trace = None
            generation = None

    try:
        r = httpx.post(
            f'{base_url}/chat/completions',
            json=payload,
            headers=headers,
            timeout=TIMEOUT_SEC,
        )
        r.raise_for_status()
        data = r.json()
        text = (
            data.get('choices', [{}])[0]
            .get('message', {})
            .get('content', '') or ''
        ).strip()
        usage = data.get('usage', {}) or {}
        if generation:
            try:
                generation.end(
                    output=text[:1000],
                    usage={
                        'input': usage.get('prompt_tokens'),
                        'output': usage.get('completion_tokens'),
                        'total': usage.get('total_tokens'),
                    },
                )
            except Exception:
                pass
    except httpx.TimeoutException as exc:
        logger.warning('analyze_typography_style timeout: %s', exc)
        if generation:
            try:
                generation.end(level='ERROR', status_message=f'timeout: {exc}')
            except Exception:
                pass
        if langfuse:
            try:
                langfuse.flush()
            except Exception:
                pass
        raise TypographyAnalyzerError(f'timeout: {exc}') from exc
    except httpx.HTTPStatusError as exc:
        logger.warning(
            'analyze_typography_style http %s: %s',
            exc.response.status_code, exc.response.text[:200],
        )
        if generation:
            try:
                generation.end(
                    level='ERROR',
                    status_message=f'http {exc.response.status_code}',
                )
            except Exception:
                pass
        if langfuse:
            try:
                langfuse.flush()
            except Exception:
                pass
        raise TypographyAnalyzerError(
            f'http {exc.response.status_code}',
        ) from exc
    except Exception as exc:  # noqa: BLE001 — JSON parse / unexpected
        logger.warning(
            'analyze_typography_style %s: %s', type(exc).__name__, exc,
        )
        if generation:
            try:
                generation.end(
                    level='ERROR',
                    status_message=f'{type(exc).__name__}: {exc}',
                )
            except Exception:
                pass
        if langfuse:
            try:
                langfuse.flush()
            except Exception:
                pass
        raise TypographyAnalyzerError(f'{type(exc).__name__}: {exc}') from exc

    if langfuse:
        try:
            langfuse.flush()
        except Exception:
            pass

    if text == 'TYPOGRAPHY_UNCLEAR':
        raise TypographyUnclearError('LLM returned TYPOGRAPHY_UNCLEAR sentinel')
    return text
