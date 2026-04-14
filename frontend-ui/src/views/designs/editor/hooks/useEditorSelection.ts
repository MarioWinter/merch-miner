import { useState, useCallback, useMemo } from 'react';

interface SelectableItem {
  id: string;
}

interface UseEditorSelectionReturn {
  selectedIds: Set<string>;
  lastClickedIndex: number | null;
  toggleSelect: (id: string, index: number) => void;
  shiftSelect: (index: number, images: SelectableItem[]) => void;
  selectAll: (images: SelectableItem[]) => void;
  deselectAll: () => void;
  isSelected: (id: string) => boolean;
  selectedCount: number;
}

export const useEditorSelection = (images: SelectableItem[]): UseEditorSelectionReturn => {
  const [rawSelectedIds, setRawSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Derive cleaned selectedIds: intersection of raw selection with current images
  const selectedIds = useMemo(() => {
    if (rawSelectedIds.size === 0) return rawSelectedIds;
    const imageIdSet = new Set(images.map((img) => img.id));
    let hasStale = false;
    for (const id of rawSelectedIds) {
      if (!imageIdSet.has(id)) {
        hasStale = true;
        break;
      }
    }
    if (!hasStale) return rawSelectedIds;
    const cleaned = new Set<string>();
    for (const id of rawSelectedIds) {
      if (imageIdSet.has(id)) cleaned.add(id);
    }
    return cleaned;
  }, [rawSelectedIds, images]);

  const toggleSelect = useCallback((id: string, index: number) => {
    setRawSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastClickedIndex(index);
  }, []);

  const shiftSelect = useCallback(
    (index: number, imgs: SelectableItem[]) => {
      const start = lastClickedIndex ?? 0;
      const min = Math.min(start, index);
      const max = Math.max(start, index);
      setRawSelectedIds((prev) => {
        const next = new Set(prev);
        for (let i = min; i <= max; i++) {
          if (imgs[i]) {
            next.add(imgs[i].id);
          }
        }
        return next;
      });
      setLastClickedIndex(index);
    },
    [lastClickedIndex],
  );

  const selectAll = useCallback((imgs: SelectableItem[]) => {
    setRawSelectedIds(new Set(imgs.map((img) => img.id)));
  }, []);

  const deselectAll = useCallback(() => {
    setRawSelectedIds(new Set());
    setLastClickedIndex(null);
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  return {
    selectedIds,
    lastClickedIndex,
    toggleSelect,
    shiftSelect,
    selectAll,
    deselectAll,
    isSelected,
    selectedCount,
  };
};
