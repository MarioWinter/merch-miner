import { Alert, Box, Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';

interface ResearchErrorStateProps {
  errorMessage?: string;
  isTimeout?: boolean;
  onRetry: () => void;
  retryCount?: number;
  maxRetries?: number;
}

const Wrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(6, 3),
  gap: theme.spacing(2),
}));

export const ResearchErrorState = ({
  errorMessage,
  isTimeout,
  onRetry,
  retryCount = 0,
  maxRetries = 3,
}: ResearchErrorStateProps) => {
  const { t } = useTranslation();
  const retriesExceeded = retryCount >= maxRetries;

  const title = isTimeout
    ? t('research.error.timeoutTitle')
    : t('research.error.title');

  const message = isTimeout
    ? t('research.error.timeoutMessage')
    : errorMessage;

  return (
    <Wrapper>
      <ErrorOutlineIcon sx={{ fontSize: 48, color: 'error.main' }} />
      <Typography variant="h5" fontWeight={600}>
        {title}
      </Typography>
      {message && (
        <Alert severity="error" sx={{ maxWidth: 480, width: '100%' }}>
          {message}
        </Alert>
      )}
      <Button
        variant="contained"
        color="primary"
        startIcon={<RefreshIcon />}
        onClick={onRetry}
        disabled={retriesExceeded}
        sx={{ mt: 1 }}
      >
        {retriesExceeded
          ? t('research.maxRetriesExceeded')
          : t('research.retryCount', { current: retryCount, max: maxRetries })}
      </Button>
    </Wrapper>
  );
};
