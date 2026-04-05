import { useCallback, useState } from 'react';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface ElementSelectionState {
  /** ID of the currently selected element */
  selectedElementId: string | null;
  /** ID of the artboard containing the selected element */
  selectedArtboardIdForElement: string | null;
  /** Whether free-transform mode is active (rotation enabled) */
  isFreeTransform: boolean;
}

interface UseElementSelectionReturn extends ElementSelectionState {
  /** Select an element within an artboard */
  selectElement: (artboardId: string, elementId: string) => void;
  /** Deselect the current element */
  deselectElement: () => void;
  /** Check if a specific element is selected */
  isElementSelected: (elementId: string) => boolean;
  /** Enter free-transform mode (rotation enabled) */
  enterFreeTransform: () => void;
  /** Exit free-transform mode */
  exitFreeTransform: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useElementSelection = (): UseElementSelectionReturn => {
  const [state, setState] = useState<ElementSelectionState>({
    selectedElementId: null,
    selectedArtboardIdForElement: null,
    isFreeTransform: false,
  });

  const selectElement = useCallback((artboardId: string, elementId: string) => {
    setState((prev) => ({
      selectedElementId: elementId,
      selectedArtboardIdForElement: artboardId,
      // Exit free-transform if selecting a different element
      isFreeTransform: prev.selectedElementId === elementId ? prev.isFreeTransform : false,
    }));
  }, []);

  const deselectElement = useCallback(() => {
    setState({
      selectedElementId: null,
      selectedArtboardIdForElement: null,
      isFreeTransform: false,
    });
  }, []);

  const isElementSelected = useCallback(
    (elementId: string) => state.selectedElementId === elementId,
    [state.selectedElementId],
  );

  const enterFreeTransform = useCallback(() => {
    setState((prev) => ({ ...prev, isFreeTransform: true }));
  }, []);

  const exitFreeTransform = useCallback(() => {
    setState((prev) => ({ ...prev, isFreeTransform: false }));
  }, []);

  return {
    ...state,
    selectElement,
    deselectElement,
    isElementSelected,
    enterFreeTransform,
    exitFreeTransform,
  };
};

export default useElementSelection;
