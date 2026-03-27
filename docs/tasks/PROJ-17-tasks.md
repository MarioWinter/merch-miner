# PROJ-17: Deep Web Search (Vane + Crawl4ai) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `search_app` — chat sessions, messages, web search results, crawl jobs, usage tracking
- **Vane + Crawl4ai** as external services in localai-stack (REST APIs)
- **Floating chat-bar** as global component (available on every page)
- **Multi-purpose drawer** replaces standalone NicheDetailDrawer — shared shell with 3 panels (Niche/Chat/Search)
- **SSE streaming** for Vane responses (Django StreamingHttpResponse)
- **Crawl jobs** via django-rq (10-30s, don't block HTTP)
- **Auto Vector DB** storage via post_save signals (PROJ-15)
- **Health check polling** every 60s for service status

---

## Phase 1: Backend Foundation

- [ ] Create `search_app/` Django app, register in `INSTALLED_APPS`
- [ ] Create `search_app/api/` + `search_app/services/` subpackages
- [ ] Wire into `core/urls.py` under `/api/chat/` and `/api/search/`
- [ ] AC-1: `ChatSession` model: UUID pk, `workspace` FK, `created_by` FK, `title` CharField(200), `is_shared` BooleanField, `niche_context` FK (Niche, nullable), `tags` M2M (ChatTag), `created_at`, `updated_at`
- [ ] AC-1b: `ChatTag` model: UUID pk, `workspace` FK, `name` CharField(50), `color` CharField(7), `created_by` FK, `created_at`. unique_together (workspace, name). Default tags seeded per workspace
- [ ] AC-2: `ChatMessage` model: UUID pk, `session` FK, `role` choices (user/assistant/system), `content` TextField, `message_type` choices (search_query/search_result/crawl_request/crawl_result/agent_message), `sources` JSONField, `search_mode` CharField (nullable), `search_sources` JSONField (nullable), `model_used` CharField, `created_at`
- [ ] AC-3: `WebSearchResult` model: UUID pk, `workspace` FK, `chat_message` FK (nullable), `url` URLField, `title` CharField(500), `content` TextField, `content_type` choices (snippet/full_crawl), `crawl_status` choices (pending/running/completed/failed), `error_message` TextField, `metadata` JSONField, `created_at`
- [ ] AC-4: `SearchUsageLog` model: UUID pk, `workspace` FK, `user` FK, `action` choices (search/deep_crawl), `query` TextField, `url` URLField, `model_used` CharField, `tokens_used` IntegerField (nullable), `created_at`
- [ ] Indexes: `(workspace, created_at)` on ChatSession, `(session, created_at)` on ChatMessage, `(workspace, action)` on SearchUsageLog
- [ ] Initial migration
- [ ] Admin registration
- [ ] Env vars in `.env.template`: `VANE_API_URL`, `CRAWL4AI_API_URL`, `VANE_DEFAULT_MODEL`, `VANE_EMBEDDING_MODEL`

---

## Phase 2: Backend Services

- [ ] AC-5: `services/vane_service.py`: `SearchService.search(query, mode, sources, history, system_instructions)` — calls Vane `POST /api/search`. Returns synthesized answer + sources list
- [ ] AC-6: `SearchService.search_stream()` — SSE generator for streaming responses. Django StreamingHttpResponse
- [ ] AC-7: Default chat LLM: `gpt-4.1-mini` via OpenRouter. Configurable via env or in-chat model picker
- [ ] AC-8: Default embedding model: `text-embedding-3-small` (same as PROJ-15)
- [ ] AC-9: Conversation history passed to Vane on follow-up queries
- [ ] AC-10: `services/crawl_service.py`: `CrawlService.crawl_url(url)` — calls Crawl4ai REST API. Returns Markdown content + metadata
- [ ] AC-11: Crawl jobs as django-rq tasks. `WebSearchResult.crawl_status` tracks progress
- [ ] AC-12: Completed crawl → post_save signal → PROJ-15 Vector DB embedding (chunked at 1500 tokens, 5% overlap)
- [ ] AC-13: "Market Research" mode auto-triggers Crawl4ai on Top-3 source URLs. Other modes: manual "Deep Crawl" per source
- [ ] `services/context_builder.py`: builds `system_instructions` string from active niche context

---

## Phase 3: Chat API

- [ ] AC-14: `POST /api/chat/sessions/` — create session. Optional `niche_context` FK
- [ ] AC-15: `GET /api/chat/sessions/` — list user's sessions (paginated, ordered by updated_at). `?shared=true` for workspace-shared
- [ ] AC-16: `GET /api/chat/sessions/{id}/` — session detail with all messages
- [ ] AC-17: `POST /api/chat/sessions/{id}/messages/` — send message → triggers Vane search. Body: `{content, search_mode, search_sources, model}`. Supports `?stream=true` for SSE
- [ ] AC-18: `POST /api/chat/sessions/{id}/share/` — set `is_shared=True`
- [ ] AC-19: `POST /api/chat/sessions/{id}/unshare/` — set `is_shared=False`
- [ ] AC-39: Chat sessions persisted. "Recent Chats" = last 10 sessions for user
- [ ] AC-40: Shared sessions appear in teammates' lists with "Shared by" badge
- [ ] AC-41: Shared sessions read-only for non-owners

---

## Phase 4: Crawl + Save API

- [ ] AC-20: `POST /api/search/crawl/` — body: `{url, chat_message_id}`. Enqueues Crawl4ai job. Returns WebSearchResult (status=pending)
- [ ] AC-21: `GET /api/search/crawl/{id}/status/` — poll crawl status
- [ ] AC-22: `POST /api/search/results/{id}/save-to-niche/` — body: `{niche_id, save_as: "keywords"|"notes"}`. Saves to PROJ-10 Keyword Bank or Niche.notes

---

## Phase 5: Tags API

- [ ] AC-42: Auto-assign niche context at session creation (`niche_context` FK). No niche → "General"
- [ ] AC-44: `GET /api/chat/tags/` — list workspace tags
- [ ] AC-44: `POST /api/chat/tags/` — create custom tag (name + color)
- [ ] AC-44: `DELETE /api/chat/tags/{id}/` — delete custom tag (removes from sessions)
- [ ] AC-45: `PATCH /api/chat/sessions/{id}/` — update tags (`tag_ids`) and/or title
- [ ] AC-46: Session list filterable: `?niche_id=` + `?tag_id=` (combinable)
- [ ] AC-47: Default tags ("Research", "Keywords", "Competitors", "Ideas", "General") seeded on workspace creation. System tags not deletable

---

## Phase 6: Health Check + Usage

- [ ] AC-49: `GET /api/search/health/` — pings Vane + Crawl4ai. Returns `{vane: "online"|"offline", crawl4ai: "online"|"offline"}`
- [ ] AC-52: Every search and crawl → `SearchUsageLog` entry
- [ ] AC-53: Usage data available for PROJ-12 Analytics

---

## Phase 7: Serializers

- [ ] `ChatSessionSerializer` — all fields, nested `tags` (id + name + color), `niche_context` (id + name), `message_count`, `shared_by` (username if shared)
- [ ] `ChatMessageSerializer` — all fields, `sources` nested
- [ ] `WebSearchResultSerializer` — all fields, `crawl_status`, content preview (truncated)
- [ ] `ChatTagSerializer` — id, name, color, is_system flag
- [ ] `SearchHealthSerializer` — vane status, crawl4ai status

---

## Phase 8: Frontend — State & Services

- [ ] RTK Query `searchApi` slice (`store/searchSlice.ts`): createSession, listSessions, getSession, sendMessage, shareSession, unshareSession, triggerCrawl, pollCrawlStatus, saveToNiche, listTags, createTag, deleteTag, updateSession, healthCheck
- [ ] `store/chatBarSlice.ts`: UI state — bar expanded/hidden, active session ID, pending message
- [ ] Cache tags: `ChatSessions`, `ChatMessages`, `CrawlJobs`, `ChatTags`, `SearchHealth`
- [ ] Register slices in `store/index.ts`
- [ ] TypeScript types: ChatSession, ChatMessage, WebSearchResult, ChatTag, SearchHealth, SearchMode, MessageType

---

## Phase 9: Frontend — Floating Chat Bar

- [ ] AC-23: `components/FloatingChatBar/index.tsx`: `position: fixed` bottom center. Slim, transparent design
- [ ] AC-24: Click → expands upward (CSS transition) into input area with TextField + send button
- [ ] AC-25: Dismiss: click outside or close button → animates downward, disappears
- [ ] AC-26: Hidden state: hover near bottom edge → arrow indicator. Click → bar reappears
- [ ] AC-27: Submit message → opens Right Drawer with Chat panel active
- [ ] AC-12 (mobile): `<600px` → full-width bar, drawer as full-screen overlay

---

## Phase 10: Frontend — Multi-Purpose Drawer

- [ ] AC-28: `components/MultiPurposeDrawer/index.tsx`: 480px right drawer. Header: `ToggleButtonGroup exclusive` — Niche Detail | Chat | Search
- [ ] AC-29: Segment icons + labels: `InfoOutlined` (Niche) | `ChatOutlined` (Chat) | `SearchOutlined` (Search)
- [ ] AC-30: Switching segments swaps content. Drawer stays open. Each panel maintains scroll position
- [ ] Wrap existing `NicheDetailDrawer` content as `NicheDetailPanel` inside MultiPurposeDrawer
- [ ] Migrate all drawer open/close logic to use MultiPurposeDrawer instead of standalone NicheDetailDrawer

---

## Phase 11: Frontend — Chat Panel

- [ ] AC-31: `ChatPanel.tsx`: active session messages (scrollable), model picker, search mode toggle (Speed/Balanced/Quality), source toggles (web/academic/discussions)
- [ ] AC-33: `ContextChip.tsx`: sticky niche context chip with X to remove. Persists across messages
- [ ] AC-34: Context passed as `system_instructions` to Vane
- [ ] AC-35: Removing context (X click) clears for subsequent messages
- [ ] AC-43: Tag chips on session. Add/remove tags via `SessionTagManager.tsx`
- [ ] AC-48: "Recent Chats" list: title, niche chip, tag chips, timestamp, shared badge
- [ ] `ChatMessageList.tsx`: scrollable, Markdown rendering (`react-markdown`). Agent messages styled differently
- [ ] `ChatControls.tsx`: model picker dropdown, search mode ToggleButtonGroup, source toggle chips
- [ ] EC-9: 100+ messages → paginate (latest 50, "Load more")

---

## Phase 12: Frontend — Search Results Panel

- [ ] AC-32: `SearchResultsPanel.tsx`: Vane answer (Markdown) + source cards
- [ ] `VaneAnswer.tsx`: react-markdown rendered AI answer with citation links
- [ ] `SourceCard.tsx`: title + URL + snippet + "Deep Crawl" button + crawl status badge
- [ ] `CrawlStatusBadge.tsx`: pending/running/completed/failed chips
- [ ] AC-36: Quick-action buttons: "Save to {niche}", "Save Keywords", "Save to Vector DB" (always-saved indicator)
- [ ] AC-37: "Save to {niche}" calls save-to-niche API. Notistack confirmation
- [ ] AC-38: All results auto-stored in Vector DB. Checkmark indicator

---

## Phase 13: Frontend — Health Status

- [ ] AC-50: Poll health endpoint every 60s. Status dot in chat-bar + drawer header
- [ ] AC-51: Offline services → related actions disabled with tooltip. "Deep Crawl" disabled when Crawl4ai offline. Search disabled when Vane offline

---

## Phase 14: i18n

- [ ] `search.chatBar.*` — placeholder, send button, dismiss hint
- [ ] `search.drawer.*` — segment labels (Niche Detail, Chat, Search)
- [ ] `search.chat.*` — session title, model picker, mode labels (Speed/Balanced/Quality), source labels
- [ ] `search.context.*` — context chip label, remove tooltip
- [ ] `search.results.*` — answer title, source card labels, deep crawl button, save buttons
- [ ] `search.crawl.*` — status labels (pending/running/completed/failed), retry button
- [ ] `search.sessions.*` — recent chats title, share/unshare, shared badge
- [ ] `search.tags.*` — tag labels, create tag, delete tag, default tag names
- [ ] `search.health.*` — online/offline labels, service names, banner text
- [ ] `search.save.*` — save to niche, save keywords, already saved
- [ ] `search.empty.*` — no sessions, no results, first search hint
- [ ] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 15: Tests

### Backend

- [ ] ChatSession CRUD: create, list (own + shared), detail with messages, share/unshare
- [ ] ChatMessage: send triggers Vane call, sources stored, conversation history passed
- [ ] Vane service: returns answer + sources, streaming mode, error handling
- [ ] Crawl service: enqueues job, status transitions, content stored as Markdown
- [ ] Save-to-niche: keywords saved (source=web_search), notes appended
- [ ] Tags CRUD: create, delete (removes from sessions), default tags seeded, system tags not deletable
- [ ] Session filtering: by niche_id, by tag_id, combinable
- [ ] Health check: returns correct status per service
- [ ] Usage logging: every search + crawl creates SearchUsageLog entry
- [ ] Vector DB integration: post_save on WebSearchResult triggers embedding
- [ ] Workspace isolation on all endpoints

### Frontend

- [ ] FloatingChatBar: expand/collapse animation, submit opens drawer
- [ ] MultiPurposeDrawer: segment switching, panel content swaps, scroll preserved
- [ ] ChatPanel: messages render, Markdown formatting, model picker, mode toggle
- [ ] ContextChip: shows niche name, X removes, persists across messages
- [ ] SearchResultsPanel: Vane answer rendered, source cards with Deep Crawl
- [ ] RecentChats: list renders, click resumes session
- [ ] Health status: polls, dot colors correct, disabled actions on offline
- [ ] TypeScript + ESLint + Ruff: 0 errors

---

## Verification Checklist

- [ ] `search_app` registered, migrations applied
- [ ] Vane integration: search returns answer + sources, streaming works
- [ ] Crawl4ai integration: URL crawled, Markdown stored, Vector DB embedding created
- [ ] Floating chat-bar: visible on all pages, expand/collapse/dismiss
- [ ] Multi-purpose drawer: 3 panels (Niche/Chat/Search), segment switching
- [ ] Niche context: sticky chip, passed to Vane as system_instructions
- [ ] Chat sessions: persistent, shareable, taggable, filterable
- [ ] Save-to-niche: keywords to PROJ-10, notes to Niche
- [ ] Health check: 60s polling, status dots, disabled actions on offline
- [ ] Usage tracking: every action logged in SearchUsageLog
- [ ] Workspace isolation on all endpoints
- [ ] All tests pass, lint clean
