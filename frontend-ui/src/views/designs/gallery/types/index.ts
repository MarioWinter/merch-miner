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

export interface ProjectBoardResponse {
  project: DesignProject;
  designs: import('../../board/types').Design[];
  board_layout: import('../../board/types').BoardLayout | null;
  idea_context: IdeaContext | null;
}
