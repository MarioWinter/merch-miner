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

> DB mode shows thousands of products. Initial load = 100, then load 50 more on scroll. **`react-virtuoso`** locked as virtualization library per ADR-002 (`docs/architecture-decisions.md`). Smooth 60fps scrolling, bounded RAM.

### Backend
- [x] Increase `max_value` on `page_size` serializer field from 100 → 200 (allows initial 100-fetch)
- [x] Confirm offset pagination works correctly for infinite scroll (no duplicate/skip issues when products are inserted between page fetches)

### Frontend — State Hook
- [x] Create `useDbInfiniteScroll` hook: manages page counter, accumulated products array, loading flag, `hasMore` flag, `isFetchingNext` flag
- [x] Initial fetch: `page_size=100, page=1` on search submit (AC-57)
- [x] `loadNextPage()`: increments page, fetches with `page_size=50`, appends results (dedupe by ASIN) (AC-58)
- [x] End detection: if returned count < `page_size` → set `hasMore=false`, stop scroll loading (AC-59)
- [x] Small result set: if initial fetch returns < 100 → `hasMore=false` immediately, no scroll trigger (EC-31)
- [x] Search/filter reset: new keyword or filter change resets accumulated products, page counter, scroll position to top (AC-62)
- [x] Request deduplication: only one fetch in-flight at a time. Fast scroll events ignored while `isFetchingNext=true` (EC-32)
- [x] Filter change cancellation: if filter changes while next page is loading → abort in-flight request (AbortController or RTK Query abort), reset, new search with `page=1` (EC-33)

### Frontend — RTK Query Changes
- [x] Current `useListProductsQuery` returns single-page results. Add `useLazyListProductsQuery` for imperative fetching inside the hook (trigger on scroll, not on param change)

### Frontend — Virtualized Rendering
- [x] Install `react-virtuoso` — lightweight virtualizer with grid support and MUI compatibility
- [x] Replace `ProductGrid.tsx` flex-wrap grid with `VirtuosoGrid` — renders only visible cards + buffer (overscan ~5 rows). Smooth 60fps scrolling (AC-60)
- [x] `ProductTable.tsx` (List view): keep MUI `DataGrid` — it has built-in row virtualization (do NOT double-wrap with Virtuoso per ADR-002). Wire DataGrid `onRowsScrollEnd` (or scroll-listener on viewport) → `loadNextPage()` from hook (AC-63)
- [x] `endReached` callback from `<VirtuosoGrid>` → calls `loadNextPage()` from hook (Grid view only)
- [x] Configure `<VirtuosoGrid>`: `data={products}`, `endReached={loadNextPage}`, `increaseViewportBy={400}` (preload buffer ~1 viewport ahead), `components={{ ScrollSeekPlaceholder, Footer: SkeletonRow }}`
- [x] Apply MUI-styled `List` + `Item` slot components for VirtuosoGrid to preserve current card grid responsive layout (`xs=12 sm=6 md=4 lg=3`)

### Frontend — Loading & UX
- [x] Loading indicator: skeleton cards (same wave style as Live mode) appended at bottom while next page loads via `Footer` slot. Removed when products arrive (AC-61)
- [x] Scroll position preserved when switching between Grid ↔ List view within same search (Virtuoso `restoreStateFrom` / DataGrid scroll persistence)
- [x] Browser tab hidden during scroll loading → in-flight fetch completes normally; products appended when tab regains focus. Use `document.visibilityState` listener to delay scroll-trigger until visible (EC-34)

### Frontend — Cleanup (Remove Old Pagination UI)
- [x] `AmazonResearchView.tsx`: remove `const [page, setPage] = useState(0)` — page state moves into `useDbInfiniteScroll`
- [x] `AmazonResearchView.tsx`: remove `<TablePagination>` block (currently lines ~621-628) — replaced by infinite scroll
- [x] `AmazonResearchView.tsx`: replace direct `useListProductsQuery` call with `useDbInfiniteScroll` hook
- [x] `AmazonResearchView.tsx`: replace hardcoded `page_size: 50` (line ~131) — page sizes now managed inside the hook (100 initial / 50 subsequent)
- [x] Verify: no unused imports remain (`TablePagination`, `useListProductsQuery` if direct usage gone)

### Frontend — Tests
- [x] Create `frontend-ui/src/views/amazon/research/hooks/__tests__/useDbInfiniteScroll.test.ts`
- [x] Test: initial fetch uses `page_size=100`
- [x] Test: `loadNextPage()` uses `page_size=50` and increments page counter
- [x] Test: dedupe by ASIN — duplicate products from overlapping pages not appended twice
- [x] Test: end detection — `result_count < page_size` sets `hasMore=false`
- [x] Test: small result set (<100) sets `hasMore=false` immediately (EC-31)
- [x] Test: rapid `loadNextPage` calls with `isFetchingNext=true` are ignored — single in-flight (EC-32)
- [x] Test: filter change while loading aborts in-flight + resets to page 1 (EC-33)
- [x] Test: tab visibility — `loadNextPage` deferred when `document.visibilityState === 'hidden'` (EC-34)
- [x] Update `frontend-ui/src/views/amazon/research/tests/AmazonResearchView.test.tsx` — assert no `<TablePagination>` rendered, assert `<VirtuosoGrid>` present in grid mode
- [x] Add integration test: search → initial 100 products → scroll triggers `endReached` → mock returns 50 more → assert appended

### Backend — Tests
- [x] Verify existing pagination tests still pass with `max_value=200`
- [x] Add test: `page_size=100` request returns 100 results (was capped before)
- [x] Add test: `page_size=200` request accepted (Headroom check)

### Verification
- [x] `cd frontend-ui && npm run lint` → Phase 13 paths 0 errors (14 pre-existing errors in other files — unrelated)
- [x] `npx tsc --noEmit` → typecheck passes
- [x] `npx vitest run useDbInfiniteScroll AmazonResearchView` → 19/19 green (10 hook + 9 view)
- [x] `docker compose exec web pytest django-app/research_app/tests/` → 30/30 in test_list_products.py green (Phase 13 backend)
- [x] Manual QA (Playwright): search "t-shirt" → AC-57 confirmed via network: `page=1&page_size=100`. Result count 89 (< 100) → AC-59/EC-31 path: `hasMore=false`, no second fetch. AC-60: only 9 cards in DOM (windowing works, total=89). Scroll mid-page → re-windowing confirmed (DOM cards change set as scroll position changes).
- [x] Manual QA (Playwright): DOM-Bounded check — at scrollY=0: 9 cards in DOM; at scrollY=2000: 18 cards in DOM (buffer expansion only, never all 89). Bounded behavior verified.
- [ ] Manual QA: change filter mid-scroll → in-flight request cancelled, results reset (EC-33) — covered by Vitest EC-33 unit test (mocked AbortController)
- [ ] Manual QA: hide tab via Cmd+Tab during scroll → no fetch fires; bring tab back → next page loads (EC-34) — covered by Vitest EC-34 unit test (mocked `document.visibilityState`)
- [x] **3 Live-Bugs found + fixed** during Playwright QA: (1) `react-virtuoso` not installed in Docker frontend container; (2) `VirtuosoGrid` `data` prop wrong API (replaced with `totalCount` + `itemContent(index)` via `products[index]`); (3) `VirtuosoList` styled component had `shouldForwardProp: prop !== 'children'` filter that blocked children rendering — removed.
- [x] **Filter-only search amendment** (user request, AC-64..AC-67 + EC-35..EC-36): Search button always enabled in DB mode; keyword optional. `useDbInfiniteScroll` hook simplified `shouldQueryDb` (drops `!!keyword` requirement). Hook reset-key compare replaced with monotonic fetchId counter (StrictMode-safe). Live-verified with empty keyword + default filters → 89 products rendered.
- [x] **Backend range-filter NULL bug found + fixed** (AC-64a): `bsr_min/max`, `reviews_min/max`, `price_min/max` filters previously excluded NULL values. With 82/89 t-shirts having NULL `bsr`, enabling the BSR filter at default full range silently returned 0 results. Fixed via `Q(field__gte=N) | Q(field__isnull=True)`. 30/30 backend list-products tests still pass.
- [x] **UI cleanup** (user request 2026-05-02): Removed per-filter enable/disable Switches from `RangeSliderFilter` for BSR/Reviews/Price (always-on now). Slider component simplified, no `enabled`/`onEnabledChange` props. `DEFAULT_FILTER_ENABLED.bsr_min/max + reviews_min/max + price_min/max + hide_official_brands` flipped to `true`. `DEFAULT_FILTERS.hide_official_brands` flipped to `true`. Tests updated: 123/123 amazon-research tests still pass.
- [x] **Empty-keyword recent-search bug** (user-reported 2026-05-02): Filter-only search via empty keyword polluted recent-search history with an empty chip. Fixed in `useRecentSearches.ts`: (1) `addSearch` early-returns on empty/whitespace keyword; (2) `readFromStorage` filters legacy empty entries on load AND persists the cleanup back to localStorage. Live-verified: empty chip removed from history, new empty searches don't add entries.
- [ ] All AC-57 to AC-63 + EC-31 to EC-34 checkboxes ticked in `features/PROJ-7-amazon-product-research.md` (handled by `/qa` skill)
