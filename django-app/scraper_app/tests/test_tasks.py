import os
import pytest
from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.conf import settings
from django.utils import timezone

from scraper_app.models import (
    AmazonProduct,
    Keyword,
    ProductSearchCache,
    ScheduledScrapeTarget,
    ScrapeJob,
)
from scraper_app.tasks import (
    SCRAPY_PROJECT_DIR,
    _scrapy_env,
    cancel_scrape_job,
    schedule_scrape_runner,
    scrape_asin_detail_job,
    scrape_keyword_job,
)

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_keyword(keyword='funny cats', marketplace='amazon_com'):
    return Keyword.objects.create(keyword=keyword, marketplace=marketplace)


def _make_scrape_job(keyword=None, asin='', marketplace='amazon_com', **overrides):
    defaults = {
        'mode': ScrapeJob.Mode.LIVE,
        'keyword': keyword,
        'asin': asin,
        'marketplace': marketplace,
        'status': ScrapeJob.Status.PENDING,
    }
    defaults.update(overrides)
    return ScrapeJob.objects.create(**defaults)


def _mock_popen(returncode=0, stdout=b'', stderr=b''):
    """Return a configured MagicMock that behaves like subprocess.Popen."""
    mock_proc = MagicMock()
    mock_proc.pid = 12345
    mock_proc.communicate.return_value = (stdout, stderr)
    mock_proc.returncode = returncode
    return mock_proc


# ---------------------------------------------------------------------------
# _scrapy_env helper
# ---------------------------------------------------------------------------

class TestScrapyEnv:
    def test_sets_scrapy_settings_module(self):
        """Env dict includes SCRAPY_SETTINGS_MODULE."""
        env = _scrapy_env()
        assert env['SCRAPY_SETTINGS_MODULE'] == 'scraper_app.scrapy_app.settings'

    def test_sets_pythonpath_to_django_root(self):
        """PYTHONPATH starts with SCRAPY_PROJECT_DIR (Django BASE_DIR)."""
        env = _scrapy_env()
        assert env['PYTHONPATH'].startswith(SCRAPY_PROJECT_DIR)

    def test_preserves_existing_pythonpath(self):
        """If PYTHONPATH already set, it is appended after the Django root."""
        with patch.dict(os.environ, {'PYTHONPATH': '/some/other/path'}):
            env = _scrapy_env()
            assert env['PYTHONPATH'] == f"{SCRAPY_PROJECT_DIR}:/some/other/path"

    def test_scrapy_project_dir_is_base_dir(self):
        """SCRAPY_PROJECT_DIR matches Django settings.BASE_DIR."""
        assert SCRAPY_PROJECT_DIR == str(settings.BASE_DIR)


# ---------------------------------------------------------------------------
# scrape_keyword_job
# ---------------------------------------------------------------------------

class TestScrapeKeywordJob:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_sets_status_running(self, mock_popen_cls):
        """Job transitions to running and stores PID."""
        mock_proc = _mock_popen(returncode=0)
        mock_popen_cls.return_value = mock_proc

        kw = _make_keyword()
        job = _make_scrape_job(keyword=kw)

        # Simulate pipeline writing products during subprocess run
        def simulate_scrape(*args, **kwargs):
            ScrapeJob.objects.filter(id=job.id).update(products_scraped=5)
            return (b'', b'')
        mock_proc.communicate.side_effect = simulate_scrape

        scrape_keyword_job(kw.keyword, 'amazon_com', scrape_job_id=str(job.id))

        job.refresh_from_db()
        assert job.started_at is not None
        # After completion, status should be completed (went through running)
        assert job.status == ScrapeJob.Status.COMPLETED

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_success_clears_pid(self, mock_popen_cls):
        """On returncode=0, PID is cleared and status is completed."""
        mock_proc = _mock_popen(returncode=0)
        mock_popen_cls.return_value = mock_proc

        kw = _make_keyword()
        job = _make_scrape_job(keyword=kw)

        # Simulate pipeline writing products during subprocess run
        def simulate_scrape(*args, **kwargs):
            ScrapeJob.objects.filter(id=job.id).update(products_scraped=5)
            return (b'', b'')
        mock_proc.communicate.side_effect = simulate_scrape

        scrape_keyword_job(kw.keyword, 'amazon_com', scrape_job_id=str(job.id))

        job.refresh_from_db()
        assert job.pid is None
        assert job.status == ScrapeJob.Status.COMPLETED
        assert job.finished_at is not None

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_failure_stores_stderr(self, mock_popen_cls):
        """On returncode=1, status=failed and error_log contains stderr."""
        mock_popen_cls.return_value = _mock_popen(
            returncode=1, stderr=b'Spider crashed: selector timeout',
        )

        kw = _make_keyword()
        job = _make_scrape_job(keyword=kw)

        scrape_keyword_job(kw.keyword, 'amazon_com', scrape_job_id=str(job.id))

        job.refresh_from_db()
        assert job.status == ScrapeJob.Status.FAILED
        assert 'selector timeout' in job.error_log
        assert job.pid is None

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_success_updates_product_search_cache(self, mock_popen_cls):
        """On success, linked ProductSearchCache is marked completed."""
        mock_proc = _mock_popen(returncode=0)
        mock_popen_cls.return_value = mock_proc

        kw = _make_keyword()
        job = _make_scrape_job(keyword=kw)
        cache = ProductSearchCache.objects.create(
            keyword=kw, scrape_job=job, status=ProductSearchCache.Status.PENDING,
        )

        # Simulate pipeline writing products during subprocess run
        def simulate_scrape(*args, **kwargs):
            ScrapeJob.objects.filter(id=job.id).update(products_scraped=5)
            return (b'', b'')
        mock_proc.communicate.side_effect = simulate_scrape

        scrape_keyword_job(kw.keyword, 'amazon_com', scrape_job_id=str(job.id))

        cache.refresh_from_db()
        assert cache.status == ProductSearchCache.Status.COMPLETED

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_failure_updates_product_search_cache(self, mock_popen_cls):
        """On failure, linked ProductSearchCache is marked failed."""
        mock_popen_cls.return_value = _mock_popen(returncode=1, stderr=b'error')

        kw = _make_keyword()
        job = _make_scrape_job(keyword=kw)
        cache = ProductSearchCache.objects.create(
            keyword=kw, scrape_job=job, status=ProductSearchCache.Status.PENDING,
        )

        scrape_keyword_job(kw.keyword, 'amazon_com', scrape_job_id=str(job.id))

        cache.refresh_from_db()
        assert cache.status == ProductSearchCache.Status.FAILED

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_scrape_job_id_none_no_crash(self, mock_popen_cls):
        """When scrape_job_id is None (default), job runs without DB tracking."""
        mock_popen_cls.return_value = _mock_popen(returncode=0)

        # Should not raise — no ScrapeJob lookup attempted
        scrape_keyword_job('funny cats', 'amazon_com', scrape_job_id=None)

        # Popen was still called
        mock_popen_cls.assert_called_once()

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_popen_uses_scrapy_env_and_cwd(self, mock_popen_cls):
        """Subprocess is launched with _scrapy_env() and SCRAPY_PROJECT_DIR as cwd."""
        mock_popen_cls.return_value = _mock_popen(returncode=0)

        scrape_keyword_job('test', 'amazon_com')

        call_kwargs = mock_popen_cls.call_args
        assert call_kwargs.kwargs['cwd'] == SCRAPY_PROJECT_DIR
        env = call_kwargs.kwargs['env']
        assert env['SCRAPY_SETTINGS_MODULE'] == 'scraper_app.scrapy_app.settings'
        assert SCRAPY_PROJECT_DIR in env['PYTHONPATH']

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_passes_spider_kwargs(self, mock_popen_cls):
        """Extra spider_kwargs are forwarded as -a flags to scrapy crawl."""
        mock_popen_cls.return_value = _mock_popen(returncode=0)

        scrape_keyword_job('test', 'amazon_com', max_pages=3)

        cmd = mock_popen_cls.call_args.args[0]
        assert '-a' in cmd
        assert 'max_pages=3' in cmd

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_max_items_adds_closespider_setting(self, mock_popen_cls):
        """max_items is popped from spider_kwargs and passed as -s CLOSESPIDER_ITEMCOUNT=N."""
        mock_popen_cls.return_value = _mock_popen(returncode=0)

        scrape_keyword_job('test', 'amazon_com', max_items=25)

        cmd = mock_popen_cls.call_args.args[0]
        assert '-s' in cmd
        idx = cmd.index('-s')
        assert cmd[idx + 1] == 'CLOSESPIDER_ITEMCOUNT=25'

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_max_items_none_no_closespider(self, mock_popen_cls):
        """max_items=None does not add CLOSESPIDER_ITEMCOUNT to cmd."""
        mock_popen_cls.return_value = _mock_popen(returncode=0)

        scrape_keyword_job('test', 'amazon_com', max_items=None)

        cmd = mock_popen_cls.call_args.args[0]
        assert 'CLOSESPIDER_ITEMCOUNT' not in ' '.join(str(c) for c in cmd)

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_nonexistent_job_id_returns_early(self, mock_popen_cls):
        """If scrape_job_id points to a missing ScrapeJob, return without running."""
        scrape_keyword_job('test', 'amazon_com', scrape_job_id='00000000-0000-0000-0000-000000000000')

        mock_popen_cls.assert_not_called()


# ---------------------------------------------------------------------------
# scrape_asin_detail_job
# ---------------------------------------------------------------------------

class TestScrapeAsinDetailJob:
    @patch('scraper_app.tasks.subprocess.Popen')
    def test_updates_target_timestamps(self, mock_popen_cls, scrape_tiers):
        """On success, ScheduledScrapeTarget.last_scraped_at updated, next_scrape_at recalculated."""
        mock_popen_cls.return_value = _mock_popen(returncode=0)
        tier1, _, _ = scrape_tiers

        asin = 'B0TEST12345'
        marketplace = 'amazon_com'

        # Create product with BSR in Tier 1 range
        AmazonProduct.objects.create(
            asin=asin, marketplace=marketplace, bsr=1000,
        )

        target = ScheduledScrapeTarget.objects.create(
            asin=asin, marketplace=marketplace, tier=tier1,
            next_scrape_at=timezone.now() - timedelta(hours=1),
        )
        job = _make_scrape_job(
            asin=asin, mode=ScrapeJob.Mode.SCHEDULED,
        )

        scrape_asin_detail_job(asin, marketplace, scrape_job_id=str(job.id))

        target.refresh_from_db()
        assert target.last_scraped_at is not None
        expected_next = target.last_scraped_at + timedelta(days=tier1.interval_days)
        # Allow 1 second tolerance
        assert abs((target.next_scrape_at - expected_next).total_seconds()) < 1

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_failure_sets_failed_status(self, mock_popen_cls):
        """On subprocess failure, job marked as failed."""
        mock_popen_cls.return_value = _mock_popen(returncode=1, stderr=b'connection error')

        job = _make_scrape_job(asin='B0FAIL00001', mode=ScrapeJob.Mode.SCHEDULED)

        scrape_asin_detail_job('B0FAIL00001', 'amazon_com', scrape_job_id=str(job.id))

        job.refresh_from_db()
        assert job.status == ScrapeJob.Status.FAILED
        assert 'connection error' in job.error_log

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_scrape_job_id_none_no_crash(self, mock_popen_cls):
        """When scrape_job_id is None (default), job runs without DB tracking."""
        mock_popen_cls.return_value = _mock_popen(returncode=0)

        scrape_asin_detail_job('B0TEST12345', 'amazon_com', scrape_job_id=None)

        mock_popen_cls.assert_called_once()

    @patch('scraper_app.tasks.subprocess.Popen')
    def test_nonexistent_job_id_returns_early(self, mock_popen_cls):
        """If scrape_job_id points to a missing ScrapeJob, return without running."""
        scrape_asin_detail_job('B0TEST12345', 'amazon_com', scrape_job_id='00000000-0000-0000-0000-000000000000')

        mock_popen_cls.assert_not_called()


# ---------------------------------------------------------------------------
# cancel_scrape_job
# ---------------------------------------------------------------------------

class TestCancelScrapeJob:
    @patch('scraper_app.tasks.os.kill')
    def test_cancel_running_job(self, mock_kill):
        """Running job with PID: sends SIGTERM, sets cancelled, clears PID."""
        import signal

        job = _make_scrape_job(
            status=ScrapeJob.Status.RUNNING, pid=12345,
        )

        cancel_scrape_job(job.id, 'admin')

        job.refresh_from_db()
        assert job.status == ScrapeJob.Status.CANCELLED
        assert job.pid is None
        assert job.cancelled_by == 'admin'
        mock_kill.assert_called_once_with(12345, signal.SIGTERM)

    @patch('scraper_app.tasks.django_rq')
    def test_cancel_pending_job(self, mock_django_rq):
        """Pending job: removed from RQ queue, status=cancelled."""
        mock_queue = MagicMock()
        mock_django_rq.get_queue.return_value = mock_queue

        job = _make_scrape_job(
            status=ScrapeJob.Status.PENDING, rq_job_id='test-rq-123',
        )

        cancel_scrape_job(job.id, 'admin')

        job.refresh_from_db()
        assert job.status == ScrapeJob.Status.CANCELLED
        mock_django_rq.get_queue.assert_called_once_with('default')
        mock_queue.remove.assert_called_once_with('test-rq-123')

    def test_cancel_job_updates_cache(self):
        """Cancelling a job marks linked ProductSearchCache as failed."""
        kw = _make_keyword()
        job = _make_scrape_job(
            keyword=kw, status=ScrapeJob.Status.RUNNING, pid=99999,
        )
        cache = ProductSearchCache.objects.create(
            keyword=kw, scrape_job=job, status=ProductSearchCache.Status.PENDING,
        )

        with patch('scraper_app.tasks.os.kill'):
            cancel_scrape_job(job.id, 'user')

        cache.refresh_from_db()
        assert cache.status == ProductSearchCache.Status.FAILED


# ---------------------------------------------------------------------------
# schedule_scrape_runner
# ---------------------------------------------------------------------------

class TestScheduleScrapeRunner:
    @patch('scraper_app.tasks.django_rq')
    def test_finds_due_targets_only(self, mock_django_rq, scrape_tiers):
        """Only targets with next_scrape_at in the past are enqueued."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-123'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_django_rq.get_queue.return_value = mock_queue

        tier1, _, _ = scrape_tiers
        now = timezone.now()

        # Due target (past)
        ScheduledScrapeTarget.objects.create(
            asin='B0DUE000001', marketplace='amazon_com', tier=tier1,
            next_scrape_at=now - timedelta(hours=2), active=True,
        )
        # Future target (not due)
        ScheduledScrapeTarget.objects.create(
            asin='B0FUT000001', marketplace='amazon_com', tier=tier1,
            next_scrape_at=now + timedelta(hours=2), active=True,
        )

        count = schedule_scrape_runner()

        assert count == 1
        assert mock_queue.enqueue.call_count == 1

    @patch('scraper_app.tasks.django_rq')
    def test_skips_inactive_targets(self, mock_django_rq, scrape_tiers):
        """Inactive targets are not enqueued even if due."""
        mock_queue = MagicMock()
        mock_django_rq.get_queue.return_value = mock_queue

        tier1, _, _ = scrape_tiers

        ScheduledScrapeTarget.objects.create(
            asin='B0INACT0001', marketplace='amazon_com', tier=tier1,
            next_scrape_at=timezone.now() - timedelta(hours=1),
            active=False,
        )

        count = schedule_scrape_runner()

        assert count == 0
        mock_queue.enqueue.assert_not_called()

    @patch('scraper_app.tasks.django_rq')
    def test_keyword_vs_asin_dispatching(self, mock_django_rq, scrape_tiers):
        """Keyword targets call scrape_keyword_job, ASIN targets call scrape_asin_detail_job."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-456'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_django_rq.get_queue.return_value = mock_queue

        tier1, _, _ = scrape_tiers
        now = timezone.now()
        kw = _make_keyword('dog shirts')

        # Keyword target
        ScheduledScrapeTarget.objects.create(
            keyword=kw, marketplace='amazon_com', tier=tier1,
            next_scrape_at=now - timedelta(hours=1), active=True,
        )
        # ASIN target
        ScheduledScrapeTarget.objects.create(
            asin='B0ASIN00001', marketplace='amazon_com', tier=tier1,
            next_scrape_at=now - timedelta(hours=1), active=True,
        )

        count = schedule_scrape_runner()

        assert count == 2
        assert mock_queue.enqueue.call_count == 2

        # Verify correct job function dispatched for each
        call_args_list = mock_queue.enqueue.call_args_list
        dispatched_funcs = {call.args[0].__name__ for call in call_args_list}
        assert dispatched_funcs == {'scrape_keyword_job', 'scrape_asin_detail_job'}

    @patch('scraper_app.tasks.django_rq')
    def test_enqueue_uses_scrape_job_id_kwarg(self, mock_django_rq, scrape_tiers):
        """Enqueue calls use scrape_job_id= (not job_id=) as the keyword argument."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-789'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_django_rq.get_queue.return_value = mock_queue

        tier1, _, _ = scrape_tiers

        ScheduledScrapeTarget.objects.create(
            asin='B0KWARG0001', marketplace='amazon_com', tier=tier1,
            next_scrape_at=timezone.now() - timedelta(hours=1), active=True,
        )

        schedule_scrape_runner()

        call_kwargs = mock_queue.enqueue.call_args.kwargs
        assert 'scrape_job_id' in call_kwargs
        assert 'job_id' not in call_kwargs
