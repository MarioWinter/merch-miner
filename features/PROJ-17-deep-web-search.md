# PROJ-17: Deep Web Search (Vane + Crawl4ai)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-03-24
**Last Updated:** 2026-04-25 (Spec-Review with user)

## Overview

In-app Deep Web Search powered by two external services in the localai-stack:
- **Vane** (formerly Perplexica) — AI answering engine with SearXNG + LLM synthesis
- **Crawl4ai** — Chromium-based deep URL extractor (Markdown output)

The UI uses **Pattern B Hybrid**: a global **Floating Chat-Bar** (bottom-center, glasmorphism, default-collapsed with chevron-up indicator) as quick-access input, plus a **Multi-Purpose Right Drawer** with three tabs: `[📋 Niche] [💬 Chat] [🤖 Agent]`.

The **Chat Tab** is the "Frontdoor" — a Mode-Dropdown (`Auto / Web-Search / Agent`) classifies whether the user wants Vane (web search) or PROJ-18 Agent. When an Agent workflow is triggered from chat, an inline **Workflow-Card** with mini-stepper, approval-buttons and a "→ Open Command Center" link appears in the message stream. The full Agent control surface lives in the Agent Tab.

The Drawer is **resizable** (480 → 768 → 1200px) — the 1200px Full-Mode is a NotebookLM-style command center with side-by-side panels.

Crawl results are stored in DB and (via feature-flag `VECTOR_DB_ENABLED`) embedded into PROJ-15 Vector DB for semantic search across the workspace.

## External Services

### Vane (formerly Perplexica)
- **What:** AI answering engine — searches via SearXNG, LLM synthesizes answer with cited sources
- **Docker:** `itzcrazykns1337/vane:latest` (port 3000 frontend, port 8080 backend)
- **API:** `POST /api/search` with chatModel, embeddingModel, sources, query, optimizationMode
- **Modes:** Speed / Balanced / Quality
- **Sources:** `web` / `academic` / `discussions`
- **Streaming:** SSE (init → sources → response chunks → done)
- **Conversation History:** supports follow-up questions via message pairs
- **Location:** localai-stack (external to Merch Miner)

### Crawl4ai
- **What:** URL deep content extractor — opens pages in Chromium, extracts full content as Markdown
- **Docker:** `unclecode/crawl4ai:latest` (port 11235)
- **API:** FastAPI REST endpoints for HTML extraction, screenshots, JS execution
- **Cannot search** — needs concrete URL(s) as input
- **Location:** localai-stack (external to Merch Miner)

### How they work together
```
User asks question → Vane searches → synthesized answer + source URLs (streamed via SSE)
                                      ↓
                     User clicks "Deep Crawl" on interesting source
                                      ↓
                     Crawl4ai extracts full page content as Markdown (django-rq job)
                                      ↓
                     Content → DB + (if VECTOR_DB_ENABLED) Vector DB (PROJ-15)
```

## User Stories

1. As a member, I want to search the web from within Merch Miner without switching tools, so my research stays in one place.
2. As a member, I want to see AI-synthesized answers with cited sources, so I get quick insights without reading full articles.
3. As a member, I want answers to stream word-by-word, so I can start reading immediately and scroll back without breaking the stream.
4. As a member, I want to deep-crawl interesting source URLs to extract the full content, so valuable info is stored for later use.
5. As a member, I want a floating chat-bar at the bottom that stays out of the way when I don't need it, so my workspace stays clean.
6. As a member, I want to opt-in a current niche as context for my chat, so search results are tailored when I want it.
7. As a member, I want to manually mark text snippets in crawled content and save them as keywords on a niche, so I curate quality.
8. As a member, I want my chat history saved per workspace, so I can revisit past research.
9. As a member, I want to share a chat with my workspace team, so they benefit from my research (read-only for them).
10. As a member, I want to trigger a PROJ-18 Agent workflow from chat with a single command, so I don't have to switch tabs.
11. As a member, I want to see service health (Vane / Crawl4ai online?) so I know what works before I click.
12. As a member, I want to expand the drawer into a full command center (1200px), so I can see workflow + chat + details side-by-side like Notebook LM.

## Acceptance Criteria

### Models

- [x] AC-1: `ChatSession` model: UUID pk, `workspace` FK, `created_by` FK (User), `title` (CharField 200, **auto-generated from first 100 chars of first user message**), `is_shared` (BooleanField, default=False), `niche_context` FK (Niche, nullable, **only set if user explicitly opted-in**), `created_at`, `updated_at`. **No tags M2M.**
- [x] AC-2: `ChatMessage` model: UUID pk, `session` FK (CASCADE), `role` choices [user, assistant, system], `content` (TextField), `message_type` choices [search_query, search_result, crawl_request, crawl_result, **workflow_trigger, workflow_card**], `sources` (JSONField, default=list), `search_mode` (CharField, nullable), `search_sources` (JSONField, nullable), `model_used` (CharField 100, blank=True), **`agent_session` FK (`agent_app.AgentSession`, nullable, on_delete=SET_NULL — only set for `workflow_trigger` / `workflow_card` types)**, `created_at`.
- [x] AC-3: `WebSearchResult` model: UUID pk, `workspace` FK, `chat_message` FK (nullable, on_delete=SET_NULL), `url` (URLField), `title` (CharField 500), `content` (TextField — full crawled Markdown), `content_type` choices [snippet, full_crawl], `crawl_status` choices [pending, running, completed, failed], `error_message` (TextField, blank=True), `metadata` (JSONField — page metadata, word count, favicon URL, etc.), `created_at`.
- [x] AC-4: `SearchUsageLog` model: UUID pk, `workspace` FK, `user` FK, `action` choices [search, deep_crawl], `query` (TextField, blank=True), `url` (URLField, blank=True), `model_used` (CharField 100), `tokens_used` (IntegerField, nullable), `created_at`. For PROJ-12 Analytics tracking.

### Vane Integration (Backend)

- [ ] AC-5: `SearchService.search(query, mode, sources, history, system_instructions)` in `search_app/services/vane_service.py`. Calls Vane `POST /api/search`. Returns synthesized answer + sources list (blocking).
- [ ] AC-6: `SearchService.search_stream()` — SSE generator yielding (event_type, payload) tuples. Used by separate streaming endpoint.
- [ ] AC-7: Default chat LLM: `gpt-4.1-mini` via OpenRouter (env `VANE_DEFAULT_MODEL`). User can select from available OpenRouter models via in-chat model picker.
- [ ] AC-8: Default embedding model: `text-embedding-3-small` (env `VANE_EMBEDDING_MODEL`, same as PROJ-15).
- [ ] AC-9: Conversation history passed to Vane on follow-up queries — enables contextual refinement.

### Crawl4ai Integration (Backend)

- [ ] AC-10: `CrawlService.crawl_url(url)` in `search_app/services/crawl_service.py`. Calls Crawl4ai REST API. Returns Markdown content + metadata (title, word_count, favicon URL).
- [ ] AC-11: Crawl jobs run as django-rq tasks on the **`search` queue** (new `worker-search` container, 5-min timeout). `WebSearchResult.crawl_status` tracks progress.
- [ ] AC-12: Completed crawl content optionally embedded into PROJ-15 Vector DB via `post_save` signal on `WebSearchResult`. **Gated by env flag `VECTOR_DB_ENABLED` (default `true` locally, `false` in prod until PROJ-15 fully deployed).** Chunked at 1500 tokens with 5% overlap.
- [ ] AC-13: Manual "Deep Crawl" button per source. (No auto-crawl modes for MVP — POD presets are future.)

### API Endpoints

- [ ] AC-14: `POST /api/chat/sessions/` — create session. Optional `niche_context` FK.
- [ ] AC-15: `GET /api/chat/sessions/` — list user's sessions (paginated, ordered by updated_at desc). `?shared=true` returns workspace-shared. `?niche_id=` filters by niche.
- [ ] AC-16: `GET /api/chat/sessions/{id}/` — session detail with all messages.
- [ ] AC-17: `POST /api/chat/sessions/{id}/messages/` — send message (blocking). Body: `{content, search_mode, search_sources, model, mode_override}`. Returns assistant message with sources.
- [ ] AC-18: `GET /api/chat/sessions/{id}/messages/stream/?content=...&search_mode=...` — **separate SSE endpoint** for streaming. Returns `text/event-stream` with chunked events: `init`, `sources`, `chunk`, `done`. Uses `EventSource` API on frontend. Backend uses `StreamingHttpResponse`.
- [x] AC-19: `POST /api/chat/sessions/{id}/share/` — sets `is_shared=True`.
- [x] AC-20: `POST /api/chat/sessions/{id}/unshare/` — sets `is_shared=False`.
- [ ] AC-21: `POST /api/search/crawl/` — body: `{url, chat_message_id (optional)}`. Enqueues Crawl4ai job. Returns WebSearchResult with `status=pending`.
- [x] AC-22: `GET /api/search/crawl/{id}/status/` — poll crawl job status.
- [x] AC-23: `POST /api/search/results/{id}/save-to-niche/` — body: `{niche_id, save_as: "keywords" | "notes", selected_text: "..."}`. **Keywords are extracted from `selected_text` (manually marked snippet from frontend), each line/comma-separated entry creates a `NicheKeyword` with `source='web_search'`. Notes append `selected_text` to `Niche.notes`.**
- [x] AC-24: `PATCH /api/chat/sessions/{id}/` — update `title` only. (No tag updates — tags removed.)

### Floating Bottom Chat-Bar (Frontend)

- [x] AC-25: Persistent `position: fixed; bottom: 0; left: 50%; transform: translateX(-50%)` chat-bar at **bottom-center** of screen. Visible on all pages (except login/register). Glasmorphism style: `backgroundColor: alpha(white, 0.85)` light / `alpha(inkPaper, 0.75)` dark, `backdropFilter: blur(16px)` — matches Topbar.
- [x] AC-26: **Default state: collapsed.** Only a small transparent chevron-up icon (~32×24px) sits centered at bottom edge.
- [x] AC-27: Click chevron-up → bar **slides up** (CSS transition) into expanded state: `TextField` + Mode-Dropdown (`Auto / Web-Search / Agent`) + Send IconButton. (Note: ModeDropdown UI lives in Phase 4 — bar surface + slide-up done.)
- [x] AC-28: Expanded bar has chevron-down icon top-center → click to collapse back to indicator.
- [x] AC-29: Submitting a message **opens the Right Drawer with Chat panel active** (if not already open) and creates/uses the active session.
- [x] AC-30: Bar state (collapsed/expanded) persisted in `localStorage` per browser tab (per-tab via Redux, not cross-tab synced).

### Multi-Purpose Right Drawer (Frontend)

- [x] AC-31: Single right drawer **resizable** between 480px (default) → 768px (split-view) → 1200px (full command center, NotebookLM-style). Drag-handle on left edge of drawer. Width persisted in `localStorage`.
- [x] AC-32: Header contains `ToggleButtonGroup exclusive` with 3 segments: `[📋 Niche] [💬 Chat] [🤖 Agent]`. Icons: `InfoOutlined` / `ChatOutlined` / `SmartToyOutlined`.
- [x] AC-33: Switching segments swaps content. Drawer stays open. Each panel maintains scroll position.
- [x] AC-34: **`SearchResultsPanel.tsx` removed** — search results render inline inside `ChatPanel.tsx` as bubbles + Source-Cards (see AC-38).
- [x] AC-35: Niche-Tab: existing NicheDetailDrawer content wrapped as `NicheDetailPanel.tsx` inside MultiPurposeDrawer.
- [x] AC-36: Agent-Tab: PROJ-18 AgentPanel (resizable layout per PROJ-18 AC-50).

### Chat Panel (Frontend)

- [ ] AC-37: `ChatPanel.tsx` shows: active session messages (scrollable, latest at bottom), input bar with Mode-Dropdown + Model picker + Search Mode toggle (Speed/Balanced/Quality) + Source toggles (web/academic/discussions). Read-only mode for shared sessions where viewer is not owner.
- [x] AC-38: Each AI message bubble shows **Source Cards in Perplexity-Style**: Favicon (32×32) + Domain + Title + 1-line Snippet + actions: `[🌐 Deep Crawl]` `[💾 Save Keywords]` `[📝 Save Notes]`. Stacked below the AI answer text.
- [x] AC-39: When User scrolls **up** during a streaming response → auto-scroll **disengages**. Stream continues unaffected. A "**↓ Jump to latest**" floating button appears bottom-right of message-list. Click → re-engages auto-scroll, jumps to bottom.
- [x] AC-40: When User manually scrolls back to bottom (within ~50px) → auto-scroll re-engages automatically, "Jump to latest" button disappears.
- [ ] AC-41: Mode-Dropdown in chat input: `Auto` (default — LLM classifier decides Vane vs. Agent), `Web-Search` (force Vane), `Agent` (force PROJ-18). Auto classifier uses lightweight LLM (gpt-4.1-mini, ~50 tokens) for routing.

### Workflow-Card (Frontend, NEW for Pattern B)

- [ ] AC-42: When `ChatMessage.message_type == 'workflow_card'` → render `WorkflowCard.tsx` instead of normal text bubble. Inline in chat stream.
- [ ] AC-43: WorkflowCard shows: Mini-Stepper (workflow steps with checkmarks for completed, spinner for running, dots for pending), live-updated via PROJ-18 Agent polling/SSE. Inline ApprovalCard if approval pending. "→ Open Command Center" link.
- [ ] AC-44: "Open Command Center" link switches drawer to Agent-Tab + scrolls to the corresponding AgentSession.
- [ ] AC-45: Approval buttons inside WorkflowCard call PROJ-18 approval endpoint directly. No need to switch to Agent-Tab for simple approve/reject.

### Niche Context

- [ ] AC-46: Chat-Panel header has a Toggle: "Use current Niche as context" (only visible when user has a Niche in NicheDetail tab). **Default OFF.**
- [ ] AC-47: When toggled ON, chip shows "Context: {Niche Name}" with X to remove. Context persists across messages within the session until removed or session ends.
- [ ] AC-48: Context passed as `system_instructions` to Vane: "The user is researching the niche: {niche_name}. Tailor your search results to this context."
- [ ] AC-49: Context chip also persists for Agent-mode commands — passed as niche_context to AgentSession.

### Save-to-Niche (Manual Snippet Selection)

- [ ] AC-50: In a crawled WebSearchResult, User can **select text** with mouse → toolbar pops up with `[💾 Save as Keywords]` `[📝 Save as Notes]` buttons.
- [ ] AC-51: "Save as Keywords" splits selected text by commas/newlines, creates one `NicheKeyword` per token (source='web_search', niche=current_context_or_picker). Notistack confirmation.
- [ ] AC-52: "Save as Notes" appends selected text to `Niche.notes` with timestamp + source URL prefix.
- [ ] AC-53: If no Niche-Context is active, modal asks: "Save to which niche?" with searchable Niche-Picker.

### Chat History & Sharing

- [ ] AC-54: Chat sessions persisted in DB. Chat-Panel header shows "Recent Chats" dropdown (last 10 sessions, clickable to resume).
- [ ] AC-55: "Share" button per active session → `POST /api/chat/sessions/{id}/share/`. Shared sessions appear in teammates' lists with "Shared by {username}" badge.
- [ ] AC-56: Shared sessions are **read-only** for non-owners. They can still trigger Deep-Crawl on sources (creates their own WebSearchResult). They cannot send messages or share/unshare.

### Health Check

- [ ] AC-57: `GET /api/search/health/` — pings Vane (`VANE_API_URL`) + Crawl4ai (`CRAWL4AI_API_URL`). Returns `{vane: "online"|"offline", crawl4ai: "online"|"offline"}`.
- [x] AC-58: Frontend polls health endpoint **every 5 minutes** (low frequency — services are stable infra). Status indicator dot in chat-bar + drawer header: green (all online), yellow (partial), red (all offline).
- [ ] AC-59: When a service is offline, related UI actions disabled with tooltip. "Deep Crawl" disabled when Crawl4ai offline. Search disabled when Vane offline. Agent (PROJ-18) remains functional regardless.

### Usage Tracking

- [ ] AC-60: Every search and crawl action creates a `SearchUsageLog` entry (user, workspace, action type, query/url, model, tokens).
- [ ] AC-61: Usage data available to PROJ-12 Analytics for reporting.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat/sessions/` | Member | Create chat session |
| GET | `/api/chat/sessions/` | Member | List user's sessions (`?shared`, `?niche_id`) |
| GET | `/api/chat/sessions/{id}/` | Member | Session detail + messages |
| PATCH | `/api/chat/sessions/{id}/` | Member | Update session title |
| POST | `/api/chat/sessions/{id}/messages/` | Member | Send message (blocking) |
| GET | `/api/chat/sessions/{id}/messages/stream/` | Member | Send message (SSE streaming) |
| POST | `/api/chat/sessions/{id}/share/` | Member | Share session with workspace |
| POST | `/api/chat/sessions/{id}/unshare/` | Member | Unshare session |
| POST | `/api/search/crawl/` | Member | Trigger Crawl4ai deep crawl |
| GET | `/api/search/crawl/{id}/status/` | Member | Poll crawl status |
| POST | `/api/search/results/{id}/save-to-niche/` | Member | Save snippet to niche (keywords or notes) |
| GET | `/api/search/health/` | Member | Service health check |

## Edge Cases

- [ ] EC-1: Vane down → search disabled, health dot red, tooltip "Web Search unavailable". Drawer remains open. Agent (PROJ-18) still works.
- [ ] EC-2: Crawl4ai down → "Deep Crawl" buttons disabled, tooltip. Search results (Vane snippets) still shown normally.
- [ ] EC-3: Both services down → red dot, search + crawl disabled. Banner "Search services offline".
- [ ] EC-4: Vane returns 0 sources → "No results found. Try different keywords or search mode." No error.
- [ ] EC-5: Crawl4ai fails on URL (403, anti-bot block) → `crawl_status=failed`, error message inline. User can retry.
- [ ] EC-6: Crawl4ai returns extremely large page (>50k tokens) → content truncated to 50k tokens with note. Chunking in PROJ-15 handles the rest.
- [ ] EC-7: User sends message while previous SSE stream still running → previous stream is cancelled (frontend closes EventSource), new stream starts.
- [ ] EC-8: User scrolls up during streaming → auto-scroll disengages, "Jump to latest" appears. User can read older messages while stream continues.
- [ ] EC-9: User clicks "Jump to latest" → smooth scroll to bottom + auto-scroll re-engages.
- [ ] EC-10: Chat session with 100+ messages → paginate (latest 50 returned by API, "Load more" loads older).
- [ ] EC-11: Shared session viewed by teammate → read-only. Teammate can Deep-Crawl sources but cannot send messages.
- [ ] EC-12: `niche_context` Niche gets deleted → context chip removed (FK SET_NULL), session continues without context.
- [ ] EC-13: Bottom chat-bar on mobile (<600px) → full-width bar, drawer opens as full-screen overlay.
- [ ] EC-14: Multiple browser tabs open → each tab has its own chat-bar state via Redux (no cross-tab sync for MVP).
- [ ] EC-15: `VECTOR_DB_ENABLED=false` → crawl content stored in DB but **not** embedded. Save-to-Vector-DB indicator shown as "queued — vector DB disabled". Backfill possible later via management command.
- [ ] EC-16: Mode-Dropdown set to `Auto` and classifier returns Agent route → trigger PROJ-18 AgentSession via API, then create `workflow_card` ChatMessage referencing it.
- [ ] EC-17: Mode-Dropdown set to `Agent` but PROJ-18 unavailable → fallback to Web-Search with notistack warning.
- [ ] EC-18: User selects text snippet for "Save as Keywords" but no Niche-Context active → modal opens with searchable Niche-Picker.

## Environment Variables Required

```
# Vane + Crawl4ai
VANE_API_URL=                          # e.g. http://vane:3000 in prod, http://host.docker.internal:3000 with SSH tunnel locally
CRAWL4AI_API_URL=                      # e.g. http://crawl4ai:11235 in prod
VANE_DEFAULT_MODEL=gpt-4.1-mini
VANE_EMBEDDING_MODEL=text-embedding-3-small

# Vector DB Feature Flag (PROJ-15 stub)
VECTOR_DB_ENABLED=true                 # Set false in prod until PROJ-15 backfill complete

# Existing (shared with PROJ-6, PROJ-9, PROJ-15)
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Document in `.env.dev.template` + `.env.prod.template`.

## Dependencies

**Requires:**
- PROJ-4 (Workspace & Membership — workspace FK, member auth)
- PROJ-5 (Niche model — context awareness, save-to-niche)
- PROJ-10 (NicheKeyword model — `source='web_search'` already supported)
- PROJ-15 (Vector Database — embeddings via post_save signal, **gated by VECTOR_DB_ENABLED flag**)
- PROJ-18 (OpenClaw Agent — Workflow-Card renders AgentSession references, Agent-Tab in same drawer)

**Consumed by:**
- PROJ-12 (Dashboard & Analytics — reads `SearchUsageLog` for dashboard widgets)

## Infrastructure Requirements

- Vane + Crawl4ai must be running in localai-stack (internal Docker network only — no public exposure)
- For local dev: SSH tunnel from Mac to server forwards Mac:3000 → vane:3000 + Mac:11235 → crawl4ai:11235 (helper script in `scripts/dev-tunnel.sh`)
- New Docker service `worker-search` (`search` queue, 5-min timeout) added to `docker-compose.yml`
- New Caddy route NOT needed (services stay internal)

## Decisions Log

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Vane integration | External service in localai-stack | Internal-only, no public exposure |
| 2 | Crawl4ai integration | External service in localai-stack | Same as Vane |
| 3 | UI Pattern | Pattern B Hybrid (Chat as Frontdoor + Agent-Tab as Detail) | Single-input UX + power features in dedicated tab |
| 4 | Drawer tabs | Niche / Chat / Agent (Search-Panel removed) | Sources inline in Chat, less mental overhead |
| 5 | Floating bar | Bottom-center + default-collapsed + glasmorphism | Matches Topbar, low UI noise, quick access |
| 6 | Drawer resize | 480 → 768 → 1200 (NotebookLM Full-Mode) | Adapts to use case |
| 7 | Streaming | SSE on separate endpoint | Clean separation, browser handles reconnect |
| 8 | Auto-scroll | Disengage on user scroll up + "Jump to latest" button | Lets user read while stream continues |
| 9 | Search results display | Inline in Chat with Perplexity-Style cards (Favicon + 1-line) | Single locus, no panel-switching |
| 10 | Crawl queue | Dedicated `worker-search` (5-min timeout) | Isolated from agent + default queues |
| 11 | Vector DB integration | Gated by `VECTOR_DB_ENABLED` flag | PROJ-17 deployable independently of PROJ-15 backfill |
| 12 | Workflow cards | `ChatMessage.message_type='workflow_card'` + `agent_session` FK | Pattern B inline workflow rendering |
| 13 | Mode classifier | LLM classifier (gpt-4.1-mini, ~50 tokens) | Auto-route Web vs. Agent transparently |
| 14 | Tag system | NOT in MVP | YAGNI — niche_context is enough |
| 15 | Sharing | Private default + explicit Share + read-only for others | Privacy by default, conscious sharing |
| 16 | Session title | First 100 chars of first user message | Simple, fast, free |
| 17 | Health check polling | 5 minutes | Stable infra, no need for 60s |
| 18 | Keyword extraction | Manual text-selection by user | User-curated quality |
| 19 | Markdown render | react-markdown + remark-gfm + rehype-sanitize | GFM features + security |
| 20 | i18n | All 5 locales (EN/DE/FR/ES/IT) | Aligned with rest of app |
| 21 | ChatSession ↔ AgentSession link | FK on `ChatMessage.agent_session` (not on session itself) | One ChatSession can trigger multiple workflows over time |

## Tech Design (Solution Architect)

> Decided: 2026-03-27 | Re-aligned: 2026-04-25 (Pattern B + Spec-Review)

### A) Backend Architecture

**Django app:** `search_app` (already exists)

```
search_app/
├── models.py                           # ChatSession, ChatMessage, WebSearchResult, SearchUsageLog
│                                       #   (NO ChatTag — removed)
├── api/
│   ├── views.py                        # Chat CRUD, message send (blocking + SSE),
│   │                                   #   crawl trigger, save-to-niche, health, share/unshare
│   ├── serializers.py                  # All serializers
│   └── urls.py                         # URL routing
├── services/
│   ├── vane_service.py                 # Vane API client (search + search_stream)
│   ├── crawl_service.py                # Crawl4ai API client (crawl_url)
│   ├── context_builder.py              # Build system_instructions from niche context
│   └── mode_classifier.py              # Auto-mode LLM classifier (Web vs. Agent routing)
├── tasks.py                            # django-rq: crawl jobs (search queue)
├── signals.py                          # post_save → optional Vector DB embedding (gated)
├── admin.py
└── tests/
```

**Registered in:** `core/settings.py INSTALLED_APPS`, `core/urls.py`.

### B) Frontend Architecture

**Global components:**

```
components/
├── FloatingChatBar/
│   ├── index.tsx                       # Bottom-center, glasmorphism, default-collapsed
│   ├── ChatBarInput.tsx                # Expanded form: TextField + Mode-Dropdown + Send
│   └── ChevronIndicator.tsx            # Default-state chevron-up trigger
│
└── MultiPurposeDrawer/
    ├── index.tsx                       # Resizable shell (480/768/1200) + ToggleButtonGroup
    ├── DrawerSegments.tsx              # 3 segments: Niche | Chat | Agent
    ├── DrawerResizeHandle.tsx          # Drag-handle on left edge
    ├── HealthStatusDot.tsx             # 5-min poll status indicator
    ├── hooks/
    │   ├── useSearchHealth.ts          # 5-min health poll
    │   └── useDrawerResize.ts          # Resize state + localStorage persist
    └── panels/
        ├── NicheDetailPanel.tsx        # Wrapped existing NicheDetailDrawer content
        ├── ChatPanel.tsx               # Chat (with inline Sources + WorkflowCards)
        │   ├── ChatMessageList.tsx     # Scrollable, Markdown, Auto-Scroll-Disengage
        │   ├── ChatInputBar.tsx        # Input + Mode-Dropdown + Model picker + toggles
        │   ├── ContextChip.tsx         # Sticky niche context (opt-in toggle)
        │   ├── ContextToggle.tsx       # "Use current Niche as context" switch
        │   ├── RecentChats.tsx         # Last 10 sessions
        │   ├── ModeDropdown.tsx        # Auto / Web-Search / Agent
        │   ├── JumpToLatestButton.tsx  # Floating button on disengaged scroll
        │   ├── WorkflowCard.tsx        # Inline AgentSession card (NEW)
        │   ├── ApprovalCard.tsx        # Inline approval button card (NEW)
        │   ├── VaneAnswer.tsx          # Markdown rendering (react-markdown + gfm + sanitize)
        │   └── SourceCard.tsx          # Perplexity-style with Favicon
        ├── AgentPanel/                 # PROJ-18 (existing)
        └── (NO SearchResultsPanel — removed)

components/SaveSnippetToolbar/          # Pop-up on text selection in CrawlResult
└── index.tsx                           # Save as Keywords / Save as Notes

store/
├── searchSlice.ts                      # RTK Query: sessions, messages, crawl, health, save-to-niche
└── chatBarSlice.ts                     # UI state: collapsed/expanded, active session, drawer width
```

### C) Tech Decisions (Updated 2026-04-25)

| Decision | Why |
|----------|-----|
| `search_app` separate from `vector_app` | Search = user-facing chat. Vector = infrastructure. Different concerns |
| Vane + Crawl4ai as external services in localai-stack | No public exposure, internal Docker network only |
| Pattern B Hybrid (Chat as Frontdoor + Agent-Tab as Detail) | Single-input UX + power features in dedicated tab |
| Floating Bar = bottom-center, default-collapsed, glasmorphism | Matches Topbar style, low UI noise, quick access |
| Drawer 3 tabs: Niche / Chat / Agent (no Search tab) | Search results inline in Chat, less mental overhead |
| Resizable 480 → 768 → 1200 (NotebookLM Full-Mode) | Adapts to use case from compact to power-user |
| SSE streaming via separate endpoint (`/messages/stream/`) | Clean separation from blocking POST. Browser EventSource handles reconnect |
| Auto-Scroll-Disengage on user scroll up | Lets user read while stream continues — no broken UX |
| Crawl jobs on dedicated `worker-search` queue | Isolated from `agent` and `default` queues — no blocking |
| Vector DB integration gated by feature flag | PROJ-17 deployable independently of PROJ-15 backfill status |
| ChatMessage `agent_session` FK + `workflow_card` type | Pattern B inline workflow cards reference AgentSession |
| Mode-Dropdown LLM classifier (gpt-4.1-mini, ~50 tokens) | Auto-route Web vs. Agent without manual selection |
| No Tag system in MVP | YAGNI — niche_context is enough categorization for MVP |
| Health check polling 5-min | Vane + Crawl4ai are stable infra — 60s polling overkill |
| Manual keyword extraction (text-selection) | User-curated quality > auto-LLM-extraction noise |
| `react-markdown` + `remark-gfm` + `rehype-sanitize` | Tables, GFM features + security against HTML injection |
| All 5 i18n locales (EN/DE/FR/ES/IT) | Aligned with rest of app |

### D) Infrastructure Changes

| Change | Where |
|--------|-------|
| `search_app` registered | `INSTALLED_APPS` + `core/urls.py` (already done) |
| 5 env vars | `VANE_API_URL`, `CRAWL4AI_API_URL`, `VANE_DEFAULT_MODEL`, `VANE_EMBEDDING_MODEL`, `VECTOR_DB_ENABLED` |
| New `worker-search` Docker service | `docker-compose.yml` — `python manage.py rqworker search` |
| New RQ queue | `RQ_QUEUES['search']` in `settings.py` (5-min timeout) |
| SSH-Tunnel helper script for local dev | `scripts/dev-tunnel.sh` |
| MultiPurposeDrawer replaces NicheDetailDrawer | `frontend-ui/src/components/` (already wrapped) |

### E) New Packages

**Backend:** none (all already installed: `httpx`, `langchain-openai` for classifier).

**Frontend:**

| Package | Purpose |
|---------|---------|
| `react-markdown` | Render Vane answers + crawl content (already installed) |
| `remark-gfm` | GFM tables, strikethrough, task lists (already installed) |
| `rehype-sanitize` | Sanitize HTML in markdown output (NEW) |

## Verification Steps

1. Floating bar default-collapsed → click chevron-up → bar expands → glasmorphism style matches Topbar
2. Type "camping trends" in floating bar → submit → drawer opens with Chat panel active
3. Vane streams answer word-by-word via SSE; sources appear as Perplexity-Style cards with favicons
4. While streaming, scroll up → auto-scroll disengages, "Jump to latest" button appears
5. Click "Jump to latest" → smooth scroll to bottom, button disappears, auto-scroll re-engages
6. Click "Deep Crawl" on source → status pending → running → completed. Markdown content stored
7. Crawl content embedded into Vector DB (if `VECTOR_DB_ENABLED=true`)
8. Mark text snippet in crawled content → toolbar appears → "Save as Keywords" → keywords saved to current Niche-Context (or Niche-Picker modal)
9. Niche "Camping Dad" open in NicheDetail-Tab → switch to Chat-Tab → toggle "Use as context" ON → context chip appears
10. Send message with context → Vane receives `system_instructions` with niche name
11. Mode-Dropdown set to "Agent" → send command "Recherchiere Camping Dad Trends" → AgentSession created → WorkflowCard inline in chat with mini-stepper
12. Click "Open Command Center" in WorkflowCard → drawer switches to Agent-Tab, scrolls to session
13. Approve approval-card inside WorkflowCard → PROJ-18 endpoint called → workflow continues
14. Drawer drag-handle → resize from 480 → 768 → 1200px. Width persisted in localStorage
15. 1200px Full-Mode shows NotebookLM-style 3-column layout (state | conversation | active detail)
16. Health: Vane online → green dot. Crawl4ai offline → yellow dot, "Deep Crawl" disabled
17. Both services offline → red dot, banner "Search services offline"
18. Share session → teammate sees in their list with "Shared by {username}", read-only
19. Workspace isolation: other workspace's sessions not visible
20. 100+ messages → paginate (latest 50, "Load more" loads older)

## Future Enhancements (not MVP)

- POD-specific search modes (Trend Search, Market Research) as prompt presets
- Crawl4ai AdaptiveCrawler for auto-following links
- LightRAG for knowledge graph extraction
- WebSocket alternative if multi-user live-collaboration becomes needed
- Voice input for chat-bar
- Tag system for chat sessions (deferred from MVP — currently filter only via `niche_context`)
- Chat session export (PDF, Markdown)

## QA Test Results

_To be added by /qa_

## Deployment

_To be added by /deploy_
