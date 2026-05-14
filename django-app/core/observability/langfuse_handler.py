"""Langfuse callback-handler factory (shared across apps).

PROJ-29 AC-25/AC-26: moved here from `niche_research_app/tasks.py` so that
both niche-research workflows and the chat-agent (`search_app`) can import
from one place. The legacy `niche_research_app.tasks._get_langfuse_handler`
re-exports this function for backwards compatibility.

When `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` are unset, returns `None`
silently (per AC-26: spans short-circuit to a debug log line; no crashes,
no slowdown).
"""

import logging
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


def get_langfuse_handler(
    trace_name: str = '',
    trace_id: str = '',
    metadata: Optional[dict] = None,
):
    """Return a `langfuse.langchain.CallbackHandler` or `None` if disabled.

    langfuse v4: initialize the singleton Langfuse client with credentials,
    then return a CallbackHandler. Trace context (trace_id, trace_name,
    metadata) is attached at invocation time via the caller's run config —
    these parameters are accepted for caller ergonomics but the v4 client
    auto-discovers context from the active span.
    """
    if not settings.LANGFUSE_PUBLIC_KEY or not settings.LANGFUSE_SECRET_KEY:
        logger.debug(
            "Langfuse credentials missing; observability disabled "
            "(trace_name=%s, trace_id=%s).",
            trace_name, trace_id,
        )
        return None
    try:
        from langfuse import Langfuse
        from langfuse.langchain import CallbackHandler

        Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            base_url=settings.LANGFUSE_HOST,
        )
        return CallbackHandler()
    except ImportError:
        logger.warning("langfuse package not installed, skipping tracing")
        return None
    except Exception:  # pragma: no cover - defensive: telemetry must never break the call
        logger.warning(
            "Langfuse handler init failed; continuing without tracing.",
            exc_info=True,
        )
        return None
