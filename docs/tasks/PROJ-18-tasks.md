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
- [ ] EC-9: post_delete signal on `KnowledgeDoc` → call `vector_app.delete_embedding(source_type='knowledge_doc', source_id=instance.id)` so future agent decisions aren't influenced by deleted docs
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
- [ ] EC-7: `generate_listing` tool falls back to text-only when no approved design exists for the niche; emits an `AgentMessage` notifying the user "No design available, created text-only listing."
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
- [ ] EC-6: Orchestrator pre-flight check before delegating to Design Agent — if niche has zero approved slogans, send suggestion message ("No approved slogans for this niche. Run Ideation first?") and pause workflow until user confirms.
- [ ] EC-15: Per-sub-agent timeout (default 10 min, configurable via `AGENT_SUBAGENT_TIMEOUT_SEC` env). Orchestrator wraps each delegate call with `asyncio.wait_for`; on timeout → log `AgentActionLog.status='failed'` + branch on per-tool `error_config` (skip / ask user / stop).

---

## Phase 4: Backend Services

- [ ] AC-18: `services/permission_checker.py`: before tool execution → check `ToolPermission`. Auto → execute. Notify → execute + create Notification. Approve → pause workflow, create approval_request AgentMessage, wait
- [ ] AC-19: Default permissions seeded on first agent use (Auto/Notify/Approve per tool as specified in spec)
- [ ] AC-20: Permission override via Agent Settings API
- [ ] AC-21: Autonomy preset activation bulk-updates all ToolPermission rows
- [ ] AC-22: Approval requests persisted as `AgentMessage` with `role=approval_request` — content includes action description (tool + target object summary) and estimated cost; consumed by frontend ApprovalCard (AC-53)
- [ ] AC-23: Approval wait unbounded — agent pauses indefinitely until user responds
- [ ] AC-27: `services/knowledge_loader.py` Layer 1 — system prompt + personality injection from `AgentConfig`
- [ ] AC-28: Layer 2 — Knowledge Docs via Vector Search (top 5 by relevance)
- [ ] AC-29: Layer 3 — Implicit Learning. Before each decision agent queries Vector DB for past approvals/rejections + similar workflow outcomes + user feedback patterns on similar niches/designs/slogans
- [ ] AC-30: Before each sub-agent executes: load all 3 layers into context (Layer 1 + top 5 Layer 2 docs + top 5 Layer 3 experiences)
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
- [ ] EC-12: User commands sent during active tool execution are persisted as `AgentMessage(role=user, processed=False)` and dequeued by Orchestrator after the current tool completes — never lost, never interrupting.
- [ ] EC-14: `WorkflowTemplate.steps` validation (model `clean()` + serializer `validate_steps()`) — detect missing prerequisites (e.g. Design before Research/Ideation) and return 400 with a structured error explaining the missing step. Orchestrator double-checks at template-load time and refuses to start until user confirms an override.

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

### 7.1 Session CRUD + Controls
- [ ] AC-48: `POST /api/agent/sessions/` — start session (optional: workflow_template, niche_context)
- [ ] `POST /api/agent/sessions/batch/` — batch start
- [ ] `GET /api/agent/sessions/` — list user's sessions
- [ ] `GET /api/agent/sessions/{id}/` — detail + messages + progress
- [ ] `POST /api/agent/sessions/{id}/messages/` — send command
- [ ] `POST /api/agent/sessions/{id}/pause/` / `resume/` / `stop/`
- [ ] `POST /api/agent/sessions/{id}/share/` / `unshare/`
- [ ] `POST /api/agent/sessions/{id}/approve/{action_log_id}/` — approve pending action
- [ ] `POST /api/agent/sessions/{id}/reject/{action_log_id}/` — reject pending action

### 7.2 Config + Permissions
- [ ] `GET /api/agent/config/` — get all AgentConfigs for workspace
- [ ] `PATCH /api/agent/config/{agent_type}/` — update config (name, personality, avatar, model, temp). System prompt: Admin only
- [ ] `GET /api/agent/permissions/` — get user's tool permissions
- [ ] `PATCH /api/agent/permissions/` — update permissions
- [ ] `GET /api/agent/presets/` — list presets
- [ ] `POST /api/agent/presets/` — create custom preset
- [ ] `POST /api/agent/presets/{id}/activate/` — activate (bulk-update permissions)
- [ ] `DELETE /api/agent/presets/{id}/` — delete custom preset

### 7.3 Templates + Knowledge
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
- [ ] AC-43: Pause/Resume/Stop button **visibility logic** — only render in header when `session.status` is `running` or `paused`; hide when `idle`, `completed`, `failed`, or `cancelled`
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

## Phase 13: Dashboard Integration (PROJ-12)

- [ ] AC-63: **Agent Activity widget** on dashboard — surfaces: active workflows count, last completed workflow, total agent actions this week, budget usage percentage. New widget under Dashboard "Agent Activity" card; replaces the "Agent not set up" placeholder when an agent has run at least once.
- [ ] AC-63: Backend aggregation endpoint `GET /api/agent/dashboard/summary/` (or extend existing PROJ-12 dashboard endpoint) — returns `{active_count, last_completed: {session_id, title, completed_at}, weekly_actions, budget_pct}`. Workspace-scoped, cached 60s.
- [ ] AC-64: **Activity Feed events** — agent emits feed entries on key transitions: session started ("Agent started Full Pipeline for {niche}"), batch completion ("Agent generated 10 slogans for {niche}"), approval pending ("Agent awaiting approval: {action}"). Hook into existing PROJ-12 ActivityFeed model + serializer (see PROJ-12 spec).
- [ ] AC-64: Activity-feed events written via signal on `AgentSession.status` change + on `AgentActionLog.status='awaiting_approval'`. Render with agent emoji + display_name (consistent with AgentLog).

---

## Phase 14: Self-Improvement Layer (Metis-Pattern)

### 14.1 Backend — New Models

- [ ] AC-65: `Skill` model — UUID pk, `workspace` FK CASCADE (workspace-scoped, **no cross-workspace sharing in MVP**), `name` CharField(200), `description` TextField, `content_md` TextField, `version` IntegerField default=1, `trigger_type` choices [auto_complex_task / auto_error_recovery / user_correction / manual], `applicable_agent_types` JSONField (list of agent_type values), `success_count` + `error_count` IntegerField default=0, `last_used_at` (nullable), `created_by_session` FK (AgentSession SET_NULL), `created_by` FK (User), `deleted_at` (nullable, for soft delete), timestamps. Indexes: `(workspace, applicable_agent_types)` GIN, `(workspace, deleted_at)` partial.
- [ ] `SkillVersion` model — UUID pk, `skill` FK CASCADE, `version` IntegerField, `content_md` TextField (frozen snapshot), `patch_summary` TextField (1-2 sentence why), `created_at`. unique_together (skill, version). Append-only — supports rollback + audit (Decision #30).
- [ ] AC-66: `WorkspaceMemory` model — UUID pk, `workspace` OneToOneField CASCADE (singleton per workspace), `content_md` TextField with `MaxLengthValidator(2200)` AND `max_length=2200` DB constraint, `last_consolidated_at` (nullable), `last_consolidated_session` FK (AgentSession SET_NULL), timestamps. **Hard char-limit is load-bearing** — forces consolidation (AC-69) to evict old entries; without enforcement the Metis-style emergent prioritization fails.
- [ ] AC-67: `UserProfile` model — UUID pk, `workspace` FK, `user` FK, `content_md` TextField with `MaxLengthValidator(1375)`, `dialect_reasoning` TextField (unbounded scratchpad), `last_dialectic_at` (nullable), `dialect_cadence_sessions` IntegerField default=2 (range 1-5), `created_at`, `updated_at`. unique_together `(workspace, user)`.
- [ ] AC-75: `AgentWorkspaceConfig` model — UUID pk, `workspace` OneToOneField, `reflection_cadence_sessions` IntegerField default=1, `skill_creation_min_tool_calls` IntegerField default=5, `memory_char_limit` IntegerField default=2200 (range 1500-4000), `profile_char_limit` IntegerField default=1375 (range 1000-2500), timestamps. Editable in Settings UI by workspace admin only.
- [ ] Migration `0XXX_self_improvement_layer.py` — additive, no defaults requiring backfill (defaults seeded lazily on first reflection)
- [ ] Admin: register Skill, SkillVersion, WorkspaceMemory, UserProfile, AgentWorkspaceConfig
- [ ] Vector DB hookup (PROJ-15): `Skill.post_save` signal embeds `name + description + content_md` so `find_relevant_skills()` works via similarity search. `Skill.post_delete` (or soft-delete) removes embedding.

### 14.2 Backend — Services

- [ ] AC-68: `services/skill_manager.py`:
  - [ ] `find_relevant_skills(agent_type, task_description, k=3, max_chars_each=1500)` — Vector DB similarity, filtered by `applicable_agent_types` and `deleted_at IS NULL`
  - [ ] `create_skill(workspace, agent_type, name, description, content_md, trigger_type, created_by_session)` — embeds in Vector DB, version=1
  - [ ] `patch_skill(skill_id, patch_md, expected_version)` — optimistic concurrency (raises `VersionConflict` on mismatch — EC-19), bumps version, snapshots prior into `SkillVersion`
  - [ ] `record_skill_outcome(skill_id, success: bool)` — increments success_count or error_count + updates last_used_at
  - [ ] `soft_delete_skill(skill_id)` — sets `deleted_at`, removes Vector DB embedding (EC-22)
- [ ] AC-69: `services/reflection_service.py`:
  - [ ] `should_reflect(workspace)` — returns True if `completed_sessions_since_last_reflection >= cadence`
  - [ ] `run_reflection(session_id)` — django-rq job. Wraps in `transaction.atomic()` (EC-21). Steps: (a) summarize session via reflection_agent LLM call, (b) propose memory update with hard char-limit enforcement (compress/evict if over — EC-18), (c) extract Skill candidates per AC-71, (d) trigger user-profile dialectic (AC-70).
  - [ ] Trigger: `post_save` signal on `AgentSession` when status transitions to `completed` → enqueue `run_reflection` job if `should_reflect()`.
  - [ ] Retry once after 5 min on failure; on second failure, log to AgentActionLog status=failed.
- [ ] AC-70: `services/user_profile_service.py`:
  - [ ] `run_dialectic(workspace, user, session_id)` — 3-pass: (1) initial assessment, (2) self-audit for gaps, (3) reconciliation pass against current `content_md` (EC-20). Updates `content_md` (max 1375 chars validator-enforced) + appends to `dialect_reasoning`.
  - [ ] Cadence: per `UserProfile.dialect_cadence_sessions` (default 2, range 1-5)
- [ ] AC-71: Skill auto-creation rules implemented in `reflection_service`:
  - [ ] Trigger A: session completed with `tool_call_count > skill_creation_min_tool_calls` (default 5) AND zero errors → trigger_type=`auto_complex_task`
  - [ ] Trigger B: session recovered after RetryPolicy fired but final status=completed → trigger_type=`auto_error_recovery`
  - [ ] Trigger C: user explicitly corrected agent (approval_response with rejection + follow-up content) → trigger_type=`user_correction`
- [ ] AC-72: Skill iterative improvement — when a Skill loaded into context (via `find_relevant_skills`) results in error, `skill_refiner_agent` runs as sub-agent producing `patch_md`, then `skill_manager.patch_skill()` applied (Decision #30).
- [ ] AC-73: **Sub-Agent return-value filter** — Orchestrator state schema only persists `final_result` from each delegate call; `intermediate_steps` field is dropped before next turn (still saved as AgentMessage rows for UI). Token savings target: 70%+ on multi-step pipelines.
- [ ] AC-74: Update `services/knowledge_loader.py` to load **6 layers**: Prompt + KnowledgeDocs (top 5) + Implicit (top 5) + WorkspaceMemory verbatim + UserProfile verbatim + Skills (top 3). Total budget cap 12k tokens; truncate Skills first if over.

### 14.3 Backend — Sub-Agents

- [ ] `agents/reflection_agent.py` — `create_react_agent()` graph dedicated to summarizing sessions + proposing memory updates + extracting skill candidates. Tools: read AgentSession + AgentMessage (read-only), write WorkspaceMemory, create Skill.
- [ ] `agents/skill_refiner_agent.py` — `create_react_agent()` for AC-72 patch-step. Tools: read SkillVersion history, propose patch_md.

### 14.4 Backend — API

- [ ] `GET /api/agent/skills/` — list workspace skills, filter by `agent_type`, `trigger_type`. Excludes soft-deleted by default; `?include_deleted=true` for admin
- [ ] `POST /api/agent/skills/` — manual create (trigger_type=manual). Workspace admin only.
- [ ] `GET /api/agent/skills/{id}/` — detail + current version
- [ ] `PATCH /api/agent/skills/{id}/` — manual edit. Body: `{patch_md, expected_version}`. Returns 409 on conflict (EC-19)
- [ ] `DELETE /api/agent/skills/{id}/` — soft delete (EC-22)
- [ ] `GET /api/agent/skills/{id}/versions/` — list `SkillVersion` snapshots (newest first)
- [ ] `GET /api/agent/memory/` — fetch workspace's singleton memory
- [ ] `PATCH /api/agent/memory/` — manual edit. Char-limit enforced server-side (400 with structured error if over)
- [ ] `GET /api/agent/profile/` — caller's UserProfile in this workspace
- [ ] `PATCH /api/agent/profile/` — manual edit. Char-limit enforced
- [ ] `GET /api/agent/workspace-config/` — admin only — read AgentWorkspaceConfig
- [ ] `PATCH /api/agent/workspace-config/` — admin only — update cadence + char limits (with bounds validation)
- [ ] `POST /api/agent/sessions/{id}/reflect/` — manual reflection trigger (member, only on own/shared completed sessions)

### 14.5 Backend — Serializers

- [ ] `SkillSerializer` — all fields + `version_count` (computed) + `is_active` (computed: `deleted_at IS NULL`)
- [ ] `SkillVersionSerializer` — version, content_md, patch_summary, created_at
- [ ] `WorkspaceMemorySerializer` — content_md, last_consolidated_at, char_count (computed), char_limit (from AgentWorkspaceConfig)
- [ ] `UserProfileSerializer` — content_md, char_count, char_limit, dialect_cadence_sessions; `dialect_reasoning` only on `?include_reasoning=true`
- [ ] `AgentWorkspaceConfigSerializer` — all fields with bounds validators

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

- [ ] Backend: Skill CRUD + soft delete + Vector DB embedding lifecycle
- [ ] Backend: WorkspaceMemory char-limit enforcement at validator + DB level (insertion >2200 chars rejected)
- [ ] Backend: UserProfile char-limit + dialectic 3-pass logic produces consistent updates
- [ ] Backend: AC-71 — auto-creation triggers fire correctly for each of A/B/C
- [ ] Backend: AC-72 — patch_skill applies, bumps version, creates SkillVersion snapshot
- [ ] Backend: AC-73 — Sub-Agent return filter — verify Orchestrator state does NOT contain intermediate steps after a delegate call
- [ ] Backend: EC-18 — char-limit hit during reflection → eviction logic runs and stays under limit
- [ ] Backend: EC-19 — version conflict → 409 raised, retry logic works
- [ ] Backend: EC-20 — contradiction in profile → reconciliation produces coherent update
- [ ] Backend: EC-21 — reflection failure → atomic rollback, retry-once
- [ ] Backend: EC-22 — soft-delete excludes from `find_relevant_skills` but versions remain
- [ ] Backend: EC-23 — fresh workspace operates without 3 new layers (graceful absence)
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
