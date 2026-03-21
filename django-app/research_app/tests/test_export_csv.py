import csv
import io

import pytest
from django.urls import reverse

from scraper_app.models import AmazonProduct, MarketplaceChoices

from research_app.tests.conftest import make_product

pytestmark = pytest.mark.django_db

URL = reverse('research-products-export')

EXPECTED_COLUMNS = [
    'ASIN', 'Title', 'Brand', 'BSR', 'Rating', 'Reviews',
    'Price', 'Product Type', 'Subcategory', 'Listed Date',
    'Scraped At', 'Marketplace',
]


class TestExportCSVAuth:
    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(URL)
        assert resp.status_code == 401


class TestExportCSVResponse:
    def test_content_type_is_csv(self, auth_client):
        resp = auth_client.get(URL)
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'text/csv'

    def test_content_disposition_header(self, auth_client):
        resp = auth_client.get(URL)
        assert 'attachment; filename="research-export.csv"' in resp['Content-Disposition']

    def test_streaming_response(self, auth_client):
        resp = auth_client.get(URL)
        assert resp.streaming is True


class TestExportCSVContent:
    def test_csv_has_correct_12_columns(self, auth_client):
        make_product(asin='B0CSV_001', title='Export Test')

        resp = auth_client.get(URL)
        content = b''.join(resp.streaming_content).decode('utf-8')
        reader = csv.reader(io.StringIO(content))
        headers = next(reader)
        assert headers == EXPECTED_COLUMNS

    def test_csv_contains_product_data(self, auth_client):
        make_product(
            asin='B0CSV_002',
            title='My Cool Shirt',
            brand='TestBrand',
            bsr=1234,
            rating=4.5,
            reviews_count=99,
            price='19.99',
        )

        resp = auth_client.get(URL)
        content = b''.join(resp.streaming_content).decode('utf-8')
        reader = csv.reader(io.StringIO(content))
        next(reader)  # skip header
        row = next(reader)
        assert row[0] == 'B0CSV_002'
        assert row[1] == 'My Cool Shirt'
        assert row[2] == 'TestBrand'
        assert row[3] == '1234'

    def test_csv_filters_applied(self, auth_client):
        """Same filters as list endpoint work for export."""
        make_product(asin='B0CSVF_01', bsr=100, brand='IndieShop')
        make_product(asin='B0CSVF_02', bsr=50000, brand='IndieShop')

        resp = auth_client.get(URL, {'bsr_max': 1000})
        content = b''.join(resp.streaming_content).decode('utf-8')
        reader = csv.reader(io.StringIO(content))
        next(reader)  # skip header
        rows = list(reader)
        asins = [r[0] for r in rows]
        assert 'B0CSVF_01' in asins
        assert 'B0CSVF_02' not in asins

    def test_empty_export_has_header_only(self, auth_client):
        resp = auth_client.get(URL, {'bsr_min': 999999, 'bsr_max': 999999})
        content = b''.join(resp.streaming_content).decode('utf-8')
        reader = csv.reader(io.StringIO(content))
        headers = next(reader)
        assert headers == EXPECTED_COLUMNS
        rows = list(reader)
        assert len(rows) == 0
