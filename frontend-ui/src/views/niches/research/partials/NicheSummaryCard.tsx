import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import { useTranslation } from 'react-i18next';
import type { NicheAnalysis, SentimentType } from '../types';

interface NicheSummaryCardProps {
  analysis: NicheAnalysis;
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

const SENTIMENT_CONFIG: Record<
  SentimentType,
  { color: 'success' | 'warning' | 'error'; icon: typeof SentimentSatisfiedAltIcon }
> = {
  Positive: { color: 'success', icon: SentimentSatisfiedAltIcon },
  Neutral: { color: 'warning', icon: SentimentNeutralIcon },
  Negative: { color: 'error', icon: SentimentDissatisfiedIcon },
};

export const NicheSummaryCard = ({ analysis }: NicheSummaryCardProps) => {
  const { t } = useTranslation();
  const sentimentCfg = SENTIMENT_CONFIG[analysis.sentiment] ?? SENTIMENT_CONFIG.Neutral;
  const SentimentIcon = sentimentCfg.icon;

  return (
    <Card>
      <Stack spacing={2.5}>
        {/* Summary */}
        <Box>
          <SectionLabel>{t('research.summary.title')}</SectionLabel>
          <Typography variant="body1">{analysis.niche_summary}</Typography>
        </Box>

        {/* Sentiment + Emotions row */}
        <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="flex-start">
          <Box>
            <SectionLabel>{t('research.summary.sentiment')}</SectionLabel>
            <Chip
              icon={<SentimentIcon sx={{ fontSize: 18 }} />}
              label={analysis.sentiment}
              color={sentimentCfg.color}
              size="small"
              variant="outlined"
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <SectionLabel>{t('research.summary.emotions')}</SectionLabel>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
              {analysis.primary_emotions.map((emotion) => (
                <Chip
                  key={emotion}
                  label={emotion}
                  size="small"
                  sx={(theme) => ({
                    backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                    color: theme.vars.palette.secondary.main,
                    borderRadius: '6px',
                  })}
                />
              ))}
            </Stack>
          </Box>
        </Stack>

        {/* Archetypes */}
        <Box>
          <SectionLabel>{t('research.summary.archetypes')}</SectionLabel>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {analysis.emotional_archetype.map((archetype) => (
              <Chip
                key={archetype}
                label={archetype}
                size="small"
                sx={(theme) => ({
                  backgroundColor: alpha(theme.palette.primary.main, 0.12),
                  color: theme.vars.palette.primary.main,
                  borderRadius: '6px',
                  fontWeight: 600,
                })}
              />
            ))}
          </Stack>
        </Box>

        {/* Emotional Reality */}
        <Box>
          <SectionLabel>{t('research.summary.emotionalReality')}</SectionLabel>
          <Typography variant="body2" color="text.secondary">
            {analysis.emotional_reality}
          </Typography>
        </Box>

        {/* Design Concepts */}
        <Box>
          <SectionLabel>{t('research.summary.designConcepts')}</SectionLabel>
          <Typography variant="body2" color="text.secondary">
            {analysis.design_concepts}
          </Typography>
        </Box>

        {/* Design Aesthetics */}
        <Box>
          <SectionLabel>{t('research.summary.designAesthetics')}</SectionLabel>
          <Typography variant="body2" color="text.secondary">
            {analysis.dominant_design_aesthetics}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
};
