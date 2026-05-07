"""Tests for ScrapeOpsURLCleanupMiddleware.

The middleware strips telemetry query params (currently `time=`) that the
scrapeops_scrapy Monitor leaks through the proxy SDK onto outbound proxy
URLs. ScrapeOps support flagged the leak on 2026-05-07.
"""

from unittest.mock import MagicMock

import pytest
from scrapy.http import Request

from scraper_app.scrapy_app.middlewares import ScrapeOpsURLCleanupMiddleware


@pytest.fixture
def middleware():
    return ScrapeOpsURLCleanupMiddleware.from_crawler(MagicMock())


def test_strips_time_param_from_proxy_url(middleware):
    url = (
        'https://proxy.scrapeops.io/v1/'
        '?api_key=KEY&url=https%3A%2F%2Famazon.com%2Fdp%2FB07X43SPB8%2F'
        '&time=1778134182'
    )
    req = Request(url=url)
    new_req = middleware.process_request(req, MagicMock())

    assert new_req is not None
    assert 'time=' not in new_req.url
    assert 'api_key=KEY' in new_req.url
    assert 'url=https%3A%2F%2Famazon.com%2Fdp%2FB07X43SPB8%2F' in new_req.url


def test_passthrough_when_no_leaked_params(middleware):
    url = (
        'https://proxy.scrapeops.io/v1/'
        '?api_key=KEY&url=https%3A%2F%2Famazon.com%2Fdp%2FB07X43SPB8%2F'
    )
    req = Request(url=url)
    new_req = middleware.process_request(req, MagicMock())
    # No leaked params -> middleware returns None (no-op)
    assert new_req is None


def test_skips_non_proxy_urls(middleware):
    """A direct Amazon URL (no ScrapeOps proxy involvement) should be untouched
    even if it happens to contain a `time=` query param of its own.
    """
    url = 'https://www.amazon.com/dp/B07X43SPB8/?time=1234567890'
    req = Request(url=url)
    new_req = middleware.process_request(req, MagicMock())
    assert new_req is None  # not a proxy URL — leave it alone


def test_preserves_other_params_alongside_leaked_one(middleware):
    """If ScrapeOps adds future legitimate params (e.g. `country`), they
    must survive the cleanup pass.
    """
    url = (
        'https://proxy.scrapeops.io/v1/'
        '?api_key=KEY&url=https%3A%2F%2Famazon.com%2F'
        '&country=us&render_js=true&time=1778134182'
    )
    req = Request(url=url)
    new_req = middleware.process_request(req, MagicMock())

    assert new_req is not None
    assert 'time=' not in new_req.url
    assert 'country=us' in new_req.url
    assert 'render_js=true' in new_req.url
    assert 'api_key=KEY' in new_req.url
