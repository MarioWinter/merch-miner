import { useEffect, useMemo, useState } from 'react';
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

// When cacheId changes (e.g. recent chip click), RTK Query automatically
// unsubscribes from the previous cache key and subscribes to the new one,
// so explicit cancellation of the old poll is not needed.
const usePolling = (cacheId: string | null): UsePollingReturn => {
  const shouldPoll = !!cacheId;
  const [isTerminal, setIsTerminal] = useState(false);

  const { data, isLoading } = usePollSearchStatusQuery(cacheId ?? '', {
    skip: !shouldPoll,
    pollingInterval: shouldPoll && !isTerminal ? POLL_INTERVAL : 0,
  });

  useEffect(() => {
    const terminal = data?.status === 'completed' || data?.status === 'failed';
    setIsTerminal(!!terminal);
  }, [data?.status]);

  return useMemo(
    () => ({
      status: data?.status ?? null,
      pagesDone: data?.pages_done ?? 0,
      productsScraped: data?.products_scraped ?? 0,
      products: data?.products ?? [],
      errorLog: data?.error_log ?? null,
      isPolling: shouldPoll && !isTerminal && (isLoading || !!data),
    }),
    [data, isLoading, shouldPoll, isTerminal],
  );
};

export default usePolling;
