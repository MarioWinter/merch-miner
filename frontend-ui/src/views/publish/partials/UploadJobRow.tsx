import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import PhotoOutlinedIcon from '@mui/icons-material/PhotoOutlined';
import { useTranslation } from 'react-i18next';
import type { UploadJob, UploadJobStatus } from '../types';
import { MONO_FONT_STACK } from '@/style/constants';

const RowBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1.5, 2),
  borderRadius: 8,
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  gap: theme.spacing(2),
}));

const STATUS_COLOR: Record<UploadJobStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  pending: 'default',
  validating: 'info',
  uploading: 'warning',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
};

interface UploadJobRowProps {
  job: UploadJob;
  onCancel: (id: string) => void;
  onRetry?: (job: UploadJob) => void;
}

const UploadJobRow = ({ job, onCancel, onRetry }: UploadJobRowProps) => {
  const { t } = useTranslation();

  return (
    <RowBox>
      <Chip
        label={t(`publish.upload.status.${job.status}`)}
        size="small"
        color={STATUS_COLOR[job.status]}
        variant="outlined"
      />

      <Typography variant="body2" sx={{ flex: 1 }} noWrap>
        {job.marketplace}
      </Typography>

      {job.asin && (
        <Typography
          variant="body2"
          sx={{ fontFamily: MONO_FONT_STACK, color: 'success.main' }}
        >
          {job.asin}
        </Typography>
      )}

      {job.status === 'failed' && job.error_message && (
        <Tooltip title={job.error_message}>
          <Typography variant="caption" color="error.main" noWrap sx={{ maxWidth: 200 }}>
            {job.error_message}
          </Typography>
        </Tooltip>
      )}

      {job.status === 'failed' && job.error_screenshot && (
        <Tooltip title={t('publish.upload.viewScreenshot')}>
          <IconButton
            size="small"
            component="a"
            href={job.error_screenshot}
            target="_blank"
            rel="noopener"
            aria-label={t('publish.upload.viewScreenshot')}
          >
            <PhotoOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      {job.status === 'failed' && onRetry && (
        <Tooltip title={t('publish.upload.retry')}>
          <IconButton
            size="small"
            onClick={() => onRetry(job)}
            aria-label={t('publish.upload.retry')}
          >
            <ReplayIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      {(job.status === 'pending' || job.status === 'validating') && (
        <Tooltip title={t('publish.upload.cancel')}>
          <IconButton
            size="small"
            onClick={() => onCancel(job.id)}
            aria-label={t('publish.upload.cancel')}
          >
            <CancelOutlinedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}

      {job.completed_at && (
        <Typography variant="caption" color="text.secondary">
          {new Date(job.completed_at).toLocaleDateString()}
        </Typography>
      )}
    </RowBox>
  );
};

export default UploadJobRow;
