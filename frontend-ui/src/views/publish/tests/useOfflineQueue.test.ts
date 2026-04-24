import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineQueue } from '../hooks/useOfflineQueue';

// ---------------------------------------------------------------------------
// Helpers — drive `navigator.onLine` without touching the read-only JSDOM
// accessor. Tests assume jsdom environment (see vite.config.ts).
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'mm.test.queue.v1';

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
};

const dispatchOnline = () => {
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
};

const dispatchOffline = () => {
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
};

describe('useOfflineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
    setOnline(true);
  });

  afterEach(() => {
    localStorage.clear();
    setOnline(true);
  });

  it('runs executor immediately when online (no queueing, no persist)', async () => {
    const executor = vi.fn((p: string) => Promise.resolve(p));
    const { result } = renderHook(() =>
      useOfflineQueue<string>({ storageKey: STORAGE_KEY, executor }),
    );
    await act(async () => {
      await result.current.enqueue('a');
    });
    await waitFor(() => expect(executor).toHaveBeenCalledTimes(1));
    expect(executor).toHaveBeenCalledWith('a');
    expect(result.current.queueLength).toBe(0);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('queues payloads while offline and persists to localStorage', () => {
    const executor = vi.fn();
    const { result } = renderHook(() =>
      useOfflineQueue<string>({ storageKey: STORAGE_KEY, executor }),
    );
    setOnline(false);
    dispatchOffline();
    act(() => {
      void result.current.enqueue('a');
      void result.current.enqueue('b');
      void result.current.enqueue('c');
    });
    expect(executor).not.toHaveBeenCalled();
    expect(result.current.queueLength).toBe(3);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('flushes queued payloads in FIFO when `online` fires', async () => {
    const order: string[] = [];
    const executor = vi.fn((p: string) => {
      order.push(p);
      return Promise.resolve(p);
    });
    const { result } = renderHook(() =>
      useOfflineQueue<string>({ storageKey: STORAGE_KEY, executor }),
    );
    setOnline(false);
    dispatchOffline();
    act(() => {
      void result.current.enqueue('a');
      void result.current.enqueue('b');
      void result.current.enqueue('c');
    });
    expect(result.current.queueLength).toBe(3);

    setOnline(true);
    dispatchOnline();

    await waitFor(() => expect(result.current.queueLength).toBe(0));
    expect(order).toEqual(['a', 'b', 'c']);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('drops op when classifyError returns "drop" and keeps draining', async () => {
    const order: string[] = [];
    const executor = vi.fn((p: string) => {
      order.push(p);
      if (p === 'b') return Promise.reject({ status: 400, data: 'bad' });
      return Promise.resolve(p);
    });
    const classifyError = vi.fn((err: unknown) => {
      const status = (err as { status?: number }).status;
      return typeof status === 'number' && status >= 400 && status < 500
        ? ('drop' as const)
        : ('retry' as const);
    });
    const { result } = renderHook(() =>
      useOfflineQueue<string>({
        storageKey: STORAGE_KEY,
        executor,
        classifyError,
      }),
    );
    setOnline(false);
    dispatchOffline();
    act(() => {
      void result.current.enqueue('a');
      void result.current.enqueue('b');
      void result.current.enqueue('c');
    });

    setOnline(true);
    dispatchOnline();

    await waitFor(() => expect(result.current.queueLength).toBe(0));
    // 'b' was attempted then dropped; 'c' still flushed afterwards.
    expect(order).toEqual(['a', 'b', 'c']);
    expect(classifyError).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('retries on failure: op stays at head when executor rejects', async () => {
    let attempts = 0;
    const executor = vi.fn((p: string) => {
      attempts += 1;
      if (attempts === 1) return Promise.reject(new Error('boom'));
      return Promise.resolve(p);
    });
    const { result } = renderHook(() =>
      useOfflineQueue<string>({ storageKey: STORAGE_KEY, executor }),
    );
    setOnline(false);
    dispatchOffline();
    act(() => {
      void result.current.enqueue('a');
    });

    setOnline(true);
    dispatchOnline();

    // First replay fails → op stays at head.
    await waitFor(() => expect(executor).toHaveBeenCalledTimes(1));
    expect(result.current.queueLength).toBe(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([
      'a',
    ]);

    // Another `online` tick retries.
    dispatchOnline();
    await waitFor(() => expect(result.current.queueLength).toBe(0));
    expect(executor).toHaveBeenCalledTimes(2);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('hydrates queue from localStorage on mount and flushes if online', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['x', 'y']));
    const order: string[] = [];
    const executor = vi.fn((p: string) => {
      order.push(p);
      return Promise.resolve(p);
    });
    const { result } = renderHook(() =>
      useOfflineQueue<string>({ storageKey: STORAGE_KEY, executor }),
    );
    await waitFor(() => expect(result.current.queueLength).toBe(0));
    expect(order).toEqual(['x', 'y']);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('hydrates queue from localStorage but keeps pending when offline on mount', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['x']));
    setOnline(false);
    const executor = vi.fn();
    const { result } = renderHook(() =>
      useOfflineQueue<string>({ storageKey: STORAGE_KEY, executor }),
    );
    await waitFor(() => expect(result.current.queueLength).toBe(1));
    expect(executor).not.toHaveBeenCalled();
  });

  it('reflects isOnline state from window events', () => {
    const executor = vi.fn();
    const { result } = renderHook(() =>
      useOfflineQueue<string>({ storageKey: STORAGE_KEY, executor }),
    );
    expect(result.current.isOnline).toBe(true);
    setOnline(false);
    dispatchOffline();
    expect(result.current.isOnline).toBe(false);
    setOnline(true);
    dispatchOnline();
    expect(result.current.isOnline).toBe(true);
  });

  // ---- Scoping: null storageKey + key changes ---------------------------

  it('runs ref-only (no persist) when storageKey is null', () => {
    const executor = vi.fn();
    const { result } = renderHook(() =>
      useOfflineQueue<string>({ storageKey: null, executor }),
    );
    setOnline(false);
    dispatchOffline();
    act(() => {
      void result.current.enqueue('a');
      void result.current.enqueue('b');
    });
    expect(result.current.queueLength).toBe(2);
    // Nothing written to localStorage because key is null.
    expect(localStorage.length).toBe(0);
  });

  it('resets in-memory queue + re-hydrates when storageKey changes', async () => {
    // Seed the "new" scope with a pre-existing queued payload.
    localStorage.setItem('scope:B', JSON.stringify(['b-persisted']));

    const order: string[] = [];
    const executor = vi.fn((p: string) => {
      order.push(p);
      return Promise.resolve(p);
    });
    const { result, rerender } = renderHook(
      ({ storageKey }: { storageKey: string }) =>
        useOfflineQueue<string>({ storageKey, executor }),
      { initialProps: { storageKey: 'scope:A' } },
    );

    // Queue an item under scope A while offline.
    setOnline(false);
    dispatchOffline();
    act(() => {
      void result.current.enqueue('a-in-memory');
    });
    expect(result.current.queueLength).toBe(1);

    // Switch scope → in-memory queue resets to scope B's persisted items.
    rerender({ storageKey: 'scope:B' });
    await waitFor(() => expect(result.current.queueLength).toBe(1));

    // Scope B's persisted item must now be in memory (NOT 'a-in-memory').
    // Verify by flushing and checking order.
    setOnline(true);
    dispatchOnline();
    await waitFor(() => expect(result.current.queueLength).toBe(0));
    expect(order).toEqual(['b-persisted']);

    // Scope A's persisted item is preserved under its own key for when
    // the user switches back.
    expect(JSON.parse(localStorage.getItem('scope:A') ?? '[]')).toEqual([
      'a-in-memory',
    ]);
  });
});
