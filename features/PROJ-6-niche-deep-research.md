# PROJ-6: Niche Deep Research (n8n)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27

## Overview

Trigger an n8n workflow that scrapes Amazon product data (via ScraperOps) and runs AI analysis on the results for a given niche. Results are written directly by n8n to Supabase PG tables (Django-managed schema). Django polls the DB for completion — no HTTP callback needed.

## User Stories

1. As a member, I want to click "AI Research" on a niche, so that Amazon product data and AI analysis are automatically gathered.
2. As a member, I want to see a progress indicator while research is running, so that I know the system is working.
3. As a member, I want to see the niche analysis displayed cleanly — summary, sentiment, emotions, emotional archetypes, emotional reality, design concepts, design aesthetics — so I can evaluate whether to advance the niche.
4. As a member, I want to see which patterns are ACTIVE for this niche (with context why), so I understand the psychological drivers that make it tick.
5. As a member, I want to see keyword suggestions (short-tail + long-tail) from the research, so I can use them in my listing later.
6. As a member, I want to see related niches in my workspace that share ≥2 active patterns with this niche, so I can find proven slogans to adapt from them.
7. As a member, I want to see an error message if research fails, so that I can retry or investigate.

## Acceptance Criteria

1. `NicheResearch` model: UUID pk, niche FK, status choices [pending, running, completed, failed], triggered_by FK (User), created_at, completed_at (nullable), error_message (TextField, blank=True).
2. `NicheResearchProduct` model: UUID pk, research FK, asin, title, brand, url, rate (FloatField), reviews_count (IntField), thumbnail_image (URLField). Index on research FK.
3. `NicheAnalysis` model: UUID pk, research FK (NicheResearch), niche FK, niche_summary (TextField), sentiment (CharField max 50), primary_emotions (JSONField — array), emotional_archetype (JSONField — array), example_keywords (JSONField — array), pattern_analysis (JSONField — array of `{name, present, context}`), emotional_reality (TextField), design_concepts (TextField), dominant_design_aesthetics (TextField), created_at.
4. `NicheKeywordAnalysis` model: UUID pk, research FK (NicheResearch), niche FK, main_short_tail (JSONField — array), main_long_tail (JSONField — array), all_keywords_flat (TextField), top_focus_keywords (JSONField — array), top_long_tail_keywords (JSONField — array), created_at.
5. `POST /api/niches/{id}/research/` — creates `NicheResearch` (status=pending) → HTTP POST to n8n webhook → returns research record with status=pending. Returns 409 if research with status=pending or running already exists for this niche.
6. n8n workflow receives niche name + research_id → scrapes → AI analysis → on start: UPDATE `NicheResearch` status=running; on completion: UPDATE status=completed + completed_at, INSERT into `NicheAnalysis`, `NicheKeywordAnalysis`, and `NicheResearchProduct`.
7. `GET /api/niches/{id}/research/latest/` — returns the most recent `NicheResearch` including nested `analysis`, `keywords`, `products`, and `related_niches`. See API Response Shape below.
8. Frontend polls `GET /api/niches/{id}/research/latest/` every 5 seconds while status is pending or running.
9. MUI LinearProgress shown while polling. When complete: summary card + pattern cards + keyword chips + related niches section replace the progress bar.
10. Active patterns (`present=true`) shown prominently as highlighted cards with `context` text. Inactive patterns (`present=false`) shown collapsed/grayed.
11. `related_niches` computed server-side at read time: up to 5 other niches in the same workspace where their `NicheAnalysis.pattern_analysis` contains ≥2 matching active patterns (present=true). Each entry: `{id, name, shared_patterns: ["PATTERN_NAME", ...]}`.
12. On n8n unreachable (HTTP error or timeout): set research status=failed with error_message. Retry UI shown.
13. Existing niche status updated to `deep_research` when research completes.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/niches/{id}/research/` | Member | Trigger research |
| GET | `/api/niches/{id}/research/latest/` | Member | Poll latest research |
| GET | `/api/niches/{id}/research/` | Member | List all research runs |

## API Response Shape

`GET /api/niches/{id}/research/latest/` returns:
```json
{
  "id": "uuid",
  "status": "completed",
  "created_at": "...",
  "completed_at": "...",
  "analysis": {
    "niche_summary": "...",
    "sentiment": "...",
    "primary_emotions": ["..."],
    "emotional_archetype": ["..."],
    "example_keywords": ["..."],
    "pattern_analysis": [{"name": "...", "present": true, "context": "..."}],
    "emotional_reality": "...",
    "design_concepts": "...",
    "dominant_design_aesthetics": "..."
  },
  "keywords": {
    "main_short_tail": ["..."],
    "main_long_tail": ["..."],
    "all_keywords_flat": "...",
    "top_focus_keywords": ["..."],
    "top_long_tail_keywords": ["..."]
  },
  "products": [
    {"asin": "...", "title": "...", "brand": "...", "url": "...", "rate": 4.8, "reviews_count": 124, "thumbnail_image": "..."}
  ],
  "related_niches": [
    {"id": "uuid", "name": "...", "shared_patterns": ["PATTERN_A", "PATTERN_B"]}
  ]
}
```

## n8n Integration

**Pattern:** Supabase PG direct write (no HTTP callback)

- Django → n8n: `POST {N8N_RESEARCH_WEBHOOK_URL}` with body `{"niche": "<name>", "research_id": "<uuid>"}`
- n8n auth: Bearer token header (`N8N_WEBHOOK_SECRET` env var)
- n8n writes to:
  - `NicheResearch`: UPDATE status + completed_at
  - `NicheAnalysis`: INSERT one row (niche-level summary + patterns)
  - `NicheKeywordAnalysis`: INSERT one row (keyword buckets)
  - `NicheResearchProduct`: INSERT one row per scraped product
- n8n credentials: Supabase PG connection (INSERT/UPDATE on these four tables only)
- Django polls: reads `NicheResearch.status` every 5s (frontend-driven via GET endpoint)
- `research_id` must be included in payload so n8n can UPDATE `NicheResearch` and link analysis rows

**n8n Output Schema (actual — from `niche_analyses` + `keyword_analyses` tables):**

`niche_analyses` table:
```
niche_name, niche_summary, sentiment, primary_emotions (array),
emotional_archetype (array), example_keywords (array),
pattern_analysis (JSON array of {name, present, context}),
emotional_reality, design_concepts, dominant_design_aesthetics
```

`keyword_analyses` table:
```
niche_name, main_short_tail (array), main_long_tail (array),
all_keywords_flat (string), top_focus_keywords (array), top_long_tail_keywords (array)
```

## Edge Cases

1. n8n webhook URL not configured → 503 with message "Research service unavailable."
2. Research triggered while previous run still pending/running → 409 "Research already in progress."
3. n8n writes partial results before failing → status=failed; partial products retained for debugging.
4. Niche does not exist or belongs to different workspace → 404 / 403.
5. Research timeout (n8n takes > 10 min with no status update) → background job sets status=failed after timeout.
6. No other niches in workspace have ≥2 shared active patterns → `related_niches: []`.

## Dependencies

- PROJ-4 (Workspace & Membership)
- PROJ-5 (Niche List — niche FK)
- n8n niche research workflow must accept `{"niche": "string", "research_id": "uuid"}` payload and write to Django-managed tables

## Environment Variables Required

```
N8N_RESEARCH_WEBHOOK_URL=
N8N_WEBHOOK_SECRET=
```

Document in `django-app/env/.env.template`.
