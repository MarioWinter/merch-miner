# PROJ-8: Idea & Slogan Generation (LangGraph)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-24

## Overview

Two-phase workflow for generating adapted slogans via **LangGraph** (migrated from n8n):

**Phase 1 — Source slogan creation (two modes):**
- *Manual*: User types slogan text (required) + optionally selects a source niche. Niche is optional on creation but required before adaptation can be triggered.
- *From product research* (PROJ-7 soft-dep): User searches a niche in product research → sees Amazon products → clicks "Save as source slogan" → LLM extracts slogan text from product listing image → source niche auto-set from the search query.

**Phase 2 — Adaptation:** User selects a source slogan (which already carries a niche) → picks 1+ target niches → triggers LangGraph adaptation workflow → evaluates each target niche for compatibility → generates exactly 10 adapted slogans per approved niche (5 SELF-Signal + 5 OTHER-Signal).

**Technology:** LangGraph StateGraph (migrated from n8n). Two reusable graphs:
- **Graph 1: Niche Discovery & Validation** — reusable by PROJ-18 Agent. Nodes: `analyze_original` → `discover_compatible_niches` → `validate_products`.
- **Graph 2: Slogan Adaptation** — runs per approved target niche. Nodes: `adapt_slogans` (with Think Tool) → `quality_check`.

Both graphs: PostgreSQL Checkpointer for resume/fault tolerance, DB-configurable prompts/models (code fallback + DB override via Admin).

**Django App:** `idea_app`

**n8n workflow reference** (template only, not used at runtime): `/n8n-workflow/slogan-generation/`. Full analysis in memory: `reference_n8n_slogan_workflow.md`.

## User Stories

### Source Slogan Creation
1. As a member, I want to manually enter a slogan for a niche, so I can seed the workflow with my own input. Supports copy-paste (auto-cleaned) and batch input (one slogan per line). Niche always linked.
2. As a member, I want the niche to be optional when first creating a slogan but required before adaptation, so I can collect slogans freely and organize later.
3. As a member, I want the system to suggest a matching niche based on slogan text (via Vector DB similarity), so I don't have to search manually when niche data exists.

### Import from Product Research (PROJ-7)
4. *(PROJ-7 dep)* As a member, I want to extract a slogan from a product image via "Extract Slogan" button (single or bulk-select), so I can quickly import source slogans from Amazon research.
5. *(PROJ-7 dep)* As a member, I want to run a separate "Analyze Design" (7-Step Gemini Architect) on a product image, so I get a ready-to-use generation prompt for PROJ-9 Design Board. Output: Copy to Clipboard / Add to Drawer / Send to Design Board.

### Target Niche Selection & Adaptation
6. As a member, I want to select a source slogan and pick target niches to adapt it to, so the workflow generates 10 new slogans per approved niche (5 SELF + 5 OTHER).
7. As a member, I want the system to suggest compatible target niches ranked by Combined Score (Pattern-Match + Vector DB Similarity), so I pick the best candidates first.
8. As a member, I want an "Auto-Select" button that picks the top 5 most compatible target niches automatically, so I can start adaptation with one click.
9. As a member, I want to see which target niches were approved or rejected by the AI, with Compatibility Score (0-100) and Signal Conversion info (e.g. "SELF→OTHER"), so I understand the results.

### Slogan Review & Actions
10. As a member, I want to see adapted slogans grouped by target niche, split into SELF/OTHER signal groups, sorted by Market Confidence (High → Low), so I can efficiently review.
11. As a member, I want to approve or reject individual slogans, with bulk approve/reject via checkboxes, so I can process large batches quickly.
12. As a member, I want an "Improve" button per slogan (same in edit mode and after rejection) that sends the slogan + optional feedback to an LLM and returns 3 improved variants, so I can refine without regenerating everything.
13. As a member, I want a "Regenerate" button per rejected slogan that generates a completely new slogan in the same context, replacing the rejected one.

### Interactive Slogan Development (PROJ-17/19)
14. As a member, I want to hover over a slogan and see a chat-icon that opens the Chat panel with this slogan + niche as preloaded context, so I can brainstorm, web-search, and iterate interactively (like Copilot inline-chat).
15. As a member, I want to use the Agent (PROJ-18) to generate creative slogans using Vector DB context (research data, keywords, similar slogans), so the Agent produces context-rich suggestions.
16. As a member, I want chat-generated slogans to have "Save as Idea" and "Save & Adapt" buttons, so results flow directly into the pipeline.

### Re-trigger & Expand
17. As a member, I want to re-trigger adaptation for a source slogan with different target niches, with already-adapted niches shown as greyed out ("Already adapted"), so I avoid duplicates.
18. As a member, I want an "Adapt to All Compatible" button that finds all not-yet-adapted compatible niches and triggers adaptation for them, so I can expand coverage in one click.

### Tracking & Learning
19. As a member, I want to see which approved slogans led to successful designs/listings, so I can track slogan performance and the Agent learns which patterns work.
20. As a member, I want to see the full history of a slogan (Original → Improved → Improved v2), including who/what made each change (User, Agent, Quality Check), so I have full transparency.
21. As a member, I want to discover the most successful slogans from other niches that use a similar emotional pattern (via Vector DB), so I get cross-niche inspiration.

### UI/UX Notes
- Layout/design for slogan list, grouping, and action placement to be defined with `/frontend-design`. Functional requirements only here — no layout prescriptions.
- "Improve" button is always the same label regardless of context (edit mode, rejected slogan, chat). One consistent action name.

## Acceptance Criteria

### Models

- [ ] AC-1: `IdeaAdaptationRun` model: UUID pk, `source_idea` FK (`Idea`), `target_niche_ids` (JSONField, list of niche UUIDs), `niche_results` (JSONField — per-niche approved/rejected + reason), status choices [pending, running, completed, failed], triggered_by FK (User), created_at, completed_at (nullable), error_message (TextField, blank=True).
- [ ] AC-2: `Idea` model: UUID pk, `niche` FK (nullable — optional on creation, required before adaptation), `adaptation_run` FK (nullable), `source_idea` FK (self, nullable), `source_product_url` URLField, `slogan_text` TextField, `is_manual` BooleanField, `signal_type` choices [self, other] (nullable), `creative_modules_used` JSONField, `emotional_archetype` CharField(100), `buyer_voice_pattern` TextField, `stylistic_device` CharField(100), `pattern_used` CharField(200), `why_it_works` TextField, `market_confidence` choices [High, Medium, Low] (nullable), `status` choices [pending, approved, rejected, for_review], `was_changed` BooleanField, `change_reason` TextField, `created_by` FK, `created_at`.
- [ ] AC-3: Validation: `slogan_text` required on creation. `niche` optional on creation but required before adaptation (`POST /api/ideas/{id}/adapt/` returns 400 "Source idea must have a niche").

### API

- [ ] AC-4: `POST /api/ideas/{id}/adapt/` — body: `{"target_niche_ids": ["uuid1", "uuid2"]}`. Validates source idea has a niche. Creates `IdeaAdaptationRun` (status=pending) → enqueues django-rq task → runs LangGraph workflow. Returns run record. 409 if run already pending/running.
- [ ] AC-5: `GET /api/ideas/adaptation-runs/{run_id}/` — returns `IdeaAdaptationRun` with `niche_results` (per-niche status + reason) and `status`. Used for polling.
- [ ] AC-6: `GET /api/niches/{id}/ideas/` — returns all ideas for a niche (source + adapted), ordered by created_at desc.
- [ ] AC-7: `POST /api/niches/{id}/ideas/` — manual idea creation (is_manual=True, niche auto-set from URL param). Returns 400 if `slogan_text` is missing.
- [ ] AC-8: `PATCH /api/ideas/{id}/` — update status (approved/rejected/for_review) or any field.
- [ ] AC-9: `DELETE /api/ideas/{id}/` — hard delete; workspace member or admin only.

### LangGraph Trigger

- [ ] AC-10: django-rq task runs **Graph 1 (Niche Discovery & Validation)** via `asyncio.run(graph.ainvoke(...))` with `source_slogan`, `source_niche_profile` (from `NicheAnalysis`), `target_niches` (list of niche name + profile pairs). `profile` is `null` when target niche has no `NicheAnalysis` — LLM runs in degraded mode (name only).
- [ ] AC-11: For each APPROVED niche from Graph 1, django-rq task runs **Graph 2 (Slogan Adaptation)**. INSERT into `Idea` table: one row per generated slogan, with niche FK + `source_idea` FK + all schema fields. UPDATE `IdeaAdaptationRun`: status=completed, `niche_results` JSON, `completed_at`.

### Frontend

- [ ] AC-12: Idea card shows "Adapt" button → opens "Select Target Niches" modal (multi-select from workspace niche list).
- [ ] AC-13: After confirm: MUI LinearProgress shown; per-niche status chips update (pending → approved/rejected) as poll results arrive.
- [ ] AC-14: On run completion: approved niches expand to show 10 slogans; rejected niches show reason inline.
- [ ] AC-15: Manual idea form: slogan_text (required) + niche select (optional). Niche required before adaptation, not on creation.
- [ ] AC-16: Idea list groups source ideas separately from adapted ideas. `signal_type` badge shown on each adapted idea.
- [ ] AC-17: When a selected target niche has no `NicheAnalysis` data, show a yellow warning chip next to its name: "No research — degraded quality." User can still proceed.

### Improve, Suggest & Bulk

- [ ] AC-18: `POST /api/ideas/{id}/improve/` — body: `{"feedback": "optional text"}`. Single LLM call returns 3 improved variants as new Idea records (`source_idea` = original, `status=for_review`). "Improve" is the same action in edit mode, after rejection, and from chat.
- [ ] AC-19: `POST /api/ideas/{id}/regenerate/` — generates 1 new slogan in same context (niche, signal_type, pattern). Updates the existing rejected Idea record in-place.
- [ ] AC-20: `GET /api/ideas/{id}/suggest-niches/` — returns ranked list of compatible target niches. Combined Score = Pattern-Match (NicheAnalysis) + Vector DB Similarity (PROJ-15, graceful degradation without). Already-adapted niches marked `already_adapted=true` (greyed in UI). "Auto-Select" button picks top 5.
- [ ] AC-21: `POST /api/ideas/bulk-status/` — body: `{"ids": [...], "status": "approved"|"rejected"}`. Workspace-scoped. Returns count of affected ideas. Rejecting an idea with an approved design shows warning + requires confirmation (frontend).
- [ ] AC-22: `POST /api/ideas/extract-slogan/` — body: `{"product_image_url": "...", "product_title": "...", "product_brand": "..."}`. Vision LLM extracts slogan text from product image. Returns `{"slogan_text": "..."}`. Called from PROJ-7 Product Card UI.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/niches/{id}/ideas/` | Member | List all ideas for niche (source + adapted) |
| POST | `/api/niches/{id}/ideas/` | Member | Create manual/collected idea |
| PATCH | `/api/ideas/{id}/` | Member | Update idea (status, fields) |
| DELETE | `/api/ideas/{id}/` | Member/Admin | Hard delete |
| POST | `/api/ideas/{id}/adapt/` | Member | Trigger adaptation run (body: target_niche_ids) |
| GET | `/api/ideas/adaptation-runs/{run_id}/` | Member | Poll run status + niche_results |
| POST | `/api/ideas/{id}/improve/` | Member | Improve slogan (body: feedback) → 3 variants |
| POST | `/api/ideas/{id}/regenerate/` | Member | Generate new slogan replacing rejected one |
| POST | `/api/ideas/extract-slogan/` | Member | Extract slogan from product image (Vision LLM) |
| GET | `/api/ideas/{id}/suggest-niches/` | Member | Suggest compatible target niches (ranked) |
| POST | `/api/ideas/bulk-status/` | Member | Bulk approve/reject |

## LangGraph Architecture

### Graph 1: Niche Discovery & Validation (reusable)

```
django-rq worker (queue: slogan)
  └── run_niche_discovery_graph(run_id, source_slogan, source_niche, target_niche_ids)
        └── LangGraph StateGraph (thread_id = run_id)
              ├── Node: analyze_original
              │     ├── LLM: extract pattern, sentence structure, formula, signal type, power words
              │     └── Output: OriginalSloganAnalysis to state
              ├── Node: discover_compatible_niches
              │     ├── LLM (mistral-medium-3.1 default): evaluate each target niche
              │     ├── Score ≥75 = APPROVED, <75 = REJECTED
              │     ├── Determine signal conversion (SELF↔OTHER) per niche
              │     └── Output: per-niche approval + conversion strategy
              ├── Node: validate_products
              │     ├── LLM (mistral-small default): validate scraped products as references
              │     ├── Quality Gate → Pattern Match → Compatibility Check
              │     └── Output: validated reference products per approved niche
              └── PostgreSQL Checkpointer (resume on failure)
```

**Reusable by:** PROJ-18 Agent (Ideation Agent `suggest_target_niches` tool), manual UI trigger.

### Graph 2: Slogan Adaptation (per approved niche)

```
django-rq worker (queue: slogan)
  └── run_slogan_adaptation_graph(run_id, niche_id, original_analysis, niche_context, validated_products)
        └── LangGraph StateGraph (thread_id = run_id__niche_id)
              ├── Node: adapt_slogans (Agent with Think Tool)
              │     ├── Think Tool: validate signal, element count, insider terms before output
              │     ├── LLM (mistral-small-creative default): generate 10 slogans
              │     ├── 5 SELF-Signal + 5 OTHER-Signal (both perspectives)
              │     └── Output: 10 raw slogans to state
              ├── Node: quality_check
              │     ├── LLM (separate model, configurable): validate + correct
              │     ├── Check: signal mixing, negative framing, unnatural phrasing
              │     ├── Auto-correct issues, log changes
              │     └── Output: 10 corrected slogans → INSERT into Idea table
              └── PostgreSQL Checkpointer
```

### Node Configuration (DB + Code Fallback)

Like PROJ-6 `ResearchNodeConfig` pattern — `SloganNodeConfig` model:

| Node | Default Model | Temperature | Think Tool |
|------|--------------|-------------|------------|
| analyze_original | workspace default | 0.2 | No |
| discover_compatible_niches | mistralai/mistral-medium-3.1 | 0.3 | No |
| validate_products | mistralai/mistral-small-3.2-24b-instruct | 0.2 | No |
| adapt_slogans | mistralai/mistral-small-creative | 0.8 | Yes |
| quality_check | workspace default | 0.1 | No |

System prompts stored in DB, editable via Admin. Code contains fallback defaults (ported from n8n workflow).

### AI Models (all via OpenRouter)

| Node | Model | Purpose |
|------|-------|---------|
| analyze_original | configurable | Deconstruct slogan: pattern, formula, signal type |
| discover_compatible_niches | mistral-medium-3.1 | Niche compatibility scoring (≥75 = APPROVED) |
| validate_products | mistral-small-3.2-24b | Reference product quality gate |
| adapt_slogans | mistral-small-creative | Creative slogan generation (10 per niche: 5 SELF + 5 OTHER) |
| quality_check | configurable | Post-generation validation + auto-correction |

### Output Schema (per slogan, saved to Idea table)

```json
{
  "slogan_text": "string",
  "creative_modules_used": ["string"],
  "emotional_archetype": "Fighter | Jester | Rebel | Sage",
  "buyer_voice_pattern": "string",
  "stylistic_device": "string",
  "pattern_used": "string",
  "why_it_works": "string",
  "market_confidence": "High | Medium | Low",
  "signal_type": "SELF | OTHER"
}
```

## Edge Cases

1. LangGraph rejects ALL target niches (all incompatible) → run completes with status=completed, 0 new ideas created; rejection reasons surfaced per-niche in UI.
2. Source slogan has no niche → `POST /api/ideas/{id}/adapt/` returns 400 "Source idea must have a niche."
3. Target niche has no `NicheAnalysis` data → degraded mode warning chip shown in target selector; `profile: null` sent in payload; adaptation runs name-only mode.
4. LLM provider unavailable → node retried up to 2 times; after all retries, run status=failed; "Retry" button shown.
5. Content policy violation in slogan generation → niche marked as failed in `niche_results`; other niches proceed normally.
6. Duplicate slogan_text within same niche → allow (LLM may generate near-duplicates; user approves/rejects).
7. Approving an idea that already has a design → allow (designs persist).
8. Rejecting an idea with an approved design → warn user; require confirmation.
9. Quality Check corrects a slogan → both original and corrected version stored; `was_changed` + `change_reason` logged on Idea.
10. Worker crashes mid-adaptation → Checkpointer resumes from last completed node on retry.

## Dependencies

- **PROJ-5** (Niche List) — required; source niche must exist
- **PROJ-6** (Niche Deep Research) — required for full quality; payload includes `NicheAnalysis` profiles for source + target niches
- **PROJ-7** (Amazon Product Research) — soft dependency; enables "import from product research" source slogan mode

## Amendments (PROJ-15/18/19 Harmonization)

### Vector DB Integration (PROJ-15)
- `Idea` model is an embeddable source. `get_embedding_text()` returns `slogan_text + " " + why_it_works`.
- `post_save` signal on Idea enqueues embedding job.
- `GET /api/ideas/{id}/similar/` convenience endpoint (PROJ-15) — finds similar slogans across all niches.
- Slogan patterns + approval/rejection history stored as embeddings → Agent implicit learning (PROJ-18 Layer 3).

### Web Search as Slogan Inspiration (PROJ-17)
- Vane (PROJ-17) can be used as inspiration source for slogan creation. Flow: User/Agent searches "trending [niche] slogans" → Vane returns synthesized trends + sources → results inform the adaptation engine's context.
- Search Agent can feed web research findings into the Ideation Agent's context via Vector DB — cross-agent knowledge sharing.

### Agent Integration (PROJ-18)
- Ideation Agent has tools: `create_manual_idea`, `trigger_slogan_adaptation`, `read_adaptation_results`, `approve_reject_idea`, `suggest_target_niches`.
- `suggest_target_niches`: Agent uses PROJ-15 Vector DB semantic search on `NicheAnalysis` embeddings to find niches with similar emotional patterns/themes. Returns ranked list of compatible target niches for adaptation — smarter than manual selection.
- Agent can create source slogans, trigger adaptation for target niches, and approve/reject results.
- Agent permission defaults: `create_manual_idea` = Notify, `trigger_slogan_adaptation` = Approve (LLM costs), `approve_reject_idea` = Notify, `suggest_target_niches` = Auto.

### n8n Workflow Reference
- Full workflow analysis documented in memory: `reference_n8n_slogan_workflow.md`
- **3-workflow pipeline:** Orchestrator → SubWorkflow (Niche Discovery + Product Validation) → SloganCreate
- **5 LLM Nodes:**
  1. **Niche Discovery** (mistral-medium-3.1) — evaluates if target niche can authentically adopt slogan (score >=75 = APPROVED)
  2. **Product Reference Validation** (mistral-small-3.2-24b) — validates scraped products as adaptation references (quality gate + pattern match + compatibility)
  3. **Original Slogan Analysis** — deconstructs slogan into formula pattern, sentence structure, signal type (SELF/OTHER), power words
  4. **Adaptation Engine** (mistral-small-creative) — generates 10 adapted slogans per niche (5 SELF + 5 OTHER) using Think tool for pre-validation
  5. **Quality Check** — post-generation validation: signal purity, authenticity, natural phrasing. Corrects issues automatically.
- **Key concepts to preserve in migration:**
  - 16 Emotional Patterns (same as PROJ-6)
  - Signal Types: SELF (declarative "I am X") vs OTHER (instructional "You should Y")
  - Signal Conversion (OTHER↔SELF) with explicit transformation strategy
  - Formula Pattern preservation ([BRACKETS]=variables, CAPS=constants)
  - Think Tool pattern for structured reasoning before output
  - Quality Gate as mandatory post-processing step
- **Migration:** Google Sheets reads → `NicheAnalysis` DB table. Google Sheets + Trello writes → `Idea` table + `IdeaAdaptationRun`.

## Environment Variables Required

```
# Existing (shared with PROJ-6):
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

> **Model names, temperatures, and system prompts are NOT in env vars.** They are stored in the `SloganNodeConfig` DB table (like PROJ-6 `ResearchNodeConfig`). Only secrets stay in env.

## Infrastructure

- New django-rq queue: `slogan` with 30-minute timeout
- New Docker service: `worker-slogan` processing the `slogan` queue (dedicated, not shared with `worker-research`)
- PostgreSQL Checkpointer shared with PROJ-6

Document both in `django-app/env/.env.template`.

## Resolved Questions

1. ~~n8n webhook URL?~~ → **Full LangGraph migration**, no n8n. AC 10-11 updated.
2. ~~Import from product research?~~ → **PROJ-8 builds "Extract Slogan" backend** (`POST /api/ideas/extract-slogan/`). PROJ-7 adds UI button that calls this endpoint.
3. ~~OTHER signal hidden from design board?~~ → Open for PROJ-9 to decide. No filtering in PROJ-8.

---

## Tech Design (Solution Architect)

> Decided: 2026-03-27 | Approved by user.

### A) Backend Architecture

**New Django app:** `idea_app`

```
idea_app/
├── models.py                           # SloganNodeConfig, Idea, IdeaAdaptationRun
├── api/
│   ├── views.py                        # CRUD + adapt + improve + extract + suggest
│   ├── serializers.py                  # All serializers
│   └── urls.py                         # URL routing
├── graph/
│   ├── state.py                        # DiscoveryState, AdaptationState TypedDicts
│   ├── schemas.py                      # Pydantic: OriginalAnalysis, NicheEvaluation,
│   │                                   #   AdaptedSlogan, QualityResult
│   ├── prompts.py                      # Default prompts (ported from n8n)
│   ├── llm.py                          # get_llm(node_name) — reads SloganNodeConfig
│   ├── nodes/
│   │   ├── analyze_original.py         # Deconstruct source slogan
│   │   ├── discover_niches.py          # Evaluate target niche compatibility (≥75)
│   │   ├── validate_products.py        # Quality gate on reference products
│   │   ├── adapt_slogans.py            # Agent + Think Tool, 10 slogans per niche
│   │   └── quality_check.py            # Post-validation + auto-correction
│   ├── discovery_graph.py              # Graph 1: analyze → discover → validate
│   └── adaptation_graph.py             # Graph 2: adapt → quality_check (per niche)
├── tasks.py                            # django-rq jobs (queue: slogan)
├── admin.py
└── tests/
    ├── test_models.py
    ├── test_api.py
    └── test_graphs.py
```

**Registered in:** `core/settings.py` INSTALLED_APPS, `core/urls.py`

---

### B) Frontend Architecture

**Route:** `/niches/{id}/ideas` — niche-scoped idea list. Also accessible via NicheDetailDrawer "Ideas" tab

```
views/ideas/
├── IdeaListView.tsx                    # Main ideas page (per niche context)
├── hooks/
│   ├── useAdaptation.ts                # Trigger + poll adaptation runs
│   ├── useIdeaActions.ts               # Approve/reject/improve/regenerate
│   └── useNicheSuggestions.ts          # Fetch compatible target niches
├── partials/
│   ├── ManualIdeaForm.tsx              # Create: slogan_text + niche (batch input)
│   ├── IdeaCard.tsx                    # Single idea with actions
│   ├── IdeaSourceGroup.tsx             # Source + adapted children grouped
│   ├── SignalTypeBadge.tsx             # SELF / OTHER badge
│   ├── MarketConfidenceBadge.tsx       # High / Medium / Low
│   ├── AdaptationModal.tsx             # Target niche multi-select + Auto-Select
│   ├── NicheSuggestionList.tsx         # Ranked compatible niches with scores
│   ├── AdaptationProgress.tsx          # Per-niche status during run
│   ├── ImproveDialog.tsx               # Improve with feedback → 3 variants
│   ├── SloganHistory.tsx               # Version chain (Original → v2 → v3)
│   └── EmptyState.tsx
├── types/
│   └── index.ts
├── schemas/
│   └── ideaSchema.ts                   # Zod: slogan_text required
└── tests/

store/
├── ideaSlice.ts                        # RTK Query: CRUD + adapt + improve + extract
└── collectedItemsSlice.ts              # UPDATE: dispatch createIdea mutation on collect
```

---

### C) LangGraph Flow

```
User triggers adaptation (source slogan + target niches)
  │
  ├── Graph 1: Niche Discovery & Validation (reusable by PROJ-18)
  │     ├── analyze_original        → extract pattern, formula, signal type
  │     ├── discover_niches         → score each target (≥75 = APPROVED)
  │     └── validate_products       → quality gate on reference products
  │
  └── For each APPROVED niche:
        └── Graph 2: Slogan Adaptation
              ├── adapt_slogans     → Agent + Think Tool → 10 slogans (5 SELF + 5 OTHER)
              └── quality_check     → validate + auto-correct → INSERT Idea records
```

Both graphs: `AsyncPostgresSaver` (shared with PROJ-6), `RetryPolicy(max_attempts=3)` on LLM nodes, `Semaphore(5)` for parallel niche adaptation.

---

### D) Collected Items → Backend Persistence

Current state (PROJ-6): User clicks "Collect" → Redux only (lost on refresh).

New flow (PROJ-8):
1. User clicks "Collect" on slogan in PROJ-6 research view
2. Redux `collectedItemsSlice` dispatches `createIdea` RTK mutation (`POST /api/niches/{id}/ideas/`)
3. Idea record created in DB (`is_manual=True`, `status=pending`)
4. Drawer "Collected" section reads from API (RTK Query cache), not Redux-only
5. Keywords stay Redux-only (persist to Keyword Bank in PROJ-10)

---

### E) Tech Decisions

| Decision | Why |
|----------|-----|
| Dedicated `worker-slogan` (queue: `slogan`, 30min) | Research + Slogan parallel, kein Blocking |
| 2 separate LangGraph Graphs | Graph 1 wiederverwendbar für PROJ-18 Agent. Graph 2 läuft N-mal pro approved Niche |
| Same pattern wie PROJ-6 (`graph/`, `SloganNodeConfig`, `progress.py`) | Konsistenz, bewährtes Resume/Skip, Admin-editable Prompts |
| Think Tool als LangGraph Tool | Strukturiertes Reasoning vor Output — Signal, Element Count, Insider Terms validiert |
| `Idea.niche` nullable | Flexibilität: Collected/Imported Ideas ohne Niche erstellen, zuordnen vor Adaptation |
| Collected Items → Redux + sofort API dispatch | Sofortiges UI Feedback + persistent in DB. Kein Datenverlust bei Refresh |
| Extract Slogan in `idea_app` | Logisch Ideas-Scope. PROJ-7 UI ruft `POST /api/ideas/extract-slogan/` auf |
| Improve = einfacher LLM Call (kein Graph) | Synchron, kein State-Management nötig — Slogan + Feedback rein, 3 Varianten raus |

---

### F) Infrastructure Changes

| Change | Where |
|--------|-------|
| New RQ queue `slogan` (30min timeout) | `settings.py → RQ_QUEUES` |
| New Docker service `worker-slogan` | `docker-compose.yml` + `docker-compose.override.yml` |
| `idea_app` registered | `INSTALLED_APPS` + `core/urls.py` |

---

### G) Dependencies

No new packages — `langchain-core`, `langchain-openai`, `langgraph`, `langgraph-checkpoint-postgres` already installed (PROJ-6).

---

## Verification Steps

1. Create manual idea (no niche) → Idea saved, niche=null, status=pending
2. Create manual idea (with niche) → Idea saved, niche FK set
3. Batch create (3 slogans, newline-separated) → 3 Idea records created
4. `POST /api/ideas/{id}/adapt/` without niche → 400 "Source idea must have a niche"
5. `POST /api/ideas/{id}/adapt/` with niche + 3 targets → IdeaAdaptationRun created, status=pending, job enqueued
6. Poll adaptation run → status transitions: pending → running → completed. `niche_results` shows per-niche approved/rejected + score
7. Approved niche: 10 new Idea records (5 SELF + 5 OTHER), each linked via `source_idea` + `adaptation_run`
8. Rejected niche: reason in `niche_results`, 0 ideas created
9. All niches rejected: run completes with status=completed, 0 total ideas
10. `POST /api/ideas/{id}/improve/` → 3 new Idea records (status=for_review, source_idea=original)
11. `POST /api/ideas/{id}/regenerate/` → existing rejected Idea updated in-place with new slogan
12. `POST /api/ideas/extract-slogan/` with product image → returns `{slogan_text: "..."}`
13. `GET /api/ideas/{id}/suggest-niches/` → ranked list, already-adapted marked
14. `POST /api/ideas/bulk-status/` with 5 IDs → 200 with `{updated: 5}`
15. Collect slogan in PROJ-6 research view → Idea record created in DB, visible in drawer
16. Target niche without NicheAnalysis → warning chip shown, adaptation runs in degraded mode
17. Worker crash mid-adaptation → retry resumes from last completed node (checkpointer)
18. Workspace isolation: ideas from other workspaces → 403
