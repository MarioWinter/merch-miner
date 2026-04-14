import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Group, Text, TextPath, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { CanvasElement, TextElementProps } from '../../types';

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Build an SVG arc path for curved text.
 * arcAngle in degrees (-180..180). Positive = curve up, negative = curve down.
 * Returns an SVG path string `M ... A ...`.
 */
const buildArcPath = (
  textWidth: number,
  arcAngle: number,
  fontSize: number,
): string => {
  const absAngle = Math.abs(arcAngle);
  // Radius: larger angle = tighter curve. Scale by fontSize for sensible sizing.
  const radius = Math.max(
    fontSize,
    (textWidth / 2) / Math.sin((absAngle * Math.PI) / 360),
  );

  // Arc spans horizontally from (0,cy) to (textWidth, cy)
  // sweep flag flips based on sign: positive angle curves up, negative curves down
  const sweepFlag = arcAngle > 0 ? 0 : 1;
  const largeArcFlag = absAngle > 180 ? 1 : 0;

  // Start and end y-offset to center the arc vertically
  const cy = radius;
  return `M 0,${cy} A ${radius},${radius} 0 ${largeArcFlag},${sweepFlag} ${textWidth},${cy}`;
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface TextLayerProps {
  element: CanvasElement<'text'>;
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
  /** When true, the element is being inline-edited via a DOM textarea — hide Konva text */
  isBeingEdited?: boolean;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const TextLayer = ({
  element,
  artboardId,
  isSelected,
  isFreeTransform,
  onSelect,
  onDoubleClick,
  onUpdate,
  onDragMove,
  isBeingEdited = false,
}: TextLayerProps) => {
  const nodeRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const props = element.props as TextElementProps;

  const arcAngle = props.arcAngle ?? 0;
  const isCurved = arcAngle !== 0;

  // SVG arc path for curved text
  const arcPath = useMemo(
    () => (isCurved ? buildArcPath(element.width, arcAngle, props.fontSize) : ''),
    [isCurved, element.width, arcAngle, props.fontSize],
  );

  // Gradient config
  const gradientEnabled = props.gradientEnabled ?? false;
  const gradientProps = useMemo(() => {
    if (!gradientEnabled) return {};
    return {
      fillLinearGradientStartPoint: { x: 0, y: 0 },
      fillLinearGradientEndPoint: { x: 0, y: props.fontSize },
      fillLinearGradientColorStops: [
        0, props.gradientStartColor ?? '#ffffff',
        1, props.gradientEndColor ?? '#000000',
      ],
      fill: undefined, // override solid fill
    };
  }, [gradientEnabled, props.fontSize, props.gradientStartColor, props.gradientEndColor]);

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

    // For text: scale fontSize proportionally and reset scale
    const avgScale = (scaleX + scaleY) / 2;
    const newFontSize = Math.max(1, Math.round(props.fontSize * avgScale));

    onUpdate(artboardId, element.id, {
      x: node.x(),
      y: node.y(),
      width: Math.max(1, element.width * scaleX),
      height: Math.max(1, element.height * scaleY),
      rotation: node.rotation(),
      scaleX: 1,
      scaleY: 1,
      props: { ...props, fontSize: newFontSize } as TextElementProps,
    });

    node.scaleX(1);
    node.scaleY(1);
  }, [artboardId, element.id, element.width, element.height, props, onUpdate]);

  if (!element.visible) return null;

  // Shared text styling props
  const fontStyleStr =
    `${props.fontWeight ?? 400}${props.fontStyle === 'italic' ? ' italic' : ''}` as string;
  const fillProp = gradientEnabled ? undefined : props.fill;

  // 3D / Emboss: stack shadow copies behind main text
  const embossEnabled = props.embossEnabled ?? false;
  const embossDepth = props.embossDepth ?? 2;
  const embossColor = props.embossColor ?? '#000000';

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
        opacity={isBeingEdited ? 0 : element.opacity}
        draggable={!element.locked && isSelected && !isBeingEdited}
        listening={!isBeingEdited}
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        {/* 3D emboss shadow layers (rendered behind main text) */}
        {embossEnabled &&
          Array.from({ length: embossDepth }, (_, i) => {
            const offset = i + 1;
            return isCurved ? (
              <TextPath
                key={`emboss-${i}`}
                data={arcPath}
                text={props.text}
                fontFamily={props.fontFamily}
                fontSize={props.fontSize}
                fontStyle={fontStyleStr}
                fill={embossColor}
                align={props.align}
                letterSpacing={props.letterSpacing}
                x={offset}
                y={offset}
                listening
              />
            ) : (
              <Text
                key={`emboss-${i}`}
                text={props.text}
                width={element.width}
                fontFamily={props.fontFamily}
                fontSize={props.fontSize}
                fontStyle={fontStyleStr}
                fill={embossColor}
                align={props.align}
                letterSpacing={props.letterSpacing}
                lineHeight={props.lineHeight}
                x={offset}
                y={offset}
                listening
              />
            );
          })}

        {/* Main text */}
        {isCurved ? (
          <TextPath
            data={arcPath}
            text={props.text}
            fontFamily={props.fontFamily}
            fontSize={props.fontSize}
            fontStyle={fontStyleStr}
            fill={fillProp}
            align={props.align}
            letterSpacing={props.letterSpacing}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth ?? 0}
            shadowColor={props.shadowColor}
            shadowOffsetX={props.shadowOffsetX ?? 0}
            shadowOffsetY={props.shadowOffsetY ?? 0}
            shadowBlur={props.shadowBlur ?? 0}
            shadowEnabled={!!props.shadowColor}
            {...gradientProps}
            listening
          />
        ) : (
          <Text
            text={props.text}
            width={element.width}
            fontFamily={props.fontFamily}
            fontSize={props.fontSize}
            fontStyle={fontStyleStr}
            fill={fillProp}
            align={props.align}
            letterSpacing={props.letterSpacing}
            lineHeight={props.lineHeight}
            stroke={props.stroke}
            strokeWidth={props.strokeWidth ?? 0}
            shadowColor={props.shadowColor}
            shadowOffsetX={props.shadowOffsetX ?? 0}
            shadowOffsetY={props.shadowOffsetY ?? 0}
            shadowBlur={props.shadowBlur ?? 0}
            shadowEnabled={!!props.shadowColor}
            {...gradientProps}
            listening
          />
        )}
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

export default TextLayer;
