# PROJ-20: Chat UX Perplexity-Parity

**Status:** Planned
**Priority:** P0 (MVP — UX-Polish on PROJ-17)
**Created:** 2026-04-26
**Last Updated:** 2026-04-26

## Overview

PROJ-17 shipped the functional chat (Vane streaming, Pattern B Hybrid, Source-Cards). PROJ-20 elevates the chat UX to **Perplexity-parity** by:

1. **Settings-Migration** — settings move from top of drawer into the input action-bar (Vane-Layout 1:1: ⚡ Mode left / 🌐 Sources, 🖥 Model, 📎 Image-Upload, ➤ Send right).
2. **`@`-Mention + `/`-Commands** — entity selection (`@niche`) + action commands (`/web`, `/agent`, `/clear-context`, `/help`, etc.) directly in the input.
3. **Inline Citations `[n]`** — clickable in answer text, scrolls to + flashes the matching SourceCard.
4. **Action-Toolbar per AI-Message** — Copy (Markdown), Regenerate, Share, Save Answer to Niche.
5. **Markdown-Rendering Polish** — verify code-blocks, tables, headings render production-grade.
6. **Web-Search & Deep-Research E2E** — Playwright tests proving Auto / Web-Search / Agent modes work against live Vane.
7. **Niche-Context as Inline-Chip** — atomic chip inside the input text (replaces today's `ContextToggle` switch).
8. **Minimal Image-Upload + Vision** (subset of PROJ-21, MVP-only) — `📎` accepts up to 5 images per message, sent to vision-capable model (default `gpt-4.1-mini`). Full RAG/PDF/CSV/URL attachment system deferred to PROJ-21.

`Speed / Balanced / Quality` mode is **removed** — model choice covers that axis.

PROJ-21 (Chat Attachments + RAG + Agentic) is **deferred to post-MVP**. PROJ-20 includes only the image-upload subset for MVP completeness.

## Dependencies

- PROJ-17 (Deep Web Search) — chat backbone, Vane integration, streaming, SourceCards, ChatPanel structure
- PROJ-5 (Niche List) — `@`-mention picker reads existing niches
- PROJ-18 (OpenClaw Agent) — `/agent` slash-command + Workflow-Cards
- PROJ-21 (Chat Attachments) — sibling spec; PROJ-20 only renders disabled 📎 placeholder

## User Stories

1. As a member, I want all chat settings inside the input area, so I don't lose vertical space or hunt for them while typing.
2. As a member, I want to type `@halloween` and pick a niche from a dropdown, so my question gets contextualised without leaving the input.
3. As a member, I want to type `/web` to switch to Web-Search mode, so power-user shortcuts replace mouse-clicks.
4. As a member, I want clickable `[1]` citations in the AI answer, so I can jump to the supporting source.
5. As a member, I want a Copy / Regenerate / Share / Save toolbar on every AI answer, so I can act on it without context-switching.
6. As a member, I want headings, bullets, code-blocks and tables to render properly in chat answers, so I can scan responses fast.
7. As a member, I want PROJ-17's Web-Search and Agent modes to be verified end-to-end via Playwright, so I trust the feature shipped.
8. As a member, I want a small helper line under the input (`@ Nischen · / Befehle · Shift+Enter neue Zeile`), so I discover the input shortcuts without docs.
9. As a member, I want my niche context shown as an atomic chip inside the input, so its presence is unambiguous and removable with one Backspace.
10. As a member, I want the chip to follow the niche I have open in the drawer, so context stays consistent when I switch topics.

## Acceptance Criteria

### Settings-Migration (Vane-Layout)

- [ ] AC-1: `ChatControls.tsx` (top-of-drawer settings panel) is **deleted** — its role is absorbed by the input action-bar.
- [ ] AC-2: `Speed / Balanced / Quality` Mode (`searchMode` slice field + UI) is **removed**. `chatBarSlice.ts` cleanup; type `SearchMode` removed.
- [ ] AC-3: New `ChatInputBar.tsx` component (in `MultiPurposeDrawer/panels/`) renders Vane-Layout 1:1:
  - Big rounded textarea with placeholder `"Frag mich was…"` (multi-line, Shift+Enter inserts newline, Enter submits)
  - Action-bar **inside** the rounded container, `display:flex justify-content:space-between`
  - **Left:** `⚡▼` Mode-Override icon-button (Auto / Web Search / Agent)
  - **Right cluster (in order):** `🌐` Sources, `🖥` Model-Picker, `📎` disabled-placeholder, `➤` Send
- [ ] AC-4: `ChatInputBar.tsx` is shared by `FloatingChatBar` (collapsible at bottom-center) and `ChatPanel` (inside drawer). Single source of truth — no duplicate input components.
- [ ] AC-5: `⚡▼ Mode-Override` button opens popover with the 3 options as Vane-style cards (icon + name + 1-line description). Selected mode shows highlighted; click outside closes popover.
- [ ] AC-6: `🌐 Sources` button opens popover with toggleable sources (Web / Academic / Discussions). Each row is a Switch. At least one source must stay enabled (cannot disable last). Badge on icon when ≥1 non-default source is active.
- [ ] AC-7: `🖥 Model-Picker` button opens popover with `Search models…` field + provider-grouped list (today: OpenRouter group with all `MODELS` from `ChatControls.tsx` data). Selected model marked with a check.
- [ ] AC-8: `📎 Attachment` button is **enabled** for image upload (MVP subset). Click opens hidden file-input filtered to `image/jpeg, image/png, image/webp`. Drag-drop and clipboard-paste also supported. See § "Minimal Image-Upload + Vision" below for full behavior.
- [ ] AC-9: `➤ Send` button is round, primary color when input non-empty, disabled while streaming or empty.
- [ ] AC-10: Helper-Text below the input-card (outside rounded container, 12px gray): `"@ Nischen · / Befehle · Shift+Enter neue Zeile"`. i18n via `search.chatBar.helper`.

### `@`-Mention Picker (Niche-Context)

- [ ] AC-11: Typing `@` inside the textarea opens an inline picker positioned at the cursor (Floating-UI). Picker shows up to 8 niches matching the typed query (substring + name + slug), keyboard-navigable (↑/↓ + Enter).
- [ ] AC-12: Selecting a niche replaces the typed `@query` token with an **atomic chip element** rendered inline in the textarea (e.g. `[@Halloween 26 ✕]`). Chip stores `{niche_id, niche_name}` as data attributes.
- [ ] AC-13: Backspace at the right edge of a chip deletes the **whole chip** atomically. Click on the `✕` removes the chip.
- [ ] AC-14: Multiple chips per message are NOT supported in MVP — only one niche-context chip per message. If user inserts a second `@`, picker still opens but selecting replaces the existing chip (not appends).
- [ ] AC-15: When user has Niche-Detail tab active in drawer, a chip is **auto-prefilled** at the start of the input (still removable). Removal disables auto-prefill for the rest of that session.
- [ ] AC-16: Empty Niches case: if the workspace has zero niches, picker shows `"Keine Nischen vorhanden — [+ Neue Nische erstellen]"`. CTA-button opens NicheCreate-Modal (existing component) inline; on success the new niche becomes the chip.
- [ ] AC-17: On message send, the chip's `niche_id` is sent as `niche_id` parameter (URL or body) to `/api/chat/sessions/{id}/messages/stream/`. Replaces the existing `nicheContext` Redux state path.
- [ ] AC-18: Niche-Switch in drawer while a chip is active → chip data updates to new niche AND notistack toast `"Context: {Niche Name}"` fires. Existing chip element is replaced (atomic swap, not append).

### `/`-Slash Commands

- [ ] AC-19: Typing `/` at the **start** of the textarea (or after a space) opens a command palette positioned at the cursor. Palette shows fuzzy-matched commands.
- [ ] AC-20: Initial command set:
  - `/auto` — switch Mode-Override to Auto
  - `/web` — switch Mode-Override to Web Search
  - `/agent` — switch Mode-Override to Agent
  - `/niche` — open `@`-mention picker (alias)
  - `/clear-context` — remove active niche-chip
  - `/model` — open Model-Picker popover
  - `/help` — show all commands as a small reference popup
- [ ] AC-21: Selecting a command **executes the action** (e.g. `/web` dispatches `setModeOverride('web_search')`) and removes the `/command` text from the input. Snackbar `"Mode: Web Search"` confirms.
- [ ] AC-22: Unknown command (e.g. `/foo`) → palette shows `"No matching commands"` empty-state. ESC or click-outside closes palette without modifying input. The typed `/foo` text remains in the input as plain text (deletable normally).
- [ ] AC-23: Slash-commands work in **both** FloatingChatBar and ChatPanel input (shared via `ChatInputBar.tsx`).
- [ ] AC-24: `/help` popup lists all commands in `react-markdown`-rendered table with description + example. Closes on ESC or click-outside.

### Inline Citations `[n]`

- [ ] AC-25: `VaneAnswer.tsx` (already exists) post-processes the streamed Markdown content: every `[N]` token (1-indexed integer) becomes a clickable React element rendered as `<sup><a>[N]</a></sup>` with hover-tooltip showing the source's domain.
- [ ] AC-26: Click on `[N]` scrolls smoothly to SourceCard at index N-1 in the same message; SourceCard's border flashes (1s, primary color, then fade). Implementation: `scrollIntoView({behavior: 'smooth'})` + brief CSS class toggle on the target card.
- [ ] AC-27: Hover on `[N]` shows MUI Tooltip with the source's `domain` only (lightweight; full preview is the SourceCard itself).
- [ ] AC-28: If `N` exceeds `sources.length` (LLM hallucination): the `[N]` token is rendered as **plain text** (not clickable, no tooltip, no `<sup>` formatting). Detection happens in the post-processor.
- [ ] AC-29: Citation parsing must handle adjacent citations (`[1][2]`), citations inside parentheses, and citations at end of sentences with punctuation (`.[1]`).

### Action-Toolbar per AI-Message

- [ ] AC-30: Below every assistant message bubble, render an action toolbar (4 IconButtons + tooltip per button):
  - 📋 Copy — copies answer as **Markdown** to clipboard. Snackbar `"In Zwischenablage kopiert"`.
  - 🔄 Regenerate — sends the previous user message again with same mode/model/niche-context. Replaces the current assistant message in-place.
  - 🔗 Share — generates a public-share-link via existing `SharedChat` model (`shared_chats` app, see PROJ-17 AC). Copies link to clipboard + Snackbar.
  - 💾 Save Answer — saves answer text as `notes` on a Niche (uses existing `SaveToNicheModal` if no niche-context active; else saves directly to active niche).
- [ ] AC-31: Toolbar is hidden during the assistant message's own streaming (`isStreaming === true`). Once `done` event fires, toolbar fades in (DURATION.default).
- [ ] AC-32: Regenerate-button is **disabled** while ANY stream is active (not just this message's). Tooltip `"Wait for current response to finish"`.
- [ ] AC-33: Save Answer without active niche → opens `SaveToNicheModal` (existing component, see PROJ-17 AC-53) — searchable niche picker, save as `notes`.
- [ ] AC-34: Copy uses `navigator.clipboard.writeText(markdownText)`. Fallback: if clipboard API unavailable, use `document.execCommand('copy')` on a hidden textarea + warning Snackbar.

### Markdown-Rendering Polish

- [ ] AC-35: `VaneAnswer.tsx` (already on `react-markdown` + `remark-gfm` + `rehype-sanitize`) is verified to render production-grade for: H1-H4 headings (consistent vertical rhythm), ordered/unordered lists with nesting, fenced code-blocks with **syntax highlighting** (add `react-syntax-highlighter` if not present), inline code, bold/italic, blockquotes, GFM tables (responsive scroll on overflow), links with `target="_blank" rel="noopener"`.
- [ ] AC-36: Code blocks render with: monospace font, dark background regardless of light/dark theme, language label top-right (e.g. "python"), copy-button top-right corner.
- [ ] AC-37: Tables overflow → horizontal scroll within message bubble, NOT page-wide scroll. CSS: `max-width: 100%; overflow-x: auto`.
- [ ] AC-38: Heading anchors disabled (`rehype-slug` NOT used) — chat answers don't need deep-links to sections.

### Web-Search / Deep-Research End-to-End

- [ ] AC-39: Playwright test `e2e/chat/web-search-mode.spec.ts` proves: open chat → type `/web` → ask `"latest Halloween shirt trends 2026"` → assert at least one Source-Card renders within 30s → click first source's `[Deep Crawl]` button → assert crawl status moves through `pending → running → completed` (max 60s) → assert message bubble updated with extracted Markdown content.
- [ ] AC-40: Playwright test `e2e/chat/agent-mode.spec.ts` proves: type `/agent` → ask `"deep research halloween niche"` → assert WorkflowCard renders inline → assert mini-stepper visible with at least 2 steps → ApprovalCard visible if approval gate triggered → "Open Command Center" link present and navigates to Agent Tab.
- [ ] AC-41: Playwright test `e2e/chat/auto-mode-routing.spec.ts` proves: type `/auto` (or default Auto) → ask short factual question → assert Web-Search mode kicked in (sources panel appears) → ask multi-step research question → assert Agent workflow kicked in (WorkflowCard appears).
- [ ] AC-42: All E2E tests use the **live** SSH-tunneled Vane (`localhost:3000`) — NOT mocks — so this verifies the full Django + Vane + LLM path. Skip-on-CI is acceptable; tests must pass locally.
- [ ] AC-43: Health-check banner: when Vane is offline, the `⚡▼` Mode-Override popover shows `"Web Search & Agent unavailable — Vane offline"` for the affected modes (disabled rows with explanation).

### Niche-Context Migration

- [ ] AC-44: `ContextToggle.tsx` and `ContextChip.tsx` (today in `MultiPurposeDrawer/panels/`) are **removed**. Their state moves into the chip-in-input pattern (AC-12 to AC-18).
- [ ] AC-45: `chatBarSlice.ts` `nicheContext` field is renamed to `inputChip` (or kept) and shape is `{niche_id: string, niche_name: string} | null`. Persisted unchanged.
- [ ] AC-46: All existing PROJ-17 ACs that reference `ContextToggle` (e.g. AC-46, AC-47 of PROJ-17) are superseded by PROJ-20 AC-12 to AC-18 — explicitly note in PROJ-17 spec changelog.

### Minimal Image-Upload + Vision (MVP subset of PROJ-21)

- [ ] AC-47: New Django app `chat_attachments_app` with minimal `ChatAttachment` model: UUID pk, `workspace` FK (CASCADE), `message` FK (`ChatMessage`, nullable, `on_delete=SET_NULL`), `uploaded_by` FK (User), `file` (FileField → `chat-attachments/{workspace_id}/{uuid}.{ext}`), `original_filename` (CharField 500), `mime_type` (CharField 100, populated from python-magic), `size_bytes` (BigInteger), `attachment_type` (only `'image'` choice for MVP — enum prepared for future PDF/CSV/etc.), `created_at`, `purged_at` (DateTimeField, nullable).
- [ ] AC-48: Upload endpoint `POST /api/chat/attachments/` (multipart): max **5 images per request**, ≤10 MB / image, ≤25 MB / total. Returns list of created records with status `completed` (synchronous validation in MVP — no async pipeline yet).
- [ ] AC-49: Mime + magic-byte validation via `python-magic` (NOT trusting Content-Type header). Whitelist: `image/jpeg`, `image/png`, `image/webp`. Reject with 400 + clear error if mime not whitelisted.
- [ ] AC-50: Image preprocessing on upload (`Pillow`): resize to max 2048×2048 preserving aspect ratio, save resized version alongside original (`{uuid}.resized.webp`). Original kept on disk; resized version sent to LLM. Reduces vision token cost ~4×.
- [ ] AC-51: New `AttachmentBar.tsx` component (in `MultiPurposeDrawer/panels/ChatInputBar/partials/`) renders above the input card when ≥1 attachment in flight or attached. Shows preview-card per image: 64×64 thumbnail, filename (truncated 30 chars), size in KB/MB, ✕-button to remove (deletes from server + state).
- [ ] AC-52: Drag-drop on the chat area (inside drawer or floating bar) uses `@dnd-kit` `useDroppable` (already in stack). Hover state: dashed border on input. Drop fires upload via the same endpoint.
- [ ] AC-53: Paste-from-clipboard: `onPaste` handler on the textarea reads `clipboardData.items`, filters image-types (`image/png`, `image/jpeg`), uploads via same endpoint. ⌘+V / Ctrl+V triggers when an image is in the clipboard.
- [ ] AC-54: Send-button is disabled while ANY attachment upload is still in flight. Once all uploads `completed` (or removed), Send re-enables.
- [ ] AC-55: SSE streaming endpoint accepts new optional `attachment_ids` query parameter (comma-separated UUIDs). Backend resolves attachments by ID, validates workspace ownership, and injects `image_url` content blocks (base64 or signed URL) into the LLM message in OpenAI/Anthropic-compatible format.
- [ ] AC-56: Vision-Model Admin Setting: new singleton model `AppSettings` with field `vision_model` (CharField, default `'gpt-4.1-mini'`, choices populated from a curated list of OpenRouter vision-capable models). Editable via Django Admin — superuser only. Read on every chat request that has image attachments. **Vision calls reuse the existing OpenRouter integration** (`langchain-openai` with `base_url`, already in stack via PROJ-6/8/17) — no new external service or API key required.
- [ ] AC-57: Smart model fallback: if user-selected `selectedModel` is NOT vision-capable AND attachments contain images → backend auto-routes to admin's `vision_model` for THIS message only. Frontend receives the override via SSE init event and surfaces a Snackbar `"Vision: switched to {vision_model} for image"`. User-selected model stays unchanged for next message.
- [ ] AC-58: 90-day auto-purge: daily django-rq scheduled job `purge_old_attachments` deletes `ChatAttachment` records (and their files) where `created_at < now - 90 days`. Sets `purged_at` on the record (kept as historical row).
- [ ] AC-59: Attachment-card in chat history (after send): the AI message bubble shows attached images as inline thumbnails (clickable for lightbox preview). Reuses `AttachmentBar` rendering in read-only mode.
- [ ] AC-60: ATTENTION/SCOPE: PDFs, CSV, Excel, URL-as-Attachment (Web/YouTube), RAG pipeline, Agentic tool-use, ClamAV virus-scanning, workspace-quotas — ALL deferred to PROJ-21 (post-MVP). MVP only ships images + vision.

## Edge Cases

- [ ] EC-1: User pastes a `@niche-name` literal text (no chip) and sends → backend treats it as plain text (no niche-context). Frontend does NOT auto-convert pasted text into chips.
- [ ] EC-2: User has chip active, deletes all other text → input is non-empty (chip counts as content), Send-button enabled.
- [ ] EC-3: User starts typing `@`, picker opens, then user clicks elsewhere (loses focus) → picker closes; the `@` character remains as plain text. No chip created.
- [ ] EC-4: Niche-DELETE while it's set as the active chip → next render, chip element gracefully removes itself (FK SET_NULL semantics) AND notistack toast `"Niche '{name}' was deleted — context cleared"` fires.
- [ ] EC-5: User scrolls up in chat history, clicks `[1]` on an old answer → smooth-scroll to that message's SourceCard (NOT a sibling message's). Citation lookup is scoped per-message.
- [ ] EC-6: SourceCard already in viewport when `[1]` clicked → no scroll, but flash animation still fires for visual confirmation.
- [ ] EC-7: Regenerate clicked → previous assistant message is **deleted** (DELETE `/api/chat/messages/{id}/`) before the new stream starts. Race-condition: if delete fails, do NOT start new stream; show error toast.
- [ ] EC-8: Share-link generation fails (backend down) → button shows brief loading spinner then error Snackbar `"Could not generate share link"`. No URL copied.
- [ ] EC-9: Save-Answer clicked twice rapidly → second click is no-op while first is in flight (button shows loading spinner).
- [ ] EC-10: User on slow connection, types message, hits Send → message + niche-chip data is captured **at send time** (not at network-arrival time). If user changes chip after Send but before stream init, the in-flight stream uses the OLD chip; the new chip applies to next message.
- [ ] EC-11: Markdown answer contains `\[5\]` (escaped) — should NOT be parsed as a citation. Escape semantics preserved.
- [ ] EC-12: Long answer with 50+ citations → all `[N]` tokens parsed; performance budget: ≤50ms post-processing for 10k chars.
- [ ] EC-13: Slash-command typed mid-message (e.g. `Was sind /web Trends?`) — `/` mid-text does NOT open palette (only at start or after space). User intent: regular text.
- [ ] EC-14: User has Mode-Override `Auto` and Vane is offline (health red dot) → Auto popover row shows the constraint, but `Auto` itself remains usable since LLM-only fallback path exists in PROJ-17 routing.
- [ ] EC-15: Floating-bar collapsed AND drawer chat open → only the drawer's `ChatInputBar` is visible (existing PROJ-17 hide logic respected).
- [ ] EC-16: User uploads non-image file (PDF, CSV, etc.) via picker or drag-drop → 400 error `"Only images supported in MVP. Full attachment support coming post-MVP."` (i18n).
- [ ] EC-17: Image dimensions extreme (50000×50000 PNG) → `Pillow.MAX_IMAGE_PIXELS` triggers DecompressionBomb warning → upload rejected with `"Image dimensions too large"`.
- [ ] EC-18: User uploads image, then changes selected model from vision-capable to non-vision (e.g. switches to a text-only model) BEFORE sending → on send, backend auto-routes to `vision_model` (AC-57) regardless of user's pick.
- [ ] EC-19: All attachments fail upload (mime/size/disk) → message can still be sent without attachments; warning Snackbar `"Bilder konnten nicht angehängt werden — Nachricht ohne Anhänge gesendet"`.
- [ ] EC-20: User removes attachment AFTER it was uploaded but BEFORE send → DELETE request fires to clean up the file on disk (no orphan files).
- [ ] EC-21: Two users in same workspace upload identical images (same hash) → no de-duplication in MVP; each upload = own row + own file. Storage cost minor.
- [ ] EC-22: Uploaded image references in old chat history when 90-day purge runs → `ChatAttachment` row kept (with `purged_at` set), but file deleted from disk. Frontend renders placeholder `[Image purged]` icon in lieu of thumbnail.

## Technical Requirements

- **Performance:**
  - Citation post-processing ≤50ms for 10k char answers
  - `@`-Mention picker autocomplete ≤100ms response on 500 niches
  - First-paint of new ChatInputBar ≤16ms after mount (no layout-shift on settings popover open)
- **Accessibility:**
  - All icon-buttons have `aria-label` translations (DE + EN)
  - `@` and `/` pickers fully keyboard-navigable (↑/↓/Enter/ESC)
  - Citations `<a>` have `aria-label="Quelle {N} öffnen"`
- **i18n:** All new user-visible strings via `useTranslation()`. New keys grouped under `search.chatBar.*`, `search.commands.*`, `search.citation.*`, `search.actions.*`.
- **Browser Support:** Chrome 110+, Firefox 110+, Safari 16+ (matches PROJ-17 baseline).
- **Tests:**
  - Vitest unit tests for chip-text parser, command palette, citation post-processor
  - Vitest integration tests for ChatInputBar (`@` open/close picker, `/` execute commands, chip atomic delete)
  - Playwright E2E for AC-39 / AC-40 / AC-41 (live Vane)

## New Packages

**Frontend:**
- `react-syntax-highlighter` (Markdown code-block highlighting — only if not already in dependency tree)
- `@floating-ui/react` (positioning for `@` and `/` pickers — likely not present, MUI's Popover is too heavy and positions to anchor element only)
- `fuzzysort` or similar (small fuzzy-match for command palette; ≤10kB) — optional, can use plain substring match

**Backend (for Image Vision MVP subset):**
- `python-magic` (mime detection from magic bytes — image upload validation)
- `Pillow` (already in stack via Django) — image preprocessing/resize
- `django-solo` (singleton AppSettings model — ~5 kB lib) OR hand-rolled singleton

## Out of Scope (deferred)

- **Full attachment system (PDF, CSV, Excel, URL/YouTube, RAG, Agentic tool-use)** → PROJ-21 (post-MVP). MVP includes only Image-Upload + Vision.
- ClamAV virus-scanning → PROJ-21
- Workspace storage quota → PROJ-21
- Branching of conversations on Regenerate → MVP replaces in-place
- Citation preview as modal (we chose Scroll+Flash)
- Auto-detection of `@niche-name` in pasted text (EC-1)
- Mobile-specific chip rendering optimizations
- Multi-image lightbox-gallery navigation in chat history (single thumbnail click only in MVP)
- Image OCR (we send to Vision model directly — Mistral OCR is in PROJ-21)

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Adopt Vane (Perplexica) input layout 1:1 | Don't reinvent — proven, modern, user prefers it |
| 2 | Remove `Speed/Balanced/Quality` Mode | Redundant with model-picker; cleaner UX, less choice fatigue |
| 3 | Both `@`-mention AND `/`-commands | Different intents (entities vs actions); modern chat tools support both (Slack, Linear, Notion) |
| 4 | Single niche-context chip per message (not multiple) | Backend `niche_id` is scalar today; multi-chip would require model + API changes |
| 5 | Citation click → scroll + flash SourceCard | Most Perplexity-like, keeps user in flow, no modal-overhead |
| 6 | Hallucinated citation `[N]` (N > sources) → render as plain text | Avoids broken UI; LLM error becomes invisible |
| 7 | Copy → Markdown only (not Plain or Sub-menu) | Single-action UX; Markdown works in Notion/Obsidian/etc. |
| 8 | Save-Answer without context → `SaveToNicheModal` | Reuse existing PROJ-17 component |
| 9 | Niche-Switch in drawer → chip auto-updates + toast | Matches user mental model that drawer-Niche = current focus |
| 10 | Attachments split into PROJ-21 | Single-Responsibility per CLAUDE.md; PROJ-20 ships in 2-3 weeks, PROJ-21 separately |
| 11 | Helper-Text under input | Discoverability for `@` and `/` without invading placeholder |
| 12 | Regenerate replaces message in-place (no branching) | MVP simplicity; branching is a separate UX (chat-trees) |
| 13 | PROJ-21 deferred to post-MVP; image-upload subset folded into PROJ-20 | User decision 2026-04-27 — MVP needs image-vision but full RAG is too big. Single PROJ-20 deploy ships UX-Parity + Image-Vision together. PROJ-21 spec preserved as post-MVP roadmap. |
| 14 | No ClamAV in MVP | Trust workspace members + mime/magic-byte validation enough for image-only MVP; ClamAV deferred to PROJ-21 (when PDF/CSV widen the attack surface). |
| 15 | No workspace quota in MVP | Per-image (10 MB) + per-message (5 images, 25 MB) caps are enough; workspace-level quota deferred to PROJ-21. |
| 16 | Smart vision-model fallback (auto-route per-message) | User flow: pick a cheap text-only model, attach image once → backend transparently uses vision model just for that message. Avoids forcing user to manually swap models. |
| 17 | 90-day purge for images (same as PROJ-21 plan) | Aligned retention policy — when PROJ-21 ships and purge logic is reused, no behavior change. |
| 18 | Vision calls reuse existing OpenRouter integration | No new SDK, no new env var, no new service. The same `langchain-openai` `ChatOpenAI` client with `base_url='https://openrouter.ai/api/v1'` already in PROJ-6/8/17 handles `image_url` content blocks natively. Net new code: just construct the multipart message. |

## Verification Steps

1. After implementation: visual diff of FloatingChatBar + ChatPanel against Vane screenshots provided in spec discussion
2. Manual smoke: type `@niche` → pick → send → verify Network panel shows `niche_id` query param
3. Manual smoke: type `/web` → assert Mode-Override switched to Web Search + Snackbar fired
4. Manual smoke: stream long answer with 5+ citations → click each → verify scroll + flash
5. Manual smoke: switch niche in drawer while chip active → verify chip updates + toast
6. Run all Playwright E2E (AC-39 / AC-40 / AC-41) against live Vane

---

<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### A) High-Level Approach

PROJ-20 is **frontend-heavy with a moderate backend layer** (UX shell + minimal image-attachments + vision integration):

1. **Frontend (~70% of work):** A unified `ChatInputBar` replaces today's split UI. Smart textarea handles atomic `@`-niche-chips + `/`-command palettes. `VaneAnswer` post-processor renders `[N]` citations. Action-toolbar attaches below each AI message. Settings (Mode/Sources/Model) move into Vane-style icon-popovers. New `AttachmentBar` renders image-preview cards above input.
2. **Backend (~30%):** Three workstreams:
   - **Tiny chat-API additions:** `DELETE /api/chat/messages/{id}/` (Regenerate flow), `POST /api/chat/sessions/{id}/share/` + `GET /api/chat/sessions/shared/{token}/` (Share-link + public read-only view).
   - **Image attachments (MVP subset of PROJ-21):** new app `chat_attachments_app`, `ChatAttachment` model (image-only), `POST /api/chat/attachments/` upload endpoint, `python-magic` validation, `Pillow` resize-to-2048, 90-day purge job, vision-content-block injection in SSE stream view.
   - **Admin-config singleton:** `AppSettings` model with `vision_model` field, editable via Django Admin (superuser-only).
3. **Removed code:** `ChatControls.tsx`, `ContextToggle.tsx`, `ContextChip.tsx`, `ModeDropdown.tsx`, `searchMode` Redux field, related i18n keys.

No new infrastructure services (no ClamAV, no S3, no extra workers). All file storage on existing `MEDIA_ROOT` Docker volume. Full RAG/PDF/CSV/URL features remain deferred to PROJ-21.

### B) Frontend Component Structure (Visual Tree)

```
MultiPurposeDrawer/
├── panels/
│   ├── ChatInputBar/                       NEW — shared input component
│   │   ├── index.tsx                       Outer rounded card + textarea + action-bar layout
│   │   ├── SmartTextarea.tsx               Contenteditable that handles atomic chips
│   │   ├── partials/
│   │   │   ├── ModePopoverButton.tsx       ⚡▼ Auto/Web Search/Agent (Vane-style cards)
│   │   │   ├── SourcesPopoverButton.tsx    🌐 Web/Academic/Discussions (Switches)
│   │   │   ├── ModelPopoverButton.tsx      🖥 Searchable model list with provider grouping
│   │   │   ├── AttachmentButton.tsx        📎 disabled placeholder (PROJ-21)
│   │   │   ├── SendButton.tsx              ➤ Round, primary, disabled when empty/streaming
│   │   │   ├── HelperHint.tsx              "@ Nischen · / Befehle · Shift+Enter neue Zeile"
│   │   │   ├── NicheChip.tsx               Atomic chip element rendered inside textarea
│   │   │   ├── MentionPicker.tsx           Floating-UI dropdown for @-niche autocomplete
│   │   │   └── CommandPalette.tsx          Floating-UI dropdown for /-action commands
│   │   ├── hooks/
│   │   │   ├── useAtomicChip.ts            Backspace + cursor logic for chip-as-token
│   │   │   ├── useMentionTrigger.ts        Detects `@` + cursor position, opens picker
│   │   │   ├── useCommandTrigger.ts        Detects `/` at start/after-space, opens palette
│   │   │   └── useNicheChipSync.ts         Auto-sync chip with drawer's active niche
│   │   ├── utils/
│   │   │   ├── parseChipText.ts            Serialize textarea content → {text, niche_id}
│   │   │   └── commandRegistry.ts          /auto, /web, /agent, /niche, /clear-context, /model, /help
│   │   └── tests/                          Vitest unit + integration
│   ├── VaneAnswer.tsx                      MODIFIED — adds CitationProcessor
│   ├── partials/
│   │   ├── CitationProcessor.tsx           NEW — converts [N] tokens → <sup><a>
│   │   ├── MessageActionToolbar.tsx        NEW — Copy/Regen/Share/Save buttons under AI msg
│   │   └── HelpCommandsPopup.tsx           NEW — /help command reference
│   ├── SourceCard.tsx                      MODIFIED — accepts `flashOnMount` prop
│   ├── ChatPanel.tsx                       MODIFIED — uses ChatInputBar, drops ChatControls
│   ├── ChatControls.tsx                    DELETED
│   ├── ContextToggle.tsx                   DELETED
│   ├── ContextChip.tsx                     DELETED
│   └── ModeDropdown.tsx                    REPLACED by ChatInputBar/partials/ModePopoverButton

components/FloatingChatBar/
├── index.tsx                               MODIFIED — uses ChatInputBar, drops local input
├── ChatBarInput.tsx                        DELETED (absorbed into ChatInputBar)
└── ChevronIndicator.tsx                    UNCHANGED
```

**Key principle:** the input-bar code lives in ONE place. The floating bar and drawer chat panel both import `ChatInputBar` and pass an `appearance` prop (`floating` vs `panel`) for surface-specific tweaks (background, padding).

### C) Redux State Changes

| Slice | Today | After PROJ-20 |
|---|---|---|
| `chatBarSlice.searchMode` | `'speed' \| 'balanced' \| 'quality'` | **REMOVED** (model-picker covers this axis) |
| `chatBarSlice.searchSources` | `('web' \| 'academic' \| 'discussions')[]` | **UNCHANGED** (still drives Vane request) |
| `chatBarSlice.selectedModel` | string | **UNCHANGED** |
| `chatBarSlice.modeOverride` | `'auto' \| 'web_search' \| 'agent'` | **UNCHANGED** |
| `chatBarSlice.nicheContext` | `{id, name} \| null` (set via ContextToggle) | **RENAMED** to `inputChip` — same shape; now driven by atomic chip in textarea |
| `chatBarSlice.streamingAssistantMessage` | full streaming state | **UNCHANGED** |
| `chatBarSlice.activeSessionId`, `barExpanded`, `drawerOpen`, `activePanel` | persisted UI state | **UNCHANGED** |

No new RTK Query endpoints for the streaming/session flow — existing `searchApi` covers it. Two **new** RTK mutations are added for the small backend additions:

| Mutation | Endpoint | Purpose |
|---|---|---|
| `deleteMessage` | `DELETE /api/chat/messages/{id}/` | Regenerate flow deletes previous AI msg first |
| `createShareLink` | `POST /api/chat/sessions/{id}/share/` | Returns `{share_token, public_url}` |

### D) Backend Additions (small)

| Endpoint | Method | Behavior |
|---|---|---|
| `/api/chat/messages/{id}/` | DELETE | Auth + workspace-membership check. Deletes the message + cascades any embeddings (PROJ-15 already handles this via signal). 204 on success. |
| `/api/chat/sessions/{id}/share/` | POST | Generates random `share_token` (uuid4 hex), persists to existing `ChatSession.share_token` field (NEW field on existing model). Returns `{share_token, public_url}`. 200 on success. |
| `/api/chat/sessions/shared/{token}/` | GET | **No auth required** (public). Returns full session + messages + sources as read-only JSON. 404 if token invalid or session not flagged shared. |

**Single migration:** add `share_token = CharField(max_length=64, unique=True, null=True, blank=True, db_index=True)` to `ChatSession`. Auto-fills on first share request.

### E) Data Model Changes

| Model | Field Added | Type | Purpose |
|---|---|---|---|
| `ChatSession` (search_app) | `share_token` | CharField(64, unique, null) | Public share-link token |

No other model changes. No new tables.

### F) Tech Decisions

| Decision | Why |
|---|---|
| One `ChatInputBar` component shared by floating bar + drawer panel | Avoid two divergent input UIs; PROJ-17 already had this duplication risk; one source of truth keeps `@` and `/` behavior identical everywhere |
| `contenteditable` div for the textarea (not raw `<textarea>`) | Native textarea cannot render atomic React elements (chips); `contenteditable` allows mixed text + JSX nodes that backspace deletes as whole tokens |
| `@floating-ui/react` for `@`-picker and `/`-palette positioning | MUI `Popper`/`Menu` always anchor to a DOM node, not to an arbitrary cursor position inside text; Floating-UI was built for this exact use case |
| Citation post-processor inside `VaneAnswer` (not a separate streaming layer) | Citations only need to render on the FINAL Markdown; streaming chunks don't need partial citation rendering — process once on `done` |
| Plain regex for citation `[N]` detection (not a full Markdown AST walker) | 50ms p95 budget on 10k-char answers favors fast regex over heavyweight AST visitors; `rehype-sanitize` already protects HTML escapes |
| Reuse PROJ-17's `SaveToNicheModal` for Save-Answer | Existing component already does niche search + create — no need to duplicate UX |
| Regenerate = DELETE + new stream (not branching) | Spec Decision #12 — MVP simplicity; chat-tree branching is its own UX |
| Share-link is a token on `ChatSession` (not a separate `SharedChat` model) | Single-row decision; matches PROJ-17 `is_shared` boolean already on the model; minimal migration |
| Helper-hint as a separate inline element (not the textarea placeholder) | Placeholder disappears on first keystroke; helper must persist for discoverability |
| `react-syntax-highlighter` for code blocks | The lightweight `prism-react-renderer` alternative loses some language coverage; this is the standard choice for Markdown chats |
| Plain substring match for command palette (no `fuzzysort`) | 7 commands + tiny matching set; no fuzzy library needed; keeps bundle small |
| Per-message citation lookup (not global by index) | A user scrolling old messages and clicking `[1]` should jump to that message's source #1, not the latest message's |
| Smooth-scroll + 1s flash class toggle for citation click | Native `scrollIntoView({behavior:'smooth'})` + CSS transition is enough — no animation library needed |

### G) New Dependencies

| Package | Purpose | Approx Bundle Cost |
|---|---|---|
| `@floating-ui/react` | Cursor-anchored positioning for `@` picker and `/` palette | ~12 kB gz |
| `react-syntax-highlighter` (with selective language imports) | Code-block syntax highlighting in chat answers | ~25 kB gz (tree-shaken) |

No backend dependencies (DELETE + share endpoints use only DRF + existing models).

### H) Test Strategy

| Layer | Coverage |
|---|---|
| Vitest unit | `parseChipText`, `commandRegistry`, citation regex, atomic-chip backspace logic |
| Vitest integration | `ChatInputBar` typed-`@` opens picker, picker keyboard navigation, chip insert/delete, `/` palette open/execute, citation post-process happy-path + EC-11 escaped + EC-12 50-citations perf, action-toolbar Copy/Save fires |
| Vitest hook | `useNicheChipSync` updates chip when drawer niche switches |
| Backend pytest | DELETE message permissions (own / cross-workspace 403 / 404), share-link create + public-fetch, public-fetch returns 404 if `is_shared=False` |
| Playwright E2E | AC-39 web-search mode, AC-40 agent mode, AC-41 auto-mode routing — all live Vane via SSH-tunnel |
| Manual smoke | Verification Steps 1-6 in spec |

### I) Deploy Strategy

PROJ-20 is **stateless on backend** (only adds 1 column + 3 endpoints); the migration is non-breaking.

| Step | Action |
|---|---|
| 1 | Backend: deploy migration (`add ChatSession.share_token`) — zero downtime, additive only |
| 2 | Backend: deploy DELETE + share endpoints — opt-in, no feature flag needed |
| 3 | Frontend: deploy `ChatInputBar` build — replaces existing input UI on first load |
| 4 | i18n: ship new translations (`search.chatBar.helper`, `search.commands.*`, `search.citation.*`, `search.actions.*`) DE + EN before frontend deploy |
| 5 | Smoke-test live: open chat, type `@`, type `/web`, send message, verify citations clickable, click Share → public link works |

No database backfill needed. No data migration. Roll-back = revert frontend deploy (backend changes are additive).

### J) Risk Notes

- **`contenteditable` browser quirks:** Safari handles atomic chips slightly differently from Chrome (selection ranges). Mitigated by using `selection.collapseToEnd()` after chip insertion + thorough Vitest tests across `jsdom` (passes) and Playwright (real browser).
- **Vane offline during E2E:** AC-42 says tests must pass locally with live Vane. CI skips them. Document the SSH-tunnel-running requirement in `tests/playwright/README.md`.
- **Streaming + post-process race:** citation rendering only fires on stream `done` to avoid mid-stream reprocessing. Confirmed by AC-31 (toolbar shown only after `done`).
- **Share-token leak risk:** tokens are 32-char hex (~128 bits). Public URLs are intentionally unguessable. Owner can revoke by toggling `ChatSession.is_shared=False` (UI for revoke is **out of MVP scope** — flag for follow-up).
- **No virus scanning in MVP:** images-only attack surface is small (mime + magic-byte + Pillow decode catches malformed payloads). PROJ-21 adds ClamAV when PDF/CSV/binary surface widens. Document in security-review.
- **DecompressionBomb attacks:** `Pillow.MAX_IMAGE_PIXELS` left at default; large legitimate images covered by 10 MB / 2048×2048 caps. EC-17 explicitly handled.

### K) Image-Vision Tech Notes (MVP subset of PROJ-21)

**Storage layout:**
```
MEDIA_ROOT/
└── chat-attachments/
    └── {workspace_id}/
        ├── {uuid}.{original_ext}      Original upload
        └── {uuid}.resized.webp        Pillow-resized version sent to LLM
```

**Upload flow:**
1. Frontend posts multipart to `POST /api/chat/attachments/`
2. Server validates: count (≤5), per-file size (≤10 MB), mime-magic (`python-magic` whitelists JPEG/PNG/WebP)
3. Server saves original + Pillow-resized version (max 2048×2048, WebP for smaller bundle)
4. Server returns list of `{id, filename, size, thumbnail_url, status: 'completed'}`
5. Synchronous flow — no async pipeline (PROJ-21 introduces that for OCR/RAG)

**Vision injection in SSE stream:**
1. Frontend sends `attachment_ids=uuid1,uuid2` query param when streaming
2. Server resolves attachments, validates workspace ownership, base64-encodes resized images
3. Server constructs LLM message with mixed content blocks: `[{type:'text', text:user_message}, {type:'image_url', image_url:{url:base64_data_url}}]`
4. **LLM call goes through existing OpenRouter integration** — same `ChatOpenAI` client used for chat today (configured with `OPENROUTER_API_KEY` + `base_url='https://openrouter.ai/api/v1'`). No new SDK, no new env var, no new service.
5. If selected model is NOT vision-capable → server overrides to `AppSettings.vision_model` (default `gpt-4.1-mini`) for THIS message only
6. Server emits SSE `init` event with `{message_id, model_used}` so frontend can show fallback notice via Snackbar

**Vision-capable model registry:**
A static mapping in backend (`VISION_CAPABLE_MODELS = {'gpt-4.1-mini', 'gpt-4.1', 'claude-sonnet-4-...', ...}`) — all values are valid OpenRouter model IDs. When `selected_model` is not in this set AND attachments contain images → fallback to `AppSettings.vision_model`. Mistral-medium and other text-only models trigger fallback.

**90-day purge:**
- New scheduled django-rq job `purge_old_attachments` running daily
- Deletes `ChatAttachment` records with `created_at < now - 90 days`
- File-on-disk cleanup via Django's `delete()` cascade on FileField
- Sets `purged_at` timestamp on record (kept as historical row for chat-history rendering)

**No ClamAV in MVP** — image-only attack surface. PROJ-21 adds it when PDF/CSV widen the surface.

**Frontend `📎` button behavior:**
- Click opens hidden `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`
- Drag-drop on chat area mounts `useDroppable` wrapper around `ChatInputBar`
- Paste handler on textarea reads `clipboardData.items`, filters image types
- Each upload kicks off `xhr` → updates `AttachmentBar` per-card status
- Send-button watches `attachments.every(a => a.status === 'completed')`

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
