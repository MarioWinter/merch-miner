# PROJ-28: Niche Research Product Limit — Implementation Tasks

> Spec: [features/PROJ-28-niche-research-product-limit.md](../../features/PROJ-28-niche-research-product-limit.md)
> Branch: `feature/PROJ-28-niche-research-product-limit`

## Implementation Status (2026-05-08)

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Backend Foundation (Model + Migration) | ✅ Done — commit `38d9500` |
| 2 | Backend API (Serializer + View) | ✅ Done — commit `38d9500` |
| 3 | Backend Workflow (State Propagation) | ✅ Done — commit `38d9500` |
| 4 | Backend Workflow (Scrape Node) | ✅ Done — commit `38d9500` |
| 5 | Frontend Types + i18n | ✅ Done |
| 6 | Frontend UI (ResearchTriggerButton) | ✅ Done |
| 7 | Backend Tests | ✅ Done — 19 new tests, 143 pass in app, 2063 total, 0 regressions |
| 8 | Frontend Tests | ✅ Done — 6 new tests, 1406 total pass, 0 regressions |
| 9 | QA Hand-off Verification | ✅ Done — 0 bugs, READY FOR /deploy |

## Phase 1: Backend Foundation (Model + Migration)

- [x] T-1.1: Add `product_limit` PositiveSmallIntegerField (default 50) to `NicheResearch` model in `niche_research_app/models.py` with `help_text` documenting allowed range and audit purpose. — `models.py:107-114`
- [x] T-1.2: Generate migration `0006_add_product_limit_to_niche_research` via `makemigrations`. — `migrations/0006_add_product_limit_to_niche_research.py`
- [x] T-1.3: Run migration locally; verify default 50 applied to any existing rows in dev DB.

## Phase 2: Backend API (Serializer + View)

- [x] T-2.1: Extend `ResearchTriggerSerializer` in `niche_research_app/api/serializers.py` with `product_limit = IntegerField(min_value=10, max_value=200, default=50, required=False)`. — `serializers.py:52-57`
- [x] T-2.2: Add `product_limit` to `NicheResearchSerializer.fields` and `NicheResearchDetailSerializer.fields` (read-only, exposed for FE diagnostics + tests). — `serializers.py:71, 182`
- [x] T-2.3: In `NicheResearchView.post`, read `trigger.validated_data['product_limit']` and write it to `NicheResearch.product_limit` in the **create** path. — `views.py:94, 174`
- [x] T-2.4: In `NicheResearchView.post`, in the **force_refresh** path, overwrite `latest.product_limit` with the new validated value before save (extend the `update_fields` list). — `views.py:129, 133`
- [x] T-2.5: In `NicheResearchView.post`, in the **failed-retry** path, **preserve the original `product_limit`** — do NOT overwrite. Per user decision: a retry should re-run the analysis identically to the original request that failed, not adopt a new user-chosen limit. — `views.py:140-163` (failed-retry block does not touch `product_limit`); test in `test_api.py::TestResearchTriggerProductLimit` covers preservation.

## Phase 3: Backend Workflow (State Propagation)

- [x] T-3.1: Add `product_limit: int` to `ResearchState` TypedDict in `niche_research_app/graph/state.py`. — `state.py:13`
- [x] T-3.2: Extend `compile_and_run` signature in `niche_research_app/graph/workflow.py` with `product_limit: int = 50` and include it in the `initial_state` dict. — `workflow.py:82, 117`
- [x] T-3.3: In `niche_research_app/tasks.py::run_niche_research`, read `research.product_limit` and pass it to `compile_and_run` (both the AsyncPostgresSaver branch and the fallback branch). — `tasks.py:68, 102, 116`

## Phase 4: Backend Workflow (Scrape Node)

- [x] T-4.1: In `niche_research_app/graph/nodes/scrape.py`, replace `mode=ScrapeJob.Mode.SEARCH_PAGE_ONLY` with `mode=ScrapeJob.Mode.LIVE` in the empty-DB branch. — `scrape.py:98`
- [x] T-4.2: In the same branch, replace `from scraper_app.tasks import ... scrape_search_page_job` with `scrape_keyword_job`. Compute `derived_max_pages = max(1, math.ceil(product_limit / 45))` from the resolved product_limit (state value or fallback default 50), and pass it as `max_pages=derived_max_pages`. — `scrape.py:31, 38-39, 117-121`
- [x] T-4.3: Set `pages_total=derived_max_pages` on the `ScrapeJob` row (instead of fixed 2) so progress UI shows correct totals. — `scrape.py:101`
- [x] T-4.4: Update the `_get_product_asins` inner function to apply `order_by(F('bsr').asc(nulls_last=True))` and slice `[:product_limit]` (read limit from `state.get('product_limit') or 50`). — `scrape.py:154-162`
- [x] T-4.5: Verify `Keyword`/`AmazonProduct`/`ScrapeJob` import block in scrape.py still satisfies all references after the swap; add `math` import if needed. — `scrape.py:5, 8`

## Phase 5: Frontend Types + i18n

- [x] T-5.1: Add `product_limit?: number` to `ResearchTriggerParams` in `frontend-ui/src/views/niches/research/types/index.ts`. — `types/index.ts:55-60`
- [x] T-5.2: Add i18n key `research.productLimit.label` to `frontend-ui/public/locales/de/translation.json` ("Produkte") and `…/en/translation.json` ("Products"). — `en/translation.json:367-369`, `de/translation.json:358-360` _(Note: actual i18n locale path is `public/locales/`, not `src/i18n/locales/`.)_
- [x] T-5.3: Skipped — MUI's default label-association via `label` prop is sufficient; no additional aria key needed.

## Phase 6: Frontend UI (ResearchTriggerButton)

- [x] T-6.1: In `ResearchTriggerButton.tsx`, add controlled state `productLimit` (default 50, sourced from a constant `DEFAULT_PRODUCT_LIMIT`). — `ResearchTriggerButton.tsx:23, 47-48`
- [x] T-6.2: Add a `TextField type="number"` between Marketplace and Product Type with `slotProps={{ htmlInput: { min, max, step } }}` (MUI v7 pattern, NOT deprecated `inputProps`), `size="small"`, `sx={{ width: 120 }}`. — `ResearchTriggerButton.tsx:99-114`
- [x] T-6.3: Implement `handleProductLimitBlur` that clamps to [10, 200] and falls back to 50 on empty/NaN; updates both state and the controlled input string. — `ResearchTriggerButton.tsx:57-71`
- [x] T-6.4: Update `handleTrigger` to include `product_limit: productLimit` in the payload to `onTrigger`. — `ResearchTriggerButton.tsx:73-80`
- [x] T-6.5: DataPrismButton remains enabled regardless of input value — `disabled` prop is never wired to limit-input validity (clamping happens silently on blur). — `ResearchTriggerButton.tsx:130-135`

## Phase 7: Backend Tests

- [x] T-7.1: `tests/test_api.py` — POST with `product_limit=75` writes 75 to row.
- [x] T-7.2: `tests/test_api.py` — POST without `product_limit` writes 50.
- [x] T-7.3: `tests/test_api.py` — POST with `product_limit=5` returns 400 (out of range).
- [x] T-7.4: `tests/test_api.py` — POST with `product_limit=500` returns 400 (out of range).
- [x] T-7.5: `tests/test_api.py` — Force-refresh of completed research with new `product_limit=120` updates the row to 120 before re-enqueue.
- [x] T-7.5b: `tests/test_api.py` — Failed-retry preserves the original `product_limit` (does NOT overwrite). _Added per T-2.5 user decision._
- [x] T-7.6: `tests/test_models_serializers.py` — serializer accepts 10, 50, 200; rejects 9, 201, "abc".
- [x] T-7.7: `tests/test_nodes.py` — scrape_node with DB seeded 80 products and `product_limit=30` returns 30 ASINs ordered by BSR ASC.
- [x] T-7.8: `tests/test_nodes.py` — scrape_node with all-NULL BSR products + `product_limit=10` returns 10 (nulls_last fallback works).
- [x] T-7.9: `tests/test_nodes.py` — empty-DB scrape_node creates a ScrapeJob with `mode=LIVE` and calls `scrape_keyword_job` (mocked); covers four sub-cases: **limit=30→max_pages=1** (small-limit saving), limit=50→max_pages=2, limit=120→max_pages=3, limit=200→max_pages=5.
- [x] T-7.10: `tests/test_nodes.py` — when DB has 30 and `product_limit=200`, return all 30 (no exception, no re-scrape).

## Phase 8: Frontend Tests

- [x] T-8.1: Render test — input renders with default 50. — `ResearchTriggerButton.test.tsx:103-109`
- [x] T-8.2: User-event test — type 5, blur → input shows 10. — `ResearchTriggerButton.test.tsx:111-121`
- [x] T-8.3: User-event test — type 500, blur → input shows 200. — `ResearchTriggerButton.test.tsx:123-133`
- [x] T-8.4: User-event test — clear input, blur → input shows 50. — `ResearchTriggerButton.test.tsx:135-144`
- [x] T-8.5: Click trigger → `onTrigger` called with `product_limit` matching current state. — `ResearchTriggerButton.test.tsx:146-164`
- [x] T-8.6: Click trigger after force_refresh toggle → payload includes `product_limit` AND `force_refresh: true`. — `ResearchTriggerButton.test.tsx:166-196`

## Phase 9: QA Hand-off Verification

- [x] T-9.1: `npm run lint` + `npm run test:ci` — 0 errors, 1406 FE tests pass.
- [x] T-9.2: `pytest niche_research_app` — 143/143 pass; full backend `pytest` 2063 pass, 0 regressions.
- [x] T-9.3: `ruff check django-app` — 0 new warnings.
- [x] T-9.4: **Live browser E2E smoke executed 2026-05-09** via Playwright MCP on local dev. Niche `bingo caller shirt` (empty-DB), `product_limit=30` → `pages_total=2` → 96 products scraped → `selected ∩ top_30_by_BSR_ASC = 30/30 PERFECT MATCH` → 6-node workflow completed in ~3 min, status=completed. AC-1/5/6/7/9 + T-2.5 confirmed live. Screenshots committed under `.playwright-mcp/proj28-*.png`. Deploy note: workers must be restarted to load new `product_limit` model attribute.
- [x] T-9.5: Spec status header → **In Review**; `features/INDEX.md` row updated.
