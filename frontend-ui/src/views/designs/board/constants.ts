import type { DesignModel } from './types';
import type { AspectRatio } from './partials/GenerationZone';

/**
 * Models that support multimodal input (image + text prompt).
 * Must stay in sync with backend MULTIMODAL_MODELS in image_generator.py.
 */
export const MULTIMODAL_MODELS: ReadonlySet<DesignModel> = new Set<DesignModel>([
  'openai/gpt-5.4-image-2',
  'google/gemini-3.1-flash-preview-image-generation',
  'google/gemini-3-pro-preview-image-generation',
  'google/gemini-2.5-flash-preview-image-generation',
  'openai/gpt-5-image',
  'openai/gpt-5-image-mini',
  // FLUX.2 family — all support text + image input (editing)
  'black-forest-labs/flux.2-klein-4b',
  'black-forest-labs/flux.2-max',
  'black-forest-labs/flux.2-flex',
  'black-forest-labs/flux.2-pro',
]);

/** Default model selected when the workspace opens. */
export const DEFAULT_DESIGN_MODEL: DesignModel = 'openai/gpt-5.4-image-2';

/** Check whether a model supports multimodal (image) input. */
export const isMultimodalModel = (model: DesignModel): boolean =>
  MULTIMODAL_MODELS.has(model);

// -----------------------------------------------------------------
// Per-model aspect-ratio support
// -----------------------------------------------------------------

// All 8 aspect ratios currently in ASPECT_RATIO_OPTIONS.
const ALL_RATIOS: readonly AspectRatio[] = [
  '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '5:6',
];

// OpenAI image-gen accepts only 3 fixed sizes (1024², 1024×1536, 1536×1024).
// We surface ONLY the ratios that map cleanly to those sizes — anything else
// would be snapped server-side via `_openai_size_for_dims` and the user
// might be surprised by the result. Hide them from the dropdown.
const OPENAI_NATIVE_RATIOS: readonly AspectRatio[] = ['1:1', '3:2', '2:3'];

/**
 * Per-model whitelist of aspect ratios surfaced in the Generation panel.
 *
 * Gemini ignores size params entirely; we inject a text directive into the
 * prompt instead. Honoring is best-effort and not pixel-accurate, but the
 * FULL set is at least "accepted" — so show all + add no visual filter.
 * Same applies to FLUX.2 / Seedream / Flux 1.1 (honor arbitrary dims).
 */
export const MODEL_SUPPORTED_RATIOS: Record<DesignModel, readonly AspectRatio[]> = {
  'openai/gpt-5-image':                                OPENAI_NATIVE_RATIOS,
  'openai/gpt-5-image-mini':                           OPENAI_NATIVE_RATIOS,
  'openai/gpt-5.4-image-2':                            OPENAI_NATIVE_RATIOS,
  'google/gemini-3.1-flash-preview-image-generation':  ALL_RATIOS,
  'google/gemini-3-pro-preview-image-generation':      ALL_RATIOS,
  'google/gemini-2.5-flash-preview-image-generation':  ALL_RATIOS,
  'black-forest-labs/flux.2-klein-4b':                 ALL_RATIOS,
  'black-forest-labs/flux.2-max':                      ALL_RATIOS,
  'black-forest-labs/flux.2-flex':                     ALL_RATIOS,
  'black-forest-labs/flux.2-pro':                      ALL_RATIOS,
};

/**
 * Returns the supported aspect ratios for the given model. Falls back to the
 * full set when the model id is unknown (safe default — caller never gets
 * an empty list).
 */
export const getSupportedAspectRatios = (model: DesignModel): readonly AspectRatio[] =>
  MODEL_SUPPORTED_RATIOS[model] ?? ALL_RATIOS;
