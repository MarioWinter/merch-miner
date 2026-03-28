# PROJ-8: Idea & Slogan Generation (LangGraph) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `idea_app` — Models, LangGraph graphs, API endpoints for idea/slogan management
- **Full LangGraph** (migrated from n8n) — no n8n dependency at runtime
- **2 separate graphs:** Graph 1 (Niche Discovery & Validation) reusable by PROJ-18 Agent; Graph 2 (Slogan Adaptation) runs per approved niche
- **Same pattern as PROJ-6:** `graph/` package, `SloganNodeConfig` (Admin-editable), `progress.py` for resume/skip, `AsyncPostgresSaver`
- **Dedicated `worker-slogan`:** Own queue `slogan` (30min timeout), parallel with `worker-research`
- **Collected Items → Backend:** Redux dispatch triggers RTK mutation → Idea record in DB
- **Extract Slogan:** Vision LLM endpoint in `idea_app`, called from PROJ-7 UI
- **Improve:** Simple LLM call (no graph), synchronous → 3 variants returned

---

## Phase 1: Backend Foundation

- [x] Create `idea_app/` Django app with `__init__.py`, `apps.py`
- [x] Register in `core/settings.py` → `INSTALLED_APPS`
- [x] Create `idea_app/api/` subpackage with `__init__.py`, `views.py`, `serializers.py`, `urls.py`
- [x] Wire into `core/urls.py` under `/api/ideas/` and `/api/niches/{id}/ideas/`
- [x] `SloganNodeConfig` model: `node_name` (unique, choices: analyze_original/discover_niches/validate_products/adapt_slogans/quality_check), `model_name`, `temperature`, `max_tokens`, `system_prompt`, `updated_at`
- [x] `Idea` model: UUID pk, `workspace` FK, `niche` FK (nullable), `adaptation_run` FK (nullable), `source_idea` FK (self, nullable), `source_product_url` URLField, `slogan_text` TextField, `is_manual` BooleanField, `signal_type` (self/other, nullable), `creative_modules_used` JSONField, `emotional_archetype` CharField, `buyer_voice_pattern` TextField, `stylistic_device` CharField, `pattern_used` CharField, `why_it_works` TextField, `market_confidence` (High/Medium/Low, nullable), `status` (pending/approved/rejected/for_review), `was_changed` BooleanField, `change_reason` TextField, `created_by` FK, `created_at`
- [x] `IdeaAdaptationRun` model: UUID pk, `workspace` FK, `source_idea` FK, `target_niche_ids` JSONField, `niche_results` JSONField, `status` (pending/running/completed/failed), `triggered_by` FK, `config_snapshot` JSONField, `completed_nodes` JSONField, `current_node` CharField, `created_at`, `completed_at` (nullable), `error_message` TextField
- [x] Indexes: `(workspace, niche)` on Idea, `(workspace, status)` on IdeaAdaptationRun
- [x] Initial migration
- [x] Admin registration for all 3 models (SloganNodeConfig with editable prompts)
- [x] RQ queue `slogan` in `settings.py → RQ_QUEUES` (30-min timeout)
- [x] `worker-slogan` Docker service in `docker-compose.yml` + bind-mount in `docker-compose.override.yml`

---

## Phase 2: LangGraph Graphs

### Graph 1: Niche Discovery & Validation

- [x] `graph/state.py`: `DiscoveryState` TypedDict — `run_id`, `source_slogan`, `source_niche_profile`, `target_niches`, `original_analysis`, `niche_evaluations`, `validated_products`, `error`
- [x] `graph/schemas.py`: `OriginalAnalysisSchema` — pattern, sentence_structure, formula_pattern, power_words, signal_type, element_count, tone, energy
- [x] `graph/schemas.py`: `NicheEvaluationSchema` — niche_id, niche_name, approval_status (APPROVED/REJECTED), compatibility_score (0-100), signal_conversion (required, direction, strategy), rejection_reason
- [x] `graph/schemas.py`: `ValidatedProductSchema` — quality_gate, slogan, pattern, formula, energy, insider_terms, match_score
- [x] `graph/prompts.py`: Default prompts for analyze_original, discover_niches, validate_products (ported from n8n)
- [x] `graph/llm.py`: `get_slogan_llm(node_name)` — reads `SloganNodeConfig`, falls back to code defaults
- [x] `graph/nodes/analyze_original.py`: Deconstruct source slogan → pattern, formula, signal type, power words
- [x] `graph/nodes/discover_niches.py`: Evaluate each target niche, score ≥75 = APPROVED, determine signal conversion
- [x] `graph/nodes/validate_products.py`: Quality gate (reject <4 words, generic, copyright) → pattern match → compatibility check
- [x] `graph/discovery_graph.py`: StateGraph assembly (3 nodes linear), `AsyncPostgresSaver`, `RetryPolicy(max_attempts=3)`
- [x] Progress tracking: reuse PROJ-6 `progress.py` pattern — `completed_nodes` + `current_node` on `IdeaAdaptationRun`
- [x] Skip guards on each node (resume from last completed on retry)

### Graph 2: Slogan Adaptation (runs per approved niche)

- [x] `graph/state.py`: `AdaptationState` TypedDict — `run_id`, `niche_id`, `original_analysis`, `niche_context`, `validated_products`, `raw_slogans`, `checked_slogans`, `error`
- [x] `graph/schemas.py`: `AdaptedSloganSchema` — slogan_text, creative_modules_used, emotional_archetype, buyer_voice_pattern, stylistic_device, pattern_used, why_it_works, market_confidence, signal_type
- [x] `graph/schemas.py`: `QualityResultSchema` — original_text, corrected_text, was_changed, change_reason
- [x] `graph/prompts.py`: Default prompts for adapt_slogans + quality_check (ported from n8n)
- [x] `graph/nodes/adapt_slogans.py`: Agent with Think Tool — generate 10 slogans (5 SELF + 5 OTHER). Think Tool validates signal, element count, insider terms before output
- [x] `graph/nodes/quality_check.py`: Validate + auto-correct — signal mixing, negative framing, unnatural phrasing. Log changes
- [x] `graph/adaptation_graph.py`: StateGraph assembly (2 nodes), `AsyncPostgresSaver`, `RetryPolicy(max_attempts=3)`
- [x] `Semaphore(5)` for parallel niche adaptation (max 5 niches simultaneously)

---

## Phase 3: Task Runner + Orchestration

- [x] `tasks.py`: `run_idea_adaptation(run_id)` — django-rq job entry point
- [x] Load source idea + NicheAnalysis profiles for source + targets
- [x] Run Graph 1 (Discovery) → get approved niches + original analysis
- [x] For each approved niche: run Graph 2 (Adaptation) → INSERT Idea records
- [x] Update `IdeaAdaptationRun`: `niche_results` JSON per-niche, status=completed/failed
- [x] Update `Niche.research_status` if needed
- [x] Langfuse observability: `CallbackHandler` via `config['callbacks']` (same pattern as PROJ-6)
- [x] Error handling: per-niche failures don't block other niches. Content policy violations → niche marked failed
- [x] `asyncio.run()` wrapper (single entry point, same as PROJ-6)

---

## Phase 4: API Endpoints

### CRUD

- [x] `GET /api/niches/{id}/ideas/` — paginated (20/page), ordered by created_at desc. Workspace-scoped. Includes source + adapted ideas
- [x] `POST /api/niches/{id}/ideas/` — create manual/collected idea. `is_manual=True`, niche from URL param (optional — can be null)
- [x] `PATCH /api/ideas/{id}/` — update status (approved/rejected/for_review), slogan_text, niche, any field
- [x] `DELETE /api/ideas/{id}/` — hard delete. Workspace member or admin only
- [x] `POST /api/ideas/bulk-status/` — body: `{ids: [...], status: "approved"|"rejected"}`. Workspace-scoped

### Adaptation

- [x] `POST /api/ideas/{id}/adapt/` — body: `{target_niche_ids: [...]}`. Validates: source idea has niche (400 if not). Creates `IdeaAdaptationRun` (pending) → enqueues django-rq task. Returns run record. 409 if run already pending/running
- [x] `GET /api/ideas/adaptation-runs/{run_id}/` — returns run with `niche_results`, `status`, `completed_nodes`, `current_node`. Workspace ownership check

### Improve + Regenerate

- [x] `POST /api/ideas/{id}/improve/` — body: `{feedback: "optional text"}`. Single LLM call (not graph). Returns 3 improved variants as new Idea records (`source_idea` = original, status=for_review)
- [x] `POST /api/ideas/{id}/regenerate/` — generates 1 new slogan in same context (niche, signal_type, pattern). Replaces rejected idea (updates existing record)

### Extract + Suggest

- [x] `POST /api/ideas/extract-slogan/` — body: `{product_image_url: "...", product_title: "...", product_brand: "..."}`. Vision LLM extracts slogan text. Returns `{slogan_text: "..."}`. Called from PROJ-7 UI
- [x] `GET /api/ideas/{id}/suggest-niches/` — returns ranked list of compatible target niches. Scores via pattern matching on `NicheAnalysis.pattern_analysis`. Already-adapted niches marked as greyed out

### Serializers

- [x] `IdeaSerializer` — all fields, `source_idea` nested (id + slogan_text), `niche` nested (id + name)
- [x] `IdeaCreateSerializer` — slogan_text required, niche optional, batch mode (newline-separated → multiple ideas)
- [x] `IdeaAdaptationRunSerializer` — nested niche_results, progress fields
- [x] `NicheSuggestionSerializer` — niche id/name, compatibility_score, shared_patterns, already_adapted flag

---

## Phase 5: Frontend — State & Services

- [x] RTK Query `ideaApi` slice (`store/ideaSlice.ts`): listIdeas, createIdea, updateIdea, deleteIdea, bulkUpdateStatus, triggerAdaptation, pollAdaptationRun, improveIdea, regenerateIdea, extractSlogan, suggestNiches
- [x] Cache tags: `providesTags` on list/detail; `invalidatesTags` on mutations
- [x] Register slice in `store/index.ts`
- [x] TypeScript types (`types/index.ts`): Idea, IdeaAdaptationRun, NicheSuggestion, SignalType, MarketConfidence, IdeaStatus
- [x] Zod schema (`schemas/ideaSchema.ts`): slogan_text required, niche optional
- [x] Update `collectedItemsSlice.ts`: `toggleSlogan` dispatches `createIdea` RTK mutation (POST to API). On success: slogan persisted. On failure: rollback Redux state. Keywords stay Redux-only (PROJ-10)
- [x] `useAdaptation` hook: trigger adaptation, poll via RTK Query `pollingInterval: 3000`, auto-stop on terminal state
- [x] `useIdeaActions` hook: approve/reject/improve/regenerate actions, loading states
- [x] `useNicheSuggestions` hook: fetch suggest-niches endpoint, expose auto-select (top 5)

---

## Phase 6: Frontend — UI Components

- [x] `ManualIdeaForm.tsx`: slogan_text TextField (multiline, batch: one per line) + niche Autocomplete (optional). Submit creates 1+ ideas. Supports paste-and-clean
- [x] `IdeaCard.tsx`: slogan text, SignalTypeBadge, MarketConfidenceBadge, pattern chip, actions row (Approve/Reject/Improve/Adapt/Delete). Status chip (pending/approved/rejected/for_review). `was_changed` indicator if Quality Check modified it
- [x] `IdeaSourceGroup.tsx`: Collapsible group — source idea header + adapted children below. Adapted ideas split by SELF/OTHER signal, sorted by market_confidence (High → Low)
- [x] `SignalTypeBadge.tsx`: MUI Chip — SELF (coral) / OTHER (cyan)
- [x] `MarketConfidenceBadge.tsx`: MUI Chip — High (success) / Medium (warning) / Low (text.secondary)
- [x] `AdaptationModal.tsx`: Dialog with niche multi-select (workspace niches). Each niche shows: name, research status chip, NicheAnalysis warning if missing. "Auto-Select Top 5" button. Already-adapted niches greyed out. Confirm triggers adaptation
- [x] `NicheSuggestionList.tsx`: Ranked list inside AdaptationModal — compatibility score bar, shared patterns chips, signal conversion info
- [x] `AdaptationProgress.tsx`: Per-niche status row — niche name + status chip (pending → running → approved/rejected). MUI LinearProgress during run. Rejection reason inline
- [x] `ImproveDialog.tsx`: Dialog with optional feedback TextField + "Improve" button. Shows 3 returned variants as selectable cards. User picks one → replaces/adds
- [x] `SloganHistory.tsx`: Version chain display — Original → Improved v1 → v2. Each entry: slogan text, who/what changed (User/Agent/Quality Check), timestamp
- [x] `EmptyState.tsx`: No ideas for niche — CTA to create manual or run research first
- [x] `IdeaListView.tsx`: Main page assembly — ManualIdeaForm + IdeaSourceGroups + AdaptationModal + Pagination
- [x] "Adapt to All Compatible" button (US-18): calls suggest-niches → filters already-adapted → triggers adaptation for all remaining. Disabled when 0 compatible niches available
- [x] Reject confirmation dialog: when rejecting an idea with an approved design (EC-8), show MUI Dialog warning before proceeding

---

## Phase 7: Frontend — PROJ-6 Integration (Collected Items)

- [x] Update `collectedItemsSlice.ts`: `toggleSlogan(nicheId, sloganText)` → dispatch `useCreateIdeaMutation` from `ideaSlice`
- [x] Update `CollectedItemsSection.tsx` (in NicheDetailDrawer): read from `useListIdeasQuery(nicheId, {is_manual: true})` instead of Redux-only state
- [x] Remove slogan-specific state from `collectedItemsSlice` (keywords stay)
- [x] Update `ProductAnalysisCard.tsx` (PROJ-6 research view): "Collect" click triggers API-backed create
- [x] Success: notistack toast "Slogan saved as idea"
- [x] Error: notistack error toast, no Redux state change

---

## Phase 8: Frontend — PROJ-7 Integration (Extract Slogan)

- [x] Add "Extract Slogan" button to PROJ-7 `ProductCard.tsx` / `ProductDetailPanel.tsx`
- [x] On click: call `POST /api/ideas/extract-slogan/` with product image URL + title + brand
- [x] On success: auto-create Idea record (`is_manual=False`, `source_product_url` set) + notistack success
- [x] Support bulk-select: select multiple products → "Extract Slogans (X)" button → parallel calls
- [x] i18n keys for extract button + success/error messages

> **Note:** US-5 "Analyze Design" (7-Step Gemini Architect) is deferred to PROJ-9. It outputs to the Design Board, which doesn't exist yet. PROJ-8 only builds "Extract Slogan" (US-4).

---

## Phase 9: i18n — Translation Keys

- [x] `ideas.pageTitle`, `ideas.newIdea`, `ideas.batchHint`
- [x] `ideas.status.*` — pending, approved, rejected, for_review
- [x] `ideas.signal.*` — self, other
- [x] `ideas.confidence.*` — high, medium, low
- [x] `ideas.adapt.*` — button label, modal title, auto-select, confirm, progress, no compatible
- [x] `ideas.improve.*` — button label, dialog title, feedback placeholder, variants count
- [x] `ideas.regenerate.*` — button label, confirm
- [x] `ideas.extract.*` — button label, success, error, bulk label
- [x] `ideas.history.*` — title, changed by User/Agent/QualityCheck
- [x] `ideas.empty.*` — no ideas title, hint, CTA
- [x] `ideas.bulk.*` — selected count, approve, reject
- [x] `ideas.niche.*` — no research warning, already adapted, compatibility score
- [x] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 10: Tests

### Backend

- [x] Model tests: Idea creation, niche nullable, adaptation run status transitions
- [x] API tests: CRUD (create, list, update, delete), bulk status, workspace isolation
- [x] Adaptation trigger: 409 on duplicate, 400 without niche, creates run + enqueues job
- [x] Improve endpoint: returns 3 variants, links via source_idea FK
- [x] Regenerate endpoint: updates existing rejected idea
- [x] Extract slogan: returns slogan_text from Vision LLM (mocked)
- [x] Suggest niches: returns ranked list, marks already-adapted
- [x] Serializer tests: nested source_idea, niche_results JSON shape

### Frontend

- [x] IdeaCard: renders all fields, action buttons work, status chip correct
- [x] ManualIdeaForm: validates slogan_text required, batch input creates multiple
- [x] AdaptationModal: multi-select, auto-select top 5, greyed-out adapted niches, warning on no research
- [x] AdaptationProgress: polling, per-niche status updates
- [x] ImproveDialog: feedback input, 3 variants returned, selection works
- [x] CollectedItemsSection: reads from API, not Redux-only
- [x] TypeScript `tsc --noEmit` — 0 errors
- [x] ESLint — 0 errors
- [x] Ruff — 0 errors

---

## Verification Checklist

- [x] `idea_app` registered, migrations applied
- [x] SloganNodeConfig: 5 rows, Admin-editable prompts
- [x] Graph 1 (Discovery): 3 nodes, checkpointer, retry, resume/skip
- [x] Graph 2 (Adaptation): 2 nodes, Think Tool, quality check, 10 slogans per niche
- [x] 11 API endpoints functional + workspace-isolated
- [x] Collected Items persist to DB via API (not Redux-only)
- [x] Extract Slogan endpoint callable from PROJ-7 UI
- [x] Improve returns 3 variants, Regenerate replaces rejected
- [x] Adaptation runs parallel niches with Semaphore(5)
- [x] "Adapt to All Compatible" button works (US-18)
- [x] Reject with approved design shows warning dialog (EC-8)
- [x] Langfuse traces all LLM calls
- [x] worker-slogan runs independently from worker-research
- [x] All tests pass, lint clean
