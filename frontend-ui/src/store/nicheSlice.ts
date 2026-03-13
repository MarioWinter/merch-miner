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
  FilterTemplate,
} from '../views/niches/list/types';
import type { NicheFilters } from '../views/niches/list/hooks/useNicheFilters';

export const nicheApi = createApi({
  reducerPath: 'nicheApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['Niche', 'NicheList', 'FilterTemplate'],
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

    listFilterTemplates: builder.query<FilterTemplate[], void>({
      query: () => ({
        url: '/api/niches/filter-templates/',
        method: 'GET',
        params: { page_size: 100 },
      }),
      transformResponse: (response: { results: FilterTemplate[] } | FilterTemplate[]) =>
        Array.isArray(response) ? response : (response.results ?? []),
      providesTags: [{ type: 'FilterTemplate', id: 'LIST' }],
    }),

    createFilterTemplate: builder.mutation<FilterTemplate, { name: string; filters: Partial<NicheFilters> }>({
      query: (body) => ({
        url: '/api/niches/filter-templates/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'FilterTemplate', id: 'LIST' }],
    }),

    updateFilterTemplate: builder.mutation<FilterTemplate, { id: string; name?: string; filters?: Partial<NicheFilters> }>({
      query: ({ id, ...body }) => ({
        url: `/api/niches/filter-templates/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: [{ type: 'FilterTemplate', id: 'LIST' }],
    }),

    deleteFilterTemplate: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/niches/filter-templates/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'FilterTemplate', id: 'LIST' }],
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
  useListFilterTemplatesQuery,
  useCreateFilterTemplateMutation,
  useUpdateFilterTemplateMutation,
  useDeleteFilterTemplateMutation,
} = nicheApi;
