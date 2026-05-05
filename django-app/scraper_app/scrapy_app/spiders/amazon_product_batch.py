"""Batch ASIN detail page spider (PROJ-25 Phase C).

Scrapes N ASINs in parallel inside a single Scrapy process and writes a
per-ASIN outcome JSON file at /tmp/scrape_batch_<job_id>.json. The wrapper
task `scrape_asin_batch_job` reads that file after subprocess exit to
reconcile target rows.

See features/PROJ-25-bulk-asin-scrape-batches.md AC-16 / AC-17 / AC-18 /
AC-19.
"""

import json
import logging
import os
import tempfile

import scrapy
from scrapy import signals

from scraper_app.scrapy_app.items import ScrapeErrorItem
from scraper_app.scrapy_app.spiders.mixins import ProductDetailMixin
from scraper_app.selectors import get_base_url


logger = logging.getLogger(__name__)


class AmazonProductBatchSpider(ProductDetailMixin, scrapy.Spider):
    """Scrape multiple ASINs in parallel and write a JSON outcome file.

    Concurrency is supplied by the wrapper via ``-s`` flags so this spider's
    ``custom_settings`` is intentionally empty (AC-14).
    """

    name = 'amazon_product_batch'
    custom_settings = {}

    def __init__(self, asins, marketplace='amazon_com', job_id=None,
                 *args, **kwargs):
        super().__init__(*args, **kwargs)
        if isinstance(asins, (list, tuple)):
            self.asins = [str(a).strip().upper() for a in asins if a]
        else:
            self.asins = [a.strip().upper() for a in str(asins).split(',') if a.strip()]
        # Dedup but preserve first-seen order so the outcome file mirrors input.
        seen = set()
        deduped = []
        for asin in self.asins:
            if asin not in seen:
                seen.add(asin)
                deduped.append(asin)
        self.asins = deduped

        self.marketplace = marketplace
        self.job_id = job_id

        # In-memory results list — keyed by ASIN so duplicate signals (e.g.
        # both item_scraped + spider_error) collapse to one entry per ASIN.
        self._results = {}
        self._outcome_path = (
            f"/tmp/scrape_batch_{job_id}.json" if job_id
            else os.path.join(tempfile.gettempdir(), "scrape_batch_unknown.json")
        )

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        spider = super().from_crawler(crawler, *args, **kwargs)
        crawler.signals.connect(spider._on_item_scraped, signal=signals.item_scraped)
        crawler.signals.connect(spider._on_spider_error, signal=signals.spider_error)
        crawler.signals.connect(spider._on_request_dropped, signal=signals.request_dropped)
        return spider

    def start_requests(self):
        base_url = get_base_url(self.marketplace)
        for asin in self.asins:
            url = f"{base_url}/dp/{asin}/"
            yield scrapy.Request(
                url=url,
                callback=self.parse_product_data,
                errback=self._errback,
                dont_filter=True,
                meta={
                    'marketplace': self.marketplace,
                    'job_id': self.job_id,
                    'asin': asin,
                    'retry_count': 0,
                },
            )

    # ------------------------------------------------------------------
    # Outcome file management
    # ------------------------------------------------------------------

    def _record(self, asin, status, error_message=None, http_status=None):
        from datetime import datetime, timezone

        if not asin:
            return
        # Don't overwrite a terminal 'failed' with a later 'ok' (or vice versa)
        # for the same ASIN — first-write wins per ASIN.
        if asin in self._results:
            return
        entry = {
            'asin': asin,
            'status': status,
            'http_status': http_status,
            'scraped_at': datetime.now(timezone.utc).isoformat(),
        }
        if error_message:
            entry['error_message'] = error_message[:500]
        self._results[asin] = entry
        self._flush_outcome_file()

    def _flush_outcome_file(self):
        """Atomically rewrite the outcome file (write + rename)."""
        payload = {'results': list(self._results.values())}
        try:
            tmp_path = f"{self._outcome_path}.tmp"
            with open(tmp_path, 'w', encoding='utf-8') as fh:
                json.dump(payload, fh)
            os.replace(tmp_path, self._outcome_path)
        except OSError:
            logger.exception("Could not flush outcome file %s", self._outcome_path)

    # ------------------------------------------------------------------
    # Signal handlers
    # ------------------------------------------------------------------

    def _on_item_scraped(self, item, response, spider):
        if isinstance(item, ScrapeErrorItem):
            asin = response.meta.get('asin') if response is not None else None
            self._record(
                asin,
                status='failed',
                error_message=str(item.get('error_message') or item.get('failed_selector') or ''),
                http_status=response.status if response is not None else None,
            )
            return
        # AmazonProductItem (or any non-error scrapy.Item)
        asin = None
        try:
            asin = item.get('asin') if hasattr(item, 'get') else None
        except Exception:  # noqa: BLE001
            asin = None
        if not asin and response is not None:
            asin = response.meta.get('asin')
        self._record(
            asin,
            status='ok',
            http_status=response.status if response is not None else 200,
        )

    def _on_spider_error(self, failure, response, spider):
        asin = response.meta.get('asin') if response is not None else None
        self._record(
            asin,
            status='failed',
            error_message=str(failure.value) if failure else 'spider error',
            http_status=response.status if response is not None else None,
        )

    def _on_request_dropped(self, request, spider):
        asin = request.meta.get('asin') if request is not None else None
        self._record(
            asin,
            status='failed',
            error_message='request dropped before download',
        )

    def _errback(self, failure):
        request = getattr(failure, 'request', None)
        response = getattr(failure.value, 'response', None) if failure else None
        asin = None
        http_status = None
        if request is not None:
            asin = request.meta.get('asin')
        if response is not None:
            http_status = response.status
        self._record(
            asin,
            status='failed',
            error_message=str(failure.value) if failure else 'download error',
            http_status=http_status,
        )

    # ------------------------------------------------------------------
    # Final flush — fill in any ASIN that produced neither item nor error
    # ------------------------------------------------------------------

    def closed(self, reason):
        for asin in self.asins:
            if asin not in self._results:
                self._record(
                    asin,
                    status='failed',
                    error_message=f"no outcome (reason={reason})",
                )
        self._flush_outcome_file()
