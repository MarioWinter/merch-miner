# PROJ-10: Keyword Research & Bank

**Status:** Planned
**Priority:** P1
**Created:** 2026-02-27
**Updated:** 2026-03-25

## Overview

Dedicated Keyword Research Page for discovering, analyzing, and collecting SEO/listing keywords for POD niches. Combines multiple data sources in a prioritized loading system: own DB data first (free, instant), Amazon Autocomplete (free, fast), then JungleScout API on-demand (paid, deep metrics like search volume, CPC, PPC bids, competition).

JS-Daten werden serverseitig gecached — wenn Keyword-Daten innerhalb der letzten 30 Tage existieren, wird kein neuer JS-Call gemacht.

Researched keywords flow into the Niche Drawer where they can be organized into groups, assigned to specific designs as templates, and automatically injected into PROJ-11 Listing Generation.

**Django App:** `keyword_app` (separate — own models, own domain)

## Data Sources (Priority Loading)

| Priority | Source | Cost | Data |
|----------|--------|------|------|
| 1 (instant) | Own DB | Free | Keywords from PROJ-6 Research, PROJ-7/16 scraped meta-keywords, PROJ-17 Web Search, manual entries. Plus: "In X Products", "In Y Slogans" counts. |
| 2 (on search) | Amazon Autocomplete | Free | Suggestions for search term, cached server-side |
| 3 (on-demand) | JungleScout API | ~$0.03/call | Search Volume, PPC Bid, Ease of Ranking, Organic/Sponsored Count, Trends, Dominant Category |

## JungleScout Integration

- **Python Client:** `junglescout-python-client` (official, async + sync)
- **Endpoints used:** `keywords_by_keyword` (primary), `historical_search_volume` (trend chart)
- **Caching:** JS-Daten in DB mit `fetched_at` Timestamp. Vor jedem Call: prüfe ob Daten existieren UND < 30 Tage alt → Cache verwenden. Nur wenn keine Daten oder >30 Tage → neuer JS Call.
- **Agent Limit:** max 1 JS-Call pro Niche-ID (Hauptterm, nicht Varianten). System trackt pro Niche ob JS-Call schon gemacht wurde.
- **Cost tracking:** jeder JS API Call wird in `SearchUsageLog` (PROJ-17) geloggt für PROJ-15 Analytics.
- Full API reference: `reference_junglescout_api.md`

## User Stories

### Keyword Research (Page)
1. As a member, I want a dedicated Keyword Research page where I can search for keywords and see data from multiple sources, so I can make informed decisions about which keywords to target.
2. As a member, I want Amazon Autocomplete suggestions in the search field while typing, so I discover related keywords before even searching.
2b. As a member, I want the search to only execute when I press Enter or click the Search button (not on every keystroke), so I control when the full search runs. Same pattern as PROJ-7 Product Research.
3. As a member, I want search results to show own DB data first (free, instant), then Autocomplete keywords, so I see what I already have before paying for external data.
4. As a member, I want to enrich individual keywords with JungleScout data (search volume, CPC, PPC, competition) on-demand via "Enrich with JungleScout" button, so I control costs.
5. As a member, I want JungleScout data cached for 30 days per keyword, so repeated lookups don't waste API credits.
6. As a member, I want a configurable column picker for the results table, so I see only the data I care about with sensible defaults.
6b. As a member, I want the table header to stay visible (sticky) when I scroll through results, so I always know which column is which.
6c. As a member, I want to see the Amazon product count per keyword in an "Amz Products" column (format: "> 526"), so I can gauge market saturation at a glance — like Flying Research.
6d. As a member, I want a refresh button (🔄) per keyword row to live-scrape the current Amazon product count on-demand, so I can get fresh data when I need it.
6e. As a member, I want existing product count data to always show (regardless of age) and only refresh when I explicitly click the refresh button, so I'm never missing data I already have.
7. As a member, I want to click a keyword to see a Historical Search Volume trend chart (12 months), so I can evaluate if a keyword is growing or declining.
8. As a member, I want to export the current keyword list as CSV (with all visible data including JS data if loaded), so I can analyze offline.
9. As a member, I want to select keywords via checkboxes and see a context-aware "Add X Keywords to {active Niche}" button when a Niche is open in the Drawer, so I can collect keywords with one click.
10. As a member, I want a "Change Niche" fallback next to the context button to assign keywords to a different niche than the active one.

### UI Redesign — "Keyword Lode" (approved 2026-04-15)
24. As a member, I want search results categorized into Short-Tail and Long-Tail keyword chip sections above the table, so I get a quick visual overview before diving into details.
25. As a member, I want to click a keyword chip to filter the table to that keyword, so I can drill down quickly.
26. As a member, when I search a keyword, I want to automatically see "After" suggestions ("keyword *") and "Before" suggestions ("* keyword") in separate tabs alongside regular suggestions, so I discover more keyword variations without manual work — like Flying Research.
27. As a member, I want to see my recent search terms as clickable chips below the search bar (like PROJ-7 Amazon Research), so I can quickly re-run previous searches.
28. As a member, I want JungleScout columns to show a unified "—" placeholder with "Coming Soon" tooltip when not configured, so the table feels complete but not broken.
29. As a member, I want Synonyms/related words for my search term (via Datamuse API) in a dedicated tab, so I discover alternative terms I might not have thought of.
30. As a member, I want all suggestion types (Suggestions, After, Before, Synonyms) displayed in the same DataGrid table with the same columns, so I can compare and select keywords across all sources uniformly.
31. As a member, I want hover actions (Copy to clipboard + Search) on each keyword row, so I can quickly copy a keyword or use it as a new search term — like Flying Research.

### Keyword Management (Drawer, per Niche)
11. As a member, I want to see all collected keywords for a niche in the Drawer, organized by source (Research, Amazon, Web Search, Manual, JungleScout), so I have a full overview.
12. As a member, I want to create keyword groups within a niche (e.g. "Primary", "Long-Tail", "Negative"), so I can organize keywords for different purposes.
13. As a member, I want to assign keyword groups to specific designs as templates, so when I generate a listing for that design (PROJ-11), the right keywords are automatically injected.
14. As a member, I want to edit, delete, and reorder keywords within the Drawer, so I can curate the collection.
15. As a member, I want to manually add keywords in the Drawer, so I can include keywords from my own knowledge.

### Auto-Import
16. As a member, when PROJ-6 Deep Research completes, I want research keywords auto-imported into the niche's keyword collection, so I don't have to do it manually.
17. As a member, I want to save Amazon Autocomplete suggestions from PROJ-7 searches to the keyword collection (source=amazon_search), so I capture keywords discovered during product research.

### Cross-Niche Discovery
18. As a member, I want to see which other niches have similar keywords (via Vector DB semantic search on NicheKeywordAnalysis embeddings), so I can discover cross-niche opportunities.

### Agent Integration (PROJ-18)
19. As a member, I want the Ideation Agent to research keywords using DB data + Autocomplete, so the Agent can inform its slogan generation with keyword context.
20. As a member, I want the Agent limited to max 1 JungleScout API call per niche (main term only, not variants), so Agent usage doesn't blow the JS budget.

### Chat Integration (PROJ-17)
21. As a member, I want to ask the Chat about keywords ("Which keywords are good for Camping?") and get results from Vector DB + Web Search with "Add to Niche" buttons.
22. As a member, I want the Chat to know my current Keyword Research context (active search term + results) when I'm on the Keyword Page, so I can ask "Which of these have the best potential?"
23. As a member, I want to tell the Chat "Add 'camping humor shirt' to Camping Dad" and have it executed, so I can manage keywords conversationally.

## Acceptance Criteria

### Models

- [ ] AC-1: `NicheKeyword` model: UUID pk, `niche` FK (on_delete=CASCADE), `keyword` CharField(200), `source` choices [research, amazon_search, web_search, manual, junglescout], `group` FK (NicheKeywordGroup, nullable), `design_template` FK (Design, nullable — links keyword to specific design for PROJ-11 auto-injection), `created_by` FK (User, nullable), `created_at`. `unique_together = [('niche', 'keyword')]`.
- [ ] AC-2: `NicheKeywordGroup` model: UUID pk, `niche` FK (on_delete=CASCADE), `name` CharField(100), `position` PositiveIntegerField (ordering), `created_by` FK (User), `created_at`. `unique_together = [('niche', 'name')]`.
- [ ] AC-3: `KeywordJSCache` model: UUID pk, `keyword` CharField(200), `marketplace` CharField(20), `monthly_search_volume_exact` IntegerField(nullable), `monthly_search_volume_broad` IntegerField(nullable), `monthly_trend` FloatField(nullable), `quarterly_trend` FloatField(nullable), `ppc_bid_exact` FloatField(nullable), `ppc_bid_broad` FloatField(nullable), `sp_brand_ad_bid` FloatField(nullable), `ease_of_ranking_score` IntegerField(nullable), `relevancy_score` IntegerField(nullable), `organic_product_count` IntegerField(nullable), `sponsored_product_count` IntegerField(nullable), `dominant_category` CharField(200, blank=True), `recommended_promotions` IntegerField(nullable), `fetched_at` DateTimeField. `unique_together = [('keyword', 'marketplace')]`. Index on `fetched_at` for cache expiry queries.
- [ ] AC-4: `NicheJSCallTracker` model: UUID pk, `niche` FK (unique — one record per niche), `called_at` DateTimeField, `keyword_used` CharField(200). Tracks whether Agent has already used its 1 JS-Call for this niche.

### Keyword Research API

- [ ] AC-4b: `KeywordProductCount` model: UUID pk, `keyword` CharField(200), `marketplace` CharField(20), `product_count` PositiveIntegerField, `fetched_at` DateTimeField. `unique_together = [('keyword', 'marketplace')]`. Stores Amazon product count per keyword. No auto-expiry — data shown regardless of age, refreshed only on explicit user action.

### Keyword Research API

- [ ] AC-5: `GET /api/keywords/search/` — params: `query` (required), `marketplace` (default: amazon_com), `page`, `page_size`. Returns merged results: own DB keywords matching query + Amazon Autocomplete suggestions. Each result tagged with source.
- [ ] AC-5b: **Search trigger:** Search only fires on Enter key press or Search button click — NOT on every keystroke. Amazon Autocomplete suggestions in the dropdown remain live (debounced 300ms). Same pattern as PROJ-7 AC-18.
- [ ] AC-5c: **Sticky table header:** Keyword results table has a sticky/fixed header row that stays visible when scrolling. MUI DataGrid `stickyHeader` or equivalent.
- [ ] AC-6: `POST /api/keywords/enrich/` — body: `{keywords: ["kw1", "kw2"], marketplace}`. Checks `KeywordJSCache` first — only calls JS API for keywords without cache or cache >30 days. Returns enriched keyword data. Logged in `SearchUsageLog`.
- [ ] AC-7: `GET /api/keywords/{keyword}/history/` — params: `marketplace`, `start_date`, `end_date`. Calls JS `historical_search_volume`. Returns trend data for chart. Cached in separate `KeywordHistoryCache` or reuses `KeywordJSCache` with extended fields.
- [ ] AC-8: `GET /api/keywords/search/` response includes per keyword: `in_product_count` (how many AmazonProducts contain this keyword) and `in_slogan_count` (how many Ideas contain this keyword). Computed via DB COUNT.
- [ ] AC-9: `GET /api/keywords/export/` — params: same as search + `format=csv`. Streams CSV with all visible columns including JS data if cached.
- [ ] AC-9b: `POST /api/keywords/product-count/` — body: `{keyword, marketplace}`. Scrapes Amazon Page 2 for the keyword, extracts result count from `<h2>` header ("49-96 of **549** results for"). Uses Page 2 (not Page 1) because Amazon Bug shows inflated count on Page 1. Uses ScraperOps proxy (same as PROJ-16). Upserts `KeywordProductCount` record. Returns `{keyword, marketplace, product_count, fetched_at}`.
- [ ] AC-9c: `GET /api/keywords/search/` response includes `amazon_product_count` (from `KeywordProductCount` cache) and `product_count_fetched_at` per keyword where available. Shows existing data regardless of age — no auto-refresh.
- [ ] AC-9d: **PROJ-16 Scraper integration:** PROJ-16 Scrapy Spider extracts result count from Page 2 HTML (`div.sg-col-inner h2 span` → parse "X-Y of **N** results for" → extract N). Upserts `KeywordProductCount` for the search keyword. Automatic — no extra request, data captured as a side-effect of product scraping.

### UI Redesign — "Keyword Lode"

- [ ] AC-31: **Suggestion Tabs** replace old Source Tabs. MUI Tabs above the table: `All (N)` | `Suggestions (N)` | `After (N)` | `Before (N)` | `Synonyms (N)` | `JungleScout` 🔒 (disabled). Each tab filters the same DataGrid table. Count badges per tab. Source column in table shows `suggestion` / `after` / `before` / `synonym`.
- [ ] AC-32: **Automatic generation** — on search execution, automatically fire in parallel: (a) standard autocomplete for "keyword", (b) autocomplete for "keyword " (trailing space = after/suffix suggestions), (c) autocomplete for " keyword" (leading space = before/prefix suggestions), (d) Datamuse API for synonyms/related words. All results merged into one dataset, each tagged with source. Deduplicate across sources — first occurrence wins.
- [ ] AC-33: **Same table for all tabs** — ALL tab shows everything merged. Other tabs filter by source. Same DataGrid columns (keyword, source badge, amz products, volume, CPC etc.) for all tabs. No separate layouts.
- [ ] AC-34: **Improved Table Styling:** Sticky header, alternating row backgrounds. Row hover = `primary.subtle`. JungleScout columns visible but show "—" in `text.disabled` at 40% opacity. Tooltip on JS column headers: "JungleScout coming soon".
- [ ] AC-35: **Floating Action Bar:** When keywords are selected via checkbox, a sticky bottom bar appears: "{count} selected" + "Add to Niche" button + "Enrich" button (disabled). Glass-md background, slide-up animation.
- [ ] AC-36: **Search History:** Below the search input, up to 10 recent searches as clickable chips. Click re-fills + executes search. "×" delete, "Clear all" link. localStorage `mm-keyword-recent`. Same pattern as PROJ-7.
- [ ] AC-37: **Hover actions** — each table row shows on hover (right side): Copy to clipboard icon + Search icon (re-searches that keyword as new main term). Like Flying Research. Copy shows snackbar "Copied!".
- [ ] AC-38: **Datamuse Synonyms** — Backend endpoint `GET /api/keywords/synonyms/?query=X` calls Datamuse API (`api.datamuse.com/words?ml=X`), returns related words. Cached in `SynonymCache` model (keyword → results JSON, no expiry — words don't change). English only. Max 20 results.
- [ ] AC-39: **After suggestions** — on search, calls Amazon Autocomplete with "keyword " (keyword + trailing space). Returns suffix suggestions. Client-side, reuses existing autocomplete endpoint with modified query. Tagged as `source=after`.
- [ ] AC-40: **Before suggestions** — on search, calls Amazon Autocomplete with " keyword" (leading space + keyword). Returns prefix suggestions. Client-side, reuses existing autocomplete endpoint. Tagged as `source=before`.
- [ ] AC-41: **Keyword Chip Cloud** (kept from original): Above tabs, two collapsible sections — Short-Tail (≤2 words, `secondary.main` tint) and Long-Tail (≥3 words, `info.main` tint). Each chip: keyword + product count badge. Click filters table. "Show all" if >12. Computed from ALL results across all sources.

### Keyword Collection API (per Niche)

- [ ] AC-10: `GET /api/niches/{id}/keywords/` — returns all keywords for niche, ordered by group then position. Filterable by `?source=` and `?group_id=`.
- [ ] AC-11: `POST /api/niches/{id}/keywords/` — add keyword. Body: `{keyword, source (default: manual), group_id (optional)}`. Returns 409 if duplicate.
- [ ] AC-12: `POST /api/niches/{id}/keywords/bulk-add/` — body: `{keywords: [{keyword, source}], group_id (optional)}`. Skips duplicates silently.
- [ ] AC-13: `DELETE /api/niches/{id}/keywords/{keyword_id}/` — remove keyword.
- [ ] AC-14: `POST /api/niches/{id}/keywords/bulk-delete/` — body: `{ids: [...]}`.
- [ ] AC-15: `PATCH /api/niches/{id}/keywords/{keyword_id}/` — update group, position, design_template.

### Keyword Groups API

- [ ] AC-16: `GET /api/niches/{id}/keyword-groups/` — list groups for niche.
- [ ] AC-17: `POST /api/niches/{id}/keyword-groups/` — create group. Body: `{name}`.
- [ ] AC-18: `PATCH /api/niches/{id}/keyword-groups/{group_id}/` — update name, position.
- [ ] AC-19: `DELETE /api/niches/{id}/keyword-groups/{group_id}/` — delete group. Keywords in group become ungrouped (group=null).

### Auto-Import

- [ ] AC-20: On `NicheResearch` status → `completed`: auto-insert `top_focus_keywords` + `main_short_tail` from `NicheKeywordAnalysis` as `source=research` rows. Skip duplicates silently.
- [ ] AC-21: PROJ-7 Autocomplete "+" Save button calls `POST /api/niches/{id}/keywords/` with `source=amazon_search`.
- [ ] AC-22: PROJ-17 Web Search "Save Keywords" quick-action calls `POST /api/niches/{id}/keywords/bulk-add/` with `source=web_search`.

### Agent Integration

- [ ] AC-23: Ideation Agent tool `keyword_search`: searches own DB + Autocomplete. Returns keyword data. Permission: Auto.
- [ ] AC-24: Ideation Agent tool `add_keyword_to_niche`: adds keyword to niche collection. Permission: Notify.
- [ ] AC-25: Agent JS limit: `keyword_search_js` tool checks `NicheJSCallTracker` — if niche already has a record, uses cache. If not, makes 1 JS-Call (Page 1 = Top 100 keywords), creates tracker record. Max 1 JS-Call per Niche-ID.

### Chat Integration

- [ ] AC-26: Chat (PROJ-17) can query keywords via Vector DB + Vane Web Search when user asks about keywords. Results include "Add to Niche" buttons.
- [ ] AC-27: When user is on Keyword Research Page and opens Chat, the active search term + result count is passed as context. Chat can reason about the current results.
- [ ] AC-28: Chat command "Add {keyword} to {niche name}" → calls `POST /api/niches/{id}/keywords/` with `source=manual`. Confirms: "Added '{keyword}' to {niche}."

### PROJ-11 Integration (Listing Generation)

- [ ] AC-29: Keywords assigned to a design via `design_template` FK are auto-injected as `extra_keywords` when generating a listing for that design in PROJ-11.
- [ ] AC-30: "Add from Keyword Bank" modal in PROJ-11 listing form shows niche keywords grouped by group. If keywords are assigned to the current design → pre-selected.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/keywords/search/` | Member | Search keywords (DB + Autocomplete) |
| POST | `/api/keywords/enrich/` | Member | Enrich with JungleScout (on-demand, cached) |
| GET | `/api/keywords/{keyword}/history/` | Member | Historical search volume chart |
| GET | `/api/keywords/export/` | Member | CSV export |
| POST | `/api/keywords/product-count/` | Member | On-demand Amazon product count scrape (Page 2) |
| GET | `/api/keywords/synonyms/` | Member | Datamuse synonyms/related words (cached) |
| GET | `/api/niches/{id}/keywords/` | Member | List niche keywords |
| POST | `/api/niches/{id}/keywords/` | Member | Add keyword to niche |
| POST | `/api/niches/{id}/keywords/bulk-add/` | Member | Bulk add keywords |
| DELETE | `/api/niches/{id}/keywords/{keyword_id}/` | Member | Remove keyword |
| POST | `/api/niches/{id}/keywords/bulk-delete/` | Member | Bulk delete |
| PATCH | `/api/niches/{id}/keywords/{keyword_id}/` | Member | Update keyword (group, design, position) |
| GET | `/api/niches/{id}/keyword-groups/` | Member | List keyword groups |
| POST | `/api/niches/{id}/keyword-groups/` | Member | Create group |
| PATCH | `/api/niches/{id}/keyword-groups/{group_id}/` | Member | Update group |
| DELETE | `/api/niches/{id}/keyword-groups/{group_id}/` | Member | Delete group |

## Edge Cases

- [ ] EC-1: JungleScout API key not configured → "Enrich" button disabled with tooltip "Configure JungleScout API key in Settings". DB + Autocomplete data still works.
- [ ] EC-2: JungleScout API returns 429 (rate limit) → retry after 60s. Show "JS rate limited, retrying..." indicator.
- [ ] EC-3: JungleScout API key expired/invalid → show error, disable enrich. Other data sources unaffected.
- [ ] EC-4: Keyword exists in cache but >30 days → auto-refresh on next enrich call. Show "Last updated: X days ago" badge.
- [ ] EC-5: Same keyword added from multiple sources → unique constraint on (niche, keyword). First insert wins. Source shows the original source.
- [ ] EC-6: Agent tries second JS-Call for same niche → `NicheJSCallTracker` blocks. Agent uses cached data. No error, transparent.
- [ ] EC-7: Keyword group deleted → keywords in group become ungrouped (group=null), not deleted.
- [ ] EC-8: Design template deleted → keywords with that design_template FK set to null. Keywords preserved.
- [ ] EC-9: Export with 0 results → CSV with headers only.
- [ ] EC-10: Very long keyword (>200 chars) → truncated to 200 with warning.
- [ ] EC-11: Chat "Add keyword to niche" but niche name ambiguous (multiple matches) → Chat asks: "Which niche? Camping Dad or Camping Mom?"
- [ ] EC-12: Amazon product count scrape fails (ScraperOps timeout, blocked, network error) → show error toast "Could not fetch product count". Existing cached data (if any) stays displayed.
- [ ] EC-13: Amazon product count = 0 (no results for keyword) → display "> 0" in column. Valid data, not an error.
- [ ] EC-14: Amazon Page 2 returns different HTML structure (no result count header) → parse returns null. Show "n/a" in column. Log warning for debugging.
- [ ] EC-15: Keyword with special characters (quotes, ampersands) in Amazon search URL → URL-encode keyword before scraping.
- [ ] EC-16: All results in one suggestion type → other tabs show (0) count, not hidden. Chip cloud section hidden if all short-tail or all long-tail.
- [ ] EC-17: Search history localStorage corrupted/invalid JSON → reset to empty array silently.
- [ ] EC-18: Suggestion tab filter returns 0 results → show EmptyState within the tab, not the full-page empty state.
- [ ] EC-19: Datamuse API unavailable (timeout, 5xx) → Synonyms tab shows (0), no error toast. Other tabs unaffected.
- [ ] EC-20: Autocomplete returns same keyword for After/Before as regular Suggestions → deduplicate across sources, keep first occurrence (Suggestions > After > Before > Synonyms priority).
- [ ] EC-21: Copy to clipboard fails (older browser, no HTTPS) → fallback: select text in a hidden textarea. Show "Copied!" snackbar on success.

## Environment Variables Required

```
# New:
JUNGLESCOUT_API_KEY_NAME=         # JS API key name
JUNGLESCOUT_API_KEY=              # JS API key secret
JUNGLESCOUT_DEFAULT_MARKETPLACE=us  # Default marketplace for JS queries

# Existing (shared):
OPENROUTER_API_KEY=               # For Vector DB embeddings (PROJ-15)
```

Document in `django-app/env/.env.template`.

## Dependencies

- PROJ-5 (Niche model — niche FK)
- PROJ-6 (NicheKeywordAnalysis — auto-import source)
- PROJ-7 (Amazon Autocomplete — save integration + product meta-keywords)
- PROJ-11 (Listing Generator — consumes keyword bank, design_template auto-injection)
- PROJ-15 (Vector Database — NicheKeywordAnalysis embeddings for cross-niche discovery)
- PROJ-17 (Web Search — web_search source, Chat keyword commands)
- PROJ-18 (Agent — Ideation Agent keyword tools, JS call limit)

## Amendments (PROJ-15/18/19 Harmonization)

### Vector DB Integration (PROJ-15)
- `NicheKeywordAnalysis` is an embeddable source. Embedding text: `all_keywords_flat`.
- Cross-Niche Keyword Discovery via semantic search on embeddings.
- Individual `NicheKeyword` rows NOT embedded separately.

### Decisions Log

| # | Topic | Decision |
|---|-------|----------|
| 1 | Page concept | Keyword Research Page (discover + analyze) + Drawer (organize + assign) |
| 2 | Data sources | DB first → Autocomplete → JungleScout on-demand |
| 3 | JS caching | 30-day cache per keyword in DB, no duplicate calls |
| 4 | JS in PROJ-7 | No — scraped meta-keywords shown in PROJ-7, JS only in PROJ-10 |
| 5 | JS nachladen | On-demand per user click, not automatic |
| 6 | Keyword → Niche | Context-aware button "Add to {active Niche}" + Change Niche fallback |
| 7 | Table columns | Configurable column picker with sensible defaults |
| 8 | Extra features | CSV Export + Historical Trend Chart |
| 9 | Drawer features | Keyword groups + Design template assignment + edit/delete/reorder |
| 10 | Agent JS limit | Max 1 JS-Call per Niche-ID (main term only) |
| 11 | Chat integration | Conversational keyword search + add commands |
| 12 | UI redesign | "Keyword Lode" — Chip Cloud + Suggestion Tabs + improved table (Flying Research inspired) |
| 13 | Search history | Recent searches as chips below input, localStorage, same as PROJ-7 pattern |
| 14 | Short/Long-Tail split | ≤2 words = Short-Tail, ≥3 words = Long-Tail (client-side) |
| 15 | Suggestion Tabs | Replace DB/AMZ Source Tabs with Suggestion-type tabs: All, Suggestions, After, Before, Synonyms, JS🔒 |
| 16 | After/Before | Automatic — trailing/leading space triggers Amazon suffix/prefix suggestions. No manual modifier toggles |
| 17 | Synonyms | Datamuse API (free, no key, EN only). Cached in DB permanently. Max 20 results |
| 18 | Hover actions | Copy + Search icons per row on hover (Flying Research pattern) |
| 19 | Deduplication | Same keyword across sources → keep first occurrence. Priority: Suggestions > After > Before > Synonyms |

## Verification Steps

1. Type "camping" → Autocomplete suggestions appear in dropdown (live, 300ms debounce). No table results yet
1b. Press Enter or click Search button → full search executes, results table populates
1c. Scroll results table → header row stays visible (sticky)
2. Click "Enrich with JungleScout" on keyword → JS data loads (search volume, CPC, PPC, competition)
3. Enrich same keyword again within 30 days → uses cache, no API call
4. Enrich keyword after 30 days → makes new JS call, updates cache
5. Click keyword row → Historical Search Volume chart appears (12 months)
6. Select 3 keywords + click "Add to {niche}" → 3 `NicheKeyword` records created
7. Add duplicate keyword to niche → 409 (or silently skipped in bulk-add)
8. Open Drawer → keywords grouped by source, organized by groups
9. Create keyword group "Primary" → drag keywords into it → position saved
10. Assign keyword group to design template → saved on `NicheKeyword.design_template`
11. PROJ-6 research completes → research keywords auto-imported (source=research)
12. Export CSV → all visible columns including JS data where cached
13. JS API key not configured → Enrich button disabled, tooltip shows
14. Agent calls `keyword_search_js` → first call makes JS request, second call uses cache
15. Delete keyword group → keywords become ungrouped (not deleted)
16. Workspace isolation: keywords from other workspaces → 403
17. "Amz Products" column shows "> 526" format for keywords with cached product count
18. Click 🔄 refresh on a keyword → loading spinner → fresh product count scraped from Amazon Page 2 → column updates
19. Keyword with no product count data → column shows empty/dash. Click 🔄 → first-time scrape → count appears
20. PROJ-16 product research scrape completes → product count auto-captured from Page 2 → shows in Keyword Bank without manual refresh
21. Product count scrape fails → error toast, existing cached data stays visible
22. Search "school bus driver" → Short-Tail chips show "school bus driver", Long-Tail shows "school bus driver gifts" etc.
23. Click Short-Tail chip → table filters to that keyword
24. Suggestion Tabs show: All (57) | Suggestions (24) | After (15) | Before (12) | Synonyms (6) | JS 🔒
25. Click "After" tab → table shows only suffix suggestions ("school bus driver gifts", "school bus driver shirt" etc.)
26. Click "Before" tab → table shows prefix suggestions ("funny school bus driver", "best school bus driver" etc.)
27. Click "Synonyms" tab → table shows Datamuse related words ("transit operator", "bus operator" etc.)
28. All tabs use the same table with same columns — no layout change on tab switch
29. JS columns show "—" placeholder with tooltip "JungleScout coming soon"
30. Hover on keyword row → Copy + Search icons appear on right. Click Copy → "Copied!" snackbar. Click Search → re-searches that keyword
31. Search "camping" → appears as recent search chip below search bar
32. Search "hiking" → "hiking" + "camping" chips (newest first). Click → re-executes
33. Click "×" on chip → removed. "Clear all" → all removed
34. Datamuse API down → Synonyms tab shows (0), no error. Other tabs work normally
35. Same keyword in Suggestions + After → deduplicated, shown once (Suggestions wins)

---

## Tech Design (Solution Architect)

> Decided: 2026-03-27 | Approved by user.

### A) Backend Architecture

**New Django app:** `keyword_app`

```
keyword_app/
├── models.py                           # NicheKeyword, NicheKeywordGroup,
│                                       #   KeywordJSCache, NicheJSCallTracker
├── api/
│   ├── views.py                        # Research search, enrich, history, CRUD, groups
│   ├── serializers.py                  # All serializers
│   └── urls.py                         # URL routing
├── services/
│   ├── junglescout_service.py          # JS API wrapper, cache logic, call tracking
│   ├── autocomplete_service.py         # Amazon Autocomplete (reuses research_app proxy)
│   └── auto_import.py                  # Signal handler for PROJ-6 research completion
├── admin.py
└── tests/
```

**Registered in:** `core/settings.py` INSTALLED_APPS, `core/urls.py`

---

### B) Frontend Architecture

**Routes:**
- `/keywords` — Keyword Research Page (search + analyze + collect)
- Drawer integration: "Keywords" tab in NicheDetailDrawer (organize + assign)

```
views/keywords/
├── research/
│   ├── KeywordResearchView.tsx         # Main research page
│   ├── hooks/
│   │   ├── useKeywordSearch.ts         # Search + merged results (DB + Autocomplete)
│   │   ├── useJSEnrich.ts             # On-demand JungleScout enrichment
│   │   └── useKeywordExport.ts        # CSV export
│   ├── partials/
│   │   ├── KeywordSearchBar.tsx        # Search input + Autocomplete suggestions
│   │   ├── KeywordTable.tsx            # MUI DataGrid with configurable columns
│   │   ├── ColumnPicker.tsx            # Column visibility config
│   │   ├── EnrichButton.tsx            # "Enrich with JungleScout" per-row + bulk
│   │   ├── TrendChart.tsx              # Historical search volume (@mui/x-charts)
│   │   ├── AddToNicheButton.tsx        # Context-aware "Add X to {niche}" + Change Niche
│   │   ├── SourceBadge.tsx             # research / amazon / web_search / manual / JS
│   │   └── EmptyState.tsx
│   ├── types/
│   │   └── index.ts
│   └── tests/
│
└── drawer/
    ├── DrawerKeywordsSection.tsx        # Keywords tab content in NicheDetailDrawer
    ├── partials/
    │   ├── KeywordGroupList.tsx         # Groups with drag-to-reorder
    │   ├── KeywordGroupCard.tsx         # Single group with keywords inside
    │   ├── KeywordChipRow.tsx           # Single keyword: chip + source badge + actions
    │   ├── ManualKeywordInput.tsx       # Add keywords manually
    │   └── DesignTemplateAssign.tsx     # Assign group to design template
    └── types/
        └── index.ts

store/
└── keywordSlice.ts                     # RTK Query: search, enrich, history, CRUD, groups
```

---

### C) Data Flow

```
Keyword Research Page:
  Search "camping" → fires 4 requests in parallel:
    1. Autocomplete "camping" → Suggestions (source=suggestion)
    2. Autocomplete "camping " (trailing space) → After suggestions (source=after)
    3. Autocomplete " camping" (leading space) → Before suggestions (source=before)
    4. GET /api/keywords/synonyms/?query=camping → Datamuse (source=synonym)
    → All merged + deduplicated → displayed in Suggestion Tabs
    → "Enrich" button per row → JS API (cached 30d) → adds search volume, CPC, etc.
    → Hover: Copy + Search icons per row
    → Select keywords → "Add to {active Niche}" → POST /api/niches/{id}/keywords/

Drawer Keywords Tab:
  Open Drawer → load keywords grouped by NicheKeywordGroup
    → Create/rename/delete groups
    → Drag keywords between groups
    → Assign group to design template → PROJ-11 auto-injection

Auto-Import:
  PROJ-6 research completes → signal → auto-insert research keywords (source=research)
  PROJ-7 Autocomplete save → POST source=amazon_search
  PROJ-17 Web Search save → POST source=web_search
```

---

### D) Tech Decisions

| Decision | Why |
|----------|-----|
| Separate `keyword_app` (not in `idea_app`) | 4 eigene Models, 14 Endpoints, eigene Domain — Single Responsibility |
| No dedicated worker | JS API calls sind schnell (<2s). Default queue reicht. Kein eigener Worker nötig |
| 30-day cache in DB (not Redis) | Cache muss persistent sein + queryable (expired check). Redis TTL nicht ausreichend |
| `junglescout-python-client` | Offizieller Python Client, async + sync, alle benötigten Endpoints |
| `NicheJSCallTracker` separates Model | Explizites Tracking pro Niche — einfacher zu querien als JSONField oder Counter |
| Amazon Autocomplete via `research_app` proxy | Endpoint existiert bereits (PROJ-7). Kein Duplizieren |
| `design_template` FK auf NicheKeyword | Direkter Link Keyword → Design für PROJ-11 Auto-Injection. Einfacher als N:M |
| Signal für Auto-Import | `post_save` auf NicheResearch(status=completed) — automatisch, kein manueller Trigger |

---

### E) Infrastructure Changes

| Change | Where |
|--------|-------|
| `keyword_app` registered | `INSTALLED_APPS` + `core/urls.py` |
| `junglescout-python-client` | `requirements.txt` |
| 3 new env vars | `JUNGLESCOUT_API_KEY_NAME`, `JUNGLESCOUT_API_KEY`, `JUNGLESCOUT_DEFAULT_MARKETPLACE` |
| Env vars documented | `django-app/env/.env.template` |

---

### F) New Packages

**Backend:**

| Package | Purpose |
|---------|---------|
| `junglescout-python-client` | Official JungleScout API client (keyword data, trends) |

**Frontend:** No new packages — `@mui/x-data-grid` + `@mui/x-charts` already installed.

---

## Future Enhancements

- Agent can enrich keywords with JungleScout (PROJ-18 upgrade, cost-controlled)
- Reverse ASIN lookup via JungleScout `keywords_by_asin` on the Keyword Research Page
- Keyword difficulty calculator (combining JS data + own product count data)
- Automated keyword suggestions based on niche research patterns
