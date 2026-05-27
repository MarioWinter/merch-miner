"""
PROJ-31 — Entitlement resolution.

Single source of truth for "which features does this user have access to?".
Pure-Python in-memory lookup; no DB calls beyond the User instance already
loaded by DRF auth.

The 2-layer model (per ADR-001):
  1. Entitlement layer — TIER_FEATURES + STAFF_ONLY_FEATURES + SUPERUSER_FEATURES
  2. Permission layer  — HasFeature DRF permission class consumes resolve_features()

Polar.sh (PROJ-32) writes to `user.subscription_tier`; frontend consumes the
resolved list via /api/users/me/.
"""
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    # Avoid circular import at module load — User imports nothing from here.
    from user_auth_app.models import User  # noqa: F401


# Feature catalogue — `dotted.namespace.action` keys per spec Q4.
TIER_FEATURES: dict[str, list[str]] = {
    'free': [
        'niche.research',
        'amazon.basic-search',
        'design.gallery',
        'slogan.basic',
    ],
    'pro': [
        # Placeholder — populated when pricing finalised (spec Q-A2).
    ],
    'premium': [],
    'business': [],
}

# Features visible only to is_staff=True users (in-development, admin-debug, beta).
# All 5 ex-PROJ-24 flags start here; individual keys later migrate into paid tiers.
STAFF_ONLY_FEATURES: list[str] = [
    'amazon.multi-marketplace',
    'keyword.junglescout',
    'cloud.storage',
    'desktop.upload',
    'kanban',
    'experimental.new-editor',
    'admin.scraper-debug',
    'admin.user-impersonate',
]

# Wildcard — superusers see everything regardless of catalogue.
SUPERUSER_FEATURES: list[str] = ['*']


def resolve_features(user) -> list[str]:
    """Return deduplicated list of feature keys the user has access to.

    Anonymous users get []. Authenticated users get their tier features plus
    STAFF_ONLY_FEATURES if is_staff, plus '*' if is_superuser. Order preserved,
    duplicates removed.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return []

    features: list[str] = list(TIER_FEATURES.get(user.subscription_tier, []))
    if user.is_staff:
        features.extend(STAFF_ONLY_FEATURES)
    if user.is_superuser:
        features.extend(SUPERUSER_FEATURES)

    # Dedup while preserving order.
    seen: set[str] = set()
    return [f for f in features if not (f in seen or seen.add(f))]
