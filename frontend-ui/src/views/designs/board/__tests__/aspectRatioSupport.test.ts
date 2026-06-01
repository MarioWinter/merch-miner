import { describe, it, expect } from 'vitest';
import { getSupportedAspectRatios, MODEL_SUPPORTED_RATIOS } from '../constants';
import type { DesignModel } from '../types';

describe('getSupportedAspectRatios', () => {
  it('returns the full 8-ratio set for gpt-5.4-image-2 (OpenAI ignores size; honesty over filtering)', () => {
    const ratios = getSupportedAspectRatios('openai/gpt-5.4-image-2');
    // Verified empirically 2026-05-31: OpenAI's chat-completion-style
    // image endpoint silently ignores size params and always returns
    // 1024×1024 regardless of what we send. The full set is therefore
    // surfaced — no point in pretending 3 ratios are "officially supported"
    // when none of them are honoured via this API path. Text-directive
    // workaround applies (best-effort).
    expect(ratios).toEqual([
      '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '5:6',
    ]);
  });

  it('returns the full 8-ratio set for gpt-5-image (size ignored by endpoint)', () => {
    const ratios = getSupportedAspectRatios('openai/gpt-5-image');
    // Verified empirically 2026-05-31: OpenAI's chat-completion-style
    // image endpoint silently ignores size params and always returns
    // 1024×1024 regardless of what we send. The full set is therefore
    // surfaced — no point in pretending 3 ratios are "officially supported"
    // when none of them are honoured via this API path. Text-directive
    // workaround applies (best-effort).
    expect(ratios).toEqual([
      '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '5:6',
    ]);
  });

  it('returns the full 8-ratio set for gpt-5-image-mini (size ignored by endpoint)', () => {
    const ratios = getSupportedAspectRatios('openai/gpt-5-image-mini');
    // Verified empirically 2026-05-31: OpenAI's chat-completion-style
    // image endpoint silently ignores size params and always returns
    // 1024×1024 regardless of what we send. The full set is therefore
    // surfaced — no point in pretending 3 ratios are "officially supported"
    // when none of them are honoured via this API path. Text-directive
    // workaround applies (best-effort).
    expect(ratios).toEqual([
      '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '5:6',
    ]);
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
