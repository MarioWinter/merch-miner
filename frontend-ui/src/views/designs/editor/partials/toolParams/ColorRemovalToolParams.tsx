import { useState } from 'react';
import {
  Stack,
  Slider,
  TextField,
  Switch,
  Box,
  Typography,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import HdIcon from '@mui/icons-material/Hd';
import { DEFAULT_COLOR_REMOVAL_PARAMS, DEFAULT_COLOR_TARGET } from '../../utils/imageProcessing';
import type { ColorRemovalParams, ColorTarget } from '../../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface ColorRemovalToolParamsProps {
  params: Record<string, unknown>;
  onChange: (params: Record<string, unknown>) => void;
  disabled?: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const resolveParams = (params: Record<string, unknown>): ColorRemovalParams => ({
  mode: (params.mode as ColorRemovalParams['mode']) ?? DEFAULT_COLOR_REMOVAL_PARAMS.mode,
  targetColor: (params.targetColor as string) ?? DEFAULT_COLOR_REMOVAL_PARAMS.targetColor,
  tolerance: (params.tolerance as number) ?? DEFAULT_COLOR_REMOVAL_PARAMS.tolerance,
  softEdge: (params.softEdge as boolean) ?? DEFAULT_COLOR_REMOVAL_PARAMS.softEdge,
  contiguous: (params.contiguous as boolean) ?? DEFAULT_COLOR_REMOVAL_PARAMS.contiguous,
  fillHoles: (params.fillHoles as boolean) ?? DEFAULT_COLOR_REMOVAL_PARAMS.fillHoles,
  edgeTrim: (params.edgeTrim as number) ?? DEFAULT_COLOR_REMOVAL_PARAMS.edgeTrim,
  edgeFeather: (params.edgeFeather as number) ?? DEFAULT_COLOR_REMOVAL_PARAMS.edgeFeather,
  colors: (params.colors as ColorTarget[]) ?? DEFAULT_COLOR_REMOVAL_PARAMS.colors,
  hdMode: (params.hdMode as ColorRemovalParams['hdMode']) ?? DEFAULT_COLOR_REMOVAL_PARAMS.hdMode,
});

const MAX_COLORS = 3;

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

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  color: theme.vars.palette.text.disabled,
  marginTop: 4,
}));

const SwitchRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const ColorTabChip = styled(Chip, {
  shouldForwardProp: (p) => p !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  height: 24,
  fontSize: 10,
  fontWeight: 600,
  borderRadius: 6,
  ...($active && {
    backgroundColor: theme.vars.palette.primary.main,
    color: theme.vars.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.vars.palette.primary.dark,
    },
  }),
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const ColorRemovalToolParams = ({
  params,
  onChange,
  disabled,
}: ColorRemovalToolParamsProps) => {
  const { t } = useTranslation();
  const resolved = resolveParams(params);
  const [activeColorIdx, setActiveColorIdx] = useState(0);

  const colors = resolved.colors.length > 0 ? resolved.colors : [{ ...DEFAULT_COLOR_TARGET }];
  const activeColor = colors[Math.min(activeColorIdx, colors.length - 1)];

  const update = (patch: Partial<ColorRemovalParams>) => {
    onChange({ ...resolved, ...patch });
  };

  const updateColor = (idx: number, patch: Partial<ColorTarget>) => {
    const next = colors.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    update({ colors: next });
  };

  const addColor = () => {
    if (colors.length >= MAX_COLORS) return;
    const newColors = [...colors, { ...DEFAULT_COLOR_TARGET, targetColor: '#000000' }];
    update({ colors: newColors, mode: 'manual' });
    setActiveColorIdx(newColors.length - 1);
  };

  const removeColor = (idx: number) => {
    if (colors.length <= 1) return;
    const next = colors.filter((_, i) => i !== idx);
    update({ colors: next });
    setActiveColorIdx(Math.min(activeColorIdx, next.length - 1));
  };

  const handleColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateColor(activeColorIdx, { targetColor: e.target.value.toUpperCase() });
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    let val = e.target.value.toUpperCase();
    if (!val.startsWith('#')) val = '#' + val;
    const clean = val.replace('#', '');
    if (/^[0-9A-F]{0,6}$/.test(clean)) {
      updateColor(activeColorIdx, { targetColor: val });
    }
  };

  const handleToleranceSlider = (_: Event, value: number | number[]) => {
    updateColor(activeColorIdx, { tolerance: value as number });
  };

  const handleToleranceInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const num = Math.max(0, Math.min(100, Number(e.target.value) || 0));
    updateColor(activeColorIdx, { tolerance: num });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_COLOR_REMOVAL_PARAMS });
    setActiveColorIdx(0);
  };

  const isDefault =
    resolved.mode === DEFAULT_COLOR_REMOVAL_PARAMS.mode &&
    resolved.contiguous === DEFAULT_COLOR_REMOVAL_PARAMS.contiguous &&
    resolved.fillHoles === DEFAULT_COLOR_REMOVAL_PARAMS.fillHoles &&
    resolved.edgeTrim === DEFAULT_COLOR_REMOVAL_PARAMS.edgeTrim &&
    resolved.edgeFeather === DEFAULT_COLOR_REMOVAL_PARAMS.edgeFeather &&
    resolved.hdMode === DEFAULT_COLOR_REMOVAL_PARAMS.hdMode &&
    colors.length === 1 &&
    colors[0].targetColor === DEFAULT_COLOR_TARGET.targetColor &&
    colors[0].tolerance === DEFAULT_COLOR_TARGET.tolerance &&
    colors[0].softEdge === DEFAULT_COLOR_TARGET.softEdge;

  return (
    <Stack
      spacing={1.5}
      sx={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
    >
      {/* Mode Toggle: Auto / Manual */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.colorRemovalParams.mode')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.mode}
          exclusive
          size="small"
          onChange={(_, value) => { if (value) update({ mode: value }); }}
          aria-label={t('design.tools.colorRemovalParams.mode')}
          sx={{ width: '100%' }}
        >
          <ToggleButton value="auto" sx={{ flex: 1, fontSize: 11, gap: 0.5 }}>
            <AutoFixHighIcon sx={{ fontSize: 14 }} />
            {t('design.tools.colorRemovalParams.auto')}
          </ToggleButton>
          <ToggleButton value="manual" sx={{ flex: 1, fontSize: 11, gap: 0.5 }}>
            <EditIcon sx={{ fontSize: 14 }} />
            {t('design.tools.colorRemovalParams.manual')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Multi-Color Tabs */}
      <Box>
        <SectionLabel>{t('design.tools.colorRemovalParams.colorsSection')}</SectionLabel>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
          {colors.map((c, idx) => (
            <ColorTabChip
              key={idx}
              $active={activeColorIdx === idx}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: c.targetColor.length === 7 ? c.targetColor : '#FFF',
                      border: '1px solid rgba(255,255,255,0.3)',
                      flexShrink: 0,
                    }}
                  />
                  {t('design.tools.colorRemovalParams.colorN', { n: idx + 1 })}
                </Box>
              }
              onClick={() => setActiveColorIdx(idx)}
              onDelete={colors.length > 1 ? () => removeColor(idx) : undefined}
              deleteIcon={<CloseIcon sx={{ fontSize: '12px !important' }} />}
              size="small"
              variant={activeColorIdx === idx ? 'filled' : 'outlined'}
            />
          ))}
          {colors.length < MAX_COLORS && (
            <Tooltip title={t('design.tools.colorRemovalParams.addColor')}>
              <IconButton size="small" onClick={addColor} sx={{ width: 24, height: 24 }}>
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Target Color — auto mode shows hint (only for first color), manual shows picker */}
      {resolved.mode === 'auto' && activeColorIdx === 0 ? (
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
          {t('design.tools.colorRemovalParams.autoDetectHint')}
        </Typography>
      ) : (
        <Box>
          <ParamLabel color="text.secondary">
            {t('design.tools.colorRemovalParams.targetColor')}
          </ParamLabel>
          <SliderRow>
            <ColorSwatch
              type="color"
              value={activeColor.targetColor.length === 7 ? activeColor.targetColor : '#FFFFFF'}
              onChange={handleColorPicker}
              aria-label={t('design.tools.colorRemovalParams.targetColor')}
            />
            <TextField
              size="small"
              value={activeColor.targetColor}
              onChange={handleHexInput}
              slotProps={{ htmlInput: { maxLength: 7 } }}
              sx={{ width: 90 }}
            />
          </SliderRow>
        </Box>
      )}

      {/* Tolerance (per-color) */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.colorRemovalParams.tolerance')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={activeColor.tolerance}
            onChange={handleToleranceSlider}
            min={0}
            max={100}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.colorRemovalParams.tolerance')}
          />
          <TextField
            type="number"
            size="small"
            value={activeColor.tolerance}
            onChange={handleToleranceInput}
            slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
            sx={{ width: 64 }}
          />
        </SliderRow>
      </Box>

      {/* Soft Edge (per-color) */}
      <SwitchRow>
        <Box>
          <ParamLabel color="text.secondary" sx={{ mb: 0 }}>
            {t('design.tools.colorRemovalParams.softEdge')}
          </ParamLabel>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {t('design.tools.colorRemovalParams.softEdgeHint')}
          </Typography>
        </Box>
        <Switch
          size="small"
          checked={activeColor.softEdge}
          onChange={(_, checked) => updateColor(activeColorIdx, { softEdge: checked })}
          aria-label={t('design.tools.colorRemovalParams.softEdge')}
        />
      </SwitchRow>

      {/* Contiguous (shared) */}
      <SwitchRow>
        <Box>
          <ParamLabel color="text.secondary" sx={{ mb: 0 }}>
            {t('design.tools.colorRemovalParams.contiguous')}
          </ParamLabel>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {t('design.tools.colorRemovalParams.contiguousHint')}
          </Typography>
        </Box>
        <Switch
          size="small"
          checked={resolved.contiguous}
          onChange={(_, checked) => update({ contiguous: checked })}
          aria-label={t('design.tools.colorRemovalParams.contiguous')}
        />
      </SwitchRow>

      {/* Deep Clean / Fill Holes (shared) */}
      <SwitchRow>
        <Box>
          <ParamLabel color="text.secondary" sx={{ mb: 0 }}>
            {resolved.contiguous
              ? t('design.tools.colorRemovalParams.deepClean')
              : t('design.tools.colorRemovalParams.fillHoles')}
          </ParamLabel>
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
            {resolved.contiguous
              ? t('design.tools.colorRemovalParams.deepCleanHint')
              : t('design.tools.colorRemovalParams.fillHolesHint')}
          </Typography>
        </Box>
        <Switch
          size="small"
          checked={resolved.fillHoles}
          onChange={(_, checked) => update({ fillHoles: checked })}
          aria-label={resolved.contiguous
            ? t('design.tools.colorRemovalParams.deepClean')
            : t('design.tools.colorRemovalParams.fillHoles')}
        />
      </SwitchRow>

      {/* HD Mode (shared) */}
      <Box>
        <ParamLabel color="text.secondary">
          <HdIcon sx={{ fontSize: 14 }} />
          {t('design.tools.colorRemovalParams.hdMode')}
        </ParamLabel>
        <ToggleButtonGroup
          value={resolved.hdMode}
          exclusive
          size="small"
          onChange={(_, value) => { if (value) update({ hdMode: value }); }}
          aria-label={t('design.tools.colorRemovalParams.hdMode')}
          sx={{ width: '100%' }}
        >
          <ToggleButton value="auto" sx={{ flex: 1, fontSize: 11 }}>
            {t('design.tools.colorRemovalParams.auto')}
          </ToggleButton>
          <ToggleButton value="on" sx={{ flex: 1, fontSize: 11 }}>
            {t('design.tools.colorRemovalParams.hdOn')}
          </ToggleButton>
          <ToggleButton value="off" sx={{ flex: 1, fontSize: 11 }}>
            {t('design.tools.colorRemovalParams.hdOff')}
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, mt: 0.5, display: 'block' }}>
          {t('design.tools.colorRemovalParams.hdHint')}
        </Typography>
      </Box>

      {/* Edge Refinement Section (shared) */}
      <SectionLabel>
        {t('design.tools.colorRemovalParams.edgeRefinement')}
      </SectionLabel>

      {/* Edge Trim */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.colorRemovalParams.edgeTrim')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.edgeTrim}
            onChange={(_, v) => update({ edgeTrim: v as number })}
            min={0}
            max={10}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.colorRemovalParams.edgeTrim')}
          />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 30 }}>
            {resolved.edgeTrim}px
          </Typography>
        </SliderRow>
      </Box>

      {/* Edge Feather */}
      <Box>
        <ParamLabel color="text.secondary">
          {t('design.tools.colorRemovalParams.edgeFeather')}
        </ParamLabel>
        <SliderRow>
          <Slider
            value={resolved.edgeFeather}
            onChange={(_, v) => update({ edgeFeather: v as number })}
            min={0}
            max={10}
            step={1}
            size="small"
            sx={{ flex: 1 }}
            aria-label={t('design.tools.colorRemovalParams.edgeFeather')}
          />
          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 30 }}>
            {resolved.edgeFeather}px
          </Typography>
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
