import { useState, useEffect, useRef, useCallback } from 'react';

export type ColumnKey = 'name' | 'status' | 'potential_rating' | 'assignee' | 'ideas' | 'updated' | 'actions';

export type ColumnWidths = Record<ColumnKey, number | 'auto'>;

const LS_KEY = 'mm-niche-col-widths';

const DEFAULTS: ColumnWidths = {
  name: 'auto',
  status: 160,
  potential_rating: 120,
  assignee: 140,
  ideas: 80,
  updated: 120,
  actions: 44,
};

const MIN_WIDTH = 60;

const loadWidths = (): ColumnWidths => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ColumnWidths>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
};

const saveWidths = (widths: ColumnWidths): void => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(widths));
  } catch {
    // ignore
  }
};

export interface UseColumnWidthsReturn {
  widths: ColumnWidths;
  startResize: (column: ColumnKey, startX: number) => void;
  resetWidths: () => void;
  isResizing: boolean;
}

export const useColumnWidths = (): UseColumnWidthsReturn => {
  const [widths, setWidths] = useState<ColumnWidths>(loadWidths);
  const [isResizing, setIsResizing] = useState(false);

  const resizeRef = useRef<{
    column: ColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);

  const startResize = useCallback(
    (column: ColumnKey, startX: number) => {
      const currentWidth = widths[column];
      const startWidth = currentWidth === 'auto' ? 200 : currentWidth;
      resizeRef.current = { column, startX, startWidth };
      setIsResizing(true);
    },
    [widths],
  );

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const { column, startX, startWidth } = resizeRef.current;
      const delta = e.clientX - startX;
      const newWidth = Math.max(MIN_WIDTH, startWidth + delta);
      setWidths((prev) => ({ ...prev, [column]: newWidth }));
    };

    const onMouseUp = () => {
      if (resizeRef.current) {
        setWidths((prev) => {
          saveWidths(prev);
          return prev;
        });
      }
      resizeRef.current = null;
      setIsResizing(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  const resetWidths = useCallback(() => {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {
      // ignore
    }
    setWidths({ ...DEFAULTS });
  }, []);

  return { widths, startResize, resetWidths, isResizing };
};
