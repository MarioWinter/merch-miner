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
def test_user_profile_includes_admin_flags():
    """PROJ-24 AC-20b: /api/users/me/ must include is_staff + is_superuser as bools."""
    user = User.objects.create_user(
        email="regular@test.com",
        password="TestPassword123!",
        username="regular@test.com",
        is_active=True,
    )
    client = auth_client(user)
    url = reverse("user-profile")
    response = client.get(url)

    assert response.status_code == 200
    profile = response.json()
    assert "is_staff" in profile
    assert "is_superuser" in profile
    assert isinstance(profile["is_staff"], bool)
    assert isinstance(profile["is_superuser"], bool)
    assert profile["is_staff"] is False
    assert profile["is_superuser"] is False


@pytest.mark.django_db
def test_user_profile_admin_flags_true_for_staff():
    """PROJ-24 AC-20b: is_staff=True user → response shows is_staff: true."""
    user = User.objects.create_user(
        email="staff@test.com",
        password="TestPassword123!",
        username="staff@test.com",
        is_active=True,
        is_staff=True,
    )
    client = auth_client(user)
    url = reverse("user-profile")
    response = client.get(url)

    assert response.status_code == 200
    profile = response.json()
    assert profile["is_staff"] is True
    assert profile["is_superuser"] is False


@pytest.mark.django_db
def test_user_profile_admin_flags_readonly():
    """PROJ-24 AC-20b: is_staff + is_superuser must NEVER be settable via PATCH."""
    user = User.objects.create_user(
        email="readonly@test.com",
        password="TestPassword123!",
        username="readonly@test.com",
        is_active=True,
        is_staff=False,
        is_superuser=False,
    )
    client = auth_client(user)
    url = reverse("user-profile")
    response = client.patch(
        url,
        {"is_staff": True, "is_superuser": True, "first_name": "Updated"},
        format="json",
    )

    assert response.status_code == 200
    user.refresh_from_db()
    # Privilege escalation must be impossible.
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.first_name == "Updated"


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


# ---------------------------------------------------------------------------
# PROJ-31 — subscription_tier + features in /api/users/me/ payload
# ---------------------------------------------------------------------------


@pytest.mark.django_db
def test_user_profile_includes_subscription_tier_default_free():
    """PROJ-31 AC-5: /me/ exposes subscription_tier; default for new users is 'free'."""
    user = User.objects.create_user(
        email="freetier@test.com",
        password="TestPassword123!",
        username="freetier@test.com",
        is_active=True,
    )
    client = auth_client(user)
    response = client.get(reverse("user-profile"))
    assert response.status_code == 200
    body = response.json()
    assert body["subscription_tier"] == "free"


@pytest.mark.django_db
def test_user_profile_includes_features_list_for_free_user():
    """PROJ-31 AC-5: /me/ returns features[] resolved from tier (free baseline)."""
    user = User.objects.create_user(
        email="free2@test.com",
        password="TestPassword123!",
        username="free2@test.com",
        is_active=True,
    )
    client = auth_client(user)
    body = client.get(reverse("user-profile")).json()
    assert isinstance(body["features"], list)
    assert body["features"] == [
        "niche.research",
        "amazon.basic-search",
        "design.gallery",
        "slogan.basic",
    ]
    assert "*" not in body["features"]


@pytest.mark.django_db
def test_user_profile_features_for_staff_includes_staff_only():
    """PROJ-31: staff (non-superuser) sees STAFF_ONLY_FEATURES appended."""
    user = User.objects.create_user(
        email="profstaff@test.com",
        password="TestPassword123!",
        username="profstaff@test.com",
        is_active=True,
        is_staff=True,
    )
    client = auth_client(user)
    body = client.get(reverse("user-profile")).json()
    assert "admin.scraper-debug" in body["features"]
    assert "kanban" in body["features"]
    assert "*" not in body["features"]


@pytest.mark.django_db
def test_user_profile_features_for_superuser_contains_wildcard():
    """PROJ-31: superuser features list contains '*'."""
    user = User.objects.create_user(
        email="profsuper@test.com",
        password="TestPassword123!",
        username="profsuper@test.com",
        is_active=True,
        is_staff=True,
        is_superuser=True,
    )
    client = auth_client(user)
    body = client.get(reverse("user-profile")).json()
    assert "*" in body["features"]


@pytest.mark.django_db
def test_user_profile_subscription_tier_readonly_via_patch():
    """PROJ-31: clients MUST NOT be able to bump their own tier via PATCH."""
    user = User.objects.create_user(
        email="upgrade@test.com",
        password="TestPassword123!",
        username="upgrade@test.com",
        is_active=True,
    )
    client = auth_client(user)
    response = client.patch(
        reverse("user-profile"),
        {"subscription_tier": "business", "first_name": "Stays"},
        format="json",
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.subscription_tier == "free"
    assert user.first_name == "Stays"
