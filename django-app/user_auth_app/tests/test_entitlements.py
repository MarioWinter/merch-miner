"""PROJ-31 — unit tests for `core.entitlements.resolve_features`."""
import pytest
from django.contrib.auth.models import AnonymousUser

from core.entitlements import (
    STAFF_ONLY_FEATURES,
    SUPERUSER_FEATURES,
    TIER_FEATURES,
    resolve_features,
)
from user_auth_app.models import User


@pytest.mark.django_db
def test_resolve_features_anonymous_returns_empty():
    """Unauthenticated user -> []."""
    assert resolve_features(AnonymousUser()) == []


@pytest.mark.django_db
def test_resolve_features_none_returns_empty():
    """None user -> [] (defensive)."""
    assert resolve_features(None) == []


@pytest.mark.django_db
def test_resolve_features_free_tier():
    """Free user -> exactly TIER_FEATURES['free'], no staff or superuser keys."""
    user = User.objects.create_user(
        email='free@test.com',
        password='TestPassword123!',
        username='free@test.com',
        is_active=True,
    )
    features = resolve_features(user)
    assert features == [
        'niche.research',
        'amazon.basic-search',
        'design.gallery',
        'slogan.basic',
    ]
    # Negative checks — no staff/superuser leakage.
    assert '*' not in features
    for k in STAFF_ONLY_FEATURES:
        assert k not in features


@pytest.mark.django_db
def test_resolve_features_staff_free_appends_staff_only():
    """is_staff=True user gets tier features + STAFF_ONLY_FEATURES, deduplicated."""
    user = User.objects.create_user(
        email='staff@test.com',
        password='TestPassword123!',
        username='staff@test.com',
        is_active=True,
        is_staff=True,
    )
    features = resolve_features(user)
    expected = TIER_FEATURES['free'] + STAFF_ONLY_FEATURES
    assert features == expected
    assert '*' not in features


@pytest.mark.django_db
def test_resolve_features_superuser_has_wildcard():
    """is_superuser=True user gets '*' wildcard."""
    user = User.objects.create_user(
        email='super@test.com',
        password='TestPassword123!',
        username='super@test.com',
        is_active=True,
        is_staff=True,
        is_superuser=True,
    )
    features = resolve_features(user)
    assert '*' in features
    # Tier + staff keys still present (wildcard is appended, not replacing).
    for k in TIER_FEATURES['free']:
        assert k in features
    for k in STAFF_ONLY_FEATURES:
        assert k in features


@pytest.mark.django_db
def test_resolve_features_deduplicates(monkeypatch):
    """If a tier and STAFF_ONLY share a key, resolve_features returns it once."""
    # Inject a collision between tier and staff lists.
    monkeypatch.setitem(TIER_FEATURES, 'free', ['niche.research', 'kanban'])
    user = User.objects.create_user(
        email='dedup@test.com',
        password='TestPassword123!',
        username='dedup@test.com',
        is_active=True,
        is_staff=True,
    )
    features = resolve_features(user)
    # 'kanban' exists in both injected free tier and STAFF_ONLY_FEATURES.
    assert features.count('kanban') == 1
    assert features.count('niche.research') == 1


@pytest.mark.django_db
def test_resolve_features_unknown_tier_falls_back_to_empty():
    """User with an unknown tier value gets [] from tier lookup (defensive)."""
    user = User.objects.create_user(
        email='weird@test.com',
        password='TestPassword123!',
        username='weird@test.com',
        is_active=True,
    )
    # Bypass model validation to simulate a stale or DB-edited tier value.
    user.subscription_tier = 'enterprise'
    features = resolve_features(user)
    assert features == []


def test_module_constants_shape():
    """Sanity check: catalogue constants exist and are the right shapes."""
    assert isinstance(TIER_FEATURES, dict)
    assert set(TIER_FEATURES.keys()) == {'free', 'pro', 'premium', 'business'}
    assert isinstance(STAFF_ONLY_FEATURES, list)
    assert SUPERUSER_FEATURES == ['*']
