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
import type {
  DesignPipeline,
  CreatePipelineBody,
  UpdatePipelineBody,
  ApplyPipelineBody,
  ApplyPipelineResult,
} from '../views/designs/editor/types';
import type {
  DesignProject,
  DesignProjectListResponse,
  CreateProjectBody,
  UpdateProjectBody,
  AddDesignsToProjectBody,
  ProjectBoardResponse,
  AddIdeasBody,
  ProjectPrompt,
  CreatePromptsBody,
  BuildPromptsBody,
  BuildPromptsResponse,
  PromptPreset,
} from '../views/designs/gallery/types';

// --- Processing Settings types ---

export interface ProcessingSettings {
  bg_removal_provider: 'rembg' | 'api';
  bg_removal_api_key_set: boolean;
  upscale_provider: 'pica' | 'api' | 'auto';
  upscale_api_key_set: boolean;
  upscale_auto_threshold: number;
}

export interface UpdateProcessingSettingsBody {
  bg_removal_provider?: 'rembg' | 'api';
  bg_removal_api_key?: string;
  upscale_provider?: 'pica' | 'api' | 'auto';
  upscale_api_key?: string;
  upscale_auto_threshold?: number;
}

/** Response from POST /api/products/{id}/analyze-image/ */
export interface ProductAnalyzeResponse {
  status: 'reused' | 'pending';
  product_id: string;
  prompt_analysis?: Record<string, unknown> | null;
  job_id?: string;
}

export const designApi = createApi({
  reducerPath: 'designApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['DesignBoard', 'Design', 'DesignList', 'Run', 'ProcessingJob', 'Pipeline', 'DesignProject', 'DesignProjectList', 'ProcessingSettings'],
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
    listDesigns: builder.query<{ results: Design[]; count: number }, string>({
      query: (ideaId) => ({
        url: `/api/ideas/${ideaId}/designs/`,
        method: 'GET',
      }),
      providesTags: (result, _error, ideaId) =>
        result?.results
          ? [
              ...result.results.map(({ id }) => ({ type: 'Design' as const, id })),
              { type: 'DesignList', id: ideaId },
            ]
          : [{ type: 'DesignList', id: ideaId }],
    }),

    // Trigger design generation (idea-scoped, legacy)
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

    // Trigger design generation (project-scoped, standalone)
    generateDesignForProject: builder.mutation<
      DesignGenerationRun & { project_id: string },
      GenerateDesignBody
    >({
      query: (body) => ({
        url: '/api/designs/generate/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (result) =>
        result
          ? [
              { type: 'DesignProject', id: result.project_id },
              { type: 'DesignProjectList', id: 'LIST' },
            ]
          : [],
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

    // Trigger image analysis on an AmazonProduct (PROJ-7 integration)
    analyzeProductImage: builder.mutation<
      ProductAnalyzeResponse,
      { productId: string; sourceImageUrl: string; projectId?: string }
    >({
      query: ({ productId, sourceImageUrl }) => ({
        url: `/api/products/${productId}/analyze-image/`,
        method: 'POST',
        data: { source_image_url: sourceImageUrl },
      }),
      invalidatesTags: (_result, _error, { projectId }) =>
        projectId ? [{ type: 'DesignProject', id: projectId }] : [],
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
      { designId: string; body: UpdateDesignStatusBody; ideaId?: string; projectId?: string }
    >({
      query: ({ designId, body }) => ({
        url: `/api/designs/${designId}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_result, _error, { ideaId, projectId }) => {
        const tags: Array<{ type: 'DesignBoard' | 'DesignList' | 'DesignProject'; id: string }> = [];
        if (ideaId) {
          tags.push({ type: 'DesignBoard', id: ideaId });
          tags.push({ type: 'DesignList', id: ideaId });
        }
        if (projectId) {
          tags.push({ type: 'DesignProject', id: projectId });
        }
        return tags;
      },
    }),

    // Delete design
    deleteDesign: builder.mutation<void, { designId: string; ideaId?: string; projectId?: string }>({
      query: ({ designId }) => ({
        url: `/api/designs/${designId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { ideaId, projectId }) => {
        const tags: Array<{ type: 'DesignBoard' | 'DesignList' | 'DesignProject' | 'DesignProjectList'; id: string }> = [];
        if (ideaId) {
          tags.push({ type: 'DesignBoard', id: ideaId });
          tags.push({ type: 'DesignList', id: ideaId });
        }
        if (projectId) {
          tags.push({ type: 'DesignProject', id: projectId });
          tags.push({ type: 'DesignProjectList', id: 'LIST' });
        }
        return tags;
      },
    }),

    // Save processed image — upload client-processed result to server
    saveProcessedImage: builder.mutation<Design, { designId: string; file: File; projectId?: string }>({
      query: ({ designId, file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: `/api/designs/${designId}/save-processed/`,
          method: 'POST',
          data: formData,
        };
      },
      invalidatesTags: (_result, _error, { projectId }) => {
        const tags: Array<{ type: 'DesignProject' | 'DesignProjectList'; id: string }> = [];
        if (projectId) {
          tags.push({ type: 'DesignProject', id: projectId });
        }
        return tags;
      },
    }),

    // Delete a specific version of a design (original, processed, bg_removed, upscaled)
    deleteDesignVersion: builder.mutation<Design, { designId: string; version: 'original' | 'processed' | 'bg_removed' | 'upscaled'; projectId?: string }>({
      query: ({ designId, version }) => ({
        url: `/api/designs/${designId}/delete-version/`,
        method: 'POST',
        data: { version },
      }),
      invalidatesTags: (_result, _error, { projectId }) => {
        const tags: Array<{ type: 'DesignProject' | 'DesignProjectList'; id: string }> = [];
        if (projectId) {
          tags.push({ type: 'DesignProject', id: projectId });
        }
        return tags;
      },
    }),

    // Revert design — delete processed files, keep original
    revertDesign: builder.mutation<void, { designId: string; projectId?: string }>({
      query: ({ designId }) => ({
        url: `/api/designs/${designId}/revert/`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { projectId }) => {
        const tags: Array<{ type: 'DesignProject' | 'DesignProjectList'; id: string }> = [];
        if (projectId) {
          tags.push({ type: 'DesignProject', id: projectId });
        }
        return tags;
      },
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

    // --- Pipeline endpoints ---

    // List workspace pipelines/presets
    listPipelines: builder.query<{ results: DesignPipeline[]; count: number }, void>({
      query: () => ({
        url: '/api/designs/pipelines/',
        method: 'GET',
      }),
      providesTags: (result) =>
        result?.results
          ? [
              ...result.results.map(({ id }) => ({ type: 'Pipeline' as const, id })),
              { type: 'Pipeline', id: 'LIST' },
            ]
          : [{ type: 'Pipeline', id: 'LIST' }],
    }),

    // Create pipeline
    createPipeline: builder.mutation<DesignPipeline, CreatePipelineBody>({
      query: (body) => ({
        url: '/api/designs/pipelines/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'Pipeline', id: 'LIST' }],
    }),

    // Update pipeline
    updatePipeline: builder.mutation<
      DesignPipeline,
      { pipelineId: string; body: UpdatePipelineBody }
    >({
      query: ({ pipelineId, body }) => ({
        url: `/api/designs/pipelines/${pipelineId}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_result, _error, { pipelineId }) => [
        { type: 'Pipeline', id: pipelineId },
        { type: 'Pipeline', id: 'LIST' },
      ],
    }),

    // Delete pipeline
    deletePipeline: builder.mutation<void, string>({
      query: (pipelineId) => ({
        url: `/api/designs/pipelines/${pipelineId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Pipeline', id: 'LIST' }],
    }),

    // Apply pipeline to designs
    applyPipeline: builder.mutation<ApplyPipelineResult, ApplyPipelineBody>({
      query: (body) => ({
        url: '/api/designs/apply-pipeline/',
        method: 'POST',
        data: body,
      }),
    }),

    // Fetch designs by IDs (for editor preload from URL params)
    getDesignsByIds: builder.query<Design[], string[]>({
      query: (ids) => ({
        url: `/api/designs/?ids=${ids.join(',')}`,
        method: 'GET',
      }),
      providesTags: (result) =>
        result
          ? result.map(({ id }) => ({ type: 'Design' as const, id }))
          : [],
    }),

    // --- Project endpoints (Phase C2) ---

    listProjects: builder.query<DesignProjectListResponse, void>({
      query: () => ({
        url: '/api/designs/projects/',
        method: 'GET',
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({
                type: 'DesignProject' as const,
                id,
              })),
              { type: 'DesignProjectList', id: 'LIST' },
            ]
          : [{ type: 'DesignProjectList', id: 'LIST' }],
    }),

    createProject: builder.mutation<DesignProject, CreateProjectBody>({
      query: (body) => ({
        url: '/api/designs/projects/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'DesignProjectList', id: 'LIST' }],
    }),

    getProject: builder.query<DesignProject, string>({
      query: (id) => ({
        url: `/api/designs/projects/${id}/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, id) => [{ type: 'DesignProject', id }],
    }),

    updateProject: builder.mutation<
      DesignProject,
      { projectId: string; body: UpdateProjectBody }
    >({
      query: ({ projectId, body }) => ({
        url: `/api/designs/projects/${projectId}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
        { type: 'DesignProjectList', id: 'LIST' },
      ],
    }),

    deleteProject: builder.mutation<void, string>({
      query: (projectId) => ({
        url: `/api/designs/projects/${projectId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'DesignProjectList', id: 'LIST' }],
    }),

    addDesignsToProject: builder.mutation<
      void,
      { projectId: string; body: AddDesignsToProjectBody }
    >({
      query: ({ projectId, body }) => ({
        url: `/api/designs/projects/${projectId}/designs/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
        { type: 'DesignProjectList', id: 'LIST' },
      ],
    }),

    removeDesignFromProject: builder.mutation<
      void,
      { projectId: string; designId: string }
    >({
      query: ({ projectId, designId }) => ({
        url: `/api/designs/projects/${projectId}/designs/${designId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
        { type: 'DesignProjectList', id: 'LIST' },
      ],
    }),

    getProjectBoard: builder.query<
      ProjectBoardResponse,
      { projectId: string; ideaId?: string }
    >({
      query: ({ projectId, ideaId }) => ({
        url: `/api/designs/projects/${projectId}/board/${ideaId ? `?ideaId=${ideaId}` : ''}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
      ],
    }),

    // --- Processing Settings ---

    getProcessingSettings: builder.query<ProcessingSettings, void>({
      query: () => ({
        url: '/api/designs/settings/',
        method: 'GET',
      }),
      providesTags: ['ProcessingSettings'],
    }),

    updateProcessingSettings: builder.mutation<ProcessingSettings, UpdateProcessingSettingsBody>({
      query: (data) => ({
        url: '/api/designs/settings/',
        method: 'PATCH',
        data,
      }),
      invalidatesTags: ['ProcessingSettings'],
    }),

    // Upload image to project (manual upload for artboard canvas)
    uploadDesignToProject: builder.mutation<
      Design,
      { projectId: string; file: File }
    >({
      query: ({ projectId, file }) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: `/api/designs/projects/${projectId}/upload/`,
          method: 'POST',
          data: formData,
        };
      },
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
        { type: 'DesignProjectList', id: 'LIST' },
      ],
    }),

    // --- Phase G: Slogan Pool + Prompt Builder ---

    // Add ideas to project pool
    addIdeasToProject: builder.mutation<
      void,
      { projectId: string; body: AddIdeasBody }
    >({
      query: ({ projectId, body }) => ({
        url: `/api/designs/projects/${projectId}/ideas/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
      ],
    }),

    // Remove idea from project pool
    removeIdeaFromProject: builder.mutation<
      void,
      { projectId: string; ideaId: string }
    >({
      query: ({ projectId, ideaId }) => ({
        url: `/api/designs/projects/${projectId}/ideas/${ideaId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
      ],
    }),

    // Create prompts (bulk)
    createPrompts: builder.mutation<
      ProjectPrompt[],
      { projectId: string; body: CreatePromptsBody }
    >({
      query: ({ projectId, body }) => ({
        url: `/api/designs/projects/${projectId}/prompts/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
      ],
    }),

    // Update a prompt
    updatePrompt: builder.mutation<
      ProjectPrompt,
      { projectId: string; promptId: string; prompt_text: string }
    >({
      query: ({ projectId, promptId, prompt_text }) => ({
        url: `/api/designs/projects/${projectId}/prompts/${promptId}/`,
        method: 'PATCH',
        data: { prompt_text },
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
      ],
    }),

    // Delete a prompt
    deletePrompt: builder.mutation<
      void,
      { projectId: string; promptId: string }
    >({
      query: ({ projectId, promptId }) => ({
        url: `/api/designs/projects/${projectId}/prompts/${promptId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
      ],
    }),

    // Generate design from saved prompt
    generateFromPrompt: builder.mutation<
      DesignGenerationRun & { project_id: string },
      { projectId: string; promptId: string }
    >({
      query: ({ projectId, promptId }) => ({
        url: `/api/designs/projects/${projectId}/prompts/${promptId}/generate/`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
      ],
    }),

    // Build prompts from sources (Prompt Builder)
    buildPrompts: builder.mutation<
      BuildPromptsResponse,
      { projectId: string; body: BuildPromptsBody }
    >({
      query: ({ projectId, body }) => ({
        url: `/api/designs/projects/${projectId}/build-prompts/`,
        method: 'POST',
        data: body,
      }),
    }),

    // List prompt presets
    listPromptPresets: builder.query<PromptPreset[], void>({
      query: () => ({
        url: '/api/designs/prompt-presets/',
        method: 'GET',
      }),
      providesTags: [{ type: 'DesignProject', id: 'PRESETS' }],
    }),

    // Create prompt preset
    createPromptPreset: builder.mutation<
      PromptPreset,
      { name: string; source_config: Record<string, unknown> }
    >({
      query: (body) => ({
        url: '/api/designs/prompt-presets/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'DesignProject', id: 'PRESETS' }],
    }),

    // Delete prompt preset
    deletePromptPreset: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/designs/prompt-presets/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'DesignProject', id: 'PRESETS' }],
    }),

    // --- Phase I: Product-to-Canvas References ---

    // Add product references to project
    addReferencesToProject: builder.mutation<
      { created: number; skipped: number },
      { projectId: string; body: { product_ids: string[] } }
    >({
      query: ({ projectId, body }) => ({
        url: `/api/designs/projects/${projectId}/references/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
        { type: 'DesignProjectList', id: 'LIST' },
      ],
    }),

    // Remove a single reference from project
    removeReferenceFromProject: builder.mutation<
      void,
      { projectId: string; referenceId: string }
    >({
      query: ({ projectId, referenceId }) => ({
        url: `/api/designs/projects/${projectId}/references/${referenceId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { projectId }) => [
        { type: 'DesignProject', id: projectId },
      ],
    }),
  }),
});

export const {
  useGetBoardContextQuery,
  useListDesignsQuery,
  useGenerateDesignMutation,
  useGenerateDesignForProjectMutation,
  useAnalyzeImageMutation,
  useAnalyzeProductImageMutation,
  useGetRunStatusQuery,
  useUpdateDesignStatusMutation,
  useDeleteDesignMutation,
  useRevertDesignMutation,
  useDeleteDesignVersionMutation,
  useSaveProcessedImageMutation,
  useBatchProcessMutation,
  useGetProcessingJobQuery,
  useListPipelinesQuery,
  useCreatePipelineMutation,
  useUpdatePipelineMutation,
  useDeletePipelineMutation,
  useApplyPipelineMutation,
  useGetDesignsByIdsQuery,
  // Project endpoints (Phase C2)
  useListProjectsQuery,
  useCreateProjectMutation,
  useGetProjectQuery,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useAddDesignsToProjectMutation,
  useRemoveDesignFromProjectMutation,
  useGetProjectBoardQuery,
  useUploadDesignToProjectMutation,
  // Processing Settings
  useGetProcessingSettingsQuery,
  useUpdateProcessingSettingsMutation,
  // Phase G: Slogan Pool + Prompt Builder
  useAddIdeasToProjectMutation,
  useRemoveIdeaFromProjectMutation,
  useCreatePromptsMutation,
  useUpdatePromptMutation,
  useDeletePromptMutation,
  useGenerateFromPromptMutation,
  useBuildPromptsMutation,
  useListPromptPresetsQuery,
  useCreatePromptPresetMutation,
  useDeletePromptPresetMutation,
  // Phase I: References
  useAddReferencesToProjectMutation,
  useRemoveReferenceFromProjectMutation,
} = designApi;
