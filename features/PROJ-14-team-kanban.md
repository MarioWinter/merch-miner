# PROJ-14: Team Kanban & Collaboration

**Status:** Planned
**Priority:** P1
**Created:** 2026-02-27
**Updated:** 2026-03-26

## Overview

Drag-and-drop Kanban board where **5 grouped columns** map to `Niche.status` values. Cards show key metadata, round summaries, and product lifecycle data at a glance. Clicking a card opens a **full-screen Modal/Dialog** with Design-Carousel, Approve/Reject/Feedback controls, and per-design comment threads.

Beyond visualization, this is a **team collaboration hub**: designers upload designs directly onto cards (Drag & Drop, single or bulk), team members comment with @Mentions on card-level and design-level, assignments trigger In-App notifications, and the Agent (PROJ-18) is visible on the board — moving cards and leaving comments.

Approved designs auto-sync to configured Google Drive / OneDrive folder. Rejected designs go to Soft-Delete Trash (30 days, then auto-cleanup).

**Round System:** Niches support multiple rounds. "New Round" button resets status, increments round counter. Each round's designs, slogans, and listings are tracked separately. Round summaries visible on cards.

## Kanban Columns (5, grouped from PROJ-5 status values)

| Column | PROJ-5 Status Values | Description |
|--------|---------------------|-------------|
| **Research** | `data_entry`, `deep_research`, `niche_with_potential` | Niche being researched |
| **Design** | `to_designer` | Ready for / in design phase |
| **Publish** | `upload`, `start_ads` | Listing + upload phase |
| **Live** | `pending` | Published, awaiting results |
| **Done** | `winner`, `loser` | Final status |

`archived` niches hidden by default (toggle to show). Exact status shown as Chip badge on each card.

## User Stories

### Board & Cards
1. As a member, I want to see all niches on a Kanban board organized by 5 status groups, so I have a visual pipeline overview.
2. As a member, I want to drag a niche card to a new column, so I can update its status without opening a detail view. Optimistic UI update, revert on failure.
3. As a member, I want each card to show: thumbnail (first design image or placeholder), niche name, assignee avatar, exact status chip, round badge ("R2"), and compact counts (slogans/designs/listings).
4. As a member, I want each column to show a niche count badge.
5. As a member, I want to filter the board by assignee, so I see only my niches or a specific teammate's niches.

### Round System
6. As a member, I want a "New Round" button on winner/loser cards that resets status to `to_designer`, increments `current_round`, so I can start a new design campaign for the same niche.
7. As a member, I want round summaries on each card: "Round 1: 10 Slogans → 4 Designs → 1 Winner. Round 2: in progress..." so I see the full history at a glance.
8. As a member, I want to see which round is currently active on a card, so I know where the niche is in its lifecycle.

### Card Modal (Detail View)
9. As a member, I want to click a card to open a full-screen Modal showing: Design-Carousel, comments, feedback controls, round history, and lifecycle chain.
10. As a member, I want a Design-Carousel in the modal: horizontal scroll through all designs for the active round. Each design shows: large thumbnail, status (pending/approved/rejected), and action buttons.
11. As a member, I want Approve / Reject / Feedback buttons per design in the carousel. Reject opens a text input for feedback reason.
12. As a member, I want to see the full Product Lifecycle per design: Slogan → Design → Listing → ASIN + Marketplace + Upload Date + Sales Data (if available).

### Designer Upload
13. As a member, I want to upload designs directly on a card via Drag & Drop zone in the card modal — single or multiple files at once.
14. As a member, I want to import designs from Google Drive or OneDrive directly onto a card (same cloud connections as PROJ-11).
15. As a member, I want approved designs to auto-sync to the workspace's configured Google Drive / OneDrive folder, so there's always a cloud backup.

### Design Lifecycle
16. As a member, I want rejected designs moved to Soft-Delete Trash (still visible in Trash view for 30 days). After 30 days, auto-deleted by cleanup cronjob.
17. As a member, I want to restore a design from Trash within 30 days if I change my mind.
18. As a member, I want Round 2+ to show previous round's winner designs as reference: "Round 1 Winner: [thumbnail]. Create variants based on this?"

### Comments & Feedback
19. As a member, I want a Card-Level comment thread in the modal for general niche discussion (e.g. "This niche is trending right now, prioritize!").
20. As a member, I want a Design-Level comment thread per design in the carousel for specific feedback (e.g. "@Lisa contrast too low on Design 3").
21. As a member, I want @Mentions in comments — typing `@` shows workspace member autocomplete. Mentioned user gets In-App notification.

### Assignments & Notifications
22. As a member, I want to assign a niche card to a team member (designer, researcher). Assignee avatar shown on card.
23. As a member, I want to be notified (In-App notification bell) when: I'm assigned a niche, my design is approved/rejected, I'm @mentioned in a comment, a card I'm assigned to changes status.
24. As a member, I want a Notification Bell in the TopBar with unread count badge. Click opens notification list with links to relevant cards.

### Chat Integration (PROJ-17)
25. As a member, I want a "Discuss" button in the card modal that opens the Chat panel (PROJ-17) with this niche as preloaded context, so I can brainstorm or web-search about this niche.

### Agent Integration (PROJ-18)
26. As a member, I want the Agent's actions visible on the board — when the Agent moves a card, a mini-event appears: "🤖 Chief moved to Design".
27. As a member, I want the Agent to leave comments on cards: "Research completed. 3 patterns found. Recommend slogan adaptation." visible in the card-level thread with Agent avatar.
28. As a member, I want the Agent to update card status as part of its workflow (e.g. Full Pipeline moves niche through Research → Design → Publish automatically).

## Acceptance Criteria

### Models

- [ ] AC-1: `Niche` model amendment (PROJ-5): add `current_round` PositiveIntegerField (default=1). "New Round" sets `current_round += 1` and `status = to_designer`.
- [ ] AC-2: `Idea`, `DesignAsset`, `Listing` models: add `round` PositiveIntegerField (default=1) FK-like field matching `Niche.current_round` at creation time.
- [ ] AC-3: `NicheComment` model: UUID pk, `niche` FK (on_delete=CASCADE), `design` FK (DesignAsset, nullable — null = card-level, set = design-level), `author` FK (User, nullable — null for Agent comments), `agent_type` (CharField 50, blank=True — "orchestrator", "research" etc. for Agent comments), `content` (TextField), `mentions` (JSONField, default=list — list of mentioned user IDs), `created_at`.
- [ ] AC-4: `Notification` model: UUID pk, `workspace` FK, `recipient` FK (User), `type` choices [assignment, approval, rejection, mention, status_change, agent_action], `title` (CharField 200), `message` (TextField), `link` (URLField — deep link to card/design), `is_read` (BooleanField, default=False), `source_user` FK (User, nullable), `source_agent_type` (CharField 50, blank=True), `created_at`.
- [ ] AC-5: `DesignTrash` model: UUID pk, `design` FK (DesignAsset), `deleted_by` FK (User), `deleted_at` DateTimeField, `expires_at` DateTimeField (deleted_at + 30 days). Cronjob deletes expired entries + actual files.

### Board API

- [ ] AC-6: `GET /api/niches/?page_size=200` — existing endpoint, used for board. No separate board endpoint needed.
- [ ] AC-7: Board distributes niches into 5 columns by mapping status to column group. Frontend logic.
- [ ] AC-8: `PATCH /api/niches/{id}/` with `{status: "new_status"}` — drag & drop triggers status update. Optimistic UI, revert on failure.
- [ ] AC-9: `POST /api/niches/{id}/new-round/` — increments `current_round`, sets `status = to_designer`. Returns updated niche.

### Card Modal API

- [ ] AC-10: `GET /api/niches/{id}/designs/?round=X` — designs for specific round (or all if no round param).
- [ ] AC-11: `POST /api/niches/{id}/designs/upload/` — multipart upload, single or multiple files. Creates DesignAsset rows linked to niche + current_round.
- [ ] AC-12: `POST /api/niches/{id}/designs/import-drive/` — import from Google Drive / OneDrive onto card.
- [ ] AC-13: `PATCH /api/designs/{id}/` — approve/reject design. On approve: trigger cloud sync if configured.
- [ ] AC-14: `DELETE /api/designs/{id}/` — soft delete → moves to DesignTrash. Design hidden from card but restorable.
- [ ] AC-15: `POST /api/designs/{id}/restore/` — restore from trash.
- [ ] AC-16: `GET /api/niches/{id}/rounds/` — returns round summaries: per round, count of slogans, designs (total/approved/rejected), listings, uploads, winners.

### Comments API

- [ ] AC-17: `GET /api/niches/{id}/comments/` — all card-level comments. `?design_id=X` for design-level comments.
- [ ] AC-18: `POST /api/niches/{id}/comments/` — create comment. Body: `{content, design_id (optional), mentions: [user_ids]}`. Creates Notification for each mentioned user.
- [ ] AC-19: `DELETE /api/niches/{id}/comments/{comment_id}/` — author or admin can delete.
- [ ] AC-20: Agent comments created via internal service call (not API) — `agent_type` set, `author` null.

### Notifications API

- [ ] AC-21: `GET /api/notifications/` — list user's notifications, ordered by created_at desc. `?is_read=false` for unread only.
- [ ] AC-22: `PATCH /api/notifications/{id}/` — mark as read.
- [ ] AC-23: `POST /api/notifications/mark-all-read/` — mark all unread as read.
- [ ] AC-24: Notification count endpoint: `GET /api/notifications/unread-count/` — returns `{count: 5}` for TopBar badge.

### Cloud Sync

- [ ] AC-25: On design approval: if workspace has Google Drive or OneDrive connected (from PROJ-11 OAuth), auto-upload the approved design file to configured folder. Async django-rq job.
- [ ] AC-26: Sync failure → log error, do not block approval. User notified: "Cloud sync failed for Design X. Retry in Settings."

### Trash Cleanup

- [ ] AC-27: Cronjob (daily): query `DesignTrash` where `expires_at < now()` → delete actual files + DB records.
- [ ] AC-28: `GET /api/designs/trash/` — list trashed designs for workspace. Shows: design name, deleted by, deleted at, expires at.

### Frontend

- [ ] AC-29: 5-column Kanban board with drag & drop (dnd-kit). Cards distributed by status group mapping.
- [ ] AC-30: Card shows: thumbnail (first design or placeholder), niche name, assignee avatar (32px), exact status chip (color-coded), round badge, compact counts (💡5 🎨3 📋1).
- [ ] AC-31: Card-click opens full-screen MUI Dialog/Modal with: Design-Carousel (horizontal), Approve/Reject/Feedback buttons per design, Card-level + Design-level comment threads, Round history + summaries, Product Lifecycle chain, "New Round" button, "Discuss" → Chat, Upload zone (Drag & Drop).
- [ ] AC-32: Notification Bell in TopBar: unread count badge, click opens dropdown with notification list, click notification → navigates to card modal.
- [ ] AC-33: @Mention autocomplete in comment input: type `@` → dropdown with workspace members.
- [ ] AC-34: Agent actions styled differently in comments and board events: agent avatar emoji + display_name (from PROJ-18 AgentConfig), distinct color/style.
- [ ] AC-35: Assignee filter dropdown on board header.
- [ ] AC-36: "Archived" toggle on board header (default: hidden).

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/niches/{id}/new-round/` | Member | Start new round |
| GET | `/api/niches/{id}/designs/` | Member | List designs (filterable by round) |
| POST | `/api/niches/{id}/designs/upload/` | Member | Upload designs to card |
| POST | `/api/niches/{id}/designs/import-drive/` | Member | Import from cloud storage |
| PATCH | `/api/designs/{id}/` | Member | Approve/reject design |
| DELETE | `/api/designs/{id}/` | Member | Soft delete → trash |
| POST | `/api/designs/{id}/restore/` | Member | Restore from trash |
| GET | `/api/designs/trash/` | Member | List trashed designs |
| GET | `/api/niches/{id}/rounds/` | Member | Round summaries |
| GET | `/api/niches/{id}/comments/` | Member | List comments |
| POST | `/api/niches/{id}/comments/` | Member | Create comment |
| DELETE | `/api/niches/{id}/comments/{id}/` | Member | Delete comment |
| GET | `/api/notifications/` | Member | List notifications |
| PATCH | `/api/notifications/{id}/` | Member | Mark as read |
| POST | `/api/notifications/mark-all-read/` | Member | Mark all read |
| GET | `/api/notifications/unread-count/` | Member | Unread count for badge |

## Edge Cases

- [ ] EC-1: Drag to same column → no PATCH, no UI change.
- [ ] EC-2: PATCH fails (network error) → revert card to original column, error snackbar.
- [ ] EC-3: 200+ niches in workspace → cap at 200 with warning "Showing first 200 niches."
- [ ] EC-4: New Round on a niche in "Research" column → not allowed, niche must be in "Done" column. Button disabled with tooltip.
- [ ] EC-5: Designer uploads 20 designs at once → all created as DesignAsset rows, all appear in carousel. Progress indicator during upload.
- [ ] EC-6: Cloud sync fails (Drive token expired) → approval succeeds, sync retried. Admin notified to reconnect Drive.
- [ ] EC-7: Design in Trash restored after 29 days → restored successfully, linked back to niche/round.
- [ ] EC-8: @Mention a user not in workspace → autocomplete only shows workspace members, impossible to mention non-members.
- [ ] EC-9: Agent moves card while user is dragging → conflict resolution: last write wins, user sees card jump to Agent's target column with notification.
- [ ] EC-10: Comment on a design that gets trashed → comment preserved in trash view, hidden from active view.
- [ ] EC-11: Round 3+ → all rounds visible in round history. Carousel shows only active round by default, toggle to see previous rounds.
- [ ] EC-12: Niche with 0 designs → card shows placeholder thumbnail, upload zone prominent in modal.

## Dependencies

- PROJ-4 (Workspace & Membership — workspace FK, member roles)
- PROJ-5 (Niche List — status values, PATCH endpoint, `current_round` amendment)
- PROJ-9 (Design Generation — DesignAsset source)
- PROJ-11 (Publish — Google Drive / OneDrive OAuth, Product Lifecycle)
- PROJ-17 (Chat — "Discuss" button integration)
- PROJ-18 (Agent — Publishing Agent tools, Agent comments/events on board)
- dnd-kit (already in frontend dependencies)

## Amendments to PROJ-5 (Niche List)

### Round System
- Add `current_round` PositiveIntegerField (default=1) to `Niche` model.
- `POST /api/niches/{id}/new-round/` endpoint (new).
- Niche List view: show round badge per niche row.
- Drawer: round toggle (Round 1 / Round 2 / All) for filtering designs, slogans, keywords, listings.
- Product Lifecycle visible in Drawer: Niche → Slogan → Design → Listing → ASIN → Sales per round.

## Future Enhancements

- Browser Push Notifications + Email Digests
- Real-time board updates via Supabase Realtime / WebSocket (currently: manual refresh)
- Board swimlanes (group by assignee horizontally)
- Card priority/urgency indicators
- Time tracking per status (how long in each column)
- Bulk card operations (select multiple → assign / archive / move)
