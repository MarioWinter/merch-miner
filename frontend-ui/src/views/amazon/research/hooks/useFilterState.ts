import { useState, useCallback, useMemo } from 'react';
import {
  DEFAULT_FILTERS,
  DEFAULT_FILTER_ENABLED,
  type ResearchFilters,
  type FilterEnabled,
  type FilterKey,
} from '../types';

interface UseFilterStateReturn {
  filters: ResearchFilters;
  enabled: FilterEnabled;
  setFilter: <K extends keyof ResearchFilters>(key: K, value: ResearchFilters[K]) => void;
  setEnabled: (key: FilterKey, value: boolean) => void;
  resetFilters: () => void;
  activeFilterCount: number;
}

const useFilterState = (): UseFilterStateReturn => {
  const [filters, setFilters] = useState<ResearchFilters>({ ...DEFAULT_FILTERS });
  const [enabled, setEnabledState] = useState<FilterEnabled>({ ...DEFAULT_FILTER_ENABLED });

  const setFilter = useCallback(
    <K extends keyof ResearchFilters>(key: K, value: ResearchFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const setEnabled = useCallback((key: FilterKey, value: boolean) => {
    setEnabledState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ ...DEFAULT_FILTERS });
    setEnabledState({ ...DEFAULT_FILTER_ENABLED });
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    const keys = Object.keys(enabled) as FilterKey[];
    for (const key of keys) {
      if (!enabled[key]) continue;
      const val = filters[key];
      const def = DEFAULT_FILTERS[key];
      if (val !== def) count++;
    }
    return count;
  }, [filters, enabled]);

  return { filters, enabled, setFilter, setEnabled, resetFilters, activeFilterCount };
};

export default useFilterState;
