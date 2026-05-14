"""PROJ-29 Phase 1D Round 1D-3 — prompt assembler (token-budget enforcer).

Trims `(system_prompt, history, retrieved_chunks)` until total token count
fits under the per-turn budget (default 8000, env-overridable via
``NICHE_RAG_PROMPT_TOKEN_BUDGET``). Trim order per AC-Context-1:

1. Drop oldest history messages > 10 turns ago (keep the newest 10).
2. Compress messages > 5 turns ago into 1-line role+preview placeholders.
3. Cap each retrieved chunk's ``text`` to its first 400 tokens.
4. If still over budget after all trims -> raise ``ValueError``.
   Hard budget is NEVER violated; caller must surface the error.

Token counting reuses ``vector_app.chunking.count_tokens`` (tiktoken-backed,
``cl100k_base`` encoding — identical to the rest of the indexing pipeline).
"""

from __future__ import annotations

import logging
from typing import Any

from vector_app.chunking import count_tokens

logger = logging.getLogger(__name__)

# Retain the newest N turns verbatim after step-1 trim.
HISTORY_VERBATIM_TAIL = 10
# Compress turns older than N (counted from the tail) into 1-liners.
HISTORY_COMPRESS_TAIL = 5
# Per-chunk cap when trimming via step-3.
CHUNK_TOKEN_CAP = 400
# Preview length for compressed history (in chars).
COMPRESSED_PREVIEW_CHARS = 80


def _msg_tokens(msg: dict) -> int:
    """Token count for a single ``{role, content}`` dict."""
    role = msg.get('role') or ''
    content = msg.get('content') or ''
    # Tag the role into the count so role bytes count toward the budget.
    return count_tokens(f"{role}: {content}")


def _history_tokens(history: list[dict]) -> int:
    return sum(_msg_tokens(m) for m in history)


def _chunk_tokens(chunk: dict) -> int:
    text = chunk.get('text') or ''
    return count_tokens(text)


def _chunks_tokens(chunks: list[dict]) -> int:
    return sum(_chunk_tokens(c) for c in chunks)


def _total(system_prompt: str, history: list[dict], chunks: list[dict]) -> int:
    return (
        count_tokens(system_prompt or '')
        + _history_tokens(history)
        + _chunks_tokens(chunks)
    )


def _compress_msg(msg: dict) -> dict:
    """Replace ``content`` with a 1-line role+preview placeholder."""
    role = msg.get('role') or 'user'
    content = (msg.get('content') or '').strip().replace('\n', ' ')
    preview = content[:COMPRESSED_PREVIEW_CHARS]
    if len(content) > COMPRESSED_PREVIEW_CHARS:
        preview = preview + '…'
    return {'role': role, 'content': f"[older] {role}: {preview}"}


def _cap_chunk_text(text: str, token_cap: int) -> str:
    """Truncate ``text`` to ``token_cap`` tokens (cl100k_base)."""
    from vector_app.chunking import _get_encoding

    enc = _get_encoding()
    token_ids = enc.encode(text or '')
    if len(token_ids) <= token_cap:
        return text or ''
    return enc.decode(token_ids[:token_cap])


def assemble(
    system_prompt: str,
    history: list[dict],
    retrieved_chunks: list[dict],
    budget: int = 8000,
) -> tuple[str, list[dict], list[dict]]:
    """Trim inputs until total tokens <= ``budget``.

    Args:
        system_prompt: The fully-rendered system prompt string.
        history: List of ``{role, content}`` dicts in chronological order.
        retrieved_chunks: List of ``{text, ...}`` chunk dicts from the RAG
            tools. ``text`` is the only key inspected for trimming.
        budget: Hard token cap (default 8000 / ``NICHE_RAG_PROMPT_TOKEN_BUDGET``).

    Returns:
        ``(trimmed_system_prompt, trimmed_history, trimmed_chunks)`` — the
        system_prompt is never modified; only history and chunks are trimmed.

    Raises:
        ValueError: When the system_prompt alone (or after all trims) still
            exceeds ``budget``. Hard budget is never silently violated
            (AC-Context-1).
    """
    history = list(history or [])
    chunks = [dict(c) for c in (retrieved_chunks or [])]

    total = _total(system_prompt, history, chunks)
    if total <= budget:
        return system_prompt, history, chunks

    # Step 1: drop oldest msgs > 10 turns ago (keep newest HISTORY_VERBATIM_TAIL).
    if len(history) > HISTORY_VERBATIM_TAIL:
        history = history[-HISTORY_VERBATIM_TAIL:]
        total = _total(system_prompt, history, chunks)
        if total <= budget:
            return system_prompt, history, chunks

    # Step 2: compress msgs > 5 turns ago into 1-line placeholders.
    if len(history) > HISTORY_COMPRESS_TAIL:
        head = history[:-HISTORY_COMPRESS_TAIL]
        tail = history[-HISTORY_COMPRESS_TAIL:]
        history = [_compress_msg(m) for m in head] + tail
        total = _total(system_prompt, history, chunks)
        if total <= budget:
            return system_prompt, history, chunks

    # Step 3: cap each chunk's text to CHUNK_TOKEN_CAP tokens.
    if chunks:
        capped: list[dict] = []
        for c in chunks:
            capped_text = _cap_chunk_text(c.get('text') or '', CHUNK_TOKEN_CAP)
            new_chunk = dict(c)
            new_chunk['text'] = capped_text
            capped.append(new_chunk)
        chunks = capped
        total = _total(system_prompt, history, chunks)
        if total <= budget:
            return system_prompt, history, chunks

    # Step 4: hard fail. Caller must surface this (do not silently drop).
    raise ValueError(
        f"Cannot fit under token budget {budget} even after all trims; "
        f"final total={total} (system={count_tokens(system_prompt or '')}, "
        f"history={_history_tokens(history)}, "
        f"chunks={_chunks_tokens(chunks)})."
    )


def _resolve_budget_default() -> int:
    """Resolve ``NICHE_RAG_PROMPT_TOKEN_BUDGET`` env -> int. Defaults to 8000."""
    import os

    raw = os.environ.get('NICHE_RAG_PROMPT_TOKEN_BUDGET', '8000')
    try:
        return int(raw)
    except (TypeError, ValueError):
        return 8000


__all__: list[Any] = [
    'assemble',
    'HISTORY_VERBATIM_TAIL',
    'HISTORY_COMPRESS_TAIL',
    'CHUNK_TOKEN_CAP',
]
