import { useState, useMemo, useCallback } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useTranslation } from 'react-i18next';
import type { ResearchProduct } from '../types';
import { normalizePatternKey } from './patternConfig';
import { PatternProductGroup } from './PatternProductGroup';

interface GroupedProductAnalysisProps {
  products: ResearchProduct[];
  nicheId: string;
  marketplace: string;
}

const UNCATEGORIZED = 'Uncategorized';

export const GroupedProductAnalysis = ({
  products,
  nicheId,
  marketplace,
}: GroupedProductAnalysisProps) => {
  const { t } = useTranslation();

  const groups = useMemo(() => {
    const map = new Map<string, ResearchProduct[]>();

    for (const product of products) {
      const rawPattern = product.emotional_analysis?.emotional_pattern;
      const key = rawPattern ? normalizePatternKey(rawPattern) : UNCATEGORIZED;
      const list = map.get(key) ?? [];
      list.push(product);
      map.set(key, list);
    }

    // Sort by count descending, "Uncategorized" always last
    const sorted = [...map.entries()].sort((a, b) => {
      if (a[0] === UNCATEGORIZED) return 1;
      if (b[0] === UNCATEGORIZED) return -1;
      return b[1].length - a[1].length;
    });

    return sorted;
  }, [products]);

  const allKeys = useMemo(() => groups.map(([key]) => key), [groups]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(allKeys),
  );

  const allExpanded = expandedGroups.size === allKeys.length;

  const handleToggleAll = useCallback(() => {
    setExpandedGroups(allExpanded ? new Set() : new Set(allKeys));
  }, [allExpanded, allKeys]);

  const handleToggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  if (products.length === 0) return null;

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h5" fontWeight={600}>
          {t('research.products.title')}
        </Typography>
        <Button
          variant="text"
          size="small"
          onClick={handleToggleAll}
          startIcon={allExpanded ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
          sx={{ color: 'text.secondary' }}
        >
          {allExpanded
            ? t('research.products.collapseAll')
            : t('research.products.expandAll')}
        </Button>
      </Box>

      <Stack spacing={1.5}>
        {groups.map(([patternName, groupProducts]) => (
          <Box key={patternName} id={`pattern-${patternName}`}>
            <PatternProductGroup
              patternName={patternName}
              products={groupProducts}
              nicheId={nicheId}
              marketplace={marketplace}
              expanded={expandedGroups.has(patternName)}
              onToggle={() => handleToggleGroup(patternName)}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  );
};
