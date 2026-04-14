import { useRef, useEffect, useState, useCallback } from 'react';
import { Box, CircularProgress, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
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
import {
  CanvasRoot, BatchNavOverlay, CanvasToolbarOverlay, ZoomOverlay,
  BgPreviewOverlay, BgSwatchButton, DimensionOverlay, PreviewProgressBar,
  ServerProcessingOverlay, ToolButton,
  MIN_ZOOM, MAX_ZOOM, ZOOM_STEP, BG_PREVIEW_STYLES,
} from './EditorCanvas.styles';
import type { BgPreviewMode } from './EditorCanvas.styles';

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
  onDeleteFromServer?: () => void;
  onDeleteVersion?: (version: 'original' | 'processed' | 'bg_removed' | 'upscaled') => void;
  livePreviewUrl?: string | null;
  isPreviewProcessing?: boolean;
  isServerProcessing?: boolean;
  serverProcessingLabel?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const EditorCanvas = ({
  image, activeTool, onToolChange, batchIndex, batchTotal, onNavigate,
  onRemoveImage, onRemoveAll, onDeleteFromServer, onDeleteVersion,
  livePreviewUrl, isPreviewProcessing = false, isServerProcessing = false,
  serverProcessingLabel, onUndo, onRedo, canUndo = false, canRedo = false,
}: EditorCanvasProps) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [htmlImage, setHtmlImage] = useState<HTMLImageElement | null>(null);
  const stageSizeRef = useRef(stageSize);

  // Auto-fit helper
  const applyAutoFit = useCallback((imgWidth: number, imgHeight: number) => {
    const { width, height } = stageSizeRef.current;
    if (width <= 0 || height <= 0) return;
    const padding = 40;
    const fitZoom = Math.min((width - padding) / imgWidth, (height - padding) / imgHeight, 1);
    setZoom(Math.max(MIN_ZOOM, fitZoom));
    setPan({ x: 0, y: 0 });
  }, []);

  // Resize observer — uses a separate ref to read original dims without mutation conflict
  const initialFitDone = useRef(false);
  const initialDimsForFitRef = useRef<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      stageSizeRef.current = { width, height };
      setStageSize({ width, height });
      if (!initialFitDone.current && width > 0 && height > 0 && initialDimsForFitRef.current) {
        initialFitDone.current = true;
        applyAutoFit(initialDimsForFitRef.current.width, initialDimsForFitRef.current.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [applyAutoFit]);

  // Delete menu + BG preview + show original
  const [deleteMenuAnchor, setDeleteMenuAnchor] = useState<HTMLElement | null>(null);
  const [bgPreview, setBgPreview] = useState<BgPreviewMode>('transparent');
  const [customBgColor, setCustomBgColor] = useState('#FF00FF');
  const [showOriginal, setShowOriginal] = useState(false);
  const [showOriginalImageId, setShowOriginalImageId] = useState(image.id);
  if (image.id !== showOriginalImageId) {
    setShowOriginalImageId(image.id);
    if (showOriginal) setShowOriginal(false);
  }
  const hasProcessedVersion = !!(image.processedUrl || (image.originalUrl && image.originalUrl !== image.previewUrl));

  // Image source resolution
  const imageSrc = showOriginal
    ? (image.originalUrl ?? image.previewUrl)
    : (image.processedUrl ?? livePreviewUrl ?? image.previewUrl);

  const currentImageIdRef = useRef<string | null>(null);
  const [currentDims, setCurrentDims] = useState<{ width: number; height: number } | null>(null);
  const [originalDims, setOriginalDims] = useState<{ width: number; height: number; imageId: string } | null>(null);
  const originalDimsRef = useRef<{ width: number; height: number; imageId: string } | null>(null);

  const updateOriginalDims = useCallback((d: { width: number; height: number; imageId: string }) => {
    originalDimsRef.current = d;
    initialDimsForFitRef.current = d;
    setOriginalDims(d);
  }, []);

  // Load image
  useEffect(() => {
    if (!imageSrc) return;
    const isNewImage = image.id !== currentImageIdRef.current;
    if (isNewImage) { currentImageIdRef.current = image.id; initialFitDone.current = false; }
    const img = new window.Image();
    img.onload = () => {
      const newDims = { width: img.width, height: img.height, imageId: image.id };
      if (isNewImage || !originalDimsRef.current) updateOriginalDims(newDims);
      setCurrentDims({ width: img.width, height: img.height });
      setHtmlImage(img);
      if (isNewImage) applyAutoFit(img.width, img.height);
    };
    img.onerror = () => {};
    img.src = imageSrc;
    return () => { img.onload = null; img.onerror = null; };
  }, [imageSrc, image.id, applyAutoFit]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && batchIndex > 0) onNavigate(batchIndex - 1);
      else if (e.key === 'ArrowRight' && batchIndex < batchTotal - 1) onNavigate(batchIndex + 1);
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

  // Pointer-based pan
  const isPanningRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (activeTool !== 'move') return;
    isPanningRef.current = true;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOriginRef.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [activeTool, pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPanningRef.current) return;
    setPan({ x: panOriginRef.current.x + (e.clientX - panStartRef.current.x), y: panOriginRef.current.y + (e.clientY - panStartRef.current.y) });
  }, []);

  const handlePointerUp = useCallback(() => { isPanningRef.current = false; setIsPanning(false); }, []);

  const handleCenterImage = useCallback(() => {
    if (!htmlImage) return;
    updateOriginalDims({ width: htmlImage.width, height: htmlImage.height, imageId: image.id });
    applyAutoFit(htmlImage.width, htmlImage.height);
  }, [htmlImage, applyAutoFit, image.id]);

  // Positioning
  const dims = originalDims ?? (htmlImage ? { width: htmlImage.width, height: htmlImage.height, imageId: image.id } : null);
  const imgX = dims ? (stageSize.width - dims.width * zoom) / 2 + pan.x : 0;
  const imgY = dims ? (stageSize.height - dims.height * zoom) / 2 + pan.y : 0;

  const canvasTools: Array<{ tool: CanvasToolType; icon: React.ReactNode; label: string }> = [
    { tool: 'move', icon: <OpenWithIcon sx={{ fontSize: 18 }} />, label: t('design.tools.move') },
    { tool: 'eraser', icon: <AutoFixHighIcon sx={{ fontSize: 18 }} />, label: t('design.tools.eraser') },
  ];

  return (
    <CanvasRoot
      ref={containerRef} onWheel={handleWheel} onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}
      style={{
        cursor: activeTool === 'move' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair',
        ...(bgPreview !== 'transparent' && { backgroundColor: bgPreview === 'custom' ? customBgColor : BG_PREVIEW_STYLES[bgPreview].bg, backgroundImage: 'none' }),
        ...(bgPreview === 'transparent' && { backgroundImage: BG_PREVIEW_STYLES.transparent.pattern, backgroundSize: BG_PREVIEW_STYLES.transparent.size, backgroundColor: COLORS.artboardDark }),
      }}
    >
      {isPreviewProcessing && <PreviewProgressBar color="secondary" />}
      {isServerProcessing && (
        <ServerProcessingOverlay>
          <CircularProgress size={36} sx={{ color: 'secondary.main' }} />
          <Typography variant="body2" color="common.white" sx={{ fontWeight: 500 }}>
            {serverProcessingLabel ?? t('design.editor.serverProcessing')}
          </Typography>
        </ServerProcessingOverlay>
      )}

      <Stage width={stageSize.width} height={stageSize.height} listening={false}>
        <Layer>
          {htmlImage && <KonvaImage image={htmlImage} x={imgX} y={imgY} width={htmlImage.width * zoom} height={htmlImage.height * zoom} />}
        </Layer>
      </Stage>

      {/* Batch nav (top-left) */}
      <BatchNavOverlay>
        <Tooltip title={t('design.editor.previousImage')}>
          <span><IconButton size="small" disabled={batchIndex === 0} onClick={() => onNavigate(batchIndex - 1)} aria-label={t('design.editor.previousImage')}><NavigateBeforeIcon sx={{ fontSize: 18 }} /></IconButton></span>
        </Tooltip>
        <Typography variant="body2" color="text.primary" sx={{ px: 0.5, minWidth: 48, textAlign: 'center' }}>
          {t('design.editor.batchCount', { current: batchIndex + 1, total: batchTotal })}
        </Typography>
        <Tooltip title={t('design.editor.nextImage')}>
          <span><IconButton size="small" disabled={batchIndex === batchTotal - 1} onClick={() => onNavigate(batchIndex + 1)} aria-label={t('design.editor.nextImage')}><NavigateNextIcon sx={{ fontSize: 18 }} /></IconButton></span>
        </Tooltip>
        {image.designId ? (
          <>
            <Tooltip title={t('design.editor.deleteImage')}>
              <IconButton size="small" onClick={(e) => setDeleteMenuAnchor(e.currentTarget)} aria-label={t('design.editor.deleteImage')}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton>
            </Tooltip>
            <Menu anchorEl={deleteMenuAnchor} open={Boolean(deleteMenuAnchor)} onClose={() => setDeleteMenuAnchor(null)} slotProps={{ paper: { sx: { minWidth: 200 } } }}>
              {onDeleteVersion && (
                <MenuItem onClick={() => { setDeleteMenuAnchor(null); if (showOriginal) { onDeleteVersion('original'); } else if (image.processedUrl) { onDeleteVersion('processed'); } else { onDeleteVersion('original'); } }}>
                  <ListItemIcon><DeleteOutlineIcon sx={{ fontSize: 20, color: 'warning.main' }} /></ListItemIcon>
                  <ListItemText sx={{ '& .MuiTypography-root': { color: 'warning.main' } }}>
                    {showOriginal ? t('design.editor.deleteOriginal', 'Delete original') : hasProcessedVersion ? t('design.editor.deleteProcessed', 'Delete processed version') : t('design.editor.deleteOriginal', 'Delete original')}
                  </ListItemText>
                </MenuItem>
              )}
              <MenuItem onClick={() => { setDeleteMenuAnchor(null); onRemoveImage(); }}>
                <ListItemIcon><RemoveCircleOutlineIcon sx={{ fontSize: 20 }} /></ListItemIcon>
                <ListItemText>{t('design.editor.removeFromBatch')}</ListItemText>
              </MenuItem>
              {onDeleteFromServer && (
                <MenuItem onClick={() => { setDeleteMenuAnchor(null); onDeleteFromServer(); }}>
                  <ListItemIcon><DeleteForeverIcon sx={{ fontSize: 20, color: 'error.main' }} /></ListItemIcon>
                  <ListItemText sx={{ '& .MuiTypography-root': { color: 'error.main' } }}>{t('design.editor.deletePermanently')}</ListItemText>
                </MenuItem>
              )}
            </Menu>
          </>
        ) : (
          <Tooltip title={t('design.editor.deleteImage')}>
            <IconButton size="small" onClick={onRemoveImage} aria-label={t('design.editor.deleteImage')}><DeleteOutlineIcon sx={{ fontSize: 18 }} /></IconButton>
          </Tooltip>
        )}
        <Tooltip title={t('design.editor.deleteAll')}>
          <IconButton size="small" onClick={onRemoveAll} aria-label={t('design.editor.deleteAll')}><DeleteSweepIcon sx={{ fontSize: 18 }} /></IconButton>
        </Tooltip>
      </BatchNavOverlay>

      {/* Toolbar (top-right) */}
      <CanvasToolbarOverlay aria-label={t('design.editor.canvasToolbar')}>
        {canvasTools.map(({ tool, icon, label }) => (
          <Tooltip key={tool} title={label} placement="left">
            <ToolButton $active={activeTool === tool} onClick={() => onToolChange(tool)} aria-label={label} aria-pressed={activeTool === tool}>{icon}</ToolButton>
          </Tooltip>
        ))}
        <Box sx={{ width: '100%', height: '1px', bgcolor: 'divider', my: 0.25 }} />
        <Tooltip title={`${t('design.toolbar.undo')} (${navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}Z)`} placement="left">
          <span><ToolButton disabled={!canUndo} onClick={onUndo} aria-label={t('design.toolbar.undo')}><UndoRoundedIcon sx={{ fontSize: 18 }} /></ToolButton></span>
        </Tooltip>
        <Tooltip title={`${t('design.toolbar.redo')} (${navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl+'}Shift+Z)`} placement="left">
          <span><ToolButton disabled={!canRedo} onClick={onRedo} aria-label={t('design.toolbar.redo')}><RedoRoundedIcon sx={{ fontSize: 18 }} /></ToolButton></span>
        </Tooltip>
        {hasProcessedVersion && (
          <>
            <Box sx={{ width: '100%', height: '1px', bgcolor: 'divider', my: 0.25 }} />
            <Tooltip title={showOriginal ? t('design.editor.showProcessed') : t('design.editor.showOriginal')} placement="left">
              <ToolButton $active={showOriginal} onClick={() => setShowOriginal((p) => !p)} aria-label={t('design.editor.showOriginal')} aria-pressed={showOriginal}><HistoryIcon sx={{ fontSize: 18 }} /></ToolButton>
            </Tooltip>
          </>
        )}
      </CanvasToolbarOverlay>

      {/* Zoom (bottom-right) */}
      <ZoomOverlay>
        <Tooltip title={t('design.editor.centerImage')}>
          <IconButton size="small" onClick={handleCenterImage} aria-label={t('design.editor.centerImage')}><CenterFocusStrongIcon sx={{ fontSize: 18 }} /></IconButton>
        </Tooltip>
        <Tooltip title={t('design.board.zoomOut')}>
          <IconButton size="small" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))} aria-label={t('design.board.zoomOut')}><ZoomOutIcon sx={{ fontSize: 18 }} /></IconButton>
        </Tooltip>
        <Typography variant="caption" color="text.primary" sx={{ minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</Typography>
        <Tooltip title={t('design.board.zoomIn')}>
          <IconButton size="small" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))} aria-label={t('design.board.zoomIn')}><ZoomInIcon sx={{ fontSize: 18 }} /></IconButton>
        </Tooltip>
      </ZoomOverlay>

      {/* BG Preview (bottom-center) */}
      <BgPreviewOverlay>
        <Tooltip title={t('design.editor.bgPreview.transparent')}>
          <BgSwatchButton $active={bgPreview === 'transparent'} onClick={() => setBgPreview('transparent')} aria-label={t('design.editor.bgPreview.transparent')}>
            <WallpaperIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          </BgSwatchButton>
        </Tooltip>
        <Tooltip title={t('design.editor.bgPreview.black')}>
          <BgSwatchButton $active={bgPreview === 'black'} onClick={() => setBgPreview('black')} aria-label={t('design.editor.bgPreview.black')} sx={{ bgcolor: '#000' }} />
        </Tooltip>
        <Tooltip title={t('design.editor.bgPreview.white')}>
          <BgSwatchButton $active={bgPreview === 'white'} onClick={() => setBgPreview('white')} aria-label={t('design.editor.bgPreview.white')} sx={{ bgcolor: '#FFF' }} />
        </Tooltip>
        <Tooltip title={t('design.editor.bgPreview.gray')}>
          <BgSwatchButton $active={bgPreview === 'gray'} onClick={() => setBgPreview('gray')} aria-label={t('design.editor.bgPreview.gray')} sx={{ bgcolor: '#808080' }} />
        </Tooltip>
        <Tooltip title={t('design.editor.bgPreview.custom')}>
          <BgSwatchButton $active={bgPreview === 'custom'} onClick={() => setBgPreview('custom')} aria-label={t('design.editor.bgPreview.custom')} sx={{ bgcolor: customBgColor, position: 'relative', overflow: 'hidden' }}>
            <Box component="input" type="color" value={customBgColor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setCustomBgColor(e.target.value); setBgPreview('custom'); }} sx={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
          </BgSwatchButton>
        </Tooltip>
      </BgPreviewOverlay>

      {/* Dimension change indicator */}
      {currentDims && originalDims && (currentDims.width !== originalDims.width || currentDims.height !== originalDims.height) && (
        <DimensionOverlay>
          <Typography variant="caption" color="text.secondary">{originalDims.width}x{originalDims.height}</Typography>
          <Typography variant="caption" color="text.secondary">-&gt;</Typography>
          <Typography variant="caption" color="primary.main" fontWeight={600}>{currentDims.width}x{currentDims.height}</Typography>
        </DimensionOverlay>
      )}
    </CanvasRoot>
  );
};
