import { useCallback, useState } from 'react';
import type { PanelMode } from './useRightPanelState';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface UsePromptBarReturn {
  /** Whether the prompt bar is expanded (full controls visible) */
  isExpanded: boolean;
  /** Expand the prompt bar (manual open) */
  expand: () => void;
  /** Collapse the prompt bar */
  collapse: () => void;
  /** Toggle expanded state */
  toggle: () => void;
  /** Whether the bar was manually opened (not auto-triggered by AI board selection) */
  isManual: boolean;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

/**
 * Manages PromptBar expand/collapse state.
 *
 * Auto-expand when an AI Image Board is selected (panelMode === 'ai').
 * Auto-collapse when deselecting AI board — unless user opened manually.
 *
 * Derives expanded state from panelMode + manual flag (no useEffect).
 */
const usePromptBar = (panelMode: PanelMode): UsePromptBarReturn => {
  const [isManual, setIsManual] = useState(false);

  // Derived: expanded when AI board selected OR manually opened
  const isExpanded = panelMode === 'ai' || isManual;

  const expand = useCallback(() => {
    setIsManual(true);
  }, []);

  const collapse = useCallback(() => {
    setIsManual(false);
  }, []);

  const toggle = useCallback(() => {
    setIsManual((prev) => !prev);
  }, []);

  return { isExpanded, expand, collapse, toggle, isManual };
};

export default usePromptBar;
