import {
  Stack,
  Slider,
  TextField,
  Switch,
  Typography,
  Box,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CasinoIcon from '@mui/icons-material/Casino';
import { DEFAULT_DISTRESS_PARAMS } from '../../utils/imageProcessing';
import type { DistressParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface DistressToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): DistressParams => ({
  intensity: (params.intensity as number) ?? DEFAULT_DISTRESS_PARAMS.intensity,
  grainAmount: (params.grainAmount as number) ?? DEFAULT_DISTRESS_PARAMS.grainAmount,
  scratches: (params.scratches as boolean) ?? DEFAULT_DISTRESS_PARAMS.scratches,
  edgeWear: (params.edgeWear as boolean) ?? DEFAULT_DISTRESS_PARAMS.edgeWear,
  seed: (params.seed as number) ?? DEFAULT_DISTRESS_PARAMS.seed,
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

const SwitchRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const DistressToolParams = ({
  params,
  onChange,
  disabled,
}: DistressToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<DistressParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleIntensitySlider = (_: Event, value: number | number[]) => {
    update({ intensity: value as number });
  };

  const handleIntensityInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    update({ intensity: num });
  };

  const handleGrainSlider = (_: Event, value: number | number[]) => {
    update({ grainAmount: value as number });
  };

  const handleGrainInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    update({ grainAmount: num });
  };

  const handleSeedInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Number(e.target.value) || 0);
    update({ seed: num });
  };

  const handleRandomizeSeed = () => {
    update({ seed: Math.floor(Math.random() * 100000) });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_DISTRESS_PARAMS });
  };

  const isDefault =
    resolved.intensity === DEFAULT_DISTRESS_PARAMS.intensity &&
    resolved.grainAmount === DEFAULT_DISTRESS_PARAMS.grainAmount &&
    resolved.scratches === DEFAULT_DISTRESS_PARAMS.scratches &&
    resolved.edgeWear === DEFAULT_DISTRESS_PARAMS.edgeWear &&
    resolved.seed === DEFAULT_DISTRESS_PARAMS.seed;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Intensity */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.distressParams.intensity')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.intensity}
            onChange={handleIntensitySlider}
            min={0}
            max={100}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.distressParams.intensity')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.intensity}
            onChange={handleIntensityInput}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Grain Amount */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.distressParams.grainAmount')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.grainAmount}
            onChange={handleGrainSlider}
            min={0}
            max={100}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.distressParams.grainAmount')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.grainAmount}
            onChange={handleGrainInput}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Scratches */}
      <SwitchRow>
        <ParamLabel color="text.secondary" sx={{ mb: 0 }}>
          {t('design.tools.distressParams.scratches')}
        </ParamLabel>
        <Switch
          size="small"
          checked={resolved.scratches}
          onChange={(_, checked) => update({ scratches: checked })}
          aria-label={t('design.tools.distressParams.scratches')}
        />
      </SwitchRow>

      {/* Edge Wear */}
      <SwitchRow>
        <ParamLabel color="text.secondary" sx={{ mb: 0 }}>
          {t('design.tools.distressParams.edgeWear')}
        </ParamLabel>
        <Switch
          size="small"
          checked={resolved.edgeWear}
          onChange={(_, checked) => update({ edgeWear: checked })}
          aria-label={t('design.tools.distressParams.edgeWear')}
        />
      </SwitchRow>

      {/* Seed */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.distressParams.seed')}
        </ParamLabel>
        <SliderRow>
          <TextField
            type="number"
            size="small"
            value={resolved.seed}
            onChange={handleSeedInput}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            sx={{ flex: 1 }}
          />
          <Tooltip title={t('design.tools.distressParams.randomize')}>
            <IconButton
              size="small"
              onClick={handleRandomizeSeed}
              aria-label={t('design.tools.distressParams.randomize')}
            >
              <CasinoIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
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
        {t('design.tools.distressParams.reset')}
      </Button>
    </Stack>
  );
};
