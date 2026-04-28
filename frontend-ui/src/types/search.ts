// PROJ-17: Deep Web Search types

export type SearchMode = 'speed' | 'balanced' | 'quality';
export type SearchSource = 'web' | 'academic' | 'discussions';
/**
 * PROJ-20 refactor (2026-04-28): user-driven simplification — Mode is now a
 * binary surface (`chat` ↔ `agent`) bidirectionally bound to the drawer Tabs.
 * The legacy `'auto'` LLM-classifier routing is gone from the frontend; the
 * backend SSE endpoint still accepts the old enum (`web_search` / `agent`),
 * so the wire mapping happens at submit time:
 *   - `'chat'`  → backend `'web_search'`
 *   - `'agent'` → backend `'agent'`
 */
export type ModeOverride = 'chat' | 'agent';
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageType =
  | 'search_query'
  | 'search_result'
  | 'crawl_request'
  | 'crawl_result'
  | 'workflow_trigger'
  | 'workflow_card';

/** Nested agent_session payload on workflow-card ChatMessages — matches backend ChatMessageSerializer.get_agent_session. */
export interface ChatMessageAgentSessionRef {
  id: string;
  status:
    | 'idle'
    | 'running'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'cancelled';
  current_step: string;
  completed_steps: number;
  total_steps: number;
}
export type CrawlStatus = 'pending' | 'running' | 'completed' | 'failed';
export type ContentType = 'snippet' | 'full_crawl';

export interface ChatSessionNicheContext {
  id: string;
  name: string;
}

export interface ChatSession {
  id: string;
  title: string;
  is_shared: boolean;
  niche_context: ChatSessionNicheContext | null;
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
  agent_session: ChatMessageAgentSessionRef | null;
  /** PROJ-20 Phase 7.6 — image attachments uploaded with this message
   *  (only populated for `role='user'`; older messages may have []). */
  attachments?: ChatAttachment[];
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
  mode_override?: ModeOverride;
}

export interface TriggerCrawlBody {
  url: string;
  chat_message_id?: string;
}

export interface SaveToNicheBody {
  niche_id: string;
  save_as: 'keywords' | 'notes';
  /** PROJ-17 AC-50–53: user-selected text snippet from chat bubble or crawled content. */
  selected_text?: string;
}

/** PROJ-17 AC-50–53: payload for POST /api/niches/{niche_id}/save-snippet/ */
export interface SaveSnippetBody {
  selected_text: string;
  save_as: 'keywords' | 'notes';
  /** Optional source page URL — only stored on NicheNote, ignored for keywords. */
  source_url?: string | null;
}

/** Backend response for save-snippet (keywords). 201 if created>0, 200 if all skipped. */
export interface SaveSnippetKeywordsResponse {
  created: number;
  skipped: number;
}

/** Backend response for save-snippet (notes). Always 201. */
export interface SaveSnippetNotesResponse {
  note_id: string;
  created: 1;
}

export type SaveSnippetResponse = SaveSnippetKeywordsResponse | SaveSnippetNotesResponse;

export interface UpdateSessionBody {
  title?: string;
}

export interface SessionListParams {
  shared?: boolean;
  niche_id?: string;
  page?: number;
  page_size?: number;
}

export type DrawerPanel = 'niche' | 'chat' | 'agent';

// PROJ-17 Phase 4: SSE streaming event payloads (matches backend StreamingHttpResponse)

export interface SSEInitEvent {
  message_id: string;
  session_id: string;
  mode: string;
  /** PROJ-20 Phase 7 — Vision branch only. Effective model id used for the
   *  reply when attachments are present. */
  model_used?: string;
  /** True when the user's selected model wasn't vision-capable and the
   *  backend swapped in `AppSettings.vision_model` for this message. */
  vision_fallback?: boolean;
}

export interface SSESourcesEvent {
  sources: SourceItem[];
}

export interface SSEChunkEvent {
  text: string;
}

export interface SSEDoneEvent {
  message_id: string;
  total_tokens: number;
}

export interface SSEErrorEvent {
  error: string;
}

// PROJ-20 Phase 1.3 / Phase 2: share-link + public-fetch payloads

/** Response from POST /api/chat/sessions/{id}/share/ — returns the (idempotent) share token + absolute URL. */
export interface CreateShareLinkResponse {
  id: string;
  is_shared: boolean;
  share_token: string;
  public_url: string;
}

/** Read-only message shape returned by GET /api/chat/sessions/shared/{token}/ (PublicChatMessageSerializer). */
export interface PublicChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  message_type: MessageType;
  sources: SourceItem[];
  model_used: string;
  created_at: string;
}

/** Read-only session payload returned by GET /api/chat/sessions/shared/{token}/ (PublicChatSessionSerializer). */
export interface PublicChatSession {
  id: string;
  title: string;
  niche_context_name: string | null;
  messages: PublicChatMessage[];
  created_at: string;
  updated_at: string;
}

// PROJ-20 Phase 7 — chat image attachments

export type ChatAttachmentStatus = 'uploading' | 'completed' | 'failed';

/** Server response shape from POST /api/chat/attachments/ + the attachment list rendered in chat history. */
export interface ChatAttachment {
  id: string;
  filename: string;
  mime_type: string;
  size: number;
  thumbnail_url: string | null;
  attachment_type: 'image';
  status: 'completed' | 'purged';
  created_at: string;
  purged_at: string | null;
}

/** Local upload-tracking entry. Keyed by a per-upload UUID generated client-side
 *  so we can render the card before the server returns the real id. */
export interface AttachmentUpload {
  /** Local id (`uploading.${uuid}`) until completion swap. */
  localId: string;
  /** Server id once the upload completes. Null while in flight or on failure. */
  serverId: string | null;
  filename: string;
  mime_type: string;
  size: number;
  /** Local data-url preview while uploading; replaced by server URL on completion. */
  thumbnail_url: string | null;
  status: ChatAttachmentStatus;
  /** Last error message if status === 'failed'. */
  error?: string;
}
