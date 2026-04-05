import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasElementType, ShapeElementProps } from '../types';
import type { CanvasTool } from '../partials/BottomToolbar';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** Distance (px) to snap to first point to close path */
const CLOSE_SNAP_DISTANCE = 12;
const PEN_STROKE = '#000000';
const PEN_STROKE_WIDTH = 2;
const PEN_TENSION = 0.3;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UsePenToolParams {
  activeTool: CanvasTool;
  addElement: <T extends CanvasElementType>(
    artboardId: string,
    type: T,
    props: import('../types').CanvasElementPropsMap[T],
    overrides?: Partial<Omit<import('../types').CanvasElement<T>, 'id' | 'type' | 'props'>>,
  ) => import('../types').CanvasElement<T> | null;
  setActiveTool: (tool: CanvasTool) => void;
  onElementSelect: (artboardId: string, elementId: string) => void;
}

interface UsePenToolReturn {
  isPenActive: boolean;
  penPoints: number[];
  penArtboardId: string | null;
  cursorPos: { x: number; y: number } | null;
  handlePenClick: (artboardId: string, localX: number, localY: number) => void;
  handlePenMove: (localX: number, localY: number) => void;
  handlePenFinish: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const usePenTool = ({
  activeTool,
  addElement,
  setActiveTool,
  onElementSelect,
}: UsePenToolParams): UsePenToolReturn => {
  const [penPoints, setPenPoints] = useState<number[]>([]);
  const [penArtboardId, setPenArtboardId] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const lastClickTimeRef = useRef(0);

  const isPenActive = activeTool === 'pen' && penPoints.length > 0;

  // Cancel pen on Escape key
  useEffect(() => {
    if (activeTool !== 'pen') return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPenPoints([]);
        setPenArtboardId(null);
        setCursorPos(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTool]);

  // Reset pen state — exposed for parent to call when tool changes
  const resetPen = useCallback(() => {
    setPenPoints([]);
    setPenArtboardId(null);
    setCursorPos(null);
  }, []);

  const commitPath = useCallback(
    (closed: boolean) => {
      if (!penArtboardId || penPoints.length < 4) {
        setPenPoints([]);
        setPenArtboardId(null);
        setCursorPos(null);
        return;
      }

      // Compute bounding box for the points
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < penPoints.length; i += 2) {
        minX = Math.min(minX, penPoints[i]);
        minY = Math.min(minY, penPoints[i + 1]);
        maxX = Math.max(maxX, penPoints[i]);
        maxY = Math.max(maxY, penPoints[i + 1]);
      }

      // Normalize points relative to bounding box origin
      const normalizedPoints: number[] = [];
      for (let i = 0; i < penPoints.length; i += 2) {
        normalizedPoints.push(penPoints[i] - minX, penPoints[i + 1] - minY);
      }

      const width = Math.max(1, maxX - minX);
      const height = Math.max(1, maxY - minY);

      const shapeProps: ShapeElementProps = {
        shapeKind: 'pen',
        fill: '',
        stroke: PEN_STROKE,
        strokeWidth: PEN_STROKE_WIDTH,
        points: normalizedPoints,
        closed,
        tension: PEN_TENSION,
      };

      const newEl = addElement(penArtboardId, 'shape', shapeProps, {
        x: minX,
        y: minY,
        width,
        height,
      });

      if (newEl) {
        onElementSelect(penArtboardId, newEl.id);
      }

      setPenPoints([]);
      setPenArtboardId(null);
      setCursorPos(null);
      setActiveTool('cursor');
    },
    [penArtboardId, penPoints, addElement, onElementSelect, setActiveTool],
  );

  const handlePenClick = useCallback(
    (artboardId: string, localX: number, localY: number) => {
      if (activeTool !== 'pen') return;

      // Detect double-click (finish open path)
      const now = Date.now();
      if (now - lastClickTimeRef.current < 300 && penPoints.length >= 4) {
        lastClickTimeRef.current = 0;
        commitPath(false);
        return;
      }
      lastClickTimeRef.current = now;

      // If clicking near first point and we have at least 3 points, close the path
      if (penPoints.length >= 6) {
        const firstX = penPoints[0];
        const firstY = penPoints[1];
        const dist = Math.sqrt((localX - firstX) ** 2 + (localY - firstY) ** 2);
        if (dist < CLOSE_SNAP_DISTANCE) {
          commitPath(true);
          return;
        }
      }

      // First click: set artboard context
      if (penPoints.length === 0) {
        setPenArtboardId(artboardId);
      }

      setPenPoints((prev) => [...prev, localX, localY]);
    },
    [activeTool, penPoints, commitPath],
  );

  const handlePenMove = useCallback(
    (localX: number, localY: number) => {
      if (activeTool !== 'pen' || penPoints.length === 0) return;
      setCursorPos({ x: localX, y: localY });
    },
    [activeTool, penPoints.length],
  );

  const handlePenFinish = useCallback(() => {
    if (penPoints.length >= 4) {
      commitPath(false);
    } else {
      setPenPoints([]);
      setPenArtboardId(null);
      setCursorPos(null);
    }
  }, [penPoints.length, commitPath]);

  return {
    isPenActive,
    penPoints,
    penArtboardId,
    cursorPos,
    handlePenClick,
    handlePenMove,
    handlePenFinish,
    resetPen,
  };
};

export default usePenTool;
