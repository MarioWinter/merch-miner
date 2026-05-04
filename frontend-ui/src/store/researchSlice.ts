import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  ProductListResponse,
  SearchCacheStatus,
  BSRSnapshot,
  BSRHistoryResponse,
  LiveSearchParams,
  LiveSearchResponse,
  ProductDetail,
  SimilarProduct,
  PriceSnapshot,
  UseAsTemplateResponse,
  SearchCacheStatusExtended,
} from '../views/amazon/research/types';

export const researchApi = createApi({
  reducerPath: 'researchApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['ResearchProducts', 'ResearchStatus', 'BSRHistory', 'ProductDetail'],
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
      transformResponse: (response: BSRSnapshot[] | BSRHistoryResponse) => {
        if (Array.isArray(response)) return response ?? [];
        return response?.snapshots ?? [];
      },
      providesTags: (_result, _error, { asin }) => [
        { type: 'BSRHistory', id: asin },
      ],
    }),

    getBSRHistoryFull: builder.query<
      BSRHistoryResponse,
      { asin: string; marketplace: string }
    >({
      query: ({ asin, marketplace }) => ({
        url: `/api/research/products/${asin}/bsr-history/`,
        method: 'GET',
        params: { marketplace },
      }),
      providesTags: (_result, _error, { asin }) => [
        { type: 'BSRHistory', id: asin },
      ],
    }),

    getProductDetail: builder.query<ProductDetail, string>({
      query: (asin) => ({
        url: `/api/research/products/${asin}/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, asin) => [
        { type: 'ProductDetail', id: asin },
      ],
    }),

    getSimilarProducts: builder.query<SimilarProduct[], string>({
      query: (asin) => ({
        url: `/api/research/products/${asin}/similar/`,
        method: 'GET',
      }),
    }),

    getSameBrandProducts: builder.query<SimilarProduct[], string>({
      query: (asin) => ({
        url: `/api/research/products/${asin}/same-brand/`,
        method: 'GET',
      }),
    }),

    getPriceHistory: builder.query<
      PriceSnapshot[],
      { asin: string; marketplace: string }
    >({
      query: ({ asin, marketplace }) => ({
        url: `/api/research/products/${asin}/price-history/`,
        method: 'GET',
        params: { marketplace },
      }),
    }),

    useAsTemplate: builder.mutation<
      UseAsTemplateResponse,
      { asin: string; niche_id: number }
    >({
      query: ({ asin, niche_id }) => ({
        url: `/api/research/products/${asin}/use-as-template/`,
        method: 'POST',
        data: { niche_id },
      }),
    }),

    pollSearchStatusExtended: builder.query<SearchCacheStatusExtended, string>({
      query: (cacheId) => ({
        url: `/api/research/search/${cacheId}/status/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, cacheId) => [
        { type: 'ResearchStatus', id: cacheId },
      ],
    }),

    cancelLiveSearch: builder.mutation<{ status: string }, string>({
      query: (cacheId) => ({
        url: `/api/research/search/${cacheId}/cancel/`,
        method: 'POST',
      }),
    }),
  }),
});

export const {
  useGetSuggestionsQuery,
  useLazyGetSuggestionsQuery,
  useTriggerLiveSearchMutation,
  usePollSearchStatusQuery,
  useListProductsQuery,
  useLazyListProductsQuery,
  useGetBSRHistoryQuery,
  useGetBSRHistoryFullQuery,
  useGetProductDetailQuery,
  useGetSimilarProductsQuery,
  useGetSameBrandProductsQuery,
  useGetPriceHistoryQuery,
  useUseAsTemplateMutation,
  usePollSearchStatusExtendedQuery,
  useCancelLiveSearchMutation,
} = researchApi;
