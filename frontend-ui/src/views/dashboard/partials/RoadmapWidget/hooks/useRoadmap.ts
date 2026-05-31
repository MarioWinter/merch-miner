import { useGetRoadmapQuery, type RoadmapItem } from '@/store/dashboardSlice';

/**
 * Thin wrapper around the dashboardApi `getRoadmap` RTK Query hook. Returns
 * a stable shape with empty defaults so consumers don't have to handle
 * undefined data. Centralised so tests can mock a single import.
 */
export const useRoadmap = () => {
  const { data, isLoading, isError } = useGetRoadmapQuery();

  return {
    items: (data?.items ?? []) as RoadmapItem[],
    lastUpdated: data?.last_updated ?? null,
    isLoading,
    isError,
  };
};
