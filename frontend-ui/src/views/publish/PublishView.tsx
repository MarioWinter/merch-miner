import { useState, useCallback, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useDeleteDesignMutation,
  useDuplicateDesignMutation,
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
import ActionBar from './partials/ActionBar';
import CloudStorageTab from './partials/cloud/CloudStorageTab';
import SendToCloudDialog from './partials/cloud/SendToCloudDialog';
import MovePickerDialog from './partials/grid/MovePickerDialog';
import type { CloudProvider } from './partials/cloud/ProviderSwitcher';
import EmptyState from './partials/EmptyState';
import type { FileSystemTab, ViewMode, BreadcrumbSegment, GalleryListParams } from './types';

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PublishView = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
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
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('google_drive');
  const [, setCurrentCollection] = useState<string | null>(null);
  const [tagEditorDesignId, setTagEditorDesignId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);

  // Selection
  const orderedIds = useMemo(() => designs.map((d) => d.id), [designs]);
  const selection = useDesignSelection({ orderedIds });

  // Breadcrumbs
  const breadcrumbs: BreadcrumbSegment[] = useMemo(() => {
    const segments: BreadcrumbSegment[] = [{ id: null, label: 'Home' }];
    // For now, just show root. When navigating collections, extend this.
    return segments;
  }, []);

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

  // Command palette
  const cmdPalette = useCommandPalette({
    onEditBulk: navigateToEdit,
    onDeleteListings: selection.clearSelection,
    onMoveToCollection: () => setCollectionsOpen(true),
    onDuplicate: () => {},
    onTranslate: () => {},
    onBulkTags: () => {},
    onAiGenerate: () => {},
    onDeleteFiles: () => {},
    onDownload: () => {},
    onExportXlsx: () => {},
    onExportCsv: () => {},
    onSendToCloud: () => setSendToCloudOpen(true),
    onImportCloud: () => setActiveTab('cloud_storage'),
    onApplyTemplate: () => {},
    onCopyListingFrom: () => {},
    onCopyColorsFrom: () => {},
    onCopyFitTypesFrom: () => {},
    onCopyPricesFrom: () => {},
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
        onTemplateClick={() => {}}
        onUploadClick={handleUploadClick}
        onPublishClick={() => {}}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        multiple
        hidden
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

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
        onDelete={() => {}}
      />
    </ViewRoot>
  );
};

export default PublishView;
