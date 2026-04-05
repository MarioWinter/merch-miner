import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import { useTranslation } from 'react-i18next';
import useExportDialog, {
  formatFileSize,
  estimateCompressedSize,
} from '../hooks/useExportDialog';
import type { BatchImage, ExportFormat, ExportSettings } from '../types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontWeight: 600,
  fontSize: theme.typography.subtitle2.fontSize,
  color: theme.vars.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));

const FormatToggle = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontWeight: 500,
    borderColor: theme.vars.palette.divider,
    color: theme.vars.palette.text.secondary,
    '&.Mui-selected': {
      backgroundColor: theme.vars.palette.primary.main,
      color: theme.vars.palette.common.white,
      '&:hover': {
        backgroundColor: theme.vars.palette.primary.dark,
      },
    },
  },
}));

const VersionToggle = styled(ToggleButtonGroup)(({ theme }) => ({
  '& .MuiToggleButton-root': {
    fontSize: theme.typography.body2.fontSize,
    fontWeight: 500,
    padding: '4px 12px',
    textTransform: 'none',
    borderColor: theme.vars.palette.divider,
    color: theme.vars.palette.text.secondary,
    '&.Mui-selected': {
      backgroundColor: theme.vars.palette.primary.main,
      color: theme.vars.palette.common.white,
      '&:hover': {
        backgroundColor: theme.vars.palette.primary.dark,
      },
    },
  },
}));

const DimensionText = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.disabled,
  fontSize: theme.typography.caption.fontSize,
  marginTop: theme.spacing(0.5),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  currentImage: BatchImage | null;
  batchImages: BatchImage[];
  onDownloadCurrent: (settings: ExportSettings) => void;
  onDownloadAll: (settings: ExportSettings) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const ExportDialog = ({
  open,
  onClose,
  currentImage,
  batchImages,
  onDownloadCurrent,
  onDownloadAll,
}: ExportDialogProps) => {
  const { t } = useTranslation();
  const {
    format,
    setFormat,
    dpi,
    setDpi,
    quality,
    setQuality,
    overwriteOriginal,
    setOverwriteOriginal,
    buildSettings,
    downloadCurrent,
    downloadAllZip,
    isCreatingZip,
    zipProgress,
    estimatedCurrentSize,
    resultDimensions,
  } = useExportDialog(currentImage);

  const qualityLabel = format === 'png'
    ? t('design.export.compression')
    : t('design.export.quality');

  const estimatedTotal = batchImages.reduce((sum, img) => {
    const size = img.fileSize ?? 0;
    return sum + (size > 0 ? estimateCompressedSize(size, quality, format) : 0);
  }, 0);

  const handleDownloadCurrent = () => {
    if (!currentImage) return;
    onDownloadCurrent(buildSettings());
    downloadCurrent(currentImage);
  };

  const handleDownloadAll = async () => {
    onDownloadAll(buildSettings());
    await downloadAllZip(batchImages);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="export-dialog-title"
    >
      <DialogTitle id="export-dialog-title">
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" component="span">
            {t('design.export.advanced')}
          </Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Format Selection */}
          <Box>
            <SectionLabel>{t('design.export.format')}</SectionLabel>
            <FormatToggle
              exclusive
              value={format}
              onChange={(_, val: ExportFormat | null) => {
                if (val) setFormat(val);
              }}
              aria-label={t('design.export.format')}
            >
              <ToggleButton value="png">{t('design.export.formatPngShort')}</ToggleButton>
              <ToggleButton value="jpeg">{t('design.export.formatJpeg')}</ToggleButton>
              <ToggleButton value="webp">{t('design.export.formatWebp')}</ToggleButton>
            </FormatToggle>
          </Box>

          <Divider />

          {/* Quality / Compression slider */}
          <Box>
            <SectionLabel>{qualityLabel}</SectionLabel>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Slider
                size="small"
                min={0}
                max={100}
                step={1}
                value={quality}
                onChange={(_, v) => setQuality(v as number)}
                aria-label={qualityLabel}
              />
              <Typography variant="body2" fontWeight={500} sx={{ minWidth: 36 }}>
                {quality}%
              </Typography>
            </Stack>
            {estimatedCurrentSize !== null && (
              <DimensionText>
                {t('design.export.estimatedSize', {
                  size: formatFileSize(estimatedCurrentSize),
                })}
              </DimensionText>
            )}
          </Box>

          <Divider />

          {/* Resolution / DPI */}
          <Box>
            <SectionLabel>{t('design.export.resolution')}</SectionLabel>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Slider
                size="small"
                min={72}
                max={600}
                step={1}
                value={dpi}
                onChange={(_, v) => setDpi(v as number)}
                aria-label={t('design.export.dpi')}
              />
              <Typography variant="body2" fontWeight={500} sx={{ minWidth: 36 }}>
                {dpi}
              </Typography>
            </Stack>
            {resultDimensions && (
              <DimensionText>
                {t('design.export.dimensions', {
                  width: resultDimensions.width,
                  height: resultDimensions.height,
                })}
              </DimensionText>
            )}
          </Box>

          <Divider />

          {/* Output options */}
          <Box>
            <SectionLabel>{t('design.export.overwrite')}</SectionLabel>
            <VersionToggle
              exclusive
              value={overwriteOriginal ? 'overwrite' : 'newVersion'}
              onChange={(_, val) => {
                if (val !== null) setOverwriteOriginal(val === 'overwrite');
              }}
              aria-label={t('design.export.overwrite')}
            >
              <ToggleButton value="overwrite">
                {t('design.export.overwrite')}
              </ToggleButton>
              <ToggleButton value="newVersion">
                {t('design.export.newVersion')}
              </ToggleButton>
            </VersionToggle>
          </Box>

          {/* ZIP progress */}
          {isCreatingZip && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('design.export.creatingZip')}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={zipProgress}
                sx={{ mt: 1 }}
              />
            </Box>
          )}

          {/* Summary */}
          {batchImages.length > 0 && (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                {t('design.export.imageCount', { count: batchImages.length })}
              </Typography>
              {estimatedTotal > 0 && (
                <Typography variant="caption" color="text.secondary">
                  {t('design.export.totalSize', {
                    size: formatFileSize(estimatedTotal),
                  })}
                </Typography>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadCurrent}
          disabled={!currentImage || isCreatingZip}
        >
          {t('design.export.downloadCurrent')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<FolderZipIcon />}
          onClick={handleDownloadAll}
          disabled={batchImages.length === 0 || isCreatingZip}
        >
          {t('design.export.downloadZip')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
