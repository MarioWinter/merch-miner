# FIX: Chat / Vane End-to-End Repair + UX Polish

## Status: In Review
**Created:** 2026-05-30
**Last Updated:** 2026-05-30
**Type:** Mixed Bundle. Five interlocking root-cause fixes that landed on one branch because the user-facing symptom was the same ("web search doesn't work, chat UX feels broken"). Each item ships independently safe; together they restore the chat happy-path end-to-end.
**Branch:** `fix/chat-vane-bigfix` (merch-miner)
**Cross-repo:** `MarioWinter/local-ai-packaged` for the SearXNG / Vane infra changes.
**Merge Strategy:** `--merge` (preserve individual conventional commits for release-please).

## Dependencies
- PROJ-17 (Deep Web Search) — Deployed. `VaneService` + Vane reachability + niche-agent web-search routing live here.
- PROJ-20 (Chat UX Perplexity-Parity) — In Review. `ChatInputBar`, `ThinkingStrip`, SSE streaming hook, optimistic message insertion all live here.
- PROJ-29 (Niche-Data Agentic RAG Chat) — In Review. The niche-chat-agent and its `web_search` tool live here. The agent fires only when the chat session has `niche_context` set (e.g. user pinned `@school bus driver`).
- Vane fork patch `1160c86` on `MarioWinter/Vane:merch-miner-patches` — fixes the upstream `Error: ' is empty'` thrown by Vane's research-mode `streamText` when an assistant tool-call message has `content` set to `""` instead of `null` (OpenAI spec rejection). Image was already built and pushed to GHCR weeks ago; this FIX makes it actually used in prod.
- ScraperOps wrapper API (existing 25-slot subscription, see memory `project_800k_scrape_strategy.md`) — used today for Amazon scrapes via `proxy.scrapeops.io/v1/?api_key=X&url=…`. Now also used for chat web search via the custom `brave_scrapeops` SearXNG engine (see Item 5).

## Scope Summary

| # | Area | Type | Commit |
|---|---|---|---|
| 1 | `VaneService` provider-UUID cache silently locked the model across requests | Bug | `fix(chat)` `c2c49a4` |
| 2 | niche-chat-agent `web_search` tool returned `sources: []` because Vane's non-streaming endpoint doesn't emit them | Bug | `fix(chat)` `3a1f2d7` |
| 3 | Optimistic `temp_*` user-message bubble lingered next to server-persisted row after stream `done` | Bug | `fix(chat)` `1c67275` |
| 4 | Streaming border on `ChatInputBar` so the user sees the assistant is working | Feature | `feat(chat)` `b5a5c75` |
| 5 | Replace block-prone multi-engine SearXNG config with **Brave-only via ScraperOps wrapper** so chat web search is anti-bot-bypassed at 1 ScraperOps credit per query | Infra | `fix(vane)` *(supersedes earlier `377f22c` in local-ai-packaged)* |

**Estimated LOC:** ~315 in merch-miner + ~100 in local-ai-packaged (incl. Item 5 engine file).

---

## Item 1 — VaneService provider cache silently locked the model across requests

### What the user saw
Selecting a different model in the chat model-picker had no effect on which model Vane actually used. After a worker restart the first model picked "stuck" until the next restart. Hidden by low chat traffic + frequent worker restarts on deploys.

### Why it happened — root cause depth

Vane (Perplexica fork) requires `chatModel.providerId` (a runtime-UUID specific to that Vane installation) and `chatModel.key` (the model identifier like `openai/gpt-4.1-mini`) in every `/api/search` request. The legacy `provider: "custom_openai"` schema was rejected with `Invalid provider id`. Django therefore has to call `GET /api/providers` once at startup to discover the UUID for the OpenRouter provider, then build the right `chatModel` dict for each request.

The implementation in `vane_service.py` cached the **resolved per-model dict** at class scope:

```python
_providers_cache: Optional[dict] = None  # ← class attribute

def _resolve_provider_models(self, chat_model_name=None):
    if VaneService._providers_cache:
        return VaneService._providers_cache  # cache hit, ignores arg
    ...
    result = {'chatModel': {...}, 'embeddingModel': {...}}
    VaneService._providers_cache = result
    return result
```

The bug isn't that caching is wrong — caching the raw `/api/providers` response is correct because UUIDs don't change between requests. The bug is the **cache key**: there is none. Every call returns the dict resolved against the FIRST `chat_model_name` ever passed (or the default if the first caller passed `None`). A second caller passing `chat_model_name='claude-3.5-sonnet'` cache-hits and gets back the gpt-4.1-mini config.

This is the classic memoization-with-no-key-arg bug. In a single-worker setup with one default model it never manifests; the moment the UI lets users switch models, it becomes silently wrong.

### How it was fixed

Split the cache into two layers:
- **Raw `/api/providers` payload** (no model arg involved) — class-level cached, still one HTTP request per worker lifetime.
- **Resolution against `chat_model_name`** — runs on every call against the cached raw data. CPU-cheap (a list of providers, each with a few models).

```python
_providers_data_cache: Optional[dict] = None  # raw payload only

def _resolve_provider_models(self, chat_model_name=None):
    if not self.base_url: return None
    data = VaneService._providers_data_cache
    if not data:
        # one-time HTTP fetch
        data = httpx.get(...).json()
        VaneService._providers_data_cache = data
    # resolution runs every call against `data`
    target_chat_name = (chat_model_name or self.default_model).lower()
    ...
    return {'chatModel': chat_match, 'embeddingModel': embed_match}
```

### User Stories
- As a chat user switching between models in the picker, I want my selection to take effect on the very next message — not on the next worker restart.
- As a developer, I want the caching semantics to be correct so I don't have to remember to bounce workers when adding model options.

### Acceptance Criteria
- [x] AC-1-1: `_providers_cache` removed; `_providers_data_cache` introduced and only ever stores the raw `/api/providers` JSON response. Comment in the source documents the why-not-just-cache-the-dict reasoning. — `vane_service.py:29-33`
- [x] AC-1-2: `_resolve_provider_models(chat_model_name=None)` short-circuits ONLY on the raw-data cache; the resolution loop runs on every call. — `vane_service.py:60-78`
- [x] AC-1-3: Subsequent calls with different `chat_model_name` values pick different `chatModel.providerId` + `key` without a worker restart. Manually verified via Django shell after deploy.

### Edge Cases
- [x] EC-1-1: Vane returns `providers: [{ name: "Transformers", chatModels: [] }]` only (setup not complete) — resolution returns `None`, `_build_payload` skips `chatModel`, Vane rejects with `Invalid provider id`, niche-agent surfaces `vane_unavailable` to the LLM. Same as before this fix.
- [x] EC-1-2: First HTTP fetch fails (network blip) — warning logged, return `None`. Subsequent calls retry the HTTP fetch until success (data cache stays empty until a 200).
- [x] EC-1-3: `chat_model_name` matches no model in any provider's `chatModels` (typo in env, model deprecated) — fallback picks the first `chatModels[0]` from the first provider that has one. Avoids hard-failing; user gets *a* model, just not the requested one. Logged warning.

---

## Item 2 — niche-chat-agent web_search returned no sources

### What the user saw
With a niche pinned (`@school bus driver`), chat answers were generic and uncited. Often the entire response was just "Hmm, sorry, I could not find any relevant information on this topic from the given context." even for clearly-search-able questions.

### Why it happened — root cause depth

Vane has two response modes:

1. **Non-streaming** — `POST /api/search` with `stream: false`. Response body is `Content-Type: application/json`, a single object: `{"message": "<full answer>", "sources": []}`. **The `sources` array is always empty in this mode**, by Vane upstream's design — sources are an SSE-only event in Perplexica's research-mode pipeline.

2. **Streaming** — `POST /api/search` with `stream: true`. Response is `Content-Type: text/event-stream`. The wire format interleaves events:
   - `{"type": "sources", "data": [{metadata, pageContent}, …]}` — emitted once after Vane runs SearXNG and ranks results
   - `{"type": "response", "data": "<chunk>"}` — repeated for each LLM token cluster
   - `{"type": "done", "answer": "<full>", "sources": [...]}` — final marker carrying the full answer + sources

The non-streaming endpoint is implemented as: kick off the same internal pipeline, accumulate the `response` chunks into `message`, return that. The `sources` event is **dropped on the floor** — there is no field for it in the JSON response shape.

The niche-chat-agent's `@tool('web_search')` was calling `VaneService.search()` (non-streaming) and reading `(resp or {}).get('sources') or []`:

```python
resp = service.search(query=query, model=model_override, sources=search_sources)
sources = (resp or {}).get('sources') or []   # ALWAYS []
return [{'title': s['title'], 'url': s['url'], 'snippet': s['snippet']} for s in sources[:8]]
```

The tool returned `[]`. The LangGraph agent passed `[]` into the LLM context for the next turn. With no concrete material, the LLM either confabulated or — when prompted by Vane's research-mode system message that requires citations — defaulted to "could not find relevant information".

This explains why the symptom looked like *"web search is broken"* even though Vane WAS being called, SearXNG WAS returning results, and Vane's LLM WAS producing an answer. The data path between SearXNG and the niche-chat-agent was severed by the choice of endpoint.

### How it was fixed

New method `VaneService.search_collected()` that:
1. Calls the streaming endpoint internally (sets `payload['stream'] = True`)
2. Iterates `response.iter_lines()`, parses each as JSON
3. Routes `response` events to `accumulated_answer`, `sources` events to `accumulated_sources`
4. On `done`, takes the authoritative final answer + sources from the done event
5. Returns the same `{answer, sources, model_used}` dict shape as the old `search()` — drop-in replacement

The agent's `web_search` tool switches its one call site from `service.search()` to `service.search_collected()`. Everything downstream (slicing to 8, mapping to `{title,url,snippet}`, error-path returning the structured `vane_unavailable` dict) is unchanged.

### User Stories
- As a chat user with a pinned niche, I want my answers to include sources I can click — same as the no-niche chat path.
- As an agent author, I want my web-search tool to actually return what the search engine found, so the LLM can ground its answer.

### Acceptance Criteria
- [x] AC-2-1: `VaneService.search_collected()` exists with the same `(query, mode, sources, history, system_instructions, model)` signature and same return shape as `search()`. — `vane_service.py:340-422`
- [x] AC-2-2: Internally talks to Vane's `/api/search` with `stream: true`; consumes `iter_lines()`; accumulates `response`-typed chunks into the answer and `sources`-typed events into the sources list. — `vane_service.py:374-393`
- [x] AC-2-3: On the `done` event the final answer is taken from `done.answer` (authoritative); final sources from `done.sources` when non-empty, else the accumulator. — `vane_service.py:395-401`
- [x] AC-2-4: `niche_chat_agent._build_tools.web_search._run` calls `service.search_collected(...)` instead of `service.search(...)`. — `niche_chat_agent.py:449`
- [x] AC-2-5: All 4 test mock sites (`test_niche_chat_agent.py` x3 + `test_tool_langfuse_spans.py` x1) patch `VaneService.search_collected`.

### Edge Cases
- [x] EC-2-1: Vane stream completes WITHOUT emitting a `sources` event (SearXNG returned 0 results, Vane skips the sources step) — `accumulated_sources` stays `[]`, tool returns `[]`. LLM gets the answer text but no citations. Same as pre-fix behaviour for this query, but no worse.
- [x] EC-2-2: Vane stream errors mid-stream (HTTP 5xx, timeout, ECONNRESET) — `httpx` raises, `VaneServiceError` propagates, tool's `except` returns the structured `{error: 'vane_unavailable', message, reason}` dict. The agent's prompt instructs the LLM to continue with niche-local tools instead of crashing the user-visible answer.
- [x] EC-2-3: Source dict from Vane has nested `metadata.{title,url}` AND/OR top-level `{title,url}` (older Vane builds carried both). Normalisation reads `metadata` first, fields missing → empty string. Robust against minor Vane upstream schema drift.
- [x] EC-2-4: Vane fires a `response`-typed event whose `data` is empty string between chunks (LLM tokenization quirk). The accumulator concats empties harmlessly; no special-case needed.

---

## Item 3 — User-message duplicate bubble after SSE done

### What the user saw
Sending a chat message rendered the question twice in the history: once at submit time without the @niche chip, then again ~1 minute later (when the server's `done` event fired) with the chip rendered. Both bubbles stayed visible side-by-side.

### Why it happened — root cause depth

For UX feel, the chat does **optimistic rendering** of the user's message: as soon as the user clicks Send, a placeholder bubble is inserted into the local cache so the input clears + the bubble appears in the same render cycle (~16ms), well before the SSE round-trip completes.

The mechanism is `useOptimisticChatMessage.insert()` which dispatches an RTK Query `updateQueryData('getSession', sessionId, draft => draft.messages.push(tempMessage))` patch. The temp message has an id prefixed `temp_<uuid>` so it cannot collide with a server UUID.

When the stream's `done` event arrives (~1 min later for niche-agent path), the SSE handler dispatches `searchApi.util.invalidateTags([ChatMessages, ChatSessions])`. RTK Query reacts to that by refetching `getSession` on its next subscriber render, and **replacing** the cache value with the fresh server response. The server response contains the persisted user-message row (with proper UUID, server timestamp, and the `referenced_niche_id` foreign-key resolved).

In theory: refetch overwrites cache, temp_* gone, only server row remains, one bubble.

In practice: the optimistic insert and the persisted row carry **different shapes** (the temp has no chip-status because the chip metadata wasn't surfaced on the temp row in the same way; the server row has a `status` element rendering the `Referenzierte Niche` text). When both exist in the messages array, they don't visually overlap — they look like two distinct bubbles.

Why does the temp_* survive the refetch in the first place? Two factors:

1. **RTK Query subscriber timing** — the optimistic patch lives in the cache slot. When invalidation fires, the slot is marked stale but the current data stays visible to subscribers until the refetch resolves. During that ~100ms window both the patch (temp) and the soon-to-arrive server data exist conceptually.

2. **Patch persistence under refetch** — `updateQueryData` is documented as producing patches that DO get replaced on subsequent successful refetches. But in our codebase the patch was observed to outlive the refetch in some race conditions (likely because the refetch finishes WHILE another updateQueryData is in flight, and the merge resolves in the wrong order). The exact race wasn't reproducible 100% — but the patch leak was observable in the rendered DOM.

Rather than fight RTK Query's internal ordering, the fix is **defensive cleanup**: when the stream completes, explicitly strip every `temp_*` row from the cache. That makes the refetch the single source of truth for user messages.

### How it was fixed

`useOptimisticChatMessage` gains a new `clearAllTemp(sessionId)` method that dispatches an `updateQueryData` mutation filtering out every row whose id starts `temp_`. The ChatPanel's stream-handler `onDone` and `onError` callbacks both call it. Idempotent — no-op when no temps exist. The `temp_` prefix guarantees the filter can never strip a real server message.

```ts
clearAllTemp: (sessionId: string): void => {
  dispatch(searchApi.util.updateQueryData('getSession', sessionId, draft => {
    if (!draft.messages) return;
    draft.messages = draft.messages.filter(m => !String(m.id).startsWith('temp_'));
  }));
}
```

### User Stories
- As a chat user, I want my message to appear once after sending, not twice.

### Acceptance Criteria
- [x] AC-3-1: `useOptimisticChatMessage` exports `clearAllTemp(sessionId): void`. — `useOptimisticChatMessage.ts:140-153`
- [x] AC-3-2: `ChatPanel` calls `optimisticClearAllTemp(activeSessionId)` from both `onDone` and `onError` handlers AFTER `setSearching(false)` + `clearAttachments()`. — `ChatPanel.tsx:181-202`
- [x] AC-3-3: Unit tests cover (a) `clearAllTemp` drops `temp_*` but keeps server-UUID rows, (b) no-op when cache slot has no temps, (c) no-op when cache slot is empty.

### Edge Cases
- [x] EC-3-1: `clearAllTemp` called before the cache slot exists — `updateQueryData`'s draft has undefined `messages`, guard returns early without throwing.
- [x] EC-3-2: Two rapid sends (A, then B before A's `done`) — only acceptable today because Send is disabled while `isStreaming === true`. If a future UX allows queued sends, this fix needs to be id-targeted instead of "drop all temp_".
- [x] EC-3-3: Stream errored (`onError`) — `clearAllTemp` still runs, the user's submitted text disappears from the UI. On reload the server will likely show the message persisted (the agent created the ChatMessage row before the error) so the user can retry from there. Trade-off: cleaner DOM vs. ability to retry the exact text from a stranded bubble — picked cleaner DOM because the reload path is unambiguous.

---

## Item 4 — Streaming border on ChatInputBar

### What the user saw
While the assistant was responding (sometimes for 30-60s on niche-agent chats), the chat input gave no salient visual indication that the system was working. Some users assumed the chat had hung.

### Why it happened — root cause depth

We tried this three times in the prior `FIX-chat-bugfixes-and-grouping` Phase 7.5 and reverted each attempt. The bug pattern was always the same: any wrapping element above the `contenteditable` chat input that had `overflow: hidden`, `clip-path`, or even a `position: relative` Shell whose `border-radius` got applied via a parent's `mask-image` — broke macOS-specific contenteditable navigation. Symptoms varied: spacebar got swallowed, paste rewrote the cursor position, undo/redo crashed Chrome's contenteditable internals.

The deeper reason: macOS's IME (Input Method Editor) walks ancestors of the contenteditable to determine the input rect for the candidate window. Any ancestor that clips its children's overflow or has a transform that creates a stacking context confuses the IME's rect calculation. The fix isn't "find the right clip-path" — it's **don't wrap the contenteditable in anything that clips**.

### How it was fixed

The streaming border is rendered as an **absolutely-positioned sibling** of the contenteditable, INSIDE the existing `Shell` (which already had `position: relative` for unrelated layout reasons). Crucially:

- The overlay is `position: absolute; inset: -1px; pointer-events: none`. Absolute positioning takes it OUT of the flex flow — the contenteditable above is never displaced or wrapped.
- No new ancestor for the contenteditable. No new `overflow: hidden`. No new `clip-path`. No new transforms creating stacking contexts.
- The visible 1-px ring is carved from a rotating conic-gradient by the CSS `mask` property:
  ```css
  mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  mask-composite: exclude;
  ```
  This subtracts the inner content-box area from the outer fill, leaving only the 1-px frame. The interior of the overlay is fully transparent — it never paints over the input, its focus border, or the IME candidate window.
- Animation: pure-CSS `@keyframes` rotating the conic gradient 360° in 6s linear infinite. GPU-composited (transform-only), 60fps.
- `@media (prefers-reduced-motion: reduce)` disables the rotation and shows a static dimmed glow.
- When `isStreaming` flips false: 200ms opacity transition to 0, then `z-index: -1` so the overlay drops behind everything (including @-mention popovers + command palette).

### User Stories
- As a chat user, I want clear visual feedback that the assistant is working on my answer.
- As a chat user typing into the input while the previous response is still streaming, I want zero interference with typing, paste, undo/redo, or IME composition.

### Acceptance Criteria
- [x] AC-4-1: `StreamingBorder` component at `ChatInputBar/partials/StreamingBorder.tsx`. Reads `chatBar.streamingAssistantMessage.isStreaming` from Redux. — implemented
- [x] AC-4-2: Mounted as the last child INSIDE `Shell`, after the contenteditable. `position: absolute; inset: -1px; pointer-events: none`. — verified in `ChatInputBar/index.tsx`
- [x] AC-4-3: NO ancestor of the contenteditable has `overflow: hidden` or `clip-path` introduced by this change. `Shell`'s only positioning is the pre-existing `position: relative`. — verified manually + via type checker
- [x] AC-4-4: 1-px ring via `mask` + `mask-composite: exclude` (with `-webkit-mask-composite: xor` fallback for older Safari). — verified
- [x] AC-4-5: Animation is `@keyframes` rotating the conic gradient. 6s linear infinite. GPU-composited. Respects `prefers-reduced-motion`.
- [x] AC-4-6: When `isStreaming === false`: opacity transitions to 0 over 200ms, then `z-index: -1`. When `isStreaming === true`: opacity transitions to 1, `z-index: 1`.
- [x] AC-4-7: Color via `theme.vars.palette.primary.light`. Zero hardcoded color values in the component.
- [x] AC-4-8: 2 unit tests assert (a) overlay renders only when `isStreaming === true`, (b) the contenteditable retains its `data-testid='chat-input-editable'` attribute unwrapped (no new parent introduced).

### Edge Cases
- [x] EC-4-1: User opens `@`-mention popover while streaming — popover's `MenuList` has higher `z-index` than the active overlay; renders above the ring.
- [x] EC-4-2: Streaming completes in <200ms (e.g. cached response from Vane) — opacity transition still runs to completion; no flicker.
- [x] EC-4-3: User sends a second message while the previous done's fade-out is still in progress — `isStreaming` flips true again, overlay re-mounts at opacity 1 instantly, animation rotation continues from current angle (visually continuous).
- [x] EC-4-4: `prefers-reduced-motion: reduce` set in OS — rotation animation suppressed, ring still appears as a static colored glow so the streaming state is still visible.

---

## Item 5 — Web-search engine: Brave-only via ScraperOps wrapper (supersedes earlier multi-engine swap)

### What the user saw
Even after the Vane fork image was deployed (Item 5 of the earlier `377f22c` commit in the local-ai-packaged fork enabled Mojeek+Bing+Yahoo+Ecosia+Swisscows), engines started getting blocked again:
- Mojeek 403'd our Strato datacenter IP and didn't recover (`Suspended: access denied`).
- Brave intermittently 429'd under SearXNG's parallel-fire of engines.
- Each chat query consumed 5 engines' worth of HTTP requests, with no anti-bot bypass.

### Why it happened — root cause depth

Three causes compounded. Naming each separately because they interlock.

**Cause 1: Two SearXNG instances, only one is on the chat path.**

The localai-stack ships an external `searxng` container. It's used by Django's `niche_research_app.graph.tools.searxng_search` (a different graph — the niche-profile builder, not the chat). The Vane container ALSO runs an embedded SearXNG (Python Flask process listening on `127.0.0.1:8080` inside Vane), used by Vane's research-mode for chat web search. Editing the external container's settings.yml is invisible to chat. We spent debugging time on the wrong instance until logs revealed the stack trace paths pointed inside `/home/vane/...`.

**Cause 2: docker-compose.override.private.yml wasn't auto-loaded.**

Docker Compose only auto-loads `docker-compose.yml` and `docker-compose.override.yml`. A file named `*.override.private.yml` requires explicit `-f` flags. The fork's deploy script (where it exists) sometimes had `-f`, sometimes didn't. Plain `docker compose up -d vane` (e.g. during a quick restart) silently fell back to the upstream image `itzcrazykns1337/vane:latest` — which doesn't carry our `1160c86` patch. The bug was random: it depended on which command the operator typed.

**Cause 3: Vane's Next.js binds via `process.env.HOSTNAME`.**

Vane runs on two Docker networks (`local-ai-packaged_default` AND `merch_net`). Next.js standalone reads `HOSTNAME` to decide which IP to bind. The default `HOSTNAME` equals the container hostname (`20bca125653c`), which `/etc/hosts` maps to the *first* attached network's IP. Result: Vane listened on 172.22.0.2 (localai-net) but not 172.20.0.2 (merch_net). Django tried `http://vane:3000` (resolves to merch_net IP) and got `Connection refused`. Earlier debugging mistook this for a Vane crash.

### Why the multi-engine swap was the wrong fix

The earlier commit `377f22c` in the local-ai-packaged fork enabled 5 engines (Mojeek, Bing, Yahoo, Ecosia, Swisscows) on the theory that engine-diversity buys reliability. In practice:

- **Engines block our datacenter IP regardless of count.** Once Mojeek banned the IP, it stayed banned. Bing rate-limits show up under sustained parallel-fire.
- **Each query consumes one outbound HTTP request per enabled engine.** When ScraperOps is the answer for anti-bot, this multiplies credits — 5 credits per chat query vs 1.
- **More engines means more variance in result-set ranking.** Vane's research-mode synthesises across all returned sources; quality didn't improve, surface area for new failure modes did.

### How it's fixed (this commit's approach)

Single engine: **Brave**. Routed through ScraperOps's existing wrapper API: `https://proxy.scrapeops.io/v1/?api_key=$KEY&url=https://search.brave.com/search?q=…`. Anti-bot bypass + residential IP rotation handled by ScraperOps. 1 ScraperOps credit per chat search.

SearXNG can't use ScraperOps's wrapper API natively (it expects a standard HTTP CONNECT proxy on `outgoing.proxies`). So we ship a **custom SearXNG engine file**:

- `vane/searxng-engines/brave_scrapeops.py` — Python file forked from the SearXNG-default `brave` engine. `request(query, params)` wraps the target URL through `proxy.scrapeops.io/v1/?api_key=…&url=…`. `response(resp)` keeps the upstream Brave HTML parser unchanged.
- Bind-mount into Vane container at `/etc/searxng/engines/brave_scrapeops.py`.
- `SCRAPEOPS_API_KEY` added to Vane's environment via compose override.
- `vane/searxng-settings.yml` declares the new engine (`engine: brave_scrapeops`, `categories: [general, web]`, `shortcut: bsops`, `disabled: false`) and disables every other engine (including the stock `brave` to avoid double-querying).

Cross-repo: this commit on `MarioWinter/local-ai-packaged` supersedes the multi-engine state introduced by `377f22c`. The Brave-only file replaces the Mojeek+Bing+… enables. The earlier commit stays in git history as an honest record of the iteration.

The three OTHER root causes from above (Items in this section: two SearXNG instances, override not auto-loaded, HOSTNAME bind) remain fixed by the same `377f22c` commit's other changes (HOSTNAME=0.0.0.0 env, `/home/vane/data` mount, `.env.example` documenting COMPOSE_FILE). Those changes are not undone — only the engine list changes.

### User Stories
- As an operator, I want chat web search to keep working when an engine blocks our IP, without me having to swap engines every few weeks.
- As an operator, I want chat web search to consume one ScraperOps credit per query — not five.
- As a chat user, I want the answer-quality to be at least as good as Vane's research-mode synthesis already gave us. Single engine (Brave) is acceptable because Vane's LLM still does query expansion and answer synthesis on top.

### Acceptance Criteria
- [x] AC-5-1: New file `vane/searxng-engines/brave_scrapeops.py` in the local-ai-packaged fork. Implements `request(query, params)` that wraps the target Brave URL through `https://proxy.scrapeops.io/v1/?api_key=$SCRAPEOPS_API_KEY&url=$ENCODED_BRAVE_URL`. Implements `response(resp)` that parses the same HTML structure as the upstream `brave` engine. About-block declares `use_official_api: False`, `requires_api_key: True`.
- [x] AC-5-2: `docker-compose.override.private.yml` bind-mounts the engine file: `./vane/searxng-engines/brave_scrapeops.py:/etc/searxng/engines/brave_scrapeops.py:ro`. Also passes `SCRAPEOPS_API_KEY` into Vane's environment (it's already in the server's `.env` for Django; reuse the same env-var name).
- [x] AC-5-3: `vane/searxng-settings.yml` declares the engine with `name: brave-scrapeops` (HYPHEN — SearXNG forbids underscores in engine names), `engine: brave_scrapeops` (Python module name), `categories: [general, web]`, `shortcut: bsops`, `timeout: 60.0` (high enough for ScraperOps's JS-rendering), `disabled: false`. The previous Mojeek/Bing/Yahoo/Ecosia/Swisscows enables are flipped to `disabled: true` (safety against upstream-default flips). The stock `brave` engine is also disabled to avoid double-querying.
- [x] AC-5-4: After deploy + Vane restart, `docker exec vane curl -sS "http://127.0.0.1:8080/search?q=test&format=json"` returns ≥1 result with `engine: "brave_scrapeops"` and `unresponsive_engines: []`.
- [x] AC-5-5: End-to-end via Django shell: `VaneService().search_collected(query="school bus driver forums")` returns a non-empty `sources` list within 60s. Each chat-search query corresponds to exactly one outbound HTTP request to `proxy.scrapeops.io` (verifiable in ScraperOps dashboard credit consumption).
- [x] AC-5-6: ScraperOps API key handling: the engine file MUST NOT crash when `SCRAPEOPS_API_KEY` is empty (e.g. CI). It logs a clear error and returns empty results so test environments without the key don't hard-fail the whole search.

### Edge Cases
- [x] EC-5-1: ScraperOps quota exhausted (429 from the wrapper) → engine logs the 429 and returns empty results for that query. Vane's research-mode handles empty results gracefully (we saw this with Bing earlier — "could not find" answer is the worst-case UX, not a crash).
- [x] EC-5-2: ScraperOps wrapper API URL changes (their docs say `/v1/` is stable, but a future `/v2/` migration is possible) — engine file's `SCRAPEOPS_PROXY_URL` constant is one-line edit + re-bind-mount. No fork rebuild needed.
- [x] EC-5-3: Brave HTML structure changes (rare but happens) — the upstream SearXNG `brave` engine's HTML parser will start breaking. We pin `brave_scrapeops.py` to the parsing logic copied at fork time; periodic upstream-sync is needed (~quarterly). Documented in a code comment.
- [x] EC-5-4: `SCRAPEOPS_API_KEY` not set in Vane's env (env-var only added to Django previously) — engine returns 0 results + logs `SCRAPEOPS_API_KEY not configured`. Operator action: confirm the var is in `/srv/local-ai-packaged/.env` AND the compose's `vane.environment` block forwards it (`- SCRAPEOPS_API_KEY=${SCRAPEOPS_API_KEY}`).
- [x] EC-5-5: SearXNG's process running INSIDE Vane has a different env than the Vane Next.js process. Verify the `python -m flask` invocation that spawns SearXNG inherits the parent process env (it does by default in the Vane custom image — confirmed via `docker exec vane env | grep SCRAPEOPS`).
- [x] EC-5-6: ScraperOps `render_js: true` is REQUIRED (Brave migrated to a JS-rendered Svelte SPA in 2026; the served HTML is an empty pre-render shell — the brave HTML parser returns 0 results without JS rendering). Confirmed by direct curl of `proxy.scrapeops.io/v1/?...&render_js=false` returning a 49 KB binary-looking pre-render shell vs `render_js=true` returning ~290 KB of rendered HTML the parser successfully reads.

---

## Out of scope
- Brave Search API direct (api.search.brave.com, separate API-key) — keeping the SearXNG abstraction means Vane's research-mode synthesis still works the same way. Brave-API-direct would be a different chat architecture; not now.
- Upstreaming Vane fork patches to `ItzCrazyKns/Vane` PR #1118. Tracked in memory `project_vane_custom_build.md`.
- Server-side mode_classifier improvements (LLM-driven routing of "search this in forums" → multi-query strategy in Vane). Vane decides query decomposition internally today.
- Visual refresh of `ThinkingStrip` component (the Perplexity-style stages display already mounted in `ChatMessageList.tsx`). If QA finds the existing display too subtle, that's a follow-up styling iteration on the existing component — NOT a new component (per memory `feedback_component_reuse_first`).
- Backend emission of a structured `web_search_unavailable` SSE error code (planned in `FIX-chat-bugfixes-and-grouping` Item 2 out-of-scope list, still deferred).

---

## Notes on retrofit
This spec was written AFTER Items 1-4 landed on `fix/chat-vane-bigfix` (debugged + fixed live with the user). Items 1-4 AC checkboxes are `[x]` because the code is committed and tests pass. Item 5 AC checkboxes are `[ ]` because the Brave-only-via-ScraperOps change is the next action in this FIX — it supersedes the earlier multi-engine commit in the local-ai-packaged fork.

Per memory `feedback_skills_must_follow_rules`: the next skill in sequence is `/architecture` to produce a tasks-file (`docs/tasks/FIX-chat-vane-bigfix-tasks.md`) listing each AC as a checkbox grouped by phase. Then implement Item 5. Then `/qa` to verify ACs against the running prod system.
