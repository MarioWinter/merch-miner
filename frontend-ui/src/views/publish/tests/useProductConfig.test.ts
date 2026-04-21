import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DesignProductConfig } from '../types';

// ---------------------------------------------------------------------------
// Mocks — stub only the RTK Query hooks from publishSlice so the hook under
// test exercises real debounce/optimistic logic while we control the server
// surface. Same `importOriginal` pattern used in ColorGrid.test.tsx.
// ---------------------------------------------------------------------------

type QueryResult = {
  data: DesignProductConfig | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
};

const mockQueryResult: QueryResult = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  error: null,
};

const mockUpdateMutation = vi.fn();

const setQueryState = (state: Partial<QueryResult>) => {
  Object.assign(mockQueryResult, {
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    ...state,
  });
};

vi.mock('@/store/publishSlice', () => ({
  useGetProductConfigQuery: () => mockQueryResult,
  useUpdateProductConfigMutation: () => [
    mockUpdateMutation,
    { isLoading: false },
  ],
}));

import { useProductConfig } from '../hooks/useProductConfig';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeConfig = (
  overrides: Partial<DesignProductConfig> = {},
): DesignProductConfig => ({
  id: 'cfg-1',
  design: 'design-1',
  marketplace_type: 'mba',
  product_types: ['t_shirt'],
  fit_types: ['mens'],
  print_side: 'front',
  colors: ['black'],
  marketplaces: [],
  created_at: '',
  updated_at: '',
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useProductConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setQueryState({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps 404 from GET to empty defaults', () => {
    setQueryState({ error: { status: 404, data: {} } });
    const { result } = renderHook(() =>
      useProductConfig({ designId: 'design-1', marketplaceType: 'mba' }),
    );
    expect(result.current.config).toEqual({
      productTypes: [],
      fitTypes: [],
      printSide: 'front',
      colors: [],
      marketplaces: [],
    });
    // 404 is not a hard error — the hook silences it so the UI can render.
    expect(result.current.loadError).toBeNull();
  });

  it('setColors schedules a debounced PATCH 1200ms later', async () => {
    setQueryState({ data: makeConfig() });
    mockUpdateMutation.mockReturnValue({
      unwrap: () => Promise.resolve(makeConfig({ colors: ['black', 'navy'] })),
    });
    const { result } = renderHook(() =>
      useProductConfig({ designId: 'design-1', marketplaceType: 'mba' }),
    );

    act(() => {
      result.current.setColors(['black', 'navy']);
    });
    // Optimistic local state updates instantly; no PATCH fires yet.
    expect(result.current.config.colors).toEqual(['black', 'navy']);
    expect(mockUpdateMutation).not.toHaveBeenCalled();

    // Advance past the debounce window.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(mockUpdateMutation).toHaveBeenCalledTimes(1);
    expect(mockUpdateMutation).toHaveBeenCalledWith({
      designId: 'design-1',
      body: {
        colors: ['black', 'navy'],
        marketplace_type: 'mba',
      },
    });
  });

  it('coalesces two setter calls within the debounce window into a single PATCH', async () => {
    setQueryState({ data: makeConfig() });
    mockUpdateMutation.mockReturnValue({
      unwrap: () => Promise.resolve(makeConfig()),
    });
    const { result } = renderHook(() =>
      useProductConfig({ designId: 'design-1', marketplaceType: 'mba' }),
    );

    act(() => {
      result.current.setColors(['black']);
    });
    // Advance part-way; second setter call should reset the timer.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    act(() => {
      result.current.setColors(['black', 'navy']);
    });
    // Still no call — debounce restarted.
    expect(mockUpdateMutation).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    expect(mockUpdateMutation).toHaveBeenCalledTimes(1);
    // Latest body wins — pendingBodyRef accumulates patches.
    expect(mockUpdateMutation).toHaveBeenCalledWith({
      designId: 'design-1',
      body: expect.objectContaining({
        colors: ['black', 'navy'],
        marketplace_type: 'mba',
      }),
    });
  });

  it('flush() immediately fires the pending PATCH and resolves', async () => {
    setQueryState({ data: makeConfig() });
    mockUpdateMutation.mockReturnValue({
      unwrap: () => Promise.resolve(makeConfig()),
    });
    const { result } = renderHook(() =>
      useProductConfig({ designId: 'design-1', marketplaceType: 'mba' }),
    );

    act(() => {
      result.current.setFitTypes(['mens', 'womens']);
    });
    expect(mockUpdateMutation).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.flush();
    });

    // flush() bypasses the debounce and sends immediately.
    expect(mockUpdateMutation).toHaveBeenCalledTimes(1);
    expect(mockUpdateMutation).toHaveBeenCalledWith({
      designId: 'design-1',
      body: {
        fit_types: ['mens', 'womens'],
        marketplace_type: 'mba',
      },
    });
  });

  it('isAutoSaving flips true while the mutation is in-flight and back to false when it resolves', async () => {
    setQueryState({ data: makeConfig() });
    // Controllable promise — we advance timers, then assert mid-flight state,
    // then resolve.
    let resolveMutation: (value: DesignProductConfig) => void = () => {};
    const pending = new Promise<DesignProductConfig>((resolve) => {
      resolveMutation = resolve;
    });
    mockUpdateMutation.mockReturnValue({ unwrap: () => pending });

    const { result } = renderHook(() =>
      useProductConfig({ designId: 'design-1', marketplaceType: 'mba' }),
    );

    expect(result.current.isAutoSaving).toBe(false);

    act(() => {
      result.current.setPrintSide('back');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200);
    });

    // Mutation fired but hasn't resolved yet.
    expect(result.current.isAutoSaving).toBe(true);

    await act(async () => {
      resolveMutation(makeConfig({ print_side: 'back' }));
      await pending;
    });

    expect(result.current.isAutoSaving).toBe(false);
  });
});
