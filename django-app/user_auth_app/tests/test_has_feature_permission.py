"""PROJ-31 — integration tests for the HasFeature DRF permission factory."""
import logging

import pytest
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.views import APIView

from user_auth_app.api.permissions import HasFeature
from user_auth_app.models import User


# --- Test view --------------------------------------------------------------

class _TierGatedView(APIView):
    """View used only inside this test module to exercise HasFeature."""

    permission_classes = [IsAuthenticated, HasFeature('niche.research')]

    def get(self, request):
        return Response({'ok': True})


class _StaffGatedView(APIView):
    permission_classes = [IsAuthenticated, HasFeature('admin.scraper-debug')]

    def get(self, request):
        return Response({'ok': True})


# --- Helpers ---------------------------------------------------------------

def _make_user(**overrides):
    defaults = dict(
        email='gate@test.com',
        password='TestPassword123!',
        username='gate@test.com',
        is_active=True,
    )
    defaults.update(overrides)
    return User.objects.create_user(**defaults)


# --- Tests -----------------------------------------------------------------

@pytest.mark.django_db
def test_has_feature_grants_when_in_tier_list():
    """Free user has 'niche.research' in their tier list -> 200."""
    user = _make_user()
    factory = APIRequestFactory()
    request = factory.get('/test/')
    force_authenticate(request, user=user)
    response = _TierGatedView.as_view()(request)
    assert response.status_code == 200


@pytest.mark.django_db
def test_has_feature_denies_when_missing(caplog):
    """Free user lacks 'admin.scraper-debug' -> 403 + log entry on entitlement channel."""
    user = _make_user(email='nope@test.com', username='nope@test.com')
    factory = APIRequestFactory()
    request = factory.get('/test-admin/')
    force_authenticate(request, user=user)
    with caplog.at_level(logging.WARNING, logger='entitlement'):
        response = _StaffGatedView.as_view()(request)
    assert response.status_code == 403
    assert any(
        'entitlement.denied' in rec.getMessage()
        and 'admin.scraper-debug' in rec.getMessage()
        for rec in caplog.records
    )


@pytest.mark.django_db
def test_has_feature_superuser_wildcard_grants_any_feature():
    """Superuser has '*' so any feature passes -> 200 on a staff-only view."""
    user = _make_user(
        email='boss@test.com',
        username='boss@test.com',
        is_staff=True,
        is_superuser=True,
    )
    factory = APIRequestFactory()
    request = factory.get('/test-admin/')
    force_authenticate(request, user=user)
    response = _StaffGatedView.as_view()(request)
    assert response.status_code == 200


@pytest.mark.django_db
def test_has_feature_unauthenticated_returns_401():
    """No auth -> IsAuthenticated returns 401 before HasFeature is consulted."""
    factory = APIRequestFactory()
    request = factory.get('/test/')
    response = _TierGatedView.as_view()(request)
    assert response.status_code == 401


@pytest.mark.django_db
def test_has_feature_staff_user_passes_staff_only_view():
    """is_staff (without superuser) gets STAFF_ONLY_FEATURES -> 200."""
    user = _make_user(
        email='staffer@test.com',
        username='staffer@test.com',
        is_staff=True,
    )
    factory = APIRequestFactory()
    request = factory.get('/test-admin/')
    force_authenticate(request, user=user)
    response = _StaffGatedView.as_view()(request)
    assert response.status_code == 200


@pytest.mark.django_db
def test_has_feature_factory_returns_distinct_classes():
    """Two calls with different keys produce different classes (sanity)."""
    A = HasFeature('design.upscaler')
    B = HasFeature('niche.research')
    assert A is not B
    assert A.__name__ != B.__name__
