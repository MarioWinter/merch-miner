"""Tests for PROJ-25 Phase B — admin upload view.

Covers:
- B.30: upload view creates batch row + enqueues `parse_bulk_upload_job`
- B.22 (auth): non-staff users are redirected to login
- B.23 / EC-17: disk-full / OSError during file save returns the form with error
"""

import io
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model

from scraper_app.models import BulkScrapeBatch


pytestmark = pytest.mark.django_db


UPLOAD_URL = '/admin/scraper_app/bulkscrapebatch/upload/'


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


# ---------------------------------------------------------------------------
# B.30 — view creates batch + enqueues parser
# ---------------------------------------------------------------------------

class TestUploadCreatesBatch:
    @patch('django_rq.queues.Queue.enqueue')
    def test_upload_view_creates_batch_and_enqueues_parser(
        self, mock_enqueue, admin_client,
    ):
        """B.30: POST creates batch (status=PARSING) and enqueues parse job on default queue."""
        xlsx = _make_xlsx_bytes(['B000000001', 'B000000002'])
        xlsx.name = 'tiny.xlsx'

        resp = admin_client.post(
            UPLOAD_URL,
            {
                'csv_file': xlsx,
                'name': 'tiny test batch',
                'marketplace': 'amazon_com',
                'force_rescrape': False,
            },
            follow=False,
        )

        # Redirect to detail page
        assert resp.status_code == 302
        assert '/bulkscrapebatch/' in resp.url

        # Batch row exists with PARSING status
        batches = BulkScrapeBatch.objects.all()
        assert batches.count() == 1
        batch = batches.first()
        assert batch.name == 'tiny test batch'
        assert batch.marketplace == 'amazon_com'
        assert batch.force_rescrape is False
        assert batch.status == BulkScrapeBatch.Status.PARSING
        assert batch.source_filename == 'tiny.xlsx'
        assert batch.created_by is not None

        # Enqueue called with the parser fn + batch_id arg
        assert mock_enqueue.called
        args, kwargs = mock_enqueue.call_args
        # First positional is the function reference
        from scraper_app.tasks import parse_bulk_upload_job
        assert args[0] is parse_bulk_upload_job
        # Second positional is the batch id (str)
        assert args[1] == str(batch.id)


# ---------------------------------------------------------------------------
# Non-staff user is redirected to admin login
# ---------------------------------------------------------------------------

class TestUploadAuth:
    def test_upload_view_rejects_non_staff(self, client):
        User = get_user_model()
        # Plain (non-staff) user
        User.objects.create_user(email='alice@test.com', password='pw12345!')
        client.login(email='alice@test.com', password='pw12345!')

        xlsx = _make_xlsx_bytes(['B000000001'])
        xlsx.name = 'tiny.xlsx'

        resp = client.post(
            UPLOAD_URL,
            {
                'csv_file': xlsx,
                'name': 'should fail',
                'marketplace': 'amazon_com',
            },
            follow=False,
        )
        # Django admin redirects unauthorized users to its login page.
        assert resp.status_code in (302, 403)
        if resp.status_code == 302:
            assert '/login' in resp.url or '/admin' in resp.url
        # No batch was created
        assert BulkScrapeBatch.objects.count() == 0


# ---------------------------------------------------------------------------
# EC-17 — disk-full handling
# ---------------------------------------------------------------------------

class TestUploadDiskFull:
    def test_upload_view_handles_disk_full_gracefully(self, admin_client):
        """EC-17: OSError during file save → form re-rendered with error; no batch row.

        Build the xlsx fixture *before* patching, then patch only the admin
        module's `open` symbol during the request so that the writer's call to
        `open(target_path, 'wb')` raises ENOSPC.
        """
        xlsx = _make_xlsx_bytes(['B000000001'])
        xlsx.name = 'tiny.xlsx'

        with patch('scraper_app.admin.open', create=True) as mock_open:
            mock_open.side_effect = OSError("No space left on device")

            resp = admin_client.post(
                UPLOAD_URL,
                {
                    'csv_file': xlsx,
                    'name': 'disk-full test',
                    'marketplace': 'amazon_com',
                },
                follow=False,
            )

        # Form re-rendered (200), not redirected (302)
        assert resp.status_code == 200
        # No batch was created
        assert BulkScrapeBatch.objects.count() == 0
