import { useState, useCallback } from 'react';
import { useEnrichKeywordsMutation } from '@/store/keywordSlice';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

export const useJSEnrich = (marketplace: string) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [enrichKeywords, { isLoading: isBulkEnriching }] = useEnrichKeywordsMutation();
  const [enrichingKeywords, setEnrichingKeywords] = useState<Set<string>>(new Set());

  const enrichSingle = useCallback(
    async (keyword: string) => {
      setEnrichingKeywords((prev) => new Set(prev).add(keyword));
      try {
        await enrichKeywords({ keywords: [keyword], marketplace }).unwrap();
        enqueueSnackbar(t('keywords.enrich.success'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('keywords.errors.enrichFailed'), { variant: 'error' });
      } finally {
        setEnrichingKeywords((prev) => {
          const next = new Set(prev);
          next.delete(keyword);
          return next;
        });
      }
    },
    [enrichKeywords, marketplace, enqueueSnackbar, t],
  );

  const enrichBulk = useCallback(
    async (keywords: string[]) => {
      const kwSet = new Set(keywords);
      setEnrichingKeywords((prev) => new Set([...prev, ...kwSet]));
      try {
        await enrichKeywords({ keywords, marketplace }).unwrap();
        enqueueSnackbar(t('keywords.enrich.success'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('keywords.errors.enrichFailed'), { variant: 'error' });
      } finally {
        setEnrichingKeywords((prev) => {
          const next = new Set(prev);
          kwSet.forEach((k) => next.delete(k));
          return next;
        });
      }
    },
    [enrichKeywords, marketplace, enqueueSnackbar, t],
  );

  const isEnriching = useCallback(
    (keyword: string) => enrichingKeywords.has(keyword),
    [enrichingKeywords],
  );

  return {
    enrichSingle,
    enrichBulk,
    isBulkEnriching,
    isEnriching,
    enrichingCount: enrichingKeywords.size,
  };
};
