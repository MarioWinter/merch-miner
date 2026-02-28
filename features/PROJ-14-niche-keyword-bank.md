# PROJ-14: Niche Keyword Bank

**Status:** Planned
**Priority:** P1
**Created:** 2026-02-27

## Overview

A curated, per-niche list of SEO/listing keywords. Aggregates keywords from three sources: auto-import from PROJ-4 deep research results, search-term saves from PROJ-8 autocomplete suggestions, and manual entry. The full list can be injected into PROJ-7 listing generation with one click via a keyword selector modal.

## User Stories

1. As a member, I want to see all keywords saved for a niche in one place, so I can review and curate my keyword collection.
2. As a member, when PROJ-4 research completes, I want research keywords auto-imported into the bank, so I don't have to do it manually.
3. As a member, I want to manually add keywords to the bank, so I can include keywords not found in research.
4. As a member, I want to delete keywords I don't want, so the bank stays clean.
5. As a member, I want to save autocomplete suggestions from PROJ-8 searches to the bank, so I can capture keywords I discover during product research.
6. As a member, I want to copy or insert all bank keywords into a listing's backend keywords field, so I can populate it in one click.

## Acceptance Criteria

1. `NicheKeyword` model: UUID pk, `niche` FK (Niche, on_delete=CASCADE), `keyword` CharField(200), `source` choices [research, amazon_search, manual], `created_by` FK (User, nullable, on_delete=SET_NULL), `created_at`. `unique_together = [('niche', 'keyword')]`.
2. On `NicheResearch` status → `completed`: auto-insert `top_focus_keywords` + `main_short_tail` from `NicheKeywordAnalysis` as `source=research` rows; skip duplicates silently (unique constraint).
3. `GET /api/niches/{id}/keywords/` — returns all keywords for niche ordered by source then created_at. Filterable by `?source=research|amazon_search|manual` param.
4. `POST /api/niches/{id}/keywords/` — manual add; `source` defaults to `manual`. Returns 409 if keyword already exists for this niche.
5. `DELETE /api/niches/{id}/keywords/{keyword_id}/` — removes keyword; 404 if not found or belongs to different workspace.
6. `POST /api/niches/{id}/keywords/bulk-delete/` — body `{"ids": ["uuid1", "uuid2"]}` — deletes multiple keywords.
7. Frontend: Keyword Bank tab or panel on Niche detail view. Keywords grouped by source (research / amazon_search / manual). Checkbox multi-select for bulk delete. Shows total keyword count.
8. PROJ-8 autocomplete suggestion items show a "+ Save" icon; click opens niche selector (defaults to currently active niche if in niche context); saves keyword with `source=amazon_search`.
9. PROJ-7 listing form: "Add from Keyword Bank" button opens modal listing the niche's `NicheKeyword` rows with checkboxes; selected keywords appended to `extra_keywords` on the generate request.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/niches/{id}/keywords/` | Member | List all keywords for niche |
| POST | `/api/niches/{id}/keywords/` | Member | Add keyword manually |
| DELETE | `/api/niches/{id}/keywords/{keyword_id}/` | Member | Remove keyword |
| POST | `/api/niches/{id}/keywords/bulk-delete/` | Member | Delete multiple keywords |

## Auto-Import Behavior (Source: research)

- Triggered when `NicheResearch` status transitions to `completed`
- Auto-inserts `NicheKeywordAnalysis.top_focus_keywords` + `main_short_tail` as `source=research` rows
- Duplicates (unique constraint on niche+keyword) skipped silently
- If no `NicheKeywordAnalysis` exists for the research run → skip auto-import silently

## PROJ-8 Integration (Source: amazon_search)

- PROJ-8 autocomplete suggestions UI gets a "+ Save" icon per suggestion row
- Click → niche selector dropdown (default: currently active niche) → `POST /api/niches/{id}/keywords/` with `{"keyword": "...", "source": "amazon_search"}`
- No niche selected → 400 "Niche required"

## Edge Cases

1. Research completes but no `NicheKeywordAnalysis` exists → skip auto-import silently.
2. Keyword bank has 200+ keywords → no hard cap; show total count in UI.
3. `extra_keywords` injection into PROJ-7 backend_keywords exceeds 500 char limit → truncate to fit; warn user with snackbar (handled in PROJ-7).
4. User saves autocomplete keyword without selecting a niche → 400 "Niche required."
5. Same keyword added from two sources (research auto-import + manual) → unique constraint on (niche, keyword) prevents duplicate; first insert wins; no error surfaced.

## Dependencies

- PROJ-3 (Niche model)
- PROJ-4 (NicheResearch + NicheKeywordAnalysis models — triggers auto-import)
- PROJ-8 (Amazon Product Research — autocomplete save integration)
- PROJ-7 (consumes keyword bank via "Add from Keyword Bank" modal)
