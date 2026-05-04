import { useCallback, useState } from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useUploadDesignsMutation } from '@/store/kanbanSlice';

const DropZone = styled(Box, {
  shouldForwardProp: (p) => p !== '$isDragOver',
})<{ $isDragOver: boolean }>(({ theme, $isDragOver }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(3),
  border: `2px dashed ${$isDragOver ? theme.palette.primary.main : theme.vars.palette.divider}`,
  borderRadius: 12,
  cursor: 'pointer',
  transition: 'border-color 150ms ease, background 150ms ease',
  background: $isDragOver ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
  '&:hover': {
    borderColor: theme.vars.palette.text.secondary,
  },
}));

interface DesignUploadZoneProps {
  nicheId: string;
}

const DesignUploadZone = ({ nicheId }: DesignUploadZoneProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadDesigns, { isLoading }] = useUploadDesignsMutation();

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append('files', f));

      try {
        const result = await uploadDesigns({ nicheId, formData }).unwrap();
        enqueueSnackbar(
          t('kanban.upload.success', { count: result.uploaded }),
          { variant: 'success' },
        );
      } catch {
        enqueueSnackbar(t('kanban.upload.error'), { variant: 'error' });
      }
    },
    [nicheId, uploadDesigns, enqueueSnackbar, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = () => handleFiles(input.files);
    input.click();
  }, [handleFiles]);

  return (
    <Box>
      <DropZone
        $isDragOver={isDragOver}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={t('kanban.upload.dropHint')}
      >
        <CloudUploadOutlinedIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
        <Typography variant="body2" color="text.secondary">
          {t('kanban.upload.dropHint')}
        </Typography>
      </DropZone>
      {isLoading && <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />}
    </Box>
  );
};

export default DesignUploadZone;
