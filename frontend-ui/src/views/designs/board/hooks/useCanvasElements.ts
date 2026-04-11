import { useCallback, useRef } from 'react';
import type { ArtboardData, CanvasElement, CanvasElementType, CanvasElementPropsMap } from '../types';
import type { BoardEdge } from './useArtboards';
import { nextElementId, nextZIndex, TYPE_LABELS, INITIAL_COUNTERS } from '../utils/elementHelpers';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseCanvasElementsParams {
  artboards: ArtboardData[];
  edges: BoardEdge[];
  /** Update the artboards + edges state (from useArtboards.replaceAll or setArtboards) */
  updateArtboard: (id: string, patch: Partial<ArtboardData>) => void;
  /** Push undo snapshot before mutation */
  pushSnapshot: (artboards: ArtboardData[], edges: BoardEdge[]) => void;
}

interface UseCanvasElementsReturn {
  /** Get all elements for a given artboard, sorted by zIndex ascending */
  getElements: (artboardId: string) => CanvasElement[];
  /** Add a new element to an artboard */
  addElement: <T extends CanvasElementType>(
    artboardId: string,
    type: T,
    props: CanvasElementPropsMap[T],
    overrides?: Partial<Omit<CanvasElement<T>, 'id' | 'type' | 'props'>>,
  ) => CanvasElement<T> | null;
  /** Remove an element from an artboard */
  removeElement: (artboardId: string, elementId: string) => void;
  /** Update partial properties of an element */
  updateElement: (
    artboardId: string,
    elementId: string,
    patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
  ) => void;
  /** Update only the type-specific props of an element */
  updateElementProps: (
    artboardId: string,
    elementId: string,
    propsPatch: Record<string, unknown>,
  ) => void;
  /** Move an element to a new zIndex position (0 = bottom, length-1 = top) */
  reorderElement: (artboardId: string, elementId: string, newIndex: number) => void;
  /** Move element to top of stack */
  bringElementToFront: (artboardId: string, elementId: string) => void;
  /** Move element to bottom of stack */
  sendElementToBack: (artboardId: string, elementId: string) => void;
  /** Duplicate an element within the same artboard */
  duplicateElement: (artboardId: string, elementId: string) => CanvasElement | null;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useCanvasElements = ({
  artboards,
  edges,
  updateArtboard,
  pushSnapshot,
}: UseCanvasElementsParams): UseCanvasElementsReturn => {
  /** Auto-name counters scoped to this hook instance */
  const nameCountersRef = useRef<Record<CanvasElementType, number>>({ ...INITIAL_COUNTERS });

  const autoName = useCallback((type: CanvasElementType): string => {
    nameCountersRef.current[type] += 1;
    return `${TYPE_LABELS[type]} ${nameCountersRef.current[type]}`;
  }, []);

  // -- Helpers --

  const findArtboard = useCallback(
    (artboardId: string) => artboards.find((ab) => ab.id === artboardId) ?? null,
    [artboards],
  );

  // -- Get elements --

  const getElements = useCallback(
    (artboardId: string): CanvasElement[] => {
      const ab = findArtboard(artboardId);
      if (!ab) return [];
      return [...ab.layers].sort((a, b) => a.zIndex - b.zIndex);
    },
    [findArtboard],
  );

  // -- Add element --

  const addElement = useCallback(
    <T extends CanvasElementType>(
      artboardId: string,
      type: T,
      props: CanvasElementPropsMap[T],
      overrides?: Partial<Omit<CanvasElement<T>, 'id' | 'type' | 'props'>>,
    ): CanvasElement<T> | null => {
      const ab = findArtboard(artboardId);
      if (!ab) return null;

      pushSnapshot(artboards, edges);

      const element: CanvasElement<T> = {
        id: nextElementId(),
        type,
        x: overrides?.x ?? 0,
        y: overrides?.y ?? 0,
        width: overrides?.width ?? 100,
        height: overrides?.height ?? 100,
        rotation: overrides?.rotation ?? 0,
        scaleX: overrides?.scaleX ?? 1,
        scaleY: overrides?.scaleY ?? 1,
        opacity: overrides?.opacity ?? 1,
        visible: overrides?.visible ?? true,
        locked: overrides?.locked ?? false,
        zIndex: nextZIndex(ab.layers),
        name: overrides?.name ?? autoName(type),
        props,
      };

      updateArtboard(artboardId, {
        layers: [...ab.layers, element as CanvasElement],
      });

      return element;
    },
    [artboards, edges, autoName, findArtboard, pushSnapshot, updateArtboard],
  );

  // -- Remove element --

  const removeElement = useCallback(
    (artboardId: string, elementId: string) => {
      const ab = findArtboard(artboardId);
      if (!ab) return;

      pushSnapshot(artboards, edges);
      updateArtboard(artboardId, {
        layers: ab.layers.filter((el) => el.id !== elementId),
      });
    },
    [artboards, edges, findArtboard, pushSnapshot, updateArtboard],
  );

  // -- Update element --

  const updateElement = useCallback(
    (
      artboardId: string,
      elementId: string,
      patch: Partial<Omit<CanvasElement, 'id' | 'type'>>,
    ) => {
      const ab = findArtboard(artboardId);
      if (!ab) return;

      pushSnapshot(artboards, edges);
      updateArtboard(artboardId, {
        layers: ab.layers.map((el) =>
          el.id === elementId ? { ...el, ...patch } : el,
        ),
      });
    },
    [artboards, edges, findArtboard, pushSnapshot, updateArtboard],
  );

  // -- Update element props --

  const updateElementProps = useCallback(
    (artboardId: string, elementId: string, propsPatch: Record<string, unknown>) => {
      const ab = findArtboard(artboardId);
      if (!ab) return;

      pushSnapshot(artboards, edges);
      updateArtboard(artboardId, {
        layers: ab.layers.map((el) =>
          el.id === elementId
            ? { ...el, props: { ...el.props, ...propsPatch } }
            : el,
        ),
      });
    },
    [artboards, edges, findArtboard, pushSnapshot, updateArtboard],
  );

  // -- Reorder element --

  const reorderElement = useCallback(
    (artboardId: string, elementId: string, newIndex: number) => {
      const ab = findArtboard(artboardId);
      if (!ab) return;

      pushSnapshot(artboards, edges);

      const sorted = [...ab.layers].sort((a, b) => a.zIndex - b.zIndex);
      const fromIdx = sorted.findIndex((el) => el.id === elementId);
      if (fromIdx === -1) return;

      const [moved] = sorted.splice(fromIdx, 1);
      const clampedIdx = Math.max(0, Math.min(newIndex, sorted.length));
      sorted.splice(clampedIdx, 0, moved);

      // Reassign zIndex based on new order
      const reindexed = sorted.map((el, i) => ({ ...el, zIndex: i + 1 }));
      updateArtboard(artboardId, { layers: reindexed });
    },
    [artboards, edges, findArtboard, pushSnapshot, updateArtboard],
  );

  // -- Bring to front --

  const bringElementToFront = useCallback(
    (artboardId: string, elementId: string) => {
      const ab = findArtboard(artboardId);
      if (!ab) return;
      const maxZ = nextZIndex(ab.layers);
      const el = ab.layers.find((l) => l.id === elementId);
      if (!el || el.zIndex === maxZ - 1) return;

      pushSnapshot(artboards, edges);
      updateArtboard(artboardId, {
        layers: ab.layers.map((l) =>
          l.id === elementId ? { ...l, zIndex: maxZ } : l,
        ),
      });
    },
    [artboards, edges, findArtboard, pushSnapshot, updateArtboard],
  );

  // -- Send to back --

  const sendElementToBack = useCallback(
    (artboardId: string, elementId: string) => {
      const ab = findArtboard(artboardId);
      if (!ab) return;
      const minZ = ab.layers.length === 0 ? 0 : Math.min(...ab.layers.map((l) => l.zIndex));
      const el = ab.layers.find((l) => l.id === elementId);
      if (!el || el.zIndex === minZ) return;

      pushSnapshot(artboards, edges);
      updateArtboard(artboardId, {
        layers: ab.layers.map((l) =>
          l.id === elementId ? { ...l, zIndex: minZ - 1 } : l,
        ),
      });
    },
    [artboards, edges, findArtboard, pushSnapshot, updateArtboard],
  );

  // -- Duplicate element --

  const duplicateElement = useCallback(
    (artboardId: string, elementId: string): CanvasElement | null => {
      const ab = findArtboard(artboardId);
      if (!ab) return null;

      const source = ab.layers.find((el) => el.id === elementId);
      if (!source) return null;

      pushSnapshot(artboards, edges);

      const duplicate: CanvasElement = {
        ...source,
        id: nextElementId(),
        x: source.x + 20,
        y: source.y + 20,
        zIndex: nextZIndex(ab.layers),
        name: `${source.name} copy`,
        props: { ...source.props },
      };

      updateArtboard(artboardId, {
        layers: [...ab.layers, duplicate],
      });

      return duplicate;
    },
    [artboards, edges, findArtboard, pushSnapshot, updateArtboard],
  );

  return {
    getElements,
    addElement,
    removeElement,
    updateElement,
    updateElementProps,
    reorderElement,
    bringElementToFront,
    sendElementToBack,
    duplicateElement,
  };
};

export default useCanvasElements;
