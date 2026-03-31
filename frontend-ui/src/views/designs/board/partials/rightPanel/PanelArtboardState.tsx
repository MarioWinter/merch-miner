import { useCallback, useState } from 'react';
import {
  Box,
  Divider,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { SelectChangeEvent } from '@mui/material/Select';
import { useTranslation } from 'react-i18next';
import type { ArtboardData } from '../../types';
import { ARTBOARD_PRESETS } from '../../types';
import ToolsSection from './ToolsSection';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const Section = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  marginBottom: theme.spacing(1.5),
}));

const FieldRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
}));

const FieldLabel = styled(Typography)({
  width: 32,
  flexShrink: 0,
});

const SwitchRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(0.5, 0),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PanelArtboardStateProps {
  artboard: ArtboardData;
  isAiBoard: boolean;
  onUpdate: (id: string, patch: Partial<ArtboardData>) => void;
  onResize: (id: string, width: number, height: number) => void;
  onRegenerate: () => void;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const findPresetIndex = (w: number, h: number): string => {
  const idx = ARTBOARD_PRESETS.findIndex(
    (p) => p.width === w && p.height === h,
  );
  return idx >= 0 ? String(idx) : String(ARTBOARD_PRESETS.length - 1);
};

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const PanelArtboardState = ({
  artboard,
  isAiBoard,
  onUpdate,
  onResize,
  onRegenerate,
}: PanelArtboardStateProps) => {
  const { t } = useTranslation();
  const [localWidth, setLocalWidth] = useState(String(artboard.width));
  const [localHeight, setLocalHeight] = useState(String(artboard.height));

  const presetValue = findPresetIndex(artboard.width, artboard.height);

  const handlePresetChange = useCallback(
    (e: SelectChangeEvent<string>) => {
      const idx = Number(e.target.value);
      const preset = ARTBOARD_PRESETS[idx];
      if (!preset || preset.width === 0) return; // Custom — no auto-resize
      setLocalWidth(String(preset.width));
      setLocalHeight(String(preset.height));
      onResize(artboard.id, preset.width, preset.height);
    },
    [artboard.id, onResize],
  );

  const commitSize = useCallback(() => {
    const w = Math.max(1, Number(localWidth) || artboard.width);
    const h = Math.max(1, Number(localHeight) || artboard.height);
    setLocalWidth(String(w));
    setLocalHeight(String(h));
    onResize(artboard.id, w, h);
  }, [artboard.id, artboard.width, artboard.height, localWidth, localHeight, onResize]);

  const handleOpacityChange = useCallback(
    (_: Event, value: number | number[]) => {
      const opacity = Array.isArray(value) ? value[0] : value;
      onUpdate(artboard.id, { opacity });
    },
    [artboard.id, onUpdate],
  );

  const handleBgColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onUpdate(artboard.id, { backgroundColor: e.target.value });
    },
    [artboard.id, onUpdate],
  );

  const handleClipToggle = useCallback(
    (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      onUpdate(artboard.id, { clipContent: checked });
    },
    [artboard.id, onUpdate],
  );

  return (
    <Box>
      {/* Artboard Size */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.panel.size', 'Size')}
        </SectionLabel>

        {/* Preset selector */}
        <Select
          size="small"
          fullWidth
          value={presetValue}
          onChange={handlePresetChange}
          sx={{ mb: 1.5 }}
        >
          {ARTBOARD_PRESETS.map((preset, idx) => (
            <MenuItem key={preset.label} value={String(idx)}>
              {preset.label}
              {preset.width > 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 1 }}
                >
                  {preset.width}x{preset.height}
                </Typography>
              )}
            </MenuItem>
          ))}
        </Select>

        {/* Width / Height fields */}
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            W
          </FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={localWidth}
            onChange={(e) => setLocalWidth(e.target.value)}
            onBlur={commitSize}
            onKeyDown={(e) => e.key === 'Enter' && commitSize()}
            slotProps={{ htmlInput: { min: 1 } }}
          />
        </FieldRow>
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            H
          </FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={localHeight}
            onChange={(e) => setLocalHeight(e.target.value)}
            onBlur={commitSize}
            onKeyDown={(e) => e.key === 'Enter' && commitSize()}
            slotProps={{ htmlInput: { min: 1 } }}
          />
        </FieldRow>
      </Section>

      <Divider />

      {/* Layer — opacity */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.panel.layer', 'Layer')}
        </SectionLabel>
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            {t('design.panel.opacity', 'Op')}
          </FieldLabel>
          <Slider
            size="small"
            min={0}
            max={100}
            value={artboard.opacity}
            onChange={handleOpacityChange}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `${v}%`}
            aria-label={t('design.panel.opacityLabel', 'Opacity')}
          />
          <Typography variant="caption" sx={{ width: 36, textAlign: 'right' }}>
            {artboard.opacity}%
          </Typography>
        </FieldRow>
      </Section>

      <Divider />

      {/* Color */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.panel.color', 'Color')}
        </SectionLabel>
        <FieldRow>
          <Box
            component="input"
            type="color"
            value={artboard.backgroundColor}
            onChange={handleBgColorChange}
            aria-label={t('design.panel.bgColor', 'Background color')}
            sx={{
              width: 28,
              height: 28,
              padding: 0,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '6px',
              cursor: 'pointer',
              backgroundColor: 'transparent',
            }}
          />
          <TextField
            size="small"
            fullWidth
            value={artboard.backgroundColor}
            onChange={(e) =>
              onUpdate(artboard.id, {
                backgroundColor: e.target.value,
              })
            }
            slotProps={{
              htmlInput: { maxLength: 7 },
            }}
          />
        </FieldRow>
      </Section>

      <Divider />

      {/* Clip content */}
      <Section>
        <SwitchRow>
          <Typography variant="body2">
            {t('design.panel.clipContent', 'Clip Content')}
          </Typography>
          <Switch
            size="small"
            checked={artboard.clipContent}
            onChange={handleClipToggle}
            inputProps={{
              'aria-label': t('design.panel.clipContent', 'Clip Content'),
            }}
          />
        </SwitchRow>
      </Section>

      <Divider />

      {/* Tools */}
      <ToolsSection
        showRegenerate={isAiBoard}
        onRegenerate={onRegenerate}
      />
    </Box>
  );
};

export default PanelArtboardState;
