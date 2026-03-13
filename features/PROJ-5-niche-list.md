# PROJ-5: Niche List

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-03-12

## Overview

Core data entity of the application. A `Niche` represents a product idea/market segment being researched and developed by a workspace. Full CRUD with status-based lifecycle, potential rating, assignee, soft-delete (archive), pagination, sorting, bulk operations, and kanban position ordering.

## User Stories

1. As a member, I want to create a niche with a name and optional notes, so that I can track product ideas.
2. As a member, I want to view a paginated list of niches filtered by status or status group, so that I can focus on my current pipeline stage.
3. As a member, I want to search niches by name, so that I quickly find a specific niche.
4. As a member, I want to sort niches by name, date, or status, so that I can organize my view.
5. As a member, I want to update a niche's status and assignee, so that the team knows where each niche is in the pipeline.
6. As a member, I want to rate a niche's potential before advancing it, so that the team only progresses viable niches.
7. As a member, I want to archive a niche instead of deleting it, so that I can recover it later if needed.
8. As an admin, I want to bulk-archive or bulk-reassign niches, so that I can manage the pipeline efficiently.

## Acceptance Criteria

1. `Niche` model:
   - UUID pk, workspace FK, name (max 200), notes (TextField, blank=True)
   - `status` choices: `[data_entry, deep_research, niche_with_potential, to_designer, upload, start_ads, pending, winner, loser, archived]`, default=`data_entry`
   - `potential_rating` choices: `[good, very_good, rejected]`, nullable, default=None
   - `research_status` choices: `[pending, running, done]`, nullable, default=None — tracks n8n deep research job state (PROJ-6 prep)
   - `research_run_id` UUID, nullable — stores n8n workflow run ID for polling (PROJ-6 prep)
   - `position` PositiveIntegerField, default=0 — manual sort order within a status column (PROJ-14 Kanban prep)
   - assigned_to FK (User, nullable, on_delete=SET_NULL), created_by FK (User), created_at, updated_at
   - `idea_count` (read-only, computed) — total ideas linked to this niche
   - `approved_idea_count` (read-only, computed) — ideas with status=`approved`
   - Index on (workspace, status); Index on (workspace, status, position)
2. `GET /api/niches/` — paginated (20/page), filterable by `status`, `status_group`, `potential_rating`, `assigned_to`; searchable by `name` (icontains); sortable via `ordering`. Workspace-scoped. Excludes `archived` niches by default.
3. `POST /api/niches/` — creates niche with status=`data_entry`, potential_rating=null, research_status=null; sets created_by=request.user.
4. `GET /api/niches/{id}/` — detail view.
5. `PATCH /api/niches/{id}/` — partial update (name, notes, status, assigned_to, potential_rating, position). Setting status=`niche_with_potential` requires potential_rating ∈ [good, very_good]; returns 400 "Set potential rating to Gut or Sehr gut first." if not met.
6. `DELETE /api/niches/{id}/` — sets status=`archived` (soft delete); returns 204.
7. `POST /api/niches/bulk/` — bulk action on a list of niche IDs. Supported actions: `archive`, `assign`. Admin only. Returns 200 with count of affected niches.
8. Only workspace members can access niche endpoints; non-members receive 403.
9. Admin can update/archive any niche; member can only update niches assigned to them OR created by them.
10. Paginated response includes total count and next/prev page links.
11. `status` may be set to `deep_research` automatically by the PROJ-6 research-completion task (system-write, not only via client PATCH). `research_status` and `research_run_id` are similarly updated by PROJ-6 only — never writable by client.
12. List and detail responses include `idea_count` (total ideas for niche) and `approved_idea_count` (ideas with status=approved) as read-only computed fields.

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
| GET | `/api/niches/` | Member | List niches (paginated, filtered, sorted) |
| POST | `/api/niches/` | Member | Create niche |
| GET | `/api/niches/{id}/` | Member | Niche detail |
| PATCH | `/api/niches/{id}/` | Member/Admin | Update niche |
| DELETE | `/api/niches/{id}/` | Member/Admin | Archive niche |
| POST | `/api/niches/bulk/` | Admin | Bulk action on multiple niches |

## Query Parameters (GET /api/niches/)

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status value |
| `status_group` | string | Filter by group [todo, in_progress, complete] |
| `potential_rating` | string | Filter by rating [good, very_good, rejected] |
| `search` | string | icontains search on name |
| `assigned_to` | UUID | Filter by assignee user ID |
| `ordering` | string | Sort field(s): `name`, `-name`, `created_at`, `-created_at`, `updated_at`, `-updated_at`, `position`. Default: `position` |
| `page` | int | Page number (default: 1) |
| `page_size` | int | Items per page (default: 20, max: 100) |

## Bulk Action Request Body (POST /api/niches/bulk/)

```json
{
  "ids": ["uuid1", "uuid2"],
  "action": "archive" | "assign",
  "assigned_to": "uuid"  // required when action=assign
}
```

## Edge Cases

1. Creating a niche with an existing name in same workspace → allow (names are not unique per workspace).
2. Assigning niche to a user not in the workspace → 400 validation error.
3. Filtering by an invalid status value → 400 with list of valid choices.
4. Setting status=`niche_with_potential` without potential_rating set → 400 "Set potential rating to Gut oder Sehr gut first."
5. Setting potential_rating=`rejected` then attempting status=`niche_with_potential` → 400 "Niche rated Rejected cannot advance to Niche with Potential."
6. potential_rating can be updated at any time (not locked to a status).
7. Transitioning backward (e.g. winner → data_entry) is allowed without restriction.
8. Archived niches excluded from default list; pass `status=archived` to retrieve them.
9. Searching with empty string → return all (no filter applied).
10. Bulk action with empty `ids` list → 400.
11. Bulk action with IDs from a different workspace → silently skipped (only workspace-scoped IDs processed).
12. Bulk `assign` without `assigned_to` field → 400.
13. `research_status` and `research_run_id` are read-only from the client; only updated internally by PROJ-6 logic.
14. Invalid `ordering` field → 400 with list of valid ordering fields.

## Dependencies

- PROJ-4 (Workspace & Membership) — workspace FK and isolation.
- PROJ-6 (Niche Deep Research) — will use `research_status` + `research_run_id` fields added here.
- PROJ-8 (Idea & Slogan Generation) — Slogans will have a FK to Niche (one niche → many slogans); relationship defined in PROJ-8.
- PROJ-14 (Team Kanban) — will use `position` field for drag-and-drop column ordering.

## Implementation Notes

- Use DRF `PageNumberPagination` with `page_size=20`.
- `assigned_to` validated: user must have active Membership in the same workspace.
- Soft delete: `DELETE` endpoint calls `niche.status = 'archived'; niche.save()` — does not remove row.
- Filter backend: `django-filter` or manual queryset filtering in `get_queryset()`.
- `status_group` filter: map group name to list of status values in `get_queryset()` before filtering.
- Transition validation for `niche_with_potential` enforced in serializer `validate()` method.
- Ordering: use DRF `OrderingFilter`; allowlist: `[name, created_at, updated_at, position]`.
- `research_status` / `research_run_id`: excluded from client-writable fields; updated only by PROJ-6 task. Same applies to auto-status-update to `deep_research` on research completion.
- `idea_count` + `approved_idea_count`: `SerializerMethodField` using `annotate(idea_count=Count('ideas'), approved_idea_count=Count('ideas', filter=Q(ideas__status='approved')))` on the queryset.
- `position`: default=0 on create; PATCH allows updating; used as default ordering within status group.
- Bulk endpoint: validate all IDs belong to the workspace before processing; use `filter(id__in=ids, workspace=workspace)`.

---

## Tech Design (Solution Architect)

### Backend Architecture

**New Django app:** `niche_app`

```
niche_app/
├── models.py        — Niche model
├── serializers.py   — NicheSerializer, NicheBulkSerializer
├── views.py         — NicheViewSet + BulkActionView
├── filters.py       — NicheFilter (status, status_group, potential_rating, assigned_to, search)
├── urls.py          — Router registration + bulk route
├── admin.py
└── tests/
    ├── test_models.py
    ├── test_serializers.py
    └── test_views.py
```

**Registered in:** `core/settings.py` INSTALLED_APPS, `core/urls.py` router.

**Key decisions:**
- `NicheViewSet` (DRF ModelViewSet) — standard CRUD + custom `bulk` action
- Workspace isolation: `get_queryset()` filters by `request.user`'s active workspace
- `idea_count` / `approved_idea_count`: queryset-level `annotate()` — no N+1
- Ordering: DRF `OrderingFilter`, allowlist `[name, created_at, updated_at, position]`
- `research_status` / `research_run_id`: read-only serializer fields; set only by PROJ-6 task
- Bulk endpoint: `POST /api/niches/bulk/` as a standalone APIView (not a router action), Admin only

---

### Frontend Architecture

**Route:** `/niches` → `NicheListView` (already in sidebar nav as "Niche Claims")

**Component tree:**

```
NicheListView  (/niches)
├── PageHeader
│   ├── h1 "Niche Claims"
│   └── [+ New Niche]  (Primary button → opens Drawer in create mode)
│
├── NicheFilterToolbar
│   ├── SearchField          (debounced, synced to URL ?search=)
│   ├── StatusGroupSelect    (All / To-Do / In Progress / Complete → ?status_group=)
│   ├── StatusSelect         (individual status → ?status=)
│   ├── PotentialRatingSelect (Gut / Sehr gut / Rejected → ?potential_rating=)
│   ├── AssigneeSelect       (workspace members → ?assigned_to=)
│   └── OrderingSelect       (Name A-Z / Newest / Oldest / Position → ?ordering=)
│
├── NicheTable
│   ├── Checkbox column      (select all / individual)
│   ├── Columns: Name | Status | Potential Rating | Assignee | Ideas | Updated | ⋮
│   ├── NicheRow  (×N)
│   │   ├── Checkbox
│   │   ├── NicheStatusChip  (color-coded per design system stage chips)
│   │   ├── PotentialRatingChip
│   │   ├── AssigneeAvatar   (32px, tooltip with name)
│   │   ├── IdeaCountBadge   (approved/total)
│   │   └── RowActionMenu    (⋮ → Archive)
│   ├── TableSkeleton        (loading state — 5 ghost rows)
│   ├── EmptyState           (no niches / no search results)
│   └── MUI Pagination       (bottom, compact)
│
├── NicheDetailDrawer  (480px, right — shared create + edit mode)
│   ├── DrawerHeader         (title "New Niche" or niche name + [X] close)
│   ├── NameField            (required TextField)
│   ├── NotesField           (optional multiline TextField)
│   ├── StatusSelect         (edit mode only)
│   ├── PotentialRatingSelect (edit mode only)
│   ├── AssigneeSelect       (workspace members, nullable)
│   ├── IdeaCountsSection    (edit mode only — "X ideas · Y approved" chips)
│   └── DrawerFooter
│       ├── [Create Niche]   (create mode) / [Save Changes]  (edit mode)
│       └── [Archive]        (edit mode only, destructive style, bottom)
│
└── BulkActionBar  (floating, fixed bottom, appears when ≥1 row selected)
    ├── "X selected"  (text.secondary)
    ├── [Archive]     (destructive button)
    ├── [Assign ▾]    (dropdown → workspace members)
    └── [×]           (clear selection)
```

**File structure:**

```
frontend-ui/src/
├── views/niches/list/
│   ├── NicheListView.tsx
│   ├── hooks/
│   │   ├── useNicheFilters.ts      — URL search param sync (read/write filters)
│   │   ├── useNicheDrawer.ts       — drawer open state + create/edit mode
│   │   └── useNicheSelection.ts    — checkbox state + bulk actions
│   ├── partials/
│   │   ├── NicheFilterToolbar.tsx
│   │   ├── NicheTable.tsx
│   │   ├── NicheRow.tsx
│   │   ├── NicheDetailDrawer.tsx
│   │   ├── NicheStatusChip.tsx     — reusable status chip (used in PROJ-6/14 too)
│   │   ├── PotentialRatingChip.tsx
│   │   └── BulkActionBar.tsx
│   ├── schemas/
│   │   └── nicheSchema.ts          — Zod schema (name required, notes optional)
│   ├── types/
│   │   └── index.ts                — Niche, NicheStatus, PotentialRating TS types
│   └── tests/
│       ├── NicheListView.test.tsx
│       ├── NicheDetailDrawer.test.tsx
│       └── NicheFilterToolbar.test.tsx
│
├── services/
│   └── nicheService.ts             — axios calls (file upload / blob only; otherwise RTK Query)
│
└── store/
    └── nicheSlice.ts               — RTK Query endpoints (list, detail, create, update, delete, bulk)
```

**State management:**
- API calls: RTK Query (auto-cache + invalidation on mutation)
- Filter state: URL `searchParams` — bookmarkable, survives refresh, shareable
- Drawer state: local `useState` in `NicheListView` (selectedId + mode)
- Bulk selection: local `useState` in `NicheListView` (Set of IDs)

**Key design system mappings:**
- `NicheStatusChip` → uses Stage Pipeline Chips from design system §8.5
- `NicheTable` rows → Niche Card pattern from design system §8.1 (horizontal full-width)
- `NicheDetailDrawer` → Drawer spec from design system §8.8 (480px, border-left)
- `BulkActionBar` → Glass Card (glass-md) fixed at bottom, elevation.3
- `TableSkeleton` → MUI Skeleton rows, `background.elevated` fill
- `EmptyState` → design system §8.7 (64px icon, centered, py:8)

---

## Verification Steps

1. Create niche → status=`data_entry`, potential_rating=null, research_status=null, position=0
2. PATCH status=`niche_with_potential` → 400 (no rating set)
3. PATCH potential_rating=`rejected` → PATCH status=`niche_with_potential` → 400
4. PATCH potential_rating=`good` → PATCH status=`niche_with_potential` → 200
5. GET `/api/niches/?status_group=todo` → returns data_entry + deep_research + niche_with_potential niches
6. GET `/api/niches/?potential_rating=rejected` → returns only rejected-rated niches
7. GET `/api/niches/?ordering=-created_at` → newest first
8. GET `/api/niches/?ordering=position` → sorted by position ascending
9. POST `/api/niches/bulk/` `{ ids: [...], action: "archive" }` → 200 with affected count
10. POST `/api/niches/bulk/` `{ ids: [], action: "archive" }` → 400
