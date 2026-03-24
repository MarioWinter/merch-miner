import { useState } from 'react';
import { usePollSearchStatusQuery } from '../../../../store/researchSlice';
import type { AmazonProduct, ProductSearchStatus } from '../types';

interface UsePollingReturn {
  status: ProductSearchStatus | null;
  pagesDone: number;
  productsScraped: number;
  products: AmazonProduct[];
  errorLog: string | null;
  isPolling: boolean;
}

const POLL_INTERVAL = 3000;
const TERMINAL_STATUSES: ProductSearchStatus[] = ['completed', 'failed'];

// When cacheId changes (e.g. recent chip click), RTK Query automatically
// unsubscribes from the previous cache key and subscribes to the new one,
// so explicit cancellation of the old poll is not needed.
const usePolling = (cacheId: string | null): UsePollingReturn => {
  const shouldPoll = !!cacheId;
  const [stoppedPolling, setStoppedPolling] = useState(false);

  const { data, isLoading } = usePollSearchStatusQuery(cacheId ?? '', {
    skip: !shouldPoll,
    pollingInterval: stoppedPolling ? 0 : POLL_INTERVAL,
  });

  const isTerminal = !!data?.status && TERMINAL_STATUSES.includes(data.status);

  // Stop polling on next render cycle after terminal status detected
  if (isTerminal && !stoppedPolling) {
    setStoppedPolling(true);
  }
  // Reset when cacheId changes (new search)
  if (!shouldPoll && stoppedPolling) {
    setStoppedPolling(false);
  }

  return {
    status: data?.status ?? null,
    pagesDone: data?.pages_done ?? 0,
    productsScraped: data?.products_scraped ?? 0,
    products: data?.products ?? [],
    errorLog: data?.error_log ?? null,
    isPolling: shouldPoll && !isTerminal && (isLoading || !!data),
  };
};

export default usePolling;
