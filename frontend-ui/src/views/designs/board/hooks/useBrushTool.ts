import { useCallback, useRef, useState } from 'react';
import type {
  CanvasElement,
  CanvasElementType,
  BrushElementProps,
  BrushSubStroke,
} from '../types';
import type { CanvasTool } from '../partials/BottomToolbar';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const DEFAULT_STROKE = '#000000';
const DEFAULT_STROKE_WIDTH = 4;
const DEFAULT_TENSION = 0.3;

/** Max gap (ms) between brush-up and next brush-down to merge into same Drawing layer */
const GROUP_WINDOW_MS = 2000;

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
  updateElement: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
  getElements: (artboardId: string) => CanvasElement[];
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
// Helpers
// -----------------------------------------------------------------

/** Compute bounding box from absolute points */
const computeBounds = (points: number[]) => {
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
  return { minX, minY, maxX, maxY };
};

/** Offset points by a delta */
const offsetPoints = (points: number[], dx: number, dy: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    result.push(points[i] + dx, points[i + 1] + dy);
  }
  return result;
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useBrushTool = ({
  activeTool,
  addElement,
  updateElement,
  getElements,
  onElementSelect,
}: UseBrushToolParams): UseBrushToolReturn => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushPreview, setBrushPreview] = useState<BrushPreview | null>(null);

  const drawingRef = useRef<{
    artboardId: string;
    points: number[];
  } | null>(null);

  /** Track last stroke for grouping */
  const lastStrokeRef = useRef<{
    artboardId: string;
    elementId: string;
    timestamp: number;
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

    const now = Date.now();
    const last = lastStrokeRef.current;

    // Check if we should merge into an existing Drawing layer
    const canMerge =
      last &&
      last.artboardId === artboardId &&
      now - last.timestamp < GROUP_WINDOW_MS;

    if (canMerge) {
      // Find the existing element
      const elements = getElements(artboardId);
      const existing = elements.find(
        (el) => el.id === last.elementId && el.type === 'brush',
      );

      if (existing) {
        const existingProps = existing.props as BrushElementProps;

        // Build sub-strokes list from existing element
        const existingSubStrokes: BrushSubStroke[] =
          existingProps.subStrokes && existingProps.subStrokes.length > 0
            ? existingProps.subStrokes
            : [
                {
                  points: existingProps.points,
                  stroke: existingProps.stroke,
                  strokeWidth: existingProps.strokeWidth,
                  tension: existingProps.tension,
                },
              ];

        // Convert new stroke points to absolute coords (they already are)
        // But existing sub-stroke points are relative to element origin — convert to absolute
        const absSubStrokes = existingSubStrokes.map((ss) => ({
          ...ss,
          absPoints: offsetPoints(ss.points, existing.x, existing.y),
        }));

        // New stroke absolute points
        const newAbsPoints = points;

        // Compute combined raw bounding box across all sub-strokes + new stroke
        let rawMinX = Infinity;
        let rawMinY = Infinity;
        let rawMaxX = -Infinity;
        let rawMaxY = -Infinity;
        for (const ss of absSubStrokes) {
          const b = computeBounds(ss.absPoints);
          if (b.minX < rawMinX) rawMinX = b.minX;
          if (b.minY < rawMinY) rawMinY = b.minY;
          if (b.maxX > rawMaxX) rawMaxX = b.maxX;
          if (b.maxY > rawMaxY) rawMaxY = b.maxY;
        }
        {
          const b = computeBounds(newAbsPoints);
          if (b.minX < rawMinX) rawMinX = b.minX;
          if (b.minY < rawMinY) rawMinY = b.minY;
          if (b.maxX > rawMaxX) rawMaxX = b.maxX;
          if (b.maxY > rawMaxY) rawMaxY = b.maxY;
        }

        const newOriginX = rawMinX;
        const newOriginY = rawMinY;

        // Re-relativize all sub-stroke points to new origin
        const mergedSubStrokes: BrushSubStroke[] = [
          ...existingSubStrokes.map((ss, i) => ({
            stroke: ss.stroke,
            strokeWidth: ss.strokeWidth,
            tension: ss.tension,
            points: offsetPoints(
              absSubStrokes[i].absPoints,
              -newOriginX,
              -newOriginY,
            ),
          })),
          {
            stroke: DEFAULT_STROKE,
            strokeWidth: DEFAULT_STROKE_WIDTH,
            tension: DEFAULT_TENSION,
            points: offsetPoints(newAbsPoints, -newOriginX, -newOriginY),
          },
        ];

        // Use first sub-stroke as primary `points` (backward compat)
        const primaryStroke = mergedSubStrokes[0];

        // Single update to avoid double undo snapshot
        updateElement(artboardId, existing.id, {
          x: newOriginX,
          y: newOriginY,
          width: Math.max(1, rawMaxX - rawMinX),
          height: Math.max(1, rawMaxY - rawMinY),
          props: {
            ...existingProps,
            points: primaryStroke.points,
            stroke: primaryStroke.stroke,
            strokeWidth: primaryStroke.strokeWidth,
            tension: primaryStroke.tension,
            subStrokes: mergedSubStrokes,
          },
        });

        // Update last stroke timestamp (extend the window)
        lastStrokeRef.current = {
          artboardId,
          elementId: existing.id,
          timestamp: now,
        };

        onElementSelect(artboardId, existing.id);
        return;
      }
    }

    // --- Create new element (no merge) ---

    const bounds = computeBounds(points);

    // Offset points relative to the bounding box origin
    const relativePoints = offsetPoints(
      points,
      -bounds.minX,
      -bounds.minY,
    );

    const width = Math.max(1, bounds.maxX - bounds.minX);
    const height = Math.max(1, bounds.maxY - bounds.minY);

    const brushProps: BrushElementProps = {
      points: relativePoints,
      stroke: DEFAULT_STROKE,
      strokeWidth: DEFAULT_STROKE_WIDTH,
      tension: DEFAULT_TENSION,
    };

    const newEl = addElement(artboardId, 'brush', brushProps, {
      x: bounds.minX,
      y: bounds.minY,
      width,
      height,
    });

    if (newEl) {
      lastStrokeRef.current = {
        artboardId,
        elementId: newEl.id,
        timestamp: now,
      };
      onElementSelect(artboardId, newEl.id);
    }

    // Brush tool stays active (don't reset to cursor)
  }, [
    isDrawing,
    addElement,
    updateElement,
    getElements,
    onElementSelect,
  ]);

  return {
    isDrawing,
    brushPreview,
    handleBrushStart,
    handleBrushMove,
    handleBrushEnd,
  };
};

export default useBrushTool;
