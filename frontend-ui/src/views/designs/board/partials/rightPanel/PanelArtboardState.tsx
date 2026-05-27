import { useCallback, useState } from 'react';
import {
  Box,
  Divider,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import type { SelectChangeEvent } from '@mui/material/Select';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SendToListingsIcon from '../SendToListingsIcon';
import PhotoSizeSelectLargeIcon from '@mui/icons-material/PhotoSizeSelectLarge';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { useTranslation } from 'react-i18next';
import { useGetDesignsByIdsQuery } from '@/store/designSlice';
import type { ArtboardData, CanvasElement } from '../../types';
import { ARTBOARD_PRESETS } from '../../types';
import LayerPanel from './LayerPanel';
import { useUpscaleSelection } from '../../hooks/useUpscaleSelection';
import UpscaleDestinationToggle from '../UpscaleDestinationToggle';
import UpscaleQuotaIndicator from '../UpscaleQuotaIndicator';
import BulkReUpscaleDialog from '../BulkReUpscaleDialog';
import PreflightQuotaDialog from '../PreflightQuotaDialog';
import PickCloudFolderDialog from '../PickCloudFolderDialog';
import UpscaleCompareModal from '../UpscaleCompareModal';

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

const ToolbarButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    color: theme.vars.palette.text.primary,
  },
}));

const DeleteButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  color: theme.vars.palette.error.main,
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
  onOpenInEditor?: (ids: string[]) => void;
  onExportSelected?: (ids: string[]) => void;
  onDeleteSelected?: (ids: string[]) => void;
  /** PROJ-9 Phase O — resolves selected artboard IDs to approved design IDs eligible for Listings. */
  getSendableDesignIds?: (artboardIds: string[]) => string[];
  /** PROJ-9 Phase O — sends the approved design IDs to Listings. */
  onSendToListings?: (designIds: string[]) => void;
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
  onOpenInEditor,
  onExportSelected,
  onDeleteSelected,
  getSendableDesignIds,
  onSendToListings,
}: PanelArtboardStateProps) => {
  const { t } = useTranslation();

  // PROJ-27 — Single-design upscale via the same shared hook used by
  // PanelMultiState. designIds=[artboard.designId] when present.
  const upscalableDesignIds = artboard.designId ? [artboard.designId] : [];
  const upscale = useUpscaleSelection({
    designIds: upscalableDesignIds,
    hasMaybeUpscaled: artboard.kind === 'ai' && upscalableDesignIds.length > 0,
  });

  // PROJ-27 — Fetch design metadata so we can detect whether an upscaled file
  // exists (gates the Compare button). RTK Query caches by id.
  const { data: linkedDesigns } = useGetDesignsByIdsQuery(
    upscalableDesignIds,
    { skip: upscalableDesignIds.length === 0 },
  );
  const linkedDesign = linkedDesigns?.[0] ?? null;
  const hasUpscaled = !!linkedDesign?.upscaled_file;
  const [compareOpen, setCompareOpen] = useState(false);

  const sendableDesignIds = getSendableDesignIds ? getSendableDesignIds([artboard.id]) : [];
  const sendTooltip = sendableDesignIds.length === 0
    ? t('designs.sendToListings.notApprovedTooltip', 'Only approved designs can be sent.')
    : t('designs.sendToListings.cta', 'Send to Listings');
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

        {/* Action toolbar */}
        {(onOpenInEditor || onExportSelected || onDeleteSelected) && (
          <Stack direction="row" sx={{ gap: 0.5, mt: 1 }}>
            {onOpenInEditor && (
              <Tooltip title={t('design.panel.openInEditor', 'Open in Editor')}>
                <ToolbarButton onClick={() => onOpenInEditor([artboard.id])} aria-label={t('design.panel.openInEditor', 'Open in Editor')}>
                  <OpenInNewOutlinedIcon sx={{ fontSize: 20 }} />
                </ToolbarButton>
              </Tooltip>
            )}
            {onExportSelected && (
              <Tooltip title={t('design.panel.exportSelected', 'Export')}>
                <ToolbarButton onClick={() => onExportSelected([artboard.id])} aria-label={t('design.panel.exportSelected', 'Export')}>
                  <FileDownloadOutlinedIcon sx={{ fontSize: 20 }} />
                </ToolbarButton>
              </Tooltip>
            )}
            {/* PROJ-27 — Upscale (only for AI-linked artboards) */}
            {upscalableDesignIds.length > 0 && (
              <Tooltip title={upscale.tooltip}>
                <span>
                  <ToolbarButton
                    onClick={upscale.handleClick}
                    disabled={upscale.disabled}
                    aria-label={t('upscale.bulk.aria', 'Upscale')}
                  >
                    <PhotoSizeSelectLargeIcon sx={{ fontSize: 20 }} />
                  </ToolbarButton>
                </span>
              </Tooltip>
            )}
            {/* PROJ-27 — Compare original vs upscaled (only when upscaled) */}
            {hasUpscaled && (
              <Tooltip
                title={t('upscale.compare.tooltip', {
                  defaultValue: 'Compare original vs upscaled',
                })}
              >
                <span>
                  <ToolbarButton
                    onClick={() => setCompareOpen(true)}
                    aria-label={t('upscale.compare.aria', 'Compare upscale')}
                  >
                    <CompareArrowsIcon sx={{ fontSize: 20 }} />
                  </ToolbarButton>
                </span>
              </Tooltip>
            )}
            {onSendToListings && (
              <Tooltip title={sendTooltip}>
                <span>
                  <ToolbarButton
                    onClick={() => onSendToListings(sendableDesignIds)}
                    disabled={sendableDesignIds.length === 0}
                    aria-label={t('designs.sendToListings.cta', 'Send to Listings')}
                  >
                    <SendToListingsIcon />
                  </ToolbarButton>
                </span>
              </Tooltip>
            )}
            {onDeleteSelected && (
              <Tooltip title={t('design.panel.deleteAll', 'Delete')}>
                <DeleteButton onClick={() => onDeleteSelected([artboard.id])} aria-label={t('design.panel.deleteAll', 'Delete')}>
                  <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                </DeleteButton>
              </Tooltip>
            )}
          </Stack>
        )}

        {/* PROJ-27 — Destination toggle + quota indicator (AI artboards only) */}
        {upscalableDesignIds.length > 0 && (
          <Stack
            sx={{
              mt: 1.5,
              pt: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              gap: 0.75,
            }}
          >
            <UpscaleDestinationToggle
              workspaceId={upscale.workspaceId}
              onPickCloudTarget={upscale.openCloudPicker}
              disabled={upscale.isTriggering}
            />
            <UpscaleQuotaIndicator />
          </Stack>
        )}
      </Section>

      {/* PROJ-27 — Dialogs (MUI portals to body) */}
      <BulkReUpscaleDialog
        open={upscale.confirmOpen}
        totalCount={upscalableDesignIds.length}
        alreadyUpscaledCount={artboard.kind === 'ai' ? 1 : 0}
        onCancel={upscale.closeConfirm}
        onSkipAlreadyUpscaled={upscale.confirmSkip}
        onReupscaleAll={upscale.confirmReplace}
      />
      <PreflightQuotaDialog
        open={upscale.preflight.open}
        selectedCount={upscale.preflight.selectedIds.length}
        remaining={Math.max(0, upscale.preflight.limit - upscale.preflight.used)}
        resetsOn={upscale.preflight.resets_on}
        onCancel={upscale.closePreflight}
        onConfirmFirstN={() => {
          void upscale.confirmPreflightFirstN(false);
        }}
      />
      <PickCloudFolderDialog
        open={upscale.cloudPickerOpen}
        onClose={upscale.closeCloudPicker}
        onPick={upscale.applyCloudTarget}
      />
      {linkedDesign && hasUpscaled && (
        <UpscaleCompareModal
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          items={[
            {
              beforeUrl: linkedDesign.image_file,
              afterUrl: linkedDesign.upscaled_file,
              label: artboard.label ?? artboard.id.slice(0, 8),
            },
          ]}
        />
      )}

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
