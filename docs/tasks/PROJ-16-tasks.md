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

## Phase 8: Search Page Only Spider + MetaKeyword Extraction (Update 2026-03-16)

> New phase added for PROJ-6 Niche Deep Research support. Builds on deployed Phase 1–7.

### Key Technical Decisions (Phase 8)

- **PATCH semantics:** All pipelines switch from `update_or_create` to `get_or_create` + selective field update. Prevents search_page_only from nulling detail data.
- **SearchPageMixin:** Shared search-page logic extracted from `AmazonSearchProductSpider`. Both search spiders inherit it. Pure refactor — no behavior change.
- **MetaKeyword extraction:** Runs in `close_spider()` (not per-item) because global frequency analysis needs all products of the run.
- **Data-basis guard:** MetaKeywords only re-calculated if new data ≥ existing (prevents 5-field → 2-field regression).
- **Keyword extractor improvements over n8n JS:** MBA-specific noun categories, hyphen-split, brand-token separation, light plural stemming, single normalization pass, clean filter pipeline.

### Task 8.1: Models — MetaKeyword + SearchKeywordResult + AmazonProduct update
- `MetaKeyword`: UUID PK, `keyword` CharField(200), `type` CharField choices [short_tail, long_tail], `frequency` IntegerField, `search_keywords` M2M(Keyword). Unique together: keyword + type.
- `SearchKeywordResult`: UUID PK, `search_cache` OneToOne(ProductSearchCache), `top_focus_keywords` JSONField, `top_long_tail_keywords` JSONField, `all_keywords_flat` TextField, `created_at` DateTimeField.
- `AmazonProduct`: add `meta_keywords` M2M(MetaKeyword)
- `ScrapeJob.mode` choices: add `search_page_only`
- Migration
- **AC:** New tables exist. `search_page_only` selectable as ScrapeJob mode. M2M relations work.

### Task 8.2: Selectors — search_page section
- Add `search_page` section to `DEFAULT_SELECTORS` in `selectors.py`
- Search-page-specific selectors (from n8n workflow `00003`):
  - ASIN: `data-csa-c-item-id` attribute regex + `/dp/` URL fallback
  - Title: `h2 aria-label` attr → `h2 a-size-base-plus span` → `h2 a-size-mini span`
  - Brand: `h2 a-size-mini span.a-size-base-plus.a-color-base` → merchant ID
  - Rating: `data-cy=reviews-block span.a-size-small.a-color-base`
  - Reviews: `data-cy=reviews-block span.a-size-mini`
  - Thumbnail: `img.s-image::attr(src)`
  - Sponsored: `/slredirect/` URL pattern
- These use regex on raw HTML (not Scrapy CSS selectors) because search card extraction needs full HTML block per product
- **AC:** `get_selectors('amazon_com')['search_page']` returns all selectors.

### Task 8.3: SearchPageMixin — extract shared search logic
- New `SearchPageMixin` in `spiders/mixins.py` (or separate file `spiders/search_mixins.py`)
- Extract from `AmazonSearchProductSpider`:
  - `_build_search_url()` — marketplace + keyword + product_type_filter params
  - `_parse_search_page()` — product container iteration, pagination, pages_done tracking
  - `_extract_search_card_data()` — ASIN, title, brand, price, rating, reviews, thumbnail, URL, sponsored from search result card
- `AmazonSearchProductSpider` refactored to inherit `SearchPageMixin` + `ProductDetailMixin`
- **AC:** Existing `AmazonSearchProductSpider` tests pass unchanged after refactor. Mixin methods independently testable.

### Task 8.4: AmazonSearchPageSpider
- New spider `amazon_search_page` in `spiders/amazon_search_page.py`
- Inherits `SearchPageMixin`
- `start_requests`: build search URL (same as search+detail spider)
- `parse`: iterate product containers → extract search-card data → yield `AmazonProductItem` directly
  - Detail fields set to None (bsr, bsr_categories, bullets, description, listed_date, image_gallery, variants)
  - `product_type` still auto-detected from title suffix
- Pagination: follow next page up to `max_pages` (default 4)
- `_increment_pages_done()` for progress tracking
- No detail page follow. No `ProductDetailMixin` needed.
- Spider name: `amazon_search_page`
- **AC:** Spider scrapes search pages, yields items with search-level data. Detail fields are None. Pagination works. pages_done tracked.

### Task 8.5: Pipeline — PATCH semantics
- Modify `DjangoORMPipeline._upsert_product()`:
  - Replace `update_or_create(asin, marketplace, defaults={...})` with `get_or_create(asin, marketplace)`
  - Only update fields where item value is not None
  - `product.save(update_fields=[...])` with only changed fields
- Applies to ALL spider modes (not just search_page_only)
- Ensure existing detail data preserved when search_page_only runs after detail scrape
- Ensure full-scrape modes still write all fields correctly
- **AC:** search_page_only after detail scrape → detail fields preserved. Detail scrape after search_page_only → detail fields filled. All existing pipeline tests pass.

### Task 8.6: Pipeline — BSRSnapshot guard
- Modify `_create_bsr_snapshot()`: skip if spider mode is `search_page_only` (BSR not available on search pages)
- Alternative: already handled if bsr is None and snapshot requires non-null BSR
- **AC:** No BSRSnapshot created for search_page_only jobs.

### Task 8.7: `keyword_extractor.py` — MetaKeyword extraction engine
- New module `scraper_app/scrapy_app/keyword_extractor.py`
- **Improvements over n8n JS implementation:**

**Word lists (ported + expanded):**
- `STOPWORDS`: Same as n8n (for, with, the, tshirt, shirt, men, women, colors, sizes...)
- `JUNK_WORDS`: Same as n8n (amp, nbsp, thy, co, stuff...)
- `FUNCTION_WORDS`: Same as n8n (am, is, was, in, on, at...)
- NEW: `MBA_NICHE_NOUNS`: cat, dog, nurse, teacher, dad, mom, grandma, grandpa, firefighter, mechanic, trucker, gamer, baker, farmer, fishing, hunting, camping, yoga, soccer, baseball... (common MBA niche words that fail generic noun heuristic)
- NEW: `MBA_THEME_WORDS`: funny, sarcastic, vintage, retro, cute, kawaii, patriotic, christmas, halloween, birthday, retirement... (theme/emotion words important for MBA)

**Normalization (improved):**
- `normalize_text(text)` — lowercase, strip HTML entities (using `html.unescape()` from stdlib instead of regex), remove parens content, remove special chars except hyphens, collapse whitespace
- Called ONCE per text field, not twice like n8n (tokenizeFocus + tokenizeLong both called normalizeText)

**Hyphen handling (new):**
- "cat-lover" → emit 3 tokens: `["cat-lover", "cat", "lover"]`
- Compound word preserved for long-tail, parts available for short-tail

**Light plural stemming (new):**
- Strip trailing "s" if word > 4 chars and not in exception list (bus, dress, atlas, plus, canvas...)
- "teachers" → "teacher", "gifts" → "gift", "cats" → "cat"
- Prevents frequency splitting between singular/plural
- Strip trailing "es" for words ending in -shes, -ches, -xes, -zes, -ses (dishes → dish, watches → watch)

**Brand-token separation (new):**
- Brand text tokenized separately into `brand_tokens` set
- Brand tokens not excluded, but ranked lower in short-tail output (frequency still counts, but brand-only tokens deprioritized)

**Noun-likelihood heuristic (improved):**
- Same base scoring as n8n (length, suffix, hyphen, frequency)
- NEW: +0.5 if word in `MBA_NICHE_NOUNS` (guaranteed pass)
- NEW: +0.3 if word in `MBA_THEME_WORDS`
- This fixes: "cat" (length 3, no suffix → score 0.0 in n8n) now scores 0.5 → passes threshold

**Clean filter pipeline (improved):**
- `tokenize(text)` → single pass, returns all non-junk tokens
- `filter_short_tail(tokens)` → applies STOPWORDS + noun heuristic
- `filter_long_tail(tokens)` → applies only JUNK_WORDS (STOPWORDS allowed, same as n8n)
- No redundant `isJunkWord` checks inside `isLikelyNoun`

**Public API:**
- `extract_keywords(products, keyword_text)` → returns `{per_product: [...], global_top_focus: [...], global_top_long_tail: [...], all_flat: str}`
- `products` = list of dicts with keys: title, brand, bullet_1, bullet_2, description (all nullable)
- `keyword_text` = search keyword string (for M2M linking context)

- **AC:** Extractor produces short-tail + long-tail keywords. "cat", "nurse", "dad" correctly identified. Plurals merged. Brand tokens separated. Hyphenated words split. Generic words (≥80% doc frequency) excluded.

### Task 8.8: Pipeline — MetaKeyword integration in `close_spider()`
- In `close_spider()`:
  1. Query all `AmazonProduct` records updated in this scrape run (tracked via `products_scraped` list in pipeline)
  2. For each product: apply data-basis guard
     - Has bullet_1/bullet_2/description AND current mode is search_page_only → SKIP
     - Otherwise → extract keywords from available fields
  3. Call `keyword_extractor.extract_keywords(products, keyword_text)`
  4. For each per-product result:
     - `MetaKeyword.objects.get_or_create(keyword=kw, type=type)` → update frequency
     - `product.meta_keywords.set(keyword_objects)` (replace existing M2M links)
  5. For each MetaKeyword: `meta_kw.search_keywords.add(keyword_obj)` (M2M to search Keyword)
  6. Create `SearchKeywordResult` linked to `ProductSearchCache`:
     - `top_focus_keywords` = global top 50 short-tail (frequency > 2)
     - `top_long_tail_keywords` = global top 50 long-tail (frequency > 2)
     - `all_keywords_flat` = comma-separated all keywords
- Track scraped product PKs during `process_item()` for efficient query in `close_spider()`
- **AC:** MetaKeywords created after scrape. M2M links set. SearchKeywordResult has global aggregation. Data-basis guard prevents regression.

### Task 8.9: `scrape_search_page_job` task function
- New function in `tasks.py`
- Same pattern as `scrape_keyword_job`:
  - Takes `keyword_str`, `marketplace`, `scrape_job_id`, `**spider_kwargs`
  - Uses `get_or_create_keyword_cache()` for dedup + 24h cache
  - Sets ScrapeJob status=running, started_at
  - Builds subprocess: `scrapy crawl amazon_search_page -a keyword=... -a marketplace=... -a job_id=...`
  - Passes `product_type_filter` kwargs + `max_items` as spider args
  - Stores PID, monitors subprocess, logs stdout
  - On completion: ScrapeJob → completed, ProductSearchCache → completed
- **AC:** Job enqueues and runs. Dedup + 24h cache works. ScrapeJob tracks progress.

### Task 8.10: Admin updates
- `ScrapeJobAdmin`: `search_page_only` visible in mode filter (automatic from model choices update)
- `MetaKeywordAdmin`: list display (keyword, type, frequency), list filter (type), search (keyword)
- `SearchKeywordResultAdmin`: list display (search_cache, created_at), readonly fields (top_focus_keywords, top_long_tail_keywords, all_keywords_flat)
- `AmazonProductAdmin`: add `meta_keywords` to fieldsets (read-only inline or horizontal filter widget)
- Start/stop/cancel/retry actions: work unchanged for search_page_only (same subprocess pattern)
- **AC:** Admin can view MetaKeywords, SearchKeywordResults. search_page_only jobs manageable via same actions.

### Task 8.11: Tests — keyword extractor
- Test `normalize_text`: HTML entities, parens, special chars, whitespace
- Test `tokenize`: stopwords removed, junk words removed, short words removed
- Test `filter_short_tail`: noun heuristic with MBA words (cat, nurse, dad pass; the, for, shirt fail)
- Test `filter_long_tail`: STOPWORDS allowed (gift, for → kept), JUNK_WORDS removed
- Test plural stemming: teachers→teacher, gifts→gift, bus→bus (exception), dress→dress (exception)
- Test hyphen split: cat-lover → [cat-lover, cat, lover]
- Test brand separation: brand tokens ranked lower
- Test generic word filter: word in ≥80% products excluded
- Test n-gram building: 2-gram and 3-gram correct
- Test `extract_keywords` end-to-end with sample MBA product data

### Task 8.12: Tests — pipeline PATCH + MetaKeyword integration
- Test PATCH: search_page_only after detail → detail fields preserved
- Test PATCH: detail after search_page_only → detail fields filled
- Test PATCH: full scrape writes all fields
- Test data-basis guard: skip MetaKeyword re-calc when search_page_only and product has bullets
- Test MetaKeyword creation + M2M links
- Test SearchKeywordResult created with correct aggregation
- Test MetaKeyword frequency overwritten on re-scrape
- Test MetaKeyword dedup (get_or_create)

### Task 8.13: Tests — search page spider + task
- Test `AmazonSearchPageSpider`: yields items with search-level data, detail fields None
- Test pagination (max_pages respected)
- Test `scrape_search_page_job`: subprocess runs, status transitions correct
- Test dedup + 24h cache via `get_or_create_keyword_cache()`
- Test admin start/stop/cancel for search_page_only jobs

---

## Implementation Order (Updated)

```
Phase 1 (Foundation)  → 1.1 → 1.2 → 1.3 → 1.4           [x] deployed
Phase 6 (Docker)      → 6.1 → 6.2 → 6.3                  [x] deployed
Phase 2 (Scrapy Setup)→ 2.1 → 2.2 → 2.3 → 2.4            [x] deployed
Phase 3 (Spiders)     → 3.0 → 3.1 → 3.2 → 3.3            [x] deployed
Phase 4 (Jobs)        → 4.0 → 4.1 → 4.2 → 4.3 → 4.4      [x] deployed
Phase 5 (Admin)       → 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6 [x] deployed
Phase 7 (Tests)       → 7.1 → 7.2 → 7.3 → 7.4            [x] deployed

Phase 8 (Search Page Only + MetaKeywords):                  [ ] NEW
  8.1 (Models)
  → 8.2 (Selectors) + 8.7 (Keyword Extractor)             (parallel)
  → 8.3 (SearchPageMixin) + 8.5 (Pipeline PATCH)          (parallel)
  → 8.4 (Spider) + 8.6 (BSR guard)                        (parallel, after 8.3)
  → 8.8 (Pipeline MetaKeyword integration)                 (after 8.5 + 8.7)
  → 8.9 (Task function)                                    (after 8.4)
  → 8.10 (Admin)                                           (after 8.1)
  → 8.11 + 8.12 + 8.13 (Tests)                            (parallel with each task)
```

Total: **43 tasks** across 8 phases. Phase 1–7 deployed. Phase 8: 13 new tasks.
