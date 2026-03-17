# PROJ-6: Niche Deep Research (LangGraph) — Implementation Tasks

## Key Technical Decisions (from architecture review)

- **New Django app:** `niche_research_app` — separate from `niche_app` (Single Responsibility). 7 models, LangGraph workflow, API endpoints.
- **Fully async LangGraph graph:** All nodes `async def`. Graph runs via `graph.ainvoke()`. Single `asyncio.run()` in django-rq task entry-point. Parallel LLM calls use `await asyncio.gather(...)` natively inside async nodes.
- **AsyncPostgresSaver:** Shares Supabase PG. `thread_id = research_id`. Checkpoints after each node. Async because graph runs via `ainvoke()`.
- **ChatOpenAI via OpenRouter:** Model name, temperature, system prompt per node from `ResearchNodeConfig` DB table (Django Admin). Only API key + base URL in env vars.
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

---

## Phase 1: Foundation (Django App + Models + Infra)

### Task 1.1: Create `niche_research_app` Django app
- `python manage.py startapp niche_research_app`
- Register in `INSTALLED_APPS`
- Create directories: `api/`, `graph/`, `graph/nodes/`
- Create empty `tasks.py`, `watchdog.py`
- **AC:** App loads without errors, appears in admin

### Task 1.2: Model — ResearchNodeConfig
- ResearchNodeConfig: AutoField PK, node_name (CharField unique, choices: vision_analyze/emotional_analyze/niche_profile/keywords), model_name (CharField 100), temperature (FloatField default 0.3), max_tokens (IntegerField nullable), system_prompt (TextField), updated_at (auto_now)
- Data migration: seed 4 rows with default values (model: "openai/gpt-4.1-mini", prompts from n8n)
- Admin: list_display = (node_name, model_name, temperature, updated_at), system_prompt shown as large textarea
- **AC:** 4 config rows exist, editable in Django Admin, changes take effect at next research run without restart

### Task 1.3: Models — NicheResearch, NicheResearchProduct
- NicheResearch: UUID PK, niche FK, status choices (pending/running/completed/failed), triggered_by FK(User), config_snapshot (JSONField — snapshot of all 4 ResearchNodeConfig at run start), timestamps, error_message
- NicheResearchProduct: UUID PK, research FK (db_index), product FK(AmazonProduct), unique_together (research, product)
- Migration + migrate
- **AC:** Tables created, config_snapshot captures current config at creation time

### Task 1.4: Models — NicheProductVisionAnalysis, NicheProductEmotionalAnalysis
- NicheProductVisionAnalysis: UUID PK, research FK (db_index), product FK, slogan_text, meaning_context, visual_style, graphic_elements, layout_composition, is_niche_match, created_at
- NicheProductEmotionalAnalysis: UUID PK, research FK (db_index), product FK, original_slogan, customer_psychology (JSON), sentiment_analysis (JSON), emotional_pattern, vibe (JSON), semantic_structure (JSON), key_elements (JSON), tone, adaptation_formula, adaptation_examples (JSON), transferability_notes (JSON), created_at
- Migration + migrate
- **AC:** Tables created, JSON fields accept expected structures

### Task 1.5: Models — NicheAnalysis, NicheKeywordAnalysis
- NicheAnalysis: UUID PK, research FK, niche FK, niche_summary, sentiment, primary_emotions (JSON), emotional_archetype (JSON), example_keywords (JSON), pattern_analysis (JSON — 16 items), emotional_reality, design_concepts, dominant_design_aesthetics, created_at
- NicheKeywordAnalysis: UUID PK, research FK, niche FK, main_short_tail (JSON), main_long_tail (JSON), all_keywords_flat, top_focus_keywords (JSON), top_long_tail_keywords (JSON), created_at
- Migration + migrate
- **AC:** Tables created, admin can view all 7 model tables

### Task 1.6: Admin registration
- Register all 7 models in admin with list_display, list_filter, search_fields
- ResearchNodeConfig: large textarea for system_prompt, readonly updated_at
- NicheResearch: list_display = (niche, status, triggered_by, created_at, completed_at), config_snapshot as readonly JSON viewer
- NicheAnalysis: list_display = (niche, sentiment, created_at)
- **AC:** All models visible and browsable in Django Admin

### Task 1.7: Infrastructure — RQ queue + Docker service + env vars
- Add `research` queue to `RQ_QUEUES` in settings.py (timeout: 1200 = 20 min)
- Add `worker-research` service to docker-compose.yml (command: `python manage.py rqworker research`)
- Add env vars to `.env.dev.template` and `.env.prod.template`: OPENROUTER_API_KEY, OPENROUTER_BASE_URL, SEARXNG_BASE_URL, LANGCHAIN_TRACING_V2 (optional), LANGCHAIN_API_KEY (optional), LANGCHAIN_PROJECT (optional)
- Add Python dependencies to `requirements.txt`: langchain-core, langchain-openai, langchain-community, langgraph, langgraph-checkpoint-postgres
- **AC:** `docker compose up --build` succeeds, `worker-research` service starts, new packages installed

---

## Phase 2: Pydantic Schemas + LLM Prompts (Defaults)

### Task 2.1: Pydantic structured output schemas
- `graph/schemas.py`: Define VisionAnalysisSchema, SloganEmotionalAnalysisSchema (with nested sub-models for customer_psychology, sentiment_analysis, vibe, semantic_structure, transferability_notes), NicheAnalysisSchema (with PatternItem sub-model), NicheKeywordSchema
- 16-pattern enum as Python Enum class (IDENTITY_DECLARATION through SELF_CARE_PRIORITIES)
- All fields with `Field(description=...)` for LLM schema guidance
- **AC:** All schemas importable, `.model_json_schema()` produces valid JSON Schema

### Task 2.2: Default prompts — vision analysis
- `graph/prompts.py`: Port the vision/image analysis prompt from n8n subworkflow as DEFAULT_VISION_PROMPT constant
- Used as fallback if ResearchNodeConfig for vision_analyze has no system_prompt
- Prompt instructs vision LLM to extract slogan_text, meaning_context, visual_style, graphic_elements, layout_composition from t-shirt thumbnail
- Include niche keyword + brand/title context in prompt template
- Niche-match classification instruction
- **AC:** Default prompt renders correctly with sample data

### Task 2.3: Default prompts — emotional analysis
- Port the "SLOGAN EMOTIONAL ANALYSIS & CUSTOMER PSYCHOLOGY SYSTEM" prompt from n8n subworkflow as DEFAULT_EMOTIONAL_PROMPT
- All 8 analysis steps: sentiment recognition, customer embodiment, workplace culture, humor style, emotional pattern (16 patterns listed), vibe, semantic structure, adaptation formula
- Output format instructions aligned with SloganEmotionalAnalysisSchema
- **AC:** Default prompt renders correctly, includes all 16 patterns

### Task 2.4: Default prompts — niche identity extraction
- Port the "NICHE IDENTITY EXTRACTION" prompt from n8n main workflow as DEFAULT_NICHE_PROFILE_PROMPT
- Role definition, mandatory SearXNG tool usage instructions (≥3 queries), analysis steps (context building, identity extraction, data aggregation, archetype mapping)
- Pattern analysis instructions: evidence-based context with specific slogan citations
- Output format aligned with NicheAnalysisSchema
- **AC:** Default prompt renders correctly, references all 16 patterns

### Task 2.5: Default prompts — keyword generation
- DEFAULT_KEYWORDS_PROMPT: receives product titles, niche analysis summary, seed keywords from SearchKeywordResult
- Output format aligned with NicheKeywordSchema
- **AC:** Default prompt renders correctly

### Task 2.6: Seed default prompts into ResearchNodeConfig
- Data migration or management command: `seed_research_config`
- Creates/updates 4 ResearchNodeConfig rows with default prompts from prompts.py
- Idempotent — safe to run multiple times (only creates if not exists)
- **AC:** After migration/command, all 4 config rows have system_prompt filled with n8n-ported defaults

---

## Phase 3: LangGraph Workflow

### Task 3.1: State definition + LLM client factory
- `graph/state.py`: Define `ResearchState(TypedDict)` with all fields: research_id, niche_name, marketplace, product_asins, vision_analyses, emotional_analyses, analysis_result, keywords_result, error
- `graph/llm.py`: LLM client factory function:
  - Reads `ResearchNodeConfig` for the given node_name
  - Creates `ChatOpenAI(model=config.model_name, temperature=config.temperature, base_url=OPENROUTER_BASE_URL, api_key=OPENROUTER_API_KEY)`
  - Returns (llm_instance, system_prompt) tuple
  - Fallback: if no DB config, uses defaults from prompts.py
  - Note: all LLM calls are async — factory returns standard ChatOpenAI (supports both sync and async via `.ainvoke()`)
- **AC:** Factory returns configured LLM + prompt per node, falls back to defaults

### Task 3.2: Node `scrape`
- `graph/nodes/scrape.py`: Calls `scrape_search_page_job(keyword, marketplace)` from scraper_app.tasks
- Updates `NicheResearch.status = running`
- Polls `ProductSearchCache.status` every 5s, max 10 min
- On completion: queries `AmazonProduct` for the keyword, creates `NicheResearchProduct` rows, writes ASINs to state
- On timeout: raises exception (LangGraph retry handles it)
- **AC:** Node successfully triggers scrape, polls completion, returns ASINs

### Task 3.3: Node `vision_analyze` (async)
- `graph/nodes/vision_analyze.py`: `async def` node. Loads products by ASINs from state
- Gets LLM + prompt from factory (`get_llm_for_node("vision_analyze")`)
- Uses `await asyncio.gather(...)` with `asyncio.Semaphore(10)` to call vision LLM for max 10 products in parallel
- Each call: vision LLM with thumbnail URL + title/brand context → VisionAnalysisSchema
- Post-filter: removes is_niche_match=false, empty slogans, slogans ≤2 words (exception: "Squad"/"Crew")
- Saves all results to NicheProductVisionAnalysis table (including filtered-out products for audit)
- Writes only filtered (matching) results to state
- Raises error if 0 products pass filter
- Handles individual thumbnail failures gracefully (skip + log)
- **AC:** Node processes products in parallel, filters correctly, saves to DB

### Task 3.4: Node `emotional_analyze` (async)
- `graph/nodes/emotional_analyze.py`: `async def` node. Reads vision_analyses from state
- Gets LLM + prompt from factory (`get_llm_for_node("emotional_analyze")`)
- Uses `await asyncio.gather(...)` with `asyncio.Semaphore(10)` to call text LLM for max 10 filtered products in parallel
- Each call: text LLM with vision analysis data → SloganEmotionalAnalysisSchema
- Saves all results to NicheProductEmotionalAnalysis table
- Writes aggregated emotional analyses to state
- **AC:** Node processes products in parallel, saves complete emotional analysis per product

### Task 3.5: SearXNG tool wrapper
- `graph/tools.py`: Wraps `SearxSearchWrapper` from langchain-community as a LangChain `@tool`
- Configurable via `SEARXNG_BASE_URL` env var
- Handles connection errors gracefully (returns fallback message instead of raising)
- **AC:** Tool callable, returns search results from SearXNG, handles connection failures

### Task 3.6: Node `niche_profile` (async, sub-graph agent)
- `graph/nodes/niche_profile.py`: `async def` node. Reads emotional_analyses from state
- Gets LLM + prompt from factory (`get_llm_for_node("niche_profile")`)
- Formats all emotional analyses as **structured Markdown** (one section per product: headers, key-value pairs, lists) — not raw JSON
- Uses `langgraph.prebuilt.create_react_agent()` as compiled sub-graph:
  - LLM with SearXNG tool bound
  - System prompt = from ResearchNodeConfig (or fallback default)
  - User message = aggregated emotional analyses as structured Markdown
  - Agent handles LLM → tool → LLM loop automatically
  - If SearXNG fails: agent continues without web data (tool returns fallback message)
- After agent completes: final `llm.with_structured_output(NicheAnalysisSchema)` call with all gathered context (agent output + web search results)
- Saves result to NicheAnalysis table
- **AC:** Node executes web searches via prebuilt agent, produces structured niche analysis, saves to DB

### Task 3.7: Node `keywords`
- `graph/nodes/keywords.py`: Reads analysis_result from state
- Gets LLM + prompt from factory (`get_llm_for_node("keywords")`)
- Loads SearchKeywordResult from scraper_app (if exists for this keyword)
- Calls text LLM with `llm.with_structured_output(NicheKeywordSchema)`
- Saves result to NicheKeywordAnalysis table
- **AC:** Node produces keyword recommendations, saves to DB

### Task 3.8: Graph assembly + finalize node
- `graph/workflow.py`: Assembles StateGraph with all 6 async nodes in linear sequence
  - scrape → vision_analyze → emotional_analyze → niche_profile → keywords → finalize
  - RetryPolicy(max_attempts=3) on vision_analyze, emotional_analyze, niche_profile, keywords
  - No retry on scrape (has own polling logic) or finalize (simple DB update)
- Finalize node (`async def`): sets NicheResearch.status=completed, completed_at=now(), updates Niche.status=deep_research, syncs Niche.research_status + research_run_id
- Compile with `AsyncPostgresSaver` checkpointer
- Error handler: on unrecoverable failure, sets NicheResearch.status=failed with error_message
- **AC:** Graph compiles, can be invoked via `asyncio.run(graph.ainvoke(...))`

---

## Phase 4: django-rq Integration + Watchdog

### Task 4.1: Research task function
- `tasks.py`: `run_niche_research(research_id)` function (sync — called by django-rq)
  - Loads NicheResearch from DB
  - Snapshots all ResearchNodeConfig rows into `config_snapshot` JSONField
  - Defines `async _run()` inner function:
    - Creates `AsyncPostgresSaver` with DB connection string from Django settings
    - Compiles graph with async checkpointer
    - Invokes graph via `await graph.ainvoke(inputs, config={"configurable": {"thread_id": str(research_id)}})`
  - Calls `asyncio.run(_run())` — single entry point from sync to async
  - Wraps in try/except: on failure, sets NicheResearch.status=failed + error_message
- **AC:** Task can be enqueued to `research` queue, runs the full async graph via single asyncio.run()

### Task 4.2: Watchdog scheduled job
- `watchdog.py`: `check_stuck_research()` function
  - Queries `NicheResearch.objects.filter(status='running', created_at__lt=now()-15min)`
  - Sets matching records to status=failed, error_message="Research timed out"
  - Schedule via rq-scheduler (every 5 min) — register in Django management command or app ready()
- **AC:** Watchdog detects and fails stuck runs after 15 min

---

## Phase 5: API Endpoints

### Task 5.1: Serializers
- `api/serializers.py`:
  - NicheResearchSerializer: id, status, created_at, completed_at, error_message
  - NicheResearchDetailSerializer (for latest endpoint): nested analysis, keywords, products (with vision + emotional), related_niches
  - NicheProductSerializer: product data + nested vision_analysis + emotional_analysis
  - NicheAnalysisSerializer: all NicheAnalysis fields
  - NicheKeywordAnalysisSerializer: all NicheKeywordAnalysis fields
  - RelatedNicheSerializer: id, name, shared_patterns (computed)
- **AC:** Serializers produce correct JSON matching API Response Shape in spec

### Task 5.2: Views + URL routing
- `api/views.py`:
  - `POST /api/niches/{id}/research/` — NicheResearchTriggerView
    - Validates niche exists + user is workspace member
    - 409 if pending/running research exists for this niche
    - Creates NicheResearch(status=pending, config_snapshot=current config)
    - Enqueues `run_niche_research` to `research` queue
    - Returns NicheResearchSerializer response
  - `GET /api/niches/{id}/research/latest/` — NicheResearchLatestView
    - Returns latest NicheResearch for niche with nested results
    - related_niches computed server-side: ≥2 shared active patterns in same workspace
  - `GET /api/niches/{id}/research/` — NicheResearchListView
    - Paginated list of all research runs for niche
- `api/urls.py`: Wire to niche app URLs
- Register in core/urls.py
- **AC:** All 3 endpoints respond correctly, workspace scoping enforced, 409 on duplicate

### Task 5.3: Related niches computation
- In NicheResearchDetailSerializer or a queryset manager:
  - Load all NicheAnalysis in same workspace
  - Compare pattern_analysis active patterns (present=true)
  - Return niches with ≥2 shared active patterns (max 5)
- **AC:** related_niches returns correct matches, empty list if none

---

## Phase 6: Frontend

### Task 6.1: API service + polling hook
- `services/researchApi.ts`: triggerResearch(nicheId), getLatestResearch(nicheId), listResearch(nicheId)
- `hooks/useNicheResearch.ts`: polling hook
  - Polls every 5s while status = pending/running
  - 20-min timeout → error state
  - Returns: data, isLoading, isPolling, error, triggerResearch()
- **AC:** Hook triggers research, polls until terminal status, respects timeout

### Task 6.2: Research trigger + progress
- ResearchTriggerButton: "AI Research" button, disabled while pending/running, handles 409
- ResearchProgress: MUI LinearProgress during polling
- Integration into niche detail view
- **AC:** Button triggers research, progress shown during polling, disabled while running

### Task 6.3: Results display — summary + patterns
- NicheSummaryCard: niche_summary, sentiment badge, primary_emotions chips, emotional_archetype, emotional_reality, design_concepts, dominant_design_aesthetics
- PatternCard: single pattern with present/absent state, context text
- PatternGrid: all 16 patterns in responsive grid, active patterns highlighted, inactive collapsed/grayed
- **AC:** Summary card renders all fields, patterns visually distinguished (active vs inactive)

### Task 6.4: Results display — keywords + products + related
- KeywordChips: main_short_tail, main_long_tail, top_focus_keywords, top_long_tail_keywords as MUI Chips
- ProductAnalysisCard: product info (title, brand, ASIN, rating, reviews, thumbnail) + vision analysis (slogan, meaning) + emotional analysis (pattern, vibe, customer psychology)
- RelatedNiches: list of related niches with shared pattern badges, links to niche detail
- **AC:** All data sections render correctly, product cards show vision + emotional analysis

### Task 6.5: Error + retry state
- Error display when status=failed (shows error_message)
- Retry button triggers new POST
- Frontend timeout message (20 min exceeded)
- **AC:** Error states display correctly, retry works

---

## Phase 7: Testing

### Task 7.1: Model + serializer tests
- Unit tests for all 7 models (creation, validation, relationships)
- ResearchNodeConfig: test fallback when no config exists
- Serializer tests (correct JSON output shape, nested serialization)
- Related niches computation test (≥2 shared patterns logic)
- **AC:** All tests pass

### Task 7.2: Node unit tests
- Mock LLM responses for each async node
- Test LLM factory: reads config from DB, falls back to defaults
- Test scrape node polling logic (success, timeout)
- Test vision_analyze async parallel execution + filtering logic + Semaphore(10)
- Test emotional_analyze async parallel execution
- Test niche_profile create_react_agent sub-graph (with/without SearXNG)
- Test keywords node
- Test finalize node status updates
- **AC:** All node tests pass with mocked LLM (use `pytest-asyncio` for async tests)

### Task 7.3: API endpoint tests
- Test POST trigger (success, 409 duplicate, 404 niche, 403 workspace)
- Test config_snapshot captured correctly at trigger time
- Test GET latest (completed, pending, no research)
- Test GET list (pagination)
- Test workspace scoping (can't see other workspace's research)
- **AC:** All API tests pass

### Task 7.4: Integration test — full workflow
- End-to-end test: trigger research → mock scrape completion → mock LLM calls → verify all DB records created → verify API response shape
- Test checkpoint resume: simulate failure at emotional_analyze → verify scrape + vision results preserved → resume completes remaining nodes
- Test config change between runs: change model in Admin → verify new run uses new model
- **AC:** Full workflow test passes, checkpoint resume works

### Task 7.5: Frontend tests
- useNicheResearch hook tests (polling, timeout, error states)
- Component render tests (summary card, pattern grid, keyword chips)
- **AC:** All frontend tests pass
