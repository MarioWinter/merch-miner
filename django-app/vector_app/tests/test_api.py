import uuid
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def setup_data(db):
    user = User.objects.create_user(email='api@test.com', password='testpass123')
    workspace = Workspace.objects.create(name='API WS', slug='api-ws', owner=user)
    Membership.objects.create(
        workspace=workspace, user=user,
        role=Membership.Role.ADMIN, status=Membership.Status.ACTIVE,
    )
    return user, workspace


@pytest.fixture
def auth_client(setup_data):
    user, workspace = setup_data
    client = APIClient()
    client.force_authenticate(user=user)
    client.workspace = workspace
    client.user = user
    return client


@pytest.mark.django_db
class TestSemanticSearchAPI:
    @patch('vector_app.api.views.EmbeddingService')
    def test_search_success(self, MockService, auth_client):
        mock_svc = MockService.return_value
        mock_svc.search.return_value = [
            {
                'score': 0.85,
                'content_type': 'niche',
                'object_id': str(uuid.uuid4()),
                'text_preview': 'Camping Dad humor',
                'metadata': {'source_type': 'niche'},
            }
        ]

        response = auth_client.post(
            '/api/search/semantic/',
            {'query': 'camping shirts'},
            format='json',
            HTTP_X_WORKSPACE_ID=str(auth_client.workspace.id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data['total'] == 1
        assert data['query'] == 'camping shirts'
        assert data['strategy'] == 'similarity'
        assert len(data['results']) == 1

    def test_search_missing_query(self, auth_client):
        response = auth_client.post(
            '/api/search/semantic/',
            {},
            format='json',
            HTTP_X_WORKSPACE_ID=str(auth_client.workspace.id),
        )
        assert response.status_code == 400

    def test_search_unauthenticated(self, db):
        client = APIClient()
        response = client.post(
            '/api/search/semantic/',
            {'query': 'test'},
            format='json',
        )
        assert response.status_code == 401

    @patch('vector_app.api.views.EmbeddingService')
    def test_search_with_options(self, MockService, auth_client):
        mock_svc = MockService.return_value
        mock_svc.search.return_value = []

        response = auth_client.post(
            '/api/search/semantic/',
            {
                'query': 'fishing',
                'content_types': ['niche', 'amazon_product'],
                'top_k': 5,
                'threshold': 0.5,
                'strategy': 'mmr',
            },
            format='json',
            HTTP_X_WORKSPACE_ID=str(auth_client.workspace.id),
        )

        assert response.status_code == 200
        mock_svc.search.assert_called_once()
        call_kwargs = mock_svc.search.call_args[1]
        assert call_kwargs['top_k'] == 5
        assert call_kwargs['threshold'] == 0.5
        assert call_kwargs['strategy'] == 'mmr'
        assert call_kwargs['content_types'] == ['niche', 'amazon_product']

    def test_search_invalid_strategy(self, auth_client):
        response = auth_client.post(
            '/api/search/semantic/',
            {'query': 'test', 'strategy': 'invalid'},
            format='json',
            HTTP_X_WORKSPACE_ID=str(auth_client.workspace.id),
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestNicheSimilarAPI:
    @patch('vector_app.api.views.EmbeddingService')
    def test_similar_niches(self, MockService, auth_client):
        from niche_app.models import Niche
        niche = Niche.objects.create(
            name='Camping Fun',
            workspace=auth_client.workspace,
            created_by=auth_client.user,
        )

        mock_svc = MockService.return_value
        mock_svc.search.return_value = [
            {
                'score': 0.8,
                'content_type': 'niche',
                'object_id': str(uuid.uuid4()),
                'text_preview': 'Hiking Dad',
                'metadata': {},
            }
        ]

        response = auth_client.get(
            f'/api/niches/{niche.pk}/similar/',
            HTTP_X_WORKSPACE_ID=str(auth_client.workspace.id),
        )

        assert response.status_code == 200
        assert response.json()['niche_id'] == str(niche.pk)

    def test_similar_niche_not_found(self, auth_client):
        response = auth_client.get(
            f'/api/niches/{uuid.uuid4()}/similar/',
            HTTP_X_WORKSPACE_ID=str(auth_client.workspace.id),
        )
        assert response.status_code == 404


@pytest.mark.django_db
class TestNicheRelatedContentAPI:
    @patch('vector_app.api.views.EmbeddingService')
    def test_related_content(self, MockService, auth_client):
        from niche_app.models import Niche
        niche = Niche.objects.create(
            name='Dog Lover',
            workspace=auth_client.workspace,
            created_by=auth_client.user,
        )

        mock_svc = MockService.return_value
        mock_svc.search.return_value = []

        response = auth_client.get(
            f'/api/niches/{niche.pk}/related-content/',
            HTTP_X_WORKSPACE_ID=str(auth_client.workspace.id),
        )

        assert response.status_code == 200
        assert response.json()['niche_id'] == str(niche.pk)


@pytest.mark.django_db
class TestIdeaSimilarAPI:
    def test_idea_similar_stub(self, auth_client):
        """Idea model doesn't exist yet, endpoint returns empty."""
        response = auth_client.get(
            f'/api/ideas/{uuid.uuid4()}/similar/',
            HTTP_X_WORKSPACE_ID=str(auth_client.workspace.id),
        )
        assert response.status_code == 200
        assert response.json()['total'] == 0
