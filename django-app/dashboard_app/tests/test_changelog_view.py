"""
Tests for ``GET /api/dashboard/changelog/`` (Item 4 of FIX-dashboard bundle).

Covers: anonymous -> 401, authenticated + success -> 200 with versions shape,
authenticated + translator exception -> 500. The translator service is patched
at the view's import-site so no LLM or filesystem calls happen.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from user_auth_app.models import User


def make_user(email='changelog@test.com', password='TestPass123!'):
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
class TestChangelogView:
    """GET /api/dashboard/changelog/"""

    def test_anonymous_returns_401(self):
        client = APIClient()
        resp = client.get(reverse('dashboard-changelog'))
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

    def test_authenticated_returns_versions_shape(self):
        user = make_user('authed@test.com')
        client = auth_client(user)

        fake_versions = [
            {
                'version': '0.7.1',
                'date': '2026-05-31',
                'items': ['Verbesserung 1', 'Verbesserung 2'],
            },
            {
                'version': '0.7.0',
                'date': '2026-05-30',
                'items': ['Neues Feature'],
            },
            {
                'version': '0.6.0',
                'date': '2026-05-29',
                'items': ['Canvas-Verbesserung'],
            },
        ]
        with patch(
            'dashboard_app.api.views.get_translated_changelog',
            return_value=fake_versions,
        ):
            resp = client.get(reverse('dashboard-changelog'))

        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert 'versions' in data
        assert data['versions'] == fake_versions

    def test_translator_error_returns_500(self):
        user = make_user('err@test.com')
        client = auth_client(user)

        with patch(
            'dashboard_app.api.views.get_translated_changelog',
            side_effect=RuntimeError('boom'),
        ):
            resp = client.get(reverse('dashboard-changelog'))

        assert resp.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert 'error' in resp.json()
