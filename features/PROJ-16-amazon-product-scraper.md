# PROJ-16: Amazon Product Scraper (Scrapy)

**Status:** Planned
**Priority:** P0 (MVP — required for PROJ-7 Live Research)
**Created:** 2026-02-27
**Updated:** 2026-03-14

## Overview

Standalone Scrapy-based scraper engine replacing all n8n scraping dependencies. Runs as django-rq background jobs. Three operating modes: **Live Research** (UI-triggered, single keyword), **Scheduled Scrape** (tier-based, Admin-managed), and **BSR History Tracking** (daily lightweight snapshot). Proxy via ScraperOps SDK. Managed and monitored entirely through Django Admin. No n8n dependency; no feature flag.

## User Stories

1. As a system, when a Live Research is triggered, I want Scrapy to scrape up to 4 pages of Amazon search results + detail pages for the keyword and store full product data, so the user sees fresh results.
2. As an admin, I want to upload a CSV of ASINs or keywords (with marketplace and tier assignment) and have them automatically scheduled for scraping, so I can build an initial data set.
3. As a system, I want products to be scheduled for re-scraping based on their BSR tier, so that high-performing products are tracked more frequently.
4. As a system, I want a daily BSR+Rating+Price snapshot stored per ASIN, so that BSR trend history is available for research.
5. As an admin, I want to see all active and past scrape jobs in the Django Admin, including status, product count, and errors, so I can monitor scraper health.
6. As an admin, I want to start, stop, and restart individual scrape jobs from the Admin, so I can recover from failures without code changes.
7. As a system, when an ASIN is discovered via Live Research, I want it automatically added to the scheduled tracking pool (tier assigned by current BSR), so all researched products are continuously monitored.

## Acceptance Criteria

### Live Research Mode
1. `POST /api/research/search/` → creates `ProductSearchCache` (status=pending) → enqueues `scrape_keyword_job` via django-rq → returns `cache_id`.
2. Spider scrapes Amazon search results pages (max 4 pages per keyword) + detail pages for each ASIN found → full product data stored in `AmazonProduct`.
3. Each ASIN is linked to the search keyword via the `keywords` M2M field (one `AmazonProduct` record per ASIN; no duplicates).
4. On completion: `ProductSearchCache.status` = completed; all discovered ASINs auto-enrolled in scheduled tracking (tier assigned by BSR).
5. If `ProductSearchCache` for keyword+marketplace already exists with status=pending → return existing cache_id; no duplicate job.
6. If completed scrape < 24h old → return cached results immediately; no new scrape triggered.

### Scheduled Scrape Mode
7. Admin CSV upload (via custom Django Admin action) accepts columns: `asin` or `keyword`, `marketplace`, `tier` (optional, overrides auto-assignment).
8. Uploaded ASINs/keywords are added to `ScheduledScrapeTarget`; tier auto-assigned by current BSR if not specified.
9. django-rq cron job (`schedule_scrape_runner`) runs every hour; enqueues due targets based on `ScrapeTier.interval_days` and `last_scraped_at`.
10. Each scrape target re-scraped at its tier interval; if BSR changes tier on next scrape, tier auto-updates.

### BSR History Tracking
11. After every scrape (live or scheduled), a `BSRSnapshot` record is written for each ASIN with current BSR, rating, price, and timestamp.
12. BSR is only available on the product detail page (not in Amazon search results). Daily BSR/Rating/Price snapshots are taken by scraping the ASIN detail page directly — no keyword search required. This is more efficient than a full keyword scrape (1 request per ASIN vs. 4 pages + N detail pages per keyword).
13. BSR snapshots retained indefinitely.

### Scraper Technical
14. ScraperOps SDK used for proxy rotation on all requests; no fallback provider.
15. 3 retry attempts with exponential backoff on request failure; after 3 failures, job marked failed.
16. Failed jobs logged to `ScrapeJob.error_log`; error count visible in Admin.
17. Spider supports all 6 marketplaces: `amazon_com`, `amazon_de`, `amazon_co_uk`, `amazon_fr`, `amazon_it`, `amazon_es`.
18. CSS selectors based on reference repos; marketplace-specific selector overrides supported.
19. `CONCURRENT_REQUESTS` configurable per ScraperOps plan (default 1 for free tier).

### Django Admin
20. `ScrapeJob` list view shows: keyword/asin, marketplace, mode, status, progress (pages done/total), start time, end time, products scraped, error count.
21. Admin actions on `ScrapeJob`: cancel pending job, retry failed job.
22. `ScrapeTier` changelist is editable inline: BSR min/max, interval_days.
23. Custom Admin page shows queue health: pending job count, ScraperOps rate limit status (requests remaining).
24. CSV upload available as a custom Admin action on `ScheduledScrapeTarget`.

## API Endpoints

> All endpoints belong to PROJ-7 (UI/API). PROJ-16 provides the background jobs only.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/research/search/` | Triggers Live Research scrape job |
| GET | `/api/research/search/{cache_id}/status/` | Poll job status |

## Models

### AmazonProduct
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| asin | CharField(20) | Unique together with marketplace |
| marketplace | CharField choices [amazon_com, amazon_de, amazon_co_uk, amazon_fr, amazon_it, amazon_es] | |
| title | TextField | |
| brand | CharField(200) | |
| bsr | IntegerField | Current BSR (db_index=True) |
| category | CharField(200) | |
| subcategory | CharField(200) | |
| price | DecimalField(10,2) | |
| rating | FloatField | |
| reviews_count | IntegerField | |
| listed_date | DateField(nullable) | |
| product_type | CharField choices [t_shirt, hoodie, pullover, zip_hoodie, long_sleeve, tank_top, other] | |
| thumbnail_url | URLField | |
| product_url | URLField | |
| seller_name | CharField(200) | |
| feature_bullets | JSONField | List of bullet strings |
| description | TextField | |
| variants | JSONField | Size/color options |
| image_gallery | JSONField | List of image URLs |
| scraped_at | DateTimeField | Last full scrape timestamp |
| keywords | ManyToManyField(Keyword) | |

### Keyword
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| keyword | CharField(200) | Unique together with marketplace |
| marketplace | CharField | |

### ProductSearchCache
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| keyword | ForeignKey(Keyword) | |
| last_scraped_at | DateTimeField(nullable) | |
| status | CharField choices [pending, completed, failed] | |

### BSRSnapshot
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| product | ForeignKey(AmazonProduct, on_delete=CASCADE) | db_index=True |
| bsr | IntegerField | |
| rating | FloatField | |
| price | DecimalField(10,2) | |
| recorded_at | DateTimeField | auto_now_add=True; db_index=True |

### ScrapeTier
| Field | Type | Notes |
|-------|------|-------|
| id | AutoField | PK |
| name | CharField(50) | e.g. "Tier 1", "Tier 2", "Tier 3" |
| bsr_min | IntegerField | Inclusive |
| bsr_max | IntegerField(nullable) | Null = no upper bound |
| interval_days | IntegerField | Scrape every N days |

**Default data (fixture):**
| Tier | BSR min | BSR max | Interval |
|------|---------|---------|----------|
| Tier 1 | 1 | 50,000 | 1 day |
| Tier 2 | 50,001 | 200,000 | 3 days |
| Tier 3 | 200,001 | null | 7 days |

### ScrapeJob
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| mode | CharField choices [live, scheduled, bsr_snapshot] | |
| keyword | ForeignKey(Keyword, nullable) | For keyword-based jobs |
| asin | CharField(20, nullable) | For ASIN-based jobs |
| marketplace | CharField | |
| status | CharField choices [pending, running, completed, failed, cancelled] | |
| pages_total | IntegerField | Max 4 |
| pages_done | IntegerField | |
| products_scraped | IntegerField | |
| error_log | TextField | Failure details |
| started_at | DateTimeField(nullable) | |
| finished_at | DateTimeField(nullable) | |
| rq_job_id | CharField(100) | django-rq job reference |

### ScheduledScrapeTarget
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| keyword | ForeignKey(Keyword, nullable) | |
| asin | CharField(20, nullable) | One of keyword or asin must be set |
| marketplace | CharField | |
| tier | ForeignKey(ScrapeTier) | |
| tier_override | BooleanField | True if tier was manually set via CSV |
| last_scraped_at | DateTimeField(nullable) | |
| next_scrape_at | DateTimeField | Computed on save |
| active | BooleanField | Admin can disable |

## Scraper Architecture

```
UI (PROJ-7)
  └── POST /api/research/search/
        └── django-rq.enqueue(scrape_keyword_job)
              └── Scrapy Spider
                    ├── Search results pages (max 4)
                    ├── Detail pages (per ASIN)
                    ├── ScraperOps SDK (proxy rotation)
                    └── Django ORM
                          ├── AmazonProduct.objects.update_or_create(asin, marketplace)
                          ├── BSRSnapshot.objects.create(...)
                          ├── ScheduledScrapeTarget.objects.get_or_create(...)
                          └── ProductSearchCache.status = completed

django-rq cron (hourly)
  └── schedule_scrape_runner
        └── ScheduledScrapeTarget (where next_scrape_at <= now)
              ├── ASIN target → enqueue(scrape_asin_detail_job)   # detail page only
              └── Keyword target → enqueue(scrape_keyword_job)    # search pages + detail pages
```

## Edge Cases

1. Amazon changes page structure → CSS selector fails → job status=failed; error logged; Admin notified via error_count increment.
2. IP blocked / CAPTCHA detected → retry with backoff (3x); mark failed after 3 attempts; `ScrapeJob.error_log` updated.
3. Same keyword scrape triggered concurrently → `ProductSearchCache` unique constraint prevents duplicate; existing job returned.
4. ASIN in multiple keyword results → `AmazonProduct` updated via `update_or_create`; M2M keyword links added; no duplicate rows.
5. BSR changes tier on re-scrape → `ScheduledScrapeTarget.tier` auto-updated (unless `tier_override=True`); `next_scrape_at` recalculated.
6. ScraperOps API key invalid or quota exceeded → job fails immediately; error logged with HTTP 403/429 status.
7. CSV upload with duplicate ASINs/keywords → idempotent; existing `ScheduledScrapeTarget` updated, not duplicated.
8. ASIN detail page structure differs per marketplace → marketplace-specific CSS selector override applied; if BSR selector fails, job logged as failed with selector error detail.
9. Admin cancels a running job → `ScrapeJob.status=cancelled`; django-rq job stopped via `rq_job_id`.

## Django Admin Views

| Model | Admin Features |
|-------|---------------|
| `ScrapeJob` | List with filters (status, mode, marketplace); custom actions: cancel, retry |
| `ScrapeTier` | Inline editable (bsr_min, bsr_max, interval_days) |
| `ScheduledScrapeTarget` | List with filters; CSV upload action; toggle active |
| Custom Admin Page | Queue health: pending count, ScraperOps quota status |

## Dependencies

- PROJ-4 (Workspace & Membership — worker service / django-rq infrastructure)
- PROJ-7 (Amazon Product Research — API endpoints that trigger scrape jobs)

## Environment Variables Required

```
SCRAPEOPS_API_KEY=        # ScraperOps proxy SDK key
```

## Reference Repositories

- ScraperOps integration: `github.com/python-scrapy-playbook/amazon-python-scrapy-scraper`
- CSS selectors (newer): `github.com/Simple-Python-Scrapy-Scrapers/amazon-scrapy-scraper`
