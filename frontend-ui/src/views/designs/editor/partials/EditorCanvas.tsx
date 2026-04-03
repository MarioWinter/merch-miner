import { useRef, useEffect, useState, useCallback } from 'react';
import { Box, CircularProgress, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import { useTranslation } from 'react-i18next';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import HistoryIcon from '@mui/icons-material/History';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import { COLORS } from '@/style/constants';
import type { BatchImage, CanvasToolType } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

type BgPreviewMode = 'transparent' | 'black' | 'white' | 'gray' | 'custom';

const BG_PREVIEW_STYLES: Record<Exclude<BgPreviewMode, 'custom'>, { bg: string; pattern?: string; size?: string }> = {
  transparent: {
    bg: 'transparent',
    pattern: 'repeating-conic-gradient(rgba(128,128,128,0.15) 0% 25%, transparent 0% 50%)',
    size: '16px 16px',
  },
  black: { bg: '#000000' },
  white: { bg: '#FFFFFF' },
  gray: { bg: '#808080' },
};

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const CanvasRoot = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  backgroundColor: COLORS.artboardDark,
  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.artboardLight,
    backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)',
  }),
}));

const BgPreviewOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 6px',
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

const BgSwatchButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  border: $active
    ? `2px solid ${theme.vars.palette.primary.main}`
    : '1px solid rgba(255, 255, 255, 0.15)',
  padding: 0,
  '&:hover': {
    borderColor: theme.vars.palette.primary.light,
  },
}));

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

const DimensionOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 12,
  left: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

const PreviewProgressBar = styled(LinearProgress)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 20,
  height: 3,
});

const ServerProcessingOverlay = styled(Box)({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  zIndex: 15,
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(2px)',
  animation: 'pulse-overlay 2s ease-in-out infinite',
  '@keyframes pulse-overlay': {
    '0%, 100%': { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
    '50%': { backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  },
});

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
  /** Delete current image from server (only for server-persisted images) */
  onDeleteFromServer?: () => void;
  /** Live preview URL from useLivePreview — overrides image source when present */
  livePreviewUrl?: string | null;
  /** Whether live preview is currently computing */
  isPreviewProcessing?: boolean;
  /** Whether a server-side job (BG Remove, AI Upscale) is in progress */
  isServerProcessing?: boolean;
  /** Label for current server processing (e.g. "Removing background...") */
  serverProcessingLabel?: string;
  /** Undo handler */
  onUndo?: () => void;
  /** Redo handler */
  onRedo?: () => void;
  /** Whether undo is available */
  canUndo?: boolean;
  /** Whether redo is available */
  canRedo?: boolean;
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
  onDeleteFromServer,
  livePreviewUrl,
  isPreviewProcessing = false,
  isServerProcessing = false,
  serverProcessingLabel,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: EditorCanvasProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [htmlImage, setHtmlImage] = useState<HTMLImageElement | null>(null);
  const stageSizeRef = useRef(stageSize);

  // Auto-fit helper — compute zoom so the image fits the viewport
  const applyAutoFit = useCallback((imgWidth: number, imgHeight: number) => {
    const { width, height } = stageSizeRef.current;
    if (width <= 0 || height <= 0) return;
    const padding = 40; // 20px on each side
    const fitZoom = Math.min(
      (width - padding) / imgWidth,
      (height - padding) / imgHeight,
      1, // never zoom above 100%
    );
    setZoom(Math.max(MIN_ZOOM, fitZoom));
    setPan({ x: 0, y: 0 });
  }, []);

  // Resize observer for stage dimensions
  const initialFitDone = useRef(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      stageSizeRef.current = { width, height };
      setStageSize({ width, height });

      // Re-apply auto-fit once after the container gets its real size
      if (!initialFitDone.current && width > 0 && height > 0 && originalDimsRef.current) {
        initialFitDone.current = true;
        applyAutoFit(originalDimsRef.current.width, originalDimsRef.current.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [applyAutoFit]);

  // Delete menu anchor for server-persisted images
  const [deleteMenuAnchor, setDeleteMenuAnchor] = useState<HTMLElement | null>(null);

  // BG Preview mode for QC of removal edges
  const [bgPreview, setBgPreview] = useState<BgPreviewMode>('transparent');
  const [customBgColor, setCustomBgColor] = useState('#FF00FF');

  // "Show Original" toggle — temporarily show original instead of processed
  const [showOriginal, setShowOriginal] = useState(false);
  const hasProcessedVersion = !!(image.processedUrl || (image.originalUrl && image.originalUrl !== image.previewUrl));

  // Reset toggle when switching images
  const prevImageForToggle = useRef(image.id);
  if (image.id !== prevImageForToggle.current) {
    prevImageForToggle.current = image.id;
    if (showOriginal) setShowOriginal(false);
  }

  // Load image — prefer live preview > processedUrl > previewUrl (unless showing original)
  const imageSrc = showOriginal
    ? (image.originalUrl ?? image.previewUrl)
    : (livePreviewUrl ?? image.processedUrl ?? image.previewUrl);

  // Track which batch image we're on — only auto-fit on image switch, not preview updates
  const currentImageIdRef = useRef<string | null>(null);

  // Dimension change tracking (for trim indicator)
  const [currentDims, setCurrentDims] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!imageSrc) return;
    const isNewImage = image.id !== currentImageIdRef.current;
    if (isNewImage) {
      currentImageIdRef.current = image.id;
      initialFitDone.current = false;
    }

    const img = new window.Image();
    img.onload = () => {
      // Set dims BEFORE setHtmlImage so the re-render has correct positioning
      const newDims = { width: img.width, height: img.height, imageId: image.id };
      if (isNewImage || !originalDimsRef.current) {
        originalDimsRef.current = newDims;
      }
      setCurrentDims({ width: img.width, height: img.height });
      setHtmlImage(img);
      if (isNewImage) {
        applyAutoFit(img.width, img.height);
      }
    };
    img.onerror = () => { /* keep previous image visible */ };
    img.src = imageSrc;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageSrc, image.id, applyAutoFit]);

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

  // Pointer-based pan (replaces Stage draggable which caused position sync issues)
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (activeTool !== 'move') return;
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOriginRef.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeTool, pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return;
    setPan({
      x: panOriginRef.current.x + (e.clientX - panStartRef.current.x),
      y: panOriginRef.current.y + (e.clientY - panStartRef.current.y),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  // Center/fit image — always use the currently loaded image dimensions
  const handleCenterImage = useCallback(() => {
    if (!htmlImage) return;
    // Reset cached dims so positioning recalculates for current image
    originalDimsRef.current = { width: htmlImage.width, height: htmlImage.height, imageId: image.id };
    applyAutoFit(htmlImage.width, htmlImage.height);
  }, [htmlImage, applyAutoFit, image.id]);

  // Image dimensions for positioning — set in onload before setHtmlImage.
  // Using cached dims prevents jumping on live preview updates.
  const originalDimsRef = useRef<{ width: number; height: number; imageId: string } | null>(null);
  const dims = originalDimsRef.current
    ?? (htmlImage ? { width: htmlImage.width, height: htmlImage.height, imageId: image.id } : null);
  const imgX = dims
    ? (stageSize.width - dims.width * zoom) / 2 + pan.x
    : 0;
  const imgY = dims
    ? (stageSize.height - dims.height * zoom) / 2 + pan.y
    : 0;

  const canvasTools: Array<{ tool: CanvasToolType; icon: React.ReactNode; label: string }> = [
    { tool: 'move', icon: <OpenWithIcon sx={{ fontSize: 18 }} />, label: t('design.tools.move') },
    { tool: 'eraser', icon: <AutoFixHighIcon sx={{ fontSize: 18 }} />, label: t('design.tools.eraser') },
  ];

  return (
    <CanvasRoot
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        cursor: activeTool === 'move' ? (isPanningRef.current ? 'grabbing' : 'grab') : 'crosshair',
        ...(bgPreview !== 'transparent' && {
          backgroundColor: bgPreview === 'custom' ? customBgColor : BG_PREVIEW_STYLES[bgPreview].bg,
          backgroundImage: 'none',
        }),
        ...(bgPreview === 'transparent' && {
          backgroundImage: BG_PREVIEW_STYLES.transparent.pattern,
          backgroundSize: BG_PREVIEW_STYLES.transparent.size,
          backgroundColor: COLORS.artboardDark,
        }),
      }}
    >
      {/* Live preview processing indicator */}
      {isPreviewProcessing && <PreviewProgressBar color="secondary" />}

      {/* Server processing overlay (BG Remove, AI Upscale) */}
      {isServerProcessing && (
        <ServerProcessingOverlay>
          <CircularProgress size={36} sx={{ color: 'secondary.main' }} />
          <Typography variant="body2" color="common.white" sx={{ fontWeight: 500 }}>
            {serverProcessingLabel ?? t('design.editor.serverProcessing')}
          </Typography>
        </ServerProcessingOverlay>
      )}

      {/* Konva Stage */}
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        listening={false}
      >
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
        {image.designId ? (
          <>
            <Tooltip title={t('design.editor.deleteImage')}>
              <IconButton
                size="small"
                onClick={(e) => setDeleteMenuAnchor(e.currentTarget)}
                aria-label={t('design.editor.deleteImage')}
              >
                <DeleteOutlineIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={deleteMenuAnchor}
              open={Boolean(deleteMenuAnchor)}
              onClose={() => setDeleteMenuAnchor(null)}
              slotProps={{ paper: { sx: { minWidth: 200 } } }}
            >
              <MenuItem onClick={() => { setDeleteMenuAnchor(null); onRemoveImage(); }}>
                <ListItemIcon>
                  <RemoveCircleOutlineIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText>{t('design.editor.removeFromBatch')}</ListItemText>
              </MenuItem>
              {onDeleteFromServer && (
                <MenuItem onClick={() => { setDeleteMenuAnchor(null); onDeleteFromServer(); }}>
                  <ListItemIcon>
                    <DeleteForeverIcon sx={{ fontSize: 20, color: 'error.main' }} />
                  </ListItemIcon>
                  <ListItemText sx={{ '& .MuiTypography-root': { color: 'error.main' } }}>
                    {t('design.editor.deletePermanently')}
                  </ListItemText>
                </MenuItem>
              )}
            </Menu>
          </>
        ) : (
          <Tooltip title={t('design.editor.deleteImage')}>
            <IconButton size="small" onClick={onRemoveImage} aria-label={t('design.editor.deleteImage')}>
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
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
        {/* Undo / Redo */}
        <Box sx={{ width: '100%', height: '1px', bgcolor: 'divider', my: 0.25 }} />
        <Tooltip title={`${t('design.toolbar.undo')} (${navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}Z)`} placement="left">
          <span>
            <ToolButton
              disabled={!canUndo}
              onClick={onUndo}
              aria-label={t('design.toolbar.undo')}
            >
              <UndoRoundedIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </span>
        </Tooltip>
        <Tooltip title={`${t('design.toolbar.redo')} (${navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}Shift+Z)`} placement="left">
          <span>
            <ToolButton
              disabled={!canRedo}
              onClick={onRedo}
              aria-label={t('design.toolbar.redo')}
            >
              <RedoRoundedIcon sx={{ fontSize: 18 }} />
            </ToolButton>
          </span>
        </Tooltip>
        {hasProcessedVersion && (
          <>
            <Box sx={{ width: '100%', height: '1px', bgcolor: 'divider', my: 0.25 }} />
            <Tooltip title={showOriginal ? t('design.editor.showProcessed') : t('design.editor.showOriginal')} placement="left">
              <ToolButton
                $active={showOriginal}
                onClick={() => setShowOriginal((p) => !p)}
                aria-label={t('design.editor.showOriginal')}
                aria-pressed={showOriginal}
              >
                <HistoryIcon sx={{ fontSize: 18 }} />
              </ToolButton>
            </Tooltip>
          </>
        )}
      </CanvasToolbarOverlay>

      {/* Zoom controls (bottom-right) */}
      <ZoomOverlay>
        <Tooltip title={t('design.editor.centerImage')}>
          <IconButton size="small" onClick={handleCenterImage} aria-label={t('design.editor.centerImage')}>
            <CenterFocusStrongIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
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

      {/* BG Preview toggle (bottom-center) */}
      <BgPreviewOverlay>
        <Tooltip title={t('design.editor.bgPreview.transparent')}>
          <BgSwatchButton
            $active={bgPreview === 'transparent'}
            onClick={() => setBgPreview('transparent')}
            aria-label={t('design.editor.bgPreview.transparent')}
          >
            <WallpaperIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          </BgSwatchButton>
        </Tooltip>
        <Tooltip title={t('design.editor.bgPreview.black')}>
          <BgSwatchButton
            $active={bgPreview === 'black'}
            onClick={() => setBgPreview('black')}
            aria-label={t('design.editor.bgPreview.black')}
            sx={{ bgcolor: '#000' }}
          />
        </Tooltip>
        <Tooltip title={t('design.editor.bgPreview.white')}>
          <BgSwatchButton
            $active={bgPreview === 'white'}
            onClick={() => setBgPreview('white')}
            aria-label={t('design.editor.bgPreview.white')}
            sx={{ bgcolor: '#FFF' }}
          />
        </Tooltip>
        <Tooltip title={t('design.editor.bgPreview.gray')}>
          <BgSwatchButton
            $active={bgPreview === 'gray'}
            onClick={() => setBgPreview('gray')}
            aria-label={t('design.editor.bgPreview.gray')}
            sx={{ bgcolor: '#808080' }}
          />
        </Tooltip>
        <Tooltip title={t('design.editor.bgPreview.custom')}>
          <BgSwatchButton
            $active={bgPreview === 'custom'}
            onClick={() => setBgPreview('custom')}
            aria-label={t('design.editor.bgPreview.custom')}
            sx={{
              bgcolor: customBgColor,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              component="input"
              type="color"
              value={customBgColor}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setCustomBgColor(e.target.value);
                setBgPreview('custom');
              }}
              sx={{
                position: 'absolute',
                inset: 0,
                opacity: 0,
                cursor: 'pointer',
                width: '100%',
                height: '100%',
              }}
            />
          </BgSwatchButton>
        </Tooltip>
      </BgPreviewOverlay>

      {/* Dimension change indicator (visible after trim/resize) */}
      {currentDims && originalDimsRef.current && (
        currentDims.width !== originalDimsRef.current.width ||
        currentDims.height !== originalDimsRef.current.height
      ) && (
        <DimensionOverlay>
          <Typography variant="caption" color="text.secondary">
            {originalDimsRef.current.width}×{originalDimsRef.current.height}
          </Typography>
          <Typography variant="caption" color="text.secondary">→</Typography>
          <Typography variant="caption" color="primary.main" fontWeight={600}>
            {currentDims.width}×{currentDims.height}
          </Typography>
        </DimensionOverlay>
      )}
    </CanvasRoot>
  );
};
