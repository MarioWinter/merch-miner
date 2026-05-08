import { useCallback, useMemo } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  closeDrawer,
  setActiveBatch,
  toggleHideCompleted,
} from '@/store/upscaleSlice';
import {
  useTriggerSingleMutation,
  type UpscaleBatchJobRow,
  type UpscaleJobStatus,
} from '@/store/upscaleApi';
import { COLORS } from '@/style/constants';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const DRAWER_WIDTH = 400;
const MAX_RETRY_ATTEMPTS = 3;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const StyledDrawer = styled(Drawer)(({ theme }) => ({
  '& .MuiDrawer-paper': {
    width: DRAWER_WIDTH,
    // alpha() requires resolved color strings — CSS vars (theme.vars.*)
    // can't be decomposed. Use COLORS constants per project convention.
    backgroundColor: alpha(COLORS.inkPaper, 0.85),
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderLeft: `1px solid ${theme.vars.palette.divider}`,
    ...theme.applyStyles('light', {
      backgroundColor: alpha(COLORS.ashDefault, 0.85),
    }),
  },
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const ProgressWrap = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const JobThumb = styled(Avatar)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: 6,
  backgroundColor: theme.vars.palette.action.hover,
}));

const Footer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  display: 'flex',
  justifyContent: 'space-between',
  gap: theme.spacing(1),
}));

const BatchIdMono = styled(Typography)(({ theme }) => ({
  // JetBrains Mono per design-system.md (codes/IDs/hashes use mono).
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 11,
  color: theme.vars.palette.text.secondary,
}));

// -----------------------------------------------------------------
// Status chip helper — colors via theme tokens only
// -----------------------------------------------------------------

interface StatusChipProps {
  status: UpscaleJobStatus;
}

const StatusChip = ({ status }: StatusChipProps) => {
  const { t } = useTranslation();
  const colorMap: Record<
    UpscaleJobStatus,
    'default' | 'secondary' | 'success' | 'error'
  > = {
    pending: 'default',
    running: 'secondary',
    completed: 'success',
    failed: 'error',
  };
  const labelMap: Record<UpscaleJobStatus, string> = {
    pending: t('upscale.bulk.statusPending', { defaultValue: 'Pending' }),
    running: t('upscale.bulk.statusRunning', { defaultValue: 'Running' }),
    completed: t('upscale.bulk.statusCompleted', { defaultValue: 'Done' }),
    failed: t('upscale.bulk.statusFailed', { defaultValue: 'Failed' }),
  };
  return (
    <Chip
      label={labelMap[status]}
      color={colorMap[status]}
      size="small"
      sx={{ height: 22, fontSize: 11 }}
    />
  );
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface BulkUpscaleDrawerProps {
  jobs: UpscaleBatchJobRow[];
  batchId: string | null;
  isLoading?: boolean;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const BulkUpscaleDrawer = ({
  jobs,
  batchId,
  isLoading,
}: BulkUpscaleDrawerProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.upscale.drawerOpen);
  const hideCompleted = useAppSelector((s) => s.upscale.hideCompletedInDrawer);

  const [triggerSingle] = useTriggerSingleMutation();

  const visibleJobs = useMemo(
    () => (hideCompleted ? jobs.filter((j) => j.status !== 'completed') : jobs),
    [hideCompleted, jobs],
  );

  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const total = jobs.length;
  const progressValue = total > 0 ? (completedCount / total) * 100 : 0;
  const shortBatchId = batchId ? batchId.slice(0, 8) : '';

  const handleClose = useCallback(() => {
    dispatch(closeDrawer());
  }, [dispatch]);

  const handleClearCompleted = useCallback(() => {
    dispatch(toggleHideCompleted());
  }, [dispatch]);

  const handleClearActiveBatch = useCallback(() => {
    dispatch(setActiveBatch(null));
    dispatch(closeDrawer());
  }, [dispatch]);

  const handleRetry = useCallback(
    async (designId: string) => {
      try {
        await triggerSingle({ designId, body: { replace: true } }).unwrap();
        enqueueSnackbar(
          t('upscale.bulk.retryStarted', {
            defaultValue: 'Retry started',
          }),
          { variant: 'info' },
        );
      } catch {
        enqueueSnackbar(
          t('upscale.bulk.retryFailed', {
            defaultValue: 'Retry failed — try again later',
          }),
          { variant: 'error' },
        );
      }
    },
    [enqueueSnackbar, t, triggerSingle],
  );

  return (
    <StyledDrawer
      anchor="right"
      open={open}
      onClose={handleClose}
      ModalProps={{ keepMounted: true }}
    >
      <Header>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} noWrap>
            {t('upscale.bulk.drawerTitle', { defaultValue: 'Bulk Upscale' })}
          </Typography>
          {shortBatchId && (
            <BatchIdMono>
              {t('upscale.bulk.batchLabel', {
                defaultValue: 'Batch {{id}}',
                id: shortBatchId,
              })}
            </BatchIdMono>
          )}
        </Box>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Chip
            label={`${completedCount}/${total}`}
            size="small"
            sx={{ height: 22, fontSize: 11 }}
          />
          <IconButton
            size="small"
            onClick={handleClose}
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <CloseIcon />
          </IconButton>
        </Stack>
      </Header>

      <ProgressWrap>
        <LinearProgress
          variant={isLoading && total === 0 ? 'indeterminate' : 'determinate'}
          value={progressValue}
        />
      </ProgressWrap>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        <List dense disablePadding>
          {visibleJobs.length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {hideCompleted
                  ? t('upscale.bulk.noActiveJobs', {
                      defaultValue: 'No active jobs',
                    })
                  : t('upscale.bulk.empty', {
                      defaultValue: 'No jobs in this batch yet',
                    })}
              </Typography>
            </Box>
          )}
          {visibleJobs.map((job) => {
            const retryDisabled =
              job.retry_count >= MAX_RETRY_ATTEMPTS && !!job.error_message;
            const retryTitle = retryDisabled
              ? t('upscale.bulk.permanentFail', {
                  defaultValue: 'Permanent failure: {{error}}',
                  error: job.error_message ?? '',
                })
              : t('upscale.bulk.retry', { defaultValue: 'Retry' });

            return (
              <ListItem
                key={job.job_id}
                divider
                sx={{ gap: 1.5, alignItems: 'center', py: 1 }}
                secondaryAction={
                  job.status === 'failed' ? (
                    <Tooltip title={retryTitle}>
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => void handleRetry(job.design_id)}
                          disabled={retryDisabled}
                          aria-label={t('upscale.bulk.retry', {
                            defaultValue: 'Retry',
                          })}
                        >
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  ) : null
                }
              >
                <JobThumb
                  src={job.thumbnail_url ?? undefined}
                  alt={job.design_label}
                  variant="rounded"
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap>
                    {job.design_label}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <StatusChip status={job.status} />
                  </Box>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Footer>
        <Button
          variant="text"
          color="inherit"
          onClick={handleClearActiveBatch}
        >
          {t('upscale.bulk.dismissBatch', {
            defaultValue: 'Dismiss batch',
          })}
        </Button>
        <Stack direction="row" spacing={1}>
          <Button variant="text" onClick={handleClearCompleted}>
            {hideCompleted
              ? t('upscale.bulk.showCompleted', {
                  defaultValue: 'Show completed',
                })
              : t('upscale.bulk.clearCompleted', {
                  defaultValue: 'Clear completed',
                })}
          </Button>
          <Button variant="outlined" onClick={handleClose}>
            {t('common.close', { defaultValue: 'Close' })}
          </Button>
        </Stack>
      </Footer>
    </StyledDrawer>
  );
};

export default BulkUpscaleDrawer;
