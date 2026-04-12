import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Slider,
  Button,
  IconButton,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import DownloadIcon from '@mui/icons-material/Download';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import CloseIcon from '@mui/icons-material/Close';
import type { BatchImage, CompressionLevel, ExportSettings } from '../types';
import { COLORS, DURATION, EASING, MONO_FONT_STACK } from '@/style/constants';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

type BottomBarMode = 'info' | 'export';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const BarRoot = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: '0 16px',
  height: 48,
  backgroundColor: alpha(COLORS.ink, 0.95),
  borderTop: `1px solid ${alpha(COLORS.snowMuted, 0.12)}`,
  backdropFilter: 'blur(8px)',
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.ash, 0.95),
    borderTop: `1px solid ${alpha(COLORS.mist, 0.12)}`,
  }),
}));

const Label = styled(Typography)({
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  lineHeight: 1,
  opacity: 0.5,
});

const Value = styled(Typography)({
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.2,
});

const ControlGroup = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
});

const DpiRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: 110,
});

const CompactSlider = styled(Slider)(({ theme }) => ({
  height: 3,
  padding: '8px 0',
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
    backgroundColor: theme.vars.palette.primary.main,
    '&:hover, &.Mui-focusVisible': {
      boxShadow: `0 0 0 6px ${alpha(COLORS.red, 0.16)}`,
    },
  },
  '& .MuiSlider-track': {
    backgroundColor: theme.vars.palette.primary.main,
    border: 'none',
  },
  '& .MuiSlider-rail': {
    backgroundColor: alpha(COLORS.snowMuted, 0.2),
  },
}));

const CompactSelect = styled(Select<CompressionLevel>)(({ theme }) => ({
  height: 26,
  fontSize: 12,
  fontWeight: 500,
  minWidth: 90,
  borderRadius: 4,
  backgroundColor: alpha(COLORS.snowMuted, 0.08),
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: alpha(COLORS.snowMuted, 0.15),
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: alpha(COLORS.snowMuted, 0.3),
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: theme.vars.palette.primary.main,
    borderWidth: 1,
  },
  '& .MuiSelect-select': {
    padding: '2px 8px',
  },
}));

const VersionButton = styled(Button, {
  shouldForwardProp: (p) => p !== '$active',
})<{ $active: boolean }>(({ theme, $active }) => ({
  height: 26,
  fontSize: 11,
  fontWeight: 500,
  textTransform: 'none',
  padding: '0 10px',
  borderRadius: 4,
  minWidth: 'auto',
  border: `1px solid ${alpha(COLORS.snowMuted, $active ? 0.3 : 0.12)}`,
  backgroundColor: $active ? alpha(COLORS.snowMuted, 0.12) : 'transparent',
  color: $active ? COLORS.snow : alpha(COLORS.snowMuted, 0.6),
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(COLORS.snowMuted, 0.15),
    borderColor: alpha(COLORS.snowMuted, 0.3),
  },
  ...theme.applyStyles('light', {
    border: `1px solid ${alpha(COLORS.mist, $active ? 0.3 : 0.12)}`,
    backgroundColor: $active ? alpha(COLORS.mist, 0.1) : 'transparent',
    color: $active ? COLORS.ink : alpha(COLORS.mist, 0.5),
  }),
}));

const ActionButton = styled(Button)(({ theme }) => ({
  height: 30,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'none',
  padding: '0 14px',
  borderRadius: 6,
  gap: 6,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '& .MuiButton-startIcon': {
    marginLeft: 0,
    marginRight: 0,
    '& > svg': { fontSize: 15 },
  },
  ...theme.applyStyles('light', {}),
}));

const Separator = styled(Box)(({ theme }) => ({
  width: 1,
  height: 24,
  backgroundColor: alpha(COLORS.snowMuted, 0.12),
  flexShrink: 0,
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.mist, 0.12),
  }),
}));

const CloseButton = styled(IconButton)({
  width: 28,
  height: 28,
  opacity: 0.4,
  '&:hover': { opacity: 0.8 },
});

const MonoValue = styled(Typography)({
  fontSize: 12,
  fontWeight: 500,
  fontFamily: MONO_FONT_STACK,
  lineHeight: 1.2,
});

const EstimatedBadge = styled(Typography)(({ theme }) => ({
  fontSize: 11,
  fontWeight: 600,
  fontFamily: MONO_FONT_STACK,
  color: theme.vars.palette.success.main,
  whiteSpace: 'nowrap',
}));

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Rough estimate of compressed size based on compression level */
const COMPRESSION_RATIO: Record<CompressionLevel, number> = {
  off: 1,
  low: 0.75,
  medium: 0.5,
  high: 0.38,
  very_high: 0.28,
};

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const COMPRESSION_OPTIONS: Array<{ value: CompressionLevel; labelKey: string }> = [
  { value: 'off', labelKey: 'design.export.compressionOff' },
  { value: 'low', labelKey: 'design.export.compressionLow' },
  { value: 'medium', labelKey: 'design.export.compressionMedium' },
  { value: 'high', labelKey: 'design.export.compressionHigh' },
  { value: 'very_high', labelKey: 'design.export.compressionVeryHigh' },
];

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface UnifiedBottomBarProps {
  currentImage: BatchImage | null;
  totalImages: number;
  onDownloadCurrent: (settings: ExportSettings) => void;
  onDownloadAll: (settings: ExportSettings) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const UnifiedBottomBar = ({
  currentImage,
  totalImages,
  onDownloadCurrent,
  onDownloadAll,
}: UnifiedBottomBarProps) => {
  const { t } = useTranslation();

  const [mode, setMode] = useState<BottomBarMode>('info');
  const [dpi, setDpi] = useState(300);
  const [compression, setCompression] = useState<CompressionLevel>('medium');
  const [overwriteOriginal, setOverwriteOriginal] = useState(false);

  const buildSettings = (): ExportSettings => ({
    format: 'png',
    dpi,
    compression,
    overwriteOriginal,
  });

  const originalSize = currentImage?.fileSize ?? 0;
  const estimatedSize = useMemo(
    () => Math.round(originalSize * COMPRESSION_RATIO[compression]),
    [originalSize, compression],
  );
  const savingsPercent = useMemo(() => {
    if (originalSize === 0 || compression === 'off') return 0;
    return Math.round((1 - COMPRESSION_RATIO[compression]) * 100);
  }, [originalSize, compression]);

  const resolution = currentImage?.width && currentImage?.height
    ? `${currentImage.width} x ${currentImage.height}`
    : null;

  // ---------------------------------------------------------------
  // Info Mode
  // ---------------------------------------------------------------
  if (mode === 'info') {
    return (
      <BarRoot data-testid="unified-bottom-bar" data-mode="info">
        {/* Format badge */}
        <Chip
          label="PNG"
          size="small"
          sx={{ fontSize: 11, fontWeight: 600, height: 24 }}
        />

        <Separator />

        {/* Resolution */}
        {resolution && (
          <>
            <ControlGroup>
              <Label>{t('design.export.resolution')}</Label>
              <MonoValue>{resolution}</MonoValue>
            </ControlGroup>
            <Separator />
          </>
        )}

        {/* File size */}
        {originalSize > 0 && (
          <>
            <ControlGroup>
              <Label>{t('design.export.fileSize')}</Label>
              <MonoValue>{formatFileSize(originalSize)}</MonoValue>
            </ControlGroup>
            <Separator />
          </>
        )}

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Download button switches to export mode */}
        <ActionButton
          variant="contained"
          color="primary"
          startIcon={<DownloadIcon />}
          onClick={() => setMode('export')}
          aria-label={t('design.export.title')}
        >
          {t('design.export.download')}
        </ActionButton>
      </BarRoot>
    );
  }

  // ---------------------------------------------------------------
  // Export Mode
  // ---------------------------------------------------------------
  return (
    <BarRoot data-testid="unified-bottom-bar" data-mode="export">
      {/* Format badge */}
      <ControlGroup>
        <Label>{t('design.export.format')}</Label>
        <Value>PNG</Value>
      </ControlGroup>

      <Separator />

      {/* DPI */}
      <ControlGroup>
        <Label>{t('design.export.dpi')}</Label>
        <DpiRow>
          <CompactSlider
            size="small"
            min={72}
            max={600}
            step={1}
            value={dpi}
            onChange={(_, v) => setDpi(v as number)}
            aria-label={t('design.export.dpi')}
          />
          <Value sx={{ minWidth: 24, textAlign: 'right' }}>{dpi}</Value>
        </DpiRow>
      </ControlGroup>

      <Separator />

      {/* Compression dropdown + estimated size */}
      <ControlGroup>
        <Label>{t('design.export.compressionLevel')}</Label>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CompactSelect
            value={compression}
            onChange={(e) => setCompression(e.target.value as CompressionLevel)}
            aria-label={t('design.export.compressionLevel')}
          >
            {COMPRESSION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 12 }}>
                {t(opt.labelKey)}
              </MenuItem>
            ))}
          </CompactSelect>
          {compression !== 'off' && originalSize > 0 && (
            <EstimatedBadge data-testid="estimated-size">
              Est. ~{formatFileSize(estimatedSize)} &darr;{savingsPercent}%
            </EstimatedBadge>
          )}
        </Box>
      </ControlGroup>

      <Separator />

      {/* Overwrite vs New Version */}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <VersionButton
          $active={overwriteOriginal}
          onClick={() => setOverwriteOriginal(true)}
        >
          {t('design.export.overwrite')}
        </VersionButton>
        <VersionButton
          $active={!overwriteOriginal}
          onClick={() => setOverwriteOriginal(false)}
        >
          {t('design.export.newVersion')}
        </VersionButton>
      </Box>

      {/* Spacer */}
      <Box sx={{ flex: 1 }} />

      {/* Download buttons */}
      <ActionButton
        variant="contained"
        color="primary"
        startIcon={<DownloadIcon />}
        onClick={() => onDownloadCurrent(buildSettings())}
        disabled={!currentImage}
      >
        {t('design.export.downloadCurrent')}
      </ActionButton>

      <ActionButton
        variant="outlined"
        color="primary"
        startIcon={<FolderZipIcon />}
        onClick={() => onDownloadAll(buildSettings())}
        disabled={totalImages === 0}
      >
        {t('design.export.downloadAll')}
      </ActionButton>

      <CloseButton
        size="small"
        onClick={() => setMode('info')}
        aria-label={t('design.export.closeExport')}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </CloseButton>
    </BarRoot>
  );
};
