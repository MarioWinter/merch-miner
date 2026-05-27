// PROJ-34 Phase 13t-h — RTK Query slice for Niche-Reference Preset Picker.
//
// Endpoint contract: see backend `NicheCardPresetViewSet`
// (django-app/design_app/api/views.py:2591) and the URL declarations in
// django-app/design_app/api/urls.py:277-313.

import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from '../store/axiosBaseQuery';
import type {
  NichePresetCard,
  PresetConfirmRequest,
  PresetRegenerateRequest,
  PresetRegenerateResponse,
  VorschlaegeResponse,
} from '../types/nichePreset';

export const presetCardsApi = createApi({
  reducerPath: 'presetCardsApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['PresetCards', 'History', 'Custom'],
  endpoints: (builder) => ({
    getVorschlaege: builder.query<VorschlaegeResponse, { nicheId: string }>({
      query: ({ nicheId }) => ({
        url: `/api/designs/preset-cards/?niche_id=${nicheId}`,
        method: 'GET',
      }),
      providesTags: (_result, _error, { nicheId }) => [
        { type: 'PresetCards', id: nicheId },
      ],
    }),

    getHistory: builder.query<NichePresetCard[], void>({
      query: () => ({
        url: '/api/designs/preset-cards/history/',
        method: 'GET',
      }),
      providesTags: ['History'],
    }),

    getCustom: builder.query<NichePresetCard[], void>({
      query: () => ({
        url: '/api/designs/preset-cards/custom/',
        method: 'GET',
      }),
      providesTags: ['Custom'],
    }),

    confirmPreset: builder.mutation<NichePresetCard, PresetConfirmRequest>({
      query: (body) => ({
        url: '/api/designs/preset-cards/confirm/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['History'],
    }),

    promoteCustom: builder.mutation<NichePresetCard, { presetId: string }>({
      query: ({ presetId }) => ({
        url: `/api/designs/preset-cards/${presetId}/promote-custom/`,
        method: 'POST',
      }),
      invalidatesTags: ['Custom', 'History'],
    }),

    removeCustom: builder.mutation<void, { presetId: string }>({
      query: ({ presetId }) => ({
        url: `/api/designs/preset-cards/${presetId}/custom/`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Custom'],
    }),

    regenerateMix: builder.mutation<
      PresetRegenerateResponse,
      PresetRegenerateRequest
    >({
      query: (body) => ({
        url: '/api/designs/preset-cards/regenerate-mix/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_result, _error, { niche_id }) => [
        { type: 'PresetCards', id: niche_id },
        'History',
      ],
    }),
  }),
});

export const {
  useGetVorschlaegeQuery,
  useGetHistoryQuery,
  useGetCustomQuery,
  useConfirmPresetMutation,
  usePromoteCustomMutation,
  useRemoveCustomMutation,
  useRegenerateMixMutation,
} = presetCardsApi;
