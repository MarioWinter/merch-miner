import { Alert, Button, Skeleton, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListingStateBannerProps {
  isLoading: boolean;
  isFetching: boolean;
  notFound: boolean;
  hasError: boolean;
  onRetry: () => void;
  marketplace: string;
}

// ---------------------------------------------------------------------------
// Component — renders a loading skeleton, 404 empty state, or error alert
// for the listing section on the Edit page. Returns null when the listing
// loaded successfully.
//
// The legacy "Generate Listing" CTA was retired with the Generate endpoint
// (Phase O1 / P8). New listings are created via Convert from another
// marketplace tab; the notFound state now surfaces that path as a hint
// rather than a button.
// ---------------------------------------------------------------------------

const ListingStateBanner = ({
  isLoading,
  isFetching,
  notFound,
  hasError,
  onRetry,
  marketplace,
}: ListingStateBannerProps) => {
  const { t } = useTranslation();

  if (isLoading || (isFetching && !notFound && !hasError)) {
    return (
      <Stack gap={1.5} aria-busy="true" aria-live="polite">
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={40} />
        <Skeleton variant="rectangular" height={120} />
      </Stack>
    );
  }

  if (hasError) {
    return (
      <Alert
        severity="error"
        action={
          <Button
            color="inherit"
            size="small"
            startIcon={<RefreshOutlinedIcon />}
            onClick={onRetry}
          >
            {t('publish.edit.listingState.retry', { defaultValue: 'Retry' })}
          </Button>
        }
      >
        {t('publish.edit.listingState.error', {
          defaultValue: 'Failed to load listing for this marketplace.',
        })}
      </Alert>
    );
  }

  if (notFound) {
    return (
      <Alert severity="info">
        {t('publish.edit.listingState.notFound', {
          defaultValue:
            'No listing for {{marketplace}} yet. Convert from another marketplace tab to start editing.',
          marketplace,
        })}
      </Alert>
    );
  }

  return null;
};

export default ListingStateBanner;
