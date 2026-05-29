import { useHealthCheckQuery } from '@/store/searchSlice';

// Adaptive polling: 60s when healthy, 30s when offline. We used to poll at
// 5s when offline for snappy recovery feedback, but that turned out to be a
// significant per-render driver across every subscriber (ModePopoverButton,
// ChatPanel) — each poll dispatches pending+fulfilled Redux actions, every
// useAppSelector reruns, and ChatInputBar's tree (~12 components) recommits.
// When the chat drawer is open alongside the Konva designs canvas the
// combined RAF + commit pressure surfaces as typing lag in the contenteditable.
// 30s offline is still fast enough that a recovered Vane gets noticed within
// half a minute without paying the per-keystroke price the whole time it's
// down.
const POLL_INTERVAL_HEALTHY_MS = 60_000;
const POLL_INTERVAL_OFFLINE_MS = 30_000;

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
