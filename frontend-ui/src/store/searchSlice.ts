import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  ChatGroup,
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
  tagTypes: ['ChatSessions', 'ChatMessages', 'CrawlJobs', 'SearchHealth', 'ChatGroups'],
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

    // --- Chat Groups (FIX-chat-bugfixes-and-grouping Item 7) ---
    // Workspace-scoped folders for ChatSession rows in the sidebar.
    // Sessions with `group=null` render in a virtual "Ungrouped" section
    // (no DB row — purely a UI grouping).
    getChatGroups: builder.query<ChatGroup[], void>({
      query: () => ({
        url: '/api/chat/groups/',
        method: 'GET',
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'ChatGroups' as const, id })),
              { type: 'ChatGroups', id: 'LIST' },
            ]
          : [{ type: 'ChatGroups', id: 'LIST' }],
    }),

    createChatGroup: builder.mutation<ChatGroup, { name: string }>({
      query: (body) => ({
        url: '/api/chat/groups/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'ChatGroups', id: 'LIST' }],
    }),

    renameChatGroup: builder.mutation<ChatGroup, { id: string; name: string }>({
      query: ({ id, name }) => ({
        url: `/api/chat/groups/${id}/`,
        method: 'PATCH',
        data: { name },
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'ChatGroups', id },
        { type: 'ChatGroups', id: 'LIST' },
      ],
    }),

    deleteChatGroup: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/api/chat/groups/${id}/`,
        method: 'DELETE',
      }),
      // Group delete sets `ChatSession.group = NULL` via SET_NULL; refresh both
      // groups + sessions caches so the moved chats appear under Ungrouped.
      invalidatesTags: [
        { type: 'ChatGroups', id: 'LIST' },
        { type: 'ChatSessions', id: 'LIST' },
      ],
    }),

    reorderChatGroups: builder.mutation<void, { ordered_ids: string[] }>({
      query: ({ ordered_ids }) => ({
        url: '/api/chat/groups/reorder/',
        method: 'POST',
        data: { ordered_ids },
      }),
      // Optimistic resequence of the groups list cache; revert + invalidate on
      // failure so the server's ground truth wins.
      async onQueryStarted({ ordered_ids }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          searchApi.util.updateQueryData('getChatGroups', undefined, (draft) => {
            const indexById = new Map(
              ordered_ids.map((id, idx) => [id, idx] as const),
            );
            draft.sort((a, b) => {
              const ai = indexById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
              const bi = indexById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
              return ai - bi;
            });
            ordered_ids.forEach((id, idx) => {
              const row = draft.find((g) => g.id === id);
              if (row) row.ordering = idx + 1;
            });
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: 'ChatGroups', id: 'LIST' }],
    }),

    moveChatToGroup: builder.mutation<
      ChatSession,
      { sessionId: string; groupId: string | null }
    >({
      query: ({ sessionId, groupId }) => ({
        url: `/api/chat/sessions/${sessionId}/`,
        method: 'PATCH',
        data: { group: groupId },
      }),
      // Optimistic patch: flip the moved session's `group` field in the
      // listSessions cache so the row re-renders in the destination section
      // immediately, without waiting for the post-mutation refetch. Without
      // this the chat briefly disappears (old section filters it out via the
      // now-stale `group=null`, new section's session_count badge bumps via
      // ChatGroups refetch, but the row itself is in transit until the
      // ChatSessions refetch lands).
      async onQueryStarted(
        { sessionId, groupId },
        { dispatch, queryFulfilled },
      ) {
        const patch = dispatch(
          searchApi.util.updateQueryData(
            'listSessions',
            { page_size: 10 } as SessionListParams,
            (draft) => {
              const row = draft.results.find((s) => s.id === sessionId);
              if (row) {
                row.group = groupId;
                // Append to end of destination — backend assigns
                // group_ordering = max + 1; mirror that here so the row
                // appears at the bottom of the destination section instead
                // of jumping to position 0.
                row.group_ordering = Number.MAX_SAFE_INTEGER;
              }
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      // Invalidate the sessions list (chat row moves between sections) and any
      // affected group id tags so `session_count` refreshes for source + dest.
      invalidatesTags: (_r, _e, { groupId }) => {
        const tags: Array<
          | { type: 'ChatSessions'; id: string }
          | { type: 'ChatGroups'; id: string }
        > = [{ type: 'ChatSessions', id: 'LIST' }];
        if (groupId) tags.push({ type: 'ChatGroups', id: groupId });
        // Also refresh the LIST tag so session_count totals re-compute even if
        // the source group's id isn't known to this caller.
        tags.push({ type: 'ChatGroups', id: 'LIST' } as unknown as {
          type: 'ChatGroups';
          id: string;
        });
        return tags;
      },
    }),

    reorderChatsInGroup: builder.mutation<
      void,
      { groupId: string | null; ordered_ids: string[] }
    >({
      query: ({ groupId, ordered_ids }) => ({
        url: '/api/chat/sessions/reorder-in-group/',
        method: 'POST',
        data: { group_id: groupId, ordered_ids },
      }),
      // Optimistic patch of the session list cache: reassign `group` and
      // `group_ordering` for the touched ids; revert on failure.
      async onQueryStarted(
        { groupId, ordered_ids },
        { dispatch, queryFulfilled },
      ) {
        const patch = dispatch(
          searchApi.util.updateQueryData(
            'listSessions',
            { page_size: 10 } as SessionListParams,
            (draft) => {
              ordered_ids.forEach((id, idx) => {
                const row = draft.results.find((s) => s.id === id);
                if (row) {
                  row.group = groupId;
                  row.group_ordering = idx + 1;
                }
              });
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: 'ChatSessions', id: 'LIST' }],
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
  // FIX-chat-bugfixes-and-grouping Item 7
  useGetChatGroupsQuery,
  useCreateChatGroupMutation,
  useRenameChatGroupMutation,
  useDeleteChatGroupMutation,
  useReorderChatGroupsMutation,
  useMoveChatToGroupMutation,
  useReorderChatsInGroupMutation,
} = searchApi;
