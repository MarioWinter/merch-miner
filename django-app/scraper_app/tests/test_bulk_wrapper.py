"""Tests for PROJ-25 Phase C — scrape_asin_batch_job wrapper.

Covers AC-19 / AC-20 / EC-10 / EC-10b / EC-10c / EC-16.
"""

import json
import os
from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from scraper_app.models import (
    AmazonProduct,
    BulkScrapeBatch,
    ScheduledScrapeTarget,
    ScrapeJob,
    ScraperConfig,
    ScrapeTier,
)
from scraper_app.tasks import (
    BATCH_OUTCOME_PATH_TEMPLATE,
    scrape_asin_batch_job,
)


pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _oneshot():
    tier, _ = ScrapeTier.objects.get_or_create(
        name='OneShot',
        defaults={'bsr_min': 0, 'bsr_max': None, 'interval_days': 999999},
    )
    return tier


def _mock_popen(returncode=0):
    proc = MagicMock()
    proc.pid = 4242
    proc.communicate.return_value = (b'', b'')
    proc.returncode = returncode
    return proc


def _make_batch(force_rescrape=False, marketplace='amazon_com'):
    return BulkScrapeBatch.objects.create(
        name='test',
        marketplace=marketplace,
        force_rescrape=force_rescrape,
        status=BulkScrapeBatch.Status.RUNNING,
        total_count=0,
    )


def _make_target(asin, batch, marketplace='amazon_com', retry_count=0):
    tier = _oneshot()
    return ScheduledScrapeTarget.objects.create(
        asin=asin,
        marketplace=marketplace,
        tier=tier,
        tier_override=True,
        active=True,  # drainer-style: target is active while job runs
        batch=batch,
        next_scrape_at=timezone.now(),
        retry_count=retry_count,
    )


def _make_job(batch, asin_list, marketplace='amazon_com', status=None):
    return ScrapeJob.objects.create(
        mode=ScrapeJob.Mode.BATCH_ASIN,
        marketplace=marketplace,
        status=status or ScrapeJob.Status.PENDING,
        asin_list=asin_list,
        batch=batch,
    )


def _write_outcome(job_id, results):
    path = BATCH_OUTCOME_PATH_TEMPLATE.format(job_id=job_id)
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump({'results': results}, fh)
    return path


# ---------------------------------------------------------------------------
# C.28 — wrapper marks targets done on success
# ---------------------------------------------------------------------------


class TestWrapperSuccess:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_marks_targets_done_on_success(self, mock_popen):
        mock_popen.return_value = _mock_popen(returncode=0)

        batch = _make_batch()
        asins = ['B0AAAAAAAA', 'B0BBBBBBBB']
        for a in asins:
            _make_target(a, batch)
        job = _make_job(batch, asins)

        # Pre-write fake outcome BEFORE wrapper runs.
        path = _write_outcome(job.id, [
            {'asin': asins[0], 'status': 'ok', 'http_status': 200,
             'scraped_at': timezone.now().isoformat()},
            {'asin': asins[1], 'status': 'ok', 'http_status': 200,
             'scraped_at': timezone.now().isoformat()},
        ])

        scrape_asin_batch_job(str(job.id))

        for a in asins:
            t = ScheduledScrapeTarget.objects.get(asin=a, batch=batch)
            assert t.active is False
            assert t.last_scraped_at is not None
            assert t.last_error is None
        job.refresh_from_db()
        assert job.status == ScrapeJob.Status.COMPLETED
        assert job.products_scraped == 2
        # Outcome file is cleaned up on success.
        assert not os.path.exists(path)


# ---------------------------------------------------------------------------
# C.29 — increments retry on failure below cap
# ---------------------------------------------------------------------------


class TestWrapperRetryBelowCap:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_retry_below_cap_clears_last_error(self, mock_popen):
        mock_popen.return_value = _mock_popen(returncode=0)

        cfg = ScraperConfig.load()
        cfg.max_retries_per_asin = 3  # plenty of room
        cfg.save()

        batch = _make_batch()
        asin = 'B0FAIL00001'
        target = _make_target(asin, batch, retry_count=0)
        job = _make_job(batch, [asin])
        _write_outcome(job.id, [
            {'asin': asin, 'status': 'failed',
             'error_message': 'HTTP 503', 'http_status': 503},
        ])

        scrape_asin_batch_job(str(job.id))

        target.refresh_from_db()
        assert target.active is False
        assert target.retry_count == 1
        assert target.last_error is None  # cleared so drainer retries


# ---------------------------------------------------------------------------
# C.30 — terminal fail at retry cap
# ---------------------------------------------------------------------------


class TestWrapperTerminalAtCap:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_terminal_failure_at_cap(self, mock_popen):
        mock_popen.return_value = _mock_popen(returncode=0)

        cfg = ScraperConfig.load()
        cfg.max_retries_per_asin = 1
        cfg.save()

        batch = _make_batch()
        asin = 'B0CAP00001A'
        target = _make_target(asin, batch, retry_count=0)
        job = _make_job(batch, [asin])
        _write_outcome(job.id, [
            {'asin': asin, 'status': 'failed',
             'error_message': 'HTTP 503', 'http_status': 503},
        ])

        scrape_asin_batch_job(str(job.id))

        target.refresh_from_db()
        assert target.active is False
        # retry_count incremented past cap
        assert target.retry_count == 1
        assert target.last_error == 'HTTP 503'


# ---------------------------------------------------------------------------
# C.31 / EC-10 — freshness skip when AmazonProduct is fresh
# ---------------------------------------------------------------------------


class TestWrapperFreshnessSkip:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_freshness_skip_when_amazonproduct_recent(self, mock_popen):
        mock_popen.return_value = _mock_popen(returncode=0)

        cfg = ScraperConfig.load()
        cfg.fresh_skip_days = 30
        cfg.save()

        batch = _make_batch(force_rescrape=False)
        asin = 'B0FRESH0001'
        AmazonProduct.objects.create(
            asin=asin,
            marketplace='amazon_com',
            scraped_at=timezone.now() - timedelta(days=5),
        )
        target = _make_target(asin, batch)
        job = _make_job(batch, [asin])
        _write_outcome(job.id, [
            {'asin': asin, 'status': 'ok', 'http_status': 200,
             'scraped_at': timezone.now().isoformat()},
        ])

        scrape_asin_batch_job(str(job.id))

        target.refresh_from_db()
        assert target.active is False
        assert target.last_error == 'skipped_fresh'
        # Retry count untouched on freshness skip.
        assert target.retry_count == 0

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_freshness_skip_ignored_when_product_old(self, mock_popen):
        mock_popen.return_value = _mock_popen(returncode=0)

        cfg = ScraperConfig.load()
        cfg.fresh_skip_days = 30
        cfg.save()

        batch = _make_batch(force_rescrape=False)
        asin = 'B0OLD000001'
        AmazonProduct.objects.create(
            asin=asin,
            marketplace='amazon_com',
            scraped_at=timezone.now() - timedelta(days=60),
        )
        target = _make_target(asin, batch)
        job = _make_job(batch, [asin])
        _write_outcome(job.id, [
            {'asin': asin, 'status': 'ok', 'http_status': 200,
             'scraped_at': timezone.now().isoformat()},
        ])

        scrape_asin_batch_job(str(job.id))

        target.refresh_from_db()
        assert target.active is False
        assert target.last_error is None  # not skipped


# ---------------------------------------------------------------------------
# C.32 / EC-10b — force_rescrape bypasses freshness
# ---------------------------------------------------------------------------


class TestWrapperForceRescrape:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_force_rescrape_bypasses_freshness(self, mock_popen):
        mock_popen.return_value = _mock_popen(returncode=0)

        cfg = ScraperConfig.load()
        cfg.fresh_skip_days = 30
        cfg.save()

        batch = _make_batch(force_rescrape=True)
        asin = 'B0FORCE0001'
        AmazonProduct.objects.create(
            asin=asin,
            marketplace='amazon_com',
            scraped_at=timezone.now() - timedelta(days=1),
        )
        target = _make_target(asin, batch)
        job = _make_job(batch, [asin])
        _write_outcome(job.id, [
            {'asin': asin, 'status': 'ok', 'http_status': 200,
             'scraped_at': timezone.now().isoformat()},
        ])

        scrape_asin_batch_job(str(job.id))

        target.refresh_from_db()
        assert target.last_error is None
        assert target.active is False


# ---------------------------------------------------------------------------
# C.33 / EC-16 — zombie detection
# ---------------------------------------------------------------------------


class TestWrapperZombieDetection:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_zombie_marks_failed_without_subprocess(self, mock_popen):
        batch = _make_batch()
        asin = 'B0ZOMBIE001'
        _make_target(asin, batch)
        # Pre-set RUNNING so the wrapper sees the zombie state at entry.
        job = _make_job(batch, [asin], status=ScrapeJob.Status.RUNNING)

        scrape_asin_batch_job(str(job.id))

        # subprocess.Popen was never called
        mock_popen.assert_not_called()
        job.refresh_from_db()
        assert job.status == ScrapeJob.Status.FAILED
        assert 'zombie' in (job.error_log or '').lower()


# ---------------------------------------------------------------------------
# Subprocess crashes -> all asins synthesized as failed
# ---------------------------------------------------------------------------


class TestWrapperSubprocessCrash:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_no_outcome_file_marks_all_asins_failed(self, mock_popen):
        # rc != 0 and no outcome file pre-written
        mock_popen.return_value = _mock_popen(returncode=1)

        cfg = ScraperConfig.load()
        cfg.max_retries_per_asin = 1
        cfg.save()

        batch = _make_batch()
        asin = 'B0CRASH0001'
        target = _make_target(asin, batch)
        job = _make_job(batch, [asin])

        scrape_asin_batch_job(str(job.id))

        job.refresh_from_db()
        # No outcome + rc != 0 -> FAILED
        assert job.status == ScrapeJob.Status.FAILED
        target.refresh_from_db()
        # Wrapper still reconciles synthesized failures, so retry_count bumps.
        assert target.retry_count == 1


# ---------------------------------------------------------------------------
# EC-10c (post-QA gap fix) — skip-decision happens at scrape-time, not at parse-time
# ---------------------------------------------------------------------------


class TestSkipDecisionAtScrapeTime:
    """EC-10c: skip-decision happens at scrape-time, not parse-time.

    Setup: at parse-time, an AmazonProduct existed that *would* be skipped
    under the then-current cfg.fresh_skip_days. Mid-flight (between parse
    and scrape) the admin lowers cfg.fresh_skip_days so the product is no
    longer "fresh" by the new threshold. Proof: wrapper scrapes (does NOT
    mark 'skipped_fresh'), demonstrating the skip-decision uses the
    *current* cfg, not whatever was true at parse-time.
    """

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_skip_decision_deferred_to_scrape_time(self, mock_popen):
        from scraper_app.models import AmazonProduct, ScraperConfig
        from scraper_app.tasks import scrape_asin_batch_job

        mock_popen.return_value = _mock_popen(returncode=0)

        asin = 'B07ECCASE0'
        marketplace = 'amazon_com'
        # AmazonProduct last scraped 10 days ago.
        AmazonProduct.objects.create(
            asin=asin, marketplace=marketplace, bsr=1000,
            scraped_at=timezone.now() - timedelta(days=10),
        )

        # cfg at parse-time: 30d window — product would be "fresh" → would skip.
        cfg = ScraperConfig.load()
        cfg.fresh_skip_days = 30
        cfg.save()

        batch = _make_batch(force_rescrape=False)
        target = _make_target(asin, batch)
        job = _make_job(batch, [asin])
        _write_outcome(job.id, [
            {'asin': asin, 'status': 'ok', 'http_status': 200,
             'scraped_at': timezone.now().isoformat()},
        ])

        # Admin lowers fresh_skip_days BEFORE the wrapper runs.
        # Product (10d old) is no longer fresh by this new 5d threshold.
        cfg.refresh_from_db()
        cfg.fresh_skip_days = 5
        cfg.save()

        scrape_asin_batch_job(str(job.id))

        target.refresh_from_db()
        # Wrapper SCRAPED the target (active=False, last_scraped_at set,
        # last_error is NOT 'skipped_fresh') — proves the skip decision uses
        # the current cfg, not a parse-time snapshot.
        assert target.active is False
        assert target.last_scraped_at is not None
        assert target.last_error != 'skipped_fresh'
