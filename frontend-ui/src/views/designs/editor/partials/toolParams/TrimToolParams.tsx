import {
  Stack,
  Slider,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { DEFAULT_TRIM_PARAMS } from '../../utils/imageProcessing';
import type { TrimParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface TrimToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveTrimParams = (params: Record<string, unknown>): TrimParams => ({
  threshold: (params.threshold as number) ?? DEFAULT_TRIM_PARAMS.threshold,
  padding: (params.padding as number) ?? DEFAULT_TRIM_PARAMS.padding,
  trimColor: (params.trimColor as TrimParams['trimColor']) ?? DEFAULT_TRIM_PARAMS.trimColor,
});

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ParamLabel = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 2,
});

const CompactToggleButton = styled(ToggleButton)({
  padding: '4px 6px',
  fontSize: 11,
  textTransform: 'none',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
});

const SliderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const TrimToolParams = ({ params, onChange, disabled }: TrimToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveTrimParams(params);

  const update = (patch: Partial<TrimParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleTrimColor = (
    _: React.MouseEvent<HTMLElement>,
    value: TrimParams['trimColor'] | null,
  ) => {
    if (value) update({ trimColor: value });
  };

  const handleThresholdSlider = (_: Event, value: number | number[]) => {
    update({ threshold: value as number });
  };

  const handleThresholdInput = (raw: string) => {
    const num = Math.max(0, Math.min(255, Number(raw) || 0));
    update({ threshold: num });
  };

  const handlePaddingSlider = (_: Event, value: number | number[]) => {
    update({ padding: value as number });
  };

  const handlePaddingInput = (raw: string) => {
    const num = Math.max(0, Math.min(200, Number(raw) || 0));
    update({ padding: num });
  };

  const thresholdLabel =
    resolved.trimColor === 'auto'
      ? t('design.tools.trimParams.colorTolerance')
      : t('design.tools.trimParams.alphaThreshold');

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Trim Mode */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.trimParams.trimMode')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.trimColor}
          exclusive
          onChange={handleTrimColor}
          size="small"
          fullWidth
          aria-label={t('design.tools.trimParams.trimMode')}
        >
          <CompactToggleButton value="transparent">
            {t('design.tools.trimParams.transparent')}
          </CompactToggleButton>
          <CompactToggleButton value="auto">
            {t('design.tools.trimParams.autoDetect')}
          </CompactToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Threshold */}
      <Box>
        <ParamLabel color="text.secondary">{thresholdLabel}</ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.threshold}
            onChange={handleThresholdSlider}
            min={0}
            max={255}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={thresholdLabel}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.threshold}
            onChange={(e) => handleThresholdInput(e.target.value)}
            slotProps={{ htmlInput: { min: 0, max: 255, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Padding */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.trimParams.padding')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.padding}
            onChange={handlePaddingSlider}
            min={0}
            max={200}
            step={5}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.trimParams.padding')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.padding}
            onChange={(e) => handlePaddingInput(e.target.value)}
            slotProps={{ htmlInput: { min: 0, max: 200, step: 5 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>
    </Stack>
  );
};
