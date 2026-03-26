# PROJ-17: Deep Web Search (Vane + Crawl4ai)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-03-24

## Overview

In-app deep web search powered by two external services: **Vane** (formerly Perplexica — AI-powered search engine with LLM answer synthesis) and **Crawl4ai** (deep URL crawler with JavaScript rendering). Both run as external services in the localai-Stack.

The UI consists of two parts: a **floating bottom chat-bar** (centered, always accessible) as input, and a **multi-purpose right drawer** as output. The drawer uses a `ToggleButtonGroup exclusive` (segmented button) to switch between panels: Niche Detail, Chat, and Search Results. The drawer is shared with existing features (PROJ-5 NicheDetailDrawer) — one drawer, multiple views.

Search results are automatically stored in the Vector DB (PROJ-15). The system suggests where results should flow based on the user's current page context (e.g. "Save to Niche: Camping Dad?"). Chat history is persistent and private by default, with explicit sharing to workspace.

## External Services

### Vane (formerly Perplexica)
- **What:** AI answering engine — takes a question, searches via SearXNG, LLM synthesizes answer with cited sources
- **Docker:** `itzcrazykns1337/vane:latest` (default port 3000, actual port configured via `VANE_API_URL` env var)
- **API:** `POST /api/search` with chatModel, embeddingModel, sources, query, optimizationMode
- **Modes:** Speed, Balanced, Quality
- **Sources:** `web`, `academic`, `discussions`
- **Streaming:** SSE (init → sources → response chunks → done)
- **Conversation History:** supports follow-up questions via message pairs
- **Location:** localai-stack (external to Merch Miner)
- **Needs:** own embedding model + chat LLM (both via OpenRouter)

### Crawl4ai
- **What:** URL-based deep content extractor — opens pages in Chromium, extracts full content as Markdown
- **Docker:** `unclecode/crawl4ai:latest` (default port 11235, actual port configured via `CRAWL4AI_API_URL` env var)
- **API:** FastAPI REST endpoints for HTML extraction, screenshots, JS execution
- **Cannot search** — needs concrete URL(s) as input
- **Features:** JavaScript rendering, anti-bot detection, LLM-based structured extraction, BFS deep crawling
- **Location:** localai-stack (external to Merch Miner)

### How they work together
```
User asks question → Vane searches → synthesized answer + source URLs
                                      ↓
                     User clicks "Deep Crawl" on interesting source
                                      ↓
                     Crawl4ai extracts full page content as Markdown
                                      ↓
                     Content → Vector DB (PROJ-15) for future retrieval
```

## User Stories

1. As a member, I want to search the web from within Merch Miner without switching to external tools, so my research stays in one place.
2. As a member, I want to see AI-synthesized answers with cited sources, so I get quick insights without reading entire articles.
3. As a member, I want to deep-crawl interesting source URLs to extract the full content, so valuable information is stored for later use.
4. As a member, I want a floating chat bar available on every page, so I can search from anywhere without navigating away.
5. As a member, I want the chat to know which niche I'm currently viewing, so search results are automatically contextualized.
6. As a member, I want to save search results to a specific niche or keyword bank with one click, so findings flow into my pipeline.
7. As a member, I want my chat history saved and searchable, so I can revisit past research.
8. As a member, I want to tag and categorize my chats, so I can filter and find them later.
9. As a member, I want chats automatically assigned to the niche I was researching, so I don't have to organize manually.
10. As a member, I want to share a chat with my workspace team, so they benefit from my research.
11. As a member, I want to see if search services are online before I use them, so I'm not surprised by errors.
12. As a member, I want to switch between Niche Detail, Chat, and Search panels in the same drawer, so I can work without clutter.

## Acceptance Criteria

### Models

- [ ] AC-1: `ChatSession` model: UUID pk, `workspace` FK, `created_by` FK (User), `title` (CharField 200, auto-generated from first query), `is_shared` (BooleanField, default=False), `niche_context` FK (Niche, nullable — auto-assigned from active niche context at session creation), `tags` M2M (ChatTag, blank=True), `created_at`, `updated_at`.
- [ ] AC-1b: `ChatTag` model: UUID pk, `workspace` FK, `name` (CharField 50), `color` (CharField 7, default="#6B7280" — hex color for chip display), `created_by` FK (User), `created_at`. `unique_together = [('workspace', 'name')]`. Default tags seeded per workspace: "Research", "Keywords", "Competitors", "Ideas", "General".
- [ ] AC-2: `ChatMessage` model: UUID pk, `session` FK (ChatSession, on_delete=CASCADE), `role` choices [user, assistant, system], `content` (TextField), `message_type` choices [search_query, search_result, crawl_request, crawl_result, agent_message], `sources` (JSONField, default=list — array of {title, url, snippet}), `search_mode` (CharField, nullable — speed/balanced/quality), `search_sources` (JSONField, nullable — [web, academic, discussions]), `model_used` (CharField 100, blank=True), `created_at`.
- [ ] AC-3: `WebSearchResult` model: UUID pk, `workspace` FK, `chat_message` FK (ChatMessage, nullable, on_delete=SET_NULL), `url` (URLField), `title` (CharField 500), `content` (TextField — full crawled Markdown content), `content_type` choices [snippet, full_crawl], `crawl_status` choices [pending, running, completed, failed], `error_message` (TextField, blank=True), `metadata` (JSONField — page metadata, word count, etc.), `created_at`.
- [ ] AC-4: `SearchUsageLog` model: UUID pk, `workspace` FK, `user` FK, `action` choices [search, deep_crawl], `query` (TextField, blank=True), `url` (URLField, blank=True), `model_used` (CharField 100), `tokens_used` (IntegerField, nullable), `created_at`. For PROJ-15 Analytics tracking.

### Vane Integration (Backend)

- [ ] AC-5: `SearchService` class in `search_app/services.py` with method `search(query, mode='balanced', sources=['web'], history=[], system_instructions=None)`. Calls Vane `POST /api/search` endpoint. Returns synthesized answer + sources list.
- [ ] AC-6: Streaming support — `search_stream()` method returns SSE generator. Frontend receives chunks in real-time via Django StreamingHttpResponse or WebSocket.
- [ ] AC-7: Default chat LLM: `gpt-4.1-mini` via OpenRouter. User can select from available OpenRouter models via settings or in-chat model picker.
- [ ] AC-8: Default embedding model: `text-embedding-3-small` via OpenRouter (same as PROJ-15).
- [ ] AC-9: Conversation history passed to Vane on follow-up queries — enables contextual refinement.

### Crawl4ai Integration (Backend)

- [ ] AC-10: `CrawlService` class in `search_app/services.py` with method `crawl_url(url)`. Calls Crawl4ai REST API on port 11235. Returns Markdown content + metadata.
- [ ] AC-11: Crawl jobs run as django-rq tasks (async). `WebSearchResult.crawl_status` tracks progress (pending → running → completed/failed).
- [ ] AC-12: Completed crawl content is automatically sent to PROJ-15 Vector DB via `post_save` signal on `WebSearchResult` (content_type=`web_search`, chunked at 1500 tokens with 5% overlap).
- [ ] AC-13: "Market Research" source type auto-triggers Crawl4ai on Top-3 source URLs from Vane results. Other modes: manual "Deep Crawl" button per source.

### API Endpoints

- [ ] AC-14: `POST /api/chat/sessions/` — create new chat session. Optional `niche_context` FK.
- [ ] AC-15: `GET /api/chat/sessions/` — list user's sessions (paginated, ordered by updated_at desc). `?shared=true` returns workspace-shared sessions.
- [ ] AC-16: `GET /api/chat/sessions/{id}/` — session detail with all messages.
- [ ] AC-17: `POST /api/chat/sessions/{id}/messages/` — send message (triggers Vane search). Body: `{content, search_mode, search_sources, model}`. Returns assistant message with sources. Supports streaming via `?stream=true`.
- [ ] AC-18: `POST /api/chat/sessions/{id}/share/` — sets `is_shared=True`. Workspace members can now see this session.
- [ ] AC-19: `POST /api/chat/sessions/{id}/unshare/` — sets `is_shared=False`.
- [ ] AC-20: `POST /api/search/crawl/` — body: `{url, chat_message_id (optional)}`. Enqueues Crawl4ai job. Returns WebSearchResult with status=pending.
- [ ] AC-21: `GET /api/search/crawl/{id}/status/` — poll crawl job status.
- [ ] AC-22: `POST /api/search/results/{id}/save-to-niche/` — body: `{niche_id, save_as: "keywords" | "notes"}`. Extracts relevant data from WebSearchResult and saves to target niche (keywords → PROJ-10 Keyword Bank, notes → Niche.notes append).

### Floating Bottom Chat-Bar (Frontend)

- [ ] AC-23: Persistent `position: fixed` bar at bottom center of screen. Visible on all pages. Slim, horizontal, modern transparent design.
- [ ] AC-24: Click on bar → expands upward (CSS transition) into input area with text field + send button.
- [ ] AC-25: Dismiss: click outside or close button → bar animates downward and disappears completely.
- [ ] AC-26: Hidden state: hovering near bottom screen edge reveals an upward arrow indicator in a modern transparent style. Click → chat bar reappears.
- [ ] AC-27: Submitting a message opens the Right Drawer with Chat panel active (if not already open).

### Multi-Purpose Right Drawer (Frontend)

- [ ] AC-28: Single right drawer (480px) shared between panels. Header contains `ToggleButtonGroup exclusive` with segments: Niche Detail (existing) | Chat | Search.
- [ ] AC-29: Segmented buttons use icons + short labels. Icons: `InfoOutlined` (Niche) | `ChatOutlined` (Chat) | `SearchOutlined` (Search).
- [ ] AC-30: Switching segments swaps the drawer content. Drawer stays open. Each panel maintains its own scroll position.
- [ ] AC-31: Chat panel shows: active session messages (scrollable), model picker dropdown, search mode toggle (Speed/Balanced/Quality), source toggles (web/academic/discussions).
- [ ] AC-32: Search results panel shows: Vane answer with Markdown rendering, source cards with title + URL + snippet + "Deep Crawl" button, crawl status indicators per source.

### Context Awareness (Frontend)

- [ ] AC-33: When user has a Niche open (NicheDetailDrawer was active), switching to Chat panel shows sticky context chip: "Context: {Niche Name}" with X to remove.
- [ ] AC-34: Sticky context is passed as `system_instructions` to Vane: "The user is researching the niche: {niche_name}. Tailor your search results to this context."
- [ ] AC-35: Context chip persists across messages within the session. Removing it (X click) clears context for subsequent messages in that session.

### Smart Suggest (Frontend)

- [ ] AC-36: Each search result and crawl result shows contextual quick-action buttons: "Save to {active niche}" (if context set), "Save Keywords", "Save to Vector DB" (always).
- [ ] AC-37: "Save to {niche}" button calls `POST /api/search/results/{id}/save-to-niche/` with the context niche. Success → notistack confirmation.
- [ ] AC-38: All search results (Vane answers) and crawl results are automatically stored in Vector DB (PROJ-15) via ChatMessage and WebSearchResult post_save signals. Quick-action "Save to Vector DB" button is always shown as already-saved indicator (checkmark).

### Chat History & Sharing

- [ ] AC-39: Chat sessions persisted in DB. User sees "Recent Chats" list in Chat panel header (last 10, clickable to resume).
- [ ] AC-40: "Share" button per session → `POST /api/chat/sessions/{id}/share/`. Shared sessions appear in teammates' session lists with "Shared by {username}" badge.
- [ ] AC-41: Shared sessions are read-only for non-owners. Owner can unshare.

### Chat Categorization & Tagging

- [ ] AC-42: Chat sessions are auto-assigned to the active niche context at creation time (`niche_context` FK). Sessions without niche context → categorized as "General".
- [ ] AC-43: User can add/remove tags on any session they own. Tags displayed as colored MUI Chips on session list items.
- [ ] AC-44: `GET /api/chat/tags/` — list all workspace tags. `POST /api/chat/tags/` — create custom tag (name + color). `DELETE /api/chat/tags/{id}/` — delete custom tag (removes from all sessions).
- [ ] AC-45: `PATCH /api/chat/sessions/{id}/` — update tags (`tag_ids` array) and/or title.
- [ ] AC-46: Session list filterable by niche (`?niche_id=`) and by tag (`?tag_id=`). Both filters combinable.
- [ ] AC-47: Default tags ("Research", "Keywords", "Competitors", "Ideas", "General") auto-created on workspace creation. Not deletable (system tags). Custom tags deletable.
- [ ] AC-48: Chat panel "Recent Chats" list shows: title, niche name chip (if set), tag chips, timestamp, shared badge.

### Health Check

- [ ] AC-49: `GET /api/search/health/` — pings Vane (`VANE_API_URL`) + Crawl4ai (`CRAWL4AI_API_URL`). Returns `{vane: "online"|"offline", crawl4ai: "online"|"offline"}`.
- [ ] AC-50: Frontend polls health endpoint every 60 seconds. Status indicator dot in chat-bar and drawer header: green (all online), yellow (partial), red (all offline).
- [ ] AC-51: When a service is offline, its related UI actions are disabled with tooltip explanation. "Deep Crawl" button disabled when Crawl4ai offline. Search disabled when Vane offline. Agent chat (PROJ-18) remains functional regardless.

### Usage Tracking

- [ ] AC-52: Every search and crawl action creates a `SearchUsageLog` entry (user, workspace, action type, query/url, model, tokens).
- [ ] AC-53: Usage data available to PROJ-15 Analytics for reporting.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/chat/sessions/` | Member | Create chat session |
| GET | `/api/chat/sessions/` | Member | List user's sessions |
| GET | `/api/chat/sessions/{id}/` | Member | Session detail + messages |
| POST | `/api/chat/sessions/{id}/messages/` | Member | Send message (triggers search) |
| POST | `/api/chat/sessions/{id}/share/` | Member | Share session with workspace |
| POST | `/api/chat/sessions/{id}/unshare/` | Member | Unshare session |
| POST | `/api/search/crawl/` | Member | Trigger Crawl4ai deep crawl |
| GET | `/api/search/crawl/{id}/status/` | Member | Poll crawl status |
| POST | `/api/search/results/{id}/save-to-niche/` | Member | Save result to niche |
| GET | `/api/chat/tags/` | Member | List workspace tags |
| POST | `/api/chat/tags/` | Member | Create custom tag |
| DELETE | `/api/chat/tags/{id}/` | Member | Delete custom tag |
| PATCH | `/api/chat/sessions/{id}/` | Member | Update session (tags, title) |
| GET | `/api/search/health/` | Member | Service health check |

## Edge Cases

- [ ] EC-1: Vane down → search disabled, health dot yellow/red, tooltip "Web Search unavailable". Chat drawer remains open, Agent (PROJ-18) still works.
- [ ] EC-2: Crawl4ai down → "Deep Crawl" buttons disabled, tooltip "Deep Crawl unavailable". Search results (Vane snippets) still shown normally.
- [ ] EC-3: Both services down → health dot red, search + crawl disabled. Agent chat (PROJ-18) still functional. User sees banner "Search services offline".
- [ ] EC-4: Vane returns 0 sources → show "No results found. Try different keywords or search mode." No error.
- [ ] EC-5: Crawl4ai fails on URL (403, anti-bot block) → `WebSearchResult.crawl_status=failed`, error message shown inline. User can retry.
- [ ] EC-6: Crawl4ai returns extremely large page (>50,000 tokens) → content truncated to 50,000 tokens with note. Chunking in PROJ-15 handles the rest.
- [ ] EC-7: User sends message while previous search still streaming → queue message, process sequentially. Show "Searching..." indicator.
- [ ] EC-8: User switches drawer panel while search is running → search continues in background. Switching back shows accumulated results.
- [ ] EC-9: Chat session with 100+ messages → paginate messages (load latest 50, "Load more" button). Older messages lazy-loaded.
- [ ] EC-10: Shared session viewed by teammate → read-only. Teammate cannot send messages or modify. Can "Deep Crawl" sources (creates their own WebSearchResult).
- [ ] EC-11: Niche context niche gets deleted → context chip removed, session continues without context.
- [ ] EC-12: Bottom chat-bar on mobile (<600px) → full-width bar, drawer opens as full-screen overlay instead of side panel.
- [ ] EC-13: Multiple browser tabs open → each tab has its own chat-bar state (localStorage sync not required for MVP).

## Environment Variables Required

```
# New:
VANE_API_URL=                          # Vane (Perplexica) API in localai-stack (e.g. http://vane:3000 — actual host:port depends on your setup)
CRAWL4AI_API_URL=                      # Crawl4ai API in localai-stack (e.g. http://crawl4ai:11235 — actual host:port depends on your setup)
VANE_DEFAULT_MODEL=gpt-4.1-mini        # Default chat LLM for Vane
VANE_EMBEDDING_MODEL=text-embedding-3-small  # Embedding model for Vane

# Existing (shared):
OPENROUTER_API_KEY=                    # Shared with PROJ-6, PROJ-9, PROJ-15
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Document in `django-app/env/.env.template`.

## Dependencies

- PROJ-4 (Workspace & Membership — workspace FK, member auth)
- PROJ-5 (Niche model — context awareness, save-to-niche)
- PROJ-10 (Niche Keyword Bank — save keywords from search results)
- PROJ-15 (Vector Database — embeddings for ChatMessage + WebSearchResult)
- PROJ-18 (Agent — shares the drawer Chat panel, Agent messages in same ChatSession)

## Infrastructure Requirements

Both Vane and Crawl4ai must be running in the localai-stack before PROJ-17 can function. Setup assistance needed for:
1. Vane Docker container + SearXNG configuration (JSON format + Wolfram Alpha engine enabled)
2. Crawl4ai Docker container
3. Network connectivity between Merch Miner stack and localai-stack

## Future Enhancements (not MVP)

- POD-specific search modes (Trend Search, Market Research, Keyword Research) as prompt presets on top of Vane
- Crawl4ai AdaptiveCrawler for auto-following links (deep site crawling)
- LightRAG for knowledge graph extraction from crawled content
- Real-time WebSocket for streaming instead of SSE polling
- Voice input for chat-bar

## Decisions Log

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Vane integration | External service in localai-stack | Consistent architecture, Merch Miner stays slim |
| 2 | Crawl4ai integration | External service in localai-stack | Same as Vane, REST API ready |
| 3 | Chat modes | Search + Agent + Context-Aware | Best UX, knows where user is |
| 4 | Results flow | Smart Suggest + auto Vector DB | Minimal friction, context-based suggestions |
| 5 | Chat history | Persistent private + explicit sharing | Privacy default, conscious sharing |
| 6 | Search types | Vane native modes for MVP | Simpler, POD-presets later |
| 7 | Crawl4ai usage | Manual + Top-3 auto for Market Research | Balance between coverage and cost |
| 8 | POD modes | Native Vane only for MVP | YAGNI, add presets when needed |
| 9 | UI layout | Bottom bar (input) + multi-purpose drawer (output), segmented button | Modern UX, reuses existing drawer |
| 10 | Context handling | Sticky niche context with visible chip + X | Zero friction, always visible |
| 11 | Vane embedding | text-embedding-3-small via OpenRouter | Same as PROJ-15, consistent |
| 12 | Vane chat LLM | Default gpt-4.1-mini, switchable | Fast + cheap default, flexibility |
| 13 | Rate limiting | Tracking only, no limits for MVP | Data first, limits with monetization |
| 14 | Error handling | Graceful degradation + health check indicator | Proactive UX, no surprises |
