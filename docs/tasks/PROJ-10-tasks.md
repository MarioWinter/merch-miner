# PROJ-10: Keyword Research & Bank — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `keyword_app` — 4 models, 14 endpoints, separate domain from ideas/slogans
- **No dedicated worker** — JS API calls are fast (<2s), default queue sufficient
- **30-day cache in DB** (not Redis) — persistent, queryable for expiry checks
- **`junglescout-python-client`** — official Python client (async + sync)
- **Amazon Autocomplete** reuses `research_app` proxy endpoint (PROJ-7)
- **Auto-import via signal** — `post_save` on NicheResearch(status=completed)
- **Design template FK** on NicheKeyword — direct link for PROJ-11 auto-injection

---

## Phase 1: Backend Foundation

- [ ] Create `keyword_app/` Django app, register in `INSTALLED_APPS`
- [ ] Create `keyword_app/api/` + `keyword_app/services/` subpackages
- [ ] Wire into `core/urls.py` under `/api/keywords/` and `/api/niches/{id}/keywords/`
- [ ] `NicheKeyword` model: UUID pk, `niche` FK (CASCADE), `keyword` CharField(200), `source` choices (research/amazon_search/web_search/manual/junglescout), `group` FK (nullable), `design_template` FK (Design, nullable), `created_by` FK (nullable), `created_at`. `unique_together = [('niche', 'keyword')]`
- [ ] `NicheKeywordGroup` model: UUID pk, `niche` FK (CASCADE), `name` CharField(100), `position` PositiveIntegerField, `created_by` FK, `created_at`. `unique_together = [('niche', 'name')]`
- [ ] `KeywordJSCache` model: UUID pk, `keyword` CharField(200), `marketplace` CharField(20), all 14 JS data fields (monthly_search_volume_exact/broad, monthly_trend, quarterly_trend, ppc_bid_exact/broad, sp_brand_ad_bid, ease_of_ranking_score, relevancy_score, organic_product_count, sponsored_product_count, dominant_category, recommended_promotions), `fetched_at` DateTimeField. `unique_together = [('keyword', 'marketplace')]`. Index on `fetched_at`
- [ ] `NicheJSCallTracker` model: UUID pk, `niche` FK (unique), `called_at`, `keyword_used` CharField(200)
- [ ] `KeywordProductCount` model (AC-4b): UUID pk, `keyword` CharField(200), `marketplace` CharField(20), `product_count` PositiveIntegerField, `fetched_at` DateTimeField. `unique_together = [('keyword', 'marketplace')]`. No auto-expiry — data always shown, refreshed only on explicit user action
- [ ] Initial migration
- [ ] Admin registration
- [ ] `junglescout-python-client` in `requirements.txt`
- [ ] Env vars: `JUNGLESCOUT_API_KEY_NAME`, `JUNGLESCOUT_API_KEY`, `JUNGLESCOUT_DEFAULT_MARKETPLACE` in `.env.template`

---

## Phase 2: Backend Services

- [ ] `services/junglescout_service.py`: JS API wrapper — `keywords_by_keyword()` (primary), `historical_search_volume()` (trends)
- [ ] Cache logic: check `KeywordJSCache` for keyword+marketplace. If exists AND `fetched_at` < 30 days → return cache. Else → call JS API → upsert cache
- [ ] `NicheJSCallTracker` check: before JS call, verify niche doesn't already have tracker record. If exists → use cache only
- [ ] Cost logging: log every JS API call in `SearchUsageLog` (for analytics)
- [ ] `services/autocomplete_service.py`: reuse `research_app` suggestions endpoint (or call internally). Merge with DB results
- [ ] `services/auto_import.py`: `post_save` signal on NicheResearch. When `status=completed` → auto-insert `top_focus_keywords` + `main_short_tail` from NicheKeywordAnalysis as `source=research`. Skip duplicates silently
- [ ] `services/product_count_scraper.py` (AC-9b): lightweight Amazon Page 2 scraper. Fetches search results page via ScraperOps proxy, extracts result count from `div.sg-col-inner h2 span` header (parse "X-Y of **N** results for" → extract N). Uses Page 2 (not Page 1) because Amazon shows inflated count on Page 1. Upserts `KeywordProductCount` record
- [ ] **PROJ-16 cross-reference** (AC-9d): PROJ-16 Scrapy Spider should extract result count from Page 2 HTML as side-effect during product scraping and upsert `KeywordProductCount`. Task tracked in PROJ-16 task file — add a note there when implementing

---

## Phase 3: Keyword Research API

- [ ] `GET /api/keywords/search/` — merged results: DB keywords matching query (NicheKeyword + NicheKeywordAnalysis full-text) + Amazon Autocomplete. Per result: `source` tag, `in_product_count`, `in_slogan_count` (computed via DB COUNT on AmazonProduct + Idea). Paginated
- [ ] `POST /api/keywords/enrich/` — body: `{keywords: [...], marketplace}`. Check cache first (30d). Only call JS for uncached/expired. Return enriched data. Log in SearchUsageLog
- [ ] `GET /api/keywords/{keyword}/history/` — params: marketplace, start_date, end_date. Call JS `historical_search_volume`. Return trend data for chart
- [ ] `GET /api/keywords/export/` — same filters as search. StreamingHttpResponse CSV. Includes JS data where cached
- [ ] `POST /api/keywords/product-count/` (AC-9b) — body: `{keyword, marketplace}`. Calls `product_count_scraper` service. Upserts `KeywordProductCount`. Returns `{keyword, marketplace, product_count, fetched_at}`. Uses ScraperOps proxy
- [ ] Extend `GET /api/keywords/search/` response (AC-9c): include `amazon_product_count` + `product_count_fetched_at` per keyword from `KeywordProductCount` cache. Always show existing data regardless of age — no auto-refresh

---

## Phase 4: Keyword Collection API (per Niche)

- [ ] `GET /api/niches/{id}/keywords/` — all keywords for niche, ordered by group then position. Filterable: `?source=`, `?group_id=`. Workspace-scoped
- [ ] `POST /api/niches/{id}/keywords/` — add keyword. Body: `{keyword, source, group_id}`. 409 on duplicate
- [ ] `POST /api/niches/{id}/keywords/bulk-add/` — body: `{keywords: [{keyword, source}], group_id}`. Skip duplicates silently
- [ ] `DELETE /api/niches/{id}/keywords/{keyword_id}/` — remove keyword
- [ ] `POST /api/niches/{id}/keywords/bulk-delete/` — body: `{ids: [...]}`
- [ ] `PATCH /api/niches/{id}/keywords/{keyword_id}/` — update group, position, design_template

---

## Phase 5: Keyword Groups API

- [ ] `GET /api/niches/{id}/keyword-groups/` — list groups for niche, ordered by position
- [ ] `POST /api/niches/{id}/keyword-groups/` — create group. Body: `{name}`. 409 on duplicate name
- [ ] `PATCH /api/niches/{id}/keyword-groups/{group_id}/` — update name, position
- [ ] `DELETE /api/niches/{id}/keyword-groups/{group_id}/` — delete group. Keywords become ungrouped (group=null), not deleted

---

## Phase 6: Serializers

- [ ] `NicheKeywordSerializer` — all fields, nested `group` (id + name), nested `design_template` (id + slogan), `js_data` (from KeywordJSCache if available)
- [ ] `KeywordSearchResultSerializer` — keyword, source, in_product_count, in_slogan_count, js_data (nullable), amazon_product_count (nullable), product_count_fetched_at (nullable)
- [ ] `KeywordProductCountSerializer` — keyword, marketplace, product_count, fetched_at
- [ ] `KeywordJSCacheSerializer` — all 14 JS data fields + fetched_at
- [ ] `NicheKeywordGroupSerializer` — id, name, position, keyword_count
- [ ] `KeywordEnrichSerializer` — request: keywords list + marketplace. Response: enriched keyword data
- [ ] `KeywordHistorySerializer` — trend data points for chart

---

## Phase 7: Frontend — State & Services

- [ ] RTK Query `keywordApi` slice (`store/keywordSlice.ts`): searchKeywords, enrichKeywords, getHistory, exportCSV, scrapeProductCount, listNicheKeywords, addKeyword, bulkAddKeywords, deleteKeyword, bulkDeleteKeywords, updateKeyword, listGroups, createGroup, updateGroup, deleteGroup
- [ ] Cache tags: `NicheKeywords`, `KeywordGroups`, `KeywordSearch`, `KeywordProductCount`
- [ ] Register slice in `store/index.ts`
- [ ] TypeScript types: NicheKeyword, NicheKeywordGroup, KeywordJSData, KeywordSearchResult, KeywordSource, KeywordHistoryPoint, KeywordProductCount

---

## Phase 8: Frontend — Keyword Research Page

- [ ] `KeywordResearchView.tsx`: full-page route `/keywords`. SearchBar + DataGrid + TrendChart + AddToNiche
- [ ] `useKeywordSearch` hook: search query → merged results (DB + Autocomplete). Search fires ONLY on Enter key or Search button click (AC-5b) — NOT on every keystroke. Autocomplete dropdown suggestions remain live (debounced 300ms). Same pattern as PROJ-7 `useProductSearch`
- [ ] `useJSEnrich` hook: enrich selected keywords on-demand, loading states per row
- [ ] `useKeywordExport` hook: trigger CSV export with current filters
- [ ] `KeywordSearchBar.tsx`: MUI Autocomplete with Amazon suggestions (reuses PROJ-7 endpoint). Includes Search button (primary, right of input). Search fires on Enter or button click (AC-5b)
- [ ] `KeywordTable.tsx`: MUI DataGrid with configurable columns. Default visible: keyword, source, search volume, CPC, in_products, in_slogans. Server-side sort + pagination. Sticky header row — stays visible when scrolling (AC-5c)
- [ ] `ColumnPicker.tsx`: MUI Popover with checkbox list for column visibility. Persisted to localStorage
- [ ] `ProductCountColumn` in `KeywordTable.tsx` (AC-9c): "Amz Products" column displaying "> 526" format (like Flying Research). Shows cached data regardless of age. Empty/dash when no data exists
- [ ] `ProductCountRefreshButton` per row (AC-9b): 🔄 icon button that triggers `scrapeProductCount` mutation. Loading spinner while scraping. On success → column updates with new count. On error → error toast, existing data stays visible
- [ ] `EnrichButton.tsx`: per-row "Enrich" icon button + bulk "Enrich Selected" button. Loading spinner per row. Disabled when no JS API key configured
- [ ] `TrendChart.tsx`: @mui/x-charts LineChart — 12 months historical search volume. Opens on keyword click. "Not enough data" fallback
- [ ] `AddToNicheButton.tsx`: context-aware — when niche is active in Drawer: "Add X to {niche name}". Otherwise: MUI Menu with niche search/select. "Change Niche" fallback link
- [ ] `SourceBadge.tsx`: MUI Chip per source — research (primary), amazon (warning), web_search (info), manual (default), junglescout (success)
- [ ] `EmptyState.tsx`: no results → CTA to try different keyword or enrich
- [ ] Route registered in `App.tsx`

---

## Phase 9: Frontend — Drawer Keywords Section

- [ ] `DrawerKeywordsSection.tsx`: Keywords tab in NicheDetailDrawer. Lists all keywords grouped by NicheKeywordGroup
- [ ] `KeywordGroupList.tsx`: ordered list of groups. Drag-to-reorder (dnd-kit). "Add Group" button
- [ ] `KeywordGroupCard.tsx`: group header (name, count, edit/delete) + keyword list inside. Collapsible
- [ ] `KeywordChipRow.tsx`: single keyword row — keyword text, SourceBadge, design template link, delete button
- [ ] `ManualKeywordInput.tsx`: TextField + "Add" button for manual keyword entry. Supports batch (comma-separated)
- [ ] `DesignTemplateAssign.tsx`: MUI Select — assign keyword group to a design (from niche's approved designs). For PROJ-11 auto-injection

---

## Phase 10: Auto-Import Integration

- [ ] AC-20: Signal handler `post_save` on NicheResearch(status=completed) → auto-insert `top_focus_keywords` + `main_short_tail` from NicheKeywordAnalysis as NicheKeyword(source=research). Skip duplicates silently
- [ ] AC-21: PROJ-7 Autocomplete "Save" button → `POST /api/niches/{id}/keywords/` with source=amazon_search
- [ ] AC-22: PROJ-17 Web Search "Save Keywords" → `POST /api/niches/{id}/keywords/bulk-add/` with source=web_search. Endpoint ready, UI deferred to PROJ-17

### Agent Integration (deferred to PROJ-18, endpoints ready)

- [ ] AC-23: Agent tool `keyword_search` endpoint reuses `GET /api/keywords/search/`. Permission: Auto
- [ ] AC-24: Agent tool `add_keyword_to_niche` endpoint reuses `POST /api/niches/{id}/keywords/`. Permission: Notify
- [ ] AC-25: Agent `keyword_search_js` tool checks `NicheJSCallTracker` — max 1 JS-Call per Niche-ID. Creates tracker record on first call

### Edge Case Handling

- [ ] EC-1: JS API key not configured → enrich endpoint returns 400 "JungleScout API key not configured". Frontend disables Enrich button with tooltip
- [ ] EC-2: JS API returns 429 (rate limit) → retry after 60s, return "Rate limited, retrying..." status
- [ ] EC-3: JS API key expired/invalid → return 400, frontend shows error, disable enrich
- [ ] EC-5: Duplicate keyword on add → 409 response. Bulk-add skips duplicates silently
- [ ] EC-6: Agent second JS-Call for same niche → `NicheJSCallTracker` blocks, returns cached data (no error)
- [ ] EC-10: Keyword >200 chars → truncated to 200, warning returned in response

---

## Phase 11: i18n

- [ ] `keywords.page.*` — page title, search placeholder
- [ ] `keywords.source.*` — research, amazon_search, web_search, manual, junglescout labels
- [ ] `keywords.enrich.*` — button label, loading, success, no API key tooltip
- [ ] `keywords.table.*` — all column headers (keyword, source, volume, CPC, PPC, competition, trends, in_products, in_slogans)
- [ ] `keywords.trend.*` — chart title, no data fallback
- [ ] `keywords.addToNiche.*` — button label, change niche, added count
- [ ] `keywords.drawer.*` — tab title, group labels, add group, manual input, design template
- [ ] `keywords.export.*` — button label
- [ ] `keywords.empty.*` — no results, CTA
- [ ] `keywords.errors.*` — duplicate, rate limited, API key expired
- [ ] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 12: Tests

### Backend

- [ ] Model tests: NicheKeyword unique constraint, NicheKeywordGroup cascade, KeywordJSCache expiry
- [ ] Search API: merged results (DB + Autocomplete), source tags, in_product_count, in_slogan_count
- [ ] Enrich API: cache hit (< 30d), cache miss (JS call), cache expired (refresh). SearchUsageLog entry created
- [ ] History API: returns trend data, marketplace filter
- [ ] Collection CRUD: add (409 on dup), bulk-add (skip dups), delete, bulk-delete, update group/position
- [ ] Groups CRUD: create (409 on dup name), delete (keywords ungrouped), reorder
- [ ] Auto-import signal: research completion → keywords auto-inserted (source=research)
- [ ] JS call tracker: first call creates record, second call blocked (returns cache)
- [ ] Workspace isolation on all endpoints
- [ ] Export CSV: correct columns, streams, includes JS data
- [ ] Product count scrape API (AC-9b): scrapes Page 2, extracts count, upserts cache, returns data. Error handling (scrape fails, no results, bad HTML)
- [ ] Product count in search response (AC-9c): search results include amazon_product_count + fetched_at from cache. Shows data regardless of age
- [ ] KeywordProductCount model: unique constraint, upsert on re-scrape

### Frontend

- [ ] KeywordResearchView: search renders merged results, source badges correct
- [ ] EnrichButton: loading state, disabled when no API key
- [ ] ProductCountColumn: renders "> N" format, shows dash when no data, refresh button triggers scrape with loading spinner
- [ ] TrendChart: renders 12-month chart, "not enough data" fallback
- [ ] AddToNicheButton: context-aware label, change niche works
- [ ] ColumnPicker: toggle columns, persists to localStorage
- [ ] DrawerKeywordsSection: groups render, drag-reorder, manual add
- [ ] TypeScript + ESLint + Ruff: 0 errors

---

## Verification Checklist

- [ ] `keyword_app` registered, migrations applied
- [ ] Search returns merged results (DB + Autocomplete) with source tags
- [ ] JungleScout enrichment works with 30-day cache
- [ ] JS call tracker limits Agent to 1 call per niche
- [ ] Historical trend chart renders (12 months)
- [ ] Context-aware "Add to Niche" button works
- [ ] Keyword groups: create, reorder, delete (ungrouped not deleted)
- [ ] Design template assignment saved on NicheKeyword
- [ ] Auto-import on research completion (source=research)
- [ ] CSV export includes JS data where cached
- [ ] Configurable column picker persists
- [ ] All tests pass, lint clean
