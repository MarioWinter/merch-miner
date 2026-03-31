import { useState } from 'react';
import {
  Box,
  Typography,
  Slider,
  Button,
  Tooltip,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import CloseIcon from '@mui/icons-material/Close';
import type { BatchImage, ExportSettings } from '../types';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ExportRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: '8px 16px',
  borderLeft: '1px solid',
  borderColor: theme.vars.palette.divider,
  height: '100%',
  minWidth: 360,
}));

const ControlGroup = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
});

const SliderGroup = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 120,
});

const VersionToggle = styled(ToggleButtonGroup)(({ theme }) => ({
  height: 28,
  '& .MuiToggleButton-root': {
    fontSize: theme.typography.caption.fontSize,
    fontWeight: 500,
    padding: '2px 8px',
    textTransform: 'none',
    lineHeight: 1.4,
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

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const estimateCompressedSize = (
  originalSize: number,
  compression: number,
): number => {
  // Rough estimate: compression 100 = original, 0 = ~10% of original
  const ratio = 0.1 + 0.9 * (compression / 100);
  return Math.round(originalSize * ratio);
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ExportControlsProps {
  currentImage: BatchImage | null;
  totalImages: number;
  onClose: () => void;
  onDownloadCurrent: (settings: ExportSettings) => void;
  onDownloadAll: (settings: ExportSettings) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const ExportControls = ({
  currentImage,
  totalImages,
  onClose,
  onDownloadCurrent,
  onDownloadAll,
}: ExportControlsProps) => {
  const { t } = useTranslation();

  const [dpi, setDpi] = useState(300);
  const [compression, setCompression] = useState(80);
  const [overwriteOriginal, setOverwriteOriginal] = useState(false);

  const currentFileSize = currentImage?.fileSize ?? 0;
  const estimatedSize = currentFileSize > 0
    ? estimateCompressedSize(currentFileSize, compression)
    : null;

  const buildSettings = (): ExportSettings => ({
    format: 'png',
    dpi,
    compression,
    overwriteOriginal,
  });

  return (
    <ExportRoot>
      {/* Format badge */}
      <ControlGroup>
        <Typography variant="overline" color="text.secondary" lineHeight={1.2}>
          {t('design.export.format')}
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          PNG
        </Typography>
      </ControlGroup>

      {/* DPI */}
      <ControlGroup sx={{ minWidth: 80 }}>
        <Typography variant="overline" color="text.secondary" lineHeight={1.2}>
          {t('design.export.dpi')}
        </Typography>
        <SliderGroup>
          <Slider
            size="small"
            min={72}
            max={600}
            step={1}
            value={dpi}
            onChange={(_, v) => setDpi(v as number)}
            sx={{ minWidth: 60 }}
            aria-label={t('design.export.dpi')}
          />
          <Typography variant="caption" fontWeight={500} sx={{ minWidth: 28 }}>
            {dpi}
          </Typography>
        </SliderGroup>
      </ControlGroup>

      {/* Compression */}
      <ControlGroup sx={{ minWidth: 100 }}>
        <Typography variant="overline" color="text.secondary" lineHeight={1.2}>
          {t('design.export.compression')}
        </Typography>
        <SliderGroup>
          <Slider
            size="small"
            min={0}
            max={100}
            step={1}
            value={compression}
            onChange={(_, v) => setCompression(v as number)}
            sx={{ minWidth: 60 }}
            aria-label={t('design.export.compression')}
          />
          <Typography variant="caption" fontWeight={500} sx={{ minWidth: 28 }}>
            {compression}%
          </Typography>
        </SliderGroup>
        {estimatedSize !== null && (
          <Typography variant="caption" color="text.disabled">
            {t('design.export.estimatedSize', { size: formatFileSize(estimatedSize) })}
          </Typography>
        )}
      </ControlGroup>

      {/* Overwrite vs New Version toggle */}
      <ControlGroup>
        <Typography variant="overline" color="text.secondary" lineHeight={1.2}>
          {t('design.export.overwrite')}
        </Typography>
        <VersionToggle
          size="small"
          exclusive
          value={overwriteOriginal ? 'overwrite' : 'newVersion'}
          onChange={(_, val) => {
            if (val !== null) setOverwriteOriginal(val === 'overwrite');
          }}
          aria-label={t('design.export.overwrite')}
        >
          <ToggleButton value="overwrite">{t('design.export.overwrite')}</ToggleButton>
          <ToggleButton value="newVersion">{t('design.export.newVersion')}</ToggleButton>
        </VersionToggle>
      </ControlGroup>

      {/* Download buttons */}
      <Box sx={{ display: 'flex', gap: 1, ml: 'auto', alignItems: 'center' }}>
        <Tooltip title={t('design.export.downloadCurrent')}>
          <span>
            <Button
              size="small"
              variant="contained"
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              onClick={() => onDownloadCurrent(buildSettings())}
              disabled={!currentImage}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {t('design.export.downloadCurrent')}
            </Button>
          </span>
        </Tooltip>

        <Tooltip title={t('design.export.downloadAll')}>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FolderZipIcon sx={{ fontSize: 16 }} />}
              onClick={() => onDownloadAll(buildSettings())}
              disabled={totalImages === 0}
              sx={{ whiteSpace: 'nowrap' }}
            >
              {t('design.export.downloadAll')}
            </Button>
          </span>
        </Tooltip>

        <IconButton size="small" onClick={onClose} aria-label="Close export">
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>
    </ExportRoot>
  );
};
