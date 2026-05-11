from datetime import date
from unittest.mock import patch

import pytest
from django.core.cache import cache as redis_cache
from django.urls import reverse

from scraper_app.models import AmazonProduct, BrandBlacklist

from research_app.tests.conftest import make_product

pytestmark = pytest.mark.django_db

URL = reverse('research-products')


@pytest.fixture(autouse=True)
def clear_official_brands_cache():
    """Ensure the BrandBlacklist-derived Redis caches do not leak between tests."""
    redis_cache.delete('research:official_brands')
    redis_cache.delete('research:blacklisted_brand_values')
    yield
    redis_cache.delete('research:official_brands')
    redis_cache.delete('research:blacklisted_brand_values')


class TestProductListAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(URL)
        assert resp.status_code == 401


class TestProductListBasic:
    def test_returns_paginated_results(self, auth_client):
        """Default response contains count, results, next, previous."""
        for i in range(3):
            make_product(asin=f'B0LIST{i:04d}')

        resp = auth_client.get(URL)
        assert resp.status_code == 200
        data = resp.data
        assert data['count'] == 3
        assert len(data['results']) == 3
        assert 'next' in data
        assert 'previous' in data

    def test_pagination_page_size(self, auth_client):
        """page_size param limits results per page."""
        for i in range(5):
            make_product(asin=f'B0PAGE{i:04d}', bsr=i + 1)

        resp = auth_client.get(URL, {'page_size': 2})
        assert resp.status_code == 200
        data = resp.data
        assert data['count'] == 5
        assert len(data['results']) == 2
        assert data['next'] is not None

    def test_pagination_page_2(self, auth_client):
        """Page 2 returns correct slice."""
        for i in range(5):
            make_product(asin=f'B0PG2_{i:04d}', bsr=i + 1)

        resp = auth_client.get(URL, {'page': 2, 'page_size': 2})
        assert resp.status_code == 200
        data = resp.data
        assert len(data['results']) == 2
        assert data['previous'] is not None

    def test_pagination_page_size_100_returns_100(self, auth_client):
        """page_size=100 returns 100 results (Phase 13 initial infinite-scroll fetch)."""
        for i in range(120):
            make_product(asin=f'B0P100{i:04d}', bsr=i + 1)

        resp = auth_client.get(URL, {'page_size': 100})
        assert resp.status_code == 200
        data = resp.data
        assert data['count'] == 120
        assert len(data['results']) == 100
        assert data['next'] is not None

    def test_pagination_page_size_200_accepted(self, auth_client):
        """page_size=200 is accepted by serializer (Phase 13 max_value bumped to 200)."""
        for i in range(10):
            make_product(asin=f'B0P200{i:04d}', bsr=i + 1)

        resp = auth_client.get(URL, {'page_size': 200})
        assert resp.status_code == 200
        # Only 10 products exist, but request is accepted (no 400)
        assert resp.data['count'] == 10
        assert len(resp.data['results']) == 10

    def test_pagination_page_size_201_rejected(self, auth_client):
        """page_size=201 exceeds max_value=200 and returns 400."""
        resp = auth_client.get(URL, {'page_size': 201})
        assert resp.status_code == 400


class TestProductListBSRFilter:
    def test_bsr_range_filter(self, auth_client):
        make_product(asin='B0BSR_LOW', bsr=100)
        make_product(asin='B0BSR_MID', bsr=5000)
        make_product(asin='B0BSR_HI', bsr=50000)

        resp = auth_client.get(URL, {'bsr_min': 1000, 'bsr_max': 10000})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0BSR_MID' in asins
        assert 'B0BSR_LOW' not in asins
        assert 'B0BSR_HI' not in asins

    def test_bsr_min_greater_than_max_returns_400(self, auth_client):
        resp = auth_client.get(URL, {'bsr_min': 10000, 'bsr_max': 100})
        assert resp.status_code == 400


class TestProductListBrandFilter:
    def test_hide_official_brands_excludes_blacklisted_brand(self, auth_client):
        """hide_official_brands=true excludes blacklisted brand (case-insensitive)."""
        BrandBlacklist.objects.get_or_create(brand_name='nike')
        make_product(asin='B0NIKE001', brand='Nike')
        make_product(asin='B0INDIE01', brand='IndieShop')

        resp = auth_client.get(URL, {'hide_official_brands': 'true'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0INDIE01' in asins
        assert 'B0NIKE001' not in asins

    def test_hide_official_brands_case_insensitive(self, auth_client):
        """Brand matching is case-insensitive (nike == Nike == NIKE)."""
        BrandBlacklist.objects.get_or_create(brand_name='nike')
        make_product(asin='B0NIKELO', brand='nike')
        make_product(asin='B0NIKEUP', brand='NIKE')
        make_product(asin='B0GOOD01', brand='MyCoolBrand')

        resp = auth_client.get(URL, {'hide_official_brands': 'true'})
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0GOOD01' in asins
        assert 'B0NIKELO' not in asins
        assert 'B0NIKEUP' not in asins

    def test_hide_official_brands_substring_match_for_long_brand(self, auth_client):
        """Long brand (>3 chars) in blacklist matches as substring (e.g. 'nike' in 'Nike Shoes')."""
        BrandBlacklist.objects.get_or_create(brand_name='nike')
        make_product(asin='B0NIKESH', brand='Nike Shoes')
        make_product(asin='B0NIKEST', brand='My Nike Store')
        make_product(asin='B0SAFE01', brand='IndieShop')

        resp = auth_client.get(URL, {'hide_official_brands': 'true'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0SAFE01' in asins
        assert 'B0NIKESH' not in asins
        assert 'B0NIKEST' not in asins

    def test_hide_official_brands_exact_match_for_short_brand(self, auth_client):
        """Short brand (<=3 chars) uses exact match only — must NOT match as substring."""
        BrandBlacklist.objects.get_or_create(brand_name='rh')
        make_product(asin='B0RH_EXAC', brand='rh')
        make_product(asin='B0RH_CASE', brand='RH')
        make_product(asin='B0RH_SUBS', brand='birch')  # contains 'rh' but must not match

        resp = auth_client.get(URL, {'hide_official_brands': 'true'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0RH_SUBS' in asins
        assert 'B0RH_EXAC' not in asins
        assert 'B0RH_CASE' not in asins

    def test_hide_official_brands_regex_injection_safe(self, auth_client):
        """Brand names with regex metacharacters are escaped and treated as literals.

        'foo*bar' must match the literal string 'foo*bar' as a substring, NOT
        the regex pattern 'foo*bar' (which would match 'fobar', 'foobar', etc.).
        """
        BrandBlacklist.objects.get_or_create(brand_name='foo*bar')
        make_product(asin='B0LITER01', brand='foo*bar')          # literal match → excluded
        make_product(asin='B0LITER02', brand='prefix foo*bar x')  # literal substring → excluded
        make_product(asin='B0REGEX01', brand='foobar')            # would match unescaped regex
        make_product(asin='B0REGEX02', brand='fobar')             # would match unescaped regex
        make_product(asin='B0SAFE01', brand='IndieShop')

        resp = auth_client.get(URL, {'hide_official_brands': 'true'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0LITER01' not in asins
        assert 'B0LITER02' not in asins
        assert 'B0REGEX01' in asins
        assert 'B0REGEX02' in asins
        assert 'B0SAFE01' in asins

    def test_hide_official_brands_caches_blacklist(self, auth_client):
        """Second identical request hits the Redis cache instead of re-querying BrandBlacklist."""
        BrandBlacklist.objects.get_or_create(brand_name='nike')
        make_product(asin='B0CACHE01', brand='Nike')
        make_product(asin='B0CACHE02', brand='IndieShop')

        # First call populates the cache.
        resp1 = auth_client.get(URL, {'hide_official_brands': 'true'})
        assert resp1.status_code == 200
        assert 'B0CACHE01' not in [p['asin'] for p in resp1.data['results']]

        # Second call: BrandBlacklist queryset must not be evaluated.
        with patch(
            'research_app.api.views.BrandBlacklist.objects.values_list',
        ) as mock_values_list:
            resp2 = auth_client.get(URL, {'hide_official_brands': 'true'})
            assert resp2.status_code == 200
            assert 'B0CACHE01' not in [p['asin'] for p in resp2.data['results']]
            mock_values_list.assert_not_called()

    def test_hide_official_brands_empty_blacklist_returns_all(self, auth_client):
        """Empty BrandBlacklist + hide_official_brands=true yields same result as =false."""
        BrandBlacklist.objects.all().delete()
        make_product(asin='B0EMPT001', brand='Nike')
        make_product(asin='B0EMPT002', brand='IndieShop')

        resp_hidden = auth_client.get(URL, {'hide_official_brands': 'true'})
        resp_shown = auth_client.get(URL, {'hide_official_brands': 'false'})
        assert resp_hidden.status_code == 200
        assert resp_shown.status_code == 200
        asins_hidden = sorted(p['asin'] for p in resp_hidden.data['results'])
        asins_shown = sorted(p['asin'] for p in resp_shown.data['results'])
        assert asins_hidden == asins_shown
        assert 'B0EMPT001' in asins_hidden
        assert 'B0EMPT002' in asins_hidden


class TestBrandBlacklistCache:
    """Covers the `research:blacklisted_brand_values` precomputed cache + signal."""

    def test_second_request_hits_cache_skips_distinct_brand_query(self, auth_client):
        """Second request must not re-run the DISTINCT scan on AmazonProduct."""
        BrandBlacklist.objects.get_or_create(brand_name='nike')
        make_product(asin='B0CACHE10', brand='Nike')
        make_product(asin='B0CACHE11', brand='IndieShop')

        # First request: warms both caches.
        resp1 = auth_client.get(URL, {'hide_official_brands': 'true'})
        assert resp1.status_code == 200
        # Cache must now hold the precomputed brand list.
        cached = redis_cache.get('research:blacklisted_brand_values')
        assert cached is not None

        # Second request: the DISTINCT scan on AmazonProduct must NOT run.
        with patch(
            'research_app.api.views.AmazonProduct.objects.exclude',
        ) as mock_exclude:
            resp2 = auth_client.get(URL, {'hide_official_brands': 'true'})
            assert resp2.status_code == 200
            # The DISTINCT scan path calls AmazonProduct.objects.exclude(brand=''),
            # so a cache hit means this is never called.
            mock_exclude.assert_not_called()

    def test_brand_blacklist_save_clears_cache(self, auth_client):
        """Creating a BrandBlacklist row must invalidate the precomputed cache."""
        # Use uniquely-named test brands to avoid colliding with seeded data
        # from migration 0007_seed_brand_blacklist.
        BrandBlacklist.objects.get_or_create(brand_name='zz_testbrand_x')
        make_product(asin='B0SIG_NK', brand='zz_testbrand_x')
        # Warm the cache.
        auth_client.get(URL, {'hide_official_brands': 'true'})
        assert redis_cache.get('research:blacklisted_brand_values') is not None
        assert redis_cache.get('research:official_brands') is not None

        # Signal must fire on save() and wipe BOTH caches.
        BrandBlacklist.objects.create(brand_name='zz_testbrand_y')

        assert redis_cache.get('research:blacklisted_brand_values') is None
        assert redis_cache.get('research:official_brands') is None

    def test_brand_blacklist_delete_clears_cache(self, auth_client):
        """Deleting a BrandBlacklist row must invalidate the precomputed cache."""
        target, _ = BrandBlacklist.objects.get_or_create(brand_name='zz_delbrand_x')
        make_product(asin='B0SIG_DEL', brand='zz_delbrand_x')
        auth_client.get(URL, {'hide_official_brands': 'true'})
        assert redis_cache.get('research:blacklisted_brand_values') is not None
        assert redis_cache.get('research:official_brands') is not None

        target.delete()

        assert redis_cache.get('research:blacklisted_brand_values') is None
        assert redis_cache.get('research:official_brands') is None

    def test_empty_blacklist_caches_empty_list(self, auth_client):
        """Empty BrandBlacklist must still cache (avoid re-running on every call)."""
        BrandBlacklist.objects.all().delete()
        # Sanity: signal fired during delete; both caches should be empty pre-call.
        assert redis_cache.get('research:blacklisted_brand_values') is None

        make_product(asin='B0EMPTY01', brand='Anything')
        resp = auth_client.get(URL, {'hide_official_brands': 'true'})
        assert resp.status_code == 200
        # The empty-list result is cached (None-vs-[] distinction).
        assert redis_cache.get('research:blacklisted_brand_values') == []


class TestBrandFilterPerformanceBaseline:
    """Soft regression guard: hide_official_brands must not introduce N+1s."""

    def test_no_n_plus_one_on_large_blacklist(self, auth_client, django_assert_max_num_queries):
        from scraper_app.models import MarketplaceChoices

        # 500 blacklist patterns.
        BrandBlacklist.objects.bulk_create(
            [BrandBlacklist(brand_name=f'brand{i:04d}') for i in range(500)],
            ignore_conflicts=True,
        )
        # 1000 products with diverse brand values, most NOT matching.
        AmazonProduct.objects.bulk_create([
            AmazonProduct(
                asin=f'B0NQ{i:06d}',
                marketplace=MarketplaceChoices.AMAZON_COM,
                title=f'Product {i}',
                brand=f'IndieBrand{i:04d}' if i % 50 else 'brand0001 Premium',
                bsr=1000 + i,
                product_type=AmazonProduct.ProductType.T_SHIRT,
            )
            for i in range(1000)
        ])

        with django_assert_max_num_queries(15):
            resp = auth_client.get(URL, {'hide_official_brands': 'true', 'page_size': 50})
            assert resp.status_code == 200


class TestProductListExcludeWords:
    def test_exclude_words_filters_titles(self, auth_client):
        make_product(asin='B0EXCL001', title='Funny Christmas Cat Shirt')
        make_product(asin='B0EXCL002', title='Funny Birthday Dog Shirt')
        make_product(asin='B0EXCL003', title='Cool Summer Design')

        resp = auth_client.get(URL, {'exclude_words': 'Christmas,Dog'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0EXCL003' in asins
        assert 'B0EXCL001' not in asins
        assert 'B0EXCL002' not in asins


class TestProductListCombinedFilters:
    def test_multiple_filters_combine_with_and(self, auth_client):
        """BSR range + hide_official_brands + exclude_words all AND together."""
        BrandBlacklist.objects.get_or_create(brand_name='nike')
        make_product(asin='B0COMB001', bsr=500, brand='IndieShop', title='Cat Lover Shirt')
        make_product(asin='B0COMB002', bsr=500, brand='Nike', title='Cat Lover Shirt')
        make_product(asin='B0COMB003', bsr=500, brand='IndieShop', title='Christmas Cat')
        make_product(asin='B0COMB004', bsr=99999, brand='IndieShop', title='Cat Lover Shirt')

        resp = auth_client.get(URL, {
            'bsr_min': 100,
            'bsr_max': 1000,
            'hide_official_brands': 'true',
            'exclude_words': 'Christmas',
        })
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0COMB001']


class TestProductListFTS:
    def test_fts_returns_results_for_keyword(self, auth_client):
        """Full-text search returns products matching keyword in title/brand."""
        make_product(asin='B0FTS_001', title='Funny Cat Birthday Shirt')
        make_product(asin='B0FTS_002', title='Dog Walking Adventure')

        resp = auth_client.get(URL, {'keyword': 'cat birthday'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        # FTS should find product with "cat" and "birthday" in title
        assert 'B0FTS_001' in asins


class TestProductListProductTypeFilter:
    def test_single_product_type(self, auth_client):
        """Filter by single product_type returns only matching products."""
        make_product(asin='B0TYPE_TS', product_type=AmazonProduct.ProductType.T_SHIRT)
        make_product(asin='B0TYPE_HD', product_type=AmazonProduct.ProductType.HOODIE)
        make_product(asin='B0TYPE_TK', product_type=AmazonProduct.ProductType.TANK_TOP)

        resp = auth_client.get(URL, {'product_type': 'hoodie'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0TYPE_HD']

    def test_multiple_product_types_comma_separated(self, auth_client):
        """Comma-separated product_type returns products of any listed type."""
        make_product(asin='B0MTP_TS', product_type=AmazonProduct.ProductType.T_SHIRT)
        make_product(asin='B0MTP_HD', product_type=AmazonProduct.ProductType.HOODIE)
        make_product(asin='B0MTP_TK', product_type=AmazonProduct.ProductType.TANK_TOP)

        resp = auth_client.get(URL, {'product_type': 't_shirt,tank_top'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0MTP_TS' in asins
        assert 'B0MTP_TK' in asins
        assert 'B0MTP_HD' not in asins

    def test_empty_product_type_returns_all(self, auth_client):
        """Empty product_type string returns all products (no filter)."""
        make_product(asin='B0EPT_TS', product_type=AmazonProduct.ProductType.T_SHIRT)
        make_product(asin='B0EPT_HD', product_type=AmazonProduct.ProductType.HOODIE)

        resp = auth_client.get(URL, {'product_type': ''})
        assert resp.status_code == 200
        assert resp.data['count'] == 2


class TestProductListSubcategoryFilter:
    def test_subcategory_filter_icontains(self, auth_client):
        """Subcategory filter uses case-insensitive contains."""
        make_product(asin='B0SUB_NOV', subcategory='Novelty T-Shirts')
        make_product(asin='B0SUB_SPO', subcategory='Sports Hoodies')
        make_product(asin='B0SUB_NOV2', subcategory='novelty accessories')

        resp = auth_client.get(URL, {'subcategory': 'novelty'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0SUB_NOV' in asins
        assert 'B0SUB_NOV2' in asins
        assert 'B0SUB_SPO' not in asins

    def test_empty_subcategory_returns_all(self, auth_client):
        """Empty subcategory returns all products."""
        make_product(asin='B0ESC_001', subcategory='Novelty')
        make_product(asin='B0ESC_002', subcategory='Sports')

        resp = auth_client.get(URL, {'subcategory': ''})
        assert resp.status_code == 200
        assert resp.data['count'] == 2


class TestProductListDateFilter:
    def test_date_from_filter(self, auth_client):
        """date_from excludes products listed before that date."""
        make_product(asin='B0DATE_OLD', listed_date=date(2024, 1, 15))
        make_product(asin='B0DATE_NEW', listed_date=date(2025, 6, 1))
        make_product(asin='B0DATE_MID', listed_date=date(2025, 3, 1))

        resp = auth_client.get(URL, {'date_from': '2025-01-01'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0DATE_NEW' in asins
        assert 'B0DATE_MID' in asins
        assert 'B0DATE_OLD' not in asins

    def test_date_to_filter(self, auth_client):
        """date_to excludes products listed after that date."""
        make_product(asin='B0DT2_OLD', listed_date=date(2024, 6, 1))
        make_product(asin='B0DT2_NEW', listed_date=date(2025, 12, 1))

        resp = auth_client.get(URL, {'date_to': '2025-01-01'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0DT2_OLD' in asins
        assert 'B0DT2_NEW' not in asins

    def test_date_range_filter(self, auth_client):
        """date_from + date_to combined narrows to range."""
        make_product(asin='B0DR_BEF', listed_date=date(2024, 1, 1))
        make_product(asin='B0DR_IN1', listed_date=date(2025, 3, 15))
        make_product(asin='B0DR_IN2', listed_date=date(2025, 6, 1))
        make_product(asin='B0DR_AFT', listed_date=date(2026, 1, 1))

        resp = auth_client.get(URL, {
            'date_from': '2025-01-01',
            'date_to': '2025-12-31',
        })
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0DR_IN1' in asins
        assert 'B0DR_IN2' in asins
        assert 'B0DR_BEF' not in asins
        assert 'B0DR_AFT' not in asins

    def test_null_listed_date_excluded_by_date_from(self, auth_client):
        """Products with null listed_date are excluded when date_from is set."""
        make_product(asin='B0DNULL01', listed_date=None)
        make_product(asin='B0DNULL02', listed_date=date(2025, 6, 1))

        resp = auth_client.get(URL, {'date_from': '2025-01-01'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert 'B0DNULL02' in asins
        assert 'B0DNULL01' not in asins


class TestProductListSorting:
    def test_sort_bsr_asc(self, auth_client):
        """sort_by=bsr_asc orders by BSR ascending."""
        make_product(asin='B0SRT_HI', bsr=50000)
        make_product(asin='B0SRT_LO', bsr=100)
        make_product(asin='B0SRT_MD', bsr=5000)

        resp = auth_client.get(URL, {'sort_by': 'bsr_asc'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0SRT_LO', 'B0SRT_MD', 'B0SRT_HI']

    def test_sort_reviews_desc(self, auth_client):
        """sort_by=reviews_desc orders by reviews descending."""
        make_product(asin='B0RVW_LO', reviews_count=10)
        make_product(asin='B0RVW_HI', reviews_count=500)
        make_product(asin='B0RVW_MD', reviews_count=100)

        resp = auth_client.get(URL, {'sort_by': 'reviews_desc'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0RVW_HI', 'B0RVW_MD', 'B0RVW_LO']

    def test_sort_rating_desc(self, auth_client):
        """sort_by=rating_desc orders by rating descending."""
        make_product(asin='B0RAT_LO', rating=2.0)
        make_product(asin='B0RAT_HI', rating=5.0)
        make_product(asin='B0RAT_MD', rating=3.5)

        resp = auth_client.get(URL, {'sort_by': 'rating_desc'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0RAT_HI', 'B0RAT_MD', 'B0RAT_LO']

    def test_sort_price_asc(self, auth_client):
        """sort_by=price_asc orders by price ascending."""
        make_product(asin='B0PRC_HI', price='49.99')
        make_product(asin='B0PRC_LO', price='9.99')
        make_product(asin='B0PRC_MD', price='24.99')

        resp = auth_client.get(URL, {'sort_by': 'price_asc'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0PRC_LO', 'B0PRC_MD', 'B0PRC_HI']

    def test_sort_newest(self, auth_client):
        """sort_by=newest orders by listed_date descending."""
        make_product(asin='B0NEW_OLD', listed_date=date(2024, 1, 1))
        make_product(asin='B0NEW_NEW', listed_date=date(2026, 1, 1))
        make_product(asin='B0NEW_MID', listed_date=date(2025, 6, 1))

        resp = auth_client.get(URL, {'sort_by': 'newest'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0NEW_NEW', 'B0NEW_MID', 'B0NEW_OLD']

    # NULL-handling: every desc/asc sort must put NULL-valued rows LAST.
    # PostgreSQL's default puts NULLs FIRST on DESC, which made these sorts
    # visually identical (the ~40% NULL-reviews/rating rows piled up at the top).
    # Regression guard: NULL-row goes to the END, not the START.

    def test_sort_reviews_desc_nulls_last(self, auth_client):
        """reviews_desc must place NULL reviews_count rows AFTER non-null rows."""
        make_product(asin='B0NULL_RV', reviews_count=None)
        make_product(asin='B0HIGH_RV', reviews_count=999)
        make_product(asin='B0LOW_RV', reviews_count=1)

        resp = auth_client.get(URL, {'sort_by': 'reviews_desc'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0HIGH_RV', 'B0LOW_RV', 'B0NULL_RV']

    def test_sort_rating_desc_nulls_last(self, auth_client):
        """rating_desc must place NULL rating rows AFTER non-null rows."""
        make_product(asin='B0NULL_RT', rating=None)
        make_product(asin='B0HIGH_RT', rating=4.9)
        make_product(asin='B0LOW_RT', rating=2.1)

        resp = auth_client.get(URL, {'sort_by': 'rating_desc'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0HIGH_RT', 'B0LOW_RT', 'B0NULL_RT']

    def test_sort_price_asc_nulls_last(self, auth_client):
        """price_asc must place NULL price rows AFTER non-null rows."""
        make_product(asin='B0NULL_PR', price=None)
        make_product(asin='B0HIGH_PR', price='49.99')
        make_product(asin='B0LOW_PR', price='5.99')

        resp = auth_client.get(URL, {'sort_by': 'price_asc'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0LOW_PR', 'B0HIGH_PR', 'B0NULL_PR']

    def test_sort_newest_nulls_last(self, auth_client):
        """newest must place NULL listed_date rows AFTER non-null rows."""
        make_product(asin='B0NULL_DT', listed_date=None)
        make_product(asin='B0NEW_DT', listed_date=date(2026, 1, 1))
        make_product(asin='B0OLD_DT', listed_date=date(2024, 1, 1))

        resp = auth_client.get(URL, {'sort_by': 'newest'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0NEW_DT', 'B0OLD_DT', 'B0NULL_DT']

    def test_default_sort_is_bsr_asc(self, auth_client):
        """No sort_by param defaults to BSR ascending."""
        make_product(asin='B0DEF_HI', bsr=9000)
        make_product(asin='B0DEF_LO', bsr=100)

        resp = auth_client.get(URL)
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['results']]
        assert asins == ['B0DEF_LO', 'B0DEF_HI']

    def test_invalid_sort_by_returns_400(self, auth_client):
        """Invalid sort_by value is rejected by serializer."""
        resp = auth_client.get(URL, {'sort_by': 'invalid_field'})
        assert resp.status_code == 400
