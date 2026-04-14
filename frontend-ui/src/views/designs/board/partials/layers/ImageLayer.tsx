import { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Rect, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElement, ImageElementProps } from '../../types';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ImageLayerProps {
  element: CanvasElement<'image'>;
  artboardId: string;
  isSelected: boolean;
  isFreeTransform: boolean;
  onSelect: (artboardId: string, elementId: string) => void;
  onDoubleClick: (artboardId: string, elementId: string) => void;
  onUpdate: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
  onDragMove?: (artboardId: string, elementId: string, node: Konva.Node) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ImageLayer = ({
  element,
  artboardId,
  isSelected,
  isFreeTransform,
  onSelect,
  onDoubleClick,
  onUpdate,
  onDragMove,
}: ImageLayerProps) => {
  const nodeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const imgProps = element.props as ImageElementProps;
  const { src } = imgProps;

  // Load image when src changes; sync element dimensions to natural aspect ratio
  useEffect(() => {
    if (!src) {
      return;
    }

    const img = new window.Image();
    // Only set crossOrigin for remote URLs -- blob: and data: URLs fail with it
    if (src.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = src;
    img.onload = () => {
      setImage(img);

      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const storedNw = imgProps.naturalWidth;
      const storedNh = imgProps.naturalHeight;

      // If natural dimensions changed (e.g. after resize in editor), update element
      if (nw > 0 && nh > 0 && (nw !== storedNw || nh !== storedNh)) {
        // Fit to current element bounds while preserving new aspect ratio
        const ratio = nw / nh;
        let newW = element.width;
        let newH = element.width / ratio;
        if (newH > element.height) {
          newH = element.height;
          newW = element.height * ratio;
        }
        onUpdate(artboardId, element.id, {
          width: Math.round(newW),
          height: Math.round(newH),
          props: { ...imgProps, naturalWidth: nw, naturalHeight: nh },
        });
      }
    };
    img.onerror = () => setImage(null);

    return () => {
      img.onload = null;
      img.onerror = null;
      setImage(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Attach transformer when selected
  useEffect(() => {
    if (!isSelected || !trRef.current || !nodeRef.current) return;
    trRef.current.nodes([nodeRef.current]);
    trRef.current.getLayer()?.batchDraw();
  }, [isSelected]);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (element.locked) return;
      onSelect(artboardId, element.id);
    },
    [artboardId, element.id, element.locked, onSelect],
  );

  const handleDblClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      if (element.locked) return;
      onDoubleClick(artboardId, element.id);
    },
    [artboardId, element.id, element.locked, onDoubleClick],
  );

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      onDragMove?.(artboardId, element.id, e.target);
    },
    [artboardId, element.id, onDragMove],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      const node = e.target;
      onUpdate(artboardId, element.id, {
        x: node.x(),
        y: node.y(),
      });
    },
    [artboardId, element.id, onUpdate],
  );

  const handleTransformEnd = useCallback(() => {
    const node = nodeRef.current;
    if (!node) return;

    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    // Apply scale to width/height and reset scale to 1
    onUpdate(artboardId, element.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(1, element.width * scaleX),
      height: Math.max(1, element.height * scaleY),
      rotation: node.rotation(),
      scaleX: 1,
      scaleY: 1,
    });

    // Reset node scale so Konva doesn't compound it
    node.scaleX(1);
    node.scaleY(1);
  }, [artboardId, element.id, element.width, element.height, onUpdate]);

  if (!element.visible) return null;

  return (
    <>
      <Group
        ref={nodeRef}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        rotation={element.rotation}
        scaleX={element.scaleX}
        scaleY={element.scaleY}
        opacity={element.opacity}
        draggable={!element.locked && isSelected}
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {image ? (
          <KonvaImage
            image={image}
            width={element.width}
            height={element.height}
          />
        ) : null}

        {/* Resolution badge (bottom-right) */}
        {image && (() => {
          const nw = imgProps.naturalWidth || image.naturalWidth;
          const nh = imgProps.naturalHeight || image.naturalHeight;
          if (!nw || !nh) return null;
          const label = `${nw}\u00D7${nh}`;
          // Compensate font size for element scale so badge stays ~10px visually
          const scale = Math.max(element.scaleX ?? 1, element.scaleY ?? 1, 1);
          const fontSize = 10 / scale;
          const padX = 4 / scale;
          const padY = 2 / scale;
          const badgeW = label.length * fontSize * 0.62 + padX * 2;
          const badgeH = fontSize + padY * 2;
          const margin = 4 / scale;
          return (
            <Group
              x={element.width - badgeW - margin}
              y={element.height - badgeH - margin}
              listening={false}
            >
              <Rect
                width={badgeW}
                height={badgeH}
                fill="rgba(11, 39, 49, 0.85)"
                cornerRadius={3 / scale}
              />
              <Text
                text={label}
                x={padX}
                y={padY}
                fontSize={fontSize}
                fontFamily="'JetBrains Mono', monospace"
                fill="#E8F4F8"
                listening={false}
              />
            </Group>
          );
        })()}
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          keepRatio={!isFreeTransform}
          rotateEnabled={isFreeTransform}
          enabledAnchors={
            isFreeTransform
              ? undefined
              : [
                  'top-left',
                  'top-right',
                  'bottom-left',
                  'bottom-right',
                  'middle-left',
                  'middle-right',
                  'top-center',
                  'bottom-center',
                ]
          }
          borderStrokeWidth={1.5}
          anchorSize={8}
          anchorCornerRadius={2}
          boundBoxFunc={(_, newBox) => ({
            ...newBox,
            width: Math.max(5, newBox.width),
            height: Math.max(5, newBox.height),
          })}
        />
      )}
    </>
  );
};

export default ImageLayer;
