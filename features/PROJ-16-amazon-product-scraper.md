# PROJ-16: Amazon Product Scraper (Scrapy)

**Status:** In Progress
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
7. Admin CSV upload (via custom Django Admin action) — two separate CSV types: **ASIN CSV** (columns: `asin, marketplace, tier`) and **Keyword CSV** (columns: `keyword, marketplace, tier`). Tier column is optional in both.
8. Uploaded ASINs/keywords are added to `ScheduledScrapeTarget`; tier auto-assigned by current BSR if not specified.
9. django-rq cron job (`schedule_scrape_runner`) runs every hour; enqueues due targets based on `ScrapeTier.interval_days` and `last_scraped_at`.
10. Each scrape target re-scraped at its tier interval; if BSR changes tier on next scrape, tier auto-updates.

### BSR History Tracking
11. After every scrape (live or scheduled), a `BSRSnapshot` record is written for each ASIN with current BSR, rating, price, and timestamp.
12. BSR is only available on the product detail page (not in Amazon search results). Daily BSR/Rating/Price snapshots are taken by scraping the ASIN detail page directly — no keyword search required. This is more efficient than a full keyword scrape (1 request per ASIN vs. 4 pages + N detail pages per keyword).
13. BSR snapshots retained indefinitely.

### Scraper Technical
14. ScraperOps SDK used for proxy rotation on all requests; no fallback provider.
15. 3 retry attempts on critical selector failure (title, ASIN); after 3 failures, job marked failed. BSR is non-critical — products without BSR saved with `bsr=NULL`.
16. Failed jobs logged to `ScrapeJob.error_log`; error count visible in Admin.
17. Spider supports all 6 marketplaces: `amazon_com`, `amazon_de`, `amazon_co_uk`, `amazon_fr`, `amazon_it`, `amazon_es`.
18. CSS selectors based on reference repos; marketplace-specific selector overrides supported.
19. `CONCURRENT_REQUESTS` configurable per ScraperOps plan (default 1 for free tier).
20. Scrapy runs via subprocess (not CrawlerProcess) to avoid Twisted reactor crash on repeated calls. `TWISTED_REACTOR = SelectReactor` for Django ORM compatibility.
21. `scrape_job_id` parameter name used (not `job_id` — RQ reserves that name).
22. `scrapy.cfg` lives in Django root `/app/`; `_scrapy_env()` helper sets `PYTHONPATH` and `SCRAPY_SETTINGS_MODULE`.
23. BSR extraction uses 4 fallback formats: `ul.zg_hrsr` (sidebar), product details table, detail bullets, raw regex.
24. `product_type` auto-detected from title suffix (e.g. "Funny Cat T-Shirt" → `t_shirt`).
25. `listed_date` extracted from "Date First Available" field (3 source formats + 4 date format parsers).
26. Boilerplate bullet filtering — common MBA phrases ("Lightweight, classic fit", "Pull on closure", etc.) stripped before storing `bullet_1`/`bullet_2`.
27. `PRODUCT_TYPE_SPIDER_KWARGS` mapping provides per-type `search_index`, `seller_filter`, `hidden_keywords` for MBA-specific search filtering.
28. `max_items` field on ScrapeJob maps to Scrapy's `CLOSESPIDER_ITEMCOUNT` for limiting products per job.

### Django Admin
20. `ScrapeJob` list view shows: keyword/asin, marketplace, mode, product_type_filter, status, progress (pages done/total), max_items, products scraped, error count, start time, end time.
21. Admin actions on `ScrapeJob`: **start pending jobs**, **stop running job** (kills subprocess via PID), cancel pending job, retry failed job. Start action reads `product_type_filter` and passes `PRODUCT_TYPE_SPIDER_KWARGS` + `max_items` to spider. Live Research also stoppable from UI (PROJ-7).
22. `ScrapeTier` changelist is editable inline: BSR min/max, interval_days.
23. Custom Admin page shows queue health: pending job count, running count, completed/failed today, active targets, ScraperOps key status.
24. CSV upload available as a custom Admin action on `ScheduledScrapeTarget`.

## API Endpoints

> All endpoints belong to PROJ-7 (UI/API). PROJ-16 provides the background jobs only.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/research/search/` | Triggers Live Research scrape job |
| GET | `/api/research/search/{cache_id}/status/` | Poll job status |
| POST | `/api/research/search/{cache_id}/cancel/` | Cancel running Live Research (PROJ-7 calls this) |

## Models

### AmazonProduct
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| asin | CharField(20) | Unique together with marketplace, db_index=True |
| marketplace | CharField choices [amazon_com, amazon_de, amazon_co_uk, amazon_fr, amazon_it, amazon_es] | db_index=True |
| title | TextField | |
| brand | CharField(200) | |
| bsr | IntegerField(nullable) | Lowest/primary BSR rank (db_index=True). NULL if BSR not found (non-apparel) |
| bsr_categories | JSONField | List of {rank, category, category_url} — all BSR entries |
| category | CharField(200) | Primary category (from first BSR entry) |
| subcategory | CharField(200) | |
| price | DecimalField(10,2) | |
| rating | FloatField | |
| reviews_count | IntegerField | |
| listed_date | DateField(nullable) | Extracted from "Date First Available" |
| product_type | CharField choices [t_shirt, hoodie, pullover, zip_hoodie, long_sleeve, tank_top, other] | db_index=True. Auto-detected from title suffix |
| thumbnail_url | URLField(max_length=2048) | |
| product_url | URLField(max_length=2048) | |
| seller_name | CharField(200) | |
| bullet_1 | TextField | First real (non-boilerplate) bullet |
| bullet_2 | TextField | Second real (non-boilerplate) bullet |
| description | TextField | |
| variants | JSONField | Size/color options |
| image_gallery | JSONField | List of image URLs |
| scraped_at | DateTimeField(nullable) | Last full scrape timestamp, db_index=True |
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
| mode | CharField choices [live, scheduled, bsr_snapshot] | db_index=True |
| keyword | ForeignKey(Keyword, nullable) | For keyword-based jobs |
| asin | CharField(20) | For ASIN-based jobs (blank default) |
| marketplace | CharField | db_index=True |
| status | CharField choices [pending, running, completed, failed, cancelled] | db_index=True |
| product_type_filter | CharField choices ['', t_shirt, hoodie, pullover, zip_hoodie, long_sleeve, tank_top] | Maps to `PRODUCT_TYPE_SPIDER_KWARGS` for MBA search filtering |
| pages_total | IntegerField | Default 4 |
| max_items | PositiveIntegerField(nullable) | Limits products via `CLOSESPIDER_ITEMCOUNT`. NULL = no limit |
| pages_done | IntegerField | |
| products_scraped | IntegerField | |
| error_log | TextField | Failure details (includes failed selector name, URL, marketplace, response status) |
| pid | IntegerField(nullable) | Subprocess PID for cancellation |
| cancelled_by | CharField(choices=[admin, user], nullable) | Who cancelled the job |
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
| `ScrapeJob` | List with filters (status, mode, marketplace, product_type_filter); actions: start pending, stop running, cancel pending, retry failed. Shows product_type_filter + max_items columns |
| `ScrapeTier` | Inline editable (bsr_min, bsr_max, interval_days) |
| `ScheduledScrapeTarget` | List with filters; CSV upload action; toggle active |
| `AmazonProduct` | List with filters (marketplace, product_type); search by ASIN, title, brand, bullet_1, bullet_2. Fieldsets for bullets/description, media, other |
| `BSRSnapshot` | List display with filters (recorded_at) |
| `Keyword` | List with filters (marketplace); searchable |
| `ProductSearchCache` | List with status filter |
| Custom Admin Page | Queue health: pending/running count, completed/failed today, active targets, ScraperOps key status, Stop All button |

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

---

## Tech Design (Solution Architect)

### System Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Django Admin                          │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ScrapeJob  │  │ScrapeTier    │  │ScheduledScrapeTarget││
│  │list/filter│  │inline edit   │  │CSV upload action   │ │
│  │cancel/retry│ │BSR ranges    │  │toggle active       │ │
│  └──────────┘  └──────────────┘  └────────────────────┘ │
└────────────────────────┬─────────────────────────────────┘
                         │ triggers
                         ▼
┌──────────────────────────────────────────────────────────┐
│                 django-rq (Redis Queue)                  │
│                                                          │
│  Jobs:                                                   │
│  ├── scrape_keyword_job    (Live Research + Scheduled)    │
│  ├── scrape_asin_detail_job (BSR Snapshot + Scheduled)    │
│  └── schedule_scrape_runner (hourly via rqscheduler)      │
│                                                          │
│  Scheduler: rqscheduler (django-rq built-in)             │
└────────────────────────┬─────────────────────────────────┘
                         │ runs inside worker
                         ▼
┌──────────────────────────────────────────────────────────┐
│              Scrapy Spiders (2 spiders)                   │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │ AmazonSearchProductSpider (2-phase combined)     │     │
│  │ Phase 1: Search pages → discover ASINs           │     │
│  │ Phase 2: Follow each ASIN → detail page          │     │
│  │ Used by: Live Research + Keyword Scheduled Scrape │     │
│  └─────────────────────────────────────────────────┘     │
│  ┌─────────────────────────────────────────────────┐     │
│  │ AmazonProductSpider (single ASIN detail)         │     │
│  │ Used by: ASIN Scheduled Scrape + BSR Snapshot     │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
│  ScraperOps SDK (all requests):                          │
│  ├── Proxy rotation + User-agent rotation                │
│  ├── CAPTCHA bypass                                      │
│  └── Monitoring dashboard                                │
│                                                          │
│  Selector Error Handling:                                 │
│  ├── 3 retry attempts per failed selector                │
│  ├── On 3rd fail → abort job, log WHICH selector failed  │
│  └── Error visible in Django Admin ScrapeJob detail       │
└────────────────────────┬─────────────────────────────────┘
                         │ yields items
                         ▼
┌──────────────────────────────────────────────────────────┐
│            Django ORM Pipeline                            │
│                                                          │
│  process_item():                                         │
│  ├── AmazonProduct → update_or_create(asin, marketplace) │
│  ├── Keyword → get_or_create + M2M link                  │
│  ├── BSRSnapshot → create (every scrape)                 │
│  ├── ScheduledScrapeTarget → get_or_create (auto-enroll) │
│  └── ScrapeJob → update progress counters                │
└────────────────────────┬─────────────────────────────────┘
                         │ writes to
                         ▼
┌──────────────────────────────────────────────────────────┐
│          PostgreSQL (merch_miner schema)                  │
└──────────────────────────────────────────────────────────┘
```

### Spider Architecture

| Spider | Trigger | Scrapes | Output |
|--------|---------|---------|--------|
| `AmazonSearchProductSpider` | Live Research, Keyword Scheduled | Search pages (max 4) → follows each ASIN to detail page | Full AmazonProduct + BSRSnapshot |
| `AmazonProductSpider` | ASIN Scheduled, BSR Snapshot | Single product detail page by ASIN | Updated AmazonProduct + BSRSnapshot |

**Why 2 spiders, not 3:** Search-only spider has no use — BSR requires detail page. 2-phase spider covers keyword scrapes; single-ASIN spider covers scheduled re-scrapes efficiently (1 request vs 4 pages + N detail pages).

### Job Flow (3 Modes)

**Mode 1 — Live Research:**
PROJ-7 API → ProductSearchCache(pending) → ScrapeJob(live) → enqueue scrape_keyword_job → AmazonSearchProductSpider → pipeline saves all → ScrapeJob(completed)

**Mode 2 — Scheduled Scrape:**
rqscheduler (hourly) → schedule_scrape_runner → query ScheduledScrapeTarget(next_scrape_at <= now, active) → keyword target: scrape_keyword_job / ASIN target: scrape_asin_detail_job → pipeline saves all → tier auto-updates if BSR changed

**Mode 3 — BSR History:**
Piggybacks on Mode 1 + 2. Pipeline always creates BSRSnapshot after product upsert. No separate job.

### Selector Error Handling

- Each CSS selector extraction is wrapped with validation
- **Critical selectors:** title, ASIN — if empty after page load: retry request (max 3 attempts). After 3 failures: yield `ScrapeErrorItem`, job can fail
- **Non-critical selectors:** BSR, price, rating, bullets — extract what's available, log INFO for missing, no retry. Products without BSR saved with `bsr=NULL`
- BSR extraction uses 4 fallback formats before giving up: `ul.zg_hrsr` (sidebar), product details table, detail bullets, raw regex
- `ScrapeJob.error_log` records: which selector failed, on which URL, which marketplace, response status code
- Django Admin ScrapeJob detail page shows full error log
- Spider logs at WARNING level for each retry, ERROR level for final failure

### Tech Decisions

| Decision | Why |
|----------|-----|
| New Django app `scraper_app` | Clean boundary — PROJ-7 imports from scraper_app, not vice versa |
| Scrapy via subprocess (not CrawlerProcess) | Avoids Twisted reactor crash on repeated calls. django-rq task runs `scrapy crawl` as subprocess. PID stored in ScrapeJob for cancellation. More robust than crochet workaround |
| Django ORM pipeline (not raw psycopg2) | Django owns schema via migrations. Prevents schema drift. update_or_create handles upserts |
| ScraperOps SDK for proxies | Proven in reference repos. Handles rotation, CAPTCHAs, user-agents |
| rqscheduler for hourly cron | django-rq built-in. Simpler than celery-beat. Already have Redis |
| US marketplace first, flexible for expansion | CSS selectors stored in settings dict keyed by marketplace. Defaults = US selectors from reference repo. Add marketplace = add selector dict entry |
| 2 worker containers (1 disabled initially) | worker = active (default queue). worker-scraper = disabled via profiles:["scale"]. Ready for paid ScraperOps plan |
| CSS selectors from Simple-Python-Scrapy-Scrapers repo | More robust fallbacks per field. User can adjust selectors without code changes (settings dict) |
| BSR: 4 fallback formats | `ul.zg_hrsr` → product details table → detail bullets → raw regex. All entries stored in `bsr_categories` JSONField, lowest rank as primary `bsr`. BSR is non-critical (NULL if not found) |
| Job cancellation via PID | All jobs stoppable: Admin (any job) + UI (Live Research via PROJ-7). Subprocess killed via SIGTERM. Status set to cancelled with source tracking |
| `TWISTED_REACTOR = SelectReactor` | Scrapy 2.14+ defaults to AsyncioSelectorReactor which blocks sync DB calls. SelectReactor required for Django ORM in pipelines |
| `scrape_job_id` not `job_id` | RQ reserves `job_id` parameter internally. Using `scrape_job_id` avoids conflict |
| `_scrapy_env()` helper | Sets `PYTHONPATH=/app` and `SCRAPY_SETTINGS_MODULE` so subprocess can import `scraper_app.*` |
| `bullet_1`/`bullet_2` not `feature_bullets` JSONField | Only first 2 non-boilerplate bullets are useful for MBA listings. Simpler than JSONField for querying/display |
| Product type auto-detection | Title suffix mapping (e.g. "T-Shirt" → `t_shirt`). Multi-word types checked first to avoid false matches |
| `PRODUCT_TYPE_SPIDER_KWARGS` | Per-type search params (search_index, seller_filter, hidden_keywords) for MBA-specific Amazon search filtering |
| `max_items` via `CLOSESPIDER_ITEMCOUNT` | Scrapy built-in extension. Cleaner than custom counting logic |

### File Structure

```
django-app/
├── scrapy.cfg                      ← Scrapy config (lives in Django root /app/)
├── scraper_app/                    ← Django app
│   ├── __init__.py
│   ├── apps.py
│   ├── models.py                   ← 7 models + PRODUCT_TYPE_SPIDER_KWARGS mapping
│   ├── admin.py                    ← Admin views, CSV upload, queue health, start/stop/retry actions
│   ├── tasks.py                    ← 4 django-rq job functions + _scrapy_env() helper
│   ├── selectors.py                ← CSS selector dicts per marketplace
│   ├── fixtures/
│   │   └── default_tiers.json      ← ScrapeTier defaults (3 tiers)
│   ├── migrations/
│   ├── scrapy_app/                 ← Scrapy project (nested)
│   │   ├── settings.py             ← ScraperOps config + TWISTED_REACTOR = SelectReactor
│   │   ├── items.py                ← AmazonProductItem + ScrapeErrorItem
│   │   ├── pipelines.py            ← DjangoORMPipeline
│   │   └── spiders/
│   │       ├── __init__.py
│   │       ├── mixins.py           ← ProductDetailMixin (shared extraction logic)
│   │       ├── amazon_search_product.py
│   │       └── amazon_product.py
│   └── tests/
│       ├── test_models.py
│       ├── test_tasks.py
│       ├── test_pipelines.py
│       └── test_admin.py
```

### Docker Changes

```
services:
  worker:           ← existing, handles default queue
  worker-scraper:   ← NEW, same image, handles scraper queue
                      profiles: ["scale"] → disabled by default
                      activate: docker compose --profile scale up worker-scraper
```

### Dependencies (New)

| Package | Purpose |
|---------|---------|
| `scrapy>=2.11` | Spider framework |
| `scrapeops-scrapy>=0.5` | Monitoring + retry middleware |
| `scrapeops-scrapy-proxy-sdk>=0.5` | Proxy rotation, CAPTCHA bypass |

### Environment Variables (New)

| Variable | Purpose |
|----------|---------|
| `SCRAPEOPS_API_KEY` | ScraperOps proxy + monitoring key |

### Integration Points

| From | To | How |
|------|----|-----|
| PROJ-7 API | scraper_app.tasks | django_rq.enqueue() |
| PROJ-7 API | scraper_app.models | Query ProductSearchCache, AmazonProduct |
| PROJ-6 LangGraph | scraper_app.models | Read AmazonProduct for AI analysis |
| PROJ-10 Keyword Bank | scraper_app.models | Auto-populate ScheduledScrapeTarget |

**PROJ-16 has no dependency on PROJ-7** — built and tested independently via Django Admin.

### Marketplace Flexibility

CSS selectors stored in `selectors.py` as dict keyed by marketplace code. Initial implementation: `amazon_com` only with selectors from reference repo. Adding a marketplace = adding a new dict entry with marketplace-specific overrides. Spider reads selectors from this dict based on job's marketplace field.

---

## QA Test Results

**QA Engineer:** Claude Sonnet 4.6
**Date:** 2026-03-15
**Branch:** `feature/PROJ-16-Amazon-Product-Scraper`
**Method:** Static code audit (no running Docker environment available; all findings based on code review, test review, and specification comparison)

---

### Summary

| Category | Result |
|----------|--------|
| Acceptance criteria tested | 28 |
| Passed | 22 |
| Failed | 6 |
| Bugs found | 8 |
| Critical | 0 |
| High | 3 |
| Medium | 3 |
| Low | 2 |
| **Production ready** | **NO** |

---

### Acceptance Criteria Results

#### Live Research Mode

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 1 | POST triggers scrape job, returns cache_id | PARTIAL | No API endpoint implemented in PROJ-16 — spec defers to PROJ-7. Core job creation logic in tasks.py is present. |
| 2 | Spider scrapes up to 4 pages + detail pages, stores full data | PASS | `AmazonSearchProductSpider` 2-phase design is correct. `max_pages` respected. |
| 3 | ASIN linked to keyword via M2M, no duplicates | PASS | `update_or_create(asin, marketplace)` + M2M `add()` in pipeline confirmed. |
| 4 | On completion: cache status=completed, ASINs auto-enrolled | PASS | `tasks.py` and `pipelines.py` both update cache and call `get_or_create` for `ScheduledScrapeTarget`. |
| 5 | Duplicate pending job returns existing cache_id | FAIL | **BUG-01** — No deduplication guard in tasks; duplicate `ScrapeJob` + `ProductSearchCache` records can be created (no unique constraint on `ProductSearchCache` for pending status). |
| 6 | Cache <24h old returns cached results without new scrape | FAIL | **BUG-02** — No 24h cache check exists anywhere in the codebase. This is an API/PROJ-7 concern but is specified in PROJ-16 acceptance criteria and is entirely absent. |

#### Scheduled Scrape Mode

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 7 | Admin CSV upload: separate ASIN CSV and Keyword CSV with correct columns | PASS | Both `_process_asin_csv` and `_process_keyword_csv` implemented with correct column validation. |
| 8 | Tier auto-assigned by BSR if not specified in CSV | FAIL | **BUG-03** — When tier column is absent or empty, code assigns `ScrapeTier.objects.order_by('-bsr_min').first()` (highest BSR = Tier 3 / slowest interval). It should look up BSR of the existing `AmazonProduct` for that ASIN and assign by BSR. For new ASINs with no BSR data yet, fallback to Tier 3 is acceptable, but the spec says "tier auto-assigned by current BSR if not specified." |
| 9 | Hourly cron via `schedule_scrape_runner` enqueues due targets | PASS | Implementation in `tasks.py` + `setup_scheduler.py` management command correct. |
| 10 | BSR-based tier auto-update on re-scrape | PASS | `ScheduledScrapeTarget.update_tier_from_bsr()` + `scrape_asin_detail_job` re-evaluates tier after scrape. |

#### BSR History Tracking

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 11 | BSRSnapshot written after every scrape | FAIL | **BUG-04** — `_create_bsr_snapshot` in `pipelines.py` skips snapshot when `bsr is None`. The spec (AC 11) says "a BSRSnapshot record is written for each ASIN with current BSR, rating, price, and timestamp" after every scrape — including cases where BSR is NULL. Rating and price may still be available. Skipping the snapshot entirely loses rating/price history for non-apparel products. |
| 12 | BSR-only snapshots via ASIN detail page (1 req/ASIN) | PASS | `AmazonProductSpider` confirmed single-ASIN detail page scrape. |
| 13 | BSR snapshots retained indefinitely | PASS | No deletion logic found; model has no retention policy. |

#### Scraper Technical

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| 14 | ScraperOps SDK proxy rotation on all requests | PASS | `DOWNLOADER_MIDDLEWARES` in `scrapy_app/settings.py` includes both monitoring and proxy SDK. |
| 15 | 3 retry attempts on critical selector failure; BSR non-critical | PASS | `parse_product_data` in `mixins.py` checks `retry_count < 3` and yields `ScrapeErrorItem` after 3rd fail. BSR logged at INFO only. |
| 16 | Failed jobs logged to `ScrapeJob.error_log`; error count visible in Admin | PASS | `error_count` property + `_handle_error_item` pipeline method confirmed. |
| 17 | Spider supports all 6 marketplaces | PASS | `MarketplaceChoices` defines all 6; `MARKETPLACE_BASE_URLS` in `selectors.py` covers all 6. |
| 18 | CSS selector overrides supported per marketplace | PASS | `get_selectors()` merges `MARKETPLACE_SELECTORS` overrides over `DEFAULT_SELECTORS`. |
| 19 | `CONCURRENT_REQUESTS` configurable | PASS | `scrapy_app/settings.py` reads `SCRAPY_CONCURRENT_REQUESTS` env var. |
| 20 | Scrapy via subprocess, `TWISTED_REACTOR = SelectReactor` | PASS | Both confirmed in `tasks.py` (subprocess.Popen) and `scrapy_app/settings.py`. |
| 21 | `scrape_job_id` parameter name (not `job_id`) in RQ enqueue calls | FAIL | **BUG-05** — `tasks.py` line 54 passes `job_id` to the spider via `-a job_id={scrape_job_id}` (not `scrape_job_id`). The spec and test `test_enqueue_uses_scrape_job_id_kwarg` confirm the RQ enqueue kwarg must be `scrape_job_id`. The spider `__init__` receives `job_id` as its own parameter — this naming is consistent within the spider but the subprocess `-a` flag passes `job_id=` not `scrape_job_id=`. This is intentional for the spider arg, but the test `test_enqueue_uses_scrape_job_id_kwarg` (for the RQ queue.enqueue call) passes because it checks kwargs on queue.enqueue, which uses `scrape_job_id`. No actual bug here — re-evaluated: PASS. |
| 22 | `scrapy.cfg` at Django root; `_scrapy_env()` helper | PASS | `scrapy.cfg` in `django-app/` root; `_scrapy_env()` in `tasks.py` sets `PYTHONPATH` and `SCRAPY_SETTINGS_MODULE`. |
| 23 | BSR extraction: 4 fallback formats | PASS | `_extract_bsr()` in `mixins.py` implements all 4 formats in order. |
| 24 | `product_type` auto-detected from title suffix | PASS | `_detect_product_type()` with ordered multi-word-first matching confirmed. |
| 25 | `listed_date` extracted from "Date First Available", 3 source formats + 4 date parsers | PASS | `_extract_date_first_available()` covers 3 source formats and 4 `strptime` patterns. |
| 26 | Boilerplate bullet filtering | PASS | `BOILERPLATE_PHRASES` list and filter in `parse_product_data` confirmed. |
| 27 | `PRODUCT_TYPE_SPIDER_KWARGS` per-type search filtering | PASS | Dict in `models.py` with 6 types; used in `admin.py` `start_pending_jobs` and `retry_failed_jobs` actions. |
| 28 | `max_items` maps to `CLOSESPIDER_ITEMCOUNT` | PASS | `tasks.py` line 59-60 adds `-s CLOSESPIDER_ITEMCOUNT={max_items}` when set. |

#### Django Admin

| # | Criterion | Status | Notes |
|---|-----------|--------|-------|
| AC 20 | ScrapeJob list shows all required columns | PASS | `list_display` in `ScrapeJobAdmin` includes all specified fields. |
| AC 21 | Admin actions: start, stop, cancel, retry | PASS | All 4 actions implemented and tested. |
| AC 22 | ScrapeTier inline editable | PASS | `list_editable` on `ScrapeTierAdmin` confirmed. |
| AC 23 | Custom queue health page | PASS | `get_queue_health` view + `queue_health.html` template confirmed. |
| AC 24 | CSV upload action on ScheduledScrapeTarget | PASS | Both ASIN and Keyword CSV upload actions implemented. |

---

### Bug Report

#### BUG-01 — No deduplication guard for concurrent Live Research triggers
**Severity:** High
**Criterion:** AC 5 (Live Research Mode)
**Description:** When `POST /api/research/search/` (PROJ-7) is called twice for the same keyword+marketplace before the first job completes, a second `ScrapeJob` and `ProductSearchCache` record will be created. There is no unique constraint on `ProductSearchCache(keyword, status='pending')` and no check in `scrape_keyword_job` or the pipeline to detect an in-flight job. The spec requires returning the existing `cache_id` in this case.
**Steps to reproduce:**
1. Create a `ProductSearchCache` with `status=pending` for keyword "funny cats" + `amazon_com`.
2. Trigger `scrape_keyword_job` again with same keyword+marketplace.
3. A second `ProductSearchCache` and `ScrapeJob` are created — no deduplication occurs.
**Files:** `django-app/scraper_app/tasks.py`, `django-app/scraper_app/models.py`
**Priority:** Fix before PROJ-7 integration.

---

#### BUG-02 — 24-hour cache check missing
**Severity:** High
**Criterion:** AC 6 (Live Research Mode)
**Description:** The spec requires that if a completed scrape for the same keyword+marketplace is less than 24 hours old, the system should return cached results without triggering a new scrape. No such check exists anywhere in the codebase — not in `tasks.py`, not in a view, nowhere. Every call to `scrape_keyword_job` unconditionally launches a new Scrapy subprocess.
**Steps to reproduce:**
1. Complete a scrape job for "funny cats" + `amazon_com`.
2. Immediately trigger `scrape_keyword_job` again with same inputs.
3. A full new scrape runs despite results being fresh.
**Files:** `django-app/scraper_app/tasks.py`
**Priority:** Fix before PROJ-7 integration.

---

#### BUG-03 — CSV upload assigns fallback tier incorrectly
**Severity:** Medium
**Criterion:** AC 8 (Scheduled Scrape Mode)
**Description:** In `_process_asin_csv` and `_process_keyword_csv`, when no tier is provided in the CSV, the code falls back to `ScrapeTier.objects.order_by('-bsr_min').first()` — this yields the tier with the highest `bsr_min`, i.e., Tier 3 (slowest scrape interval of 7 days). The spec says "tier auto-assigned by current BSR if not specified." For ASINs already in the `AmazonProduct` table, BSR is available and should be used for tier assignment. The fallback to Tier 3 for all new unresearched ASINs is overly aggressive and assigns the slowest tier to potentially high-BSR products.
**Steps to reproduce:**
1. Upload an ASIN CSV with a known ASIN (e.g. `B000N7EPFW`) that has BSR=5000 in `AmazonProduct`, without specifying tier.
2. `ScheduledScrapeTarget` is created with Tier 3 instead of Tier 1.
**Files:** `django-app/scraper_app/admin.py` lines 321, 364
**Priority:** Medium — workaround: specify tier explicitly in CSV.

---

#### BUG-04 — BSRSnapshot skipped when BSR is NULL
**Severity:** Medium
**Criterion:** AC 11 (BSR History Tracking)
**Description:** `DjangoORMPipeline._create_bsr_snapshot()` returns early if `item.get('bsr') is None`. This means products without BSR (non-apparel items) never get a `BSRSnapshot` record, losing rating and price history. The spec says "a BSRSnapshot record is written for each ASIN" after every scrape. Rating and price tracking for non-apparel products is lost entirely.
**Steps to reproduce:**
1. Scrape a product without a BSR (e.g., non-apparel book).
2. Check `BSRSnapshot.objects.filter(product=product)` — count is 0.
3. Rating change or price change is never recorded.
**Files:** `django-app/scraper_app/scrapy_app/pipelines.py` lines 165-173
**Priority:** Medium — only affects non-apparel products, but spec is explicit.

---

#### BUG-05 — `worker-scraper` processes `scraper` queue but all jobs enqueue to `default` queue
**Severity:** High
**Criterion:** AC 9 (Scheduled Scrape Mode), AC 21 (Django Admin)
**Description:** The `worker-scraper` Docker service is configured to consume the `scraper` queue (`python manage.py rqworker scraper`). However, all job enqueue calls in `tasks.py` and `admin.py` use `django_rq.get_queue('default')` — there is no use of the `scraper` queue anywhere. The `worker-scraper` service will sit idle and never process any jobs. All scraper jobs land on the `default` queue and are processed by the `worker` service.
**Steps to reproduce:**
1. Start only `worker-scraper` (with `--profile scale`).
2. Trigger a scrape job from Admin.
3. Job enqueues to `default` queue, `worker-scraper` never picks it up.
**Files:** `django-app/scraper_app/tasks.py` lines 293, 304, 322; `django-app/scraper_app/admin.py` lines 71, 136; `docker-compose.yml` line 37
**Priority:** Fix before enabling `worker-scraper` in production. The separate queue is never used.

---

#### BUG-06 — `ScheduledScrapeTarget.update_tier_from_bsr()` called but not used in pipeline auto-enroll
**Severity:** Low
**Criterion:** AC 10 (Scheduled Scrape Mode — tier auto-update on re-scrape)
**Description:** `ScheduledScrapeTarget` has an `update_tier_from_bsr()` method, but `DjangoORMPipeline._auto_enroll_target()` uses `get_or_create` with hardcoded `defaults`, so it only sets the tier on creation and never updates it on subsequent scrapes. If a product's BSR moves from Tier 2 to Tier 1 on re-scrape, the `ScheduledScrapeTarget` tier is never updated via the pipeline. The `scrape_asin_detail_job` in `tasks.py` does handle tier updates post-scrape, but only for ASIN-based scheduled jobs, not for keyword-based ones (where the pipeline runs).
**Steps to reproduce:**
1. Scrape keyword that finds ASIN with BSR=100,000 (Tier 2). Auto-enrolled with Tier 2.
2. Re-run keyword scrape. BSR now returns 10,000 (Tier 1).
3. `ScheduledScrapeTarget` tier remains Tier 2.
**Files:** `django-app/scraper_app/scrapy_app/pipelines.py` lines 175-187
**Priority:** Low — only affects tier accuracy for keyword-triggered re-scrapes.

---

#### BUG-07 — `scrape_asin_detail_job` does not log stdout on success (asymmetry with keyword job)
**Severity:** Low
**Criterion:** AC 16 (error logging)
**Description:** `scrape_keyword_job` logs stdout and stderr via `logger.info/warning`. `scrape_asin_detail_job` only decodes stderr for the failure path and never logs stdout at all, even for debugging. While not a functional bug, it creates an asymmetry that makes ASIN jobs harder to debug in production.
**Files:** `django-app/scraper_app/tasks.py` lines 185-225
**Priority:** Low.

---

#### BUG-08 — `AmazonSearchProductSpider` pagination only triggered on page=1; pages 3-4 may be skipped if pagination links not found
**Severity:** Medium
**Criterion:** AC 2 (Live Research — max 4 pages)
**Description:** In `discover_product_urls`, pagination is only processed `if page == 1`. The spider extracts all page numbers from page 1 and enqueues them in one pass. If `page_numbers` is empty (Amazon returns no pagination links, which can happen for low-result keywords or on first CAPTCHA-blocked response), `last_page` defaults to 1 and only page 1 is scraped. This is correct behavior for low-result searches, but the lack of any warning or logging when `last_page < self.max_pages` means the admin has no visibility into whether truncation occurred due to no results or a scraping failure.
**Steps to reproduce:**
1. Create a scrape job for a keyword that returns <20 results (single page).
2. `pages_done` stays at 0 (pipeline doesn't increment it), but `pages_total=4`.
3. Progress column shows "0/4" even after successful completion.
**Note:** `pages_done` is never incremented anywhere in the implementation (no code increments it in spider or pipeline). The progress column always shows "0/N".
**Files:** `django-app/scraper_app/scrapy_app/spiders/amazon_search_product.py` lines 102-132, `django-app/scraper_app/scrapy_app/pipelines.py`
**Priority:** Medium — `pages_done` counter is dead code, making the Admin progress column always show 0/4.

---

### Edge Case Test Results

| Edge Case | Status | Notes |
|-----------|--------|-------|
| EC 1: Amazon page structure changes → selector fails → job failed, error logged | PASS | `ScrapeErrorItem` → `_handle_error_item` → `error_log` updated. |
| EC 2: IP blocked / CAPTCHA → 3 retries → mark failed | PASS | Retry logic in `parse_product_data` with `retry_count` meta. |
| EC 3: Same keyword concurrent → no duplicate | FAIL | See BUG-01. |
| EC 4: ASIN in multiple keyword results → `update_or_create`, M2M links added | PASS | Confirmed in pipeline. |
| EC 5: BSR changes tier on re-scrape → tier auto-updated (unless override) | PARTIAL | Works for ASIN jobs (`scrape_asin_detail_job`); not for keyword jobs via pipeline. See BUG-06. |
| EC 6: ScraperOps key invalid/quota → fail immediately | PASS | ScraperOps middleware handles HTTP 403/429; job will fail with non-zero returncode. |
| EC 7: CSV duplicate ASINs/keywords → idempotent update_or_create | PASS | Both processors use `update_or_create`. |
| EC 8: Marketplace-specific selector override on ASIN detail | PASS | `get_selectors()` merges marketplace overrides. |
| EC 9: Admin cancels running job | PASS | `cancel_scrape_job()` sends SIGTERM; `ScrapeJob.status=cancelled`; `cancelled_by` tracked. |

---

### Security Audit

| Check | Result | Detail |
|-------|--------|--------|
| CSV upload: file mime/extension validation | FAIL (Low) | `admin.py` reads the file directly as UTF-8 text after a `UnicodeDecodeError` check but performs no MIME type or file extension validation. A malicious admin could upload a non-CSV file. Impact is low given this is an authenticated Admin-only endpoint. |
| CSV upload: max file size check | FAIL (Low) | No file size limit enforced on the CSV upload. A very large file could cause a memory issue. Low severity given Admin-only access. |
| CSV upload: content injection | PASS | Data is processed by `csv.DictReader` and validated before DB writes. No formula injection possible (all values stored as strings/integers in ORM). |
| Admin endpoints require authentication | PASS | All Admin views wrapped in `self.admin_site.admin_view()` which enforces `is_staff`. |
| `stop_all_jobs` POST endpoint CSRF protection | PASS | Queue health template includes `{% csrf_token %}`. |
| Subprocess command injection via keyword/ASIN | FAIL (Medium) | `scrape_keyword_job` builds the subprocess command by string interpolation: `-a keyword={keyword_str}`. If `keyword_str` contains shell metacharacters (e.g., spaces, semicolons), they are passed as separate list elements to `subprocess.Popen` (which uses a list, not a shell string — `shell=False` by default). This is safe from shell injection. However, there is no validation that `keyword_str` or `asin` don't contain characters that could confuse Scrapy's `-a` argument parsing. **Reclassified: PASS** — `Popen` with a list does not invoke a shell. |
| ASIN validation in CSV upload | PASS | `ASIN_PATTERN = re.compile(r'^[A-Z0-9]{10}$')` enforced. |
| PID-based process kill | PASS (note) | `os.kill(pid, SIGTERM)` is used. If PID is reused by another process (PID recycling), SIGTERM could be sent to a wrong process. This is a known OS-level race condition, low-risk in practice. |
| `SCRAPEOPS_API_KEY` stored in env var | PASS | Key read from environment; not hardcoded; documented in `.env.template`. |
| Secrets in code | PASS | No hardcoded API keys, credentials, or tokens found. |
| `product_url` and `thumbnail_url` stored as URLField | PASS | Max length 2048 enforced; no open redirect concern since these are stored, not redirected to. |

**Additional security note:** The queue health "Stop All" button (`/admin/scraper/stop-all/`) is accessible to any `is_staff` user, not just superusers. Any staff user can stop all running scrape jobs. This matches Django Admin conventions but should be documented.

---

### Regression Testing (Deployed Features)

| Feature | Status | Notes |
|---------|--------|-------|
| PROJ-1 User Auth | PASS | No auth-related code touched in PROJ-16. `CookieJWTAuthentication` unchanged. |
| PROJ-2 Frontend Docker | PASS | `docker-compose.yml` additions (`worker-scraper`) use `profiles: ["scale"]` — not active by default. No impact on existing services. |
| PROJ-3 CI/CD | PASS | No changes to CI/CD pipeline configs found. New test files follow existing patterns. |
| PROJ-4 Workspace & Membership | PASS | `scraper_app` models have no ForeignKey to workspace. No workspace isolation issue introduced (PROJ-16 data is system-wide by design). |
| PROJ-5 Niche List | PASS | No overlap with Niche List models or views. |

---

### Test Coverage Assessment

**Tests present:**
- `test_models.py` — unique constraints, BSR tier assignment, `error_count`, `product_type_filter`, `max_items`, bullets. Good coverage.
- `test_tasks.py` — `_scrapy_env`, `scrape_keyword_job`, `scrape_asin_detail_job`, `cancel_scrape_job`, `schedule_scrape_runner`. Comprehensive with mocked subprocess.
- `test_pipelines.py` — upsert, M2M linking, BSR snapshot, auto-enroll, error handling, progress, bullets, `close_spider`. Good coverage.
- `test_admin.py` — CSV upload (valid, duplicate, missing columns, invalid ASIN), all 4 job actions, queue health page, changelist filters. Good coverage.

**Tests missing or incomplete:**
- No test for BUG-01 (duplicate pending job guard)
- No test for BUG-02 (24h cache check)
- No test for BUG-05 (queue name mismatch between enqueue calls and worker-scraper service)
- No test for `pages_done` counter (BUG-08) — always stays 0
- No test for `setup_scheduler` management command registering duplicate jobs across restarts (the dedup logic uses `job.func_name` which depends on full module path)
- No test for `_detect_product_type` with titles that contain — but don't end with — a product type keyword (e.g., "Hoodie Design T-Shirt" should be `t_shirt`, not `hoodie`)

---

### Production Readiness Decision

**NOT READY for production.**

3 High-severity bugs must be fixed:

1. **BUG-01** — Duplicate job creation on concurrent Live Research triggers (no deduplication guard)
2. **BUG-02** — 24h cache check completely absent
3. **BUG-05** — `worker-scraper` service processes `scraper` queue but all jobs enqueue to `default` queue — the separate worker service is non-functional as designed

Additionally, BUG-08 (pages_done always 0) should be addressed as it renders the Admin progress column meaningless.

---

> Found 8 bugs (3 High, 3 Medium, 2 Low). The developer needs to fix the 3 High bugs before deployment. After fixes, run `/qa` again.
