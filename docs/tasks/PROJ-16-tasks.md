# PROJ-16: Amazon Product Scraper — Implementation Tasks

## Key Technical Decisions (from architecture review)

- **BSR Selector:** 4 fallback formats — `ul.zg_hrsr` (sidebar), product details table, detail bullets, raw regex. Multiple BSR entries per product. All stored in JSONField, lowest rank as primary `bsr`. BSR is non-critical — products without BSR saved with `bsr=NULL`.
- **Twisted Reactor:** `TWISTED_REACTOR = SelectReactor` in Scrapy settings. Subprocess approach — run Scrapy as subprocess via `scrapy crawl` from django-rq task. Avoids Twisted reactor crash on repeated CrawlerProcess calls.
- **CSV Upload:** Two separate CSV types. ASIN CSV: columns `asin, marketplace, tier(optional)`. Keyword CSV: columns `keyword, marketplace, tier(optional)`. Admin selects CSV type before upload.
- **next_scrape_at:** `last_scraped_at + tier.interval_days`. If `last_scraped_at` is null (newly created) → `next_scrape_at = now` (scrape immediately).
- **Search URL Pattern:** `https://www.amazon.com/s?k={encoded_keyword}&page={page_num}`. MBA-specific filters (`search_index`, `seller_filter`, `hidden_keywords`) configurable via `PRODUCT_TYPE_SPIDER_KWARGS` mapping and Admin dropdown.
- **Job Cancellation:** All jobs stoppable from Django Admin AND Live Research stoppable from UI (PROJ-7). Cancel sets `ScrapeJob.status=cancelled` + kills subprocess via PID tracking.
- **Subprocess env:** `_scrapy_env()` helper sets `PYTHONPATH=/app` and `SCRAPY_SETTINGS_MODULE` so subprocess can import `scraper_app.*`. `scrapy.cfg` lives in Django root `/app/`.
- **Parameter naming:** `scrape_job_id` (not `job_id`) to avoid RQ internal conflict.
- **Bullet fields:** `bullet_1`/`bullet_2` TextFields replace `feature_bullets` JSONField. Boilerplate phrases filtered before storage.
- **Product type:** Auto-detected from title suffix. `PRODUCT_TYPE_SPIDER_KWARGS` maps type to MBA search params.
- **max_items:** Maps to Scrapy's `CLOSESPIDER_ITEMCOUNT` for limiting products per job.

---

## Phase 1: Foundation (Django App + Models)

### Task 1.1: Create `scraper_app` Django app [x]
- `python manage.py startapp scraper_app`
- Register in `INSTALLED_APPS`
- Create empty `selectors.py`, `tasks.py`
- **AC:** App loads without errors, appears in admin

### Task 1.2: Models — AmazonProduct, Keyword, ProductSearchCache [x]
- All fields per spec (UUID PKs, unique_together, db_index)
- M2M: AmazonProduct ↔ Keyword
- Marketplace choices (6 options)
- Product type choices (t-shirt, hoodie, etc.)
- AmazonProduct:
  - `bsr` = IntegerField(nullable) — lowest/primary BSR, db_index=True. NULL if not found
  - `bsr_categories` = JSONField — list of `{rank, category, category_url}`
  - `bullet_1` / `bullet_2` = TextField — first 2 non-boilerplate bullets (replaced `feature_bullets` JSONField)
  - `listed_date` = DateField(nullable) — extracted from "Date First Available"
  - `product_type` = CharField with db_index — auto-detected from title suffix
- ProductSearchCache:
  - `scrape_job` = ForeignKey(ScrapeJob, nullable)
- Migration + migrate
- **AC:** Tables created in `merch_miner` schema, admin can view empty tables

### Task 1.3: Models — BSRSnapshot, ScrapeTier, ScrapeJob, ScheduledScrapeTarget [x]
- BSRSnapshot: FK to AmazonProduct, auto_now_add on recorded_at
- ScrapeTier: AutoField PK, name, bsr_min, bsr_max (nullable), interval_days
- ScrapeJob: UUID PK, all status/progress fields, error_log TextField
  - `pid` = IntegerField(nullable) — subprocess PID for cancellation
  - `cancelled_by` = CharField(choices=[admin, user], nullable)
  - `product_type_filter` = CharField(choices) — maps to PRODUCT_TYPE_SPIDER_KWARGS
  - `max_items` = PositiveIntegerField(nullable) — limits via CLOSESPIDER_ITEMCOUNT
- ScheduledScrapeTarget: FK to Keyword (nullable), FK to ScrapeTier
  - `next_scrape_at` logic: on save, if `last_scraped_at` is null → `now()`, else `last_scraped_at + timedelta(days=tier.interval_days)`
- `PRODUCT_TYPE_SPIDER_KWARGS` dict in models.py — per-type search_index, seller_filter, hidden_keywords
- Migration + migrate
- **AC:** All 7 tables exist, relationships correct, next_scrape_at auto-computed

### Task 1.4: Fixture — default ScrapeTier data [x]
- `fixtures/default_tiers.json` with 3 tiers:
  - Tier 1: BSR 1–50,000 → 1 day
  - Tier 2: BSR 50,001–200,000 → 3 days
  - Tier 3: BSR 200,001–null → 7 days
- **AC:** `python manage.py loaddata default_tiers` loads 3 rows

---

## Phase 2: Scrapy Project Setup

### Task 2.1: Create nested `scrapy_app/` project structure [x]
- `scrapy.cfg` (in Django root `/app/`), `settings.py`, `items.py`, `pipelines.py`, `spiders/__init__.py`
- **AC:** `scrapy list` runs without errors

### Task 2.2: Scrapy settings — ScraperOps SDK integration [x]
- `SCRAPEOPS_API_KEY` from env var (never hardcoded)
- Extension: ScrapeOpsMonitor at 500
- Middleware: ScrapeOps retry at 550, disable default retry, proxy SDK at 725
- `ROBOTSTXT_OBEY = False`
- `CONCURRENT_REQUESTS = 1` (free tier, configurable via `SCRAPY_CONCURRENT_REQUESTS` env)
- `LOG_LEVEL = 'INFO'`
- `DOWNLOAD_TIMEOUT = 30`
- `TWISTED_REACTOR = 'twisted.internet.selectreactor.SelectReactor'` — required for Django ORM in pipelines
- **AC:** Settings load without import errors, API key read from env

### Task 2.3: Scrapy Items — AmazonProductItem + ScrapeErrorItem [x]
- AmazonProductItem: asin, marketplace, title, brand, bsr, bsr_categories, category, subcategory, price, rating, reviews_count, listed_date, product_type, thumbnail_url, product_url, seller_name, bullet_1, bullet_2, description, variants, image_gallery, keyword, is_sponsored
- ScrapeErrorItem: failed_selector, url, marketplace, response_status, error_message
- **AC:** Both item classes importable, all fields defined

### Task 2.4: CSS selectors — `selectors.py` [x]
- `DEFAULT_SELECTORS` dict with `search` and `detail` sections
- `MARKETPLACE_SELECTORS` with per-marketplace overrides (empty = inherit defaults)
- `get_selectors(marketplace)` merges defaults + overrides
- `get_base_url(marketplace)` returns marketplace URL
- Detail selectors include:
  - `date_first_available` — product details table selector
  - `date_first_available_bullets` — detail bullets fallback
  - `feature_bullets` — list with 2 fallback selectors
  - `bsr_list` — `ul.zg_hrsr li span.a-list-item`
  - `description` — list with 3 fallback selectors
- **AC:** `get_selectors('amazon_com')` returns full merged dict. `get_base_url('amazon_com')` returns base URL.

---

## Phase 3: Spiders

### Task 3.0: ProductDetailMixin (shared extraction logic) [x]
- `mixins.py` in `spiders/` directory
- Shared `parse_product_data` method used by both spiders
- Extraction helpers: `_extract_price`, `_extract_stars`, `_extract_rating_count`, `_extract_bsr` (4 fallback formats), `_extract_brand`, `_extract_images`, `_extract_variants`, `_extract_date_first_available` (3 source formats), `_detect_product_type` (title suffix mapping)
- Boilerplate bullet filtering via `BOILERPLATE_PHRASES` list
- Critical selectors: title, ASIN (retry 3x). Non-critical: BSR, price, rating, bullets (log INFO, no retry)
- **AC:** Mixin importable by both spiders, all extraction methods tested

### Task 3.1: AmazonSearchProductSpider (2-phase: search → detail) [x]
- `start_requests`: build search URL with optional `search_index`, `seller_filter`, `hidden_keywords` spider args
- `discover_product_urls`: parse search results, extract ASINs + URLs, follow to detail page. Max pages configurable via `max_pages` arg.
- Uses `ProductDetailMixin.parse_product_data` for detail extraction
- Pass keyword + marketplace + job_id via `meta`
- **AC:** Spider runs, yields correct AmazonProductItem. Selector failures yield ScrapeErrorItem.

### Task 3.2: AmazonProductSpider (single ASIN detail) [x]
- `start_requests`: build product URL: `{base_url}/dp/{asin}/`
- Uses `ProductDetailMixin.parse_product_data` for detail extraction
- **AC:** Spider runs for single ASIN, yields correct item.

### Task 3.3: DjangoORMPipeline [x]
- `open_spider`: call `django.setup()`, import models, lookup ScrapeJob by `job_id`
- `process_item`:
  1. If `ScrapeErrorItem` → append to ScrapeJob.error_log, skip DB save, return
  2. `_upsert_product`: `AmazonProduct.objects.update_or_create(asin, marketplace, defaults={...})` — stores `bullet_1`/`bullet_2`, `listed_date`, `product_type`
  3. `_link_keyword`: `Keyword.objects.get_or_create` + M2M add
  4. `_create_bsr_snapshot`: only if `bsr` is not None
  5. `_auto_enroll_target`: `ScheduledScrapeTarget.objects.get_or_create` with tier from BSR
  6. `_update_job_progress`: `products_scraped += 1`
- `close_spider`: finalize ScrapeJob status (completed if products>0, failed if errors+no products)
- **AC:** Pipeline saves to DB correctly, no duplicates on re-run, BSRSnapshot created per item with BSR, errors logged to ScrapeJob

---

## Phase 4: django-rq Jobs + Cancellation

### Task 4.0: `_scrapy_env()` helper [x]
- Build env dict with `SCRAPY_SETTINGS_MODULE=scraper_app.scrapy_app.settings`
- Set `PYTHONPATH` to Django root (`/app`) so subprocess can `import scraper_app.*`
- `SCRAPY_PROJECT_DIR = settings.BASE_DIR` — cwd for subprocess
- **AC:** Subprocess can import scraper_app modules without import errors

### Task 4.1: `scrape_keyword_job` function [x]
- Takes `keyword_str`, `marketplace`, `scrape_job_id` (not `job_id` — RQ conflict), `**spider_kwargs`
- Sets ScrapeJob status=running, started_at
- Builds subprocess cmd with spider args from kwargs
- Pops `max_items` from kwargs → passes as `-s CLOSESPIDER_ITEMCOUNT={max_items}`
- Stores PID in ScrapeJob for cancellation
- On success with 0 products: marks as FAILED with stdout/stderr in error_log
- On success with products: marks as COMPLETED, updates ProductSearchCache
- On failure: logs stderr to error_log
- Uses `_scrapy_env()` for subprocess environment
- **AC:** Job enqueues and runs, ScrapeJob status transitions correct, PID stored while running

### Task 4.2: `scrape_asin_detail_job` function [x]
- Runs `AmazonProductSpider` via subprocess (same pattern as 4.1)
- On success: updates ScheduledScrapeTarget.last_scraped_at, auto-updates tier if BSR changed (unless tier_override)
- **AC:** Job enqueues and runs for single ASIN, PID tracked, tier auto-updated

### Task 4.3: `cancel_scrape_job` function [x]
- Input: `scrape_job_id`, `cancelled_by` (admin or user)
- Running + PID: `os.kill(pid, signal.SIGTERM)` with ProcessLookupError handling
- Pending + rq_job_id: remove from RQ queue
- Sets status=cancelled, cancelled_by, pid=null, finished_at
- Updates linked ProductSearchCache to failed
- **AC:** Running job stops within seconds. Pending job removed from queue. Status updated correctly.

### Task 4.4: `schedule_scrape_runner` (hourly cron) [x]
- Query `ScheduledScrapeTarget` WHERE `next_scrape_at <= now` AND `active=True` with `select_related('keyword', 'tier')`
- For each: enqueue appropriate job type, create ScrapeJob(mode=scheduled)
- Returns enqueued count for logging
- **AC:** Runner finds due targets, enqueues correct job type

### Task 4.5: Register rqscheduler cron
- Configure `schedule_scrape_runner` in RQ scheduler config
- Interval: every 60 minutes
- **AC:** `rqscheduler` runs and triggers hourly function

---

## Phase 5: Django Admin

### Task 5.1: ScrapeJob admin [x]
- List display: target, marketplace, mode, product_type_filter, status, pages (done/total), max_items, products_scraped, error count, started_at, finished_at
- List filters: status, mode, marketplace, product_type_filter
- Readonly fields: id, rq_job_id, pid, error_log, cancelled_by, started_at, finished_at, pages_done, products_scraped
- Custom actions:
  - **Start selected pending jobs** → reads product_type_filter → looks up PRODUCT_TYPE_SPIDER_KWARGS → passes search_index/seller_filter/hidden_keywords + max_pages + max_items to task
  - **Stop running jobs** → calls `cancel_scrape_job(job_id, 'admin')`
  - **Cancel pending jobs** → calls `cancel_scrape_job(job_id, 'admin')`
  - **Retry failed jobs** → creates new ScrapeJob with same params (including product_type_filter + max_items) + enqueues
- **AC:** Admin can create job, select product type, set max_items, start/stop/cancel/retry. Error log shows selector name.

### Task 5.2: ScrapeTier admin [x]
- Inline editable list: name, bsr_min, bsr_max, interval_days
- **AC:** Admin can edit tier ranges without entering detail view

### Task 5.3: ScheduledScrapeTarget admin [x]
- List display: target, marketplace, tier, last_scraped_at, next_scrape_at, active
- List filters: marketplace, tier, active
- List editable: active
- Custom actions: Upload ASIN CSV, Upload Keyword CSV
- CSV upload view with form template
- ASIN validation via regex `^[A-Z0-9]{10}$`
- Tier defaults to highest BSR tier if not specified in CSV
- **AC:** Admin can view targets, upload either CSV type, toggle active.

### Task 5.4: Queue health custom admin page [x]
- Shows: pending count, running count, completed today, failed today, active targets, ScraperOps key configured status
- **Stop All button** — cancels all running + pending jobs
- Registered at `/admin/scraper/queue-health/`
- **AC:** Admin can see queue health at a glance, stop all jobs with one click

### Task 5.5: AmazonProduct admin [x]
- List display: asin, marketplace, title, bsr, price, rating, scraped_at
- List filters: marketplace, product_type
- Search fields: asin, title, brand, bullet_1, bullet_2
- Fieldsets: main fields, Bullets & Description, Media & Links, Other
- **AC:** Admin can browse/search/filter scraped products

### Task 5.6: Other model admins [x]
- BSRSnapshot: list with product, bsr, rating, price, recorded_at; filter by recorded_at
- Keyword: list with keyword, marketplace; filter by marketplace; searchable
- ProductSearchCache: list with keyword, status, last_scraped_at; filter by status
- **AC:** All models manageable via admin

---

## Phase 6: Docker + Config

### Task 6.1: Add `worker-scraper` service to docker-compose [x]
- Same image as `worker`, separate container
- `profiles: ["scale"]` → disabled by default
- Activate: `docker compose --profile scale up worker-scraper`
- **AC:** `docker compose up` starts only 1 worker. `--profile scale` starts both.

### Task 6.2: Add dependencies to requirements.txt [x]
- `scrapy>=2.11`
- `scrapeops-scrapy>=0.5`
- `scrapeops-scrapy-proxy-sdk>=0.5`
- **AC:** `pip install -r requirements.txt` installs all 3 without conflicts

### Task 6.3: Environment variables [x]
- Add `SCRAPEOPS_API_KEY=` to `.env.template`
- Add to `.env` (actual key, not committed)
- **AC:** Spider reads key from env, fails gracefully if missing

---

## Phase 7: Tests

### Task 7.1: Model tests
- Test unique_together constraints (AmazonProduct asin+marketplace, Keyword keyword+marketplace)
- Test ScheduledScrapeTarget.next_scrape_at computation
- Test ScrapeTier tier assignment by BSR value (edge cases)
- Test BSRSnapshot creation links to correct product
- Test AmazonProduct bullet_1/bullet_2 fields
- Test ScrapeJob.error_count property
- Test ScrapeJob.product_type_filter and max_items fields
- Test PRODUCT_TYPE_SPIDER_KWARGS mapping

### Task 7.2: Pipeline tests
- Test update_or_create with bullet_1/bullet_2 (not feature_bullets)
- Test M2M keyword linking
- Test BSRSnapshot created only when bsr is not None
- Test ScheduledScrapeTarget auto-enrollment with correct tier
- Test ScrapeErrorItem handling (error logged, product not created)
- Test _upsert_product stores listed_date, product_type

### Task 7.3: Task tests
- Test scrape_keyword_job with scrape_job_id parameter (not job_id)
- Test max_items passed as CLOSESPIDER_ITEMCOUNT
- Test product_type_filter kwargs passed to spider
- Test _scrapy_env() sets PYTHONPATH and SCRAPY_SETTINGS_MODULE
- Test scrape_keyword_job marks FAILED when 0 products scraped
- Test scrape_asin_detail_job updates ScheduledScrapeTarget tier
- Test schedule_scrape_runner with select_related
- Test cancel_scrape_job: running → cancelled, pending → cancelled

### Task 7.4: Admin tests
- Test ASIN CSV upload (valid, duplicates, missing columns, invalid ASIN)
- Test Keyword CSV upload
- Test start_pending_jobs action with product_type_filter + max_items
- Test retry_failed_jobs preserves product_type_filter + max_items
- Test stop/cancel actions
- Test queue health page renders
- Test AmazonProduct search fields include bullet_1, bullet_2

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

Total: **30 tasks** across 7 phases. Tasks marked [x] are implemented.
