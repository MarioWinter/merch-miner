import { describe, it, expect } from 'vitest';
import { getSupportedAspectRatios, MODEL_SUPPORTED_RATIOS } from '../constants';
import type { DesignModel } from '../types';

describe('getSupportedAspectRatios', () => {
  it('returns only the 3 OpenAI-native ratios for gpt-5.4-image-2', () => {
    const ratios = getSupportedAspectRatios('openai/gpt-5.4-image-2');
    expect(ratios).toEqual(['1:1', '3:2', '2:3']);
  });

  it('returns only the 3 OpenAI-native ratios for gpt-5-image', () => {
    const ratios = getSupportedAspectRatios('openai/gpt-5-image');
    expect(ratios).toEqual(['1:1', '3:2', '2:3']);
  });

  it('returns only the 3 OpenAI-native ratios for gpt-5-image-mini', () => {
    const ratios = getSupportedAspectRatios('openai/gpt-5-image-mini');
    expect(ratios).toEqual(['1:1', '3:2', '2:3']);
  });

  it('returns the full 8-ratio set for gemini-3.1-flash', () => {
    const ratios = getSupportedAspectRatios(
      'google/gemini-3.1-flash-preview-image-generation',
    );
    expect(ratios).toEqual(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '5:6']);
  });

  it('returns the full 8-ratio set for gemini-3-pro', () => {
    const ratios = getSupportedAspectRatios(
      'google/gemini-3-pro-preview-image-generation',
    );
    expect(ratios).toHaveLength(8);
  });

  it('returns the full 8-ratio set for gemini-2.5-flash', () => {
    const ratios = getSupportedAspectRatios(
      'google/gemini-2.5-flash-preview-image-generation',
    );
    expect(ratios).toHaveLength(8);
  });

  it('returns the full 8-ratio set for flux.2-max', () => {
    const ratios = getSupportedAspectRatios('black-forest-labs/flux.2-max');
    expect(ratios).toEqual(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '5:6']);
  });

  it('returns the full 8-ratio set for flux.2-klein-4b', () => {
    const ratios = getSupportedAspectRatios('black-forest-labs/flux.2-klein-4b');
    expect(ratios).toHaveLength(8);
  });

  it('returns the full 8-ratio set for flux.2-flex', () => {
    const ratios = getSupportedAspectRatios('black-forest-labs/flux.2-flex');
    expect(ratios).toHaveLength(8);
  });

  it('returns the full 8-ratio set for flux.2-pro', () => {
    const ratios = getSupportedAspectRatios('black-forest-labs/flux.2-pro');
    expect(ratios).toHaveLength(8);
  });

  it('returns the full 8-ratio set for an unknown model id (safe fallback)', () => {
    const ratios = getSupportedAspectRatios('totally/unknown-model' as DesignModel);
    expect(ratios).toEqual(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '5:6']);
  });

  it('MODEL_SUPPORTED_RATIOS covers every DesignModel in the union', () => {
    // Sanity: 10 model ids declared in the DesignModel union as of writing.
    expect(Object.keys(MODEL_SUPPORTED_RATIOS)).toHaveLength(10);
  });
});
