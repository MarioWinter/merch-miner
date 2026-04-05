import {
  Stack,
  Typography,
  Box,
  TextField,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  CircularProgress,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import CloudIcon from '@mui/icons-material/Cloud';
import ComputerIcon from '@mui/icons-material/Computer';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  DEFAULT_PICA_UPSCALE_PARAMS,
  PICA_THRESHOLD_PX,
} from '../../hooks/usePicaUpscale';
import type { UpscaleMode, UpscaleFilter } from '../../hooks/usePicaUpscale';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const InfoBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  borderRadius: 8,
  backgroundColor: 'rgba(0, 200, 215, 0.08)',
  border: `1px solid ${theme.vars.palette.secondary.main}20`,
}));

const DimRow = styled(Box)({
  display: 'flex',
  gap: 8,
  alignItems: 'center',
});

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UpscaleToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
  /** Current image dimensions (used for auto-mode hint) */
  imageWidth?: number;
  imageHeight?: number;
  onRunNow?: () => void;
  isProcessing?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const FILTERS: Array<{ value: UpscaleFilter; labelKey: string }> = [
  { value: 'lanczos3', labelKey: 'design.tools.upscaleParams.filterLanczos3' },
  { value: 'lanczos2', labelKey: 'design.tools.upscaleParams.filterLanczos2' },
  { value: 'mks2013', labelKey: 'design.tools.upscaleParams.filterMks2013' },
];

const resolveMode = (params: Record<string, unknown>): UpscaleMode =>
  (params.mode as UpscaleMode) ?? 'auto';

const resolveAutoMethod = (
  mode: UpscaleMode,
  imageWidth?: number,
  imageHeight?: number,
): 'client' | 'server' => {
  if (mode === 'client') return 'client';
  if (mode === 'server') return 'server';
  // Auto: >= threshold on either axis → client
  if (
    imageWidth !== undefined &&
    imageHeight !== undefined &&
    (imageWidth >= PICA_THRESHOLD_PX || imageHeight >= PICA_THRESHOLD_PX)
  ) {
    return 'client';
  }
  return 'server';
};

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const UpscaleToolParams = ({
  params,
  onChange,
  disabled,
  imageWidth,
  imageHeight,
  onRunNow,
  isProcessing,
}: UpscaleToolParamsProps) => {
  const { t } = useTranslation();

  const mode = resolveMode(params);
  const targetWidth =
    (params.targetWidth as number) ?? DEFAULT_PICA_UPSCALE_PARAMS.targetWidth;
  const targetHeight =
    (params.targetHeight as number) ?? DEFAULT_PICA_UPSCALE_PARAMS.targetHeight;
  const filter =
    (params.filter as UpscaleFilter) ?? DEFAULT_PICA_UPSCALE_PARAMS.filter;

  const resolvedMethod = resolveAutoMethod(mode, imageWidth, imageHeight);
  const isClient = resolvedMethod === 'client';

  return (
    <Stack spacing={1.5} sx={{ opacity: disabled ? 0.5 : 1 }}>
      {/* Mode toggle: Auto / Client / Server */}
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {t('design.tools.upscaleParams.mode')}
        </Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={(_, val) => {
            if (val) onChange({ ...params, mode: val });
          }}
          size="small"
          disabled={disabled || isProcessing}
          fullWidth
        >
          <ToggleButton value="auto" aria-label={t('design.tools.upscaleParams.modeAuto')}>
            <AutoModeIcon sx={{ fontSize: 16, mr: 0.5 }} />
            <Typography variant="caption">
              {t('design.tools.upscaleParams.modeAuto')}
            </Typography>
          </ToggleButton>
          <ToggleButton value="client" aria-label={t('design.tools.upscaleParams.modeClient')}>
            <ComputerIcon sx={{ fontSize: 16, mr: 0.5 }} />
            <Typography variant="caption">
              {t('design.tools.upscaleParams.modeClient')}
            </Typography>
          </ToggleButton>
          <ToggleButton value="server" aria-label={t('design.tools.upscaleParams.modeServer')}>
            <CloudIcon sx={{ fontSize: 16, mr: 0.5 }} />
            <Typography variant="caption">
              {t('design.tools.upscaleParams.modeServer')}
            </Typography>
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {/* Auto-mode resolution hint */}
      {mode === 'auto' && (
        <InfoBox>
          {isClient ? (
            <ComputerIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
          ) : (
            <CloudIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
          )}
          <Typography variant="caption" color="text.secondary">
            {isClient
              ? t('design.tools.upscaleParams.autoClientHint')
              : t('design.tools.upscaleParams.autoServerHint')}
          </Typography>
        </InfoBox>
      )}

      {/* Current image size chip */}
      {imageWidth !== undefined && imageHeight !== undefined && (
        <Chip
          size="small"
          label={t('design.tools.upscaleParams.currentSize', {
            w: imageWidth,
            h: imageHeight,
          })}
          variant="outlined"
          sx={{ alignSelf: 'flex-start' }}
        />
      )}

      {/* Target dimensions */}
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">
          {t('design.tools.upscaleParams.targetDimensions')}
        </Typography>
        <DimRow>
          <TextField
            type="number"
            size="small"
            label={t('design.tools.upscaleParams.width')}
            value={targetWidth}
            onChange={(e) =>
              onChange({ ...params, targetWidth: Number(e.target.value) || 0 })
            }
            disabled={disabled || isProcessing}
            slotProps={{ htmlInput: { min: 1, max: 16000 } }}
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" color="text.disabled">
            x
          </Typography>
          <TextField
            type="number"
            size="small"
            label={t('design.tools.upscaleParams.height')}
            value={targetHeight}
            onChange={(e) =>
              onChange({ ...params, targetHeight: Number(e.target.value) || 0 })
            }
            disabled={disabled || isProcessing}
            slotProps={{ htmlInput: { min: 1, max: 16000 } }}
            sx={{ flex: 1 }}
          />
        </DimRow>
      </Stack>

      {/* Filter (client mode only) */}
      {(mode === 'client' || (mode === 'auto' && isClient)) && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            {t('design.tools.upscaleParams.filter')}
          </Typography>
          <Select
            size="small"
            value={filter}
            onChange={(e) => onChange({ ...params, filter: e.target.value })}
            disabled={disabled || isProcessing}
            sx={{ fontSize: 13 }}
          >
            {FILTERS.map((f) => (
              <MenuItem key={f.value} value={f.value} sx={{ fontSize: 13 }}>
                {t(f.labelKey)}
              </MenuItem>
            ))}
          </Select>
        </Stack>
      )}

      {/* Run Now button for server mode */}
      {(mode === 'server' || (mode === 'auto' && !isClient)) && onRunNow && (
        <Button
          variant="contained"
          color="secondary"
          size="small"
          onClick={onRunNow}
          disabled={disabled || isProcessing}
          startIcon={
            isProcessing ? (
              <CircularProgress size={14} color="inherit" />
            ) : (
              <PlayArrowIcon />
            )
          }
          fullWidth
        >
          {isProcessing
            ? t('design.tools.upscaleParams.processing')
            : t('design.tools.upscaleParams.runNow')}
        </Button>
      )}

      {/* Threshold info */}
      <Typography variant="caption" color="text.disabled">
        {t('design.tools.upscaleParams.thresholdInfo', {
          threshold: PICA_THRESHOLD_PX,
        })}
      </Typography>
    </Stack>
  );
};
