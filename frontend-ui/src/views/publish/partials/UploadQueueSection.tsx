import {
  Box,
  Typography,
  Chip,
  Stack,
  Skeleton,
  Alert,
  Pagination,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';
import type { useUploadJobs } from '../hooks/useUploadJobs';
import type { UploadJobStatus } from '../types';
import UploadJobRow from './UploadJobRow';

const STATUS_FILTERS: (UploadJobStatus | undefined)[] = [
  undefined,
  'pending',
  'uploading',
  'completed',
  'failed',
];

interface UploadQueueSectionProps {
  uploadJobs: ReturnType<typeof useUploadJobs>;
}

const UploadQueueSection = ({ uploadJobs }: UploadQueueSectionProps) => {
  const { t } = useTranslation();

  const totalPages = Math.ceil(uploadJobs.totalCount / (uploadJobs.params.page_size ?? 20));

  if (uploadJobs.isLoading) {
    return (
      <Box component="section" aria-label={t('publish.upload.title')}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          {t('publish.upload.title')}
        </Typography>
        <Stack spacing={1.5}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={48} />
          ))}
        </Stack>
      </Box>
    );
  }

  if (uploadJobs.error) {
    return (
      <Box component="section" aria-label={t('publish.upload.title')}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          {t('publish.upload.title')}
        </Typography>
        <Alert severity="error">{t('publish.upload.loadError')}</Alert>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label={t('publish.upload.title')}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">{t('publish.upload.title')}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t('publish.upload.totalJobs', { count: uploadJobs.totalCount })}
        </Typography>
      </Box>

      {/* Desktop App connection hint */}
      <Alert
        severity="info"
        icon={<InfoOutlinedIcon />}
        sx={{ mb: 2 }}
      >
        {t('publish.upload.desktopAppHint')}
      </Alert>

      {/* Status filters */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        {STATUS_FILTERS.map((status) => (
          <Chip
            key={status ?? 'all'}
            label={status ? t(`publish.upload.status.${status}`) : t('publish.upload.all')}
            size="small"
            onClick={() => uploadJobs.filterByStatus(status)}
            color={uploadJobs.params.status === status ? 'primary' : 'default'}
            variant={uploadJobs.params.status === status ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {uploadJobs.jobs.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('publish.upload.noJobs')}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={1}>
          {uploadJobs.jobs.map((job) => (
            <UploadJobRow
              key={job.id}
              job={job}
              onCancel={uploadJobs.handleCancel}
            />
          ))}
        </Stack>
      )}

      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Pagination
            count={totalPages}
            page={uploadJobs.params.page ?? 1}
            onChange={(_, page) =>
              uploadJobs.setParams((prev) => ({ ...prev, page }))
            }
            color="primary"
          />
        </Box>
      )}
    </Box>
  );
};

export default UploadQueueSection;
