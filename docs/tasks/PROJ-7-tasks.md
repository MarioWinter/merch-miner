# PROJ-7: Amazon Product Research — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-17)

- **research_app:** New Django app — user-facing API layer only. Reads scraper_app models. No new core models.
- **ProductSearchCache.workspace:** FK added via PROJ-7 migration *in scraper_app* (model stays there; PROJ-7 extends it).
- **Autocomplete proxy:** `httpx` (async-compatible). Redis cache 60s TTL per (query, marketplace).
- **Full-text search:** Django `SearchVector` + `SearchRank` across `title`, `brand`, `bullet_1`, `bullet_2`, `description`. GIN index added in migration.
- **CSV export:** `StreamingHttpResponse` — avoids memory spike on 500+ product sets.
- **Mode toggle UI:** MUI Switch (not ToggleButton). Live ON → advanced options panel dims; only Product Type + Hide Official Brands stay active.
- **Filter UX:** Slider panel with per-filter enable/disable Switch — matches MerchMatrix / Flying Research.
- **Rating filter:** Star click-to-set (minimum rating floor), not numeric range input.
- **Hide Official Brands:** Full-width MUI Button toggle. `outlined` → `contained` secondary when active.
- **Polling:** RTK Query `pollingInterval: 3000` (3s). MUI Skeleton shown while pending.
- **Inline detail panel:** Not a drawer — user keeps list context while expanding a product.
- **Charts:** `@mui/x-charts` for BSR history sparkline.
- **DataGrid:** `@mui/x-data-grid` for List view.
- **Official brands fixture:** Static JSON in `research_app/fixtures/`.
- **Polling dedup:** Same keyword+marketplace already pending → return existing `ProductSearchCache`.

---

## Phase 1: Backend Foundation

- [x] Create `research_app` Django app, register in `INSTALLED_APPS`
- [x] Create `research_app/api/` with `__init__.py`, `views.py`, `serializers.py`, `urls.py`
- [x] Wire into `core/urls.py` under `/api/research/`
- [x] Migration: `workspace` FK on `ProductSearchCache` (in `scraper_app/migrations/`)
- [x] Migration: GIN index for full-text search on `AmazonProduct` (SearchVector across title, brand, bullet_1, bullet_2, description)
- [x] `research_app/fixtures/official_brands.json` — static brand list for hide_official_brands filter

---

## Phase 2: API Endpoints

- [x] `GET /api/research/suggestions/` — Amazon autocomplete proxy via `httpx`, Redis cache 60s TTL
- [x] `POST /api/research/search/` — Live Research trigger, dedup via `get_or_create_keyword_cache()`, workspace FK, product_type kwargs
- [x] `GET /api/research/search/{cache_id}/status/` — poll scrape status, workspace ownership check, products on completion
- [x] `GET /api/research/products/` — DB Research with FTS (SearchVector + SearchRank), all range filters, hide_official_brands, exclude_words, pagination 50/page
- [x] `GET /api/research/products/export/` — CSV StreamingHttpResponse, same filters as list, no pagination
- [x] `GET /api/research/products/{asin}/bsr-history/` — last 30 days BSRSnapshot, ASIN regex validation

---

## Phase 3: Frontend — State & Services

- [x] RTK Query `researchApi` slice (`store/researchSlice.ts`) — getSuggestions, triggerLiveSearch, pollSearchStatus, listProducts, getBSRHistory
- [x] TypeScript types (`types/index.ts`) — AmazonProduct, ProductSearchStatus, ResearchMode, ResearchFilters, FilterEnabled, etc.
- [x] `useResearchMode` hook — Live/DB toggle, resets filters on switch
- [x] `useFilterState` hook — all filter values + per-filter enable/disable + resetFilters + activeFilterCount
- [x] `useRecentSearches` hook — localStorage FIFO max 10, dedup, persist across sessions
- [x] `usePolling` hook — RTK Query pollingInterval 3s, auto-stop on terminal state

---

## Phase 4: Frontend — UI Components

- [x] `SearchBar.tsx` — MUI Switch (Live/DB) + Autocomplete (debounced 300ms) + Search Button + recent chips
- [x] `ControlsRow.tsx` — Marketplace Select (persisted localStorage) + Product Type + Sorting (DB only) + Advanced Options toggle
- [x] `RangeSliderFilter.tsx` (reusable) — MUI Slider range + enable/disable Switch
- [x] `StarRatingFilter.tsx` — 5 clickable stars, click-to-set minimum
- [x] `AdvancedOptionsPanel.tsx` — 3-column grid, Live mode dims (opacity 0.4, pointer-events none), info Alert
- [x] `ResultsToolbar.tsx` — result count + Grid/List toggle + Copy ASINs + Export CSV
- [x] `ProductCard.tsx` — thumbnail, BSR badge (color-coded), title, brand, rating, price, ASIN, actions
- [x] `ProductGrid.tsx` — MUI Grid responsive (xs=12 sm=6 md=4 lg=3), one expanded at a time
- [x] `ProductTable.tsx` — MUI DataGrid, server-side sort, 52px rows, row expand
- [x] `ProductDetailPanel.tsx` — BSR sparkline (@mui/x-charts), bullets, description, Add to Niche + Open on Amazon
- [x] `LiveProgressBanner.tsx` — LinearProgress + polling status text + error state with Retry
- [x] `EmptyState.tsx` — per-scenario states (no search, DB empty, Live empty)
- [x] `AmazonResearchView.tsx` — main page assembly, route `/amazon/research`
- [x] Route registered in `App.tsx`

---

## Phase 5: Tests

- [x] Backend API tests (`research_app/tests/`) — 62 tests: suggestions, live search, poll, products, export, BSR history
- [x] Frontend tests (`views/amazon/research/tests/`) — 88 tests: view, panel, card, hooks
- [x] TypeScript `tsc --noEmit` — 0 errors
- [x] ESLint — 0 errors
- [x] Ruff — 0 errors

---

## Phase 6: Bug Fixes (from QA)

- [x] BUG-1: Suggestions proxy URL — use `httpx params={}` dict instead of raw interpolation
- [x] BUG-3: Hide Official Brands stays active in Live mode (only DB-only controls dimmed)
- [x] BUG-4: Polling stops on terminal state (`pollingInterval: 0` when completed/failed)
- [x] BUG-5: Frontend tests rewritten to match actual rendered output (88/88 pass)
- [x] BUG-8: ASIN validation regex `^[A-Z0-9]{10}$` on BSR history endpoint
- [x] BUG-10: Pagination URLs preserve all query params via `request.query_params.copy()`

### Low-severity bugs (deferred to next sprint)

- [x] BUG-11: Double pagination in List view — DataGrid + parent TablePagination both showing
- [x] BUG-12: Copy ASINs copies only current page (50) — clarify if intentional or "Copy Page ASINs"
- [x] BUG-13: CSV export sends disabled filter values — should use same `buildQueryParams()` as list

---

## Phase 7: Bug Fixes — Frontend (AC-18 to AC-24)

- [x] AC-18: `SearchBar.tsx` — remove `onSearch` from Autocomplete `onChange`; only fire on Enter keydown handler + Search button `onClick`
- [x] AC-19: `ControlsRow.tsx` — verify `sort_by` param flows to `listProducts` RTK query; debug backend `ProductListView` ordering logic
- [x] AC-20: `ProductCard.tsx` — verify `product.bsr` field mapping is correct (not stale/wrong field)
- [x] AC-21: `ProductCard.tsx` — add `reviews_count` display next to star rating (e.g. "/ 170 review(s)")
- [x] AC-22: `AdvancedOptionsPanel.tsx` + `useFilterState.ts` — verify `reviews_min`/`reviews_max` flow through filter state → query params → backend
- [x] AC-23: `ProductDetailPanel.tsx` — fix bullets as `<ul><li>`, description as truncated `<Typography>` with expand, proper overflow handling (file deleted in Phase 8, moved to detail page)
- [x] AC-24: `ProductCard.tsx` — add formatted `listed_date` display (e.g. "2025-05-28") alongside existing "Published Xd ago" (listed_date available on detail page; card shows compact data only per Phase 8 design)
- [x] Fix BUG-11: `ProductTable.tsx` — add `hideFooterPagination` prop to DataGrid (AC-39)
- [x] Fix BUG-12: `ResultsToolbar.tsx` — change "Copy ASINs" label to "Copy {count} ASINs" (AC-40)
- [x] Fix BUG-13: `ResultsToolbar.tsx` — use `buildQueryParams()` for CSV export, not raw `filters` (AC-41)

---

## Phase 8: Product Card Redesign — Frontend (AC-25 to AC-28)

> Design: Option B "Data Dashboard" — card with sparkline, 370px fixed height

- [x] AC-25: `ProductCard.tsx` — rewrite card: fixed 370px height (220px image + 30px sparkline + 120px info); `object-fit: cover` + `object-position: center 20%` for design crop
- [x] AC-25: `ProductGrid.tsx` — ensure all cards identical via fixed height; grid: xs=6, sm=6, md=4, lg=3, xl=2.4
- [x] AC-25: `ProductCard.tsx` — BSR sparkline row (30px): @mui/x-charts SparkLineChart using BSR history data; color via `theme.vars.palette.secondary.main`; empty if < 2 data points (height preserved)
- [x] AC-25: `ProductCard.tsx` — lazy-fetch BSR history per card via `getBSRHistory` RTK query (cached per ASIN)
- [x] AC-26: `ProductCard.tsx` — hover overlay with gradient (top+bottom fade using `theme.vars.palette.background.default`); action icons: SaveAlt, ContentCopy, OpenInNew, ArrowForward (20px, text.primary); heart icon top-left (error.main when active)
- [x] AC-26: `ProductCard.tsx` — AI badge top-right (secondary.dark bg, AutoAwesome icon) shown if slogan extracted
- [x] EC-23: `ProductCard.tsx` — touch fallback: `@media (hover: none)` → overlay always visible at opacity 0.6
- [x] AC-27: `ProductCard.tsx` — info area 2 rows: Row 1 (BSR color-coded + sales + price), Row 2 (stars + reviews + ASIN chip). No title, no brand. All colors via `theme.vars.palette.*`
- [x] AC-28: `ProductGrid.tsx` — card click → `useNavigate()` to `/amazon/research/product/{asin}`; remove inline `ProductDetailPanel` expand logic
- [x] AC-28: `ProductTable.tsx` — row click → navigate to detail page; remove inline row expand
- [x] Delete `ProductDetailPanel.tsx` (replaced by detail page)
- [x] Verify: zero hardcoded hex/rgb values in ProductCard — all via theme tokens

---

## Phase 9: Backend — New API Endpoints (AC-29 to AC-37)

> Reduced from 7 to 5 new endpoints. Keywords reuse existing `MetaKeyword` M2M + `SearchKeywordResult` (scraper_app). Statistics reuse `SearchKeywordResult` from search cache.

- [ ] `GET /api/research/products/{asin}/` — single product detail view, full AmazonProduct serializer + `meta_keywords` M2M (short_tail/long_tail with frequency), 404 if not found, ASIN regex validation
- [ ] `GET /api/research/products/{asin}/similar/` — products with overlapping `meta_keywords` M2M in same marketplace, limit 20, exclude self
- [ ] `GET /api/research/products/{asin}/same-brand/` — products with same `brand` + `marketplace`, exclude self, limit 20
- [ ] `GET /api/research/products/{asin}/price-history/` — `BSRSnapshot` records (price field) for last 90 days, same marketplace
- [ ] `POST /api/research/products/{asin}/use-as-template/` — accepts `{niche_id}`, creates Listing draft (PROJ-11) with `generated_by=manual` pre-populated from product copy; workspace membership check; returns listing ID
- [ ] Update existing `BSRHistoryView` — extend from 30 days to 90 days (change timedelta)
- [ ] Add BSR summary to `bsr-history` response: overall_trend, current_trend, average, median (computed server-side)
- [ ] Include `SearchKeywordResult` (top_focus_keywords, top_long_tail_keywords) in search status response when completed — frontend uses this for statistics view
- [ ] Serializers: `ProductDetailSerializer` (with nested MetaKeywordSerializer), `SimilarProductSerializer`, `PriceHistorySerializer`, `UseAsTemplateSerializer`
- [ ] URL routes: register 5 new endpoints in `research_app/api/urls.py`
- [ ] Auth: all endpoints use `CookieJWTAuthentication` + `IsAuthenticated`

---

## Phase 10: Frontend — Product Detail Page (AC-29 to AC-36)

> Design: Option B "Data Dashboard" — scrollable single page, no tabs, KPI row + content grid

- [ ] New route: `App.tsx` — add `<Route path="/amazon/research/product/:asin" element={<ProductDetailPage />} />`
- [ ] `detail/ProductDetailPage.tsx` — main page: back+breadcrumb → KPI row → content grid → actions → keywords → price → competition. Loading skeleton. Scrollable, no tabs.
- [ ] `detail/hooks/useProductDetail.ts` — custom hook combining: `getProductDetail` (incl. meta_keywords), `getBSRHistory`, `getSimilarProducts`, `getSameBrandProducts`, `getPriceHistory`
- [ ] `detail/partials/KPIRow.tsx` — 4 KPI cards (design system pattern): BSR (with trend arrow), Price, Reviews, Rating. Check if KPI card component already exists globally before building.
- [ ] `detail/partials/ProductInfoSection.tsx` — 2-column grid: left (image 300×300 + title + brand + info chips + bullets + description "read more"), right (BSR chart + subcategory ranks + BSR summary)
- [ ] `detail/partials/BSRChart.tsx` — @mui/x-charts LineChart (90 days, reversed Y-axis, line=secondary.main via theme, area=secondary.subtle, grid=divider, height 300px, tooltip glass-sm); subcategory ranks from `bsr_categories` JSON; BSR summary (overall trend, current trend, average, median)
- [ ] `detail/partials/PriceHistorySection.tsx` — LineChart (line=primary.main via theme, area=primary.subtle, Y-axis $ prefix, height 250px)
- [ ] `detail/partials/KeywordsSection.tsx` — renders `meta_keywords` from product detail response (short_tail + long_tail chips); click chip → save via existing `POST /api/niches/{id}/keywords/bulk-add/` (source=amazon_search); Search icon → new research; "Copy all keywords" link
- [ ] `detail/partials/CompetitionSection.tsx` — "Similar Designs" + "Same Brand" horizontal carousels
- [ ] `detail/partials/ProductCarousel.tsx` — reusable: horizontal scroll-snap, 200px mini-cards (thumbnail, BSR, price, reviews, date), nav arrows (IconButton, background.elevated). Check if carousel component exists globally first.
- [ ] `detail/types/index.ts` — ProductDetail, KeywordExtraction, PriceSnapshot, BSRSummary types
- [ ] Actions row: "Open in Amazon" (outlined secondary), "Use as Listing Template" (contained primary, POST mutation → notistack), "Save Keywords" (outlined secondary, PROJ-10)
- [ ] EC-16: 404 state with "Product not found" message + back link
- [ ] EC-17: BSR chart 0 data points → "No BSR data available" placeholder
- [ ] EC-18: No thumbnail → placeholder image (background.default)
- [ ] EC-19: "Use as Listing Template" with no active niche → notistack warning
- [ ] EC-24: Direct URL navigation → fetch product by ASIN, back button via browser history
- [ ] RTK Query: add 7 new endpoints to `store/researchSlice.ts` (getProductDetail, getProductKeywords, getSimilarProducts, getSameBrandProducts, getPriceHistory, getStatistics, useAsTemplate mutation)
- [ ] i18n: add translation keys for detail page sections (en, de, fr, it, es)
- [ ] Verify: zero hardcoded hex/rgb values — all colors via `theme.vars.palette.*`

---

## Phase 11: Frontend — Statistics View + Live UX (AC-37 to AC-41)

- [ ] AC-37: `ResultsToolbar.tsx` — add Products/Keywords toggle (MUI ToggleButtonGroup or Tab)
- [ ] AC-37: `partials/StatisticsView.tsx` — reads `SearchKeywordResult` (top_focus_keywords + top_long_tail_keywords) from search cache status response; keyword chips with frequency counts, sorted desc; click → pre-fill search bar
- [ ] AC-37: Wire to existing `pollSearchStatus` RTK query (SearchKeywordResult included in completed status response)
- [ ] EC-25: Statistics view with 0 results → "Run a search first" empty state
- [ ] AC-38: `LiveProgressBanner.tsx` — show growing skeleton card count based on `products_scraped` from poll; replace with real cards on completion
- [ ] EC-22: Skeleton streaming — handle batch with 0 new products gracefully

---

## Phase 12: Tests (Phases 7-11)

- [ ] Backend tests: `ProductDetailView` (200, 404, ASIN validation, meta_keywords included)
- [ ] Backend tests: `SimilarProductsView` (results, empty, self-excluded)
- [ ] Backend tests: `SameBrandView` (results, empty)
- [ ] Backend tests: `PriceHistoryView` (90 days, empty)
- [ ] Backend tests: `UseAsTemplateView` (success, no niche, validation)
- [ ] Backend tests: `BSRHistoryView` updated (90 days, BSR summary fields)
- [ ] Backend tests: Search status response includes `SearchKeywordResult` when completed
- [x] Frontend tests: `ProductCard.tsx` rewrite (hover overlay, compact info, click → navigate)
- [ ] Frontend tests: `ProductDetailPage.tsx` (loading, loaded, 404, tab switching)
- [ ] Frontend tests: `BSRTab.tsx` (chart render, summary, no data)
- [ ] Frontend tests: `KeywordsTab.tsx` (chips, copy, save)
- [ ] Frontend tests: `StatisticsView.tsx` (keyword list, empty state)
- [ ] Frontend tests: `SearchBar.tsx` (Enter-only trigger, no keystroke trigger)
- [ ] TypeScript `tsc --noEmit` — 0 errors
- [ ] ESLint `npm run lint` — 0 errors
- [ ] Ruff `ruff check django-app/` — 0 errors

---

## Verification Checklist

### Phase 1 (Complete)
- [x] 6 API endpoints implemented and tested (suggestions, live search, poll, products, export, BSR history)
- [x] Full-text search with GIN index (SearchVector + SearchRank)
- [x] All DB filters (BSR, rating, reviews, price, date, product_type, subcategory, hide_official_brands, exclude_words)
- [x] Live/DB mode toggle with correct feature gating
- [x] Grid/List layout toggle
- [x] Recent searches localStorage (FIFO max 10)
- [x] CSV export streaming
- [x] Workspace isolation on ProductSearchCache
- [x] 17/17 Phase 1 Acceptance Criteria passed (QA 2026-03-23)
- [x] 15/15 Phase 1 Edge Cases passed
- [x] 150/150 tests (62 backend + 88 frontend)

### Phases 2-5 (New)
- [x] Phase 7: 7 bug fixes + 3 QA bugs completed (AC-18 to AC-24, AC-39 to AC-41)
- [x] Phase 8: Product Card redesign completed (AC-25 to AC-28)
- [ ] Phase 9: 7 new backend endpoints + 2 updates completed
- [ ] Phase 10: Product Detail Page with 4 tabs completed (AC-29 to AC-36)
- [ ] Phase 11: Statistics view + Live UX completed (AC-37, AC-38)
- [ ] Phase 12: All new tests passing, lint clean
- [ ] 41/41 total Acceptance Criteria passed
- [ ] 25/25 total Edge Cases passed
