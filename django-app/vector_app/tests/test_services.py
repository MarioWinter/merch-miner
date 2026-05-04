import uuid
from unittest.mock import MagicMock, patch

import pytest

from vector_app.models import Embedding
from vector_app.services import EmbeddingService


@pytest.fixture
def workspace(db):
    from workspace_app.models import Workspace
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.create_user(email='svc@test.com', password='testpass123')
    return Workspace.objects.create(name='SVC WS', slug='svc-ws', owner=user)


@pytest.fixture
def niche(db, workspace):
    from django.contrib.auth import get_user_model
    from niche_app.models import Niche
    user = get_user_model().objects.first()
    return Niche.objects.create(
        name='Fishing Humor',
        notes='Funny fishing t-shirts',
        workspace=workspace,
        created_by=user,
    )


@pytest.fixture
def mock_embedding_vector():
    """Return a fake 1536-dim embedding vector."""
    return [0.01 * i for i in range(1536)]


@pytest.mark.django_db
class TestEmbeddingServiceCreate:
    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_create_embedding_success(self, mock_get_vec, workspace, niche, mock_embedding_vector):
        mock_get_vec.return_value = mock_embedding_vector

        service = EmbeddingService()
        result = service.create_embedding(niche)

        assert result is not None
        assert result.workspace_id == workspace.pk
        assert result.text_input == 'Fishing Humor Funny fishing t-shirts'
        assert result.metadata['source_type'] == 'niche'
        mock_get_vec.assert_called_once()

    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_create_embedding_idempotent(self, mock_get_vec, workspace, niche, mock_embedding_vector):
        mock_get_vec.return_value = mock_embedding_vector

        service = EmbeddingService()
        result1 = service.create_embedding(niche)
        niche.notes = 'Updated notes'
        niche.save()
        result2 = service.create_embedding(niche)

        assert result1.pk == result2.pk
        assert result2.text_input == 'Fishing Humor Updated notes'
        assert Embedding.objects.count() == 1

    def test_create_embedding_no_method(self, workspace):
        """Objects without get_embedding_text() are skipped."""
        service = EmbeddingService()
        obj = MagicMock(spec=[])  # No get_embedding_text
        result = service.create_embedding(obj)
        assert result is None

    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_create_embedding_empty_text(self, mock_get_vec, workspace, niche):
        niche.name = ''
        niche.notes = ''
        niche.save()

        service = EmbeddingService()
        result = service.create_embedding(niche)
        assert result is None
        mock_get_vec.assert_not_called()


@pytest.mark.django_db
class TestEmbeddingServiceDelete:
    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_delete_embedding(self, mock_get_vec, workspace, niche, mock_embedding_vector):
        mock_get_vec.return_value = mock_embedding_vector

        service = EmbeddingService()
        service.create_embedding(niche)
        assert Embedding.objects.count() == 1

        deleted = service.delete_embedding(niche)
        assert deleted is True
        assert Embedding.objects.count() == 0

    def test_delete_nonexistent(self, workspace, niche):
        service = EmbeddingService()
        deleted = service.delete_embedding(niche)
        assert deleted is False


@pytest.mark.django_db
class TestEmbeddingServiceSearch:
    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_search_returns_results(self, mock_get_vec, workspace, niche, mock_embedding_vector):
        mock_get_vec.return_value = mock_embedding_vector

        service = EmbeddingService()
        service.create_embedding(niche)

        results = service.search(
            query='fishing shirts',
            workspace_id=workspace.id,
            top_k=10,
            threshold=0.0,  # Low threshold to ensure match
        )
        assert len(results) > 0
        assert results[0]['content_type'] == 'niche'
        assert 'score' in results[0]
        assert 'text_preview' in results[0]
        assert 'metadata' in results[0]

    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_search_empty_query(self, mock_get_vec, workspace):
        service = EmbeddingService()
        results = service.search(query='', workspace_id=workspace.id)
        assert results == []
        mock_get_vec.assert_not_called()

    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_search_workspace_isolation(self, mock_get_vec, workspace, niche, mock_embedding_vector):
        mock_get_vec.return_value = mock_embedding_vector

        service = EmbeddingService()
        service.create_embedding(niche)

        # Search in a different workspace
        other_ws_id = uuid.uuid4()
        results = service.search(
            query='fishing', workspace_id=other_ws_id, threshold=0.0,
        )
        assert len(results) == 0

    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_search_content_type_filter(self, mock_get_vec, workspace, niche, mock_embedding_vector):
        mock_get_vec.return_value = mock_embedding_vector

        service = EmbeddingService()
        service.create_embedding(niche)

        # Filter for a type that doesn't match
        results = service.search(
            query='fishing',
            workspace_id=workspace.id,
            content_types=['idea'],
            threshold=0.0,
        )
        assert len(results) == 0

    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_search_mmr_strategy(self, mock_get_vec, workspace, niche, mock_embedding_vector):
        mock_get_vec.return_value = mock_embedding_vector

        service = EmbeddingService()
        service.create_embedding(niche)

        results = service.search(
            query='fishing',
            workspace_id=workspace.id,
            strategy='mmr',
            threshold=0.0,
        )
        # Should work without error, returns results
        assert isinstance(results, list)

    @patch.object(EmbeddingService, '_get_embedding_vector')
    def test_search_no_embeddings(self, mock_get_vec, workspace, mock_embedding_vector):
        mock_get_vec.return_value = mock_embedding_vector

        service = EmbeddingService()
        results = service.search(
            query='anything', workspace_id=workspace.id, threshold=0.0,
        )
        assert results == []
