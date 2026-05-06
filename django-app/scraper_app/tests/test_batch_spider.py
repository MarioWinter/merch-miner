"""Tests for PROJ-25 Phase C — amazon_product_batch spider outcome file.

The spider's network-level behavior is identical to amazon_product (covered by
existing tests). These tests focus on the outcome-file generation logic:
- start_requests builds /dp/<asin>/ URLs for each input ASIN
- item_scraped signal records 'ok'
- spider_error / errback record 'failed'
- closed() flushes a final outcome file with one entry per ASIN
"""

import json
import os
import uuid

import pytest

from scraper_app.scrapy_app.items import AmazonProductItem, ScrapeErrorItem
from scraper_app.scrapy_app.spiders.amazon_product_batch import (
    AmazonProductBatchSpider,
)


pytestmark = pytest.mark.django_db


def _spider(asins, job_id=None):
    job_id = job_id or str(uuid.uuid4())
    return AmazonProductBatchSpider(
        asins=','.join(asins) if isinstance(asins, list) else asins,
        marketplace='amazon_com',
        job_id=job_id,
    ), job_id


def _read_outcome(job_id):
    path = f"/tmp/scrape_batch_{job_id}.json"
    with open(path, 'r', encoding='utf-8') as fh:
        return json.load(fh), path


class TestBatchSpiderInit:
    def test_dedupes_and_uppercases(self):
        sp, _ = _spider('b0aaaaaaaa,B0BBBBBBBB,B0AAAAAAAA')
        assert sp.asins == ['B0AAAAAAAA', 'B0BBBBBBBB']

    def test_accepts_list(self):
        sp = AmazonProductBatchSpider(
            asins=['B0AAAAAAAA', 'B0BBBBBBBB'], job_id='j1',
        )
        assert sp.asins == ['B0AAAAAAAA', 'B0BBBBBBBB']

    def test_outcome_path_uses_job_id(self):
        sp, jid = _spider('B0AAAAAAAA', job_id='abcd-1234')
        assert sp._outcome_path == '/tmp/scrape_batch_abcd-1234.json'


class TestStartRequests:
    def test_one_request_per_asin(self):
        sp, _ = _spider('B0AAAAAAAA,B0BBBBBBBB')
        reqs = list(sp.start_requests())
        assert len(reqs) == 2
        urls = sorted(r.url for r in reqs)
        assert urls == [
            'https://www.amazon.com/dp/B0AAAAAAAA/',
            'https://www.amazon.com/dp/B0BBBBBBBB/',
        ]
        # Each request carries asin + marketplace meta.
        for r in reqs:
            assert r.meta['marketplace'] == 'amazon_com'
            assert r.meta['asin'] in ('B0AAAAAAAA', 'B0BBBBBBBB')


class TestRecordAndFlush:
    def test_record_writes_outcome_file(self):
        sp, jid = _spider('B0AAAAAAAA')
        sp._record('B0AAAAAAAA', status='ok', http_status=200)
        payload, path = _read_outcome(jid)
        try:
            assert 'results' in payload
            assert payload['results'][0]['asin'] == 'B0AAAAAAAA'
            assert payload['results'][0]['status'] == 'ok'
            assert payload['results'][0]['http_status'] == 200
            assert 'scraped_at' in payload['results'][0]
        finally:
            os.remove(path)

    def test_first_write_per_asin_wins(self):
        sp, jid = _spider('B0AAAAAAAA')
        sp._record('B0AAAAAAAA', status='ok', http_status=200)
        sp._record('B0AAAAAAAA', status='failed', error_message='dup')
        payload, path = _read_outcome(jid)
        try:
            assert len(payload['results']) == 1
            assert payload['results'][0]['status'] == 'ok'
        finally:
            os.remove(path)

    def test_failed_records_error_message(self):
        sp, jid = _spider('B0AAAAAAAA,B0BBBBBBBB')
        sp._record('B0AAAAAAAA', status='ok', http_status=200)
        sp._record('B0BBBBBBBB', status='failed', error_message='HTTP 503', http_status=503)
        payload, path = _read_outcome(jid)
        try:
            statuses = {e['asin']: e['status'] for e in payload['results']}
            assert statuses == {'B0AAAAAAAA': 'ok', 'B0BBBBBBBB': 'failed'}
            failed = [e for e in payload['results'] if e['asin'] == 'B0BBBBBBBB'][0]
            assert failed['error_message'] == 'HTTP 503'
            assert failed['http_status'] == 503
        finally:
            os.remove(path)


class TestClosedFinalFlush:
    def test_closed_synthesizes_failed_for_missing_asins(self):
        sp, jid = _spider('B0AAAAAAAA,B0BBBBBBBB,B0CCCCCCCC')
        sp._record('B0AAAAAAAA', status='ok', http_status=200)
        sp.closed('finished')
        payload, path = _read_outcome(jid)
        try:
            statuses = {e['asin']: e['status'] for e in payload['results']}
            assert statuses['B0AAAAAAAA'] == 'ok'
            assert statuses['B0BBBBBBBB'] == 'failed'
            assert statuses['B0CCCCCCCC'] == 'failed'
        finally:
            os.remove(path)

    def test_closed_with_finished_with_errors_still_writes_file(self):
        sp, jid = _spider('B0AAAAAAAA')
        sp.closed('finished_with_errors')
        payload, path = _read_outcome(jid)
        try:
            assert 'results' in payload
            assert len(payload['results']) == 1
            assert payload['results'][0]['status'] == 'failed'
        finally:
            os.remove(path)


class TestSignalAdapters:
    def test_on_item_scraped_records_ok(self):
        sp, jid = _spider('B0AAAAAAAA')
        item = AmazonProductItem(asin='B0AAAAAAAA')

        class _Resp:
            status = 200
            meta = {'asin': 'B0AAAAAAAA'}

        sp._on_item_scraped(item, _Resp(), sp)
        payload, path = _read_outcome(jid)
        try:
            assert payload['results'][0]['status'] == 'ok'
        finally:
            os.remove(path)

    def test_on_item_scraped_records_error_item_as_failed(self):
        sp, jid = _spider('B0AAAAAAAA')
        item = ScrapeErrorItem(
            failed_selector='product_unavailable',
            url='https://example.com',
            marketplace='amazon_com',
            response_status=200,
            error_message='Sorry-page',
        )

        class _Resp:
            status = 200
            meta = {'asin': 'B0AAAAAAAA'}

        sp._on_item_scraped(item, _Resp(), sp)
        payload, path = _read_outcome(jid)
        try:
            assert payload['results'][0]['status'] == 'failed'
            assert 'Sorry-page' in payload['results'][0]['error_message']
        finally:
            os.remove(path)
