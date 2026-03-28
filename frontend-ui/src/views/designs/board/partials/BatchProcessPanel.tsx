import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useTranslation } from 'react-i18next';
import type { ProcessingJobType } from '../types';

interface BatchProcessPanelProps {
  selectedCount: number;
  selectedIds: string[];
  isProcessing: boolean;
  totalJobs: number;
  completedCount: number;
  onProcess: (designIds: string[], steps: ProcessingJobType[]) => void;
}

export const BatchProcessPanel = ({
  selectedCount,
  selectedIds,
  isProcessing,
  totalJobs,
  completedCount,
  onProcess,
}: BatchProcessPanelProps) => {
  const { t } = useTranslation();

  if (selectedCount === 0 && !isProcessing) return null;

  const progress = totalJobs > 0 ? (completedCount / totalJobs) * 100 : 0;

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {t('design.batch.selectedCount', { count: selectedCount })}
        </Typography>

        <Button
          size="small"
          variant="contained"
          startIcon={<AutoFixHighIcon />}
          onClick={() =>
            onProcess(selectedIds, ['upscale', 'bg_remove'])
          }
          disabled={selectedCount === 0 || isProcessing}
        >
          {t('design.batch.processButton')}
        </Button>

        {isProcessing && (
          <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={progress}
              color="secondary"
              sx={{ flex: 1, height: 6, borderRadius: 3 }}
            />
            <Chip
              label={`${completedCount}/${totalJobs}`}
              size="small"
              sx={{ fontSize: '0.6875rem' }}
            />
          </Stack>
        )}
      </Stack>
    </Box>
  );
};
