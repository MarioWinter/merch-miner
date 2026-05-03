import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  Listing,
  TranslateListingBody,
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
  MbaProductCatalogEntry,
  GetListingParams,
  ConvertListingBody,
  ConvertListingResponse,
  DesignProductConfig,
  GetProductConfigParams,
  UpdateProductConfigBody,
  CopyProductConfigFromBody,
  AIImproveListingResponse,
  FlyingUploadExportBody,
  FlyingUploadPreviewResponse,
  FlyingUploadExportResult,
  ExportHistoryParams,
  ExportHistoryResponse,
  DesignAssetFromDesignBody,
  DesignAssetFromDesignResponse,
} from '../views/publish/types';
import type { BlobResult } from './axiosBaseQuery';

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
    'MbaCatalog',
    'ProductConfig',
    'ExportHistory',
  ],
  endpoints: (builder) => ({
    // ---- Listing ----------------------------------------------------------
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

    // ---- AI Improve (AC-69..AC-72, Phase M) -----------------------------
    // POST /api/listings/{id}/ai-improve/ — LLM rewrite of listing copy.
    // Replaces the legacy Generate + TM-Check flow. Invalidates the Listing
    // tag so getListing refetches with the new fields + status=draft.
    aiImproveListing: builder.mutation<AIImproveListingResponse, string>({
      query: (id) => ({
        url: `/api/listings/${id}/ai-improve/`,
        method: 'POST',
      }),
      invalidatesTags: (result, _e, id) => {
        const tags: { type: 'Listing'; id: string }[] = [{ type: 'Listing', id }];
        if (result) {
          tags.push({
            type: 'Listing',
            id: `${result.listing.idea}:${result.listing.marketplace_type}`,
          });
        }
        return tags;
      },
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
      // Backend uses PublishPagination -> {count, next, previous, results}.
      // Unwrap to a plain array so consumers can map/filter directly.
      transformResponse: (raw: UploadTemplate[] | { results: UploadTemplate[] }) =>
        Array.isArray(raw) ? raw : (raw?.results ?? []),
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

    // ---- MBA Product Catalog (AC-37, Phase L) ---------------------------
    // GET /api/mba/product-catalog/ — 20 MBA product entries. Response
    // carries Cache-Control: public, max-age=86400 so the browser cache does
    // the heavy lifting; we still tag it with `MbaCatalog` so invalidations
    // during a deploy can refetch on demand.
    getMbaProductCatalog: builder.query<MbaProductCatalogEntry[], void>({
      query: () => ({
        url: '/api/mba/product-catalog/',
        method: 'GET',
      }),
      // Long TTL — catalog rarely changes and updates ship as a backend
      // deploy, so a long keep-unused lifespan avoids unnecessary fetches on
      // tab-hops.
      keepUnusedDataFor: 24 * 60 * 60,
      providesTags: [{ type: 'MbaCatalog', id: 'LIST' }],
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
      query: ({
        designId, source_design_id, marketplace_type, scope, product_type,
      }) => ({
        url: `/api/designs/${designId}/product-config/copy-from/`,
        method: 'POST',
        data: {
          source_design_id,
          marketplace_type,
          scope,
          // Optional per AC-41 — scopes a scalar copy to a single product.
          ...(product_type ? { product_type } : {}),
        },
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

    // ---- FlyingUpload Export (Phase U1, 2026-04-24) ----------------------
    // Preflight preview — returns ready_rows + skipped design list without
    // actually generating the file. Read-only, no cache invalidation.
    previewExport: builder.mutation<
      FlyingUploadPreviewResponse,
      FlyingUploadExportBody
    >({
      query: (body) => ({
        url: '/api/publish/export/flyingupload/preflight/',
        method: 'POST',
        data: body,
      }),
    }),

    // Run the export — backend streams a binary ZIP/CSV/XLSX. We request
    // `responseType: 'blob'` through axiosBaseQuery, which parses
    // Content-Disposition and yields `{ blob, filename }` for the caller to
    // pipe into a download anchor. Invalidates the ExportHistory list so the
    // History drawer picks up the new row on next open.
    runExport: builder.mutation<FlyingUploadExportResult, FlyingUploadExportBody>({
      query: (body) => ({
        url: '/api/publish/export/flyingupload/',
        method: 'POST',
        data: body,
        responseType: 'blob',
      }),
      transformResponse: (raw: BlobResult) => ({
        blob: raw.blob,
        filename: raw.filename,
      }),
      invalidatesTags: [{ type: 'ExportHistory', id: 'LIST' }],
    }),

    listExportHistory: builder.query<ExportHistoryResponse, ExportHistoryParams | void>({
      query: (params) => ({
        url: '/api/publish/export/history/',
        method: 'GET',
        params: params ?? undefined,
      }),
      providesTags: [{ type: 'ExportHistory', id: 'LIST' }],
    }),

    // ---- Send Designs to Listings (PROJ-9 Phase O, AC-168) ---------------
    // POST /api/design-assets/from-design/ — creates DesignAsset rows from
    // approved Design ids. Backend chunks at 50 (HTTP 400 on excess); the
    // frontend chunking is handled by `sendDesignsInChunks` below.
    //
    // Tag invalidation: refresh open Publish gallery (Gallery+GalleryList) +
    // Listing tags so any open Publish view re-fetches.
    sendDesignsToListings: builder.mutation<
      DesignAssetFromDesignResponse,
      DesignAssetFromDesignBody
    >({
      query: (body) => ({
        url: '/api/design-assets/from-design/',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: [
        { type: 'GalleryList', id: 'LIST' },
        { type: 'Listing', id: 'LIST' },
      ],
    }),
  }),
});

// ---------------------------------------------------------------------------
// Helper — chunk send-to-listings requests at 50 (mirrors backend cap, AC-167)
// ---------------------------------------------------------------------------

const SEND_CHUNK_SIZE = 50;

/**
 * Aggregates per-chunk responses into a single shape. Pure function — easy to
 * test. Does NOT touch the network; pass it pre-fetched chunk responses.
 */
export const aggregateSendResults = (
  chunks: DesignAssetFromDesignResponse[],
): DesignAssetFromDesignResponse => {
  const created: string[] = [];
  const skipped_duplicates: string[] = [];
  const rejected_ineligible: DesignAssetFromDesignResponse['rejected_ineligible'] = [];
  const failed: NonNullable<DesignAssetFromDesignResponse['failed']> = [];
  for (const c of chunks) {
    created.push(...c.created);
    skipped_duplicates.push(...c.skipped_duplicates);
    rejected_ineligible.push(...c.rejected_ineligible);
    if (c.failed?.length) failed.push(...c.failed);
  }
  return {
    created,
    skipped_duplicates,
    rejected_ineligible,
    ...(failed.length ? { failed } : {}),
  };
};

export type SendInChunksRunner = (
  body: DesignAssetFromDesignBody,
) => Promise<DesignAssetFromDesignResponse>;

/**
 * Splits `design_ids` at SEND_CHUNK_SIZE and runs the supplied mutation
 * sequentially, aggregating responses. The runner is the
 * `sendDesignsToListings.unwrap()` callback from the RTK hook.
 *
 * Sequential (not parallel) — keeps backend load predictable + lets the user
 * cancel mid-flight in a future iteration without orphaned requests.
 */
export const sendDesignsInChunks = async (
  designIds: string[],
  runner: SendInChunksRunner,
): Promise<DesignAssetFromDesignResponse> => {
  if (designIds.length === 0) {
    return { created: [], skipped_duplicates: [], rejected_ineligible: [] };
  }
  const chunks: DesignAssetFromDesignResponse[] = [];
  for (let i = 0; i < designIds.length; i += SEND_CHUNK_SIZE) {
    const slice = designIds.slice(i, i + SEND_CHUNK_SIZE);
    const result = await runner({ design_ids: slice });
    chunks.push(result);
  }
  return aggregateSendResults(chunks);
};

export const SEND_TO_LISTINGS_CHUNK_SIZE = SEND_CHUNK_SIZE;
export const SEND_TO_LISTINGS_BULK_THRESHOLD = SEND_CHUNK_SIZE;

export const {
  // Listing
  useGetListingQuery,
  useLazyGetListingQuery,
  useUpdateListingMutation,
  useTranslateListingMutation,
  useAiImproveListingMutation,
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
  // MBA Product Catalog
  useGetMbaProductCatalogQuery,
  // Design Product Config
  useGetProductConfigQuery,
  useUpdateProductConfigMutation,
  useCopyProductConfigFromMutation,
  // FlyingUpload Export (Phase U1)
  usePreviewExportMutation,
  useRunExportMutation,
  useListExportHistoryQuery,
  // Send Designs to Listings (PROJ-9 Phase O)
  useSendDesignsToListingsMutation,
} = publishApi;
