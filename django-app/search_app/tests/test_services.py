from unittest.mock import MagicMock, patch

import pytest

from search_app.services.context_builder import (
    LANGUAGE_MIRRORING_DIRECTIVE,
    build_system_instructions,
)
from search_app.services.crawl_service import CrawlService, CrawlServiceError
from search_app.services.vane_service import VaneService, VaneServiceError


class TestContextBuilder:
    def test_no_niche_returns_language_mirroring_directive(self):
        """PROJ-29 Phase 1J / BUG-3 — Vane path without a pinned niche must
        still receive a language directive. Previously this returned `''`
        and Gemini defaulted to English on German queries."""
        result = build_system_instructions(None)
        assert result != ''
        assert 'LANGUAGE MIRRORING' in result
        assert 'same language as the user' in result.lower()
        # The directive references both German and English explicitly so
        # the LLM cannot default to one over the other based on training
        # bias alone.
        assert 'German' in result
        assert 'English' in result
        # Sanity: the canonical constant is the entire return value (no
        # other content leaks in when niche is None).
        assert result == LANGUAGE_MIRRORING_DIRECTIVE

    def test_with_niche(self):
        niche = MagicMock()
        niche.name = 'Camping Dad'
        niche.notes = ''
        result = build_system_instructions(niche)
        assert 'Camping Dad' in result
        # BUG-1 mitigation 2026-04-28 — strict wording prevents niche language
        # / audience bleed. Verify the key safety clauses are present.
        assert 'STRICT INSTRUCTIONS' in result
        assert 'SAME language' in result
        assert 'workspace label, NOT a directive' in result
        assert 'Do NOT infer audience' in result
        # PROJ-29 Phase 1J / BUG-3 — the CRITICAL language anchor must also
        # appear at the very top so positional bias does not let the LLM
        # drift to English under niche-context pressure.
        assert 'LANGUAGE MIRRORING' in result
        assert result.startswith(LANGUAGE_MIRRORING_DIRECTIVE)

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
