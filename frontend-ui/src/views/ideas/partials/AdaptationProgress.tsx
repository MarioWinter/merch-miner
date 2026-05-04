import {
  Box,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { IdeaAdaptationRun, NicheAdaptationResult } from '../types';

interface AdaptationProgressProps {
  run: IdeaAdaptationRun;
}

const STATUS_CHIP_COLOR: Record<
  string,
  'default' | 'info' | 'success' | 'error' | 'warning'
> = {
  pending: 'default',
  running: 'info',
  approved: 'success',
  rejected: 'warning',
  failed: 'error',
};

export const AdaptationProgress = ({ run }: AdaptationProgressProps) => {
  const { t } = useTranslation();

  const nicheResults = run.niche_results ?? {};
  const entries = Object.entries(nicheResults) as [
    string,
    NicheAdaptationResult,
  ][];
  const isRunning = run.status === 'running' || run.status === 'pending';

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 2,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1.5 }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {t('ideas.adapt.progress')}
        </Typography>
        <Chip
          label={t(`ideas.adapt.runStatus.${run.status}`)}
          size="small"
          color={STATUS_CHIP_COLOR[run.status]}
          sx={{ borderRadius: '6px', fontSize: '0.6875rem', height: 22 }}
        />
      </Stack>

      {isRunning && (
        <LinearProgress
          color="secondary"
          sx={{ mb: 1.5, borderRadius: 1 }}
        />
      )}

      {run.current_node && isRunning && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
          {t('ideas.adapt.currentNode', { node: run.current_node })}
        </Typography>
      )}

      {entries.length > 0 && (
        <Stack spacing={0.75}>
          {entries.map(([nicheId, result]) => (
            <Stack
              key={nicheId}
              direction="row"
              alignItems="center"
              spacing={1}
            >
              <Chip
                size="small"
                color={STATUS_CHIP_COLOR[result.status]}
                variant="outlined"
                sx={{
                  borderRadius: '4px',
                  fontSize: '0.625rem',
                  height: 18,
                  minWidth: 70,
                }}
                label={result.status}
              />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {result.niche_name}
              </Typography>
              {result.compatibility_score != null && (
                <Typography variant="caption" color="text.secondary">
                  {result.compatibility_score}%
                </Typography>
              )}
              {result.rejection_reason && (
                <Typography
                  variant="caption"
                  color="warning.main"
                  sx={{ maxWidth: 200 }}
                  noWrap
                >
                  {result.rejection_reason}
                </Typography>
              )}
            </Stack>
          ))}
        </Stack>
      )}

      {run.error_message && (
        <Typography variant="caption" color="error.main" sx={{ mt: 1 }}>
          {run.error_message}
        </Typography>
      )}
    </Box>
  );
};
