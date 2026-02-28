# PROJ-5: Idea & Slogan Generation (n8n)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27

## Overview

Two-phase workflow for generating adapted slogans via n8n:

**Phase 1 — Source slogan creation (two modes):**
- *Manual*: User types slogan text + MUST select a source niche. Both fields required; neither alone is valid.
- *From product research* (PROJ-8 soft-dep): User searches a niche in product research → sees Amazon products → clicks "Save as source slogan" → LLM extracts slogan text from product listing image → source niche auto-set from the search query.

**Phase 2 — Adaptation:** User selects a source slogan (which already carries a niche) → picks 1+ target niches → triggers n8n adaptation workflow → n8n evaluates each target niche for compatibility → generates exactly 10 adapted slogans per approved niche.

**Migration required (2 items):**
1. n8n currently reads niche profiles from Google Sheets → must read from `NicheResearchProduct` in Supabase PG.
2. n8n currently writes slogans to Google Sheets + Trello → must INSERT into `Idea` table and UPDATE `IdeaAdaptationRun` in Supabase PG.

## User Stories

1. As a member, I want to manually enter a slogan for a niche as the starting point for adaptation, so I can seed the workflow with my own input.
2. As a member, I want the source niche to be required when entering a slogan manually, so adapted results have full context.
3. As a member, I want to select a source slogan and pick target niches to adapt it to, so the workflow generates new slogans for each niche.
4. As a member, I want to see which target niches were approved or rejected by the AI and why, so I understand the adaptation results.
5. As a member, I want to see adapted slogans grouped by target niche, so I can review what was generated per niche.
6. As a member, I want to approve or reject individual slogans, so only good ones proceed to design.
7. As a member, I want to re-trigger adaptation for a source slogan with different target niches, so I can expand coverage.
8. *(PROJ-8 dep)* As a member, I want to save a product slogan extracted from its image via LLM as a source slogan, so the source niche is auto-set from my search query.
9. As a member, when selecting target niches for adaptation, I want to see related niches (from PROJ-4 research results) suggested first, so I can quickly pick the highest-compatibility candidates.

## Acceptance Criteria

### Models

1. **`IdeaAdaptationRun`** model: UUID pk, `source_idea` FK (`Idea`), `target_niche_ids` (JSONField, list of niche UUIDs), `niche_results` (JSONField — per-niche approved/rejected + reason, populated by n8n), status choices [pending, running, completed, failed], triggered_by FK (User), created_at, completed_at (nullable), error_message (TextField, blank=True).

2. **`Idea`** model (full field list):
   - UUID pk
   - `niche` FK (required on ALL ideas — manual and adapted)
   - `adaptation_run` FK (`IdeaAdaptationRun`, nullable — null for manual/source ideas)
   - `source_idea` FK (self, nullable — links adapted ideas to their source)
   - `source_product_url` (URLField, blank=True — set when imported via PROJ-8 flow)
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

## n8n Integration

**Pattern:** Supabase PG direct write (no HTTP callback)

**Webhook ID (from workflow file):** `971d276d-6fba-4f3d-b3f1-abe1725b675c`

**Input** (Django → n8n):
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
`profile` is `null` when target niche has no `NicheAnalysis` — n8n runs in degraded mode.

**AI models used (all via OpenRouter):**
- Niche compatibility scoring: `mistralai/mistral-medium-3.1` (score ≥75 = APPROVED)
- Reference product validation: `mistralai/mistral-small-3.2-24b-instruct`
- Slogan generation: `mistralai/mistral-small-creative`

**Output schema** (written by `00002-SloganCreateV2.json`, one object per slogan):
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

**Migration tasks (blocking):**
1. `00002 - Amazon ScraperOps Niche Adaption SloganGenV2.1.json`: replace Google Sheets niche-list read → query `NicheAnalysis` from Supabase PG.
2. `00002-SloganCreateV2.json`: replace Google Sheets write + Trello card creation → INSERT into `Idea` table + UPDATE `IdeaAdaptationRun`.

## Edge Cases

1. n8n rejects ALL target niches (all incompatible) → run completes with status=completed, 0 new ideas created; rejection reasons surfaced per-niche in UI.
2. Source slogan has no niche → `POST /api/ideas/{id}/adapt/` returns 400 "Source idea must have a niche."
3. Target niche has no `NicheAnalysis` data → degraded mode warning chip shown in target selector; `profile: null` sent in payload; n8n runs name-only adaptation.
4. n8n webhook unreachable → run status=failed; "Retry" button shown.
5. Content policy violation in slogan generation → n8n marks niche as failed in `niche_results`; other niches proceed normally.
6. Duplicate slogan_text within same niche → allow (n8n may generate near-duplicates; user approves/rejects).
7. Approving an idea that already has a design → allow (designs persist).
8. Rejecting an idea with an approved design → warn user; require confirmation.

## Dependencies

- **PROJ-3** (Niche List) — required; source niche must exist
- **PROJ-4** (Niche Deep Research) — required for full quality; payload includes `NicheAnalysis` profiles for source + target niches
- **PROJ-8** (Amazon Product Research) — soft dependency; enables "import from product research" source slogan mode

## Environment Variables Required

```
N8N_SLOGAN_ADAPTATION_WEBHOOK_URL=   # Webhook ID: 971d276d-6fba-4f3d-b3f1-abe1725b675c
N8N_CALLBACK_SECRET=                  # Shared secret for n8n → Django write verification
```

Document both in `django-app/env/.env.template`.

## Unresolved Questions

1. n8n webhook URL confirmed? (Webhook ID `971d276d-6fba-4f3d-b3f1-abe1725b675c` found in workflow file — need full URL with hostname.)
2. "Import from product research" — defer entirely to PROJ-8, or include as acceptance criterion in PROJ-5?
3. Should adapted slogans with `signal_type=OTHER` be hidden from design board by default? (OTHER targets buyers, not wearers — may not suit t-shirt designs.)
