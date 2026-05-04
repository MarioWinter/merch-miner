// PROJ-18 Phase 9: Canonical OpenClaw Agent types
//
// Single source of truth for AgentType, SessionStatus, MessageRole, etc.
// The legacy types index at `components/MultiPurposeDrawer/panels/AgentPanel/types`
// re-exports from this module for backward compatibility.

// ---------------------------------------------------------------------------
// Enums (string literal unions — no TS `enum` keyword per repo conventions)
// ---------------------------------------------------------------------------

export type AgentType =
  | 'orchestrator'
  | 'research'
  | 'ideation'
  | 'design'
  | 'listing'
  | 'publishing'
  | 'search';

export type SessionStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SessionSource = 'agent_tab' | 'chat_command' | 'batch_api';

export type MessageRole =
  | 'user'
  | 'agent'
  | 'system'
  | 'approval_request'
  | 'approval_response';

export type ActionLogStatus =
  | 'started'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected';

/** @deprecated Use {@link ActionLogStatus}. Kept for backward compatibility. */
export type ActionStatus = ActionLogStatus;

export type PermissionLevel = 'auto' | 'notify' | 'approve';

export type KnowledgeDocSource = 'manual' | 'chat_command' | 'auto_extracted';

/** @deprecated Use {@link KnowledgeDocSource}. */
export type KnowledgeSource = KnowledgeDocSource;

// ---------------------------------------------------------------------------
// Sub-shapes
// ---------------------------------------------------------------------------

export interface NicheContextRef {
  id: string;
  name: string;
}

export interface PersonalityPresetSummary {
  /** Translation key, e.g. `agent.personality.projektleiter` */
  key: string;
  /** Display name (already localised by the backend OR a translation key). */
  name: string;
  /** Short description / preview text. */
  description: string;
}

export interface SessionProgress {
  current_step: string;
  completed_steps: number;
  total_steps: number;
  /** 0–100 integer; backend computes this. */
  percent: number;
}

export interface ToolCallEntry {
  tool_name: string;
  args: Record<string, unknown>;
  result: unknown;
  status: string;
}

export interface WorkflowStep {
  agent_type: AgentType;
  action: string;
  description: string;
}

/** A workflow step enriched by the serializer with the human-readable
 *  description (computed from the action key + agent_type). */
export interface WorkflowStepWithDescription extends WorkflowStep {
  /** Resolved long-form description for UI rendering. */
  description: string;
}

// ---------------------------------------------------------------------------
// Domain models (mirrors of DRF serializers)
// ---------------------------------------------------------------------------

export interface AgentConfig {
  id: string;
  workspace: string;
  agent_type: AgentType;
  display_name: string;
  personality: string;
  avatar_emoji: string;
  model_name: string;
  temperature: number;
  system_prompt: string;
  max_tokens: number | null;
  updated_at: string;
  /** Computed: list of personality presets the user can pick from for this
   *  agent. Populated by `AgentConfigSerializer` (see Phase 8). */
  personality_presets: PersonalityPresetSummary[];
}

export interface AgentSession {
  id: string;
  workspace: string;
  /** Backend-internal user id (not always populated by serializer). Use
   *  {@link created_by_email} for ownership comparisons in the UI. */
  created_by?: string;
  /** Email of the session creator. Exposed by `AgentSessionListSerializer`
   *  via `source='created_by.email'` and used for owner-vs-shared-viewer
   *  detection (AC-60/AC-61/AC-62). */
  created_by_email: string;
  /** @deprecated Backend currently exposes `created_by_email`; kept here for
   *  backwards compatibility with older fixtures and future username field. */
  created_by_username?: string;
  title: string;
  status: SessionStatus;
  source?: SessionSource;
  niche_context: NicheContextRef | null;
  workflow_template: string | null;
  autonomy_preset: string;
  is_shared: boolean;
  current_step: string;
  total_steps: number;
  completed_steps: number;
  error_message: string;
  /** AC-31/AC-33: shared identifier for sibling sessions started via batch endpoint. */
  batch_id: string | null;
  /** AC-31/AC-33: 0-based ordinal of this session within its batch. */
  batch_position: number | null;
  /** Computed by serializer. */
  message_count: number;
  /** Computed by serializer — convenience progress object for UI. */
  progress: SessionProgress;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface AgentMessage {
  id: string;
  session: string;
  role: MessageRole;
  content: string;
  agent_type: string;
  /** Computed by serializer (resolved from AgentConfig). */
  agent_display_name: string;
  /** Computed by serializer (resolved from AgentConfig). */
  agent_avatar_emoji: string;
  tool_calls: ToolCallEntry[];
  created_at: string;
}

export interface AgentActionLog {
  id: string;
  session: string;
  workspace: string;
  user: string;
  agent_type: string;
  action: string;
  target_object_type: string;
  target_object_id: string | null;
  status: ActionLogStatus;
  cost_estimate: string | null;
  error_message: string;
  /** Computed by serializer — short human summary of the target object. */
  target_summary: string;
  created_at: string;
  completed_at: string | null;
}

export interface ToolPermission {
  id: string;
  workspace: string;
  user: string;
  tool_name: string;
  permission_level: PermissionLevel;
  /** Computed: short description of what the tool does. */
  tool_description: string;
  updated_at: string;
}

export interface AutonomyPreset {
  id: string;
  workspace: string;
  created_by: string | null;
  name: string;
  is_system: boolean;
  permissions: Record<string, PermissionLevel>;
  created_at: string;
}

export interface KnowledgeDoc {
  id: string;
  workspace: string;
  created_by: string;
  title: string;
  content: string;
  source: KnowledgeDocSource;
  created_at: string;
  updated_at: string;
}

export interface WorkflowTemplate {
  id: string;
  workspace: string;
  created_by: string | null;
  name: string;
  key: string;
  is_system: boolean;
  steps: WorkflowStep[];
  /** Computed by serializer — same shape as `steps` but each entry guaranteed
   *  to have a populated `description` field. */
  steps_with_descriptions: WorkflowStepWithDescription[];
  created_at: string;
}

export interface AgentSessionDetail extends AgentSession {
  messages: AgentMessage[];
  action_logs: AgentActionLog[];
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface AgentDashboardLastCompleted {
  session_id: string;
  title: string;
  completed_at: string;
}

export interface AgentDashboardSummary {
  active_count: number;
  last_completed: AgentDashboardLastCompleted | null;
  /** Total agent actions executed in the last 7 days. */
  weekly_actions: number;
  /** Budget consumption percentage (0–100). */
  budget_pct: number;
}

// ---------------------------------------------------------------------------
// Request / response shapes
// ---------------------------------------------------------------------------

export interface AgentSessionListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AgentSession[];
}

export interface SessionListParams {
  page?: number;
  page_size?: number;
  status?: SessionStatus;
  shared?: boolean;
  batch_id?: string;
}

export interface CreateSessionBody {
  workflow_template?: string;
  niche_context?: string;
  title?: string;
  autonomy_preset?: string;
}

export interface BatchSessionCreateRequest {
  niche_ids: string[];
  workflow_template?: string;
  parallel?: boolean;
  autonomy_preset?: string;
}

export interface BatchSessionCreateResponse {
  batch_id: string;
  session_ids: string[];
  sessions: AgentSession[];
  parallel: boolean;
  status: SessionStatus;
}

/** @deprecated Use {@link BatchSessionCreateRequest}. */
export type BatchCreateBody = BatchSessionCreateRequest;

export interface SendMessageBody {
  content: string;
}

export interface UpdateConfigBody {
  display_name?: string;
  personality?: string;
  avatar_emoji?: string;
  model_name?: string;
  temperature?: number;
  system_prompt?: string;
  max_tokens?: number | null;
}

export interface UpdatePermissionsBody {
  permissions: Array<{
    tool_name: string;
    permission_level: PermissionLevel;
  }>;
}

export interface CreatePresetBody {
  name: string;
  permissions: Record<string, PermissionLevel>;
}

export interface CreateTemplateBody {
  name: string;
  key: string;
  steps: WorkflowStep[];
}

export interface CreateKnowledgeBody {
  title: string;
  content: string;
  source?: KnowledgeDocSource;
}

export interface UpdateKnowledgeBody {
  title?: string;
  content?: string;
}

export interface RejectActionBody {
  reason?: string;
}

// ---------------------------------------------------------------------------
// Static client-side defaults — kept here so they ship next to the types.
// ---------------------------------------------------------------------------

export const AGENT_DEFAULTS: Record<
  AgentType,
  { name: string; emoji: string }
> = {
  orchestrator: { name: 'Chief', emoji: '\u{1F916}' },
  research: { name: 'Scout', emoji: '\u{1F52C}' },
  ideation: { name: 'Muse', emoji: '\u{1F4A1}' },
  design: { name: 'Pixel', emoji: '\u{1F3A8}' },
  listing: { name: 'Scribe', emoji: '\u{270D}\u{FE0F}' },
  publishing: { name: 'Launch', emoji: '\u{1F680}' },
  search: { name: 'Radar', emoji: '\u{1F50D}' },
};

export interface PersonalityPreset {
  agent_type: AgentType;
  name: string;
  text: string;
}

// ---------------------------------------------------------------------------
// PROJ-18 Phase 14 — Self-Improvement Layer (Metis Pattern)
// ---------------------------------------------------------------------------

export type SkillTriggerType =
  | 'auto_complex_task'
  | 'auto_error_recovery'
  | 'user_correction'
  | 'manual';

export interface Skill {
  id: string;
  name: string;
  description: string;
  content_md: string;
  version: number;
  trigger_type: SkillTriggerType;
  applicable_agent_types: AgentType[];
  success_count: number;
  error_count: number;
  last_used_at: string | null;
  deleted_at: string | null;
  created_by_session: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Computed by serializer. */
  version_count: number;
  /** Computed: deleted_at is null. */
  is_active: boolean;
}

export interface SkillVersion {
  id: string;
  version: number;
  content_md: string;
  patch_summary: string;
  created_at: string;
}

export interface SkillListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Skill[];
}

export interface SkillVersionListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: SkillVersion[];
}

export interface CreateSkillBody {
  name: string;
  description?: string;
  content_md: string;
  applicable_agent_types?: AgentType[] | string[];
  patch_summary?: string;
}

export interface PatchSkillBody {
  patch_md: string;
  expected_version: number;
  patch_summary?: string;
}

export interface SkillVersionConflictError {
  error: 'version_conflict';
  detail: string;
  current_version: number;
  expected_version: number;
}

export interface ListSkillsParams {
  agent_type?: AgentType | string;
  trigger_type?: SkillTriggerType;
  include_deleted?: boolean;
  page?: number;
  page_size?: number;
}

export interface WorkspaceMemory {
  id: string;
  content_md: string;
  last_consolidated_at: string | null;
  last_consolidated_session: string | null;
  /** Computed: length of content_md. */
  char_count: number;
  /** Computed from AgentWorkspaceConfig.memory_char_limit (default 2200). */
  char_limit: number;
  created_at: string;
  updated_at: string;
}

export interface PatchMemoryBody {
  content_md: string;
}

export interface UserProfile {
  id: string;
  content_md: string;
  last_dialectic_at: string | null;
  dialect_cadence_sessions: number;
  /** Read-only scratchpad — only present when ?include_reasoning=true. */
  dialect_reasoning?: string;
  /** Computed: length of content_md. */
  char_count: number;
  /** Computed from AgentWorkspaceConfig.profile_char_limit (default 1375). */
  char_limit: number;
  created_at: string;
  updated_at: string;
}

export interface PatchProfileBody {
  content_md?: string;
  dialect_cadence_sessions?: number;
}

export interface AgentWorkspaceConfig {
  id: string;
  reflection_cadence_sessions: number;
  skill_creation_min_tool_calls: number;
  memory_char_limit: number;
  profile_char_limit: number;
  created_at: string;
  updated_at: string;
}

export interface PatchWorkspaceConfigBody {
  reflection_cadence_sessions?: number;
  skill_creation_min_tool_calls?: number;
  memory_char_limit?: number;
  profile_char_limit?: number;
}

export interface ReflectionTriggerResponse {
  detail: string;
  session_id: string;
}

/** Phase 14 — char-limit safety thresholds (frontend-only constants). */
export const MEMORY_CHAR_LIMIT_DEFAULT = 2200;
export const MEMORY_CHAR_WARN = 1900;
export const MEMORY_CHAR_CRITICAL = 2100;

export const PROFILE_CHAR_LIMIT_DEFAULT = 1375;
export const PROFILE_CHAR_WARN = 1200;
export const PROFILE_CHAR_CRITICAL = 1330;

export const PERSONALITY_PRESETS: PersonalityPreset[] = [
  {
    agent_type: 'orchestrator',
    name: 'agent.personality.projektleiter',
    text: 'Strukturiert, klar, gibt kurze Status-Updates. Delegiert effizient und fasst Ergebnisse zusammen.',
  },
  {
    agent_type: 'orchestrator',
    name: 'agent.personality.creativeDirector',
    text: 'Enthusiastisch, visionär, denkt in Konzepten. Gibt kreative Impulse und motiviert das Team.',
  },
  {
    agent_type: 'orchestrator',
    name: 'agent.personality.minimalist',
    text: 'Extrem knapp, nur das Nötigste. Keine Floskeln, nur Fakten und Aktionen.',
  },
  {
    agent_type: 'research',
    name: 'agent.personality.analyst',
    text: 'Datengetrieben, nüchtern, liefert Fakten mit Quellen. Bewertet Niches objektiv.',
  },
  {
    agent_type: 'research',
    name: 'agent.personality.scout',
    text: 'Neugierig, entdeckerfreudig, begeistert sich für neue Trends. Liefert Kontext und Hintergrund.',
  },
  {
    agent_type: 'ideation',
    name: 'agent.personality.texter',
    text: 'Wortgewandt, spielt mit Sprache, liefert mehrere Varianten. Denkt in Zielgruppen.',
  },
  {
    agent_type: 'ideation',
    name: 'agent.personality.brainstormer',
    text: 'Schnell, assoziativ, unkonventionell. Quantität vor Qualität, filtert später.',
  },
  {
    agent_type: 'design',
    name: 'agent.personality.artDirector',
    text: 'Visuell präzise, beschreibt Designs in Detail. Achtet auf Komposition und Farbharmonie.',
  },
  {
    agent_type: 'design',
    name: 'agent.personality.experimentator',
    text: 'Probiert ungewöhnliche Stile, mixt Ästhetiken. Liefert überraschende Ergebnisse.',
  },
  {
    agent_type: 'listing',
    name: 'agent.personality.seoProfi',
    text: 'Keyword-fokussiert, optimiert für Rankings. Jedes Wort hat einen Zweck.',
  },
  {
    agent_type: 'listing',
    name: 'agent.personality.copywriter',
    text: 'Überzeugend, emotional, verkaufsstark. Schreibt Listings die konvertieren.',
  },
  {
    agent_type: 'publishing',
    name: 'agent.personality.koordinator',
    text: 'Checklisten-Typ, überprüft alles doppelt. Stellt sicher dass nichts fehlt.',
  },
  {
    agent_type: 'search',
    name: 'agent.personality.rechercheur',
    text: 'Gründlich, gräbt tief, findet auch obskure Quellen. Fasst kompakt zusammen.',
  },
];
