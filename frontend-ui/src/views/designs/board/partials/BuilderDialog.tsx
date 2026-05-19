// PROJ-34 Phase 13g — renovated Multi-Prompt Builder dialog.
//
// Restructured into 5 collapsible MUI Accordions (AC-64) + Live Preview panel
// (AC-67) + niche-hint pre-fill (AC-66) + dirty-flag override-wins (EC-28) +
// deleted-CustomSpatial fallback chip (EC-32) + v1→v2 preset compat (AC-68 +
// EC-25). State + dirty-flag logic live in `useBuilderDialogState`; debounced
// preview lives in `useBuilderLivePreview`.

import { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import type { ProjectIdea } from '@/views/designs/gallery/types';
import {
  BUILD_CONFIRM_THRESHOLD,
  type BuilderConfig,
  type BuilderPresetSummary,
  type NicheContextReason,
} from '../types/builder';
import { getStyleBySlug } from '../constants/styleLibrary';
import { isSpatialUuid } from '../constants/slotOptions';
import {
  useListCustomSpatialsQuery,
  type BuilderFormHints,
} from '@/store/designSlice';
import useBuilderDialogState from '../hooks/useBuilderDialogState';
import useBuilderLivePreview from '../hooks/useBuilderLivePreview';
import PresetBar from './promptBuilder/PresetBar';
import SloganPicker from './promptBuilder/SloganPicker';
import StyleSlotButton from './promptBuilder/StyleSlotButton';
import StylePickerModal from './promptBuilder/StylePickerModal';
import SpatialSlotButton from './promptBuilder/SpatialSlotButton';
import SpatialPickerModal from './promptBuilder/SpatialPickerModal';
import TextSegmentationPicker from './promptBuilder/TextSegmentationPicker';
import AccessoriesPicker from './promptBuilder/AccessoriesPicker';
import VisualDescriptionField from './promptBuilder/VisualDescriptionField';
import TypographyPicker from './promptBuilder/TypographyPicker';
import FontCombinationPicker from './promptBuilder/FontCombinationPicker';
import MaterialPicker from './promptBuilder/MaterialPicker';
import ExtraContextField from './promptBuilder/ExtraContextField';
import NicheContextToggle from './promptBuilder/NicheContextToggle';
import ReferenceIndicator from './promptBuilder/ReferenceIndicator';
import BuildCounter from './promptBuilder/BuildCounter';
import BuildConfirmDialog from './promptBuilder/BuildConfirmDialog';

interface BuilderDialogProps {
  open: boolean;
  onClose: () => void;
  ideas: ProjectIdea[];
  presets: BuilderPresetSummary[];
  referenceUrl: string | null;
  textareaDirtySinceBuild?: boolean;
  nicheReason: NicheContextReason;
  isBuilding: boolean;
  /** Phase-13c niche hints used to pre-fill empty form slots (AC-66). */
  nicheHints?: BuilderFormHints | null;
  /** Project owning the current Builder session — required for preview + spatial picker. */
  projectId?: string;
  /** Workspace owning the Builder session — forwarded to CustomSpatialCreator. */
  workspaceId?: string;
  onSavePreset: (name: string, config: BuilderConfig) => void;
  onDeletePreset: (id: string) => void;
  onBuild: (config: BuilderConfig) => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const DialogRoot = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    backgroundColor: COLORS.inkPaper,
    borderRadius: 16,
    minHeight: 640,
    maxHeight: 'min(85vh, 880px)',
    overflow: 'hidden',
    ...theme.applyStyles('light', {
      backgroundColor: theme.vars.palette.background.paper,
    }),
  },
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2.5, 3),
}));

const Body = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: theme.spacing(2, 3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
}));

const PreviewCode = styled('code')(({ theme }) => ({
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 12,
  color: theme.vars.palette.text.secondary,
  display: 'block',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const splitFreeText = (raw: string): string[] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const dedupeCaseInsensitive = (items: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BuilderDialog = ({
  open,
  onClose,
  ideas,
  presets,
  referenceUrl,
  textareaDirtySinceBuild = false,
  nicheReason,
  isBuilding,
  nicheHints = null,
  projectId,
  workspaceId,
  onSavePreset,
  onDeletePreset,
  onBuild,
}: BuilderDialogProps) => {
  const {
    cfg,
    setCfg,
    selectedPresetId,
    updateSlot,
    resetSlot,
    setStyleSlugs,
    loadPreset,
  } = useBuilderDialogState({ ideas, presets, nicheHints });

  const [confirmKind, setConfirmKind] = useState<null | 'threshold' | 'manualEdit'>(null);
  const [spatialPickerOpen, setSpatialPickerOpen] = useState(false);
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // EC-32 — when the saved preset references a CustomSpatial UUID that no
  // longer exists in the workspace list, show a warning chip + "Pick
  // replacement" CTA next to the SpatialSlotButton.
  const spatialValue = cfg.slots.spatial_configuration ?? '';
  const looksLikeUuid = spatialValue !== '' && isSpatialUuid(spatialValue);
  const { data: customSpatials, isSuccess: customSpatialsLoaded } =
    useListCustomSpatialsQuery(undefined, { skip: !looksLikeUuid });
  const customSpatialMissing =
    looksLikeUuid &&
    customSpatialsLoaded &&
    !(customSpatials ?? []).some((entry) => entry.id === spatialValue);

  const handleClose = () => {
    setConfirmKind(null);
    onClose();
  };

  // ----- Slogan + style derivations -----

  const sloganList = useMemo<string[]>(() => {
    const fromPool = ideas
      .filter((i) => cfg.selectedSloganIds.includes(i.id))
      .map((i) => i.slogan_text);
    const fromText = splitFreeText(cfg.freeTextSlogans);
    return dedupeCaseInsensitive([...fromPool, ...fromText]);
  }, [ideas, cfg.selectedSloganIds, cfg.freeTextSlogans]);

  const sloganCount = sloganList.length;
  const styleCount = cfg.selectedStyleSlugs.length;
  const total = sloganCount * styleCount;

  const firstStyleEntry = useMemo(() => {
    const first = cfg.selectedStyleSlugs[0];
    return first ? getStyleBySlug(first) : undefined;
  }, [cfg.selectedStyleSlugs]);

  // ----- Live preview wiring -----

  const livePreview = useBuilderLivePreview({
    cfg,
    projectId: projectId ?? '',
    backgroundColor: 'light_gray',
    enabled: previewOpen,
    firstSlogan: sloganList[0],
  });

  // ----- Build / confirm cascade -----

  const fireBuild = () => {
    setConfirmKind(null);
    void onBuild(cfg);
  };

  const handleBuildClick = () => {
    if (sloganCount === 0 || styleCount === 0 || isBuilding) return;
    if (textareaDirtySinceBuild) {
      setConfirmKind('manualEdit');
      return;
    }
    if (total > BUILD_CONFIRM_THRESHOLD) {
      setConfirmKind('threshold');
      return;
    }
    fireBuild();
  };

  const handleConfirmCascade = () => {
    if (confirmKind === 'manualEdit' && total > BUILD_CONFIRM_THRESHOLD) {
      setConfirmKind('threshold');
      return;
    }
    fireBuild();
  };

  const handleSavePreset = (name: string) => onSavePreset(name, cfg);

  return (
    <DialogRoot
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="builder-dialog-title"
    >
      <Header>
        <AutoAwesomeIcon sx={{ fontSize: 20, color: 'secondary.main', mr: 1 }} />
        <Typography id="builder-dialog-title" variant="h4" sx={{ flex: 1 }}>
          Prompt Builder
        </Typography>
        <IconButton
          onClick={handleClose}
          size="small"
          aria-label="Close"
          sx={{ width: 32, height: 32 }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Header>

      <PresetBar
        presets={presets}
        selectedPresetId={selectedPresetId}
        onLoadPreset={loadPreset}
        onDeletePreset={onDeletePreset}
        onSavePreset={handleSavePreset}
      />

      <Body>
        {/* A. Slogans (open by default) */}
        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            aria-controls="builder-slogans-content"
            id="builder-slogans-header"
          >
            <Typography variant="subtitle1">Slogans</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <SloganPicker
              pool={ideas}
              selectedIds={cfg.selectedSloganIds}
              onSelectedIdsChange={(ids) =>
                setCfg((c) => ({ ...c, selectedSloganIds: ids }))
              }
              freeText={cfg.freeTextSlogans}
              onFreeTextChange={(v) =>
                setCfg((c) => ({ ...c, freeTextSlogans: v }))
              }
            />
          </AccordionDetails>
        </Accordion>

        {/* B. Styles (open by default) */}
        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            aria-controls="builder-styles-content"
            id="builder-styles-header"
          >
            <Typography variant="subtitle1">Styles</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={1.5}>
              <StyleSlotButton
                selectedSlugs={cfg.selectedStyleSlugs}
                onOpenPicker={() => setStylePickerOpen(true)}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* C. Layout & Composition (closed by default) */}
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            aria-controls="builder-layout-content"
            id="builder-layout-header"
          >
            <Typography variant="subtitle1">Layout & Composition</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Stack spacing={0.75}>
                <SpatialSlotButton
                  value={cfg.slots.spatial_configuration}
                  onOpenPicker={() => setSpatialPickerOpen(true)}
                  onReset={() => resetSlot('spatial_configuration')}
                />
                {customSpatialMissing && (
                  <Chip
                    color="warning"
                    variant="outlined"
                    size="small"
                    icon={<WarningAmberRoundedIcon />}
                    label="Saved custom spatial deleted — fallback applied"
                    data-testid="custom-spatial-missing-chip"
                    onDelete={() => resetSlot('spatial_configuration')}
                    deleteIcon={
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => setSpatialPickerOpen(true)}
                      >
                        Pick replacement
                      </Button>
                    }
                    sx={{ alignSelf: 'flex-start', height: 'auto', py: 0.5 }}
                  />
                )}
              </Stack>
              <TextSegmentationPicker
                value={cfg.slots.text_segmentation ?? ''}
                onChange={(v) => updateSlot('text_segmentation', v)}
              />
              <AccessoriesPicker
                value={cfg.slots.accessories ?? ''}
                onChange={(v) => updateSlot('accessories', v)}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* D. Visual Details (open by default) */}
        <Accordion defaultExpanded>
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            aria-controls="builder-visual-content"
            id="builder-visual-header"
          >
            <Typography variant="subtitle1">Visual Details</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <VisualDescriptionField
                value={cfg.slots.visual_description ?? ''}
                onChange={(v) => updateSlot('visual_description', v)}
              />
              <TypographyPicker
                value={cfg.slots.typography_adjectives ?? ''}
                onChange={(v) => updateSlot('typography_adjectives', v)}
                styleDefault={firstStyleEntry?.defaultTypography}
                styleLabel={firstStyleEntry?.label}
              />
              <FontCombinationPicker
                value={cfg.slots.font_combination ?? ''}
                onChange={(v) => updateSlot('font_combination', v)}
              />
              <MaterialPicker
                value={cfg.slots.material_texture ?? ''}
                onChange={(v) => updateSlot('material_texture', v)}
                styleDefault={firstStyleEntry?.defaultMaterial}
                styleLabel={firstStyleEntry?.label}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* E. Niche & Extra (closed by default) */}
        <Accordion>
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            aria-controls="builder-niche-content"
            id="builder-niche-header"
          >
            <Typography variant="subtitle1">Niche & Extra</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <Stack
                direction="row"
                spacing={3}
                alignItems="center"
                justifyContent="space-between"
                sx={{ flexWrap: 'wrap', rowGap: 1.5 }}
              >
                <NicheContextToggle
                  checked={cfg.includeNicheContext}
                  onChange={(checked) =>
                    setCfg((c) => ({ ...c, includeNicheContext: checked }))
                  }
                  reason={nicheReason}
                />
              </Stack>
              <ReferenceIndicator url={referenceUrl} />
              <ExtraContextField
                value={cfg.slots.extra_context ?? ''}
                onChange={(v) => updateSlot('extra_context', v)}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Live preview (AC-67) — placed below all sections, above the Build CTA */}
        <Accordion
          expanded={previewOpen}
          onChange={(_, expanded) => setPreviewOpen(expanded)}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreRoundedIcon />}
            aria-controls="builder-preview-content"
            id="builder-preview-header"
          >
            <Typography variant="subtitle1">Live Preview</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {sloganList.length === 0 || cfg.selectedStyleSlugs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Pick a slogan and a style to preview…
              </Typography>
            ) : livePreview.previewError ? (
              <Typography variant="body2" color="error">
                {livePreview.previewError}
              </Typography>
            ) : livePreview.previewText ? (
              <PreviewCode data-testid="builder-live-preview">
                {livePreview.previewText}
              </PreviewCode>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {livePreview.isLoading ? 'Building preview…' : 'Preview pending'}
              </Typography>
            )}
          </AccordionDetails>
        </Accordion>
      </Body>

      <BuildCounter
        sloganCount={sloganCount}
        styleCount={styleCount}
        isBuilding={isBuilding}
        onBuild={handleBuildClick}
      />

      <BuildConfirmDialog
        open={confirmKind === 'manualEdit'}
        title="Replace your manual edits?"
        body={
          'Your manual changes to the prompt textarea will be overwritten by the ' +
          'newly-built prompts.'
        }
        confirmLabel="Replace"
        onCancel={() => setConfirmKind(null)}
        onConfirm={handleConfirmCascade}
      />
      <BuildConfirmDialog
        open={confirmKind === 'threshold'}
        title={`About to generate ${total} prompts`}
        body={
          `${sloganCount} slogans × ${styleCount} styles = ${total} polished prompts ` +
          'will land in the textarea. This may take a few seconds and use ' +
          'polish credits.'
        }
        confirmLabel={`Generate ${total} prompts`}
        onCancel={() => setConfirmKind(null)}
        onConfirm={fireBuild}
      />

      <SpatialPickerModal
        open={spatialPickerOpen}
        onClose={() => setSpatialPickerOpen(false)}
        value={cfg.slots.spatial_configuration}
        onChange={(v) => updateSlot('spatial_configuration', v)}
        workspaceId={workspaceId}
        projectId={projectId}
      />
      <StylePickerModal
        open={stylePickerOpen}
        onClose={() => setStylePickerOpen(false)}
        selectedSlugs={cfg.selectedStyleSlugs}
        onChange={(slugs) => setStyleSlugs(slugs)}
      />
    </DialogRoot>
  );
};

export default BuilderDialog;
