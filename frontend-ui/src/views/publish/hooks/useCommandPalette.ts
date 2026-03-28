import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CommandAction } from '../types';

interface UseCommandPaletteOptions {
  onCopyListing?: () => void;
  onApplyTemplate?: () => void;
  onApplyColors?: () => void;
  onApplyFitTypes?: () => void;
  onApplyProductSettings?: () => void;
  onBulkUpload?: () => void;
}

export const useCommandPalette = (options: UseCommandPaletteOptions) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const actions: CommandAction[] = useMemo(
    () => [
      {
        id: 'copy-listing',
        label: t('publish.command.copyListing'),
        description: t('publish.command.copyListingDesc'),
        icon: 'ContentCopy',
        action: () => {
          options.onCopyListing?.();
          setOpen(false);
        },
      },
      {
        id: 'apply-template',
        label: t('publish.command.applyTemplate'),
        description: t('publish.command.applyTemplateDesc'),
        icon: 'Assignment',
        action: () => {
          options.onApplyTemplate?.();
          setOpen(false);
        },
      },
      {
        id: 'apply-colors',
        label: t('publish.command.applyColors'),
        description: t('publish.command.applyColorsDesc'),
        icon: 'Palette',
        action: () => {
          options.onApplyColors?.();
          setOpen(false);
        },
      },
      {
        id: 'apply-fit-types',
        label: t('publish.command.applyFitTypes'),
        description: t('publish.command.applyFitTypesDesc'),
        icon: 'Straighten',
        action: () => {
          options.onApplyFitTypes?.();
          setOpen(false);
        },
      },
      {
        id: 'apply-product-settings',
        label: t('publish.command.applyProductSettings'),
        description: t('publish.command.applyProductSettingsDesc'),
        icon: 'Settings',
        action: () => {
          options.onApplyProductSettings?.();
          setOpen(false);
        },
      },
      {
        id: 'bulk-upload',
        label: t('publish.command.bulkUpload'),
        description: t('publish.command.bulkUploadDesc'),
        icon: 'CloudUpload',
        action: () => {
          options.onBulkUpload?.();
          setOpen(false);
        },
      },
    ],
    [t, options],
  );

  const filtered = useMemo(() => {
    if (!query) return actions;
    const q = query.toLowerCase();
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
    );
  }, [actions, query]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
      }
    },
    [],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return useMemo(
    () => ({
      open,
      setOpen,
      query,
      setQuery,
      filteredActions: filtered,
    }),
    [open, query, filtered],
  );
};
