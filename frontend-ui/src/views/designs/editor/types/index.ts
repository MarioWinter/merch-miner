// -----------------------------------------------------------------
// Design Editor — Types
// -----------------------------------------------------------------

// --- Pipeline Tool Definitions ---

export type ToolCategory = 'standard' | 'edge' | 'ai';

export type ToolName =
  // Standard
  | 'resize'
  | 'trim'
  | 'rotate'
  | 'filters'
  | 'distress'
  | 'color_removal'
  | 'speckle_remover'
  | 'transparency_cleaner'
  | 'watermark'
  // Edge Cleanup
  | 'defringe'
  | 'shrink'
  | 'color_defringe'
  | 'edge_cleaner'
  // AI Processing
  | 'bg_remove'
  | 'ai_upscale';

export interface ToolDefinition {
  name: ToolName;
  category: ToolCategory;
  labelKey: string;
  iconName: string;
}

export interface PipelineTool {
  id: string;
  name: ToolName;
  params: Record<string, unknown>;
  enabled: boolean;
  condition?: PipelineCondition | null;
}

export interface PipelineCondition {
  field: 'width' | 'height' | 'fileSize';
  operator: 'lt' | 'gt' | 'eq' | 'lte' | 'gte';
  value: number;
}

export interface DesignPipeline {
  id: string;
  workspace: string;
  name: string;
  tools: PipelineTool[];
  is_preset: boolean;
  created_by: number;
  created_at: string;
}

export interface CreatePipelineBody {
  name: string;
  tools: PipelineTool[];
  is_preset?: boolean;
}

export interface UpdatePipelineBody {
  name?: string;
  tools?: PipelineTool[];
  is_preset?: boolean;
}

export interface ApplyPipelineBody {
  design_ids: string[];
  pipeline_id: string;
  /**
   * Frontend-only field used to scope RTK Query tag invalidation. The backend
   * ignores extra payload keys; including it here avoids a separate dispatch
   * round-trip after the mutation resolves.
   */
  projectId?: string;
}

export interface ApplyPipelineResult {
  server_jobs: Array<{ job_id: string; design_id: string; type: string }>;
  client_steps: PipelineTool[];
}

// --- Batch Image Types ---

export type BatchImageStatus = 'idle' | 'processing' | 'completed' | 'error';

export interface BatchImage {
  id: string;
  file: File | null;
  previewUrl: string;
  name: string;
  status: BatchImageStatus;
  width?: number;
  height?: number;
  fileSize?: number;
  designId?: string;
  processedUrl?: string;
  errorMessage?: string;
  /** Original image URL (before any server processing) for "show original" toggle */
  originalUrl?: string;
}

// --- Canvas Tool Types ---

export type CanvasToolType = 'move' | 'eraser' | 'wand';

export interface CanvasToolState {
  activeTool: CanvasToolType;
  eraserSize: number;
  eraserHardness: number;
  wandTolerance: number;
  zoom: number;
  panOffset: { x: number; y: number };
}

// --- Export Types ---

export type ExportFormat = 'png' | 'jpeg' | 'webp';

export type CompressionLevel = 'off' | 'low' | 'medium' | 'high' | 'very_high';

export interface ExportSettings {
  format: ExportFormat;
  dpi: number;
  compression: CompressionLevel;
  overwriteOriginal: boolean;
}

// --- Tool Catalog (static) ---

export const TOOL_CATALOG: ToolDefinition[] = [
  // Standard
  { name: 'resize', category: 'standard', labelKey: 'design.tools.resize', iconName: 'AspectRatio' },
  { name: 'trim', category: 'standard', labelKey: 'design.tools.trim', iconName: 'Crop' },
  { name: 'rotate', category: 'standard', labelKey: 'design.tools.rotate', iconName: 'RotateRight' },
  { name: 'filters', category: 'standard', labelKey: 'design.tools.filters', iconName: 'Tune' },
  { name: 'distress', category: 'standard', labelKey: 'design.tools.distress', iconName: 'Texture' },
  { name: 'color_removal', category: 'standard', labelKey: 'design.tools.colorRemoval', iconName: 'FormatColorReset' },
  { name: 'speckle_remover', category: 'standard', labelKey: 'design.tools.speckleRemover', iconName: 'AutoFixHigh' },
  { name: 'transparency_cleaner', category: 'standard', labelKey: 'design.tools.transparencyCleaner', iconName: 'Opacity' },
  { name: 'watermark', category: 'standard', labelKey: 'design.tools.watermark', iconName: 'BrandingWatermark' },
  // Edge Cleanup
  { name: 'defringe', category: 'edge', labelKey: 'design.tools.defringe', iconName: 'BlurLinear' },
  { name: 'shrink', category: 'edge', labelKey: 'design.tools.shrink', iconName: 'Compress' },
  { name: 'color_defringe', category: 'edge', labelKey: 'design.tools.colorDefringe', iconName: 'Palette' },
  { name: 'edge_cleaner', category: 'edge', labelKey: 'design.tools.edgeCleaner', iconName: 'CleaningServices' },
  // AI Processing
  { name: 'bg_remove', category: 'ai', labelKey: 'design.tools.bgRemove', iconName: 'ContentCut' },
  { name: 'ai_upscale', category: 'ai', labelKey: 'design.tools.aiUpscale', iconName: 'ZoomIn' },
];

export const TOOL_CATEGORIES: Array<{ key: ToolCategory; labelKey: string }> = [
  { key: 'standard', labelKey: 'design.pipeline.categories.standard' },
  { key: 'edge', labelKey: 'design.pipeline.categories.edge' },
  { key: 'ai', labelKey: 'design.pipeline.categories.ai' },
];
