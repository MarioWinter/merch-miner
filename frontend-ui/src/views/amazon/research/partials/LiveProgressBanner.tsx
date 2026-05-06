import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { ProductSearchStatus } from '../types';

interface LiveProgressBannerProps {
  status: ProductSearchStatus | null;
  productsScraped: number;
  errorLog: string | null;
  onRetry: () => void;
  /** Pages already crawled (from polling status). Optional. */
  pagesDone?: number;
  /** Total pages this scrape will cover. Optional — when unknown we fall back to indeterminate. */
  pagesTotal?: number;
}

const Banner = styled(Box)(({ theme }) => ({
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const LiveProgressBanner = ({
  status,
  productsScraped,
  errorLog,
  onRetry,
  pagesDone,
  pagesTotal,
}: LiveProgressBannerProps) => {
  if (!status) return null;

  if (status === 'cancelled') {
    return null;
  }

  if (status === 'failed') {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            onClick={onRetry}
            aria-label="Retry search"
          >
            Retry
          </Button>
        }
        sx={{ mt: 2 }}
      >
        {errorLog || 'Scrape failed. Please try again.'}
      </Alert>
    );
  }

  if (status === 'pending' || status === 'running') {
    const hasDeterminate =
      typeof pagesTotal === 'number' && pagesTotal > 0 && typeof pagesDone === 'number';
    const percent = hasDeterminate
      ? Math.min(100, Math.round(((pagesDone ?? 0) / (pagesTotal ?? 1)) * 100))
      : null;

    const progressLabel = hasDeterminate
      ? `Scraping Amazon · ${productsScraped} products found · page ${pagesDone}/${pagesTotal}`
      : `Scraping Amazon · ${productsScraped} products found`;

    return (
      <Banner role="status" aria-live="polite">
        <Stack spacing={0.75}>
          <Typography variant="body2" color="text.secondary">
            {progressLabel}
          </Typography>
          {hasDeterminate ? (
            <LinearProgress
              variant="determinate"
              value={percent ?? 0}
              color="secondary"
            />
          ) : (
            <LinearProgress color="secondary" />
          )}
        </Stack>
      </Banner>
    );
  }

  return null;
};

export default LiveProgressBanner;
