"""PROJ-34 Phase 4 — Builder prompt-polish service.

Single entry point: :func:`polish_prompt(raw, model=...) -> str`. Sends a
small, cheap LLM call (Gemini 2.5 Flash Lite by default) to tighten the
grammar/flow of a Builder-generated prompt while preserving every concrete
detail. Polish is opt-in via the Builder UI + workspace setting; it is
NEVER invoked on free-typed textarea prompts.

Failure-modes intentionally degrade silently: any timeout / 5xx / quota /
network error returns the raw input and logs a warning so the Builder UX
always succeeds (AC-18). Polished output longer than 2000 chars is
truncated at the last sentence boundary (EC-5). Empty / unchanged output
falls through to raw (EC-6).
"""

from __future__ import annotations

import logging

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


# AC-15 / Tech-Note 1: user requested `google/gemini-3.1-flash-lite` but
# OpenRouter doesn't expose that ID yet — `2.5-flash-lite` is the closest
# equivalent (same cost band, sub-second latency).
DEFAULT_POLISH_MODEL = 'google/gemini-2.5-flash-lite'

POLISH_TIMEOUT_SEC = 5.0  # AC-19
POLISH_MAX_OUTPUT_CHARS = 2000  # EC-5

POLISH_SYSTEM_PROMPT = (
    'You polish T-shirt design generation prompts. Tighten grammar and flow '
    'only. Preserve every concrete detail — every adjective, color, layout '
    'instruction, style cue, font description, background-color line, and '
    'warp instruction must remain in the polished output. Do not add new '
    'concepts, do not summarize, do not strip "double-quoted" strings. '
    'Output ONLY the polished prompt, no preamble, no quotes around the '
    'whole reply, no explanation.'
)


def _get_langfuse():
    """Return a Langfuse client when keys are configured, else None."""
    if not getattr(settings, 'LANGFUSE_PUBLIC_KEY', '') or not getattr(
        settings, 'LANGFUSE_SECRET_KEY', '',
    ):
        return None
    try:
        from langfuse import Langfuse

        return Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            base_url=settings.LANGFUSE_HOST,
        )
    except ImportError:
        return None


def _truncate_to_sentence(text: str, max_chars: int) -> str:
    """Trim ``text`` to the last sentence boundary within ``max_chars`` (EC-5)."""
    if len(text) <= max_chars:
        return text
    window = text[:max_chars]
    # Prefer the last full sentence boundary; fall back to the cut.
    for sep in ('. ', '! ', '? ', '.\n', '!\n', '?\n'):
        idx = window.rfind(sep)
        if idx > 0:
            return window[: idx + 1]
    return window


def polish_prompt(
    raw: str,
    model: str = DEFAULT_POLISH_MODEL,
    *,
    timeout_sec: float = POLISH_TIMEOUT_SEC,
) -> str:
    """Polish a single Builder prompt; return the polished string.

    On any failure mode (timeout, 5xx, quota, network, malformed response,
    empty response, no-op output) returns ``raw`` unchanged and logs a
    warning. This function NEVER raises — Builder UX always succeeds.

    A one-shot retry on timeout matches the pattern used elsewhere in
    image_generator and absorbs transient network blips without doubling
    the user-visible latency budget.
    """
    if not raw or not raw.strip():
        return raw

    api_key = getattr(settings, 'OPENROUTER_API_KEY', '')
    base_url = getattr(settings, 'OPENROUTER_BASE_URL', '')
    if not api_key or not base_url:
        logger.warning('polish_prompt: OPENROUTER not configured — passthrough')
        return raw

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://merchminer.com',
        'X-Title': 'Merch Miner Prompt Polisher',
    }
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': POLISH_SYSTEM_PROMPT},
            {'role': 'user', 'content': raw},
        ],
        'temperature': 0.2,
        'max_tokens': 800,
    }

    langfuse = _get_langfuse()
    trace = None
    generation = None
    if langfuse:
        try:
            trace = langfuse.trace(
                name='design-prompt-polish',
                metadata={'raw_len': len(raw)},
                tags=['design_app', 'prompt_polish', 'builder'],
            )
            generation = trace.generation(
                name='polish',
                model=model,
                input=payload['messages'],
                model_parameters={'temperature': 0.2, 'max_tokens': 800},
            )
        except Exception:
            trace = None
            generation = None

    polished: str | None = None
    last_error: str | None = None

    for attempt in (1, 2):  # Retry-once on timeout (AC-19 budget guards this)
        try:
            with httpx.Client(timeout=timeout_sec) as client:
                resp = client.post(
                    f'{base_url}/chat/completions',
                    headers=headers,
                    json=payload,
                )
                resp.raise_for_status()
            data = resp.json()
            polished = (
                data.get('choices', [{}])[0]
                .get('message', {})
                .get('content', '') or ''
            ).strip()
            usage = data.get('usage', {}) or {}
            if generation:
                try:
                    generation.end(
                        output=polished[:1000],
                        usage={
                            'input': usage.get('prompt_tokens'),
                            'output': usage.get('completion_tokens'),
                            'total': usage.get('total_tokens'),
                        },
                    )
                except Exception:
                    pass
            break
        except httpx.TimeoutException as exc:
            last_error = f'timeout: {exc}'
            if attempt == 1:
                logger.info('polish_prompt: timeout, retrying once')
                continue
            logger.warning('polish_prompt: %s — passthrough', last_error)
        except httpx.HTTPStatusError as exc:
            last_error = f'http {exc.response.status_code}: {exc.response.text[:200]}'
            logger.warning('polish_prompt: %s — passthrough', last_error)
            break
        except Exception as exc:  # noqa: BLE001 — must never raise
            last_error = f'{type(exc).__name__}: {exc}'
            logger.warning('polish_prompt: %s — passthrough', last_error)
            break

    if langfuse:
        try:
            langfuse.flush()
        except Exception:
            pass

    if polished is None:
        if generation:
            try:
                generation.end(level='ERROR', status_message=last_error or 'unknown')
            except Exception:
                pass
        return raw

    # EC-6: empty / unchanged output → fall through to raw
    if not polished or polished == raw.strip():
        return raw

    # EC-5: oversize output → trim to last sentence boundary
    if len(polished) > POLISH_MAX_OUTPUT_CHARS:
        polished = _truncate_to_sentence(polished, POLISH_MAX_OUTPUT_CHARS)
        logger.warning('polish_prompt: output truncated to %s chars', len(polished))

    return polished
