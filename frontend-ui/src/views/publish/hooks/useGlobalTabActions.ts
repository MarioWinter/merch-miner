import { useCallback, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import type {
  Listing,
  ListingKeywords,
  ListingLanguage,
} from '../types';
import { SUPPORTED_LANGUAGES } from '../types';
import type { UseEditFormStateReturn } from './useEditFormState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConfirmKind = 'copyEn' | 'clearAll' | null;

interface UseGlobalTabActionsArgs {
  listing: Listing | null;
  activeLang: ListingLanguage;
  keywordsSetters: UseEditFormStateReturn['keywordsSetters'];
}

// ---------------------------------------------------------------------------
// Hook — shared state + handlers for Global + Displate tab bulk actions
// ---------------------------------------------------------------------------

export const useGlobalTabActions = ({
  listing,
  activeLang,
  keywordsSetters,
}: UseGlobalTabActionsArgs) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const openConfirm = useCallback((kind: Exclude<ConfirmKind, null>) => {
    setConfirm(kind);
  }, []);
  const closeConfirm = useCallback(() => setConfirm(null), []);

  const openImport = useCallback(() => setImportOpen(true), []);
  const closeImport = useCallback(() => setImportOpen(false), []);

  const openAdvanced = useCallback(() => setAdvancedOpen(true), []);
  const closeAdvanced = useCallback(() => setAdvancedOpen(false), []);

  // ---- AC-134 "Copy EN keywords to all languages" ---------------------
  const runCopyEnToAll = useCallback(async () => {
    closeConfirm();
    const existing = listing?.keywords ?? {};
    const source = existing.en ?? [];
    if (source.length === 0) {
      enqueueSnackbar(
        t('publish.edit.global.tagging.copyEnEmpty', {
          defaultValue: 'EN has no keywords to copy.',
        }),
        { variant: 'warning' },
      );
      return;
    }
    const nonEnLangs = SUPPORTED_LANGUAGES.map((l) => l.code).filter(
      (c) => c !== 'en',
    );
    try {
      await Promise.all(
        nonEnLangs.map((lang) => keywordsSetters.setAll(lang, [...source])),
      );
      enqueueSnackbar(
        t('publish.edit.global.tagging.copyEnSuccess', {
          defaultValue: 'Copied EN keywords to {{count}} languages',
          count: nonEnLangs.length,
        }),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar(
        t('publish.edit.global.tagging.copyEnError', {
          defaultValue: 'Failed to copy keywords',
        }),
        { variant: 'error' },
      );
    }
  }, [listing?.keywords, keywordsSetters, enqueueSnackbar, t, closeConfirm]);

  // ---- AC-134 "Clear all keywords" ------------------------------------
  const runClearAll = useCallback(async () => {
    closeConfirm();
    const existing = listing?.keywords ?? {};
    const langsWithData = Object.keys(existing).filter(
      (lang) => (existing[lang as ListingLanguage]?.length ?? 0) > 0,
    );
    if (langsWithData.length === 0) {
      enqueueSnackbar(
        t('publish.edit.global.tagging.clearAllEmpty', {
          defaultValue: 'No keywords to clear.',
        }),
        { variant: 'info' },
      );
      return;
    }
    try {
      await Promise.all(
        langsWithData.map((lang) =>
          keywordsSetters.setAll(lang as ListingLanguage, []),
        ),
      );
      enqueueSnackbar(
        t('publish.edit.global.tagging.clearAllSuccess', {
          defaultValue: 'Cleared keywords across all languages',
        }),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar(
        t('publish.edit.global.tagging.clearAllError', {
          defaultValue: 'Failed to clear keywords',
        }),
        { variant: 'error' },
      );
    }
  }, [listing?.keywords, keywordsSetters, enqueueSnackbar, t, closeConfirm]);

  // ---- AC-134 "Import keywords from CSV" ------------------------------
  const runImportCsv = useCallback(
    async (merged: string[]) => {
      try {
        await keywordsSetters.setAll(activeLang, merged);
        enqueueSnackbar(
          t('publish.edit.global.import.success', {
            defaultValue: 'Imported {{count}} keywords',
            count: merged.length - (listing?.keywords?.[activeLang]?.length ?? 0),
          }),
          { variant: 'success' },
        );
        closeImport();
      } catch {
        enqueueSnackbar(
          t('publish.edit.global.import.error', {
            defaultValue: 'Failed to import keywords',
          }),
          { variant: 'error' },
        );
      }
    },
    [
      keywordsSetters,
      activeLang,
      listing?.keywords,
      enqueueSnackbar,
      t,
      closeImport,
    ],
  );

  return {
    // Confirm dialogs
    confirm,
    openConfirm,
    closeConfirm,
    runCopyEnToAll,
    runClearAll,
    // CSV Import
    importOpen,
    openImport,
    closeImport,
    runImportCsv,
    // Advanced Options dialog
    advancedOpen,
    openAdvanced,
    closeAdvanced,
  };
};

// Exported for consumers that need to read the active keywords map (e.g.
// the dialog needs the per-language existing chips) without re-deriving.
export type GlobalKeywords = ListingKeywords;
