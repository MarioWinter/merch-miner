"""PROJ-20 Phase 7.3 — Vision streaming helpers.

When the user attaches images to a chat message we bypass Vane (which has
no native vision support) and call OpenRouter directly via langchain-openai.
The streaming generator emits the same SSE event shapes as the Vane path
(`init` / `chunk` / `done` / `error`) so the frontend doesn't need to fork.
"""

from __future__ import annotations

import base64
import logging
from collections.abc import Iterator
from typing import Any

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from langchain_openai import ChatOpenAI

from chat_attachments_app.constants import (
    DEFAULT_VISION_MODEL,
    VISION_CAPABLE_MODELS,
)
from chat_attachments_app.models import AppSettings, ChatAttachment

logger = logging.getLogger(__name__)


class AttachmentResolutionError(Exception):
    """Raised when one or more attachment ids cannot be resolved for the
    caller's workspace. Mapped to HTTP 404 by the view."""


def resolve_attachments(
    attachment_ids: list[str],
    workspace,
) -> list[ChatAttachment]:
    """Fetch attachments for the workspace; raise if any id is missing.

    Order of returned list matches the order of `attachment_ids` so the
    LLM sees images in the order the user dropped them.
    """
    if not attachment_ids:
        return []
    qs = ChatAttachment.objects.filter(
        id__in=attachment_ids,
        workspace=workspace,
    )
    by_id = {str(a.id): a for a in qs}
    missing = [aid for aid in attachment_ids if aid not in by_id]
    if missing:
        raise AttachmentResolutionError(
            f'Attachments not found or not in your workspace: {missing}'
        )
    return [by_id[aid] for aid in attachment_ids]


def build_vision_content_blocks(
    text: str,
    attachments: list[ChatAttachment],
) -> list[dict[str, Any]]:
    """Build the `content` payload for the human message.

    Format follows OpenAI's chat-completions vision schema, which OpenRouter
    proxies for vision-capable models:

        [
          {"type": "text", "text": "..."},
          {"type": "image_url", "image_url": {"url": "data:image/webp;base64,..."}},
          ...
        ]
    """
    blocks: list[dict[str, Any]] = [{'type': 'text', 'text': text}]
    for att in attachments:
        if att.purged_at is not None or not att.file:
            continue
        try:
            with att.file.open('rb') as fh:
                raw = fh.read()
        except (OSError, ValueError):
            logger.warning('Could not read attachment %s', att.id)
            continue
        encoded = base64.b64encode(raw).decode('ascii')
        blocks.append({
            'type': 'image_url',
            'image_url': {
                'url': f'data:{att.mime_type};base64,{encoded}',
            },
        })
    return blocks


def resolve_vision_model(selected_model: str | None) -> tuple[str, bool]:
    """Decide which model to use given the user's selection.

    Returns (effective_model, fallback_fired). `fallback_fired=True` means
    the original selection wasn't vision-capable so we swapped in the
    AppSettings default — frontend should show a Snackbar.
    """
    if selected_model and selected_model in VISION_CAPABLE_MODELS:
        return selected_model, False
    try:
        app_settings = AppSettings.get_solo()
        fallback = app_settings.vision_model
    except ObjectDoesNotExist:  # pragma: no cover
        fallback = DEFAULT_VISION_MODEL
    return fallback, True


def build_vision_llm(model: str) -> ChatOpenAI:
    """Construct a streaming ChatOpenAI instance pointed at OpenRouter.

    Mirrors `niche_research_app.graph.llm.get_llm_for_node`'s settings —
    we re-use the same env-driven config rather than introducing a parallel
    client.
    """
    kwargs: dict[str, Any] = {
        'model': model,
        'temperature': 0.4,
        'streaming': True,
        'base_url': settings.OPENROUTER_BASE_URL,
        'api_key': settings.OPENROUTER_API_KEY,
        'default_headers': {
            'HTTP-Referer': getattr(settings, 'FRONTEND_URL', ''),
            'X-OpenRouter-Title': getattr(settings, 'COMPANY_NAME', 'Merch Miner'),
        },
    }
    return ChatOpenAI(**kwargs)


def stream_vision_chunks(
    user_content_blocks: list[dict[str, Any]],
    history: list[dict[str, str]],
    model: str,
    system_instructions: str = '',
) -> Iterator[str]:
    """Yield text chunks from the LLM stream. Caller is responsible for
    formatting these as SSE frames.
    """
    llm = build_vision_llm(model)

    messages: list[Any] = []
    if system_instructions:
        messages.append(('system', system_instructions))
    for prev in history:
        role = prev.get('role')
        content = prev.get('content', '')
        if role in ('user', 'assistant') and content:
            messages.append((role, content))
    messages.append(('user', user_content_blocks))

    for chunk in llm.stream(messages):
        text = getattr(chunk, 'content', '')
        if isinstance(text, list):
            # Some providers stream content blocks even for output. Concat
            # any text-typed blocks.
            text = ''.join(
                b.get('text', '') for b in text if isinstance(b, dict)
            )
        if text:
            yield text
