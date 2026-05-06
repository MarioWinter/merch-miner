"""Tests for the inspect_bulk_batch management command (PROJ-25 G.7)."""

import uuid
from io import StringIO
from unittest.mock import MagicMock, patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from scraper_app.models import BulkScrapeBatch, ScrapeJob


pytestmark = pytest.mark.django_db


def _make_batch(name='Test', errors=None):
    return BulkScrapeBatch.objects.create(
        name=name,
        source_filename='test.xlsx',
        marketplace='amazon_com',
        force_rescrape=False,
        status=BulkScrapeBatch.Status.RUNNING,
        total_count=10, pending_count=4, running_count=1, done_count=5, failed_count=0,
        errors=errors or [],
    )


@patch('scraper_app.management.commands.inspect_bulk_batch.django_rq.get_connection')
def test_inspect_prints_batch_identity_and_counts(mock_get_conn):
    """Happy path: command prints all sections without errors."""
    mock_conn = MagicMock()
    mock_conn.get.return_value = None  # lock not held
    mock_get_conn.return_value = mock_conn

    batch = _make_batch(name='HappyBatch', errors=[
        {'event': 'parse_warning', 'message': 'row 5 invalid'},
        {'action': 'start', 'user': 'admin'},
    ])
    ScrapeJob.objects.create(
        mode=ScrapeJob.Mode.BATCH_ASIN,
        marketplace='amazon_com',
        status=ScrapeJob.Status.RUNNING,
        asin_list=['B07TEST0001', 'B07TEST0002'],
        batch=batch,
    )

    out = StringIO()
    call_command('inspect_bulk_batch', str(batch.id), stdout=out)
    output = out.getvalue()

    assert 'HappyBatch' in output
    assert 'amazon_com' in output
    assert 'pending : 4' in output
    assert 'done    : 5' in output
    assert 'not held' in output
    assert 'B07TEST0001' in output
    assert 'parse_warning' in output


def test_inspect_raises_on_missing_batch():
    """Missing batch_id → CommandError with clear message."""
    fake_id = str(uuid.uuid4())
    with pytest.raises(CommandError, match=f'{fake_id!r}'):
        call_command('inspect_bulk_batch', fake_id, stdout=StringIO())
