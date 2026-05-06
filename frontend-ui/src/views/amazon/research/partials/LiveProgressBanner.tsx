import { Alert, Box, Button, Grid, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { ProductSearchStatus } from '../types';

interface LiveProgressBannerProps {
  status: ProductSearchStatus | null;
  productsScraped: number;
  errorLog: string | null;
  onRetry: () => void;
  loadedCount?: number;
}

const SkeletonCard = styled(Box)(({ theme }) => ({
  height: 370,
  borderRadius: 12,
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  overflow: 'hidden',
}));

const SKELETON_COUNT = 8;

const LiveProgressBanner = ({
  status,
  productsScraped,
  errorLog,
  onRetry,
  loadedCount = 0,
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
    // Page 2+ fetch: existing products are already on screen — Virtuoso's
    // footer renders the loading spinner, so this banner stays out of the way.
    if (loadedCount > 0) return null;

    // First-page fetch: cover the products area with placeholder cards.
    const remaining = Math.max(0, productsScraped - loadedCount);
    const count = remaining > 0 ? Math.min(remaining, SKELETON_COUNT) : SKELETON_COUNT;

    return (
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {[...Array(count)].map((_, i) => (
          <Grid key={i} size={{ xs: 6, sm: 6, md: 4, lg: 3 }}>
            <SkeletonCard>
              <Skeleton variant="rectangular" height={220} animation="wave" />
              <Box sx={{ p: 1.5 }}>
                <Skeleton variant="text" width="80%" animation="wave" />
                <Skeleton variant="text" width="60%" animation="wave" />
                <Skeleton variant="text" width="40%" animation="wave" />
              </Box>
            </SkeletonCard>
          </Grid>
        ))}
      </Grid>
    );
  }

  return null;
};

export default LiveProgressBanner;
