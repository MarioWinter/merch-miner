"""PROJ-29 Phase 1B Round 1: IndexingFailure model + retry-aware create_or_update_embedding."""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.contenttypes.models import ContentType

from vector_app.models import IndexingFailure
from vector_app.tasks import create_or_update_embedding


@pytest.fixture
def workspace(db):
    from django.contrib.auth import get_user_model
    from workspace_app.models import Workspace
    User = get_user_model()
    user = User.objects.create_user(email='failure@test.com', password='testpass123')
    return Workspace.objects.create(name='Failure WS', slug='failure-ws', owner=user)


@pytest.fixture
def niche(db, workspace):
    from django.contrib.auth import get_user_model
    from niche_app.models import Niche
    user = get_user_model().objects.first()
    return Niche.objects.create(
        name='Camping Humor',
        notes='Funny camping shirts',
        workspace=workspace,
        created_by=user,
    )


@pytest.mark.django_db
class TestIndexingFailureModel:
    def test_create(self, niche):
        ct = ContentType.objects.get_for_model(niche)
        failure = IndexingFailure.objects.create(
            content_type=ct,
            object_id=niche.pk,
            attempt_count=1,
            last_error='timeout',
        )
        assert failure.pk is not None
        assert failure.resolved_at is None
        assert 'IndexingFailure' in str(failure)

    def test_unique_together(self, niche):
        ct = ContentType.objects.get_for_model(niche)
        IndexingFailure.objects.create(
            content_type=ct, object_id=niche.pk, attempt_count=1,
        )
        from django.db import IntegrityError
        with pytest.raises(IntegrityError):
            IndexingFailure.objects.create(
                content_type=ct, object_id=niche.pk, attempt_count=1,
            )


@pytest.mark.django_db
class TestRetryAwareCreateOrUpdateEmbedding:
    @patch('vector_app.tasks.EmbeddingService')
    def test_success_creates_no_failure_row(self, MockService, niche):
        mock_svc = MockService.return_value
        mock_svc.create_embedding.return_value = MagicMock()

        ct = ContentType.objects.get_for_model(niche)
        create_or_update_embedding(ct.id, str(niche.pk))

        assert IndexingFailure.objects.count() == 0

    @patch('vector_app.tasks.EmbeddingService')
    @patch('vector_app.tasks.django_rq.get_queue')
    def test_first_failure_records_row(self, mock_get_queue, MockService, niche):
        mock_svc = MockService.return_value
        mock_svc.create_embedding.side_effect = Exception('boom')
        mock_get_queue.return_value = MagicMock()

        ct = ContentType.objects.get_for_model(niche)
        create_or_update_embedding(ct.id, str(niche.pk))

        failure = IndexingFailure.objects.get(content_type=ct, object_id=niche.pk)
        assert failure.attempt_count == 1
        assert failure.resolved_at is None
        assert 'boom' in failure.last_error

    @patch('vector_app.tasks.EmbeddingService')
    @patch('vector_app.tasks.django_rq.get_queue')
    def test_third_failure_no_more_retries(self, mock_get_queue, MockService, niche):
        """After MAX_ATTEMPTS attempts, no further re-enqueue + row stays unresolved."""
        mock_svc = MockService.return_value
        mock_svc.create_embedding.side_effect = Exception('boom')
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        ct = ContentType.objects.get_for_model(niche)
        # Simulate the third (final) attempt — attempt=2 means delay index 2 is the
        # last that triggers a retry; attempt=3 must NOT re-enqueue.
        create_or_update_embedding(ct.id, str(niche.pk), attempt=3)

        failure = IndexingFailure.objects.get(content_type=ct, object_id=niche.pk)
        assert failure.attempt_count == 1  # this run produced 1 failure record
        assert failure.resolved_at is None
        mock_queue.enqueue_in.assert_not_called()

    @patch('vector_app.tasks.EmbeddingService')
    @patch('vector_app.tasks.django_rq.get_queue')
    def test_attempt_count_increments_across_retries(self, mock_get_queue, MockService, niche):
        mock_svc = MockService.return_value
        mock_svc.create_embedding.side_effect = Exception('boom')
        mock_get_queue.return_value = MagicMock()

        ct = ContentType.objects.get_for_model(niche)
        create_or_update_embedding(ct.id, str(niche.pk), attempt=0)
        create_or_update_embedding(ct.id, str(niche.pk), attempt=1)
        create_or_update_embedding(ct.id, str(niche.pk), attempt=2)

        failure = IndexingFailure.objects.get(content_type=ct, object_id=niche.pk)
        assert failure.attempt_count == 3
        assert failure.resolved_at is None

    @patch('vector_app.tasks.EmbeddingService')
    def test_success_after_prior_failure_sets_resolved_at(self, MockService, niche):
        ct = ContentType.objects.get_for_model(niche)
        # Pre-existing unresolved failure row.
        IndexingFailure.objects.create(
            content_type=ct,
            object_id=niche.pk,
            attempt_count=2,
            last_error='prior boom',
        )

        # Now success.
        mock_svc = MockService.return_value
        mock_svc.create_embedding.return_value = MagicMock()
        create_or_update_embedding(ct.id, str(niche.pk))

        failure = IndexingFailure.objects.get(content_type=ct, object_id=niche.pk)
        assert failure.resolved_at is not None
