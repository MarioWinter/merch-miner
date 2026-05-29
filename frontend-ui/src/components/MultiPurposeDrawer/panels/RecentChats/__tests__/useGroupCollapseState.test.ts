/**
 * FIX-chat-bugfixes-and-grouping Phase 7 — Vitest for `useGroupCollapseState`.
 *
 * Covers:
 *   1. Initial state defaults to "all expanded" when localStorage is empty.
 *   2. `toggleCollapsed` flips state on/off and the second call returns to the
 *      original value.
 *   3. Pre-existing localStorage entry hydrates on first mount.
 *   4. Workspace-id change re-hydrates from the new key.
 *   5. `QuotaExceededError` on `setItem` is swallowed (no throw, one warn).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useGroupCollapseState,
  __resetQuotaWarn,
} from '../hooks/useGroupCollapseState';

const STORAGE_KEY_PREFIX = 'mm.chatGroups.collapsed.';

describe('useGroupCollapseState', () => {
  beforeEach(() => {
    window.localStorage.clear();
    __resetQuotaWarn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns isCollapsed=false for any id when storage is empty', () => {
    const { result } = renderHook(() => useGroupCollapseState('ws-1'));
    expect(result.current.isCollapsed('group-a')).toBe(false);
    expect(result.current.isCollapsed('group-b')).toBe(false);
  });

  it('toggleCollapsed flips the bit, second call flips back', () => {
    const { result } = renderHook(() => useGroupCollapseState('ws-1'));

    expect(result.current.isCollapsed('group-a')).toBe(false);

    act(() => {
      result.current.toggleCollapsed('group-a');
    });
    expect(result.current.isCollapsed('group-a')).toBe(true);

    act(() => {
      result.current.toggleCollapsed('group-a');
    });
    expect(result.current.isCollapsed('group-a')).toBe(false);
  });

  it('writes to localStorage on toggle and reads it back on re-mount', () => {
    const { result, unmount } = renderHook(() =>
      useGroupCollapseState('ws-1'),
    );

    act(() => {
      result.current.toggleCollapsed('group-a');
      result.current.toggleCollapsed('group-b');
    });

    // Raw storage now contains both ids.
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}ws-1`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as string[];
    expect(parsed.sort()).toEqual(['group-a', 'group-b']);

    unmount();

    const { result: result2 } = renderHook(() =>
      useGroupCollapseState('ws-1'),
    );
    expect(result2.current.isCollapsed('group-a')).toBe(true);
    expect(result2.current.isCollapsed('group-b')).toBe(true);
    expect(result2.current.isCollapsed('group-c')).toBe(false);
  });

  it('re-hydrates from the new key when workspaceId changes mid-mount', () => {
    // Seed two different workspaces.
    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}ws-1`,
      JSON.stringify(['group-a']),
    );
    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}ws-2`,
      JSON.stringify(['group-z']),
    );

    const { result, rerender } = renderHook(
      (props: { wsId: string }) => useGroupCollapseState(props.wsId),
      { initialProps: { wsId: 'ws-1' } },
    );

    expect(result.current.isCollapsed('group-a')).toBe(true);
    expect(result.current.isCollapsed('group-z')).toBe(false);

    rerender({ wsId: 'ws-2' });

    expect(result.current.isCollapsed('group-a')).toBe(false);
    expect(result.current.isCollapsed('group-z')).toBe(true);
  });

  it('swallows QuotaExceededError on setItem and emits a single console.warn', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItemSpy = vi
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      });

    const { result } = renderHook(() => useGroupCollapseState('ws-1'));

    // Should NOT throw despite the storage failure.
    expect(() => {
      act(() => {
        result.current.toggleCollapsed('group-a');
      });
    }).not.toThrow();

    // In-memory state still flips.
    expect(result.current.isCollapsed('group-a')).toBe(true);

    // Trigger a second write to confirm the warn fires only once.
    act(() => {
      result.current.toggleCollapsed('group-b');
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);

    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('returns empty set when workspaceId is null (no storage key)', () => {
    const { result } = renderHook(() => useGroupCollapseState(null));
    expect(result.current.isCollapsed('group-a')).toBe(false);

    // Toggling still updates in-memory state but cannot persist.
    act(() => {
      result.current.toggleCollapsed('group-a');
    });
    expect(result.current.isCollapsed('group-a')).toBe(true);
    // Nothing was written under any key.
    expect(window.localStorage.length).toBe(0);
  });
});
