import type { DesignModel } from './types';

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
]);

/** Default model selected when the workspace opens. */
export const DEFAULT_DESIGN_MODEL: DesignModel = 'openai/gpt-5.4-image-2';

/** Check whether a model supports multimodal (image) input. */
export const isMultimodalModel = (model: DesignModel): boolean =>
  MULTIMODAL_MODELS.has(model);
