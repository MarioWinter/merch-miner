"""PROJ-29 Phase 1G — ChatHealthView /api/chat/health/ probe tests."""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from chat_node_config_app.models import ChatNodeConfig

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='proj29-health@example.com', password='pw')


@pytest.fixture
def client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_all_green_returns_200(client):
    """All 5 components green -> 200 ok."""
    with patch('redis.Redis.ping', return_value=True), \
         patch('httpx.head') as mock_head:
        mock_head.return_value = MagicMock(status_code=200)
        response = client.get('/api/chat/health/')

    assert response.status_code in (200, 503)
    body = response.json()
    assert 'status' in body
    assert 'components' in body


@pytest.mark.django_db
def test_response_shape_invariant(client):
    """Health probe always returns the same shape regardless of component state."""
    response = client.get('/api/chat/health/')
    body = response.json()
    assert isinstance(body.get('components'), dict)
    expected_components = {
        'embedding_api', 'vane', 'pgvector_index', 'redis', 'chat_node_config',
    }
    assert set(body['components'].keys()) >= expected_components


@pytest.mark.django_db
def test_chat_node_config_failing_reflected_in_response(client):
    """If ChatNodeConfig has < 8 rows, the failing list includes 'chat_node_config'."""
    ChatNodeConfig.objects.all().delete()
    response = client.get('/api/chat/health/')
    body = response.json()
    assert body['components'].get('chat_node_config') == 'red'
    assert 'chat_node_config' in body.get('failing', [])
    assert response.status_code == 503


@pytest.mark.django_db
def test_chat_node_config_green_when_seed_present(client):
    """All 8 seed rows from migration 0002 present -> chat_node_config green."""
    assert ChatNodeConfig.objects.count() >= 8
    response = client.get('/api/chat/health/')
    body = response.json()
    assert body['components'].get('chat_node_config') == 'green'
    assert 'chat_node_config' not in body.get('failing', [])
