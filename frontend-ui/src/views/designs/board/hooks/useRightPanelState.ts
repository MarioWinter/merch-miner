import { useMemo } from 'react';
import type { ArtboardData, CanvasElement } from '../types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type PanelMode = 'none' | 'single' | 'ai' | 'multi' | 'element';

export interface RightPanelState {
  mode: PanelMode;
  /** Single selected artboard (when mode is 'single' or 'ai') */
  artboard: ArtboardData | null;
  /** All selected artboards (when mode is 'multi') */
  selectedArtboards: ArtboardData[];
  /** Number of selected items */
  count: number;
  /** Selected element (when mode is 'element') */
  selectedElement: CanvasElement | null;
  /** Artboard ID containing the selected element */
  selectedElementArtboardId: string | null;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

interface UseRightPanelStateParams {
  artboards: ArtboardData[];
  selectedIds: Set<string>;
  /** Currently selected element ID (from useElementSelection) */
  selectedElementId?: string | null;
  /** Artboard ID containing the selected element */
  selectedArtboardIdForElement?: string | null;
}

const useRightPanelState = ({
  artboards,
  selectedIds,
  selectedElementId,
  selectedArtboardIdForElement,
}: UseRightPanelStateParams): RightPanelState => {
  return useMemo(() => {
    // Element selection takes priority
    if (selectedElementId && selectedArtboardIdForElement) {
      const ab = artboards.find((a) => a.id === selectedArtboardIdForElement) ?? null;
      const element = ab?.layers.find((el) => el.id === selectedElementId) ?? null;
      if (element) {
        return {
          mode: 'element',
          artboard: ab,
          selectedArtboards: ab ? [ab] : [],
          count: 1,
          selectedElement: element,
          selectedElementArtboardId: selectedArtboardIdForElement,
        };
      }
    }

    const count = selectedIds.size;
    const base = { selectedElement: null, selectedElementArtboardId: null };

    if (count === 0) {
      return { mode: 'none', artboard: null, selectedArtboards: [], count: 0, ...base };
    }

    if (count === 1) {
      const id = [...selectedIds][0];
      const ab = artboards.find((a) => a.id === id) ?? null;
      const mode: PanelMode = ab?.kind === 'ai' ? 'ai' : 'single';
      return { mode, artboard: ab, selectedArtboards: ab ? [ab] : [], count: 1, ...base };
    }

    const selected = artboards.filter((a) => selectedIds.has(a.id));
    return { mode: 'multi', artboard: null, selectedArtboards: selected, count, ...base };
  }, [artboards, selectedIds, selectedElementId, selectedArtboardIdForElement]);
};

export default useRightPanelState;
