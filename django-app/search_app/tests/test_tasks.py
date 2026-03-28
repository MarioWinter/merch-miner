from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model

from search_app.models import SearchUsageLog, WebSearchResult
from search_app.tasks import execute_crawl, log_search_usage
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='test@example.com', password='testpass123')


@pytest.fixture
def workspace(db, user):
    ws = Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)
    Membership.objects.create(
        workspace=ws, user=user, role='admin', status='active',
    )
    return ws


@pytest.mark.django_db
class TestExecuteCrawl:
    @patch('search_app.tasks.CrawlService')
    def test_successful_crawl(self, mock_cls, workspace):
        result = WebSearchResult.objects.create(
            workspace=workspace,
            url='https://example.com',
            crawl_status='pending',
        )
        mock_service = MagicMock()
        mock_service.crawl_url.return_value = {
            'content': '# Crawled Content',
            'metadata': {'word_count': 100},
            'success': True,
        }
        mock_cls.return_value = mock_service

        execute_crawl(str(result.pk))

        result.refresh_from_db()
        assert result.crawl_status == 'completed'
        assert result.content == '# Crawled Content'
        assert result.content_type == 'full_crawl'

    @patch('search_app.tasks.CrawlService')
    def test_failed_crawl(self, mock_cls, workspace):
        from search_app.services.crawl_service import CrawlServiceError

        result = WebSearchResult.objects.create(
            workspace=workspace,
            url='https://example.com',
            crawl_status='pending',
        )
        mock_service = MagicMock()
        mock_service.crawl_url.side_effect = CrawlServiceError("403 Forbidden")
        mock_cls.return_value = mock_service

        execute_crawl(str(result.pk))

        result.refresh_from_db()
        assert result.crawl_status == 'failed'
        assert '403 Forbidden' in result.error_message

    def test_missing_result(self):
        # Should not raise
        execute_crawl('00000000-0000-0000-0000-000000000000')


@pytest.mark.django_db
class TestLogSearchUsage:
    def test_log_created(self, workspace, user):
        log_search_usage(
            workspace_id=str(workspace.id),
            user_id=user.id,
            action='search',
            query='test query',
            model_used='gpt-4.1-mini',
        )
        assert SearchUsageLog.objects.filter(
            workspace=workspace, action='search',
        ).count() == 1
