// ---------------------------------------------------------------------------
// PROJ-11 Phase O4 — offline-queue storage helpers
// ---------------------------------------------------------------------------
//
// The Publish Edit page's offline queue lives in `localStorage` under keys
// prefixed by `PUBLISH_EDIT_QUEUE_KEY_PREFIX` and scoped to a
// `{userId}:{workspaceId}` pair. Two side utilities live here so both
// `useEditFormState` (which creates + reads keys) and the logout flow
// (which has to wipe leftover keys on sign-out) can share them without
// one importing the other's full module tree.
// ---------------------------------------------------------------------------

export const PUBLISH_EDIT_QUEUE_KEY_PREFIX = 'mm.publish.editFormQueue.v1';

/**
 * Composes the per-scope storage key. Returns `null` when either input
 * is missing — `useOfflineQueue` then runs ref-only (no persist).
 */
export const buildPublishEditQueueKey = (
  userId: number | null | undefined,
  workspaceId: string | null | undefined,
): string | null => {
  if (!userId || !workspaceId) return null;
  return `${PUBLISH_EDIT_QUEUE_KEY_PREFIX}:${userId}:${workspaceId}`;
};

/**
 * Removes every localStorage entry under the offline-queue prefix.
 * Called on logout so a shared machine can't leak queued edits from one
 * account into the next sign-in. Wipes *all* scopes — on logout there's
 * no way to know which workspace the user will pick next anyway.
 */
export const clearPublishEditQueues = () => {
  if (typeof localStorage === 'undefined') return;
  const toRemove: string[] = [];
  const scopedPrefix = `${PUBLISH_EDIT_QUEUE_KEY_PREFIX}:`;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(scopedPrefix)) {
      toRemove.push(key);
    }
  }
  toRemove.forEach((key) => localStorage.removeItem(key));
};
