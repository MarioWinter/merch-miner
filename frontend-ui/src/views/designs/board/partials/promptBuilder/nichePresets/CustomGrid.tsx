// PROJ-34 Phase 13t-k — Custom tab grid.
// Renders workspace-promoted NichePresetCard rows (uncapped per AC-101).
// Each card exposes:
//   - topRightChip: "Promoted by <id>" attribution chip per AC-104. Username
//     resolution is OUT OF SCOPE for MVP — show the first 8 chars of the
//     promoter id (or "unknown" when null).
//   - bottomActions: "Löschen" IconButton firing window.confirm() → removeCustom
//     mutation per AC-103. History row is unaffected (AC-105).
// Empty-state Alert per AC-106.

import {
  Alert,
  Chip,
  Grid,
  IconButton,
  Skeleton,
  Tooltip,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useGetCustomQuery,
  useRemoveCustomMutation,
} from '@/services/presetCardsApi';
import NichePresetCard, { type AnyPresetCard } from './NichePresetCard';
import type { NichePresetCard as NichePresetCardType } from '@/types/nichePreset';

const SKELETON_COUNT = 6;

interface CustomGridProps {
  onCardClick?: (card: AnyPresetCard) => void;
}

const CustomGrid = ({ onCardClick }: CustomGridProps = {}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data, isLoading, isError } = useGetCustomQuery();
  const [remove, { isLoading: removing }] = useRemoveCustomMutation();

  const handleDelete = async (card: NichePresetCardType) => {
    const confirmed = window.confirm(
      t('designForge.builder.nichePresets.deleteConfirm'),
    );
    if (!confirmed) return;
    try {
      await remove({ presetId: card.id }).unwrap();
      enqueueSnackbar(
        t('designForge.builder.nichePresets.deleteSuccess'),
        { variant: 'info' },
      );
    } catch {
      enqueueSnackbar(
        t('designForge.builder.nichePresets.deleteError'),
        { variant: 'error' },
      );
    }
  };

  const handleCardClick = (card: AnyPresetCard) => {
    onCardClick?.(card);
  };

  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
          <Grid size={{ xs: 6, md: 'auto' }} key={idx}>
            <Skeleton variant="rectangular" width={200} height={244} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {t('designForge.builder.nichePresets.errorLoading')}
      </Alert>
    );
  }

  const cards = data ?? [];
  if (cards.length === 0) {
    return (
      <Alert severity="info">
        {t('designForge.builder.nichePresets.emptyCustom')}
      </Alert>
    );
  }

  return (
    <Grid container spacing={2}>
      {cards.map((card) => {
        const promoterRaw = card.custom_promoted_by;
        const promoterDisplay = promoterRaw
          ? String(promoterRaw).slice(0, 16)
          : t('designForge.builder.nichePresets.unknownUser');
        return (
          <Grid size={{ xs: 6, md: 'auto' }} key={card.id}>
            <NichePresetCard
              card={card}
              onClick={handleCardClick}
              wide={card.source.card_type !== 'top'}
              topRightChip={
                <Chip
                  size="small"
                  label={t(
                    'designForge.builder.nichePresets.promotedBy',
                    { id: promoterDisplay },
                  )}
                />
              }
              bottomActions={
                <Tooltip
                  title={t(
                    'designForge.builder.nichePresets.deleteTooltip',
                  )}
                >
                  <span>
                    <IconButton
                      size="small"
                      disabled={removing}
                      aria-label={t(
                        'designForge.builder.nichePresets.deleteTooltip',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(card);
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              }
            />
          </Grid>
        );
      })}
    </Grid>
  );
};

export default CustomGrid;
