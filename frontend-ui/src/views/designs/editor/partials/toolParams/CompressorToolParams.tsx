import { Stack, Slider, TextField, Typography, Box, Button, Tooltip, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_COMPRESSOR_PARAMS } from '../../utils/imageProcessing';
import type { CompressorParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface CompressorToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
  estimatedSizeKb?: number | null;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): CompressorParams => ({
  maxSizeKb: (params.maxSizeKb as number) ?? DEFAULT_COMPRESSOR_PARAMS.maxSizeKb,
  quality: (params.quality as number) ?? DEFAULT_COMPRESSOR_PARAMS.quality,
  format: (params.format as CompressorParams['format']) ?? DEFAULT_COMPRESSOR_PARAMS.format,
});

const formatSizeLabel = (kb: number): string => {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
};

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ParamLabel = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
});

const SliderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const CompressorToolParams = ({
  params,
  onChange,
  disabled,
  estimatedSizeKb,
}: CompressorToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<CompressorParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleMaxSizeSlider = (_: Event, value: number | number[]) => {
    update({ maxSizeKb: value as number });
  };

  const handleMaxSizeInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(100, Math.min(5000, Number(e.target.value) || 100));
    update({ maxSizeKb: num });
  };

  const handleQualitySlider = (_: Event, value: number | number[]) => {
    update({ quality: value as number });
  };

  const handleQualityInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(10, Math.min(100, Number(e.target.value) || 10));
    update({ quality: num });
  };

  const handleFormatChange = (
    _: React.MouseEvent<HTMLElement>,
    newFormat: CompressorParams['format'] | null,
  ) => {
    if (newFormat) update({ format: newFormat });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_COMPRESSOR_PARAMS });
  };

  const isDefault =
    resolved.maxSizeKb === DEFAULT_COMPRESSOR_PARAMS.maxSizeKb &&
    resolved.quality === DEFAULT_COMPRESSOR_PARAMS.quality &&
    resolved.format === DEFAULT_COMPRESSOR_PARAMS.format;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Max Size */}
      <Box>
        <Tooltip title={t('design.tools.compressorParams.maxSizeHint')} placement="top">
          <ParamLabel color="text.secondary">
            {t('design.tools.compressorParams.maxSize')}
          </ParamLabel>
        </Tooltip>
        <SliderRow>
          <Slider
            value={resolved.maxSizeKb}
            onChange={handleMaxSizeSlider}
            min={100}
            max={5000}
            step={100}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.compressorParams.maxSize')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.maxSizeKb}
            onChange={handleMaxSizeInput}
            slotProps={{ htmlInput: { min: 100, max: 5000, step: 100 } }}
            sx={{ width: 72 }}
          />
        </SliderRow>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block' }}>
          {formatSizeLabel(resolved.maxSizeKb)}
        </Typography>
      </Box>

      {/* Quality */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.compressorParams.quality')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.quality}
            onChange={handleQualitySlider}
            min={10}
            max={100}
            step={5}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.compressorParams.quality')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.quality}
            onChange={handleQualityInput}
            slotProps={{ htmlInput: { min: 10, max: 100, step: 5 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Format */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.compressorParams.format')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.format}
          exclusive
          onChange={handleFormatChange}
          size="small"
          fullWidth
          aria-label={t('design.tools.compressorParams.format')}
        >
          <ToggleButton value="png">{t('design.tools.compressorParams.png')}</ToggleButton>
          <ToggleButton value="webp">{t('design.tools.compressorParams.webp')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Estimated size */}
      {estimatedSizeKb != null && (
        <Typography variant="caption" color="text.secondary">
          {t('design.tools.compressorParams.estimatedSize')}: ~{formatSizeLabel(estimatedSizeKb)}
        </Typography>
      )}

      {/* Reset */}
      <Button
        size="small"
        variant="text"
        color="inherit"
        startIcon={<RestartAltIcon sx={{ fontSize: 14 }} />}
        onClick={handleReset}
        disabled={isDefault}
        sx={{ alignSelf: 'flex-start', fontSize: 11, textTransform: 'none' }}
      >
        {t('design.tools.colorAdjustmentParams.reset')}
      </Button>
    </Stack>
  );
};
