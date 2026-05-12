/**
 * PROJ-29 Phase 1H — types for the niche-RAG ThinkingStrip + chunks_used + SSE.
 *
 * These types model the live state of an agent turn:
 *   - ThinkingStep: one row of the strip (one stage / tool call).
 *   - ChunkUsed:    one retrieved chunk grouped under its content_subtype.
 *   - StageStatus:  loading | done | warning | error — drives the StepRow icon.
 *
 * SSE event shapes are typed here so `useSendMessageStream` can `parseEventData<...>`
 * each event without inline anonymous types.
 */

/** Status for a ThinkingStrip step row. */
export type StageStatus = 'loading' | 'done' | 'warning' | 'error';

/**
 * One row of the ThinkingStrip — emitted by SSE `stage` / `tool_call` / `tool_result`.
 * `stage` is the stable identifier (e.g. `retrieve_niche`, `web_search`); the i18n
 * label is resolved at render time via `utils/stageMeta.ts`.
 */
export interface ThinkingStep {
  /** Stable stage identifier — used as React key and i18n lookup. */
  stage: string;
  status: StageStatus;
  /** ms-epoch timestamp captured at push-time — drives duration math. */
  ts: number;
  /** Optional duration in ms once the step transitions to done/warning/error. */
  durationMs?: number;
  /** Optional message (e.g. tool_timeout error text). */
  message?: string;
}

/**
 * One retrieved chunk grouped under its content_subtype (slogan/product/keyword/notes/web).
 * Matches the backend `event: chunks_used` payload entries.
 */
export interface ChunkUsed {
  /** Index in the consolidated chunks list — drives [NICHE:N] citation markers. */
  index: number;
  /** One of `slogan` | `product` | `keyword` | `notes` | `web`. */
  content_subtype: ChunkSubtype;
  /** Human-readable snippet (first ~200 chars). */
  text: string;
  /** Optional source PK (Idea id / NicheNote id / AmazonProduct id). */
  source_pk?: string;
  /** Optional URL — only set for web chunks. */
  url?: string;
  /** Optional fused RRF score 0..1. */
  score?: number;
}

export type ChunkSubtype = 'slogan' | 'product' | 'keyword' | 'notes' | 'web';

/**
 * Flash-citation pub/sub payload — written when the user hovers a [NICHE:N]
 * marker so the matching ExpandedPanel row can flash, and vice-versa.
 * Reset to `null` after the flash animation completes (~600ms).
 */
export interface FlashCitation {
  type: 'niche' | 'web';
  index: number;
  /** Timestamp used to retrigger the flash even when index doesn't change. */
  ts: number;
}

// ---- SSE event payloads (PROJ-29 Phase 1E protocol additions) ----

export interface SSEStageEvent {
  stage: string;
}

export interface SSEHeartbeatEvent {
  elapsed_ms: number;
}

export interface SSEToolCallEvent {
  tool_name: string;
  /** Optional preview of tool arguments — opaque string, displayed in expanded panel. */
  args_preview?: string;
}

export interface SSEToolResultEvent {
  tool_name: string;
  duration_ms: number;
  /** Optional preview of the tool result — opaque string. */
  output_preview?: string;
}

export interface SSEToolTimeoutEvent {
  tool_name: string;
  error: string;
  duration_ms: number;
}

export interface SSEChunksUsedEvent {
  chunks: ChunkUsed[];
}

export interface SSEFollowUpsEvent {
  chips: string[];
}

/**
 * Structured payload for the `generate_slogans` tool. Matches `Idea` model fields
 * 1:1 so the frontend `useAddSloganToNiche` hook can save without translation.
 * The full row shape lives in Phase 1H-2 (`types/slogan.ts`); here we only
 * declare the SSE-event wrapper so 1H-1 can store the payload opaque-ly until
 * the table component lands.
 */
export interface SSEGenerateSlogansPayloadEvent {
  rows: unknown[];
  warnings?: string[];
}
