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
- **Sort Selection (2026-03-29):** Amazon `s` param stored as CharField string (not enum int). 7 choices incl. Best Sellers, Featured, Newest.
- **Browse Node:** Default per product_type in `PRODUCT_TYPE_SPIDER_KWARGS`, user-overridable. Override takes precedence.
- **Cache Key Extension:** sort_by + price_min + price_max + browse_node included in dedup + 24h cache lookup. Different combos = separate cache.
- **Pages Total:** Max 400 (Amazon's practical limit). Default stays 2.

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
- [ ] **PROJ-10 cross-ref (AC-9d):** `AmazonSearchProductSpider` should extract result count from Page 2 HTML (`div.sg-col-inner h2 span` → parse "X-Y of **N** results for" → extract N) and upsert `keyword_app.KeywordProductCount` as side-effect during product scraping. No extra request needed — data captured from existing search pages

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

## Verification Checklist (Phase 1–8)

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

---

## Phase 9: Sort Selection & Pre-filtered Scraping — Models + Migration

- [x] Add `ScrapeJob.SortBy` TextChoices: `''` (Relevance), `exact-aware-popularity-rank` (Best Sellers), `featured-rank` (Featured), `date-desc-rank` (Newest), `price-asc-rank` (Price Low→High), `price-desc-rank` (Price High→Low), `review-rank` (Avg Review)
- [x] Add `ScrapeJob.sort_by` CharField(50, choices=SortBy, blank=True, default='')
- [x] Add `ScrapeJob.price_min` DecimalField(10,2, null=True, blank=True)
- [x] Add `ScrapeJob.price_max` DecimalField(10,2, null=True, blank=True)
- [x] Add `ScrapeJob.browse_node` CharField(20, blank=True, default='')
- [x] Add `ScrapeJob.pages_total` max validator (MaxValueValidator(400))
- [x] Add `ProductSearchCache.sort_by` CharField(50, blank=True, default='')
- [x] Add `ProductSearchCache.price_min` DecimalField(10,2, null=True, blank=True)
- [x] Add `ProductSearchCache.price_max` DecimalField(10,2, null=True, blank=True)
- [x] Add `ProductSearchCache.browse_node` CharField(20, blank=True, default='')
- [x] Add `ProductSearchCache.Status.CANCELLED` choice + migration 0012
- [x] Expand `AmazonProduct.ProductType` from 6 to 15 MBA types + OTHER (remove `pullover`, add `premium_shirt`, `comfort_colors`, `v_neck`, `raglan`, `sweatshirt`, `performance_polo`, `popsocket`, `phone_case`, `tote_bag`, `tumbler`, `ceramic_mug`)
- [x] Expand `ScrapeJob.ProductTypeFilter` to mirror new types (15 + ALL)
- [x] Replace `PRODUCT_TYPE_SPIDER_KWARGS` with all 15 entries using real Amazon URL params (search_index, browse_node, hidden_keywords, seller_filter per type)
- [x] Update `RESEARCH_PRODUCT_TYPE_CHOICES` in `niche_research_app` serializers
- [x] Update `_detect_product_type()` mappings in spiders (pullover → sweatshirt)
- [x] Update tests for new product type choices
- [x] Create + apply migrations (0009 sort/filter fields, 0010 product type choices, 0011 start_page, 0012 cancelled status)
- [x] Verify existing data unaffected (new fields have defaults/nullable; orphaned `pullover` values acceptable in dev)

---

## Phase 10: Spider URL Builder + Spider Init

- [x] Update `SearchPageMixin._build_search_url()`: append `&s={sort_by}` when not empty
- [x] Update `SearchPageMixin._build_search_url()`: append `&low-price={price_min}` when set
- [x] Update `SearchPageMixin._build_search_url()`: append `&high-price={price_max}` when set
- [x] Update `SearchPageMixin._build_search_url()`: append `&bbn={browse_node}` when set
- [x] Handle empty keyword: if `self.keyword` is empty, omit `&k=` param (browse-node-only scrape)
- [x] `AmazonSearchProductSpider.__init__`: accept `sort_by`, `price_min`, `price_max`, `browse_node` args (default to empty/None)
- [x] `AmazonSearchPageSpider.__init__`: accept `sort_by`, `price_min`, `price_max`, `browse_node` args (default to empty/None)
- [x] Verify URL output for all combinations: sort only, price only, browse_node only, all combined, none set

---

## Phase 11: Task Functions + Cache Key (extend existing — NO new functions)

> `get_or_create_keyword_cache()` exists at `scraper_app/tasks.py:37`.
> `scrape_keyword_job()` exists at `scraper_app/tasks.py:67`.
> `scrape_search_page_job()` exists at `scraper_app/tasks.py`.
> All changes are param additions + filter extensions.

- [x] Extend `get_or_create_keyword_cache()` signature: add `sort_by='', price_min=None, price_max=None, browse_node=''` params
- [x] Extend pending cache lookup filter: include `sort_by`, `price_min`, `price_max`, `browse_node`
- [x] Extend fresh cache lookup filter: include `sort_by`, `price_min`, `price_max`, `browse_node`
- [x] Extend `ProductSearchCache.objects.create()` calls: pass new fields
- [x] Extend `scrape_keyword_job()`: pass `sort_by`, `price_min`, `price_max`, `browse_node` as spider `-a` args
- [x] Extend `scrape_search_page_job()`: same passthrough
- [x] Handle `browse_node` auto-population: if not explicitly passed but `product_type_filter` set → get from `PRODUCT_TYPE_SPIDER_KWARGS`

---

## Phase 12: API Serializer + View (extend existing — NO new endpoints)

> `LiveSearchSerializer` exists at `research_app/api/serializers.py:22`.
> `LiveSearchView` + `SearchStatusView` exist at `research_app/api/views.py`.
> `get_or_create_keyword_cache()` exists at `scraper_app/tasks.py:37`.
> All changes are field additions to existing code.

- [x] Extend `LiveSearchSerializer`: add `sort_by` ChoiceField (optional, choices from ScrapeJob.SortBy, default='')
- [x] Extend `LiveSearchSerializer`: add `price_min` DecimalField (optional, nullable)
- [x] Extend `LiveSearchSerializer`: add `price_max` DecimalField (optional, nullable)
- [x] Extend `LiveSearchSerializer`: add `browse_node` CharField (optional, max_length=20, default='')
- [x] Extend `LiveSearchSerializer`: add `pages_total` IntegerField (optional, min=1, max=400, default=2)
- [x] Extend `LiveSearchSerializer`: cross-field validation — if both price_min and price_max set, price_min < price_max
- [x] Extend `LiveSearchView.post()`: pass new params to existing `get_or_create_keyword_cache()`
- [x] Extend `LiveSearchView.post()`: pass new params to existing `ScrapeJob.objects.create()`
- [x] Extend `LiveSearchView.post()`: pass `sort_by`, `price_min`, `price_max`, `browse_node` in spider_kwargs
- [x] Extend `LiveSearchView.post()`: browse_node override logic — if explicitly set in request, use it; else fall back to PRODUCT_TYPE_SPIDER_KWARGS default
- [x] Extend `SearchStatusView`: include `sort_by`, `price_min`, `price_max`, `browse_node` in status response (for UI display)

---

## Phase 13: Django Admin

- [x] `ScrapeJobAdmin.list_display`: add `sort_by`, `browse_node`
- [x] `ScrapeJobAdmin.list_filter`: add `sort_by`
- [x] `ScrapeJobAdmin` fieldsets: add `sort_by`, `price_min`, `price_max`, `browse_node` to creation/edit form
- [x] `start_pending_jobs` admin action: pass new fields as spider_kwargs
- [x] `retry_failed_jobs` admin action: pass new fields as spider_kwargs
- [x] `ProductSearchCacheAdmin`: show `sort_by`, `price_min`, `price_max`, `browse_node` in list_display

---

## Phase 14: Tests — Sort Selection & Pre-filtered Scraping

- [x] Model tests: ScrapeJob with sort_by/price_min/price_max/browse_node, pages_total max validator
- [x] Model tests: ProductSearchCache with extended cache key fields
- [x] URL builder tests: `_build_search_url()` with sort_by → verify `&s=` in URL
- [x] URL builder tests: price_min + price_max → verify `&low-price=` + `&high-price=` in URL
- [x] URL builder tests: browse_node → verify `&bbn=` in URL
- [x] URL builder tests: empty keyword + browse_node → verify no `&k=` in URL
- [x] URL builder tests: all params combined → verify complete URL
- [x] URL builder tests: no new params set → verify URL unchanged from before (backwards compat)
- [x] Task tests: `get_or_create_keyword_cache()` with different sort_by → separate cache entries
- [x] Task tests: same keyword + same sort_by → cache hit (dedup works)
- [x] Task tests: `scrape_keyword_job()` passes new args to subprocess command
- [x] Serializer tests: LiveSearchSerializer validates price_min < price_max
- [x] Serializer tests: LiveSearchSerializer rejects price_min > price_max
- [x] Serializer tests: LiveSearchSerializer accepts sort_by choices, rejects invalid
- [x] Serializer tests: pages_total max 400 accepted, 401 rejected
- [x] View tests: LiveSearchView creates ScrapeJob + ProductSearchCache with new fields
- [x] View tests: browse_node override (explicit) takes precedence over PRODUCT_TYPE_SPIDER_KWARGS default
- [x] Admin tests: start/retry actions pass sort_by + browse_node to spider_kwargs
- [x] Lint clean: `ruff check django-app/`

---

## Phase 15: Frontend — Sort Selection, Product Types, Infinite Scroll, Cancel (PROJ-7)

### Sort & Product Type Dropdowns
- [x] Sort dropdown visible in BOTH Live and DB mode (Live=Amazon sort, DB=local sort)
- [x] Live Sort default: `featured-rank` (Featured)
- [x] Sort dropdown with MUI icons per option (EmojiEvents, Star, NewReleases, TrendingDown/Up, Reviews)
- [x] Product Type dropdown expanded to 16 MBA types with custom SVG icons
- [x] 10 new SVG icons: PremiumShirt, ComfortColors, VNeck, Raglan, Sweatshirt, PerformancePolo, PopSocket, PhoneCase, ToteBag, Tumbler, CeramicMug
- [x] Removed `pullover`, replaced with `sweatshirt`

### Hardcoded Defaults (not exposed in UI)
- [x] `price_min: 13`, `price_max: 100` — sent to API, not shown in UI
- [x] `browse_node` — auto from `PRODUCT_TYPE_BROWSE_NODES[product_type]`, not shown in UI
- [x] `pages_total: 1` — always 1 per job (Infinite Scroll handles pagination)

### Infinite Scroll (Live Mode)
- [x] `currentPage` state (starts at 1, increments on scroll)
- [x] `allLiveProducts` accumulates products across pages (dedupe by ASIN)
- [x] IntersectionObserver on sentinel div at bottom of product list
- [x] Next page triggered ONLY when: previous job `completed` + `canLoadMore` + not polling
- [x] New keyword search resets page to 1 + clears accumulated products
- [x] `start_page` passed to API per job

### Cancel / Stop
- [x] Backend: `POST /api/research/search/{cache_id}/cancel/` endpoint (SearchCancelView)
- [x] Backend: `cancel_scrape_job()` sets `ProductSearchCache.status=cancelled` (not `failed`)
- [x] Frontend: `cancelled` added to `ProductSearchStatus` type + `TERMINAL_STATUSES`
- [x] Frontend: `cancelLiveSearch` mutation in researchSlice
- [x] Search button becomes red "Stop" button when live search is running
- [x] Stop click: cancels job → `setCacheId(null)` → polling stops → UI resets to initial state
- [x] LiveProgressBanner returns `null` on `cancelled` (no error message shown)
- [x] usePolling returns empty state when `cacheId` is null (no stale status)

### Skeleton Cards (Live Progress)
- [x] Removed LinearProgress bar from LiveProgressBanner
- [x] Removed separate Stop button from LiveProgressBanner
- [x] Shows 8 skeleton cards (wave animation) during pending/running
- [x] Skeleton count reduces as real products load (`productsScraped - loadedCount`)

### Search Button UX
- [x] Search button disabled when keyword empty (Live mode)
- [x] Disabled state uses `primary.dark` with 0.5 opacity (stays red, darker)

### Redux & API
- [x] `LiveSearchParams` extended: `sort_by`, `price_min`, `price_max`, `browse_node`, `pages_total`, `start_page`
- [x] `cancelLiveSearch` mutation added to researchSlice
- [x] `PRODUCT_TYPE_BROWSE_NODES` mapping in types (mirrors backend)

### Build Fixes (pre-existing)
- [x] `ProductDetail.bsr_categories` type conflict resolved
- [x] `CollectedProductsSection` useRef init value added
- [x] `SparkLineChart` `colors` → `color` (string, not array)
- [x] `hideLegend` prop for MUI Charts (replaces `legend.hidden`)
- [x] `background.elevated` → `background.paper`
- [x] SearchBar test: added missing props

### Tests
- [x] ControlsRow: sort dropdown in both modes, product types, API param dispatch
- [x] Build clean: 0 TypeScript errors

---

## Phase 16: Start Page Support

- [x] `ScrapeJob.start_page` PositiveIntegerField(default=1, MinValueValidator(1))
- [x] Migration: `0011_add_start_page_to_scrapejob`
- [x] `SearchPageMixin._get_pagination_requests()`: start from `start_page`, paginate to `start_page + max_pages - 1`
- [x] `AmazonSearchProductSpider.__init__`: accept `start_page` arg (str, default '1', int-cast)
- [x] `AmazonSearchProductSpider.start_requests()`: use `self.start_page` instead of 1
- [x] `AmazonSearchPageSpider.__init__`: accept `start_page` arg (str, default '1', int-cast)
- [x] `AmazonSearchPageSpider.start_requests()`: use `self.start_page` instead of 1
- [x] `scrape_keyword_job()`: accept `start_page` param, pass `-a start_page=` to subprocess
- [x] `scrape_search_page_job()`: accept `start_page` param, pass `-a start_page=` to subprocess
- [x] `LiveSearchSerializer`: add `start_page` IntegerField (optional, min=1, default=1)
- [x] `LiveSearchView.post()`: pass `start_page` to `ScrapeJob.objects.create()` + `queue.enqueue()`
- [x] `ScrapeJobAdmin`: add `start_page` to `list_display` + fieldsets
- [x] `start_pending_jobs` admin action: pass `start_page` to task
- [x] `retry_failed_jobs` admin action: copy `start_page` to new job + pass to task
- [x] Lint clean: `ruff check django-app/`

---

## Verification Checklist (Phase 9–16)

- [x] ScrapeJob has sort_by, price_min, price_max, browse_node, start_page fields
- [x] ProductSearchCache extended cache key includes sort_by, price_min, price_max, browse_node
- [x] ProductSearchCache.Status has `cancelled` choice
- [x] PRODUCT_TYPE_SPIDER_KWARGS has 15 MBA types with real Amazon URL params
- [x] AmazonProduct.ProductType + ScrapeJob.ProductTypeFilter expanded to 15+OTHER / 15+ALL
- [x] _build_search_url() appends &s=, &low-price=, &high-price=, &bbn= correctly
- [x] Empty keyword + browse_node produces valid URL (no &k=)
- [x] Cache dedup works per sort+price+node combination
- [x] API accepts and validates all new params (sort_by, price, browse_node, pages_total, start_page)
- [x] Browse node override takes precedence over default mapping
- [x] pages_total max 400 enforced
- [x] Django Admin exposes all new fields
- [x] Cancel endpoint: POST /api/research/search/{cache_id}/cancel/
- [x] cancel_scrape_job sets cache status to `cancelled` (not `failed`)
- [x] Frontend: Sort dropdown in Live+DB mode, 16 product types with icons
- [x] Frontend: Infinite Scroll with start_page, skeleton cards, Search↔Stop toggle
- [x] Frontend: Hardcoded defaults (price 13-100, browse_node from mapping)
- [x] Frontend: Build clean (0 TS errors)
- [x] Backend tests: 34 new tests passing
- [x] Frontend tests: ControlsRow tests passing
- [x] Full QA pass pending

---

## Phase 17: Excel Upload + OneShot Tier (2026-04-25)

- [x] AC-8b: `_parse_uploaded_file()` helper in `scraper_app/admin.py` detects `.xlsx` via filename extension, parses first sheet via `openpyxl` (read_only, data_only). CSV path unchanged
- [x] AC-8b: Empty Excel rows (all-None) skipped during parse
- [x] AC-8b: Numeric ASIN cells zfill'd to 10 chars (compensates Excel's leading-zero stripping for ISBN-style ASINs)
- [x] AC-8b: `CsvUploadForm` updated — label "CSV or Excel File", `accept=".csv,.xlsx"` on file input
- [x] AC-8b: Admin template (`templates/admin/scraper_app/csv_upload.html`) doc updated for both formats + German Excel `;` caveat + ASIN cell-format-as-text recommendation
- [x] AC-11b: `OneShot` `ScrapeTier` seeded on dev + prod (`bsr_min=0, bsr_max=0, interval_days=36500`) — practical "scrape once, never re-scrape" via explicit `tier=OneShot` reference
- [x] Tests: `test_xlsx_upload_creates_targets`, `test_xlsx_zero_pads_numeric_asin` in `test_admin.py`
- [x] Lint clean: `ruff check django-app/`
- [ ] AC-9d (PROJ-10 cross-ref): still deferred — extract result count from search Page 2 HTML and upsert `keyword_app.KeywordProductCount` as scrape side-effect (saves a dedicated ScraperOps call per keyword)
