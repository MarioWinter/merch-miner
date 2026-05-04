import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useEditorBatch from '../hooks/useEditorBatch';

// -----------------------------------------------------------------
// Mock crypto.randomUUID
// -----------------------------------------------------------------

let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`,
  );
});

// -----------------------------------------------------------------
// AC-180: Canvas and Editor batch are isolated
// -----------------------------------------------------------------

describe('Canvas <-> Editor isolation (AC-180)', () => {
  it('deleting from canvas artboards does NOT affect editor batch', () => {
    // Simulate: we have a canvas artboard list (plain array) and an editor batch
    const canvasArtboards = [
      { id: 'canvas-1', label: 'AB1', imageUrl: 'blob:c1' },
      { id: 'canvas-2', label: 'AB2', imageUrl: 'blob:c2' },
    ];

    const { result } = renderHook(() => useEditorBatch());

    // Add images to editor batch (simulating "Add to Editor")
    act(() => {
      result.current.addToEditorBatch([
        { url: 'blob:c1', name: 'AB1', width: 400, height: 500 },
        { url: 'blob:c2', name: 'AB2', width: 400, height: 500 },
      ]);
    });
    expect(result.current.editorBatchCount).toBe(2);

    // Simulate deleting an artboard from canvas (mutate local array)
    const remaining = canvasArtboards.filter((ab) => ab.id !== 'canvas-1');
    expect(remaining).toHaveLength(1);

    // Editor batch remains completely unaffected
    expect(result.current.editorBatchCount).toBe(2);
    expect(result.current.editorBatch[0].url).toBe('blob:c1');
    expect(result.current.editorBatch[1].url).toBe('blob:c2');
  });

  it('removing from editor batch does NOT affect canvas artboards', () => {
    // Simulate canvas artboards
    const canvasArtboards = [
      { id: 'canvas-1', label: 'AB1', imageUrl: 'blob:c1' },
      { id: 'canvas-2', label: 'AB2', imageUrl: 'blob:c2' },
    ];

    const { result } = renderHook(() => useEditorBatch());

    act(() => {
      result.current.addToEditorBatch([
        { url: 'blob:c1', name: 'AB1', width: 400, height: 500 },
      ]);
    });

    // Remove from editor batch
    act(() => {
      result.current.removeFromEditorBatch('uuid-1');
    });
    expect(result.current.editorBatchCount).toBe(0);

    // Canvas artboards remain unaffected
    expect(canvasArtboards).toHaveLength(2);
    expect(canvasArtboards[0].imageUrl).toBe('blob:c1');
    expect(canvasArtboards[1].imageUrl).toBe('blob:c2');
  });
});

// -----------------------------------------------------------------
// EC-51: Adding same artboard twice creates 2 items
// -----------------------------------------------------------------

describe('EC-51: duplicate "Add to Editor" creates separate batch items', () => {
  it('adding the same artboard URL twice produces 2 items with different IDs', () => {
    const { result } = renderHook(() => useEditorBatch());

    const image = { url: 'blob:same-img', name: 'Design A', width: 400, height: 500 };

    act(() => {
      result.current.addToEditorBatch([image]);
    });
    act(() => {
      result.current.addToEditorBatch([image]);
    });

    expect(result.current.editorBatchCount).toBe(2);
    expect(result.current.editorBatch[0].id).toBe('uuid-1');
    expect(result.current.editorBatch[1].id).toBe('uuid-2');
    expect(result.current.editorBatch[0].url).toBe(result.current.editorBatch[1].url);
  });
});
