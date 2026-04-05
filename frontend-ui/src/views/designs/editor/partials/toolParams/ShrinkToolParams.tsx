import { Stack, Slider, TextField, Typography, Box, Button, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_SHRINK_PARAMS } from '../../utils/imageProcessing';
import type { ShrinkParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface ShrinkToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): ShrinkParams => ({
  amount: (params.amount as number) ?? DEFAULT_SHRINK_PARAMS.amount,
  alphaThreshold: (params.alphaThreshold as number) ?? DEFAULT_SHRINK_PARAMS.alphaThreshold,
});

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

export const ShrinkToolParams = ({ params, onChange, disabled }: ShrinkToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<ShrinkParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleAmountSlider = (_: Event, value: number | number[]) => {
    update({ amount: value as number });
  };

  const handleAmountInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(5, Number(e.target.value) || 0));
    update({ amount: num });
  };

  const handleAlphaSlider = (_: Event, value: number | number[]) => {
    update({ alphaThreshold: value as number });
  };

  const handleAlphaInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(255, Number(e.target.value) || 0));
    update({ alphaThreshold: num });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_SHRINK_PARAMS });
  };

  const isDefault =
    resolved.amount === DEFAULT_SHRINK_PARAMS.amount &&
    resolved.alphaThreshold === DEFAULT_SHRINK_PARAMS.alphaThreshold;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Shrink Amount */}
      <Box>
        <Tooltip title={t('design.tools.shrinkParams.amountHint')} placement="top">
          <ParamLabel color="text.secondary">
            {t('design.tools.shrinkParams.amount')}
          </ParamLabel>
        </Tooltip>
        <SliderRow>
          <Slider
            value={resolved.amount}
            onChange={handleAmountSlider}
            min={0}
            max={5}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.shrinkParams.amount')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.amount}
            onChange={handleAmountInput}
            slotProps={{ htmlInput: { min: 0, max: 5, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Alpha Threshold */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.shrinkParams.alphaThreshold')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.alphaThreshold}
            onChange={handleAlphaSlider}
            min={0}
            max={255}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.shrinkParams.alphaThreshold')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.alphaThreshold}
            onChange={handleAlphaInput}
            slotProps={{ htmlInput: { min: 0, max: 255, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

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
