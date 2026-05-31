import { useTranslation } from 'react-i18next';
import { useGetChangelogQuery, type ChangelogVersion } from '@/store/dashboardSlice';

/**
 * Thin wrapper around the dashboardApi `getChangelog` RTK Query hook. Returns
 * a stable shape with an empty-array default so consumers don't have to
 * handle undefined data. Centralised so tests can mock a single import.
 *
 * Forwards the active i18n language as `?lang=` so the OpenRouter prompt
 * asks for the right language and the result lands in a per-language Redis
 * cache slot (no thrashing when users toggle between EN/DE).
 */
export const useChangelog = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.toLowerCase().startsWith('en') ? 'en' : 'de';
  const { data, isLoading, isError } = useGetChangelogQuery({ lang });

  return {
    versions: (data?.versions ?? []) as ChangelogVersion[],
    isLoading,
    isError,
  };
};
