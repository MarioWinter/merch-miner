import { useState, useCallback } from 'react';

const STORAGE_KEY = 'mm-keyword-recent';
const MAX_ITEMS = 10;

export interface RecentKeywordSearch {
  keyword: string;
  marketplace: string;
}

interface UseRecentSearchesReturn {
  searches: RecentKeywordSearch[];
  addSearch: (keyword: string, marketplace: string) => void;
  removeSearch: (index: number) => void;
  clearAll: () => void;
}

const readFromStorage = (): RecentKeywordSearch[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'keyword' in item &&
        'marketplace' in item &&
        typeof (item as RecentKeywordSearch).keyword === 'string' &&
        typeof (item as RecentKeywordSearch).marketplace === 'string',
    );
  } catch {
    return [];
  }
};

const writeToStorage = (items: RecentKeywordSearch[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

/**
 * Recent keyword searches hook. localStorage key `mm-keyword-recent`, max 10 items.
 * Same pattern as PROJ-7 useRecentSearches with added clearAll + corrupted JSON recovery.
 */
export const useRecentSearches = (): UseRecentSearchesReturn => {
  const [searches, setSearches] = useState<RecentKeywordSearch[]>(readFromStorage);

  const addSearch = useCallback((keyword: string, marketplace: string) => {
    setSearches((prev) => {
      const filtered = prev.filter(
        (s) => !(s.keyword === keyword && s.marketplace === marketplace),
      );
      const next = [{ keyword, marketplace }, ...filtered].slice(0, MAX_ITEMS);
      writeToStorage(next);
      return next;
    });
  }, []);

  const removeSearch = useCallback((index: number) => {
    setSearches((prev) => {
      const next = prev.filter((_, i) => i !== index);
      writeToStorage(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSearches([]);
  }, []);

  return { searches, addSearch, removeSearch, clearAll };
};
