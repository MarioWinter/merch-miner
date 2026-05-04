import { useCallback, useState } from 'react';
import type { ArtboardData } from '../types';
import type { BoardEdge } from './useArtboards';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const MAX_HISTORY = 20;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface CanvasSnapshot {
  artboards: ArtboardData[];
  edges: BoardEdge[];
}

interface UseCanvasHistoryReturn {
  /** Push a snapshot before a state-changing operation */
  pushSnapshot: (artboards: ArtboardData[], edges: BoardEdge[]) => void;
  /** Undo: pass current state so it can be saved for redo */
  undo: (currentArtboards: ArtboardData[], currentEdges: BoardEdge[]) => CanvasSnapshot | null;
  /** Redo: pass current state so it can be saved for undo */
  redo: (currentArtboards: ArtboardData[], currentEdges: BoardEdge[]) => CanvasSnapshot | null;
  canUndo: boolean;
  canRedo: boolean;
  /** Reset history */
  reset: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

/**
 * Maintains undo/redo history for the artboard canvas.
 * Snapshots should be pushed on drag-end, resize-end, add, delete,
 * and property changes -- NOT on every pixel during drag.
 */
const useCanvasHistory = (): UseCanvasHistoryReturn => {
  const [past, setPast] = useState<CanvasSnapshot[]>([]);
  const [future, setFuture] = useState<CanvasSnapshot[]>([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const pushSnapshot = useCallback((artboards: ArtboardData[], edges: BoardEdge[]) => {
    const snapshot: CanvasSnapshot = {
      artboards: artboards.map((ab) => ({ ...ab })),
      edges: edges.map((e) => ({ ...e })),
    };
    setPast((prev) => {
      const next = [...prev, snapshot];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setFuture([]);
  }, []);

  const undo = useCallback((currentArtboards: ArtboardData[], currentEdges: BoardEdge[]): CanvasSnapshot | null => {
    let restored: CanvasSnapshot | null = null;
    const currentSnapshot: CanvasSnapshot = {
      artboards: currentArtboards.map((ab) => ({ ...ab })),
      edges: currentEdges.map((e) => ({ ...e })),
    };

    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      restored = prevPast[prevPast.length - 1];
      return prevPast.slice(0, -1);
    });

    setFuture((prevFuture) => [...prevFuture, currentSnapshot]);

    return restored;
  }, []);

  const redo = useCallback((currentArtboards: ArtboardData[], currentEdges: BoardEdge[]): CanvasSnapshot | null => {
    let restored: CanvasSnapshot | null = null;
    const currentSnapshot: CanvasSnapshot = {
      artboards: currentArtboards.map((ab) => ({ ...ab })),
      edges: currentEdges.map((e) => ({ ...e })),
    };

    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      restored = prevFuture[prevFuture.length - 1];
      return prevFuture.slice(0, -1);
    });

    setPast((prevPast) => [...prevPast, currentSnapshot]);

    return restored;
  }, []);

  const reset = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  return { pushSnapshot, undo, redo, canUndo, canRedo, reset };
};

export default useCanvasHistory;
