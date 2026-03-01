# PROJ-16: Amazon Product Scraper (Scrapy)

**Status:** Planned
**Priority:** P2
**Created:** 2026-02-27

## Overview

Replace the n8n + ScraperOps scraping dependency with a Scrapy-based scraper running as a django-rq job. Same `AmazonProduct` and `ProductSearchCache` models (from PROJ-7) — this is a scrape engine swap. No UI changes required.

## User Stories

1. As a system, when a product research scrape is triggered, I want Scrapy to fetch and parse Amazon search results, so that we're not dependent on a third-party paid service (ScraperOps).
2. As an admin, I want the scraper to run as a background job, so that it doesn't block the API.

## Acceptance Criteria

1. Scrapy spider reads keyword + marketplace from `ProductSearchCache`; scrapes Amazon search results page; saves `AmazonProduct` rows via Django ORM.
2. Spider runs via `django_rq.enqueue()` (same `worker` service from PROJ-4).
3. `ProductSearchCache.status` updated to completed/failed by the job.
4. PROJ-6 and PROJ-7 endpoints trigger this job instead of n8n webhook when `USE_SCRAPY_SCRAPER=True` env var is set (feature flag for gradual migration).
5. Scrapy respects rate limiting and uses rotating proxies or similar to avoid blocks.
6. On completion, populates same `AmazonProduct` schema as n8n workflow — no frontend or API changes needed.

## API Endpoints

None — internal engine change only. Existing PROJ-7 status polling endpoints unchanged.

## Edge Cases

1. Amazon changes page structure → spider fails; job status=failed; fallback to n8n if feature flag allows.
2. IP blocked during scrape → retry with backoff; mark failed after 3 attempts.
3. Concurrent scrape jobs for same keyword → `ProductSearchCache` unique constraint prevents duplicate triggers.

## Dependencies

- PROJ-7 (Amazon Product Research — models and data flow)
- PROJ-6 (Niche Deep Research — shares infrastructure)
- PROJ-4 (Workspace & Membership — worker service)

## Environment Variables Required

```
USE_SCRAPY_SCRAPER=False  # Feature flag; set True to activate Scrapy engine
```
