import {
  Stack,
  Slider,
  TextField,
  Box,
  Typography,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { DEFAULT_WATERMARK_PARAMS } from '../../utils/imageProcessing';
import type { WatermarkParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface WatermarkToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): WatermarkParams => ({
  text: (params.text as string) ?? DEFAULT_WATERMARK_PARAMS.text,
  fontSize: (params.fontSize as number) ?? DEFAULT_WATERMARK_PARAMS.fontSize,
  fontFamily: (params.fontFamily as string) ?? DEFAULT_WATERMARK_PARAMS.fontFamily,
  color: (params.color as string) ?? DEFAULT_WATERMARK_PARAMS.color,
  opacity: (params.opacity as number) ?? DEFAULT_WATERMARK_PARAMS.opacity,
  position:
    (params.position as WatermarkParams['position']) ?? DEFAULT_WATERMARK_PARAMS.position,
  rotation: (params.rotation as number) ?? DEFAULT_WATERMARK_PARAMS.rotation,
  tileSpacing: (params.tileSpacing as number) ?? DEFAULT_WATERMARK_PARAMS.tileSpacing,
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

const ColorSwatch = styled('input')({
  width: 28,
  height: 28,
  padding: 0,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  '&::-webkit-color-swatch-wrapper': { padding: 0 },
  '&::-webkit-color-swatch': { border: 'none', borderRadius: 4 },
  '&::-moz-color-swatch': { border: 'none', borderRadius: 4 },
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const WatermarkToolParams = ({
  params,
  onChange,
  disabled,
}: WatermarkToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);

  const update = (patch: Partial<WatermarkParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handleColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    update({ color: e.target.value.toUpperCase() });
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let val = e.target.value.toUpperCase();
    if (!val.startsWith('#')) val = '#' + val;
    const clean = val.replace('#', '');
    if (/^[0-9A-F]{0,6}$/.test(clean)) {
      update({ color: val });
    }
  };

  const handleSlider =
    (field: keyof WatermarkParams) => (_: Event, value: number | number[]) => {
      update({ [field]: value as number });
    };

  const handleNumberInput =
    (field: keyof WatermarkParams, min: number, max: number) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const num = Math.max(min, Math.min(max, Number(e.target.value) || 0));
      update({ [field]: num });
    };

  const handleReset = () => {
    onChange({ ...DEFAULT_WATERMARK_PARAMS });
  };

  const isDefault =
    resolved.text === DEFAULT_WATERMARK_PARAMS.text &&
    resolved.fontSize === DEFAULT_WATERMARK_PARAMS.fontSize &&
    resolved.color === DEFAULT_WATERMARK_PARAMS.color &&
    resolved.opacity === DEFAULT_WATERMARK_PARAMS.opacity &&
    resolved.position === DEFAULT_WATERMARK_PARAMS.position &&
    resolved.rotation === DEFAULT_WATERMARK_PARAMS.rotation &&
    resolved.tileSpacing === DEFAULT_WATERMARK_PARAMS.tileSpacing;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Text */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.watermarkParams.text')}
        </ParamLabel>
        <TextField
          size="small"
          fullWidth
          value={resolved.text}
          onChange={(e) => update({ text: e.target.value })}
          placeholder={t('design.tools.watermarkParams.textPlaceholder')}
          aria-label={t('design.tools.watermarkParams.text')}
        />
      </Box>

      {/* Font Size */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.watermarkParams.fontSize')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.fontSize}
            onChange={handleSlider('fontSize')}
            min={12}
            max={200}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.watermarkParams.fontSize')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.fontSize}
            onChange={handleNumberInput('fontSize', 12, 200)}
            slotProps={{ htmlInput: { min: 12, max: 200, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Color */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.watermarkParams.color')}
        </ParamLabel>
        <SliderRow>
          <ColorSwatch
            type="color"
            value={resolved.color.length === 7 ? resolved.color : '#000000'}
            onChange={handleColorPicker}
            aria-label={t('design.tools.watermarkParams.color')}
          />
          <TextField
            size="small"
            value={resolved.color}
            onChange={handleHexInput}
            slotProps={{ htmlInput: { maxLength: 7 } }}
            sx={{ width: 90 }}
          />
        </SliderRow>
      </Box>

      {/* Opacity */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.watermarkParams.opacity')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.opacity}
            onChange={handleSlider('opacity')}
            min={0}
            max={100}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.watermarkParams.opacity')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.opacity}
            onChange={handleNumberInput('opacity', 0, 100)}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Position */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.watermarkParams.position')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.position}
          exclusive
          onChange={(_, val) => val && update({ position: val })}
          size="small"
          sx={{ flexWrap: 'wrap', gap: 0.5 }}
          aria-label={t('design.tools.watermarkParams.position')}
        >
          <ToggleButton value="center" sx={{ fontSize: 10, px: 1 }}>
            {t('design.tools.watermarkParams.posCenter')}
          </ToggleButton>
          <ToggleButton value="top-left" sx={{ fontSize: 10, px: 1 }}>
            {t('design.tools.watermarkParams.posTopLeft')}
          </ToggleButton>
          <ToggleButton value="top-right" sx={{ fontSize: 10, px: 1 }}>
            {t('design.tools.watermarkParams.posTopRight')}
          </ToggleButton>
          <ToggleButton value="bottom-left" sx={{ fontSize: 10, px: 1 }}>
            {t('design.tools.watermarkParams.posBottomLeft')}
          </ToggleButton>
          <ToggleButton value="bottom-right" sx={{ fontSize: 10, px: 1 }}>
            {t('design.tools.watermarkParams.posBottomRight')}
          </ToggleButton>
          <ToggleButton value="tile" sx={{ fontSize: 10, px: 1 }}>
            {t('design.tools.watermarkParams.posTile')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Rotation */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.watermarkParams.rotation')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.rotation}
            onChange={handleSlider('rotation')}
            min={-180}
            max={180}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.watermarkParams.rotation')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.rotation}
            onChange={handleNumberInput('rotation', -180, 180)}
            slotProps={{ htmlInput: { min: -180, max: 180, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Tile Spacing — only visible when position='tile' */}
      <Collapse in={resolved.position === 'tile'}>
        <Box>
          <ParamLabel color="text.secondary">
            {t('design.tools.watermarkParams.tileSpacing')}
          </ParamLabel>
          <SliderRow>
            <Slider
              value={resolved.tileSpacing}
              onChange={handleSlider('tileSpacing')}
              min={50}
              max={500}
              step={10}
              size="small"
              sx={{ flex: 1 }}
              aria-label={t('design.tools.watermarkParams.tileSpacing')}
            />
            <TextField
              type="number"
              size="small"
              value={resolved.tileSpacing}
              onChange={handleNumberInput('tileSpacing', 50, 500)}
              slotProps={{ htmlInput: { min: 50, max: 500, step: 10 } }}
              sx={{ width: 64 }}
            />
          </SliderRow>
        </Box>
      </Collapse>

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
