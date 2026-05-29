# FIX: Chat Bugfixes + Grouping + Canvas Color-Picker

## Status: Planned
**Created:** 2026-05-28
**Last Updated:** 2026-05-28
**Type:** Mixed Bundle (6 bugfixes + 1 feature + 1 enhancement, one PR, frontend-heavy with three backend deltas)
**Branch:** `fix/chat-bugfixes-and-grouping`
**Merge Strategy:** `--merge` (preserve individual conventional commits for release-please)

## Dependencies
- PROJ-20 (Chat UX Perplexity-Parity) — In Review; current SSE/EventSource stream is here.
- PROJ-29 (Niche-Data Agentic RAG Chat) — In Review; chat history rendering + niche_context wiring.
- PROJ-9 (Design Generation) — In Review; Canvas / Artboard color input lives here.

## Scope Summary

| # | Area | Type | Commit |
|---|---|---|---|
| 1 | SSE GET → POST streaming refactor (fixes 8 KB URL limit) | Bug | `refactor(chat)` |
| 2 | Frontend fallback when Vane/web-search fails | Bug | `fix(chat)` |
| 3 | Send button toggles to Stop while streaming | Bug | `feat(chat)` |
| 4 | @Niche chip persists & renders in chat history | Bug | `fix(chat)` |
| 5 | Auto-scroll on session-open + during streaming | Bug | `fix(chat)` |
| 6 | Topbar Chat-Icon style matches sibling IconButtons | Polish | `fix(ui)` |
| 7 | Chat groups: model + CRUD + DnD reorder in sidebar | Feature | `feat(chat)` |
| 8 | Canvas Artboard color-picker RGB → RGBA (alpha slider) | Enhancement | `feat(canvas)` |

**Estimated LOC:** ~1000 (Item 7 ≈ 700, Item 1 ≈ 80, Item 8 ≈ 120, rest small).

---

## Item 1 — SSE Streaming Refactor (GET → POST)

### Context

The chat send-message stream today is `GET /api/chat/sessions/<id>/messages/stream/?content=…&niche_id=…&model=…` opened by `new EventSource(url)`. The browser's native `EventSource` API supports only `GET`, which means the full user prompt has to go into the URL query string. Caddy on prod caps request URI length at ~8 KB; URL-encoded German text balloons by ~2×, so a ~4 KB prompt already exceeds the URI limit and Caddy returns `400 Bad Request` BEFORE attaching CORS headers (which is the secondary error the user sees in DevTools).

Switching the stream endpoint to `POST` lets the prompt travel in the request body (unbounded). The SSE wire format itself (`event: foo\ndata: {...}\n\n`) is identical; we just parse it manually from a `fetch().body.getReader()` ReadableStream instead of letting the browser's `EventSource` parse it.

### Decisions

- **Reconnect**: `EventSource`'s auto-reconnect was already a source of duplicate chunks in PROJ-20 testing. We deliberately drop that feature with this refactor — if the connection drops mid-stream, the user re-sends. The existing silence-watchdog already covers stalled streams.
- **Legacy `GET`**: Kept for one release with a deprecation docstring so any pinned client (sharing iframe, e2e snapshots) doesn't break overnight. Removal is its own follow-up.
- **`activeAbortController` singleton**: Replaces `activeEventSource`. Same module-level "one stream at a time across hook consumers" semantics; just abort instead of close.

### User Stories
- As a POD seller, I want to paste prompts of any practical length (4–16 KB) into chat without `400 Bad Request`, so I can ask detailed multi-paragraph questions.
- As a developer, I want chat-stream requests to use the request body for payload, so reverse-proxy URL limits no longer constrain user input.
- As a developer maintaining the stop button, I want a clean `AbortController.abort()` semantics instead of `EventSource.close()`, so the stop flow has a single mental model.

### Acceptance Criteria
- [x] AC-1-1: `ChatSessionMessageStreamView` in `django-app/search_app/api/views.py` exposes a `post(self, request, session_id)` method that accepts a JSON body matching `{content: str, mode_override?: str, niche_id?: UUID, attachment_ids?: list[UUID], model?: str}` and returns the same `StreamingHttpResponse` SSE stream as today's GET. Body validation uses a DRF serializer (`ChatStreamRequestSerializer`) with `serializer.is_valid(raise_exception=True)`.
- [x] AC-1-2: Existing `GET` method is kept with an added docstring `# Deprecated 2026-05-28: use POST. Removal planned next release.` The GET handler delegates to the same internal `_stream(...)` helper as POST so both paths are wire-compatible.
- [x] AC-1-3: Both methods accept `Content-Type: application/json` (POST) or query-string (GET). DRF's `JSONParser` already mounted. CORS preflight already covers POST + Content-Type header (verified in `core/settings.py CORS_ALLOW_HEADERS`).
- [x] AC-1-4: Frontend `frontend-ui/src/hooks/useSendMessageStream.ts` replaces `new EventSource(url, { withCredentials: true })` with `fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': workspaceId }, body: JSON.stringify(args), signal: abortController.signal })`. — useSendMessageStream.ts:520-528
- [x] AC-1-5: A new internal helper `parseSSEStream(response: Response, dispatchEvent: (eventName: string, data: string) => void, onClose: () => void): Promise<void>` reads `response.body.getReader()`, runs a `TextDecoder({ stream: true })` over chunks, splits on `\n\n` (event-record boundary), parses each record into `(event, data)` pairs, and calls `dispatchEvent(event, data)`. The hook wires `dispatchEvent` to the same per-event-type handler map currently registered via `es.addEventListener(...)`. — useSendMessageStream.ts:175-209 (`onClose` param dropped; the IIFE awaits the parser and runs close in the catch — same outcome with one fewer indirection)
- [x] AC-1-6: SSE parser handles ALL existing event types currently subscribed in `useSendMessageStream.ts`: `init`, `sources`, `chunk`, `stage`, `heartbeat`, `tool_call`, `tool_result`, `tool_timeout`, `chunks_used`, `generate_slogans_payload`, `follow_ups`, `done`, `error`. Each routes to the same Redux dispatch as today (no behavior changes to the Redux side). — useSendMessageStream.ts:372-512 (handleEvent switch)
- [x] AC-1-7: Module-scoped `activeAbortController: AbortController | null` replaces `activeEventSource`. `start()` calls `activeAbortController?.abort()` before creating a new controller; assigns the new controller to both the module singleton and the hook's `eventSourceRef` (renamed to `abortControllerRef`). — useSendMessageStream.ts:225, 334-347
- [x] AC-1-8: rAF chunk-batching (`scheduleFlush`, `chunkBufferRef`, `flushScheduledRef`) — preserved 1:1 from existing implementation. — useSendMessageStream.ts:253-269
- [x] AC-1-9: Silence-watchdog (`STREAM_SILENCE_TIMEOUT_MS = 60_000`, `armSilenceTimer`, `silenceTimerRef`) — preserved 1:1; armed on every dispatched event including `heartbeat`. — useSendMessageStream.ts:163, 297-309, 373
- [x] AC-1-10: Connecting-stage placeholder (`pushStreamingStage({ stage: 'connecting', status: 'loading' })` on stream open, flipped to `markStageDone` on first real stage event) — preserved 1:1. — useSendMessageStream.ts:358-364, 397-401
- [x] AC-1-11: `stop()` calls `abortControllerRef.current?.abort()` AND the existing `closeStream()` cleanup (flushes buffered chunk, clears silence timer, clears refs, drops the module singleton if it points to this controller). — useSendMessageStream.ts:311-315 + 273-295
- [x] AC-1-12: `parseSSEStream` catches `AbortError` from the reader and exits cleanly (no error snackbar — abort is the user's intent). — useSendMessageStream.ts:200-204
- [x] AC-1-13: Network-level error inside the fetch (DNS, refused, mid-stream socket close that isn't `AbortError`) → close path: dispatch `clearStreamingMessage`, snackbar `search.stream.connectionLost`, call `onError?.()`. — useSendMessageStream.ts:532-540 (pre-stream) + 575-584 (mid-stream)
- [x] AC-1-14: Existing Vitest `frontend-ui/src/hooks/__tests__/useSendMessageStream.test.tsx` is rewritten to mock `fetch` returning a `Response` whose `body` is a `ReadableStream` controller we push SSE bytes into. The existing 13+ assertions (event dispatch, EC-7, silence timeout, abort on stop, singleton overlap) all pass against the new implementation. — useSendMessageStream.test.tsx:76-196 (MockStreamController + fetch stub) + 294-700 (21 ported assertions, all passing).
- [x] AC-1-15: Backend test `django-app/search_app/tests/test_chat_session_message_stream_view.py` gains a `test_post_streams_init_chunk_done_sequence` counterpart for the GET happy-path test, asserting identical SSE byte output for an identical input.
- [x] AC-1-16: `npm run lint` and `npm run test:ci` from `frontend-ui/` are green. `docker compose exec web pytest django-app/search_app/tests/test_chat_session_message_stream_view.py` is green. — Frontend half verified this run (lint 0 errors, 1636 tests / 0 failures). Backend half was verified in the `/backend` skill run (AC-1-15, see task file).

### Edge Cases
- [ ] EC-1-1: Body > Django `DATA_UPLOAD_MAX_MEMORY_SIZE` (default 2.5 MB) → Django returns `413 Payload Too Large`; frontend surfaces existing `search.stream.error` snackbar. We do not raise the cap (no realistic prompt is megabytes).
- [ ] EC-1-2: Mid-stream `abort()` while a chunk is being parsed → reader's `read()` rejects with `AbortError`; the `parseSSEStream` catches it, calls `onClose`, the hook's `closeStream` flushes any buffered chunk into Redux (so the visible streaming bubble keeps its last partial sentence), then clears refs.
- [ ] EC-1-3: Browser without `ReadableStream` body support (Safari < 14.1) → unsupported. Browserslist already targets evergreen browsers; we don't ship a fallback.
- [ ] EC-1-4: Multi-byte UTF-8 char split across two TCP packets → `TextDecoder({ stream: true })` carries the partial byte forward; no garbled text in dispatch.
- [ ] EC-1-5: Server closes the response cleanly without a `done` event → existing silence-watchdog fires after 60 s, error snackbar.
- [ ] EC-1-6: Backend returns 4xx/5xx BEFORE the stream starts (e.g. validation error) → `fetch` resolves, but `response.ok === false`; the hook reads the body as JSON, surfaces `display_message` if present via notistack `error`, doesn't enter SSE parsing.
- [ ] EC-1-7: User starts a new stream while a previous one is still active (Bar + Panel race) → existing module-singleton abort path handles it (Item 1 AC-1-7). No two streams ever write to the same Redux slice concurrently.

### Out of Scope
- Removing the legacy `GET` method (separate cleanup after frontend rollout has soaked).
- Switching to WebSockets (POST + SSE is sufficient and simpler).
- Auto-reconnect on connection drop.

---

## Item 2 — Frontend Fallback for Web-Search Failure

### Context

SearXNG engines on the prod stack (Brave 429, DDG CAPTCHA, Startpage suspended, Wolframalpha timeout) currently fail entirely — see server logs from 2026-05-28. The real fix (Tor enabled in SearXNG + narrowed engines to Mojeek/Qwant) is an OPS change that lives on the server, not in this repo. **This item** is the user-visible fallback so the chat doesn't look broken while engines are down.

Today when Vane returns no sources and the agent falls back to LLM-only output, the user gets an answer like "Der Live-Web-Suchversuch ist leider fehlgeschlagen" embedded in the LLM text — looks like a real answer, doesn't surface "this was a degraded response". We want an explicit pill + a one-time info snackbar so users know to retry.

### Decisions

- **SSE marker**: backend emits `error: 'web_search_unavailable'` on the SSE `error` event when Vane's source-fetch returns zero results and the agent decides to fall back. (Backend emission lives in a follow-up ticket; this FIX only adds frontend detection + UI for the marker.)
- **Inline pill, not toast**: a toast that disappears doesn't tell future-history readers WHY the answer is degraded. The pill stays in the assistant bubble forever.
- **One info snackbar per session**: avoid spam on repeated retries.

### User Stories
- As a POD seller, when web search is temporarily unavailable, I want a clear "Web-Suche temporär nicht verfügbar" pill in the failed answer bubble so I know the answer is degraded and not my prompt's fault.
- As a POD seller, I want a Retry button on the pill so I can re-issue the same query with one click after waiting a bit.
- As a POD seller scrolling back days later, I want the pill to still be visible on historical bubbles so I remember which answers were degraded.

### Acceptance Criteria
- [x] AC-2-1: When the SSE `error` event's parsed payload `{ error, display_message? }` has `error === 'web_search_unavailable'`, the frontend creates a synthetic persisted assistant message of `message_type: 'error'` (the model already supports this — see `ChatMessage.MessageType.ERROR`) with content set to the i18n body, and the existing PROJ-29 BUG-4 ERROR-bubble render path picks it up. — **Partial: frontend half complete.** Frontend detects the marker in `useSendMessageStream.ts:524-538` and invalidates the message cache so the persisted ERROR row pulled from the backend renders via the existing PROJ-29 BUG-4 path. Backend emission of the marker AND the ERROR-row write are out-of-scope (separate ticket per spec line 127); when backend ships, this AC fully lands without further FE work.
- [x] AC-2-2: Inside the existing `ErrorBubble` rendering (`ChatMessageList.tsx:144–155`), if the persisted error message's `content` matches the i18n body key, render a small `RetryButton` next to the error text. (For non-`web_search_unavailable` errors, no Retry button — keeps current behavior.) — ChatMessageList.tsx:530-547. **Deviation:** per Phase 6 task spec ("simpler than parsing content. Document in comment.") Retry is rendered on ALL paired ERROR rows where a prior user message exists, not gated on content match. The marker is observed at SSE-event time, not on persisted rows; this avoids a brittle i18n-string compare and matches the parent prompt's MVP simplicity directive.
- [x] AC-2-3: Three new i18n keys (EN + DE) under `search.fallback.webSearchUnavailable`:
  - [x] `.title` — `"Web-Suche temporär nicht verfügbar"` / `"Web search temporarily unavailable"` — en/translation.json:3018, de/translation.json:2262
  - [x] `.body` — `"Die Live-Web-Suche liefert gerade keine Ergebnisse. Bitte versuche es in ein paar Minuten erneut."` / `"Live web search is returning no results right now. Please try again in a few minutes."` — en/translation.json:3019, de/translation.json:2263
  - [x] `.retry` — `"Erneut versuchen"` / `"Retry"` — en/translation.json:3020, de/translation.json:2264
- [x] AC-2-4: Retry button click invokes `start()` from `useSendMessageStream` with the same `StartArgs` that produced the failed turn (last user message content + niche_id + model + mode_override). The user's optimistic message stays in place; the assistant ERROR bubble is removed via the existing `useDeleteMessageMutation` before retry, OR (simpler) left as-is and the new attempt produces a fresh paired assistant bubble below. **Default: leave the ERROR bubble in place** — historical context preserved. — ChatPanel.tsx:400-425 (`handleRetryWebSearch`) reconstructs StartArgs from the prior user message and calls `startStream` directly. ERROR bubble stays — no delete. Note: `mode_override` is forwarded only when the persisted `search_mode` is the ModeOverride enum (`chat | agent`); otherwise undefined and the backend uses its default. The persisted `search_mode` carries the legacy SearchMode enum on most rows, so this is a defensive cast.
- [x] AC-2-5: Info-variant snackbar fires once per session on first `web_search_unavailable` detection: copy `search.fallback.webSearchUnavailable.title`. Subsequent detections within the same `activeSessionId` do NOT re-fire (track via a `useRef<Set<string>>` of session-ids that already saw a snackbar; reset on session switch). — useSendMessageStream.ts:253-261 (`webSearchFallbackSeenRef`) + ts:524-538. **Deviation:** per parent prompt directive ("clearing stale entries is overkill — just live with a per-session memory") the set is NOT reset on session-id change. Switching sessions and returning will not re-fire the snackbar within the same hook lifetime; the persisted ERROR row in history continues to explain the prior failure. Hook unmount/remount (e.g. logout + login) does reset because the ref is per-instance.
- [x] AC-2-6: Fallback ONLY triggers when `error === 'web_search_unavailable'`. Generic stream errors (timeout, connection lost, 500) keep current `connectionLost` UI. — useSendMessageStream.ts:524-545 (marker branch returns early before the generic error-snackbar fallthrough).
- [x] AC-2-7: Frontend Vitest test asserts: SSE error event with `web_search_unavailable` payload → snackbar fires once, second occurrence does NOT re-fire, Retry button click calls `start()` with the original args. — useSendMessageStream.test.tsx:795-922 (4 marker cases: info-snackbar fires once, connectionLost suppressed, second occurrence in same session deduped, new session re-arms). ChatMessageList.test.tsx:495-588 (5 Retry-button cases including click→callback invocation with prior user message).

### Edge Cases
- [x] EC-2-1: User clicks Retry while a new stream is already active (e.g. typed a new prompt) → existing module-singleton abort path (Item 1 AC-1-7) cancels the previous stream before the retry starts; no double-stream. — Inherent to `start()` at useSendMessageStream.ts:334-347 (module-singleton abort on every `start()`). `handleRetryWebSearch` → `startStream(...)` rides the same code path.
- [x] EC-2-2: User attaches an image AND web search fails → image goes via Vision path (no Vane), so this fallback never fires; existing Vision error UX is unchanged. — Vision path is gated by the backend (`_handle_vision_stream`) and never emits `web_search_unavailable`; FE marker detection is a pure branch on the `error` event payload and only matches when backend emits the literal string. No code change required.
- [x] EC-2-3: Backend doesn't yet emit `web_search_unavailable` → fallback never triggers and the existing `connectionLost` UI shows. Marker emission is a follow-up backend ticket (out of scope here). — The marker branch at useSendMessageStream.ts:524-538 only fires on `data?.error === 'web_search_unavailable'`. Until backend ships, all errors fall through to the existing `connectionLost`/error snackbar path at ts:539-545. Verified via `error event clears streaming and notifies via notistack` test still passing (useSendMessageStream.test.tsx:466-491).
- [x] EC-2-4: Same prompt retried 5× in a row, all fail → snackbar only fires once (AC-2-5 dedupe). Pills accumulate (5 ERROR bubbles), which is the honest history. — useSendMessageStream.test.tsx (`does NOT re-fire the snackbar on a second marker within the same session id` case in the `web search fallback marker` describe block). The persisted ERROR rows accumulate via backend writes; FE simply renders each one.
- [x] EC-2-5: Niche referenced in the original prompt (AC-2-4 also persists `niche_id`) — Retry preserves it via `referenced_niche_id` (Item 4). — ChatPanel.tsx:404 (`niche_id = priorUserMessage.referenced_niche_id ?? null`); ChatMessageList.test.tsx asserts the prior-user-message object passed to the callback includes `referenced_niche_id` (case `invokes onRetryWebSearch with the prior user message on click`).

### Out of Scope
- Detecting WHICH engine failed; the user sees a single "temporarily unavailable" state.
- Configuring SearXNG engines / Tor (server-side OPS task — separate ticket).
- Migrating Vane to a search API (Tavily/Serper/Brave) — separate PROJ.
- Backend emission of the `web_search_unavailable` SSE marker — separate ticket; this FIX is purely the frontend half.

---

## Item 3 — Send Button → Stop Button Toggle

### Context

Today `SendButton.tsx` always renders a `SendIcon` and its click triggers the submit path. If the assistant is mid-generation and the user wants to abort (typo'd prompt, going down the wrong path), there's no UI affordance — the only way is to wait for the silence-watchdog to fire 60 s later, or to refresh the page. Most modern chat UIs (ChatGPT, Claude, Perplexity) toggle the Send button into a Stop button while generating. Item 1's AbortController-based stop semantics give us a clean implementation.

### Decisions

- **Same bounding box**: button slot doesn't change size or position between states — only the icon. Prevents layout shift.
- **Partial-answer policy**: stopping discards the partial streaming-bubble content (matches existing `stop()` behavior). Persisting the partial is a UX call deferred to follow-up.
- **Keyboard Enter while streaming**: ignored. Input is disabled while streaming (existing behavior — `ChatInputBar` reads `isStreaming` from chatBar slice).

### User Stories
- As a POD seller, when the assistant is generating an answer I no longer want, I want to click a Stop button (same place as Send) to abort the stream immediately so I can refine my prompt.
- As a POD seller, I want the icon swap to be instant (no fade) so I know my click registered.

### Acceptance Criteria
- [x] AC-3-1: `frontend-ui/src/components/MultiPurposeDrawer/panels/ChatInputBar/partials/SendButton.tsx` reads `isStreaming` from `chatBar` slice (already in store at `s.chatBar.streamingAssistantMessage.isStreaming`). — read in `ChatInputBar/index.tsx:142-144`, forwarded as prop to SendButton.tsx:17-18. Kept as prop because the parent already owns the selector and the wider gating logic.
- [x] AC-3-2: Button accepts a new prop `onStop: () => void` from `ChatInputBar/index.tsx`, wired to the parent's `stopStream` callback (calls `useSendMessageStream().stop`). — SendButton.tsx:31-32 ← ChatInputBar/index.tsx:369 (`onStop={onStop}`) ← ChatPanel.tsx:489 (`onStop={stopStream}`) ← ChatPanel.tsx:172 destructures `stop: stopStream` from `useSendMessageStream`.
- [x] AC-3-3: When `isStreaming === false`: button renders `SendIcon` from `@mui/icons-material/Send`; `aria-label = t('search.send.aria')`; click → existing submit path. — SendButton.tsx:60-64 picks `search.chatBar.send` (existing key — no new `search.send.aria` introduced; only `search.stop.aria` was specified in the Phase 2 i18n task); icon swap at line 80-82.
- [x] AC-3-4: When `isStreaming === true`: button renders `StopIcon` from `@mui/icons-material/Stop`; `aria-label = t('search.stop.aria')`; click → invokes `props.onStop()`. — SendButton.tsx:61-69 (aria + click branch) + 78-80 (icon).
- [x] AC-3-5: Visual: same MUI `IconButton` slot; `size="small"`, `color="primary"`, same `sx` styling; only the icon and aria-label change. — same `RoundSendButton` styled-IconButton at SendButton.tsx:35-46; `size="small"` at line 73; identical 18px icon size in both branches.
- [x] AC-3-6: No fade/transition between icon states — straight swap. Avoids users double-clicking thinking the swap is a hover effect. — no `transition` declared on the icons; bare ternary render at SendButton.tsx:78-82.
- [x] AC-3-7: New i18n key `search.stop.aria` (EN: "Stop generating", DE: "Generierung stoppen") added to `frontend-ui/public/locales/en/translation.json` + `de/translation.json`. — en/translation.json:3011-3013, de/translation.json:2255-2257.
- [x] AC-3-8: Stop click clears the streaming bubble via the existing `stop()` implementation in `useSendMessageStream` (already calls `closeStream` + `clearStreamingMessage`). — onStop wired to the hook's `stop` at useSendMessageStream.ts:311-315 which aborts + closes + clears.
- [x] AC-3-9: Vitest test for `SendButton.tsx`: renders SendIcon when not streaming, renders StopIcon when streaming, click invokes correct handler based on state. — partials/__tests__/SendButton.test.tsx (4 tests, all passing — Send mode, Stop mode, role-stability, disabled-prop semantics).

### Edge Cases
- [x] EC-3-1: Stop clicked between fetch-sent and first SSE event → `AbortController.abort()` cancels the in-flight `fetch`; backend's Django view detects the disconnect via `await asgiref.sync.sync_to_async(connection.close)()` or naturally as `BrokenPipeError` and exits the generator. No manual cancel endpoint needed. — `stop` calls `abortControllerRef.current?.abort()` (useSendMessageStream.ts:312); UI-side: caveat — Redux `isStreaming` flips to true only on the `init` event, so the user sees the Stop affordance only after init lands. Pre-init the button is in Send mode (disabled via `isSending`). Backend semantics unchanged.
- [x] EC-3-2: Stop clicked after `done` arrives but before `isStreaming` flips to false in Redux → click is a no-op because `useSendMessageStream.stop()` checks `isStreamingRef.current` early-exit. — verified at useSendMessageStream.ts:311-315: `stop` aborts an already-finished controller (no-op) and `clearStreamingMessage` is idempotent.
- [x] EC-3-3: Stop button rendered briefly during an Optimistic-message-only state (user just submitted, no SSE event yet) → still works; `start()` already created the AbortController before any event arrives, so abort is valid. — abort path is wired at start() (useSendMessageStream.ts:334-347) before any event is received; Stop UI surfaces only once `init` flips Redux `isStreaming`, but the underlying abort path is valid throughout the in-flight window.
- [x] EC-3-4: User clicks Stop, then immediately retypes and submits → existing module-singleton path ensures only the latest stream is active; no race. — module-singleton `activeAbortController` (useSendMessageStream.ts:225) aborts any prior controller before starting a new one.
- [x] EC-3-5: Stop click while ChatInputBar is in CommandPalette mode → CommandPalette doesn't intercept the click; SendButton still functional. — CommandPalette is a separate Popover sibling of the action bar; it doesn't capture clicks on the SendButton IconButton outside its own surface.

### Out of Scope
- Persisting the partial assistant message on stop (currently cleared).
- A separate "Stop and edit prompt" button.
- Disabling the input mid-stream beyond what's already there.

---

## Item 4 — @Niche Chip Persistence + Rendering in History

### Context

Today the chat input bar's `inputChip` (the `@Niche` reference) is sent as `niche_id` to the stream endpoint. The session's `ChatSession.niche_context` field is also set when the niche is "pinned" to a session. But there's a critical hole: each USER message can reference a different niche turn-by-turn, and that per-message reference is **not** persisted on `ChatMessage`. After a page reload, a user scrolling history can't tell which question targeted which niche — only that the session is loosely associated with a niche_context.

We add `ChatMessage.referenced_niche` (nullable FK), persist it on every user message that arrives with a `niche_id` in the request body, expose it via the serializer, and render a small read-only `NicheChip` next to the user bubble in `ChatMessageList`.

### Decisions

- **FK name**: `referenced_niche` (semantic — distinguishes from session-level `niche_context`).
- **Read-only chip**: per user decision earlier — no click handler, no navigation. Pure visual marker.
- **User messages only**: assistant messages don't get the chip; the niche reference is the user's framing.
- **Serializer**: expose both `referenced_niche_id` and `referenced_niche_name` to avoid the frontend needing a second roundtrip to resolve the niche title.

### User Stories
- As a POD seller scrolling chat history, I want to see a small niche chip next to each user message that referenced a niche, so I can tell at a glance which question targeted which niche.
- As a POD seller comparing answers across niches in one session, I want the per-message chips to make the niche-switching pattern obvious.
- As a developer, I want the niche reference persisted as a typed FK (not a stringly-typed JSONField) so the data is queryable and survives niche renames.

### Acceptance Criteria

**Backend — Model & Migration:**
- [ ] AC-4-1: New field `ChatMessage.referenced_niche = models.ForeignKey('niche_app.Niche', on_delete=SET_NULL, null=True, blank=True, db_index=True, related_name='referenced_in_messages')` in `django-app/search_app/models.py`.
- [ ] AC-4-2: Migration `search_app/migrations/0009_chatmessage_referenced_niche.py` is auto-generated, additive only, no data migration.
- [ ] AC-4-3: `referenced_niche` is set ONLY on `role='user'` messages. The view-layer write path enforces this; the model doesn't add a DB-level check (would over-constrain seed/admin operations).

**Backend — View Persistence:**
- [ ] AC-4-4: `ChatSessionMessageStreamView` POST (per Item 1) and GET (legacy) both read `niche_id` from the request, validate it belongs to the current workspace, and pass it to `ChatMessage.objects.create(... referenced_niche_id=niche_id, ...)` for the user message. The assistant message has `referenced_niche=None`.
- [ ] AC-4-5: Cross-workspace `niche_id` (niche from a different workspace than the current X-Workspace-Id) → DRF `ValidationError` 400 with code `niche_not_in_workspace`. Existing workspace-isolation pattern reused (`_get_workspace_id` then explicit filter).
- [ ] AC-4-6: `niche_id = None` or absent → user message is persisted with `referenced_niche=None`. No error.

**Backend — Serializer:**
- [ ] AC-4-7: `ChatMessageSerializer` in `django-app/search_app/api/serializers.py` adds:
  - `referenced_niche_id` — `UUIDField(source='referenced_niche.id', read_only=True, allow_null=True)`
  - `referenced_niche_name` — `SerializerMethodField`, returns `obj.referenced_niche.title` if set else `None`.
- [ ] AC-4-8: List endpoint `/api/chat/sessions/<id>/messages/` adds `select_related('referenced_niche')` to the queryset to avoid N+1 on the new fields.

**Backend — Tests:**
- [ ] AC-4-9: Pytest `test_referenced_niche_persisted_on_user_message` — POST with `niche_id` → user message has `referenced_niche_id` set, assistant message has it null.
- [ ] AC-4-10: Pytest `test_referenced_niche_cross_workspace_rejected` — niche from workspace B + X-Workspace-Id=A → 400 with code `niche_not_in_workspace`.
- [ ] AC-4-11: Pytest `test_chat_message_serializer_returns_referenced_niche_fields` — fixture message with niche set, serializer output contains both id + name.

**Frontend — Types:**
- [x] AC-4-12: `frontend-ui/src/types/search.ts` `ChatMessage` interface adds `referenced_niche_id?: string | null` and `referenced_niche_name?: string | null`. — types/search.ts:109-114.

**Frontend — Rendering:**
- [x] AC-4-13: In `ChatMessageList.tsx`, the user-row (`role === 'user'`) renders the existing `NicheChip` component (or a new lightweight read-only variant if `NicheChip` is too input-bar-coupled) BEFORE the `UserBubble`, inside the same `MessageRow` container. — Existing `NicheChip` is a contenteditable DOM-builder (not a React component); created new lightweight read-only React component `HistoryNicheChip` (`MultiPurposeDrawer/panels/HistoryNicheChip.tsx`); imported + rendered at ChatMessageList.tsx:11 (import) + 365-373 (render inside the user-row Stack, ABOVE attachments + bubble).
- [x] AC-4-14: Chip props: `label = message.referenced_niche_name`, `nicheId = message.referenced_niche_id`, `readOnly = true` (no remove handler, no click handler, no hover lift). — HistoryNicheChip.tsx defines only `name` + optional `nicheId` props; no `onRemove`, `onClick`, or hover-lift transform.
- [x] AC-4-15: Chip rendered only when `message.referenced_niche_name` is non-null; otherwise no extra DOM. — ChatMessageList.tsx:365 (`msg.referenced_niche_name && (...)` short-circuit).
- [x] AC-4-16: Chip alignment: same row as the user bubble, aligned to the right edge (matches `flexDirection: row-reverse` of `MessageRow`), `mb: 0.5` separation between chip and bubble. — Lives as first child of the existing user-row `Stack alignItems="flex-end" gap={0.5}` (ChatMessageList.tsx:357-361); MessageRow's `row-reverse` flex direction parks the Stack on the right edge; the Stack's own `gap={0.5}` provides the chip↔bubble vertical separation.
- [x] AC-4-17: New i18n key `search.history.referencedNicheAria` (EN: "Referenced niche: {{name}}", DE: "Referenzierte Niche: {{name}}") wired as the chip's `aria-label`. — en/translation.json:3014-3016, de/translation.json:2258-2260; consumed in HistoryNicheChip.tsx (`aria-label={t('search.history.referencedNicheAria', { name })}`).

**Frontend — Tests:**
- [x] AC-4-18: Vitest `ChatMessageList.test.tsx` adds: fixture user message with `referenced_niche_name='Cats'` → screen finds a chip with the name; fixture with `null` → no chip rendered. — __tests__/ChatMessageList.test.tsx:436-485 (chip present when name set; chip absent when name null; chip absent on assistant row defence-in-depth). Plus focused __tests__/HistoryNicheChip.test.tsx (5 cases: @-prefix label, i18n aria, data-niche-id passthrough, data-niche-id omission, no remove button).

### Edge Cases
- [x] EC-4-1: Niche is deleted after the message exists → `SET_NULL` clears the FK; serializer returns `null` for both name and id; chip disappears. Acceptable (no orphan reference). — Frontend render path gates on `msg.referenced_niche_name` being truthy (ChatMessageList.tsx:365); null serializer output → chip not rendered, no orphan visible. Backend `SET_NULL` already enforced (search_app/models.py:132-146 from `/backend` phase).
- [ ] EC-4-2: User re-sends an old prompt via Retry (Item 2 AC-2-4) — Retry passes the original `niche_id` (we capture it from the original user message's `referenced_niche_id`), so the new user message also gets the FK.
- [x] EC-4-3: Workspace switch while a chat is open → existing `setActiveSession(null)` + cache invalidation already handles this; new fields don't change the flow. — `HistoryNicheChip` is a pure render of two scalar fields off `ChatMessage`; no Redux subscriptions, no RTK Query calls, no workspace-id reads. Pre-existing workspace-switch flow re-fetches the message list and the chip simply re-renders from the new payload.
- [x] EC-4-4: Niche name > 40 chars → existing `NicheChip` already truncates with ellipsis. — `HistoryNicheChip` `ChipRoot` styled() applies `whiteSpace: nowrap; overflow: hidden; textOverflow: ellipsis; maxWidth: '100%'` (HistoryNicheChip.tsx ChipRoot styled definition) — long names truncate inside the chip, mirroring the input-bar chip's nowrap behaviour.
- [x] EC-4-5: Shared chat (`/share/<token>/`) viewer is anonymous and cannot resolve workspace-scoped niches → the public serializer (`SharedChatSessionSerializer` if it exists, otherwise the same serializer) MUST blank `referenced_niche_id` even if the field has data. Verify in `SharedChatView`. If the public serializer doesn't strip it today, this FIX adds the strip (in scope). — Verified + tested in `/backend` phase: `PublicChatMessageSerializer` uses an explicit allowlist (`fields = ['id','role','content','message_type','sources','model_used','attachments','created_at']`) so the new fields are NOT exposed; regression test `test_shared_chat_view_strips_referenced_niche` locks this in.

### Out of Scope
- Clickable chip → niche-detail navigation.
- Showing `referenced_niche` on assistant bubbles.
- Surfacing session-level `niche_context` separately in the UI (it's already implicit via the input bar's pinned chip).
- Bulk-updating historical messages with niche references retroactively.

---

## Item 5 — Auto-Scroll on Open + During Streaming

### Context

`ChatMessageList.tsx` already has an `AUTO_SCROLL_THRESHOLD = 50` constant and a `JumpToLatestButton`, but the actual scroll behavior is inconsistent:
1. **Initial mount**: when a session is opened, messages render and the scroll container starts at `scrollTop = 0`. The user sees the TOP of the history instead of the latest message — they have to scroll down manually.
2. **Streaming chunks**: when the assistant generates new tokens, the streaming bubble grows but the view doesn't follow. User reads "in the middle" of the answer.
3. **User scrolled up**: today there's a partial respect for user scroll position, but it's fragile.

The fix: introduce a sentinel `<div>` at the bottom of the scroll container, observe it with `IntersectionObserver`, derive a boolean `userAtBottom`. Use that as the gate for auto-scroll. On mount + on `activeSessionId` change, force `scrollTop = scrollHeight` once. During streaming, when `userAtBottom`, smooth-scroll on each chunk (rAF-coalesced).

### Decisions

- **rAF-coalesce chunk scroll**: chunks already get rAF-batched into Redux; piggyback the scroll on the same frame.
- **`IntersectionObserver` sentinel**: more reliable than measuring `scrollHeight` (which drifts when images load). Existing PROJ-29 code already has a similar pattern in `useEditorBatchState` — reuse the approach.
- **Smooth scroll**: chunks during streaming use `behavior: 'smooth'`. Initial scroll on session-open uses `behavior: 'instant'` (no jarring animation when switching chats).
- **Threshold preserved**: keep `AUTO_SCROLL_THRESHOLD = 50` so user reading higher up doesn't get yanked down.

### User Stories
- As a POD seller opening a chat session, I want the latest messages visible immediately on mount without manual scrolling.
- As a POD seller watching the assistant generate text, I want the view to follow new tokens as long as I'm at the bottom, so I can read live.
- As a POD seller who scrolled up to re-read an earlier message, I want to stay at my scroll position and click the existing `JumpToLatestButton` to return — auto-scroll must NOT yank me down.
- As a POD seller switching between sessions, I want each session to land me at its bottom immediately on switch.

### Acceptance Criteria
- [x] AC-5-1: A sentinel `<div ref={bottomSentinelRef} />` is rendered as the last child of `ScrollContainer`. — ChatMessageList.tsx:655 (list path) + 390 (skeleton path)
- [x] AC-5-2: An `IntersectionObserver` observes `bottomSentinelRef.current` with `root = scrollContainerRef.current` and `rootMargin = '${AUTO_SCROLL_THRESHOLD}px'`. The observer's callback sets a `userAtBottomRef.current = entry.isIntersecting`. — ChatMessageList.tsx:274-302 (also mirrors to `userAtBottomState` for re-render-driven JumpToLatest visibility)
- [x] AC-5-3: On initial mount of `ChatMessageList` (or when `messages` transitions from empty → non-empty), call `scrollContainerRef.current.scrollTo({ top: scrollContainerRef.current.scrollHeight, behavior: 'instant' })` SYNCHRONOUSLY in a `useLayoutEffect` so it happens before paint. — ChatMessageList.tsx:307-321 (uses `didInitialScrollRef` guard; only fires once per mount)
- [x] AC-5-4: When `activeSessionId` changes (parent ChatPanel does the switch), `ChatMessageList` re-mounts via React's keying on session id (existing behavior); AC-5-3 fires again for the new session. — ChatPanel.tsx:462-468 added `key={activeSessionId ?? 'no-session'}` (key was not present before; added per Phase 4 instructions)
- [x] AC-5-5: While `streamingAssistantMessage.isStreaming === true` AND `userAtBottomRef.current === true`, the existing chunk-batch rAF flush ALSO calls `scrollContainerRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' })` AFTER the new chunk DOM is committed. Coalesce: one scroll per rAF, not one per chunk. — ChatMessageList.tsx:327-336. Deviation: the scroll piggybacks on the Redux state change inside `ChatMessageList` (effect deps `streamingMessage.content` + `isStreaming`) rather than being wired into `useSendMessageStream.flushChunkBuffer` — the Phase 4 scope-lock prohibits edits to `useSendMessageStream.ts`. End result is identical (rAF-coalesced, one scroll per frame regardless of chunk count).
- [x] AC-5-6: When new persisted messages arrive (e.g. assistant `done` invalidates RTK cache → list re-renders with the saved message), if `userAtBottomRef.current === true`, scroll-to-bottom fires once after the next paint. — ChatMessageList.tsx:351-372 (compares last-message id to detect tail growth; defers scroll via rAF for post-paint timing)
- [x] AC-5-7: If user scrolls up beyond threshold during streaming → `userAtBottomRef.current` flips to `false`, auto-scroll silently disables; `JumpToLatestButton` becomes visible (existing behavior preserved). — ChatMessageList.tsx:286-292 (observer flips both ref + state) + 600-602 (button renders on `!userAtBottomState`)
- [x] AC-5-8: `JumpToLatestButton` click → existing behavior: `scrollTo({ top: scrollHeight, behavior: 'smooth' })` AND `userAtBottomRef.current = true` (next chunk re-engages auto-scroll). — ChatMessageList.tsx:381-385 (`handleJumpToLatest`)
- [x] AC-5-9: Unit test `ChatMessageList.test.tsx`: mount with 3 messages → `scrollTop` equals `scrollHeight - clientHeight` after first paint. Mount with empty array → no scroll applied. Mock `IntersectionObserver` + simulate user scroll up → auto-scroll on next chunk does NOT fire. Re-mount with new session-id → scroll re-applies. — ChatMessageList.test.tsx:486-606 (5 cases in `auto-scroll` describe block; controllable IO mock at lines 38-79 lets tests fire `isIntersecting` deterministically). Note: jsdom does not expose `scrollHeight - clientHeight` natively, so the mount-with-3-messages assertion checks `scrollTo` was called with `{ top: scrollHeight, behavior: 'instant' }` against polyfilled geometry (1000/200) rather than reading `scrollTop` after the call.

### Edge Cases
- [x] EC-5-1: Streamed image attachments (height grows after image `load` event) → `IntersectionObserver` re-evaluates on layout shift; if sentinel re-enters view, `userAtBottomRef` flips back to `true` and next chunk re-engages scroll. Note: image-loaded resize is debounced by browser anyway. — Inherent to IntersectionObserver semantics; sentinel-based design (ChatMessageList.tsx:541-543) is the implementation choice that makes this work without explicit code.
- [x] EC-5-2: User on mobile with virtual keyboard open → no special handling; existing layout already accommodates input area. Scroll target is the scrollable inner container, not `window`. — ChatMessageList.tsx:67-74 (`ScrollContainer` is the styled inner Box with `overflowY: auto`); we never call `window.scrollTo`.
- [x] EC-5-3: Vite HMR re-mount during dev → callback-ref pattern (already documented as a comment in current ChatMessageList) keeps observer attached across HMR-induced remounts. — ChatMessageList.tsx:261-270 (`setScrollRef` callback disconnects any stale observer before binding the new node; effect at 273-302 re-runs and re-creates the observer for the new root)
- [x] EC-5-4: Messages loaded via "Load more" at the top → `userAtBottom` is irrelevant; the new content goes ABOVE the visible viewport. No auto-scroll triggered. — ChatMessageList.tsx:351-365 (tail-id comparison: prepend leaves `messages[length - 1].id` unchanged → effect returns at the `newLastId === prevLastId` guard before any scroll call). Regression test: ChatMessageList.test.tsx:574-606.
- [x] EC-5-5: User pastes a multi-line prompt that pushes the textarea taller → ChatInputBar height grows, scroll container shrinks; `IntersectionObserver` re-evaluates and may re-engage `userAtBottom`. Acceptable. — Inherent to IO semantics; no explicit code required.
- [x] EC-5-6: Streaming bubble is the LAST message → `userAtBottom` is true while the bubble grows; smooth scroll follows token-by-token. — ChatMessageList.tsx:327-336 (streaming-chunk effect runs on `streamingMessage.content` length growth; rAF-coalesced smooth scroll keeps the cursor visible).

### Out of Scope
- CSS `overflow-anchor` (uneven browser support).
- Scroll-to-specific-message (e.g. from a notification deep link).
- Virtualization for very long histories.

---

## Item 6 — Topbar Chat-Icon Style Alignment

### Context

The Chat icon in the topbar currently uses different padding, icon size, and hover state from its siblings (`ColorModeToggle.tsx`, `LanguageMenu.tsx`). Visually it's slightly larger and the hover background differs. The fix is a small style-alignment pass.

### Decisions

- **No behavior change**: only styling. The icon still opens the chat panel.
- **No theme tokens added**: existing tokens cover everything we need.
- **Reuse pattern**: copy the exact IconButton `sx` shape from `ColorModeToggle.tsx`.

### User Stories
- As a POD seller looking at the topbar, I want the Chat-Icon button to visually match the other topbar IconButtons (ColorMode / Language) — same size, padding, hover state — so the topbar looks cohesive.

### Acceptance Criteria
- [x] AC-6-1: Locate the Chat-Icon `IconButton` in `frontend-ui/src/components/topbar/Topbar.tsx` (or wherever the chat-open button lives — verify via grep). — Topbar.tsx:141-150 (Tooltip wraps the chat IconButton; `ChatBubbleOutlineIcon` at line 7).
- [x] AC-6-2: Adjust IconButton `size`, `sx`, and `aria-label` to match `ColorModeToggle.tsx` shape: `size="small"`, identical padding sx, identical hover background via `theme.vars.palette.action.hover`. — Topbar.tsx:82-93 new `TopbarIconButton` styled component mirrors ColorModeToggle.tsx:9-18 verbatim (width 32, height 32, borderRadius '8px', hover bg `action.hover`); applied at Topbar.tsx:155-163 with `size="small"` + existing `aria-label`.
- [x] AC-6-3: Icon color uses `theme.vars.palette.text.primary` (matches other topbar icons in both light + dark mode). — Implemented per Item 6 Decisions ("copy the exact IconButton `sx` shape from `ColorModeToggle.tsx`"): siblings use `text.secondary` default + hover→`text.primary`. Touched IconButton now matches that pattern at Topbar.tsx:86 + 89, achieving the AC's underlying goal (matching siblings in both modes) without diverging from the reference shape.
- [x] AC-6-4: Active/badge state (if there's an unread badge today) preserved using `theme.vars.palette.primary.main`. — No badge currently exists on the chat IconButton (verified: only `NotificationBell` carries a badge in the topbar). Out-of-scope per "Adding a badge if none exists today."
- [x] AC-6-5: No hardcoded hex/rgb values introduced. ESLint passes. — Touched lines (Topbar.tsx:82-93, 155-163) reference only `theme.vars.palette.*` tokens; `npm run lint` → 0 errors (17 pre-existing warnings in untouched files).
- [ ] AC-6-6: Visual smoke: take a screenshot of topbar light + dark mode; chat icon visually matches Clock / ColorMode / Language siblings (same height + padding + hover). — Deferred to orchestrator manual smoke (out of code-skill scope; behavior verified structurally via shared `TopbarIconButton` styled component reused 1:1 from sibling pattern).

### Edge Cases
- [x] EC-6-1: Mobile breakpoint (<600px) — Topbar collapses to `MobileContextSheet`; this fix applies only to the desktop topbar visible icon. — Chat IconButton lives inside the right-actions Box (Topbar.tsx:137-156), which is part of the desktop layout; `MobileContextControl` renders separately at lines 111-115 and is untouched.
- [x] EC-6-2: Color-scheme switch (light ↔ dark) — `theme.vars.*` ensures the icon adapts correctly. — `TopbarIconButton` uses CSS vars (`theme.vars.palette.text.secondary`, `action.hover`, `text.primary`) which MUI's CssVarsProvider swaps at runtime without React re-render.
- [x] EC-6-3: Workspace-switch animation triggers a re-render — style alignment is purely CSS-driven; no flicker. — Style attached via `styled()` (static CSS class), no inline `style={{ }}` and no `sx` evaluated per-render on the touched button; class is stable across re-renders.

### Out of Scope
- Rearranging icon order in the topbar.
- Adding new behavior to the chat icon.
- Adding a badge if none exists today.

---

## Item 7 — Chat Groups (Full Feature)

### Context

Today the sidebar `RecentChats` panel shows a flat list of `ChatSession` rows sorted by `updated_at desc`. Power users with dozens of chats want named folders to organize related chats. The feature adds:
- A new `ChatGroup` model (workspace-scoped, name, ordering int).
- A nullable FK from `ChatSession.group` → `ChatGroup` plus a per-group `group_ordering` int.
- CRUD endpoints + two reorder endpoints (groups and chats-within-group).
- Sidebar UI: collapsible group sections, drag-and-drop for chat between groups and group reorder, inline create / rename / delete.

### Decisions

- **Single-level groups**: no nesting. ChatGPT / Linear / Slack-DM style. Keeps UI + DnD simple.
- **FK not M2M**: a chat belongs to exactly one group (or "Ungrouped" = `group=NULL`).
- **Ordering**: integer + resequence on every drop. Worst-case 200 UPDATEs in one transaction — fine for our scale. Deterministic, easy to test.
- **"Ungrouped" is virtual**: rendered as the first section with header label `"No group"`, but is just `WHERE group_id IS NULL` — no DB row. Saves a migration.
- **New chats default to Ungrouped**: per user decision earlier. Predictable, classic.
- **Collapse state per group is local**: `localStorage` keyed by workspace + group id. Lost on logout (acceptable).
- **Group rename is in-place TextField**: no modal.
- **Group delete confirms**: "Move N chats to Ungrouped?" — destructive but recoverable (chats not deleted).
- **DnD library**: `@dnd-kit/core` + `@dnd-kit/sortable` (already a dep — see PROJ-14 kanban).
- **Concurrent edits**: last write wins. Reorder endpoints are `transaction.atomic`. Two tabs reordering simultaneously may produce a surprising order; we accept that.

### User Stories
- As a POD seller, I want to create named groups in the chat sidebar (e.g. "Niches", "Listing Drafts", "Slogan R&D") so I can keep related chats together.
- As a POD seller, I want to drag a chat from "Ungrouped" into a group, and from one group to another, so I can reorganize as workflow evolves.
- As a POD seller, I want to reorder groups themselves (top to bottom) so I can keep the active ones at the top.
- As a POD seller, I want to collapse/expand each group so a busy sidebar stays scannable.
- As a POD seller, I want to rename and delete groups; deleting a group must NOT delete the chats inside it — they fall back to "Ungrouped".
- As a POD seller, I want chat order within a group to be manual (DnD), so I can pin the important ones near the top regardless of `updated_at`.

### Acceptance Criteria

**Backend — Model & Migration:**
- [x] AC-7-1: New model in `django-app/search_app/models.py`:
  ```python
  class ChatGroup(models.Model):
      id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
      workspace = models.ForeignKey('workspace_app.Workspace', on_delete=models.CASCADE, related_name='chat_groups', db_index=True)
      created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_groups')
      name = models.CharField(max_length=80)
      ordering = models.PositiveIntegerField(default=0, db_index=True)
      created_at = models.DateTimeField(auto_now_add=True)
      updated_at = models.DateTimeField(auto_now=True)
      class Meta:
          ordering = ['ordering', 'created_at']
          constraints = [models.UniqueConstraint(fields=['workspace', 'name'], name='chatgroup_workspace_name_unique')]
          indexes = [models.Index(fields=['workspace', 'ordering'], name='chatgroup_ws_ordering_idx')]
  ```
- [ ] AC-7-2: New nullable FK on existing `ChatSession`:
  ```python
  group = models.ForeignKey('ChatGroup', on_delete=models.SET_NULL, null=True, blank=True, db_index=True, related_name='sessions')
  group_ordering = models.PositiveIntegerField(default=0, db_index=True)
  ```
- [ ] AC-7-3: Migration `search_app/migrations/0010_chatgroup_and_session_group.py` is purely additive, reversible, no data migration. Existing chats default to `group=NULL, group_ordering=0`.
- [ ] AC-7-4: `ChatSession.Meta` extends its current `ordering = ['-updated_at']` to `ordering = ['group_ordering', '-updated_at']` so within a group the manual order wins and falls back to recency for ties. New index `chatsess_group_ordering_idx` over `(group, group_ordering)`.

**Backend — Serializer:**
- [ ] AC-7-5: New `ChatGroupSerializer` in `django-app/search_app/api/serializers.py`: exposes `id`, `name`, `ordering`, `created_at`, `updated_at`, `session_count` (annotated via `Count('sessions')` on the queryset, NOT a method that triggers a query per group).
- [ ] AC-7-6: `ChatSessionSerializer` is extended with `group: UUID | null` and `group_ordering: int`. List endpoint uses `select_related('group')` + ordering by `('group_ordering', '-updated_at')` consistent with model Meta.

**Backend — Views & URLs:**
- [ ] AC-7-7: New `ChatGroupViewSet(ModelViewSet)` mounted at `/api/chat/groups/`:
  - `GET /api/chat/groups/` → list (workspace-scoped)
  - `POST /api/chat/groups/` body `{ name: str }` → create with `ordering = max(ordering)+1`
  - `PATCH /api/chat/groups/<id>/` body `{ name?: str }` → rename
  - `DELETE /api/chat/groups/<id>/` → delete (chats fall back to NULL via SET_NULL)
  - Authentication: `CookieJWTAuthentication`, permission `IsAuthenticated`, `_get_workspace_id` filter.
- [ ] AC-7-8: New endpoint `POST /api/chat/groups/reorder/` body `{ ordered_ids: list[UUID] }` → in one `transaction.atomic`, set `ordering = i+1` for each id in order. Validates all ids belong to current workspace; 400 if any foreign.
- [ ] AC-7-9: New endpoint `POST /api/chat/sessions/reorder-in-group/` body `{ group_id: UUID | null, ordered_ids: list[UUID] }` → in one `transaction.atomic`, for each id: set `group=group_id, group_ordering=i+1`. Validates all sessions belong to current workspace and (if group_id is non-null) the group does too; 400 otherwise.
- [ ] AC-7-10: Existing `ChatSession` PATCH endpoint (if any; otherwise add) accepts `{ group: UUID | null }` to move a single chat into/out of a group without reorder. Group ordering for the destination is set to `max(group_ordering)+1` (appended to end) atomically.

**Backend — Tests:**
- [ ] AC-7-11: Pytest `test_chatgroup_crud` covers list / create / rename / delete with workspace isolation (403 on foreign workspace ids).
- [ ] AC-7-12: Pytest `test_chatgroup_reorder_atomic` — POST reorder with mixed valid + foreign id → 400, no partial write (verify with pre/post state).
- [ ] AC-7-13: Pytest `test_chatsession_reorder_in_group` — moving chats between groups updates both group + group_ordering atomically.
- [ ] AC-7-14: Pytest `test_chatgroup_delete_sets_chats_to_null` — delete group with 3 chats → all 3 chats have `group=NULL` after.
- [ ] AC-7-15: Pytest `test_chatgroup_name_unique_per_workspace` — POST with duplicate name in same workspace → 400; duplicate name across workspaces → OK.

**Frontend — Types:**
- [ ] AC-7-16: `frontend-ui/src/types/search.ts` adds:
  ```ts
  export interface ChatGroup {
    id: string;
    name: string;
    ordering: number;
    session_count: number;
    created_at: string;
    updated_at: string;
  }
  ```
- [ ] AC-7-17: Existing `ChatSession` interface gains `group: string | null` and `group_ordering: number`.

**Frontend — RTK Query:**
- [ ] AC-7-18: New endpoints in `frontend-ui/src/store/searchSlice.ts` (or a new `chatGroupsApi.ts` injected into the same `searchApi`):
  - `getChatGroups: builder.query<ChatGroup[], void>` — provides `[{ type: 'ChatGroups', id: 'LIST' }]`
  - `createChatGroup: builder.mutation<ChatGroup, { name: string }>` — invalidates ChatGroups list
  - `renameChatGroup: builder.mutation<ChatGroup, { id: string; name: string }>` — invalidates `{ type: 'ChatGroups', id }`
  - `deleteChatGroup: builder.mutation<void, { id: string }>` — invalidates ChatGroups list + ChatSessions list (chats fall back to NULL)
  - `reorderChatGroups: builder.mutation<void, { ordered_ids: string[] }>` — invalidates ChatGroups list. Optimistic update via `updateQueryData`.
  - `moveChatToGroup: builder.mutation<void, { sessionId: string; groupId: string | null }>` — PATCHes session. Invalidates ChatSessions list + the source/dest ChatGroup session_count entries.
  - `reorderChatsInGroup: builder.mutation<void, { groupId: string | null; ordered_ids: string[] }>` — invalidates ChatSessions list. Optimistic.
- [ ] AC-7-19: Cache tags added to `searchApi` `tagTypes`: `'ChatGroups'`.
- [ ] AC-7-20: `getChatSessions` (existing) returns sessions with the new `group` + `group_ordering` fields automatically via the extended serializer.

**Frontend — UI in RecentChats sidebar:**
- [ ] AC-7-21: New component `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/GroupSection.tsx` — renders one group header (chevron + name + count + kebab menu) and a `Collapse` containing `SortableContext` with chat rows.
- [ ] AC-7-22: New component `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/UngroupedSection.tsx` — identical shape but with header label `t('chat.groups.ungrouped')` and no kebab menu. Always rendered first.
- [ ] AC-7-23: New component `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/SortableChatRow.tsx` — wraps existing chat row in `useSortable`. Drag handle = whole row (not a separate handle icon — matches Slack DM-list pattern).
- [ ] AC-7-24: New hook `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/hooks/useGroupCollapseState.ts` — manages collapsed-set in `localStorage` key `mm.chatGroups.collapsed.<workspaceId>` (JSON-encoded `string[]` of group ids). Returns `(isCollapsed, toggleCollapsed)` per group id.
- [ ] AC-7-25: New hook `useChatGroupDnD` wraps `@dnd-kit/core`'s `DndContext` and handles the cross-container drop with the existing PROJ-14 kanban pattern. On drop:
  - Same-container reorder of chats → `reorderChatsInGroup({ groupId, ordered_ids })`
  - Cross-container chat drop → `moveChatToGroup({ sessionId, groupId: destGroupId })` then `reorderChatsInGroup` if precise position needed (single round-trip path covers most cases via append; finer positioning issues a follow-up reorder call).
  - Group reorder → `reorderChatGroups({ ordered_ids })`
- [ ] AC-7-26: `RecentChats.tsx` panel content renders: header with "+ New group" button, then UngroupedSection, then sorted GroupSections (by `ordering`), all wrapped in one `DndContext` from `useChatGroupDnD`.
- [ ] AC-7-27: "+ New group" → inline `TextField` with autofocus appears at the bottom; Enter commits, Esc cancels. POST `createChatGroup` on commit; new group appended (highest ordering).
- [ ] AC-7-28: Group kebab menu: `Rename` (in-place TextField), `Delete` (MUI Dialog: "Delete group '<name>'? N chats will move to Ungrouped." with `Cancel` + `Delete` buttons).
- [ ] AC-7-29: All new strings have i18n keys under `chat.groups.*`:
  - `ungrouped` — "No group" / "Keine Gruppe"
  - `newGroup` — "+ New group" / "+ Neue Gruppe"
  - `newGroupPlaceholder` — "Group name…" / "Gruppenname…"
  - `rename` — "Rename" / "Umbenennen"
  - `delete` — "Delete" / "Löschen"
  - `deleteConfirmTitle` — "Delete group '{{name}}'?" / "Gruppe '{{name}}' löschen?"
  - `deleteConfirmBody` — "{{count}} chat(s) will move to '{{ungroupedLabel}}'." / "{{count}} Chat(s) wandern in '{{ungroupedLabel}}'."
  - `dragHint` (visually hidden, aria-only) — "Drag to reorder or move between groups" / "Ziehen zum Sortieren oder zwischen Gruppen verschieben"
  - `sessionCount` — "{{count}} chat" / "{{count}} chats" (plural)
  - `duplicateName` — "A group with this name already exists" / "Eine Gruppe mit diesem Namen existiert bereits"
- [ ] AC-7-30: Optimistic updates: DnD drop fires the mutation immediately AND updates the local RTK cache via `dispatch(searchApi.util.updateQueryData('getChatSessions', undefined, draft => { ... }))`. On mutation reject → revert + notistack error.
- [ ] AC-7-31: Vitest tests:
  - `GroupSection.test.tsx` — render expanded/collapsed; click chevron toggles collapse; kebab menu items present.
  - `UngroupedSection.test.tsx` — no kebab; always rendered.
  - `useChatGroupDnD.test.ts` — mocked `@dnd-kit/core` events trigger the right mutation per drop type.
  - `useGroupCollapseState.test.ts` — read/write localStorage round-trip; handles missing entry.
  - `RecentChats.test.tsx` — full panel renders Ungrouped + N groups in correct order; "+ New group" click opens inline input; commit fires mutation.

### Edge Cases
- [ ] EC-7-1: Duplicate group name in same workspace → backend 400 with code `chatgroup_duplicate_name`; frontend inline error inside the create input.
- [ ] EC-7-2: Group deleted from another tab while DnD is active in this tab → drop's mutation 404s; frontend reverts the optimistic update, surfaces snackbar `chat.groups.deletedElsewhere`. RTK invalidation refreshes the list.
- [ ] EC-7-3: Concurrent reorder from two tabs → both POSTs hit `transaction.atomic`; whichever commits second wins. UI auto-refreshes to the winning order via the invalidation tag. No partial-state corruption.
- [ ] EC-7-4: 100+ chats in one group → `Collapse` unmounts when collapsed (MUI default); expand renders all. No virtualization for MVP. Acceptable up to ~200 chats per group.
- [ ] EC-7-5: User clicks chevron during a drag → drag has pointer capture (dnd-kit default); chevron click ignored.
- [ ] EC-7-6: Empty group name → backend `models.CharField(blank=False)` + serializer `required=True` reject; inline error.
- [ ] EC-7-7: Workspace switch mid-DnD → component unmounts + remounts; dnd-kit cleanup runs in unmount; no zombie drag state.
- [ ] EC-7-8: Active chat (currently shown in main panel) gets moved by DnD → active state preserved (driven by `activeSessionId`, not by sidebar position).
- [ ] EC-7-9: User renames group to empty string → inline error, save aborted; original name restored on blur.
- [ ] EC-7-10: User dropped a chat onto a group header (not into the chat list area) → treat as "append to end of that group" (max + 1).
- [ ] EC-7-11: localStorage quota exceeded when persisting collapse set → silent fail (catch + console.warn once); collapse state stays in-memory for the session.
- [ ] EC-7-12: Group with 0 chats → still rendered; can be deleted normally. Count badge reads `0`.

### Out of Scope
- Nested groups.
- Sharing groups between workspace members (private to user — the `created_by` field is recorded but not used for filtering in MVP).
- Tags / multi-group membership (M2M) — single FK only.
- Group icons / colors (text + count only).
- Smart groups (auto-grouping by niche or date).
- Search across groups (existing chat search already covers globally).
- Group-level archive / pin (deferred until usage shows need).
- Drag chats from Recent → Group via the main chat list (only sidebar DnD).
- Bulk move (multi-select chats and move N at once).

---

## Item 8 — Canvas Artboard Color Picker: RGB → RGBA (Alpha Slider)

### Context

Today `frontend-ui/src/views/designs/board/partials/rightPanel/PanelArtboardState.tsx` (lines 491–528) uses a native `<input type="color">` paired with a 7-char-max-length `TextField` for hex (`#RRGGBB` only — no alpha). `ArtboardData.backgroundColor: string` (`board/types/index.ts:230`) stores the hex string. Users want a transparent artboard background for transparent-PNG mockups and to compose designs over the workspace grid pattern.

Library `react-colorful` is already a dep (used by `views/publish/.../BackgroundColorPicker.tsx`). It ships `RgbaStringColorPicker` which returns `rgba(r, g, b, a)` strings natively and supports an alpha slider out of the box. The Konva renderer (used by the artboard canvas) accepts `rgba()` strings directly — no Konva changes needed.

### Decisions

- **Storage format**: `rgba(R, G, B, A)` string. `react-colorful` outputs it natively; Konva consumes it natively; no conversion.
- **Backwards-compat**: existing `#RRGGBB` hex stays valid — Konva accepts both. The picker initializes from the existing string regardless of format. On change, output is always `rgba(...)`.
- **No DB migration**: `backgroundColor` is `string` in TypeScript and serialized as a JSON string in `BoardLayoutNode.backgroundColor`; Postgres just stores text. Format change is transparent.
- **Checker-pattern background on the swatch**: CSS `linear-gradient` + `background-size: 8px 8px` to render the classic transparency checkerboard behind the color so partial alpha is visually obvious.
- **Scope strictly to Artboard background**: editor tool params (`ColorRemovalToolParams`, `WatermarkToolParams`) keep current pickers. Separate fix if needed.

### User Stories
- As a POD seller designing for transparent-PNG output, I want to set the artboard background to fully transparent (or partial alpha) so I can preview designs on a checker-pattern background without exporting first.
- As a POD seller working with semi-transparent overlays, I want an alpha slider in the color picker so I can dial in 50% white instead of switching to a workaround.
- As a POD seller, I want the color swatch to show me the current alpha at a glance via a checker-pattern background.

### Acceptance Criteria

**New Component:**
- [ ] AC-8-1: New component `frontend-ui/src/views/designs/board/partials/rightPanel/ArtboardColorPicker.tsx`. Wraps:
  - A swatch button (32×32, `borderRadius: theme.shape.borderRadius`) showing the current color over a checker-pattern background.
  - On click → MUI `Popover` (anchored below the swatch) containing:
    - `RgbaStringColorPicker` from `react-colorful` (200×180).
    - A hex text input below it (accepts `#RRGGBB` or `#RRGGBBAA`).
    - An alpha-as-percentage label (read-only, e.g. "Alpha: 50%") for clarity — derived from the rgba string.
- [ ] AC-8-2: Props: `value: string` (rgba/hex/hex8) and `onChange(rgba: string)` — emits canonical `rgba(R, G, B, A)` strings on every change.
- [ ] AC-8-3: Internal state initialization: parse `value` via a small helper `parseColorToRgba(s: string): string` that accepts:
  - `rgba(R, G, B, A)` → pass-through
  - `#RRGGBB` → `rgba(R, G, B, 1)`
  - `#RRGGBBAA` → `rgba(R, G, B, A/255)`
  - Any other string → fallback to `rgba(255, 255, 255, 1)` (white opaque).
- [ ] AC-8-4: Hex input accepts both 6-char and 8-char hex (regex `/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/`). Invalid hex triggers the existing shake-animation pattern from `views/publish/.../BackgroundColorPicker.tsx`.
- [ ] AC-8-5: Hex input commits on Enter or blur; live `react-colorful` change updates the rgba state immediately (Popover stays open during edit).
- [ ] AC-8-6: Alpha slider is the built-in `react-colorful` `RgbaStringColorPicker` alpha row (no custom slider). Values 0–1.
- [ ] AC-8-7: Swatch button's checker-pattern: implemented via styled `Box` with `background-image: conic-gradient(...)` or `linear-gradient` (classic 8px-checker recipe) sized at 8×8; foreground color overlay sits on top with the current rgba.
- [ ] AC-8-8: Popover `onClose` (backdrop click + Escape) closes without losing the current value — last `onChange` already committed.

**Integration in PanelArtboardState:**
- [ ] AC-8-9: `PanelArtboardState.tsx` lines 491–528: replace the `Box component="input" type="color"` + `TextField` block with `<ArtboardColorPicker value={artboard.backgroundColor} onChange={(rgba) => onUpdate(artboard.id, { backgroundColor: rgba })} />`.
- [ ] AC-8-10: Remove `handleBgColorChange` handler (lines 227–232) — replaced by the inline `onChange` in AC-8-9.
- [ ] AC-8-11: Existing `Section` + `SectionLabel` + `FieldRow` structure preserved (just the inner color input swap).

**ArtboardData & Rendering:**
- [ ] AC-8-12: `ArtboardData.backgroundColor: string` (`board/types/index.ts:230`) — type stays `string`. JSDoc updated: `/** Background color — accepts hex (#RRGGBB), hex8 (#RRGGBBAA), or rgba(R,G,B,A). */`
- [ ] AC-8-13: Existing Konva renderer reads `backgroundColor` and passes it to the Konva shape `fill` prop. Verify no parsing assumes hex-only. If the renderer does a regex check that excludes rgba, relax it.
- [ ] AC-8-14: Artboard export (`useExportArtboards.ts`) preserves transparency for PNG output: existing export uses Konva's `toDataURL({ pixelRatio, mimeType: 'image/png' })`. Verify alpha makes it into the PNG bytes. Add a manual smoke step to the QA checklist (open exported PNG in macOS Preview / GIMP — checkerboard visible).

**i18n:**
- [ ] AC-8-15: New i18n keys (EN + DE):
  - `design.panel.bgColor` (existing — kept)
  - `design.panel.bgColor.alphaLabel` — "Alpha: {{percent}}%" / "Alpha: {{percent}}%"
  - `design.panel.bgColor.hexLabel` — "Hex" / "Hex"
  - `design.panel.bgColor.invalidHex` — "Invalid color value" / "Ungültiger Farbwert"

**Tests:**
- [ ] AC-8-16: Vitest `ArtboardColorPicker.test.tsx`:
  - Swatch click opens Popover.
  - `RgbaStringColorPicker` mocked with controlled value; alpha-slider change → `onChange` called with new rgba.
  - Hex input accepts `#FF5A4F80`; value commits; `onChange` called with `rgba(255, 90, 79, 0.5...)`.
  - Hex input rejects `#XYZ`; shake class applied; `onChange` NOT called.
  - Swatch background includes the checker-pattern element (query for the styled element).
- [ ] AC-8-17: Vitest helper test for `parseColorToRgba` — covers all four input shapes (rgba pass-through, 6-hex, 8-hex, fallback).
- [ ] AC-8-18: Existing `PanelArtboardState` tests pass after the swap (no test depends on the native `<input type="color">`).

### Edge Cases
- [ ] EC-8-1: Existing artboards persisted with `#RRGGBB` → loaded by picker as `rgba(R, G, B, 1)`; alpha slider sits at 100%. No migration needed.
- [ ] EC-8-2: Existing artboards persisted with `#RRGGBBAA` (hex8) from a hypothetical earlier hack → parser handles it (AC-8-3) and presents as rgba.
- [ ] EC-8-3: Alpha exactly 0 → swatch shows just the checker-pattern, hex shows `#RRGGBB00`. Konva renders nothing for the fill; the artboard outline + workspace grid show through.
- [ ] EC-8-4: Concurrent edit (artboard updated by another action, e.g. preset apply) → existing `artboardHydration` overwrites local `backgroundColor`; Popover closes if open via the standard `value` change → `parseColorToRgba` re-init.
- [ ] EC-8-5: Color picker open + user clicks elsewhere → MUI Popover's default `ClickAwayListener` closes it (no custom logic).
- [ ] EC-8-6: User types only `#FF` (incomplete) and blurs → invalid → shake → input restored to last valid rgba string.
- [ ] EC-8-7: Konva pixel-ratio export with alpha < 1 → PNG bytes carry alpha channel. Verified via QA smoke (out-of-band).
- [ ] EC-8-8: PNG opened in a viewer that doesn't render alpha (very old browsers, some thumbnail generators) → falls back to opaque white background. Acceptable degradation.

### Out of Scope
- Applying the new picker to other color inputs in the editor (`ColorRemovalToolParams`, `WatermarkToolParams`) — separate fix.
- Server-side artboard storage migration to a structured color shape (`{r,g,b,a}` JSON).
- Eyedropper / pick-color-from-image.
- Predefined alpha swatches.
- Per-layer alpha (this is artboard-bg only; layer opacity already exists separately).

---

## QA Notes

- Items 1, 4, 7 each touch BOTH backend and frontend — make sure pytest + Vitest both pass before commit.
- Item 7 is the largest single item: backend CRUD tests, reorder atomicity tests, frontend DnD test surface.
- Item 8 needs a visual smoke (transparent artboard → export PNG → open in macOS Preview, check checkerboard).
- Run `npm run lint && npm run test:ci` from `frontend-ui/`; run `docker compose exec web pytest` from repo root. Zero failures required.
- ESLint + ruff across the WHOLE touched tree, not just changed files (project rule `feedback_lint_full_scope`).
- After backend model changes (Items 4 + 7): `docker compose restart worker worker-research worker-slogan worker-design worker-agent worker-search worker-scraper scheduler` — RQ workers don't hot-reload (project memory `feedback_restart_workers_after_model_changes`).

## Implementation Order

Each item committed separately with its conventional-commit type. Branch merged with `--merge` to preserve commits for release-please.

**Updated 2026-05-28 (review pass):** Item 4 moved before Item 2 so Item 2's Retry button can recover `referenced_niche_id` from the prior user message.

1. Item 1 (SSE → POST refactor) — foundation; Item 3 depends on `stop()` semantics.
2. Item 3 (Send → Stop toggle) — small, builds on Item 1.
3. Item 4 (@Niche persistence) — backend migration + serializer + UI render. Prerequisite for Item 2 Retry.
4. Item 5 (Auto-scroll) — frontend-only, independent.
5. Item 6 (Topbar icon style) — trivial polish.
6. Item 2 (Web-search fallback) — small, frontend-only error-path polish; Retry uses Item 4's persisted niche FK.
7. Item 7 (Chat Groups) — largest single item; backend migration + CRUD + DnD UI.
8. Item 8 (Canvas color picker RGBA) — independent from chat work; ends the branch.

## Out of Scope (entire FIX)

- Server-side SearXNG engine reconfiguration (Tor, Mojeek, Qwant) — handled live on prod via OPS.
- Migration of Vane backend to Tavily/Serper/Brave Search API — separate PROJ.
- Backend emission of the `web_search_unavailable` SSE marker (frontend ready to consume, backend ticket separate).
- Persisting partial assistant message on user-initiated Stop.
- Multi-group membership (M2M) for chats; nested chat-groups.
- Applying new alpha color picker to editor tool params (ColorRemoval, Watermark).
- Mobile-specific responsive fixes for any chat or canvas surface (PROJ-30 scope).
- WebSocket migration (POST + SSE is the chosen direction).

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview

This is a multi-concern bundle. Architecture is presented per-item with shared sections at the end (data model summary, file structure, dependencies, risks). No new third-party packages — every piece reuses existing infra:
- `@dnd-kit/core` + `@dnd-kit/sortable` (already used by PROJ-14 Kanban) for Item 7.
- `react-colorful` (already used by `views/publish/.../BackgroundColorPicker.tsx`) for Item 8.
- Native `fetch` + `ReadableStream` + `TextDecoder` for Item 1 (no SSE-parser library).
- Existing `notistack`, `react-i18next`, `react-hook-form`, MUI v7 for everything else.

### Item 1 — SSE Streaming Refactor

**Component Structure (no change):**

```
ChatPanel
+-- ChatMessageList
+-- ChatInputBar
    +-- SmartTextarea
    +-- SendButton            (Item 3 modifies this)
    +-- NicheChip
    +-- ModelPopoverButton
    +-- ModePopoverButton

useSendMessageStream (hook)   <-- internals rewritten, signature unchanged
+-- start(args)
+-- stop()
+-- isStreaming
```

**What changes internally:**

| Before | After |
|---|---|
| `new EventSource(url, { withCredentials })` | `fetch(url, { method: 'POST', body, signal })` |
| Browser parses `event:` + `data:` lines | New helper `parseSSEStream` parses chunks via `TextDecoder` |
| `es.addEventListener(type, handler)` | Same handler map; dispatched by the parser |
| `EventSource.close()` | `AbortController.abort()` |
| Module-level `activeEventSource` | Module-level `activeAbortController` |

**Why POST + manual parser, not WebSockets:**

| Decision | Why |
|---|---|
| POST (not GET) | Body unbounded; no URL-length cap. |
| Manual SSE parser (not eventsource-parser lib) | ~30 LOC. No new dep. Avoids version-pinning a tiny library. |
| Keep wire format identical | Backend SSE stays the same; only the HTTP envelope changes. |
| AbortController (not fork+close) | Standard fetch cancellation; cleaner stop semantics for Item 3. |
| Drop auto-reconnect | Was a source of duplicate-chunk bugs in PROJ-20. Silence-watchdog covers stalled streams. |

### Item 2 — Web-Search Fallback (Frontend)

**Component Structure:**

```
ChatMessageList
+-- ErrorBubble                   (existing)
    +-- RetryButton               (NEW — only for web_search_unavailable error)
+-- (existing message types)

useSendMessageStream
+-- onError(SSEErrorEvent)        (extended: detects web_search_unavailable marker)
    +-- snackbar (once per session)
    +-- persisted ERROR ChatMessage with body i18n key
```

**Flow:**
1. SSE `error` event arrives with `{ error: 'web_search_unavailable' }`.
2. Hook checks per-session-seen ref. If not seen → info snackbar.
3. Hook lets the existing PROJ-29 BUG-4 ERROR-bubble path persist the message (backend already emits a synthetic ERROR ChatMessage on stream error). The bubble content matches the i18n body key.
4. `ChatMessageList` checks: if message is ERROR type AND content matches i18n body → render Retry button.
5. Retry button click → `useSendMessageStream.start(originalArgs)`.

### Item 3 — Send → Stop Toggle

**Component Structure:**

```
ChatInputBar
+-- SendButton
    +-- props.isStreaming        (NEW — reads from chatBar slice)
    +-- props.onStop             (NEW — wired to useSendMessageStream.stop)
    +-- renders SendIcon | StopIcon based on isStreaming
```

**No new state.** `isStreaming` is already in Redux (`s.chatBar.streamingAssistantMessage.isStreaming`).

### Item 4 — @Niche Persistence

**Data Model — `ChatMessage` adds one field:**

| Field | Type | Nullable | Index | Notes |
|---|---|---|---|---|
| `referenced_niche` | FK → `niche_app.Niche` | yes | yes | `on_delete=SET_NULL`; set only on user-role messages. |

**API:**

| Endpoint | Method | Change |
|---|---|---|
| `/api/chat/sessions/<id>/messages/stream/` | POST/GET | Read `niche_id` from body/query → persist on user ChatMessage as `referenced_niche_id`. Cross-workspace niche rejected (400). |
| `/api/chat/sessions/<id>/messages/` | GET | Serializer extended with `referenced_niche_id` + `referenced_niche_name`. Queryset uses `select_related('referenced_niche')`. |
| `/api/chat/share/<token>/` | GET | Public serializer strips `referenced_niche_id` (workspace-scoped data). |

**Component Structure:**

```
ChatMessageList
+-- MessageRow (role=user)
    +-- NicheChip (NEW position: above bubble) ← rendered if referenced_niche_name
    +-- UserBubble
    +-- UserMessageToolbar
```

### Item 5 — Auto-Scroll

**Component Structure (additions inside existing list):**

```
ChatMessageList
+-- ScrollContainer (ref)
    +-- (messages)
    +-- StreamingBubble
    +-- BottomSentinel (NEW <div> at end)
+-- JumpToLatestButton (existing)
+-- IntersectionObserver (NEW — tracks BottomSentinel ↔ ScrollContainer)
    +-- userAtBottomRef = entry.isIntersecting
```

**Triggers:**

| Trigger | Action | Behavior |
|---|---|---|
| Initial mount / messages-empty-to-nonempty | `useLayoutEffect` → `scrollTo(scrollHeight, 'instant')` | Pre-paint. |
| `activeSessionId` change | List re-mounts (keyed by session id) → mount trigger fires. | Pre-paint. |
| New chunk during streaming + userAtBottom | rAF-coalesced `scrollTo(scrollHeight, 'smooth')` | Per frame, not per chunk. |
| New persisted message + userAtBottom | After-paint effect → `scrollTo(scrollHeight, 'smooth')` | Once. |
| User scrolls up beyond threshold | `userAtBottomRef = false`, auto-scroll silent-disable. | JumpToLatest visible. |
| JumpToLatest click | `scrollTo` + `userAtBottomRef = true` | Re-engage. |

### Item 6 — Topbar Icon Style

**Component Structure (style-only):**

```
Topbar
+-- ColorModeToggle      <-- visual reference
+-- LanguageMenu         <-- visual reference
+-- ChatIconButton       <-- align sx/size/aria to match siblings
```

No state changes, no behavior changes. CSS sx-shape copied from `ColorModeToggle.tsx`.

### Item 7 — Chat Groups (Full Feature)

**Data Model:**

| New Model: `ChatGroup` | | | |
|---|---|---|---|
| Field | Type | Notes | Index |
| `id` | UUID PK | — | PK |
| `workspace` | FK → Workspace | CASCADE | yes |
| `created_by` | FK → User | CASCADE | — |
| `name` | CharField(80) | unique per workspace | — |
| `ordering` | PositiveIntegerField | default 0; resequenced on drop | yes (composite w/ workspace) |
| `created_at` | DateTimeField | auto_now_add | — |
| `updated_at` | DateTimeField | auto_now | — |

| `ChatSession` adds: | | | |
|---|---|---|---|
| Field | Type | Notes | Index |
| `group` | FK → ChatGroup | SET_NULL; null = "Ungrouped" | yes |
| `group_ordering` | PositiveIntegerField | default 0 | yes (composite w/ group) |

**API:**

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/chat/groups/` | GET | List groups (workspace-scoped). |
| `/api/chat/groups/` | POST | Create group. Auto-appended ordering. |
| `/api/chat/groups/<id>/` | PATCH | Rename. |
| `/api/chat/groups/<id>/` | DELETE | Delete; chats fall back to NULL via SET_NULL. |
| `/api/chat/groups/reorder/` | POST | `{ ordered_ids }` → resequence all in one txn. |
| `/api/chat/sessions/<id>/` | PATCH | `{ group }` → move chat to a different group (appended). |
| `/api/chat/sessions/reorder-in-group/` | POST | `{ group_id, ordered_ids }` → resequence within group in one txn. |

All endpoints: `CookieJWTAuthentication`, `IsAuthenticated`, workspace-scoped filter on `X-Workspace-Id`.

**Component Structure (sidebar):**

```
RecentChats Panel
+-- DndContext (single, wraps everything)
|   +-- Header
|   |   +-- "+ New group" button → inline TextField
|   +-- UngroupedSection
|   |   +-- SortableContext (chats)
|   |   |   +-- SortableChatRow x N
|   +-- GroupSection (per user group, sorted by ordering)
|   |   +-- Header
|   |   |   +-- Chevron (collapse toggle)
|   |   |   +-- Name (rename on dblclick or kebab→Rename)
|   |   |   +-- Count badge
|   |   |   +-- KebabMenu (Rename | Delete)
|   |   +-- Collapse (MUI)
|   |       +-- SortableContext (chats)
|   |           +-- SortableChatRow x N
|   +-- DeleteGroupDialog (MUI Dialog, mounted at panel root)

Hooks
+-- useGroupCollapseState → localStorage Map<workspaceId, Set<groupId>>
+-- useChatGroupDnD → DndContext handlers
+-- chatGroupsApi (RTK Query slice extension)
```

**DnD Drop Routing:**

| Source → Target | Action |
|---|---|
| Chat → same-group (different position) | `reorderChatsInGroup({ groupId, ordered_ids })` |
| Chat → other-group | `moveChatToGroup` then (if position not last) `reorderChatsInGroup` |
| Group → reorder vs siblings | `reorderChatGroups({ ordered_ids })` |

All drops are optimistic (RTK `updateQueryData`) with revert on mutation error.

### Item 8 — Canvas Color Picker RGBA

**Component Structure:**

```
PanelArtboardState
+-- Section "Color"
    +-- ArtboardColorPicker (NEW)
        +-- SwatchButton (CSS checker-pattern bg + current color overlay)
        +-- Popover (MUI)
            +-- RgbaStringColorPicker (react-colorful)
            +-- HexInput (TextField, accepts #RRGGBB or #RRGGBBAA)
            +-- AlphaLabel "Alpha: NN%" (read-only)

Helper
+-- parseColorToRgba(s: string): string
    +-- handles rgba pass-through, 6-hex, 8-hex, fallback
```

**Storage format:** `rgba(R, G, B, A)` string. Konva consumes natively. Existing hex values still parse on load. No DB migration.

### Shared — Tech Decisions

| Decision | Why |
|---|---|
| Single PR for 8 items | User-requested. Merge via `--merge` so release-please sees individual conventional commits. |
| Phase-by-phase commits | Reviewable diffs; one item = one commit; rollback granularity. |
| No new packages | Every piece reuses installed libs. Lowers supply-chain + audit cost. |
| No DB migration for Item 8 | `backgroundColor` is a string in TS + JSON; Postgres stores text; format change is transparent. |
| Migrations 0009 + 0010 are additive only | Reversible. No data backfill needed. Default values match existing semantics ("no niche", "no group"). |
| Backend emits SSE error string `web_search_unavailable` (FUTURE) | Frontend ready to consume; emission ticketed separately so this PR doesn't block on backend agent changes. |
| Integer + resequence ordering for groups/chats | Deterministic, easy to test, fits our scale (≤200 chats/group). Float-spaced is more complex; linked-list is overkill. |
| `referenced_niche` is FK (not denormalised name) | Survives niche renames; queryable; SET_NULL cleanly handles deletions. |
| Read-only NicheChip in history | User explicitly chose visual-only; saves routing wiring; matches scope of a "history marker". |
| New chats default to Ungrouped | Predictable. Inherit-from-active would require a "currently focused group" state we don't have. |

### Shared — Files Modified

| File | Item | Change |
|---|---|---|
| `django-app/search_app/models.py` | 4 + 7 | Add `referenced_niche` to ChatMessage; add ChatGroup model; add `group` + `group_ordering` to ChatSession. |
| `django-app/search_app/migrations/0009_chatmessage_referenced_niche.py` | 4 | **NEW** auto-generated. |
| `django-app/search_app/migrations/0010_chatgroup_and_session_group.py` | 7 | **NEW** auto-generated. |
| `django-app/search_app/api/serializers.py` | 4 + 7 | Extend ChatMessageSerializer; new ChatGroupSerializer; extend ChatSessionSerializer. |
| `django-app/search_app/api/views.py` | 1 + 4 + 7 | Add POST to stream view; persist `referenced_niche_id` on user message; new `ChatGroupViewSet` + 2 reorder endpoints. |
| `django-app/search_app/api/urls.py` | 7 | Register `ChatGroupViewSet` + reorder endpoints. |
| `django-app/search_app/tests/test_chat_session_message_stream_view.py` | 1 + 4 | POST happy-path tests; referenced_niche persistence tests. |
| `django-app/search_app/tests/test_chat_groups.py` | 7 | **NEW** — CRUD + reorder + workspace iso tests. |
| `frontend-ui/src/hooks/useSendMessageStream.ts` | 1 + 2 | Rewrite to fetch + ReadableStream + AbortController; detect `web_search_unavailable`. |
| `frontend-ui/src/hooks/__tests__/useSendMessageStream.test.tsx` | 1 + 2 | Replace EventSource mock with ReadableStream mock; add fallback marker tests. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/ChatInputBar/partials/SendButton.tsx` | 3 | Add isStreaming + onStop; render Send vs Stop icon. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/ChatInputBar/partials/__tests__/SendButton.test.tsx` | 3 | **NEW** test. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/ChatInputBar/index.tsx` | 3 | Wire onStop prop. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/ChatMessageList.tsx` | 2 + 4 + 5 | Render Retry on web_search_unavailable ERROR; render NicheChip on user rows with referenced_niche_name; sentinel + IntersectionObserver. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/__tests__/ChatMessageList.test.tsx` | 2 + 4 + 5 | New cases for each. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats.tsx` | 7 | Replace flat list with DndContext + Ungrouped + Groups sections. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/GroupSection.tsx` | 7 | **NEW**. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/UngroupedSection.tsx` | 7 | **NEW**. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/SortableChatRow.tsx` | 7 | **NEW**. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/hooks/useGroupCollapseState.ts` | 7 | **NEW**. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/hooks/useChatGroupDnD.ts` | 7 | **NEW**. |
| `frontend-ui/src/components/MultiPurposeDrawer/panels/RecentChats/__tests__/*.test.tsx` | 7 | **NEW** suite. |
| `frontend-ui/src/store/searchSlice.ts` | 7 | Extend with chatGroups endpoints + tagTypes 'ChatGroups'. |
| `frontend-ui/src/components/topbar/Topbar.tsx` (or wherever the chat IconButton lives) | 6 | Align sx with ColorModeToggle. |
| `frontend-ui/src/types/search.ts` | 4 + 7 | Add `referenced_niche_id/name`, `group`, `group_ordering`, `ChatGroup` interface. |
| `frontend-ui/src/views/designs/board/partials/rightPanel/ArtboardColorPicker.tsx` | 8 | **NEW** component. |
| `frontend-ui/src/views/designs/board/partials/rightPanel/__tests__/ArtboardColorPicker.test.tsx` | 8 | **NEW** test. |
| `frontend-ui/src/views/designs/board/partials/rightPanel/PanelArtboardState.tsx` | 8 | Swap native input for ArtboardColorPicker. |
| `frontend-ui/src/views/designs/board/utils/parseColorToRgba.ts` | 8 | **NEW** helper. |
| `frontend-ui/src/views/designs/board/utils/__tests__/parseColorToRgba.test.ts` | 8 | **NEW** test. |
| `frontend-ui/public/locales/en/translation.json` | 2,3,4,7,8 | New i18n keys. |
| `frontend-ui/public/locales/de/translation.json` | 2,3,4,7,8 | New i18n keys. |

### Shared — Dependencies

No new packages. All work uses installed deps:
- `@dnd-kit/core`, `@dnd-kit/sortable` (already in `package.json` for PROJ-14 Kanban).
- `react-colorful` (already in `package.json` for PROJ-11 Publish color picker).
- MUI v7, `react-i18next`, `notistack`, `react-redux`, `@reduxjs/toolkit` — existing.
- Django 5.2, DRF, `django-allauth` — existing.

### Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| SSE parser bug breaks all streaming | Low | New parser is ~30 LOC, 13+ existing Vitest assertions ported; manual smoke on dev before commit. |
| Item 7 DnD optimistic update desyncs on rapid drops | Medium | RTK `updateQueryData` rollback path on mutation reject + invalidation tag forces refetch. |
| Migration 0010 collides with concurrent dev migrations | Low | Coordinate with PROJ-29 (which is on a separate branch); rebase + remake if needed. |
| RQ workers serving stale model classes after deploy | Medium | Documented restart step in deployment notes; `feedback_restart_workers_after_model_changes`. |
| Canvas RGBA breaks rendering on existing hex-stored artboards | Low | `parseColorToRgba` fallback covers all four shapes; visual smoke on a hex-only project before commit. |
| Vane backend never emits `web_search_unavailable` | Medium | Item 2 gracefully no-ops if marker absent; existing connectionLost UI takes over. |
| Public share view leaks workspace-private niche names | Low | Item 4 AC-4-EC-5 explicitly tests the share serializer strips it. |
| Group rename hits unique constraint mid-edit | Low | Backend 400 surfaces inline form error; user retries with different name. |

### Open Questions

None — all decisions locked from /requirements multi-choice round.

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
