import { useCallback, useEffect, useRef, useState } from 'react';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 1.15; // multiply/divide per discrete wheel tick
const PINCH_SENSITIVITY = 0.01; // scale factor per deltaY pixel for trackpad pinch
const GRID_DOT_VISIBLE_ZOOM = 0.3; // dots appear above 30% zoom
const FIT_PADDING = 60; // px padding when fitting to view

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface CanvasState {
  /** Current zoom level (1 = 100%) */
  zoom: number;
  /** Pan offset in stage coordinates */
  panX: number;
  panY: number;
  /** Container dimensions (from ResizeObserver) */
  stageWidth: number;
  stageHeight: number;
  /** Whether grid dots should be visible */
  showGrid: boolean;
}

interface UseArtboardCanvasReturn {
  state: CanvasState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Callback ref — attach to the container DOM element */
  setContainerRef: (node: HTMLDivElement | null) => void;
  /** Attach Konva Stage ref so zoom reads live position (avoids stale pan during drag) */
  setStageRef: (node: { x: () => number; y: () => number } | null) => void;
  /** Attach to Konva Stage onWheel */
  handleWheel: (e: { evt: WheelEvent }) => void;
  /** Programmatic zoom */
  zoomTo: (newZoom: number, centerX?: number, centerY?: number) => void;
  /** Zoom to fit given bounding box (all artboards) */
  fitToView: (bounds: { x: number; y: number; width: number; height: number } | null) => void;
  /** Set pan offset directly (for Stage drag end) */
  setPan: (x: number, y: number) => void;
  /** Pan so the given world point is centered on screen (keeps current zoom) */
  panTo: (worldX: number, worldY: number) => void;
  /** Reset zoom + pan to default */
  resetView: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useArtboardCanvas = (): UseArtboardCanvasReturn => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [stageWidth, setStageWidth] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);

  // -- Resize observer (uses callback ref to handle late attachment) --
  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    roRef.current = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setStageWidth(Math.round(width));
      setStageHeight(Math.round(height));
    });
    // Container may already be mounted (callback ref fires before useEffect)
    if (containerRef.current) {
      roRef.current.observe(containerRef.current);
    }
    return () => roRef.current?.disconnect();
  }, []);

  // Re-attach observer when containerRef becomes available
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (roRef.current) {
      roRef.current.disconnect();
      if (node) roRef.current.observe(node);
    }
  }, []);

  // Ref to the Konva Stage so we can read its actual position during zoom.
  // Konva updates Stage.x()/y() during drag before React state syncs,
  // so reading the ref avoids stale panX/panY in the zoom handler.
  const stageRef = useRef<{ x: () => number; y: () => number } | null>(null);

  /** Attach the Konva Stage ref so zoom can read live position */
  const setStageRef = useCallback((node: { x: () => number; y: () => number } | null) => {
    stageRef.current = node;
  }, []);

  // -- Wheel zoom (pinch-to-zoom on trackpad also fires wheel) --
  const handleWheel = useCallback(
    (e: { evt: WheelEvent }) => {
      const evt = e.evt;
      evt.preventDefault();

      // Konva wraps the event — find the stage canvas element from the target
      const target = evt.target as HTMLElement;
      const stageEl = target.closest('.konvajs-content') ?? target;
      const rect = stageEl.getBoundingClientRect();
      const pointerX = evt.clientX - rect.left;
      const pointerY = evt.clientY - rect.top;

      setZoom((prevZoom) => {
        let newZoom: number;

        if (evt.ctrlKey) {
          // Trackpad pinch: ctrlKey=true, deltaY is small fractional pixels.
          // Use continuous scaling for smooth zoom.
          const scaleFactor = 1 - evt.deltaY * PINCH_SENSITIVITY;
          newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * scaleFactor));
        } else {
          // Discrete mouse wheel: use step-based zoom.
          // Scale steps by deltaY magnitude for high-resolution scroll wheels.
          const ticks = Math.max(1, Math.abs(evt.deltaY) / 100);
          const direction = evt.deltaY < 0 ? 1 : -1;
          const factor = ZOOM_STEP ** (ticks * direction);
          newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor));
        }

        // Read live Stage position (Konva may have moved it via drag before React state caught up)
        const livePanX = stageRef.current?.x() ?? panX;
        const livePanY = stageRef.current?.y() ?? panY;

        // Zoom towards pointer: adjust pan so the point under the cursor stays fixed
        const scaleRatio = newZoom / prevZoom;
        const newPanX = pointerX - scaleRatio * (pointerX - livePanX);
        const newPanY = pointerY - scaleRatio * (pointerY - livePanY);
        setPanX(newPanX);
        setPanY(newPanY);

        return newZoom;
      });
    },
    [panX, panY],
  );

  // -- Programmatic zoom --
  const zoomTo = useCallback(
    (newZoom: number, centerX?: number, centerY?: number) => {
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
      const cx = centerX ?? stageWidth / 2;
      const cy = centerY ?? stageHeight / 2;

      setZoom((prevZoom) => {
        const scaleRatio = clamped / prevZoom;
        setPanX((prev) => cx - scaleRatio * (cx - prev));
        setPanY((prev) => cy - scaleRatio * (cy - prev));
        return clamped;
      });
    },
    [stageWidth, stageHeight],
  );

  // -- Fit to view --
  const fitToView = useCallback(
    (bounds: { x: number; y: number; width: number; height: number } | null) => {
      if (!bounds || bounds.width === 0 || bounds.height === 0) {
        // No content: reset to center
        setZoom(1);
        setPanX(0);
        setPanY(0);
        return;
      }

      const availW = stageWidth - FIT_PADDING * 2;
      const availH = stageHeight - FIT_PADDING * 2;
      if (availW <= 0 || availH <= 0) return;

      const fitZoom = Math.min(
        availW / bounds.width,
        availH / bounds.height,
        MAX_ZOOM,
      );
      const clamped = Math.max(MIN_ZOOM, fitZoom);

      const newPanX = (stageWidth - bounds.width * clamped) / 2 - bounds.x * clamped;
      const newPanY = (stageHeight - bounds.height * clamped) / 2 - bounds.y * clamped;

      setZoom(clamped);
      setPanX(newPanX);
      setPanY(newPanY);
    },
    [stageWidth, stageHeight],
  );

  // -- Pan setter (for Stage drag end) --
  const setPan = useCallback((x: number, y: number) => {
    setPanX(x);
    setPanY(y);
  }, []);

  // -- Pan to world point (center on screen, keep current zoom) --
  const panTo = useCallback(
    (worldX: number, worldY: number) => {
      setPanX(stageWidth / 2 - worldX * zoom);
      setPanY(stageHeight / 2 - worldY * zoom);
    },
    [stageWidth, stageHeight, zoom],
  );

  // -- Reset --
  const resetView = useCallback(() => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const showGrid = zoom >= GRID_DOT_VISIBLE_ZOOM;

  return {
    state: { zoom, panX, panY, stageWidth, stageHeight, showGrid },
    containerRef,
    setContainerRef,
    setStageRef,
    handleWheel,
    zoomTo,
    fitToView,
    setPan,
    panTo,
    resetView,
  };
};

export default useArtboardCanvas;
