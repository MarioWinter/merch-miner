import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useEditorBatch from '../useEditorBatch';

// -----------------------------------------------------------------
// Mock crypto.randomUUID for deterministic IDs
// -----------------------------------------------------------------

let uuidCounter = 0;
beforeEach(() => {
  uuidCounter = 0;
  vi.spyOn(crypto, 'randomUUID').mockImplementation(
    () => `uuid-${++uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`,
  );
});

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('useEditorBatch', () => {
  it('starts with empty batch and zero count', () => {
    const { result } = renderHook(() => useEditorBatch());

    expect(result.current.editorBatch).toEqual([]);
    expect(result.current.editorBatchCount).toBe(0);
  });

  it('adds images with generated IDs', () => {
    const { result } = renderHook(() => useEditorBatch());

    act(() => {
      result.current.addToEditorBatch([
        { url: 'blob:img1', name: 'design1.png', width: 400, height: 500 },
        { url: 'blob:img2', name: 'design2.png', width: 800, height: 600 },
      ]);
    });

    expect(result.current.editorBatch).toHaveLength(2);
    expect(result.current.editorBatchCount).toBe(2);
    expect(result.current.editorBatch[0]).toEqual({
      id: 'uuid-1',
      url: 'blob:img1',
      name: 'design1.png',
      width: 400,
      height: 500,
    });
    expect(result.current.editorBatch[1]).toEqual({
      id: 'uuid-2',
      url: 'blob:img2',
      name: 'design2.png',
      width: 800,
      height: 600,
    });
  });

  it('removes an image by id', () => {
    const { result } = renderHook(() => useEditorBatch());

    act(() => {
      result.current.addToEditorBatch([
        { url: 'blob:a', name: 'a.png' },
        { url: 'blob:b', name: 'b.png' },
        { url: 'blob:c', name: 'c.png' },
      ]);
    });
    expect(result.current.editorBatchCount).toBe(3);

    act(() => {
      result.current.removeFromEditorBatch('uuid-2');
    });

    expect(result.current.editorBatchCount).toBe(2);
    expect(result.current.editorBatch.map((i) => i.name)).toEqual(['a.png', 'c.png']);
  });

  it('clears all images', () => {
    const { result } = renderHook(() => useEditorBatch());

    act(() => {
      result.current.addToEditorBatch([
        { url: 'blob:a', name: 'a.png' },
        { url: 'blob:b', name: 'b.png' },
      ]);
    });
    expect(result.current.editorBatchCount).toBe(2);

    act(() => {
      result.current.clearEditorBatch();
    });

    expect(result.current.editorBatch).toEqual([]);
    expect(result.current.editorBatchCount).toBe(0);
  });

  it('derives count correctly after multiple add/remove operations', () => {
    const { result } = renderHook(() => useEditorBatch());

    // Add 2
    act(() => {
      result.current.addToEditorBatch([{ url: 'blob:x', name: 'x.png' }]);
    });
    expect(result.current.editorBatchCount).toBe(1);

    // Add 2 more
    act(() => {
      result.current.addToEditorBatch([
        { url: 'blob:y', name: 'y.png' },
        { url: 'blob:z', name: 'z.png' },
      ]);
    });
    expect(result.current.editorBatchCount).toBe(3);

    // Remove one
    act(() => {
      result.current.removeFromEditorBatch('uuid-2');
    });
    expect(result.current.editorBatchCount).toBe(2);
  });

  it('does not crash when removing a non-existent id', () => {
    const { result } = renderHook(() => useEditorBatch());

    act(() => {
      result.current.addToEditorBatch([{ url: 'blob:a', name: 'a.png' }]);
    });

    act(() => {
      result.current.removeFromEditorBatch('non-existent');
    });

    expect(result.current.editorBatchCount).toBe(1);
  });
});
