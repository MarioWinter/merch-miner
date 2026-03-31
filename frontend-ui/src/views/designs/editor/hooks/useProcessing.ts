import { useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useBatchProcessMutation } from '@/store/designSlice';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type ProcessingStep = 'upscale' | 'bg_remove';

export interface JobTracker {
  jobId: string;
  designId: string;
  type: ProcessingStep;
  status: 'pending' | 'running' | 'completed' | 'failed';
  resultFileUrl?: string;
  errorMessage?: string;
}

export type JobUpdateFn = (
  jobId: string,
  status: string,
  resultFileUrl?: string,
  errorMessage?: string,
) => void;

export interface UseProcessingReturn {
  startProcessing: (designIds: string[], steps: ProcessingStep[]) => Promise<void>;
  jobs: JobTracker[];
  isSubmitting: boolean;
  isProcessing: boolean;
  completedCount: number;
  failedCount: number;
  clearJobs: () => void;
  onJobUpdate: JobUpdateFn;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

export const useProcessing = (): UseProcessingReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [batchProcess, { isLoading: isSubmitting }] = useBatchProcessMutation();

  const [jobs, setJobs] = useState<JobTracker[]>([]);

  const startProcessing = useCallback(
    async (designIds: string[], steps: ProcessingStep[]) => {
      if (designIds.length === 0 || steps.length === 0) return;
      try {
        const result = await batchProcess({
          design_ids: designIds,
          steps,
        }).unwrap();

        const newJobs: JobTracker[] = result.map((job) => ({
          jobId: job.id,
          designId: job.design,
          type: job.type as ProcessingStep,
          status: job.status as JobTracker['status'],
        }));
        setJobs((prev) => [...prev, ...newJobs]);
      } catch {
        enqueueSnackbar(t('design.batch.failure'), { variant: 'error' });
      }
    },
    [batchProcess, enqueueSnackbar, t],
  );

  const onJobUpdate: JobUpdateFn = useCallback(
    (jobId, status, resultFileUrl, errorMessage) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === jobId
            ? {
                ...j,
                status: status as JobTracker['status'],
                resultFileUrl,
                errorMessage,
              }
            : j,
        ),
      );

      if (status === 'completed') {
        enqueueSnackbar(t('design.batch.jobCompleted'), { variant: 'success' });
      } else if (status === 'failed') {
        enqueueSnackbar(errorMessage ?? t('design.batch.failure'), {
          variant: 'error',
        });
      }
    },
    [enqueueSnackbar, t],
  );

  const clearJobs = useCallback(() => {
    setJobs([]);
  }, []);

  const isProcessing = jobs.some(
    (j) => j.status === 'pending' || j.status === 'running',
  );
  const completedCount = jobs.filter((j) => j.status === 'completed').length;
  const failedCount = jobs.filter((j) => j.status === 'failed').length;

  return {
    startProcessing,
    jobs,
    isSubmitting,
    isProcessing,
    completedCount,
    failedCount,
    clearJobs,
    onJobUpdate,
  };
};
