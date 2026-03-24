import { useState, useCallback } from 'react';
import type { ResearchMode } from '../types';

interface UseResearchModeReturn {
  mode: ResearchMode;
  isLive: boolean;
  toggleMode: () => void;
}

const useResearchMode = (onModeChange?: () => void): UseResearchModeReturn => {
  const [mode, setMode] = useState<ResearchMode>('db');

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === 'db' ? 'live' : 'db'));
    onModeChange?.();
  }, [onModeChange]);

  return {
    mode,
    isLive: mode === 'live',
    toggleMode,
  };
};

export default useResearchMode;
