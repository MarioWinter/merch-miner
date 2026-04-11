// -----------------------------------------------------------------
// Canvas Element types (Phase C1 — element data model)
// -----------------------------------------------------------------

export type CanvasElementType = 'image' | 'text' | 'shape' | 'brush' | 'emoji';

export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'line' | 'pen';

/** Type-specific properties for image elements */
export interface ImageElementProps {
  /** URL or data URI of the image */
  src: string;
  /** Natural width of the source image */
  naturalWidth: number;
  /** Natural height of the source image */
  naturalHeight: number;
  /** Optional crop rect (future) */
  cropRect?: { x: number; y: number; width: number; height: number };
}

/** Type-specific properties for text elements */
export interface TextElementProps {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700;
  fontStyle: 'normal' | 'italic';
  fill: string;
  align: 'left' | 'center' | 'right';
  letterSpacing: number;
  lineHeight: number;
  /** Outline stroke */
  stroke?: string;
  strokeWidth?: number;
  /** Drop shadow */
  shadowColor?: string;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowBlur?: number;
  /** Curved text arc angle (-180 to 180, 0 = flat) */
  arcAngle?: number;
  /** Gradient fill */
  gradientEnabled?: boolean;
  gradientStartColor?: string;
  gradientEndColor?: string;
  /** 3D / Emboss effect */
  embossEnabled?: boolean;
  embossDepth?: number;
  embossColor?: string;
}

/** Type-specific properties for shape elements */
export interface ShapeElementProps {
  shapeKind: ShapeKind;
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** Corner radius for rectangles */
  cornerRadius?: number;
  /** Points array for pen/line shapes */
  points?: number[];
  /** Whether the pen path is closed */
  closed?: boolean;
  /** Tension for smooth curves (0-1) */
  tension?: number;
}

/** A single brush sub-stroke within a grouped Drawing layer */
export interface BrushSubStroke {
  /** Flat array of [x, y, x, y, ...] points relative to parent element origin */
  points: number[];
  stroke: string;
  strokeWidth: number;
  tension: number;
}

/** Type-specific properties for brush elements */
export interface BrushElementProps {
  /** Flat array of [x, y, x, y, ...] points (single stroke, or first stroke for legacy) */
  points: number[];
  stroke: string;
  strokeWidth: number;
  /** Line tension for smoothing (0-1) */
  tension: number;
  /** Grouped sub-strokes (when multiple strokes merged into one Drawing layer) */
  subStrokes?: BrushSubStroke[];
}

/** Type-specific properties for emoji elements */
export interface EmojiElementProps {
  /** Original emoji character */
  emoji: string;
  /** Rasterized data URI */
  dataUrl: string;
}

/** Map element type to its props interface */
export interface CanvasElementPropsMap {
  image: ImageElementProps;
  text: TextElementProps;
  shape: ShapeElementProps;
  brush: BrushElementProps;
  emoji: EmojiElementProps;
}

/** A single element (layer) within an artboard */
export interface CanvasElement<T extends CanvasElementType = CanvasElementType> {
  id: string;
  type: T;
  /** Position relative to artboard origin */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  /** Opacity 0-1 */
  opacity: number;
  visible: boolean;
  locked: boolean;
  /** Render order within the artboard (higher = on top) */
  zIndex: number;
  /** Display name in layer panel */
  name: string;
  /** Type-specific properties */
  props: T extends keyof CanvasElementPropsMap ? CanvasElementPropsMap[T] : never;
}
