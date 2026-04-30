"""Budget-exhaustion detection + workflow pause (AC-45).

OpenRouter responds with HTTP 402 when the API key has run out of credits.
Langchain's `ChatOpenAI` wraps the underlying OpenAI SDK exceptions
transparently, so the 402 surfaces as one of:

- `openai.AuthenticationError` (some keys)
- `openai.PermissionDeniedError`
- `openai.RateLimitError` (rare)
- `openai.APIStatusError` with status_code=402
- `httpx.HTTPStatusError` with response.status_code=402
- A generic Exception whose args contain "402" or "insufficient_quota" /
  "insufficient_credits"

`is_budget_error()` introspects whichever shape arrived without monkey-
patching ChatOpenAI.

`pause_for_budget()` flips the session into PAUSED, persists the
``error_message`` and emits a system AgentMessage so the frontend renders
"Agent budget exhausted" verbatim per spec.
"""

from __future__ import annotations

import logging

from agent_app.models import AgentMessage, AgentSession, MessageRole, SessionStatus

logger = logging.getLogger(__name__)

BUDGET_EXHAUSTED_MESSAGE = 'Agent budget exhausted'

_BUDGET_KEYWORDS = (
    '402',
    'insufficient_quota',
    'insufficient credits',
    'insufficient_credits',
    'budget exhausted',
    'payment required',
)


def _has_status_code(exc: BaseException, code: int) -> bool:
    """Best-effort status-code introspection on common SDK exception shapes."""
    # openai SDK >= 1.x — APIStatusError exposes `.status_code`
    sc = getattr(exc, 'status_code', None)
    if sc == code:
        return True
    # httpx-style — `.response.status_code`
    response = getattr(exc, 'response', None)
    if response is not None and getattr(response, 'status_code', None) == code:
        return True
    return False


def is_budget_error(exc: BaseException) -> bool:
    """Return True if `exc` looks like an OpenRouter 402 / out-of-credits."""
    if exc is None:
        return False

    if _has_status_code(exc, 402):
        return True

    # Walk exception cause chain (langchain wraps).
    cause = getattr(exc, '__cause__', None) or getattr(exc, '__context__', None)
    if cause is not None and cause is not exc:
        if _has_status_code(cause, 402):
            return True

    text_parts = [str(exc)]
    for attr in ('message', 'body'):
        val = getattr(exc, attr, None)
        if val:
            text_parts.append(str(val))
    haystack = ' '.join(text_parts).lower()
    return any(keyword in haystack for keyword in _BUDGET_KEYWORDS)


def pause_for_budget(session: AgentSession) -> None:
    """Flip the session into PAUSED + emit a system message (AC-45).

    Idempotent — safe to call from multiple recovery paths (orchestrator
    wrapper + per-tool guard) without duplicating messages.
    """
    if session.status == SessionStatus.PAUSED and \
            session.error_message == BUDGET_EXHAUSTED_MESSAGE:
        # Already paused for the same reason — skip duplicate writes.
        return

    session.status = SessionStatus.PAUSED
    session.error_message = BUDGET_EXHAUSTED_MESSAGE
    session.save(update_fields=['status', 'error_message', 'updated_at'])

    # Avoid duplicate system message if one already exists for this session.
    already_emitted = AgentMessage.objects.filter(
        session=session,
        role=MessageRole.SYSTEM,
        content=BUDGET_EXHAUSTED_MESSAGE,
    ).exists()
    if not already_emitted:
        AgentMessage.objects.create(
            session=session,
            role=MessageRole.SYSTEM,
            agent_type='orchestrator',
            content=BUDGET_EXHAUSTED_MESSAGE,
        )

    logger.warning(
        'Session %s paused: budget exhausted (workspace=%s)',
        session.pk, session.workspace_id,
    )


__all__ = [
    'BUDGET_EXHAUSTED_MESSAGE',
    'is_budget_error',
    'pause_for_budget',
]
