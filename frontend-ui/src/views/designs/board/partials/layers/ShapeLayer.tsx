import { useCallback, useEffect, useRef } from 'react';
import { Ellipse, Group, Line, Rect, RegularPolygon, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElement, ShapeElementProps } from '../../types';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ShapeLayerProps {
  element: CanvasElement<'shape'>;
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

const ShapeLayer = ({
  element,
  artboardId,
  isSelected,
  isFreeTransform,
  zoom,
  onSelect,
  onDoubleClick,
  onUpdate,
  onDragMove,
}: ShapeLayerProps) => {
  const nodeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const props = element.props as ShapeElementProps;

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

  const renderShape = () => {
    switch (props.shapeKind) {
      case 'rect':
        return (
          <Rect
            width={element.width}
            height={element.height}
            fill={props.fill}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            cornerRadius={props.cornerRadius ?? 0}
            listening
          />
        );

      case 'ellipse':
        return (
          <Ellipse
            x={element.width / 2}
            y={element.height / 2}
            radiusX={element.width / 2}
            radiusY={element.height / 2}
            fill={props.fill}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            listening
          />
        );

      case 'triangle':
        return (
          <RegularPolygon
            x={element.width / 2}
            y={element.height / 2}
            sides={3}
            radius={Math.min(element.width, element.height) / 2}
            fill={props.fill}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            listening
          />
        );

      case 'line':
        return (
          <Line
            points={props.points ?? [0, 0, element.width, element.height]}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            listening
          />
        );

      case 'pen':
        return (
          <Line
            points={props.points ?? []}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth}
            fill={props.closed ? props.fill : undefined}
            closed={props.closed ?? false}
            tension={props.tension ?? 0.3}
            lineCap="round"
            lineJoin="round"
            listening
          />
        );

      default:
        return null;
    }
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
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {renderShape()}
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

export default ShapeLayer;
