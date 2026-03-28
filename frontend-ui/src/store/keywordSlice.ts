import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  KeywordSearchResponse,
  KeywordSearchParams,
  KeywordEnrichRequest,
  KeywordEnrichResult,
  KeywordHistoryPoint,
  KeywordHistoryParams,
  NicheKeywordListResponse,
  NicheKeywordListParams,
  NicheKeyword,
  AddKeywordBody,
  BulkAddKeywordsBody,
  UpdateKeywordBody,
  NicheKeywordGroup,
  CreateGroupBody,
  UpdateGroupBody,
} from '../views/amazon/keywords/research/types';

export const keywordApi = createApi({
  reducerPath: 'keywordApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['NicheKeywords', 'KeywordGroups', 'KeywordSearch'],
  endpoints: (builder) => ({
    // --- Keyword Research ---

    searchKeywords: builder.query<KeywordSearchResponse, KeywordSearchParams>({
      query: (params) => ({
        url: '/api/keywords/search/',
        method: 'GET',
        params,
      }),
      providesTags: ['KeywordSearch'],
    }),

    enrichKeywords: builder.mutation<KeywordEnrichResult[], KeywordEnrichRequest>({
      query: (body) => ({
        url: '/api/keywords/enrich/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['KeywordSearch'],
    }),

    getKeywordHistory: builder.query<KeywordHistoryPoint[], KeywordHistoryParams>({
      query: ({ keyword, ...params }) => ({
        url: `/api/keywords/${encodeURIComponent(keyword)}/history/`,
        method: 'GET',
        params,
      }),
    }),

    // --- Niche Keywords CRUD ---

    listNicheKeywords: builder.query<NicheKeywordListResponse, NicheKeywordListParams>({
      query: ({ nicheId, ...params }) => ({
        url: `/api/niches/${nicheId}/keywords/`,
        method: 'GET',
        params,
      }),
      providesTags: (result, _error, { nicheId }) =>
        result
          ? [
              ...result.results.map(({ id }) => ({
                type: 'NicheKeywords' as const,
                id,
              })),
              { type: 'NicheKeywords', id: `NICHE_${nicheId}` },
            ]
          : [{ type: 'NicheKeywords', id: `NICHE_${nicheId}` }],
    }),

    addKeyword: builder.mutation<NicheKeyword, { nicheId: string; body: AddKeywordBody }>({
      query: ({ nicheId, body }) => ({
        url: `/api/niches/${nicheId}/keywords/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'NicheKeywords', id: `NICHE_${nicheId}` },
      ],
    }),

    bulkAddKeywords: builder.mutation<
      { added: number; skipped: number },
      { nicheId: string; body: BulkAddKeywordsBody }
    >({
      query: ({ nicheId, body }) => ({
        url: `/api/niches/${nicheId}/keywords/bulk-add/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'NicheKeywords', id: `NICHE_${nicheId}` },
      ],
    }),

    deleteKeyword: builder.mutation<void, { nicheId: string; keywordId: string }>({
      query: ({ nicheId, keywordId }) => ({
        url: `/api/niches/${nicheId}/keywords/${keywordId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'NicheKeywords', id: `NICHE_${nicheId}` },
      ],
    }),

    bulkDeleteKeywords: builder.mutation<void, { nicheId: string; ids: string[] }>({
      query: ({ nicheId, ids }) => ({
        url: `/api/niches/${nicheId}/keywords/bulk-delete/`,
        method: 'POST',
        data: { ids },
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'NicheKeywords', id: `NICHE_${nicheId}` },
      ],
    }),

    updateKeyword: builder.mutation<
      NicheKeyword,
      { nicheId: string; keywordId: string; body: UpdateKeywordBody }
    >({
      query: ({ nicheId, keywordId, body }) => ({
        url: `/api/niches/${nicheId}/keywords/${keywordId}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'NicheKeywords', id: `NICHE_${nicheId}` },
      ],
    }),

    // --- Keyword Groups ---

    listKeywordGroups: builder.query<NicheKeywordGroup[], string>({
      query: (nicheId) => ({
        url: `/api/niches/${nicheId}/keyword-groups/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, nicheId) => [
        { type: 'KeywordGroups', id: nicheId },
      ],
    }),

    createKeywordGroup: builder.mutation<
      NicheKeywordGroup,
      { nicheId: string; body: CreateGroupBody }
    >({
      query: ({ nicheId, body }) => ({
        url: `/api/niches/${nicheId}/keyword-groups/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'KeywordGroups', id: nicheId },
      ],
    }),

    updateKeywordGroup: builder.mutation<
      NicheKeywordGroup,
      { nicheId: string; groupId: string; body: UpdateGroupBody }
    >({
      query: ({ nicheId, groupId, body }) => ({
        url: `/api/niches/${nicheId}/keyword-groups/${groupId}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'KeywordGroups', id: nicheId },
      ],
    }),

    deleteKeywordGroup: builder.mutation<void, { nicheId: string; groupId: string }>({
      query: ({ nicheId, groupId }) => ({
        url: `/api/niches/${nicheId}/keyword-groups/${groupId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'KeywordGroups', id: nicheId },
        { type: 'NicheKeywords', id: `NICHE_${nicheId}` },
      ],
    }),
  }),
});

export const {
  useSearchKeywordsQuery,
  useLazySearchKeywordsQuery,
  useEnrichKeywordsMutation,
  useGetKeywordHistoryQuery,
  useLazyGetKeywordHistoryQuery,
  useListNicheKeywordsQuery,
  useAddKeywordMutation,
  useBulkAddKeywordsMutation,
  useDeleteKeywordMutation,
  useBulkDeleteKeywordsMutation,
  useUpdateKeywordMutation,
  useListKeywordGroupsQuery,
  useCreateKeywordGroupMutation,
  useUpdateKeywordGroupMutation,
  useDeleteKeywordGroupMutation,
} = keywordApi;
