# PROJ-11: Team Kanban

**Status:** Planned
**Priority:** P1
**Created:** 2026-02-27

## Overview

Drag-and-drop kanban board where columns map to `Niche.status` values. Dragging a card updates the niche status via PATCH with optimistic UI update. Cards show key metadata at a glance.

## User Stories

1. As a member, I want to see all niches on a kanban board organized by status, so that I have a visual overview of the pipeline.
2. As a member, I want to drag a niche card to a new column, so that I can update its status without opening a detail view.
3. As a member, I want niche cards to show assignee, last-updated date, and counts of ideas/designs/listings, so that I can assess status quickly.
4. As a member, I want the board to update instantly when I drag, so that the interface feels responsive.

## Acceptance Criteria

1. Board columns (in order): New → Researched → In Design → Listed (Archived column hidden by default; toggle to show).
2. Each column shows niche count badge.
3. Niche card shows: name, assignee avatar (or "Unassigned"), time since last update, idea count, design count, listing count.
4. Drag uses dnd-kit `DndContext` + `useSortable`; drop on column triggers `PATCH /api/niches/{id}/` with `{status: "<new_status>"}`.
5. Optimistic update: card moves immediately on drop; reverts if PATCH fails with error toast.
6. Clicking a card navigates to niche detail page.
7. Assignee filter: dropdown to filter board by assignee (shows only that user's niches).
8. Board data fetched from `GET /api/niches/?page_size=200` (all statuses); no separate board endpoint needed.

## Frontend Implementation

- `DndContext` wraps the full board
- `useDroppable` on each column (droppable id = status string)
- `useSortable` on each card
- On `onDragEnd`: if over different column → dispatch PATCH; update local state optimistically
- Columns are static (hard-coded status values); niches distributed into columns by status

## Edge Cases

1. Drag to same column → no PATCH triggered; no UI change.
2. PATCH fails (network error) → revert card to original column; show error snackbar.
3. Another user updates a niche status while board is open → board does not auto-refresh in MVP (requires manual refresh); post-MVP: Supabase Realtime.
4. Admin tries to move a niche they don't own → allow (admin can update any niche); member can only move niches assigned to them.
5. 200+ niches in workspace → pagination not supported on board view; cap at 200 with warning "Showing first 200 niches."

## Dependencies

- PROJ-2 (Workspace & Membership)
- PROJ-3 (Niche List — uses PATCH /api/niches/{id}/)
- dnd-kit already in frontend dependencies (CLAUDE.md)
