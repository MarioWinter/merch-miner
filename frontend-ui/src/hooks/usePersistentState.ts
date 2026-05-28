import { useEffect, useMemo, useRef, useState } from 'react';

// -----------------------------------------------------------------
// Generic localStorage-backed state hook
// -----------------------------------------------------------------
//
// - Reads initial value from `localStorage[key]` on mount.
// - Writes (debounced 250ms) on every state change.
// - Listens to cross-tab `storage` events to re-sync.
// - Gracefully degrades to in-memory on QuotaExceededError / parse error.
//
// Keys MUST be namespaced (`mm.*`) to avoid collisions with other apps on the
// same origin.
// -----------------------------------------------------------------

const DEBOUNCE_MS = 250;
let quotaWarned = false;

export interface UsePersistentStateOptions<T> {
  /** Custom JSON serializer. Default: `JSON.stringify`. Useful for Map/Set. */
  serialize?: (value: T) => string;
  /** Custom JSON deserializer. Default: `JSON.parse`. */
  deserialize?: (raw: string) => T;
  /** Skip persistence entirely (useful in tests). */
  skipPersistence?: boolean;
}

const defaultSerialize = <T,>(v: T): string => JSON.stringify(v);
const defaultDeserialize = <T,>(raw: string): T => JSON.parse(raw) as T;

const readInitial = <T,>(
  key: string,
  fallback: T,
  deserialize: (raw: string) => T,
  skip: boolean,
): T => {
  if (skip || typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return deserialize(raw);
  } catch (err) {
    console.warn(`[usePersistentState] read failed for "${key}":`, err);
    return fallback;
  }
};

export const usePersistentState = <T,>(
  key: string,
  initial: T,
  options?: UsePersistentStateOptions<T>,
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const skip = options?.skipPersistence ?? false;
  // Default fns are stable across renders (no reallocation per call), and the
  // memo below pins the user-supplied fn for the lifetime of one render — both
  // effects depend on the resolved fns so they always read the latest value.
  const defaultSer = useMemo(() => defaultSerialize<T>, []);
  const defaultDeser = useMemo(() => defaultDeserialize<T>, []);
  const serialize = options?.serialize ?? defaultSer;
  const deserialize = options?.deserialize ?? defaultDeser;

  const [state, setState] = useState<T>(() => readInitial(key, initial, deserialize, skip));

  // Debounced write.
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (skip || typeof window === 'undefined') return;
    if (writeTimerRef.current !== null) clearTimeout(writeTimerRef.current);
    writeTimerRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(key, serialize(state));
      } catch (err) {
        if (!quotaWarned) {
          quotaWarned = true;
          console.warn(`[usePersistentState] write failed for "${key}":`, err);
        }
      }
    }, DEBOUNCE_MS);
    return () => {
      if (writeTimerRef.current !== null) clearTimeout(writeTimerRef.current);
    };
  }, [key, state, skip, serialize]);

  // Cross-tab sync — `storage` events only fire in OTHER tabs.
  useEffect(() => {
    if (skip || typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key !== key) return;
      if (e.newValue === null) return;
      try {
        setState(deserialize(e.newValue));
      } catch (err) {
        console.warn(`[usePersistentState] cross-tab parse failed for "${key}":`, err);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [key, skip, deserialize]);

  return [state, setState];
};

// -----------------------------------------------------------------
// Utility — clear a single key (used by workspace-switch cleanup).
// -----------------------------------------------------------------

export const clearPersistentKey = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[usePersistentState] remove failed for "${key}":`, err);
  }
};

// -----------------------------------------------------------------
// Map<K, V> serializer helpers — common case in this codebase.
// -----------------------------------------------------------------

export const serializeMap = <K, V>(m: Map<K, V>): string =>
  JSON.stringify(Array.from(m.entries()));

export const deserializeMap = <K, V>(raw: string): Map<K, V> =>
  new Map(JSON.parse(raw) as Array<[K, V]>);

// Exposed for tests only.
export const __resetQuotaWarn = (): void => {
  quotaWarned = false;
};
