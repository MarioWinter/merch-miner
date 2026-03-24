import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  ProductListResponse,
  SearchCacheStatus,
  BSRSnapshot,
  LiveSearchParams,
  LiveSearchResponse,
} from '../views/amazon/research/types';

export const researchApi = createApi({
  reducerPath: 'researchApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['ResearchProducts', 'ResearchStatus', 'BSRHistory'],
  endpoints: (builder) => ({
    getSuggestions: builder.query<string[], { q: string; marketplace: string }>({
      query: ({ q, marketplace }) => ({
        url: '/api/research/suggestions/',
        method: 'GET',
        params: { q, marketplace },
      }),
    }),

    triggerLiveSearch: builder.mutation<LiveSearchResponse, LiveSearchParams>({
      query: (body) => ({
        url: '/api/research/search/',
        method: 'POST',
        data: body,
      }),
    }),

    pollSearchStatus: builder.query<SearchCacheStatus, string>({
      query: (cacheId) => ({
        url: `/api/research/search/${cacheId}/status/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, cacheId) => [
        { type: 'ResearchStatus', id: cacheId },
      ],
    }),

    listProducts: builder.query<ProductListResponse, Record<string, unknown>>({
      query: (params) => ({
        url: '/api/research/products/',
        method: 'GET',
        params,
      }),
      providesTags: ['ResearchProducts'],
    }),

    getBSRHistory: builder.query<
      BSRSnapshot[],
      { asin: string; marketplace: string }
    >({
      query: ({ asin, marketplace }) => ({
        url: `/api/research/products/${asin}/bsr-history/`,
        method: 'GET',
        params: { marketplace },
      }),
      transformResponse: (response: BSRSnapshot[]) => response ?? [],
      providesTags: (_result, _error, { asin }) => [
        { type: 'BSRHistory', id: asin },
      ],
    }),
  }),
});

export const {
  useGetSuggestionsQuery,
  useTriggerLiveSearchMutation,
  usePollSearchStatusQuery,
  useListProductsQuery,
  useGetBSRHistoryQuery,
} = researchApi;
