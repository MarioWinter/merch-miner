export type DesignModel = 'gemini_flash' | 'gemini_pro' | 'gpt_image' | 'flux';

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

export interface BoardLayout {
  nodes: Array<{ id: string; x: number; y: number }>;
  edges: Array<{ source: string; target: string }>;
}

export interface ExternalImageDrop {
  file: File;
  previewUrl: string;
  name: string;
}
