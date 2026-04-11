import { useState } from 'react';
import { usePollSearchStatusQuery } from '../../../../store/researchSlice';
import type { AmazonProduct, ProductSearchStatus } from '../types';

interface UsePollingReturn {
  status: ProductSearchStatus | null;
  productsScraped: number;
  products: AmazonProduct[];
  errorLog: string | null;
  isPolling: boolean;
}

const POLL_INTERVAL = 3000;
const TERMINAL_STATUSES: ProductSearchStatus[] = ['completed', 'failed', 'cancelled'];

const usePolling = (cacheId: string | null): UsePollingReturn => {
  const shouldPoll = !!cacheId;
  const [stoppedPolling, setStoppedPolling] = useState(false);

  // Reset stoppedPolling when cacheId changes (new search OR next page)
  const [prevCacheId, setPrevCacheId] = useState(cacheId);
  if (cacheId !== prevCacheId) {
    setPrevCacheId(cacheId);
    if (stoppedPolling) {
      setStoppedPolling(false);
    }
  }

  const { data, isLoading } = usePollSearchStatusQuery(cacheId ?? '', {
    skip: !shouldPoll,
    pollingInterval: stoppedPolling ? 0 : POLL_INTERVAL,
  });

  const isTerminal = !!data?.status && TERMINAL_STATUSES.includes(data.status);

  // Stop polling on next render cycle after terminal status detected
  if (isTerminal && !stoppedPolling) {
    setStoppedPolling(true);
  }

  // When cacheId is null (e.g. after cancel), return empty state
  if (!shouldPoll) {
    return {
      status: null,
      productsScraped: 0,
      products: [],
      errorLog: null,
      isPolling: false,
    };
  }

  return {
    status: data?.status ?? null,
    productsScraped: data?.products_scraped ?? 0,
    products: data?.products ?? [],
    errorLog: data?.error_log ?? null,
    isPolling: !isTerminal && (isLoading || !!data),
  };
};

export default usePolling;
