// PROJ-34 Phase 13t-k — History tab grid.
// Renders persisted NichePresetCard rows (workspace-scoped, 50-cap LRU).
// Each card exposes:
//   - topRightChip: source-card-type badge ("Top" / "Mix · Most-Common" …) +
//     "+N more" overflow chip when the same preset was confirmed across
//     multiple niches (AC-100).
//   - bottomActions: "In Custom speichern" IconButton firing promoteCustom
//     mutation (AC-98). Toast + tag-invalidation handled by RTK Query slice.
// Empty-state Alert per AC-99.

import {
  Alert,
  Chip,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
} from '@mui/material';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useGetHistoryQuery,
  usePromoteCustomMutation,
} from '@/services/presetCardsApi';
import NichePresetCard, { type AnyPresetCard } from './NichePresetCard';
import type {
  NichePresetCard as NichePresetCardType,
  NichePresetSourceCardType,
} from '@/types/nichePreset';

const SKELETON_COUNT = 6;

const SOURCE_TYPE_I18N_KEY: Record<NichePresetSourceCardType, string> = {
  top: 'designForge.builder.nichePresets.sourceLabels.top',
  mix_most_common: 'designForge.builder.nichePresets.sourceLabels.mix_most_common',
  mix_edgy: 'designForge.builder.nichePresets.sourceLabels.mix_edgy',
  mix_safe: 'designForge.builder.nichePresets.sourceLabels.mix_safe',
};

interface HistoryGridProps {
  onCardClick?: (card: AnyPresetCard) => void;
}

const HistoryGrid = ({ onCardClick }: HistoryGridProps = {}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { data, isLoading, isError } = useGetHistoryQuery();
  const [promote, { isLoading: promoting }] = usePromoteCustomMutation();

  const handlePromote = async (card: NichePresetCardType) => {
    try {
      await promote({ presetId: card.id }).unwrap();
      enqueueSnackbar(
        t('designForge.builder.nichePresets.promoteSuccess'),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar(
        t('designForge.builder.nichePresets.promoteError'),
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
        {t('designForge.builder.nichePresets.emptyHistory')}
      </Alert>
    );
  }

  return (
    <Grid container spacing={2}>
      {cards.map((card) => {
        const refsCount = card.source?.references?.length ?? 0;
        const overflow = refsCount > 1 ? refsCount - 1 : 0;
        return (
          <Grid size={{ xs: 6, md: 'auto' }} key={card.id}>
            <NichePresetCard
              card={card}
              onClick={handleCardClick}
              wide={card.source.card_type !== 'top'}
              topRightChip={
                <Stack direction="row" spacing={0.5}>
                  <Chip
                    size="small"
                    label={t(
                      SOURCE_TYPE_I18N_KEY[card.source.card_type] ??
                        SOURCE_TYPE_I18N_KEY.top,
                    )}
                  />
                  {overflow > 0 && (
                    <Chip
                      size="small"
                      label={t(
                        'designForge.builder.nichePresets.sourceOverflow',
                        { count: overflow },
                      )}
                    />
                  )}
                </Stack>
              }
              bottomActions={
                <Tooltip
                  title={t(
                    'designForge.builder.nichePresets.promoteTooltip',
                  )}
                >
                  <span>
                    <IconButton
                      size="small"
                      disabled={promoting}
                      aria-label={t(
                        'designForge.builder.nichePresets.promoteTooltip',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePromote(card);
                      }}
                    >
                      <BookmarkBorderIcon fontSize="small" />
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

export default HistoryGrid;
