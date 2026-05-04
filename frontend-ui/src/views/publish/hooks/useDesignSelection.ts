import { useState, useCallback, useMemo } from 'react';

interface UseDesignSelectionOptions {
  /** Ordered list of all selectable IDs (for shift-click range) */
  orderedIds: string[];
}

interface UseDesignSelectionReturn {
  selectedIds: Set<string>;
  lastClickedId: string | null;
  isSelected: (id: string) => boolean;
  handleClick: (id: string, shiftKey: boolean) => void;
  handleSelectAll: () => void;
  handleSelectNone: () => void;
  toggleAll: () => void;
  addIds: (ids: string[]) => void;
  clearSelection: () => void;
  selectionCount: number;
  hasSelection: boolean;
}

export const useDesignSelection = ({
  orderedIds,
}: UseDesignSelectionOptions): UseDesignSelectionReturn => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const handleClick = useCallback(
    (id: string, shiftKey: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        if (shiftKey && lastClickedId) {
          // Range select
          const startIdx = orderedIds.indexOf(lastClickedId);
          const endIdx = orderedIds.indexOf(id);
          if (startIdx !== -1 && endIdx !== -1) {
            const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
            for (let i = from; i <= to; i++) {
              next.add(orderedIds[i]);
            }
          }
        } else {
          // Toggle single
          if (next.has(id)) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }

        return next;
      });
      setLastClickedId(id);
    },
    [lastClickedId, orderedIds],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(orderedIds));
  }, [orderedIds]);

  const handleSelectNone = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedId(null);
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => (prev.size === orderedIds.length ? new Set() : new Set(orderedIds)));
  }, [orderedIds]);

  const addIds = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedId(null);
  }, []);

  const selectionCount = selectedIds.size;
  const hasSelection = selectionCount > 0;

  return useMemo(
    () => ({
      selectedIds,
      lastClickedId,
      isSelected,
      handleClick,
      handleSelectAll,
      handleSelectNone,
      toggleAll,
      addIds,
      clearSelection,
      selectionCount,
      hasSelection,
    }),
    [
      selectedIds,
      lastClickedId,
      isSelected,
      handleClick,
      handleSelectAll,
      handleSelectNone,
      toggleAll,
      addIds,
      clearSelection,
      selectionCount,
      hasSelection,
    ],
  );
};
