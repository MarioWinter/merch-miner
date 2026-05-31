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

/**
 * Per-model whitelist of aspect ratios surfaced in the Generation panel.
 *
 * Honesty note (verified empirically 2026-05-31): when these models are
 * called via OpenRouter's chat-completion-style image endpoint (which we
 * use for everything via the `messages` payload shape), BOTH Gemini AND
 * OpenAI silently ignore size/width/height params and fall back to 1024².
 * Our only signal that works is the text-directive injected by
 * `_aspect_ratio_instruction` in the backend — best-effort, not pixel-
 * accurate. FLUX.2 / Seedream go through a different param branch and
 * honour width/height natively.
 *
 * Therefore: ALL families get the full set in the dropdown. Filtering
 * OpenAI to "officially supported" sizes would falsely imply those 3
 * work better than the others — they don't. For pixel-accurate ratios
 * the user should pick a FLUX.2 model (badge / hint pending future UX).
 */
export const MODEL_SUPPORTED_RATIOS: Record<DesignModel, readonly AspectRatio[]> = {
  'openai/gpt-5-image':                                ALL_RATIOS,
  'openai/gpt-5-image-mini':                           ALL_RATIOS,
  'openai/gpt-5.4-image-2':                            ALL_RATIOS,
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
