import { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElement, EmojiElementProps } from '../../types';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface EmojiLayerProps {
  element: CanvasElement<'emoji'>;
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

const EmojiLayer = ({
  element,
  artboardId,
  isSelected,
  isFreeTransform,
  onSelect,
  onDoubleClick,
  onUpdate,
  onDragMove,
}: EmojiLayerProps) => {
  const nodeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  const { dataUrl } = element.props as EmojiElementProps;

  // Load rasterized emoji image from data URI
  useEffect(() => {
    if (!dataUrl) return;

    const img = new window.Image();
    img.src = dataUrl;
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);

    return () => {
      img.onload = null;
      img.onerror = null;
      setImage(null);
    };
  }, [dataUrl]);

  // Attach transformer when selected
  useEffect(() => {
    if (!isSelected || !trRef.current || !nodeRef.current) return;
    trRef.current.nodes([nodeRef.current]);
    trRef.current.getLayer()?.batchDraw();
  }, [isSelected]);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      e.cancelBubble = true;
      if (element.locked) return;
      onSelect(artboardId, element.id);
    },
    [artboardId, element.id, element.locked, onSelect],
  );

  const handleDblClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
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

    onUpdate(artboardId, element.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(1, element.width * scaleX),
      height: Math.max(1, element.height * scaleY),
      rotation: node.rotation(),
      scaleX: 1,
      scaleY: 1,
    });

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
            listening
          />
        ) : null}
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

export default EmojiLayer;
