"""PROJ-31 — /api/auth/me/ MUST include subscription_tier + features.

These fields drive Redux auth-state hydration on the frontend so `useCan()`
and `<Gate>` work right after login without an extra round-trip.
"""
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User


def _authenticated_client(user) -> APIClient:
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.cookies['access_token'] = str(refresh.access_token)
    return client


@pytest.mark.django_db
def test_auth_me_includes_subscription_tier_default_free():
    user = User.objects.create_user(
        email='free@test.com',
        password='TestPassword123!',
        username='free@test.com',
        is_active=True,
    )
    client = _authenticated_client(user)
    response = client.get(reverse('auth_me'))
    assert response.status_code == 200
    assert response.data['subscription_tier'] == 'free'


@pytest.mark.django_db
def test_auth_me_includes_features_for_free_user():
    user = User.objects.create_user(
        email='free@test.com',
        password='TestPassword123!',
        username='free@test.com',
        is_active=True,
    )
    client = _authenticated_client(user)
    response = client.get(reverse('auth_me'))
    assert response.status_code == 200
    assert 'niche.research' in response.data['features']
    assert '*' not in response.data['features']


@pytest.mark.django_db
def test_auth_me_features_for_staff_include_staff_only():
    user = User.objects.create_user(
        email='staff@test.com',
        password='TestPassword123!',
        username='staff@test.com',
        is_active=True,
        is_staff=True,
    )
    client = _authenticated_client(user)
    response = client.get(reverse('auth_me'))
    assert response.status_code == 200
    assert 'admin.scraper-debug' in response.data['features']


@pytest.mark.django_db
def test_auth_me_features_for_superuser_contain_wildcard():
    user = User.objects.create_user(
        email='super@test.com',
        password='TestPassword123!',
        username='super@test.com',
        is_active=True,
        is_staff=True,
        is_superuser=True,
    )
    client = _authenticated_client(user)
    response = client.get(reverse('auth_me'))
    assert response.status_code == 200
    assert '*' in response.data['features']
    assert response.data['is_superuser'] is True
    assert response.data['is_staff'] is True


@pytest.mark.django_db
def test_auth_me_returns_is_staff_is_superuser_flags():
    """Regression: MeView previously omitted these — frontend authSlice
    defaulted them to false, breaking admin UI visibility."""
    user = User.objects.create_user(
        email='regular@test.com',
        password='TestPassword123!',
        username='regular@test.com',
        is_active=True,
    )
    client = _authenticated_client(user)
    response = client.get(reverse('auth_me'))
    assert response.status_code == 200
    assert response.data['is_staff'] is False
    assert response.data['is_superuser'] is False
