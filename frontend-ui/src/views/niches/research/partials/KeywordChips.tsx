import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { NicheKeywords } from '../types';

interface KeywordChipsProps {
  keywords: NicheKeywords;
}

const Card = styled(Box)(({ theme }) => ({
  background: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5, 3),
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.vars.palette.text.secondary,
  marginBottom: theme.spacing(1),
}));

const ChipGroup = ({
  chips,
  color,
}: {
  chips: string[];
  color: 'primary' | 'secondary' | 'success' | 'info';
}) => (
  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
    {chips.map((chip) => (
      <Chip
        key={chip}
        label={chip}
        size="small"
        sx={(theme) => ({
          backgroundColor: alpha(theme.palette[color].main, 0.1),
          color: theme.vars.palette[color].main,
          borderRadius: '6px',
          fontWeight: 500,
        })}
      />
    ))}
  </Stack>
);

export const KeywordChips = ({ keywords }: KeywordChipsProps) => {
  const { t } = useTranslation();

  return (
    <Card>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2.5 }}>
        {t('research.keywords.title')}
      </Typography>

      <Stack spacing={2}>
        {keywords.top_focus_keywords.length > 0 && (
          <Box>
            <SectionLabel>{t('research.keywords.focus')}</SectionLabel>
            <ChipGroup chips={keywords.top_focus_keywords} color="primary" />
          </Box>
        )}

        {keywords.main_short_tail.length > 0 && (
          <Box>
            <SectionLabel>{t('research.keywords.shortTail')}</SectionLabel>
            <ChipGroup chips={keywords.main_short_tail} color="secondary" />
          </Box>
        )}

        {keywords.main_long_tail.length > 0 && (
          <Box>
            <SectionLabel>{t('research.keywords.longTail')}</SectionLabel>
            <ChipGroup chips={keywords.main_long_tail} color="info" />
          </Box>
        )}

        {keywords.top_long_tail_keywords.length > 0 && (
          <Box>
            <SectionLabel>{t('research.keywords.longTailTop')}</SectionLabel>
            <ChipGroup chips={keywords.top_long_tail_keywords} color="success" />
          </Box>
        )}

        {keywords.all_keywords_flat && (
          <Box>
            <SectionLabel>{t('research.keywords.allFlat')}</SectionLabel>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
              {keywords.all_keywords_flat}
            </Typography>
          </Box>
        )}
      </Stack>
    </Card>
  );
};
