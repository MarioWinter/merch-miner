import { useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useUpdateIdeaMutation,
  useDeleteIdeaMutation,
  useImproveIdeaMutation,
  useRegenerateIdeaMutation,
  useBulkUpdateStatusMutation,
} from '@/store/ideaSlice';
import type { Idea, IdeaStatus } from '../types';

interface UseIdeaActionsReturn {
  approve: (idea: Idea) => Promise<void>;
  reject: (idea: Idea) => Promise<void>;
  setStatus: (idea: Idea, status: IdeaStatus) => Promise<void>;
  deleteIdea: (idea: Idea) => Promise<void>;
  improve: (ideaId: string, feedback?: string) => Promise<Idea[]>;
  regenerate: (ideaId: string) => Promise<void>;
  bulkUpdateStatus: (ids: string[], status: 'approved' | 'rejected') => Promise<void>;
  isUpdating: boolean;
  isDeleting: boolean;
  isImproving: boolean;
  isRegenerating: boolean;
  isBulkUpdating: boolean;
}

export const useIdeaActions = (): UseIdeaActionsReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [update, { isLoading: isUpdating }] = useUpdateIdeaMutation();
  const [remove, { isLoading: isDeleting }] = useDeleteIdeaMutation();
  const [improveM, { isLoading: isImproving }] = useImproveIdeaMutation();
  const [regenerateM, { isLoading: isRegenerating }] =
    useRegenerateIdeaMutation();
  const [bulkUpdate, { isLoading: isBulkUpdating }] =
    useBulkUpdateStatusMutation();

  const setStatus = useCallback(
    async (idea: Idea, status: IdeaStatus) => {
      try {
        await update({ id: idea.id, body: { status } }).unwrap();
      } catch {
        enqueueSnackbar(t('ideas.notifications.updateError'), {
          variant: 'error',
        });
      }
    },
    [update, enqueueSnackbar, t],
  );

  const approve = useCallback(
    (idea: Idea) => setStatus(idea, 'approved'),
    [setStatus],
  );

  const reject = useCallback(
    (idea: Idea) => setStatus(idea, 'rejected'),
    [setStatus],
  );

  const deleteIdea = useCallback(
    async (idea: Idea) => {
      try {
        await remove({ id: idea.id, nicheId: idea.niche ?? '' }).unwrap();
        enqueueSnackbar(t('ideas.notifications.deleteSuccess'), {
          variant: 'success',
        });
      } catch {
        enqueueSnackbar(t('ideas.notifications.deleteError'), {
          variant: 'error',
        });
      }
    },
    [remove, enqueueSnackbar, t],
  );

  const improve = useCallback(
    async (ideaId: string, feedback?: string): Promise<Idea[]> => {
      try {
        const variants = await improveM({
          id: ideaId,
          body: { feedback },
        }).unwrap();
        enqueueSnackbar(t('ideas.improve.success'), { variant: 'success' });
        return variants;
      } catch {
        enqueueSnackbar(t('ideas.improve.error'), { variant: 'error' });
        return [];
      }
    },
    [improveM, enqueueSnackbar, t],
  );

  const regenerate = useCallback(
    async (ideaId: string) => {
      try {
        await regenerateM(ideaId).unwrap();
        enqueueSnackbar(t('ideas.regenerate.success'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('ideas.regenerate.error'), { variant: 'error' });
      }
    },
    [regenerateM, enqueueSnackbar, t],
  );

  const bulkUpdateStatus = useCallback(
    async (ids: string[], status: 'approved' | 'rejected') => {
      try {
        const result = await bulkUpdate({ ids, status }).unwrap();
        enqueueSnackbar(
          t('ideas.bulk.updateSuccess', { count: result.updated }),
          { variant: 'success' },
        );
      } catch {
        enqueueSnackbar(t('ideas.bulk.updateError'), { variant: 'error' });
      }
    },
    [bulkUpdate, enqueueSnackbar, t],
  );

  return {
    approve,
    reject,
    setStatus,
    deleteIdea,
    improve,
    regenerate,
    bulkUpdateStatus,
    isUpdating,
    isDeleting,
    isImproving,
    isRegenerating,
    isBulkUpdating,
  };
};
