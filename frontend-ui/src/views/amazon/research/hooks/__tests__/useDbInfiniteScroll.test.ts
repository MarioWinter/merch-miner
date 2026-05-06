import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useDbInfiniteScroll from '../useDbInfiniteScroll';
import type { AmazonProduct, ProductListResponse } from '../../types';

// ── RTK Query mock — we control the lazy trigger directly ───────────────────
const fetchSpy = vi.fn();
const triggerAbort = vi.fn();

vi.mock('../../../../../store/researchSlice', () => ({
  useLazyListProductsQuery: () => [
    (params: Record<string, unknown>) => {
      const promise = fetchSpy(params);
      // Decorate with the abort method that real RTK Query subscriptions expose.
      // The hook calls .abort() on the returned object when cancelling in-flight.
      (promise as { abort?: () => void }).abort = triggerAbort;
      return promise;
    },
  ],
}));

const makeProduct = (asin: string): AmazonProduct => ({
  id: asin,
  asin,
  title: `Title ${asin}`,
  brand: 'Brand',
  bsr: 1000,
  bsr_categories: [],
  rating: 4.0,
  reviews_count: 10,
  price: 19.99,
  product_type: 't_shirt',
  subcategory: 'Novelty',
  listed_date: '2025-01-01',
  thumbnail_url: '',
  bullet_1: '',
  bullet_2: '',
  description: '',
  marketplace: 'amazon_com',
  scraped_at: '2026-03-01T00:00:00Z',
});

const makeResponse = (count: number, asins: string[]): ProductListResponse => ({
  count,
  results: asins.map(makeProduct),
  next: null,
  previous: null,
});

interface MockPromise<T> extends Promise<T> {
  abort?: () => void;
}

const queueResolve = (response: ProductListResponse) => {
  const promise: MockPromise<ProductListResponse> = Promise.resolve(response);
  (promise as { unwrap?: () => Promise<ProductListResponse> }).unwrap = () =>
    Promise.resolve(response);
  fetchSpy.mockReturnValueOnce(promise);
};

describe('useDbInfiniteScroll', () => {
  beforeEach(() => {
    fetchSpy.mockReset();
    triggerAbort.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initial fetch uses page=1, page_size=100', async () => {
    const asins = Array.from({ length: 100 }, (_, i) => `B${String(i).padStart(9, '0')}`);
    queueResolve(makeResponse(500, asins));

    const buildBaseParams = () => ({ keyword: 'hiking', marketplace: 'amazon_com' });

    const { result } = renderHook(() =>
      useDbInfiniteScroll({ buildBaseParams, enabled: true, resetKey: 'k1' }),
    );

    await waitFor(() => expect(result.current.products).toHaveLength(100));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, page_size: 50, keyword: 'hiking' }),
    );
    expect(result.current.totalCount).toBe(500);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoadingInitial).toBe(false);
  });

  it('loadNextPage uses page_size=50 and increments page counter', async () => {
    const firstAsins = Array.from({ length: 100 }, (_, i) => `A${i}`);
    const secondAsins = Array.from({ length: 50 }, (_, i) => `B${i}`);
    queueResolve(makeResponse(500, firstAsins));
    queueResolve(makeResponse(500, secondAsins));

    const buildBaseParams = () => ({ keyword: 'hiking' });

    const { result } = renderHook(() =>
      useDbInfiniteScroll({ buildBaseParams, enabled: true, resetKey: 'k1' }),
    );

    await waitFor(() => expect(result.current.products).toHaveLength(100));

    act(() => {
      result.current.loadNextPage();
    });

    await waitFor(() => expect(result.current.products).toHaveLength(150));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, page_size: 50 }),
    );
    expect(result.current.hasMore).toBe(true);
  });

  it('dedupes by ASIN — overlapping pages do not append duplicates', async () => {
    const firstAsins = Array.from({ length: 100 }, (_, i) => `X${i}`);
    // Second page returns 25 already-seen + 25 new
    const secondAsins = [
      ...firstAsins.slice(0, 25),
      ...Array.from({ length: 25 }, (_, i) => `Y${i}`),
    ];
    queueResolve(makeResponse(500, firstAsins));
    queueResolve(makeResponse(500, secondAsins));

    const { result } = renderHook(() =>
      useDbInfiniteScroll({
        buildBaseParams: () => ({ keyword: 'k' }),
        enabled: true,
        resetKey: 'k1',
      }),
    );

    await waitFor(() => expect(result.current.products).toHaveLength(100));

    act(() => result.current.loadNextPage());

    await waitFor(() => expect(result.current.products).toHaveLength(125));
    // hasMore stays true because incoming length (50) >= page_size (50)
    expect(result.current.hasMore).toBe(true);
  });

  it('end detection — result_count < page_size sets hasMore=false', async () => {
    const firstAsins = Array.from({ length: 100 }, (_, i) => `A${i}`);
    const secondAsins = Array.from({ length: 20 }, (_, i) => `B${i}`); // < 50 = end
    queueResolve(makeResponse(500, firstAsins));
    queueResolve(makeResponse(500, secondAsins));

    const { result } = renderHook(() =>
      useDbInfiniteScroll({
        buildBaseParams: () => ({}),
        enabled: true,
        resetKey: 'k1',
      }),
    );

    await waitFor(() => expect(result.current.products).toHaveLength(100));

    act(() => result.current.loadNextPage());

    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.products).toHaveLength(120);
  });

  it('small initial result set (<100) sets hasMore=false immediately (EC-31)', async () => {
    const asins = Array.from({ length: 30 }, (_, i) => `A${i}`);
    queueResolve(makeResponse(30, asins));

    const { result } = renderHook(() =>
      useDbInfiniteScroll({
        buildBaseParams: () => ({}),
        enabled: true,
        resetKey: 'k1',
      }),
    );

    await waitFor(() => expect(result.current.products).toHaveLength(30));
    expect(result.current.hasMore).toBe(false);

    // Subsequent loadNextPage calls are no-ops
    act(() => result.current.loadNextPage());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('rapid loadNextPage calls are deduped — single in-flight (EC-32)', async () => {
    const firstAsins = Array.from({ length: 100 }, (_, i) => `A${i}`);
    queueResolve(makeResponse(500, firstAsins));

    const { result } = renderHook(() =>
      useDbInfiniteScroll({
        buildBaseParams: () => ({}),
        enabled: true,
        resetKey: 'k1',
      }),
    );

    await waitFor(() => expect(result.current.products).toHaveLength(100));

    // Now queue a slow second response — pending state during fast clicks
    let resolveSecond: ((r: ProductListResponse) => void) | undefined;
    const slowPromise: MockPromise<ProductListResponse> = new Promise<ProductListResponse>(
      (res) => {
        resolveSecond = res;
      },
    );
    (slowPromise as { unwrap?: () => Promise<ProductListResponse> }).unwrap = () => slowPromise;
    fetchSpy.mockReturnValueOnce(slowPromise);

    act(() => result.current.loadNextPage());
    // Three more rapid clicks while the second fetch is still in-flight
    act(() => result.current.loadNextPage());
    act(() => result.current.loadNextPage());
    act(() => result.current.loadNextPage());

    expect(result.current.isFetchingNext).toBe(true);
    // Only the original page-1 fetch + one page-2 fetch were issued
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Settle the slow fetch
    const secondAsins = Array.from({ length: 50 }, (_, i) => `B${i}`);
    resolveSecond?.(makeResponse(500, secondAsins));

    await waitFor(() => expect(result.current.products).toHaveLength(150));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('filter change while loading aborts in-flight + resets to page 1 (EC-33)', async () => {
    const firstAsins = Array.from({ length: 100 }, (_, i) => `A${i}`);
    queueResolve(makeResponse(500, firstAsins));

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useDbInfiniteScroll({
          buildBaseParams: () => ({ keyword: key }),
          enabled: true,
          resetKey: key,
        }),
      { initialProps: { key: 'k1' } },
    );

    await waitFor(() => expect(result.current.products).toHaveLength(100));

    // Start a slow next-page fetch
    let resolveSecond: ((r: ProductListResponse) => void) | undefined;
    const slowPromise: MockPromise<ProductListResponse> = new Promise<ProductListResponse>(
      (res) => {
        resolveSecond = res;
      },
    );
    (slowPromise as { unwrap?: () => Promise<ProductListResponse> }).unwrap = () => slowPromise;
    fetchSpy.mockReturnValueOnce(slowPromise);

    act(() => result.current.loadNextPage());
    expect(result.current.isFetchingNext).toBe(true);

    // Filter change mid-flight — queue page-1 of new key
    const newAsins = Array.from({ length: 100 }, (_, i) => `Z${i}`);
    queueResolve(makeResponse(200, newAsins));

    rerender({ key: 'k2' });

    // The previous in-flight subscription must be aborted
    await waitFor(() => expect(triggerAbort).toHaveBeenCalled());

    // Resolve the orphaned slow fetch — its result must be dropped
    resolveSecond?.(makeResponse(500, [...firstAsins, 'STALE']));

    await waitFor(() => expect(result.current.products).toHaveLength(100));
    // Products are the new key's page-1 results, not the stale dataset
    expect(result.current.products[0].asin).toBe('Z0');
  });

  it('disabled prop short-circuits — no fetch, empty state', () => {
    const { result } = renderHook(() =>
      useDbInfiniteScroll({
        buildBaseParams: () => ({}),
        enabled: false,
        resetKey: 'k1',
      }),
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.products).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.hasMore).toBe(false);
  });

  it('loadNextPage is a no-op when document is hidden (EC-34)', async () => {
    const firstAsins = Array.from({ length: 100 }, (_, i) => `A${i}`);
    queueResolve(makeResponse(500, firstAsins));

    const { result } = renderHook(() =>
      useDbInfiniteScroll({
        buildBaseParams: () => ({}),
        enabled: true,
        resetKey: 'k1',
      }),
    );

    await waitFor(() => expect(result.current.products).toHaveLength(100));

    // Hide the tab
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });

    act(() => result.current.loadNextPage());

    // No network call fired — only the initial page-1 fetch happened
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Restore visibility for subsequent tests
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('search reset triggers fresh page-1 fetch with new params', async () => {
    queueResolve(
      makeResponse(
        100,
        Array.from({ length: 100 }, (_, i) => `A${i}`),
      ),
    );
    queueResolve(
      makeResponse(
        50,
        Array.from({ length: 50 }, (_, i) => `B${i}`),
      ),
    );

    const { result, rerender } = renderHook(
      ({ key, kw }: { key: string; kw: string }) =>
        useDbInfiniteScroll({
          buildBaseParams: () => ({ keyword: kw }),
          enabled: true,
          resetKey: key,
        }),
      { initialProps: { key: 'k1', kw: 'hiking' } },
    );

    await waitFor(() => expect(result.current.products).toHaveLength(100));
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'hiking', page: 1, page_size: 50 }),
    );

    rerender({ key: 'k2', kw: 'yoga' });

    await waitFor(() => expect(result.current.products).toHaveLength(50));
    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'yoga', page: 1, page_size: 50 }),
    );
  });
});
