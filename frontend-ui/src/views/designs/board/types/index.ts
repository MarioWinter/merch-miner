import type { CanvasElement } from './elements';

export type DesignModel =
  | 'google/gemini-2.5-flash-preview-image-generation'
  | 'google/gemini-3.1-flash-preview-image-generation'
  | 'google/gemini-3-pro-preview-image-generation'
  | 'openai/gpt-5-image'
  | 'openai/gpt-5-image-mini';

export type DesignStatus = 'pending' | 'approved' | 'rejected' | 'failed';

export type BackgroundColor = 'light_gray' | 'neon_pink' | 'neon_green';

export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ProcessingJobType = 'upscale' | 'bg_remove';

export type GenerationMode =
  | 'text_to_image'
  | 'image_to_image'
  | 'image_to_image_edit'
  | 'remix';

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
  image_file: string | null;
  status: DesignStatus;
  is_manual: boolean;
  background_color: BackgroundColor;
  source_image_url: string;
  prompt_analysis: Record<string, unknown>;
  upscaled_file: string | null;
  bg_removed_file: string | null;
  /** Latest editor-pipeline output (processed via tools like Trim, Resize, Defringe, etc.). */
  processed_file: string | null;
  created_at: string;
  /**
   * PROJ-9 Phase O — true when at least one non-deleted DesignAsset exists
   * with `design_origin=<this.id>`. Backend annotates list endpoints; falls
   * back to `false` for single-design write responses.
   */
  has_design_asset?: boolean;
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
  mode?: GenerationMode;
  aspect_ratio?: string;
  source_image_url?: string;
  source_image_url_2?: string;
}

export interface GenerateFromPromptBody {
  model: DesignModel;
  background_color?: BackgroundColor;
  aspect_ratio?: string;
  mode?: GenerationMode;
  source_image_url?: string;
  source_image_url_2?: string;
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
  /** AI skeleton metadata — persisted so page reload can resume a running run */
  kind?: ArtboardKind;
  isGenerating?: boolean;
  pendingRunId?: string | null;
  promptUsed?: string;
  hasError?: boolean;
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
  /** Run id this artboard waits for (survives page reload so we can resume polling) */
  pendingRunId?: string | null;
  /** When true, the linked run failed and the artboard shows an error state */
  hasError?: boolean;
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

// -----------------------------------------------------------------
// Canvas Tool type (shared across toolbar + drawing hooks)
// -----------------------------------------------------------------

export type CanvasTool =
  | 'cursor'
  | 'rectangle'
  | 'ellipse'
  | 'triangle'
  | 'line'
  | 'pen'
  | 'brush'
  | 'text'
  | 'emoji';

// -----------------------------------------------------------------
// Re-export element types
// -----------------------------------------------------------------

export * from './elements';
