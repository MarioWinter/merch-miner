/**
 * PROJ-29 Phase 1J BUG-1 — useOptimisticChatMessage tests.
 *
 * Drives the hook directly with a minimal store + searchApi reducer so we
 * can read back the `getSession` cache after insert/rollback.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { searchApi } from '@/store/searchSlice';
import { useOptimisticChatMessage } from '../useOptimisticChatMessage';
import type { ChatSessionDetail } from '@/types/search';

const SESSION_ID = 'sess-opt-1';

const seedSession = (): ChatSessionDetail => ({
  id: SESSION_ID,
  workspace: 'ws-1',
  user: 0,
  title: 'Test',
  niche_context_id: null,
  niche_context: null,
  status: 'active',
  is_shared: false,
  share_token: null,
  shared_by: null,
  shared_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  message_count: 0,
  messages: [],
});

const buildStore = () =>
  configureStore({
    reducer: {
      [searchApi.reducerPath]: searchApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(searchApi.middleware),
  });

type Store = ReturnType<typeof buildStore>;

const seedCache = (store: Store) => {
  // Prime the getSession cache directly so updateQueryData has a slot to
  // mutate. Using upsertQueryData mimics the real-world flow where the
  // component subscribed via useGetSessionQuery has just received data.
  return store.dispatch(
    searchApi.util.upsertQueryData('getSession', SESSION_ID, seedSession()),
  );
};

const selectMessages = (store: Store) => {
  const state = store.getState();
  // Look up the cache slot for getSession(SESSION_ID).
  const queries = state[searchApi.reducerPath].queries;
  const slot = Object.values(queries).find(
    (q) => q?.endpointName === 'getSession' && q?.originalArgs === SESSION_ID,
  );
  const data = slot?.data as ChatSessionDetail | undefined;
  return data?.messages ?? [];
};

let store: Store;

beforeEach(() => {
  store = buildStore();
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>{children}</Provider>
);

describe('useOptimisticChatMessage', () => {
  it('insert pushes a temp user message into the getSession cache', async () => {
    await seedCache(store);
    const { result } = renderHook(() => useOptimisticChatMessage(), { wrapper });

    let tempId = '';
    act(() => {
      tempId = result.current.insert({
        sessionId: SESSION_ID,
        content: 'hello world',
      });
    });

    expect(tempId.startsWith('temp_')).toBe(true);
    const messages = selectMessages(store);
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(tempId);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('hello world');
  });

  it('insert carries referenced_niche_id + name onto the temp row when supplied', async () => {
    await seedCache(store);
    const { result } = renderHook(() => useOptimisticChatMessage(), { wrapper });

    act(() => {
      result.current.insert({
        sessionId: SESSION_ID,
        content: 'with niche',
        referencedNicheId: '11111111-1111-1111-1111-111111111111',
        referencedNicheName: 'Cats',
      });
    });

    const [message] = selectMessages(store);
    expect(message.referenced_niche_id).toBe(
      '11111111-1111-1111-1111-111111111111',
    );
    expect(message.referenced_niche_name).toBe('Cats');
  });

  it('insert defaults niche fields to null when not supplied (no chip case)', async () => {
    await seedCache(store);
    const { result } = renderHook(() => useOptimisticChatMessage(), { wrapper });

    act(() => {
      result.current.insert({ sessionId: SESSION_ID, content: 'no niche' });
    });

    const [message] = selectMessages(store);
    expect(message.referenced_niche_id).toBeNull();
    expect(message.referenced_niche_name).toBeNull();
  });

  it('rollback removes the temp message keyed by tempId', async () => {
    await seedCache(store);
    const { result } = renderHook(() => useOptimisticChatMessage(), { wrapper });

    let tempId = '';
    act(() => {
      tempId = result.current.insert({
        sessionId: SESSION_ID,
        content: 'will fail',
      });
    });
    expect(selectMessages(store)).toHaveLength(1);

    act(() => {
      result.current.rollback({ sessionId: SESSION_ID, tempId });
    });

    expect(selectMessages(store)).toHaveLength(0);
  });

  it('two sequential inserts produce two distinct temp ids', async () => {
    await seedCache(store);
    const { result } = renderHook(() => useOptimisticChatMessage(), { wrapper });

    let tempA = '';
    let tempB = '';
    act(() => {
      tempA = result.current.insert({ sessionId: SESSION_ID, content: 'A' });
      tempB = result.current.insert({ sessionId: SESSION_ID, content: 'B' });
    });

    expect(tempA).not.toBe(tempB);
    const messages = selectMessages(store);
    expect(messages.map((m) => m.id)).toEqual([tempA, tempB]);
  });

  it('rollback when cache slot is empty is a safe no-op', () => {
    const { result } = renderHook(() => useOptimisticChatMessage(), { wrapper });

    // Cache not seeded — updateQueryData will yield an empty draft. The
    // rollback path checks `draft.messages` before filtering, so this must
    // not throw.
    expect(() => {
      act(() => {
        result.current.rollback({ sessionId: SESSION_ID, tempId: 'temp_nope' });
      });
    }).not.toThrow();
  });

  it('temp id prefix is "temp_" so it can never collide with a server UUID', async () => {
    await seedCache(store);
    const { result } = renderHook(() => useOptimisticChatMessage(), { wrapper });

    // Force crypto.randomUUID() into a known shape so the prefix assertion is
    // deterministic regardless of test environment.
    const spy = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('00000000-0000-0000-0000-000000000000');
    let tempId = '';
    act(() => {
      tempId = result.current.insert({ sessionId: SESSION_ID, content: 'x' });
    });
    expect(tempId).toBe('temp_00000000-0000-0000-0000-000000000000');
    spy.mockRestore();
  });
});
