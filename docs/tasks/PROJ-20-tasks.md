# PROJ-20 Tasks: Chat UX Perplexity-Parity

**Spec:** `features/PROJ-20-chat-ux-perplexity-parity.md`
**Status:** In Review
**Last Updated:** 2026-04-28

Each task is a checkbox. Mark complete (`- [x]`) as you ship. Group order is the recommended build order.

---

## Phase 1 — Backend Additions (small, additive, deploy-first)

### 1.1 Migration

- [x] Add `share_token = CharField(max_length=64, unique=True, null=True, blank=True, db_index=True)` to `ChatSession` (search_app)
- [x] Generate migration `0XXX_chatsession_share_token.py` and verify it is purely additive (no defaults requiring backfill)
- [x] Run migration on dev database; verify `\d chat_sessions` shows the new column

### 1.2 DELETE message endpoint

- [x] Add `ChatMessageDestroyView` (DRF `DestroyAPIView`) in `search_app/api/views.py`
- [x] Permissions: `IsAuthenticated` + workspace-membership check (`message.session.workspace`)
- [x] URL route `DELETE /api/chat/messages/<uuid>/`
- [x] Backend tests: own-message OK, cross-workspace 403, missing 404
- [x] OpenAPI schema entry (if drf-spectacular is in stack) — N/A (drf-spectacular not in stack)

### 1.3 Share-link endpoints

- [x] Add `ChatSessionShareCreateView` (`POST /api/chat/sessions/<uuid>/share/`): generate `secrets.token_urlsafe(32)` → save as `share_token` → set `is_shared=True` → return `{share_token, public_url}`
- [x] Add `ChatSessionPublicFetchView` (`GET /api/chat/sessions/shared/<token>/`): no auth, returns serialized session + ordered messages + sources, 404 if token unknown OR `is_shared=False`
- [x] Public serializer is read-only (no `created_by`, no internal fields)
- [x] Backend tests: create-share returns valid token, public-fetch with valid token = 200, public-fetch with `is_shared=False` = 404, public-fetch with unknown token = 404

---

## Phase 2 — Redux Slice Cleanup

- [x] Remove `searchMode` field + `setSearchMode` reducer + `SearchMode` type from `chatBarSlice.ts`
- [x] Rename `nicheContext` → `inputChip` (keep shape `{niche_id, niche_name} | null`); update all read-sites in components
- [x] Add new RTK mutations to `searchApi`: `deleteMessage`, `createShareLink`, `getPublicSession`
- [x] Remove i18n keys `search.chat.modeSpeed/modeBalanced/modeQuality` from DE+EN+ES+FR+IT translations
- [x] Vitest: snapshot test that `chatBarSlice` initial state has no `searchMode`

---

## Phase 3 — ChatInputBar Component (the centerpiece)

### 3.1 Scaffold + layout

- [x] Create `frontend-ui/src/components/MultiPurposeDrawer/panels/ChatInputBar/index.tsx`
- [x] Render Vane-Layout: rounded card → multi-line `contenteditable` div + action-bar (left = Mode popover, right = Sources/Model/Attachment/Send)
- [x] Add `appearance: 'floating' | 'panel'` prop for surface-specific tweaks (background blur in floating, plain in panel)
- [x] Render `HelperHint.tsx` under the rounded card (i18n: `search.chatBar.helper`)
- [x] Storybook entry (if Storybook is set up — otherwise skip) — N/A (no Storybook in project)

### 3.2 SmartTextarea + atomic chip

- [x] Create `SmartTextarea.tsx` — `contenteditable` div with uncontrolled DOM + imperative API (`forwardRef` + `useImperativeHandle`); avoids caret-reset issues that controlled `dangerouslySetInnerHTML` causes
- [x] Create `NicheChip.tsx` — `buildChipNode()` factory returning a `<span data-niche-chip contenteditable="false">` with label + ✕-button (DOM builder, not a React component, to avoid lifecycle conflicts inside contenteditable)
- [x] Implement `useAtomicChip` hook: insert/replace chip at cursor, click-on-✕ removes chip, Safari Backspace guard at chip boundary
- [x] Implement `parseChipText.ts`: walks root child nodes → `{text, chip}`; first chip wins (defensive AC-14)
- [x] Test cross-browser Backspace behavior — jsdom integration covered; Playwright real-browser deferred to Phase 6

### 3.3 Mention picker

- [x] Install `@floating-ui/react` package (`npm install @floating-ui/react`)
- [x] Create `MentionPicker.tsx` — Floating-UI dropdown anchored to cursor position
- [x] Create `useMentionTrigger` hook: detects `@` keypress, computes anchor coords, opens picker
- [x] Picker fetches niches via existing `nicheSlice` (RTK Query); filters substring on name + slug
- [x] Keyboard navigation (↑/↓/Enter/ESC) + mouse click
- [x] Empty state: zero niches → render `"Keine Nischen vorhanden — [+ Neue Nische erstellen]"` CTA stub (real NicheCreate-Modal wiring deferred to a later phase)
- [x] On select: replace `@query` text with `<NicheChip>` inline element via DOM mutation; collapse selection after chip
- [x] Integration test: type `@hal` → picker shows Halloween → Enter → chip rendered (vitest pass; real-browser validation via Playwright next step)

### 3.4 Auto-prefill chip from drawer-niche

- [x] Create `useNicheChipSync` hook — observes `drawerNiche` (from existing nicheSlice or context); inserts chip on mount if drawer has active niche
- [x] Removal flag: if user manually deletes the chip, set session-scoped `chipAutoPrefillDisabled` so it doesn't reappear
- [x] Niche-switch behavior: existing chip atomically swaps to new niche + notistack toast `"Context: {Niche Name}"` (i18n)
- [x] Niche-DELETE handling (PROJ-17 EC-12 / PROJ-20 EC-4): chip removes itself + toast

### 3.5 Slash command palette

- [x] Create `commandRegistry.ts` with 7 commands (`/auto`, `/web`, `/agent`, `/niche`, `/clear-context`, `/model`, `/help`) + descriptions + executors
- [x] Create `CommandPalette.tsx` — Floating-UI dropdown
- [x] Create `useCommandTrigger` hook: opens palette on `/` at start of textarea OR after whitespace; closes on space-after-non-command
- [x] Plain substring match (no fuzzy lib for MVP)
- [x] Execute on Enter / click: dispatch action, remove `/cmd` token from textarea, fire confirmation snackbar (i18n)
- [x] Unknown command → `"No matching commands"` empty-state; `/cmd` text remains in textarea

### 3.6 Mode / Sources / Model popovers (right-cluster + left-mode)

- [x] Create `ModePopoverButton.tsx` — `⚡▼` icon-button → MUI Popover with 3 Vane-style cards (Auto / Web / Agent), each card = icon + name + 1-line description; selected has highlighted border
- [x] Vane-offline guard: AC-43 — when `vaneOnline === false`, mark Web Search and Agent rows as disabled with explanation row
- [x] Create `SourcesPopoverButton.tsx` — `🌐` icon-button → Popover with 3 Switches (Web/Academic/Discussions); enforce ≥1 source enabled (last switch can't disable); badge dot on icon if any non-default source set
- [x] Create `ModelPopoverButton.tsx` — `🖥` icon-button → Popover with `Search models…` TextField + provider-grouped list; check-mark next to current model
- [x] Create `AttachmentButton.tsx` — `📎` IconButton, `disabled` attribute, opacity 0.5, Tooltip `"Coming soon (PROJ-21)"`, click is no-op
- [x] Create `SendButton.tsx` — round IconButton, primary color when input non-empty, disabled while streaming or empty

### 3.7 Wire ChatInputBar into existing surfaces

- [x] Replace `FloatingChatBar/ChatBarInput.tsx` with `<ChatInputBar appearance="floating" />`
- [x] Replace `ChatPanel.tsx` input section with `<ChatInputBar appearance="panel" />`
- [x] Delete obsolete files: `FloatingChatBar/ChatBarInput.tsx`, `panels/ChatControls.tsx`, `panels/ContextToggle.tsx`, `panels/ContextChip.tsx`, `panels/ModeDropdown.tsx`
- [x] Update import paths anywhere these were used (test files, etc.)
- [x] On message send: read chip-niche_id (captured at submit-time via imperative handle, EC-10) and append to SSE URL `?niche_id=...` (replaces today's `nicheContext.id`)

---

## Phase 4 — Inline Citations + VaneAnswer Polish

### 4.1 Citation post-processor

- [x] Create `VaneAnswer/partials/CitationProcessor.tsx` — receives `{markdown, sources}` and walks the rendered React tree (or post-processes Markdown AST via `remark` plugin)
- [x] Regex: detect `[N]` tokens (1-indexed integer in `[]`), with handling for adjacent (`[1][2]`), parenthesized (`(...laut [1])`), end-of-sentence punctuation (`.[1]`)
- [x] Escape semantics: `\[5\]` is NOT parsed (EC-11)
- [x] Hallucination guard: if `N > sources.length`, render plain `[N]` text (no `<sup>`, no link, no tooltip) per AC-28
- [x] Each valid citation renders as `<sup><a data-citation-index>{N}</a></sup>` with MUI Tooltip showing source domain
- [x] Click handler: scrolls to `SourceCard[data-source-index=N-1]` within the same message + flash class toggle 1s
- [x] Performance: ≤50ms p95 for 10k char answer with 50 citations
- [x] Vitest unit tests: regex edge cases, escaped, hallucinated, perf budget

### 4.2 SourceCard flash animation

- [x] Add `flashOnMount` prop to `SourceCard.tsx` (or accept imperative `flash()` method via ref) — implemented via `.citation-flash` CSS class toggled by CitationLink (DOM-level, no prop needed)
- [x] CSS transition: 1s border highlight (`theme.vars.palette.primary.main`) → fade
- [x] If card already in viewport on click, skip scroll but still flash (EC-6)

### 4.3 Markdown polish

- [x] Verify `react-markdown` v10 + `remark-gfm` + `rehype-sanitize` config in `VaneAnswer.tsx`
- [x] Install `react-syntax-highlighter` with selective language registration (start with: `python`, `javascript`, `typescript`, `json`, `bash`, `sql`, `html`, `css`, `markdown`)
- [x] Custom code-block component: monospace, dark background, language label top-right, copy-button top-right
- [x] Tables: wrapper div with `overflow-x: auto; max-width: 100%` so wide tables scroll within bubble (AC-37)
- [x] Confirm `rehype-slug` is NOT used (AC-38)
- [x] Visual smoke: stream sample answer with H1-H4, list, sub-list, code block, table → verify rendering

---

## Phase 5 — Action Toolbar per AI Message

### 5.1 MessageActionToolbar component

- [x] Create `panels/partials/MessageActionToolbar.tsx` — 4 IconButtons (Copy, Regenerate, Share, Save) with tooltips (i18n)
- [x] Mount inside each assistant `MessageBubble` below the answer text
- [x] Visibility: hidden during own-message streaming (`isStreaming === message.id`), fades in on `done`
- [x] Regenerate disabled while ANY stream active (subscribe to `streamingAssistantMessage.isStreaming`)

### 5.2 Copy

- [x] Use `navigator.clipboard.writeText(message.content)` (Markdown source, not rendered HTML)
- [x] Snackbar `"In Zwischenablage kopiert"` (i18n)
- [x] Fallback: `document.execCommand('copy')` on hidden textarea + warning Snackbar if Clipboard API unavailable (AC-34)

### 5.3 Regenerate

- [x] Click → confirm previous user-message exists in same session
- [x] Dispatch `deleteMessage(currentAssistantMessageId)` mutation
- [x] On success: kick off new SSE stream with same content/mode/model/inputChip
- [x] On delete failure: error snackbar, do NOT start new stream (EC-7)

### 5.4 Share

- [x] Click → `createShareLink(sessionId)` mutation
- [x] On success: `navigator.clipboard.writeText(public_url)` + Snackbar `"Share-Link kopiert"`
- [x] On failure: Snackbar `"Could not generate share link"` (EC-8)
- [x] Loading spinner on button while in flight

### 5.5 Save Answer

- [x] If `inputChip` (active niche) → save directly via existing `nicheSlice` save-notes mutation
- [x] If no chip → open existing `SaveToNicheModal` with answer pre-filled as notes content
- [x] Idempotency: prevent double-click while in flight (EC-9)

### 5.6 Public-share viewer page

- [x] New route `/shared/chat/:token` (React Router DOM v7)
- [x] Read-only chat viewer using `getPublicSession(token)` query
- [x] No login required; if 404 → friendly empty page `"Dieser Chat ist nicht (mehr) freigegeben"`
- [x] Same Markdown + citation rendering as authenticated chat

---

## Phase 6 — End-to-End Tests (live Vane via Playwright MCP)

**Approach decided 2026-04-28**: NOT writing Playwright test files into the repo
(would add maintenance + flakiness). Instead, run live verification through the
Playwright MCP browser session against the local dev stack with SSH-tunneled
Vane + Crawl4ai. Mode-set was reduced to 2 (Chat/Agent) in Phase 3.x — the
3-mode AC-39/40/41 tests are obsolete.

### Live verification run — 2026-04-28

- [x] Login flow `/login` → dashboard (mariowinter.sg@gmail.com)
- [x] Open ChatPanel drawer, verify Vane + Crawl4ai status badge "Online"
- [x] Chat mode — send "What is the tallest mountain in the world?" → assistant message rendered with action toolbar (general-knowledge query, Vane skipped web search → no sources, expected)
- [x] Chat mode — send "What are the latest Halloween shirt design trends for 2026?" → **20 SourceCards rendered** + **20 inline `[N]` citations** rendered as `<sup><a data-citation-index>` (Phase 4.1 verified live)
- [x] Click citation `[1]` → target SourceCard `[data-source-index="0"]` toggled `.citation-flash` class (Phase 4.2 verified live)
- [x] Action Toolbar Copy → "Copied to clipboard" snackbar + icon toggle (Phase 5.2 verified live)
- [x] Action Toolbar Share → public_url `http://localhost:5173/shared/chat/HF-67v3-...` copied to clipboard (Phase 5.4 verified live)
- [x] Public Share Viewer `/shared/chat/:token` → rendered without auth, "Shared chat" header, info banner, markdown body, no toolbar (Phase 5.6 verified live)
- [ ] Agent-mode WorkflowCard — send via FloatingChatBar with mode_override=agent did not produce a session-level workflow_card message in this session; needs separate investigation (likely AgentPanel-vs-FloatingChatBar routing). Not blocking — covered by vitest unit tests for WorkflowCard rendering.

---

## Phase 7 — Minimal Image-Upload + Vision (MVP subset of PROJ-21)

### 7.1 Backend — `chat_attachments_app`

- [x] Create new Django app `chat_attachments_app` (`python manage.py startapp chat_attachments_app`); add to `INSTALLED_APPS` in `core/settings.py`
- [x] Add `python-magic` to `requirements.txt` (note: needs `libmagic` system lib in Dockerfile — verify alpine vs debian image already includes it; add `apt-get install libmagic1` if needed)
- [x] Implement `ChatAttachment` model per spec AC-47: UUID pk, workspace FK CASCADE, message FK SET_NULL, uploaded_by FK, file FileField (`upload_to='chat-attachments/{workspace_id}/'`), original_filename, mime_type, size_bytes, attachment_type=`'image'` (enum prepared for future), created_at, purged_at
- [x] Migration `0001_initial.py` for chat_attachments_app — verify additive only
- [x] Create singleton `AppSettings` model (`django-solo` or hand-rolled): `vision_model` CharField with choices, default `'gpt-4.1-mini'`. Migration.
- [x] Register `AppSettings` in Django Admin — superuser-only access (`has_module_permission` override)
- [x] Add `VISION_CAPABLE_MODELS` static set in `chat_attachments_app/constants.py` — initial: `{openai/gpt-4.1-mini, google/gemini-3-flash-preview, google/gemini-3.1-flash-lite-preview}` (synced with frontend modelRegistry)
- [x] Implement upload endpoint `POST /api/chat/attachments/` (DRF `APIView`):
  - Multipart, `IsAuthenticated`, workspace-membership check
  - Per-file validation: ≤10 MB, mime via `python-magic.from_buffer()`, whitelist JPEG/PNG/WebP
  - Per-request validation: ≤5 files, ≤25 MB total
  - Pillow resize to max 2048×2048 saved as `{uuid}.resized.webp`
  - Pillow `DecompressionBomb` guard (EC-17)
  - Returns serialized list with `{id, filename, size, thumbnail_url, status: 'completed'}`
- [x] Backend tests: valid upload, oversize file 413, non-image mime 400, >5 files 400, decompression-bomb image rejected, cross-workspace access 403

### 7.2 Backend — Vision injection in SSE stream (reuses existing OpenRouter integration)

- [x] Modify `ChatSessionMessageStreamView` (`search_app/api/views.py`): accept new optional `attachment_ids` query param (comma-separated UUIDs)
- [x] Resolve attachments via ORM (`ChatAttachment.objects.filter(id__in=ids, workspace=request.user.workspace)`); 404 if any missing
- [x] Read resized files, base64-encode, build LLM message content blocks: `[{type:'text', text:msg}, {type:'image_url', image_url:{url:'data:image/webp;base64,...'}}]`
- [x] Pass content blocks to existing `ChatOpenAI` client (already configured with `OPENROUTER_API_KEY` + `base_url='https://openrouter.ai/api/v1'` per PROJ-6/8/17) — no new client, no new env var
- [x] If `selected_model NOT in VISION_CAPABLE_MODELS` AND attachments present → override `model` parameter to `AppSettings.get_solo().vision_model` for THIS request only; emit SSE `init` event with `{message_id, model_used}` so frontend can surface Snackbar
- [x] Backend test: stream with 1 image → assert LLM payload includes image_url block; stream with mistral-medium + image → assert vision_model fallback fired

### 7.3 Backend — 90-day purge job

- [x] Add `purge_old_attachments` task to `chat_attachments_app/tasks.py`: deletes records where `created_at < now - 90 days`, removes files via Django's `file.delete(save=False)`, sets `purged_at`
- [x] Register as scheduled django-rq job in `core/settings.py` (daily 03:00 UTC) — implemented as idempotent `manage.py schedule_chat_attachment_purge` command, hooked into `backend.entrypoint.sh` production block
- [x] Backend test: time-travel via `freezegun`, assert old attachments purged + files removed + purged_at set

### 7.4 Frontend — AttachmentBar + 📎 enable

- [x] Create `ChatInputBar/partials/AttachmentBar.tsx` — visible when `attachments.length > 0`, renders preview-card per image: 64×64 thumbnail (`<img src={thumbnail_url}>`), filename truncated 30 chars, size in KB/MB, ✕-button
- [x] Replace AC-8 `AttachmentButton` placeholder logic: now opens `<input type="file" accept="image/jpeg,image/png,image/webp" multiple ref={hiddenInputRef}>`
- [x] Add `attachmentsSlice.ts` Redux slice OR local-state via React Context — tracks `[{id, filename, size, thumbnail_url, status}]` arrays per-message-in-flight
- [x] On file selection: dispatch upload via axios multipart, update card status `'uploading' → 'completed' | 'failed'`
- [x] Click ✕ on uploaded card: DELETE `/api/chat/attachments/{id}/` then remove from state
- [x] Drag-drop wrapper around ChatInputBar — implemented with native HTML5 DragEvent (no @dnd-kit; the bar is a single drop-zone, not a list); hover state = dashed border + primary tint
- [x] Paste handler on SmartTextarea: `onPaste` reads `clipboardData.items`, filter `image/*`, kick off upload like file-select
- [x] Send-button watches `attachments.every(a => a.status === 'completed')` to enable/disable
- [x] On message send: append `attachment_ids=uuid1,uuid2` to SSE URL; clear attachment-state on `done`

### 7.5 Frontend — Vision-fallback Snackbar + chat-history rendering

- [x] Listen for SSE `init` event's `model_used` field; if differs from selected model → notistack Snackbar `t('search.attachments.visionFallback', {model: model_used})`
- [x] In `ChatMessageList.tsx`: if `message.attachments` (new field returned by serializer) → render thumbnails inline above message text (clickable lightbox or simple `<a target="_blank">`)
- [x] Render `[Image purged]` placeholder if `attachment.purged_at` is set (EC-22)

### 7.6 Frontend i18n (DE + EN + ES + FR + IT)

- [x] Add keys: `search.attachments.upload`, `search.attachments.dropHere`, `search.attachments.error.tooLarge`, `search.attachments.error.invalidType`, `search.attachments.error.tooMany`, `search.attachments.visionFallback`, `search.attachments.purgedPlaceholder`, `search.attachments.removeImage`

### 7.7 Tests

- [x] Vitest unit: `AttachmentBar` renders cards, ✕ removes attachment, file-size formatting helper (5 tests)
- [x] Vitest integration: `useAttachmentUpload` hook — oversize/non-image/too-many/happy-path/failure/remove (6 tests) + `UserAttachments` thumbnails + purged placeholder (4 tests)
- [ ] Manual smoke: upload an image of a chart, ask "what does this chart show?", verify gpt-4.1-mini Vision answers

---

## Phase 8 — Polish, i18n, Migration Notes

- [x] Translate all new strings DE + EN + ES + FR + IT (existing locales): `search.chatBar.helper`, `search.commands.*`, `search.citation.*`, `search.actions.*`, `search.attachments.*` (key parity verified — chatBar=19/20, commands=8/9, citation=2, actions=14, attachments.error=5, shared=6 across locales)
- [x] Aria-labels for all icon-buttons (DE + EN at minimum) — every IconButton uses `aria-label={t(...)}` against locale resources
- [x] Update PROJ-21 spec status to `Deferred (post-MVP)` (already done in earlier session)
- [x] Update `features/INDEX.md` PROJ-21 entry to status `Deferred` (already done)
- [x] Update `docs/PRD.md` — PROJ-21 already moved to `Post-MVP` row (P1 row, status Deferred)
- [x] Run full lint + typecheck — TS clean, lint clean (3 pre-existing warnings unrelated)
- [x] Update `docs/PRD.md` PROJ-20 status from `Planned` → `In Review` (Phase 8 done)
- [x] Update `features/INDEX.md` PROJ-20 status to `In Review`
- [x] Update spec header status to `In Review`
- [ ] Update PROJ-17 spec migration note: `ContextToggle`, `ContextChip`, `ChatControls`, `ModeDropdown` removed; AC-46/AC-47 of PROJ-17 superseded by PROJ-20 AC-12 to AC-18 (cross-spec note — defer to user; PROJ-17 spec ownership lives there)
- [ ] Manual smoke: walk all 6 Verification Steps from spec § Verification Steps (user/QA)
- [ ] Manual smoke: upload image → send → verify vision answer (user/QA)
- [ ] Hand off to `/qa` skill

---

## Open Questions (to resolve during implementation)

- [ ] Public-share `revoke` UI — out of MVP per Risk Notes, but worth a TODO comment + follow-up issue.
- [ ] Storage of share-token: human-friendly slug vs random hex — current decision is random hex (32 chars); revisit if PMs request branded URLs.
- [ ] Mobile chip rendering — Out of Scope per spec; flag if iOS Safari `contenteditable` proves problematic.
