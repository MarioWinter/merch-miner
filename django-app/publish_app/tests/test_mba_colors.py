"""Tests for MBA reference data API (AC-37)."""

import re

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

User = get_user_model()

HEX_PATTERN = re.compile(r'^#[0-9A-Fa-f]{6}$')


@pytest.fixture
def user(db):
    return User.objects.create_user(email='mba@example.com', password='testpass123')


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_get_mba_colors_authenticated_returns_palette(api_client):
    url = reverse('mba-colors')
    response = api_client.get(url)

    assert response.status_code == 200
    data = response.data
    assert isinstance(data, list)
    assert len(data) >= 10

    for entry in data:
        assert isinstance(entry, dict)
        assert set(entry.keys()) == {'key', 'name', 'hex'}
        assert isinstance(entry['key'], str) and entry['key']
        assert isinstance(entry['name'], str) and entry['name']
        assert isinstance(entry['hex'], str)
        assert HEX_PATTERN.match(entry['hex']), f"Invalid hex: {entry['hex']}"

    keys = [e['key'] for e in data]
    assert len(keys) == len(set(keys)), 'MBA color keys must be unique'


@pytest.mark.django_db
def test_get_mba_colors_unauthenticated_returns_401():
    client = APIClient()
    url = reverse('mba-colors')
    response = client.get(url)
    assert response.status_code == 401
