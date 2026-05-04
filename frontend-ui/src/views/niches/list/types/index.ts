export type NicheStatus =
  | 'data_entry'
  | 'deep_research'
  | 'niche_with_potential'
  | 'to_designer'
  | 'upload'
  | 'start_ads'
  | 'pending'
  | 'winner'
  | 'loser'
  | 'archived';

export type PotentialRating = 'good' | 'very_good' | 'rejected';

export type ResearchStatus = 'pending' | 'running' | 'done';

export interface NicheResearchProgress {
  completed_nodes: string[];
  current_node: string;
  status: string;
  total_nodes: number;
  marketplace?: string;
  product_type?: string;
  retry_count?: number;
}

export interface Niche {
  id: string;
  workspace: string;
  name: string;
  notes: string;
  status: NicheStatus;
  potential_rating: PotentialRating | null;
  research_status: ResearchStatus | null;
  research_run_id: string | null;
  research_progress: NicheResearchProgress | null;
  position: number;
  assigned_to: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  idea_count: number;
  approved_idea_count: number;
}

export interface NicheListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Niche[];
}

export interface NicheListParams {
  search?: string;
  status?: NicheStatus;
  status_group?: 'todo' | 'in_progress' | 'complete';
  potential_rating?: PotentialRating;
  assigned_to?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export interface NicheCreateBody {
  name: string;
  notes?: string;
}

export interface NicheUpdateBody {
  name?: string;
  notes?: string;
  status?: NicheStatus;
  potential_rating?: PotentialRating | null;
  assigned_to?: number | null;
  position?: number;
}

export type BulkAction = 'archive' | 'assign';

export interface NicheBulkPayload {
  ids: string[];
  action: BulkAction;
  assigned_to?: string;
  confirmArchiveIdeas?: boolean;
}

export interface NicheBulkResponse {
  updated: number;
}

export interface FilterTemplate {
  id: string;
  name: string;
  filters: Partial<import('../hooks/useNicheFilters').NicheFilters>;
  created_at: string;
  updated_at: string;
}
