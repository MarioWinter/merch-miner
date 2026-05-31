import { useTranslation } from 'react-i18next';
import { useGetRoadmapQuery, type RoadmapItem } from '@/store/dashboardSlice';

/**
 * Thin wrapper around the dashboardApi `getRoadmap` RTK Query hook. Returns
 * a stable shape with empty defaults so consumers don't have to handle
 * undefined data. Centralised so tests can mock a single import.
 *
 * Forwards the active i18n language as `?lang=` so the backend picks the
 * matching language-specific roadmap fields (`title_en` / `description_en`
 * when ``en``, native otherwise). Locales other than `en` fall back to the
 * German default on the backend.
 */
export const useRoadmap = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'de';
  const { data, isLoading, isError } = useGetRoadmapQuery({ lang });

  return {
    items: (data?.items ?? []) as RoadmapItem[],
    lastUpdated: data?.last_updated ?? null,
    isLoading,
    isError,
  };
};
