# PROJ-18: OpenClaw Agent (Multi-Agent System)

**Status:** In Progress
**Priority:** P0 (MVP)
**Created:** 2026-03-24
**Last Updated:** 2026-04-28 — Two updates:
> 1. Status synced with INDEX/PRD; Tasks file brought to 100% spec parity (AC-22, AC-29, AC-43, AC-63, AC-64; EC-6, EC-7, EC-9, EC-11, EC-12, EC-14, EC-15)
> 2. **Metis-Pattern Self-Improvement Layer** added — AC-65..80, EC-18..23, Decisions 25-32. New models: Skill, SkillVersion, WorkspaceMemory, UserProfile, AgentWorkspaceConfig. New services: skill_manager, reflection_service, user_profile_service. Inspired by [Nous Research's Hermes Agent](https://github.com/nousresearch/hermes-agent), adapted to multi-tenant Postgres.

## Overview

Autonomous multi-agent system that automates the full POD creative pipeline: Research → Slogan → Design → Kanban → Listing. Built on **LangGraph** runtime with architecture patterns inspired by **OpenClaw** (Skill Registry, Permission Gating, Elevation Control).

The system consists of an **Orchestrator Agent** that plans and delegates to **6 specialized Sub-Agents**, each with their own tool set, system prompt, and LLM model. All agents are sandboxed — they can only access registered internal tools (PROJ-5 through PROJ-17) and the Vector DB. No external access beyond registered APIs.

Communication happens through a dedicated **Agent tab** in the multi-purpose right drawer (shared with PROJ-5 Niche Detail and PROJ-17 Chat). The Agent tab is a **resizable Command Center** with workflow stepper, agent log, approval controls, and budget indicator.

**Pattern B Hybrid (per PROJ-17):** Agent workflows can also be triggered **directly from the Chat tab** via the Mode-Dropdown (`Auto / Web-Search / Agent`). When triggered from chat, an inline **WorkflowCard** appears in the chat stream with a mini-stepper, inline approval-cards, and a "→ Open Command Center" link to switch to the Agent tab for full control. The Agent tab remains the source of truth for batch operations, settings, knowledge docs, and full-detail logs.

A **3-layer knowledge system** enables the agent to improve over time: (1) System Prompt (base workflow rules), (2) Knowledge Docs (user-created explicit knowledge), (3) implicit learning from user approvals/rejections — all stored in DB + Vector DB (PROJ-15).

Cost control via a **separate OpenRouter API Key** with credit limit. No custom rate limiting — OpenRouter manages the budget.

## Multi-Agent Architecture

```
Orchestrator Agent (plans, delegates, coordinates)
├── Research Agent      — PROJ-5, 6, 7 Tools (Niche CRUD, Deep Research, Product Research)
├── Ideation Agent      — PROJ-8, 10 Tools (Slogan Generation, Adaptation, Keyword Bank)
├── Design Agent        — PROJ-9 Tools (Design Generation, Image Analysis, Batch Processing)
├── Listing Agent       — PROJ-11 Tools (Listing Generation, MBA Formatting)
├── Publishing Agent    — PROJ-13, 14 Tools (Upload Manager, Kanban Board)
└── Search Agent        — PROJ-15, 18 Tools (Vector DB Search, Web Search, Deep Crawl)
```

Each Sub-Agent: own System Prompt (~800 tokens) + own Tool set (4-6 tools) + own LLM model (configurable). Orchestrator: knows Sub-Agents capabilities (~1500 tokens), delegates via "call sub-agent" tools, doesn't know tool details.

**Cost benefit:** ~40-60% cheaper per workflow run vs. single agent (smaller prompts, focused tool sets).

## User Stories

1. As a member, I want to give the agent a single command like "Research Camping Dad", so the agent handles all research steps autonomously.
2. As a member, I want to start a full pipeline workflow for a niche, so the agent takes it from research to listing-ready with minimal intervention.
3. As a member, I want to choose from workflow templates (Full Pipeline, Research Only, etc.), so I can trigger common multi-step workflows with one click.
4. As a member, I want to approve or reject agent actions that cost money (design generation, research triggers), so I stay in control of spending.
5. As a member, I want to configure which actions need my approval and which run autonomously, so the agent matches my comfort level.
6. As a member, I want to teach the agent my preferences via Knowledge Docs or chat commands, so it makes better decisions over time.
7. As a member, I want the agent to learn from my approvals and rejections implicitly, so it adapts without me explicitly teaching it.
8. As a member, I want to see a live workflow progress stepper in the Agent tab, so I know which step the agent is on.
9. As a member, I want to pause, resume, or stop a running workflow, so I have full control at any time.
10. As a member, I want the agent to recover automatically after a server restart, so workflows aren't lost.
11. As a member, I want to set an autonomy preset (Supervised/Assisted/Autonomous), so I can quickly switch between control levels.
12. As a member, I want to run the agent on multiple niches in batch, so I can process my pipeline at scale.
13. As a member, I want the agent to warn me if another team member is already working on the same niche, so we don't duplicate effort.
14. As a member, I want to share my agent sessions with teammates, so they can see my workflow results.

## Acceptance Criteria

### Models

- [ ] AC-1: `AgentConfig` model: UUID pk, `workspace` FK, `agent_type` choices [orchestrator, research, ideation, design, listing, publishing, search], `display_name` (CharField 50 — user-customizable name, e.g. "Julian", "Rex", "Nova". Defaults: "Orchestrator", "Research Agent" etc.), `personality` (TextField, blank=True — custom personality description injected into system prompt, e.g. "Freundlich, direkt, nutzt Humor. Spricht den User mit Du an."), `avatar_emoji` (CharField 5, default per type — e.g. "🤖" for orchestrator, "🔬" for research, "🎨" for design), `model_name` (CharField 100 — OpenRouter model ID), `temperature` (FloatField, default 0.3), `system_prompt` (TextField), `max_tokens` (IntegerField, nullable), `updated_at`. One row per agent type per workspace. Editable via Admin + Agent Settings UI. Fallback to code defaults if no DB record.
- [ ] AC-2: `AgentSession` model: UUID pk, `workspace` FK, `created_by` FK (User), `title` (CharField 200, auto-generated), `status` choices [idle, running, paused, completed, failed, cancelled], `niche_context` FK (Niche, nullable), `workflow_template` (CharField 50, nullable — template key), `autonomy_preset` (CharField 20, default="assisted"), `is_shared` (BooleanField, default=False), `current_step` (CharField 100, blank=True), `total_steps` (IntegerField, default=0), `completed_steps` (IntegerField, default=0), `error_message` (TextField, blank=True), `source` choices [agent_tab, chat_command, batch_api] (default="agent_tab" — tracks where the session was triggered from for analytics + UI hints), `created_at`, `updated_at`, `completed_at` (nullable). **Note:** PROJ-17 `ChatMessage.agent_session` FK references this model — when triggered via chat, `source='chat_command'`.
- [ ] AC-3: `AgentMessage` model: UUID pk, `session` FK (AgentSession, on_delete=CASCADE), `role` choices [user, agent, system, approval_request, approval_response], `content` (TextField), `agent_type` (CharField 50, blank=True — which sub-agent sent this), `tool_calls` (JSONField, default=list — [{tool_name, args, result, status}]), `created_at`.
- [ ] AC-4: `AgentActionLog` model: UUID pk, `session` FK (AgentSession), `workspace` FK, `user` FK, `agent_type` (CharField 50), `action` (CharField 100 — tool name called), `target_object_type` (CharField 50, blank=True — e.g. "niche", "idea", "design"), `target_object_id` (UUID, nullable), `status` choices [started, completed, failed, skipped, awaiting_approval, approved, rejected], `cost_estimate` (DecimalField, nullable — estimated API cost), `error_message` (TextField, blank=True), `created_at`, `completed_at` (nullable).
- [ ] AC-5: `ToolPermission` model: UUID pk, `workspace` FK, `user` FK, `tool_name` (CharField 100), `permission_level` choices [auto, notify, approve], `updated_at`. `unique_together = [('workspace', 'user', 'tool_name')]`. Defaults seeded on first agent use.
- [ ] AC-6: `AutonomyPreset` model: UUID pk, `workspace` FK, `created_by` FK (User, nullable — null for system defaults), `name` (CharField 50), `is_system` (BooleanField, default=False), `permissions` (JSONField — {tool_name: permission_level} mapping), `created_at`. 3 system defaults: "Supervised" (all approve), "Assisted" (default mix), "Autonomous" (all auto except upload).
- [ ] AC-7: `KnowledgeDoc` model: UUID pk, `workspace` FK, `created_by` FK (User), `title` (CharField 200), `content` (TextField — Markdown), `source` choices [manual, chat_command, auto_extracted], `created_at`, `updated_at`. Embedded in Vector DB (PROJ-15) via post_save signal.
- [ ] AC-8: `WorkflowTemplate` model: UUID pk, `workspace` FK, `created_by` FK (User, nullable — null for system defaults), `name` (CharField 100), `key` (CharField 50, unique per workspace), `is_system` (BooleanField, default=False), `steps` (JSONField — ordered list of {agent_type, action, description}), `created_at`. 5 system defaults seeded per workspace.

### Multi-Agent System (Backend)

- [ ] AC-9: Orchestrator Agent implemented as LangGraph `StateGraph` with `create_react_agent()`. Has 6 "delegate" tools — one per Sub-Agent. Each delegate tool invokes the Sub-Agent's graph and returns its result.
- [ ] AC-10: Each Sub-Agent implemented as independent `create_react_agent()` with its own tool set, system prompt (from `AgentConfig`), and LLM model (from `AgentConfig`).
- [ ] AC-11: Sub-Agent tool registry — each Sub-Agent can ONLY call tools registered for its type. Research Agent cannot call Design tools. Enforced at LangGraph tool-binding level.

#### Sub-Agent Tool Sets

- [ ] AC-12: **Research Agent** tools: `create_niche`, `update_niche_status`, `read_niche_details`, `trigger_deep_research`, `read_research_results`, `trigger_product_research`, `read_product_results`, `find_similar_niches`.
- [ ] AC-13: **Ideation Agent** tools: `create_manual_idea`, `trigger_slogan_adaptation`, `read_adaptation_results`, `approve_reject_idea`, `read_keyword_bank`, `add_keyword`, `find_similar_ideas`.
- [ ] AC-14: **Design Agent** tools: `get_design_board_context`, `analyze_reference_image`, `generate_design`, `read_design_status`, `approve_reject_design`, `trigger_batch_processing`.
- [ ] AC-15: **Listing Agent** tools: `generate_listing`, `read_listing`, `update_listing`, `mark_listing_ready`, `export_listing`.
- [ ] AC-16: **Publishing Agent** tools: `create_upload_job`, `read_upload_status`, `update_kanban_status`, `read_kanban_board`.
- [ ] AC-17: **Search Agent** tools: `semantic_search`, `find_similar_content`, `web_search`, `deep_crawl`, `save_to_niche`, `save_knowledge`.

### Permission System (Backend)

- [ ] AC-18: Before executing any tool, agent checks `ToolPermission` for the requesting user + tool. `auto` → execute immediately. `notify` → execute + send notification to Agent-Tab. `approve` → pause workflow, send approval request, wait for user response.
- [ ] AC-19: Default tool permissions seeded on first agent use:

| Level | Tools |
|-------|-------|
| Auto | All read/search tools, keyword read, kanban read, vector search |
| Notify | create_niche, update_niche_status, add_keyword, update_kanban_status, create_manual_idea, approve_reject_idea |
| Approve | trigger_deep_research, trigger_product_research, trigger_slogan_adaptation, generate_design, generate_listing, create_upload_job, trigger_batch_processing |

- [ ] AC-20: User can override any tool's permission level via Agent Settings UI.
- [ ] AC-21: Autonomy Presets — switching preset bulk-updates all `ToolPermission` rows for that user. 3 system presets + user-created custom presets.
- [ ] AC-22: Approval requests appear as inline cards in Agent-Tab with "Approve" / "Reject" buttons + description of what the agent wants to do.
- [ ] AC-23: Approval wait is unbounded — agent pauses indefinitely until user responds. No timeout.

### Workflow Templates (Backend)

- [ ] AC-24: 5 system default templates seeded per workspace:

| Key | Name | Steps |
|-----|------|-------|
| `full_pipeline` | Full Pipeline | Research → Ideation → Design → Listing → Publishing |
| `research_only` | Research Only | Deep Research + Product Research |
| `ideation` | Ideation | Slogan Generation + Adaptation |
| `design_sprint` | Design Sprint | Design Generation + Batch Processing |
| `listing_finalize` | Listing Finalize | Listing Generation + Keywords + Ready |

- [ ] AC-25: User can create custom templates via Agent Settings. Templates define ordered steps with agent_type + action.
- [ ] AC-26: `POST /api/agent/sessions/` with `workflow_template` key → Orchestrator follows the template steps. Without template → Orchestrator plans autonomously based on user command.

### Knowledge System (Backend)

- [ ] AC-27: **Layer 1 — System Prompt:** stored in `AgentConfig.system_prompt` per agent type. `personality` field is injected at the top of the system prompt at runtime: "Your name is {display_name}. {personality}". Editable via Admin + Agent Settings UI. Contains workflow rules, best practices, constraints.
- [ ] AC-28: **Layer 2 — Knowledge Docs:** `KnowledgeDoc` CRUD. User creates via Agent-Tab Knowledge UI or via chat command ("Merke dir: ..."). Agent calls `save_knowledge` tool to extract and store. All docs embedded in Vector DB (PROJ-15).
- [ ] AC-29: **Layer 3 — Implicit Learning:** Agent queries Vector DB before decisions — searches for past approvals/rejections, similar workflow outcomes, user feedback patterns on similar niches/designs/slogans.
- [ ] AC-30: Before each Sub-Agent executes, it loads: System Prompt (Layer 1) + top 5 relevant Knowledge Docs via Vector Search (Layer 2) + top 5 relevant past experiences via Vector Search (Layer 3) + active `WorkspaceMemory` content (Layer 4, AC-66) + caller's `UserProfile` (Layer 5, AC-67) + top 3 relevant Skills (Layer 6, AC-65).

### Self-Improvement Layer — Metis Pattern (Backend)

> **Named after Metis, Greek goddess of practical wisdom (mêtis = applied cunning intelligence across domains). Inspired by [Nous Research's Hermes Agent](https://github.com/nousresearch/hermes-agent).** The 3-layer Knowledge System above (Prompt + Docs + Implicit Vector Search) is **library-style** — unbounded, retrieved on demand. The Metis insight: a small **char-limited working memory** that the agent must actively curate creates emergent prioritization, and **auto-generated Skills** (procedural memory) compound expertise across sessions. We adopt the pattern but adapt it to multi-tenant Postgres.

- [ ] AC-65: **`Skill` model** — UUID pk, `workspace` FK (CASCADE, **workspace-scoped only — no cross-workspace sharing in MVP**), `name` (CharField 200), `description` (TextField, 1-2 sentences), `content_md` (TextField — the reusable prompt), `version` (IntegerField, default=1, bumped on each edit), `trigger_type` choices [`auto_complex_task`, `auto_error_recovery`, `user_correction`, `manual`], `applicable_agent_types` (JSONField, list of agent_type values), `success_count` + `error_count` (IntegerField, default=0 — tracked at use-time), `last_used_at` (nullable), `created_by_session` FK (AgentSession, SET_NULL), `created_by` FK (User), `created_at`, `updated_at`. Embedded in Vector DB on save (PROJ-15) for retrieval.
- [ ] AC-66: **`WorkspaceMemory` model** — UUID pk, `workspace` OneToOne FK (one row per workspace), `content_md` TextField with `MaxLengthValidator(2200)` enforced both at form/serializer level AND in DB constraint (`max_length=2200`). `last_consolidated_at` (nullable), `last_consolidated_session` FK (AgentSession, SET_NULL). The hard 2200-char limit is **load-bearing** — it forces the consolidation service (AC-69) to delete old entries to make room for new ones, which is the mechanism that creates curated working memory rather than unbounded log.
- [ ] AC-67: **`UserProfile` model** — UUID pk, `workspace` FK, `user` FK, `content_md` TextField with `MaxLengthValidator(1375)`, `dialect_reasoning` (TextField — the multi-pass dialectic state for next consolidation), `last_dialectic_at` (nullable), `dialect_cadence_sessions` (IntegerField, default=2, configurable 1-5 per user), `created_at`, `updated_at`. `unique_together = [('workspace', 'user')]`. Stored locally (no Honcho-SaaS dependency); algorithm follows Honcho's documented dialectic reasoning (initial assessment → self-audit for gaps → reconciliation pass for contradictions).
- [ ] AC-68: **`services/skill_manager.py`** — CRUD operations + `find_relevant_skills(agent_type, task_description, k=3)` via Vector DB similarity search + `record_skill_outcome(skill_id, success: bool)` to update success/error counters + `patch_skill(skill_id, patch_md)` for iterative improvement (bumps version, doesn't replace).
- [ ] AC-69: **`services/reflection_service.py`** — runs as django-rq job on `agent` queue. Triggered after each `AgentSession.status='completed'` IF the workspace has reached its `reflection_cadence_sessions` threshold (default 1 = after every session, configurable per workspace). Steps: (a) summarize session outcomes, (b) propose updates to `WorkspaceMemory.content_md` with hard char-limit enforcement (must delete or compress old entries to make room), (c) extract candidate Skills (see AC-71), (d) trigger `UserProfileService` dialectic update for the session-owner.
- [ ] AC-70: **`services/user_profile_service.py`** — Honcho-style dialectic. After each session (or every `dialect_cadence_sessions` for the user), runs 3-pass reasoning: (1) **initial assessment** — what does this session reveal about user style/priorities? (2) **self-audit** — gaps in current `UserProfile.content_md`? (3) **reconciliation** — contradictions with prior profile? Updates `content_md` (max 1375 chars) and `dialect_reasoning` (unbounded — internal scratchpad).
- [ ] AC-71: **Skill auto-creation rules.** A new Skill is proposed by the reflection service when ANY of: (a) session completed with **>5 tool calls** AND no errors, (b) session recovered from an error (i.e. RetryPolicy fired but final status=completed), (c) user explicitly corrected the agent (detected via approval_response with rejection + follow-up content). Created Skills are workspace-scoped, version=1, trigger_type set per rule.
- [ ] AC-72: **Skill iterative improvement.** When a Skill is loaded into context (via `find_relevant_skills`) and the resulting session ends in error, the reflection service runs a **patch step**: prompts a Skill-Refinement sub-agent to produce a `patch_md` that fixes the failure mode. `skill_manager.patch_skill()` applies and bumps version. Old versions are kept (immutable history) via separate `SkillVersion` snapshot model.
- [ ] AC-73: **Sub-Agent return-value filtering** (token-saving — Metis-style). When Orchestrator delegates to a Sub-Agent, only the Sub-Agent's **final result string** is appended to Orchestrator state — intermediate tool calls, reasoning steps, and partial outputs are persisted to `AgentMessage` rows (still visible in UI) but NOT loaded into Orchestrator's LLM context for the next turn. Saves ~70% of tokens on multi-step pipelines.
- [ ] AC-74: **Context loading order extended.** Pre-task assembly (replaces AC-30 single-pass): (1) System Prompt + Personality, (2) `WorkspaceMemory.content_md` verbatim (~800 tokens), (3) `UserProfile.content_md` for the requesting user (~500 tokens), (4) Top-3 Skills via Vector similarity to current task (limit per skill: 1500 chars), (5) Top-5 Knowledge Docs via Vector Search, (6) Top-5 Implicit Learning entries. Total Layer-1+2+3 budget kept under 12k tokens to preserve room for tool calls and LLM reasoning.
- [ ] AC-75: **Reflection cadence per workspace** — new `AgentWorkspaceConfig` settings row (or extend existing settings model): `reflection_cadence_sessions` (default 1), `skill_creation_min_tool_calls` (default 5), `memory_char_limit` (default 2200, configurable 1500-4000), `profile_char_limit` (default 1375, configurable 1000-2500). Editable in Agent Settings UI by workspace admin only.

### Batch Operations (Backend)

- [ ] AC-31: `POST /api/agent/sessions/batch/` — body: `{niche_ids: [...], workflow_template: "key", parallel: false}`. Creates one AgentSession per niche. Default: sequential execution.
- [ ] AC-32: Sequential mode: next niche starts after previous completes/fails. Parallel mode: all start simultaneously as separate django-rq jobs.
- [ ] AC-33: Batch progress visible in Agent-Tab: list of niches with individual status (pending/running/completed/failed).

### Collision Detection (Backend)

- [ ] AC-34: Before starting a workflow on a niche, Orchestrator checks for active AgentSessions on the same niche (status=running/paused). If found → agent sends warning message: "User {name} is already working on {niche}. Continue anyway?" Waits for user confirmation.
- [ ] AC-35: Collision check also covers manual user activity — if niche was updated in last 5 minutes by another user, same warning.

### Agent Execution (Backend)

- [ ] AC-36: Agent workflows run as django-rq jobs on a dedicated `agent` queue with 60-minute timeout.
- [ ] AC-37: PostgreSQL Checkpointer (same as PROJ-6) saves state after each Sub-Agent completion. On worker crash → resume from last checkpoint.
- [ ] AC-38: On resume after crash: Agent sends notification to Agent-Tab: "Workflow was interrupted and resumed at step {X}."
- [ ] AC-39: LangGraph Streaming Events forwarded to frontend via SSE or polling for real-time Agent-Tab updates.

### Agent Controls (Backend)

- [ ] AC-40: `POST /api/agent/sessions/{id}/pause/` — sets status=paused. Agent completes current tool call, then halts.
- [ ] AC-41: `POST /api/agent/sessions/{id}/resume/` — sets status=running. Agent continues from paused state.
- [ ] AC-42: `POST /api/agent/sessions/{id}/stop/` — sets status=cancelled. Agent completes current tool call, then stops. Already-created data persists.
- [ ] AC-43: Pause/Resume/Stop buttons visible in Agent-Tab header when a workflow is running.

### Rate Limiting (Backend)

- [ ] AC-44: Agent uses a separate OpenRouter API Key (`OPENROUTER_AGENT_API_KEY`). Credit limit managed in OpenRouter dashboard.
- [ ] AC-45: On 402 from OpenRouter (budget exhausted) → agent pauses workflow, sends message: "Agent budget exhausted. Please top up the agent API key."
- [ ] AC-46: Optional soft warning: when `AgentActionLog` estimated costs reach 80% of a configurable threshold (`AGENT_BUDGET_WARNING_THRESHOLD` env var), agent sends warning in Agent-Tab.
- [ ] AC-47: Every tool call logged in `AgentActionLog` with estimated cost for Dashboard visibility (PROJ-12).

### API Endpoints

- [ ] AC-48: Full API:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/agent/sessions/` | Member | Start agent session (optional: workflow_template, niche_context) |
| POST | `/api/agent/sessions/batch/` | Member | Batch start for multiple niches |
| GET | `/api/agent/sessions/` | Member | List user's sessions |
| GET | `/api/agent/sessions/{id}/` | Member | Session detail + messages + progress |
| POST | `/api/agent/sessions/{id}/messages/` | Member | Send command to agent |
| POST | `/api/agent/sessions/{id}/pause/` | Member | Pause workflow |
| POST | `/api/agent/sessions/{id}/resume/` | Member | Resume workflow |
| POST | `/api/agent/sessions/{id}/stop/` | Member | Stop workflow |
| POST | `/api/agent/sessions/{id}/share/` | Member | Share session with workspace |
| POST | `/api/agent/sessions/{id}/unshare/` | Member | Unshare session |
| POST | `/api/agent/sessions/{id}/approve/{action_log_id}/` | Member | Approve pending action |
| POST | `/api/agent/sessions/{id}/reject/{action_log_id}/` | Member | Reject pending action |
| GET | `/api/agent/config/` | Member | Get agent configs for workspace |
| PATCH | `/api/agent/config/{agent_type}/` | Member | Update agent config (name, personality, avatar, model, temp). System prompt: Admin only. |
| GET | `/api/agent/permissions/` | Member | Get user's tool permissions |
| PATCH | `/api/agent/permissions/` | Member | Update tool permissions |
| GET | `/api/agent/presets/` | Member | List autonomy presets |
| POST | `/api/agent/presets/` | Member | Create custom preset |
| POST | `/api/agent/presets/{id}/activate/` | Member | Activate preset (bulk-update permissions) |
| DELETE | `/api/agent/presets/{id}/` | Member | Delete custom preset |
| GET | `/api/agent/templates/` | Member | List workflow templates |
| POST | `/api/agent/templates/` | Member | Create custom template |
| DELETE | `/api/agent/templates/{id}/` | Member | Delete custom template |
| GET | `/api/agent/knowledge/` | Member | List knowledge docs |
| POST | `/api/agent/knowledge/` | Member | Create knowledge doc |
| PATCH | `/api/agent/knowledge/{id}/` | Member | Update knowledge doc |
| DELETE | `/api/agent/knowledge/{id}/` | Member | Delete knowledge doc |
| GET | `/api/agent/skills/` | Member | List skills (filter by `agent_type`, `trigger_type`) |
| POST | `/api/agent/skills/` | Member | Manually create skill (trigger_type=`manual`) |
| GET | `/api/agent/skills/{id}/` | Member | Skill detail + version history |
| PATCH | `/api/agent/skills/{id}/` | Member | Update skill — bumps version, snapshots prior |
| DELETE | `/api/agent/skills/{id}/` | Member | Delete skill (soft delete — versions retained) |
| GET | `/api/agent/skills/{id}/versions/` | Member | List `SkillVersion` snapshots |
| GET | `/api/agent/memory/` | Member | Get current workspace memory (singleton) |
| PATCH | `/api/agent/memory/` | Member | Manually edit `content_md` — char-limit enforced |
| GET | `/api/agent/profile/` | Member | Get caller's UserProfile in this workspace |
| PATCH | `/api/agent/profile/` | Member | Manually edit profile — char-limit enforced |
| GET | `/api/agent/workspace-config/` | Admin | Get reflection cadence + char-limits |
| PATCH | `/api/agent/workspace-config/` | Admin | Update reflection cadence + char-limits |
| POST | `/api/agent/sessions/{id}/reflect/` | Member | Manual trigger reflection on completed session |

### Agent Command Center (Frontend)

- [ ] AC-49: Agent tab in multi-purpose drawer as 3rd segment: `[📋 Niche] [💬 Chat] [🤖 Agent]`. Tab shows full Command Center; the Chat tab can render inline `WorkflowCard` components linked to AgentSessions (Pattern B Hybrid, see PROJ-17 AC-42–45).
- [ ] AC-50: Resizable drawer — drag handle on left edge. Default 480px. Responsive layout:
  - **480px (default):** Single-column — compact header (Budget + Autonomy Preset + Niche Chip) → Workflow Stepper → Agent Log → Chat Input + Controls (Pause/Resume/Stop)
  - **>768px:** Split View — left: Stepper + Status, right: Agent Log + Chat
  - **~1200px:** Full Command Center — all panels side by side

- [ ] AC-51: Workflow Stepper: MUI Stepper showing template steps. Active step highlighted. Completed steps with checkmark. Failed steps in red.
- [ ] AC-52: Agent Log: scrollable message list. Different visual styles per role — agent messages show `display_name` + `avatar_emoji` as sender (e.g. "🤖 Julian" or "🎨 Design Agent"), user commands (default), approval requests (warning color card with Approve/Reject buttons), system messages (muted). Sub-Agent delegation visible: "🤖 Julian nutzt 🎨 {Design Agent name}...".
- [ ] AC-53: Approval request cards inline in log: description of action, estimated cost, target object, "Approve" (primary) + "Reject" (outlined) buttons.
- [ ] AC-54: Header shows: Budget indicator (usage bar or percentage), active Autonomy Preset chip, Niche context chip (with X to remove), Pause/Resume/Stop buttons.
- [ ] AC-55: Quick-Action bar: Template buttons ("Full Pipeline", "Research Only" etc.) for one-click workflow start. Visible when no workflow is running.

### Agent Personalization (Frontend)

- [ ] AC-55b: Agent Settings page (accessible from Agent-Tab gear icon): per agent type — editable `display_name`, `personality` textarea (Freitext + Preset-Vorschläge), `avatar_emoji` picker, `model_name` selector (OpenRouter models).
- [ ] AC-55c: Agent-Tab header shows Orchestrator's `avatar_emoji` + `display_name` (e.g. "🤖 Julian"). Sub-Agent messages show their own name + emoji.
- [ ] AC-55d: Delegation messages use personalized names: "🤖 Julian delegiert an 🎨 Aria (Design)..." instead of generic "Orchestrator delegates to Design Agent".
- [ ] AC-55e: Personality Presets — clickable preset chips above the personality textarea. User clicks a preset to populate the field, then can edit freely. Presets per agent type:

| Agent | Preset Name | Personality Text |
|-------|------------|-----------------|
| Orchestrator | "Projektleiter" | "Strukturiert, klar, gibt kurze Status-Updates. Delegiert effizient und fasst Ergebnisse zusammen." |
| Orchestrator | "Creative Director" | "Enthusiastisch, visionär, denkt in Konzepten. Gibt kreative Impulse und motiviert das Team." |
| Orchestrator | "Minimalist" | "Extrem knapp, nur das Nötigste. Keine Floskeln, nur Fakten und Aktionen." |
| Research | "Analyst" | "Datengetrieben, nüchtern, liefert Fakten mit Quellen. Bewertet Niches objektiv." |
| Research | "Scout" | "Neugierig, entdeckerfreudig, begeistert sich für neue Trends. Liefert Kontext und Hintergrund." |
| Ideation | "Texter" | "Wortgewandt, spielt mit Sprache, liefert mehrere Varianten. Denkt in Zielgruppen." |
| Ideation | "Brainstormer" | "Schnell, assoziativ, unkonventionell. Quantität vor Qualität, filtert später." |
| Design | "Art Director" | "Visuell präzise, beschreibt Designs in Detail. Achtet auf Komposition und Farbharmonie." |
| Design | "Experimentator" | "Probiert ungewöhnliche Stile, mixt Ästhetiken. Liefert überraschende Ergebnisse." |
| Listing | "SEO-Profi" | "Keyword-fokussiert, optimiert für Rankings. Jedes Wort hat einen Zweck." |
| Listing | "Copywriter" | "Überzeugend, emotional, verkaufsstark. Schreibt Listings die konvertieren." |
| Publishing | "Koordinator" | "Checklisten-Typ, überprüft alles doppelt. Stellt sicher dass nichts fehlt." |
| Search | "Rechercheur" | "Gründlich, gräbt tief, findet auch obskure Quellen. Fasst kompakt zusammen." |

- [ ] AC-55f: Default names seeded per workspace on first agent use:

| Agent Type | Default Name | Default Emoji |
|-----------|-------------|--------------|
| Orchestrator | "Chief" | 🤖 |
| Research | "Scout" | 🔬 |
| Ideation | "Muse" | 💡 |
| Design | "Pixel" | 🎨 |
| Listing | "Scribe" | ✍️ |
| Publishing | "Launch" | 🚀 |
| Search | "Radar" | 🔍 |
- [ ] AC-56: Batch view: when batch operation running, show list of niches with individual progress indicators.

### Self-Improvement UI (Frontend)

- [ ] AC-76: **Skills tab in AgentSettingsPage** — new tab `[Agent | Permissions | Knowledge | Templates | Skills | Memory | Profile]`. Lists all `Skill` rows for the workspace with columns: name, description, applicable agents (chips), trigger_type badge, success_count / error_count, version, last_used_at, "View versions" link.
- [ ] AC-77: **Skill detail view** — full `content_md` rendered as syntax-highlighted Markdown (read-only), version history timeline (each version = collapsible diff vs prior), edit-button opens a Markdown editor with patch-or-replace toggle. Manual creation form for trigger_type=`manual`.
- [ ] AC-78: **Memory tab** — single textarea showing `WorkspaceMemory.content_md` with **live char-counter (X / 2200)**, color-coded warning (>1900 yellow, >2100 red). Save button blocked when over limit. Read-only by default; edit requires explicit "Edit memory" mode toggle to discourage casual edits.
- [ ] AC-79: **Profile tab** — caller's own `UserProfile.content_md` shown in editable Markdown textarea with char-counter (X / 1375). Below textarea: collapsible "Dialect reasoning" section (read-only, shows last `dialect_reasoning` for transparency — what did the agent infer?). "Reset profile" button with confirm.
- [ ] AC-80: **Reflection-status indicator** in AgentHeader — shows "Last reflection: {timeAgo}" + "Sessions until next: {N}" when workspace has cadence > 1. Click → opens Memory tab with last consolidation diff highlighted.

### Onboarding (Frontend)

- [ ] AC-57: First-time Agent tab open → optional onboarding banner: "Set up your agent — configure autonomy level and preferences". Dismissable. Links to guided setup.
- [ ] AC-58: Guided setup flow (optional): 3 steps — (1) Choose autonomy preset, (2) Select default niche to start with, (3) Quick knowledge doc: "Tell the agent your design preferences". Skippable at each step.
- [ ] AC-59: Agent usable immediately without onboarding — all defaults pre-configured.

### Team Visibility (Frontend)

- [ ] AC-60: Agent sessions private by default. "Share" button per session.
- [ ] AC-61: Shared sessions visible to workspace members (read-only). Only owner can send commands, approve/reject, pause/stop.
- [ ] AC-62: Shared session badge in session list: "Shared by {username}".

### Dashboard Integration (PROJ-12)

- [ ] AC-63: Agent Activity widget on dashboard: active workflows count, last completed workflow, total agent actions this week, budget usage percentage.
- [ ] AC-64: Agent events in Activity Feed: "Agent started Full Pipeline for Camping Dad", "Agent generated 10 slogans for Nurse Mom", "Agent awaiting approval: Design Generation".

## Edge Cases

- [ ] EC-1: Worker crashes mid-workflow → Checkpointer preserves state. On restart → resume from last completed Sub-Agent step. User notified.
- [ ] EC-2: OpenRouter 402 (budget exhausted) → agent pauses, informs user. Workflow resumable after budget top-up.
- [ ] EC-3: Sub-Agent tool call fails → Smart Retry (1x retry), then fallback (alternative approach if available), then Stop & Ask user. Configurable per tool.
- [ ] EC-4: Two users start agent on same niche → Collision Detection warns second user. User can confirm to proceed (both agents work independently).
- [ ] EC-5: User switches autonomy preset while workflow running → new preset applies to NEXT tool call, not retroactively.
- [ ] EC-6: Agent tries to generate design but no approved slogan exists → agent informs user: "No approved slogans for this niche. Run Ideation first?" Suggests next action.
- [ ] EC-7: Agent tries to create listing but no approved design → proceeds with slogan-only listing (PROJ-11 allows this). Notifies user: "No design available, created text-only listing."
- [ ] EC-8: Batch operation: one niche fails → continues with remaining niches. Failed niche logged with error. Summary shown at batch completion.
- [ ] EC-9: Knowledge Doc deleted → its embedding removed from Vector DB. Agent's future decisions no longer influenced by it.
- [ ] EC-10: Agent session with 200+ messages → paginate in Agent-Tab (latest 50, "Load more" button).
- [ ] EC-11: Parallel batch: 5 agents running simultaneously → each has its own LangGraph thread_id + Checkpointer state. No cross-contamination.
- [ ] EC-12: User sends command while agent is executing a tool → command queued, processed after current tool completes.
- [ ] EC-13: Agent paused for 24+ hours → resume still works (state in DB). No expiry on paused workflows.
- [ ] EC-14: Custom workflow template with invalid step sequence (e.g. Design before Research) → agent detects missing prerequisites, informs user, suggests correction.
- [ ] EC-15: Orchestrator's Sub-Agent call times out (>10 min for one Sub-Agent) → Orchestrator logs timeout, moves to next step or asks user depending on error config.
- [ ] EC-16: "Merke dir" chat command → agent extracts knowledge, creates KnowledgeDoc with source=chat_command, confirms: "Saved: {title}". Embedded in Vector DB.
- [ ] EC-17: No Knowledge Docs and no past experience (fresh workspace) → agent operates on System Prompt only. Performance improves as data accumulates.
- [ ] EC-18: **WorkspaceMemory char-limit hit during reflection.** Reflection service computes a candidate update that exceeds 2200 chars → it MUST first delete or compress old entries (LRU + relevance-weighted eviction) to make room. If still over after compression, abort the update, log warning, leave existing memory untouched.
- [ ] EC-19: **Skill version conflict** — two parallel sessions both trigger `patch_skill()` on the same Skill. Use optimistic concurrency: each PATCH includes `expected_version`, server returns 409 if mismatch → reflection service retries by re-reading and re-patching against new version.
- [ ] EC-20: **UserProfile dialectic produces contradiction** — initial assessment says "user prefers humor", reconciliation pass detects prior profile says "user prefers minimal/no humor". Resolution: weight recent evidence > old evidence, append a `dialect_reasoning` note explaining the shift, update `content_md` to reflect new state with timestamp marker.
- [ ] EC-21: **Reflection task fails mid-consolidation** (LLM timeout / 402 / disk-full) → wrap entire reflection in DB transaction; on any exception, rollback. `WorkspaceMemory` + `UserProfile` + new Skill rows must all commit atomically or none. Retry job once after 5 min; on second failure, log to `AgentActionLog` with status=failed and surface in UI as "Reflection skipped — will retry next session".
- [ ] EC-22: **Skill marked for deletion but referenced by `applicable_agent_types`** → soft-delete (set `deleted_at`), version-freeze (no further patches allowed), exclude from `find_relevant_skills()`. Old AgentMessage rows that reference the Skill keep working via the SkillVersion snapshot.
- [ ] EC-23: **Fresh workspace** — no Skills, empty WorkspaceMemory, empty UserProfile. Agent operates on Layer 1+2+3 only (existing 3-layer Knowledge System) and starts populating new layers from session 1 onwards. No degraded behavior — Metis layers are additive.

## Tech Design (Solution Architect)

> Decided: 2026-03-27 | Approved by user.

### A) Backend Architecture

**New Django app:** `agent_app`

```
agent_app/
├── models.py                           # AgentConfig, AgentSession, AgentMessage,
│                                       #   AgentActionLog, ToolPermission, AutonomyPreset,
│                                       #   KnowledgeDoc, WorkflowTemplate,
│                                       #   Skill, SkillVersion, WorkspaceMemory,
│                                       #   UserProfile, AgentWorkspaceConfig
├── api/
│   ├── views.py                        # Session CRUD, messages, controls (pause/resume/stop),
│   │                                   #   approval, config, permissions, presets, templates,
│   │                                   #   knowledge, skills, memory, profile, workspace-config
│   ├── serializers.py                  # All serializers
│   └── urls.py                         # URL routing
├── agents/
│   ├── orchestrator.py                 # Orchestrator StateGraph (delegates to sub-agents)
│   ├── research_agent.py               # Research Sub-Agent (PROJ-5/6/7 tools)
│   ├── ideation_agent.py               # Ideation Sub-Agent (PROJ-8/10 tools)
│   ├── design_agent.py                 # Design Sub-Agent (PROJ-9 tools)
│   ├── listing_agent.py                # Listing Sub-Agent (PROJ-11 tools)
│   ├── publishing_agent.py             # Publishing Sub-Agent (PROJ-13/14 tools)
│   ├── search_agent.py                 # Search Sub-Agent (PROJ-15/17 tools)
│   ├── reflection_agent.py             # Metis-pattern: post-session consolidation sub-agent
│   ├── skill_refiner_agent.py          # Metis-pattern: skill-patch sub-agent (on error)
│   └── tools/
│       ├── research_tools.py           # 8 tools: create_niche, trigger_deep_research, etc.
│       ├── ideation_tools.py           # 7 tools: create_idea, trigger_adaptation, etc.
│       ├── design_tools.py             # 6 tools: analyze_image, generate_design, etc.
│       ├── listing_tools.py            # 5 tools: generate_listing, update_listing, etc.
│       ├── publishing_tools.py         # 4 tools: create_upload_job, update_kanban, etc.
│       └── search_tools.py             # 6 tools: semantic_search, web_search, etc.
├── services/
│   ├── permission_checker.py           # Check ToolPermission before tool execution
│   ├── knowledge_loader.py             # Load 6 layers: prompt + docs + implicit + memory + profile + skills
│   ├── collision_detector.py           # Check for active sessions on same niche
│   ├── cost_tracker.py                 # Estimate + track costs per tool call
│   ├── skill_manager.py                # Metis: Skill CRUD + Vector retrieval + patch + outcome tracking
│   ├── reflection_service.py           # Metis: post-session consolidation (memory + skills)
│   └── user_profile_service.py         # Metis: dialectic user-modeling (3-pass)
├── tasks.py                            # django-rq: run_agent_workflow, batch, run_reflection
├── admin.py
└── tests/
```

**Registered in:** `core/settings.py` INSTALLED_APPS, `core/urls.py`

---

### B) Frontend Architecture

**Agent tab** in multi-purpose drawer (3rd segment, shared with PROJ-5 + PROJ-17):

```
components/MultiPurposeDrawer/panels/
└── AgentPanel/
    ├── index.tsx                        # Agent tab content
    ├── hooks/
    │   ├── useAgentSession.ts          # Session CRUD + polling
    │   ├── useAgentControls.ts         # Pause/resume/stop
    │   ├── useApproval.ts              # Approve/reject pending actions
    │   └── useAgentSettings.ts         # Config, permissions, presets
    ├── partials/
    │   ├── AgentHeader.tsx             # Budget bar + autonomy preset chip + niche context + controls
    │   ├── WorkflowStepper.tsx         # MUI Stepper showing template steps
    │   ├── AgentLog.tsx                # Scrollable message list (agent/user/approval/system)
    │   ├── AgentMessageBubble.tsx      # Per-message: avatar_emoji + display_name + content
    │   ├── ApprovalCard.tsx            # Inline: action description + cost + Approve/Reject buttons
    │   ├── QuickActionBar.tsx          # Template buttons for one-click workflow start
    │   ├── BatchView.tsx               # Niche list with individual progress indicators
    │   ├── CollisionWarning.tsx        # "User X is working on this niche" dialog
    │   ├── AgentSettingsPage.tsx       # Per-agent: name, personality, avatar, model
    │   ├── PersonalityPresets.tsx      # Clickable preset chips above personality textarea
    │   ├── PermissionEditor.tsx        # Tool permission table (Auto/Notify/Approve toggles)
    │   ├── PresetSelector.tsx          # Autonomy preset dropdown + activate
    │   ├── KnowledgeDocList.tsx        # Knowledge docs CRUD
    │   ├── TemplateEditor.tsx          # Custom workflow template builder
    │   └── OnboardingBanner.tsx        # First-time setup banner (dismissable)
    └── types/
        └── index.ts

store/
└── agentSlice.ts                       # RTK Query: sessions, messages, controls, config,
                                        #   permissions, presets, templates, knowledge
```

---

### C) Tech Decisions

| Decision | Why |
|----------|-----|
| `agent_app` separate from `search_app` | Agent = autonomous workflow execution. Search = user-driven chat. Different runtime model |
| LangGraph `create_react_agent()` for all agents | Same pattern as PROJ-6/8. Proven ReAct loop with tool binding |
| Orchestrator delegates via "call sub-agent" tools | Orchestrator doesn't know tool details — only knows sub-agent capabilities. Cleaner separation |
| Separate tool files per sub-agent | Enforced isolation — sub-agent can only import its own tools file |
| Permission check as wrapper around every tool | Consistent enforcement. Auto/Notify/Approve checked before execution |
| 3-layer knowledge: Prompt + Docs + Implicit | Progressive learning. System starts with rules, improves with explicit + implicit knowledge |
| Separate OpenRouter API key for agent | Budget isolation. OpenRouter manages credit limit. No custom rate limiter needed |
| Dedicated `worker-agent` (60min timeout) | Full Pipeline can take 30+ minutes. Don't block other queues |
| PostgreSQL Checkpointer (shared with PROJ-6) | Resume on crash. Same infrastructure, proven pattern |
| Resizable drawer (480→768→1200px) | Agent needs more space than Chat. Adapts to use case |
| Approval wait unbounded (no timeout) | Safety — never auto-skip an expensive action. User decides when |

---

### D) Infrastructure Changes

| Change | Where |
|--------|-------|
| `agent_app` registered | `INSTALLED_APPS` + `core/urls.py` |
| New RQ queue `agent` (60min timeout) | `settings.py → RQ_QUEUES` |
| New Docker service `worker-agent` | `docker-compose.yml` + `docker-compose.override.yml` |
| `OPENROUTER_AGENT_API_KEY` env var | `.env.template` |
| Optional `AGENT_BUDGET_WARNING_THRESHOLD` env var | `.env.template` |
| Agent tab added to MultiPurposeDrawer | `frontend-ui/src/components/MultiPurposeDrawer/` |

---

### E) New Packages

No new packages — `langchain-core`, `langchain-openai`, `langgraph`, `langgraph-checkpoint-postgres` already installed (PROJ-6/8).

---

## Verification Steps

1. Open Agent tab in drawer → Quick-Action bar with template buttons visible
2. Click "Full Pipeline" on niche "Camping Dad" → workflow stepper shows 5 steps. Agent starts Research step
3. Research Agent triggers deep research → permission check: `trigger_deep_research` = Approve → approval card in log → click Approve → agent continues
4. Agent delegates to Ideation Agent → log shows "🤖 Chief delegiert an 💡 Muse..."
5. Ideation Agent generates slogans → `approve_reject_idea` = Notify → agent executes + notification shown
6. Pause button → agent finishes current tool, halts. Resume → continues from paused state
7. Stop button → workflow cancelled, data persists. Status=cancelled
8. Worker crash → restart → workflow resumes from last checkpoint. Notification "Workflow resumed at step X"
9. Batch: select 3 niches → "Full Pipeline" → 3 sessions created, sequential processing. Progress per niche visible
10. Collision: teammate already working on same niche → warning "User Lisa is working on Camping Dad. Continue?"
11. Switch autonomy preset: Supervised → all tools need approval. Autonomous → only upload needs approval
12. Knowledge Doc: "Merke dir: Immer Humor-Slogans bevorzugen" → KnowledgeDoc created, embedded in Vector DB
13. Agent queries Vector DB before decisions → uses past approvals + Knowledge Docs as context
14. OpenRouter 402 (budget exhausted) → agent pauses, message "Agent budget exhausted"
15. Budget warning at 80% threshold → warning in Agent-Tab
16. Agent Settings: change Orchestrator name to "Julian", personality to "Minimalist" → messages show "🤖 Julian"
17. Create custom workflow template "Quick Design" (Research → Design only) → available in Quick-Action bar
18. Shared session: teammate sees read-only, can't send commands
19. Onboarding: first Agent tab open → banner "Set up your agent". Dismissable. Skip works
20. Dashboard: Agent Activity widget shows active workflows, budget, recent actions

---

## Environment Variables Required

```
# New:
OPENROUTER_AGENT_API_KEY=          # Separate API key for agent (with credit limit in OpenRouter)
AGENT_BUDGET_WARNING_THRESHOLD=    # Optional: dollar amount for 80% warning (e.g. 8.00 for $10 budget)

# Existing (shared):
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
```

Document in `django-app/env/.env.template`.

## Dependencies

- PROJ-4 (Workspace & Membership — workspace FK, member auth)
- PROJ-5 (Niche List — Research Agent tools)
- PROJ-6 (Niche Deep Research — Research Agent tools, LangGraph patterns reused)
- PROJ-7 (Amazon Product Research — Research Agent tools)
- PROJ-8 (Idea & Slogan Generation — Ideation Agent tools)
- PROJ-9 (Design Generation — Design Agent tools)
- PROJ-10 (Niche Keyword Bank — Ideation Agent tools)
- PROJ-11 (Listing & Keyword Generator — Listing Agent tools)
- PROJ-13 (Marketplace Upload Manager — Publishing Agent tools)
- PROJ-14 (Team Kanban — Publishing Agent tools)
- PROJ-15 (Vector Database — Knowledge system, semantic search, implicit learning)
- PROJ-17 (Deep Web Search — Search Agent tools, shared drawer UI, Pattern B Hybrid: AgentSession can be triggered from chat → inline WorkflowCard)

## Infrastructure

- New django-rq queue: `agent` with 60-minute timeout
- New Docker service: `worker-agent` processing the `agent` queue
- PostgreSQL Checkpointer shared with PROJ-6 (same Supabase PG)

## Decisions Log

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Framework | LangGraph + OpenClaw concepts | Same stack as PROJ-6, no new dependencies |
| 2 | Tools | Full Pipeline Access | Agent automates entire workflow |
| 3 | Permissions | Auto/Notify/Approve per tool, configurable | User controls risk level |
| 4 | Rate limiting | Separate OpenRouter API Key | Simple, OpenRouter manages budget |
| 5 | Knowledge | 3 layers: Prompt + Docs + Implicit | Agent improves over time |
| 6 | UI | Own drawer tab — Command Center | Separate from Chat, different UI needs |
| 7 | Execution | Hybrid: tasks + templates + intelligence | Flexible for all use cases |
| 8 | Templates | 5 defaults + custom | Common workflows pre-built |
| 9 | Layout | Resizable drawer (480→768→1200px) | Adapts to use case |
| 10 | Errors | Smart Retry + Fallback, configurable | Resilient but controllable |
| 11 | Knowledge mgmt | Explicit + implicit learning | Best of both worlds |
| 12 | LLM | Per step configurable, MiniMax/GPT default | Cost optimization per task type |
| 13 | Batch | Sequential default, parallel optional | Safe default, power when needed |
| 14 | Autonomy | 3 presets + custom | Quick switch + full control |
| 15 | Dashboard | Widget + Activity Feed | Visibility into agent work |
| 16 | Architecture | Multi-Agent: Orchestrator + 6 Sub-Agents | Cheaper, more precise, specialized |
| 17 | Persistence | Resume via Checkpointer + notification | No lost work |
| 18 | Concurrency | Parallel + Collision Detection | Team-safe |
| 19 | Approval timeout | Unbounded wait | Safe, no accidental skips |
| 20 | Team visibility | Private + explicit sharing | Consistent with PROJ-17 |
| 21 | Onboarding | Instant use + optional guided setup | Low barrier, optional depth |
| 22 | Controls | Stop + Pause + Resume | Full user control |
| 23 | Chat-Trigger | AgentSession can be created from PROJ-17 Chat (Mode-Dropdown=Agent) → renders inline WorkflowCard | Pattern B Hybrid: single conversation locus, full power in Agent tab |
| 24 | Source tracking | `AgentSession.source` field [agent_tab, chat_command, batch_api] | Analytics + UI hints (e.g. "Open in Chat" link if source=chat_command) |
| 25 | Self-Improvement | Metis-Pattern: Skills + WorkspaceMemory + UserProfile + Reflection | Compound expertise across sessions; char-limited memory forces curation; vendor-agnostic (no LLM-vendor lock-in — works with any OpenRouter model, including Nous Hermes models if user chooses them) |
| 26 | Memory storage | Postgres with `MaxLengthValidator` (Option B from review 2026-04-28), NOT files-on-disk | Multi-tenant safe (workspace-scoped via FK), backup with rest of DB, audit-trail; trade-off: agent must respect validator instead of OS-level file size |
| 27 | Reflection cadence | Per N sessions (default 1), NOT per N messages | Cleaner for POD-workflow rhythm; reflection runs as separate django-rq job after `AgentSession.status='completed'` |
| 28 | User-Profile | Honcho-style dialectic, **locally built** (no Honcho-SaaS dependency) | Avoids vendor lock-in + data residency concerns; algorithm publicly documented, can be replaced with Honcho API later if desired |
| 29 | Skill scope | Workspace-scoped only (no cross-workspace sharing in MVP) | Privacy + simpler MVP; cross-workspace skill marketplace deferred to Future Enhancements |
| 30 | Skill versioning | Patch-or-replace with immutable `SkillVersion` snapshots | Iterative refinement (Metis-pattern) without losing history; supports rollback |
| 31 | Sub-Agent return filter | Only final result returned to Orchestrator state, not trace (intermediate steps still in DB for UI) | ~70% token savings on multi-step pipelines; technique documented in [Nous Hermes Agent](https://github.com/nousresearch/hermes-agent) |
| 32 | Context layer count | 6 layers loaded pre-task: Prompt + KnowledgeDocs + Implicit + WorkspaceMemory + UserProfile + Skills | 12k-token budget cap to leave room for tool calls + reasoning |

## Future Enhancements (not MVP)

- Voice commands in Agent-Tab
- Agent-to-Agent communication across workspaces
- Agent performance analytics (success rate, avg cost per workflow, time per step)
- Scheduled agent runs (e.g. "Run Research for my top 10 niches every Monday")
- Agent marketplace — share custom templates + knowledge docs across workspaces
