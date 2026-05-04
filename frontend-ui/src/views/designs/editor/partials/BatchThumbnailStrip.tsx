import { useRef, useEffect } from 'react';
import { Box, Tooltip, IconButton, Typography, Checkbox } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import DeselectIcon from '@mui/icons-material/Deselect';
import type { BatchImage } from '../types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const StripRoot = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
});

const ThumbnailList = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: 1,
  overflowX: 'auto',
  overflowY: 'hidden',
  height: '100%',
  padding: '8px 12px',
  scrollbarWidth: 'thin',
  '&::-webkit-scrollbar': { height: 4 },
});

const Thumbnail = styled(Box, {
  shouldForwardProp: (p) => p !== '$active' && p !== '$status' && p !== '$selected',
})<{ $active: boolean; $status: BatchImage['status']; $selected: boolean }>(
  ({ theme, $active, $status, $selected }) => {
    const statusColor = {
      idle: theme.vars.palette.text.disabled,
      processing: theme.vars.palette.info.main,
      completed: theme.vars.palette.success.main,
      error: theme.vars.palette.error.main,
    }[$status];

    const getBorderColor = () => {
      if ($selected) return theme.vars.palette.secondary.main;
      if ($active) return theme.vars.palette.primary.main;
      return 'transparent';
    };

    return {
      width: 56,
      height: 56,
      flexShrink: 0,
      borderRadius: 6,
      overflow: 'hidden',
      cursor: 'pointer',
      position: 'relative',
      border: `2px solid ${getBorderColor()}`,
      outline: 'none',
      transition: 'border-color 150ms ease',
      '&:hover': {
        borderColor: $selected
          ? theme.vars.palette.secondary.main
          : $active
            ? theme.vars.palette.primary.main
            : theme.vars.palette.text.secondary,
      },
      '&:hover .thumb-checkbox': {
        opacity: 1,
      },
      '&::after': {
        content: '""',
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: statusColor,
      },
      '& img': {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
      },
    };
  },
);

const CheckboxOverlay = styled(Box)({
  position: 'absolute',
  top: 2,
  left: 2,
  zIndex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: '50%',
});

const AddMoreButton = styled(Box)(({ theme }) => ({
  width: 56,
  height: 56,
  flexShrink: 0,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: '2px dashed',
  borderColor: theme.vars.palette.divider,
  color: theme.vars.palette.text.secondary,
  transition: 'border-color 150ms ease, color 150ms ease',
  '&:hover': {
    borderColor: theme.vars.palette.secondary.main,
    color: theme.vars.palette.secondary.main,
  },
}));

const NavSection = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
  paddingLeft: 8,
});

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface BatchThumbnailStripProps {
  images: BatchImage[];
  currentIndex: number;
  onSelect: (index: number) => void;
  /** Callback to open file picker for adding more images */
  onAddMore?: () => void;
  /** Callback to open Cloud Storage Manager dialog */
  onOpenCloudManager?: () => void;
  /** Multi-select: set of selected image IDs */
  selectedIds?: Set<string>;
  /** Multi-select: toggle single image selection */
  onToggleSelect?: (id: string, index: number) => void;
  /** Multi-select: shift-click range select */
  onShiftSelect?: (index: number) => void;
  /** Multi-select: select all images */
  onSelectAll?: () => void;
  /** Multi-select: deselect all images */
  onDeselectAll?: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const BatchThumbnailStrip = ({
  images,
  currentIndex,
  onSelect,
  onAddMore,
  onOpenCloudManager,
  selectedIds,
  onToggleSelect,
  onShiftSelect,
  onSelectAll,
  onDeselectAll,
}: BatchThumbnailStripProps) => {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLDivElement>(null);

  const hasMultiSelect = !!(selectedIds && onToggleSelect);
  const allSelected = hasMultiSelect && images.length > 0 && images.every((img) => selectedIds!.has(img.id));

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentIndex]);

  return (
    <StripRoot>
      {/* Select all / deselect toggle */}
      {hasMultiSelect && images.length > 1 && (
        <Tooltip
          title={allSelected
            ? t('design.editor.deselectAll', 'Deselect All')
            : t('design.editor.selectAll', 'Select All')}
          placement="top"
        >
          <IconButton
            size="small"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            aria-label={allSelected
              ? t('design.editor.deselectAll', 'Deselect All')
              : t('design.editor.selectAll', 'Select All')}
            sx={{ ml: 1, flexShrink: 0 }}
          >
            {allSelected
              ? <DeselectIcon sx={{ fontSize: 20 }} />
              : <SelectAllIcon sx={{ fontSize: 20 }} />}
          </IconButton>
        </Tooltip>
      )}

      {/* Navigation arrows + counter */}
      {images.length > 1 && (
        <NavSection>
          <IconButton
            size="small"
            onClick={() => onSelect(currentIndex - 1)}
            disabled={currentIndex === 0}
            aria-label={t('design.editor.previousImage')}
          >
            <ChevronLeftIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 36, textAlign: 'center' }}>
            {currentIndex + 1} / {images.length}
          </Typography>
          <IconButton
            size="small"
            onClick={() => onSelect(currentIndex + 1)}
            disabled={currentIndex === images.length - 1}
            aria-label={t('design.editor.nextImage')}
          >
            <ChevronRightIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </NavSection>
      )}

      <ThumbnailList role="listbox" aria-label="Batch images">
        {images.map((img, index) => {
          const isItemSelected = selectedIds?.has(img.id) ?? false;
          return (
            <Tooltip key={img.id} title={img.name} placement="top">
              <Thumbnail
                ref={index === currentIndex ? activeRef : undefined}
                $active={index === currentIndex}
                $status={img.status}
                $selected={isItemSelected}
                role="option"
                aria-selected={index === currentIndex}
                tabIndex={0}
                onClick={(e) => {
                  if (e.shiftKey && onShiftSelect) {
                    onShiftSelect(index);
                  } else {
                    onSelect(index);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(index);
                  }
                }}
              >
                {hasMultiSelect && (
                  <CheckboxOverlay
                    className="thumb-checkbox"
                    sx={{
                      opacity: isItemSelected ? 1 : 0,
                      transition: 'opacity 150ms ease',
                      backgroundColor: (theme) => alpha(theme.palette.common.black, 0.4),
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={isItemSelected}
                      onChange={() => onToggleSelect!(img.id, index)}
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        padding: 0,
                        '& .MuiSvgIcon-root': { fontSize: 16 },
                        color: 'common.white',
                        '&.Mui-checked': {
                          color: 'secondary.main',
                        },
                      }}
                      inputProps={{ 'aria-label': t('design.editor.selectImage', { name: img.name }) }}
                    />
                  </CheckboxOverlay>
                )}
                <img src={img.processedUrl ?? img.previewUrl} alt={img.name} loading="lazy" />
              </Thumbnail>
            </Tooltip>
          );
        })}
        {onAddMore && (
          <Tooltip title={t('design.editor.addMoreImages')} placement="top">
            <AddMoreButton
              role="button"
              tabIndex={0}
              onClick={onAddMore}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onAddMore();
                }
              }}
              aria-label={t('design.editor.addMoreImages')}
            >
              <AddIcon sx={{ fontSize: 22 }} />
            </AddMoreButton>
          </Tooltip>
        )}
        {onOpenCloudManager && (
          <Tooltip title={t('design.cloud.importFromCloud')} placement="top">
            <IconButton
              size="small"
              onClick={onOpenCloudManager}
              aria-label={t('design.cloud.importFromCloud')}
              sx={{ flexShrink: 0 }}
            >
              <CloudSyncIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}
      </ThumbnailList>
    </StripRoot>
  );
};
