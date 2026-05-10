# PROJ-7 — Phase 8 — Keywords Tab for DB-Mode Searches

> Tech Design: see `features/PROJ-7-amazon-product-research.md` → "Tech Design Amendment: Phase 8 — DB-Mode Keywords".
> Branch: `fix/amazon-research-bugs` (consistent with the other Amazon Research bug fixes already on the branch).

## Phase 1 — Backend Foundation

- [x] Locate `_build_product_queryset(filters)` and confirm it accepts the validated `ProductFilterSerializer` data unchanged — views.py:128 (already used by `ProductListView` at views.py:538)
- [x] Confirm `extract_keywords(products, keyword_text='')` accepts a list of dicts with the field names used by `AmazonProductSerializer` (title, brand, bullet_1, bullet_2, description) — keyword_extractor.py:239, fields read at lines 274, 278
- [x] Decide product-dict shape passed to the extractor: `.values('title', 'brand', 'bullet_1', 'bullet_2', 'description')` chosen for memory + speed — views.py:601-604

## Phase 2 — Backend Endpoint

- [x] Add `DbKeywordsView(APIView)` in `django-app/research_app/api/views.py` with `CookieJWTAuthentication` + `IsAuthenticated` — views.py:572-573
- [x] Validate query params with the existing `ProductFilterSerializer` (`raise_exception=True`) — views.py:576-578
- [x] Compute the cache key: `f"research:keywords:{sha256(json.dumps(validated_data, sort_keys=True, default=str)).hexdigest()}"` — views.py:69-77 (`_db_keywords_cache_key` helper)
- [x] Attempt `cache.get(key)`; on hit return cached payload with `cached: true` — views.py:581-587
- [x] On miss: build queryset via `_build_product_queryset(filters)`, slice to top 200 ordered by BSR ascending, materialize via `.values(...)` — views.py:589-605
- [x] Call `extract_keywords(products)` (ignore the `keyword_text` argument — it is unused inside the extractor) — views.py:607
- [x] Map extractor output: `global_top_focus → top_focus_keywords`, `global_top_long_tail → top_long_tail_keywords` — views.py:608-613
- [x] Set `sample_size = len(products)`, `cached = false` — views.py:611-612
- [x] `cache.set(key, payload, timeout=600)` (10 minutes) — views.py:615
- [x] Return DRF `Response(payload, status=200)` — views.py:616
- [x] Wire URL in `django-app/research_app/api/urls.py`: `path('research/products/keywords/', DbKeywordsView.as_view(), name='research-products-keywords')` — urls.py:26-28 (placed before `<str:asin>` patterns)

## Phase 3 — Backend Tests

Tests live in `django-app/research_app/tests/test_db_keywords_view.py`.

- [x] Empty queryset → 200, empty `top_focus_keywords`, empty `top_long_tail_keywords`, `sample_size == 0` — test_db_keywords_view.py:39-46
- [x] Filter-only mode (no keyword param) → returns a valid result without raising — test_db_keywords_view.py:49-68
- [x] Cache miss followed by cache hit on identical params → second call returns `cached: true` and never re-queries the DB (assert via `assertNumQueries` or by mocking the queryset) — test_db_keywords_view.py:71-93 (mocks `_build_product_queryset`, asserts `not_called`)
- [x] Cache key stability: same validated_data in different param ordering produces the same hash (test the helper directly) — test_db_keywords_view.py:130-146
- [x] Top-N capping: insert > 200 matching products; sample_size must be exactly 200 — test_db_keywords_view.py:154-167
- [x] Invalid filter (e.g. `bsr_min > bsr_max`) → 400 with serializer error message — test_db_keywords_view.py:170-173
- [x] Unauthenticated request → 401 — test_db_keywords_view.py:32-34
- [x] Confirm full suite still green: `docker compose exec web pytest research_app/` — 158 passed in 5.56s

## Phase 4 — Frontend RTK Query

- [ ] Add `getDbKeywords` builder.query in `frontend-ui/src/store/researchSlice.ts` with the same query-param shape used by `listProducts` (URL: `/api/research/products/keywords/`, method: GET)
- [ ] Provide tag `{ type: 'ResearchKeywords', id: <hash-of-params> }` so a manual invalidation later is feasible (optional but cheap)
- [ ] Export `useGetDbKeywordsQuery` from the slice
- [ ] Add TypeScript response type `DbKeywordsResponse` matching `SearchKeywordResult` shape plus `sample_size` + `cached`

## Phase 5 — Frontend Wiring

- [ ] In `AmazonResearchView.tsx`, call `useGetDbKeywordsQuery(buildQueryParams(), { skip: isLive || !hasSearched })`
- [ ] Combine sources: `keywordResults = isLive ? extendedStatus?.keyword_result : dbKeywordsData`
- [ ] Pass `isLoading` (from the new query when DB mode, or `isPolling` when Live) down to `StatisticsView` as a new `loading` prop
- [ ] In `StatisticsView.tsx`, accept new prop `loading?: boolean`; when `loading && hasSearched`, render a skeleton row (4–6 `Skeleton` rounded chips) instead of the empty state
- [ ] Verify the "No keyword data available" empty state still renders correctly after a successful query that returned empty arrays

## Phase 6 — Frontend Tests

- [ ] Update or add an integration test in `frontend-ui/src/views/amazon/research/tests/AmazonResearchView.test.tsx`:
  - Mocks `getDbKeywords` to return `{ top_focus_keywords: [{keyword: 'shirt', frequency: 12}], top_long_tail_keywords: [], sample_size: 50, cached: false }`
  - Performs a DB-mode search
  - Switches to the Keywords tab
  - Asserts the "shirt" chip is in the DOM
- [ ] Add a separate test for the skeleton loading state (mock the query to return `isLoading: true`) → assert at least one `Skeleton` element under the Keywords tab
- [ ] Confirm Live-mode test path is unchanged

## Phase 7 — Verification

- [ ] `docker compose exec web pytest research_app/` — all green
- [ ] `npm run lint` — 0 new errors
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` (frontend full suite) — 0 regressions
- [ ] Manual smoke test in `npm run dev`: DB search → Keywords tab → chips render; click a chip → triggers a new search for that keyword

## Notes / Out-of-scope

- No schema migration (we reuse existing models only for the Live path; DB path returns the same shape inline)
- No new external services
- No workspace scoping (matches `ProductListView`, which treats `AmazonProduct` as a global catalog)
- Request coalescing (preventing concurrent identical computes) deferred to v2 — TTL keeps it bounded
