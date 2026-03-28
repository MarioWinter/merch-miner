import { Box, Button, LinearProgress, Skeleton, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';
import type { DesignGenerationRun } from '../types';

interface GenerationProgressProps {
  run: DesignGenerationRun | null;
  isGenerating: boolean;
  onRetry?: () => void;
}

export const GenerationProgress = ({
  run,
  isGenerating,
  onRetry,
}: GenerationProgressProps) => {
  const { t } = useTranslation();

  if (!isGenerating && !run) return null;

  // Active generation
  if (isGenerating && run?.status !== 'failed') {
    return (
      <Box sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('design.board.generating')}
        </Typography>
        <LinearProgress color="secondary" />
        <Skeleton variant="rectangular" height={200} sx={{ mt: 2, borderRadius: 2 }} />
      </Box>
    );
  }

  // Failed state
  if (run?.status === 'failed') {
    return (
      <Box
        sx={{
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <ErrorOutlineIcon sx={{ fontSize: 40, color: 'error.main' }} />
        <Typography variant="body2" color="error.main">
          {run.error_message || t('design.board.generationFailed')}
        </Typography>
        {onRetry && (
          <Button size="small" variant="outlined" onClick={onRetry}>
            {t('design.board.retry')}
          </Button>
        )}
      </Box>
    );
  }

  return null;
};
