# PROJ-7: Amazon Product Research — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-17)

- **research_app:** New Django app — user-facing API layer only. Reads scraper_app models. No new core models.
- **ProductSearchCache.workspace:** FK added via PROJ-7 migration *in scraper_app* (model stays there; PROJ-7 extends it).
- **Autocomplete proxy:** `httpx` (async-compatible). Redis cache 60s TTL per (query, marketplace).
- **Full-text search:** Django `SearchVector` + `SearchRank` across `title`, `brand`, `bullet_1`, `bullet_2`, `description`. GIN index added in migration.
- **CSV export:** `StreamingHttpResponse` — avoids memory spike on 500+ product sets.
- **Mode toggle UI:** MUI Switch (not ToggleButton). Live ON → advanced options panel dims (`opacity: 0.4`, `pointer-events: none`); only Product Type + Hide Official Brands stay active.
- **Filter UX:** Slider panel with per-filter enable/disable Switch — not chip+popover. Matches reference tools (MerchMatrix / Flying Research).
- **Rating filter:** Star click-to-set (minimum rating floor), not numeric range input.
- **Hide Official Brands:** Full-width MUI Button toggle. `outlined` when inactive → `contained` color=secondary (#00C8D7) when active.
- **Polling:** RTK Query `pollingInterval: 3000` (3s). MUI Skeleton shown while pending.
- **Inline detail panel:** Not a drawer — user keeps list context while expanding a product.
- **Charts:** `@mui/x-charts` (already in package.json) for BSR history sparkline.
- **DataGrid:** `@mui/x-data-grid` (already in package.json) for List view.
- **Official brands fixture:** Static JSON fixture in `research_app/fixtures/` — not user-configurable in MVP.
- **Polling dedup:** If same keyword+marketplace already pending → return existing `ProductSearchCache`, no new job enqueued.

---

## Phase 1: Backend Foundation

### Task 1.1: Create `research_app` Django app
- `python manage.py startapp research_app`
- Register in `INSTALLED_APPS`
- Create `research_app/api/` directory with `__init__.py`, `views.py`, `serializers.py`, `urls.py`
- Wire `research_app/api/urls.py` into `core/urls.py` under `/api/research/`
- **AC:** App loads without errors; `/api/research/` returns 404 (no routes yet)

### Task 1.2: Migration — workspace FK on ProductSearchCache
- New migration in `scraper_app/migrations/`
- Add `workspace = ForeignKey(workspace_app.Workspace, null=True, blank=True, on_delete=SET_NULL)` to `ProductSearchCache`
- Add `db_index=True` on the FK
- **AC:** Migration runs; `ProductSearchCache` has `workspace_id` column; existing rows have `NULL` (no backfill needed)

### Task 1.3: Migration — GIN index for full-text search on AmazonProduct
- New migration in `scraper_app/migrations/`
- Add `GinIndex` on a generated `SearchVector` across `title`, `brand`, `bullet_1`, `bullet_2`, `description`
- **AC:** Migration runs; `EXPLAIN` on a FTS query uses index scan (not seq scan) on large tables

### Task 1.4: Official brands static fixture
- `research_app/fixtures/official_brands.json` — list of known brand names (e.g. Nike, Adidas, Disney, NFL, NBA, etc.)
- Loaded via `python manage.py loaddata official_brands` or auto-loaded on app startup
- Used by `hide_official_brands` filter to exclude matching `AmazonProduct.brand` values (case-insensitive)
- **AC:** Fixture loads without errors; filter correctly excludes brands from the list

---

## Phase 2: API Endpoints

### Task 2.1: GET `/api/research/suggestions/`
- Auth: `IsAuthenticated` + `CookieJWTAuthentication`
- Params: `q` (string, required), `marketplace` (string, default `amazon_com`)
- Marketplace → Amazon marketplace ID mapping (e.g. `amazon_com` → `ATVPDKIKX0DER`)
- Proxy: `httpx.get()` to `https://completion.amazon.com/api/2017/suggestions?prefix={q}&mid={mid}&alias=aps`
- Redis cache: `suggestions:{q}:{marketplace}` TTL 60s; return cached if hit
- On Amazon timeout/error: return empty list `[]` (no 500)
- Response: `{ data: ["suggestion1", "suggestion2", ...] }`
- **AC:** Returns suggestions array; Redis caches result; Amazon error returns `[]`; debounce handled client-side

### Task 2.2: POST `/api/research/search/`
- Auth: `IsAuthenticated` + `CookieJWTAuthentication`
- Body serializer: `keyword` (required), `marketplace` (required), `product_type` (optional), `hide_official_brands` (bool, optional)
- Look up `request.user`'s active workspace (from `WorkspaceMembership`)
- Call `get_or_create_keyword_cache(keyword, marketplace)` from `scraper_app.tasks`
  - If existing pending/completed cache → return `{ cache_id, status }` (no new job)
  - If no fresh cache → create `ScrapeJob(mode=live)` + `ProductSearchCache(workspace=workspace)` + enqueue `scrape_keyword_job` via django-rq `scraper` queue
- Map `product_type` → spider kwargs via `PRODUCT_TYPE_SPIDER_KWARGS` (imported from `scraper_app.models`)
- Response: `{ data: { cache_id, status } }`
- **AC:** Creates job + cache; deduplicates concurrent requests; workspace FK stored; product_type kwargs passed to spider

### Task 2.3: GET `/api/research/search/{cache_id}/status/`
- Auth: `IsAuthenticated` + workspace ownership check on `ProductSearchCache`
- Returns: `{ status, pages_done, products_scraped, error_log }`
- When `status == completed`: also include first page of products (50 items, serialized with all display fields)
- When `status == failed`: include `error_log` for UI display
- **AC:** Returns correct status; workspace check prevents cross-workspace polling; products included on completion

### Task 2.4: GET `/api/research/products/`
- Auth: `IsAuthenticated` + `CookieJWTAuthentication`
- Filter params (all optional): `keyword`, `marketplace`, `bsr_min`, `bsr_max`, `rating_min`, `reviews_min`, `reviews_max`, `price_min`, `price_max`, `date_from`, `date_to`, `product_type` (comma-separated), `subcategory`, `hide_official_brands` (bool), `exclude_words` (comma-separated), `sort_by`, `page`, `page_size` (default 50)
- FTS: if `keyword` provided → `SearchVector('title', 'brand', 'bullet_1', 'bullet_2', 'description')` + `SearchRank`
- Range filters: only applied if param present (empty = no filter)
- `hide_official_brands`: exclude products where `brand__iregex` matches any official brand fixture entry
- `exclude_words`: for each word → `~Q(title__icontains=word)` (escaped, not regex)
- Validation: `bsr_min > bsr_max` → 400 error; same for other range pairs
- Response: `{ data: { count, results: [...], next, previous } }`
- **AC:** All filters combine correctly; FTS ranks by relevance; BSR min>max returns 400; pagination works

### Task 2.5: GET `/api/research/products/export/`
- Same filter logic as Task 2.4 (shared `_build_product_queryset()` helper)
- No pagination — full result set
- `StreamingHttpResponse` with `csv.writer` and `Content-Disposition: attachment; filename="research-export.csv"`
- CSV columns: ASIN, Title, Brand, BSR, Rating, Reviews, Price, Product Type, Subcategory, Listed Date, Scraped At, Marketplace
- **AC:** Downloads full CSV; large sets (500+) stream without memory spike; same filters as list endpoint

### Task 2.6: GET `/api/research/products/{asin}/bsr-history/`
- Auth: `IsAuthenticated` + `CookieJWTAuthentication`
- Params: `asin` (URL), `marketplace` (query param, required)
- Query: `BSRSnapshot.objects.filter(product__asin=asin, product__marketplace=marketplace).order_by('recorded_at')` last 30 days
- Response: `{ data: [{ bsr, rating, price, recorded_at }, ...] }`
- If no product found → 404
- If < 2 data points → return what exists (frontend handles "Not enough history" label)
- **AC:** Returns ordered snapshot list; 404 on unknown ASIN; empty list when no snapshots yet

---

## Phase 3: Frontend — State & Services

### Task 3.1: RTK Query `researchApi` slice (`store/researchSlice.ts`)
- Tag types: `ResearchProducts`, `ResearchStatus`, `BSRHistory`
- Endpoints:
  - `getSuggestions` (query) → `GET /api/research/suggestions/`
  - `triggerLiveSearch` (mutation) → `POST /api/research/search/`
  - `pollSearchStatus` (query, supports `pollingInterval`) → `GET /api/research/search/{cacheId}/status/`
  - `listProducts` (query) → `GET /api/research/products/`
  - `getBSRHistory` (query) → `GET /api/research/products/{asin}/bsr-history/`
- Export endpoint handled separately via direct axios call (blob download)
- Register slice in `store/index.ts`
- **AC:** All endpoints typed; slice registered; polling endpoint auto-stops when called with `skip: true`

### Task 3.2: TypeScript types (`views/amazon/research/types/index.ts`)
- `AmazonProduct` interface (all display fields: asin, title, brand, bsr, rating, reviewsCount, price, productType, listedDate, thumbnailUrl, scrapedAt)
- `ProductSearchStatus` type (`pending | running | completed | failed`)
- `ResearchMode` type (`live | db`)
- `ResearchFilters` interface (all filter params with correct types)
- `FilterEnabled` interface (per-filter boolean flags matching ResearchFilters keys)
- `SuggestionItem`, `SearchCacheStatus`, `BSRSnapshot` interfaces
- **AC:** All interfaces used consistently across hooks and components; no `any` types

### Task 3.3: `useResearchMode` hook
- State: `mode: ResearchMode` (default `db`)
- Toggling mode resets filter values + clears results
- Returns `mode`, `isLive`, `toggleMode`
- **AC:** Toggle resets state; `isLive` boolean drives UI disabling logic

### Task 3.4: `useFilterState` hook
- State: `filters: ResearchFilters` + `enabled: FilterEnabled` (per-filter enable/disable)
- Initial values: BSR 1–500000, Reviews 0–10000, Price 1–100, Rating 0 (no min), no dates, no excludes
- `setFilter(key, value)` — updates single filter value
- `setEnabled(key, bool)` — toggles per-filter switch
- `resetFilters()` — resets all to defaults (called on mode toggle)
- `activeFilterCount` — count of enabled filters with non-default values (for UI badge)
- **AC:** State updates immutably; reset works; `activeFilterCount` correct

### Task 3.5: `useRecentSearches` hook
- localStorage key: `mm-research-recent`
- State: `searches: Array<{ keyword: string, marketplace: string }>`
- `addSearch(keyword, marketplace)` — prepends, deduplicates, trims to max 10 (FIFO)
- `removeSearch(index)` — remove single entry
- Reads from localStorage on mount; syncs writes back
- **AC:** Persists across page reload; max 10; duplicates replaced at top

### Task 3.6: `usePolling` hook
- Wraps `pollSearchStatus` RTK Query endpoint
- Starts polling (3s interval) when `cacheId` is set and `status === 'pending' || status === 'running'`
- Stops polling when `status === 'completed' || status === 'failed'` or component unmounts
- Returns `{ status, pagesDone, productsScraped, products, errorLog, isPolling }`
- On new search trigger: resets previous polling (skip old cacheId)
- **AC:** Auto-stops on completion; cleans up on unmount; resets correctly on new search

---

## Phase 4: Frontend — UI Components

### Task 4.1: `SearchBar.tsx`
- MUI Switch (left): label changes `Live Research` (ON) / `DB Research` (OFF), color `secondary` when ON
- MUI Autocomplete (center, full-width): keyword input with suggestions from `getSuggestions`
  - Debounce 300ms on input change
  - Max 10 suggestions shown; no error shown if suggestions empty
  - `onKeyDown Enter` → triggers search
- Search Button (right, `primary.main`): triggers mode-appropriate request
- Recent search chips below input: clickable, pre-fills keyword + triggers search; `×` to remove
- **AC:** Suggestions load debounced; Enter triggers search; recent chips work; switch toggles mode

### Task 4.2: `ControlsRow.tsx`
- Marketplace Select (MUI Select with flag emoji + label per option): 6 options, persists to `localStorage` key `mm-research-marketplace`
- Product Type Select: All / T-Shirt / Hoodie / Pullover / Zip Hoodie / Long Sleeve / Tank Top
- Sorting Select (DB mode only, hidden in Live mode): BSR ↑ / Reviews ↓ / Rating ↓ / Price ↑ / Newest
- "Advanced Options ▾" collapse toggle button (right-aligned, `text` variant, `text.secondary`)
  - Chevron rotates when open
- **AC:** Marketplace persists; sorting hidden in Live mode; collapse toggle works

### Task 4.3: `RangeSliderFilter.tsx` (reusable)
- Props: `label`, `value: [min, max]`, `min`, `max`, `step`, `enabled`, `onEnabledChange`, `onChange`, `formatValue` (e.g. `(v) => v.toLocaleString()`)
- Left: MUI Switch (size `small`) to enable/disable
- Label text (bold, `subtitle2`)
- MUI Slider (`range` mode, `valueLabelDisplay="auto"`)
  - When `enabled=false`: `disabled` prop applied, `opacity: 0.5`
- Value bubbles above handles (via `valueLabelDisplay`)
- **AC:** Switch enables/disables slider; value labels show formatted values; disabled state visually clear

### Task 4.4: `StarRatingFilter.tsx`
- 5 clickable star icons (MUI `Star` / `StarBorder` icons)
- Click on star N → sets `rating_min = N`; click same star again → clears (sets to 0)
- Label: "Min. Rating" (above stars)
- When `rating_min = 0`: all stars outlined (no filter active)
- Color: `warning.main` (#F59E0B) for filled stars
- **AC:** Single click sets minimum; second click on same star clears; correct stars fill

### Task 4.5: `AdvancedOptionsPanel.tsx`
- MUI Collapse wrapping a `background.paper` Box with `border-radius: 12px`, `border: 1px solid rgba(255,255,255,0.08)`
- Layout: 3-column grid (left: BSR/Reviews/Price sliders; center: Rating + Hide Official Brands; right: Subcategory / Exclude Words / Date Range)
- Includes: `RangeSliderFilter` × 3, `StarRatingFilter`, Hide Official Brands Button, Subcategory TextField, Exclude Words TextField, Date Range (two MUI `DatePicker`)
- Live mode: entire panel wrapped with `sx={{ opacity: isLive ? 0.4 : 1, pointerEvents: isLive ? 'none' : 'auto' }}`
- Info banner inside panel when `isLive`: MUI `Alert` severity `info` — "Advanced filters available in DB Research mode only"
- **AC:** All filters render correctly; Live mode dims panel; info banner shows in Live mode; filter changes re-fetch immediately in DB mode

### Task 4.6: `ResultsToolbar.tsx`
- Left: result count + keyword label (e.g. `312 results for "funny cat"`)
- Center: MUI `ToggleButtonGroup` — `[▦ Grid]` `[☰ List]` (default: Grid)
- Right: `[Copy All ASINs]` MUI Button outlined secondary + `[Export CSV]` MUI Button outlined
  - Copy All ASINs: copies comma-separated ASIN list to clipboard; success toast via notistack
  - Export CSV: `axios` GET to `/api/research/products/export/` with current filters as params, `responseType: 'blob'` → download via anchor tag; disabled when count = 0
  - Both hidden in Live mode
- **AC:** Layout toggle switches view; copy works; CSV download triggers; export disabled at 0 results

### Task 4.7: `ProductCard.tsx`
- Props: `product: AmazonProduct`, `onAddToNiche`, `isExpanded`, `onToggleExpand`
- Layout: MUI Card `background.paper`, `border-radius: 12px`, hover `elevation.2` + `translateY(-1px)`
- Thumbnail: fixed-ratio image (4:5), `object-fit: cover`, fallback placeholder
- BSR Badge (color-coded chip): `<10k` = success, `10k–50k` = warning, `>50k` = text.secondary
- Title: `body2`, 2-line clamp via `-webkit-line-clamp: 2`
- Brand: `caption`, `text.secondary`
- Stars + review count + price in one row (`caption`)
- "Published since X days" (caption, calculated from `listedDate`)
- ASIN (JetBrains Mono, `caption`, `text.secondary`)
- Actions row: `[Add to Niche]` (text button) `[↗ Amazon]` (icon button, opens in new tab)
- Click on card body (not buttons) → triggers `onToggleExpand`
- **AC:** All fields render; BSR badge correct color; expand toggle works; Amazon link opens in new tab

### Task 4.8: `ProductGrid.tsx`
- MUI Grid container, responsive: `xs=12 sm=6 md=4 lg=3`
- Renders list of `ProductCard`
- Manages `expandedAsin` state (only one card expanded at a time)
- When a card is expanded → renders `ProductDetailPanel` inline below that card row
- **AC:** Cards lay out responsively; only one panel open at a time

### Task 4.9: `ProductTable.tsx` (MUI DataGrid)
- Columns: Thumbnail (50px img) | Title | Brand | BSR (BSR Badge) | ★ | Reviews | Price | Product Type | Listed Date | Actions
- `rowHeight: 52`, `density: "compact"`
- `onRowClick` → toggles inline `ProductDetailPanel` in a custom row expansion slot
- Sortable columns: BSR, Rating, Reviews, Price, Listed Date (sort handled server-side — triggers re-fetch)
- Pagination: 50/page (server-side), MUI `TablePagination`
- No client-side filtering (all server-side)
- **AC:** Columns render; row expand works; sort triggers re-fetch; pagination navigates pages

### Task 4.10: `ProductDetailPanel.tsx`
- Inline expand panel (not drawer)
- BSR History Sparkline: `@mui/x-charts` `LineChart`, last 30 days `BSRSnapshot` data
  - X-axis: date, Y-axis: BSR (inverted so lower = better = higher on chart)
  - If < 2 data points: placeholder with "Not enough history yet" message
  - Loading state: MUI Skeleton (chart-shaped)
- Feature bullets: MUI List with `bullet_1` + `bullet_2`
- Description: truncated to 3 lines, "Show more" toggle
- Action buttons:
  - `[Add to Niche List]` → `POST /api/niches/` with `{ name: keyword }` → notistack success/error toast
  - `[Open on Amazon ↗]` → opens `https://www.amazon.{marketplace}/s?k={keyword}` in new tab
- **AC:** Sparkline renders; <2 points shows label; bullets show; description truncates; both actions work

### Task 4.11: `LiveProgressBanner.tsx`
- Shown only in Live mode while `status === 'pending' || status === 'running'`
- MUI `LinearProgress` (color `secondary`)
- Status text: "Scraping Amazon… Page {pagesDone} of {pagesTotal}" + products_scraped count
- Error state (status=`failed`): MUI `Alert` severity `error` with `error_log` summary + `[Retry]` button
  - Retry: re-triggers `POST /api/research/search/` with same params
- **AC:** Progress bar shows while running; text updates on each poll; error state shows Retry button

### Task 4.12: `EmptyState.tsx`
- Props: `mode: ResearchMode`, `hasSearched: boolean`
- No search yet: large icon + "Search a keyword to get started"
- DB mode, searched, 0 results: icon + "No products found for this keyword" + "Try Live Research to scrape fresh data" CTA button
- Live mode, 0 scraped: icon + "No products found on Amazon for this keyword"
- Design: centered, `py: 8`, 64px icon (`text.disabled`), `h5` title (`text.secondary`), `body2` body (`text.disabled`)
- **AC:** Correct state shown per scenario; CTA in DB empty state switches to Live mode

### Task 4.13: `AmazonResearchView.tsx` (main page assembly)
- Route: `/amazon/research`
- Assembles: `SearchBar` → `ControlsRow` → `AdvancedOptionsPanel` (Collapse) → `LiveProgressBanner` (Live only) → `ResultsToolbar` → `ProductGrid | ProductTable` (based on layout toggle) → `Pagination`
- Page header: `h4` "Amazon Research" + subtitle (mode label)
- Manages `advancedOpen` collapse state
- Passes all hook values down to child components via props
- Handles initial load: no search yet → `EmptyState`
- **AC:** Full page renders; all sections appear in correct order; no prop drilling beyond one level

### Task 4.14: Register route in `App.tsx`
- Add `<Route path="/amazon/research" element={<AmazonResearchView />} />` inside `<PrivateRoute>`
- Sidebar `navConfig.ts` already has `/amazon/research` entry — no change needed
- **AC:** Navigating to `/amazon/research` renders the page; sidebar link works

---

## Phase 5: Tests

### Task 5.1: Backend API tests (`research_app/tests/`)
- `test_suggestions`: returns array; Redis cache hit; Amazon error returns `[]`
- `test_live_search`: creates ScrapeJob + ProductSearchCache with workspace FK; dedup returns existing pending
- `test_poll_status`: returns correct fields; workspace ownership check (403 on wrong workspace)
- `test_list_products`: FTS returns ranked results; BSR range filter; `bsr_min > bsr_max` → 400; `hide_official_brands` excludes fixture brands; `exclude_words` excludes matching titles; pagination works
- `test_export_csv`: correct columns; streams response; same filters as list
- `test_bsr_history`: returns ordered snapshots; 404 on unknown ASIN; empty list if no snapshots

### Task 5.2: Frontend component tests (`views/amazon/research/tests/`)
- `AmazonResearchView.test.tsx`: renders without crash; switches between Grid/List; mode toggle changes visible filters
- `AdvancedOptionsPanel.test.tsx`: Live mode dims panel; filters disabled; info banner shows; DB mode all filters active
- `ProductCard.test.tsx`: BSR badge correct color per range; expand toggle; Add to Niche calls POST; Amazon link has correct href
- `useRecentSearches.test.ts`: add/dedup/max 10 FIFO; persists to localStorage
- `useFilterState.test.ts`: setFilter/setEnabled/resetFilters; activeFilterCount correct

---

## Implementation Order

```
Phase 1 (Backend Foundation)
  1.1 (research_app) → 1.2 (workspace FK migration) → 1.3 (GIN index migration) → 1.4 (brands fixture)

Phase 2 (API Endpoints)
  2.1 (suggestions)
  → 2.2 (live search trigger)
  → 2.3 (poll status)
  → 2.4 (DB products list)         (parallel with 2.3)
  → 2.5 (CSV export)               (after 2.4, shares queryset helper)
  → 2.6 (BSR history)

Phase 3 (Frontend State)
  3.1 (researchApi slice) + 3.2 (types)    (parallel)
  → 3.3 (useResearchMode) + 3.4 (useFilterState) + 3.5 (useRecentSearches)    (parallel)
  → 3.6 (usePolling)                        (after 3.1 + 3.3)

Phase 4 (UI Components)
  4.3 (RangeSliderFilter) + 4.4 (StarRatingFilter)    (parallel, reusable first)
  → 4.5 (AdvancedOptionsPanel)                         (after 4.3 + 4.4)
  → 4.1 (SearchBar) + 4.2 (ControlsRow)               (parallel)
  → 4.6 (ResultsToolbar)
  → 4.7 (ProductCard) + 4.10 (ProductDetailPanel)      (parallel)
  → 4.8 (ProductGrid) + 4.9 (ProductTable)             (parallel, after 4.7 + 4.10)
  → 4.11 (LiveProgressBanner) + 4.12 (EmptyState)      (parallel)
  → 4.13 (AmazonResearchView) → 4.14 (route)

Phase 5 (Tests)
  5.1 (backend) + 5.2 (frontend)    (written alongside each phase)
```

**Total: 30 tasks** across 5 phases.
