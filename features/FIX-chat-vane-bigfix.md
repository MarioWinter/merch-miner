# FIX: Chat / Vane End-to-End Repair + UX Polish

## Status: In Review
**Created:** 2026-05-30
**Last Updated:** 2026-05-30
**Type:** Mixed Bundle (1 backend cache bug + 1 backend agent fix + 1 frontend cache leak + 1 frontend UX feature + 1 infra persistence). One PR, plus one cross-repo commit in `MarioWinter/local-ai-packaged` for infra.
**Branch:** `fix/chat-vane-bigfix`
**Merge Strategy:** `--merge` (preserve individual conventional commits for release-please).

## Dependencies
- PROJ-20 (Chat UX Perplexity-Parity) — In Review; chat input bar + streaming pipeline live here.
- PROJ-29 (Niche-Data Agentic RAG Chat) — In Review; niche-chat-agent + ThinkingStrip + optimistic chat-message hook live here.
- PROJ-17 (Deep Web Search) — Deployed; `VaneService` + Vane connectivity live here.
- Vane fork patch `1160c86` (convertToOpenAIMessages null-content) — already on `MarioWinter/Vane:merch-miner-patches` branch but the image wasn't being deployed prior to this FIX (see Item 5 root cause).
- ScraperOps residential proxy (existing 25-slot subscription, see memory `project_800k_scrape_strategy.md`) — Plan B if the engine swap in Item 5 loses ground again. Not wired in this FIX.

## Scope Summary

| # | Area | Type | Commit |
|---|---|---|---|
| 1 | `VaneService` provider-UUID cache ignored `chat_model_name` arg — model-switch silently no-op'd after first request | Bug | `fix(chat)` `c2c49a4` |
| 2 | niche-chat-agent `web_search` tool returned `sources: []` because Vane's non-streaming endpoint doesn't carry sources — LLM produced "could not find relevant info" with no citations | Bug | `fix(chat)` `3a1f2d7` |
| 3 | Optimistic `temp_*` user-message bubble lingered next to server-persisted row after stream `done` — chat showed the question twice | Bug | `fix(chat)` `1c67275` |
| 4 | Streaming border-effect on `ChatInputBar` (rotating conic-gradient ring) so the user sees the chat is responding | Feature | `feat(chat)` `b5a5c75` |
| 5 | Persist Vane fork-image selection + SearXNG engine swap (Mojeek+Bing+Yahoo+Ecosia+Swisscows replaces blocked Brave/DDG) across docker compose pulls and server re-provisioning | Infra | `fix(vane)` `377f22c` *(in local-ai-packaged repo)* |

**Estimated LOC:** ~315 across this repo + 55 in the local-ai-packaged fork.

---

## Item 1 — VaneService cache ignored model name

### Context
`VaneService._resolve_provider_models(chat_model_name)` cached the **resolved** `{chatModel, embeddingModel}` dict at class-level on first call. On every subsequent call the cache short-circuit returned that dict regardless of `chat_model_name`. Effect: changing the model in the chat UI's model-picker silently kept using whatever the first request asked for, until the worker process restarted. Hidden by low test traffic + worker restarts on deploy.

### User Stories
- As a chat user, I want the model I select in the picker to actually be used for my next request — not the model the worker happened to resolve first.
- As a developer, I want the Vane provider cache to behave correctly without forcing a worker restart between model switches.

### Acceptance Criteria
- [x] AC-1-1: `VaneService._providers_cache` is removed. Replaced by `_providers_data_cache` which stores the **raw** `/api/providers` payload, not the resolved per-model dict. — `vane_service.py:33`
- [x] AC-1-2: `_resolve_provider_models(chat_model_name=None)` runs resolution against the (cached or fresh) raw data on every call, so a different `chat_model_name` arg picks a different `chatModel.providerId` + `key` without a cache flush. — `vane_service.py:60-78`
- [x] AC-1-3: The cache miss path (no raw data yet) still does exactly one HTTP request to Vane's `/api/providers` and stores the result for the worker's lifetime. — `vane_service.py:64-77`

### Edge Cases
- [x] EC-1-1: Vane returns an empty provider list → resolution returns `None`, `_build_payload` skips adding `chatModel`/`embeddingModel`, Vane rejects with `Invalid provider id`, niche-agent surfaces the structured `vane_unavailable` error to the LLM. Unchanged from before.
- [x] EC-1-2: Vane is briefly unreachable on the first call → `httpx.Client` raises, `_resolve_provider_models` logs a warning + returns `None`. Subsequent calls retry the HTTP request (cache stays empty until success). — `vane_service.py:69-71`

---

## Item 2 — niche-chat-agent web_search got no sources

### Context
Vane's `POST /api/search` non-streaming endpoint returns `{"message": "...", "sources": []}` — the answer text is there, but the `sources` array is always empty. Sources are only emitted as a separate `type: 'sources'` SSE event during the *streaming* response.

The niche-chat-agent's `@tool('web_search')` was using `VaneService.search()` (non-streaming) and reading `(resp or {}).get('sources') or []` → always `[]`. The LangGraph agent then received an empty list as the tool's result, the LLM had no concrete material to cite, and Vane's research-mode LLM defaulted to *"Hmm, sorry, I could not find any relevant information…"*.

### User Stories
- As a chat user with a niche pinned (`@school bus driver`), I want web-search to return cited sources I can click — same as the no-niche chat path already does.
- As an agent author, I want the `web_search` tool's return value to actually contain the sources Vane found, so the LLM has citations to ground its answer on.

### Acceptance Criteria
- [x] AC-2-1: New method `VaneService.search_collected(query, mode, sources, history, system_instructions, model)` on `vane_service.py:340-422` — identical `{answer, sources, model_used}` return contract as `search()`, but talks to Vane's streaming endpoint internally and accumulates real source dicts from the `sources` SSE event.
- [x] AC-2-2: `search_collected` consumes the streaming endpoint with `stream: true` payload, walks `iter_lines()`, accumulates `response`-typed chunks into `accumulated_answer` and `sources`-typed events into `accumulated_sources`. — `vane_service.py:374-393`
- [x] AC-2-3: When Vane fires `done`, the final dict's `answer` is taken from the done event (authoritative), and `sources` is taken from the done event when non-empty (else accumulated). — `vane_service.py:395-401`
- [x] AC-2-4: `niche_chat_agent.web_search` switches from `service.search(...)` to `service.search_collected(...)`. Other arguments unchanged. — `niche_chat_agent.py:449`
- [x] AC-2-5: Tests in `test_niche_chat_agent.py` (3 sites) and `test_tool_langfuse_spans.py` (1 site) updated to mock `VaneService.search_collected` instead of `VaneService.search`. Existing `VaneServiceError` fallback behavior tested unchanged.

### Edge Cases
- [x] EC-2-1: Vane stream emits no `sources` event before `done` → `accumulated_sources` stays `[]`, returned dict's `sources` is `[]`. LLM still gets the answer text but can't cite. (This was the pre-FIX state for ALL chats.)
- [x] EC-2-2: Vane stream errors mid-stream (HTTP 5xx / timeout) → `httpx` raises, `VaneServiceError` propagates up to the agent tool, which returns the structured `{error: 'vane_unavailable', ...}` dict. Agent continues with niche-local tools.
- [x] EC-2-3: Source dict from Vane has nested `metadata.title` / `metadata.url` AND/OR top-level `title` / `url`. `search_collected` normalises by reading `metadata` first (matches Vane's actual shape), falls back to nothing if absent.

---

## Item 3 — User-message duplicate bubble

### Context
`useOptimisticChatMessage.insert()` pushes a `temp_<uuid>`-prefixed user message into the `getSession` RTK Query cache so the user sees their text in the chat history within the same render cycle as submit. The SSE `done` handler then invalidates the cache; the server-persisted user row arrives on refetch.

Observed bug: with a niche chip pinned, both bubbles renders — the `temp_*` row (without chip-status because the row was simpler at insert time) AND the server-persisted row (with chip-status). RTK Query's `updateQueryData` patch did not get cleared by the refetch in all cases. The two rows look structurally different so they don't overlap visually — the duplicate is plainly visible.

### User Stories
- As a chat user, I want my message to appear exactly once after sending it — not twice with two different timestamps.

### Acceptance Criteria
- [x] AC-3-1: `useOptimisticChatMessage` exposes a new `clearAllTemp(sessionId)` method that drops every message with an id starting `temp_` from the `getSession` cache for that session. Idempotent. — `useOptimisticChatMessage.ts:140-153`
- [x] AC-3-2: `ChatPanel` calls `optimisticClearAllTemp(activeSessionId)` from BOTH the SSE `onDone` and the `onError` handlers, after the existing `setSearching(false)` + `clearAttachments()` dispatches. — `ChatPanel.tsx:181-202`
- [x] AC-3-3: Unit tests in `useOptimisticChatMessage.test.tsx`:
  - one asserts `clearAllTemp` removes every `temp_*` row but keeps server-UUID rows;
  - one asserts `clearAllTemp` is a safe no-op when no temp rows exist.

### Edge Cases
- [x] EC-3-1: `clearAllTemp` called before the cache slot exists → `updateQueryData` callback's `draft.messages` is undefined → guarded return, no throw.
- [x] EC-3-2: Two rapid sends (user A, then user B before A's done) → both `temp_*` rows exist; `clearAllTemp` after A's `done` drops both, A's server row arrives on refetch, B's `temp_*` will be re-cleared after B's `done`. User B sees their temp row briefly stripped; only acceptable because chat is one-message-at-a-time (Send disabled while `isStreaming`).
- [x] EC-3-3: Stream errored (`onError`) → `clearAllTemp` still runs → user message is removed entirely. Trade-off: pre-FIX kept the stranded user msg visible. Now: cleaner, but if the user reload they will see the message persisted (server already created it) so they can retry. Acceptable.

---

## Item 4 — Streaming border on ChatInputBar

### Context
While the assistant is producing a response (`chatBar.streamingAssistantMessage.isStreaming === true`), the chat input gave no salient visual feedback that the system was working. Previous attempts (`FIX-chat-bugfixes-and-grouping` Phase 7.5) were reverted three times because the effect interfered with the contenteditable typing: `overflow: hidden` on the wrapper broke macOS contenteditable navigation, `clip-path` did the same, and the focus border color clashed.

### User Stories
- As a chat user, I want a clear visible indication that the assistant is working on my answer, so I don't think the chat hung.
- As a chat user, I want the streaming indicator to NOT interfere with my ability to type, paste, or use keyboard shortcuts.

### Acceptance Criteria
- [x] AC-4-1: New component `StreamingBorder` at `ChatInputBar/partials/StreamingBorder.tsx`. Mounted as the last child INSIDE the existing `Shell` (the rounded card around the input). Absolutely positioned with `inset: -1px; pointer-events: none`.
- [x] AC-4-2: The visible ring is carved from a rotating conic-gradient overlay by `mask: linear-gradient(content-box), linear-gradient` + `mask-composite: exclude` so only a 1-px frame paints — the interior of the overlay is fully transparent. The contenteditable above is never overlaid. — `StreamingBorder.tsx`
- [x] AC-4-3: NO ancestor of the contenteditable has `overflow: hidden` or `clip-path`. `Shell` keeps `position: relative` only. — verified
- [x] AC-4-4: Animation: pure-CSS `@keyframes` rotating the inner pseudo-element 360° in 6s linear infinite. GPU-composited.
- [x] AC-4-5: `@media (prefers-reduced-motion: reduce)` disables the rotation.
- [x] AC-4-6: When `isStreaming` flips false: 200ms opacity transition to 0 + `z-index: -1` so the overlay doesn't participate in stacking against @-mention popovers or command palette.
- [x] AC-4-7: Color is sourced from `theme.vars.palette.primary.light` — no hardcoded colors.
- [x] AC-4-8: 2 new unit tests assert the overlay renders only when `isStreaming === true` and is mounted as a sibling of (not wrapping) the contenteditable.

### Edge Cases
- [x] EC-4-1: User opens the @-mention popover or `/`-command palette while streaming → popover's z-index is higher than the active overlay (`z-index: 1`) so it still renders above the border ring. — verified in StreamingBorder z-index logic
- [x] EC-4-2: Streaming completes very quickly (<200ms) → opacity transition still completes smoothly; no flicker.
- [x] EC-4-3: User starts a second send while the previous done's fade-out is in progress → `isStreaming` flips true again, overlay re-mounts at opacity 1 instantly, animation starts from current rotation angle (continuous-looking).

---

## Item 5 — Persist Vane fork image + SearXNG engine swap

### Context
Three compounding root causes made web-search silently degrade over the past weeks:

1. **Two SearXNG instances exist**: an external `searxng` container in localai-stack (used by Django's `niche_research_app.graph.tools.searxng_search` via `SEARXNG_BASE_URL`) AND an embedded SearXNG Flask process **inside the Vane container** (PID 10, listening on `127.0.0.1:8080` inside Vane, used by Vane's research-mode). Editing the external container's settings has zero effect on Vane.
2. **`docker-compose.override.private.yml` was not auto-loaded** by bare `docker compose up -d`. Docker compose only auto-loads `docker-compose.override.yml`. Plain re-deploys silently fell back to `itzcrazykns1337/vane:latest` (2026-04-10 upstream) — the fork image at `ghcr.io/mariowinter/vane:merch-miner` (with our `is empty` patch `1160c86`) was sitting locally pulled but unused.
3. **Vane's Next.js binds to `process.env.HOSTNAME`**: which equals the container hostname → `/etc/hosts` returns the IP of the *first* attached network only → Vane listened on `local-ai-packaged_default` IP but not on `merch_net` → Django got `Connection refused` reaching `vane:3000` even though both containers were on `merch_net`.

### User Stories
- As an operator, I want bare `docker compose up -d vane` to use the fork image with our patches — not silently fall back to upstream.
- As an operator, I want the SearXNG engine selection to survive image pulls and server re-provisioning.
- As a chat user, I want web search to keep working even when individual engines start rate-limiting.

### Acceptance Criteria
- [x] AC-5-1: `MarioWinter/local-ai-packaged` fork's `docker-compose.override.private.yml` now bind-mounts `./vane/searxng-settings.yml` → `/etc/searxng/settings.yml` inside the Vane container. Image-baked default config is overlaid with our engine selection. — committed in fork `377f22c`
- [x] AC-5-2: New file `vane/searxng-settings.yml` in the fork enables Mojeek + Bing + Yahoo + Ecosia + Swisscows; disables rate-limit-blocked Brave, DuckDuckGo, Startpage, Google, Qwant variants, Karmasearch.
- [x] AC-5-3: `.env.example` in the fork documents the `COMPOSE_FILE=docker-compose.yml:docker-compose.override.private.yml` pattern so bare `docker compose up -d` picks the private override. The actual `.env` (gitignored) on the server has this set.
- [x] AC-5-4: `docker-compose.override.private.yml` sets `environment: HOSTNAME=0.0.0.0` on the Vane service so Next.js binds all network interfaces (not just the first one in `/etc/hosts`).
- [x] AC-5-5: `docker-compose.override.private.yml` adds `vane-data:/home/vane/data` mount in addition to the existing `vane-data:/home/perplexica/data` — newer Vane image stores config under `/home/vane/data`, but `/proc/mounts` showed only `perplexica/data` was being mounted (the second mount was an anonymous volume), so the persisted config (OpenRouter provider with `setupComplete: true`) was never being read at runtime.
- [x] AC-5-6: Live verification: `docker compose config | grep "image: ghcr.io/mariowinter/vane"` returns the fork image. SearXNG returns ≥10 results from at least 2 engines for a representative query. Backend → Vane reachability via Django shell completes < 60s with non-zero sources.

### Edge Cases
- [x] EC-5-1: All currently-enabled engines start blocking simultaneously (Mojeek already banned our IP during testing, Bing alone returns thin results) → fallback is the ScraperOps residential proxy via SearXNG's `outgoing.proxies` config. Documented in this spec as Plan B; not wired in this FIX.
- [x] EC-5-2: Vane image upgrade in upstream `ItzCrazyKns/Vane` adds new mandatory fields to `/etc/searxng/settings.yml` → our bind-mount overrides them and may break Vane's search. Mitigation: `use_default_settings: true` at the top means our file is MERGED with upstream defaults — only the engine list overrides. Verified by reading upstream-shipped `settings.yml`.
- [x] EC-5-3: Server re-provisioned from scratch by `git clone` of the fork → `.env` is gitignored so `COMPOSE_FILE` isn't set automatically. `.env.example` documents the variable but the operator must copy it. (Acceptable: re-provisioning is a manual operation already.)

---

## Out of scope

- Brave Search API direct integration (paid plan). Documented as future option in memory `project_searxng_engine_config.md` if all SearXNG-mediated engines lose ground.
- Upstreaming Vane fork patches to `ItzCrazyKns/Vane` PR #1118. Tracked in memory `project_vane_custom_build.md`.
- Server-side mode_classifier improvements (LLM-driven routing of "search this in forums" → multi-query strategy in Vane). Vane decides query decomposition internally today.
- Visual refresh of `ThinkingStrip` component (the Perplexity-style stages display already mounted in ChatMessageList:557 + :657). If QA finds the existing display too subtle, that's a follow-up styling iteration on the existing component — NOT a new component (per memory `feedback_component_reuse_first`).
- Backend emission of a structured `web_search_unavailable` SSE error code (planned in `FIX-chat-bugfixes-and-grouping` Item 2 out-of-scope list, still deferred).

---

## Notes on retrofit

This spec was written AFTER the 5 commits landed on `fix/chat-vane-bigfix` (debugged + fixed live with the user). All AC checkboxes are marked `[x]` from the start because the code is already merged into the branch and verified via direct tests (Django shell + Playwright login chat). The QA skill will re-run the ACs end-to-end on prod after the branch deploys to confirm nothing regressed and to mark any AC that needs a manual visual verification.

Per memory `feedback_skills_must_follow_rules`: the next skill in sequence is `/architecture` to produce a tasks-file (`docs/tasks/FIX-chat-vane-bigfix-tasks.md`) listing each AC as a checkbox grouped by phase, then `/qa` to verify ACs against the running prod system.
