// PROJ-34 Phase 13t-j — Top-10 ranked Niche-Preset Cards grid.
// Renders up to 10 NichePresetCard items in a responsive Grid. Loading state =
// 10 skeleton tiles. Empty state (zero analyzed products) = info Alert per AC-91.
// EC-34: render exactly as many cards as available (1-9 → no padding).

import { Alert, Grid, Skeleton } from '@mui/material';
import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import { useGetVorschlaegeQuery } from '@/services/presetCardsApi';
import NichePresetCard, { type AnyPresetCard } from './NichePresetCard';

const SKELETON_COUNT = 10;

interface TopCardsGridProps {
  nicheId: string | null;
  onCardClick?: (card: AnyPresetCard) => void;
}

const TopCardsGrid = ({ nicheId, onCardClick }: TopCardsGridProps) => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetVorschlaegeQuery(
    nicheId ? { nicheId } : skipToken,
  );

  // No-niche guard — render nothing; placeholder Alert is handled by parent tab.
  if (!nicheId) return null;

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

  const cards = data?.top ?? [];
  if (cards.length === 0) {
    return (
      <Alert severity="info">
        {t('designForge.builder.nichePresets.emptyVorschlaege')}
      </Alert>
    );
  }

  const handleCardClick = (card: AnyPresetCard) => {
    onCardClick?.(card);
  };

  return (
    <Grid container spacing={2}>
      {cards.map((card, idx) => (
        <Grid size={{ xs: 6, md: 'auto' }} key={`${card.preset_label}-${idx}`}>
          <NichePresetCard card={card} onClick={handleCardClick} />
        </Grid>
      ))}
    </Grid>
  );
};

export default TopCardsGrid;
