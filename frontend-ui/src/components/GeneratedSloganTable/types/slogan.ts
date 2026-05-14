/**
 * PROJ-29 Phase 1H-2 — per-row UI status for the slogan table.
 *
 * The canonical `SloganRow` data type (mirroring `Idea` model 1:1) lives in
 * `@/types/chat-rag` because it's also the SSE event payload shape — re-exporting
 * here keeps consumers within the component scope.
 */
export type { SloganRow } from '@/types/chat-rag';

export type RowStatus =
  | 'idle'
  | 'loading'
  | 'added'
  | 'duplicate'
  | 'error'
  | 'copied';
