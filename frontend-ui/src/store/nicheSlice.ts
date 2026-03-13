import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  Niche,
  NicheListResponse,
  NicheListParams,
  NicheCreateBody,
  NicheUpdateBody,
  NicheBulkPayload,
  NicheBulkResponse,
} from '../views/niches/list/types';

export const nicheApi = createApi({
  reducerPath: 'nicheApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['Niche', 'NicheList'],
  endpoints: (builder) => ({
    listNiches: builder.query<NicheListResponse, NicheListParams>({
      query: (params) => ({
        url: '/api/niches/',
        method: 'GET',
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({
                type: 'Niche' as const,
                id,
              })),
              { type: 'NicheList', id: 'LIST' },
            ]
          : [{ type: 'NicheList', id: 'LIST' }],
    }),

    getNiche: builder.query<Niche, string>({
      query: (id) => ({
        url: `/api/niches/${id}/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'Niche', id }],
    }),

    createNiche: builder.mutation<Niche, NicheCreateBody>({
      query: (body) => ({
        url: '/api/niches/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'NicheList', id: 'LIST' }],
    }),

    updateNiche: builder.mutation<Niche, { id: string; body: NicheUpdateBody }>({
      query: ({ id, body }) => ({
        url: `/api/niches/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Niche', id },
        { type: 'NicheList', id: 'LIST' },
      ],
    }),

    deleteNiche: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/niches/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Niche', id },
        { type: 'NicheList', id: 'LIST' },
      ],
    }),

    bulkNicheAction: builder.mutation<NicheBulkResponse, NicheBulkPayload>({
      query: (body) => ({
        url: '/api/niches/bulk/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'NicheList', id: 'LIST' }],
    }),
  }),
});

export const {
  useListNichesQuery,
  useGetNicheQuery,
  useCreateNicheMutation,
  useUpdateNicheMutation,
  useDeleteNicheMutation,
  useBulkNicheActionMutation,
} = nicheApi;
