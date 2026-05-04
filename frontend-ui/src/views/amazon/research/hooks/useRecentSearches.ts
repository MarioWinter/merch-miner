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
  clearAll: () => void;
}

const readFromStorage = (): RecentSearch[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSearch[];
    // Drop any legacy empty-keyword entries that may have leaked into storage.
    const cleaned = parsed.filter((s) => s.keyword?.trim().length > 0);
    // Persist cleanup so legacy empties don't linger across reloads.
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
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
    // Filter-only searches (empty keyword) must not pollute history.
    if (!keyword || keyword.trim().length === 0) return;
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
    writeToStorage([]);
    setSearches([]);
  }, []);

  return { searches, addSearch, removeSearch, clearAll };
};

export default useRecentSearches;
