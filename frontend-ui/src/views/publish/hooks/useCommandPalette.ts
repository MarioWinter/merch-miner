import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommandActionDef {
  id: string;
  label: string;
  icon: string;
  category: string;
  column: number; // 0, 1, or 2
  context?: string[]; // For Options filtering (e.g. ['colors', 'listing'])
  disabled?: boolean;
  isPro?: boolean;
  action: () => void;
}

export interface MatchedAction extends CommandActionDef {
  highlightRanges: [number, number][];
}

interface UseCommandPaletteOptions {
  onEditBulk?: () => void;
  onDeleteListings?: () => void;
  onMoveToCollection?: () => void;
  onDuplicate?: () => void;
  onSortListings?: () => void;
  onBulkSync?: () => void;
  onTranslate?: () => void;
  onBulkTags?: () => void;
  onDeleteFiles?: () => void;
  onDownload?: () => void;
  onExportXlsx?: () => void;
  onExportCsv?: () => void;
  // Phase W3/W4 — FlyingUpload export palette actions. Each opens the
  // ExportPreflightDialog with the caller-provided `template`+`format` pair.
  onExportXlsxMba?: () => void;
  onExportXlsxBasic?: () => void;
  onExportCsvFlyingUpload?: () => void;
  /** Selection size used to gate the 3 FlyingUpload export actions. Hidden
   *  from other palette slots so the conversion actions keep their own
   *  enablement rules. */
  exportSelectionCount?: number;
  onSendToCloud?: () => void;
  onImportCloud?: () => void;
  onApplyTemplate?: () => void;
  onCopyListingFrom?: () => void;
  onCopyColorsFrom?: () => void;
  onCopyFitTypesFrom?: () => void;
  onCopyPricesFrom?: () => void;
  onConvertFromGlobal?: () => void;
  onConvertFromMba?: () => void;
  /** Current marketplace tab — used to disable the conversion action whose
   *  target equals the source (can't convert MBA → MBA). */
  activeMarketplace?: 'global' | 'mba' | 'displate';
}

const STORAGE_KEY = 'mm-command-recent';
const MAX_RECENT = 3;

// Map fine-grained SectionHeader contexts (e.g. 'bullet_1', 'brand',
// 'print_side') onto the coarse action contexts that CommandActionDef
// entries filter by. Keeps SectionHeader context strings descriptive while
// palette filtering stays simple.
const SECTION_CONTEXT_MAP: Record<string, string> = {
  brand: 'listing',
  title: 'listing',
  bullet_1: 'listing',
  bullet_2: 'listing',
  description: 'listing',
  keyword_context: 'listing',
  availability: 'listing',
  publish_mode: 'listing',
  products: 'listing',
  print_side: 'fit_types',
};

const normalizeContext = (ctx?: string): string | null => {
  if (!ctx) return null;
  return SECTION_CONTEXT_MAP[ctx] ?? ctx;
};

// ---------------------------------------------------------------------------
// Fuzzy match — returns highlight ranges or null
// ---------------------------------------------------------------------------

const fuzzyMatch = (
  text: string,
  query: string,
): [number, number][] | null => {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx === -1) return null;
  return [[idx, idx + q.length]];
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useCommandPalette = (options: UseCommandPaletteOptions) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeState, setActiveState] = useState({ index: 0, key: '' });
  const [context, setContext] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  });

  // Build action registry
  const actions: CommandActionDef[] = useMemo(
    () => [
      // Column 0: LISTING + GENERAL
      { id: 'edit-bulk', label: t('publish.command.editBulk', { defaultValue: 'Edit in Bulk' }), icon: 'EditOutlined', category: 'LISTING', column: 0, context: ['listing'], disabled: !options.onEditBulk, action: () => options.onEditBulk?.() },
      { id: 'delete-listings', label: t('publish.command.deleteListings', { defaultValue: 'Delete Listings' }), icon: 'DeleteOutline', category: 'LISTING', column: 0, context: ['listing'], disabled: !options.onDeleteListings, action: () => options.onDeleteListings?.() },
      { id: 'move-collection', label: t('publish.command.moveCollection', { defaultValue: 'Move to Collection' }), icon: 'DriveFileMoveOutlined', category: 'LISTING', column: 0, context: ['listing'], disabled: !options.onMoveToCollection, action: () => options.onMoveToCollection?.() },
      { id: 'duplicate', label: t('publish.command.duplicate', { defaultValue: 'Duplicate' }), icon: 'ContentCopyOutlined', category: 'LISTING', column: 0, disabled: !options.onDuplicate, action: () => options.onDuplicate?.() },
      { id: 'sort-listings', label: t('publish.command.sortListings', { defaultValue: 'Sort Listings' }), icon: 'SwapVertOutlined', category: 'LISTING', column: 0, disabled: !options.onSortListings, action: () => options.onSortListings?.() },
      { id: 'bulk-sync', label: t('publish.command.bulkSync', { defaultValue: 'Bulk Sync' }), icon: 'SyncOutlined', category: 'LISTING', column: 0, disabled: !options.onBulkSync, action: () => options.onBulkSync?.() },
      { id: 'translate', label: t('publish.command.translate', { defaultValue: 'Translate' }), icon: 'TranslateOutlined', category: 'GENERAL', column: 0, context: ['listing'], disabled: !options.onTranslate, action: () => options.onTranslate?.() },
      { id: 'bulk-tags', label: t('publish.command.bulkTags', { defaultValue: 'Bulk Tags' }), icon: 'LabelOutlined', category: 'GENERAL', column: 0, disabled: !options.onBulkTags, action: () => options.onBulkTags?.() },
      // Column 1: FILES + EXPORT + CLOUD
      { id: 'delete-files', label: t('publish.command.deleteFiles', { defaultValue: 'Delete Files' }), icon: 'DeleteOutline', category: 'FILES', column: 1, disabled: !options.onDeleteFiles, action: () => options.onDeleteFiles?.() },
      { id: 'download', label: t('publish.command.download', { defaultValue: 'Download' }), icon: 'FileDownloadOutlined', category: 'FILES', column: 1, disabled: !options.onDownload, action: () => options.onDownload?.() },
      { id: 'export-xlsx', label: t('publish.command.exportXlsx', { defaultValue: 'Export as XLSX' }), icon: 'TableChartOutlined', category: 'EXPORT', column: 1, disabled: !options.onExportXlsx, action: () => options.onExportXlsx?.() },
      { id: 'export-csv', label: t('publish.command.exportCsv', { defaultValue: 'Export as CSV' }), icon: 'DescriptionOutlined', category: 'EXPORT', column: 1, disabled: !options.onExportCsv, action: () => options.onExportCsv?.() },
      // Phase W3/W4 — FlyingUpload export entries (AC-98, AC-137). Three
      // distinct actions because template + format combinations drive the
      // backend contract (mba+xlsx / basic+xlsx / basic+csv). Each is gated
      // on `exportSelectionCount >= 1` (AC-99 / AC-139).
      {
        id: 'export-xlsx-mba',
        label: t('publish.export.action.xlsxMba', { defaultValue: 'Export as XLSX (MBA)' }),
        icon: 'TableChartOutlined',
        category: 'EXPORT',
        column: 1,
        disabled:
          !options.onExportXlsxMba ||
          (options.exportSelectionCount ?? 0) < 1,
        action: () => options.onExportXlsxMba?.(),
      },
      {
        id: 'export-xlsx-basic',
        label: t('publish.export.action.xlsxBasic', { defaultValue: 'Export as XLSX (Basic)' }),
        icon: 'TableChartOutlined',
        category: 'EXPORT',
        column: 1,
        disabled:
          !options.onExportXlsxBasic ||
          (options.exportSelectionCount ?? 0) < 1,
        action: () => options.onExportXlsxBasic?.(),
      },
      {
        id: 'export-csv-flyingupload',
        label: t('publish.export.action.csv', { defaultValue: 'Export as CSV' }),
        icon: 'DescriptionOutlined',
        category: 'EXPORT',
        column: 1,
        disabled:
          !options.onExportCsvFlyingUpload ||
          (options.exportSelectionCount ?? 0) < 1,
        action: () => options.onExportCsvFlyingUpload?.(),
      },
      { id: 'send-cloud', label: t('publish.command.sendCloud', { defaultValue: 'Send to Cloud' }), icon: 'CloudUploadOutlined', category: 'CLOUD', column: 1, disabled: !options.onSendToCloud, action: () => options.onSendToCloud?.() },
      { id: 'import-cloud', label: t('publish.command.importCloud', { defaultValue: 'Import from Cloud' }), icon: 'CloudDownloadOutlined', category: 'CLOUD', column: 1, disabled: !options.onImportCloud, action: () => options.onImportCloud?.() },
      // Column 2: TEMPLATES
      { id: 'apply-template', label: t('publish.command.applyTemplate', { defaultValue: 'Apply Template' }), icon: 'DashboardCustomizeOutlined', category: 'TEMPLATES', column: 2, disabled: !options.onApplyTemplate, action: () => options.onApplyTemplate?.() },
      { id: 'copy-listing-from', label: t('publish.command.copyListingFrom', { defaultValue: 'Copy Listing From...' }), icon: 'ContentCopyOutlined', category: 'TEMPLATES', column: 2, context: ['listing'], disabled: !options.onCopyListingFrom, action: () => options.onCopyListingFrom?.() },
      { id: 'copy-colors-from', label: t('publish.command.copyColorsFrom', { defaultValue: 'Copy Colors From...' }), icon: 'PaletteOutlined', category: 'TEMPLATES', column: 2, context: ['colors'], disabled: !options.onCopyColorsFrom, action: () => options.onCopyColorsFrom?.() },
      { id: 'copy-fit-from', label: t('publish.command.copyFitFrom', { defaultValue: 'Copy Fit Types From...' }), icon: 'StraightenOutlined', category: 'TEMPLATES', column: 2, context: ['fit_types'], disabled: !options.onCopyFitTypesFrom, action: () => options.onCopyFitTypesFrom?.() },
      { id: 'copy-prices-from', label: t('publish.command.copyPricesFrom', { defaultValue: 'Copy Prices From...' }), icon: 'AttachMoneyOutlined', category: 'TEMPLATES', column: 2, context: ['prices'], disabled: !options.onCopyPricesFrom, action: () => options.onCopyPricesFrom?.() },
      // Column 0: CONVERT — target marketplace = current tab. Disabled when
      // the active tab equals the source (nothing to convert from).
      {
        id: 'convert-from-global',
        label: t('publish.command.convertFromGlobal', { defaultValue: 'Convert from Global' }),
        icon: 'SwapHorizOutlined',
        category: 'CONVERT',
        column: 0,
        context: ['mba'],
        disabled:
          !options.onConvertFromGlobal ||
          options.activeMarketplace === 'global',
        action: () => options.onConvertFromGlobal?.(),
      },
      {
        id: 'convert-from-mba',
        label: t('publish.command.convertFromMba', { defaultValue: 'Convert from MBA' }),
        icon: 'SwapHorizOutlined',
        category: 'CONVERT',
        column: 0,
        context: ['global'],
        disabled:
          !options.onConvertFromMba ||
          options.activeMarketplace === 'mba',
        action: () => options.onConvertFromMba?.(),
      },
    ],
    [t, options],
  );

  // Filter by context when Options triggers
  const contextFiltered = useMemo(() => {
    if (!context) return actions;
    return actions.filter((a) => a.context?.includes(context));
  }, [actions, context]);

  // Search and match
  const matched: MatchedAction[] = useMemo(() => {
    if (!query) {
      return contextFiltered.map((a) => ({ ...a, highlightRanges: [] }));
    }
    const results: MatchedAction[] = [];
    for (const a of contextFiltered) {
      const labelMatch = fuzzyMatch(a.label, query);
      const catMatch = fuzzyMatch(a.category, query);
      if (labelMatch || catMatch) {
        results.push({ ...a, highlightRanges: labelMatch ?? [] });
      }
    }
    return results;
  }, [contextFiltered, query]);

  // Recently used (shown when query empty + no context)
  const recentActions: MatchedAction[] = useMemo(() => {
    if (query || context) return [];
    return recentIds
      .map((id) => actions.find((a) => a.id === id))
      .filter(Boolean)
      .map((a) => ({ ...a!, highlightRanges: [] }));
  }, [recentIds, query, context, actions]);

  // Flat list for keyboard nav
  const flatActions = useMemo(() => {
    return [...recentActions, ...matched];
  }, [recentActions, matched]);

  // Active index resets when query/context changes (derived from state key)
  const resetKey = `${query}|${context ?? ''}`;
  const activeIndex = activeState.key === resetKey ? activeState.index : 0;

  // Save recent
  const saveRecent = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((r) => r !== id)].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Execute action
  const executeAction = useCallback(
    (action: CommandActionDef) => {
      if (action.disabled) return;
      saveRecent(action.id);
      action.action();
      // Close after short delay for flash effect
      setTimeout(() => {
        setOpen(false);
        setQuery('');
        setContext(null);
      }, 150);
    },
    [saveRecent],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveState((prev) => ({ key: resetKey, index: Math.min((prev.key === resetKey ? prev.index : 0) + 1, flatActions.length - 1) }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveState((prev) => ({ key: resetKey, index: Math.max((prev.key === resetKey ? prev.index : 0) - 1, 0) }));
          break;
        case 'Enter':
          e.preventDefault();
          if (flatActions[activeIndex]) {
            executeAction(flatActions[activeIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setOpen(false);
          setQuery('');
          setContext(null);
          break;
      }
    },
    [flatActions, activeIndex, executeAction, resetKey],
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
        setQuery('');
        setContext(null);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Open with optional context. Fine-grained SectionHeader contexts are
  // normalized to the coarse action-context taxonomy (listing / colors /
  // fit_types / prices) so that D7 Options ⊙ clicks pre-filter the palette.
  const openPalette = useCallback((ctx?: string) => {
    setContext(normalizeContext(ctx));
    setOpen(true);
    setQuery('');
    setActiveState({ index: 0, key: '' });
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setContext(null);
  }, []);

  return useMemo(
    () => ({
      open,
      query,
      setQuery,
      context,
      activeIndex,
      matched,
      recentActions,
      flatActions,
      handleKeyDown,
      executeAction,
      openPalette,
      closePalette,
    }),
    [open, query, context, activeIndex, matched, recentActions, flatActions, handleKeyDown, executeAction, openPalette, closePalette],
  );
};
