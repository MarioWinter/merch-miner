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
      // Optimistic insert into `getCollectedProducts(nicheId)` so the heart
      // icon flips immediately. The temporary id is replaced when the tag
      // invalidation refetches the canonical list on success. On error we
      // undo the patch and the caller surfaces a snackbar.
      async onQueryStarted(
        { nicheId, asin, marketplace },
        { dispatch, queryFulfilled },
      ) {
        const optimisticEntry: CollectedProduct = {
          id: `optimistic-${asin}-${Date.now()}`,
          niche: nicheId,
          product: {
            id: `optimistic-${asin}`,
            asin,
            title: '',
            brand: '',
            bsr: null,
            bsr_categories: [],
            rating: null,
            reviews_count: null,
            price: null,
            product_type: '',
            subcategory: '',
            listed_date: null,
            thumbnail_url: '',
            bullet_1: '',
            bullet_2: '',
            description: '',
            marketplace,
            scraped_at: new Date().toISOString(),
          },
          collected_at: new Date().toISOString(),
          extracted_keywords: [],
          listing_template: {},
        };
        const patch = dispatch(
          collectedProductsApi.util.updateQueryData(
            'getCollectedProducts',
            nicheId,
            (draft) => {
              // Defensive: cache may be undefined on first call.
              if (!draft.results) return;
              draft.results.unshift(optimisticEntry);
              draft.count = (draft.count ?? 0) + 1;
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    removeCollectedProduct: builder.mutation<void, RemoveCollectedProductBody>({
      query: ({ nicheId, collectedProductId }) => ({
        url: `/api/niches/${nicheId}/collected-products/${collectedProductId}/`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { nicheId }) => [
        { type: 'CollectedProducts', id: nicheId },
      ],
      // Optimistic removal from `getCollectedProducts(nicheId)`. Rollback on
      // error.
      async onQueryStarted(
        { nicheId, collectedProductId },
        { dispatch, queryFulfilled },
      ) {
        const patch = dispatch(
          collectedProductsApi.util.updateQueryData(
            'getCollectedProducts',
            nicheId,
            (draft) => {
              if (!draft.results) return;
              const before = draft.results.length;
              draft.results = draft.results.filter(
                (item) => item.id !== collectedProductId,
              );
              if (draft.results.length < before) {
                draft.count = Math.max(0, (draft.count ?? 0) - 1);
              }
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
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
