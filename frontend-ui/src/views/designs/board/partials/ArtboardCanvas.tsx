import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useAppSelector } from '@/store/hooks';
import Artboard from './Artboard';
import ArtboardContextMenu from './ArtboardContextMenu';
import ArtboardShimmerOverlay from './ArtboardShimmerOverlay';
import ArtboardVersionPicker from './ArtboardVersionPicker';
import CanvasContextMenu from './CanvasContextMenu';
import CanvasMinimap from './CanvasMinimap';
import ConnectionArrow from './ConnectionArrow';
import RubberBandSelection from './RubberBandSelection';
import ArtboardLabelEditor from './ArtboardLabelEditor';
import {
  CanvasContainer,
  DropZoneOverlay,
  HiddenInput,
} from './ArtboardCanvas.styles';
import type Konva from 'konva';
import type { ArtboardData, CanvasElement, Design } from '../types';
import type { VersionSlot } from '../hooks/useArtboardVersionSync';

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
  setStageRef?: (node: { x: () => number; y: () => number } | null) => void;
  handleWheel: (e: { evt: WheelEvent }) => void;
  setPan: (x: number, y: number) => void;
  panTo: (worldX: number, worldY: number) => void;
  resizeArtboard: (id: string, width: number, height: number) => void;
  /** Element selection state */
  selectedElementId?: string | null;
  isFreeTransform?: boolean;
  onElementSelect?: (artboardId: string, elementId: string) => void;
  onElementDoubleClick?: (artboardId: string, elementId: string) => void;
  onElementUpdate?: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
  /** Active canvas tool (cursor, text, etc.) */
  activeTool?: string;
  /** Called when an artboard is clicked while text tool is active */
  onTextInsert?: (artboardId: string, localX: number, localY: number) => void;
  /** Called when shape draw starts on an artboard */
  onShapeDrawStart?: (artboardId: string, localX: number, localY: number) => void;
  /** Called when shape draw moves */
  onShapeDrawMove?: (localX: number, localY: number) => void;
  /** Called when shape draw ends */
  onShapeDrawEnd?: () => void;
  /** Called when pen tool clicks on an artboard */
  onPenClick?: (artboardId: string, localX: number, localY: number) => void;
  /** Called when pen tool moves */
  onPenMove?: (localX: number, localY: number) => void;
  /** Called when brush draw starts on an artboard */
  onBrushDrawStart?: (artboardId: string, localX: number, localY: number) => void;
  /** Called when brush draw moves */
  onBrushDrawMove?: (localX: number, localY: number) => void;
  /** Called when brush draw ends */
  onBrushDrawEnd?: () => void;
  /** Phase G13: analyze image from context menu */
  onAnalyzeImage?: (artboardId: string) => void;
  /** Phase N: open in editor (context menu) */
  onOpenInEditor?: (artboardIds: string[]) => void;
  /** Element currently being inline-edited (text editing) — hide from Konva render */
  editingElementId?: string | null;
  /** PROJ-9 Phase O — returns true when at least one DesignAsset already exists for the artboard's design. */
  hasDesignAsset?: (artboardId: string) => boolean;
  /** PROJ-9 Phase O — localized label rendered inside the In-Listings chip. */
  inListingsLabel?: string;
  /** FIX Phase 6 — Design records keyed by id (powers the version picker). */
  designsById?: Map<string, Design>;
  /** FIX Phase 6 — explicit user version picks per designId. */
  userPickedVersions?: Map<string, VersionSlot>;
  /** FIX Phase 6 — pass null to clear an explicit pick (revert to auto). */
  onPickVersion?: (designId: string, slot: VersionSlot | null) => void;
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
  setStageRef,
  handleWheel,
  setPan,
  panTo,
  resizeArtboard,
  selectedElementId,
  isFreeTransform,
  onElementSelect,
  onElementDoubleClick,
  onElementUpdate,
  activeTool,
  onTextInsert,
  onShapeDrawStart,
  onShapeDrawMove,
  onShapeDrawEnd,
  onPenClick,
  onPenMove,
  onBrushDrawStart,
  onBrushDrawMove,
  onBrushDrawEnd,
  onAnalyzeImage,
  onOpenInEditor,
  editingElementId,
  hasDesignAsset,
  inListingsLabel,
  designsById,
  userPickedVersions,
  onPickVersion,
}: ArtboardCanvasProps) => {
  const { t } = useTranslation();
  const { mode } = useColorScheme();
  const isDark = mode !== 'light';
  const stageRef = useRef<Konva.Stage>(null);
  // Phase 9 — read the workspace-level set of upscaling designs. Both
  // `useUpscaleSingle` instances (standalone Upscale tool + Apply-Pipeline
  // upscale step) push/pop entries from this list.
  const processingDesignIds = useAppSelector((s) => s.upscale.processingDesignIds);

  // Sync Konva Stage ref to canvas hook so zoom reads live position during drag
  const stageCallbackRef = useCallback(
    (node: Konva.Stage | null) => {
      (stageRef as React.MutableRefObject<Konva.Stage | null>).current = node;
      setStageRef?.(node);
    },
    [setStageRef],
  );

  const { zoom, panX, panY, stageWidth, stageHeight, showGrid } = canvasState;
  const gridDots = useGridDots({ zoom, panX, panY, stageWidth, stageHeight });
  const bgColor = isDark ? COLORS.artboardDark : COLORS.artboardLight;
  const dotColor = isDark ? GRID_DOT_COLOR_DARK : GRID_DOT_COLOR_LIGHT;

  // -- Space key tracking for temporary pan mode --
  const [spaceHeld, setSpaceHeld] = useState(false);
  useEffect(() => {
    // Returns true when the keystroke originated in any editable surface
    // and pan-mode should NOT swallow it. The original guard only checked
    // <input> and <textarea>, which let the keydown reach the contenteditable
    // chat input as well — pan-mode then preventDefault'd it, dropping every
    // space typed in chat while the canvas was mounted (debugged 2026-05-29).
    const isEditableTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      if (target instanceof HTMLInputElement) return true;
      if (target instanceof HTMLTextAreaElement) return true;
      // ContentEditable covers SmartTextarea + any other contenteditable
      // host. `isContentEditable` walks the inheritance chain so it's true
      // for both the editable host and any nested element.
      if (target instanceof HTMLElement && target.isContentEditable) return true;
      // Defensive — also bail if the event bubbled up from an editable
      // ancestor (e.g. nested span inside the contenteditable).
      if (target.closest('[contenteditable="true"], input, textarea')) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isEditableTarget(e.target)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const isPanMode = spaceHeld;

  // Use live Stage position (Konva may have moved it via drag before React state synced)
  const screenToWorld = (screenX: number, screenY: number) => {
    const livePanX = stageRef.current?.x() ?? panX;
    const livePanY = stageRef.current?.y() ?? panY;
    return {
      x: (screenX - livePanX) / zoom,
      y: (screenY - livePanY) / zoom,
    };
  };

  // -- Rubber-band selection --
  const {
    rubberBand,
    isRubberBanding,
    rubberBandOriginRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useRubberBand({ screenToWorld, selectByRect, deselectAll, stageRef, isPanMode });

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

  // -- Shape/pen drawing stage handlers --
  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      handleMouseMove(e);
      // Forward to shape drawing
      if (onShapeDrawMove) {
        const stage = stageRef.current;
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const worldX = (pointer.x - panX) / zoom;
            const worldY = (pointer.y - panY) / zoom;
            onShapeDrawMove(worldX, worldY);
          }
        }
      }
      // Forward to pen tool
      if (onPenMove) {
        const stage = stageRef.current;
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const worldX = (pointer.x - panX) / zoom;
            const worldY = (pointer.y - panY) / zoom;
            onPenMove(worldX, worldY);
          }
        }
      }
      // Forward to brush tool
      if (onBrushDrawMove) {
        const stage = stageRef.current;
        if (stage) {
          const pointer = stage.getPointerPosition();
          if (pointer) {
            const worldX = (pointer.x - panX) / zoom;
            const worldY = (pointer.y - panY) / zoom;
            onBrushDrawMove(worldX, worldY);
          }
        }
      }
    },
    [handleMouseMove, onShapeDrawMove, onPenMove, onBrushDrawMove, panX, panY, zoom],
  );

  const handleStageMouseUp = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      handleMouseUp(e);
      onShapeDrawEnd?.();
      onBrushDrawEnd?.();
    },
    [handleMouseUp, onShapeDrawEnd, onBrushDrawEnd],
  );

  // -- Artboard resize (combines size + position update) --
  const handleArtboardResize = useCallback(
    (id: string, width: number, height: number, x: number, y: number) => {
      resizeArtboard(id, width, height);
      moveArtboard(id, x, y);
    },
    [resizeArtboard, moveArtboard],
  );

  // -- Delete selected artboards (for context menu) --
  const handleDeleteSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length > 0) removeArtboards(ids);
  }, [selectedIds, removeArtboards]);

  // -- External file drop --
  const {
    isDraggingOver,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
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
          ref={stageCallbackRef}
          width={stageWidth}
          height={stageHeight}
          x={panX}
          y={panY}
          scaleX={zoom}
          scaleY={zoom}
          draggable={isPanMode || !isRubberBanding}
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
          onDragStart={handleDragStart}
          onMouseDown={handleMouseDown}
          onMouseMove={handleStageMouseMove}
          onMouseUp={handleStageMouseUp}
          style={{ position: 'absolute', top: 0, left: 0, cursor: isPanMode ? 'grab' : 'default' }}
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
                selectedElementId={selectedElementId}
                isFreeTransform={isFreeTransform}
                onElementSelect={onElementSelect}
                onElementDoubleClick={onElementDoubleClick}
                onElementUpdate={onElementUpdate}
                activeTool={activeTool}
                onTextInsert={onTextInsert}
                onShapeDrawStart={onShapeDrawStart}
                onPenClick={onPenClick}
                onBrushDrawStart={onBrushDrawStart}
                editingElementId={editingElementId}
                hasDesignAsset={hasDesignAsset?.(ab.id) ?? false}
                inListingsLabel={inListingsLabel}
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
        hasImage={Boolean(
          artboardMenu.artboardId &&
            artboards.find((ab) => ab.id === artboardMenu.artboardId)?.imageUrl,
        )}
        onClose={closeArtboardMenu}
        onAddAiImageBoard={addAiImageBoard}
        onDuplicate={duplicateArtboard}
        onDelete={removeArtboards}
        onBringToFront={bringToFront}
        onSendToBack={sendToBack}
        onAnalyzeImage={onAnalyzeImage}
        onOpenInEditor={onOpenInEditor}
      />
      <CanvasContextMenu
        position={canvasMenu.position}
        worldPosition={canvasMenu.worldPosition}
        selectedCount={selectedIds.size}
        onClose={closeCanvasMenu}
        onAddArtboard={handleAddArtboardFromFile}
        onDeleteSelected={handleDeleteSelected}
      />

      {processingDesignIds.length > 0 &&
        artboards.map((ab) => {
          if (!ab.designId || !processingDesignIds.includes(ab.designId)) return null;
          const screenX = ab.x * zoom + panX;
          const screenY = ab.y * zoom + panY;
          return (
            <ArtboardShimmerOverlay
              key={`shimmer-${ab.id}`}
              x={screenX}
              y={screenY}
              width={ab.width * zoom}
              height={ab.height * zoom}
            />
          );
        })}

      {(() => {
        if (selectedIds.size !== 1) return null;
        if (!designsById || !onPickVersion) return null;
        const selectedId = [...selectedIds][0];
        const ab = artboards.find((a) => a.id === selectedId);
        if (!ab?.designId) return null;
        const design = designsById.get(ab.designId);
        if (!design) return null;
        const screenX = ab.x * zoom + panX;
        const screenY = (ab.y + ab.height) * zoom + panY + 8;
        return (
          <ArtboardVersionPicker
            designId={ab.designId}
            design={design}
            projectId={projectId}
            currentPickedSlot={userPickedVersions?.get(ab.designId) ?? null}
            onPick={(slot) => onPickVersion(ab.designId!, slot)}
            positionAt={{ x: screenX, y: screenY }}
          />
        );
      })()}

      <CanvasMinimap
        artboards={artboards}
        selectedIds={selectedIds}
        zoom={zoom}
        panX={panX}
        panY={panY}
        stageWidth={stageWidth}
        stageHeight={stageHeight}
        onPanTo={panTo}
      />
    </CanvasContainer>
  );
};

export default ArtboardCanvas;
