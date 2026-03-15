import pytest
from django.contrib.auth import get_user_model

from scraper_app.models import ScrapeTier


@pytest.fixture
def scrape_tiers():
    """Create default ScrapeTier rows used across test modules."""
    t1 = ScrapeTier.objects.create(name='Tier 1', bsr_min=1, bsr_max=50000, interval_days=1)
    t2 = ScrapeTier.objects.create(name='Tier 2', bsr_min=50001, bsr_max=200000, interval_days=3)
    t3 = ScrapeTier.objects.create(name='Tier 3', bsr_min=200001, bsr_max=None, interval_days=7)
    return t1, t2, t3


@pytest.fixture
def admin_user():
    User = get_user_model()
    return User.objects.create_superuser(email='admin@test.com', password='testpass123')


@pytest.fixture
def admin_client(client, admin_user):
    client.force_login(admin_user)
    return client
