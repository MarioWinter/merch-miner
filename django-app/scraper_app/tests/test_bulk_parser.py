"""Tests for PROJ-25 Phase B — async bulk-upload parser.

Covers:
- B.24 / AC-8: parser handles XLSX with only `asin` column (default marketplace)
- B.25 / AC-11: parser dedupes duplicate ASINs within a single file
- B.26 / AC-9: parser skips invalid ASIN rows + records errors
- B.27 / EC-12: parser skips rows with unknown marketplace
- B.28 / EC-2: parser handles partial last chunk (7 rows)
- B.29 / EC-11: parser sets PARSE_FAILED on corrupt XLSX
- defensive: parser sets PARSE_FAILED when OneShot tier is missing
"""

from pathlib import Path

import pytest
from django.conf import settings

from scraper_app.models import (
    BulkScrapeBatch,
    ScheduledScrapeTarget,
    ScrapeTier,
)
from scraper_app.tasks import parse_bulk_upload_job


pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Fixture helpers (programmatic — no committed binaries)
# ---------------------------------------------------------------------------

def _ensure_oneshot():
    tier, _ = ScrapeTier.objects.get_or_create(
        name='OneShot',
        defaults={'bsr_min': 0, 'bsr_max': None, 'interval_days': 999999},
    )
    return tier


def _make_batch(name='test', marketplace='amazon_com', force_rescrape=False):
    return BulkScrapeBatch.objects.create(
        name=name,
        marketplace=marketplace,
        force_rescrape=force_rescrape,
        status=BulkScrapeBatch.Status.PARSING,
        source_filename='test.xlsx',
    )


def _write_xlsx(path, rows, headers=None):
    """Write an XLSX file at `path` with given header row + data rows."""
    from openpyxl import Workbook

    if headers is None:
        headers = ['asin']
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    wb.save(str(path))


def _write_csv(path, rows, headers):
    """Write a CSV file (UTF-8) with header row + data rows."""
    import csv as _csv

    with open(path, 'w', encoding='utf-8', newline='') as fh:
        writer = _csv.writer(fh)
        writer.writerow(headers)
        writer.writerows(rows)


def _upload_path_for(batch, ext='xlsx'):
    bulk_dir = Path(settings.MEDIA_ROOT) / 'bulk_uploads'
    bulk_dir.mkdir(parents=True, exist_ok=True)
    return bulk_dir / f"{batch.id}.{ext}"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestParserHappyPath:
    def test_parser_handles_xlsx_with_only_asin_column(self):
        """B.24 / AC-8: 10 valid ASINs, only `asin` column → 10 targets w/ default marketplace."""
        _ensure_oneshot()
        batch = _make_batch(marketplace='amazon_de')
        path = _upload_path_for(batch, 'xlsx')

        asins = [f"B{str(i).zfill(9)}" for i in range(10)]
        # Make sure they match ASIN regex (uppercase alphanumeric, 10 chars).
        rows = [[a] for a in asins]
        _write_xlsx(path, rows, headers=['asin'])

        try:
            parse_bulk_upload_job(str(batch.id))

            batch.refresh_from_db()
            assert batch.status == BulkScrapeBatch.Status.READY
            assert batch.total_count == 10
            assert batch.pending_count == 10

            targets = ScheduledScrapeTarget.objects.filter(batch=batch)
            assert targets.count() == 10
            for t in targets:
                assert t.marketplace == 'amazon_de'
                assert t.active is False
                assert t.tier.name == 'OneShot'
                assert t.tier_override is True
        finally:
            if path.exists():
                path.unlink()


class TestParserDedupe:
    def test_parser_dedupes_duplicate_asins(self):
        """B.25 / AC-11: same ASIN twice → 1 target row + duplicate count in errors."""
        _ensure_oneshot()
        batch = _make_batch()
        path = _upload_path_for(batch, 'xlsx')

        rows = [
            ['B000000001'],
            ['B000000002'],
            ['B000000001'],  # duplicate
        ]
        _write_xlsx(path, rows, headers=['asin'])

        try:
            parse_bulk_upload_job(str(batch.id))

            batch.refresh_from_db()
            assert batch.status == BulkScrapeBatch.Status.READY
            assert batch.total_count == 2

            assert ScheduledScrapeTarget.objects.filter(batch=batch).count() == 2

            # Duplicate count recorded in errors[]
            dup_events = [e for e in batch.errors if e.get('event') == 'parse_duplicates']
            assert len(dup_events) == 1
            assert dup_events[0]['duplicate_count'] == 1
        finally:
            if path.exists():
                path.unlink()


class TestParserInvalidRows:
    def test_parser_skips_invalid_asin_rows(self):
        """B.26 / AC-9: invalid regex → row skipped, error appended."""
        _ensure_oneshot()
        batch = _make_batch()
        path = _upload_path_for(batch, 'xlsx')

        rows = [
            ['B000000001'],     # ok
            ['BAD'],            # too short
            ['ABCDEF123!'],     # contains non-alphanumeric
        ]
        _write_xlsx(path, rows, headers=['asin'])

        try:
            parse_bulk_upload_job(str(batch.id))

            batch.refresh_from_db()
            assert batch.total_count == 1
            assert batch.status == BulkScrapeBatch.Status.READY

            errors = [e for e in batch.errors if e.get('event') == 'parse_row_error']
            assert len(errors) == 2
        finally:
            if path.exists():
                path.unlink()

    def test_parser_skips_unknown_marketplace(self):
        """B.27 / EC-12: row with marketplace='amazon_pl' is skipped."""
        _ensure_oneshot()
        batch = _make_batch()
        path = _upload_path_for(batch, 'xlsx')

        rows = [
            ['B000000001', 'amazon_com'],
            ['B000000002', 'amazon_pl'],   # unknown
            ['B000000003', 'amazon_de'],
        ]
        _write_xlsx(path, rows, headers=['asin', 'marketplace'])

        try:
            parse_bulk_upload_job(str(batch.id))

            batch.refresh_from_db()
            assert batch.total_count == 2

            errors = [e for e in batch.errors if e.get('event') == 'parse_row_error']
            assert len(errors) == 1
            assert "amazon_pl" in errors[0]['error']
        finally:
            if path.exists():
                path.unlink()


class TestParserPartialChunk:
    def test_parser_handles_partial_last_chunk(self):
        """B.28 / EC-2: 7 rows; bulk_create works for partial chunk."""
        _ensure_oneshot()
        batch = _make_batch()
        path = _upload_path_for(batch, 'xlsx')

        rows = [[f"B00000000{i}"] for i in range(1, 8)]
        _write_xlsx(path, rows, headers=['asin'])

        try:
            parse_bulk_upload_job(str(batch.id))

            batch.refresh_from_db()
            assert batch.total_count == 7
            assert batch.status == BulkScrapeBatch.Status.READY
            assert ScheduledScrapeTarget.objects.filter(batch=batch).count() == 7
        finally:
            if path.exists():
                path.unlink()


class TestParserCorruptFile:
    def test_parser_marks_failed_on_corrupt_xlsx(self):
        """B.29 / EC-11: corrupt XLSX → status=PARSE_FAILED, exception in errors."""
        _ensure_oneshot()
        batch = _make_batch()
        path = _upload_path_for(batch, 'xlsx')

        # Garbage bytes, definitely not a zip / openpyxl-readable file.
        with open(path, 'wb') as fh:
            fh.write(b'this is not an xlsx file at all')

        try:
            parse_bulk_upload_job(str(batch.id))

            batch.refresh_from_db()
            assert batch.status == BulkScrapeBatch.Status.PARSE_FAILED
            assert batch.total_count == 0
            failed_events = [e for e in batch.errors if e.get('event') == 'parse_failed']
            assert len(failed_events) >= 1
        finally:
            if path.exists():
                path.unlink()


class TestParserOneShotMissing:
    def test_parser_marks_failed_when_oneshot_tier_missing(self):
        """Defensive: if OneShot tier was deleted, parser sets PARSE_FAILED."""
        # Wipe any seeded OneShot row.
        ScrapeTier.objects.filter(name='OneShot').delete()
        batch = _make_batch()
        path = _upload_path_for(batch, 'xlsx')

        rows = [['B000000001']]
        _write_xlsx(path, rows, headers=['asin'])

        try:
            parse_bulk_upload_job(str(batch.id))

            batch.refresh_from_db()
            assert batch.status == BulkScrapeBatch.Status.PARSE_FAILED
            failed = [e for e in batch.errors if e.get('event') == 'parse_failed']
            assert len(failed) == 1
            assert 'OneShot' in failed[0]['error']
        finally:
            if path.exists():
                path.unlink()
