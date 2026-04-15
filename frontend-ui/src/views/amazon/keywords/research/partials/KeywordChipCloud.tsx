import { useState, useMemo } from 'react';
import { Box, Button, Chip, Collapse, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BoltIcon from '@mui/icons-material/Bolt';
import AllInclusiveIcon from '@mui/icons-material/AllInclusive';
import { useTranslation } from 'react-i18next';
import { SectionCard } from '@/components/SectionCard';
import { SectionLabel } from '@/components/SectionLabel';
import { EASING, DURATION, MONO_FONT_STACK } from '@/style/constants';
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

const classifyKeywords = (results: KeywordSearchResult[]) => {
  const shortTail: ClassifiedKeyword[] = [];
  const longTail: ClassifiedKeyword[] = [];

  for (const r of results) {
    const wordCount = r.keyword.trim().split(/\s+/).length;
    const item: ClassifiedKeyword = {
      keyword: r.keyword,
      productCount: r.amazon_product_count,
    };
    if (wordCount <= 2) shortTail.push(item);
    else longTail.push(item);
  }

  return { shortTail, longTail };
};

interface ChipSectionProps {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  items: ClassifiedKeyword[];
  variant: 'shortTail' | 'longTail';
  activeFilter: string | null;
  onFilterChange: (keyword: string | null) => void;
}

const ChipSection = ({
  title,
  icon,
  iconColor,
  items,
  variant,
  activeFilter,
  onFilterChange,
}: ChipSectionProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasMore = items.length > MAX_VISIBLE;
  const visible = expanded ? items : items.slice(0, MAX_VISIBLE);

  if (items.length === 0) return null;

  const isShort = variant === 'shortTail';

  return (
    <SectionCard sx={{ mb: 1.5 }}>
      <SectionLabel icon={icon} label={title} count={items.length} iconColor={iconColor} />
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
        {visible.map((item) => {
          const isActive = activeFilter === item.keyword;
          return (
            <Chip
              key={item.keyword}
              size="small"
              onClick={() => onFilterChange(isActive ? null : item.keyword)}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {item.keyword}
                  {item.productCount != null && (
                    <>
                      <Box
                        component="span"
                        sx={{ color: 'text.disabled', fontSize: '0.6875rem' }}
                      >
                        ·
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          fontFamily: MONO_FONT_STACK,
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: 'text.disabled',
                        }}
                      >
                        {item.productCount.toLocaleString()}
                      </Box>
                    </>
                  )}
                </Box>
              }
              sx={(theme) => ({
                borderRadius: '8px',
                height: 28,
                fontWeight: 500,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: `all ${DURATION.fast}ms ${EASING.standard}`,
                backgroundColor: isActive
                  ? alpha(
                      isShort
                        ? theme.palette.secondary.main
                        : theme.palette.info.main,
                      isShort ? 0.20 : 0.15,
                    )
                  : alpha(
                      isShort
                        ? theme.palette.secondary.main
                        : theme.palette.info.main,
                      isShort ? 0.10 : 0.08,
                    ),
                color: isActive
                  ? isShort
                    ? theme.vars.palette.secondary.main
                    : theme.vars.palette.info.main
                  : theme.vars.palette.text.primary,
                border: `1px solid ${alpha(
                  isShort
                    ? theme.palette.secondary.main
                    : theme.palette.info.main,
                  isActive ? (isShort ? 0.30 : 0.18) : isShort ? 0.30 : 0.18,
                )}`,
                '&:hover': {
                  borderColor: isShort
                    ? theme.vars.palette.secondary.main
                    : theme.vars.palette.info.main,
                  backgroundColor: alpha(
                    isShort
                      ? theme.palette.secondary.main
                      : theme.palette.info.main,
                    isShort ? 0.15 : 0.12,
                  ),
                },
              })}
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
    </SectionCard>
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
          icon={<BoltIcon />}
          iconColor="secondary.main"
          items={shortTail}
          variant="shortTail"
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
        <ChipSection
          title={t('keywords.chipCloud.longTail')}
          icon={<AllInclusiveIcon />}
          iconColor="info.main"
          items={longTail}
          variant="longTail"
          activeFilter={activeFilter}
          onFilterChange={onFilterChange}
        />
      </Box>
    </Collapse>
  );
};
