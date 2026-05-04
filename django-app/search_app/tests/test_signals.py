"""Tests for search_app.signals — Vector DB embedding enqueue on crawl complete.

Covered behavior:
    * Gating via `settings.VECTOR_DB_ENABLED` (EC-15).
    * Only enqueue on `crawl_status=COMPLETED` AND truthy `content`.
    * Enqueue targets the `search` queue (not `default`).
    * `vector_app` ImportError handled gracefully (warning only).
    * Status flip from PENDING → COMPLETED (update path) triggers enqueue.

Patterns reused:
    - DRF/pytest-django factories from search_app/tests/test_views.py
    - `mock.patch` of vector_app task + django_rq queue (not real Redis)
    - `@override_settings` to flip the feature flag
"""
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.test import override_settings

from search_app.models import WebSearchResult
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='signals-test@example.com', password='testpass123',
    )


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='Signals WS', slug='signals-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.mark.django_db
class TestEmbeddingSignalGating:
    """VECTOR_DB_ENABLED flag gates all enqueue behavior."""

    @override_settings(VECTOR_DB_ENABLED=False)
    @patch('search_app.signals.django_rq')
    def test_disabled_no_enqueue(self, mock_rq, workspace):
        WebSearchResult.objects.create(
            workspace=workspace,
            url='https://example.com/disabled',
            title='Disabled Flag',
            content='Some long content that would normally be embedded.',
            content_type=WebSearchResult.ContentType.FULL_CRAWL,
            crawl_status=WebSearchResult.CrawlStatus.COMPLETED,
        )
        mock_rq.get_queue.assert_not_called()

    @override_settings(VECTOR_DB_ENABLED=True)
    @patch('search_app.signals.django_rq')
    def test_enabled_completed_with_content_enqueues(self, mock_rq, workspace):
        mock_queue = MagicMock()
        mock_rq.get_queue.return_value = mock_queue

        with patch('vector_app.tasks.create_or_update_embedding') as mock_task:
            wsr = WebSearchResult.objects.create(
                workspace=workspace,
                url='https://example.com/ok',
                title='Will be embedded',
                content='Real content body for embedding.',
                content_type=WebSearchResult.ContentType.FULL_CRAWL,
                crawl_status=WebSearchResult.CrawlStatus.COMPLETED,
            )

        # Targets the dedicated 'search' queue (post-fix from queue='default')
        mock_rq.get_queue.assert_called_once_with('search')
        mock_queue.enqueue.assert_called_once()

        args, kwargs = mock_queue.enqueue.call_args
        # First positional = the task callable
        assert args[0] is mock_task
        ct = ContentType.objects.get_for_model(WebSearchResult)
        assert kwargs['content_type_id'] == ct.id
        assert kwargs['object_id'] == str(wsr.pk)


@pytest.mark.django_db
class TestEmbeddingSignalStatusFiltering:
    """Only crawl_status=COMPLETED triggers enqueue."""

    @override_settings(VECTOR_DB_ENABLED=True)
    @patch('search_app.signals.django_rq')
    def test_pending_status_no_enqueue(self, mock_rq, workspace):
        with patch('vector_app.tasks.create_or_update_embedding'):
            WebSearchResult.objects.create(
                workspace=workspace,
                url='https://example.com/pending',
                title='Still pending',
                content='Has content but not done yet.',
                content_type=WebSearchResult.ContentType.FULL_CRAWL,
                crawl_status=WebSearchResult.CrawlStatus.PENDING,
            )
        mock_rq.get_queue.assert_not_called()

    @override_settings(VECTOR_DB_ENABLED=True)
    @patch('search_app.signals.django_rq')
    def test_running_status_no_enqueue(self, mock_rq, workspace):
        with patch('vector_app.tasks.create_or_update_embedding'):
            WebSearchResult.objects.create(
                workspace=workspace,
                url='https://example.com/running',
                content='Running content.',
                crawl_status=WebSearchResult.CrawlStatus.RUNNING,
            )
        mock_rq.get_queue.assert_not_called()

    @override_settings(VECTOR_DB_ENABLED=True)
    @patch('search_app.signals.django_rq')
    def test_failed_status_no_enqueue(self, mock_rq, workspace):
        with patch('vector_app.tasks.create_or_update_embedding'):
            WebSearchResult.objects.create(
                workspace=workspace,
                url='https://example.com/failed',
                content='Crawl content might exist but failed.',
                crawl_status=WebSearchResult.CrawlStatus.FAILED,
            )
        mock_rq.get_queue.assert_not_called()

    @override_settings(VECTOR_DB_ENABLED=True)
    @patch('search_app.signals.django_rq')
    def test_completed_with_empty_content_no_enqueue(self, mock_rq, workspace):
        """COMPLETED but content='' must not enqueue (nothing to embed)."""
        with patch('vector_app.tasks.create_or_update_embedding'):
            WebSearchResult.objects.create(
                workspace=workspace,
                url='https://example.com/empty',
                title='Empty body',
                content='',
                crawl_status=WebSearchResult.CrawlStatus.COMPLETED,
            )
        mock_rq.get_queue.assert_not_called()


@pytest.mark.django_db
class TestEmbeddingSignalUpdates:
    """Status flip on update (e.g. crawler finishes) re-fires the signal."""

    @override_settings(VECTOR_DB_ENABLED=True)
    @patch('search_app.signals.django_rq')
    def test_pending_to_completed_triggers_enqueue(self, mock_rq, workspace):
        mock_queue = MagicMock()
        mock_rq.get_queue.return_value = mock_queue

        with patch('vector_app.tasks.create_or_update_embedding'):
            wsr = WebSearchResult.objects.create(
                workspace=workspace,
                url='https://example.com/flip',
                title='Will flip',
                content='Body to embed once done.',
                content_type=WebSearchResult.ContentType.FULL_CRAWL,
                crawl_status=WebSearchResult.CrawlStatus.PENDING,
            )
            # Initial create at PENDING → no enqueue
            assert mock_queue.enqueue.call_count == 0

            wsr.crawl_status = WebSearchResult.CrawlStatus.COMPLETED
            wsr.save()

        # Update flip → enqueued exactly once
        assert mock_queue.enqueue.call_count == 1
        args, kwargs = mock_queue.enqueue.call_args
        assert kwargs['object_id'] == str(wsr.pk)


@pytest.mark.django_db
class TestEmbeddingSignalErrorHandling:
    """Failures in the enqueue path must not crash the save() call."""

    @override_settings(VECTOR_DB_ENABLED=True)
    @patch('search_app.signals.logger')
    @patch(
        'search_app.signals.django_rq',
        side_effect=ImportError('vector_app missing'),
    )
    def test_vector_app_import_error_logs_warning(
        self, _mock_rq, mock_logger, workspace,
    ):
        """If vector_app.tasks import fails, signal logs warning + does not raise."""
        # Simulate the task import itself raising ImportError. We patch the
        # whole import path used inside the signal handler.
        with patch.dict('sys.modules', {'vector_app.tasks': None}):
            # Forcing `from vector_app.tasks import ...` inside the signal to
            # raise ImportError because the module is None in sys.modules.
            wsr = WebSearchResult.objects.create(
                workspace=workspace,
                url='https://example.com/import-fail',
                title='ImportError path',
                content='Content body.',
                content_type=WebSearchResult.ContentType.FULL_CRAWL,
                crawl_status=WebSearchResult.CrawlStatus.COMPLETED,
            )

        # Object was still saved successfully (signal swallowed the error)
        assert wsr.pk is not None
        # Warning was logged
        assert mock_logger.warning.called
        warn_args, warn_kwargs = mock_logger.warning.call_args
        assert 'Failed to enqueue embedding' in warn_args[0]
        assert warn_kwargs.get('exc_info') is True
