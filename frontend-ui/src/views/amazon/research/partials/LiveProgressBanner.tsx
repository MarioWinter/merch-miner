import { Alert, Box, Button, Grid, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { ProductSearchStatus } from '../types';

interface LiveProgressBannerProps {
  status: ProductSearchStatus | null;
  pagesDone: number;
  productsScraped: number;
  errorLog: string | null;
  onRetry: () => void;
  showSkeletons?: boolean;
  loadedCount?: number;
}

const SkeletonCard = styled(Box)(({ theme }) => ({
  height: 370,
  borderRadius: 12,
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  overflow: 'hidden',
}));

const LiveProgressBanner = ({
  status,
  pagesDone,
  productsScraped,
  errorLog,
  onRetry,
  showSkeletons = false,
  loadedCount = 0,
}: LiveProgressBannerProps) => {
  if (!status) return null;

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
    // Calculate skeleton count: show placeholders for expected products
    const skeletonCount = showSkeletons
      ? Math.max(0, productsScraped - loadedCount)
      : 0;

    return (
      <Box sx={{ mt: 2 }}>
        <LinearProgress color="secondary" />
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Scraping Amazon...
            {pagesDone > 0 && ` Page ${pagesDone}`}
          </Typography>
          {productsScraped > 0 && (
            <Typography variant="caption" color="text.secondary">
              {productsScraped} products found
            </Typography>
          )}
        </Stack>

        {/* Skeleton cards for streaming effect */}
        {skeletonCount > 0 && (
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {[...Array(Math.min(skeletonCount, 8))].map((_, i) => (
              <Grid key={i} size={{ xs: 6, sm: 6, md: 4, lg: 3 }}>
                <SkeletonCard>
                  <Skeleton variant="rectangular" height={220} />
                  <Skeleton variant="rectangular" height={30} sx={{ mt: 0 }} />
                  <Box sx={{ p: 1.5 }}>
                    <Skeleton variant="text" width="80%" />
                    <Skeleton variant="text" width="60%" />
                  </Box>
                </SkeletonCard>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    );
  }

  return null;
};

export default LiveProgressBanner;
