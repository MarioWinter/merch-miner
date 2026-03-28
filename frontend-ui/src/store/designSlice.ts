import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  BoardContext,
  Design,
  DesignGenerationRun,
  DesignProcessingJob,
  GenerateDesignBody,
  AnalyzeImageBody,
  UpdateDesignStatusBody,
  BatchProcessBody,
} from '../views/designs/board/types';

export const designApi = createApi({
  reducerPath: 'designApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['DesignBoard', 'Design', 'DesignList', 'Run', 'ProcessingJob'],
  endpoints: (builder) => ({
    // Board context (idea-scoped)
    getBoardContext: builder.query<BoardContext, string>({
      query: (ideaId) => ({
        url: `/api/ideas/${ideaId}/design-board/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, ideaId) => [
        { type: 'DesignBoard', id: ideaId },
      ],
    }),

    // List designs for an idea
    listDesigns: builder.query<Design[], string>({
      query: (ideaId) => ({
        url: `/api/ideas/${ideaId}/designs/`,
        method: 'GET',
      }),
      providesTags: (result, _error, ideaId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Design' as const, id })),
              { type: 'DesignList', id: ideaId },
            ]
          : [{ type: 'DesignList', id: ideaId }],
    }),

    // Trigger design generation
    generateDesign: builder.mutation<
      DesignGenerationRun,
      { ideaId: string; body: GenerateDesignBody }
    >({
      query: ({ ideaId, body }) => ({
        url: `/api/ideas/${ideaId}/designs/generate/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { ideaId }) => [
        { type: 'DesignBoard', id: ideaId },
        { type: 'DesignList', id: ideaId },
      ],
    }),

    // Trigger image analysis on a design
    analyzeImage: builder.mutation<
      DesignGenerationRun,
      { designId: string; body: AnalyzeImageBody }
    >({
      query: ({ designId, body }) => ({
        url: `/api/designs/${designId}/analyze-image/`,
        method: 'POST',
        data: body,
      }),
    }),

    // Poll run status
    getRunStatus: builder.query<DesignGenerationRun, string>({
      query: (runId) => ({
        url: `/api/designs/runs/${runId}/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, runId) => [{ type: 'Run', id: runId }],
    }),

    // Update design status (approve/reject)
    updateDesignStatus: builder.mutation<
      Design,
      { designId: string; body: UpdateDesignStatusBody; ideaId: string }
    >({
      query: ({ designId, body }) => ({
        url: `/api/designs/${designId}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_result, _error, { ideaId }) => [
        { type: 'DesignBoard', id: ideaId },
        { type: 'DesignList', id: ideaId },
      ],
    }),

    // Delete design
    deleteDesign: builder.mutation<void, { designId: string; ideaId: string }>({
      query: ({ designId }) => ({
        url: `/api/designs/${designId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { ideaId }) => [
        { type: 'DesignBoard', id: ideaId },
        { type: 'DesignList', id: ideaId },
      ],
    }),

    // Batch process (upscale + bg_remove)
    batchProcess: builder.mutation<DesignProcessingJob[], BatchProcessBody>({
      query: (body) => ({
        url: '/api/designs/batch-process/',
        method: 'POST',
        data: body,
      }),
    }),

    // Poll processing job status
    getProcessingJob: builder.query<DesignProcessingJob, string>({
      query: (jobId) => ({
        url: `/api/designs/processing-jobs/${jobId}/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, jobId) => [
        { type: 'ProcessingJob', id: jobId },
      ],
    }),
  }),
});

export const {
  useGetBoardContextQuery,
  useListDesignsQuery,
  useGenerateDesignMutation,
  useAnalyzeImageMutation,
  useGetRunStatusQuery,
  useUpdateDesignStatusMutation,
  useDeleteDesignMutation,
  useBatchProcessMutation,
  useGetProcessingJobQuery,
} = designApi;
