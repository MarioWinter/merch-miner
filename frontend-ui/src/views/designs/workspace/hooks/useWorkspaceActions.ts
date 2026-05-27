import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useDeleteDesignMutation } from '@/store/designSlice';
import { fitToMaxDimension } from '../../board/utils/artboardSizing';
import type { ArtboardData } from '../../board/types';
import type useArtboards from '../../board/hooks/useArtboards';
import type useEditorBatch from './useEditorBatch';
import type useWorkspaceCanvas from './useWorkspaceCanvas';
import type useWorkspaceGeneration from './useWorkspaceGeneration';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseWorkspaceActionsParams {
  projectId: string;
  artboardState: ReturnType<typeof useArtboards>;
  canvas: ReturnType<typeof useWorkspaceCanvas>;
  gen: ReturnType<typeof useWorkspaceGeneration>;
  editorBatchHook: ReturnType<typeof useEditorBatch>;
  panelArtboard: ArtboardData | null;
  pushHistory: () => void;
  setActiveTab: (tab: 'canvas' | 'editor') => void;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useWorkspaceActions = ({
  projectId,
  artboardState,
  canvas,
  gen,
  editorBatchHook,
  panelArtboard,
  pushHistory,
  setActiveTab,
}: UseWorkspaceActionsParams) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // -- Delete with server removal --
  const [deleteDesign] = useDeleteDesignMutation();
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeletingFromServer, setIsDeletingFromServer] = useState(false);

  const handleDeleteSelected = useCallback(
    (ids: string[]) => {
      pushHistory();
      const hasServer = artboardState.artboards.filter((ab) => ids.includes(ab.id)).some((ab) => ab.designId);
      if (hasServer) { setPendingDeleteIds(ids); setDeleteConfirmOpen(true); }
      else { artboardState.removeArtboards(ids); }
    },
    [artboardState, pushHistory],
  );
  canvas.handleDeleteSelectedRef.current = handleDeleteSelected;

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeletingFromServer(true);
    const toDelete = artboardState.artboards.filter((ab) => pendingDeleteIds.includes(ab.id) && ab.designId);
    try {
      await Promise.all(toDelete.map((ab) => deleteDesign({ designId: ab.designId!, projectId }).unwrap()));
      artboardState.removeArtboards(pendingDeleteIds);
      enqueueSnackbar(t('design.canvas.deleteSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('design.canvas.deleteError'), { variant: 'error' });
    } finally {
      setIsDeletingFromServer(false); setDeleteConfirmOpen(false); setPendingDeleteIds([]);
    }
  }, [pendingDeleteIds, artboardState, deleteDesign, projectId, enqueueSnackbar, t]);

  const handleDeleteCancel = useCallback(() => { setDeleteConfirmOpen(false); setPendingDeleteIds([]); }, []);

  // -- Export --
  const exportArtboardsRef = useRef<ArtboardData[]>([]);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const handleExportSelected = useCallback(
    (ids: string[]) => {
      exportArtboardsRef.current = artboardState.artboards.filter((ab) => new Set(ids).has(ab.id));
      setExportDialogOpen(true);
    },
    [artboardState.artboards],
  );

  // -- Analyze image --
  const handleAnalyzeImage = useCallback(() => {
    if (panelArtboard?.imageUrl && panelArtboard?.designId) {
      void gen.imageAnalysis.triggerAnalysis(panelArtboard.designId, panelArtboard.imageUrl, panelArtboard.designId);
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      artboardState.addArtboard({ label: 'Reference', kind: 'regular', width: 280, height: 280, imageUrl: url });
      enqueueSnackbar(t('design.actions.imageAdded', 'Image added as reference artboard'), { variant: 'info' });
    };
    input.click();
  }, [panelArtboard, gen.imageAnalysis, artboardState, enqueueSnackbar, t]);

  const handleContextMenuAnalyze = useCallback(
    (artboardId: string) => {
      const ab = artboardState.artboards.find((a) => a.id === artboardId);
      if (!ab?.imageUrl || !ab?.designId) return;
      void gen.imageAnalysis.triggerAnalysis(ab.designId, ab.imageUrl, ab.designId);
    },
    [artboardState.artboards, gen.imageAnalysis],
  );

  // -- Editor transfer --
  const handleOpenInEditor = useCallback(
    (artboardIds: string[]) => {
      const selected = artboardState.artboards.filter((ab) => artboardIds.includes(ab.id) && ab.imageUrl);
      if (selected.length === 0) return;
      editorBatchHook.addToEditorBatch(selected.map((ab) => ({ url: ab.imageUrl as string, name: ab.label, width: ab.width, height: ab.height })));
      setActiveTab('editor');
    },
    [artboardState.artboards, editorBatchHook, setActiveTab],
  );

  const handleAddToCanvas = useCallback(
    (data: { url: string; name: string; width?: number; height?: number }) => {
      const { width, height } = fitToMaxDimension(data.width ?? 280, data.height ?? 280);
      let placeX = 0;
      if (artboardState.artboards.length > 0) {
        let maxRight = -Infinity;
        for (const ab of artboardState.artboards) { const right = ab.x + ab.width; if (right > maxRight) maxRight = right; }
        placeX = maxRight + 40;
      }
      artboardState.addArtboard({ label: data.name, kind: 'regular', width, height, x: placeX, y: 0, imageUrl: data.url });
      enqueueSnackbar(t('design.transfer.addedToCanvas', 'Image added to Canvas'), { variant: 'success' });
    },
    [artboardState, enqueueSnackbar, t],
  );

  // -- Panel actions --
  const handleAddReferenceArtboard = useCallback(
    (imageUrl: string) => { artboardState.addArtboard({ label: 'Reference', kind: 'regular', width: 280, height: 280, imageUrl }); },
    [artboardState],
  );

  const handlePanelSelectArtboard = useCallback(
    (id: string) => {
      artboardState.selectArtboard(id, false);
      const ab = artboardState.artboards.find((a) => a.id === id);
      if (ab) canvas.canvasHook.fitToView({ x: ab.x, y: ab.y, width: ab.width, height: ab.height });
    },
    [artboardState, canvas.canvasHook],
  );

  return {
    // Delete
    deleteConfirmOpen, pendingDeleteIds, isDeletingFromServer,
    handleDeleteSelected, handleDeleteConfirm, handleDeleteCancel,
    // Export
    exportDialogOpen, setExportDialogOpen, exportArtboardsRef, handleExportSelected,
    // Analyze
    handleAnalyzeImage, handleContextMenuAnalyze,
    // Transfer
    handleOpenInEditor, handleAddToCanvas,
    // Panel
    handleAddReferenceArtboard, handlePanelSelectArtboard,
  };
};

export default useWorkspaceActions;
export type UseWorkspaceActionsReturn = ReturnType<typeof useWorkspaceActions>;
