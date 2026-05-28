# Tasks — FIX: Chat Bugfixes + Grouping + Canvas Color-Picker

> Spec: [`features/FIX-chat-bugfixes-and-grouping.md`](../../features/FIX-chat-bugfixes-and-grouping.md)
> Branch: `fix/chat-bugfixes-and-grouping`
> Merge: `--merge` (preserve conventional commits)
>
> Each Phase = one Item from the spec = one commit. Run skills phase-by-phase with a hard scope lock. Orchestrator commits after review (memory `feedback_phase_by_phase_skill_invocation`). Do NOT chain phases in one skill invocation.

> **Phase order changed 2026-05-28 (review pass):** Item 4 (Niche persistence) moved BEFORE Item 2 (Web-Search Fallback) so the Retry button in Item 2 can recover `niche_id` from the persisted `referenced_niche_id` on the prior user message. Spec implementation-order table updated accordingly.

> **Final phase order:** Item 1 → Item 3 → **Item 4** → Item 5 → Item 6 → **Item 2** → Item 7 → Item 8 → QA + Merge.

---

## Phase 1 — Item 1: SSE → POST Streaming Refactor (foundation)

**Commit:** `refactor(chat): switch SSE stream from GET to POST + AbortController-based stop`
**Skills:** `/backend` first, then `/frontend`. No commit between sub-phases.

### Backend
- [x] Add `ChatStreamRequestSerializer` in `django-app/search_app/api/serializers.py` (fields: `content`, `mode_override?`, `niche_id?`, `attachment_ids?`, `model?`). — serializers.py:288-313
- [x] Add `post(self, request, session_id)` method to `ChatSessionMessageStreamView` in `django-app/search_app/api/views.py`; refactor existing GET to share an internal `_stream(self, validated, session_id, workspace_id)` helper. — views.py:738-758, 760-842, 844-end
- [x] Mark GET handler with deprecation docstring `# Deprecated 2026-05-28: use POST. Removal planned next release.` — views.py:739
- [x] Verify `core/settings.py CORS_ALLOW_HEADERS` includes `Content-Type` AND `X-Workspace-Id` (the new POST needs both on the preflight). If missing, add. — already present via corsheaders `default_headers` ('content-type') + explicit 'x-workspace-id' at settings.py:50
- [x] Verify `CORS_ALLOW_METHODS` includes `POST` (it should — verify). — covered by django-cors-headers `default_methods` (includes POST); no override set in settings.py
- [x] Add pytest `test_post_streams_init_chunk_done_sequence` in `django-app/search_app/tests/test_chat_session_message_stream_view.py` mirroring the existing GET happy-path test. — test_chat_session_message_stream_view.py:782-857
- [x] Backend `ruff check` + `pytest django-app/search_app/tests/test_chat_session_message_stream_view.py` green. — 13 passed, ruff clean

### Frontend
- [x] Add internal helper `parseSSEStream(response, dispatchEvent, onClose)` inside `frontend-ui/src/hooks/useSendMessageStream.ts` (or a sibling `sseStreamParser.ts` if preferred). — useSendMessageStream.ts:175-209
- [x] Replace `new EventSource(url, { withCredentials })` with `fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': workspaceId }, body: JSON.stringify(args), signal })`. — useSendMessageStream.ts:520-528
- [x] **Explicit task: pull `activeWorkspaceId` from `s.workspace.activeWorkspaceId` (or equivalent selector) and pass into the fetch headers.** If the selector path differs, find it via grep in `searchSlice.ts` or `workspaceSlice.ts`. — useSendMessageStream.ts:238-239, 324-327, 525
- [x] **401 handling — replicate the axios interceptor behavior, since fetch bypasses it:**
  - [x] Before SSE parsing begins, check `response.status === 401`. If so, dispatch the existing `authSlice` logout action AND `window.location.href = '/login'` (match axios interceptor pattern — find it in `frontend-ui/src/services/api.ts` or equivalent). — useSendMessageStream.ts:545-554
  - [x] If a 401 happens MID-stream (rare — token expires while streaming), the reader will surface it as a network error; the existing `connectionLost` snackbar path handles it. No additional logic needed. — useSendMessageStream.ts:575-584 (mid-stream errors fall through `parseSSEStream` rethrow into the generic connectionLost path)
- [x] Replace module-scoped `activeEventSource: EventSource | null` with `activeAbortController: AbortController | null`. — useSendMessageStream.ts:225
- [x] Rename `eventSourceRef` to `abortControllerRef`; preserve all other refs (`chunkBufferRef`, `flushScheduledRef`, `silenceTimerRef`, `isStreamingRef`, `rafIdRef`). — useSendMessageStream.ts:242-251
- [x] Route all SSE event types (`init`, `sources`, `chunk`, `stage`, `heartbeat`, `tool_call`, `tool_result`, `tool_timeout`, `chunks_used`, `generate_slogans_payload`, `follow_ups`, `done`, `error`) through the new dispatcher map; keep Redux dispatches identical 1:1. — useSendMessageStream.ts:372-512 (handleEvent switch)
- [x] Update `stop()` to call `abortControllerRef.current?.abort()` AND the existing `closeStream()`. — useSendMessageStream.ts:311-315
- [x] Handle `AbortError` inside `parseSSEStream` → exit cleanly without error snackbar. — useSendMessageStream.ts:200-204
- [x] Handle network-level errors → `clearStreamingMessage` + `connectionLost` snackbar + `onError?.()`. — useSendMessageStream.ts:532-540 (pre-stream fetch reject) + 575-584 (mid-stream parse reject)
- [x] Handle `!response.ok` pre-stream → parse body as JSON, surface `display_message` if present, no SSE parsing. — useSendMessageStream.ts:557-573
- [x] Rewrite `frontend-ui/src/hooks/__tests__/useSendMessageStream.test.tsx` to mock `fetch` + `ReadableStream` (use `new ReadableStream({ start(controller) { ... } })`); port all 13+ existing assertions. — useSendMessageStream.test.tsx:76-196 (MockStreamController + fetch stub), tests at lines 294-700.
- [x] Add new test: `fetch returns 401 → authSlice logout dispatched + redirect`. — useSendMessageStream.test.tsx:649-679
- [x] `npm run lint` + `npm run test:ci` green. — lint 0 errors (17 pre-existing warnings in untouched files); 1636 tests pass, 0 failures.

### Review checkpoint
- [ ] Manual smoke on `docker compose up`: send a 6 KB prompt → answer streams; click stop → abort works; reload page → no zombie streams.
- [ ] Manual smoke: kill the backend mid-stream → `connectionLost` snackbar appears.
- [ ] All AC-1-1..AC-1-16 boxes in spec ticked.

---

## Phase 2 — Item 3: Send → Stop Toggle

**Commit:** `feat(chat): toggle send button to stop while streaming`
**Skill:** `/frontend`

- [ ] Add `isStreaming: boolean` + `onStop: () => void` props to `SendButton.tsx`.
- [ ] **Wiring task — verify `useSendMessageStream` is mounted ABOVE the SendButton render tree** so the same hook instance owns both `start` and `stop`:
  - [ ] Today the hook is mounted in `ChatPanel.tsx` and `FloatingChatBar.tsx`. SendButton lives inside `ChatInputBar`, which is rendered by both.
  - [ ] Pass `stop` as a callback prop chain: `ChatPanel → ChatInputBar → SendButton.onStop`. Same wiring in `FloatingChatBar`.
  - [ ] Note: because Phase 1 introduced a module-singleton `activeAbortController`, calling `stop()` from any hook instance aborts the active stream regardless of which instance owns it. Wiring is still required so the button has SOMETHING to call.
- [ ] Read `isStreaming` from `chatBar` slice in `ChatInputBar/index.tsx` (already a selector path); pass to `SendButton`.
- [ ] Render `SendIcon` when `!isStreaming`; render `StopIcon` from `@mui/icons-material/Stop` when streaming.
- [ ] No transition between icon states (straight swap — avoid CSS transitions on the icon element).
- [ ] Add i18n key `search.stop.aria` (EN + DE).
- [ ] New test `frontend-ui/src/components/MultiPurposeDrawer/panels/ChatInputBar/partials/__tests__/SendButton.test.tsx`: renders SendIcon when not streaming, StopIcon when streaming, click invokes correct handler per state.
- [ ] Verify keyboard Enter while streaming is no-op (input disabled — already in place; spot-check it still is).
- [ ] `npm run lint` + `npm run test:ci` green.

### Review checkpoint
- [ ] Manual smoke: send → button flips to Stop → click stops the stream → button flips back to Send.
- [ ] Manual smoke: open FloatingChatBar AND ChatPanel both showing stream — only one Stop button is active at a time (module singleton).
- [ ] All AC-3-1..AC-3-9 boxes ticked.

---

## Phase 3 — Item 4: @Niche Persistence + History Render

> **Re-ordered before Item 2** so Phase 6 (Web-Search Fallback Retry) can read `referenced_niche_id` from the persisted user message.

**Commit:** `fix(chat): persist and render @niche reference on user messages`
**Skills:** `/backend` then `/frontend`. No commit between sub-phases.

### Backend
- [ ] Add `referenced_niche` FK to `ChatMessage` in `django-app/search_app/models.py`:
  - `models.ForeignKey('niche_app.Niche', on_delete=SET_NULL, null=True, blank=True, db_index=True, related_name='referenced_in_messages')`.
- [ ] `python manage.py makemigrations search_app` → creates `0009_chatmessage_referenced_niche.py`. Verify additive-only.
- [ ] In `ChatSessionMessageStreamView` POST handler (Phase 1) AND the legacy GET: read `niche_id`, validate same workspace, set `referenced_niche_id` on user `ChatMessage.objects.create(...)`. Assistant message stays `referenced_niche=None`.
- [ ] Cross-workspace `niche_id` → raise `ValidationError` 400 with `code='niche_not_in_workspace'`.
- [ ] Extend `ChatMessageSerializer`: add `referenced_niche_id` (UUIDField via `source='referenced_niche.id'`, read_only, allow_null) + `referenced_niche_name` (SerializerMethodField returning `obj.referenced_niche.title` or None).
- [ ] Extend list-endpoint queryset in `ChatSessionMessagesView` (or equivalent) with `.select_related('referenced_niche')` to avoid N+1.
- [ ] Grep for `SharedChatView` or `share_token`-protected serializer. If it returns `referenced_niche_id`/`referenced_niche_name`, strip them in the public serializer (workspace-private data must not leak via public share). If a separate `SharedChatMessageSerializer` exists, omit the new fields there.
- [ ] Pytest tests in `django-app/search_app/tests/test_chat_session_message_stream_view.py`:
  - `test_referenced_niche_persisted_on_user_message`
  - `test_referenced_niche_cross_workspace_rejected`
  - `test_chat_message_serializer_returns_referenced_niche_fields`
  - `test_shared_chat_view_strips_referenced_niche` (NEW — verify share-leak protection).
- [ ] `pytest django-app/search_app/tests/` green.
- [ ] `ruff check django-app/search_app/` green.

### Frontend
- [ ] Add `referenced_niche_id?: string | null` + `referenced_niche_name?: string | null` to `ChatMessage` in `frontend-ui/src/types/search.ts`.
- [ ] In `ChatMessageList.tsx`, user-row (`role === 'user'`) renders a read-only `NicheChip` ABOVE the `UserBubble` when `referenced_niche_name` is non-null. Check `NicheChip` API: if it requires `onRemove` or other input-bar-coupled props, add a `readOnly` mode OR create a lightweight `<HistoryNicheChip>` wrapper.
- [ ] Chip props: `label = referenced_niche_name`, `nicheId = referenced_niche_id`, `readOnly = true` (no click / remove / hover-lift).
- [ ] Aligned to right edge of MessageRow (matches `flex-direction: row-reverse` for user row).
- [ ] Add i18n key `search.history.referencedNicheAria` (EN + DE).
- [ ] Vitest `ChatMessageList.test.tsx`: fixture user message with `referenced_niche_name='Cats'` → chip rendered; null → no chip.
- [ ] `npm run lint` + `npm run test:ci` green.

### Review checkpoint
- [ ] Manual smoke: pin a niche → send message → reload → chip visible above user bubble in history.
- [ ] All AC-4-1..AC-4-18 + EC-4-1..EC-4-5 boxes ticked.

---

## Phase 4 — Item 5: Auto-Scroll

**Commit:** `fix(chat): auto-scroll on session open and during streaming when user at bottom`
**Skill:** `/frontend`

- [ ] Add `<div ref={bottomSentinelRef} aria-hidden="true" />` as last child of `ScrollContainer` in `ChatMessageList.tsx`.
- [ ] Set up `IntersectionObserver` in `useEffect` with `root = scrollContainerRef.current`, `rootMargin = '50px'`, threshold `0`; callback sets `userAtBottomRef.current = entry.isIntersecting`.
- [ ] On mount + on messages-empty-to-nonempty → `useLayoutEffect` calls `scrollContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'instant' })` (synchronous, pre-paint).
- [ ] On `activeSessionId` change: parent's React key ensures re-mount; AC above fires automatically.
- [ ] During streaming + userAtBottom → smooth scroll on rAF-coalesced chunk flush (extend existing `flushChunkBuffer` to also call `scrollTo({ top: scrollHeight, behavior: 'smooth' })` AFTER the dispatch when `userAtBottomRef.current === true`).
- [ ] On new persisted message arrival (messages array length grows outside streaming) + userAtBottom → smooth scroll once after paint (`useEffect` with `messages.length` dep).
- [ ] **EC-5-4 explicit task:** Verify "Load more" prepend path is detected (e.g. `prevMessagesLengthRef` decreases? No — pages append. Check actual implementation in `useInfiniteScroll`-like hook or pagination state) and does NOT trigger auto-scroll. Add a unit test asserting prepend → no scroll.
- [ ] `JumpToLatestButton` click → `scrollTo({ top: scrollHeight, behavior: 'smooth' })` AND `userAtBottomRef.current = true` (re-engage).
- [ ] Vitest: mount with 3 messages → scrollTop = scrollHeight - clientHeight after first paint; empty array → no scroll; mock observer + scroll-up → no auto-scroll on next chunk; new sessionId via re-mount → scroll re-applies.
- [ ] `npm run lint` + `npm run test:ci` green.

### Review checkpoint
- [ ] Manual smoke: open chat → bottom visible; receive new chunks → view follows; scroll up mid-stream → stays put + JumpToLatest visible; click JumpToLatest → returns to bottom + re-engages.
- [ ] Manual smoke: scroll to top, click "Load more" → no auto-scroll yank.
- [ ] All AC-5-1..AC-5-9 boxes ticked.

---

## Phase 5 — Item 6: Topbar Icon Style Alignment

**Commit:** `fix(ui): align topbar chat icon style with sibling icon buttons`
**Skill:** `/frontend`

- [ ] Locate chat IconButton via `grep -n "ChatBubble\|ChatIcon\|search-fab\|openChatPanel" frontend-ui/src/components/topbar/Topbar.tsx`. Note the file + line.
- [ ] Copy `size="small"` + the exact sx shape from `ColorModeToggle.tsx`.
- [ ] Icon color `theme.vars.palette.text.primary`.
- [ ] Hover background `theme.vars.palette.action.hover` (via sx).
- [ ] If a badge exists today (unread indicator), badge color uses `theme.vars.palette.primary.main`.
- [ ] No hardcoded hex/rgb anywhere in touched files (verify with `grep -E '#[0-9a-fA-F]{6}|rgba?\(' <touched_file>` → 0 hits).
- [ ] Visual smoke: light + dark mode side-by-side screenshot before/after.
- [ ] `npm run lint` green.

### Review checkpoint
- [ ] Manual smoke: topbar icon row visually consistent.
- [ ] All AC-6-1..AC-6-6 boxes ticked.

---

## Phase 6 — Item 2: Web-Search Fallback (Frontend)

> **Re-ordered after Item 4** so Retry has access to `referenced_niche_id` on the prior user message.

**Commit:** `fix(chat): surface friendly fallback when web search is unavailable`
**Skill:** `/frontend`

- [ ] Extend `useSendMessageStream.ts` `error` event handler: detect `data.error === 'web_search_unavailable'`.
- [ ] Add module-scoped `seenWebSearchFallbackSessions: Map<string, Set<string>>` or a per-hook `useRef<Set<string>>` to dedupe info-variant snackbar per `activeSessionId`. Reset on session-id change.
- [ ] Add i18n keys (EN + DE):
  - `search.fallback.webSearchUnavailable.title`
  - `search.fallback.webSearchUnavailable.body`
  - `search.fallback.webSearchUnavailable.retry`
- [ ] Extend `ChatMessageList.tsx` `ErrorBubble` render: when `message.message_type === 'error'` AND `message.content` matches the i18n body translation → render a small `RetryButton` next to the error text.
- [ ] **Retry button — recover original args from the prior user message in the same session** (the message right above this error bubble in the `messages` array):
  - [ ] `content = priorUserMessage.content`
  - [ ] `niche_id = priorUserMessage.referenced_niche_id` (available from Phase 3, Item 4)
  - [ ] `model = priorUserMessage.model_used` (existing field)
  - [ ] `mode_override = priorUserMessage.search_mode` (existing field)
  - [ ] Pass via `useSendMessageStream().start({ content, niche_id, model, mode_override })`.
- [ ] Vitest: `useSendMessageStream.test.tsx` — error with marker fires snackbar once; second occurrence with same session id does not re-fire; new session id re-arms.
- [ ] Vitest: `ChatMessageList.test.tsx` — ERROR bubble with body matching `web_search_unavailable.body` key renders Retry button; clicking it calls `start` with args reconstructed from the prior user message fixture (including `referenced_niche_id`).
- [ ] `npm run lint` + `npm run test:ci` green.

### Review checkpoint
- [ ] Manual smoke (with mocked backend marker): trigger fallback → snackbar fires once, pill + Retry visible; click Retry → new turn with same niche.
- [ ] All AC-2-1..AC-2-7 boxes ticked.

---

## Phase 7 — Item 7: Chat Groups (Full Feature)

**Commit:** `feat(chat): add chat groups with drag-and-drop reorder in sidebar`
**Skills:** `/backend` then `/frontend`. NO commit between sub-phases — single feature commit at end.

### Backend — Model & Migration
- [ ] Add `ChatGroup` model to `django-app/search_app/models.py` per spec AC-7-1 (full field list, unique constraint on `(workspace, name)`, composite index on `(workspace, ordering)`).
- [ ] Add `group` FK + `group_ordering` PositiveIntegerField to `ChatSession` per AC-7-2.
- [ ] **Note: extending `ChatSession.Meta.ordering = ['group_ordering', '-updated_at']` changes default sort for ALL existing queries.** Add explicit task: grep for queries using default ordering (e.g. `ChatSession.objects.filter(...)` without `.order_by(...)`) and verify behavior. Document any callers that relied on `-updated_at` alone.
- [ ] Add composite index `chatsess_group_ordering_idx` over `(group, group_ordering)`.
- [ ] `python manage.py makemigrations search_app` → produces `0010_chatgroup_and_session_group.py`.
- [ ] Verify migration is additive only, reversible (`python manage.py migrate search_app 0009` rolls back cleanly in a fresh DB).

### Backend — Serializer
- [ ] Add `ChatGroupSerializer` in `django-app/search_app/api/serializers.py`: fields `id`, `name`, `ordering`, `created_at`, `updated_at`, `session_count` (read-only IntegerField).
- [ ] In `ChatGroupViewSet.get_queryset()`: annotate with `.annotate(session_count=Count('sessions'))` so the serializer reads it without an extra query per row.
- [ ] Extend `ChatSessionSerializer` with `group: UUIDField | None` (allow_null) and `group_ordering: IntegerField`.
- [ ] Update list queryset for sessions with `.select_related('group')` and explicit `.order_by('group_ordering', '-updated_at')`.

### Backend — ViewSet & URLs
- [ ] Add `ChatGroupViewSet(ModelViewSet)` with `CookieJWTAuthentication`, `IsAuthenticated`, workspace-scoped `get_queryset` using the existing `_get_workspace_id` helper pattern.
- [ ] CRUD endpoints (auto from `ModelViewSet`):
  - `GET /api/chat/groups/` (list)
  - `POST /api/chat/groups/` body `{ name }` → on `perform_create`, set `ordering = (max existing in workspace) + 1`, `created_by = request.user`.
  - `PATCH /api/chat/groups/<id>/` body `{ name }` → rename. Re-validates uniqueness in workspace.
  - `DELETE /api/chat/groups/<id>/` → CASCADE on `created_by`, SET_NULL on `ChatSession.group` (sessions fall back to NULL).
- [ ] Action endpoint `@action(detail=False, methods=['post'], url_path='reorder')` → `POST /api/chat/groups/reorder/` body `{ ordered_ids: list[UUID] }`. Inside `transaction.atomic`, validate all ids in current workspace, then `for i, gid in enumerate(ordered_ids): ChatGroup.objects.filter(id=gid).update(ordering=i+1)`. 400 if any foreign id.
- [ ] Action endpoint `@action(detail=False, methods=['post'], url_path='reorder-in-group')` on the existing `ChatSession` viewset (or a new dedicated endpoint) → `POST /api/chat/sessions/reorder-in-group/` body `{ group_id: UUID | null, ordered_ids: list[UUID] }`. Inside `transaction.atomic`, set `group=group_id, group_ordering=i+1` for each.
- [ ] Extend existing `ChatSession` PATCH to accept `group` (UUID or null) to move a single chat. On move: set `group_ordering = (max in destination) + 1` atomically.
- [ ] Register routes in `django-app/search_app/api/urls.py`.

### Backend — Tests
- [ ] `django-app/search_app/tests/test_chat_groups.py` new file:
  - `test_chatgroup_crud` (list / create / rename / delete, all workspace-isolated; foreign workspace ids → 403/404).
  - `test_chatgroup_reorder_atomic` (POST with mixed valid + foreign id → 400, no partial write — verify pre/post state).
  - `test_chatsession_reorder_in_group`.
  - `test_chatgroup_delete_sets_chats_to_null`.
  - `test_chatgroup_name_unique_per_workspace` (duplicate in same workspace → 400; duplicate across workspaces → OK).
  - `test_chatsession_default_ordering_change` (regression test for the Meta.ordering change — verify session list still feels right with NULL group + group_ordering=0).
- [ ] `pytest django-app/search_app/tests/test_chat_groups.py` green.
- [ ] `pytest django-app/search_app/tests/` full module green (no regressions from Meta.ordering change).
- [ ] `ruff check django-app/search_app/` green.

### Frontend — Types
- [ ] Add `ChatGroup` interface to `frontend-ui/src/types/search.ts` per AC-7-16.
- [ ] Extend `ChatSession` interface with `group: string | null`, `group_ordering: number`.

### Frontend — RTK Query
- [ ] Add `'ChatGroups'` to `searchApi.tagTypes`.
- [ ] Add endpoints in `frontend-ui/src/store/searchSlice.ts` per AC-7-18:
  - `getChatGroups`, `createChatGroup`, `renameChatGroup`, `deleteChatGroup`
  - `reorderChatGroups`, `moveChatToGroup`, `reorderChatsInGroup`
- [ ] Each reorder + move mutation: optimistic update via `updateQueryData('getChatSessions', undefined, draft => { ... })`; revert in `catch` + notistack error.

### Frontend — UI Components
- [ ] `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/GroupSection.tsx` (NEW).
- [ ] `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/UngroupedSection.tsx` (NEW).
- [ ] `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/SortableChatRow.tsx` (NEW).
- [ ] `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/hooks/useGroupCollapseState.ts` (NEW).
- [ ] `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/hooks/useChatGroupDnD.ts` (NEW).
- [ ] **NEW task: `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/ChatDragOverlay.tsx`** — `<DragOverlay>` from `@dnd-kit/core` renders a "ghost" preview of the currently-dragged chat row while the drag is active. Without this the DnD feels broken visually (the original element stays in place, no follow-the-cursor preview). Pattern: `useDndContext().active` returns the active drag item; the overlay reads it and renders a styled clone of `SortableChatRow`. Mount the overlay inside `DndContext` but as a separate component for clarity.
- [ ] Rewrite `RecentChats.tsx` panel: header "+ New group" + DndContext wrapping `UngroupedSection` + all `GroupSection`s + `ChatDragOverlay`.
- [ ] Inline create input: TextField + autofocus + Enter commit + Esc cancel. Duplicate-name error from backend → inline `<FormHelperText error>` under the input.
- [ ] Group kebab menu (Rename inline, Delete with confirm Dialog).
- [ ] All i18n keys per AC-7-29 (EN + DE).
- [ ] **i18n nuance task: `chat.groups.deleteConfirmBody` — drop the `{{ungroupedLabel}}` interpolation.** Translators can't infer the cross-reference. Hardcode "Ungrouped" / "Keine Gruppe" directly inside the EN + DE translation strings.

### Frontend — Tests
- [ ] `GroupSection.test.tsx` — expand/collapse, kebab items, badge count.
- [ ] `UngroupedSection.test.tsx` — no kebab, always first.
- [ ] `useChatGroupDnD.test.ts` — mock dnd-kit events → correct mutation per drop (same-group reorder, cross-group move, group reorder).
- [ ] `useGroupCollapseState.test.ts` — localStorage round-trip + missing key path + `QuotaExceededError` graceful fallback.
- [ ] `RecentChats.test.tsx` — full panel render + "+ New group" click → mutation fires.
- [ ] `ChatDragOverlay.test.tsx` — when no active drag → renders null; when active drag → renders a ghost clone with the right `data-test-id`.

### Frontend — Lint + Tests
- [ ] `npm run lint` + `npm run test:ci` green.

### Review checkpoint
- [ ] Manual smoke: create 2 groups, drag chats between them, reorder groups, rename group, delete group (chats fall back to Ungrouped), collapse a group, reload page → collapse state persists.
- [ ] Manual smoke: open in 2 browser tabs → reorder in tab 1 → tab 2 refetch shows new order on next interaction.
- [ ] All AC-7-1..AC-7-31 + EC-7-1..EC-7-12 boxes ticked.
- [ ] **Note: RQ workers restart is documented in the Final Phase, NOT here** (workers restart once at deploy time, not per-phase).

---

## Phase 8 — Item 8: Canvas Artboard Color Picker RGBA

**Commit:** `feat(canvas): rgba color picker with alpha slider for artboard background`
**Skill:** `/frontend`

- [ ] Add helper `frontend-ui/src/views/designs/board/utils/parseColorToRgba.ts` (NEW) — accepts rgba/hex6/hex8/fallback.
- [ ] Vitest `frontend-ui/src/views/designs/board/utils/__tests__/parseColorToRgba.test.ts` (NEW) — 4 input shapes covered.
- [ ] New component `frontend-ui/src/views/designs/board/partials/rightPanel/ArtboardColorPicker.tsx` (NEW):
  - Swatch button (32×32) with CSS checker-pattern background + color overlay.
  - MUI Popover with `RgbaStringColorPicker` from `react-colorful`, hex input (6 or 8 char), alpha-percent label.
  - Hex input shake on invalid (reuse `keyframes shake` pattern from `views/publish/partials/global/BackgroundColorPicker.tsx`).
  - Emits `rgba()` on every change.
- [ ] Vitest `ArtboardColorPicker.test.tsx` (NEW) per AC-8-16 (swatch click opens popover, alpha slider change emits new rgba, hex input accepts/rejects formats, checker-pattern element present).
- [ ] Replace native `<input type="color">` + TextField block in `PanelArtboardState.tsx` (lines 491-528) with `<ArtboardColorPicker />`.
- [ ] Remove orphan `handleBgColorChange` handler (lines 227-232).
- [ ] JSDoc on `ArtboardData.backgroundColor` (`frontend-ui/src/views/designs/board/types/index.ts:230`) updated: `/** Background color — accepts hex (#RRGGBB), hex8 (#RRGGBBAA), or rgba(R,G,B,A). */`.
- [ ] JSDoc on `BoardLayoutNode.backgroundColor?` (`frontend-ui/src/views/designs/board/types/index.ts:185`) updated to the same shape (the AI-skeleton layout type uses the same color string).
- [ ] **Konva renderer check — explicit file path:** `frontend-ui/src/views/designs/board/partials/ArtboardCanvas.tsx`. Grep for `backgroundColor` usage there. If a regex check rejects rgba (e.g. `^#[0-9a-fA-F]{6}$/`), relax to accept rgba and hex8. If no such check exists (Konva accepts rgba natively), no change needed.
- [ ] Add i18n keys per AC-8-15 (EN + DE).
- [ ] Manual visual smoke: set artboard to `rgba(0,0,0,0)` → workspace grid visible through; export PNG → open in macOS Preview → checkerboard pattern visible (= transparent alpha preserved).
- [ ] Manual visual smoke: set artboard to `rgba(255, 90, 79, 0.5)` (half-transparent primary red) → canvas shows red tint over workspace; swatch shows half-transparent overlay over checker.
- [ ] `npm run lint` + `npm run test:ci` green.

### Review checkpoint
- [ ] All AC-8-1..AC-8-18 + EC-8-1..EC-8-8 boxes ticked.

---

## Final Phase — QA + Merge

**Skills:** `/qa` then `/deploy`. No new commit unless QA finds bugs.

- [ ] `/qa` skill run: all AC + EC checkboxes ticked across all 8 items.
- [ ] Security audit: workspace isolation on all new endpoints (Items 4 + 7).
- [ ] Security audit: shared chat view does NOT leak `referenced_niche_id` (Item 4 EC-4-5).
- [ ] Full-tree lint: `npm run lint` (no `--max-warnings 0` regressions), `ruff check django-app/`.
- [ ] Full-tree tests: `npm run test:ci`, `docker compose exec web pytest`.
- [ ] Update `features/INDEX.md` status: `In Progress` → `In Review`.
- [ ] Update `features/FIX-chat-bugfixes-and-grouping.md` header status: `Planned` → `In Review`.
- [ ] Push branch + open PR with title `fix(chat): bugfixes + grouping + canvas color picker`.
- [ ] PR body: link spec + list each commit's conventional-type for reviewer scanning.
- [ ] After PR merged with `--merge`: branch auto-deleted; switch to main + pull + new branch for next work (memory `feedback_post_merge_branching`).
- [ ] **Post-deploy on prod: restart RQ workers** (Items 4 + 7 model changes — RQ workers don't hot-reload):
  - `docker compose restart worker worker-research worker-slogan worker-design worker-agent worker-search worker-scraper scheduler`
- [ ] Verify on prod: send long prompt (6 KB+) → no 400; create chat group → DnD works; set artboard transparent → export shows checker.

---

## Out of Scope (entire FIX — reminder for QA)
- Server-side SearXNG engine reconfiguration (Tor, Mojeek, Qwant — separate OPS ticket).
- Vane backend migration to Tavily/Serper/Brave Search API (separate PROJ).
- Backend emission of `web_search_unavailable` SSE marker (separate backend ticket).
- Persisting partial assistant message on Stop.
- Nested groups, M2M chat-groups, group icons/colors.
- Editor tool params alpha color picker (`ColorRemovalToolParams`, `WatermarkToolParams`).
- Mobile-responsive fixes (PROJ-30).
- WebSocket migration.
