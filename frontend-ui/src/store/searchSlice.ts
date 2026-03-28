import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  ChatSession,
  ChatSessionDetail,
  ChatSessionListResponse,
  ChatMessage,
  ChatTag,
  WebSearchResult,
  SearchHealth,
  CreateSessionBody,
  SendMessageBody,
  TriggerCrawlBody,
  SaveToNicheBody,
  CreateTagBody,
  UpdateSessionBody,
  SessionListParams,
} from '../types/search';

export const searchApi = createApi({
  reducerPath: 'searchApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['ChatSessions', 'ChatMessages', 'CrawlJobs', 'ChatTags', 'SearchHealth'],
  endpoints: (builder) => ({
    // --- Sessions ---
    listSessions: builder.query<ChatSessionListResponse, SessionListParams | void>({
      query: (params) => ({
        url: '/api/chat/sessions/',
        method: 'GET',
        params: params ?? undefined,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'ChatSessions' as const, id })),
              { type: 'ChatSessions', id: 'LIST' },
            ]
          : [{ type: 'ChatSessions', id: 'LIST' }],
    }),

    getSession: builder.query<ChatSessionDetail, string>({
      query: (id) => ({
        url: `/api/chat/sessions/${id}/`,
        method: 'GET',
      }),
      providesTags: (_r, _e, id) => [
        { type: 'ChatSessions', id },
        { type: 'ChatMessages', id },
      ],
    }),

    createSession: builder.mutation<ChatSession, CreateSessionBody>({
      query: (body) => ({
        url: '/api/chat/sessions/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'ChatSessions', id: 'LIST' }],
    }),

    updateSession: builder.mutation<ChatSession, { id: string; body: UpdateSessionBody }>({
      query: ({ id, body }) => ({
        url: `/api/chat/sessions/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'ChatSessions', id },
        { type: 'ChatSessions', id: 'LIST' },
      ],
    }),

    shareSession: builder.mutation<ChatSession, string>({
      query: (id) => ({
        url: `/api/chat/sessions/${id}/share/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'ChatSessions', id },
        { type: 'ChatSessions', id: 'LIST' },
      ],
    }),

    unshareSession: builder.mutation<ChatSession, string>({
      query: (id) => ({
        url: `/api/chat/sessions/${id}/unshare/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'ChatSessions', id },
        { type: 'ChatSessions', id: 'LIST' },
      ],
    }),

    // --- Messages ---
    sendMessage: builder.mutation<ChatMessage, { sessionId: string; body: SendMessageBody }>({
      query: ({ sessionId, body }) => ({
        url: `/api/chat/sessions/${sessionId}/messages/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_r, _e, { sessionId }) => [
        { type: 'ChatMessages', id: sessionId },
        { type: 'ChatSessions', id: sessionId },
        { type: 'ChatSessions', id: 'LIST' },
      ],
    }),

    // --- Crawl ---
    triggerCrawl: builder.mutation<WebSearchResult, TriggerCrawlBody>({
      query: (body) => ({
        url: '/api/search/crawl/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'CrawlJobs', id: 'LIST' }],
    }),

    getCrawlStatus: builder.query<WebSearchResult, string>({
      query: (id) => ({
        url: `/api/search/crawl/${id}/status/`,
        method: 'GET',
      }),
      providesTags: (_r, _e, id) => [{ type: 'CrawlJobs', id }],
    }),

    // --- Save to Niche ---
    saveToNiche: builder.mutation<void, { resultId: string; body: SaveToNicheBody }>({
      query: ({ resultId, body }) => ({
        url: `/api/search/results/${resultId}/save-to-niche/`,
        method: 'POST',
        data: body,
      }),
    }),

    // --- Tags ---
    listTags: builder.query<ChatTag[], void>({
      query: () => ({
        url: '/api/chat/tags/',
        method: 'GET',
      }),
      providesTags: [{ type: 'ChatTags', id: 'LIST' }],
    }),

    createTag: builder.mutation<ChatTag, CreateTagBody>({
      query: (body) => ({
        url: '/api/chat/tags/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'ChatTags', id: 'LIST' }],
    }),

    deleteTag: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/chat/tags/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'ChatTags', id: 'LIST' }],
    }),

    // --- Health ---
    healthCheck: builder.query<SearchHealth, void>({
      query: () => ({
        url: '/api/search/health/',
        method: 'GET',
      }),
      providesTags: [{ type: 'SearchHealth', id: 'STATUS' }],
    }),
  }),
});

export const {
  useListSessionsQuery,
  useGetSessionQuery,
  useCreateSessionMutation,
  useUpdateSessionMutation,
  useShareSessionMutation,
  useUnshareSessionMutation,
  useSendMessageMutation,
  useTriggerCrawlMutation,
  useGetCrawlStatusQuery,
  useSaveToNicheMutation,
  useListTagsQuery,
  useCreateTagMutation,
  useDeleteTagMutation,
  useHealthCheckQuery,
} = searchApi;
