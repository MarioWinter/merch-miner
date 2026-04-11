import { useCallback, useMemo, useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import { alpha } from '@mui/material/styles';
import type Konva from 'konva';
import type { ArtboardData, CanvasElement } from '../types';
import { COLORS } from '@/style/constants';
import useSnapGuides from '../hooks/useSnapGuides';
import SkeletonPulse from './SkeletonPulse';
import SnapGuides from './SnapGuides';
import ArtboardElement from './ArtboardElement';
import ImageLayer from './layers/ImageLayer';
import TextLayer from './layers/TextLayer';
import ShapeLayer from './layers/ShapeLayer';
import BrushLayer from './layers/BrushLayer';
import EmojiLayer from './layers/EmojiLayer';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const LABEL_HEIGHT = 24;
const LABEL_FONT_SIZE = 12;
const LABEL_PADDING_TOP = 4;
const SELECTION_STROKE = COLORS.selection;
const SELECTION_DASH = [6, 4];
const HANDLE_SIZE = 8;
const FRAME_SHADOW_COLOR = alpha(COLORS.black, 0.3);
const FRAME_SHADOW_BLUR = 12;
const FRAME_SHADOW_OFFSET = { x: 0, y: 4 };
const AI_LABEL_COLOR = COLORS.cyan;

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ArtboardProps {
  data: ArtboardData;
  isSelected: boolean;
  isDark: boolean;
  zoom: number;
  onSelect: (id: string, additive: boolean) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDoubleClickLabel: (id: string) => void;
  onContextMenu?: (id: string, evt: MouseEvent) => void;
  onResize?: (id: string, width: number, height: number, x: number, y: number) => void;
  /** Element selection callbacks */
  selectedElementId?: string | null;
  isFreeTransform?: boolean;
  onElementSelect?: (artboardId: string, elementId: string) => void;
  onElementDoubleClick?: (artboardId: string, elementId: string) => void;
  onElementUpdate?: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
  /** Active canvas tool */
  activeTool?: string;
  /** Called when artboard clicked while text tool active */
  onTextInsert?: (artboardId: string, localX: number, localY: number) => void;
  /** Called when shape draw starts on artboard */
  onShapeDrawStart?: (artboardId: string, localX: number, localY: number) => void;
  /** Called when pen tool clicks on artboard */
  onPenClick?: (artboardId: string, localX: number, localY: number) => void;
  /** Called when brush draw starts on artboard */
  onBrushDrawStart?: (artboardId: string, localX: number, localY: number) => void;
  /** Element currently being inline-edited (text editing) — hide from Konva render */
  editingElementId?: string | null;
}

// Corner indices: 0=top-left, 1=top-right, 2=bottom-left, 3=bottom-right
const MIN_ARTBOARD_SIZE = 40;

// -----------------------------------------------------------------
// Resize handle positions (corners)
// -----------------------------------------------------------------

const getHandlePositions = (w: number, h: number) => [
  { x: -HANDLE_SIZE / 2, y: -HANDLE_SIZE / 2 },                  // top-left
  { x: w - HANDLE_SIZE / 2, y: -HANDLE_SIZE / 2 },               // top-right
  { x: -HANDLE_SIZE / 2, y: h - HANDLE_SIZE / 2 },               // bottom-left
  { x: w - HANDLE_SIZE / 2, y: h - HANDLE_SIZE / 2 },            // bottom-right
];

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const Artboard = ({
  data,
  isSelected,
  isDark,
  zoom,
  onSelect,
  onDragEnd,
  onDoubleClickLabel,
  onContextMenu,
  onResize,
  selectedElementId,
  isFreeTransform = false,
  onElementSelect,
  onElementDoubleClick,
  onElementUpdate,
  activeTool,
  onTextInsert,
  onShapeDrawStart,
  onPenClick,
  onBrushDrawStart,
  editingElementId,
}: ArtboardProps) => {
  const groupRef = useRef<Konva.Group>(null);

  // -- Snap guides --
  const snapGuides = useSnapGuides({
    artboard: data,
    elements: data.layers ?? [],
    draggingElementId: null,
  });

  const handleElementDragMove = useCallback(
    (artboardId: string, elementId: string, node: Konva.Node) => {
      const el = (data.layers ?? []).find((l) => l.id === elementId);
      if (!el) return;

      const rawX = node.x();
      const rawY = node.y();
      const w = el.width * el.scaleX;
      const h = el.height * el.scaleY;

      const { x, y } = snapGuides.computeSnap(elementId, rawX, rawY, w, h);
      node.x(x);
      node.y(y);
    },
    [data.layers, snapGuides],
  );

  const handleElementDragEnd = useCallback(
    (artboardId: string, elementId: string, patch: Partial<Omit<CanvasElement, 'id' | 'type'>>) => {
      snapGuides.clearGuides();
      onElementUpdate?.(artboardId, elementId, patch);
    },
    [snapGuides, onElementUpdate],
  );

  const isShapeTool =
    activeTool === 'rectangle' ||
    activeTool === 'ellipse' ||
    activeTool === 'triangle' ||
    activeTool === 'line';

  const isBrushTool = activeTool === 'brush';

  const getLocalPos = useCallback(() => {
    const group = groupRef.current;
    if (!group) return null;
    const pointerPos = group.getStage()?.getPointerPosition();
    if (!pointerPos) return null;
    const transform = group.getAbsoluteTransform().copy().invert();
    return transform.point(pointerPos);
  }, []);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;

      // When text tool is active, insert text at click position
      if (activeTool === 'text' && onTextInsert) {
        const localPos = getLocalPos();
        if (localPos) {
          onTextInsert(data.id, localPos.x, localPos.y);
          return;
        }
      }

      // When pen tool is active, add point
      if (activeTool === 'pen' && onPenClick) {
        const localPos = getLocalPos();
        if (localPos) {
          onPenClick(data.id, localPos.x, localPos.y);
          return;
        }
      }

      onSelect(data.id, e.evt.shiftKey);
    },
    [data.id, onSelect, activeTool, onTextInsert, onPenClick, getLocalPos],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      // Only handle drag for the artboard group itself, not child elements
      if (e.target !== groupRef.current) return;
      e.cancelBubble = true;
      const node = e.target;
      onDragEnd(data.id, node.x(), node.y());
    },
    [data.id, onDragEnd],
  );

  const handleContextMenu = useCallback(
    (e: Konva.KonvaEventObject<PointerEvent>) => {
      e.cancelBubble = true;
      e.evt.preventDefault();
      onContextMenu?.(data.id, e.evt as unknown as MouseEvent);
    },
    [data.id, onContextMenu],
  );

  const handleLabelDblClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onDoubleClickLabel(data.id);
    },
    [data.id, onDoubleClickLabel],
  );

  // -- Resize handle drag --
  const resizeOriginRef = useRef<{
    cornerIdx: number;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
    origAbX: number;
    origAbY: number;
  } | null>(null);

  const handleResizeDragStart = useCallback(
    (cornerIdx: number) => (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      // Store starting state for computing delta
      const node = e.target;
      resizeOriginRef.current = {
        cornerIdx,
        startX: node.x(),
        startY: node.y(),
        origW: data.width,
        origH: data.height,
        origAbX: data.x,
        origAbY: data.y,
      };
    },
    [data.width, data.height, data.x, data.y],
  );

  const handleResizeDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      if (!resizeOriginRef.current || !onResize) return;

      const node = e.target;
      const { cornerIdx, startX, startY, origW, origH, origAbX, origAbY } =
        resizeOriginRef.current;
      const dx = node.x() - startX;
      const dy = node.y() - startY;
      const aspect = origW / origH;
      // Default: constrained (keep aspect ratio). Hold Shift to free-resize.
      const freeResize = e.evt.shiftKey;

      let newW = origW;
      let newH = origH;
      let newAbX = origAbX;
      let newAbY = origAbY;

      // bottom-right (3): grow width/height
      if (cornerIdx === 3) {
        newW = Math.max(MIN_ARTBOARD_SIZE, origW + dx);
        if (freeResize) {
          newH = Math.max(MIN_ARTBOARD_SIZE, origH + dy);
        } else {
          newH = Math.max(MIN_ARTBOARD_SIZE, Math.round(newW / aspect));
        }
      }
      // bottom-left (2): grow height, shrink width from left
      else if (cornerIdx === 2) {
        newW = Math.max(MIN_ARTBOARD_SIZE, origW - dx);
        if (freeResize) {
          newH = Math.max(MIN_ARTBOARD_SIZE, origH + dy);
        } else {
          newH = Math.max(MIN_ARTBOARD_SIZE, Math.round(newW / aspect));
        }
        newAbX = origAbX + (origW - newW);
      }
      // top-right (1): grow width, shrink height from top
      else if (cornerIdx === 1) {
        newW = Math.max(MIN_ARTBOARD_SIZE, origW + dx);
        if (freeResize) {
          newH = Math.max(MIN_ARTBOARD_SIZE, origH - dy);
        } else {
          newH = Math.max(MIN_ARTBOARD_SIZE, Math.round(newW / aspect));
        }
        newAbY = origAbY + (origH - newH);
      }
      // top-left (0): shrink both from top-left
      else if (cornerIdx === 0) {
        newW = Math.max(MIN_ARTBOARD_SIZE, origW - dx);
        if (freeResize) {
          newH = Math.max(MIN_ARTBOARD_SIZE, origH - dy);
        } else {
          newH = Math.max(MIN_ARTBOARD_SIZE, Math.round(newW / aspect));
        }
        newAbX = origAbX + (origW - newW);
        newAbY = origAbY + (origH - newH);
      }

      onResize(data.id, Math.round(newW), Math.round(newH), Math.round(newAbX), Math.round(newAbY));
    },
    [data.id, onResize],
  );

  const handleResizeDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      resizeOriginRef.current = null;
    },
    [],
  );

  // Sort layers by zIndex for render order
  const sortedLayers = useMemo(
    () => [...(data.layers ?? [])].sort((a, b) => a.zIndex - b.zIndex),
    [data.layers],
  );

  const hasElements = sortedLayers.length > 0;
  const hasElementSelection = !!selectedElementId;

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Shape tools
      if (isShapeTool && onShapeDrawStart) {
        e.cancelBubble = true;
        const localPos = getLocalPos();
        if (localPos) {
          onShapeDrawStart(data.id, localPos.x, localPos.y);
        }
        return;
      }
      // Brush tool
      if (isBrushTool && onBrushDrawStart) {
        e.cancelBubble = true;
        const localPos = getLocalPos();
        if (localPos) {
          onBrushDrawStart(data.id, localPos.x, localPos.y);
        }
      }
    },
    [isShapeTool, isBrushTool, onShapeDrawStart, onBrushDrawStart, data.id, getLocalPos],
  );

  const labelColor = data.kind === 'ai' ? AI_LABEL_COLOR : (isDark ? COLORS.snowMuted : COLORS.mist);
  const labelPrefix = data.kind === 'ai' ? '\u2726 ' : '';
  const handles = getHandlePositions(data.width, data.height);

  return (
    <Group
      ref={groupRef}
      x={data.x}
      y={data.y}
      draggable={!isShapeTool && !isBrushTool && activeTool !== 'pen' && !hasElementSelection}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={handleDragEnd}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
    >
      {/* Label above frame */}
      <Text
        x={0}
        y={-(LABEL_HEIGHT + LABEL_PADDING_TOP)}
        width={data.width}
        text={`${labelPrefix}${data.label}`}
        fontSize={LABEL_FONT_SIZE / Math.max(zoom, 0.4)}
        fontFamily="Inter, sans-serif"
        fontStyle="600"
        fill={labelColor}
        listening
        onDblClick={handleLabelDblClick}
        onDblTap={handleLabelDblClick}
      />

      {/* Background frame with shadow */}
      <Rect
        x={0}
        y={0}
        width={data.width}
        height={data.height}
        fill={data.backgroundColor}
        cornerRadius={4}
        shadowColor={FRAME_SHADOW_COLOR}
        shadowBlur={FRAME_SHADOW_BLUR}
        shadowOffset={FRAME_SHADOW_OFFSET}
        shadowEnabled
      />

      {/* Skeleton pulse while generating */}
      {data.isGenerating && !hasElements && (
        <SkeletonPulse width={data.width} height={data.height} />
      )}

      {/* Placeholder when no layers and not generating */}
      {!data.isGenerating && !hasElements && (
        <Text
          x={0}
          y={data.height / 2 - 8}
          width={data.width}
          align="center"
          text="No image"
          fontSize={13}
          fontFamily="Inter, sans-serif"
          fill={COLORS.snowDisabled}
        />
      )}

      {/* Canvas element layers */}
      {hasElements && onElementSelect && onElementDoubleClick && onElementUpdate && (
        <Group
          opacity={data.opacity / 100}
          clipFunc={data.clipContent ? (ctx) => {
            ctx.rect(0, 0, data.width, data.height);
          } : undefined}
        >
          {sortedLayers.map((el) => {
            const elSelected = selectedElementId === el.id;
            const elFreeTransform = elSelected && isFreeTransform;
            const commonProps = {
              artboardId: data.id,
              isSelected: elSelected,
              isFreeTransform: elFreeTransform,
              zoom,
              onSelect: onElementSelect,
              onDoubleClick: onElementDoubleClick,
              onUpdate: handleElementDragEnd,
              onDragMove: handleElementDragMove,
            };

            if (el.type === 'image') {
              return (
                <ImageLayer
                  key={el.id}
                  {...commonProps}
                  element={el as CanvasElement<'image'>}
                />
              );
            }
            if (el.type === 'text') {
              return (
                <TextLayer
                  key={el.id}
                  {...commonProps}
                  element={el as CanvasElement<'text'>}
                  isBeingEdited={editingElementId === el.id}
                />
              );
            }
            if (el.type === 'shape') {
              return (
                <ShapeLayer
                  key={el.id}
                  {...commonProps}
                  element={el as CanvasElement<'shape'>}
                />
              );
            }
            if (el.type === 'brush') {
              return (
                <BrushLayer
                  key={el.id}
                  {...commonProps}
                  element={el as CanvasElement<'brush'>}
                />
              );
            }
            if (el.type === 'emoji') {
              return (
                <EmojiLayer
                  key={el.id}
                  {...commonProps}
                  element={el as CanvasElement<'emoji'>}
                />
              );
            }
            return (
              <ArtboardElement
                key={el.id}
                {...commonProps}
                element={el}
              />
            );
          })}
        </Group>
      )}

      {/* Snap guide lines */}
      <SnapGuides
        guides={snapGuides.activeGuides}
        artboardWidth={data.width}
        artboardHeight={data.height}
        zoom={zoom}
      />

      {/* Selection border (dashed blue) — only show artboard handles when no element is selected */}
      {isSelected && !hasElementSelection && (
        <>
          <Rect
            x={-1}
            y={-1}
            width={data.width + 2}
            height={data.height + 2}
            stroke={SELECTION_STROKE}
            strokeWidth={2 / zoom}
            dash={SELECTION_DASH}
            listening={false}
          />
          {/* Resize handles at corners (draggable) */}
          {handles.map((pos, i) => (
            <Rect
              key={i}
              x={pos.x}
              y={pos.y}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              fill={COLORS.white}
              stroke={SELECTION_STROKE}
              strokeWidth={1.5 / zoom}
              cornerRadius={2}
              draggable
              onDragStart={handleResizeDragStart(i)}
              onDragMove={handleResizeDragMove}
              onDragEnd={handleResizeDragEnd}
              hitStrokeWidth={8 / zoom}
            />
          ))}
        </>
      )}
      {/* Subtle border when element selected (artboard implicitly active, no resize handles) */}
      {isSelected && hasElementSelection && (
        <Rect
          x={-1}
          y={-1}
          width={data.width + 2}
          height={data.height + 2}
          stroke={SELECTION_STROKE}
          strokeWidth={1 / zoom}
          dash={[4, 6]}
          opacity={0.5}
          listening={false}
        />
      )}
    </Group>
  );
};

export default Artboard;
