import { useState, useCallback, useRef, useEffect } from 'react';

interface LassoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseLassoSelectOptions {
  /** Container element ref for coordinate calculations */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Called with IDs of cards intersecting the lasso rectangle */
  onSelect: (ids: string[]) => void;
  /** Whether lasso selection is enabled */
  enabled?: boolean;
}

interface UseLassoSelectReturn {
  lassoRect: LassoRect | null;
  isLassoing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
}

const rectsIntersect = (a: DOMRect, b: LassoRect): boolean => {
  return !(a.right < b.x || a.left > b.x + b.width || a.bottom < b.y || a.top > b.y + b.height);
};

export const useLassoSelect = ({
  containerRef,
  onSelect,
  enabled = true,
}: UseLassoSelectOptions): UseLassoSelectReturn => {
  const [lassoRect, setLassoRect] = useState<LassoRect | null>(null);
  const [isLassoing, setIsLassoing] = useState(false);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;
      // Only trigger on left button, not on interactive elements
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, [role="button"], [data-no-lasso]')) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      startPoint.current = {
        x: e.clientX - rect.left + container.scrollLeft,
        y: e.clientY - rect.top + container.scrollTop,
      };
      setIsLassoing(true);
    },
    [containerRef, enabled],
  );

  useEffect(() => {
    if (!isLassoing) return;

    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!startPoint.current) return;
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left + container.scrollLeft;
        const currentY = e.clientY - rect.top + container.scrollTop;

        const lasso: LassoRect = {
          x: Math.min(startPoint.current!.x, currentX),
          y: Math.min(startPoint.current!.y, currentY),
          width: Math.abs(currentX - startPoint.current!.x),
          height: Math.abs(currentY - startPoint.current!.y),
        };

        setLassoRect(lasso);

        // Find intersecting cards
        const cards = container.querySelectorAll('[data-design-id]');
        const ids: string[] = [];
        cards.forEach((card) => {
          const cardRect = card.getBoundingClientRect();
          const adjustedCardRect = new DOMRect(
            cardRect.left - rect.left + container.scrollLeft,
            cardRect.top - rect.top + container.scrollTop,
            cardRect.width,
            cardRect.height,
          );
          if (rectsIntersect(adjustedCardRect, lasso)) {
            const id = card.getAttribute('data-design-id');
            if (id) ids.push(id);
          }
        });
        onSelect(ids);
      });
    };

    const handleMouseUp = () => {
      cancelAnimationFrame(rafId.current);
      setIsLassoing(false);
      setLassoRect(null);
      startPoint.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      cancelAnimationFrame(rafId.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isLassoing, containerRef, onSelect]);

  return { lassoRect, isLassoing, handleMouseDown };
};
