import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useGenerateListingMutation,
  useGetListingQuery,
  useUpdateListingMutation,
  useTranslateListingMutation,
  useTmCheckMutation,
  useLazyExportListingQuery,
} from '@/store/publishSlice';
import { listingSchema, type ListingFormValues } from '../schemas/listingSchema';
import type { ListingLanguage, TMCheckResult } from '../types';

export const useListingEditor = (ideaId: string | null) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const {
    data: listing,
    isLoading: isLoadingListing,
    error: listingError,
  } = useGetListingQuery(ideaId ?? '', { skip: !ideaId });

  const [generateListing, { isLoading: isGenerating }] = useGenerateListingMutation();
  const [updateListing, { isLoading: isSaving }] = useUpdateListingMutation();
  const [translateListing, { isLoading: isTranslating }] = useTranslateListingMutation();
  const [tmCheck, { isLoading: isChecking }] = useTmCheckMutation();
  const [triggerExport] = useLazyExportListingQuery();

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      brand_name: '',
      title: '',
      bullet_1: '',
      bullet_2: '',
      bullet_3: '',
      bullet_4: '',
      bullet_5: '',
      description: '',
      backend_keywords: '',
      availability: 'public',
      publish_mode: 'live',
    },
    values: listing
      ? {
          brand_name: listing.brand_name,
          title: listing.title,
          bullet_1: listing.bullet_1,
          bullet_2: listing.bullet_2,
          bullet_3: listing.bullet_3,
          bullet_4: listing.bullet_4,
          bullet_5: listing.bullet_5,
          description: listing.description,
          backend_keywords: listing.backend_keywords,
          availability: listing.availability,
          publish_mode: listing.publish_mode,
        }
      : undefined,
  });

  const handleGenerate = useCallback(
    async (designId?: string, extraKeywords?: string, language?: ListingLanguage) => {
      if (!ideaId) return;
      try {
        await generateListing({
          ideaId,
          body: { design_id: designId, extra_keywords: extraKeywords, language },
        }).unwrap();
        enqueueSnackbar(t('publish.listing.generateSuccess'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('publish.listing.generateError'), { variant: 'error' });
      }
    },
    [ideaId, generateListing, enqueueSnackbar, t],
  );

  const handleSave = useCallback(
    async (values: ListingFormValues) => {
      if (!listing) return;
      try {
        await updateListing({ id: listing.id, body: values }).unwrap();
        enqueueSnackbar(t('publish.listing.saveSuccess'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('publish.listing.saveError'), { variant: 'error' });
      }
    },
    [listing, updateListing, enqueueSnackbar, t],
  );

  const handleTranslate = useCallback(
    async (targetLanguages: ListingLanguage[]) => {
      if (!listing) return;
      try {
        await translateListing({
          id: listing.id,
          body: { target_languages: targetLanguages },
        }).unwrap();
        enqueueSnackbar(t('publish.translate.success'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('publish.translate.error'), { variant: 'error' });
      }
    },
    [listing, translateListing, enqueueSnackbar, t],
  );

  const handleTMCheck = useCallback(async (): Promise<TMCheckResult | null> => {
    if (!listing) return null;
    try {
      const result = await tmCheck(listing.id).unwrap();
      if (result.is_clean) {
        enqueueSnackbar(t('publish.tm.clean'), { variant: 'success' });
      } else {
        enqueueSnackbar(t('publish.tm.flagged'), { variant: 'warning' });
      }
      return result;
    } catch {
      enqueueSnackbar(t('publish.tm.error'), { variant: 'error' });
      return null;
    }
  }, [listing, tmCheck, enqueueSnackbar, t]);

  const handleExport = useCallback(async () => {
    if (!listing) return;
    try {
      const result = await triggerExport(listing.id).unwrap();
      await navigator.clipboard.writeText(result);
      enqueueSnackbar(t('publish.listing.copied'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('publish.listing.copyError'), { variant: 'error' });
    }
  }, [listing, triggerExport, enqueueSnackbar, t]);

  return useMemo(
    () => ({
      listing,
      isLoadingListing,
      listingError,
      form,
      isGenerating,
      isSaving,
      isTranslating,
      isChecking,
      handleGenerate,
      handleSave,
      handleTranslate,
      handleTMCheck,
      handleExport,
    }),
    [
      listing,
      isLoadingListing,
      listingError,
      form,
      isGenerating,
      isSaving,
      isTranslating,
      isChecking,
      handleGenerate,
      handleSave,
      handleTranslate,
      handleTMCheck,
      handleExport,
    ],
  );
};
