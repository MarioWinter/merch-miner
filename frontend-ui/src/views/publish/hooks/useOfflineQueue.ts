import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export type QueueFailureAction = 'retry' | 'drop';

export interface UseOfflineQueueArgs<P> {
  /**
   * localStorage key for persisting the queue across reloads. Pass `null`
   * (or `undefined`) to run in-memory only — e.g. while the user or
   * workspace ID isn't known yet. Callers typically scope this to a
   * `{userId}:{workspaceId}` pair so queues from one session can't leak
   * into another on a shared machine.
   *
   * When `storageKey` changes during the hook's lifetime, the in-memory
   * queue is reset and re-hydrated from the new key — so switching
   * workspace discards the old context's pending PATCHes (they remain in
   * their own localStorage slot for when the user switches back).
   */
  storageKey: string | null | undefined;
  /**
   * Re-dispatches a queued payload. Called both on the online fast-path and
   * during FIFO replay (including after a page reload). Must throw on
   * failure so the queue can leave the op at head for retry.
   */
  executor: (payload: P) => Promise<unknown>;
  /**
   * Decides how to handle an executor failure:
   *  - `'retry'` — leave the op at head of the queue, halt flush, retry on
   *    the next `online` event (or the next successful enqueue).
   *  - `'drop'`  — permanently remove the op from the queue and continue
   *    draining later items. Use this for non-transient errors (e.g. 4xx
   *    validation) that would otherwise cause an infinite retry loop.
   *
   * Default: `'retry'` (conservative — never silently drops work).
   * The error is still rethrown internally so RTK mutation state surfaces
   * to callers regardless.
   */
  classifyError?: (err: unknown) => QueueFailureAction;
}

export interface UseOfflineQueueReturn<P> {
  /** Reactive online status — driven by `window.online`/`offline` events. */
  isOnline: boolean;
  /** Count of payloads waiting to drain (incl. head-retry after failure). */
  queueLength: number;
  /**
   * Queues a payload for execution. Online + empty queue → executes
   * immediately via flush. Offline (or flush in flight) → buffers FIFO.
   * Always returns a Promise that resolves with "queued / executed"
   * semantics; caller surfaces errors via its own mutation state
   * (e.g. `useEditFormState.saveError`).
   */
  enqueue: (payload: P) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const isBrowserOnline = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine;

const loadPersistedQueue = <P,>(
  storageKey: string | null | undefined,
): P[] => {
  try {
    if (!storageKey || typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as P[]) : [];
  } catch {
    return [];
  }
};

const persistQueue = <P,>(
  storageKey: string | null | undefined,
  queue: P[],
) => {
  try {
    if (!storageKey || typeof localStorage === 'undefined') return;
    if (queue.length === 0) {
      localStorage.removeItem(storageKey);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(queue));
  } catch {
    // Quota exceeded or storage disabled — non-fatal. The in-memory queue
    // still flushes; we just lose the reload-safety net.
  }
};

// ---------------------------------------------------------------------------
// Hook — PROJ-11 Phase O4
// ---------------------------------------------------------------------------

/**
 * PROJ-11 Phase O4 — offline PATCH queue with localStorage persistence +
 * retry-on-failure.
 *
 * Design:
 *  - Payloads (not closures) live in a ref; mirrored to localStorage so
 *    a refresh mid-offline doesn't drop pending edits.
 *  - Hydrates from storage on mount and auto-flushes if online.
 *  - Flush drains FIFO until queue empty, the browser goes offline, or the
 *    executor throws. On throw, the failed payload stays at head; next
 *    `online` event (or manual enqueue) re-triggers flush.
 *  - Concurrent flushes are coalesced via a running-flag ref — two
 *    simultaneous `enqueue`s don't race on `shift()`.
 */
const defaultClassifyError = (): QueueFailureAction => 'retry';

export const useOfflineQueue = <P,>({
  storageKey,
  executor,
  classifyError = defaultClassifyError,
}: UseOfflineQueueArgs<P>): UseOfflineQueueReturn<P> => {
  const [isOnline, setIsOnline] = useState<boolean>(isBrowserOnline);
  const [queueLength, setQueueLength] = useState(0);
  const queueRef = useRef<P[]>([]);
  const flushingRef = useRef(false);

  // Keep latest executor + classifier without re-creating `flush` or
  // re-binding listeners.
  const executorRef = useRef(executor);
  executorRef.current = executor;
  const classifyErrorRef = useRef(classifyError);
  classifyErrorRef.current = classifyError;

  const persist = useCallback(() => {
    persistQueue(storageKey, queueRef.current);
  }, [storageKey]);

  const syncLength = useCallback(() => {
    setQueueLength(queueRef.current.length);
  }, []);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        if (!isBrowserOnline()) break;
        const payload = queueRef.current[0];
        let failure: unknown = null;
        try {
          await executorRef.current(payload);
        } catch (err) {
          failure = err ?? new Error('queue executor failed');
        }
        if (failure !== null) {
          const action = classifyErrorRef.current(failure);
          if (action === 'retry') {
            // Transient — leave at head; flush halts. Next `online` event
            // (or successful enqueue) restarts it.
            break;
          }
          // 'drop' → non-transient (e.g. 4xx validation). Fall through to
          // shift() so the bad op is removed and later items still flush.
        }
        queueRef.current.shift();
        syncLength();
        persist();
      }
    } finally {
      flushingRef.current = false;
    }
  }, [persist, syncLength]);

  // Hydrate from storage whenever the scoping key changes (mount, user
  // switch, workspace switch). Reset in-memory queue first so items from
  // the previous scope don't leak into the new one — they remain in
  // their own localStorage slot and resurface when that scope is active
  // again.
  useEffect(() => {
    const stored = loadPersistedQueue<P>(storageKey);
    queueRef.current = stored;
    syncLength();
    if (stored.length > 0 && isBrowserOnline()) {
      void flush();
    }
    // `flush` + `syncLength` are stable (useCallback). Executor intentionally
    // excluded — it's read via `executorRef` at call-time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Track online/offline window events.
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void flush();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flush]);

  const enqueue = useCallback(
    async (payload: P): Promise<void> => {
      queueRef.current.push(payload);
      syncLength();
      persist();
      if (isBrowserOnline()) {
        void flush();
      }
    },
    [flush, persist, syncLength],
  );

  return { isOnline, queueLength, enqueue };
};
