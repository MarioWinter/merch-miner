// PROJ-34 Phase 13t-h — TypeScript types for Niche-Reference Preset Picker.
//
// Source-of-truth: mirror the backend DRF serializers + viewset response shapes
// verbatim:
//   - NicheCardPresetSerializer  (django-app/design_app/api/serializers.py:1058)
//   - PresetConfirmSerializer    (...:1119)
//   - PresetRegenerateSerializer (...:1170)
//   - NicheCardPresetViewSet     (django-app/design_app/api/views.py:2591)
//
// IMPORTANT: top-cards (`top` array in VorschlaegeResponse) and best-of-mix
// variants use a FLAT dict shape (NichePresetTopCardDict), not the nested
// serializer shape — they're computed in-memory by `build_top_card_preset`
// and `_mix_payload` and never persisted unless the user confirms.

export type NichePresetSourceCardType =
  | 'top'
  | 'mix_most_common'
  | 'mix_edgy'
  | 'mix_safe';

export interface NichePresetSourceRef {
  niche_id: string;
  product_ids: string[];
}

export interface NichePresetSlotValues {
  spatial_configuration: string;
  visual_description: string;
  typography_adjectives: string;
  font_combination: string;
  accessories: string;
  style_dna: string;
  extra_context: string;
}

export interface NichePresetSlotIsRawFlags {
  spatial_configuration: boolean;
  visual_description: boolean;
  typography_adjectives: boolean;
  font_combination: boolean;
  accessories: boolean;
  style_dna: boolean;
  extra_context: boolean;
}

export interface NichePresetSourceMeta {
  card_type: NichePresetSourceCardType;
  references: NichePresetSourceRef[];
}

/** Nested serializer shape — used by /history/, /custom/, /confirm/, /promote-custom/. */
export interface NichePresetCard {
  id: string;
  preset_label: string;
  preset_hash: string;
  slots: NichePresetSlotValues;
  raw_flags: NichePresetSlotIsRawFlags;
  source: NichePresetSourceMeta;
  reference_thumbnail_url: string;
  is_in_history: boolean;
  is_in_custom: boolean;
  custom_promoted_by: string | number | null;
  custom_promoted_at: string | null;
  last_clicked_at: string;
  created_at: string;
}

/** Flat in-memory dict shape returned by build_top_card_preset + _mix_payload.
 *  Keys mirror NicheCardPreset model fields 1:1 so the confirm endpoint can
 *  persist via `**unpack`. */
export interface NichePresetTopCardDict {
  slot_spatial_configuration: string;
  slot_visual_description: string;
  slot_typography_adjectives: string;
  slot_font_combination: string;
  slot_accessories: string;
  slot_style_dna: string;
  slot_extra_context: string;
  spatial_is_raw: boolean;
  visual_is_raw: boolean;
  typography_is_raw: boolean;
  font_combination_is_raw: boolean;
  accessories_is_raw: boolean;
  style_dna_is_raw: boolean;
  extra_context_is_raw: boolean;
  reference_thumbnail_url: string;
  preset_label: string;
  source_card_type: NichePresetSourceCardType;
  source_card_references: NichePresetSourceRef[];
}

export interface BestOfMixGroup {
  most_common: NichePresetTopCardDict | null;
  edgy: NichePresetTopCardDict | null;
  safe: NichePresetTopCardDict | null;
}

export interface VorschlaegeResponse {
  top: NichePresetTopCardDict[];
  best_of_mix: BestOfMixGroup;
  top3_product_ids: string[];
}

/** Body for POST /api/designs/preset-cards/confirm/.
 *  Exactly one of `preset_id` OR (`preset_dict` + `source_card_type` + `source_refs`). */
export interface PresetConfirmRequest {
  preset_id?: string;
  preset_dict?: NichePresetTopCardDict;
  source_card_type?: NichePresetSourceCardType;
  source_refs?: NichePresetSourceRef[];
}

export interface PresetRegenerateRequest {
  niche_id: string;
}

/** Response of POST /api/designs/preset-cards/regenerate-mix/ — raw cache_payload. */
export interface PresetRegenerateResponse {
  most_common: NichePresetTopCardDict | null;
  edgy: NichePresetTopCardDict | null;
  safe: NichePresetTopCardDict | null;
  top3_product_ids: string[];
  _generated_at?: string;
  _source_research_id?: string;
}
