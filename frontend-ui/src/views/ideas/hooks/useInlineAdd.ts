import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useCreateIdeaGlobalMutation } from '@/store/ideaSlice';

export interface UseIdeaInlineAddReturn {
  isActive: boolean;
  isCreating: boolean;
  error: string | null;
  activate: () => void;
  cancel: () => void;
  submit: (sloganText: string, nicheId?: string | null) => Promise<void>;
}

export const useIdeaInlineAdd = (): UseIdeaInlineAddReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createIdea, { isLoading: isCreating }] = useCreateIdeaGlobalMutation();

  const activate = useCallback(() => {
    setError(null);
    setIsActive(true);
  }, []);

  const cancel = useCallback(() => {
    setIsActive(false);
    setError(null);
  }, []);

  const submit = useCallback(
    async (sloganText: string, nicheId?: string | null) => {
      const trimmed = sloganText.trim();
      if (!trimmed) {
        setError(t('ideas.notifications.createError'));
        return;
      }

      // Support batch: one slogan per line
      const lines = trimmed
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      try {
        setError(null);
        for (const line of lines) {
          await createIdea({
            slogan_text: line,
            ...(nicheId ? { niche: nicheId } : {}),
          }).unwrap();
        }
        enqueueSnackbar(
          t('ideas.notifications.createSuccess', { count: lines.length }),
          { variant: 'success' },
        );
        setIsActive(false);
      } catch {
        setError(t('ideas.notifications.createError'));
      }
    },
    [createIdea, enqueueSnackbar, t],
  );

  return { isActive, isCreating, error, activate, cancel, submit };
};
