import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Button,
  Drawer,
  IconButton,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import TuneIcon from '@mui/icons-material/Tune';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  useDeleteDesignMutation,
  useDuplicateDesignMutation,
  useListCollectionsQuery,
  useListGalleryQuery,
  useUpdateDesignMutation,
  useUploadDesignMutation,
} from '@/store/publishSlice';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useDesignSelection } from './hooks/useDesignSelection';
import { useCommandPalette } from './hooks/useCommandPalette';
import PublishToolbar from './partials/toolbar/PublishToolbar';
import DesignCardGrid from './partials/grid/DesignCardGrid';
import CollectionsDialog from './partials/collections/CollectionsDialog';
import CommandPalette from './partials/command/CommandPalette';
import ExportPreflightDialog from './partials/export/ExportPreflightDialog';
import ExportHistoryDrawer from './partials/export/ExportHistoryDrawer';
import ActionBar from './partials/ActionBar';
import CloudStorageTab from './partials/cloud/CloudStorageTab';
import SendToCloudDialog from './partials/cloud/SendToCloudDialog';
import MovePickerDialog from './partials/grid/MovePickerDialog';
import TemplateLibraryDialog from './partials/toolbar/TemplateLibraryDialog';
import type { CloudProvider } from './partials/cloud/ProviderSwitcher';
import EmptyState from './partials/EmptyState';
import type {
  FileSystemTab,
  ViewMode,
  BreadcrumbSegment,
  GalleryListParams,
  FlyingUploadTemplate,
  FlyingUploadFormat,
} from './types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ViewRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  position: 'relative',
});

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  padding: theme.spacing(3),
  overflowY: 'auto',
}));

// PROJ-30 T3.15 — sticky "Filters" trigger only rendered on `<md` so the
// search + sort controls remain reachable when the desktop toolbar wraps.
const MobileFilterBar = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 2),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: theme.vars.palette.background.paper,
}));

const FilterDrawerBody = styled(Stack)(({ theme }) => ({
  width: 320,
  maxWidth: '100vw',
  padding: theme.spacing(2),
  gap: theme.spacing(2),
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PublishView = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const { isDesktop } = useResponsiveLayout();
  const [uploadDesign] = useUploadDesignMutation();
  const [updateDesign] = useUpdateDesignMutation();
  const [deleteDesign] = useDeleteDesignMutation();
  const [duplicateDesign] = useDuplicateDesignMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gallery query params
  const [galleryParams, setGalleryParams] = useState<GalleryListParams>({
    page: 1,
    page_size: 24,
    sort_by: 'newest',
  });
  const { data: galleryData, isLoading: isGalleryLoading } = useListGalleryQuery(galleryParams);
  const designs = useMemo(() => galleryData?.results ?? [], [galleryData]);
  const totalCount = galleryData?.count ?? 0;

  // UI state
  const [activeTab, setActiveTab] = useState<FileSystemTab>('my_designs');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [sendToCloudOpen, setSendToCloudOpen] = useState(false);
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [publishMenuAnchor, setPublishMenuAnchor] = useState<HTMLElement | null>(null);
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('google_drive');
  const [currentCollection, setCurrentCollection] = useState<string | null>(null);
  const [tagEditorDesignId, setTagEditorDesignId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  // PROJ-30 T3.15 — mobile filters drawer.
  const [filtersDrawerOpen, setFiltersDrawerOpen] = useState(false);

  // Phase W3/W5 — FlyingUpload export state. `exportRequest` is null when
  // the preflight dialog is closed; setting it opens the dialog with the
  // matching template+format pair. `historyOpen` gates the right drawer.
  const [exportRequest, setExportRequest] = useState<{
    template: FlyingUploadTemplate;
    format: FlyingUploadFormat;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Selection
  const orderedIds = useMemo(() => designs.map((d) => d.id), [designs]);
  const selection = useDesignSelection({ orderedIds });

  // Breadcrumbs — walk the collection tree from `currentCollection` up to
  // root so the toolbar mirrors the active folder the gallery is filtered by.
  const { data: allCollections } = useListCollectionsQuery();
  const breadcrumbs: BreadcrumbSegment[] = useMemo(() => {
    const segments: BreadcrumbSegment[] = [{ id: null, label: 'Home' }];
    if (!currentCollection || !allCollections) return segments;
    const byId = new Map(allCollections.map((c) => [c.id, c]));
    const chain: BreadcrumbSegment[] = [];
    let cursor: string | null | undefined = currentCollection;
    // Guard against cycles in malformed data.
    const seen = new Set<string>();
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      seen.add(cursor);
      const node = byId.get(cursor);
      if (!node) break;
      chain.unshift({ id: node.id, label: node.name });
      cursor = node.parent ?? null;
    }
    return [...segments, ...chain];
  }, [currentCollection, allCollections]);

  // Search filter
  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    setGalleryParams((prev) => ({ ...prev, search: q || undefined, page: 1 }));
  }, []);

  // Collection filter
  const handleBreadcrumbNavigate = useCallback((collectionId: string | null) => {
    setCurrentCollection(collectionId);
    setGalleryParams((prev) => ({
      ...prev,
      collection: collectionId ?? undefined,
      page: 1,
    }));
  }, []);

  // Collection dialog result
  const handleCollectionOpen = useCallback((collectionId: string | null) => {
    setCollectionsOpen(false);
    handleBreadcrumbNavigate(collectionId);
  }, [handleBreadcrumbNavigate]);

  // Navigate to edit page with selected design IDs in query string
  const navigateToEdit = useCallback(() => {
    const selectedIds = Array.from(selection.selectedIds);
    if (selectedIds.length === 0) {
      navigate('/publish/edit');
      return;
    }
    navigate(`/publish/edit?designs=${selectedIds.join(',')}`);
  }, [navigate, selection.selectedIds]);

  // ---- Per-card quick actions (PROJ-11 H2 + H3) -------------------------
  const handleEditSingle = useCallback(
    (id: string) => {
      navigate(`/publish/edit?designs=${id}`);
    },
    [navigate],
  );

  const handleAddTagsSingle = useCallback((id: string) => {
    setTagEditorDesignId(id);
  }, []);

  const handleDeleteSingle = useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await deleteDesign(deleteTargetId).unwrap();
      enqueueSnackbar(
        t('publish.card.delete.success', { defaultValue: 'Design deleted' }),
        { variant: 'success' },
      );
      setDeleteTargetId(null);
    } catch {
      enqueueSnackbar(
        t('publish.card.delete.error', { defaultValue: 'Failed to delete design' }),
        { variant: 'error' },
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deleteDesign, deleteTargetId, enqueueSnackbar, t]);

  const handleTagsCommit = useCallback(
    async (id: string, tags: string[]) => {
      setTagEditorDesignId(null);
      try {
        await updateDesign({ id, body: { tags } }).unwrap();
      } catch {
        enqueueSnackbar(
          t('publish.card.tagEditor.error', { defaultValue: 'Failed to update tags' }),
          { variant: 'error' },
        );
      }
    },
    [updateDesign, enqueueSnackbar, t],
  );

  const handleTagsCancel = useCallback(() => {
    setTagEditorDesignId(null);
  }, []);

  // H6: duplicate mutation wiring. Backend returns the new asset; we only
  // need to surface a snackbar — RTK cache invalidation re-fetches the grid.
  // EC-27: a 404 means the source vanished between render and click (another
  // tab deleted it); show a distinct message so the user knows to refresh.
  const handleDuplicate = useCallback(
    async (id: string) => {
      try {
        await duplicateDesign(id).unwrap();
        enqueueSnackbar(
          t('publish.card.duplicate.success', { defaultValue: 'Design duplicated' }),
          { variant: 'success' },
        );
      } catch (err) {
        const status = (err as { status?: number } | undefined)?.status;
        const message =
          status === 404
            ? t('publish.card.duplicate.error404', {
                defaultValue: 'Design no longer exists',
              })
            : t('publish.card.duplicate.error', {
                defaultValue: 'Failed to duplicate design',
              });
        enqueueSnackbar(message, { variant: 'error' });
      }
    },
    [duplicateDesign, enqueueSnackbar, t],
  );

  // H7: MovePickerDialog integration — resolves the target asset's current
  // collection so the picker can disable it in the tree.
  const moveTargetAsset = useMemo(
    () => (moveTargetId ? designs.find((d) => d.id === moveTargetId) ?? null : null),
    [moveTargetId, designs],
  );
  const handleMoveClose = useCallback(() => setMoveTargetId(null), []);
  const handleMoveComplete = useCallback(() => setMoveTargetId(null), []);

  // Bulk "Delete Files" — opens MUI ConfirmDialog; on confirm loops
  // DELETE /api/designs/gallery/{id}/ over the captured selection. Kept
  // client-side-looped for MVP; a bulk endpoint would be a minor backend
  // optimization, not a correctness upgrade.
  const [bulkDeletePending, setBulkDeletePending] = useState<string[] | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const handleBulkDeleteFiles = useCallback(() => {
    const ids = Array.from(selection.selectedIds);
    if (ids.length === 0) {
      enqueueSnackbar(
        t('publish.command.selectFirst', {
          defaultValue: 'Select at least one design first',
        }),
        { variant: 'warning' },
      );
      return;
    }
    setBulkDeletePending(ids);
  }, [selection.selectedIds, enqueueSnackbar, t]);

  const handleConfirmBulkDelete = useCallback(async () => {
    const ids = bulkDeletePending;
    if (!ids) return;
    setIsBulkDeleting(true);
    let successes = 0;
    let failures = 0;
    for (const id of ids) {
      try {
        await deleteDesign(id).unwrap();
        successes += 1;
      } catch {
        failures += 1;
      }
    }
    setIsBulkDeleting(false);
    setBulkDeletePending(null);
    selection.handleSelectNone();
    if (successes > 0) {
      enqueueSnackbar(
        t('publish.command.deleteFilesSuccess', {
          defaultValue: '{{count}} design(s) deleted',
          count: successes,
        }),
        { variant: 'success' },
      );
    }
    if (failures > 0) {
      enqueueSnackbar(
        t('publish.command.deleteFilesError', {
          defaultValue: '{{count}} delete(s) failed',
          count: failures,
        }),
        { variant: 'error' },
      );
    }
  }, [bulkDeletePending, deleteDesign, selection, enqueueSnackbar, t]);

  // Bulk "Download" — trigger browser download for each selected asset's
  // underlying file via an `<a download>` anchor. Sequential + throttled so
  // the browser doesn't nuke the download queue.
  const handleBulkDownload = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    if (ids.length === 0) {
      enqueueSnackbar(
        t('publish.command.selectFirst', {
          defaultValue: 'Select at least one design first',
        }),
        { variant: 'warning' },
      );
      return;
    }
    const targets = designs.filter((d) => ids.includes(d.id));
    for (const design of targets) {
      if (!design.file_url) continue;
      const a = document.createElement('a');
      a.href = design.file_url;
      a.download = design.file_name || 'design';
      a.rel = 'noopener';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Small gap so Chrome/FF don't swallow parallel clicks.
      await new Promise((r) => setTimeout(r, 80));
    }
    enqueueSnackbar(
      t('publish.command.downloadSuccess', {
        defaultValue: '{{count}} download(s) started',
        count: targets.length,
      }),
      { variant: 'success' },
    );
  }, [selection.selectedIds, designs, enqueueSnackbar, t]);

  // Phase W3 — open the ExportPreflightDialog with a template+format pair.
  // Gated on `selectionCount >= 1` inside useCommandPalette via
  // `exportSelectionCount`; this handler is a no-op guard only.
  const openExport = useCallback(
    (template: FlyingUploadTemplate, format: FlyingUploadFormat) => {
      if (selection.selectionCount < 1) return;
      setExportRequest({ template, format });
    },
    [selection.selectionCount],
  );

  // Command palette — pass only handlers that actually do something.
  // Undefined handlers flag the action as "coming soon" in useCommandPalette
  // (disabled + label suffix) so clicking doesn't silently no-op.
  const cmdPalette = useCommandPalette({
    onEditBulk: navigateToEdit,
    onMoveToCollection: () => setCollectionsOpen(true),
    onSendToCloud: () => setSendToCloudOpen(true),
    onImportCloud: () => setActiveTab('cloud_storage'),
    onDeleteFiles: handleBulkDeleteFiles,
    onDownload: handleBulkDownload,
    // Phase W3 — 3 FlyingUpload export actions, gated on selection size.
    onExportXlsxMba: () => openExport('mba', 'xlsx'),
    onExportXlsxBasic: () => openExport('basic', 'xlsx'),
    onExportCsvFlyingUpload: () => openExport('basic', 'csv'),
    exportSelectionCount: selection.selectionCount,
    // The following actions are still not wired (need dedicated backend
    // endpoints or dialog UX) — leaving them undefined keeps the palette
    // honest: they render disabled, don't fire no-ops.
  });

  // Container ref for lasso
  const containerRef = useRef<HTMLDivElement>(null);

  // File upload handler — open native file picker, upload each selected file
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      let successes = 0;
      let failures = 0;
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        try {
          await uploadDesign(form).unwrap();
          successes += 1;
        } catch {
          failures += 1;
        }
      }
      if (successes > 0) {
        enqueueSnackbar(
          t('publish.toolbar.uploadSuccess', {
            defaultValue: '{{count}} design(s) uploaded',
            count: successes,
          }),
          { variant: 'success' },
        );
      }
      if (failures > 0) {
        enqueueSnackbar(
          t('publish.toolbar.uploadError', {
            defaultValue: '{{count}} upload(s) failed',
            count: failures,
          }),
          { variant: 'error' },
        );
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [uploadDesign, enqueueSnackbar, t],
  );

  return (
    <ViewRoot>
      {/* Sticky Toolbar */}
      <PublishToolbar
        selectedCount={selection.selectionCount}
        totalCount={totalCount}
        hasSelection={selection.hasSelection}
        onSelectAll={selection.handleSelectAll}
        onSelectNone={selection.handleSelectNone}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        breadcrumbs={breadcrumbs}
        onBreadcrumbNavigate={handleBreadcrumbNavigate}
        transferCount={selection.hasSelection ? selection.selectionCount : 0}
        onTransferClick={() => {}}
        onCollectionsOpen={() => setCollectionsOpen(true)}
        onCommandPaletteOpen={() => cmdPalette.openPalette()}
        onTemplateClick={() => setTemplateLibraryOpen(true)}
        onUploadClick={handleUploadClick}
        onPublishClick={(e) => setPublishMenuAnchor(e.currentTarget)}
        onHistoryClick={() => setHistoryOpen(true)}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        multiple
        hidden
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* PROJ-30 T3.15 — mobile-only filters trigger. Lives above the
          gallery so the user can reach the search/sort controls without
          horizontally scrolling the desktop toolbar. */}
      {!isDesktop && (
        <MobileFilterBar>
          <Typography variant="body2" color="text.secondary">
            {searchQuery
              ? t('responsive.publishView.searchLabel') + `: "${searchQuery}"`
              : t('responsive.publishView.filtersDrawerTitle')}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TuneIcon sx={{ fontSize: 18 }} />}
            onClick={() => setFiltersDrawerOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={filtersDrawerOpen}
          >
            {t('responsive.publishView.filtersButton')}
          </Button>
        </MobileFilterBar>
      )}

      {/* Content */}
      <ContentArea ref={containerRef}>
        {activeTab === 'my_designs' ? (
          isGalleryLoading ? (
            <DesignCardGrid
              designs={[]}
              viewMode={viewMode}
              isLoading
              isSelected={() => false}
              hasSelection={false}
              onSelect={() => {}}
              onLassoSelect={() => {}}
              onAddDesigns={handleUploadClick}
            />
          ) : designs.length === 0 && !searchQuery ? (
            <EmptyState
              onUpload={handleUploadClick}
              onImport={() => setActiveTab('cloud_storage')}
            />
          ) : (
            <DesignCardGrid
              designs={designs}
              viewMode={viewMode}
              isLoading={false}
              isSelected={selection.isSelected}
              hasSelection={selection.hasSelection}
              onSelect={selection.handleClick}
              onLassoSelect={selection.addIds}
              onAddDesigns={handleUploadClick}
              onDuplicate={handleDuplicate}
              onMove={setMoveTargetId}
              onEditSingle={handleEditSingle}
              onAddTags={handleAddTagsSingle}
              onDeleteSingle={handleDeleteSingle}
              tagEditorDesignId={tagEditorDesignId}
              onTagsCommit={handleTagsCommit}
              onTagsCancel={handleTagsCancel}
            />
          )
        ) : (
          <CloudStorageTab
            activeProvider={cloudProvider}
            onProviderChange={setCloudProvider}
            onManageConnections={() => {}}
          />
        )}
      </ContentArea>

      {/* Collections Dialog */}
      <CollectionsDialog
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        onOpenFolder={handleCollectionOpen}
      />

      {/* Move Picker Dialog (H7) */}
      <MovePickerDialog
        open={moveTargetId !== null}
        assetId={moveTargetId}
        currentCollectionId={moveTargetAsset?.collection ?? null}
        onClose={handleMoveClose}
        onMoved={handleMoveComplete}
      />

      {/* Send to Cloud Dialog */}
      <SendToCloudDialog
        open={sendToCloudOpen}
        onClose={() => setSendToCloudOpen(false)}
        provider={cloudProvider}
        selectedDesigns={designs.filter((d) => selection.isSelected(d.id))}
      />

      {/* Mount dialogs only when open so their RTK Query hooks don't fire
          (or count as test warnings) while the dialog is closed. */}
      {templateLibraryOpen && (
        <TemplateLibraryDialog
          open
          onClose={() => setTemplateLibraryOpen(false)}
        />
      )}

      <Menu
        anchorEl={publishMenuAnchor}
        open={Boolean(publishMenuAnchor)}
        onClose={() => setPublishMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <ListSubheader sx={{ lineHeight: '32px', fontWeight: 600 }}>
          {t('publish.export.section.flyingUpload', { defaultValue: 'Flying Upload' })}
        </ListSubheader>
        <MenuItem onClick={() => { setPublishMenuAnchor(null); openExport('mba', 'xlsx'); }}>
          {t('publish.export.action.xlsxMba', { defaultValue: 'Export as XLSX (MBA)' })}
        </MenuItem>
        <MenuItem onClick={() => { setPublishMenuAnchor(null); openExport('basic', 'xlsx'); }}>
          {t('publish.export.action.xlsxBasic', { defaultValue: 'Export as XLSX (Basic)' })}
        </MenuItem>
        <MenuItem onClick={() => { setPublishMenuAnchor(null); openExport('basic', 'csv'); }}>
          {t('publish.export.action.csv', { defaultValue: 'Export as CSV' })}
        </MenuItem>
      </Menu>

      {/* Command Palette Overlay */}
      <CommandPalette
        open={cmdPalette.open}
        query={cmdPalette.query}
        onQueryChange={cmdPalette.setQuery}
        context={cmdPalette.context}
        activeIndex={cmdPalette.activeIndex}
        matched={cmdPalette.matched}
        recentActions={cmdPalette.recentActions}
        flatActions={cmdPalette.flatActions}
        onKeyDown={cmdPalette.handleKeyDown}
        onExecute={cmdPalette.executeAction}
        onClose={cmdPalette.closePalette}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTargetId !== null}
        title={t('publish.card.delete.title', { defaultValue: 'Delete design?' })}
        body={t('publish.card.delete.body', {
          defaultValue: 'This will permanently remove the design from your gallery.',
        })}
        confirmLabel={t('publish.card.delete.confirm', { defaultValue: 'Delete' })}
        cancelLabel={t('common.cancel', { defaultValue: 'Cancel' })}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTargetId(null)}
        isLoading={isDeleting}
      />

      {/* Bottom Action Bar */}
      <ActionBar
        selectionCount={selection.selectionCount}
        allSelected={selection.selectionCount === totalCount && totalCount > 0}
        onEdit={navigateToEdit}
        onToggleAll={selection.toggleAll}
        onHistory={() => {}}
        onBatchUpload={() => {}}
        onDelete={handleBulkDeleteFiles}
      />

      <ConfirmDialog
        open={bulkDeletePending !== null}
        title={t('publish.command.deleteFilesTitle', { defaultValue: 'Delete Designs' })}
        body={t('publish.command.deleteFilesConfirm', {
          defaultValue: 'Delete {{count}} design(s)? This cannot be undone.',
          count: bulkDeletePending?.length ?? 0,
        })}
        confirmLabel={t('publish.command.deleteFiles', { defaultValue: 'Delete Files' })}
        cancelLabel={t('common.cancel', { defaultValue: 'Cancel' })}
        onConfirm={() => { void handleConfirmBulkDelete(); }}
        onCancel={() => setBulkDeletePending(null)}
        isLoading={isBulkDeleting}
      />

      {/* Phase W3 — Export preflight dialog (mount-on-open) */}
      {exportRequest && (
        <ExportPreflightDialog
          open
          template={exportRequest.template}
          format={exportRequest.format}
          designIds={Array.from(selection.selectedIds)}
          onClose={() => setExportRequest(null)}
        />
      )}

      {/* Phase W5 — Export history drawer (RTK query skip guarded by `open`) */}
      <ExportHistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      {/* PROJ-30 T3.15 — mobile Filters drawer with the same search +
          sort controls available in the desktop toolbar. */}
      <Drawer
        anchor="right"
        open={filtersDrawerOpen}
        onClose={() => setFiltersDrawerOpen(false)}
        slotProps={{
          paper: {
            'aria-label': t('responsive.publishView.filtersDrawerTitle'),
          },
        }}
      >
        <FilterDrawerBody>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {t('responsive.publishView.filtersDrawerTitle')}
            </Typography>
            <IconButton
              size="small"
              onClick={() => setFiltersDrawerOpen(false)}
              aria-label={t('responsive.publishView.filtersClose')}
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Stack>

          <TextField
            size="small"
            fullWidth
            label={t('responsive.publishView.searchLabel')}
            placeholder={t('responsive.publishView.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />

          <TextField
            select
            size="small"
            fullWidth
            label={t('responsive.publishView.sortLabel')}
            value={galleryParams.sort_by ?? 'newest'}
            onChange={(e) =>
              setGalleryParams((prev) => ({
                ...prev,
                sort_by: e.target.value as GalleryListParams['sort_by'],
              }))
            }
          >
            <MenuItem value="newest">
              {t('responsive.publishView.sortNewest')}
            </MenuItem>
            <MenuItem value="recently_edited">
              {t('responsive.publishView.sortRecentlyEdited')}
            </MenuItem>
          </TextField>

          <Button
            variant="text"
            onClick={() => setFiltersDrawerOpen(false)}
            sx={{ alignSelf: 'flex-end' }}
          >
            {t('responsive.publishView.filtersClose')}
          </Button>
        </FilterDrawerBody>
      </Drawer>
    </ViewRoot>
  );
};

export default PublishView;
