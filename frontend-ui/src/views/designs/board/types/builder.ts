// PROJ-34 Phase 8 — shared types for the renovated Multi-Prompt Builder.
// Matches the backend BuilderBuildSerializer (slogans, styles,
// background_color, with_polish, include_niche_context). Phase 13k removed
// the legacy `warp` field.

import type { StyleEntry } from '../constants/styleLibrary';

export type BackgroundColorSlug = 'light_gray' | 'neon_pink' | 'neon_green';

// PROJ-34 Phase 13e — form-based Architect Builder slots.
// `spatial_configuration` accepts either a built-in id from
// `SPATIAL_OPTIONS` (Appendix J.4), a `CustomSpatial` UUID, or raw free-text
// the user typed. The renderer in 13g picks the right code path.
export type SpatialSlot = string;

export interface BuilderSlots {
  spatial_configuration?: SpatialSlot;
  visual_description?: string;
  typography_adjectives?: string;
  /**
   * Phase 13l — optional multi-font hierarchy. When set, the backend
   * silences `typography_adjectives` (the combo sentence carries the
   * full typographic anatomy). See `_resolve_slot` in prompt_builder.py.
   */
  font_combination?: string;
  /** Multi-select on the UI; persisted as a `', '`-joined string for the backend. */
  accessories?: string;
  style_dna?: string;
  extra_context?: string;
}

export interface BuilderConfig {
  selectedSloganIds: string[];
  freeTextSlogans: string;
  selectedStyleSlugs: string[];
  includeNicheContext: boolean;
  // Phase 13e — form-based Architect slots. Optional + always present so
  // existing v1 presets without the field load cleanly (EC-25).
  slots: BuilderSlots;
}

// Phase 13t-u: visual_description seeds with the template skeleton so the
// user sees the structure inline (no longer just a ghost-text placeholder).
// They are expected to replace the bracketed tokens with concrete details.
export const DEFAULT_VISUAL_DESCRIPTION =
  'a stylized illustration of [SUBJECT] in [PERSPECTIVE], featuring [6+ concrete details: colors, body parts, accessories, pose, line weight]';

export const EMPTY_BUILDER_CONFIG: BuilderConfig = {
  selectedSloganIds: [],
  freeTextSlogans: '',
  selectedStyleSlugs: [],
  // Phase 13t-u: niche-context starts OFF. User opts in via the toggle when
  // they explicitly want builder_form_hints from the niche to fill empty slots.
  includeNicheContext: false,
  slots: {
    visual_description: DEFAULT_VISUAL_DESCRIPTION,
  },
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
