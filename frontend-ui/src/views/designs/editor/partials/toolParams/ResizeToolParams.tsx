import { useState } from 'react';
import {
  Stack,
  TextField,
  Switch,
  Slider,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  FormControlLabel,
  Box,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignHorizontalCenterIcon from '@mui/icons-material/AlignHorizontalCenter';
import AlignHorizontalRightIcon from '@mui/icons-material/AlignHorizontalRight';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import TuneIcon from '@mui/icons-material/Tune';
import { TShirtIcon } from '@/views/amazon/research/partials/ProductTypeIcons';
import { DEFAULT_RESIZE_PARAMS } from '../../utils/imageProcessing';
import type { ResizeParams } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

type SizePreset = 'pod' | 'square' | 'custom';

interface ResizeToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveResizeParams = (params: Record<string, unknown>): ResizeParams => ({
  targetWidth: (params.targetWidth as number) ?? DEFAULT_RESIZE_PARAMS.targetWidth,
  targetHeight: (params.targetHeight as number) ?? DEFAULT_RESIZE_PARAMS.targetHeight,
  alignY: (params.alignY as ResizeParams['alignY']) ?? DEFAULT_RESIZE_PARAMS.alignY,
  alignX: (params.alignX as ResizeParams['alignX']) ?? DEFAULT_RESIZE_PARAMS.alignX,
  paddingPx: (params.paddingPx as number) ?? DEFAULT_RESIZE_PARAMS.paddingPx,
  bgColor: (params.bgColor as string) ?? DEFAULT_RESIZE_PARAMS.bgColor,
  maintainAspectRatio: (params.maintainAspectRatio as boolean) ?? DEFAULT_RESIZE_PARAMS.maintainAspectRatio,
});

const detectPreset = (w: number, h: number): SizePreset => {
  if (w === 4500 && h === 5400) return 'pod';
  if (w === 4500 && h === 4500) return 'square';
  return 'custom';
};

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ParamLabel = styled(Typography)({
  fontSize: 11,
  fontWeight: 500,
  marginBottom: 2,
});

const PresetToggleButton = styled(ToggleButton)({
  padding: '6px 12px',
});

const IconToggleButton = styled(ToggleButton)({
  padding: '4px 6px',
});

const ColorSwatch = styled(Box, {
  shouldForwardProp: (p) => p !== '$color',
})<{ $color: string }>(({ theme, $color }) => ({
  width: 20,
  height: 20,
  borderRadius: 4,
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: $color === 'transparent'
    ? 'transparent'
    : $color,
  backgroundImage: $color === 'transparent'
    ? 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 0 0 / 8px 8px'
    : 'none',
  flexShrink: 0,
}));

const SliderRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const ResizeToolParams = ({ params, onChange, disabled }: ResizeToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveResizeParams(params);
  const [userSetCustom, setUserSetCustom] = useState(false);
  const detectedPreset = detectPreset(resolved.targetWidth, resolved.targetHeight);
  const preset: SizePreset = userSetCustom && detectedPreset !== 'pod' && detectedPreset !== 'square'
    ? 'custom'
    : detectedPreset;
  const isTransparent = resolved.bgColor === 'transparent';

  const update = (patch: Partial<ResizeParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const handlePresetChange = (_: React.MouseEvent<HTMLElement>, value: SizePreset | null) => {
    if (!value) return;
    if (value === 'pod') {
      setUserSetCustom(false);
      update({ targetWidth: 4500, targetHeight: 5400 });
    } else if (value === 'square') {
      setUserSetCustom(false);
      update({ targetWidth: 4500, targetHeight: 4500 });
    } else {
      setUserSetCustom(true);
    }
  };

  const handleNumberChange = (field: 'targetWidth' | 'targetHeight', raw: string) => {
    const num = Math.max(1, Math.min(10000, Number(raw) || 1));
    update({ [field]: num });
  };

  const handleAlignY = (_: React.MouseEvent<HTMLElement>, value: ResizeParams['alignY'] | null) => {
    if (value) update({ alignY: value });
  };

  const handleAlignX = (_: React.MouseEvent<HTMLElement>, value: ResizeParams['alignX'] | null) => {
    if (value) update({ alignX: value });
  };

  const handlePaddingSlider = (_: Event, value: number | number[]) => {
    update({ paddingPx: value as number });
  };

  const handlePaddingInput = (raw: string) => {
    const num = Math.max(0, Math.min(500, Number(raw) || 0));
    update({ paddingPx: num });
  };

  const handleTransparentToggle = (checked: boolean) => {
    update({ bgColor: checked ? 'transparent' : '#ffffff' });
  };

  return (
    <Stack spacing={1.5} sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      {/* Preset selector */}
      <Box>
        <ParamLabel color="text.secondary">{t('design.tools.resizeParams.sizePreset')}</ParamLabel>
        <ToggleButtonGroup
          value={preset}
          exclusive
          onChange={handlePresetChange}
          size="small"
          fullWidth
          aria-label="size preset"
        >
          <Tooltip title={t('design.tools.resizeParams.presetPod')} arrow>
            <PresetToggleButton value="pod" aria-label={t('design.tools.resizeParams.presetPod')}>
              <TShirtIcon sx={{ fontSize: 18 }} />
            </PresetToggleButton>
          </Tooltip>
          <Tooltip title={t('design.tools.resizeParams.presetSquare')} arrow>
            <PresetToggleButton value="square" aria-label={t('design.tools.resizeParams.presetSquare')}>
              <CropSquareIcon sx={{ fontSize: 18 }} />
            </PresetToggleButton>
          </Tooltip>
          <Tooltip title={t('design.tools.resizeParams.presetCustom')} arrow>
            <PresetToggleButton value="custom" aria-label={t('design.tools.resizeParams.presetCustom')}>
              <TuneIcon sx={{ fontSize: 18 }} />
            </PresetToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Box>

      {/* Width / Height */}
      <Stack direction="row" spacing={1}>
        <TextField
          label={t('design.tools.resizeParams.targetWidth')}
          type="number"
          size="small"
          value={resolved.targetWidth}
          onChange={(e) => handleNumberChange('targetWidth', e.target.value)}
          disabled={preset !== 'custom'}
          slotProps={{ htmlInput: { min: 1, max: 10000 } }}
          fullWidth
        />
        <TextField
          label={t('design.tools.resizeParams.targetHeight')}
          type="number"
          size="small"
          value={resolved.targetHeight}
          onChange={(e) => handleNumberChange('targetHeight', e.target.value)}
          disabled={preset !== 'custom'}
          slotProps={{ htmlInput: { min: 1, max: 10000 } }}
          fullWidth
        />
      </Stack>

      {/* Maintain aspect ratio */}
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={resolved.maintainAspectRatio}
            onChange={(_, checked) => update({ maintainAspectRatio: checked })}
          />
        }
        label={
          <Typography variant="caption">
            {t('design.tools.resizeParams.maintainAspectRatio')}
          </Typography>
        }
      />

      {/* Vertical Align */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.resizeParams.alignY')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.alignY}
          exclusive
          onChange={handleAlignY}
          size="small"
          aria-label={t('design.tools.resizeParams.alignY')}
        >
          <IconToggleButton value="top" aria-label={t('design.tools.resizeParams.top')}>
            <VerticalAlignTopIcon sx={{ fontSize: 18 }} />
          </IconToggleButton>
          <IconToggleButton value="center" aria-label={t('design.tools.resizeParams.center')}>
            <VerticalAlignCenterIcon sx={{ fontSize: 18 }} />
          </IconToggleButton>
          <IconToggleButton value="bottom" aria-label={t('design.tools.resizeParams.bottom')}>
            <VerticalAlignBottomIcon sx={{ fontSize: 18 }} />
          </IconToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Horizontal Align */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.resizeParams.alignX')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.alignX}
          exclusive
          onChange={handleAlignX}
          size="small"
          aria-label={t('design.tools.resizeParams.alignX')}
        >
          <IconToggleButton value="left" aria-label={t('design.tools.resizeParams.left')}>
            <AlignHorizontalLeftIcon sx={{ fontSize: 18 }} />
          </IconToggleButton>
          <IconToggleButton value="center" aria-label={t('design.tools.resizeParams.center')}>
            <AlignHorizontalCenterIcon sx={{ fontSize: 18 }} />
          </IconToggleButton>
          <IconToggleButton value="right" aria-label={t('design.tools.resizeParams.right')}>
            <AlignHorizontalRightIcon sx={{ fontSize: 18 }} />
          </IconToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Padding */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.resizeParams.padding')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.paddingPx}
            onChange={handlePaddingSlider}
            min={0}
            max={500}
            step={10}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.resizeParams.padding')}
          />
          <TextField
            type="number"
            size="small"
            value={resolved.paddingPx}
            onChange={(e) => handlePaddingInput(e.target.value)}
            slotProps={{ htmlInput: { min: 0, max: 500, step: 10 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Background Fill */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.resizeParams.bgColor')}
        </ParamLabel>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ColorSwatch $color={resolved.bgColor} />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={isTransparent}
                onChange={(_, checked) => handleTransparentToggle(checked)}
              />
            }
            label={
              <Typography variant="caption">
                {t('design.tools.resizeParams.transparent')}
              </Typography>
            }
          />
        </Stack>
        {!isTransparent && (
          <TextField
            size="small"
            value={resolved.bgColor}
            onChange={(e) => update({ bgColor: e.target.value })}
            placeholder="#ffffff"
            fullWidth
            sx={{ mt: 0.5 }}
          />
        )}
      </Box>
    </Stack>
  );
};
