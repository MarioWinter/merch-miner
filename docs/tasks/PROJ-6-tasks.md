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

## Phase 1-4: Foundation + Schemas + Graph + API [DONE]

Phases 1-4 are implemented and deployed. See git history for details.

---

## Phase 5: Langfuse Observability [DONE]

- `langfuse>=4.0` in requirements.txt
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` env vars
- `_get_langfuse_handler()` in tasks.py creates CallbackHandler
- Callbacks propagated through `config['callbacks']` to all nodes
- Flush in `finally` block of `run_niche_research()`

---

## Phase 6: sync_to_async Migration [DONE]

- All 5 nodes + finalize_node: Django ORM calls wrapped in `sync_to_async`
- `asgiref.sync.sync_to_async` used for all DB reads/writes in async nodes
- Bind-mount added for `worker-research` in `docker-compose.override.yml`

---

## Phase 7: Resume/Skip + Scraper Filters + Progress

### Task 7.1: Model changes — NicheResearch new fields
- Add `completed_nodes = JSONField(default=list, blank=True)` — node names that completed
- Add `current_node = CharField(max_length=50, blank=True, default='')` — currently running node
- Add `retry_count = PositiveIntegerField(default=0)` — retries on this record
- Add `marketplace = CharField(max_length=20, default='amazon_com')` — marketplace used
- Add `product_type = CharField(max_length=20, default='t_shirt')` — MBA product type filter
- Migration in `niche_research_app`
- **AC:** Fields exist, migration applies cleanly

### Task 7.2: Model changes — Niche retry counter
- Add `research_retry_count = PositiveIntegerField(default=0)` to `Niche` model
- Migration in `niche_app`
- **AC:** Field exists, used for max 3 retries per niche enforcement

### Task 7.3: State reconstruction helpers — `graph/resume.py`
- New module with 5 helper functions that reconstruct LangGraph state dicts from DB:
  - `load_product_asins_from_db(research_id) -> list[str]`
  - `load_vision_analyses_from_db(research_id) -> list[dict]`
  - `load_emotional_analyses_from_db(research_id) -> list[dict]`
  - `load_analysis_result_from_db(research_id) -> dict`
  - `load_keywords_result_from_db(research_id) -> dict`
- Each returns the exact dict format downstream nodes expect in state
- All wrapped in `sync_to_async` for use in async nodes
- **AC:** Helpers return correct state dicts matching what nodes normally produce

### Task 7.4: Node skip guards + progress tracking
- Create `graph/progress.py` — decorator `update_node_progress(node_name)`:
  - On entry: set `current_node = node_name` on NicheResearch
  - On exit (success): append `node_name` to `completed_nodes`, clear `current_node`
  - On exit (error): clear `current_node` (don't append to completed_nodes)
- Add skip guard at top of each node:
  - If `node_name` in `completed_nodes`: reconstruct state from DB via resume.py, return immediately
  - Log "Skipping node X, already completed"
- Apply to all 6 nodes: scrape, vision_analyze, emotional_analyze, niche_profile, keywords, finalize
- **AC:** Nodes skip when already completed, progress tracked in DB

### Task 7.5: API — Resume/retry/force_refresh logic
- New `ResearchTriggerSerializer` with fields:
  - `marketplace` (ChoiceField, default='amazon_com')
  - `product_type` (ChoiceField, choices: t_shirt/hoodie/long_sleeve/sweatshirt/popsocket/tank_top, default='t_shirt')
  - `force_refresh` (BooleanField, default=False)
- Update `NicheResearchView.post()`:
  - No existing run: create new record with marketplace + product_type, enqueue
  - `pending`/`running` exists: 409 (unchanged)
  - `completed` + `force_refresh=False`: return existing run (200)
  - `completed` + `force_refresh=True`: reuse record, delete LLM results (keep NicheResearchProduct), set `completed_nodes=["scrape"]`, reset status=pending, re-enqueue
  - `failed`: check `niche.research_retry_count < 3`, reuse record, increment retry counts, reset status=pending, keep completed_nodes, re-enqueue
  - `failed` + retries >= 3: 400 "Max retries exceeded"
- **AC:** All 5 scenarios handled correctly, retry reuses record, force_refresh re-runs LLM only

### Task 7.6: API — Serializer updates + niche list progress
- Add to `NicheResearchSerializer` + `NicheResearchDetailSerializer`:
  - `completed_nodes`, `current_node`, `total_nodes` (computed=6), `marketplace`, `product_type`, `retry_count`
- Add `research_progress` SerializerMethodField to `NicheSerializer` (niche list):
  ```json
  {
    "completed_nodes": ["scrape", "vision_analyze"],
    "current_node": "emotional_analyze",
    "status": "running",
    "total_nodes": 6
  }
  ```
- Returns `null` if no research run exists
- **AC:** Progress data available in both research detail and niche list responses

### Task 7.7: Task + graph — pass marketplace/product_type
- `tasks.py`: read `marketplace` + `product_type` from NicheResearch record, pass to `compile_and_run()`
- `state.py`: add `product_type: str` to ResearchState
- `workflow.py`: include `product_type` in initial_state
- `scrape.py`: read `product_type` from state → pass as `search_index` to `ScrapeJob.objects.create()` + spider kwargs
- Checkpointer `thread_id`: use `f"{research_id}__attempt_{retry_count}"` to avoid stale checkpoint conflicts on retries
- **AC:** Marketplace + product_type flow from API to scraper, retries use fresh checkpointer thread

### Task 7.8: Frontend — types + API updates
- Add `marketplace`, `product_type`, `force_refresh` to research trigger API call
- Add `ResearchProgress` type: `{ completed_nodes: string[], current_node: string, status: string, total_nodes: number }`
- Add `research_progress: ResearchProgress | null` to Niche type
- Update research response types with new fields
- **AC:** Types match backend response, trigger accepts new params

### Task 7.9: Frontend — research trigger UI with filters
- Marketplace dropdown (amazon_com, amazon_de, amazon_co_uk, amazon_fr, amazon_it, amazon_es)
- Product-type dropdown (6 MBA types, default: T-Shirt)
- Force-refresh toggle (only visible when last research is completed or failed)
- Pass params to trigger API call
- **AC:** User can select marketplace + product type before triggering research

### Task 7.10: Frontend — NicheTable progress column
- Show progress in Status column when `research_status=running`:
  - Mini MUI LinearProgress + "3/6" text + current node name
  - Falls back to normal status chip when not running
- Auto-poll niche list every 10s while any niche has `research_status=running`
- Show completed/failed status chip otherwise
- **AC:** Live progress visible in table, auto-updates every 10s

### Task 7.11: Frontend — NicheDetailDrawer updates
- Show marketplace + product_type of latest research (read-only)
- Show research progress inline if research is running (6-step stepper)
- Show retry button if failed (with retry count / max display)
- **AC:** Drawer shows filter info + live progress + retry option

### Task 7.12: Frontend — ResearchProgress 6-step stepper
- Replace hardcoded 3-step stepper with 6-step MUI Stepper:
  - Scrape → Vision → Emotional → Niche Profile → Keywords → Finalize
- Driven by `completed_nodes` + `current_node` from poll data
- Active step highlighted, completed steps checked, failed step shows error icon
- **AC:** Stepper reflects actual node progress in real-time

---

## Phase 7b: Cancel/Stop Research

### Task 7b.1: Model — cancel support fields
- Add `rq_job_id = CharField(max_length=100, blank=True, default='')` to NicheResearch — stored after enqueue
- Add `cancelled = BooleanField(default=False)` to NicheResearch
- Migration in `niche_research_app`
- **AC:** Fields exist, migration applies cleanly

### Task 7b.2: Backend — save rq_job_id on enqueue
- In `NicheResearchView.post()`: after `queue.enqueue()`, save returned job.id to `research.rq_job_id`
- **AC:** rq_job_id stored on NicheResearch after trigger

### Task 7b.3: Backend — cancel API endpoint
- `POST /api/niches/{id}/research/cancel/` — `NicheResearchCancelView`
- Validates niche exists + user is workspace member
- Finds latest pending/running research for niche
- If none found: 404
- Sets `cancelled=True`, `status=failed`, `error_message="Cancelled by user"`, `completed_at=now()`
- Updates `Niche.research_status = None`
- Cancels RQ job via `rq.cancel_job(rq_job_id, connection=redis)` + `send_stop_job_command`
- Returns 200 with updated NicheResearchSerializer
- Wire URL in `api/urls.py`
- **AC:** Cancel endpoint stops research, updates status, cancels RQ job

### Task 7b.4: Graph — cancel check in progress decorator
- In `update_node_progress` decorator: at node entry, check `NicheResearch.cancelled`
- If `cancelled=True`: raise `CancelledError("Research cancelled by user")`
- This ensures the graph stops at the next node boundary (current LLM call finishes, but next node won't start)
- **AC:** Running research stops at next node after cancel is triggered

### Task 7b.5: Frontend — cancel API + hook
- `researchApi.ts`: add `cancelResearch(nicheId)` — POST to cancel endpoint
- `useNicheResearch.ts`: expose `cancelResearch()` function
- **AC:** Cancel callable from frontend

### Task 7b.6: Frontend — Stop button in UI
- `ResearchTriggerButton.tsx`: when `status === 'pending' || status === 'running'`, show Stop button (red, StopIcon) instead of trigger button
- After cancel: status transitions to failed, retry button appears
- `translation.json`: add "Stop Research" i18n key
- **AC:** Stop button visible during running research, cancels on click

---

## Phase 7c: Deep Drill Button in NicheTable

### Task 7c.1: Clean up 3-dot menu
- Remove old "Deep Drill" MenuItem from NicheTable.tsx Menu (uses stale `aiButton.deepDrillIdle` key)
- Menu keeps only "Archive" (and future actions)
- **AC:** No AI-related entry in 3-dot menu

### Task 7c.2: Add "Deep Drill" column to table
- New narrow column (48px) in NicheTable header between "Ideas" and "Updated"
- Header label: overline "DEEP DRILL" (or AI icon if too wide)
- Add `ai` column key to useColumnWidths if needed
- i18n key: `niches.table.colDeepDrill`
- **AC:** Column visible in table header

### Task 7c.3: Inline AI status button per row
- New cell in NicheRow for the Deep Drill column
- State-driven IconButton:
  - **No research**: AutoAwesome icon (coral subtle), Tooltip "Start Deep Drill"
  - **Running/Pending**: Pulsing CircularProgress (cyan), Tooltip "Deep Drill running…"
  - **Completed**: CheckCircleOutline (success), Tooltip "View Results"
  - **Failed**: ErrorOutline (error), Tooltip "Deep Drill failed — retry"
- Click navigates to `/niches/research?nicheId=...&nicheName=...`
- No direct API call from table — navigation only
- **AC:** Icon reflects research state per niche, clickable

### Task 7c.4: Bulk Deep Drill button (UI prep)
- In the bulk-action toolbar (shown when checkboxes selected): add "Deep Drill" button
- Disabled for now (future: opens dialog with marketplace/product_type selection for batch research)
- AutoAwesome icon + label "Deep Drill (X)"
- **AC:** Bulk button visible when rows selected, disabled, tooltip says "Coming soon"

### Task 7c.5: Translation keys
- `niches.table.colDeepDrill`: "Deep Drill"
- `niches.table.deepDrill.idle`: "Start Deep Drill"
- `niches.table.deepDrill.running`: "Deep Drill running…"
- `niches.table.deepDrill.completed`: "View Results"
- `niches.table.deepDrill.failed`: "Deep Drill failed — retry"
- `niches.table.deepDrill.bulkLabel`: "Deep Drill ({{count}})"
- `niches.table.deepDrill.bulkDisabled`: "Coming soon"
- **AC:** All keys present in translation.json

---

## Phase 8: Testing

### Task 8.1: Resume/skip unit tests
- Test each node's skip guard (results exist → skip, no results → run)
- Test resume.py helpers (correct state dict reconstruction from DB)
- Test progress decorator (completed_nodes updated, current_node set/cleared)
- **AC:** All skip/resume tests pass

### Task 8.2: API retry/force_refresh tests
- Test retry of failed run (reuses record, skips completed nodes, increments retry count)
- Test force_refresh on completed run (clears LLM results, keeps scrape, re-runs LLM)
- Test max retries exceeded (400 response)
- Test completed + no force_refresh (returns existing, no new job)
- Test marketplace + product_type passed correctly
- **AC:** All API scenario tests pass

### Task 8.3: Frontend tests
- Research trigger with filters (marketplace, product_type selection)
- Progress display in NicheTable (polling, progress bar, status transitions)
- 6-step stepper (correct step highlighting from completed_nodes)
- **AC:** All frontend tests pass
