# PROJ-16: Amazon Product Scraper (Scrapy) — Implementation Tasks

## Key Technical Decisions (from architecture review)

- **BSR Selector:** 4 fallback formats. BSR non-critical — NULL allowed.
- **Twisted Reactor:** `SelectReactor`. Subprocess approach for Scrapy from django-rq.
- **CSV Upload:** Two types (ASIN CSV, Keyword CSV). Admin selects type before upload.
- **Search URL:** MBA-specific filters via `PRODUCT_TYPE_SPIDER_KWARGS` mapping.
- **Job Cancellation:** PID tracking, stoppable from Admin + PROJ-7 UI.
- **PATCH semantics:** `get_or_create` + selective field update. Prevents search_page_only from nulling detail data.
- **MetaKeyword extraction:** Runs in `close_spider()`. Data-basis guard prevents regression.
- **Keyword extractor:** MBA-specific nouns, hyphen-split, plural stemming, brand separation.

---

## Phase 1: Foundation (Django App + Models) [DONE]

- [x] Create `scraper_app` Django app, register in `INSTALLED_APPS`
- [x] `AmazonProduct` model: all fields (UUID pk, asin+marketplace unique, bsr nullable, bsr_categories JSON, bullet_1/bullet_2, listed_date, product_type, keywords M2M)
- [x] `Keyword` model: keyword+marketplace unique
- [x] `ProductSearchCache` model: keyword, marketplace, status, scrape_job FK
- [x] `BSRSnapshot` model: FK to AmazonProduct, bsr, rating, price, recorded_at
- [x] `ScrapeTier` model: name, bsr_min, bsr_max (nullable), interval_days
- [x] `ScrapeJob` model: UUID pk, status, mode, product_type_filter, max_items, pid, cancelled_by, error_log, progress fields
- [x] `ScheduledScrapeTarget` model: FK Keyword (nullable), FK ScrapeTier, next_scrape_at auto-computed
- [x] `PRODUCT_TYPE_SPIDER_KWARGS` mapping
- [x] Fixture: 3 default ScrapeTiers
- [x] Migrations applied

---

## Phase 2: Scrapy Project Setup [DONE]

- [x] `scrapy.cfg` in Django root, Scrapy settings, items, pipelines, spiders
- [x] ScraperOps SDK integration (proxy, retry, monitor)
- [x] `TWISTED_REACTOR = SelectReactor`
- [x] `AmazonProductItem` + `ScrapeErrorItem` Scrapy Items
- [x] CSS selectors (`selectors.py`): DEFAULT_SELECTORS + MARKETPLACE_SELECTORS + `get_selectors()` + `get_base_url()`

---

## Phase 3: Spiders [DONE]

- [x] `ProductDetailMixin`: shared extraction (price, stars, BSR 4-fallback, brand, images, variants, date, product_type, boilerplate bullet filter)
- [x] `AmazonSearchProductSpider`: 2-phase (search → detail), pagination, meta passing
- [x] `AmazonProductSpider`: single ASIN detail scrape
- [x] `DjangoORMPipeline`: update_or_create, keyword M2M, BSRSnapshot, auto-enroll target, error handling, job progress

---

## Phase 4: django-rq Jobs + Cancellation [DONE]

- [x] `_scrapy_env()` helper: PYTHONPATH + SCRAPY_SETTINGS_MODULE for subprocess
- [x] `scrape_keyword_job`: subprocess execution, PID tracking, CLOSESPIDER_ITEMCOUNT, status transitions
- [x] `scrape_asin_detail_job`: single ASIN, tier auto-update
- [x] `cancel_scrape_job`: SIGTERM via PID, RQ queue removal, status update
- [x] `schedule_scrape_runner`: hourly cron, enqueues due targets

---

## Phase 5: Django Admin [DONE]

- [x] `ScrapeJob` admin: list view, filters, actions (start/stop/cancel/retry with product_type_filter + max_items)
- [x] `ScrapeTier` admin: inline editable
- [x] `ScheduledScrapeTarget` admin: CSV upload (ASIN + Keyword), ASIN validation
- [x] Queue health custom admin page: counts, Stop All button
- [x] `AmazonProduct` admin: list, filters, search (asin, title, brand, bullet_1, bullet_2)
- [x] BSRSnapshot, Keyword, ProductSearchCache admins

---

## Phase 6: Docker + Config [DONE]

- [x] `worker-scraper` service in docker-compose (profile: scale)
- [x] Dependencies: scrapy, scrapeops-scrapy, scrapeops-scrapy-proxy-sdk in requirements.txt
- [x] `SCRAPEOPS_API_KEY` in .env.template

---

## Phase 7: Tests [DONE]

- [x] Model tests: unique constraints, next_scrape_at, tier assignment, BSRSnapshot, bullet fields, error_count
- [x] Pipeline tests: upsert with bullets, M2M linking, BSRSnapshot guard, auto-enrollment, error handling
- [x] Task tests: scrape_job_id param, max_items, product_type_filter kwargs, _scrapy_env, cancel, schedule_runner
- [x] Admin tests: CSV upload, start/stop/cancel/retry actions, queue health page

---

## Phase 8: Search Page Only Spider + MetaKeyword Extraction [DONE]

- [x] AC-15a-k: `MetaKeyword` model + `SearchKeywordResult` model + `AmazonProduct.meta_keywords` M2M. Migration
- [x] Search page selectors: ASIN, title, brand, price, rating, reviews, thumbnail, sponsored
- [x] `SearchPageMixin`: shared search-page logic extracted from AmazonSearchProductSpider
- [x] `AmazonSearchPageSpider`: search pages only, no detail follow, detail fields None, pagination
- [x] Pipeline PATCH semantics: `get_or_create` + selective field update on ALL modes
- [x] BSRSnapshot guard: skip for search_page_only mode
- [x] `keyword_extractor.py`: MBA noun categories, hyphen-split, plural stemming, brand separation, generic word filter, n-grams
- [x] Pipeline MetaKeyword integration in `close_spider()`: data-basis guard, M2M links, SearchKeywordResult
- [x] `scrape_search_page_job` task function: subprocess, dedup + 24h cache, progress tracking
- [x] Admin updates: MetaKeyword admin, SearchKeywordResult admin, search_page_only in mode filter
- [x] Keyword extractor tests: normalize, tokenize, noun heuristic, plural stemming, hyphen split, generic filter
- [x] Pipeline PATCH tests: search_page_only after detail preserved, detail after search_page fills
- [x] Search page spider + task tests: items correct, pagination, subprocess, dedup

---

## Verification Checklist

- [x] `scraper_app` registered, all migrations applied
- [x] 4 spider modes: live research, search_page_only, scheduled, BSR snapshot
- [x] ScraperOps proxy on all requests
- [x] BSR extraction with 4 fallback formats
- [x] PATCH semantics: search_page_only doesn't overwrite detail data
- [x] MetaKeyword extraction: short-tail + long-tail, MBA nouns, plural stemming
- [x] SearchKeywordResult: top_focus + top_long_tail + all_flat
- [x] Auto-enrollment in ScheduledScrapeTarget
- [x] BSRSnapshot after every detail scrape
- [x] Admin: start/stop/cancel/retry, CSV upload, queue health
- [x] 6 marketplaces supported
- [x] All tests pass, lint clean
