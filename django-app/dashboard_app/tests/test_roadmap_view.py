"""
Tests for ``GET /api/dashboard/roadmap/`` (Item 3 of FIX-dashboard bundle).

Covers: anonymous → 401, authenticated → 200 with items+last_updated,
and loader error → 500.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User


def make_user(email='roadmap@test.com', password='TestPass123!'):
    return User.objects.create_user(
        email=email,
        password=password,
        username=email,
        is_active=True,
    )


def auth_client(user):
    client = APIClient()
    token = str(RefreshToken.for_user(user).access_token)
    client.cookies['access_token'] = token
    return client


@pytest.mark.django_db
class TestRoadmapView:
    """GET /api/dashboard/roadmap/"""

    def test_anonymous_returns_401(self):
        client = APIClient()
        resp = client.get(reverse('dashboard-roadmap'))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_returns_items_and_last_updated(self):
        user = make_user('authed@test.com')
        client = auth_client(user)

        fake_items = [
            {'title': 'Foo', 'description': 'Bar'},
            {'title': 'Baz', 'description': 'Qux', 'priority': 'high'},
        ]
        with patch(
            'dashboard_app.api.views.load_roadmap',
            return_value=fake_items,
        ), patch(
            'dashboard_app.api.views.roadmap_last_modified',
            return_value=None,
        ):
            resp = client.get(reverse('dashboard-roadmap'))

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert 'items' in data
        assert 'last_updated' in data
        assert data['items'] == fake_items
        assert data['last_updated'] is None

    def test_authenticated_includes_iso_last_updated(self):
        from datetime import datetime, timezone

        user = make_user('iso@test.com')
        client = auth_client(user)
        fixed = datetime(2026, 5, 31, 12, 0, 0, tzinfo=timezone.utc)

        with patch(
            'dashboard_app.api.views.load_roadmap',
            return_value=[],
        ), patch(
            'dashboard_app.api.views.roadmap_last_modified',
            return_value=fixed,
        ):
            resp = client.get(reverse('dashboard-roadmap'))

        assert resp.status_code == status.HTTP_200_OK
        assert resp.json()['last_updated'] == fixed.isoformat()

    def test_loader_error_returns_500(self):
        user = make_user('err@test.com')
        client = auth_client(user)

        with patch(
            'dashboard_app.api.views.load_roadmap',
            side_effect=RuntimeError('boom'),
        ):
            resp = client.get(reverse('dashboard-roadmap'))

        assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert 'error' in resp.json()
