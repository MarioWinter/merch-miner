import { useCallback, useMemo, useState } from 'react';
import type Konva from 'konva';
import type { ArtboardData } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const LABEL_OFFSET_Y = 28; // px above artboard in world space

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface EditingLabel {
  id: string;
  screenX: number;
  screenY: number;
  value: string;
}

interface UseCanvasHandlersParams {
  artboards: ArtboardData[];
  selectedIds: Set<string>;
  zoom: number;
  panX: number;
  panY: number;
  selectArtboard: (id: string, additive: boolean) => void;
  moveArtboard: (id: string, x: number, y: number) => void;
  renameArtboard: (id: string, label: string) => void;
  setPan: (x: number, y: number) => void;
  rubberBandOriginRef: React.RefObject<{ x: number; y: number } | null>;
}

interface UseCanvasHandlersReturn {
  editingLabel: EditingLabel | null;
  selectedAiBoard: ArtboardData | null;
  regeneratePosition: { screenX: number; screenY: number } | null;
  artboardMap: Map<string, ArtboardData>;
  handleDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  handleDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  handleArtboardSelect: (id: string, additive: boolean) => void;
  handleArtboardDragEnd: (id: string, x: number, y: number) => void;
  handleDoubleClickLabel: (id: string) => void;
  handleLabelConfirm: (newLabel: string) => void;
  handleLabelCancel: () => void;
  handleRegenerate: () => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useCanvasHandlers = ({
  artboards,
  selectedIds,
  zoom,
  panX,
  panY,
  selectArtboard,
  moveArtboard,
  renameArtboard,
  setPan,
  rubberBandOriginRef,
}: UseCanvasHandlersParams): UseCanvasHandlersReturn => {
  const [editingLabel, setEditingLabel] = useState<EditingLabel | null>(null);

  // -- Artboard lookup map --
  const artboardMap = useMemo(() => {
    const map = new Map<string, ArtboardData>();
    for (const ab of artboards) map.set(ab.id, ab);
    return map;
  }, [artboards]);

  // -- Selected AI board (for regenerate overlay) --
  const selectedAiBoard = useMemo(() => {
    if (selectedIds.size !== 1) return null;
    const id = [...selectedIds][0];
    const ab = artboardMap.get(id);
    return ab?.kind === 'ai' ? ab : null;
  }, [selectedIds, artboardMap]);

  const regeneratePosition = useMemo(() => {
    if (!selectedAiBoard) return null;
    const screenX = (selectedAiBoard.x + selectedAiBoard.width / 2) * zoom + panX;
    const screenY = (selectedAiBoard.y + selectedAiBoard.height + 16) * zoom + panY;
    return { screenX, screenY };
  }, [selectedAiBoard, zoom, panX, panY]);

  // -- Stage drag (infinite pan) --
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (e.target !== e.currentTarget) return;
      setPan(e.target.x(), e.target.y());
    },
    [setPan],
  );

  const handleDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      if (rubberBandOriginRef.current) {
        e.target.stopDrag();
        return;
      }
      if (e.target !== e.currentTarget && e.target.getClassName() !== 'Group') {
        e.target.stopDrag();
      }
    },
    [rubberBandOriginRef],
  );

  // -- Artboard event handlers --
  const handleArtboardSelect = useCallback(
    (id: string, additive: boolean) => selectArtboard(id, additive),
    [selectArtboard],
  );

  const handleArtboardDragEnd = useCallback(
    (id: string, x: number, y: number) => moveArtboard(id, x, y),
    [moveArtboard],
  );

  const handleDoubleClickLabel = useCallback(
    (id: string) => {
      const ab = artboards.find((a) => a.id === id);
      if (!ab) return;
      const screenX = ab.x * zoom + panX;
      const screenY = (ab.y - LABEL_OFFSET_Y) * zoom + panY;
      setEditingLabel({ id, screenX, screenY, value: ab.label });
    },
    [artboards, zoom, panX, panY],
  );

  const handleLabelConfirm = useCallback(
    (newLabel: string) => {
      if (editingLabel) renameArtboard(editingLabel.id, newLabel);
      setEditingLabel(null);
    },
    [editingLabel, renameArtboard],
  );

  const handleLabelCancel = useCallback(() => setEditingLabel(null), []);

  const handleRegenerate = useCallback(() => {
    // TODO: trigger AI design generation for the selected AI Image Board
  }, []);

  return {
    editingLabel,
    selectedAiBoard,
    regeneratePosition,
    artboardMap,
    handleDragEnd,
    handleDragStart,
    handleArtboardSelect,
    handleArtboardDragEnd,
    handleDoubleClickLabel,
    handleLabelConfirm,
    handleLabelCancel,
    handleRegenerate,
  };
};

export default useCanvasHandlers;
