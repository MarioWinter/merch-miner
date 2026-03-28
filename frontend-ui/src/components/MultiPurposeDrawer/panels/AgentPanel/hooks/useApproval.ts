import { useCallback } from 'react';
import {
  useApproveActionMutation,
  useRejectActionMutation,
} from '@/store/agentSlice';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

const useApproval = (sessionId: string | null) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [approveAction, { isLoading: approving }] = useApproveActionMutation();
  const [rejectAction, { isLoading: rejecting }] = useRejectActionMutation();

  const handleApprove = useCallback(
    async (actionLogId: string) => {
      if (!sessionId) return;
      try {
        await approveAction({ sessionId, actionLogId }).unwrap();
        enqueueSnackbar(t('agent.approval.approved'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('agent.approval.approveError'), { variant: 'error' });
      }
    },
    [sessionId, approveAction, enqueueSnackbar, t],
  );

  const handleReject = useCallback(
    async (actionLogId: string) => {
      if (!sessionId) return;
      try {
        await rejectAction({ sessionId, actionLogId }).unwrap();
        enqueueSnackbar(t('agent.approval.rejected'), { variant: 'info' });
      } catch {
        enqueueSnackbar(t('agent.approval.rejectError'), { variant: 'error' });
      }
    },
    [sessionId, rejectAction, enqueueSnackbar, t],
  );

  return {
    approve: handleApprove,
    reject: handleReject,
    approving,
    rejecting,
  };
};

export default useApproval;
