import { useState, useCallback, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListUploadJobsQuery,
  useCreateUploadJobMutation,
  useBatchUploadJobsMutation,
  useCancelUploadJobMutation,
} from '@/store/publishSlice';
import type { UploadJobListParams, UploadJobStatus } from '../types';

export const useUploadJobs = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [params, setParams] = useState<UploadJobListParams>({
    page: 1,
    page_size: 20,
  });

  const { data, isLoading, isFetching, error } = useListUploadJobsQuery(params, {
    pollingInterval: 10_000,
  });

  const [createJob, { isLoading: isCreating }] = useCreateUploadJobMutation();
  const [batchJobs, { isLoading: isBatching }] = useBatchUploadJobsMutation();
  const [cancelJob] = useCancelUploadJobMutation();

  const filterByStatus = useCallback((status?: UploadJobStatus) => {
    setParams((prev) => ({ ...prev, status, page: 1 }));
  }, []);

  const handleCreate = useCallback(
    async (listingId: string, designId: string, marketplace: string, templateId?: string) => {
      try {
        await createJob({
          listing_id: listingId,
          design_id: designId,
          template_id: templateId,
          marketplace,
        }).unwrap();
        enqueueSnackbar(t('publish.upload.queued'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('publish.upload.queueError'), { variant: 'error' });
      }
    },
    [createJob, enqueueSnackbar, t],
  );

  const handleBatch = useCallback(
    async (designIds: string[], templateId: string, marketplace: string) => {
      try {
        const jobs = await batchJobs({
          design_ids: designIds,
          template_id: templateId,
          marketplace,
        }).unwrap();
        enqueueSnackbar(t('publish.upload.batchQueued', { count: jobs.length }), {
          variant: 'success',
        });
      } catch {
        enqueueSnackbar(t('publish.upload.batchError'), { variant: 'error' });
      }
    },
    [batchJobs, enqueueSnackbar, t],
  );

  const handleCancel = useCallback(
    async (jobId: string) => {
      try {
        await cancelJob(jobId).unwrap();
        enqueueSnackbar(t('publish.upload.cancelled'), { variant: 'info' });
      } catch {
        enqueueSnackbar(t('publish.upload.cancelError'), { variant: 'error' });
      }
    },
    [cancelJob, enqueueSnackbar, t],
  );

  return useMemo(
    () => ({
      jobs: data?.results ?? [],
      totalCount: data?.count ?? 0,
      isLoading,
      isFetching,
      error,
      params,
      isCreating,
      isBatching,
      filterByStatus,
      handleCreate,
      handleBatch,
      handleCancel,
      setParams,
    }),
    [
      data,
      isLoading,
      isFetching,
      error,
      params,
      isCreating,
      isBatching,
      filterByStatus,
      handleCreate,
      handleBatch,
      handleCancel,
    ],
  );
};
