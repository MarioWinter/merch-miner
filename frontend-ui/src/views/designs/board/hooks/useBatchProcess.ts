import { useState, useEffect, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useBatchProcessMutation,
  useGetProcessingJobQuery,
} from '../../../../store/designSlice';
import type { ProcessingJobType, DesignProcessingJob } from '../types';

const POLL_INTERVAL = 3000;

export const useBatchProcess = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [batchProcess, { isLoading: isTriggering }] =
    useBatchProcessMutation();
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [completedJobs, setCompletedJobs] = useState<DesignProcessingJob[]>([]);

  // Poll the first active job (simplified — poll one at a time)
  const currentJobId = activeJobIds[0] ?? '';
  const { data: jobStatus } = useGetProcessingJobQuery(currentJobId, {
    skip: !currentJobId,
    pollingInterval: POLL_INTERVAL,
  });

  useEffect(() => {
    if (!jobStatus) return;
    const terminal = ['completed', 'failed'];
    if (terminal.includes(jobStatus.status)) {
      setCompletedJobs((prev) => [...prev, jobStatus]); // eslint-disable-line react-hooks/set-state-in-effect -- syncs with RTK Query
      setActiveJobIds((prev) => prev.filter((id) => id !== jobStatus.id));
      if (jobStatus.status === 'failed') {
        enqueueSnackbar(
          t('design.batch.jobFailed', {
            type: t(`design.batch.${jobStatus.type}`),
          }),
          { variant: 'error' },
        );
      }
    }
  }, [jobStatus, enqueueSnackbar, t]);

  const trigger = useCallback(
    async (designIds: string[], steps: ProcessingJobType[]) => {
      try {
        const jobs = await batchProcess({ design_ids: designIds, steps }).unwrap();
        setActiveJobIds(jobs.map((j) => j.id));
        setCompletedJobs([]);
        enqueueSnackbar(t('design.batch.started'), { variant: 'info' });
      } catch {
        enqueueSnackbar(t('design.batch.triggerError'), { variant: 'error' });
      }
    },
    [batchProcess, enqueueSnackbar, t],
  );

  const isProcessing = isTriggering || activeJobIds.length > 0;
  const totalJobs = activeJobIds.length + completedJobs.length;
  const completedCount = completedJobs.length;

  return {
    trigger,
    isProcessing,
    totalJobs,
    completedCount,
    completedJobs,
    activeJobIds,
  };
};
