import { useCallback, useEffect, useRef, useState } from 'react';
import { useUpdateProjectMutation } from '@/store/designSlice';
import type { ArtboardData, BoardLayout } from '../types';
import {
  DEFAULT_ARTBOARD_HEIGHT,
  DEFAULT_ARTBOARD_WIDTH,
  fitToMaxDimension,
  nextArtboardLabel,
} from '../utils/artboardSizing';
import { hydrateDesigns, mergeWithLocalArtboards } from '../utils/artboardHydration';
import type { HydratableDesign } from '../utils/artboardHydration';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const SAVE_DEBOUNCE_MS = 1200;
const AI_BOARD_GAP = 100;

// -----------------------------------------------------------------
// Edge type
// -----------------------------------------------------------------

export interface BoardEdge {
  source: string;
  target: string;
}

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseArtboardsParams {
  projectId: string;
  savedLayout: BoardLayout | null;
  designs?: HydratableDesign[];
}

interface UseArtboardsReturn {
  artboards: ArtboardData[];
  edges: BoardEdge[];
  selectedIds: Set<string>;
  selectArtboard: (id: string, additive: boolean) => void;
  deselectAll: () => void;
  selectByRect: (rect: { x: number; y: number; width: number; height: number }) => void;
  moveArtboard: (id: string, x: number, y: number) => void;
  renameArtboard: (id: string, label: string) => void;
  addArtboard: (partial?: Partial<ArtboardData>) => ArtboardData;
  addAiImageBoard: (sourceId: string) => ArtboardData | null;
  removeArtboards: (ids: string[]) => void;
  duplicateArtboard: (id: string) => ArtboardData | null;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  updateArtboard: (id: string, patch: Partial<ArtboardData>) => void;
  resizeArtboard: (id: string, width: number, height: number) => void;
  replaceAll: (newArtboards: ArtboardData[], newEdges: BoardEdge[]) => void;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

let artboardCounter = 0;
const nextId = () => `ab_${Date.now()}_${++artboardCounter}`;

const rectsIntersect = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useArtboards = ({
  projectId,
  savedLayout,
  designs,
}: UseArtboardsParams): UseArtboardsReturn => {
  const hydratedDesignsRef = useRef<typeof designs>(designs);

  const [artboards, setArtboards] = useState<ArtboardData[]>(() => {
    if (!designs) return [];
    return hydrateDesigns(designs, savedLayout);
  });

  const [edges, setEdges] = useState<BoardEdge[]>(() => {
    const savedEdges = savedLayout?.edges ?? [];
    return savedEdges.map((e) => ({ source: e.source, target: e.target }));
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [updateProject] = useUpdateProjectMutation();

  // Re-hydrate when designs change
  useEffect(() => {
    if (designs && designs !== hydratedDesignsRef.current) {
      hydratedDesignsRef.current = designs;
      queueMicrotask(() => {
        setArtboards((currentArtboards) => {
          const designIds = new Set(designs.map((d) => d.id));
          const completedRunIds = new Set(
            designs.map((d) => d.generation_run?.id).filter((x): x is string => !!x),
          );
          const hydrated = hydrateDesigns(designs, savedLayout, currentArtboards);
          return mergeWithLocalArtboards(hydrated, currentArtboards, designIds, completedRunIds);
        });
        const savedEdges = savedLayout?.edges ?? [];
        setEdges(savedEdges.map((e) => ({ source: e.source, target: e.target })));
      });
    }
  }, [designs, savedLayout]);

  // Resize artboards to match actual image dimensions
  const resizedIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    setArtboards((prev) => {
      const toResize = prev.filter(
        (ab) => ab.imageUrl && ab.width === DEFAULT_ARTBOARD_WIDTH && ab.height === DEFAULT_ARTBOARD_HEIGHT && !resizedIdsRef.current.has(ab.id),
      );
      if (toResize.length === 0) return prev;
      for (const ab of toResize) {
        resizedIdsRef.current.add(ab.id);
        const img = new window.Image();
        img.src = ab.imageUrl!;
        img.onload = () => {
          const nw = img.naturalWidth;
          const nh = img.naturalHeight;
          if (nw <= 0 || nh <= 0) return;
          if (nw === DEFAULT_ARTBOARD_WIDTH && nh === DEFAULT_ARTBOARD_HEIGHT) return;
          const { width: fitW, height: fitH } = fitToMaxDimension(nw, nh);
          setArtboards((current) =>
            current.map((a) => {
              if (a.id !== ab.id) return a;
              const updatedLayers = a.layers.map((el) =>
                el.type === 'image' ? { ...el, width: fitW, height: fitH, props: { ...el.props, naturalWidth: nw, naturalHeight: nh } } : el,
              );
              return { ...a, width: fitW, height: fitH, layers: updatedLayers };
            }),
          );
        };
      }
      return prev;
    });
  }, [artboards.length]);

  // -- Persist layout (debounced) --
  const persistLayout = useCallback(
    (boards: ArtboardData[], currentEdges?: BoardEdge[]) => {
      if (!projectId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        const nodes = boards.map((b) => ({
          id: b.id, x: b.x, y: b.y, label: b.label, width: b.width, height: b.height,
          backgroundColor: b.backgroundColor, opacity: b.opacity, clipContent: b.clipContent, layers: b.layers ?? [],
          kind: b.kind,
          isGenerating: b.isGenerating ?? false,
          pendingRunId: b.pendingRunId ?? null,
          promptUsed: b.promptUsed,
          hasError: b.hasError ?? false,
        }));
        setEdges((latestEdges) => {
          const edgesToSave = currentEdges ?? latestEdges;
          void updateProject({ projectId, body: { board_layout: { nodes, edges: edgesToSave } } });
          return latestEdges;
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [projectId, updateProject],
  );

  // -- Selection --
  const selectArtboard = useCallback((id: string, additive: boolean) => {
    setSelectedIds((prev) => {
      if (additive) { const next = new Set(prev); if (next.has(id)) { next.delete(id); } else { next.add(id); } return next; }
      return new Set([id]);
    });
  }, []);

  const deselectAll = useCallback(() => { setSelectedIds(new Set()); }, []);

  const selectByRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      const normalized = {
        x: rect.width < 0 ? rect.x + rect.width : rect.x,
        y: rect.height < 0 ? rect.y + rect.height : rect.y,
        width: Math.abs(rect.width), height: Math.abs(rect.height),
      };
      setArtboards((current) => {
        const ids = new Set<string>();
        for (const ab of current) {
          if (rectsIntersect(normalized, { x: ab.x, y: ab.y, width: ab.width, height: ab.height })) ids.add(ab.id);
        }
        setSelectedIds(ids);
        return current;
      });
    },
    [],
  );

  // -- Move --
  const moveArtboard = useCallback((id: string, x: number, y: number) => {
    setArtboards((prev) => { const next = prev.map((ab) => (ab.id === id ? { ...ab, x, y } : ab)); persistLayout(next); return next; });
  }, [persistLayout]);

  // -- Rename --
  const renameArtboard = useCallback((id: string, label: string) => {
    setArtboards((prev) => prev.map((ab) => (ab.id === id ? { ...ab, label } : ab)));
  }, []);

  // -- Add --
  const addArtboard = useCallback(
    (partial?: Partial<ArtboardData>) => {
      const newBoard: ArtboardData = {
        id: partial?.id ?? nextId(),
        label: partial?.label ?? nextArtboardLabel(artboards.map((ab) => ab.label)),
        x: partial?.x ?? 80 + artboards.length * (DEFAULT_ARTBOARD_WIDTH + 60),
        y: partial?.y ?? 80,
        width: partial?.width ?? DEFAULT_ARTBOARD_WIDTH,
        height: partial?.height ?? DEFAULT_ARTBOARD_HEIGHT,
        imageUrl: partial?.imageUrl ?? null,
        kind: partial?.kind ?? 'regular',
        sourceId: partial?.sourceId ?? null,
        designId: partial?.designId ?? null,
        opacity: partial?.opacity ?? 100,
        backgroundColor: partial?.backgroundColor ?? '#FFFFFF',
        clipContent: partial?.clipContent ?? false,
        layers: partial?.layers ?? [],
        isGenerating: partial?.isGenerating ?? false,
        promptUsed: partial?.promptUsed,
        modelUsed: partial?.modelUsed,
        bgColorUsed: partial?.bgColorUsed,
      };
      setArtboards((prev) => {
        // Strict-Mode safety: the updater function runs twice in dev, so
        // guard against pushing the same newBoard twice.
        if (prev.some((ab) => ab.id === newBoard.id)) return prev;
        const next = [...prev, newBoard];
        persistLayout(next);
        return next;
      });
      return newBoard;
    },
    [artboards, persistLayout],
  );

  // -- Add AI Image Board --
  const addAiImageBoard = useCallback(
    (sourceId: string): ArtboardData | null => {
      const source = artboards.find((ab) => ab.id === sourceId);
      if (!source) return null;
      const aiBoard: ArtboardData = {
        id: nextId(), label: 'AI Image Board',
        x: source.x + source.width + AI_BOARD_GAP, y: source.y,
        width: DEFAULT_ARTBOARD_WIDTH, height: DEFAULT_ARTBOARD_HEIGHT,
        imageUrl: null, kind: 'ai', sourceId, designId: null,
        opacity: 100, backgroundColor: '#FFFFFF', clipContent: false, layers: [],
      };
      const newEdge: BoardEdge = { source: sourceId, target: aiBoard.id };
      setArtboards((prev) => {
        const next = [...prev, aiBoard];
        setEdges((prevEdges) => { const nextEdges = [...prevEdges, newEdge]; persistLayout(next, nextEdges); return nextEdges; });
        return next;
      });
      return aiBoard;
    },
    [artboards, persistLayout],
  );

  // -- Duplicate --
  const duplicateArtboard = useCallback(
    (id: string): ArtboardData | null => {
      const source = artboards.find((ab) => ab.id === id);
      if (!source) return null;
      const duplicate: ArtboardData = {
        ...source, id: nextId(), label: `${source.label} copy`,
        x: source.x + 40, y: source.y + 40, sourceId: null, designId: null,
        layers: source.layers.map((el) => ({ ...el, id: `el_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, props: { ...el.props } })),
      };
      setArtboards((prev) => { const next = [...prev, duplicate]; persistLayout(next); return next; });
      return duplicate;
    },
    [artboards, persistLayout],
  );

  // -- Reorder --
  const bringToFront = useCallback((id: string) => {
    setArtboards((prev) => {
      const idx = prev.findIndex((ab) => ab.id === id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const next = [...prev.filter((ab) => ab.id !== id), prev[idx]]; persistLayout(next); return next;
    });
  }, [persistLayout]);

  const sendToBack = useCallback((id: string) => {
    setArtboards((prev) => {
      const idx = prev.findIndex((ab) => ab.id === id);
      if (idx === -1 || idx === 0) return prev;
      const next = [prev[idx], ...prev.filter((ab) => ab.id !== id)]; persistLayout(next); return next;
    });
  }, [persistLayout]);

  // -- Remove --
  const removeArtboards = useCallback((ids: string[]) => {
    const removeSet = new Set(ids);
    setArtboards((prev) => {
      const next = prev.filter((ab) => !removeSet.has(ab.id));
      setEdges((prevEdges) => {
        const nextEdges = prevEdges.filter((e) => !removeSet.has(e.source) && !removeSet.has(e.target));
        persistLayout(next, nextEdges); return nextEdges;
      });
      return next;
    });
    setSelectedIds((prev) => { const next = new Set(prev); for (const id of ids) next.delete(id); return next; });
  }, [persistLayout]);

  // -- Update --
  const updateArtboard = useCallback((id: string, patch: Partial<ArtboardData>) => {
    setArtboards((prev) => { const next = prev.map((ab) => (ab.id === id ? { ...ab, ...patch } : ab)); persistLayout(next); return next; });
  }, [persistLayout]);

  // -- Resize --
  const resizeArtboard = useCallback((id: string, width: number, height: number) => {
    setArtboards((prev) => { const next = prev.map((ab) => (ab.id === id ? { ...ab, width, height } : ab)); persistLayout(next); return next; });
  }, [persistLayout]);

  // -- Replace all (undo/redo) --
  const replaceAll = useCallback((newArtboards: ArtboardData[], newEdges: BoardEdge[]) => {
    setArtboards(newArtboards); setEdges(newEdges); persistLayout(newArtboards, newEdges);
  }, [persistLayout]);

  return {
    artboards, edges, selectedIds,
    selectArtboard, deselectAll, selectByRect, moveArtboard, renameArtboard,
    addArtboard, addAiImageBoard, removeArtboards, duplicateArtboard,
    bringToFront, sendToBack, updateArtboard, resizeArtboard, replaceAll,
  };
};

export default useArtboards;
