import { useCallback, useEffect, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { useTranslation } from 'react-i18next';
import { useGetDesignsByIdsQuery } from '@/store/designSlice';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const DropZoneRoot = styled(Box, {
  shouldForwardProp: (p) => p !== '$dragOver',
})<{ $dragOver: boolean }>(({ theme, $dragOver }) => ({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(2),
  border: `2px dashed ${$dragOver ? theme.vars.palette.secondary.main : theme.vars.palette.secondary.dark}`,
  borderRadius: 12,
  margin: theme.spacing(3),
  backgroundColor: $dragOver
    ? 'rgba(0, 200, 215, 0.06)'
    : 'transparent',
  transition: 'background-color 150ms ease, border-color 150ms ease',
}));

const DropIcon = styled(CloudUploadOutlinedIcon)(({ theme }) => ({
  fontSize: 64,
  color: theme.vars.palette.secondary.main,
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface DropZoneProps {
  onBrowse: () => void;
  preloadIds: string[];
  onFilesAdded: (files: File[]) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const DropZone = ({ onBrowse, preloadIds, onFilesAdded }: DropZoneProps) => {
  const { t } = useTranslation();
  const [dragOver, setDragOver] = useState(false);

  // Preload designs from URL params
  const shouldPreload = preloadIds.length > 0;
  const { data: preloadedDesigns, isLoading: preloading } = useGetDesignsByIdsQuery(
    preloadIds,
    { skip: !shouldPreload },
  );

  // Convert preloaded designs to batch images (via fetch -> File)
  useEffect(() => {
    if (!preloadedDesigns || preloadedDesigns.length === 0) return;

    const loadImages = async () => {
      const files: File[] = [];
      for (const design of preloadedDesigns) {
        if (!design.image_file) continue;
        try {
          const resp = await fetch(design.image_file);
          const blob = await resp.blob();
          const name = design.image_file.split('/').pop() ?? `design-${design.id}.png`;
          files.push(new File([blob], name, { type: blob.type }));
        } catch {
          // skip failed fetches
        }
      }
      if (files.length > 0) onFilesAdded(files);
    };

    loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedDesigns]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  if (shouldPreload && preloading) {
    return (
      <DropZoneRoot $dragOver={false}>
        <CircularProgress size={40} color="secondary" />
        <Typography variant="body2" color="text.secondary">
          {t('design.editor.processing')}
        </Typography>
      </DropZoneRoot>
    );
  }

  return (
    <DropZoneRoot
      $dragOver={dragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      aria-label={t('design.editor.dropHint')}
    >
      <DropIcon />
      <Typography variant="h5" color="text.secondary">
        {t('design.editor.noImages')}
      </Typography>
      <Typography variant="body2" color="text.disabled">
        {t('design.editor.noImagesCta')}
      </Typography>
      <Button
        variant="outlined"
        color="secondary"
        onClick={onBrowse}
        startIcon={<CloudUploadOutlinedIcon />}
      >
        {t('design.editor.browseFiles')}
      </Button>
    </DropZoneRoot>
  );
};
