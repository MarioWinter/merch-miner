import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  Listing,
  GenerateListingBody,
  TranslateListingBody,
  TMCheckResult,
  DesignAsset,
  GalleryListParams,
  GalleryListResponse,
  ImportDriveBody,
  BulkActionBody,
  UploadJob,
  CreateUploadJobBody,
  BatchUploadJobBody,
  UploadJobListParams,
  UploadJobListResponse,
  UploadTemplate,
  UploadTemplateCreateBody,
  LifecycleResponse,
  DesignCollection,
  CollectionDetail,
  CollectionTreeNode,
  CreateCollectionBody,
  UpdateCollectionBody,
  MoveAssetsBody,
  ListCollectionsParams,
  MbaColor,
  GetListingParams,
  ConvertListingBody,
  ConvertListingResponse,
  DesignProductConfig,
  GetProductConfigParams,
  UpdateProductConfigBody,
  CopyProductConfigFromBody,
} from '../views/publish/types';

export const publishApi = createApi({
  reducerPath: 'publishApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: [
    'Listing',
    'Gallery',
    'GalleryList',
    'UploadJob',
    'UploadJobList',
    'Template',
    'TemplateList',
    'Lifecycle',
    'Collection',
    'CollectionList',
    'CollectionTree',
    'MbaColors',
    'ProductConfig',
  ],
  endpoints: (builder) => ({
    // ---- Listing ----------------------------------------------------------
    generateListing: builder.mutation<Listing, { ideaId: string; body: GenerateListingBody }>({
      query: ({ ideaId, body }) => ({
        url: `/api/ideas/${ideaId}/listing/generate/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (result, _e, { ideaId, body }) => {
        const tags: { type: 'Listing'; id: string }[] = [
          { type: 'Listing', id: ideaId },
          {
            type: 'Listing',
            id: `${ideaId}:${body.marketplace_type ?? 'mba'}`,
          },
        ];
        if (result) {
          tags.push({
            type: 'Listing',
            id: `${result.idea}:${result.marketplace_type}`,
          });
        }
        return tags;
      },
    }),

    getListing: builder.query<Listing, GetListingParams>({
      query: ({ ideaId, marketplace_type }) => ({
        url: `/api/ideas/${ideaId}/listing/`,
        method: 'GET',
        params: marketplace_type ? { marketplace_type } : undefined,
      }),
      providesTags: (_r, _e, { ideaId, marketplace_type }) => [
        { type: 'Listing', id: `${ideaId}:${marketplace_type ?? 'mba'}` },
      ],
    }),

    updateListing: builder.mutation<Listing, { id: string; body: Partial<Listing> }>({
      query: ({ id, body }) => ({
        url: `/api/listings/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (result, _e, { id }) => {
        const tags: { type: 'Listing'; id: string }[] = [{ type: 'Listing', id }];
        if (result) {
          tags.push({
            type: 'Listing',
            id: `${result.idea}:${result.marketplace_type}`,
          });
        }
        return tags;
      },
    }),

    translateListing: builder.mutation<Listing, { id: string; body: TranslateListingBody }>({
      query: ({ id, body }) => ({
        url: `/api/listings/${id}/translate/`,
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Listing', id }],
    }),

    tmCheck: builder.mutation<TMCheckResult, string>({
      query: (id) => ({
        url: `/api/listings/${id}/tm-check/`,
        method: 'POST',
      }),
    }),

    exportListing: builder.query<string, string>({
      query: (id) => ({
        url: `/api/listings/${id}/export/`,
        method: 'GET',
      }),
    }),

    // ---- Convert (G3) ----------------------------------------------------
    // POST /api/listings/convert/ — creates or overwrites a Listing for the
    // target marketplace_type based on a source Listing. 409 when the target
    // already exists and `overwrite=false` — caller is expected to prompt the
    // user and retry with `overwrite=true`.
    convertListing: builder.mutation<ConvertListingResponse, ConvertListingBody>({
      query: (body) => ({
        url: '/api/listings/convert/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: (result) => {
        if (!result) return [];
        return [
          { type: 'Listing', id: result.id },
          { type: 'Listing', id: `${result.idea}:${result.marketplace_type}` },
        ];
      },
    }),

    // ---- Design Gallery ---------------------------------------------------
    listGallery: builder.query<GalleryListResponse, GalleryListParams>({
      query: (params) => ({
        url: '/api/designs/gallery/',
        method: 'GET',
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'Gallery' as const, id })),
              { type: 'GalleryList', id: 'LIST' },
            ]
          : [{ type: 'GalleryList', id: 'LIST' }],
    }),

    uploadDesign: builder.mutation<DesignAsset, FormData>({
      query: (formData) => ({
        url: '/api/designs/gallery/upload/',
        method: 'POST',
        data: formData,
      }),
      invalidatesTags: [
        { type: 'GalleryList', id: 'LIST' },
        { type: 'CollectionList', id: 'LIST' },
        { type: 'CollectionTree', id: 'TREE' },
      ],
    }),

    importDrive: builder.mutation<DesignAsset[], ImportDriveBody>({
      query: (body) => ({
        url: '/api/designs/gallery/import-drive/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [
        { type: 'GalleryList', id: 'LIST' },
        { type: 'CollectionList', id: 'LIST' },
        { type: 'CollectionTree', id: 'TREE' },
      ],
    }),

    deleteDesign: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/designs/gallery/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'GalleryList', id: 'LIST' },
        { type: 'CollectionList', id: 'LIST' },
        { type: 'CollectionTree', id: 'TREE' },
      ],
    }),

    // H6: duplicate an existing DesignAsset. Backend copies the file + DB row
    // in a single atomic transaction (cross-workspace guard returns 404). We
    // invalidate the gallery LIST tag so the new card appears in the UI.
    duplicateDesign: builder.mutation<DesignAsset, string>({
      query: (id) => ({
        url: `/api/designs/gallery/${id}/duplicate/`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'GalleryList', id: 'LIST' }],
    }),

    updateDesign: builder.mutation<DesignAsset, { id: string; body: Partial<DesignAsset> }>({
      query: ({ id, body }) => ({
        url: `/api/designs/gallery/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Gallery', id },
        { type: 'GalleryList', id: 'LIST' },
      ],
      // Optimistic update — walk every cached GalleryList query and patch the
      // matching asset in place. On error we undo the patch so callers can
      // surface a snackbar and the UI snaps back to server state.
      async onQueryStarted({ id, body }, { dispatch, queryFulfilled, getState }) {
        const state = getState() as { publishApi?: { queries?: Record<string, unknown> } };
        const queries = state.publishApi?.queries ?? {};
        const patches: { undo: () => void }[] = [];
        for (const cacheKey of Object.keys(queries)) {
          if (!cacheKey.startsWith('listGallery(')) continue;
          const args = (queries[cacheKey] as { originalArgs?: GalleryListParams } | undefined)
            ?.originalArgs;
          if (!args) continue;
          const patch = dispatch(
            publishApi.util.updateQueryData('listGallery', args, (draft) => {
              const hit = draft.results.find((d) => d.id === id);
              if (hit) Object.assign(hit, body);
            }),
          );
          patches.push(patch);
        }
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
    }),

    bulkAction: builder.mutation<void, BulkActionBody>({
      query: (body) => ({
        url: '/api/designs/gallery/bulk-action/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [
        { type: 'GalleryList', id: 'LIST' },
        { type: 'CollectionList', id: 'LIST' },
        { type: 'CollectionTree', id: 'TREE' },
      ],
    }),

    // ---- Collections ------------------------------------------------------
    listCollections: builder.query<DesignCollection[], ListCollectionsParams | void>({
      query: (params) => ({
        url: '/api/collections/',
        method: 'GET',
        params: params ?? undefined,
      }),
      transformResponse: (raw: DesignCollection[] | { results: DesignCollection[] }) =>
        Array.isArray(raw) ? raw : raw.results,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Collection' as const, id })),
              { type: 'CollectionList', id: 'LIST' },
            ]
          : [{ type: 'CollectionList', id: 'LIST' }],
    }),

    getCollection: builder.query<CollectionDetail, string>({
      query: (id) => ({
        url: `/api/collections/${id}/`,
        method: 'GET',
      }),
      providesTags: (_r, _e, id) => [{ type: 'Collection', id }],
    }),

    getCollectionTree: builder.query<CollectionTreeNode[], void>({
      query: () => ({
        url: '/api/collections/tree/',
        method: 'GET',
      }),
      providesTags: [{ type: 'CollectionTree', id: 'TREE' }],
    }),

    createCollection: builder.mutation<DesignCollection, CreateCollectionBody>({
      query: (body) => ({
        url: '/api/collections/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [
        { type: 'CollectionList', id: 'LIST' },
        { type: 'CollectionTree', id: 'TREE' },
      ],
    }),

    updateCollection: builder.mutation<
      DesignCollection,
      { id: string; body: UpdateCollectionBody }
    >({
      query: ({ id, body }) => ({
        url: `/api/collections/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Collection', id },
        { type: 'CollectionList', id: 'LIST' },
        { type: 'CollectionTree', id: 'TREE' },
      ],
    }),

    deleteCollection: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/collections/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [
        { type: 'CollectionList', id: 'LIST' },
        { type: 'CollectionTree', id: 'TREE' },
        // Assets may move to parent on delete, refresh gallery
        { type: 'GalleryList', id: 'LIST' },
      ],
    }),

    moveAssets: builder.mutation<void, MoveAssetsBody>({
      query: (body) => ({
        url: '/api/designs/gallery/move/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [
        { type: 'GalleryList', id: 'LIST' },
        { type: 'CollectionList', id: 'LIST' },
        { type: 'CollectionTree', id: 'TREE' },
      ],
    }),

    // ---- Upload Jobs ------------------------------------------------------
    createUploadJob: builder.mutation<UploadJob, CreateUploadJobBody>({
      query: (body) => ({
        url: '/api/upload-jobs/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'UploadJobList', id: 'LIST' }],
    }),

    batchUploadJobs: builder.mutation<UploadJob[], BatchUploadJobBody>({
      query: (body) => ({
        url: '/api/upload-jobs/batch/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'UploadJobList', id: 'LIST' }],
    }),

    listUploadJobs: builder.query<UploadJobListResponse, UploadJobListParams>({
      query: (params) => ({
        url: '/api/upload-jobs/list/',
        method: 'GET',
        params,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'UploadJob' as const, id })),
              { type: 'UploadJobList', id: 'LIST' },
            ]
          : [{ type: 'UploadJobList', id: 'LIST' }],
    }),

    getUploadJob: builder.query<UploadJob, string>({
      query: (id) => ({
        url: `/api/upload-jobs/${id}/`,
        method: 'GET',
      }),
      providesTags: (_r, _e, id) => [{ type: 'UploadJob', id }],
    }),

    cancelUploadJob: builder.mutation<UploadJob, string>({
      query: (id) => ({
        url: `/api/upload-jobs/${id}/cancel/`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, id) => [{ type: 'UploadJob', id }],
    }),

    // ---- Upload Templates -------------------------------------------------
    listTemplates: builder.query<UploadTemplate[], void>({
      query: () => ({
        url: '/api/upload-templates/',
        method: 'GET',
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Template' as const, id })),
              { type: 'TemplateList', id: 'LIST' },
            ]
          : [{ type: 'TemplateList', id: 'LIST' }],
    }),

    createTemplate: builder.mutation<UploadTemplate, UploadTemplateCreateBody>({
      query: (body) => ({
        url: '/api/upload-templates/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [{ type: 'TemplateList', id: 'LIST' }],
    }),

    updateTemplate: builder.mutation<
      UploadTemplate,
      { id: string; body: Partial<UploadTemplateCreateBody> }
    >({
      query: ({ id, body }) => ({
        url: `/api/upload-templates/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Template', id }],
    }),

    deleteTemplate: builder.mutation<void, string>({
      query: (id) => ({
        url: `/api/upload-templates/${id}/`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'TemplateList', id: 'LIST' }],
    }),

    // ---- MBA Colors -------------------------------------------------------
    getMbaColors: builder.query<MbaColor[], void>({
      query: () => ({
        url: '/api/mba/colors/',
        method: 'GET',
      }),
      providesTags: [{ type: 'MbaColors', id: 'LIST' }],
    }),

    // ---- Design Product Config (F4) --------------------------------------
    // GET/PATCH/COPY-FROM /api/designs/{designId}/product-config/.
    // Cache key pairs `(designId, marketplace_type)` so tab-switch and
    // design-switch both trigger a fresh query.
    getProductConfig: builder.query<DesignProductConfig, GetProductConfigParams>({
      query: ({ designId, marketplace_type }) => ({
        url: `/api/designs/${designId}/product-config/`,
        method: 'GET',
        params: { marketplace_type },
      }),
      providesTags: (_r, _e, { designId, marketplace_type }) => [
        { type: 'ProductConfig', id: `${designId}:${marketplace_type}` },
      ],
    }),

    updateProductConfig: builder.mutation<
      DesignProductConfig,
      { designId: string; body: UpdateProductConfigBody }
    >({
      query: ({ designId, body }) => ({
        url: `/api/designs/${designId}/product-config/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_r, _e, { designId, body }) => [
        { type: 'ProductConfig', id: `${designId}:${body.marketplace_type}` },
      ],
    }),

    copyProductConfigFrom: builder.mutation<
      DesignProductConfig,
      CopyProductConfigFromBody
    >({
      query: ({ designId, source_design_id, marketplace_type, scope }) => ({
        url: `/api/designs/${designId}/product-config/copy-from/`,
        method: 'POST',
        data: { source_design_id, marketplace_type, scope },
      }),
      invalidatesTags: (_r, _e, { designId, marketplace_type }) => [
        { type: 'ProductConfig', id: `${designId}:${marketplace_type}` },
      ],
    }),

    // ---- Product Lifecycle ------------------------------------------------
    getLifecycle: builder.query<LifecycleResponse, string>({
      query: (nicheId) => ({
        url: `/api/niches/${nicheId}/lifecycle/`,
        method: 'GET',
      }),
      providesTags: (_r, _e, nicheId) => [{ type: 'Lifecycle', id: nicheId }],
    }),
  }),
});

export const {
  // Listing
  useGenerateListingMutation,
  useGetListingQuery,
  useLazyGetListingQuery,
  useUpdateListingMutation,
  useTranslateListingMutation,
  useTmCheckMutation,
  useLazyExportListingQuery,
  useConvertListingMutation,
  // Gallery
  useListGalleryQuery,
  useLazyListGalleryQuery,
  useUploadDesignMutation,
  useImportDriveMutation,
  useDeleteDesignMutation,
  useUpdateDesignMutation,
  useBulkActionMutation,
  useDuplicateDesignMutation,
  // Collections
  useListCollectionsQuery,
  useGetCollectionQuery,
  useGetCollectionTreeQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
  useMoveAssetsMutation,
  // Upload Jobs
  useCreateUploadJobMutation,
  useBatchUploadJobsMutation,
  useListUploadJobsQuery,
  useGetUploadJobQuery,
  useCancelUploadJobMutation,
  // Templates
  useListTemplatesQuery,
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
  // Lifecycle
  useGetLifecycleQuery,
  // MBA Colors
  useGetMbaColorsQuery,
  // Design Product Config
  useGetProductConfigQuery,
  useUpdateProductConfigMutation,
  useCopyProductConfigFromMutation,
} = publishApi;
