import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  Idea,
  IdeaListResponse,
  IdeaListParams,
  IdeaCreateBody,
  IdeaUpdateBody,
  IdeaAdaptationRun,
  NicheSuggestion,
  BulkStatusBody,
  BulkStatusResponse,
  ExtractSloganBody,
  ExtractSloganResponse,
  ImproveBody,
} from '../views/ideas/types';

export const ideaApi = createApi({
  reducerPath: 'ideaApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['Idea', 'IdeaList', 'AdaptationRun', 'NicheSuggestion'],
  endpoints: (builder) => ({
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
      ],
    }),

    updateIdea: builder.mutation<Idea, { id: string; body: IdeaUpdateBody }>({
      query: ({ id, body }) => ({
        url: `/api/ideas/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Idea', id }],
    }),

    deleteIdea: builder.mutation<void, { id: string; nicheId: string }>({
      query: ({ id }) => ({
        url: `/api/ideas/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'IdeaList', id: nicheId },
      ],
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
  }),
});

export const {
  useListIdeasQuery,
  useCreateIdeaMutation,
  useUpdateIdeaMutation,
  useDeleteIdeaMutation,
  useBulkUpdateStatusMutation,
  useTriggerAdaptationMutation,
  useGetAdaptationRunQuery,
  useImproveIdeaMutation,
  useRegenerateIdeaMutation,
  useExtractSloganMutation,
  useSuggestNichesQuery,
} = ideaApi;
