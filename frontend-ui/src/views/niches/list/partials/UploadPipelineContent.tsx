import { Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

// ── Types ─────────────────────────────────────────────────────────
export interface UploadCounts {
  pending: number;
  completed: number;
  failed: number;
}

interface UploadPipelineContentProps {
  counts?: UploadCounts;
}

// ── Styled ────────────────────────────────────────────────────────
const SummaryRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0.5, 1),
  borderRadius: theme.shape.borderRadius * 0.75,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
}));

const CountValue = styled('span')(({ theme }) => ({
  ...theme.typography.subtitle2,
  fontWeight: 600,
  minWidth: 20,
  textAlign: 'right',
}));

// ── Component ─────────────────────────────────────────────────────
export const UploadPipelineContent = ({ counts }: UploadPipelineContentProps) => {
  const { t } = useTranslation();

  // Placeholder — real counts come from PROJ-11/13 RTK Query
  const total = counts ? counts.pending + counts.completed + counts.failed : 0;

  // ── Empty state ───────────────────────────────────────────────
  if (total === 0) {
    return (
      <Stack alignItems="center" sx={{ py: 1.5 }}>
        <CloudUploadOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 0.5 }} />
        <Typography variant="body2" color="text.secondary" textAlign="center">
          {t('niches.pipeline.upload.emptyTitle', 'No uploads yet')}
        </Typography>
        <Typography variant="caption" color="text.disabled" textAlign="center">
          {t('niches.pipeline.upload.emptyCta', 'Create listings first, then upload to Amazon')}
        </Typography>
      </Stack>
    );
  }

  // ── Summary with counts ───────────────────────────────────────
  return (
    <Stack spacing={0.25}>
      <SummaryRow>
        <HourglassEmptyOutlinedIcon sx={{ fontSize: 16, color: COLORS.warningDk }} />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {t('niches.pipeline.upload.pending', 'Pending')}
        </Typography>
        <CountValue>{counts!.pending}</CountValue>
      </SummaryRow>

      <SummaryRow>
        <CheckCircleOutlinedIcon sx={{ fontSize: 16, color: COLORS.successDk }} />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {t('niches.pipeline.upload.completed', 'Completed')}
        </Typography>
        <CountValue>{counts!.completed}</CountValue>
      </SummaryRow>

      <SummaryRow>
        <ErrorOutlineOutlinedIcon sx={{ fontSize: 16, color: COLORS.errorDk }} />
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {t('niches.pipeline.upload.failed', 'Failed')}
        </Typography>
        <CountValue>{counts!.failed}</CountValue>
      </SummaryRow>
    </Stack>
  );
};
