import { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Rect, Text, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { ArtboardData } from '../types';
import SkeletonPulse from './SkeletonPulse';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const LABEL_HEIGHT = 24;
const LABEL_FONT_SIZE = 12;
const LABEL_PADDING_TOP = 4;
const SELECTION_STROKE = '#4A9EFF';
const SELECTION_DASH = [6, 4];
const HANDLE_SIZE = 8;
const FRAME_SHADOW_COLOR = 'rgba(0,0,0,0.30)';
const FRAME_SHADOW_BLUR = 12;
const FRAME_SHADOW_OFFSET = { x: 0, y: 4 };
const AI_LABEL_COLOR = '#00C8D7';

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
}: ArtboardProps) => {
  const groupRef = useRef<Konva.Group>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  // Load image when URL changes
  useEffect(() => {
    if (!data.imageUrl) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    // Only set crossOrigin for remote URLs — blob: and data: URLs fail with it
    if (data.imageUrl.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = data.imageUrl;

    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [data.imageUrl]);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      onSelect(data.id, e.evt.shiftKey);
    },
    [data.id, onSelect],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
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

      let newW = origW;
      let newH = origH;
      let newAbX = origAbX;
      let newAbY = origAbY;

      // bottom-right (3): grow width/height
      if (cornerIdx === 3) {
        newW = Math.max(MIN_ARTBOARD_SIZE, origW + dx);
        newH = Math.max(MIN_ARTBOARD_SIZE, origH + dy);
      }
      // bottom-left (2): grow height, shrink width from left
      else if (cornerIdx === 2) {
        newW = Math.max(MIN_ARTBOARD_SIZE, origW - dx);
        newH = Math.max(MIN_ARTBOARD_SIZE, origH + dy);
        newAbX = origAbX + (origW - newW);
      }
      // top-right (1): grow width, shrink height from top
      else if (cornerIdx === 1) {
        newW = Math.max(MIN_ARTBOARD_SIZE, origW + dx);
        newH = Math.max(MIN_ARTBOARD_SIZE, origH - dy);
        newAbY = origAbY + (origH - newH);
      }
      // top-left (0): shrink both from top-left
      else if (cornerIdx === 0) {
        newW = Math.max(MIN_ARTBOARD_SIZE, origW - dx);
        newH = Math.max(MIN_ARTBOARD_SIZE, origH - dy);
        newAbX = origAbX + (origW - newW);
        newAbY = origAbY + (origH - newH);
      }

      onResize(data.id, newW, newH, newAbX, newAbY);
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

  const labelColor = data.kind === 'ai' ? AI_LABEL_COLOR : (isDark ? '#7BAAB8' : '#3D6A7A');
  const labelPrefix = data.kind === 'ai' ? '\u2726 ' : '';
  const handles = getHandlePositions(data.width, data.height);

  return (
    <Group
      ref={groupRef}
      x={data.x}
      y={data.y}
      draggable
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={handleDragEnd}
      onContextMenu={handleContextMenu}
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

      {/* White background frame with shadow */}
      <Rect
        x={0}
        y={0}
        width={data.width}
        height={data.height}
        fill="#FFFFFF"
        cornerRadius={4}
        shadowColor={FRAME_SHADOW_COLOR}
        shadowBlur={FRAME_SHADOW_BLUR}
        shadowOffset={FRAME_SHADOW_OFFSET}
        shadowEnabled
      />

      {/* Skeleton pulse while generating */}
      {data.isGenerating && !image && (
        <SkeletonPulse width={data.width} height={data.height} />
      )}

      {/* Image inside frame */}
      {image && (
        <KonvaImage
          x={0}
          y={0}
          width={data.width}
          height={data.height}
          image={image}
          cornerRadius={4}
        />
      )}

      {/* Placeholder when no image and not generating */}
      {!image && !data.isGenerating && (
        <Text
          x={0}
          y={data.height / 2 - 8}
          width={data.width}
          align="center"
          text="No image"
          fontSize={13}
          fontFamily="Inter, sans-serif"
          fill="#999999"
        />
      )}

      {/* Selection border (dashed blue) */}
      {isSelected && (
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
              fill="#FFFFFF"
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
    </Group>
  );
};

export default Artboard;
