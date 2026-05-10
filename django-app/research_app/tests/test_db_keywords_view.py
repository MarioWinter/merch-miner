"""Tests for DbKeywordsView — DB-mode keyword aggregation endpoint.

Covers Phase 8 acceptance criteria AC-K1..AC-K4, AC-K8 plus cache stability
and top-N capping (sample size = 200).
"""

from unittest.mock import patch

import pytest
from django.core.cache import cache as redis_cache
from django.urls import reverse

from research_app.api.views import (
    DB_KEYWORDS_SAMPLE_N,
    _db_keywords_cache_key,
)
from research_app.tests.conftest import make_product
from scraper_app.models import BrandBlacklist

pytestmark = pytest.mark.django_db

URL = reverse('research-products-keywords')


@pytest.fixture(autouse=True)
def clear_cache():
    """Ensure Redis cache is empty between tests so cache hits are deterministic."""
    redis_cache.clear()
    yield
    redis_cache.clear()


class TestDbKeywordsAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(URL)
        assert resp.status_code == 401


class TestDbKeywordsEmptyResult:
    def test_empty_queryset_returns_200_with_empty_lists(self, auth_client):
        """No products matching filters → 200 with empty arrays and sample_size 0."""
        resp = auth_client.get(URL)
        assert resp.status_code == 200
        assert resp.data['top_focus_keywords'] == []
        assert resp.data['top_long_tail_keywords'] == []
        assert resp.data['sample_size'] == 0
        assert resp.data['cached'] is False


class TestDbKeywordsFilterOnlyMode:
    def test_filter_only_mode_no_keyword_returns_200(self, auth_client):
        """Filter set without keyword param still returns a valid response."""
        make_product(
            asin='B0FILT0001',
            title='Funny Cat Lover Birthday Shirt',
            brand='IndieDesign',
            bullet_1='Premium cotton tee for cat lovers',
            bullet_2='Perfect birthday gift for cat owners',
            description='A funny shirt featuring a cat design',
            bsr=1000,
        )
        # Filter-only: just bsr_min, no keyword
        resp = auth_client.get(URL, {'bsr_min': 100})
        assert resp.status_code == 200
        assert resp.data['sample_size'] == 1
        assert resp.data['cached'] is False
        # The extractor needs frequency > 2 to surface a keyword globally;
        # with one product we just assert the lists are present.
        assert isinstance(resp.data['top_focus_keywords'], list)
        assert isinstance(resp.data['top_long_tail_keywords'], list)


class TestDbKeywordsCaching:
    def test_cache_hit_flips_cached_true_and_skips_db(self, auth_client):
        """Second identical request returns cached=true and does not re-query the DB."""
        make_product(asin='B0CACHE001', title='Cat Shirt', bsr=500)

        # First call: miss, populates cache.
        resp1 = auth_client.get(URL, {'bsr_min': 100})
        assert resp1.status_code == 200
        assert resp1.data['cached'] is False
        first_focus = resp1.data['top_focus_keywords']

        # Second call: should hit cache without touching the DB queryset builder.
        with patch(
            'research_app.api.views._build_product_queryset',
        ) as mock_build:
            resp2 = auth_client.get(URL, {'bsr_min': 100})
            assert resp2.status_code == 200
            assert resp2.data['cached'] is True
            # Cached payload otherwise identical to first call.
            assert resp2.data['top_focus_keywords'] == first_focus
            assert resp2.data['sample_size'] == resp1.data['sample_size']
            # DB queryset builder must NOT be invoked on cache hit.
            mock_build.assert_not_called()

    def test_cached_dict_not_mutated_in_cache(self, auth_client):
        """The cached payload itself must keep cached=False so concurrent
        readers don't see a flipped flag from a previous response."""
        make_product(asin='B0CMUT001', title='Cat Shirt', bsr=500)

        # Prime the cache.
        auth_client.get(URL, {'bsr_min': 100})

        # Inspect the raw cached value via the helper.
        key = _db_keywords_cache_key({
            'keyword': '',
            'marketplace': 'amazon_com',
            'bsr_min': 100,
            'product_type': '',
            'subcategory': '',
            'hide_official_brands': False,
            'exclude_words': '',
            'sort_by': '',
            'page': 1,
            'page_size': 50,
        })
        raw = redis_cache.get(key)
        # Raw cached payload must still be `cached: False`; only the
        # response copy flips it.
        assert raw is not None
        assert raw['cached'] is False

        # And a second response copy still sees cached=True (not mutated).
        resp = auth_client.get(URL, {'bsr_min': 100})
        assert resp.data['cached'] is True
        # Re-read cache: still False.
        raw2 = redis_cache.get(key)
        assert raw2['cached'] is False


class TestDbKeywordsCacheKeyStability:
    def test_same_validated_data_different_order_same_hash(self):
        """The helper must produce identical hashes regardless of dict key order."""
        a = {
            'keyword': 'cat',
            'marketplace': 'amazon_com',
            'bsr_min': 100,
            'bsr_max': 10000,
            'sort_by': 'bsr_asc',
        }
        b = {
            'sort_by': 'bsr_asc',
            'bsr_max': 10000,
            'bsr_min': 100,
            'marketplace': 'amazon_com',
            'keyword': 'cat',
        }
        assert _db_keywords_cache_key(a) == _db_keywords_cache_key(b)

    def test_different_validated_data_different_hash(self):
        """Different filter values must produce different cache keys."""
        a = {'keyword': 'cat', 'marketplace': 'amazon_com'}
        b = {'keyword': 'dog', 'marketplace': 'amazon_com'}
        assert _db_keywords_cache_key(a) != _db_keywords_cache_key(b)


class TestDbKeywordsTopNCapping:
    def test_sample_size_capped_at_200(self, auth_client):
        """When more than 200 products match, sample_size must be exactly 200."""
        # Create 250 products with distinct BSRs so ordering is deterministic.
        for i in range(250):
            make_product(
                asin=f'B0CAP{i:05d}',
                title=f'Test Product {i}',
                brand='IndieBrand',
                bsr=i + 1,
            )

        resp = auth_client.get(URL)
        assert resp.status_code == 200
        assert resp.data['sample_size'] == DB_KEYWORDS_SAMPLE_N
        assert resp.data['sample_size'] == 200


class TestDbKeywordsBrandBlacklist:
    def test_hide_official_brands_excludes_blacklisted_brand_from_sample(self, auth_client):
        """DbKeywordsView honors hide_official_brands via the shared _build_product_queryset."""
        BrandBlacklist.objects.get_or_create(brand_name='nike')
        # Blacklisted brand: should be excluded from the keyword sample.
        make_product(
            asin='B0KWBL001',
            title='Nike Athletic Wear',
            brand='Nike',
            bullet_1='Premium nike performance gear',
            bsr=100,
        )
        # Safe brand: should be included.
        make_product(
            asin='B0KWBL002',
            title='IndieShop Funny Shirt',
            brand='IndieShop',
            bullet_1='Premium cotton tee design',
            bsr=200,
        )

        resp_hidden = auth_client.get(URL, {'hide_official_brands': 'true'})
        assert resp_hidden.status_code == 200
        assert resp_hidden.data['sample_size'] == 1

        # Sanity: without the toggle both products are in the sample.
        resp_shown = auth_client.get(URL, {'hide_official_brands': 'false'})
        assert resp_shown.status_code == 200
        assert resp_shown.data['sample_size'] == 2


class TestDbKeywordsInvalidFilter:
    def test_bsr_min_greater_than_max_returns_400(self, auth_client):
        """Invalid filter (bsr_min > bsr_max) is rejected by the serializer."""
        resp = auth_client.get(URL, {'bsr_min': 10000, 'bsr_max': 100})
        assert resp.status_code == 400

    def test_invalid_sort_by_returns_400(self, auth_client):
        """Unknown sort_by value is rejected by the serializer."""
        resp = auth_client.get(URL, {'sort_by': 'totally_invalid'})
        assert resp.status_code == 400
