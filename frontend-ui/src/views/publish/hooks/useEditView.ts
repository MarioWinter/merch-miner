import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListGalleryQuery,
  useLazyGetListingQuery,
  useCopyProductConfigFromMutation,
} from '@/store/publishSlice';
import { useCommandPalette } from './useCommandPalette';
import { useEditFormState } from './useEditFormState';
import { useListingEditor } from './useListingEditor';
import type { MarketplaceTab } from '../partials/edit/MarketplaceTabs';
import type { CopyScope } from '../partials/edit/CopyFromDesignDialog';
import type {
  DesignAsset,
  FlyingUploadFormat,
  FlyingUploadTemplate,
  Listing,
  MarketplaceType,
  ProductConfigCopyScope,
} from '../types';
import {
  mbaListingDefaultValues,
  mbaListingSchema,
  type MbaListingFormValues,
  type MbaListingLanguage,
} from '../schemas/mbaListingSchema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parseDesignIds = (raw: string | null): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const listingToFormValues = (listing: Listing | null): MbaListingFormValues => {
  if (!listing) return mbaListingDefaultValues;
  return {
    brand: listing.brand_name ?? '',
    title: listing.title ?? '',
    bullet_1: listing.bullet_1 ?? '',
    bullet_2: listing.bullet_2 ?? '',
    description: listing.description ?? '',
    keyword_context: listing.keyword_context ?? '',
    translations: (listing.translations as MbaListingFormValues['translations']) ?? {},
    auto_translate: false,
    availability: (listing.availability ?? 'public') as MbaListingFormValues['availability'],
    publish_mode: (listing.publish_mode ?? 'live') as MbaListingFormValues['publish_mode'],
  };
};

// ---------------------------------------------------------------------------
// Hook — EditView state + handlers
// ---------------------------------------------------------------------------
// D7: multi-marketplace-aware listing editor. Each `activeMarketplace` tab
// owns its own Listing record on the backend (F1). Switching tabs loads the
// matching Listing for the currently active design.
// G-Config: product config (colors, fit types, print side, product types,
// marketplace pricing) is persisted per (design, marketplace_type) pair via
// the F4 endpoints — see useProductConfig.

// Map CopyScope (frontend dialog) → backend scope keys for
// `/api/designs/{id}/product-config/copy-from/`. `listing` is handled via
// the listing editor path and is not a product-config scope.
const mapCopyScopeToProductConfigScope = (
  scope: CopyScope,
): ProductConfigCopyScope | null => {
  switch (scope) {
    case 'colors':
      return 'colors';
    case 'fit_types':
      return 'fit_types';
    case 'prices':
      return 'marketplaces';
    // Product types do not have a dedicated CopyScope today, but keep the
    // mapping side exhaustive so future additions compile-fail if missing.
    default:
      return null;
  }
};

export const useEditView = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const designIds = useMemo(
    () => parseDesignIds(searchParams.get('designs')),
    [searchParams],
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [activeMarketplace, setActiveMarketplace] =
    useState<MarketplaceTab>('mba');

  // D5/D7: MBA listing form
  const listingForm = useForm<MbaListingFormValues>({
    resolver: zodResolver(mbaListingSchema),
    defaultValues: mbaListingDefaultValues,
    mode: 'onChange',
  });

  // D5: language tab + auto-translate toggle (local UI state)
  const [activeLang, setActiveLang] = useState<MbaListingLanguage>('en');
  const [autoTranslate, setAutoTranslate] = useState(false);

  // ---- Gallery ----------------------------------------------------------
  const { data: galleryData, isLoading } = useListGalleryQuery(
    { page: 1, page_size: 200, sort_by: 'newest' },
    { skip: designIds.length === 0 },
  );

  const designs: DesignAsset[] = useMemo(() => {
    if (!galleryData?.results) return [];
    const byId = new Map(galleryData.results.map((d) => [d.id, d]));
    return designIds
      .map((id) => byId.get(id))
      .filter((d): d is DesignAsset => Boolean(d));
  }, [galleryData, designIds]);

  const activeDesign = designs[activeIndex];
  const activeIdeaId = activeDesign?.idea ?? null;

  // ---- D7: listing editor (per-marketplace) -----------------------------
  const listingEditor = useListingEditor({
    ideaId: activeIdeaId,
    marketplaceType: activeMarketplace as MarketplaceType,
  });

  // ---- Phase O2/P: auto-save hybrid state layer -------------------------
  // Per-product control surface (controlSetters + textSetters + priceSetters)
  // and offline queue. Superseded the legacy `useProductConfig` hook in Phase
  // P1/P2 cleanup (2026-04-23). The offline queue handles pending-save
  // flushing; there is no separate flush() to call on unmount.
  const editFormState = useEditFormState({
    designId: activeDesign?.id ?? null,
    marketplaceType: activeMarketplace as MarketplaceType,
    listingId: listingEditor.listing?.id ?? null,
    listing: listingEditor.listing,
  });

  // Sync server listing -> form on load / tab switch / design switch.
  // Tracks the last key we reset against so we don't wipe user edits.
  const lastSyncKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${activeDesign?.id ?? 'none'}|${activeMarketplace}|${listingEditor.listing?.id ?? 'none'}`;
    if (key === lastSyncKeyRef.current) return;
    lastSyncKeyRef.current = key;
    listingForm.reset(listingToFormValues(listingEditor.listing));
  }, [
    activeDesign?.id,
    activeMarketplace,
    listingEditor.listing,
    listingForm,
  ]);

  // ---- D7: auto-save on dirty form --------------------------------------
  const watchedValues = useWatch({ control: listingForm.control });
  // RHF-tracked fields only drive the listingEditor auto-save path.
  // Phase P moved primary text fields onto editFormState.textSetters so
  // they PATCH on blur through the offline queue instead.
  const isFormDirty = listingForm.formState.isDirty;
  // UI banner signal combines both — text/price edits from editFormState
  // should surface the unsaved-changes bar too.
  const isDirty = isFormDirty || editFormState.isDirty;
  useEffect(() => {
    if (!isFormDirty) return;
    if (!listingEditor.listing) return;
    listingEditor.scheduleAutoSave(
      watchedValues as MbaListingFormValues,
      (updated) => {
        if (updated) {
          // Reset form keepValues so `isDirty` goes back to false without
          // losing the current edits.
          listingForm.reset(listingToFormValues(updated), { keepValues: true });
        }
      },
    );
    return () => listingEditor.cancelAutoSave();
  }, [watchedValues, isFormDirty, listingEditor, listingForm]);

  // ---- Discard / Save (manual) ------------------------------------------
  // AC-74: the Save button must flush ALL dirty buffers — the RHF form,
  // pending-blur text fields on editFormState, AND debounced price PATCHes.
  // Earlier round only reset RHF, which silently dropped pending text edits.
  const handleDiscardListing = useCallback(() => {
    listingForm.reset(listingToFormValues(listingEditor.listing));
    editFormState.discard();
  }, [listingForm, listingEditor.listing, editFormState]);

  const handleSaveListing = useCallback(async () => {
    const values = listingForm.getValues();
    // Kick both pipelines in parallel — they target disjoint mutations.
    const [updated] = await Promise.all([
      listingEditor.handleSave(values),
      editFormState.manualSave(),
    ]);
    if (updated) {
      listingForm.reset(listingToFormValues(updated));
    }
  }, [listingForm, listingEditor, editFormState]);

  // ---- Design IDs <-> URL ----------------------------------------------
  const handleDesignIdsChange = useCallback(
    (nextIds: string[]) => {
      const nextParams = new URLSearchParams(searchParams);
      if (nextIds.length === 0) {
        nextParams.delete('designs');
      } else {
        nextParams.set('designs', nextIds.join(','));
      }
      setSearchParams(nextParams, { replace: false });
      setActiveIndex((idx) =>
        idx >= nextIds.length ? Math.max(0, nextIds.length - 1) : idx,
      );
    },
    [searchParams, setSearchParams],
  );

  // ---- G3: Marketplace conversion --------------------------------------
  // User chooses "Convert from {source}" from the Command Palette. We need
  // the source Listing id, so this first lazy-fetches the source listing
  // for the active design + source marketplace, then calls POST
  // /api/listings/convert/. If the target already exists (409) we stash the
  // pending conversion and open a ConfirmDialog — on confirm we retry with
  // `overwrite=true`.
  const [pendingConvert, setPendingConvert] = useState<{
    sourceMarketplace: MarketplaceType;
    sourceListingId: string;
  } | null>(null);

  // Declared here (ahead of `handleConvertFrom`) so the RTK Query hooks are in
  // scope before the callbacks that reference them. Temporal-dead-zone lookup
  // in a deps array would otherwise crash the hook at render time.
  const [fetchSourceListing] = useLazyGetListingQuery();
  const [copyProductConfigFrom] = useCopyProductConfigFromMutation();

  const executeConvert = useCallback(
    async (args: {
      sourceListingId: string;
      sourceMarketplace: MarketplaceType;
      overwrite: boolean;
    }) => {
      const result = await listingEditor.handleConvert({
        sourceListingId: args.sourceListingId,
        targetMarketplaceType: activeMarketplace as MarketplaceType,
        overwrite: args.overwrite,
      });
      if (result === 'conflict') {
        setPendingConvert({
          sourceMarketplace: args.sourceMarketplace,
          sourceListingId: args.sourceListingId,
        });
        return;
      }
      if (result) {
        // Cache invalidation handles the refetch for the target tab.
        // Reset local form against the fresh converted listing.
        listingForm.reset(listingToFormValues(result));
      }
    },
    [listingEditor, activeMarketplace, listingForm],
  );

  const handleConvertFrom = useCallback(
    async (sourceMarketplace: MarketplaceType) => {
      if (sourceMarketplace === activeMarketplace) return;
      if (!activeIdeaId) {
        enqueueSnackbar(
          t('publish.convert.noIdea', {
            defaultValue: 'Select a design with a linked idea first.',
          }),
          { variant: 'warning' },
        );
        return;
      }
      let sourceListing;
      try {
        sourceListing = await fetchSourceListing({
          ideaId: activeIdeaId,
          marketplace_type: sourceMarketplace,
        }).unwrap();
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          enqueueSnackbar(
            t('publish.convert.sourceMissing', {
              defaultValue:
                'No {{source}} listing to convert from. Generate one first.',
              source: sourceMarketplace.toUpperCase(),
            }),
            { variant: 'warning' },
          );
        } else {
          enqueueSnackbar(
            t('publish.convert.error', {
              defaultValue: 'Failed to convert listing',
            }),
            { variant: 'error' },
          );
        }
        return;
      }
      await executeConvert({
        sourceListingId: sourceListing.id,
        sourceMarketplace,
        overwrite: false,
      });
    },
    [
      activeMarketplace,
      activeIdeaId,
      fetchSourceListing,
      executeConvert,
      enqueueSnackbar,
      t,
    ],
  );

  const confirmConvertOverwrite = useCallback(async () => {
    if (!pendingConvert) return;
    const { sourceListingId, sourceMarketplace } = pendingConvert;
    setPendingConvert(null);
    await executeConvert({
      sourceListingId,
      sourceMarketplace,
      overwrite: true,
    });
  }, [pendingConvert, executeConvert]);

  const cancelConvertOverwrite = useCallback(() => {
    setPendingConvert(null);
  }, []);

  // ---- D7: Copy from design (bulk apply) --------------------------------
  // Scope 'listing' fetches the source design's Listing for the active
  // marketplace and resets the form with those values. Auto-save then
  // persists the change. Scopes 'colors'/'fit_types'/'prices' piggyback the
  // same dialog but are not yet wired — product config is not per-design
  // today, so they surface an info snackbar and leave state untouched.
  const [copyDialog, setCopyDialog] = useState<{
    open: boolean;
    scope: CopyScope | null;
  }>({ open: false, scope: null });
  const [isApplyingCopy, setIsApplyingCopy] = useState(false);

  const openCopyDialog = useCallback((scope: CopyScope) => {
    setCopyDialog({ open: true, scope });
  }, []);

  const closeCopyDialog = useCallback(() => {
    setCopyDialog({ open: false, scope: null });
  }, []);

  const applyCopy = useCallback(
    async (sourceDesignId: string, scope: CopyScope) => {
      // Listing scope: lazy-fetch source listing + seed the RHF form. Not a
      // product-config scope, so we don't call the copy-from endpoint.
      if (scope === 'listing') {
        const source = designs.find((d) => d.id === sourceDesignId);
        if (!source?.idea) {
          enqueueSnackbar(
            t('publish.copyFrom.noListing', {
              defaultValue: 'Source design has no linked idea/listing.',
            }),
            { variant: 'warning' },
          );
          return;
        }
        setIsApplyingCopy(true);
        try {
          const sourceListing = await fetchSourceListing({
            ideaId: source.idea,
            marketplace_type: activeMarketplace as MarketplaceType,
          }).unwrap();
          listingForm.reset(listingToFormValues(sourceListing));
          enqueueSnackbar(
            t('publish.copyFrom.success', {
              defaultValue: 'Listing copied — save to persist.',
            }),
            { variant: 'success' },
          );
          closeCopyDialog();
        } catch {
          enqueueSnackbar(
            t('publish.copyFrom.error', {
              defaultValue: 'Failed to load source listing.',
            }),
            { variant: 'error' },
          );
        } finally {
          setIsApplyingCopy(false);
        }
        return;
      }

      // Product-config scope: call the backend copy-from endpoint, which
      // atomically upserts the target config from the source row. RTK cache
      // invalidation drives the UI refresh.
      const targetDesignId = activeDesign?.id;
      if (!targetDesignId) return;
      const backendScope = mapCopyScopeToProductConfigScope(scope);
      if (!backendScope) return;

      setIsApplyingCopy(true);
      try {
        // Flush any pending local auto-save first so we don't race the
        // server-side copy. The offline queue (Phase O4) drains through
        // `manualSave`, which awaits every buffered PATCH before returning.
        await editFormState.manualSave();
        await copyProductConfigFrom({
          designId: targetDesignId,
          source_design_id: sourceDesignId,
          marketplace_type: activeMarketplace as MarketplaceType,
          scope: backendScope,
        }).unwrap();
        enqueueSnackbar(
          t('publish.copyFrom.success', {
            defaultValue: 'Listing copied — save to persist.',
          }),
          { variant: 'success' },
        );
        closeCopyDialog();
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          enqueueSnackbar(
            t('publish.copyFrom.sourceNoConfig', {
              defaultValue: 'Source has no config for {{marketplace}}.',
              marketplace: (activeMarketplace as string).toUpperCase(),
            }),
            { variant: 'warning' },
          );
        } else {
          enqueueSnackbar(
            t('publish.productConfig.saveError', {
              defaultValue: 'Failed to save product configuration.',
            }),
            { variant: 'error' },
          );
        }
      } finally {
        setIsApplyingCopy(false);
      }
    },
    [
      designs,
      activeDesign?.id,
      activeMarketplace,
      fetchSourceListing,
      listingForm,
      enqueueSnackbar,
      t,
      closeCopyDialog,
      copyProductConfigFrom,
      editFormState,
    ],
  );

  // ---- Phase W4 — FlyingUpload export state ----------------------------
  // `exportRequest` is null when the preflight dialog is closed. Set it via
  // the palette actions to open the dialog with the chosen template+format.
  const [exportRequest, setExportRequest] = useState<{
    template: FlyingUploadTemplate;
    format: FlyingUploadFormat;
  } | null>(null);
  const closeExportDialog = useCallback(() => setExportRequest(null), []);
  const openExport = useCallback(
    (template: FlyingUploadTemplate, format: FlyingUploadFormat) => {
      if (designIds.length < 1) return;
      setExportRequest({ template, format });
    },
    [designIds.length],
  );

  // ---- Command palette wiring ------------------------------------------
  const cmdPalette = useCommandPalette({
    onEditBulk: () => {},
    onDeleteListings: () => {},
    onMoveToCollection: () => {},
    onDuplicate: () => {},
    onTranslate: () => listingEditor.handleTranslate([activeLang]),
    onBulkTags: () => {},
    onDeleteFiles: () => {},
    onDownload: () => {},
    onExportXlsx: () => {},
    onExportCsv: () => {
      void listingEditor.handleExport();
    },
    // Phase W4 — 3 FlyingUpload export entries. `exportSelectionCount`
    // mirrors the URL's design count, so the palette grays the actions when
    // no designs are loaded in this editor session.
    onExportXlsxMba: () => openExport('mba', 'xlsx'),
    onExportXlsxBasic: () => openExport('basic', 'xlsx'),
    onExportCsvFlyingUpload: () => openExport('basic', 'csv'),
    exportSelectionCount: designIds.length,
    onSendToCloud: () => {},
    onImportCloud: () => {},
    onApplyTemplate: () => {},
    onCopyListingFrom: () => openCopyDialog('listing'),
    onCopyColorsFrom: () => openCopyDialog('colors'),
    onCopyFitTypesFrom: () => openCopyDialog('fit_types'),
    onCopyPricesFrom: () => openCopyDialog('prices'),
    onConvertFromGlobal: () => {
      void handleConvertFrom('global');
    },
    onConvertFromMba: () => {
      void handleConvertFrom('mba');
    },
    activeMarketplace,
  });

  return {
    // URL + gallery
    designIds,
    designs,
    activeDesign,
    activeIndex,
    setActiveIndex,
    isLoading,
    handleDesignIdsChange,
    // Tabs
    activeMarketplace,
    setActiveMarketplace,
    // D5 listing form + language
    listingForm,
    activeLang,
    setActiveLang,
    autoTranslate,
    setAutoTranslate,
    // D7 listing editor state
    listing: listingEditor.listing,
    isLoadingListing: listingEditor.isLoadingListing,
    isFetchingListing: listingEditor.isFetchingListing,
    listingError: listingEditor.listingError,
    listingNotFound: listingEditor.listingNotFound,
    handleRetryListing: listingEditor.refetchListing,
    isSaving: listingEditor.isSaving,
    isAutoSaving: listingEditor.isAutoSaving,
    isTranslating: listingEditor.isTranslating,
    // D6/D7 unsaved changes + save flow
    isDirty,
    handleDiscardListing,
    handleSaveListing,
    handleConvertFrom,
    // Phase O3/Round-4: rich 5-state banner inputs + manual Save button
    // (AC-74) inputs drawn from the editFormState composite.
    isEditSaving: editFormState.isSaving,
    editSaveError: editFormState.saveError,
    isEditOnline: editFormState.isOnline,
    editQueueLength: editFormState.queueLength,
    // G3 convert conflict dialog
    pendingConvert,
    isConverting: listingEditor.isConverting,
    confirmConvertOverwrite,
    cancelConvertOverwrite,
    // D7 copy-from-design
    copyDialog,
    isApplyingCopy,
    openCopyDialog,
    closeCopyDialog,
    applyCopy,
    // Command palette
    cmdPalette,
    // ---- Phase W4 — FlyingUpload export dialog state --------------------
    exportRequest,
    closeExportDialog,
    // ---- Phase O2: auto-save hybrid state layer (namespaced so it doesn't
    // shadow legacy fields; Phase P components consume via this prop) ----
    editFormState,
  };
};

export type UseEditViewReturn = ReturnType<typeof useEditView>;
