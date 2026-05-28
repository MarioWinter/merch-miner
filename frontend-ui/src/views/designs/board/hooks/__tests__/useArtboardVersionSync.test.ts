import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useArtboardVersionSync, {
  type VersionSlot,
} from '../useArtboardVersionSync';
import type { ArtboardData, Design } from '../../types';

const makeArtboard = (overrides: Partial<ArtboardData> = {}): ArtboardData => ({
  id: 'ab-1',
  label: 'Artboard 1',
  x: 0,
  y: 0,
  width: 280,
  height: 280,
  imageUrl: null,
  kind: 'regular',
  sourceId: null,
  designId: 'd-1',
  opacity: 100,
  backgroundColor: '#FFFFFF',
  clipContent: true,
  layers: [],
  ...overrides,
});

const makeDesign = (overrides: Partial<Design> = {}): Design => ({
  id: 'd-1',
  workspace: 'ws-1',
  idea: 'idea-1',
  idea_summary: null,
  generation_run: null,
  image_file: '',
  status: 'approved',
  is_manual: false,
  background_color: 'light_gray',
  source_image_url: '',
  prompt_analysis: {},
  upscaled_file: '',
  bg_removed_file: '',
  processed_file: '',
  created_at: '2026-05-27T10:00:00Z',
  ...overrides,
});

const renderSync = (
  artboards: ArtboardData[],
  design: Design,
  userPickedVersions: Map<string, VersionSlot> = new Map(),
  optimisticArtboardUrls?: Map<string, string>,
) => {
  const updateArtboard = vi.fn();
  const designsById = new Map<string, Design>([[design.id, design]]);
  renderHook(() =>
    useArtboardVersionSync({
      artboards,
      designsById,
      userPickedVersions,
      updateArtboard,
      optimisticArtboardUrls,
    }),
  );
  return updateArtboard;
};

describe('useArtboardVersionSync', () => {
  it('resolves to upscaled_file when all 4 slots present and no user pick', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      processed_file: 'https://x.test/processed.png',
      bg_removed_file: 'https://x.test/bg.png',
      upscaled_file: 'https://x.test/upscaled.png',
    });
    const update = renderSync([makeArtboard({ imageUrl: null })], design);
    expect(update).toHaveBeenCalledWith('ab-1', {
      imageUrl: 'https://x.test/upscaled.png',
    });
  });

  it('falls back to bg_removed_file when upscaled_file is empty', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      processed_file: 'https://x.test/processed.png',
      bg_removed_file: 'https://x.test/bg.png',
      upscaled_file: '',
    });
    const update = renderSync([makeArtboard({ imageUrl: null })], design);
    expect(update).toHaveBeenCalledWith('ab-1', {
      imageUrl: 'https://x.test/bg.png',
    });
  });

  it('falls back to image_file when only original is present', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
    });
    const update = renderSync([makeArtboard({ imageUrl: null })], design);
    expect(update).toHaveBeenCalledWith('ab-1', {
      imageUrl: 'https://x.test/original.png',
    });
  });

  it('user pick overrides priority order', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      processed_file: 'https://x.test/processed.png',
      bg_removed_file: 'https://x.test/bg.png',
      upscaled_file: 'https://x.test/upscaled.png',
    });
    const picks = new Map<string, VersionSlot>([['d-1', 'original']]);
    const update = renderSync([makeArtboard({ imageUrl: null })], design, picks);
    expect(update).toHaveBeenCalledWith('ab-1', {
      imageUrl: 'https://x.test/original.png',
    });
  });

  it('does not call updateArtboard when resolved URL equals current imageUrl', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      upscaled_file: 'https://x.test/upscaled.png',
    });
    const update = renderSync(
      [makeArtboard({ imageUrl: 'https://x.test/upscaled.png' })],
      design,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('optimistic URL beats user pick', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      processed_file: 'https://x.test/processed.png',
      bg_removed_file: 'https://x.test/bg.png',
      upscaled_file: 'https://x.test/upscaled.png',
    });
    const picks = new Map<string, VersionSlot>([['d-1', 'original']]);
    const optimistic = new Map<string, string>([['ab-1', 'blob:fake/optimistic']]);
    const update = renderSync(
      [makeArtboard({ imageUrl: null })],
      design,
      picks,
      optimistic,
    );
    expect(update).toHaveBeenCalledWith('ab-1', {
      imageUrl: 'blob:fake/optimistic',
    });
  });

  it('optimistic URL beats auto-priority resolution', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      upscaled_file: 'https://x.test/upscaled.png',
    });
    const optimistic = new Map<string, string>([['ab-1', 'blob:fake/optimistic']]);
    const update = renderSync(
      [makeArtboard({ imageUrl: null })],
      design,
      new Map(),
      optimistic,
    );
    expect(update).toHaveBeenCalledWith('ab-1', {
      imageUrl: 'blob:fake/optimistic',
    });
  });
});
