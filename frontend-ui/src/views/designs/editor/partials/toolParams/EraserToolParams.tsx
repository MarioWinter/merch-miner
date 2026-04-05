import { Stack, Slider, TextField, Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { DEFAULT_ERASER_PARAMS } from '../../utils/imageProcessing';
import type { EraserParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface EraserToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): EraserParams => ({
  size: (params.size as number) ?? DEFAULT_ERASER_PARAMS.size,
  hardness: (params.hardness as number) ?? DEFAULT_ERASER_PARAMS.hardness,
});

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ParamLabel = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 2,
});

const SliderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const EraserToolParams = ({
  params,
  onChange,
  disabled,
}: EraserToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<EraserParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleSizeSlider = (_: Event, value: number | number[]) => {
    update({ size: value as number });
  };

  const handleSizeInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(1, Math.min(100, Number(e.target.value) || 1));
    update({ size: num });
  };

  const handleHardnessSlider = (_: Event, value: number | number[]) => {
    update({ hardness: value as number });
  };

  const handleHardnessInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    update({ hardness: num });
  };

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Brush Size */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.eraserParams.size')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.size}
            onChange={handleSizeSlider}
            min={1}
            max={100}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.eraserParams.size')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.size}
            onChange={handleSizeInput}
            slotProps={{ htmlInput: { min: 1, max: 100, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Hardness */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.eraserParams.hardness')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.hardness}
            onChange={handleHardnessSlider}
            min={0}
            max={100}
            step={5}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.eraserParams.hardness')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.hardness}
            onChange={handleHardnessInput}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 5 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>
    </Stack>
  );
};
