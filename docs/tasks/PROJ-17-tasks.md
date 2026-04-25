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

- [ ] Audit Models: `search_app/models.py` — alle Felder pro Modell mit aktueller Spec abgleichen
- [ ] Audit API: `search_app/api/views.py` + `urls.py` — welche Endpoints da, welche fehlen
- [ ] Audit Services: `vane_service.py`, `crawl_service.py`, `context_builder.py` — Methoden + Coverage
- [ ] Audit Frontend Komponenten: alle Files in `FloatingChatBar/` + `MultiPurposeDrawer/` durchgehen
- [ ] Audit Store: `searchSlice.ts` + `chatBarSlice.ts` — alle endpoints + state slices
- [ ] Audit Tests: backend + frontend — was getestet, was nicht
- [ ] Audit Docker: `docker-compose.yml` — workers übersicht
- [ ] Audit i18n: `locales/{en,de,fr,es,it}/translation.json` — `search.*` keys vorhanden?
- [ ] Audit-Bericht: 1-Pager mit "passt / weg / anpassen / neu" pro Component

---

## Phase 2: Cleanup (entfernen was raus muss)

### Backend

- [ ] **Models:** `ChatTag` Modell entfernen (komplette Klasse + Imports)
- [ ] **Models:** `ChatSession.tags` M2M Field entfernen
- [ ] **Models:** Default-Tag-Seeding-Logik entfernen (wenn als Workspace-Signal/Migration vorhanden)
- [ ] **Models:** `ChatMessage.message_type` choices: `agent_message` raus
- [ ] **Migration:** Auto-Migration generieren (drop ChatTag table + tags M2M + agent_message choice)
- [ ] **API:** Endpoints raus: `GET/POST /api/chat/tags/`, `DELETE /api/chat/tags/{id}/`
- [ ] **API:** `ChatSession PATCH` — `tag_ids` aus Serializer raus
- [ ] **API:** Filter `?tag_id=` aus `GET /api/chat/sessions/` raus
- [ ] **Serializers:** `ChatTagSerializer` entfernen, `ChatSessionSerializer.tags` Feld raus
- [ ] **Admin:** `ChatTag` admin registration entfernen
- [ ] **Tests:** Tag-bezogene Tests entfernen (test_models / test_views)

### Frontend

- [ ] **Komponenten:** `MultiPurposeDrawer/panels/SearchResultsPanel.tsx` entfernen
- [ ] **Komponenten:** `MultiPurposeDrawer/panels/SessionTagManager.tsx` entfernen
- [ ] **DrawerSegments:** Search-Segment raus (nur noch Niche / Chat / Agent)
- [ ] **ChatPanel:** SessionTagManager Import + Render entfernen
- [ ] **Store:** `searchApi` — `listTags`, `createTag`, `deleteTag`, `tag_ids` aus updateSession raus
- [ ] **Store:** Cache-Tag `ChatTags` entfernen
- [ ] **Types:** `ChatTag` Type entfernen, `ChatSession.tags` Feld raus aus type
- [ ] **i18n:** `search.tags.*` keys aus allen 5 Locales raus
- [ ] **Tests:** Tag-bezogene Frontend-Tests entfernen

---

## Phase 3: Adjustments (anpassen was bleibt)

### Backend

- [ ] **Models:** `ChatMessage.message_type` choices erweitern: `workflow_trigger`, `workflow_card`
- [ ] **Models:** `ChatMessage.agent_session` FK hinzufügen (nullable, on_delete=SET_NULL → `agent_app.AgentSession`)
- [ ] **Migration:** Neue Felder migrieren
- [ ] **Serializers:** `ChatMessageSerializer` — `agent_session` als nested (id + status + current_step) ausgeben
- [ ] **API `POST /api/search/results/{id}/save-to-niche/`:** Body um `selected_text` Feld erweitern, Logik für Snippet-basierte Keyword-Extraktion (split by `\n` und `,`, jeder Token → `NicheKeyword(source='web_search')`)
- [ ] **Health-Endpoint:** Cache-Header (Cache-Control max-age=300) für Polling-Effizienz
- [ ] **VANE/CRAWL4AI ENV:** Final-Check ob Settings.py defaults sinnvoll sind

### Frontend

- [ ] **FloatingChatBar:** Re-Style auf bottom-CENTER (`left: 50%, transform: translateX(-50%)`)
- [ ] **FloatingChatBar:** Default-State = collapsed (nur Chevron-Up Icon ~32×24px sichtbar)
- [ ] **FloatingChatBar:** Glasmorphism — `backgroundColor: alpha(white, 0.85) / alpha(inkPaper, 0.75)`, `backdropFilter: blur(16px)` (Topbar-Style)
- [ ] **FloatingChatBar:** ChevronIndicator-Komponente extrahieren
- [ ] **FloatingChatBar:** Expanded-State Schließen-Chevron mittig oben
- [ ] **FloatingChatBar:** localStorage persist für expand/collapse state
- [ ] **MultiPurposeDrawer:** Resize-Logik einbauen (Drag-Handle links + Steps 480/768/1200)
- [ ] **MultiPurposeDrawer:** `useDrawerResize` Hook + localStorage persist
- [ ] **MultiPurposeDrawer:** 1200px Full-Mode Layout (3-Column NotebookLM)
- [ ] **DrawerSegments:** Niche / Chat / Agent (3 statt vorher 4)
- [ ] **ChatPanel:** Inline Sources unter jeder AI-Bubble (statt SearchResultsPanel) — als Perplexity-Style SourceCards
- [ ] **SourceCard:** Re-Design mit Favicon (32×32) + Domain + Title + 1-Zeile Snippet + Action-Buttons (Deep Crawl, Save Keywords, Save Notes)
- [ ] **ChatMessageList:** Auto-Scroll-Disengage on user-scroll-up implementieren
- [ ] **JumpToLatestButton:** Neue Komponente, floating bottom-right, erscheint bei disengaged scroll
- [ ] **ChatMessageList:** Auto-Scroll re-engage wenn User innerhalb ~50px vom Bottom
- [ ] **ContextChip:** Default OFF, neuer ContextToggle als Switch in Chat-Header ("Use current Niche as context")
- [ ] **Health-Polling:** Intervall von 60s auf 5min ändern (`useSearchHealth.ts`)
- [ ] **VaneAnswer:** `rehype-sanitize` Plugin hinzufügen
- [ ] **i18n:** Neue Keys für Pattern B (`search.mode.*`, `search.workflow.*`, `search.scroll.*`) in allen 5 Locales

---

## Phase 4: New Build (was wirklich fehlt)

### Backend

- [ ] **Service `search_app/services/mode_classifier.py`:** LLM-Classifier (gpt-4.1-mini) — Input: User-Message + Context. Output: `web_search` | `agent`. Prompt ~50 Tokens. Returnt JSON `{mode: "web_search"|"agent", confidence: 0..1, reason: "..."}`
- [ ] **API:** Neuer SSE-Endpoint `GET /api/chat/sessions/{id}/messages/stream/?content=...&search_mode=...` — Django StreamingHttpResponse, yields `text/event-stream` events: `init`, `sources`, `chunk`, `done`
- [ ] **VaneService:** `search_stream()` Generator-Methode (parses Vane SSE, re-yields)
- [ ] **VaneService:** Token-Counter für `tokens_used` (vergleichsweise grob, optional via tiktoken)
- [ ] **post_save Signal:** `WebSearchResult.crawl_status==completed` → enqueue Embedding-Job. Gated by `settings.VECTOR_DB_ENABLED`
- [ ] **Tasks:** `embed_web_search_result_to_vector_db` task — chunk content (1500 tokens, 5% overlap), call PROJ-15 embedding API, save `EmbeddingChunk` records
- [ ] **Settings:** `VECTOR_DB_ENABLED = bool(env('VECTOR_DB_ENABLED', 'true'))` 
- [ ] **Settings:** `RQ_QUEUES['search'] = {URL: REDIS_URL, DEFAULT_TIMEOUT: 300}`
- [ ] **Mode-classifier in messages-View:** wenn Body `mode_override == 'auto'` → klassifizieren → wenn `agent` → AgentSession via PROJ-18 API anlegen + ChatMessage(message_type='workflow_card', agent_session=...)
- [ ] **Management Command:** `manage.py backfill_vector_db` — iteriert über alle WebSearchResult mit content_type='full_crawl' und embedded=False

### Frontend

- [ ] **WorkflowCard.tsx:** Inline-Komponente. Render wenn `message_type === 'workflow_card'`. Mini-Stepper (steps mit checkmarks/spinner/dots), live-update via PROJ-18 polling, "→ Open Command Center" Link
- [ ] **ApprovalCard.tsx:** Inline-Approval-Card. Cost + Action + Approve/Reject Buttons. Calls PROJ-18 approval endpoint direkt
- [ ] **ModeDropdown.tsx:** Auto / Web-Search / Agent — MUI Select im Chat-Input. Setzt `mode_override` Feld in sendMessage Body
- [ ] **SaveSnippetToolbar:** Neue globale Komponente. Listens `mouseup` auf `.crawl-result`-Container. Wenn `window.getSelection()` hat Text → Toolbar pop-up bei Selection-Coords mit "Save as Keywords" / "Save as Notes" Buttons
- [ ] **SaveToNicheModal:** Wenn kein niche_context aktiv → Modal mit searchable Niche-Picker
- [ ] **EventSource SSE Client:** `useSendMessageStream` Hook (vanilla EventSource, nicht RTK Query). Yields chunks → Redux dispatch → ChatMessageList re-render
- [ ] **EventSource Cancel:** Wenn neue Message gesendet → vorhandene EventSource closed (EC-7)
- [ ] **DrawerResizeHandle:** Drag-handle Komponente (mouse + touch), updates Redux drawerWidth (klemmt auf 480/768/1200 mit Snapping)
- [ ] **NotebookLM Full-Mode (1200px) Layout:** 3-Column — Left (State + Stepper), Center (Chat-Stream), Right (Active Detail: Approvals, Knowledge, Sources)
- [ ] **Frontend Pakete:** `npm install rehype-sanitize`

### Infrastructure

- [ ] **docker-compose.yml:** Neuer Service `worker-search` mit Command `python manage.py rqworker search`, gleiche Volumes/Env wie andere Worker
- [ ] **docker-compose.override.yml:** Bind-Mount für `worker-search` (live code reload)
- [ ] **scripts/dev-tunnel.sh:** SSH-Tunnel-Helper. Liest Container-IPs vom Server (`docker inspect`), startet `ssh -fN -L 3000:<vane_ip>:3000 -L 11235:<crawl_ip>:11235 root@213.165.95.5`. Auto-Reconnect bei IP-Change
- [ ] **.env.dev.template:** `VECTOR_DB_ENABLED=true` ergänzen
- [ ] **.env.prod.template:** `VANE_API_URL`, `CRAWL4AI_API_URL`, `VANE_DEFAULT_MODEL`, `VANE_EMBEDDING_MODEL`, `VECTOR_DB_ENABLED=false` ergänzen

---

## Phase 5: Wire-Up (Integrationen verbinden)

### PROJ-15 Vector DB Hook

- [ ] **post_save Signal:** WebSearchResult → embedding task wenn `VECTOR_DB_ENABLED=true`
- [ ] **Embedding Task:** Chunk + embed via OpenRouter, store via PROJ-15 `EmbeddingChunk` model
- [ ] **Test:** Lokal mit `VECTOR_DB_ENABLED=true` — Crawl ausführen → Vector DB hat Eintrag

### PROJ-18 Agent Hook

- [ ] **API-Call:** From Mode-Classifier `agent` route → POST to `/api/agent/sessions/` (PROJ-18 endpoint) mit `{niche_context, command, source: 'chat'}`
- [ ] **Response-Handling:** AgentSession ID → save als `ChatMessage(message_type='workflow_card', agent_session=<id>)`
- [ ] **Live-Update:** WorkflowCard pollt `/api/agent/sessions/{id}/` alle 3s → refresht Stepper-Status
- [ ] **Approval-Wire:** ApprovalCard innerhalb WorkflowCard → POST direkt an `/api/agent/sessions/{id}/approve/{action_log_id}/` (PROJ-18 endpoint)
- [ ] **"Open Command Center" Link:** Switcht Drawer-Tab auf 'agent' + dispatcht `setActiveAgentSessionId(<id>)` in agentSlice → AgentPanel scrollt zur Session

### PROJ-10 NicheKeyword Hook

- [ ] **save-to-niche endpoint:** Bei `save_as=keywords` → split selected_text → für jeden Token: `NicheKeyword.objects.create(niche=X, keyword=token, source='web_search', created_by=user)`
- [ ] **Duplicate-Handling:** unique check via `(niche, keyword)` — wenn schon da, skip + counter zurückgeben
- [ ] **Response:** `{created: 5, skipped: 2}`

### Topbar Integration

- [ ] **HealthStatusDot:** auch in Topbar einbauen (zusätzlich zu Drawer-Header) für globale Sichtbarkeit

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

- [ ] Vane + Crawl4ai im Server-Stack laufen (Verify mit `docker ps` auf 213.165.95.5)
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
