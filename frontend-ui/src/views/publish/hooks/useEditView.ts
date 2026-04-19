import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListGalleryQuery,
  useLazyGetListingQuery,
} from '@/store/publishSlice';
import { useCommandPalette } from './useCommandPalette';
import { useListingEditor } from './useListingEditor';
import type { MarketplaceTab } from '../partials/edit/MarketplaceTabs';
import type { CopyScope } from '../partials/edit/CopyFromDesignDialog';
import type {
  DesignAsset,
  Listing,
  MarketplaceConfig,
  MarketplaceType,
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

const parseBackendKeywords = (raw: string): string[] =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const listingToFormValues = (listing: Listing | null): MbaListingFormValues => {
  if (!listing) return mbaListingDefaultValues;
  return {
    brand: listing.brand_name ?? '',
    title: listing.title ?? '',
    bullet_1: listing.bullet_1 ?? '',
    bullet_2: listing.bullet_2 ?? '',
    bullet_3: listing.bullet_3 ?? '',
    bullet_4: listing.bullet_4 ?? '',
    bullet_5: listing.bullet_5 ?? '',
    description: listing.description ?? '',
    backend_keywords: parseBackendKeywords(listing.backend_keywords ?? ''),
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

interface ProductConfigState {
  productTypes: string[];
  fitTypes: string[];
  printSide: 'front' | 'back';
  colors: string[];
  marketplaces: MarketplaceConfig[];
}

const initialProductConfig: ProductConfigState = {
  productTypes: [],
  fitTypes: [],
  printSide: 'front',
  colors: [],
  marketplaces: [],
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

  // D4: local section state — to be lifted into react-hook-form in a later pass
  const [productConfig, setProductConfig] = useState<ProductConfigState>(
    initialProductConfig,
  );

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
    designId: activeDesign?.id ?? null,
    marketplaceType: activeMarketplace as MarketplaceType,
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
  const isDirty = listingForm.formState.isDirty;
  useEffect(() => {
    if (!isDirty) return;
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
  }, [watchedValues, isDirty, listingEditor, listingForm]);

  // ---- Discard / Save (manual) ------------------------------------------
  const handleDiscardListing = useCallback(() => {
    listingForm.reset(listingToFormValues(listingEditor.listing));
  }, [listingForm, listingEditor.listing]);

  const handleSaveListing = useCallback(async () => {
    const values = listingForm.getValues();
    const updated = await listingEditor.handleSave(values);
    if (updated) {
      listingForm.reset(listingToFormValues(updated));
    }
  }, [listingForm, listingEditor]);

  const handleGenerateListing = useCallback(async () => {
    const created = await listingEditor.handleGenerate();
    if (created) {
      listingForm.reset(listingToFormValues(created));
    }
  }, [listingEditor, listingForm]);

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

  // ---- D7: Marketplace conversion (stub for G3) ------------------------
  const handleConvertFrom = useCallback(
    (_sourceMarketplace: MarketplaceType) => {
      // G3: call POST /api/listings/convert/ — wiring deferred until F3 ships.
      // Intentionally a no-op until backend endpoint lands.
      void _sourceMarketplace;
      void activeMarketplace;
    },
    [activeMarketplace],
  );

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
  const [fetchSourceListing] = useLazyGetListingQuery();

  const openCopyDialog = useCallback((scope: CopyScope) => {
    setCopyDialog({ open: true, scope });
  }, []);

  const closeCopyDialog = useCallback(() => {
    setCopyDialog({ open: false, scope: null });
  }, []);

  const applyCopy = useCallback(
    async (sourceDesignId: string, scope: CopyScope) => {
      if (scope !== 'listing') {
        enqueueSnackbar(
          t('publish.copyFrom.notAvailable', {
            defaultValue:
              'This scope is coming with per-design product config.',
          }),
          { variant: 'info' },
        );
        closeCopyDialog();
        return;
      }
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
    },
    [
      designs,
      activeMarketplace,
      fetchSourceListing,
      listingForm,
      enqueueSnackbar,
      t,
      closeCopyDialog,
    ],
  );

  // ---- Command palette wiring ------------------------------------------
  const cmdPalette = useCommandPalette({
    onEditBulk: () => {},
    onDeleteListings: () => {},
    onMoveToCollection: () => {},
    onDuplicate: () => {},
    onTranslate: () => listingEditor.handleTranslate([activeLang]),
    onBulkTags: () => {},
    onAiGenerate: () => {
      void handleGenerateListing();
    },
    onDeleteFiles: () => {},
    onDownload: () => {},
    onExportXlsx: () => {},
    onExportCsv: () => {
      void listingEditor.handleExport();
    },
    onSendToCloud: () => {},
    onImportCloud: () => {},
    onApplyTemplate: () => {},
    onCopyListingFrom: () => openCopyDialog('listing'),
    onCopyColorsFrom: () => openCopyDialog('colors'),
    onCopyFitTypesFrom: () => openCopyDialog('fit_types'),
    onCopyPricesFrom: () => openCopyDialog('prices'),
  });

  // ---- Section setters (D4 local state) ---------------------------------
  const setProductTypes = useCallback((productTypes: string[]) => {
    setProductConfig((prev) => ({ ...prev, productTypes }));
  }, []);

  const setFitTypes = useCallback((fitTypes: string[]) => {
    setProductConfig((prev) => ({ ...prev, fitTypes }));
  }, []);

  const setPrintSide = useCallback((printSide: 'front' | 'back') => {
    setProductConfig((prev) => ({ ...prev, printSide }));
  }, []);

  const setColors = useCallback((colors: string[]) => {
    setProductConfig((prev) => ({ ...prev, colors }));
  }, []);

  const setMarketplaces = useCallback((marketplaces: MarketplaceConfig[]) => {
    setProductConfig((prev) => ({ ...prev, marketplaces }));
  }, []);

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
    // D4 product config
    productConfig,
    setProductTypes,
    setFitTypes,
    setPrintSide,
    setColors,
    setMarketplaces,
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
    isGenerating: listingEditor.isGenerating,
    isSaving: listingEditor.isSaving,
    isAutoSaving: listingEditor.isAutoSaving,
    isTranslating: listingEditor.isTranslating,
    isChecking: listingEditor.isChecking,
    handleTMCheck: listingEditor.handleTMCheck,
    // D6/D7 unsaved changes + save flow
    isDirty,
    handleDiscardListing,
    handleSaveListing,
    handleGenerateListing,
    handleConvertFrom,
    // D7 copy-from-design
    copyDialog,
    isApplyingCopy,
    openCopyDialog,
    closeCopyDialog,
    applyCopy,
    // Command palette
    cmdPalette,
  };
};

export type UseEditViewReturn = ReturnType<typeof useEditView>;
