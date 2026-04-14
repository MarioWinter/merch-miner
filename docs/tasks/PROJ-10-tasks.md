# PROJ-10: Keyword Research & Bank — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `keyword_app` — 4 models, 14 endpoints, separate domain from ideas/slogans
- **No dedicated worker** — JS API calls are fast (<2s), default queue sufficient
- **30-day cache in DB** (not Redis) — persistent, queryable for expiry checks
- **JungleScout deferred** — models + UI prepared, API integration later when account exists
- **Amazon Autocomplete** reuses `research_app` proxy endpoint (PROJ-7)
- **Auto-import via signal** — `post_save` on NicheResearch(status=completed)
- **Design template FK** on NicheKeyword — direct link for PROJ-11 auto-injection

---

## Phase 1: Backend Foundation

- [x] Create `keyword_app/` Django app, register in `INSTALLED_APPS`
- [x] Create `keyword_app/api/` + `keyword_app/services/` subpackages
- [x] Wire into `core/urls.py` under `/api/keywords/` and `/api/niches/{id}/keywords/`
- [x] `NicheKeyword` model: UUID pk, `niche` FK (CASCADE), `keyword` CharField(200), `source` choices (research/amazon_search/web_search/manual/junglescout), `group` FK (nullable), `design_template` FK (Design, nullable), `created_by` FK (nullable), `created_at`. `unique_together = [('niche', 'keyword')]`
- [x] `NicheKeywordGroup` model: UUID pk, `niche` FK (CASCADE), `name` CharField(100), `position` PositiveIntegerField, `created_by` FK, `created_at`. `unique_together = [('niche', 'name')]`
- [x] `KeywordJSCache` model: UUID pk, `keyword` CharField(200), `marketplace` CharField(20), all 14 JS data fields (monthly_search_volume_exact/broad, monthly_trend, quarterly_trend, ppc_bid_exact/broad, sp_brand_ad_bid, ease_of_ranking_score, relevancy_score, organic_product_count, sponsored_product_count, dominant_category, recommended_promotions), `fetched_at` DateTimeField. `unique_together = [('keyword', 'marketplace')]`. Index on `fetched_at`
- [x] `NicheJSCallTracker` model: UUID pk, `niche` FK (unique), `called_at`, `keyword_used` CharField(200)
- [x] `KeywordProductCount` model (AC-4b): UUID pk, `keyword` CharField(200), `marketplace` CharField(20), `product_count` PositiveIntegerField, `fetched_at` DateTimeField. `unique_together = [('keyword', 'marketplace')]`. No auto-expiry — data always shown, refreshed only on explicit user action
- [x] Initial migration
- [x] Admin registration
- [ ] ~~`junglescout-python-client` in `requirements.txt`~~ → DEFERRED (no account yet)
- [ ] ~~Env vars: `JUNGLESCOUT_API_KEY_NAME`, `JUNGLESCOUT_API_KEY`, `JUNGLESCOUT_DEFAULT_MARKETPLACE`~~ → DEFERRED

---

## Phase 2: Backend Services

- [x] `services/junglescout_service.py`: **stub only** — methods `keywords_by_keyword()`, `historical_search_volume()` that raise `NotConfiguredError("JungleScout API not configured")`. Cache logic + tracker logic prepared but no actual API call
- [x] Cache logic (prepared): check `KeywordJSCache` for keyword+marketplace. If exists AND `fetched_at` < 30 days → return cache. Else → would call JS API (stubbed)
- [x] `NicheJSCallTracker` check (prepared): before JS call, verify niche doesn't already have tracker record
- [ ] ~~Cost logging~~ → DEFERRED (no API calls yet)
- [x] `services/autocomplete_service.py`: reuse `research_app` suggestions endpoint (or call internally). Merge with DB results
- [x] `services/auto_import.py`: `post_save` signal on NicheResearch. When `status=completed` → auto-insert `top_focus_keywords` + `main_short_tail` from NicheKeywordAnalysis as `source=research`. Skip duplicates silently
- [x] `services/product_count_scraper.py` (AC-9b): lightweight Amazon Page 2 scraper. Fetches search results page via ScraperOps proxy, extracts result count from `div.sg-col-inner h2 span` header (parse "X-Y of **N** results for" → extract N). Uses Page 2 (not Page 1) because Amazon shows inflated count on Page 1. Upserts `KeywordProductCount` record
- [x] **PROJ-16 cross-reference** (AC-9d): Note added to PROJ-16 tasks Phase 3 — Spider extracts result count from Page 2 HTML, upserts `KeywordProductCount`

---

## Phase 3: Keyword Research API

- [x] `GET /api/keywords/search/` — merged results: DB keywords matching query (NicheKeyword + NicheKeywordAnalysis full-text) + Amazon Autocomplete. Per result: `source` tag, `in_product_count`, `in_slogan_count` (computed via DB COUNT on AmazonProduct + Idea). Paginated
- [x] `POST /api/keywords/enrich/` — body: `{keywords: [...], marketplace}`. Check cache first (30d). If no JS API configured → return 400 "JungleScout not configured". Endpoint ready, actual API call deferred
- [x] `GET /api/keywords/{keyword}/history/` — params: marketplace, start_date, end_date. Returns cached data or 400 "JungleScout not configured". Actual JS call deferred
- [x] `GET /api/keywords/export/` — same filters as search. StreamingHttpResponse CSV. Includes JS data where cached
- [x] `POST /api/keywords/product-count/` (AC-9b) — body: `{keyword, marketplace}`. Calls `product_count_scraper` service. Upserts `KeywordProductCount`. Returns `{keyword, marketplace, product_count, fetched_at}`. Uses ScraperOps proxy
- [x] Extend `GET /api/keywords/search/` response (AC-9c): include `amazon_product_count` + `product_count_fetched_at` per keyword from `KeywordProductCount` cache. Always show existing data regardless of age — no auto-refresh

---

## Phase 4: Keyword Collection API (per Niche)

- [x] `GET /api/niches/{id}/keywords/` — all keywords for niche, ordered by group then position. Filterable: `?source=`, `?group_id=`. Workspace-scoped
- [x] `POST /api/niches/{id}/keywords/` — add keyword. Body: `{keyword, source, group_id}`. 409 on duplicate
- [x] `POST /api/niches/{id}/keywords/bulk-add/` — body: `{keywords: [{keyword, source}], group_id}`. Skip duplicates silently
- [x] `DELETE /api/niches/{id}/keywords/{keyword_id}/` — remove keyword
- [x] `POST /api/niches/{id}/keywords/bulk-delete/` — body: `{ids: [...]}`
- [x] `PATCH /api/niches/{id}/keywords/{keyword_id}/` — update group, position, design_template

---

## Phase 5: Keyword Groups API

- [x] `GET /api/niches/{id}/keyword-groups/` — list groups for niche, ordered by position
- [x] `POST /api/niches/{id}/keyword-groups/` — create group. Body: `{name}`. 409 on duplicate name
- [x] `PATCH /api/niches/{id}/keyword-groups/{group_id}/` — update name, position
- [x] `DELETE /api/niches/{id}/keyword-groups/{group_id}/` — delete group. Keywords become ungrouped (group=null), not deleted

---

## Phase 6: Serializers

- [x] `NicheKeywordSerializer` — all fields, nested `group` (id + name), nested `design_template` (id + slogan), `js_data` (from KeywordJSCache if available)
- [x] `KeywordSearchResultSerializer` — keyword, source, in_product_count, in_slogan_count, js_data (nullable), amazon_product_count (nullable), product_count_fetched_at (nullable)
- [x] `KeywordProductCountSerializer` — keyword, marketplace, product_count, fetched_at
- [x] `KeywordJSCacheSerializer` — all 14 JS data fields + fetched_at
- [x] `NicheKeywordGroupSerializer` — id, name, position, keyword_count
- [x] `KeywordEnrichSerializer` — request: keywords list + marketplace. Response: enriched keyword data
- [x] `KeywordHistorySerializer` — trend data points for chart

---

## Phase 7: Frontend — State & Services

- [x] RTK Query `keywordApi` slice (`store/keywordSlice.ts`): searchKeywords, enrichKeywords, getHistory, exportCSV (axios blob in useKeywordExport hook), scrapeProductCount, listNicheKeywords, addKeyword, bulkAddKeywords, deleteKeyword, bulkDeleteKeywords, updateKeyword, listGroups, createGroup, updateGroup, deleteGroup
- [x] Cache tags: `NicheKeywords`, `KeywordGroups`, `KeywordSearch`, `KeywordProductCount`
- [x] Register slice in `store/index.ts`
- [x] TypeScript types: NicheKeyword, NicheKeywordGroup, KeywordJSData, KeywordSearchResult, KeywordSource, KeywordHistoryPoint, KeywordProductCount

---

## Phase 8: Frontend — Keyword Research Page

- [x] `KeywordResearchView.tsx`: full-page route `/keywords`. SearchBar + DataGrid + TrendChart + AddToNiche
- [x] `useKeywordSearch` hook: search query → merged results (DB + Autocomplete). Search fires ONLY on Enter key or Search button click (AC-5b) — NOT on every keystroke. Autocomplete dropdown suggestions remain live (debounced 300ms). Same pattern as PROJ-7 `useProductSearch`
- [x] `useJSEnrich` hook: enrich selected keywords on-demand, loading states per row
- [x] `useKeywordExport` hook: trigger CSV export with current filters
- [x] `KeywordSearchBar.tsx`: MUI Autocomplete with Amazon suggestions (reuses PROJ-7 endpoint). Includes Search button (primary, right of input). Search fires on Enter or button click (AC-5b)
- [x] `KeywordTable.tsx`: MUI DataGrid with configurable columns. Default visible: keyword, source, search volume, CPC, in_products, in_slogans. Server-side sort + pagination. Sticky header row — stays visible when scrolling (AC-5c)
- [x] `ColumnPicker.tsx`: MUI Popover with checkbox list for column visibility. Persisted to localStorage
- [x] `ProductCountColumn` in `KeywordTable.tsx` (AC-9c): "Amz Products" column displaying "> 526" format (like Flying Research). Shows cached data regardless of age. Empty/dash when no data exists
- [x] `ProductCountRefreshButton` per row (AC-9b): 🔄 icon button that triggers `scrapeProductCount` mutation. Loading spinner while scraping. On success → column updates with new count. On error → error toast, existing data stays visible
- [x] `EnrichButton.tsx`: per-row "Enrich" icon button + bulk "Enrich Selected" button. **Initially always disabled** with tooltip "JungleScout coming soon". Wiring ready for when API is configured
- [x] `TrendChart.tsx`: @mui/x-charts LineChart — 12 months historical search volume. Opens on keyword click. **Initially shows "No data — JungleScout not configured" placeholder**. Renders cached data when available
- [x] `AddToNicheButton.tsx`: context-aware — when niche is active in Drawer: "Add X to {niche name}". Otherwise: MUI Menu with niche search/select. "Change Niche" fallback link
- [x] `SourceBadge.tsx`: MUI Chip per source — research (primary), amazon (warning), web_search (info), manual (default), junglescout (success)
- [x] `EmptyState.tsx`: no results → CTA to try different keyword or enrich
- [x] Route registered in `App.tsx`

---

## Phase 9: Frontend — Drawer Keywords Section

- [x] `DrawerKeywordsSection.tsx`: Keywords tab in NicheDetailDrawer. Lists all keywords grouped by NicheKeywordGroup
- [x] `KeywordGroupList.tsx`: ordered list of groups. Drag-to-reorder (dnd-kit). "Add Group" button
- [x] `KeywordGroupCard.tsx`: group header (name, count, edit/delete) + keyword list inside. Collapsible
- [x] `KeywordChipRow.tsx`: single keyword row — keyword text, SourceBadge, design template link, delete button
- [x] `ManualKeywordInput.tsx`: TextField + "Add" button for manual keyword entry. Supports batch (comma-separated)
- [x] `DesignTemplateAssign.tsx`: MUI Select — assign keyword group to a design (from niche's approved designs). For PROJ-11 auto-injection

---

## Phase 10: Auto-Import Integration

- [x] AC-20: Signal handler `post_save` on NicheResearch(status=completed) → auto-insert `top_focus_keywords` + `main_short_tail` from NicheKeywordAnalysis as NicheKeyword(source=research). Skip duplicates silently
- [x] AC-21: PROJ-7 Autocomplete "Save" button → `POST /api/niches/{id}/keywords/` with source=amazon_search (in AmazonResearchView)
- [x] AC-22: PROJ-17 Web Search "Save Keywords" → `POST /api/niches/{id}/keywords/bulk-add/` with source=web_search. Endpoint ready, UI deferred to PROJ-17

### Agent Integration (deferred to PROJ-18, endpoints ready)

- [x] AC-23: Agent tool `keyword_search` endpoint reuses `GET /api/keywords/search/`. Permission: Auto — endpoint ready
- [x] AC-24: Agent tool `add_keyword_to_niche` endpoint reuses `POST /api/niches/{id}/keywords/`. Permission: Notify — endpoint ready
- [x] AC-25: Agent `keyword_search_js` tool checks `NicheJSCallTracker` — `check_agent_js_limit()` + `record_agent_js_call()` in junglescout_service.py

### Edge Case Handling

- [x] EC-1: JS API key not configured → enrich + history endpoints return 400. Frontend EnrichButton always disabled
- [ ] ~~EC-2: JS API returns 429~~ → DEFERRED (no API calls yet)
- [ ] ~~EC-3: JS API key expired/invalid~~ → DEFERRED (no API calls yet)
- [x] EC-5: Duplicate keyword on add → 409 response. Bulk-add uses `ignore_conflicts=True`
- [x] EC-6: Agent JS-Call limit → `check_agent_js_limit()` + `record_agent_js_call()` in junglescout_service.py
- [x] EC-10: Keyword >200 chars → DRF `CharField(max_length=200)` rejects with validation error. auto_import truncates silently

---

## Phase 11: i18n

- [x] `keywords.page.*` — page title, search placeholder
- [x] `keywords.source.*` — research, amazon_search, web_search, manual, junglescout labels
- [x] `keywords.enrich.*` — button label, loading, success, no API key tooltip
- [x] `keywords.table.*` — all column headers (keyword, source, volume, CPC, PPC, competition, trends, in_products, in_slogans)
- [x] `keywords.trend.*` — chart title, no data fallback
- [x] `keywords.addToNiche.*` — button label, change niche, added count
- [x] `keywords.drawer.*` — tab title, group labels, add group, manual input, design template
- [x] `keywords.export.*` — button label
- [x] `keywords.empty.*` — no results, CTA
- [x] `keywords.errors.*` — duplicate, rate limited, API key expired
- [x] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 12: Tests

### Backend

- [ ] Model tests: NicheKeyword unique constraint, NicheKeywordGroup cascade, KeywordJSCache expiry
- [ ] Search API: merged results (DB + Autocomplete), source tags, in_product_count, in_slogan_count
- [ ] Enrich API: returns 400 "not configured" when no JS key. Cache hit works when data manually seeded
- [ ] History API: returns 400 "not configured" when no JS key. Returns cached data when available
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
- [ ] EnrichButton: always disabled with "coming soon" tooltip, wiring ready
- [ ] ProductCountColumn: renders "> N" format, shows dash when no data, refresh button triggers scrape with loading spinner
- [ ] TrendChart: renders 12-month chart, "not enough data" fallback
- [ ] AddToNicheButton: context-aware label, change niche works
- [ ] ColumnPicker: toggle columns, persists to localStorage
- [ ] DrawerKeywordsSection: groups render, drag-reorder, manual add
- [ ] TypeScript + ESLint + Ruff: 0 errors

---

## Phase 13: UI Redesign — "Keyword Lode" (AC-31 to AC-36)

> Frontend-only. Flying Research inspired. Approved 2026-04-14.

### Search History (AC-36)

- [x] `useRecentSearches` hook (`views/amazon/keywords/research/hooks/`): localStorage key `mm-keyword-recent`, max 10 items, `{keyword, marketplace}` objects. Methods: `addSearch`, `removeSearch`, `clearAll`. Same pattern as PROJ-7 `useRecentSearches` (`views/amazon/research/hooks/useRecentSearches.ts`)
- [x] `SearchHistoryChips.tsx` (`partials/`): renders recent searches as `Chip variant="outlined" size="small"` in `Stack` with `flexWrap="wrap"` below search bar. Click chip → fill input + execute search. "×" delete icon per chip. "Clear all" ghost button at end. Empty = hidden

### Keyword Chip Cloud (AC-31, AC-32)

- [x] `KeywordChipCloud.tsx` (`partials/`): receives search results, classifies by word count — ≤2 words = Short-Tail, ≥3 words = Long-Tail. Two collapsible sections with headers "Short-Tail" / "Long-Tail"
- [x] Short-Tail chips: `secondary.main` outline variant. Long-Tail chips: `info.subtle` background
- [x] Each chip: keyword text + Amz Product Count badge (e.g. `school bus driver · 549`). Badge only shows when product count data exists
- [x] Click chip → sets active filter, table shows only matching keyword
- [x] "Show all" link if >12 chips per section. Default collapsed to 12. Horizontal wrap layout
- [x] Hidden when no search results

### Source Tabs (AC-33)

- [x] `SourceTabs.tsx` (`partials/`): MUI Tabs directly above table. Tabs: `All (N)` | `Database (N)` | `Amazon (N)` | `JungleScout` (disabled)
- [x] JungleScout tab: disabled state + MUI `Badge` with "Coming Soon" label
- [x] Tab labels include result count per source, computed client-side from current results
- [x] Selecting tab sets `sourceFilter` state → passed to table for client-side filtering
- [x] "All" tab selected by default

### Table Improvements (AC-34)

- [x] Sticky header: remove `autoHeight`, use fixed container height `calc(100vh - Xpx)`. Header stays visible on scroll via DataGrid default behavior
- [x] Header row: `background.elevated` (#0F3040)
- [x] Row hover: `primary.subtle` highlight
- [x] JS columns (Volume, CPC, PPC, Ease of Ranking, Organic Count, Sponsored Count): show "—" in `text.disabled` color with `opacity: 0.4`
- [x] JS column headers: MUI `Tooltip` with "JungleScout coming soon"

### Floating Action Bar (AC-35)

- [x] `FloatingActionBar.tsx` (`partials/`): appears when ≥1 keyword selected. Sticky bottom bar with glass-sm background
- [x] Content: "{count} selected" label + "Add to Niche" button (context-aware) + "Enrich" button (disabled, "Coming Soon" tooltip)
- [x] Replace current inline action bar in `KeywordResearchView`

### View Integration

- [x] Update `KeywordResearchView.tsx`: wire SearchHistoryChips below search bar, KeywordChipCloud below controls, SourceTabs above table, FloatingActionBar at bottom
- [x] State wiring: `sourceFilter` from SourceTabs + `chipFilter` from ChipCloud → both applied to table rows (client-side filter)
- [x] `useKeywordSearch` hook: call `addSearch` on successful search execution

### i18n (Phase 13)

- [x] `keywords.chipCloud.*` — shortTail, longTail, showAll, showLess section headers
- [x] `keywords.sourceTabs.*` — all, database, amazon, junglescout, comingSoon tab labels
- [x] `keywords.searchHistory.*` — clearAll link text
- [x] `keywords.actionBar.*` — selected count, addToNiche, enrich labels
- [x] All 5 locales: EN, DE, FR, ES, IT

### Tests (Phase 13)

- [x] `useRecentSearches`: add/remove/clear, max 10 cap, localStorage persistence, corrupted JSON recovery (EC-17)
- [x] `SearchHistoryChips`: renders chips, click fills + searches, delete removes, clear all works
- [x] `KeywordChipCloud`: Short/Long-Tail classification correct, click filters, "Show all" toggle, hidden on empty results (EC-16)
- [x] `SourceTabs`: counts correct, tab switch filters table, JungleScout disabled, empty tab shows EmptyState (EC-18)
- [x] `FloatingActionBar`: appears on selection, disappears on deselect, button states correct

---

## Deferred (tracked in other features)

- **AC-26 to AC-28** — Chat keyword commands + context awareness → PROJ-17
- **AC-29 to AC-30** — Listing auto-injection from keyword bank → PROJ-11
- **User Story 18** — Cross-Niche Discovery via Vector DB semantic search → PROJ-15
- **EC-7, EC-8** — Group/Design FK set null on delete → covered by model constraints, add tests in respective features
- **EC-11** — Chat ambiguous niche name resolution → PROJ-17

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
- [ ] Search history chips appear below search bar, persist across sessions
- [ ] Short-Tail / Long-Tail chip cloud renders above table, click filters
- [ ] Source Tabs filter results, JungleScout tab disabled with "Coming Soon"
- [ ] JS columns show "—" placeholder with tooltip
- [ ] Floating action bar appears on keyword selection
- [ ] All tests pass, lint clean
