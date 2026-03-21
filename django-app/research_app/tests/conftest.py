import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from scraper_app.models import (
    AmazonProduct,
    BSRSnapshot,
    Keyword,
    MarketplaceChoices,
    ProductSearchCache,
    ScrapeJob,
)
from workspace_app.models import Membership, Workspace

User = get_user_model()


@pytest.fixture
def user():
    return User.objects.create_user(
        email='researcher@test.com',
        password='TestPass123!',
        username='researcher',
        is_active=True,
    )


@pytest.fixture
def other_user():
    return User.objects.create_user(
        email='other@test.com',
        password='TestPass123!',
        username='otheruser',
        is_active=True,
    )


@pytest.fixture
def workspace(user):
    return Workspace.objects.create(name='Test WS', slug='test-ws', owner=user)


@pytest.fixture
def other_workspace(other_user):
    return Workspace.objects.create(name='Other WS', slug='other-ws', owner=other_user)


@pytest.fixture
def membership(user, workspace):
    return Membership.objects.create(
        workspace=workspace,
        user=user,
        role=Membership.Role.ADMIN,
        status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def other_membership(other_user, other_workspace):
    return Membership.objects.create(
        workspace=other_workspace,
        user=other_user,
        role=Membership.Role.ADMIN,
        status=Membership.Status.ACTIVE,
    )


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client, user):
    """Authenticated APIClient using force_authenticate."""
    api_client.force_authenticate(user=user)
    return api_client


@pytest.fixture
def keyword():
    return Keyword.objects.create(
        keyword='funny cats',
        marketplace=MarketplaceChoices.AMAZON_COM,
    )


@pytest.fixture
def scrape_job(keyword):
    return ScrapeJob.objects.create(
        mode=ScrapeJob.Mode.LIVE,
        keyword=keyword,
        marketplace=MarketplaceChoices.AMAZON_COM,
        status=ScrapeJob.Status.PENDING,
        pages_done=2,
        products_scraped=15,
    )


@pytest.fixture
def search_cache(keyword, scrape_job, workspace):
    return ProductSearchCache.objects.create(
        keyword=keyword,
        scrape_job=scrape_job,
        workspace=workspace,
        status=ProductSearchCache.Status.PENDING,
    )


@pytest.fixture
def product(keyword):
    p = AmazonProduct.objects.create(
        asin='B0TEST0001',
        marketplace=MarketplaceChoices.AMAZON_COM,
        title='Funny Cat Shirt',
        brand='IndieDesign',
        bsr=5000,
        price='19.99',
        rating=4.5,
        reviews_count=120,
        product_type=AmazonProduct.ProductType.T_SHIRT,
    )
    p.keywords.add(keyword)
    return p


def make_product(keyword_obj=None, **overrides):
    """Helper to create AmazonProduct with defaults."""
    defaults = {
        'marketplace': MarketplaceChoices.AMAZON_COM,
        'title': 'Test Product',
        'brand': 'TestBrand',
        'bsr': 10000,
        'price': '14.99',
        'rating': 4.0,
        'reviews_count': 50,
        'product_type': AmazonProduct.ProductType.T_SHIRT,
    }
    defaults.update(overrides)
    p = AmazonProduct.objects.create(**defaults)
    if keyword_obj:
        p.keywords.add(keyword_obj)
    return p
