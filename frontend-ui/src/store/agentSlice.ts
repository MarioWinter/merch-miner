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
} = agentApi;
