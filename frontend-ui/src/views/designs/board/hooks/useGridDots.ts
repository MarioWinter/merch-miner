import { useMemo } from 'react';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const GRID_DOT_SPACING = 40;
const MAX_DOTS = 10000;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseGridDotsParams {
  zoom: number;
  panX: number;
  panY: number;
  stageWidth: number;
  stageHeight: number;
}

interface GridDot {
  x: number;
  y: number;
  key: string;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useGridDots = ({ zoom, panX, panY, stageWidth, stageHeight }: UseGridDotsParams): GridDot[] =>
  useMemo(() => {
    if (stageWidth === 0 || stageHeight === 0) return [];
    const worldLeft = -panX / zoom;
    const worldTop = -panY / zoom;
    const worldRight = worldLeft + stageWidth / zoom;
    const worldBottom = worldTop + stageHeight / zoom;

    const startX = Math.floor(worldLeft / GRID_DOT_SPACING) * GRID_DOT_SPACING;
    const startY = Math.floor(worldTop / GRID_DOT_SPACING) * GRID_DOT_SPACING;
    const endX = Math.ceil(worldRight / GRID_DOT_SPACING) * GRID_DOT_SPACING;
    const endY = Math.ceil(worldBottom / GRID_DOT_SPACING) * GRID_DOT_SPACING;

    const colCount = (endX - startX) / GRID_DOT_SPACING + 1;
    const rowCount = (endY - startY) / GRID_DOT_SPACING + 1;
    if (colCount * rowCount > MAX_DOTS) return [];

    const dots: GridDot[] = [];
    for (let x = startX; x <= endX; x += GRID_DOT_SPACING) {
      for (let y = startY; y <= endY; y += GRID_DOT_SPACING) {
        dots.push({ x, y, key: `${x}_${y}` });
      }
    }
    return dots;
  }, [zoom, panX, panY, stageWidth, stageHeight]);

export default useGridDots;
