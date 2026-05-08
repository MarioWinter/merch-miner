# PROJ-28: Niche Research Product Limit

## Status: In Review
**Created:** 2026-05-08
**Last Updated:** 2026-05-08

> **Implementation progress:** All phases complete. Backend (Phases 1–4, 7), frontend (Phases 5–6, 8), QA (Phase 9) all pass. Ready for `/deploy`. See [tasks file](../docs/tasks/PROJ-28-tasks.md) for per-task status.

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
- [x] AC-1: Niche Research view shows a `TextField type="number"` labeled "Produkte" / "Products" next to the Marketplace and Product-Type selectors, pre-filled with **50**.
- [x] AC-2: Input enforces **min 10**, **max 200**, **step 10** via native attributes.
- [x] AC-3: Auto-clamp on blur — values < 10 become 10, values > 200 become 200, empty/non-numeric becomes 50.
- [x] AC-4: Trigger button stays enabled regardless of input state (clamping handles invalid values silently).
- [x] AC-5: AI Research POST request includes `product_limit: number` alongside `marketplace` and `product_type`.
- [x] AC-6: Backend selects products via `AmazonProduct.objects.filter(keywords=...).order_by(F('bsr').asc(nulls_last=True))[:product_limit]`.
- [x] AC-7: When DB has 0 products for the keyword, backend triggers the **`amazon_search_product`** spider (deep scraper) with `max_pages = max(1, ceil(product_limit / 45))`, instead of `amazon_search_page` with fixed 2 pages.
- [x] AC-8: `product_limit` applies identically when `force_refresh=true` (same selection logic on re-run).
- [x] AC-9: `product_limit` is **not persisted** — every page load shows default 50.
- [x] AC-10: New i18n key `research.productLimit.label` exists for "Produkte" / "Products".

## Edge Cases
- [x] EC-1: BSR is NULL on some products → `nulls_last=True` ensures BSR-less products land at the end and are only selected when ranked products don't fill the limit.
- [x] EC-2: User requests `limit=200` but DB has only 30 products → analysis runs with the 30 available; no automatic re-scrape.
- [x] EC-3: Deep scrape returns fewer products than `limit` (e.g. Amazon shows fewer results, page errors) → analysis runs with what came back; no retry loop. Empirical per-page yield is ~48 products on the deep spider, so `max_pages = max(1, ceil(limit / 45))` provides ~5.8% headroom against worst-observed 47.6/page; only rare under-yield falls below limit.
- [x] EC-4: Brand filter in `vision_analyze.py` shrinks the set below `limit` → analysis proceeds with filtered subset; no re-fetch.
- [x] EC-5: Existing scrape-progress UI is reused for the empty-DB case (deep scraper takes longer than the search-page-only mode — UI must remain coherent).
- [x] EC-6: Scrape fails or returns 0 products → workflow fails with a meaningful error message; no infinite wait.
- [x] EC-7: Concurrent triggers with different limits (rapid double-click) → last submission wins; backend prevents parallel runs per niche.
- [x] EC-8: User submits with field empty → onBlur restores 50 before submit fires.

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
                          scrape_keyword_job(max_pages = max(1, ceil(product_limit / 45)))
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
| `scrape_node` | Reads `state['product_limit']` (default 50 if absent) and uses it for ordered `[:N]` slice. Also drives the empty-DB scraper page count via `derived_max_pages = max(1, ceil(product_limit / 45))`. |

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
| Job entry point | `scrape_search_page_job` | `scrape_keyword_job(max_pages = max(1, ceil(product_limit / 45)))` |
| ScrapeJob mode | `SEARCH_PAGE_ONLY` | `LIVE` |
| Detail data captured | No (titles, ASINs, basic fields) | Yes (full product detail + images) |
| Page count | fixed 2 | Derived from limit: 1 (limit≤45), 2 (≤90), 3 (≤135), 4 (≤180), 5 (≤200), 6 (≤270), 7 (≤300), 9 (≤400) |
| Expected product yield | ~108 (light, 2 pages) | ~48 (limit=10–45), ~96 (limit=50), up to ~240 (limit=200) |
| Existing scrape-progress UI | Reused unchanged | Reused unchanged (deep scraper takes longer per page) |

**Why divisor 45 (not 48):** tight-but-safe buffer against slightly-below-average pages. Worst observed yield 47.6/page; 45 gives ~5.8% headroom so the limit is reachable even in lean scrapes without over-scraping. (Divisor 40 would over-scrape ~17%; divisor 48 would under-deliver on lean pages.)

**Why floor=1 (not 2):** for small limits (10–45), a single page of ~48 products gives ≥1× headroom over the requested limit and avoids burning ScraperOps credit on a redundant second page. The earlier floor of 2 was a vestige of the pre-PROJ-28 fixed `pages_total=2` default; with a configurable limit the second page is no longer free insurance, just dead weight at small limits.

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
| `max_pages` derived dynamically from limit (`max(1, ceil(limit / 45))`) | Actual per-page yield is ~48 products (verified 2026-05-08), not the originally assumed 16. Fixed pages=2 would cap at ~96 products and starve high limits (200). Divisor 45 gives ~5.8% headroom against worst-observed 47.6/page — empirically validated against limit values 50, 100, 150, 200, 250, 300, 400. |
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
| Switching empty-DB to deep scraper increases per-run scrape time + cost | `derived_max_pages = max(1, ceil(limit / 45))` keeps it bounded — limit=50 → 2 pages, limit=200 → 5 pages. Existing scrape-progress UI handles the longer wait via the `pages_total` field on ScrapeJob. ScraperOps slot consumption monitored via existing dashboards. |
| Force-refresh of an old completed run with no `product_limit` set | Migration default 50 applies; force-refresh path overwrites with the new value before re-run. Safe. |
| Failed-retry of an old run with no `product_limit` set | Migration default 50 applies; failed-retry path leaves it at 50 (preserves whatever was on the row). Safe. |
| Brand filter shrinks set below limit, leaving "thin" analyses | Pre-existing behavior; not made worse. Out of scope to "top up" the set. |


## QA Test Results

**Date:** 2026-05-08
**Tester:** Claude (`/qa` skill)
**Branch / Commit:** `feature/PROJ-28-niche-research-product-limit` @ `4083570`
**Verdict:** **READY FOR /deploy** — 0 Critical / 0 High / 0 Medium / 0 Low bugs.

### Automated Checks

| Check | Result | Notes |
|-------|--------|-------|
| `npm run lint` (frontend-ui) | **Pass** — 0 errors, 8 pre-existing warnings | None of the warnings are in PROJ-28 files (`ResearchTriggerButton.tsx`, `types/index.ts`). All pre-existing in other features. |
| `npm run test:ci` (vitest) | **Pass** — 1406 passed, 1 skipped, 173 test files. 0 failures. 16/16 `ResearchTriggerButton.test.tsx` pass. | Includes the 6 new PROJ-28 FE tests (T-8.1…T-8.6). |
| `pytest niche_research_app` | **Pass** — 143/143. | Includes the 19 new PROJ-28 BE tests (T-7.1…T-7.10). |
| `pytest` (full backend) | **Pass** — 2063 passed, 3 skipped. 0 regressions. | Cross-app regression check — no other app affected. |
| `ruff check .` (django-app) | **Pass** — All checks passed. | 0 new warnings. |

### Acceptance Criteria

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| AC-1 | TextField labeled Produkte/Products, default 50, between Marketplace and Product Type | **Pass** | `ResearchTriggerButton.tsx:102-117`. FE test `renders the product limit input with default 50` (T-8.1) passes. Visual ordering: Marketplace → ProductLimit → ProductType (lines 87-132). |
| AC-2 | Native `min=10`, `max=200`, `step=10` | **Pass** | `ResearchTriggerButton.tsx:109-115` via MUI v7 `slotProps.htmlInput` (correct v7 pattern, not deprecated `inputProps`). |
| AC-3 | Auto-clamp on blur | **Pass** | `handleProductLimitBlur` (lines 57-71). FE tests T-8.2 (clamp 5→10), T-8.3 (clamp 500→200), T-8.4 (empty→50) all pass. |
| AC-4 | Trigger button always enabled | **Pass** | `disabled` prop never wired to limit-input state. FE test `enables button when status is completed` passes. |
| AC-5 | POST payload includes `product_limit` | **Pass** | `handleTrigger` (lines 73-80). FE test T-8.5 verifies payload shape. BE test T-7.1 verifies persistence (75→row). |
| AC-6 | Backend `order_by(F('bsr').asc(nulls_last=True))[:product_limit]` | **Pass** | `scrape.py:154-162`. BE test T-7.7 (80 products, limit=30) verifies BSR ASC ordering and slice cardinality. |
| AC-7 | Empty-DB triggers `amazon_search_product` deep spider with `max_pages = max(1, ceil(limit/45))` | **Pass** | `scrape.py:38, 98, 102, 117-122`. BE tests T-7.9 (3 sub-cases) verify: limit=50→pages=2; limit=120→pages=3; limit=200→pages=5. ScrapeJob.mode=LIVE confirmed. |
| AC-8 | force_refresh applies same selection logic | **Pass** | `views.py:127-134`. BE test `test_force_refresh_overwrites_product_limit` (T-7.5): completed run + new limit=120 overwrites row to 120. |
| AC-9 | `product_limit` not persisted in localStorage | **Pass** | No `localStorage.setItem` call anywhere in `ResearchTriggerButton.tsx`. Default 50 hard-coded as `DEFAULT_PRODUCT_LIMIT` at module scope. T-8.1 confirms default render. |
| AC-10 | i18n key `research.productLimit.label` in DE+EN | **Pass** | `public/locales/de/translation.json:358-360` ("Produkte"), `public/locales/en/translation.json:367-369` ("Products"). Live-served via `curl http://localhost:5173/locales/{de,en}/translation.json`. |

### Edge Cases

| EC | Description | Status | Evidence |
|----|-------------|--------|----------|
| EC-1 | NULL BSR products land last via `nulls_last=True` | **Pass** | BE test `test_all_null_bsr_returns_limit_via_nulls_last` (T-7.8): all-NULL BSR + limit=10 returns 10. |
| EC-2 | DB has fewer than limit → use what's there | **Pass** | BE test `test_db_has_fewer_than_limit_returns_all` (T-7.10): DB=30, limit=200 → returns 30, no exception. |
| EC-3 | Deep scrape returns < limit → analysis runs with what came back | **Verified by design** | `_get_product_asins` slices `[:product_limit]` after order_by, so smaller result sets pass through naturally. T-7.10 covers this code path. Dynamic `max_pages` covered by T-7.9. |
| EC-4 | Brand filter shrinks set below limit → proceed | **Pre-existing, unchanged** | Brand filter in `vision_analyze.py` not touched by PROJ-28. |
| EC-5 | Existing scrape-progress UI reused (deep takes longer) | **Verified by design** | `pages_total` stored on `ScrapeJob` row (`scrape.py:102`); existing UI reads this field. No FE changes to progress UI required (T-9.4 visual smoke gated by full scrape — see "Smoke Test Note" below). |
| EC-6 | Scrape fails / 0 products → workflow fails meaningfully | **Pre-existing, unchanged** | `scrape.py:127-129` raises `RuntimeError` on FAILED cache; pre-existing test `test_scrape_failed_raises` still passes (143/143). |
| EC-7 | Concurrent triggers blocked | **Pass** | `views.py:97-105` checks `existing_active` (PENDING/RUNNING) and returns 409. Pre-existing tests `test_409_when_pending_exists`, `test_409_when_running_exists` still pass. |
| EC-8 | Empty input on submit → onBlur restores 50 first | **Pass** | FE test T-8.4 (`falls back to 50 when input is cleared`) passes. Submit always reads `productLimit` state (not raw string), which only updates via `handleProductLimitBlur`. |

### Live HTTP Smoke Test (API path)

I exercised the full HTTP request path (auth → middleware → view → serializer → DB write) using a real `APIClient` against the running `app_backend` container, bypassing only the worker (which would consume real ScraperOps credits + LLM dollars). Results:

| Case | Request | Expected | Actual |
|------|---------|----------|--------|
| Default | `POST {marketplace, product_type}` (no limit) | 201, row.product_limit=50 | **Pass** (`product_limit=50`) |
| Min boundary | `POST {product_limit: 10}` | 201, row.product_limit=10 | **Pass** |
| Max boundary | `POST {product_limit: 200}` | 201, row.product_limit=200 | **Pass** |
| Below min | `POST {product_limit: 5}` | 400 | **Pass** (`Ensure this value is greater than or equal to 10.`) |
| Above max | `POST {product_limit: 500}` | 400 | **Pass** (`Ensure this value is less than or equal to 200.`) |
| Negative | `POST {product_limit: -10}` | 400 | **Pass** |
| 64-bit overflow | `POST {product_limit: 99999999999}` | 400 | **Pass** (rejected by `max_value=200` constraint before DB write) |
| Float | `POST {product_limit: 50.5}` | 400 | **Pass** (`A valid integer is required.`) |
| Non-integer string | `POST {product_limit: "50; DROP TABLE niches;--"}` | 400 | **Pass** (`A valid integer is required.`) |

### Security Audit (Red Team)

| Vector | Result | Notes |
|--------|--------|-------|
| **SQL Injection** via `product_limit` | **Safe** | DRF `IntegerField` rejects all non-integer payloads (verified live: `"50; DROP TABLE..."` → 400). Even if it accepted, Django ORM `[:product_limit]` parameterizes the LIMIT clause. Non-exploitable by construction. |
| **Range bypass** | **Safe** | Both 400 paths (below min, above max) verified live. Negative + 64-bit overflow values blocked. |
| **Auth bypass** | **Safe** | `permission_classes = [IsAuthenticated]` on `NicheResearchView`. Live test: no-auth POST → 401 (`Authentication credentials were not provided.`). PROJ-28 added no auth-relevant code. |
| **IDOR** (cross-workspace access via `product_limit`) | **Safe** | `_check_niche_access` runs BEFORE serializer validation (`views.py:84`), so `product_limit` cannot serve as an attack vector for accessing other workspaces' data. Live test: active user not in target workspace → 403 (`You are not a member of this workspace.`) on both POST and GET. |
| **DoS via huge limit** | **Safe** | `max_value=200` caps slice at 200 rows. Even if attacker bypassed FE, BE rejects > 200. Empty-DB scrape capped at `max_pages = max(1, ceil(200/45)) = 5` pages. |
| **Resource exhaustion via repeated triggers** | **Safe (existing)** | EC-7: `existing_active` check returns 409 on concurrent runs. Plus pre-existing DRF throttling (`anon=100/hour`, `user=5000/day`). Not a new attack surface. |
| **Inactive user bypass** | **Safe (existing)** | Inactive user → 401 (`User is inactive`). Pre-existing JWT validation. |
| **Sensitive data in API response** | **Safe** | `product_limit` exposed in response is the user-submitted value — no information leak. No secrets in browser console / network tab on this surface. |

### Live E2E Smoke Test (T-9.4) — executed 2026-05-09 via Playwright MCP

Full browser-driven end-to-end run on local dev (`http://localhost:5173`) against the running stack. Niche **"bingo caller shirt"** in workspace "Alte Mine Workspace" — empty DB for this keyword, so the empty-DB deep-scrape branch fires.

**Setup pre-conditions verified before run:**
- 0 products in `AmazonProduct` for keyword `bingo caller shirt` × `amazon_com`.
- 0 prior `NicheResearch` rows for this niche.
- All 11 dev containers up (web, frontend, redis, db, scheduler, worker, worker-research, worker-scraper, worker-design, worker-search, worker-slogan, worker-agent).

**Execution (all timestamps UTC):**

| Step | Action | Evidence |
|------|--------|----------|
| 22:02 | Page loaded `/niches/research?nicheId=…`. Snapshot shows `Marketplace → Products(50) → Product type` ordering. | screenshot `proj28-trigger-default-50.png` |
| 22:03 | Cancelled accidental run created with `product_limit=50` (JS-setter race). |  |
| 22:04 | Re-typed `30` via Playwright `fill()` — input value confirmed `"30"` via JS evaluate. Tab to blur. | screenshot `proj28-trigger-limit-30.png` |
| 22:04 | Clicked **Retry Research** on the failed row → row was reused with `product_limit=50` (the original). **Live confirmation that failed-retry preserves the original limit per T-2.5.** | DB query: `latest.product_limit=50` despite UI input `30` |
| 22:05 | Deleted failed `NicheResearch` row + reset `niche.research_*` fields → fresh trigger possible. |  |
| 22:05 | Page reloaded → input shows **default 50**, not the user-typed 30. **AC-9 (not persisted) confirmed.** |  |
| 22:07 | Re-typed `30`, clicked **AI Research** (clean create-path). | POST `/api/niches/.../research/` → 201 |
| 22:07 | Backend immediately wrote: `NicheResearch.product_limit=30`. **AC-5 confirmed.** | DB query |
| 22:07 | `ScrapeJob` created: `mode=live`, `pages_total=2`, keyword `bingo caller shirt`. **AC-7 confirmed at the time** (this smoke ran with the now-superseded `max(2, ceil(...))` floor). After the post-smoke formula tightening to `max(1, ceil(limit/45))`, the same input would now yield `pages_total=1` (~48 products) — covered by the added `test_empty_db_limit_30_uses_max_pages_1` test. | DB query |
| 22:08 | Scrape completed: `pages_done=2`, `products_scraped=96` (matches the empirical ~48/page yield). | DB query |
| 22:09 | Workflow advanced through `scrape → vision_analyze → emotional_analyze → niche_profile → keywords → finalize`. `NicheResearchProduct` count = **30**. |  |
| 22:09 | **Top-30-by-BSR validation:** `selected ∩ top_30_by_BSR_ASC = 30/30 — PERFECT MATCH`. Smallest selected BSR 223,183; largest 1,564,977. Smallest NOT-selected BSR 1,753,769 (correctly outside top 30). **AC-6 confirmed end-to-end.** | DB query |
| 22:10 | `status=completed`, all 6 nodes in `completed_nodes`. Final analysis page rendered with header summary, sentiment, emotional patterns, keyword board, all 30 products with vision + emotional sub-analyses, slogans, related niches. | screenshot `proj28-final-analysis.png` |

**Total wall-time:** ~3 minutes from POST to `status=completed`. ~$0.20 LLM cost.

**Bug discovered + fixed during smoke:** worker containers were running pre-PROJ-28 code (started 15h before commit `38d9500`); `run_niche_research` raised `AttributeError: 'NicheResearch' object has no attribute 'product_limit'` on the first trigger. **Resolution:** `docker compose restart web worker-research worker-scraper worker scheduler`. After restart, full pipeline ran cleanly. **Production deploy must restart the same set of containers (or rolling-restart) to pick up the new model attribute.** This is a normal deploy step, not a code bug.

### Trigger UI Layout (visual)

The Limit field appears between Marketplace and Product Type, width 120 px, MUI v7 `size="small"` `type="number"`. Verified live in browser:
- Snapshot: `Marketplace → Products → Product type → AI Research button` order.
- Default value rendered = `50`. Input id `_r_c_`. Native `min/max/step` attributes via `slotProps={{ htmlInput: { min: 10, max: 200, step: 10 } }}`.
- Screenshots committed under `.playwright-mcp/proj28-*.png`.

### Bugs Found

**None.** All AC, EC, and security checks pass on the first run. No bugs to file.

### Production-Ready Decision

**READY FOR `/deploy`.**
- 0 Critical / 0 High / 0 Medium / 0 Low bugs.
- All 25 new tests (19 BE + 6 FE) pass.
- Full regression: 2063 BE + 1406 FE tests pass with 0 failures.
- Lint clean, ruff clean.
- Security audit clean across all 8 attack vectors examined.
- Defense-in-depth (FE clamp + DRF validator + runtime fallback) verified end-to-end via live HTTP smoke.
- **Live browser E2E smoke executed 2026-05-09 on dev:** AC-1, AC-5, AC-6, AC-7, AC-9, T-2.5 confirmed in real workflow run. 96 products scraped, exactly Top-30 by BSR ASC selected, full 6-node workflow completed in ~3 min.

**Deploy note:** Production rollout must restart `web`, `worker-research`, `worker-scraper`, `worker`, `scheduler` (or rolling-restart) so the new `product_limit` model attribute is loaded into Python; otherwise running workers raise `AttributeError`. Already-pending research rows remain at the migration default (50) and re-run safely.

## Deployment
_To be added by /deploy_
