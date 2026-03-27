# PROJ-18: OpenClaw Agent (Multi-Agent System) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `agent_app` — 8 models, multi-agent system, permission gating, knowledge system
- **LangGraph `create_react_agent()`** for all agents (same pattern as PROJ-6/8)
- **Orchestrator + 6 Sub-Agents** — each with own tool set, system prompt, LLM model
- **Separate tool files** per sub-agent — enforced isolation
- **Permission check wrapper** on every tool (Auto/Notify/Approve)
- **3-layer knowledge:** System Prompt + Knowledge Docs + Implicit Learning (Vector DB)
- **Separate OpenRouter API key** for agent budget isolation
- **Dedicated `worker-agent`** (60min timeout)
- **PostgreSQL Checkpointer** shared with PROJ-6/8 for crash recovery
- **Resizable drawer** (480→768→1200px) for Agent Command Center

---

## Phase 1: Backend Foundation — Models

- [ ] Create `agent_app/` Django app, register in `INSTALLED_APPS`
- [ ] Create `agent_app/api/`, `agent_app/agents/`, `agent_app/agents/tools/`, `agent_app/services/` subpackages
- [ ] Wire into `core/urls.py` under `/api/agent/`
- [ ] AC-1: `AgentConfig` model: UUID pk, `workspace` FK, `agent_type` choices (7 types), `display_name` CharField(50), `personality` TextField, `avatar_emoji` CharField(5), `model_name` CharField(100), `temperature` FloatField, `system_prompt` TextField, `max_tokens` IntegerField(nullable), `updated_at`. One per agent_type per workspace
- [ ] AC-2: `AgentSession` model: UUID pk, `workspace` FK, `created_by` FK, `title` CharField(200), `status` choices (idle/running/paused/completed/failed/cancelled), `niche_context` FK(nullable), `workflow_template` CharField(50, nullable), `autonomy_preset` CharField(20), `is_shared` BooleanField, `current_step` CharField(100), `total_steps`/`completed_steps` IntegerField, `error_message` TextField, timestamps
- [ ] AC-3: `AgentMessage` model: UUID pk, `session` FK, `role` choices (user/agent/system/approval_request/approval_response), `content` TextField, `agent_type` CharField(50), `tool_calls` JSONField, `created_at`
- [ ] AC-4: `AgentActionLog` model: UUID pk, `session` FK, `workspace` FK, `user` FK, `agent_type`, `action` CharField(100), `target_object_type`/`target_object_id`, `status` choices (started/completed/failed/skipped/awaiting_approval/approved/rejected), `cost_estimate` DecimalField(nullable), `error_message`, timestamps
- [ ] AC-5: `ToolPermission` model: UUID pk, `workspace` FK, `user` FK, `tool_name` CharField(100), `permission_level` choices (auto/notify/approve). unique_together (workspace, user, tool_name)
- [ ] AC-6: `AutonomyPreset` model: UUID pk, `workspace` FK, `created_by` FK(nullable), `name` CharField(50), `is_system` BooleanField, `permissions` JSONField, `created_at`. 3 system defaults seeded
- [ ] AC-7: `KnowledgeDoc` model: UUID pk, `workspace` FK, `created_by` FK, `title` CharField(200), `content` TextField, `source` choices (manual/chat_command/auto_extracted), timestamps. post_save → PROJ-15 embedding
- [ ] AC-8: `WorkflowTemplate` model: UUID pk, `workspace` FK, `created_by` FK(nullable), `name` CharField(100), `key` CharField(50), `is_system` BooleanField, `steps` JSONField, `created_at`. 5 system defaults seeded
- [ ] Indexes: `(workspace, status)` on AgentSession, `(session, created_at)` on AgentMessage/AgentActionLog
- [ ] Initial migration
- [ ] Admin registration (all 8 models)
- [ ] RQ queue `agent` in `settings.py → RQ_QUEUES` (60-min timeout)
- [ ] `worker-agent` Docker service in `docker-compose.yml` + bind-mount in `docker-compose.override.yml`
- [ ] Env vars: `OPENROUTER_AGENT_API_KEY`, `AGENT_BUDGET_WARNING_THRESHOLD` in `.env.template`
- [ ] Seed defaults: 3 AutonomyPresets, 5 WorkflowTemplates, 7 AgentConfigs (with default names/emojis/personalities)

---

## Phase 2: Sub-Agent Tools

- [ ] AC-12: `agents/tools/research_tools.py`: `create_niche`, `update_niche_status`, `read_niche_details`, `trigger_deep_research`, `read_research_results`, `trigger_product_research`, `read_product_results`, `find_similar_niches`
- [ ] AC-13: `agents/tools/ideation_tools.py`: `create_manual_idea`, `trigger_slogan_adaptation`, `read_adaptation_results`, `approve_reject_idea`, `read_keyword_bank`, `add_keyword`, `find_similar_ideas`
- [ ] AC-14: `agents/tools/design_tools.py`: `get_design_board_context`, `analyze_reference_image`, `generate_design`, `read_design_status`, `approve_reject_design`, `trigger_batch_processing`
- [ ] AC-15: `agents/tools/listing_tools.py`: `generate_listing`, `read_listing`, `update_listing`, `mark_listing_ready`, `export_listing`
- [ ] AC-16: `agents/tools/publishing_tools.py`: `create_upload_job`, `read_upload_status`, `update_kanban_status`, `read_kanban_board`
- [ ] AC-17: `agents/tools/search_tools.py`: `semantic_search`, `find_similar_content`, `web_search`, `deep_crawl`, `save_to_niche`, `save_knowledge`
- [ ] Each tool wrapped with permission check decorator

---

## Phase 3: Multi-Agent System

- [ ] AC-9: `agents/orchestrator.py`: LangGraph `StateGraph` with `create_react_agent()`. 6 "delegate" tools (one per sub-agent). Each invokes sub-agent graph, returns result
- [ ] AC-10: Each sub-agent as independent `create_react_agent()` with own tool set, system prompt (from AgentConfig), LLM model (from AgentConfig)
- [ ] AC-11: Tool registry enforcement — each sub-agent can ONLY call tools registered for its type
- [ ] `agents/research_agent.py` through `agents/search_agent.py`: 6 sub-agent graph implementations
- [ ] PostgreSQL Checkpointer: `thread_id = session_id`. Shared with PROJ-6/8
- [ ] `RetryPolicy(max_attempts=2)` on all sub-agent tool calls

---

## Phase 4: Backend Services

- [ ] AC-18: `services/permission_checker.py`: before tool execution → check `ToolPermission`. Auto → execute. Notify → execute + create Notification. Approve → pause workflow, create approval_request AgentMessage, wait
- [ ] AC-19: Default permissions seeded on first agent use (Auto/Notify/Approve per tool as specified in spec)
- [ ] AC-20: Permission override via Agent Settings API
- [ ] AC-21: Autonomy preset activation bulk-updates all ToolPermission rows
- [ ] AC-23: Approval wait unbounded — agent pauses indefinitely until user responds
- [ ] AC-27: `services/knowledge_loader.py`: Layer 1 (system prompt from AgentConfig) + Layer 2 (top 5 Knowledge Docs via Vector Search) + Layer 3 (top 5 past experiences via Vector Search)
- [ ] AC-30: Before each sub-agent executes: load all 3 layers into context
- [ ] AC-34: `services/collision_detector.py`: check for active AgentSessions on same niche. Also check manual user activity (niche updated in last 5 min)
- [ ] AC-35: Collision warning → agent sends message, waits for user confirmation
- [ ] `services/cost_tracker.py`: estimate cost per tool call, track in AgentActionLog, check budget threshold

---

## Phase 5: Workflow Execution + Controls

- [ ] AC-24: 5 system default templates seeded (full_pipeline, research_only, ideation, design_sprint, listing_finalize)
- [ ] AC-25: Custom template CRUD via Agent Settings
- [ ] AC-26: `POST /api/agent/sessions/` with `workflow_template` → Orchestrator follows template. Without → plans autonomously
- [ ] AC-36: `tasks.py: run_agent_workflow(session_id)` — django-rq job entry point. Loads session, config, runs Orchestrator graph
- [ ] AC-37: Checkpointer saves after each sub-agent. Worker crash → resume from checkpoint
- [ ] AC-38: On resume: notification "Workflow resumed at step X"
- [ ] AC-39: Streaming events forwarded to frontend via SSE or polling
- [ ] AC-40: `POST /api/agent/sessions/{id}/pause/` → status=paused. Agent finishes current tool, halts
- [ ] AC-41: `POST /api/agent/sessions/{id}/resume/` → status=running. Continues from paused state
- [ ] AC-42: `POST /api/agent/sessions/{id}/stop/` → status=cancelled. Finishes current tool, stops. Data persists

---

## Phase 6: Batch + Rate Limiting

- [ ] AC-31: `POST /api/agent/sessions/batch/` — body: `{niche_ids, workflow_template, parallel}`. Creates one AgentSession per niche
- [ ] AC-32: Sequential (default): next niche after previous completes. Parallel: all as separate django-rq jobs
- [ ] AC-33: Batch progress visible in Agent-Tab
- [ ] AC-44: Separate OpenRouter API key (`OPENROUTER_AGENT_API_KEY`)
- [ ] AC-45: On 402 (budget exhausted) → pause workflow, message "Agent budget exhausted"
- [ ] AC-46: Optional soft warning at 80% of `AGENT_BUDGET_WARNING_THRESHOLD`
- [ ] AC-47: Every tool call logged in AgentActionLog with estimated cost

---

## Phase 7: API Endpoints

### Session CRUD + Controls
- [ ] AC-48: `POST /api/agent/sessions/` — start session (optional: workflow_template, niche_context)
- [ ] `POST /api/agent/sessions/batch/` — batch start
- [ ] `GET /api/agent/sessions/` — list user's sessions
- [ ] `GET /api/agent/sessions/{id}/` — detail + messages + progress
- [ ] `POST /api/agent/sessions/{id}/messages/` — send command
- [ ] `POST /api/agent/sessions/{id}/pause/` / `resume/` / `stop/`
- [ ] `POST /api/agent/sessions/{id}/share/` / `unshare/`
- [ ] `POST /api/agent/sessions/{id}/approve/{action_log_id}/` — approve pending action
- [ ] `POST /api/agent/sessions/{id}/reject/{action_log_id}/` — reject pending action

### Config + Permissions
- [ ] `GET /api/agent/config/` — get all AgentConfigs for workspace
- [ ] `PATCH /api/agent/config/{agent_type}/` — update config (name, personality, avatar, model, temp). System prompt: Admin only
- [ ] `GET /api/agent/permissions/` — get user's tool permissions
- [ ] `PATCH /api/agent/permissions/` — update permissions
- [ ] `GET /api/agent/presets/` — list presets
- [ ] `POST /api/agent/presets/` — create custom preset
- [ ] `POST /api/agent/presets/{id}/activate/` — activate (bulk-update permissions)
- [ ] `DELETE /api/agent/presets/{id}/` — delete custom preset

### Templates + Knowledge
- [ ] `GET /api/agent/templates/` — list templates
- [ ] `POST /api/agent/templates/` — create custom template
- [ ] `DELETE /api/agent/templates/{id}/` — delete custom template
- [ ] `GET /api/agent/knowledge/` — list knowledge docs
- [ ] `POST /api/agent/knowledge/` — create doc
- [ ] `PATCH /api/agent/knowledge/{id}/` — update doc
- [ ] `DELETE /api/agent/knowledge/{id}/` — delete doc (+ remove Vector DB embedding)

---

## Phase 8: Serializers

- [ ] `AgentConfigSerializer` — all fields, personality_presets (computed from spec table)
- [ ] `AgentSessionSerializer` — all fields, nested niche_context (id+name), message_count, current progress
- [ ] `AgentMessageSerializer` — all fields, agent display_name + avatar_emoji resolved from AgentConfig
- [ ] `AgentActionLogSerializer` — all fields, target object summary
- [ ] `ToolPermissionSerializer` — tool_name, permission_level, tool description (computed)
- [ ] `AutonomyPresetSerializer` — name, is_system, permissions map
- [ ] `KnowledgeDocSerializer` — all fields
- [ ] `WorkflowTemplateSerializer` — all fields, steps with descriptions

---

## Phase 9: Frontend — State & Services

- [ ] RTK Query `agentApi` slice (`store/agentSlice.ts`): createSession, batchCreate, listSessions, getSession, sendMessage, pause/resume/stop, share/unshare, approve/reject, getConfig, updateConfig, getPermissions, updatePermissions, listPresets, createPreset, activatePreset, deletePreset, listTemplates, createTemplate, deleteTemplate, listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge
- [ ] Cache tags: `AgentSessions`, `AgentMessages`, `AgentConfig`, `Permissions`, `Presets`, `Templates`, `Knowledge`
- [ ] Register slice in `store/index.ts`
- [ ] TypeScript types: AgentConfig, AgentSession, AgentMessage, AgentActionLog, ToolPermission, AutonomyPreset, KnowledgeDoc, WorkflowTemplate, AgentType, SessionStatus

---

## Phase 10: Frontend — Agent Tab (Command Center)

- [ ] AC-49: Agent tab as 3rd segment in MultiPurposeDrawer: `[📋 Niche] [💬 Chat] [🤖 Agent]`
- [ ] AC-50: Resizable drawer — drag handle. Default 480px. 3 responsive breakpoints (480/768/1200px)
- [ ] `AgentHeader.tsx`: AC-54 — budget indicator (LinearProgress), autonomy preset chip, niche context chip (X to remove), Pause/Resume/Stop buttons
- [ ] `WorkflowStepper.tsx`: AC-51 — MUI Stepper showing template steps. Active highlighted, completed checkmark, failed red
- [ ] `AgentLog.tsx`: AC-52 — scrollable message list. Different styles per role. Sub-agent delegation visible ("🤖 Chief delegiert an 🎨 Pixel...")
- [ ] `AgentMessageBubble.tsx`: avatar_emoji + display_name as sender. Agent messages, user commands, system messages styled differently
- [ ] `ApprovalCard.tsx`: AC-53 — inline card: action description, estimated cost, target object, Approve (primary) + Reject (outlined)
- [ ] `QuickActionBar.tsx`: AC-55 — template buttons for one-click workflow start. Visible when no workflow running
- [ ] `BatchView.tsx`: AC-56 — niche list with individual progress indicators
- [ ] `CollisionWarning.tsx`: MUI Dialog — "User X is working on this niche. Continue anyway?"
- [ ] `OnboardingBanner.tsx`: AC-57 — first-time banner, dismissable. Links to guided setup
- [ ] EC-10: 200+ messages → paginate (latest 50, "Load more")

---

## Phase 11: Frontend — Agent Settings

- [ ] AC-55b: `AgentSettingsPage.tsx`: per-agent — editable display_name, personality textarea, avatar_emoji picker, model_name selector
- [ ] AC-55c: Agent-Tab header shows Orchestrator avatar + name. Sub-agent messages show their own
- [ ] AC-55d: Delegation uses personalized names
- [ ] AC-55e: `PersonalityPresets.tsx`: clickable preset chips above textarea. Click populates, user edits freely. Presets from spec table (13 presets across 7 agent types)
- [ ] AC-55f: Default names seeded: Chief 🤖, Scout 🔬, Muse 💡, Pixel 🎨, Scribe ✍️, Launch 🚀, Radar 🔍
- [ ] `PermissionEditor.tsx`: AC-20 — tool permission table. Per-tool: Auto/Notify/Approve toggle
- [ ] `PresetSelector.tsx`: AC-21 — dropdown with 3 system + custom presets. Activate = bulk-update permissions
- [ ] `KnowledgeDocList.tsx`: AC-28 — CRUD list. Markdown preview
- [ ] `TemplateEditor.tsx`: AC-25 — custom template builder. Ordered step list (drag-to-reorder), agent_type + action per step
- [ ] AC-58: Guided setup flow (optional, 3 steps): choose autonomy → select niche → quick knowledge doc. Skippable
- [ ] AC-59: Agent usable immediately without onboarding — all defaults pre-configured

---

## Phase 12: Frontend — Team Visibility

- [ ] AC-60: Sessions private by default. "Share" button per session
- [ ] AC-61: Shared sessions read-only for non-owners (can view, can't command/approve/stop)
- [ ] AC-62: Shared badge in session list: "Shared by {username}"

---

## Phase 13: i18n

- [ ] `agent.tab.*` — segment label, page title
- [ ] `agent.header.*` — budget label, preset label, controls (pause/resume/stop)
- [ ] `agent.stepper.*` — step labels, status labels
- [ ] `agent.log.*` — message type labels, delegation text, tool call labels
- [ ] `agent.approval.*` — action description, cost label, approve/reject buttons
- [ ] `agent.quickAction.*` — template button labels (Full Pipeline, Research Only, etc.)
- [ ] `agent.batch.*` — batch title, niche progress, sequential/parallel labels
- [ ] `agent.settings.*` — config fields (name, personality, avatar, model), preset names, permission levels
- [ ] `agent.knowledge.*` — doc title, create/edit/delete labels
- [ ] `agent.templates.*` — template name, step labels, create/delete
- [ ] `agent.collision.*` — warning text, continue/cancel buttons
- [ ] `agent.onboarding.*` — banner text, setup steps, skip labels
- [ ] `agent.budget.*` — exhausted message, warning message, threshold label
- [ ] `agent.personality.*` — all 13 preset names + descriptions from spec
- [ ] `agent.names.*` — 7 default agent names (Chief, Scout, Muse, Pixel, Scribe, Launch, Radar)
- [ ] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 14: Tests

### Backend

- [ ] AgentConfig: CRUD, defaults seeded, personality injection into system prompt
- [ ] AgentSession: create, pause/resume/stop status transitions, batch create
- [ ] Permission checker: Auto executes, Notify executes + notification, Approve pauses + creates approval request
- [ ] Approval flow: approve → tool executes, reject → tool skipped, workflow continues
- [ ] Autonomy preset: activate bulk-updates permissions, system presets not deletable
- [ ] Workflow templates: 5 defaults seeded, custom CRUD, template steps followed by Orchestrator
- [ ] Knowledge docs: CRUD, Vector DB embedding on save, embedding deleted on delete
- [ ] Knowledge loader: loads 3 layers (prompt + top 5 docs + top 5 experiences)
- [ ] Collision detector: active session on same niche → warning. Recent manual edit → warning
- [ ] Cost tracker: estimates logged per tool call, budget warning at threshold
- [ ] OpenRouter 402 → workflow paused with message
- [ ] Checkpointer: crash → resume from last sub-agent checkpoint
- [ ] Batch: sequential processes one at a time, parallel creates separate jobs
- [ ] Tool isolation: sub-agent can't call tools from other sub-agents
- [ ] Workspace isolation on all endpoints

### Frontend

- [ ] AgentPanel: renders with quick-action bar when idle
- [ ] WorkflowStepper: correct step highlighting (active/completed/failed)
- [ ] AgentLog: messages styled per role, delegation visible, agent names/emojis shown
- [ ] ApprovalCard: approve/reject buttons work, updates status
- [ ] AgentSettingsPage: config saves, personality presets populate field
- [ ] PermissionEditor: toggle levels, changes persisted
- [ ] BatchView: niche list with individual progress
- [ ] OnboardingBanner: shown first time, dismissable, setup flow works
- [ ] Resizable drawer: drag handle works at 3 breakpoints
- [ ] TypeScript + ESLint + Ruff: 0 errors

### Edge Cases

- [ ] EC-1: Worker crash → resume from checkpoint + notification
- [ ] EC-2: OpenRouter 402 → pause + "budget exhausted" message
- [ ] EC-3: Tool call fails → retry 1x, then fallback or ask user
- [ ] EC-4: Two users on same niche → collision warning, user confirms
- [ ] EC-5: Preset switch while running → applies to next tool call
- [ ] EC-8: Batch: one niche fails → continues others, summary at end
- [ ] EC-13: Paused 24+ hours → resume still works (state in DB)
- [ ] EC-16: "Merke dir" → KnowledgeDoc created, source=chat_command, embedded
- [ ] EC-17: Fresh workspace (no knowledge) → operates on System Prompt only

---

## Verification Checklist

- [ ] `agent_app` registered, migrations applied, defaults seeded (configs, presets, templates)
- [ ] Orchestrator delegates to 6 sub-agents correctly
- [ ] Sub-agent tool isolation enforced
- [ ] Permission gating: Auto/Notify/Approve on every tool call
- [ ] Approval flow: pause → approve/reject → continue
- [ ] Autonomy presets: 3 system + custom, activate bulk-updates permissions
- [ ] 3-layer knowledge: System Prompt + Knowledge Docs + Implicit Learning loaded before each sub-agent
- [ ] Workflow templates: 5 defaults, custom CRUD, Orchestrator follows steps
- [ ] Batch operations: sequential + parallel, per-niche progress
- [ ] Collision detection: warns on active session or recent manual edit
- [ ] Checkpointer: crash → resume from last checkpoint + notification
- [ ] Budget: separate API key, 402 → pause, 80% warning
- [ ] Agent personalization: names, emojis, personalities configurable + shown in UI
- [ ] Agent tab in drawer: resizable, stepper, log, approval cards, quick-actions
- [ ] worker-agent runs independently (60min timeout)
- [ ] All tests pass, lint clean
