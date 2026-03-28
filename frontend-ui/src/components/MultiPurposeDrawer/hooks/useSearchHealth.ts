import { useHealthCheckQuery } from '@/store/searchSlice';

const POLL_INTERVAL_MS = 60_000;

export const useSearchHealth = () => {
  const { data, isLoading, isError } = useHealthCheckQuery(undefined, {
    pollingInterval: POLL_INTERVAL_MS,
  });

  const vaneOnline = data?.vane === 'online';
  const crawl4aiOnline = data?.crawl4ai === 'online';
  const allOnline = vaneOnline && crawl4aiOnline;
  const allOffline = !vaneOnline && !crawl4aiOnline;
  const partial = !allOnline && !allOffline;

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
