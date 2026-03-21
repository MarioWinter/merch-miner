import pytest
from django.urls import reverse

from scraper_app.models import AmazonProduct, MarketplaceChoices

from research_app.tests.conftest import make_product

pytestmark = pytest.mark.django_db

URL = reverse('research-products')


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
        data = resp.data['data']
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
        data = resp.data['data']
        assert data['count'] == 5
        assert len(data['results']) == 2
        assert data['next'] is not None

    def test_pagination_page_2(self, auth_client):
        """Page 2 returns correct slice."""
        for i in range(5):
            make_product(asin=f'B0PG2_{i:04d}', bsr=i + 1)

        resp = auth_client.get(URL, {'page': 2, 'page_size': 2})
        assert resp.status_code == 200
        data = resp.data['data']
        assert len(data['results']) == 2
        assert data['previous'] is not None


class TestProductListBSRFilter:
    def test_bsr_range_filter(self, auth_client):
        make_product(asin='B0BSR_LOW', bsr=100)
        make_product(asin='B0BSR_MID', bsr=5000)
        make_product(asin='B0BSR_HI', bsr=50000)

        resp = auth_client.get(URL, {'bsr_min': 1000, 'bsr_max': 10000})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['data']['results']]
        assert 'B0BSR_MID' in asins
        assert 'B0BSR_LOW' not in asins
        assert 'B0BSR_HI' not in asins

    def test_bsr_min_greater_than_max_returns_400(self, auth_client):
        resp = auth_client.get(URL, {'bsr_min': 10000, 'bsr_max': 100})
        assert resp.status_code == 400


class TestProductListBrandFilter:
    def test_hide_official_brands_excludes_nike(self, auth_client):
        """hide_official_brands=true excludes brands from fixture (case-insensitive)."""
        make_product(asin='B0NIKE001', brand='Nike')
        make_product(asin='B0INDIE01', brand='IndieShop')

        resp = auth_client.get(URL, {'hide_official_brands': 'true'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['data']['results']]
        assert 'B0INDIE01' in asins
        assert 'B0NIKE001' not in asins

    def test_hide_official_brands_case_insensitive(self, auth_client):
        """Brand matching is case-insensitive (nike == Nike == NIKE)."""
        make_product(asin='B0NIKELO', brand='nike')
        make_product(asin='B0NIKEUP', brand='NIKE')
        make_product(asin='B0GOOD01', brand='MyCoolBrand')

        resp = auth_client.get(URL, {'hide_official_brands': 'true'})
        asins = [p['asin'] for p in resp.data['data']['results']]
        assert 'B0GOOD01' in asins
        assert 'B0NIKELO' not in asins
        assert 'B0NIKEUP' not in asins


class TestProductListExcludeWords:
    def test_exclude_words_filters_titles(self, auth_client):
        make_product(asin='B0EXCL001', title='Funny Christmas Cat Shirt')
        make_product(asin='B0EXCL002', title='Funny Birthday Dog Shirt')
        make_product(asin='B0EXCL003', title='Cool Summer Design')

        resp = auth_client.get(URL, {'exclude_words': 'Christmas,Dog'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['data']['results']]
        assert 'B0EXCL003' in asins
        assert 'B0EXCL001' not in asins
        assert 'B0EXCL002' not in asins


class TestProductListCombinedFilters:
    def test_multiple_filters_combine_with_and(self, auth_client):
        """BSR range + hide_official_brands + exclude_words all AND together."""
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
        asins = [p['asin'] for p in resp.data['data']['results']]
        assert asins == ['B0COMB001']


class TestProductListFTS:
    def test_fts_returns_results_for_keyword(self, auth_client):
        """Full-text search returns products matching keyword in title/brand."""
        make_product(asin='B0FTS_001', title='Funny Cat Birthday Shirt')
        make_product(asin='B0FTS_002', title='Dog Walking Adventure')

        resp = auth_client.get(URL, {'keyword': 'cat birthday'})
        assert resp.status_code == 200
        asins = [p['asin'] for p in resp.data['data']['results']]
        # FTS should find product with "cat" and "birthday" in title
        assert 'B0FTS_001' in asins
