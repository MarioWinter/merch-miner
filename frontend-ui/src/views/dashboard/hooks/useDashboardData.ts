import { useGetDashboardQuery } from '../../../store/dashboardSlice';

const POLL_INTERVAL_MS = 60_000;

const useDashboardData = () => {
  const { data, isLoading, isFetching, error, refetch } = useGetDashboardQuery(undefined, {
    pollingInterval: POLL_INTERVAL_MS,
  });

  return {
    dashboard: data ?? null,
    isLoading,
    isFetching,
    error,
    refetch,
  };
};

export default useDashboardData;
