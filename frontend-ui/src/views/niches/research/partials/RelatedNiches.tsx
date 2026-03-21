import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { RelatedNiche } from '../types';

interface RelatedNichesProps {
  niches: RelatedNiche[];
}

const Card = styled(Box)(({ theme }) => ({
  background: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5, 3),
}));

const NicheRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 150ms ease',
  '&:hover': {
    background: 'rgba(255,255,255,0.04)',
  },
}));

const EmptyBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(4, 0),
}));

export const RelatedNiches = ({ niches }: RelatedNichesProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Card>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
        {t('research.related.title')}
      </Typography>

      {niches.length === 0 ? (
        <EmptyBox>
          <LinkIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body2" color="text.disabled">
            {t('research.related.noRelated')}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            {t('research.related.noRelatedHint')}
          </Typography>
        </EmptyBox>
      ) : (
        <Stack spacing={0.5}>
          {niches.map((niche) => (
            <NicheRow
              key={niche.id}
              onClick={() => navigate(`/niches?selected=${niche.id}`)}
              role="button"
              tabIndex={0}
              aria-label={niche.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/niches?selected=${niche.id}`);
                }
              }}
            >
              <LinkIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
                {niche.name}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {niche.shared_patterns.map((p) => (
                  <Chip
                    key={p}
                    label={p.replace(/_/g, ' ')}
                    size="small"
                    sx={(theme) => ({
                      fontSize: '0.6875rem',
                      height: 22,
                      backgroundColor: alpha(theme.palette.primary.main, 0.12),
                      color: theme.vars.palette.primary.main,
                      borderRadius: '4px',
                    })}
                  />
                ))}
              </Stack>
            </NicheRow>
          ))}
        </Stack>
      )}
    </Card>
  );
};
