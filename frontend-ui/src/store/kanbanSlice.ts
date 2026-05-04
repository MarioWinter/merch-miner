import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  Design,
  NicheComment,
  RoundSummary,
  DesignTrashItem,
  PaginatedResponse,
} from '../views/kanban/types';

export const kanbanApi = createApi({
  reducerPath: 'kanbanApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['Designs', 'Comments', 'Rounds', 'Trash'],
  endpoints: (builder) => ({
    // ----- Designs (AC-10) -----
    listDesigns: builder.query<
      PaginatedResponse<Design>,
      { nicheId: string; round?: number; page?: number }
    >({
      query: ({ nicheId, round, page }) => ({
        url: `/api/niches/${nicheId}/designs/`,
        method: 'GET',
        params: { ...(round ? { round } : {}), ...(page ? { page } : {}) },
      }),
      providesTags: (_res, _err, { nicheId }) => [
        { type: 'Designs', id: nicheId },
      ],
    }),

    // ----- Upload (AC-11) -----
    uploadDesigns: builder.mutation<
      { uploaded: number; designs: { id: string; file_name: string; round: number }[] },
      { nicheId: string; formData: FormData }
    >({
      query: ({ nicheId, formData }) => ({
        url: `/api/niches/${nicheId}/designs/upload/`,
        method: 'POST',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
      invalidatesTags: (_res, _err, { nicheId }) => [
        { type: 'Designs', id: nicheId },
        { type: 'Rounds', id: nicheId },
      ],
    }),

    // ----- Approve/Reject (AC-13) -----
    updateDesignStatus: builder.mutation<
      { id: string; status: string },
      { designId: string; status: 'approved' | 'rejected'; feedback?: string; nicheId: string }
    >({
      query: ({ designId, status, feedback }) => ({
        url: `/api/kanban/designs/${designId}/`,
        method: 'PATCH',
        data: { status, ...(feedback ? { feedback } : {}) },
      }),
      invalidatesTags: (_res, _err, { nicheId }) => [
        { type: 'Designs', id: nicheId },
        { type: 'Comments', id: nicheId },
      ],
    }),

    // ----- Soft delete (AC-14) -----
    softDeleteDesign: builder.mutation<void, { designId: string; nicheId: string }>({
      query: ({ designId }) => ({
        url: `/api/kanban/designs/${designId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, { nicheId }) => [
        { type: 'Designs', id: nicheId },
        { type: 'Trash', id: 'LIST' },
      ],
    }),

    // ----- Restore (AC-15) -----
    restoreDesign: builder.mutation<{ id: string; restored: boolean }, { designId: string; nicheId: string }>({
      query: ({ designId }) => ({
        url: `/api/kanban/designs/${designId}/restore/`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, { nicheId }) => [
        { type: 'Designs', id: nicheId },
        { type: 'Trash', id: 'LIST' },
      ],
    }),

    // ----- Trash list (AC-28) -----
    listTrash: builder.query<PaginatedResponse<DesignTrashItem>, { page?: number }>({
      query: ({ page } = {}) => ({
        url: '/api/kanban/designs/trash/',
        method: 'GET',
        params: page ? { page } : {},
      }),
      providesTags: [{ type: 'Trash', id: 'LIST' }],
    }),

    // ----- New Round (AC-9) -----
    newRound: builder.mutation<
      { id: string; current_round: number; status: string },
      string
    >({
      query: (nicheId) => ({
        url: `/api/niches/${nicheId}/new-round/`,
        method: 'POST',
      }),
      invalidatesTags: (_res, _err, nicheId) => [
        { type: 'Designs', id: nicheId },
        { type: 'Rounds', id: nicheId },
      ],
    }),

    // ----- Round summaries (AC-16) -----
    listRounds: builder.query<RoundSummary[], string>({
      query: (nicheId) => ({
        url: `/api/niches/${nicheId}/rounds/`,
        method: 'GET',
      }),
      providesTags: (_res, _err, nicheId) => [{ type: 'Rounds', id: nicheId }],
    }),

    // ----- Comments (AC-17, AC-18) -----
    listComments: builder.query<
      PaginatedResponse<NicheComment>,
      { nicheId: string; designId?: string }
    >({
      query: ({ nicheId, designId }) => ({
        url: `/api/niches/${nicheId}/comments/`,
        method: 'GET',
        params: designId ? { design_id: designId } : {},
      }),
      providesTags: (_res, _err, { nicheId }) => [
        { type: 'Comments', id: nicheId },
      ],
    }),

    createComment: builder.mutation<
      NicheComment,
      { nicheId: string; content: string; designId?: string; mentions?: number[] }
    >({
      query: ({ nicheId, content, designId, mentions }) => ({
        url: `/api/niches/${nicheId}/comments/`,
        method: 'POST',
        data: {
          content,
          ...(designId ? { design_id: designId } : {}),
          ...(mentions?.length ? { mentions } : {}),
        },
      }),
      invalidatesTags: (_res, _err, { nicheId }) => [
        { type: 'Comments', id: nicheId },
      ],
    }),

    deleteComment: builder.mutation<void, { nicheId: string; commentId: string }>({
      query: ({ nicheId, commentId }) => ({
        url: `/api/niches/${nicheId}/comments/${commentId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_res, _err, { nicheId }) => [
        { type: 'Comments', id: nicheId },
      ],
    }),
  }),
});

export const {
  useListDesignsQuery,
  useUploadDesignsMutation,
  useUpdateDesignStatusMutation,
  useSoftDeleteDesignMutation,
  useRestoreDesignMutation,
  useListTrashQuery,
  useNewRoundMutation,
  useListRoundsQuery,
  useListCommentsQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
} = kanbanApi;
