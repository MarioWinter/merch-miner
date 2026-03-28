import uuid
from unittest.mock import patch, MagicMock

import pytest
from django.contrib.contenttypes.models import ContentType

from vector_app.tasks import create_or_update_embedding, delete_embedding


@pytest.fixture
def workspace(db):
    from workspace_app.models import Workspace
    from django.contrib.auth import get_user_model
    User = get_user_model()
    user = User.objects.create_user(email='task@test.com', password='testpass123')
    return Workspace.objects.create(name='Task WS', slug='task-ws', owner=user)


@pytest.fixture
def niche(db, workspace):
    from django.contrib.auth import get_user_model
    from niche_app.models import Niche
    user = get_user_model().objects.first()
    return Niche.objects.create(
        name='Hiking Fun',
        notes='Hiking humor shirts',
        workspace=workspace,
        created_by=user,
    )


@pytest.mark.django_db
class TestCreateOrUpdateEmbeddingTask:
    @patch('vector_app.tasks.EmbeddingService')
    def test_creates_embedding(self, MockService, niche):
        mock_svc = MockService.return_value
        mock_svc.create_embedding.return_value = MagicMock()

        ct = ContentType.objects.get_for_model(niche)
        create_or_update_embedding(ct.id, str(niche.pk))

        mock_svc.create_embedding.assert_called_once()

    @patch('vector_app.tasks.EmbeddingService')
    def test_skips_deleted_object(self, MockService, niche):
        ct = ContentType.objects.get_for_model(niche)
        obj_id = str(niche.pk)
        niche.delete()

        create_or_update_embedding(ct.id, obj_id)
        MockService.return_value.create_embedding.assert_not_called()

    def test_skips_invalid_content_type(self):
        create_or_update_embedding(99999, str(uuid.uuid4()))
        # Should not raise

    @patch('vector_app.tasks.EmbeddingService')
    @patch('vector_app.tasks.django_rq.get_queue')
    def test_retries_on_failure(self, mock_get_queue, MockService, niche):
        mock_svc = MockService.return_value
        mock_svc.create_embedding.side_effect = Exception('API down')
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        ct = ContentType.objects.get_for_model(niche)
        create_or_update_embedding(ct.id, str(niche.pk))

        mock_svc.create_embedding.assert_called_once()
        mock_get_queue.assert_called_once_with('default')
        mock_queue.enqueue_in.assert_called_once()
        args = mock_queue.enqueue_in.call_args
        assert args[0][0].total_seconds() == 10  # first retry delay


@pytest.mark.django_db
class TestDeleteEmbeddingTask:
    @patch('vector_app.tasks.EmbeddingService')
    def test_deletes_embedding(self, MockService, niche):
        mock_svc = MockService.return_value
        mock_svc.delete_embedding_by_ref.return_value = True

        ct = ContentType.objects.get_for_model(niche)
        delete_embedding(ct.id, str(niche.pk))

        mock_svc.delete_embedding_by_ref.assert_called_once_with(ct.id, str(niche.pk))
