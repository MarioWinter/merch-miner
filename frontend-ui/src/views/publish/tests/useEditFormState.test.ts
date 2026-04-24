import { renderHook, act, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Listing, MbaProductCatalogEntry } from '../types';

// ---------------------------------------------------------------------------
// Mocks — publishSlice. Each mutation returns a trigger fn that resolves to
// a plain object (RTK Query-shaped: `.unwrap()` returns the awaited value).
// ---------------------------------------------------------------------------

// Per-call opt-in rejection. When `nextUpdateProductConfigError` is set,
// the next `unwrap()` rejects with it (simulating an RTK Query error),
// then resets. Lets a single test drive the 4xx-drop / 5xx-retry paths
// without polluting subsequent tests.
let nextUpdateProductConfigError: unknown = null;

const makeTrigger = () => {
  const spy = vi.fn(() => ({
    unwrap: () => Promise.resolve({}),
  }));
  return spy;
};

const mockUpdateProductConfig = vi.fn((...args: unknown[]) => ({
  unwrap: () => {
    if (nextUpdateProductConfigError !== null) {
      const err = nextUpdateProductConfigError;
      nextUpdateProductConfigError = null;
      return Promise.reject(err);
    }
    return Promise.resolve({});
  },
  args,
}));
const mockUpdateListing = makeTrigger();
const mockAiImprove = makeTrigger();

const mockCatalog: MbaProductCatalogEntry[] = [
  {
    key: 't_shirt',
    label: 'Standard T-Shirt',
    icon_key: 't_shirt',
    supports: ['fit_types', 'print_side', 'colors'],
    fit_types_options: ['men'],
    print_side_options: ['front'],
    colors_options: [{ key: 'black', name: 'Black', hex: '#000000' }],
    marketplaces: ['amazon.com'],
    default_prices: { 'amazon.com': 19.99 },
    royalty_formula: { 'amazon.com': { coef: 0.4, base: 5.04 } },
  },
];

// Mutable holder so tests can swap in product_config data for auto-focus.
let mockGetProductConfigResult: {
  data:
    | {
        id: string;
        design: string;
        marketplace_type: 'mba' | 'global' | 'displate';
        products_config: Array<{
          product_type: string;
          enabled: boolean;
          fit_types: string[];
          print_side: 'front' | 'back';
          colors: string[];
          marketplaces: Array<{
            marketplace: string;
            price: number;
            enabled: boolean;
          }>;
        }>;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
} = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  error: null,
};

vi.mock('@/store/publishSlice', () => ({
  useUpdateProductConfigMutation: () => [
    mockUpdateProductConfig,
    { isLoading: false, error: null },
  ],
  useUpdateListingMutation: () => [
    mockUpdateListing,
    { isLoading: false, error: null },
  ],
  useAiImproveListingMutation: () => [
    mockAiImprove,
    { isLoading: false, error: null },
  ],
  useGetMbaProductCatalogQuery: () => ({ data: mockCatalog, isLoading: false }),
  useGetProductConfigQuery: () => mockGetProductConfigResult,
}));

// Stub the typed Redux hook so the queue storage key is scoped. Default
// returns a live user + workspace pair so persistence is on; individual
// tests can override with `setAuthStub(...)` below.
let authStub: { userId: number | null; workspaceId: string | null } = {
  userId: 42,
  workspaceId: 'ws-abc',
};

const setAuthStub = (next: typeof authStub) => {
  authStub = next;
};

vi.mock('@/store/hooks', () => ({
  useAppSelector: (
    selector: (state: {
      auth: { user: { id: number } | null };
      workspace: { activeWorkspaceId: string | null };
    }) => unknown,
  ) =>
    selector({
      auth: {
        user: authStub.userId !== null ? { id: authStub.userId } : null,
      },
      workspace: { activeWorkspaceId: authStub.workspaceId },
    }),
}));

import { useEditFormState } from '../hooks/useEditFormState';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const listingFixture: Listing = {
  id: 'listing-1',
  idea: 'idea-1',
  design: 'design-1',
  marketplace_type: 'mba',
  round: 1,
  brand_name: 'BrandX',
  title: 'TitleX',
  bullet_1: 'B1',
  bullet_2: 'B2',
  description: 'Desc',
  keyword_context: 'kw',
  status: 'draft',
  generated_by: 'ai',
  availability: 'public',
  publish_mode: 'live',
  language: 'en',
  translations: {},
  created_at: '',
  updated_at: '',
};

const baseArgs = {
  designId: 'design-1',
  marketplaceType: 'mba' as const,
  listingId: 'listing-1',
  listing: listingFixture,
};

const lastUpdateProductConfigBody = () =>
  mockUpdateProductConfig.mock.calls.at(-1)?.[0] as
    | { designId: string; body: Record<string, unknown> }
    | undefined;

const lastUpdateListingBody = () =>
  mockUpdateListing.mock.calls.at(-1)?.[0] as
    | { id: string; body: Record<string, unknown> }
    | undefined;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const setOnline = (value: boolean) => {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
};

describe('useEditFormState — O2 auto-save hybrid', () => {
  beforeEach(() => {
    vi.useRealTimers();
    setOnline(true);
    localStorage.clear();
    setAuthStub({ userId: 42, workspaceId: 'ws-abc' });
    nextUpdateProductConfigError = null;
    mockGetProductConfigResult = {
      data: undefined,
      isLoading: false,
      isFetching: false,
      error: null,
    };
    mockUpdateProductConfig.mockClear();
    mockUpdateListing.mockClear();
    mockAiImprove.mockClear();
  });

  afterEach(() => {
    setOnline(true);
    localStorage.clear();
    setAuthStub({ userId: 42, workspaceId: 'ws-abc' });
  });

  // ---- controlSetters: immediate PATCH -----------------------------------
  it('controlSetters.toggleProductEnabled PATCHes immediately with op=upsert_product', async () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await act(async () => {
      await result.current.controlSetters.toggleProductEnabled('t_shirt', true);
    });
    const call = lastUpdateProductConfigBody();
    expect(call?.designId).toBe('design-1');
    expect(call?.body).toMatchObject({
      marketplace_type: 'mba',
      op: 'upsert_product',
      product_type: 't_shirt',
      patch: { enabled: true },
    });
  });

  it('controlSetters.setColors PATCHes with patch.colors', async () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await act(async () => {
      await result.current.controlSetters.setColors('t_shirt', ['black', 'white']);
    });
    expect(lastUpdateProductConfigBody()?.body).toMatchObject({
      product_type: 't_shirt',
      patch: { colors: ['black', 'white'] },
    });
  });

  // ---- priceSetters: 400ms debounce per key ------------------------------
  it('priceSetters.setPrice debounces: 4 keystrokes fire 1 PATCH 400ms after last', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEditFormState(baseArgs));
    act(() => {
      result.current.priceSetters.setPrice('t_shirt', 'amazon.com', 1);
      result.current.priceSetters.setPrice('t_shirt', 'amazon.com', 19);
      result.current.priceSetters.setPrice('t_shirt', 'amazon.com', 199);
      result.current.priceSetters.setPrice('t_shirt', 'amazon.com', 1999);
    });
    // Nothing fires before the debounce deadline.
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(mockUpdateProductConfig).not.toHaveBeenCalled();
    // Tick one more ms -> the debounced PATCH fires with only the final value.
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(mockUpdateProductConfig).toHaveBeenCalledTimes(1);
    expect(lastUpdateProductConfigBody()?.body).toMatchObject({
      op: 'upsert_product',
      product_type: 't_shirt',
      patch: {
        marketplaces: [
          { marketplace: 'amazon.com', price: 1999, enabled: true },
        ],
      },
    });
  });

  it('priceSetters.setPrice merges into the full marketplaces array (backend shallow-merge safe)', async () => {
    // Two-marketplace row; user only edits the amazon.com price.
    // The PATCH body must include BOTH rows, not just the edited one.
    mockGetProductConfigResult = {
      data: {
        id: 'pc-1',
        design: 'design-1',
        marketplace_type: 'mba',
        products_config: [
          {
            product_type: 't_shirt',
            enabled: true,
            fit_types: [],
            print_side: 'front',
            colors: [],
            marketplaces: [
              { marketplace: 'amazon.com', price: 19.99, enabled: true },
              { marketplace: 'amazon.de', price: 21.99, enabled: true },
            ],
          },
        ],
        created_at: '',
        updated_at: '',
      },
      isLoading: false,
      isFetching: false,
      error: null,
    };
    vi.useFakeTimers();
    const { result } = renderHook(() => useEditFormState(baseArgs));
    act(() => {
      result.current.priceSetters.setPrice('t_shirt', 'amazon.com', 24.99);
    });
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(mockUpdateProductConfig).toHaveBeenCalledTimes(1);
    expect(
      (lastUpdateProductConfigBody()?.body as {
        patch: { marketplaces: Array<unknown> };
      }).patch.marketplaces,
    ).toEqual([
      { marketplace: 'amazon.com', price: 24.99, enabled: true },
      { marketplace: 'amazon.de', price: 21.99, enabled: true },
    ]);
  });

  // Round 4 regression — previously ColorGrid built the next list in a
  // closure, so two clicks fired within the RTK invalidation window dropped
  // the first selection. toggleColor derives next from productsConfigRef.
  it('controlSetters.toggleColor — add + remove from latest server state (Round 4 race fix)', async () => {
    mockGetProductConfigResult = {
      data: {
        id: 'pc-1',
        design: 'design-1',
        marketplace_type: 'mba',
        products_config: [
          {
            product_type: 't_shirt',
            enabled: true,
            fit_types: [],
            print_side: 'front',
            colors: ['black'],
            marketplaces: [],
          },
        ],
        created_at: '',
        updated_at: '',
      },
      isLoading: false,
      isFetching: false,
      error: null,
    };
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await act(async () => {
      await result.current.controlSetters.toggleColor('t_shirt', 'navy');
    });
    expect(
      (lastUpdateProductConfigBody()?.body as { patch: { colors: string[] } })
        .patch.colors,
    ).toEqual(['black', 'navy']);

    // Simulate that the server-state updated; rapid successor click should
    // derive from the NEW state, not from the stale first-render closure.
    mockGetProductConfigResult.data!.products_config[0].colors = ['black', 'navy'];
    await act(async () => {
      await result.current.controlSetters.toggleColor('t_shirt', 'black');
    });
    expect(
      (lastUpdateProductConfigBody()?.body as { patch: { colors: string[] } })
        .patch.colors,
    ).toEqual(['navy']);
  });

  it('controlSetters.setMarketplaceEnabled toggles one row + preserves others', async () => {
    mockGetProductConfigResult = {
      data: {
        id: 'pc-1',
        design: 'design-1',
        marketplace_type: 'mba',
        products_config: [
          {
            product_type: 't_shirt',
            enabled: true,
            fit_types: [],
            print_side: 'front',
            colors: [],
            marketplaces: [
              { marketplace: 'amazon.com', price: 19.99, enabled: true },
              { marketplace: 'amazon.de', price: 21.99, enabled: true },
            ],
          },
        ],
        created_at: '',
        updated_at: '',
      },
      isLoading: false,
      isFetching: false,
      error: null,
    };
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await act(async () => {
      await result.current.controlSetters.setMarketplaceEnabled(
        't_shirt',
        'amazon.de',
        false,
      );
    });
    expect(
      (lastUpdateProductConfigBody()?.body as {
        patch: { marketplaces: Array<unknown> };
      }).patch.marketplaces,
    ).toEqual([
      { marketplace: 'amazon.com', price: 19.99, enabled: true },
      { marketplace: 'amazon.de', price: 21.99, enabled: false },
    ]);
  });

  // ---- textSetters: on-blur-if-dirty -------------------------------------
  it('textSetters.onBlur with unchanged value fires NO mutation', async () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await act(async () => {
      await result.current.textSetters.onBlur('title', listingFixture.title);
    });
    expect(mockUpdateListing).not.toHaveBeenCalled();
  });

  it('textSetters.onBlur with changed value PATCHes only the changed key', async () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await act(async () => {
      await result.current.textSetters.onBlur('title', 'New Title');
    });
    expect(mockUpdateListing).toHaveBeenCalledTimes(1);
    expect(lastUpdateListingBody()).toEqual({
      id: 'listing-1',
      body: { title: 'New Title' },
    });
  });

  // ---- textSetters: per-language translations (Round 5) -----------------
  it('textSetters.onBlurTranslated PATCHes translations JSONField', async () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await act(async () => {
      await result.current.textSetters.onBlurTranslated(
        'de',
        'title',
        'Deutscher Titel',
      );
    });
    expect(mockUpdateListing).toHaveBeenCalledTimes(1);
    const body = lastUpdateListingBody();
    expect(body).toEqual({
      id: 'listing-1',
      body: {
        translations: {
          de: { title: 'Deutscher Titel' },
        },
      },
    });
  });

  it('textSetters.onBlurTranslated merges sibling languages', async () => {
    // Seed the listing with an existing FR title; PATCHing DE must NOT
    // wipe the FR entry.
    const listingWithFr = {
      ...listingFixture,
      translations: {
        fr: { title: 'Titre FR', bullet_1: '', bullet_2: '', description: '' },
      },
    };
    const { result } = renderHook(() =>
      useEditFormState({ ...baseArgs, listing: listingWithFr }),
    );
    await act(async () => {
      await result.current.textSetters.onBlurTranslated(
        'de',
        'title',
        'DE Titel',
      );
    });
    const body = lastUpdateListingBody();
    expect((body!.body as { translations: unknown }).translations).toEqual({
      fr: { title: 'Titre FR', bullet_1: '', bullet_2: '', description: '' },
      de: { title: 'DE Titel' },
    });
  });

  it('textSetters.onBlurTranslated no-ops when unchanged', async () => {
    const listingWithDe = {
      ...listingFixture,
      translations: {
        de: {
          title: 'Same',
          bullet_1: '',
          bullet_2: '',
          description: '',
        },
      },
    };
    const { result } = renderHook(() =>
      useEditFormState({ ...baseArgs, listing: listingWithDe }),
    );
    await act(async () => {
      await result.current.textSetters.onBlurTranslated('de', 'title', 'Same');
    });
    expect(mockUpdateListing).not.toHaveBeenCalled();
  });

  // ---- manualSave flushes pending text + pending price ------------------
  it('manualSave flushes debounced price + buffered text in one pass', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEditFormState(baseArgs));
    act(() => {
      result.current.priceSetters.setPrice('t_shirt', 'amazon.com', 25);
      result.current.textSetters.onChange('title', 'Manual Save Title');
    });
    // No mutation yet — debounce hasn't fired and text wasn't blurred.
    expect(mockUpdateProductConfig).not.toHaveBeenCalled();
    expect(mockUpdateListing).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.manualSave();
    });
    expect(mockUpdateProductConfig).toHaveBeenCalledTimes(1);
    expect(mockUpdateListing).toHaveBeenCalledTimes(1);
    expect(lastUpdateListingBody()).toEqual({
      id: 'listing-1',
      body: { title: 'Manual Save Title' },
    });
  });

  // ---- discard clears pending state without firing mutations ------------
  it('discard clears buffered text + pending price; no mutations fire', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEditFormState(baseArgs));
    act(() => {
      result.current.priceSetters.setPrice('t_shirt', 'amazon.com', 42);
      result.current.textSetters.onChange('title', 'Pending Title');
    });
    act(() => {
      result.current.discard();
    });
    // Advance past the debounce window — no PATCH should fire.
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });
    expect(mockUpdateProductConfig).not.toHaveBeenCalled();
    expect(mockUpdateListing).not.toHaveBeenCalled();
  });

  // ---- royaltyFor pure function --------------------------------------
  it('royaltyFor computes price*coef − base from catalog', () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    // 19.99 * 0.4 − 5.04 = 2.956 → rounded 2.96
    expect(result.current.royaltyFor('t_shirt', 'amazon.com', 19.99)).toBe(2.96);
  });

  it('royaltyFor returns null for unknown product', () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    expect(result.current.royaltyFor('not_a_product', 'amazon.com', 19.99)).toBeNull();
  });

  it('royaltyFor returns the raw negative when price is below break-even', () => {
    // P4 surfaces losses in red — `royaltyFor` no longer clamps.
    const { result } = renderHook(() => useEditFormState(baseArgs));
    // 1 * 0.4 − 5.04 = −4.64
    expect(result.current.royaltyFor('t_shirt', 'amazon.com', 1)).toBe(-4.64);
  });

  // ---- aiImprove triggers mutation ---------------------------------------
  it('aiImprove calls the ai-improve mutation with the current listingId', async () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await act(async () => {
      await result.current.aiImprove();
    });
    expect(mockAiImprove).toHaveBeenCalledWith('listing-1');
  });

  // ---- Phase O4 scoping: storage key per user + workspace ---------------
  it('persists queue under a key scoped to {userId}:{workspaceId}', () => {
    setAuthStub({ userId: 7, workspaceId: 'ws-xyz' });
    const { result } = renderHook(() => useEditFormState(baseArgs));
    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      void result.current.controlSetters.toggleProductEnabled('t_shirt', true);
    });
    expect(result.current.queueLength).toBe(1);
    expect(
      localStorage.getItem('mm.publish.editFormQueue.v1:7:ws-xyz'),
    ).not.toBeNull();
    // Other (user, workspace) combinations must be untouched.
    expect(
      localStorage.getItem('mm.publish.editFormQueue.v1:42:ws-abc'),
    ).toBeNull();
  });

  it('runs ref-only (no persist) when user or workspace is missing', () => {
    setAuthStub({ userId: null, workspaceId: 'ws-abc' });
    const { result } = renderHook(() => useEditFormState(baseArgs));
    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      void result.current.controlSetters.toggleProductEnabled('t_shirt', true);
    });
    expect(result.current.queueLength).toBe(1);
    // No key matching the prefix should exist.
    const keys = Object.keys(localStorage);
    expect(
      keys.some((k) => k.startsWith('mm.publish.editFormQueue.v1')),
    ).toBe(false);
  });

  // ---- Phase O4: classify retry vs drop --------------------------------
  it('drops op from queue on 4xx (non-transient validation error)', async () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      void result.current.controlSetters.toggleProductEnabled('t_shirt', true);
    });
    expect(result.current.queueLength).toBe(1);

    // Next flush call will reject with 400 → classifyQueueError drops it.
    nextUpdateProductConfigError = { status: 400, data: { detail: 'bad' } };
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.queueLength).toBe(0));
    // Op was attempted exactly once then dropped (not re-queued).
    expect(mockUpdateProductConfig).toHaveBeenCalledTimes(1);
  });

  it('retries op on 5xx (transient server error)', async () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    act(() => {
      void result.current.controlSetters.toggleProductEnabled('t_shirt', true);
    });
    expect(result.current.queueLength).toBe(1);

    // First flush: 503 → retry path; queue keeps the op at head.
    nextUpdateProductConfigError = { status: 503, data: 'server down' };
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(mockUpdateProductConfig).toHaveBeenCalledTimes(1));
    expect(result.current.queueLength).toBe(1);

    // Second flush: server recovers; op drains.
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current.queueLength).toBe(0));
    expect(mockUpdateProductConfig).toHaveBeenCalledTimes(2);
  });

  // ---- Phase O4: offline PATCH queue ------------------------------------
  it('offline → 3 toggles → queue=3 → online → 3 PATCHes fire in FIFO order', async () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));

    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    act(() => {
      void result.current.controlSetters.toggleProductEnabled('t_shirt', true);
      void result.current.controlSetters.toggleProductEnabled('hoodie', true);
      void result.current.controlSetters.toggleProductEnabled('tank_top', true);
    });

    expect(mockUpdateProductConfig).not.toHaveBeenCalled();
    expect(result.current.queueLength).toBe(3);

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(result.current.queueLength).toBe(0));
    expect(mockUpdateProductConfig).toHaveBeenCalledTimes(3);
    const productOrder = mockUpdateProductConfig.mock.calls.map(
      (c) => (c[0] as { body: { product_type: string } }).body.product_type,
    );
    expect(productOrder).toEqual(['t_shirt', 'hoodie', 'tank_top']);
  });

  // ---- Phase O5: per-key serialization (EC-38) --------------------------
  it('serializes PATCHes for the same listing_id: second awaits first (EC-38)', async () => {
    // Make `updateListing` return manually-controlled promises so we can
    // observe whether the second call is held back while the first is
    // still in flight.
    const resolvers: Array<(v?: unknown) => void> = [];
    const originalListingImpl = mockUpdateListing.getMockImplementation();
    mockUpdateListing.mockImplementation(() => ({
      unwrap: () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    }));

    try {
      const { result } = renderHook(() => useEditFormState(baseArgs));

      // Two blur PATCHes on the SAME listing, back-to-back.
      act(() => {
        void result.current.textSetters.onBlur('title', 'first');
        void result.current.textSetters.onBlur('bullet_1', 'second');
      });

      // Only the first mutation should be in flight.
      await waitFor(() =>
        expect(mockUpdateListing).toHaveBeenCalledTimes(1),
      );
      expect(
        (mockUpdateListing.mock.calls[0] as [{ body: Record<string, unknown> }])[0].body,
      ).toEqual({ title: 'first' });

      // Resolve the first → chain releases the second.
      await act(async () => {
        resolvers[0]?.({});
      });
      await waitFor(() =>
        expect(mockUpdateListing).toHaveBeenCalledTimes(2),
      );
      expect(
        (mockUpdateListing.mock.calls[1] as [{ body: Record<string, unknown> }])[0].body,
      ).toEqual({ bullet_1: 'second' });

      // Drain.
      await act(async () => {
        resolvers[1]?.({});
      });
    } finally {
      mockUpdateListing.mockImplementation(
        originalListingImpl ?? (() => ({ unwrap: () => Promise.resolve({}) })),
      );
    }
  });

  it('serializes PATCHes for the same (design, marketplace) config row', async () => {
    const resolvers: Array<(v?: unknown) => void> = [];
    const originalImpl = mockUpdateProductConfig.getMockImplementation();
    mockUpdateProductConfig.mockImplementation(() => ({
      unwrap: () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    }));

    try {
      const { result } = renderHook(() => useEditFormState(baseArgs));

      // Two control PATCHes on the same (design-1, mba) row.
      act(() => {
        void result.current.controlSetters.toggleProductEnabled('t_shirt', true);
        void result.current.controlSetters.setColors('t_shirt', ['black']);
      });

      await waitFor(() =>
        expect(mockUpdateProductConfig).toHaveBeenCalledTimes(1),
      );
      expect(
        (mockUpdateProductConfig.mock.calls[0] as [
          { body: { patch: unknown } },
        ])[0].body.patch,
      ).toEqual({ enabled: true });

      await act(async () => {
        resolvers[0]?.({});
      });
      await waitFor(() =>
        expect(mockUpdateProductConfig).toHaveBeenCalledTimes(2),
      );
      expect(
        (mockUpdateProductConfig.mock.calls[1] as [
          { body: { patch: unknown } },
        ])[0].body.patch,
      ).toEqual({ colors: ['black'] });

      await act(async () => {
        resolvers[1]?.({});
      });
    } finally {
      mockUpdateProductConfig.mockImplementation(
        originalImpl ?? (() => ({ unwrap: () => Promise.resolve({}) })),
      );
    }
  });

  it('chain recovers after a dropped 4xx: next same-key PATCH still fires', async () => {
    // Reject the first PATCH with a 4xx (→ classifyQueueError = drop,
    // queue shifts past it). Then blur a second field on the same
    // listing — the chain must not be stuck on the rejected tail.
    const { result } = renderHook(() => useEditFormState(baseArgs));

    // Arm first call to reject 400, second to succeed.
    nextUpdateProductConfigError = null; // leave config mock alone
    const originalListingImpl = mockUpdateListing.getMockImplementation();
    let callIdx = 0;
    mockUpdateListing.mockImplementation(() => ({
      unwrap: () => {
        callIdx += 1;
        if (callIdx === 1) {
          return Promise.reject({ status: 400, data: 'bad' });
        }
        return Promise.resolve({});
      },
    }));

    try {
      act(() => {
        void result.current.textSetters.onBlur('title', 'first');
        void result.current.textSetters.onBlur('bullet_1', 'second');
      });

      await waitFor(() =>
        expect(mockUpdateListing).toHaveBeenCalledTimes(2),
      );
      expect(
        (mockUpdateListing.mock.calls[1] as [{ body: Record<string, unknown> }])[0].body,
      ).toEqual({ bullet_1: 'second' });
    } finally {
      mockUpdateListing.mockImplementation(
        originalListingImpl ?? (() => ({ unwrap: () => Promise.resolve({}) })),
      );
    }
  });

  // ---- focusedProduct state ----------------------------------------------
  it('setFocusedProduct updates focusedProduct', () => {
    const { result } = renderHook(() => useEditFormState(baseArgs));
    expect(result.current.focusedProduct).toBeNull();
    act(() => {
      result.current.setFocusedProduct('hoodie_pullover');
    });
    expect(result.current.focusedProduct).toBe('hoodie_pullover');
  });

  // ---- Auto-focus (P1/P2 cleanup) ----------------------------------------
  it('auto-focuses the first enabled product when none is focused', async () => {
    mockGetProductConfigResult = {
      data: {
        id: 'pc-1',
        design: 'design-1',
        marketplace_type: 'mba',
        products_config: [
          {
            product_type: 'popsocket',
            enabled: false,
            fit_types: [],
            print_side: 'front',
            colors: [],
            marketplaces: [],
          },
          {
            product_type: 'hoodie_pullover',
            enabled: true,
            fit_types: [],
            print_side: 'front',
            colors: [],
            marketplaces: [],
          },
          {
            product_type: 't_shirt',
            enabled: true,
            fit_types: [],
            print_side: 'front',
            colors: [],
            marketplaces: [],
          },
        ],
        created_at: '',
        updated_at: '',
      },
      isLoading: false,
      isFetching: false,
      error: null,
    };
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await waitFor(() =>
      expect(result.current.focusedProduct).toBe('hoodie_pullover'),
    );
  });

  it('does not overwrite focus when the user has explicitly chosen a product', async () => {
    mockGetProductConfigResult = {
      data: {
        id: 'pc-1',
        design: 'design-1',
        marketplace_type: 'mba',
        products_config: [
          {
            product_type: 'tank_top',
            enabled: true,
            fit_types: [],
            print_side: 'front',
            colors: [],
            marketplaces: [],
          },
        ],
        created_at: '',
        updated_at: '',
      },
      isLoading: false,
      isFetching: false,
      error: null,
    };
    const { result } = renderHook(() => useEditFormState(baseArgs));
    await waitFor(() => expect(result.current.focusedProduct).toBe('tank_top'));
    act(() => {
      result.current.setFocusedProduct('popsocket');
    });
    // Config would still auto-focus 'tank_top' as first-enabled — but user's
    // choice takes priority and is preserved.
    expect(result.current.focusedProduct).toBe('popsocket');
  });

  it('clears focus when (design, marketplace) changes', async () => {
    mockGetProductConfigResult = {
      data: {
        id: 'pc-1',
        design: 'design-1',
        marketplace_type: 'mba',
        products_config: [
          {
            product_type: 'popsocket',
            enabled: true,
            fit_types: [],
            print_side: 'front',
            colors: [],
            marketplaces: [],
          },
        ],
        created_at: '',
        updated_at: '',
      },
      isLoading: false,
      isFetching: false,
      error: null,
    };
    const { result, rerender } = renderHook(
      (args: typeof baseArgs) => useEditFormState(args),
      { initialProps: baseArgs },
    );
    await waitFor(() => expect(result.current.focusedProduct).toBe('popsocket'));
    // Switch design — auto-focus effect fires again for the new scope.
    mockGetProductConfigResult = {
      data: {
        id: 'pc-2',
        design: 'design-2',
        marketplace_type: 'mba',
        products_config: [
          {
            product_type: 'hoodie_pullover',
            enabled: true,
            fit_types: [],
            print_side: 'front',
            colors: [],
            marketplaces: [],
          },
        ],
        created_at: '',
        updated_at: '',
      },
      isLoading: false,
      isFetching: false,
      error: null,
    };
    rerender({ ...baseArgs, designId: 'design-2' });
    await waitFor(() =>
      expect(result.current.focusedProduct).toBe('hoodie_pullover'),
    );
  });
});
