import { Alert, Button, Skeleton, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListingStateBannerProps {
  isLoading: boolean;
  isFetching: boolean;
  notFound: boolean;
  hasError: boolean;
  onGenerate: () => void;
  onRetry: () => void;
  isGenerating: boolean;
  marketplace: string;
}

// ---------------------------------------------------------------------------
// Component — renders a loading skeleton, 404 empty state, or error alert
// for the listing section on the Edit page. Returns null when the listing
// loaded successfully.
// ---------------------------------------------------------------------------

const ListingStateBanner = ({
  isLoading,
  isFetching,
  notFound,
  hasError,
  onGenerate,
  onRetry,
  isGenerating,
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
      <Alert
        severity="info"
        action={
          <Button
            color="inherit"
            size="small"
            startIcon={<AutoAwesomeOutlinedIcon />}
            onClick={onGenerate}
            disabled={isGenerating}
          >
            {isGenerating
              ? t('publish.edit.listingState.generating', {
                  defaultValue: 'Generating...',
                })
              : t('publish.edit.listingState.generate', {
                  defaultValue: 'Generate Listing',
                })}
          </Button>
        }
      >
        {t('publish.edit.listingState.notFound', {
          defaultValue: 'No listing for {{marketplace}} yet. Generate one or start typing to save.',
          marketplace,
        })}
      </Alert>
    );
  }

  return null;
};

export default ListingStateBanner;
