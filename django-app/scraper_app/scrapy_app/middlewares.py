"""Custom Scrapy downloader middlewares for the Amazon scraper.

ScrapeOpsURLCleanupMiddleware
-----------------------------
Workaround for an SDK conflict between the two ScrapeOps packages we use:

* `scrapeops_scrapy` (Monitor extension, v0.6.x) stamps every request with
  ``request.meta['sops_time'] = utils.current_time()`` for internal duration
  telemetry.
* `scrapeops_scrapy_proxy_sdk` (Proxy SDK, v1.0) forwards EVERY meta key
  that starts with ``sops_`` as a query parameter on the outbound proxy URL —
  no blocklist. So ``sops_time`` becomes ``time=...`` on
  ``https://proxy.scrapeops.io/v1/?...``.

The ScrapeOps proxy API rejects unrecognized parameters (their support flagged
this on 2026-05-07). This middleware runs AFTER the proxy SDK (priority > 725)
and strips the leaked telemetry params from the final outbound URL while
leaving the original proxy SDK URL building untouched.
"""

from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse


# Telemetry param keys that scrapeops_scrapy's Monitor leaks via the proxy
# SDK. Extend this set if ScrapeOps confirms more param names.
LEAKED_TELEMETRY_KEYS = frozenset({'time'})

PROXY_HOST = 'proxy.scrapeops.io'


class ScrapeOpsURLCleanupMiddleware:
    """Strip telemetry params from the proxy URL after the proxy SDK built it."""

    @classmethod
    def from_crawler(cls, crawler):
        return cls()

    def process_request(self, request, spider):
        if PROXY_HOST not in request.url:
            return None

        parsed = urlparse(request.url)
        original_pairs = parse_qsl(parsed.query, keep_blank_values=True)
        cleaned_pairs = [
            (k, v) for k, v in original_pairs if k not in LEAKED_TELEMETRY_KEYS
        ]

        if len(cleaned_pairs) == len(original_pairs):
            return None  # no leaked params present — nothing to do

        new_query = urlencode(cleaned_pairs)
        new_url = urlunparse(parsed._replace(query=new_query))
        return request.replace(url=new_url)
