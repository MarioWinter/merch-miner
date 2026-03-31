import { useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useUpdateIdeaMutation } from '@/store/ideaSlice';
import type { IdeaStatus, IdeaUpdateBody } from '../types';

export type IdeaEditableColumn = 'slogan_text' | 'niche';

export interface IdeaActiveCell {
  ideaId: string;
  column: IdeaEditableColumn;
}

export interface UseIdeaInlineEditReturn {
  activeCell: IdeaActiveCell | null;
  isSaving: boolean;
  activateCell: (ideaId: string, column: IdeaEditableColumn) => void;
  deactivateCell: () => void;
  saveSloganText: (ideaId: string, value: string) => Promise<void>;
  saveNiche: (ideaId: string, nicheId: string | null) => Promise<void>;
  saveStatus: (ideaId: string, status: IdeaStatus) => Promise<void>;
}

export const useIdeaInlineEdit = (): UseIdeaInlineEditReturn => {
  const [activeCell, setActiveCell] = useState<IdeaActiveCell | null>(null);
  const [updateIdea, { isLoading: isSaving }] = useUpdateIdeaMutation();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const activateCell = useCallback((ideaId: string, column: IdeaEditableColumn) => {
    setActiveCell({ ideaId, column });
  }, []);

  const deactivateCell = useCallback(() => {
    setActiveCell(null);
  }, []);

  const save = useCallback(
    async (ideaId: string, body: IdeaUpdateBody) => {
      try {
        await updateIdea({ id: ideaId, body }).unwrap();
        setActiveCell(null);
      } catch {
        setActiveCell(null);
        enqueueSnackbar(t('ideas.notifications.updateError'), { variant: 'error' });
      }
    },
    [updateIdea, enqueueSnackbar, t],
  );

  const saveSloganText = useCallback(
    async (ideaId: string, value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      await save(ideaId, { slogan_text: trimmed });
    },
    [save],
  );

  const saveNiche = useCallback(
    async (ideaId: string, nicheId: string | null) => {
      await save(ideaId, { niche: nicheId });
    },
    [save],
  );

  const saveStatus = useCallback(
    async (ideaId: string, status: IdeaStatus) => {
      await save(ideaId, { status });
    },
    [save],
  );

  return {
    activeCell,
    isSaving,
    activateCell,
    deactivateCell,
    saveSloganText,
    saveNiche,
    saveStatus,
  };
};
