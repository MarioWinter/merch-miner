/**
 * Pica.js upscale types and constants.
 * The actual processing function lives in `../utils/imageProcessing.ts` (processPicaUpscale).
 * This module re-exports types used by the UpscaleToolParams component.
 */

export type { PicaUpscaleParams } from '../utils/imageProcessing';
export { DEFAULT_PICA_UPSCALE_PARAMS } from '../utils/imageProcessing';

export type UpscaleFilter = 'lanczos3' | 'lanczos2' | 'mks2013';

/** Threshold in px — images >= this on either axis use Pica (client) */
export const PICA_THRESHOLD_PX = 3000;

export type UpscaleMode = 'auto' | 'client' | 'server';
