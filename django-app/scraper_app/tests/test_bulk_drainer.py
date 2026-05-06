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
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

        drain_bulk_batch(str(batch.id))

        assert scraper_q.enqueue.call_count == 3
        jobs = ScrapeJob.objects.filter(batch=batch)
        assert jobs.count() == 3
        sizes = sorted(len(j.asin_list) for j in jobs)
        assert sizes == [5, 10, 10]
        # Drainer should have re-scheduled itself (work remains in flight).
        assert sched.enqueue_in.called


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
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

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
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

        drain_bulk_batch(str(batch.id))

        scraper_q.enqueue.assert_not_called()
        sched.enqueue_in.assert_not_called()


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
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

        drain_bulk_batch(str(batch.id))

        batch.refresh_from_db()
        assert batch.status == BulkScrapeBatch.Status.COMPLETED
        assert batch.finished_at is not None
        sched.enqueue_in.assert_not_called()


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
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

        drain_bulk_batch(str(batch.id))

        scraper_q.enqueue.assert_not_called()
        sched.enqueue_in.assert_not_called()
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
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

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
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

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
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

        drain_bulk_batch(str(batch.id))

        scraper_q.enqueue.assert_not_called()
        # Batch must remain RUNNING — soft pause only stops enqueues.
        batch.refresh_from_db()
        assert batch.status == BulkScrapeBatch.Status.RUNNING
        # Drainer still re-schedules itself so admin can lift the pause.
        sched.enqueue_in.assert_called()


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


# ---------------------------------------------------------------------------
# EC-4 (post-QA gap fix) — mid-run batch_size change
# ---------------------------------------------------------------------------


class TestDrainerBatchSizeMidRunChange:
    """EC-4: changing cfg.batch_size mid-run does not break already-enqueued
    ScrapeJobs (they keep their original asin_list size); newly created jobs
    use the new batch_size.
    """

    @patch('scraper_app.tasks.django_rq')
    def test_old_jobs_keep_size_new_jobs_use_new_size(self, mock_django_rq):
        _set_cfg(concurrent_requests=50, batch_size=10)
        batch = _seed_batch(20)

        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        scraper_q.enqueue.return_value = MagicMock(id='rq-batchsize-1')
        default_q = MagicMock()
        mock_django_rq.get_queue.side_effect = lambda n: scraper_q if n == 'scraper' else default_q
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

        # First tick: batch_size=10. Drainer enqueues 2 jobs of 10 ASINs each.
        drain_bulk_batch(str(batch.id))
        first_tick_jobs = list(ScrapeJob.objects.filter(batch=batch).order_by('id'))
        assert len(first_tick_jobs) == 2
        assert all(len(j.asin_list) == 10 for j in first_tick_jobs)

        # Mid-run: shrink batch_size 10 -> 5. Mark first-tick jobs as completed
        # to free slots, and reset target.active=False on a fresh subset to
        # simulate "more pending work to enqueue".
        ScrapeJob.objects.filter(batch=batch).update(status=ScrapeJob.Status.COMPLETED)
        cfg = ScraperConfig.load()
        cfg.batch_size = 5
        cfg.save()

        # Add 10 more pending targets so drainer has work for new size.
        tier = _oneshot()
        for i in range(20, 30):
            ScheduledScrapeTarget.objects.create(
                asin=f'B0DRA{i:05d}',
                marketplace='amazon_com',
                tier=tier,
                tier_override=True,
                active=False,
                batch=batch,
                next_scrape_at=timezone.now(),
            )

        # Second tick: batch_size=5. Drainer enqueues 10 jobs of 5 ASINs each
        # (max_in_flight = 50 // 5 = 10).
        drain_bulk_batch(str(batch.id))
        new_jobs = list(ScrapeJob.objects.filter(
            batch=batch, status=ScrapeJob.Status.PENDING,
        ).order_by('id'))
        assert len(new_jobs) >= 1
        assert all(len(j.asin_list) == 5 for j in new_jobs)

        # First-tick jobs still have asin_list size 10 (unchanged).
        first_tick_after = ScrapeJob.objects.filter(
            id__in=[j.id for j in first_tick_jobs]
        )
        assert all(len(j.asin_list) == 10 for j in first_tick_after)


# ---------------------------------------------------------------------------
# EC-14 (post-QA gap fix) — replicas=0 stalled-queue WARNING log
# ---------------------------------------------------------------------------


class TestDrainerStalledQueueWarning:
    """EC-14: when scraper queue has 0 workers (e.g. BACKEND_SCRAPER_WORKERS=0),
    drainer logs a WARNING per tick but keeps running (re-enqueues itself) so
    the operator can recover by scaling replicas up without losing the batch.
    """

    @patch('scraper_app.tasks.django_rq')
    @patch('rq.Worker')
    def test_warning_logged_when_no_workers(self, mock_worker_cls, mock_django_rq, caplog):
        import logging
        _set_cfg(concurrent_requests=50, batch_size=10)
        batch = _seed_batch(10)

        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        default_q = MagicMock()
        scraper_q.enqueue.return_value = MagicMock(id='rq-x')
        mock_django_rq.get_queue.side_effect = lambda n: scraper_q if n == 'scraper' else default_q
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

        # No workers alive on scraper queue.
        mock_worker_cls.all.return_value = []

        with caplog.at_level(logging.WARNING, logger='scraper_app.tasks'):
            drain_bulk_batch(str(batch.id))

        # WARNING about stalled scraper queue must appear.
        msgs = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
        assert any('scraper queue has no workers' in m for m in msgs), msgs

        # Drainer must still self-reschedule (does not give up).
        assert sched.enqueue_in.called


# ---------------------------------------------------------------------------
# Smoke-found regression: drainer must NOT re-pick successfully scraped
# targets. Before the 2026-05-05 fix, _pick_next_targets matched
# `active=False AND last_error IS NULL AND retry_count < max` — which also
# matched done targets (last_scraped_at SET). Drainer re-enqueued every tick.
# Fix: also require last_scraped_at IS NULL.
# ---------------------------------------------------------------------------


class TestDrainerDoesNotRePickDoneTargets:
    """Regression: targets with last_scraped_at SET must never be re-picked."""

    def test_done_targets_are_skipped(self):
        from scraper_app.tasks import _pick_next_targets

        _set_cfg(concurrent_requests=50, batch_size=10, max_retries=1)
        batch = _seed_batch(3)
        targets = list(ScheduledScrapeTarget.objects.filter(batch=batch).order_by('asin'))

        # Mark the first 2 as successfully scraped (active=False,
        # last_error=None, last_scraped_at SET).
        ScheduledScrapeTarget.objects.filter(id__in=[t.id for t in targets[:2]]).update(
            active=False,
            last_error=None,
            last_scraped_at=timezone.now(),
        )

        picks = _pick_next_targets(batch, count=100)

        # Only the third target (still pristine) is picked.
        assert len(picks) == 1
        picked_id, picked_asin = picks[0]
        assert picked_id == targets[2].id


# ---------------------------------------------------------------------------
# EC-16 mid-deploy resilience — orphan target + zombie ScrapeJob recovery
# ---------------------------------------------------------------------------


class TestDrainerOrphanRecovery:
    """When 5 worker-scraper containers SIGKILL together (deploy mid-run), the
    in-flight ScrapeJobs freeze at status=RUNNING and their targets stay
    active=True. The drainer's pick filter requires active=False → orphan
    targets stuck forever. This test pins that the next drainer tick recovers
    both: marks zombie ScrapeJobs FAILED and resets target.active=False.
    """

    def test_reset_orphan_state_recovers_zombie_jobs_and_orphan_targets(self):
        """Direct unit test of the helper."""
        from scraper_app.tasks import (
            ZOMBIE_SCRAPEJOB_TIMEOUT_SECONDS,
            _reset_orphan_state,
        )

        _set_cfg()
        batch = _seed_batch(2)
        target_a, target_b = list(batch.targets.order_by('asin'))

        # Simulate orphan: drainer marked active, ScrapeJob frozen at RUNNING
        # with started_at older than ZOMBIE_TIMEOUT.
        target_a.active = True
        target_a.save()
        zombie = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.BATCH_ASIN,
            batch=batch,
            marketplace='amazon_com',
            status=ScrapeJob.Status.RUNNING,
            asin_list=[target_a.asin],
            started_at=timezone.now() - timedelta(
                seconds=ZOMBIE_SCRAPEJOB_TIMEOUT_SECONDS + 60,
            ),
        )

        # Healthy in-flight scenario for target_b: should NOT be reset.
        target_b.active = True
        target_b.save()
        live_job = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.BATCH_ASIN,
            batch=batch,
            marketplace='amazon_com',
            status=ScrapeJob.Status.RUNNING,
            asin_list=[target_b.asin],
            started_at=timezone.now() - timedelta(seconds=10),  # fresh
        )

        n_zombies, n_orphans = _reset_orphan_state(batch)

        assert n_zombies == 1
        assert n_orphans == 1

        target_a.refresh_from_db()
        # Orphan recovery is now TERMINAL: target marked inactive AND poisoned
        # with last_error so the drainer's pick filter excludes it next tick.
        assert target_a.active is False
        assert target_a.retry_count == 1
        assert target_a.last_error == 'orphan_recovered'
        target_b.refresh_from_db()
        assert target_b.active is True  # untouched (covered by live job)
        assert target_b.last_error is None
        assert target_b.retry_count == 0

        zombie.refresh_from_db()
        assert zombie.status == ScrapeJob.Status.FAILED
        assert 'zombie killed' in (zombie.error_log or '')

        live_job.refresh_from_db()
        assert live_job.status == ScrapeJob.Status.RUNNING  # untouched

    def test_reset_orphan_state_no_op_when_healthy(self):
        """Healthy state → no zombies, no orphans, no audit event."""
        from scraper_app.tasks import _reset_orphan_state

        _set_cfg()
        batch = _seed_batch(3)  # all targets active=False, no ScrapeJobs

        n_zombies, n_orphans = _reset_orphan_state(batch)

        assert (n_zombies, n_orphans) == (0, 0)
        # No audit-trail entry written
        assert not any(
            (e or {}).get('event') == 'orphan_recovery'
            for e in (batch.errors or [])
        )

    @patch('scraper_app.tasks.django_rq')
    def test_drainer_calls_reset_orphan_state_each_tick(self, mock_django_rq):
        """drain_bulk_batch invokes _reset_orphan_state before its main work."""
        _set_cfg()
        batch = _seed_batch(1)

        fake_conn = MagicMock()
        fake_conn.set.return_value = True
        mock_django_rq.get_connection.return_value = fake_conn
        scraper_q = MagicMock()
        scraper_q.enqueue.return_value = MagicMock(id='rq-orphan-test')
        default_q = MagicMock()
        mock_django_rq.get_queue.side_effect = (
            lambda n: scraper_q if n == 'scraper' else default_q
        )
        sched = MagicMock()
        mock_django_rq.get_scheduler.return_value = sched

        with patch('scraper_app.tasks._reset_orphan_state') as mock_reset:
            mock_reset.return_value = (0, 0)
            drain_bulk_batch(str(batch.id))
            assert mock_reset.called

    def test_orphan_recovery_marks_targets_terminal_after_completed_job(self):
        """Wrapper edge case: ScrapeJob is COMPLETED but its targets were never
        updated (Scrapy 5xx retry-exhausted yields neither item nor errback).
        Recovery must be TERMINAL — set active=False, bump retry_count,
        poison last_error — so the drainer doesn't re-pick the same ASINs
        every tick (cosmetic log-spam + ScraperOps budget burn).
        """
        from scraper_app.tasks import _reset_orphan_state

        _set_cfg()
        batch = _seed_batch(10)

        # Mark all 10 targets active=True (drainer enqueued them) but
        # last_scraped_at=NULL, retry_count=0, last_error=None — pristine
        # orphan state matching the prod evidence.
        targets = list(batch.targets.order_by('asin'))
        for t in targets:
            t.active = True
            t.retry_count = 0
            t.last_error = None
            t.last_scraped_at = None
            t.save()

        # Simulate the wrapper edge case: ScrapeJob exists but is COMPLETED,
        # so its asins are NOT in live_asins (only PENDING/RUNNING count).
        ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.BATCH_ASIN,
            batch=batch,
            marketplace='amazon_com',
            status=ScrapeJob.Status.COMPLETED,
            asin_list=[t.asin for t in targets],
            started_at=timezone.now() - timedelta(seconds=60),
            finished_at=timezone.now() - timedelta(seconds=10),
        )

        n_zombies, n_orphans = _reset_orphan_state(batch)

        assert n_zombies == 0
        assert n_orphans == 10

        for t in targets:
            t.refresh_from_db()
            assert t.active is False
            assert t.retry_count == 1
            assert t.last_error == 'orphan_recovered'

    def test_pick_next_targets_returns_empty_after_orphan_recovery(self):
        """Critical behavior change: after orphan recovery, the drainer's
        `_pick_next_targets` must return empty for those targets — otherwise
        the recovery loop is non-terminal and re-picks them every tick.
        """
        from scraper_app.tasks import _reset_orphan_state

        _set_cfg(max_retries=1)
        batch = _seed_batch(10)

        # Same setup as above: 10 active orphan targets, COMPLETED ScrapeJob.
        targets = list(batch.targets.order_by('asin'))
        for t in targets:
            t.active = True
            t.retry_count = 0
            t.last_error = None
            t.last_scraped_at = None
            t.save()
        ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.BATCH_ASIN,
            batch=batch,
            marketplace='amazon_com',
            status=ScrapeJob.Status.COMPLETED,
            asin_list=[t.asin for t in targets],
            started_at=timezone.now() - timedelta(seconds=60),
            finished_at=timezone.now() - timedelta(seconds=10),
        )

        # First recovery cycle — should mark all 10 terminal.
        _, n_orphans = _reset_orphan_state(batch)
        assert n_orphans == 10

        # Drainer's next pick MUST exclude them (last_error is set, so the
        # `last_error__isnull=True` filter skips them).
        picks = _pick_next_targets(batch, count=10)
        assert picks == []

        # Sanity: a second recovery tick should also produce 0 orphans
        # (active=False already, so the filter `active=True` excludes them).
        _, n_orphans_second = _reset_orphan_state(batch)
        assert n_orphans_second == 0
