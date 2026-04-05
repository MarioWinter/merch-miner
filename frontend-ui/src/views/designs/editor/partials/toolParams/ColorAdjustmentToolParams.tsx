import { Stack, Slider, TextField, Button, Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import BrightnessHighIcon from '@mui/icons-material/BrightnessHigh';
import ContrastIcon from '@mui/icons-material/Contrast';
import ColorLensIcon from '@mui/icons-material/ColorLens';
import PaletteIcon from '@mui/icons-material/Palette';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_COLOR_ADJUSTMENT_PARAMS } from '../../utils/imageProcessing';
import type { ColorAdjustmentParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface ColorAdjustmentToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): ColorAdjustmentParams => ({
  brightness: (params.brightness as number) ?? DEFAULT_COLOR_ADJUSTMENT_PARAMS.brightness,
  contrast: (params.contrast as number) ?? DEFAULT_COLOR_ADJUSTMENT_PARAMS.contrast,
  saturation: (params.saturation as number) ?? DEFAULT_COLOR_ADJUSTMENT_PARAMS.saturation,
  hueShift: (params.hueShift as number) ?? DEFAULT_COLOR_ADJUSTMENT_PARAMS.hueShift,
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
// Slider config
// -----------------------------------------------------------------

interface SliderConfig {
  key: keyof ColorAdjustmentParams;
  labelKey: string;
  icon: React.ReactNode;
  min: number;
  max: number;
  step: number;
}

const ICON_SX = { fontSize: 14 } as const;

const SLIDERS: SliderConfig[] = [
  {
    key: 'brightness',
    labelKey: 'design.tools.colorAdjustmentParams.brightness',
    icon: <BrightnessHighIcon sx={ICON_SX} />,
    min: -100,
    max: 100,
    step: 1,
  },
  {
    key: 'contrast',
    labelKey: 'design.tools.colorAdjustmentParams.contrast',
    icon: <ContrastIcon sx={ICON_SX} />,
    min: -100,
    max: 100,
    step: 1,
  },
  {
    key: 'saturation',
    labelKey: 'design.tools.colorAdjustmentParams.saturation',
    icon: <ColorLensIcon sx={ICON_SX} />,
    min: -100,
    max: 100,
    step: 1,
  },
  {
    key: 'hueShift',
    labelKey: 'design.tools.colorAdjustmentParams.hueShift',
    icon: <PaletteIcon sx={ICON_SX} />,
    min: 0,
    max: 360,
    step: 1,
  },
];

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const ColorAdjustmentToolParams = ({
  params,
  onChange,
  disabled,
}: ColorAdjustmentToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<ColorAdjustmentParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleSlider = (key: keyof ColorAdjustmentParams) =>
    (_: Event, value: number | number[]) => {
      update({ [key]: value as number });
    };

  const handleInput = (key: keyof ColorAdjustmentParams, min: number, max: number) =>
    (raw: string) => {
      const num = Math.max(min, Math.min(max, Number(raw) || 0));
      update({ [key]: num });
    };

  const handleReset = () => {
    onChange({ ...DEFAULT_COLOR_ADJUSTMENT_PARAMS });
  };

  const isDefault =
    resolved.brightness === 0 &&
    resolved.contrast === 0 &&
    resolved.saturation === 0 &&
    resolved.hueShift === 0;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {SLIDERS.map(({ key, labelKey, icon, min, max, step }) => (
        <Box key={key}>
          <ParamLabel color="text.secondary">
            {icon}
            {t(labelKey)}
          </ParamLabel>
          <SliderRow>
            <Slider
              value={resolved[key]}
              onChange={handleSlider(key)}
              min={min}
              max={max}
              step={step}
              size="small"
              sx={{ flex: 1 }}
              aria-label={t(labelKey)}
            />
            <TextField
              type="number"
              size="small"
              value={resolved[key]}
              onChange={(e) => handleInput(key, min, max)(e.target.value)}
              slotProps={{ htmlInput: { min, max, step } }}
              sx={{ width: 64 }}
            />
          </SliderRow>
        </Box>
      ))}

      {/* Reset All */}
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
