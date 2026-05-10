import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';

// Mirrors UserSearchHistory.Context.choices in user_auth_app/models.py.
// Add new contexts here when introducing new research surfaces.
export type SearchHistoryContext = 'amazon_research' | 'keyword_drilling';

export interface SearchHistoryEntry {
  id: string;
  context: SearchHistoryContext;
  keyword: string;
  marketplace: string;
  extra_metadata: Record<string, unknown>;
  created_at: string;
}

interface CreatePayload {
  context: SearchHistoryContext;
  keyword: string;
  marketplace?: string;
  extra_metadata?: Record<string, unknown>;
}

export const searchHistoryApi = createApi({
  reducerPath: 'searchHistoryApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['SearchHistory'],
  endpoints: (builder) => ({
    listSearchHistory: builder.query<SearchHistoryEntry[], { context: SearchHistoryContext }>({
      query: ({ context }) => ({
        url: '/api/users/me/search-history/',
        method: 'GET',
        params: { context },
      }),
      providesTags: (_result, _error, { context }) => [
        { type: 'SearchHistory', id: context },
      ],
    }),
    createSearchHistory: builder.mutation<SearchHistoryEntry, CreatePayload>({
      query: (payload) => ({
        url: '/api/users/me/search-history/',
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: (_result, _error, { context }) => [
        { type: 'SearchHistory', id: context },
      ],
    }),
    deleteSearchHistory: builder.mutation<void, { id: string; context: SearchHistoryContext }>({
      query: ({ id }) => ({
        url: `/api/users/me/search-history/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { context }) => [
        { type: 'SearchHistory', id: context },
      ],
    }),
    clearSearchHistory: builder.mutation<{ deleted: number }, { context: SearchHistoryContext }>({
      query: ({ context }) => ({
        url: '/api/users/me/search-history/clear/',
        method: 'DELETE',
        params: { context },
      }),
      invalidatesTags: (_result, _error, { context }) => [
        { type: 'SearchHistory', id: context },
      ],
    }),
  }),
});

export const {
  useListSearchHistoryQuery,
  useCreateSearchHistoryMutation,
  useDeleteSearchHistoryMutation,
  useClearSearchHistoryMutation,
} = searchHistoryApi;
