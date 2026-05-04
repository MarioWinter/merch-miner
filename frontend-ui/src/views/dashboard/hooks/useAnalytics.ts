import { useState, useMemo } from 'react';
import {
  useGetDesignAnalyticsQuery,
  useGetListingAnalyticsQuery,
  useGetAgentAnalyticsQuery,
  useGetSearchAnalyticsQuery,
} from '../../../store/dashboardSlice';
import type { DateRange } from '../types';

const useAnalytics = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const queryArg = useMemo(
    () => (dateRange ? dateRange : undefined),
    [dateRange],
  );

  const designAnalytics = useGetDesignAnalyticsQuery(queryArg);
  const listingAnalytics = useGetListingAnalyticsQuery(queryArg);
  const agentAnalytics = useGetAgentAnalyticsQuery(queryArg);
  const searchAnalytics = useGetSearchAnalyticsQuery(queryArg);

  const isLoading =
    designAnalytics.isLoading ||
    listingAnalytics.isLoading ||
    agentAnalytics.isLoading ||
    searchAnalytics.isLoading;

  return {
    dateRange,
    setDateRange,
    designAnalytics: designAnalytics.data ?? [],
    listingAnalytics: listingAnalytics.data ?? [],
    agentAnalytics: agentAnalytics.data ?? null,
    searchAnalytics: searchAnalytics.data ?? null,
    isLoading,
    designError: designAnalytics.error,
    listingError: listingAnalytics.error,
    agentError: agentAnalytics.error,
    searchError: searchAnalytics.error,
  };
};

export default useAnalytics;
