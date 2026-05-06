"""Tests for PROJ-25 Phase E — admin UI (changelist + actions + permissions).

Covers tasks E.20–E.30. AC-22 / AC-23 / AC-25 / AC-26 / EC-8 / EC-9 / Q4=A.

Notes:
- E.21 / E.22 are already covered by `test_bulk_upload_admin.py` (Phase B).
  We add lightweight smoke checks here so Phase E's test file is also
  self-contained; the canonical assertions live in the Phase B test module.
"""

import io
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone

from scraper_app.models import (
    BulkScrapeBatch,
    ScheduledScrapeTarget,
    ScrapeJob,
    ScrapeTier,
)


pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Local fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def oneshot_tier():
    tier, _ = ScrapeTier.objects.get_or_create(
        name='OneShot',
        defaults={'bsr_min': 0, 'bsr_max': None, 'interval_days': 999999},
    )
    return tier


def _make_batch(status, total=10, name='admin-test-batch'):
    return BulkScrapeBatch.objects.create(
        name=name,
        marketplace='amazon_com',
        status=status,
        total_count=total,
        pending_count=total,
    )


def _make_target(batch, tier, asin='B000000001', last_error=None, retry_count=0,
                 active=False):
    return ScheduledScrapeTarget.objects.create(
        asin=asin,
        marketplace=batch.marketplace,
        tier=tier,
        tier_override=True,
        active=active,
        batch=batch,
        next_scrape_at=timezone.now(),
        last_error=last_error,
        retry_count=retry_count,
    )


def _start_url(batch_id):
    return reverse('admin:scraper_app_bulkscrapebatch_start', args=[batch_id])


def _pause_url(batch_id):
    return reverse('admin:scraper_app_bulkscrapebatch_pause', args=[batch_id])


def _resume_url(batch_id):
    return reverse('admin:scraper_app_bulkscrapebatch_resume', args=[batch_id])


def _cancel_url(batch_id):
    return reverse('admin:scraper_app_bulkscrapebatch_cancel', args=[batch_id])


def _retry_url(batch_id):
    return reverse('admin:scraper_app_bulkscrapebatch_retry_failed', args=[batch_id])


# ---------------------------------------------------------------------------
# E.20 — changelist renders status badges
# ---------------------------------------------------------------------------


class TestChangelist:
    def test_changelist_renders_status_badges(self, admin_client):
        """E.20 / AC-22: status badge HTML present on changelist."""
        _make_batch(BulkScrapeBatch.Status.RUNNING, name='running-one')
        _make_batch(BulkScrapeBatch.Status.COMPLETED, name='done-two')

        url = reverse('admin:scraper_app_bulkscrapebatch_changelist')
        resp = admin_client.get(url)
        assert resp.status_code == 200
        html = resp.content.decode()
        # AC-22 columns
        assert 'running-one' in html
        assert 'done-two' in html
        # Badges (mark_safe span markup)
        assert 'background:#2e7d32' in html  # RUNNING green
        assert 'background:#1b5e20' in html  # COMPLETED dark green

    def test_changelist_has_upload_button(self, admin_client):
        """E.5: upload button present on changelist."""
        url = reverse('admin:scraper_app_bulkscrapebatch_changelist')
        resp = admin_client.get(url)
        assert resp.status_code == 200
        assert 'Upload new batch' in resp.content.decode()


# ---------------------------------------------------------------------------
# E.21 — upload smoke (canonical assertions in test_bulk_upload_admin.py)
# ---------------------------------------------------------------------------


def _make_xlsx_bytes(asins):
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.append(['asin'])
    for a in asins:
        ws.append([a])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


class TestUploadSmoke:
    @patch('django_rq.queues.Queue.enqueue')
    def test_upload_form_uploads_xlsx_and_creates_batch(
        self, mock_enqueue, admin_client,
    ):
        """E.21: upload form creates a batch row and enqueues parser."""
        xlsx = _make_xlsx_bytes(['B000000001', 'B000000002'])
        xlsx.name = 'phase-e-smoke.xlsx'
        url = reverse('admin:scraper_app_bulkscrapebatch_upload')
        resp = admin_client.post(
            url,
            {
                'csv_file': xlsx,
                'name': 'phase-e-smoke',
                'marketplace': 'amazon_com',
                'force_rescrape': False,
            },
            follow=False,
        )
        assert resp.status_code == 302
        assert BulkScrapeBatch.objects.filter(name='phase-e-smoke').exists()
        assert mock_enqueue.called

    def test_upload_form_rejects_unauth_user(self, client):
        """E.22: non-staff users are redirected away from the upload URL."""
        User = get_user_model()
        User.objects.create_user(email='joe@test.com', password='pw12345!')
        client.login(email='joe@test.com', password='pw12345!')

        url = reverse('admin:scraper_app_bulkscrapebatch_upload')
        resp = client.get(url, follow=False)
        # Django admin redirects unauthorized users to its login page.
        assert resp.status_code in (302, 403)


# ---------------------------------------------------------------------------
# E.23 — start action
# ---------------------------------------------------------------------------


class TestStartAction:
    def test_start_action_sets_running_and_enqueues_drainer(
        self, admin_client, oneshot_tier,
    ):
        """E.23 / AC-23: start sets RUNNING + enqueues drain_bulk_batch."""
        batch = _make_batch(BulkScrapeBatch.Status.READY, total=2)
        _make_target(batch, oneshot_tier, asin='B000000001')
        _make_target(batch, oneshot_tier, asin='B000000002')

        fake_queue = MagicMock()
        fake_queue.enqueue.return_value = MagicMock(id='drain-1')
        with patch('django_rq.get_queue', return_value=fake_queue):
            resp = admin_client.post(_start_url(batch.id), follow=False)

        assert resp.status_code == 302
        batch.refresh_from_db()
        assert batch.status == BulkScrapeBatch.Status.RUNNING
        assert batch.started_at is not None
        # Enqueue called with drain_bulk_batch + batch_id
        from scraper_app.tasks import drain_bulk_batch
        fake_queue.enqueue.assert_called_once()
        args, _kwargs = fake_queue.enqueue.call_args
        assert args[0] is drain_bulk_batch
        assert args[1] == str(batch.id)

    def test_start_action_rejects_wrong_status(self, admin_client):
        """Cannot Start a batch already RUNNING — warning issued, no state change."""
        batch = _make_batch(BulkScrapeBatch.Status.RUNNING)
        with patch('django_rq.get_queue') as mock_q:
            mock_q.return_value = MagicMock()
            resp = admin_client.post(_start_url(batch.id), follow=False)
        assert resp.status_code == 302
        batch.refresh_from_db()
        # Status must remain RUNNING (unchanged)
        assert batch.status == BulkScrapeBatch.Status.RUNNING


# ---------------------------------------------------------------------------
# E.24 — pause action
# ---------------------------------------------------------------------------


class TestPauseAction:
    def test_pause_action_sets_paused(self, admin_client):
        """E.24 / AC-23: pause transitions RUNNING -> PAUSED."""
        batch = _make_batch(BulkScrapeBatch.Status.RUNNING)
        resp = admin_client.post(_pause_url(batch.id), follow=False)
        assert resp.status_code == 302
        batch.refresh_from_db()
        assert batch.status == BulkScrapeBatch.Status.PAUSED


# ---------------------------------------------------------------------------
# E.25 — cancel scrubs pending RQ jobs
# ---------------------------------------------------------------------------


class TestCancelAction:
    def test_cancel_action_scrubs_pending_rq_jobs(self, admin_client, oneshot_tier):
        """E.25 / EC-8: cancel removes only pending jobs that belong to this batch."""
        batch = _make_batch(BulkScrapeBatch.Status.RUNNING)
        # ScrapeJob this batch owns
        sj_mine = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.BATCH_ASIN,
            asin_list=['B000000001', 'B000000002'],
            batch=batch,
            marketplace=batch.marketplace,
            status=ScrapeJob.Status.PENDING,
        )
        # ScrapeJob in some other batch
        other_batch = _make_batch(BulkScrapeBatch.Status.RUNNING, name='other-batch')
        sj_other = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.BATCH_ASIN,
            asin_list=['B000000003'],
            batch=other_batch,
            marketplace=other_batch.marketplace,
            status=ScrapeJob.Status.PENDING,
        )

        # Build fake RQ jobs the queue.get_jobs() should return.
        rq_mine = MagicMock()
        rq_mine.id = 'rq-mine'
        rq_mine.func_name = 'scraper_app.tasks.scrape_asin_batch_job'
        rq_mine.args = [str(sj_mine.id)]

        rq_other = MagicMock()
        rq_other.id = 'rq-other'
        rq_other.func_name = 'scraper_app.tasks.scrape_asin_batch_job'
        rq_other.args = [str(sj_other.id)]

        rq_unrelated = MagicMock()
        rq_unrelated.id = 'rq-unrelated'
        rq_unrelated.func_name = 'scraper_app.tasks.some_other_job'
        rq_unrelated.args = ['nope']

        fake_queue = MagicMock()
        fake_queue.get_jobs.return_value = [rq_mine, rq_other, rq_unrelated]

        with patch('django_rq.get_queue', return_value=fake_queue):
            resp = admin_client.post(_cancel_url(batch.id), follow=False)

        assert resp.status_code == 302
        batch.refresh_from_db()
        assert batch.status == BulkScrapeBatch.Status.CANCELLED
        assert batch.finished_at is not None

        # Only `rq-mine` was removed — others must NOT be touched.
        removed = [c.args[0] for c in fake_queue.remove.call_args_list]
        assert removed == ['rq-mine']


# ---------------------------------------------------------------------------
# E.26 / E.27 — retry-failed (Q4=A) strict semantics
# ---------------------------------------------------------------------------


class TestRetryFailedAction:
    def test_retry_failed_only_resets_last_error_targets(
        self, admin_client, oneshot_tier,
    ):
        """E.26 / E.27 / Q4=A:
        - target with last_error='HTTP 503'  -> RESET (last_error=None, retry_count=0)
        - target with last_error='skipped_fresh' -> NOT touched
        - target with last_error=None -> NOT touched
        """
        batch = _make_batch(BulkScrapeBatch.Status.COMPLETED, total=3)
        t_failed = _make_target(
            batch, oneshot_tier, asin='B000000001',
            last_error='HTTP 503', retry_count=2,
        )
        t_skipped = _make_target(
            batch, oneshot_tier, asin='B000000002',
            last_error='skipped_fresh', retry_count=0,
        )
        t_pristine = _make_target(
            batch, oneshot_tier, asin='B000000003',
            last_error=None, retry_count=0,
        )

        fake_queue = MagicMock()
        fake_queue.enqueue.return_value = MagicMock(id='drain-x')
        with patch('django_rq.get_queue', return_value=fake_queue):
            resp = admin_client.post(_retry_url(batch.id), follow=False)
        assert resp.status_code == 302

        t_failed.refresh_from_db()
        t_skipped.refresh_from_db()
        t_pristine.refresh_from_db()

        # Only the failed-with-error target was reset.
        assert t_failed.last_error is None
        assert t_failed.retry_count == 0
        # Skipped-fresh target untouched.
        assert t_skipped.last_error == 'skipped_fresh'
        assert t_skipped.retry_count == 0
        # Pristine target untouched.
        assert t_pristine.last_error is None
        assert t_pristine.retry_count == 0

        batch.refresh_from_db()
        assert batch.status == BulkScrapeBatch.Status.RUNNING
        assert batch.finished_at is None
        # Drainer enqueued
        fake_queue.enqueue.assert_called()

    def test_retry_failed_does_not_touch_skipped_fresh_targets(
        self, admin_client, oneshot_tier,
    ):
        """E.27: explicit assertion — skipped_fresh stays skipped_fresh."""
        batch = _make_batch(BulkScrapeBatch.Status.CANCELLED, total=1)
        t_skipped = _make_target(
            batch, oneshot_tier, asin='B000000099',
            last_error='skipped_fresh', retry_count=0,
        )
        fake_queue = MagicMock()
        fake_queue.enqueue.return_value = MagicMock(id='drain-y')
        with patch('django_rq.get_queue', return_value=fake_queue):
            admin_client.post(_retry_url(batch.id), follow=False)

        t_skipped.refresh_from_db()
        assert t_skipped.last_error == 'skipped_fresh'


# ---------------------------------------------------------------------------
# E.28 — audit trail in errors[]
# ---------------------------------------------------------------------------


class TestAuditTrail:
    def test_action_audit_trail_appended_to_errors_json(self, admin_client):
        """E.28 / AC-25: every admin action appends an audit entry to errors[]."""
        batch = _make_batch(BulkScrapeBatch.Status.READY)
        fake_queue = MagicMock()
        fake_queue.enqueue.return_value = MagicMock(id='drain-z')
        with patch('django_rq.get_queue', return_value=fake_queue):
            admin_client.post(_start_url(batch.id), follow=False)

        batch.refresh_from_db()
        assert isinstance(batch.errors, list)
        # One 'start' audit entry recorded.
        actions = [e.get('action') for e in batch.errors if isinstance(e, dict)]
        assert 'start' in actions
        start_entry = next(e for e in batch.errors if e.get('action') == 'start')
        assert 'user' in start_entry
        assert 'at' in start_entry


# ---------------------------------------------------------------------------
# E.29 — non-staff cannot call actions (AC-25)
# ---------------------------------------------------------------------------


class TestNonStaffForbidden:
    def test_non_staff_cannot_call_actions(self, client):
        """E.29: a logged-in non-staff user is blocked from POSTing to actions."""
        User = get_user_model()
        User.objects.create_user(email='bob@test.com', password='pw12345!')
        client.login(email='bob@test.com', password='pw12345!')

        batch = _make_batch(BulkScrapeBatch.Status.READY)
        url = _start_url(batch.id)
        resp = client.post(url, follow=False)
        # Either 403 forbidden or 302 redirect to admin login (admin_view wraps).
        assert resp.status_code in (302, 403)
        batch.refresh_from_db()
        # State unchanged
        assert batch.status == BulkScrapeBatch.Status.READY


# ---------------------------------------------------------------------------
# E.30 — delete cascade behavior
# ---------------------------------------------------------------------------


class TestDeleteCascade:
    def test_delete_batch_cascades_to_targets_but_not_scrapejobs(
        self, admin_client, oneshot_tier,
    ):
        """E.30 / AC-26: deleting a batch removes targets but preserves ScrapeJobs."""
        batch = _make_batch(BulkScrapeBatch.Status.COMPLETED, total=2)
        t1 = _make_target(batch, oneshot_tier, asin='B000000001')
        t2 = _make_target(batch, oneshot_tier, asin='B000000002')
        sj = ScrapeJob.objects.create(
            mode=ScrapeJob.Mode.BATCH_ASIN,
            asin_list=['B000000001', 'B000000002'],
            batch=batch,
            marketplace=batch.marketplace,
            status=ScrapeJob.Status.COMPLETED,
        )

        # Delete via Django ORM (mirrors what admin's delete_view ultimately
        # invokes — admin-form POST is verbose; the cascade behavior we are
        # asserting is FK-level, not admin-flow-level).
        batch.delete()

        # Targets cascade-removed
        assert not ScheduledScrapeTarget.objects.filter(id=t1.id).exists()
        assert not ScheduledScrapeTarget.objects.filter(id=t2.id).exists()
        # ScrapeJob preserved with batch=NULL
        sj.refresh_from_db()
        assert sj.batch_id is None
