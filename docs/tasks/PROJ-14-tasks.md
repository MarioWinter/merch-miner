# PROJ-14: Team Kanban & Collaboration — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `kanban_app` — comments, notifications, trash, cloud sync, round logic
- **`current_round`** on Niche (simple counter, not separate model)
- **dnd-kit** for drag & drop (already installed)
- **Full-screen MUI Dialog** for card modal (not page route — user keeps board context)
- **Optimistic drag** with revert on PATCH failure
- **NotificationBell** as global TopBar component (all pages, not just Kanban)
- **Cloud sync** as async django-rq job (don't block approval)
- **Soft-delete Trash** with 30-day expiry + daily cronjob cleanup
- **No real-time WebSocket** for board MVP (manual refresh, Supabase Realtime deferred)

---

## Phase 1: Backend Foundation — Models

- [ ] Create `kanban_app/` Django app, register in `INSTALLED_APPS`
- [ ] Create `kanban_app/api/` + `kanban_app/services/` subpackages
- [ ] Wire into `core/urls.py`
- [ ] AC-1: Amend `Niche` model (niche_app): add `current_round` PositiveIntegerField (default=1). Migration in `niche_app`
- [ ] AC-2: Amend `Idea`, `DesignAsset`, `Listing` models: add `round` PositiveIntegerField (default=1). Migrations in respective apps
- [ ] AC-3: `NicheComment` model: UUID pk, `niche` FK (CASCADE), `design` FK (DesignAsset, nullable), `author` FK (User, nullable), `agent_type` CharField(50, blank=True), `content` TextField, `mentions` JSONField(default=list), `created_at`
- [ ] AC-4: `Notification` model: UUID pk, `workspace` FK, `recipient` FK (User), `type` choices (assignment/approval/rejection/mention/status_change/agent_action), `title` CharField(200), `message` TextField, `link` URLField, `is_read` BooleanField(default=False), `source_user` FK (nullable), `source_agent_type` CharField(50, blank=True), `created_at`
- [ ] AC-5: `DesignTrash` model: UUID pk, `design` FK (DesignAsset), `deleted_by` FK (User), `deleted_at` DateTimeField, `expires_at` DateTimeField (deleted_at + 30d)
- [ ] Indexes: `(workspace, is_read, created_at)` on Notification, `(niche, design)` on NicheComment, `expires_at` on DesignTrash
- [ ] Initial migrations
- [ ] Admin registration

---

## Phase 2: Backend Services

- [ ] `services/round_manager.py`: New Round logic — increment `niche.current_round`, set `niche.status = to_designer`. Validate: niche must be in Done column (winner/loser) to start new round
- [ ] `services/notification_service.py`: create Notification records. Called on: assignment, design approval/rejection, @mention, status change, agent action. Batch-creates for multiple recipients
- [ ] `services/cloud_sync.py`: on design approval → upload to workspace's configured Google Drive / OneDrive folder. Async django-rq job. Reuses PROJ-11 OAuth connections. On failure: log + notify admin
- [ ] `services/trash_cleanup.py`: query `DesignTrash.expires_at < now()` → delete actual files + DB records. Called by daily cronjob
- [ ] `signals.py`: post_save on Niche (status change) → create Notification for assignee. post_save on NicheComment (mentions) → create Notification per mentioned user

---

## Phase 3: Board + Round API

- [ ] AC-6: Board uses existing `GET /api/niches/?page_size=200`. No separate board endpoint
- [ ] AC-7: Frontend maps niche status to 5 column groups (Research/Design/Publish/Live/Done)
- [ ] AC-8: `PATCH /api/niches/{id}/` with `{status}` — drag & drop triggers status update
- [ ] AC-9: `POST /api/niches/{id}/new-round/` — validates niche in Done column (winner/loser), increments `current_round`, sets `status = to_designer`. Returns updated niche
- [ ] AC-16: `GET /api/niches/{id}/rounds/` — round summaries: per round, count of slogans (Idea), designs (total/approved/rejected), listings, uploads, winners

---

## Phase 4: Card Modal — Designs API

- [ ] AC-10: `GET /api/niches/{id}/designs/?round=X` — designs for specific round (all rounds if no param). Includes status, thumbnail, lifecycle data
- [ ] AC-11: `POST /api/niches/{id}/designs/upload/` — multipart, single or multiple files. Creates DesignAsset linked to niche + current_round. Generates thumbnail
- [ ] AC-12: `POST /api/niches/{id}/designs/import-drive/` — body: `{file_ids, provider}`. Imports from Drive/OneDrive onto card
- [ ] AC-13: `PATCH /api/designs/{id}/` — approve/reject. On approve: trigger cloud sync job if configured. Only 1 approved per idea (auto-reject previous)
- [ ] AC-14: `DELETE /api/designs/{id}/` — soft delete → create DesignTrash record. Design hidden from carousel
- [ ] AC-15: `POST /api/designs/{id}/restore/` — restore from trash. Delete DesignTrash record, design visible again

---

## Phase 5: Comments API

- [ ] AC-17: `GET /api/niches/{id}/comments/` — card-level comments (design=null). `?design_id=X` for design-level comments. Ordered by created_at
- [ ] AC-18: `POST /api/niches/{id}/comments/` — body: `{content, design_id (optional), mentions: [user_ids]}`. Creates Notification per mentioned user
- [ ] AC-19: `DELETE /api/niches/{id}/comments/{comment_id}/` — author or admin only
- [ ] AC-20: Agent comments created via internal service (not API): `agent_type` set, `author` null

---

## Phase 6: Notifications API

- [ ] AC-21: `GET /api/notifications/` — user's notifications, ordered by created_at desc. `?is_read=false` for unread only. Paginated
- [ ] AC-22: `PATCH /api/notifications/{id}/` — mark as read
- [ ] AC-23: `POST /api/notifications/mark-all-read/` — mark all unread as read for user
- [ ] AC-24: `GET /api/notifications/unread-count/` — returns `{count: N}` for TopBar badge

---

## Phase 7: Cloud Sync + Trash API

- [ ] AC-25: Cloud sync task: on design approval, if workspace has Drive/OneDrive connected → upload file to configured folder. Async django-rq job
- [ ] AC-26: Sync failure → log error, create Notification for admin "Cloud sync failed for Design X"
- [ ] AC-27: Trash cleanup cronjob (daily): `DesignTrash.expires_at < now()` → delete files + records
- [ ] AC-28: `GET /api/designs/trash/` — list trashed designs for workspace. Shows: name, deleted_by, deleted_at, expires_at

---

## Phase 8: Serializers

- [ ] `NicheCardSerializer` — niche fields + `current_round`, `assignee` (nested), `thumbnail` (first design image or null), `counts` (slogans, designs, listings per current round)
- [ ] `RoundSummarySerializer` — round number, slogan_count, design_count (total/approved/rejected), listing_count, upload_count, winner_design (thumbnail)
- [ ] `NicheCommentSerializer` — id, content, author (name + avatar), agent_type, design_id, mentions, created_at
- [ ] `NotificationSerializer` — id, type, title, message, link, is_read, source_user/agent_type, created_at
- [ ] `DesignTrashSerializer` — design name, thumbnail, deleted_by, deleted_at, expires_at

---

## Phase 9: Frontend — State & Services

- [ ] RTK Query `kanbanApi` slice (`store/kanbanSlice.ts`): listNiches (board), newRound, listDesigns, uploadDesigns, importDrive, approveRejectDesign, softDeleteDesign, restoreDesign, listTrash, listRounds, listComments, createComment, deleteComment
- [ ] RTK Query `notificationApi` slice (`store/notificationSlice.ts`): listNotifications, markRead, markAllRead, getUnreadCount
- [ ] Cache tags: `KanbanBoard`, `Designs`, `Comments`, `Notifications`, `Trash`, `Rounds`
- [ ] Register slices in `store/index.ts`
- [ ] TypeScript types: NicheCard, RoundSummary, NicheComment, Notification, DesignTrash, KanbanColumn

---

## Phase 10: Frontend — Kanban Board

- [ ] `KanbanBoardView.tsx`: full-page route `/kanban`. 5 columns with dnd-kit DndContext + SortableContext per column
- [ ] `useBoardData` hook: load niches (page_size=200), distribute to columns by status group mapping
- [ ] `useCardDrag` hook: dnd-kit `onDragEnd` → PATCH status. Optimistic update in RTK cache, revert on error + snackbar
- [ ] `KanbanColumn.tsx`: column header (name + niche count badge) + scrollable card list + EmptyColumn placeholder
- [ ] `NicheCard.tsx`: AC-30 — thumbnail (first design or placeholder), niche name, assignee avatar (32px), exact status chip (color-coded), round badge ("R2"), compact counts (slogans/designs/listings)
- [ ] `AssigneeFilter.tsx`: MUI Select in board header — filter niches by assignee
- [ ] `ArchivedToggle.tsx`: MUI Switch in board header — show/hide archived niches
- [ ] Route `/kanban` registered in `App.tsx`

---

## Phase 11: Frontend — Card Modal

- [ ] `useCardModal` hook: open/close state, URL query param `?card=nicheId` for deep-linking. Loads niche detail + designs + comments + rounds on open
- [ ] `CardModal.tsx`: AC-31 — full-screen MUI Dialog. Sections: Design Carousel, Comments, Round History, Lifecycle, Upload Zone, "New Round" button, "Discuss" → Chat
- [ ] `DesignCarousel.tsx`: horizontal scroll (MUI-based or custom). Shows designs for active round. Click to select design
- [ ] `DesignSlide.tsx`: large thumbnail, status chip (pending/approved/rejected), Approve/Reject/Feedback buttons. Reject opens text input for feedback reason (creates design-level comment)
- [ ] `CommentThread.tsx`: card-level or design-level comments. Agent comments styled with robot emoji + agent display_name
- [ ] `CommentInput.tsx`: AC-33 — MUI TextField with @mention autocomplete (type `@` → MUI Autocomplete dropdown with workspace members)
- [ ] `RoundHistory.tsx`: per-round summary cards. "R1: 10💡 4🎨 1🏆. R2: in progress...". Previous round winner shown as reference thumbnail
- [ ] `DesignUploadZone.tsx`: drag & drop zone in modal. Accepts single or multiple files. Progress indicator during upload
- [ ] `TrashView.tsx`: accessible from modal or standalone. Lists trashed designs with restore button + expiry countdown

---

## Phase 12: Frontend — NotificationBell (Global Component)

- [ ] `components/NotificationBell/index.tsx`: AC-32 — TopBar icon button with unread count MUI Badge. Click opens dropdown
- [ ] `components/NotificationBell/NotificationDropdown.tsx`: MUI Popover with notification list. Each item: icon per type, title, message, relative time, click → navigate to `link`. "Mark all read" button at top
- [ ] `useNotifications` hook: poll `getUnreadCount` every 30s. List notifications on dropdown open. Mark read on click
- [ ] AC-34: Agent notifications styled with robot emoji + agent display_name, distinct background color
- [ ] Integrate NotificationBell into existing TopBar/AppBar component

---

## Phase 13: i18n

- [ ] `kanban.board.*` — page title, column names (Research, Design, Publish, Live, Done)
- [ ] `kanban.card.*` — count labels, round badge, assignee, status chips
- [ ] `kanban.modal.*` — modal title, carousel labels, approve/reject/feedback buttons
- [ ] `kanban.comments.*` — thread title, input placeholder, @mention hint, delete confirm
- [ ] `kanban.round.*` — "New Round" button, round summaries, round history title
- [ ] `kanban.upload.*` — drop zone hint, progress, import button
- [ ] `kanban.trash.*` — trash title, restore button, expires in label, empty trash message
- [ ] `kanban.notifications.*` — bell tooltip, type labels (assignment, approval, rejection, mention, status_change, agent_action), mark all read
- [ ] `kanban.filter.*` — assignee filter, archived toggle
- [ ] `kanban.empty.*` — empty column, no designs, no comments
- [ ] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 14: Tests

### Backend

- [ ] New Round: increments current_round, resets status, validates Done column only
- [ ] Comments CRUD: card-level + design-level, @mention creates Notification, author/admin can delete
- [ ] Notifications: created on assign/approve/reject/mention/status_change. Unread count correct. Mark read/all-read
- [ ] Design upload: multipart creates DesignAsset linked to niche + round
- [ ] Soft delete: creates DesignTrash, design hidden. Restore removes DesignTrash
- [ ] Trash cleanup: expired entries deleted with files
- [ ] Cloud sync: async job on approval, failure logged + notification created
- [ ] Round summaries: correct counts per round
- [ ] Workspace isolation on all endpoints

### Frontend

- [ ] KanbanBoardView: 5 columns render with correct niche distribution
- [ ] NicheCard: shows all metadata (thumbnail, name, assignee, status, round, counts)
- [ ] Drag & drop: card moves, PATCH fires, revert on error
- [ ] CardModal: opens on click, shows carousel + comments + rounds
- [ ] DesignCarousel: approve/reject updates status, feedback creates comment
- [ ] CommentInput: @mention autocomplete shows workspace members
- [ ] NotificationBell: unread count badge, dropdown lists notifications
- [ ] AssigneeFilter: filters board correctly
- [ ] TypeScript + ESLint + Ruff: 0 errors

### Edge Cases

- [ ] EC-1: Drag to same column → no PATCH
- [ ] EC-2: PATCH fails → revert card position + error snackbar
- [ ] EC-3: 200+ niches → cap with warning
- [ ] EC-4: New Round on non-Done niche → button disabled + tooltip
- [ ] EC-9: Agent moves card while user drags → last write wins, card jumps with notification
- [ ] EC-12: Niche with 0 designs → placeholder thumbnail, upload zone prominent

---

## Verification Checklist

- [ ] `kanban_app` registered, migrations applied (including Niche `current_round`)
- [ ] 5-column Kanban board with dnd-kit drag & drop
- [ ] Optimistic drag with revert on PATCH failure
- [ ] Card shows all metadata (thumbnail, name, assignee, status chip, round badge, counts)
- [ ] Card Modal: Design Carousel with approve/reject/feedback
- [ ] Comments: card-level + design-level, @mention → notification
- [ ] NotificationBell in TopBar: unread count, dropdown, mark read
- [ ] New Round: increments round, resets status, validates Done column
- [ ] Round summaries: per-round counts visible on card + modal
- [ ] Cloud sync on design approval (async, failure doesn't block)
- [ ] Soft-delete Trash: 30-day expiry, daily cleanup cronjob
- [ ] Agent actions visible on board + in comments
- [ ] Assignee filter + archived toggle
- [ ] Workspace isolation on all endpoints
- [ ] All tests pass, lint clean
