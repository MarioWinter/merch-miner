/**
 * FIX-canvas-editor-bugs-and-image-gen — Item 4 reflex hook tests.
 *
 * Covers AC-4-1 / AC-4-3 / AC-4-5 + EC-4-1 / EC-4-3 / EC-4-4 / EC-4-5.
 * The cap-to-2 + once-per-session warning is the contract of
 * `useWorkspaceGeneration.handleUseSelectionAsReferences` (not this reflex
 * hook), so this test asserts that this hook simply forwards the full
 * filtered list and leaves capping to the consumer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useSelectionDrivenImageGen from '../useSelectionDrivenImageGen';
import type { ArtboardData, GenerationMode } from '../../../board/types';

// -----------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------

const makeArtboard = (overrides: Partial<ArtboardData> = {}): ArtboardData => ({
  id: 'ab-1',
  label: 'Artboard 1',
  x: 0,
  y: 0,
  width: 280,
  height: 280,
  imageUrl: 'https://x.test/img.png',
  kind: 'ai',
  sourceId: null,
  designId: 'd-1',
  opacity: 100,
  backgroundColor: '#FFFFFF',
  clipContent: true,
  layers: [],
  ...overrides,
});

interface RenderArgs {
  selectedIds: Set<string>;
  artboards: ArtboardData[];
  generationMode?: GenerationMode;
  generationModeSource?: 'auto' | 'manual';
  isGenerationInFlight?: boolean;
}

const mountHook = ({
  selectedIds,
  artboards,
  generationMode = 'text_to_image',
  generationModeSource = 'manual',
  isGenerationInFlight = false,
}: RenderArgs) => {
  const handleUseSelectionAsReferences = vi.fn();
  const revertToTextToImage = vi.fn();
  const rendered = renderHook(
    ({ ids, abs, mode, src, inFlight }) =>
      useSelectionDrivenImageGen({
        selectedIds: ids,
        artboards: abs,
        generationMode: mode,
        generationModeSource: src,
        isGenerationInFlight: inFlight,
        handleUseSelectionAsReferences,
        revertToTextToImage,
      }),
    {
      initialProps: {
        ids: selectedIds,
        abs: artboards,
        mode: generationMode,
        src: generationModeSource,
        inFlight: isGenerationInFlight,
      },
    },
  );
  return { rendered, handleUseSelectionAsReferences, revertToTextToImage };
};

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('useSelectionDrivenImageGen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC-4-1: fires handleUseSelectionAsReferences when selection goes empty -> one image artboard', () => {
    const ab = makeArtboard({ id: 'ab-1', imageUrl: 'https://x.test/a.png', designId: 'd-1' });
    const { rendered, handleUseSelectionAsReferences } = mountHook({
      selectedIds: new Set(),
      artboards: [ab],
    });

    rendered.rerender({
      ids: new Set(['ab-1']),
      abs: [ab],
      mode: 'text_to_image',
      src: 'manual',
      inFlight: false,
    });

    expect(handleUseSelectionAsReferences).toHaveBeenCalledTimes(1);
    expect(handleUseSelectionAsReferences).toHaveBeenCalledWith(['https://x.test/a.png']);
  });

  it('forwards ALL selected image URLs (capping is the consumer’s responsibility)', () => {
    const abs = Array.from({ length: 5 }, (_, i) =>
      makeArtboard({
        id: `ab-${i + 1}`,
        designId: `d-${i + 1}`,
        imageUrl: `https://x.test/${i + 1}.png`,
      }),
    );
    const { rendered, handleUseSelectionAsReferences } = mountHook({
      selectedIds: new Set(),
      artboards: abs,
    });

    rendered.rerender({
      ids: new Set(abs.map((a) => a.id)),
      abs,
      mode: 'text_to_image',
      src: 'manual',
      inFlight: false,
    });

    expect(handleUseSelectionAsReferences).toHaveBeenCalledTimes(1);
    const passedUrls = handleUseSelectionAsReferences.mock.calls[0][0] as string[];
    expect(passedUrls).toHaveLength(5);
  });

  it('AC-4-3: selection -> empty AND source === “auto” calls revertToTextToImage', () => {
    const ab = makeArtboard({ id: 'ab-1', imageUrl: 'https://x.test/a.png' });
    const { rendered, revertToTextToImage } = mountHook({
      selectedIds: new Set(['ab-1']),
      artboards: [ab],
      generationMode: 'image_to_image_edit',
      generationModeSource: 'auto',
    });

    rendered.rerender({
      ids: new Set(),
      abs: [ab],
      mode: 'image_to_image_edit',
      src: 'auto',
      inFlight: false,
    });

    expect(revertToTextToImage).toHaveBeenCalledTimes(1);
  });

  it('AC-4-3: selection -> empty AND source === “manual” does NOT call revertToTextToImage', () => {
    const ab = makeArtboard({ id: 'ab-1', imageUrl: 'https://x.test/a.png' });
    const { rendered, revertToTextToImage } = mountHook({
      selectedIds: new Set(['ab-1']),
      artboards: [ab],
      generationMode: 'image_to_image_edit',
      generationModeSource: 'manual',
    });

    rendered.rerender({
      ids: new Set(),
      abs: [ab],
      mode: 'image_to_image_edit',
      src: 'manual',
      inFlight: false,
    });

    expect(revertToTextToImage).not.toHaveBeenCalled();
  });

  it('EC-4-4: short-circuits when mode === remix', () => {
    const ab = makeArtboard({ id: 'ab-1', imageUrl: 'https://x.test/a.png' });
    const { rendered, handleUseSelectionAsReferences, revertToTextToImage } = mountHook({
      selectedIds: new Set(),
      artboards: [ab],
      generationMode: 'remix',
    });

    rendered.rerender({
      ids: new Set(['ab-1']),
      abs: [ab],
      mode: 'remix',
      src: 'manual',
      inFlight: false,
    });

    expect(handleUseSelectionAsReferences).not.toHaveBeenCalled();
    expect(revertToTextToImage).not.toHaveBeenCalled();
  });

  it('EC-4-3: short-circuits when a generation is in flight', () => {
    const ab = makeArtboard({ id: 'ab-1', imageUrl: 'https://x.test/a.png' });
    const { rendered, handleUseSelectionAsReferences } = mountHook({
      selectedIds: new Set(),
      artboards: [ab],
      isGenerationInFlight: true,
    });

    rendered.rerender({
      ids: new Set(['ab-1']),
      abs: [ab],
      mode: 'text_to_image',
      src: 'manual',
      inFlight: true,
    });

    expect(handleUseSelectionAsReferences).not.toHaveBeenCalled();
  });

  it('EC-4-1 / EC-4-5: filters out artboards lacking designId or imageUrl', () => {
    const imageAb = makeArtboard({
      id: 'ab-image',
      designId: 'd-1',
      imageUrl: 'https://x.test/keep.png',
    });
    const textAb = makeArtboard({
      id: 'ab-text',
      designId: null,
      imageUrl: null,
    });
    const deletedDesignAb = makeArtboard({
      id: 'ab-deleted',
      designId: 'd-2',
      imageUrl: null, // upstream deletion -> imageUrl cleared
    });
    const abs = [imageAb, textAb, deletedDesignAb];

    const { rendered, handleUseSelectionAsReferences } = mountHook({
      selectedIds: new Set(),
      artboards: abs,
    });

    rendered.rerender({
      ids: new Set([imageAb.id, textAb.id, deletedDesignAb.id]),
      abs,
      mode: 'text_to_image',
      src: 'manual',
      inFlight: false,
    });

    expect(handleUseSelectionAsReferences).toHaveBeenCalledTimes(1);
    expect(handleUseSelectionAsReferences).toHaveBeenCalledWith(['https://x.test/keep.png']);
  });

  it('does not fire on initial mount when the selection is already empty', () => {
    const ab = makeArtboard({ id: 'ab-1' });
    const { handleUseSelectionAsReferences, revertToTextToImage } = mountHook({
      selectedIds: new Set(),
      artboards: [ab],
    });

    expect(handleUseSelectionAsReferences).not.toHaveBeenCalled();
    expect(revertToTextToImage).not.toHaveBeenCalled();
  });

  it('does not re-fire when the same selection signature renders again', () => {
    const ab = makeArtboard({ id: 'ab-1', imageUrl: 'https://x.test/a.png' });
    const initialSelection = new Set(['ab-1']);
    const { rendered, handleUseSelectionAsReferences } = mountHook({
      selectedIds: new Set(),
      artboards: [ab],
    });

    rendered.rerender({
      ids: initialSelection,
      abs: [ab],
      mode: 'text_to_image',
      src: 'manual',
      inFlight: false,
    });
    expect(handleUseSelectionAsReferences).toHaveBeenCalledTimes(1);

    // Re-render with a fresh Set but containing the SAME id -> signature
    // matches -> no re-fire.
    rendered.rerender({
      ids: new Set(['ab-1']),
      abs: [ab],
      mode: 'text_to_image',
      src: 'manual',
      inFlight: false,
    });
    expect(handleUseSelectionAsReferences).toHaveBeenCalledTimes(1);
  });
});
