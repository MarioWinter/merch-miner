/**
 * PROJ-30 T3.11 — vertical card list mirroring KeywordTable rows for
 * `<744px` viewports.
 */
import { Box, Chip, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { MobileCard } from '@/components/MobileCard';
import { MONO_FONT_STACK } from '@/style/constants';
import { SourceBadge } from './SourceBadge';
import type { KeywordSearchResult } from '../types';

interface KeywordCardListProps {
  rows: KeywordSearchResult[];
  selectedKeywords: string[];
  onSelectionChange: (keywords: string[]) => void;
  onKeywordClick: (keyword: string) => void;
}

const formatVolume = (v: number | null): string =>
  v == null ? '—' : v.toLocaleString();

const formatCpc = (v: number | null): string =>
  v == null ? '—' : v.toFixed(2);

export const KeywordCardList = ({
  rows,
  selectedKeywords,
  onSelectionChange,
  onKeywordClick,
}: KeywordCardListProps) => {
  const { t } = useTranslation();
  const selectedSet = new Set(selectedKeywords);

  const toggleSelect = (keyword: string) => {
    if (selectedSet.has(keyword)) {
      onSelectionChange(selectedKeywords.filter((k) => k !== keyword));
    } else {
      onSelectionChange([...selectedKeywords, keyword]);
    }
  };

  return (
    <Stack spacing={1} role="list" aria-label={t('keywords.page.title')}>
      {rows.map((row) => {
        const volume = row.js_data?.monthly_search_volume_exact ?? null;
        const cpc = row.js_data?.ppc_bid_exact ?? null;
        const ranking = row.js_data?.ease_of_ranking_score ?? null;

        const primaryMeta =
          volume != null && cpc != null
            ? t('responsive.cardList.keyword.meta', {
                volume: formatVolume(volume),
                cpc: formatCpc(cpc),
              })
            : volume != null
              ? t('responsive.cardList.keyword.metaNoCpc', { volume: formatVolume(volume) })
              : cpc != null
                ? t('responsive.cardList.keyword.metaNoVolume', { cpc: formatCpc(cpc) })
                : '—';

        return (
          <MobileCard
            key={row.keyword}
            title={
              <Box component="span" sx={{ fontFamily: MONO_FONT_STACK, fontSize: '0.9375rem' }}>
                {row.keyword}
              </Box>
            }
            primaryMeta={primaryMeta}
            secondaryMeta={
              ranking != null ? (
                <Typography variant="caption" color="text.disabled">
                  {t('responsive.cardList.keyword.competition', { value: `${ranking}/10` })}
                </Typography>
              ) : undefined
            }
            chips={
              <>
                <SourceBadge source={row.source} />
                {row.amazon_product_count != null && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`>${row.amazon_product_count.toLocaleString()}`}
                  />
                )}
              </>
            }
            selectable
            selected={selectedSet.has(row.keyword)}
            onToggleSelect={() => toggleSelect(row.keyword)}
            selectAriaLabel={t('responsive.cardList.selectAria', { title: row.keyword })}
            onActivate={() => onKeywordClick(row.keyword)}
          />
        );
      })}
    </Stack>
  );
};

export default KeywordCardList;
