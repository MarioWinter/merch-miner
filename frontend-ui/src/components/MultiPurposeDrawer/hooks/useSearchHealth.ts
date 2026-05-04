import { useHealthCheckQuery } from '@/store/searchSlice';

// Adaptive polling: 60s when healthy, 5s when offline (faster recovery feedback).
const POLL_INTERVAL_HEALTHY_MS = 60_000;
const POLL_INTERVAL_OFFLINE_MS = 5_000;

export const useSearchHealth = () => {
  // Bootstrap query without polling so we have data to drive the polling interval.
  const { data, isLoading, isError } = useHealthCheckQuery(undefined, {
    pollingInterval: POLL_INTERVAL_HEALTHY_MS,
  });

  const vaneOnline = data?.vane === 'online';
  const crawl4aiOnline = data?.crawl4ai === 'online';
  const allOnline = vaneOnline && crawl4aiOnline;
  const allOffline = !vaneOnline && !crawl4aiOnline;
  const partial = !allOnline && !allOffline;

  // Re-subscribe with a faster interval while any service is offline so the UI
  // recovers quickly once the service comes back. RTK Query merges intervals
  // across subscribers — the lower value wins.
  useHealthCheckQuery(undefined, {
    pollingInterval: POLL_INTERVAL_OFFLINE_MS,
    skip: allOnline,
  });

  const statusColor = allOnline ? 'success' : allOffline ? 'error' : 'warning';

  return {
    health: data,
    isLoading,
    isError,
    vaneOnline,
    crawl4aiOnline,
    allOnline,
    allOffline,
    partial,
    statusColor: statusColor as 'success' | 'error' | 'warning',
  };
};
