export interface NicheSummary {
  id: string;
  name: string;
}

export interface DesignProject {
  id: string;
  name: string;
  niche: string | null;
  niche_summary: NicheSummary | null;
  design_count: number;
  thumbnail: string | null;
  board_layout: Record<string, unknown> | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface DesignProjectListItem {
  id: string;
  name: string;
  niche: string | null;
  niche_name: string | null;
  design_count: number;
  thumbnail: string | null;
  updated_at: string;
  created_at: string;
}

export interface DesignProjectListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DesignProjectListItem[];
}

export interface CreateProjectBody {
  name: string;
  niche?: string | null;
  idea_ids?: string[];
}

export interface UpdateProjectBody {
  name?: string;
  niche?: string | null;
  board_layout?: Record<string, unknown> | null;
}

export interface AddDesignsToProjectBody {
  design_ids: string[];
}

export interface IdeaContext {
  idea_id: string;
  slogan_text: string;
  niche_name: string | null;
  reference_products: import('../../board/types').ReferenceProduct[];
}

/** A slogan/idea attached to a project's pool */
export interface ProjectIdea {
  id: string;
  slogan_text: string;
  signal_type: string | null;
  market_confidence: string | null;
  emotional_archetype: string;
  pattern_used: string;
  why_it_works: string;
  niche_name: string | null;
  position: number;
  reference_products: import('../../board/types').ReferenceProduct[];
  design_count: number;
}

/** A saved prompt attached to a project */
export interface ProjectPrompt {
  id: string;
  prompt_text: string;
  sources: Record<string, boolean>;
  source_idea: { id: string; slogan_text: string } | null;
  source_image_url: string | null;
  variant_index: number;
  is_generated: boolean;
  created_at: string;
  updated_at: string;
}

/** A reusable prompt preset (source_config stores full tab states) */
export interface PromptPreset {
  id: string;
  name: string;
  source_config: Record<string, unknown>;
  created_at: string;
}

export interface AddIdeasBody {
  idea_ids: string[];
}


export interface CreatePromptsBody {
  prompts: Array<{
    prompt_text: string;
    sources: Record<string, boolean>;
    source_idea?: string;
    source_image_url?: string;
    variant_index?: number;
  }>;
}

export interface BuildPromptsBody {
  sources: {
    slogan: boolean;
    keywords: boolean;
    research: boolean;
    web_research: boolean;
    image: boolean;
  };
  slogan_id?: string;
  image_url?: string;
  variants: number;
  /** Reference image URLs for multimodal generation */
  source_image_urls?: string[];
  /** Analysis text from reference images (text mode) */
  reference_analysis_texts?: string[];
}

export interface BuildPromptsResponse {
  prompts: Array<{
    prompt_text: string;
    sources: Record<string, boolean>;
  }>;
}

/** A product reference image attached to a project (from AmazonProduct or manual). */
export interface ProjectReference {
  id: string;
  project: string;
  source_product: string | null;
  image_url: string;
  title: string;
  asin: string;
  prompt_analysis: Record<string, unknown> | null;
  position: number;
  added_at: string;
}

export interface ActiveRun {
  id: string;
  status: 'pending' | 'running' | 'failed' | 'completed';
  generation_mode: string;
  error_message: string;
}

export interface ProjectBoardResponse {
  project: DesignProject;
  designs: import('../../board/types').Design[];
  board_layout: import('../../board/types').BoardLayout | null;
  idea_context: IdeaContext | null;
  ideas: ProjectIdea[];
  prompts: ProjectPrompt[];
  references: ProjectReference[];
  active_runs?: ActiveRun[];
}
