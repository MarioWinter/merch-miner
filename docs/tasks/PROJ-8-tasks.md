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

- [ ] Create `idea_app/` Django app with `__init__.py`, `apps.py`
- [ ] Register in `core/settings.py` → `INSTALLED_APPS`
- [ ] Create `idea_app/api/` subpackage with `__init__.py`, `views.py`, `serializers.py`, `urls.py`
- [ ] Wire into `core/urls.py` under `/api/ideas/` and `/api/niches/{id}/ideas/`
- [ ] `SloganNodeConfig` model: `node_name` (unique, choices: analyze_original/discover_niches/validate_products/adapt_slogans/quality_check), `model_name`, `temperature`, `max_tokens`, `system_prompt`, `updated_at`
- [ ] `Idea` model: UUID pk, `workspace` FK, `niche` FK (nullable), `adaptation_run` FK (nullable), `source_idea` FK (self, nullable), `source_product_url` URLField, `slogan_text` TextField, `is_manual` BooleanField, `signal_type` (self/other, nullable), `creative_modules_used` JSONField, `emotional_archetype` CharField, `buyer_voice_pattern` TextField, `stylistic_device` CharField, `pattern_used` CharField, `why_it_works` TextField, `market_confidence` (High/Medium/Low, nullable), `status` (pending/approved/rejected/for_review), `was_changed` BooleanField, `change_reason` TextField, `created_by` FK, `created_at`
- [ ] `IdeaAdaptationRun` model: UUID pk, `workspace` FK, `source_idea` FK, `target_niche_ids` JSONField, `niche_results` JSONField, `status` (pending/running/completed/failed), `triggered_by` FK, `config_snapshot` JSONField, `completed_nodes` JSONField, `current_node` CharField, `created_at`, `completed_at` (nullable), `error_message` TextField
- [ ] Indexes: `(workspace, niche)` on Idea, `(workspace, status)` on IdeaAdaptationRun
- [ ] Initial migration
- [ ] Admin registration for all 3 models (SloganNodeConfig with editable prompts)
- [ ] RQ queue `slogan` in `settings.py → RQ_QUEUES` (30-min timeout)
- [ ] `worker-slogan` Docker service in `docker-compose.yml` + bind-mount in `docker-compose.override.yml`

---

## Phase 2: LangGraph Graphs

### Graph 1: Niche Discovery & Validation

- [ ] `graph/state.py`: `DiscoveryState` TypedDict — `run_id`, `source_slogan`, `source_niche_profile`, `target_niches`, `original_analysis`, `niche_evaluations`, `validated_products`, `error`
- [ ] `graph/schemas.py`: `OriginalAnalysisSchema` — pattern, sentence_structure, formula_pattern, power_words, signal_type, element_count, tone, energy
- [ ] `graph/schemas.py`: `NicheEvaluationSchema` — niche_id, niche_name, approval_status (APPROVED/REJECTED), compatibility_score (0-100), signal_conversion (required, direction, strategy), rejection_reason
- [ ] `graph/schemas.py`: `ValidatedProductSchema` — quality_gate, slogan, pattern, formula, energy, insider_terms, match_score
- [ ] `graph/prompts.py`: Default prompts for analyze_original, discover_niches, validate_products (ported from n8n)
- [ ] `graph/llm.py`: `get_slogan_llm(node_name)` — reads `SloganNodeConfig`, falls back to code defaults
- [ ] `graph/nodes/analyze_original.py`: Deconstruct source slogan → pattern, formula, signal type, power words
- [ ] `graph/nodes/discover_niches.py`: Evaluate each target niche, score ≥75 = APPROVED, determine signal conversion
- [ ] `graph/nodes/validate_products.py`: Quality gate (reject <4 words, generic, copyright) → pattern match → compatibility check
- [ ] `graph/discovery_graph.py`: StateGraph assembly (3 nodes linear), `AsyncPostgresSaver`, `RetryPolicy(max_attempts=3)`
- [ ] Progress tracking: reuse PROJ-6 `progress.py` pattern — `completed_nodes` + `current_node` on `IdeaAdaptationRun`
- [ ] Skip guards on each node (resume from last completed on retry)

### Graph 2: Slogan Adaptation (runs per approved niche)

- [ ] `graph/state.py`: `AdaptationState` TypedDict — `run_id`, `niche_id`, `original_analysis`, `niche_context`, `validated_products`, `raw_slogans`, `checked_slogans`, `error`
- [ ] `graph/schemas.py`: `AdaptedSloganSchema` — slogan_text, creative_modules_used, emotional_archetype, buyer_voice_pattern, stylistic_device, pattern_used, why_it_works, market_confidence, signal_type
- [ ] `graph/schemas.py`: `QualityResultSchema` — original_text, corrected_text, was_changed, change_reason
- [ ] `graph/prompts.py`: Default prompts for adapt_slogans + quality_check (ported from n8n)
- [ ] `graph/nodes/adapt_slogans.py`: Agent with Think Tool — generate 10 slogans (5 SELF + 5 OTHER). Think Tool validates signal, element count, insider terms before output
- [ ] `graph/nodes/quality_check.py`: Validate + auto-correct — signal mixing, negative framing, unnatural phrasing. Log changes
- [ ] `graph/adaptation_graph.py`: StateGraph assembly (2 nodes), `AsyncPostgresSaver`, `RetryPolicy(max_attempts=3)`
- [ ] `Semaphore(5)` for parallel niche adaptation (max 5 niches simultaneously)

---

## Phase 3: Task Runner + Orchestration

- [ ] `tasks.py`: `run_idea_adaptation(run_id)` — django-rq job entry point
- [ ] Load source idea + NicheAnalysis profiles for source + targets
- [ ] Run Graph 1 (Discovery) → get approved niches + original analysis
- [ ] For each approved niche: run Graph 2 (Adaptation) → INSERT Idea records
- [ ] Update `IdeaAdaptationRun`: `niche_results` JSON per-niche, status=completed/failed
- [ ] Update `Niche.research_status` if needed
- [ ] Langfuse observability: `CallbackHandler` via `config['callbacks']` (same pattern as PROJ-6)
- [ ] Error handling: per-niche failures don't block other niches. Content policy violations → niche marked failed
- [ ] `asyncio.run()` wrapper (single entry point, same as PROJ-6)

---

## Phase 4: API Endpoints

### CRUD

- [ ] `GET /api/niches/{id}/ideas/` — paginated (20/page), ordered by created_at desc. Workspace-scoped. Includes source + adapted ideas
- [ ] `POST /api/niches/{id}/ideas/` — create manual/collected idea. `is_manual=True`, niche from URL param (optional — can be null)
- [ ] `PATCH /api/ideas/{id}/` — update status (approved/rejected/for_review), slogan_text, niche, any field
- [ ] `DELETE /api/ideas/{id}/` — hard delete. Workspace member or admin only
- [ ] `POST /api/ideas/bulk-status/` — body: `{ids: [...], status: "approved"|"rejected"}`. Workspace-scoped

### Adaptation

- [ ] `POST /api/ideas/{id}/adapt/` — body: `{target_niche_ids: [...]}`. Validates: source idea has niche (400 if not). Creates `IdeaAdaptationRun` (pending) → enqueues django-rq task. Returns run record. 409 if run already pending/running
- [ ] `GET /api/ideas/adaptation-runs/{run_id}/` — returns run with `niche_results`, `status`, `completed_nodes`, `current_node`. Workspace ownership check

### Improve + Regenerate

- [ ] `POST /api/ideas/{id}/improve/` — body: `{feedback: "optional text"}`. Single LLM call (not graph). Returns 3 improved variants as new Idea records (`source_idea` = original, status=for_review)
- [ ] `POST /api/ideas/{id}/regenerate/` — generates 1 new slogan in same context (niche, signal_type, pattern). Replaces rejected idea (updates existing record)

### Extract + Suggest

- [ ] `POST /api/ideas/extract-slogan/` — body: `{product_image_url: "...", product_title: "...", product_brand: "..."}`. Vision LLM extracts slogan text. Returns `{slogan_text: "..."}`. Called from PROJ-7 UI
- [ ] `GET /api/ideas/{id}/suggest-niches/` — returns ranked list of compatible target niches. Scores via pattern matching on `NicheAnalysis.pattern_analysis`. Already-adapted niches marked as greyed out

### Serializers

- [ ] `IdeaSerializer` — all fields, `source_idea` nested (id + slogan_text), `niche` nested (id + name)
- [ ] `IdeaCreateSerializer` — slogan_text required, niche optional, batch mode (newline-separated → multiple ideas)
- [ ] `IdeaAdaptationRunSerializer` — nested niche_results, progress fields
- [ ] `NicheSuggestionSerializer` — niche id/name, compatibility_score, shared_patterns, already_adapted flag

---

## Phase 5: Frontend — State & Services

- [ ] RTK Query `ideaApi` slice (`store/ideaSlice.ts`): listIdeas, createIdea, updateIdea, deleteIdea, bulkUpdateStatus, triggerAdaptation, pollAdaptationRun, improveIdea, regenerateIdea, extractSlogan, suggestNiches
- [ ] Cache tags: `providesTags` on list/detail; `invalidatesTags` on mutations
- [ ] Register slice in `store/index.ts`
- [ ] TypeScript types (`types/index.ts`): Idea, IdeaAdaptationRun, NicheSuggestion, SignalType, MarketConfidence, IdeaStatus
- [ ] Zod schema (`schemas/ideaSchema.ts`): slogan_text required, niche optional
- [ ] Update `collectedItemsSlice.ts`: `toggleSlogan` dispatches `createIdea` RTK mutation (POST to API). On success: slogan persisted. On failure: rollback Redux state. Keywords stay Redux-only (PROJ-10)
- [ ] `useAdaptation` hook: trigger adaptation, poll via RTK Query `pollingInterval: 3000`, auto-stop on terminal state
- [ ] `useIdeaActions` hook: approve/reject/improve/regenerate actions, loading states
- [ ] `useNicheSuggestions` hook: fetch suggest-niches endpoint, expose auto-select (top 5)

---

## Phase 6: Frontend — UI Components

- [ ] `ManualIdeaForm.tsx`: slogan_text TextField (multiline, batch: one per line) + niche Autocomplete (optional). Submit creates 1+ ideas. Supports paste-and-clean
- [ ] `IdeaCard.tsx`: slogan text, SignalTypeBadge, MarketConfidenceBadge, pattern chip, actions row (Approve/Reject/Improve/Adapt/Delete). Status chip (pending/approved/rejected/for_review). `was_changed` indicator if Quality Check modified it
- [ ] `IdeaSourceGroup.tsx`: Collapsible group — source idea header + adapted children below. Adapted ideas split by SELF/OTHER signal, sorted by market_confidence (High → Low)
- [ ] `SignalTypeBadge.tsx`: MUI Chip — SELF (coral) / OTHER (cyan)
- [ ] `MarketConfidenceBadge.tsx`: MUI Chip — High (success) / Medium (warning) / Low (text.secondary)
- [ ] `AdaptationModal.tsx`: Dialog with niche multi-select (workspace niches). Each niche shows: name, research status chip, NicheAnalysis warning if missing. "Auto-Select Top 5" button. Already-adapted niches greyed out. Confirm triggers adaptation
- [ ] `NicheSuggestionList.tsx`: Ranked list inside AdaptationModal — compatibility score bar, shared patterns chips, signal conversion info
- [ ] `AdaptationProgress.tsx`: Per-niche status row — niche name + status chip (pending → running → approved/rejected). MUI LinearProgress during run. Rejection reason inline
- [ ] `ImproveDialog.tsx`: Dialog with optional feedback TextField + "Improve" button. Shows 3 returned variants as selectable cards. User picks one → replaces/adds
- [ ] `SloganHistory.tsx`: Version chain display — Original → Improved v1 → v2. Each entry: slogan text, who/what changed (User/Agent/Quality Check), timestamp
- [ ] `EmptyState.tsx`: No ideas for niche — CTA to create manual or run research first
- [ ] `IdeaListView.tsx`: Main page assembly — ManualIdeaForm + IdeaSourceGroups + AdaptationModal + Pagination
- [ ] "Adapt to All Compatible" button (US-18): calls suggest-niches → filters already-adapted → triggers adaptation for all remaining. Disabled when 0 compatible niches available
- [ ] Reject confirmation dialog: when rejecting an idea with an approved design (EC-8), show MUI Dialog warning before proceeding

---

## Phase 7: Frontend — PROJ-6 Integration (Collected Items)

- [ ] Update `collectedItemsSlice.ts`: `toggleSlogan(nicheId, sloganText)` → dispatch `useCreateIdeaMutation` from `ideaSlice`
- [ ] Update `CollectedItemsSection.tsx` (in NicheDetailDrawer): read from `useListIdeasQuery(nicheId, {is_manual: true})` instead of Redux-only state
- [ ] Remove slogan-specific state from `collectedItemsSlice` (keywords stay)
- [ ] Update `ProductAnalysisCard.tsx` (PROJ-6 research view): "Collect" click triggers API-backed create
- [ ] Success: notistack toast "Slogan saved as idea"
- [ ] Error: notistack error toast, no Redux state change

---

## Phase 8: Frontend — PROJ-7 Integration (Extract Slogan)

- [ ] Add "Extract Slogan" button to PROJ-7 `ProductCard.tsx` / `ProductDetailPanel.tsx`
- [ ] On click: call `POST /api/ideas/extract-slogan/` with product image URL + title + brand
- [ ] On success: auto-create Idea record (`is_manual=False`, `source_product_url` set) + notistack success
- [ ] Support bulk-select: select multiple products → "Extract Slogans (X)" button → parallel calls
- [ ] i18n keys for extract button + success/error messages

> **Note:** US-5 "Analyze Design" (7-Step Gemini Architect) is deferred to PROJ-9. It outputs to the Design Board, which doesn't exist yet. PROJ-8 only builds "Extract Slogan" (US-4).

---

## Phase 9: i18n — Translation Keys

- [ ] `ideas.pageTitle`, `ideas.newIdea`, `ideas.batchHint`
- [ ] `ideas.status.*` — pending, approved, rejected, for_review
- [ ] `ideas.signal.*` — self, other
- [ ] `ideas.confidence.*` — high, medium, low
- [ ] `ideas.adapt.*` — button label, modal title, auto-select, confirm, progress, no compatible
- [ ] `ideas.improve.*` — button label, dialog title, feedback placeholder, variants count
- [ ] `ideas.regenerate.*` — button label, confirm
- [ ] `ideas.extract.*` — button label, success, error, bulk label
- [ ] `ideas.history.*` — title, changed by User/Agent/QualityCheck
- [ ] `ideas.empty.*` — no ideas title, hint, CTA
- [ ] `ideas.bulk.*` — selected count, approve, reject
- [ ] `ideas.niche.*` — no research warning, already adapted, compatibility score
- [ ] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 10: Tests

### Backend

- [ ] Model tests: Idea creation, niche nullable, adaptation run status transitions
- [ ] API tests: CRUD (create, list, update, delete), bulk status, workspace isolation
- [ ] Adaptation trigger: 409 on duplicate, 400 without niche, creates run + enqueues job
- [ ] Improve endpoint: returns 3 variants, links via source_idea FK
- [ ] Regenerate endpoint: updates existing rejected idea
- [ ] Extract slogan: returns slogan_text from Vision LLM (mocked)
- [ ] Suggest niches: returns ranked list, marks already-adapted
- [ ] Serializer tests: nested source_idea, niche_results JSON shape

### Frontend

- [ ] IdeaCard: renders all fields, action buttons work, status chip correct
- [ ] ManualIdeaForm: validates slogan_text required, batch input creates multiple
- [ ] AdaptationModal: multi-select, auto-select top 5, greyed-out adapted niches, warning on no research
- [ ] AdaptationProgress: polling, per-niche status updates
- [ ] ImproveDialog: feedback input, 3 variants returned, selection works
- [ ] CollectedItemsSection: reads from API, not Redux-only
- [ ] TypeScript `tsc --noEmit` — 0 errors
- [ ] ESLint — 0 errors
- [ ] Ruff — 0 errors

---

## Verification Checklist

- [ ] `idea_app` registered, migrations applied
- [ ] SloganNodeConfig: 5 rows, Admin-editable prompts
- [ ] Graph 1 (Discovery): 3 nodes, checkpointer, retry, resume/skip
- [ ] Graph 2 (Adaptation): 2 nodes, Think Tool, quality check, 10 slogans per niche
- [ ] 11 API endpoints functional + workspace-isolated
- [ ] Collected Items persist to DB via API (not Redux-only)
- [ ] Extract Slogan endpoint callable from PROJ-7 UI
- [ ] Improve returns 3 variants, Regenerate replaces rejected
- [ ] Adaptation runs parallel niches with Semaphore(5)
- [ ] "Adapt to All Compatible" button works (US-18)
- [ ] Reject with approved design shows warning dialog (EC-8)
- [ ] Langfuse traces all LLM calls
- [ ] worker-slogan runs independently from worker-research
- [ ] All tests pass, lint clean
