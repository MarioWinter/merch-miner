/**
 * PROJ-20 Phase 3.4 — useNicheChipSync tests
 *
 * Strategy: render a tiny harness that
 *   - configures a real chatBarSlice store (so dispatched actions update state)
 *   - exposes `pushQuery(...)` so the test can swap what the mocked
 *     `useGetNicheQuery` returns between re-renders
 *   - holds a stable, mocked SmartTextarea ref with `insertChipMock` /
 *     `removeChipMock` we can assert on.
 *
 * We mock the entire `@/store/nicheSlice` and `notistack` modules so we don't
 * have to wire `nicheApi.middleware` into the test store, mirroring the
 * pattern already used in `__tests__/index.test.tsx`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import chatBarReducer, {
  setActiveNicheId,
  setActiveSession,
  setInputChip,
} from '@/store/chatBarSlice';
import type { SmartTextareaHandle } from '../SmartTextarea';

// ---- Mocks ----

/* eslint-disable @typescript-eslint/no-explicit-any */
interface MockNicheQueryResult {
  data: { id: string; name: string } | undefined;
  isError: boolean;
  isLoading: boolean;
}

// vi.mock factories are hoisted ABOVE all top-level statements, so any value
// they touch must be created via vi.hoisted (which is hoisted further still).
const { fa, queryHolder, enqueueSnackbarMock } = vi.hoisted(() => ({
  fa: (n: string) => ({
    reducerPath: n,
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: { resetApiState: () => ({ type: 'noop' }) },
  }),
  queryHolder: {
    current: { data: undefined, isError: false, isLoading: false } as
      | { data: { id: string; name: string } | undefined; isError: boolean; isLoading: boolean },
  },
  enqueueSnackbarMock: vi.fn(),
}));

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: enqueueSnackbarMock }),
  SnackbarProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/store/nicheSlice', () => ({
  nicheApi: fa('nicheApi'),
  useGetNicheQuery: (_id: string, opts?: { skip?: boolean }) => {
    if (opts?.skip) {
      return { data: undefined, isError: false, isLoading: false };
    }
    return queryHolder.current;
  },
}));

// Stub i18n: no provider is attached (we don't pull in test-utils to avoid
// dragging the global store). The hook only uses `t()` for the toast
// messages, so a key-passthrough is enough to assert on.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts.name === 'string') return `${key}:${opts.name}`;
      return key;
    },
  }),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

// Imported after mocks so the hook picks the mocked deps.
import { useNicheChipSync } from '../hooks/useNicheChipSync';

// ---- Harness ----

interface HarnessHandle {
  insertChipMock: ReturnType<typeof vi.fn>;
  removeChipMock: ReturnType<typeof vi.fn>;
  setChip: (chip: { niche_id: string; niche_name: string } | null) => void;
}

interface HarnessProps {
  initialChip?: { niche_id: string; niche_name: string } | null;
}

const Harness = forwardRef<HarnessHandle, HarnessProps>(function Harness(
  { initialChip = null },
  ref,
) {
  // The textarea is purely a stub — we just need a stable ref the hook can
  // call into. We simulate the chip state via a `chipRef` that the
  // imperative methods mutate so `getValue()` reflects reality.
  const [mocks] = useState(() => ({
    insertChipMock: vi.fn(),
    removeChipMock: vi.fn(),
  }));
  const chipRef = useRef<{ niche_id: string; niche_name: string } | null>(
    initialChip,
  );

  const handleRef = useRef<SmartTextareaHandle>({
    getValue: () => ({ text: '', chip: chipRef.current }),
    insertChip: (chip) => {
      mocks.insertChipMock(chip);
      chipRef.current = { niche_id: chip.niche_id, niche_name: chip.niche_name };
    },
    removeChip: () => {
      mocks.removeChipMock();
      chipRef.current = null;
    },
    clear: vi.fn(),
    focus: vi.fn(),
    getEditableElement: () => null,
  });

  useNicheChipSync({ smartTextareaRef: handleRef });

  useImperativeHandle(ref, () => ({
    insertChipMock: mocks.insertChipMock,
    removeChipMock: mocks.removeChipMock,
    setChip: (chip) => {
      chipRef.current = chip;
    },
  }));

  return null;
});

interface RenderOptions {
  initialNicheId?: string | null;
  initialSessionId?: string | null;
  initialChip?: { niche_id: string; niche_name: string } | null;
  query?: MockNicheQueryResult;
}

const renderHarness = (opts: RenderOptions = {}) => {
  queryHolder.current = opts.query ?? { data: undefined, isError: false, isLoading: false };

  const store = configureStore({
    reducer: { chatBar: chatBarReducer },
    preloadedState: {
      chatBar: {
        barExpanded: false,
        drawerOpen: false,
        drawerWidth: 480 as const,
        activePanel: 'chat' as const,
        activeSessionId: opts.initialSessionId ?? null,
        activeAgentSessionId: null,
        inputChip: opts.initialChip ?? null,
        activeNicheId: opts.initialNicheId ?? null,
        nicheMode: 'edit' as const,
        searching: false,
        searchSources: ['web'] as const,
        selectedModel: 'gpt-4.1-mini',
        modeOverride: 'auto' as const,
        streamingAssistantMessage: {
          id: null,
          content: '',
          sources: [],
          isStreaming: false,
        },
      },
    },
  });

  const ref: Ref<HarnessHandle> = { current: null };
  const utils = render(
    <Provider store={store}>
      <Harness ref={ref} initialChip={opts.initialChip ?? null} />
    </Provider>,
  );
  return { store, ref: ref as { current: HarnessHandle | null }, ...utils };
};

const setQueryAndRerender = (
  store: ReturnType<typeof renderHarness>['store'],
  query: MockNicheQueryResult,
) => {
  // Update the holder, then trigger a state-change so the hook re-runs.
  queryHolder.current = query;
  // Dispatch a no-op-style action to force re-render — easiest: dispatch
  // a setter back to its current value.
  act(() => {
    store.dispatch({ type: 'chatBar/__noop__' });
  });
};

// ---- Tests ----

beforeEach(() => {
  enqueueSnackbarMock.mockReset();
  queryHolder.current = { data: undefined, isError: false, isLoading: false };
});

describe('useNicheChipSync (PROJ-20 Phase 3.4)', () => {
  it('mount with no activeNicheId → no chip inserted', () => {
    const { ref } = renderHarness({ initialNicheId: null });
    expect(ref.current?.insertChipMock).not.toHaveBeenCalled();
    expect(ref.current?.removeChipMock).not.toHaveBeenCalled();
    expect(enqueueSnackbarMock).not.toHaveBeenCalled();
  });

  it('mount with activeNicheId → chip inserted, no swap toast (initial prefill)', () => {
    const { ref } = renderHarness({
      initialNicheId: 'n-1',
      query: {
        data: { id: 'n-1', name: 'Halloween' },
        isError: false,
        isLoading: false,
      },
    });
    expect(ref.current?.insertChipMock).toHaveBeenCalledWith({
      niche_id: 'n-1',
      niche_name: 'Halloween',
    });
    expect(enqueueSnackbarMock).not.toHaveBeenCalled();
  });

  it('activeNicheId changes from A to B → chip swaps + swap toast fires', () => {
    const { ref, store } = renderHarness({
      initialNicheId: 'n-1',
      query: {
        data: { id: 'n-1', name: 'Halloween' },
        isError: false,
        isLoading: false,
      },
    });
    // Initial prefill happened.
    expect(ref.current?.insertChipMock).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbarMock).not.toHaveBeenCalled();

    // Swap to a different niche; the mocked query now returns niche B.
    queryHolder.current = {
      data: { id: 'n-2', name: 'Christmas' },
      isError: false,
      isLoading: false,
    };
    act(() => {
      store.dispatch(setActiveNicheId('n-2'));
    });

    expect(ref.current?.insertChipMock).toHaveBeenCalledTimes(2);
    expect(ref.current?.insertChipMock).toHaveBeenLastCalledWith({
      niche_id: 'n-2',
      niche_name: 'Christmas',
    });
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'search.chatBar.contextUpdated:Christmas',
      expect.objectContaining({ variant: 'info' }),
    );
  });

  it('activeNicheId set to null → chip removed (no toast)', () => {
    const { ref, store } = renderHarness({
      initialNicheId: 'n-1',
      initialChip: { niche_id: 'n-1', niche_name: 'Halloween' },
      query: {
        data: { id: 'n-1', name: 'Halloween' },
        isError: false,
        isLoading: false,
      },
    });
    enqueueSnackbarMock.mockReset();

    // The harness chipRef is already set; clear active niche.
    act(() => {
      store.dispatch(setActiveNicheId(null));
    });
    expect(ref.current?.removeChipMock).toHaveBeenCalled();
    expect(enqueueSnackbarMock).not.toHaveBeenCalled();
  });

  it('manual chip removal disables auto-prefill for the rest of the session', () => {
    const { ref, store } = renderHarness({
      initialNicheId: 'n-1',
      query: {
        data: { id: 'n-1', name: 'Halloween' },
        isError: false,
        isLoading: false,
      },
    });
    expect(ref.current?.insertChipMock).toHaveBeenCalledTimes(1);

    // User manually clears the chip via the chip's ✕ button — Redux
    // `inputChip` transitions non-null → null while `activeNicheId` is
    // still 'n-1'. (We populate the chip first so the transition is
    // truly non-null → null.)
    act(() => {
      store.dispatch(setInputChip({ niche_id: 'n-1', niche_name: 'Halloween' }));
    });
    act(() => {
      store.dispatch(setInputChip(null));
    });

    // Switching the active niche should no longer re-insert.
    queryHolder.current = {
      data: { id: 'n-2', name: 'Christmas' },
      isError: false,
      isLoading: false,
    };
    act(() => {
      store.dispatch(setActiveNicheId('n-2'));
    });

    // Still only the original prefill call.
    expect(ref.current?.insertChipMock).toHaveBeenCalledTimes(1);
  });

  it('session change resets autoPrefillDisabled — chip can be auto-prefilled again', () => {
    const { ref, store } = renderHarness({
      initialNicheId: 'n-1',
      initialSessionId: 'sess-1',
      query: {
        data: { id: 'n-1', name: 'Halloween' },
        isError: false,
        isLoading: false,
      },
    });
    expect(ref.current?.insertChipMock).toHaveBeenCalledTimes(1);

    // Lock auto-prefill via manual removal.
    act(() => {
      store.dispatch(setInputChip({ niche_id: 'n-1', niche_name: 'Halloween' }));
    });
    act(() => {
      store.dispatch(setInputChip(null));
    });

    // Confirm lock: niche switch does not re-insert.
    queryHolder.current = {
      data: { id: 'n-2', name: 'Christmas' },
      isError: false,
      isLoading: false,
    };
    act(() => {
      store.dispatch(setActiveNicheId('n-2'));
    });
    expect(ref.current?.insertChipMock).toHaveBeenCalledTimes(1);

    // New session → flag resets.
    act(() => {
      store.dispatch(setActiveSession('sess-2'));
    });
    // Now switching activeNicheId should auto-prefill again.
    queryHolder.current = {
      data: { id: 'n-3', name: 'Easter' },
      isError: false,
      isLoading: false,
    };
    act(() => {
      store.dispatch(setActiveNicheId('n-3'));
    });
    expect(ref.current?.insertChipMock).toHaveBeenCalledTimes(2);
    expect(ref.current?.insertChipMock).toHaveBeenLastCalledWith({
      niche_id: 'n-3',
      niche_name: 'Easter',
    });
  });

  it('niche query error (404 / deleted) → chip removed + toast + activeNicheId cleared', () => {
    const { ref, store } = renderHarness({
      initialNicheId: 'n-1',
      query: {
        data: { id: 'n-1', name: 'Halloween' },
        isError: false,
        isLoading: false,
      },
    });
    // Initial prefill — captures lastKnownName.
    expect(ref.current?.insertChipMock).toHaveBeenCalledTimes(1);
    enqueueSnackbarMock.mockReset();

    // Simulate the niche being deleted while the chip is active.
    setQueryAndRerender(store, {
      data: undefined,
      isError: true,
      isLoading: false,
    });

    expect(ref.current?.removeChipMock).toHaveBeenCalled();
    expect(enqueueSnackbarMock).toHaveBeenCalledWith(
      'search.chatBar.contextDeleted:Halloween',
      expect.objectContaining({ variant: 'warning' }),
    );
    // Redux cleaned up.
    expect(store.getState().chatBar.activeNicheId).toBeNull();
  });
});
