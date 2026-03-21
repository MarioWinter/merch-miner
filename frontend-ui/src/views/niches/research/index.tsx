import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useNicheResearch } from './hooks/useNicheResearch';
import { ResearchTriggerButton } from './partials/ResearchTriggerButton';
import { ResearchProgress } from './partials/ResearchProgress';
import { NicheSummaryCard } from './partials/NicheSummaryCard';
import { PatternGrid } from './partials/PatternGrid';
import { KeywordChips } from './partials/KeywordChips';
import { ProductAnalysisCard } from './partials/ProductAnalysisCard';
import { RelatedNiches } from './partials/RelatedNiches';
import { ResearchErrorState } from './partials/ResearchErrorState';
import { ResearchEmptyState } from './partials/ResearchEmptyState';

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

  const {
    data,
    isLoading,
    isPolling,
    error,
    triggerResearch,
    cancelResearch,
  } = useNicheResearch(nicheId);

  const status = data?.status ?? null;
  const isRunning = status === 'pending' || status === 'running' || isPolling;
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isTimeout = !data && !!error;
  const hasNoResearch = !data && !isLoading && !error;

  return (
    <Box>
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
        />
      </PageHeader>

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
            <PatternGrid patterns={data.analysis.pattern_analysis} />
          )}

          {/* Keywords */}
          {data.keywords && (
            <KeywordChips keywords={data.keywords} />
          )}

          {/* Products */}
          {data.products.length > 0 && (
            <Box>
              <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
                {t('research.products.title')}
              </Typography>
              <Stack spacing={1.5}>
                {data.products.map((product) => (
                  <ProductAnalysisCard key={product.asin} product={product} />
                ))}
              </Stack>
            </Box>
          )}

          {/* Related niches */}
          <RelatedNiches niches={data.related_niches} />
        </Stack>
      )}
    </Box>
  );
};

export default NicheResearchView;
