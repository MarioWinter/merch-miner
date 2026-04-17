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

- [x] Model tests: NicheKeyword unique constraint, NicheKeywordGroup cascade, KeywordJSCache expiry
- [x] Search API: merged results (DB + MetaKeyword + SearchKeywordResult), source tags, in_product_count, in_slogan_count
- [x] Enrich API: returns 400 "not configured" when no JS key. Cache hit works when data manually seeded
- [ ] History API: returns 400 "not configured" when no JS key. Returns cached data when available
- [x] Collection CRUD: add (409 on dup), bulk-add (skip dups), delete, bulk-delete, update group/position
- [x] Groups CRUD: create (409 on dup name), delete (keywords ungrouped), reorder
- [x] Auto-import signal: research completion → keywords auto-inserted (source=research)
- [x] JS call tracker: first call creates record, second call blocked (returns cache)
- [x] Workspace isolation on all endpoints
- [x] Export CSV: correct columns, streams, includes JS data
- [ ] Product count scrape API (AC-9b): scrapes Page 2, extracts count, upserts cache, returns data. Error handling (scrape fails, no results, bad HTML)
- [x] Product count in search response (AC-9c): search results include amazon_product_count + fetched_at from cache. Shows data regardless of age
- [ ] KeywordProductCount model: unique constraint, upsert on re-scrape

### Frontend

- [x] KeywordResearchView: search renders merged results, source badges correct
- [x] EnrichButton: always disabled with "coming soon" tooltip, wiring ready
- [x] ProductCountColumn: renders "> N" format, shows dash when no data, refresh button triggers scrape with loading spinner
- [x] TrendChart: renders 12-month chart, "not enough data" fallback
- [x] AddToNicheButton: context-aware label, change niche works
- [x] ColumnPicker: toggle columns, persists to localStorage
- [x] DrawerKeywordsSection: groups render, drag-reorder, manual add
- [x] TypeScript + ESLint + Ruff: 0 errors

---

## Phase 13: UI Redesign — "Keyword Lode" (AC-31 to AC-41)

> Proposal A "Vertical Flow" approved 2026-04-15. Redesigned 2026-04-15: automatic After/Before/Synonyms tabs replace manual multiplier.

### Design Rules (MANDATORY for all Phase 13 components)

> **No hardcoded colors.** Use `theme.vars.palette.*` everywhere. Use `alpha()` from `@mui/material/styles` for opacity variants.
> **Reuse existing patterns** from Niche Deep Research (`views/niches/research/partials/`):
> - **Card pattern**: `background.paper` + `1px solid divider` + `borderRadius: 12` + `padding: spacing(2.5, 3)`
> - **SectionLabel**: `overline` style (0.6875rem, 600, letterSpacing 0.08em, uppercase, `text.secondary`)
> - **Icon Box**: 28x28px rounded box with `alpha(color, 0.14)` background
> - **Chip tinting**: `alpha(color, 0.10)` background + `color` text, `alpha(color, 0.22)` border on active
> - **Transitions**: `DURATION.fast` (150ms) for hover, `DURATION.slow` (300ms) for expand/collapse. Use `EASING.standard`
> **Create shared components** where duplicated: `SectionCard` (base card wrapper), `SectionLabel` (overline header with icon)

### Phase 13a: Backend — Datamuse Synonyms (AC-38)

- [x] `SynonymCache` model in `keyword_app`: UUID pk, `keyword` CharField(200, unique, db_index), `results` JSONField (list of words), `fetched_at` DateTimeField. No expiry — words don't change
- [x] Migration for `SynonymCache`
- [x] `services/datamuse_service.py`: calls `api.datamuse.com/words?ml={query}`, parses response, returns top 20 words. Checks `SynonymCache` first — if exists, return cache. If not, call API → store → return
- [x] `GET /api/keywords/synonyms/` — params: `query` (required). Returns `{words: ["word1", "word2", ...]}`. Uses `datamuse_service`. Handles API timeout gracefully (returns empty list, no 500)
- [x] Wire URL in `keyword_app/api/urls.py`
- [x] Admin registration for `SynonymCache`
- [x] Ruff lint clean

### Phase 13b: Frontend — Shared Components

- [x] `components/SectionCard/index.tsx`: reusable card wrapper. Props: `children`, `sx`. Styled: `background.paper`, `1px solid divider`, `borderRadius: 12`, `padding: spacing(2.5, 3)`
- [x] `components/SectionLabel/index.tsx`: section header. Props: `icon`, `label`, `count` (optional), `children` (right-side actions), `iconColor` (palette path like "secondary.main" — resolves via `useTheme()`). Overline text style, icon in 28x28 icon-box

### Phase 13c: Frontend — Search History (AC-36)

- [x] `useRecentSearches` hook: localStorage `mm-keyword-recent`, max 10, `{keyword, marketplace}`. Same pattern as PROJ-7
- [x] `SearchHistoryChips.tsx`: HistoryIcon prefix. Chips: `alpha(text.primary, 0.04)` fill + `divider` border. Hover: border brightens. "×" delete → `error.main` on hover. "Clear all" ghost button

### Phase 13d: Frontend — Search Hook Rewrite (AC-32, AC-39, AC-40)

- [x] Update `useKeywordSearch` hook: on `executeSearch()`, fire 4 parallel requests:
  - Standard autocomplete for "keyword" → tagged `source=suggestion`
  - Autocomplete for "keyword " (trailing space) → tagged `source=after`
  - Autocomplete for " keyword" (leading space) → tagged `source=before`
  - `GET /api/keywords/synonyms/?query=keyword` → tagged `source=synonym`
- [x] Merge all into one `results` array. Deduplicate by keyword — priority: suggestion > after > before > synonym (first occurrence wins)
- [x] Add RTK Query endpoint `getSynonyms` in `keywordSlice.ts` for the synonyms API
- [x] Types: update `KeywordSearchResult.source` to include `suggestion | after | before | synonym`
- [x] Expose `suggestionCounts` (per source type) for tab badges

### Phase 13e: Frontend — Suggestion Tabs (AC-31, AC-33)

- [x] `SuggestionTabs.tsx` (replaces old `SourceTabs.tsx`): MUI Tabs with `sx` (no `styled(Tab)`)
  - Tabs: `All (N)` | `Suggestions (N)` | `After (N)` | `Before (N)` | `Synonyms (N)` | `JungleScout` 🔒 (disabled)
  - Count per tab as inline `Chip` (height 18, `alpha(text.primary, 0.08)` bg)
  - JungleScout tab: disabled + `LockIcon` (12px, 50% opacity)
  - Indicator: `primary.main` gradient, 2px height, glow shadow
  - `tabSx` shared style: `minHeight: 40, textTransform: 'none', fontWeight: 500`
- [x] Selecting tab sets `suggestionFilter` state → passed to table for client-side filtering

### Phase 13f: Frontend — Keyword Chip Cloud (AC-41)

- [x] `KeywordChipCloud.tsx`: wrap sections in `SectionCard`. Use `SectionLabel` with BoltIcon (Short-Tail) and AllInclusiveIcon (Long-Tail)
- [x] Short-Tail chips: `alpha(secondary.main, 0.10)` bg + `alpha(secondary.main, 0.30)` border. Active: `0.20` bg
- [x] Long-Tail chips: `alpha(info.main, 0.08)` bg + `alpha(info.main, 0.18)` border. Active: `0.15` bg
- [x] Product count badge: `MONO_FONT_STACK`, `text.disabled`, separated by `·`
- [x] Click → filter table. "Show all" if >12. Computed from ALL results across all sources
- [x] Hidden when no results

### Phase 13g: Frontend — Table Improvements (AC-34, AC-37)

- [x] `KeywordTable.tsx`: fixed height container, `borderRadius: 10`, `1px solid divider` wrapper
- [x] Header: `background.paper`. Alternating rows: even = `alpha(text.primary, 0.015)`. Hover: `alpha(primary.main, 0.06)`. Selected: `alpha(primary.main, 0.10)`
- [x] JS columns: em-dash "—" in `text.disabled` at 40% opacity. Column headers: `description` prop
- [x] Product count column + refresh button (restore from Phase 8, was lost in git checkout)
- [x] **Hover actions (AC-37)**: new `actions` column (right-aligned, visible on row hover only). Two IconButtons:
  - Copy icon → `navigator.clipboard.writeText(keyword)` → snackbar "Copied!"
  - Search icon → calls `onSearchKeyword(keyword)` → re-executes search with that keyword as new main term
- [x] Source badge updated: shows `suggestion` / `after` / `before` / `synonym` (not `database` / `amazon`)

### Phase 13h: Frontend — Floating Action Bar (AC-35)

- [x] `FloatingActionBar.tsx`: glass-md (`alpha(background.paper, 0.75)` + `backdropFilter: blur(16px)`). Sticky bottom
- [x] Slide-up animation: `keyframes` translateY(12px→0) + opacity, `DURATION.slow`
- [x] Content: coral dot + selected count + spacer + "Add to Niche" + "Enrich" (disabled/lock)

### Phase 13i: Frontend — View Integration

- [x] Rewrite `KeywordResearchView.tsx`: wire all components in order:
  - SearchBar + MarketplaceSelect + ColumnPicker
  - SearchHistoryChips
  - KeywordChipCloud
  - SuggestionTabs
  - KeywordTable
  - FloatingActionBar
  - TrendChart dialog
- [x] State wiring: `suggestionFilter` from SuggestionTabs + `chipFilter` from ChipCloud → both applied as client-side filters on results
- [x] `addSearch` called on successful search execution
- [x] Hover Search action → sets new input value + triggers `executeSearch`
- [x] Delete old files: `SuggestionMultiplier.tsx`, `WordSuggestions.tsx`, `useModifierSuggestions.ts`, old `SourceTabs.tsx` (replaced by `SuggestionTabs.tsx`)

### Phase 13j: i18n

- [x] `keywords.chipCloud.*` — shortTail, longTail, showAll, showLess
- [x] `keywords.suggestionTabs.*` — all, suggestions, after, before, synonyms, junglescout, comingSoon
- [x] `keywords.searchHistory.*` — clearAll, label
- [x] `keywords.actionBar.*` — selected, addToNiche, enrich
- [x] `keywords.hover.*` — copy, search, copied (implemented as `keywords.table.copyKeyword/copiedKeyword/searchKeyword`)
- [x] `keywords.source.*` — update: suggestion, after, before, synonym (replace database/amazon labels)
- [x] All 5 locales: EN, DE, FR, ES, IT

### Phase 13k: Tests

- [x] **Backend**: `SynonymCache` model (unique keyword), synonyms endpoint — covered by Phase 15e backend tests (multi-endpoint, token filter, cache)
- [x] `useRecentSearches`: add/remove/clear, max 10, localStorage, corrupted JSON (EC-17)
- [x] `SearchHistoryChips`: render, click fills + searches, delete, clear all
- [x] `SuggestionTabs`: counts per source type, tab switch filters, JS disabled (EC-18), empty tab shows EmptyState
- [x] `KeywordChipCloud`: Short/Long-Tail classification, click filter, show all (EC-16)
- [x] `FloatingActionBar`: appears/disappears on selection, slide-up animation
- [x] `KeywordTable` hover actions: copy triggers clipboard + snackbar, search triggers new search
- [x] Deduplication: same keyword in suggestion + after → only one row shown (EC-20)
- [x] TypeScript + ESLint + Ruff: 0 errors

---

## Phase 14: After/Before Alphabet Expansion + Synonym Quality Fix (AC-32, AC-38, AC-39, AC-40)

> Amendment approved 2026-04-16. Trailing/leading space approach for After/Before didn't work with Amazon API. Replaced with alphabet expansion (Flying Research pattern). Synonyms improved with dual source (POD Amazon variations + filtered Datamuse).

### Phase 14a: Backend — Datamuse Multi-Endpoint + Filter

- [x] `datamuse_service.py`: fire two Datamuse endpoints in parallel (`ml=` meaning-like + `rel_trg=` trigger/associated)
- [x] Deduplicate by word, keep highest score
- [x] Filter: only return words sharing at least one token with query (relevance filter for POD)
- [x] Sort by score descending, take top 20
- [x] Cache in existing `SynonymCache` model (no new model needed)
- [x] Ruff lint clean

### Phase 14b: Frontend — useKeywordSearch Rewrite (alphabet expansion + POD variations)

- [x] Rewrite `executeSearch()` in `useKeywordSearch.ts` to fire 4 groups of parallel requests:
  - **Suggestions** (1 request): standard autocomplete for "keyword" → tagged `source=suggestion` (unchanged)
  - **After** (26 requests): autocomplete for "keyword a" through "keyword z" → tagged `source=after`
  - **Before** (26 requests): autocomplete for "a keyword" through "z keyword" → tagged `source=before`
  - **Synonyms** (8+1 requests): POD-specific autocomplete for "funny {kw}", "best {kw}", "retro {kw}", "vintage {kw}", "cute {kw}", "{kw} lover", "{kw} gifts", "{kw} for men" + Datamuse API call → all tagged `source=synonym`
- [x] Remove original query from After/Before results (no point showing "camping" in After results for "camping")
- [x] Deduplicate across all sources (case-insensitive). Priority: suggestion > after > before > synonym
- [x] Update `suggestionCounts` for tab badges
- [x] AbortController cancels all in-flight requests on new search

### Phase 14c: Tests

- [x] Backend: `datamuse_service` — multi-endpoint merge, token filter (drops unrelated words), score sort, cache hit/miss (covered by Phase 15e backend tests)
- [x] Frontend: `useKeywordSearch` dedup test updated — covers alphabet expansion results, POD variation results, cross-source dedup (7 tests)
- [x] TypeScript + ESLint + Ruff: 0 errors

---

## Phase 15: Listing Keywords Tab + Before POD Modifiers + SynonymCache Cleanup (AC-31, AC-32, AC-40, AC-42, AC-43)

> Amendment #2 approved 2026-04-17. Three issues from browser testing: DB keywords missing (regression), Before tab empty (alphabet fails for multi-word), Synonyms irrelevant (stale cache).

### Phase 15a: Backend — Extend Search Endpoint (AC-42)

- [x] Add `MetaKeyword` query to `KeywordSearchView`: filter `keyword__icontains=query`, order by `-frequency`, limit top 100. Tag as `source=listing`
- [x] Add `SearchKeywordResult` query: filter `all_keywords_flat__icontains=query`, extract matching keywords from `top_focus_keywords` + `top_long_tail_keywords`. Tag as `source=listing`
- [x] Merge both into existing results list. Deduplicate by keyword (existing `seen_keywords` set handles this)
- [x] Unify all listing-related sources (`database`, `research_analysis`) under single source label `listing` in the response — frontend sees only `source=listing`
- [x] Ruff lint clean

### Phase 15b: Backend — SynonymCache Cleanup (AC-43)

- [x] One-time management command: `python manage.py clear_synonym_cache` created at `keyword_app/management/commands/clear_synonym_cache.py`
- [x] Verify: run on Docker — deleted 1 stale entry. New searches will use multi-endpoint + token filter

### Phase 15c: Frontend — Types + Source Badge + Tabs

- [x] `types/index.ts`: add `'listing'` to `SuggestionSource` type. Add to `SuggestionCounts` interface
- [x] `SourceBadge.tsx`: add `listing` color mapping (`success` — green)
- [x] `SuggestionTabs.tsx`: add `Listing Keywords` tab between All and Suggestions. Wire `counts.listing` badge
- [x] i18n: add `keywords.suggestionTabs.listing` + `keywords.source.listing` to all 5 locales

### Phase 15d: Frontend — useKeywordSearch Rewrite (5 groups + POD modifiers)

- [x] Add Group 1 (Listing Keywords): call `GET /api/keywords/search/?query={q}&marketplace={mp}` via `apiClient.get`. Map response `results[]` to `KeywordSearchResult` with `source=listing`. Preserve `in_product_count` + `in_slogan_count` from response (other groups default to 0)
- [x] Change Before (Group 4): replace 26 alphabet expansion requests with 10 POD modifier prefix requests: "funny {kw}", "best {kw}", "cool {kw}", "awesome {kw}", "retired {kw}", "proud {kw}", "i love {kw}", "world's best {kw}", "this is my {kw}", "official {kw}". Tag as `source=before`
- [x] Update dedup priority order: listing > suggestion > after > before > synonym (add `listing` at front of `SOURCE_PRIORITY` array)
- [x] Update `suggestionCounts` to include `listing` count
- [x] Keep After (Group 3) as alphabet expansion (works well for suffixes)
- [x] Keep Synonyms (Group 5) unchanged: POD suffix autocomplete + Datamuse

### Phase 15e: Tests

- [x] Backend: search endpoint returns MetaKeyword results for matching query. Search endpoint returns SearchKeywordResult keywords. All tagged `source=listing`. Dedup works across sources
- [x] Frontend: `useKeywordSearch` fires listing search call + 10 Before POD modifier requests. Listing results have `in_product_count` > 0. Dedup priority: listing wins over suggestion for same keyword
- [x] `SuggestionTabs`: renders 7 tabs (All, Listing Keywords, Suggestions, After, Before, Synonyms, JS🔒). Listing Keywords tab filters correctly
- [x] TypeScript + ESLint + Ruff: 0 errors

---

## Deferred (tracked in other features)

- **AC-26 to AC-28** — Chat keyword commands + context awareness → PROJ-17
- **AC-29 to AC-30** — Listing auto-injection from keyword bank → PROJ-11
- **User Story 18** — Cross-Niche Discovery via Vector DB semantic search → PROJ-15
- **EC-7, EC-8** — Group/Design FK set null on delete → covered by model constraints, add tests in respective features
- **EC-11** — Chat ambiguous niche name resolution → PROJ-17

---

## Verification Checklist

- [x] `keyword_app` registered, migrations applied
- [x] Search returns merged results (DB + MetaKeyword + SearchKeywordResult) with source tags
- [x] JungleScout enrichment stub works (returns 400 "not configured")
- [x] JS call tracker limits Agent to 1 call per niche
- [x] Historical trend chart renders (placeholder — JS not configured)
- [x] Context-aware "Add to Niche" button works
- [x] Keyword groups: create, reorder, delete (ungrouped not deleted)
- [x] Design template assignment saved on NicheKeyword
- [x] Auto-import on research completion (source=research)
- [x] CSV export includes JS data where cached
- [x] Configurable column picker persists
- [x] Search history chips appear below search bar, persist across sessions
- [x] Short-Tail / Long-Tail chip cloud renders above tabs, click filters
- [x] Suggestion Tabs: All / Listing Keywords / Suggestions / After / Before / Synonyms / JS🔒 — counts correct, filter works
- [x] Listing Keywords tab shows keywords from MetaKeyword + SearchKeywordResult + NicheKeyword + NicheKeywordAnalysis, with in_product_count + in_slogan_count
- [x] After tab shows alphabet-expanded suffix suggestions ("keyword a" through "keyword z" results)
- [x] Before tab shows POD modifier prefix suggestions ("funny keyword", "best keyword", "retired keyword" etc.)
- [x] Synonyms tab shows POD suffix variations + filtered Datamuse words (sharing tokens with query)
- [x] Hover on row → Copy + Search icons in keyword column. Copy → "Copied!" snackbar. Search → new search
- [x] Deduplication: same keyword across sources → shown once (listing wins)
- [x] JS columns show "—" placeholder with tooltip
- [x] Floating action bar appears on keyword selection
- [x] All tests pass (41 backend + 47 frontend), lint clean
