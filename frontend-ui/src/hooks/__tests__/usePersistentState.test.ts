// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  usePersistentState,
  serializeMap,
  deserializeMap,
  __resetQuotaWarn,
} from '../usePersistentState';

describe('usePersistentState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetQuotaWarn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads initial value from localStorage on mount', () => {
    window.localStorage.setItem('mm.test.greet', JSON.stringify('hi'));
    const { result } = renderHook(() => usePersistentState<string>('mm.test.greet', 'fallback'));
    expect(result.current[0]).toBe('hi');
  });

  it('falls back to `initial` arg when localStorage empty', () => {
    const { result } = renderHook(() => usePersistentState<string>('mm.test.empty', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('writes to localStorage (debounced) on state change', () => {
    const { result } = renderHook(() => usePersistentState<number>('mm.test.count', 0));
    act(() => {
      result.current[1](7);
    });
    // Before debounce window expires — write not yet flushed.
    expect(window.localStorage.getItem('mm.test.count')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(window.localStorage.getItem('mm.test.count')).toBe('7');
  });

  it('supports custom serialize/deserialize for Map', () => {
    const seedMap = new Map<string, string>([['a', 'b']]);
    window.localStorage.setItem('mm.test.map', serializeMap(seedMap));
    const { result } = renderHook(() =>
      usePersistentState<Map<string, string>>('mm.test.map', new Map(), {
        serialize: serializeMap,
        deserialize: deserializeMap,
      }),
    );
    expect(result.current[0].get('a')).toBe('b');

    act(() => {
      result.current[1](new Map([['x', 'y']]));
    });
    act(() => {
      vi.advanceTimersByTime(260);
    });
    const raw = window.localStorage.getItem('mm.test.map');
    expect(raw).not.toBeNull();
    const restored = deserializeMap<string, string>(raw!);
    expect(restored.get('x')).toBe('y');
  });

  it('reacts to cross-tab `storage` events for the same key', () => {
    const { result } = renderHook(() => usePersistentState<string>('mm.test.cross', 'start'));
    expect(result.current[0]).toBe('start');

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'mm.test.cross',
          newValue: JSON.stringify('updated'),
        }),
      );
    });
    expect(result.current[0]).toBe('updated');
  });

  it('catches quota errors gracefully and stays in memory', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(window.localStorage.__proto__, 'setItem').mockImplementation(() => {
      const err = new Error('QuotaExceededError') as Error & { name: string };
      err.name = 'QuotaExceededError';
      throw err;
    });

    const { result } = renderHook(() => usePersistentState<string>('mm.test.quota', 'init'));
    act(() => {
      result.current[1]('attempt');
    });
    act(() => {
      vi.advanceTimersByTime(260);
    });

    // In-memory state still updates even though disk write failed.
    expect(result.current[0]).toBe('attempt');
    expect(warnSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => usePersistentState<string>('mm.test.iso', 'a'));
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'mm.other.key',
          newValue: JSON.stringify('b'),
        }),
      );
    });
    expect(result.current[0]).toBe('a');
  });
});
