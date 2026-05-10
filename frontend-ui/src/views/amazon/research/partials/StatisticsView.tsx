import { useCallback } from 'react';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import type { SearchKeywordResult } from '../types';

interface StatisticsViewProps {
  keywordResults: SearchKeywordResult | undefined;
  hasSearched: boolean;
  onKeywordClick: (keyword: string) => void;
  loading?: boolean;
}

const SKELETON_CHIP_WIDTHS = [96, 112, 80, 120, 88, 104];

const SectionBox = styled(Box)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: theme.spacing(2.5),
  marginBottom: theme.spacing(2),
}));

const KeywordItem = styled(Box)({
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
});

const KeywordChip = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'chipColor',
})<{ chipColor: string }>(({ theme, chipColor }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  borderRadius: 16,
  border: `1.5px solid ${chipColor}`,
  backgroundColor: 'transparent',
  padding: theme.spacing(0.5, 1.25),
  cursor: 'pointer',
  transition: 'all 150ms ease',
  '&:hover': {
    backgroundColor: chipColor,
    '& .keyword-text': { color: '#fff' },
    '& .keyword-icon': { color: 'rgba(255,255,255,0.8)' },
  },
}));

const KeywordCount = styled(Typography)(({ theme }) => ({
  fontSize: '0.7rem',
  color: theme.vars.palette.text.secondary,
  marginTop: 3,
  textAlign: 'center',
}));

const StatisticsView = ({
  keywordResults,
  hasSearched,
  onKeywordClick,
  loading = false,
}: StatisticsViewProps) => {
  const { t } = useTranslation();

  const handleClick = useCallback(
    (kw: string) => () => onKeywordClick(kw),
    [onKeywordClick],
  );

  // EC-25: empty state when no search
  if (!hasSearched) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <SearchIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" color="text.secondary" gutterBottom>
          {t('amazonResearch.statistics.runSearchFirst')}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {t('amazonResearch.statistics.runSearchHint')}
        </Typography>
      </Box>
    );
  }

  // Phase 8 — loading state (must precede empty-state branch so the "No
  // keyword data available" text never flashes during in-flight requests).
  if (loading) {
    return (
      <SectionBox>
        <Stack direction="row" sx={{ display: 'inline-flex', gap: 1, flexWrap: 'wrap' }}>
          {SKELETON_CHIP_WIDTHS.map((width, idx) => (
            <Skeleton
              key={idx}
              variant="rounded"
              width={width}
              height={28}
              sx={{ borderRadius: 16 }}
            />
          ))}
        </Stack>
      </SectionBox>
    );
  }

  const focusKeywords = keywordResults?.top_focus_keywords ?? [];
  const longTailKeywords = keywordResults?.top_long_tail_keywords ?? [];

  if (focusKeywords.length === 0 && longTailKeywords.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          {t('amazonResearch.statistics.noKeywordData')}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {t('amazonResearch.statistics.noKeywordHint')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {focusKeywords.length > 0 && (
        <SectionBox>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            {t('amazonResearch.statistics.focusKeywords')} (
            {focusKeywords.length})
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {focusKeywords.map((kw) => (
              <KeywordItem key={kw.keyword}>
                <KeywordChip
                  chipColor="var(--mui-palette-secondary-dark)"
                  onClick={handleClick(kw.keyword)}
                >
                  <Typography
                    className="keyword-text"
                    sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--mui-palette-secondary-dark)' }}
                  >
                    {kw.keyword}
                  </Typography>
                  <SearchIcon className="keyword-icon" sx={{ fontSize: 14, color: 'var(--mui-palette-secondary-dark)', opacity: 0.6 }} />
                </KeywordChip>
                {kw.frequency > 1 && (
                  <KeywordCount>{kw.frequency}</KeywordCount>
                )}
              </KeywordItem>
            ))}
          </Stack>
        </SectionBox>
      )}

      {longTailKeywords.length > 0 && (
        <SectionBox>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            {t('amazonResearch.statistics.longTailKeywords')} (
            {longTailKeywords.length})
          </Typography>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            {longTailKeywords.map((kw) => (
              <KeywordItem key={kw.keyword}>
                <KeywordChip
                  chipColor="var(--mui-palette-info-main)"
                  onClick={handleClick(kw.keyword)}
                >
                  <Typography
                    className="keyword-text"
                    sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--mui-palette-info-main)' }}
                  >
                    {kw.keyword}
                  </Typography>
                  <SearchIcon className="keyword-icon" sx={{ fontSize: 14, color: 'var(--mui-palette-info-main)', opacity: 0.6 }} />
                </KeywordChip>
                {kw.frequency > 1 && (
                  <KeywordCount>{kw.frequency}</KeywordCount>
                )}
              </KeywordItem>
            ))}
          </Stack>
        </SectionBox>
      )}
    </Box>
  );
};

export default StatisticsView;
