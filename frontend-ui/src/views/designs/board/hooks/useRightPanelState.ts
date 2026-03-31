import { useMemo } from 'react';
import type { ArtboardData } from '../types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type PanelMode = 'none' | 'single' | 'ai' | 'multi';

export interface RightPanelState {
  mode: PanelMode;
  /** Single selected artboard (when mode is 'single' or 'ai') */
  artboard: ArtboardData | null;
  /** All selected artboards (when mode is 'multi') */
  selectedArtboards: ArtboardData[];
  /** Number of selected items */
  count: number;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

interface UseRightPanelStateParams {
  artboards: ArtboardData[];
  selectedIds: Set<string>;
}

const useRightPanelState = ({
  artboards,
  selectedIds,
}: UseRightPanelStateParams): RightPanelState => {
  return useMemo(() => {
    const count = selectedIds.size;

    if (count === 0) {
      return { mode: 'none', artboard: null, selectedArtboards: [], count: 0 };
    }

    if (count === 1) {
      const id = [...selectedIds][0];
      const ab = artboards.find((a) => a.id === id) ?? null;
      const mode: PanelMode = ab?.kind === 'ai' ? 'ai' : 'single';
      return { mode, artboard: ab, selectedArtboards: ab ? [ab] : [], count: 1 };
    }

    const selected = artboards.filter((a) => selectedIds.has(a.id));
    return { mode: 'multi', artboard: null, selectedArtboards: selected, count };
  }, [artboards, selectedIds]);
};

export default useRightPanelState;
