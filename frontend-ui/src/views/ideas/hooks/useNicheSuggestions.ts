import { useCallback, useMemo } from 'react';
import { useSuggestNichesQuery } from '@/store/ideaSlice';
import type { NicheSuggestion } from '../types';

interface UseNicheSuggestionsReturn {
  suggestions: NicheSuggestion[];
  isLoading: boolean;
  error: boolean;
  autoSelectTop5: () => string[];
  availableNiches: NicheSuggestion[];
}

export const useNicheSuggestions = (
  ideaId: string | null,
): UseNicheSuggestionsReturn => {
  const { data, isLoading, isError } = useSuggestNichesQuery(ideaId!, {
    skip: !ideaId,
  });

  const suggestions = useMemo(() => data ?? [], [data]);

  const availableNiches = useMemo(
    () => suggestions.filter((s) => !s.already_adapted),
    [suggestions],
  );

  const autoSelectTop5 = useCallback(
    () => availableNiches.slice(0, 5).map((s) => s.niche_id),
    [availableNiches],
  );

  return {
    suggestions,
    isLoading,
    error: isError,
    autoSelectTop5,
    availableNiches,
  };
};
