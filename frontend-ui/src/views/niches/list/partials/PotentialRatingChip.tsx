import { Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { PotentialRating } from '../types';

interface PotentialRatingChipProps {
  potentialRating: PotentialRating | null;
}

type RatingVariant = 'good' | 'very_good' | 'rejected';

interface StyledChipProps {
  ratingvariant: RatingVariant;
}

const StyledRatingChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'ratingvariant',
})<StyledChipProps>(({ theme, ratingvariant }) => {
  const variantStyles: Record<RatingVariant, object> = {
    good: {
      backgroundColor: `rgba(34, 211, 163, 0.12)`,
      color: theme.vars.palette.success.main,
      borderColor: `rgba(34, 211, 163, 0.25)`,
    },
    very_good: {
      backgroundColor: `rgba(255, 90, 79, 0.12)`,
      color: theme.vars.palette.primary.main,
      borderColor: `rgba(255, 90, 79, 0.25)`,
    },
    rejected: {
      backgroundColor: `rgba(244, 63, 58, 0.12)`,
      color: theme.vars.palette.error.main,
      borderColor: `rgba(244, 63, 58, 0.25)`,
    },
  };

  return {
    height: 22,
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    borderRadius: 6,
    border: '1px solid',
    ...variantStyles[ratingvariant],
    '& .MuiChip-label': {
      paddingLeft: 8,
      paddingRight: 8,
    },
  };
});

export const PotentialRatingChip = ({ potentialRating }: PotentialRatingChipProps) => {
  const { t } = useTranslation();

  if (!potentialRating) return null;

  return (
    <StyledRatingChip
      label={t(`niches.potentialRating.${potentialRating}`, { defaultValue: potentialRating })}
      ratingvariant={potentialRating}
      size="small"
    />
  );
};
