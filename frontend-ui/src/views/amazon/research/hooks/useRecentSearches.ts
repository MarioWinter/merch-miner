import { useState, useCallback } from 'react';

const STORAGE_KEY = 'mm-research-recent';
const MAX_ITEMS = 10;

export interface RecentSearch {
  keyword: string;
  marketplace: string;
}

interface UseRecentSearchesReturn {
  searches: RecentSearch[];
  addSearch: (keyword: string, marketplace: string) => void;
  removeSearch: (index: number) => void;
}

const readFromStorage = (): RecentSearch[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
  } catch {
    return [];
  }
};

const writeToStorage = (items: RecentSearch[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
};

const useRecentSearches = (): UseRecentSearchesReturn => {
  const [searches, setSearches] = useState<RecentSearch[]>(readFromStorage);

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

  return { searches, addSearch, removeSearch };
};

export default useRecentSearches;
