import pytest
from unittest.mock import patch, MagicMock

from django.urls import reverse

pytestmark = pytest.mark.django_db

URL = reverse('research-suggestions')


class TestSuggestionsAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(URL, {'q': 'cat', 'marketplace': 'amazon_com'})
        assert resp.status_code == 401


class TestSuggestionsView:
    def test_returns_suggestions_array(self, auth_client):
        """Amazon autocomplete proxy returns suggestion list."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            'suggestions': [
                {'value': 'cat shirt'},
                {'value': 'cat hoodie'},
            ]
        }

        with patch('research_app.api.views.redis_cache') as mock_cache, \
             patch('research_app.api.views.httpx.Client') as mock_client_cls:
            mock_cache.get.return_value = None
            mock_client_ctx = MagicMock()
            mock_client_ctx.get.return_value = mock_resp
            mock_client_cls.return_value.__enter__ = MagicMock(return_value=mock_client_ctx)
            mock_client_cls.return_value.__exit__ = MagicMock(return_value=False)

            resp = auth_client.get(URL, {'q': 'cat', 'marketplace': 'amazon_com'})

        assert resp.status_code == 200
        assert resp.data['data'] == ['cat shirt', 'cat hoodie']

    def test_cache_hit_returns_cached_data(self, auth_client):
        """Redis cache hit skips HTTP call."""
        cached = ['cached suggestion 1', 'cached suggestion 2']

        with patch('research_app.api.views.redis_cache') as mock_cache:
            mock_cache.get.return_value = cached

            resp = auth_client.get(URL, {'q': 'dog', 'marketplace': 'amazon_com'})

        assert resp.status_code == 200
        assert resp.data['data'] == cached

    def test_amazon_error_returns_empty_list(self, auth_client):
        """Amazon timeout/error returns empty list, not 500."""
        with patch('research_app.api.views.redis_cache') as mock_cache, \
             patch('research_app.api.views.httpx.Client') as mock_client_cls:
            mock_cache.get.return_value = None
            mock_client_ctx = MagicMock()
            mock_client_ctx.get.side_effect = Exception('timeout')
            mock_client_cls.return_value.__enter__ = MagicMock(return_value=mock_client_ctx)
            mock_client_cls.return_value.__exit__ = MagicMock(return_value=False)

            resp = auth_client.get(URL, {'q': 'test', 'marketplace': 'amazon_com'})

        assert resp.status_code == 200
        assert resp.data['data'] == []

    def test_missing_q_param_returns_400(self, auth_client):
        resp = auth_client.get(URL, {'marketplace': 'amazon_com'})
        assert resp.status_code == 400

    def test_cache_set_called_after_fetch(self, auth_client):
        """Fetched suggestions are cached in Redis."""
        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {'suggestions': [{'value': 'a'}]}

        with patch('research_app.api.views.redis_cache') as mock_cache, \
             patch('research_app.api.views.httpx.Client') as mock_client_cls:
            mock_cache.get.return_value = None
            mock_client_ctx = MagicMock()
            mock_client_ctx.get.return_value = mock_resp
            mock_client_cls.return_value.__enter__ = MagicMock(return_value=mock_client_ctx)
            mock_client_cls.return_value.__exit__ = MagicMock(return_value=False)

            auth_client.get(URL, {'q': 'x', 'marketplace': 'amazon_com'})

        mock_cache.set.assert_called_once()
        args = mock_cache.set.call_args
        assert args[0][0] == 'suggestions:x:amazon_com'
        assert args[0][1] == ['a']
