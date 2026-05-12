/**
 * PROJ-29 Phase 1H — ThinkingStrip-local types.
 *
 * Re-exports `ThinkingStep` + `ChunkUsed` from the cross-cutting `chat-rag`
 * module so consumers within ThinkingStrip have a single import surface.
 * `StageMeta` is the icon/i18n descriptor returned by `utils/stageMeta.ts`.
 */
import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material';

export type { ThinkingStep, ChunkUsed, ChunkSubtype } from '@/types/chat-rag';

/** Resolved descriptor for one pipeline stage — drives icon + label rendering. */
export interface StageMeta {
  /** MUI icon component (no instance — caller renders `<Icon fontSize="small" />`). */
  Icon: ComponentType<SvgIconProps>;
  /** i18n key under `chatNicheRag.thinking.stage.<name>`. */
  i18nKey: string;
  /** Optional grouping emoji used in ExpandedPanel (slogan/product/keyword/notes/web). */
  groupEmoji?: string;
}
