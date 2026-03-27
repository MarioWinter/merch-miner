# PROJ-6: Niche Deep Research (LangGraph) — Implementation Tasks

## Key Technical Decisions (from architecture review)

- **New Django app:** `niche_research_app` — separate from `niche_app` (Single Responsibility). 7 models, LangGraph workflow, API endpoints.
- **Fully async LangGraph graph:** All nodes `async def`. Graph runs via `graph.ainvoke()`. Single `asyncio.run()` in django-rq task entry-point. Parallel LLM calls use `await asyncio.gather(...)` natively inside async nodes. All Django ORM calls wrapped in `sync_to_async`.
- **AsyncPostgresSaver:** Shares Supabase PG. `thread_id = research_id`. Checkpoints after each node. Async because graph runs via `ainvoke()`.
- **ChatOpenAI via OpenRouter:** Model name, temperature, system prompt per node from `ResearchNodeConfig` DB table (Django Admin). Only API key + base URL in env vars. OpenRouter headers (HTTP-Referer, X-OpenRouter-Title) set automatically.
- **Structured output:** `llm.with_structured_output(PydanticModel)` — Pydantic schemas define JSON Schema sent to LLM.
- **Dynamic config via Django Admin:** `ResearchNodeConfig` model — 4 rows (one per LLM node). Model name, temperature, system prompt editable without redeploy. Each NicheResearch stores `config_snapshot` for audit trail.
- **System prompts in DB:** Ported from n8n as initial data. Editable in Admin. Code has fallback defaults.
- **SearXNG:** `SearxSearchWrapper` from langchain-community. Existing instance in localai stack via `SEARXNG_BASE_URL`.
- **`create_react_agent()` in niche_profile node:** LangGraph's prebuilt `create_react_agent()` as sub-graph. Official pattern for tool-using agents. Final `with_structured_output()` call for structured result.
- **RetryPolicy:** `RetryPolicy(max_attempts=3)` on LLM nodes (vision_analyze, emotional_analyze, niche_profile, keywords).
- **New RQ queue `research`:** 20-min timeout. New Docker service `worker-research`.
- **Watchdog:** rq-scheduler (already installed). Scheduled job every 5 min. Detects stuck runs >15 min.
- **LLM input format:** Structured Markdown (not JSON). Product data + emotional analyses formatted with headers, key-value pairs, lists. Token-efficient, proven in n8n workflow.
- **Parallel concurrency limit:** `asyncio.Semaphore(10)` in vision_analyze + emotional_analyze nodes. Prevents OpenRouter rate limit errors on large product sets.
- **Langfuse observability:** CallbackHandler injected via `config['callbacks']` in `compile_and_run()`. Traces all LLM calls, tool calls, latency, token usage. Flush in `finally` block.
- **Resume/Skip strategy:** DB-presence checks at top of each node. If results exist for `research_id`, skip node and reconstruct state from DB. `completed_nodes` JSONField tracks progress.
- **Retry logic:** Max 3 retries per niche (`Niche.research_retry_count`). Reuse same `NicheResearch` record on retry, keep `completed_nodes`, skip completed nodes.
- **Scraper filters:** `marketplace` + `product_type` passed from UI through API → NicheResearch → scrape node → ScrapeJob. Default: `amazon_com` + `t_shirt`. No "all types" option.

---

## Phase 1: Backend Foundation

- [x] Create `niche_research_app/` Django app with `__init__.py`, `apps.py`
- [x] Register in `core/settings.py` → `INSTALLED_APPS`
- [x] Create `niche_research_app/api/` subpackage
- [x] `ResearchNodeConfig` model: `node_name` (unique, choices: vision_analyze/emotional_analyze/niche_profile/keywords), `model_name`, `temperature`, `max_tokens`, `system_prompt`, `updated_at`
- [x] `NicheResearch` model: UUID pk, `niche` FK, `status` (pending/running/completed/failed), `triggered_by` FK, `config_snapshot` JSONField, `created_at`, `completed_at`, `error_message`
- [x] `NicheResearchProduct` model: UUID pk, `research` FK, `product` FK (AmazonProduct)
- [x] `NicheProductVisionAnalysis` model: UUID pk, `research` FK, `product` FK, `slogan_text`, `meaning_context`, `visual_style`, `graphic_elements`, `layout_composition`, `is_niche_match`
- [x] `NicheProductEmotionalAnalysis` model: UUID pk, `research` FK, `product` FK, `original_slogan`, `customer_psychology` JSON, `sentiment_analysis` JSON, `emotional_pattern`, `vibe` JSON, `semantic_structure` JSON, `key_elements` JSON, `tone`, `adaptation_formula`, `adaptation_examples` JSON, `transferability_notes` JSON
- [x] `NicheAnalysis` model: UUID pk, `research` FK, `niche` FK, `niche_summary`, `sentiment`, `primary_emotions` JSON, `emotional_archetype` JSON, `example_keywords` JSON, `pattern_analysis` JSON, `emotional_reality`, `design_concepts`, `dominant_design_aesthetics`
- [x] `NicheKeywordAnalysis` model: UUID pk, `research` FK, `niche` FK, `main_short_tail` JSON, `main_long_tail` JSON, `all_keywords_flat`, `top_focus_keywords` JSON, `top_long_tail_keywords` JSON
- [x] Initial migration `0001_initial.py`
- [x] Admin registration for all 7 models
- [x] RQ queue `research` in `settings.py → RQ_QUEUES` (20-min timeout)
- [x] `worker-research` Docker service in `docker-compose.yml`

---

## Phase 2: Pydantic Schemas + LangGraph State

- [x] `graph/schemas.py`: `VisionAnalysisSchema`, `SloganEmotionalAnalysisSchema`, `NicheAnalysisSchema` (16 patterns), `NicheKeywordSchema`
- [x] `graph/state.py`: `ResearchState` TypedDict (`research_id`, `niche_name`, `marketplace`, `product_asins`, `vision_analyses`, `emotional_analyses`, `analysis_result`, `keywords_result`, `error`)
- [x] `graph/prompts.py`: default system prompts (fallback if no DB config)

---

## Phase 3: LangGraph Graph Nodes

- [x] `graph/nodes/scrape.py`: call `scrape_search_page_job`, poll `ProductSearchCache.status` (max 10 min, 5s interval), write product ASINs to state
- [x] `graph/nodes/vision_analyze.py`: parallel vision LLM per product (`asyncio.gather`), post-filter (niche_match + slogan check), save `NicheProductVisionAnalysis` rows
- [x] `graph/nodes/emotional_analyze.py`: parallel emotional LLM per product (`asyncio.gather`), save `NicheProductEmotionalAnalysis` rows
- [x] `graph/nodes/niche_profile.py`: `create_react_agent()` sub-graph with SearXNG tool, ≥3 searches, evaluates 16 patterns, save `NicheAnalysis`
- [x] `graph/nodes/keywords.py`: structured output with seed keywords from `SearchKeywordResult`, save `NicheKeywordAnalysis`
- [x] `graph/nodes/__init__.py`: finalize node — sets status=completed, updates `Niche.status=deep_research`
- [x] `graph/tools.py`: SearXNG tool wrapper via `SearxSearchWrapper`
- [x] `graph/llm.py`: `get_llm(node_name)` — reads `ResearchNodeConfig` from DB, falls back to code defaults
- [x] `graph/workflow.py`: StateGraph assembly (6 nodes linear), `compile_and_run()` with `AsyncPostgresSaver`
- [x] `RetryPolicy(max_attempts=3)` on LLM nodes
- [x] `asyncio.Semaphore(10)` concurrency limit in vision + emotional nodes

---

## Phase 4: API Endpoints + Task Runner

- [x] `api/serializers.py`: `NicheResearchSerializer`, `NicheResearchDetailSerializer` (nested products + analysis + keywords + related_niches)
- [x] `api/views.py`: `NicheResearchView` — POST trigger (409 on duplicate), GET latest, GET list
- [x] `api/urls.py`: wire to `/api/niches/{id}/research/` and `/api/niches/{id}/research/latest/`
- [x] Include URLs in `core/urls.py`
- [x] `tasks.py`: `run_niche_research()` django-rq job — `asyncio.run(compile_and_run(...))`, error handling, status updates
- [x] `watchdog.py`: scheduled job every 5 min, detects stuck runs >15 min → status=failed
- [x] `related_niches` computed server-side (≥2 shared active patterns in workspace)
- [x] Workspace isolation: `_check_niche_access()` on every view

---

## Phase 5: Langfuse Observability

- [x] `langfuse>=4.0` in `requirements.txt`
- [x] Env vars: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST`
- [x] `_get_langfuse_handler()` in `tasks.py` creates `CallbackHandler`
- [x] Callbacks propagated through `config['callbacks']` to all nodes
- [x] Flush in `finally` block of `run_niche_research()`

---

## Phase 6: sync_to_async Migration

- [x] All 5 nodes + finalize_node: Django ORM calls wrapped in `sync_to_async`
- [x] `asgiref.sync.sync_to_async` used for all DB reads/writes in async nodes
- [x] Bind-mount added for `worker-research` in `docker-compose.override.yml`

---

## Phase 7: Resume/Skip + Scraper Filters + Progress

- [x] `NicheResearch` new fields: `completed_nodes` JSONField, `current_node` CharField, `retry_count`, `marketplace`, `product_type`
- [x] `Niche.research_retry_count` field (max 3 retries enforcement)
- [x] Migration for both models
- [x] `graph/resume.py`: 5 state reconstruction helpers (`load_product_asins_from_db`, `load_vision_analyses_from_db`, `load_emotional_analyses_from_db`, `load_analysis_result_from_db`, `load_keywords_result_from_db`)
- [x] `graph/progress.py`: `update_node_progress(node_name)` decorator — sets `current_node` on entry, appends to `completed_nodes` on success
- [x] Skip guard at top of each node: if `node_name` in `completed_nodes` → reconstruct from DB, return
- [x] `ResearchTriggerSerializer`: `marketplace`, `product_type`, `force_refresh` fields
- [x] API resume/retry logic: 5 scenarios (new/duplicate/completed/force_refresh/failed+retry/max_retries)
- [x] Serializer updates: `completed_nodes`, `current_node`, `total_nodes`, `marketplace`, `product_type`, `retry_count`
- [x] `research_progress` SerializerMethodField on `NicheSerializer` (niche list)
- [x] `product_type` passed through state → scrape node → `ScrapeJob`
- [x] Checkpointer `thread_id`: `f"{research_id}__attempt_{retry_count}"`
- [x] Frontend types: `ResearchProgress`, `research_progress` on Niche, trigger params
- [x] Frontend research trigger: marketplace + product_type dropdowns, force-refresh toggle
- [x] NicheTable progress: mini LinearProgress + "3/6" + current node name when running
- [x] Auto-poll niche list every 10s while any niche has `research_status=running`
- [x] NicheDetailDrawer: marketplace/product_type read-only, progress stepper, retry button
- [x] 6-step MUI Stepper: Scrape → Vision → Emotional → Niche Profile → Keywords → Finalize

---

## Phase 7b: Cancel/Stop Research

- [x] `NicheResearch` new fields: `rq_job_id` CharField, `cancelled` BooleanField
- [x] Migration in `niche_research_app`
- [x] Save `rq_job_id` after `queue.enqueue()` in trigger view
- [x] `POST /api/niches/{id}/research/cancel/` — `NicheResearchCancelView`: sets cancelled=True, status=failed, cancels RQ job
- [x] Cancel check in `update_node_progress` decorator: raises `CancelledError` at node boundary
- [x] Frontend: `cancelResearch(nicheId)` in `researchApi.ts` + `useNicheResearch.ts`
- [x] Stop button in `ResearchTriggerButton.tsx` (red, StopIcon) when running/pending
- [x] i18n: "Stop Research" key

---

## Phase 7c: Deep Drill Button in NicheTable

- [x] Remove old "Deep Drill" MenuItem from 3-dot menu
- [x] `DeepDrillCell.tsx`: new narrow column (48px) — state-driven IconButton per row
- [x] States: idle (AutoAwesome), running (pulsing CircularProgress), completed (CheckCircle), failed (ErrorOutline)
- [x] Click navigates to `/niches/research?nicheId=...&nicheName=...`
- [x] `ResearchProgressCell.tsx`: inline progress display in table
- [x] Bulk Deep Drill button (disabled, "Coming soon" tooltip)
- [x] i18n keys: `niches.table.colDeepDrill`, `deepDrill.idle/running/completed/failed/bulkLabel/bulkDisabled`

---

## Phase 8: Brand Blacklist (Trademark Filter)

- [x] `BrandBlacklist` model in `scraper_app`: `brand_name` (unique, indexed, lowercase)
- [x] Seed migration: ~480 brands from n8n list
- [x] Admin registration with search
- [x] `scraper_app/brand_filter.py`: `get_blacklisted_brands()`, `is_brand_blocked()`, `filter_products_by_brand()`
- [x] Brand filter: substring match (>3 chars), exact match (≤3 chars)
- [x] `NicheResearch.brand_filtered_count` field + migration
- [x] Integrate in `vision_analyze.py`: filter before LLM, save count
- [x] `NicheResearchProduct.brand_blocked` flag + migration
- [x] Flag set at scrape time in `scrape.py`
- [x] Frontend: MUI Alert "X products filtered (trademark brands)" when `brand_filtered_count > 0`
- [x] Frontend: "Trademark" Chip on blocked products

---

## Phase 8b: Scrape Node — DB-First Product Lookup

- [x] DB-first check in `scrape.py`: if `Keyword` + `AmazonProduct` exist → skip scrape, use existing products
- [x] Falls through to existing scrape flow if no products in DB
- [x] `force_refresh` correctly sets `completed_nodes=['scrape']` → scrape node skipped entirely

---

## Phase 9: Testing

- [x] Brand filter unit tests: exact match, substring, empty brand, case insensitive, mixed list split (`scraper_app/tests/test_brand_filter.py` — 24 tests)
- [x] Resume/skip unit tests: skip guards, state reconstruction, progress decorator (`niche_research_app/tests/test_resume.py` — 23 tests)
- [x] API retry/force_refresh tests: all 5 scenarios, marketplace/product_type, brand_filtered_count (`niche_research_app/tests/test_api.py` — 36 tests)
- [x] Model + serializer tests (`niche_research_app/tests/test_models_serializers.py` — 37 tests)
- [x] Frontend tests: patternConfig (14), collectedItemsSlice (11), GroupedProductAnalysis (5), KeywordChips (5), PatternCard (5), PatternGrid (4), ProductAnalysisCard (6), ResearchProgress (3), ResearchTriggerButton (5), useNicheResearch (14), NicheDetailDrawer (9)
- [x] TypeScript `tsc --noEmit` — 0 errors
- [x] ESLint — 0 errors
- [x] Ruff (Python) — 0 errors

---

## Phase 10: Collected Items — Slogan & Keyword Collector

- [x] `store/collectedItemsSlice.ts`: Redux slice with `byNicheId` state
- [x] Actions: `toggleSlogan`, `toggleKeyword`, `removeSlogan`, `removeKeyword`, `clearAll`
- [x] Selectors: `selectCollectedSlogans`, `selectCollectedKeywords`, `selectCollectedCount`
- [x] `ProductAnalysisCard.tsx`: full slogan text, click-to-collect (copy + toggle + snackbar)
- [x] `KeywordChips.tsx`: global store replaces local `useState`, persisted across navigation
- [x] `research/index.tsx`: pass `nicheId` to children
- [x] `CollectedItemsSection.tsx`: drawer section with collected slogans/keywords, remove via X, "Copy All"
- [x] i18n: `niches.drawer.collectedSlogans/collectedKeywords/copyAll`

---

## Phase 11: UI Polish + Pattern-Grouped Products

- [x] `patternConfig.ts`: per-pattern icon + color config for all 16 patterns
- [x] `ProductAnalysisCard.tsx`: pattern Chip uses `getPatternVisual()` instead of generic icon
- [x] `ProductAnalysisCard.styles.ts`: extracted styles (file >250 lines)
- [x] Research view → Drawer back-navigation: `navigate('/niches?openDrawer={nicheId}')` + `NicheListView` reads param
- [x] `GroupedProductAnalysis.tsx`: group products by pattern, sort by count, collapse/expand all
- [x] `PatternProductGroup.tsx`: pattern header bar (left border, icon, label, count, chevron) + collapsible body
- [x] `PatternGrid.tsx` + `PatternCard.tsx`: interactive — product count badge, click-to-scroll to grouped section
- [x] `research/index.tsx`: wired grouped layout, `productCounts` via useMemo

---

## Phase 11b: Drawer Refactoring (extracted components)

- [x] `DrawerSkeleton.tsx`: loading state skeleton for NicheDetailDrawer
- [x] `DrawerCreateForm.tsx`: extracted create form from drawer (name + notes)
- [x] `DrawerEditForm.tsx`: extracted edit form from drawer (all fields)
- [x] `DrawerConfirmDialogs.tsx`: archive confirmation + unsaved changes dialogs
- [x] `DrawerResearchSection.tsx`: AI Research section in drawer (trigger, progress, results summary)

---

## Phase 11c: Global Components

- [x] `components/DataPrismButton/index.tsx`: animated AI action button (cyan/coral animations)
- [x] `components/SonarPulseButton/index.tsx`: concept A (unused, kept for reference)
- [x] `components/MagmaCoreButton/index.tsx`: concept B (unused, kept for reference)

---

## Phase 11d: Research View Additional Components

- [x] `ResearchEmptyState.tsx`: empty state when no research exists
- [x] `ResearchErrorState.tsx`: error state with retry button
- [x] `ResearchProgressStepper.tsx`: 6-step stepper component (reused in drawer + research view)
- [x] `NicheSummaryCard.tsx`: summary card (sentiment, emotions, archetypes, design concepts)
- [x] `RelatedNiches.tsx`: related niches section (≥2 shared patterns)

---

## Phase 12: E2E Tests (Playwright MCP)

- [x] E2E-1: Niche-Liste → Deep Drill Navigation
- [x] E2E-2: Research View — Idle State (DataPrismButton, marketplace/product_type selects)
- [x] E2E-3: Research View — Completed Results (summary, patterns, keywords, grouped products)
- [x] E2E-4: Pattern Click-to-Scroll
- [x] E2E-5: Slogan/Keyword Collect (selected style)
- [x] E2E-6: Double-Click → Drawer Overlay
- [x] E2E-7: Drawer — Collected Items (sections, copy all, remove)
- [x] E2E-8: Thumbnail Hover Preview (280x280)
- [x] E2E-9: Amazon Link (OpenInNew, target="_blank")
- [x] E2E-10: Back-Navigation (→ /niches)
- [x] E2E-11: Responsive Header (sidebar auto-collapse + minWidth:0)
- [x] E2E-12: Drawer from Table (double-click row)

---

## Verification Checklist

- [x] All 7 models created with correct fields and indexes
- [x] LangGraph 6-node workflow: scrape → vision → emotional → niche_profile → keywords → finalize
- [x] AsyncPostgresSaver checkpointing after each node
- [x] Resume/skip on retry (completed_nodes check)
- [x] Cancel stops at next node boundary
- [x] Brand blacklist filters before LLM (saves tokens)
- [x] DB-first product lookup (skips scrape when products exist)
- [x] Dynamic LLM config via Django Admin (ResearchNodeConfig)
- [x] Langfuse observability on all LLM calls
- [x] Frontend: research view with grouped products, pattern grid, keyword chips
- [x] Frontend: collected items in Redux store + drawer section
- [x] Backend: 547 tests pass (120 PROJ-6 specific)
- [x] Frontend: 199 tests pass (81 PROJ-6 specific)
- [x] E2E: 12 Playwright tests pass
- [x] TypeScript + ESLint + Ruff: 0 errors
