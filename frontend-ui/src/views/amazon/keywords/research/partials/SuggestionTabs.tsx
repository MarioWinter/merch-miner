import { Box, Chip, Tab, Tabs, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import LockIcon from '@mui/icons-material/Lock';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useTranslation } from 'react-i18next';
import type { SuggestionCounts, SuggestionSource } from '../types';

export type SuggestionFilter = SuggestionSource | 'all';

interface SuggestionTabsProps {
  counts: SuggestionCounts;
  value: SuggestionFilter;
  onChange: (filter: SuggestionFilter) => void;
}

const tabSx = {
  minHeight: 40,
  py: 0.5,
  textTransform: 'none',
  fontWeight: 500,
  fontSize: '0.8125rem',
  '&.Mui-selected': { fontWeight: 600 },
} as const;

const TabLabel = ({ text, count }: { text: string; count: number }) => (
  <Box sx={{ display: 'flex', alignItems: 'center' }}>
    {text}
    <Chip
      label={count}
      size="small"
      sx={(theme) => ({
        height: 18,
        fontSize: '0.6875rem',
        fontWeight: 600,
        ml: 0.75,
        backgroundColor: alpha(theme.palette.text.primary, 0.08),
      })}
    />
  </Box>
);

export const SuggestionTabs = ({ counts, value, onChange }: SuggestionTabsProps) => {
  const { t } = useTranslation();

  return (
    <Tabs
      value={value}
      onChange={(_, newValue: SuggestionFilter) => onChange(newValue)}
      sx={(theme) => ({
        minHeight: 40,
        mb: 0.5,
        borderBottom: `1px solid ${theme.vars.palette.divider}`,
        '& .MuiTabs-indicator': {
          height: 2,
          borderRadius: '2px 2px 0 0',
          background: `linear-gradient(90deg, ${theme.vars.palette.primary.main}, ${theme.vars.palette.primary.light})`,
          boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`,
        },
      })}
    >
      <Tab
        label={<TabLabel text={t('keywords.suggestionTabs.all')} count={counts.all} />}
        value="all"
        sx={tabSx}
      />
      <Tab
        icon={<InventoryIcon sx={{ fontSize: 16 }} />}
        iconPosition="start"
        label={<TabLabel text={t('keywords.suggestionTabs.listing')} count={counts.listing} />}
        value="listing"
        sx={{ ...tabSx, gap: 0.5 }}
      />
      <Tab
        label={<TabLabel text={t('keywords.suggestionTabs.suggestions')} count={counts.suggestion} />}
        value="suggestion"
        sx={tabSx}
      />
      <Tab
        label={<TabLabel text={t('keywords.suggestionTabs.after')} count={counts.after} />}
        value="after"
        sx={tabSx}
      />
      <Tab
        label={<TabLabel text={t('keywords.suggestionTabs.before')} count={counts.before} />}
        value="before"
        sx={tabSx}
      />
      <Tab
        label={<TabLabel text={t('keywords.suggestionTabs.synonyms')} count={counts.synonym} />}
        value="synonym"
        sx={tabSx}
      />
      <Tooltip title={t('keywords.suggestionTabs.comingSoon')}>
        <span>
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {t('keywords.suggestionTabs.junglescout')}
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
