import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  AgentSession,
  AgentSessionDetail,
  AgentSessionListResponse,
  AgentConfig,
  ToolPermission,
  AutonomyPreset,
  KnowledgeDoc,
  WorkflowTemplate,
  CreateSessionBody,
  BatchSessionCreateRequest,
  BatchSessionCreateResponse,
  SendMessageBody,
  UpdateConfigBody,
  UpdatePermissionsBody,
  CreatePresetBody,
  CreateTemplateBody,
  CreateKnowledgeBody,
  UpdateKnowledgeBody,
  SessionListParams,
  AgentMessage,
  AgentDashboardSummary,
  Skill,
  SkillListResponse,
  SkillVersionListResponse,
  CreateSkillBody,
  PatchSkillBody,
  ListSkillsParams,
  WorkspaceMemory,
  PatchMemoryBody,
  UserProfile,
  PatchProfileBody,
  AgentWorkspaceConfig,
  PatchWorkspaceConfigBody,
  ReflectionTriggerResponse,
} from '@/types/agent';

export const agentApi = createApi({
  reducerPath: 'agentApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: [
    'AgentSessions',
    'AgentMessages',
    'AgentConfig',
    'Permissions',
    'Presets',
    'Templates',
    'Knowledge',
    'AgentDashboard',
    'Skills',
    'SkillVersions',
    'Memory',
    'Profile',
    'WorkspaceConfig',
  ],
  endpoints: (builder) => ({
    // --- Sessions ---
    listSessions: builder.query<AgentSessionListResponse, SessionListParams | void>({
      query: (params) => ({
        url: '/api/agent/sessions/',
        method: 'GET',
        params: params ?? undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'AgentSessions' as const, id })),
              { type: 'AgentSessions', id: 'LIST' },
            ]
          : [{ type: 'AgentSessions', id: 'LIST' }],
    }),

    getSession: builder.query<AgentSessionDetail, string>({
      query: (id) => ({
        url: `/api/agent/sessions/${id}/`,
        method: 'GET',
      }),
      providesTags: (_r, _e, id) => [
        { type: 'AgentSessions', id },
        { type: 'AgentMessages', id },
      ],
    }),

    createSession: builder.mutation<AgentSession, CreateSessionBody>({
      query: (body) => ({
        url: '/api/agent/sessions/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'AgentSessions', id: 'LIST' }],
    }),

    batchCreateSessions: builder.mutation<BatchSessionCreateResponse, BatchSessionCreateRequest>({
      query: (body) => ({
        url: '/api/agent/sessions/batch/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'AgentSessions', id: 'LIST' }],
    }),

    sendMessage: builder.mutation<AgentMessage, { sessionId: string; body: SendMessageBody }>({
      query: ({ sessionId, body }) => ({
        url: `/api/agent/sessions/${sessionId}/messages/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_r, _e, { sessionId }) => [
        { type: 'AgentMessages', id: sessionId },
      ],
    }),

    // --- Controls ---
    pauseSession: builder.mutation<AgentSession, string>({
      query: (id) => ({
        url: `/api/agent/sessions/${id}/pause/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [{ type: 'AgentSessions', id }],
    }),

    resumeSession: builder.mutation<AgentSession, string>({
      query: (id) => ({
        url: `/api/agent/sessions/${id}/resume/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [{ type: 'AgentSessions', id }],
    }),

    stopSession: builder.mutation<AgentSession, string>({
      query: (id) => ({
        url: `/api/agent/sessions/${id}/stop/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [{ type: 'AgentSessions', id }],
    }),

    // --- Sharing ---
    shareSession: builder.mutation<AgentSession, string>({
      query: (id) => ({
        url: `/api/agent/sessions/${id}/share/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [{ type: 'AgentSessions', id }],
    }),

    unshareSession: builder.mutation<AgentSession, string>({
      query: (id) => ({
        url: `/api/agent/sessions/${id}/unshare/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [{ type: 'AgentSessions', id }],
    }),

    // --- Approval ---
    approveAction: builder.mutation<void, { sessionId: string; actionLogId: string }>({
      query: ({ sessionId, actionLogId }) => ({
        url: `/api/agent/sessions/${sessionId}/approve/${actionLogId}/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { sessionId }) => [
        { type: 'AgentSessions', id: sessionId },
        { type: 'AgentMessages', id: sessionId },
      ],
    }),

    rejectAction: builder.mutation<void, { sessionId: string; actionLogId: string }>({
      query: ({ sessionId, actionLogId }) => ({
        url: `/api/agent/sessions/${sessionId}/reject/${actionLogId}/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { sessionId }) => [
        { type: 'AgentSessions', id: sessionId },
        { type: 'AgentMessages', id: sessionId },
      ],
    }),

    // --- Config ---
    getConfig: builder.query<AgentConfig[], void>({
      query: () => ({
        url: '/api/agent/config/',
        method: 'GET',
      }),
      providesTags: [{ type: 'AgentConfig', id: 'LIST' }],
    }),

    updateConfig: builder.mutation<AgentConfig, { agentType: string; body: UpdateConfigBody }>({
      query: ({ agentType, body }) => ({
        url: `/api/agent/config/${agentType}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: [{ type: 'AgentConfig', id: 'LIST' }],
    }),

    // --- Permissions ---
    getPermissions: builder.query<ToolPermission[], void>({
      query: () => ({
        url: '/api/agent/permissions/',
        method: 'GET',
      }),
      providesTags: [{ type: 'Permissions', id: 'LIST' }],
    }),

    updatePermissions: builder.mutation<ToolPermission[], UpdatePermissionsBody>({
      query: (body) => ({
        url: '/api/agent/permissions/',
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: [{ type: 'Permissions', id: 'LIST' }],
    }),

    // --- Presets ---
    listPresets: builder.query<AutonomyPreset[], void>({
      query: () => ({
        url: '/api/agent/presets/',
        method: 'GET',
      }),
      providesTags: [{ type: 'Presets', id: 'LIST' }],
    }),

    createPreset: builder.mutation<AutonomyPreset, CreatePresetBody>({
      query: (body) => ({
        url: '/api/agent/presets/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'Presets', id: 'LIST' }],
    }),

    activatePreset: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/agent/presets/${id}/activate/`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Presets', id: 'LIST' },
        { type: 'Permissions', id: 'LIST' },
      ],
    }),

    deletePreset: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/agent/presets/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Presets', id: 'LIST' }],
    }),

    // --- Templates ---
    listTemplates: builder.query<WorkflowTemplate[], void>({
      query: () => ({
        url: '/api/agent/templates/',
        method: 'GET',
      }),
      providesTags: [{ type: 'Templates', id: 'LIST' }],
    }),

    createTemplate: builder.mutation<WorkflowTemplate, CreateTemplateBody>({
      query: (body) => ({
        url: '/api/agent/templates/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'Templates', id: 'LIST' }],
    }),

    deleteTemplate: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/agent/templates/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Templates', id: 'LIST' }],
    }),

    // --- Knowledge ---
    listKnowledge: builder.query<KnowledgeDoc[], void>({
      query: () => ({
        url: '/api/agent/knowledge/',
        method: 'GET',
      }),
      providesTags: [{ type: 'Knowledge', id: 'LIST' }],
    }),

    createKnowledge: builder.mutation<KnowledgeDoc, CreateKnowledgeBody>({
      query: (body) => ({
        url: '/api/agent/knowledge/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'Knowledge', id: 'LIST' }],
    }),

    updateKnowledge: builder.mutation<KnowledgeDoc, { id: string; body: UpdateKnowledgeBody }>({
      query: ({ id, body }) => ({
        url: `/api/agent/knowledge/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: [{ type: 'Knowledge', id: 'LIST' }],
    }),

    deleteKnowledge: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/agent/knowledge/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Knowledge', id: 'LIST' }],
    }),

    // --- Dashboard ---
    getDashboardSummary: builder.query<AgentDashboardSummary, void>({
      query: () => ({
        url: '/api/agent/dashboard/summary/',
        method: 'GET',
      }),
      providesTags: [{ type: 'AgentDashboard', id: 'SUMMARY' }],
    }),

    // ── Phase 14 — Self-Improvement Layer (Metis Pattern) ──

    // Skills
    listSkills: builder.query<SkillListResponse, ListSkillsParams | void>({
      query: (params) => ({
        url: '/api/agent/skills/',
        method: 'GET',
        params: params ?? undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({
                type: 'Skills' as const,
                id,
              })),
              { type: 'Skills', id: 'LIST' },
            ]
          : [{ type: 'Skills', id: 'LIST' }],
    }),

    getSkill: builder.query<Skill, string>({
      query: (id) => ({
        url: `/api/agent/skills/${id}/`,
        method: 'GET',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Skills', id }],
    }),

    createSkill: builder.mutation<Skill, CreateSkillBody>({
      query: (body) => ({
        url: '/api/agent/skills/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'Skills', id: 'LIST' }],
    }),

    patchSkill: builder.mutation<
      Skill,
      { id: string; body: PatchSkillBody }
    >({
      query: ({ id, body }) => ({
        url: `/api/agent/skills/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Skills', id },
        { type: 'Skills', id: 'LIST' },
        { type: 'SkillVersions', id },
      ],
    }),

    deleteSkill: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/agent/skills/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Skills', id },
        { type: 'Skills', id: 'LIST' },
      ],
    }),

    getSkillVersions: builder.query<SkillVersionListResponse, string>({
      query: (id) => ({
        url: `/api/agent/skills/${id}/versions/`,
        method: 'GET',
      }),
      providesTags: (_r, _e, id) => [{ type: 'SkillVersions', id }],
    }),

    // Memory (singleton per workspace)
    getMemory: builder.query<WorkspaceMemory, void>({
      query: () => ({
        url: '/api/agent/memory/',
        method: 'GET',
      }),
      providesTags: [{ type: 'Memory', id: 'SINGLETON' }],
    }),

    patchMemory: builder.mutation<WorkspaceMemory, PatchMemoryBody>({
      query: (body) => ({
        url: '/api/agent/memory/',
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: [{ type: 'Memory', id: 'SINGLETON' }],
    }),

    // Profile (caller's profile in current workspace)
    getProfile: builder.query<UserProfile, { include_reasoning?: boolean } | void>({
      query: (params) => ({
        url: '/api/agent/profile/',
        method: 'GET',
        params: params?.include_reasoning ? { include_reasoning: 'true' } : undefined,
      }),
      providesTags: [{ type: 'Profile', id: 'ME' }],
    }),

    patchProfile: builder.mutation<UserProfile, PatchProfileBody>({
      query: (body) => ({
        url: '/api/agent/profile/',
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: [{ type: 'Profile', id: 'ME' }],
    }),

    // Workspace tuning knobs (admin only)
    getWorkspaceConfig: builder.query<AgentWorkspaceConfig, void>({
      query: () => ({
        url: '/api/agent/workspace-config/',
        method: 'GET',
      }),
      providesTags: [{ type: 'WorkspaceConfig', id: 'SINGLETON' }],
    }),

    patchWorkspaceConfig: builder.mutation<
      AgentWorkspaceConfig,
      PatchWorkspaceConfigBody
    >({
      query: (body) => ({
        url: '/api/agent/workspace-config/',
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: [
        { type: 'WorkspaceConfig', id: 'SINGLETON' },
        { type: 'Memory', id: 'SINGLETON' },
        { type: 'Profile', id: 'ME' },
      ],
    }),

    // Manual reflection trigger
    triggerReflection: builder.mutation<ReflectionTriggerResponse, string>({
      query: (sessionId) => ({
        url: `/api/agent/sessions/${sessionId}/reflect/`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Memory', id: 'SINGLETON' },
        { type: 'Profile', id: 'ME' },
        { type: 'Skills', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useListSessionsQuery,
  useGetSessionQuery,
  useCreateSessionMutation,
  useBatchCreateSessionsMutation,
  useSendMessageMutation,
  usePauseSessionMutation,
  useResumeSessionMutation,
  useStopSessionMutation,
  useShareSessionMutation,
  useUnshareSessionMutation,
  useApproveActionMutation,
  useRejectActionMutation,
  useGetConfigQuery,
  useUpdateConfigMutation,
  useGetPermissionsQuery,
  useUpdatePermissionsMutation,
  useListPresetsQuery,
  useCreatePresetMutation,
  useActivatePresetMutation,
  useDeletePresetMutation,
  useListTemplatesQuery,
  useCreateTemplateMutation,
  useDeleteTemplateMutation,
  useListKnowledgeQuery,
  useCreateKnowledgeMutation,
  useUpdateKnowledgeMutation,
  useDeleteKnowledgeMutation,
  useGetDashboardSummaryQuery,
  // Phase 14 — Self-Improvement Layer
  useListSkillsQuery,
  useGetSkillQuery,
  useCreateSkillMutation,
  usePatchSkillMutation,
  useDeleteSkillMutation,
  useGetSkillVersionsQuery,
  useGetMemoryQuery,
  usePatchMemoryMutation,
  useGetProfileQuery,
  usePatchProfileMutation,
  useGetWorkspaceConfigQuery,
  usePatchWorkspaceConfigMutation,
  useTriggerReflectionMutation,
} = agentApi;
