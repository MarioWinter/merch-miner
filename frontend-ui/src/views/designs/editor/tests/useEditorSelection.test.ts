import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEditorSelection } from '../hooks/useEditorSelection';

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const makeImages = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `img-${i}` }));

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('useEditorSelection', () => {
  it('starts with no selection', () => {
    const images = makeImages(3);
    const { result } = renderHook(() => useEditorSelection(images));

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedIds.size).toBe(0);
  });

  it('toggleSelect adds and removes items', () => {
    const images = makeImages(3);
    const { result } = renderHook(() => useEditorSelection(images));

    act(() => result.current.toggleSelect('img-1', 1));
    expect(result.current.isSelected('img-1')).toBe(true);
    expect(result.current.selectedCount).toBe(1);

    act(() => result.current.toggleSelect('img-1', 1));
    expect(result.current.isSelected('img-1')).toBe(false);
    expect(result.current.selectedCount).toBe(0);
  });

  it('shiftSelect selects a range from last clicked index', () => {
    const images = makeImages(5);
    const { result } = renderHook(() => useEditorSelection(images));

    // Click index 1
    act(() => result.current.toggleSelect('img-1', 1));
    expect(result.current.selectedCount).toBe(1);

    // Shift+click index 3 -> selects 1,2,3
    act(() => result.current.shiftSelect(3, images));
    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isSelected('img-1')).toBe(true);
    expect(result.current.isSelected('img-2')).toBe(true);
    expect(result.current.isSelected('img-3')).toBe(true);
    // Index 0 and 4 not selected
    expect(result.current.isSelected('img-0')).toBe(false);
    expect(result.current.isSelected('img-4')).toBe(false);
  });

  it('selectAll selects all images', () => {
    const images = makeImages(4);
    const { result } = renderHook(() => useEditorSelection(images));

    act(() => result.current.selectAll(images));
    expect(result.current.selectedCount).toBe(4);
  });

  it('deselectAll clears selection', () => {
    const images = makeImages(3);
    const { result } = renderHook(() => useEditorSelection(images));

    act(() => result.current.selectAll(images));
    expect(result.current.selectedCount).toBe(3);

    act(() => result.current.deselectAll());
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.lastClickedIndex).toBeNull();
  });

  it('cleans stale IDs when images change', () => {
    const initialImages = makeImages(3);
    const { result, rerender } = renderHook(
      ({ images }) => useEditorSelection(images),
      { initialProps: { images: initialImages } },
    );

    act(() => result.current.selectAll(initialImages));
    expect(result.current.selectedCount).toBe(3);

    // Remove img-1 from the list
    const reduced = initialImages.filter((img) => img.id !== 'img-1');
    rerender({ images: reduced });

    // Stale id is cleaned out
    expect(result.current.selectedCount).toBe(2);
    expect(result.current.isSelected('img-1')).toBe(false);
  });
});

// -----------------------------------------------------------------
// Shift+Click range -> "Add Selected to Canvas" integration
// -----------------------------------------------------------------

describe('Shift+Click range select -> Add Selected to Canvas', () => {
  it('selects range via shiftSelect, then simulates adding to canvas', () => {
    const images = makeImages(5);
    const { result } = renderHook(() => useEditorSelection(images));

    // Click index 1
    act(() => result.current.toggleSelect('img-1', 1));
    // Shift+click index 4 -> selects 1..4
    act(() => result.current.shiftSelect(4, images));

    expect(result.current.selectedCount).toBe(4);

    // Simulate "Add Selected to Canvas": collect selected images
    const selectedImages = images.filter((img) => result.current.selectedIds.has(img.id));
    expect(selectedImages).toHaveLength(4);
    expect(selectedImages.map((i) => i.id)).toEqual(['img-1', 'img-2', 'img-3', 'img-4']);

    // Simulate creating artboards from selected images
    const artboards = selectedImages.map((img) => ({
      id: `artboard-from-${img.id}`,
      label: img.id,
      width: 280,
      height: 280,
    }));
    expect(artboards).toHaveLength(4);
    expect(artboards[0].id).toBe('artboard-from-img-1');
    expect(artboards[3].id).toBe('artboard-from-img-4');

    // After adding, deselect (as the real code does)
    act(() => result.current.deselectAll());
    expect(result.current.selectedCount).toBe(0);
  });
});
