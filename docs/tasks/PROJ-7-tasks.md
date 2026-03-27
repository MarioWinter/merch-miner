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

## Phase 7: Amendments — Bug Fixes (from Requirements Session 2026-03-27)

- [ ] BUG: Search triggers on every keystroke — should only trigger on Enter key or Search button click
- [ ] BUG: Sort by filter options not applied correctly
- [ ] BUG: Wrong BSR value displayed on product cards
- [ ] BUG: Review count not displayed on product cards
- [ ] BUG: Review range filter does not work
- [ ] BUG: Bullet1/Bullet2/Description panel rendering broken (layout/overflow issues)
- [ ] BUG: Add date (listed_since) not shown — only "X days online" displayed, should show actual date too

---

## Phase 8: Amendments — UI Improvements (from Requirements Session 2026-03-27)

- [ ] UI: Live Research loading state — Skeleton cards with product streaming (progressive reveal as products arrive)
- [ ] UI: Product Card design image — show only the design (crop/zoom), not the full t-shirt mockup
- [ ] UI: All Product Cards must be equal height and width (fixed dimensions, consistent grid)
- [ ] UI: Remove Brand and Title from Product Card surface — move to Detail view. Card shows: image, BSR badge, rating, price, reviews, days online
- [ ] UI: Detail view layout cleanup for Bullets + Description display

---

## Phase 9: Amendments — New Features (from Requirements Session 2026-03-27)

- [ ] FEAT: "Use as Listing Template" button in product Detail view — copies title, bullets, description as pre-filled draft into PROJ-11 Listing Generator. Creates Listing with `generated_by=manual` pre-populated with product's copy
- [ ] FEAT: Statistics/Keywords page — switchable view (toggle/tab) showing aggregated keyword data from current search results: top keywords from titles/bullets, frequency, overlap across products
- [ ] FEAT: Product Listing Keywords in Detail view — extracted keywords from title + bullets + description as chips, clickable to save to Keyword Bank (PROJ-10, source=amazon_search)
- [ ] NOTE: Scraper (PROJ-16) may need adjustments if keywords/bullets not fully scraped yet

---

## Verification Checklist

- [x] 6 API endpoints implemented and tested (suggestions, live search, poll, products, export, BSR history)
- [x] Full-text search with GIN index (SearchVector + SearchRank)
- [x] All DB filters (BSR, rating, reviews, price, date, product_type, subcategory, hide_official_brands, exclude_words)
- [x] Live/DB mode toggle with correct feature gating
- [x] Grid/List layout toggle
- [x] Recent searches localStorage (FIFO max 10)
- [x] CSV export streaming
- [x] Workspace isolation on ProductSearchCache
- [x] 18/18 Acceptance Criteria passed (QA 2026-03-23)
- [x] 15/15 Edge Cases passed
- [x] 150/150 tests (62 backend + 88 frontend)
- [ ] Phase 7 bug fixes completed
- [ ] Phase 8 UI improvements completed
- [ ] Phase 9 new features completed
