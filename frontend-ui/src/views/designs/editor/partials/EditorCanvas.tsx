import { useRef, useEffect, useState, useCallback } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Stage, Layer, Image as KonvaImage, Rect } from 'react-konva';
import { useTranslation } from 'react-i18next';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import type { BatchImage, CanvasToolType } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const CHECKERBOARD_SIZE = 16;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const CanvasRoot = styled(Box)({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
});

const BatchNavOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 12,
  left: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

const CanvasToolbarOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 12,
  right: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 4,
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

const ZoomOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 12,
  right: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

const ToolButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  width: 32,
  height: 32,
  borderRadius: 6,
  color: $active ? theme.vars.palette.primary.main : theme.vars.palette.text.secondary,
  backgroundColor: $active ? 'rgba(255, 90, 79, 0.12)' : 'transparent',
  '&:hover': {
    backgroundColor: $active ? 'rgba(255, 90, 79, 0.18)' : 'rgba(255, 255, 255, 0.08)',
  },
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface EditorCanvasProps {
  image: BatchImage;
  activeTool: CanvasToolType;
  onToolChange: (tool: CanvasToolType) => void;
  batchIndex: number;
  batchTotal: number;
  onNavigate: (index: number) => void;
  onRemoveImage: () => void;
  onRemoveAll: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const EditorCanvas = ({
  image,
  activeTool,
  onToolChange,
  batchIndex,
  batchTotal,
  onNavigate,
  onRemoveImage,
  onRemoveAll,
}: EditorCanvasProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [htmlImage, setHtmlImage] = useState<HTMLImageElement | null>(null);

  // Resize observer for stage dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setStageSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load image — previewUrl change triggers load via Image constructor
  useEffect(() => {
    if (!image.previewUrl) return;
    const img = new window.Image();
    img.onload = () => setHtmlImage(img);
    img.onerror = () => setHtmlImage(null);
    img.src = image.previewUrl;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [image.previewUrl]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && batchIndex > 0) {
        onNavigate(batchIndex - 1);
      } else if (e.key === 'ArrowRight' && batchIndex < batchTotal - 1) {
        onNavigate(batchIndex + 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [batchIndex, batchTotal, onNavigate]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
    });
  }, []);

  // Checkerboard pattern: rendered as a series of rects
  const renderCheckerboard = () => {
    const cols = Math.ceil(stageSize.width / CHECKERBOARD_SIZE) + 1;
    const rows = Math.ceil(stageSize.height / CHECKERBOARD_SIZE) + 1;
    const rects = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r + c) % 2 === 0) {
          rects.push(
            <Rect
              key={`cb-${r}-${c}`}
              x={c * CHECKERBOARD_SIZE}
              y={r * CHECKERBOARD_SIZE}
              width={CHECKERBOARD_SIZE}
              height={CHECKERBOARD_SIZE}
              fill="#1a1a1a"
              listening={false}
            />,
          );
        }
      }
    }
    return rects;
  };

  // Center image in canvas
  const imgX = htmlImage
    ? (stageSize.width - htmlImage.width * zoom) / 2 + pan.x
    : 0;
  const imgY = htmlImage
    ? (stageSize.height - htmlImage.height * zoom) / 2 + pan.y
    : 0;

  const canvasTools: Array<{ tool: CanvasToolType; icon: React.ReactNode; label: string }> = [
    { tool: 'move', icon: <OpenWithIcon sx={{ fontSize: 18 }} />, label: t('design.tools.move') },
    { tool: 'eraser', icon: <AutoFixHighIcon sx={{ fontSize: 18 }} />, label: t('design.tools.eraser') },
  ];

  return (
    <CanvasRoot ref={containerRef} onWheel={handleWheel}>
      {/* Konva Stage */}
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        draggable={activeTool === 'move'}
        onDragEnd={(e) => {
          setPan({ x: e.target.x(), y: e.target.y() });
        }}
        style={{ cursor: activeTool === 'move' ? 'grab' : 'crosshair' }}
      >
        {/* Checkerboard background layer */}
        <Layer listening={false}>
          <Rect
            x={0}
            y={0}
            width={stageSize.width}
            height={stageSize.height}
            fill="#222222"
          />
          {renderCheckerboard()}
        </Layer>

        {/* Image layer */}
        <Layer>
          {htmlImage && (
            <KonvaImage
              image={htmlImage}
              x={imgX}
              y={imgY}
              width={htmlImage.width * zoom}
              height={htmlImage.height * zoom}
            />
          )}
        </Layer>
      </Stage>

      {/* Batch nav overlay (top-left) */}
      <BatchNavOverlay>
        <Tooltip title={t('design.editor.previousImage')}>
          <span>
            <IconButton
              size="small"
              disabled={batchIndex === 0}
              onClick={() => onNavigate(batchIndex - 1)}
              aria-label={t('design.editor.previousImage')}
            >
              <NavigateBeforeIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="body2" color="text.primary" sx={{ px: 0.5, minWidth: 48, textAlign: 'center' }}>
          {t('design.editor.batchCount', { current: batchIndex + 1, total: batchTotal })}
        </Typography>
        <Tooltip title={t('design.editor.nextImage')}>
          <span>
            <IconButton
              size="small"
              disabled={batchIndex === batchTotal - 1}
              onClick={() => onNavigate(batchIndex + 1)}
              aria-label={t('design.editor.nextImage')}
            >
              <NavigateNextIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('design.editor.deleteImage')}>
          <IconButton size="small" onClick={onRemoveImage} aria-label={t('design.editor.deleteImage')}>
            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('design.editor.deleteAll')}>
          <IconButton size="small" onClick={onRemoveAll} aria-label={t('design.editor.deleteAll')}>
            <DeleteSweepIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </BatchNavOverlay>

      {/* Canvas mini-toolbar (top-right) */}
      <CanvasToolbarOverlay aria-label={t('design.editor.canvasToolbar')}>
        {canvasTools.map(({ tool, icon, label }) => (
          <Tooltip key={tool} title={label} placement="left">
            <ToolButton
              $active={activeTool === tool}
              onClick={() => onToolChange(tool)}
              aria-label={label}
              aria-pressed={activeTool === tool}
            >
              {icon}
            </ToolButton>
          </Tooltip>
        ))}
      </CanvasToolbarOverlay>

      {/* Zoom controls (bottom-right) */}
      <ZoomOverlay>
        <Tooltip title={t('design.board.zoomOut')}>
          <IconButton
            size="small"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
            aria-label={t('design.board.zoomOut')}
          >
            <ZoomOutIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Typography variant="caption" color="text.primary" sx={{ minWidth: 40, textAlign: 'center' }}>
          {Math.round(zoom * 100)}%
        </Typography>
        <Tooltip title={t('design.board.zoomIn')}>
          <IconButton
            size="small"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
            aria-label={t('design.board.zoomIn')}
          >
            <ZoomInIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </ZoomOverlay>
    </CanvasRoot>
  );
};
