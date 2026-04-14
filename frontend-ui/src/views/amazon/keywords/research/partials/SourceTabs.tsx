import { useMemo } from 'react';
import { Box, Chip, Tab, Tabs, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import LockIcon from '@mui/icons-material/Lock';
import { useTranslation } from 'react-i18next';
import type { KeywordSearchResult, KeywordSource } from '../types';

export type SourceFilter = 'all' | 'database' | 'amazon' | 'junglescout';

interface SourceTabsProps {
  results: KeywordSearchResult[];
  value: SourceFilter;
  onChange: (filter: SourceFilter) => void;
}

const DATABASE_SOURCES: KeywordSource[] = ['research', 'web_search', 'manual'];
const AMAZON_SOURCES: KeywordSource[] = ['amazon_search'];

const CountChip = styled(Chip)({
  height: 18,
  fontSize: '0.6875rem',
  fontWeight: 600,
  marginLeft: 6,
  background: 'rgba(255, 255, 255, 0.08)',
});

const tabSx = {
  minHeight: 40,
  py: 0.5,
  textTransform: 'none',
  fontWeight: 500,
  fontSize: '0.8125rem',
  '&.Mui-selected': { fontWeight: 600 },
} as const;

const computeCounts = (results: KeywordSearchResult[]) => {
  let database = 0;
  let amazon = 0;

  for (const r of results) {
    if (DATABASE_SOURCES.includes(r.source)) database++;
    if (AMAZON_SOURCES.includes(r.source)) amazon++;
  }

  return { all: results.length, database, amazon };
};

const TabLabel = ({ text, count }: { text: string; count: number }) => (
  <Box sx={{ display: 'flex', alignItems: 'center' }}>
    {text}
    <CountChip label={count} size="small" />
  </Box>
);

export const SourceTabs = ({ results, value, onChange }: SourceTabsProps) => {
  const { t } = useTranslation();
  const counts = useMemo(() => computeCounts(results), [results]);

  return (
    <Tabs
      value={value}
      onChange={(_, newValue: SourceFilter) => onChange(newValue)}
      sx={{
        minHeight: 40,
        mb: 0.5,
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        '& .MuiTabs-indicator': {
          height: 2,
          borderRadius: '2px 2px 0 0',
          background: (theme) =>
            `linear-gradient(90deg, ${theme.vars.palette.primary.main}, ${theme.vars.palette.primary.light})`,
          boxShadow: '0 0 8px rgba(255, 90, 79, 0.40)',
        },
      }}
    >
      <Tab
        label={<TabLabel text={t('keywords.sourceTabs.all')} count={counts.all} />}
        value="all"
        sx={tabSx}
      />
      <Tab
        label={<TabLabel text={t('keywords.sourceTabs.database')} count={counts.database} />}
        value="database"
        sx={tabSx}
      />
      <Tab
        label={<TabLabel text={t('keywords.sourceTabs.amazon')} count={counts.amazon} />}
        value="amazon"
        sx={tabSx}
      />
      <Tooltip title={t('keywords.sourceTabs.comingSoon')}>
        <span>
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {t('keywords.sourceTabs.junglescout')}
                <LockIcon sx={{ fontSize: 12, opacity: 0.5 }} />
              </Box>
            }
            value="junglescout"
            disabled
            sx={tabSx}
          />
        </span>
      </Tooltip>
    </Tabs>
  );
};
