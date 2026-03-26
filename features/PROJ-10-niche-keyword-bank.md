# PROJ-10: Keyword Research & Bank

**Status:** Planned
**Priority:** P1
**Created:** 2026-02-27
**Updated:** 2026-03-25

## Overview

Dedicated Keyword Research Page for discovering, analyzing, and collecting SEO/listing keywords for POD niches. Combines multiple data sources in a prioritized loading system: own DB data first (free, instant), Amazon Autocomplete (free, fast), then JungleScout API on-demand (paid, deep metrics like search volume, CPC, PPC bids, competition).

JS-Daten werden serverseitig gecached — wenn Keyword-Daten innerhalb der letzten 30 Tage existieren, wird kein neuer JS-Call gemacht.

Researched keywords flow into the Niche Drawer where they can be organized into groups, assigned to specific designs as templates, and automatically injected into PROJ-11 Listing Generation.

**Django App:** extends `idea_app` or new `keyword_app` (TBD at architecture phase)

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
3. As a member, I want search results to show own DB data first (free, instant), then Autocomplete keywords, so I see what I already have before paying for external data.
4. As a member, I want to enrich individual keywords with JungleScout data (search volume, CPC, PPC, competition) on-demand via "Enrich with JungleScout" button, so I control costs.
5. As a member, I want JungleScout data cached for 30 days per keyword, so repeated lookups don't waste API credits.
6. As a member, I want a configurable column picker for the results table, so I see only the data I care about with sensible defaults.
7. As a member, I want to click a keyword to see a Historical Search Volume trend chart (12 months), so I can evaluate if a keyword is growing or declining.
8. As a member, I want to export the current keyword list as CSV (with all visible data including JS data if loaded), so I can analyze offline.
9. As a member, I want to select keywords via checkboxes and see a context-aware "Add X Keywords to {active Niche}" button when a Niche is open in the Drawer, so I can collect keywords with one click.
10. As a member, I want a "Change Niche" fallback next to the context button to assign keywords to a different niche than the active one.

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

- [ ] AC-5: `GET /api/keywords/search/` — params: `query` (required), `marketplace` (default: amazon_com), `page`, `page_size`. Returns merged results: own DB keywords matching query + Amazon Autocomplete suggestions. Each result tagged with source.
- [ ] AC-6: `POST /api/keywords/enrich/` — body: `{keywords: ["kw1", "kw2"], marketplace}`. Checks `KeywordJSCache` first — only calls JS API for keywords without cache or cache >30 days. Returns enriched keyword data. Logged in `SearchUsageLog`.
- [ ] AC-7: `GET /api/keywords/{keyword}/history/` — params: `marketplace`, `start_date`, `end_date`. Calls JS `historical_search_volume`. Returns trend data for chart. Cached in separate `KeywordHistoryCache` or reuses `KeywordJSCache` with extended fields.
- [ ] AC-8: `GET /api/keywords/search/` response includes per keyword: `in_product_count` (how many AmazonProducts contain this keyword) and `in_slogan_count` (how many Ideas contain this keyword). Computed via DB COUNT.
- [ ] AC-9: `GET /api/keywords/export/` — params: same as search + `format=csv`. Streams CSV with all visible columns including JS data if cached.

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

## Future Enhancements

- Agent can enrich keywords with JungleScout (PROJ-18 upgrade, cost-controlled)
- Reverse ASIN lookup via JungleScout `keywords_by_asin` on the Keyword Research Page
- Keyword difficulty calculator (combining JS data + own product count data)
- Automated keyword suggestions based on niche research patterns
