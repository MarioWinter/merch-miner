// PROJ-18: OpenClaw Agent types — legacy re-export shim.
//
// Canonical types now live at `frontend-ui/src/types/agent.ts`. This file
// stays around so existing imports (`./AgentPanel/types`) keep resolving.
// Prefer the new path (`@/types/agent`) for any new code.

export type {
  AgentType,
  SessionStatus,
  SessionSource,
  MessageRole,
  ActionLogStatus,
  ActionStatus,
  PermissionLevel,
  KnowledgeDocSource,
  KnowledgeSource,
  NicheContextRef,
  PersonalityPresetSummary,
  SessionProgress,
  ToolCallEntry,
  WorkflowStep,
  WorkflowStepWithDescription,
  AgentConfig,
  AgentSession,
  AgentMessage,
  AgentActionLog,
  ToolPermission,
  AutonomyPreset,
  KnowledgeDoc,
  WorkflowTemplate,
  AgentSessionDetail,
  AgentDashboardLastCompleted,
  AgentDashboardSummary,
  AgentSessionListResponse,
  SessionListParams,
  CreateSessionBody,
  BatchSessionCreateRequest,
  BatchSessionCreateResponse,
  BatchCreateBody,
  SendMessageBody,
  UpdateConfigBody,
  UpdatePermissionsBody,
  CreatePresetBody,
  CreateTemplateBody,
  CreateKnowledgeBody,
  UpdateKnowledgeBody,
  RejectActionBody,
  PersonalityPreset,
} from '@/types/agent';

export { AGENT_DEFAULTS, PERSONALITY_PRESETS } from '@/types/agent';
