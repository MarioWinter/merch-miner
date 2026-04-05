import { useCallback, useState } from 'react';
import {
  Box,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { SelectChangeEvent } from '@mui/material/Select';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import { useTranslation } from 'react-i18next';
import type { ArtboardData, CanvasElement } from '../../types';
import { ARTBOARD_PRESETS } from '../../types';
import LayerPanel from './LayerPanel';

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
  onUpdate: (id: string, patch: Partial<ArtboardData>) => void;
  onResize: (id: string, width: number, height: number) => void;
  selectedElementId?: string | null;
  onSelectElement?: (artboardId: string, elementId: string) => void;
  onUpdateElement?: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
  onReorderElement?: (artboardId: string, elementId: string, newIndex: number) => void;
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
  onUpdate,
  onResize,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onReorderElement,
}: PanelArtboardStateProps) => {
  const { t } = useTranslation();
  const [editingWidth, setEditingWidth] = useState<string | null>(null);
  const [editingHeight, setEditingHeight] = useState<string | null>(null);
  const [lockAspect, setLockAspect] = useState(true);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);

  // Display rounded values from artboard, override with local edits while typing
  const displayWidth = editingWidth ?? String(Math.round(artboard.width));
  const displayHeight = editingHeight ?? String(Math.round(artboard.height));
  const displayLabel = editingLabel ?? artboard.label;

  const aspectRatio = artboard.width / artboard.height;
  const presetValue = findPresetIndex(artboard.width, artboard.height);

  const handlePresetChange = useCallback(
    (e: SelectChangeEvent<string>) => {
      const idx = Number(e.target.value);
      const preset = ARTBOARD_PRESETS[idx];
      if (!preset || preset.width === 0) return; // Custom — no auto-resize
      setEditingWidth(null);
      setEditingHeight(null);
      onResize(artboard.id, preset.width, preset.height);
    },
    [artboard.id, onResize],
  );

  const handleWidthChange = useCallback((value: string) => {
    setEditingWidth(value);
    if (lockAspect) {
      const w = Number(value);
      if (w > 0) setEditingHeight(String(Math.round(w / aspectRatio)));
    }
  }, [lockAspect, aspectRatio]);

  const handleHeightChange = useCallback((value: string) => {
    setEditingHeight(value);
    if (lockAspect) {
      const h = Number(value);
      if (h > 0) setEditingWidth(String(Math.round(h * aspectRatio)));
    }
  }, [lockAspect, aspectRatio]);

  const commitSize = useCallback(() => {
    const w = Math.max(1, Number(displayWidth) || artboard.width);
    const h = Math.max(1, Number(displayHeight) || artboard.height);
    setEditingWidth(null);
    setEditingHeight(null);
    onResize(artboard.id, w, h);
  }, [artboard.id, artboard.width, artboard.height, displayWidth, displayHeight, onResize]);

  const commitLabel = useCallback(() => {
    const trimmed = displayLabel.trim();
    if (trimmed && trimmed !== artboard.label) {
      onUpdate(artboard.id, { label: trimmed });
    }
    setEditingLabel(null);
  }, [artboard.id, artboard.label, displayLabel, onUpdate]);

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
      {/* Artboard Name */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.panel.name', 'Name')}
        </SectionLabel>
        <TextField
          size="small"
          fullWidth
          value={displayLabel}
          onChange={(e) => setEditingLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => e.key === 'Enter' && commitLabel()}
          placeholder={t('design.panel.namePlaceholder', 'Artboard name')}
        />
      </Section>

      <Divider />

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

        {/* Width / Height fields + aspect lock */}
        <FieldRow>
          <FieldLabel variant="caption" color="text.secondary">
            W
          </FieldLabel>
          <TextField
            size="small"
            fullWidth
            type="number"
            value={displayWidth}
            onChange={(e) => handleWidthChange(e.target.value)}
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
            value={displayHeight}
            onChange={(e) => handleHeightChange(e.target.value)}
            onBlur={commitSize}
            onKeyDown={(e) => e.key === 'Enter' && commitSize()}
            slotProps={{ htmlInput: { min: 1 } }}
          />
          <Tooltip title={lockAspect ? t('design.panel.unlockAspect', 'Unlock aspect ratio') : t('design.panel.lockAspect', 'Lock aspect ratio')}>
            <IconButton
              size="small"
              onClick={() => setLockAspect((p) => !p)}
              aria-label={lockAspect ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
            >
              {lockAspect ? <LinkIcon sx={{ fontSize: 18 }} /> : <LinkOffIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>
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

      {/* Layers */}
      <Section>
        <SectionLabel variant="overline" color="text.secondary">
          {t('design.canvas.layers.title', 'Layers')}
        </SectionLabel>
        {onSelectElement && onUpdateElement && onReorderElement ? (
          <LayerPanel
            artboardId={artboard.id}
            layers={artboard.layers}
            selectedElementId={selectedElementId ?? null}
            onSelectElement={onSelectElement}
            onUpdateElement={onUpdateElement}
            onReorderElement={onReorderElement}
          />
        ) : (
          <Typography variant="caption" color="text.disabled">
            {t('design.canvas.layers.empty', 'No layers')}
          </Typography>
        )}
      </Section>

    </Box>
  );
};

export default PanelArtboardState;
