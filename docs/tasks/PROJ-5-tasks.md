# PROJ-5 — Niche List: Task List

---

## Backend

### 1. New Django App: `niche_app`

- [x] Create `django-app/niche_app/` with `__init__.py`, `apps.py`
- [x] Register `niche_app` in `core/settings.py` → `INSTALLED_APPS`
- [x] Create `niche_app/api/` subpackage with `__init__.py`

### 2. Niche Model

- [x] `Niche` model: UUID pk, `workspace` FK (Workspace, on_delete=CASCADE), `name` (max 200)
- [x] `notes` TextField (blank=True)
- [x] `status` choices: `[data_entry, deep_research, niche_with_potential, to_designer, upload, start_ads, pending, winner, loser, archived]`, default=`data_entry`
- [x] `potential_rating` choices: `[good, very_good, rejected]`, nullable, default=None
- [x] `research_status` choices: `[pending, running, done]`, nullable, default=None
- [x] `research_run_id` UUIDField, nullable, blank=True
- [x] `position` PositiveIntegerField, default=0
- [x] `assigned_to` FK (User, nullable, on_delete=SET_NULL, related_name='assigned_niches')
- [x] `created_by` FK (User, on_delete=CASCADE, related_name='created_niches')
- [x] `created_at`, `updated_at` (auto_now_add / auto_now)
- [x] `Meta.indexes`: Index on `(workspace, status)`; Index on `(workspace, status, position)`
- [x] `__str__` returns niche name

### 3. Migration

- [x] Generate `niche_app/migrations/0001_initial.py`
- [x] Run migration: `docker compose exec web python manage.py migrate`

### 4. NicheSerializer

- [x] `NicheSerializer` (read + write): all fields, `id` + `idea_count` + `approved_idea_count` + `research_status` + `research_run_id` read-only
- [x] `assigned_to`: PrimaryKeyRelatedField (nullable, queryset = active workspace members)
- [x] `assigned_to` validation: user must have active Membership in same workspace → 400 if not
- [x] `idea_count` + `approved_idea_count`: SerializerMethodField (queryset-annotated)
- [x] `NicheCreateSerializer`: only `name`, `notes`; sets `created_by` + `workspace` + default fields in `create()`

### 5. Transition Validation

- [x] Serializer `validate()` method: if `status == 'niche_with_potential'` and `potential_rating` not in `[good, very_good]` → raise 400 "Set potential rating to Gut oder Sehr gut first."
- [x] If `potential_rating == 'rejected'` and `status == 'niche_with_potential'` → raise 400 "Niche rated Rejected cannot advance to Niche with Potential."
- [x] Validate on PATCH: read current `potential_rating` from DB if not provided in request body

### 6. NicheFilter

- [x] `NicheFilter` class in `niche_app/api/filters.py`
- [x] Filter: `status` (exact)
- [x] Filter: `status_group` (custom method → maps `todo/in_progress/complete` to status list)
- [x] Filter: `potential_rating` (exact)
- [x] Filter: `assigned_to` (UUID, exact)
- [x] Filter: `search` (icontains on `name`)
- [x] Invalid `status` value → 400 with valid choices; invalid `status_group` → 400

### 7. NicheViewSet

- [x] `NicheViewSet` (ModelViewSet) in `niche_app/api/views.py`
- [x] `authentication_classes = [CookieJWTAuthentication]`, `permission_classes = [IsAuthenticated]`
- [x] `get_queryset()`: filter by `workspace` of `request.user`'s active Membership
- [x] `get_queryset()`: apply `NicheFilter`, apply `OrderingFilter` (allowlist: `name, created_at, updated_at, position`), default ordering = `position`
- [x] `get_queryset()`: exclude `status=archived` by default; include if `status=archived` explicitly passed
- [x] `get_queryset()`: annotate `idea_count` + `approved_idea_count` (Count with filter)
- [x] `perform_create()`: set `created_by=request.user`, `workspace` from active Membership
- [x] `destroy()`: soft-delete — set `status=archived`; return 204 (do not call `instance.delete()`)
- [x] Pagination: `PageNumberPagination`, `page_size=20`, `max_page_size=100`
- [x] Response format: total count + next/prev links

### 8. Permissions

- [x] Custom permission: Admin can PATCH/DELETE any niche in workspace
- [x] Member can only PATCH/DELETE niches where `assigned_to == request.user` OR `created_by == request.user`; otherwise 403
- [x] Non-members receive 403 on all endpoints

### 9. Bulk Endpoint

- [x] `NicheBulkSerializer`: `ids` (list of UUIDs, min 1), `action` [archive|assign], `assigned_to` (UUID, required if action=assign)
- [x] `POST /api/niches/bulk/` view: Admin only; filter IDs by workspace (silently skip cross-workspace IDs)
- [x] `action=archive`: bulk set `status=archived`; return `{ "updated": N }`
- [x] `action=assign`: bulk set `assigned_to`; validate assignee is workspace member; return `{ "updated": N }`
- [x] Empty `ids` → 400; `action=assign` without `assigned_to` → 400

### 10. URL Routing

- [x] `niche_app/api/urls.py`: DRF Router for NicheViewSet → `/api/niches/`
- [x] Register bulk URL: `POST /api/niches/bulk/`
- [x] Include in `core/urls.py`

### 11. Admin

- [x] Register `Niche` in `niche_app/admin.py` with list_display, list_filter, search_fields

### 12. Backend Tests

- [x] Test: Create niche → status=`data_entry`, potential_rating=null, research_status=null, position=0
- [x] Test: `GET /api/niches/` by non-member → 403
- [x] Test: `GET /api/niches/` excludes archived by default; `?status=archived` includes them
- [x] Test: `GET /api/niches/?status_group=todo` → only data_entry + deep_research + niche_with_potential
- [x] Test: `GET /api/niches/?potential_rating=rejected` → filtered correctly
- [x] Test: `GET /api/niches/?search=shoes` → icontains match; empty search → all returned
- [x] Test: `GET /api/niches/?ordering=-created_at` → newest first
- [x] Test: `PATCH` status=`niche_with_potential` without rating → 400
- [x] Test: `PATCH` potential_rating=`rejected` then status=`niche_with_potential` → 400
- [x] Test: `PATCH` potential_rating=`good` then status=`niche_with_potential` → 200
- [x] Test: `PATCH` assigned_to = user not in workspace → 400
- [x] Test: Member PATCH own niche → 200; PATCH other member's niche → 403
- [x] Test: `DELETE` → status=archived, row still exists in DB, 204 returned
- [x] Test: `POST /api/niches/bulk/` archive 2 niches → 200, `{ "updated": 2 }`
- [x] Test: `POST /api/niches/bulk/` empty ids → 400
- [x] Test: `POST /api/niches/bulk/` by member (not admin) → 403
- [x] Test: `GET /api/niches/` response includes `idea_count`, `approved_idea_count` fields
- [x] Run: `docker compose exec web pytest niche_app/` — zero failures

---

## Frontend

### 13. TypeScript Types

- [x] `views/niches/list/types/index.ts`: `Niche`, `NicheStatus`, `PotentialRating`, `ResearchStatus` TypeScript interfaces
- [x] `NicheListResponse` type (paginated: count, next, previous, results)
- [x] `NicheBulkPayload` type

### 14. Zod Schema

- [x] `views/niches/list/schemas/nicheSchema.ts`: `createNicheSchema` — `name` required (max 200), `notes` optional
- [x] `updateNicheSchema` — all fields optional (PATCH)

### 15. RTK Query Slice

- [x] `store/nicheSlice.ts`: RTK Query `createApi` with base `/api/niches/`
- [x] Endpoints: `listNiches(params)`, `getNiche(id)`, `createNiche(body)`, `updateNiche({id, body})`, `deleteNiche(id)`, `bulkNicheAction(body)`
- [x] Cache tags: `providesTags` on list/detail; `invalidatesTags` on create/update/delete/bulk
- [x] Register `nicheReducer` + `nicheMiddleware` in `store/index.ts`

### 16. useNicheFilters Hook

- [x] `views/niches/list/hooks/useNicheFilters.ts`
- [x] Read/write `search`, `status`, `status_group`, `potential_rating`, `assigned_to`, `ordering`, `page` from URL `searchParams`
- [x] Debounce search input (300ms) before syncing to URL
- [x] `resetFilters()` helper clears all params

### 17. useNicheDrawer Hook

- [x] `views/niches/list/hooks/useNicheDrawer.ts`
- [x] State: `open` (bool), `mode` ('create' | 'edit'), `selectedId` (string | null)
- [x] `openCreate()`, `openEdit(id)`, `closeDrawer()` actions

### 18. useNicheSelection Hook

- [x] `views/niches/list/hooks/useNicheSelection.ts`
- [x] State: `selectedIds` (Set\<string\>)
- [x] `toggleOne(id)`, `toggleAll(ids)`, `clearSelection()` actions
- [x] `isSelected(id)`, `selectedCount` derived values

### 19. NicheStatusChip Component

- [x] `views/niches/list/partials/NicheStatusChip.tsx`
- [x] Maps each `NicheStatus` to design system Stage Pipeline Chip colors (§8.5)
- [x] `data_entry` / `deep_research` / `niche_with_potential` → To-Do group style
- [x] `to_designer` / `upload` / `start_ads` → In Progress group style
- [x] `pending` / `winner` / `loser` / `archived` → Complete/system group style
- [x] Shows status display label (not DB value)

### 20. PotentialRatingChip Component

- [x] `views/niches/list/partials/PotentialRatingChip.tsx`
- [x] `good` → success style ("Gut"); `very_good` → primary style ("Sehr gut"); `rejected` → error style ("Rejected")
- [x] Renders nothing if `potential_rating` is null

### 21. NicheFilterToolbar Component

- [x] `views/niches/list/partials/NicheFilterToolbar.tsx`
- [x] `SearchField`: MUI `TextField` with `SearchIcon` adornment, debounced via `useNicheFilters`
- [x] `StatusGroupSelect`: MUI `Select` (All / To-Do / In Progress / Complete) → `?status_group=`
- [x] `StatusSelect`: MUI `Select` (all individual status values + "All") → `?status=`
- [x] `PotentialRatingSelect`: MUI `Select` (Gut / Sehr gut / Rejected / All) → `?potential_rating=`
- [x] `AssigneeSelect`: MUI `Select` from workspace members → `?assigned_to=`
- [x] `OrderingSelect`: MUI `Select` (Newest / Oldest / Name A-Z / Name Z-A / Position) → `?ordering=`
- [x] Active filter count badge on toolbar (shows number of non-default filters applied)
- [x] "Clear filters" ghost button (visible when any filter active)

### 22. NicheTable Component

- [x] `views/niches/list/partials/NicheTable.tsx`
- [x] MUI `Table` (dense, 44px rows) with columns: ☐ | Name | Status | Rating | Assignee | Ideas | Updated | ⋮
- [x] Header: `overline` text, sortable (Name + Updated columns trigger `?ordering=`)
- [x] Checkbox column: select-all in header; individual in each row
- [x] Row hover: `rgba(255,255,255,0.03)` + cursor pointer → `openEdit(id)`
- [x] "Ideas" column: `approved_idea_count / idea_count` text (e.g. "3 / 10")
- [x] "Updated" column: relative time (e.g. "2h ago") — use `formatDistanceToNow` from date-fns
- [x] ⋮ row action menu: "Archive" (destructive, confirmation required)

### 23. TableSkeleton + EmptyState

- [x] `TableSkeleton`: 5 ghost rows using MUI `Skeleton`, matches table column widths
- [x] `EmptyState` (no niches): 64px `ListAltIcon`, "No niches yet", "+ New Niche" CTA button
- [x] `EmptyState` (no search results): "No niches match your filters", "Clear filters" ghost button

### 24. NicheDetailDrawer Component

- [x] `views/niches/list/partials/NicheDetailDrawer.tsx`
- [x] MUI `Drawer` (anchor=right, width=480px per design system §8.8)
- [x] **Create mode**: header "New Niche", fields: Name (required) + Notes (optional); footer: [Cancel] [Create Niche]
- [x] **Edit mode**: header = niche name (editable inline), fields: Name, Notes, Status Select, Potential Rating Select, Assignee Select
- [x] Potential Rating Select: always visible in edit mode (not locked to status)
- [x] Assignee Select: MUI `Autocomplete` from workspace members, nullable (clear button)
- [x] IdeaCountsSection (edit mode): chips showing "X total · Y approved ideas"
- [x] Footer (edit mode): [Save Changes] (primary) + [Archive] (destructive, `DeleteOutline` icon, right-aligned)
- [x] Archive: show MUI `Dialog` confirmation before calling `deleteNiche(id)`
- [x] 400 error display: MUI `Alert` severity=error inside drawer with backend message
- [x] On create success: close drawer, show notistack success, invalidate list cache
- [x] On update success: show notistack success, invalidate list + detail cache
- [x] Drawer closes on backdrop click (unless unsaved changes — show confirm dialog)

### 25. BulkActionBar Component

- [x] `views/niches/list/partials/BulkActionBar.tsx`
- [x] Fixed bottom, full width (above sidebar, below topbar level) — `position: fixed, bottom: 0, left: 220px`
- [x] Glass card style (`glass-md`, elevation.3) with 16px padding
- [x] Content: "X selected" label + [Archive] (destructive) + [Assign ▾] (dropdown of workspace members) + [×] clear
- [x] [Archive] → confirmation Dialog → call `bulkNicheAction({ids, action:'archive'})` → notistack + clear selection
- [x] [Assign ▾] → MUI `Menu` with member list → call `bulkNicheAction({ids, action:'assign', assigned_to})` → notistack
- [x] Appears/disappears with `Slide` animation (200ms) when `selectedCount > 0`
- [x] Adjusts `left` to 60px when sidebar is collapsed

### 26. NicheListView (Main Container)

- [x] `views/niches/list/NicheListView.tsx`
- [x] PageHeader: `h1` "Niche Claims" + [+ New Niche] Primary button (right-aligned)
- [x] Wire `useNicheFilters`, `useNicheDrawer`, `useNicheSelection` hooks
- [x] Pass filter params to `useListNichesQuery()`; show loading / error / empty states
- [x] Pagination: MUI `Pagination` component, synced to `?page=` URL param
- [x] Add route `/niches` in `App.tsx` (already in sidebar navConfig)

### 27. i18n — Translation Files

All 5 locale JSON files at `frontend-ui/public/locales/{lang}/translation.json` must contain a top-level `niches` key with the following sub-sections. Files are pre-populated; verify completeness during implementation.

**Sub-sections (all 5 languages: EN · DE · FR · ES · IT):**

- [x] `niches.status.*` — all 10 status display labels (data_entry → archived)
- [x] `niches.statusGroup.*` — all/todo/in_progress/complete
- [x] `niches.potentialRating.*` — good ("Gut") / very_good ("Sehr gut") / rejected / none
  - Note: `good` and `very_good` display values intentionally kept as German domain terms across ALL locales
- [x] `niches.researchStatus.*` — pending / running / done
- [x] `niches.filter.*` — search placeholder, all dropdown labels, ordering options, `activeFilters_one` + `activeFilters_other` (plural forms)
- [x] `niches.table.*` — all column headers + unassigned label
- [x] `niches.drawer.*` — create/edit titles, all field labels + placeholders, action buttons, confirmation dialogs, unsaved-changes dialog
- [x] `niches.empty.*` — no niches + no results states (title + hint)
- [x] `niches.bulk.*` — selected count (`selected_one` + `selected_other`), action labels, confirmation dialogs, success messages
- [x] `niches.validation.*` — all 6 validation error messages
- [x] `niches.notifications.*` — createSuccess/Error, updateSuccess/Error, archiveSuccess/Error

**Key paths used in components (reference):**
```
t('niches.pageTitle')
t('niches.newNiche')
t('niches.status.data_entry')
t('niches.filter.activeFilters', { count: n })
t('niches.bulk.selected', { count: n })
t('niches.drawer.ideasBadge', { total: x, approved: y })
```

### 28. Frontend Tests

- [ ] `tests/NicheFilterToolbar.test.tsx`: search input debounce, dropdown filter changes update URL params, clear filters resets all
- [ ] `tests/NicheTable.test.tsx`: renders rows, skeleton on loading, empty state on no data, row click opens drawer
- [ ] `tests/NicheDetailDrawer.test.tsx`: create mode fields + submit; edit mode shows existing data; 400 error displays message; archive confirmation dialog
- [ ] `tests/NicheListView.test.tsx`: full integration — filter → table update; create flow; bulk selection + archive
- [ ] Run: `npm run test:ci` — zero failures required

---

## Verification Checklist (from spec)

- [ ] Create niche → status=`data_entry`, potential_rating=null, research_status=null, position=0
- [ ] PATCH status=`niche_with_potential` → 400 (no rating set)
- [ ] PATCH potential_rating=`rejected` → PATCH status=`niche_with_potential` → 400
- [ ] PATCH potential_rating=`good` → PATCH status=`niche_with_potential` → 200
- [ ] `GET /api/niches/?status_group=todo` → data_entry + deep_research + niche_with_potential only
- [ ] `GET /api/niches/?potential_rating=rejected` → only rejected-rated niches
- [ ] `GET /api/niches/?ordering=-created_at` → newest first
- [ ] `GET /api/niches/?ordering=position` → sorted by position ascending
- [ ] `POST /api/niches/bulk/` `{ ids: [...], action: "archive" }` → 200 with count
- [ ] `POST /api/niches/bulk/` `{ ids: [], action: "archive" }` → 400
- [ ] Non-member request → 403
- [ ] Member PATCH niche not assigned/created by them → 403
- [ ] DELETE niche → row still in DB with status=archived; returns 204
- [ ] Archived niches excluded from default list; included with `?status=archived`
- [ ] BulkActionBar appears/disappears correctly; left offset adjusts on sidebar collapse
- [ ] NicheDetailDrawer create + edit mode work; archive confirmation dialog appears
