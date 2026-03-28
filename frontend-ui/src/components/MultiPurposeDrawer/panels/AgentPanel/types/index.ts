// PROJ-18: OpenClaw Agent types

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

export type MessageRole =
  | 'user'
  | 'agent'
  | 'system'
  | 'approval_request'
  | 'approval_response';

export type ActionStatus =
  | 'started'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected';

export type PermissionLevel = 'auto' | 'notify' | 'approve';

export type KnowledgeSource = 'manual' | 'chat_command' | 'auto_extracted';

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
}

export interface NicheContextRef {
  id: string;
  name: string;
}

export interface AgentSession {
  id: string;
  workspace: string;
  created_by: string;
  created_by_username: string;
  title: string;
  status: SessionStatus;
  niche_context: NicheContextRef | null;
  workflow_template: string | null;
  autonomy_preset: string;
  is_shared: boolean;
  current_step: string;
  total_steps: number;
  completed_steps: number;
  error_message: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ToolCallEntry {
  tool_name: string;
  args: Record<string, unknown>;
  result: unknown;
  status: string;
}

export interface AgentMessage {
  id: string;
  session: string;
  role: MessageRole;
  content: string;
  agent_type: string;
  agent_display_name: string;
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
  status: ActionStatus;
  cost_estimate: string | null;
  error_message: string;
  created_at: string;
  completed_at: string | null;
}

export interface ToolPermission {
  id: string;
  workspace: string;
  user: string;
  tool_name: string;
  permission_level: PermissionLevel;
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
  source: KnowledgeSource;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  agent_type: AgentType;
  action: string;
  description: string;
}

export interface WorkflowTemplate {
  id: string;
  workspace: string;
  created_by: string | null;
  name: string;
  key: string;
  is_system: boolean;
  steps: WorkflowStep[];
  created_at: string;
}

// --- Request/Response types ---

export interface AgentSessionListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AgentSession[];
}

export interface AgentSessionDetail extends AgentSession {
  messages: AgentMessage[];
  action_logs: AgentActionLog[];
}

export interface CreateSessionBody {
  workflow_template?: string;
  niche_context?: string;
  title?: string;
}

export interface BatchCreateBody {
  niche_ids: string[];
  workflow_template?: string;
  parallel?: boolean;
}

export interface SendMessageBody {
  content: string;
}

export interface UpdateConfigBody {
  display_name?: string;
  personality?: string;
  avatar_emoji?: string;
  model_name?: string;
  temperature?: number;
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
  source?: KnowledgeSource;
}

export interface UpdateKnowledgeBody {
  title?: string;
  content?: string;
}

export interface SessionListParams {
  page?: number;
  page_size?: number;
  status?: SessionStatus;
  shared?: boolean;
}

// --- Agent default names/emojis ---

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

// --- Personality presets ---

export interface PersonalityPreset {
  agent_type: AgentType;
  name: string;
  text: string;
}

export const PERSONALITY_PRESETS: PersonalityPreset[] = [
  {
    agent_type: 'orchestrator',
    name: 'agent.personality.projektleiter',
    text: 'Strukturiert, klar, gibt kurze Status-Updates. Delegiert effizient und fasst Ergebnisse zusammen.',
  },
  {
    agent_type: 'orchestrator',
    name: 'agent.personality.creativeDirector',
    text: 'Enthusiastisch, vision\u00E4r, denkt in Konzepten. Gibt kreative Impulse und motiviert das Team.',
  },
  {
    agent_type: 'orchestrator',
    name: 'agent.personality.minimalist',
    text: 'Extrem knapp, nur das N\u00F6tigste. Keine Floskeln, nur Fakten und Aktionen.',
  },
  {
    agent_type: 'research',
    name: 'agent.personality.analyst',
    text: 'Datengetrieben, n\u00FCchtern, liefert Fakten mit Quellen. Bewertet Niches objektiv.',
  },
  {
    agent_type: 'research',
    name: 'agent.personality.scout',
    text: 'Neugierig, entdeckerfreudig, begeistert sich f\u00FCr neue Trends. Liefert Kontext und Hintergrund.',
  },
  {
    agent_type: 'ideation',
    name: 'agent.personality.texter',
    text: 'Wortgewandt, spielt mit Sprache, liefert mehrere Varianten. Denkt in Zielgruppen.',
  },
  {
    agent_type: 'ideation',
    name: 'agent.personality.brainstormer',
    text: 'Schnell, assoziativ, unkonventionell. Quantit\u00E4t vor Qualit\u00E4t, filtert sp\u00E4ter.',
  },
  {
    agent_type: 'design',
    name: 'agent.personality.artDirector',
    text: 'Visuell pr\u00E4zise, beschreibt Designs in Detail. Achtet auf Komposition und Farbharmonie.',
  },
  {
    agent_type: 'design',
    name: 'agent.personality.experimentator',
    text: 'Probiert ungew\u00F6hnliche Stile, mixt \u00C4sthetiken. Liefert \u00FCberraschende Ergebnisse.',
  },
  {
    agent_type: 'listing',
    name: 'agent.personality.seoProfi',
    text: 'Keyword-fokussiert, optimiert f\u00FCr Rankings. Jedes Wort hat einen Zweck.',
  },
  {
    agent_type: 'listing',
    name: 'agent.personality.copywriter',
    text: '\u00DCberzeugend, emotional, verkaufsstark. Schreibt Listings die konvertieren.',
  },
  {
    agent_type: 'publishing',
    name: 'agent.personality.koordinator',
    text: 'Checklisten-Typ, \u00FCberpr\u00FCft alles doppelt. Stellt sicher dass nichts fehlt.',
  },
  {
    agent_type: 'search',
    name: 'agent.personality.rechercheur',
    text: 'Gr\u00FCndlich, gr\u00E4bt tief, findet auch obskure Quellen. Fasst kompakt zusammen.',
  },
];
