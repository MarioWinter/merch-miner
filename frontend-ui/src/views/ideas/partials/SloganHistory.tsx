import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VerifiedIcon from '@mui/icons-material/Verified';
import { useTranslation } from 'react-i18next';
import type { Idea } from '../types';

interface SloganHistoryProps {
  chain: Idea[];
}

const ACTOR_ICONS: Record<string, typeof PersonIcon> = {
  user: PersonIcon,
  agent: SmartToyIcon,
  quality_check: VerifiedIcon,
};

const getActor = (idea: Idea): string => {
  if (idea.was_changed) return 'quality_check';
  if (idea.is_manual) return 'user';
  return 'agent';
};

export const SloganHistory = ({ chain }: SloganHistoryProps) => {
  const { t } = useTranslation();

  if (chain.length <= 1) return null;

  return (
    <Box sx={(theme) => ({ pl: 2, borderLeft: `2px solid ${alpha(theme.vars.palette.common.white, 0.08)}` })}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {t('ideas.history.title')}
      </Typography>
      <Stack spacing={1}>
        {chain.map((idea, idx) => {
          const actor = getActor(idea);
          const Icon = ACTOR_ICONS[actor] ?? SmartToyIcon;
          const isLatest = idx === chain.length - 1;

          return (
            <Stack
              key={idea.id}
              direction="row"
              spacing={1}
              alignItems="flex-start"
              sx={{
                opacity: isLatest ? 1 : 0.7,
                py: 0.5,
              }}
            >
              <Icon
                sx={{
                  fontSize: 16,
                  mt: 0.25,
                  color: isLatest ? 'secondary.main' : 'text.secondary',
                }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isLatest ? 500 : 400,
                    color: isLatest
                      ? 'text.primary'
                      : 'text.secondary',
                  }}
                >
                  {idea.slogan_text}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`ideas.history.actor.${actor}`)} &middot;{' '}
                  {new Date(idea.created_at).toLocaleDateString()}
                </Typography>
              </Box>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
};
