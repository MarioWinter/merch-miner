import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useGetProjectBoardQuery,
  useDeleteDesignMutation,
  useSaveProcessedImageMutation,
  useDeleteDesignVersionMutation,
} from '@/store/designSlice';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useEditorUpload } from './useEditorUpload';
import { useEditorSelection } from './useEditorSelection';
import useUndoRedo from './useUndoRedo';
import type { BatchImage, ToolName } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

// PROJ-27 — `ai_upscale` no longer goes through the apply-pipeline flow.
// The Upscale tool panel triggers a Replicate prediction directly via
// `useUpscaleSingle`. Only `bg_remove` remains as an always-server pipeline tool.
const ALWAYS_SERVER_TOOLS: ToolName[] = ['bg_remove'];

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseEditorBatchStateParams {
  projectId: string;
  editorBatch?: Array<{ id: string; url: string; name: string; width?: number; height?: number }>;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useEditorBatchState = ({
  projectId,
  editorBatch,
}: UseEditorBatchStateParams) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();

  // Helper: load dimensions + fileSize from a URL
  const loadImageMeta = useCallback((imageId: string, url: string) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => {
      setBatchImages((prev) =>
        prev.map((bi) =>
          bi.id === imageId ? { ...bi, width: el.naturalWidth, height: el.naturalHeight } : bi,
        ),
      );
      fetch(url, { method: 'HEAD' })
        .then((res) => {
          const cl = res.headers.get('content-length');
          if (cl) {
            const size = parseInt(cl, 10);
            setBatchImages((prev) =>
              prev.map((bi) => (bi.id === imageId && !bi.fileSize ? { ...bi, fileSize: size } : bi)),
            );
          }
        })
        .catch(() => {});
    };
    el.src = url;
  }, []);

  // Batch state
  const [batchImages, setBatchImages] = useState<BatchImage[]>(() => {
    if (!editorBatch || editorBatch.length === 0) return [];
    return editorBatch.map((item) => ({
      id: item.id, file: null, previewUrl: item.url, name: item.name,
      width: item.width, height: item.height, status: 'idle' as const,
    }));
  });
  // Phase 8 — persist currentImageIndex per-project. Restoration is clamped
  // by the effect below once `batchImages` is known.
  const [currentImageIndex, setCurrentImageIndex] = usePersistentState<number>(
    `mm.editor.currentIndex.${projectId}`,
    0,
    { skipPersistence: !projectId },
  );

  // Hydrate + cross-tab diff merge from API.
  // Replaces the previous one-time `hydratedRef` guard: every change in
  // `boardData.designs` is reconciled with the in-memory batch so a new design
  // created in another browser tab appears here, and a deleted design is
  // removed (AC-7-10..AC-7-12).
  const { data: boardData } = useGetProjectBoardQuery({ projectId }, { skip: !projectId });

  useEffect(() => {
    const serverDesigns = boardData?.designs;
    if (!serverDesigns) return;
    const serverIds = new Set(serverDesigns.map((d) => d.id));

    const newlyAppendedIds: Array<{ id: string; url: string }> = [];

    setBatchImages((prev) => {
      // 1. Drop batch entries whose backing design is gone from the server.
      const filtered = prev.filter((bi) => !bi.designId || serverIds.has(bi.designId));

      // 2. Refresh in-place URL when the server slot changed.
      const updated = filtered.map((bi) => {
        if (!bi.designId) return bi;
        const d = serverDesigns.find((sd) => sd.id === bi.designId);
        if (!d) return bi;
        const latestUrl = d.processed_file || d.bg_removed_file || d.image_file;
        const hasProcessing = !!(d.processed_file || d.bg_removed_file || d.upscaled_file);
        if (!latestUrl || latestUrl === bi.previewUrl) return bi;
        return {
          ...bi,
          previewUrl: latestUrl,
          processedUrl: hasProcessing ? latestUrl : undefined,
          originalUrl: hasProcessing ? (d.image_file ?? undefined) : undefined,
          status: hasProcessing ? ('completed' as const) : bi.status,
        };
      });

      // 3. Append server designs not yet represented in the batch.
      const existingIds = new Set(updated.map((bi) => bi.designId).filter(Boolean) as string[]);
      const appended: BatchImage[] = [];
      for (const d of serverDesigns) {
        if (!d.image_file) continue;
        if (existingIds.has(d.id)) continue;
        const latestUrl = d.processed_file || d.bg_removed_file || d.image_file;
        const hasProcessing = !!(d.processed_file || d.bg_removed_file || d.upscaled_file);
        appended.push({
          id: d.id,
          file: null,
          previewUrl: latestUrl,
          name: (d.image_file ?? '').split('/').pop() ?? 'design.png',
          status: hasProcessing ? ('completed' as const) : ('idle' as const),
          designId: d.id,
          originalUrl: hasProcessing ? (d.image_file ?? undefined) : undefined,
          processedUrl: hasProcessing ? latestUrl : undefined,
        });
        newlyAppendedIds.push({ id: d.id, url: latestUrl });
      }

      // Skip re-render when nothing changed (avoid useless updates).
      if (filtered.length === prev.length && appended.length === 0) {
        // Mutations may still have occurred (URL refresh) — compare shallowly.
        const sameRefs = updated.every((bi, i) => bi === filtered[i]);
        if (sameRefs) return prev;
        return updated;
      }
      return [...updated, ...appended];
    });

    // Load meta for newly appended entries (outside setState to avoid double work).
    newlyAppendedIds.forEach(({ id, url }) => {
      if (url) loadImageMeta(id, url);
    });
  }, [boardData?.designs, loadImageMeta]);

  // AC-7-6 / AC-7-11 — clamp currentImageIndex when batch length changes
  // (initial restore from localStorage, or design deletion).
  useEffect(() => {
    if (batchImages.length === 0) {
      if (currentImageIndex !== 0) setCurrentImageIndex(0);
      return;
    }
    if (currentImageIndex >= batchImages.length) {
      setCurrentImageIndex(Math.max(0, batchImages.length - 1));
    }
  }, [batchImages.length, currentImageIndex, setCurrentImageIndex]);

  // Sync from editorBatch prop
  const prevBatchLenRef = useRef(editorBatch?.length ?? 0);
  useEffect(() => {
    if (!editorBatch || editorBatch.length === 0) return;
    const prevLen = prevBatchLenRef.current;
    prevBatchLenRef.current = editorBatch.length;
    if (editorBatch.length <= prevLen) return;
    const newItems = editorBatch.slice(prevLen);
    const newBatch: BatchImage[] = newItems.map((item) => ({
      id: item.id, file: null, previewUrl: item.url, name: item.name,
      width: item.width, height: item.height, status: 'idle' as const,
    }));
    setBatchImages((prev) => [...prev, ...newBatch]);
    newBatch.forEach((img) => { if (img.previewUrl) loadImageMeta(img.id, img.previewUrl); });
  }, [editorBatch, loadImageMeta]);

  // Upload hook
  const { uploadFiles } = useEditorUpload({ projectId, setBatchImages });

  // Undo/redo
  const undoRedo = useUndoRedo();

  // Multi-select
  const selection = useEditorSelection(batchImages);

  // Server mutations
  const [deleteDesign, { isLoading: isDeletingDesign }] = useDeleteDesignMutation();
  const [saveProcessedImage] = useSaveProcessedImageMutation();
  const [deleteDesignVersion] = useDeleteDesignVersionMutation();
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // Keyboard: Cmd+Z / Cmd+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) {
        const snapshot = undoRedo.redo(batchImages);
        if (snapshot) setBatchImages(snapshot);
      } else {
        const snapshot = undoRedo.undo(batchImages);
        if (snapshot) setBatchImages(snapshot);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoRedo, batchImages]);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preloaded design IDs
  const preloadIds = (searchParams.get('designs') ?? searchParams.get('images') ?? '').split(',').filter(Boolean);

  // Derived
  const hasImages = batchImages.length > 0;
  const currentImage = hasImages ? batchImages[currentImageIndex] : null;

  // -- Handlers --

  const handleFilesAdded = useCallback((files: File[]) => {
    const newImages: BatchImage[] = files.map((file) => ({
      id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file),
      name: file.name, status: 'idle' as const, fileSize: file.size,
    }));
    setBatchImages((prev) => [...prev, ...newImages]);
    if (batchImages.length === 0) setCurrentImageIndex(0);
    newImages.forEach((img) => loadImageMeta(img.id, img.previewUrl));
    uploadFiles(newImages);
  }, [batchImages.length, uploadFiles, loadImageMeta]);

  const handleBrowseClick = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) handleFilesAdded(Array.from(files));
      e.target.value = '';
    },
    [handleFilesAdded],
  );

  const handleRemoveImage = useCallback((index: number) => {
    setBatchImages((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
    setCurrentImageIndex((prev) => Math.min(prev, Math.max(0, batchImages.length - 2)));
  }, [batchImages.length]);

  const handleRemoveAll = useCallback(() => {
    batchImages.forEach((img) => { if (img.previewUrl) URL.revokeObjectURL(img.previewUrl); });
    setBatchImages([]); setCurrentImageIndex(0);
  }, [batchImages]);

  const handleDeleteFromServer = useCallback(() => { setDeleteConfirmIndex(currentImageIndex); }, [currentImageIndex]);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirmIndex === null) return;
    const img = batchImages[deleteConfirmIndex];
    if (!img?.designId) return;
    try {
      await deleteDesign({ designId: img.designId, projectId }).unwrap();
      setBatchImages((prev) => {
        const next = [...prev]; const removed = next.splice(deleteConfirmIndex, 1)[0];
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl); return next;
      });
      setCurrentImageIndex((prev) => Math.min(prev, Math.max(0, batchImages.length - 2)));
      enqueueSnackbar(t('design.editor.deleteServerSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('design.editor.deleteServerError'), { variant: 'error' });
    } finally {
      setDeleteConfirmIndex(null);
    }
  }, [deleteConfirmIndex, batchImages, deleteDesign, projectId, enqueueSnackbar, t]);

  const handleDeleteCancel = useCallback(() => { setDeleteConfirmIndex(null); }, []);

  const handleDeleteVersion = useCallback(async (version: 'original' | 'processed' | 'bg_removed' | 'upscaled') => {
    const img = batchImages[currentImageIndex];
    if (!img?.designId) return;
    try {
      const updated = await deleteDesignVersion({ designId: img.designId, version, projectId }).unwrap();
      const newLatest = updated.processed_file || updated.bg_removed_file || updated.image_file;
      const hasAny = !!(updated.processed_file || updated.bg_removed_file || updated.upscaled_file);
      if (!newLatest) {
        setBatchImages((prev) => prev.filter((_, i) => i !== currentImageIndex));
        setCurrentImageIndex((prev) => Math.min(prev, Math.max(0, batchImages.length - 2)));
      } else {
        setBatchImages((prev) =>
          prev.map((bi, i) =>
            i === currentImageIndex
              ? { ...bi, previewUrl: newLatest, processedUrl: hasAny ? newLatest : undefined, originalUrl: hasAny ? updated.image_file : undefined, status: hasAny ? 'completed' : 'idle' }
              : bi,
          ),
        );
      }
      enqueueSnackbar(t('design.editor.deleteVersionSuccess', 'Version deleted'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('design.editor.deleteVersionError', 'Delete failed'), { variant: 'error' });
    }
  }, [batchImages, currentImageIndex, deleteDesignVersion, projectId, enqueueSnackbar, t]);

  const handleUndo = useCallback(() => {
    const snapshot = undoRedo.undo(batchImages);
    if (snapshot) setBatchImages(snapshot);
  }, [undoRedo, batchImages]);

  const handleRedo = useCallback(() => {
    const snapshot = undoRedo.redo(batchImages);
    if (snapshot) setBatchImages(snapshot);
  }, [undoRedo, batchImages]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
      if (files.length > 0) handleFilesAdded(files);
    },
    [handleFilesAdded],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }, []);

  const getBatchFile = useCallback((name: string): File | null => {
    return batchImages.find((b) => b.name === name)?.file ?? null;
  }, [batchImages]);

  return {
    batchImages,
    setBatchImages,
    currentImageIndex,
    setCurrentImageIndex,
    currentImage,
    hasImages,
    fileInputRef,
    preloadIds,
    undoRedo,
    selection,
    isDeletingDesign,
    deleteConfirmIndex,
    loadImageMeta,
    saveProcessedImage,
    // Handlers
    handleFilesAdded,
    handleBrowseClick,
    handleFileInputChange,
    handleRemoveImage,
    handleRemoveAll,
    handleDeleteFromServer,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleDeleteVersion,
    handleUndo,
    handleRedo,
    handleDrop,
    handleDragOver,
    getBatchFile,
    // Helpers
    ALWAYS_SERVER_TOOLS,
  };
};

export default useEditorBatchState;
