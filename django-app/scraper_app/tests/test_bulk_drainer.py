"""Tests for PROJ-25 Phase D — drain_bulk_batch + helpers.

Covers AC-12 / AC-13 / AC-14 / AC-15 / EC-7 / EC-13.
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone

from scraper_app.models import (
    BulkScrapeBatch,
    ScheduledScrapeTarget,
    ScrapeJob,
    ScraperConfig,
    ScrapeTier,
)
from scraper_app.tasks import (
    _bulk_drainer_lock,
    _pick_next_targets,
    _refresh_batch_counts,
    drain_bulk_batch,
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


def _seed_batch(num_targets, status=BulkScrapeBatch.Status.RUNNING, marketplace='amazon_com'):
    batch = BulkScrapeBatch.objects.create(
        name='drainer-test',
        marketplace=marketplace,
        status=status,
        total_count=num_targets,
        pending_count=num_targets,
    )
    tier = _oneshot()
    for i in range(num_targets):
        ScheduledScrapeTarget.objects.create(
            asin=f'B0DRA{i:05d}',
            marketplace=marketplace,
            tier=tier,
            tier_override=True,
            active=False,
            batch=batch,
            next_scrape_at=timezone.now(),
        )
    return batch


def _set_cfg(concurrent_requests=50, batch_size=10, max_retries=1):
    cfg = ScraperConfig.load()
    cfg.concurrent_requests = concurrent_requests
    cfg.batch_size = batch_size
    cfg.max_retries_per_asin = max_retries
    cfg.save()
    return cfg


# ---------------------------------------------------------------------------
# D.20 — drainer enqueues first chunk when idle
# ---------------------------------------------------------------------------


class TestDrainerEnqueuesIdle:
    @patch('scraper_app.tasks.django_rq')
    def test_enqueues_chunks_when_no_inflight(self, mock_django_rq):
        # 25 targets, batch_size=10, max_in_flight = 50 // 10 = 5
        # -> drainer would have 5 slots; 5*10 = 50 picks but only 25 exist
        # -> ceil(25/10) = 3 jobs enqueued (10, 10, 5)
        _set_cfg(concurrent_requests=50, batch_size=10)
        batch = _seed_batch(25)

        # Mock RQ — get_connection for lock, get_queue for enqueue
        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        default_q = MagicMock()
        scraper_q.enqueue.return_value = MagicMock(id='rq-123')

        def _get_queue(name):
            return scraper_q if name == 'scraper' else default_q

        mock_django_rq.get_queue.side_effect = _get_queue

        drain_bulk_batch(str(batch.id))

        assert scraper_q.enqueue.call_count == 3
        jobs = ScrapeJob.objects.filter(batch=batch)
        assert jobs.count() == 3
        sizes = sorted(len(j.asin_list) for j in jobs)
        assert sizes == [5, 10, 10]
        # Drainer should have re-scheduled itself (work remains in flight).
        assert default_q.enqueue_in.called


# ---------------------------------------------------------------------------
# D.21 — drainer respects max_in_flight
# ---------------------------------------------------------------------------


class TestDrainerRespectsMaxInFlight:
    @patch('scraper_app.tasks.django_rq')
    def test_no_enqueue_when_pool_full(self, mock_django_rq):
        _set_cfg(concurrent_requests=50, batch_size=10)
        batch = _seed_batch(20)
        # Pre-create 5 PENDING jobs to fill the pool.
        for i in range(5):
            ScrapeJob.objects.create(
                mode=ScrapeJob.Mode.BATCH_ASIN,
                marketplace='amazon_com',
                status=ScrapeJob.Status.PENDING,
                asin_list=['B0XXXXX' + str(i).zfill(3)],
                batch=batch,
            )

        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        default_q = MagicMock()
        mock_django_rq.get_queue.side_effect = lambda n: scraper_q if n == 'scraper' else default_q

        drain_bulk_batch(str(batch.id))

        # No new jobs created beyond the 5 we pre-seeded.
        assert ScrapeJob.objects.filter(batch=batch).count() == 5
        scraper_q.enqueue.assert_not_called()


# ---------------------------------------------------------------------------
# D.22 — drainer exits when paused
# ---------------------------------------------------------------------------


class TestDrainerPauseExits:
    @patch('scraper_app.tasks.django_rq')
    def test_paused_batch_does_not_enqueue_or_reschedule(self, mock_django_rq):
        _set_cfg()
        batch = _seed_batch(5, status=BulkScrapeBatch.Status.PAUSED)

        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        default_q = MagicMock()
        mock_django_rq.get_queue.side_effect = lambda n: scraper_q if n == 'scraper' else default_q

        drain_bulk_batch(str(batch.id))

        scraper_q.enqueue.assert_not_called()
        default_q.enqueue_in.assert_not_called()


# ---------------------------------------------------------------------------
# D.23 — drainer marks COMPLETED when no work remains
# ---------------------------------------------------------------------------


class TestDrainerCompletes:
    @patch('scraper_app.tasks.django_rq')
    def test_completion_when_all_done(self, mock_django_rq):
        _set_cfg()
        batch = _seed_batch(0)  # zero targets at all
        # Manually mark the batch RUNNING (already done by _seed_batch).
        # Drainer should detect remaining=0 and in_flight=0 -> COMPLETED.

        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        default_q = MagicMock()
        mock_django_rq.get_queue.side_effect = lambda n: scraper_q if n == 'scraper' else default_q

        drain_bulk_batch(str(batch.id))

        batch.refresh_from_db()
        assert batch.status == BulkScrapeBatch.Status.COMPLETED
        assert batch.finished_at is not None
        default_q.enqueue_in.assert_not_called()


# ---------------------------------------------------------------------------
# D.24 — drainer lock idempotent
# ---------------------------------------------------------------------------


class TestDrainerLockIdempotent:
    @patch('scraper_app.tasks.django_rq')
    def test_locked_drainer_exits_without_reenqueue(self, mock_django_rq):
        _set_cfg()
        batch = _seed_batch(5)

        fake_conn = MagicMock()
        # Simulate lock already held — set returns None / False on NX conflict.
        fake_conn.set.return_value = False
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        default_q = MagicMock()
        mock_django_rq.get_queue.side_effect = lambda n: scraper_q if n == 'scraper' else default_q

        drain_bulk_batch(str(batch.id))

        scraper_q.enqueue.assert_not_called()
        default_q.enqueue_in.assert_not_called()
        assert ScrapeJob.objects.filter(batch=batch).count() == 0


# ---------------------------------------------------------------------------
# D.25 — concurrency-limit change takes effect next tick
# ---------------------------------------------------------------------------


class TestDrainerConcurrencyChange:
    @patch('scraper_app.tasks.django_rq')
    def test_max_in_flight_changes_after_cfg_update(self, mock_django_rq):
        # First tick: cfg=50, batch_size=10 -> max_in_flight=5
        _set_cfg(concurrent_requests=50, batch_size=10)
        batch = _seed_batch(60)

        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        default_q = MagicMock()
        scraper_q.enqueue.return_value = MagicMock(id='rq')
        mock_django_rq.get_queue.side_effect = lambda n: scraper_q if n == 'scraper' else default_q

        drain_bulk_batch(str(batch.id))

        # First tick: 5 chunks of 10 = 50 targets.
        assert ScrapeJob.objects.filter(batch=batch).count() == 5

        # Now drop concurrency to 25 (max_in_flight=2). Mark existing jobs as
        # COMPLETED so they don't count as in-flight, then re-run drainer.
        ScrapeJob.objects.filter(batch=batch).update(status=ScrapeJob.Status.COMPLETED)
        # Reactivate the 50 already-claimed targets so the drainer can pick them
        # — they were marked active=True by the first tick.
        ScheduledScrapeTarget.objects.filter(batch=batch, active=True).update(active=False)
        _set_cfg(concurrent_requests=25, batch_size=10)

        scraper_q.enqueue.reset_mock()

        drain_bulk_batch(str(batch.id))

        # Second tick max_in_flight=25//10=2 -> 2 chunks of 10 enqueued.
        new_jobs = ScrapeJob.objects.filter(
            batch=batch, status=ScrapeJob.Status.PENDING,
        ).count()
        assert new_jobs == 2


# ---------------------------------------------------------------------------
# D.26 — global pool shared across batches
# ---------------------------------------------------------------------------


class TestDrainerGlobalPoolShared:
    @patch('scraper_app.tasks.django_rq')
    def test_two_batches_share_global_inflight(self, mock_django_rq):
        _set_cfg(concurrent_requests=50, batch_size=10)
        batch_a = _seed_batch(20)
        batch_b = _seed_batch(20)

        # Pre-fill 5 in-flight from batch A.
        for i in range(5):
            ScrapeJob.objects.create(
                mode=ScrapeJob.Mode.BATCH_ASIN,
                marketplace='amazon_com',
                status=ScrapeJob.Status.PENDING,
                asin_list=[f'B0AAA{i:05d}'],
                batch=batch_a,
            )

        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        default_q = MagicMock()
        mock_django_rq.get_queue.side_effect = lambda n: scraper_q if n == 'scraper' else default_q

        # Drainer for B sees 5 pre-existing in-flight -> 0 free slots.
        drain_bulk_batch(str(batch_b.id))

        scraper_q.enqueue.assert_not_called()
        # Batch B did not create any new BATCH_ASIN jobs.
        assert ScrapeJob.objects.filter(batch=batch_b).count() == 0


# ---------------------------------------------------------------------------
# D.27 / EC-13 — concurrent_requests=0 acts as soft pause
# ---------------------------------------------------------------------------


class TestDrainerSoftPause:
    @patch('scraper_app.tasks.django_rq')
    def test_concurrent_requests_zero_enqueues_nothing(self, mock_django_rq):
        _set_cfg(concurrent_requests=0, batch_size=10)
        batch = _seed_batch(20)

        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        default_q = MagicMock()
        mock_django_rq.get_queue.side_effect = lambda n: scraper_q if n == 'scraper' else default_q

        drain_bulk_batch(str(batch.id))

        scraper_q.enqueue.assert_not_called()
        # Batch must remain RUNNING — soft pause only stops enqueues.
        batch.refresh_from_db()
        assert batch.status == BulkScrapeBatch.Status.RUNNING
        # Drainer still re-schedules itself so admin can lift the pause.
        default_q.enqueue_in.assert_called()


# ---------------------------------------------------------------------------
# D.28 — drainer skips skipped_fresh targets
# ---------------------------------------------------------------------------


class TestDrainerSkipsFresh:
    def test_skipped_fresh_targets_not_picked(self):
        _set_cfg()
        batch = _seed_batch(0)  # no auto-targets
        tier = _oneshot()
        # Mix: one normal, one skipped_fresh.
        ScheduledScrapeTarget.objects.create(
            asin='B0NORMAL001',
            marketplace='amazon_com',
            tier=tier,
            tier_override=True,
            active=False,
            batch=batch,
            next_scrape_at=timezone.now(),
        )
        ScheduledScrapeTarget.objects.create(
            asin='B0FRESH0001',
            marketplace='amazon_com',
            tier=tier,
            tier_override=True,
            active=False,
            batch=batch,
            next_scrape_at=timezone.now(),
            last_error='skipped_fresh',
        )

        picks = _pick_next_targets(batch, 10)
        asins = [t[1] for t in picks]
        assert 'B0NORMAL001' in asins
        assert 'B0FRESH0001' not in asins


# ---------------------------------------------------------------------------
# Helper coverage
# ---------------------------------------------------------------------------


class TestRefreshCounts:
    def test_counts_categorize_correctly(self):
        _set_cfg(max_retries=2)
        batch = _seed_batch(0)
        tier = _oneshot()
        # 1 pending, 1 running, 1 done, 1 done-skipped, 1 failed
        ScheduledScrapeTarget.objects.create(
            asin='B0PEND00001', marketplace='amazon_com', tier=tier, batch=batch,
            active=False, next_scrape_at=timezone.now(),
        )
        ScheduledScrapeTarget.objects.create(
            asin='B0RUN0000001', marketplace='amazon_com', tier=tier, batch=batch,
            active=True, next_scrape_at=timezone.now(),
        )
        ScheduledScrapeTarget.objects.create(
            asin='B0DONE000001', marketplace='amazon_com', tier=tier, batch=batch,
            active=False, next_scrape_at=timezone.now(),
            last_scraped_at=timezone.now(),
        )
        ScheduledScrapeTarget.objects.create(
            asin='B0SKIP000001', marketplace='amazon_com', tier=tier, batch=batch,
            active=False, next_scrape_at=timezone.now(),
            last_scraped_at=timezone.now(), last_error='skipped_fresh',
        )
        ScheduledScrapeTarget.objects.create(
            asin='B0FAIL000001', marketplace='amazon_com', tier=tier, batch=batch,
            active=False, next_scrape_at=timezone.now(),
            last_error='HTTP 503', retry_count=2,
        )

        _refresh_batch_counts(batch)
        batch.refresh_from_db()
        assert batch.pending_count == 1
        assert batch.running_count == 1
        assert batch.done_count == 2  # done_real + done_skipped
        assert batch.failed_count == 1


class TestBulkDrainerLock:
    def test_lock_acquired_and_released(self):
        acquired, release = _bulk_drainer_lock('test-lock-1')
        assert acquired is True
        assert callable(release)
        # Second acquire on same key should fail.
        acquired2, release2 = _bulk_drainer_lock('test-lock-1')
        assert acquired2 is False
        # Release the first; second can now acquire.
        release()
        acquired3, release3 = _bulk_drainer_lock('test-lock-1')
        assert acquired3 is True
        release3()
