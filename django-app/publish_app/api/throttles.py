"""Custom DRF throttle classes for publish_app endpoints.

Scopes are registered in ``core.settings.REST_FRAMEWORK.DEFAULT_THROTTLE_RATES``.
Each class pins a ``scope`` string so the rate can be tuned per-deploy without
touching code.
"""

from rest_framework.throttling import UserRateThrottle


class AIImproveThrottle(UserRateThrottle):
    """Per-user rate limit for the AI Improve listing endpoint.

    Guards OpenRouter spend on ``POST /api/listings/{id}/ai-improve/``.
    Rate (``10/min``) resolved from ``DEFAULT_THROTTLE_RATES['ai_improve']``.
    """

    scope = 'ai_improve'
