// PROJ-17: Deep Web Search types

export type SearchMode = 'speed' | 'balanced' | 'quality';
export type SearchSource = 'web' | 'academic' | 'discussions';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType =
  | 'search_query'
  | 'search_result'
  | 'crawl_request'
  | 'crawl_result'
  | 'agent_message';
export type CrawlStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ContentType = 'snippet' | 'full_crawl';

export interface ChatTag {
  id: string;
  name: string;
  color: string;
  is_system: boolean;
  created_at: string;
}

export interface ChatSessionNicheContext {
  id: string;
  name: string;
}

export interface ChatSession {
  id: string;
  title: string;
  is_shared: boolean;
  niche_context: ChatSessionNicheContext | null;
  tags: ChatTag[];
  message_count: number;
  shared_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SourceItem {
  title: string;
  url: string;
  snippet: string;
}

export interface ChatMessage {
  id: string;
  session: string;
  role: MessageRole;
  content: string;
  message_type: MessageType;
  sources: SourceItem[];
  search_mode: SearchMode | null;
  search_sources: SearchSource[] | null;
  model_used: string;
  created_at: string;
}

export interface WebSearchResult {
  id: string;
  workspace: string;
  chat_message: string | null;
  url: string;
  title: string;
  content: string;
  content_type: ContentType;
  crawl_status: CrawlStatus;
  error_message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SearchHealth {
  vane: 'online' | 'offline';
  crawl4ai: 'online' | 'offline';
}

export interface ChatSessionListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ChatSession[];
}

export interface ChatSessionDetail extends ChatSession {
  messages: ChatMessage[];
}

export interface CreateSessionBody {
  niche_context?: string;
  title?: string;
}

export interface SendMessageBody {
  content: string;
  search_mode?: SearchMode;
  search_sources?: SearchSource[];
  model?: string;
}

export interface TriggerCrawlBody {
  url: string;
  chat_message_id?: string;
}

export interface SaveToNicheBody {
  niche_id: string;
  save_as: 'keywords' | 'notes';
}

export interface CreateTagBody {
  name: string;
  color: string;
}

export interface UpdateSessionBody {
  tag_ids?: string[];
  title?: string;
}

export interface SessionListParams {
  shared?: boolean;
  niche_id?: string;
  tag_id?: string;
  page?: number;
  page_size?: number;
}

export type DrawerPanel = 'niche' | 'chat' | 'search' | 'agent';
