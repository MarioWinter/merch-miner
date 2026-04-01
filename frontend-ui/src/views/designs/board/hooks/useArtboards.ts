import { useCallback, useEffect, useRef, useState } from 'react';
import { useUpdateProjectMutation } from '@/store/designSlice';
import type { ArtboardData, BackgroundColor, BoardLayout, DesignModel } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const SAVE_DEBOUNCE_MS = 1200;
const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 280;
const AI_BOARD_GAP = 100; // horizontal gap between source and AI board

// -----------------------------------------------------------------
// Edge type (connection between artboards)
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
  /** Designs from the API to hydrate initial artboards */
  designs?: Array<{
    id: string;
    image_file: string | null;
    status: string;
    is_manual?: boolean;
    background_color?: string;
    generation_run?: {
      prompt_used?: string;
      model_name?: string;
    } | null;
  }>;
}

interface UseArtboardsReturn {
  artboards: ArtboardData[];
  edges: BoardEdge[];
  selectedIds: Set<string>;
  /** Select a single artboard (clears others unless shift held) */
  selectArtboard: (id: string, additive: boolean) => void;
  /** Deselect all artboards */
  deselectAll: () => void;
  /** Select artboards whose bounds intersect the given rect (world coords) */
  selectByRect: (rect: { x: number; y: number; width: number; height: number }) => void;
  /** Move an artboard to a new position */
  moveArtboard: (id: string, x: number, y: number) => void;
  /** Rename an artboard label */
  renameArtboard: (id: string, label: string) => void;
  /** Add a new artboard */
  addArtboard: (partial?: Partial<ArtboardData>) => ArtboardData;
  /** Add an AI Image Board connected to a source artboard */
  addAiImageBoard: (sourceId: string) => ArtboardData | null;
  /** Remove artboard(s) */
  removeArtboards: (ids: string[]) => void;
  /** Duplicate an artboard with offset position */
  duplicateArtboard: (id: string) => ArtboardData | null;
  /** Move artboard to front of render order */
  bringToFront: (id: string) => void;
  /** Move artboard to back of render order */
  sendToBack: (id: string) => void;
  /** Update arbitrary artboard properties */
  updateArtboard: (id: string, patch: Partial<ArtboardData>) => void;
  /** Resize an artboard (width/height) */
  resizeArtboard: (id: string, width: number, height: number) => void;
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
  const [artboards, setArtboards] = useState<ArtboardData[]>([]);
  const [edges, setEdges] = useState<BoardEdge[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);
  const [updateProject] = useUpdateProjectMutation();

  // -- Hydrate from savedLayout + designs on first load --
  useEffect(() => {
    if (initializedRef.current) return;
    if (!designs) return;

    const layoutNodes = savedLayout?.nodes ?? [];
    const positionMap = new Map(layoutNodes.map((n) => [n.id, { x: n.x, y: n.y }]));

    const hydrated: ArtboardData[] = designs.map((d, i) => {
      const pos = positionMap.get(d.id);
      const run = d.generation_run;
      const isAi = !!run && !d.is_manual;
      const promptText = run?.prompt_used ?? '';
      return {
        id: d.id,
        label: isAi
          ? `AI: ${promptText.slice(0, 30)}${promptText.length > 30 ? '…' : ''}`
          : `Artboard ${i + 1}`,
        x: pos?.x ?? 80 + i * (DEFAULT_WIDTH + 60),
        y: pos?.y ?? 80,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        imageUrl: d.image_file ?? null,
        kind: isAi ? 'ai' as const : 'regular' as const,
        sourceId: null,
        designId: d.id,
        opacity: 100,
        backgroundColor: '#FFFFFF',
        clipContent: false,
        promptUsed: run?.prompt_used,
        modelUsed: run?.model_name as DesignModel | undefined,
        bgColorUsed: d.background_color as BackgroundColor | undefined,
      };
    });

    setArtboards(hydrated);

    // Hydrate edges from saved layout
    const savedEdges = savedLayout?.edges ?? [];
    setEdges(savedEdges.map((e) => ({ source: e.source, target: e.target })));

    initializedRef.current = true;
  }, [designs, savedLayout]);

  // -- Persist layout (debounced) --
  const persistLayout = useCallback(
    (boards: ArtboardData[], currentEdges?: BoardEdge[]) => {
      if (!projectId) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        const nodes = boards.map((b) => ({ id: b.id, x: b.x, y: b.y }));
        setEdges((latestEdges) => {
          const edgesToSave = currentEdges ?? latestEdges;
          void updateProject({
            projectId,
            body: { board_layout: { nodes, edges: edgesToSave } },
          });
          return latestEdges;
        });
      }, SAVE_DEBOUNCE_MS);
    },
    [projectId, updateProject],
  );

  // -- Selection --
  const selectArtboard = useCallback((id: string, additive: boolean) => {
    setSelectedIds((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectByRect = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      // Normalize rect (handle negative width/height from rubber-band)
      const normalized = {
        x: rect.width < 0 ? rect.x + rect.width : rect.x,
        y: rect.height < 0 ? rect.y + rect.height : rect.y,
        width: Math.abs(rect.width),
        height: Math.abs(rect.height),
      };

      setArtboards((current) => {
        const ids = new Set<string>();
        for (const ab of current) {
          if (rectsIntersect(normalized, { x: ab.x, y: ab.y, width: ab.width, height: ab.height })) {
            ids.add(ab.id);
          }
        }
        setSelectedIds(ids);
        return current;
      });
    },
    [],
  );

  // -- Move --
  const moveArtboard = useCallback(
    (id: string, x: number, y: number) => {
      setArtboards((prev) => {
        const next = prev.map((ab) => (ab.id === id ? { ...ab, x, y } : ab));
        persistLayout(next);
        return next;
      });
    },
    [persistLayout],
  );

  // -- Rename --
  const renameArtboard = useCallback((id: string, label: string) => {
    setArtboards((prev) => prev.map((ab) => (ab.id === id ? { ...ab, label } : ab)));
  }, []);

  // -- Add --
  const addArtboard = useCallback(
    (partial?: Partial<ArtboardData>) => {
      const newBoard: ArtboardData = {
        id: partial?.id ?? nextId(),
        label: partial?.label ?? `Artboard ${artboards.length + 1}`,
        x: partial?.x ?? 80 + artboards.length * (DEFAULT_WIDTH + 60),
        y: partial?.y ?? 80,
        width: partial?.width ?? DEFAULT_WIDTH,
        height: partial?.height ?? DEFAULT_HEIGHT,
        imageUrl: partial?.imageUrl ?? null,
        kind: partial?.kind ?? 'regular',
        sourceId: partial?.sourceId ?? null,
        designId: partial?.designId ?? null,
        opacity: partial?.opacity ?? 100,
        backgroundColor: partial?.backgroundColor ?? '#FFFFFF',
        clipContent: partial?.clipContent ?? false,
        isGenerating: partial?.isGenerating ?? false,
        promptUsed: partial?.promptUsed,
        modelUsed: partial?.modelUsed,
        bgColorUsed: partial?.bgColorUsed,
      };
      setArtboards((prev) => {
        const next = [...prev, newBoard];
        persistLayout(next);
        return next;
      });
      return newBoard;
    },
    [artboards.length, persistLayout],
  );

  // -- Add AI Image Board --
  const addAiImageBoard = useCallback(
    (sourceId: string): ArtboardData | null => {
      const source = artboards.find((ab) => ab.id === sourceId);
      if (!source) return null;

      const aiBoard: ArtboardData = {
        id: nextId(),
        label: 'AI Image Board',
        x: source.x + source.width + AI_BOARD_GAP,
        y: source.y,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        imageUrl: null,
        kind: 'ai',
        sourceId,
        designId: null,
        opacity: 100,
        backgroundColor: '#FFFFFF',
        clipContent: false,
      };

      const newEdge: BoardEdge = { source: sourceId, target: aiBoard.id };

      setArtboards((prev) => {
        const next = [...prev, aiBoard];
        setEdges((prevEdges) => {
          const nextEdges = [...prevEdges, newEdge];
          persistLayout(next, nextEdges);
          return nextEdges;
        });
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
        ...source,
        id: nextId(),
        label: `${source.label} copy`,
        x: source.x + 40,
        y: source.y + 40,
        sourceId: null,
        designId: null,
        opacity: source.opacity,
        backgroundColor: source.backgroundColor,
        clipContent: source.clipContent,
      };

      setArtboards((prev) => {
        const next = [...prev, duplicate];
        persistLayout(next);
        return next;
      });

      return duplicate;
    },
    [artboards, persistLayout],
  );

  // -- Reorder --
  const bringToFront = useCallback(
    (id: string) => {
      setArtboards((prev) => {
        const idx = prev.findIndex((ab) => ab.id === id);
        if (idx === -1 || idx === prev.length - 1) return prev;
        const next = [...prev.filter((ab) => ab.id !== id), prev[idx]];
        persistLayout(next);
        return next;
      });
    },
    [persistLayout],
  );

  const sendToBack = useCallback(
    (id: string) => {
      setArtboards((prev) => {
        const idx = prev.findIndex((ab) => ab.id === id);
        if (idx === -1 || idx === 0) return prev;
        const next = [prev[idx], ...prev.filter((ab) => ab.id !== id)];
        persistLayout(next);
        return next;
      });
    },
    [persistLayout],
  );

  // -- Remove --
  const removeArtboards = useCallback(
    (ids: string[]) => {
      const removeSet = new Set(ids);
      setArtboards((prev) => {
        const next = prev.filter((ab) => !removeSet.has(ab.id));
        setEdges((prevEdges) => {
          const nextEdges = prevEdges.filter(
            (e) => !removeSet.has(e.source) && !removeSet.has(e.target),
          );
          persistLayout(next, nextEdges);
          return nextEdges;
        });
        return next;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    },
    [persistLayout],
  );

  // -- Update arbitrary properties --
  const updateArtboard = useCallback(
    (id: string, patch: Partial<ArtboardData>) => {
      setArtboards((prev) => {
        const next = prev.map((ab) => (ab.id === id ? { ...ab, ...patch } : ab));
        persistLayout(next);
        return next;
      });
    },
    [persistLayout],
  );

  // -- Resize (width/height) --
  const resizeArtboard = useCallback(
    (id: string, width: number, height: number) => {
      setArtboards((prev) => {
        const next = prev.map((ab) => (ab.id === id ? { ...ab, width, height } : ab));
        persistLayout(next);
        return next;
      });
    },
    [persistLayout],
  );

  return {
    artboards,
    edges,
    selectedIds,
    selectArtboard,
    deselectAll,
    selectByRect,
    moveArtboard,
    renameArtboard,
    addArtboard,
    addAiImageBoard,
    removeArtboards,
    duplicateArtboard,
    bringToFront,
    sendToBack,
    updateArtboard,
    resizeArtboard,
  };
};

export default useArtboards;
