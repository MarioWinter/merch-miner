# PROJ-8: Idea & Slogan Generation (LangGraph)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-24

## Overview

Two-phase workflow for generating adapted slogans via **LangGraph** (migrated from n8n):

**Phase 1 — Source slogan creation (two modes):**
- *Manual*: User types slogan text + MUST select a source niche. Both fields required; neither alone is valid.
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

1. **`IdeaAdaptationRun`** model: UUID pk, `source_idea` FK (`Idea`), `target_niche_ids` (JSONField, list of niche UUIDs), `niche_results` (JSONField — per-niche approved/rejected + reason, populated by n8n), status choices [pending, running, completed, failed], triggered_by FK (User), created_at, completed_at (nullable), error_message (TextField, blank=True).

2. **`Idea`** model (full field list):
   - UUID pk
   - `niche` FK (nullable — optional on creation, required before adaptation. System suggests niche via Vector DB similarity when data available.)
   - `adaptation_run` FK (`IdeaAdaptationRun`, nullable — null for manual/source ideas)
   - `source_idea` FK (self, nullable — links adapted ideas to their source)
   - `source_product_url` (URLField, blank=True — set when imported via PROJ-7 flow)
   - `slogan_text` (TextField)
   - `is_manual` (BooleanField, default=False)
   - `signal_type` choices [self, other] (nullable for manual ideas)
   - `creative_modules_used` (JSONField, default=list)
   - `emotional_archetype` (CharField, max 100, blank=True)
   - `buyer_voice_pattern` (TextField, blank=True)
   - `stylistic_device` (CharField, max 100, blank=True)
   - `pattern_used` (CharField, max 200, blank=True)
   - `why_it_works` (TextField, blank=True)
   - `market_confidence` choices [High, Medium, Low], nullable
   - `status` choices [pending, approved, rejected, for_review]
   - `created_at`

3. Validation: `slogan_text` + `niche` are BOTH required before an adaptation run can be triggered. Saving a manual idea without `niche` returns 400.

### API

4. `POST /api/ideas/{id}/adapt/` — body: `{"target_niche_ids": ["uuid1", "uuid2"]}`. Validates source idea has a niche. Creates `IdeaAdaptationRun` (status=pending) → enqueues django-rq task → task POSTs to n8n webhook. Returns run record.

5. `GET /api/ideas/adaptation-runs/{run_id}/` — returns `IdeaAdaptationRun` with `niche_results` (per-niche status + reason) and `status`. Used for polling.

6. `GET /api/niches/{id}/ideas/` — returns all ideas for a niche (source + adapted), ordered by created_at desc.

7. `POST /api/niches/{id}/ideas/` — manual idea creation (is_manual=True, niche auto-set from URL param). Returns 400 if `slogan_text` is missing.

8. `PATCH /api/ideas/{id}/` — update status (approved/rejected/for_review) or any field.

9. `DELETE /api/ideas/{id}/` — hard delete; workspace member or admin only.

### n8n Trigger

10. Django → n8n: django-rq task POSTs to `N8N_SLOGAN_ADAPTATION_WEBHOOK_URL` with:
    ```json
    {
      "run_id": "uuid",
      "original_niche": "niche_name",
      "original_slogan": "slogan_text",
      "original_niche_profile": { "...NicheAnalysis fields..." },
      "target_niches": [
        { "name": "niche_name", "profile": { "...NicheAnalysis fields..." } }
      ]
    }
    ```
    `profile` is `null` when target niche has no `NicheAnalysis` — n8n runs in degraded mode (name only).

11. n8n (after migration) → Supabase PG:
    - INSERT into `Idea` table: one row per approved slogan, with niche FK + `source_idea` FK + all schema fields.
    - UPDATE `IdeaAdaptationRun`: status=completed, `niche_results` JSON, `completed_at`.

### Frontend

12. Idea card shows "Adapt" button → opens "Select Target Niches" modal (multi-select from workspace niche list).
13. After confirm: MUI LinearProgress shown; per-niche status chips update (pending → approved/rejected) as poll results arrive.
14. On run completion: approved niches expand to show 10 slogans; rejected niches show reason inline.
15. Manual idea form: slogan_text (required) + niche select (required). Submit disabled unless both filled.
16. Idea list groups source ideas separately from adapted ideas. `signal_type` badge shown on each adapted idea.
17. When a selected target niche has no `NicheAnalysis` data, show a yellow warning chip next to its name: "No research — degraded quality." User can still proceed.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/ideas/{id}/adapt/` | Member | Trigger adaptation run |
| GET | `/api/ideas/adaptation-runs/{run_id}/` | Member | Poll run status |
| GET | `/api/niches/{id}/ideas/` | Member | List all ideas for niche |
| POST | `/api/niches/{id}/ideas/` | Member | Create manual source idea |
| PATCH | `/api/ideas/{id}/` | Member | Update idea |
| DELETE | `/api/ideas/{id}/` | Member/Admin | Delete idea |

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
- New Docker service: `worker-slogan` processing the `slogan` queue (or shared with `worker-research`)
- PostgreSQL Checkpointer shared with PROJ-6

Document both in `django-app/env/.env.template`.

## Unresolved Questions

1. n8n webhook URL confirmed? (Webhook ID `971d276d-6fba-4f3d-b3f1-abe1725b675c` found in workflow file — need full URL with hostname.)
2. "Import from product research" — defer entirely to PROJ-7, or include as acceptance criterion in PROJ-8?
3. Should adapted slogans with `signal_type=OTHER` be hidden from design board by default? (OTHER targets buyers, not wearers — may not suit t-shirt designs.)
