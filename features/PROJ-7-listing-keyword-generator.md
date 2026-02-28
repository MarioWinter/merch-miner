# PROJ-7: Listing & Keyword Generator

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27

## Overview

Generate Merch by Amazon-compliant product listings (title, bullet points, description, backend keywords) for an approved idea. Accepts an optional approved design as visual input (vision AI analyzes the image and feeds a description into the listing prompt). Keywords from the Niche Keyword Bank (PROJ-14) can be injected into backend keywords with one click. Enforces MBA character limits with live counters and warnings. Output can be manually edited and copied in MBA-paste format.

## User Stories

1. As a member, I want to click "Generate Listing" on an idea with an approved design, so that AI creates an MBA-ready product listing.
2. As a member, I want to see live character counters for title, bullets, and description, so that I know if I'm within MBA limits.
3. As a member, I want to manually edit any generated field, so that I can refine the copy before publishing.
4. As a member, I want a "Copy for MBA" button, so that I can paste the listing directly into MBA's upload form.
5. As a member, I want backend keywords formatted correctly (no commas), so that I don't have to clean them up manually.
6. As a member, I want to select an approved design as input for listing generation, so the AI can see what the actual design looks like and write copy that matches it.
7. As a member, I want to inject keywords from the Niche Keyword Bank into my listing's backend keywords, so I don't have to copy-paste manually.
8. As a member, I want to generate a listing by providing an approved design AND a set of target keywords together, so the AI creates title, bullet points, and description that both match the design's visual content and are optimized around my target keywords.

## Acceptance Criteria

1. `Listing` model: UUID pk, idea FK, design FK (`Design`, nullable, on_delete=SET_NULL), brand_name (max 50), title (max 60), bullet_1–bullet_5 (max 256 each), description (max 2000), backend_keywords (max 500), status choices [draft, ready, published], generated_by choices [ai, manual], created_at, updated_at.
2. `POST /api/ideas/{id}/listing/generate/` — accepts optional body `{"design_id": "uuid", "extra_keywords": ["kw1", "kw2"]}`. Creates Listing with status=draft, generated_by=ai.
3. `GET /api/ideas/{id}/listing/` — returns the current listing for the idea (or 404 if none); includes `design` FK in response.
4. `PATCH /api/listings/{id}/` — partial update; any field editable; updates status=draft.
5. `PATCH /api/listings/{id}/` with `{"status": "ready"}` — marks listing as MBA-ready.
6. Frontend: character counter displayed below each field; turns amber at 90% of limit; turns red and shows warning at 100%+ (soft block — does not prevent saving).
7. "Copy for MBA" button copies formatted text to clipboard: brand / title / bullets / description / backend keywords, each on labeled lines.
8. Backend keywords are stored and displayed without commas (comma-separated input is split and rejoined with spaces).
9. `GET /api/listings/{id}/export/` — returns listing in plain-text MBA format (text/plain response).
10. `POST /api/ideas/{id}/listing/generate/` accepts optional `design_id`; if provided, validates design belongs to the same idea (403 if not); status=approved recommended but not enforced.
11. If `design_id` provided, backend enqueues django-rq task that calls OpenRouter vision endpoint with the design image URL; visual analysis is combined with slogan/idea fields in the listing prompt.
12. `Listing.design` FK stored; surfaced in `GET /api/ideas/{id}/listing/` response.
13. Vision call fails (403/404 on image URL or OpenRouter error) → fall back to slogan-only generation; log error; do not block listing creation.
14a. If `extra_keywords` provided, they are injected into the AI generation prompt as "target SEO keywords" with MBA priority order: prioritize in title first, then bullet_1, then backend_keywords; use in other bullets/description only where natural.
14b. After generation, `extra_keywords` are also appended (space-separated, commas stripped) to the AI-generated `backend_keywords` value; total `backend_keywords` must not exceed 500 chars after appending; truncate gracefully with snackbar warning if over limit.
15. Frontend listing generate UI shows "Select Design" picker (only approved designs for this idea) and "Add from Keyword Bank" button (opens PROJ-14 Keyword Bank modal for the niche).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/ideas/{id}/listing/generate/` | Member | Generate listing via AI |
| GET | `/api/ideas/{id}/listing/` | Member | Get listing for idea |
| PATCH | `/api/listings/{id}/` | Member | Edit listing fields |
| GET | `/api/listings/{id}/export/` | Member | Export plain-text MBA format |

## Generate Request Body

```json
{
  "design_id": "uuid (optional)",
  "extra_keywords": ["keyword1", "keyword2"]
}
```

## MBA Character Limits

| Field | Limit |
|-------|-------|
| Brand Name | 50 chars |
| Title | 60 chars |
| Bullet Points (×5) | 256 chars each |
| Description | 2000 chars |
| Backend Keywords | 500 chars |

## Edge Cases

1. Idea has no approved design → allow listing generation (design not required by MBA for all product types, but warn user). Design input is opt-in.
2. Generated listing exceeds character limit → save as draft; highlight offending fields in red; do not auto-truncate.
3. User edits listing after it's been marked ready → status reverts to draft automatically.
4. Backend keywords input contains commas → strip commas, collapse spaces; store cleaned value.
5. Multiple generate calls on same idea → overwrite existing draft listing; do not create duplicate.
6. `extra_keywords` appended to `backend_keywords` exceeds 500 char limit → truncate to fit; warn user with snackbar. Keywords are still fed into the AI prompt regardless of backend_keywords limit.
7. Vision call fails → fall back to slogan-only generation; log error; listing still created.

## Dependencies

- PROJ-5 (Idea & Slogan Generation — idea must exist with slogan data for prompt construction)
- PROJ-6 (Design Generation — design FK; vision input is optional)
- PROJ-14 (Niche Keyword Bank — "Add from Keyword Bank" modal in listing UI)

## Implementation Notes (TBD)

- Generation method: direct OpenRouter call via django-rq task in `tasks.py` (same pattern as PROJ-6).
- Vision model for design analysis: TBD (Gemini vision model via OpenRouter, or cheaper alternative like GPT-4o-mini — decide before implementation for cost).
- Text generation model: same as PROJ-6 or separate — TBD.
- `worker` docker-compose service required (introduced in PROJ-6).
