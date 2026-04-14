import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ArtboardData, CanvasTool, CanvasElement } from '../../board/types';
import useArtboardCanvas from '../../board/hooks/useArtboardCanvas';
import useCanvasHistory from '../../board/hooks/useCanvasHistory';
import useCanvasElements from '../../board/hooks/useCanvasElements';
import useElementSelection from '../../board/hooks/useElementSelection';
import useDrawingHandlers from '../../board/hooks/useDrawingHandlers';
import usePenTool from '../../board/hooks/usePenTool';
import useBrushTool from '../../board/hooks/useBrushTool';
import useEmojiPicker from '../../board/hooks/useEmojiPicker';
import useTextEditing from '../../board/hooks/useTextEditing';
import rasterizeEmoji from '../../board/utils/rasterizeEmoji';
import type { BoardEdge } from '../../board/hooks/useArtboards';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseWorkspaceCanvasParams {
  activeTab: string;
  artboards: ArtboardData[];
  edges: BoardEdge[];
  selectedIds: Set<string>;
  selectArtboard: (id: string, additive: boolean) => void;
  deselectAll: () => void;
  updateArtboard: (id: string, patch: Partial<ArtboardData>) => void;
  replaceAll: (artboards: ArtboardData[], edges: BoardEdge[]) => void;
  moveArtboard: (id: string, x: number, y: number) => void;
  resizeArtboard: (id: string, width: number, height: number) => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useWorkspaceCanvas = ({
  activeTab,
  artboards,
  edges,
  selectedIds,
  selectArtboard,
  deselectAll,
  updateArtboard,
  replaceAll,
  moveArtboard,
  resizeArtboard,
}: UseWorkspaceCanvasParams) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const canvasHook = useArtboardCanvas();
  const [activeTool, setActiveTool] = useState<CanvasTool>('cursor');
  const canvasHistory = useCanvasHistory();
  const elementSelection = useElementSelection();

  const canvasElements = useCanvasElements({
    artboards,
    edges,
    updateArtboard,
    pushSnapshot: canvasHistory.pushSnapshot,
  });

  const pushHistory = useCallback(() => {
    canvasHistory.pushSnapshot(artboards, edges);
  }, [canvasHistory, artboards, edges]);

  const handleCanvasUndo = useCallback(() => {
    const snapshot = canvasHistory.undo(artboards, edges);
    if (snapshot) replaceAll(snapshot.artboards, snapshot.edges);
  }, [canvasHistory, artboards, edges, replaceAll]);

  const handleCanvasRedo = useCallback(() => {
    const snapshot = canvasHistory.redo(artboards, edges);
    if (snapshot) replaceAll(snapshot.artboards, snapshot.edges);
  }, [canvasHistory, artboards, edges, replaceAll]);

  // Shift-key -> free-scale
  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') elementSelection.enterFreeTransform(); };
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') elementSelection.exitFreeTransform(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [activeTab, elementSelection]);

  // Cmd+Z / Cmd+Shift+Z
  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) { handleCanvasRedo(); } else { handleCanvasUndo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, handleCanvasUndo, handleCanvasRedo]);

  const isTextEditingRef = useRef(false);

  // -- Element selection handler --
  const handleElementSelect = useCallback(
    (artboardId: string, elementId: string) => {
      elementSelection.selectElement(artboardId, elementId);
      selectArtboard(artboardId, false);
    },
    [elementSelection, selectArtboard],
  );

  // -- Drawing tools --
  const drawingHandlers = useDrawingHandlers({
    activeTool, addElement: canvasElements.addElement, setActiveTool, onElementSelect: handleElementSelect,
  });
  const penTool = usePenTool({
    activeTool, addElement: canvasElements.addElement, setActiveTool, onElementSelect: handleElementSelect,
  });
  const brushTool = useBrushTool({
    activeTool, addElement: canvasElements.addElement, updateElement: canvasElements.updateElement,
    getElements: canvasElements.getElements, onElementSelect: handleElementSelect,
  });

  // -- Emoji picker --
  const handleEmojiSelected = useCallback(
    (emoji: string) => {
      const dataUrl = rasterizeEmoji(emoji);
      if (!dataUrl) return;
      const targetId = selectedIds.size > 0 ? [...selectedIds][0] : artboards[0]?.id;
      if (!targetId) {
        enqueueSnackbar(t('design.canvas.noArtboard', 'Create an artboard first'), { variant: 'warning' });
        return;
      }
      const ab = artboards.find((a) => a.id === targetId);
      if (!ab) return;
      const size = 64;
      const newEl = canvasElements.addElement(targetId, 'emoji', { emoji, dataUrl }, {
        x: Math.round(ab.width / 2 - size / 2), y: Math.round(ab.height / 2 - size / 2), width: size, height: size,
      });
      if (newEl) handleElementSelect(targetId, newEl.id);
    },
    [artboards, selectedIds, canvasElements, handleElementSelect, enqueueSnackbar, t],
  );
  const emojiPicker = useEmojiPicker({ onEmojiSelected: handleEmojiSelected });

  // -- Text editing --
  const textEditing = useTextEditing({
    containerRef: canvasHook.containerRef,
    zoom: canvasHook.state.zoom,
    panX: canvasHook.state.panX,
    panY: canvasHook.state.panY,
    onCommit: useCallback(
      (artboardId: string, elementId: string, text: string) => {
        canvasElements.updateElementProps(artboardId, elementId, { text });
      },
      [canvasElements],
    ),
  });
  useEffect(() => {
    isTextEditingRef.current = textEditing.isEditing;
  }, [textEditing.isEditing]);

  const handleElementDoubleClick = useCallback(
    (artboardId: string, elementId: string) => {
      const ab = artboards.find((a) => a.id === artboardId);
      const el = ab?.layers.find((l) => l.id === elementId);
      if (el?.type === 'text') {
        elementSelection.selectElement(artboardId, elementId);
        textEditing.startEditing(artboardId, el as CanvasElement<'text'>, ab!.x, ab!.y);
        return;
      }
      elementSelection.selectElement(artboardId, elementId);
      elementSelection.enterFreeTransform();
    },
    [elementSelection, artboards, textEditing],
  );

  const handleTextInsert = useCallback(
    (artboardId: string, localX: number, localY: number) => {
      const newEl = canvasElements.addElement(artboardId, 'text', {
        text: 'Type here', fontFamily: 'Inter', fontSize: 24, fontWeight: 400,
        fontStyle: 'normal', fill: '#000000', align: 'left', letterSpacing: 0, lineHeight: 1.2,
      }, { x: localX, y: localY, width: 200, height: 40 });
      if (newEl) {
        elementSelection.selectElement(artboardId, newEl.id);
        setActiveTool('cursor');
        const ab = artboards.find((a) => a.id === artboardId);
        if (ab) requestAnimationFrame(() => { textEditing.startEditing(artboardId, newEl, ab.x, ab.y); });
      } else {
        setActiveTool('cursor');
      }
    },
    [canvasElements, elementSelection, artboards, textEditing],
  );

  const handleElementUpdate = useCallback(
    (artboardId: string, elementId: string, patch: Partial<Omit<CanvasElement, 'id' | 'type'>>) => {
      canvasElements.updateElement(artboardId, elementId, patch);
    },
    [canvasElements],
  );

  const handleDeleteElement = useCallback(
    (artboardId: string, elementId: string) => {
      canvasElements.removeElement(artboardId, elementId);
      elementSelection.deselectElement();
    },
    [canvasElements, elementSelection],
  );

  const handleArtboardSelectWithDeselect = useCallback(
    (id: string, additive: boolean) => {
      if (!isTextEditingRef.current) elementSelection.deselectElement();
      selectArtboard(id, additive);
    },
    [elementSelection, selectArtboard],
  );

  const handleDeselectAllWithElement = useCallback(() => {
    if (isTextEditingRef.current) return;
    elementSelection.deselectElement();
    deselectAll();
  }, [elementSelection, deselectAll]);

  // -- Delete/Escape keyboard handler --
  const handleDeleteSelectedRef = useRef<(ids: string[]) => void>(() => {});

  useEffect(() => {
    if (activeTab !== 'canvas') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === 'Escape') {
        if (isTextEditingRef.current) return;
        if (elementSelection.selectedElementId) { e.preventDefault(); elementSelection.deselectElement(); }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
        const elId = elementSelection.selectedElementId;
        const abId = elementSelection.selectedArtboardIdForElement;
        if (elId && abId) { e.preventDefault(); canvasElements.removeElement(abId, elId); elementSelection.deselectElement(); return; }
        const selectedAbIds = Array.from(selectedIds);
        if (selectedAbIds.length > 0) { e.preventDefault(); handleDeleteSelectedRef.current(selectedAbIds); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, elementSelection, canvasElements, selectedIds]);

  // -- Artboard bounds + fit-to-view --
  const artboardBounds = useMemo(() => {
    if (artboards.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ab of artboards) {
      minX = Math.min(minX, ab.x); minY = Math.min(minY, ab.y);
      maxX = Math.max(maxX, ab.x + ab.width); maxY = Math.max(maxY, ab.y + ab.height);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [artboards]);

  const handleFitToView = useCallback(() => {
    canvasHook.fitToView(artboardBounds);
  }, [canvasHook, artboardBounds]);

  const hasFittedRef = useRef(false);
  useEffect(() => {
    if (!hasFittedRef.current && artboardBounds && canvasHook.state.stageWidth > 0 && canvasHook.state.stageHeight > 0) {
      hasFittedRef.current = true;
      canvasHook.fitToView(artboardBounds);
    }
  }, [artboardBounds, canvasHook, artboards.length]);

  // -- History-aware wrappers --
  const moveArtboardWithHistory = useCallback(
    (id: string, x: number, y: number) => { pushHistory(); moveArtboard(id, x, y); },
    [pushHistory, moveArtboard],
  );

  const resizeArtboardWithHistory = useCallback(
    (id: string, width: number, height: number) => { pushHistory(); resizeArtboard(id, width, height); },
    [pushHistory, resizeArtboard],
  );

  return {
    canvasHook,
    activeTool,
    setActiveTool,
    canvasHistory,
    elementSelection,
    canvasElements,
    pushHistory,
    handleCanvasUndo,
    handleCanvasRedo,
    handleElementSelect,
    handleElementDoubleClick,
    handleTextInsert,
    handleElementUpdate,
    handleDeleteElement,
    handleArtboardSelectWithDeselect,
    handleDeselectAllWithElement,
    handleDeleteSelectedRef,
    handleFitToView,
    moveArtboardWithHistory,
    resizeArtboardWithHistory,
    drawingHandlers,
    penTool,
    brushTool,
    emojiPicker,
    textEditing,
  };
};

export default useWorkspaceCanvas;
