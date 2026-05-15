import { useRef, useCallback } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useLassoSelect } from '../../hooks/useLassoSelect';
import type { DesignAsset, ViewMode } from '../../types';
import DesignCard from './DesignCard';
import DesignListRow from './DesignListRow';
import AddDesignsCard from './AddDesignsCard';
import LassoOverlay from './LassoOverlay';

interface DesignCardGridProps {
  designs: DesignAsset[];
  viewMode: ViewMode;
  isLoading: boolean;
  isSelected: (id: string) => boolean;
  hasSelection: boolean;
  onSelect: (id: string, shiftKey: boolean) => void;
  onLassoSelect: (ids: string[]) => void;
  onAddDesigns: () => void;
  onDuplicate?: (id: string) => void;
  onMove?: (id: string) => void;
  totalSize?: string;
  storageLimit?: string;
  onEditSingle?: (id: string) => void;
  onAddTags?: (id: string) => void;
  onDeleteSingle?: (id: string) => void;
  tagEditorDesignId?: string | null;
  onTagsCommit?: (id: string, tags: string[]) => void;
  onTagsCancel?: (id: string) => void;
}

const GridContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  // PROJ-30 T3.15 — tighter `minmax` on `<sm` so phones fit 2 cards/row,
  // standard `240px` minimum on `≥sm`.
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  },
  gap: theme.spacing(2.5),
  position: 'relative',
  userSelect: 'none',
}));

const ListContainer = styled(Box)({
  position: 'relative',
});

const StorageIndicator = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2),
  textAlign: 'center',
}));

const EmptyContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8, 0),
  gap: theme.spacing(1),
}));

const DesignCardGrid = ({
  designs,
  viewMode,
  isLoading,
  isSelected,
  hasSelection,
  onSelect,
  onLassoSelect,
  onAddDesigns,
  onDuplicate,
  onMove,
  totalSize,
  storageLimit,
  onEditSingle,
  onAddTags,
  onDeleteSingle,
  tagEditorDesignId,
  onTagsCommit,
  onTagsCancel,
}: DesignCardGridProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLassoSelect = useCallback(
    (ids: string[]) => {
      onLassoSelect(ids);
    },
    [onLassoSelect],
  );

  const { lassoRect, handleMouseDown } = useLassoSelect({
    containerRef,
    onSelect: handleLassoSelect,
    enabled: viewMode === 'grid',
  });

  // Loading skeleton
  if (isLoading) {
    return (
      <GridContainer>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            sx={{
              aspectRatio: '1 / 1',
              borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 1.5}px`,
            }}
          />
        ))}
      </GridContainer>
    );
  }

  // Empty state
  if (designs.length === 0) {
    return (
      <EmptyContainer>
        <Typography variant="h5" color="text.secondary">
          {t('publish.grid.emptyTitle', { defaultValue: 'No designs yet' })}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {t('publish.grid.emptyDescription', { defaultValue: 'Upload or import designs to get started.' })}
        </Typography>
        <AddDesignsCard onClick={onAddDesigns} />
      </EmptyContainer>
    );
  }

  // List view
  if (viewMode === 'list') {
    return (
      <ListContainer ref={containerRef}>
        {designs.map((design) => (
          <DesignListRow
            key={design.id}
            design={design}
            isSelected={isSelected(design.id)}
            onSelect={onSelect}
          />
        ))}
        {totalSize && storageLimit && (
          <StorageIndicator variant="caption" color="text.disabled">
            {t('publish.grid.storage', {
              defaultValue: '{{count}} Designs \u00B7 {{size}} of {{limit}}',
              count: designs.length,
              size: totalSize,
              limit: storageLimit,
            })}
          </StorageIndicator>
        )}
      </ListContainer>
    );
  }

  // Grid view
  return (
    <Box ref={containerRef} sx={{ position: 'relative' }} onMouseDown={handleMouseDown}>
      <GridContainer>
        {designs.map((design, idx) => (
          <DesignCard
            key={design.id}
            design={design}
            isSelected={isSelected(design.id)}
            anySelected={hasSelection}
            onSelect={onSelect}
            onDuplicate={onDuplicate}
            onMove={onMove}
            index={idx}
            onEditSingle={onEditSingle}
            onAddTags={onAddTags}
            onDeleteSingle={onDeleteSingle}
            isEditingTags={tagEditorDesignId === design.id}
            onTagsCommit={onTagsCommit}
            onTagsCancel={onTagsCancel}
          />
        ))}
        <AddDesignsCard onClick={onAddDesigns} />
      </GridContainer>
      <LassoOverlay rect={lassoRect} />
      {totalSize && storageLimit && (
        <StorageIndicator variant="caption" color="text.disabled">
          {t('publish.grid.storage', {
            defaultValue: '{{count}} Designs \u00B7 {{size}} of {{limit}}',
            count: designs.length,
            size: totalSize,
            limit: storageLimit,
          })}
        </StorageIndicator>
      )}
    </Box>
  );
};

export default DesignCardGrid;
