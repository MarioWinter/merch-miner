import { useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useUpdateNicheMutation } from '../../../../store/nicheSlice';
import type { NicheStatus, PotentialRating, NicheUpdateBody } from '../types';

export type EditableColumn = 'name' | 'status' | 'potential_rating' | 'assignee';

export interface ActiveCell {
  nicheId: string;
  column: EditableColumn;
}

export interface UseInlineEditReturn {
  activeCell: ActiveCell | null;
  isSaving: boolean;
  activateCell: (nicheId: string, column: EditableColumn) => void;
  deactivateCell: () => void;
  saveName: (nicheId: string, value: string) => Promise<void>;
  saveStatus: (nicheId: string, value: NicheStatus) => Promise<void>;
  savePotentialRating: (nicheId: string, value: PotentialRating | null) => Promise<void>;
  saveAssignee: (nicheId: string, value: number | null) => Promise<void>;
  saveFields: (nicheId: string, body: NicheUpdateBody) => Promise<void>;
}

export const useInlineEdit = (): UseInlineEditReturn => {
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [updateNiche, { isLoading: isSaving }] = useUpdateNicheMutation();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const activateCell = useCallback((nicheId: string, column: EditableColumn) => {
    setActiveCell({ nicheId, column });
  }, []);

  const deactivateCell = useCallback(() => {
    setActiveCell(null);
  }, []);

  const extractError = (err: unknown): string => {
    const e = err as { data?: Record<string, unknown> };
    if (e?.data && typeof e.data === 'object') {
      for (const key of Object.keys(e.data)) {
        const val = e.data[key];
        if (typeof val === 'string') return val;
        if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
      }
    }
    return t('niches.notifications.updateError');
  };

  const save = useCallback(
    async (nicheId: string, body: NicheUpdateBody) => {
      try {
        await updateNiche({ id: nicheId, body }).unwrap();
        setActiveCell(null);
      } catch (err) {
        setActiveCell(null);
        enqueueSnackbar(extractError(err), { variant: 'error' });
      }
    },
    [updateNiche, enqueueSnackbar, t],
  );

  const saveName = useCallback(
    async (nicheId: string, value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      await save(nicheId, { name: trimmed });
    },
    [save],
  );

  const saveStatus = useCallback(
    async (nicheId: string, value: NicheStatus) => {
      await save(nicheId, { status: value });
    },
    [save],
  );

  const savePotentialRating = useCallback(
    async (nicheId: string, value: PotentialRating | null) => {
      await save(nicheId, { potential_rating: value });
    },
    [save],
  );

  const saveAssignee = useCallback(
    async (nicheId: string, value: number | null) => {
      await save(nicheId, { assigned_to: value });
    },
    [save],
  );

  const saveFields = useCallback(
    async (nicheId: string, body: NicheUpdateBody) => {
      await save(nicheId, body);
    },
    [save],
  );

  return {
    activeCell,
    isSaving,
    activateCell,
    deactivateCell,
    saveName,
    saveStatus,
    savePotentialRating,
    saveAssignee,
    saveFields,
  };
};
