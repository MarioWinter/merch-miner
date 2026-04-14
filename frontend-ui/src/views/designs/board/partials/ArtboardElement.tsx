import { useCallback, useEffect, useRef, useState } from 'react';
import { Group, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElement } from '../types';

// -----------------------------------------------------------------
// Shift-key tracker hook (toggles keepRatio on Transformer)
// -----------------------------------------------------------------

const useShiftKey = () => {
  const [shiftHeld, setShiftHeld] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  return shiftHeld;
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ArtboardElementProps {
  element: CanvasElement;
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
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ArtboardElement = ({
  element,
  artboardId,
  isSelected,
  isFreeTransform,
  onSelect,
  onDoubleClick,
  onUpdate,
}: ArtboardElementProps) => {
  const nodeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const shiftHeld = useShiftKey();

  // Load image for image elements
  const imageSrc = element.type === 'image' ? (element.props as { src?: string }).src : undefined;
  useEffect(() => {
    if (!imageSrc) return;

    const img = new window.Image();
    if (imageSrc.startsWith('http')) img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => setImage(img);
    img.onerror = () => setImage(null);

    return () => {
      img.onload = null;
      img.onerror = null;
      setImage(null);
    };
  }, [imageSrc]);

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

  // Currently only render image elements (other types in later phases)
  const renderContent = () => {
    if (element.type === 'image' && image) {
      return (
        <KonvaImage
          image={image}
          width={element.width}
          height={element.height}
          listening={false}
        />
      );
    }
    // Placeholder for non-image types (future phases)
    return null;
  };

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
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {renderContent()}
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          keepRatio={!isFreeTransform && !shiftHeld}
          rotateEnabled={isFreeTransform}
          enabledAnchors={
            isFreeTransform
              ? undefined
              : [
                  'top-left',
                  'top-right',
                  'bottom-left',
                  'bottom-right',
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

export default ArtboardElement;
