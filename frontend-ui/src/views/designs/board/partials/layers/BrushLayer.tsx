import { useCallback, useEffect, useRef } from 'react';
import { Group, Line, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElement, BrushElementProps } from '../../types';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface BrushLayerProps {
  element: CanvasElement<'brush'>;
  artboardId: string;
  isSelected: boolean;
  isFreeTransform: boolean;
  zoom: number;
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

const BrushLayer = ({
  element,
  artboardId,
  isSelected,
  isFreeTransform,
  zoom,
  onSelect,
  onDoubleClick,
  onUpdate,
  onDragMove,
}: BrushLayerProps) => {
  const nodeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const props = element.props as BrushElementProps;

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

    onUpdate(artboardId, element.id, {
      x: node.x(),
      y: node.y(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      rotation: node.rotation(),
    });
  }, [artboardId, element.id, onUpdate]);

  if (!element.visible) return null;

  return (
    <>
      <Group
        ref={nodeRef}
        x={element.x}
        y={element.y}
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
        <Line
          points={props.points}
          stroke={props.stroke}
          strokeWidth={props.strokeWidth}
          tension={props.tension}
          lineCap="round"
          lineJoin="round"
          listening
        />
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
          borderStrokeWidth={1.5 / zoom}
          anchorSize={8 / Math.max(zoom, 0.3)}
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

export default BrushLayer;
