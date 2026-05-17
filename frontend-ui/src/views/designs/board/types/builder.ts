// PROJ-34 Phase 8 — shared types for the renovated Multi-Prompt Builder.
// Matches the backend BuilderBuildSerializer (slogans, styles, warp,
// background_color, with_polish, include_niche_context).

import type { StyleEntry } from '../constants/styleLibrary';

export type BackgroundColorSlug = 'light_gray' | 'neon_pink' | 'neon_green';

export interface BuilderConfig {
  selectedSloganIds: string[];
  freeTextSlogans: string;
  selectedStyleSlugs: string[];
  warpSlug: string | null;
  includeNicheContext: boolean;
}

export const EMPTY_BUILDER_CONFIG: BuilderConfig = {
  selectedSloganIds: [],
  freeTextSlogans: '',
  selectedStyleSlugs: [],
  warpSlug: null,
  includeNicheContext: true,
};

// Threshold past which a confirm dialog blocks Build (AC-35).
export const BUILD_CONFIRM_THRESHOLD = 30;

export interface BuilderPresetSummary {
  id: string;
  name: string;
  config: BuilderConfig;
}

export interface BuilderBuildRequest {
  slogans: string[];
  styles: string[];
  warp: string | null;
  background_color: BackgroundColorSlug;
  with_polish: boolean;
  include_niche_context: boolean;
}

export interface NicheContextReason {
  disabled: boolean;
  // i18n key suffix, or null when the toggle is enabled.
  reasonKey: 'noNiche' | 'noResearch' | null;
}

// Re-export so consumers only need to import from this types barrel.
export type { StyleEntry };
