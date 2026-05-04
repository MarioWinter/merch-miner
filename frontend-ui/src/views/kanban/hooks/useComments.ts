import { useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useListCommentsQuery,
  useCreateCommentMutation,
  useDeleteCommentMutation,
} from '@/store/kanbanSlice';

interface UseCommentsOptions {
  nicheId: string;
  designId?: string;
}

export const useComments = ({ nicheId, designId }: UseCommentsOptions) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [draft, setDraft] = useState('');

  const { data, isLoading, isError } = useListCommentsQuery(
    { nicheId, designId },
    { skip: !nicheId },
  );

  const [createComment, { isLoading: isSubmitting }] = useCreateCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();

  const comments = data?.results ?? (Array.isArray(data) ? data : []);

  const handleSubmit = useCallback(
    async (mentions?: number[]) => {
      if (!draft.trim()) return;
      try {
        await createComment({
          nicheId,
          content: draft.trim(),
          designId,
          mentions,
        }).unwrap();
        setDraft('');
      } catch {
        enqueueSnackbar(t('kanban.comments.createError'), { variant: 'error' });
      }
    },
    [nicheId, designId, draft, createComment, enqueueSnackbar, t],
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      try {
        await deleteComment({ nicheId, commentId }).unwrap();
      } catch {
        enqueueSnackbar(t('kanban.comments.deleteError'), { variant: 'error' });
      }
    },
    [nicheId, deleteComment, enqueueSnackbar, t],
  );

  return {
    comments,
    isLoading,
    isError,
    draft,
    setDraft,
    isSubmitting,
    handleSubmit,
    handleDelete,
  };
};
