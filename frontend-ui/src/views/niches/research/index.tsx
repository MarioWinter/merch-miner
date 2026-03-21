import { useCallback, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useGetNicheQuery } from '@/store/nicheSlice';
import { useNicheResearch } from './hooks/useNicheResearch';
import { ResearchTriggerButton } from './partials/ResearchTriggerButton';
import { ResearchProgress } from './partials/ResearchProgress';
import { NicheSummaryCard } from './partials/NicheSummaryCard';
import { PatternGrid } from './partials/PatternGrid';
import { KeywordChips } from './partials/KeywordChips';
import { GroupedProductAnalysis } from './partials/GroupedProductAnalysis';
import { normalizePatternKey } from './partials/patternConfig';
import { RelatedNiches } from './partials/RelatedNiches';
import { ResearchErrorState } from './partials/ResearchErrorState';
import { ResearchEmptyState } from './partials/ResearchEmptyState';
import { NicheDetailDrawer } from '../list/partials/NicheDetailDrawer';
import type { Marketplace, ProductType } from './types';

const PageHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(3),
}));

const LoadingWrapper = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  padding: '64px 0',
});

const NicheResearchView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nicheId = searchParams.get('nicheId');
  const nicheName = searchParams.get('nicheName') ?? '';
  const initialMarketplace = searchParams.get('marketplace') as Marketplace | null;
  const initialProductType = searchParams.get('product_type') as ProductType | null;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [showHint, setShowHint] = useState(
    () => localStorage.getItem('research_dblclick_hint_seen') !== 'true',
  );

  const handleDoubleClick = useCallback(() => {
    if (!nicheId) return;
    if (showHint) {
      localStorage.setItem('research_dblclick_hint_seen', 'true');
      setShowHint(false);
    }
    setDrawerOpen(true);
  }, [nicheId, showHint]);

  const { data: nicheData } = useGetNicheQuery(nicheId ?? '', { skip: !nicheId });

  const {
    data,
    isLoading,
    isPolling,
    error,
    triggerResearch,
    cancelResearch,
  } = useNicheResearch(nicheId);

  const products = data?.products;
  const productCounts = useMemo(() => {
    if (!products) return {};
    const counts: Record<string, number> = {};
    for (const p of products) {
      const raw = p.emotional_analysis?.emotional_pattern;
      if (raw) {
        const pattern = normalizePatternKey(raw);
        counts[pattern] = (counts[pattern] ?? 0) + 1;
      }
    }
    return counts;
  }, [products]);

  const status = data?.status ?? null;
  const isRunning = status === 'pending' || status === 'running' || isPolling;
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isTimeout = !data && !!error;
  const hasNoResearch = !data && !isLoading && !error;

  return (
    <Box onDoubleClick={handleDoubleClick} sx={{ cursor: 'default' }}>
      <PageHeader>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            size="small"
            onClick={() => navigate('/niches')}
            aria-label="Back to niches"
            sx={{ borderRadius: '8px' }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              {nicheName || t('research.triggerButton')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('research.triggerButton')}
            </Typography>
          </Box>
        </Stack>
        <ResearchTriggerButton
          status={status}
          isPolling={isPolling}
          onTrigger={triggerResearch}
          onCancel={cancelResearch}
          initialMarketplace={initialMarketplace ?? undefined}
          initialProductType={initialProductType ?? undefined}
        />
      </PageHeader>

      {showHint && (
        <Typography variant="caption" color="text.disabled" sx={{ mb: 1, display: 'block' }}>
          {t('research.doubleClickHint')}
        </Typography>
      )}

      {/* Loading */}
      {isLoading && (
        <LoadingWrapper>
          <CircularProgress />
        </LoadingWrapper>
      )}

      {/* Running / polling */}
      {!isLoading && isRunning && data && (
        <ResearchProgress
          status={data.status}
          completedNodes={data.completed_nodes}
          currentNode={data.current_node}
          totalNodes={data.total_nodes}
        />
      )}

      {/* Error (failed or timeout) */}
      {!isLoading && (isFailed || isTimeout) && (
        <ResearchErrorState
          errorMessage={data?.error_message ?? error ?? undefined}
          isTimeout={isTimeout}
          onRetry={() => triggerResearch()}
          retryCount={data?.retry_count ?? 0}
          maxRetries={3}
        />
      )}

      {/* Empty — no research yet */}
      {!isLoading && hasNoResearch && (
        <ResearchEmptyState />
      )}

      {/* Completed results */}
      {!isLoading && isCompleted && data && (
        <Stack spacing={3}>
          {/* Summary */}
          {data.analysis && (
            <NicheSummaryCard analysis={data.analysis} />
          )}

          {/* Patterns */}
          {data.analysis?.pattern_analysis && (
            <PatternGrid
              patterns={data.analysis.pattern_analysis}
              productCounts={productCounts}
              onPatternClick={(name) => {
                document
                  .getElementById(`pattern-${name}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          )}

          {/* Keywords */}
          {data.keywords && (
            <KeywordChips keywords={data.keywords} nicheId={nicheId!} />
          )}

          {/* Brand filter info */}
          {data.brand_filtered_count > 0 && (
            <Alert severity="info" variant="outlined">
              {t('research.brandFiltered', { count: data.brand_filtered_count })}
            </Alert>
          )}

          {/* Products grouped by pattern */}
          {data.products.length > 0 && (
            <GroupedProductAnalysis
              products={data.products}
              nicheId={nicheId!}
            />
          )}

          {/* Related niches */}
          <RelatedNiches niches={data.related_niches} />
        </Stack>
      )}

      <NicheDetailDrawer
        open={drawerOpen}
        mode="edit"
        selectedId={nicheId}
        niche={nicheData}
        onClose={() => setDrawerOpen(false)}
      />
    </Box>
  );
};

export default NicheResearchView;
