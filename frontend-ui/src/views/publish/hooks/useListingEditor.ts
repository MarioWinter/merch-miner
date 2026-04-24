import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useGetListingQuery,
  useUpdateListingMutation,
  useTranslateListingMutation,
  useLazyExportListingQuery,
  useConvertListingMutation,
} from '@/store/publishSlice';
import type {
  ListingLanguage,
  MarketplaceType,
  Listing,
  ConvertListingResponse,
} from '../types';
import type { MbaListingFormValues } from '../schemas/mbaListingSchema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseListingEditorArgs {
  ideaId: string | null;
  marketplaceType: MarketplaceType;
}

type RtkError = { status?: number; data?: unknown };

const isNotFound = (err: unknown): boolean =>
  Boolean(err && typeof err === 'object' && (err as RtkError).status === 404);

const AUTO_SAVE_DELAY_MS = 1200;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * D7 — Multi-marketplace listing editor.
 *
 * Resolves the Listing record for the given (idea, marketplace_type) pair and
 * exposes save / generate / translate / tm-check / export handlers. Each
 * marketplace tab maps to its own Listing row on the backend (see F1), so
 * switching `marketplaceType` triggers a fresh query.
 *
 * Auto-save: when the form is marked dirty, we debounce a PATCH to the listing
 * endpoint. Callers must provide the MBA form values (via `saveFormValues`) so
 * auto-save can serialize the RHF state before calling the API.
 */
export const useListingEditor = ({
  ideaId,
  marketplaceType,
}: UseListingEditorArgs) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // ---- Listing load -------------------------------------------------------
  const {
    data: listing,
    isLoading: isLoadingListing,
    isFetching: isFetchingListing,
    error: listingError,
    refetch: refetchListing,
  } = useGetListingQuery(
    ideaId ? { ideaId, marketplace_type: marketplaceType } : { ideaId: '' },
    { skip: !ideaId },
  );

  const listingNotFound = !listing && isNotFound(listingError);
  const hasHardError = Boolean(listingError) && !listingNotFound;

  const [updateListing, { isLoading: isSaving }] = useUpdateListingMutation();
  const [translateListing, { isLoading: isTranslating }] = useTranslateListingMutation();
  const [triggerExport] = useLazyExportListingQuery();
  const [convertListing, { isLoading: isConverting }] = useConvertListingMutation();

  // Track last-saved listing id so that rapid tab switches do not PATCH a
  // stale record.
  const latestListingIdRef = useRef<string | null>(null);
  useEffect(() => {
    latestListingIdRef.current = listing?.id ?? null;
  }, [listing?.id]);


  // ---- Save (manual) -----------------------------------------------------
  const serializeFormValues = useCallback(
    (values: MbaListingFormValues): Partial<Listing> => ({
      brand_name: values.brand,
      title: values.title,
      bullet_1: values.bullet_1,
      bullet_2: values.bullet_2,
      description: values.description,
      keyword_context: values.keyword_context,
      availability: values.availability,
      publish_mode: values.publish_mode,
    }),
    [],
  );

  const handleSave = useCallback(
    async (values: MbaListingFormValues) => {
      const targetId = latestListingIdRef.current;
      if (!targetId) {
        enqueueSnackbar(
          t('publish.listing.saveNoListing', {
            defaultValue: 'Create a listing first before saving.',
          }),
          { variant: 'warning' },
        );
        return null;
      }
      try {
        const updated = await updateListing({
          id: targetId,
          body: serializeFormValues(values),
        }).unwrap();
        enqueueSnackbar(
          t('publish.listing.saveSuccess', { defaultValue: 'Listing saved' }),
          { variant: 'success' },
        );
        return updated;
      } catch (err) {
        const status = (err as RtkError)?.status;
        if (status === 409) {
          enqueueSnackbar(
            t('publish.listing.saveDuplicate', {
              defaultValue: 'This marketplace already has a listing',
            }),
            { variant: 'error' },
          );
        } else {
          enqueueSnackbar(
            t('publish.listing.saveError', {
              defaultValue: 'Failed to save listing',
            }),
            { variant: 'error' },
          );
        }
        return null;
      }
    },
    [updateListing, serializeFormValues, enqueueSnackbar, t],
  );

  // ---- Auto-save (debounced) --------------------------------------------
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const scheduleAutoSave = useCallback(
    (values: MbaListingFormValues, onSaved?: (l: Listing | null) => void) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (!latestListingIdRef.current) return;
      autoSaveTimerRef.current = setTimeout(async () => {
        setIsAutoSaving(true);
        const targetId = latestListingIdRef.current;
        if (!targetId) {
          setIsAutoSaving(false);
          return;
        }
        try {
          const updated = await updateListing({
            id: targetId,
            body: serializeFormValues(values),
          }).unwrap();
          onSaved?.(updated);
        } catch {
          // Failures surface via manual Save; keep auto-save silent so we
          // don't spam the user during typing.
          onSaved?.(null);
        } finally {
          setIsAutoSaving(false);
        }
      }, AUTO_SAVE_DELAY_MS);
    },
    [updateListing, serializeFormValues],
  );

  const cancelAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => cancelAutoSave, [cancelAutoSave]);

  // ---- Translate --------------------------------------------------------
  const handleTranslate = useCallback(
    async (targetLanguages: ListingLanguage[]) => {
      const targetId = latestListingIdRef.current;
      if (!targetId) return false;
      try {
        await translateListing({
          id: targetId,
          body: { target_languages: targetLanguages },
        }).unwrap();
        enqueueSnackbar(
          t('publish.translate.success', {
            defaultValue: 'Translation started',
          }),
          { variant: 'success' },
        );
        return true;
      } catch {
        enqueueSnackbar(
          t('publish.translate.error', {
            defaultValue: 'Translation failed',
          }),
          { variant: 'error' },
        );
        return false;
      }
    },
    [translateListing, enqueueSnackbar, t],
  );

  // ---- Convert (G3) -----------------------------------------------------
  // Wraps POST /api/listings/convert/. Returns the new/updated Listing on
  // success, `'conflict'` when the target marketplace already has a Listing
  // (caller must confirm overwrite + retry with `overwrite=true`), or
  // `null` on unexpected failure.
  const handleConvert = useCallback(
    async (args: {
      sourceListingId: string;
      targetMarketplaceType: MarketplaceType;
      overwrite?: boolean;
    }): Promise<ConvertListingResponse | 'conflict' | null> => {
      try {
        const converted = await convertListing({
          source_listing_id: args.sourceListingId,
          target_marketplace_type: args.targetMarketplaceType,
          overwrite: args.overwrite ?? false,
        }).unwrap();
        enqueueSnackbar(
          t('publish.convert.success', {
            defaultValue: 'Listing converted to {{target}}',
            target: args.targetMarketplaceType.toUpperCase(),
          }),
          { variant: 'success' },
        );
        return converted;
      } catch (err) {
        const status = (err as RtkError)?.status;
        if (status === 409) {
          return 'conflict';
        }
        if (status === 400) {
          enqueueSnackbar(
            t('publish.convert.invalid', {
              defaultValue: 'Conversion is not valid for this marketplace',
            }),
            { variant: 'warning' },
          );
          return null;
        }
        if (status === 404) {
          enqueueSnackbar(
            t('publish.convert.sourceMissing', {
              defaultValue: 'Source listing not found',
            }),
            { variant: 'error' },
          );
          return null;
        }
        enqueueSnackbar(
          t('publish.convert.error', {
            defaultValue: 'Failed to convert listing',
          }),
          { variant: 'error' },
        );
        return null;
      }
    },
    [convertListing, enqueueSnackbar, t],
  );

  // ---- Export (copy to clipboard) ---------------------------------------
  const handleExport = useCallback(async () => {
    const targetId = latestListingIdRef.current;
    if (!targetId) return;
    try {
      const result = await triggerExport(targetId).unwrap();
      await navigator.clipboard.writeText(
        typeof result === 'string' ? result : JSON.stringify(result),
      );
      enqueueSnackbar(
        t('publish.listing.copied', { defaultValue: 'Copied to clipboard' }),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar(
        t('publish.listing.copyError', {
          defaultValue: 'Failed to copy listing',
        }),
        { variant: 'error' },
      );
    }
  }, [triggerExport, enqueueSnackbar, t]);

  return useMemo(
    () => ({
      // State
      listing: listing ?? null,
      isLoadingListing,
      isFetchingListing,
      listingError: hasHardError ? listingError : null,
      listingNotFound,
      isSaving,
      isAutoSaving,
      isTranslating,
      isConverting,
      // Actions
      handleSave,
      scheduleAutoSave,
      cancelAutoSave,
      handleTranslate,
      handleExport,
      handleConvert,
      refetchListing,
    }),
    [
      listing,
      isLoadingListing,
      isFetchingListing,
      hasHardError,
      listingError,
      listingNotFound,
      isSaving,
      isAutoSaving,
      isTranslating,
      isConverting,
      handleSave,
      scheduleAutoSave,
      cancelAutoSave,
      handleTranslate,
      handleExport,
      handleConvert,
      refetchListing,
    ],
  );
};

export type UseListingEditorReturn = ReturnType<typeof useListingEditor>;
