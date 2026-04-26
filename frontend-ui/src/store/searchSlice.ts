import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  ChatSession,
  ChatSessionDetail,
  ChatSessionListResponse,
  ChatMessage,
  WebSearchResult,
  SearchHealth,
  CreateSessionBody,
  SendMessageBody,
  TriggerCrawlBody,
  SaveToNicheBody,
  SaveSnippetBody,
  SaveSnippetResponse,
  UpdateSessionBody,
  SessionListParams,
} from '../types/search';
import { keywordApi } from './keywordSlice';
import { nicheApi } from './nicheSlice';

export const searchApi = createApi({
  reducerPath: 'searchApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['ChatSessions', 'ChatMessages', 'CrawlJobs', 'SearchHealth'],
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
      // Cross-API invalidation (RTK tags don't span APIs) — refresh keyword list + niche detail
      async onQueryStarted({ body }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            keywordApi.util.invalidateTags([
              { type: 'NicheKeywords', id: `NICHE_${body.niche_id}` },
            ]),
          );
          dispatch(
            nicheApi.util.invalidateTags([{ type: 'Niche', id: body.niche_id }]),
          );
        } catch {
          /* mutation failed -- nothing to invalidate */
        }
      },
    }),

    // PROJ-17 AC-50–53: niche-scoped save-snippet endpoint (no result_id required).
    saveSnippetToNiche: builder.mutation<
      SaveSnippetResponse,
      { nicheId: string; body: SaveSnippetBody }
    >({
      query: ({ nicheId, body }) => ({
        url: `/api/niches/${nicheId}/save-snippet/`,
        method: 'POST',
        data: body,
      }),
      async onQueryStarted({ nicheId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(
            keywordApi.util.invalidateTags([
              { type: 'NicheKeywords', id: `NICHE_${nicheId}` },
            ]),
          );
          dispatch(
            nicheApi.util.invalidateTags([{ type: 'Niche', id: nicheId }]),
          );
        } catch {
          /* mutation failed -- nothing to invalidate */
        }
      },
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
  useSaveSnippetToNicheMutation,
  useHealthCheckQuery,
} = searchApi;
