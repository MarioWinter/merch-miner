"""Replicate SDK wrapper for the AI upscaler (PROJ-27).

This module is intentionally thin — it shields callers from the
``replicate`` SDK so tests can mock a single seam, and it owns the
webhook-secret rotation grace logic. Do NOT call ``replicate.run()``
anywhere; we go async (predictions API + webhook).

Reference: docs/tasks/PROJ-27-tasks.md "Replicate API Reference".
"""

from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)


class ReplicateConfigError(RuntimeError):
    """Raised when Replicate config (API token / webhook secret) is missing."""


class ReplicateSignatureError(RuntimeError):
    """Raised when webhook signature verification fails (after rotation grace).

    Distinct from any SDK-internal exception so callers don't have to import
    ``replicate.exceptions``.
    """


def _ensure_token():
    """Validate REPLICATE_API_TOKEN is configured before SDK use."""
    if not settings.REPLICATE_API_TOKEN:
        raise ReplicateConfigError(
            'REPLICATE_API_TOKEN is not set. Configure it in env vars '
            'before triggering predictions.',
        )


def start_prediction(
    *,
    image_url: str,
    scale: int,
    webhook_url: str,
    model_slug: str,
    model_version: str = '',
) -> dict[str, Any]:
    """Fire an async Replicate prediction with webhook callback.

    Returns a plain dict ``{id, status}`` so callers don't need to know about
    SDK Prediction objects.

    Raises:
        ReplicateConfigError: token missing.
        Any SDK-level transport error (caller decides retry semantics).
    """
    _ensure_token()
    import replicate  # imported lazily to keep test import cost low

    # Build the model identifier the SDK expects.
    if model_version:
        model = f'{model_slug}:{model_version}'
    else:
        model = model_slug

    prediction = replicate.predictions.create(
        model=model,
        input={
            'image': image_url,
            'scale': scale,
            # POD designs (typography / illustration) — face_enhance produces
            # artifacts on flat shapes. Locked false per spec AC-20 / Tech ref.
            'face_enhance': False,
        },
        webhook=webhook_url,
        webhook_events_filter=['completed'],
    )

    return {
        'id': getattr(prediction, 'id', ''),
        'status': getattr(prediction, 'status', 'starting'),
    }


def get_prediction(prediction_id: str) -> dict[str, Any]:
    """Poll Replicate for the current state of a prediction.

    Used by the 60s reconciler (EC-3) when a webhook is suspected lost.
    """
    _ensure_token()
    import replicate

    prediction = replicate.predictions.get(prediction_id)
    output = getattr(prediction, 'output', None)
    # Output may be string (single URL) or list-of-strings; normalize to first.
    if isinstance(output, list) and output:
        output = output[0]
    return {
        'id': getattr(prediction, 'id', prediction_id),
        'status': getattr(prediction, 'status', 'unknown'),
        'output': output,
        'error': getattr(prediction, 'error', None),
    }


def cancel_prediction(prediction_id: str) -> dict[str, Any]:
    """Cancel a running prediction. Idempotent — if already terminal,
    Replicate returns the current state without erroring.

    Returns the dict shape the caller expects: ``{id, status}``.
    Raises ReplicateConfigError when REPLICATE_API_TOKEN is missing.
    Raises whatever Replicate's SDK raises on HTTP failure — callers
    should catch + log + still mark the job failed locally so the user
    isn't stuck with a phantom running row.
    """
    _ensure_token()
    import replicate  # imported lazily to keep test import cost low

    prediction = replicate.predictions.cancel(prediction_id)
    return {
        'id': getattr(prediction, 'id', prediction_id),
        'status': getattr(prediction, 'status', 'canceled'),
    }


def verify_webhook_signature(*, headers: dict, body: str) -> None:
    """Validate a Replicate webhook signature.

    Tries the PRIMARY secret first; on failure, falls back to PREVIOUS for
    rotation grace (EC-9). Raises ``ReplicateSignatureError`` if both fail.
    """
    primary = settings.REPLICATE_WEBHOOK_SECRET
    previous = settings.REPLICATE_WEBHOOK_SECRET_PREVIOUS

    if not primary and not previous:
        raise ReplicateConfigError(
            'REPLICATE_WEBHOOK_SECRET is not set. Webhook validation refused.',
        )

    import replicate
    from replicate.webhook import WebhookSigningSecret

    last_exc: Exception | None = None
    for secret in (s for s in (primary, previous) if s):
        try:
            replicate.webhooks.validate(
                headers=headers,
                body=body,
                secret=WebhookSigningSecret(key=secret),
                # 5 min clock-skew tolerance per Replicate docs.
                tolerance=300,
            )
            return
        except Exception as exc:  # noqa: BLE001 — SDK exception type may vary
            last_exc = exc
            continue

    raise ReplicateSignatureError(
        f'Replicate webhook signature invalid (tried '
        f'{2 if previous else 1} secret(s)): {last_exc}',
    )
