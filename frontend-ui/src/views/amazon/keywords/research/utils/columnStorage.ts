import type { KeywordColumnVisibility } from '../types';

const STORAGE_KEY = 'mm-keyword-columns';

export const loadColumnVisibility = (): KeywordColumnVisibility | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const saveColumnVisibility = (vis: KeywordColumnVisibility) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(vis));
};
