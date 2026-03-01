import pytest
from django.urls import reverse
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework_simplejwt.tokens import RefreshToken
from user_auth_app.models import User


# ---------------------------------------------------------------------------
# POST /api/auth/activate/  (body: { uid, token }) — used by the React SPA
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_activate_post_success(client):
    """POST activate with valid uid+token activates account."""
    user = User.objects.create_user(
        email='testuser@test.com',
        password='TestPassword123!',
        username='testuser@test.com',
        is_active=False
    )

    refresh = RefreshToken.for_user(user)
    token = str(refresh.access_token)
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))

    url = reverse('activate_post')
    response = client.post(url, {'uid': uidb64, 'token': token}, content_type='application/json')

    user.refresh_from_db()
    assert response.status_code == 200
    assert response.data['message'] == 'Account successfully activated.'
    assert user.is_active is True


@pytest.mark.django_db
def test_activate_post_already_active(client):
    """POST activate on already-active account returns 200."""
    user = User.objects.create_user(
        email='testuser@test.com',
        password='TestPassword123!',
        username='testuser@test.com',
        is_active=True
    )

    refresh = RefreshToken.for_user(user)
    token = str(refresh.access_token)
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))

    url = reverse('activate_post')
    response = client.post(url, {'uid': uidb64, 'token': token}, content_type='application/json')

    assert response.status_code == 200
    assert response.data['message'] == 'Account successfully activated.'


@pytest.mark.django_db
def test_activate_post_invalid_token(client):
    """POST activate with invalid token returns 400."""
    user = User.objects.create_user(
        email='testuser@test.com',
        password='TestPassword123!',
        username='testuser@test.com',
        is_active=False
    )

    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))

    url = reverse('activate_post')
    response = client.post(url, {'uid': uidb64, 'token': 'invalid_token'}, content_type='application/json')

    user.refresh_from_db()
    assert response.status_code == 400
    assert response.data['message'] == 'Account activation failed.'
    assert user.is_active is False


@pytest.mark.django_db
def test_activate_post_missing_fields(client):
    """POST activate with missing uid/token returns 400."""
    url = reverse('activate_post')
    response = client.post(url, {}, content_type='application/json')

    assert response.status_code == 400
    assert response.data['message'] == 'Account activation failed.'


@pytest.mark.django_db
def test_activate_post_token_for_different_user(client):
    """POST activate with token belonging to a different user returns 400."""
    user1 = User.objects.create_user(
        email='user1@test.com',
        password='TestPassword123!',
        username='user1@test.com',
        is_active=False
    )
    user2 = User.objects.create_user(
        email='user2@test.com',
        password='TestPassword123!',
        username='user2@test.com',
        is_active=False
    )

    refresh = RefreshToken.for_user(user2)
    token = str(refresh.access_token)
    uidb64 = urlsafe_base64_encode(force_bytes(user1.pk))

    url = reverse('activate_post')
    response = client.post(url, {'uid': uidb64, 'token': token}, content_type='application/json')

    user1.refresh_from_db()
    assert response.status_code == 400
    assert response.data['message'] == 'Account activation failed.'
    assert user1.is_active is False


# ---------------------------------------------------------------------------
# GET /api/auth/activate/<uidb64>/<token>/  — direct email link fallback
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_activate_user_success(client):
    """GET activate with valid path params activates account."""
    user = User.objects.create_user(
        email='testuser@test.com',
        password='TestPassword123!',
        username='testuser@test.com',
        is_active=False
    )

    refresh = RefreshToken.for_user(user)
    token = str(refresh.access_token)
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))

    url = reverse('activate', kwargs={'uidb64': uidb64, 'token': token})
    response = client.get(url)

    user.refresh_from_db()
    assert response.status_code == 200
    assert response.data['message'] == 'Account successfully activated.'
    assert user.is_active is True

@pytest.mark.django_db
def test_activate_user_already_active(client):
    """GET activate on already-active account returns 200."""
    user = User.objects.create_user(
        email='testuser@test.com',
        password='TestPassword123!',
        username='testuser@test.com',
        is_active=True
    )

    refresh = RefreshToken.for_user(user)
    token = str(refresh.access_token)
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))

    url = reverse('activate', kwargs={'uidb64': uidb64, 'token': token})
    response = client.get(url)

    assert response.status_code == 200
    assert response.data['message'] == 'Account successfully activated.'

@pytest.mark.django_db
def test_activate_user_invalid_token(client):
    """GET activate with invalid token returns 400."""
    user = User.objects.create_user(
        email='testuser@test.com',
        password='TestPassword123!',
        username='testuser@test.com',
        is_active=False
    )

    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    invalid_token = 'invalid_token'

    url = reverse('activate', kwargs={'uidb64': uidb64, 'token': invalid_token})
    response = client.get(url)

    user.refresh_from_db()
    assert response.status_code == 400
    assert response.data['message'] == 'Account activation failed.'
    assert user.is_active is False

@pytest.mark.django_db
def test_activate_user_invalid_uid(client):
    """GET activate with non-existent uid returns 400."""
    user = User.objects.create_user(
        email='testuser@test.com',
        password='TestPassword123!',
        username='testuser@test.com',
        is_active=False
    )

    refresh = RefreshToken.for_user(user)
    token = str(refresh.access_token)
    invalid_uidb64 = urlsafe_base64_encode(force_bytes(99999))

    url = reverse('activate', kwargs={'uidb64': invalid_uidb64, 'token': token})
    response = client.get(url)

    assert response.status_code == 400
    assert response.data['message'] == 'Account activation failed.'

@pytest.mark.django_db
def test_activate_user_token_for_different_user(client):
    """GET activate with token belonging to a different user returns 400."""
    user1 = User.objects.create_user(
        email='user1@test.com',
        password='TestPassword123!',
        username='user1@test.com',
        is_active=False
    )
    user2 = User.objects.create_user(
        email='user2@test.com',
        password='TestPassword123!',
        username='user2@test.com',
        is_active=False
    )

    refresh = RefreshToken.for_user(user2)
    token = str(refresh.access_token)
    uidb64 = urlsafe_base64_encode(force_bytes(user1.pk))

    url = reverse('activate', kwargs={'uidb64': uidb64, 'token': token})
    response = client.get(url)

    user1.refresh_from_db()
    assert response.status_code == 400
    assert response.data['message'] == 'Account activation failed.'
    assert user1.is_active is False
