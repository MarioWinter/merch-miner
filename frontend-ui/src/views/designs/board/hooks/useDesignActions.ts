import { useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useUpdateDesignStatusMutation,
  useDeleteDesignMutation,
} from '../../../../store/designSlice';

export const useDesignActions = (ideaId: string) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [updateStatus] = useUpdateDesignStatusMutation();
  const [deleteDesign] = useDeleteDesignMutation();

  const approve = useCallback(
    async (designId: string) => {
      try {
        await updateStatus({
          designId,
          body: { status: 'approved' },
          ideaId,
        }).unwrap();
        enqueueSnackbar(t('design.gallery.approved'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('design.gallery.approveError'), { variant: 'error' });
      }
    },
    [updateStatus, ideaId, enqueueSnackbar, t],
  );

  const reject = useCallback(
    async (designId: string) => {
      try {
        await updateStatus({
          designId,
          body: { status: 'rejected' },
          ideaId,
        }).unwrap();
        enqueueSnackbar(t('design.gallery.rejected'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('design.gallery.rejectError'), { variant: 'error' });
      }
    },
    [updateStatus, ideaId, enqueueSnackbar, t],
  );

  const remove = useCallback(
    async (designId: string) => {
      try {
        await deleteDesign({ designId, ideaId }).unwrap();
        enqueueSnackbar(t('design.gallery.deleted'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('design.gallery.deleteError'), { variant: 'error' });
      }
    },
    [deleteDesign, ideaId, enqueueSnackbar, t],
  );

  return { approve, reject, remove };
};
