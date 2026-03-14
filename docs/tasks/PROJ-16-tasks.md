# PROJ-16: Amazon Product Scraper — Implementation Tasks

## Key Technical Decisions (from architecture review)

- **BSR Selector:** `ul.zg_hrsr li span.a-list-item` — multiple BSR entries per product (one per category). Parse all, store lowest BSR as primary + full list in JSONField.
- **Twisted Reactor:** Use `subprocess` approach — run Scrapy as a subprocess via `scrapy crawl` command from django-rq task. Avoids Twisted reactor crash on repeated CrawlerProcess calls. More robust than crochet, no reactor state to manage.
- **CSV Upload:** Two separate CSV types. ASIN CSV: columns `asin, marketplace, tier(optional)`. Keyword CSV: columns `keyword, marketplace, tier(optional)`. Admin selects CSV type before upload.
- **next_scrape_at:** `last_scraped_at + tier.interval_days`. If `last_scraped_at` is null (newly created) → `next_scrape_at = now` (scrape immediately).
- **Search URL Pattern:** `https://www.amazon.com/s?k={encoded_keyword}&page={page_num}`. Keyword encoded with `encodeURIComponent` equivalent (spaces as `+`). MBA-specific filters (fashion-novelty, sold by Amazon) configurable but NOT hardcoded — passed as optional spider arguments for flexibility.
- **Job Cancellation:** All jobs (live, scheduled, BSR) stoppable from Django Admin AND Live Research stoppable from UI (PROJ-7). Cancel sets `ScrapeJob.status=cancelled` + kills subprocess via PID tracking.

---

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
- AmazonProduct additions:
  - `bsr` = IntegerField (lowest/primary BSR, db_index=True)
  - `bsr_categories` = JSONField — list of `{rank: int, category: str, category_url: str}` for all BSR entries
- ProductSearchCache additions:
  - `scrape_job` = ForeignKey(ScrapeJob, nullable) — link to active job for cancellation from UI
- Migration + migrate
- **AC:** Tables created in `merch_miner` schema, admin can view empty tables

### Task 1.3: Models — BSRSnapshot, ScrapeTier, ScrapeJob, ScheduledScrapeTarget
- BSRSnapshot: FK to AmazonProduct, auto_now_add on recorded_at
- ScrapeTier: AutoField PK, name, bsr_min, bsr_max (nullable), interval_days
- ScrapeJob: UUID PK, all status/progress fields, error_log TextField
  - Add `pid` = IntegerField(nullable) — subprocess PID for cancellation
  - Add `cancelled_by` = CharField(choices=[admin, user], nullable) — who cancelled
- ScheduledScrapeTarget: FK to Keyword (nullable), FK to ScrapeTier
  - `next_scrape_at` logic: on save, if `last_scraped_at` is null → `now()`, else `last_scraped_at + timedelta(days=tier.interval_days)`
- Migration + migrate
- **AC:** All 7 tables exist, relationships correct, next_scrape_at auto-computed

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
- Define all fields matching AmazonProduct model: asin, marketplace, title, brand, bsr (primary/lowest), bsr_categories (full list), category, subcategory, price, rating, reviews_count, listed_date, product_type, thumbnail_url, product_url, seller_name, feature_bullets, description, variants, image_gallery, keyword, is_sponsored
- **AC:** Item class importable, all fields defined

### Task 2.4: CSS selectors — `selectors.py`
- Dict keyed by marketplace code
- `amazon_com` selectors:
  - **Search page:**
    - Product container: `div.s-result-item[data-component-type=s-search-result]`
    - Title: `h2 a span::text` → `h2 span::text` → `a.a-link-normal span::text` (3 fallbacks)
    - URL: `h2 a::attr(href)` → `a.a-link-normal::attr(href)` (2 fallbacks)
    - Price: `span.a-price-whole::text` + `span.a-price-fraction::text`
    - Rating: `span.a-icon-alt::text`
    - Sponsored: check for `/slredirect/` in URL
    - Pagination: `//*[contains(@class, "s-pagination-item")]/text()`
  - **Detail page:**
    - Title: `#productTitle::text`
    - Price: `span.a-price-whole::text` + `span.a-price-fraction::text` (fallback: `.a-price .a-offscreen::text`)
    - Stars: `i[data-hook=average-star-rating] ::text` → `span.a-icon-alt::text`
    - Rating count: `div[data-hook=total-review-count] ::text`
    - Feature bullets: `#feature-bullets li ::text`
    - Images: regex `colorImages':.*'initial':\s*(\[.+?\])`
    - Variants: regex `dimensionValuesDisplayData"\s*:\s*({.+?})`
    - **BSR: `ul.zg_hrsr li span.a-list-item`** — parse all entries, extract rank (strip `#` and commas → int) + category name (from `<a>` text) + category URL (from `<a>` href)
    - Brand: `#bylineInfo::text` or `a#bylineInfo::text`
    - Category: extracted from BSR category list (first entry)
  - **Marketplace base URLs dict:**
    - `amazon_com` → `https://www.amazon.com`
    - `amazon_de` → `https://www.amazon.de`
    - `amazon_co_uk` → `https://www.amazon.co.uk`
    - `amazon_fr` → `https://www.amazon.fr`
    - `amazon_it` → `https://www.amazon.it`
    - `amazon_es` → `https://www.amazon.es`
- Placeholder entries for other 5 marketplaces (empty override dict, inherits US defaults)
- **AC:** `MARKETPLACE_SELECTORS['amazon_com']` returns full selector dict. `MARKETPLACE_BASE_URLS['amazon_com']` returns base URL.

---

## Phase 3: Spiders

### Task 3.1: AmazonSearchProductSpider (2-phase: search → detail)
- `start_requests`: build search URL: `{base_url}/s?k={encoded_keyword}&page=1`
  - Keyword encoding: spaces → `+`, special chars URL-encoded
  - Optional spider args for MBA filters (not hardcoded): `search_index`, `seller_filter`, `hidden_keywords`
- `discover_product_urls`: parse search results page, extract ASINs + URLs, follow to detail page. Max 4 pages pagination.
- `parse_product_data`: extract all fields from detail page using selectors from `selectors.py`
  - **BSR extraction:** parse `ul.zg_hrsr li span.a-list-item` — for each `<li>`: extract rank number (strip `#`, commas → int), category name (from `<a>` text), category URL (from `<a>` href). Store all as `bsr_categories` list. Set `bsr` field = lowest rank value.
- **Selector error handling:**
  - Critical selectors: title, ASIN, BSR
  - If critical selector returns empty: log WARNING with `{selector_name: "...", url: "...", marketplace: "...", attempt: N}`
  - Retry request (max 3, `dont_filter=True`)
  - On 3rd fail: log ERROR, yield special error item with `{failed_selector: name, url, marketplace, response_status, response_body_snippet}`
  - Non-critical selectors (price, rating, bullets): extract what's available, log INFO for missing, don't retry
- Pass keyword + marketplace + scrape_job_id via `meta`
- Yield `AmazonProductItem`
- **AC:** Spider runs against mock/test page, yields correct items. Selector failures logged with selector name.

### Task 3.2: AmazonProductSpider (single ASIN detail)
- `start_requests`: build product URL: `{base_url}/dp/{asin}/`
- `parse_product_data`: same extraction logic as Task 3.1 detail phase (shared via mixin or base class)
- Same selector error handling (3 retries, abort with selector name on failure)
- Yield `AmazonProductItem`
- **AC:** Spider runs for single ASIN, yields correct item. Error log identifies failed selector.

### Task 3.3: DjangoORMPipeline
- `open_spider`: call `django.setup()`, import models
- `process_item`:
  1. If error item → append to ScrapeJob.error_log, skip DB save, return
  2. `AmazonProduct.objects.update_or_create(asin=item['asin'], marketplace=item['marketplace'], defaults={...})`
     - `bsr` = lowest rank from `bsr_categories`
     - `bsr_categories` = full list as JSON
  3. `Keyword.objects.get_or_create(keyword=..., marketplace=...)` + add M2M
  4. `BSRSnapshot.objects.create(product=product, bsr=product.bsr, rating=..., price=...)`
  5. `ScheduledScrapeTarget.objects.get_or_create(asin=..., marketplace=...)` — auto-enroll, tier assigned by BSR lookup against ScrapeTier ranges
  6. Update `ScrapeJob.products_scraped += 1`
- `close_spider`: finalize ScrapeJob status (completed or failed based on error count)
- **AC:** Pipeline saves to DB correctly, no duplicates on re-run, BSRSnapshot created per item, errors logged to ScrapeJob

---

## Phase 4: django-rq Jobs + Cancellation

### Task 4.1: `scrape_keyword_job` function
- Creates/updates ScrapeJob (mode=live or scheduled, status=running)
- Runs `AmazonSearchProductSpider` via **subprocess**: `subprocess.Popen(['scrapy', 'crawl', 'amazon_search_product', '-a', 'keyword=...', '-a', 'marketplace=...', '-a', 'job_id=...'])`
- Store subprocess PID in `ScrapeJob.pid`
- Wait for subprocess completion, capture exit code
- On success: ScrapeJob.status=completed, ProductSearchCache.status=completed, pid=null
- On failure: ScrapeJob.status=failed, error_log populated from spider log output
- **AC:** Job enqueues and runs, ScrapeJob status transitions correct, PID stored while running

### Task 4.2: `scrape_asin_detail_job` function
- Creates/updates ScrapeJob (mode=scheduled or bsr_snapshot)
- Runs `AmazonProductSpider` via subprocess (same pattern as 4.1)
- Store PID in ScrapeJob.pid
- On success: update ScheduledScrapeTarget.last_scraped_at, recalculate next_scrape_at, auto-update tier if BSR changed (unless tier_override=True)
- On failure: same error handling as 4.1
- **AC:** Job enqueues and runs for single ASIN, PID tracked

### Task 4.3: `cancel_scrape_job` function
- Input: `scrape_job_id`, `cancelled_by` (admin or user)
- Lookup ScrapeJob, check status is running or pending
- If running + PID exists: `os.kill(pid, signal.SIGTERM)` to stop subprocess
- If pending: remove from RQ queue via `rq_job_id`
- Set ScrapeJob.status=cancelled, cancelled_by={source}, pid=null
- If Live Research: also set ProductSearchCache.status=failed
- **AC:** Running job stops within seconds. Pending job removed from queue. Status updated correctly.

### Task 4.4: `schedule_scrape_runner` (hourly cron)
- Query `ScheduledScrapeTarget` WHERE `next_scrape_at <= now` AND `active=True`
- For each: enqueue appropriate job (keyword → scrape_keyword_job, ASIN → scrape_asin_detail_job)
- Create ScrapeJob(mode=scheduled) per target
- **AC:** Runner finds due targets, enqueues correct job type

### Task 4.5: Register rqscheduler cron
- Configure `schedule_scrape_runner` in RQ scheduler config
- Interval: every 60 minutes
- **AC:** `rqscheduler` runs and triggers hourly function

---

## Phase 5: Django Admin

### Task 5.1: ScrapeJob admin
- List display: keyword/asin, marketplace, mode, status, pages_done/pages_total, products_scraped, error count, started_at, finished_at
- List filters: status, mode, marketplace
- Custom actions:
  - **Stop running job** → calls `cancel_scrape_job(job_id, cancelled_by='admin')`
  - **Cancel pending job** → calls `cancel_scrape_job(job_id, cancelled_by='admin')`
  - **Retry failed job** → re-enqueue with same parameters
- Detail view: show full `error_log` (read-only, with selector failure details — which selector, which URL, which marketplace, response status)
- **AC:** Admin can view, filter, stop, cancel, retry jobs. Error log shows selector name on failure.

### Task 5.2: ScrapeTier admin
- Inline editable list: name, bsr_min, bsr_max, interval_days
- **AC:** Admin can edit tier ranges without entering detail view

### Task 5.3: ScheduledScrapeTarget admin
- List display: keyword/asin, marketplace, tier, last_scraped_at, next_scrape_at, active
- List filters: marketplace, tier, active
- Custom actions:
  - **Upload ASIN CSV** — columns: `asin, marketplace, tier(optional)`
  - **Upload Keyword CSV** — columns: `keyword, marketplace, tier(optional)`
  - Both: validate format, get_or_create targets, assign tier by BSR if not specified
- Toggle active via list editable
- **AC:** Admin can view targets, upload either CSV type, toggle active. CSV creates/updates targets idempotently.

### Task 5.4: Queue health custom admin page
- Show: pending job count per queue, running jobs with elapsed time, last job completed, ScraperOps API key status (configured/missing)
- **Stop All button** — cancels all running + pending scrape jobs
- Link from admin index
- **AC:** Admin can see queue health at a glance, stop all jobs with one click

---

## Phase 6: Docker + Config

### Task 6.1: Add `worker-scraper` service to docker-compose
- Same image as `worker`, separate container
- `profiles: ["scale"]` → disabled by default
- Command: `python manage.py rqworker scraper` (separate queue name)
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
- Test unique_together constraints (AmazonProduct asin+marketplace, Keyword keyword+marketplace)
- Test ScheduledScrapeTarget.next_scrape_at computation: null last_scraped_at → now, with last_scraped_at → last_scraped_at + interval
- Test ScrapeTier tier assignment by BSR value (edge cases: BSR=50000 → Tier 1, BSR=50001 → Tier 2, BSR=200001 → Tier 3)
- Test BSRSnapshot creation links to correct product
- Test AmazonProduct.bsr_categories JSONField stores multiple BSR entries correctly

### Task 7.2: Pipeline tests
- Test update_or_create (new product, existing product update — fields overwritten)
- Test M2M keyword linking (product linked to multiple keywords)
- Test BSRSnapshot created per item (count increases)
- Test ScheduledScrapeTarget auto-enrollment with correct tier
- Test error item handling (error logged to ScrapeJob, product not created)
- Test BSR parsing: lowest rank from bsr_categories stored as primary bsr

### Task 7.3: Task tests
- Test scrape_keyword_job creates ScrapeJob with correct status transitions (pending → running → completed/failed)
- Test scrape_asin_detail_job updates ScheduledScrapeTarget timestamps + tier
- Test schedule_scrape_runner finds due targets only (not future, not inactive)
- Test cancel_scrape_job: running → cancelled (PID killed), pending → cancelled (removed from queue)
- Test selector error logging (mock spider failure, verify error_log contains selector name + URL)

### Task 7.4: Admin tests
- Test ASIN CSV upload (valid file, duplicate handling, missing columns, invalid ASIN format)
- Test Keyword CSV upload (valid file, duplicate handling)
- Test stop/cancel/retry custom actions on ScrapeJob
- Test ScrapeJob list filters
- Test queue health page renders without errors

---

## Implementation Order

```
Phase 1 (Foundation)  → 1.1 → 1.2 → 1.3 → 1.4
Phase 6 (Docker)      → 6.1 → 6.2 → 6.3              (parallel with Phase 1)
Phase 2 (Scrapy Setup)→ 2.1 → 2.2 → 2.3 → 2.4        (after Phase 1)
Phase 3 (Spiders)     → 3.1 → 3.2 → 3.3               (after Phase 2)
Phase 4 (Jobs)        → 4.1 → 4.2 → 4.3 → 4.4 → 4.5  (after Phase 3)
Phase 5 (Admin)       → 5.1 → 5.2 → 5.3 → 5.4         (after Phase 4)
Phase 7 (Tests)       → 7.1 → 7.2 → 7.3 → 7.4         (parallel with each phase)
```

Total: **27 tasks** across 7 phases.
