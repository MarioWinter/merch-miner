import { useCallback, useEffect, useRef, useState } from 'react';
import { useLazyListProductsQuery } from '../../../../store/researchSlice';
import type { AmazonProduct, ProductListResponse } from '../types';

// Uniform page size: the backend's offset math is `(page - 1) * page_size`,
// which silently breaks if INITIAL ≠ NEXT (page 2 with size 50 maps to offset
// 50, returning duplicates of page 1's items 50-99). Keep both at 50.
const INITIAL_PAGE_SIZE = 50;
const NEXT_PAGE_SIZE = 50;

interface UseDbInfiniteScrollArgs {
  /** Build the query params dictionary excluding `page` + `page_size` (the hook owns those). */
  buildBaseParams: () => Record<string, unknown>;
  /** When false the hook stays idle (no fetching, no state updates). */
  enabled: boolean;
  /**
   * Stable signature of the current search/filter state. Whenever this changes the hook
   * resets accumulated products + page counter and triggers a fresh page-1 fetch.
   */
  resetKey: string;
}

interface UseDbInfiniteScrollReturn {
  products: AmazonProduct[];
  totalCount: number;
  isLoadingInitial: boolean;
  isFetchingNext: boolean;
  hasMore: boolean;
  loadNextPage: () => void;
}

/**
 * Manages DB-mode infinite scroll for Amazon Research:
 * - Initial fetch: page=1, page_size=100
 * - Subsequent: page++, page_size=50
 * - Dedupes accumulated products by ASIN
 * - Stops when result_count < page_size (end detection)
 * - Defers loadNextPage when document is hidden (EC-34)
 * - Single in-flight request — fast scroll events ignored while fetching (EC-32)
 * - Filter/search change aborts in-flight + resets to page 1 (EC-33)
 */
const useDbInfiniteScroll = ({
  buildBaseParams,
  enabled,
  resetKey,
}: UseDbInfiniteScrollArgs): UseDbInfiniteScrollReturn => {
  const [trigger] = useLazyListProductsQuery();

  const [products, setProducts] = useState<AmazonProduct[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isFetchingNext, setIsFetchingNext] = useState(false);

  // Latest in-flight subscription so we can abort on filter change / reset.
  const inFlightRef = useRef<{ abort: () => void } | null>(null);
  // Monotonic fetch ID — each fetch gets a unique number; only the latest wins state updates.
  // Survives StrictMode double-invocation (where activeResetKey-string compare fails).
  const fetchIdRef = useRef(0);

  const cancelInFlight = useCallback(() => {
    if (inFlightRef.current) {
      try {
        inFlightRef.current.abort();
      } catch {
        // ignore — RTK Query subscription already settled
      }
      inFlightRef.current = null;
    }
  }, []);

  const fetchPage = useCallback(
    async (nextPage: number, pageSize: number, isInitial: boolean) => {
      cancelInFlight();
      const baseParams = buildBaseParams();
      const params = { ...baseParams, page: nextPage, page_size: pageSize };
      // Bump ID so every concurrent in-flight call knows its own freshness.
      fetchIdRef.current += 1;
      const myId = fetchIdRef.current;

      if (isInitial) {
        setIsLoadingInitial(true);
      } else {
        setIsFetchingNext(true);
      }

      const promise = trigger(params, false);
      inFlightRef.current = promise;
      try {
        const response: ProductListResponse = await promise.unwrap();
        // Drop result if a newer fetch has started in the meantime.
        if (myId !== fetchIdRef.current) return;
        const incoming = response.results ?? [];
        setTotalCount(response.count ?? 0);
        if (isInitial) {
          setProducts(incoming);
        } else {
          setProducts((prev) => {
            const existing = new Set(prev.map((p) => p.asin));
            const additions = incoming.filter((p) => !existing.has(p.asin));
            return additions.length > 0 ? [...prev, ...additions] : prev;
          });
        }
        // End detection: fewer items than requested means we hit the last page.
        setHasMore(incoming.length >= pageSize);
        setPage(nextPage);
      } catch {
        // Only surface end-of-list for the latest fetch; staler aborts are silent.
        if (myId === fetchIdRef.current) setHasMore(false);
      } finally {
        if (myId === fetchIdRef.current) {
          if (isInitial) setIsLoadingInitial(false);
          else setIsFetchingNext(false);
        }
        if (inFlightRef.current === promise) {
          inFlightRef.current = null;
        }
      }
    },
    [buildBaseParams, cancelInFlight, trigger],
  );

  // Reset + initial fetch on resetKey change.
  useEffect(() => {
    cancelInFlight();
    if (!enabled) {
      setProducts([]);
      setTotalCount(0);
      setHasMore(false);
      setPage(1);
      setIsLoadingInitial(false);
      setIsFetchingNext(false);
      return;
    }
    setProducts([]);
    setTotalCount(0);
    setHasMore(false);
    setPage(1);
    void fetchPage(1, INITIAL_PAGE_SIZE, true);
    // fetchPage is intentionally excluded from deps — it depends on buildBaseParams which
    // is rebuilt on every parent render. resetKey is the canonical signal for re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, enabled]);

  // Cleanup any in-flight fetch on unmount.
  useEffect(() => {
    return () => cancelInFlight();
  }, [cancelInFlight]);

  const loadNextPage = useCallback(() => {
    if (!enabled) return;
    if (isLoadingInitial || isFetchingNext) return;
    if (!hasMore) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      // EC-34: defer until the tab is visible again. We register a one-shot listener.
      const onVisible = () => {
        if (document.visibilityState === 'visible') {
          document.removeEventListener('visibilitychange', onVisible);
          loadNextPage();
        }
      };
      document.addEventListener('visibilitychange', onVisible);
      return;
    }
    void fetchPage(page + 1, NEXT_PAGE_SIZE, false);
  }, [enabled, isLoadingInitial, isFetchingNext, hasMore, page, fetchPage]);

  return {
    products,
    totalCount,
    isLoadingInitial,
    isFetchingNext,
    hasMore,
    loadNextPage,
  };
};

export default useDbInfiniteScroll;
