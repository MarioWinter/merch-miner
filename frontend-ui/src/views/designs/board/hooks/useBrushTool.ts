import { useCallback, useRef, useState } from 'react';
import type { CanvasElementType, BrushElementProps } from '../types';
import type { CanvasTool } from '../partials/BottomToolbar';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const DEFAULT_STROKE = '#000000';
const DEFAULT_STROKE_WIDTH = 4;
const DEFAULT_TENSION = 0.3;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface BrushPreview {
  points: number[];
  stroke: string;
  strokeWidth: number;
  tension: number;
}

interface UseBrushToolParams {
  activeTool: CanvasTool;
  addElement: <T extends CanvasElementType>(
    artboardId: string,
    type: T,
    props: import('../types').CanvasElementPropsMap[T],
    overrides?: Partial<Omit<import('../types').CanvasElement<T>, 'id' | 'type' | 'props'>>,
  ) => import('../types').CanvasElement<T> | null;
  onElementSelect: (artboardId: string, elementId: string) => void;
}

interface UseBrushToolReturn {
  isDrawing: boolean;
  brushPreview: BrushPreview | null;
  handleBrushStart: (artboardId: string, localX: number, localY: number) => void;
  handleBrushMove: (localX: number, localY: number) => void;
  handleBrushEnd: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useBrushTool = ({
  activeTool,
  addElement,
  onElementSelect,
}: UseBrushToolParams): UseBrushToolReturn => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushPreview, setBrushPreview] = useState<BrushPreview | null>(null);

  const drawingRef = useRef<{
    artboardId: string;
    points: number[];
  } | null>(null);

  const handleBrushStart = useCallback(
    (artboardId: string, localX: number, localY: number) => {
      if (activeTool !== 'brush') return;

      const points = [localX, localY];
      drawingRef.current = { artboardId, points };
      setIsDrawing(true);
      setBrushPreview({
        points,
        stroke: DEFAULT_STROKE,
        strokeWidth: DEFAULT_STROKE_WIDTH,
        tension: DEFAULT_TENSION,
      });
    },
    [activeTool],
  );

  const handleBrushMove = useCallback(
    (localX: number, localY: number) => {
      if (!isDrawing || !drawingRef.current) return;

      drawingRef.current.points.push(localX, localY);
      const pts = [...drawingRef.current.points];
      setBrushPreview((prev) =>
        prev ? { ...prev, points: pts } : null,
      );
    },
    [isDrawing],
  );

  const handleBrushEnd = useCallback(() => {
    if (!isDrawing || !drawingRef.current) return;

    const { artboardId, points } = drawingRef.current;

    setIsDrawing(false);
    setBrushPreview(null);
    drawingRef.current = null;

    // Need at least 2 points (4 values) to make a stroke
    if (points.length < 4) return;

    // Compute bounding box for width/height
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      const px = points[i];
      const py = points[i + 1];
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }

    // Offset points relative to the bounding box origin
    const relativePoints: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      relativePoints.push(points[i] - minX, points[i + 1] - minY);
    }

    const width = Math.max(1, maxX - minX);
    const height = Math.max(1, maxY - minY);

    const brushProps: BrushElementProps = {
      points: relativePoints,
      stroke: DEFAULT_STROKE,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      tension: DEFAULT_TENSION,
    };

    const newEl = addElement(artboardId, 'brush', brushProps, {
      x: minX,
      y: minY,
      width,
      height,
    });

    if (newEl) {
      onElementSelect(artboardId, newEl.id);
    }

    // Brush tool stays active (don't reset to cursor)
  }, [isDrawing, addElement, onElementSelect]);

  return {
    isDrawing,
    brushPreview,
    handleBrushStart,
    handleBrushMove,
    handleBrushEnd,
  };
};

export default useBrushTool;
