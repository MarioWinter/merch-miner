import { useGetChangelogQuery, type ChangelogVersion } from '@/store/dashboardSlice';

/**
 * Thin wrapper around the dashboardApi `getChangelog` RTK Query hook. Returns
 * a stable shape with an empty-array default so consumers don't have to
 * handle undefined data. Centralised so tests can mock a single import.
 */
export const useChangelog = () => {
  const { data, isLoading, isError } = useGetChangelogQuery();

  return {
    versions: (data?.versions ?? []) as ChangelogVersion[],
    isLoading,
    isError,
  };
};
