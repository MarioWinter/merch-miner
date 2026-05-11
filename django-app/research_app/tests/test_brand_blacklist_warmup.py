"""Tests for the BrandBlacklist cache warmup task + scheduler + signal."""

from io import StringIO
from unittest.mock import MagicMock, patch

import pytest
from django.core.cache import cache as redis_cache
from django.core.management import call_command

from research_app.tasks import warm_blacklisted_brand_values_cache
from research_app.tests.conftest import make_product
from scraper_app.models import BrandBlacklist


BLACKLISTED_KEY = 'research:blacklisted_brand_values'
OFFICIAL_KEY = 'research:official_brands'


@pytest.fixture(autouse=True)
def clear_cache_and_seed():
    """Reset caches + seed-data fallout from migration 0007 before each test."""
    redis_cache.delete(BLACKLISTED_KEY)
    redis_cache.delete(OFFICIAL_KEY)
    BrandBlacklist.objects.all().delete()
    yield
    redis_cache.delete(BLACKLISTED_KEY)
    redis_cache.delete(OFFICIAL_KEY)


@pytest.mark.django_db
class TestWarmBlacklistedBrandValuesCache:
    """Cover the pure task `warm_blacklisted_brand_values_cache`."""

    def test_populates_cache_with_matched_brands(self):
        """Task must write the matched list to the cache key."""
        BrandBlacklist.objects.create(brand_name='nike')
        make_product(asin='B0WARM001', brand='Nike')
        make_product(asin='B0WARM002', brand='IndieShop')

        assert redis_cache.get(BLACKLISTED_KEY) is None

        count = warm_blacklisted_brand_values_cache()

        cached = redis_cache.get(BLACKLISTED_KEY)
        assert cached is not None
        assert 'Nike' in cached
        assert 'IndieShop' not in cached
        assert count == len(cached)

    def test_overwrites_existing_cache(self):
        """Warmup must overwrite a pre-existing cache value (no skip-when-warm)."""
        BrandBlacklist.objects.create(brand_name='nike')
        make_product(asin='B0WARM010', brand='Nike')

        # Sentinel value the warmup should overwrite.
        redis_cache.set(BLACKLISTED_KEY, ['__stale_sentinel__'], 3600)

        warm_blacklisted_brand_values_cache()

        cached = redis_cache.get(BLACKLISTED_KEY)
        assert cached != ['__stale_sentinel__']
        assert 'Nike' in cached


@pytest.mark.django_db
class TestScheduleBrandBlacklistWarmupCommand:
    """Cover the management command idempotency."""

    def test_idempotent_registration(self):
        """Running the command twice leaves exactly one job with the JOB_ID."""
        from research_app.management.commands.schedule_brand_blacklist_warmup import (
            JOB_ID,
        )

        # Fake scheduler that records cron() calls + supports cancel().
        registered: list[str] = []

        class FakeScheduler:
            def get_jobs(self):
                # Return any previously-registered job objects.
                return [MagicMock(id=jid) for jid in registered]

            def cancel(self, job):
                if job.id in registered:
                    registered.remove(job.id)

            def cron(self, cron_string, **kwargs):
                jid = kwargs.get('id')
                # Mirror real scheduler: only one job per id.
                if jid in registered:
                    registered.remove(jid)
                registered.append(jid)

        fake = FakeScheduler()

        with patch(
            'research_app.management.commands.schedule_brand_blacklist_warmup'
            '.django_rq.get_scheduler',
            return_value=fake,
        ):
            call_command('schedule_brand_blacklist_warmup', stdout=StringIO())
            call_command('schedule_brand_blacklist_warmup', stdout=StringIO())

        assert registered.count(JOB_ID) == 1


@pytest.mark.django_db
class TestBrandBlacklistSignalEnqueuesWarmup:
    """Cover the signal-driven async warmup."""

    def test_create_enqueues_warmup_task(self):
        """post_save on BrandBlacklist must enqueue the warmup task."""
        with patch('research_app.signals.django_rq.enqueue') as mock_enqueue:
            BrandBlacklist.objects.create(brand_name='zz_signal_enqueue')

        mock_enqueue.assert_called_once_with(
            'research_app.tasks.warm_blacklisted_brand_values_cache',
        )

    def test_enqueue_failure_does_not_break_save(self):
        """If redis/rq is unavailable the model save must still succeed and
        the cache keys must still be cleared (lazy rebuild on next request)."""
        # Pre-seed caches so we can assert they get wiped.
        redis_cache.set(BLACKLISTED_KEY, ['__sentinel__'], 3600)
        redis_cache.set(OFFICIAL_KEY, ['__sentinel__'], 300)

        with patch(
            'research_app.signals.django_rq.enqueue',
            side_effect=RuntimeError('redis down'),
        ):
            # Must NOT raise.
            obj = BrandBlacklist.objects.create(brand_name='zz_signal_fail')

        assert obj.pk is not None
        assert redis_cache.get(BLACKLISTED_KEY) is None
        assert redis_cache.get(OFFICIAL_KEY) is None
