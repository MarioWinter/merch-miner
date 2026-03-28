import { Box, Chip, Skeleton, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { useTranslation } from 'react-i18next';
import type { RoundSummary } from '../types';

const RoundCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1, 1.5),
  borderRadius: 8,
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const TinyThumb = styled('img')({
  width: 32,
  height: 32,
  borderRadius: 4,
  objectFit: 'cover',
});

interface RoundHistoryProps {
  rounds: RoundSummary[];
  currentRound: number;
  isLoading?: boolean;
}

const RoundHistory = ({ rounds, currentRound, isLoading }: RoundHistoryProps) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {[1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={48} />
        ))}
      </Box>
    );
  }

  if (rounds.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        {t('kanban.round.noHistory')}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {rounds.map((r) => {
        const isCurrent = r.round === currentRound;
        return (
          <RoundCard
            key={r.round}
            sx={
              isCurrent
                ? { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) }
                : undefined
            }
          >
            <Chip
              label={`R${r.round}`}
              size="small"
              color={isCurrent ? 'primary' : 'default'}
              sx={{ fontWeight: 700, fontSize: 11, height: 22 }}
            />

            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              {r.idea_count} {t('kanban.round.ideas')} &middot;{' '}
              {r.design_count} {t('kanban.round.designs')} &middot;{' '}
              {r.approved_design_count} {t('kanban.round.approved')}
              {r.listing_count > 0 && (
                <> &middot; {r.listing_count} {t('kanban.round.listings')}</>
              )}
            </Typography>

            {r.winner_design_thumbnail ? (
              <TinyThumb src={r.winner_design_thumbnail} alt="Winner" />
            ) : r.approved_design_count > 0 ? (
              <EmojiEventsOutlinedIcon sx={{ fontSize: 20, color: 'warning.main' }} />
            ) : null}
          </RoundCard>
        );
      })}
    </Box>
  );
};

export default RoundHistory;
