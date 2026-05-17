// PROJ-34 Phase 8 — renovated Multi-Prompt Builder dialog.
//
// Replaces the 8-tab PromptBuilderDialog with a flat linear flow:
//   PresetBar → Slogans → Styles → Warp + NicheToggle → Reference → Build CTA.
//
// This file is intentionally a PURE PRESENTATIONAL composer. State for the
// Builder form lives here (it is dialog-local); persistence + the actual
// network call land in the parent via the `onBuild` callback. Wiring into
// `useWorkspaceGeneration` + the RTK Query mutations is the next /frontend
// pass — kept out of this commit per the design-spec scope-lock.

import { useMemo, useState } from 'react';
import {
  Box,
  Dialog,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import { COLORS } from '@/style/constants';
import type { ProjectIdea } from '@/views/designs/gallery/types';
import {
  BUILD_CONFIRM_THRESHOLD,
  EMPTY_BUILDER_CONFIG,
  type BuilderConfig,
  type BuilderPresetSummary,
  type NicheContextReason,
} from '../types/builder';
import PresetBar from './promptBuilder/PresetBar';
import SloganPicker from './promptBuilder/SloganPicker';
import StylePicker from './promptBuilder/StylePicker';
import WarpPicker from './promptBuilder/WarpPicker';
import NicheContextToggle from './promptBuilder/NicheContextToggle';
import ReferenceIndicator from './promptBuilder/ReferenceIndicator';
import BuildCounter from './promptBuilder/BuildCounter';
import BuildConfirmDialog from './promptBuilder/BuildConfirmDialog';

interface BuilderDialogProps {
  open: boolean;
  onClose: () => void;
  // Source data
  ideas: ProjectIdea[];
  presets: BuilderPresetSummary[];
  referenceUrl: string | null;
  /** Whether the parent textarea was manually edited since the last Build (AC-40). */
  textareaDirtySinceBuild?: boolean;
  /** Reason payload driving the NicheContextToggle's disabled state. */
  nicheReason: NicheContextReason;
  // Loading
  isBuilding: boolean;
  // Callbacks
  onSavePreset: (name: string, config: BuilderConfig) => void;
  onDeletePreset: (id: string) => void;
  /** Returns the polished prompts; parent joins with `; ` and inserts into textarea. */
  onBuild: (config: BuilderConfig) => Promise<void> | void;
}

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

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
  gap: theme.spacing(2.5),
}));

const Section = styled(Box)(({ theme }) => ({
  paddingBlock: theme.spacing(1),
  '&:not(:last-of-type)': {
    borderBottom: `1px solid ${theme.vars.palette.divider}`,
    paddingBottom: theme.spacing(2.5),
  },
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

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

const BuilderDialog = ({
  open,
  onClose,
  ideas,
  presets,
  referenceUrl,
  textareaDirtySinceBuild = false,
  nicheReason,
  isBuilding,
  onSavePreset,
  onDeletePreset,
  onBuild,
}: BuilderDialogProps) => {
  const [config, setConfig] = useState<BuilderConfig>(EMPTY_BUILDER_CONFIG);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  // `confirmKind` is auto-reset when the dialog closes via `onClose` (see
  // `handleClose` below) so we don't need a useEffect synced to `open`.
  const [confirmKind, setConfirmKind] = useState<null | 'threshold' | 'manualEdit'>(null);

  const handleClose = () => {
    setConfirmKind(null);
    onClose();
  };

  const sloganList = useMemo<string[]>(() => {
    const fromPool = ideas
      .filter((i) => config.selectedSloganIds.includes(i.id))
      .map((i) => i.slogan_text);
    const fromText = splitFreeText(config.freeTextSlogans);
    return dedupeCaseInsensitive([...fromPool, ...fromText]);
  }, [ideas, config.selectedSloganIds, config.freeTextSlogans]);

  const sloganCount = sloganList.length;
  const styleCount = config.selectedStyleSlugs.length;
  const total = sloganCount * styleCount;

  const handleToggleStyle = (slug: string) => {
    setConfig((c) => {
      const next = c.selectedStyleSlugs.includes(slug)
        ? c.selectedStyleSlugs.filter((s) => s !== slug)
        : [...c.selectedStyleSlugs, slug];
      return { ...c, selectedStyleSlugs: next };
    });
  };

  const handleClearStyles = () =>
    setConfig((c) => ({ ...c, selectedStyleSlugs: [] }));

  const handleLoadPreset = (id: string) => {
    if (!id) {
      setSelectedPresetId(null);
      return;
    }
    const preset = presets.find((p) => p.id === id);
    if (!preset) return;
    setSelectedPresetId(id);
    setConfig({ ...EMPTY_BUILDER_CONFIG, ...preset.config });
  };

  const handleSavePreset = (name: string) => onSavePreset(name, config);

  const fireBuild = () => {
    setConfirmKind(null);
    void onBuild(config);
  };

  const handleBuildClick = () => {
    if (sloganCount === 0 || styleCount === 0 || isBuilding) return;

    // AC-40 / Appendix G: ask before clobbering manual textarea edits.
    if (textareaDirtySinceBuild) {
      setConfirmKind('manualEdit');
      return;
    }
    // AC-35 / EC-11: confirm modal past the threshold.
    if (total > BUILD_CONFIRM_THRESHOLD) {
      setConfirmKind('threshold');
      return;
    }
    fireBuild();
  };

  // The threshold confirm clears manual-edit state too, so chaining is OK.
  const handleConfirmCascade = () => {
    if (confirmKind === 'manualEdit' && total > BUILD_CONFIRM_THRESHOLD) {
      // Promote to the second confirm (threshold) after acknowledging edits.
      setConfirmKind('threshold');
      return;
    }
    fireBuild();
  };

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
        onLoadPreset={handleLoadPreset}
        onDeletePreset={onDeletePreset}
        onSavePreset={handleSavePreset}
      />

      <Body>
        <Section>
          <SloganPicker
            pool={ideas}
            selectedIds={config.selectedSloganIds}
            onSelectedIdsChange={(ids) =>
              setConfig((c) => ({ ...c, selectedSloganIds: ids }))
            }
            freeText={config.freeTextSlogans}
            onFreeTextChange={(v) =>
              setConfig((c) => ({ ...c, freeTextSlogans: v }))
            }
          />
        </Section>

        <Section>
          <StylePicker
            selectedSlugs={config.selectedStyleSlugs}
            onToggle={handleToggleStyle}
            onClear={handleClearStyles}
          />
        </Section>

        <Section>
          <Stack
            direction="row"
            spacing={3}
            alignItems="center"
            justifyContent="space-between"
            sx={{ flexWrap: 'wrap', rowGap: 1.5 }}
          >
            <WarpPicker
              value={config.warpSlug}
              onChange={(slug) => setConfig((c) => ({ ...c, warpSlug: slug }))}
            />
            <NicheContextToggle
              checked={config.includeNicheContext}
              onChange={(checked) =>
                setConfig((c) => ({ ...c, includeNicheContext: checked }))
              }
              reason={nicheReason}
            />
          </Stack>
          <ReferenceIndicator url={referenceUrl} />
        </Section>
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
    </DialogRoot>
  );
};

export default BuilderDialog;
