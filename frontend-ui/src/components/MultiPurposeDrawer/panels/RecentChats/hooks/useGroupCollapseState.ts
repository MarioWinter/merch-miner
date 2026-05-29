import { useCallback, useEffect, useState } from 'react';

/**
 * FIX-chat-bugfixes-and-grouping Item 7 — per-workspace persistent collapse
 * state for chat-group sections in the sidebar.
 *
 * Storage shape: `mm.chatGroups.collapsed.<workspaceId>` ⇒ JSON `string[]`
 * of collapsed group ids. Missing key ⇒ empty set. `QuotaExceededError` on
 * write is swallowed with a one-time `console.warn`; the in-memory set keeps
 * working for the rest of the session.
 *
 * Returns:
 *   `isCollapsed(groupId)` — boolean lookup against the current set.
 *   `toggleCollapsed(groupId)` — flips the bit and triggers a re-render.
 */

const STORAGE_KEY_PREFIX = 'mm.chatGroups.collapsed.';

let quotaWarned = false;

const buildKey = (workspaceId: string | null | undefined): string | null =>
  workspaceId ? `${STORAGE_KEY_PREFIX}${workspaceId}` : null;

const readInitial = (storageKey: string | null): Set<string> => {
  if (!storageKey || typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    }
    return new Set();
  } catch {
    return new Set();
  }
};

const writeStorage = (storageKey: string | null, value: Set<string>): void => {
  if (!storageKey || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(value)));
  } catch (err) {
    if (!quotaWarned) {
      quotaWarned = true;
      console.warn('[useGroupCollapseState] write failed:', err);
    }
  }
};

export interface UseGroupCollapseState {
  isCollapsed: (groupId: string) => boolean;
  toggleCollapsed: (groupId: string) => void;
}

export const useGroupCollapseState = (
  workspaceId: string | null | undefined,
): UseGroupCollapseState => {
  const storageKey = buildKey(workspaceId);
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    readInitial(storageKey),
  );

  // Re-hydrate when the storage key changes (workspace switch). One extra
  // render with the previous workspace's collapse set is acceptable — the
  // state is visual only. `useEffect` instead of in-render setState because
  // the latter triggers the `react-hooks/refs` lint rule.
  useEffect(() => {
    setCollapsed(readInitial(storageKey));
  }, [storageKey]);

  const isCollapsed = useCallback(
    (groupId: string): boolean => collapsed.has(groupId),
    [collapsed],
  );

  const toggleCollapsed = useCallback(
    (groupId: string): void => {
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(groupId)) next.delete(groupId);
        else next.add(groupId);
        writeStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  return { isCollapsed, toggleCollapsed };
};

// Test-only — reset the quota-warned flag between cases.
export const __resetQuotaWarn = (): void => {
  quotaWarned = false;
};
