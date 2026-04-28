# PROJ-20 Tasks: Chat UX Perplexity-Parity

**Spec:** `features/PROJ-20-chat-ux-perplexity-parity.md`
**Status:** In Progress
**Last Updated:** 2026-04-27

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

- [ ] Create `panels/partials/MessageActionToolbar.tsx` — 4 IconButtons (Copy, Regenerate, Share, Save) with tooltips (i18n)
- [ ] Mount inside each assistant `MessageBubble` below the answer text
- [ ] Visibility: hidden during own-message streaming (`isStreaming === message.id`), fades in on `done`
- [ ] Regenerate disabled while ANY stream active (subscribe to `streamingAssistantMessage.isStreaming`)

### 5.2 Copy

- [ ] Use `navigator.clipboard.writeText(message.content)` (Markdown source, not rendered HTML)
- [ ] Snackbar `"In Zwischenablage kopiert"` (i18n)
- [ ] Fallback: `document.execCommand('copy')` on hidden textarea + warning Snackbar if Clipboard API unavailable (AC-34)

### 5.3 Regenerate

- [ ] Click → confirm previous user-message exists in same session
- [ ] Dispatch `deleteMessage(currentAssistantMessageId)` mutation
- [ ] On success: kick off new SSE stream with same content/mode/model/inputChip
- [ ] On delete failure: error snackbar, do NOT start new stream (EC-7)

### 5.4 Share

- [ ] Click → `createShareLink(sessionId)` mutation
- [ ] On success: `navigator.clipboard.writeText(public_url)` + Snackbar `"Share-Link kopiert"`
- [ ] On failure: Snackbar `"Could not generate share link"` (EC-8)
- [ ] Loading spinner on button while in flight

### 5.5 Save Answer

- [ ] If `inputChip` (active niche) → save directly via existing `nicheSlice` save-notes mutation
- [ ] If no chip → open existing `SaveToNicheModal` with answer pre-filled as notes content
- [ ] Idempotency: prevent double-click while in flight (EC-9)

### 5.6 Public-share viewer page

- [ ] New route `/shared/chat/:token` (React Router DOM v7)
- [ ] Read-only chat viewer using `getPublicSession(token)` query
- [ ] No login required; if 404 → friendly empty page `"Dieser Chat ist nicht (mehr) freigegeben"`
- [ ] Same Markdown + citation rendering as authenticated chat

---

## Phase 6 — End-to-End Tests (live Vane)

- [ ] Confirm `tests/playwright/` exists; if not, scaffold per existing test patterns
- [ ] Add `e2e/chat/web-search-mode.spec.ts` per AC-39 (run `/web`, ask trends question, assert SourceCard, deep-crawl through statuses)
- [ ] Add `e2e/chat/agent-mode.spec.ts` per AC-40 (run `/agent`, deep-research query, assert WorkflowCard + stepper + Open-Command-Center link)
- [ ] Add `e2e/chat/auto-mode-routing.spec.ts` per AC-41 (factual → web; multi-step research → agent)
- [ ] Document SSH-tunnel requirement in `tests/playwright/README.md` (use `./scripts/dev-tunnel.sh -d`)
- [ ] CI config: skip `@live-vane`-tagged tests in CI (no live Vane there); run them manually pre-release

---

## Phase 7 — Minimal Image-Upload + Vision (MVP subset of PROJ-21)

### 7.1 Backend — `chat_attachments_app`

- [ ] Create new Django app `chat_attachments_app` (`python manage.py startapp chat_attachments_app`); add to `INSTALLED_APPS` in `core/settings.py`
- [ ] Add `python-magic` to `requirements.txt` (note: needs `libmagic` system lib in Dockerfile — verify alpine vs debian image already includes it; add `apt-get install libmagic1` if needed)
- [ ] Implement `ChatAttachment` model per spec AC-47: UUID pk, workspace FK CASCADE, message FK SET_NULL, uploaded_by FK, file FileField (`upload_to='chat-attachments/{workspace_id}/'`), original_filename, mime_type, size_bytes, attachment_type=`'image'` (enum prepared for future), created_at, purged_at
- [ ] Migration `0001_initial.py` for chat_attachments_app — verify additive only
- [ ] Create singleton `AppSettings` model (`django-solo` or hand-rolled): `vision_model` CharField with choices, default `'gpt-4.1-mini'`. Migration.
- [ ] Register `AppSettings` in Django Admin — superuser-only access (`has_module_permission` override)
- [ ] Add `VISION_CAPABLE_MODELS` static set in `chat_attachments_app/constants.py` — initial: `{'gpt-4.1-mini', 'gpt-4.1', 'claude-sonnet-4-20250514'}`
- [ ] Implement upload endpoint `POST /api/chat/attachments/` (DRF `APIView`):
  - Multipart, `IsAuthenticated`, workspace-membership check
  - Per-file validation: ≤10 MB, mime via `python-magic.from_buffer()`, whitelist JPEG/PNG/WebP
  - Per-request validation: ≤5 files, ≤25 MB total
  - Pillow resize to max 2048×2048 saved as `{uuid}.resized.webp`
  - Pillow `DecompressionBomb` guard (EC-17)
  - Returns serialized list with `{id, filename, size, thumbnail_url, status: 'completed'}`
- [ ] Backend tests: valid upload, oversize file 413, non-image mime 400, >5 files 400, decompression-bomb image rejected, cross-workspace access 403

### 7.2 Backend — Vision injection in SSE stream (reuses existing OpenRouter integration)

- [ ] Modify `ChatSessionMessageStreamView` (`search_app/api/views.py`): accept new optional `attachment_ids` query param (comma-separated UUIDs)
- [ ] Resolve attachments via ORM (`ChatAttachment.objects.filter(id__in=ids, workspace=request.user.workspace)`); 404 if any missing
- [ ] Read resized files, base64-encode, build LLM message content blocks: `[{type:'text', text:msg}, {type:'image_url', image_url:{url:'data:image/webp;base64,...'}}]`
- [ ] Pass content blocks to existing `ChatOpenAI` client (already configured with `OPENROUTER_API_KEY` + `base_url='https://openrouter.ai/api/v1'` per PROJ-6/8/17) — no new client, no new env var
- [ ] If `selected_model NOT in VISION_CAPABLE_MODELS` AND attachments present → override `model` parameter to `AppSettings.get_solo().vision_model` for THIS request only; emit SSE `init` event with `{message_id, model_used}` so frontend can surface Snackbar
- [ ] Backend test: stream with 1 image → assert LLM payload includes image_url block; stream with mistral-medium + image → assert vision_model fallback fired

### 7.3 Backend — 90-day purge job

- [ ] Add `purge_old_attachments` task to `chat_attachments_app/tasks.py`: deletes records where `created_at < now - 90 days`, removes files via Django's `file.delete(save=False)`, sets `purged_at`
- [ ] Register as scheduled django-rq job in `core/settings.py` (daily 03:00 UTC)
- [ ] Backend test: time-travel via `freezegun`, assert old attachments purged + files removed + purged_at set

### 7.4 Frontend — AttachmentBar + 📎 enable

- [ ] Create `ChatInputBar/partials/AttachmentBar.tsx` — visible when `attachments.length > 0`, renders preview-card per image: 64×64 thumbnail (`<img src={thumbnail_url}>`), filename truncated 30 chars, size in KB/MB, ✕-button
- [ ] Replace AC-8 `AttachmentButton` placeholder logic: now opens `<input type="file" accept="image/jpeg,image/png,image/webp" multiple ref={hiddenInputRef}>`
- [ ] Add `attachmentsSlice.ts` Redux slice OR local-state via React Context — tracks `[{id, filename, size, thumbnail_url, status}]` arrays per-message-in-flight
- [ ] On file selection: dispatch upload via axios multipart, update card status `'uploading' → 'completed' | 'failed'`
- [ ] Click ✕ on uploaded card: DELETE `/api/chat/attachments/{id}/` then remove from state
- [ ] Drag-drop wrapper around ChatInputBar using `@dnd-kit` `useDroppable` (already in stack); hover state = dashed border via styled component
- [ ] Paste handler on SmartTextarea: `onPaste` reads `clipboardData.items`, filter `image/*`, kick off upload like file-select
- [ ] Send-button watches `attachments.every(a => a.status === 'completed')` to enable/disable
- [ ] On message send: append `attachment_ids=uuid1,uuid2` to SSE URL; clear attachment-state on `done`

### 7.5 Frontend — Vision-fallback Snackbar + chat-history rendering

- [ ] Listen for SSE `init` event's `model_used` field; if differs from selected model → notistack Snackbar `t('search.attachments.visionFallback', {model: model_used})`
- [ ] In `ChatMessageList.tsx`: if `message.attachments` (new field returned by serializer) → render thumbnails inline above message text (clickable lightbox or simple `<a target="_blank">`)
- [ ] Render `[Image purged]` placeholder if `attachment.purged_at` is set (EC-22)

### 7.6 Frontend i18n (DE + EN + ES + FR + IT)

- [ ] Add keys: `search.attachments.upload`, `search.attachments.dropHere`, `search.attachments.error.tooLarge`, `search.attachments.error.invalidType`, `search.attachments.error.tooMany`, `search.attachments.visionFallback`, `search.attachments.purgedPlaceholder`, `search.attachments.removeImage`

### 7.7 Tests

- [ ] Vitest unit: `AttachmentBar` renders cards, ✕ removes attachment, file-size formatting helper
- [ ] Vitest integration: drag-drop adds image, paste adds image, oversize image shows error, send is disabled until upload completes
- [ ] Manual smoke: upload an image of a chart, ask "what does this chart show?", verify gpt-4.1-mini Vision answers

---

## Phase 8 — Polish, i18n, Migration Notes

- [ ] Translate all new strings DE + EN + ES + FR + IT (existing locales): `search.chatBar.helper`, `search.commands.*`, `search.citation.*`, `search.actions.*`, `search.attachments.*`
- [ ] Aria-labels for all icon-buttons (DE + EN at minimum) — AC accessibility section
- [ ] Update PROJ-17 spec to add a "PROJ-20 Migration" note: `ContextToggle`, `ContextChip`, `ChatControls`, `ModeDropdown` removed; AC-46/AC-47 of PROJ-17 superseded by PROJ-20 AC-12 to AC-18
- [ ] Update PROJ-21 spec status to `Deferred (post-MVP)` and add note that MVP image-vision shipped in PROJ-20
- [ ] Update `features/INDEX.md` PROJ-21 entry to status `Deferred`
- [ ] Update `docs/PRD.md` — move PROJ-21 from MVP-row to "Post-MVP" section
- [ ] Run full lint + typecheck — zero new errors
- [ ] Manual smoke: walk all 6 Verification Steps from spec § Verification Steps
- [ ] Manual smoke: upload image → send → verify vision answer
- [ ] Update `docs/PRD.md` PROJ-20 status from `Planned` → `In Review` when QA starts
- [ ] Hand off to `/qa` skill

---

## Open Questions (to resolve during implementation)

- [ ] Public-share `revoke` UI — out of MVP per Risk Notes, but worth a TODO comment + follow-up issue.
- [ ] Storage of share-token: human-friendly slug vs random hex — current decision is random hex (32 chars); revisit if PMs request branded URLs.
- [ ] Mobile chip rendering — Out of Scope per spec; flag if iOS Safari `contenteditable` proves problematic.
