import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  Idea,
  IdeaListResponse,
  IdeaListParams,
  IdeaListAllParams,
  IdeaCreateBody,
  IdeaUpdateBody,
  IdeaAdaptationRun,
  NicheSuggestion,
  BulkStatusBody,
  BulkStatusResponse,
  ExtractSloganBody,
  ExtractSloganResponse,
  ImproveBody,
  ImportIdeasBody,
  ImportIdeasResponse,
  IdeaFilterTemplate,
  IdeaFilters,
} from '../views/ideas/types';

export const ideaApi = createApi({
  reducerPath: 'ideaApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['Idea', 'IdeaList', 'AdaptationRun', 'NicheSuggestion', 'IdeaFilterTemplate'],
  endpoints: (builder) => ({
    /** Workspace-wide list: GET /api/ideas/ */
    listAllIdeas: builder.query<IdeaListResponse, IdeaListAllParams>({
      query: (params) => {
        const cleaned: Record<string, string> = {};
        if (params.niche_id) cleaned.niche_id = params.niche_id;
        if (params.status) cleaned.status = params.status;
        if (params.signal_type) cleaned.signal_type = params.signal_type;
        if (params.is_orphan) cleaned.is_orphan = 'true';
        if (params.ordering) cleaned.ordering = params.ordering;
        if (params.page && params.page > 1) cleaned.page = String(params.page);
        if (params.page_size) cleaned.page_size = String(params.page_size);
        return { url: '/api/ideas/', method: 'GET', params: cleaned };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({
                type: 'Idea' as const,
                id,
              })),
              { type: 'IdeaList', id: 'ALL' },
            ]
          : [{ type: 'IdeaList', id: 'ALL' }],
    }),

    /** Niche-scoped list (existing, for Drawer contexts) */
    listIdeas: builder.query<
      IdeaListResponse,
      { nicheId: string } & IdeaListParams
    >({
      query: ({ nicheId, ...params }) => ({
        url: `/api/niches/${nicheId}/ideas/`,
        method: 'GET',
        params,
      }),
      providesTags: (result, _error, { nicheId }) =>
        result
          ? [
              ...result.results.map(({ id }) => ({
                type: 'Idea' as const,
                id,
              })),
              { type: 'IdeaList', id: nicheId },
            ]
          : [{ type: 'IdeaList', id: nicheId }],
    }),

    /** Workspace-wide create: POST /api/ideas/ */
    createIdeaGlobal: builder.mutation<Idea | Idea[], IdeaCreateBody>({
      query: (body) => ({
        url: '/api/ideas/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'IdeaList', id: 'ALL' }],
    }),

    /** Niche-scoped create (existing) */
    createIdea: builder.mutation<
      Idea | Idea[],
      { nicheId: string; body: IdeaCreateBody }
    >({
      query: ({ nicheId, body }) => ({
        url: `/api/niches/${nicheId}/ideas/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'IdeaList', id: nicheId },
        { type: 'IdeaList', id: 'ALL' },
      ],
    }),

    /** Import: POST /api/ideas/import/ */
    importIdeas: builder.mutation<ImportIdeasResponse, ImportIdeasBody>({
      query: (body) => ({
        url: '/api/ideas/import/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'IdeaList', id: 'ALL' }],
    }),

    updateIdea: builder.mutation<Idea, { id: string; body: IdeaUpdateBody }>({
      query: ({ id, body }) => ({
        url: `/api/ideas/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Idea', id },
        { type: 'IdeaList', id: 'ALL' },
      ],
    }),

    deleteIdea: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/api/ideas/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'IdeaList', id: 'ALL' }],
    }),

    bulkUpdateStatus: builder.mutation<BulkStatusResponse, BulkStatusBody>({
      query: (body) => ({
        url: '/api/ideas/bulk-status/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['IdeaList'],
    }),

    triggerAdaptation: builder.mutation<
      IdeaAdaptationRun,
      { ideaId: string; target_niche_ids: string[] }
    >({
      query: ({ ideaId, target_niche_ids }) => ({
        url: `/api/ideas/${ideaId}/adapt/`,
        method: 'POST',
        data: { target_niche_ids },
      }),
      invalidatesTags: ['IdeaList'],
    }),

    getAdaptationRun: builder.query<IdeaAdaptationRun, string>({
      query: (runId) => ({
        url: `/api/ideas/adaptation-runs/${runId}/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, runId) => [
        { type: 'AdaptationRun', id: runId },
      ],
    }),

    improveIdea: builder.mutation<Idea[], { id: string; body: ImproveBody }>({
      query: ({ id, body }) => ({
        url: `/api/ideas/${id}/improve/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['IdeaList'],
    }),

    regenerateIdea: builder.mutation<Idea, string>({
      query: (id) => ({
        url: `/api/ideas/${id}/regenerate/`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [{ type: 'Idea', id }],
    }),

    extractSlogan: builder.mutation<ExtractSloganResponse, ExtractSloganBody>({
      query: (body) => ({
        url: '/api/ideas/extract-slogan/',
        method: 'POST',
        data: body,
      }),
    }),

    suggestNiches: builder.query<NicheSuggestion[], string>({
      query: (ideaId) => ({
        url: `/api/ideas/${ideaId}/suggest-niches/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, ideaId) => [
        { type: 'NicheSuggestion', id: ideaId },
      ],
    }),

    /** Filter templates: GET /api/ideas/filter-templates/ */
    listIdeaFilterTemplates: builder.query<IdeaFilterTemplate[], void>({
      query: () => ({
        url: '/api/ideas/filter-templates/',
        method: 'GET',
      }),
      transformResponse: (
        response: { results: IdeaFilterTemplate[] } | IdeaFilterTemplate[],
      ) => (Array.isArray(response) ? response : response.results),
      providesTags: [{ type: 'IdeaFilterTemplate', id: 'LIST' }],
    }),

    /** Create filter template */
    createIdeaFilterTemplate: builder.mutation<
      IdeaFilterTemplate,
      { name: string; filters: Partial<IdeaFilters> }
    >({
      query: (body) => ({
        url: '/api/ideas/filter-templates/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'IdeaFilterTemplate', id: 'LIST' }],
    }),

    /** Update filter template */
    updateIdeaFilterTemplate: builder.mutation<
      IdeaFilterTemplate,
      { id: string; name?: string; filters?: Partial<IdeaFilters> }
    >({
      query: ({ id, ...body }) => ({
        url: `/api/ideas/filter-templates/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: [{ type: 'IdeaFilterTemplate', id: 'LIST' }],
    }),

    /** Delete filter template */
    deleteIdeaFilterTemplate: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/ideas/filter-templates/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'IdeaFilterTemplate', id: 'LIST' }],
    }),
  }),
});

export const {
  useListAllIdeasQuery,
  useListIdeasQuery,
  useCreateIdeaGlobalMutation,
  useCreateIdeaMutation,
  useImportIdeasMutation,
  useUpdateIdeaMutation,
  useDeleteIdeaMutation,
  useBulkUpdateStatusMutation,
  useTriggerAdaptationMutation,
  useGetAdaptationRunQuery,
  useImproveIdeaMutation,
  useRegenerateIdeaMutation,
  useExtractSloganMutation,
  useSuggestNichesQuery,
  useListIdeaFilterTemplatesQuery,
  useCreateIdeaFilterTemplateMutation,
  useUpdateIdeaFilterTemplateMutation,
  useDeleteIdeaFilterTemplateMutation,
} = ideaApi;
