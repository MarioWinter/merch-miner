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

- [x] `GET /api/research/products/{asin}/` — single product detail view, full AmazonProduct serializer + `meta_keywords` M2M (short_tail/long_tail with frequency), 404 if not found, ASIN regex validation
- [x] `GET /api/research/products/{asin}/similar/` — products with overlapping `meta_keywords` M2M in same marketplace, limit 20, exclude self
- [x] `GET /api/research/products/{asin}/same-brand/` — products with same `brand` + `marketplace`, exclude self, limit 20
- [x] `GET /api/research/products/{asin}/price-history/` — `BSRSnapshot` records (price field) for last 90 days, same marketplace
- [x] `POST /api/research/products/{asin}/use-as-template/` — accepts `{niche_id}`, creates Listing draft (PROJ-11) with `generated_by=manual` pre-populated from product copy; workspace membership check; returns listing ID
- [x] Update existing `BSRHistoryView` — extend from 30 days to 90 days (change timedelta)
- [x] Add BSR summary to `bsr-history` response: overall_trend, current_trend, average, median (computed server-side)
- [x] Include `SearchKeywordResult` (top_focus_keywords, top_long_tail_keywords) in search status response when completed — frontend uses this for statistics view
- [x] Serializers: `ProductDetailSerializer` (with nested MetaKeywordSerializer), `SimilarProductSerializer`, `PriceHistorySerializer`, `UseAsTemplateSerializer`
- [x] URL routes: register 5 new endpoints in `research_app/api/urls.py`
- [x] Auth: all endpoints use `CookieJWTAuthentication` + `IsAuthenticated`

---

## Phase 10: Frontend — Product Detail Page (AC-29 to AC-36)

> Design: Option B "Data Dashboard" — scrollable single page, no tabs, KPI row + content grid

- [x] New route: `App.tsx` — add `<Route path="/amazon/research/product/:asin" element={<ProductDetailPage />} />`
- [x] `detail/ProductDetailPage.tsx` — main page: back+breadcrumb → KPI row → content grid → actions → keywords → price → competition. Loading skeleton. Scrollable, no tabs.
- [x] `detail/hooks/useProductDetail.ts` — custom hook combining: `getProductDetail` (incl. meta_keywords), `getBSRHistory`, `getSimilarProducts`, `getSameBrandProducts`, `getPriceHistory`
- [x] `detail/partials/KPIRow.tsx` — 4 KPI cards (design system pattern): BSR (with trend arrow), Price, Reviews, Rating.
- [x] `detail/partials/ProductInfoSection.tsx` — 2-column grid: left (image 300×300 + title + brand + info chips with icons + bullets + description "read more"), right (BSR chart + subcategory ranks + BSR summary)
- [x] `detail/partials/BSRChart.tsx` — @mui/x-charts LineChart (90 days, reversed Y-axis, line=secondary.main via theme, area fill, height 300px); subcategory ranks with split-tag design (category + mono-bold rank with BSR icon + tier color); BSR summary (overall trend, current trend, average, median); null-rank safe
- [x] `detail/partials/PriceHistorySection.tsx` — LineChart (line=primary.main via theme, area=primary.subtle, Y-axis $ prefix, height 250px)
- [x] `detail/partials/KeywordsSection.tsx` — renders `meta_keywords` (short_tail + long_tail); Flying Research style outlined chips with keyword + search icon, count below chip only when > 1; "Copy all keywords" button
- [x] `detail/partials/CompetitionSection.tsx` — "Similar Designs" + "Same Brand" horizontal carousels
- [x] `detail/partials/ProductCarousel.tsx` — horizontal scroll-snap, 200px mini-cards (thumbnail, BSR with icon + tier color, price, reviews, date), nav arrows
- [x] `detail/types/index.ts` — ProductDetail, KeywordExtraction, PriceSnapshot, BSRSummary types
- [x] Actions row: "Open in Amazon" (outlined secondary), "Use as Listing Template" (contained primary, POST mutation → notistack), "Save Keywords" (outlined secondary, PROJ-10)
- [x] EC-16: 404 state with "Product not found" message + back link
- [x] EC-17: BSR chart 0 data points → "No BSR data available" placeholder
- [x] EC-18: No thumbnail → placeholder image (background.default)
- [x] EC-19: "Use as Listing Template" with no active niche → notistack warning
- [x] EC-24: Direct URL navigation → fetch product by ASIN, back button via browser history
- [x] RTK Query: add 7 new endpoints to `store/researchSlice.ts` (getProductDetail, getProductKeywords, getSimilarProducts, getSameBrandProducts, getPriceHistory, getStatistics, useAsTemplate mutation)
- [x] i18n: add translation keys for detail page sections (en, de, fr, it, es)
- [x] Verify: zero hardcoded hex/rgb values — all colors via `theme.vars.palette.*`

---

## Phase 11: Frontend — Statistics View + Live UX (AC-37 to AC-41)

- [x] AC-37: `ResultsToolbar.tsx` — add Products/Keywords toggle (MUI ToggleButtonGroup or Tab)
- [x] AC-37: `partials/StatisticsView.tsx` — reads `SearchKeywordResult`; Flying Research style outlined chips with count below; click → pre-fill search bar
- [x] AC-37: Wire to existing `pollSearchStatus` RTK query (SearchKeywordResult included in completed status response)
- [x] EC-25: Statistics view with 0 results → "Run a search first" empty state
- [x] AC-38: `LiveProgressBanner.tsx` — show growing skeleton card count based on `products_scraped` from poll; replace with real cards on completion
- [x] EC-22: Skeleton streaming — handle batch with 0 new products gracefully

---

## Phase 12: Tests (Phases 7-11)

- [x] Backend tests: `ProductDetailView` (200, 404, ASIN validation, meta_keywords included)
- [x] Backend tests: `SimilarProductsView` (results, empty, self-excluded)
- [x] Backend tests: `SameBrandView` (results, empty)
- [x] Backend tests: `PriceHistoryView` (90 days, empty)
- [x] Backend tests: `UseAsTemplateView` (success, no niche, validation)
- [x] Backend tests: `BSRHistoryView` updated (90 days, BSR summary fields)
- [x] Backend tests: Search status response includes `SearchKeywordResult` when completed
- [x] Frontend tests: `ProductCard.tsx` rewrite (hover overlay, compact info, click → navigate, disableHover, hideHeart)
- [x] Frontend tests: `ProductDetailPage.tsx` (loading, loaded, 404, keyword chips)
- [x] Frontend tests: `BSRChart` (chart render, summary, no data, null-rank safe)
- [x] Frontend tests: `KeywordsSection` (chips, copy, Flying Research style)
- [x] Frontend tests: `StatisticsView.tsx` (keyword list, empty state, count display)
- [x] Frontend tests: `SearchBar.tsx` (Enter-only trigger, no keystroke trigger)
- [x] TypeScript `tsc --noEmit` — 0 errors
- [x] ESLint `npm run lint` — 0 errors (2 pre-existing kanban warnings)
- [x] Ruff `ruff check django-app/` — 0 errors

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
- [x] Phase 8: Product Card redesign completed (AC-25 to AC-28) + disableHover, hideHeart, download removed
- [x] Phase 9: 5 new backend endpoints + 2 updates completed
- [x] Phase 10: Product Detail Page — scrollable single page, KPI row with visible icons, Flying Research style keyword chips, split-tag BSR ranks, metadata chips with icons, product type formatting
- [x] Phase 11: Statistics view + Live UX completed (AC-37, AC-38)
- [x] Phase 12: 310/310 frontend tests passing, tsc clean, lint clean (0 errors)
- [x] Drawer CollectedProductsSection redesigned — glassmorphism, dot carousel, action pill row, no hover/heart on drawer cards
- [ ] 41/41 total Acceptance Criteria passed (pending: full AC audit)
- [ ] 25/25 total Edge Cases passed (pending: full EC audit)

---

## Phase 6: Sort Selection, Product Types, Infinite Scroll, Cancel (2026-03-29)

### Backend (PROJ-16 provides, PROJ-7 consumes)
- [x] `POST /api/research/search/` extended: `sort_by`, `price_min`, `price_max`, `browse_node`, `pages_total`, `start_page`
- [x] `POST /api/research/search/{cache_id}/cancel/` — new endpoint (SearchCancelView)
- [x] `ProductSearchCache.Status.CANCELLED` — cancel sets `cancelled`, not `failed`
- [x] `GET /api/research/search/{cache_id}/status/` includes sort/filter info in response

### Frontend — Sort & Product Types
- [x] Sort dropdown visible in BOTH Live and DB mode (Live=Amazon sort, DB=local sort)
- [x] Live Sort options with MUI icons: Featured (default), Best Sellers, Newest, Price asc/desc, Avg Reviews, Relevance
- [x] Live Sort default: `featured-rank`
- [x] Product Type dropdown: 16 MBA types with 11 custom SVG icons
- [x] `pullover` removed, `sweatshirt` added across frontend

### Frontend — Infinite Scroll
- [x] `pages_total=1` per job, `start_page` incremented per scroll
- [x] `allLiveProducts` accumulates across pages (dedupe by ASIN)
- [x] IntersectionObserver on sentinel div — triggers only when previous job completed + canLoadMore
- [x] 0 new products → canLoadMore=false (end of results)
- [x] New keyword search resets page + clears accumulated products

### Frontend — Cancel / Stop
- [x] `cancelLiveSearch` mutation in researchSlice
- [x] Search button → red "Stop" button when live search running
- [x] Stop: cancels backend job → setCacheId(null) → polling stops → UI resets to initial state
- [x] usePolling returns empty state when cacheId null (no stale status)
- [x] `cancelled` in ProductSearchStatus type + TERMINAL_STATUSES
- [x] LiveProgressBanner returns null on cancelled (no error shown)

### Frontend — Skeleton Cards
- [x] LinearProgress bar removed
- [x] Separate Stop button in banner removed
- [x] 8 skeleton cards (wave animation) during pending/running
- [x] Skeleton count reduces as real products load

### Frontend — Search Button UX
- [x] Disabled when keyword empty
- [x] Disabled state: primary.dark with 0.5 opacity

### Frontend — Hardcoded Defaults
- [x] price_min=13, price_max=100 (not in UI)
- [x] browse_node from PRODUCT_TYPE_BROWSE_NODES mapping (not in UI)

### Frontend — Build Fixes
- [x] ProductDetail.bsr_categories type conflict
- [x] CollectedProductsSection useRef init
- [x] SparkLineChart colors→color
- [x] hideLegend for MUI Charts
- [x] background.elevated→paper
- [x] SearchBar test missing props

### Tests
- [x] 10 ControlsRow tests (sort both modes, 16 product types, API params)
- [x] Build clean: 0 TypeScript errors
- [ ] Full QA pass pending

---

## Phase 13: DB Search — Virtualized Infinite Scroll (AC-57 to AC-63, EC-31 to EC-34)

> DB mode shows thousands of products. Initial load = 100, then load 50 more on scroll. React Virtualized for smooth scrolling through large result sets.

### Backend
- [ ] Increase `max_value` on `page_size` serializer field from 100 → 200 (allows initial 100-fetch)
- [ ] Confirm offset pagination works correctly for infinite scroll (no duplicate/skip issues when products are inserted between page fetches)

### Frontend — State Hook
- [ ] Create `useDbInfiniteScroll` hook: manages page counter, accumulated products array, loading flag, `hasMore` flag, `isFetchingNext` flag
- [ ] Initial fetch: `page_size=100, page=1` on search submit (AC-57)
- [ ] `loadNextPage()`: increments page, fetches with `page_size=50`, appends results (dedupe by ASIN) (AC-58)
- [ ] End detection: if returned count < `page_size` → set `hasMore=false`, stop scroll loading (AC-59)
- [ ] Small result set: if initial fetch returns < 100 → `hasMore=false` immediately, no scroll trigger (EC-31)
- [ ] Search/filter reset: new keyword or filter change resets accumulated products, page counter, scroll position to top (AC-62)
- [ ] Request deduplication: only one fetch in-flight at a time. Fast scroll events ignored while `isFetchingNext=true` (EC-32)
- [ ] Filter change cancellation: if filter changes while next page is loading → abort in-flight request (AbortController or RTK Query abort), reset, new search with `page=1` (EC-33)

### Frontend — RTK Query Changes
- [ ] Current `useListProductsQuery` returns single-page results. Add `useLazyListProductsQuery` for imperative fetching inside the hook (trigger on scroll, not on param change)

### Frontend — Virtualized Rendering
- [ ] Install `react-virtuoso` — lightweight virtualizer with grid support and MUI compatibility
- [ ] Replace `ProductGrid.tsx` flex-wrap grid with `VirtuosoGrid` — renders only visible cards + buffer (overscan ~5 rows). Smooth 60fps scrolling (AC-60)
- [ ] `ProductTable.tsx` (List view): wrap `DataGrid` rows with virtualized container or use DataGrid's built-in row virtualization. Confirm both view modes work with infinite scroll (AC-63)
- [ ] `endReached` callback from Virtuoso → calls `loadNextPage()` from hook

### Frontend — Loading & UX
- [ ] Loading indicator: skeleton cards (same wave style as Live mode) appended at bottom while next page loads. Removed when products arrive (AC-61)
- [ ] Scroll position preserved when switching between Grid ↔ List view within same search
