import { useCallback, useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import { PipelineBar } from './partials/PipelineBar';
import { ToolPanel } from './partials/ToolPanel';
import { EditorCanvas } from './partials/EditorCanvas';
import { BatchThumbnailStrip } from './partials/BatchThumbnailStrip';
import { UnifiedBottomBar } from './partials/UnifiedBottomBar';
import { PreparingDownloadModal } from './partials/PreparingDownloadModal';
import { DropZone } from './partials/DropZone';
import { CloudManagerDialog } from './partials/CloudManagerDialog';
import { useProcessing } from './hooks/useProcessing';
import { useClientProcessing } from './hooks/useClientProcessing';
import { useLivePreview } from './hooks/useLivePreview';
import { useEditorUpload } from './hooks/useEditorUpload';
import useUndoRedo from './hooks/useUndoRedo';
import { useExportCompression } from './hooks/useExportCompression';
import { JobPollerManager } from './partials/JobPollerManager';
import { useGetProjectBoardQuery, useDeleteDesignMutation, useSaveProcessedImageMutation, useDeleteDesignVersionMutation } from '@/store/designSlice';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { PipelineTool, BatchImage, CanvasToolType, CompressionLevel, ExportSettings, ToolName } from './types';
import { PICA_THRESHOLD_PX } from './hooks/usePicaUpscale';
import type { UpscaleMode } from './hooks/usePicaUpscale';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface DesignEditorViewProps {
  /** Project ID for persisting uploaded images */
  projectId: string;
  /** Images passed directly from canvas tab (local blob URLs without designId) */
  initialImages?: Array<{ url: string; name: string }>;
}

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** Server-side tool names always processed on server (ai_upscale handled conditionally) */
const ALWAYS_SERVER_TOOLS: ToolName[] = ['bg_remove'];

/**
 * Determine if an ai_upscale tool should run client-side (Pica) or server-side.
 * Auto mode: >= PICA_THRESHOLD_PX on either axis → client.
 */
const isUpscaleClientSide = (
  tool: PipelineTool,
  imageWidth?: number,
  imageHeight?: number,
): boolean => {
  const mode = (tool.params.mode as UpscaleMode) ?? 'auto';
  if (mode === 'client') return true;
  if (mode === 'server') return false;
  // Auto: check image dimensions
  return (
    (imageWidth !== undefined && imageWidth >= PICA_THRESHOLD_PX) ||
    (imageHeight !== undefined && imageHeight >= PICA_THRESHOLD_PX)
  );
};

const TOOL_PANEL_WIDTH = 280;
const THUMBNAIL_STRIP_HEIGHT = 80;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const EditorRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  position: 'relative',
});

const PipelineBarWrapper = styled(Box)(({ theme }) => ({
  flexShrink: 0,
  backgroundColor: COLORS.ink,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

const ContentRow = styled(Box)({
  display: 'flex',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
});

const ToolPanelWrapper = styled(Box)(({ theme }) => ({
  width: TOOL_PANEL_WIDTH,
  flexShrink: 0,
  backgroundColor: COLORS.ink,
  overflowY: 'auto',
  overflowX: 'hidden',
  scrollbarWidth: 'thin',
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

const CanvasArea = styled(Box)({
  flex: 1,
  minWidth: 0,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
});

const CanvasMain = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: COLORS.ink,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.ash,
  }),
}));

const StripWrapper = styled(Box)(({ theme }) => ({
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderTop: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.ink,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

const ThumbnailRow = styled(Box)({
  height: THUMBNAIL_STRIP_HEIGHT,
  display: 'flex',
});

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const DesignEditorView = ({ projectId, initialImages }: DesignEditorViewProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [searchParams] = useSearchParams();

  // Pipeline state
  const [activePipeline, setActivePipeline] = useState<PipelineTool[]>([]);

  // Helper: load dimensions + fileSize from a URL into a BatchImage
  const loadImageMeta = useCallback((imageId: string, url: string) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => {
      setBatchImages((prev) =>
        prev.map((bi) =>
          bi.id === imageId
            ? { ...bi, width: el.naturalWidth, height: el.naturalHeight }
            : bi,
        ),
      );
      // Also fetch fileSize if not already set (for server-loaded images)
      fetch(url, { method: 'HEAD' })
        .then((res) => {
          const cl = res.headers.get('content-length');
          if (cl) {
            const size = parseInt(cl, 10);
            setBatchImages((prev) =>
              prev.map((bi) =>
                bi.id === imageId && !bi.fileSize ? { ...bi, fileSize: size } : bi,
              ),
            );
          }
        })
        .catch(() => { /* ignore — fileSize stays undefined */ });
    };
    el.src = url;
  }, []);

  // Batch state — seed with initialImages from canvas tab on first render
  const [batchImages, setBatchImages] = useState<BatchImage[]>(() => {
    if (!initialImages || initialImages.length === 0) return [];
    return initialImages.map((img) => ({
      id: crypto.randomUUID(),
      file: null,
      previewUrl: img.url,
      name: img.name,
      status: 'idle' as const,
    }));
  });

  // Load dimensions for initial images
  useEffect(() => {
    if (!initialImages || initialImages.length === 0) return;
    batchImages.forEach((img) => {
      if (!img.width && img.previewUrl) loadImageMeta(img.id, img.previewUrl);
    });
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Fetch project designs on mount — hydrate batch from persisted images
  const { data: boardData } = useGetProjectBoardQuery(
    { projectId },
    { skip: !projectId },
  );
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (hydratedRef.current || !boardData?.designs?.length) return;
    // Don't overwrite if user already dropped images in this session
    if (batchImages.length > 0) return;

    const persisted: BatchImage[] = boardData.designs
      .filter((d) => d.image_file)
      .map((d) => {
        // Priority: processed_file > bg_removed_file > image_file (original)
        const latestUrl = d.processed_file || d.bg_removed_file || d.image_file;
        const hasProcessing = !!(d.processed_file || d.bg_removed_file || d.upscaled_file);
        return {
          id: d.id,
          file: null,
          previewUrl: latestUrl,
          name: d.image_file.split('/').pop() ?? 'design.png',
          status: hasProcessing ? 'completed' as const : 'idle' as const,
          designId: d.id,
          originalUrl: hasProcessing ? d.image_file : undefined,
          processedUrl: hasProcessing ? latestUrl : undefined,
        };
      });

    if (persisted.length > 0) {
      setBatchImages(persisted);
      hydratedRef.current = true;
      // Load dimensions + fileSize for each persisted image
      persisted.forEach((img) => loadImageMeta(img.id, img.previewUrl));
    }
  }, [boardData, batchImages.length, loadImageMeta]);

  // Canvas tool state
  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasToolType>('move');

  // Export compression state
  const [exportCompressionLevel, setExportCompressionLevel] = useState<CompressionLevel>('medium');
  const exportState = useExportCompression();

  // Cloud manager dialog
  const [cloudManagerOpen, setCloudManagerOpen] = useState(false);

  // Derived — must be before hooks that depend on them
  const hasImages = batchImages.length > 0;
  const currentImage = hasImages ? batchImages[currentImageIndex] : null;

  // Processing hooks
  const { startProcessing, jobs, onJobUpdate } = useProcessing();
  const { processBatch, isProcessing, progress, cancel: cancelProcessing } = useClientProcessing();

  // Live preview for the currently selected image
  const { previewUrl: livePreviewUrl, isProcessing: isPreviewProcessing } = useLivePreview(
    currentImage,
    activePipeline,
  );

  // Upload hook — persists dropped files to backend
  const { uploadFiles } = useEditorUpload({ projectId, setBatchImages });

  // Undo/redo hook
  const undoRedo = useUndoRedo();

  // Server delete + revert + save + version delete state
  const [deleteDesign, { isLoading: isDeletingDesign }] = useDeleteDesignMutation();
  const [saveProcessedImage] = useSaveProcessedImageMutation();
  const [deleteDesignVersion] = useDeleteDesignVersionMutation();
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  // Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta || e.key.toLowerCase() !== 'z') return;

      e.preventDefault();
      if (e.shiftKey) {
        const snapshot = undoRedo.redo(batchImages);
        if (snapshot) {
          setBatchImages(snapshot);
        }
      } else {
        const snapshot = undoRedo.undo(batchImages);
        if (snapshot) {
          setBatchImages(snapshot);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoRedo, batchImages]);

  // File input ref for "Browse Files"
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preloaded design IDs from URL (supports both ?designs= and ?images= params)
  const preloadIds = (
    searchParams.get('designs') ?? searchParams.get('images') ?? ''
  ).split(',').filter(Boolean);

  // --- Handlers ---

  const handleFilesAdded = useCallback((files: File[]) => {
    const newImages: BatchImage[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      status: 'idle' as const,
      fileSize: file.size,
    }));
    setBatchImages((prev) => [...prev, ...newImages]);
    if (batchImages.length === 0) {
      setCurrentImageIndex(0);
    }

    // Load natural dimensions for each image
    newImages.forEach((img) => loadImageMeta(img.id, img.previewUrl));

    // Persist to backend — replaces blob URLs with server URLs on success
    uploadFiles(newImages);
  }, [batchImages.length, uploadFiles, loadImageMeta]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleOpenCloudManager = useCallback(() => {
    setCloudManagerOpen(true);
  }, []);

  const handleCloseCloudManager = useCallback(() => {
    setCloudManagerOpen(false);
  }, []);

  /** Helper to retrieve a batch File by name (for cloud upload) */
  const getBatchFile = useCallback((name: string): File | null => {
    const img = batchImages.find((b) => b.name === name);
    return img?.file ?? null;
  }, [batchImages]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        handleFilesAdded(Array.from(files));
      }
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
    batchImages.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setBatchImages([]);
    setCurrentImageIndex(0);
  }, [batchImages]);

  /** Request server deletion for the current image — opens confirmation dialog */
  const handleDeleteFromServer = useCallback(() => {
    setDeleteConfirmIndex(currentImageIndex);
  }, [currentImageIndex]);

  /** Confirm server deletion — delete from API + remove from batch */
  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirmIndex === null) return;
    const img = batchImages[deleteConfirmIndex];
    if (!img?.designId) return;

    try {
      await deleteDesign({ designId: img.designId, projectId }).unwrap();
      // Remove from local batch
      setBatchImages((prev) => {
        const next = [...prev];
        const removed = next.splice(deleteConfirmIndex, 1)[0];
        if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
        return next;
      });
      setCurrentImageIndex((prev) =>
        Math.min(prev, Math.max(0, batchImages.length - 2)),
      );
      enqueueSnackbar(t('design.editor.deleteServerSuccess'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('design.editor.deleteServerError'), { variant: 'error' });
    } finally {
      setDeleteConfirmIndex(null);
    }
  }, [deleteConfirmIndex, batchImages, deleteDesign, projectId, enqueueSnackbar, t]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmIndex(null);
  }, []);

  /** Delete a specific version of the current image */
  const handleDeleteVersion = useCallback(async (version: 'original' | 'processed' | 'bg_removed' | 'upscaled') => {
    const img = batchImages[currentImageIndex];
    if (!img?.designId) return;
    try {
      const updated = await deleteDesignVersion({ designId: img.designId, version, projectId }).unwrap();
      // Recompute local state from server response
      const newLatest = updated.processed_file || updated.bg_removed_file || updated.image_file;
      const hasAny = !!(updated.processed_file || updated.bg_removed_file || updated.upscaled_file);
      if (!newLatest) {
        // No files left — remove from batch
        setBatchImages((prev) => prev.filter((_, i) => i !== currentImageIndex));
        setCurrentImageIndex((prev) => Math.min(prev, Math.max(0, batchImages.length - 2)));
      } else {
        setBatchImages((prev) =>
          prev.map((bi, i) =>
            i === currentImageIndex
              ? {
                  ...bi,
                  previewUrl: newLatest,
                  processedUrl: hasAny ? newLatest : undefined,
                  originalUrl: hasAny ? updated.image_file : undefined,
                  status: hasAny ? 'completed' : 'idle',
                }
              : bi,
          ),
        );
      }
      enqueueSnackbar(t('design.editor.deleteVersionSuccess', 'Version deleted'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('design.editor.deleteVersionError', 'Delete failed'), { variant: 'error' });
    }
  }, [batchImages, currentImageIndex, deleteDesignVersion, projectId, enqueueSnackbar, t]);

  const handleAddTool = useCallback((tool: PipelineTool) => {
    setActivePipeline((prev) => [...prev, tool]);
  }, []);

  const handleRemoveTool = useCallback((toolId: string) => {
    setActivePipeline((prev) => prev.filter((t) => t.id !== toolId));
  }, []);

  const handleReorderPipeline = useCallback((tools: PipelineTool[]) => {
    setActivePipeline(tools);
  }, []);

  const handleToggleTool = useCallback((toolId: string) => {
    setActivePipeline((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t)),
    );
  }, []);

  const handleUpdateParams = useCallback((toolId: string, params: Record<string, unknown>) => {
    setActivePipeline((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, params } : t)),
    );
  }, []);

  // --- Apply pipeline (client + server tools) ---

  const handleUndo = useCallback(() => {
    const snapshot = undoRedo.undo(batchImages);
    if (snapshot) setBatchImages(snapshot);
  }, [undoRedo, batchImages]);

  const handleRedo = useCallback(() => {
    const snapshot = undoRedo.redo(batchImages);
    if (snapshot) setBatchImages(snapshot);
  }, [undoRedo, batchImages]);

  const handleApplyPipeline = useCallback(async () => {
    if (batchImages.length === 0) return;

    // Push snapshot before destructive operation
    undoRedo.pushSnapshot(batchImages);

    // Use first image dims for auto-mode resolution
    const refW = currentImage?.width;
    const refH = currentImage?.height;

    // Split into client-side and server-side tools
    const clientTools = activePipeline.filter((tool) => {
      if (!tool.enabled) return false;
      if (ALWAYS_SERVER_TOOLS.includes(tool.name)) return false;
      // ai_upscale: route based on mode param
      if (tool.name === 'ai_upscale') return isUpscaleClientSide(tool, refW, refH);
      return true;
    });

    const serverTools = activePipeline.filter((tool) => {
      if (!tool.enabled) return false;
      if (ALWAYS_SERVER_TOOLS.includes(tool.name)) return true;
      if (tool.name === 'ai_upscale') return !isUpscaleClientSide(tool, refW, refH);
      return false;
    });

    // 1. Run client-side tools first
    if (clientTools.length > 0) {
      const results = await processBatch(batchImages, clientTools);
      setBatchImages(results);
      // Reload dimensions after pipeline (resize/trim may change them)
      results.forEach((img) => {
        const url = img.processedUrl ?? img.previewUrl;
        if (url) loadImageMeta(img.id, url);
      });

      // Persist client-processed results to server
      for (const img of results) {
        if (img.processedUrl && img.designId && img.processedUrl.startsWith('blob:')) {
          try {
            const resp = await fetch(img.processedUrl);
            const blob = await resp.blob();
            const file = new File([blob], img.name, { type: blob.type || 'image/png' });
            const design = await saveProcessedImage({ designId: img.designId, file, projectId }).unwrap();
            // Update with server URL so it persists across reloads
            setBatchImages((prev) =>
              prev.map((bi) =>
                bi.designId === img.designId
                  ? {
                      ...bi,
                      previewUrl: design.processed_file || design.image_file,
                      processedUrl: design.processed_file || undefined,
                      originalUrl: design.image_file,
                    }
                  : bi,
              ),
            );
          } catch {
            // Keep blob URL as fallback
          }
        }
      }
      enqueueSnackbar(t('design.editor.pipelineSaved', 'Pipeline applied & saved'), { variant: 'success' });
    }

    // 2. Submit server-side tools (bg_remove, ai_upscale in server mode)
    if (serverTools.length > 0) {
      const designIds = batchImages
        .filter((img) => img.designId)
        .map((img) => img.designId!);
      if (designIds.length > 0) {
        const steps = serverTools.map((t) => t.name) as Array<'bg_remove' | 'upscale'>;
        await startProcessing(designIds, steps);
      }
    }
  }, [activePipeline, batchImages, currentImage, processBatch, startProcessing, undoRedo, saveProcessedImage, projectId, enqueueSnackbar, t, loadImageMeta]);

  // --- Load server-job results back into batch images ---
  const handleJobUpdate = useCallback(
    (...args: Parameters<typeof onJobUpdate>) => {
      const [jobId, status, resultFileUrl, errorMessage] = args;
      onJobUpdate(jobId, status, resultFileUrl, errorMessage);

      // When a server job completes, update the corresponding batch image
      if (status === 'completed' && resultFileUrl) {
        const job = jobs.find((j) => j.jobId === jobId);
        if (job) {
          setBatchImages((prev) =>
            prev.map((img) =>
              img.designId === job.designId
                ? { ...img, processedUrl: resultFileUrl, status: 'completed' }
                : img,
            ),
          );
          // Reload dimensions for the new result image
          const batchImg = batchImages.find((img) => img.designId === job.designId);
          if (batchImg) loadImageMeta(batchImg.id, resultFileUrl);
        }
      }
    },
    [onJobUpdate, jobs, batchImages, loadImageMeta],
  );

  // --- Run single server tool on current image ---
  const handleRunServerTool = useCallback(
    async (toolName: string) => {
      if (!currentImage?.designId) return;
      const steps = [toolName] as Array<'bg_remove' | 'upscale'>;
      // Read model from pipeline tool params (if bg_remove)
      const tool = activePipeline.find((t) => t.name === toolName);
      const model = (tool?.params?.model as string) || undefined;
      await startProcessing([currentImage.designId], steps, model);
    },
    [currentImage, startProcessing, activePipeline],
  );

  const isServerProcessing = jobs.some(
    (j) => j.status === 'pending' || j.status === 'running',
  );

  // --- Export handlers ---

  const handleDownloadCurrent = useCallback((settings: ExportSettings) => {
    if (!currentImage) return;
    setExportCompressionLevel(settings.compression);
    void exportState.downloadCurrent(currentImage, settings.compression);
  }, [currentImage, exportState]);

  const handleDownloadAll = useCallback((settings: ExportSettings) => {
    if (batchImages.length === 0) return;
    setExportCompressionLevel(settings.compression);
    void exportState.downloadAll(batchImages, settings.compression);
  }, [batchImages, exportState]);

  // --- Drop handler ---

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      if (files.length > 0) handleFilesAdded(files);
    },
    [handleFilesAdded],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <EditorRoot onDrop={handleDrop} onDragOver={handleDragOver}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileInputChange}
        aria-label={t('design.editor.browseFiles')}
      />

      {/* Job polling manager (renders nothing visible) */}
      <JobPollerManager jobs={jobs} onUpdate={handleJobUpdate} />

      {/* Pipeline Bar (slim pills row) */}
      <PipelineBarWrapper>
        <PipelineBar
          activePipeline={activePipeline}
          onAddTool={handleAddTool}
          onToggleTool={handleToggleTool}
          onRemoveTool={handleRemoveTool}
          onReorder={handleReorderPipeline}
        />
      </PipelineBarWrapper>

      {/* Main content row: left panel + canvas */}
      <ContentRow>
        {/* Left Tool Panel (280px) */}
        <ToolPanelWrapper>
          <ToolPanel
            activePipeline={activePipeline}
            onRemoveTool={handleRemoveTool}
            onToggleTool={handleToggleTool}
            onReorder={handleReorderPipeline}
            onUpdateParams={handleUpdateParams}
            onApply={handleApplyPipeline}
            isProcessing={isProcessing}
            progress={progress}
            onCancelProcessing={cancelProcessing}
            hasImages={hasImages}
            onRunServerTool={handleRunServerTool}
            isServerProcessing={isServerProcessing}
          />
        </ToolPanelWrapper>

        {/* Canvas area */}
        <CanvasArea>
          <CanvasMain>
            {hasImages && currentImage ? (
              <EditorCanvas
                image={currentImage}
                activeTool={activeCanvasTool}
                onToolChange={setActiveCanvasTool}
                batchIndex={currentImageIndex}
                batchTotal={batchImages.length}
                onNavigate={setCurrentImageIndex}
                onRemoveImage={() => handleRemoveImage(currentImageIndex)}
                onRemoveAll={handleRemoveAll}
                onDeleteFromServer={currentImage?.designId ? handleDeleteFromServer : undefined}
                onDeleteVersion={currentImage?.designId ? handleDeleteVersion : undefined}
                livePreviewUrl={livePreviewUrl}
                isPreviewProcessing={isPreviewProcessing}
                isServerProcessing={isServerProcessing}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={undoRedo.canUndo}
                canRedo={undoRedo.canRedo}
              />
            ) : (
              <DropZone
                onBrowse={handleBrowseClick}
                preloadIds={preloadIds}
                onFilesAdded={handleFilesAdded}
                onOpenCloudManager={handleOpenCloudManager}
              />
            )}
          </CanvasMain>

          {/* Bottom thumbnail strip + unified bottom bar */}
          {hasImages && (
            <StripWrapper>
              <ThumbnailRow>
                <BatchThumbnailStrip
                  images={batchImages}
                  currentIndex={currentImageIndex}
                  onSelect={setCurrentImageIndex}
                  onAddMore={handleBrowseClick}
                  onOpenCloudManager={handleOpenCloudManager}
                />
              </ThumbnailRow>
              <UnifiedBottomBar
                currentImage={currentImage}
                totalImages={batchImages.length}
                onDownloadCurrent={handleDownloadCurrent}
                onDownloadAll={handleDownloadAll}
              />
            </StripWrapper>
          )}
        </CanvasArea>
      </ContentRow>

      {/* Cloud Storage Manager */}
      <CloudManagerDialog
        open={cloudManagerOpen}
        onClose={handleCloseCloudManager}
        onFilesAdded={handleFilesAdded}
        batchFileNames={batchImages.map((img) => img.name)}
        getBatchFile={getBatchFile}
      />

      {/* Preparing Download Modal */}
      <PreparingDownloadModal
        open={exportState.isCompressing}
        onCancel={exportState.cancel}
        compressionLevel={exportCompressionLevel}
        progress={exportState.progress}
        currentImage={exportState.currentImageIndex}
        totalImages={exportState.totalImages}
      />

      {/* Delete from server confirmation */}
      <ConfirmDialog
        open={deleteConfirmIndex !== null}
        title={t('design.editor.deleteServerDialogTitle')}
        body={t('design.editor.deleteServerDialogBody', {
          name: deleteConfirmIndex !== null ? batchImages[deleteConfirmIndex]?.name ?? '' : '',
        })}
        confirmLabel={t('design.editor.deleteServerConfirm')}
        cancelLabel={t('design.editor.deleteServerCancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={isDeletingDesign}
      />
    </EditorRoot>
  );
};

export default DesignEditorView;
