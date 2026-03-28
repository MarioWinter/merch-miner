from unittest.mock import MagicMock, patch

import pytest

from search_app.services.context_builder import build_system_instructions
from search_app.services.crawl_service import CrawlService, CrawlServiceError
from search_app.services.vane_service import VaneService, VaneServiceError


class TestContextBuilder:
    def test_no_niche(self):
        assert build_system_instructions(None) == ''

    def test_with_niche(self):
        niche = MagicMock()
        niche.name = 'Camping Dad'
        niche.notes = ''
        result = build_system_instructions(niche)
        assert 'Camping Dad' in result
        assert 'Tailor your search results' in result

    def test_with_niche_notes(self):
        niche = MagicMock()
        niche.name = 'Camping Dad'
        niche.notes = 'Focus on outdoor gifts'
        result = build_system_instructions(niche)
        assert 'outdoor gifts' in result


class TestVaneService:
    @patch('search_app.services.vane_service.httpx.Client')
    def test_search_success(self, mock_client_cls, settings):
        settings.VANE_API_URL = 'http://vane:3000'
        settings.OPENROUTER_API_KEY = 'test-key'

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            'message': 'AI synthesized answer',
            'sources': [
                {
                    'metadata': {'title': 'Source 1', 'url': 'https://example.com'},
                    'pageContent': 'Some content',
                },
            ],
        }
        mock_resp.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        service = VaneService()
        result = service.search('camping trends')

        assert result['answer'] == 'AI synthesized answer'
        assert len(result['sources']) == 1
        assert result['sources'][0]['title'] == 'Source 1'

    def test_search_no_url_configured(self, settings):
        settings.VANE_API_URL = ''
        service = VaneService()
        with pytest.raises(VaneServiceError, match='not configured'):
            service.search('test')

    def test_health_check_no_url(self, settings):
        settings.VANE_API_URL = ''
        service = VaneService()
        assert service.health_check() is False


class TestCrawlService:
    @patch('search_app.services.crawl_service.httpx.Client')
    def test_crawl_success(self, mock_client_cls, settings):
        settings.CRAWL4AI_API_URL = 'http://crawl4ai:11235'

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            'results': [{
                'markdown': '# Page Content\n\nFull text here.',
                'metadata': {'title': 'Test Page'},
                'success': True,
            }],
        }
        mock_resp.raise_for_status = MagicMock()
        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.post.return_value = mock_resp
        mock_client_cls.return_value = mock_client

        service = CrawlService()
        result = service.crawl_url('https://example.com')

        assert result['success'] is True
        assert 'Page Content' in result['content']

    def test_crawl_no_url_configured(self, settings):
        settings.CRAWL4AI_API_URL = ''
        service = CrawlService()
        with pytest.raises(CrawlServiceError, match='not configured'):
            service.crawl_url('https://example.com')

    def test_health_check_no_url(self, settings):
        settings.CRAWL4AI_API_URL = ''
        service = CrawlService()
        assert service.health_check() is False
