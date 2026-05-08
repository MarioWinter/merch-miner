# PROJ-28: Niche Research Product Limit

## Status: In Progress
**Created:** 2026-05-08
**Last Updated:** 2026-05-08

> **Implementation progress:** Backend complete (Phases 1–4 + 7), commit `38d9500`. Frontend (Phases 5–6 + 8) and QA (Phase 9) pending. See [tasks file](../docs/tasks/PROJ-28-tasks.md) for per-task status.

## Dependencies
- Requires: PROJ-6 (Niche Deep Research) — extends the LangGraph workflow
- Requires: PROJ-7 (Amazon Product Research) — relies on existing scraper + AmazonProduct model
- Related: PROJ-16 (Amazon Product Scraper) — uses existing `amazon_search_product` spider

## Problem
Today the AI Research workflow (`niche_research_app/graph/scrape.py`) loads **all** products in the DB matching the niche keyword without limit or ordering. LLM costs scale linearly with product count. When the DB is empty, only the lightweight `amazon_search_page` spider runs (pages 1–2, no product detail pages), which produces shallower analyses than the deep scrape used elsewhere.

## Goal
Add a user-configurable product limit on the Niche Research view to control cost per analysis, and switch the empty-DB fallback to the deep scraper so first-time analyses get rich product data.

## User Stories
- As a POD researcher, I want to set how many products the AI analyzes per run, so that I can control LLM cost vs. analysis depth.
- As a POD researcher, I want a sensible default (50) pre-filled, so that I don't have to decide on every run.
- As a POD researcher, when a niche has no products in the DB yet, I want a deep scrape (search + detail pages) to run automatically, so that the first AI analysis has full product data.
- As a POD researcher, I want the system to pick the bestselling products (lowest BSR) when more are available than my limit, so that the analysis reflects market winners, not random samples.
- As a POD researcher, I want the limit to be ad-hoc per run (not persisted), so that I can flex between quick spot-checks and deep analyses without changing settings.

## Acceptance Criteria
- [ ] AC-1: Niche Research view shows a `TextField type="number"` labeled "Produkte" / "Products" next to the Marketplace and Product-Type selectors, pre-filled with **50**.
- [ ] AC-2: Input enforces **min 10**, **max 200**, **step 10** via native attributes.
- [ ] AC-3: Auto-clamp on blur — values < 10 become 10, values > 200 become 200, empty/non-numeric becomes 50.
- [ ] AC-4: Trigger button stays enabled regardless of input state (clamping handles invalid values silently).
- [ ] AC-5: AI Research POST request includes `product_limit: number` alongside `marketplace` and `product_type`.
- [ ] AC-6: Backend selects products via `AmazonProduct.objects.filter(keywords=...).order_by(F('bsr').asc(nulls_last=True))[:product_limit]`.
- [ ] AC-7: When DB has 0 products for the keyword, backend triggers the **`amazon_search_product`** spider (deep scraper) with `max_pages = max(2, ceil(product_limit / 45))`, instead of `amazon_search_page` with fixed 2 pages.
- [ ] AC-8: `product_limit` applies identically when `force_refresh=true` (same selection logic on re-run).
- [ ] AC-9: `product_limit` is **not persisted** — every page load shows default 50.
- [ ] AC-10: New i18n key `research.productLimit.label` exists for "Produkte" / "Products".

## Edge Cases
- [ ] EC-1: BSR is NULL on some products → `nulls_last=True` ensures BSR-less products land at the end and are only selected when ranked products don't fill the limit.
- [ ] EC-2: User requests `limit=200` but DB has only 30 products → analysis runs with the 30 available; no automatic re-scrape.
- [ ] EC-3: Deep scrape returns fewer products than `limit` (e.g. Amazon shows fewer results, page errors) → analysis runs with what came back; no retry loop. Empirical per-page yield is ~48 products on the deep spider, so `max_pages = max(2, ceil(limit / 45))` provides ~5.8% headroom against worst-observed 47.6/page; only rare under-yield falls below limit.
- [ ] EC-4: Brand filter in `vision_analyze.py` shrinks the set below `limit` → analysis proceeds with filtered subset; no re-fetch.
- [ ] EC-5: Existing scrape-progress UI is reused for the empty-DB case (deep scraper takes longer than the search-page-only mode — UI must remain coherent).
- [ ] EC-6: Scrape fails or returns 0 products → workflow fails with a meaningful error message; no infinite wait.
- [ ] EC-7: Concurrent triggers with different limits (rapid double-click) → last submission wins; backend prevents parallel runs per niche.
- [ ] EC-8: User submits with field empty → onBlur restores 50 before submit fires.

## Out of Scope
- Persisting `product_limit` per workspace or per niche.
- Cost tooltip / credit-cost preview on the input (deferred — credits system not yet implemented).
- Selection strategies other than BSR ASC (no random / reviews-based / mixed mode).
- Re-scraping when DB has fewer products than requested limit (use what's available).
- Exposing scrape page count as a separate UI field (pages are derived automatically from limit).

## Technical Requirements
- Performance: trigger POST stays < 200ms (no synchronous DB heavy lifting added on the request path).
- Security: existing workspace-auth (CookieJWTAuthentication + IsAuthenticated + workspace scoping) must remain unchanged.
- Backwards compat: requests without `product_limit` must continue to work; backend defaults to 50 server-side.
- i18n: German + English label keys.

## Files Touched (informational, finalized in /architecture)
- Frontend: `frontend-ui/src/views/niches/research/partials/ResearchTriggerButton.tsx`
- Frontend types: `frontend-ui/src/views/niches/research/types/index.ts` (add `product_limit` to `ResearchTriggerParams`)
- Frontend i18n: `frontend-ui/src/i18n/locales/{de,en}/translation.json`
- Backend trigger view: `django-app/niche_research_app/api/views.py` (accept and validate `product_limit`)
- Backend serializer: `django-app/niche_research_app/api/serializers.py` (research trigger payload)
- Backend tasks: `django-app/niche_research_app/tasks.py` (switch fallback spider, propagate limit)
- Backend workflow: `django-app/niche_research_app/graph/scrape.py` (apply order_by + slice)
- Backend model: `django-app/niche_research_app/models.py` (NicheResearch may need `product_limit` field for traceability)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Component Tree (Frontend)

```
NicheResearchView
└── NicheSummaryCard (header area)
    └── ResearchTriggerButton (existing)
        ├── Marketplace Selector (existing)
        ├── Product Type Selector (existing)
        ├── Product Limit Input  ← NEW
        ├── DataPrismButton (trigger, existing)
        └── Force Refresh Switch (existing, post-completion)
```

### Data Flow

```
[User adjusts Product Limit input]
        │
        ▼
[Click DataPrismButton → onTrigger({marketplace, product_type, product_limit, force_refresh?})]
        │
        ▼
[POST /api/niches/:id/research/]
        │
        ▼ (DRF serializer validates + clamps)
[NicheResearch row created/updated with product_limit]
        │
        ▼ (RQ enqueue → research worker)
[run_niche_research → compile_and_run(... product_limit=N)]
        │
        ▼ (initial state of LangGraph)
[scrape_node]
   ├── DB has products  → select Top-N by BSR ASC, slice by product_limit
   └── DB empty         → enqueue ScrapeJob.Mode.LIVE,
                          scrape_keyword_job(max_pages = max(2, ceil(product_limit / 45)))
                          → on completion, select Top-N by BSR ASC, slice by product_limit
        │
        ▼
[vision_analyze → emotional_analyze → niche_profile → keywords → finalize]
```

### Data Model Changes

Single new field on existing `NicheResearch` model — no new tables.

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `product_limit` | PositiveSmallInteger | 50 | How many products this run analyzed (audit + force-refresh repeat). |

Migration: additive, no data backfill required (default applies to existing rows). Naming: `0006_add_product_limit_to_niche_research`.

### API Contract

| Endpoint | Method | Change | Behavior |
|----------|--------|--------|----------|
| `/api/niches/:id/research/` | POST | Accepts `product_limit: integer` (optional) | Validates 10–200; missing or invalid → defaults to 50. Stored on `NicheResearch.product_limit`. |
| `/api/niches/:id/research/` | GET (list) | Adds `product_limit` to response | Existing list serializer exposes the new field. |
| `/api/niches/:id/research/latest/` | GET | Adds `product_limit` to response | Detail serializer exposes the new field for diagnostics. |

**Path-specific limit handling:**
- **Create** (no existing run): `product_limit` from the request is written to the new row.
- **Force-refresh** (latest is COMPLETED): the request's `product_limit` overwrites the existing row's value, then the workflow re-runs.
- **Failed-retry** (latest is FAILED, retries left): the row's existing `product_limit` is **preserved** — the new request's value is ignored. A retry must repeat the original analysis identically.

### Workflow State Propagation

`product_limit` flows from the row into the LangGraph workflow:

| Layer | Mechanism |
|-------|-----------|
| `tasks.run_niche_research` | Reads `research.product_limit` (alongside marketplace/product_type) and passes to `compile_and_run`. |
| `compile_and_run` | Adds `product_limit` to the initial state dict. |
| `ResearchState` (TypedDict) | New optional field `product_limit: int`. |
| `scrape_node` | Reads `state['product_limit']` (default 50 if absent) and uses it for ordered `[:N]` slice. Also drives the empty-DB scraper page count via `derived_max_pages = max(2, ceil(product_limit / 45))`. |

The slice is applied **after** `order_by` on BSR ASC (nulls last). Brand filtering remains downstream in `vision_analyze` and is intentionally not re-fetching to fill the limit.

### Empty-DB Scrape Switch

Per-page yield (verified empirically against recent ScrapeJob rows on 2026-05-08):

| Mode | Pages_done | Products_scraped | Per page |
|------|------------|------------------|----------|
| `live` (deep) | 10 | 476 | 47.6 |
| `live` (deep) | 2 | 96 | 48.0 |
| `search_page_only` (light) | 2 | 108 | 54.0 |

| Aspect | Today | After PROJ-28 |
|--------|-------|---------------|
| Spider | `amazon_search_page` (search page only) | `amazon_search_product` (search + product detail pages) |
| Job entry point | `scrape_search_page_job` | `scrape_keyword_job(max_pages = max(2, ceil(product_limit / 45)))` |
| ScrapeJob mode | `SEARCH_PAGE_ONLY` | `LIVE` |
| Detail data captured | No (titles, ASINs, basic fields) | Yes (full product detail + images) |
| Page count | fixed 2 | Derived from limit: 2 (limit≤90), 3 (≤135), 4 (≤180), 5 (≤200), 6 (≤270), 7 (≤300), 9 (≤400) |
| Expected product yield | ~108 (light, 2 pages) | ~96 (limit=50) up to ~240 (limit=200) |
| Existing scrape-progress UI | Reused unchanged | Reused unchanged (deep scraper takes longer per page) |

**Why divisor 45 (not 48):** tight-but-safe buffer against slightly-below-average pages. Worst observed yield 47.6/page; 45 gives ~5.8% headroom so the limit is reachable even in lean scrapes without over-scraping. (Divisor 40 would over-scrape ~17%; divisor 48 would under-deliver on lean pages.)

### Validation Strategy (FE + BE Defense in Depth)

| Layer | Behavior |
|-------|----------|
| Frontend `TextField` | Native `min=10`, `max=200`, `step=10`. Auto-clamp `onBlur`. Empty → 50. Submit always allowed. |
| DRF `ResearchTriggerSerializer` | `IntegerField(min_value=10, max_value=200, default=50, required=False)`. Out-of-range → 400 (defensive — should never happen via UI). Missing → 50. |
| Workflow runtime | `state.get('product_limit') or 50` as last-line default. |

This three-layer defense means a stale or scripted client sending no value, an empty value, or a tampered value all converge to a safe analysis run.

### Backwards Compatibility

| Scenario | Behavior |
|----------|----------|
| Old client (no `product_limit` in payload) | Serializer defaults to 50 → identical to today's "all products" behavior, but capped at 50. **This is a behavior change**: niches where DB previously had > 50 products will now analyze only the Top-50 by BSR. Acceptable per spec. |
| Old `NicheResearch` rows (pre-migration) | Default 50 applies via migration. List/detail responses include the field as 50 retroactively. |
| Existing pending/running research at deploy time | Will continue using their current behavior (no product_limit in state) → falls back to default 50 in the slice. No impact. |

### Tech Decisions

| Decision | Why |
|----------|-----|
| Store `product_limit` on `NicheResearch` row, not just transient state | Force-refresh reuses the same record — the new value must persist to the row so the re-run uses it. Failed-retry, by contrast, preserves the persisted original value (retries are identical to first attempt). Also gives audit trail. |
| BSR ASC with nulls-last ordering | Lowest BSR = bestsellers — most representative of "what works" for the niche. Nulls-last keeps unranked products as a fallback only. |
| Switch to deep scraper for empty-DB only | Detail-page data dramatically improves Vision LLM quality. The DB-has-products branch already implies someone ran a deep scrape earlier — no need to redo. |
| `max_pages` derived dynamically from limit (`max(2, ceil(limit / 45))`) | Actual per-page yield is ~48 products (verified 2026-05-08), not the originally assumed 16. Fixed pages=2 would cap at ~96 products and starve high limits (200). Divisor 45 gives ~5.8% headroom against worst-observed 47.6/page — empirically validated against limit values 50, 100, 150, 200, 250, 300, 400. |
| Frontend auto-clamps silently (no error state) | Forgiving UX, fewer clicks per run, matches user-confirmed Q2 answer. |
| Limit not persisted per workspace | Keeps schema minimal. Cost-system (future credits) will likely drive a different persistence strategy anyway. |
| Defense-in-depth validation (FE + BE + runtime) | Guards against scripted clients, stale frontends, and future API consumers. Zero added latency. |

### File Structure (touched)

```
django-app/niche_research_app/
├── api/
│   ├── serializers.py           ← add IntegerField to ResearchTriggerSerializer + product_limit on response serializers
│   └── views.py                 ← capture validated product_limit, write to NicheResearch (create + force-refresh paths)
├── graph/
│   ├── nodes/scrape.py          ← switch SEARCH_PAGE_ONLY → LIVE + scrape_keyword_job, apply order_by + slice
│   └── state.py                 ← add product_limit to ResearchState TypedDict
├── graph/workflow.py            ← thread product_limit through compile_and_run signature + initial state
├── migrations/
│   └── 0006_add_product_limit_to_niche_research.py   ← NEW
├── models.py                    ← add product_limit field
├── tasks.py                     ← read product_limit from research row, pass to compile_and_run
└── tests/
    ├── test_api.py              ← clamping, defaulting, force-refresh override
    ├── test_models_serializers.py ← serializer validation cases
    └── test_nodes.py            ← scrape_node selection (BSR ordering + slice + empty-DB deep scrape)

frontend-ui/src/views/niches/research/
├── partials/
│   └── ResearchTriggerButton.tsx ← add controlled NumberField, clamping, include in onTrigger payload
├── types/index.ts                ← add product_limit?: number to ResearchTriggerParams
└── tests/
    └── ResearchTriggerButton.test.tsx ← clamping behavior, payload shape

frontend-ui/src/i18n/locales/{de,en}/translation.json ← add research.productLimit.label
```

### Dependencies (packages)

- None new. All needed: existing MUI v7 (TextField), existing DRF, existing Scrapy/spiders, existing django-rq.

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Behavior change for existing niches with > 50 products in DB (now analyses only Top-50) | Documented in spec; user explicitly chose 50 default. QA must verify on a niche with > 50 products that Top-50 by BSR is selected. |
| Switching empty-DB to deep scraper increases per-run scrape time + cost | `derived_max_pages = max(2, ceil(limit / 45))` keeps it bounded — limit=50 → 2 pages, limit=200 → 5 pages. Existing scrape-progress UI handles the longer wait via the `pages_total` field on ScrapeJob. ScraperOps slot consumption monitored via existing dashboards. |
| Force-refresh of an old completed run with no `product_limit` set | Migration default 50 applies; force-refresh path overwrites with the new value before re-run. Safe. |
| Failed-retry of an old run with no `product_limit` set | Migration default 50 applies; failed-retry path leaves it at 50 (preserves whatever was on the row). Safe. |
| Brand filter shrinks set below limit, leaving "thin" analyses | Pre-existing behavior; not made worse. Out of scope to "top up" the set. |


## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
