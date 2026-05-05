"""Tests for PROJ-25 Phase A — OneShot ScrapeTier semantics.

Covers:
- AC-5 / EC-15: idempotent seed of the OneShot tier
- AC-21: OneShot targets are NOT rescheduled on save()
- AC-21 (wrapper side): scrape_asin_detail_job deactivates OneShot targets
"""

import importlib
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from scraper_app.models import (
    AmazonProduct,
    ScheduledScrapeTarget,
    ScrapeJob,
    ScrapeTier,
)
from scraper_app.tasks import scrape_asin_detail_job


# Migration filename starts with a digit, so a normal `from ... import` is
# invalid Python syntax. Use importlib instead.
_seed_module = importlib.import_module('scraper_app.migrations.0018_seed_oneshot_tier')
seed_oneshot_tier = _seed_module.seed_oneshot_tier


pytestmark = pytest.mark.django_db


def _get_or_create_oneshot():
    tier, _ = ScrapeTier.objects.get_or_create(
        name='OneShot',
        defaults={'bsr_min': 0, 'bsr_max': None, 'interval_days': 999999},
    )
    return tier


def _mock_popen(returncode=0, stdout=b'', stderr=b''):
    mock_proc = MagicMock()
    mock_proc.pid = 12345
    mock_proc.communicate.return_value = (stdout, stderr)
    mock_proc.returncode = returncode
    return mock_proc


# ---------------------------------------------------------------------------
# A.5 — test_oneshot_tier_seed_idempotent
# ---------------------------------------------------------------------------

class TestOneShotSeedIdempotent:
    def test_running_seed_twice_does_not_duplicate(self):
        """Running the seed function twice leaves exactly one OneShot row.

        AC-5 / EC-15 — seed is idempotent via filter().exists().
        Note: the data migration already ran during pytest DB setup, so a
        OneShot row may already exist; we clear and re-test from a clean
        baseline.
        """
        ScrapeTier.objects.filter(name='OneShot').delete()

        class _FakeApps:
            @staticmethod
            def get_model(app_label, model_name):
                assert app_label == 'scraper_app'
                assert model_name == 'ScrapeTier'
                return ScrapeTier

        seed_oneshot_tier(_FakeApps, schema_editor=None)
        seed_oneshot_tier(_FakeApps, schema_editor=None)

        rows = ScrapeTier.objects.filter(name='OneShot')
        assert rows.count() == 1
        row = rows.first()
        assert row.bsr_min == 0
        assert row.bsr_max is None
        assert row.interval_days == 999999

    def test_seed_does_not_overwrite_existing(self):
        """If admin pre-created OneShot with different interval_days, seed leaves it alone."""
        # Strip any prior OneShot (e.g. one created by the data migration during
        # pytest DB setup) so the test starts from a known state.
        ScrapeTier.objects.filter(name='OneShot').delete()

        ScrapeTier.objects.create(
            name='OneShot', bsr_min=0, bsr_max=None, interval_days=42,
        )

        class _FakeApps:
            @staticmethod
            def get_model(app_label, model_name):
                return ScrapeTier

        seed_oneshot_tier(_FakeApps, schema_editor=None)

        rows = ScrapeTier.objects.filter(name='OneShot')
        assert rows.count() == 1  # seed must NOT add a second row
        assert rows.first().interval_days == 42  # untouched


# ---------------------------------------------------------------------------
# A.5 — test_oneshot_target_save_does_not_reschedule
# ---------------------------------------------------------------------------

class TestOneShotTargetSave:
    def test_save_with_last_scraped_at_does_not_recalculate_next_scrape_at(self):
        """AC-21: OneShot targets keep next_scrape_at untouched on save."""
        oneshot = _get_or_create_oneshot()
        original_next = timezone.now() + timedelta(days=365)

        target = ScheduledScrapeTarget.objects.create(
            asin='B0ONESHOT01', marketplace='amazon_com', tier=oneshot,
            next_scrape_at=original_next, active=True,
        )
        # Mark as scraped just now and save.
        target.last_scraped_at = timezone.now()
        target.save()

        target.refresh_from_db()
        # next_scrape_at must be unchanged (NOT last_scraped_at + 999999d).
        assert abs((target.next_scrape_at - original_next).total_seconds()) < 1

    def test_non_oneshot_target_still_reschedules(self):
        """Regression guard: existing recurring-scrape behaviour unchanged for non-OneShot tiers."""
        tier = ScrapeTier.objects.create(
            name='Tier 1', bsr_min=1, bsr_max=50000, interval_days=3,
        )
        target = ScheduledScrapeTarget.objects.create(
            asin='B0RECURR001', marketplace='amazon_com', tier=tier,
            next_scrape_at=timezone.now() - timedelta(hours=1),
        )
        scraped_at = timezone.now()
        target.last_scraped_at = scraped_at
        target.save()

        target.refresh_from_db()
        expected = scraped_at + timedelta(days=tier.interval_days)
        assert abs((target.next_scrape_at - expected).total_seconds()) < 1


# ---------------------------------------------------------------------------
# A.5 — test_oneshot_target_deactivated_after_scrape
# ---------------------------------------------------------------------------

class TestScrapeAsinDetailJobOneShot:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_oneshot_target_deactivated_after_successful_scrape(self, mock_popen_cls):
        """A.4 / AC-21: wrapper sets target.active=False for OneShot tier on success."""
        mock_popen_cls.return_value = _mock_popen(returncode=0)

        oneshot = _get_or_create_oneshot()
        asin = 'B0ONESHOT99'
        marketplace = 'amazon_com'

        # Pre-create the AmazonProduct so the BSR-based tier-reassignment
        # path is exercised (and must be skipped for OneShot).
        AmazonProduct.objects.create(asin=asin, marketplace=marketplace, bsr=12345)

        original_next = timezone.now() + timedelta(days=365)
        target = ScheduledScrapeTarget.objects.create(
            asin=asin, marketplace=marketplace, tier=oneshot,
            next_scrape_at=original_next, active=True,
        )
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.SCHEDULED, asin=asin, marketplace=marketplace,
            status=ScrapeJob.Status.PENDING,
        )

        scrape_asin_detail_job(asin, marketplace, scrape_job_id=str(job.id))

        target.refresh_from_db()
        assert target.active is False
        assert target.last_scraped_at is not None
        # Tier must remain OneShot (no BSR-based reassignment for OneShot targets).
        assert target.tier_id == oneshot.id
        # next_scrape_at must NOT have shifted (OneShot save() leaves it).
        assert abs((target.next_scrape_at - original_next).total_seconds()) < 1

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_non_oneshot_target_stays_active_and_reschedules(self, mock_popen_cls):
        """Regression: non-OneShot targets keep active=True and get next_scrape_at recalculated."""
        mock_popen_cls.return_value = _mock_popen(returncode=0)

        tier = ScrapeTier.objects.create(
            name='Tier 1', bsr_min=1, bsr_max=50000, interval_days=1,
        )
        asin = 'B0RECURR99'
        marketplace = 'amazon_com'
        AmazonProduct.objects.create(asin=asin, marketplace=marketplace, bsr=1000)

        target = ScheduledScrapeTarget.objects.create(
            asin=asin, marketplace=marketplace, tier=tier,
            next_scrape_at=timezone.now() - timedelta(hours=1), active=True,
        )
        job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.SCHEDULED, asin=asin, marketplace=marketplace,
            status=ScrapeJob.Status.PENDING,
        )

        scrape_asin_detail_job(asin, marketplace, scrape_job_id=str(job.id))

        target.refresh_from_db()
        assert target.active is True
        assert target.last_scraped_at is not None
        expected_next = target.last_scraped_at + timedelta(days=tier.interval_days)
        assert abs((target.next_scrape_at - expected_next).total_seconds()) < 1
