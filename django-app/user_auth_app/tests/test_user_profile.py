"""
User profile endpoint tests — migrated to PROJ-4 API (UserProfileView).

Old UserProfileViewSet (router-based) was replaced by:
  GET  /api/users/me/   → user-profile
  PATCH /api/users/me/  → user-profile
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken
from user_auth_app.models import User


def auth_client(user):
    client = APIClient()
    client.cookies["access_token"] = str(RefreshToken.for_user(user).access_token)
    return client


@pytest.mark.django_db
def test_user_profile_get_authenticated():
    """Authenticated user can retrieve their own profile."""
    user = User.objects.create_user(
        email="testuser@test.com",
        password="TestPassword123!",
        username="testuser@test.com",
        is_active=True,
        first_name="Test",
        last_name="User",
    )
    client = auth_client(user)
    url = reverse("user-profile")
    response = client.get(url)

    assert response.status_code == 200
    profile = response.json()
    assert profile["email"] == "testuser@test.com"
    assert profile["username"] == "testuser@test.com"
    assert profile["first_name"] == "Test"
    assert profile["last_name"] == "User"
    assert "id" in profile
    assert "date_joined" in profile


@pytest.mark.django_db
def test_user_profile_get_unauthenticated():
    """Unauthenticated request to profile endpoint returns 401."""
    api_client = APIClient()
    url = reverse("user-profile")
    response = api_client.get(url)
    assert response.status_code == 401


@pytest.mark.django_db
def test_user_profile_update_patch():
    """PATCH updates first_name and last_name."""
    user = User.objects.create_user(
        email="testuser@test.com",
        password="TestPassword123!",
        username="testuser@test.com",
        is_active=True,
        first_name="Old",
        last_name="Name",
    )
    client = auth_client(user)
    url = reverse("user-profile")
    response = client.patch(
        url, {"first_name": "New", "last_name": "Name"}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["first_name"] == "New"
    assert response.json()["last_name"] == "Name"
    assert response.json()["email"] == "testuser@test.com"

    user.refresh_from_db()
    assert user.first_name == "New"
    assert user.last_name == "Name"


@pytest.mark.django_db
def test_user_profile_update_put_not_allowed():
    """PUT is not supported on /api/users/me/ — returns 405."""
    user = User.objects.create_user(
        email="testuser@test.com",
        password="TestPassword123!",
        username="testuser@test.com",
        is_active=True,
    )
    client = auth_client(user)
    url = reverse("user-profile")
    response = client.put(
        url,
        {"email": "testuser@test.com", "first_name": "Completely", "last_name": "New"},
        format="json",
    )
    assert response.status_code == 405


@pytest.mark.django_db
def test_user_profile_readonly_fields():
    """email and date_joined are read-only; username is now writable."""
    user = User.objects.create_user(
        email="testuser@test.com",
        password="TestPassword123!",
        username="testuser@test.com",
        is_active=True,
    )
    original_date_joined = user.date_joined
    original_email = user.email

    client = auth_client(user)
    url = reverse("user-profile")
    response = client.patch(
        url,
        {"email": "hacked@evil.com", "date_joined": "2020-01-01T00:00:00Z", "first_name": "Updated"},
        format="json",
    )

    assert response.status_code == 200
    assert response.json()["first_name"] == "Updated"
    # email must remain unchanged
    assert response.json()["email"] == original_email

    user.refresh_from_db()
    assert user.email == original_email
    assert user.date_joined == original_date_joined
    assert user.first_name == "Updated"


@pytest.mark.django_db
def test_user_profile_only_own_profile():
    """
    /api/users/me/ always returns the authenticated user's profile.
    There is no per-ID lookup — another user's data is never accessible.
    """
    user1 = User.objects.create_user(
        email="user1@test.com",
        password="TestPassword123!",
        username="user1@test.com",
        is_active=True,
    )
    User.objects.create_user(
        email="user2@test.com",
        password="TestPassword123!",
        username="user2@test.com",
        is_active=True,
    )
    client = auth_client(user1)
    url = reverse("user-profile")
    response = client.get(url)

    assert response.status_code == 200
    # Must return user1's data only
    assert response.json()["email"] == "user1@test.com"


@pytest.mark.django_db
def test_user_profile_invalid_methods():
    """DELETE on /api/users/me/ returns 405."""
    user = User.objects.create_user(
        email="test@test.com",
        password="TestPassword123!",
        username="test@test.com",
        is_active=True,
    )
    client = auth_client(user)
    url = reverse("user-profile")
    response = client.delete(url)
    assert response.status_code == 405
