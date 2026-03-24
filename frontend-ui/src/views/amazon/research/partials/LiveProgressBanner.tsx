import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { ProductSearchStatus } from '../types';

interface LiveProgressBannerProps {
  status: ProductSearchStatus | null;
  pagesDone: number;
  productsScraped: number;
  errorLog: string | null;
  onRetry: () => void;
}

const LiveProgressBanner = ({
  status,
  pagesDone,
  productsScraped,
  errorLog,
  onRetry,
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
      </Box>
    );
  }

  return null;
};

export default LiveProgressBanner;
