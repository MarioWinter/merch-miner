import { useCallback, useState } from 'react';
import type { BatchImage } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const MAX_HISTORY = 20;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseUndoRedoReturn {
  /** Push a snapshot before a destructive operation */
  pushSnapshot: (images: BatchImage[]) => void;
  /** Undo: pass current state so it can be saved for redo. Returns previous snapshot or null */
  undo: (currentImages: BatchImage[]) => BatchImage[] | null;
  /** Redo: pass current state so it can be saved for undo. Returns next snapshot or null */
  redo: (currentImages: BatchImage[]) => BatchImage[] | null;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
  /** Reset history (e.g. when batch is cleared) */
  reset: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

/**
 * Maintains an undo/redo stack of BatchImage[] snapshots.
 * Push a snapshot before each Apply Pipeline or eraser stroke.
 * Max ~20 entries to limit memory.
 */
const useUndoRedo = (): UseUndoRedoReturn => {
  const [past, setPast] = useState<BatchImage[][]>([]);
  const [future, setFuture] = useState<BatchImage[][]>([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const pushSnapshot = useCallback((images: BatchImage[]) => {
    const snapshot = images.map((img) => ({ ...img }));
    setPast((prev) => {
      const next = [...prev, snapshot];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setFuture([]);
  }, []);

  const undo = useCallback((currentImages: BatchImage[]): BatchImage[] | null => {
    let restored: BatchImage[] | null = null;
    const currentSnapshot = currentImages.map((img) => ({ ...img }));

    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      restored = prevPast[prevPast.length - 1];
      return prevPast.slice(0, -1);
    });

    // Save current state to future for redo
    setFuture((prevFuture) => [...prevFuture, currentSnapshot]);

    return restored;
  }, []);

  const redo = useCallback((currentImages: BatchImage[]): BatchImage[] | null => {
    let restored: BatchImage[] | null = null;
    const currentSnapshot = currentImages.map((img) => ({ ...img }));

    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      restored = prevFuture[prevFuture.length - 1];
      return prevFuture.slice(0, -1);
    });

    // Save current state to past for undo
    setPast((prevPast) => [...prevPast, currentSnapshot]);

    return restored;
  }, []);

  const reset = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return { pushSnapshot, undo, redo, canUndo, canRedo, reset };
};

export default useUndoRedo;
