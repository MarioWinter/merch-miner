# PROJ-16: Amazon Product Scraper — Implementation Tasks

## Phase 1: Foundation (Django App + Models)

### Task 1.1: Create `scraper_app` Django app
- `python manage.py startapp scraper_app`
- Register in `INSTALLED_APPS`
- Create empty `selectors.py`, `tasks.py`
- **AC:** App loads without errors, appears in admin

### Task 1.2: Models — AmazonProduct, Keyword, ProductSearchCache
- All fields per spec (UUID PKs, unique_together, db_index)
- M2M: AmazonProduct ↔ Keyword
- Marketplace choices (6 options)
- Product type choices (t-shirt, hoodie, etc.)
- Migration + migrate
- **AC:** Tables created in `merch_miner` schema, admin can view empty tables

### Task 1.3: Models — BSRSnapshot, ScrapeTier, ScrapeJob, ScheduledScrapeTarget
- BSRSnapshot: FK to AmazonProduct, auto_now_add on recorded_at
- ScrapeTier: AutoField PK, name, bsr_min, bsr_max (nullable), interval_days
- ScrapeJob: UUID PK, all status/progress fields, error_log TextField
- ScheduledScrapeTarget: FK to Keyword (nullable), FK to ScrapeTier, next_scrape_at computed on save
- Migration + migrate
- **AC:** All 7 tables exist, relationships correct

### Task 1.4: Fixture — default ScrapeTier data
- `fixtures/default_tiers.json` with 3 tiers:
  - Tier 1: BSR 1–50,000 → 1 day
  - Tier 2: BSR 50,001–200,000 → 3 days
  - Tier 3: BSR 200,001–null → 7 days
- **AC:** `python manage.py loaddata default_tiers` loads 3 rows

---

## Phase 2: Scrapy Project Setup

### Task 2.1: Create nested `scrapy_app/` project structure
- `scrapy.cfg`, `settings.py`, `items.py`, `pipelines.py`, `spiders/__init__.py`
- **AC:** `scrapy list` (from scrapy_app dir) runs without errors

### Task 2.2: Scrapy settings — ScraperOps SDK integration
- `SCRAPEOPS_API_KEY` from env var (never hardcoded)
- Extension: ScrapeOpsMonitor at 500
- Middleware: ScrapeOps retry at 550, disable default retry, proxy SDK at 725
- `ROBOTSTXT_OBEY = False`
- `CONCURRENT_REQUESTS = 1` (free tier)
- `LOG_LEVEL = 'INFO'`
- **AC:** Settings load without import errors, API key read from env

### Task 2.3: Scrapy Items — AmazonProductItem
- Define all fields matching AmazonProduct model: asin, marketplace, title, brand, bsr, category, subcategory, price, rating, reviews_count, listed_date, product_type, thumbnail_url, product_url, seller_name, feature_bullets, description, variants, image_gallery, keyword, is_sponsored
- **AC:** Item class importable, all fields defined

### Task 2.4: CSS selectors — `selectors.py`
- Dict keyed by marketplace code
- `amazon_com` selectors from Simple-Python-Scrapy-Scrapers repo:
  - Search: product container, title (3 fallbacks), URL (2 fallbacks), price (whole+fraction), rating, pagination
  - Detail: title, price, stars, rating_count, feature_bullets, images (regex), variants (regex), BSR, brand, category
- Placeholder entries for other 5 marketplaces (empty override dict, falls back to US defaults)
- **AC:** `selectors.MARKETPLACE_SELECTORS['amazon_com']` returns full selector dict

---

## Phase 3: Spiders

### Task 3.1: AmazonSearchProductSpider (2-phase: search → detail)
- `start_requests`: build search URL from keyword + marketplace base URL
- `discover_product_urls`: parse search results page, extract ASINs + URLs, follow to detail page. Max 4 pages pagination
- `parse_product_data`: extract all fields from detail page using selectors from `selectors.py`
- Selector error handling: validate critical fields (title, ASIN, BSR). If empty after load → retry (max 3). On 3rd fail → raise with selector name + URL + marketplace in error message
- Pass keyword + marketplace via `meta`
- Yield `AmazonProductItem`
- **AC:** Spider runs against mock/test page, yields correct items. Selector failures logged with identifier.

### Task 3.2: AmazonProductSpider (single ASIN detail)
- `start_requests`: build product URL from ASIN + marketplace
- `parse_product_data`: same extraction logic as Task 3.1 detail phase (shared or inherited)
- Same selector error handling (3 retries, abort with selector name on failure)
- Yield `AmazonProductItem`
- **AC:** Spider runs for single ASIN, yields correct item. Error log identifies failed selector.

### Task 3.3: DjangoORMPipeline
- `open_spider`: call `django.setup()`, import models
- `process_item`:
  1. `AmazonProduct.objects.update_or_create(asin=item['asin'], marketplace=item['marketplace'], defaults={...})`
  2. `Keyword.objects.get_or_create(keyword=..., marketplace=...)` + add M2M
  3. `BSRSnapshot.objects.create(product=product, bsr=..., rating=..., price=...)`
  4. `ScheduledScrapeTarget.objects.get_or_create(...)` — auto-enroll with tier by BSR
  5. Update `ScrapeJob` progress counters (products_scraped++)
- `close_spider`: finalize ScrapeJob status
- **AC:** Pipeline saves to DB correctly, no duplicates on re-run, BSRSnapshot created per item

---

## Phase 4: django-rq Jobs

### Task 4.1: `scrape_keyword_job` function
- Creates/updates ScrapeJob (mode=live or scheduled, status=running)
- Runs `AmazonSearchProductSpider` via `CrawlerProcess`
- On success: ScrapeJob.status=completed, ProductSearchCache.status=completed
- On failure: ScrapeJob.status=failed, error_log populated with selector details
- **AC:** Job enqueues and runs, ScrapeJob status transitions correct

### Task 4.2: `scrape_asin_detail_job` function
- Creates/updates ScrapeJob (mode=scheduled or bsr_snapshot)
- Runs `AmazonProductSpider` via `CrawlerProcess`
- On success: update ScheduledScrapeTarget.last_scraped_at, recalculate next_scrape_at, auto-update tier if BSR changed (unless tier_override=True)
- On failure: same error handling as 4.1
- **AC:** Job enqueues and runs for single ASIN

### Task 4.3: `schedule_scrape_runner` (hourly cron)
- Query `ScheduledScrapeTarget` WHERE `next_scrape_at <= now` AND `active=True`
- For each: enqueue appropriate job (keyword → scrape_keyword_job, ASIN → scrape_asin_detail_job)
- Create ScrapeJob(mode=scheduled) per target
- **AC:** Runner finds due targets, enqueues correct job type

### Task 4.4: Register rqscheduler cron
- Configure `schedule_scrape_runner` in `RQ_QUEUES` or via `rqscheduler` config
- Interval: every 60 minutes
- **AC:** `rqscheduler` runs and triggers hourly function

---

## Phase 5: Django Admin

### Task 5.1: ScrapeJob admin
- List display: keyword/asin, marketplace, mode, status, pages_done/pages_total, products_scraped, error count, started_at, finished_at
- List filters: status, mode, marketplace
- Custom actions: cancel pending job (set status=cancelled), retry failed job (re-enqueue)
- Detail view: show full `error_log` (read-only, with selector failure details)
- **AC:** Admin can view, filter, cancel, retry jobs. Error log shows selector name on failure.

### Task 5.2: ScrapeTier admin
- Inline editable list: name, bsr_min, bsr_max, interval_days
- **AC:** Admin can edit tier ranges without entering detail view

### Task 5.3: ScheduledScrapeTarget admin
- List display: keyword/asin, marketplace, tier, last_scraped_at, next_scrape_at, active
- List filters: marketplace, tier, active
- Custom action: CSV upload (columns: asin or keyword, marketplace, tier)
- Toggle active via list editable
- **AC:** Admin can view targets, upload CSV, toggle active. CSV creates/updates targets idempotently.

### Task 5.4: Queue health custom admin page
- Show: pending job count per queue, last job completed, ScraperOps API key status (configured/missing)
- Link from admin index
- **AC:** Admin can see queue health at a glance

---

## Phase 6: Docker + Config

### Task 6.1: Add `worker-scraper` service to docker-compose
- Same image as `worker`, separate container
- `profiles: ["scale"]` → disabled by default
- Activate: `docker compose --profile scale up worker-scraper`
- **AC:** `docker compose up` starts only 1 worker. `--profile scale` starts both.

### Task 6.2: Add dependencies to requirements.txt
- `scrapy>=2.11`
- `scrapeops-scrapy>=0.5`
- `scrapeops-scrapy-proxy-sdk>=0.5`
- **AC:** `pip install -r requirements.txt` installs all 3 without conflicts

### Task 6.3: Environment variables
- Add `SCRAPEOPS_API_KEY=` to `.env.template`
- Add to `.env` (actual key, not committed)
- **AC:** Spider reads key from env, fails gracefully if missing

---

## Phase 7: Tests

### Task 7.1: Model tests
- Test unique_together constraints (AmazonProduct, Keyword)
- Test ScheduledScrapeTarget.next_scrape_at computation on save
- Test ScrapeTier tier assignment by BSR value
- Test BSRSnapshot creation links to correct product

### Task 7.2: Pipeline tests
- Test update_or_create (new product, existing product update)
- Test M2M keyword linking
- Test BSRSnapshot created per item
- Test ScheduledScrapeTarget auto-enrollment with correct tier

### Task 7.3: Task tests
- Test scrape_keyword_job creates ScrapeJob with correct status transitions
- Test scrape_asin_detail_job updates ScheduledScrapeTarget timestamps
- Test schedule_scrape_runner finds due targets only
- Test selector error logging (mock spider failure, verify error_log content)

### Task 7.4: Admin tests
- Test CSV upload action (valid file, duplicate handling, missing columns)
- Test cancel/retry custom actions
- Test ScrapeJob list filters

---

## Implementation Order

```
Phase 1 (Foundation)  → 1.1 → 1.2 → 1.3 → 1.4
Phase 6 (Docker)      → 6.1 → 6.2 → 6.3        (parallel with Phase 1)
Phase 2 (Scrapy Setup)→ 2.1 → 2.2 → 2.3 → 2.4  (after Phase 1)
Phase 3 (Spiders)     → 3.1 → 3.2 → 3.3         (after Phase 2)
Phase 4 (Jobs)        → 4.1 → 4.2 → 4.3 → 4.4  (after Phase 3)
Phase 5 (Admin)       → 5.1 → 5.2 → 5.3 → 5.4  (after Phase 4)
Phase 7 (Tests)       → 7.1 → 7.2 → 7.3 → 7.4  (parallel with each phase)
```
