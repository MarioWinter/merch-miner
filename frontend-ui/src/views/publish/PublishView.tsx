import { useState, useCallback, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useListGalleryQuery } from '@/store/publishSlice';
import { useDesignSelection } from './hooks/useDesignSelection';
import { useCommandPalette } from './hooks/useCommandPalette';
import PublishToolbar from './partials/toolbar/PublishToolbar';
import DesignCardGrid from './partials/grid/DesignCardGrid';
import CollectionsDialog from './partials/collections/CollectionsDialog';
import CommandPalette from './partials/command/CommandPalette';
import ActionBar from './partials/ActionBar';
import CloudStorageTab from './partials/cloud/CloudStorageTab';
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
  const [, setCurrentCollection] = useState<string | null>(null);

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

  // Command palette
  const cmdPalette = useCommandPalette({
    onEditBulk: () => navigate('/publish/edit'),
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
    onSendToCloud: () => {},
    onImportCloud: () => setActiveTab('cloud_storage'),
    onApplyTemplate: () => {},
    onCopyListingFrom: () => {},
    onCopyColorsFrom: () => {},
    onCopyFitTypesFrom: () => {},
    onCopyPricesFrom: () => {},
  });

  // Container ref for lasso
  const containerRef = useRef<HTMLDivElement>(null);

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
        onUploadClick={() => {}}
        onPublishClick={() => {}}
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
              onAddDesigns={() => {}}
            />
          ) : designs.length === 0 && !searchQuery ? (
            <EmptyState
              onUpload={() => {}}
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
              onAddDesigns={() => {}}
              onDuplicate={() => {}}
              onMove={() => setCollectionsOpen(true)}
            />
          )
        ) : (
          <CloudStorageTab
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

      {/* Bottom Action Bar */}
      <ActionBar
        selectionCount={selection.selectionCount}
        allSelected={selection.selectionCount === totalCount && totalCount > 0}
        onEdit={() => navigate('/publish/edit')}
        onToggleAll={selection.toggleAll}
        onHistory={() => {}}
        onBatchUpload={() => {}}
        onDelete={() => {}}
      />
    </ViewRoot>
  );
};

export default PublishView;
