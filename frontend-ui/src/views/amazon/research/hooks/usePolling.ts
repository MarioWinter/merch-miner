import { useMemo } from 'react';
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

const usePolling = (cacheId: string | null): UsePollingReturn => {
  const shouldPoll = !!cacheId;

  const { data, isLoading } = usePollSearchStatusQuery(cacheId ?? '', {
    skip: !shouldPoll,
    pollingInterval: POLL_INTERVAL,
  });

  const isTerminal = data?.status === 'completed' || data?.status === 'failed';

  // RTK Query pollingInterval keeps running but we use skip to stop
  // Re-query with skip when terminal
  usePollSearchStatusQuery(cacheId ?? '', {
    skip: !shouldPoll || !isTerminal,
    pollingInterval: 0,
  });

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
