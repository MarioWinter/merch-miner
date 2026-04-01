import { useCallback, useRef } from 'react';
import { Stage, Layer, Circle } from 'react-konva';
import { Typography } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { CanvasState } from '../hooks/useArtboardCanvas';
import type { BoardEdge } from '../hooks/useArtboards';
import useCanvasHandlers from '../hooks/useCanvasHandlers';
import useContextMenu from '../hooks/useContextMenu';
import useExternalDrop from '../hooks/useExternalDrop';
import useGridDots from '../hooks/useGridDots';
import useRubberBand from '../hooks/useRubberBand';
import Artboard from './Artboard';
import ArtboardContextMenu from './ArtboardContextMenu';
import CanvasContextMenu from './CanvasContextMenu';
import ConnectionArrow from './ConnectionArrow';
import RubberBandSelection from './RubberBandSelection';
import ArtboardLabelEditor from './ArtboardLabelEditor';
import {
  CanvasContainer,
  DropZoneOverlay,
  HiddenInput,
} from './ArtboardCanvas.styles';
import type Konva from 'konva';
import type { ArtboardData } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const GRID_DOT_RADIUS = 1.2;
const GRID_DOT_COLOR_DARK = 'rgba(255,255,255,0.08)';
const GRID_DOT_COLOR_LIGHT = 'rgba(0,0,0,0.10)';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

export interface ArtboardCanvasProps {
  projectId: string;
  artboards: ArtboardData[];
  edges: BoardEdge[];
  selectedIds: Set<string>;
  selectArtboard: (id: string, additive: boolean) => void;
  deselectAll: () => void;
  selectByRect: (rect: { x: number; y: number; width: number; height: number }) => void;
  moveArtboard: (id: string, x: number, y: number) => void;
  renameArtboard: (id: string, label: string) => void;
  addArtboard: (partial?: Partial<ArtboardData>) => ArtboardData;
  addAiImageBoard: (sourceId: string) => ArtboardData | null;
  removeArtboards: (ids: string[]) => void;
  duplicateArtboard: (id: string) => ArtboardData | null;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  updateArtboard: (id: string, patch: Partial<ArtboardData>) => void;
  canvasState: CanvasState;
  containerRef: React.RefObject<HTMLDivElement | null>;
  setContainerRef: (node: HTMLDivElement | null) => void;
  handleWheel: (e: { evt: WheelEvent }) => void;
  setPan: (x: number, y: number) => void;
  resizeArtboard: (id: string, width: number, height: number) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ArtboardCanvas = ({
  projectId,
  artboards,
  edges,
  selectedIds,
  selectArtboard,
  deselectAll,
  selectByRect,
  moveArtboard,
  renameArtboard,
  addArtboard,
  addAiImageBoard,
  removeArtboards,
  duplicateArtboard,
  bringToFront,
  sendToBack,
  updateArtboard,
  canvasState,
  containerRef,
  setContainerRef,
  handleWheel,
  setPan,
  resizeArtboard,
}: ArtboardCanvasProps) => {
  const { t } = useTranslation();
  const { mode } = useColorScheme();
  const isDark = mode !== 'light';
  const stageRef = useRef<Konva.Stage>(null);

  const { zoom, panX, panY, stageWidth, stageHeight, showGrid } = canvasState;
  const gridDots = useGridDots({ zoom, panX, panY, stageWidth, stageHeight });
  const bgColor = isDark ? COLORS.artboardDark : COLORS.artboardLight;
  const dotColor = isDark ? GRID_DOT_COLOR_DARK : GRID_DOT_COLOR_LIGHT;
  const hasContent = artboards.length > 0;

  const screenToWorld = (screenX: number, screenY: number) => ({
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  });

  // -- Rubber-band selection --
  const {
    rubberBand,
    isRubberBanding,
    rubberBandOriginRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useRubberBand({ screenToWorld, selectByRect, deselectAll, stageRef });

  // -- Canvas handlers (labels, drag, regenerate) --
  const {
    editingLabel,
    artboardMap,
    handleDragEnd,
    handleDragStart,
    handleArtboardSelect,
    handleArtboardDragEnd,
    handleDoubleClickLabel,
    handleLabelConfirm,
    handleLabelCancel,
  } = useCanvasHandlers({
    artboards,
    selectedIds,
    zoom,
    panX,
    panY,
    selectArtboard,
    moveArtboard,
    renameArtboard,
    setPan,
    rubberBandOriginRef,
  });

  // -- Context menus --
  const {
    artboardMenu,
    canvasMenu,
    handleArtboardContextMenu,
    handleCanvasContextMenu,
    handleAddArtboardFromFile,
    closeArtboardMenu,
    closeCanvasMenu,
  } = useContextMenu({ containerRef, screenToWorld, addArtboard });

  // -- Artboard resize (combines size + position update) --
  const handleArtboardResize = useCallback(
    (id: string, width: number, height: number, x: number, y: number) => {
      resizeArtboard(id, width, height);
      moveArtboard(id, x, y);
    },
    [resizeArtboard, moveArtboard],
  );

  // -- External file drop --
  const {
    isDraggingOver,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    openFilePicker,
    fileInputRef,
    handleFileInputChange,
  } = useExternalDrop({ projectId, containerRef, screenToWorld, addArtboard, updateArtboard });

  return (
    <CanvasContainer
      ref={setContainerRef}
      sx={{ backgroundColor: bgColor }}
      onContextMenu={handleCanvasContextMenu}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <HiddenInput
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        multiple
        onChange={handleFileInputChange}
        aria-hidden="true"
      />

      {isDraggingOver && (
        <DropZoneOverlay aria-label={t('design.canvas.dropHint', 'Drop images to create artboards')}>
          <Typography variant="h5" sx={{ fontWeight: 600, color: 'secondary.main' }}>
            {t('design.canvas.dropHint', 'Drop images to create artboards')}
          </Typography>
        </DropZoneOverlay>
      )}

      {stageWidth > 0 && stageHeight > 0 && (
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={stageHeight}
          x={panX}
          y={panY}
          scaleX={zoom}
          scaleY={zoom}
          draggable={!isRubberBanding}
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {showGrid && (
            <Layer listening={false}>
              {gridDots.map((dot) => (
                <Circle
                  key={dot.key}
                  x={dot.x}
                  y={dot.y}
                  radius={GRID_DOT_RADIUS / zoom}
                  fill={dotColor}
                  perfectDrawEnabled={false}
                  listening={false}
                />
              ))}
            </Layer>
          )}

          <Layer listening={false}>
            {edges.map((edge) => {
              const source = artboardMap.get(edge.source);
              const target = artboardMap.get(edge.target);
              if (!source || !target) return null;
              return (
                <ConnectionArrow
                  key={`${edge.source}-${edge.target}`}
                  source={source}
                  target={target}
                  isDark={isDark}
                  zoom={zoom}
                />
              );
            })}
          </Layer>

          <Layer>
            {artboards.map((ab) => (
              <Artboard
                key={ab.id}
                data={ab}
                isSelected={selectedIds.has(ab.id)}
                isDark={isDark}
                zoom={zoom}
                onSelect={handleArtboardSelect}
                onDragEnd={handleArtboardDragEnd}
                onDoubleClickLabel={handleDoubleClickLabel}
                onContextMenu={handleArtboardContextMenu}
                onResize={handleArtboardResize}
              />
            ))}
            <RubberBandSelection rect={rubberBand} zoom={zoom} />
          </Layer>
        </Stage>
      )}

      {editingLabel && (
        <ArtboardLabelEditor
          value={editingLabel.value}
          screenX={editingLabel.screenX}
          screenY={editingLabel.screenY}
          onConfirm={handleLabelConfirm}
          onCancel={handleLabelCancel}
        />
      )}

      <ArtboardContextMenu
        position={artboardMenu.position}
        artboardId={artboardMenu.artboardId}
        onClose={closeArtboardMenu}
        onAddAiImageBoard={addAiImageBoard}
        onDuplicate={duplicateArtboard}
        onDelete={removeArtboards}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
      />
      <CanvasContextMenu
        position={canvasMenu.position}
        worldPosition={canvasMenu.worldPosition}
        onClose={closeCanvasMenu}
        onAddArtboard={handleAddArtboardFromFile}
      />
    </CanvasContainer>
  );
};

export default ArtboardCanvas;
