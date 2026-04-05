import { useCallback, useState } from 'react';
import type { CanvasElement, ArtboardData } from '../types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface SnapGuide {
  /** Orientation: horizontal or vertical line */
  type: 'h' | 'v';
  /** Position in artboard-local coordinates */
  pos: number;
}

interface SnapResult {
  /** Adjusted x position (or original if no snap) */
  x: number;
  /** Adjusted y position (or original if no snap) */
  y: number;
  /** Active guide lines to render */
  guides: SnapGuide[];
}

interface UseSnapGuidesParams {
  artboard: ArtboardData;
  elements: CanvasElement[];
  /** ID of the element currently being dragged */
  draggingElementId: string | null;
}

interface UseSnapGuidesReturn {
  /** Active guides to render (empty when not dragging) */
  activeGuides: SnapGuide[];
  /** Compute snapped position during drag. Call from onDragMove. */
  computeSnap: (
    elementId: string,
    rawX: number,
    rawY: number,
    width: number,
    height: number,
  ) => SnapResult;
  /** Clear guides (call on dragEnd) */
  clearGuides: () => void;
}

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const SNAP_THRESHOLD = 5;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/** Find the closest snap target within threshold. Returns [snapped value, guide pos] or null. */
const findClosest = (
  value: number,
  targets: number[],
  threshold: number,
): { snapped: number; guide: number } | null => {
  let best: { snapped: number; guide: number } | null = null;
  let bestDist = threshold + 1;

  for (const t of targets) {
    const dist = Math.abs(value - t);
    if (dist < bestDist) {
      bestDist = dist;
      best = { snapped: t, guide: t };
    }
  }
  return best;
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useSnapGuides = ({
  artboard,
  elements,
}: UseSnapGuidesParams): UseSnapGuidesReturn => {
  const [activeGuides, setActiveGuides] = useState<SnapGuide[]>([]);

  const computeSnap = useCallback(
    (
      elementId: string,
      rawX: number,
      rawY: number,
      width: number,
      height: number,
    ): SnapResult => {
      const { width: abW, height: abH } = artboard;

      // Dragging element edges + center
      const elLeft = rawX;
      const elCenterX = rawX + width / 2;
      const elRight = rawX + width;
      const elTop = rawY;
      const elCenterY = rawY + height / 2;
      const elBottom = rawY + height;

      // Build vertical snap targets (x-axis)
      const vTargets: number[] = [
        0,             // left edge
        abW / 2,      // center
        abW,           // right edge
      ];

      // Build horizontal snap targets (y-axis)
      const hTargets: number[] = [
        0,             // top edge
        abH / 2,      // center
        abH,           // bottom edge
      ];

      // Add other elements' edges + centers
      for (const el of elements) {
        if (el.id === elementId) continue;
        const ew = el.width * el.scaleX;
        const eh = el.height * el.scaleY;

        vTargets.push(el.x, el.x + ew / 2, el.x + ew);
        hTargets.push(el.y, el.y + eh / 2, el.y + eh);
      }

      // Check each edge/center of the dragging element against targets
      let snappedX = rawX;
      let snappedY = rawY;
      const guides: SnapGuide[] = [];

      // Vertical snapping (x-axis): check left, center, right
      const vChecks = [
        { value: elLeft, offset: 0 },
        { value: elCenterX, offset: width / 2 },
        { value: elRight, offset: width },
      ];

      let bestV: { snapped: number; guide: number; offset: number } | null = null;
      let bestVDist = SNAP_THRESHOLD + 1;

      for (const check of vChecks) {
        const result = findClosest(check.value, vTargets, SNAP_THRESHOLD);
        if (result) {
          const dist = Math.abs(check.value - result.guide);
          if (dist < bestVDist) {
            bestVDist = dist;
            bestV = { ...result, offset: check.offset };
          }
        }
      }

      if (bestV) {
        snappedX = bestV.guide - bestV.offset;
        guides.push({ type: 'v', pos: bestV.guide });
      }

      // Horizontal snapping (y-axis): check top, center, bottom
      const hChecks = [
        { value: elTop, offset: 0 },
        { value: elCenterY, offset: height / 2 },
        { value: elBottom, offset: height },
      ];

      let bestH: { snapped: number; guide: number; offset: number } | null = null;
      let bestHDist = SNAP_THRESHOLD + 1;

      for (const check of hChecks) {
        const result = findClosest(check.value, hTargets, SNAP_THRESHOLD);
        if (result) {
          const dist = Math.abs(check.value - result.guide);
          if (dist < bestHDist) {
            bestHDist = dist;
            bestH = { ...result, offset: check.offset };
          }
        }
      }

      if (bestH) {
        snappedY = bestH.guide - bestH.offset;
        guides.push({ type: 'h', pos: bestH.guide });
      }

      setActiveGuides(guides);

      return { x: snappedX, y: snappedY, guides };
    },
    [artboard, elements],
  );

  const clearGuides = useCallback(() => {
    setActiveGuides([]);
  }, []);

  return { activeGuides, computeSnap, clearGuides };
};

export default useSnapGuides;
