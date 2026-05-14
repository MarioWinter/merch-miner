/**
 * PROJ-29 Phase 1H-2 — index-based selection state for GeneratedSloganTable.
 */
import { useCallback, useState } from 'react';

export interface SelectionApi {
  selected: ReadonlySet<number>;
  isSelected: (idx: number) => boolean;
  toggle: (idx: number) => void;
  toggleAll: (totalCount: number) => void;
  allSelected: (totalCount: number) => boolean;
  clear: () => void;
}

export const useSloganTableSelection = (): SelectionApi => {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  const toggle = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback((totalCount: number) => {
    setSelected((prev) => {
      if (prev.size === totalCount) return new Set();
      const next = new Set<number>();
      for (let i = 0; i < totalCount; i += 1) next.add(i);
      return next;
    });
  }, []);

  const allSelected = useCallback(
    (totalCount: number) => totalCount > 0 && selected.size === totalCount,
    [selected],
  );

  const isSelected = useCallback((idx: number) => selected.has(idx), [selected]);

  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, isSelected, toggle, toggleAll, allSelected, clear };
};
