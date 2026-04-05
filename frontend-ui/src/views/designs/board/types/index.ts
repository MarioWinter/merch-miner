export type DesignModel =
  | 'google/gemini-2.5-flash-preview-image-generation'
  | 'google/gemini-3.1-flash-preview-image-generation'
  | 'google/gemini-3-pro-preview-image-generation'
  | 'openai/gpt-5-image'
  | 'openai/gpt-5-image-mini'
  | 'black-forest-labs/flux-1.1-pro'
  | 'bytedance-seed/seedream-4.5';

export type DesignStatus = 'pending' | 'approved' | 'rejected' | 'failed';

export type BackgroundColor = 'light_gray' | 'neon_pink' | 'neon_green';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ProcessingJobType = 'upscale' | 'bg_remove';

export interface DesignGenerationRun {
  id: string;
  idea: string;
  model_name: DesignModel;
  status: RunStatus;
  triggered_by: number;
  prompt_used: string;
  created_at: string;
  completed_at: string | null;
  error_message: string;
}

export interface IdeaSummary {
  id: string;
  slogan_text: string;
}

export interface Design {
  id: string;
  workspace: string;
  idea: string;
  idea_summary: IdeaSummary | null;
  generation_run: DesignGenerationRun | null;
  image_file: string;
  status: DesignStatus;
  is_manual: boolean;
  background_color: BackgroundColor;
  source_image_url: string;
  prompt_analysis: Record<string, unknown>;
  upscaled_file: string;
  bg_removed_file: string;
  created_at: string;
}

export interface ReferenceProduct {
  product_id: string;
  image: string;
  title: string;
  visual_style: string;
  graphic_elements: string;
  layout_composition: string;
  vibe: string | string[];
  emotional_pattern: string;
  semantic_structure: Record<string, unknown>;
  key_elements: string[];
  tone: string;
  adaptation_formula: string;
  adaptation_examples: string[];
  customer_psychology: Record<string, unknown>;
  sentiment_analysis: Record<string, unknown>;
  prompt_analysis?: Record<string, unknown>;
}

export interface BoardContext {
  idea_id: string;
  slogan_text: string;
  niche_name: string | null;
  reference_products: ReferenceProduct[];
  designs: Design[];
}

export interface GenerateDesignBody {
  model: DesignModel;
  background_color: BackgroundColor;
  prompt: string;
  project_id?: string;
  idea_id?: string;
}

export interface AnalyzeImageBody {
  source_image_url: string;
}

export interface UpdateDesignStatusBody {
  status: 'approved' | 'rejected';
}

export interface BatchProcessBody {
  design_ids: string[];
  steps: ProcessingJobType[];
  model?: string;
}

export interface DesignProcessingJob {
  id: string;
  design: string;
  type: ProcessingJobType;
  status: RunStatus;
  result_file: string;
  error_message: string;
  created_at: string;
  completed_at: string | null;
}

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

/** Type-specific properties for brush elements */
export interface BrushElementProps {
  /** Flat array of [x, y, x, y, ...] points */
  points: number[];
  stroke: string;
  strokeWidth: number;
  /** Line tension for smoothing (0-1) */
  tension: number;
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

// --- React Flow Node/Edge Types ---

export type BoardNodeType = 'reference' | 'generateHub' | 'variant' | 'generating';

export interface ReferenceNodeData {
  [key: string]: unknown;
  type: 'reference';
  product: ReferenceProduct;
  isAnalyzing?: boolean;
  hasAnalysis?: boolean;
}

export interface GenerateHubNodeData {
  [key: string]: unknown;
  type: 'generateHub';
  hubId: string;
  isGenerating?: boolean;
  connectedReferenceIds: string[];
}

export interface VariantNodeData {
  [key: string]: unknown;
  type: 'variant';
  design: Design;
}

export interface GeneratingNodeData {
  [key: string]: unknown;
  type: 'generating';
  runId: string;
  run: DesignGenerationRun | null;
}

export type BoardNodeData =
  | ReferenceNodeData
  | GenerateHubNodeData
  | VariantNodeData
  | GeneratingNodeData;

export interface BoardLayoutNode {
  id: string;
  x: number;
  y: number;
  label?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
  opacity?: number;
  clipContent?: boolean;
  /** Canvas elements (layers) within this artboard */
  layers?: CanvasElement[];
}

export interface BoardLayout {
  nodes: BoardLayoutNode[];
  edges: Array<{ source: string; target: string }>;
}

// -----------------------------------------------------------------
// Artboard types (D3.2 — Konva.js artboard canvas)
// -----------------------------------------------------------------

export type ArtboardKind = 'regular' | 'ai';

export interface ArtboardData {
  id: string;
  /** Display label (editable by user) */
  label: string;
  /** Position in world coordinates */
  x: number;
  y: number;
  /** Frame dimensions (image container) */
  width: number;
  height: number;
  /** URL to the image rendered inside the frame */
  imageUrl: string | null;
  /** Artboard kind */
  kind: ArtboardKind;
  /** Connected source artboard ID (for AI Image Boards) */
  sourceId: string | null;
  /** Optional linked design ID */
  designId: string | null;
  /** Layer opacity (0-100) */
  opacity: number;
  /** Background color hex (e.g. '#FFFFFF') */
  backgroundColor: string;
  /** Whether content is clipped to artboard bounds */
  clipContent: boolean;
  /** Whether AI generation is in progress for this artboard */
  isGenerating?: boolean;
  /** Prompt used to generate this artboard (for regeneration) */
  promptUsed?: string;
  /** AI model used for generation */
  modelUsed?: DesignModel;
  /** Background color used for generation */
  bgColorUsed?: BackgroundColor;
  /** Canvas elements (layers) within this artboard */
  layers: CanvasElement[];
}

/** Preset artboard sizes */
export interface ArtboardPreset {
  label: string;
  width: number;
  height: number;
}

export const ARTBOARD_PRESETS: ArtboardPreset[] = [
  { label: 'Square 1200', width: 1200, height: 1200 },
  { label: 'MBA 4500x5400', width: 4500, height: 5400 },
  { label: 'Custom', width: 0, height: 0 },
];

export interface ArtboardSelection {
  /** IDs of currently selected artboards */
  selectedIds: Set<string>;
}

export interface RubberBandRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExternalImageDrop {
  file: File;
  previewUrl: string;
  name: string;
}
