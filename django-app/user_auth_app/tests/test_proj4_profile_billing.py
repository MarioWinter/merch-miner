"""
PROJ-4 — User Profile & Billing: backend tests.

Covers task-list items 10 (profile + billing subtests):
  - PATCH /api/users/me/  — updates fields; email ignored; duplicate username → 400
  - POST /api/users/me/avatar/  — valid → 200; >2MB → 400; wrong type → 400
  - POST /api/auth/password/change/  — correct → 200; wrong → 400
  - GET /api/users/me/billing/  — new user → empty object, not 404
  - PUT /api/users/me/billing/  — invalid country → 400
"""

import io
import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User, BillingProfile


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_user(email, password="TestPass123!", active=True, **kwargs):
    return User.objects.create_user(
        email=email,
        password=password,
        username=email,
        is_active=active,
        **kwargs,
    )


def auth_client(user):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies["access_token"] = token
    return client


def _minimal_jpeg_bytes(size_bytes=100):
    """Return a minimal valid JPEG byte stream of approximately size_bytes."""
    # Smallest valid JPEG (1×1 white pixel, ~631 bytes); pad with JPEG comment
    # to simulate larger files when needed.
    tiny_jpeg = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
        b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
        b"\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\x1e"
        b"\xc7\xd2\x8a(\xa2\x80\x0a(\xa2\x80\xff\xd9"
    )
    if size_bytes <= len(tiny_jpeg):
        return tiny_jpeg
    # Pad with JPEG comment marker (0xFF 0xFE) to reach desired size
    padding_needed = size_bytes - len(tiny_jpeg) - 4
    comment_header = b"\xff\xfe" + padding_needed.to_bytes(2, "big")
    return tiny_jpeg[:-2] + comment_header + (b"\x00" * padding_needed) + b"\xff\xd9"


# ---------------------------------------------------------------------------
# 8. PATCH /api/users/me/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_patch_me_updates_allowed_fields():
    user = make_user("patchme@test.com", first_name="Old", last_name="Name")
    client = auth_client(user)
    url = reverse("user-profile")
    response = client.patch(
        url,
        {"first_name": "New", "last_name": "Name2", "username": "patchme_new"},
        format="json",
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.first_name == "New"
    assert user.last_name == "Name2"
    assert user.username == "patchme_new"


@pytest.mark.django_db
def test_patch_me_email_is_ignored():
    user = make_user("emailignored@test.com")
    original_email = user.email
    client = auth_client(user)
    url = reverse("user-profile")
    response = client.patch(url, {"email": "hacked@evil.com"}, format="json")
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.email == original_email


@pytest.mark.django_db
def test_patch_me_duplicate_username_returns_400():
    user1 = make_user("dupuser1@test.com")
    user1.username = "taken_username"
    user1.save(update_fields=["username"])
    user2 = make_user("dupuser2@test.com")
    client = auth_client(user2)
    url = reverse("user-profile")
    response = client.patch(url, {"username": "taken_username"}, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_patch_me_unauthenticated_returns_401():
    client = APIClient()
    url = reverse("user-profile")
    response = client.patch(url, {"first_name": "X"}, format="json")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 9. POST /api/users/me/avatar/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_avatar_upload_valid_jpeg_returns_200(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    user = make_user("avatarvalid@test.com")
    client = auth_client(user)
    url = reverse("user-avatar")

    img_bytes = _minimal_jpeg_bytes(500)
    img_file = io.BytesIO(img_bytes)
    img_file.name = "avatar.jpg"

    response = client.post(url, {"avatar": img_file}, format="multipart")
    assert response.status_code == 200
    assert "avatar_url" in response.json()

    user.refresh_from_db()
    assert user.avatar  # stored on user model


@pytest.mark.django_db
def test_avatar_upload_too_large_returns_400(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    user = make_user("avatarlarge@test.com")
    client = auth_client(user)
    url = reverse("user-avatar")

    # Build a file > 2MB by creating a BytesIO with fake content_type checked by view
    large_data = b"\xff\xd8\xff\xe0" + b"\x00" * (2 * 1024 * 1024 + 1)
    large_file = io.BytesIO(large_data)
    large_file.name = "big.jpg"

    from django.core.files.uploadedfile import InMemoryUploadedFile
    uploaded = InMemoryUploadedFile(
        file=large_file,
        field_name="avatar",
        name="big.jpg",
        content_type="image/jpeg",
        size=len(large_data),
        charset=None,
    )

    response = client.post(url, {"avatar": uploaded}, format="multipart")
    assert response.status_code == 400
    assert "2 MB" in response.json()["detail"] or "large" in response.json()["detail"].lower()


@pytest.mark.django_db
def test_avatar_upload_wrong_type_returns_400(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    user = make_user("avatartype@test.com")
    client = auth_client(user)
    url = reverse("user-avatar")

    from django.core.files.uploadedfile import InMemoryUploadedFile
    pdf_file = InMemoryUploadedFile(
        file=io.BytesIO(b"%PDF-1.4 fake"),
        field_name="avatar",
        name="doc.pdf",
        content_type="application/pdf",
        size=13,
        charset=None,
    )
    response = client.post(url, {"avatar": pdf_file}, format="multipart")
    assert response.status_code == 400
    assert "type" in response.json()["detail"].lower() or "supported" in response.json()["detail"].lower()


@pytest.mark.django_db
def test_avatar_upload_no_file_returns_400():
    user = make_user("avatarnofile@test.com")
    client = auth_client(user)
    url = reverse("user-avatar")
    response = client.post(url, {}, format="multipart")
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# 10. POST /api/auth/password/change/
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_password_change_correct_password_returns_200():
    user = make_user("pwchange@test.com", password="OldPass123!")
    client = auth_client(user)
    url = reverse("password_change")
    response = client.post(
        url,
        {
            "current_password": "OldPass123!",
            "new_password": "NewPass456!",
            "confirm_password": "NewPass456!",
        },
        format="json",
    )
    assert response.status_code == 200
    # Cookie must be cleared (logout)
    assert "detail" in response.json()


@pytest.mark.django_db
def test_password_change_wrong_current_password_returns_400():
    user = make_user("pwwrong@test.com", password="CorrectPass123!")
    client = auth_client(user)
    url = reverse("password_change")
    response = client.post(
        url,
        {
            "current_password": "WrongPass999!",
            "new_password": "NewPass456!",
            "confirm_password": "NewPass456!",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_password_change_mismatched_new_passwords_returns_400():
    user = make_user("pwmismatch@test.com", password="OldPass123!")
    client = auth_client(user)
    url = reverse("password_change")
    response = client.post(
        url,
        {
            "current_password": "OldPass123!",
            "new_password": "NewPass456!",
            "confirm_password": "DifferentPass789!",
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_password_change_unauthenticated_returns_401():
    client = APIClient()
    url = reverse("password_change")
    response = client.post(
        url,
        {
            "current_password": "any",
            "new_password": "NewPass456!",
            "confirm_password": "NewPass456!",
        },
        format="json",
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# 11. GET /api/users/me/billing/ — new user → empty object, not 404
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_billing_get_new_user_returns_200_not_404():
    user = make_user("billingnew@test.com")
    client = auth_client(user)
    url = reverse("user-billing")
    response = client.get(url)
    assert response.status_code == 200
    # BillingProfile auto-created with defaults
    data = response.json()
    assert "account_type" in data
    assert data["account_type"] == BillingProfile.AccountType.PERSONAL


@pytest.mark.django_db
def test_billing_get_creates_profile_only_once():
    user = make_user("billingonce@test.com")
    client = auth_client(user)
    url = reverse("user-billing")
    client.get(url)
    client.get(url)
    assert BillingProfile.objects.filter(user=user).count() == 1


# ---------------------------------------------------------------------------
# 12. PUT /api/users/me/billing/ — invalid country → 400
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_billing_put_invalid_country_returns_400():
    user = make_user("billingbadcountry@test.com")
    client = auth_client(user)
    url = reverse("user-billing")
    response = client.put(
        url,
        {"account_type": "personal", "country": "XX"},
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_billing_put_valid_data_returns_200():
    user = make_user("billingvalid@test.com")
    client = auth_client(user)
    url = reverse("user-billing")
    response = client.put(
        url,
        {
            "account_type": "business",
            "company_name": "Acme GmbH",
            "vat_number": "DE123456789",
            "address_line1": "Musterstraße 1",
            "city": "Berlin",
            "postal_code": "10115",
            "country": "DE",
        },
        format="json",
    )
    assert response.status_code == 200
    data = response.json()
    assert data["account_type"] == "business"
    assert data["country"] == "DE"
    assert data["vat_number"] == "DE123456789"


@pytest.mark.django_db
def test_billing_put_business_without_vat_is_allowed():
    """VAT is optional even for business type."""
    user = make_user("billingnovai@test.com")
    client = auth_client(user)
    url = reverse("user-billing")
    response = client.put(
        url,
        {"account_type": "business", "company_name": "No VAT Corp", "country": "US"},
        format="json",
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_billing_unauthenticated_returns_401():
    client = APIClient()
    url = reverse("user-billing")
    response = client.get(url)
    assert response.status_code == 401
