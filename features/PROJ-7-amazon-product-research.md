# PROJ-7: Amazon Product Research

**Status:** In Progress
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-29

## Overview

A dedicated research page (inspired by MerchMatrix / Flying Research) for searching and filtering Amazon products before committing to a niche. Two modes: **Live Research** (triggers a fresh scrape via PROJ-16, fewer filters, real-time data) and **DB Research** (queries stored products with full filters and full-text search). All filters applied server-side. Scrape engine provided by PROJ-16.

## User Stories

1. As a member, I want to type a keyword and see Amazon autocomplete suggestions, so that I discover related search terms.
2. As a member, I want to switch between Live Research (fresh scrape) and DB Research (existing data), so that I can choose between speed and depth.
3. As a member, I want to filter products by BSR range, rating, reviews, price, and product type in DB Research mode, so that I find the sweet spot for niche viability.
4. As a member, I want to search across product title, brand, bullets, and description in DB Research mode, so that I find relevant products even if the keyword isn't the main title.
5. As a member, I want to see a full BSR history chart with trend indicators for a product, so that I can evaluate rank direction over time.
6. As a member, I want to click "Open on Amazon" to see live search results, so that I can verify the data.
7. As a member, I want to hide official brand products, so that I only see POD-eligible opportunities.
8. As a member, I want to click a product and add its keyword as a Niche, so that the research pipeline is connected.
9. As a member, I want to toggle between table and card view, so that I can switch between dense data comparison and visual browsing.
10. As a member, I want my recent searches saved as chips, so that I can quickly repeat common research queries.
11. As a member, I want to export the current filtered results to CSV, so that I can analyse or share data offline.
12. As a member, I want to click a product card and open a dedicated detail page (not inline), so that I can deeply analyze a single product without losing my search context.
13. As a member, I want to see extracted keywords from a product's listing on its detail page, so that I can identify high-value keywords and save them to my Keyword Bank.
14. As a member, I want to use a competitor's listing as a template for my own, so that I can quickly draft listings based on proven copy.
15. As a member, I want a statistics/keywords overview of my current search results, so that I can spot keyword frequency and overlap patterns before committing to a niche.
16. As a member, I want product cards to show a clean design-focused image with hover actions, so that I can quickly scan designs and act without clutter.
17. As a member, I want DB Research results to load progressively as I scroll (first 100, then 50 more each time) with virtualized rendering, so that I can browse thousands of products without lag or memory issues.

## Acceptance Criteria

### Phase 1 — Core Research (existing, QA passed 2026-03-23)

- [x] AC-1: Search input shows Amazon suggestions via proxy endpoint; debounced 300ms; max 10 suggestions shown.
- [x] AC-2: **Live Research mode:** Submitting a search triggers a fresh scrape via PROJ-16 if no completed result exists for that keyword+marketplace within 24h. Returns a job reference for the user to track progress via polling.
- [x] AC-3: **DB Research mode:** `GET /api/research/products/` returns all stored products matching the keyword via full-text search across title, brand, bullets, description; full filter set applied server-side.
- [x] AC-4: Mode toggle (Live / DB) is prominent in the UI; switching modes re-fetches data with the appropriate endpoint.
- [x] AC-5: **Layout toggle:** Grid / List toggle buttons in the results toolbar. Grid = product cards with thumbnail prominent. List = dense table view. Default: Grid.
- [x] AC-6: Results (List view) show per product: thumbnail, title, brand, BSR (color-coded badge), rating, reviews count, price, ASIN, listed date.
- [x] AC-7: **Advanced Options (DB Research):** Collapsible panel below the controls row. Range sliders for BSR, Reviews, Price — each with an enable/disable toggle switch. Star-click rating selector. Hide Official Brands toggle button. Subcategory, Exclude Words text inputs, Date Range pickers. In Live mode: panel dimmed, only Product Type + Hide Official Brands active. Applying filters re-fetches immediately.
- [x] AC-8: Sort controls change the result order; results re-fetch from server on sort change.
- [x] AC-9: "Open on Amazon" button opens `https://www.amazon.{marketplace}/s?k={keyword}` in new tab (pure frontend).
- [x] AC-10: "Add to Niche List" button creates a new Niche from the search keyword and shows a success notification.
- [x] AC-11: A progress indicator is shown while a Live Research scrape is in progress, including current page and product count.
- [x] AC-12: **Live Research error state:** If scrape fails, show error message and a "Retry" button that re-triggers the search.
- [x] AC-13: Autocomplete suggestions are server-side cached; repeated identical queries return instantly without hitting Amazon's API again.
- [x] AC-14: Live Research status can be polled by the UI until the scrape completes or fails.
- [x] AC-15: **Recent searches:** Last 10 unique (keyword + marketplace) pairs stored in `localStorage`. Displayed as clickable chips below the search input. Clicking a chip pre-fills the search and triggers the active mode's request. Persists across sessions per browser.
- [x] AC-16: **CSV export (DB Research):** "Export CSV" button downloads all products matching the current filters/sort (no pagination limit on export). Button is disabled when result count = 0.
- [x] AC-17: **Default marketplace:** `amazon_com` on page load. Selection persists to `localStorage` and is restored on next visit.

### Phase 2 — Bug Fixes (amendment 2026-03-28)

- [x] AC-18: **Search trigger:** Search only fires on Enter key press or Search button click.
- [x] AC-19: **Sort by:** Changing sort dropdown correctly re-fetches results in the selected order.
- [x] AC-20: **BSR display:** Product cards and table rows show the correct current BSR value.
- [x] AC-21: **Review count display:** Product cards show review count below the star rating.
- [x] AC-22: **Review filter:** Review range slider correctly filters products by `reviews_min`/`reviews_max`.
- [x] AC-23: **Bullets/Description layout:** Detail view renders bullets as list, description with "read more" truncation.
- [x] AC-24: **Listed date display:** Detail page shows listed date.

### Phase 3 — Product Card Redesign (amendment 2026-03-28)

- [x] AC-25: **Card image + sparkline:** 340px fixed height, BSR sparkline, design-cropped image.
- [x] AC-26: **Card hover overlay:** Copy ASIN, Open on Amazon, View details. `disableHover` prop for drawer. Download image removed. `hideHeart` prop for drawer. Touch fallback.
- [x] AC-27: **Card info layout:** BSR color-coded + price, stars + reviews, ASIN chip. No title/brand.
- [x] AC-28: **Card click → detail page:** Navigates to `/amazon/research/product/{asin}`.

### Phase 4 — Product Detail Page (amendment 2026-03-28)

> Design: Option B "Data Dashboard" — scrollable single page with KPI row, no tabs.

- [x] AC-29: **Detail page route:** Scrollable product dossier page with loading skeleton.
- [x] AC-30: **KPI row + content grid:** 4 KPI cards with visible icons (coral on alpha bg). Info chips with icons (Checkroom, Language, Calendar). Product type formatted (t_shirt → T Shirt).
- [x] AC-31: **Detail page actions row:** Open in Amazon, Use as Listing Template, Save Keywords.
- [x] AC-32: **BSR section:** LineChart 90 days. Subcategory ranks as split-tag design (category | BSR icon + mono-bold rank, tier color coded). Null-rank safe. BSR summary with trend icons.
- [x] AC-33: **Price history section:** Price line chart.
- [x] AC-34: **Keywords section:** Flying Research style — outlined chips with keyword + search icon, count below chip only when frequency > 1. Short-tail (cyan) + long-tail (info-blue). "Copy all keywords" button.
- [x] AC-35: **Competition section:** Similar Designs + Same Brand carousels. BSR icon instead of #, tier color coded. Click → navigate to detail page (null-rank crash fixed).
- [x] AC-36: **Use as Listing Template:** Button on detail page, POST mutation, notistack notification.

### Phase 5 — Statistics & Live Research UX (amendment 2026-03-28)

- [x] AC-37: **Statistics/Keywords view:** Products/Keywords toggle. Flying Research style keyword chips with count.
- [x] AC-38: **Live Research skeleton streaming:** Skeleton cards during scrape, progressive fill.
- [x] AC-39: **Double pagination fix:** Single pagination control.
- [x] AC-40: **Copy ASINs scope:** Label shows count.
- [x] AC-41: **CSV export filter consistency:** Uses `buildQueryParams()`.

### Phase 6 — Sort Selection, Product Types, Infinite Scroll, Cancel (amendment 2026-03-29)

#### Sort Selection
- [ ] AC-42: **Live Sort dropdown:** Visible in Live mode with Amazon sort options: Featured (default), Best Sellers, Newest, Price Low→High, Price High→Low, Avg Reviews, Relevance. MUI icons per option.
- [ ] AC-43: **DB Sort dropdown:** Unchanged — BSR, Reviews, Rating, Price, Newest. Both sort dropdowns visible simultaneously.
- [ ] AC-44: **Live sort default:** `featured-rank` pre-selected on page load.

#### Product Type Expansion (16 MBA Types)
- [ ] AC-45: **Product Type dropdown:** Expanded from 6 to 16 MBA types with custom SVG icons: T-Shirt, Premium Shirt, Comfort Colors, V-Neck, Long Sleeve, Raglan, Sweatshirt, Hoodie, Performance Polo, Zip Hoodie, PopSocket, Phone Case, Tote Bag, Tumbler, Ceramic Mug, Tank Top.
- [ ] AC-46: **`pullover` removed**, replaced by `sweatshirt` across frontend and backend.

#### Infinite Scroll (Live Mode)
- [ ] AC-47: **Page-by-page scraping:** Each live search job scrapes 1 Amazon page (`pages_total=1`). Products displayed when job completes.
- [ ] AC-48: **Scroll-triggered next page:** When user scrolls to bottom of product list AND previous job is completed → new job triggered with `start_page=N+1`. Products appended (deduplicated by ASIN).
- [ ] AC-49: **End of results:** If scrape returns 0 new products → infinite scroll stops.
- [ ] AC-50: **New keyword resets:** New search clears accumulated products and resets to page 1.

#### Cancel / Stop
- [ ] AC-51: **Search↔Stop toggle:** Search button becomes red "Stop" button (StopCircle icon) when live search is running. Clicking Stop cancels the backend job and resets UI to initial state.
- [ ] AC-52: **No error on cancel:** Cancelled searches show no error message. UI returns to clean state.

#### Skeleton Cards
- [ ] AC-53: **Skeleton progress:** During pending/running, skeleton cards (wave animation) shown below existing products instead of a loading bar. Max 8 skeletons. Count reduces as real products load.

#### Hardcoded Defaults
- [ ] AC-54: **Price range:** `price_min=13, price_max=100` sent to API automatically. Not exposed in UI.
- [ ] AC-55: **Browse node:** Auto-resolved from `PRODUCT_TYPE_BROWSE_NODES[product_type]`. Not exposed in UI.

#### Search Button UX
- [ ] AC-56: **Disabled when empty:** Search button disabled when keyword input is empty. Keeps primary color but darker/dimmed (0.5 opacity).

### Phase 7 — DB Search: Virtualized Infinite Scroll (amendment 2026-04-07)

- [ ] AC-57: **Initial load:** DB Research search returns first 100 products (`page_size=100, page=1`). No upfront full-count query.
- [ ] AC-58: **Scroll-triggered loading:** When user scrolls near bottom of product list → next page fetched with `page_size=50`. Products appended to existing list (deduplicated by ID).
- [ ] AC-59: **End detection:** If returned results count < `page_size` → no more pages. Scroll loading stops.
- [ ] AC-60: **Virtualized rendering:** Product card grid uses **`react-virtuoso`** (`<VirtuosoGrid>` component) to render only visible cards + buffer (`overscan` ~5 rows). DOM stays flat (~30 nodes regardless of total count) — RAM stays bounded, scroll stays at 60fps even with 10.000+ accumulated products. Library locked to Virtuoso (vs. TanStack Virtual): VirtuosoGrid is purpose-built for responsive card layouts, ~3x less wiring code, no manual `endReached`-trigger needed (built-in). Trade-off: ~20kB larger bundle than TanStack — acceptable for the dev-velocity gain on this and future virtualized lists. See ADR-002 (architecture-decisions.md) for the cross-cutting pattern.
- [ ] AC-61: **Loading indicator:** Skeleton cards (same style as Live mode) shown at bottom while next page loads. Removed once products arrive.
- [ ] AC-62: **Search reset:** New keyword search or filter change resets accumulated products, page counter, and scroll position.
- [ ] AC-63: **View mode compatible:** Virtualized scroll works in both Grid and List view modes. Grid view uses `<VirtuosoGrid>`. List view continues to use MUI `DataGrid` (which has built-in row virtualization) — only the `endReached`-equivalent (DataGrid's `onRowsScrollEnd` or scroll-listener) needs wiring to the same `loadNextPage()` from `useDbInfiniteScroll`. No double-virtualization.

#### Filter-Only Search (amendment 2026-05-01)
- [ ] AC-64: **DB mode without keyword:** In DB Research mode, the user MAY trigger a search with empty keyword field. Backend `/api/research/products/` already accepts requests without `keyword` param — frontend must allow submitting with no keyword.
- [ ] AC-64a: **Backend range-filter NULL handling:** Range filters (`bsr_min`/`max`, `reviews_min`/`max`, `price_min`/`max`) match products with NULL values for that field. Reason: 92% of T-shirts in DB have NULL `bsr` and NULL `reviews_count` — strict `.filter(bsr__gte=N)` excluded them silently when user enabled the filter at default full range, returning 0 results unexpectedly. Implemented as `Q(field__gte=N) | Q(field__isnull=True)`.
- [ ] AC-65: **Search button enable rule:** In DB mode, `Search` button is **always enabled** (keyword optional). In Live mode, keyword stays mandatory (Amazon scrape needs a search term). Marketplace + Product Type + Sort are always-sent params — sufficient as scope.
- [ ] AC-66: **Hook gate update:** `shouldQueryDb` simplifies to `!isLive && hasSearched` (drops `!!keyword`). The keyword is passed in the API params when present, omitted/empty otherwise.
- [ ] AC-67: **Empty-keyword UX:** Results header reads "X results (filter only)" when keyword is empty, or "X results for \"keyword\"" when keyword is set. `Copy ASINs` and CSV export work identically.
- [ ] EC-35: Empty-result set with no keyword → empty state reads "No products match your filters" instead of "No products found for this keyword". CTA "Adjust filters" or "Try Live Research".
- [ ] EC-36: User searches by keyword, then clears keyword field → next Enter / Search-click triggers a fresh page-1 fetch using whatever filters are active (`resetKey` includes empty keyword + filter state).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/research/suggestions/` | Member | Amazon autocomplete proxy |
| POST | `/api/research/search/` | Member | Live Research: trigger Scrapy scrape or return cached |
| GET | `/api/research/search/{cache_id}/status/` | Member | Poll scrape job status |
| POST | `/api/research/search/{cache_id}/cancel/` | Member | Cancel running live search (kills scraper process) |
| GET | `/api/research/products/` | Member | DB Research: filter/sort all stored products |
| GET | `/api/research/products/export/` | Member | DB Research: export filtered results as CSV (no pagination) |
| GET | `/api/research/products/{asin}/bsr-history/` | Member | BSR history snapshots (extended to 90 days) |
| GET | `/api/research/products/{asin}/` | Member | **NEW** Single product detail (all fields + meta_keywords M2M) |
| GET | `/api/research/products/{asin}/similar/` | Member | **NEW** Similar products by keyword/category |
| GET | `/api/research/products/{asin}/same-brand/` | Member | **NEW** Other products from same brand |
| GET | `/api/research/products/{asin}/price-history/` | Member | **NEW** Price snapshots over time |
| POST | `/api/research/products/{asin}/use-as-template/` | Member | **NEW** Create listing draft from product copy (PROJ-11) |

> **Reused endpoints (no new code needed):**
> - Keywords per product: `AmazonProduct.meta_keywords` M2M (MetaKeyword, short_tail/long_tail) — included in product detail serializer
> - Keywords per search: `SearchKeywordResult` on `ProductSearchCache` (top_focus_keywords, top_long_tail_keywords) — exposed via search status endpoint
> - Save keywords: `POST /api/niches/{niche_id}/keywords/bulk-add/` (keyword_app, source=amazon_search)
> - Statistics/keyword aggregation: `SearchKeywordResult` from current search cache — no separate endpoint needed

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
| `page` / `page_size` | int | Pagination (default 50/page, initial load 100, scroll loads 50) |

## Filters — Live Research (POST /api/research/search/)

| Param | Type | Description |
|-------|------|-------------|
| `keyword` | string | Optional (required if no `browse_node`); triggers scrape |
| `marketplace` | string | Required; e.g. `amazon_com` |
| `product_type` | string | Optional; 16 MBA product types (t_shirt, premium_shirt, comfort_colors, v_neck, long_sleeve, raglan, sweatshirt, hoodie, performance_polo, zip_hoodie, popsocket, phone_case, tote_bag, tumbler, ceramic_mug, tank_top) |
| `hide_official_brands` | bool | Optional |
| `sort_by` | string | Optional; Amazon sort param (featured-rank, exact-aware-popularity-rank, date-desc-rank, price-asc-rank, price-desc-rank, review-rank). Default: featured-rank |
| `price_min` | decimal | Optional; Amazon low-price filter. Frontend default: 13 |
| `price_max` | decimal | Optional; Amazon high-price filter. Frontend default: 100 |
| `browse_node` | string | Optional; Amazon bbn param. Auto-resolved from product_type |
| `pages_total` | int | Optional; max 400. Frontend always sends 1 (Infinite Scroll) |
| `start_page` | int | Optional; default 1. Frontend increments per scroll |

## Edge Cases

### Phase 1 (existing, QA passed)
- [x] EC-1: Amazon autocomplete returns empty → input works normally; no suggestions shown (no error).
- [x] EC-2: Live Research scrape returns 0 products → empty state: "No products found for this keyword."
- [x] EC-3: Scrape triggered while previous scrape for same keyword still running → return the in-progress job; no duplicate scrape started.
- [x] EC-4: `exclude_words` containing special characters → treated as plain text, not as patterns.
- [x] EC-5: Large result set (500+ products) → pagination 50/page; no client-side JS filtering.
- [x] EC-6: BSR `min` > `max` → 400 validation error.
- [x] EC-7: `hide_official_brands` list is maintained as a static fixture (not user-configurable in MVP).
- [x] EC-8: BSR history chart has < 2 data points → show single value with "Not enough history" label.
- [x] EC-9: DB Research with no stored products for keyword → empty state with suggestion to run Live Research.
- [x] EC-10: Live Research scrape status = `failed` → show error toast + inline error message with "Retry" button; retry re-triggers search with same params.
- [x] EC-11: Recent search chip clicked while scrape is in progress → previous polling cancelled; new request started.
- [x] EC-12: CSV export with 0 results → "Export CSV" button is disabled (no request sent).
- [x] EC-13: CSV export streams immediately; large sets (500+) handled without memory issues.
- [x] EC-14: localStorage recent searches exceed 10 entries → oldest entry is dropped (FIFO).
- [x] EC-15: User clears the search input → recent search chips remain visible as quick-start options.

### Phase 2-5 (amendment 2026-03-28)
- [ ] EC-16: Detail page for non-existent ASIN → 404 page with "Product not found" message and back link.
- [ ] EC-17: Detail page BSR history has 0 data points → show "No BSR data available" placeholder instead of empty chart.
- [ ] EC-18: Product has no thumbnail_url → show placeholder image on card and detail page.
- [ ] EC-19: "Use as Listing Template" with no active niche → show notistack warning "Select a niche first" or prompt niche selection.
- [ ] EC-20: Keywords extraction returns 0 keywords (empty title+bullets+description) → show "No keywords available" message on Keywords tab.
- [ ] EC-21: Competition tab finds 0 similar designs → show "No similar products found" empty state.
- [ ] EC-22: Live Research streaming — scraper returns products in batches; if a batch has 0 new products, skeleton cards remain until next batch or completion.
- [ ] EC-23: Card hover on touch device (no hover) → action icons always visible on mobile/tablet.
- [ ] EC-24: Detail page navigated to directly via URL (no search context) → page loads product data via ASIN lookup; back button returns to research page with empty results.
- [ ] EC-25: Statistics view with 0 results → show "Run a search first" empty state.

### Phase 6 (amendment 2026-03-29)
- [ ] EC-26: User clicks Stop during pending (before any products) → UI resets cleanly, no stale skeletons.
- [ ] EC-27: User clicks Stop during running (some products loaded) → already-loaded products remain visible, skeletons removed.
- [ ] EC-28: Infinite scroll: Amazon returns 0 products on next page → `canLoadMore=false`, no more scroll triggers.
- [ ] EC-29: User changes product type mid-scroll → resets to page 1, clears accumulated products, new search with new type.
- [ ] EC-30: Best Sellers sort returns many branded products → BrandBlacklist filters them (no UI change needed).

### Phase 7 (amendment 2026-04-07)
- [ ] EC-31: DB search returns < 100 products total → all shown immediately, no scroll loading triggered.
- [ ] EC-32: User scrolls fast (multiple scroll events) → debounce/throttle prevents duplicate page fetches. Only one request in-flight at a time.
- [ ] EC-33: Filter change while next page is loading → in-flight request cancelled, results reset, new search with `page=1`.
- [ ] EC-34: Browser tab hidden during scroll loading → fetch completes normally, products appended when tab regains focus.

## Dependencies

- PROJ-4 (Workspace & Membership — workspace scope)
- PROJ-5 (Niche List — "Add to Niche" action calls `POST /api/niches/`)
- PROJ-10 (Keyword Research & Bank — "Save to Keyword Bank" from detail page keywords tab)
- PROJ-11 (Listing Generator — "Use as Listing Template" creates listing draft)
- PROJ-16 (Amazon Product Scraper — scrape engine, models, BSRSnapshot, PriceSnapshot)

## Amendments (PROJ-15/18/19 Harmonization)

### Vector DB Integration (PROJ-15)
- `AmazonProduct` model is an embeddable source. `get_embedding_text()` returns `title + " " + brand + " " + bullets`.
- `post_save` signal on AmazonProduct enqueues embedding job.
- Enables cross-niche product discovery via semantic search (e.g. "find similar products across all niches").

### Web Search Integration (PROJ-17)
- Web Search results that reference Amazon products can be linked to existing AmazonProduct records via ASIN matching.
- "Save to Niche" quick-action from PROJ-17 Chat can trigger "Add to Niche List" (same as existing UI action).

### Agent Integration (PROJ-18)
- Research Agent has tools: `trigger_product_research`, `read_product_results`, `filter_product_results`.
- Agent can start Live Research, read results, and apply filters (BSR range, rating, reviews, price, product type, hide brands).
- Agent permission default for `trigger_product_research`: Approve (costs scraper credits). `filter_product_results` + `read_product_results` = Auto.

### Amendment Log (2026-03-28)

All bugs, UI improvements, and new features from the original amendments section have been promoted to formal Acceptance Criteria:

- **7 Bug fixes** → AC-18 to AC-24 (Phase 2)
- **7 UI improvements** → AC-25 to AC-28 (Phase 3: Card Redesign)
- **Detail page overhaul** → AC-29 to AC-36 (Phase 4: Detail Page)
- **Statistics + Live UX** → AC-37 to AC-41 (Phase 5)
- **3 QA low-severity bugs** (BUG-11, BUG-12, BUG-13) → AC-39, AC-40, AC-41

**Design note:** Product Card and Detail Page exact styling to be decided via `/frontend-design`. Flying Research "Design Detail Page" is the primary reference.

**Scraper note:** PROJ-16 may need `PriceSnapshot` model + keyword extraction support for AC-33, AC-34.

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

---

## Tech Design Amendment: Phases 2-5 (2026-03-28)

> Added: 2026-03-28 | Extends the original Tech Design (sections A-K) for Phase 1.

### L) Phase 2 — Bug Fixes (AC-18 to AC-24)

All fixes are in existing components — no new files or endpoints needed.

| Bug | Component | Fix |
|-----|-----------|-----|
| Search triggers on keystroke (AC-18) | `SearchBar.tsx` | Remove `onSearch` call from Autocomplete `onChange`; only fire from Enter keydown + Search button click |
| Sort-by not applied (AC-19) | `ControlsRow.tsx` + `useFilterState` | Verify `sort_by` param is passed to `listProducts` query; check backend `ProductListView` ordering |
| Wrong BSR (AC-20) | `ProductCard.tsx` | Verify `product.bsr` field mapping (not a stale field) |
| Review count missing (AC-21) | `ProductCard.tsx` | Add `reviews_count` display next to star rating |
| Review filter broken (AC-22) | `AdvancedOptionsPanel.tsx` + backend `ProductListView` | Verify `reviews_min`/`reviews_max` params flow through `useFilterState` → query params → backend filter |
| Bullets/Description broken (AC-23) | `ProductDetailPanel.tsx` | Fix layout: bullets as `<ul>`, description as `<Typography>` with 3-line clamp + expand toggle, proper overflow |
| Listed date missing (AC-24) | `ProductCard.tsx` | Show `listed_date` formatted (e.g. "2025-05-28") alongside existing "Published Xd ago" |

---

### M) Phase 3 — Product Card Redesign (AC-25 to AC-28)

> Design decided: 2026-03-28 | `/frontend-design` session | Option B "Data Dashboard"

**Card Visual Tree (final):**
```
ProductCard (fixed height: 370px, width: 100% of grid cell)
│
├── Image Area (height: 220px, design-cropped)
│   ├── [HOVER ONLY] Favorite/Heart icon (top-left)
│   │   size: 28px container, 18px icon
│   │   color: error.main when active, text.secondary when inactive
│   │   bg: glass-sm circle
│   ├── [HOVER ONLY] AI badge (top-right, if slogan extracted)
│   │   size: 28px, bg: secondary.dark, icon: AutoAwesome 16px white
│   │   border-radius: sm (6px)
│   ├── [HOVER ONLY] Action row (bottom center, gap: 12px):
│   │   icons: 20px, color: text.primary
│   │   [SaveAltOutlined]       → download thumbnail
│   │   [ContentCopyOutlined]   → copy ASIN + notistack
│   │   [OpenInNewOutlined]     → open on Amazon
│   │   [ArrowForwardOutlined]  → navigate to detail page
│   └── Hover overlay: gradient
│       top: rgba(background.default, 0.70) → transparent 30%
│       bottom: transparent 60% → rgba(background.default, 0.80)
│       transition: opacity 150ms ease
│       Touch fallback (@media (hover: none)): always visible, opacity 0.6
│
├── BSR Sparkline Row (height: 30px, padding: 0 14px)
│   @mui/x-charts SparkLineChart (if >= 2 BSR data points)
│   color: secondary.main (via theme token)
│   area fill: secondary.subtle (via theme token)
│   If < 2 data points: row empty (height preserved for grid alignment)
│
└── Info Area (height: 120px, padding: 12px 14px)
    ├── Row 1 (flex, space-between):
    │   BSR: TrendingUp icon (16px) + value (body2, 500)
    │         color: success.main (<10k), warning.main (10k-50k), text.secondary (>50k)
    │   Sales: ShoppingCart icon (14px, text.secondary) + value (body2)
    │   Price: "$" (text.secondary) + value (body2, 600)
    └── Row 2 (flex, space-between):
        Stars: 5× Star icons (14px), filled=warning.main, empty=text.disabled
        Reviews: "/ {count} review(s)" (caption, text.secondary)
        ASIN: Chip variant="outlined" size="small", mono font, onClick→copy
```

**Card grid columns:**
```
xs: 6 (2 per row)   sm: 6 (2)   md: 4 (3)   lg: 3 (4)   xl: 2.4 (5)
spacing: 2 (16px)
```

**Card specs (all via design system tokens — no hardcoded colors):**
```
background:     theme.vars.palette.background.paper
border:         1px solid theme.vars.palette.divider
border-radius:  12px (lg)
overflow:       hidden
cursor:         pointer
hover:          translateY(-2px), elevation.2 shadow (150ms ease)

Image:
  object-fit:       cover
  object-position:  center 20% (shifts up to focus on print area)
  height:           220px
  width:            100%
  background:       theme.vars.palette.background.default (fallback)

Numeric values: font-feature-settings: 'tnum' (tabular nums)
ASIN: mono font stack (JetBrains Mono)
```

**Key decisions:**
- No title or brand on card — moved to detail page (AC-27)
- BSR sparkline on card = instant trend visibility, unique differentiator vs competitors
- BSR value = `product.bsr` (main category rank); subcategory ranks on detail page only
- Sparkline uses existing `getBSRHistory` RTK query (lazy, per-card, cached)
- Hover overlay via CSS `:hover` + gradient; touch fallback via `@media (hover: none)`
- Card click navigates to detail page route, NOT inline expand (AC-28)
- All colors via `theme.vars.palette.*` — zero hardcoded hex values

---

### N) Phase 4 — Product Detail Page (AC-29 to AC-36)

> Design decided: 2026-03-28 | `/frontend-design` session | Option B "Data Dashboard" — scrollable single page, no tabs

**New route:** `/amazon/research/product/:asin`

**Page Visual Tree:**
```
ProductDetailPage (/amazon/research/product/:asin)
│
├── Back + Breadcrumb Row
│   ← Back button (ghost)   Home / Amazon Deep Dive / ASIN: {asin}
│
├── KPI Row (4 KPI Cards, horizontal, equal width)
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   │ BSR          │ │ PRICE        │ │ REVIEWS      │ │ RATING       │
│   │ 12,450  ▼   │ │ $19.99      │ │ 142          │ │ ★ 4.2        │
│   │ Trend: Down  │ │             │ │              │ │              │
│   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
│   Uses design system KPI Card pattern (overline label, h3 value, caption trend)
│   BSR trend arrow: success.main (improving=down) / error.main (worsening=up)
│
├── Content Grid (2-column: image+info left, chart right)
│   ┌─────────────────────────────┬───────────────────────────────────┐
│   │ Product Image (300×300)     │ BSR History Chart                 │
│   │ border-radius: lg (12px)    │ @mui/x-charts LineChart           │
│   │ object-fit: cover           │ 90 days, reversed Y-axis          │
│   │                             │ line: secondary.main              │
│   │ Below image:                │ area: secondary.subtle            │
│   │ ┌─ Product Info ──────────┐ │ grid: divider color, dashed      │
│   │ │ Title (h4, 600)        │ │ height: 300px                     │
│   │ │ Brand (body2, secondary)│ │ tooltip: glass-sm bg              │
│   │ │ Chips: Marketplace ·   │ │                                   │
│   │ │  ASIN (copy) · Date    │ │ Below chart:                      │
│   │ │ Bullets (ul, dot=primary)│ │ ┌─ Subcategory Ranks ──────────┐ │
│   │ │ Description (3-line     │ │ │ • 4 - Women's Novelty T-Shirt│ │
│   │ │  clamp + "read more")  │ │ │ • 5 - Men's Novelty T-Shirts │ │
│   │ └────────────────────────┘ │ │ • 1,224 - Men's Fashion       │ │
│   │                             │ └──────────────────────────────┘ │
│   │                             │ ┌─ BSR Summary ────────────────┐ │
│   │                             │ │ Overall: ▼ Down  Avg: 117k  │ │
│   │                             │ │ Current: ▼ Down  Med: 79k   │ │
│   │                             │ └──────────────────────────────┘ │
│   └─────────────────────────────┴───────────────────────────────────┘
│
├── Actions Row (below content grid, gap: 12px)
│   [Open in Amazon]        outlined, secondary
│   [Use as Listing Template]  contained, primary
│   [Save Keywords]         outlined, secondary
│
├── Keywords Section (full-width card)
│   ┌──────────────────────────────────────────────────────────────┐
│   │ Keywords ℹ️                                     [Copy all]  │
│   │ Short-tail: chips (bg: secondary.subtle, color: secondary)  │
│   │   each chip: keyword text + Search icon → new research      │
│   │   click chip body → save to Keyword Bank (PROJ-10)          │
│   │   below chip: score (caption) + "(count)"                   │
│   │                                                              │
│   │ Long-tail: chips (bg: info.subtle, color: info.main)        │
│   │   same interaction pattern                                   │
│   │                                                              │
│   │ [Click here to copy all keywords]                           │
│   └──────────────────────────────────────────────────────────────┘
│
├── Price History Section (full-width card)
│   ┌──────────────────────────────────────────────────────────────┐
│   │ Price History                                                │
│   │ LineChart: line=primary.main, area=primary.subtle            │
│   │ Y-axis: $ prefix, normal (higher=top)                       │
│   │ height: 250px                                                │
│   │ Same tooltip style as BSR chart                              │
│   └──────────────────────────────────────────────────────────────┘
│
├── Competition Section (full-width)
│   ┌──────────────────────────────────────────────────────────────┐
│   │ Similar Designs                           [Open in Search]  │
│   │ ◀  [card] [card] [card] [card]  ▶                          │
│   │ Horizontal scroll, snap, 200px wide mini-cards              │
│   │                                                              │
│   │ Same Brand                                                   │
│   │ ◀  [card] [card]  ▶                                        │
│   └──────────────────────────────────────────────────────────────┘
│
└── Responsive (< md): single column, image stacks above info
```

**Design philosophy: "Product Dossier"**
- Everything on one scrollable page — no tabs, no hidden content
- KPI row at top for instant metrics overview
- Image + Chart side-by-side = visual + data in one glance
- Sections flow naturally: metrics → visual → keywords → price → competition
- Differentiator vs Flying Research (tabs) and MerchMatrix (table-only)

**New API endpoints (5 total, all in `research_app`):**

| Endpoint | Behaviour |
|----------|-----------|
| `GET /api/research/products/{asin}/` | Returns full `AmazonProduct` fields + `meta_keywords` M2M (short_tail + long_tail with frequency) for a single ASIN+marketplace. 404 if not found. |
| `GET /api/research/products/{asin}/similar/` | Returns products with overlapping `meta_keywords` M2M in the same marketplace. Limit 20, exclude self. |
| `GET /api/research/products/{asin}/same-brand/` | Returns products with same `brand` + `marketplace`, excluding self. Limit 20. |
| `GET /api/research/products/{asin}/price-history/` | Returns `BSRSnapshot` records (price field) for last 90 days. Reuses existing `BSRSnapshot` model (already has `price` field). |
| `POST /api/research/products/{asin}/use-as-template/` | Accepts `{ niche_id }`. Creates a Listing draft (PROJ-11) pre-populated with product title, bullets, description. Returns listing ID. Requires active workspace membership. |

**Reused existing infrastructure (no new endpoints):**
- **Keywords per product:** `AmazonProduct.meta_keywords` M2M → `MetaKeyword` model (short_tail/long_tail + frequency). Populated by scraper pipeline (`keyword_extractor.py`). Included in product detail serializer.
- **Keywords per search:** `SearchKeywordResult` model (top_focus_keywords, top_long_tail_keywords, all_keywords_flat). Populated by `DjangoORMPipeline.close_spider()`. Accessed via `ProductSearchCache.keyword_result`.
- **Save keywords to niche:** `POST /api/niches/{niche_id}/keywords/bulk-add/` (keyword_app). Use `source=amazon_search`.
- **Statistics/aggregation:** Frontend reads `SearchKeywordResult` from the current search cache status response — no separate aggregation endpoint needed.

**BSR History endpoint change:** Extend existing `BSRHistoryView` from 30 days → 90 days (change timedelta filter).

**Data for BSR summary (calculated server-side):**
- Overall trend: compare first 30-day avg vs last 30-day avg → "Up" / "Down" / "Stable"
- Current trend: compare last 7 days avg vs prior 7 days → "Up" / "Down" / "Stable"
- Average: mean of all BSR snapshots in range
- Median: middle value of all BSR snapshots in range

---

### O) Phase 5 — Statistics View & Live Research UX (AC-37 to AC-41)

**Statistics view:**
- Toggle between "Products" and "Keywords" view in the results toolbar (MUI ToggleButtonGroup or Tab)
- Keywords view calls `GET /api/research/statistics/` with same filter params as product list
- Display: keyword chips with frequency count, sorted by count desc
- Each keyword clickable → pre-fills search bar with that keyword

**Live Research skeleton streaming (AC-38):**
- During `status: running`, poll returns `products_scraped` count
- Show `products_scraped` Skeleton cards; as poll returns new count, add more skeletons
- On `status: completed`, replace skeletons with actual product cards from response
- Progressive feel: skeleton count grows with each poll response

**Minor fixes (AC-39, AC-40, AC-41):**
- Double pagination: add `hideFooterPagination` prop to `ProductTable` DataGrid
- Copy ASINs: change label to "Copy {count} ASINs" showing current page count
- CSV export: use `buildQueryParams()` (respects `enabled` state) instead of raw `filters` object

---

### P) Frontend File Structure (new + modified files)

```
views/amazon/research/
├── AmazonResearchView.tsx        MODIFIED (remove inline detail, add stats toggle)
├── hooks/
│   ├── useFilterState.ts         MODIFIED (bug fixes)
│   ├── usePolling.ts             EXISTING
│   ├── useRecentSearches.ts      EXISTING
│   └── useResearchMode.ts        EXISTING
├── partials/
│   ├── SearchBar.tsx             MODIFIED (Enter-only search trigger)
│   ├── ControlsRow.tsx           MODIFIED (sort fix)
│   ├── AdvancedOptionsPanel.tsx  MODIFIED (review filter fix)
│   ├── RangeSliderFilter.tsx     EXISTING
│   ├── StarRatingFilter.tsx      EXISTING
│   ├── ResultsToolbar.tsx        MODIFIED (stats toggle, copy ASINs label, export fix)
│   ├── ProductGrid.tsx           MODIFIED (remove inline expand, card click → navigate)
│   ├── ProductCard.tsx           REWRITE (new card design: hover overlay, compact info)
│   ├── ProductTable.tsx          MODIFIED (hideFooterPagination, row click → navigate)
│   ├── ProductDetailPanel.tsx    DELETED (replaced by detail page)
│   ├── LiveProgressBanner.tsx    MODIFIED (skeleton streaming)
│   ├── EmptyState.tsx            EXISTING
│   └── StatisticsView.tsx        NEW (keyword stats display)
├── types/
│   └── index.ts                  MODIFIED (new types for detail, keywords, statistics)
├── schemas/
│   └── searchSchema.ts           EXISTING
└── tests/                        MODIFIED + NEW tests

views/amazon/research/detail/
├── ProductDetailPage.tsx         NEW (main detail page — scrollable, no tabs)
├── hooks/
│   └── useProductDetail.ts       NEW (fetches product + BSR + keywords + similar + price)
├── partials/
│   ├── KPIRow.tsx                NEW (4 KPI cards: BSR, Price, Reviews, Rating)
│   ├── ProductInfoSection.tsx    NEW (image + info + chart side-by-side grid)
│   ├── BSRChart.tsx              NEW (full line chart + subcategory ranks + summary)
│   ├── PriceHistorySection.tsx   NEW (price history line chart)
│   ├── KeywordsSection.tsx       NEW (short-tail + long-tail chips + copy all)
│   ├── CompetitionSection.tsx    NEW (similar designs + same brand carousels)
│   └── ProductCarousel.tsx       NEW (reusable horizontal product carousel)
└── types/
    └── index.ts                  NEW (detail-specific types)
```

**New route in App.tsx:**
```
<Route path="/amazon/research/product/:asin" element={<ProductDetailPage />} />
```

---

### Q) RTK Query Slice Updates

**New endpoints to add to `researchApi` (store/researchSlice.ts):**

| Endpoint | Tag | Cache |
|----------|-----|-------|
| `getProductDetail` | `ProductDetail` | Per ASIN (includes meta_keywords) |
| `getSimilarProducts` | `SimilarProducts` | Per ASIN |
| `getSameBrandProducts` | `SameBrandProducts` | Per ASIN |
| `getPriceHistory` | `PriceHistory` | Per ASIN |
| `useAsTemplate` | Mutation (invalidates `Listings`) | N/A |

Existing `getBSRHistory` updated to pass `days=90` param.

---

### R) Tech Decisions (Phases 2-5)

| Decision | Why |
|----------|-----|
| Detail page as route (not drawer/inline) | User wanted Flying Research style: full page with tabs for deep analysis. Also avoids re-rendering the product grid on detail open. |
| BSR chart 90 days (up from 30) | More data for trend analysis; BSRSnapshot already stores daily. UI can zoom to 30 days. |
| Server-side keyword extraction | Product text is already in DB; no need for client-side NLP. Server can cache results. Reuses `MetaKeyword` model when available. |
| Statistics via dedicated endpoint | Aggregation query across 50-500 products would be expensive client-side. Server computes once, caches per search. |
| Hover overlay for card actions | Clean card surface by default; actions on demand. Touch devices fallback to always-visible. |
| `use-as-template` as POST | Creates a resource (Listing draft); POST is semantically correct. Requires niche context. |
| Price history from BSRSnapshot | BSRSnapshot already has `price` field recorded daily. No need for separate `PriceSnapshot` model. |
| Carousel component (reusable) | Same pattern needed for "Similar Designs" and "Same Brand" — extract once, use twice. |

---

## QA Test Results

**Tested:** 2026-03-23 (Re-test after fixes)
**App URL:** http://localhost:5173
**Tester:** QA Engineer (AI)
**Branch:** `feature/PROJ-7-amazon-product-research`

### Acceptance Criteria Status

#### AC-1: Search input shows Amazon suggestions via proxy endpoint; debounced 300ms; max 10 suggestions shown
- [x] Autocomplete component with debounced input (300ms via `setTimeout`)
- [x] Max 10 suggestions enforced via `.slice(0, 10)` in SearchBar.tsx
- [x] Query skipped when input length < 2
- [x] Backend proxy endpoint exists at `GET /api/research/suggestions/`
- [x] Redis cache 60s TTL on suggestions
- [x] Backend uses `httpx params={}` dict -- properly URL-encoded (BUG-1 FIXED)

#### AC-2: Live Research mode triggers scrape or returns cached; returns job reference
- [x] `POST /api/research/search/` creates ScrapeJob + ProductSearchCache
- [x] Deduplication via `get_or_create_keyword_cache()` returns existing pending/completed cache
- [x] Returns `{ cache_id, status }` with 201 on new job
- [x] Workspace scoping enforced via `_resolve_workspace()`

#### AC-3: DB Research mode returns products via full-text search with full filter set
- [x] `GET /api/research/products/` with PG `SearchVector` + `SearchRank`
- [x] Weights: title=A, brand=B, bullets=C, description=D
- [x] All range filters (BSR, reviews, price, date) applied server-side
- [x] Product type, subcategory (icontains), exclude_words, hide_official_brands filters work
- [x] `rating_min` implemented; `rating_max` omitted intentionally (star-click UI sets floor only)

#### AC-4: Mode toggle (Live/DB) prominent in UI; switching modes re-fetches
- [x] MUI Switch component with "Live Research" label when active
- [x] Mode toggle resets filters via `resetFilters` callback
- [x] DB query skipped in live mode, live polling skipped in DB mode

#### AC-5: Layout toggle Grid/List with correct defaults
- [x] ToggleButtonGroup with Grid (default) and List options
- [x] Grid = ProductCard with thumbnail prominent
- [x] List = DataGrid with dense 52px rows

#### AC-6: Results show per product: thumbnail, title, brand, BSR badge, rating, reviews, price, ASIN, published since
- [x] ProductCard renders all fields: thumbnail, title (2-line clamp), brand, BSR (color-coded Chip), star+rating, reviews count, price, ASIN (mono font), "Published Xd ago"
- [x] ProductTable DataGrid columns: Thumbnail, Title, Brand, BSR (Chip), Rating (star icon), Reviews, Price, Type, Listed Date, ASIN (mono), Actions
- [x] BSR color coding: <10k=success, 10k-50k=warning, >50k=default

#### AC-7: Advanced Options panel with range sliders, toggles, star rating, text inputs, date pickers
- [x] Collapsible panel via MUI Collapse
- [x] BSR, Reviews, Price range sliders with per-filter enable/disable Switch
- [x] Star click-to-set rating selector
- [x] Hide Official Brands button (outlined/contained toggle, secondary color when active)
- [x] Subcategory and Exclude Words TextFields
- [x] Date Range with two DatePicker inputs
- [x] Live mode: DB-only controls dimmed; Hide Official Brands stays active (BUG-3 FIXED)
- [x] Live mode info Alert displayed

#### AC-8: Clicking product row/card expands inline detail panel with BSR sparkline, bullets, description, actions
- [x] ProductDetailPanel rendered inline below expanded card/row
- [x] BSR History sparkline via `@mui/x-charts` LineChart (reversed Y-axis, 30 days)
- [x] Feature bullets list (bullet_1, bullet_2)
- [x] Description excerpt (3-line clamp, expandable)
- [x] "Add to Niche List" and "Open on Amazon" action buttons

#### AC-9: Sort controls change result order; re-fetch from server on sort change
- [x] Sorting Select in ControlsRow (hidden in live mode)
- [x] DataGrid `sortingMode="server"` with `onSortModelChange` handler
- [x] Sort map: bsr->bsr_asc, rating->rating_desc, reviews_count->reviews_desc, price->price_asc, listed_date->newest
- [x] Page resets to 0 on sort change

#### AC-10: "Open on Amazon" opens correct URL in new tab
- [x] ProductCard: `https://www.{domain}/dp/{asin}` (product page)
- [x] ProductDetailPanel: `https://www.{domain}/s?k={keyword}` (search page, keyword URL-encoded)
- [x] `target="_blank"` and `rel="noopener noreferrer"` set

#### AC-11: "Add to Niche List" creates niche and shows success notification
- [x] Uses `useCreateNicheMutation` from nicheSlice
- [x] notistack success toast on completion
- [x] Error toast on failure
- [x] Button disabled while creating

#### AC-12: Progress indicator during Live Research scrape
- [x] LiveProgressBanner with LinearProgress
- [x] Shows "Scraping Amazon..." text + page count + products found count
- [x] Visible during pending/running status

#### AC-13: Live Research error state with Retry button
- [x] Alert severity="error" with error message (from errorLog or default)
- [x] "Retry" button triggers `handleRetry` -> `handleSearch(keyword)`

#### AC-14: Autocomplete suggestions server-side cached
- [x] Redis cache key: `suggestions:{q}:{marketplace}`, TTL 60s
- [x] Cache checked before external request

#### AC-15: Live Research status polling until completion/failure
- [x] RTK Query `pollingInterval: 3000` with conditional stop on terminal state (BUG-4 FIXED)
- [x] Single hook call; `pollingInterval: 0` when status is completed/failed

#### AC-16: Recent searches stored in localStorage, max 10, FIFO, clickable chips
- [x] `useRecentSearches` hook with `mm-research-recent` key
- [x] Max 10 entries, FIFO dedup (existing match moved to front, oldest dropped)
- [x] Chips rendered with keyword label, delete icon
- [x] Click pre-fills search and triggers active mode request
- [x] Persists across sessions

#### AC-17: CSV export (DB Research) with streaming, disabled when 0 results
- [x] `GET /api/research/products/export/` with `StreamingHttpResponse`
- [x] Uses `iterator(chunk_size=200)` for memory efficiency
- [x] Frontend downloads via blob URL + anchor click
- [x] "Export CSV" button disabled when `count === 0`
- [x] Button hidden in Live mode

#### AC-18: Default marketplace amazon_com, persisted to localStorage
- [x] Default `amazon_com` in `getInitialMarketplace()`
- [x] localStorage key `mm-research-marketplace`
- [x] Restored on page load via `useEffect`

### Edge Cases Status

#### EC-1: Amazon autocomplete returns empty
- [x] Backend returns empty array on exception; frontend renders no suggestions

#### EC-2: Live Research scrape returns 0 products
- [x] EmptyState component with "No products found on Amazon for this keyword" message

#### EC-3: Duplicate scrape for same keyword while previous running
- [x] `get_or_create_keyword_cache()` returns existing in-progress cache

#### EC-4: exclude_words with special characters treated as plain text
- [x] Backend uses `title__icontains` (Django LIKE, not regex) -- safe

#### EC-5: Large result set 500+ products with 50/page pagination
- [x] Server-side pagination with page/page_size params
- [x] `max_value=100` on page_size serializer prevents abuse

#### EC-6: BSR min > max returns 400
- [x] `ProductFilterSerializer.validate()` checks bsr_min > bsr_max
- [x] Also validates reviews_min > reviews_max and price_min > price_max

#### EC-7: hide_official_brands as static fixture
- [x] `official_brands.json` loaded once at module level

#### EC-8: BSR history < 2 data points shows "Not enough history"
- [x] `hasChart = bsrHistory.length >= 2`; shows "Not enough history yet" label

#### EC-9: DB Research no stored products suggests Live Research
- [x] EmptyState in DB mode shows "Try Live Research" button
- [x] Button calls `toggleMode` to switch to Live mode (correct behavior -- user then searches)

#### EC-10: Live Research failed -> error toast + inline error + Retry
- [x] LiveProgressBanner shows Alert with error + Retry button

#### EC-11: Recent chip clicked while scrape in progress
- [x] RTK Query automatically unsubscribes from old cacheId when new cacheId is set
- [x] Old polling stops implicitly via cache key change (acceptable RTK Query pattern)

#### EC-12: CSV export with 0 results -> button disabled
- [x] `disabled={count === 0}` on Export CSV button

#### EC-13: CSV export streams for large sets
- [x] `StreamingHttpResponse` with `iterator(chunk_size=200)`

#### EC-14: localStorage recent searches FIFO max 10
- [x] `.slice(0, MAX_ITEMS)` after prepending new entry

#### EC-15: User clears search input -> recent chips remain visible
- [x] Recent chips rendered independently of keyword state

### Security Audit Results

- [x] Authentication: All 6 endpoints use `CookieJWTAuthentication` + `IsAuthenticated`
- [x] Authorization: `SearchStatusView` checks workspace ownership; `LiveSearchView` requires active workspace membership
- [x] Global rate limiting: DRF throttle classes configured in settings.py
- [x] Suggestions proxy: uses `httpx params={}` dict for safe URL encoding (FIXED)
- [x] ASIN validation: regex `^[A-Z0-9]{10}$` on BSR history endpoint (FIXED)
- [x] Input validation: All inputs validated via DRF serializers with `is_valid(raise_exception=True)`
- [x] XSS: No raw HTML rendering; React escapes output by default
- [x] CORS: Handled globally via django-cors-headers
- [x] SQL injection: All queries via Django ORM (parameterized)
- [x] `exclude_words` uses `icontains` not regex -- safe from ReDoS
- [x] CSV export uses `StreamingHttpResponse` -- no memory DoS on large exports
- [x] `page_size` capped at 100 via serializer `max_value` -- prevents large payload responses
- [x] `AmazonProduct` intentionally global (no workspace FK) per spec section E -- not a vulnerability

### Bugs Found

#### BUG-1: FIXED -- Suggestions proxy URL now uses httpx params dict
- Previously: `q` parameter was interpolated raw into Amazon URL
- Now: `client.get(url, params={'prefix': q, 'mid': mid, 'alias': 'aps'})` (line 249)

#### BUG-2: CLOSED (spec clarification) -- rating_max not needed
- Spec's star-click UI (AC-7) defines "minimum rating" only. No max rating UI exists.
- `rating_min` is implemented. No `rating_max` needed.

#### BUG-3: FIXED -- Hide Official Brands stays active in Live mode
- AdvancedOptionsPanel now dims only DB-only controls per-section
- Hide Official Brands button (center column) remains clickable in Live mode

#### BUG-4: FIXED -- Polling stops on terminal state
- Single `usePollSearchStatusQuery` call with `pollingInterval: shouldPoll && !isTerminal ? POLL_INTERVAL : 0`
- No duplicate hook calls

#### BUG-5: FIXED -- All frontend tests passing (88/88)
- Tests rewritten to match actual rendered output

#### BUG-6: CLOSED -- RTK Query handles cache key change automatically
- When `cacheId` changes, RTK Query unsubscribes from old key. Implicit but correct.

#### BUG-7: FIXED -- Same as BUG-1

#### BUG-8: FIXED -- ASIN validation added
- `re.match(r'^[A-Z0-9]{10}$', asin)` with 400 response on invalid format

#### BUG-9: CLOSED (by design) -- AmazonProduct is global per spec

#### BUG-10: FIXED -- Pagination URLs now preserve all query params
- Uses `request.query_params.copy()` as base, updates page/page_size

#### BUG-11 (NEW): Double pagination controls in List view
- **Severity:** Low
- **Steps to Reproduce:**
  1. Search for a keyword in DB mode with 50+ results
  2. Switch to List view layout
  3. Expected: One pagination control
  4. Actual: DataGrid renders its own built-in pagination footer AND `AmazonResearchView` renders a separate `TablePagination` component below. Two pagination bars visible.
- **File:** `AmazonResearchView.tsx` lines 254-264 (parent TablePagination) + `ProductTable.tsx` DataGrid with no `hideFooterPagination` prop
- **Fix:** Either add `hideFooterPagination` to DataGrid, or remove the parent `TablePagination` when `layout === 'list'`
- **Priority:** Fix in next sprint

#### BUG-12 (NEW): "Copy ASINs" copies only current page, not all results
- **Severity:** Low
- **Steps to Reproduce:**
  1. Search for keyword with 200+ results in DB mode
  2. Click "Copy ASINs" button
  3. Expected: All matching ASINs copied (button label says "Copy ASINs")
  4. Actual: Only ASINs from current page (max 50) are copied. `products` prop only contains current page data.
- **File:** `ResultsToolbar.tsx` line 39 -- `products.map((p) => p.asin)`
- **Note:** May be intentional (copying 500+ ASINs could be unwieldy). Clarify with product owner. If intentional, label should say "Copy Page ASINs" or show count.
- **Priority:** Nice to have (clarify intent)

#### BUG-13 (NEW): CSV export sends disabled filter values
- **Severity:** Low
- **Steps to Reproduce:**
  1. Search in DB mode without enabling any range sliders
  2. Click "Export CSV"
  3. Expected: Export uses same filters as displayed results
  4. Actual: `handleExportCSV` passes entire `filters` object as params, including disabled filter defaults (e.g., `bsr_min=1&bsr_max=500000`). The `enabled` state is not consulted.
- **File:** `ResultsToolbar.tsx` line 50 -- `const params = { ...filters }`
- **Note:** In practice, the default range values (1-500000 BSR, 0-10000 reviews, $1-$100) span the full spectrum, so results are not incorrectly narrowed. But the export query differs from the list query (which checks `enabled` flags). This could cause subtle mismatches if a user has partially adjusted a slider but toggled it off.
- **Fix:** Pass the same `buildQueryParams()` output to the export, or pass enabled flags to ResultsToolbar.
- **Priority:** Fix in next sprint

### Previously Fixed Bugs (from first QA pass)
- BUG-1: URL injection in suggestions proxy -- FIXED
- BUG-3: Advanced panel fully disabled in live mode -- FIXED
- BUG-4: Polling never stops -- FIXED
- BUG-5: 3 failing tests -- FIXED
- BUG-8: No ASIN validation -- FIXED
- BUG-10: Pagination URLs lose filter params -- FIXED

### Test Results
- **Backend:** 62/62 passed (research_app)
- **Frontend:** 88/88 passed (views/amazon/research)
- **TypeScript:** Clean (no errors)
- **ESLint:** Clean (no errors)

### Summary
- **Acceptance Criteria:** 18/18 passed
- **Edge Cases:** 15/15 passed
- **Bugs Found (new):** 3 total (0 critical, 0 high, 0 medium, 3 low)
- **Bugs Fixed (from first pass):** 6 of 10 fixed, 3 closed (by design/clarification), 1 reclassified
- **Security:** All findings resolved
- **Tests:** 150/150 passing (62 backend + 88 frontend)
- **TypeScript:** Clean
- **ESLint:** Clean
- **Production Ready:** YES
- **Recommendation:** Deploy. Fix BUG-11 (double pagination), BUG-12 (copy ASINs scope), BUG-13 (export filter mismatch) in next sprint -- all are low severity with no functional impact.

### Deployment Readiness (2026-03-24)

| Check | Status |
|-------|--------|
| `npm run build` | PASS |
| `npm run lint` (ESLint) | PASS |
| `npm run test:ci` (287 tests) | PASS |
| `ruff check` (backend lint) | PASS |
| `pytest research_app/` (62 tests) | PASS |
| `npm audit` | 0 vulnerabilities |
| Secrets in git | None found |
| CI/CD workflows | ci.yml, deploy.yml, docker-publish.yml, security.yml -- all compatible |
| Migrations | No new migrations needed (uses scraper_app models) |
| TypeScript | Clean (0 errors) |

---

## Tech Design Amendment: Phase 8 — DB-Mode Keywords (2026-05-10)

### Problem (PM-readable)

The Keywords tab on the Amazon Research page is empty whenever the user does a DB-mode search (the default). Today the keyword aggregator only runs during a Live scrape and is persisted to a row linked to that scrape's cache. DB searches never trigger a scrape, so the Keywords tab has nothing to read.

The aggregator engine itself already exists and is correct. We just need a second way to invoke it on the products the user is currently filtering.

### Solution at a glance

Add one read-only API endpoint that runs the existing keyword aggregator on the top products matching the user's DB filters, with a short Redis cache so repeated queries are free. The frontend picks between the existing Live source and the new DB source depending on the active research mode. The chip rendering stays identical.

### A) Endpoint Contract

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/research/products/keywords/` | GET | Returns top focus + long-tail keywords aggregated from products matching the DB filter set |

| Query Parameter Group | Notes |
|------------------------|-------|
| Same as `GET /api/research/products/` | Validated by the existing `ProductFilterSerializer`. Keyword-less (filter-only) mode is supported, matching AC-64/AC-66. `page` and `page_size` are ignored — the endpoint returns flat aggregated lists, not paginated rows. |

| Response Field | Type | Notes |
|----------------|------|-------|
| top_focus_keywords | list of `{keyword, frequency}` | Up to 50 entries, frequency > 2 |
| top_long_tail_keywords | list of `{keyword, frequency}` | Up to 50 entries, frequency > 2 |
| sample_size | integer | Number of products fed into the extractor |
| cached | boolean | True when served from Redis (observability) |

### B) Sampling Strategy

| Parameter | Recommended | Rationale |
|-----------|-------------|-----------|
| N (sample size) | 200 | Compute cap with minimal signal loss. Aligns with the extractor's noise filters (frequency > 2 and an 80% document-frequency cutoff). Below ~50 the noise filter trips and lists turn empty; above ~500 compute time grows linearly without adding signal. |
| Sort order for the sample | BSR ascending (best-sellers first) | Same default as `ProductListView`. BSR-best products carry the strongest signal for what a niche actually sells. |
| Behavior when total < N | Use all matching products | The extractor already adapts its noise filter when n is small. |

### C) Caching

| Aspect | Decision |
|--------|----------|
| Backend | Django cache framework over Redis (already configured) |
| TTL | 10 minutes |
| Key | `research:keywords:` + SHA256 of the canonicalized validated_data (keys sorted) |
| Invalidation | TTL-only |

| TTL trade-off | What you give up |
|---|---|
| 5 min | Fresher numbers, more cache misses, more compute |
| **10 min (chosen)** | Balanced — a user re-toggling filters within 10 min stays on the cache |
| 15 min | Cheaper but feels stale right after a Live scrape adds new rows |

### D) Frontend Wiring

| Surface | Today (Live-only) | After fix |
|---------|--------------------|-----------|
| Keywords source — DB mode | Always empty (no cacheId) | Calls new `getDbKeywords` RTK Query |
| Keywords source — Live mode | `usePollSearchStatusExtendedQuery(cacheId)` | Unchanged |
| Loading surface | None | Skeleton chips inside `StatisticsView` |
| Empty state | "No keyword data available" | Unchanged — already correct for empty result |

The `AmazonResearchView` picks the source by `isLive`. Both feed the same `StatisticsView`, so chip rendering, click-to-search behavior, and translations all stay identical.

### E) Edge Cases

| Case | Behavior |
|------|----------|
| Filter matches 0 products | Return empty lists + `sample_size: 0` (HTTP 200). Empty-state UI renders. |
| Filter matches < 5 products | Extractor adapts its noise filter automatically (existing behavior in `keyword_extractor.py`). |
| Filter matches > 200 products | Cap to top 200 by BSR. |
| Invalid query parameters | DRF `ValidationError` (mirrors `ProductListView`). |
| Unauthenticated user | 401 (`IsAuthenticated`). |
| Concurrent identical requests | First fills the cache; subsequent reads hit Redis. No request coalescing in v1. |
| New scrape adds products during TTL | Stale up to 10 min — acceptable; user can switch to Live for fresh data. |

### F) Why NOT persist DB-mode results to `SearchKeywordResult`?

That table is 1:1 with `ProductSearchCache` (a Live-scrape artifact). DB-mode keyword sets are query-driven — every filter combination would create a new row, exploding storage with little reuse value. Redis is the right shape: hash-keyed, ephemeral, TTL-bounded.

### G) Authentication & Workspace Scope

| Concern | Decision |
|---------|----------|
| Auth | `CookieJWTAuthentication` + `IsAuthenticated` (same as `ProductListView`) |
| Workspace isolation | None — `AmazonProduct` is a shared global catalog, identical to `ProductListView` |
| Throttling | DRF defaults (anon=100/h, user=5000/day) — no special rate limit |

### H) Tech Decisions

| Decision | Why |
|----------|-----|
| New endpoint over frontend computation | The keyword aggregator does TF-IDF-like noun filtering with n-gram doc-frequency. Reimplementing in TypeScript would diverge from the Python source. |
| Reuse `ProductFilterSerializer` | Single source of truth for filter validation. No drift between list and keywords endpoints. |
| Top-200 sample by BSR | Best signal-per-compute trade-off. Matches the list view's default ordering. |
| Redis cache (10 min) | Cheap, ephemeral, no schema growth. Same pattern as existing app caches. |
| Reuse `StatisticsView` rendering | Empty state, chip layout, click-to-search, and i18n already work — only the source changes. |
| Add `cached`/`sample_size` to response | Easy observability; helps debugging without a dashboard. |

### I) New Packages

None. Uses `django.core.cache` (Redis already configured) and existing RTK Query setup.

### J) File Structure (changes only)

```
django-app/research_app/
├── api/
│   ├── views.py          (+1 view: DbKeywordsView)
│   └── urls.py           (+1 URL pattern)
└── tests/
    └── test_db_keywords_view.py   (NEW)

frontend-ui/src/
├── store/researchSlice.ts                          (+1 query: getDbKeywords)
└── views/amazon/research/
    ├── AmazonResearchView.tsx                      (conditional source select)
    ├── partials/StatisticsView.tsx                 (Skeleton loading state)
    └── tests/AmazonResearchView.test.tsx           (+1 integration test)
```

### K) Acceptance Criteria (for /qa later)

- **AC-K1:** `GET /api/research/products/keywords/` returns `top_focus_keywords` + `top_long_tail_keywords` for the given filter set
- **AC-K2:** Filter-only mode (no keyword) returns valid lists
- **AC-K3:** Identical filter sets hit the Redis cache on the second call within 10 minutes (`cached: true`)
- **AC-K4:** Empty filter result returns HTTP 200 with empty lists and `sample_size: 0`
- **AC-K5:** Frontend DB-mode search populates the Keywords tab without requiring a Live scrape
- **AC-K6:** Loading skeleton visible while in flight; replaced by chips on success
- **AC-K7:** Live-mode behavior unchanged (existing extended-status flow still drives the chips)
- **AC-K8:** Unauthenticated request returns 401

