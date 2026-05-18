"""PROJ-34 Phase 13d — Vision-LLM spatial-layout extractor.

`analyze_spatial_layout(image_bytes, *, mime, workspace_id=None, user_id=None,
source_kind='upload') -> str` sends a single OpenRouter chat-completion call
to ``openai/gpt-4.1-mini`` with the strict spatial-only system prompt from
Appendix P.1 and returns the LLM's 40–80 word geometric paragraph.

The function raises:
- ``SpatialUnclearError`` when the LLM returns the literal ``LAYOUT_UNCLEAR``
  sentinel (image too cluttered / blurry / photographic). Views translate
  this into HTTP 422 ``{ error: 'spatial_unclear' }``.
- ``SpatialAnalyzerError`` on any network / HTTP / JSON parse error. Views
  translate this into HTTP 422 ``{ error: 'spatial_analysis_failed' }``.

Post-LLM scrub is exposed as ``_scrub_forbidden(text)`` — a pure regex pass
that rejects responses mentioning colors, style names, illustration nouns,
hex codes, or forbidden phrases (Appendix P.2).

Langfuse trace tags (Appendix P.4): ``workspace_id``, ``user_id``,
``source_kind``, ``scrub_passed``, ``scrub_terms``.
"""

from __future__ import annotations

import base64
import logging
import re

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


# Tunables — matches `prompt_polish.py` / `builder_hints.py` style.
DEFAULT_MODEL = 'openai/gpt-4.1-mini'
TIMEOUT_SEC = 12.0


# ─── Appendix P.1 — System prompt (VERBATIM, do not paraphrase) ────────────

SPATIAL_ANALYZER_SYSTEM_PROMPT = """You are a Print-on-Demand layout analyst. Your ONE job is to look at the supplied image and produce a SHORT paragraph that describes ONLY the spatial arrangement of text blocks and vector/illustration elements on the canvas.

# What "spatial" means here

- WHERE the text sits (top, bottom, center, left, right, arc, ribbon, frame, on top of the illustration, …)
- WHERE the vector/illustration sits relative to the text (above, below, behind, centered, off-center, framed inside, …)
- HOW the composition is organized (stacked, horizontal row, diagonal, badge, triptych, grid, list, dictionary-entry, …)
- HOW much breathing room separates the blocks (tight, generous, asymmetric, edge-bleeding, …)

# What you are FORBIDDEN to describe

You MUST NOT mention or even hint at:
- Any color (no "red", "yellow", "blue", "black", "white", "neon", "pastel", "warm tones", "earth tones", no hex codes — NOTHING about color)
- Any style name (no "vintage", "retro", "cartoon", "watercolor", "grunge", "kawaii", "halftone", "pixel-art", "vector-flat", "blackletter", "sketch", "minimal", …)
- The actual subject of the illustration (no "skull", "dog", "bus", "guitar", "tree", "child", "tractor", "rocket", "heart", …) — call it only "the illustration" or "the vector element"
- Any texture, material, ink, paper, fabric, screen-print, halftone, gradient, glow, or shadow
- Any font name, font family, or font style description (no "serif", "sans-serif", "blackletter", "script", "bold", "italic", "thin"…)
- Any words: "T-shirt", "shirt", "tee", "mockup", "model wearing", "fabric", "garment"

If the image contains people, words, characters, brands — IGNORE them. Describe ONLY the geometric placement of blocks.

# Output format

Return one English paragraph, 40 to 80 words, no markdown, no headings, no JSON, no bullet list. Begin the paragraph with the layout name + the word "layout" (e.g. "Badge emblem layout with …", "Diagonal split layout with …"). Use neutral geometric language ("text block", "illustration block", "vector element", "headline area", "subtitle line", "outer arc", "lower third", "upper-left corner").

# If the image cannot be analysed

If the image is too cluttered, blurry, abstract, or photographic (not a print design) to identify a clear layout, return exactly the literal token:

LAYOUT_UNCLEAR"""


# ─── Appendix P.2 — Post-LLM scrub validator (VERBATIM) ────────────────────

# Colors (named) — case-insensitive
COLOR_WORDS = {
    'red', 'orange', 'yellow', 'green', 'blue', 'cyan', 'teal', 'purple', 'magenta',
    'pink', 'brown', 'beige', 'tan', 'black', 'white', 'grey', 'gray', 'silver',
    'gold', 'golden', 'neon', 'pastel', 'warm', 'cool', 'earth', 'earthy', 'faded',
    'saturated', 'muted', 'bright', 'dark', 'light',
}
# Style slugs (Mario-curated 15). Note: 'badge' and 'emblem' deliberately
# omitted — they are also legitimate spatial-layout terms (see SPATIAL_OPTIONS
# id `badge_emblem` in style_library.py whose prompt_text begins
# "Badge emblem layout with…"). Forbidding them would make every clean
# layout containing a badge composition fail the scrub.
STYLE_WORDS = {
    'vintage', 'retro', '70s', 'groovy', '80s', 'synthwave', 'neon', '90s', 'grunge',
    'kawaii', 'chibi', 'cartoon', 'watercolor', 'sketch', 'hand-drawn', 'vector',
    'flat', 'minimal', 'pixel', '8-bit', 'distressed', 'halftone',
    'blackletter', 'gothic', 'screenprint', 'plastisol',
}
# Forbidden phrases
PHRASE_BLOCKLIST = {
    't-shirt', 'tshirt', 'tee', 'mockup', 'model wearing', 'fabric', 'garment',
    'gradient', 'glow', 'soft shadow', 'drop shadow', 'blur',
}
# Hex code regex
HEX_RE = re.compile(r'#[0-9A-Fa-f]{3,8}\b')

# Illustration-subject nouns (defensive, non-exhaustive — implementer can extend)
SUBJECT_NOUNS = {
    'skull', 'dog', 'cat', 'bus', 'truck', 'car', 'guitar', 'drum', 'piano', 'tree',
    'flower', 'rose', 'heart', 'star', 'rocket', 'unicorn', 'shark', 'tiger',
    'lion', 'eagle', 'pirate', 'ninja', 'samurai', 'astronaut', 'cowboy', 'farmer',
    'nurse', 'teacher', 'mom', 'dad', 'grandma', 'grandpa', 'child', 'baby',
    'tractor', 'helicopter', 'plane', 'boat', 'ship', 'fish',
}


def _scrub_forbidden(text: str) -> tuple[bool, list[str]]:
    """Return ``(ok, hits)`` — ``ok`` is False when ``text`` contains banned terms.

    Word-boundary regex prevents false positives on substrings (e.g. "blackout"
    won't match "black"). Hex codes flagged generically as the literal token
    ``'hex_code'`` so the UI can render a single banner without leaking the
    actual hex.
    """
    t = text.lower()
    hits: list[str] = []
    if HEX_RE.search(text):
        hits.append('hex_code')
    for w in COLOR_WORDS | STYLE_WORDS | SUBJECT_NOUNS:
        if re.search(rf'\b{re.escape(w)}\b', t):
            hits.append(w)
    for ph in PHRASE_BLOCKLIST:
        if ph in t:
            hits.append(ph)
    return (len(hits) == 0, hits)


# ─── Exceptions ────────────────────────────────────────────────────────────


class SpatialAnalyzerError(Exception):
    """Generic failure (HTTP / timeout / JSON parse / unexpected error)."""


class SpatialUnclearError(SpatialAnalyzerError):
    """LLM returned the literal ``LAYOUT_UNCLEAR`` sentinel."""


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


# ─── Appendix P.3 — OpenRouter call ────────────────────────────────────────


def analyze_spatial_layout(
    image_bytes: bytes,
    *,
    mime: str,
    workspace_id: str | None = None,
    user_id: str | None = None,
    source_kind: str = 'upload',
) -> str:
    """Call OpenRouter vision-LLM and return the spatial paragraph.

    Raises ``SpatialUnclearError`` if the LLM returns ``LAYOUT_UNCLEAR``.
    Raises ``SpatialAnalyzerError`` on any other failure mode (network,
    HTTP non-2xx, JSON parse, missing OpenRouter config).
    """
    api_key = getattr(settings, 'OPENROUTER_API_KEY', '')
    base_url = getattr(settings, 'OPENROUTER_BASE_URL', '')
    if not api_key or not base_url:
        logger.warning('analyze_spatial_layout: OPENROUTER not configured')
        raise SpatialAnalyzerError('OpenRouter not configured')

    b64 = base64.b64encode(image_bytes).decode('ascii')
    data_url = f'data:{mime};base64,{b64}'

    payload = {
        'model': DEFAULT_MODEL,
        'temperature': 0.2,
        'max_tokens': 220,
        'messages': [
            {'role': 'system', 'content': SPATIAL_ANALYZER_SYSTEM_PROMPT},
            {'role': 'user', 'content': [
                {'type': 'text', 'text': 'Analyse the spatial layout of this design.'},
                {'type': 'image_url', 'image_url': {'url': data_url}},
            ]},
        ],
    }
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'merch-miner / spatial-analyzer',
    }

    # Langfuse — best-effort. Appendix P.4 metadata tags.
    langfuse = _get_langfuse()
    trace = None
    generation = None
    if langfuse:
        try:
            trace = langfuse.trace(
                name='design-spatial-analyze',
                metadata={
                    'workspace_id': str(workspace_id) if workspace_id else None,
                    'user_id': str(user_id) if user_id else None,
                    'source_kind': source_kind,
                },
                tags=['design_app', 'spatial_analyzer', 'proj-34'],
            )
            generation = trace.generation(
                name='analyze_spatial_layout',
                model=DEFAULT_MODEL,
                input=payload['messages'],
                model_parameters={'temperature': 0.2, 'max_tokens': 220},
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
        logger.warning('analyze_spatial_layout timeout: %s', exc)
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
        raise SpatialAnalyzerError(f'timeout: {exc}') from exc
    except httpx.HTTPStatusError as exc:
        logger.warning(
            'analyze_spatial_layout http %s: %s',
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
        raise SpatialAnalyzerError(
            f'http {exc.response.status_code}',
        ) from exc
    except Exception as exc:  # noqa: BLE001 — JSON parse / unexpected
        logger.warning(
            'analyze_spatial_layout %s: %s', type(exc).__name__, exc,
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
        raise SpatialAnalyzerError(f'{type(exc).__name__}: {exc}') from exc

    if langfuse:
        try:
            langfuse.flush()
        except Exception:
            pass

    if text == 'LAYOUT_UNCLEAR':
        raise SpatialUnclearError('LLM returned LAYOUT_UNCLEAR sentinel')
    return text
