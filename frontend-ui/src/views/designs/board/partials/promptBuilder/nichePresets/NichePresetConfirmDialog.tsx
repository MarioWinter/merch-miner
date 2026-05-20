// PROJ-34 Phase 13t-l — Confirm dialog for Niche-Preset cards.
// Read-only preview of the 7 slots + reference thumbnail. On Bestätigen we
// fire `confirmPreset` (persisted card → preset_id path; in-memory Top/Mix
// card → preset_dict path) and emit the resolved slot values upward so the
// host (BuilderDialog) can drop them straight into useBuilderDialogState
// via its existing slot setters. No new state lives here.

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useConfirmPresetMutation } from '@/services/presetCardsApi';
import type {
  NichePresetCard,
  NichePresetTopCardDict,
} from '@/types/nichePreset';
import {
  FONT_COMBINATION_OPTIONS,
  SPATIAL_OPTIONS,
  TYPOGRAPHY_OPTIONS,
} from '../../../constants/slotOptions';
import { STYLE_LIBRARY } from '../../../constants/styleLibrary';

export type AnyPresetCard = NichePresetCard | NichePresetTopCardDict;

export type ResolvedSlots = {
  spatial_configuration: string;
  visual_description: string;
  typography_adjectives: string;
  font_combination: string;
  accessories: string;
  style_dna: string;
  extra_context: string;
};

interface NichePresetConfirmDialogProps {
  open: boolean;
  card: AnyPresetCard | null;
  onClose: () => void;
  onConfirmed: (resolvedSlots: ResolvedSlots) => void;
}

const SLOT_KEYS = [
  'spatial_configuration',
  'visual_description',
  'typography_adjectives',
  'font_combination',
  'accessories',
  'style_dna',
  'extra_context',
] as const;

type SlotKey = (typeof SLOT_KEYS)[number];

interface FlatCard {
  spatial_configuration: string;
  visual_description: string;
  typography_adjectives: string;
  font_combination: string;
  accessories: string;
  style_dna: string;
  extra_context: string;
  raw: Record<SlotKey, boolean>;
  reference_thumbnail_url: string;
  preset_label: string;
}

const MAX_PREVIEW_CHARS = 200;

const Thumbnail = styled('img')(({ theme }) => ({
  width: 200,
  height: 200,
  objectFit: 'cover',
  flexShrink: 0,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.vars.palette.action.disabledBackground,
}));

const isPersistedCard = (card: AnyPresetCard): card is NichePresetCard =>
  'id' in card && typeof (card as NichePresetCard).id === 'string';

const flattenCard = (card: AnyPresetCard): FlatCard => {
  if (isPersistedCard(card)) {
    return {
      spatial_configuration: card.slots.spatial_configuration,
      visual_description: card.slots.visual_description,
      typography_adjectives: card.slots.typography_adjectives,
      font_combination: card.slots.font_combination,
      accessories: card.slots.accessories,
      style_dna: card.slots.style_dna,
      extra_context: card.slots.extra_context,
      raw: { ...card.raw_flags },
      reference_thumbnail_url: card.reference_thumbnail_url,
      preset_label: card.preset_label,
    };
  }
  return {
    spatial_configuration: card.slot_spatial_configuration,
    visual_description: card.slot_visual_description,
    typography_adjectives: card.slot_typography_adjectives,
    font_combination: card.slot_font_combination,
    accessories: card.slot_accessories,
    style_dna: card.slot_style_dna,
    extra_context: card.slot_extra_context,
    raw: {
      spatial_configuration: card.spatial_is_raw,
      visual_description: card.visual_is_raw,
      typography_adjectives: card.typography_is_raw,
      font_combination: card.font_combination_is_raw,
      accessories: card.accessories_is_raw,
      style_dna: card.style_dna_is_raw,
      extra_context: card.extra_context_is_raw,
    },
    reference_thumbnail_url: card.reference_thumbnail_url,
    preset_label: card.preset_label,
  };
};

const resolveSlotLabel = (slotKey: SlotKey, value: string, isRaw: boolean): string => {
  if (isRaw) return value;
  if (!value) return '';
  switch (slotKey) {
    case 'spatial_configuration':
      return SPATIAL_OPTIONS.find((o) => o.id === value)?.ui_label ?? value;
    case 'typography_adjectives':
      return TYPOGRAPHY_OPTIONS.find((o) => o.id === value)?.ui_label ?? value;
    case 'font_combination':
      return FONT_COMBINATION_OPTIONS.find((o) => o.id === value)?.ui_label ?? value;
    case 'style_dna':
      return STYLE_LIBRARY.find((s) => s.slug === value)?.label ?? value;
    default:
      return value;
  }
};

const truncate = (text: string): string =>
  text.length > MAX_PREVIEW_CHARS ? `${text.slice(0, MAX_PREVIEW_CHARS)}…` : text;

const NichePresetConfirmDialog = ({
  open,
  card,
  onClose,
  onConfirmed,
}: NichePresetConfirmDialogProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [confirmPreset, { isLoading }] = useConfirmPresetMutation();

  if (!card) return null;
  const flat = flattenCard(card);

  const handleConfirm = async () => {
    try {
      if (isPersistedCard(card)) {
        await confirmPreset({ preset_id: card.id }).unwrap();
      } else {
        await confirmPreset({
          preset_dict: card,
          source_card_type: card.source_card_type,
          source_refs: card.source_card_references,
        }).unwrap();
      }
      onConfirmed({
        spatial_configuration: flat.spatial_configuration,
        visual_description: flat.visual_description,
        typography_adjectives: flat.typography_adjectives,
        font_combination: flat.font_combination,
        accessories: flat.accessories,
        style_dna: flat.style_dna,
        extra_context: flat.extra_context,
      });
      enqueueSnackbar(
        t('designForge.builder.nichePresets.confirmSuccess'),
        { variant: 'success' },
      );
      onClose();
    } catch {
      enqueueSnackbar(
        t('designForge.builder.nichePresets.confirmError'),
        { variant: 'error' },
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      aria-labelledby="niche-preset-confirm-title"
    >
      <DialogTitle id="niche-preset-confirm-title">
        {t('designForge.builder.nichePresets.confirmTitle')}
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
          <Thumbnail
            src={flat.reference_thumbnail_url || undefined}
            alt={flat.preset_label}
            loading="lazy"
          />
          <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            {SLOT_KEYS.map((slotKey) => {
              const rawValue = flat[slotKey];
              const isRaw = flat.raw[slotKey];
              const label = resolveSlotLabel(slotKey, rawValue, isRaw);
              const display = label ? truncate(label) : '—';
              const showTooltip = label.length > MAX_PREVIEW_CHARS;
              return (
                <Box key={slotKey} data-testid={`slot-row-${slotKey}`}>
                  <Typography variant="caption" color="text.secondary">
                    {t(`designForge.builder.slotLabels.${slotKey}`)}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title={showTooltip ? label : ''} placement="top">
                      <Typography
                        variant="body2"
                        sx={{ wordBreak: 'break-word' }}
                      >
                        {display}
                      </Typography>
                    </Tooltip>
                    {isRaw && (
                      <Chip
                        size="small"
                        label={t('designForge.builder.nichePresets.rawChip')}
                        color="warning"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="text">
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color="primary"
          disabled={isLoading}
        >
          {t('designForge.builder.nichePresets.confirmButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NichePresetConfirmDialog;
