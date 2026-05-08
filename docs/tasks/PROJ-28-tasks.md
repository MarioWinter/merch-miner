# PROJ-28: Niche Research Product Limit — Implementation Tasks

> Spec: [features/PROJ-28-niche-research-product-limit.md](../../features/PROJ-28-niche-research-product-limit.md)
> Branch: `feature/PROJ-28-niche-research-product-limit`

## Phase 1: Backend Foundation (Model + Migration)

- [ ] T-1.1: Add `product_limit` PositiveSmallIntegerField (default 50) to `NicheResearch` model in `niche_research_app/models.py` with `help_text` documenting allowed range and audit purpose.
- [ ] T-1.2: Generate migration `0006_add_product_limit_to_niche_research` via `makemigrations`.
- [ ] T-1.3: Run migration locally; verify default 50 applied to any existing rows in dev DB.

## Phase 2: Backend API (Serializer + View)

- [ ] T-2.1: Extend `ResearchTriggerSerializer` in `niche_research_app/api/serializers.py` with `product_limit = IntegerField(min_value=10, max_value=200, default=50, required=False)`.
- [ ] T-2.2: Add `product_limit` to `NicheResearchSerializer.fields` and `NicheResearchDetailSerializer.fields` (read-only, exposed for FE diagnostics + tests).
- [ ] T-2.3: In `NicheResearchView.post`, read `trigger.validated_data['product_limit']` and write it to `NicheResearch.product_limit` in the **create** path.
- [ ] T-2.4: In `NicheResearchView.post`, in the **force_refresh** path, overwrite `latest.product_limit` with the new validated value before save (extend the `update_fields` list).
- [ ] T-2.5: In `NicheResearchView.post`, in the **failed-retry** path, overwrite `latest.product_limit` similarly so retries respect the latest user choice.

## Phase 3: Backend Workflow (State Propagation)

- [ ] T-3.1: Add `product_limit: int` to `ResearchState` TypedDict in `niche_research_app/graph/state.py`.
- [ ] T-3.2: Extend `compile_and_run` signature in `niche_research_app/graph/workflow.py` with `product_limit: int = 50` and include it in the `initial_state` dict.
- [ ] T-3.3: In `niche_research_app/tasks.py::run_niche_research`, read `research.product_limit` and pass it to `compile_and_run` (both the AsyncPostgresSaver branch and the fallback branch).

## Phase 4: Backend Workflow (Scrape Node)

- [ ] T-4.1: In `niche_research_app/graph/nodes/scrape.py`, replace `mode=ScrapeJob.Mode.SEARCH_PAGE_ONLY` with `mode=ScrapeJob.Mode.LIVE` in the empty-DB branch.
- [ ] T-4.2: In the same branch, replace `from scraper_app.tasks import ... scrape_search_page_job` with `scrape_keyword_job`. Compute `derived_max_pages = max(2, math.ceil(product_limit / 45))` from the resolved product_limit (state value or fallback default 50), and pass it as `max_pages=derived_max_pages`.
- [ ] T-4.3: Set `pages_total=derived_max_pages` on the `ScrapeJob` row (instead of fixed 2) so progress UI shows correct totals.
- [ ] T-4.4: Update the `_get_product_asins` inner function to apply `order_by(F('bsr').asc(nulls_last=True))` and slice `[:product_limit]` (read limit from `state.get('product_limit') or 50`).
- [ ] T-4.5: Verify `Keyword`/`AmazonProduct`/`ScrapeJob` import block in scrape.py still satisfies all references after the swap; add `math` import if needed.

## Phase 5: Frontend Types + i18n

- [ ] T-5.1: Add `product_limit?: number` to `ResearchTriggerParams` in `frontend-ui/src/views/niches/research/types/index.ts`.
- [ ] T-5.2: Add i18n key `research.productLimit.label` to `frontend-ui/src/i18n/locales/de/translation.json` ("Produkte") and `…/en/translation.json` ("Products").
- [ ] T-5.3: (Optional, if other strings reference "limit") add `research.productLimit.aria` for screen-reader label if MUI default is insufficient.

## Phase 6: Frontend UI (ResearchTriggerButton)

- [ ] T-6.1: In `ResearchTriggerButton.tsx`, add controlled state `productLimit` (default 50, sourced from a constant `DEFAULT_PRODUCT_LIMIT`).
- [ ] T-6.2: Add a `TextField type="number"` between Marketplace and Product Type (or after Product Type — match design preference) with `inputProps`/`slotProps` for `min=10`, `max=200`, `step=10`, `size="small"`, `sx={{ width: 100 }}`.
- [ ] T-6.3: Implement `handleBlur` that clamps to [10, 200] and falls back to 50 on empty/NaN; updates state.
- [ ] T-6.4: Update `handleTrigger` to include `product_limit: productLimit` in the payload to `onTrigger`.
- [ ] T-6.5: Confirm DataPrismButton remains enabled regardless of input value (no disabled prop wired to validity).

## Phase 7: Backend Tests

- [ ] T-7.1: `tests/test_api.py` — POST with `product_limit=75` writes 75 to row.
- [ ] T-7.2: `tests/test_api.py` — POST without `product_limit` writes 50.
- [ ] T-7.3: `tests/test_api.py` — POST with `product_limit=5` returns 400 (out of range).
- [ ] T-7.4: `tests/test_api.py` — POST with `product_limit=500` returns 400 (out of range).
- [ ] T-7.5: `tests/test_api.py` — Force-refresh of completed research with new `product_limit=120` updates the row to 120 before re-enqueue.
- [ ] T-7.6: `tests/test_models_serializers.py` — serializer accepts 10, 50, 200; rejects 9, 201, "abc".
- [ ] T-7.7: `tests/test_nodes.py` — scrape_node with DB seeded 80 products and `product_limit=30` returns 30 ASINs ordered by BSR ASC.
- [ ] T-7.8: `tests/test_nodes.py` — scrape_node with all-NULL BSR products + `product_limit=10` returns 10 (nulls_last fallback works).
- [ ] T-7.9: `tests/test_nodes.py` — empty-DB scrape_node creates a ScrapeJob with `mode=LIVE` and calls `scrape_keyword_job` (mocked); cover three cases: limit=50 → max_pages=2, limit=120 → max_pages=3, limit=200 → max_pages=5.
- [ ] T-7.10: `tests/test_nodes.py` — when DB has 30 and `product_limit=200`, return all 30 (no exception, no re-scrape).

## Phase 8: Frontend Tests

- [ ] T-8.1: Render test — input renders with default 50.
- [ ] T-8.2: User-event test — type 5, blur → input shows 10.
- [ ] T-8.3: User-event test — type 500, blur → input shows 200.
- [ ] T-8.4: User-event test — clear input, blur → input shows 50.
- [ ] T-8.5: Click trigger → `onTrigger` called with `product_limit` matching current state.
- [ ] T-8.6: Click trigger after force_refresh toggle → payload includes `product_limit` AND `force_refresh: true`.

## Phase 9: QA Hand-off Verification

- [ ] T-9.1: Run `npm run lint` and `npm run test:ci` in `frontend-ui/` — zero failures.
- [ ] T-9.2: Run `docker compose exec web pytest niche_research_app` — zero failures.
- [ ] T-9.3: Run `docker compose exec web ruff check django-app` — zero new warnings.
- [ ] T-9.4: Smoke test in browser: trigger research on a niche with empty DB, verify deep-scrape progress UI, verify Top-N selection in resulting analysis.
- [ ] T-9.5: Update spec status header to **In Review**, update `features/INDEX.md` row to **In Review**.
