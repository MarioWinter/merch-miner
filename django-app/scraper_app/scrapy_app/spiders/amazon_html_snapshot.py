"""Selector health-check spider — fetches a single Amazon detail page and
saves the raw HTML to disk. Does NOT run any selectors itself; auditing is
done by `scraper_app.audit.run_audit` after the spider exits (PROJ-23).

Persists the snapshot path + size onto the SelectorHealthCheck row whose ID
is passed via the `health_check_id` spider argument. On HTTP/network failure
populates `error_message` instead.
"""

import logging
import os
from datetime import datetime, timezone as dt_timezone
from pathlib import Path

import scrapy

from scraper_app.selectors import get_base_url


logger = logging.getLogger(__name__)


# Custom UA + headers identical to the production amazon_product spider.
# (We rely on the global ScraperOps proxy SDK from settings for IP/UA rotation.)
DEFAULT_HEADERS = {
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': (
        'text/html,application/xhtml+xml,application/xml;q=0.9,'
        'image/avif,image/webp,*/*;q=0.8'
    ),
}


class AmazonHtmlSnapshotSpider(scrapy.Spider):
    """Single-request spider — fetches /dp/<asin>/, dumps response.text to disk."""

    name = 'amazon_html_snapshot'

    custom_settings = {
        # Single-shot job — never retry the snapshot itself; we want a raw
        # observation, not a "best-effort" one. ScraperOps middleware already
        # handles transient proxy errors at a lower level.
        'CLOSESPIDER_ITEMCOUNT': 1,
    }

    def __init__(
        self,
        asin,
        marketplace='amazon_com',
        health_check_id=None,
        *args,
        **kwargs,
    ):
        super().__init__(*args, **kwargs)
        self.asin = asin
        self.marketplace = marketplace
        self.health_check_id = health_check_id

    def start_requests(self):
        base_url = get_base_url(self.marketplace)
        product_url = f"{base_url}/dp/{self.asin}/"

        yield scrapy.Request(
            url=product_url,
            callback=self.parse_snapshot,
            errback=self.handle_failure,
            headers=DEFAULT_HEADERS,
            meta={
                'marketplace': self.marketplace,
                'asin': self.asin,
                'dont_retry': False,  # let ScraperOps handle proxy retries
            },
        )

    # ------------------------------------------------------------------
    # Callbacks
    # ------------------------------------------------------------------

    def parse_snapshot(self, response):
        """Write raw response.text to MEDIA_ROOT/snapshots/<marketplace>/<asin>_<ts>.html."""
        # HTTP non-2xx is still routed here when handle_httpstatus_list/all
        # is set — we treat anything outside 200-299 as a failure so the
        # audit can flag it with `error_message`.
        if response.status >= 400:
            self._mark_error(f"HTTP {response.status}")
            return

        try:
            relative_path, size_bytes = self._save_snapshot(response.text)
        except OSError as exc:
            logger.exception("Snapshot file write failed for asin=%s", self.asin)
            self._mark_error(f"Snapshot write failed: {exc}")
            return

        self._update_health_check(
            html_path=relative_path,
            html_size_bytes=size_bytes,
        )
        logger.info(
            "Snapshot saved: asin=%s marketplace=%s path=%s size=%d",
            self.asin, self.marketplace, relative_path, size_bytes,
        )

    def handle_failure(self, failure):
        """Errback: spider request failed (DNS, timeout, ScraperOps quota, etc)."""
        msg = repr(failure.value) if failure and failure.value else str(failure)
        # Truncate huge tracebacks to keep DB rows lean.
        msg = msg[:500]
        logger.warning(
            "Snapshot request failed: asin=%s marketplace=%s error=%s",
            self.asin, self.marketplace, msg,
        )
        self._mark_error(msg)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _save_snapshot(self, html_text):
        """Write `html_text` and return (relative_path_str, size_bytes)."""
        from django.conf import settings

        timestamp = datetime.now(dt_timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')
        filename = f"{self.asin}_{timestamp}.html"
        relative_path = Path('snapshots') / self.marketplace / filename

        absolute_path = Path(settings.MEDIA_ROOT) / relative_path
        absolute_path.parent.mkdir(parents=True, exist_ok=True)

        encoded = html_text.encode('utf-8')
        absolute_path.write_bytes(encoded)
        return str(relative_path), len(encoded)

    def _update_health_check(self, **fields):
        """Persist fields onto the SelectorHealthCheck row (no-op if not bound)."""
        if not self.health_check_id:
            return
        # Lazy Django setup — spider runs in a subprocess where Django may not be
        # initialised yet by Scrapy's context.
        try:
            import django
            os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
            django.setup()
            from scraper_app.models import SelectorHealthCheck

            SelectorHealthCheck.objects.filter(id=self.health_check_id).update(**fields)
        except Exception:
            logger.exception(
                "Failed to update SelectorHealthCheck %s with %s",
                self.health_check_id, fields,
            )

    def _mark_error(self, message):
        self._update_health_check(error_message=message)
