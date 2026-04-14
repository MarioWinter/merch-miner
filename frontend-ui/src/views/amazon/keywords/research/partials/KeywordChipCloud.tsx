import { useState, useMemo } from 'react';
import { Box, Button, Chip, Collapse, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BoltIcon from '@mui/icons-material/Bolt';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import { useTranslation } from 'react-i18next';
import { EASING, DURATION } from '@/style/constants';
import type { KeywordSearchResult } from '../types';

const MAX_VISIBLE = 12;

interface KeywordChipCloudProps {
  results: KeywordSearchResult[];
  activeFilter: string | null;
  onFilterChange: (keyword: string | null) => void;
}

interface ClassifiedKeyword {
  keyword: string;
  productCount: number | null;
}

const CloudSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderRadius: 10,
  background: 'rgba(11, 39, 49, 0.50)',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  marginBottom: theme.spacing(1.5),
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.vars.palette.text.disabled,
  marginBottom: theme.spacing(1),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

const ShortTailChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  borderRadius: 8,
  height: 28,
  fontWeight: 500,
  fontSize: '0.8125rem',
  border: `1px solid ${isActive ? theme.vars.palette.secondary.main : 'rgba(0, 200, 215, 0.30)'}`,
  background: isActive ? 'rgba(0, 200, 215, 0.15)' : 'transparent',
  color: isActive ? theme.vars.palette.secondary.main : theme.vars.palette.text.primary,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    borderColor: theme.vars.palette.secondary.main,
    background: 'rgba(0, 200, 215, 0.10)',
    boxShadow: '0 0 12px rgba(0, 200, 215, 0.15)',
  },
  '& .MuiChip-label': {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
}));

const LongTailChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  borderRadius: 8,
  height: 28,
  fontWeight: 500,
  fontSize: '0.8125rem',
  border: `1px solid ${isActive ? theme.vars.palette.info.main : 'rgba(56, 189, 248, 0.18)'}`,
  background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.06)',
  color: isActive ? theme.vars.palette.info.main : theme.vars.palette.text.primary,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    borderColor: theme.vars.palette.info.main,
    background: 'rgba(56, 189, 248, 0.12)',
    boxShadow: '0 0 12px rgba(56, 189, 248, 0.12)',
  },
}));

const CountBadge = styled('span')(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: theme.vars.palette.text.disabled,
  opacity: 0.8,
}));

const classifyKeywords = (results: KeywordSearchResult[]) => {
  const shortTail: ClassifiedKeyword[] = [];
  const longTail: ClassifiedKeyword[] = [];

  for (const r of results) {
    const wordCount = r.keyword.trim().split(/\s+/).length;
    const item: ClassifiedKeyword = {
      keyword: r.keyword,
      productCount: r.amazon_product_count,
    };
    if (wordCount <= 2) {
      shortTail.push(item);
    } else {
      longTail.push(item);
    }
  }

  return { shortTail, longTail };
};

const ChipSection = ({
  title,
  icon,
  items,
  variant,
  activeFilter,
  onFilterChange,
}: {
  title: string;
  icon: React.ReactNode;
  items: ClassifiedKeyword[];
  variant: 'shortTail' | 'longTail';
  activeFilter: string | null;
  onFilterChange: (keyword: string | null) => void;
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > MAX_VISIBLE;
  const visible = expanded ? items : items.slice(0, MAX_VISIBLE);

  if (items.length === 0) return null;

  const ChipComponent = variant === 'shortTail' ? ShortTailChip : LongTailChip;

  return (
    <CloudSection>
      <SectionLabel>
        {icon}
        {title} ({items.length})
      </SectionLabel>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {visible.map((item) => {
          const isActive = activeFilter === item.keyword;
          return (
            <ChipComponent
              key={item.keyword}
              isActive={isActive}
              size="small"
              label={
                <>
                  {item.keyword}
                  {item.productCount != null && (
                    <CountBadge>{item.productCount.toLocaleString()}</CountBadge>
                  )}
                </>
              }
              onClick={() => onFilterChange(isActive ? null : item.keyword)}
            />
          );
        })}
        {hasMore && (
          <Button
            size="small"
            variant="text"
            onClick={() => setExpanded(!expanded)}
            endIcon={
              expanded ? (
                <ExpandLessIcon sx={{ fontSize: 14 }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 14 }} />
              )
            }
            sx={{
              color: 'text.disabled',
              fontSize: '0.75rem',
              textTransform: 'none',
              '&:hover': { color: 'text.secondary' },
            }}
          >
            {expanded
              ? t('keywords.chipCloud.showLess')
              : t('keywords.chipCloud.showAll', {
                  count: items.length - MAX_VISIBLE,
                })}
          </Button>
        )}
      </Stack>
    </CloudSection>
  );
};

export const KeywordChipCloud = ({
  results,
  activeFilter,
  onFilterChange,
}: KeywordChipCloudProps) => {
  const { t } = useTranslation();
  const { shortTail, longTail } = useMemo(
    () => classifyKeywords(results),
    [results],
  );

  if (results.length === 0) return null;

  return (
    <Collapse in={results.length > 0}>
      <Box sx={{ mb: 1 }}>
        <ChipSection
          title={t('keywords.chipCloud.shortTail')}
          icon={<BoltIcon sx={{ fontSize: 14 }} />}
          items={shortTail}
          variant="shortTail"
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
        <ChipSection
          title={t('keywords.chipCloud.longTail')}
          icon={<AllInclusiveIcon sx={{ fontSize: 14 }} />}
          items={longTail}
          variant="longTail"
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </Box>
    </Collapse>
  );
};
