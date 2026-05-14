/**
 * PROJ-29 Phase 1J BUG-1 — optimistic user-message echo.
 *
 * Inserts a temp `ChatMessage` (role=user) into the `getSession` RTK Query
 * cache so the user's bubble appears in the chat history within the same
 * render cycle as `handleSubmit`. The persisted message arrives via the
 * existing RTK Query tag invalidation (SSE `done` event triggers
 * `searchApi.util.invalidateTags`) and replaces the temp row on refetch.
 *
 * Usage:
 *   const { insert, rollback } = useOptimisticChatMessage();
 *   const tempId = insert({ sessionId, content });
 *   try { ... } catch { rollback({ sessionId, tempId }); throw; }
 *
 * Security:
 *   - Temp id prefix `temp_` guarantees it can never collide with a server
 *     UUID. Frontend code that POSTs back a message id (e.g.
 *     `useDeleteMessageMutation`) only fires from persisted assistant
 *     messages, never from temp user rows — but the prefix is the
 *     belt-and-braces guard.
 *   - Hook is client-only state. No new network surface.
 */
import { useCallback } from 'react';
import { useAppDispatch } from '@/store/hooks';
import { searchApi } from '@/store/searchSlice';
import type { ChatMessage } from '@/types/search';

interface InsertArgs {
  sessionId: string;
  content: string;
}

interface RollbackArgs {
  sessionId: string;
  tempId: string;
}

interface UseOptimisticChatMessageReturn {
  /**
   * Push a temp user message into the `getSession` cache. Returns the
   * generated `temp_*` id so the caller can roll it back on error.
   */
  insert: (args: InsertArgs) => string;
  /**
   * Remove the temp message from the cache. No-op when nothing matches
   * (e.g. the SSE `done` refetch already replaced it).
   */
  rollback: (args: RollbackArgs) => void;
}

/**
 * Build the minimal `ChatMessage` shape the cache + render path expect for a
 * user row. Keep this in lockstep with `ChatMessage` in `@/types/search`.
 */
const buildTempUserMessage = (
  sessionId: string,
  tempId: string,
  content: string,
): ChatMessage => ({
  id: tempId,
  session: sessionId,
  role: 'user',
  content,
  // Mirror backend default (`MessageType.SEARCH_QUERY`) so the temp row
  // renders through the standard user-bubble branch in ChatMessageList.
  message_type: 'search_query',
  sources: [],
  search_mode: null,
  search_sources: null,
  model_used: '',
  agent_session: null,
  attachments: [],
  created_at: new Date().toISOString(),
});

/**
 * Generate a client-only id that can never collide with a server UUID. Uses
 * `crypto.randomUUID()` when available (browser + JSDOM 18+); falls back to
 * `Math.random()` so the hook never throws in older test environments.
 */
const generateTempId = (): string => {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `temp_${rand}`;
};

export const useOptimisticChatMessage = (): UseOptimisticChatMessageReturn => {
  const dispatch = useAppDispatch();

  const insert = useCallback(
    ({ sessionId, content }: InsertArgs): string => {
      const tempId = generateTempId();
      const tempMessage = buildTempUserMessage(sessionId, tempId, content);
      dispatch(
        searchApi.util.updateQueryData('getSession', sessionId, (draft) => {
          // `getSession` may be in an "uninitialized" cache slot when the
          // session was just created by `useCreateSessionMutation`. In that
          // case `draft` is the empty initial RTK Query response — but
          // because the cache slot exists from the mutation's invalidation,
          // `updateQueryData` still gives us a writable draft.
          if (!draft.messages) {
            draft.messages = [];
          }
          draft.messages.push(tempMessage);
        }),
      );
      return tempId;
    },
    [dispatch],
  );

  const rollback = useCallback(
    ({ sessionId, tempId }: RollbackArgs): void => {
      dispatch(
        searchApi.util.updateQueryData('getSession', sessionId, (draft) => {
          if (!draft.messages) return;
          draft.messages = draft.messages.filter((m) => m.id !== tempId);
        }),
      );
    },
    [dispatch],
  );

  return { insert, rollback };
};
