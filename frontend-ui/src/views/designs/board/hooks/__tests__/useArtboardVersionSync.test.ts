import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import useArtboardVersionSync, {
  type VersionSlot,
} from '../useArtboardVersionSync';
import type { ArtboardData, CanvasElement, Design } from '../../types';

const makeImageLayer = (
  overrides: Partial<CanvasElement<'image'>> = {},
): CanvasElement<'image'> => ({
  id: 'img_d-1',
  type: 'image',
  x: 0,
  y: 0,
  width: 280,
  height: 280,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  locked: false,
  zIndex: 0,
  name: 'Image',
  ...overrides,
  props: {
    src: 'https://x.test/original.png',
    naturalWidth: 280,
    naturalHeight: 280,
    ...(overrides.props ?? {}),
  },
});

const makeTextLayer = (
  id = 'txt-1',
): CanvasElement<'text'> => ({
  id,
  type: 'text',
  x: 10,
  y: 10,
  width: 100,
  height: 40,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  locked: false,
  zIndex: 1,
  name: 'Text',
  props: {
    text: 'hello',
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: 400,
    fontStyle: 'normal',
    fill: '#000000',
    align: 'left',
    letterSpacing: 0,
    lineHeight: 1.2,
  },
});

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

// -----------------------------------------------------------------
// Layer-src patching (Items 1 + 3 — FIX-canvas-editor-bugs-and-image-gen)
// -----------------------------------------------------------------

describe('useArtboardVersionSync — layer src patching', () => {
  it('user pick → patches first image layer src + imageUrl in one call', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      processed_file: 'https://x.test/processed.png',
      bg_removed_file: 'https://x.test/bg.png',
      upscaled_file: 'https://x.test/upscaled.png',
    });
    const imgLayer = makeImageLayer({
      props: {
        src: 'https://x.test/original.png',
        naturalWidth: 280,
        naturalHeight: 280,
      },
    });
    const ab = makeArtboard({
      imageUrl: 'https://x.test/original.png',
      layers: [imgLayer],
    });
    const picks = new Map<string, VersionSlot>([['d-1', 'upscaled']]);
    const update = renderSync([ab], design, picks);

    expect(update).toHaveBeenCalledTimes(1);
    const [calledId, patch] = update.mock.calls[0];
    expect(calledId).toBe('ab-1');
    expect(patch.imageUrl).toBe('https://x.test/upscaled.png');
    expect(patch.layers).toBeDefined();
    const patchedLayers = patch.layers as CanvasElement[];
    expect(patchedLayers).toHaveLength(1);
    const patchedImg = patchedLayers[0] as CanvasElement<'image'>;
    expect(patchedImg.props.src).toBe('https://x.test/upscaled.png');
    // input layer object must not have been mutated
    expect(imgLayer.props.src).toBe('https://x.test/original.png');
  });

  it('auto-priority picks upscaled url and writes it into the image layer', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      upscaled_file: 'https://x.test/upscaled.png',
    });
    const imgLayer = makeImageLayer({
      props: {
        src: 'https://x.test/original.png',
        naturalWidth: 280,
        naturalHeight: 280,
      },
    });
    const ab = makeArtboard({
      imageUrl: 'https://x.test/original.png',
      layers: [imgLayer],
    });
    const update = renderSync([ab], design);

    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][1];
    expect(patch.imageUrl).toBe('https://x.test/upscaled.png');
    const patchedImg = (patch.layers as CanvasElement[])[0] as CanvasElement<'image'>;
    expect(patchedImg.props.src).toBe('https://x.test/upscaled.png');
  });

  it('delete currently-displayed slot → layer src follows the fallback slot', () => {
    // User picked `upscaled`. After deletion the design no longer carries
    // `upscaled_file`; auto-priority should resolve to `bg_removed` next.
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      bg_removed_file: 'https://x.test/bg.png',
      upscaled_file: '',
    });
    const imgLayer = makeImageLayer({
      props: {
        src: 'https://x.test/upscaled.png',
        naturalWidth: 280,
        naturalHeight: 280,
      },
    });
    const ab = makeArtboard({
      imageUrl: 'https://x.test/upscaled.png',
      layers: [imgLayer],
    });
    // No active user pick — picker cleared its pick when the slot was deleted.
    const update = renderSync([ab], design);

    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][1];
    expect(patch.imageUrl).toBe('https://x.test/bg.png');
    const patchedImg = (patch.layers as CanvasElement[])[0] as CanvasElement<'image'>;
    expect(patchedImg.props.src).toBe('https://x.test/bg.png');
  });

  it('optimistic override → layer src follows the optimistic url', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      upscaled_file: 'https://x.test/upscaled.png',
    });
    const imgLayer = makeImageLayer({
      props: {
        src: 'https://x.test/original.png',
        naturalWidth: 280,
        naturalHeight: 280,
      },
    });
    const ab = makeArtboard({
      imageUrl: 'https://x.test/original.png',
      layers: [imgLayer],
    });
    const optimistic = new Map<string, string>([['ab-1', 'blob:fake/optimistic']]);
    const update = renderSync([ab], design, new Map(), optimistic);

    expect(update).toHaveBeenCalledTimes(1);
    const patch = update.mock.calls[0][1];
    expect(patch.imageUrl).toBe('blob:fake/optimistic');
    const patchedImg = (patch.layers as CanvasElement[])[0] as CanvasElement<'image'>;
    expect(patchedImg.props.src).toBe('blob:fake/optimistic');
  });

  it('no image layer present → only imageUrl is patched, layers key omitted', () => {
    const design = makeDesign({
      image_file: 'https://x.test/original.png',
      upscaled_file: 'https://x.test/upscaled.png',
    });
    // Only a text layer — no image layer at all.
    const ab = makeArtboard({
      imageUrl: null,
      layers: [makeTextLayer('txt-only')],
    });
    const update = renderSync([ab], design);

    expect(update).toHaveBeenCalledTimes(1);
    const [calledId, patch] = update.mock.calls[0];
    expect(calledId).toBe('ab-1');
    expect(patch.imageUrl).toBe('https://x.test/upscaled.png');
    expect('layers' in patch).toBe(false);
  });
});
