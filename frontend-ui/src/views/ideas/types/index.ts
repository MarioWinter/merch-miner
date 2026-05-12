export type IdeaStatus = 'pending' | 'approved' | 'rejected' | 'for_review';

export type SignalType = 'self' | 'other';

export type MarketConfidence = 'High' | 'Medium' | 'Low';

export type AdaptationRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type IdeaOrdering =
  | 'created_at'
  | '-created_at'
  | 'slogan_text'
  | '-slogan_text'
  | 'status'
  | '-status';

export interface IdeaSourceSummary {
  id: string;
  slogan_text: string;
}

export interface Idea {
  id: string;
  workspace: string;
  niche: string | null;
  niche_name: string | null;
  adaptation_run: string | null;
  source_idea: string | null;
  source_idea_summary: IdeaSourceSummary | null;
  source_product_url: string;
  slogan_text: string;
  is_manual: boolean;
  signal_type: SignalType | null;
  creative_modules_used: string[];
  emotional_archetype: string;
  buyer_voice_pattern: string;
  stylistic_device: string;
  pattern_used: string;
  why_it_works: string;
  market_confidence: MarketConfidence | null;
  status: IdeaStatus;
  was_changed: boolean;
  change_reason: string;
  created_by: number;
  created_at: string;
}

export interface IdeaListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Idea[];
}

export interface IdeaListParams {
  page?: number;
  page_size?: number;
  is_manual?: boolean;
}

/** Params for workspace-wide GET /api/ideas/ */
export interface IdeaListAllParams {
  niche_id?: string;
  status?: IdeaStatus | '';
  signal_type?: SignalType | '';
  is_orphan?: boolean;
  ordering?: IdeaOrdering | '';
  page?: number;
  page_size?: number;
}

export interface IdeaCreateBody {
  slogan_text: string;
  niche?: string | null;
  source_product_url?: string;
  // PROJ-29 Phase 1H-2 — optional rich metadata for chat-agent ideas. Backend
  // `IdeaCreateSerializer` validates these against the same enums as the
  // model. All optional so legacy single-line manual adds keep working.
  signal_type?: SignalType | null;
  pattern_used?: string;
  stylistic_device?: string;
  emotional_archetype?: string;
  market_confidence?: MarketConfidence | null;
  creative_modules_used?: string[];
  status?: IdeaStatus;
}

export interface IdeaUpdateBody {
  slogan_text?: string;
  niche?: string | null;
  status?: IdeaStatus;
  signal_type?: SignalType | null;
  market_confidence?: MarketConfidence | null;
  emotional_archetype?: string;
}

export interface IdeaAdaptationRun {
  id: string;
  workspace: string;
  source_idea: string;
  source_idea_text: string | null;
  target_niche_ids: string[];
  niche_results: Record<string, NicheAdaptationResult>;
  status: AdaptationRunStatus;
  triggered_by: number;
  completed_nodes: string[];
  current_node: string;
  created_at: string;
  completed_at: string | null;
  error_message: string;
}

export interface NicheAdaptationResult {
  niche_name: string;
  status: 'approved' | 'rejected' | 'pending' | 'running' | 'failed';
  compatibility_score?: number;
  rejection_reason?: string;
  signal_conversion?: string;
  ideas_created?: number;
}

export interface NicheSuggestion {
  niche_id: string;
  niche_name: string;
  compatibility_score: number;
  shared_patterns: string[];
  already_adapted: boolean;
  has_completed_research: boolean;
  research_status: 'pending' | 'running' | 'done' | null;
}

export interface BulkStatusBody {
  ids: string[];
  status: 'approved' | 'rejected';
}

export interface BulkStatusResponse {
  updated: number;
}

export interface ExtractSloganBody {
  product_image_url: string;
  product_title?: string;
  product_brand?: string;
}

export interface ExtractSloganResponse {
  slogan_text: string;
}

export interface ImproveBody {
  feedback?: string;
}

export interface ImportIdeaItem {
  slogan_text: string;
  niche_name?: string;
}

export interface ImportIdeasBody {
  ideas: ImportIdeaItem[];
}

export interface ImportIdeasResponse {
  created: number;
  warnings: string[];
}

export interface IdeaFilterTemplate {
  id: string;
  name: string;
  filters: Partial<IdeaFilters>;
  created_at: string;
  updated_at: string;
}

export interface IdeaFilters {
  niche_id: string;
  status: IdeaStatus | '';
  signal_type: SignalType | '';
  ordering: IdeaOrdering | '';
  page: number;
}
