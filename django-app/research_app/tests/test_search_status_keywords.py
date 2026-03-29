"""Tests for SearchStatusView update: includes SearchKeywordResult when completed."""
import pytest

from django.urls import reverse

from scraper_app.models import ProductSearchCache, SearchKeywordResult

pytestmark = pytest.mark.django_db


def _url(cache_id):
    return reverse('research-search-status', kwargs={'cache_id': str(cache_id)})


class TestSearchStatusKeywordResult:
    def test_completed_includes_keyword_result(
        self, auth_client, membership, search_cache, keyword, product,
    ):
        search_cache.status = ProductSearchCache.Status.COMPLETED
        search_cache.save()

        SearchKeywordResult.objects.create(
            search_cache=search_cache,
            top_focus_keywords=[
                {'keyword': 'funny cats', 'frequency': 15},
                {'keyword': 'cat shirt', 'frequency': 10},
            ],
            top_long_tail_keywords=[
                {'keyword': 'funny cat t-shirt for women', 'frequency': 5},
            ],
        )

        resp = auth_client.get(_url(search_cache.id))
        assert resp.status_code == 200
        assert resp.data['keyword_result'] is not None
        assert len(resp.data['keyword_result']['top_focus_keywords']) == 2
        assert len(resp.data['keyword_result']['top_long_tail_keywords']) == 1

    def test_completed_without_keyword_result_returns_null(
        self, auth_client, membership, search_cache, keyword, product,
    ):
        search_cache.status = ProductSearchCache.Status.COMPLETED
        search_cache.save()

        resp = auth_client.get(_url(search_cache.id))
        assert resp.status_code == 200
        assert resp.data['keyword_result'] is None

    def test_pending_does_not_include_keyword_result(
        self, auth_client, membership, search_cache,
    ):
        resp = auth_client.get(_url(search_cache.id))
        assert resp.status_code == 200
        assert 'keyword_result' not in resp.data

    def test_failed_does_not_include_keyword_result(
        self, auth_client, membership, search_cache,
    ):
        search_cache.status = ProductSearchCache.Status.FAILED
        search_cache.save()

        resp = auth_client.get(_url(search_cache.id))
        assert resp.status_code == 200
        assert 'keyword_result' not in resp.data
