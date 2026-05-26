// PROJ-34 Phase 13t-s — Collection Cards row.
// Renders user-curated CollectedProduct items (with matching Vision analysis)
// as NichePresetCard tiles. Parent decides whether to render: caller passes
// `cards` directly from the vorschlaege endpoint's `collection` array.
// Empty array → component returns null (caller hides subsection entirely
// per AC-149).

import { Grid } from '@mui/material';
import NichePresetCard, { type AnyPresetCard } from './NichePresetCard';
import type { NichePresetTopCardDict } from '@/types/nichePreset';

interface CollectionCardsRowProps {
  cards: NichePresetTopCardDict[];
  onCardClick?: (card: AnyPresetCard) => void;
}

const CollectionCardsRow = ({ cards, onCardClick }: CollectionCardsRowProps) => {
  if (cards.length === 0) return null;

  const handleCardClick = (card: AnyPresetCard) => {
    onCardClick?.(card);
  };

  return (
    <Grid container spacing={2}>
      {cards.map((card, idx) => (
        <Grid size={{ xs: 6, md: 'auto' }} key={`coll-${card.preset_label}-${idx}`}>
          <NichePresetCard card={card} onClick={handleCardClick} />
        </Grid>
      ))}
    </Grid>
  );
};

export default CollectionCardsRow;
