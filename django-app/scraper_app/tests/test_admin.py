import io

import pytest
from unittest.mock import MagicMock, patch

from django.urls import reverse

from scraper_app.models import (
    Keyword,
    ScheduledScrapeTarget,
    ScrapeJob,
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


# ---------------------------------------------------------------------------
# ASIN CSV Upload
# ---------------------------------------------------------------------------

class TestAsinCsvUpload:
    UPLOAD_URL = '/admin/scraper_app/scheduledscrapetarget/upload-csv/asin/'

    def test_valid_csv_creates_targets(self, admin_client, scrape_tiers):
        # ASINs must be exactly 10 uppercase alphanumeric chars (regex ^[A-Z0-9]{10}$)
        csv_content = "asin,marketplace,tier\nB0TEST1234,amazon_com,Tier 1\nB0TEST6789,amazon_com,\n"
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'test_asins.csv'

        admin_client.post(self.UPLOAD_URL, {'csv_file': csv_file})

        assert ScheduledScrapeTarget.objects.count() == 2
        t1 = ScheduledScrapeTarget.objects.get(asin='B0TEST1234')
        assert t1.tier.name == 'Tier 1'
        assert t1.tier_override is True
        # Second target has no tier specified -> fallback tier assigned
        t2 = ScheduledScrapeTarget.objects.get(asin='B0TEST6789')
        assert t2.tier_override is False

    def test_duplicate_asin_updates_existing(self, admin_client, scrape_tiers):
        """Uploading the same ASIN twice results in 1 target (update_or_create)."""
        csv1 = "asin,marketplace\nB0DUPL0001,amazon_com\n"
        f1 = io.BytesIO(csv1.encode('utf-8'))
        f1.name = 'upload1.csv'
        admin_client.post(self.UPLOAD_URL, {'csv_file': f1})
        assert ScheduledScrapeTarget.objects.filter(asin='B0DUPL0001').count() == 1

        csv2 = "asin,marketplace\nB0DUPL0001,amazon_com\n"
        f2 = io.BytesIO(csv2.encode('utf-8'))
        f2.name = 'upload2.csv'
        admin_client.post(self.UPLOAD_URL, {'csv_file': f2})
        assert ScheduledScrapeTarget.objects.filter(asin='B0DUPL0001').count() == 1

    def test_missing_columns_shows_error(self, admin_client, scrape_tiers):
        """CSV without required 'asin' column yields 0 targets."""
        csv_content = "product_id,marketplace\nB0TEST1234,amazon_com\n"
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'bad.csv'

        response = admin_client.post(self.UPLOAD_URL, {'csv_file': csv_file}, follow=True)

        assert ScheduledScrapeTarget.objects.count() == 0
        content = response.content.decode()
        assert 'Missing columns' in content or 'asin' in content

    def test_invalid_asin_format_shows_error(self, admin_client, scrape_tiers):
        """ASIN not matching ^[A-Z0-9]{10}$ is rejected."""
        csv_content = "asin,marketplace\nINVALID,amazon_com\n"
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'bad_asin.csv'

        response = admin_client.post(self.UPLOAD_URL, {'csv_file': csv_file}, follow=True)

        assert ScheduledScrapeTarget.objects.count() == 0
        content = response.content.decode()
        assert 'invalid ASIN' in content


# ---------------------------------------------------------------------------
# Keyword CSV Upload
# ---------------------------------------------------------------------------

class TestKeywordCsvUpload:
    UPLOAD_URL = '/admin/scraper_app/scheduledscrapetarget/upload-csv/keyword/'

    def test_valid_csv_creates_targets_and_keywords(self, admin_client, scrape_tiers):
        csv_content = "keyword,marketplace,tier\nfunny dog shirts,amazon_com,Tier 2\ncat memes,amazon_de,\n"
        csv_file = io.BytesIO(csv_content.encode('utf-8'))
        csv_file.name = 'keywords.csv'

        admin_client.post(self.UPLOAD_URL, {'csv_file': csv_file})

        assert ScheduledScrapeTarget.objects.count() == 2
        assert Keyword.objects.count() == 2
        assert Keyword.objects.filter(keyword='funny dog shirts', marketplace='amazon_com').exists()


# ---------------------------------------------------------------------------
# ScrapeJob Admin Actions
# ---------------------------------------------------------------------------

class TestScrapeJobActions:
    @patch('scraper_app.tasks.cancel_scrape_job')
    def test_stop_action_on_running_job(self, mock_cancel, admin_client):
        """Stop action calls cancel_scrape_job for running jobs."""
        job = _make_scrape_job(status=ScrapeJob.Status.RUNNING, pid=12345)

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')
        admin_client.post(changelist_url, {
            'action': 'stop_running_jobs',
            '_selected_action': [str(job.id)],
        })

        mock_cancel.assert_called_once_with(job.id, 'admin')

    @patch('django_rq.get_queue')
    def test_retry_action_creates_new_job(self, mock_get_queue, admin_client):
        """Retry action creates a NEW ScrapeJob and enqueues it; original stays failed."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-retry-123'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_get_queue.return_value = mock_queue

        kw = _make_keyword('test keyword')
        failed_job = _make_scrape_job(keyword=kw, status=ScrapeJob.Status.FAILED)

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')
        admin_client.post(changelist_url, {
            'action': 'retry_failed_jobs',
            '_selected_action': [str(failed_job.id)],
        })

        mock_queue.enqueue.assert_called_once()
        # Verify scrape_job_id kwarg is used (not job_id)
        call_kwargs = mock_queue.enqueue.call_args.kwargs
        assert 'scrape_job_id' in call_kwargs

        # Original job remains failed
        failed_job.refresh_from_db()
        assert failed_job.status == ScrapeJob.Status.FAILED

        # A new pending job was created
        new_jobs = ScrapeJob.objects.filter(status=ScrapeJob.Status.PENDING, keyword=kw)
        assert new_jobs.count() == 1
        new_job = new_jobs.first()
        assert new_job.rq_job_id == 'rq-retry-123'

    @patch('django_rq.get_queue')
    def test_start_pending_jobs_action(self, mock_get_queue, admin_client):
        """Start action enqueues pending jobs via django-rq with scrape_job_id kwarg."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-start-456'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_get_queue.return_value = mock_queue

        kw = _make_keyword('start test')
        job = _make_scrape_job(keyword=kw, status=ScrapeJob.Status.PENDING)

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')
        admin_client.post(changelist_url, {
            'action': 'start_pending_jobs',
            '_selected_action': [str(job.id)],
        })

        mock_queue.enqueue.assert_called_once()
        call_kwargs = mock_queue.enqueue.call_args.kwargs
        assert 'scrape_job_id' in call_kwargs
        assert call_kwargs['scrape_job_id'] == str(job.id)

        job.refresh_from_db()
        assert job.rq_job_id == 'rq-start-456'

    @patch('django_rq.get_queue')
    def test_start_pending_jobs_skips_non_pending(self, mock_get_queue, admin_client):
        """Start action only processes jobs with status=PENDING."""
        mock_queue = MagicMock()
        mock_get_queue.return_value = mock_queue

        running_job = _make_scrape_job(
            asin='B0RUN00001', status=ScrapeJob.Status.RUNNING, pid=111,
        )

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')
        admin_client.post(changelist_url, {
            'action': 'start_pending_jobs',
            '_selected_action': [str(running_job.id)],
        })

        mock_queue.enqueue.assert_not_called()

    @patch('django_rq.get_queue')
    def test_start_pending_with_product_type_filter(self, mock_get_queue, admin_client):
        """Start action with product_type_filter='t_shirt' passes correct spider_kwargs."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-filter-001'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_get_queue.return_value = mock_queue

        kw = _make_keyword('test filter')
        job = _make_scrape_job(
            keyword=kw, status=ScrapeJob.Status.PENDING,
            product_type_filter='t_shirt',
        )

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')
        admin_client.post(changelist_url, {
            'action': 'start_pending_jobs',
            '_selected_action': [str(job.id)],
        })

        mock_queue.enqueue.assert_called_once()
        call_kwargs = mock_queue.enqueue.call_args.kwargs
        assert call_kwargs['search_index'] == 'fashion-novelty'
        assert call_kwargs['seller_filter'] == 'ATVPDKIKX0DER'
        assert 'hidden_keywords' in call_kwargs

    @patch('django_rq.get_queue')
    def test_start_pending_without_product_type_filter(self, mock_get_queue, admin_client):
        """Start action with empty product_type_filter passes no extra kwargs."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-nofilter-001'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_get_queue.return_value = mock_queue

        kw = _make_keyword('no filter test')
        job = _make_scrape_job(
            keyword=kw, status=ScrapeJob.Status.PENDING,
            product_type_filter='',
        )

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')
        admin_client.post(changelist_url, {
            'action': 'start_pending_jobs',
            '_selected_action': [str(job.id)],
        })

        mock_queue.enqueue.assert_called_once()
        call_kwargs = mock_queue.enqueue.call_args.kwargs
        assert 'search_index' not in call_kwargs
        assert 'seller_filter' not in call_kwargs
        assert 'hidden_keywords' not in call_kwargs

    @patch('django_rq.get_queue')
    def test_start_pending_passes_max_items(self, mock_get_queue, admin_client):
        """Start action passes max_items when set on the job."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-max-001'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_get_queue.return_value = mock_queue

        kw = _make_keyword('max items test')
        job = _make_scrape_job(
            keyword=kw, status=ScrapeJob.Status.PENDING,
            max_items=50,
        )

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')
        admin_client.post(changelist_url, {
            'action': 'start_pending_jobs',
            '_selected_action': [str(job.id)],
        })

        mock_queue.enqueue.assert_called_once()
        call_kwargs = mock_queue.enqueue.call_args.kwargs
        assert call_kwargs['max_items'] == 50

    @patch('django_rq.get_queue')
    def test_retry_copies_product_type_filter_and_max_items(self, mock_get_queue, admin_client):
        """Retry action copies product_type_filter and max_items to new job."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-retry-copy-001'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_get_queue.return_value = mock_queue

        kw = _make_keyword('retry copy test')
        failed_job = _make_scrape_job(
            keyword=kw,
            status=ScrapeJob.Status.FAILED,
            product_type_filter='hoodie',
            max_items=30,
        )

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')
        admin_client.post(changelist_url, {
            'action': 'retry_failed_jobs',
            '_selected_action': [str(failed_job.id)],
        })

        mock_queue.enqueue.assert_called_once()
        new_job = ScrapeJob.objects.filter(
            status=ScrapeJob.Status.PENDING, keyword=kw,
        ).first()
        assert new_job is not None
        assert new_job.product_type_filter == 'hoodie'
        assert new_job.max_items == 30

        # Verify spider_kwargs include hoodie filter
        call_kwargs = mock_queue.enqueue.call_args.kwargs
        assert call_kwargs['search_index'] == 'fashion-novelty'
        assert call_kwargs['max_items'] == 30

    @patch('django_rq.get_queue')
    def test_start_pending_asin_job(self, mock_get_queue, admin_client):
        """Start action dispatches scrape_asin_detail_job for ASIN-based jobs."""
        mock_queue = MagicMock()
        mock_rq_job = MagicMock()
        mock_rq_job.id = 'rq-asin-789'
        mock_queue.enqueue.return_value = mock_rq_job
        mock_get_queue.return_value = mock_queue

        job = _make_scrape_job(asin='B0ASIN0001', status=ScrapeJob.Status.PENDING)

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')
        admin_client.post(changelist_url, {
            'action': 'start_pending_jobs',
            '_selected_action': [str(job.id)],
        })

        mock_queue.enqueue.assert_called_once()
        from scraper_app.tasks import scrape_asin_detail_job
        call_args = mock_queue.enqueue.call_args
        assert call_args.args[0] == scrape_asin_detail_job


# ---------------------------------------------------------------------------
# Queue Health Page
# ---------------------------------------------------------------------------

class TestQueueHealthPage:
    def test_renders_200(self, admin_client):
        response = admin_client.get('/admin/scraper/queue-health/')
        assert response.status_code == 200
        content = response.content.decode()
        assert 'Scraper Queue Health' in content


# ---------------------------------------------------------------------------
# ScrapeJob List Filters
# ---------------------------------------------------------------------------

class TestScrapeJobListFilters:
    def test_filter_by_status(self, admin_client):
        """Admin changelist filters by status."""
        _make_scrape_job(status=ScrapeJob.Status.RUNNING, asin='B0RUN00001')
        _make_scrape_job(status=ScrapeJob.Status.FAILED, asin='B0FAIL0001')
        _make_scrape_job(status=ScrapeJob.Status.COMPLETED, asin='B0DONE0001')

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')

        # Filter for running only
        response = admin_client.get(changelist_url, {'status__exact': 'running'})
        assert response.status_code == 200
        content = response.content.decode()
        assert 'B0RUN00001' in content
        assert 'B0FAIL0001' not in content

    def test_filter_by_mode(self, admin_client):
        """Admin changelist filters by mode."""
        _make_scrape_job(mode=ScrapeJob.Mode.LIVE, asin='B0LIVE0001')
        _make_scrape_job(mode=ScrapeJob.Mode.SCHEDULED, asin='B0SCHED001')

        changelist_url = reverse('admin:scraper_app_scrapejob_changelist')

        response = admin_client.get(changelist_url, {'mode__exact': 'live'})
        assert response.status_code == 200
        content = response.content.decode()
        assert 'B0LIVE0001' in content
        assert 'B0SCHED001' not in content
