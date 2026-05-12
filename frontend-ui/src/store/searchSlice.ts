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
  CreateShareLinkResponse,
  PublicChatSession,
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

    // PROJ-20 Phase 2: delete a single ChatMessage (used by Regenerate flow).
    // Backend returns 204 No Content on success → resolve as `void`.
    deleteMessage: builder.mutation<void, string>({
      query: (messageId) => ({
        url: `/api/chat/messages/${messageId}/`,
        method: 'DELETE',
      }),
      // We don't know the sessionId here, but the assistant message was attached
      // to the active session — invalidate the LIST tag to refresh counts and
      // let the caller manually refetch the session detail if needed.
      invalidatesTags: [{ type: 'ChatSessions', id: 'LIST' }],
    }),

    // PROJ-29 Phase 1F: delete a single ChatSession (cascade-removes ChatMessages).
    // Backend returns 204 No Content. Optimistic update removes the row from
    // the cached list immediately; rolled back on failure.
    deleteSession: builder.mutation<void, string>({
      query: (sessionId) => ({
        url: `/api/chat/sessions/${sessionId}/`,
        method: 'DELETE',
      }),
      async onQueryStarted(sessionId, { dispatch, queryFulfilled }) {
        // Optimistically remove the row from the cached list. Rollback on
        // failure. RecentChats uses `{ page_size: 10 }`; we patch that key.
        const patch = dispatch(
          searchApi.util.updateQueryData(
            'listSessions',
            { page_size: 10 } as SessionListParams,
            (draft) => {
              draft.results = draft.results.filter((s) => s.id !== sessionId);
              draft.count = Math.max(0, draft.count - 1);
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_r, _e, id) => [
        { type: 'ChatSessions', id },
        { type: 'ChatSessions', id: 'LIST' },
      ],
    }),

    // PROJ-29 Phase 1F: bulk-delete all sessions for the active user in the
    // active workspace. Body must include `confirm_purge: 'all'` — backend
    // returns `{ deleted_count }`.
    purgeAllSessions: builder.mutation<{ deleted_count: number }, void>({
      query: () => ({
        url: '/api/chat/sessions/',
        method: 'DELETE',
        data: { confirm_purge: 'all' },
      }),
      invalidatesTags: [{ type: 'ChatSessions', id: 'LIST' }],
    }),

    // PROJ-20 Phase 1.3 / Phase 2: create (or re-fetch) a public share-link for a session.
    // Backend is idempotent — repeated calls return the same token/url.
    createShareLink: builder.mutation<CreateShareLinkResponse, string>({
      query: (sessionId) => ({
        url: `/api/chat/sessions/${sessionId}/share/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, sessionId) => [
        { type: 'ChatSessions', id: sessionId },
        { type: 'ChatSessions', id: 'LIST' },
      ],
    }),

    // PROJ-20 Phase 1.3 / Phase 2: public read-only fetch by share-token.
    // No auth required — endpoint accepts AllowAny on the backend. The cookie
    // may still be sent by axios; backend ignores it for this view.
    getPublicSession: builder.query<PublicChatSession, string>({
      query: (token) => ({
        url: `/api/chat/sessions/shared/${token}/`,
        method: 'GET',
      }),
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
  useDeleteMessageMutation,
  useDeleteSessionMutation,
  usePurgeAllSessionsMutation,
  useCreateShareLinkMutation,
  useGetPublicSessionQuery,
  useTriggerCrawlMutation,
  useGetCrawlStatusQuery,
  useSaveToNicheMutation,
  useSaveSnippetToNicheMutation,
  useHealthCheckQuery,
} = searchApi;
