import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';

export interface FeedbackScreenshot {
  id: string;
  image_url: string;
  uploaded_at: string;
}

export interface FeedbackReport {
  id: string;
  type: 'bug' | 'feature';
  title: string;
  description: string;
  screenshot: FeedbackScreenshot | null;
  status: 'new' | 'triaged' | 'in_progress' | 'done' | 'wontfix';
  created_at: string;
}

export interface CreateReportBody {
  type: 'bug' | 'feature';
  title: string;
  description: string;
  screenshot_id?: string;
}

export const feedbackApi = createApi({
  reducerPath: 'feedbackApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['FeedbackReport'],
  endpoints: (builder) => ({
    uploadScreenshot: builder.mutation<FeedbackScreenshot, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return {
          url: '/api/feedback/screenshots/',
          method: 'POST',
          data: formData,
        };
      },
    }),

    createReport: builder.mutation<FeedbackReport, CreateReportBody>({
      query: (body) => ({
        url: '/api/feedback/reports/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'FeedbackReport', id: 'LIST' }],
    }),
  }),
});

export const { useUploadScreenshotMutation, useCreateReportMutation } =
  feedbackApi;
