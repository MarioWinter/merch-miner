# PROJ-18: OpenClaw Agent (Multi-Agent System) — Implementation Tasks

**Status:** In Progress
**Last Updated:** 2026-04-28 — Three updates today:
> 1. **Spec ↔ Tasks parity sweep** (added AC-22, AC-29, AC-43, AC-63, AC-64; added EC-6, EC-7, EC-9, EC-11, EC-12, EC-14, EC-15; new Phase 13 for Dashboard Integration).
> 2. **Metis-Pattern Self-Improvement Layer** added (AC-65..80, EC-18..23; new Phase 14; renumbered i18n → 15, Tests → 16). Decision-Log entries 25-32 capture rationale.
> 3. **Format consistency pass** (Phase 7 + 16 sub-sections numerical 7.1/7.2/7.3 + 16.1/16.2/16.3, Phase 14 blockquote removed, Phase 14.9 i18n keys merged into Phase 15 single i18n source).

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `agent_app` — **13 models** (8 base + 5 self-improvement: Skill, SkillVersion, WorkspaceMemory, UserProfile, AgentWorkspaceConfig)
- **LangGraph `create_react_agent()`** for all agents (same pattern as PROJ-6/8)
- **Orchestrator + 6 Sub-Agents + 2 Reflection Sub-Agents** (reflection_agent + skill_refiner_agent)
- **Separate tool files** per sub-agent — enforced isolation
- **Permission check wrapper** on every tool (Auto/Notify/Approve)
- **6-layer knowledge:** Prompt + Docs + Implicit + WorkspaceMemory + UserProfile + Skills (12k token budget)
- **Metis-pattern Self-Improvement:** char-limited memory (Postgres validator) + auto-generated skills (>5 tool calls or error recovery) + per-N-session reflection + Honcho-style dialectic user-modeling (locally built, no SaaS dependency)
- **Sub-Agent return-value filter** — only final result to Orchestrator state, not trace (~70% token savings)
- **Separate OpenRouter API key** for agent budget isolation
- **Dedicated `worker-agent`** (60min timeout) — also runs reflection jobs
- **PostgreSQL Checkpointer** shared with PROJ-6/8 for crash recovery
- **Resizable drawer** (480→768→1200px) for Agent Command Center

---

## Phase 1: Backend Foundation — Models

- [x] Create `agent_app/` Django app, register in `INSTALLED_APPS`
- [x] Create `agent_app/api/`, `agent_app/agents/`, `agent_app/agents/tools/`, `agent_app/services/` subpackages
- [x] Wire into `core/urls.py` under `/api/agent/`
- [x] AC-1: `AgentConfig` model: UUID pk, `workspace` FK, `agent_type` choices (7 types), `display_name` CharField(50), `personality` TextField, `avatar_emoji` CharField(5), `model_name` CharField(100), `temperature` FloatField, `system_prompt` TextField, `max_tokens` IntegerField(nullable), `updated_at`. One per agent_type per workspace
- [x] AC-2: `AgentSession` model: UUID pk, `workspace` FK, `created_by` FK, `title` CharField(200), `status` choices (idle/running/paused/completed/failed/cancelled), `niche_context` FK(nullable), `workflow_template` CharField(50, nullable), `autonomy_preset` CharField(20), `is_shared` BooleanField, `current_step` CharField(100), `total_steps`/`completed_steps` IntegerField, `error_message` TextField, `source` choices (agent_tab/chat_command/batch_api, default=agent_tab), timestamps
- [x] AC-3: `AgentMessage` model: UUID pk, `session` FK, `role` choices (user/agent/system/approval_request/approval_response), `content` TextField, `agent_type` CharField(50), `tool_calls` JSONField, `created_at`
- [x] AC-4: `AgentActionLog` model: UUID pk, `session` FK, `workspace` FK, `user` FK, `agent_type`, `action` CharField(100), `target_object_type`/`target_object_id`, `status` choices (started/completed/failed/skipped/awaiting_approval/approved/rejected), `cost_estimate` DecimalField(nullable), `error_message`, timestamps
- [x] AC-5: `ToolPermission` model: UUID pk, `workspace` FK, `user` FK, `tool_name` CharField(100), `permission_level` choices (auto/notify/approve). unique_together (workspace, user, tool_name)
- [x] AC-6: `AutonomyPreset` model: UUID pk, `workspace` FK, `created_by` FK(nullable), `name` CharField(50), `is_system` BooleanField, `permissions` JSONField, `created_at`. 3 system defaults seeded
- [x] AC-7: `KnowledgeDoc` model: UUID pk, `workspace` FK, `created_by` FK, `title` CharField(200), `content` TextField, `source` choices (manual/chat_command/auto_extracted), timestamps. post_save → PROJ-15 embedding
- [x] EC-9: post_delete signal on `KnowledgeDoc` → call `vector_app.delete_embedding(source_type='knowledge_doc', source_id=instance.id)` so future agent decisions aren't influenced by deleted docs
- [x] AC-8: `WorkflowTemplate` model: UUID pk, `workspace` FK, `created_by` FK(nullable), `name` CharField(100), `key` CharField(50), `is_system` BooleanField, `steps` JSONField, `created_at`. 5 system defaults seeded
- [x] Indexes: `(workspace, status)` on AgentSession, `(session, created_at)` on AgentMessage/AgentActionLog
- [x] Initial migration
- [x] Admin registration (all 8 models)
- [x] RQ queue `agent` in `settings.py → RQ_QUEUES` (60-min timeout)
- [x] `worker-agent` Docker service in `docker-compose.yml` + bind-mount in `docker-compose.override.yml`
- [x] Env vars: `OPENROUTER_AGENT_API_KEY`, `AGENT_BUDGET_WARNING_THRESHOLD` in `.env.template`
- [x] Seed defaults: 3 AutonomyPresets, 5 WorkflowTemplates, 7 AgentConfigs (with default names/emojis/personalities)

---

## Phase 2: Sub-Agent Tools

- [x] AC-12: `agents/tools/research_tools.py`: `create_niche`, `update_niche_status`, `read_niche_details`, `trigger_deep_research`, `read_research_results`, `trigger_product_research`, `read_product_results`, `find_similar_niches`
- [x] AC-13: `agents/tools/ideation_tools.py`: `create_manual_idea`, `trigger_slogan_adaptation`, `read_adaptation_results`, `approve_reject_idea`, `read_keyword_bank`, `add_keyword`, `find_similar_ideas`
- [x] AC-14: `agents/tools/design_tools.py`: `get_design_board_context`, `analyze_reference_image`, `generate_design`, `read_design_status`, `approve_reject_design`, `trigger_batch_processing`
- [x] AC-15: `agents/tools/listing_tools.py`: `generate_listing`, `read_listing`, `update_listing`, `mark_listing_ready`, `export_listing`
- [x] EC-7: `generate_listing` tool falls back to text-only when no approved design exists for the niche; emits an `AgentMessage` notifying the user "No design available, created text-only listing."
- [x] AC-16: `agents/tools/publishing_tools.py`: `create_upload_job`, `read_upload_status`, `update_kanban_status`, `read_kanban_board`
- [x] AC-17: `agents/tools/search_tools.py`: `semantic_search`, `find_similar_content`, `web_search`, `deep_crawl`, `save_to_niche`, `save_knowledge`
- [x] Each tool wrapped with permission check decorator

---

## Phase 3: Multi-Agent System

- [x] AC-9: `agents/orchestrator.py`: LangGraph `StateGraph` with `create_react_agent()`. 6 "delegate" tools (one per sub-agent). Each invokes sub-agent graph, returns result
- [x] AC-10: Each sub-agent as independent `create_react_agent()` with own tool set, system prompt (from AgentConfig), LLM model (from AgentConfig)
- [x] AC-11: Tool registry enforcement — each sub-agent can ONLY call tools registered for its type
- [x] `agents/research_agent.py` through `agents/search_agent.py`: 6 sub-agent graph implementations
- [x] PostgreSQL Checkpointer: `thread_id = session_id`. Shared with PROJ-6/8
- [x] `RetryPolicy(max_attempts=2)` on all sub-agent tool calls *(deferred to Phase 5 — sub-agent invocation currently relies on default `create_react_agent` retry behaviour; per-tool RetryPolicy will be set when checkpointer compile is finalised)*
- [x] EC-6: Orchestrator pre-flight check before delegating to Design Agent — if niche has zero approved slogans, send suggestion message ("No approved slogans for this niche. Run Ideation first?") and pause workflow until user confirms.
- [x] EC-15: Per-sub-agent timeout (default 10 min, configurable via `AGENT_SUBAGENT_TIMEOUT_SEC` env). Orchestrator wraps each delegate call with `asyncio.wait_for`; on timeout → log `AgentActionLog.status='failed'` + branch on per-tool `error_config` (skip / ask user / stop).

---

## Phase 4: Backend Services

- [x] AC-18: `services/permission_checker.py`: before tool execution → check `ToolPermission`. Auto → execute. Notify → execute + create Notification. Approve → pause workflow, create approval_request AgentMessage, wait
- [x] AC-19: Default permissions seeded on first agent use (Auto/Notify/Approve per tool as specified in spec)
- [x] AC-20: Permission override via Agent Settings API (service-layer `update_permissions(workspace, user, perms_map)` ready; HTTP wiring lands in Phase 7)
- [x] AC-21: Autonomy preset activation bulk-updates all ToolPermission rows (`apply_preset` service)
- [x] AC-22: Approval requests persisted as `AgentMessage` with `role=approval_request` — content includes action description (tool + target object summary) and estimated cost; consumed by frontend ApprovalCard (AC-53)
- [x] AC-23: Approval wait unbounded — agent pauses indefinitely until user responds (decorator returns `awaiting_approval` payload; orchestrator pauses session via existing flow)
- [x] AC-27: `services/knowledge_loader.py` Layer 1 — system prompt + personality injection from `AgentConfig`
- [x] AC-28: Layer 2 — Knowledge Docs via Vector Search (top 5 by relevance) — uses PROJ-15 `EmbeddingService.search` with content_type filter `knowledge_doc`; falls back to most-recent docs without query text
- [x] AC-29: Layer 3 — Implicit Learning. Before each decision agent queries past approvals/rejections + similar workflow outcomes (MVP: direct `AgentActionLog` query filtered by terminal status; vector-embedded action logs are PROJ-15 follow-up)
- [x] AC-30: Before each sub-agent executes: load all 3 layers into context (Layer 1 + top 5 Layer 2 docs + top 5 Layer 3 experiences) — `sub_agent_base.build_sub_agent` calls `build_agent_context` + `render_context_as_prompt`
- [x] AC-34: `services/collision_detector.py`: check for active AgentSessions on same niche. Also check manual user activity (niche updated in last 5 min)
- [x] AC-35: Collision warning → agent sends message (`warn_and_pause`) and pauses session, waits for user confirmation/resume
- [x] `services/cost_tracker.py`: estimate cost per tool call, track in AgentActionLog (auto-populated by permission_checker), check budget threshold (80% warning + 402-pause)

---

## Phase 5: Workflow Execution + Controls

- [x] AC-24: 5 system default templates seeded (full_pipeline, research_only, ideation, design_sprint, listing_finalize)
- [x] AC-25: Custom template CRUD via Agent Settings (service layer in `services/template_manager.py`; API in Phase 7)
- [x] AC-26: `POST /api/agent/sessions/` with `workflow_template` → Orchestrator follows template. Without → plans autonomously
- [x] AC-36: `tasks.py: run_agent_workflow(session_id)` — django-rq job entry point. Loads session, config, runs Orchestrator graph
- [x] AC-37: Checkpointer saves after each sub-agent. Worker crash → resume from checkpoint
- [x] AC-38: On resume: notification "Workflow resumed at step X"
- [x] AC-39: Streaming events forwarded to frontend via SSE or polling (polling-first MVP; SSE deferred)
- [x] AC-40: `POST /api/agent/sessions/{id}/pause/` → status=paused. Agent finishes current tool, halts
- [x] AC-41: `POST /api/agent/sessions/{id}/resume/` → status=running. Continues from paused state
- [x] AC-42: `POST /api/agent/sessions/{id}/stop/` → status=cancelled. Finishes current tool, stops. Data persists
- [x] EC-12: User commands sent during active tool execution are persisted as `AgentMessage(role=user, processed=False)` and dequeued by Orchestrator after the current tool completes — never lost, never interrupting.
- [x] EC-14: `WorkflowTemplate.steps` validation (model `clean()` + serializer `validate_steps()`) — detect missing prerequisites (e.g. Design before Research/Ideation) and return 400 with a structured error explaining the missing step. Orchestrator double-checks at template-load time and refuses to start until user confirms an override.

---

## Phase 6: Batch + Rate Limiting

- [x] AC-31: `POST /api/agent/sessions/batch/` — body: `{niche_ids, workflow_template, parallel, autonomy_preset}`. Creates one AgentSession per niche with shared `batch_id` UUID + `batch_position`. Cross-workspace niche_ids return 400 with `missing_niche_ids`.
- [x] AC-32: Sequential (default): only first sibling enqueued; `_maybe_chain_batch` (in `tasks.py`) calls `services/batch_runner.enqueue_next_in_batch` after completion/failure. Parallel: all sessions enqueued upfront. Pause-for-approval/budget does NOT auto-advance.
- [x] AC-33: Batch progress visible in Agent-Tab — `GET /api/agent/sessions/?batch_id=<uuid>` filter; `batch_id` + `batch_position` exposed on `AgentSessionListSerializer`. Frontend rendering is Phase 10.
- [x] AC-44: Separate OpenRouter API key (`OPENROUTER_AGENT_API_KEY`) — `agents/llm.py` uses agent key with fallback to main key. Verified via test.
- [x] AC-45: On 402 (budget exhausted) → pause workflow, message "Agent budget exhausted". `services/budget_guard.py` introspects exception status_code/cause-chain/message keywords. `tasks.run_agent_workflow` catches via `is_budget_error()` and calls `pause_for_budget()`.
- [x] AC-46: Soft warning at 80% of `AGENT_BUDGET_WARNING_THRESHOLD`. `cost_tracker.maybe_emit_budget_warning()` hooked into `permission_decorator` after every Auto/Notify tool execution. De-dup via Redis cache key 24h TTL (workspace-scoped). TODO post-MVP: promote to `BudgetWarningLog` model if history needed.
- [x] AC-47: Every tool call logged in `AgentActionLog` with estimated cost — `permission_checker.check_tool_permission` writes `cost_estimate` from `cost_tracker.estimate_cost(tool_name)` on every invocation. Verified in tests.

---

## Phase 7: API Endpoints

### 7.1 Session CRUD + Controls
- [x] AC-48: `POST /api/agent/sessions/` — start session (optional: workflow_template, niche_context)
- [x] `POST /api/agent/sessions/batch/` — batch start
- [x] `GET /api/agent/sessions/` — list user's sessions
- [x] `GET /api/agent/sessions/{id}/` — detail + messages + progress
- [x] `POST /api/agent/sessions/{id}/messages/` — send command
- [x] `POST /api/agent/sessions/{id}/pause/` / `resume/` / `stop/`
- [x] `POST /api/agent/sessions/{id}/share/` / `unshare/`
- [x] `POST /api/agent/sessions/{id}/approve/{action_log_id}/` — approve pending action
- [x] `POST /api/agent/sessions/{id}/reject/{action_log_id}/` — reject pending action

### 7.2 Config + Permissions
- [x] `GET /api/agent/config/` — get all AgentConfigs for workspace
- [x] `PATCH /api/agent/config/{agent_type}/` — update config (name, personality, avatar, model, temp). System prompt: Admin only
- [x] `GET /api/agent/permissions/` — get user's tool permissions
- [x] `PATCH /api/agent/permissions/` — update permissions
- [x] `GET /api/agent/presets/` — list presets
- [x] `POST /api/agent/presets/` — create custom preset
- [x] `POST /api/agent/presets/{id}/activate/` — activate (bulk-update permissions)
- [x] `DELETE /api/agent/presets/{id}/` — delete custom preset

### 7.3 Templates + Knowledge
- [x] `GET /api/agent/templates/` — list templates
- [x] `POST /api/agent/templates/` — create custom template
- [x] `DELETE /api/agent/templates/{id}/` — delete custom template
- [x] `GET /api/agent/knowledge/` — list knowledge docs
- [x] `POST /api/agent/knowledge/` — create doc
- [x] `PATCH /api/agent/knowledge/{id}/` — update doc
- [x] `DELETE /api/agent/knowledge/{id}/` — delete doc (+ remove Vector DB embedding)

---

## Phase 8: Serializers

- [x] `AgentConfigSerializer` — all fields, personality_presets (computed from spec table)
- [x] `AgentSessionSerializer` — all fields, nested niche_context (id+name), message_count, current progress
- [x] `AgentMessageSerializer` — all fields, agent display_name + avatar_emoji resolved from AgentConfig
- [x] `AgentActionLogSerializer` — all fields, target object summary
- [x] `ToolPermissionSerializer` — tool_name, permission_level, tool description (computed)
- [x] `AutonomyPresetSerializer` — name, is_system, permissions map
- [x] `KnowledgeDocSerializer` — all fields
- [x] `WorkflowTemplateSerializer` — all fields, steps with descriptions

---

## Phase 9: Frontend — State & Services

- [x] RTK Query `agentApi` slice (`store/agentSlice.ts`): createSession, batchCreate, listSessions, getSession, sendMessage, pause/resume/stop, share/unshare, approve/reject, getConfig, updateConfig, getPermissions, updatePermissions, listPresets, createPreset, activatePreset, deletePreset, listTemplates, createTemplate, deleteTemplate, listKnowledge, createKnowledge, updateKnowledge, deleteKnowledge
- [x] Cache tags: `AgentSessions`, `AgentMessages`, `AgentConfig`, `Permissions`, `Presets`, `Templates`, `Knowledge` (+ `AgentDashboard`)
- [x] Register slice in `store/index.ts`
- [x] TypeScript types: AgentConfig, AgentSession, AgentMessage, AgentActionLog, ToolPermission, AutonomyPreset, KnowledgeDoc, WorkflowTemplate, AgentType, SessionStatus

---

## Phase 10: Frontend — Agent Tab (Command Center)

- [x] AC-49: Agent tab as 3rd segment in MultiPurposeDrawer: `[📋 Niche] [💬 Chat] [🤖 Agent]`
- [x] AC-50: Resizable drawer — drag handle. Default 480px. 3 responsive breakpoints (480/768/1200px) (reuses existing PROJ-17 drawer resize)
- [x] `AgentHeader.tsx`: AC-54 — budget indicator (LinearProgress), autonomy preset chip, niche context chip (X to remove), Pause/Resume/Stop buttons
- [x] AC-43: Pause/Resume/Stop button **visibility logic** — only render in header when `session.status` is `running` or `paused`; hide when `idle`, `completed`, `failed`, or `cancelled`
- [x] `WorkflowStepper.tsx`: AC-51 — MUI Stepper showing template steps. Active highlighted, completed checkmark, failed red
- [x] `AgentLog.tsx`: AC-52 — scrollable message list. Different styles per role. Sub-agent delegation visible ("🤖 Chief delegiert an 🎨 Pixel...")
- [x] `AgentMessageBubble.tsx`: avatar_emoji + display_name as sender. Agent messages, user commands, system messages styled differently
- [x] `ApprovalCard.tsx`: AC-53 — inline card: action description, estimated cost, target object, Approve (primary) + Reject (outlined)
- [x] `QuickActionBar.tsx`: AC-55 — template buttons for one-click workflow start. Visible when no workflow running
- [x] `BatchView.tsx`: AC-56 — niche list with individual progress indicators
- [x] `CollisionWarning.tsx`: MUI Dialog — "User X is working on this niche. Continue anyway?"
- [x] `OnboardingBanner.tsx`: AC-57 — first-time banner, dismissable. Links to guided setup
- [x] EC-10: 200+ messages → paginate (latest 50, "Load more")

---

## Phase 11: Frontend — Agent Settings

- [x] AC-55b: `AgentSettingsPage.tsx`: per-agent — editable display_name, personality textarea, avatar_emoji picker, model_name selector
- [x] AC-55c: Agent-Tab header shows Orchestrator avatar + name. Sub-agent messages show their own
- [x] AC-55d: Delegation uses personalized names
- [x] AC-55e: `PersonalityPresets.tsx`: clickable preset chips above textarea. Click populates, user edits freely. Presets from spec table (13 presets across 7 agent types)
- [x] AC-55f: Default names seeded: Chief 🤖, Scout 🔬, Muse 💡, Pixel 🎨, Scribe ✍️, Launch 🚀, Radar 🔍
- [x] `PermissionEditor.tsx`: AC-20 — tool permission table. Per-tool: Auto/Notify/Approve toggle
- [x] `PresetSelector.tsx`: AC-21 — dropdown with 3 system + custom presets. Activate = bulk-update permissions
- [x] `KnowledgeDocList.tsx`: AC-28 — CRUD list. Markdown preview
- [x] `TemplateEditor.tsx`: AC-25 — custom template builder. Ordered step list (drag-to-reorder), agent_type + action per step
- [x] AC-58: Guided setup flow (optional, 3 steps): choose autonomy → select niche → quick knowledge doc. Skippable
- [x] AC-59: Agent usable immediately without onboarding — all defaults pre-configured

---

## Phase 12: Frontend — Team Visibility

- [x] AC-60: Sessions private by default. "Share" button per session
- [x] AC-61: Shared sessions read-only for non-owners (can view, can't command/approve/stop)
- [x] AC-62: Shared badge in session list: "Shared by {username}"

---

## Phase 13: Dashboard Integration (PROJ-12)

- [ ] AC-63: **Agent Activity widget** on dashboard — surfaces: active workflows count, last completed workflow, total agent actions this week, budget usage percentage. New widget under Dashboard "Agent Activity" card; replaces the "Agent not set up" placeholder when an agent has run at least once.
- [x] AC-63: Backend aggregation endpoint `GET /api/agent/dashboard/summary/` (or extend existing PROJ-12 dashboard endpoint) — returns `{active_count, last_completed: {session_id, title, completed_at}, weekly_actions, budget_pct}`. Workspace-scoped, cached 60s.
- [ ] AC-64: **Activity Feed events** — agent emits feed entries on key transitions: session started ("Agent started Full Pipeline for {niche}"), batch completion ("Agent generated 10 slogans for {niche}"), approval pending ("Agent awaiting approval: {action}"). Hook into existing PROJ-12 ActivityFeed model + serializer (see PROJ-12 spec).
- [x] AC-64: Activity-feed events written via signal on `AgentSession.status` change + on `AgentActionLog.status='awaiting_approval'`. Render with agent emoji + display_name (consistent with AgentLog).

---

## Phase 14: Self-Improvement Layer (Metis-Pattern)

### 14.1 Backend — New Models

- [x] AC-65: `Skill` model — UUID pk, `workspace` FK CASCADE (workspace-scoped, **no cross-workspace sharing in MVP**), `name` CharField(200), `description` TextField, `content_md` TextField, `version` IntegerField default=1, `trigger_type` choices [auto_complex_task / auto_error_recovery / user_correction / manual], `applicable_agent_types` JSONField (list of agent_type values), `success_count` + `error_count` IntegerField default=0, `last_used_at` (nullable), `created_by_session` FK (AgentSession SET_NULL), `created_by` FK (User), `deleted_at` (nullable, for soft delete), timestamps. Indexes: `(workspace, applicable_agent_types)` GIN, `(workspace, deleted_at)` partial.
- [x] `SkillVersion` model — UUID pk, `skill` FK CASCADE, `version` IntegerField, `content_md` TextField (frozen snapshot), `patch_summary` TextField (1-2 sentence why), `created_at`. unique_together (skill, version). Append-only — supports rollback + audit (Decision #30).
- [x] AC-66: `WorkspaceMemory` model — UUID pk, `workspace` OneToOneField CASCADE (singleton per workspace), `content_md` TextField with `MaxLengthValidator(2200)` AND `max_length=2200` DB constraint, `last_consolidated_at` (nullable), `last_consolidated_session` FK (AgentSession SET_NULL), timestamps. **Hard char-limit is load-bearing** — forces consolidation (AC-69) to evict old entries; without enforcement the Metis-style emergent prioritization fails.
- [x] AC-67: `UserProfile` model — UUID pk, `workspace` FK, `user` FK, `content_md` TextField with `MaxLengthValidator(1375)`, `dialect_reasoning` TextField (unbounded scratchpad), `last_dialectic_at` (nullable), `dialect_cadence_sessions` IntegerField default=2 (range 1-5), `created_at`, `updated_at`. unique_together `(workspace, user)`.
- [x] AC-75: `AgentWorkspaceConfig` model — UUID pk, `workspace` OneToOneField, `reflection_cadence_sessions` IntegerField default=1, `skill_creation_min_tool_calls` IntegerField default=5, `memory_char_limit` IntegerField default=2200 (range 1500-4000), `profile_char_limit` IntegerField default=1375 (range 1000-2500), timestamps. Editable in Settings UI by workspace admin only.
- [x] Migration `0005_self_improvement_layer.py` — additive, no defaults requiring backfill (defaults seeded lazily on first reflection)
- [x] Admin: register Skill, SkillVersion, WorkspaceMemory, UserProfile, AgentWorkspaceConfig
- [x] Vector DB hookup (PROJ-15): `Skill.post_save` signal embeds `name + description + content_md` so `find_relevant_skills()` works via similarity search. `Skill.post_delete` (or soft-delete) removes embedding.

### 14.2 Backend — Services

- [x] AC-68: `services/skill_manager.py`:
  - [x] `find_relevant_skills(agent_type, task_description, k=3, max_chars_each=1500)` — Vector DB similarity, filtered by `applicable_agent_types` and `deleted_at IS NULL`
  - [x] `create_skill(workspace, agent_type, name, description, content_md, trigger_type, created_by_session)` — embeds in Vector DB, version=1
  - [x] `patch_skill(skill_id, patch_md, expected_version)` — optimistic concurrency (raises `VersionConflict` on mismatch — EC-19), bumps version, snapshots prior into `SkillVersion`
  - [x] `record_skill_outcome(skill_id, success: bool)` — increments success_count or error_count + updates last_used_at
  - [x] `soft_delete_skill(skill_id)` — sets `deleted_at`, removes Vector DB embedding (EC-22)
- [x] AC-69: `services/reflection_service.py`:
  - [x] `should_reflect(workspace)` — returns True if `completed_sessions_since_last_reflection >= cadence`
  - [x] `run_reflection(session_id)` — django-rq job. Wraps in `transaction.atomic()` (EC-21). Steps: (a) summarize session via reflection_agent LLM call, (b) propose memory update with hard char-limit enforcement (compress/evict if over — EC-18), (c) extract Skill candidates per AC-71, (d) trigger user-profile dialectic (AC-70).
  - [x] Trigger: `post_save` signal on `AgentSession` when status transitions to `completed` → enqueue `run_reflection` job if `should_reflect()`.
  - [x] Retry once after 5 min on failure; on second failure, log to AgentActionLog status=failed.
- [x] AC-70: `services/user_profile_service.py`:
  - [x] `run_dialectic(workspace, user, session_id)` — 3-pass: (1) initial assessment, (2) self-audit for gaps, (3) reconciliation pass against current `content_md` (EC-20). Updates `content_md` (max 1375 chars validator-enforced) + appends to `dialect_reasoning`.
  - [x] Cadence: per `UserProfile.dialect_cadence_sessions` (default 2, range 1-5)
- [x] AC-71: Skill auto-creation rules implemented in `reflection_service`:
  - [x] Trigger A: session completed with `tool_call_count > skill_creation_min_tool_calls` (default 5) AND zero errors → trigger_type=`auto_complex_task`
  - [x] Trigger B: session recovered after RetryPolicy fired but final status=completed → trigger_type=`auto_error_recovery`
  - [x] Trigger C: user explicitly corrected agent (approval_response with rejection + follow-up content) → trigger_type=`user_correction`
- [x] AC-72: Skill iterative improvement — when a Skill loaded into context (via `find_relevant_skills`) results in error, `skill_refiner_agent` runs as sub-agent producing `patch_md`, then `skill_manager.patch_skill()` applied (Decision #30).
- [x] AC-73: **Sub-Agent return-value filter** — Orchestrator state schema only persists `final_result` from each delegate call; `intermediate_steps` field is dropped before next turn (still saved as AgentMessage rows for UI). Token savings target: 70%+ on multi-step pipelines.
- [x] AC-74: Update `services/knowledge_loader.py` to load **6 layers**: Prompt + KnowledgeDocs (top 5) + Implicit (top 5) + WorkspaceMemory verbatim + UserProfile verbatim + Skills (top 3). Total budget cap 12k tokens; truncate Skills first if over.

### 14.3 Backend — Sub-Agents

- [x] `agents/reflection_agent.py` — `create_react_agent()` graph dedicated to summarizing sessions + proposing memory updates + extracting skill candidates. Tools: read AgentSession + AgentMessage (read-only), write WorkspaceMemory, create Skill.
- [x] `agents/skill_refiner_agent.py` — `create_react_agent()` for AC-72 patch-step. Tools: read SkillVersion history, propose patch_md.

### 14.4 Backend — API

- [x] `GET /api/agent/skills/` — list workspace skills, filter by `agent_type`, `trigger_type`. Excludes soft-deleted by default; `?include_deleted=true` for admin
- [x] `POST /api/agent/skills/` — manual create (trigger_type=manual). Workspace admin only.
- [x] `GET /api/agent/skills/{id}/` — detail + current version
- [x] `PATCH /api/agent/skills/{id}/` — manual edit. Body: `{patch_md, expected_version}`. Returns 409 on conflict (EC-19)
- [x] `DELETE /api/agent/skills/{id}/` — soft delete (EC-22)
- [x] `GET /api/agent/skills/{id}/versions/` — list `SkillVersion` snapshots (newest first)
- [x] `GET /api/agent/memory/` — fetch workspace's singleton memory
- [x] `PATCH /api/agent/memory/` — manual edit. Char-limit enforced server-side (400 with structured error if over)
- [x] `GET /api/agent/profile/` — caller's UserProfile in this workspace
- [x] `PATCH /api/agent/profile/` — manual edit. Char-limit enforced
- [x] `GET /api/agent/workspace-config/` — admin only — read AgentWorkspaceConfig
- [x] `PATCH /api/agent/workspace-config/` — admin only — update cadence + char limits (with bounds validation)
- [x] `POST /api/agent/sessions/{id}/reflect/` — manual reflection trigger (member, only on own/shared completed sessions)

### 14.5 Backend — Serializers

- [x] `SkillSerializer` — all fields + `version_count` (computed) + `is_active` (computed: `deleted_at IS NULL`)
- [x] `SkillVersionSerializer` — version, content_md, patch_summary, created_at
- [x] `WorkspaceMemorySerializer` — content_md, last_consolidated_at, char_count (computed), char_limit (from AgentWorkspaceConfig)
- [x] `UserProfileSerializer` — content_md, char_count, char_limit, dialect_cadence_sessions; `dialect_reasoning` only on `?include_reasoning=true`
- [x] `AgentWorkspaceConfigSerializer` — all fields with bounds validators

### 14.6 Frontend — Skills + Memory + Profile UI

- [ ] AC-76: Add 3 new tabs to `AgentSettingsPage`: `[Agent | Permissions | Knowledge | Templates | Skills | Memory | Profile]`. Tabs scrollable on narrow drawer width.
- [ ] AC-76: `SkillList.tsx` — table with name, description (truncated 80 chars), applicable-agents chips, trigger_type colored badge, success/error counts, version, last_used_at. "View versions" link → `SkillVersionTimeline.tsx`.
- [ ] AC-77: `SkillDetail.tsx` — full Markdown render of `content_md` (read-only), edit-button → `SkillEditor.tsx` Markdown editor with patch-or-replace toggle. Version history (collapsible per-version diff).
- [ ] AC-77: `SkillEditor.tsx` — react-markdown editor (or simple textarea + preview), patch-or-replace toggle, save sends PATCH with `expected_version`. Handles 409 with snackbar "Skill was updated by reflection — reload?".
- [ ] AC-78: `MemoryEditor.tsx` — single textarea showing `WorkspaceMemory.content_md`, **live char-counter** (`{count} / 2200`), color-coded (>1900 yellow, >2100 red). Save button disabled when over limit. Read-only by default; "Edit memory" toggle to enter edit mode (discourages casual edits).
- [ ] AC-79: `UserProfileEditor.tsx` — editable Markdown textarea (max 1375 chars, char-counter, color-coded). Below: collapsible "Dialect reasoning" section read-only — shows last `dialect_reasoning` so user can see WHY the agent inferred what it did. "Reset profile" button with confirm dialog.
- [ ] AC-80: `ReflectionStatus.tsx` — small inline component in `AgentHeader` — "Last reflection: {timeAgo}" + (when cadence > 1) "Sessions until next: {N}". Click → opens Memory tab with last-consolidation diff highlighted (uses `WorkspaceMemory.last_consolidated_session`).
- [ ] RTK Query slice extensions in `agentSlice.ts`: `listSkills`, `getSkill`, `createSkill`, `patchSkill`, `deleteSkill`, `getSkillVersions`, `getMemory`, `patchMemory`, `getProfile`, `patchProfile`, `getWorkspaceConfig`, `patchWorkspaceConfig`, `triggerReflection`. New cache tags: `Skills`, `SkillVersions`, `Memory`, `Profile`, `WorkspaceConfig`.

### 14.7 Frontend — Edge-case handling

- [ ] EC-19: Skill PATCH 409 handler — show snackbar "Skill was updated by reflection — reload to see latest", offer reload button. Do NOT auto-merge (manual user decision).
- [ ] EC-22: `SkillList` filters out `deleted_at != null` by default. Admin toggle "Show deleted" switches view; deleted skills shown grayed-out with "View versions" still accessible.

### 14.8 Tests

- [x] Backend: Skill CRUD + soft delete + Vector DB embedding lifecycle
- [x] Backend: WorkspaceMemory char-limit enforcement at validator + DB level (insertion >2200 chars rejected)
- [x] Backend: UserProfile char-limit + dialectic 3-pass logic produces consistent updates
- [x] Backend: AC-71 — auto-creation triggers fire correctly for each of A/B/C
- [x] Backend: AC-72 — patch_skill applies, bumps version, creates SkillVersion snapshot
- [x] Backend: AC-73 — Sub-Agent return filter — verify Orchestrator state does NOT contain intermediate steps after a delegate call
- [x] Backend: EC-18 — char-limit hit during reflection → eviction logic runs and stays under limit
- [x] Backend: EC-19 — version conflict → 409 raised, retry logic works
- [x] Backend: EC-20 — contradiction in profile → reconciliation produces coherent update
- [x] Backend: EC-21 — reflection failure → atomic rollback, retry-once
- [x] Backend: EC-22 — soft-delete excludes from `find_relevant_skills` but versions remain
- [x] Backend: EC-23 — fresh workspace operates without 3 new layers (graceful absence)
- [ ] Frontend: SkillList renders, filters, navigates to detail
- [ ] Frontend: MemoryEditor blocks save over char limit, color-codes correctly
- [ ] Frontend: UserProfileEditor + dialect reasoning collapse works
- [ ] Frontend: ReflectionStatus polling updates after a session completes

---

## Phase 15: i18n

> **Single source of truth for all PROJ-18 i18n keys.** Metis-Pattern keys (skills/memory/profile/reflection) absorbed here from former Phase 14.9.

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
- [ ] `agent.skills.*` — list/detail/edit labels, trigger_type names, version-history (Metis Phase 14)
- [ ] `agent.memory.*` — char-counter label, char-limit-warning, edit-mode toggle (Metis Phase 14)
- [ ] `agent.profile.*` — profile editor, dialect-reasoning, reset-confirm (Metis Phase 14)
- [ ] `agent.reflection.*` — last-reflection-time, sessions-until-next, manual-trigger (Metis Phase 14)
- [ ] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 16: Tests

### 16.1 Backend

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

### 16.2 Frontend

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

### 16.3 Edge Cases

- [ ] EC-1: Worker crash → resume from checkpoint + notification
- [ ] EC-2: OpenRouter 402 → pause + "budget exhausted" message
- [ ] EC-3: Tool call fails → retry 1x, then fallback or ask user
- [ ] EC-4: Two users on same niche → collision warning, user confirms
- [ ] EC-5: Preset switch while running → applies to next tool call
- [ ] EC-6: Design generation triggered without approved slogan → agent informs user "No approved slogans for this niche. Run Ideation first?" (Orchestrator pre-flight check + suggestion message)
- [ ] EC-7: Listing creation triggered without approved design → proceed with text-only listing (PROJ-11 allows). Notify user: "No design available, created text-only listing."
- [ ] EC-8: Batch: one niche fails → continues others, summary at end
- [ ] EC-9: KnowledgeDoc deleted → embedding removed from Vector DB (post_delete signal calls vector_app delete by source_id). Future agent decisions no longer influenced.
- [ ] EC-11: Parallel batch — each AgentSession gets its own LangGraph `thread_id` + Checkpointer state. Verify no Redux/Channel cross-contamination across 5 concurrent sessions.
- [ ] EC-12: User sends command while agent is mid-tool — command queued in `AgentMessage` (role=user) with `processed=False`; consumed by Orchestrator after current tool completes.
- [ ] EC-13: Paused 24+ hours → resume still works (state in DB)
- [ ] EC-14: Custom workflow template with invalid step sequence (Design before Research) → Orchestrator detects missing prerequisites at template-load time, sends correction-suggestion message, refuses to start until user fixes or confirms override.
- [ ] EC-15: Sub-Agent call exceeds 10 min timeout → Orchestrator catches `TimeoutError`, logs to `AgentActionLog.status='failed'`, decides per `error_config`: skip step / ask user / stop workflow.
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
- [ ] Dashboard widgets: Agent Activity card surfaces active workflows + budget; Activity Feed receives agent events
- [ ] **Self-Improvement Layer:** Skills auto-created after >5 tool calls / error recovery / user correction; WorkspaceMemory + UserProfile char-limits enforced (2200 / 1375); reflection runs after every N session(s) per workspace cadence
- [ ] **Skill versioning:** patch-or-replace works, SkillVersion snapshots immutable, soft-delete preserves history
- [ ] **Sub-Agent return filter:** Orchestrator state contains only final results (token usage <30% of unfiltered baseline on multi-step pipelines)
- [ ] **6-layer context loading:** Prompt + Docs + Implicit + Memory + Profile + Skills, total under 12k tokens
- [ ] worker-agent runs independently (60min timeout)
- [ ] All tests pass, lint clean
