import { useCallback, useRef, useState } from 'react';
import type Konva from 'konva';
import type { RubberBandRect } from '../types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseRubberBandParams {
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  selectByRect: (rect: { x: number; y: number; width: number; height: number }) => void;
  deselectAll: () => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  /** When true, skip rubber-band and let Stage drag handle panning */
  isPanMode?: boolean;
}

interface UseRubberBandReturn {
  rubberBand: RubberBandRect | null;
  isRubberBanding: boolean;
  rubberBandOriginRef: React.RefObject<{ x: number; y: number } | null>;
  isDraggingStageRef: React.RefObject<boolean>;
  handleMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleMouseMove: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  handleMouseUp: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useRubberBand = ({
  screenToWorld,
  selectByRect,
  deselectAll,
  stageRef,
  isPanMode = false,
}: UseRubberBandParams): UseRubberBandReturn => {
  const [rubberBand, setRubberBand] = useState<RubberBandRect | null>(null);
  const [isRubberBanding, setIsRubberBanding] = useState(false);
  const rubberBandOriginRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingStageRef = useRef(false);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== e.currentTarget) return;
      isDraggingStageRef.current = false;

      // Skip rubber-band in pan mode, middle-click, or space+click — let Stage drag handle pan
      if (isPanMode || e.evt.button === 1 || e.evt.button === 2) return;

      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const world = screenToWorld(pos.x, pos.y);
      rubberBandOriginRef.current = world;
      setIsRubberBanding(true);
    },
    [screenToWorld, stageRef, isPanMode],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!rubberBandOriginRef.current) return;

      const stage = stageRef.current;
      if (!stage) return;
      const pos = stage.getPointerPosition();
      if (!pos) return;

      const world = screenToWorld(pos.x, pos.y);
      const origin = rubberBandOriginRef.current;

      const dx = world.x - origin.x;
      const dy = world.y - origin.y;
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4 && !rubberBand) return;

      isDraggingStageRef.current = true;

      const rect: RubberBandRect = {
        x: origin.x,
        y: origin.y,
        width: dx,
        height: dy,
      };
      setRubberBand(rect);
      selectByRect(rect);
      e.cancelBubble = true;
    },
    [screenToWorld, stageRef, rubberBand, selectByRect],
  );

  const handleMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (rubberBand) {
        selectByRect(rubberBand);
      } else if (e.target === e.currentTarget && !isDraggingStageRef.current) {
        deselectAll();
      }

      rubberBandOriginRef.current = null;
      setRubberBand(null);
      setIsRubberBanding(false);
      isDraggingStageRef.current = false;
    },
    [rubberBand, selectByRect, deselectAll],
  );

  return {
    rubberBand,
    isRubberBanding,
    rubberBandOriginRef,
    isDraggingStageRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
};

export default useRubberBand;
