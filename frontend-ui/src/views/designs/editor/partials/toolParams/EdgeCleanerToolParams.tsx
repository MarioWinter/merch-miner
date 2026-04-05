import { Stack, Slider, TextField, Typography, Box, Button, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_EDGE_CLEANER_PARAMS } from '../../utils/imageProcessing';
import type { EdgeCleanerParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface EdgeCleanerToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): EdgeCleanerParams => ({
  passes: (params.passes as number) ?? DEFAULT_EDGE_CLEANER_PARAMS.passes,
  alphaThreshold:
    (params.alphaThreshold as number) ?? DEFAULT_EDGE_CLEANER_PARAMS.alphaThreshold,
  strength: (params.strength as number) ?? DEFAULT_EDGE_CLEANER_PARAMS.strength,
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

export const EdgeCleanerToolParams = ({
  params,
  onChange,
  disabled,
}: EdgeCleanerToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<EdgeCleanerParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handlePassesSlider = (_: Event, value: number | number[]) => {
    update({ passes: value as number });
  };

  const handlePassesInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(1, Math.min(5, Number(e.target.value) || 1));
    update({ passes: num });
  };

  const handleStrengthSlider = (_: Event, value: number | number[]) => {
    update({ strength: value as number });
  };

  const handleStrengthInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    update({ strength: num });
  };

  const handleAlphaSlider = (_: Event, value: number | number[]) => {
    update({ alphaThreshold: value as number });
  };

  const handleAlphaInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(255, Number(e.target.value) || 0));
    update({ alphaThreshold: num });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_EDGE_CLEANER_PARAMS });
  };

  const isDefault =
    resolved.passes === DEFAULT_EDGE_CLEANER_PARAMS.passes &&
    resolved.strength === DEFAULT_EDGE_CLEANER_PARAMS.strength &&
    resolved.alphaThreshold === DEFAULT_EDGE_CLEANER_PARAMS.alphaThreshold;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Passes */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.edgeCleanerParams.passes')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.passes}
            onChange={handlePassesSlider}
            min={1}
            max={5}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.edgeCleanerParams.passes')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.passes}
            onChange={handlePassesInput}
            slotProps={{ htmlInput: { min: 1, max: 5, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Strength */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.edgeCleanerParams.strength')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.strength}
            onChange={handleStrengthSlider}
            min={0}
            max={100}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.edgeCleanerParams.strength')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.strength}
            onChange={handleStrengthInput}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Alpha Threshold */}
      <Box>
        <Tooltip
          title={t('design.tools.edgeCleanerParams.alphaThresholdHint')}
          placement="top"
        >
          <ParamLabel color="text.secondary">
            {t('design.tools.edgeCleanerParams.alphaThreshold')}
          </ParamLabel>
        </Tooltip>
        <SliderRow>
          <Slider
            value={resolved.alphaThreshold}
            onChange={handleAlphaSlider}
            min={0}
            max={255}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.edgeCleanerParams.alphaThreshold')}
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
