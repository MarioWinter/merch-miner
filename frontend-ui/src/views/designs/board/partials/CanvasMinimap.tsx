import { useCallback, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import type { ArtboardData } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const MINIMAP_W = 160;
const MINIMAP_H = 110;
const WORLD_PAD = 100; // extra world-space padding around content

// -----------------------------------------------------------------
// Styles
// -----------------------------------------------------------------

const MinimapRoot = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 8,
  right: 8,
  width: MINIMAP_W,
  height: MINIMAP_H,
  borderRadius: 8,
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: alpha(COLORS.ink, 0.85),
  overflow: 'hidden',
  cursor: 'pointer',
  zIndex: 20,
  backdropFilter: 'blur(4px)',
  transition: 'opacity 150ms ease',
  '&:hover': { opacity: 1 },
  opacity: 0.85,
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.white, 0.9),
  }),
}));

const ArtboardRect = styled(Box, {
  shouldForwardProp: (p) => p !== '$isSelected',
})<{ $isSelected: boolean }>(({ theme, $isSelected }) => ({
  position: 'absolute',
  borderRadius: 1,
  backgroundColor: $isSelected
    ? alpha(COLORS.cyan, 0.6)
    : alpha(COLORS.snow, 0.25),
  border: $isSelected ? `1px solid ${COLORS.cyan}` : '1px solid transparent',
  ...theme.applyStyles('light', {
    backgroundColor: $isSelected
      ? alpha(COLORS.teal, 0.4)
      : alpha(COLORS.ink, 0.15),
  }),
}));

const ViewportRect = styled(Box)(({ theme }) => ({
  position: 'absolute',
  border: `1.5px solid ${COLORS.red}`,
  borderRadius: 2,
  backgroundColor: alpha(COLORS.red, 0.08),
  pointerEvents: 'none',
  ...theme.applyStyles('light', {
    backgroundColor: alpha(COLORS.red, 0.06),
  }),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface CanvasMinimapProps {
  artboards: ArtboardData[];
  selectedIds: Set<string>;
  zoom: number;
  panX: number;
  panY: number;
  stageWidth: number;
  stageHeight: number;
  onPanTo: (worldX: number, worldY: number) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const CanvasMinimap = ({
  artboards,
  selectedIds,
  zoom,
  panX,
  panY,
  stageWidth,
  stageHeight,
  onPanTo,
}: CanvasMinimapProps) => {
  const rootRef = useRef<HTMLDivElement>(null);

  // Viewport in world coords
  const viewLeft = -panX / zoom;
  const viewTop = -panY / zoom;
  const viewW = stageWidth / zoom;
  const viewH = stageHeight / zoom;

  // Combined bounding box (artboards + viewport)
  const { worldBounds, scale } = useMemo(() => {
    let minX = viewLeft;
    let minY = viewTop;
    let maxX = viewLeft + viewW;
    let maxY = viewTop + viewH;

    for (const ab of artboards) {
      minX = Math.min(minX, ab.x);
      minY = Math.min(minY, ab.y);
      maxX = Math.max(maxX, ab.x + ab.width);
      maxY = Math.max(maxY, ab.y + ab.height);
    }

    minX -= WORLD_PAD;
    minY -= WORLD_PAD;
    maxX += WORLD_PAD;
    maxY += WORLD_PAD;

    const wW = maxX - minX;
    const wH = maxY - minY;
    const s = Math.min(MINIMAP_W / wW, MINIMAP_H / wH);

    return {
      worldBounds: { minX, minY, width: wW, height: wH },
      scale: s,
    };
  }, [artboards, viewLeft, viewTop, viewW, viewH]);

  // Click → navigate
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      // Center minimap content within the minimap
      const contentW = worldBounds.width * scale;
      const contentH = worldBounds.height * scale;
      const offsetX = (MINIMAP_W - contentW) / 2;
      const offsetY = (MINIMAP_H - contentH) / 2;

      const worldX = (mx - offsetX) / scale + worldBounds.minX;
      const worldY = (my - offsetY) / scale + worldBounds.minY;
      onPanTo(worldX, worldY);
    },
    [worldBounds, scale, onPanTo],
  );

  if (artboards.length === 0) return null;

  // Center the minimap content
  const contentW = worldBounds.width * scale;
  const contentH = worldBounds.height * scale;
  const offsetX = (MINIMAP_W - contentW) / 2;
  const offsetY = (MINIMAP_H - contentH) / 2;

  const toMiniX = (wx: number) => (wx - worldBounds.minX) * scale + offsetX;
  const toMiniY = (wy: number) => (wy - worldBounds.minY) * scale + offsetY;

  return (
    <MinimapRoot ref={rootRef} onClick={handleClick}>
      {artboards.map((ab) => (
        <ArtboardRect
          key={ab.id}
          $isSelected={selectedIds.has(ab.id)}
          sx={{
            left: toMiniX(ab.x),
            top: toMiniY(ab.y),
            width: Math.max(ab.width * scale, 3),
            height: Math.max(ab.height * scale, 3),
          }}
        />
      ))}
      <ViewportRect
        sx={{
          left: toMiniX(viewLeft),
          top: toMiniY(viewTop),
          width: viewW * scale,
          height: viewH * scale,
        }}
      />
    </MinimapRoot>
  );
};

export default CanvasMinimap;
