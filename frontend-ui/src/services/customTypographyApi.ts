// PROJ-34 Phase 13t-h — RTK Query slice for CustomTypography CRUD + analyze.
//
// Endpoint contract: see backend `CustomTypographyAnalyzeView` +
// `CustomTypographyListCreateView` + `CustomTypographyDetailView`
// (django-app/design_app/api/views.py:2410-2586) wired in
// django-app/design_app/api/urls.py:331-346.
//
// Mirrors the `customSpatialApi` shape that already lives in `designSlice.ts`
// (analyze + list + create + delete) — kept in a dedicated slice per task
// directive so that Phase 13i/13t-m can grow without bloating designApi.

import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '../store/axiosBaseQuery';

export interface CustomTypography {
  id: string;
  name: string;
  prompt_text: string;
  source_kind: 'upload' | 'reference' | 'design';
  source_image_ref: string;
  is_unsafe: boolean;
  created_at: string;
  updated_at: string;
}

/** Body of POST /api/designs/typography/custom/analyze/. One-of:
 *   - `FormData`        — direct image upload (multipart/form-data)
 *   - `{reference_id}`  — analyze an existing ProjectReference
 *   - `{design_id}`     — analyze an existing Design */
export type AnalyzeTypographyBody =
  | FormData
  | { reference_id: string }
  | { design_id: string };

export interface AnalyzeTypographyResponse {
  prompt_text: string;
  model: string;
}

export interface CreateCustomTypographyBody {
  name: string;
  prompt_text: string;
  source_kind: 'upload' | 'reference' | 'design';
  source_image_ref?: string;
}

export const customTypographyApi = createApi({
  reducerPath: 'customTypographyApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['CustomTypography'],
  endpoints: (builder) => ({
    analyzeTypography: builder.mutation<
      AnalyzeTypographyResponse,
      AnalyzeTypographyBody
    >({
      query: (body) => ({
        url: '/api/designs/typography/custom/analyze/',
        method: 'POST',
        data: body,
      }),
    }),

    listCustomTypographies: builder.query<CustomTypography[], void>({
      query: () => ({
        url: '/api/designs/typography/custom/',
        method: 'GET',
      }),
      providesTags: [{ type: 'CustomTypography', id: 'LIST' }],
    }),

    createCustomTypography: builder.mutation<
      CustomTypography,
      CreateCustomTypographyBody
    >({
      query: (body) => ({
        url: '/api/designs/typography/custom/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'CustomTypography', id: 'LIST' }],
    }),

    deleteCustomTypography: builder.mutation<void, { id: string }>({
      query: ({ id }) => ({
        url: `/api/designs/typography/custom/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'CustomTypography', id: 'LIST' }],
    }),
  }),
});

export const {
  useAnalyzeTypographyMutation,
  useListCustomTypographiesQuery,
  useCreateCustomTypographyMutation,
  useDeleteCustomTypographyMutation,
} = customTypographyApi;
