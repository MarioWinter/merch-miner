import { useCallback, useRef, useState } from 'react';
import type { CanvasElementType, ShapeElementProps, ShapeKind } from '../types';
import type { CanvasTool } from '../partials/BottomToolbar';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** Minimum drag distance (px) to count as a drag vs. a click */
const MIN_DRAG_DISTANCE = 5;
const DEFAULT_SHAPE_SIZE = 100;

/** Default fill/stroke per shape kind */
const SHAPE_DEFAULTS: Record<string, Partial<ShapeElementProps>> = {
  rectangle: { shapeKind: 'rect', fill: '#00C8D7', stroke: '#000000', strokeWidth: 2, cornerRadius: 0 },
  ellipse: { shapeKind: 'ellipse', fill: '#FF5A4F', stroke: '#000000', strokeWidth: 2 },
  triangle: { shapeKind: 'triangle', fill: '#22D3A3', stroke: '#000000', strokeWidth: 2 },
  line: { shapeKind: 'line', fill: '', stroke: '#000000', strokeWidth: 2 },
};

const TOOL_TO_KIND: Record<string, ShapeKind> = {
  rectangle: 'rect',
  ellipse: 'ellipse',
  triangle: 'triangle',
  line: 'line',
};

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface DrawPreview {
  x: number;
  y: number;
  width: number;
  height: number;
  shapeKind: ShapeKind;
}

interface UseDrawingHandlersParams {
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

interface UseDrawingHandlersReturn {
  isDrawing: boolean;
  drawPreview: DrawPreview | null;
  handleDrawStart: (artboardId: string, localX: number, localY: number) => void;
  handleDrawMove: (localX: number, localY: number) => void;
  handleDrawEnd: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useDrawingHandlers = ({
  activeTool,
  addElement,
  setActiveTool,
  onElementSelect,
}: UseDrawingHandlersParams): UseDrawingHandlersReturn => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPreview, setDrawPreview] = useState<DrawPreview | null>(null);

  const originRef = useRef<{
    artboardId: string;
    startX: number;
    startY: number;
  } | null>(null);

  const isShapeTool = (tool: CanvasTool): boolean =>
    tool === 'rectangle' || tool === 'ellipse' || tool === 'triangle' || tool === 'line';

  const handleDrawStart = useCallback(
    (artboardId: string, localX: number, localY: number) => {
      if (!isShapeTool(activeTool)) return;

      originRef.current = { artboardId, startX: localX, startY: localY };
      setIsDrawing(true);

      const kind = TOOL_TO_KIND[activeTool] ?? 'rect';
      setDrawPreview({
        x: localX,
        y: localY,
        width: 0,
        height: 0,
        shapeKind: kind,
      });
    },
    [activeTool],
  );

  const handleDrawMove = useCallback(
    (localX: number, localY: number) => {
      if (!isDrawing || !originRef.current) return;

      const { startX, startY } = originRef.current;
      const x = Math.min(startX, localX);
      const y = Math.min(startY, localY);
      const width = Math.abs(localX - startX);
      const height = Math.abs(localY - startY);

      const kind = TOOL_TO_KIND[activeTool] ?? 'rect';
      setDrawPreview({ x, y, width, height, shapeKind: kind });
    },
    [isDrawing, activeTool],
  );

  const handleDrawEnd = useCallback(() => {
    if (!isDrawing || !originRef.current) return;

    const { artboardId, startX, startY } = originRef.current;
    const preview = drawPreview;

    setIsDrawing(false);
    setDrawPreview(null);
    originRef.current = null;

    const defaults = SHAPE_DEFAULTS[activeTool];
    if (!defaults) return;

    // Determine if it was a click (tiny drag) or actual drag
    const dragDistance = preview
      ? Math.max(preview.width, preview.height)
      : 0;

    const isClick = dragDistance < MIN_DRAG_DISTANCE;
    const finalX = isClick ? startX - DEFAULT_SHAPE_SIZE / 2 : (preview?.x ?? startX);
    const finalY = isClick ? startY - DEFAULT_SHAPE_SIZE / 2 : (preview?.y ?? startY);
    const finalW = isClick ? DEFAULT_SHAPE_SIZE : Math.max(1, preview?.width ?? DEFAULT_SHAPE_SIZE);
    const finalH = isClick ? DEFAULT_SHAPE_SIZE : Math.max(1, preview?.height ?? DEFAULT_SHAPE_SIZE);

    const shapeProps: ShapeElementProps = {
      shapeKind: defaults.shapeKind!,
      fill: defaults.fill ?? '',
      stroke: defaults.stroke ?? '#000000',
      strokeWidth: defaults.strokeWidth ?? 2,
      cornerRadius: defaults.cornerRadius,
      points: defaults.shapeKind === 'line' ? [0, 0, finalW, finalH] : undefined,
    };

    const newEl = addElement(artboardId, 'shape', shapeProps, {
      x: finalX,
      y: finalY,
      width: finalW,
      height: finalH,
    });

    if (newEl) {
      onElementSelect(artboardId, newEl.id);
    }

    setActiveTool('cursor');
  }, [isDrawing, drawPreview, activeTool, addElement, setActiveTool, onElementSelect]);

  return {
    isDrawing,
    drawPreview,
    handleDrawStart,
    handleDrawMove,
    handleDrawEnd,
  };
};

export default useDrawingHandlers;
