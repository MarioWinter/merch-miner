import { useRef, useEffect } from 'react';
import { Box, Tooltip, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
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
  shouldForwardProp: (p) => p !== '$active' && p !== '$status',
})<{ $active: boolean; $status: BatchImage['status'] }>(({ theme, $active, $status }) => {
  const statusColor = {
    idle: theme.vars.palette.text.disabled,
    processing: theme.vars.palette.info.main,
    completed: theme.vars.palette.success.main,
    error: theme.vars.palette.error.main,
  }[$status];

  return {
    width: 56,
    height: 56,
    flexShrink: 0,
    borderRadius: 6,
    overflow: 'hidden',
    cursor: 'pointer',
    position: 'relative',
    border: $active ? `2px solid ${theme.vars.palette.primary.main}` : '2px solid transparent',
    outline: 'none',
    transition: 'border-color 150ms ease',
    '&:hover': {
      borderColor: $active
        ? theme.vars.palette.primary.main
        : theme.vars.palette.text.secondary,
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
});

const ExportToggle = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: '0 8px',
  borderLeft: '1px solid',
  borderColor: theme.vars.palette.divider,
  flexShrink: 0,
  height: '100%',
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface BatchThumbnailStripProps {
  images: BatchImage[];
  currentIndex: number;
  onSelect: (index: number) => void;
  showExportToggle?: boolean;
  onToggleExport?: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const BatchThumbnailStrip = ({
  images,
  currentIndex,
  onSelect,
  showExportToggle,
  onToggleExport,
}: BatchThumbnailStripProps) => {
  const { t } = useTranslation();
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [currentIndex]);

  return (
    <StripRoot>
      <ThumbnailList role="listbox" aria-label="Batch images">
        {images.map((img, index) => (
          <Tooltip key={img.id} title={img.name} placement="top">
            <Thumbnail
              ref={index === currentIndex ? activeRef : undefined}
              $active={index === currentIndex}
              $status={img.status}
              role="option"
              aria-selected={index === currentIndex}
              tabIndex={0}
              onClick={() => onSelect(index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(index);
                }
              }}
            >
              <img src={img.previewUrl} alt={img.name} loading="lazy" />
            </Thumbnail>
          </Tooltip>
        ))}
      </ThumbnailList>

      {showExportToggle && onToggleExport && (
        <ExportToggle>
          <Tooltip title={t('design.export.title')}>
            <IconButton size="small" onClick={onToggleExport} aria-label={t('design.export.title')}>
              <FileDownloadIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        </ExportToggle>
      )}
    </StripRoot>
  );
};
