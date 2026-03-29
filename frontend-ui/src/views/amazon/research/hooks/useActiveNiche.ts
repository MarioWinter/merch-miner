import { useMemo } from 'react';
import { useListNichesQuery } from '../../../../store/nicheSlice';
import type { Niche } from '../../../niches/list/types';

interface UseActiveNicheReturn {
  niches: Niche[];
  nichesLoading: boolean;
  matchedNiche: Niche | null;
}

/**
 * Auto-detects a niche from the searched keyword by matching against
 * all existing niche names (case-insensitive).
 *
 * @param searchedKeyword The keyword that was actually submitted (Enter / Search button),
 *                        NOT the live input value.
 */
const useActiveNiche = (searchedKeyword: string): UseActiveNicheReturn => {
  const { data, isLoading } = useListNichesQuery({ page_size: 200 });
  const niches = useMemo(() => data?.results ?? [], [data]);

  const matchedNiche = useMemo(() => {
    if (!searchedKeyword || !niches.length) return null;
    const lower = searchedKeyword.toLowerCase();
    return niches.find((n) => n.name.toLowerCase() === lower) ?? null;
  }, [searchedKeyword, niches]);

  return {
    niches,
    nichesLoading: isLoading,
    matchedNiche,
  };
};

export default useActiveNiche;
