import type { NicheStatus } from '../../niches/list/types';

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export type KanbanColumnId = 'research' | 'design' | 'publish' | 'live' | 'done';

export interface KanbanColumnDef {
  id: KanbanColumnId;
  label: string;
  statuses: NicheStatus[];
  color: string;
}

// Status-to-column mapping
export const COLUMN_DEFS: KanbanColumnDef[] = [
  {
    id: 'research',
    label: 'kanban.board.columnResearch',
    statuses: ['data_entry', 'deep_research', 'niche_with_potential'],
    color: '#38BDF8', // info
  },
  {
    id: 'design',
    label: 'kanban.board.columnDesign',
    statuses: ['to_designer'],
    color: '#00C8D7', // secondary
  },
  {
    id: 'publish',
    label: 'kanban.board.columnPublish',
    statuses: ['upload', 'start_ads'],
    color: '#F59E0B', // warning
  },
  {
    id: 'live',
    label: 'kanban.board.columnLive',
    statuses: ['pending'],
    color: '#22D3A3', // success
  },
  {
    id: 'done',
    label: 'kanban.board.columnDone',
    statuses: ['winner', 'loser'],
    color: '#FF5A4F', // primary
  },
];

export const STATUS_TO_COLUMN: Record<NicheStatus, KanbanColumnId> = {
  data_entry: 'research',
  deep_research: 'research',
  niche_with_potential: 'research',
  to_designer: 'design',
  upload: 'publish',
  start_ads: 'publish',
  pending: 'live',
  winner: 'done',
  loser: 'done',
  archived: 'done', // hidden by default, but mapped here for completeness
};

// The default status when a card is dropped on a column
export const COLUMN_DROP_STATUS: Record<KanbanColumnId, NicheStatus> = {
  research: 'data_entry',
  design: 'to_designer',
  publish: 'upload',
  live: 'pending',
  done: 'winner',
};

// ---------------------------------------------------------------------------
// Niche card (board-level representation)
// ---------------------------------------------------------------------------

export interface NicheCard {
  id: string;
  name: string;
  status: NicheStatus;
  current_round: number;
  assigned_to: number | null;
  idea_count: number;
  approved_idea_count: number;
  design_count?: number;
  listing_count?: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Design
// ---------------------------------------------------------------------------

export interface Design {
  id: string;
  file_name: string;
  file_url: string;
  thumbnail_url: string | null;
  source: string;
  round: number;
  dimensions: Record<string, number> | null;
  file_size: number | null;
  tags: string[];
  created_by: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Comment
// ---------------------------------------------------------------------------

export interface CommentAuthor {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface NicheComment {
  id: string;
  niche: string;
  design: string | null;
  author: CommentAuthor | null;
  agent_type: string;
  content: string;
  mentions: number[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Notification
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'assignment'
  | 'approval'
  | 'rejection'
  | 'mention'
  | 'status_change'
  | 'agent_action';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  is_read: boolean;
  source_user: number | null;
  source_user_email: string | null;
  source_agent_type: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Round summary
// ---------------------------------------------------------------------------

export interface RoundSummary {
  round: number;
  idea_count: number;
  design_count: number;
  approved_design_count: number;
  rejected_design_count: number;
  listing_count: number;
  winner_design_thumbnail: string | null;
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

export interface DesignTrashItem {
  id: string;
  design: string;
  file_name: string;
  thumbnail_url: string | null;
  deleted_by: number | null;
  deleted_by_email: string | null;
  deleted_at: string;
  expires_at: string;
}

// ---------------------------------------------------------------------------
// Paginated response
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
