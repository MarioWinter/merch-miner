# PROJ-5: Niche List

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27

## Overview

Core data entity of the application. A `Niche` represents a product idea/market segment being researched and developed by a workspace. Full CRUD with status-based lifecycle, potential rating, assignee, soft-delete (archive), and pagination.

## User Stories

1. As a member, I want to create a niche with a name and optional notes, so that I can track product ideas.
2. As a member, I want to view a paginated list of niches filtered by status or status group, so that I can focus on my current pipeline stage.
3. As a member, I want to search niches by name, so that I quickly find a specific niche.
4. As a member, I want to update a niche's status and assignee, so that the team knows where each niche is in the pipeline.
5. As a member, I want to rate a niche's potential before advancing it, so that the team only progresses viable niches.
6. As a member, I want to archive a niche instead of deleting it, so that I can recover it later if needed.

## Acceptance Criteria

1. `Niche` model:
   - UUID pk, workspace FK, name (max 200), notes (TextField, blank=True)
   - `status` choices: `[data_entry, deep_research, niche_with_potential, to_designer, upload, start_ads, pending, winner, loser, archived]`, default=`data_entry`
   - `potential_rating` choices: `[good, very_good, rejected]`, nullable, default=None
   - assigned_to FK (User, nullable, on_delete=SET_NULL), created_by FK (User), created_at, updated_at
   - Index on (workspace, status)
2. `GET /api/niches/` — paginated (20/page), filterable by `status`, `status_group`, `potential_rating`, searchable by `name` (icontains). Workspace-scoped. Excludes `archived` niches by default.
3. `POST /api/niches/` — creates niche with status=`data_entry`, potential_rating=null; sets created_by=request.user.
4. `GET /api/niches/{id}/` — detail view.
5. `PATCH /api/niches/{id}/` — partial update (name, notes, status, assigned_to, potential_rating). Setting status=`niche_with_potential` requires potential_rating ∈ [good, very_good]; returns 400 "Set potential rating to Gut or Sehr gut first." if not met.
6. `DELETE /api/niches/{id}/` — sets status=`archived` (soft delete); returns 204.
7. Only workspace members can access niche endpoints; non-members receive 403.
8. Admin can update/archive any niche; member can only update niches assigned to them OR created by them.
9. Paginated response includes total count and next/prev page links.

## Status Reference

| Group | DB value | Display |
|-------|----------|---------|
| To-Do | `data_entry` | Data Entry |
| To-Do | `deep_research` | Deep Research |
| To-Do | `niche_with_potential` | Niche with Potential |
| In Progress | `to_designer` | Goes to Designer |
| In Progress | `upload` | Upload |
| In Progress | `start_ads` | Start Ads |
| Complete | `pending` | Pending |
| Complete | `winner` | Winner |
| Complete | `loser` | Loser |
| (system) | `archived` | Archived (soft delete) |

`status_group` filter values: `todo` → [data_entry, deep_research, niche_with_potential]; `in_progress` → [to_designer, upload, start_ads]; `complete` → [pending, winner, loser]

## Potential Rating Reference

| DB value | Display |
|----------|---------|
| `good` | Gut |
| `very_good` | Sehr gut |
| `rejected` | Rejected |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/niches/` | Member | List niches (paginated, filtered) |
| POST | `/api/niches/` | Member | Create niche |
| GET | `/api/niches/{id}/` | Member | Niche detail |
| PATCH | `/api/niches/{id}/` | Member/Admin | Update niche |
| DELETE | `/api/niches/{id}/` | Member/Admin | Archive niche |

## Query Parameters (GET /api/niches/)

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status value |
| `status_group` | string | Filter by group [todo, in_progress, complete] |
| `potential_rating` | string | Filter by rating [good, very_good, rejected] |
| `search` | string | icontains search on name |
| `assigned_to` | UUID | Filter by assignee user ID |
| `page` | int | Page number (default: 1) |
| `page_size` | int | Items per page (default: 20, max: 100) |

## Edge Cases

1. Creating a niche with an existing name in same workspace → allow (names are not unique per workspace).
2. Assigning niche to a user not in the workspace → 400 validation error.
3. Filtering by an invalid status value → 400 with list of valid choices.
4. Setting status=`niche_with_potential` without potential_rating set → 400 "Set potential rating to Gut or Sehr gut first."
5. Setting potential_rating=`rejected` then attempting status=`niche_with_potential` → 400 "Niche rated Rejected cannot advance to Niche with Potential."
6. potential_rating can be updated at any time (not locked to a status).
7. Transitioning backward (e.g. winner → data_entry) is allowed without restriction.
8. Archived niches excluded from default list; pass `status=archived` to retrieve them.
9. Searching with empty string → return all (no filter applied).

## Dependencies

- PROJ-4 (Workspace & Membership) — workspace FK and isolation.

## Implementation Notes

- Use DRF `PageNumberPagination` with `page_size=20`.
- `assigned_to` validated: user must have active Membership in the same workspace.
- Soft delete: `DELETE` endpoint calls `niche.status = 'archived'; niche.save()` — does not remove row.
- Filter backend: `django-filter` or manual queryset filtering in `get_queryset()`.
- `status_group` filter: map group name to list of status values in `get_queryset()` before filtering.
- Transition validation for `niche_with_potential` enforced in serializer `validate()` method.

## Verification Steps

1. Create niche → status=`data_entry`, potential_rating=null
2. PATCH status=`niche_with_potential` → 400 (no rating set)
3. PATCH potential_rating=`rejected` → PATCH status=`niche_with_potential` → 400
4. PATCH potential_rating=`good` → PATCH status=`niche_with_potential` → 200
5. GET `/api/niches/?status_group=todo` → returns data_entry + deep_research + niche_with_potential niches
6. GET `/api/niches/?potential_rating=rejected` → returns only rejected-rated niches
