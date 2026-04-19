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

    updateDesign: builder.mutation<DesignAsset, { id: string; body: Partial<DesignAsset> }>({
      query: ({ id, body }) => ({
        url: `/api/designs/gallery/${id}/`,
        method: 'PATCH',
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Gallery', id }],
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
        url: '/api/upload-jobs/',
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
  // Gallery
  useListGalleryQuery,
  useLazyListGalleryQuery,
  useUploadDesignMutation,
  useImportDriveMutation,
  useDeleteDesignMutation,
  useUpdateDesignMutation,
  useBulkActionMutation,
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
} = publishApi;
