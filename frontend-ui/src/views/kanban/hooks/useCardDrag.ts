import { useState, useCallback } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useUpdateNicheMutation } from '@/store/nicheSlice';
import type { NicheStatus } from '../../niches/list/types';
import { STATUS_TO_COLUMN, COLUMN_DROP_STATUS } from '../types';
import type { KanbanColumnId } from '../types';

export const useCardDrag = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [updateNiche] = useUpdateNicheMutation();
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveCardId(null);
      const { active, over } = event;

      if (!over) return;

      const cardId = active.id as string;
      const targetColumnId = over.id as KanbanColumnId;
      const currentStatus = active.data.current?.status as NicheStatus | undefined;

      if (!currentStatus) return;

      const currentColumn = STATUS_TO_COLUMN[currentStatus];

      // EC-1: Same column — no PATCH
      if (currentColumn === targetColumnId) return;

      const newStatus = COLUMN_DROP_STATUS[targetColumnId];

      try {
        await updateNiche({
          id: cardId,
          body: { status: newStatus },
        }).unwrap();
      } catch {
        // EC-2: Revert on failure — RTK Query cache invalidation handles UI revert
        enqueueSnackbar(t('kanban.board.dragError'), { variant: 'error' });
      }
    },
    [updateNiche, enqueueSnackbar, t],
  );

  const handleDragCancel = useCallback(() => {
    setActiveCardId(null);
  }, []);

  return {
    activeCardId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  };
};
