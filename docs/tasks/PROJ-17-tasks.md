# PROJ-17: Deep Web Search — Implementation Tasks (Audit-First)

> **Stand 2026-04-25:** Code zu ~95% bereits implementiert (April 2026). Diese Tasks-Datei ist **Audit-First** — wir prüfen den Bestand, entfernen was nicht mehr passt (Tags, SearchResultsPanel), passen an was geändert wurde (FloatingChatBar Style, Pattern B Hybrid), und bauen nur was wirklich fehlt (WorkflowCard, ModeDropdown, SSE-Stream-Endpoint, worker-search, Auto-Scroll-Disengage, Vector DB Stub, etc.).

## Bekannte Code-Inventur (Stand Audit)

**Backend (`search_app/`):**
- ✅ Models: `ChatTag`, `ChatSession`, `ChatMessage`, `WebSearchResult`, `SearchUsageLog` + Migration `0001_initial`
- ✅ Services: `vane_service.py`, `crawl_service.py`, `context_builder.py`
- ✅ API Views: 13 Endpoints inkl. Tags-CRUD
- ✅ URLs in `core/urls.py` registriert
- ✅ `INSTALLED_APPS` aktiv
- ✅ Tests vorhanden (test_models, test_services, test_tasks, test_views)
- ✅ `signals.py` + `tasks.py` vorhanden
- ⚠️ Env-Vars in settings.py vorhanden, in `.env.dev.template` definiert, lokal jetzt gesetzt

**Frontend:**
- ✅ `FloatingChatBar/` (index + ChatBarInput)
- ✅ `MultiPurposeDrawer/` mit DrawerSegments + HealthStatusDot + useSearchHealth
- ✅ Panels: Chat, ChatControls, ChatMessageList, RecentChats, SearchResultsPanel, SourceCard, VaneAnswer, ContextChip, CrawlStatusBadge, NicheDetailPanel, **SessionTagManager**
- ✅ AgentPanel (PROJ-18 Vorgriff)
- ✅ Store: `searchSlice.ts` (RTK Query) + `chatBarSlice.ts` + `agentSlice.ts`
- ✅ In `AppLayout.tsx` eingebunden

**Infrastruktur:**
- ✅ SSH-Tunnel zu Server-localai-stack funktioniert
- ✅ Vane + Crawl4ai im merch_net Network erreichbar
- ❌ `worker-search` Container existiert noch nicht
- ❌ `VECTOR_DB_ENABLED` Flag noch nicht implementiert

---

## Phase 1: Bestands-Audit (kein Code, nur Listing)

- [x] Audit Models: `search_app/models.py` — alle Felder pro Modell mit aktueller Spec abgleichen
- [x] Audit API: `search_app/api/views.py` + `urls.py` — welche Endpoints da, welche fehlen
- [x] Audit Services: `vane_service.py`, `crawl_service.py`, `context_builder.py` — Methoden + Coverage
- [x] Audit Frontend Komponenten: alle Files in `FloatingChatBar/` + `MultiPurposeDrawer/` durchgehen
- [x] Audit Store: `searchSlice.ts` + `chatBarSlice.ts` — alle endpoints + state slices
- [x] Audit Tests: backend + frontend — was getestet, was nicht
- [x] Audit Docker: `docker-compose.yml` — workers übersicht
- [x] Audit i18n: `locales/{en,de,fr,es,it}/translation.json` — `search.*` keys vorhanden?
- [x] Audit-Bericht: 1-Pager mit "passt / weg / anpassen / neu" pro Component

---

## Phase 2: Cleanup (entfernen was raus muss)

### Backend

- [x] **Models:** `ChatTag` Modell entfernen (komplette Klasse + Imports)
- [x] **Models:** `ChatSession.tags` M2M Field entfernen
- [x] **Models:** Default-Tag-Seeding-Logik entfernen (`management/commands/seed_chat_tags.py` gelöscht)
- [x] **Models:** `ChatMessage.message_type` choices: `agent_message` raus
- [x] **Migration:** Auto-Migration generieren (drop ChatTag table + tags M2M + agent_message choice) — `0002_remove_chatsession_tags_and_more.py` generiert + applied
- [x] **API:** Endpoints raus: `GET/POST /api/chat/tags/`, `DELETE /api/chat/tags/{id}/`
- [x] **API:** `ChatSession PATCH` — `tag_ids` aus Serializer raus
- [x] **API:** Filter `?tag_id=` aus `GET /api/chat/sessions/` raus
- [x] **Serializers:** `ChatTagSerializer` entfernen, `ChatSessionSerializer.tags` Feld raus
- [x] **Admin:** `ChatTag` admin registration entfernen
- [x] **Tests:** Tag-bezogene Tests entfernen (test_models / test_views)

### Frontend

- [x] **Komponenten:** `MultiPurposeDrawer/panels/SearchResultsPanel.tsx` entfernen
- [x] **Komponenten:** `MultiPurposeDrawer/panels/SessionTagManager.tsx` entfernen
- [x] **DrawerSegments:** Search-Segment raus (nur noch Niche / Chat / Agent) + `showNiche` Conditional raus
- [x] **ChatPanel:** SessionTagManager Import + Render entfernen
- [x] **Store:** `searchApi` — `listTags`, `createTag`, `deleteTag`, `tag_ids` aus updateSession raus
- [x] **Store:** Cache-Tag `ChatTags` entfernen
- [x] **Types:** `ChatTag` Type entfernen, `ChatSession.tags` Feld raus aus type. Plus: `DrawerPanel` ohne 'search', `MessageType` ohne 'agent_message', `CreateTagBody` raus, `tag_id` aus `SessionListParams` raus
- [x] **i18n:** `search.tags.*` keys aus allen 5 Locales raus (en/de/fr hatten subtree, es/it leer)
- [x] **Tests:** Tag-bezogene Frontend-Tests entfernen (keine vorhanden — nichts zu tun)
- [x] **Bonus:** `chatBarSlice.activePanel` initial von 'niche' → 'chat' (Pattern B, Floating-Bar-Submit landet im Chat-Tab)

---

## Phase 3: Adjustments (anpassen was bleibt)

### Backend

- [x] **Models:** `ChatMessage.message_type` choices erweitern: `workflow_trigger`, `workflow_card`
- [x] **Models:** `ChatMessage.agent_session` FK hinzufügen (nullable, on_delete=SET_NULL → `agent_app.AgentSession`)
- [x] **Migration:** Neue Felder migrieren (`0003_chatmessage_agent_session_and_more`)
- [x] **Serializers:** `ChatMessageSerializer` — `agent_session` als nested (id + status + current_step + completed_steps + total_steps) ausgeben
- [x] **API `POST /api/search/results/{id}/save-to-niche/`:** Body um `selected_text` Feld erweitern, Logik für Snippet-basierte Keyword-Extraktion (split by `\n` und `,`, jeder Token → `NicheKeyword(source='web_search')`, mit Duplicate-Check via iexact + created/skipped Counter Response)
- [x] **Health-Endpoint:** Cache-Header (Cache-Control private max-age=300) für Polling-Effizienz
- [x] **VANE/CRAWL4AI ENV:** Final-Check ob Settings.py defaults sinnvoll sind (vane_service nutzt `getattr(settings, 'VANE_API_URL', '')` — defensive)
- [x] **Bonus:** `SendMessageSerializer.mode_override` Feld (auto/web_search/agent) für Pattern B Mode-Dropdown

### Frontend

- [x] **FloatingChatBar:** Re-Style auf bottom-CENTER (`left: 50%, transform: translateX(-50%)`)
- [x] **FloatingChatBar:** Default-State = collapsed (nur Chevron-Up Icon ~32×24px sichtbar)
- [x] **FloatingChatBar:** Glasmorphism — `backgroundColor: alpha(white, 0.85) / alpha(inkPaper, 0.75)`, `backdropFilter: blur(16px)` (Topbar-Style)
- [x] **FloatingChatBar:** ChevronIndicator-Komponente extrahieren
- [x] **FloatingChatBar:** Expanded-State Schließen-Chevron mittig oben
- [x] **FloatingChatBar:** localStorage persist für expand/collapse state (Key: `chatBar.expanded`)
- [x] **FloatingChatBar Cleanup:** `barHidden`/`hideBar`/`showBar` aus chatBarSlice entfernt — Chevron ist permanent sichtbar
- [x] **MultiPurposeDrawer:** Resize-Logik einbauen (Drag-Handle links + Steps 480/768/1200)
- [x] **MultiPurposeDrawer:** `useDrawerResize` Hook + localStorage persist (Key: `chatBar.drawerWidth`)
- [x] **MultiPurposeDrawer:** 1200px Full-Mode Layout (3-Column NotebookLM via CSS-Grid auf `[data-mpd-layout="full"]`)
- [x] **DrawerSegments:** Niche / Chat / Agent (3 statt vorher 4)
- [x] **ChatPanel:** Inline Sources unter jeder AI-Bubble (statt SearchResultsPanel) — als Perplexity-Style SourceCards
- [x] **SourceCard:** Re-Design mit Favicon (32×32 via google s2 favicons) + Domain (JetBrains Mono) + Title + 1-Zeile Snippet (line-clamp) + Action-IconButtons (Deep Crawl, Save Keywords, Save Notes)
- [x] **ChatMessageList:** Auto-Scroll-Disengage on user-scroll-up implementieren (50px Threshold)
- [x] **JumpToLatestButton:** Neue Komponente, floating bottom-right, erscheint bei disengaged scroll
- [x] **ChatMessageList:** Auto-Scroll re-engage wenn User innerhalb ~50px vom Bottom
- [x] **ContextChip:** Default OFF, neuer ContextToggle als Switch in Chat-Header ("Use current Niche as context") — neue Komponente `ContextToggle.tsx` (alt `ContextChip` bleibt für Nutzung wenn Context aktiv ist)
- [x] **Health-Polling:** Intervall von 60s auf 5min (300_000ms) ändern (`useSearchHealth.ts`)
- [x] **VaneAnswer:** `rehype-sanitize` Plugin hinzufügen (auch in `ChatMessageList` markdown rendering)
- [x] **i18n:** Neue Keys für Pattern B (`search.mode.*`, `search.workflow.*`, `search.scroll.*`, `search.context.useAsContext`, `search.context.toggleLabel`, `search.chatBar.collapse`) in allen 5 Locales — ES + IT EN-baseline für Übersetzung später

---

## Phase 4: New Build (was wirklich fehlt)

### Backend

- [x] **Service `search_app/services/mode_classifier.py`:** LLM-Classifier (gpt-4.1-mini) — Input: User-Message + Context. Output: `web_search` | `agent`. Prompt ~50 Tokens. Returnt JSON `{mode: "web_search"|"agent", confidence: 0..1, reason: "..."}`
- [x] **API:** Neuer SSE-Endpoint `GET /api/chat/sessions/{id}/messages/stream/?content=...&search_mode=...` — Django StreamingHttpResponse, yields `text/event-stream` events: `init`, `sources`, `chunk`, `done`
- [x] **VaneService:** `search_stream()` Generator-Methode (parses Vane SSE, re-yields) — bereits in Phase 1/2 vorhanden
- [x] **VaneService:** Token-Counter für `tokens_used` (vergleichsweise grob — `len(text)//4` Heuristik, kein tiktoken)
- [x] **post_save Signal:** `WebSearchResult.crawl_status==completed` → enqueue Embedding-Job. Gated by `settings.VECTOR_DB_ENABLED`
- [x] **Tasks:** Embedding-Task delegiert an `vector_app.tasks.create_or_update_embedding` (Chunking + Retry bereits in PROJ-15 implementiert)
- [x] **Settings:** `VECTOR_DB_ENABLED = bool(env('VECTOR_DB_ENABLED', 'true'))`
- [x] **Settings:** `RQ_QUEUES['search'] = {URL: REDIS_URL, DEFAULT_TIMEOUT: 300}`
- [x] **Mode-classifier in messages-View:** wenn Body `mode_override == 'auto'` → klassifizieren → wenn `agent` → AgentSession anlegen + ChatMessage(message_type='workflow_card', agent_session=...). EC-17 fallback (agent_app missing) auf web_search. Crawl-Jobs → `search` Queue.
- [x] **Management Command:** `manage.py backfill_vector_db` — iteriert über alle WebSearchResult mit content_type='full_crawl' (oder `--include-snippets`) und ohne Embedding

### Frontend

- [x] **WorkflowCard.tsx:** Inline-Komponente. Render wenn `message_type === 'workflow_card'`. Mini-Stepper (steps mit checkmarks/spinner/dots), live-update via PROJ-18 polling (Q3=C: 3s nur bei `running/idle/paused`, stop bei terminal), "→ Open Command Center" Link (Step 1)
- [x] **ApprovalCard.tsx:** Inline-Approval-Card. Cost + Action + Approve/Reject Buttons. Calls PROJ-18 approval endpoint direkt — promoted aus AgentPanel/partials/ → panels/ (Step 2)
- [x] **ModeDropdown.tsx:** Auto / Web-Search / Agent — MUI Select im Chat-Input (FloatingChatBar + ChatPanel, Q5=C). Setzt `mode_override` Feld in sendMessage Body. State: `chatBarSlice.modeOverride` (Step 3)
- [x] **SaveSnippetToolbar:** Mouseup-Listener auf ChatMessageList Container (Q4=B local). `window.getSelection()` → Toolbar bei Selection-Coords (Range.getBoundingClientRect, auto-flip, viewport-clamp) mit "Save as Keywords" / "Save as Notes" Buttons (Step 4)
- [x] **SaveToNicheModal:** MUI Dialog mit Niche Autocomplete + Preview. Wenn kein niche_context aktiv → Modal öffnen. saveSnippetToNiche RTK Mutation (Step 5b). Backend-Patch B2+N1 (Step 5a)
- [x] **EventSource SSE Client:** `useSendMessageStream` Hook (vanilla EventSource). Yields init/sources/chunk/done/error → Redux dispatch in `chatBarSlice.streamingAssistantMessage` (Q2=B). Q1=A: SSE in FloatingChatBar + ChatPanel (Step 6)
- [x] **EventSource Cancel:** Wenn neue Message gesendet → vorhandene EventSource closed (EC-7) — implementiert in useSendMessageStream.start (Step 6)
- [x] **DrawerResizeHandle:** Drag-handle Komponente (mouse + touch), updates Redux drawerWidth (klemmt auf 480/768/1200 mit Snapping) — bereits in Phase 3
- [x] **NotebookLM Full-Mode (1200px) Layout:** 3-Column CSS-Grid auf `[data-mpd-layout="full"]` — bereits in Phase 3
- [x] **Frontend Pakete:** `rehype-sanitize` installiert in Phase 3

### Infrastructure

- [x] **docker-compose.yml:** Neuer Service `worker-search` mit Command `python manage.py rqworker search`, gleiche Volumes/Env wie andere Worker (Z. 106-119)
- [x] **docker-compose.override.yml:** Bind-Mount für `worker-search` — `./django-app:/app` (Z. 63-65)
- [x] **scripts/dev-tunnel.sh:** SSH-Tunnel-Helper executable. IP-Resolution via `docker inspect`, foreground/detached/stop Modes, Auto-Reconnect bei IP-Change. Env-Overrides: SERVER_USER, SERVER_HOST, VANE_CONTAINER, CRAWL4AI_CONTAINER, Ports
- [x] **.env.dev.template:** `VECTOR_DB_ENABLED=true` ergänzt + alle PROJ-17 Vars (Z. 99-105)
- [x] **.env.prod.template:** `VANE_API_URL=http://vane:3000`, `CRAWL4AI_API_URL=http://crawl4ai:11235`, `VANE_DEFAULT_MODEL`, `VANE_EMBEDDING_MODEL`, `VECTOR_DB_ENABLED=false` (Z. 84-91)

---

## Phase 5: Wire-Up (Integrationen verbinden)

### PROJ-15 Vector DB Hook

- [x] **post_save Signal:** WebSearchResult → embedding task wenn `VECTOR_DB_ENABLED=true` — `search_app/signals.py:enqueue_embedding_on_crawl_complete`
- [x] **Embedding Task:** Delegiert an `vector_app.tasks.create_or_update_embedding` (Chunking + Retry in PROJ-15)
- [ ] **Test:** Lokal mit `VECTOR_DB_ENABLED=true` — Crawl ausführen → Vector DB hat Eintrag (manueller Smoke-Test, ausstehend)

### PROJ-18 Agent Hook

- [x] **API-Call:** From Mode-Classifier `agent` route → AgentSession via `agent_app.models.AgentSession.objects.create(...)` + workflow_card ChatMessage. `views.py:_handle_agent_route` (Z. 502+). EC-17 fallback bei agent_app missing → web_search
- [x] **Response-Handling:** AgentSession ID → `ChatMessage(message_type='workflow_card', agent_session=<id>)` `views.py:543-552`
- [x] **Live-Update:** WorkflowCard pollt `useGetSessionQuery({pollingInterval: 3000})` (Q3=C: nur bei `running/idle/paused`, stop bei terminal — Phase 4 Step 1)
- [x] **Approval-Wire:** ApprovalCard inline in WorkflowCard via `useApproveActionMutation`/`useRejectActionMutation` direkt an PROJ-18 endpoint (Phase 4 Step 2)
- [x] **"Open Command Center" Link:** dispatch `setActiveAgentSessionId(<id>)` + Drawer-Tab auf 'agent' (Phase 4 Step 1)

### PROJ-10 NicheKeyword Hook

- [x] **save-to-niche endpoint:** Bei `save_as=keywords` → split selected_text → NicheKeyword(niche=, keyword=, source='web_search'/'manual_snippet', created_by=) — `views.py:922-993` + neuer `niche_app:save-snippet` Endpoint (Step 5a B2+N1)
- [x] **Duplicate-Handling:** iexact case-insensitive check, skipped counter zurückgegeben
- [x] **Response:** `{created: 5, skipped: 2}` 201/200 statuscode-differenziert

### Topbar Integration

- [x] **HealthStatusDot:** in Topbar (`Topbar.tsx`) eingebaut neben LanguageMenu, mit `px:1` Padding-Wrapper. Test-Mock für searchApi RTK Query. Zusätzlich zu Drawer-Header + FloatingChatBar = globale Sichtbarkeit

---

## Phase 6: QA + Tests

### Backend Tests

- [ ] ChatSession CRUD Tests (ohne Tags, mit niche_context Filter)
- [ ] ChatMessage Tests inkl. neuer Types (`workflow_trigger`, `workflow_card`) + agent_session FK
- [ ] SSE-Stream-Endpoint Test (mit StreamingHttpResponse + Mock-Vane-Stream)
- [ ] mode_classifier Service Test (Mock-LLM-Response, Routing-Logik)
- [ ] Save-to-Niche Test mit selected_text → multi-keyword extraction + duplicate handling
- [ ] Vector DB Embedding Test (Flag on/off, post_save Signal, Task enqueue)
- [ ] worker-search Queue Test — Crawl4ai Mock + assert Job auf richtiger Queue
- [ ] SearchUsageLog Test (per Search + per Crawl)
- [ ] Health-Endpoint Test (online/offline kombinationen, Caching-Header)
- [ ] Workspace-Isolation Tests auf allen Endpoints
- [ ] Edge-Cases: Vane down, Crawl4ai down, Vector DB Flag off, große Crawl-Pages

### Frontend Tests

- [ ] FloatingChatBar Tests: collapsed/expanded states, glasmorphism style applied, localStorage persist
- [ ] MultiPurposeDrawer Tests: 3 Tabs, resize 480/768/1200, layout switches
- [ ] ChatPanel Tests: messages render, Markdown rendering, ContextToggle, Mode-Dropdown
- [ ] WorkflowCard Tests: Mini-Stepper, ApprovalCard, "Open Command Center" navigation
- [ ] ChatMessageList Tests: Auto-scroll behavior, JumpToLatest button visibility, scroll re-engage logic
- [ ] SourceCard Tests: Favicon, Deep Crawl button, Save buttons, status badge
- [ ] SaveSnippetToolbar Tests: text-selection trigger, save with niche context, save without niche context (modal)
- [ ] SSE-Hook Tests: receive chunks, cancel on new message, error handling
- [ ] Health-Status Tests: 5min poll, dot color, disabled actions on offline
- [ ] TypeScript + ESLint + Ruff: 0 errors

### Manual QA (E2E)

- [ ] Floating bar bottom-center sichtbar, glasmorphism (vergleichen mit Topbar visuell)
- [ ] Klick auf Chevron → bar expandiert smooth animation
- [ ] Type & submit → Drawer öffnet, Chat-Tab aktiv, message gestreamt
- [ ] Während Stream: scroll up → "Jump to latest" Button erscheint, stream läuft weiter
- [ ] Klick "Jump to latest" → smooth scroll, button weg
- [ ] Source-Card → "Deep Crawl" → Status pending → completed → markdown sichtbar
- [ ] Markiere Text in Crawl → Toolbar appears → Save as Keywords → Niche aktualisiert
- [ ] Mode-Dropdown auf "Agent" → Command "Recherchiere X" → WorkflowCard inline
- [ ] WorkflowCard "→ Open Command Center" → springt in Agent-Tab + scroll zur Session
- [ ] Approve Approval-Card direkt im Chat → Workflow läuft weiter
- [ ] Drawer drag → 480 → 768 → 1200, NotebookLM Layout im Full-Mode
- [ ] Health-Service down → entsprechende Buttons disabled, Tooltip
- [ ] Share Session → Teammate sieht read-only mit Badge
- [ ] Drawer-Width persist nach Reload
- [ ] Floating-Bar-State persist nach Reload
- [ ] All 5 i18n locales: switch + check key coverage

---

## Phase 7: Deploy

- [ ] Vane + Crawl4ai im Server-Stack laufen (Verify mit `docker ps` auf 212.132.102.96)
- [ ] Server `.env`: `VANE_API_URL=http://vane:3000`, `CRAWL4AI_API_URL=http://crawl4ai:11235`
- [ ] Server `.env`: `VECTOR_DB_ENABLED=false` (bis PROJ-15 backfill durch)
- [ ] CI passes (Tests + Lint)
- [ ] Deploy via GitHub Actions
- [ ] Smoke-Test in Prod: Search + Crawl + Mode-Dropdown
- [ ] INDEX.md + PRD.md Status auf "In Review" updaten

---

## Verification Checklist (gegen Spec)

- [ ] Alle 60 ACs aus Spec abgedeckt (oder bewusst dekoriert)
- [ ] Alle 18 Edge Cases behandelt
- [ ] Alle 12 User Stories durchspielbar
- [ ] Workspace-Isolation auf allen Endpoints
- [ ] Lint clean (ruff + eslint)
- [ ] Tests passen (backend + frontend)
- [ ] PROJ-15 + PROJ-18 Hooks funktionieren oder sauber stub-bar
- [ ] No hardcoded colors (alle via theme tokens)
- [ ] No deprecated MUI v6 patterns

---

## Open Questions / Risks

- **Vector DB Backfill:** Wann läuft PROJ-15 Backfill in Prod durch? PROJ-17 kann mit `VECTOR_DB_ENABLED=false` deployt werden, aber Suche-im-Workspace-Memory fehlt bis dahin
- **Mode-Classifier Genauigkeit:** gpt-4.1-mini Klassifier muss präzise sein (false positives = User-Frust). Eval-Set vorbereiten
- **SSE über Caddy:** Caddy proxy-config muss SSE-friendly sein (no buffering). Verify in Prod
- **PROJ-18 Status:** Wie weit ist PROJ-18? WorkflowCard braucht funktionierende AgentSession-Endpoints
- **Container-IP Stability:** SSH-Tunnel nutzt Container-IPs — bei Server-Restart kaputt. dev-tunnel.sh muss IPs dynamisch holen
