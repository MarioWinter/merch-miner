import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type UpscaleJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export type UpscaleDestination = 'local' | 'cloud';

export interface UpscaleCloudTarget {
  provider: 'google_drive' | 'onedrive';
  folder_id: string | null;
  folder_name: string;
}

export interface UpscaleSinglePayload {
  destination?: UpscaleDestination;
  cloud_target?: UpscaleCloudTarget;
  replace?: boolean;
}

export interface UpscaleBulkPayload {
  design_ids: string[];
  destination?: UpscaleDestination;
  cloud_target?: UpscaleCloudTarget;
  replace?: boolean;
}

export interface UpscaleSingleResponse {
  job_id: string;
  replicate_prediction_id: string;
  status: UpscaleJobStatus;
}

export interface UpscaleBatchJobRow {
  design_id: string;
  job_id: string;
  status: UpscaleJobStatus;
  /** Filename or label for the affected design (for the drawer list rows). */
  design_label: string;
  /** Thumbnail URL for the design (used for 40x40 preview). */
  thumbnail_url: string | null;
  /** Populated on `failed` rows so the UI can show the reason and gate retry. */
  error_message: string | null;
  /** How many times this row has been retried with the same error. */
  retry_count: number;
}

export interface UpscaleBulkResponse {
  /** Null when no eligible candidates after server-side filtering. */
  batch_id: string | null;
  jobs: UpscaleBatchJobRow[];
  skipped_quota: number;
  skipped_already_upscaled: number;
  skipped_in_progress?: number;
}

export interface UpscaleBatchStatusResponse {
  batch_id: string;
  jobs: UpscaleBatchJobRow[];
  /** Convenience aggregate flags so the UI can short-circuit on terminal state. */
  is_terminal: boolean;
}

export interface UpscaleQuotaResponse {
  used: number;
  limit: number | null;
  resets_on: string;
  is_unlimited: boolean;
}

export interface UpscaleQuotaErrorPayload {
  error: 'monthly_quota_exceeded';
  used: number;
  limit: number;
  resets_on: string;
}

// -----------------------------------------------------------------
// API slice
// -----------------------------------------------------------------

export const upscaleApi = createApi({
  reducerPath: 'upscaleApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['UpscaleQuota', 'UpscaleBatch'],
  endpoints: (builder) => ({
    triggerSingle: builder.mutation<
      UpscaleSingleResponse,
      { designId: string; body?: UpscaleSinglePayload }
    >({
      query: ({ designId, body }) => ({
        url: `/api/designs/${designId}/upscale/`,
        method: 'POST',
        data: body ?? {},
      }),
      invalidatesTags: ['UpscaleQuota'],
    }),

    triggerBulk: builder.mutation<UpscaleBulkResponse, UpscaleBulkPayload>({
      query: (body) => ({
        url: '/api/designs/upscale/bulk/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['UpscaleQuota'],
    }),

    getBatchStatus: builder.query<UpscaleBatchStatusResponse, string>({
      query: (batchId) => ({
        url: `/api/designs/upscale/batch/${batchId}/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, batchId) => [
        { type: 'UpscaleBatch', id: batchId },
      ],
    }),

    getQuota: builder.query<UpscaleQuotaResponse, void>({
      query: () => ({
        url: '/api/designs/upscale/quota/',
        method: 'GET',
      }),
      providesTags: ['UpscaleQuota'],
    }),
  }),
});

export const {
  useTriggerSingleMutation,
  useTriggerBulkMutation,
  useGetBatchStatusQuery,
  useLazyGetBatchStatusQuery,
  useGetQuotaQuery,
} = upscaleApi;
