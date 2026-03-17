# PROJ-7: Amazon Product Research

**Status:** In Progress
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-17

## Overview

A dedicated research page (inspired by MerchMatrix / Flying Research) for searching and filtering Amazon products before committing to a niche. Two modes: **Live Research** (triggers a fresh scrape via PROJ-16, fewer filters, real-time data) and **DB Research** (queries stored products with full filters and full-text search). All filters applied server-side. Scrape engine provided by PROJ-16.

## User Stories

1. As a member, I want to type a keyword and see Amazon autocomplete suggestions, so that I discover related search terms.
2. As a member, I want to switch between Live Research (fresh scrape) and DB Research (existing data), so that I can choose between speed and depth.
3. As a member, I want to filter products by BSR range, rating, reviews, price, and product type in DB Research mode, so that I find the sweet spot for niche viability.
4. As a member, I want to search across product title, brand, bullets, and description in DB Research mode, so that I find relevant products even if the keyword isn't the main title.
5. As a member, I want to see a BSR history chart for a product, so that I can evaluate trend direction over time.
6. As a member, I want to click "Open on Amazon" to see live search results, so that I can verify the data.
7. As a member, I want to hide official brand products, so that I only see POD-eligible opportunities.
8. As a member, I want to click a product and add its keyword as a Niche, so that the research pipeline is connected.
9. As a member, I want to toggle between table and card view, so that I can switch between dense data comparison and visual browsing.
10. As a member, I want my recent searches saved as chips, so that I can quickly repeat common research queries.
11. As a member, I want to export the current filtered results to CSV, so that I can analyse or share data offline.

## Acceptance Criteria

1. Search input shows Amazon suggestions via proxy endpoint; debounced 300ms; max 10 suggestions shown.
2. **Live Research mode:** Submitting a search triggers a fresh scrape via PROJ-16 if no completed result exists for that keyword+marketplace within 24h. Returns a job reference for the user to track progress via polling.
3. **DB Research mode:** `GET /api/research/products/` returns all stored products matching the keyword via full-text search across title, brand, bullets, description; full filter set applied server-side.
4. Mode toggle (Live / DB) is prominent in the UI; switching modes re-fetches data with the appropriate endpoint.
5. **Layout toggle:** Grid / List toggle buttons in the results toolbar. Grid = product cards with thumbnail prominent. List = dense table view. Default: Grid.
6. Results (Grid or List view) show per product: thumbnail, title, brand, BSR (color-coded badge), rating, reviews count, price, ASIN, "published since X days".
7. **Advanced Options (DB Research):** Collapsible panel below the controls row. Range sliders for BSR, Reviews, Price — each with an enable/disable toggle switch. Star-click rating selector. Hide Official Brands toggle button. Subcategory, Exclude Words text inputs, Date Range pickers. In Live mode: panel dimmed, only Product Type + Hide Official Brands active. Applying filters re-fetches immediately.
8. Clicking a product row/card expands an inline detail panel: BSR history sparkline (last 30 days), feature bullets, description excerpt, "Add to Niche" + "Open on Amazon" actions.
9. Sort controls change the result order; results re-fetch from server on sort change.
10. "Open on Amazon" button opens `https://www.amazon.{marketplace}/s?k={keyword}` in new tab (pure frontend).
11. "Add to Niche List" button creates a new Niche from the search keyword and shows a success notification.
12. A progress indicator is shown while a Live Research scrape is in progress, including current page and product count.
13. **Live Research error state:** If scrape fails, show error message and a "Retry" button that re-triggers the search.
14. Autocomplete suggestions are server-side cached; repeated identical queries return instantly without hitting Amazon's API again.
15. Live Research status can be polled by the UI until the scrape completes or fails.
16. **Recent searches:** Last 10 unique (keyword + marketplace) pairs stored in `localStorage`. Displayed as clickable chips below the search input. Clicking a chip pre-fills the search and triggers the active mode's request. Persists across sessions per browser.
17. **CSV export (DB Research):** "Export CSV" button downloads all products matching the current filters/sort (no pagination limit on export). Button is disabled when result count = 0.
18. **Default marketplace:** `amazon_com` on page load. Selection persists to `localStorage` and is restored on next visit.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/research/suggestions/` | Member | Amazon autocomplete proxy |
| POST | `/api/research/search/` | Member | Live Research: trigger Scrapy scrape or return cached |
| GET | `/api/research/search/{cache_id}/status/` | Member | Poll scrape job status |
| GET | `/api/research/products/` | Member | DB Research: filter/sort all stored products |
| GET | `/api/research/products/export/` | Member | DB Research: export filtered results as CSV (no pagination) |
| GET | `/api/research/products/{asin}/bsr-history/` | Member | BSR history snapshots for a product |

## Models

> All models owned by PROJ-16 (`scraper_app`). See [PROJ-16 spec](PROJ-16-amazon-product-scraper.md) for full schema.
> PROJ-7 adds a `workspace` FK to `ProductSearchCache` (via migration in `scraper_app`).

## Filters — DB Research (GET /api/research/products/)

| Param | Type | Description |
|-------|------|-------------|
| `keyword` | string | Full-text search across title, brand, bullets, description |
| `marketplace` | string | e.g., `amazon_com` |
| `bsr_min` / `bsr_max` | int | BSR range |
| `rating_min` / `rating_max` | float | e.g., 3.5–5.0 |
| `reviews_min` / `reviews_max` | int | Review count range |
| `price_min` / `price_max` | decimal | Price range |
| `date_from` / `date_to` | date | Listed date range |
| `product_type` | string (multi) | Comma-separated list |
| `subcategory` | string | Partial match on subcategory |
| `hide_official_brands` | bool | Exclude known official brand products (static list) |
| `exclude_words` | string | Comma-separated; exclude products whose title contains any of these words |
| `sort_by` | string | `bsr_asc`, `reviews_desc`, `rating_desc`, `price_asc`, `newest` |
| `page` / `page_size` | int | Pagination (default 50/page) |

## Filters — Live Research (POST /api/research/search/)

| Param | Type | Description |
|-------|------|-------------|
| `keyword` | string | Required; triggers scrape |
| `marketplace` | string | Required; e.g. `amazon_com` |
| `product_type` | string | Optional; user selects from dropdown (t_shirt, hoodie, pullover, zip_hoodie, long_sleeve, tank_top). Narrows the scrape to that MBA product type. |
| `hide_official_brands` | bool | Optional |

## Edge Cases

1. Amazon autocomplete returns empty → input works normally; no suggestions shown (no error).
2. Live Research scrape returns 0 products → empty state: "No products found for this keyword."
3. Scrape triggered while previous scrape for same keyword still running → return the in-progress job; no duplicate scrape started.
4. `exclude_words` containing special characters → treated as plain text, not as patterns.
5. Large result set (500+ products) → pagination 50/page; no client-side JS filtering.
6. BSR `min` > `max` → 400 validation error.
7. `hide_official_brands` list is maintained as a static fixture (not user-configurable in MVP).
8. BSR history chart has < 2 data points → show single value with "Not enough history" label.
9. DB Research with no stored products for keyword → empty state with suggestion to run Live Research.
10. Live Research scrape status = `failed` → show error toast + inline error message with "Retry" button; retry re-triggers search with same params.
11. Recent search chip clicked while scrape is in progress → previous polling cancelled; new request started.
12. CSV export with 0 results → "Export CSV" button is disabled (no request sent).
13. CSV export streams immediately; large sets (500+) handled without memory issues.
14. localStorage recent searches exceed 10 entries → oldest entry is dropped (FIFO).
15. User clears the search input → recent search chips remain visible as quick-start options.

## Dependencies

- PROJ-4 (Workspace & Membership — workspace scope)
- PROJ-5 (Niche List — "Add to Niche" action calls `POST /api/niches/`)
- PROJ-16 (Amazon Product Scraper — scrape engine, models, BSRSnapshot)

---

## Tech Design (Solution Architect)

> Decided: 2026-03-17 | Confirmed by user before spec update.

### A) Page Layout (Visual Tree)

```
Amazon Research Page (/amazon/research)
│
├── SearchBar Row
│   ├── Live Research Toggle (MUI Switch, left of search)
│   │     ON = "Live Research"  |  OFF = "DB Research" (default)
│   ├── Keyword Input (MUI Autocomplete + Amazon suggestions, debounced 300ms)
│   └── Search Button (primary, #FF5A4F)
│
├── Controls Row (always visible below search)
│   ├── Marketplace Select (flag + label, persisted to localStorage)
│   ├── Product Type Select (T-Shirt / Hoodie / Pullover / etc.)
│   ├── Sorting Select (BSR / Reviews / Rating / Price / Newest)
│   └── "Advanced Options ▾" collapse toggle (right-aligned)
│
├── Recent Search Chips (below controls, localStorage, max 10, FIFO)
│
├── Advanced Options Panel (collapsible, background.paper card)
│   ├── [●switch] BSR Range     MUI Slider (range, min/max bubbles)
│   ├── [●switch] Reviews Range MUI Slider (range)
│   ├── [●switch] Price Range   MUI Slider (range, $ values)
│   ├── Rating Selector         Star click-to-set (min rating, e.g. ≥ 4★)
│   ├── [Hide Official Brands]  Full-width MUI Button toggle
│   │                           outlined (inactive) → contained secondary (active)
│   ├── Subcategory             MUI TextField (icontains)
│   ├── Exclude Words           MUI TextField (comma-separated)
│   └── Date Range              Two MUI DatePicker inputs (From / To)
│   [LIVE MODE ON → panel dims to opacity 0.4, pointer-events none]
│   [LIVE MODE ON → only Product Type Select + Hide Official Brands stay active]
│   [Info banner: "Advanced filters available in DB Research mode only"]
│
├── Results Toolbar
│   ├── Result count + keyword label  (e.g. "312 results for 'funny cat'")
│   ├── [Grid ▦] [List ☰]  MUI ToggleButtonGroup (default: Grid)
│   ├── [Copy All ASINs]   MUI Button outlined secondary (copies to clipboard)
│   └── [Export CSV]       MUI Button outlined (DB mode only; disabled if 0 results)
│
├── Results Area
│   ├── Loading State (MUI Skeleton cards/rows, 3s polling interval)
│   ├── Live Mode Progress Banner (LinearProgress + "Scraping…" text + pages_done)
│   ├── Error State (error.main banner + "Retry" button — Live mode failed)
│   ├── Empty State (icon + message + CTA to switch mode)
│   │
│   ├── Grid View — MUI Grid of ProductCards
│   │   └── ProductCard
│   │       ├── Thumbnail image (top, fixed ratio)
│   │       ├── BSR Badge (color-coded: <10k=success, 10k–50k=warning, >50k=secondary text)
│   │       ├── Title (body2, 2-line clamp)
│   │       ├── Brand (caption, text.secondary)
│   │       ├── ★ Rating + review count
│   │       ├── $ Price
│   │       ├── Published since X days  (caption)
│   │       ├── ASIN (JetBrains Mono, caption)
│   │       └── [Add to Niche] [↗ Amazon]  action buttons
│   │
│   └── List View — MUI DataGrid (dense, 44px rows)
│       Columns: Thumbnail | Title | Brand | BSR | ★ | Reviews | Price | Type | Date | Actions
│       └── Row expand → ProductDetailPanel (inline, not drawer)
│
├── ProductDetailPanel (inline expand on row/card click)
│   ├── BSR History Sparkline — MUI X Charts LineChart (last 30 days)
│   │   └── < 2 data points → "Not enough history" label
│   ├── Feature Bullets list
│   ├── Description excerpt (truncated, expandable)
│   ├── [Add to Niche List]  calls POST /api/niches/ + notistack success toast
│   └── [Open on Amazon ↗]   opens amazon.{marketplace}/s?k={keyword} in new tab
│
└── Pagination (MUI TablePagination, 50/page default, DB mode only)
```

---

### B) Mode Toggle Behavior (Live vs DB)

| Feature | Live Research (Switch ON) | DB Research (Switch OFF) |
|---------|--------------------------|--------------------------|
| API called | `POST /api/research/search/` | `GET /api/research/products/` |
| Trigger | On Search button press | On Search button + any filter change |
| Advanced filters | Disabled (dimmed) except Product Type + Hide Official Brands | All filters active |
| Sorting | Hidden (Amazon order) | Active |
| Pagination | Hidden (shows all scraped) | 50/page |
| Export CSV | Hidden | Active (disabled if 0 results) |
| Loading UX | LinearProgress + polling every 3s + MUI Skeleton | MUI Skeleton on initial load |
| Results freshness | Live from Amazon (max 24h cache) | From DB, may be days old |

---

### C) Data Flow

```
LIVE MODE — "funny cat shirts"
  UI → POST /api/research/search/ { keyword, marketplace, product_type }
     ← { cache_id, status: "pending" }
  UI polls GET /api/research/search/{cache_id}/status/ every 3s
     ← { status: "running", pages_done: 2, products_scraped: 47 }
     ← { status: "completed", products: [...paginated...] }
  [If status = "failed" → error banner + Retry button]

DB MODE — "funny cat shirts"
  UI → GET /api/research/products/?keyword=...&bsr_min=...&sort_by=bsr_asc&page=1
     ← { count: 312, results: [...50 products...], next, previous }
  Filter change → immediate re-fetch with updated params
```

---

### D) Backend — New Django App: `research_app`

**Why a new app?**
`scraper_app` owns the engine (Scrapy jobs, models, scheduling) and has no user context.
`research_app` adds the user-facing API layer: authentication, workspace scope, FTS filtering, autocomplete proxy. Clean separation — PROJ-16 can run headless without PROJ-7.

**New Django app:** `django-app/research_app/`

| Endpoint | Behaviour |
|----------|-----------|
| `GET /api/research/suggestions/` | Proxies Amazon autocomplete via `httpx`. Redis cache 60s per (query, marketplace). Returns `string[]`. |
| `POST /api/research/search/` | Checks `ProductSearchCache` (workspace-scoped) for fresh result (<24h). If stale/missing: creates `ScrapeJob` + `ProductSearchCache(workspace=...)`, enqueues `scrape_keyword_job` via django-rq. Returns `{ cache_id, status }`. Deduplicates concurrent requests for same keyword. |
| `GET /api/research/search/{cache_id}/status/` | Returns `{ status, pages_done, products_scraped, error_log }`. When completed: includes first page of products. |
| `GET /api/research/products/` | PG full-text search (`SearchVector` + `SearchRank`) across `title`, `brand`, `bullet_1`, `bullet_2`, `description`. All DB filters + sort applied server-side. Paginated 50/page. |
| `GET /api/research/products/export/` | Same query, no pagination. `StreamingHttpResponse` CSV — avoids loading full dataset in memory. |
| `GET /api/research/products/{asin}/bsr-history/` | Last 30 days of `BSRSnapshot` for given ASIN + marketplace. |

---

### E) Database Changes & Data Ownership

**One migration** added to `scraper_app` (model stays there, PROJ-7 adds a field):

- `ProductSearchCache` gains a `workspace` FK → `workspace_app.Workspace` (`null=True, blank=True` for existing rows)
- All `research_app` views filter `ProductSearchCache` by `request.user`'s active workspace
- `AmazonProduct` stays global — shared market data, no workspace FK

**Data ownership (decided 2026-03-14):**
- **AmazonProduct** = global, no User/Workspace FK — saves scrape costs (same keyword scraped once, used by all users within 24h cache)
- **ProductSearchCache** = workspace-scoped — tracks "who triggered this search" for polling + history
- **Niche** (PROJ-5) = workspace-scoped — "Add to Niche List" links keyword to user's workspace
- Identity flow: UI → PROJ-7 API (authenticated) → ProductSearchCache(workspace) → PROJ-16 scrape engine (no user context)

---

### F) Full-Text Search Strategy (DB Research)

- `SearchVector` across: `title` (weight A), `brand` (weight B), `bullet_1` + `bullet_2` (weight C), `description` (weight D)
- `GIN` index on the search vector for fast lookups (added in migration)
- `SearchRank` used when `sort_by` is not specified (relevance order)
- If `keyword` param is empty → skip FTS, return all products for marketplace + filters

---

### G) Frontend State Management

| State | Storage | Notes |
|-------|---------|-------|
| Research mode (Live/DB) | `useState` | Page-local |
| Keyword | `useState` | Drives both modes |
| Marketplace | `localStorage` + `useState` | Key: `mm-research-marketplace`, default: `amazon_com` |
| Recent searches | `localStorage` | Key: `mm-research-recent`, max 10 FIFO |
| Filter values (sliders, dates, etc.) | `useState` (object) | Reset to defaults on mode switch |
| Each range filter enabled/disabled | `useState` (per-filter bool) | Drives slider enable/disable switch state |
| Layout toggle (Grid/List) | `useState` | Page-local |
| API data | RTK Query `researchApi` slice | Mirrors `nicheSlice.ts` pattern |
| Polling (Live mode) | RTK Query `pollingInterval: 3000` | Stops when `status !== 'pending'` |

**New RTK Query slice:** `store/researchSlice.ts`

---

### H) Tech Decisions

| Decision | Why |
|----------|-----|
| MUI Switch for Live/DB toggle | Binary on/off is clearer than ToggleButton for a mode change. Placed left of search input so it's seen before typing. |
| Slider panel (not chip+popover) | Reference tools (MerchMatrix, Flying Research) use sliders — the target users are already familiar. More efficient for range inputs than chip+popover interactions. |
| Per-filter enable/disable Switch | User can quickly turn off a filter without losing the range values — matches the reference UI pattern. |
| Star rating selector | More intuitive than a numeric range for "minimum rating" — single click sets the floor. |
| Hide Official Brands as full-width Button | Toggle-button affordance (active/inactive) is immediately scannable. `secondary.main` (#00C8D7) when active signals it's filtering data. |
| `httpx` for autocomplete proxy | Async-compatible, modern, consistent with Django async views if adopted later. |
| MUI Skeleton during polling | Better perceived performance than spinner alone — users see the shape of the data before it arrives. |
| `@mui/x-charts` for BSR sparkline | Already in `package.json`. Consistent with MUI ecosystem. |
| Inline detail panel (not drawer) | Faster comparison across products — user doesn't lose list context. Drawers reserved for deep editing (Niche detail). |
| `research_app` separate from `scraper_app` | Separation of concerns — engine vs user API. Allows PROJ-16 to evolve independently. |
| `StreamingHttpResponse` for CSV | No memory spike on 500+ product exports. |

---

### I) New Packages

**Backend:** No new packages — `httpx`, `django-rq`, `redis` already installed.

**Frontend:** No new packages — `@mui/x-data-grid` and `@mui/x-charts` confirmed present in `package.json`.

### J) Environment Variables

```
SCRAPEOPS_API_KEY=  # Used by PROJ-16 scraper engine (already set)
```

---

### K) File Structure (Frontend)

```
views/amazon/research/
├── AmazonResearchView.tsx        Main page
├── hooks/
│   ├── useResearchMode.ts        Live/DB toggle state + mode-aware fetch logic
│   ├── useFilterState.ts         All filter values + per-filter enable/disable
│   ├── useRecentSearches.ts      localStorage read/write, FIFO max 10
│   └── usePolling.ts             RTK Query polling lifecycle for Live mode
├── partials/
│   ├── SearchBar.tsx             Keyword input + mode switch + search button
│   ├── ControlsRow.tsx           Marketplace / Product Type / Sorting selects
│   ├── AdvancedOptionsPanel.tsx  Sliders + rating + text inputs
│   ├── RangeSliderFilter.tsx     Reusable: MUI Slider + enable switch
│   ├── StarRatingFilter.tsx      Click-to-set star rating selector
│   ├── ResultsToolbar.tsx        Count + layout toggle + copy ASINs + export
│   ├── ProductGrid.tsx           Card layout
│   ├── ProductCard.tsx           Single card with all data fields
│   ├── ProductTable.tsx          MUI DataGrid list layout
│   ├── ProductDetailPanel.tsx    Inline expand: sparkline + bullets + actions
│   ├── LiveProgressBanner.tsx    LinearProgress + polling status text
│   └── EmptyState.tsx            Empty + error states
├── types/
│   └── index.ts                  AmazonProduct, ResearchFilter, SearchCache types
├── schemas/
│   └── searchSchema.ts           Zod: keyword + marketplace required
└── tests/
    ├── AmazonResearchView.test.tsx
    ├── AdvancedOptionsPanel.test.tsx
    └── ProductCard.test.tsx
```
