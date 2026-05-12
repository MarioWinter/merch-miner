"""Sentry capture wrapper for the chat-agent surface (PROJ-29, AC-Ops-Obs-2).

`capture_chat_error(session_id, user_id, exception, **extra)` sends an event
with the chat-context tags (workspace_id, user_id, session_id, niche_id)
but redacts `message_content` unless `SENTRY_INCLUDE_USER_INPUT=true`.

No-ops silently when `sentry-sdk` is not installed or `SENTRY_DSN` is unset.
"""

import logging
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)


def _include_user_input() -> bool:
    return getattr(settings, 'SENTRY_INCLUDE_USER_INPUT', False) is True


def capture_chat_error(
    session_id: str,
    user_id: Optional[str],
    exception: BaseException,
    **extra,
) -> None:
    """Send a chat-domain exception to Sentry with safe context.

    `extra` may include `workspace_id`, `niche_id`, `message_content`. The
    `message_content` field is stripped unless `SENTRY_INCLUDE_USER_INPUT=true`.
    """
    try:
        import sentry_sdk
    except ImportError:
        logger.debug("sentry-sdk not installed; skipping capture for %r", exception)
        return

    if not getattr(settings, 'SENTRY_DSN', ''):
        logger.debug("SENTRY_DSN unset; skipping capture for %r", exception)
        return

    safe_extra = dict(extra)
    if not _include_user_input():
        safe_extra.pop('message_content', None)

    try:
        with sentry_sdk.push_scope() as scope:
            scope.set_tag('chat.session_id', str(session_id))
            if user_id is not None:
                scope.set_tag('chat.user_id', str(user_id))
            for key, value in safe_extra.items():
                scope.set_extra(key, value)
            sentry_sdk.capture_exception(exception)
    except Exception:  # pragma: no cover - telemetry must never break the call
        logger.warning("Sentry capture failed", exc_info=True)
