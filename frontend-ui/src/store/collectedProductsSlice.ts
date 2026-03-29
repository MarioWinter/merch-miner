import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type { AmazonProduct } from '../views/amazon/research/types';

/**
 * Backend-persisted collected product (extends AmazonProduct with server fields).
 */
export interface CollectedProduct {
  id: string;
  niche: string;
  product: AmazonProduct;
  collected_at: string;
  extracted_keywords: Array<{ keyword: string; type: string; frequency: number }>;
  listing_template: Record<string, string>;
}

interface CollectedProductsListResponse {
  count: number;
  results: CollectedProduct[];
  next: string | null;
  previous: string | null;
}

interface CollectProductBody {
  nicheId: string;
  asin: string;
  marketplace: string;
}

interface RemoveCollectedProductBody {
  nicheId: string;
  collectedProductId: string;
}

interface ExtractKeywordsBody {
  nicheId: string;
  collectedProductId: string;
}

interface SaveListingTemplateBody {
  nicheId: string;
  collectedProductId: string;
}

interface ExtractKeywordsResponse {
  keywords: string[];
  message: string;
}

interface SaveListingTemplateResponse {
  listing_id: number;
  message: string;
}

export const collectedProductsApi = createApi({
  reducerPath: 'collectedProductsApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['CollectedProducts'],
  endpoints: (builder) => ({
    getCollectedProducts: builder.query<CollectedProductsListResponse, string>({
      query: (nicheId) => ({
        url: `/api/niches/${nicheId}/collected-products/`,
        method: 'GET',
      }),
      providesTags: (_result, _error, nicheId) => [
        { type: 'CollectedProducts', id: nicheId },
      ],
    }),

    collectProduct: builder.mutation<CollectedProduct, CollectProductBody>({
      query: ({ nicheId, asin, marketplace }) => ({
        url: `/api/niches/${nicheId}/collected-products/`,
        method: 'POST',
        data: { asin, marketplace },
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'CollectedProducts', id: nicheId },
      ],
    }),

    removeCollectedProduct: builder.mutation<void, RemoveCollectedProductBody>({
      query: ({ nicheId, collectedProductId }) => ({
        url: `/api/niches/${nicheId}/collected-products/${collectedProductId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'CollectedProducts', id: nicheId },
      ],
    }),

    extractKeywords: builder.mutation<ExtractKeywordsResponse, ExtractKeywordsBody>({
      query: ({ nicheId, collectedProductId }) => ({
        url: `/api/niches/${nicheId}/collected-products/${collectedProductId}/extract-keywords/`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'CollectedProducts', id: nicheId },
      ],
    }),

    saveListingTemplate: builder.mutation<SaveListingTemplateResponse, SaveListingTemplateBody>({
      query: ({ nicheId, collectedProductId }) => ({
        url: `/api/niches/${nicheId}/collected-products/${collectedProductId}/save-listing-template/`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'CollectedProducts', id: nicheId },
      ],
    }),
  }),
});

export const {
  useGetCollectedProductsQuery,
  useCollectProductMutation,
  useRemoveCollectedProductMutation,
  useExtractKeywordsMutation,
  useSaveListingTemplateMutation,
} = collectedProductsApi;
